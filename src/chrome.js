/* ---------- the furniture both apps share ----------
   the sheet and the confirm dialog, the photo store, handing the browser a file, theme and
   display mode, the rotation gate, and the claim on persistent storage ---------- */
// photographs live in IndexedDB, not localStorage — they would blow its 5 MB ceiling
const PDB={name:"vanphotos",store:"p",_db:null};
function photoDB(){
  if(PDB._db)return Promise.resolve(PDB._db);
  return new Promise((res,rej)=>{
    const rq=indexedDB.open(PDB.name,1);
    rq.onupgradeneeded=()=>{const db=rq.result;
      if(!db.objectStoreNames.contains(PDB.store))db.createObjectStore(PDB.store)};
    rq.onsuccess=()=>{PDB._db=rq.result;res(rq.result)};
    rq.onerror=()=>rej(new Error("Could not open photo storage"));
  });
}
function photoOp(mode,fn){
  return photoDB().then(db=>new Promise((res,rej)=>{
    const tx=db.transaction(PDB.store,mode), st=tx.objectStore(PDB.store);
    const rq=fn(st);
    rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error);
  }));
}
const photoPut=(id,data)=>photoOp("readwrite",st=>st.put(data,id));
const photoGet=id=>photoOp("readonly",st=>st.get(id));
const photoDel=id=>photoOp("readwrite",st=>st.delete(id));
const photoKeys=()=>photoOp("readonly",st=>st.getAllKeys());

function dlBlob(blob,name){
  const u=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
}


let storageState={asked:false,persisted:false,known:false,used:0,quota:0};
async function claimStorage(){
  try{
    if(navigator.storage&&navigator.storage.persisted){
      storageState.persisted=await navigator.storage.persisted();
      if(!storageState.persisted&&navigator.storage.persist)
        storageState.persisted=await navigator.storage.persist();
      storageState.known=true;
    }
    if(navigator.storage&&navigator.storage.estimate){
      const e=await navigator.storage.estimate();
      storageState.used=e.usage||0; storageState.quota=e.quota||0;
    }
  }catch(e){}
  storageState.asked=true;
  renderKeepBar();
  if(view==="data"&&typeof renderData==="function")renderData();
}
// The app's record and everything else in localStorage share a ceiling of about 5 MB, measured,
// not assumed (HANDOFF.md). Photographs live in IndexedDB, whose much larger quota comes from
// navigator.storage.estimate(). At LS_WARN of the ceiling Home and Scenes say so, before a save
// is refused and work stops being kept.
const LS_CEIL=5*1024*1024, LS_WARN=0.7;
function lsBytes(){
  let n=0;
  try{ for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||""; n+=k.length+(localStorage.getItem(k)||"").length} }catch(_){}
  return n;
}
const lsShare=()=>lsBytes()/LS_CEIL;
const fmtBytes=n=>n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";
function storageMeterHTML(){
  const used=lsBytes(), pct=Math.min(100,Math.round(used/LS_CEIL*100)), warn=used/LS_CEIL>=LS_WARN;
  return `<div class="kv" style="margin-bottom:6px">
      <div><dt>The app's record</dt><dd>${fmtBytes(used)} of about 5 MB <span class="${warn?"warnpill":"okpill"}">${pct}%</span></dd></div></div>
    <div class="meter${warn?" warn":""}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="The app's record"><i style="width:${pct}%"></i></div>
    ${storageState.quota?`<div class="kv" style="margin:10px 0 6px"><div><dt>Photographs and everything else</dt><dd>${fmtBytes(storageState.used)} of ${fmtBytes(storageState.quota)}</dd></div></div>`:""}
    <p class="hint" style="margin:6px 0 10px">${warn
      ?"The app's record is nearly full. When it is full, changes stop being saved. Remove closed cases that already have a case package to make room."
      :"Incidents, forms and sketches are kept in the app's record, which holds about 5 MB. Photographs are kept separately and have much more room."}</p>
    <button class="btn sec" id="storefree" style="max-width:none;margin:0">Remove closed cases that already have a case package</button>`;
}
// one line for Home and Scenes when the record is nearly full
const storageWarnText=()=>lsShare()>=LS_WARN?"Storage is "+Math.round(lsShare()*100)+"% full. Remove closed cases that already have a case package":"";

// Safari (and every browser on an iPad or iPhone) deletes everything a site has stored once it
// has gone seven days without being opened, unless it runs from the Home Screen. Everything
// here, sketches and photographs included, lives only in that storage. So on those devices,
// until the browser has agreed to keep it and while the app is not running from the Home Screen,
// a bar says so and stays until one of those changes. Other browsers only clear storage when the
// disk runs short, which Settings › This device explains; a permanent bar there would be noise.
const onApple=()=>{const ua=navigator.userAgent||"";
  return /iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)
    ||(/Safari\//.test(ua)&&!/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(ua))};
function renderKeepBar(){
  try{
    const b=document.getElementById("keepbar"); if(!b)return;
    const show=onApple()&&storageState.known&&!storageState.persisted&&!isStandalone();
    if(!show){b.style.display="none";b.innerHTML="";if(typeof fitHeader==="function")fitHeader();return}
    b.innerHTML=`<span><b>Safari can delete everything in this app.</b> If it is not opened for 7 days, Safari clears what it has stored on this device, including sketches and photographs not yet saved as a case package. To stop that, add it to the Home Screen: tap Share, then Add to Home Screen, and open it from the new icon.</span>
      <button id="keephow">How</button>`;
    b.style.display="";
    $("#keephow").onclick=()=>{ if(typeof openSettings==="function")openSettings("device") };
    if(typeof fitHeader==="function")fitHeader();
  }catch(_){}
}

const SHEETABLE='button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
const sheetStops=()=>[...$("#sheet").querySelectorAll(SHEETABLE)].filter(e=>!e.disabled&&e.offsetParent!==null);
function openSheet(html){$("#sheetbody").innerHTML=html;$("#scrim").classList.add("on");
  const f=()=>{if($("#scrim").classList.contains("on")){$("#sheet").classList.add("on");
    const st=sheetStops(); if(st.length&&!$("#sheet").contains(document.activeElement))st[0].focus()}};
  typeof requestAnimationFrame==="function"?requestAnimationFrame(f):setTimeout(f,16)}
// while a sheet is up it is the only thing on screen, so the keyboard stays inside it
document.addEventListener("keydown",e=>{
  if(e.key!=="Tab")return;
  const sh=$("#sheet"); if(!sh||!sh.classList.contains("on"))return;
  const st=sheetStops(); if(!st.length)return;
  const first=st[0], last=st[st.length-1], here=document.activeElement;
  if(!sh.contains(here)){e.preventDefault();(e.shiftKey?last:first).focus();return}
  if(!e.shiftKey&&here===last){e.preventDefault();first.focus()}
  else if(e.shiftKey&&here===first){e.preventDefault();last.focus()}
});
function askConfirm(title,body,label,danger,fn){
  openSheet(`<h3>${esc(title)}</h3>
    <p style="margin:0 0 16px;color:var(--ink2);font-size:14.5px;line-height:1.5">${esc(body)}</p>
    <button class="btn${danger?" sec":""}" id="cfyes" style="max-width:none;margin:0${danger?";color:var(--red);border-color:var(--red)":""}">${esc(label)}</button>
    <button class="btn sec" id="cfno" style="max-width:none">Cancel</button>`);
  $("#cfno").onclick=closeSheet;
  $("#cfyes").onclick=()=>{closeSheet();fn()};
}
function closeSheet(){$("#sheet").classList.remove("on");$("#scrim").classList.remove("on")}
$("#scrim").onclick=closeSheet;

/* ---- landscape only on a tablet ---- */
const isTablet=()=>Math.min(screen.width||innerWidth||0,screen.height||innerHeight||0)>=700;
const isIPadLike=()=>/iPad/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
function landscapeOnly(){ return S.landscapeOnly==null?isIPadLike():!!S.landscapeOnly }
function applyRotLock(){
  const on=landscapeOnly()&&isTablet();
  document.body.classList.toggle("rotlock",on);
  try{ if(on&&screen.orientation&&screen.orientation.lock)screen.orientation.lock("landscape").catch(()=>{}) }catch(e){}
}
window.addEventListener("resize",applyRotLock);
window.addEventListener("orientationchange",applyRotLock);


const mq=q=>!!(window.matchMedia&&window.matchMedia(q).matches);
function applyTheme(){
  const t=S.theme||"auto";
  const r=document.documentElement;
  r.classList.toggle("theme-dark",t==="dark");
  r.classList.toggle("theme-light",t==="light");
}
function applyMode(){
  const m=S.mode||"auto";
  const w1 = m==="desktop" || (m!=="phone" && mq("(min-width:820px)"));
  const w2 = m==="desktop" || (m!=="phone" && mq("(min-width:1000px)"));
  document.body.classList.toggle("wide",w1);
  document.body.classList.toggle("xwide",w2);
  applySideMin();
}

// always-on save status beside the title: one dot and a few words, never a flash
function savedTick(){ renderStatus() }
function renderStatus(){
  try{ const el=document.getElementById("savedtick"); if(!el)return;
    const sync=typeof ghOn==="function"&&ghOn();
    const offline=typeof navigator!=="undefined"&&navigator.onLine===false;
    let k,t;
    if(typeof SAVEFAIL!=="undefined"&&SAVEFAIL){k="bad";t="Not saving"}
    else if(sync&&(tokenBad||badFile||conflict||syncErr)){k="bad";t="Not syncing"}
    else if(sync&&offline){k="warn";t="Offline, saved here"}
    else if(sync&&dirty){k="busy";t="Saving\u2026"}
    else if(sync&&S.gh.last){k="ok";t="Synced "+new Date(S.gh.last).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
    else if(sync){k="busy";t="Not synced yet"}
    else {k="local";t="Saved on this device"}
    const sh={"Saved on this device":"Saved","Offline, saved here":"Offline","Not synced yet":"Not synced"}[t]||t.replace(/^Synced /,"");
    el.className="savedtick on st-"+k; el.title=t; el.innerHTML=`<i></i><span class="stl">${t}</span><span class="sts">${sh}</span>`;
  }catch(_){}
}

const isStandalone=()=>!!((window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone);

/* ---- nothing fails silently, and both pages install ---- */
/* 2. nothing fails silently: a toast for the user, a list for whoever maintains the app */
function logErr(msg){
  try{ S.errors=(S.errors||[]).slice(-19);
    S.errors.push({t:new Date().toISOString(),m:String(msg).slice(0,300),v:typeof view==="string"?view:""});
    saveLocal() }catch(_){}
  try{ toast("Something went wrong and that last action may not have taken. It is noted under Settings.") }catch(_){}
}
window.addEventListener("error",e=>logErr((e.message||"Error")+" at "+String(e.filename||"").split("/").pop()+":"+(e.lineno||0)));
window.addEventListener("unhandledrejection",e=>logErr("Promise: "+((e.reason&&e.reason.message)||e.reason)));

/* 3. installable: a service worker when served over http, so it opens from the home screen and works offline */
// the worker's cache, named in sw.js and copied here by build.js
const FSU_CACHE="__FSU_CACHE__";
if("serviceWorker" in navigator&&/^https?:/.test(location.protocol)){
  try{ navigator.serviceWorker.register("sw.js").catch(()=>{}) }catch(_){}
  // the page opened from the cache and a newer version has since arrived: offer a reload, and
  // leave the moment to the technician rather than reloading under them
  try{ navigator.serviceWorker.addEventListener("message",e=>{ if(e.data&&e.data.fsu==="updated")showUpdated() }) }catch(_){}
}
function showUpdated(){
  if(document.getElementById("updbar"))return;
  const b=document.createElement("div"); b.id="updbar"; b.setAttribute("role","status");
  b.innerHTML=`<span>Updated. Reload to use the new version.</span><button id="updreload">Reload</button><button id="updlater" aria-label="Later">Later</button>`;
  document.body.appendChild(b);
  $("#updreload").onclick=()=>location.reload();
  $("#updlater").onclick=()=>b.remove();
}

