/* ---------- events ---------- */
document.addEventListener("click",e=>{
  if(appExtraClick10(e)||appExtraClick9(e)||appExtraClick7(e)||appExtraClick(e))return;
  const nb=e.target.closest("[data-navback]");
  if(nb){e.stopPropagation();return navBack(nb.dataset.navback)}
  const g=e.target.closest("[data-go]"); if(g)return go(g.dataset.go);
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
  if(e.target.closest("#syncnow")){
    if(conflict||tokenBad||badFile){openSettings("sync");return}
    syncErr="";retries=0;renderSyncBar();toast("Retrying");ghPush(false);return}
  if(e.target.closest("[data-newinc]")){
    const inc=newIncident(); curInc=inc.id; view="incident"; render(); incidentSheet(inc); return}
  const ib=e.target.closest("[data-inc]");
  if(ib){curInc=ib.dataset.inc; view="incident"; render(); return}
  if(e.target.closest("[data-incbundle]")){
    const inc=incidentOf(curInc); if(!inc)return;
    toast("Building the bundle"+String.fromCharCode(8230)); bundleIncident(inc); return}
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
          if(s.incidentId===inc.id){(s.objs||[]).forEach(o=>{
            if(o.photoId)photoDel(o.photoId).catch(()=>{})});
            try{localStorage.removeItem("fsu-undo-"+s.id)}catch(_){} } });   // its undo history is case material too
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
    return startSketch(inc.id);
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
  if(e.target.closest("#newsketch"))return startSketch(curInc||"");
  const sko=e.target.closest("[data-sk]");
  if(sko){curSketch=sko.dataset.sk;selObj=null;view="sketch";window.scrollTo&&window.scrollTo(0,0);return render()}
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
  if(e.target.closest("#storefree")){ removeCasesSheet(); return }
  if(e.target.closest("#photocheck")){ photoCheckSheet(); return }
  const bdl=e.target.closest("[data-baddl]"); if(bdl){ const k=bdl.dataset.baddl; dlBlob(new Blob([localStorage.getItem(k)||""],{type:"application/json"}),k+".json"); return }
  const bdd=e.target.closest("[data-baddel]"); if(bdd){ const k=bdd.dataset.baddel;
    return askConfirm("Delete the damaged record","The damaged copy "+k+" is deleted from this device. Download it first if anyone may want to recover it.","Delete",true,()=>{
      try{localStorage.removeItem(k)}catch(_){} renderData(); toast("Deleted")}) }
  if(e.target.closest("#heldsend")){ KINDS.forEach(k=>S.held[k]={}); save(); renderData(); return toast("They go up with the next sync") }
  if(e.target.closest("#helddrop"))
    return askConfirm("Remove from this device","The records held back are deleted from this device. They were never sent, so no other device is affected.","Remove",true,()=>{
      KINDS.forEach(k=>{ S[k]=S[k].filter(r=>!isHeld(k,r)); S.held[k]={} }); save(); renderData(); toast("Removed")});
  const gs=e.target.closest(".storewarn[data-gosec]"); if(gs){ openSettings(gs.dataset.gosec); return }
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
    if(ghOn()){const miss=missingFrom(parsed);
      return askConfirm("Restore what is missing",
        "Sync is on, so nothing on this device or any other is replaced or deleted. "+missingText(miss)+
        " in that file are not on this device and will be added. Everything else in the file is already here and is left as it is.",
        "Add them",false,()=>ingest(t,true))}
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
  const rows=justAdded.map(id=>S.items.find(i=>i.id===id)).filter(Boolean).filter(i=>i.loc===S.curLoc);
  box.innerHTML=rows.length?`<p class="hint" style="margin:14px 0 6px">Just added</p>`
    +rows.map(i=>`<div class="justrow${i.dupOf?" dup":""}">
      <span class="jn">${esc(i.name)}${i.dupOf?`<span class="jdup">also in ${esc(i.dupOf)}</span>`:""}</span>
      <span class="jq">${esc(i.qty)}</span>
      <button class="jx" data-item="${esc(i.id)}">Details</button>
      <button class="jx" data-undo="${esc(i.id)}">Undo</button></div>`).join(""):"";
}
function refreshSweepList(){
  const here=live().filter(i=>i.loc===S.curLoc);
  const host=$("#sweeplist"); if(!host)return;
  host.innerHTML=here.length?`<div class="sect">In ${esc(S.curLoc)} — ${here.length}</div><div class="rows">`
    +here.slice().reverse().map(i=>`<button class="row" data-item="${esc(i.id)}">
      <span><span class="code">${esc(i.name)}</span><span class="desc">${esc(i.qty)} in stock${i.par?" · par "+esc(i.par):""}</span></span>
      <span class="rt"><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`:"";
}

function placeholder(el,t,b){$(el).innerHTML=`<div class="empty"><strong>${t}</strong><p>${b}</p></div>`}
function fitHeader(){
  const hd=document.querySelector(".hdr"); if(!hd)return;
  if(document.body.classList.contains("wide")){document.body.style.paddingTop="";return}
  document.body.style.paddingTop=hd.offsetHeight+"px";
}
window.addEventListener("resize",()=>{applyMode();fitHeader();render()});
window.addEventListener("orientationchange",()=>setTimeout(()=>{render()},250));
document.addEventListener("keydown",e=>{
  // Enter moves name -> quantity, and adds from the quantity field
  if(e.key==="Enter"&&e.target&&e.target.id==="q-name"){e.preventDefault();
    const q=$("#q-qty"); if(q){q.focus();q.select();return} return quickAdd()}
  if(e.key==="Enter"&&e.target&&e.target.id==="q-qty"){e.preventDefault();return quickAdd()}
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName||"");
  if(e.key==="Escape"){
    if($("#sheet")&&$("#sheet").classList.contains("on"))return closeSheet();
    if(query){const qel=$("#q"); if(qel)qel.value=""; query="";applyQuery();return}
    return}
  if(typing)return;
  if(e.key==="Enter"&&$("#sheet")&&$("#sheet").classList.contains("on")){
    const b=$("#sheet").querySelector(".btn:not(.sec)"); if(b){e.preventDefault();b.click()} return}

});
window.addEventListener("online",()=>{renderStatus();if(ghOn()&&(dirty||syncErr)){syncErr="";renderSyncBar();ghPush(false)}});
window.addEventListener("offline",()=>{renderSyncBar();renderStatus()});
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
  // a view that belongs to the other page has nothing to draw into here
  if(!document.getElementById("v-"+v))return;
  if(v==="search")return renderSearch();
  if(v==="itemdetail")return renderItemDetail();
  if(v==="active")return renderActive();
  if(v==="incident")return renderIncident();
  if(v==="reorder")return renderReorder();
  if(v==="tidy")return renderTidy();
  if(v==="templates")return renderTemplates();
  if(v==="map"&&typeof renderMap==="function")return renderMap();
  if(v==="bay")return renderBay();
  if(v==="compdetail")return renderCompDetail();
  if(v==="data"){renderData();return fitHeader()}
  if(v==="print")return renderPrint();
  if(v==="labels")return renderLabels();
  if(v==="home")return renderHome();
  if(v==="compartments")return renderComps();
  if(v==="sweep")return renderSweep();
  $("#title").textContent=(TABS.find(t=>t[0]===v)||[,""])[1];
  if(v==="sketch"&&typeof renderSketch==="function"){renderSketch();centreDocTab();return}
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
function render(depth){
  depth=depth||0;
  const asked=view;
  navRecord();
  applySideMin();
  buildTabs();renderDemoBar();renderSyncBar();renderStatus();
  {const nb=document.getElementById("newinc"); if(nb)nb.style.display=view==="active"?"":"none"}
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
  keepAddress();
  // a renderer whose record is gone sets view to a fallback and draws that instead. The .on
  // class was already put on the old section, so without this the page shows an empty one.
  if(view!==asked&&depth<4)return render(depth+1);
}

