// A marker drawn before the symbol changed is stretched to the new proportions, and it is
// stretched about its tip: the tip is the spot someone put it on, so that is what must not
// move. Measured markers are then put back onto their tape distances as before.
const {test,expect}=require("@playwright/test");

async function open(page){
  await page.goto("/scenes.html#v=sketch&ref=new");
  await page.waitForFunction(()=>typeof render==="function"&&document.querySelector("#v-sketch"));
}

test("an old marker is stretched to the new shape without leaving its spot",async({page})=>{
  await open(page);
  const r=await page.evaluate(()=>{
    const sk=newSketch(); curSketch=sk.id;
    sk.v=3;                                   // as saved by the previous build
    sk.objs=[{id:"m1",t:"marker",n:"1",x:200,y:300,w:48,h:56,r:0},
             {id:"m2",t:"marker",n:"2",x:400,y:300,w:24,h:28,r:0},   // a resized one
             {id:"r1",t:"rect",x:600,y:300,w:60,h:60,r:0}];
    const tipBefore=sk.objs.slice(0,2).map(o=>{const p=objPt(o,.5,.96);return [p.x,p.y]});
    saveLocal();
    repairSketch(sk);
    const after=sk.objs.slice(0,2).map(o=>{const p=objAnchor(o);return [p.x,p.y]});
    return {tipBefore,after,v:sk.v,
      sizes:sk.objs.map(o=>[o.w,o.h]),
      rect:sk.objs[2].h};
  });
  // the tip stays put, to within the rounding the app does on a position
  r.after.forEach((p,i)=>{
    expect(Math.abs(p[0]-r.tipBefore[i][0])).toBeLessThanOrEqual(1);
    expect(Math.abs(p[1]-r.tipBefore[i][1])).toBeLessThanOrEqual(1);
  });
  expect(r.sizes[0]).toEqual([48,92]);
  expect(r.sizes[1]).toEqual([24,46]);        // proportional, whatever size it was drawn at
  expect(r.rect,"a shape that is not a marker was resized").toBe(60);
  expect(r.v).toBe(4);
});

test("stretching an old marker does not move it off its tape distances",async({page})=>{
  await open(page);
  const r=await page.evaluate(()=>{
    const sk=newSketch(); curSketch=sk.id; sk.v=3;
    sk.scale={px:100,real:10,unit:"ft"};
    sk.objs=[{id:"a",t:"refpoint",x:100,y:500,w:20,h:20,r:0},
             {id:"b",t:"refpoint",x:600,y:500,w:20,h:20,r:0},
             {id:"m",t:"marker",n:"1",x:300,y:200,w:48,h:56,r:0,
              meas:{m:"tri",a:"a:c",b:"b:c",da:30,db:40,side:"l"}}];
    saveLocal();
    repairSketch(sk);
    const m=sk.objs[2], P=objAnchor(m);
    const A=objPt(sk.objs[0],.5,.5), B=objPt(sk.objs[1],.5,.5);
    return {da:pxReal(sk,Math.hypot(P.x-A.x,P.y-A.y)), db:pxReal(sk,Math.hypot(P.x-B.x,P.y-B.y)),
      stored:[m.meas.da,m.meas.db], size:[m.w,m.h]};
  });
  expect(r.size).toEqual([48,92]);
  expect(r.stored,"the tape record was rewritten").toEqual([30,40]);
  expect(r.da).toBeCloseTo(30,1);             // the tip sits where the tape says, after the stretch
  expect(r.db).toBeCloseTo(40,1);
});
