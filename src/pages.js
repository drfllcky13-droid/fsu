/* ---------- two apps, one record ----------
   FSU (the van) and Scenes (the scene) are two independent apps: separate icons, separate
   pages, and no link from inside one into the other. What they share is the origin, so they
   share localStorage — one record, nothing copied, nothing to sync between them. A save made
   in one is picked up by the other the next time it loads (see the storage listener in
   core.js), but neither can navigate into the other's screens.

   PAGE is set by the page's own file (van.js or scenes.js) before this runs. ---------- */
const VIEWS={
  van:["home","compartments","bay","compdetail","inventory","itemdetail","sweep","guide",
       "reorder","tidy","print","labels","search","data"],
  scenes:["active","incident","fill","sketch","templates","forms","data"],
};
const here=v=>VIEWS[PAGE].includes(v);

/* what each view is about, so a direct link to this page (a home-screen shortcut, a bookmark)
   can open the right record instead of just the view */
const REFOF={incident:()=>curInc,sketch:()=>curSketch,fill:()=>curFill,
  itemdetail:()=>curItem,compdetail:()=>curComp,bay:()=>curBay};
/* a ref has to name a record of the right kind: an incident id is not a sketch */
const refFits=(v,ref)=>{
  if(!ref)return false;
  const has=(list,key)=>((S[list]||[]).some(r=>r&&String(r[key||"id"])===String(ref)));
  if(v==="incident")return has("incidents");
  if(v==="sketch")return has("sketches");
  if(v==="fill")return has("fills");
  if(v==="itemdetail")return has("items");
  if(v==="compdetail"||v==="bay")return has("comps","code")||(v==="bay"&&/^[0-9]$/.test(String(ref)));
  return false;
};
/* keep the address in step with where you are, so a reload and Back both land here. This
   never points at the other page — it only ever rewrites this page's own hash. */
function keepAddress(){
  if(!here(view)||typeof history==="undefined"||!history.replaceState)return;
  const ref=REFOF[view]?REFOF[view]():null;
  const want="#v="+encodeURIComponent(view)+(ref?"&ref="+encodeURIComponent(ref):"");
  if(location.hash!==want){try{history.replaceState(null,"",want)}catch(_){}}
}
/* opened as #v=<view>&ref=<id>: a direct link into this page, never a hop from the other one */
function openFromHash(){
  const h=String(location.hash||"").replace(/^#/,"");
  if(!h)return false;
  const p=new URLSearchParams(h.replace(/&/g,"&"));
  const v=p.get("v"), ref=p.get("ref");
  if(!v||!here(v))return false;
  if(ref&&!refFits(v,ref)&&String(ref).indexOf("new")!==0){
    // a stale or wrong-kind link: open the view, not a record that is not there
    view=v; return true;
  }
  if(ref){
    if(v==="incident")curInc=ref;
    else if(v==="sketch"){
      if(String(ref).indexOf("new")===0){startSketch(String(ref).slice(4));return true}
      curSketch=ref;selObj=null;curLayer=null}
    else if(v==="fill")curFill=ref;
    else if(v==="itemdetail")curItem=ref;
    else if(v==="compdetail")curComp=ref;
    else if(v==="bay")curBay=ref;
  }
  view=v;
  return true;
}
/* a new sketch. Only ever called from inside the Scenes app, where "sketch" always lives. */
function startSketch(incId){
  if(!here("sketch"))return;   // structurally unreachable from the van; no-op rather than a jump
  const sk=newSketch();
  if(incId){const inc=incidentOf(incId);
    if(inc)Object.assign(sk,{incidentId:inc.id,caseNo:inc.caseNo,offence:inc.offence,addr:inc.addr})}
  save();
  curSketch=sk.id; selObj=null; curLayer=null; view="sketch";
  try{history.replaceState(null,"","#v=sketch&ref="+sk.id)}catch(_){}
  render();
  return typeof sketchMetaSheet==="function"?sketchMetaSheet(sk):undefined;
}
