// Keyboard checks. A gloved hand uses touch, but a keyboard is how the desk machine gets
// driven and how anything assistive reads the app: focus has to move, it has to be visible
// where it lands, and a sheet has to be escapable.
const {test,expect}=require("@playwright/test");

const VIEWS=["home","compartments","inventory","sweep","guide","data"];   // the van page

async function open(page){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}
const focused=page=>page.evaluate(()=>{
  const e=document.activeElement; if(!e||e===document.body)return null;
  const cs=getComputedStyle(e);
  return {tag:e.tagName, id:e.id, view:e.closest("section.view")?e.closest("section.view").id:"chrome",
    label:(e.id?"#"+e.id+" ":"")+(e.textContent||e.placeholder||"").trim().replace(/\s+/g," ").slice(0,30),
    ring:cs.outlineStyle!=="none"||cs.boxShadow!=="none"||cs.borderStyle!=="none"};
});

test("focus moves through every view and is visible where it lands",async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await open(page);
  const blind=[];
  for(const v of VIEWS){
    await page.evaluate(view=>{ if(typeof go==="function")go(view) },v);
    await page.evaluate(()=>{document.body.focus();if(document.activeElement)document.activeElement.blur()});
    const seen=new Set();
    for(let i=0;i<25;i++){
      await page.keyboard.press("Tab");
      const f=await focused(page);
      if(!f)continue;
      seen.add(f.label);
      if(!f.ring)blind.push(v+": "+f.label);
    }
    expect(seen.size,`Tab moved nowhere in ${v}`).toBeGreaterThan(3);
  }
  expect([...new Set(blind)]).toEqual([]);
});

test("a sheet can be left with the keyboard",async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await open(page);
  await page.evaluate(()=>{document.querySelector("[data-newinc]").click()});
  await page.waitForSelector("#sheet.on");    // the sheet slides up on the next frame
  await page.keyboard.press("Escape");
  expect(await page.evaluate(()=>!!document.querySelector("#sheet.on"))).toBe(false);
});

test("tabbing inside a sheet stays in the sheet",async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await open(page);
  await page.evaluate(()=>{document.querySelector("[data-newinc]").click()});
  await page.waitForSelector("#sheet.on");
  const out=[];
  for(let i=0;i<12;i++){
    await page.keyboard.press("Tab");
    const where=await page.evaluate(()=>{
      const e=document.activeElement;
      return e&&document.querySelector("#sheet").contains(e)?null
        :(e?((e.id?"#"+e.id:"")+" "+(e.textContent||"").trim().replace(/\s+/g," ").slice(0,24)).trim():"body");
    });
    if(where)out.push(where);
  }
  // a sheet is modal: the tab order behind it should not be reachable while it is up
  expect([...new Set(out)]).toEqual([]);
});
