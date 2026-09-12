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


let storageState={asked:false,persisted:false,used:0,quota:0};
async function claimStorage(){
  try{
    if(navigator.storage&&navigator.storage.persisted){
      storageState.persisted=await navigator.storage.persisted();
      if(!storageState.persisted&&navigator.storage.persist)
        storageState.persisted=await navigator.storage.persist();
    }
    if(navigator.storage&&navigator.storage.estimate){
      const e=await navigator.storage.estimate();
      storageState.used=e.usage||0; storageState.quota=e.quota||0;
    }
  }catch(e){}
  storageState.asked=true;
  if(view==="data")renderData();
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
