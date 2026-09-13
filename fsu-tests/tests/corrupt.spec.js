// Corruption checks. A van iPad that will not open is worse than one that lost a record.
// Each case writes a damaged store under van3, loads the app, and asks only that it boots,
// throws nothing, and puts something on the screen. Where the good half of a damaged record
// is still readable, it also asks that the good half survived.
const {test,expect}=require("@playwright/test");

const GOOD={
  seeded:true,
  comps:[{code:"1A1",desc:"Top drawer",side:"Driver side",x:0,y:0,w:6,h:4,checked:"2026-08-28"},
         {code:"1A2",desc:"Second drawer",side:"Driver side",x:6,y:0,w:6,h:4}],
  items:[{id:"i1",name:"Unit hinge lifters, 2 in",qty:"4",par:"2",cat:"C",cls:"Consumable",loc:"1A1",date:"2027-01-31",status:"Stocked"},
         {id:"i2",name:"Unit pry bars",qty:"2",par:"1",cat:"I",cls:"Durable",loc:"1A2",date:"",status:"Stocked"}],
  incidents:[{id:"in1",caseNo:"26-001234",offence:"Burglary",addr:"12 Main St",
              opened:"2026-08-01T09:00:00.000Z",closed:"",plan:[]}],
  sketches:[{id:"sk1",caseNo:"26-001234",incidentId:"in1",addr:"12 Main St",when:"2026-08-01T09:00",by:"AG",
             objs:[{id:"o1",t:"rect",x:10,y:10,w:100,h:80,r:0}],
             layers:[{id:"L1",name:"Layer 1",locked:false}]}],
  fills:[],forms:[],locs:[],lastCat:"A",lastCls:"Consumable",curLoc:""
};
// each case gets its own copy to wreck, so one case cannot poison the next
const wreck=f=>{const d=JSON.parse(JSON.stringify(GOOD));f(d);return JSON.stringify(d)};

// what a user would have to see for the iPad to be usable at all
const BOOT=`({render:typeof render==="function", home:!!document.querySelector("#v-home"),
  tabs:document.querySelectorAll("#tabs button").length,
  ink:(document.body.innerText||"").trim().length})`;

const WALK=["home","compartments","inventory","sweep","sweep"];
// `view` and `render` are page globals; this runs inside the page
const walk=vs=>{const bad=[];
  for(const v of vs){ try{ if(v==="sketch")curSketch="sk1"; view=v; render() }catch(e){ bad.push(v+": "+e.message) } }
  try{ view="home"; render() }catch(e){}
  return bad};

// raw: the exact bytes written under van3. also: extra views to walk for this case.
// recovered: runs in the page after boot, returns whatever the case claims should have survived.
const CASES=[
 {n:"a record truncated mid-string",
  raw:JSON.stringify(GOOD).slice(0,140)},

 {n:"an array where the record should be an object",
  raw:JSON.stringify([1,2,3])},

 {n:"a bare string where the record should be an object",
  raw:JSON.stringify("van3")},

 {n:"a number where the record should be an object",
  raw:JSON.stringify(42)},

 {n:"a literal null",
  raw:"null"},

 {n:"S.items that is an object, not an array",
  raw:wreck(d=>{d.items={i1:{id:"i1",name:"Unit hinge lifters, 2 in"}}}),
  // the compartments were readable and are not what was damaged
  recovered:`S.comps.filter(c=>c.code==="1A1"||c.code==="1A2").length`, expect:2},

 {n:"S.items that is a string",
  raw:wreck(d=>{d.items="Unit hinge lifters, 2 in"}),
  recovered:`S.comps.filter(c=>c.code==="1A1"||c.code==="1A2").length`, expect:2},

 {n:"S.items that is an array of nulls",
  raw:wreck(d=>{d.items=[null,null,d.items[0]]}),
  // the one real item sat beside the nulls and is still good data
  recovered:`!!S.items.find(i=>i&&i.name==="Unit hinge lifters, 2 in")`, expect:true},

 {n:"an item that is a string, not an object",
  raw:wreck(d=>{d.items.push("Screwdriver set")}),
  recovered:`!!S.items.find(i=>i&&i.name==="Unit hinge lifters, 2 in")`, expect:true},

 {n:"an item filed in a compartment that does not exist",
  raw:wreck(d=>{d.items[0].loc="9Z9"}),
  // the app makes the missing compartment rather than losing sight of the item
  recovered:`!!S.comps.find(c=>c.code==="9Z9")&&!!S.items.find(i=>i.name==="Unit hinge lifters, 2 in")`, expect:true},

 {n:"two compartments sharing one code",
  raw:wreck(d=>{d.comps.push({code:"1A1",desc:"Also top drawer",side:"Driver side",x:0,y:8,w:6,h:4})}),
  recovered:`S.comps.filter(c=>c.code==="1A1").length>=1&&!!S.items.find(i=>i.loc==="1A1")`, expect:true},

 {n:"a compartment with no code at all",
  raw:wreck(d=>{d.comps.push({desc:"Nameless",side:"Driver side",x:0,y:8,w:6,h:4})}),
  recovered:`S.comps.filter(c=>c.code==="1A1"||c.code==="1A2").length`, expect:2},

 {n:"a nonsense date and a quantity that is not a number",
  raw:wreck(d=>{d.items[0].date="soon-ish";d.items[0].qty="a few";d.items[0].par="lots"}),
  recovered:`(()=>{const i=S.items.find(x=>x.name==="Unit hinge lifters, 2 in");
    return !!i&&daysOut(i.date)===null&&n(i.qty)===0})()`, expect:true},

 {n:"a sketch with no objs at all",
  raw:wreck(d=>{delete d.sketches[0].objs}), also:["sketch"],
  recovered:`Array.isArray((S.sketches.find(s=>s.id==="sk1")||{}).objs)`, expect:true},

 {n:"a sketch whose objs is not an array",
  raw:wreck(d=>{d.sketches[0].objs="rect"}), also:["sketch"],
  recovered:`Array.isArray((S.sketches.find(s=>s.id==="sk1")||{}).objs)`, expect:true},

 {n:"a sketch object of a type the app has never heard of",
  raw:wreck(d=>{d.sketches[0].objs.push({id:"o2",t:"tesseract",x:5,y:5,w:20,h:20})}), also:["sketch"],
  // the known object beside it is real scene work and must not be swept away with the bad one
  recovered:`(S.sketches.find(s=>s.id==="sk1").objs||[]).some(o=>o.id==="o1")`, expect:true},

 {n:"an incident whose sketch has been deleted from under it",
  raw:wreck(d=>{d.sketches=[]}),
  recovered:`!!incidentOf("in1")`, expect:true},

 {n:"a sketch pointing at an incident that is gone",
  raw:wreck(d=>{d.incidents=[]}), also:["sketch"],
  recovered:`!!S.sketches.find(s=>s.id==="sk1")`, expect:true},

 {n:"a 200,000 character item name",
  raw:wreck(d=>{d.items[0].name="x".repeat(200000)}),
  recovered:`!!S.items.find(i=>i.name.length===200000)&&!!S.items.find(i=>i.name==="Unit pry bars")`, expect:true},

 {n:"localStorage refusing every write, the way private browsing does",
  raw:JSON.stringify(GOOD),
  // getItem still answers in private browsing; only the write is refused
  init:()=>{Object.defineProperty(localStorage,"setItem",
    {value:()=>{throw new DOMException("QuotaExceededError")},configurable:true})},
  recovered:`!!S.items.find(i=>i.name==="Unit hinge lifters, 2 in")`, expect:true}
];

for(const c of CASES){
  test(`the app opens with ${c.n}`,async({page})=>{
    // a case about sketches has to be opened by the page that draws them
    const home=(c.also||[]).includes("sketch")?"/scenes.html":"/index.html";
    const first=home==="/scenes.html"?"#v-active":"#v-home";
    // an origin has to exist before localStorage will take a write
    await page.goto(home);
    await page.evaluate(v=>{localStorage.clear();localStorage.setItem("van3",v)},c.raw);
    if(c.init)await page.addInitScript(c.init);
    const errs=[];
    page.on("pageerror",e=>errs.push(e.message));
    await page.reload();
    await page.waitForSelector(first);

    const boot=await page.evaluate(BOOT);
    expect(errs,"an uncaught error was thrown while loading").toEqual([]);
    expect(boot.render,"render() never got defined").toBe(true);
    expect(boot.tabs,"no tab bar, so there is no way out of this screen").toBeGreaterThan(0);
    expect(boot.ink,"a white screen").toBeGreaterThan(20);

    const bad=await page.evaluate(walk,c.also?WALK.concat(c.also):WALK);
    expect(bad,"render() threw on a view").toEqual([]);
    expect(errs,"an uncaught error was thrown while walking the views").toEqual([]);

    if(c.recovered!==undefined)
      expect(await page.evaluate(c.recovered),"good data was dropped along with the bad").toEqual(c.expect);
  });
}
