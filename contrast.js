// FSU contrast audit. Paste into the browser console with the app open, or run it through
// the checks in fsu-tests in both colour schemes. For every piece of text in every view it
// works out the WCAG ratio against the nearest opaque background behind it and lists what
// falls under AA: 4.5 for body text, 3 for large text (24px, or 18.66px bold).
// It reports, it never fails a run: the fix is a colour decision, not a code one.
// Backgrounds drawn as a gradient or an image are not measurable this way, so a finding on
// one of those is worth eyeballing before acting on it.
(function contrast(){
  const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b};
  const rgb=s=>{const m=(s||"").match(/[\d.]+/g);return m?m.slice(0,3).map(Number).concat(m[3]===undefined?1:+m[3]):null};
  const bgOf=e=>{for(let p=e;p;p=p.parentElement){const c=rgb(getComputedStyle(p).backgroundColor);if(c&&c[3]>0.5)return c}return [255,255,255]};
  const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+0.05)/(y+0.05)};
  const setView=v=>{view=v;prevView=null;document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));render();
    if(typeof NAV!=="undefined")NAV.length=0; if(typeof navLast!=="undefined")navLast=null};
  const out={under:[],worst:null,checked:0,views:0}, home=view;
  for(const v of [...document.querySelectorAll("section.view")].map(s=>s.id.slice(2))){
    setView(v); out.views++;
    for(const e of document.querySelectorAll("section.view.on *")){
      if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
      const cs=getComputedStyle(e); if(cs.display==="none"||cs.visibility==="hidden")continue;
      const fg=rgb(cs.color); if(!fg)continue;
      out.checked++;
      const px=parseFloat(cs.fontSize), bold=+cs.fontWeight>=700;
      const need=(px>=24||(px>=18.66&&bold))?3:4.5, r=ratio(fg,bgOf(e));
      if(!out.worst||r<out.worst.r)out.worst={r,where:v,text:(e.textContent||"").trim().slice(0,30)};
      if(r<need)out.under.push(v+" | "+r.toFixed(2)+" needs "+need+" | "+Math.round(px)+"px"+(bold?" bold":"")
        +" "+cs.color+" on rgb("+bgOf(e).slice(0,3).join(", ")+") | "+(e.textContent||"").trim().replace(/\s+/g," ").slice(0,34));
    }
  }
  setView(home);
  out.under=[...new Set(out.under)];
  console.log(JSON.stringify(out,null,1)); return out;
})();
