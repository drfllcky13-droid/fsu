// Safari deletes a site's storage after seven days without a visit unless the app runs from the
// Home Screen, and everything FSU and Scenes keep lives only there. Until the browser has agreed
// to keep it (navigator.storage.persisted()), and while the app is not running from the Home
// Screen, a bar says so and stays. The app asks for persistence on every start.
const {test,expect}=require("@playwright/test");

const IPAD="Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
// the browser's side of it: whether the page runs from the Home Screen, what persisted() says,
// and what persist() grants when asked
async function device(page,{standalone,persisted,grants,noApi}){
  await page.addInitScript(o=>{
    Object.defineProperty(navigator,"userAgent",{get:()=>o.ua,configurable:true});
    window.__persistCalls=0;
    if(o.noApi)Object.defineProperty(navigator,"storage",{value:undefined,configurable:true});
    else Object.defineProperty(navigator,"storage",{configurable:true,value:{
      persisted:async()=>o.persisted,
      persist:async()=>{window.__persistCalls++; return !!o.grants},
      estimate:async()=>({usage:2e6,quota:1e9})}});
    const mm=window.matchMedia.bind(window);
    window.matchMedia=q=>/display-mode:\s*standalone/.test(q)?{matches:!!o.standalone,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:mm(q);
  },{ua:IPAD,standalone,persisted,grants,noApi});
}
const bar=page=>page.evaluate(()=>{const b=document.getElementById("keepbar");
  return {shown:!!b&&b.style.display!=="none"&&b.offsetParent!==null,text:b?b.textContent:"",calls:window.__persistCalls}});
async function openPage(page,url,sel){
  await page.goto(url); await page.waitForFunction(s=>typeof render==="function"&&document.querySelector(s),sel);
  await page.waitForFunction(()=>storageState.asked);
}

for(const [url,sel] of [["/index.html","#v-home"],["/scenes.html","#v-active"]]){
  test("in Safari, not from the Home Screen and not kept: "+url+" warns about the 7-day deletion and asks to keep",async({page})=>{
    await device(page,{standalone:false,persisted:false,grants:false});
    await openPage(page,url,sel);
    const b=await bar(page);
    expect(b.shown,"no warning about Safari's deletion").toBe(true);
    expect(b.text).toContain("7 days");
    expect(b.text).toContain("Add to Home Screen");
    expect(b.calls,"the app never asked the browser to keep its storage").toBeGreaterThan(0);
    // it stays: moving around the app does not dismiss it
    await page.evaluate(()=>{render()});
    expect((await bar(page)).shown).toBe(true);
    // and How opens the instructions
    await page.click("#keephow");
    await expect(page.locator("#v-data")).toContainText("Add to Home Screen");
  });
}

test("running from the Home Screen: no warning",async({page})=>{
  await device(page,{standalone:true,persisted:false,grants:false});
  await openPage(page,"/index.html","#v-home");
  expect((await bar(page)).shown).toBe(false);
});

test("storage the browser has agreed to keep: no warning",async({page})=>{
  await device(page,{standalone:false,persisted:true});
  await openPage(page,"/scenes.html","#v-active");
  const b=await bar(page);
  expect(b.shown).toBe(false);
  expect(b.calls,"asked again for what was already granted").toBe(0);
});

test("the browser grants the request when asked: no warning",async({page})=>{
  await device(page,{standalone:false,persisted:false,grants:true});
  await openPage(page,"/index.html","#v-home");
  const b=await bar(page);
  expect(b.calls).toBe(1);
  expect(b.shown).toBe(false);
});

test("a browser with no storage API: no claim either way, so no warning",async({page})=>{
  await device(page,{noApi:true});
  await openPage(page,"/index.html","#v-home");
  expect((await bar(page)).shown).toBe(false);
});
