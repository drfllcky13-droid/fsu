/* ---------- two apps, one record ----------
   The van and the scene are two jobs. Each is its own page with its own home-screen icon, and
   because they are the same site they are the same storage: one record, no copies, no sync
   between them. A view that lives on the other page is reached by going there, and the address
   carries which view, so Back and a reload land where you were.

   PAGE is set by the page's own file (van.js or scenes.js) before this runs. ---------- */
const VIEWS={
  van:["home","compartments","bay","compdetail","inventory","itemdetail","sweep","guide",
       "reorder","tidy","print","labels","search","data"],
  scenes:["active","incident","fill","sketch","templates","forms"],
};
const PAGEFILE={van:"index.html",scenes:"scenes.html"};
const here=v=>VIEWS[PAGE].includes(v);
const pageOf=v=>VIEWS.van.includes(v)?"van":VIEWS.scenes.includes(v)?"scenes":PAGE;

/* what has to travel with a view, so the other page opens on the right record */
function crossTo(v,ref){
  const p=pageOf(v);
  const q=ref?"&ref="+encodeURIComponent(ref):"";
  location.href=PAGEFILE[p]+"#v="+encodeURIComponent(v)+q;
}
/* what each view is about, so an address can carry it and be checked on the way back in */
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
/* keep the address in step with where you are, so a reload and Back both land here */
function keepAddress(){
  if(typeof history==="undefined"||!history.replaceState)return;
  const ref=REFOF[view]?REFOF[view]():null;
  const want="#v="+encodeURIComponent(view)+(ref?"&ref="+encodeURIComponent(ref):"");
  if(location.hash!==want){try{history.replaceState(null,"",want)}catch(_){}}
}
/* opened as #v=<view>&ref=<id>: the id is the incident, sketch, item or compartment it is about */
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
/* a new sketch, started from either page */
function startSketch(incId){
  // only the page that draws can make one; the other page asks it to
  if(!here("sketch"))return crossTo("sketch","new"+(incId?":"+incId:""));
  const sk=newSketch();
  if(incId){const inc=incidentOf(incId);
    if(inc)Object.assign(sk,{incidentId:inc.id,caseNo:inc.caseNo,offence:inc.offence,addr:inc.addr})}
  save();
  curSketch=sk.id; selObj=null; curLayer=null; view="sketch";
  try{history.replaceState(null,"","#v=sketch&ref="+sk.id)}catch(_){}
  render();
  return typeof sketchMetaSheet==="function"?sketchMetaSheet(sk):undefined;
}
