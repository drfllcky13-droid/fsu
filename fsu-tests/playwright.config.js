// Serves the folder above (where index.html lives) and runs the checks in Chromium.
const {defineConfig}=require("@playwright/test");
module.exports=defineConfig({
  testDir:"./tests",
  timeout:60000,
  retries:0,
  // list names every test as it runs; failures-reporter.js repeats the failed and flaky ones at
  // the end and in last-run.txt, so a one-off failure is never lost in a long or truncated log
  reporter:[["list"],["./failures-reporter.js"]],
  use:{baseURL:"http://127.0.0.1:8766",headless:true},
  webServer:{command:"node serve.js 8766",url:"http://127.0.0.1:8766/index.html",reuseExistingServer:true,timeout:20000},
  projects:[{name:"chromium",use:{browserName:"chromium"}},
    // the iPad is Safari, so the button and layout checks run in WebKit too;
    // the sketch flows stay on Chromium, where they were written
    {name:"webkit",use:{browserName:"webkit"},testMatch:/ui.spec.js/}]
});
