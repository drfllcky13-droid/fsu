// Clock checks. Every warning in the app is a date subtraction, and a subtraction that lands a
// day early sends someone to re-verify kit that was fine, a day late lets expired reagent go to
// a scene. The rule these all share: a flag may only change at local midnight. If a state is
// true at 6am it must still be true at 10pm the same day.
const {test,expect}=require("@playwright/test");
// the sketch lives on the scene page; items, compartments and the settings screen on the van
async function openScenes(page){
  await page.goto("/scenes.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-active"));
}

// the unit is US Eastern, and several of these calculations parse a bare date as UTC, so the
// timezone has to be pinned or the answers move with whoever runs the suite
test.use({timezoneId:"America/New_York"});

async function open(page,at,seed){
  await page.clock.setFixedTime(new Date(at));
  await page.goto("/index.html");
  if(seed){
    await page.evaluate(s=>{localStorage.clear();localStorage.setItem("van3",JSON.stringify(s))},seed);
    await page.goto("/index.html");
  }
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}
const clock=(page,at)=>page.clock.setFixedTime(new Date(at));
const base={seeded:true,comps:[{code:"1A1",desc:"Power inverter and strip",side:"Driver side",x:4,y:0,w:8,h:10}],
  locs:[],lastCat:"A",lastCls:"Consumable",curLoc:""};
const morning=d=>d+"T06:00:00-04:00", evening=d=>d+"T22:00:00-04:00";

/* ---------- item expiry ---------- */

test("an item is good all through its expiry date and expired the next day",async({page})=>{
  await open(page,morning("2026-09-10"),Object.assign({},base,{items:[
    {id:"exp1",name:"Ninhydrin spray",loc:"1A1",cat:"C",cls:"Reagent",qty:2,par:"2",
     date:"2026-09-12",status:"Stocked",steps:[],uses:[],rel:[],links:[]}]}));
  const read=async at=>{await clock(page,at);
    return page.evaluate(()=>{const i=S.items[0];return {d:daysOut(i.date),exp:isExpired(i),soon:isExpiring(i)}})};
  for(const [day,days,exp] of [["2026-09-11",1,false],["2026-09-12",0,false],["2026-09-13",-1,true]]){
    const am=await read(morning(day)), pm=await read(evening(day));
    expect(am,`the flag changed part-way through ${day}`).toEqual(pm);
    expect(am.exp,`expired state on ${day}`).toBe(exp);
    expect(am.d,`days left on ${day}`).toBe(days);
  }
});

test("a durable item comes due for service on the thirtieth day, not the thirty-first",async({page})=>{
  await open(page,morning("2026-09-10"),Object.assign({},base,{items:[
    {id:"svc1",name:"Half-mask respirator",loc:"1A1",cat:"A",cls:"Durable",qty:2,par:"2",
     date:"2026-10-12",status:"Stocked",steps:[],uses:[],rel:[],links:[]}]}));
  const due=async at=>{await clock(page,at);return page.evaluate(()=>isService(S.items[0]))};
  // 2026-09-12 is 30 days out, 2026-09-11 is 31
  expect(await due(morning("2026-09-11")),"flagged a day early").toBe(false);
  expect(await due(evening("2026-09-11")),"flagged part-way through the day before").toBe(false);
  expect(await due(morning("2026-09-12")),"not flagged on the thirtieth day").toBe(true);
  expect(await due(evening("2026-09-12"))).toBe(true);
});

/* ---------- verified over a year ago ---------- */

test("instructions verified exactly a year ago are not yet over a year old",async({page})=>{
  await open(page,morning("2026-09-10"),Object.assign({},base,{guideSeeded:1,items:[
    {id:"g1",name:"Black fingerprint powder",loc:"1A1",cat:"C",cls:"Reagent",qty:1,par:"1",date:"",
     status:"Stocked",steps:["Apply with the fiberglass brush."],source:"WBP",
     verified:"2025-09-12",uses:[],rel:[],links:[]}]}));
  const stale=async at=>{await clock(page,at);return page.evaluate(()=>isStale(S.items[0]))};
  expect(await stale(morning("2026-09-12")),"stale on the anniversary itself").toBe(false);
  expect(await stale(evening("2026-09-12")),"the flag changed part-way through the anniversary").toBe(false);
  expect(await stale(morning("2026-09-13")),"not flagged the day after a full year").toBe(true);
  expect(await stale(evening("2026-09-13"))).toBe(true);
});

test("the guide banner counts a set as overdue on the same day the badge does",async({page})=>{
  await open(page,morning("2026-09-13"),Object.assign({},base,{guideSeeded:1,items:[
    {id:"g1",name:"Black fingerprint powder",loc:"1A1",cat:"C",cls:"Reagent",qty:1,par:"1",date:"",
     status:"Stocked",steps:["Apply with the fiberglass brush."],source:"WBP",
     verified:"2025-09-12",uses:[],rel:[],links:[]}]}));
  const txt=await page.evaluate(()=>{renderGuide();return $("#v-guide").textContent});
  expect(txt).toContain("over a year");
  expect(txt).toContain("Re-check");
});

test("a stock form verified exactly a year ago is not yet flagged for re-check",async({page})=>{
  await open(page,morning("2026-09-10"),Object.assign({},base,{items:[],
    forms:[{id:"f1",name:"Photography log",cat:"Photography",rev:"2022-A",desc:"Frame numbers",
      stock:true,verified:"2025-09-12",fields:[{id:"f0case",label:"Case number",type:"text"}]}]}));
  const stale=async at=>{await clock(page,at);
    return page.evaluate(()=>formStale(S.forms.find(f=>f.id==="f1")))};
  expect(await stale(morning("2026-09-12")),"stale on the anniversary itself").toBe(false);
  expect(await stale(evening("2026-09-12")),"the flag changed part-way through the anniversary").toBe(false);
  expect(await stale(morning("2026-09-13")),"not flagged the day after a full year").toBe(true);
});

/* ---------- stored GitHub token ---------- */

test("the token warning appears on the thirtieth day and says expired the day after it lapses",async({page})=>{
  await open(page,morning("2026-09-10"),Object.assign({},base,{items:[],ghExp:"2026-10-12",
    gh:{owner:"unit",repo:"van",path:"data.json",token:"x",sha:"",last:""}}));
  const pill=async at=>{await clock(page,at);
    return page.evaluate(()=>({d:tokenDays(),html:tokenPill()}))};
  // 2026-09-12 is 30 days out
  let r=await pill(morning("2026-09-11"));
  expect(r.d,"days left 31 days out").toBe(31);
  expect(r.html,"warned a day early").toContain("okpill");
  r=await pill(morning("2026-09-12"));
  expect(r.d).toBe(30);
  expect(r.html,"no warning on the thirtieth day").toContain("30 days left");
  expect(await pill(evening("2026-09-12"))).toEqual(r);

  r=await pill(morning("2026-10-12"));
  expect(r.d,"the token is still valid on its expiry date").toBe(0);
  expect(r.html,"called expired on the day it is still good").not.toContain("Expired");
  r=await pill(morning("2026-10-13"));
  expect(r.html,"a lapsed token is still being offered as usable").toContain("Expired");
  expect(await pill(evening("2026-10-13"))).toEqual(r);
});

test("the token countdown loses exactly one day per day across the end of daylight saving",async({page})=>{
  // tokenDays parses the expiry as a local time, so the hour the clocks go back can shift it
  await open(page,morning("2026-10-30"),Object.assign({},base,{items:[],ghExp:"2026-11-10",
    gh:{owner:"unit",repo:"van",path:"data.json",token:"x",sha:"",last:""}}));
  const days=async at=>{await clock(page,at);return page.evaluate(()=>tokenDays())};
  const seen=[await days("2026-10-31T09:00:00-04:00"),  // EDT
              await days("2026-11-01T09:00:00-05:00"),  // clocks went back at 2am
              await days("2026-11-02T09:00:00-05:00")];
  expect(seen,"the countdown skipped or repeated a day over the change").toEqual([seen[0],seen[0]-1,seen[0]-2]);
});

/* ---------- case package nag ---------- */

test("an unpackaged sketch is nagged about after six hours, not before",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-09-12T08:00:00-04:00"));
  await openScenes(page);
  await page.evaluate(()=>{localStorage.removeItem("van3")});
  await openScenes(page);
  await page.evaluate(()=>{
    const inc=newIncident(); curInc=inc.id; inc.caseNo="26-001234";
    const sk={id:"sk"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      objs:[],layers:[],when:new Date().toISOString(),v:4};
    (S.sketches=S.sketches||[]).push(sk); sk.incidentId=inc.id; curSketch=sk.id; addObj("refpoint"); saveLocal();
  });
  const nag=async at=>{await clock(page,at);
    return page.evaluate(()=>caseNag(S.sketches.find(s=>s.id===curSketch)))};
  expect(await nag("2026-09-12T13:30:00-04:00"),"nagged before the six hours were up").toBe("");
  expect(await nag("2026-09-12T15:00:00-04:00"),"no nag seven hours after the last change").not.toBe("");
  // packaging it clears the nag, and it stays clear the next day
  await page.evaluate(()=>{const sk=S.sketches.find(s=>s.id===curSketch);
    sk.packaged=new Date().toISOString(); S.lastCase=sk.packaged; saveLocal()});
  expect(await nag("2026-09-13T09:00:00-04:00"),"nagged about a sketch already in a package").toBe("");
});

/* ---------- sweep dates ---------- */

test("a compartment swept in the evening is dated today, not tomorrow",async({page})=>{
  await open(page,evening("2026-09-12"));
  const r=await page.evaluate(()=>{
    const c=S.comps[0]; c.checked=today(); saveLocal();
    return {today:today(),checked:c.checked}});
  expect(r.today,"today() is reading the UTC date, so an evening sweep is filed under tomorrow").toBe("2026-09-12");
  expect(r.checked).toBe("2026-09-12");
});

test("a compartment swept today still reads as swept after midnight",async({page})=>{
  await open(page,"2026-09-12T10:00:00-04:00");
  const code=await page.evaluate(()=>{
    const c=S.comps[0]; c.checked=today(); save(); return c.code});
  await clock(page,"2026-09-13T10:00:00-04:00");
  await page.reload();
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
  const r=await page.evaluate(c=>{const rec=S.comps.find(x=>x.code===c);
    return {checked:rec.checked,state:compState(c).k}},code);
  expect(r.checked,"the sweep date was lost over midnight").toBe("2026-09-12");
  expect(r.state,"a swept compartment went back to unchecked overnight").not.toBe("unchecked");
});
