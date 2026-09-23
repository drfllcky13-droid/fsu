// How the service worker answers. A page opens from the cache when the network is slower than
// about three seconds, and the network's answer, when it arrives, refreshes the cache behind it;
// if that answer is a new version, the page offers a reload. With no network at all each app
// falls back to itself: Scenes to Scenes, never to FSU.
const {test,expect}=require("@playwright/test");

// the second load is the one the worker controls
async function controlled(page,url,sel){
  await page.goto(url);
  await page.waitForFunction(s=>typeof render==="function"&&document.querySelector(s),sel);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.waitForFunction(s=>typeof render==="function"&&document.querySelector(s),sel);
}
// The worker fetches for itself, out of reach of Playwright's routing and setOffline, so the
// test server plays the network: a plan for this test's browser alone (see serve.js).
let seq=0;
async function network(page,context,plan){
  const id="t"+Date.now().toString(36)+(seq++);
  await context.addCookies([{name:"fsunet",value:id,url:"http://127.0.0.1:8766"}]);
  await page.request.post("/__net?id="+id,{data:JSON.stringify(plan),headers:{"content-type":"application/json"}});
  return async next=>page.request.post("/__net?id="+id,{data:JSON.stringify(next),headers:{"content-type":"application/json"}});
}

test("on a slow network the page opens from the cache, and the same version brings no reload offer",async({page,context})=>{
  await controlled(page,"/index.html","#v-home");
  // the server now takes eight seconds to answer for the page
  await network(page,context,{delay:{"/index.html":8000}});
  const t=Date.now();
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"),null,{timeout:15000});
  const took=Date.now()-t;
  expect(took,"the page waited for the slow network instead of opening from the cache").toBeLessThan(6000);
  await page.waitForTimeout(8000);           // the slow answer lands; it is the same page
  expect(await page.locator("#updbar").count()).toBe(0);
});

test("a new version that arrives after the page opened from the cache offers a reload",async({page,context})=>{
  await controlled(page,"/scenes.html","#v-active");
  const real=await (await page.request.get("/scenes.html")).text();
  // the next version, marked outside the script: the page's policy only runs a script whose hash it names
  const next=real.replace(/<title>([^<]*)<\/title>/,"<title>$1 (next)</title>");
  expect(next).not.toBe(real);
  const change=await network(page,context,{delay:{"/scenes.html":5000},body:{"/scenes.html":next}});
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-active"),null,{timeout:15000});
  expect(await page.title(),"it waited for the network instead of opening from the cache").not.toContain("(next)");
  await expect(page.locator("#updbar"),"no reload was offered for the new version").toBeVisible({timeout:12000});
  await expect(page.locator("#updbar")).toContainText("Updated");
  await change({body:{"/scenes.html":next}});
  await page.click("#updreload");
  await page.waitForFunction(()=>document.title.includes("(next)")&&typeof render==="function",null,{timeout:15000});
});

test("with no network, Scenes falls back to Scenes and FSU to FSU",async({page,context})=>{
  await controlled(page,"/scenes.html","#v-active");
  await page.goto("/index.html"); await page.waitForFunction(()=>typeof render==="function");
  await network(page,context,{down:true});
  // an address the cache has never seen, the way a home-screen launch can add a query
  await page.goto("/scenes.html?from=homescreen");
  await page.waitForFunction(()=>typeof render==="function",null,{timeout:10000});
  expect(await page.evaluate(()=>PAGE),"offline, Scenes opened as the van app").toBe("scenes");
  expect(await page.locator("#v-active").count()).toBe(1);
  await page.goto("/index.html?from=homescreen");
  await page.waitForFunction(()=>typeof render==="function",null,{timeout:10000});
  expect(await page.evaluate(()=>PAGE)).toBe("van");
});

test("the cache name is set in sw.js and the pages carry the same one",async({page,request})=>{
  const sw=await (await request.get("/sw.js")).text();
  const name=(sw.match(/const CACHE="([^"]+)"/)||[])[1];
  expect(name).toBeTruthy();
  for(const url of ["/index.html","/scenes.html"]){
    await page.goto(url); await page.waitForFunction(()=>typeof render==="function");
    expect(await page.evaluate(()=>FSU_CACHE)).toBe(name);
  }
});
