// Both pages carry a Content-Security-Policy (build.js puts the page's own script hash in it):
// one inline script, this page's, and nothing from other sites but GitHub's API and the county
// aerial. These tests run everything that loads a library or reaches out, with violations
// watched, so a policy that is too tight shows up here rather than on an iPad in the field.
const {test,expect}=require("@playwright/test");

// a fake camera, so the live scanner runs as it would on a device
test.use({launchOptions:{args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]},
  permissions:["camera"]});

async function watchCSP(page){
  await page.addInitScript(()=>{window.__csp=[];
    document.addEventListener("securitypolicyviolation",e=>window.__csp.push(
      e.effectiveDirective+" blocked "+(e.blockedURI||"inline")+" at "+String(e.sourceFile||"").split("/").pop()+":"+e.lineNumber))});
  const thrown=[]; page.on("pageerror",e=>thrown.push(e.message));
  return thrown;
}
const violations=page=>page.evaluate(()=>window.__csp);
async function open(page,url,first){
  await page.goto(url); await page.evaluate(()=>localStorage.clear());
  await page.goto(url); await page.waitForFunction(sel=>typeof render==="function"&&document.querySelector(sel),first);
}

for(const [url,first] of [["/index.html","#v-home"],["/scenes.html","#v-active"]]){
  test("the policy on "+url+" lets the page's own script run and refuses an injected one",async({page})=>{
    const thrown=await watchCSP(page);
    await open(page,url,first);
    const policy=await page.evaluate(()=>(document.querySelector('meta[http-equiv="Content-Security-Policy"]')||{}).content||"");
    expect(policy).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]{44}'/);
    expect(policy).toContain("connect-src 'self' https://api.github.com https://imagery.pasda.psu.edu");
    expect(await violations(page),"the page's own script or styles were refused").toEqual([]);
    // markup that got past everything else still cannot run
    const ran=await page.evaluate(async()=>{
      const d=document.createElement("div"); document.body.appendChild(d);
      d.innerHTML='<img src="x-missing.png" onerror="window.__ran=1">';
      const s=document.createElement("script"); s.textContent="window.__ran2=1"; document.body.appendChild(s);
      await new Promise(r=>setTimeout(r,300)); d.remove(); s.remove();
      return {a:window.__ran||0,b:window.__ran2||0}});
    expect(ran).toEqual({a:0,b:0});
    expect((await violations(page)).length,"the refusals were not reported").toBeGreaterThan(0);
    expect(thrown).toEqual([]);
  });
}

test("FSU under the policy: QR labels, the camera scanner and the offline download all work",async({page})=>{
  test.setTimeout(120000);
  const thrown=await watchCSP(page);
  await open(page,"/index.html","#v-home");
  const out=await page.evaluate(async()=>{
    const r={};
    await qrLib(); r.qr=typeof window.qrcode==="function";
    S.labelKind="comps"; S.labelBay="all"; go("labels");
    await new Promise(x=>setTimeout(x,500));
    r.labels=document.querySelectorAll("#v-labels svg, #v-labels img, #v-labels canvas").length;
    await jsqrLib(); r.jsqr=typeof window.jsQR==="function";
    scanSheet("comps");
    await new Promise(x=>setTimeout(x,1500));
    const v=document.querySelector("#scv"); r.video=!!(v&&v.srcObject&&v.readyState>=2);
    const x=document.querySelector("#scx"); if(x)x.click();
    SET_SEC="device"; view="data"; render();
    document.querySelector("#offdl").click();
    const t=Date.now();
    while(Date.now()-t<60000){ await new Promise(x=>setTimeout(x,250));
      const st=(document.querySelector("#offst")||{}).textContent||"";
      if(/Could not|cannot/i.test(st)){r.offline=st;break}
      try{if(JSON.parse(localStorage.getItem("fsuOffline")||"null")){r.offline="ok";break}}catch(e){} }
    return r});
  console.log("FSU under the policy:",JSON.stringify(out));
  expect(out.qr,"the QR encoder did not load").toBe(true);
  expect(out.labels,"no labels were drawn").toBeGreaterThan(0);
  expect(out.jsqr,"the QR reader did not load").toBe(true);
  expect(out.video,"the camera did not start").toBe(true);
  expect(out.offline).toBe("ok");
  expect(await violations(page)).toEqual([]);
  expect(thrown).toEqual([]);
});

test("Scenes under the policy: PDF, vector PDF, Word, the aerial and the map all work",async({page})=>{
  test.setTimeout(120000);
  const thrown=await watchCSP(page);
  // the county aerial, answered here: the policy is checked before the request leaves the page
  const JPEG=Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z","base64");
  await page.route(/imagery\.pasda\.psu\.edu/,r=>r.fulfill({status:200,contentType:"image/jpeg",body:Buffer.concat([JPEG,Buffer.alloc(2000)])}));
  await open(page,"/scenes.html","#v-active");
  const out=await page.evaluate(async()=>{
    const r={}, got=[]; const od=dlBlob; dlBlob=b=>got.push(b.size);
    Object.defineProperty(navigator,"canShare",{value:undefined,configurable:true});
    const inc=newIncident(); inc.caseNo="CSP-1"; save(); curInc=inc.id; go("incident");
    document.querySelector("[data-plan=report]").click();
    await exportFillDocx((S.fills||[]).find(x=>x.id===curFill));
    await new Promise(x=>setTimeout(x,800)); r.docx=got.length;
    const sk=newSketch(); sk.incidentId=inc.id; curSketch=sk.id; go("sketch"); addObj("wall"); addObj("marker");
    const J=await loadPDF(); r.pdf=typeof J==="function";
    const d=new J({unit:"pt",format:"letter",orientation:"landscape"}); await exportSketch(curSk(),d);
    r.raster=d.output("arraybuffer").byteLength;
    EXPORTOPT.vector=true; window.__vecOK=null;
    const d2=new J({unit:"pt",format:"letter",orientation:"landscape"}); await exportSketch(curSk(),d2);
    EXPORTOPT.vector=false; r.vector=window.__vecOK;
    try{ const a=await fetchAerial(41.2412,-77.0011,200,256); r.aerial=/^data:image\//.test(a.data) }catch(e){ r.aerial=e.message }
    dlBlob=od;
    // the map: the library is a module with its own worker, loaded from lib/
    try{ const ml=await mapLoad(); r.maplib=!!ml;
      const box=document.createElement("div"); box.style.cssText="width:300px;height:300px"; document.body.appendChild(box);
      try{ const m=new (ml.Map||ml.default.Map)({container:box,style:{version:8,sources:{},layers:[{id:"bg",type:"background",paint:{"background-color":"#fff"}}]},center:[-77,41.24],zoom:15});
        await Promise.race([new Promise(x=>m.on("load",x)),new Promise(x=>setTimeout(x,8000))]); r.map="loaded"; m.remove() }
      catch(e){ r.map="no WebGL: "+e.message }
      box.remove();
    }catch(e){ r.maplib=e.message }
    return r});
  console.log("Scenes under the policy:",JSON.stringify(out));
  expect(out.docx,"the Word file was not produced").toBe(1);
  expect(out.pdf).toBe(true);
  expect(out.raster).toBeGreaterThan(5000);
  expect(out.vector,"the vector PDF fell back or failed").toBe(true);
  expect(out.aerial,"the county aerial was refused").toBe(true);
  expect(out.maplib,"the map library did not load").toBe(true);
  expect(await violations(page)).toEqual([]);
  expect(thrown).toEqual([]);
});
