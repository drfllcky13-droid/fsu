// Sync against a stubbed GitHub. No token and no network: every call to the API is answered
// by the test, which is the only way to drill the paths that matter — two devices editing at
// once, a device a week behind, a delete racing an edit, a lapsed token, a file that will not
// open, and a device still running yesterday's build.
// What it proves is that no technician's work is ever thrown away without a copy of it.
// SYNC_DESIGN.txt is the reasoning; this file is the evidence.
const {test,expect}=require("@playwright/test");

// the service worker would carry these calls out to the real GitHub, past the stub below,
// so it is switched off for this file only
test.use({serviceWorkers:"block"});

const FILE=/api\.github\.com\/repos\//;   // a pattern, so the pull URL's query matches too
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64");
const unb64=s=>JSON.parse(Buffer.from(s,"base64").toString());

// a fake data.json on the remote. It refuses a PUT whose sha is stale, exactly as GitHub does,
// and records every PUT so a test can see what actually went up.
function remote(state){
  state.puts=state.puts||[];
  state.gets=0;
  return async route=>{
    const req=route.request();
    if(req.method()==="GET"){
      state.gets++;
      if(state.beforeGet)state.beforeGet(state);
      if(state.missing)return route.fulfill({status:404,contentType:"application/json",body:"{}"});
      if(state.status)return route.fulfill({status:state.status,contentType:"application/json",headers:state.headers||{},body:JSON.stringify({message:"no"})});
      return route.fulfill({status:200,contentType:"application/json",
        headers:state.expires?{"github-authentication-token-expiration":state.expires,
          "access-control-expose-headers":"github-authentication-token-expiration"}:{},
        body:JSON.stringify({sha:state.sha,content:state.raw!=null?state.raw:b64(state.data),encoding:"base64"})});
    }
    const sent=JSON.parse(req.postData()||"{}");
    // a test can act while the PUT is on the wire, as a technician tapping away would
    if(state.beforePut){const h=state.beforePut; state.beforePut=null; await h(state)}
    if(state.status)return route.fulfill({status:state.status,contentType:"application/json",headers:state.headers||{},body:JSON.stringify({message:"no"})});
    // no file yet: GitHub creates it from a PUT that carries no sha
    if(state.missing&&!sent.sha)state.missing=false;
    else if(sent.sha!==state.sha)
      return route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({message:"conflict"})});
    state.sha="sha"+(+String(state.sha).replace(/\D/g,"")+1);
    state.data=unb64(sent.content); state.raw=null;
    state.puts.push(state.data);
    return route.fulfill({status:200,contentType:"application/json",
      body:JSON.stringify({content:{sha:state.sha}})});
  };
}
const file=(items,extra)=>Object.assign({v:2,lam:10,items:items||[],comps:[],forms:[],walls:{}},extra||{});
const it=(id,name,v,d,rest)=>Object.assign({id,name,qty:1,cat:"A",cls:"Consumable",loc:"",_v:v,_d:d},rest||{});
// a tombstone as it travels: inside the array, shaped so an old build's own filters hide it
const dead=(id,v,d,when)=>({id,name:"",status:"Not carried",gapType:"deliberate",
  _x:1,_v:v,_d:d,_t:when||new Date().toISOString()});

// the scene page, for the one check that needs a sketch to exist
async function openScenes(page){
  await page.goto("/scenes.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-active"));
}
async function open(page){
  await page.goto("/index.html");
  await page.evaluate(()=>localStorage.clear());
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}
// connect, and take the first sync, so the device has a base to judge later changes against.
// A device that has never synced defers to the repo on purpose (the virgin rule in the
// design), so every test about a clash has to get past that first.
async function connected(page,dev,where){
  await (where==="scenes"?openScenes(page):open(page));
  await page.evaluate(async d=>{
    S.gh={owner:"unit",repo:"van-data",path:"data.json",token:"test-token-not-a-real-one",sha:"",last:""};
    if(d)S.dev=d;
    S.items=[]; S.comps=[]; saveLocal();
    await ghPull(true);
    await ghPush(false);
  },dev||"devA");
}

/* ---------------- the case that used to cost an afternoon ---------------- */

test("two devices editing different items both keep their work",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB"),it("b","Swabs",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page);
  await page.evaluate(()=>{S.items.find(i=>i.id==="a").qty=99;saveLocal()});
  // meanwhile the other device changed the other item and pushed it
  state.data.items=[state.data.items[0],it("b","Swabs",50,"devB",{qty:7})];
  state.data.lam=50;
  const out=await page.evaluate(async()=>{await ghPush(false);
    return {a:S.items.find(i=>i.id==="a").qty, b:S.items.find(i=>i.id==="b").qty,
            stashed:S.conflicts.length, conflict,
            bar:(document.querySelector("#syncbar")||{}).textContent||""}});
  expect(out.a,"this device's edit was lost").toBe(99);
  expect(out.b,"the other device's edit was lost").toBe(7);
  expect(out.stashed,"nobody should have had to decide anything").toBe(0);
  expect(out.conflict).toBe(false);
  expect(out.bar).toBe("");
  const up=state.puts[state.puts.length-1];
  expect(up.items.find(i=>i.id==="a").qty).toBe(99);
  expect(up.items.find(i=>i.id==="b").qty).toBe(7);
});

test("a 409 in the gap between the read and the write is merged again, not surfaced",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items.push({id:"mine",name:"Mine",qty:1,cat:"A",cls:"Consumable",loc:""});saveLocal()});
  // move the remote on straight after the GET the next push is about to make
  const at=state.gets+1;
  state.beforeGet=s=>{ if(s.gets===at){ s.sha="shaX"; s.data.items.push(it("z","Theirs",40,"devB")) } };
  const out=await page.evaluate(async()=>{
    const r=await ghPush(false);
    return {r,conflict,ids:S.items.map(i=>i.id).sort()}});
  expect(out.r).toBe("ok");
  expect(out.conflict,"a retriable race was pushed onto the user").toBe(false);
  expect(out.ids).toEqual(["a","mine","z"]);
});

/* ---------------- while a request is on the wire ---------------- */

test("an edit made while a push is on the wire goes up next time instead of being reverted",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB",{qty:1})])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items.find(i=>i.id==="a").qty=2;saveLocal()});
  // the count is tapped again while the first change is still uploading
  state.beforePut=()=>page.evaluate(()=>{S.items.find(i=>i.id==="a").qty=3;saveLocal()});
  await page.evaluate(()=>ghPush(false));
  expect(state.data.items.find(i=>i.id==="a").qty,"the first change should be what went up").toBe(2);
  const out=await page.evaluate(async()=>{await ghPush(false);
    return {qty:S.items.find(i=>i.id==="a").qty,stashed:S.conflicts.length}});
  expect(out.qty,"the edit made during the upload was reverted").toBe(3);
  expect(state.data.items.find(i=>i.id==="a").qty,"the edit made during the upload never went up").toBe(3);
  expect(out.stashed).toBe(0);
});

test("a delete made while a push is on the wire stays deleted",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB"),it("b","Swabs",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items.find(i=>i.id==="b").qty=9;saveLocal()});
  state.beforePut=()=>page.evaluate(()=>{S.items=S.items.filter(i=>i.id!=="a");saveLocal()});
  await page.evaluate(()=>ghPush(false));
  const ids=await page.evaluate(async()=>{await ghPush(false);return S.items.map(i=>i.id).sort()});
  expect(ids,"the deleted item came back").toEqual(["b"]);
  expect(state.data.items.filter(i=>!i._x).map(i=>i.id)).toEqual(["b"]);
});

test("an edit made offline survives the pull when the app next opens",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB",{qty:1})])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  // edited with no signal; the app is closed and opened again, which pulls before it pushes
  const out=await page.evaluate(async()=>{
    S.items.find(i=>i.id==="a").qty=4; saveLocal();
    await ghPull(true); await ghPush(false);
    return S.items.find(i=>i.id==="a").qty});
  expect(out,"the offline edit was reverted by the pull").toBe(4);
  expect(state.data.items.find(i=>i.id==="a").qty).toBe(4);
});

test("the device that creates the file keeps the edits it makes afterwards",async({page})=>{
  const state={sha:"sha1",missing:true,data:file([])};
  await page.route(FILE,remote(state));
  await open(page);
  const out=await page.evaluate(async()=>{
    S.gh={owner:"unit",repo:"van-data",path:"data.json",token:"t",sha:"",last:""};
    S.items=[{id:"mine",name:"Mine",qty:1,cat:"A",cls:"Consumable",loc:""}]; saveLocal();
    const pulled=await ghPull(true), created=await ghPush(false);
    S.items[0].qty=5; saveLocal();
    const next=await ghPush(false);
    return {pulled,created,next,qty:S.items[0].qty}});
  expect(out.pulled).toBe("empty");
  expect(out.created).toBe("ok");
  expect(out.next).toBe("ok");
  expect(out.qty,"its own first edit after creating the file was reverted").toBe(5);
  expect(state.data.items.find(i=>i.id==="mine").qty).toBe(5);
});

test("two syncs started at once take turns instead of interleaving",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB",{qty:1})])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  // count requests in flight at once; a slow PUT gives a second sync every chance to overlap
  const route=remote(state); let now=0, most=0;
  state.beforePut=()=>new Promise(r=>setTimeout(r,200));
  await page.unroute(FILE);
  await page.route(FILE,async r=>{now++; most=Math.max(most,now); try{await route(r)}finally{now--}});
  const out=await page.evaluate(async()=>{
    S.items.find(i=>i.id==="a").qty=6; saveLocal();
    const rs=await Promise.all([ghPush(false),ghPush(false),ghPull(true)]);
    return {rs,qty:S.items.find(i=>i.id==="a").qty}});
  expect(out.rs).toEqual(["ok","ok","ok"]);
  expect(most,"two syncs were talking to GitHub at the same time").toBe(1);
  expect(out.qty).toBe(6);
  expect(state.data.items.find(i=>i.id==="a").qty).toBe(6);
});

test("a GitHub request that never answers gives up and retries instead of hanging",async({page})=>{
  const state={sha:"sha1",data:file([])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.unroute(FILE);
  await page.route(FILE,()=>{});             // the request goes out and nothing ever comes back
  const out=await page.evaluate(async()=>{
    GH_TIMEOUT=300;
    S.items.push({id:"x",name:"Typed on bad signal",qty:1,cat:"A",cls:"Consumable",loc:""}); saveLocal();
    const t=Date.now(); const r=await ghPush(false);
    return {r,ms:Date.now()-t,err:syncErr,tokenBad}});
  expect(out.r).toBe("error");
  expect(out.ms).toBeLessThan(5000);
  expect(out.err).toContain("did not answer");
  expect(out.tokenBad).toBe(false);
});

/* ---------------- the same record on two devices ---------------- */

test("two devices editing the same item keep the loser's version, not a silent overwrite",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB",{qty:1})])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items.find(i=>i.id==="a").qty=4;saveLocal()});
  state.data.items=[it("a","Gloves",900,"devB",{qty:6})];   // their stamp is higher: they win
  const out=await page.evaluate(async()=>{await ghPush(false);
    return {qty:S.items.find(i=>i.id==="a").qty,n:S.conflicts.length,
            kept:S.conflicts[0]&&S.conflicts[0].rec.qty,name:S.conflicts[0]&&S.conflicts[0].name}});
  expect(out.qty,"the winner did not take").toBe(6);
  expect(out.n,"the losing edit was thrown away").toBe(1);
  expect(out.kept,"the losing edit was not kept intact").toBe(4);
  expect(out.name).toBe("Gloves");
});

test("putting a superseded edit back makes it win the next sync",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB",{qty:1})])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items.find(i=>i.id==="a").qty=4;saveLocal()});
  state.data.items=[it("a","Gloves",900,"devB",{qty:6})];
  await page.evaluate(()=>ghPush(false));
  const out=await page.evaluate(async()=>{
    SET_SEC="sync"; view="data"; renderData();
    document.querySelector("#v-data [data-cback]").click();
    await new Promise(r=>setTimeout(r,20));
    await ghPush(false);
    return {qty:S.items.find(i=>i.id==="a").qty,n:S.conflicts.length}});
  expect(out.qty).toBe(4);
  expect(out.n,"the entry stayed after it was dealt with").toBe(0);
  expect(state.data.items.find(i=>i.id==="a").qty,"putting it back did not reach the repo").toBe(4);
});

test("a dead heat is broken the same way on every device",async({page})=>{
  // two devices that happen to reach the same counter must not disagree about who won, or
  // they sit there overwriting each other for ever
  await open(page);
  const out=await page.evaluate(()=>({
    zBeatsA:newerRec({_v:7,_d:"devZ"},{_v:7,_d:"devA"}),
    aBeatsZ:newerRec({_v:7,_d:"devA"},{_v:7,_d:"devZ"}),
    counterFirst:newerRec({_v:8,_d:"devA"},{_v:7,_d:"devZ"}),
    same:newerRec({_v:7,_d:"devA"},{_v:7,_d:"devA"})
  }));
  expect(out.zBeatsA).toBe(true);
  expect(out.aBeatsZ,"both devices thought they had won").toBe(false);
  expect(out.counterFirst,"the device id outranked the counter").toBe(true);
  expect(out.same).toBe(false);
});

/* ---------------- a device a week behind ---------------- */

test("a device offline for a week merges in rather than choosing a side",async({page})=>{
  const state={sha:"sha1",data:file([it("shared","Swabs",4,"devB",{qty:1}),it("old","Cones",4,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  // a week of work here with no connection
  await page.evaluate(()=>{
    for(let i=0;i<5;i++)S.items.push({id:"week"+i,name:"Logged "+i,qty:i,cat:"A",cls:"Consumable",loc:""});
    S.items.find(i=>i.id==="shared").qty=2;
    saveLocal();
  });
  // a week of work there, including on the one record both devices touched
  state.data.items=[it("shared","Swabs",800,"devB",{qty:9}),it("old","Cones",4,"devB"),
    it("their1","Tape",801,"devB"),it("their2","Markers",802,"devB")];
  state.data.lam=802;
  const out=await page.evaluate(async()=>{await ghPush(false);
    return {ids:S.items.map(i=>i.id).sort(),shared:S.items.find(i=>i.id==="shared").qty,
            stashed:S.conflicts.map(c=>c.name)}});
  expect(out.ids).toEqual(["old","shared","their1","their2","week0","week1","week2","week3","week4"]);
  expect(out.shared,"the stale device won a record it should have lost").toBe(9);
  expect(out.stashed,"the stale device's own version was not kept").toEqual(["Swabs"]);
  expect(state.data.items.map(i=>i.id).sort()).toEqual(out.ids);
});

/* ---------------- delete against edit ---------------- */

test("a delete here and an edit there: the edit comes back rather than vanishing",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items=S.items.filter(i=>i.id!=="a");saveLocal()});
  state.data.items=[it("a","Gloves",900,"devB",{qty:12})];    // they were still using it
  const out=await page.evaluate(async()=>{await ghPush(false);
    return {ids:S.items.map(i=>i.id),qty:(S.items[0]||{}).qty,tomb:Object.keys(S.tomb.items)}});
  expect(out.ids,"somebody's live edit was deleted out from under them").toEqual(["a"]);
  expect(out.qty).toBe(12);
  expect(out.tomb).toEqual([]);
});

test("an edit here and a delete there: the delete takes, and the edit is kept to put back",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items.find(i=>i.id==="a").qty=41;saveLocal()});
  state.data.items=[dead("a",900,"devB")];
  const out=await page.evaluate(async()=>{await ghPush(false);
    return {ids:S.items.map(i=>i.id),n:S.conflicts.length,kept:S.conflicts[0]&&S.conflicts[0].rec.qty,
            tomb:Object.keys(S.tomb.items)}});
  expect(out.ids).toEqual([]);
  expect(out.tomb).toEqual(["a"]);
  expect(out.n,"the edit was destroyed by the other device's delete").toBe(1);
  expect(out.kept).toBe(41);
});

test("a delete stays deleted across a later sync instead of coming back",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB"),it("b","Swabs",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(async()=>{S.items=S.items.filter(i=>i.id!=="a");saveLocal();await ghPush(false)});
  const t=state.data.items.find(i=>i.id==="a");
  expect(t&&t._x,"no tombstone went up, so the delete is only local").toBe(1);
  const out=await page.evaluate(async()=>{await ghPull(true);return S.items.map(i=>i.id)});
  expect(out).toEqual(["b"]);
});

/* ---------------- the clock ---------------- */

test("a device with the wrong clock cannot win or lose on that alone",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB",{qty:1})])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(()=>{S.items.find(i=>i.id==="a").qty=4;saveLocal()});
  // their file claims to be from the year 2099, but their counter is behind ours
  state.data.savedAt="2099-01-01T00:00:00.000Z";
  const out=await page.evaluate(async()=>{await ghPush(false);
    return {qty:S.items.find(i=>i.id==="a").qty,n:S.conflicts.length}});
  expect(out.qty,"a date in a file decided a merge").toBe(4);
  expect(out.n).toBe(0);
});

test("a stored expiry date that has passed warns, it does not claim saving has stopped",async({page})=>{
  const state={sha:"sha1",data:file([])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  const out=await page.evaluate(()=>{
    S.ghExp="2000-01-01"; SET_SEC=null; view="data"; renderData();
    return {txt:document.querySelector("#v-data").textContent, tokenBad};
  });
  expect(out.txt).toContain("may have expired");
  expect(out.txt).not.toContain("saving stopped");
  expect(out.tokenBad,"the clock stopped sync without GitHub saying so").toBe(false);
});

/* ---------------- the token ---------------- */

test("a lapsed token says so, stops retrying, and keeps the work queued",async({page})=>{
  const state={sha:"sha1",data:file([])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  state.status=401;
  const out=await page.evaluate(async()=>{
    S.items.push({id:"late",name:"Typed after it lapsed",qty:1,cat:"A",cls:"Consumable",loc:""});
    save();                                      // queues a push
    await ghPush(false);
    return {err:syncErr,tokenBad,dirty,
            bar:(document.querySelector("#syncbar")||{}).textContent||""};
  });
  expect(out.err).toContain("Token rejected");
  expect(out.tokenBad).toBe(true);
  expect(out.dirty,"the queued work was quietly dropped").toBe(true);
  expect(out.bar).toContain("expired or been revoked");
  expect(out.bar).toContain("safe on this device");
  const puts=state.puts.length, gets=state.gets;
  await page.waitForTimeout(400);
  expect(state.gets,"it kept hammering a dead token on a retry timer").toBe(gets);
  expect(state.puts.length).toBe(puts);
  const back=await page.evaluate(()=>{SET_SEC="sync";view="data";renderData();
    return !!document.querySelector("#ght")});
  expect(back,"there is no way back in without redoing the whole setup").toBe(true);
});

test("pasting a new token pushes everything that piled up behind the old one",async({page})=>{
  const state={sha:"sha1",data:file([])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  state.status=401;
  await page.evaluate(async()=>{
    S.items.push({id:"late",name:"Queued",qty:1,cat:"A",cls:"Consumable",loc:""});
    saveLocal(); await ghPush(false)});
  state.status=0;
  const out=await page.evaluate(async()=>{
    SET_SEC="sync"; view="data"; renderData();
    document.querySelector("#ght").value="a-fresh-token";
    document.querySelector("#ghconnect").click();
    await new Promise(r=>setTimeout(r,600));
    return {tokenBad,err:syncErr};
  });
  expect(out.tokenBad).toBe(false);
  expect(state.data.items.find(i=>i.id==="late"),"the queued work never went up").toBeTruthy();
});

test("the token expiry comes from GitHub, so nobody has to type it",async({page})=>{
  const state={sha:"sha1",data:file([]),expires:"2027-03-04 23:59:59 UTC"};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  const out=await page.evaluate(()=>({exp:S.ghExp,auto:S.ghAuto}));
  expect(out.exp).toBe("2027-03-04");
  expect(out.auto).toBe(true);
});

test("connecting asks for three things and never asks which copy survives",async({page})=>{
  const state={sha:"sha1",data:file([it("theirs","From the repo",5,"devB")])};
  await page.route(FILE,remote(state));
  await open(page);
  const out=await page.evaluate(async()=>{
    S.items=[{id:"mine",name:"Typed before connecting",qty:1,cat:"A",cls:"Consumable",loc:""}];
    saveLocal();
    SET_SEC="sync"; view="data"; renderData();
    const fields=[...document.querySelectorAll("#v-data input")].map(i=>i.id);
    document.querySelector("#gho").value="unit";
    document.querySelector("#ghr").value="van-data";
    document.querySelector("#ght").value="test-token-not-a-real-one";
    document.querySelector("#ghconnect").click();
    await new Promise(r=>setTimeout(r,800));
    return {fields,ids:S.items.map(i=>i.id).sort(),
            asked:document.body.textContent.includes("pick which one survives")};
  });
  expect(out.fields).toEqual(["gho","ghr","ght"]);
  expect(out.asked,"the choose-a-side dialog is still reachable").toBe(false);
  expect(out.ids,"connecting dropped one side").toEqual(["mine","theirs"]);
  expect(state.data.items.map(i=>i.id).sort()).toEqual(["mine","theirs"]);
});

/* ---------------- GitHub's limits ---------------- */

test("a push with nothing new makes no commit",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  const puts=state.puts.length;
  const out=await page.evaluate(async()=>{
    S.curLoc=""; save();                        // a save that touches nothing that syncs
    const r=await ghPush(false);
    return {r,dirty,err:syncErr}});
  expect(out.r).toBe("ok");
  expect(state.puts.length,"a commit was made with nothing in it").toBe(puts);
  expect(out.dirty).toBe(false);
  expect(out.err).toBe("");
  // and a real change still goes up
  await page.evaluate(async()=>{S.items.find(i=>i.id==="a").qty=8; save(); await ghPush(false)});
  expect(state.puts.length).toBe(puts+1);
  expect(state.data.items.find(i=>i.id==="a").qty).toBe(8);
});

for(const [name,status,headers] of [
  ["a 403 that says the rate limit is used up",403,{"x-ratelimit-remaining":"0","x-ratelimit-reset":String(Math.floor(Date.now()/1000)+1)}],
  ["a 403 with retry-after",403,{"retry-after":"1"}],
  ["a 429",429,{"retry-after":"1"}]]){
  test(name+" waits and retries instead of calling the token dead",async({page})=>{
    const state={sha:"sha1",data:file([])};
    await page.route(FILE,remote(state));
    await connected(page,"devA");
    state.status=status;
    state.headers=Object.assign({"access-control-expose-headers":"retry-after, x-ratelimit-remaining, x-ratelimit-reset"},headers);
    const out=await page.evaluate(async()=>{
      S.items.push({id:"slow",name:"Typed during a busy hour",qty:1,cat:"A",cls:"Consumable",loc:""});
      save(); await ghPush(false);
      return {tokenBad,err:syncErr,dirty,bar:(document.querySelector("#syncbar")||{}).textContent||""}});
    expect(out.tokenBad,"a rate limit was taken for a dead token").toBe(false);
    expect(out.bar).not.toContain("expired");
    expect(out.err).toContain("slow down");
    expect(out.dirty).toBe(true);
    state.status=0;
    await expect.poll(()=>!!state.data.items.find(i=>i.id==="slow"),
      {message:"it never tried again after the wait",timeout:8000}).toBe(true);
  });
}

test("a plain 403 is still a token that cannot write",async({page})=>{
  const state={sha:"sha1",data:file([])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  state.status=403;
  const out=await page.evaluate(async()=>{
    S.items.push({id:"x",name:"X",qty:1,cat:"A",cls:"Consumable",loc:""}); save();
    await ghPush(false); return tokenBad});
  expect(out).toBe(true);
});

/* ---------------- the file itself ---------------- */

test("a file that will not open is reported and never written over",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  state.raw=Buffer.from('{"items":[{"id":"a","na').toString("base64");   // truncated
  const before=state.puts.length;
  const out=await page.evaluate(async()=>{
    S.items.push({id:"mine",name:"Mine",qty:1,cat:"A",cls:"Consumable",loc:""}); saveLocal();
    await ghPush(false);
    return {badFile,err:syncErr,ids:S.items.map(i=>i.id).sort(),
            bar:(document.querySelector("#syncbar")||{}).textContent||""}});
  expect(out.badFile).toBe(true);
  expect(out.err).toContain("can't be read");
  expect(state.puts.length,"it wrote over a file it could not read").toBe(before);
  expect(out.ids,"local work was touched by an unreadable remote").toEqual(["a","mine"]);
  expect(out.bar).toContain("Nothing has been overwritten");
});

test("replacing an unreadable file is a deliberate, separate act",async({page})=>{
  const state={sha:"sha1",data:file([])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  state.raw=Buffer.from("not json at all").toString("base64");
  await page.evaluate(async()=>{
    S.items.push({id:"mine",name:"Mine",qty:1,cat:"A",cls:"Consumable",loc:""});
    saveLocal(); await ghPush(false)});
  const out=await page.evaluate(async()=>{await ghPush(true);return {badFile,ids:S.items.map(i=>i.id)}});
  expect(out.ids).toEqual(["mine"]);
  expect(state.data.items.find(i=>i.id==="mine"),"the explicit replace did not go through").toBeTruthy();
});

test("a missing file is a first sync, not an error",async({page})=>{
  const state={sha:"sha1",missing:true,data:file([])};
  await page.route(FILE,remote(state));
  await open(page);
  const out=await page.evaluate(async()=>{
    S.gh={owner:"unit",repo:"van-data",path:"data.json",token:"t",sha:"",last:""};
    S.items=[{id:"mine",name:"Mine",qty:1,cat:"A",cls:"Consumable",loc:""}]; saveLocal();
    const r=await ghPull(true);
    return {r,err:syncErr};
  });
  expect(out.r).toBe("empty");
  expect(out.err).toBe("");
});

/* ---------------- yesterday's build, still in a van ---------------- */

test("an old build's whole-file push cannot delete anything, because absence is not deletion",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB"),it("b","Swabs",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(async()=>{
    S.items.push({id:"new",name:"Added on the new build",qty:1,cat:"A",cls:"Consumable",loc:""});
    saveLocal(); await ghPush(false);
  });
  // an old build now pulls, edits, and pushes its own whole file — no stamps at all, and the
  // record it never learned about simply missing
  state.data={items:[{id:"a",name:"Gloves",qty:5,cat:"A",cls:"Consumable",loc:""},
                     {id:"b",name:"Swabs",qty:1,cat:"A",cls:"Consumable",loc:""}],
              comps:[],forms:[],walls:{},demo:false,savedAt:new Date().toISOString()};
  const out=await page.evaluate(async()=>{await ghPull(true);
    return {ids:S.items.map(i=>i.id).sort(),a:S.items.find(i=>i.id==="a").qty}});
  expect(out.ids,"the old build's stale file deleted a record").toEqual(["a","b","new"]);
  expect(out.a,"the old build's edit did not propagate").toBe(5);
  await page.evaluate(()=>ghPush(false));
  expect(state.data.items.map(i=>i.id).sort(),"the repo was not healed").toEqual(["a","b","new"]);
});

test("a tombstone survives a round trip through an old build and is invisible to its filters",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB"),it("b","Swabs",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  await page.evaluate(async()=>{S.items=S.items.filter(i=>i.id!=="a");saveLocal();await ghPush(false)});
  const t=state.data.items.find(i=>i.id==="a");
  // an old build copies the array wholesale, so the tombstone rides through untouched...
  expect(t._x).toBe(1);
  // ...and its own lists exclude it: live() drops "Not carried", gaps() and requests() drop
  // "deliberate", so an old build shows nothing at all for a deleted item
  expect(t.status).toBe("Not carried");
  expect(t.gapType).toBe("deliberate");
  const hidden=await page.evaluate(items=>{
    S.items=items;
    return {live:live().length,gaps:gaps().length,requests:requests().length};
  },state.data.items);
  expect(hidden.live).toBe(1);
  expect(hidden.gaps).toBe(0);
  expect(hidden.requests).toBe(0);
});

test("a tombstone is dropped once it is far older than any device could be offline",async({page})=>{
  const state={sha:"sha1",data:file([it("b","Swabs",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  const out=await page.evaluate(async()=>{
    S.tomb.items.stale={_v:2,_d:"devB",_t:new Date(Date.now()-200*86400000).toISOString()};
    S.tomb.items.fresh={_v:2,_d:"devB",_t:new Date(Date.now()-3*86400000).toISOString()};
    await ghPush(false);
    return Object.keys(S.tomb.items).sort();
  });
  expect(out).toEqual(["fresh"]);
  expect(state.data.items.map(i=>i.id).sort()).toEqual(["b","fresh"]);
});

/* ---------------- storage that refuses to keep anything ---------------- */

test("sync still works when the device refuses to write to storage",async({page})=>{
  const state={sha:"sha1",data:file([it("a","Gloves",3,"devB")])};
  await page.route(FILE,remote(state));
  await connected(page,"devA");
  const out=await page.evaluate(async()=>{
    localStorage.setItem=()=>{throw new Error("QuotaExceededError")};
    S.items.push({id:"mem",name:"Typed with storage full",qty:1,cat:"A",cls:"Consumable",loc:""});
    save();
    await ghPush(false);
    return {ids:S.items.map(i=>i.id).sort(),err:syncErr};
  });
  expect(out.err).toBe("");
  expect(out.ids).toEqual(["a","mem"]);
  expect(state.data.items.find(i=>i.id==="mem"),"the one copy that could survive never went up").toBeTruthy();
});

/* ---------------- what is deliberately not synced ---------------- */

test("scene material stays on the device and never reaches the repo",async({page})=>{
  const state={sha:"sha1",data:file([])};
  await page.route(FILE,remote(state));
  await connected(page,"devA","scenes");
  await page.evaluate(async()=>{
    const inc=newIncident(); inc.caseNo="26-004411";
    const sk={id:"sk"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      objs:[],layers:[],when:new Date().toISOString(),v:4};
    (S.sketches=S.sketches||[]).push(sk); sk.incidentId=inc.id; curSketch=sk.id; addObj("refpoint");
    newFill(S.forms[0]);
    saveLocal(); await ghPush(false);
  });
  expect(JSON.stringify(state.data)).not.toContain("26-004411");
  expect(state.data.incidents).toBeUndefined();
  expect(state.data.sketches).toBeUndefined();
  expect(state.data.fills).toBeUndefined();
  (state.data.forms||[]).forEach(f=>expect(f.fills).toBeUndefined());
});
