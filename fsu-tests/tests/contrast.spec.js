// Contrast report. Prints every piece of text under WCAG AA in each scheme at iPad width.
// It does not fail the run: which colour to change is a design call. See ../contrast.js.
const {test}=require("@playwright/test");
const fs=require("fs"), path=require("path");
const CONTRAST=fs.readFileSync(path.join(__dirname,"..","..","contrast.js"),"utf8");

for(const scheme of ["light","dark"]){
  test("contrast "+scheme,async({page})=>{
    await page.setViewportSize({width:1194,height:834});
    await page.emulateMedia({colorScheme:scheme});
    await page.goto("/index.html");
    await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
    const out=await page.evaluate(CONTRAST);
    console.log(["contrast "+scheme+": "+out.under.length+" of "+out.checked+" under AA, worst "
      +out.worst.r.toFixed(2)+" on "+out.worst.where].concat(out.under).join("\n   "));
  });
}
