/* ---------- nav ---------- */
let view="home", query="";
function buildTabs(){
  const nOpen=openDocs().length;
  const SHORT={};
  $("#tabs").innerHTML=TABS.map(([v,l0])=>{const l=SHORT[v]||l0;
    return `<button data-v="${v}" aria-current="${v===view}">${ic(v)}${
      v==="active"&&nOpen?`<i class="tdot">${nOpen}</i>`:""}<span>${l}</span></button>`}).join("");
  const L=live();
  const att=L.filter(i=>isOut(i)||isLow(i)||isExpired(i)||isExpiring(i)||isService(i)).length;
  const unchk=comps().filter(c=>compState(c.code).k==="unchecked").length;
  const scene=(S.fills||[]).length+(S.sketches||[]).length;
  const count={home:att?{n:att,hot:true}:null,
    compartments:unchk?{n:unchk,hot:false}:null,
    inventory:L.length?{n:L.length,hot:false}:null,
    active:nOpen?{n:nOpen,hot:true}:null,
    forms:scene?{n:scene,hot:false}:null,guide:null};
  $("#side").innerHTML=`<button class="sidetog" data-sidetog="1" aria-label="${S.sideMin?"Expand the side bar":"Collapse the side bar"}" title="${S.sideMin?"Expand":"Collapse"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${S.sideMin?"M9 6l6 6-6 6":"M15 6l-6 6 6 6"}"/></svg></button><div class="ident"><div class="idot">F</div>
      <div><div class="in1">FSU</div><div class="in2">${esc(S.vanName||"Forensic Services Unit")}</div></div></div>`
    +TABS.map(([v,l])=>{
    const c=count[v];
    return `<button data-v="${v}" aria-current="${v===view}">${ic(v)}<span class="lbl">${esc(l)}</span>
      ${c?`<span class="pill${c.hot?" hot":""}">${c.n}</span>`:""}</button>`}).join("")
    +`<button class="sset" data-v="data" aria-current="${view==="data"}">${ic("gear")}<span class="lbl">Settings</span></button>`;
}
const scrollMem={};
function rememberScroll(){ if(view)scrollMem[view]=window.scrollY||0 }
function restoreScroll(v){
  const y=scrollMem[v]||0;
  const put=()=>window.scrollTo&&window.scrollTo(0,y);
  put(); if(typeof requestAnimationFrame==="function")requestAnimationFrame(put);
}
function go(v){rememberScroll();
  // moving by tab or back button is not a drill-down, so forget where we came from
  prevView=null;
  view=v;query="";$("#q").value="";$("#qclear").style.display="none";
  $$(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));
  render();restoreScroll(v)}
document.addEventListener("click",e=>{const b=e.target.closest("#tabs button,#side button");if(b&&b.dataset.v)go(b.dataset.v)});
function fitCanvas(){
  const grid=document.querySelector(".skgrid.full"); if(!grid)return;
  const main=grid.querySelector(".skmain"), wrap=grid.querySelector(".canvaswrap");
  if(!main||!wrap)return;
  wrap.style.width="";wrap.style.height="";
  const cs=getComputedStyle(main), gap=parseFloat(cs.rowGap)||8;
  let used=0;
  [...main.children].forEach(c=>{if(c!==wrap)used+=c.getBoundingClientRect().height+gap});
  const availH=Math.max(90,main.clientHeight-used);
  const availW=Math.max(120,main.clientWidth);
  const sk=curSk(), ar=pageW(sk)/pageH(sk);
  let w=availW,hh=w/ar;
  if(hh>availH){hh=availH;w=hh*ar}
  wrap.style.width=Math.floor(w)+"px";
  wrap.style.height=Math.floor(hh)+"px";
}
function setFull(on){
  skFull=!!on;
  document.body.classList.toggle("skfull",skFull);
  if(skFull){ try{const el=document.documentElement;
      el.requestFullscreen&&el.requestFullscreen().catch(()=>{})}catch(_){} }
  else { try{document.fullscreenElement&&document.exitFullscreen&&document.exitFullscreen()}catch(_){} }
  renderSketch();
}
document.addEventListener("fullscreenchange",()=>{
  if(!document.fullscreenElement&&skFull&&view==="sketch"){/* browser chrome only; overlay stays */}
});
function redrawCanvas(){
  const sk=S.sketches.find(x=>x.id===curSketch); if(!sk)return;
  const w=document.querySelector(".canvaswrap"); if(w)w.innerHTML=canvasSVG(sk)+zoomBar();
}
document.addEventListener("input",e=>{
  if(e.target&&e.target.id==="palq"){
    palQ=e.target.value; const at=e.target.selectionStart;
    renderSketch();
    const el=document.getElementById("palq");
    if(el){el.focus(); try{el.setSelectionRange(at,at)}catch(_){}}
    return}
  const tp=e.target.closest("[data-tpar]");
  if(tp){const i=S.items.find(x=>x.id===tp.dataset.tpar);
    if(i){i.par=tp.value.replace(/[^0-9]/g,"");saveLocal()} return}
  const tc=e.target.closest("[data-tcat]");
  if(tc){const i=S.items.find(x=>x.id===tc.dataset.tcat);
    if(i){i.cat=tc.value;saveLocal();toast("Set to "+catName(i.cat))} return}
  const lsw=e.target.closest("#olay");
  if(lsw){const o=objAt(selObj), sk2=S.sketches.find(x=>x.id===curSketch);
    if(o&&sk2){pushUndo(sk2);o.lay=lsw.value;saveLocal();keepScroll(()=>renderSketch());
      toast("Moved to "+((layersOf(sk2).find(L=>L.id===o.lay)||{}).name||"layer"))}
    return}
  const on=e.target.closest("#oname"), num=e.target.closest("#onum");
  if(on||num){const o=objAt(selObj); if(o){
      if(on)o.label=on.value;
      if(num)o.n=num.value.trim();
      saveLocal();redrawCanvas();
      const skNow=S.sketches.find(x=>x.id===curSketch);
      if(skNow&&skNow.incidentId&&(o.t==="marker"||o.t==="photopoint")){
        clearTimeout(window.__mkT);
        window.__mkT=setTimeout(()=>o.t==="marker"?syncMarker(skNow,o):syncPhoto(skNow,o),700);   // wait for typing to settle
      }} return}
  const r=S.fills.find(x=>x.id===curFill); if(!r)return;
  const fv=e.target.closest("[data-fv]");
  if(fv){r.values[fv.dataset.fv]=fv.value;return saveLocal()}
  const tb=e.target.closest("[data-ftab]");
  if(tb){const k=tb.dataset.ftab,ri=+tb.dataset.tr;
    if(!Array.isArray(r.values[k]))r.values[k]=[];
    if(!r.values[k][ri])r.values[k][ri]={};
    r.values[k][ri][tb.dataset.tc]=tb.value;saveLocal()}
});
let searchFrom="home";
function applyQuery(){
  $("#qclear").style.display=query?"":"none";
  if(query){ if(view!=="search"){searchFrom=view;view="search"} }
  else if(view==="search"){ view=searchFrom||"home" }
  $$(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+view));
  window.scrollTo&&window.scrollTo(0,0);render();
}
$("#q").addEventListener("input",e=>{query=e.target.value.trim();applyQuery()});
$("#qclear").onclick=()=>{$("#q").value="";query="";applyQuery()};

