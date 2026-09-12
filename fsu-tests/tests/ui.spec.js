// Button and layout checks. The crawl presses every control in every view; the layout
// audit looks for anything pushed offscreen, clipped, covered or too small to tap.
// Tap size is reported, never asserted: 44px is a guideline and the call is yours.
const {test,expect}=require("@playwright/test");
const fs=require("fs"), path=require("path");
const root=f=>fs.readFileSync(path.join(__dirname,"..","..",f),"utf8");
const CRAWL=root("crawl.js"), VIS=root("visible.js");

async function open(page){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}
// the two machines it actually runs on: a desktop and an iPad, the iPad both ways up
const sizes=[[1500,1000],[1280,800],[1194,834],[834,1194]];

// The scene views only have controls once something is open, so give the crawl an
// incident and a scaled sketch to work on before it starts.
async function seed(page){
  await page.evaluate(()=>{
    const inc=newIncident(); curInc=inc.id;
    const sk=newSketch(); curSketch=sk.id; selObj=null; curLayer=null;
    sk.scale={px:100,real:10,unit:"ft"}; saveLocal();
    // walk in through the app's own cards so the bay, compartment and item views
    // have something open, the way they only ever do for a real user
    view="compartments"; document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id==="v-compartments")); render();
    const bay=document.querySelector("section.view.on [data-bay]"); if(bay)bay.click();
    const comp=document.querySelector("section.view.on [data-comp]"); if(comp)comp.click();
    if(S.items[0])openItem(S.items[0].id,"inventory");
    closeSheet(); view="home"; render();
  });
}

for(const [w,h] of [[1500,1000],[834,1194]]){
  test(`click crawl ${w}px`,async({page})=>{
    await page.setViewportSize({width:w,height:h});
    const errors=[]; page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    await open(page);
    await seed(page);
    page.on("dialog",d=>d.dismiss());
    const out=await page.evaluate(CRAWL);
    console.log(`crawl ${w}px: ${out.clicked} controls in ${out.views} views, `
      +`${out.skipped.length} left alone`);
    if(out.deadControls.length)console.log("  no visible effect:\n   "+out.deadControls.join("\n   "));
    if(out.inert.length)console.log(`  ${out.inert.length} data- elements that are not buttons did nothing`);
    expect(out.deadRoutes).toEqual([]);
    expect(out.threw).toEqual([]);
    expect(errors.filter(e=>!/failed to draw/.test(e))).toEqual([]);
  });
}

for(const [w,h] of sizes)for(const scheme of ["light","dark"]){
  test(`layout ${w}px ${scheme}`,async({page})=>{
    await page.setViewportSize({width:w,height:h});
    await page.emulateMedia({colorScheme:scheme});
    await open(page);
    await page.evaluate(m=>{window.VISMIN=m},w<=1194?44:0);
    const out=await page.evaluate(VIS);
    if(out.tiny.length)console.log(`layout ${w}px ${scheme} small targets:\n   `+out.tiny.join("\n   "));
    expect(out.offscreen).toEqual([]);
    expect(out.clipped).toEqual([]);
    expect(out.covered).toEqual([]);
    expect(out.invisible).toEqual([]);
  });
}
