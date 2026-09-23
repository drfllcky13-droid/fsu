// Two guarantees. First, free text a user types is text: nothing a name contains can run, and
// what goes in comes back out character for character — an apostrophe mangled on an evidence
// label is the failure this is really guarding. Second, the GitHub token never leaves the device
// in a file, which is what the README promises the unit.
const {test,expect}=require("@playwright/test");

// script tags and an attribute break-out, then the ordinary punctuation that actually bites:
// an apostrophe, an ampersand, a backslash, quotes, emoji, and an RTL mark
const BAD=[
  "<script>window.__ran=1<\/script>",
  "<img src=x onerror=\"window.__ran=1\">",
  "\" onfocus=\"window.__ran=1\" autofocus=\"x",
  "O'Brien & Sons <Unit 3> \"north\" C:\\evidence\\1",
  "Dr\u00e4ger \u202Bmarker\u202C \ud83e\uddea\ud83d\udd2c",
  "&lt;already escaped&gt; &amp; &#39; &quot;"
];
const CANARY="tok-canary-do-not-ship";

// anything thrown in the page, and any dialog, is a failure of the test that was running
function watch(page){
  const seen=[];
  page.on("pageerror",e=>seen.push("threw: "+e.message));
  page.on("dialog",d=>{seen.push("dialog: "+d.message);d.dismiss().catch(()=>{})});
  return seen;
}
// a field is checked on the page that shows it: the van for items and compartments,
// the scene for incidents, forms and sketches
async function open(page,where){
  const url=where==="scenes"?"/scenes.html":"/index.html";
  const first=where==="scenes"?"#v-active":"#v-home";
  await page.goto(url);
  await page.evaluate(()=>localStorage.clear());
  await page.goto(url);
  await page.waitForFunction(sel=>typeof render==="function"&&document.querySelector(sel),first);
}
// plant one hostile string, render, and report what the DOM gives back.
// the pause lets an injected handler fire: an onerror would run a tick after the innerHTML lands
async function roundTrip(page,plant,bad){
  const sel=await page.evaluate(plant,bad);
  await page.waitForTimeout(40);
  return page.evaluate(s=>{
    const el=document.querySelector(s); if(!el)return {text:null};
    // a payload that got parsed as markup rather than shown as text leaves traces even if
    // nothing has fired yet: a script element, or the flag name sitting in a real attribute
    const live=[...el.querySelectorAll("script")].map(()=>"script")
      .concat([...el.querySelectorAll("*")].flatMap(e=>
        [...e.attributes].filter(a=>a.value.includes("__ran")).map(a=>e.tagName+"["+a.name+"]")));
    return {text:el.textContent, live, ran:!!window.__ran};
  },sel);
}
// every payload through one field, checked the same way each time
function escapes(name,plant,where){
  test(name,async({page})=>{
    const thrown=watch(page);
    await open(page,where);
    for(const bad of BAD){
      const r=await roundTrip(page,plant,bad);
      expect(r.text,"the view rendered nothing for: "+bad).not.toBe(null);
      expect(r.ran,"a payload executed: "+bad).toBe(false);
      expect(r.text,"not returned character for character: "+bad).toContain(bad);
      expect(r.live,"parsed as markup: "+bad).toEqual([]);
    }
    expect(thrown).toEqual([]);
  });
}

escapes("a hostile item name is text on the item screen",bad=>{
  S.items=[{id:"sec1",name:bad,qty:"2",cat:"A",cls:"Consumable",loc:S.comps[0].code,par:"1"}];
  curItem="sec1"; prevView="inventory"; view="itemdetail"; save(); render();
  return "#v-itemdetail";
});
escapes("a hostile item name is text on a printed label",bad=>{
  S.items=[{id:"sec1",name:bad,qty:"2",cat:"A",cls:"Consumable",loc:S.comps[0].code}];
  S.labelKind="items"; S.labelBay="all"; view="labels"; save(); render();
  return "#v-labels";
});
escapes("a hostile compartment name is text on the compartment screen",bad=>{
  S.comps[0].desc=bad; curComp=S.comps[0].code; prevView="compartments"; view="compdetail"; save(); render();
  return "#v-compdetail";
});
escapes("a hostile compartment name is text on a printed label",bad=>{
  S.comps[0].desc=bad; S.labelKind="comps"; S.labelBay="all"; view="labels"; save(); render();
  return "#v-labels";
});
escapes("a hostile case number is text on the incident screen",bad=>{
  S.incidents=[]; const inc=newIncident(); inc.caseNo=bad;
  curInc=inc.id; view="incident"; save(); render();
  return "#v-incident";
},"scenes");
escapes("a hostile form field label is text on the form being filled in",bad=>{
  const f={id:"secf",name:"Scene supplement",cat:"Scene",rev:"",fields:parseFields(bad),verified:""};
  S.forms=(S.forms||[]).filter(x=>x.id!=="secf").concat(f);
  S.fills=[]; const r=newFill(f);
  curFill=r.id; view="fill"; save(); render();
  return "#v-fill";
},"scenes");
escapes("a hostile sketch label is text on the sketch",bad=>{
  S.sketches=[]; const sk={id:"sk"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      objs:[],layers:[],when:new Date().toISOString(),v:4};
    (S.sketches=S.sketches||[]).push(sk); sk.caseNo=bad;
  curSketch=sk.id; addObj("marker");
  sk.objs[sk.objs.length-1].label=bad;
  view="sketch"; save(); render();
  return "#v-sketch";
},"scenes");

/* ---- the token ---- */
// stand in for every way a file leaves the app, so anything written out lands in one list
function arm(){
  window.__cap=[];
  const grab=p=>{ if(typeof p==="string")window.__cap.push(p) };
  const B=window.Blob, F=window.File;
  window.Blob=function(parts,o){ (parts||[]).forEach(grab); return new B(parts,o) };
  window.File=function(parts,n,o){ (parts||[]).forEach(grab); return new F(parts,n,o) };
  window.download=t=>{ grab(String(t)); return true };
  window.dlBlob=()=>{};
  navigator.canShare=()=>false;              // force the download path, not the share sheet
  S.gh={owner:"unit",repo:"van-data",path:"data.json",
    token:"tok-canary-do-not-ship",sha:"abc",last:"2026-09-12T08:00:00.000Z"};
  S.ghOwner="unit"; S.ghRepo="van-data"; S.ghExp="2027-01-01";
  S.fills=S.fills||[]; S.incidents=S.incidents||[]; S.sketches=S.sketches||[];
  saveLocal();
}

test("the token is in no file the app writes out",async({page})=>{
  const thrown=watch(page);
  await open(page,"scenes");
  await page.evaluate(arm);
  const found=await page.evaluate(async canary=>{
    const inc=newIncident(); inc.caseNo="26-004411";
    const sk={id:"sk"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      objs:[],layers:[],when:new Date().toISOString(),v:4};
    (S.sketches=S.sketches||[]).push(sk); sk.incidentId=inc.id; sk.caseNo=inc.caseNo; curSketch=sk.id; addObj("refpoint");
    const r=newFill(S.forms[0]); r.incidentId=inc.id;
    saveLocal();
    window.__cap.push(JSON.stringify(await casePackage({incidentId:inc.id})));
    window.__cap.push(JSON.stringify(await casePackage("all")));
    await exportCasePackage({incidentId:inc.id},inc.caseNo);
    await exportCasePackage("all","everything");
    await backupOut();                       // the JSON backup the README is talking about
    download(toCSV(),"van.csv","text/csv");
    return {n:window.__cap.length, leaks:window.__cap.filter(t=>t.includes(canary))};
  },CANARY);
  expect(found.n,"nothing was captured — the export paths have moved").toBeGreaterThan(4);
  expect(found.leaks.length,"the token is in "+found.leaks.length+" of "+found.n+" exported files").toBe(0);
  expect(thrown).toEqual([]);
});

test("a backup carries van data only, never case material",async({page})=>{
  const thrown=watch(page);
  await open(page);
  await page.evaluate(arm);
  const out=await page.evaluate(async()=>{
    const CASE="26-004411";
    const inc=newIncident(); inc.caseNo=CASE; inc.offence="Burglary"; inc.addr="412 Elm Street";
    S.fills.push({id:"f1",incidentId:inc.id,values:{a:CASE}});
    S.sketches.push({id:"sk1",caseNo:CASE,objs:[]});
    S.activity=[{t:"x",who:"DA",k:"export",m:"Exported "+CASE}];
    S.handovers=[{t:"x",text:"Scene at "+CASE+" still open"}];
    S.sktpl=[{id:"t1",name:"From "+CASE,objs:[{t:"text",label:CASE}]}];
    S.errors=[{t:"x",m:"failed on "+CASE}];
    S.conflicts=[{k:"items",key:"a",name:CASE,rec:{id:"a",name:CASE}}];
    S.forms[0].fills=[{values:{a:CASE}}];          // an old build kept fills inside the form
    saveLocal(); window.__cap=[];
    await backupOut();
    const text=window.__cap.find(t=>t.trim()[0]==="{"&&t.includes('"items"'));
    const o=JSON.parse(text);
    return {keys:Object.keys(o).sort(),hasCase:text.includes(CASE),items:o.items.length===S.items.length,
      comps:o.comps.length===S.comps.length,forms:o.forms.length===S.forms.length};
  });
  for(const k of ["incidents","activity","handovers","sktpl","errors","conflicts","fills","sketches",
      "gh","ghOwner","ghRepo","ghExp","base","tomb","dev","who","whoName"])
    expect(out.keys,"the backup carries "+k).not.toContain(k);
  expect(out.hasCase,"case material is in the backup").toBe(false);
  expect(out.items&&out.comps&&out.forms,"the van data is not all there").toBe(true);
  expect(thrown).toEqual([]);
});

test("the token is not on the settings screen, in text or in an attribute",async({page})=>{
  const thrown=watch(page);
  await open(page);   // Settings lives with the van
  await page.evaluate(arm);
  const hits=await page.evaluate(canary=>{
    const out=[];
    for(const sec of [null,"sync","backup","restore","device"]){
      SET_SEC=sec; view="data"; render();
      const root=document.querySelector("#v-data");
      if(root.textContent.includes(canary))out.push((sec||"top")+": text");
      root.querySelectorAll("*").forEach(el=>{
        for(const a of el.attributes)if(String(a.value).includes(canary))out.push((sec||"top")+": "+el.tagName+"["+a.name+"]");
        if(el.value&&String(el.value).includes(canary))out.push((sec||"top")+": "+el.tagName+" value");
      });
    }
    return out;
  },CANARY);
  expect(hits).toEqual([]);
  expect(thrown).toEqual([]);
});

/* ---- data from outside the device ----
   A synced file, a restored backup and a case package are written somewhere else. What is in
   them lands in markup: ids in attributes, geometry in style, images in src, links in href.
   Each carries a script in an id, a URL and a geometry field; nothing may run, the good records
   must still arrive, and what was turned away or repaired is listed under Recent errors. */
const RUN="window.__ran=(window.__ran||0)+1";
const XID='x"><img src=x onerror="'+RUN+'">';
const XURL="javascript:"+RUN;
const XGEO='2"><img src=x onerror="'+RUN+'"><b x="';
const hostileVan=()=>({v:2,lam:5,
  items:[{id:"good1",name:"Gloves",qty:1,cat:"A",cls:"Consumable",loc:"1Z1",uses:[],rel:[],links:[]},
    {id:XID,name:"Bad id",qty:1,cat:"A",cls:"Consumable",loc:"1Z1",uses:[],rel:[],links:[]},
    {id:"linky",name:"Manual",qty:1,cat:"A",cls:"Durable",loc:"1Z2",uses:[],rel:[],
      links:[{label:"Manual",url:XURL},{label:"Real",url:"https://example.com/m.pdf"}],cert:XURL}],
  comps:[{code:"1Z1",desc:"Good",side:"Driver side",x:0,y:0,w:2,h:2},
    {code:"1Z2",desc:"Bad size",side:"Driver side",x:2,y:0,w:XGEO,h:2}],
  forms:[],walls:{"Driver side":{cols:24,rows:12},"Passenger side":{cols:24,rows:12},"Rear doors":{cols:24,rows:12}}});
// draw every van view with the hostile records as the current ones, then let handlers fire
async function drawVan(page){
  await page.evaluate(()=>{
    curItem="linky"; curComp="1Z2"; curBay="1";
    for(const v of VIEWS.van){ try{ view=v; render() }catch(e){} }
  });
  await page.waitForTimeout(80);
}
const outcome=page=>page.evaluate(()=>({ran:window.__ran||0,
  injected:document.querySelectorAll('img[src="x"]').length,
  errors:(S.errors||[]).map(e=>e.m).join(" | ")}));

test("a synced file carrying scripts runs nothing, and its good records still arrive",async({page})=>{
  const thrown=watch(page);
  const file=hostileVan();
  await page.route(/api\.github\.com\/repos\//,r=>r.request().method()==="GET"
    ?r.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({sha:"s1",content:Buffer.from(JSON.stringify(file)).toString("base64"),encoding:"base64"})})
    :r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({content:{sha:"s2"}})}));
  await open(page);
  await page.evaluate(async()=>{
    S.gh={owner:"unit",repo:"van-data",path:"data.json",token:"t",sha:"",last:""};
    S.items=[]; S.comps=[]; saveLocal(); await ghPull(true)});
  await drawVan(page);
  const out=await outcome(page), got=await page.evaluate(()=>{const l=S.items.find(i=>i.id==="linky");
    return {ids:S.items.map(i=>i.id).sort(),links:(l.links||[]).map(x=>x.url),cert:l.cert||"",
      w:(S.comps.find(c=>c.code==="1Z2")||{}).w,
      hrefs:[...document.querySelectorAll("a[href]")].map(a=>a.getAttribute("href")).filter(h=>/^javascript:/i.test(h))}});
  expect(out.ran,"a script from the synced file ran").toBe(0);
  expect(out.injected,"markup from the synced file got into the page").toBe(0);
  expect(got.ids,"the good records did not all arrive, or the bad id got in").toEqual(["good1","linky"]);
  expect(got.links).toEqual(["https://example.com/m.pdf"]);
  expect(got.cert).toBe("");
  expect(typeof got.w).toBe("number");
  expect(got.hrefs).toEqual([]);
  expect(out.errors,"nothing was noted under Recent errors").toMatch(/repo/i);
  expect(thrown).toEqual([]);
});

test("a restored backup carrying scripts runs nothing, and its good records still arrive",async({page})=>{
  const thrown=watch(page);
  await open(page);
  await page.evaluate(t=>{
    SET_SEC="restore"; view="data"; renderData();
    document.querySelector("#imp").value=t;
    document.querySelector("#imprep").click();
    document.querySelector("#cfyes").click();
  },JSON.stringify(hostileVan()));
  await drawVan(page);
  const out=await outcome(page), got=await page.evaluate(()=>{const l=S.items.find(i=>i.id==="linky")||{};
    return {ids:S.items.map(i=>i.id).sort(),links:(l.links||[]).map(x=>x.url),cert:l.cert||"",
      w:(S.comps.find(c=>c.code==="1Z2")||{}).w}});
  expect(out.ran,"a script from the backup ran").toBe(0);
  expect(out.injected,"markup from the backup got into the page").toBe(0);
  expect(got.ids).toEqual(["good1","linky"]);
  expect(got.links).toEqual(["https://example.com/m.pdf"]);
  expect(got.cert).toBe("");
  expect(typeof got.w).toBe("number");
  expect(out.errors,"nothing was noted under Recent errors").toMatch(/backup/i);
  expect(thrown).toEqual([]);
});

test("an imported case package carrying scripts runs nothing, and its good records still arrive",async({page})=>{
  const thrown=watch(page);
  await open(page,"scenes");
  const pkg={fsuCase:1,version:"x",exported:"2026-09-24T10:00:00Z",
    incidents:[{id:"inc1",caseNo:"26-0001",offence:"Burglary",plan:[]},{id:XID,caseNo:"26-0002",plan:[]}],
    fills:[{id:XID,incidentId:"inc1",formId:"any",values:{}}],
    sketches:[{id:"sk1",incidentId:"inc1",caseNo:"26-0001",v:4,layers:[{id:"L1",name:"Layer 1"}],
      bg:{data:XURL,x:XGEO,y:0,w:100,h:100,op:XGEO},
      objs:[{id:XID,t:"chair",x:10,y:10,w:20,h:20,r:0},
            {id:"o2",t:"chair",x:XGEO,y:10,w:20,h:20,r:0},
            {id:"o3",t:"photopt",x:40,y:40,w:20,h:20,r:0,photoId:"p1"}]}],
    photos:{p1:{data:'x" onerror="'+RUN+'" y="',w:XGEO,hh:1},
            p2:{data:"data:image/png;base64,iVBORw0KGgo=",w:1,hh:1}},
    forms:[]};
  await page.evaluate(async t=>{ await importCasePackage(t) },JSON.stringify(pkg));
  await page.evaluate(async()=>{
    curInc="inc1"; view="incident"; render();
    curSketch="sk1"; view="sketch"; render();
    const sk=S.sketches.find(s=>s.id==="sk1"), o=sk&&sk.objs.find(o=>o.photoId==="p1");
    if(o)photoSheet(o);
  });
  await page.waitForTimeout(150);
  const out=await outcome(page), got=await page.evaluate(async()=>{
    const sk=S.sketches.find(s=>s.id==="sk1")||{objs:[]};
    return {incs:S.incidents.map(i=>i.id).sort(),fills:S.fills.length,sketch:!!sk.id,
      objIds:sk.objs.map(o=>o.id).filter(id=>!/^[\w-]{1,64}$/.test(id)),
      xs:sk.objs.map(o=>typeof o.x),bg:JSON.stringify(sk.bg||null),
      p1:!!(await photoGet("p1").catch(()=>null)),p2:!!(await photoGet("p2").catch(()=>null))}});
  expect(out.ran,"a script from the case package ran").toBe(0);
  expect(out.injected,"markup from the case package got into the page").toBe(0);
  expect(got.incs,"the good incident did not arrive, or the bad id got in").toEqual(["inc1"]);
  expect(got.fills).toBe(0);
  expect(got.sketch).toBe(true);
  expect(got.objIds,"an object kept an unsafe id").toEqual([]);
  expect(got.xs).toEqual(["number","number","number"]);
  expect(got.bg).not.toContain("javascript");
  expect(got.p1,"a photograph that is not an image was stored").toBe(false);
  expect(got.p2,"a good photograph was turned away").toBe(true);
  expect(out.errors,"nothing was noted under Recent errors").toMatch(/case package/i);
  expect(thrown).toEqual([]);
});
