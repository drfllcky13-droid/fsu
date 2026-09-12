// Print checks. The compartment map, the labels sheet and the install sheet are paper:
// they get printed once and pinned in the van, so nothing may run off the edge of the page.
// Letter at 96dpi is 816px wide; half-inch margins leave 720px of printable width.
const {test,expect}=require("@playwright/test");
const fs=require("fs"), path=require("path");
const VIS=fs.readFileSync(path.join(__dirname,"..","..","visible.js"),"utf8");
const PAGE=720;

async function printPage(page,url){
  await page.setViewportSize({width:PAGE,height:1056});
  await page.emulateMedia({media:"print"});
  await page.goto(url);
}

for(const v of ["print","labels"]){
  test(`the ${v} view fits the page`,async({page})=>{
    await printPage(page,"/index.html");
    await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
    const wide=await page.evaluate(v=>{
      view=v;   // the app's own binding, not a new window property
      document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));
      render();
      return [...document.querySelectorAll("section.view.on *")].filter(e=>{
        const cs=getComputedStyle(e); if(cs.display==="none"||cs.visibility==="hidden")return false;
        const r=e.getBoundingClientRect(); return r.width>0&&r.right>document.documentElement.clientWidth+1;
      }).map(e=>(e.className&&typeof e.className==="string"?"."+e.className.split(/\s+/)[0]+" ":"")
        +(e.textContent||"").trim().replace(/\s+/g," ").slice(0,30)+" ["+Math.round(e.getBoundingClientRect().right)+" of "+document.documentElement.clientWidth+"]");
    },v);
    expect([...new Set(wide)]).toEqual([]);
  });
}

test("the install sheet fits the page",async({page})=>{
  await printPage(page,"/install.html");
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
});

test("the compartment map prints as a real pdf",async({page},info)=>{
  await printPage(page,"/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
  await page.evaluate(()=>{view="print";
    document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-print"));render()});
  const pdf=await page.pdf({format:"Letter",printBackground:true});
  expect(pdf.length).toBeGreaterThan(2000);
  // a PDF says how many pages it holds; one page of nothing would not
  const pages=+(pdf.toString("latin1").match(/\/Count (\d+)/)||[0,0])[1];
  expect(pages).toBeGreaterThan(0);
  console.log(`print pdf: ${pages} page(s), ${Math.round(pdf.length/1024)}kb`);
});
