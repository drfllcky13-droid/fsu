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
  const where={};   // photograph id -> what uses it, to name one that cannot be read
  sketches.forEach(s=>{ const sk="sketch for "+(s.caseNo||"no case number");
    if(s.bg&&s.bg.imgId)where[s.bg.imgId]="the backdrop of the "+sk;
    (s.objs||[]).forEach(o=>{if(o.photoId)where[o.photoId]="photo point "+(o.n||o.label||"")+" on the "+sk}) });
  const photos={}, missingPhotos=[];
  for(const id in where){ let d=null; try{ d=await photoGet(id) }catch(e){}
    if(d&&d.data)photos[id]=d; else missingPhotos.push({id,where:where[id].replace(/ +/g," ")}) }
  // the package says what it could not include, so whoever opens it knows too
  return {fsuCase:1,version:APP_VERSION,exported:new Date().toISOString(),unit:S.vanName||"",incidents:incs,fills,sketches,photos,missingPhotos,forms:S.forms||[]};
}
// What a case holds: its incident, filled forms, sketches and the photographs they use.
function caseParts(inc){
  const fills=(S.fills||[]).filter(f=>f.incidentId===inc.id), sks=(S.sketches||[]).filter(s=>s.incidentId===inc.id), ids=new Set();
  sks.forEach(s=>{ if(s.bg&&s.bg.imgId)ids.add(s.bg.imgId); (s.objs||[]).forEach(o=>{if(o.photoId)ids.add(o.photoId)}) });
  return {fills,sks,photos:[...ids].sort()};
}
// A fingerprint of everything in a case, photographs included, leaving out the marks that
// exporting itself makes. A case whose fingerprint still matches the one taken when its package
// was saved has not changed since, so that package holds all of it.
async function caseFingerprint(inc){
  const {fills,sks,photos}=caseParts(inc);
  const strip=r=>{const c=Object.assign({},r); delete c.packaged; delete c.pkg; return c};
  const ph=[];
  for(const id of photos){ let d=null; try{d=await photoGet(id)}catch(e){} ph.push([id,d&&d.data?hash(String(d.data)):"missing"]) }
  return hash(canon({inc:strip(inc),fills:fills.map(strip),sks:sks.map(strip),ph}));
}
async function exportCasePackage(scope,label){
  toast("Gathering the case material…");
  let pkg; try{ pkg=await casePackage(scope) }catch(e){ return toast("Could not gather it: "+(e.message||e)) }
  // an incident is marked as packaged only when this package holds every form, sketch and
  // photograph it has; a package of one sketch does not cover the rest of its case
  const whole=[];
  for(const inc of pkg.incidents||[]){
    const {fills,sks,photos}=caseParts(inc);
    const has=(list,id)=>(list||[]).some(r=>r.id===id);
    if(fills.every(f=>has(pkg.fills,f.id))&&sks.every(k=>has(pkg.sketches,k.id))&&photos.every(id=>pkg.photos&&pkg.photos[id]))
      whole.push(inc.id);
  }
  const name=String(label||"case").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+"-"+new Date().toISOString().slice(0,16).replace(/[:T]/g,"-")+".fsucase.json";
  const blob=new Blob([JSON.stringify(pkg)],{type:"application/json"});
  try{
    const file=new File([blob],name,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:"FSU case package"});
    else dlBlob(blob,name);
  }catch(e){ if(e&&e.name==="AbortError")return; dlBlob(blob,name) }
  const now=new Date().toISOString(); S.lastCase=now;
  pkg.sketches.forEach(s=>{const sk=(S.sketches||[]).find(x=>x.id===s.id); if(sk)sk.packaged=now});
  // fingerprinted after the share sheet, not before: it needs the tap that opened it, and the
  // sheet is modal, so nothing in the case can change in between
  for(const id of whole){const inc=incidentOf(id); if(inc)inc.pkg={at:now,h:await caseFingerprint(inc)}}
  saveLocal(); if(view==="data"&&typeof renderData==="function")renderData();
  else if(view==="sketch"&&typeof renderSketch==="function")renderSketch();
  const np=Object.keys(pkg.photos).length;
  if(pkg.missingPhotos.length){
    // a photograph that could not be read is named, not skipped without a word
    logAct("case","Saved a case package without "+pkg.missingPhotos.length+" photograph"+(pkg.missingPhotos.length===1?"":"s")+" that could not be read");
    openSheet(`<h3>Saved, but ${pkg.missingPhotos.length===1?"one photograph is":pkg.missingPhotos.length+" photographs are"} missing</h3>
      <p style="margin:0 0 10px;color:var(--ink2);font-size:14.5px;line-height:1.5">The case package was saved with ${np} photograph${np===1?"":"s"}. ${pkg.missingPhotos.length===1?"This one":"These"} could not be read on this device and ${pkg.missingPhotos.length===1?"is":"are"} not in it:</p>
      <ul class="photomiss" style="margin:0 0 12px;padding-left:20px;font-size:14.5px;line-height:1.5">${pkg.missingPhotos.map(m=>`<li>${esc(m.where)} <span class="hint">(${esc(m.id)})</span></li>`).join("")}</ul>
      <p class="hint" style="margin:0 0 12px">If the original is in the camera roll, attach it again to the photo point and save a new case package.</p>
      <button class="btn" id="cfno" style="max-width:none;margin:0">OK</button>`);
    $("#cfno").onclick=closeSheet;
    return;
  }
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

/* ---- making room: closed cases that are already safe in a case package ----
   A case goes only if it is closed, a package holding all of it was saved, and nothing in it
   has changed since (its fingerprint still matches). Anything else stays, with the reason. */
async function removableCases(){
  const go=[], stay=[];
  for(const inc of closedIncidents()){
    const {fills,sks,photos}=caseParts(inc);
    const name=(inc.caseNo||"No case number")+(inc.offence?" \u00b7 "+inc.offence:"");
    if(!inc.pkg||!inc.pkg.h){stay.push({inc,name,why:"no case package has been saved"});continue}
    if(await caseFingerprint(inc)!==inc.pkg.h){stay.push({inc,name,why:"changed since its case package was saved"});continue}
    let rec=JSON.stringify(inc).length, pic=0;
    fills.forEach(f=>rec+=JSON.stringify(f).length);
    sks.forEach(k=>{rec+=JSON.stringify(k).length; try{rec+=(localStorage.getItem("fsu-undo-"+k.id)||"").length}catch(_){} });
    for(const id of photos){ try{const d=await photoGet(id); if(d&&d.data)pic+=String(d.data).length}catch(e){} }
    go.push({inc,name,fills,sks,photos,rec,pic});
  }
  return {go,stay};
}
async function removeCasesSheet(){
  const {go,stay}=await removableCases();
  const rec=go.reduce((a,c)=>a+c.rec,0), pic=go.reduce((a,c)=>a+c.pic,0);
  const row=c=>`<li><b>${esc(c.name)}</b><br><span class="hint">closed ${esc(String(c.inc.closed).slice(0,10))}, package saved ${esc(String(c.inc.pkg.at).slice(0,10))} \u00b7 ${c.fills.length} form${c.fills.length===1?"":"s"}, ${c.sks.length} sketch${c.sks.length===1?"":"es"}, ${c.photos.length} photograph${c.photos.length===1?"":"s"} \u00b7 ${fmtBytes(c.rec+c.pic)}</span></li>`;
  const kept=stay.length?`<div class="idsect">Staying on this device</div>
    <ul class="storestay" style="margin:0 0 12px;padding-left:20px;font-size:14.5px;line-height:1.5">${stay.map(c=>`<li><b>${esc(c.name)}</b>: ${esc(c.why)}</li>`).join("")}</ul>`:"";
  if(!go.length){
    openSheet(`<h3>Nothing to remove</h3>
      <p style="margin:0 0 12px;color:var(--ink2);font-size:14.5px;line-height:1.5">A case is removed only when it is closed, a case package with all of it has been saved, and nothing in it has changed since. No case here is all three.</p>
      ${kept}<button class="btn sec" id="cfno" style="max-width:none;margin:0">Close</button>`);
    $("#cfno").onclick=closeSheet; return;
  }
  openSheet(`<h3>Remove closed cases</h3>
    <p style="margin:0 0 10px;color:var(--ink2);font-size:14.5px;line-height:1.5">These ${go.length===1?"case is":go.length+" cases are"} closed and already in a saved case package, unchanged since. Removing ${go.length===1?"it":"them"} deletes the incident, its forms, sketches and photographs from this device. The case package is then the only copy, so make sure it is in the case file.</p>
    <ul class="storego" style="margin:0 0 10px;padding-left:20px;font-size:14.5px;line-height:1.5">${go.map(row).join("")}</ul>
    <p class="hint" id="storefrees" style="margin:0 0 12px">Frees ${fmtBytes(rec)} of the app's record${pic?" and "+fmtBytes(pic)+" of photograph storage":""}.</p>
    ${kept}
    <button class="btn sec" id="cfyes" style="max-width:none;margin:0;color:var(--red);border-color:var(--red)">Remove ${go.length} case${go.length===1?"":"s"}</button>
    <button class="btn" id="cfno" style="max-width:none">Cancel</button>`);
  $("#cfno").onclick=closeSheet;
  $("#cfyes").onclick=async()=>{ closeSheet(); const n=await removeCases(go.map(c=>c.inc.id));
    toast(n?"Removed "+n+" case"+(n===1?"":"s")+". The case packages are the copies now.":"Nothing was removed: the cases changed") };
}
// checked again at the moment of removal, so nothing edited while the sheet was open can go
async function removeCases(ids){
  const {go}=await removableCases(); let n=0;
  for(const c of go){
    if(!ids.includes(c.inc.id))continue;
    for(const id of c.photos){ try{await photoDel(id)}catch(e){} }
    c.sks.forEach(k=>{ try{localStorage.removeItem("fsu-undo-"+k.id)}catch(_){} });
    S.fills=(S.fills||[]).filter(f=>f.incidentId!==c.inc.id);
    S.sketches=(S.sketches||[]).filter(k=>k.incidentId!==c.inc.id);
    S.incidents=(S.incidents||[]).filter(i=>i.id!==c.inc.id);
    logAct("case","Removed "+(c.inc.caseNo||"a case")+" from this device; it is in a case package");
    n++;
  }
  saveLocal(); if(typeof claimStorage==="function")await claimStorage(); render();
  return n;
}

/* ---- photographs and the records that use them ----
   A photograph with no record is left over from something deleted; a record whose photograph is
   gone shows an empty frame and prints without it. The check lists both. Only the first can be
   cleaned up, and only after a confirm; a photograph that an undo step could bring back counts as
   in use. */
async function photoAudit(){
  const used=new Map(), inUndo=new Set();
  (S.sketches||[]).forEach(s=>{ const sk="sketch for "+(s.caseNo||"no case number");
    if(s.bg&&s.bg.imgId)used.set(s.bg.imgId,"the backdrop of the "+sk);
    (s.objs||[]).forEach(o=>{if(o.photoId)used.set(o.photoId,("photo point "+(o.n||o.label||"")+" on the "+sk).replace(/ +/g," "))}) });
  try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(!k||k.indexOf("fsu-undo-")!==0)continue;
    const t=localStorage.getItem(k)||""; for(const m of t.matchAll(/"(?:photoId|imgId)":"([\w-]{1,64})"/g))inUndo.add(m[1]) } }catch(_){}
  let keys=[]; try{ keys=await photoKeys() }catch(e){}
  const have=new Set(keys.map(String)), orphans=[];
  for(const id of have){ if(used.has(id)||inUndo.has(id))continue;
    let n=0; try{const d=await photoGet(id); n=d&&d.data?String(d.data).length:0}catch(e){} orphans.push({id,n}) }
  const missing=[...used].filter(([id])=>!have.has(id)).map(([id,where])=>({id,where}));
  return {orphans,missing,count:have.size};
}
async function photoCheckSheet(){
  const {orphans,missing,count}=await photoAudit(), freed=orphans.reduce((a,o)=>a+o.n,0);
  openSheet(`<h3>Photographs on this device</h3>
    <p style="margin:0 0 10px;color:var(--ink2);font-size:14.5px;line-height:1.5">${count} photograph${count===1?"":"s"} stored.
      ${!orphans.length&&!missing.length?"Every one is used by a sketch, and every sketch's photographs are here.":""}</p>
    ${missing.length?`<div class="idsect">Missing: a record points to a photograph that is not here</div>
      <ul class="photomiss" style="margin:0 0 12px;padding-left:20px;font-size:14.5px;line-height:1.5">${missing.map(m=>`<li>${esc(m.where)} <span class="hint">(${esc(m.id)})</span></li>`).join("")}</ul>
      <p class="hint" style="margin:0 0 12px">Attach the photograph to that photo point again if you still have it. Nothing here removes these records.</p>`:""}
    ${orphans.length?`<div class="idsect">Not used by any record</div>
      <ul class="photoorph" style="margin:0 0 10px;padding-left:20px;font-size:14.5px;line-height:1.5">${orphans.map(o=>`<li>${esc(o.id)} <span class="hint">${fmtBytes(o.n)}</span></li>`).join("")}</ul>
      <button class="btn sec" id="photoclean" style="max-width:none;margin:0;color:var(--red);border-color:var(--red)">Delete ${orphans.length} photograph${orphans.length===1?"":"s"} no record uses (${fmtBytes(freed)})</button>`:""}
    <button class="btn" id="cfno" style="max-width:none">Close</button>`);
  $("#cfno").onclick=closeSheet;
  const c=$("#photoclean"); if(c)c.onclick=()=>askConfirm("Delete unused photographs",
    orphans.length+" photograph"+(orphans.length===1?"":"s")+" that no sketch, photo point or undo step uses "+(orphans.length===1?"is":"are")+" deleted from this device.",
    "Delete",true,async()=>{
      // checked again: a photograph attached since the list was drawn stays
      const now=await photoAudit(), still=new Set(now.orphans.map(o=>o.id)); let n=0;
      for(const o of orphans){ if(!still.has(o.id))continue; try{await photoDel(o.id);n++}catch(e){} }
      if(typeof claimStorage==="function")await claimStorage();
      toast("Deleted "+n+" unused photograph"+(n===1?"":"s")) });
}
