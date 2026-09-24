// Lints the one inline script of each built page (index.html and scenes.html) separately, with
// three rules only: no-undef, no-unused-vars and no-use-before-define. Findings are given as the
// src/ part and line they come from. node lint.js — exits 1 if anything is found.
//
// Both pages are concatenated from shared parts, so two cross-page cases are expected, not bugs:
//  - a top-level name a shared part defines for the other page (unused here, used there);
//  - a name only the other page defines, used here behind `typeof name` on the same line.
// Anything else that has to stay is listed in lint-allow.json with the reason.
const fs=require("fs"), path=require("path");
const {Linter}=require("eslint"), globals=require("globals");
const ROOT=path.join(__dirname,".."), SRC=path.join(ROOT,"src");
const PAGES=["index.html","scenes.html"];

const CONFIG={
  languageOptions:{ecmaVersion:"latest",sourceType:"script",
    // the libraries in lib/, loaded on demand by a <script> the app adds itself
    globals:{...globals.browser,qrcode:"readonly",jsQR:"readonly",JSZip:"readonly"}},
  rules:{
    "no-undef":"error",
    // an unused catch binding (catch(e){}) is how this code says "ignore the failure"
    "no-unused-vars":["error",{caughtErrors:"none"}],
    // functions are hoisted, and a function body that names a later top-level const only runs
    // after the whole script has loaded; what can actually fail is top-level code using a name
    // before its declaration, and that is still checked
    "no-use-before-define":["error",{functions:false,variables:false}]}};

function scriptOf(page){
  const html=fs.readFileSync(path.join(ROOT,page),"utf8");
  const all=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if(all.length!==1)throw new Error(page+" should have exactly one inline script, has "+all.length);
  return all[0][1];
}
// which src part a line of the joined script came from
function locator(code){
  const parts=fs.readdirSync(SRC).filter(f=>f.endsWith(".js")).map(f=>({f,at:code.indexOf(fs.readFileSync(path.join(SRC,f),"utf8"))}))
    .filter(p=>p.at>=0).sort((a,b)=>a.at-b.at);
  const lineAt=i=>code.slice(0,i).split("\n").length;
  const starts=parts.map(p=>({f:p.f,line:lineAt(p.at)}));
  return line=>{let cur=null; for(const s of starts){if(s.line<=line)cur=s; else break}
    return cur?`src/${cur.f}:${line-cur.line+1}`:`line ${line}`};
}
function lintPage(page){
  const code=scriptOf(page), linter=new Linter({configType:"flat"});
  const messages=linter.verify(code,CONFIG,{filename:page+".js"});
  const scope=linter.getSourceCode().scopeManager.globalScope;
  const defined=new Set(scope.variables.filter(v=>v.defs.length).map(v=>v.name));
  const lines=code.split("\n"), where=locator(code);
  return {page,defined,messages:messages.map(m=>({...m,name:(/'([^']+)'/.exec(m.message)||[])[1],
    text:(lines[m.line-1]||"").trim(),src:m.line?where(m.line):""}))};
}

function lint(){
  const allow=JSON.parse(fs.readFileSync(path.join(__dirname,"lint-allow.json"),"utf8")).allow;
  const used=new Set(), res=PAGES.map(lintPage), out=[];
  for(const r of res){
    const other=res.find(x=>x!==r);
    const unusedThere=new Set(other.messages.filter(m=>m.ruleId==="no-unused-vars").map(m=>m.name));
    for(const m of r.messages){
      if(m.fatal){out.push(`${r.page} ${m.src}: ${m.message}`);continue}
      if(m.ruleId==="no-unused-vars"&&m.name&&other.defined.has(m.name)&&!unusedThere.has(m.name))continue;
      if(m.ruleId==="no-undef"&&m.name&&other.defined.has(m.name)&&new RegExp("typeof\\s+"+m.name+"\\b").test(m.text))continue;
      const a=allow.findIndex(x=>x.page===r.page&&x.rule===m.ruleId&&x.name===m.name);
      if(a>=0){used.add(a);continue}
      out.push(`${r.page} ${m.src} ${m.ruleId}: ${m.message}\n    ${m.text.slice(0,120)}`);
    }
  }
  allow.forEach((x,i)=>{ if(!used.has(i))out.push(`lint-allow.json: nothing matches ${x.page} ${x.rule} ${x.name}; remove the entry`) });
  return out;
}
module.exports={lint};
if(require.main===module){
  const out=lint();
  if(out.length){console.log(out.join("\n")+`\n\n${out.length} finding${out.length===1?"":"s"}`);process.exit(1)}
  console.log("lint: index.html and scenes.html clean");
}
