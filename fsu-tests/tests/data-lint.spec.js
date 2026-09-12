// A lint over the record the app ships, not over the code. A compartment code on a printed label
// that points at nothing costs someone a search in the back of a van, so these read the seeded
// state after a fresh load and name the offending id when they fail.
const {test,expect}=require("@playwright/test");

// collected in one pass so a later data change breaks the one rule it actually violates
const SCAN=()=>{
  const bad={dupComp:[],ghostLoc:[],ghostBay:[],badDate:[],badNum:[],
             thinForm:[],dupForm:[],dupId:[]};
  const codes={};
  (S.comps||[]).forEach(c=>{
    const k=String(c.code);
    if(codes[k])bad.dupComp.push(k); else codes[k]=c;
    if(!BAYNAME[bayOf(k)])bad.ghostBay.push(k+" is in bay "+bayOf(k)+", which has no name");
    if(c.checked&&isNaN(Date.parse(c.checked)))bad.badDate.push(k+".checked = "+c.checked);
  });
  const num=(v,where)=>{ if(v===""||v==null)return;
    if(typeof v!=="number"&&!/^\d+(\.\d+)?$/.test(String(v).trim()))bad.badNum.push(where+" = "+JSON.stringify(v)) };
  (S.items||[]).forEach(i=>{
    if(i.loc&&!codes[i.loc])bad.ghostLoc.push(i.id+" — "+i.name+" — loc "+i.loc);
    ["date","verified"].forEach(f=>{ if(i[f]&&isNaN(Date.parse(i[f])))
      bad.badDate.push(i.id+" — "+i.name+" — "+f+" = "+i[f]) });
    num(i.qty,i.id+" — "+i.name+" — qty");
    num(i.par,i.id+" — "+i.name+" — par");
  });
  const names={};
  (S.forms||[]).forEach(f=>{
    const who=f.id+" — "+(f.name||"(no name)");
    if(names[f.name])bad.dupForm.push("two forms named "+f.name+": "+names[f.name]+" and "+f.id);
    else names[f.name]=f.id;
    if(f.verified&&isNaN(Date.parse(f.verified)))bad.badDate.push(who+" — verified = "+f.verified);
    if(!f.stock)return;
    if(!f.name)bad.thinForm.push(f.id+" has no name");
    if(!f.cat)bad.thinForm.push(who+" has no category");
    else if(!FORMCATS.includes(f.cat))bad.thinForm.push(who+" is filed under \""+f.cat+"\", which is not a category the form editor offers");
    if(!(f.fields||[]).length)bad.thinForm.push(who+" has no fields");
  });
  const ids={};
  [["item",S.items],["comp",(S.comps||[]).map(c=>({id:c.code}))],["form",S.forms],
   ["incident",S.incidents],["sketch",S.sketches]].forEach(([kind,list])=>{
    (list||[]).forEach(r=>{ if(!r||!r.id)return;
      if(ids[r.id])bad.dupId.push(r.id+" is both a "+ids[r.id]+" and a "+kind);
      else ids[r.id]=kind });
  });
  return bad;
};

async function scan(page,demo){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
  if(demo)await page.evaluate(()=>{if(!S.demo)loadDemo()});
  return page.evaluate(SCAN);
}

// the sample van is shipped too, and it is what a new unit sees first, so both records are linted
for(const demo of [false,true]){
  const what=demo?"the sample van":"the shipped van";

  test(`${what} has no two compartments sharing a code`,async({page})=>{
    expect((await scan(page,demo)).dupComp).toEqual([]);
  });

  test(`every item in ${what} sits in a compartment that exists`,async({page})=>{
    expect((await scan(page,demo)).ghostLoc).toEqual([]);
  });

  test(`every date set in ${what} parses as a real date`,async({page})=>{
    expect((await scan(page,demo)).badDate).toEqual([]);
  });

  test(`every quantity and par level in ${what} is a number`,async({page})=>{
    expect((await scan(page,demo)).badNum).toEqual([]);
  });

  test(`no two forms in ${what} share a name`,async({page})=>{
    expect((await scan(page,demo)).dupForm).toEqual([]);
  });

  test(`no id in ${what} is used by two different records`,async({page})=>{
    expect((await scan(page,demo)).dupId).toEqual([]);
  });
}

// bays are read off the first character of the code, and the sample van invents its own codes,
// so only the record a real unit works from has to resolve to a named bay
test("every compartment in the shipped van belongs to a named bay",async({page})=>{
  expect((await scan(page,false)).ghostBay).toEqual([]);
});

test("every stock form has a name, a category the editor offers, and at least one field",async({page})=>{
  expect((await scan(page,false)).thinForm).toEqual([]);
});
