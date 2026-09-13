// Picture baselines for the views that carry the layout, at iPad width in both schemes.
// A CSS change that shifts something shows up here as a picture instead of as nothing.
// Skipped on CI, where a different machine's font rendering would fail every run.
// After a deliberate change: npx playwright test tests/visual.spec.js --update-snapshots
const {test,expect}=require("@playwright/test");

test.skip(!!process.env.CI,"baselines are machine-specific");

// anything that is different on every run is hidden, not tolerated: the saved tick and the toast
// both fade on a timer, so a shot taken while one is up would flap.
const STEADY=`#savedtick{opacity:0!important}#toast{display:none!important}`;

for(const scheme of ["light","dark"])for(const v of ["home","compartments","inventory"]){
  test(`${v} looks the same in ${scheme}`,async({page})=>{
    await page.setViewportSize({width:1194,height:834});
    await page.emulateMedia({colorScheme:scheme});
    await page.goto("/index.html");
    await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
    await page.evaluate(name=>{
      view=name;document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+name));render();
      const d=document.querySelector("#date"); if(d)d.textContent="Sat, Jan 1";   // the date is not the subject
    },v);
    await page.addStyleTag({content:STEADY});
    await expect(page).toHaveScreenshot(`${v}-${scheme}.png`,{maxDiffPixelRatio:0.01,animations:"disabled"});
  });
}

// The scene page. The record is seeded here rather than taken from storage, so the shot is the
// same on an empty device and on a loaded one, and every stamp in it is a fixed one.
for(const scheme of ["light","dark"])for(const v of ["incidents","incident","sketch"]){
  test(`scene ${v} looks the same in ${scheme}`,async({page})=>{
    await page.setViewportSize({width:1194,height:834});
    await page.emulateMedia({colorScheme:scheme});
    await page.goto("/scenes.html");
    await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-active"));
    await page.evaluate(v=>{
      S.incidents=[];S.fills=[];S.sketches=[];S.activity=[];
      S.sketchGuideSeen=true;window.__guideHinted=true;     // no "new here?" toast on the sketch
      const inc=newIncident();
      Object.assign(inc,{caseNo:"2026-0101",offence:"Burglary",addr:"12 Example Street",
        opened:"2026-01-01T09:00:00.000Z"});
      const f=(S.forms||[]).find(x=>x.name==="Evidence log");
      if(f){const rec=newFill(f);rec.incidentId=inc.id;rec.started="2026-01-01T09:00:00.000Z"}
      const sk=newSketch();
      Object.assign(sk,{caseNo:"2026-0101",addr:"12 Example Street",when:"2026-01-01T09:00",
        by:"AG",incidentId:inc.id});
      curInc=inc.id;curSketch=sk.id;selObj=null;curLayer=null;
      if(v==="sketch")addObj("marker");                     // something drawn on it
      const name=v==="incidents"?"active":v;
      view=name;document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+name));
      render();saveLocal();
    },v);
    await page.addStyleTag({content:STEADY});
    await expect(page).toHaveScreenshot(`scene-${v}-${scheme}.png`,{maxDiffPixelRatio:0.01,animations:"disabled"});
  });
}
