// A saved record that will not read is never written over: its text is kept as van3.bad-<time>
// before the app starts afresh, and the page says so. With no room for a second copy the
// original is moved; if even that fails nothing is saved over it until it has been downloaded.
// Once the current record reads, the old vaninv2 and vaninv keys are removed.
const {test,expect}=require("@playwright/test");
const BROKEN='{"items":[{"id":"a1","name":"Hinge lif';

async function boot(page,url,seed,init){
  await page.goto(url);
  await page.evaluate(s=>{localStorage.clear(); for(const k in s)localStorage.setItem(k,s[k])},seed);
  if(init)await page.addInitScript(init);
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function");
  await page.waitForTimeout(100);
}
const keys=page=>page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k)}return o});

test("a record that will not read is kept as van3.bad-<time>, and the page says so",async({page})=>{
  await boot(page,"/index.html",{van3:BROKEN});
  const k=await keys(page);
  const bad=Object.keys(k).filter(x=>x.indexOf("van3.bad-")===0);
  expect(bad.length,"the damaged record was not kept").toBe(1);
  expect(k[bad[0]],"the kept copy is not the damaged text as it was").toBe(BROKEN);
  expect(()=>JSON.parse(k.van3),"the app did not start afresh").not.toThrow();
  const bar=await page.locator("#badbar").textContent();
  expect(bar).toContain("could not be read");
  expect(bar).toContain(bad[0]);
  expect(await page.evaluate(()=>S.errors.some(e=>/could not be read/.test(e.m)))).toBe(true);
  // and Settings › This device lists it
  const listed=await page.evaluate(()=>{SET_SEC="device";view="data";render();return document.querySelector("#v-data").textContent});
  expect(listed).toContain(bad[0]);
});

test("with no room for a second copy the damaged record is moved, not lost",async({page})=>{
  // the first write of the copy is refused, as a full store would
  await boot(page,"/index.html",{van3:BROKEN},()=>{
    const set=Storage.prototype.setItem; let refused=false;
    Storage.prototype.setItem=function(k,v){ if(String(k).indexOf("van3.bad-")===0&&!refused){refused=true;throw new DOMException("full","QuotaExceededError")} return set.call(this,k,v) };
  });
  const k=await keys(page);
  const bad=Object.keys(k).filter(x=>x.indexOf("van3.bad-")===0);
  expect(bad.length).toBe(1);
  expect(k[bad[0]]).toBe(BROKEN);
});

test("with no room at all, nothing is saved over the damaged record until it is downloaded",async({page})=>{
  await boot(page,"/index.html",{van3:BROKEN},()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){ if(String(k).indexOf("van3.bad-")===0)throw new DOMException("full","QuotaExceededError"); return set.call(this,k,v) };
    window.__dl=[]; window.addEventListener("DOMContentLoaded",()=>{});
  });
  expect((await keys(page)).van3,"the damaged record was written over").toBe(BROKEN);
  await page.evaluate(()=>{S.who="XY";save()});
  expect((await keys(page)).van3,"a save went over the damaged record").toBe(BROKEN);
  const bar=await page.locator("#badbar").textContent();
  expect(bar).toContain("no room to keep a copy");
  await page.evaluate(()=>{window.dlBlob=(b,n)=>{window.__dl.push(n)}});
  await page.click("#baddl");
  expect(await page.evaluate(()=>window.__dl.length)).toBe(1);
  const after=(await keys(page)).van3;
  expect(after,"saving did not resume after the download").not.toBe(BROKEN);
  expect(JSON.parse(after).who).toBe("XY");
});

test("the old vaninv keys go once the current record has read, and stay while they are the record",async({page})=>{
  const good=JSON.stringify({items:[{id:"a1",name:"Gloves",qty:1,cat:"A",cls:"Consumable",loc:""}],comps:[],seeded:true});
  await boot(page,"/index.html",{van3:good,vaninv2:good,vaninv:good});
  let k=await keys(page);
  expect([k.vaninv2,k.vaninv],"the old keys were kept after the current record read").toEqual([undefined,undefined]);
  // a device that only has the old key: it loads, and is not removed until van3 has been written and read
  await boot(page,"/index.html",{vaninv2:good});
  k=await keys(page);
  expect(k.vaninv2,"the only record was removed").toBe(good);
  expect(await page.evaluate(()=>S.items.some(i=>i.id==="a1"))).toBe(true);
  await page.reload(); await page.waitForFunction(()=>typeof render==="function");
  k=await keys(page);
  expect(k.vaninv2).toBeUndefined();
  expect(JSON.parse(k.van3).items.some(i=>i.id==="a1")).toBe(true);
});
