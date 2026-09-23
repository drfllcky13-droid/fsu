// FSU service worker. Only this site's own files are handled and kept; requests to other sites
// (GitHub's API, the county aerial) go straight to the network and are never stored.
//
// Each request waits up to NET_WAIT for the network. If the network is slower than that, or not
// there at all, the answer comes from the cache and the network's answer, when it arrives,
// refreshes the cache behind it. A page answered from the cache whose fresh copy turns out to be
// different is told (message {fsu:"updated"}), and offers a reload. With nothing cached for a
// navigation, each app falls back to its own page: Scenes to scenes.html, FSU to index.html.
//
// CACHE is set here and nowhere else: build.js copies it into both pages as FSU_CACHE.
const CACHE="fsu-v1";
const NET_WAIT=3000;
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./scenes.html"]).catch(()=>{})).then(()=>self.skipWaiting()));
});
const ours=u=>{try{return new URL(u).origin===self.location.origin}catch(_){return false}};
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>caches.open(CACHE)).then(c=>c.keys().then(rs=>Promise.all(rs.filter(r=>!ours(r.url)).map(r=>c.delete(r)))))
    .catch(()=>{}).then(()=>self.clients.claim()));
});
// the page a navigation belongs to
const pageOf=u=>/\/scenes\.html$/.test(new URL(u).pathname)?"./scenes.html":"./index.html";
async function tellUpdated(served,fresh){
  try{
    const [a,b]=await Promise.all([served.text(),fresh.text()]);
    if(a===b)return;
    const all=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    all.forEach(c=>c.postMessage({fsu:"updated"}));
  }catch(_){}
}
async function answer(e){
  const req=e.request, nav=req.mode==="navigate", cache=await caches.open(CACHE);
  const cached=async()=>(await cache.match(req,{ignoreSearch:nav}))||(nav?await cache.match(pageOf(req.url)):undefined);
  const net=fetch(req).then(async r=>{ if(r&&r.ok)await cache.put(req,r.clone()); return r });
  let timer;
  const first=await Promise.race([net.catch(()=>null),new Promise(res=>{timer=setTimeout(()=>res(null),NET_WAIT)})]);
  clearTimeout(timer);
  if(first&&first.ok)return first;                    // the network answered in time
  const hit=await cached();
  if(hit){
    // answered from the cache; the network's answer still lands in it, and a page that has
    // changed says so
    if(!first&&nav){const copy=hit.clone();
      e.waitUntil(net.then(r=>r&&r.ok?tellUpdated(copy,r.clone()):null).catch(()=>{}))}
    else if(!first)e.waitUntil(net.catch(()=>{}));
    return hit;
  }
  if(first)return first;                              // an error from the server, nothing better
  return net.catch(()=>Response.error());             // nothing cached: wait for the network after all
}
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||!ours(e.request.url))return;
  e.respondWith(answer(e));
});
