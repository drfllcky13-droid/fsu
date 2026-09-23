// Photographs and the records that use them. A case package that could not read a photograph
// says which one and where it belongs, instead of leaving it out without a word. Settings › This
// device checks the photo store against the records: it lists photographs no record uses and
// records whose photograph is missing, and removes only the first, after a confirm. A photograph
// only an undo step still refers to counts as in use.
const {test,expect}=require("@playwright/test");
const IMG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

async function openScenes(page){
  await page.goto("/scenes.html"); await page.evaluate(()=>localStorage.clear());
  await page.goto("/scenes.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-active"));
}
// an incident whose sketch has two photo points: one photograph here, one gone
const setUp=page=>page.evaluate(async img=>{
  navigator.canShare=()=>false; window.dlBlob=()=>{};
  const inc=newIncident(); inc.caseNo="26-0300";
  const sk={id:"sk"+newId(),incidentId:inc.id,caseNo:inc.caseNo,v:SKETCH_V,layers:[{id:"L1",name:"Layer 1"}],
    objs:[{id:"o1",t:"photopoint",n:"1",x:5,y:5,w:20,h:20,r:0,photoId:"pok"},
          {id:"o2",t:"photopoint",n:"2",label:"Rear door",x:40,y:5,w:20,h:20,r:0,photoId:"pgone"}]};
  S.sketches.push(sk); saveLocal();
  await photoPut("pok",{data:img,w:1,hh:1});
  return inc.id;
},IMG);

test("a case package names a photograph it could not read, and where it belongs",async({page})=>{
  await openScenes(page);
  const inc=await setUp(page);
  const pkg=await page.evaluate(async id=>{const p=await casePackage({incidentId:id}); return {photos:Object.keys(p.photos),missing:p.missingPhotos}},inc);
  expect(pkg.photos).toEqual(["pok"]);
  expect(pkg.missing.map(m=>m.id),"the package does not say what it left out").toEqual(["pgone"]);
  await page.evaluate(id=>exportCasePackage({incidentId:id},"c"),inc);
  await page.waitForSelector("#sheet.on");
  const text=await page.locator("#sheetbody").textContent();
  expect(text,"the missing photograph was not named").toContain("pgone");
  expect(text).toContain("photo point 2 on the sketch for 26-0300");
  expect(await page.evaluate(id=>!!incidentOf(id).pkg,inc),"a package without all its photographs counted as complete").toBe(false);
});

test("the photo check lists unused and missing photographs and deletes only the unused ones",async({page})=>{
  await openScenes(page);
  await setUp(page);
  await page.evaluate(async img=>{
    await photoPut("porph",{data:img,w:1,hh:1});                  // left over from something deleted
    await photoPut("pundo",{data:img,w:1,hh:1});                  // an undo step could bring its object back
    localStorage.setItem("fsu-undo-skX",JSON.stringify([[{id:"o9",t:"photopoint",photoId:"pundo"}]]));
    SET_SEC="device"; view="data"; render();
  },IMG);
  await page.click("#photocheck");
  await page.waitForSelector("#sheet.on");
  const lists=await page.evaluate(()=>({
    orph:[...document.querySelectorAll("#sheet .photoorph li")].map(l=>l.textContent),
    miss:[...document.querySelectorAll("#sheet .photomiss li")].map(l=>l.textContent)}));
  expect(lists.orph.length).toBe(1);
  expect(lists.orph[0]).toContain("porph");
  expect(lists.miss.length).toBe(1);
  expect(lists.miss[0]).toContain("pgone");
  await page.click("#photoclean");
  await page.click("#cfno");                                      // cancel first: nothing goes
  expect(await page.evaluate(async()=>!!(await photoGet("porph")))).toBe(true);
  await page.evaluate(()=>{SET_SEC="device";view="data";render()});
  await page.click("#photocheck"); await page.waitForSelector("#sheet.on");
  await page.click("#photoclean"); await page.click("#cfyes");
  await page.waitForFunction(async()=>!(await photoGet("porph")));
  const left=await page.evaluate(async()=>({ok:!!(await photoGet("pok")),undo:!!(await photoGet("pundo")),
    rec:S.sketches[0].objs.map(o=>o.photoId)}));
  expect(left,"a photograph in use, or one undo could need, was deleted").toEqual({ok:true,undo:true,rec:["pok","pgone"]});
});
