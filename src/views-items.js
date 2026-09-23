/* ---------- inventory ---------- */
let invGroup="loc", invAll=false;
function renderInventory(){
  $("#title").textContent="Items";
  const L=live();
  if(!L.length){$("#v-inventory").innerHTML=`<div class="empty"><strong>Nothing logged yet</strong>
    <p>Log some items in Sweep and they all show up here.</p></div>`;return}
  const keyOf=i=>invGroup==="loc"?(i.loc||"Unassigned")
    :invGroup==="cat"?(i.cat+" · "+catName(i.cat))
    :invGroup==="cls"?i.cls
    :isOut(i)?"Out of stock":isExpired(i)?"Expired":isLow(i)?"Below par"
    :isService(i)?"Service due":isExpiring(i)?"Expiring soon":"Good";
  const g={};L.forEach(i=>{(g[keyOf(i)]=g[keyOf(i)]||[]).push(i)});
  const opts=[["loc","Compartment"],["cat","Category"],["cls","Class"],["status","Status"],["az","A–Z"]];
  const flag=i=>{const s=itemStatus(i);return `<span class="badge b-${s[0]}">${esc(s[1])}</span>`};
  const rowOf=i=>itemCard(i,flag(i));
  let shown=0; const CAP=invAll?1e9:150;
  const noPar=L.filter(i=>(i.loc||"").trim()&&!String(i.par||"").trim()).length;
  const parWarn=noPar?`<button class="unver" id="gotidy" style="width:100%;text-align:left;display:block">
      <b>${noPar} item${noPar===1?"":"s"} have no par level.</b> Until they do, nothing can be
      reported low and the reorder list stays empty. Tap to fill them in.</button>`:"";
  if(wideNow()){
    const rows=L.slice().sort((a,b)=>{
      const k=invGroup==="loc"?(x=>x.loc||"zz"):invGroup==="cat"?(x=>x.cat):invGroup==="cls"?(x=>x.cls)
        :invGroup==="status"?(x=>itemStatus(x)[0]):(x=>x.name.toLowerCase());
      return String(k(a)).localeCompare(String(k(b)))||a.name.localeCompare(b.name)});
    $("#v-inventory").innerHTML=itemsHead()+parWarn
      +`<div class="filters">${opts.map(([k,l])=>
        `<button data-invg="${k}" class="${invGroup===k?"sel":""}">${l}</button>`).join("")}</div>
      <div class="editbar"><button data-countrun="1">Count the stock</button><button data-scan="open">Scan a label</button></div>
      <div class="panel"><div class="ph2">${L.length} items</div>
      <table class="dt"><thead><tr>
        <th>Item</th><th>Compartment</th><th>Category</th><th>Class</th>
        <th class="num">Par</th><th class="num">In stock</th><th>Status</th></tr></thead><tbody>
      ${rows.map(i=>{const s=itemStatus(i);
        return `<tr data-item="${esc(i.id)}"${i.id===curItem?' class="on"':""}>
          <td class="nm">${esc(i.name)}</td>
          <td class="mono">${esc(i.loc||"—")}</td>
          <td>${esc(catName(i.cat))}</td>
          <td>${esc(i.cls)}</td>
          <td class="num mono">${esc(i.par||"—")}</td>
          <td class="num mono">${esc(i.qty)}</td>
          <td><span class="badge b-${s[0]}">${esc(s[1])}</span></td></tr>`}).join("")}
      </tbody></table></div>`;
    return;
  }
  const kcard=i=>{const s=itemStatus(i);
    return `<button class="kcard" data-item="${esc(i.id)}"><b>${esc(i.name)}</b>
      <span>${esc(i.loc||"—")} &middot; ${esc(i.qty)} in stock</span></button>`};
  const body=invGroup==="az"
    ? `<div class="rows">`+L.slice().sort((a,b)=>a.name.localeCompare(b.name))
        .filter(()=>shown++<CAP).map(rowOf).join("")+`</div>`
    : invGroup==="status"
    ? `<div class="kanban">`+["Out of stock","Expired","Below par","Service due","Expiring soon","Good"]
        .filter(k=>g[k]&&g[k].length).map(k=>{
          const rows=g[k].slice().sort((a,b)=>a.name.localeCompare(b.name));
          return `<div class="kcol"><h3>${esc(k)}<span class="n">${rows.length}</span></h3>${rows.map(kcard).join("")}</div>`
        }).join("")+`</div>`
    : Object.keys(g).sort().map(k=>{
        if(shown>=CAP)return "";
        const rows=g[k].slice().sort((a,b)=>a.name.localeCompare(b.name)).filter(()=>shown++<CAP);
        if(!rows.length)return "";
        return `<div class="sect">${esc(k)} — ${g[k].length}</div>`
          +`<div class="rows">`+rows.map(rowOf).join("")+`</div>`}).join("");
  $("#v-inventory").innerHTML=itemsHead()+parWarn+`<div class="filters">${opts.map(([k,l])=>
    `<button data-invg="${k}" class="${invGroup===k?"sel":""}">${l}</button>`).join("")}</div>
    <div class="editbar"><button data-countrun="1">Count the stock</button><button data-scan="open">Scan a label</button></div>
    <div class="sect">${L.length} items</div>${body}
    ${!invAll&&L.length>CAP?`<button class="btn sec" id="invall" style="margin:14px auto 0">Show all ${L.length}</button>
      <p class="hint" style="text-align:center">Showing the first ${CAP}. Use search to find anything else.</p>`:""}`;
}

/* ---------- guide ---------- */
function renderGuide(){
  $("#title").textContent="Guide";
  const L=live(), withS=L.concat(requests()).filter(i=>(i.steps||[]).length), without=L.filter(i=>!(i.steps||[]).length);
  const reqs=requests().sort((a,b)=>a.name.localeCompare(b.name));
  const reqBlock=`<div class="sect">Available on request — ${reqs.length}</div>`
    +(reqs.length?`<div class="rows">`+reqs.map(i=>`<button class="row" data-item="${esc(i.id)}">
        <span><span class="code">${esc(i.name)}</span>
        <span class="desc">${esc(i.contact||"No contact recorded")}${i.lead?" · "+esc(i.lead):""}</span></span>
        <span class="rt"><span class="badge b-req">On request</span><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`
      :`<div class="empty" style="padding:20px 16px"><strong>Nothing logged</strong>
        <p>Gear you don't carry but can call for — a scanner, a drone, a specialist kit.</p></div>`)
    +`<button class="btn sec" id="addreq" style="margin:9px 0 0;max-width:none">Add something available on request</button>`;
  const bar=`<div class="editbar"><button id="bulkopen">Paste instructions</button>${(()=>{
    const nv=withS.filter(i=>!i.verified||isStale(i)).length;
    return nv?`<button data-verifyrun="1">Verify ${nv} set${nv===1?"":"s"}</button>`:""})()}</div>`;
  const missingList=without.length?`<div class="sect">No instructions yet — ${without.length}</div><div class="rows">`
      +without.slice().sort((a,b)=>a.name.localeCompare(b.name)).slice(0,40).map(i=>
        `<button class="row" data-item="${esc(i.id)}">
          <span><span class="code">${esc(i.name)}</span>
          <span class="desc">${esc(i.loc||"—")} · ${esc(catName(i.cat))}</span></span>
          <span class="rt"><span class="chev">&#8250;</span></span></button>`).join("")
      +`</div>`+(without.length>40?`<p class="hint">Showing 40 of ${without.length}. Work down the list and they move up into the sections above.</p>`:""):"";
  if(!withS.length){$("#v-guide").innerHTML=guideHead()+bar+`<div class="empty"><strong>No instructions yet</strong>
    <p>Add the steps from a manufacturer sheet or your SOP, on any item. Use Paste instructions to do a batch at once.</p></div>`
    +missingList+reqBlock;return}
  const shown=withS.filter(i=>guideFilter==="unver"?!i.verified:guideFilter==="stale"?isStale(i):guideFilter==="ok"?(i.verified&&!isStale(i)):guideFilter==="none"?false:true);
  const g={};shown.forEach(i=>{const k=i.cat+" · "+catName(i.cat);(g[k]=g[k]||[]).push(i)});
  const badge=i=>!i.verified?`<span class="badge b-attn">Unverified</span>`
    :isStale(i)?`<span class="badge b-action">Re-check</span>`
    :`<span class="badge b-good">${esc(i.verified.slice(0,7))}</span>`;
  const stale=withS.filter(isStale).length, unver=withS.filter(i=>!i.verified).length;
  $("#v-guide").innerHTML=guideHead()+bar
    +((stale||unver)?`<div class="unver">${stale?stale+" set"+(stale===1?"":"s")+" of instructions haven't been checked in over a year. ":""}${unver?unver+" have no verified date at all. ":""}Confirm them against the current sheet before relying on them.</div>`:"")
    +(Object.keys(g).length||guideFilter==="none"?"":`<p class="hint">Nothing matches that filter.</p>`)
    +Object.keys(g).sort().map(k=>
    `<div class="sect">${esc(k)}</div><div class="rows">`+g[k].sort((a,b)=>a.name.localeCompare(b.name)).map(i=>
      `<button class="row" data-item="${esc(i.id)}">
        <span><span class="code">${esc(i.name)}</span>
        <span class="desc">${[(i.steps||[]).length+" steps", i.loc?esc(i.loc):"", i.source?esc(i.source):""].filter(Boolean).join(" · ")}</span></span>
        <span class="rt">${badge(i)}<span class="chev">&#8250;</span></span></button>`).join("")+`</div>`).join("")
    +missingList+reqBlock}


/* ---------- bulk instructions ---------- */
const STALE_MONTHS=12;
function verifyAge(i){ if(!i.verified)return null;
  const t=dayStart(i.verified); if(isNaN(t))return null;
  return (startOfToday()-t)/86400000/30.44 }
const isStale=i=>{const m=verifyAge(i);return m!==null&&m>STALE_MONTHS};

function parseGuides(text){
  const byName={}; live().forEach(i=>{byName[i.name.trim().toLowerCase()]=i});
  const blocks=[]; let cur=null, afterBlank=true;
  const isStep=l=>/^\s*(?:[-*\u2022]|\d+[.)])\s+/.test(l);
  const strip=l=>l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/,"").trim();
  text.split(/\r?\n/).forEach(raw=>{
    const l=raw.trim();
    if(!l){afterBlank=true;return}
    const attr=/^(source|verified)\s*:/i.exec(l);
    if(attr&&cur){cur[attr[1].toLowerCase()]=l.slice(l.indexOf(":")+1).trim();afterBlank=false;return}
    if(afterBlank&&!isStep(l)){
      const hit=byName[l.toLowerCase().replace(/:$/,"")];
      cur={item:hit||null,name:l,steps:[],source:"",verified:""};
      blocks.push(cur);afterBlank=false;return;
    }
    if(cur)cur.steps.push(isStep(l)?strip(l):l);
    afterBlank=false;
  });
  return blocks;
}
function applyGuides(text){
  const blocks=parseGuides(text);
  const good=blocks.filter(b=>b.item&&b.steps.length);
  const miss=blocks.filter(b=>!b.item&&b.steps.length).map(b=>b.name);
  good.forEach(b=>{b.item.steps=b.steps;
    if(b.source)b.item.source=b.source;
    if(b.verified&&/^\d{4}-\d{2}-\d{2}$/.test(b.verified))b.item.verified=b.verified});
  if(good.length)save();
  return {n:good.length,miss:[...new Set(miss)]};
}
function bulkSheet(){
  openSheet(`<h3>Paste instructions</h3>
    <p style="margin:0 0 12px;color:var(--ink2);font-size:14.5px;line-height:1.5">
      Write them on a computer and paste the lot in one go. Start each block with the item's exact name, then the steps. Leave a blank line between items.</p>
    <pre class="fmt">Black magnetic powder, 1 lb
source: 3M IFU rev C
verified: 2026-09-02
- Load the applicator from the jar
- Pass over the surface without touching
- Photograph with a scale before lifting

Phenolphthalein kit
source: SOP 4.2
- Collect a sample on a clean swab</pre>
    <textarea id="bulk" rows="9" placeholder="Paste here"></textarea>
    <div id="bulkout"></div>
    <button class="btn" id="bulkgo" style="max-width:none;margin-top:10px">Apply</button>
    <button class="btn sec" id="bulkx" style="max-width:none">Cancel</button>`);
  $("#bulkx").onclick=closeSheet;
  $("#bulkgo").onclick=()=>{
    const r=applyGuides($("#bulk").value);
    if(!r.n&&!r.miss.length)return toast("Nothing to apply");
    $("#bulkout").innerHTML=`<div class="${r.miss.length?"unver":"okbox"}" style="margin-top:10px">
      ${r.n} item${r.n===1?"":"s"} updated.${r.miss.length?
        " These names didn't match anything in the van: "+esc(r.miss.slice(0,8).join("; "))+
        (r.miss.length>8?" and "+(r.miss.length-8)+" more.":""):""}</div>`;
  };
}

/* ---------- gaps ---------- */
function gapSheet(existing){
  const i=existing;
  openSheet(`<h3>${i?"Edit gap":"Something we don't carry"}</h3>
    <label class="fld"><span>Item</span><input type="text" id="gn" value="${i?esc(i.name):""}" placeholder="Electrostatic dust lifter"></label>
    <label class="fld"><span>Category</span><select id="gc">${CATS.map(c=>
      `<option value="${c[0]}"${i&&c[0]===i.cat?" selected":""}>${c[0]} · ${c[1]}</option>`).join("")}</select></label>
    <label class="fld"><span>Why not carried</span><select id="gt">
      <option value="gap"${i&&i.gapType==="gap"?" selected":(!i?"":"")}>Gap — we should have it</option>
      <option value="request"${i&&i.gapType==="request"?" selected":""}>Available on request — someone else has it</option>
      <option value="deliberate"${i&&i.gapType==="deliberate"?" selected":""}>Deliberate — we don't need it</option></select></label>
    <label class="fld"><span>Note</span><textarea id="go" rows="3" placeholder="Cost, who to ask, why not">${i?esc(i.note):""}</textarea></label>
    <button class="btn" id="gsave" style="max-width:none;margin:0">${i?"Save":"Log it"}</button>
    ${i?`<button class="btn sec" id="gdel" style="max-width:none;color:var(--red);border-color:var(--red)">Delete</button>`:""}
    <button class="btn sec" id="gcancel" style="max-width:none">Cancel</button>`);
  $("#gcancel").onclick=closeSheet;
  if(i)$("#gdel").onclick=()=>askConfirm("Delete","Remove "+i.name+" from the list.","Delete",true,()=>{
    S.items=S.items.filter(x=>x.id!==i.id);save();view="home";renderList("gaps");toast("Deleted")});
  $("#gsave").onclick=()=>{
    const nm=$("#gn").value.trim(); if(!nm)return toast("Needs a name");
    if(i)Object.assign(i,{name:nm,cat:$("#gc").value,gapType:$("#gt").value,note:$("#go").value.trim()});
    else S.items.push({id:newId(),name:nm,loc:"",cat:$("#gc").value,cls:"Consumable",qty:0,par:"",
      date:"",status:"Not carried",gapType:$("#gt").value,note:$("#go").value.trim(),
      steps:[],source:"",verified:"",uses:[],fav:false,rel:[],links:[],contact:"",phone:"",lead:""});
    save();closeSheet();
    const t=$("#gt")?$("#gt").value:"gap";
    if(t==="request"){view="guide";$$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-guide"));render()}
    else {view="home";renderList("gaps")}
    toast(i?"Saved":"Logged")};
}

/* ---------- data and backup ---------- */
const COLS=["name","loc","cat","cls","qty","par","date","status","gapType","note","source","verified"];
const HEAD=["Item","Compartment","Category","Class","Qty","Par","Date","Status","Gap type","Note","Source","Verified"];
const cell=v=>{v=String(v??"");return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCSV=()=>[HEAD.concat("Instructions").join(",")].concat(
  S.items.map(i=>COLS.map(c=>cell(i[c])).concat(cell((i.steps||[]).join(" | "))).join(","))).join("\n");
function parseCSV(t){const rows=[];let row=[],f="",q=false;
  for(let x=0;x<t.length;x++){const c=t[x];
    if(q){if(c==='"'){if(t[x+1]==='"'){f+='"';x++}else q=false}else f+=c}
    else if(c==='"')q=true; else if(c===","){row.push(f);f=""}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&t[x+1]==="\n")x++;row.push(f);f="";
      if(row.some(v=>v!==""))rows.push(row);row=[]}
    else f+=c}
  row.push(f);if(row.some(v=>v!==""))rows.push(row);return rows}
function download(text,name,type){
  try{const b=new Blob([text],{type});const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
    S.lastBackup=today();save();return true}catch(e){return false}}
// with sync on, what is on this device is also on every other device, so a backup must not
// replace it: a replace turned everything added since the backup into deletions for the whole
// unit and put old values over newer ones. Only what is missing here comes back.
function missingFrom(o){
  const clean=r=>{const c=Object.assign({},r);Object.keys(c).forEach(k=>{if(k[0]==="_")delete c[k]});return c};
  const miss=(list,have,key)=>rows(list).filter(r=>r[key]!=null&&r[key]!==""&&!have.some(x=>String(x[key])===String(r[key]))).map(clean);
  return {items:miss(o.items,S.items,"id"),comps:miss(o.comps,S.comps,"code"),forms:miss(o.forms,S.forms,"id")};
}
const countOf=(n,one,many)=>n+" "+(n===1?one:many);
const missingText=m=>[countOf(m.items.length,"item","items"),countOf(m.comps.length,"compartment","compartments"),
  countOf(m.forms.length,"form","forms")].join(", ");
function ingest(text,replace){
  text=(text||"").trim(); if(!text)return toast("Nothing pasted");
  if(text[0]==="{"){let o;try{o=JSON.parse(text)}catch(e){return toast("That backup didn't parse")}
    if(!o.items)return toast("No items in that file");
    const N=cleanVan(o,"the backup");
    if(ghOn()){
      const m=missingFrom(o);
      S.items=S.items.concat(m.items); S.comps=S.comps.concat(m.comps); S.forms=S.forms.concat(m.forms);
      nameComps(); save(); renderData();
      return toast("Added "+missingText(m)+" that were missing. Nothing was replaced, because sync is on."+tellBad(N))}
    if(replace){S.items=o.items;S.comps=o.comps||[];S.forms=o.forms||[];if(o.walls)S.walls=o.walls;S.demo=!!o.demo}
    else o.items.forEach(x=>{x.id=newId();S.items.push(x)});
    nameComps();
    save();renderData();return toast(o.items.length+" items "+(replace?"restored":"added")+"."+tellBad(N))}
  const rows=parseCSV(text); if(rows.length<2)return toast("Nothing to import");
  const add=[], N=makeNote("the CSV");
  rows.slice(1).forEach(r=>{if(!r[0]||!r[0].trim())return;
    const o={id:newId(),uses:[],fav:false};
    COLS.forEach((c,j)=>o[c]=(r[j]??"").trim());
    o.qty=n(o.qty); o.steps=(r[COLS.length]||"").split(" | ").map(s=>s.trim()).filter(Boolean);
    if(!STATUSES.includes(o.status))o.status="Stocked";
    if(!CATS.some(c=>c[0]===o.cat))o.cat="A";
    if(!CLASSES.includes(o.cls))o.cls="Consumable";
    // a compartment code becomes an attribute and a synced key, so it has to be a safe one
    if(o.loc&&!okId(o.loc)){N.note("row "+shortVal(o.name)+" named compartment "+shortVal(o.loc)+", which is not a usable code, so it was left unplaced");o.loc=""}
    add.push(o)});
  if(replace)S.items=add; else S.items=S.items.concat(add);
  add.forEach(o=>{if(o.loc&&!S.comps.some(c=>c.code===o.loc))
    S.comps.push({code:o.loc,desc:"",side:"",x:null,y:null,w:6,h:4})});
  save();renderData();toast(add.length+" rows "+(replace?"loaded":"added")+"."+tellBad(N));
}
// the share sheet puts the file straight into Drive or Mail; download is the fallback
async function backupOut(){
  // van data only, named one field at a time. Copying the whole record and deleting what
  // should not go let incidents, the activity log, handover notes and sketch templates ride
  // along to Drive or Mail, and anything added to the record later would have followed.
  const safe={backup:"van",version:APP_VERSION,savedAt:new Date().toISOString(),vanName:S.vanName||"",
    items:(S.items||[]).map(i=>{const c=Object.assign({},i);delete c.dupOf;return c}),
    comps:S.comps||[],
    forms:(S.forms||[]).map(f=>{const c=Object.assign({},f);delete c.fills;return c}),   // an old build kept filled copies inside the form
    walls:S.walls,demo:!!S.demo};
  const text=JSON.stringify(safe,null,1);
  const name="van-backup-"+today()+".json";
  const mark=()=>{S.lastBackup=today();save();renderData()};
  try{
    const file=new File([text],name,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:"Van backup "+today()});
      mark();return toast("Sent \u2014 save it in Van app backups");
    }
  }catch(err){ if(err&&err.name==="AbortError")return; }
  if(download(text,name,"application/json")){mark();return toast("Backup downloaded")}
  toast("Blocked \u2014 use Copy CSV instead");
}
function tokenDays(){
  if(!S.ghExp)return null;
  return daysOut(S.ghExp);
}
// an edit of yours that another device's edit replaced. It is kept rather than dropped, so
// the only thing lost is the time it takes somebody to say which of the two is true.
function conflictsHTML(){
  const c=S.conflicts||[]; if(!c.length)return "";
  return `<div class="unver bad">${c.length===1
      ?"One of your edits was replaced by another device."
      :c.length+" of your edits were replaced by another device."} Your version is kept here until
      you say which one is right.</div>
    <div style="margin:0 0 12px">${c.map((x,i)=>`<div class="cfrow">
      <span class="cfn">${esc(x.name||x.key)}<i>${esc(String(x.when||"").slice(0,16).replace("T"," "))}</i></span>
      <span class="cfb"><button class="btn sec" data-cback="${i}">Put mine back</button>
        <button class="btn sec" data-cdrop="${i}">Keep theirs</button></span></div>`).join("")}</div>`;
}
function tokenPill(){
  const d=tokenDays(); if(d==null)return "";
  if(d<0)return `<span class="warnpill" style="background:var(--redbg);color:var(--red)">Expired \u2014 reconnect</span>`;
  if(d<=30)return `<span class="warnpill">${d} day${d===1?"":"s"} left</span>`;
  return `<span class="okpill">${d} days left</span>`;
}
// one graphic per document type, keyed off the form name
const DOCICON={
 evidence:'<path d="M8.2 4h7.6l2.2 12.2a1 1 0 01-1 1.2H7a1 1 0 01-1-1.2z"/><path d="M6.2 17.4L4.6 21h14.8l-1.6-3.6"/><path d="M11 9.4l1.5-1v4.2"/><path d="M10.9 12.6h3.2"/>',
 entry:'<path d="M3 8.6h18v4.4H3z"/><path d="M7.2 8.6l2.4 4.4M12 8.6l2.4 4.4M16.8 8.6l2.4 4.4"/><path d="M4.6 8.6V4.4M19.4 8.6V4.4M4.6 13v6.6M19.4 13v6.6"/>',
 report:'<path d="M7 3h7l4.6 4.6V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4.6h4.6"/><path d="M9 12.2h6M9 15.4h6M9 18.2h3.4"/>',
 sketch:'<path d="M3.4 4.4h17.2v15.2H3.4z"/><path d="M3.4 12.6h6.4V4.4"/><path d="M14.6 8.6h2.6v3.4h-2.6z"/><circle cx="6.6" cy="16.6" r="1.5"/>'};
function docKind(kind,name){
  if(kind==="sketch")return "sketch";
  const s=String(name||"").toLowerCase();
  if(s.includes("evidence"))return "evidence";
  if(s.includes("entry"))return "entry";
  return "report";
}
const docIcon=k=>`<svg class="dg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${DOCICON[k]||DOCICON.report}</svg>`;
function renderActive(){
  if(!document.getElementById("v-active"))return;   // that view is on the other page
  $("#title").textContent="Scenes";
  if(scenesTab==="closed"){ renderForms(); $("#v-active").innerHTML=scenesHead()+$("#v-forms").innerHTML; $("#title").textContent="Scenes"; return }
  const incs=openIncidents(), loose=openDocs();
  if(!incs.length&&!loose.length){
    $("#v-active").innerHTML=scenesHead()+`<div class="empty"><strong>Nothing open</strong>
      <p>Start an incident and the app keeps its forms and sketches together,
         then bundles them into one report. Closed ones stay under Closed.</p>
      <button class="btn" data-newinc="1">Start an incident</button></div>`;
    return;
  }
  $("#v-active").innerHTML=scenesHead()
    +(isIPadLike()?activeSpotlightHTML(incs,loose):!document.body.classList.contains("wide")?activeCardsHTML(incs,loose):activeTableHTML(incs,loose));
}
function incProgress(inc){
  const plan=(inc.plan||[]).map(k=>planState(inc,k)).filter(Boolean);
  const done=plan.filter(p=>p.state==="done").length;
  const open=plan.filter(p=>p.state==="open").length;
  return {plan,done,open};
}
/* iPad: one big card for the incident you were last working, everything else a plain list below */
function activeSpotlightHTML(incs,loose){
  const withP=incs.map(inc=>Object.assign({inc},incProgress(inc)));
  withP.sort((a,b)=>(b.open-a.open)||((a.done/(a.plan.length||1))-(b.done/(b.plan.length||1))));
  const top=withP[0], rest=withP.slice(1);
  const pct=top&&top.plan.length?Math.round(100*top.done/top.plan.length):0;
  const hero=top?`<div class="hero2">
      <span class="k">Continue where you left off</span>
      <h2>${esc(top.inc.caseNo||"No case number")} &middot; ${esc(top.inc.offence||"No offence recorded")}</h2>
      <span class="s">${esc(top.inc.addr||"No address")}</span>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <span class="barlab">${top.done} of ${top.plan.length} done${top.open?", "+top.open+" in progress":""}</span>
      <button class="herocta" data-inc="${esc(top.inc.id)}">Continue &rarr;</button>
    </div>`:"";
  const restRow=x=>`<div class="urow"><span>${esc(x.inc.caseNo||"No case number")} &middot; ${esc(x.inc.offence||"No offence recorded")}</span>
    <span class="lc" data-inc="${esc(x.inc.id)}">${x.done===x.plan.length&&x.plan.length?"Done":x.done+" of "+x.plan.length}</span></div>`;
  const looseRow=d=>`<div class="urow"><span>${esc(d.caseNo||"No case number")} &middot; ${esc(d.type)}</span>
    <span class="lc" data-doc="${d.kind}:${esc(d.id)}">Open</span></div>`;
  const also=(rest.length||loose.length)?`<div class="card2"><h4>Also open</h4>
    ${rest.map(restRow).join("")}${loose.map(looseRow).join("")}</div>`:"";
  return hero+also;
}
/* phone: one tappable card per incident, nothing squeezed into columns */
function activeCardsHTML(incs,loose){
  const row=(attr,title,sub,prog,dot)=>`<button class="act inccard" ${attr}><span class="ic1"><b>${title}</b><span class="ic2">${sub}</span>
    <span class="ic3"><span class="dot ${dot}"></span>${prog}</span></span><span class="chev">&#8250;</span></button>`;
  return `<div class="panel"><div class="pb">`+incs.map(inc=>{const x=incProgress(inc);
      return row(`data-inc="${esc(inc.id)}"`,esc(inc.caseNo||"No case number")+" &middot; "+esc(inc.offence||"No offence recorded"),
        esc(inc.addr||"No address"),x.done+" of "+x.plan.length+" done"+(x.open?", "+x.open+" in progress":""),
        x.open?"a":(x.done===x.plan.length&&x.plan.length?"g":"n"))}).join("")
    +loose.map(d=>row(`data-doc="${d.kind}:${esc(d.id)}"`,esc(d.caseNo||"No case number")+" &middot; "+esc(d.type),
        "Not filed to an incident","Not exported","a")).join("")+`</div></div>`;
}
/* desktop: everything as one dense table, built for the back office */
function activeTableHTML(incs,loose){
  const withP=incs.map(inc=>Object.assign({inc},incProgress(inc)));
  const incRow=x=>`<tr><td>${esc(x.inc.caseNo||"No case number")}</td><td>${esc(x.inc.offence||"No offence recorded")}</td>
    <td>${esc(x.inc.addr||"No address")}</td>
    <td><span class="dot ${x.open?"a":(x.done===x.plan.length&&x.plan.length?"g":"n")}"></span>${x.done} of ${x.plan.length} done${x.open?", "+x.open+" in progress":""}</td>
    <td class="lc" data-inc="${esc(x.inc.id)}">Open &rsaquo;</td></tr>`;
  const looseRow=d=>`<tr><td>${esc(d.caseNo||"No case number")}</td><td>${esc(d.type)}</td>
    <td>Not filed to an incident</td>
    <td><span class="dot a"></span>Not exported</td>
    <td class="lc" data-doc="${d.kind}:${esc(d.id)}">Open &rsaquo;</td></tr>`;
  return `<div class="panel"><div class="ph2">Incidents and documents</div><div class="pb flush">
      <table class="datatable"><thead><tr><th>Case</th><th>Type</th><th>Detail</th><th>Progress</th><th></th></tr></thead>
      <tbody>${withP.map(incRow).join("")}${loose.map(looseRow).join("")}</tbody></table>
    </div></div>`;
}
function renderIncident(){
  if(!document.getElementById("v-incident"))return;   // that view is on the other page
  const inc=incidentOf(curInc);
  if(!inc){view="active";return renderActive()}
  $("#title").textContent=inc.caseNo||"Incident";
  const plan=(inc.plan||[]).map(k=>planState(inc,k)).filter(Boolean);
  const extras=docsFor(inc.id).filter(x=>!plan.some(p=>p.docs.some(d=>d.id===x.id)));
  const row=p=>{
    const lab={none:"Not started",open:"In progress",done:"Complete"}[p.state];
    const cls={none:"b-unchecked",open:"b-attn",done:"b-good"}[p.state];
    return `<button class="row" data-plan="${p.d.key}">
      <span><span class="code">${esc(p.d.label)}</span>
      <span class="desc">${p.docs.length?p.docs.length+" started":"Nothing yet"}</span></span>
      <span class="rt"><span class="badge ${cls}">${lab}</span><span class="chev">&#8250;</span></span>
    </button>`;
  };
  $("#v-incident").innerHTML=`
    <button class="back" data-navback="active">&#8249; Scenes</button>
    <div class="acttile" style="text-align:left">
      <div class="ai"><h2>${esc(inc.caseNo||"No case number")}</h2>
        <div class="sub">${esc(inc.offence||"No offence recorded")}</div>
        <div class="sub">${esc(inc.addr||"No address")}</div></div>
      <div class="ak">${docIcon("report")}</div>
    </div>
    <div class="editbar">
      <button data-incbundle="1" class="on">Export bundle</button>
      <button data-incedit="1">Incident details</button>
      <button data-incclose="1">${inc.closed?"Reopen":"Close incident"}</button>
      <button data-incdel="1" class="danger">Delete incident</button></div>
    <div class="sect">Documents</div>
    <div class="rows">${plan.map(row).join("")}</div>
    ${extras.length?`<div class="sect">Also attached</div><div class="rows">`
      +extras.map(x=>`<button class="row" data-doc="${x.kind}:${esc(x.id)}">
        <span><span class="code">${esc(x.type)}</span>
        <span class="desc">${x.exported?"Exported":"In progress"}</span></span>
        <span class="rt"><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`:""}`;
}
function incidentSheet(inc){
  openSheet(`<h3>Incident details</h3>
    <p class="hint" style="margin:0 0 14px">Every document started from this incident inherits these.</p>
    <label class="fld"><span>Case number</span>
      <input type="text" id="inc" value="${esc(inc.caseNo||"")}" placeholder="2026-0912"></label>
    <label class="fld"><span>Offence or incident</span>
      <input type="text" id="ino" value="${esc(inc.offence||"")}" placeholder="Death investigation"></label>
    <label class="fld"><span>Scene address</span>
      <input type="text" id="ina" value="${esc(inc.addr||"")}"></label>
    <button class="btn" id="insave" style="max-width:none;margin:0">Save</button>
    <button class="btn sec" id="inx" style="max-width:none">Cancel</button>`);
  $("#inx").onclick=closeSheet;
  $("#insave").onclick=()=>{
    inc.caseNo=$("#inc").value.trim(); inc.offence=$("#ino").value.trim();
    inc.addr=$("#ina").value.trim(); save(); closeSheet(); renderIncident(); toast("Saved")};
}
/* the settings page: a menu of sections, each opening on its own */
let SET_SEC=null;
function openSettings(sec){SET_SEC=sec||null;go("data");window.scrollTo&&window.scrollTo(0,0)}
const SET_TITLES={who:"Initials and name",sync:"Automatic saving",backup:"Back up",restore:"Restore or import",
  case:"Case material",labels:"Labels and web address",device:"This device",activity:"Activity",errors:"Recent errors",reset:"Reset"};
function settingsMenu(){
  const L=live();
  const stale=!S.lastBackup||(Date.now()-Date.parse(S.lastBackup))/86400000>7;
  const td=tokenDays();
  const row=(attr,name,sum,cls)=>`<button class="scard${cls?" "+cls:""}" ${attr}><span class="sn">${name}</span><span class="ss">${sum}</span></button>`;
  const sec=(k,name,sum,cls)=>row(`data-setsec="${k}"`,name,sum,cls);
  const group=(t,rows)=>rows.length?`<div class="sect">${t}</div><div class="scardgrid">${rows.join("")}</div>`:"";
  const whoTxt=S.who?esc(S.who)+(S.whoName?" \u00b7 "+esc(S.whoName):""):"Not set";
  let syncTxt="Not connected", syncCls="";
  if(ghOn()){
    const nc=(S.conflicts||[]).length;
    // a stored expiry date that has passed is a warning; only GitHub saying 401 stops saving
    if(tokenBad){syncTxt="Token expired, saving stopped";syncCls="bad"}
    else if(badFile){syncTxt="The file in the repo can't be read";syncCls="bad"}
    else if(nc){syncTxt=nc+" edit"+(nc===1?"":"s")+" of yours needs a decision";syncCls="warn"}
    else if(conflict){syncTxt="Couldn't settle, try again";syncCls="bad"}
    else if(td!=null&&td<0){syncTxt="The token may have expired";syncCls="warn"}
    else if(td!=null&&td<=30){syncTxt="Token expires in "+td+" day"+(td===1?"":"s");syncCls="warn"}
    else syncTxt=S.gh.last?"Connected \u00b7 synced "+esc(S.gh.last.slice(11,16)):"Connected";
  }
  const bkTxt=S.lastBackup?"Last "+esc(S.lastBackup):"Never";
  const themeTxt=(S.theme||"auto")==="auto"?"Matching the device":(S.theme==="dark"?"Dark":"Light");
  const modeTxt=(S.mode||"auto")==="auto"?"layout matches the screen":(S.mode==="phone"?"handheld layout":"desktop layout");
  const stor=!storageState.asked?"Checking\u2026":storageState.persisted?"Storage kept by the browser":"Storage can be cleared";
  const inst=isStandalone()?"installed":"not on the home screen";
  const nErr=(S.errors||[]).length, nAct=(S.activity||[]).length;
  const lastAct=nAct?S.activity[nAct-1]:null;
  // Automatic saving covers the whole shared record and keeps working in the background on
  // whichever page enabled it, but the switch itself, the backup file and Reset are van-domain,
  // so they only appear in FSU's Settings; Scenes gets its own case/forms group instead.
  return `<div class="hhead"><b>${PAGE==="van"?esc(S.vanName||"Forensic Services Unit"):"Scenes"}</b><span>Version ${esc(APP_VERSION)}</span>
      <span>${S.who?"Signed in as "+esc(S.who):"No initials set"}</span></div>
    <div class="setblocks">
    ${group("You",[sec("who","Initials and name",whoTxt,S.who?"":"warn")])}
    ${PAGE==="van"?group("Van data",[
      sec("sync","Automatic saving",syncTxt,syncCls),
      sec("backup","Back up",bkTxt,L.length&&stale?"warn":""),
      sec("restore","Restore or import","From a backup file or CSV")]):""}
    ${PAGE==="scenes"?group("Scenes",[
      sec("case","Case packages",S.lastCase?"Last "+esc(S.lastCase.slice(0,10)):"None saved yet"),
      row('data-go="templates"',"Form templates",S.forms.length+" blank form"+(S.forms.length===1?"":"s")),
      row('data-snipmanage="1"',"Report wording","Standard sentences for reports"),
      row('data-go="map"',"Map","Williamsport's buildings in 3D")]):""}
    ${group("This device",[
      row('id="modebtn"',"Display",themeTxt+", "+modeTxt+(landscapeOnly()?", landscape only":"")),
      PAGE==="van"?sec("labels","Labels and web address",appUrl()?esc(appUrl().replace(/^https?:\/\//,"")):"No web address"):"",
      sec("device","Storage and install",stor+", "+inst,storageState.asked&&!storageState.persisted?"warn":""),
      sec("activity","Activity",lastAct?"Last "+esc(String(lastAct.t||"").slice(0,10)):"Nothing yet"),
      sec("errors","Recent errors",nErr?nErr+" recorded":"None",nErr?"warn":"")].filter(Boolean))}
    ${group("About",[row('data-help="1"',"Help and change log","How to use it, what changed")])}
    ${PAGE==="van"?group("Reset",[
      S.demo?sec("reset","Clear sample data","Sample compartments and items"):"",
      sec("reset","Erase everything","Every item and compartment","danger")].filter(Boolean)):""}
    </div>`;
}
/* scenes: a nav column of the same sections, with the picked one open beside it */
function settingsNav(){
  const whoTxt=S.who?esc(S.who)+(S.whoName?" · "+esc(S.whoName):""):"Not set";
  const cur=SET_SEC||"who";
  const item=(k,name,attr)=>`<button class="${cur===k?"on":""}" ${attr||`data-setsec="${k}"`}>${name}</button>`;
  const grp=t=>`<div class="grp">${t}</div>`;
  return `<div class="navcol">
    <b class="navtitle">Settings</b>
    ${grp("You")}
    ${item("who","Initials and name")}
    ${grp("Scenes")}
    ${item("case","Case packages")}
    ${item(null,"Form templates",'data-go="templates"')}
    ${item(null,"Report wording",'data-snipmanage="1"')}
    ${item(null,"Map",'data-go="map"')}
    ${grp("This device")}
    ${item(null,"Display",'id="modebtn"')}
    ${item("device","Storage and install")}
    ${item("activity","Activity")}
    ${item("errors","Recent errors")}
    ${grp("About")}
    ${item(null,"Help and change log",'data-help="1"')}
  </div>`;
}
function settingsSplit(){
  if(!SET_SEC||!SET_TITLES[SET_SEC])SET_SEC="who";
  return `<div class="hhead"><b>Scenes</b><span>Version ${esc(APP_VERSION)}</span>
      <span>${S.who?"Signed in as "+esc(S.who):"No initials set"}</span></div>
    <div class="setsplit">${settingsNav()}<div class="setdetail">${settingsSectionBody(SET_SEC)}</div></div>`;
}
function settingsSection(k){
  return `<button class="back" data-setback="1">&#8249; Settings</button>
    <div class="setsec">${settingsSectionBody(k)}</div>`;
}
function settingsSectionBody(k){
  const L=live(), gp=S.items.filter(i=>i.status==="Not carried");
  const stale=!S.lastBackup||(Date.now()-Date.parse(S.lastBackup))/86400000>7;
  let body="";
  if(k==="who")body=`
    <label class="fld"><span>Initials, recorded against sweeps, counts, verifications and exports</span>
      <input type="text" id="whoin" value="${esc(S.who||"")}" placeholder="DA" autocapitalize="characters" maxlength="6"></label>
    <label class="fld"><span>Name and rank, as it should appear on reports</span>
      <input type="text" id="whoname" value="${esc(S.whoName||"")}" placeholder="Det. D. Alvarez #417"></label>
    <p class="hint">Saved as you type. Each device carries its own initials, so set them on every device you use.</p>`;
  else if(k==="sync")body=(ghOn()&&!tokenBad)?`
      <div class="kv" style="margin-bottom:9px">
        <div><dt>Repository</dt><dd>${esc(S.gh.owner)}/${esc(S.gh.repo)}</dd></div>
        <div><dt>Last synced</dt><dd><span id="syncpill" class="syncpill"></span></dd></div>
        ${S.ghExp?`<div><dt>Token expires</dt><dd>${tokenPill()}</dd></div>`:""}
      </div>
      ${!S.ghExp?`<p class="hint" style="margin:0 0 10px">GitHub did not say when this token
        expires. <button class="lnkbtn" id="ghsetexp">Add the date</button> and the app will warn
        you before it lapses.</p>`:""}
      ${badFile?`<div class="unver bad">The file in the
        repo will not open. Nothing has been overwritten and nothing on this device is lost. If no
        other device is waiting to sync, replace it with this device's copy.</div>
        <button class="btn sec" id="ghforce" style="max-width:none;margin:0 0 12px;color:var(--red);border-color:var(--red)">Replace the file with this device's copy</button>`:""}
      ${conflict?`<div class="unver bad">Another device
        kept writing while this one was trying to. Nothing is lost — press Sync now again.</div>`:""}
      ${conflictsHTML()}
      <div class="stackb">
        <button class="btn" id="ghpush" style="max-width:none;margin:0">Sync now</button>
        <button class="btn sec" id="ghoff" style="max-width:none">Disconnect this device</button></div>
      <p class="hint">Changes save themselves a couple of seconds after you make them. Every device
        keeps its own edits: two people working at once no longer overwrite each other, and every
        version stays in the repo's history.</p>`
    :`${tokenBad?`<div class="unver bad">The access
        token has expired or been revoked, so saving to GitHub has stopped. Everything you have done
        since is still on this device and will go up as soon as you paste a working token.</div>`
      :`<p class="hint" style="margin-top:0">Connect once and every change saves itself to a private
      repo a couple of seconds after you make it — no sign-in after the first time, and any
      other device you connect reads the same list.</p>`}
      <div class="two"><label class="fld"><span>Owner</span><input type="text" id="gho" value="${esc(S.ghOwner||S.gh.owner||"drfllcky13-droid")}" autocapitalize="off"></label>
        <label class="fld"><span>Repository</span><input type="text" id="ghr" value="${esc(S.ghRepo||S.gh.repo||"van-data")}" autocapitalize="off"></label></div>
      <label class="fld"><span>Access token</span><input type="password" id="ght" placeholder="github_pat_..." autocapitalize="off"></label>
      <button class="btn" id="ghconnect" style="max-width:none;margin:0">${tokenBad?"Reconnect":"Connect"}</button>
      ${tokenBad?`<button class="btn sec" id="ghoff" style="max-width:none">Disconnect this device</button>`:""}
      <p class="hint">A fine-grained token from GitHub › Settings › Developer settings, with
        access to that repository only and Contents set to read and write. Take the longest expiry
        offered; the app reads the expiry date from GitHub itself and warns you before it lapses.
        The token is stored in this browser only. It never leaves the device except to talk to
        GitHub, and it is left out of backup files, exports and case packages.</p>`;
  else if(k==="backup")body=`
    <div class="kv" style="margin-bottom:12px">
      <div><dt>Items</dt><dd>${L.length}</dd></div>
      <div><dt>Compartments</dt><dd>${S.comps.length}</dd></div>
      <div><dt>Gaps logged</dt><dd>${gp.length}</dd></div>
      <div><dt>Forms</dt><dd>${S.forms.length}</dd></div>
      <div><dt>Last backup</dt><dd>${esc(S.lastBackup||"never")}</dd></div>
    </div>
    ${L.length&&stale?`<div class="unver" style="margin-bottom:12px">No backup taken in over a week. Download one and put it somewhere off this device.</div>`:""}
    <div class="stackb">
      <button class="btn" id="dlj" style="max-width:none;margin:0">Back up now</button>
      <button class="btn sec" id="dlc" style="max-width:none">Download CSV</button>
      <button class="btn sec" id="cpc" style="max-width:none">Copy CSV</button></div>
    <p class="hint">Back up now opens the share sheet. Choose Drive and save it into
      <b>FSU &rsaquo; Van app backups</b>. The file holds everything \u2014 items, instructions,
      compartments, wall layout and your form templates. The CSV is items only, for a spreadsheet.
      Losing or wiping the device still loses the data, so keep a backup somewhere else.</p>`;
  else if(k==="restore")body=`
    <p class="hint" style="margin:0 0 10px">${ghOn()
      ?"Sync is on, so restoring a backup file only adds what is missing: items, compartments and forms in the file that are not on this device. Nothing here is replaced or deleted, on this device or any other. To start over from a backup, disconnect sync first. A CSV of items is added as new rows."
      :"Paste a backup file to bring a van back, or a CSV of items. Add rows keeps what is here; Replace everything starts over from the file."}</p>
    <textarea id="imp" rows="5" placeholder="Paste a backup file or CSV here"></textarea>
    <div class="stackb" style="margin-top:10px">
      <button class="btn sec" id="impadd" style="max-width:none;margin:0">Add rows</button>
      <button class="btn sec" id="imprep" style="max-width:none">${ghOn()?"Restore what is missing":"Replace everything"}</button></div>`;
  else if(k==="case")body=`
    <p class="hint" style="margin:0 0 12px">Sketches, filled forms and photographs are never in a backup
      or in the automatic saving \u2014 they stay on this device. A case package is the only copy that leaves it.
      Save one when a scene is done and put it in the case file.${S.lastCase?" Last package: "+esc(S.lastCase.slice(0,16).replace("T"," "))+".":""}</p>
    <div class="stackb">
      <button class="btn" id="casepkg" style="max-width:none;margin:0">Save a case package of everything</button>
      <label class="btn sec" style="max-width:none;display:block;text-align:center">Restore a case package<input type="file" id="casein" accept=".json,application/json" style="display:none"></label></div>`;
  else if(k==="labels")body=`
    <label class="fld"><span>Web address of this app, printed into the QR codes</span>
      <input type="text" id="appurl" value="${esc(String(S.appUrl||""))}" placeholder="${esc(appUrl()||"https://\u2026/index.html")}" autocapitalize="off"></label>
    <p class="hint" style="margin:0 0 12px">Scanning a label with the camera app opens this app at that compartment or item. Leave it blank to use the page's own address, or when the app runs from a file, in which case only the in-app scanner reads the labels.</p>
    <button class="btn sec" data-go="labels" style="max-width:none;margin:0">Printable labels</button>`;
  else if(k==="device")body=`
    <div class="kv" style="margin-bottom:9px">
      <div><dt>Storage</dt><dd>${!storageState.asked?"checking\u2026"
        :storageState.persisted?`<span class="okpill">Kept by the browser</span>`
        :`<span class="warnpill">Can be cleared</span>`}</dd></div>
      ${storageState.quota?`<div><dt>Space used</dt><dd>${(storageState.used/1048576).toFixed(1)} MB of ${(storageState.quota/1048576).toFixed(0)} MB</dd></div>`:""}
      <div><dt>Home screen</dt><dd>${isStandalone()?`<span class="okpill">Installed</span>`:"Not installed"}</dd></div>
      <div><dt>Version</dt><dd>${esc(APP_VERSION)}</dd></div>
    </div>
    <p class="hint" style="margin:0 0 12px">${storageState.persisted
      ? "Everything you enter is written to this device as you go. The browser has agreed not to clear it to reclaim space, so it survives restarts and long gaps between shifts."
      : "Everything you enter is written to this device as you go. The browser has not yet marked it as protected storage, which normally happens after the app has been used a few times. Keep a backup until it does."}</p>
    <div class="idsect">On the home screen</div>
    <p class="hint" style="margin:0">${isStandalone()
      ? "Installed. It opens full screen from its own icon and works without a connection."
      : /iPad|iPhone/.test(navigator.userAgent)
        ? "In Safari, tap Share, then Add to Home Screen. It then opens full screen from its own icon and works without a connection."
        : "Use the browser's Install option, or add it to the home screen, so it opens full screen and works without a connection."}</p>
    <div class="idsect">Offline use</div>
    ${offlineHTML()}`;
  else if(k==="activity")body=activityHTML();
  else if(k==="errors")body=(S.errors||[]).length?`<div style="margin-bottom:8px">${S.errors.slice().reverse().map(x=>`<div class="errrow"><span class="et">${esc(String(x.t||"").slice(0,16).replace("T"," "))}${x.v?" \u00b7 "+esc(x.v):""}</span><span class="em">${esc(x.m)}</span></div>`).join("")}</div>
      <button class="btn sec" id="errclear" style="max-width:none;margin:0">Clear the list</button>`
      :`<p class="hint" style="margin:0">None recorded. Anything that goes wrong in the app is listed here for whoever maintains it.</p>`;
  else if(k==="reset")body=`
    <p class="hint" style="margin:0 0 12px">Both ask before they do anything. Take a backup first if you might want any of it back.</p>
    <div class="stackb">
      ${S.demo?`<button class="btn sec" id="cleardemo2" style="max-width:none;margin:0">Clear sample data</button>`:""}
      <button class="btn sec" id="wipe" style="max-width:none;color:var(--red);border-color:var(--red)">Erase everything</button></div>`;
  return `<div class="idsect" style="margin-top:0">${esc(SET_TITLES[k]||"Settings")}</div>${body}`;
}
function renderData(){
  if(!document.getElementById("v-data"))return;   // defensive: Settings is on both pages
  $("#title").textContent="Settings";
  if(conflict||tokenBad||badFile)SET_SEC="sync";
  if(SET_SEC&&!SET_TITLES[SET_SEC])SET_SEC=null;
  $("#v-data").innerHTML=PAGE==="scenes"?`<button class="back" data-navback="active">&#8249; Scenes</button>`+settingsSplit():(SET_SEC?settingsSection(SET_SEC):settingsMenu());
  renderSyncPill();
  $$("#v-data [data-setsec]").forEach(b=>b.onclick=()=>{SET_SEC=b.dataset.setsec;if(PAGE!=="scenes")window.scrollTo&&window.scrollTo(0,0);renderData()});
  const bk=$("#v-data [data-setback]"); if(bk)bk.onclick=()=>{SET_SEC=null;renderData()};
  const cp=$("#casepkg"); if(cp)cp.onclick=()=>exportCasePackage("all","fsu-all");
  const ci=$("#casein"); if(ci)ci.onchange=()=>{const f=ci.files&&ci.files[0]; if(!f)return; f.text().then(importCasePackage)};
  const ec=$("#errclear"); if(ec)ec.onclick=()=>{S.errors=[];saveLocal();renderData();toast("Cleared")};
  const od=$("#offdl"); if(od)od.onclick=()=>offlineDownload(od);
}
/* Everything either app fetches on demand, fetched in one go so a device is ready for a scene
   with no signal. It goes into the service worker's own cache (the name must match sw.js), and
   the worker hands it back whenever the network is not there. County aerial photos are not in
   it: they are fetched for one spot at a time and would be gigabytes for the whole city. */
const OFFLINE=["index.html","scenes.html","manifest.webmanifest","scenes.webmanifest",
  "icon-180.png","icon-512.png","scenes-icon-180.png","scenes-icon-512.png",
  "lib/jspdf.umd.min.js","lib/svg2pdf.umd.min.js","lib/jszip.min.js","lib/qrcode.min.js","lib/jsQR.js",
  "lib/maplibre/maplibre-gl.mjs","lib/maplibre/maplibre-gl-shared.mjs","lib/maplibre/maplibre-gl-worker.mjs",
  "lib/maplibre/maplibre-gl.css","lib/fonts/Noto Sans Regular/0-255.pbf",
  "williamsport-buildings.json","williamsport-streets.json","williamsport-addresses.json"];
const offlineState=()=>{try{return JSON.parse(localStorage.getItem("fsuOffline")||"null")}catch(_){return null}};
function offlineHTML(){
  const off=offlineState(), old=off&&off.v!==APP_VERSION;
  return `<p class="hint" style="margin:0 0 10px">${!off
      ?"Everything the app needs without a connection: the map of Williamsport and its address list, and the tools that make PDFs, Word files and QR labels. About 11 MB. County aerial photos still need a connection."
      :old?`Downloaded ${esc(String(off.at).slice(0,10))}, but the app has been updated since. Download again so this device has the new version.`
      :`Ready without a connection since ${esc(String(off.at).slice(0,10))} (${(+off.mb).toFixed(1)} MB). County aerial photos still need a connection.`}</p>
    <button class="btn${off&&!old?" sec":""}" id="offdl" style="max-width:none;margin:0">${off?"Download again":"Download for offline use"}</button>
    <p class="hint" id="offst" style="margin:8px 0 0"></p>`;
}
async function offlineDownload(btn){
  const st=$("#offst"); btn.disabled=true; st.style.color="";
  try{
    if(typeof caches==="undefined")throw new Error("This browser cannot keep files for use without a connection");
    const c=await caches.open("fsu-v1"); let bytes=0;
    for(let i=0;i<OFFLINE.length;i++){
      st.textContent=`Downloading ${i+1} of ${OFFLINE.length}\u2026`;
      const r=await fetch(OFFLINE[i],{cache:"no-store"});
      if(!r.ok)throw new Error(`Could not fetch ${OFFLINE[i]} (${r.status}). Nothing is lost; try again with a better connection.`);
      bytes+=(await r.clone().arrayBuffer()).byteLength;
      await c.put(OFFLINE[i],r);
    }
    if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
    localStorage.setItem("fsuOffline",JSON.stringify({at:new Date().toISOString(),mb:bytes/1048576,v:APP_VERSION}));
    renderData(); toast("Ready for use without a connection");
  }catch(err){ st.textContent=err.message; st.style.color="var(--red)"; btn.disabled=false }
}

/* ---------- filtered lists from the strip ---------- */
let listKey=null;
// what to order, and how many, for anything short or expiring
function reorderRows(){
  return live().filter(i=>isOut(i)||isLow(i)||isExpired(i))
    .map(i=>{
      const par=n(i.par), have=n(i.qty);
      const need=i.par!==""&&i.par!=null&&par>have ? par-have : (isOut(i)?1:0);
      return {i, need, why: isOut(i)?"Out of stock" : isExpired(i)?"Expired" : "Below par"};
    })
    .sort((a,b)=>(a.i.cat||"").localeCompare(b.i.cat||"")||a.i.name.localeCompare(b.i.name));
}
function reorderText(){
  const rows=reorderRows().filter(r=>!r.i.ordered);
  const when=new Date().toISOString().slice(0,16).replace("T"," ");
  let out="Reorder list \u2014 Forensic Services Unit\nPrepared "+when+"\n\n";
  let cat="";
  rows.forEach(r=>{
    const c=catName(r.i.cat);
    if(c!==cat){out+=(cat?"\n":"")+c+"\n"; cat=c}
    out+="  "+(r.need?r.need+" x ":"")+r.i.name
      +(r.i.loc?"  ("+r.i.loc+")":"")
      +"  \u2014 "+r.why+", "+r.i.qty+" in stock"
      +(r.i.par!==""&&r.i.par!=null?", par "+r.i.par:"")
      +(r.i.vendor||r.i.part||r.i.pack?"\n      "+[r.i.vendor,r.i.part,r.i.pack].filter(Boolean).join(", "):"")+"\n";
  });
  if(!rows.length)out+="Nothing to order.\n";
  return out;
}
// one pass to fill in what the sweep skipped: par levels and categories
function tidyRows(){
  return live().filter(i=>(i.loc||"").trim())
    .sort((a,b)=>(a.loc||"").localeCompare(b.loc||"")||a.name.localeCompare(b.name));
}
let tidyIdx=0;
function renderTidy(){
  $("#title").textContent="Fill in the gaps";
  const queue=tidyRows().filter(i=>!String(i.par||"").trim());
  if(tidyIdx>=queue.length)tidyIdx=0;
  if(!queue.length){
    $("#v-tidy").innerHTML=`<button class="back" data-navback="inventory">&#8249; Inventory</button>
      <div class="empty"><strong>Nothing to fill in</strong><p>Every placed item has a par level.</p></div>`;
    return;
  }
  const i=queue[tidyIdx];
  $("#v-tidy").innerHTML=`<button class="back" data-navback="inventory">&#8249; Inventory</button>
    <div class="focuswrap"><div class="focuscard">
      <div class="focuseyebrow">Item ${tidyIdx+1} of ${queue.length}</div>
      <div class="nowinfo"><span class="nc" style="font-size:19px;font-family:var(--sys)">${esc(i.name)}</span>
        <span class="nd">${esc(i.loc)} &middot; ${esc(i.qty)} in stock</span></div>
      <label class="fld"><span>Par level</span>
        <input type="text" inputmode="numeric" id="tf-par" placeholder="How many to keep on hand"></label>
      <label class="fld"><span>Category</span>
        <select id="tf-cat">${CATS.map(c=>
          `<option value="${c[0]}"${c[0]===i.cat?" selected":""}>${c[0]} &middot; ${c[1]}</option>`).join("")}</select></label>
      <button class="btn" id="tsave" style="max-width:none;margin-top:4px">Save, next &rarr;</button>
      <button class="btn sec" id="tskip" style="max-width:none">Skip for now</button>
    </div>
    <p class="hint focusline">${queue.length} item${queue.length===1?" still needs":"s still need"} a par level</p></div>`;
  const parEl=$("#tf-par"); if(parEl)parEl.focus();
  $("#tsave").onclick=()=>{
    const par=$("#tf-par").value.trim(); if(!par)return toast("Enter a par level, or Skip");
    i.par=par; i.cat=$("#tf-cat").value; save();
    renderTidy(); toast("Saved")};
  $("#tskip").onclick=()=>{tidyIdx++; renderTidy()};
}
function renderReorder(){
  $("#title").textContent="Reorder";
  const all=reorderRows(), rows=all.filter(r=>!r.i.ordered), onOrder=all.filter(r=>r.i.ordered);
  const byCat={}; rows.forEach(r=>{const c=catName(r.i.cat);(byCat[c]=byCat[c]||[]).push(r)});
  const card=r=>`<div class="icard"><button class="row" data-item="${esc(r.i.id)}">
      <span><span class="code">${r.need?r.need+" &times; ":""}${esc(r.i.name)}</span>
      <span class="desc">${esc(r.i.loc||"not placed")} &middot; ${esc(r.i.qty)} in stock${
        r.i.par!==""&&r.i.par!=null?" &middot; par "+esc(r.i.par):""}${r.i.ordered?" &middot; ordered "+esc(r.i.ordered):""}${r.i.vendor||r.i.part?"<br>"+esc([r.i.vendor,r.i.part,r.i.pack].filter(Boolean).join(" &middot; ")):""}</span></span>
      <span class="rt"><span class="badge b-${r.why==="Below par"?"attn":"action"}">${esc(r.why)}</span><span class="chev">&#8250;</span></span></button>
    <div class="iq">${r.i.ordered
      ?`<button data-received="${esc(r.i.id)}">Received</button><button data-unordered="${esc(r.i.id)}">Not ordered after all</button>`
      :`<button data-ordered="${esc(r.i.id)}">Ordered</button>`}</div></div>`;
  const total=all.length, done=onOrder.length, pct=total?Math.round(100*done/total):0;
  const progress=total?`<div class="ropct">
      <div class="ropctlab"><span>${done} of ${total} ordered</span><span>${rows.length?"Copy list &middot; Send":"All in hand"}</span></div>
      <div class="ropctbar"><i style="width:${pct}%"></i></div>
    </div>`:"";
  $("#v-reorder").innerHTML=`<button class="back" data-navback="home">&#8249; Home</button>`
    +progress
    +(rows.length?`
      <p class="hint" style="margin:0 0 14px">Quantities are what it takes to reach par. Mark each one Ordered once it has gone in, and Received when it arrives.</p>
      <div class="editbar">
        <button id="rocopy" class="on">Copy list</button>
        <button id="roshare">Send</button></div>`
      +Object.keys(byCat).sort().map(c=>`<div class="sect">${esc(c)}</div>`+byCat[c].map(card).join("")).join("")
    :`<div class="empty"><strong>Nothing to order</strong>
        <p>${onOrder.length?"Everything that is short is already on order.":"Everything is at or above par, and nothing has expired."}</p></div>`)
    +(onOrder.length?`<div class="sect">On order — ${onOrder.length}</div>`+onOrder.map(card).join(""):"");
}
function renderList(key){
  const L=live();
  const map={low:["Low or out",L.filter(i=>isOut(i)||isLow(i))],
    expiring:["Expiring",L.filter(i=>isExpiring(i)||isExpired(i)||isService(i))],
    gaps:["Gaps to decide",gaps()],all:["All items",L]};
  const [t,arr]=map[key]||map.all;
  $("#title").textContent=t;
  listKey=key;
  $("#v-home").innerHTML=`<button class="back" data-navback="home">&#8249; Home</button>`
    +(key==="gaps"?`<button class="btn sec" id="addgap" style="margin:0 0 14px;max-width:none">Log something we don't carry</button>`:"")
    +(key==="low"&&reorderRows().length?`<button class="btn" id="goreorder" style="margin:0 0 14px;max-width:none">Make a reorder list</button>`:"")
    +(arr.length?`<div class="rows">`+arr.map(i=>{
      const s=isOut(i)?["action","Out"]:isExpired(i)?["action","Expired"]:isLow(i)?["attn","Below par"]
        :isService(i)?["attn","Service due"]:isExpiring(i)?["attn",daysOut(i.date)+" days"]:["good","OK"];
      return `<button class="row" data-item="${esc(i.id)}">
        <span><span class="code">${esc(i.name)}</span>
        <span class="desc">${esc(i.loc||"—")} · ${esc(i.qty)} in stock${i.par?" · par "+esc(i.par):""}${
      i.cls?" · "+esc(i.cls):""}<br>${esc(catName(i.cat))}</span></span>
        <span class="rt"><span class="badge b-${s[0]}">${esc(s[1])}</span><span class="chev">&#8250;</span></span></button>`
      }).join("")+`</div>`
    :`<div class="empty"><strong>Nothing here</strong><p>That list is clear.</p></div>`);
}

/* ---------- search ---------- */
let searchScope="all";
function renderSearch(){
  $("#title").textContent="Search";
  const q=query.toLowerCase();
  const notCarried=S.items.filter(i=>i.status==="Not carried"&&i.gapType!=="request");
  const pool=live().concat(requests(),notCarried);
  const hay=i=>(i.name+" "+i.loc+" "+i.cat+" "+catName(i.cat)+" "+i.cls+" "+(i.contact||"")
    +" "+(i.note||"")+" "+(i.steps||[]).join(" ")
    +" "+((S.comps.find(c=>c.code===i.loc)||{}).desc||"")).toLowerCase();
  const all=pool.filter(i=>hay(i).includes(q));
  const placedAll=all.filter(i=>(i.loc||"").trim());
  const fhitsAll=PAGE!=="van"&&S.forms.filter(f=>((f.name||"")+" "+(f.desc||"")+" "+(f.cat||"")+" "+(f.rev||"")).toLowerCase().includes(q))||[];
  if(searchScope==="compartment"&&!placedAll.length&&(all.length||fhitsAll.length))searchScope="all";
  if(searchScope==="forms"&&!fhitsAll.length&&all.length)searchScope="all";
  const scoped=searchScope==="compartment"?placedAll:all;
  const hits=scoped.slice(0,40);
  const fhits=(searchScope==="forms"||searchScope==="all")?fhitsAll.slice(0,8):[];
  const filt=(k,l,n)=>`<button data-searchscope="${k}" class="${searchScope===k?"sel":""}">${l}<span class="n">${n}</span></button>`;
  const rail=`<div class="filters searchrail">
    ${filt("all","All results",all.length+fhitsAll.length)}
    ${filt("compartment","By compartment",placedAll.length)}
    ${PAGE!=="van"?filt("forms","Forms",fhitsAll.length):""}
  </div>`;
  let body=(searchScope!=="forms"&&hits.length)
    ? `<div class="sect">${scoped.length>hits.length?"Showing "+hits.length+" of "+scoped.length:hits.length+" result"+(hits.length===1?"":"s")}</div><div class="rows">`
      +hits.map(i=>{const cp=S.comps.find(c=>c.code===i.loc);
        return `<button class="row" data-item="${esc(i.id)}">
          <span><span class="code">${esc(i.name)}</span>
          <span class="desc">${isRequest(i)?esc(i.contact||"Not in the van")
            :i.status==="Not carried"?"Not in the van"+(i.note?" · "+esc(i.note):"")
            :esc(i.loc||"—")+(cp&&cp.desc?" · "+esc(cp.desc):"")+" · "+esc(i.qty)+" in stock"}</span></span>
          <span class="rt">${isRequest(i)?`<span class="badge b-req">On request</span>`
            :i.status==="Not carried"?`<span class="badge b-${i.gapType==="deliberate"?"unchecked":"action"}">${i.gapType==="deliberate"?"Not carried":"Gap"}</span>`
            :""}<span class="chev">&#8250;</span></span></button>`}).join("")+`</div>`
    : (searchScope==="forms"?"":`<div class="empty"><strong>Nothing found</strong><p>No item, compartment, or category matches that.</p></div>`);
  if(fhits.length)body+=`<div class="sect">Forms — ${fhits.length}</div><div class="rows">`+fhits.map(f=>
      `<button class="row" data-form="${esc(f.id)}">
        <span><span class="code">${esc(f.name)}</span>
        <span class="desc">${esc(f.rev?"Rev "+f.rev+" · ":"")}${esc(f.cat||"")}</span></span>
        <span class="rt"><span class="badge b-req">Form</span><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`;
  if(searchScope==="forms"&&!fhits.length)body=`<div class="empty"><strong>No forms found</strong><p>No form name, revision, or category matches that.</p></div>`;
  if(all.length>hits.length&&searchScope!=="forms")body+=`<p class="hint">Add another word to narrow it down.</p>`;
  $("#v-search").innerHTML=`<div class="searchsplit">${rail}<div>${body}</div></div>`;
  $$("#v-search [data-searchscope]").forEach(b=>b.onclick=()=>{searchScope=b.dataset.searchscope;renderSearch()});
}

/* ---------- sweep ---------- */
function renderSweep(){
  $("#title").textContent="Sweep";
  const cur=S.curLoc, cs=comps(), here=live().filter(i=>i.loc===cur);
  $("#v-sweep").innerHTML=`
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <button class="back" data-navback="home" style="margin:0">&#8249; Home</button>
      ${S.comps.some(c=>c.checked)?`<button class="back" id="resweep" style="margin:0">
        Start a new sweep</button>`:""}
      <span class="hint" style="margin:0 0 0 auto;font-size:12.5px">${
        S.comps.filter(c=>c.checked).length} of ${S.comps.length} swept</span>
    </div>
    ${(!cur||S.pick)?sweepNextBar(cs,cur):""}
    ${(!cur||S.pick)?sweepList(cs,cur):""}
    ${cur?`<div class="focuswrap"><div class="focuscard">
      <div class="focuseyebrow">Compartment</div>
      <div class="nowinfo"><span class="nc">${esc(cur)}</span>
        <span class="nd">${esc((cs.find(c=>c.code===cur)||{}).desc||"Not named yet")}</span></div>
      <div class="modebar">
        <button data-qa="1" class="${S.quick!==false?"on":""}">Quick add</button>
        <button data-qa="0" class="${S.quick===false?"on":""}">Full details</button></div>
      ${S.quick!==false?`
        <label class="fld"><span>Item</span>
          <input type="text" id="q-name" placeholder="Nitrile gloves, box"
            autocomplete="off" autocapitalize="sentences" enterkeyhint="next"></label>
        <div class="two">
          <label class="fld"><span>Quantity</span>
            <input type="text" id="q-qty" inputmode="numeric" value="1" enterkeyhint="done"></label>
          <label class="fld"><span>Category</span>
            <select id="q-cat">${CATS.map(c=>`<option value="${c[0]}"${c[0]===S.lastCat?" selected":""}>${c[0]} &middot; ${c[1]}</option>`).join("")}</select></label>
        </div>
        <button class="btn" id="qadd" style="margin:2px 0 0;max-width:none">Add to ${esc(cur)}</button>
        <p class="hint" style="margin:9px 0 0">Par starts at 1. Class stays on
          ${esc(S.lastCls||CLASSES[0])} &mdash; change it on the item, or use the full form.
          Category and quantity carry over to the next one, so a run of the same kind is quick.</p>
        <div id="qjust"></div>`
      :`
        <label class="fld"><span>Item</span><input type="text" id="f-name" placeholder="Black magnetic powder, 1 lb"></label>
        <div class="two"><label class="fld"><span>Quantity</span><input type="text" id="f-qty" inputmode="numeric" value="1"></label>
          <label class="fld"><span>Par level</span><input type="text" id="f-par" inputmode="numeric" value="1"></label></div>
        <div class="two"><label class="fld"><span>Category</span><select id="f-cat">${CATS.map(c=>`<option value="${c[0]}"${c[0]===S.lastCat?" selected":""}>${c[0]} · ${c[1]}</option>`).join("")}</select></label>
          <label class="fld"><span>Class</span><select id="f-cls">${CLASSES.map(c=>`<option${c===S.lastCls?" selected":""}>${c}</option>`).join("")}</select></label></div>
        <label class="fld"><span>Expiry or service date</span><input type="date" id="f-date"></label>
        <button class="btn" id="add" style="margin:4px 0 0;max-width:none">Add to ${esc(cur)}</button>`}
      <div id="sweeplist">${here.length?`<div class="sect">In ${esc(cur)} — ${here.length}</div><div class="rows">`
        +here.slice().reverse().map(i=>`<button class="row" data-item="${esc(i.id)}">
          <span><span class="code">${esc(i.name)}</span><span class="desc">${esc(i.qty)} in stock${i.par?" · par "+esc(i.par):""}</span></span>
          <span class="rt"><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`:""}</div>
      <button class="btn" data-sweepdone="${esc(cur)}" style="max-width:none;margin-top:12px">Swept, next &rarr;</button>
      <button class="btn sec" data-pick="${S.pick?0:1}" style="max-width:none">${S.pick?"Done choosing":"Pick a different compartment"}</button>
    </div>
    <p class="hint focusline">${cs.filter(c=>!c.checked).length} of ${cs.length} still to check</p>
    </div>`
    :`<div class="empty"><strong>Pick a compartment</strong><p>Choose one above, then log what's inside it.</p></div>`}`;
  paintJust();
}

