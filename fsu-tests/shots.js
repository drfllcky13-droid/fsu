// Design before/after screenshots. node shots.js <outdir>   (server must be on 8795)
const {chromium}=require("playwright");
const VIEWS=["home","inventory","compartments","sweep","incident"];
(async()=>{
  const dir=process.argv[2]||"design-before";
  const b=await chromium.launch();
  for(const scheme of ["light","dark"]){
    const c=await b.newContext({viewport:{width:1194,height:834},colorScheme:scheme});
    const p=await c.newPage();
    await p.goto("http://127.0.0.1:8795/index.html");
    await p.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
    await p.evaluate(()=>{const inc=newIncident();curInc=inc.id;saveLocal()});
    for(const v of VIEWS){
      await p.evaluate(name=>{view=name;document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+name));render();
        const d=document.querySelector("#date"); if(d)d.textContent="Sat, Jan 1";},v);
      await p.waitForTimeout(250);
      await p.screenshot({path:`${dir}/${v}-${scheme}.png`,fullPage:true});
    }
    await c.close();
  }
  await b.close();
  console.log("shots -> "+dir);
})();
