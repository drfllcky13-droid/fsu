// FSU layout audit. Paste into the browser console with the app open, or run it through
// the checks in fsu-tests at each width. Walks every view at the current window size,
// looking at the top of the page and again at the bottom, and reports:
//   offscreen   an element whose box sits outside the window horizontally, unless it
//               lives in a sideways-scrolling strip where that is the point
//   clipped     content cut off by a hidden overflow (a deliberate ellipsis is ignored)
//   covered     a control on screen with something else on top of its middle, ignoring
//               a sticky header or fixed bar scrolling over it
//   invisible   a control with text that takes up no space but is still in the layout
//   tiny        a control under the tap size, advisory: 44px is the guideline, not a rule
// Hit testing only works on what is actually on screen, so a control is checked at the
// scroll positions the view opens and ends at, which is where a fixed bar would cover it.
(function visible(min){
  min=min===undefined?40:min;
  const out={offscreen:[],clipped:[],covered:[],invisible:[],tiny:[],views:0,width:innerWidth,height:innerHeight};
  const label=e=>{const d=Object.entries(e.dataset).map(([k,v])=>"data-"+k+(v?"="+v:"")).join(" ");
    return ((e.id?"#"+e.id+" ":"")+(e.className&&typeof e.className==="string"?"."+e.className.split(/\s+/)[0]+" ":"")
      +(d?d+" ":"")+(e.textContent||"").trim().replace(/\s+/g," ").slice(0,30)).trim()||e.tagName};
  const hot=e=>/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(e.tagName)||e.getAttribute("role")==="button"||!!Object.keys(e.dataset).length;
  // a sticky header or a fixed tab bar passing over content is how the app scrolls,
  // not a defect, so only a covering element that stays put counts
  const pinned=e=>{for(let p=e;p;p=p.parentElement){const q=getComputedStyle(p).position;if(q==="fixed"||q==="sticky")return true}return false};
  const scrollable=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement)if(/^(auto|scroll)$/.test(getComputedStyle(p).overflowX))return true;return false};
  const setView=v=>{view=v;prevView=null;document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));render();
    if(typeof NAV!=="undefined")NAV.length=0; if(typeof navLast!=="undefined")navLast=null};
  const seen=new Set(), home=view;
  // Every control gets hit tested, palette and all. Nothing here writes to the page between
  // the reads, so the browser lays out once and answers the rest from that: the whole audit
  // is around 120ms on the van and 20ms on the scene, and about 50ms with the symbol
  // palette open on screen (1400 elements in the view). No sampling needed at this size.
  const hits=v=>{
    for(const e of document.querySelectorAll("section.view.on *,#tabs *,#side *")){
      if(!hot(e))continue;
      const cs=getComputedStyle(e); if(cs.display==="none"||cs.visibility==="hidden")continue;
      const r=e.getBoundingClientRect(); if(!r.width||!r.height)continue;
      const x=r.left+r.width/2, y=r.top+r.height/2;
      if(x<0||x>=innerWidth||y<0||y>=innerHeight)continue;
      const top=document.elementFromPoint(x,y), key=v+label(e);
      if(top&&top!==e&&!e.contains(top)&&!top.contains(e)&&!pinned(top)&&!seen.has(key)){
        seen.add(key);
        out.covered.push(v+": "+label(e)+" under "+label(top)+(top.parentElement?" in "+label(top.parentElement):""));
      }
    }
  };
  for(const v of [...document.querySelectorAll("section.view")].map(s=>s.id.slice(2))){
    setView(v); out.views++; window.scrollTo(0,0);
    for(const e of document.querySelectorAll("section.view.on *,#tabs *,#side *")){
      const cs=getComputedStyle(e); if(cs.display==="none"||cs.visibility==="hidden")continue;
      const r=e.getBoundingClientRect(), it=hot(e);
      if(r.width>0&&r.height>0){
        if((r.left<-1||r.right>innerWidth+1)&&!scrollable(e))
          out.offscreen.push(v+": "+label(e)+" ["+Math.round(r.left)+".."+Math.round(r.right)+" of "+innerWidth+"]");
        if(/^(hidden|clip)$/.test(cs.overflowX)&&cs.textOverflow!=="ellipsis"&&e.scrollWidth>e.clientWidth+1)
          out.clipped.push(v+": "+label(e)+" ["+e.scrollWidth+" wide in "+e.clientWidth+"]");
        if(/^(hidden|clip)$/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+1)
          out.clipped.push(v+": "+label(e)+" ["+e.scrollHeight+" tall in "+e.clientHeight+"]");
        if(it&&(r.width<min||r.height<min))out.tiny.push(v+": "+label(e)+" ["+Math.round(r.width)+"x"+Math.round(r.height)+"]");
      }else if(it&&e.offsetParent!==null&&(e.textContent||"").trim())out.invisible.push(v+": "+label(e));
    }
    hits(v);
    window.scrollTo(0,document.body.scrollHeight); hits(v); window.scrollTo(0,0);
  }
  setView(home); window.scrollTo(0,0);
  out.ok=!out.offscreen.length&&!out.clipped.length&&!out.covered.length&&!out.invisible.length;
  console.log(JSON.stringify(out,null,1)); return out;
})(typeof VISMIN!=="undefined"?VISMIN:40);
