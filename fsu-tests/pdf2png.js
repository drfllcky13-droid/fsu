// Renders every page of a PDF to PNG through pdf.js in headless Chromium, for looking at exports.
// node pdf2png.js <file.pdf> [scale]
// pdf.js comes from vendor/pdfjs/ beside this file, served to the page under a made-up address,
// so nothing is fetched from the network.
const {chromium}=require("@playwright/test");
const fs=require("fs"), path=require("path");
(async()=>{
  const file=path.resolve(process.argv[2]), scale=+(process.argv[3]||1.4);
  const b64=fs.readFileSync(file).toString("base64");
  const b=await chromium.launch(); const page=await b.newPage();
  const VENDOR=path.join(__dirname,"vendor","pdfjs");
  await page.route("http://pdfjs.local/**",r=>{
    const name=path.basename(new URL(r.request().url()).pathname);
    if(name==="index.html")return r.fulfill({contentType:"text/html",body:`<script src="pdf.min.js"></script>`});
    if(!/^pdf(\.worker)?\.min\.js$/.test(name))return r.fulfill({status:404,body:""});
    r.fulfill({contentType:"text/javascript",body:fs.readFileSync(path.join(VENDOR,name))});
  });
  await page.goto("http://pdfjs.local/index.html");
  await page.waitForFunction(()=>window.pdfjsLib);
  const pngs=await page.evaluate(async({b64,scale})=>{
    pdfjsLib.GlobalWorkerOptions.workerSrc="http://pdfjs.local/pdf.worker.min.js";
    const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    const pdf=await pdfjsLib.getDocument({data:bytes}).promise; const out=[];
    for(let i=1;i<=pdf.numPages;i++){ const pg=await pdf.getPage(i); const vp=pg.getViewport({scale});
      const c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height;
      await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise; out.push(c.toDataURL("image/png")) }
    return out;
  },{b64,scale});
  const base=file.replace(/\.pdf$/i,"");
  pngs.forEach((d,i)=>fs.writeFileSync(base+"-p"+(i+1)+".png",Buffer.from(d.split(",")[1],"base64")));
  console.log(pngs.length+" pages → "+base+"-p*.png");
  await b.close();
})().catch(e=>{console.error("FAIL",e.message);process.exit(1)});
