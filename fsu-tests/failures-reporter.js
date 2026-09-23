// Ends every run with the name of each test that failed or passed only on a retry, however long
// the output above it, and writes the same list to last-run.txt beside this file. A one-off
// failure can then be traced even when the terminal or a CI log was cut short.
const fs=require("fs"), path=require("path");
const OUT=path.join(__dirname,"last-run.txt");

class FailuresReporter{
  constructor(){ this.bad=new Map(); this.flaky=new Set(); }
  onTestEnd(test,result){
    const name=`${path.relative(__dirname,test.location.file).split(path.sep).join("/")}:${test.location.line} › ${test.titlePath().slice(3).join(" › ")} [${test.parent.project()?.name||""}]`;
    if(result.status===test.expectedStatus){
      if(this.bad.has(name)){ this.bad.delete(name); this.flaky.add(name) }   // passed on a retry
      return;
    }
    if(result.status==="skipped")return;
    const err=(result.errors&&result.errors[0]&&(result.errors[0].message||result.errors[0].value))||result.status;
    this.bad.set(name,String(err).replace(/\u001b\[[0-9;]*m/g,"").split("\n").filter(l=>l.trim()).slice(0,2).join("  ")||result.status);
  }
  onEnd(result){
    const lines=[`${new Date().toISOString()}  ${result.status}`];
    if(this.bad.size){ lines.push(`${this.bad.size} failed:`); for(const [n,e] of this.bad)lines.push(`  ✘ ${n}\n      ${e.trim().slice(0,300)}`) }
    if(this.flaky.size){ lines.push(`${this.flaky.size} passed only on a retry:`); for(const n of this.flaky)lines.push(`  ~ ${n}`) }
    if(!this.bad.size&&!this.flaky.size)lines.push("no failures");
    const text=lines.join("\n");
    try{ fs.writeFileSync(OUT,text+"\n") }catch(_){}
    if(this.bad.size||this.flaky.size)console.log("\n── failures ──\n"+text);
  }
  printsToStdio(){ return true }
}
module.exports=FailuresReporter;
