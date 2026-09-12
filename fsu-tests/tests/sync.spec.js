// Sync checks against a stubbed GitHub. No token and no network: every call to the API is
// answered by the test, which is the only way to drill the paths that matter — two devices
// editing the same file, a token that has lapsed, and a repo the token cannot write.
// What it proves is that a clash is surfaced and never silently resolved.
const {test,expect}=require("@playwright/test");

// the service worker would carry these calls out to the real GitHub, past the stub below,
// so it is switched off for this file only
test.use({serviceWorkers:"block"});

const FILE=/api\.github\.com\/repos\//;   // a pattern, so the pull URL's query matches too
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64");

// a fake data.json on the remote, with the sha the app has to send back to write over it
function remote(state){
  return async route=>{
    const req=route.request();
    if(req.method()==="GET")
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({sha:state.sha,content:b64(state.data),encoding:"base64"})});
    const sent=JSON.parse(req.postData()||"{}");
    state.lastPut=sent;
    if(sent.sha!==state.sha)                       // someone else wrote since this device read
      return route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({message:"conflict"})});
    state.sha="sha"+(+state.sha.replace(/\D/g,"")+1);
    state.data=JSON.parse(Buffer.from(sent.content,"base64").toString());
    return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({content:{sha:state.sha}})});
  };
}
async function connected(page,sha){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
  await page.evaluate(s=>{
    S.gh={owner:"unit",repo:"van-data",path:"data.json",token:"test-token-not-a-real-one",sha:s,last:""};
    save();
  },sha);
}

test("a file changed by another device is reported, not overwritten",async({page})=>{
  const state={sha:"sha7",data:{items:[{id:"theirs",name:"Their item"}],comps:[]},lastPut:null};
  await page.route(FILE,remote(state));
  await connected(page,"sha1");                    // this device is holding a stale sha
  const r=await page.evaluate(async()=>{
    S.items.push({id:"mine",name:"My item"});
    await ghPush(false);
    return {conflict, view, bar:(document.querySelector("#syncbar")||{}).textContent||""};
  });
  expect(r.conflict,"a clash was not flagged").toBe(true);
  expect(state.data.items.find(i=>i.id==="theirs"),"their work was overwritten").toBeTruthy();
  expect(r.bar).toContain("Another device");
});

test("pushing over theirs is a deliberate second act",async({page})=>{
  const state={sha:"sha7",data:{items:[{id:"theirs",name:"Their item"}],comps:[]},lastPut:null};
  await page.route(FILE,remote(state));
  await connected(page,"sha1");
  const r=await page.evaluate(async()=>{
    S.items=[{id:"mine",name:"My item"}];
    await ghPush(false);                           // refused
    const first=conflict;
    await ghPush(true);                            // the person chose "Push over theirs"
    return {first,after:conflict};
  });
  expect(r.first).toBe(true);
  expect(r.after,"the clash flag stayed up after a deliberate push").toBe(false);
  expect(state.data.items.map(i=>i.id)).toEqual(["mine"]);
});

test("pulling takes their version whole",async({page})=>{
  const state={sha:"sha7",data:{items:[{id:"theirs",name:"Their item"},{id:"t2",name:"Second"}],comps:[{id:"1A1",name:"Drawer"}]}};
  await page.route(FILE,remote(state));
  await connected(page,"sha1");
  const r=await page.evaluate(async()=>{
    S.items=[{id:"mine",name:"My item"}];
    const res=await ghPull(true);
    return {res,ids:S.items.map(i=>i.id),comps:S.comps.length,conflict,sha:S.gh.sha};
  });
  expect(r.ids).toEqual(["theirs","t2"]);
  expect(r.comps).toBe(1);
  expect(r.conflict).toBe(false);
  expect(r.sha).toBe("sha7");
});

test("a lapsed token says so instead of looking like a save",async({page})=>{
  await page.route(FILE,route=>route.fulfill({status:401,contentType:"application/json",body:JSON.stringify({message:"Bad credentials"})}));
  await connected(page,"sha1");
  const r=await page.evaluate(async()=>{ await ghPush(false); return {err:syncErr,dirty}; });
  expect(r.err).toContain("Token rejected");
  await page.evaluate(()=>{clearTimeout(pushT)});   // stop the retry timer the failure started
});
