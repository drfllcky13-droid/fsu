/* ---------- the map (Scenes only) ----------
   Williamsport's buildings in 3D. Settings › Map opens it for finding a place; the sketch's
   Backdrop › Map drawing uses the same data drawn flat, north up and to scale.
   It fetches everything on first use and the service worker keeps it: MapLibre from jsdelivr
   (v6 ships ES modules only, hence import()), the streets from OpenFreeMap, and
   williamsport-buildings.json beside this page — OpenStreetMap plus Microsoft's footprints,
   with heights, built by fetch_buildings.py in E:\Claude\Projects\Williamsport3D. */
const MAPLIB="https://cdn.jsdelivr.net/npm/maplibre-gl@6.10.0/dist/maplibre-gl";
const MAPSTYLE="https://tiles.openfreemap.org/styles/positron";
const MAPSRC="OpenStreetMap contributors, Microsoft Building Footprints, OpenMapTiles via OpenFreeMap (ODbL)";
const MAPHSRC={tag:"Height from OpenStreetMap",levels:"Height from its floor count in OpenStreetMap",
  ms:"Height estimated by Microsoft from aerial imagery",default:"No height on record, so typical for its type"};
let mapLib=null, mapBld=null, mapView=null, mapPin=null, mapWant=null, mapBusy=false;

function mapLoad(){
  if(!$("#mlcss"))document.head.insertAdjacentHTML("beforeend",`<link id="mlcss" rel="stylesheet" href="${MAPLIB}.css">`);
  return mapLib=mapLib||import(MAPLIB+".mjs")
    .catch(()=>{mapLib=null;throw new Error("The map needs a connection the first time it opens")});
}
function mapData(){
  return mapBld=mapBld||fetch("williamsport-buildings.json").then(r=>{if(!r.ok)throw 0;return r.json()})
    .catch(()=>{mapBld=null;throw new Error("Could not load the buildings \u2014 check the connection")});
}
// drawn over the basemap's own flat footprints, which stay for the rest of the county
function mapBuildings(m,data,flat){
  m.addSource("bld",{type:"geojson",data,attribution:"\u00a9 OpenStreetMap contributors \u00b7 Microsoft Building Footprints"});
  const under=(m.getStyle().layers.find(l=>l.type==="symbol")||{}).id;   // street names stay on top
  if(flat){
    m.addLayer({id:"bld",type:"fill",source:"bld",paint:{"fill-color":"#e6e2dc"}},under);
    m.addLayer({id:"bldline",type:"line",source:"bld",paint:{"line-color":"#55504a","line-width":1.4}},under);
  }else m.addLayer({id:"bld",type:"fill-extrusion",source:"bld",paint:{"fill-extrusion-color":"#cfc9bf",
    "fill-extrusion-height":["get","height"],"fill-extrusion-base":["coalesce",["get","min_height"],0],
    "fill-extrusion-opacity":0.95}},under);
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
    <p class="hint">Drag to move, pinch or scroll to zoom, two fingers or a right-drag to tilt and turn.
      Addresses from Lycoming County Public Safety. Buildings from OpenStreetMap and Microsoft; most
      heights are Microsoft's estimates from aerial imagery, so read them as rough.</p>`;
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
    const m=mapView=new ml.Map({container:box,style:MAPSTYLE,center:[-77.0011,41.2412],
      zoom:15.5,pitch:55,maxPitch:80});
    m.addControl(new ml.NavigationControl({visualizePitch:true}));
    m.on("error",()=>{});   // a tile that fails to load leaves a gap; nothing to report
    m.on("load",()=>mapBuildings(m,data,false));
    m.on("click","bld",e=>{
      const p=e.features[0].properties;
      new ml.Popup().setLngLat(e.lngLat).setHTML(`<b>${esc(p.name||"Building")}</b><br>About `
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
  const m=new ml.Map({container:box,style:MAPSTYLE,center:[lon,lat],zoom:planZoom(lat,feet,css),
    interactive:false,attributionControl:false,fadeDuration:0,pixelRatio:px/css,
    canvasContextAttributes:{preserveDrawingBuffer:true}});
  m.on("error",()=>{});
  try{
    await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error("The map did not finish drawing \u2014 check the connection")),25000);
      m.on("load",()=>{mapBuildings(m,data,true);m.once("idle",()=>{clearTimeout(t);res()})});
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
    const m=mapFrame=new ml.Map({container:holder,style:MAPSTYLE,center:[at.lon,at.lat],
      zoom:planZoom(at.lat,feet,holder.clientWidth),dragRotate:false,pitchWithRotate:false,
      touchPitch:false,maxPitch:0,attributionControl:false});
    m.touchZoomRotate.disableRotation();
    m.on("error",()=>{});
    new ml.Marker({color:"#c62828",scale:.7}).setLngLat([at.lon,at.lat]).addTo(m);
    const across=()=>Math.round(2*Math.PI*6378137*Math.cos(m.getCenter().lat*Math.PI/180)
      *holder.clientWidth/(512*2**m.getZoom())/0.3048);
    const info=()=>{$("#mfinfo").textContent=`About ${across()} ft across. Pinch and drag until it is right. `
      +`The pin marks the address and is not drawn.`};
    m.on("load",()=>{mapBuildings(m,data,true); $("#mfok").disabled=false; info()});
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
