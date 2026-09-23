// Offline checks. The app's promise is that it opens and keeps working in a dead spot,
// so: the service worker takes over, the page opens with the network cut, work done
// offline survives a reload, and every file the page asks for online is in the cache,
// which is what stops a new asset shipping uncached.
const {test,expect}=require("@playwright/test");

async function ready(page){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
  await page.evaluate(()=>navigator.serviceWorker.ready);
}

test("the worker takes over and the page opens with the network cut",async({page,context})=>{
  await ready(page);
  await page.reload();                     // the second load is the controlled one
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
  expect(await page.evaluate(()=>S.comps.length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>getComputedStyle(document.querySelector("#tabs")).display)).not.toBe("");
  await context.setOffline(false);
});

test("work done offline is still there after an offline reload",async({page,context})=>{
  await ready(page);
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function");
  const n=await page.evaluate(()=>{
    S.items.push({id:"offlinecheck",name:"Added offline",qty:"1",cat:"A",cls:"Consumable",loc:""});
    const c=S.comps[0]; c.checked=today(); save();
    return {items:S.items.length, checked:c.id};
  });
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function");
  const after=await page.evaluate(id=>({added:!!S.items.find(i=>i.id==="offlinecheck"), checked:!!S.comps.find(c=>c.id===id&&c.checked)}),n.checked);
  expect(after).toEqual({added:true,checked:true});
  await context.setOffline(false);
});

test("every file the page asks for is in the cache",async({page})=>{
  const asked=new Set();
  page.on("request",r=>{const u=new URL(r.url()); if(u.hostname==="127.0.0.1"&&!u.pathname.endsWith("/sw.js"))asked.add(u.pathname)});
  await ready(page);
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.waitForTimeout(300);          // the worker caches each response as it lands
  // the app is one file on purpose, so this list is short: index.html and the manifest.
  // It earns its keep the day something external gets added and never cached.
  expect([...asked]).toContain("/index.html");
  console.log("cache check: "+[...asked].join(" "));
  const missing=await page.evaluate(async paths=>{
    const c=await caches.open(FSU_CACHE), out=[];
    for(const p of paths)if(!await c.match(location.origin+p))out.push(p);
    return out;
  },[...asked]);
  expect(missing).toEqual([]);
});
