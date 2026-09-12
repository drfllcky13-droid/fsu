// The delete paths, which nothing else exercises: the click crawl names them rather than
// pressing them, on purpose. Each one has to take exactly what it says and leave the rest
// standing — an incident delete that took another incident's sketches would be the worst
// bug this app could have, and it would be invisible until the case file was needed.
const {test,expect}=require("@playwright/test");

async function open(page){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}
// two incidents, each with its own sketch and filled form, so a delete has a neighbour to spare
const seed=page=>page.evaluate(()=>{
  const mk=n=>{
    const inc=newIncident(); inc.caseNo="26-00"+n;
    const sk=newSketch(); sk.incidentId=inc.id; sk.caseNo=inc.caseNo;
    sk.objs=[{id:"o"+n,t:"chair",x:10,y:10,w:20,h:20}];
    S.fills=S.fills||[]; S.fills.push({id:"f"+n,incidentId:inc.id,formId:"any",values:{}});
    return {inc:inc.id,sk:sk.id,fill:"f"+n};
  };
  const a=mk(1), b=mk(2);
  save();
  return {a,b};
});
// the confirm sheet's own button, so the test goes the way a person does
async function confirmSheet(page){
  await page.waitForSelector("#sheet.on");
  await page.click("#cfyes");
}

test("deleting an incident takes its own material and nobody else's",async({page})=>{
  await open(page);
  const {a,b}=await seed(page);
  await page.evaluate(id=>{curInc=id;view="incident";
    document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-incident"));render();
    document.querySelector("[data-incdel]").click()},a.inc);
  await confirmSheet(page);
  const left=await page.evaluate(()=>({
    incs:(S.incidents||[]).map(i=>i.id), sks:(S.sketches||[]).map(s=>s.id), fills:(S.fills||[]).map(f=>f.id)}));
  expect(left.incs).toEqual([b.inc]);
  expect(left.sks).toEqual([b.sk]);
  expect(left.fills).toEqual([b.fill]);
});

test("deleting a sketch leaves the incident and the other sketch alone",async({page})=>{
  await open(page);
  const {a,b}=await seed(page);
  await page.evaluate(ids=>{curInc=ids.a.inc;curSketch=ids.a.sk;view="sketch";
    document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-sketch"));render();
    document.querySelector("[data-skdel]").click()},{a,b});
  await confirmSheet(page);
  const left=await page.evaluate(()=>({incs:(S.incidents||[]).length,sks:(S.sketches||[]).map(s=>s.id)}));
  expect(left.sks).toEqual([b.sk]);
  expect(left.incs).toBe(2);
});

test("deleting an item takes one row and no compartment",async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>{
    const i=S.items.find(x=>x.loc)||S.items[0];
    curItem=i.id;view="itemdetail";
    document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-itemdetail"));render();
    document.querySelector("[data-edititem]").click();
    return {id:i.id,items:S.items.length,comps:S.comps.length,loc:i.loc};
  });
  await page.waitForSelector("#sheet.on");
  await page.click("#idel");
  await confirmSheet(page);
  const after=await page.evaluate(()=>({items:S.items.length,comps:S.comps.length,ids:S.items.map(i=>i.id)}));
  expect(after.items).toBe(before.items-1);
  expect(after.comps).toBe(before.comps);
  expect(after.ids).not.toContain(before.id);
});

test("deleting a compartment keeps the items that were in it",async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>{
    const c=S.comps.find(x=>S.items.some(i=>i.loc===x.code))||S.comps[0];
    curComp=c.code;view="compdetail";
    document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-compdetail"));render();
    document.querySelector("[data-editcomp]").click();
    return {code:c.code,comps:S.comps.length,items:S.items.length,
      held:S.items.filter(i=>i.loc===c.code).map(i=>i.id)};
  });
  await page.waitForSelector("#sheet.on");
  await page.click("#cdel");
  await confirmSheet(page);
  const after=await page.evaluate(ids=>({comps:S.comps.length,items:S.items.length,
    stillThere:ids.every(id=>S.items.some(i=>i.id===id))}),before.held);
  expect(after.comps).toBe(before.comps-1);
  expect(after.items,"deleting a compartment took the items inside it").toBe(before.items);
  expect(after.stillThere).toBe(true);
});

test("clearing the sample van keeps anything added by hand",async({page})=>{
  await open(page);
  const before=await page.evaluate(()=>{
    loadDemo(); save();
    S.items.push({id:"mine",name:"My own item",qty:"1",cat:"A",cls:"Consumable"});
    S.comps.push({code:"ZZ9",desc:"My own compartment",side:"",x:null,y:null,w:6,h:4});
    save();
    // Clear sample data lives inside the Reset section of Settings, so open that first
    view="data";document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-data"));render();
    const link=document.querySelector("[data-setsec=reset]"); if(link)link.click();
    const b=document.querySelector("#cleardemo2");
    if(b)b.click();
    return {demo:!!S.demo,found:!!b,link:!!link};
  });
  expect(before.link,"the Reset section was not offered while sample data was loaded").toBe(true);
  expect(before.found,"no way to clear the sample van was on screen").toBe(true);
  if(await page.locator("#sheet.on").count())await confirmSheet(page);
  const after=await page.evaluate(()=>({mine:!!S.items.find(i=>i.id==="mine"),
    myComp:!!S.comps.find(c=>c.code==="ZZ9"),demo:!!S.demo}));
  expect(after.mine,"the unit's own item went with the sample data").toBe(true);
  expect(after.myComp,"the unit's own compartment went with the sample data").toBe(true);
});
