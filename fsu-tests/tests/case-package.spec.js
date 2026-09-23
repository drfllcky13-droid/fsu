// Importing a case package over records that are already on the device. A package made
// yesterday must not silently replace today's work: a record or photograph with the same id and
// different contents is listed, and nothing changes until the technician picks Keep mine, Use
// the package's, or Keep both. Closing the sheet keeps what is on the device.
const {test,expect}=require("@playwright/test");

const IMG_OLD="data:image/png;base64,T0xET0xET0xE";
const IMG_NEW="data:image/png;base64,TkVXTkVXTkVX";

async function openScenes(page){
  await page.goto("/scenes.html"); await page.evaluate(()=>localStorage.clear());
  await page.goto("/scenes.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-active"));
}
// an incident with a sketch and a photograph, packaged; then worked on further here
async function packagedThenEdited(page){
  return page.evaluate(async([oldImg,newImg])=>{
    const inc=newIncident(); inc.caseNo="26-0100"; inc.offence="Burglary";
    const sk={id:"sk"+newId(),incidentId:inc.id,caseNo:inc.caseNo,v:SKETCH_V,layers:[{id:"L1",name:"Layer 1"}],
      objs:[{id:"o1",t:"chair",x:10,y:10,w:20,h:20,r:0},{id:"o2",t:"photopoint",x:50,y:50,w:20,h:20,r:0,photoId:"p1"}]};
    S.sketches.push(sk); saveLocal();
    await photoPut("p1",{data:oldImg,w:10,hh:10});
    const text=JSON.stringify(await casePackage("all"));
    // later the same day, on this device
    inc.offence="Burglary, residential"; sk.objs[0].x=99; saveLocal();
    await photoPut("p1",{data:newImg,w:10,hh:10});
    return {text,inc:inc.id,sk:sk.id};
  },[IMG_OLD,IMG_NEW]);
}
const state=(page,ids)=>page.evaluate(async({inc,sk})=>({
  incs:S.incidents.filter(i=>i.caseNo==="26-0100").length,
  sks:S.sketches.filter(s=>s.caseNo==="26-0100").length,
  offence:(S.incidents.find(i=>i.id===inc)||{}).offence,
  x:((S.sketches.find(s=>s.id===sk)||{objs:[{}]}).objs[0]||{}).x,
  p1:((await photoGet("p1"))||{}).data,
  sheet:document.querySelector("#sheet.on")?document.querySelector("#sheetbody").textContent:""}),ids);

test("an older package over newer work keeps the work here unless told otherwise",async({page})=>{
  await openScenes(page);
  const ids=await packagedThenEdited(page);
  await page.evaluate(t=>importCasePackage(t),ids.text);
  await page.waitForSelector("#sheet.on",{timeout:5000}).catch(()=>{});
  const asked=await state(page,ids);
  expect(asked.sheet,"nobody was asked about the records that differ").toContain("26-0100");
  expect(asked.sheet).toContain("Photograph");
  // closing the sheet without choosing
  await page.evaluate(()=>closeSheet());
  const out=await state(page,ids);
  expect(out.offence,"the package's older incident replaced the one here").toBe("Burglary, residential");
  expect(out.x,"the package's older sketch replaced the one here").toBe(99);
  expect(out.p1,"the package's older photograph replaced the one here").toBe(IMG_NEW);
  expect(out.incs).toBe(1); expect(out.sks).toBe(1);
  // and "Keep mine" does the same
  await page.evaluate(t=>importCasePackage(t),ids.text);
  await page.click("#cpmine");
  const kept=await state(page,ids);
  expect([kept.offence,kept.x,kept.p1,kept.incs,kept.sks]).toEqual(["Burglary, residential",99,IMG_NEW,1,1]);
});

test("a package identical to what is here is taken in quietly",async({page})=>{
  await openScenes(page);
  const ids=await packagedThenEdited(page);
  const same=await page.evaluate(async()=>JSON.stringify(await casePackage("all")));
  await page.evaluate(t=>importCasePackage(t),same);
  const out=await state(page,ids);
  expect(out.sheet,"a sheet came up for records that are the same").toBe("");
  expect([out.incs,out.sks,out.x,out.p1]).toEqual([1,1,99,IMG_NEW]);
});

test("Keep both adds the package's version beside the one here, photographs included",async({page})=>{
  await openScenes(page);
  const ids=await packagedThenEdited(page);
  await page.evaluate(t=>importCasePackage(t),ids.text);
  await page.click("#cpboth");
  const out=await state(page,ids);
  expect(out.incs,"Keep both did not give two incidents").toBe(2);
  expect(out.sks,"Keep both did not give two sketches").toBe(2);
  expect([out.offence,out.x,out.p1],"the version here was changed").toEqual(["Burglary, residential",99,IMG_NEW]);
  const copy=await page.evaluate(async({inc,sk})=>{
    const ci=S.incidents.find(i=>i.caseNo==="26-0100"&&i.id!==inc), cs=S.sketches.find(s=>s.caseNo==="26-0100"&&s.id!==sk);
    const pid=cs.objs.find(o=>o.t==="photopoint").photoId;
    return {offence:ci.offence,x:cs.objs[0].x,linked:cs.incidentId===ci.id,pid,data:((await photoGet(pid))||{}).data}},ids);
  expect(copy.offence).toBe("Burglary");
  expect(copy.x).toBe(10);
  expect(copy.linked,"the copied sketch is not on the copied incident").toBe(true);
  expect(copy.pid).not.toBe("p1");
  expect(copy.data,"the copied sketch does not have the package's photograph").toBe(IMG_OLD);
});

test("Use the package's replaces the version here, photographs included",async({page})=>{
  await openScenes(page);
  const ids=await packagedThenEdited(page);
  await page.evaluate(t=>importCasePackage(t),ids.text);
  await page.click("#cptheirs");
  const out=await state(page,ids);
  expect([out.offence,out.x,out.p1,out.incs,out.sks]).toEqual(["Burglary",10,IMG_OLD,1,1]);
});
