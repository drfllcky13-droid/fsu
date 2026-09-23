/* ---------- case packages, and saying so when a save is refused ----------
   The main app bundles and restores a case; the sketch app saves one from the canvas. ---------- */
/* ---- when saving fails, say so ---- */
var SAVEFAIL=false;   // var, because the first save happens before this block runs
function saveFailed(on){
  try{
  if(on===!!SAVEFAIL)return; SAVEFAIL=on; if(typeof renderStatus==="function")renderStatus();
  let bar=document.getElementById("savefail");
  if(!on){ if(bar)bar.remove(); toast("Saving works again"); return }
  if(!bar){ bar=document.createElement("div"); bar.id="savefail"; document.body.prepend(bar) }
  bar.innerHTML=`<span><b>Changes are not being saved.</b> This device's storage for the app is full or
    blocked, and nothing entered since this appeared will survive a reload. Save a case package now,
    then free space by deleting old sketches or photographs.</span>
    <button id="sfcase">Save case package</button><button id="sfdata">Storage</button>`;
  $("#sfcase").onclick=()=>exportCasePackage("all","fsu-all");
  $("#sfdata").onclick=()=>go("data");
  }catch(e){ console.error("save warning failed",e) }
}


/* ---- case packages: the only copy of case material that leaves the device ---- */
async function casePackage(scope){
  const all=scope==="all";
  const incIds=new Set(); if(!all&&scope.incidentId)incIds.add(scope.incidentId);
  const sketches=(S.sketches||[]).filter(s=>all||s.id===scope.sketchId||(scope.incidentId&&s.incidentId===scope.incidentId));
  sketches.forEach(s=>{if(s.incidentId)incIds.add(s.incidentId)});
  const incs=incidents().filter(i=>all||incIds.has(i.id));
  const fills=(S.fills||[]).filter(f=>all||incIds.has(f.incidentId));
  const photoIds=new Set();
  sketches.forEach(s=>{ if(s.bg&&s.bg.imgId)photoIds.add(s.bg.imgId); (s.objs||[]).forEach(o=>{if(o.photoId)photoIds.add(o.photoId)}) });
  const photos={};
  for(const id of photoIds){ try{ const d=await photoGet(id); if(d)photos[id]=d }catch(e){} }
  return {fsuCase:1,version:APP_VERSION,exported:new Date().toISOString(),unit:S.vanName||"",incidents:incs,fills,sketches,photos,forms:S.forms||[]};
}
async function exportCasePackage(scope,label){
  toast("Gathering the case material…");
  let pkg; try{ pkg=await casePackage(scope) }catch(e){ return toast("Could not gather it: "+(e.message||e)) }
  const name=String(label||"case").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+"-"+new Date().toISOString().slice(0,16).replace(/[:T]/g,"-")+".fsucase.json";
  const blob=new Blob([JSON.stringify(pkg)],{type:"application/json"});
  try{
    const file=new File([blob],name,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:"FSU case package"});
    else dlBlob(blob,name);
  }catch(e){ if(e&&e.name==="AbortError")return; dlBlob(blob,name) }
  const now=new Date().toISOString(); S.lastCase=now;
  pkg.sketches.forEach(s=>{const sk=(S.sketches||[]).find(x=>x.id===s.id); if(sk)sk.packaged=now});
  saveLocal(); if(view==="data"&&typeof renderData==="function")renderData();
  else if(view==="sketch"&&typeof renderSketch==="function")renderSketch();
  const np=Object.keys(pkg.photos).length;
  logAct("case","Saved a case package"); toast("Case package saved — "+pkg.sketches.length+" sketch"+(pkg.sketches.length===1?"":"es")+", "+np+" photograph"+(np===1?"":"s")+". Put it in the case file.");
}
async function importCasePackage(text){
  let pkg; try{pkg=JSON.parse(text)}catch(e){return toast("That isn't a case package")}
  if(!pkg||pkg.fsuCase!==1)return toast("That isn't a case package");
  const N=cleanCase(pkg,"a case package");
  let n=0;
  const merge=key=>{ S[key]=S[key]||[]; (pkg[key]||[]).forEach(r=>{ if(!r||!r.id)return;
    const i=S[key].findIndex(x=>x.id===r.id); if(i>-1)S[key][i]=r; else S[key].push(r); n++ }) };
  merge("incidents"); merge("fills"); merge("sketches");
  S.forms=S.forms||[]; (pkg.forms||[]).forEach(f=>{ if(f&&f.id&&!S.forms.some(x=>x.id===f.id))S.forms.push(f) });
  let np=0; for(const id in (pkg.photos||{})){ try{ await photoPut(id,pkg.photos[id]); np++ }catch(e){} }
  saveLocal(); render();
  toast("Restored "+n+" record"+(n===1?"":"s")+" and "+np+" photograph"+(np===1?"":"s")+"."+tellBad(N));
}
