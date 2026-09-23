// Tiny static server for the tests: serves the parent folder, no caching.
const http=require("http"), fs=require("fs"), path=require("path");
const root=path.join(__dirname,".."), port=+(process.argv[2]||8766);
const types={".html":"text/html; charset=utf-8",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css",".pbf":"application/x-protobuf",".json":"application/json",".webmanifest":"application/manifest+json",".png":"image/png",".md":"text/plain"};
// A test can make the network slow, down, or serving a newer page, for its own browser only:
// the service worker fetches for itself, out of reach of Playwright's routing and setOffline, so
// the server has to play the network. A test POSTs its plan to /__net?id=X and sets the cookie
// fsunet=X; the plan applies to that test's requests alone, so tests running side by side are
// unaffected. Plan: {down:true} drops every request; {delay:{"/index.html":8000}} holds a path;
// {body:{"/scenes.html":"..."}} serves that text instead of the file.
const plans={};
http.createServer((q,r)=>{
  const p=decodeURIComponent(q.url.split("?")[0]);
  if(p==="/__net"){ const id=new URL(q.url,"http://x").searchParams.get("id"); let b="";
    q.on("data",c=>b+=c); q.on("end",()=>{ try{plans[id]=JSON.parse(b||"{}")}catch(e){plans[id]={}} r.writeHead(204); r.end() }); return }
  const ck=(q.headers.cookie||"").match(/(?:^|;\s*)fsunet=([^;]+)/), plan=ck&&plans[ck[1]]||{};
  if(plan.down){ q.socket.destroy(); return }
  const fp=path.join(root,p==="/"?"index.html":p);
  const send=()=>{
    if(plan.body&&plan.body[p]!=null){ r.writeHead(200,{"Content-Type":types[path.extname(fp)]||"text/html","Cache-Control":"no-store"}); r.end(plan.body[p]); return }
    fs.readFile(fp,(e,d)=>{ if(e){r.writeHead(404);r.end();return}
      r.writeHead(200,{"Content-Type":types[path.extname(fp)]||"application/octet-stream","Cache-Control":"no-store"}); r.end(d) });
  };
  const wait=plan.delay&&plan.delay[p]; if(wait)setTimeout(send,wait); else send();
}).listen(port,"127.0.0.1",()=>console.log("serving "+root+" on "+port));
