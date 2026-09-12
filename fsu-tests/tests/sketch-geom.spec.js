// Geometry, measurement and undo integrity for the sketch.
// These are the numbers that end up in a case file, so they are checked against arithmetic
// done here rather than against whatever the app happened to produce.
const {test,expect}=require("@playwright/test");

async function open(page){
  await page.goto("/index.html");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-home"));
}
// a sketch at 100 page units = 10 ft, so 1 ft = 10 page units
async function sketch(page){
  await page.evaluate(()=>{document.querySelector("[data-quicksketch]").click()});
  await page.waitForSelector("#skcanvas");
  await page.evaluate(()=>{const sk=curSk(); sk.scale={px:100,real:10,unit:"ft"}; saveLocal(); renderSketch()});
}
test.beforeEach(async({page})=>{ await page.setViewportSize({width:1400,height:1000}); await open(page); await sketch(page); });

test("a marker is measured at its spike, not the middle of its card",async({page})=>{
  const r=await page.evaluate(()=>{
    const sk=curSk();
    addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500; a.r=0;
    addObj("marker");   const m=objAt(selObj); m.x=300; m.y=300; m.r=0;
    const spike=objPt(m,.5,.98), centre=objPt(m,.5,.5);
    // the point the measurement engine uses for a marker, taken through refPt's ":c" key
    const used=refPt(sk,m.id+":c");
    // and placing the same marker by measurement must put the spike, not the centre, on it
    const p=solveMeas(sk,{m:"polar",a:a.id+":c",da:20,ang:90});     // 20 ft east of the ref point
    placeAnchor(m,p);
    return {used:[used.x,used.y], spike:[spike.x,spike.y], centre:[centre.x,centre.y],
      afterSpike:[objPt(m,.5,.98).x,objPt(m,.5,.98).y], want:[p.x,p.y], h:m.h};
  });
  expect(r.used).toEqual(r.spike);
  expect(r.used).not.toEqual(r.centre);
  expect(r.spike[1]-r.centre[1]).toBeCloseTo(r.h*0.48,6);   // the error this fixes, in page units
  expect(Math.abs(r.afterSpike[0]-r.want[0])).toBeLessThan(1);   // integer rounding of x,y only
  expect(Math.abs(r.afterSpike[1]-r.want[1])).toBeLessThan(1);
});

test("a rotated object still lands with its anchor on the solved point",async({page})=>{
  const off=await page.evaluate(()=>{
    const sk=curSk();
    addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
    addObj("marker");   const m=objAt(selObj); m.r=37;
    const p=solveMeas(sk,{m:"polar",a:a.id+":c",da:12.5,ang:210});
    placeAnchor(m,p);
    const q=objAnchor(m);
    return Math.hypot(q.x-p.x,q.y-p.y);
  });
  expect(off).toBeLessThan(1);        // only the integer rounding of x and y
});

test("triangulation, baseline offset and bearing solve to the distances that were typed",async({page})=>{
  const r=await page.evaluate(()=>{
    const sk=curSk();
    addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
    addObj("refpoint"); const b=objAt(selObj); b.x=600; b.y=500;
    const A=refPt(sk,a.id+":c"), B=refPt(sk,b.id+":c");
    const tri=solveMeas(sk,{m:"tri",a:a.id+":c",b:b.id+":c",da:30,db:40,side:"l"});
    const triR=solveMeas(sk,{m:"tri",a:a.id+":c",b:b.id+":c",da:30,db:40,side:"r"});
    const base=solveMeas(sk,{m:"base",a:a.id+":c",b:b.id+":c",da:10,db:5,side:"l"});
    return {
      dA:pxReal(sk,Math.hypot(tri.x-A.x,tri.y-A.y)), dB:pxReal(sk,Math.hypot(tri.x-B.x,tri.y-B.y)),
      mirrored:[triR.x-tri.x, triR.y+tri.y-2*A.y],           // same x, mirrored about the A-B line
      base:[base.x-A.x, base.y-A.y],
      // impossible triangle: 1 ft and 1 ft cannot span a 50 ft gap
      impossible:solveMeas(sk,{m:"tri",a:a.id+":c",b:b.id+":c",da:1,db:1,side:"l"})};
  });
  expect(r.dA).toBeCloseTo(30,6);
  expect(r.dB).toBeCloseTo(40,6);
  expect(r.mirrored[0]).toBeCloseTo(0,6);
  expect(r.mirrored[1]).toBeCloseTo(0,6);
  expect(r.base).toEqual([100,-50]);    // 10 ft along A->B (east), 5 ft to the left (up the page)
  expect(r.impossible).toBe(null);
});

test("changing the scale moves everything placed by measurement back onto its tape distances",async({page})=>{
  const r=await page.evaluate(()=>{
    const sk=curSk();
    addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
    addObj("marker");   const m=objAt(selObj);
    m.meas={m:"polar",a:a.id+":c",da:20,db:0,side:"l",ang:90};
    placeAnchor(m,solveMeas(sk,m.meas));
    const A=refPt(sk,a.id+":c");
    const before=pxReal(sk,Math.hypot(objAnchor(m).x-A.x,objAnchor(m).y-A.y));
    sk.scale={px:100,real:20,unit:"ft"};          // half the drawn size per foot
    const stale=pxReal(sk,Math.hypot(objAnchor(m).x-A.x,objAnchor(m).y-A.y));
    const moved=resolveMeas(sk);
    const A2=refPt(sk,a.id+":c");
    const after=pxReal(sk,Math.hypot(objAnchor(m).x-A2.x,objAnchor(m).y-A2.y));
    return {before,stale,after,moved,da:m.meas.da};
  });
  expect(r.before).toBeCloseTo(20,3);
  expect(r.stale).toBeCloseTo(40,3);      // what the drawing claimed before the fix
  expect(r.moved).toBe(1);
  expect(r.after).toBeCloseTo(20,1);      // back on the tape reading, which never changed
  expect(r.da).toBe(20);
});

test("a duplicate keeps neither the original's measurement nor its photograph",async({page})=>{
  const r=await page.evaluate(()=>{
    const sk=curSk();
    addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
    addObj("photopoint"); const p=objAt(selObj);
    p.meas={m:"polar",a:a.id+":c",da:12,db:0,side:"l",ang:0}; p.photoId="img-1"; p.n="3";
    const c=dupObj(sk,p);
    return {meas:!!c.meas, photo:!!c.photoId, n:c.n, orig:p.n};
  });
  expect(r.meas).toBe(false);
  expect(r.photo).toBe(false);
  expect(r.orig).toBe("3");
  expect(r.n).toBe("4");
});

test("an older sketch's markers are re-solved onto their tape distances when it opens",async({page})=>{
  const r=await page.evaluate(()=>{
    const sk=curSk();
    addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
    addObj("marker");   const m=objAt(selObj);
    // exactly how a v2 build stored it: the CENTRE on the solved point
    // due north of the reference point, so the whole centre-to-spike offset is along the tape
    const meas={m:"polar",a:a.id+":c",da:20,db:0,side:"l",ang:0};
    const p=solveMeas(sk,meas);
    m.meas=meas; m.x=Math.round(p.x-m.w/2); m.y=Math.round(p.y-m.h/2);
    sk.v=2;
    const A=refPt(sk,a.id+":c");
    const wrong=pxReal(sk,Math.hypot(objAnchor(m).x-A.x,objAnchor(m).y-A.y));
    repairSketch(sk);
    const right=pxReal(sk,Math.hypot(objAnchor(m).x-A.x,objAnchor(m).y-A.y));
    return {wrong,right,v:sk.v,da:m.meas.da};
  });
  expect(r.v).toBe(4);   // migrated to the current shape, whatever it is today
  expect(r.da).toBe(20);                      // the record itself is untouched
  expect(Math.abs(r.wrong-20)).toBeGreaterThan(1);   // more than a foot out before migrating
  expect(r.right).toBeCloseTo(20,1);
});

test("a room typed off a tape is that size inside, not down the middle of its walls",async({page})=>{
  await page.click("[data-skgrp=draw]"); await page.click("#sheet [data-skwalls]");
  await page.fill("#wrw","16"); await page.fill("#wrd","12"); await page.fill("#wthick","6 in");
  await page.selectOption("#wmt","in");
  await page.click("#wgo");
  const r=await page.evaluate(()=>{
    const sk=curSk(), w=sk.objs.filter(o=>o.t==="wall");
    // the inside of the box the four walls enclose
    const l=Math.max(...w.filter(o=>o.w<o.h).map(o=>o.x)), rt=Math.min(...w.filter(o=>o.w<o.h).map(o=>o.x+o.w));
    const t=Math.max(...w.filter(o=>o.w>o.h).map(o=>o.y)), b=Math.min(...w.filter(o=>o.w>o.h).map(o=>o.y+o.h));
    const left=w.filter(o=>o.w<o.h).map(o=>o.x).sort((a,c)=>a-c);
    const tops=w.filter(o=>o.w>o.h).map(o=>o.y).sort((a,c)=>a-c);
    return {n:w.length,
      insideW:pxReal(sk,left[1]-(left[0]+w.find(o=>o.x===left[0]&&o.w<o.h).w)),
      insideH:pxReal(sk,tops[1]-(tops[0]+w.find(o=>o.y===tops[0]&&o.w>o.h).h))};
  });
  expect(r.n).toBe(4);
  expect(r.insideW).toBeCloseTo(16,1);
  expect(r.insideH).toBeCloseTo(12,1);
});

test("lengths read back the way they were typed, in feet and in metres",async({page})=>{
  const r=await page.evaluate(()=>({
    ft:[parseLen("12'4\"","ft"),parseLen("12 ft 4 in","ft"),parseLen("4 in","ft"),parseLen("12","ft"),
        parseLen("12′ 4″","ft"),parseLen("nonsense","ft")],
    m:[parseLen("3.2","m"),parseLen("0.15","m")],
    // what measure() prints, and that it survives a round trip through parseLen
    print:[measure(curSk(),123),measure(curSk(),-15),measure(curSk(),120)],
    round:parseLen(measure(curSk(),123),"ft")*10}));
  expect(r.ft[0]).toBeCloseTo(12.3333,3);
  expect(r.ft[1]).toBeCloseTo(12.3333,3);
  expect(r.ft[2]).toBeCloseTo(0.3333,3);
  expect(r.ft[3]).toBe(12);
  expect(r.ft[4]).toBeCloseTo(12.3333,3);
  expect(Number.isNaN(r.ft[5])).toBe(true);
  expect(r.m).toEqual([3.2,0.15]);
  expect(r.print[2]).toBe("12′");
  expect(r.print[1]).toBe("-1′ 6″");     // was "-2' 6\"" before
  expect(r.round).toBeCloseTo(123,0);
});

test("the DXF carries the drawing in real units, on named layers, with the measurements",async({page})=>{
  const dxf=await page.evaluate(async()=>{
    const sk=curSk();
    addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
    addObj("marker");   const m=objAt(selObj);
    m.meas={m:"polar",a:a.id+":c",da:20,db:0,side:"l",ang:90};
    placeAnchor(m,solveMeas(sk,m.meas));
    layersOf(sk)[0].name="Ground floor";
    let out=null;
    const real=dlBlob; window.__dl=null;
    dlBlob=async b=>{window.__dl=await b.text()};
    exportDXF(sk); dlBlob=real;
    for(let i=0;i<40&&window.__dl===null;i++)await new Promise(r=>setTimeout(r,25));
    return window.__dl;
  });
  expect(dxf).toContain("GROUND_FLOOR");
  expect(dxf).toContain("MEASUREMENTS");
  expect(dxf.startsWith("0\r\nSECTION")).toBe(true);
  expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
  // $INSUNITS 2 is feet, and the sketch is 1000 page units wide at 10 ft per 100, so 100 ft
  expect(dxf).toMatch(/\$INSUNITS\r\n70\r\n2\r\n/);
  const ext=dxf.match(/\$EXTMAX\r\n10\r\n(-?[\d.]+)/);
  expect(parseFloat(ext[1])).toBeLessThanOrEqual(100.1);
});

test.describe("undo",()=>{
  test("deleting a layer and undoing it brings the layer back, not just the objects",async({page})=>{
    const r=await page.evaluate(()=>{
      const sk=curSk();
      const L=addLayer(sk); L.name="Blood";
      curLayer=L.id; addObj("marker"); const m=objAt(selObj);
      const before={layers:sk.layers.length, lay:m.lay, name:L.name};
      // exactly what the layer sheet's delete does
      const ls=layersOf(sk), other=ls.find(x=>x.id!==L.id);
      pushUndo(sk);
      sk.objs.forEach(o=>{if((o.lay||ls[0].id)===L.id)o.lay=other.id});
      sk.layers=ls.filter(x=>x.id!==L.id);
      const after={layers:sk.layers.length};
      doUndo();
      const back=curSk();
      return {before,after,layers:back.layers.length,
        names:back.layers.map(l=>l.name),
        lay:back.objs.find(o=>o.t==="marker").lay,
        pointsAtRealLayer:back.layers.some(l=>l.id===back.objs.find(o=>o.t==="marker").lay)};
    });
    expect(r.before.layers).toBe(2);
    expect(r.after.layers).toBe(1);
    expect(r.layers).toBe(2);
    expect(r.names).toContain("Blood");
    expect(r.pointsAtRealLayer).toBe(true);
  });

  test("setting the scale can be undone, and the measured objects go back with it",async({page})=>{
    const r=await page.evaluate(()=>{
      const sk=curSk();
      addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
      addObj("marker");   const m=objAt(selObj);
      m.meas={m:"polar",a:a.id+":c",da:20,db:0,side:"l",ang:90};
      placeAnchor(m,solveMeas(sk,m.meas));
      const was=[m.x,m.y], scale=sk.scale.real;
      pushUndo(sk); sk.scale={px:100,real:20,unit:"ft"}; resolveMeas(sk);
      const mid=[objAt(m.id).x,objAt(m.id).y];
      doUndo();
      const n=objAt(m.id);
      return {was,mid,now:[n.x,n.y],scale,scaleNow:curSk().scale.real};
    });
    expect(r.scaleNow).toBe(r.scale);
    expect(r.now).toEqual(r.was);
    expect(r.mid).not.toEqual(r.was);
  });

  test("a run of arrow-key nudges is one undo, and undoing it restores the start",async({page})=>{
    const r=await page.evaluate(async()=>{
      const sk=curSk();
      addObj("chair"); const o=objAt(selObj);
      o.x=400; o.y=400; saveLocal(); renderSketch();
      const start=[o.x,o.y];
      const depth0=(UNDO[sk.id]||[]).length;
      for(let i=0;i<12;i++)document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
      const moved=[objAt(o.id).x,objAt(o.id).y];
      const depth1=(UNDO[sk.id]||[]).length;
      doUndo();
      const back=objAt(o.id);
      return {start,moved,depth:depth1-depth0,back:[back.x,back.y]};
    });
    expect(r.moved[0]-r.start[0]).toBe(12);
    expect(r.depth).toBe(1);              // one entry for the run, not twelve
    expect(r.back).toEqual(r.start);
  });

  test("nudging a measured object keeps its measurement in step with where it is drawn",async({page})=>{
    const r=await page.evaluate(()=>{
      const sk=curSk();
      addObj("refpoint"); const a=objAt(selObj); a.x=100; a.y=500;
      addObj("marker");   const m=objAt(selObj);
      m.meas={m:"polar",a:a.id+":c",da:20,db:0,side:"l",ang:90};
      placeAnchor(m,solveMeas(sk,m.meas)); selObj=m.id; saveLocal(); renderSketch();
      const was=objAt(m.id).meas.da;
      for(let i=0;i<10;i++)document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
      const o=objAt(m.id), A=refPt(sk,a.id+":c");
      return {was, stored:o.meas.da, drawn:pxReal(sk,Math.hypot(objAnchor(o).x-A.x,objAnchor(o).y-A.y))};
    });
    expect(r.was).toBe(20);
    expect(r.stored).toBeCloseTo(21,1);      // 10 page units east = 1 ft
    expect(r.stored).toBeCloseTo(r.drawn,1); // and the drawing agrees with the record
  });

  test("the arrow keys and Delete respect a locked layer",async({page})=>{
    const r=await page.evaluate(()=>{
      const sk=curSk();
      addObj("chair"); const o=objAt(selObj); o.x=400; o.y=400;
      layersOf(sk)[0].locked=true; selObj=o.id; saveLocal(); renderSketch();
      document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
      const afterNudge=objAt(o.id).x;
      document.dispatchEvent(new KeyboardEvent("keydown",{key:"Delete",bubbles:true}));
      const afterDel=curSk().objs.some(q=>q.id===o.id);
      document.dispatchEvent(new KeyboardEvent("keydown",{key:"d",bubbles:true}));
      return {afterNudge,afterDel,count:curSk().objs.length};
    });
    expect(r.afterNudge).toBe(400);
    expect(r.afterDel).toBe(true);
    expect(r.count).toBe(1);            // and D did not copy it either
  });

  test("a new object never lands in a locked layer",async({page})=>{
    const r=await page.evaluate(()=>{
      const sk=curSk();
      const L=addLayer(sk); curLayer=L.id; L.locked=true;
      addObj("chair");
      const a=curSk().objs.length&&curSk().objs[0].lay;
      layersOf(sk).forEach(l=>l.locked=true);
      const n=curSk().objs.length;
      addObj("chair");
      return {landedOn:a, lockedId:L.id, added:curSk().objs.length-n};
    });
    expect(r.landedOn).not.toBe(r.lockedId);
    expect(r.added).toBe(0);            // with every layer locked, nothing is added
  });

  test("an undo stack written by an older build still applies",async({page})=>{
    const ok=await page.evaluate(()=>{
      const sk=curSk();
      addObj("chair"); const o=objAt(selObj);
      // the old shape: a bare array of objects
      UNDO[sk.id]=[JSON.stringify([{id:"old",t:"rect",x:10,y:10,w:50,h:50,r:0,lay:"L1"}])];
      doUndo();
      const s=curSk();
      return s.objs.length===1&&s.objs[0].id==="old"&&!!layersOf(s).length;
    });
    expect(ok).toBe(true);
  });
});
