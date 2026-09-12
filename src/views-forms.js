/* ---------- forms ---------- */
function formStale(f){ if(!f.verified)return false;
  const t=dayStart(f.verified); return !isNaN(t)&&(startOfToday()-t)/86400000>365 }
function renderForms(){
  $("#title").textContent="Scenes";
  const past=closedIncidents();
  if(!past.length){
    $("#v-forms").innerHTML=`<div class="empty"><strong>No finished scenes yet</strong>
      <p>Close an incident when you have finished with it and it moves here, with everything
         that belongs to it.</p>
      <button class="btn" data-scenestab="open">See open scenes</button></div>`;
    return;
  }
  const year=x=>String(x.closed||"").slice(0,4)||"Undated";
  const g={}; past.forEach(i=>{(g[year(i)]=g[year(i)]||[]).push(i)});
  $("#v-forms").innerHTML=
    `<p class="hint" style="margin:0 0 14px">${past.length} finished scene${past.length===1?"":"s"}.
      Open one to read its documents, export the bundle again, or reopen it.</p>`
    +Object.keys(g).sort().reverse().map(y=>
      `<div class="sect">${esc(y)}</div><div class="rows">`+g[y].map(inc=>{
        const docs=docsFor(inc.id);
        const sk=docs.filter(d=>d.kind==="sketch").length;
        return `<button class="row" data-inc="${inc.id}">
          <span><span class="code">${esc(inc.caseNo||"No case number")}</span>
          <span class="desc">${esc(inc.offence||"No offence recorded")}${
            inc.addr?" \u00b7 "+esc(inc.addr):""}<br>${docs.length} document${docs.length===1?"":"s"}${
            sk?" \u00b7 "+sk+" sketch"+(sk===1?"":"es"):""} \u00b7 closed ${esc(String(inc.closed).slice(0,10))}</span></span>
          <span class="rt"><span class="chev">&#8250;</span></span></button>`}).join("")+`</div>`).join("");
}
// blank form templates are configuration, so they live in settings
function renderTemplates(){
  $("#title").textContent="Form templates";
  const fs=S.forms.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const stale=fs.filter(formStale).length, unver=fs.filter(f=>!f.verified).length;
  const g={}; fs.forEach(f=>{const k=f.cat||"Admin";(g[k]=g[k]||[]).push(f)});
  const badge=f=>formStale(f)?`<span class="badge b-action">Re-check</span>`
    :!f.verified?`<span class="badge b-attn">Unverified</span>`
    :`<span class="badge b-good">${esc(f.verified.slice(0,7))}</span>`;
  $("#v-templates").innerHTML=`<button class="back" data-navback="home">&#8249; Home</button>
    <div class="editbar"><button id="addform">Add a form</button></div>
    ${(stale||unver)?`<div class="unver">${stale?stale+(stale===1?" form hasn't":" forms haven't")+" been checked in over a year. ":""}${unver?unver+(unver===1?" has":" have")+" no checked date. ":""}Forms get revised — confirm you're carrying the current one.</div>`:""}
    `+FORMCATS.filter(k=>g[k]).concat(Object.keys(g).filter(k=>!FORMCATS.includes(k))).map(k=>
      `<div class="sect">${esc(k)}</div><div class="rows">`+g[k].map(f=>
        `<button class="row" data-form="${f.id}">
          <span><span class="code">${esc(f.name)}${f.stock?"":" \u00b7 yours"}</span>
          <span class="desc">${esc(f.desc||"No description")}${f.rev?" \u00b7 Rev "+esc(f.rev):""}</span></span>
          <span class="rt">${badge(f)}<span class="chev">&#8250;</span></span></button>`).join("")+`</div>`).join("");
}
function formSheet(f){
  const isNew=!f; curForm=f;
  openSheet(`<h3>${isNew?"Add a form":esc(f.name)}</h3>
    ${isNew?"":`<div class="kv" style="margin-bottom:12px">
      ${f.rev?`<div><dt>Revision</dt><dd>${esc(f.rev)}</dd></div>`:""}
      <div><dt>Last checked</dt><dd>${esc(f.verified||"never")}</dd></div>
      ${f.desc?`<div style="display:block"><dt style="margin-bottom:3px">When to use it</dt><dd style="text-align:left">${esc(f.desc)}</dd></div>`:""}
    </div>
    ${(f.links||[]).length?`<div class="links" style="margin-bottom:12px">`+(f.links||[]).map(l=>
      `<a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener">
        <span class="ln">${esc(l.label)}</span>
        <span class="lu">${esc(l.url.replace(/^https?:\/\//,"").split("/")[0])}</span></a>`).join("")+`</div>`
      :`<p class="hint" style="margin:0 0 12px">No link to the blank form yet.</p>`}`}
    ${isNew?"":`<button class="btn" id="fmfill" style="max-width:none;margin:0 0 9px">${(f.fields||[]).length?"Fill this in":"Add fields to fill it in"}</button>`}
    <div id="formedit" style="display:${isNew?"block":"none"}">
      <label class="fld"><span>Form name</span><input type="text" id="fmn" value="${isNew?"":esc(f.name)}" placeholder="Evidence submission form"></label>
      <div class="two"><label class="fld"><span>Category</span><select id="fmc">${FORMCATS.map(c=>
        `<option${!isNew&&c===f.cat?" selected":""}>${c}</option>`).join("")}</select></label>
      <label class="fld"><span>Revision</span><input type="text" id="fmr" value="${isNew?"":esc(f.rev||"")}" placeholder="2024-A"></label></div>
      <label class="fld"><span>When to use it</span><textarea id="fmd" rows="2" placeholder="Every item leaving the scene">${isNew?"":esc(f.desc||"")}</textarea></label>
      <label class="fld"><span>Link to the blank form, one per line</span>
        <textarea id="fml" rows="3" placeholder="Blank PDF | https://...">${isNew?"":esc((f.links||[]).map(l=>l.label===l.url?l.url:l.label+" | "+l.url).join("\n"))}</textarea></label>
      <label class="fld"><span>Date you checked it's current</span><input type="date" id="fmv" value="${isNew?"":esc(f.verified||"")}"></label>
      <label class="fld"><span>Fields, one per line</span>
        <textarea id="fmf" rows="6" placeholder="Case number">${isNew?"":esc(fieldsText(f))}</textarea></label>
      <pre class="fmt">Case number
Date of scene | date
Arrival time | time
Consent obtained | check
Narrative | textarea
Persons present | table | Name, Agency, In, Out</pre>
    </div>
    <button class="btn" id="fmsave" style="max-width:none;margin:0">${isNew?"Add form":"Save"}</button>
    ${isNew?"":`<button class="btn sec" id="fmedit" style="max-width:none">Edit details</button>
      ${f.stock
        ? `<p class="hint" style="margin:10px 0 0">This form came with the app and cannot be
             deleted. Edit it freely \u2014 your changes are kept.</p>`
        : `<button class="btn sec" id="fmdel" style="max-width:none;color:var(--red);border-color:var(--red)">Delete form</button>`}`}
    <button class="btn sec" id="fmx" style="max-width:none">Close</button>`);
  if(!isNew){$("#fmsave").style.display="none";
    $("#fmedit").onclick=()=>{$("#formedit").style.display="block";
      $("#fmedit").style.display="none";$("#fmsave").style.display="block"};
    const fd=$("#fmdel");
    if(fd)fd.onclick=()=>askConfirm("Delete form","Remove "+f.name+" from the list. Forms already filled in are unaffected.","Delete",true,()=>{
      if(f.stock)return toast("That form came with the app");
      S.forms=S.forms.filter(x=>x.id!==f.id);save();renderForms();toast("Deleted")})}
  $("#fmx").onclick=closeSheet;
  $("#fmsave").onclick=()=>{
    const nm=$("#fmn").value.trim(); if(!nm)return toast("Needs a name");
    const rec=f||{id:newId()};
    Object.assign(rec,{name:nm,cat:$("#fmc").value,rev:$("#fmr").value.trim(),
      desc:$("#fmd").value.trim(),links:parseLinks($("#fml").value),verified:$("#fmv").value,
      fields:parseFields($("#fmf").value),edited:true});
    if(isNew)S.forms.push(rec);
    save();closeSheet();renderForms();toast(isNew?"Form added":"Saved")};
}

let curFill=null, curInc=null;
// forms and sketches that have not been exported yet are "open"
// an incident is the record a scene's documents belong to
function openDocs(){
  const f=(S.fills||[]).filter(x=>!x.exported&&!x.incidentId).map(x=>({
    kind:"fill", id:x.id, when:x.started||"",
    caseNo:(fillCase(x)||"").trim(), type:x.formName||"Form"}));
  const s=(S.sketches||[]).filter(x=>!x.exported&&!x.incidentId&&(x.objs||[]).length).map(x=>({
    kind:"sketch", id:x.id, when:x.when||"",
    caseNo:(x.caseNo||"").trim(), type:"Sketch"}));
  return [...f,...s].sort((a,b)=>
    (a.caseNo||"~").localeCompare(b.caseNo||"~")||a.type.localeCompare(b.type));
}
function fillCase(r){
  const f=S.forms.find(x=>x.id===r.formId); if(!f)return "";
  const c=(f.fields||[]).find(x=>/case/i.test(x.label));
  return c?String(r.values[c.id]||"") : "";
}
function centreDocTab(){
  const on=document.querySelector(".view.on .doctab.on");
  if(!on)return;
  const strip=on.parentElement;
  strip.scrollLeft = Math.max(0, on.offsetLeft - (strip.clientWidth - on.offsetWidth)/2);
}
function docTabs(kind,id){
  const docs=openDocs();
  if(docs.length<2)return "";
  return `<div class="doctabs">${docs.map(d=>{
    const on=d.kind===kind&&d.id===id;
    return `<button class="doctab${on?" on":""}" data-doc="${d.kind}:${d.id}">
      <span class="dgw">${docIcon(docKind(d.kind,d.type))}</span>
      <span class="dtx"><span class="dc">${esc(d.caseNo||"No case number")}</span>
      <span class="dt">${esc(d.type)}</span></span></button>`}).join("")}</div>`;
}
function renderFill(){
  const r=S.fills.find(x=>x.id===curFill);
  if(!r){view="active";return renderActive()}
  const f=S.forms.find(x=>x.id===r.formId)||{fields:[]};
  $("#title").textContent=r.formName;
  const ctl=x=>{
    const v=r.values[x.id];
    if(x.type==="textarea")return `<textarea rows="3" data-fv="${x.id}">${esc(v||"")}</textarea><button type="button" class="lnkbtn snipbtn" data-snip="${x.id}">Insert wording</button>`;
    if(x.type==="check")return `<button class="chk${v?" on":""}" data-fchk="${x.id}"><i>${v?"&#10003;":""}</i>${esc(x.label)}</button>`;
    if(x.type==="table"){
      const rows=Array.isArray(v)?v:[{}];
      return `<div class="ftab">${rows.map((row,ri)=>`<div class="frow">
          <span class="fnum">${ri+1}</span>
          ${(x.cols||[]).map(c=>`<label class="fcell"><span>${esc(c)}</span><input type="text" placeholder="${esc(c)}" data-ftab="${x.id}" data-tr="${ri}" data-tc="${esc(c)}" value="${esc(row[c]||"")}"></label>`).join("")}
          ${rows.length>1?`<button class="frem" data-frem="${x.id}" data-tr="${ri}" aria-label="Remove row">&#215;</button>`:""}
        </div>`).join("")}
        <button class="btn sec" data-fadd="${x.id}" style="margin:8px 0 0;max-width:none">Add a row</button></div>`;
    }
    const t=x.type==="date"?"date":x.type==="time"?"time":"text";
    const im=x.type==="number"?' inputmode="numeric"':"";
    return `<input type="${t}"${im} data-fv="${x.id}" value="${esc(v||"")}">`;
  };
  $("#v-fill").innerHTML=`
    <button class="back" data-navback="${r.incidentId&&incidentOf(r.incidentId)?"incident":"active"}">&#8249; ${
      r.incidentId&&incidentOf(r.incidentId)?esc(incidentOf(r.incidentId).caseNo||"Incident"):"Forms"}</button>
    ${docTabs("fill",r.id)}
    <div class="cdhead"><h2>${esc(r.formName)}</h2>
      <div class="sub">${esc(r.rev?"Rev "+r.rev+" · ":"")}Started ${esc(r.started.slice(0,16).replace("T"," "))}</div></div>
    ${(f.fields||[]).length?(()=>{
      // short fields pack into a compact header; tables and long text get the full width
      const kind=x=>{
        const t=x.type||"text";
        if(t==="table")return "full";          // tables need the whole width
        if(t==="textarea")return "narrative";  // narratives pair up on a wide screen
        return "short";
      };
      const out=[]; let run=[], runKind=null;
      const flush=()=>{ if(!run.length)return;
        const cls=runKind==="narrative"?"fgrid narr":"fgrid";
        out.push(`<div class="${cls}">`+run.map(x=>x.type==="check"
          ? `<div class="fld">${ctl(x)}</div>`
          : `<label class="fld"><span>${esc(x.label)}</span>${ctl(x)}</label>`).join("")+`</div>`);
        run=[]; runKind=null };
      (f.fields||[]).forEach(x=>{
        const k=kind(x);
        if(k==="full"){ flush();
          out.push(`<label class="fld wide"><span>${esc(x.label)}</span>${ctl(x)}</label>`); return }
        if(runKind&&runKind!==k)flush();
        runKind=k; run.push(x);
      });
      flush();
      return out.join("")})()
      :`<div class="empty"><strong>This form has no fields yet</strong>
        <p>Open it from the Forms tab and add fields before filling it in.</p></div>`}
    ${r.incidentId&&incidentOf(r.incidentId)?`<div class="actbar" style="grid-template-columns:1fr">
      <button class="primary" data-fdone="${r.id}">${r.completed
        ? "Completed \u2014 reopen" : "Mark complete and go back"}</button></div>`:""}
    <div class="actbar" style="grid-template-columns:1fr 1fr 1fr">
      <button class="${r.incidentId?"":"primary"}" data-export="${r.id}">Export PDF</button>
      <button data-exportdocx="${r.id}">Export Word</button>
      <button data-discard="${r.id}" class="danger">Delete form</button>
    </div>
    <p class="hint">This stays in the app until you export it. It is not synced and not in any
      backup, so a lost phone loses it. Export the PDF to Drive or the case file, then clear it.</p>`;
}

