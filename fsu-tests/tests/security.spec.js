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
async function open(page){
  await page.goto("/index.html");
  await page.evaluate(()=>localStorage.clear());
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
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
function escapes(name,plant){
  test(name,async({page})=>{
    const thrown=watch(page);
    await open(page);
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
});
escapes("a hostile form field label is text on the form being filled in",bad=>{
  const f={id:"secf",name:"Scene supplement",cat:"Scene",rev:"",fields:parseFields(bad),verified:""};
  S.forms=(S.forms||[]).filter(x=>x.id!=="secf").concat(f);
  S.fills=[]; const r=newFill(f);
  curFill=r.id; view="fill"; save(); render();
  return "#v-fill";
});
escapes("a hostile sketch label is text on the sketch",bad=>{
  S.sketches=[]; const sk=newSketch(); sk.caseNo=bad;
  curSketch=sk.id; addObj("marker");
  sk.objs[sk.objs.length-1].label=bad;
  view="sketch"; save(); render();
  return "#v-sketch";
});

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
  await open(page);
  await page.evaluate(arm);
  const found=await page.evaluate(async canary=>{
    const inc=newIncident(); inc.caseNo="26-004411";
    const sk=newSketch(); sk.incidentId=inc.id; sk.caseNo=inc.caseNo; curSketch=sk.id; addObj("refpoint");
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

test("the token is not on the settings screen, in text or in an attribute",async({page})=>{
  const thrown=watch(page);
  await open(page);
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
