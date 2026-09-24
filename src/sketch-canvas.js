/* ---------- sketch canvas ---------- */
let showSet=false, palCat=0, palQ="", skFull=false, skTools=true, skRailMin=false;
// shrink on the way in: a reference thumbnail, never the evidential copy
function shrinkPhoto(file,max=1400,q=0.72){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        let {width:w,height:hh}=img;
        const sc=Math.min(1,max/Math.max(w,hh));
        w=Math.round(w*sc); hh=Math.round(hh*sc);
        const c=document.createElement("canvas"); c.width=w; c.height=hh;
        c.getContext("2d").drawImage(img,0,0,w,hh);
        res({data:c.toDataURL("image/jpeg",q),w,hh});
      };
      img.onerror=()=>rej(new Error("Could not read that image"));
      img.src=fr.result;
    };
    fr.onerror=()=>rej(new Error("Could not read that file"));
    fr.readAsDataURL(file);
  });
}
// a backdrop can be megabytes, so it lives in IndexedDB like the photographs
const BGMEM={};              // id -> data URL, filled on demand
const BGWANT={};             // ids already being fetched
function bgLoad(id){
  if(!id||BGMEM[id]!==undefined||BGWANT[id])return;
  BGWANT[id]=1;
  photoGet(id).then(d=>{ BGMEM[id]=(d&&d.data)||null; delete BGWANT[id];
    if(view==="sketch")renderSketch() })
    .catch(()=>{ BGMEM[id]=null; delete BGWANT[id] });
}
async function bgData(sk){
  const b=sk&&sk.bg; if(!b)return null;
  if(b.data)return b.data;                       // older sketches kept it inline
  if(!b.imgId)return null;
  if(BGMEM[b.imgId])return BGMEM[b.imgId];
  const d=await photoGet(b.imgId).catch(()=>null);
  if(d&&d.data){BGMEM[b.imgId]=d.data; return d.data}
  return null;
}
async function bgStore(sk,dataURL,meta){
  const id=(sk.bg&&sk.bg.imgId)||newId();
  await photoPut(id,{data:dataURL,w:meta.w,hh:meta.hh});
  BGMEM[id]=dataURL;
  return id;
}
/* Carry the drawing from one address backdrop to another so every object keeps its spot on the
   ground and its true size: page to ground through the old frame, ground to page through the new.
   The undo history moves too, or undoing would put old positions over the new image. The legend
   and north arrow belong to the page, not the ground, so they stay put. */
const PAGEFIXED=new Set(["legend","north"]);
function moveDrawing(sk,a,b){
  const sa=a.w/a.ground, sb=b.w/b.ground, f=sb/sa, per=Math.PI/180*6378137/0.3048;  // feet per degree
  const ax=a.x+a.w/2, ay=a.y+a.h/2, r2=v=>Math.round(v*100)/100;
  // where the old centre lands in the new frame
  const tx=b.x+b.w/2+(a.lon-b.lon)*per*Math.cos(b.lat*Math.PI/180)*sb, ty=b.y+b.h/2-(a.lat-b.lat)*per*sb;
  const move=(objs,scale)=>{
    (objs||[]).forEach(o=>{ if(PAGEFIXED.has(o.t))return;
      o.x=r2(tx+(o.x-ax)*f); o.y=r2(ty+(o.y-ay)*f); o.w=r2(o.w*f); o.h=r2(o.h*f) });
    if(scale&&scale.px)scale.px*=f;
  };
  move(sk.objs,sk.scale);
  for(const st of [UNDO[sk.id],REDO[sk.id]])(st||[]).forEach((j,i)=>{
    const d=JSON.parse(j);
    if(Array.isArray(d))move(d,null); else move(d.o,d.s);
    st[i]=JSON.stringify(d);
  });
  persistUndo(sk);
}
// an address backdrop goes in, and its known width sets the scale
function setBackdrop(sk,nb){
  const old=sk.bg;
  if(old&&old.lat!=null&&old.ground&&(sk.objs||[]).length)moveDrawing(sk,old,nb);
  sk.bg=nb; sk.scale={px:nb.w,real:nb.ground,unit:"ft"};
  resolveMeas(sk);
}
// See more or less of the same spot
async function reframeBg(sk,ground){
  const b=sk.bg, map=b.kind==="map", px=map?2048:aerialPx(ground), py=map?Math.round(px*b.h/b.w):px;
  const got=await (map?fetchPlan(b.lat,b.lon,ground,px,py):fetchAerial(b.lat,b.lon,ground,px));
  await bgStore(sk,got.data,{w:px,hh:py});
  setBackdrop(sk,Object.assign({},b,{ground,px}));
  saveLocal();
}
// objects belong to a named layer; a sketch starts with one and you split it up yourself
function layersOf(sk){
  if(!sk.layers||!sk.layers.length)sk.layers=[{id:"L1",name:"Layer 1",locked:false}];
  return sk.layers;
}
const layerOf=(sk,o)=>layersOf(sk).find(l=>l.id===(o.lay||layersOf(sk)[0].id))||layersOf(sk)[0];
const layerLocked=(sk,o)=>!!(layerOf(sk,o)||{}).locked;
function addLayer(sk){
  const ls=layersOf(sk);
  let n=ls.length+1;
  while(ls.some(l=>l.name==="Layer "+n))n++;
  const l={id:"L"+Date.now().toString(36),name:"Layer "+n,locked:false};
  ls.push(l); saveLocal(); return l;
}
function newSketch(){
  const sk={id:newId(),caseNo:"",addr:"",when:new Date().toISOString().slice(0,16),by:"",objs:[],
    layers:[{id:"L1",name:"Layer 1",locked:false}]};
  S.sketches.push(sk);saveLocal();return sk;
}
function nextPhotoNo(sk){
  const used=(sk.objs||[]).filter(o=>o.t==="photopoint").map(o=>parseInt(o.n,10)).filter(n=>!isNaN(n));
  return used.length?Math.max(...used)+1:1;
}
function nextMarkerNo(sk){
  const used=(sk.objs||[]).filter(o=>o.t==="marker").map(o=>parseInt(o.n,10)).filter(n=>!isNaN(n));
  return used.length?Math.max(...used)+1:1;
}
function legendRows(sk){
  const rows=(sk.objs||[]).filter(o=>o.t==="marker");
  return rows.sort((a,b)=>{
    const an=parseInt(a.n,10), bn=parseInt(b.n,10);
    if(!isNaN(an)&&!isNaN(bn))return an-bn;
    if(!isNaN(an))return -1; if(!isNaN(bn))return 1;
    return String(a.n||"").localeCompare(String(b.n||""))});
}
function legendSVG(o,sk){
  const rows=legendRows(sk);
  const pad=10, titleH=Math.min(26,Math.max(15,o.h*.14));
  const avail=o.h-titleH-pad*1.5;
  // fixed row pitch so the box grows to hold more, rather than squeezing
  const rowH=Math.max(13,Math.min(20,o.w*.055));
  const fit=Math.max(0,Math.floor(avail/rowH));
  const shown=rows.slice(0,fit);
  const fs=Math.max(7,Math.min(14,rowH*.72));
  return `<rect width="${o.w}" height="${o.h}" class="k-line" rx="3"/>
    <text x="${pad}" y="${titleH}" class="k-legt" style="font-size:${Math.max(10,titleH*.72)}px">Legend</text>
    <line x1="0" y1="${titleH+5}" x2="${o.w}" y2="${titleH+5}" class="k-stroke"/>
    ${shown.map((r,i)=>{const y=titleH+5+rowH*(i+1)-rowH*.25;
      const named=(r.label||"").trim();
      return `<text x="${pad}" y="${y}" class="k-legn" style="font-size:${fs}px">${esc(r.n||"?")}</text>`
        +`<text x="${pad+Math.max(16,fs*1.7)}" y="${y}" class="${named?"k-legr":"k-legu"}" style="font-size:${fs}px">${esc(named||"not named yet")}</text>`}).join("")}
    ${rows.length>fit?`<text x="${pad}" y="${o.h-6}" class="k-legr" style="font-size:${Math.max(8,fs*.85)}px">+${rows.length-fit} more \u2014 drag the corner down</text>`:""}
    ${!rows.length?`<text x="${pad}" y="${titleH+26}" class="k-legr" style="font-size:11px">Place evidence markers and they are listed here</text>`:""}`;
}
const objAt=id=>{const sk=S.sketches.find(x=>x.id===curSketch);return sk&&(sk.objs||[]).find(o=>o.id===id)};
function dimSVG(o,sk){
  const x2=o.w, y2=o.h;
  const ang=Math.atan2(y2,x2), L=dimLen(o);
  const tick=7, ox=Math.sin(ang)*tick, oy=-Math.cos(ang)*tick;
  const lbl=(o.label&&o.label.trim())||measure(sk,L)||"set the scale";
  const mx=x2/2, my=y2/2;
  const deg=ang*180/Math.PI;
  const flip=Math.abs(deg)>90;
  return `<line x1="0" y1="0" x2="${x2}" y2="${y2}" class="k-dim"/>
    <line x1="${ox}" y1="${oy}" x2="${-ox}" y2="${-oy}" class="k-dim"/>
    <line x1="${x2+ox}" y1="${y2+oy}" x2="${x2-ox}" y2="${y2-oy}" class="k-dim"/>
    <g transform="translate(${mx},${my}) rotate(${flip?deg+180:deg})">
      <rect x="${-lbl.length*3.6-4}" y="-16" width="${lbl.length*7.2+8}" height="14"
        rx="3" class="k-dimbg"/>
      <text x="0" y="-5.5" class="k-dimt" text-anchor="middle">${esc(lbl)}</text>
    </g>`;
}
// labels sit under their object; nudge any that would collide
let LABELDY={};
function layoutLabels(objs){
  const dy={}, placed=[];
  const boxes=(objs||[])
    .filter(o=>o.t!=="text"&&o.label&&String(o.label).trim())
    .map(o=>({o, w:String(o.label).length*7.6+8, h:17}))
    .sort((a,b)=>(a.o.y+a.o.h)-(b.o.y+b.o.h)||a.o.x-b.o.x);
  boxes.forEach(({o,w,h})=>{
    const cx=o.x+o.w/2, base=o.y+o.h+15;
    // require real clearance, not a hairline, so labels never look joined
    const hits=d=>placed.some(p=>
      Math.abs(cx-p.cx)<(w+p.w)/2+4 && Math.abs(base+d-p.y)<h+3);
    // try just below, then step down, then above the object
    const tries=[0,17,34,51,-(o.h+22),-(o.h+39)];
    let d=tries.find(t=>!hits(t));
    if(d==null)d=68;
    dy[o.id]=d;
    placed.push({cx,y:base+d,w,h});
  });
  return dy;
}
function objSVGRaw(o,sel){
  const hs=handleU();
  const skNow=S.sketches.find(x=>x.id===curSketch);
  const inner=o.t==="dim"?dimSVG(o,skNow)
    :o.t==="legend"&&skNow?legendSVG(o,skNow)
    :o.t==="text"
    ? `<text x="0" y="${o.h*.7}" class="k-text" style="font-size:${Math.max(11,o.h*.72)}px">${esc(o.label||"Text")}</text>`
    : (SHAPES[o.t]||SHAPES.rect)(o.w,o.h,o);
  const ldy=LABELDY[o.id]||0;
  const tag=o.t!=="text"&&o.label?`<text x="${o.w/2}" y="${o.h+15+ldy}" class="k-tag"${o.r?` transform="rotate(${-o.r} ${o.w/2} ${o.h+15+ldy})"`:""}>${esc(o.label)}</text>`
    +(Math.abs(ldy)>8?`<line x1="${o.w/2}" y1="${o.h+3}" x2="${o.w/2}" y2="${o.h+6+ldy-(ldy<0?-9:9)}"
        class="k-lead"/>`:"")
    :"";
  const num=(o.t==="marker"&&String(o.n||"").trim())
    ?(()=>{const n=String(o.n).trim(), fit=n.length>2?2/n.length:1;
      return `<text x="${o.w*.50}" y="${o.h*.41}" class="k-num"
        style="font-size:${Math.max(10,o.h*.34*fit)}px">${esc(n)}</text>`})():"";
  // a locked layer is part of the picture: nothing to grab, nothing drawn round it
  const locked=skNow?layerLocked(skNow,o):false;
  const live=sel&&!locked;
  return `<g data-obj="${esc(o.id)}" style="--kc:${inkHex(o.ink)}"
    ${locked?'pointer-events="none"':""}
    transform="translate(${o.x},${o.y}) rotate(${o.r||0} ${o.w/2} ${o.h/2})">
    ${locked?"":`<rect width="${o.w}" height="${o.h}" fill="transparent"/>`}
    ${inner}${num}${tag}
    ${live?`<rect width="${o.w}" height="${o.h}" class="k-sel"/>
      ${o.lockR?"":`<line x1="${o.w/2}" y1="0" x2="${o.w/2}" y2="${-hs*.9}" class="k-rotstem"/>`}
      ${o.lockR?"":`<circle data-rot="${esc(o.id)}" cx="${o.w/2}" cy="${-hs}" r="${hs/2}" class="k-rot"/>`}
      <rect data-handle="${esc(o.id)}" x="${o.w-hs/2}" y="${o.h-hs/2}" width="${hs}" height="${hs}" class="k-handle"/>`:""}
    ${live&&o.t==="poly"?polyHandles(o):""}
  </g>`;
}
const HEADER_H=118;
const hasHeader=sk=>!!((sk.caseNo||"").trim()||(sk.addr||"").trim()||(sk.by||"").trim()
  ||(sk.offence||"").trim()||(sk.prepared||"").trim()||(sk.kind||"").trim());
// a title block: every value labelled, and the dates kept apart
function headerRows(sk){
  return [
    [["Case number", sk.caseNo||"", true],
     ["Offence or incident", sk.offence||""],
     ["Scene", sk.addr||""]],
    [["Scene attended", (sk.when||"").replace("T"," ")],
     ["Sketch prepared", (sk.prepared||"").replace("T"," ")],
     ["Depicts", sk.depicts||""]],
    [["Sketch", (sk.kind?sk.kind+(sk.sheet?" \u2014 ":""):"")+(sk.sheet||"")],
     ["Scale", scaleOf(sk)?("To scale \u2014 "+measure(sk,pageW(sk))+" across"):"Not to scale"],
     ["Prepared by", sk.by||""]]
  ];
}
function headerSVG(sk){
  if(!hasHeader(sk))return "";
  const W=pageW(sk), M=14, H=HEADER_H-M;
  const cols=headerRows(sk);
  const badgeW=132;                      // crest and unit name
  const colW=(W-2*M-badgeW)/3;
  let s=`<g class="skhead">
    <rect x="0" y="0" width="${W}" height="${HEADER_H+4}" fill="#fff"/>
    <rect x="${M}" y="${M-6}" width="${W-2*M}" height="${H}" fill="none" class="tbbox"/>
    <image href="${BADGE}" x="${M+10}" y="${M-1}" width="40" height="34"/>
    <text x="${M+10}" y="${M+50}" class="tbunit">WILLIAMSPORT</text>
    <text x="${M+10}" y="${M+62}" class="tbunit">BUREAU OF POLICE</text>
    <text x="${M+10}" y="${M+74}" class="tbunit">FORENSIC SERVICES</text>
    <line x1="${M+badgeW}" y1="${M-6}" x2="${M+badgeW}" y2="${M-6+H}" class="tbbox"/>`;
  cols.forEach((col,ci)=>{
    const x=M+badgeW+ci*colW+11;
    if(ci)s+=`<line x1="${M+badgeW+ci*colW}" y1="${M-6}" x2="${M+badgeW+ci*colW}" y2="${M-6+H}" class="tbrule"/>`;
    col.forEach(([lab,val,big],ri)=>{
      const y=M+12+ri*30;
      s+=`<text x="${x}" y="${y}" class="tblab">${esc(lab.toUpperCase())}</text>`;
      const t=String(val||"\u2014");
      const max=Math.floor((colW-24)/(big?11:6.4));
      s+=`<text x="${x}" y="${y+(big?19:15)}" class="${big?"tbbig":"tbval"}">${esc(t.length>max?t.slice(0,max-1)+"\u2026":t)}</text>`;
    });
  });
  return s+`</g>`;
}
function bgSVG(sk){
  const b=sk.bg;
  if(!b)return "";
  const src=b.data||(b.imgId?BGMEM[b.imgId]:null);
  if(!src){ if(b.imgId)bgLoad(b.imgId); return "" }
  if(!okImg(src))return "";                        // only an image, and only as an attribute value
  const num=(v,d)=>{const x=toNum(v); return x===null?d:x};
  const br=(b.br==null?1:+b.br), sa=(b.sa==null?1:+b.sa);
  const needs=Math.abs(br-1)>0.01||Math.abs(sa-1)>0.01;
  const fid="bgf_"+(sk.id||"x").replace(/[^a-z0-9]/gi,"");
  const filt=needs?`<filter id="${fid}" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="${sa.toFixed(2)}"/>
      <feComponentTransfer><feFuncR type="linear" slope="${br.toFixed(2)}"/>
        <feFuncG type="linear" slope="${br.toFixed(2)}"/>
        <feFuncB type="linear" slope="${br.toFixed(2)}"/></feComponentTransfer>
    </filter>`:"";
  return `${filt}<image href="${esc(src)}" x="${num(b.x,0)}" y="${num(b.y,0)}"
    width="${num(b.w,0)||pageW(sk)}" height="${num(b.h,0)||pageH(sk)}"
    opacity="${num(b.op,0.55)}" preserveAspectRatio="none"
    ${needs?`filter="url(#${fid})"`:""}/>`;
}
// a printed scale bar, so the reader can measure off the page
function scaleBarSVG(sk){
  const s=scaleOf(sk); if(!s)return "";
  const W=pageW(sk), H=pageH(sk);
  const target=Math.min(180,W*0.22);
  const real=target*unitsPer(sk);
  const nice=[1,2,5,10,20,25,50,100,200,500];
  const step=nice.reduce((a,n)=>Math.abs(n-real)<Math.abs(a-real)?n:a,nice[0]);
  const px=step/unitsPer(sk);
  const x=W-px-26, y=H-26;
  return `<g>
    <line x1="${x}" y1="${y}" x2="${x+px}" y2="${y}" class="k-dim"/>
    <line x1="${x}" y1="${y-5}" x2="${x}" y2="${y+5}" class="k-dim"/>
    <line x1="${x+px}" y1="${y-5}" x2="${x+px}" y2="${y+5}" class="k-dim"/>
    <line x1="${x+px/2}" y1="${y-4}" x2="${x+px/2}" y2="${y+4}" class="k-thin"/>
    <text x="${x+px/2}" y="${y-9}" class="k-dimt" text-anchor="middle">${step} ${esc(s.unit||"ft")}</text>
  </g>`;
}
function creditSVG(sk){
  const b=sk.bg; if(!b||!b.src)return "";
  const c=(b.kind==="map"?"Map drawing \u2014 ":"Aerial imagery from county GIS \u2014 ")+b.src
    +(b.place?". "+b.place:"");
  return `<text x="12" y="${pageH(sk)-8}" class="k-credit">${esc(c)}</text>`;
}
function canvasSVG(sk){
  return `<svg id="skcanvas" viewBox="${zoomBox(sk)}" class="skcanvas">
    <rect width="${pageW(sk)}" height="${pageH(sk)}" fill="#fff"/>
    ${bgSVG(sk)}${gridSVG(sk)}
    ${(LABELDY=layoutLabels(sk.objs),"")}${(sk.objs||[]).map(o=>objSVG(o,o.id===selObj)).join("")}
    ${measSVG(sk)}${polyOverlaySVG()}
    ${scaleBarSVG(sk)}
    ${creditSVG(sk)}
    ${headerSVG(sk)}
  </svg>`;
}
const PEMA_IMG="https://imagery.pasda.psu.edu/arcgis/rest/services/PEMAImagery2021_2023cache/MapServer/export";

/* ---------- finding an address, with or without a connection ----------
   Every address point in Williamsport city (Lycoming County Public Safety) and every street
   crossing (OpenStreetMap), from williamsport-addresses.json beside the page. Searching is
   local: no signal needed, city addresses first, typos forgiven, and "4th and Market" finds
   the corner. The file is rebuilt by fetch_basemap.py in E:\Claude\Projects\Williamsport3D. */
const ADDRWORD={NORTH:"N",SOUTH:"S",EAST:"E",WEST:"W",STREET:"ST",AVENUE:"AVE",ROAD:"RD",DRIVE:"DR",
  LANE:"LN",PLACE:"PL",COURT:"CT",BOULEVARD:"BLVD",TERRACE:"TER",CIRCLE:"CIR",HIGHWAY:"HWY",ALLEY:"ALY",
  EXTENSION:"EXT",PARKWAY:"PKWY",FIRST:"1ST",SECOND:"2ND",THIRD:"3RD",FOURTH:"4TH",FIFTH:"5TH",SIXTH:"6TH",
  SEVENTH:"7TH",EIGHTH:"8TH",NINTH:"9TH",TENTH:"10TH",ELEVENTH:"11TH",TWELFTH:"12TH",MOUNT:"MT"};
const ADDRTYPE=new Set(["ST","AVE","RD","DR","LN","PL","CT","BLVD","TER","CIR","HWY","ALY","EXT","PKWY","WAY"]);
const ADDRDIR=new Set(["N","S","E","W"]);
const addrWords=s=>String(s).toUpperCase().replace(/[.,']/g," ").split(/\s+/).filter(Boolean).map(w=>ADDRWORD[w]||w);
// the name without its direction and type: E CHURCH ST is CHURCH
const addrCore=ws=>ws.filter((w,i)=>!(ws.length>1&&((i===0&&ADDRDIR.has(w))||(i===ws.length-1&&ADDRTYPE.has(w))))).join(" ");
function addrLev(a,b){       // edits to turn one name into the other; two letters swapped count as one
  const d=[...Array(a.length+1)].map((_,i)=>[i,...Array(b.length).fill(0)]);
  for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
let addrIdx=null;
function addrLoad(){
  return addrIdx=addrIdx||fetch("williamsport-addresses.json").then(r=>{if(!r.ok)throw 0;return r.json()})
    .then(d=>({
      a:d.addresses.map(([label,lat,lon])=>{const m=label.match(/^(\d+)\S*\s+(.*)$/), ws=addrWords(m?m[2]:label);
        return {label:label+", WILLIAMSPORT",lat,lon,num:m?+m[1]:null,st:ws.join(" "),core:addrCore(ws)}}),
      x:d.intersections.map(([p,q,lat,lon])=>{const a=addrWords(p), b=addrWords(q);
        return {label:a.join(" ")+" & "+b.join(" ")+", WILLIAMSPORT",lat,lon,a:[a.join(" "),addrCore(a)],b:[b.join(" "),addrCore(b)]}})}))
    .catch(()=>{addrIdx=null;throw new Error("The address list is not on this device yet \u2014 open it once with a connection, "
      +"or use Settings \u203a This device \u203a Download for offline use")});
}
// how well the typed street matches one street: 0 not at all, up to 4 exactly
function addrMatch(qw,st,core){
  const q=qw.join(" "), qc=addrCore(qw);
  if(!qc)return 0;
  if(st===q)return 4;
  if(core===qc)return 3.5;                                  // direction or type left off
  if(core.startsWith(qc)||st.startsWith(q))return 3;        // the start of the name
  const cw=core.split(" ");
  if(qc.split(" ").every(w=>cw.some(c=>c.startsWith(w))))return 2.5;
  if(qc.length>=4&&addrLev(qc,core)<=(qc.length>6?2:1))return 2;   // a typo
  return 0;
}
async function findAddress(q){
  const idx=await addrLoad(), text=String(q).trim();
  const two=text.split(/\s+(?:&|and|at|@)\s+|\s*[&@]\s*/i).filter(Boolean);
  if(two.length===2&&!/^\d+\s/.test(text)){                // two streets: the corner where they cross
    const [p,r]=two.map(addrWords);
    return idx.x.map(x=>({x,sc:Math.max(Math.min(addrMatch(p,...x.a),addrMatch(r,...x.b)),
        Math.min(addrMatch(p,...x.b),addrMatch(r,...x.a)))}))
      .filter(o=>o.sc>0).sort((u,v)=>v.sc-u.sc).slice(0,8).map(({x})=>({label:x.label,lat:x.lat,lon:x.lon}));
  }
  const m=text.match(/^(\d+)\S*\s*(.*)$/), num=m?+m[1]:null, qw=addrWords(m?m[2]:text);
  if(!qw.length)throw new Error("Type a street name, ideally with a number");
  const street=new Map();                                   // score each street once, not every address
  idx.a.forEach(a=>{if(!street.has(a.st))street.set(a.st,addrMatch(qw,a.st,a.core))});
  return idx.a.filter(a=>street.get(a.st)>0)
    .sort((u,v)=>street.get(v.st)-street.get(u.st)
      ||(num==null?0:Math.abs(u.num-num)-Math.abs(v.num-num))||u.num-v.num)
    .slice(0,8).map(a=>({label:a.label,lat:a.lat,lon:a.lon}));
}
// the address search as a control: suggestions while typing, a list from Find, pick(hit) on choosing
function addrSearch(qEl,sugBox,hitsBox,findBtn,pick){
  // suggest as you type, after a short pause so every keystroke does not redraw the list
  let sugT=null, sugSeq=0;
  const showSug=(list)=>{
    sugBox.innerHTML=list.slice(0,6).map((x,i)=>`<button class="sug" data-sug="${i}">${esc(x.label)}</button>`).join("");
    sugBox.querySelectorAll("[data-sug]").forEach(bq=>bq.onclick=()=>{
      const hit=list[+bq.dataset.sug]; qEl.value=hit.label; sugBox.innerHTML=""; pick(hit);
    });
  };
  qEl.oninput=()=>{
    clearTimeout(sugT);
    const q=qEl.value.trim();
    if(q.length<4){showSug([]);return}
    const seq=++sugSeq;
    sugT=setTimeout(async()=>{
      try{ const hits=await findAddress(q); if(seq===sugSeq)showSug(hits) }
      catch(e){ if(seq===sugSeq)showSug([]) }
    },150);
  };
  const say=(t,red)=>{hitsBox.innerHTML=`<p class="hint" style="margin:0 0 10px${red?";color:var(--red)":""}">${t}</p>`};
  findBtn.onclick=async()=>{
    const q=qEl.value.trim(); if(!q)return toast("Type an address");
    say("Searching…");
    try{
      const hits=await findAddress(q);
      if(!hits.length)return say("Nothing matched. Try just the street name.");
      if(hits.length===1){hitsBox.innerHTML="";return pick(hits[0])}
      hitsBox.innerHTML=`<div class="rows" style="margin-bottom:10px">`
        +hits.map((x,i)=>`<button class="row" data-hit="${i}">
          <span><span class="code" style="font-size:14px">${esc(x.label)}</span></span>
          <span class="rt"><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`;
      hitsBox.querySelectorAll("[data-hit]").forEach(btn=>btn.onclick=()=>{hitsBox.innerHTML="";pick(hits[+btn.dataset.hit])});
    }catch(err){ say(esc(err.message),true) }
  };
}
// a square of ground, centred on the point, fetched at a known size so scale is exact
// the cache is finest at about 0.019 m per pixel; asking for more than that adds bytes, not detail
function aerialPx(feet){
  const m=feet*0.3048;
  return Math.max(1024, Math.min(4096, Math.round(m/0.019/64)*64));
}
async function fetchAerial(lat,lon,feet,px){
  const R=6378137, m=feet*0.3048;
  const cx=lon*Math.PI/180*R;
  const cy=Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*R;
  // Web Mercator stretches ground by 1/cos(latitude), about 1.33 here. Ask for the stretched
  // box, or the image covers only three quarters of the ground the scale says it does.
  const half=m/2/Math.cos(lat*Math.PI/180);
  const bbox=[cx-half,cy-half,cx+half,cy+half].join(",");
  const url=PEMA_IMG+"?bbox="+bbox+"&bboxSR=3857&imageSR=3857&size="+px+","+px
    +"&format=jpg&transparent=false&f=image";
  const r=await fetch(url);
  if(!r.ok)throw new Error("Imagery service unreachable");
  const blob=await r.blob();
  if(blob.size<800)throw new Error("No imagery covers that spot");
  const data=await new Promise((res,rej)=>{const fr=new FileReader();
    fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error("Could not read the image"));
    fr.readAsDataURL(blob)});
  return {data,feet};
}
function orthoSheet(sk,src){
  src=src||sk.orthoSrc||"faro";
  const faro=src==="faro";
  openSheet(`<h3>Ortho import</h3>
    <p style="margin:0 0 12px;color:var(--ink2);font-size:14.5px;line-height:1.5">An orthophoto is a
      flat, straight-down view with no perspective, so it is already to scale. Export one and this
      sets the sketch scale from it.</p>
    <div class="filters" style="margin:0 0 14px">
      <button data-osrc="faro" class="${faro?"sel":""}">FARO SCENE</button>
      <button data-osrc="pix4d" class="${faro?"":"sel"}">Pix4D drone</button></div>
    ${faro?`
    <div class="sect" style="margin:4px 2px 6px">In FARO SCENE</div>
    <ol class="steps">
      <li>Register and process the project as normal.</li>
      <li>Place a <b>clipping box</b> around the area you want, looking straight down.</li>
      <li>Run <b>Project Point Cloud</b> first &mdash; the orthophoto is much cleaner for it.
          SCENE LT cannot do this step.</li>
      <li>Open <b>Create Orthophoto</b> and pick your clipping box.</li>
      <li>Choose <b>Metric units</b>. The imperial setting has produced wrongly scaled images.</li>
      <li>Set <b>Pixel/Meter</b>. 100 is the default and usually right; 200 for a small room.
          Finer than the scan's own point spacing just adds gaps, not detail.</li>
      <li>Tick <b>Show scale</b> so a scale bar is burned in as a cross-check.</li>
      <li>Export as <b>PNG</b> or <b>JPG</b> and note the Pixel/Meter number.</li>
    </ol>`:`
    <div class="sect" style="margin:4px 2px 6px">In Pix4D</div>
    <ol class="steps">
      <li>Process calibration, dense point cloud and <b>DSM</b> first. The orthomosaic is built from
          the DSM &mdash; if that is noisy the orthomosaic comes out distorted.</li>
      <li>Draw a <b>processing area</b> or region of interest around the scene, so you get the ground
          you need and not a whole field.</li>
      <li>Under <b>Resolution</b>, note the <b>GSD in cm/pixel</b>. This is the number you need.</li>
      <li>Export the orthomosaic as <b>JPG</b> rather than GeoTIFF &mdash; a .tif will not open here.</li>
      <li>If it only offers GeoTIFF, open it in QGIS and export a JPG at the same resolution.</li>
      <li>Keep it under about 10&nbsp;MB. Drop the resolution if it is larger.</li>
    </ol>
    <div class="unver" style="margin:12px 0 0">Pix4D uses an <b>average</b> GSD across the
      orthomosaic, so distances taken off a drone image are approximate. Ground measurements are
      the ones to rely on for anything that matters.</div>`}
    <div class="sect" style="margin:18px 2px 6px">Here</div>
    <label class="fld"><span>${faro?"Pixel/Meter used in SCENE":"GSD in cm/pixel from Pix4D"}</span>
      <input type="text" id="opm" inputmode="decimal" placeholder="${faro?"100":"1.5"}"
        value="${esc(faro?(sk.bgPPM||"100"):(sk.bgGSD||""))}"></label>
    <label class="fld"><span>The orthophoto</span><input type="file" id="opf" accept="image/*"></label>
    <p class="hint" style="margin:0 0 12px" id="opinfo"></p>
    <button class="btn" id="opgo" style="max-width:none;margin:0">Import</button>
    <button class="btn sec" id="opx" style="max-width:none">Cancel</button>`);
  $("#opx").onclick=closeSheet;
  $$("#sheet [data-osrc]").forEach(bq=>bq.onclick=()=>{
    sk.orthoSrc=bq.dataset.osrc; saveLocal(); orthoSheet(sk,bq.dataset.osrc)});
  const f=$("#opf");
  // metres of ground per image pixel, whichever way the number is expressed
  const perPx=v=>faro ? (v>0?1/v:0) : (v>0?v/100:0);
  const preview=()=>{
    const file=f&&f.files&&f.files[0];
    const v=parseFloat(($("#opm")||{}).value||"");
    const el=$("#opinfo"); if(!el)return;
    if(!(v>0)){el.textContent=faro?"Enter the Pixel/Meter value you used in SCENE."
      :"Enter the GSD in cm/pixel from Pix4D.";return}
    if(!file){el.textContent="Choose the exported image, then press Import.";return}
    const img=new Image(); const u=URL.createObjectURL(file);
    img.onload=()=>{const ft=img.width*perPx(v)*3.28084;
      el.textContent=img.width+" px wide \u2014 "+(Math.round(ft*10)/10)
        +" ft across. Press Import to place it."; URL.revokeObjectURL(u)};
    img.onerror=()=>{el.textContent="That file could not be read as an image. A .tif will not open \u2014 export a JPG.";
      URL.revokeObjectURL(u)};
    img.src=u;
  };
  if(f)f.onchange=preview;
  const pm=$("#opm"); if(pm)pm.oninput=preview;
  preview();
  $("#opgo").onclick=()=>{
    const file=f&&f.files&&f.files[0];
    if(!file)return toast("Choose the exported image first");
    const v=parseFloat(($("#opm")||{}).value||"");
    if(!(v>0))return toast(faro?"Enter the Pixel/Meter value first":"Enter the GSD first");
    if(file.size>10*1024*1024)return toast("That image is over 10 MB \u2014 export it smaller");
    const rd=new FileReader();
    rd.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const availH=pageH(sk)-(hasHeader(sk)?HEADER_H:0);
        let w=pageW(sk), hh=w*img.height/img.width;
        if(hh>availH){hh=availH;w=hh*img.width/img.height}
        bgStore(sk,rd.result,{w:img.width,hh:img.height}).then(imgId=>{
          sk.bg={imgId,x:(pageW(sk)-w)/2,y:(hasHeader(sk)?HEADER_H:0)+(availH-hh)/2,
                 w,h:hh,op:1,place:"",px:img.width,
                 src: faro ? ("FARO orthophoto at "+v+" px/m")
                           : ("Pix4D orthomosaic at "+v+" cm/px GSD, average")};
          if(faro)sk.bgPPM=String(v); else sk.bgGSD=String(v);
          sk.orthoSrc=src;
          const feet=img.width*perPx(v)*3.28084;
          sk.scale={px:w,real:Math.round(feet*100)/100,unit:"ft"};
          saveLocal();closeSheet();renderSketch();
          toast("Scale set \u2014 "+(Math.round(feet*10)/10)+" ft across");
        });
      };
      img.onerror=()=>toast("Could not read that image \u2014 a .tif will not open, export a JPG");
      img.src=rd.result;
    };
    rd.readAsDataURL(file);
  };
}
function bgSheet(sk){
  const b=sk.bg||{};
  const has=!!(b.data||b.imgId);
  let kind=b.kind||"map";
  openSheet(`<h3>Backdrop</h3>
    <p style="margin:0 0 12px;color:var(--ink2);font-size:14.5px;line-height:1.5">Search the address
      to drop in a map drawing or the county aerial photo, already to scale. Or load your own image
      and set the scale by hand. Either way it is stored in the sketch and prints with it.</p>
    ${has&&b.lat!=null&&b.ground?`<div class="sect" style="margin:4px 2px 8px">Map area</div>
    ${b.kind==="map"?`<button class="btn sec" id="bgframe" style="max-width:none;margin:0 0 6px">Move or zoom the map</button>`
    :`<div class="two" style="margin:0 0 6px">
      <button class="btn sec" id="bgless" style="max-width:none;margin:0">See less</button>
      <button class="btn sec" id="bgmore" style="max-width:none;margin:0">See more</button></div>`}
    <p class="hint" id="bgarea" style="margin:0 0 14px">${b.ground} ft across now. What you have
      drawn moves with it, so everything stays on its spot at its true size.</p>`:""}
    <div class="filters" style="margin:0 0 14px">
      <button data-bgkind="map" class="${kind==="map"?"sel":""}">Map drawing</button>
      <button data-bgkind="aerial" class="${kind==="map"?"":"sel"}">Aerial photo</button></div>
    <label class="fld"><span>Search an address</span>
      <input type="text" id="bgq" placeholder="329 Pine St" autocapitalize="words"
        autocomplete="off" value="${esc(sk.addr||"")}"></label>
    <div id="bgsug" class="sugbox"></div>
    <div class="two">
      <label class="fld"><span>Area across</span><select id="bgft">
        <option value="120">120 ft</option><option value="200">200 ft</option>
        <option value="320" selected>320 ft</option><option value="500">500 ft</option>
        <option value="800">800 ft</option></select></label>
      <label class="fld"><span>&nbsp;</span>
        <button class="btn" id="bgfind" style="max-width:none;margin:0">Find</button></label>
    </div>
    <div id="bghits"></div>
    <p class="hint" style="margin:2px 0 12px">Addresses from Lycoming County Public Safety.
      Imagery from PEMA 2021&ndash;2023 via PASDA. Below about 200&nbsp;ft across you are past the
      resolution the imagery holds, so it turns soft &mdash; pick a wider view and zoom the page
      instead. The map drawing is streets and building outlines from OpenStreetMap and Microsoft,
      and stays sharp at any size. After you pick the address it opens on the page: pinch and drag
      it until it is right, then lock it in.</p>
    <div class="sect" style="margin:4px 2px 8px">Or load an image</div>
    <button class="btn" id="bgortho" style="max-width:none;margin:0 0 10px">Ortho import &mdash; from a FARO scan</button>
    <label class="fld"><span>Any other image</span><input type="file" id="bgf" accept="image/*"></label>
    <p class="hint" style="margin:0 0 12px">A plain photo or floor plan comes in without a scale.
      Set one with the Set scale button, or use Ortho import above and it scales itself.</p>
    ${has?`<label class="fld"><span>Fade</span>
      <input type="range" id="bgop" min="15" max="100" value="${Math.round((b.op==null?0.55:b.op)*100)}"></label>
    <div class="two">
      <label class="fld"><span>Brightness</span>
        <input type="range" id="bgbr" min="60" max="220" value="${Math.round((b.br==null?1:b.br)*100)}"></label>
      <label class="fld"><span>Colour</span>
        <input type="range" id="bgsa" min="0" max="150" value="${Math.round((b.sa==null?1:b.sa)*100)}"></label>
    </div>
    <button class="btn sec" id="bgneut" style="max-width:none;margin:0 0 8px">Correct the blue cast</button>
    <div class="sect" style="margin:8px 2px 8px">Size and position</div>
    <label class="fld"><span>Size</span>
      <input type="range" id="bgsize" min="30" max="260" value="100"></label>
    <div class="four" style="margin:0 0 10px">
      <button class="btn sec" data-bgnudge="-1,0" style="max-width:none;margin:0">&#8592;</button>
      <button class="btn sec" data-bgnudge="1,0" style="max-width:none;margin:0">&#8594;</button>
      <button class="btn sec" data-bgnudge="0,-1" style="max-width:none;margin:0">&#8593;</button>
      <button class="btn sec" data-bgnudge="0,1" style="max-width:none;margin:0">&#8595;</button></div>
    <button class="btn sec" id="bgfit" style="max-width:none;margin:0 0 8px">Fit to page</button>
    <button class="btn sec" id="bgcentre" style="max-width:none;margin:0 0 8px">Centre it</button>
    <p class="hint" style="margin:0 0 12px">Resizing keeps the scale correct \u2014 the ground the
      image covers does not change.</p>`:""}
    <button class="btn" id="bgsave" style="max-width:none;margin:0">Done</button>
    ${has?`<button class="btn sec" id="bgdel" style="max-width:none;color:var(--red);border-color:var(--red)">Remove backdrop</button>`:""}
    <button class="btn sec" id="bgx" style="max-width:none">Cancel</button>`);
  $("#bgx").onclick=closeSheet;
  const orth=$("#bgortho"); if(orth)orth.onclick=()=>orthoSheet(sk);
  $$("#sheet [data-bgkind]").forEach(bq=>bq.onclick=()=>{kind=bq.dataset.bgkind;
    $$("#sheet [data-bgkind]").forEach(x=>x.classList.toggle("sel",x===bq))});
  const place=async(hit)=>{
    const feet=+$("#bgft").value||200;
    if(kind==="map")return frameMap(sk,hit,feet);      // framed by hand on the page, then locked in
    $("#bghits").innerHTML=`<p class="hint" style="margin:0 0 10px">Fetching imagery\u2026</p>`;
    try{
      const px=aerialPx(feet);
      const got=await fetchAerial(hit.lat,hit.lon,feet,px);
      if(!sk.addr)sk.addr=hit.label;       // before measuring the page: it brings in the title block
      const hh=hasHeader(sk)?HEADER_H:0;
      const side=Math.min(pageW(sk),pageH(sk)-hh);
      const imgId=await bgStore(sk,got.data,{w:px,hh:px});
      // the image spans a known distance, so the scale follows from it
      setBackdrop(sk,{imgId,x:(pageW(sk)-side)/2,y:hh+(pageH(sk)-hh-side)/2,
        w:side,h:side,op:1,br:1,sa:0.95,kind,src:"PEMA 2021\u20132023 via PASDA",
        place:hit.label||"",lat:hit.lat,lon:hit.lon,ground:feet,px});
      saveLocal();closeSheet();renderSketch();
      toast("Aerial placed, "+feet+" ft across at "+px+" px \u2014 to scale");
    }catch(err){
      $("#bghits").innerHTML=`<p class="hint" style="margin:0 0 10px;color:var(--red)">${esc(err.message)}</p>`;
    }
  };
  addrSearch($("#bgq"),$("#bgsug"),$("#bghits"),$("#bgfind"),place);
  // half again as much ground, or two thirds as much, rounded to 10 ft
  const step=(btn,g)=>{ if(!btn)return; btn.disabled=g===b.ground;
    btn.onclick=async()=>{
      const el=$("#bgarea"); $$("#bgless,#bgmore").forEach(x=>x.disabled=true);
      el.textContent=(b.kind==="map"?"Drawing the map":"Fetching imagery")+"…";
      try{ await reframeBg(sk,g); renderSketch(); bgSheet(sk); toast("Backdrop now "+g+" ft across") }
      catch(err){ el.textContent=err.message; el.style.color="var(--red)";
        $$("#bgless,#bgmore").forEach(x=>x.disabled=false) }
    }};
  const fr=$("#bgframe");
  if(fr)fr.onclick=()=>frameMap(sk,{lat:b.lat,lon:b.lon,label:b.place},b.ground);
  step($("#bgless"),Math.max(60,Math.round(b.ground/1.5/10)*10));
  step($("#bgmore"),Math.min(3200,Math.round(b.ground*1.5/10)*10));
  $("#bgsave").onclick=()=>{closeSheet();renderSketch()};
  const del=$("#bgdel");
  if(del)del.onclick=()=>{
    if(sk.bg&&sk.bg.imgId)photoDel(sk.bg.imgId).catch(()=>{});
    delete sk.bg;saveLocal();closeSheet();renderSketch();toast("Backdrop removed")};
  const fit=$("#bgfit");
  if(fit)fit.onclick=()=>{sk.bg.x=0;sk.bg.y=hasHeader(sk)?HEADER_H:0;
    sk.bg.w=pageW(sk);sk.bg.h=pageH(sk)-(hasHeader(sk)?HEADER_H:0);
    saveLocal();renderSketch();toast("Fitted")};
  // a slider being dragged saves once it stops, like typing
  const bgSoon=()=>{const id=sk.id, bg={...sk.bg}, sc=sk.scale?{...sk.scale}:sk.scale;
    saveSoon(st=>{const s=(st.sketches||[]).find(x=>x.id===id); if(s){s.bg=bg; if(sc)s.scale=sc}})};
  const br=$("#bgbr");
  if(br)br.oninput=()=>{sk.bg.br=(+br.value)/100;bgSoon();renderSketch()};
  const sa=$("#bgsa");
  if(sa)sa.oninput=()=>{sk.bg.sa=(+sa.value)/100;bgSoon();renderSketch()};
  const neut=$("#bgneut");
  if(neut)neut.onclick=()=>{sk.bg.br=1.35;sk.bg.sa=0.35;sk.bg.op=1;
    saveLocal();renderSketch();bgSheet(sk);toast("Corrected")};
  // resizing the image must move the scale with it, or measurements go wrong
  const rescale=(nw)=>{
    const old=sk.bg.w||1;
    const cx=sk.bg.x+sk.bg.w/2, cy=sk.bg.y+sk.bg.h/2;
    const f=nw/old;
    sk.bg.w=nw; sk.bg.h=sk.bg.h*f;
    sk.bg.x=cx-sk.bg.w/2; sk.bg.y=cy-sk.bg.h/2;
    if(sk.scale&&sk.scale.px)sk.scale={...sk.scale, px:sk.scale.px*f};
    bgSoon(); renderSketch();
  };
  let baseW=(sk.bg&&sk.bg.w)||0;
  const sz=$("#bgsize");
  if(sz){ sz.oninput=()=>rescale(Math.max(40,baseW*(+sz.value)/100)); }
  $$("#sheet [data-bgnudge]").forEach(bq=>bq.onclick=()=>{
    const [dx,dy]=bq.dataset.bgnudge.split(",").map(Number);
    const step=Math.max(6,(sk.bg.w||100)*0.04);
    sk.bg.x+=dx*step; sk.bg.y+=dy*step; saveLocal(); renderSketch();
  });
  const ctr=$("#bgcentre");
  if(ctr)ctr.onclick=()=>{
    const top=hasHeader(sk)?HEADER_H:0;
    sk.bg.x=(pageW(sk)-sk.bg.w)/2;
    sk.bg.y=top+((pageH(sk)-top)-sk.bg.h)/2;
    saveLocal(); renderSketch(); toast("Centred")};
  const op=$("#bgop");
  if(op)op.oninput=()=>{sk.bg.op=(+op.value)/100;bgSoon();renderSketch()};
  const f=$("#bgf");
  if(f)f.onchange=()=>{
    const file=f.files&&f.files[0]; if(!file)return;
    if(file.size>6*1024*1024)return toast("That image is over 6 MB \u2014 shrink it first");
    const rd=new FileReader();
    rd.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const availH=pageH(sk)-(hasHeader(sk)?HEADER_H:0);
        let w=pageW(sk), hh=w*img.height/img.width;
        if(hh>availH){hh=availH;w=hh*img.width/img.height}
        bgStore(sk,rd.result,{w:img.width,hh:img.height}).then(imgId=>{
          sk.bg={imgId,x:(pageW(sk)-w)/2,y:(hasHeader(sk)?HEADER_H:0)+(availH-hh)/2,
                 w,h:hh,op:0.55,src:"",place:"",px:img.width};
          const ppm=parseFloat(($("#bgppm")||{}).value||"");
          let msg="Backdrop added \u2014 now set the scale";
          if(ppm>0){
            sk.bgPPM=String(ppm);
            const feet=(img.width/ppm)*3.28084;
            sk.scale={px:w,real:Math.round(feet*100)/100,unit:"ft"};
            msg="Backdrop added \u2014 scale set from "+ppm+" px/m ("
              +(Math.round(feet*10)/10)+" ft across)";
          }else if(scaleOf(sk))msg="Backdrop added";
          saveLocal();closeSheet();renderSketch();
          toast(msg);
        });
      };
      img.onerror=()=>toast("Could not read that image");
      img.src=rd.result;
    };
    rd.readAsDataURL(file);
  };
}
function keepScroll(fn){
  const y=window.scrollY||0;
  const rail=document.querySelector(".skrail"), r=rail?rail.scrollTop:0;
  fn();
  // the panel re-renders after us, so put it back more than once
  const put=()=>{ window.scrollTo(0,y);
    const rl=document.querySelector(".skrail"); if(rl)rl.scrollTop=r };
  put();
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>{put();requestAnimationFrame(put)});
  setTimeout(put,60); setTimeout(put,160);
}
function objsetFloat(sk,sel){
  return (sel&&showSet)?`<div class="objset floatcard">
        <div class="oshead"><b>${esc(SHAPENAME(sel.t))}</b>
          <span class="osr">Rotation <span id="rotval">${sel.r||0}\u00b0</span></span>
          <button class="osclose" id="osx" aria-label="Close">&#215;</button></div>
        ${layersOf(sk).length>1?`<label class="fld"><span>Layer</span>
          <select id="olay">${layersOf(sk).map(L=>
            `<option value="${esc(L.id)}"${(sel.lay||layersOf(sk)[0].id)===L.id?" selected":""}>${esc(L.name)}</option>`).join("")}
          </select></label>`:""}
        <div class="osgrid">
          ${(sel.t==="marker"||sel.t==="photopoint")?`<label class="fld osnum"><span>Number</span>
            <input type="text" id="onum" inputmode="numeric" value="${esc(sel.n||"")}"></label>
            <button class="numnext" data-onext="${esc(sel.id)}">${sel.n?"Renumber":"Next number"}</button>`:""}
          <label class="fld osname"><span>${sel.t==="marker"?"Name it — prints on the sketch and in the legend"
            :sel.t==="legend"?"Name it (not shown on the sketch)":"Name it — prints on the sketch"}</span>
            <input type="text" id="oname" value="${esc(sel.label||"")}"
              placeholder="${sel.t==="marker"?"Spent 9mm casing":"What it is"}"></label>
        </div>
        <div class="inkrow"><span class="inklab">Colour</span>
          ${INKS.map(([k,nm,hex])=>`<button class="ink${(sel.ink||"")===k?" on":""}"
            data-ink="${k}" title="${nm}" aria-label="${nm}"
            style="background:${hex}"></button>`).join("")}</div>
        ${sizeRow(sel,sk)}
        ${sel.t==="photopoint"?`<div class="objbar" style="margin-top:10px">
          <button data-ophoto="${esc(sel.id)}">${sel.photoId?"Change photograph":"Attach photograph"}</button>
          ${sel.photoId?`<button data-ophotox="${esc(sel.id)}">Remove</button>`:""}</div>
          <div id="photoprev"></div>`:""}
        <div class="objbar">
          <button data-orotlock="${esc(sel.id)}"${sel.lockR?' class="on"':""}>${sel.lockR?"Rotation locked":"Lock rotation"}</button>
          ${sel.lockR?"":`<button data-orot="${esc(sel.id)}">Rotate 15&#176;</button>
          <button data-orot0="${esc(sel.id)}">Straighten</button>`}
          <button data-odup="${esc(sel.id)}">Duplicate</button>
          <button data-ofwd="${esc(sel.id)}">Front</button>
          <button data-odel="${esc(sel.id)}" class="danger">Delete</button>
        </div>
        <p class="hint" style="margin:8px 0 0">Drag to move, corner to ${LOCKED.has(sel.t)?"scale":"resize"}, ${sel.lockR?"rotation is locked so it cannot turn by accident.":"the circle above it to rotate. Hold shift while rotating to snap to 15&#176;. Lock rotation keeps a placed object square."}</p>
      </div>`
      :`<p class="hint" style="margin-top:6px">Tap an object to select it. Tap the page to deselect.</p>`;
}

function renderSketch(){
  const sk=S.sketches.find(x=>x.id===curSketch);
  if(!sk){view="active";return renderActive()}
  const repaired=repairSketch(sk);
  if(!UNDO[sk.id])loadUndo(sk);
  if(!S.sketchGuideSeen&&!(sk.objs||[]).length&&!window.__guideHinted){window.__guideHinted=true;setTimeout(()=>toast("New here? Draw \u203a How to sketch a scene"),900)}
  if(repaired){saveLocal();toast("Repaired "+repaired+" damaged value"+(repaired===1?"":"s")+" in this sketch")}
  (sk.objs||[]).forEach(o=>{if(!o.ar&&o.h)o.ar=o.w/o.h});
  $("#title").textContent=sk.caseNo||"Sketch";
  const sel=objAt(selObj);
  const legend=(sk.objs||[]).filter(o=>o.label&&o.t!=="text");
  const __html=`<div id="skhead">
    <button class="back" data-navback="${sk.incidentId&&incidentOf(sk.incidentId)?"incident":"active"}">&#8249; ${
      sk.incidentId&&incidentOf(sk.incidentId)?esc(incidentOf(sk.incidentId).caseNo||"Incident"):"Scenes"}</button>
    ${typeof docTabs==="function"?docTabs("sketch",sk.id):""}
    <div class="cdhead"><h2>${esc(sk.caseNo||"Untitled sketch")}</h2>
      <div class="sub">${esc(sk.addr||"No address")} · ${esc((sk.when||"").replace("T"," "))}${sk.by?" · "+esc(sk.by):""}</div></div></div>
    <div class="skgrid${skFull?" full":""}${skFull&&!skTools?" notools":""}${skRailMin?" railmin":""}"><div class="skmain">
    <div class="editbar" id="skedit">${skFull
      ? `<button data-skfull="0" class="on">Exit full screen</button>
         <button data-skundo="1"${canUndo(sk)?'':' disabled'}>Undo</button>
         <button data-skredo="1"${canRedo(sk)?'':' disabled'}>Redo</button>
         <button data-skgrp="draw">Draw</button>
         <button data-skgrp="view">View</button>
         <button data-sktools="${skTools?0:1}">${skTools?"Hide tools":"Show tools"}</button>`
      : `<button data-skundo="1"${canUndo(sk)?'':' disabled'}>Undo</button>
         <button data-skredo="1"${canRedo(sk)?'':' disabled'}>Redo</button>
         <button data-skgrp="draw">Draw</button>
         <button data-skgrp="view">View</button>
         <button data-skgrp="scene">Setup</button>
         <button data-sksym="1" class="phoneonly">Symbols</button>
         <button data-skfull="1">Full screen</button>
         <button data-skexport="1">Export</button>`}</div>
    <div id="skbars">${caseNag(sk)}${polyBar()}${placeBar()}${measPickBar()}${layerMoveBar()}${inkBar()}${multiBar()}</div><div class="canvaswrap">${canvasSVG(sk)}${zoomBar()}${objsetFloat(sk,sel)}</div>

    <p class="kbdhint">Arrow keys nudge, shift for bigger steps. D duplicates, Delete removes, Escape deselects.</p>
    </div><div class="skrail" id="skrail">
    <button class="railcaret" data-skrailtog="1" aria-label="${skRailMin?"Show the panel":"Collapse the panel"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div class="railbody">
    <div id="skpanel"><p class="hint" style="margin-top:6px">Tap an object to select it. Tap the page to deselect.</p></div>
    <div class="palsearch"><input type="text" id="palq" placeholder="Search symbols"
      value="${esc(palQ||"")}" autocomplete="off" autocapitalize="off">
      ${palQ?`<button id="palqx" aria-label="Clear">&#215;</button>`:""}</div>
    ${palQ?"":favBar()}
    ${palQ?"":`<div class="filters wrap">${PALETTE.map(([c],ix)=>
      `<button data-pal="${ix}" class="${ix===palCat?"sel":""}">${esc(c)}</button>`).join("")}</div>`}
    ${palQ? (()=>{const q=palQ.toLowerCase(); const hits=[];
        PALETTE.forEach(([g,l])=>l.forEach(([t,nm])=>{
          if(nm.toLowerCase().includes(q)||g.toLowerCase().includes(q)||t.includes(q))hits.push([t,nm,g])}));
        return hits.length
          ? `<div class="palette">`+hits.map(([t,nm,g])=>
              `<button data-add="${t}"><span class="pv">${palPreview(t)}</span>
               <span class="pn">${esc(nm)}</span><span class="pg">${esc(g)}</span></button>`).join("")+`</div>`
          : `<p class="hint">Nothing matches that.</p>`})()
      : palCat>=0?`<div class="palette">${PALETTE[palCat][1].map(([t,nm])=>
      `<button data-add="${t}"><span class="pv">${palPreview(t)}</span><span class="pn">${esc(nm)}</span></button>`).join("")}</div>`
      :`<p class="hint" style="margin:0 0 12px">Pick a category above to place something.</p>`}
    <div class="sect">Layers <button class="addlay" id="newlay">+ New layer</button></div>
    ${(()=>{const ls=layersOf(sk);
      return `<div class="layers">`+ls.map(L=>{
        const mine=(sk.objs||[]).map((o,i)=>({o,i}))
          .filter(x=>(x.o.lay||ls[0].id)===L.id).reverse();
        return `<div class="laygrp${curLayer===L.id?" cur":""}">
          <div class="layhead">
            <button class="laypick" data-laysel="${esc(L.id)}">
              <span class="ln2">${esc(L.name)}</span>
              <span class="laycount">${mine.length} object${mine.length===1?"":"s"}${
                curLayer===L.id?" \u00b7 drawing here":""}</span></button>
            <button class="laybig${L.locked?" lockon":""}" data-laylock="${esc(L.id)}"
              aria-label="${L.locked?"Unlock layer":"Lock layer"}">
              <svg viewBox="0 0 24 24" class="lki" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                ${L.locked?`<path d="M8 11V7a4 4 0 0 1 8 0v4"/>`
                          :`<path d="M8 11V7a4 4 0 0 1 7.5-2"/>`}
              </svg></button>
            <button class="laybig" data-laymore="${esc(L.id)}" aria-label="Layer options">&#8943;</button>
          </div>
          ${mine.length?mine.map(({o})=>
            `<div class="lay${o.id===selObj?" on":""}${L.locked?" locked":""}">
              <button class="laypick" data-osel="${esc(o.id)}">
                <span class="lp" style="--kc:${inkUI(o.ink)}">${palPreview(o.t)}</span>
                <span class="ln2">${esc(o.label||SHAPENAME(o.t))}${(o.t==="marker"||o.t==="photopoint")&&o.n?" "+esc(o.n):""}</span>
              </button>
              <button class="laybig" data-omore="${esc(o.id)}" aria-label="Object options">&#8943;</button>
            </div>`).join("")
            :`<p class="hint" style="margin:6px 0 10px 12px">Empty. Tap the name, then add objects.</p>`}
        </div>`}).join("")+`</div>
        <p class="hint">Tap a layer name to draw into it. Top of each list is the front.</p>`})()}
    ${legend.length?`<div class="sect">Legend</div><div class="rows">`+legend.map(o=>
      `<button class="row" data-osel="${esc(o.id)}">
        <span><span class="code">${o.t==="marker"&&o.n?esc(o.n)+" · ":""}${esc(o.label)}</span>
        <span class="desc">${esc(SHAPENAME(o.t))}</span></span>
        <span class="rt"><span class="chev">&#8250;</span></span></button>`).join("")+`</div>`
      :`<p class="hint">Label an object and it appears in the legend.</p>`}
    <div class="actbar" style="grid-template-columns:1fr 1fr">
      <button class="primary" data-skexport="1">Export</button>
      <button data-skdel="1">Delete sketch</button></div>
    </div></div></div>`;
  patchSketchView(__html);
  if(skFull){fitCanvas();
    if(typeof requestAnimationFrame==="function")requestAnimationFrame(fitCanvas)}
}
function palPreview(t){
  if(t==="text")return `<svg viewBox="0 0 46 32" class="pvs" preserveAspectRatio="xMidYMid meet"><text x="23" y="23" class="k-text" style="font-size:17px" text-anchor="middle">Aa</text></svg>`;
  const[w,hh]=DEFSIZE[t]||[40,30];
  const pad=Math.max(3,Math.max(w,hh)*0.06);
  return `<svg viewBox="${-pad} ${-pad} ${w+pad*2} ${hh+pad*2}" class="pvs"
    preserveAspectRatio="xMidYMid meet">${(SHAPES[t]||SHAPES.rect)(w,hh)}</svg>`;
}
// undo history, one stack per sketch
const UNDO={}, REDO={};
const UNDOMAX=40;
const NUDGE={id:null,t:0};      // a run of arrow-key nudges is one undo entry
// The snapshot is the drawn record: the objects, the layers they belong to, the scale their
// measurements are read against, and the page shape. Layers used to be left out, so undoing a
// deleted layer put the objects back pointing at a layer that no longer existed.
function snapOf(sk){ return JSON.stringify({o:sk.objs||[],l:layersOf(sk),s:sk.scale||null,p:!!sk.portrait}) }
function pushUndo(sk){
  if(!sk)return;
  sk.updated=new Date().toISOString();
  (UNDO[sk.id]=UNDO[sk.id]||[]).push(snapOf(sk));
  if(UNDO[sk.id].length>UNDOMAX)UNDO[sk.id].shift();
  persistUndo(sk);
  REDO[sk.id]=[];                      // a new change abandons the redo branch
}
function applySnap(sk,json){
  const d=JSON.parse(json);
  if(Array.isArray(d))sk.objs=d;                 // a snapshot written before layers were covered
  else{
    sk.objs=d.o||[];
    if(Array.isArray(d.l)&&d.l.length)sk.layers=d.l;
    if(d.s)sk.scale=d.s; else delete sk.scale;
    sk.portrait=!!d.p;
  }
  persistUndo(sk);
  if(!sk.objs.some(o=>o.id===selObj))selObj=null;
  if(!layersOf(sk).some(l=>l.id===curLayer))curLayer=null;
  if(multi)multi.ids.forEach(id=>{if(!sk.objs.some(o=>o.id===id))multi.ids.delete(id)});
  NUDGE.id=null;
  saveLocal(); renderSketch();
}
function doUndo(){
  const sk=S.sketches.find(x=>x.id===curSketch); if(!sk)return;
  const st=UNDO[sk.id]; if(!st||!st.length)return toast("Nothing to undo");
  (REDO[sk.id]=REDO[sk.id]||[]).push(snapOf(sk));
  applySnap(sk, st.pop());
}
function doRedo(){
  const sk=S.sketches.find(x=>x.id===curSketch); if(!sk)return;
  const st=REDO[sk.id]; if(!st||!st.length)return toast("Nothing to redo");
  (UNDO[sk.id]=UNDO[sk.id]||[]).push(snapOf(sk));
  applySnap(sk, st.pop());
}
const canUndo=sk=>!!(sk&&UNDO[sk.id]&&UNDO[sk.id].length);
const canRedo=sk=>!!(sk&&REDO[sk.id]&&REDO[sk.id].length);
function addObj(t){
  const sk=S.sketches.find(x=>x.id===curSketch); if(!sk)return;
  const target=targetLayer(sk);
  if(!target)return toast("Every layer is locked — unlock one first");
  pushUndo(sk);
  const[w,hh]=DEFSIZE[t]||[120,80];
  const top=hasHeader(sk)?HEADER_H:0;
  const o={id:newId(),t,lay:target,x:Math.round(pageW(sk)/2-w/2),
    y:Math.round(top+(pageH(sk)-top)/2-hh/2),w,h:hh,r:0,label:"",ar:w/hh};
  if(t==="marker"){o.n=String(nextMarkerNo(sk)); setTimeout(()=>syncMarker(sk,o),0)}
  if(t==="photopoint"){o.n=String(nextPhotoNo(sk)); setTimeout(()=>syncPhoto(sk,o),0)}
  if(t==="text")o.label="Text";
  extraAddDefaults(sk,o,t);
  sk.objs.push(o);selObj=o.id;saveLocal();renderSketch();
}

/* drag and resize */
let drag=null;
function canvasPt(e){
  const svg=document.getElementById("skcanvas"); if(!svg)return null;
  const r=svg.getBoundingClientRect();
  const sk=curSk();
  return {x:ZOOM.x+(e.clientX-r.left)/r.width*pageW(sk)/ZOOM.k, y:ZOOM.y+(e.clientY-r.top)/r.height*pageH(sk)/ZOOM.k};
}
document.addEventListener("pointerdown",e=>{
  const svg=document.getElementById("skcanvas");
  if(!svg||!svg.contains(e.target))return;
  const hEl=e.target.closest("[data-handle]"), gEl=e.target.closest("[data-obj]");
  const p=canvasPt(e); if(!p)return;
  if(extraPointerDown3(e,svg,p)||extraPointerDown2(e,svg,p)||extraPointerDown(e,svg,p))return;
  const rEl=e.target.closest("[data-rot]");
  if(rEl){const o=objAt(rEl.dataset.rot); if(!o)return; if(o.lockR){toast("Rotation is locked");return}
    (()=>{const s=S.sketches.find(x=>x.id===curSketch);if(s&&layerLocked(s,o)){toast("Layer is locked");return}pushUndo(s)})();if((()=>{const s=S.sketches.find(x=>x.id===curSketch);return s&&layerLocked(s,o)})())return;drag={mode:"rot",o,cx:o.x+o.w/2,cy:o.y+o.h/2};
    try{svg.setPointerCapture&&svg.setPointerCapture(e.pointerId)}catch(_){}
    e.preventDefault();return}
  if(hEl){const o=objAt(hEl.dataset.handle); if(!o)return;
    (()=>{const s=S.sketches.find(x=>x.id===curSketch);if(s&&layerLocked(s,o)){toast("Layer is locked");return}pushUndo(s)})();if((()=>{const s=S.sketches.find(x=>x.id===curSketch);return s&&layerLocked(s,o)})())return;drag={mode:"size",o,px:p.x,py:p.y,w:o.w,h:o.h};
    try{svg.setPointerCapture&&svg.setPointerCapture(e.pointerId)}catch(_){}
    e.preventDefault();return}
  if(gEl){const o=objAt(gEl.dataset.obj); if(!o)return;
    if(selObj!==o.id){selObj=o.id;renderSketch()}
    const skD=S.sketches.find(x=>x.id===curSketch);
    if(skD&&layerLocked(skD,o))return toast((layerOf(skD,o)||{}).name+" is locked");
    pushUndo(skD);
    drag={mode:"move",o,px:p.x,py:p.y,x:o.x,y:o.y};
    try{svg.setPointerCapture&&svg.setPointerCapture(e.pointerId)}catch(_){}
    e.preventDefault();return}
  if(selObj){selObj=null;renderSketch()}
},{passive:false});
document.addEventListener("pointermove",e=>{
  if(!drag)return;
  const p=canvasPt(e); if(!p)return;
  const o=drag.o;
  if(extraPointerMove3(e,p,o)||extraPointerMove2(e,p,o)||extraPointerMove(e,p,o))return;
  if(drag.mode==="rot"){
    let a=Math.atan2(p.y-drag.cy,p.x-drag.cx)*180/Math.PI+90;
    a=(a%360+360)%360;
    if(e.shiftKey)a=Math.round(a/15)*15;
    else if(rotSnap){const q=Math.round(a/90)*90; if(Math.abs(a-q)<7)a=q; else {const f=Math.round(a/15)*15; if(Math.abs(a-f)<3)a=f}}
    o.r=Math.round(a);
    const g=document.querySelector(`[data-obj="${o.id}"]`);
    if(g)g.setAttribute("transform",`translate(${o.x},${o.y}) rotate(${o.r} ${o.w/2} ${o.h/2})`);
    const f=$("#rotval"); if(f)f.textContent=o.r+"\u00b0";
    e.preventDefault();return;
  }
  const dx=p.x-drag.px, dy=p.y-drag.py;
  if(drag.mode==="move"){
    const sk0=S.sketches.find(x=>x.id===curSketch);
    const top=sk0&&hasHeader(sk0)?HEADER_H+2:-o.h*.4;
    let nx=drag.x+dx, ny=drag.y+dy;
    if(!e.altKey){ const s=snapEdges(sk0,o,snapVal(nx),snapVal(ny)); nx=s.x; ny=s.y }
    o.x=Math.max(-o.w*.4,Math.min(pageW(sk0)-o.w*.6,nx));
    o.y=Math.max(top,Math.min(pageH(sk0)-o.h*.6,ny));
    if(o.meas&&sk0.showMeas){const mg=document.getElementById("measg"); if(mg)mg.outerHTML=measSVG(sk0,o.id)}
  }else if(o.t==="dim"){
    o.w=drag.w+dx; o.h=drag.h+dy;
    if(e.shiftKey){ if(Math.abs(o.w)>Math.abs(o.h))o.h=0; else o.w=0 }
    if(!e.altKey){ o.w=snapVal(o.w); o.h=snapVal(o.h) }
  }else if(LOCKED.has(o.t)){
    const sw=(drag.w+dx)/drag.w, sh=(drag.h+dy)/drag.h;
    const minS=16/Math.min(drag.w,drag.h);
    const s=Math.max(minS,(sw+sh)/2);
    o.w=drag.w*s; o.h=drag.h*s;
  }else{
    let nw=drag.w+dx, nh=drag.h+dy;
    if(!e.altKey){ nw=snapVal(nw); nh=snapVal(nh) }
    o.w=Math.max(16,nw); o.h=Math.max(16,nh);
  }
  const g=document.querySelector(`[data-obj="${o.id}"]`);
  if(g){
    if(drag.mode==="move")g.setAttribute("transform",
      `translate(${o.x},${o.y}) rotate(${o.r||0} ${o.w/2} ${o.h/2})`);
    else g.outerHTML=objSVG(o,true);
  }
  e.preventDefault();
},{passive:false});
document.addEventListener("pointerup",()=>{ if(!drag)return;
  const o=drag.o;
  if(extraPointerUp3(o)||extraPointerUp(o))return;
  if(drag.mode==="move"&&o.meas)measFromGeometry(curSk(),o);
  o.x=Math.round(o.x);o.y=Math.round(o.y);
  if(drag.mode==="rot"){drag=null;saveLocal();renderSketch();return}
  if(drag.mode==="size"&&LOCKED.has(o.t)){
    const ar=o.ar||(drag.w/drag.h);
    o.w=Math.max(16,Math.round(o.w));
    o.h=Math.max(12,Math.round(o.w/ar));
  }else{o.w=Math.round(o.w);o.h=Math.round(o.h)}
  drag=null;saveLocal();renderSketch();});

function scaleSheet(sk){
  const s=scaleOf(sk)||{px:100,real:10,unit:"ft"};
  openSheet(`<h3>Scale</h3>
    <p style="margin:0 0 14px;color:var(--ink2);font-size:14.5px;line-height:1.5">Draw a dimension
      across something you know the length of, then tell the app what it measures. Everything else
      gets its measurements from that.</p>
    <div class="two">
      <label class="fld"><span>Drawn length</span>
        <input type="text" id="scpx" inputmode="decimal" value="${esc(s.px)}"></label>
      <label class="fld"><span>Real length</span>
        <input type="text" id="screal" inputmode="decimal" value="${esc(s.real)}"></label></div>
    <label class="fld"><span>Units</span><select id="scunit">
      ${["ft","m","in","cm"].map(u=>`<option${u===(s.unit||"ft")?" selected":""}>${u}</option>`).join("")}
    </select></label>
    ${(sk.objs||[]).some(o=>o.t==="dim")?`<button class="btn sec" id="scfrom"
      style="max-width:none;margin:0 0 8px">Use the selected dimension's length</button>`:""}
    <button class="btn" id="scsave" style="max-width:none;margin:0">Save</button>
    ${scaleOf(sk)?`<button class="btn sec" id="scclear" style="max-width:none">Not to scale</button>`:""}
    <button class="btn sec" id="scx" style="max-width:none">Cancel</button>`);
  $("#scx").onclick=closeSheet;
  const from=$("#scfrom");
  if(from)from.onclick=()=>{const o=objAt(selObj);
    if(!o||o.t!=="dim")return toast("Select a dimension first");
    $("#scpx").value=Math.round(dimLen(o))};
  const cl=$("#scclear");
  if(cl)cl.onclick=()=>{pushUndo(sk);delete sk.scale;saveLocal();closeSheet();renderSketch();toast("No longer to scale")};
  $("#scsave").onclick=()=>{
    const unit=$("#scunit").value;
    const px=parseFloat($("#scpx").value), real=parseLen($("#screal").value,unit);
    if(!(px>0))return toast("The drawn length needs a number");
    if(!(real>0))return toast(unit==="ft"?"The real length needs a number, like 12 or 12' 6\"":"The real length needs a number");
    pushUndo(sk);
    sk.scale={px,real,unit};
    // .meas holds real-world tape distances, so a new scale means everything placed by
    // measurement is now drawn in the wrong place. The tape is the record: follow it.
    const moved=resolveMeas(sk);
    saveLocal();closeSheet();renderSketch();
    toast("Scale set"+(moved?" — "+moved+" measured object"+(moved===1?"":"s")+" moved to match the tape":""))};
}
function sketchMetaSheet(sk){
  const now=new Date().toISOString().slice(0,16);
  openSheet(`<h3>Scene details</h3>
    <p class="hint" style="margin:0 0 14px">These fill the title block printed at the top of the sketch.</p>
    <div class="two">
      <label class="fld"><span>Case number</span>
        <input type="text" id="skc" value="${esc(sk.caseNo||"")}"></label>
      <label class="fld"><span>Offence or incident</span>
        <input type="text" id="sko" value="${esc(sk.offence||"")}" placeholder="Death investigation"></label></div>
    <label class="fld"><span>Scene address</span>
      <input type="text" id="ska" value="${esc(sk.addr||"")}"></label>
    <label class="fld"><span>What this sketch depicts</span>
      <input type="text" id="skd" value="${esc(sk.depicts||"")}" placeholder="Ground floor, items 1&ndash;6"></label>
    <div class="two">
      <label class="fld"><span>Scene attended</span>
        <input type="datetime-local" id="skw" value="${esc((sk.when||"").slice(0,16))}"></label>
      <label class="fld"><span>Sketch prepared</span>
        <input type="datetime-local" id="skp" value="${esc((sk.prepared||"").slice(0,16))}"></label></div>
    <div class="two">
      <label class="fld"><span>Prepared by</span>
        <input type="text" id="skb" value="${esc(sk.by||"")}" placeholder="Det. D. Alvarez #417"></label>
      <label class="fld"><span>Sketch number</span>
        <input type="text" id="sks" value="${esc(sk.sheet||"")}" placeholder="1 of 1"></label></div>
    <label class="fld"><span>Kind of sketch</span><select id="skk">
      <option value=""${!sk.kind?" selected":""}>Not stated</option>
      <option value="Rough sketch"${sk.kind==="Rough sketch"?" selected":""}>Rough sketch, drawn at the scene</option>
      <option value="Finished sketch"${sk.kind==="Finished sketch"?" selected":""}>Finished sketch, drawn up from the rough</option></select></label>
    <button class="btn" id="sksave" style="max-width:none;margin:0">Save</button>
    <button class="btn sec" id="skx" style="max-width:none">Cancel</button>`);
  $("#skx").onclick=closeSheet;
  if(!sk.prepared&&$("#skp"))$("#skp").value=now;
  $("#sksave").onclick=()=>{
    const was=hasHeader(sk);
    Object.assign(sk,{caseNo:$("#skc").value.trim(),offence:$("#sko").value.trim(),
      addr:$("#ska").value.trim(),depicts:$("#skd").value.trim(),
      when:$("#skw").value.trim(),prepared:$("#skp").value.trim(),
      by:$("#skb").value.trim(),sheet:$("#sks").value.trim(),kind:$("#skk").value});
    let moved=0;
    if(!was&&hasHeader(sk))(sk.objs||[]).forEach(o=>{
      if(o.y<HEADER_H+2){o.y=HEADER_H+2;moved++}});
    saveLocal();closeSheet();renderSketch();
    toast(moved?"Saved \u2014 "+moved+" object"+(moved===1?"":"s")+" moved clear of the block":"Saved");
    if(!sk.incidentId&&sk.caseNo)offerIncident(sk)};
}
function photoSheet(o){
  openSheet(`<h3>Photograph ${esc(o.n||"")}</h3>
    <p class="hint" style="margin:0 0 14px">A reference copy is stored with the sketch and appears in
      the bundle. The photograph in the case file remains the evidential copy \u2014 the number is
      what ties them together.</p>
    <label class="fld"><span>Photograph number</span>
      <input type="text" id="phn" value="${esc(o.n||"")}" inputmode="numeric"></label>
    <label class="fld"><span>What it shows</span>
      <input type="text" id="phc" value="${esc(o.label||"")}" placeholder="Kitchen, looking north"></label>
    <div class="two" style="margin-bottom:12px">
      <label class="btn sec" style="max-width:none;margin:0;display:block;text-align:center">Take a photograph<input type="file" id="phf" accept="image/*" capture="environment" style="display:none"></label>
      <label class="btn sec" style="max-width:none;margin:0;display:block;text-align:center">Choose from the library<input type="file" id="phf2" accept="image/*" style="display:none"></label></div>
    <div id="phprev" style="margin:0 0 10px"></div>
    <button class="btn" id="phsave" style="max-width:none;margin:0">Save</button>
    ${o.photoId?`<button class="btn sec" id="phdel" style="max-width:none;color:var(--red);border-color:var(--red)">Remove photograph</button>`:""}
    <button class="btn sec" id="phx" style="max-width:none">Cancel</button>`);
  const show=id=>{ if(!id)return;
    photoGet(id).then(d=>{const el=$("#phprev");
      if(el&&d&&okImg(d.data))el.innerHTML=`<img src="${esc(d.data)}" style="width:100%;border-radius:10px">
        <p class="hint" style="margin:6px 0 0">${+d.w||0}&times;${+d.hh||0} reference copy</p>`}).catch(()=>{})};
  show(o.photoId);
  $("#phx").onclick=closeSheet;
  const del=$("#phdel");
  if(del)del.onclick=()=>{ if(o.photoId)photoDel(o.photoId).catch(()=>{});
    delete o.photoId; saveLocal(); closeSheet(); renderSketch(); toast("Photograph removed")};
  [$("#phf"),$("#phf2")].forEach(f=>{
  if(f)f.onchange=async()=>{
    const file=f.files&&f.files[0]; if(!file)return;
    try{
      const shrunk=await shrinkPhoto(file);
      const id=o.photoId||newId();
      await photoPut(id,shrunk);
      o.photoId=id; saveLocal(); show(id);
      toast("Photograph attached");
    }catch(err){ toast(err.message||"Could not attach that") }
  }});
  $("#phsave").onclick=()=>{
    o.n=$("#phn").value.trim(); o.label=$("#phc").value.trim(); syncPhoto(curSk(),o);
    saveLocal(); closeSheet(); renderSketch(); toast("Saved")};
}
function labelSheet(o){
  openSheet(`<h3>Label</h3>
    <label class="fld"><span>What is it</span><input type="text" id="olb" value="${esc(o.label||"")}" placeholder="Kitchen table"></label>
    ${o.t==="marker"?`<label class="fld"><span>Marker number</span><input type="text" id="onm" value="${esc(o.n||"")}"></label>`:""}
    <button class="btn" id="olsv" style="max-width:none;margin:0">Save</button>
    <button class="btn sec" id="olx" style="max-width:none">Cancel</button>`);
  $("#olx").onclick=closeSheet;
  $("#olsv").onclick=()=>{
    const skNow=S.sketches.find(x=>x.id===curSketch);
    pushUndo(skNow);
    o.label=$("#olb").value.trim();
    if(o.t==="marker"&&$("#onm"))o.n=$("#onm").value.trim();
    const synced=syncMarker(skNow,o);
    saveLocal();closeSheet();renderSketch();
    toast(synced?"Saved \u2014 evidence log updated":"Saved")};
}

