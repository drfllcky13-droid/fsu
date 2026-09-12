/* ---------- events ---------- */
document.addEventListener("click",e=>{
  if(appExtraClick10(e)||appExtraClick9(e)||appExtraClick7(e)||appExtraClick(e))return;
  const nb=e.target.closest("[data-navback]");
  if(nb){e.stopPropagation();return navBack(nb.dataset.navback)}
  const g=e.target.closest("[data-go]"); if(g)return go(g.dataset.go);
  if(e.target.closest("#parall")){
    const n=live().filter(i=>(i.loc||"").trim()&&!String(i.par||"").trim());
    if(!n.length)return;
    return askConfirm("Set par to 1","Every placed item without a par level gets 1. "
      +"Change any of them afterwards.","Set "+n.length+" to 1",false,()=>{
        n.forEach(i=>{i.par="1"}); save(); renderTidy();
        toast(n.length+" set to 1")})}
  const tf=e.target.closest("[data-tidyf]");
  if(tf){S.tidyOnly=tf.dataset.tidyf==="1";save();renderTidy();return}
  if(e.target.closest("#gotidy")){view="tidy";window.scrollTo&&window.scrollTo(0,0);return render()}
  if(e.target.closest("#goreorder")){view="reorder";window.scrollTo&&window.scrollTo(0,0);return render()}
  if(e.target.closest("#rocopy")){
    const t=reorderText();
    if(navigator.clipboard)navigator.clipboard.writeText(t).then(()=>toast("Copied")).catch(()=>toast("Could not copy"));
    else toast("Could not copy");
    return}
  if(e.target.closest("#roshare")){
    const t=reorderText(), name="reorder-"+today()+".txt";
    (async()=>{
      try{
        const file=new File([t],name,{type:"text/plain"});
        if(navigator.canShare&&navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:"Reorder list"}); logAct("reorder","Sent the reorder list"); return toast("Sent")}
      }catch(err){ if(err&&err.name==="AbortError")return }
      if(download(t,name,"text/plain"))toast("Downloaded"); else toast("Use Copy list instead");
    })();
    return}
  const l=e.target.closest("[data-list]"); if(l){view="home";return renderList(l.dataset.list)}
  const bh=e.target.closest("[data-bay]");
  if(bh){rememberScroll();prevView="compartments";curBay=bh.dataset.bay;
    view="bay";window.scrollTo&&window.scrollTo(0,0);return render()}
  const c=e.target.closest("[data-comp]");
  if(c){
    rememberScroll();prevView=view==="bay"?"bay":"compartments";curComp=c.dataset.comp;view="compdetail";
    $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-compdetail"));
    window.scrollTo&&window.scrollTo(0,0);return render()}
  const ec=e.target.closest("[data-editcomp]");
  if(ec){const c=S.comps.find(x=>x.code===ec.dataset.editcomp); if(!c)return;
    const held=live().filter(i=>i.loc===c.code).length;
    openSheet(`<h3>Edit compartment</h3>
      <div class="two"><label class="fld"><span>Code</span>
        <input type="text" id="cc" value="${esc(c.code)}" autocapitalize="characters"></label>
      <label class="fld"><span>Side of the van</span><select id="cs">
        <option value="">Not placed</option>${SIDES.map(z=>`<option${z===c.side?" selected":""}>${z}</option>`).join("")}</select></label></div>
      <label class="fld"><span>Where it is, in plain words</span>
        <input type="text" id="cd" value="${esc(c.desc||"")}" placeholder="Drawer 3, left"></label>
      <p class="hint" style="margin:0 0 14px">${held?"Renaming moves all "+held+" item"+(held===1?"":"s")+" in here with it.":"Nothing logged in here yet."}</p>
      <button class="btn" id="csave" style="max-width:none;margin:0">Save</button>
      <button class="btn sec" id="cdel" style="max-width:none;color:var(--red);border-color:var(--red)">Delete compartment</button>
      <button class="btn sec" id="cx" style="max-width:none">Cancel</button>`);
    $("#cx").onclick=closeSheet;
    $("#cdel").onclick=()=>askConfirm("Delete compartment",
      held?"The "+held+" item"+(held===1?"":"s")+" in "+c.code+" stay in the van but lose their compartment. You can reassign them from each item.":"Nothing is in "+c.code+", so nothing else changes.",
      "Delete compartment",true,()=>{
        S.items.forEach(i=>{if(i.loc===c.code)i.loc=""});
        S.comps=S.comps.filter(x=>x.code!==c.code);
        if(S.curLoc===c.code)S.curLoc="";
        save();go("compartments");toast(c.code+" deleted")});
    $("#csave").onclick=()=>{
      const nu=$("#cc").value.trim().toUpperCase();
      if(!nu)return toast("Needs a code");
      if(nu!==c.code&&S.comps.some(x=>x.code===nu))return toast(nu+" already exists");
      const old=c.code;
      if(nu!==old){S.items.forEach(i=>{if(i.loc===old)i.loc=nu});
        if(S.curLoc===old)S.curLoc=nu; c.code=nu; curComp=nu}
      c.side=$("#cs").value; c.desc=$("#cd").value.trim();
      save();closeSheet();renderCompDetail();toast("Saved")};
    return}
  const ah=e.target.closest("[data-addhere]");
  if(ah){S.curLoc=ah.dataset.addhere;S.lastCat="";save();return go("sweep")}
  const ck=e.target.closest("[data-check]");
  if(ck){const cc=S.comps.find(x=>x.code===ck.dataset.check);
    if(cc){cc.checked=new Date().toISOString().slice(0,10);logAct("sweep","Swept "+cc.code);save();renderCompDetail();
      toast(cc.code+" marked swept");
      // finishing a sweep is the moment a backup is worth most
      const left=S.comps.filter(c=>!c.checked).length;
      if(left===0&&S.comps.length){
        const stale=!S.lastBackup||S.lastBackup!==today();
        if(stale)setTimeout(()=>askConfirm("Sweep finished",
          "All "+S.comps.length+" compartments are checked. Back up now so there is a copy off this phone.",
          "Back up",false,()=>backupOut()),700);
      }}
    return}
  if(e.target.closest("#doprint")){window.print&&window.print();return}
  const sf=e.target.closest("[data-skfull]");
  if(sf){setFull(sf.dataset.skfull==="1");return}
  const st=e.target.closest("[data-sktools]");
  if(st){skTools=st.dataset.sktools==="1";renderSketch();return}
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
  if(e.target.closest("#syncnow")){
    if(conflict||tokenBad||badFile){openSettings("sync");return}
    syncErr="";retries=0;renderSyncBar();toast("Retrying");ghPush(false);return}
  if(e.target.closest("[data-quicksketch]")){
    const sk=newSketch(); curSketch=sk.id; selObj=null; curLayer=null;
    prevView=null; view="sketch"; window.scrollTo&&window.scrollTo(0,0);
    render(); return toast("Sketch started \u2014 add scene details when you have them")}
  if(e.target.closest("[data-newinc]")){
    const inc=newIncident(); curInc=inc.id; view="incident"; render(); incidentSheet(inc); return}
  const ib=e.target.closest("[data-inc]");
  if(ib){curInc=ib.dataset.inc; view="incident"; render(); return}
  if(e.target.closest("[data-incbundle]")){
    const inc=incidentOf(curInc); if(!inc)return;
    toast("Building the bundle\u2026"); bundleIncident(inc); return}
  if(e.target.closest("[data-incedit]")){
    const inc=incidentOf(curInc); if(inc)incidentSheet(inc); return}
  if(e.target.closest("[data-incdel]")){
    const inc=incidentOf(curInc); if(!inc)return;
    const docs=docsFor(inc.id);
    return askConfirm("Delete incident",
      (docs.length? docs.length+" document"+(docs.length===1?"":"s")+" started for "
        +(inc.caseNo||"this incident")+" will be deleted with it. "
        : "")+"Anything already exported to the case file is unaffected.",
      "Delete everything",true,()=>{
        (S.sketches||[]).forEach(s=>{ if(s.incidentId===inc.id&&s.bg&&s.bg.imgId)
          photoDel(s.bg.imgId).catch(()=>{});
          if(s.incidentId===inc.id)(s.objs||[]).forEach(o=>{
            if(o.photoId)photoDel(o.photoId).catch(()=>{})}) });
        S.fills=(S.fills||[]).filter(x=>x.incidentId!==inc.id);
        S.sketches=(S.sketches||[]).filter(x=>x.incidentId!==inc.id);
        S.incidents=(S.incidents||[]).filter(x=>x.id!==inc.id);
        curInc=null; save(); view="active"; window.scrollTo&&window.scrollTo(0,0);
        render(); toast("Incident deleted")})}
  if(e.target.closest("[data-incclose]")){
    const incR=incidentOf(curInc);
    if(incR&&incR.closed){ delete incR.closed; save(); renderIncident(); return toast("Reopened") }
    const inc=incidentOf(curInc); if(!inc)return;
    const left=(inc.plan||[]).map(k=>planState(inc,k)).filter(p=>p&&p.state!=="done").length;
    return askConfirm("Close incident",
      left? left+" document"+(left===1?"":"s")+" still outstanding. Closing moves it out of Active; "
            +"you can still reopen it from the incident list."
          : "This moves it out of Active. You can reopen it later.",
      "Close it",false,()=>{
        inc.closed=new Date().toISOString(); save(); view="active"; render(); toast("Incident closed")})}
  // start (or open) a planned document, carrying the incident's details into it
  const pb=e.target.closest("[data-plan]");
  if(pb){
    const inc=incidentOf(curInc); if(!inc)return;
    const st=planState(inc,pb.dataset.plan); if(!st)return;
    if(st.docs.length){
      const d=st.docs[0];
      prevView="incident";
      if(d.kind==="fill"){curFill=d.id;view="fill"} else {curSketch=d.id;selObj=null;view="sketch"}
      return render();
    }
    if(st.d.form){
      const f=S.forms.find(x=>x.name===st.d.form);
      if(!f)return toast("That form is missing \u2014 add it in Scene");
      const r=newFill(f); r.incidentId=inc.id;
      const put=(re,val)=>{const fd=(f.fields||[]).find(x=>re.test(x.label)); if(fd&&val)r.values[fd.id]=val};
      put(/case/i, inc.caseNo); put(/offence|incident type/i, inc.offence); put(/address|scene/i, inc.addr);
      put(/^date( of incident)?$/i,(inc.opened||"").slice(0,10)); put(/^time of incident$/i,(inc.opened||"").slice(11,16));
      put(/reporting officer|prepared by|completed by|maintained by|photographer/i,S.whoName||S.who||"");
      put(/^date of report$/i,today());
      put(/photographs taken/i,String((S.sketches||[]).filter(s=>s.incidentId===inc.id).reduce((a,s)=>a+(s.objs||[]).filter(o=>o.t==="photopoint").length,0)||""));
      save(); prevView="incident"; curFill=r.id; view="fill"; return render();
    }
    const sk=newSketch();
    Object.assign(sk,{incidentId:inc.id,caseNo:inc.caseNo,offence:inc.offence,addr:inc.addr});
    save(); prevView="incident"; curSketch=sk.id; selObj=null; view="sketch"; return render();
  }
  const gob=e.target.closest('[data-go="incident"]');
  if(gob){
    const r=(S.fills||[]).find(x=>x.id===curFill), sk2=S.sketches.find(x=>x.id===curSketch);
    const inc=(view==="fill"&&r&&r.incidentId)||(view==="sketch"&&sk2&&sk2.incidentId);
    if(inc)curInc=inc;
    view="incident"; window.scrollTo&&window.scrollTo(0,0); return render();
  }
  const fdn=e.target.closest("[data-fdone]");
  if(fdn){
    const r=(S.fills||[]).find(x=>x.id===fdn.dataset.fdone); if(!r)return;
    if(r.completed){ delete r.completed; save(); renderFill(); return toast("Reopened") }
    r.completed=new Date().toISOString(); save();
    curInc=r.incidentId; view="incident"; window.scrollTo&&window.scrollTo(0,0);
    render(); return toast("Marked complete");
  }
  const dtb=e.target.closest("[data-doc]");
  if(dtb){const [k,id]=dtb.dataset.doc.split(":");
    if(k==="fill"){curFill=id;view="fill"} else {curSketch=id;selObj=null;view="sketch"}
    window.scrollTo&&window.scrollTo(0,0); return render()}
  if(e.target.closest("#newsketch")){const sk=newSketch();curSketch=sk.id;view="sketch";
    $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-sketch"));
    render();return sketchMetaSheet(sk)}
  const sko=e.target.closest("[data-sk]");
  if(sko){curSketch=sko.dataset.sk;view="sketch";
    $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-sketch"));
    window.scrollTo&&window.scrollTo(0,0);return render()}
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
  if(e.target.closest("#addform"))return formSheet(null);
  if(e.target.closest("#fmfill")){
    const f=curForm; if(!f)return;
    if(!(f.fields||[]).length){$("#formedit").style.display="block";
      const b=$("#fmedit");if(b)b.style.display="none";
      const s=$("#fmsave");if(s)s.style.display="block";
      return toast("Add fields, then save")}
    const r=newFill(f);closeSheet();prevView="forms";curFill=r.id;view="fill";
    $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-fill"));
    window.scrollTo&&window.scrollTo(0,0);return render()}
  const fl=e.target.closest("[data-fill]");
  if(fl){prevView="forms";curFill=fl.dataset.fill;view="fill";
    $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-fill"));
    window.scrollTo&&window.scrollTo(0,0);return render()}
  const fa=e.target.closest("[data-fadd]");
  if(fa){const r=S.fills.find(x=>x.id===curFill);if(!r)return;
    const k=fa.dataset.fadd;if(!Array.isArray(r.values[k]))r.values[k]=[];
    r.values[k].push({});saveLocal();return renderFill()}
  const fr=e.target.closest("[data-frem]");
  if(fr){const r=S.fills.find(x=>x.id===curFill);if(!r)return;
    r.values[fr.dataset.frem].splice(+fr.dataset.tr,1);saveLocal();return renderFill()}
  const fc=e.target.closest("[data-fchk]");
  if(fc){const r=S.fills.find(x=>x.id===curFill);if(!r)return;
    r.values[fc.dataset.fchk]=!r.values[fc.dataset.fchk];saveLocal();return renderFill()}
  const ex=e.target.closest("[data-export]");
  if(ex){const r=S.fills.find(x=>x.id===ex.dataset.export);
    if(r){toast("Building PDF");exportFill(r)}return}
  const dc=e.target.closest("[data-discard]");
  if(dc){const r=S.fills.find(x=>x.id===dc.dataset.discard);if(!r)return;
    return askConfirm("Delete this form","Nothing is exported and nothing is kept. This can't be undone.","Delete",true,()=>{
      const back=r.incidentId&&incidentOf(r.incidentId);
      S.fills=S.fills.filter(x=>x.id!==r.id);saveLocal();
      if(back){curInc=r.incidentId;view="incident"}
      else{view="active"}
      $$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-"+view));
      render();toast("Form deleted")})}
  const fm=e.target.closest("[data-form]");
  if(fm){const f=S.forms.find(x=>x.id===fm.dataset.form); if(f)formSheet(f); return}
  if(e.target.closest("#bulkopen"))return bulkSheet();
  if(e.target.closest("#addreq")){gapSheet(null);
    const s=$("#gt"); if(s)s.value="request"; return}
  if(e.target.closest("#addgap"))return gapSheet(null);
  const ig=e.target.closest("[data-invg]");
  if(ig){invGroup=ig.dataset.invg;invAll=false;return renderInventory()}
  if(e.target.closest("#invall")){invAll=true;return renderInventory()}
  if(e.target.closest("#modebtn")){
    const cur=S.mode||"auto", th=S.theme||"auto";
    openSheet(`<h3>Display</h3>
      <div class="sect" style="margin:0 2px 8px">Appearance</div>
      ${[["auto","Match the device","Follows your iPad or phone setting"],
         ["light","Always light","Best in daylight and for reading a scene"],
         ["dark","Always dark","Easier at night and in a dim van"]]
        .map(([k,t,dd])=>`<button class="modeopt${th===k?" on":""}" data-theme="${k}">
          <span class="mt">${t}</span><span class="md">${dd}</span>
          ${th===k?`<span class="mk">&#10003;</span>`:""}</button>`).join("")}
      <div class="sect" style="margin:18px 2px 8px">Layout</div>
      <p style="margin:0 0 12px;color:var(--ink2);font-size:14px;line-height:1.5">
        Desktop layout puts navigation down the side and opens things beside the list.</p>
      ${[["auto","Match the screen","Phone layout on a phone, desktop on a big screen"],
         ["phone","Handheld","Bottom tabs and one screen at a time"],
         ["desktop","Desktop","Side navigation and split panes"]]
        .map(([k,t,dd])=>`<button class="modeopt${cur===k?" on":""}" data-mode="${k}">
          <span class="mt">${t}</span><span class="md">${dd}</span>
          ${cur===k?`<span class="mk">&#10003;</span>`:""}</button>`).join("")}
      <div class="sect" style="margin:18px 2px 8px">Orientation</div>
      ${[["1","Landscape only","On an iPad the app asks to be turned sideways; phones are not affected"],
         ["0","Any orientation","Works whichever way the device is held"]]
        .map(([k,t,dd])=>`<button class="modeopt${(landscapeOnly()?"1":"0")===k?" on":""}" data-rotlock="${k}">
          <span class="mt">${t}</span><span class="md">${dd}</span>
          ${(landscapeOnly()?"1":"0")===k?`<span class="mk">&#10003;</span>`:""}</button>`).join("")}
      <button class="btn sec" id="modex" style="max-width:none;margin-top:14px">Close</button>`);
    $("#modex").onclick=closeSheet;
    return}
  const th=e.target.closest("[data-theme]");
  if(th){S.theme=th.dataset.theme;save();applyTheme();closeSheet();
    return toast(S.theme==="auto"?"Matching the device":S.theme==="dark"?"Dark":"Light")}
  const mo=e.target.closest("[data-mode]");
  if(mo){S.mode=mo.dataset.mode;save();applyMode();closeSheet();fitHeader();render();
    return toast(S.mode==="auto"?"Matching the screen":S.mode==="phone"?"Handheld layout":"Desktop layout")}
  if(e.target.closest("#gear")){openSettings(null);return}
  if(e.target.closest("#dlj")){ backupOut(); return }
  if(e.target.closest("#dlc")){
    return toast(download(toCSV(),"van-inventory-"+today()+".csv","text/csv")
      ?"CSV downloaded":"Download blocked — use Copy CSV")}
  if(e.target.closest("#cpc")){
    navigator.clipboard&&navigator.clipboard.writeText(toCSV())
      .then(()=>{S.lastBackup=today();save();renderData();toast("Copied")})
      .catch(()=>toast("Copy blocked by the browser"));return}
  // connecting no longer asks anyone to choose which copy survives: it merges. The old
  // question was the most dangerous screen in the app.
  if(e.target.closest("#ghconnect")){
    S.ghOwner=$("#gho").value.trim(); S.ghRepo=$("#ghr").value.trim();
    S.gh={owner:S.ghOwner,repo:S.ghRepo,path:S.gh.path||"data.json",
      token:$("#ght").value.trim(),sha:"",last:S.gh.last||""};
    if(!ghOn()){S.gh.token="";return toast("Owner, repository and token are all needed")}
    tokenBad=false; badFile=false; syncErr=""; conflict=false; retries=0;
    store.set(S); toast("Connecting…");
    (async()=>{
      const r=await ghPull(true);
      if(r==="error"){renderData();return toast(syncErr||"Couldn't reach GitHub")}
      await ghPush(false);
      renderData();
      if(!tokenBad&&!syncErr)toast("Connected — "+live().length+" items");
    })();
    return}
  if(e.target.closest("#ghpush")){toast("Syncing…");ghPush(false);return}
  if(e.target.closest("#ghforce"))
    return askConfirm("Replace the file in the repo",
      "The unreadable file is replaced by this device's copy. Anything another device saved into it and has not got locally is gone.",
      "Replace it",true,()=>{toast("Replacing…");ghPush(true)});
  const cfb=e.target.closest("[data-cback]");
  if(cfb){
    const i=+cfb.dataset.cback, x=(S.conflicts||[])[i]; if(!x)return;
    const arr=S[x.k]||[], at=arr.findIndex(r=>kKey(x.k,r)===x.key);
    const rec=Object.assign({},x.rec); delete rec._v; delete rec._d;   // it gets a fresh, higher stamp
    if(at>-1)arr[at]=rec; else arr.push(rec);
    if(S.tomb[x.k])delete S.tomb[x.k][x.key];
    S.conflicts.splice(i,1); save(); renderData(); render();
    return toast("Put back — it will win the next sync")}
  const cfd=e.target.closest("[data-cdrop]");
  if(cfd){S.conflicts.splice(+cfd.dataset.cdrop,1);saveLocal();renderData();return}
  if(e.target.closest("#ghoff"))
    return askConfirm("Disconnect sync","The token is removed from this device. Your data stays both in the repo and on this phone.","Disconnect",true,()=>{
      S.gh={owner:"",repo:"",path:"data.json",token:"",sha:"",last:""};store.set(S);
      renderData();toast("Disconnected")});
  if(e.target.closest("#impadd"))return ingest($("#imp").value,false);
  if(e.target.closest("#imprep")){const t=$("#imp").value;
    let parsed=null;
    try{ parsed=JSON.parse(t) }catch(err){ return toast("That doesn't look like a backup file") }
    if(!parsed||!parsed.items)return toast("No items in that file");
    const n=(parsed.comps||[]).length, m=(parsed.items||[]).length;
    return askConfirm("Replace everything",
      "Everything currently in the app is discarded and replaced by the "+m+" item"+(m===1?"":"s")+
      " and "+n+" compartment"+(n===1?"":"s")+" in that file.","Replace",true,()=>ingest(t,true))}
  if(e.target.closest("#cleardemo2"))
    return askConfirm("Clear sample data","The sample compartments and their items are removed. Anything you added yourself stays.","Clear sample",false,()=>{
      clearDemo();renderData();toast("Sample cleared")});
  if(e.target.closest("#wipe"))
    return askConfirm("Erase everything","Every item and compartment is deleted. Download a backup first if you might want any of it.","Erase everything",true,()=>{
      S.items=[];S.comps=[];S.forms=[];S.curLoc="";S.demo=false;save();go("home");toast("Erased")});
  if(e.target.closest("#loaddemo")){loadDemo();return go("home")}
  if(e.target.closest("#cleardemo"))
    return askConfirm("Clear sample data","The 20 sample compartments and their items are removed. Anything you added yourself stays.","Clear sample",false,()=>{
      clearDemo();go("home");toast("Sample cleared")});
  const di=e.target.closest("[data-item]");
  if(di){const it=S.items.find(x=>x.id===di.dataset.item);
    if(it&&it.status==="Not carried"&&!isRequest(it))return gapSheet(it);
    return openItem(di.dataset.item)}
  if(e.target.closest("[data-loc]")){
    S.curLoc=e.target.closest("[data-loc]").dataset.loc; S.pick=false; justAdded=[];
    S.lastCat="";                       // a new bin is usually a new kind of thing
    save();
    renderSweep(); const f=$("#q-name")||$("#f-name"); f&&f.focus(); return}
  if(e.target.closest("#ghsetexp")){
    openSheet(`<h3>Token expiry</h3>
      <p style="margin:0 0 14px;color:var(--ink2);font-size:14.5px;line-height:1.5">The date the
        GitHub token stops working. It is on the token's page under Expiration.</p>
      <label class="fld"><span>Expires on</span>
        <input type="date" id="ghxd" value="${esc(S.ghExp||"")}"></label>
      <button class="btn" id="ghxs" style="max-width:none;margin:0">Save</button>
      <button class="btn sec" id="ghxc" style="max-width:none">Cancel</button>`);
    $("#ghxc").onclick=closeSheet;
    $("#ghxs").onclick=()=>{S.ghExp=$("#ghxd").value||"";save();closeSheet();renderData()};
    return}
  if(e.target.closest("#resweep")){
    const n=S.comps.filter(c=>c.checked).length;
    return askConfirm("Start a new sweep",
      "This clears the swept mark on all "+n+" compartments so you can work through them again. "+
      "Nothing you have logged is deleted.","Clear the marks",false,()=>{
        S.comps.forEach(c=>{delete c.checked});save();render();toast("New sweep started")})}
  if(e.target.closest("#add")){
    const nm=$("#f-name").value.trim(); if(!nm)return toast("Item needs a name");
    const dupHere=live().find(i=>i.loc===S.curLoc&&i.name.toLowerCase()===nm.toLowerCase());
    const dupElse=live().find(i=>i.loc!==S.curLoc&&i.name.toLowerCase()===nm.toLowerCase());
    if(dupHere&&!dupOK){
      return askConfirm("Already in "+S.curLoc,
        "\u201c"+dupHere.name+"\u201d is already logged here with "+dupHere.qty+
        " in stock. Adding it again makes a second entry rather than increasing the count.",
        "Add it anyway",false,()=>{dupOK=true;$("#add").click();dupOK=false})}
    if(dupElse&&!dupOK){
      return askConfirm("Already in "+(dupElse.loc||"the van"),
        "\u201c"+dupElse.name+"\u201d is logged in "+(dupElse.loc||"another compartment")+
        ". If the van keeps it in both places that's fine, otherwise you may want to move it instead.",
        "Add it here too",false,()=>{dupOK=true;$("#add").click();dupOK=false})}
    S.lastCat=$("#f-cat").value;S.lastCls=$("#f-cls").value;   // carries within a compartment only
    S.items.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:nm,loc:S.curLoc,
      cat:S.lastCat,cls:S.lastCls,qty:n($("#f-qty").value),par:$("#f-par").value.trim(),
      date:$("#f-date").value||"",status:"Stocked",gapType:"",note:"",steps:[],source:"",
      verified:"",uses:[],rel:[],links:[],fav:false});
    save();renderSweep();toast("Added to "+S.curLoc);const f=$("#f-name");f&&f.focus()}

  const pk=e.target.closest("[data-pick]");
  if(pk){S.pick=pk.dataset.pick==="1";save();renderSweep();
    if(!S.pick){const f=$("#q-name")||$("#f-name");f&&f.focus()} return}
  const qa=e.target.closest("[data-qa]");
  if(qa){S.quick=qa.dataset.qa==="1";save();renderSweep();
    const f=$("#q-name")||$("#f-name"); f&&f.focus(); return}
  if(e.target.closest("#qadd"))return quickAdd();
  const ju=e.target.closest("[data-undo]");
  if(ju){S.items=S.items.filter(i=>i.id!==ju.dataset.undo);
    save();paintJust();refreshSweepList();toast("Removed");return}
});

// quick add: name, count and category, so nothing has to be fixed up afterwards
let justAdded=[];
function quickAdd(){
  const f=$("#q-name"); if(!f)return;
  let nm=f.value.trim(); if(!nm)return toast("Item needs a name");
  const qf=$("#q-qty"), cf=$("#q-cat");
  let qty=Math.max(1,parseInt((qf&&qf.value)||"1",10)||1);
  // "x6" on the end still works, and wins over the field
  const m=nm.match(/\s+[x\u00d7*]\s?(\d{1,4})$/i);
  if(m){qty=parseInt(m[1],10)||1; nm=nm.slice(0,m.index).trim()}
  if(!nm)return toast("Item needs a name");
  const cat=(cf&&cf.value)||S.lastCat||CATS[0][0];
  S.lastCat=cat;
  const it={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:nm,loc:S.curLoc,
    cat,cls:S.lastCls||CLASSES[0],qty,par:"1",date:"",
    status:"Stocked",gapType:"",note:"",steps:[],source:"",verified:"",
    uses:[],rel:[],links:[],fav:false};
  const elsewhereIn=live().find(i=>i.id!==it.id&&i.name.toLowerCase()===nm.toLowerCase());
  it.dupOf=elsewhereIn?(elsewhereIn.loc||"the van"):"";
  S.items.push(it); save();
  justAdded.unshift(it.id); justAdded=justAdded.slice(0,6);
  f.value=""; f.focus();          // the count and category stay put for the next one
  paintJust(); refreshSweepList();
}
function paintJust(){
  const box=$("#qjust"); if(!box)return;
  const rows=justAdded.map(id=>S.items.find(i=>i.id===id)).filter(Boolean);
  box.innerHTML=rows.length?`<p class="hint" style="margin:14px 0 6px">Just added</p>`
    +rows.map(i=>`<div class="justrow${i.dupOf?" dup":""}">
      <span class="jn">${esc(i.name)}${i.dupOf?`<span class="jdup">also in ${esc(i.dupOf)}</span>`:""}</span>
      <span class="jq">${esc(i.qty)}</span>
      <button class="jx" data-item="${i.id}">Details</button>
      <button class="jx" data-undo="${i.id}">Undo</button></div>`).join(""):"";
}
function refreshSweepList(){
  const here=live().filter(i=>i.loc===S.curLoc);
  const host=$("#sweeplist"); if(!host)return;
  host.innerHTML=here.length?`<div class="sect">In ${esc(S.curLoc)} — ${here.length}</div><div class="rows">`
    +here.slice().reverse().map(i=>`<button class="row" data-item="${i.id}">
      <span><span class="code">${esc(i.name)}</span><span class="desc">${esc(i.qty)} in stock${i.par?" · par "+esc(i.par):""}</span></span>
      <span class="rt"><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`:"";
}

function placeholder(el,t,b){$(el).innerHTML=`<div class="empty"><strong>${t}</strong><p>${b}</p></div>`}
function fitHeader(){
  const hd=document.querySelector(".hdr"); if(!hd)return;
  if(document.body.classList.contains("wide")){document.body.style.paddingTop="";return}
  document.body.style.paddingTop=hd.offsetHeight+"px";
}
window.addEventListener("resize",()=>{applyMode();fitHeader();render();fitCanvas()});
window.addEventListener("orientationchange",()=>setTimeout(()=>{render();fitCanvas()},250));
document.addEventListener("keydown",e=>{
  if(view==="sketch"&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){
    e.preventDefault(); return e.shiftKey?doRedo():doUndo() }
  if(view==="sketch"&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="y"){
    e.preventDefault(); return doRedo() }
  // Enter moves name -> quantity, and adds from the quantity field
  if(e.key==="Enter"&&e.target&&e.target.id==="q-name"){e.preventDefault();
    const q=$("#q-qty"); if(q){q.focus();q.select();return} return quickAdd()}
  if(e.key==="Enter"&&e.target&&e.target.id==="q-qty"){e.preventDefault();return quickAdd()}
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName||"");
  if(e.key==="Escape"){
    if($("#sheet")&&$("#sheet").classList.contains("on"))return closeSheet();
    if(skFull)return setFull(false);
    if(polyDraw&&view==="sketch"){polyDraw=null;return renderSketch()}
    if(query){$("#q").value="";query="";applyQuery();return}
    if(selObj&&view==="sketch"){selObj=null;return renderSketch()}
    return}
  if(typing)return;
  if(e.key==="Enter"&&$("#sheet")&&$("#sheet").classList.contains("on")){
    const b=$("#sheet").querySelector(".btn:not(.sec)"); if(b){e.preventDefault();b.click()} return}
  if(view!=="sketch"||!selObj)return;
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
window.addEventListener("online",()=>{if(ghOn()&&(dirty||syncErr)){syncErr="";renderSyncBar();ghPush(false)}});
window.addEventListener("offline",()=>renderSyncBar());
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible"||!ghOn())return;
  if(dirty||syncErr){retries=0;ghPush(false)} else ghPull(true);
});
window.addEventListener("orientationchange",()=>setTimeout(fitHeader,200));

const DETAILS=[];   // every page is the main screen; the split pane is retired
const wideNow=()=>document.body.classList.contains("xwide");
// the side bar is an icon rail when asked, and always while sketching on a screen under 1241px
function applySideMin(){
  const auto=view==="sketch"&&document.body.classList.contains("xwide")&&window.innerWidth<1241;
  document.body.classList.toggle("sidemin",!!S.sideMin||auto);
}
function renderView(v){
  if(v==="search")return renderSearch();
  if(v==="itemdetail")return renderItemDetail();
  if(v==="active")return renderActive();
  if(v==="incident")return renderIncident();
  if(v==="reorder")return renderReorder();
  if(v==="tidy")return renderTidy();
  if(v==="templates")return renderTemplates();
  if(v==="bay")return renderBay();
  if(v==="compdetail")return renderCompDetail();
  if(v==="data"){renderData();return fitHeader()}
  if(v==="print")return renderPrint();
  if(v==="labels")return renderLabels();
  if(v==="home")return renderHome();
  if(v==="compartments")return renderComps();
  if(v==="sweep")return renderSweep();
  $("#title").textContent=(TABS.find(t=>t[0]===v)||[,""])[1];
  if(v==="sketch"){renderSketch();centreDocTab();return}
  if(v==="fill"){renderFill();centreDocTab();return}
  if(v==="forms")return renderForms();
  if(v==="inventory")return renderInventory();
  if(v==="guide")return renderGuide();
}
// where you have been, so Back goes back one step instead of to the start
const NAV=[];
const navSnap=()=>({view,curItem,curComp,curBay,curFill,curSketch,curInc,curLayer,
  prevView,invGroup,sceneSub:null});
const navSame=(a,b)=>a&&b&&a.view===b.view&&a.curItem===b.curItem&&a.curComp===b.curComp
  &&a.curBay===b.curBay&&a.curFill===b.curFill&&a.curSketch===b.curSketch&&a.curInc===b.curInc;
let navLast=null, navGoingBack=false;
function navRecord(){
  const now=navSnap();
  if(navGoingBack){navGoingBack=false;navLast=now;return}
  if(navLast&&!navSame(navLast,now)){
    NAV.push(navLast);
    if(NAV.length>40)NAV.shift();
  }
  navLast=now;
}
function navBack(fallback){
  const prev=NAV.pop();
  if(!prev){ if(fallback)go(fallback); return }
  navGoingBack=true;
  view=prev.view; curItem=prev.curItem; curComp=prev.curComp; curBay=prev.curBay;
  curFill=prev.curFill; curSketch=prev.curSketch; curInc=prev.curInc;
  curLayer=prev.curLayer; prevView=prev.prevView;
  $$(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+view));
  render(); restoreScroll(view);
}
function render(){
  navRecord();
  applySideMin();
  buildTabs();renderDemoBar();renderSyncBar();
  const main=document.querySelector(".main");
  const master=DETAILS.includes(view)&&prevView&&prevView!==view
    &&!["itemdetail","fill"].includes(prevView)?prevView:null;
  const split=wideNow()&&!!master;
  $$(".view").forEach(s=>{s.classList.remove("pane-master","pane-detail");
    s.classList.toggle("on",s.id==="v-"+view||(split&&s.id==="v-"+master))});
  if(main)main.classList.toggle("split",split);
  if(split){
    $("#v-"+master).classList.add("pane-master");
    $("#v-"+view).classList.add("pane-detail");
    renderView(master);
  }
  renderView(view);
}

