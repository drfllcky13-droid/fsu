// Grades the checks, not the app. Breaks one thing in src/app.js on purpose, rebuilds,
// runs the suite, and sees whether anything notices. A mutant that survives is a piece of
// behaviour nothing is guarding — that is where the next test belongs.
//
//   node mutate.js [how many, default 25] [seed, default 1]
//
// src/app.js is copied aside first and put back in a finally, and again on the next run if
// this one was killed. It never commits anything.
const fs=require("fs"), path=require("path"), {execSync}=require("child_process");
const root=path.join(__dirname,".."), SRC=path.join(root,"src","app.js"), KEEP=path.join(__dirname,".app.js.orig");

// each rule is [what to look for, what to put there instead]; enough to break real logic
// without producing something that cannot parse
const RULES=[
  [/===/g,"!=="],[/!==/g,"==="],[/&&/g,"||"],[/\|\|/g,"&&"],
  [/([^<>=!])>=/g,"$1>"],[/([^<>=!])<=/g,"$1<"],[/([^<>=!-])>([^=])/g,"$1<$2"],
  [/\btrue\b/g,"false"],[/\bfalse\b/g,"true"],
  [/\breturn (?!;|\})/g,"return void "],
  [/\+=/g,"-="],[/\.length\b/g,".length-1"],
];
// SVG path data, the symbol table and the markup templates are strings, not logic:
// mutating a > inside a <span> only proves that broken HTML is broken
const skip=l=>l.length>160||/"M[-\d.]/.test(l)||/scale\(0\./.test(l)||/^\s*\/\//.test(l)
  ||/<\/\w/.test(l)||/[`"']\s*<\w/.test(l)||/<\w+[\s>]/.test(l)||l.includes("class=");

const rng=s=>()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;

function mutants(text,n,rand){
  const lines=text.split("\n"), out=[], tried=new Set();
  for(let guard=0;out.length<n&&guard<n*200;guard++){
    const i=Math.floor(rand()*lines.length), line=lines[i];
    if(!line||skip(line))continue;
    const rule=RULES[Math.floor(rand()*RULES.length)];
    if(!rule[0].test(line))continue;
    const hits=line.match(rule[0])||[];
    const which=Math.floor(rand()*hits.length);
    let seen=-1;
    const changed=line.replace(rule[0],(m,...a)=>{
      seen++; if(seen!==which)return m;
      return typeof rule[1]==="string"?m.replace(rule[0],rule[1]):rule[1];
    });
    if(changed===line)continue;
    const key=i+":"+changed;
    if(tried.has(key))continue;
    tried.add(key);
    out.push({line:i+1,was:line.trim().slice(0,90),now:changed.trim().slice(0,90),lines:lines.map((l,j)=>j===i?changed:l).join("\n")});
  }
  return out;
}

function run(){
  try{
    execSync("node build.js",{cwd:root,stdio:"ignore"});
  }catch(e){ return "build" }               // the mutation did not parse; not a fair test
  try{
    execSync("npx playwright test --project=chromium --reporter=dot "
      +"--grep-invert \"looks the same\"",{cwd:__dirname,stdio:"ignore",timeout:300000});
    return "survived";                       // nothing noticed
  }catch(e){ return "caught" }
}

const N=+(process.argv[2]||25), SEED=+(process.argv[3]||1);
if(fs.existsSync(KEEP))fs.copyFileSync(KEEP,SRC);   // a previous run was killed mid-way
const original=fs.readFileSync(SRC,"utf8");
fs.writeFileSync(KEEP,original);
const list=mutants(original,N,rng(SEED));
const survived=[], broke=[];
try{
  list.forEach((m,i)=>{
    fs.writeFileSync(SRC,m.lines);
    const r=run();
    if(r==="survived")survived.push(m); else if(r==="build")broke.push(m);
    process.stdout.write(`${i+1}/${list.length} line ${m.line} ${r}\n`);
  });
}finally{
  fs.writeFileSync(SRC,original);
  execSync("node build.js",{cwd:root,stdio:"ignore"});
  fs.unlinkSync(KEEP);
}
const fair=list.length-broke.length;
console.log(`\n${fair} mutations that built, ${fair-survived.length} caught, ${survived.length} survived`
  +` (${fair?Math.round(100*(fair-survived.length)/fair):0}% caught)`);
survived.forEach(m=>console.log(`\nsurvived  src/app.js:${m.line}\n  was  ${m.was}\n  now  ${m.now}`));
