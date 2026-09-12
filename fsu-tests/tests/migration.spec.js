// Data checks. Van data has no undo: if a load from an older store or a restore from a case
// package quietly drops records, a shift's work is gone. These load old shapes and read them
// back, and take a case package out and back in again.
const {test,expect}=require("@playwright/test");

async function open(page){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}
// the store reads van3, then vaninv2, then vaninv, so each old key still has to load
async function seedKey(page,key,payload){
  await page.goto("/index.html");
  await page.evaluate(([k,v])=>{localStorage.clear();localStorage.setItem(k,JSON.stringify(v))},[key,payload]);
  await open(page);
}
const OLD={
  items:[{id:"old1",name:"Hinge lifters",qty:"4",cat:"A",cls:"Consumable",loc:"1A1"},
         {id:"old2",name:"Pry bars",qty:"2",cat:"B",cls:"Durable"}],
  comps:[{id:"1A1",name:"Top drawer",bay:"1"}],
  locs:["1A1"], lastCat:"A", lastCls:"Consumable", curLoc:""
};

for(const key of ["van3","vaninv2","vaninv"]){
  test(`a record saved under ${key} still loads`,async({page})=>{
    await seedKey(page,key,OLD);
    const r=await page.evaluate(()=>({items:S.items.length, named:!!S.items.find(i=>i.name==="Hinge lifters"),
      comp:!!S.comps.find(c=>c.id==="1A1"), placed:(S.items.find(i=>i.id==="old1")||{}).loc}));
    expect(r.named&&r.comp).toBe(true);
    expect(r.items).toBeGreaterThanOrEqual(2);
    expect(r.placed).toBe("1A1");
  });
}

test("an old record gains this version's stock forms without losing its own",async({page})=>{
  await seedKey(page,"van3",Object.assign({},OLD,{formsSeeded:1,
    forms:[{id:"mine",name:"Unit supplement 12B",cat:"Scene",fields:[],verified:""}]}));
  const r=await page.evaluate(()=>({seeded:S.formsSeeded, stock:S.forms.filter(f=>f.stock).length,
    mine:!!S.forms.find(f=>f.id==="mine"), items:S.items.length}));
  expect(r.mine,"the unit's own form was dropped by the seeding").toBe(true);
  expect(r.stock).toBeGreaterThan(0);
  expect(r.seeded).toBe(await page.evaluate(()=>STOCKV));
  expect(r.items).toBeGreaterThanOrEqual(2);
});

test("a saved record survives a reload unchanged",async({page})=>{
  await seedKey(page,"van3",OLD);
  const before=await page.evaluate(()=>{save();return JSON.stringify({i:S.items.length,c:S.comps.length})});
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function");
  const after=await page.evaluate(()=>JSON.stringify({i:S.items.length,c:S.comps.length}));
  expect(after).toBe(before);
});

test("a case package goes out and comes back whole",async({page})=>{
  await open(page);
  await page.evaluate(()=>{localStorage.removeItem("van3")});
  await open(page);
  const made=await page.evaluate(async()=>{
    const inc=newIncident(); curInc=inc.id; inc.caseNo="26-001234";
    const sk=newSketch(); sk.incidentId=inc.id; sk.caseNo=inc.caseNo;
    curSketch=sk.id; addObj("refpoint"); saveLocal();
    const pkg=await casePackage({incidentId:inc.id});
    return {pkg:JSON.stringify(pkg), inc:inc.id, sk:sk.id, objs:sk.objs.length};
  });
  expect(made.objs).toBeGreaterThan(0);
  // wipe both records, then restore from the package the way a rebuilt iPad would
  const back=await page.evaluate(async({pkg,inc,sk})=>{
    S.incidents=(S.incidents||[]).filter(x=>x.id!==inc);
    S.sketches=(S.sketches||[]).filter(x=>x.id!==sk);
    saveLocal();
    await importCasePackage(pkg);
    const i=(S.incidents||[]).find(x=>x.id===inc), k=(S.sketches||[]).find(x=>x.id===sk);
    return {inc:!!i, caseNo:i&&i.caseNo, sk:!!k, objs:k?k.objs.length:0};
  },made);
  expect(back).toEqual({inc:true,caseNo:"26-001234",sk:true,objs:made.objs});
});
