// Model-based random testing. The other specs click one control at a time; what they cannot
// reach is a long sequence where the order is what breaks things. This keeps a small plain
// model of the parts of the record whose rules are simple — items, compartments, incidents and
// their documents, one sketch's object list — drives the real app through its own controls and
// functions for a few hundred seeded actions, and checks the two still agree after every one.
const {test,expect}=require("@playwright/test");

// Two jobs, two pages, so two runs. index.html is the van and owns items and compartments;
// scenes.html is the scene and owns incidents, their documents and the sketch. They share
// storage but not controls: a view on the other page is only reachable by navigating there,
// which would end the run. So each run generates only actions its own page can perform.
// Both start from the same fresh record, so the invariants that are about the record as a
// whole are checked by both.
const HALF={
  van:   {seed:20260912, url:"/index.html",  ready:"#v-home"},   // seeds fixed so a failure
  scene: {seed:20260913, url:"/scenes.html", ready:"#v-active"}, // replays; printed every run
};
const RUNS=250;             // per run: a few hundred actions, not tens of thousands
const COMPS=["1A1","1A2","2A","3B"];                      // real codes from the seeded van
const PLANS=["entrylog","evidence","photolog","report"];  // the form-backed plan keys
// no marker or photopoint: those write to the evidence log on a timer, so the record would
// still be moving when the snapshot is taken
const TYPES=["chair","rect","wall","tree","car","text"];
const UNDOMAX=40, UNDOKEEP=6;   // app.js: the cap on the stack, and how much survives a reload

const rng=s=>()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};

/* ---------- the sequence: a pure function of the seed, so a shrunk run replays exactly ----------
   actions name items, incidents and sketches by the order they were created, not by id, so an
   action still means the same thing after an earlier one has been shrunk away. */
// weights: on the scene page a sketch is started rarely, so the undo history gets deep enough
// to be interesting before the next one replaces it
const KINDS={
  van:["addItem","addItem","addItem","logUse","logUse","adjust","adjust",
    "place","unplace","delItem","sweep","sweep","reload"],
  scene:["newInc","attachDoc","attachDoc","closeInc","newSketch",
    "addObj","addObj","addObj","addObj","delObj","delObj","delObj",
    "undo","undo","redo","redo","undoRedo","reload"],
};
function generate(seed,count,half){
  const r=rng(seed), pick=n=>Math.floor(r()*n), of=a=>a[pick(a.length)];
  let nI=0,nC=0, out=[];
  const KIND=KINDS[half];
  while(out.length<count){
    const k=of(KIND);
    if(k==="addItem"){out.push({k,comp:of(COMPS),qty:1+pick(9),name:"Probe "+nI});nI++;continue}
    if(k==="newInc"){out.push({k,caseNo:"26-"+(1000+nC)});nC++;continue}
    if(k==="newSketch"){out.push({k});continue}
    if(["logUse","adjust","place","unplace","delItem"].includes(k)){
      if(!nI)continue;
      const a={k,item:pick(nI)};
      if(k==="logUse")a.q=1+pick(6);                 // may exceed stock: the clamp is the point
      if(k==="adjust"){a.qty=pick(20);a.par=pick(7)?String(pick(6)):""}
      if(k==="place")a.comp=of(COMPS);
      out.push(a);continue}
    if(k==="attachDoc"||k==="closeInc"){
      if(!nC)continue;
      out.push(k==="attachDoc"?{k,inc:pick(nC),plan:of(PLANS)}:{k,inc:pick(nC)});continue}
    if(k==="sweep"){out.push({k,comp:of(COMPS)});continue}
    if(k==="addObj"){out.push({k,t:of(TYPES)});continue}
    if(k==="delObj"){out.push({k,pick:pick(64)});continue}
    out.push({k});
  }
  return out;
}

/* ---------- the model ---------- */
// items, comps and incidents mirror S; sketches keeps the object ids of every sketch started;
// undo/redo mirror the app's stacks for the current sketch only.

// ordinals to ids; null means this action has nothing to act on in this run, so it is skipped
function resolve(m,a){
  if(["logUse","adjust","place","unplace","delItem"].includes(a.k)){
    const id=m.order.items[a.item];
    return id&&m.items.some(i=>i.id===id)?Object.assign({},a,{id}):null;
  }
  if(a.k==="attachDoc"||a.k==="closeInc"){
    const id=m.order.incs[a.inc];
    return id&&m.incidents.some(x=>x.id===id)?Object.assign({},a,{id}):null;
  }
  if(a.k==="addObj"||a.k==="undo"||a.k==="redo")return m.cur?a:null;
  // only a pair: with nothing to undo the Undo button is disabled, so the redo would move
  // the sketch forward on its own and the round trip would not be a round trip
  if(a.k==="undoRedo")return m.cur&&m.undo.length?a:null;
  if(a.k==="delObj"){
    const sk=m.sketches.find(s=>s.id===m.cur);
    if(!sk||!sk.objs.length)return null;
    return Object.assign({},a,{obj:sk.objs[a.pick%sk.objs.length]});
  }
  return a;
}
function stepModel(m,a,got){
  const sk=()=>m.sketches.find(s=>s.id===m.cur);
  const push=()=>{m.undo.push(sk().objs.slice()); if(m.undo.length>UNDOMAX)m.undo.shift(); m.redo=[]};
  const it=()=>m.items.find(i=>i.id===a.id);
  switch(a.k){
    case "addItem":
      m.items.push({id:got.id,name:a.name,qty:Math.max(1,a.qty),par:"1",loc:a.comp});
      m.order.items.push(got.id); break;
    case "logUse":{const i=it(); i.qty=Math.max(0,i.qty-a.q); break}
    case "adjust":{const i=it(); i.qty=a.qty; i.par=a.par; break}
    case "place":{it().loc=a.comp; break}
    case "unplace":{it().loc=""; break}
    case "delItem": m.items=m.items.filter(i=>i.id!==a.id); break;
    case "sweep":{const c=m.comps.find(x=>x.code===a.comp); c.checked=true; break}
    case "newInc": m.incidents.push({id:got.id,closed:false,plans:[]}); m.order.incs.push(got.id); break;
    case "attachDoc":{const x=m.incidents.find(y=>y.id===a.id);
      if(!x.plans.includes(a.plan))x.plans.push(a.plan); break}
    case "closeInc":{const x=m.incidents.find(y=>y.id===a.id); x.closed=!x.closed; break}
    case "newSketch":
      m.sketches.push({id:got.id,objs:[]}); m.order.sks.push(got.id);
      m.cur=got.id; m.undo=[]; m.redo=[]; break;    // a fresh id starts with empty stacks
    case "addObj": push(); sk().objs.push(got.id); break;
    case "delObj": push(); sk().objs=sk().objs.filter(x=>x!==a.obj); break;
    case "undo": if(m.undo.length){m.redo.push(sk().objs.slice()); sk().objs=m.undo.pop()} break;
    case "redo": if(m.redo.length){m.undo.push(sk().objs.slice()); sk().objs=m.redo.pop()} break;
    case "undoRedo": break;                          // an undo and its redo cancel out exactly
    case "reload": m.undo=m.undo.slice(-UNDOKEEP); m.redo=[]; break;  // only six snapshots persist
  }
}

/* ---------- the app side: one round trip per action, returning the facts the model tracks ---------- */
const STEP=(a)=>{
  const click=s=>{const el=document.querySelector(s); if(!el)throw new Error("no control "+s); el.click()};
  const setv=(s,v)=>{const el=document.querySelector(s); if(!el)throw new Error("no field "+s); el.value=v};
  const out={};
  switch(a.k){
    case "addItem":
      S.curLoc=a.comp; S.pick=false; S.quick=true; go("sweep");
      setv("#q-name",a.name); setv("#q-qty",String(a.qty)); click("#qadd");
      out.id=S.items[S.items.length-1].id; break;
    case "logUse":
      openItem(a.id,"inventory"); click('[data-loguse="'+a.id+'"]');
      setv("#un",String(a.q)); click("#usave"); break;
    case "adjust":
      openItem(a.id,"inventory"); click('[data-adjust="'+a.id+'"]');
      setv("#aq",String(a.qty)); setv("#ap",a.par); click("#asave"); break;
    case "place": case "unplace":
      openItem(a.id,"inventory"); click('[data-edititem="'+a.id+'"]');
      setv("#il",a.k==="place"?a.comp:""); click("#isave"); break;
    case "delItem":
      openItem(a.id,"inventory"); click('[data-edititem="'+a.id+'"]');
      click("#idel"); click("#cfyes"); break;
    case "sweep":
      S.curLoc=a.comp; S.pick=false; go("sweep"); click('[data-sweepdone="'+a.comp+'"]'); break;
    case "newInc":
      go("active"); click("[data-newinc]");
      setv("#inc",a.caseNo); click("#insave");
      out.id=S.incidents[S.incidents.length-1].id; break;
    case "attachDoc":
      curInc=a.id; go("incident"); click('[data-plan="'+a.plan+'"]'); break;
    case "closeInc":
      curInc=a.id; go("incident"); click("[data-incclose]");
      if(document.querySelector("#cfyes"))click("#cfyes"); break;
    case "newSketch":
      // the same call the Quick sketch button and #v=sketch&ref=new both land on; it opens the
      // scene-details sheet on top of the new sketch, which is dismissed the way Cancel does
      startSketch(""); closeSheet();
      out.id=curSketch; break;
    case "addObj":
      go("sketch"); addObj(a.t);
      out.id=curSk().objs[curSk().objs.length-1].id; break;
    case "delObj":
      // select it and open its panel, the way tapping the object then its settings does
      go("sketch"); selObj=a.obj; showSet=true; renderSketch();
      click('[data-odel="'+a.obj+'"]'); break;
    case "undo": go("sketch"); click("[data-skundo]"); break;
    case "redo": go("sketch"); click("[data-skredo]"); break;
    case "undoRedo":{
      go("sketch");
      const before=JSON.stringify(curSk().objs);
      click("[data-skundo]"); click("[data-skredo]");
      if(JSON.stringify(curSk().objs)!==before)out.err="undo then redo did not restore the sketch";
      break}
  }
  return out;
};

// everything the model claims to know, read back off the real record
const READ=(ids)=>({
  items:S.items.map(i=>[i.id,String(i.name),+i.qty||0,String(i.par==null?"":i.par),String(i.loc||"")]),
  comps:S.comps.map(c=>[c.code,!!c.checked]),
  incidents:(S.incidents||[]).map(x=>[x.id,!!x.closed,docsFor(x.id).length]),
  sketches:ids.map(id=>{const s=(S.sketches||[]).find(x=>x.id===id); return [id,s?(s.objs||[]).map(o=>o.id):null]}),
  // the undo stacks only exist on the page that draws; the van run never starts a sketch
  undo:typeof UNDO==="undefined"?0:((curSketch&&UNDO[curSketch])||[]).length,
  redo:typeof REDO==="undefined"?0:((curSketch&&REDO[curSketch])||[]).length
});

function invariants(rec){
  const codes=rec.comps.map(c=>c[0]);
  for(const [id,name,qty,par,loc] of rec.items){
    if(qty<0)return "quantity went negative on "+name+" ("+qty+")";
    if(typeof loc!=="string")return name+" is in more than one compartment";
    if(loc&&!codes.includes(loc))return name+" points at compartment "+loc+", which does not exist";
  }
  const seen=new Set();
  const uniq=(list,what)=>{for(const id of list){ if(seen.has(id))return "duplicate id "+id+" ("+what+")"; seen.add(id)} return null};
  let bad=uniq(rec.items.map(i=>i[0]),"item")||uniq(codes,"compartment")
    ||uniq(rec.incidents.map(i=>i[0]),"incident");
  if(bad)return bad;
  for(const [id,objs] of rec.sketches){
    if(!objs)continue;
    const s=new Set();
    for(const o of objs){ if(s.has(o))return "duplicate object id "+o+" in sketch "+id; s.add(o) }
  }
  return null;
}

/* ---------- running one sequence ---------- */
async function fresh(page,H){
  await page.goto(H.url);
  await page.evaluate(()=>localStorage.clear());
  await page.goto(H.url);
  await page.waitForFunction(sel=>typeof render==="function"&&document.querySelector(sel),H.ready);
  // no initials prompt, and no backup prompt when the last compartment is swept
  await page.evaluate(()=>{S.who="QA"; S.lastBackup=new Date().toISOString().slice(0,10); saveLocal()});
  const rec=await page.evaluate(READ,[]);
  return {items:rec.items.map(([id,name,qty,par,loc])=>({id,name,qty,par,loc})),
    comps:rec.comps.map(([code,checked])=>({code,checked})),
    incidents:[],sketches:[],cur:"",undo:[],redo:[],order:{items:[],incs:[],sks:[]}};
}
function modelRec(m){
  return {items:m.items.map(i=>[i.id,i.name,i.qty,i.par,i.loc]),
    comps:m.comps.map(c=>[c.code,c.checked]),
    incidents:m.incidents.map(x=>[x.id,x.closed,x.plans.length]),
    sketches:m.sketches.map(s=>[s.id,s.objs.slice()]),
    undo:m.undo.length,redo:m.redo.length};
}
// returns null when the whole sequence agreed, else {i,why}
let TALLY={};
async function runSeq(page,seq,errors,H){
  const m=await fresh(page,H);
  errors.length=0; TALLY={};
  for(let i=0;i<seq.length;i++){
    const a=resolve(m,seq[i]); if(!a)continue;
    TALLY[a.k]=(TALLY[a.k]||0)+1;
    let got;
    try{
      if(a.k==="reload"){
        await page.reload();
        await page.waitForFunction(()=>typeof render==="function");
        // the in-memory pointers are gone; put them back the way reopening the sketch would.
        // Opening it is what reloads the undo history, so this has to happen before the read.
        await page.evaluate(id=>{S.who="QA"; if(id){curSketch=id; selObj=null; go("sketch")}},m.cur);
        got={};
      } else got=await page.evaluate(STEP,a);
    }catch(e){ return {i,why:"the app threw: "+e.message} }
    if(got.err)return {i,why:got.err};
    if(errors.length)return {i,why:"pageerror: "+errors[0]};
    stepModel(m,a,got);
    const rec=await page.evaluate(READ,m.sketches.map(s=>s.id));
    const bad=invariants(rec);
    if(bad)return {i,why:bad};
    const want=JSON.stringify(modelRec(m)), have=JSON.stringify(rec);
    if(want!==have)return {i,why:"model and app disagree after "+a.k+"\n  model: "+want+"\n  app:   "+have};
    if(a.k==="reload"){
      // the record itself must be untouched by the reload: re-read and compare to the model again
      const again=await page.evaluate(READ,m.sketches.map(s=>s.id));
      if(JSON.stringify(again)!==have)return {i,why:"the reload changed the record"};
    }
  }
  return null;
}

/* ---------- shrinking: drop actions one at a time while the failure survives ---------- */
async function shrink(page,seq,errors,budget,H){
  let best=seq.slice(), spent=0;
  for(let i=best.length-1;i>=0&&spent<budget;i--){
    const trial=best.slice(0,i).concat(best.slice(i+1));
    spent+=trial.length;
    if(await runSeq(page,trial,errors,H))best=trial;
  }
  return best;
}
const show=seq=>seq.map((a,i)=>"  "+(i+1)+". "+JSON.stringify(a)).join("\n");

async function runHalf(page,half){
  const H=HALF[half], errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  console.log("model.spec "+half+" seed: "+H.seed+" ("+RUNS+" actions on "+H.url+")");

  const seq=generate(H.seed,RUNS,half);
  const fail=await runSeq(page,seq,errors,H);
  console.log(half+" ran: "+Object.entries(TALLY).map(([k,v])=>k+" "+v).join(", "));
  if(!fail)return;

  const short=await shrink(page,seq.slice(0,fail.i+1),errors,4000,H);
  const again=await runSeq(page,short,errors,H);
  expect(fail,"seed "+H.seed+", failed at action "+(fail.i+1)+": "+fail.why
    +"\nshortest sequence that still fails ("+short.length+" actions):\n"+show(short)
    +"\n"+((again&&again.why)||"")).toBeNull();
}

// the van: what is carried, where it lives, how much of it there is
test("a few hundred random actions on the van leave the model and the app agreeing",async({page})=>{
  test.setTimeout(20*60*1000);
  await runHalf(page,"van");
});

// the scene: incidents, the documents planned for them, and one sketch's objects with its
// undo history — the part where the order of the actions is what breaks things
test("a few hundred random actions on the scene leave the model and the app agreeing",async({page})=>{
  test.setTimeout(20*60*1000);
  await runHalf(page,"scene");
});

// Found by the run above once the keyboard was added to the action list, then cut back to this.
// The panel's Delete button takes a snapshot first and says so ("Undo to bring it back"); the
// Delete key, which the sketch view advertises in its own hint line, does not. The object is
// gone for good, and the Undo it leaves behind rolls the sketch back past an earlier change.
test("an object removed with the Delete key comes back with Undo",async({page})=>{
  const errors=[]; page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/scenes.html");
  await page.evaluate(()=>localStorage.clear());
  // a new sketch, opened the way the Quick sketch button on the van opens one across the pages
  await page.goto("/scenes.html#v=sketch&ref=new");
  await page.waitForSelector("#sheet.on");         // the scene-details sheet it opens with
  await page.evaluate(()=>closeSheet());
  await page.waitForSelector("#skcanvas");
  await page.evaluate(()=>{addObj("chair"); addObj("table")});
  await page.keyboard.press("Delete");                      // the table is selected
  const r=await page.evaluate(()=>{doUndo(); return curSk().objs.map(o=>o.t)});
  expect(errors).toEqual([]);
  expect(r,"the deleted object is gone for good and the undo took an earlier change with it")
    .toEqual(["chair","table"]);
});
