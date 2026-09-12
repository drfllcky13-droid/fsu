// Bulk check. The van list grows for years and an iPad is slower than this machine, so the
// heavy views are timed against a CPU-throttled budget with far more in them than today.
const {test,expect}=require("@playwright/test");

const ITEMS=600, SKETCHES=40, BUDGET=200;   // ms per render, at quarter speed; it runs in about 50 today

test("the heavy views still redraw quickly with years of data in them",async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
  const seeded=await page.evaluate(([n,sk])=>{
    for(let i=0;i<n;i++)S.items.push({id:"bulk"+i,name:"Bulk item "+i,qty:String(i%9),par:"2",
      cat:"A",cls:"Consumable",loc:S.comps[i%S.comps.length].id,exp:"2027-01-0"+(1+i%9)});
    for(let i=0;i<sk;i++){const s=newSketch(); s.objs=[]; for(let j=0;j<40;j++)s.objs.push({id:"o"+i+"_"+j,t:"chair",x:j*7,y:j*5,w:30,h:30});}
    saveLocal();
    return {items:S.items.length,sketches:(S.sketches||[]).length};
  },[ITEMS,SKETCHES]);
  expect(seeded.items).toBeGreaterThan(ITEMS);

  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});   // roughly an older iPad
  const times=await page.evaluate(views=>{
    const out={};
    for(const v of views){
      const t=performance.now();
      view=v;document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));render();
      out[v]=Math.round(performance.now()-t);
    }
    return out;
  },["home","inventory","compartments","sweep","guide","active"]);
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});

  console.log("bulk render at 4x slowdown, "+seeded.items+" items and "+seeded.sketches+" sketches: "
    +Object.entries(times).map(([v,ms])=>v+" "+ms+"ms").join(", "));
  const slow=Object.entries(times).filter(([,ms])=>ms>BUDGET).map(([v,ms])=>v+" "+ms+"ms");
  expect(slow).toEqual([]);
});
