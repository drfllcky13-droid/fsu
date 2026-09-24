// Typing in a form saves after a pause, not on every key, and nothing typed is lost to that pause:
// hiding the page or leaving it writes at once, a reload keeps the text, and the other open page
// still gets it, even when that page saves something of its own in the meantime.
const {test,expect}=require("@playwright/test");

const TEXT="Rear door forced at the strike plate, frame split";

// counts every write of the record, from before the app's own script runs
async function countWrites(ctx){
  await ctx.addInitScript(()=>{
    window.__writes=0; const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){ if(this===window.localStorage&&k==="van3")window.__writes++; return set.call(this,k,v) };
  });
}
async function open(page){
  await page.goto("/scenes.html");
  await page.waitForFunction(()=>typeof render==="function"&&!!document.querySelector("section.view.on"));
}
// a report opened on a new incident, with the caret in its first long field
async function openReport(page){
  await page.evaluate(()=>{const inc=newIncident(); inc.caseNo="FS-1"; save(); curInc=inc.id; go("incident")});
  await page.click("[data-plan=report]");
  const ta=page.locator("textarea[data-fv]").first();
  const fid=await ta.getAttribute("data-fv");
  await ta.click();
  return {ta,fid};
}
const stored=(page,fid)=>page.evaluate(fid=>{
  const o=JSON.parse(localStorage.getItem("van3")||"{}"), f=(o.fills||[]).find(x=>x.id===curFill);
  return f&&f.values?f.values[fid]:undefined},fid);

test.beforeEach(async({page})=>{ await page.setViewportSize({width:1200,height:900}) });

test("typing a sentence saves once after the pause, not on every key",async({page,context})=>{
  await countWrites(context); await open(page);
  const {ta,fid}=await openReport(page);
  const before=await page.evaluate(()=>window.__writes);
  await ta.pressSequentially(TEXT,{delay:20});
  const during=await page.evaluate(()=>window.__writes)-before;
  await page.waitForTimeout(900);
  const after=await page.evaluate(()=>window.__writes)-before;
  expect(during,"writes while typing "+TEXT.length+" characters").toBeLessThanOrEqual(1);
  expect(after,"writes once typing stopped").toBeLessThanOrEqual(2);
  expect(await stored(page,fid)).toBe(TEXT);
});

for(const how of ["visibilitychange","pagehide"]){
  test(`${how} mid-pause writes what was typed at once`,async({page})=>{
    await open(page);
    const {ta,fid}=await openReport(page);
    await ta.pressSequentially(TEXT,{delay:5});
    // in the same turn as the event, well inside the pause: nothing may be waiting for a timer
    const got=await page.evaluate(({how,fid})=>{
      if(how==="visibilitychange"){
        Object.defineProperty(document,"visibilityState",{value:"hidden",configurable:true});
        document.dispatchEvent(new Event("visibilitychange"));
      }else window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:false}));
      const o=JSON.parse(localStorage.getItem("van3")||"{}"), f=(o.fills||[]).find(x=>x.id===curFill);
      return f&&f.values?f.values[fid]:undefined},{how,fid});
    expect(got).toBe(TEXT);
  });
}

test("a reload straight after typing keeps the text",async({page})=>{
  await open(page);
  const {ta,fid}=await openReport(page);
  const fill=await page.evaluate(()=>curFill);
  await ta.pressSequentially(TEXT,{delay:5});
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function"&&Array.isArray(S.fills));
  expect(await page.evaluate(({fill,fid})=>{const f=S.fills.find(x=>x.id===fill); return f&&f.values[fid]},{fill,fid})).toBe(TEXT);
});

test("the other open page gets the typing, and a save it makes mid-pause loses neither",async({page,context})=>{
  await open(page);
  const other=await context.newPage(); await open(other);
  const {ta,fid}=await openReport(page);
  const fill=await page.evaluate(()=>curFill);
  // the other page picks the text up once it is written
  await ta.pressSequentially("First part",{delay:5});
  await expect.poll(()=>other.evaluate(({fill,fid})=>{const f=(S.fills||[]).find(x=>x.id===fill); return f&&f.values[fid]},{fill,fid})).toBe("First part");
  // more typing, then the other page saves something of its own before the pause is up
  await ta.pressSequentially(", then more",{delay:5});
  await other.evaluate(()=>{S.whoName="Det. Other Page"; save()});
  await page.waitForTimeout(900);
  for(const p of [page,other]){
    const r=await p.evaluate(({fill,fid})=>{const o=JSON.parse(localStorage.getItem("van3")); const f=o.fills.find(x=>x.id===fill);
      return {text:f.values[fid], who:o.whoName, mem:S.fills.find(x=>x.id===fill).values[fid], memWho:S.whoName}},{fill,fid});
    expect(r).toEqual({text:"First part, then more",who:"Det. Other Page",mem:"First part, then more",memWho:"Det. Other Page"});
  }
});

test("naming a sketch object saves after the pause, and a reload keeps the name",async({page,context})=>{
  await countWrites(context);
  await page.goto("/scenes.html#v=sketch&ref=new");
  await page.waitForFunction(()=>typeof addObj==="function"&&!!curSketch);
  await page.evaluate(()=>{addObj("chair"); showSet=true; renderSketch()});
  const skid=await page.evaluate(()=>curSketch), oid=await page.evaluate(()=>selObj);
  const before=await page.evaluate(()=>window.__writes);
  await page.locator("#oname").pressSequentially("Kitchen table",{delay:20});
  const during=await page.evaluate(()=>window.__writes)-before;
  expect(during,"writes while typing a 13-letter name").toBeLessThanOrEqual(1);
  await page.reload();
  await page.waitForFunction(()=>Array.isArray(S.sketches));
  expect(await page.evaluate(({skid,oid})=>S.sketches.find(s=>s.id===skid).objs.find(o=>o.id===oid).label,{skid,oid})).toBe("Kitchen table");
});
