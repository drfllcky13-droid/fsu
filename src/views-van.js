/* ---------- home: priority strip ---------- */
function renderHome(){
  $("#title").textContent="FSU";
  const L=live();
  if(!L.length&&!S.comps.length){
    $("#v-home").innerHTML=`<div class="empty"><strong>Nothing logged yet</strong>
      <p>Add your first compartment, then log what's inside it. One compartment at a time.</p>
      <button class="btn" data-go="sweep">Start a sweep</button>
      <button class="btn sec" id="loaddemo">Load a sample van</button></div>`;return;
  }
  const cs=comps(), gp=gaps();
  const bad=L.filter(i=>isOut(i)||isLow(i));
  const soon=L.filter(i=>isExpiring(i)||isExpired(i)||isService(i));
  const unchk=cs.filter(c=>compState(c.code).k==="unchecked").length, checked=cs.length-unchk;
  const need=L.filter(i=>isOut(i)||isExpired(i)||isLow(i)||isService(i)||isExpiring(i))
    .sort((a,b)=>{const r=x=>isOut(x)||isExpired(x)?0:1;return r(a)-r(b)||a.name.localeCompare(b.name)});
  const td=tokenDays();
  const lastMark=cs.map(c=>c.checked).filter(Boolean).sort().pop();

  // where am I
  const dateTxt=new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
  const sweepTxt=!cs.length?"No compartments yet":unchk===0&&lastMark?"Sweep finished "+lastMark
    :lastMark?"Sweep in progress, "+unchk+" left":"No sweep yet";
  const head=`<div class="hhead"><b>${esc(S.vanName||"Forensic Services Unit")}</b><span>${esc(dateTxt)}</span>
    <span>${S.who?"Signed in as "+esc(S.who):`<button class="lnkbtn" data-gosec="who">Set your initials</button>`}</span>
    <span>${esc(sweepTxt)}</span><span>${lastVeh()?"Vehicle checked "+esc(lastVeh().t.slice(0,10)):"No vehicle check yet"}</span>
    <button class="hgear" id="gear">${ic("gear","gi")}<span>Settings</span></button></div>`;

  // how is the van \u2014 today's sweep as a progress ring, everything else as chips
  const R=52, CIRC=2*Math.PI*R;
  const frac=cs.length?checked/cs.length:0;
  const ringOff=(CIRC*(1-frac)).toFixed(1);
  const ringLabel=!cs.length?"Add compartments"
    :unchk===0?"Sweep finished"+(lastMark?" "+lastMark:""):checked?"Continue sweep":"Start sweep";
  const chip=(ok,label,attr)=>`<button class="chip ${ok?"b-good":"b-attn"}" ${attr}>${ok?"&#10003; ":""}${esc(label)}</button>`;
  const tiles=`<div class="ringcard">
    <div class="ring"><svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--line2)" stroke-width="12"/>
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="${unchk?"var(--ambersolid)":"var(--greensolid)"}" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${ringOff}"
        transform="rotate(-90 60 60)"/></svg>
      <div class="n"><b>${cs.length?unchk:"\u2014"}</b><span>Left</span></div></div>
    <div class="ringbody">
      <h2>${cs.length?"Today's sweep":"No compartments yet"}</h2>
      <p>${cs.length?checked+" of "+cs.length+" compartments checked":"Add your first compartment to start a sweep"}</p>
      <button class="ringcta" data-go="sweep">${esc(ringLabel)} &rarr;</button>
    </div>
    <div class="chipsrow">
      ${chip(!bad.length,bad.length?bad.length+" short":"Stock fine",'data-list="low"')}
      ${chip(!soon.length,soon.length?soon.length+" expiring":"Nothing expiring",'data-list="expiring"')}
      ${chip(!gp.length,gp.length?gp.length+" gap"+(gp.length===1?"":"s"):"No gaps",'data-list="gaps"')}
    </div>
  </div>`;

  // what needs doing
  const rows=[];
  if(ghOn()&&td!=null&&td<=30)rows.push(["warn",td<0?"Automatic saving has stopped, the token has expired":"Sync token expires in "+td+" day"+(td===1?"":"s"),'data-gosec="sync"',""]);
  if(bad.length)rows.push(["","Review "+bad.length+" low or out",'data-list="low"',""]);
  if(soon.length)rows.push(["","Check "+soon.length+" expiring or due for service",'data-list="expiring"',""]);
  if(gp.length)rows.push(["","Decide on "+gp.length+" gap"+(gp.length===1?"":"s"),'data-list="gaps"',""]);
  if(unchk)rows.push(["","Sweep "+unchk+" compartment"+(unchk===1?"":"s"),'data-go="sweep"',""]);
  const lv=lastVeh(), vf=lv?lv.items.filter(i=>i.ok===false):[];
  if(vf.length)rows.push(["warn","Vehicle: "+vf.length+" item"+(vf.length===1?"":"s")+" failed \u2014 "+vf.map(i=>i.k).join(", "),'data-vehlast="1"',""]);
  if(vehDue())rows.push(["",lv?"Vehicle check due, last one "+lv.t.slice(0,10):"No vehicle check yet",'data-vehcheck="1"',""]);
  const setup=[
    [cs.filter(c=>!(c.desc||"").trim()).length,"compartment|compartments|not named",'data-go="compartments"'],
    [L.filter(i=>!placed(i)).length,"item|items|not placed in a compartment",'data-go="sweep"'],
    [L.filter(i=>placed(i)&&!String(i.par||"").trim()).length,"item|items|without a par level",'data-go="tidy"'],
    [L.filter(i=>(i.steps||[]).length&&!i.verified).length,"instruction set|instruction sets|unverified",'data-verifyrun="1"']
  ].filter(r=>r[0]>0).map(r=>{const [one,many,rest]=r[1].split("|");return ["setup",r[0]+" "+(r[0]===1?one:many)+" "+rest,r[2],""]});
  rows.push(...setup);
  if(cs.length&&!unchk)rows.push(["","Count the stock",'data-countrun="1"',""]);
  const todo=`<div class="panel todo"><div class="ph2">Next actions${rows.length?" \u2014 "+rows.length:""}</div><div class="pb">
    ${rows.length?rows.map(([k,t,attr,lc])=>`<button class="act${k?" "+k:""}" ${attr}>${k==="setup"?`<span class="tag">Setup</span>`:""}<span>${esc(t)}</span>${lc?`<span class="lc">${lc}</span>`:`<span class="chev">&#8250;</span>`}</button>`).join("")
      :`<p class="hint" style="margin:0">Nothing outstanding.</p>`}
  </div></div>`;

  const attention=need.length?`<div class="panel"><div class="ph2">Needs attention \u2014 ${need.length}</div>
    <div class="pb narrowlist">${need.slice(0,10).map(i=>{const s=itemStatus(i);
      return `<button class="nrow" data-item="${i.id}"><span class="nn">${esc(i.name)}</span>
        <span class="nm2"><span class="lc">${esc(i.loc||"\u2014")}</span><span class="badge b-${s[0]}">${esc(s[1])}</span></span></button>`}).join("")}
      ${need.length>10?`<button class="act" data-list="all"><span>Show all ${need.length}</span><span class="chev">&#8250;</span></button>`:""}</div></div>`:"";

  const pop=L.slice().sort((a,b)=>((b.fav?1e6:0)+(b.uses||[]).length)-((a.fav?1e6:0)+(a.uses||[]).length)).slice(0,3);
  const quick=pop.length?`<div class="panel"><div class="ph2">Quick find</div><div class="pb"><div class="qf">${pop.map(i=>
      `<button data-item="${i.id}"><span class="nm">${esc(i.name)}</span><span class="lc">${esc(i.loc||"\u2014")}</span></button>`).join("")}</div>
      <p class="hint" style="margin:8px 0 0">Star an item and it appears here.</p></div></div>`:"";

  $("#v-home").innerHTML=head+tiles+`<div class="dash2">
    <div class="col">${todo}${handoverPanel()}${attention}</div>
    <div class="col">${unitPanel()}${quick}</div></div>`;
  $$("#v-home [data-gosec]").forEach(b=>b.onclick=()=>openSettings(b.dataset.gosec));
}
/* ---------- compartments ---------- */
function autoPlace(side){
  const W=S.walls[side]||{cols:24,rows:12};
  const mine=S.comps.filter(c=>c.side===side);
  const grid=[];for(let r=0;r<W.rows;r++)grid.push(new Array(W.cols).fill(false));
  const mark=(c)=>{for(let r=c.y;r<Math.min(W.rows,c.y+c.h);r++)
    for(let x=c.x;x<Math.min(W.cols,c.x+c.w);x++)grid[r][x]=true};
  const fits=(x,y,w,hh)=>{if(x+w>W.cols||y+hh>W.rows)return false;
    for(let r=y;r<y+hh;r++)for(let q=x;q<x+w;q++)if(grid[r][q])return false;return true};
  mine.filter(c=>c.x!=null&&c.y!=null).forEach(mark);
  mine.filter(c=>c.x==null||c.y==null).forEach(c=>{
    outer:for(let y=0;y<W.rows;y++)for(let x=0;x<W.cols;x++)
      if(fits(x,y,c.w,c.h)){c.x=x;c.y=y;mark(c);break outer}
    if(c.x==null){c.x=0;c.y=0}});
}

function unitPanel(){
  const cs=comps(); if(!cs.length)return "";
  const bays=[...new Set(cs.map(c=>bayOf(c.code)))].sort();
  return `<div class="panel"><div class="ph2">Units</div><div class="pb unitpb">
    ${bays.map(bay=>{
      const b=bayBounds(bay); if(!b)return "";
      const end=b.x+b.w/2>(S.walls[b.side]||{cols:144}).cols/2
        ?(b.side==="Driver side"?"front":"rear"):(b.side==="Driver side"?"rear":"front");
      return `<button class="bayhead" data-bay="${esc(bay)}">
        <div class="bayinfo">
          <h2>${esc(BAYNAME[bay]||"Bay "+bay)}</h2>
          <div class="sub">${esc(b.side)}, ${end}</div>
          <div class="sub">${b.w}-inch &nbsp;|&nbsp; ${b.n} compartments</div>
        </div>
        ${vanKey(bay,false)}
        <div class="cdtags">${bayTally(bay)}</div></button>`}).join("")}
  </div></div>`;
}

function renderComps(){
  $("#title").textContent="Storage";
  const cs=comps();
  if(!cs.length){
    $("#v-compartments").innerHTML=`<div class="empty"><strong>No compartments yet</strong>
      <p>Add a code for each drawer, bin, and cabinet, say which side it's on, and how big it is.</p>
      <button class="btn" data-go="sweep">Add the first one</button></div>`;return;
  }
  SIDES.forEach(autoPlace);
  const bays=[...new Set(cs.map(c=>bayOf(c.code)))].sort();
  const card=bay=>{
    const b=bayBounds(bay);
    const where=b.side+", "+(b.x+b.w/2 > (S.walls[b.side]||{cols:144}).cols/2
      ? (b.side==="Driver side"?"front":"rear") : (b.side==="Driver side"?"rear":"front"));
    const sideOnly=b.side, endOnly=where.split(", ")[1]||"";
    return `<button class="bayhead" data-bay="${esc(bay)}">
      <div class="bayinfo">
        <h2>${esc(BAYNAME[bay]||"Bay "+bay)}</h2>
        <div class="sub">${esc(sideOnly)}${endOnly?", "+esc(endOnly):""}</div>
        <div class="sub">${b.w}-inch &nbsp;|&nbsp; ${b.n} compartments</div>
      </div>
      ${vanKey(bay,false)}
      <div class="cdtags">${bayTally(bay)}</div></button>`;
  };
  const unplaced=cs.filter(c=>!SIDES.includes(c.side));
  const W0=S.walls["Driver side"]||{cols:24,rows:12};
  const dflt=W0.cols===WALLDEF["Driver side"].cols&&W0.rows===WALLDEF["Driver side"].rows;
  $("#v-compartments").innerHTML=storageHead()+
    `${dflt?`<div class="ph">Compartment sizes are estimates. Open any compartment and edit it to set its real dimensions.</div>`:""}
     <div class="editbar">
       <button data-go="print">Printable map</button>
       <button data-go="labels">Printable labels</button>
       <button data-scan="open">Scan a label</button>
       <button data-vehcheck="1">Vehicle check</button></div>
     ${bays.map(card).join("")}
     ${unplaced.length?`<div class="sect">Not placed on a side yet — ${unplaced.length}</div>
       <div class="rows">`+unplaced.map(c=>{const s=compState(c.code);
         return `<button class="row" data-comp="${esc(c.code)}">
           <span><span class="code">${esc(c.code)}</span><span class="desc">${esc(c.desc||"No location set")}</span></span>
           <span class="rt"><span class="badge b-${s.k}">${esc(s.label)}</span><span class="chev">&#8250;</span></span></button>`
         }).join("")+`</div>`:""}`;
}

/* ---------- bay detail: one unit, drawn large ---------- */
let curBay=null;
function renderBay(){
  const cs=comps().filter(c=>bayOf(c.code)===curBay);
  if(!cs.length){view="compartments";return renderComps()}
  const side=cs[0].side;
  const minX=Math.min(...cs.map(c=>c.x)), maxX=Math.max(...cs.map(c=>c.x+c.w));
  const minY=Math.min(...cs.map(c=>c.y)), maxY=Math.max(...cs.map(c=>c.y+c.h));
  const W=maxX-minX, H=maxY-minY;
  const split=!!document.querySelector(".main.split");
  if(bayZoomBay!==curBay){bayZoomBay=curBay;bayZoomK=1;bayPick=null}
  const firstUn=cs.find(c=>!c.checked);
  $("#title").textContent="Bay "+curBay;
  $("#v-bay").innerHTML=`
    <button class="back" data-navback="compartments">&#8249; Storage</button>
    <div class="bayhead mini${split?" split":""}">
      <div class="bayinfo">
        <h2>${esc(BAYNAME[curBay]||"Bay "+curBay)}</h2>
        <div class="sub">${esc(side)}${split?" &middot; "+W+"-inch &middot; "+cs.length+" compartments":""}</div>
        ${split?"":`<div class="sub">${W}-inch &nbsp;|&nbsp; ${cs.length} compartments</div>`}
      </div>
      ${split?`<div class="bayacts"><button class="btn sec" data-sweepbay="${esc(curBay)}"${firstUn?"":" disabled"}>${firstUn?"Sweep this bay":"Bay swept"}</button></div>`
             :vanKey(curBay,false)}
      <div class="cdtags">${bayTally(curBay)}</div>
    </div>
    <div class="baystage${bayPick?" picked":""}"><div class="baywrap"><div class="bayzoom" id="bayzoom">
      <div class="bayplan" id="bayplan" style="--cols:${W};--rows:${H};--k:${bayZoomK}">
      ${cs.map(c=>{const s=compState(c.code), n=s.items.length;
        return `<button class="bcell s-${s.k}${c.desc?"":" un"}${bayPick===c.code?" sel":""}" data-comp="${esc(c.code)}"
          style="grid-column:${c.x-minX+1}/span ${c.w};grid-row:${c.y-minY+1}/span ${c.h}">
          <span class="bc">${esc(c.code)}${n?`<span class="bk">${n}</span>`:""}</span>
          ${c.desc?`<span class="bn">${esc(c.desc)}</span>`:`<span class="bn un">Not named yet</span>`}
          ${n?"":`<span class="bn em">${c.checked?"Empty":"Nothing logged"}</span>`}
        </button>`}).join("")}
      </div></div>
      <div class="zoombar"><button data-bayzoom="out" aria-label="Zoom out">&minus;</button>
        <span class="zoomlvl" id="bayzl">${Math.round(bayZoomK*100)}%</span>
        <button data-bayzoom="in" aria-label="Zoom in">+</button>
        <button data-bayzoom="fit" aria-label="Fit the wall">Fit</button></div></div>
    <div id="baypop">${bayPopHTML(cs)}</div></div>
    <div class="orient" style="margin:6px 2px 0">
      <span>${capLeft(side)}</span><span>${capRight(side)}</span></div>
    <div class="baylegend">
      <span><i class="lg lg-good"></i>Swept</span><span><i class="lg lg-unchecked"></i>Not checked</span>
      <span><i class="lg lg-attn"></i>Low or expiring</span><span><i class="lg lg-action"></i>Out or expired</span>
      <span><i class="lg lg-un"></i>Not named yet</span></div>
    <div class="sect">Every compartment</div>
    <div class="rows">${cs.slice().sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}))
      .map(c=>{const s=compState(c.code);
        return `<button class="row${bayPick===c.code?" on":""}" data-comp="${esc(c.code)}">
          <span><span class="code">${esc(c.code)}</span>
          <span class="desc">${esc(c.desc||"Not named yet")}</span></span>
          <span class="rt"><span class="badge b-${s.k}">${esc(s.label)}</span>
          <span class="chev">&#8250;</span></span></button>`}).join("")}</div>`;
}
/* the wall: zoom by layout width so names appear as tiles grow, and a preview of the tapped bin */
let bayZoomK=1, bayZoomBay=null, bayPick=null, bayDragged=false;
function bayPopHTML(cs){
  const c=cs.find(x=>x.code===bayPick); if(!c)return "";
  const s=compState(c.code), it=s.items.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const flag=i=>isOut(i)?["action","Out"]:isExpired(i)?["action","Expired"]:isLow(i)?["attn","Below par"]
    :isService(i)?["attn","Service due"]:isExpiring(i)?["attn",daysOut(i.date)+" days"]:["good","OK"];
  return `<div class="baypop">
    <div class="bph"><b>${esc(c.code)}</b><span>${esc(c.desc||"Not named yet")}</span>
      <span class="badge b-${s.k}" style="margin-left:auto">${esc(s.label)}</span></div>
    ${it.length?it.map(i=>{const f=flag(i);return `<div class="bpi"><span>${esc(i.name)}</span><span>${esc(i.qty)} in stock${i.par?" &middot; par "+esc(i.par):""} <span class="badge b-${f[0]}">${esc(f[1])}</span></span></div>`}).join("")
      :`<p class="hint" style="margin:4px 0 0">${c.checked?"Swept and confirmed empty.":"Nothing logged here yet."}</p>`}
    <div class="objbar">
      <button data-bayopen="${esc(c.code)}">Open</button>
      <button data-addhere="${esc(c.code)}">Add an item</button>
      <button data-bayswept="${esc(c.code)}">${c.checked?"Swept again":"Mark swept"}</button>
      <button data-baypopx="1">Close</button></div></div>`;
}
function bayZoomApply(k,cx,cy){
  const z=document.getElementById("bayzoom"), p=document.getElementById("bayplan"); if(!z||!p)return;
  const k0=bayZoomK; k=Math.min(4,Math.max(1,k)); if(k===k0)return;
  const r=z.getBoundingClientRect();
  const fx=cx==null?.5:(cx-r.left)/r.width, fy=cy==null?.5:(cy-r.top)/r.height;
  const sx=z.scrollLeft+fx*r.width, sy=z.scrollTop+fy*r.height;
  bayZoomK=k; p.style.setProperty("--k",k);
  z.scrollLeft=sx*k/k0-fx*r.width; z.scrollTop=sy*k/k0-fy*r.height;
  const l=document.getElementById("bayzl"); if(l)l.textContent=Math.round(k*100)+"%";
}
const BAYP=new Map(); let bayPinch=null, bayPan=null;
document.addEventListener("pointerdown",e=>{
  const z=e.target.closest&&e.target.closest("#bayzoom"); if(!z)return;
  if(e.isPrimary){BAYP.clear();bayPinch=null;bayPan=null;bayDragged=false}
  BAYP.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(BAYP.size===2){ const [a,b]=[...BAYP.values()]; bayPinch={d:Math.hypot(a.x-b.x,a.y-b.y),k:bayZoomK}; bayPan=null; e.preventDefault(); return }
  if(e.pointerType==="mouse"){ bayPan={x:e.clientX,y:e.clientY,sl:z.scrollLeft,st:z.scrollTop} }
},true);
document.addEventListener("pointermove",e=>{
  if(!BAYP.has(e.pointerId))return;
  BAYP.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const z=document.getElementById("bayzoom"); if(!z)return;
  if(bayPinch&&BAYP.size>=2){ const [a,b]=[...BAYP.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y);
    bayZoomApply(bayPinch.k*d/Math.max(1,bayPinch.d),(a.x+b.x)/2,(a.y+b.y)/2); e.preventDefault(); return }
  if(bayPan){ const dx=e.clientX-bayPan.x, dy=e.clientY-bayPan.y;
    if(Math.hypot(dx,dy)>6)bayDragged=true;
    z.scrollLeft=bayPan.sl-dx; z.scrollTop=bayPan.st-dy }
},{capture:true,passive:false});
["pointerup","pointercancel"].forEach(ev=>document.addEventListener(ev,e=>{
  if(!BAYP.has(e.pointerId))return; BAYP.delete(e.pointerId);
  if(BAYP.size<2)bayPinch=null; if(!BAYP.size)bayPan=null;
},true));
document.addEventListener("wheel",e=>{
  const z=e.target.closest&&e.target.closest("#bayzoom"); if(!z||!(e.ctrlKey||e.metaKey))return;
  e.preventDefault(); bayZoomApply(bayZoomK*(e.deltaY<0?1.15:1/1.15),e.clientX,e.clientY);
},{passive:false});
function appExtraClick7(e){
  const t=e.target;
  const zb=t.closest("[data-bayzoom]"); if(zb){const m=zb.dataset.bayzoom; bayZoomApply(m==="in"?bayZoomK*1.4:m==="out"?bayZoomK/1.4:1); return true}
  const cell=t.closest("#bayplan [data-comp]");
  if(cell){ if(bayDragged){bayDragged=false;return true}
    const code=cell.dataset.comp; if(bayPick===code)return false;
    bayPick=code; const z=document.getElementById("bayzoom"), sl=z?z.scrollLeft:0, st=z?z.scrollTop:0;
    renderBay(); const z2=document.getElementById("bayzoom"); if(z2){z2.scrollLeft=sl;z2.scrollTop=st}
    if(!document.body.classList.contains("wide")){const pop=document.getElementById("baypop"); if(pop&&pop.scrollIntoView)pop.scrollIntoView({block:"nearest"})}
    return true }
  if(t.closest("[data-baypopx]")){bayPick=null; renderBay(); return true}
  const bo=t.closest("[data-bayopen]"); if(bo){ rememberScroll(); prevView="bay"; curComp=bo.dataset.bayopen; view="compdetail";
    $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-compdetail")); window.scrollTo&&window.scrollTo(0,0); render(); return true }
  const bs=t.closest("[data-bayswept]"); if(bs){ const code=bs.dataset.bayswept, r=regUncounted(code);
    if(r.length){toast("Count the regulated items first"); countSheet(code,r); return true}
    const cc=S.comps.find(x=>x.code===code); if(cc){cc.checked=today(); logAct("sweep","Swept "+cc.code); save(); renderBay(); toast(cc.code+" marked swept")} return true }
  if(t.closest("[data-caseall]")){exportCasePackage("all","fsu-all"); return true}
  const sb=t.closest("[data-sweepbay]"); if(sb){ const first=comps().find(c=>bayOf(c.code)===sb.dataset.sweepbay&&!c.checked);
    if(!first)return toast("Every compartment in this bay is swept"),true;
    S.curLoc=first.code; S.pick=false; S.lastCat=""; save(); go("sweep"); const f=$("#q-name")||$("#f-name"); if(f)f.focus(); return true }
  return false;
}

/* ---------- compartment detail ---------- */
let curComp=null, dupOK=false;
function renderCompDetail(){
  const c=S.comps.find(x=>x.code===curComp);
  if(!c){view="compartments";return renderComps()}
  $("#title").textContent=c.code;
  const s=compState(c.code), it=s.items;
  const flag=i=>isOut(i)?["action","Out"]:isExpired(i)?["action","Expired"]
    :isLow(i)?["attn","Below par"]:isService(i)?["attn","Service due"]
    :isExpiring(i)?["attn",daysOut(i.date)+" days"]:["good","OK"];
  const counts=[["action",it.filter(i=>isOut(i)||isExpired(i)).length,"need action"],
    ["attn",it.filter(i=>(isLow(i)||isExpiring(i)||isService(i))&&!isOut(i)&&!isExpired(i)).length,"to check"],
    ["good",it.length,"in total"]].filter(x=>x[1]);
  const sorted=it.slice().sort((a,b)=>{
    const r=i=>isOut(i)||isExpired(i)?0:(isLow(i)||isExpiring(i)||isService(i))?1:2;
    return r(a)-r(b)||a.name.localeCompare(b.name)});
  $("#v-compdetail").innerHTML=`
    <button class="back" data-navback="compartments">&#8249; Storage</button>
    <div class="cdhead">
      <h2>${esc(c.code)}</h2>
      <div class="sub">${esc(c.desc||"No description")}${c.side?" · "+esc(c.side):""}</div>
      <div class="cdstats">${counts.map(([k,v,l])=>
        `<span class="badge b-${k}">${v} ${l}</span>`).join("")}
        ${c.checked?`<span class="badge b-unchecked">Swept ${esc(c.checked)}</span>`:""}</div>
    </div>
    <div class="acts">
      <button data-addhere="${esc(c.code)}">Add an item</button>
      <button data-check="${esc(c.code)}">${c.checked?"Swept again":"Mark swept"}</button>
      <button data-editcomp="${esc(c.code)}">Edit</button>
      ${it.some(i=>i.cls==="Regulated")?`<button data-countall="${esc(c.code)}">Count regulated</button>`:""}
    </div>
    ${sorted.length?`<div class="rows">`+sorted.map(i=>{const f=flag(i);
      return `<button class="row" data-item="${i.id}">
        <span><span class="code">${esc(i.name)}</span>
        <span class="desc">${esc(i.qty)} in stock${i.par?" · par "+esc(i.par):""}${
          i.cls?" · "+esc(i.cls):""}${i.date?" · "+esc(i.date):""}<br>${esc(catName(i.cat))}</span></span>
        <span class="rt"><span class="badge b-${f[0]}">${esc(f[1])}</span><span class="chev">&#8250;</span></span></button>`
      }).join("")+`</div>`
    :`<div class="empty"><strong>Nothing logged here</strong>
       <p>${c.checked?"Swept and confirmed empty.":"Open it, log what's inside, then mark it swept."}</p></div>`}`;
}


/* ---------- item detail ---------- */
let curItem=null, curForm=null, prevView="home";
function itemStatus(i){
  if(!placed(i))return["unchecked","Not placed yet"];
  if(isOut(i))return["action","Out of stock"];
  if(isExpired(i))return["action","Expired"];
  if(isLow(i))return["attn","Below par"];
  if(isService(i))return["attn","Service due"];
  if(isExpiring(i))return["attn","Expires in "+daysOut(i.date)+" days"];
  return["good","Good"];
}
function miniWall(code){
  const c=S.comps.find(x=>x.code===code);
  if(!c||!SIDES.includes(c.side))return "";
  SIDES.forEach(autoPlace);
  if(c.x==null||c.y==null)return "";
  const W=S.walls[c.side]||{cols:24,rows:12};
  const mine=comps().filter(o=>o.side===c.side&&o.x!=null);
  return `<div class="mini">
    <div class="minihead"><b>${esc(c.code)}</b> &middot; ${esc(c.side)}</div>
    <div class="minigrid" style="grid-template-columns:repeat(${W.cols},minmax(0,1fr));grid-template-rows:repeat(${W.rows},minmax(0,1fr));gap:${W.cols>60?1:2}px">
      ${mine.map(o=>`<div class="mslot${o.code===c.code?" hit":""}"
        style="grid-column:${o.x+1}/span ${o.w};grid-row:${o.y+1}/span ${o.h}"
        ></div>`).join("")}
    </div>
    <div class="miniorient"><span>${capLeft(c.side)}</span><span>${capRight(c.side)}</span></div>
  </div>`;
}

function renderItemDetail(){
  const i=S.items.find(x=>x.id===curItem);
  if(!i){view=prevView;return render()}
  $("#title").textContent="Item";
  const c=S.comps.find(x=>x.code===i.loc);
  const st=itemStatus(i), steps=i.steps||[], uses=(i.uses||[]).slice(-5).reverse();
  const backLabel={compdetail:i.loc||"Compartment",compartments:"Storage",
    home:"Home",sweep:"Sweep",search:"Search"}[prevView]||"Back";
  $("#v-itemdetail").innerHTML=`
    <button class="back" data-back="1">&#8249; ${esc(backLabel)}</button>
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div style="flex:1;min-width:0">
        <span class="chip">${esc(catName(i.cat))}</span>
        <h2 class="idtitle">${esc(i.name)}</h2>
        <div class="idsub">${esc(i.cls)}${i.par?" · par level "+esc(i.par):""}</div>
      </div>
      <button class="star ${i.fav?"on":""}" data-fav="${i.id}" aria-label="Favourite">${i.fav?"&#9733;":"&#9734;"}</button>
    </div>

    ${isRequest(i)?`
      <div class="idsect">How to get it</div>
      <div class="kv">
        <div><dt>Not carried in the van</dt><dd>Request it</dd></div>
        ${i.contact?`<div><dt>Who to contact</dt><dd>${esc(i.contact)}</dd></div>`:""}
        ${i.phone?`<div><dt>Phone</dt><dd><a href="tel:${esc(i.phone.replace(/[^0-9+]/g,""))}">${esc(i.phone)}</a></dd></div>`:""}
        ${i.lead?`<div><dt>Typical lead time</dt><dd>${esc(i.lead)}</dd></div>`:""}
      </div>
      ${!i.contact&&!i.phone?`<p class="hint">No contact recorded yet. Add one so this is useful at a scene.</p>`:""}
      <button class="btn sec" data-editreq="${i.id}" style="margin:10px 0 0;max-width:none">Edit request details</button>`
    :`<div class="locline">
       <span class="lc2">${esc(i.loc||"Not placed")}</span>
       <span class="ld2">${esc(c?(c.desc||c.side||"No description"):"No compartment set")}</span>
       <span class="lq2"><b>${esc(i.qty)}</b> in stock</span>
     </div>
    ${miniWall(i.loc)}
    <div class="parrow"><span>Par level <b>${esc(i.par||"not set")}</b></span>
      <span>Status <b style="color:var(--${st[0]==="action"?"red":st[0]==="attn"?"amber":"green"})">${esc(st[1])}</b></span></div>`}

    <div class="idsect">How to use</div>
    ${steps.length?`<div class="steps">${steps.map((s,x)=>
      `<div class="step"><i>${x+1}</i><p>${esc(s)}</p></div>`).join("")}</div>
      ${!i.verified?`<div class="unver">No verified date on these instructions. Check them against the manufacturer sheet or your SOP before relying on them at a scene.</div>`
        :isStale(i)?`<div class="unver bad">Last checked ${esc(i.verified)}, over a year ago. Confirm against the current sheet.</div>`:""}`
    :`<div class="empty" style="padding:20px 16px"><strong>No instructions yet</strong>
       <p>Paste the steps from the manufacturer sheet or your SOP, and record where they came from.</p>
       <button class="btn sec" data-editsteps="${i.id}" style="margin-top:12px">Add instructions</button></div>`}
    ${steps.length?`<button class="btn sec" data-editsteps="${i.id}" style="margin:10px 0 0;max-width:none">Edit instructions</button>`:""}

    <div class="idsect">Guides and documents</div>
    ${(i.links||[]).length?`<div class="links">`+(i.links||[]).map(l=>
      `<a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener">
        <span class="ln">${esc(l.label)}</span>
        <span class="lu">${esc(l.url.replace(/^https?:\/\//,"").split("/")[0])}</span></a>`).join("")+`</div>
      <button class="btn sec" data-editlinks="${i.id}" style="margin:9px 0 0;max-width:none">Edit links</button>`
    :`<div class="empty" style="padding:18px 16px"><strong>No documents linked</strong>
       <p>Link the manufacturer manual, a training video, or the SOP on your shared drive.</p>
       <button class="btn sec" data-editlinks="${i.id}" style="margin-top:12px">Add a link</button></div>`}

    <div class="idsect">Works with</div>
    ${(()=>{const r=(i.rel||[]).map(id=>S.items.find(x=>x.id===id)).filter(Boolean);
      return r.length?`<div class="rel">`+r.map(o=>{const rs=itemStatus(o);
        return `<button class="reltile" data-item="${o.id}">
          <span class="rn">${esc(o.name)}</span>
          <span class="rl">${esc(o.loc||"—")}</span>
          <span class="rq b-${rs[0]}">${esc(o.qty)} in stock</span></button>`}).join("")+`</div>
        <button class="btn sec" data-editrel="${i.id}" style="margin:10px 0 0;max-width:none">Edit what it works with</button>`
      :`<div class="empty" style="padding:18px 16px"><strong>Nothing linked</strong>
         <p>Link the gear you need alongside this — applicator, lifters, a scale — so it's one tap away at a scene.</p>
         <button class="btn sec" data-editrel="${i.id}" style="margin-top:12px">Link items</button></div>`})()}

    <div class="idsect">Details</div>
    <div class="kv">
      <div><dt>Class</dt><dd>${esc(i.cls)}</dd></div>
      <div><dt>${i.cls==="Durable"?"Service due":"Expires"}</dt><dd>${esc(i.date||"—")}</dd></div>
      <div><dt>Category</dt><dd>${esc(i.cat)} · ${esc(catName(i.cat))}</dd></div>
      <div><dt>Instructions verified</dt><dd>${esc(i.verified||"—")}</dd></div>
      <div><dt>Source</dt><dd>${esc(i.source||"—")}</dd></div>
      ${i.cls==="Reagent"?`<div><dt>Lot</dt><dd>${esc(i.lot||"—")}</dd></div>
      <div><dt>Received</dt><dd>${esc(i.received||"—")}</dd></div>
      <div><dt>Opened</dt><dd>${esc(i.opened||"—")}</dd></div>`:""}
      ${i.cls==="Regulated"?`<div><dt>Last counted</dt><dd>${esc(i.counted||"never")}${i.countedBy?" by "+esc(i.countedBy):""}</dd></div>`:""}
      ${i.verifyNote?`<div><dt>Instructions</dt><dd>${esc(i.verifyNote)}</dd></div>`:""}
      ${i.vendor||i.part||i.pack?`<div><dt>Ordering</dt><dd>${esc([i.vendor,i.part,i.pack].filter(Boolean).join(" \u00b7 "))}</dd></div>`:""}
      ${i.cls==="Durable"?`<div><dt>Last serviced</dt><dd>${esc(i.lastService||"\u2014")}</dd></div>
      <div><dt>Certificate</dt><dd>${i.cert?`<a href="${esc(i.cert)}" target="_blank" rel="noopener">Open</a>`:"\u2014"}</dd></div>`:""}
    </div>
    ${i.cls==="Durable"?`<button class="btn sec" data-editsvc="${i.id}" style="margin:10px 0 0;max-width:none">Service and calibration</button>`:""}
    ${i.cls==="Reagent"?`<button class="btn sec" data-editlot="${i.id}" style="margin:10px 0 0;max-width:none">Lot, received and opened dates</button>`:""}
    ${i.cls==="Regulated"?`<button class="btn sec" data-countnow="${i.id}" style="margin:10px 0 0;max-width:none">Count it now</button>`:""}
    ${i.note?`<div class="idsect">Notes</div><div class="kv"><div style="display:block">${esc(i.note).replace(/\n/g,"<br>")}</div></div>`:""}
    ${(()=>{const all=i.uses||[]; if(!all.length)return "";
      const cut=Date.now()-90*86400000;
      const recent=all.filter(u=>Date.parse(u.d)>=cut);
      const burn=recent.reduce((a,u)=>a+n(u.n),0);
      const first=Date.parse(all[0].d), days=Math.max(1,Math.round((Date.now()-first)/86400000));
      const per90=days>=30?Math.round(burn*(90/Math.min(days,90))):null;
      const suggest=per90!==null&&recent.length>=2?Math.max(1,Math.ceil(per90*1.5)):null;
      const parGap=suggest&&i.par!==""&&suggest>n(i.par);
      return `<div class="idsect">Use history</div>
        <div class="kv">
          <div><dt>Used in the last 90 days</dt><dd>${burn}</dd></div>
          <div><dt>Times logged</dt><dd>${all.length}</dd></div>
          <div><dt>Tracking since</dt><dd>${esc(all[0].d)}</dd></div>
        </div>
        ${suggest?`<div class="${parGap?"unver":"okbox"}" style="margin-top:9px">
          At this rate you get through about ${per90} every 90 days.
          ${i.par===""?`A par level around ${suggest} would cover that with room to spare.`
            :parGap?`Your par of ${esc(i.par)} may be low — around ${suggest} would give more headroom.`
            :`Your par of ${esc(i.par)} covers that.`}</div>`
        :`<p class="hint">A suggested par level appears once there is enough use history.</p>`}
        ${uses.length?`<div class="sect">Recent</div><div class="kv">${uses.map(u=>
          `<div><dt>${esc(u.d)}</dt><dd>used ${esc(u.n)}</dd></div>`).join("")}</div>`:""}`})()}

    <div class="actbar"${isRequest(i)?' style="grid-template-columns:1fr 1fr"':""}>
      ${isRequest(i)?"":`<button class="primary" data-loguse="${i.id}">Log use</button>
      <button data-adjust="${i.id}">Adjust qty</button>`}
      ${isRequest(i)?`<button class="primary" data-editreq="${i.id}">Request details</button>`:""}
      <button data-edititem="${i.id}">Edit</button>
    </div>`;
}

function openItem(id,from){rememberScroll();curItem=id;prevView=from||view;view="itemdetail";
  $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-itemdetail"));
  window.scrollTo&&window.scrollTo(0,0);render()}

document.addEventListener("click",e=>{
  const bk=e.target.closest("[data-back]");
  if(bk){e.stopPropagation();return navBack(prevView||"home")}
  const fv=e.target.closest("[data-fav]");
  if(fv){const i=S.items.find(x=>x.id===fv.dataset.fav);
    if(i){i.fav=!i.fav;save();renderItemDetail();toast(i.fav?"Added to quick find":"Removed from quick find")}return}
  const lu=e.target.closest("[data-loguse]");
  if(lu){const i=S.items.find(x=>x.id===lu.dataset.loguse);if(!i)return;
    openSheet(`<h3>Log use</h3>
      <p style="margin:0 0 14px;color:var(--ink2);font-size:14.5px">${esc(i.name)} — ${esc(i.qty)} in stock now.</p>
      <label class="fld"><span>How many used</span><input type="text" id="un" inputmode="numeric" value="1"></label>
      <button class="btn" id="usave" style="max-width:none;margin:0">Log it</button>
      <button class="btn sec" id="ucancel" style="max-width:none">Cancel</button>`);
    $("#ucancel").onclick=closeSheet;
    $("#usave").onclick=()=>{const q=n($("#un").value);
      if(q<=0){closeSheet();return toast("Nothing logged")}
      i.qty=Math.max(0,n(i.qty)-q); (i.uses=i.uses||[]).push({d:today(),n:q});
      save();closeSheet();renderItemDetail();
      toast(isLow(i)?i.name+" is now below par":"Logged — "+i.qty+" left")};
    return}
  const aj=e.target.closest("[data-adjust]");
  if(aj){const i=S.items.find(x=>x.id===aj.dataset.adjust);if(!i)return;
    openSheet(`<h3>Adjust quantity</h3>
      <p style="margin:0 0 14px;color:var(--ink2);font-size:14.5px">Set the true count after a recount or restock. This doesn't record as use.</p>
      <div class="two"><label class="fld"><span>Quantity</span><input type="text" id="aq" inputmode="numeric" value="${esc(i.qty)}"></label>
      <label class="fld"><span>Par level</span><input type="text" id="ap" inputmode="numeric" value="${esc(i.par)}" placeholder="Not set"></label></div>
      <button class="btn" id="asave" style="max-width:none;margin:0">Save</button>
      <button class="btn sec" id="acancel" style="max-width:none">Cancel</button>`);
    $("#acancel").onclick=closeSheet;
    $("#asave").onclick=()=>{i.qty=n($("#aq").value);i.par=$("#ap").value.trim();
      save();closeSheet();renderItemDetail();toast("Updated")};
    return}
  const es=e.target.closest("[data-editsteps]");
  if(es){const i=S.items.find(x=>x.id===es.dataset.editsteps);if(!i)return;
    openSheet(`<h3>Instructions</h3>
      <label class="fld"><span>Steps, one per line</span>
        <textarea id="ss" rows="7" placeholder="Apply with a magnetic applicator, gentle even motion">${esc((i.steps||[]).join("\n"))}</textarea></label>
      <label class="fld"><span>Where these came from</span>
        <input type="text" id="sc" value="${esc(i.source)}" placeholder="Manufacturer IFU, or SOP section"></label>
      <label class="fld"><span>Date you checked them</span>
        <input type="date" id="sv" value="${esc(i.verified)}"></label>
      <button class="btn" id="ssave" style="max-width:none;margin:0">Save instructions</button>
      <button class="btn sec" id="scancel" style="max-width:none">Cancel</button>`);
    $("#scancel").onclick=closeSheet;
    $("#ssave").onclick=()=>{i.steps=$("#ss").value.split("\n").map(s=>s.trim()).filter(Boolean);
      i.source=$("#sc").value.trim();i.verified=$("#sv").value;
      save();closeSheet();renderItemDetail();toast("Instructions saved")};
    return}
  const el=e.target.closest("[data-editlinks]");
  if(el){const i=S.items.find(x=>x.id===el.dataset.editlinks); if(!i)return;
    openSheet(`<h3>Guides and documents</h3>
      <p style="margin:0 0 12px;color:var(--ink2);font-size:14.5px;line-height:1.5">
        One per line. Put a name before the address if you want a label.</p>
      <pre class="fmt">FARO Focus manual | https://example.com/manual.pdf
https://example.com/training-video</pre>
      <textarea id="lk" rows="5" placeholder="Name | https://...">${esc(linksText(i))}</textarea>
      <button class="btn" id="lksave" style="max-width:none;margin-top:10px">Save links</button>
      <button class="btn sec" id="lkx" style="max-width:none">Cancel</button>`);
    $("#lkx").onclick=closeSheet;
    $("#lksave").onclick=()=>{const raw=$("#lk").value;
      const parsed=parseLinks(raw);
      const bad=raw.split(/\r?\n/).filter(l=>l.trim()).length-parsed.length;
      i.links=parsed;save();closeSheet();renderItemDetail();
      toast(bad?bad+" line"+(bad===1?"":"s")+" skipped — needs http:// or https://":"Links saved")};
    return}
  const eq=e.target.closest("[data-editreq]");
  if(eq){const i=S.items.find(x=>x.id===eq.dataset.editreq); if(!i)return;
    openSheet(`<h3>Request details</h3>
      <p style="margin:0 0 12px;color:var(--ink2);font-size:14.5px;line-height:1.5">
        What someone needs to know at a scene to get hold of ${esc(i.name)}.</p>
      <label class="fld"><span>Who to contact</span>
        <input type="text" id="rc" value="${esc(i.contact||"")}" placeholder="Regional lab, evidence unit"></label>
      <div class="two"><label class="fld"><span>Phone</span>
        <input type="text" id="rp" inputmode="tel" value="${esc(i.phone||"")}" placeholder="555-0100"></label>
      <label class="fld"><span>Lead time</span>
        <input type="text" id="rl" value="${esc(i.lead||"")}" placeholder="2 to 4 hours"></label></div>
      <label class="fld"><span>Notes</span><textarea id="rn" rows="3" placeholder="Approval needed, who signs off, cost">${esc(i.note||"")}</textarea></label>
      <button class="btn" id="rsave" style="max-width:none;margin:0">Save</button>
      <button class="btn sec" id="rx" style="max-width:none">Cancel</button>`);
    $("#rx").onclick=closeSheet;
    $("#rsave").onclick=()=>{i.contact=$("#rc").value.trim();i.phone=$("#rp").value.trim();
      i.lead=$("#rl").value.trim();i.note=$("#rn").value.trim();
      save();closeSheet();renderItemDetail();toast("Saved")};
    return}
  const er=e.target.closest("[data-editrel]");
  if(er){const it=S.items.find(x=>x.id===er.dataset.editrel);if(it)relSheet(it);return}
  const ei=e.target.closest("[data-edititem]");
  if(ei){const i=S.items.find(x=>x.id===ei.dataset.edititem);if(!i)return;
    openSheet(`<h3>Edit item</h3>
      <label class="fld"><span>Name</span><input type="text" id="in" value="${esc(i.name)}"></label>
      <div class="two"><label class="fld"><span>Compartment</span><input type="text" id="il" value="${esc(i.loc)}" autocapitalize="characters"></label>
        <label class="fld"><span>${i.cls==="Durable"?"Service due":"Expires"}</span><input type="date" id="id" value="${esc(i.date)}"></label></div>
      <div class="two"><label class="fld"><span>Category</span><select id="ic">${CATS.map(c=>`<option value="${c[0]}"${c[0]===i.cat?" selected":""}>${c[0]} · ${c[1]}</option>`).join("")}</select></label>
        <label class="fld"><span>Class</span><select id="ik">${CLASSES.map(c=>`<option${c===i.cls?" selected":""}>${c}</option>`).join("")}</select></label></div>
      <label class="fld"><span>Note</span><textarea id="io" rows="3">${esc(i.note)}</textarea></label>
      <div class="two"><label class="fld"><span>Supplier</span><input type="text" id="iv" value="${esc(i.vendor||"")}"></label>
        <label class="fld"><span>Part number</span><input type="text" id="ip" value="${esc(i.part||"")}" autocapitalize="characters"></label></div>
      <label class="fld"><span>Pack size</span><input type="text" id="ipk" value="${esc(i.pack||"")}" placeholder="Box of 100"></label>
      <button class="btn" id="isave" style="max-width:none;margin:0">Save</button>
      <button class="btn sec" id="idel" style="max-width:none;color:var(--red);border-color:var(--red)">Delete item</button>
      <button class="btn sec" id="icancel" style="max-width:none">Cancel</button>`);
    $("#icancel").onclick=closeSheet;
    $("#idel").onclick=()=>askConfirm("Delete item","Remove "+i.name+" from the van entirely. This can't be undone here, though the GitHub history keeps it.","Delete item",true,()=>{
      S.items=S.items.filter(x=>x.id!==i.id);
      S.items.forEach(o=>{if(o.rel)o.rel=o.rel.filter(x=>x!==i.id)});
      save();
      view=prevView;$$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-"+view));render();toast("Deleted")});
    $("#isave").onclick=()=>{
      Object.assign(i,{name:$("#in").value.trim()||i.name,loc:$("#il").value.trim().toUpperCase(),
        date:$("#id").value,cat:$("#ic").value,cls:$("#ik").value,note:$("#io").value.trim(),
        vendor:$("#iv").value.trim(),part:$("#ip").value.trim(),pack:$("#ipk").value.trim()});
      if(i.loc&&!S.comps.some(c=>c.code===i.loc))S.comps.push({code:i.loc,desc:"",side:"",x:null,y:null,w:6,h:4});
      save();closeSheet();renderItemDetail();toast("Saved")};
    return}
});


function relSheet(it){
  const draw=(q)=>{
    const ql=(q||"").toLowerCase();
    const list=live().filter(o=>o.id!==it.id)
      .filter(o=>!ql||(o.name+" "+o.loc+" "+catName(o.cat)).toLowerCase().includes(ql))
      .sort((a,b)=>{const s=(it.rel||[]).includes(b.id)-(it.rel||[]).includes(a.id);
        return s||a.name.localeCompare(b.name)}).slice(0,60);
    $("#rellist").innerHTML=list.map(o=>{const on=(it.rel||[]).includes(o.id);
      return `<button class="relrow${on?" on":""}" data-pick="${o.id}">
        <span class="tick">${on?"&#10003;":""}</span>
        <span><span class="rn">${esc(o.name)}</span><span class="rl">${esc(o.loc||"—")} · ${esc(catName(o.cat))}</span></span>
      </button>`}).join("")||`<p class="hint">Nothing matches that.</p>`;
  };
  openSheet(`<h3>Works with</h3>
    <p style="margin:0 0 12px;color:var(--ink2);font-size:14.5px">Pick the gear used alongside ${esc(it.name)}. Links go both ways.</p>
    <input type="text" id="relq" placeholder="Search items" autocomplete="off">
    <div id="rellist" class="rellist" style="margin-top:10px"></div>
    <button class="btn" id="reldone" style="max-width:none;margin-top:12px">Done</button>`);
  draw("");
  $("#relq").oninput=e=>draw(e.target.value);
  $("#reldone").onclick=()=>{closeSheet();renderItemDetail()};
  $("#rellist").onclick=e=>{
    const b=e.target.closest("[data-pick]"); if(!b)return;
    const o=S.items.find(x=>x.id===b.dataset.pick); if(!o)return;
    it.rel=it.rel||[]; o.rel=o.rel||[];
    if(it.rel.includes(o.id)){it.rel=it.rel.filter(x=>x!==o.id);o.rel=o.rel.filter(x=>x!==it.id)}
    else{it.rel.push(o.id);o.rel.push(it.id)}
    save();draw($("#relq").value);
  };
}


/* ---------- printable van map ---------- */
function renderPrint(){
  $("#title").textContent="Printable map";
  const cs=comps();
  const bays=[...new Set(cs.map(c=>bayOf(c.code)))].sort();

  // one block per unit, drawn to its own scale so the labels fit
  const unit=bay=>{
    const mine=cs.filter(c=>bayOf(c.code)===bay);
    if(!mine.length)return "";
    const minX=Math.min(...mine.map(c=>c.x)), minY=Math.min(...mine.map(c=>c.y));
    const W=Math.max(...mine.map(c=>c.x+c.w))-minX, H=Math.max(...mine.map(c=>c.y+c.h))-minY;
    const side=mine[0].side;
    return `<section class="punit">
      <h3>${esc(BAYNAME[bay]||"Bay "+bay)}
        <span>${esc(side)} · ${W}&Prime; wide · ${mine.length} compartments</span></h3>
      <div class="pgrid" style="grid-template-columns:repeat(${W},minmax(0,1fr));
        grid-template-rows:repeat(${H},minmax(0,1fr));aspect-ratio:${(W/H).toFixed(3)};
        gap:${W>40?1:4}px">
        ${mine.map(c=>`<div class="pslot"
          style="grid-column:${c.x-minX+1}/span ${c.w};grid-row:${c.y-minY+1}/span ${c.h}">
          <b>${esc(c.code)}</b>${c.desc?`<i>${esc(c.desc)}</i>`:""}</div>`).join("")}
      </div>
      <div class="porient"><span>${capLeft(side)}</span><span>${capRight(side)}</span></div>
    </section>`};

  const rows=cs.filter(c=>SIDES.includes(c.side)).map(c=>{
    const it=live().filter(i=>i.loc===c.code)
      .sort((a,b)=>a.name.localeCompare(b.name));
    const list=it.length
      ? it.map(i=>`<span class="pit">${esc(i.qty)}&times; ${esc(i.name)}${
          i.cat?` <em>${esc(catName(i.cat))}</em>`:""}</span>`).join("")
      : `<span class="pit pempty">empty</span>`;
    return `<tr><td class="pc">${esc(c.code)}</td>
      <td>${esc(c.desc||"")}<div class="pits">${list}</div></td>
      <td class="pn">${it.length}</td></tr>`}).join("");

  $("#v-print").innerHTML=`
    <div class="noprint" style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <button class="back" data-navback="compartments" style="margin:0;align-self:center">&#8249; Storage</button>
      <button class="btn" id="doprint" style="margin:0;max-width:none">Print</button></div>
    <p class="hint noprint" style="margin:0 0 16px">A page per unit plus a full index, to tape inside
      the van. Use Safari on a computer to print — the home screen
      version has no print menu.</p>
    <div class="psheet">
      <div class="phead"><b>Van compartment map</b><span>${esc(today())}</span></div>
      ${bays.map(unit).join("")}
      <h3 class="plist">Compartment index</h3>
      <table class="ptab"><thead><tr><th>Code</th><th>What it holds</th><th>Items</th></tr></thead>
        <tbody>${rows}</tbody></table>
    </div>`;
}

/* ---------- form fields and filled copies ---------- */
const FTYPES=["text","textarea","date","time","number","check","table"];
if(S.formsSeeded!==STOCKV){S.formsSeeded=STOCKV;seedForms();store.set(S)}
// installs from before built-ins were marked still need flagging
// compartment names, applied on load and after any restore
const COMPNAMES={"1A1": "Power inverter and strip", "1A2": "DNA swabs and swab boxes", "1A3": "Evidence collection lifters", "1A4": "Marking spray paint", "1A5": "Blood reagents — Bluestar, luminol", "1A6": "Small particle reagent", "1B1": "Disposable jumpsuits", "1B2": "Disposable boot covers", "1B3": "Latex gloves", "1B4": "Dye stain and print cleaner", "1B5": "Cyanoacrylate", "1B6": "Face masks", "1B7": "Collection tubes", "1C1": "Evidence collection jars", "1C2": "Small evidence boxes", "1C3": "Very small evidence jars", "1C4": "Mikrosil casting material", "1C6": "Aluminum foil", "1C7": "Yarn, tags and stickers", "1D1": "Distilled water", "1D2": "Evidence markers and cones", "1D3": "Electrostatic dust print lifter", "1D4": "Bluemaxx light kit", "1E": "Pry bars"};
const GENERICDESC=new Set(["Upper storage","Bin, upper row","Bin, upper row, double width",
  "Bin, lower row","Bin, lower row, double width",
  "Evidence tubes / laser trajectory","Metal detector",""]);
function nameComps(){
  let n=0;
  (S.comps||[]).forEach(c=>{const nu=COMPNAMES[c.code];
    if(nu&&GENERICDESC.has((c.desc||"").trim())){c.desc=nu;n++}});
  return n;
}
nameComps(); store.set(S);
if(!S.stockMarked){S.stockMarked=1;
  const names=new Set(STOCKFORMS.map(t=>t.name));
  (S.forms||[]).forEach(f=>{if(names.has(f.name))f.stock=true});
  store.set(S)}
if(!S.guideSeeded){S.guideSeeded=1;seedGuideItems();store.set(S)}
if(!S.srcTidy){S.srcTidy=1;
  (S.items||[]).forEach(i=>{if(/WPD\.pptx/.test(i.source||""))i.source=GUIDESRC});
  store.set(S)}
const fieldsText=f=>(f.fields||[]).map(x=>
  x.type==="table"?x.label+" | table | "+(x.cols||[]).join(", ")
  :x.def?x.label+" | "+x.type+" | "+x.def
  :x.type==="text"?x.label:x.label+" | "+x.type).join("\n");

function fillTitle(r){
  const f=S.forms.find(x=>x.id===r.formId);
  const first=(f&&(f.fields||[]).find(x=>["text","number"].includes(x.type)));
  const v=first?String(r.values[first.id]||"").trim():"";
  return v||("Started "+r.started.slice(0,16).replace("T"," "));
}



