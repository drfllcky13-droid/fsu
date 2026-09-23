/* ---------- github sync ---------- */
if(!S.gh)S.gh={owner:"",repo:"",path:"data.json",token:"",sha:"",last:""};
// merging needs three things per record: a counter that does not consult the clock, the
// device that set it, and a marker when it is deleted. SYNC_DESIGN.txt is the long version.
if(!S.dev)S.dev=newId();
if(typeof S.lam!=="number")S.lam=0;
const KINDS=["items","comps","forms"];
const kKey=(k,r)=>k==="comps"?r.code:r.id;
if(!S.tomb||typeof S.tomb!=="object")S.tomb={};
if(!S.base||typeof S.base!=="object")S.base={};
KINDS.forEach(k=>{if(!S.tomb[k]||typeof S.tomb[k]!=="object")S.tomb[k]={};
  if(!S.base[k]||typeof S.base[k]!=="object")S.base[k]={}});
if(!Array.isArray(S.conflicts))S.conflicts=[];
let dirty=false, pushT=null, conflict=false, syncErr="", tokenBad=false, badFile=false;

// content hash, ignoring the _ stamps and the order the keys happen to sit in, so that
// stamping a record does not itself look like an edit
const canon=v=>Array.isArray(v)?"["+v.map(canon).join(",")+"]"
  :(v&&typeof v==="object")?"{"+Object.keys(v).filter(x=>x[0]!=="_").sort()
      .map(x=>x+":"+canon(v[x])).join(",")+"}"
  :JSON.stringify(v===undefined?null:v);
const hash=s=>{let h=5381,g=52711;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h=((h*33)^c)>>>0;g=((g*31)+c)>>>0}
  return h.toString(36)+"."+g.toString(36)};
const rhash=r=>hash(canon(r));
// the same arbitrary answer on every device, so they all converge without talking
const newerRec=(a,b)=>{const av=(a&&a._v)||0, bv=(b&&b._v)||0;
  return av!==bv?av>bv:String((a&&a._d)||"")>String((b&&b._d)||"")};

// stamp whatever has moved since the last sync, and raise a tombstone for whatever has
// gone. Done here rather than at the several hundred places that mutate a record and call
// save(), because one forgotten site there is a silent hole.
function stampDirty(){
  const changed={};
  KINDS.forEach(k=>{
    const b=S.base[k], T=S.tomb[k], ch=changed[k]={}, seen={};
    S[k].forEach(r=>{
      const key=kKey(k,r); if(key==null||key==="")return;
      seen[key]=1; if(T[key])delete T[key];
      const h=rhash(r);
      if(b[key]!==h){r._v=++S.lam;r._d=S.dev;ch[key]=1}
      else if(r._v==null){r._v=++S.lam;r._d=S.dev}
    });
    Object.keys(b).forEach(key=>{
      if(seen[key])return;
      T[key]={_v:++S.lam,_d:S.dev,_t:new Date().toISOString()};
      ch[key]=1; delete b[key];
    });
  });
  const wh=rhash(S.walls||{});
  if(S.base.walls!==wh){S.wallsV=++S.lam;S.wallsD=S.dev;changed.walls=1}
  return changed;
}
function rebase(){
  KINDS.forEach(k=>{const b=S.base[k]={};
    S[k].forEach(r=>{const key=kKey(k,r); if(key!=null&&key!=="")b[key]=rhash(r)})});
  S.base.walls=rhash(S.walls||{});
}
// the edit that lost, kept where the person who typed it can put it back
function stashLoser(k,key,mine){
  S.conflicts.push({k,key,when:new Date().toISOString(),
    name:String(mine.name||mine.code||key),
    rec:JSON.parse(JSON.stringify(mine))});
  if(S.conflicts.length>50)S.conflicts.splice(0,S.conflicts.length-50);
}

// on the wire tombstones ride inside the arrays, so a build that predates them carries
// them through instead of dropping them, and shaped so that build's own filters hide them
const TOMBSHAPE={items:{name:"",status:"Not carried",gapType:"deliberate",cat:"",cls:"Consumable",
    loc:"",qty:0,par:"",date:"",note:"",steps:[],uses:[],rel:[],links:[]},
  comps:{desc:"",side:"",x:null,y:null,w:6,h:4},
  forms:{name:"",cat:"",rev:"",desc:"",fields:[]}};
const TOMBDAYS=90;
function splitWire(k,arr,alive,tomb){
  (Array.isArray(arr)?arr:[]).forEach(r=>{
    if(!r||typeof r!=="object")return;
    const key=kKey(k,r); if(key==null||key==="")return;
    if(r._x)tomb[key]={_v:+r._v||0,_d:r._d||"",_t:r._t||""};
    else alive[key]=r;
  });
}
function joinWire(k){
  const out=S[k].slice(), T=S.tomb[k], cut=Date.now()-TOMBDAYS*86400000;
  Object.keys(T).forEach(key=>{
    const t=T[key], when=Date.parse(t._t||"")||Date.now();
    if(when<cut)return delete T[key];
    out.push(Object.assign({},TOMBSHAPE[k],k==="comps"?{code:key}:{id:key},
      {_x:1,_v:t._v,_d:t._d,_t:t._t}));
  });
  return out;
}
function applyRec(k,key,stamp,alive){
  const i=S[k].findIndex(r=>kKey(k,r)===key);
  if(alive){ delete S.tomb[k][key];
    if(i>-1)S[k][i]=alive; else S[k].push(alive) }
  else { S.tomb[k][key]={_v:stamp._v||0,_d:stamp._d||"",_t:stamp._t||new Date().toISOString()};
    if(i>-1)S[k].splice(i,1) }
}
// merge a parsed remote file into this device, record by record. Absence is never a
// deletion — only a tombstone deletes — which is what stops an old build's whole-file
// push from destroying anything. Returns true if we hold something the remote does not.
function mergeRemote(o){
  const changed=stampDirty();
  let maxv=+o.lam||0, ahead=false;
  // a device that has never synced has no claim that its copy is the newer one, and the
  // stamps it just gave its own seeded defaults would otherwise beat the repo's real van.
  // Local-only records still survive: the merge is a union either way.
  const virgin=!S.synced;
  KINDS.forEach(k=>{
    const ra={}, rt={};
    splitWire(k,o[k],ra,rt);
    const T=S.tomb[k], b=S.base[k], ch=changed[k], mine={};
    S[k].forEach(r=>{const key=kKey(k,r); if(key!=null&&key!=="")mine[key]=r});
    const keys={};
    [mine,T,ra,rt].forEach(m=>Object.keys(m).forEach(key=>keys[key]=1));
    Object.keys(keys).forEach(key=>{
      const lv=mine[key]||T[key], rv=ra[key]||rt[key];
      maxv=Math.max(maxv,(rv&&+rv._v)||0,(lv&&+lv._v)||0);
      if(!rv){ahead=true;return}                      // never reached them: keep ours
      if(!lv){applyRec(k,key,rv,ra[key]);return}
      if(virgin){applyRec(k,key,rv,ra[key]);return}
      const rH=ra[key]?rhash(ra[key]):-1, lH=mine[key]?rhash(mine[key]):-1;
      if(rH===lH)return;                              // the same record: nothing to settle
      // who moved is decided on content, not on the stamps, so an edit made by a build that
      // does not know about stamps still propagates
      const based=b[key]!=null, theyMoved=!based||rH!==b[key], weMoved=!!ch[key];
      if(weMoved&&!theyMoved){ahead=true;return}
      if(theyMoved&&!weMoved){applyRec(k,key,rv,ra[key]);return}
      if(!newerRec(rv,lv)){ahead=true;return}
      // both sides moved on from the copy we last synced, so the one about to be replaced
      // is somebody's real work: keep it rather than drop it
      if(based&&mine[key])stashLoser(k,key,mine[key]);
      applyRec(k,key,rv,ra[key]);
    });
  });
  if(o.walls&&(virgin||newerRec({_v:+o.wallsV||0,_d:o.wallsD||""},{_v:S.wallsV||0,_d:S.wallsD||""}))){
    S.walls=o.walls; S.wallsV=+o.wallsV||0; S.wallsD=o.wallsD||"";
  } else if(o.wallsV!=null&&(S.wallsV||0)>(+o.wallsV||0)) ahead=true;
  maxv=Math.max(maxv,+o.wallsV||0);
  S.lam=Math.max(S.lam,maxv);                          // Lamport receive
  S.synced=true;
  S.demo=S.items.some(i=>i.demo)||S.comps.some(c=>c.demo)||S.forms.some(f=>f.demo);
  if(S.curLoc&&!S.comps.some(c=>c.code===S.curLoc))S.curLoc="";
  return ahead;
}

const b64enc=s=>{const b=new TextEncoder().encode(s);let out="";
  for(let i=0;i<b.length;i+=8192)out+=String.fromCharCode.apply(null,b.subarray(i,i+8192));
  return btoa(out)};
const b64dec=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,"")),c=>c.charCodeAt(0)));
const ghOn=()=>!!(S.gh.owner&&S.gh.repo&&S.gh.token);
const ghURL=()=>`https://api.github.com/repos/${S.gh.owner}/${S.gh.repo}/contents/${S.gh.path||"data.json"}`;
const ghHead=()=>({Authorization:"Bearer "+S.gh.token,Accept:"application/vnd.github+json",
  "X-GitHub-Api-Version":"2022-11-28"});
const payload=()=>({v:2,lam:S.lam,items:joinWire("items"),comps:joinWire("comps"),
  forms:joinWire("forms").map(f=>{const c=Object.assign({},f);delete c.fills;return c}),
  walls:S.walls,wallsV:S.wallsV||0,wallsD:S.wallsD||"",demo:S.demo,
  savedAt:new Date().toISOString()});

const ghErr=s=>{const e=new Error(s===401?"Token rejected":s===403?"No access to that repo"
  :"GitHub error "+s); e.status=s; return e};
// GitHub tells us when the token dies, so nobody has to type the date in
function ghExpFrom(r){
  try{const h=r&&r.headers&&r.headers.get&&r.headers.get("github-authentication-token-expiration");
    if(!h)return; const d=String(h).slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(d)){S.ghExp=d;S.ghAuto=true}
  }catch(e){}
}
async function ghGet(){
  const r=await fetch(ghURL()+"?ref=HEAD&t="+Date.now(),{headers:ghHead(),cache:"no-store"});
  ghExpFrom(r);
  if(r.status===404)return {missing:true};
  if(!r.ok)throw ghErr(r.status);
  const j=await r.json();
  let o=null; try{o=JSON.parse(b64dec(j.content))}catch(e){}
  // a file we cannot read is not a file we may write over: if the remote is intact and our
  // parse is what broke, overwriting it would take out every other device
  if(!o||typeof o!=="object"||!Array.isArray(o.items))return {sha:j.sha,bad:true};
  return {sha:j.sha,data:o};
}
function syncFail(e,silent){
  if(e&&(e.status===401||e.status===403)){
    tokenBad=true; syncErr=e.message; retries=0; clearTimeout(pushT);
    store.set(S); renderSyncBar(); renderSyncPill(); if(view==="data")renderData();
    if(!silent)toast(e.message);
    return "error";
  }
  syncErr=(e&&e.message)||"Couldn't reach GitHub";
  store.set(S); renderSyncBar(); renderSyncPill();
  if(dirty){clearTimeout(pushT); pushT=setTimeout(()=>ghPush(false),retryIn())}
  if(!silent)toast(syncErr);
  return "error";
}
// a pull can no longer discard anything local, so it is safe to press at any time
async function ghPull(silent){
  if(!ghOn())return;
  try{
    const g=await ghGet();
    if(g.missing){S.gh.sha="";store.set(S);
      if(!silent)toast("No data file yet — sync to create it");return"empty"}
    if(g.bad){badFile=true;syncErr="The file in the repo can't be read";
      store.set(S);renderSyncBar();renderSyncPill();if(view==="data")renderData();
      if(!silent)toast(syncErr);return"error"}
    badFile=false;
    const ahead=mergeRemote(g.data);
    S.gh.sha=g.sha; S.gh.last=new Date().toISOString();
    tokenBad=false; conflict=false; syncErr=""; retries=0;
    rebase(); dirty=!!ahead; store.set(S);
    renderSyncBar(); renderSyncPill(); render();
    if(ahead)queuePush(); else clearTimeout(pushT);
    if(!silent)toast("Synced — "+live().length+" items");
    return"ok";
  }catch(e){return syncFail(e,silent)}
}
// read, merge, write. A 409 means somebody wrote in the gap between the read and the
// write, which is a reason to merge again, not a reason to ask anyone anything.
async function ghPush(force){
  if(!ghOn())return;
  clearTimeout(pushT);
  try{
    for(let attempt=0;attempt<4;attempt++){
      const g=await ghGet();
      if(g.bad&&!force){badFile=true;syncErr="The file in the repo can't be read";
        store.set(S);renderSyncBar();renderSyncPill();if(view==="data")renderData();
        toast(syncErr);return"error"}
      badFile=false;
      if(g.data&&!force)mergeRemote(g.data); else stampDirty();
      const body={message:"Van inventory — "+new Date().toISOString().slice(0,16).replace("T"," "),
        content:b64enc(JSON.stringify(payload(),null,1))};
      if(g.sha)body.sha=g.sha;
      const r=await fetch(ghURL(),{method:"PUT",
        headers:Object.assign({"Content-Type":"application/json"},ghHead()),
        body:JSON.stringify(body)});
      ghExpFrom(r);
      if(r.status===409||r.status===422)continue;
      if(!r.ok)throw ghErr(r.status);
      const j=await r.json();
      S.gh.sha=(j.content&&j.content.sha)||"";S.gh.last=new Date().toISOString();
      dirty=false;conflict=false;tokenBad=false;syncErr="";retries=0;
      rebase();store.set(S);
      renderSyncBar();renderSyncPill();if(view==="data")renderData();
      return"ok";
    }
    conflict=true;store.set(S);
    renderSyncBar();renderSyncPill();if(view==="data")renderData();
    toast("Couldn't settle with the other device — try again");
    return"error";
  }catch(e){return syncFail(e,true)}
}
let retries=0;
function retryIn(){retries=Math.min(retries+1,6);return Math.min(60000,2000*Math.pow(2,retries-1))}
function queuePush(){ if(!ghOn()||tokenBad)return; dirty=true; retries=0;
  clearTimeout(pushT); pushT=setTimeout(()=>ghPush(false),2500);
  renderSyncPill(); renderSyncBar(); }
function renderSyncBar(){
  const b=$("#syncbar"); if(!b)return;
  const offline=typeof navigator!=="undefined"&&navigator.onLine===false;
  if(!ghOn()||(!dirty&&!syncErr&&!conflict&&!tokenBad&&!badFile)){
    b.style.display="none";b.innerHTML="";fitHeader();return}
  let msg,cls,btn="Retry";
  if(tokenBad){cls="bad";btn="Reconnect";
    msg="The access token has expired or been revoked. Your changes are safe on this device."}
  else if(badFile){cls="bad";btn="Open Sync";
    msg="The file in the repo can't be read. Nothing has been overwritten."}
  else if(conflict){cls="bad";btn="Open Sync";
    msg="Another device kept writing while this one tried to. Open Sync and try again."}
  else if(offline){cls="warn";btn="";
    msg="No connection. Your changes are saved on this device and will sync when you're back online."}
  else if(syncErr){cls="bad";msg=syncErr+". Retrying — your changes are still saved on this device."}
  else {b.style.display="none";b.innerHTML="";fitHeader();return}
  b.className="demobar "+cls; b.style.display="";
  b.innerHTML=`<span>${esc(msg)}</span>${btn?`<button id="syncnow">${btn}</button>`:""}`;
  fitHeader();
}
function renderSyncPill(){
  if(typeof renderStatus==="function")renderStatus();
  const el=$("#syncpill"); if(!el)return;
  el.textContent=tokenBad?"Token expired":badFile?"Can't read":conflict?"Busy":
    dirty?"Saving…":S.gh.last?"Synced "+S.gh.last.slice(11,16):"Not synced";
  el.className="syncpill"+(tokenBad||badFile||conflict?" bad":dirty?" busy":"");
}

