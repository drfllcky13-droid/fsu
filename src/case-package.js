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
  // A record or photograph already here with the same id is not replaced without asking: a
  // package made yesterday would otherwise overwrite today's work without a word. New ones go
  // straight in, identical ones are skipped, and ones that differ wait for a choice.
  const same=(a,b)=>canon(a)===canon(b), clash=[];
  let n=0;
  ["incidents","fills","sketches"].forEach(key=>{ S[key]=S[key]||[];
    (pkg[key]||[]).forEach(r=>{ const i=S[key].findIndex(x=>x.id===r.id);
      if(i<0){S[key].push(r);n++} else if(!same(S[key][i],r))clash.push({key,r}) }) });
  S.forms=S.forms||[]; (pkg.forms||[]).forEach(f=>{ if(f&&f.id&&!S.forms.some(x=>x.id===f.id))S.forms.push(f) });
  const photos=pkg.photos||{}, pclash=[]; let np=0;
  for(const id in photos){
    let have=null; try{have=await photoGet(id)}catch(e){}
    if(!have){ try{ await photoPut(id,photos[id]); np++ }catch(e){} }
    else if(have.data!==photos[id].data)pclash.push(id);
  }
  saveLocal(); render();
  const got="Restored "+n+" record"+(n===1?"":"s")+" and "+np+" photograph"+(np===1?"":"s")+".";
  if(!clash.length&&!pclash.length)return toast(got+tellBad(N));
  caseClashSheet(clash,pclash,photos,got+tellBad(N));
}
const clashLabel=c=>c.key==="incidents"?"Incident "+(c.r.caseNo||c.r.id)
  :c.key==="sketches"?"Sketch for "+(c.r.caseNo||c.r.id)+(c.r.depicts?", "+c.r.depicts:"")
  :"Filled form "+(c.r.formName||"")+(c.r.caseNo?" for "+c.r.caseNo:"");
function caseClashSheet(clash,pclash,photos,got){
  const rows=clash.map(clashLabel).concat(pclash.map(id=>"Photograph "+id)), k=rows.length;
  openSheet(`<h3>Already on this device</h3>
    <p style="margin:0 0 10px;color:var(--ink2);font-size:14.5px;line-height:1.5">${k===1?"One record":k+" records"} in the
      package ${k===1?"is":"are"} already here with different contents. ${esc(got)} Nothing here has been changed.</p>
    <ul style="margin:0 0 14px;padding-left:20px;font-size:14.5px;line-height:1.5">${rows.slice(0,12).map(t=>`<li>${esc(t)}</li>`).join("")}${k>12?`<li>and ${k-12} more</li>`:""}</ul>
    <button class="btn" id="cpmine" style="max-width:none;margin:0">Keep mine</button>
    <button class="btn sec" id="cptheirs" style="max-width:none">Use the package's</button>
    <button class="btn sec" id="cpboth" style="max-width:none">Keep both</button>
    <p class="hint" style="margin:10px 0 0">Keep both adds the package's version as a copy beside yours. Closing this keeps yours.</p>`);
  const pick=async how=>{ closeSheet(); await settleClash(how,clash,pclash,photos);
    toast(how==="mine"?"Kept the versions on this device"
      :how==="theirs"?"Replaced "+k+" with the package's version"+(k===1?"":"s")
      :"Kept both: the package's version"+(k===1?" was":"s were")+" added beside yours") };
  $("#cpmine").onclick=()=>pick("mine");
  $("#cptheirs").onclick=()=>pick("theirs");
  $("#cpboth").onclick=()=>pick("both");
}
async function settleClash(how,clash,pclash,photos){
  if(how==="theirs"){
    clash.forEach(({key,r})=>{ const i=S[key].findIndex(x=>x.id===r.id); if(i>-1)S[key][i]=r;
      // the undo history here belongs to the version being replaced
      if(key==="sketches")try{localStorage.removeItem("fsu-undo-"+r.id)}catch(_){} });
    for(const id of pclash){ try{ await photoPut(id,photos[id]) }catch(e){} }
  } else if(how==="both"){
    // copies get new ids; a copied fill or sketch follows its copied incident, and a copied
    // sketch gets its own copy of a photograph that differs. A differing photograph that no
    // copy uses stays as it is here, rather than becoming a copy nothing points at.
    const ids={}, pids={};
    pclash.forEach(id=>pids[id]=newId());
    const used=new Set();
    ["incidents","fills","sketches"].forEach(key=>clash.filter(c=>c.key===key).forEach(({r})=>{
      const c=JSON.parse(JSON.stringify(r)); ids[r.id]=c.id=newId(); c.copyOf=r.id;
      if(c.incidentId&&ids[c.incidentId])c.incidentId=ids[c.incidentId];
      if(key==="sketches"){
        (c.objs||[]).forEach(o=>{ if(o.photoId&&pids[o.photoId]){used.add(o.photoId);o.photoId=pids[o.photoId]} });
        if(c.bg&&c.bg.imgId&&pids[c.bg.imgId]){used.add(c.bg.imgId);c.bg.imgId=pids[c.bg.imgId]}
      }
      S[key].push(c) }));
    for(const id of pclash){ if(used.has(id))try{ await photoPut(pids[id],photos[id]) }catch(e){} }
  }
  saveLocal(); render();
}
