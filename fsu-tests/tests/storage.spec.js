// Storage checks. A van iPad fills up: photographs, sketches, months of sweeps. When the
// browser refuses a write the app has to say so loudly rather than quietly drop the scene
// being documented, and it has to keep working in memory until there is room again.
const {test,expect}=require("@playwright/test");

async function open(page){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}

// localStorage is a few megabytes; filling it is the only honest way to reach the failure
// big chunks first, then smaller ones, so the headroom left over is too small for the
// app's own record and the next real save is the one that gets refused
const FILL=`(()=>{
  let n=0;
  for(const size of [512*1024,64*1024,8*1024,512]){
    const chunk="x".repeat(size);
    try{ for(let i=0;i<600;i++){localStorage.setItem("__fill"+(n++),chunk)} }catch(e){}
  }
  return n;
})()`;
const EMPTY=`(()=>{for(const k of Object.keys(localStorage))if(k.startsWith("__fill"))localStorage.removeItem(k);return true})()`;

test("a refused write raises the bar and nothing is lost from the screen",async({page})=>{
  await open(page);
  const filled=await page.evaluate(FILL);
  expect(filled,"localStorage never filled up, so nothing was proved").toBeGreaterThan(0);
  const r=await page.evaluate(()=>{
    const before=S.items.length;
    // a photograph or a long sketch is what actually tips it over: overwriting the record
    // with one a shade bigger would still fit in the gap left behind by the old one
    S.items.push({id:"quotacheck",name:"Quota check",qty:"1",cat:"A",cls:"Consumable",note:"p".repeat(600*1024)});
    save();
    return {bar:!!document.getElementById("savefail"), items:S.items.length, grew:S.items.length===before+1,
      stillThere:!!S.items.find(i=>i.id==="quotacheck")};
  });
  expect(r.bar,"no warning bar when the write was refused").toBe(true);
  expect(r.grew&&r.stillThere,"the entry vanished from the running app").toBe(true);
  const text=await page.textContent("#savefail");
  expect(text).toContain("not being saved");
  await page.evaluate(EMPTY);
});

test("the bar clears once there is room again",async({page})=>{
  await open(page);
  await page.evaluate(FILL);
  await page.evaluate(()=>{S.items.push({id:"quotabulk",name:"Bulk",note:"p".repeat(600*1024)});save()});
  expect(await page.evaluate(()=>!!document.getElementById("savefail"))).toBe(true);
  await page.evaluate(EMPTY);
  await page.evaluate(()=>{S.items=S.items.filter(i=>i.id!=="quotabulk");
    S.items.push({id:"quotacheck2",name:"Room again",qty:"1"});save()});
  expect(await page.evaluate(()=>!!document.getElementById("savefail"))).toBe(false);
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function");
  expect(await page.evaluate(()=>!!S.items.find(i=>i.id==="quotacheck2"))).toBe(true);
});
