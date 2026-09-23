// The map: Settings › Map on the scene page, and the two backdrops that must be to scale —
// the county aerial and the map drawing. A backdrop that is off by a factor quietly makes every
// distance measured over it wrong, which is the whole point of a sketch.
const {test,expect}=require("@playwright/test");
const LAT=41.2412, FEET=320;
// the app's service worker makes these fetches itself, out of page.route's reach
test.use({serviceWorkers:"block"});

async function open(page,url){
  await page.goto(url);
  await page.waitForFunction(()=>typeof render==="function"&&!!document.querySelector("section.view.on"));
}

test("Settings › Map opens the map on the scene page, and says why when it cannot load",async({page})=>{
  await open(page,"/index.html");
  expect(await page.evaluate(()=>document.getElementById("v-map"))).toBeNull();
  await page.route(/lib\/maplibre|williamsport-/,r=>r.abort());
  await open(page,"/scenes.html");
  await page.click("#gear");
  await page.click('#v-data [data-go="map"]');
  expect(await page.evaluate(()=>[view,location.hash])).toEqual(["map","#v=map"]);
  await expect(page.locator("#mapq")).toBeVisible();
  await expect(page.locator("#mapbox")).toContainText("connection");
});

test("addresses are found on the device: typos forgiven, corners understood",async({page})=>{
  await open(page,"/scenes.html");
  // nothing leaves the machine: the search reads the file beside the page
  await page.route(/^(?!http:\/\/127\.0\.0\.1)/,r=>r.abort());
  const r=await page.evaluate(async()=>{
    const first=async q=>((await findAddress(q))[0]||{}).label;
    const all=async q=>(await findAddress(q)).map(h=>h.label);
    return {exact:await first("329 Pine St"), typed:await first("329 pine street"), typo:await first("329 pnie st"),
      corner:await first("4th and Market"), church:await all("church"), near:await first("331 pine")};
  });
  expect(r.exact).toBe("329 PINE ST, WILLIAMSPORT");
  expect(r.typed).toBe("329 PINE ST, WILLIAMSPORT");
  expect(r.typo).toBe("329 PINE ST, WILLIAMSPORT");
  expect(r.corner).toMatch(/4TH ST & MARKET ST|MARKET ST & .*4TH ST/);
  expect(r.church.some(l=>/ E CHURCH ST/.test(l))&&r.church.some(l=>/ W CHURCH ST/.test(l))).toBe(true);
  expect(r.near,"the nearest number on the street when the exact one is not there").toMatch(/^3\d\d PINE ST/);
});

test("everything the offline download lists is really there",async({page})=>{
  await open(page,"/scenes.html");
  const bad=await page.evaluate(()=>Promise.all(OFFLINE.map(u=>fetch(u).then(r=>r.ok?null:u+" "+r.status))).then(l=>l.filter(Boolean)));
  expect(bad).toEqual([]);
});

test("the county aerial covers the ground its scale claims",async({page})=>{
  await open(page,"/scenes.html");
  let asked=null;
  await page.route(/imagery\.pasda\.psu\.edu/,r=>{asked=r.request().url();
    r.fulfill({status:200,contentType:"image/jpeg",body:Buffer.alloc(1000)})});
  await page.evaluate(([lat,feet])=>fetchAerial(lat,-77.0011,feet,1024),[LAT,FEET]);
  const [x0,,x1]=new URL(asked).searchParams.get("bbox").split(",").map(Number);
  // Web Mercator metres are ground metres x 1/cos(latitude), so the box asked for is that much wider
  expect((x1-x0)*Math.cos(LAT*Math.PI/180)/0.3048).toBeCloseTo(FEET,1);
});

test("seeing more of the map keeps what is drawn on its spot, at its true size",async({page})=>{
  await open(page,"/scenes.html");
  const r=await page.evaluate(async()=>{
    fetchPlan=async(lat,lon,feet)=>({data:"data:image/png;base64,iVBORw0KGgo=",feet});
    startSketch("");
    const sk=S.sketches.find(s=>s.id===curSketch);
    sk.bg={imgId:"bgtest",x:100,y:200,w:600,h:600,kind:"map",lat:41.24,lon:-77,ground:300,px:2048};
    sk.scale={px:600,real:300,unit:"ft"};
    sk.objs=[{id:"c1",t:"car",x:500,y:500,w:40,h:20,r:30},{id:"g1",t:"legend",x:10,y:900,w:200,h:100}];
    pushUndo(sk);
    // feet east of the map's centre (400,500) and feet wide, read through the scale
    const ft=o=>[(o.x+o.w/2-400)*sk.scale.real/sk.scale.px, o.w*sk.scale.real/sk.scale.px];
    const before=ft(sk.objs[0]);
    await reframeBg(sk,450);
    return {before, after:ft(sk.objs[0]), ground:sk.bg.ground, legend:[sk.objs[1].x,sk.objs[1].y,sk.objs[1].w],
      undone:JSON.parse(UNDO[sk.id].at(-1)).o[0].w};
  });
  expect(r.ground).toBe(450);
  expect(r.after[0]).toBeCloseTo(r.before[0],1);
  expect(r.after[1]).toBeCloseTo(r.before[1],1);
  expect(r.legend,"the legend belongs to the page and stays put").toEqual([10,900,200]);
  expect(r.undone,"the undo history zooms with it").toBeCloseTo(40*300/450,1);
});

test("framing the map somewhere else keeps what is drawn on its spot on the ground",async({page})=>{
  await open(page,"/scenes.html");
  const r=await page.evaluate(()=>{
    startSketch("");
    const sk=S.sketches.find(s=>s.id===curSketch);
    const a={x:184,y:118,w:632,h:632,lat:41.24,lon:-77,ground:320};
    // the new frame: the whole page under the title block, 500 ft across, centred 40 ft east and 25 ft south
    const per=Math.PI/180*6378137/0.3048;
    const b={x:0,y:118,w:1000,h:632,lat:41.24-25/per,lon:-77+40/(per*Math.cos(41.24*Math.PI/180)),ground:500};
    sk.bg=a; sk.scale={px:632,real:320,unit:"ft"};
    sk.objs=[{id:"c1",t:"car",x:560,y:380,w:30,h:14,r:0},{id:"n1",t:"north",x:900,y:140,w:40,h:40}];
    // feet east and north of a fixed point on the ground, read through a frame
    const at=(f,o)=>[(o.x+o.w/2-f.x-f.w/2)*f.ground/f.w+(f.lon+77)*per*Math.cos(41.24*Math.PI/180),
      -(o.y+o.h/2-f.y-f.h/2)*f.ground/f.w+(f.lat-41.24)*per];
    const before=at(a,sk.objs[0]), wide=sk.objs[0].w*a.ground/a.w;
    setBackdrop(sk,b);
    return {before, after:at(b,sk.objs[0]), wide, wideAfter:sk.objs[0].w*sk.scale.real/sk.scale.px,
      north:[sk.objs[1].x,sk.objs[1].y,sk.objs[1].w]};
  });
  expect(r.after[0]).toBeCloseTo(r.before[0],1);
  expect(r.after[1]).toBeCloseTo(r.before[1],1);
  expect(r.wideAfter).toBeCloseTo(r.wide,1);
  expect(r.north,"the north arrow belongs to the page").toEqual([900,140,40]);
});

test("the map drawing is drawn at the scale it claims",async({page})=>{
  await open(page,"/scenes.html");
  const got=await page.evaluate(async([lat,feet])=>{
    let ml; try{ml=await mapLoad()}catch(e){return null}
    const px=768, box=document.createElement("div");
    box.style.cssText=`position:fixed;left:-900px;top:0;width:${px}px;height:${px}px`;
    document.body.appendChild(box);
    let m;
    try{ m=new ml.Map({container:box,style:{version:8,sources:{},layers:[]},center:[-77.0011,lat],
      zoom:planZoom(lat,feet,px),interactive:false}) }
    catch(e){ box.remove(); return null }      // no WebGL on this machine
    await new Promise(r=>m.on("load",r));
    const a=m.unproject([0,px/2]), b=m.unproject([px,px/2]);
    m.remove(); box.remove();
    return (b.lng-a.lng)*Math.PI/180*6378137*Math.cos(lat*Math.PI/180)/0.3048;
  },[LAT,FEET]);
  test.skip(got===null,"MapLibre could not be fetched or has no WebGL here, so there is nothing to measure");
  expect(got).toBeCloseTo(FEET,1);
});
