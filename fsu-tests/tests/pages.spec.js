// Two pages, one record. The app used to be one file; it is now the van (index.html) and the
// scene (scenes.html), and every route between them goes through the address bar. These press
// the crossings the way a user does and check where they land, that a reload holds, that a
// stale or nonsense address cannot blank the screen, that the two pages do not clobber each
// other's record, and that nothing was orphaned by the split.
const {test,expect}=require("@playwright/test");
const fs=require("fs"), path=require("path");
const root=f=>fs.readFileSync(path.join(__dirname,"..","..",f),"utf8");

const VAN="/index.html", SCENES="/scenes.html";

async function open(page,url){
  await page.goto(url);
  await page.waitForFunction(()=>typeof render==="function"&&!!document.querySelector("section.view.on"));
}
// where we actually are: the file, the address, the one section that is showing, and the
// pointers that say which record it is showing
const where=page=>page.evaluate(()=>{
  const on=[...document.querySelectorAll("section.view.on")].map(s=>s.id);
  const lead=document.querySelector("section.view.on");
  return {file:location.pathname.split("/").pop(), hash:location.hash, on, view,
    body:lead?lead.innerHTML.trim().length:0,
    curInc,curSketch,curFill,curItem,curComp,curBay};
});
// One incident with a form and a sketch filed to it. The sketch is written out longhand
// rather than through newSketch() because that only exists on the page that draws.
async function seed(page){
  return page.evaluate(()=>{
    const inc=newIncident(); inc.caseNo="26-004455"; inc.offence="Burglary"; inc.addr="12 Mill Rd";
    const form=S.forms.find(f=>f.name==="Evidence log")||S.forms[0];
    const r=newFill(form); r.incidentId=inc.id;
    const sk={id:"sk"+newId(),objs:[{id:newId(),t:"refpoint",x:40,y:40,w:10,h:10}],
      layers:[],when:new Date().toISOString(),v:4,incidentId:inc.id,caseNo:inc.caseNo};
    (S.sketches=S.sketches||[]).push(sk);
    save();
    return {inc:inc.id, fill:r.id, sketch:sk.id, form:form.id};
  });
}

/* ---------- 1. the crossings ---------- */

test("Quick sketch on the van opens a new sketch on the scene",async({page})=>{
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await open(page,VAN);
  await page.click("[data-quicksketch]");
  await page.waitForFunction(()=>location.pathname.endsWith("scenes.html")&&typeof render==="function");
  await page.waitForFunction(()=>view==="sketch");
  const w=await where(page);
  expect(w.file).toBe("scenes.html");
  expect(w.on).toEqual(["v-sketch"]);
  expect(w.body,"the sketch view came up blank").toBeGreaterThan(0);
  const made=await page.evaluate(()=>({n:(S.sketches||[]).length, open:!!S.sketches.find(s=>s.id===curSketch)}));
  expect(made).toEqual({n:1,open:true});
  expect(w.hash,"the new sketch is not in the address, so a reload loses it").toContain("ref="+w.curSketch);
  expect(errs).toEqual([]);
});

test("the Scenes tab on the van lands on the incident list",async({page})=>{
  await open(page,VAN);
  await page.click('#side button[data-v="active"]');
  await page.waitForFunction(()=>location.pathname.endsWith("scenes.html")&&typeof render==="function");
  const w=await where(page);
  expect([w.file,w.view,w.on.join()]).toEqual(["scenes.html","active","v-active"]);
  expect(w.body).toBeGreaterThan(0);
});

for(const [v,label] of [["home","Home"],["compartments","Storage"],["inventory","Items"],["guide","Guide"]]){
  test(`${label} on the scene lands on the van's ${v}`,async({page})=>{
    await open(page,SCENES);
    await page.click(`#side button[data-v="${v}"]`);
    await page.waitForFunction(()=>location.pathname.endsWith("index.html")&&typeof render==="function");
    const w=await where(page);
    expect([w.file,w.view,w.on.join()]).toEqual(["index.html",v,"v-"+v]);
    expect(w.body).toBeGreaterThan(0);
  });
}

test("Settings is reached from either page and is the van's own",async({page})=>{
  await open(page,SCENES);
  await page.click("#side .sset");
  await page.waitForFunction(()=>location.pathname.endsWith("index.html")&&typeof render==="function");
  let w=await where(page);
  expect([w.file,w.view,w.on.join()]).toEqual(["index.html","data","v-data"]);
  expect(w.body).toBeGreaterThan(0);
  // from the van it is the same view without leaving the page
  await page.click('#side button[data-v="home"]');
  await page.click("#side .sset");
  w=await where(page);
  expect([w.file,w.view,w.on.join()]).toEqual(["index.html","data","v-data"]);
});

test("an incident's sketch row opens that sketch, and its form row that form",async({page})=>{
  await open(page,SCENES);
  const ids=await seed(page);
  await page.evaluate(id=>{curInc=id;view="incident";render()},ids.inc);
  await page.waitForSelector('[data-plan="sketch"]');
  await page.click('[data-plan="sketch"]');
  let w=await where(page);
  expect([w.view,w.on.join(),w.curSketch]).toEqual(["sketch","v-sketch",ids.sketch]);
  expect(w.body).toBeGreaterThan(0);

  // the same row for a document that is a form, not a sketch
  await page.evaluate(id=>{curInc=id;view="incident";render()},ids.inc);
  await page.click('[data-plan="evidence"]');
  w=await where(page);
  expect([w.view,w.on.join(),w.curFill]).toEqual(["fill","v-fill",ids.fill]);
  expect(w.body).toBeGreaterThan(0);
});

test("the document tabs switch between an open form and an open sketch",async({page})=>{
  await open(page,SCENES);
  // the tabs only appear for loose documents, the ones not filed to an incident
  const ids=await page.evaluate(()=>{
    const r=newFill(S.forms[0]);
    const sk={id:"sk"+newId(),objs:[{id:newId(),t:"refpoint",x:40,y:40,w:10,h:10}],
      layers:[],when:new Date().toISOString(),v:4,caseNo:"26-004455"};
    (S.sketches=S.sketches||[]).push(sk); save();
    curFill=r.id; view="fill"; render();
    return {fill:r.id, sketch:sk.id};
  });
  // both views carry a copy of the tab strip, so press the one on screen
  await page.click(`section.view.on [data-doc="sketch:${ids.sketch}"]`);
  let w=await where(page);
  expect([w.view,w.on.join(),w.curSketch]).toEqual(["sketch","v-sketch",ids.sketch]);
  await page.click(`section.view.on [data-doc="fill:${ids.fill}"]`);
  w=await where(page);
  expect([w.view,w.on.join(),w.curFill]).toEqual(["fill","v-fill",ids.fill]);
});

test("the incident's Export bundle is on the page that can build it",async({page})=>{
  await open(page,SCENES);
  const ids=await seed(page);
  await page.evaluate(id=>{curInc=id;view="incident";render()},ids.inc);
  expect(await page.locator("[data-incbundle]").count()).toBe(1);
  expect(await page.evaluate(()=>typeof bundleIncident)).toBe("function");
  // the van has neither the incident screen nor the bundler, so nothing there can call it
  await open(page,VAN);
  expect(await page.evaluate(()=>document.getElementById("v-incident"))).toBeNull();
  expect(await page.evaluate(()=>typeof bundleIncident)).toBe("undefined");
});

/* ---------- 2. a reload holds ---------- */

test("a reload stays on the record the crossing landed on",async({page})=>{
  await open(page,VAN);
  await page.click("[data-quicksketch]");
  await page.waitForFunction(()=>location.pathname.endsWith("scenes.html")&&typeof render==="function");
  await page.waitForFunction(()=>view==="sketch");
  const before=await where(page);
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function");
  const after=await where(page);
  expect([after.file,after.view,after.on.join()]).toEqual(["scenes.html","sketch","v-sketch"]);
  expect(after.curSketch,"the reload opened a different sketch").toBe(before.curSketch);
  expect(after.body).toBeGreaterThan(0);
  expect(await page.evaluate(()=>(S.sketches||[]).length),"the reload made a second sketch").toBe(1);
});

test("moving around a page keeps the address honest, so a reload does not jump back",async({page})=>{
  await open(page,VAN);
  const ids=await seed(page);
  await page.click('#side button[data-v="active"]');
  await page.waitForFunction(()=>location.pathname.endsWith("scenes.html")&&typeof render==="function");
  // arrived at the incident list; now walk one step in, the way a user does
  await page.click(`[data-inc="${ids.inc}"]`);
  const w=await where(page);
  expect([w.view,w.curInc]).toEqual(["incident",ids.inc]);
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function");
  const after=await where(page);
  expect([after.view,after.curInc],
    "the address still said #v=active, so the reload threw away the incident that was open")
    .toEqual(["incident",ids.inc]);
});

/* ---------- 3. a stale or nonsense address ---------- */

const BAD=[
  [SCENES,"#v=sketch&ref=nosuchsketch","a sketch that is not there"],
  [SCENES,"#v=fill&ref=nosuchfill","a form that is not there"],
  [SCENES,"#v=incident&ref=nosuchincident","an incident that is not there"],
  [SCENES,"#v=home","a van view asked for on the scene"],
  [SCENES,"#v=nonsense","a view that does not exist"],
  [SCENES,"#","an empty address"],
  [SCENES,"#v=sketch&ref=","a sketch with no id"],
  [VAN,"#v=itemdetail&ref=nosuchitem","an item that is not there"],
  [VAN,"#v=compdetail&ref=ZZZ9","a compartment that is not there"],
  [VAN,"#v=bay&ref=ZZZ","a bay that is not there"],
  [VAN,"#v=sketch&ref=abc","a scene view asked for on the van"],
  [VAN,"#v=nonsense","a view that does not exist"],
  [VAN,"#","an empty address"],
];
for(const [url,hash,what] of BAD){
  test(`${what} (${url+hash}) opens on something, not a blank screen`,async({page})=>{
    const errs=[]; page.on("pageerror",e=>errs.push(e.message));
    await page.goto(url+hash);
    await page.waitForFunction(()=>typeof render==="function");
    await page.waitForTimeout(120);
    const w=await where(page);
    expect(errs).toEqual([]);
    expect(w.on.length,"no view is showing at all").toBeGreaterThan(0);
    expect(w.body,"the view that is showing was never drawn into").toBeGreaterThan(0);
  });
}

test("a ref for the wrong kind of record does not open someone else's",async({page})=>{
  const errs=[]; page.on("pageerror",e=>errs.push(e.message));
  await open(page,SCENES);
  const ids=await seed(page);
  // an incident id handed to the sketch view: it is a real id, just not a sketch
  await page.goto(SCENES+"#v=sketch&ref="+ids.inc);
  await page.waitForFunction(()=>typeof render==="function");
  await page.waitForTimeout(120);
  const w=await where(page);
  expect(errs).toEqual([]);
  expect(w.on.length).toBeGreaterThan(0);
  expect(w.curSketch,"an incident id was accepted as the open sketch").not.toBe(ids.inc);
  expect(w.body,"the sketch view was left empty because that id is an incident").toBeGreaterThan(0);
});

/* ---------- 4. the two pages do not fight over the record ---------- */

test("a save on one page shows on the other without a reload",async({context})=>{
  const van=await context.newPage(); await open(van,VAN);
  await seed(van);
  const scene=await context.newPage(); await open(scene,SCENES);
  await van.evaluate(()=>{const inc=S.incidents[0]; inc.caseNo="26-999999"; save()});
  await scene.waitForFunction(()=>(S.incidents[0]||{}).caseNo==="26-999999",null,{timeout:5000});
  expect(await scene.evaluate(()=>S.incidents[0].caseNo)).toBe("26-999999");
  await van.close(); await scene.close();
});

test("neither page writes over the other's work",async({context})=>{
  const van=await context.newPage(); await open(van,VAN);
  const ids=await seed(van);
  const scene=await context.newPage(); await open(scene,SCENES);
  // the van adds an item; the scene, which loaded before that, then saves its own change
  await van.evaluate(()=>{S.items.push({id:"twopage",name:"Two page item",qty:"1",cat:"A",cls:"Consumable"});save()});
  await scene.waitForFunction(()=>!!S.items.find(i=>i.id==="twopage"),null,{timeout:5000});
  await scene.evaluate(id=>{const inc=S.incidents.find(x=>x.id===id); inc.offence="Arson"; save()},ids.inc);
  await van.waitForFunction(()=>(S.incidents[0]||{}).offence==="Arson",null,{timeout:5000});
  const saved=await van.evaluate(()=>JSON.parse(localStorage.getItem("van3")));
  expect(!!saved.items.find(i=>i.id==="twopage"),"the scene's save dropped the van's item").toBe(true);
  expect(saved.incidents[0].offence,"the van's copy never took the scene's change").toBe("Arson");
  await van.close(); await scene.close();
});

/* ---------- 5. nothing orphaned by the split ---------- */

const SRC=fs.readdirSync(path.join(__dirname,"..","..","src"))
  .filter(f=>/\.(js|html)$/.test(f))
  .map(f=>[f,fs.readFileSync(path.join(__dirname,"..","..","src",f),"utf8")]);
const sections=html=>[...html.matchAll(/id="v-([a-z]+)"/g)].map(m=>m[1]);

test("every view exists on exactly one page, and pages.js agrees",async()=>{
  const van=sections(root("index.html")), scenes=sections(root("scenes.html"));
  expect(van.filter(v=>scenes.includes(v)),"a view is built into both pages").toEqual([]);
  const listed=[...root("src/pages.js").matchAll(/"([a-z]+)"/g)].map(m=>m[1]);
  for(const v of [...van,...scenes])
    expect(listed,`#v-${v} is on a page but pages.js never routes to it`).toContain(v);
  const VIEWS=/van:\[([^\]]*)\][\s\S]*?scenes:\[([^\]]*)\]/.exec(root("src/pages.js"));
  const names=s=>[...s.matchAll(/"([a-z]+)"/g)].map(m=>m[1]);
  expect(names(VIEWS[1]).sort(),"pages.js and index.html disagree about the van").toEqual(van.sort());
  expect(names(VIEWS[2]).sort(),"pages.js and scenes.html disagree about the scene").toEqual(scenes.sort());
});

test("every control that navigates names a view that exists",async()=>{
  const all=new Set([...sections(root("index.html")),...sections(root("scenes.html"))]);
  const bad=[];
  for(const [f,text] of SRC){
    for(const m of text.matchAll(/data-(?:go|navback|v)="([a-z]+)"/g))
      if(!all.has(m[1]))bad.push(`${f}: data-…="${m[1]}"`);
    for(const m of text.matchAll(/\bgo\("([a-z]+)"\)/g))
      if(!all.has(m[1]))bad.push(`${f}: go("${m[1]}")`);
    for(const m of text.matchAll(/\bview="([a-z]+)"/g))
      if(!all.has(m[1]))bad.push(`${f}: view="${m[1]}"`);
  }
  expect([...new Set(bad)]).toEqual([]);
});

/* ---------- 6. both pages install ---------- */

for(const [file,man,start] of [["index.html","manifest.webmanifest","./index.html"],
  ["scenes.html","scenes.webmanifest","./scenes.html"]]){
  test(`${file} has a manifest whose start_url resolves`,async({page,request})=>{
    await open(page,"/"+file);
    const href=await page.getAttribute('link[rel="manifest"]',"href");
    expect(href).toBe(man);
    const m=await (await request.get("/"+man)).json();
    expect(m.start_url).toBe(start);
    const r=await request.get("/"+m.start_url.replace(/^\.\//,""));
    expect(r.ok(),`start_url ${m.start_url} does not resolve`).toBe(true);
    for(const i of m.icons)expect((await request.get("/"+i.src)).ok(),`icon ${i.src} missing`).toBe(true);
  });
}

test("the worker precaches both pages and both open with the network cut",async({page,context})=>{
  await open(page,VAN);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cached=await page.evaluate(async()=>{
    const c=await caches.open("fsu-v1");
    const has=async p=>!!await c.match(new URL(p,location.href).href);
    return {van:await has("index.html"), scenes:await has("scenes.html")};
  });
  expect(cached,"a page the app links to was never precached").toEqual({van:true,scenes:true});
  await context.setOffline(true);
  for(const [url,sel] of [[SCENES,"v-active"],[VAN,"v-home"]]){
    await page.goto(url);
    await page.waitForFunction(()=>typeof render==="function");
    expect(await page.evaluate(id=>!!document.getElementById(id),sel),
      `${url} did not come up offline`).toBe(true);
    expect(await page.evaluate(()=>location.pathname.split("/").pop()),
      `${url} fell back to the other page offline`).toBe(url.slice(1));
  }
  await context.setOffline(false);
});
