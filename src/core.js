 sweep:"M12 5v14M5 12h14",
 forms:"M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6",
 guide:"M4 5a2 2 0 012-2h11a1 1 0 011 1v15a1 1 0 01-1 1H6a2 2 0 01-2-2zM8 7h7M8 11h7",
 active:"M4 6h6v5H4zM14 6h6v5h-6zM4 15h6v3H4zM14 15h6v3h-6z"};

let MEM=null, memOnly=false;
const store={get(){if(MEM)return MEM;
   try{const r=localStorage.getItem("van3")||localStorage.getItem("vaninv2")||localStorage.getItem("vaninv");
     return r?JSON.parse(r):null}catch(e){return null}},
 set(v){try{localStorage.setItem("van3",JSON.stringify(v));MEM=null;if(typeof saveFailed==="function")saveFailed(false);if(typeof savedTick==="function")savedTick()}
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
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const n=v=>+v||0;
const catName=c=>(CATS.find(x=>x[0]===c)||["","Uncategorised"])[1];
ICONS.gear="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z";
const ic=(k,cls)=>`<svg class="${cls||"g"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[k]}"/></svg>`;
let toastT; const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),1900)};

const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
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
  if(typeof render==="function")render();
});

// the date here, not in UTC: see dayStart above
const today=()=>localISO(new Date());

const compassOf=r=>["N","NE","E","SE","S","SW","W","NW"][Math.round((((+r||0)%360)+360)%360/45)%8];
