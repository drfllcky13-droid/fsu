 sweep:"M12 5v14M5 12h14",
 forms:"M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6",
 guide:"M4 5a2 2 0 012-2h11a1 1 0 011 1v15a1 1 0 01-1 1H6a2 2 0 01-2-2zM8 7h7M8 11h7",
 active:"M4 6h6v5H4zM14 6h6v5h-6zM4 15h6v3H4zM14 15h6v3h-6z"};

let MEM=null, memOnly=false;
// A record that will not read is never written over. Its text is kept under a key of its own,
// van3.bad-<time>, before the app starts afresh. With no room for a second copy the original is
// moved rather than copied; if even that fails it stays where it is and nothing is saved over it
// until it has been downloaded (BADREC.key is null until then). The page says so (chrome.js).
let BADREC=null;
const LEGACY=["vaninv2","vaninv"];
function keepBad(from,raw){
  const bad="van3.bad-"+new Date().toISOString().replace(/[:.]/g,"-");
  try{ localStorage.setItem(bad,raw); BADREC={key:bad,from,raw}; return }catch(e){}
  try{ localStorage.removeItem(from); localStorage.setItem(bad,raw); BADREC={key:bad,from,raw}; return }catch(e){}
  try{ localStorage.setItem(from,raw) }catch(e){}
  BADREC={key:null,from,raw};
}
const store={get(){if(MEM)return MEM;
   let from=null, raw=null;
   try{ for(const k of ["van3"].concat(LEGACY)){const r=localStorage.getItem(k); if(r){from=k;raw=r;break}} }catch(e){return null}
   if(raw==null)return null;
   let o; try{o=JSON.parse(raw)}catch(e){}
   if(o&&typeof o==="object"&&!Array.isArray(o)){
     // the current record read: the old keys it replaced are no longer needed
     if(from==="van3")LEGACY.forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
     return o;
   }
   keepBad(from,raw); return null},
 set(v){if(BADREC&&!BADREC.key){MEM=v;if(typeof saveFailed==="function")saveFailed(true);return}
   try{localStorage.setItem("van3",JSON.stringify(v));MEM=null;if(typeof saveFailed==="function")saveFailed(false);if(typeof savedTick==="function")savedTick()}
   catch(e){MEM=v;if(typeof saveFailed==="function")saveFailed(true)}}};
// writing may be refused while reading still works: private browsing, blocked storage, a
// full disk. Read the record anyway and carry on in memory; do not start from nothing.
try{localStorage.setItem("__t","1");localStorage.removeItem("__t")}catch(e){memOnly=true}

const S=Object.assign({items:[],comps:[],locs:[],lastCat:"A",lastCls:"Consumable",curLoc:""},store.get()||{});
if(memOnly)MEM=S;
const rows=v=>Array.isArray(v)?v.filter(x=>x&&typeof x==="object"):[];
S.items=rows(S.items); S.comps=rows(S.comps); S.forms=rows(S.forms);
S.fills=rows(S.fills); S.sketches=rows(S.sketches); S.incidents=rows(S.incidents);
if(!Array.isArray(S.locs))S.locs=[];
S.comps.forEach(c=>{if(c.code==null)c.code=""});
(S.locs||[]).forEach(c=>{if(c&&!S.comps.some(x=>x.code===c))S.comps.push({code:c,desc:"",side:"",x:null,y:null,w:6,h:4})});
if(!S.walls)S.walls=JSON.parse(JSON.stringify(WALLDEF));
if(!S.seeded&&!S.items.length&&!S.comps.length){
  S.seeded=true;
  S.comps=VANCOMPS.map(r=>({code:r[0],desc:r[1],side:VANSIDES[r[2]],
    x:r[3],y:r[4],w:r[5],h:r[6]}));
  S.walls=JSON.parse(JSON.stringify(VANWALLS));
  S.demo=false; store.set(S);
}
S.comps.forEach(c=>{if(c.zone&&!c.side)c.side=(c.zone==="Rear")?"Rear doors":(c.zone==="Interior")?"":c.zone;
  if(c.w==null){c.w=6;c.h=4}
  if(c.x==null||c.y==null){c.x=null;c.y=null}});
S.items.forEach(i=>{if(i.date&&/^\d{4}-\d{2}$/.test(i.date))i.date=i.date+"-01";
  if(!i.uses)i.uses=[];
  if(!i.rel)i.rel=[];
  if(!i.links)i.links=[];
  if(i.loc&&!S.comps.some(x=>x.code===i.loc))S.comps.push({code:i.loc,desc:"",side:"",x:null,y:null,w:6,h:4})});
const save=()=>{store.set(S);if(typeof queuePush==='function')queuePush()};
const saveLocal=()=>store.set(S);

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=v=>+v||0;
const catName=c=>(CATS.find(x=>x[0]===c)||["","Uncategorised"])[1];
ICONS.gear="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z";
const ic=(k,cls)=>`<svg class="${cls||"g"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[k]}"/></svg>`;
let toastT; const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),1900)};

// the time, plus 8 random characters: records made in the same millisecond (seeding makes dozens)
// must not share an id, and 4 characters shared one now and then
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const live=()=>S.items.filter(i=>i.status!=="Not carried");
// a date written as 2026-09-12 means that day here, not midnight in London. Parsing it as
// UTC moved every count and every flag by the offset, so a flag could land a day early and
// the same afternoon could give two different answers.
const dayStart=d=>{const p=String(d||"").slice(0,10).split("-").map(Number);
  return (p.length===3&&p.every(n=>n>0))?new Date(p[0],p[1]-1,p[2]):new Date(NaN)};
const localISO=d=>{const t=new Date(d);t.setMinutes(t.getMinutes()-t.getTimezoneOffset());
  return t.toISOString().slice(0,10)};
const startOfToday=()=>dayStart(localISO(new Date()));
const daysOut=d=>{if(!d)return null;const t=dayStart(d);if(isNaN(t))return null;
  return Math.round((t-startOfToday())/86400000)};
const placed=i=>!!(i.loc&&String(i.loc).trim());
const isLow=i=>placed(i)&&i.par!==""&&i.par!=null&&n(i.qty)<n(i.par);
const isOut=i=>i.status==="Out"||(placed(i)&&n(i.qty)===0);
const isExpired=i=>{const d=daysOut(i.date);return i.status==="Expired"||(i.cls!=="Durable"&&d!==null&&d<0)};
const isExpiring=i=>{const d=daysOut(i.date);return i.cls!=="Durable"&&d!==null&&d>=0&&d<=90};
const isService=i=>{const d=daysOut(i.date);return i.status==="Service due"||(i.cls==="Durable"&&d!==null&&d<=30)};
const gaps=()=>S.items.filter(i=>i.status==="Not carried"&&i.gapType!=="deliberate"&&i.gapType!=="request");
const requests=()=>S.items.filter(i=>i.status==="Not carried"&&i.gapType==="request");
const isRequest=i=>i.status==="Not carried"&&i.gapType==="request";
const parseLinks=t=>t.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
  const b=l.split("|"); const url=(b.length>1?b.slice(1).join("|"):b[0]).trim();
  const label=(b.length>1?b[0]:url).trim();
  return /^https?:\/\//i.test(url)?{label,url}:null}).filter(Boolean);
const linksText=i=>(i.links||[]).map(l=>l.label===l.url?l.url:l.label+" | "+l.url).join("\n");

function compState(code){
  const it=live().filter(i=>i.loc===code);
  const rec=S.comps.find(c=>c.code===code);
  // sweeping is per cycle: logging stock is not the same as having looked today
  if(!(rec&&rec.checked))return{k:"unchecked",
    label:it.length?"Not checked \u00b7 "+it.length+(it.length===1?" item":" items"):"Not checked",
    parts:[],items:it};
  if(!it.length)return{k:"good",label:"Empty",parts:[],items:it};
  const bad=i=>isOut(i)||isExpired(i);
  const out=it.filter(isOut).length, exp=it.filter(i=>isExpired(i)&&!isOut(i)).length;
  const low=it.filter(i=>isLow(i)&&!bad(i)).length;
  const soon=it.filter(i=>isExpiring(i)&&!bad(i)).length, svc=it.filter(i=>isService(i)&&!bad(i)).length;
  const p=[];
  if(out)p.push(out+" out"); if(exp)p.push(exp+" expired");
  if(low)p.push(low+" low"); if(soon)p.push(soon+" expiring"); if(svc)p.push(svc+" service");
  if(out||exp)return{k:"action",label:p.join(", "),parts:p,items:it};
  if(low||soon||svc)return{k:"attn",label:p.join(", "),parts:p,items:it};
  return{k:"good",label:it.length+(it.length===1?" item":" items"),parts:[],items:it};
}
const comps=()=>S.comps.slice().sort((a,b)=>String(a.code||"").localeCompare(String(b.code||""),undefined,{numeric:true}));



// which sketch is open, and what is selected in it. Declared here because the main app
// carries these in its back history even though it no longer draws anything.
let curSketch=null, selObj=null, curLayer=null;

// Two apps, one record: if the other one saves while this is open, this copy is stale and
// writing over it would lose their work. The browser tells us; take their version and redraw.
window.addEventListener("storage",ev=>{
  if(ev.key!=="van3"||!ev.newValue)return;
  let o=null; try{o=JSON.parse(ev.newValue)}catch(e){return}
  if(!o||typeof o!=="object")return;
  MEM=null;
  for(const k of Object.keys(S))delete S[k];
  Object.assign(S,o);
  // the same minimum a load gives the record: lists that are lists of records, and the parts
  // the rest of the app reads without checking (sync settings and bookkeeping, walls, conflicts)
  ["items","comps","forms","fills","sketches","incidents"].forEach(k=>S[k]=rows(S[k]));
  if(!Array.isArray(S.locs))S.locs=[];
  if(!S.walls||typeof S.walls!=="object")S.walls=JSON.parse(JSON.stringify(WALLDEF));
  if(!S.gh||typeof S.gh!=="object")S.gh={owner:"",repo:"",path:"data.json",token:"",sha:"",last:""};
  ["base","tomb"].forEach(b=>{ if(!S[b]||typeof S[b]!=="object")S[b]={};
    ["items","comps","forms"].forEach(k=>{ if(!S[b][k]||typeof S[b][k]!=="object")S[b][k]={} }) });
  if(!Array.isArray(S.conflicts))S.conflicts=[];
  if(typeof render==="function")render();
});

// the date here, not in UTC: see dayStart above
const today=()=>localISO(new Date());

const compassOf=r=>["N","NE","E","SE","S","SW","W","NW"][Math.round((((+r||0)%360)+360)%360/45)%8];

/* ---------- data from outside the device ----------
   A synced file, a restored backup and a case package are written somewhere else, and what is
   in them ends up in this page's markup: ids in attributes, geometry in style, images in src,
   links in href. Every record is checked on the way in. One that cannot be made safe is left
   out, one that can is repaired, and either way it is listed under Settings › Recent errors.
   One bad record never stops the rest from arriving. */
const okId=v=>(typeof v==="string"||typeof v==="number")&&/^[\w-]{1,64}$/.test(String(v));
const okImg=v=>typeof v==="string"&&/^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=\s]*$/i.test(v);
const okUrl=v=>typeof v==="string"&&/^https?:\/\/[^\s"'<>`]+$/i.test(v.trim());
// a number, or a string that is one; anything else is null
const toNum=v=>(typeof v==="number"&&isFinite(v))?v:(typeof v==="string"&&v.trim()!==""&&isFinite(+v))?+v:null;
const shortVal=v=>String(typeof v==="string"?v:JSON.stringify(v)).slice(0,40);
// listed once: a synced file is read again at every sync and would otherwise fill the list
function noteBad(m){
  try{ m=String(m).slice(0,300); S.errors=Array.isArray(S.errors)?S.errors:[];
    if(S.errors.some(e=>e&&e.m===m))return false;
    S.errors=S.errors.slice(-19);
    S.errors.push({t:new Date().toISOString(),m,v:typeof view==="string"?view:""});
    return true }catch(_){return false}
}
function makeNote(src){
  const N={n:0,fresh:0,note(m){N.n++; if(noteBad("From "+src+": "+m))N.fresh++}};
  return N;
}
const tellBad=N=>N.n?" "+N.n+" unsafe value"+(N.n===1?" was":"s were")+" left out or repaired; Settings › Recent errors lists "+(N.n===1?"it":"them")+".":"";
function cleanList(a,fn,N){
  return (Array.isArray(a)?a:[]).map(r=>{
    if(!r||typeof r!=="object")return null;
    try{return fn(r,N)}catch(e){N.note("a record that could not be read was left out");return null}
  }).filter(Boolean);
}
function cleanLinks(r,N,what){
  if(r.links==null)return;
  const keep=Array.isArray(r.links)?r.links.filter(l=>l&&okUrl(l.url)):[];
  if(!Array.isArray(r.links)||keep.length!==r.links.length)
    N.note("a link on "+what+" that was not a web address was removed");
  r.links=keep;
}
function cleanItem(r,N){
  if(!okId(r.id)){N.note("an item with an unsafe id "+shortVal(r.id)+" was left out");return null}
  if(r._x)return r;                                   // a tombstone draws nothing
  cleanLinks(r,N,"item "+shortVal(r.name||r.id));
  if(r.cert!=null&&r.cert!==""&&!okUrl(r.cert)){
    N.note("the certificate link on item "+shortVal(r.name||r.id)+" was not a web address and was removed");delete r.cert}
  if(Array.isArray(r.rel))r.rel=r.rel.filter(okId); else if(r.rel!=null)r.rel=[];
  return r;
}
function cleanComp(r,N){
  if(!okId(r.code)){N.note("a compartment with an unsafe code "+shortVal(r.code)+" was left out");return null}
  if(r._x)return r;
  let fixed=0;
  ["x","y"].forEach(k=>{ if(r[k]==null)return; const v=toNum(r[k]); if(v===null)fixed++; r[k]=v });
  if(r.x==null||r.y==null){r.x=null;r.y=null}
  ["w","h"].forEach(k=>{ const v=toNum(r[k]); if(v===null||v<=0){ if(r[k]!=null)fixed++; r[k]=k==="w"?6:4 } else r[k]=v });
  if(fixed)N.note("compartment "+r.code+": a size or position that was not a number was reset");
  return r;
}
function cleanForm(r,N){
  if(!okId(r.id)){N.note("a form with an unsafe id "+shortVal(r.id)+" was left out");return null}
  if(r._x)return r;
  if(r.fields!=null&&!Array.isArray(r.fields))r.fields=[];
  if((r.fields||[]).some(f=>!f||!okId(f.id))){
    N.note("form "+shortVal(r.name||r.id)+" has a field with an unsafe id and was left out");return null}
  (r.fields||[]).forEach(f=>{
    if(typeof FTYPES!=="undefined"&&!FTYPES.includes(f.type))f.type="text";
    if(f.cols!=null)f.cols=Array.isArray(f.cols)?f.cols.map(String):null});
  cleanLinks(r,N,"form "+shortVal(r.name||r.id));
  return r;
}
function cleanWalls(w,N){
  if(!w||typeof w!=="object"||Array.isArray(w)){N.note("the wall layout could not be read and was not used");return null}
  const out={};
  for(const side of Object.keys(w)){
    const v=w[side]||{}, c=toNum(v.cols), r=toNum(v.rows);
    if(!(c>0&&c<=1000&&r>0&&r<=1000)){N.note("the wall layout has a size that is not a number and was not used");return null}
    out[side]=Object.assign({},v,{cols:Math.round(c),rows:Math.round(r)});
  }
  return out;
}
// items, compartments, forms and walls: the synced file and a backup
function cleanVan(o,src){
  const N=makeNote(src);
  o.items=cleanList(o.items,cleanItem,N);
  o.comps=cleanList(o.comps,cleanComp,N);
  o.forms=cleanList(o.forms,cleanForm,N);
  if(o.walls!=null){const w=cleanWalls(o.walls,N); if(w)o.walls=w; else delete o.walls}
  return N;
}
// a sketch's own parts: object and layer ids, references, geometry, the backdrop, the scale.
// Also run on stored sketches before they are drawn (repairSketch), so it must be harmless twice.
function cleanSketchParts(sk,N){
  let fixed=0;
  if(sk.incidentId!=null&&!okId(sk.incidentId)){delete sk.incidentId;fixed++}
  const ren={};
  if(Array.isArray(sk.layers))
    sk.layers=sk.layers.filter(L=>L&&typeof L==="object").map(L=>{
      if(!okId(L.id)){const id=newId(); ren[String(L.id)]=id; L.id=id; fixed++} return L});
  else if(sk.layers!=null){sk.layers=[];fixed++}
  (Array.isArray(sk.objs)?sk.objs:[]).forEach(o=>{
    if(!o||typeof o!=="object")return;
    if(!okId(o.id)){o.id=newId();fixed++}
    if(o.lay!=null&&!okId(o.lay)){ if(ren[String(o.lay)])o.lay=ren[String(o.lay)]; else delete o.lay; fixed++ }
    if(o.photoId!=null&&!okId(o.photoId)){delete o.photoId;fixed++}
    // a measurement names its fixed points as "<object id>:<point>", e.g. "k3x9:c" or "k3x9:tl"
    const okRef=v=>typeof v==="string"&&/^[\w-]{1,64}:[\w-]{1,8}$/.test(v);
    if(o.meas&&typeof o.meas==="object"&&((o.meas.a!=null&&!okRef(o.meas.a))||(o.meas.b!=null&&!okRef(o.meas.b)))){delete o.meas;fixed++}
    ["x","y","w","h","r"].forEach(k=>{ if(o[k]==null)return; const v=toNum(o[k]); if(v===null){delete o[k];fixed++} else o[k]=v });
    if(Array.isArray(o.pts)){
      if(!o.pts.every(p=>Array.isArray(p)&&toNum(p[0])!==null&&toNum(p[1])!==null)){delete o.pts;fixed++}
      else if(o.pts.some(p=>typeof p[0]!=="number"||typeof p[1]!=="number"))
        o.pts=o.pts.map(p=>[toNum(p[0]),toNum(p[1])].concat(p.slice(2)));
    }
  });
  const b=sk.bg;
  if(b!=null){
    if(typeof b!=="object"){delete sk.bg;fixed++}
    else {
      if(b.data!=null&&!okImg(b.data)){delete b.data;fixed++}
      if(b.imgId!=null&&!okId(b.imgId)){delete b.imgId;fixed++}
      ["x","y","w","h","op","br","sa"].forEach(k=>{ if(b[k]==null)return; const v=toNum(b[k]); if(v===null){delete b[k];fixed++} else b[k]=v });
      if(!b.data&&!b.imgId)delete sk.bg;
    }
  }
  if(sk.scale!=null&&(typeof sk.scale!=="object"||!(toNum(sk.scale.px)>0)||!(toNum(sk.scale.real)>0))){delete sk.scale;fixed++}
  else if(sk.scale){sk.scale.px=toNum(sk.scale.px);sk.scale.real=toNum(sk.scale.real)}
  if(fixed)N.note("sketch "+shortVal(sk.caseNo||sk.id)+": "+fixed+" unsafe value"+(fixed===1?"":"s")+" repaired");
  return fixed;
}
function cleanSketch(sk,N){
  if(!okId(sk.id)){N.note("a sketch with an unsafe id "+shortVal(sk.id)+" was left out");return null}
  cleanSketchParts(sk,N);
  return sk;
}
// incidents, filled forms, sketches, forms and photographs: a case package
function cleanCase(pkg,src){
  const N=makeNote(src);
  pkg.incidents=cleanList(pkg.incidents,(r,N)=>{
    if(!okId(r.id)){N.note("an incident with an unsafe id "+shortVal(r.id)+" was left out");return null}
    if(r.plan!=null&&!Array.isArray(r.plan))r.plan=[];
    return r},N);
  pkg.fills=cleanList(pkg.fills,(r,N)=>{
    if(!okId(r.id)||(r.formId!=null&&!okId(r.formId))||(r.incidentId!=null&&!okId(r.incidentId))){
      N.note("a filled form with an unsafe id "+shortVal(r.id)+" was left out");return null}
    if(!r.values||typeof r.values!=="object")r.values={};
    return r},N);
  pkg.sketches=cleanList(pkg.sketches,cleanSketch,N);
  pkg.forms=cleanList(pkg.forms,cleanForm,N);
  const src2=pkg.photos&&typeof pkg.photos==="object"?pkg.photos:{}, ph={};
  Object.keys(src2).forEach(id=>{
    const d=src2[id];
    if(!okId(id)){N.note("a photograph with an unsafe id "+shortVal(id)+" was left out");return}
    if(!d||!okImg(d.data)){N.note("photograph "+id+" was not an image and was left out");return}
    const w=toNum(d.w), hh=toNum(d.hh);
    if(w===null||hh===null)N.note("photograph "+id+": a size that was not a number was reset");
    ph[id]=Object.assign({},d,{w:w===null?0:w,hh:hh===null?0:hh});
  });
  pkg.photos=ph;
  return N;
}
