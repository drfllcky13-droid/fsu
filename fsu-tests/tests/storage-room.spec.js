// Room in the app's record. localStorage holds incidents, forms and sketches under a ceiling of
// about 5 MB; at 70% Home and Scenes say so. Settings › This device shows a meter and removes
// closed cases that are already in a saved case package, but only those: a case that is open,
// has no package, was packaged only in part, or has changed since its package, stays.
const {test,expect}=require("@playwright/test");

async function openPage(page,url,sel){
  await page.goto(url); await page.evaluate(()=>localStorage.clear());
  await page.goto(url); await page.waitForFunction(s=>typeof render==="function"&&document.querySelector(s),sel);
  await page.waitForFunction(()=>storageState.asked);
}
// fill localStorage to a share of the ceiling with a key of its own
const fillTo=(page,share)=>page.evaluate(k=>{
  localStorage.removeItem("zz-fill");
  const need=Math.round(LS_CEIL*k)-lsBytes()-"zz-fill".length;
  localStorage.setItem("zz-fill","x".repeat(Math.max(0,need)));
  return lsShare()},share);

test("below 70% nothing is said; at 70% Home and Scenes say so and the meter shows it",async({page})=>{
  await openPage(page,"/index.html","#v-home");
  expect(await fillTo(page,0.6)).toBeLessThan(0.7);
  let home=await page.evaluate(()=>{go("home");return document.querySelector("#v-home").textContent});
  expect(home).not.toContain("% full");
  expect(await fillTo(page,0.72)).toBeGreaterThanOrEqual(0.7);
  home=await page.evaluate(()=>{go("home");return document.querySelector("#v-home").textContent});
  expect(home,"Home did not warn at 72%").toMatch(/Storage is 7\d% full/);
  await page.click('#v-home [data-gosec="device"]');
  const meter=await page.evaluate(()=>{const m=document.querySelector("#v-data .meter");
    return {pct:m&&+m.getAttribute("aria-valuenow"),warn:m&&m.classList.contains("warn"),btn:!!document.querySelector("#storefree")}});
  expect(meter.pct).toBeGreaterThanOrEqual(70);
  expect(meter.warn).toBe(true);
  expect(meter.btn).toBe(true);
  // Scenes, same record
  await page.goto("/scenes.html"); await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-active"));
  const sc=await page.evaluate(()=>{render();return (document.querySelector("#v-active .storewarn")||{}).textContent||""});
  expect(sc,"Scenes did not warn at 72%").toMatch(/Storage is 7\d% full/);
  await page.evaluate(()=>localStorage.removeItem("zz-fill"));
  const after=await page.evaluate(()=>{render();return !!document.querySelector("#v-active .storewarn")});
  expect(after).toBe(false);
});

// five closed-or-open cases, each with a form and a sketch with a photograph, then packaged or not
async function fiveCases(page){
  return page.evaluate(async()=>{
    navigator.canShare=()=>false; window.dlBlob=()=>{};
    const IMG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const mk=async(caseNo,sketches)=>{
      const inc=newIncident(); inc.caseNo=caseNo; inc.offence="Burglary";
      S.fills.push({id:"f"+newId(),incidentId:inc.id,formId:"x",values:{a:caseNo}});
      const sks=[];
      for(let i=0;i<sketches;i++){const pid="p"+newId();
        const sk={id:"sk"+newId(),incidentId:inc.id,caseNo,v:SKETCH_V,layers:[{id:"L1",name:"Layer 1"}],
          objs:[{id:"o"+newId(),t:"photopoint",x:5,y:5,w:20,h:20,r:0,photoId:pid}]};
        S.sketches.push(sk); sks.push(sk); await photoPut(pid,{data:IMG,w:1,hh:1});
        localStorage.setItem("fsu-undo-"+sk.id,"[[1]]")}
      saveLocal(); return {inc,sks};
    };
    const close=inc=>{inc.closed=new Date().toISOString();saveLocal()};
    const A=await mk("A-packaged",1); close(A.inc); await exportCasePackage({incidentId:A.inc.id},"a");
    const B=await mk("B-changed",1); close(B.inc); await exportCasePackage({incidentId:B.inc.id},"b");
    S.fills.find(f=>f.incidentId===B.inc.id).values.a="edited after the package"; saveLocal();
    const C=await mk("C-never",1); close(C.inc);
    const D=await mk("D-open",1); await exportCasePackage({incidentId:D.inc.id},"d");
    const E=await mk("E-part",2); close(E.inc); await exportCasePackage({sketchId:E.sks[0].id},"e");
    return {A:A.inc.id,B:B.inc.id,C:C.inc.id,D:D.inc.id,E:E.inc.id,
      aSk:A.sks[0].id,aPhoto:A.sks[0].objs[0].photoId};
  });
}
const cases=page=>page.evaluate(()=>S.incidents.map(i=>i.caseNo).sort());

test("only a closed case, fully packaged and unchanged since, is offered for removal",async({page})=>{
  await openPage(page,"/scenes.html","#v-active");
  const ids=await fiveCases(page);
  await page.evaluate(()=>{SET_SEC="device";view="data";render()});
  await page.click("#storefree");
  await page.waitForSelector("#sheet.on");
  const sheet=await page.evaluate(()=>({
    go:[...document.querySelectorAll("#sheet .storego li b")].map(b=>b.textContent),
    stay:[...document.querySelectorAll("#sheet .storestay li")].map(l=>l.textContent),
    frees:(document.querySelector("#storefrees")||{}).textContent||""}));
  expect(sheet.go,"the wrong cases were offered").toEqual(["A-packaged · Burglary"]);
  expect(sheet.stay.join(" | ")).toContain("B-changed · Burglary: changed since its case package was saved");
  expect(sheet.stay.join(" | ")).toContain("C-never · Burglary: no case package has been saved");
  expect(sheet.stay.join(" | ")).toContain("E-part · Burglary: no case package has been saved");
  expect(sheet.stay.join(" | "),"an open case was listed").not.toContain("D-open");
  expect(sheet.frees).toMatch(/Frees \d+ KB of the app's record/);
  // Cancel removes nothing
  await page.click("#cfno");
  expect(await cases(page)).toEqual(["A-packaged","B-changed","C-never","D-open","E-part"]);
});

test("removing takes the case's incident, forms, sketches, photographs and undo history, and nothing else",async({page})=>{
  await openPage(page,"/scenes.html","#v-active");
  const ids=await fiveCases(page);
  await page.evaluate(()=>{SET_SEC="device";view="data";render()});
  await page.click("#storefree");
  await page.waitForSelector("#sheet.on");
  await page.click("#cfyes");
  await page.waitForFunction(()=>!S.incidents.some(i=>i.caseNo==="A-packaged"));
  const out=await page.evaluate(async id=>({
    fills:S.fills.filter(f=>f.incidentId===id.A).length, sks:S.sketches.filter(s=>s.incidentId===id.A).length,
    photo:!!(await photoGet(id.aPhoto)), undo:localStorage.getItem("fsu-undo-"+id.aSk),
    others:["B","C","D","E"].map(k=>S.fills.some(f=>f.incidentId===id[k])&&S.sketches.some(s=>s.incidentId===id[k]))}),ids);
  expect(await cases(page)).toEqual(["B-changed","C-never","D-open","E-part"]);
  expect([out.fills,out.sks,out.photo,out.undo]).toEqual([0,0,false,null]);
  expect(out.others,"another case lost its forms or sketches").toEqual([true,true,true,true]);
});

test("a case changed while the sheet is open is not removed",async({page})=>{
  await openPage(page,"/scenes.html","#v-active");
  const ids=await fiveCases(page);
  await page.evaluate(()=>{SET_SEC="device";view="data";render()});
  await page.click("#storefree");
  await page.waitForSelector("#sheet.on");
  await page.evaluate(id=>{S.sketches.find(s=>s.incidentId===id).objs[0].x=77; saveLocal()},ids.A);
  await page.click("#cfyes");
  await page.waitForTimeout(500);
  expect(await cases(page)).toContain("A-packaged");
});
