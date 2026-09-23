// FSU service worker: network first, cache as the fallback, so the app opens without a connection.
const CACHE="fsu-v1";
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./scenes.html"]).catch(()=>{})).then(()=>self.skipWaiting()));
});
// only this site's own files are kept. Requests to other sites (GitHub's API, the county aerial
// photos) go straight to the network and are never stored: each sync used to leave a copy of
// the inventory here, and each aerial a picture of a scene address, for good.
const ours=u=>{try{return new URL(u).origin===self.location.origin}catch(_){return false}};
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>caches.open(CACHE)).then(c=>c.keys().then(rs=>Promise.all(rs.filter(r=>!ours(r.url)).map(r=>c.delete(r)))))
    .catch(()=>{}).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||!ours(e.request.url))return;
  e.respondWith(
    fetch(e.request).then(r=>{
      if(r&&(r.ok||r.type==="opaque")){const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{})}
      return r;
    }).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==="navigate"?caches.match("./index.html"):undefined)))
  );
});
