/* ---------- incidents, and what a sketch writes into one ----------
   The main app runs the incident screens; the sketch app adds a marker or a photograph to the
   evidence log of the incident its sketch belongs to. ---------- */
function logAct(kind,text){
  try{ S.activity=(S.activity||[]).slice(-499);
    S.activity.push({t:new Date().toISOString(),who:S.who||"",k:kind,m:String(text).slice(0,200)}) }catch(_){}
}

const DOCPLAN=[
  {key:"entrylog",  form:"Crime scene entry log",  label:"Entry log"},
  {key:"evidence",  form:"Evidence log",           label:"Evidence log"},
  {key:"photolog",  form:"Photograph log",         label:"Photo log"},
  {key:"sketch",    form:null,                     label:"Sketch"},
  {key:"report",    form:"Forensic services report",label:"Report"}
];
function newIncident(){
  const inc={id:newId(),caseNo:"",offence:"",addr:"",
    opened:new Date().toISOString(),closed:"",
    plan:DOCPLAN.map(d=>d.key)};
  (S.incidents=S.incidents||[]).push(inc); saveLocal(); return inc;
}
const incidents=()=>S.incidents||[];
const openIncidents=()=>incidents().filter(i=>!i.closed);
const closedIncidents=()=>incidents().filter(i=>i.closed)
  .sort((a,b)=>String(b.closed).localeCompare(String(a.closed)));
const incidentOf=id=>incidents().find(x=>x.id===id);
// everything attached to one incident, whether exported or not
function docsFor(incId){
  const f=(S.fills||[]).filter(x=>x.incidentId===incId).map(x=>({
    kind:"fill",id:x.id,rec:x,type:x.formName||"Form",exported:!!x.exported}));
  const s=(S.sketches||[]).filter(x=>x.incidentId===incId).map(x=>({
    kind:"sketch",id:x.id,rec:x,type:"Sketch",exported:!!x.exported}));
  return [...f,...s];
}
// what the checklist shows for one planned document
function planState(inc,key){
  const d=DOCPLAN.find(x=>x.key===key); if(!d)return null;
  const mine=docsFor(inc.id).filter(x=>
    d.form? x.type===d.form : x.kind==="sketch");
  if(!mine.length)return {d,state:"none",docs:[]};
  if(mine.every(x=>x.exported||(x.rec&&x.rec.completed)))return {d,state:"done",docs:mine};
  return {d,state:"open",docs:mine};
}

function syncPhoto(sk,o){
  if(!sk||!sk.incidentId||!o||o.t!=="photopoint")return 0;
  const inc=incidentOf(sk.incidentId); if(!inc)return 0;
  const f=S.forms.find(x=>x.name==="Photograph log"); if(!f)return 0;
  const tbl=(f.fields||[]).find(x=>x.type==="table"); if(!tbl)return 0;
  let rec=(S.fills||[]).find(x=>x.incidentId===inc.id&&x.formId===f.id&&!x.exported);
  if(!rec){ rec=newFill(f); rec.incidentId=inc.id;
    const put=(re,v)=>{const fd=(f.fields||[]).find(x=>re.test(x.label)); if(fd&&v)rec.values[fd.id]=v};
    put(/case/i,inc.caseNo); put(/address|scene/i,inc.addr); put(/^date$/i,today()); put(/photographer/i,S.whoName||S.who||"") }
  const rows=Array.isArray(rec.values[tbl.id])?rec.values[tbl.id]:[];
  const num=String(o.n||"").trim(); if(!num)return 0;
  const key=(tbl.cols||[])[0]||"No.";
  let row=rows.find(r=>String((r||{})[key]||"").trim()===num);
  if(!row){row={};row[key]=num;rows.push(row)}
  if(o.label&&o.label.trim())row["What it shows"]=o.label.trim();
  row["Facing"]=compassOf(o.r);
  rec.values[tbl.id]=rows.filter(r=>Object.values(r||{}).some(v=>String(v||"").trim()));
  saveLocal(); return 1;
}
incidents().forEach(i=>{ if(Array.isArray(i.plan)&&!i.plan.includes("photolog")){const k=i.plan.indexOf("evidence"); i.plan.splice(k>-1?k+1:i.plan.length,0,"photolog")} });


// a marker on an incident sketch writes itself into that incident's evidence log
function syncMarker(sk,o){
  if(!sk||!sk.incidentId||o.t!=="marker")return 0;
  const inc=incidentOf(sk.incidentId); if(!inc)return 0;
  const f=S.forms.find(x=>x.name==="Evidence log"); if(!f)return 0;
  const tbl=(f.fields||[]).find(x=>x.type==="table"); if(!tbl)return 0;
  let rec=(S.fills||[]).find(x=>x.incidentId===inc.id&&x.formId===f.id&&!x.exported);
  if(!rec){
    rec=newFill(f); rec.incidentId=inc.id;
    const put=(re,v)=>{const fd=(f.fields||[]).find(x=>re.test(x.label)); if(fd&&v)rec.values[fd.id]=v};
    put(/case/i,inc.caseNo); put(/address|scene/i,inc.addr);
  }
  const rows=Array.isArray(rec.values[tbl.id])?rec.values[tbl.id]:[];
  const num=String(o.n||"").trim(); if(!num)return 0;
  let row=rows.find(r=>String((r||{}).Marker||"").trim()===num);
  if(!row){ row={}; row.Marker=num; rows.push(row) }
  if(o.label&&o.label.trim())row.Item=o.label.trim();
  rec.values[tbl.id]=rows.filter(r=>Object.values(r||{}).some(v=>String(v||"").trim()));
  saveLocal();
  return 1;
}

function offerIncident(sk){
  setTimeout(()=>askConfirm("File it to an incident?",
    "This sketch has a case number but no incident. An incident keeps the entry log, evidence log, sketch and report together and bundles them at the end.",
    "Start incident "+sk.caseNo,false,()=>{
      const inc=newIncident(); inc.caseNo=sk.caseNo; inc.addr=sk.addr||""; inc.offence=sk.offence||"";
      sk.incidentId=inc.id; let n=0; (sk.objs||[]).forEach(o=>{if(o.t==="marker")n+=syncMarker(sk,o)});
      logAct("incident","Started incident "+inc.caseNo+" from a sketch"); save(); if(typeof renderSketch==="function")renderSketch();
      toast("Incident started"+(n?" — markers written to the evidence log":""))}),450);
}


function parseFields(t){
  return (t||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map((l,ix)=>{
    const b=l.split("|").map(x=>x.trim());
    const label=b[0]; let type=(b[1]||"text").toLowerCase();
    if(!FTYPES.includes(type))type="text";
    const cols=type==="table"?(b[2]||"Item").split(",").map(x=>x.trim()).filter(Boolean):null;
    const def=type==="table"?null:(b[2]||"").trim()||null;
    return {id:"f"+ix+"_"+label.toLowerCase().replace(/[^a-z0-9]+/g,"").slice(0,12),label,type,cols,def};
  });
}

function newFill(f){
  const rec={id:newId(),formId:f.id,formName:f.name,rev:f.rev||"",cat:f.cat||"",
    started:new Date().toISOString(),values:{}};
  (f.fields||[]).forEach(x=>{rec.values[x.id]=x.type==="table"?[{}]:x.type==="check"?false:(x.def||"")});
  S.fills.push(rec); saveLocal(); return rec;
}


const unsent=()=>[
  ...(S.fills||[]).filter(f=>!f.exported).map(f=>({name:f.formName||"Filled form",id:f.id})),
  ...(S.sketches||[]).filter(s=>!s.exported&&(s.objs||[]).length)
      .map(s=>({name:s.caseNo?"Sketch "+s.caseNo:"Untitled sketch",id:s.id}))];

function markExported(rec){ if(rec){rec.exported=new Date().toISOString();logAct("export","Exported "+(rec.caseNo||rec.name||"a document"));saveLocal()} }
