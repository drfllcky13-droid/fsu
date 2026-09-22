/* ---------- the map (Scenes only) ----------
   Williamsport's buildings in 3D. Settings › Map opens it for finding a place; the sketch's
   Backdrop › Map drawing uses the same data drawn flat, north up and to scale.
   Everything is served beside this page, so it works with no signal once the service worker
   has it (Settings › This device › Download for offline use fetches it all at once): MapLibre
   in lib/ (v6 ships ES modules only, hence import()), our own street map in
   williamsport-streets.json, the buildings in williamsport-buildings.json and the addresses in
   williamsport-addresses.json. The data is built by fetch_buildings.py, fetch_basemap.py and
   lidar_heights.py in E:\Claude\Projects\Williamsport3D. */
const MAPLIB="lib/maplibre/maplibre-gl";
const MAPSRC="OpenStreetMap contributors, Microsoft Building Footprints, USGS LiDAR (ODbL)";
const MAPHSRC={lidar:"Height measured from the 2024 USGS LiDAR",tag:"Height from OpenStreetMap",
  levels:"Height from its floor count in OpenStreetMap",ms:"Height estimated by Microsoft from aerial imagery",
  default:"No height on record, so typical for its type"};
let mapLib=null, mapBld=null, mapView=null, mapPin=null, mapWant=null, mapBusy=false;
const MAPGONE="The map is not on this device yet \u2014 open it once with a connection, or use Settings \u203a This device \u203a Download for offline use";

function mapLoad(){
  if(!$("#mlcss"))document.head.insertAdjacentHTML("beforeend",`<link id="mlcss" rel="stylesheet" href="${MAPLIB}.css">`);
  return mapLib=mapLib||import("./"+MAPLIB+".mjs").catch(()=>{mapLib=null;throw new Error(MAPGONE)});
}
// the buildings, and the address points as map labels
function mapData(){
  return mapBld=mapBld||Promise.all([fetch("williamsport-buildings.json").then(r=>{if(!r.ok)throw 0;return r.json()}),addrLoad()])
    .then(([bld,idx])=>({bld,idx,adr:{type:"FeatureCollection",features:idx.a.map(a=>({type:"Feature",
      properties:{n:String(a.num||"")},geometry:{type:"Point",coordinates:[a.lon,a.lat]}}))}}))
    .catch(()=>{mapBld=null;throw new Error(MAPGONE)});
}
/* Our own street map of the Williamsport box. Streets are drawn at about their real width
   (a residential street is 9 m, an alley 4.5 m), which is what a to-scale backdrop needs:
   metres per pixel here is 58,860 / 2^zoom, so the widths double with every zoom level. */
const MAPPATHS=["footway","path","steps","cycleway","pedestrian","track","bridleway","corridor"];
function mapStyle(){
  const wide=(z14,z20)=>["interpolate",["exponential",2],["zoom"],14,z14,20,z20];
  const byClass=(big,mid,res,alley,k)=>["match",["get","c"],
    ["motorway","trunk","primary","motorway_link","trunk_link","primary_link"],big/k,
    ["secondary","tertiary","secondary_link","tertiary_link"],mid/k,
    ["residential","unclassified","living_street","road"],res/k,alley/k];
  const m=(big,mid,res,alley)=>wide(byClass(big,mid,res,alley,3.593),byClass(big,mid,res,alley,0.0561));
  const road=["all",["==",["get","k"],"road"],["!",["in",["get","c"],["literal",MAPPATHS]]]];
  return {version:8,glyphs:"lib/fonts/{fontstack}/{range}.pbf",
    sources:{base:{type:"geojson",data:"williamsport-streets.json",attribution:"\u00a9 OpenStreetMap contributors"}},
    layers:[
      {id:"land",type:"background",paint:{"background-color":"#f2f3f0"}},
      {id:"park",type:"fill",source:"base",filter:["==",["get","k"],"park"],paint:{"fill-color":"#e1ebd6"}},
      {id:"water",type:"fill",source:"base",filter:["==",["get","k"],"water"],paint:{"fill-color":"#bccfda"}},
      {id:"path",type:"line",source:"base",filter:["all",["==",["get","k"],"road"],["in",["get","c"],["literal",MAPPATHS]]],
        paint:{"line-color":"#bdbab3","line-width":wide(1.2/3.593,1.2/0.0561),"line-dasharray":[2,1.5]}},
      {id:"rail",type:"line",source:"base",filter:["==",["get","k"],"rail"],
        paint:{"line-color":"#9d9a94","line-width":wide(1.5/3.593,1.5/0.0561),"line-dasharray":[4,2]}},
      {id:"casing",type:"line",source:"base",filter:road,layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":"#c3bfb7","line-width":m(14.5,12.5,10.5,6)}},
      {id:"road",type:"line",source:"base",filter:road,layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":"#ffffff","line-width":m(13,11,9,4.5)}},
      {id:"road-name",type:"symbol",source:"base",filter:["all",["==",["get","k"],"road"],["has","n"]],
        layout:{"symbol-placement":"line","text-field":["get","n"],"text-font":["Noto Sans Regular"],
          "text-size":["interpolate",["linear"],["zoom"],14,9,20,15],"text-max-angle":35},
        paint:{"text-color":"#454545","text-halo-color":"#ffffff","text-halo-width":1.4}}]};
}
// the buildings under the street names, and house numbers on top once you are close
function mapLayers(m,d,flat){
  m.addSource("bld",{type:"geojson",data:d.bld,attribution:"\u00a9 OpenStreetMap contributors \u00b7 Microsoft Building Footprints \u00b7 USGS LiDAR"});
  if(flat){
    m.addLayer({id:"bld",type:"fill",source:"bld",paint:{"fill-color":"#e6e2dc"}},"road-name");
    m.addLayer({id:"bldline",type:"line",source:"bld",paint:{"line-color":"#55504a","line-width":1.4}},"road-name");
  }else m.addLayer({id:"bld",type:"fill-extrusion",source:"bld",paint:{"fill-extrusion-color":"#cfc9bf",
    "fill-extrusion-height":["get","height"],"fill-extrusion-base":["coalesce",["get","min_height"],0],
    "fill-extrusion-opacity":0.95}},"road-name");
  m.addSource("adr",{type:"geojson",data:d.adr});
  m.addLayer({id:"adr",type:"symbol",source:"adr",minzoom:17.5,layout:{"text-field":["get","n"],
    "text-font":["Noto Sans Regular"],"text-size":11},
    paint:{"text-color":"#6b645a","text-halo-color":"#f2f3f0","text-halo-width":1.2}});
}
// the county addresses that fall inside a building's outline
function addrsIn(idx,g){
  const ring=g.type==="Polygon"?g.coordinates[0]:g.coordinates[0][0];
  const xs=ring.map(p=>p[0]), ys=ring.map(p=>p[1]);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const inside=(x,y)=>{let hit=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>y)!==(yj>y)&&x<xi+(y-yi)*(xj-xi)/(yj-yi))hit=!hit} return hit};
  return idx.a.filter(a=>a.lon>=x0&&a.lon<=x1&&a.lat>=y0&&a.lat<=y1&&inside(a.lon,a.lat)).map(a=>a.label);
}

function renderMap(){
  $("#title").textContent="Map";
  const v=$("#v-map");
  if(v.querySelector("#mapbox")&&(mapView||mapBusy)){if(mapView)mapView.resize();return}
  const inc=(S.incidents||[]).find(i=>i.id===curInc);
  v.innerHTML=`<button class="back" data-navback="data">&#8249; Settings</button>
    <div class="mapfind"><input type="text" id="mapq" placeholder="329 Pine St" autocapitalize="words"
      autocomplete="off" aria-label="Address" value="${esc((inc&&inc.addr)||"")}">
      <button class="btn" id="mapgo">Find</button></div>
    <div id="mapsug" class="sugbox"></div><div id="maphits"></div>
    <div id="mapbox"><p class="hint" style="padding:14px">Loading the map\u2026</p></div>
    <p class="hint">Drag to move, pinch or scroll to zoom, two fingers or a right-drag to tilt and turn. Tap a
      building for its address and height. Addresses from Lycoming County Public Safety; buildings from
      OpenStreetMap and Microsoft. Heights inside the city are measured from the 2024 USGS LiDAR; the few it
      could not see, and everything outside the city, are estimates.</p>`;
  addrSearch($("#mapq"),$("#mapsug"),$("#maphits"),$("#mapgo"),mapFly);
  // start the heavy part only once this view is really showing, not while something
  // walks every view in one go, as the render sweep does
  mapBusy=true;
  setTimeout(()=>{if(view==="map")mapBoot();else mapBusy=false});
}
async function mapBoot(){
  const box=$("#mapbox");
  try{
    const [ml,data]=await Promise.all([mapLoad(),mapData()]);
    box.innerHTML="";
    const m=mapView=new ml.Map({container:box,style:mapStyle(),center:[-77.0011,41.2412],
      zoom:15.5,pitch:55,maxPitch:80});
    m.addControl(new ml.NavigationControl({visualizePitch:true}));
    m.on("error",()=>{});   // a tile that fails to load leaves a gap; nothing to report
    m.on("load",()=>mapLayers(m,data,false));
    m.on("click","bld",e=>{
      const p=e.features[0].properties, at=addrsIn(data.idx,e.features[0].geometry);
      new ml.Popup().setLngLat(e.lngLat).setHTML(`<b>${esc(at[0]||p.name||"Building")}</b>`
        +`${at.length>1?" and "+(at.length-1)+" more":""}${p.name&&at.length?"<br>"+esc(p.name):""}<br>About `
        +`${Math.round(p.height*3.281)} ft tall${p.levels?", "+esc(p.levels)+" floors":""}<br>`
        +`<span style="color:#666">${MAPHSRC[p.height_source]||""}</span>`).addTo(m)});
    mapPin=new ml.Marker({color:"#c62828"});
    if(mapWant)mapFly(mapWant);
  }catch(err){
    box.innerHTML=`<p class="hint" style="padding:14px;color:var(--red)">${esc(err.message)}</p>`;
  }finally{mapBusy=false}
}
function mapFly(hit){
  mapWant=hit;
  if(!mapView)return;
  mapView.flyTo({center:[hit.lon,hit.lat],zoom:18,pitch:55});
  mapPin.setLngLat([hit.lon,hit.lat]).addTo(mapView);
}

/* MapLibre's world is 512 x 2^zoom pixels round, so a pixel covers
   2πR·cos(lat) / (512·2^zoom) metres. This is the zoom that fits `feet` of ground into `px`. */
const planZoom=(lat,feet,px)=>Math.log2(2*Math.PI*6378137*Math.cos(lat*Math.PI/180)*px/(512*feet*0.3048));
// a flat, north-up drawing of the streets and building outlines, `feet` of ground across `px`
// pixels (and `py` down), so the sketch scale follows from it the same way it does for the aerial
async function fetchPlan(lat,lon,feet,px,py){
  const [ml,data]=await Promise.all([mapLoad(),mapData()]);
  // laid out at about the size the sketch shows it, so street names read at a normal size,
  // and the pixel ratio makes up the rest of `px`
  const css=768, box=document.createElement("div");
  box.style.cssText=`position:fixed;top:0;left:${-css-50}px;width:${css}px;height:${Math.round(css*(py||px)/px)}px`;
  document.body.appendChild(box);
  const m=new ml.Map({container:box,style:mapStyle(),center:[lon,lat],zoom:planZoom(lat,feet,css),
    interactive:false,attributionControl:false,fadeDuration:0,pixelRatio:px/css,
    canvasContextAttributes:{preserveDrawingBuffer:true}});
  m.on("error",()=>{});
  try{
    await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error("The map did not finish drawing \u2014 check the connection")),25000);
      m.on("load",()=>{mapLayers(m,data,true);m.once("idle",()=>{clearTimeout(t);res()})});
    });
    return {data:m.getCanvas().toDataURL("image/png"),feet};
  }finally{m.remove();box.remove()}
}

/* Frame the map drawing by hand, on the sketch itself: a live, flat, north-up map laid exactly
   over the part of the page the backdrop fills. Pinch or scroll to zoom and drag to move; Lock
   it in then draws that view to scale as the backdrop. The page is set to Fit first so the whole
   area is on screen, and the frame covers the rest of the screen until it is locked or cancelled. */
let mapFrame=null;
async function frameMap(sk,at,feet){
  closeSheet();
  if(!sk.addr&&at.label){sk.addr=at.label;saveLocal();renderSketch()}   // the title block shows now, not after
  zoomTo(1);
  const svg=$("#skcanvas"); if(!svg)return;
  const top=hasHeader(sk)?HEADER_H:0, W=pageW(sk), H=pageH(sk);
  const el=document.createElement("div"); el.className="mapframe";
  el.innerHTML=`<div class="mfbox"><div class="mfmap"></div><div class="mfbar">
    <span id="mfinfo">Loading the map\u2026</span>
    <button class="btn sec" id="mfx">Cancel</button><button class="btn" id="mfok" disabled>Lock it in</button></div></div>`;
  document.body.appendChild(el);
  const box=el.querySelector(".mfbox");
  const fit=()=>{ const r=($("#skcanvas")||svg).getBoundingClientRect(), u=Math.min(r.width/W,r.height/H);
    Object.assign(box.style,{left:r.left+(r.width-W*u)/2+"px",top:r.top+(r.height-H*u)/2+top*u+"px",
      width:W*u+"px",height:(H-top)*u+"px"}) };
  fit(); addEventListener("resize",fit);
  const done=()=>{removeEventListener("resize",fit); if(mapFrame)mapFrame.remove(); mapFrame=null; el.remove()};
  $("#mfx").onclick=done;
  try{
    const [ml,data]=await Promise.all([mapLoad(),mapData()]);
    const holder=el.querySelector(".mfmap");
    const m=mapFrame=new ml.Map({container:holder,style:mapStyle(),center:[at.lon,at.lat],
      zoom:planZoom(at.lat,feet,holder.clientWidth),dragRotate:false,pitchWithRotate:false,
      touchPitch:false,maxPitch:0,attributionControl:false});
    m.touchZoomRotate.disableRotation();
    m.on("error",()=>{});
    new ml.Marker({color:"#c62828",scale:.7}).setLngLat([at.lon,at.lat]).addTo(m);
    const across=()=>Math.round(2*Math.PI*6378137*Math.cos(m.getCenter().lat*Math.PI/180)
      *holder.clientWidth/(512*2**m.getZoom())/0.3048);
    const info=()=>{$("#mfinfo").textContent=`About ${across()} ft across. Pinch and drag until it is right. `
      +`The pin marks the address and is not drawn.`};
    m.on("load",()=>{mapLayers(m,data,true); $("#mfok").disabled=false; info()});
    m.on("move",info);
    $("#mfok").onclick=async()=>{
      const c=m.getCenter(), feet=across();
      $("#mfok").disabled=true; $("#mfinfo").textContent="Drawing the map\u2026";
      try{ await lockMap(sk,c.lat,c.lng,feet,at.label); done(); renderSketch();
        toast("Map locked in, "+feet+" ft across \u2014 to scale") }
      catch(err){ $("#mfinfo").textContent=err.message; $("#mfok").disabled=false }
    };
  }catch(err){ $("#mfinfo").textContent=err.message }
}
// the view the frame was left on, drawn to scale across the page under the title block
async function lockMap(sk,lat,lon,feet,label){
  const top=hasHeader(sk)?HEADER_H:0, w=pageW(sk), h=pageH(sk)-top, px=2048, py=Math.round(2048*h/w);
  const got=await fetchPlan(lat,lon,feet,px,py);
  const imgId=await bgStore(sk,got.data,{w:px,hh:py});
  setBackdrop(sk,{imgId,x:0,y:top,w,h,op:1,br:1,sa:1,kind:"map",src:MAPSRC,place:label||"",lat,lon,ground:feet,px});
  saveLocal();
}
