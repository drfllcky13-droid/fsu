/* ---------- the canvas controls, the object panel and the drawing keys ----------
   Part of the Scenes app: a sketch belongs to an incident, so it lives beside it. ---------- */
document.addEventListener("click",e=>{
  const sf=e.target.closest("[data-skfull]");
  if(sf){setFull(sf.dataset.skfull==="1");return}
  const st=e.target.closest("[data-sktools]");
  if(st){skTools=st.dataset.sktools==="1";renderSketch();return}
  if(e.target.closest("[data-skrailtog]")){skRailMin=!skRailMin;renderSketch();return}
  if(e.target.closest("[data-sksnap]")){
    snapOn=e.target.closest("[data-sksnap]").dataset.sksnap==="1";
    renderSketch(); return toast(snapOn?"Snapping on":"Snapping off")}
  if(e.target.closest("[data-skscale]")){
    const sk=S.sketches.find(x=>x.id===curSketch); if(sk)scaleSheet(sk); return }
  if(e.target.closest("[data-skbg]")){
    const sk=S.sketches.find(x=>x.id===curSketch); if(sk)bgSheet(sk); return }
  if(e.target.closest("[data-skrot]")){
    const sk=curSk(); if(!sk)return;
    pushUndo(sk);
    sk.portrait=!sk.portrait;
    const W=pageW(sk),H=pageH(sk);
    (sk.objs||[]).forEach(o=>{
      o.w=Math.min(o.w,W); o.h=Math.min(o.h,H);
      o.x=Math.max(0,Math.min(W-o.w,o.x));
      o.y=Math.max(hasHeader(sk)?HEADER_H+2:0,Math.min(H-o.h,o.y))});
    const off=resolveMeas(sk);   // the clamp above would otherwise silently break measurements
    saveLocal();renderSketch();
    if(off)toast(off+" measured object"+(off===1?"":"s")+" put back where the tape says — some may now sit off the page");
    return}
  const skc=S.sketches.find(x=>x.id===curSketch);
  if(sketchExtraClick3(e,skc)||sketchExtraClick2(e,skc)||sketchExtraClick(e,skc))return;
  if(e.target.closest("[data-skedit]")&&skc)return sketchMetaSheet(skc);
  if(e.target.closest("[data-skpdf]")){
    if(!skc)return;
    if(!(skc.objs||[]).length)return toast("Nothing drawn yet");
    toast("Building the PDF\u2026");
    exportSketch(skc); return;
  }
  if(e.target.closest("[data-skundo]"))return doUndo();
  if(e.target.closest("[data-skredo]"))return doRedo();
  if(e.target.closest("#palqx")){palQ="";renderSketch();return}
  const pl=e.target.closest("[data-pal]");
  if(pl){const n=+pl.dataset.pal; palCat = (palCat===n ? -1 : n); return renderSketch()}
  const ad=e.target.closest("[data-add]"); if(ad)return addObj(ad.dataset.add);
  const onx=e.target.closest("[data-onext]");
  if(onx){
    const sk=S.sketches.find(x=>x.id===curSketch), o=objAt(onx.dataset.onext);
    if(sk&&o){ pushUndo(sk);
      o.n=String(o.t==="photopoint"?nextPhotoNo(sk):nextMarkerNo(sk));
      saveLocal(); if(o.t==="marker")syncMarker(sk,o);
      renderSketch(); toast("Numbered "+o.n) }
    return}
  const oph=e.target.closest("[data-ophoto]");
  if(oph){const o=objAt(oph.dataset.ophoto); if(o)photoSheet(o); return}
  const ophx=e.target.closest("[data-ophotox]");
  if(ophx){const o=objAt(ophx.dataset.ophotox); if(o&&o.photoId){
    photoDel(o.photoId).catch(()=>{}); delete o.photoId; saveLocal(); renderSketch();
    toast("Photograph removed")} return}
  const ol=e.target.closest("[data-olabel]"); if(ol)return labelSheet(objAt(ol.dataset.olabel));
  const ik=e.target.closest("[data-ink]");
  if(ik){const o=objAt(selObj); if(o){pushUndo(skc);o.ink=ik.dataset.ink;saveLocal();renderSketch()} return}
  const or0=e.target.closest("[data-orot0]");
  if(or0){const o=objAt(or0.dataset.orot0);if(o){if(o.lockR)return toast("Rotation is locked");pushUndo(skc);o.r=0;saveLocal();renderSketch()}return}
  const orr=e.target.closest("[data-orot]");
  if(orr){const o=objAt(orr.dataset.orot);if(o){if(o.lockR)return toast("Rotation is locked");pushUndo(skc);o.r=((o.r||0)+15)%360;saveLocal();renderSketch()}return}
  const od=e.target.closest("[data-odup]");
  if(od){const o=objAt(od.dataset.odup);if(o&&skc){
    if(layerLocked(skc,o))return toast((layerOf(skc,o)||{}).name+" is locked");
    pushUndo(skc);const c=dupObj(skc,o);
    skc.objs.push(c);selObj=c.id;saveLocal();renderSketch();
    if(o.meas)toast("Copied. The copy has no measurement — measure it where it actually is")}return}
  if(e.target.closest("#newlay")){
    if(!skc)return; pushUndo(skc); const L=addLayer(skc); curLayer=L.id;
    keepScroll(()=>renderSketch()); return toast(L.name+" added \u2014 new objects go here")}
  const lsel=e.target.closest("[data-laysel]");
  if(lsel){curLayer=lsel.dataset.laysel; keepScroll(()=>renderSketch());
    const L=layersOf(skc).find(x=>x.id===curLayer);
    return toast("Drawing into "+(L?L.name:"layer"))}
  const llk=e.target.closest("[data-laylock]");
  if(llk&&skc){const L=layersOf(skc).find(x=>x.id===llk.dataset.laylock);
    if(L){pushUndo(skc);L.locked=!L.locked;
      if(L.locked){ showSet=false;
        const o=selObj?objAt(selObj):null;
        if(o&&(o.lay||layersOf(skc)[0].id)===L.id)selObj=null }
      saveLocal(); keepScroll(()=>renderSketch()); toast(L.name+(L.locked?" locked":" unlocked"))}
    return}
  const omr=e.target.closest("[data-omore]");
  if(omr){
    const sk2=S.sketches.find(x=>x.id===curSketch); const o=objAt(omr.dataset.omore);
    if(!sk2||!o)return;
    const ls=layersOf(sk2), lk=layerLocked(sk2,o);
    const i=sk2.objs.findIndex(x=>x.id===o.id);
    openSheet(`<h3>${esc(o.label||SHAPENAME(o.t))}</h3>
      ${lk?`<p class="hint" style="margin:0 0 12px">${esc((layerOf(sk2,o)||{}).name)} is locked.
        Unlock it to change this object.</p>`:""}
      <div class="stackb">
        <button class="btn" id="omset" style="max-width:none;margin:0"${lk?" disabled":""}>Settings</button>
        <button class="btn sec" id="omfwd" style="max-width:none"${lk||i>=sk2.objs.length-1?" disabled":""}>Bring forward</button>
        <button class="btn sec" id="ombck" style="max-width:none"${lk||i<=0?" disabled":""}>Send back</button>
        ${ls.length>1?`<label class="fld" style="margin-top:6px"><span>Move to layer</span>
          <select id="ommove"${lk?" disabled":""}>${ls.map(L=>
            `<option value="${L.id}"${(o.lay||ls[0].id)===L.id?" selected":""}>${esc(L.name)}</option>`).join("")}
          </select></label>`:""}
        <button class="btn sec" id="omdel" style="max-width:none;color:var(--red);border-color:var(--red)"${lk?" disabled":""}>Delete</button>
        <button class="btn sec" id="omx" style="max-width:none">Cancel</button></div>`);
    $("#omx").onclick=closeSheet;
    $("#omset").onclick=()=>{selObj=o.id;showSet=true;closeSheet();keepScroll(()=>renderSketch())};
    $("#omfwd").onclick=()=>{pushUndo(sk2);const k=sk2.objs.findIndex(x=>x.id===o.id);
      if(k>-1&&k<sk2.objs.length-1){const[m]=sk2.objs.splice(k,1);sk2.objs.splice(k+1,0,m)}
      saveLocal();closeSheet();keepScroll(()=>renderSketch())};
    $("#ombck").onclick=()=>{pushUndo(sk2);const k=sk2.objs.findIndex(x=>x.id===o.id);
      if(k>0){const[m]=sk2.objs.splice(k,1);sk2.objs.splice(k-1,0,m)}
      saveLocal();closeSheet();keepScroll(()=>renderSketch())};
    const mv=$("#ommove");
    if(mv)mv.onchange=()=>{pushUndo(sk2);o.lay=mv.value;saveLocal();closeSheet();
      keepScroll(()=>renderSketch());toast("Moved to "+((ls.find(L=>L.id===o.lay)||{}).name||"layer"))};
    $("#omdel").onclick=()=>{pushUndo(sk2);sk2.objs=sk2.objs.filter(x=>x.id!==o.id);
      selObj=null;saveLocal();closeSheet();keepScroll(()=>renderSketch());
      toast(SHAPENAME(o.t)+" removed \u2014 Undo to bring it back")};
    return}
  const lmr=e.target.closest("[data-laymore]");
  if(lmr){
    const sk2=S.sketches.find(x=>x.id===curSketch); if(!sk2)return;
    const ls=layersOf(sk2), L=ls.find(x=>x.id===lmr.dataset.laymore); if(!L)return;
    const count=(sk2.objs||[]).filter(o=>(o.lay||ls[0].id)===L.id).length;
    openSheet(`<h3>${esc(L.name)}</h3>
      <label class="fld"><span>Name</span><input type="text" id="lnv" value="${esc(L.name)}"></label>
      <div class="stackb">
        <button class="btn" id="lnsave" style="max-width:none;margin:0">Save name</button>
        <button class="btn sec" id="lndraw" style="max-width:none">Draw into this layer</button>
        <button class="btn sec" id="lnmove" style="max-width:none">Move everything on this layer</button>
        ${ls.length>1?`<button class="btn sec" id="lndel"
          style="max-width:none;color:var(--red);border-color:var(--red)">Delete layer${
            count?" ("+count+" object"+(count===1?"":"s")+" move out)":""}</button>`:""}
        <button class="btn sec" id="lnx" style="max-width:none">Cancel</button></div>`);
    $("#lnx").onclick=closeSheet;
    $("#lnsave").onclick=()=>{const nm=$("#lnv").value.trim();
      if(nm&&nm!==L.name){pushUndo(sk2);L.name=nm}
      saveLocal();closeSheet();keepScroll(()=>renderSketch());toast("Saved")};
    $("#lndraw").onclick=()=>{curLayer=L.id;closeSheet();keepScroll(()=>renderSketch());
      toast("Drawing into "+L.name)};
    $("#lnmove").onclick=()=>layerMoveStart(sk2,L);
    const dl=$("#lndel");
    if(dl)dl.onclick=()=>{
      const other=ls.find(x=>x.id!==L.id&&!x.locked)||ls.find(x=>x.id!==L.id);
      pushUndo(sk2);
      (sk2.objs||[]).forEach(o=>{if((o.lay||ls[0].id)===L.id)o.lay=other.id});
      sk2.layers=ls.filter(x=>x.id!==L.id);
      if(curLayer===L.id)curLayer=other.id;
      saveLocal();closeSheet();keepScroll(()=>renderSketch());
      toast(count?count+" object"+(count===1?"":"s")+" moved to "+other.name+" — Undo brings the layer back"
        :"Layer deleted — Undo brings it back")};
    return}
  const ost=e.target.closest("[data-oset]");
  if(ost){selObj=ost.dataset.oset; showSet=true; keepScroll(()=>renderSketch()); return}
  const lu=e.target.closest("[data-lup]");
  if(lu&&skc){pushUndo(skc);const i=skc.objs.findIndex(x=>x.id===lu.dataset.lup);
    if(i>-1&&i<skc.objs.length-1){const[o]=skc.objs.splice(i,1);skc.objs.splice(i+1,0,o);
      selObj=o.id;saveLocal();keepScroll(()=>renderSketch())}return}
  const ld=e.target.closest("[data-ldn]");
  if(ld&&skc){pushUndo(skc);const i=skc.objs.findIndex(x=>x.id===ld.dataset.ldn);
    if(i>0){const[o]=skc.objs.splice(i,1);skc.objs.splice(i-1,0,o);
      selObj=o.id;saveLocal();keepScroll(()=>renderSketch())}return}
  const of_=e.target.closest("[data-ofwd]");
  if(of_&&skc){pushUndo(skc);const i=skc.objs.findIndex(x=>x.id===of_.dataset.ofwd);
    if(i>-1){skc.objs.push(skc.objs.splice(i,1)[0]);saveLocal();keepScroll(()=>renderSketch())}return}
  const oz=e.target.closest("[data-odel]");
  if(oz&&skc){const o=objAt(oz.dataset.odel);if(!o)return;
    if(layerLocked(skc,o))return toast((layerOf(skc,o)||{}).name+" is locked");
    // no confirmation: undo covers a mistake, and a sheet was getting in the way on iPad
    pushUndo(skc);skc.objs=skc.objs.filter(x=>x.id!==o.id);selObj=null;saveLocal();
    keepScroll(()=>renderSketch());
    return toast(SHAPENAME(o.t)+" removed \u2014 Undo to bring it back")}
  const os=e.target.closest("[data-osel]");
  if(os){
    const skS=S.sketches.find(x=>x.id===curSketch), oS=objAt(os.dataset.osel);
    if(skS&&oS&&layerLocked(skS,oS))return toast((layerOf(skS,oS)||{}).name+" is locked");
    selObj=os.dataset.osel;showSet=false;keepScroll(()=>renderSketch());
    const el=document.querySelector(".canvaswrap");if(el&&el.scrollIntoView)el.scrollIntoView({block:"center"});return}
  if(e.target.closest("[data-skdel]")&&skc)
    return askConfirm("Delete sketch","Everything measured for "+(skc.caseNo||"this sketch")+" is removed. Export first if you need it.","Delete sketch",true,()=>{
      if(skc.bg&&skc.bg.imgId)photoDel(skc.bg.imgId).catch(()=>{});
      (skc.objs||[]).forEach(o=>{if(o.photoId)photoDel(o.photoId).catch(()=>{})});
      const back=skc.incidentId&&incidentOf(skc.incidentId);
      S.sketches=S.sketches.filter(x=>x.id!==skc.id);saveLocal();
      try{localStorage.removeItem("fsu-undo-"+skc.id)}catch(_){}
      if(back){curInc=skc.incidentId;view="incident";render()}
      else{go("active")}
      toast("Sketch deleted")});
});

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
  const w=document.querySelector(".canvaswrap"); if(w)w.innerHTML=canvasSVG(sk)+zoomBar()+objsetFloat(sk,objAt(selObj));
}

document.addEventListener("input",e=>{
  if(e.target&&e.target.id==="palq"){
    palQ=e.target.value; const at=e.target.selectionStart;
    renderSketch();
    const el=document.getElementById("palq");
    if(el){el.focus(); try{el.setSelectionRange(at,at)}catch(_){}}
    return}
  const lsw=e.target.closest("#olay");
  if(lsw){const o=objAt(selObj), sk2=S.sketches.find(x=>x.id===curSketch);
    if(o&&sk2){pushUndo(sk2);o.lay=lsw.value;saveLocal();keepScroll(()=>renderSketch());
      toast("Moved to "+((layersOf(sk2).find(L=>L.id===o.lay)||{}).name||"layer"))}
    return}
  const on=e.target.closest("#oname"), num=e.target.closest("#onum");
  if(on||num){const o=objAt(selObj); if(o){
      const fEl=on||num, fid=fEl.id, at=fEl.selectionStart;
      if(on)o.label=on.value;
      if(num)o.n=num.value.trim();
      saveLocal();redrawCanvas();
      // redrawCanvas rebuilds the field itself (the label previews live on the canvas) —
      // put the caret back or every keystroke past the first drops focus to the page
      const el=document.getElementById(fid);
      if(el){el.focus(); try{el.setSelectionRange(at,at)}catch(_){}}
      const skNow=S.sketches.find(x=>x.id===curSketch);
      if(skNow&&skNow.incidentId&&(o.t==="marker"||o.t==="photopoint")){
        clearTimeout(window.__mkT);
        window.__mkT=setTimeout(()=>o.t==="marker"?syncMarker(skNow,o):syncPhoto(skNow,o),700);   // wait for typing to settle
      }} return}
});

document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();return e.shiftKey?doRedo():doUndo()}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="y"){e.preventDefault();return doRedo()}
  if(e.key==="Escape"){
    if($("#sheet")&&$("#sheet").classList.contains("on"))return closeSheet();
    if(skFull)return setFull(false);
    if(typeof polyDraw!=="undefined"&&polyDraw){polyDraw=null;return renderSketch()}
    if(selObj){selObj=null;return renderSketch()}
    return go("active");
  }
  if(/^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName||""))return;
  if(!selObj)return;
  const o=objAt(selObj); if(!o)return;
  const step=e.shiftKey?10:1;
  // One undo entry per run of nudges, not one per keystroke: 40 taps would otherwise flush the
  // whole history, and undoing a tidy-up one pixel at a time is not what anyone means by undo.
  const nudge=(dx,dy)=>{
    e.preventDefault();
    const sk=S.sketches.find(x=>x.id===curSketch); if(!sk)return;
    if(layerLocked(sk,o))return toast((layerOf(sk,o)||{}).name+" is locked");
    const now=Date.now();
    if(NUDGE.id!==o.id||now-NUDGE.t>1200)pushUndo(sk); else sk.updated=new Date().toISOString();
    NUDGE.id=o.id; NUDGE.t=now;
    const W=pageW(sk), H=pageH(sk), top=hasHeader(sk)?HEADER_H+2:0;
    o.x=Math.max(-o.w*.4,Math.min(W-o.w*.6,o.x+dx));
    o.y=Math.max(Math.min(top,o.y),Math.min(H-o.h*.6,o.y+dy));
    if(o.meas)measFromGeometry(sk,o,true);  // the drawing and the measurement stay in step
    saveLocal();renderSketch()};
  if(e.key==="ArrowLeft")return nudge(-step,0);
  if(e.key==="ArrowRight")return nudge(step,0);
  if(e.key==="ArrowUp")return nudge(0,-step);
  if(e.key==="ArrowDown")return nudge(0,step);
  if(e.key==="Delete"||e.key==="Backspace"){
    const sk=S.sketches.find(x=>x.id===curSketch); if(!sk)return;
    if(layerLocked(sk,o)){toast("Layer is locked");e.preventDefault();return}
    pushUndo(sk);
    sk.objs=sk.objs.filter(x=>x.id!==o.id);selObj=null;saveLocal();renderSketch();
    e.preventDefault();return}
  if(e.key==="d"||e.key==="D"){
    const sk=S.sketches.find(x=>x.id===curSketch); if(!sk)return;
    if(layerLocked(sk,o))return toast((layerOf(sk,o)||{}).name+" is locked");
    pushUndo(sk);
    const c=dupObj(sk,o);
    sk.objs.push(c);selObj=c.id;saveLocal();renderSketch();
    if(o.meas)toast("Copied. The copy has no measurement — measure it where it actually is")}
});
