// Picture baselines for the views that carry the layout, at iPad width in both schemes.
// A CSS change that shifts something shows up here as a picture instead of as nothing.
// Skipped on CI, where a different machine's font rendering would fail every run.
// After a deliberate change: npx playwright test tests/visual.spec.js --update-snapshots
const {test,expect}=require("@playwright/test");

test.skip(!!process.env.CI,"baselines are machine-specific");

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
    await expect(page).toHaveScreenshot(`${v}-${scheme}.png`,{maxDiffPixelRatio:0.01,animations:"disabled"});
  });
}
