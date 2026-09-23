// The third-party files in lib/ are copies of published releases. lib/SOURCES.txt carries a
// SHA-256 for each; a file that was edited, swapped or added without updating the list fails here.
const {test,expect}=require("@playwright/test");
const fs=require("fs"), path=require("path"), crypto=require("crypto");
const LIB=path.join(__dirname,"..","..","lib");

const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(dir,e.name); return e.isDirectory()?walk(p):[path.relative(LIB,p).split(path.sep).join("/")]});
const listed=()=>{
  const out={};
  for(const ln of fs.readFileSync(path.join(LIB,"SOURCES.txt"),"utf8").split("\n")){
    const m=/^([0-9a-f]{64})  (.+)$/.exec(ln); if(m)out[m[2]]=m[1];
  }
  return out;
};

test("every file in lib/ matches the checksum in lib/SOURCES.txt",()=>{
  const sums=listed(), files=walk(LIB).filter(f=>f!=="SOURCES.txt").sort();
  expect(files.length).toBeGreaterThan(0);
  expect(files.filter(f=>!sums[f]),"in lib/ but not in SOURCES.txt").toEqual([]);
  expect(Object.keys(sums).filter(f=>!files.includes(f)),"in SOURCES.txt but not in lib/").toEqual([]);
  const bad=files.filter(f=>crypto.createHash("sha256").update(fs.readFileSync(path.join(LIB,f))).digest("hex")!==sums[f]);
  expect(bad,"changed since SOURCES.txt was written").toEqual([]);
});

test("the PDF libraries are the fixed releases",()=>{
  const head=f=>fs.readFileSync(path.join(LIB,f),"utf8").slice(0,600);
  expect(head("jspdf.umd.min.js")).toMatch(/Version 4\.2\.1 /);
  const src=fs.readFileSync(path.join(LIB,"SOURCES.txt"),"utf8");
  expect(src).toMatch(/^jspdf\.umd\.min\.js\s+4\.2\.1\s/m);
  expect(src).toMatch(/^svg2pdf\.umd\.min\.js\s+2\.8\.1\s/m);
});
