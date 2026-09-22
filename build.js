// Builds the two pages from the parts in src/. Run `node build.js` after editing anything
// in src/, or `node build.js --check` (CI) to fail if either page is out of date.
//
// Two jobs, two pages, one record. index.html is the van: what is carried, where it lives,
// what needs restocking. scenes.html is the scene: incidents, the forms that go with them and
// the sketch. They are the same site, so they are the same storage — nothing is copied between
// them and there is nothing to sync. src/pages.js owns which view belongs where.
const fs=require("fs"),path=require("path");

// everything both pages need: the record, the furniture, incidents, case packages, sync
const SHARED=["data-van.js","core.js","chrome.js","pages.js","incidents.js","case-package.js",
  "demo.js","sync.js","nav.js","views-van.js","views-forms.js","views-items.js","events.js",
  "ext-van.js","ext-tabs.js","ext-reports.js"];

const TARGETS={
  "index.html":["head.html","app.css","body-van.html","van.js",...SHARED,"init.js","tail.html"],
  "scenes.html":["head-scenes.html","app.css","body-scenes.html","scenes.js",...SHARED,
    "pdf.js","pdf-sketch.js","sketch-objects.js","sketch-canvas.js","map.js",
    "ext-sketch-1.js","ext-sketch-2.js","ext-sketch-3.js","sketch-controls.js",
    "init-scenes.js","tail.html"],
};

const build=name=>TARGETS[name].map(f=>fs.readFileSync(path.join(__dirname,"src",f),"utf8")).join("");

if(process.argv.includes("--check")){
  let bad=0;
  for(const name in TARGETS){
    const out=build(name), target=path.join(__dirname,name);
    const cur=fs.existsSync(target)?fs.readFileSync(target,"utf8"):"";
    if(cur!==out){console.error(name+" does not match src/. Run: node build.js");bad++}
    else console.log(name+" matches src/ ("+out.length+" chars)");
  }
  process.exit(bad?1:0);
}else{
  for(const name in TARGETS){
    const out=build(name);
    fs.writeFileSync(path.join(__dirname,name),out);
    console.log("built "+name+" ("+out.length+" chars) from "+TARGETS[name].length+" parts");
  }
}
