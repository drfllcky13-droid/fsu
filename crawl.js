// FSU click crawl. Paste into the browser console with the app open, or run it through
// the checks in fsu-tests. Presses every control in every view, one level into any sheet
// a control opens, and reports:
//   deadRoutes    a nav control whose target view is missing, or that did not land there
//   deadControls  a button that changed nothing at all when pressed
//   inert         a data- element that is not a button and did nothing, usually fine
//   threw         an error thrown by a handler
// The saved state is snapshotted and put back after every click. Controls that delete,
// export, send or sign are named in `skipped` rather than pressed.
(function crawl(){
  const SKIP=/\b(del|delete|remove|wipe|reset|clear|export|share|print|dxf|pdf|package|restore|backup|token|connect|disconnect|sign|push|pull|sync|install|empty)/i;
  const out={deadRoutes:[],deadControls:[],threw:[],inert:[],skipped:[],clicked:0,views:0};
  const snap=()=>JSON.stringify(S);
  // what is open, as well as what is saved: a control that starts a sketch or an incident
  // leaves the pointer behind, and the restored state no longer holds it
  const cur0=(()=>{try{return{curItem,curComp,curBay,curFill,curSketch,curInc,curLayer}}catch(e){return null}})();
  const back=j=>{const o=JSON.parse(j);for(const k of Object.keys(S))delete S[k];Object.assign(S,o);
    if(cur0){curItem=cur0.curItem;curComp=cur0.curComp;curBay=cur0.curBay;curFill=cur0.curFill;
      curSketch=cur0.curSketch;curInc=cur0.curInc;curLayer=cur0.curLayer}};
  const setView=v=>{view=v;prevView=null;document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));render();
    if(typeof NAV!=="undefined")NAV.length=0; if(typeof navLast!=="undefined")navLast=null};
  const label=e=>{const d=Object.entries(e.dataset).map(([k,v])=>"data-"+k+(v?"="+v:"")).join(" ");
    return ((e.id?"#"+e.id+" ":"")+(d?d+" ":"")+(e.textContent||"").trim().replace(/\s+/g," ").slice(0,40)).trim()||e.tagName};
  const route=e=>e.dataset.go||e.dataset.v||e.dataset.navback||null;
  const sheetOn=()=>!!document.querySelector("#sheet.on");
  const fp=()=>view+"|"+(sheetOn()?1:0)+"|"+document.body.innerHTML+"|"+snap();
  const btn=e=>e.tagName==="BUTTON"||e.tagName==="A"||e.getAttribute("role")==="button"||/^(button|submit)$/.test(e.type||"");
  const hot=e=>e.tagName==="BUTTON"||e.tagName==="A"||e.getAttribute("role")==="button"||!!Object.keys(e.dataset).length;
  const controls=sel=>[...document.querySelectorAll(sel)].filter(e=>e.offsetParent!==null&&hot(e));
  const clean=snap(), home=view;
  const press=(el,where)=>{
    const name=label(el);
    if(SKIP.test(name)){out.skipped.push(where+" > "+name);return null}
    const r=route(el), b=fp();
    if(r&&!document.getElementById("v-"+r)){out.deadRoutes.push(where+" > "+name+": no #v-"+r);return null}
    try{el.click()}catch(e){out.threw.push(where+" > "+name+": "+e.message);return null}
    out.clicked++;
    if(r&&view!==r)out.deadRoutes.push(where+" > "+name+": landed on "+view+", not "+r);
    else if(fp()===b)(btn(el)?out.deadControls:out.inert).push(where+" > "+name);
    return name;
  };
  for(const v of [...document.querySelectorAll("section.view")].map(s=>s.id.slice(2))){
    setView(v); out.views++;
    const sel="section.view.on *"+(v===home?",#tabs *,#side *":"");
    for(let i=0;i<controls(sel).length;i++){
      const list=controls(sel); if(i>=list.length)break;
      const name=press(list[i],v);
      if(name&&sheetOn())for(let j=0;j<controls("#sheet *").length;j++){
        const sub=controls("#sheet *"); if(j>=sub.length||!sheetOn())break;
        press(sub[j],v+" > "+name);
      }
      if(typeof closeSheet==="function")closeSheet();
      back(clean); setView(v);
    }
  }
  back(clean); setView(home);
  out.ok=!out.deadRoutes.length&&!out.threw.length;
  console.log(JSON.stringify(out,null,1)); return out;
})();
