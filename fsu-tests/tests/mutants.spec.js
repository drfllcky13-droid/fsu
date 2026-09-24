// Tests written for mutations that fsu-tests/mutate.js made and nothing caught (2026-09-24 run,
// 25 mutants, seed 1, plus the trial run). Each names the line it guards and the mutation that
// survived before it existed. Kept small: each checks the one behaviour the mutation broke.
const {test,expect}=require("@playwright/test");

// a one-pixel JPEG, padded so the app takes it for a real image
const JPEG=Buffer.concat([Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z","base64"),Buffer.alloc(2000)]);
const item=(name,loc,qty,par)=>({id:"t"+name.replace(/\W/g,""),name,loc,cat:"",cls:"Consumable",qty:String(qty),par:String(par),
  date:"",status:"",gapType:"",note:"",source:"",verified:"",uses:[],rel:[],links:[],fav:false});
const comp=(code,desc)=>({code,desc:desc||"",side:"Driver",x:1,y:1,w:6,h:4});

async function openVan(page,width){
  await page.setViewportSize({width:width||1400,height:1000});
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&!!document.querySelector("section.view.on"));
}
async function openSketch(page){
  await page.setViewportSize({width:1400,height:1000});
  await page.goto("/scenes.html#v=sketch&ref=new");
  await page.waitForFunction(()=>typeof bgSheet==="function"&&!!curSketch);
}
// a van with just these records
const seedVan=(page,items,comps)=>page.evaluate(([items,comps])=>{S.items=items;S.comps=comps;S.demo=false;save()},[items,comps]);

/* ---------- the van (index.html) ---------- */

// src/events.js, #wipe: `S.demo=false` survived as `S.demo=true`. After Erase everything the app
// must not still think it is showing the sample van.
test("erasing everything leaves no sample flag behind",async({page})=>{
  await openVan(page);
  await page.evaluate(()=>{S.demo=true;save();
    document.body.insertAdjacentHTML("beforeend",'<button id="wipe"></button>');document.getElementById("wipe").click();
    document.getElementById("cfyes").click()});
  expect(await page.evaluate(()=>S.demo)).toBe(false);
});

// src/views-items.js, renderInventory: `invGroup==="az"` survived as `!==`. A to Z is one list,
// alphabetical, not grouped.
test("the A to Z item list is alphabetical",async({page})=>{
  await openVan(page,834);   // iPad portrait: the list; wide screens show a table instead
  const expired={...item("Markers","A1",4,1),date:"2020-01-01"};
  await seedVan(page,[item("Zinc tape","A1",5,1),item("Bags","B2",5,1),expired],[comp("A1"),comp("B2")]);
  const r=await page.evaluate(()=>{invGroup="az";go("inventory");
    return {ids:[...document.querySelectorAll("#v-inventory [data-item]")].map(b=>b.dataset.item),
      heads:document.querySelectorAll("#v-inventory .sect").length}});
  expect(r).toEqual({ids:["tBags","tMarkers","tZinctape"],heads:1});   // just the count: no group headings
});

// src/views-items.js, applyGuides: `b.item&&b.steps.length` survived as `||`. Pasted instructions
// for a name that matches no item are reported as missing, and the matching ones still apply.
test("pasted instructions for an unknown item are listed, not applied",async({page})=>{
  await openVan(page);
  await seedVan(page,[item("Black powder","A1",2,1)],[comp("A1")]);
  const r=await page.evaluate(()=>applyGuides("No such thing\n- a step\n\nBlack powder\n- open the jar\n- dip the brush"));
  expect(r).toEqual({n:1,miss:["No such thing"]});
  expect(await page.evaluate(()=>S.items[0].steps)).toEqual(["open the jar","dip the brush"]);
});

// src/views-items.js, ingest: `!S.comps.some(c=>c.code===o.loc)` survived as `c.code!==o.loc`.
// A CSV row naming a compartment the van does not have yet adds that compartment.
test("importing a CSV adds the compartments its rows name",async({page})=>{
  await openVan(page);
  await seedVan(page,[],[comp("A1")]);
  const codes=await page.evaluate(()=>{ingest("name,loc,cat,cls,qty,par\nTape,Z9,,Consumable,2,1",false); return S.comps.map(c=>c.code).sort()});
  expect(codes).toEqual(["A1","Z9"]);
});

// src/data-van.js, bayTally: `s.k==="attn"` survived as `!==`. The bay badge counts only the
// compartments that need attention.
test("a bay's badge counts only the compartments needing attention",async({page})=>{
  await openVan(page);
  await seedVan(page,[],[comp("A1"),comp("A2"),comp("A3")]);
  const html=await page.evaluate(()=>{compState=code=>({k:code==="A1"?"attn":"good",items:[]}); return bayTally("A")});
  expect(html).toContain("1 attention");
});

// src/views-van.js, renderCompDetail: `(low||expiring||service)&&!out&&!expired` survived as
// `…||!out&&!expired`. "To check" counts the items below par, not every item in stock.
test("a compartment's 'to check' count is the items below par",async({page})=>{
  await openVan(page);
  await seedVan(page,[item("Gloves","A1",1,5),item("Swabs","A1",9,2),item("Tape","A1",4,1)],[comp("A1","Drawer 1")]);
  const text=await page.evaluate(()=>{curComp="A1";view="compdetail";
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id==="v-compdetail"));render();
    return document.querySelector("#v-compdetail").textContent.replace(/\s+/g," ")});
  expect(text).toContain("1 to check");
});

// src/views-van.js, renderHome: `r[0]===1?one:many` survived as `!==`. One unnamed compartment is
// "1 compartment", not "1 compartments".
test("Home says '1 compartment not named' for one",async({page})=>{
  await openVan(page);
  await seedVan(page,[],[comp("A1",""),comp("A2","Drawer 2")]);
  const text=await page.evaluate(()=>{go("home");render();return document.querySelector("#v-home").textContent.replace(/\s+/g," ")});
  expect(text).toContain("1 compartment not named");
});

// src/events.js, Delete compartment: askConfirm(…, true, …) survived as false. The confirm button
// for a delete is drawn as the dangerous one.
test("deleting a compartment asks with the red, dangerous button",async({page})=>{
  await openVan(page);
  await seedVan(page,[],[comp("A1","Drawer 1")]);
  await page.evaluate(()=>{document.body.insertAdjacentHTML("beforeend",'<button data-editcomp="A1" id="ec"></button>');
    document.getElementById("ec").click(); document.getElementById("cdel").click()});
  const cls=await page.getAttribute("#cfyes","class"), style=await page.getAttribute("#cfyes","style");
  expect(cls).toContain("sec"); expect(style).toContain("var(--red)");
});

/* ---------- the scene (scenes.html) ---------- */

// src/sketch-canvas.js, place() in bgSheet: `place:hit.label||""` survived as `hit.label&&""`.
// The place is what the sketch PDF prints under an aerial backdrop, so it must be the address picked.
test("an aerial backdrop keeps the address it was placed at",async({page})=>{
  await page.route(/imagery\.pasda\.psu\.edu/,r=>r.fulfill({status:200,contentType:"image/jpeg",body:JPEG}));
  await openSketch(page);
  await page.evaluate(()=>bgSheet(curSk()));
  await page.click('#sheet [data-bgkind="aerial"]');
  await page.fill("#bgq","412 Elm");
  await page.click("#bgfind");
  const first=page.locator("#bghits [data-hit]").first();
  await first.waitFor();
  const label=(await first.locator(".code").innerText()).trim();
  await first.click();
  await page.waitForFunction(()=>{const b=curSk().bg; return !!(b&&b.kind==="aerial")},null,{timeout:20000});
  expect(label).toMatch(/ELM/i);
  expect(await page.evaluate(()=>curSk().bg.place)).toBe(label);
});

// src/sketch-canvas.js, bgSheet "less"/"more": after a failed fetch `disabled=false` survived as
// `true`. The buttons must work again, or the only way out is to close the sheet.
test("a failed change of backdrop size leaves the size buttons usable",async({page})=>{
  await page.route(/imagery\.pasda\.psu\.edu/,r=>r.fulfill({status:500,body:""}));
  await openSketch(page);
  await page.evaluate(()=>{const sk=curSk();
    sk.bg={imgId:"none",x:100,y:200,w:600,h:600,op:1,br:1,sa:.95,kind:"aerial",lat:41.2412,lon:-77.0011,ground:200,px:1024,src:"PEMA"};
    sk.scale={px:600,real:200,unit:"ft"}; saveLocal(); bgSheet(sk)});
  await page.click("#bgmore");
  await expect(page.locator("#bgarea")).not.toHaveText(/Fetching imagery/,{timeout:20000});
  expect(await page.evaluate(()=>[...document.querySelectorAll("#bgless,#bgmore")].map(b=>b.disabled))).toEqual([false,false]);
});

// src/pdf.js, photoThumbs: `(S.sketches||[])` survived as `(S.sketches&&[])`. The photograph log
// takes its thumbnails from the photo points on the incident's sketches.
test("the photograph log finds the photographs on the incident's sketch",async({page})=>{
  await openSketch(page);
  const keys=await page.evaluate(async()=>{
    const inc=newIncident(); save(); const sk=curSk(); sk.incidentId=inc.id;
    await photoPut("ph1",{data:"data:image/jpeg;base64,/9j/4A==",w:10,hh:10});
    sk.objs.push({id:"pp1",t:"photopoint",x:10,y:10,w:64,h:64,r:0,n:"1",photoId:"ph1",lay:"L1"}); saveLocal();
    return Object.keys(await photoThumbs({incidentId:inc.id}))});
  expect(keys).toEqual(["1"]);
});

// src/ext-sketch-3.js, inkFinish: `pts.length===1` survived as `!==`. Only a single tap gets a
// second point; a real stroke must end where the pen lifted, not jump back beside where it started.
test("a pen stroke ends where the pen was lifted",async({page})=>{
  await openSketch(page);
  const last=await page.evaluate(()=>{inkFinish([[100,300],[250,300],[400,300]],"#000"); const sk=curSk(); const o=sk.objs[sk.objs.length-1];
    const p=o.pts[o.pts.length-1]; return [Math.round(o.x+p[0]*o.w),Math.round(o.y+p[1]*o.h)]});
  expect(last).toEqual([400,300]);
});

// src/ext-sketch-1.js, extraPointerDown: `P.length>=3` survived as `>3`. Tapping the first corner of
// a three-corner shape closes it as a triangle.
test("a three-corner shape closes when its first corner is tapped",async({page})=>{
  await openSketch(page);
  const r=await page.evaluate(()=>{polyStart(); polyDraw.pts.push({x:200,y:200},{x:400,y:200},{x:300,y:380});
    const before=curSk().objs.length;
    extraPointerDown({preventDefault(){}},document.querySelector("svg"),{x:201,y:201});
    return {open:!!polyDraw, added:curSk().objs.length-before}});
  expect(r).toEqual({open:false,added:1});
});

// src/ext-sketch-3.js, measGeom: the side test `>0?"l":"r"` survived as `<0`. Triangulating a
// point and solving the measurement again must land on the same spot, not its mirror image.
test("a triangulated point solves back to where it was",async({page})=>{
  await openSketch(page);
  const r=await page.evaluate(()=>{const sk=curSk(); sk.scale={px:100,real:10,unit:"ft"};
    addObj("refpoint"); const a=objAt(selObj); a.x=200;a.y=600;
    addObj("refpoint"); const b=objAt(selObj); b.x=700;b.y=600;
    addObj("marker"); const m=objAt(selObj); m.x=380;m.y=300;
    m.meas={m:"tri",a:a.id+":c",b:b.id+":c",da:1,db:1,side:"l"};
    const g=measGeom(sk,m), at=objAnchor(m), got=solveMeas(sk,g);
    return {dx:Math.round(got.x-at.x), dy:Math.round(got.y-at.y)}});
  expect(Math.abs(r.dx)).toBeLessThanOrEqual(2); expect(Math.abs(r.dy)).toBeLessThanOrEqual(2);
});

// src/ext-sketch-1.js, wallSheet: `o.x+=dx` survived as `o.x-=dx`. A room drawn from its sizes is
// centred on the page, not thrown off to one side.
test("a room drawn from its width and depth is centred on the page",async({page})=>{
  await openSketch(page);
  await page.evaluate(()=>wallSheet(curSk()));
  await page.click("#wtroom");
  await page.fill("#wrw","16"); await page.fill("#wrd","12");
  await page.click("#wgo");
  const r=await page.evaluate(()=>{const sk=curSk(), ws=sk.objs.filter(o=>o.t==="wall");
    const x0=Math.min(...ws.map(o=>o.x)), x1=Math.max(...ws.map(o=>o.x+o.w));
    return {n:ws.length, off:Math.round((x0+x1)/2-pageW(sk)/2)}});
  expect(r.n).toBeGreaterThan(0); expect(Math.abs(r.off)).toBeLessThanOrEqual(2);
});

// src/sketch-canvas.js, pointerdown on an object: `x.id===curSketch` survived as `!==`. The undo
// step for a drag is taken on the sketch being drawn, so Undo puts a dragged object back.
test("undo puts a dragged object back",async({page})=>{
  await openSketch(page);
  // high on the page, so it is on screen whatever bars sit above the canvas
  const id=await page.evaluate(()=>{closeSheet(); addObj("chair"); const o=objAt(selObj); o.x=400;o.y=180; selObj=null; saveLocal(); renderSketch(); return o.id});
  const box=await page.locator(`[data-obj="${id}"]`).first().boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+120,box.y+box.height/2+80,{steps:5}); await page.mouse.up();
  const moved=await page.evaluate(id=>{const o=curSk().objs.find(x=>x.id===id); return [o.x,o.y]},id);
  expect(moved).not.toEqual([400,180]);
  await page.evaluate(()=>doUndo());
  expect(await page.evaluate(id=>{const o=curSk().objs.find(x=>x.id===id); return [o.x,o.y]},id)).toEqual([400,180]);
});

// src/ext-reports.js, exportFillDocx: `if(view==="fill")renderFill()` survived as `!==`. Exporting
// from the open form redraws it, so what it shows matches the record.
test("exporting a form as Word redraws the open form",async({page})=>{
  await page.setViewportSize({width:1400,height:1000});
  await page.goto("/scenes.html");
  await page.waitForFunction(()=>typeof exportFillDocx==="function");
  const n=await page.evaluate(async()=>{
    const inc=newIncident(); save(); curInc=inc.id; go("incident");
    document.querySelector("[data-plan=report]").click();
    Object.defineProperty(navigator,"canShare",{value:undefined,configurable:true}); dlBlob=()=>{};
    let calls=0; const real=renderFill; renderFill=(...a)=>{calls++;return real(...a)};
    await exportFillDocx((S.fills||[]).find(x=>x.id===curFill)); renderFill=real; return calls});
  expect(n).toBeGreaterThanOrEqual(1);
});
