/* ---------- pdf ---------- */
let jsPDFlib=null;
function loadPDF(){
  if(jsPDFlib)return Promise.resolve(jsPDFlib);
  return new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>{jsPDFlib=(window.jspdf||{}).jsPDF;
      jsPDFlib?res(jsPDFlib):rej(new Error("PDF library loaded oddly"))};
    s.onerror=()=>rej(new Error("Couldn't load the PDF tool. Do one export on wifi and it stays cached."));
    document.head.appendChild(s);
  });
}
// one packet: cover, then the documents in a fixed order, numbered straight through
const BUNDLEORDER=["report","entrylog","evidence","sketch","photolog"];
const BUNDLE_PHOTO_INDEX=false;   // the photograph log carries the pictures now
async function bundleIncident(inc){
  let JsPDF; try{ JsPDF=await loadPDF() }catch(e){ return toast(e.message) }
  const items=[], gaps=[];
  BUNDLEORDER.forEach(key=>{
    const st=planState(inc,key); if(!st)return;
    if(!st.docs.length){ gaps.push(st.d.label); return }
    st.docs.forEach(d=>items.push({key,label:st.d.label,...d}));
  });
  docsFor(inc.id).forEach(d=>{
    if(!items.some(x=>x.id===d.id))items.push({key:"extra",label:d.type,...d});
  });
  if(!items.length)return toast("Nothing to bundle yet");

  const doc=new JsPDF({unit:"pt",format:"letter"});
  const contents=[];
  for(const it of items){
    doc.addPage("letter", it.kind==="sketch"&&!it.rec.portrait ? "landscape" : "portrait");
    const from=doc.internal.getNumberOfPages();
    if(it.kind==="fill") await exportFill(it.rec,doc);
    else                 await exportSketch(it.rec,doc);
    contents.push({label:it.label, from, to:doc.internal.getNumberOfPages()});
  }
  // photographs referenced by the sketches, listed after them
  const shots=[];
  for(const it of items){
    if(!BUNDLE_PHOTO_INDEX||it.kind!=="sketch")continue;
    for(const o of (it.rec.objs||[])){
      if(o.t!=="photopoint")continue;
      let img=null;
      if(o.photoId){ try{ img=await photoGet(o.photoId) }catch(e){} }
      shots.push({n:o.n||"", label:o.label||"", img});
    }
  }
  if(BUNDLE_PHOTO_INDEX&&shots.length){
    shots.sort((a,b)=>(parseInt(a.n,10)||0)-(parseInt(b.n,10)||0));
    doc.addPage("letter","portrait");
    const from=doc.internal.getNumberOfPages();
    const PW=doc.internal.pageSize.getWidth(), PH=doc.internal.pageSize.getHeight(), PM=54;
    let py=PM+8;
    doc.setFont("helvetica","bold");doc.setFontSize(15);doc.setTextColor(0);
    doc.text("Photograph index",PM,py); py+=16;
    doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(110);
    doc.text("Reference copies. The photographs in the case file are the evidential copies.",PM,py);
    py+=18; doc.setDrawColor(30);doc.setLineWidth(1);doc.line(PM,py,PW-PM,py); py+=16;
    const cw=(PW-2*PM-16)/2;
    let col=0, rowTop=py;
    for(const s of shots){
      const x=PM+col*(cw+16);
      if(rowTop+cw*0.80>PH-PM-20){ doc.addPage("letter","portrait"); rowTop=PM; col=0 }
      const ix=PM+col*(cw+16);
      let bottom=rowTop;
      if(s.img){
        const ih=Math.min(cw*s.img.hh/s.img.w, cw*0.78);
        try{ doc.addImage(s.img.data,"JPEG",ix,rowTop,cw,ih,undefined,"FAST") }catch(e){}
        doc.setDrawColor(170);doc.setLineWidth(.6);doc.rect(ix,rowTop,cw,ih);
        bottom=rowTop+ih;
      }else{
        doc.setDrawColor(190);doc.setLineWidth(.6);doc.rect(ix,rowTop,cw,cw*0.55);
        doc.setFontSize(8.5);doc.setTextColor(150);
        doc.text("No reference copy attached",ix+cw/2,rowTop+cw*0.30,{align:"center"});
        bottom=rowTop+cw*0.55;
      }
      doc.setFont("helvetica","bold");doc.setFontSize(9.5);doc.setTextColor(0);
      doc.text("Photograph "+(s.n||"\u2014"),ix,bottom+14);
      doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(60);
      doc.text(doc.splitTextToSize(s.label||"No caption",cw).slice(0,2),ix,bottom+27);
      if(col===1){ rowTop=bottom+48; col=0 } else col=1;
    }
    contents.push({label:"Photograph index",from,to:doc.internal.getNumberOfPages()});
  }
  const total=doc.internal.getNumberOfPages();
  const ref="B-"+(inc.caseNo||"NOCASE").replace(/[^A-Za-z0-9]+/g,"")+"-"
    +new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"
    +String(Date.now()).slice(-4);

  // cover
  doc.setPage(1);
  const W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight(), M=64;
  let y=M+10;
  try{ doc.addImage(BADGE,"PNG",M,y,58,50,undefined,"FAST") }catch(e){}
  doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(20);
  ["WILLIAMSPORT BUREAU OF POLICE","FORENSIC SERVICES UNIT"].forEach((t,i)=>
    doc.text(t,M+72,y+20+i*13));
  y+=76;
  doc.setDrawColor(20);doc.setLineWidth(1.4);doc.line(M,y,W-M,y); y+=34;
  doc.setFontSize(22);doc.text("Scene documentation",M,y); y+=30;
  doc.setFontSize(28);doc.text(inc.caseNo||"No case number",M,y); y+=34;
  doc.setFont("helvetica","normal");doc.setFontSize(11.5);doc.setTextColor(40);
  [["Offence or incident",inc.offence],["Scene",inc.addr],
   ["Incident opened",(inc.opened||"").slice(0,16).replace("T"," ")],
   ["Bundle reference",ref],
   ["Generated",new Date().toISOString().slice(0,16).replace("T"," ")],
   ["Total pages",String(total)]].forEach(([k,v])=>{
    doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(110);
    doc.text(String(k).toUpperCase(),M,y);
    doc.setFont("helvetica","normal");doc.setFontSize(11.5);doc.setTextColor(0);
    doc.text(String(v||"\u2014"),M+130,y); y+=21;
  });
  y+=14;
  doc.setFont("helvetica","bold");doc.setFontSize(11);doc.text("Contents",M,y);y+=6;
  doc.setLineWidth(.8);doc.setDrawColor(60);doc.line(M,y,W-M,y);y+=18;
  doc.setFont("helvetica","normal");doc.setFontSize(11);
  contents.forEach(c=>{
    doc.text(c.label,M,y);
    doc.text(c.from===c.to?("page "+c.from):("pages "+c.from+"\u2013"+c.to),W-M,y,{align:"right"});
    y+=18;
  });
  if(gaps.length){
    y+=12;
    doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(150,40,40);
    doc.text("Not included",M,y);y+=16;
    doc.setFont("helvetica","normal");doc.setFontSize(10.5);
    gaps.forEach(g=>{doc.text(g+" \u2014 not prepared",M,y);y+=15});
    doc.setTextColor(0);
  }
  doc.setFontSize(8.5);doc.setTextColor(120);
  doc.text("This bundle is a copy assembled from the unit's records. The case file remains the record.",
    M,H-M,{maxWidth:W-2*M});

  // running header and continuous numbering on every page
  for(let i=1;i<=total;i++){
    doc.setPage(i);
    const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight();
    doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(140);
    if(i>1)doc.text((inc.caseNo||"No case number")+"  \u00b7  "+ref, 40, 26);
    doc.text("Page "+i+" of "+total, pw-40, ph-20, {align:"right"});
    doc.setTextColor(0);
  }

  const name=(inc.caseNo||"incident").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+"-bundle.pdf";
  const blob=doc.output("blob");
  try{
    const file=new File([blob],name,{type:"application/pdf"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:(inc.caseNo||"Incident")+" bundle"});
      return toast("Bundle sent");
    }
  }catch(e){ if(e&&e.name==="AbortError")return; }
  const u=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
  toast("Bundle downloaded");
}
// the photograph log prints each row with a small copy of the photograph from its photo point
async function photoThumbs(r){
  const out={}; if(!r.incidentId)return out;
  for(const s of (S.sketches||[]).filter(x=>x.incidentId===r.incidentId)){
    for(const o of (s.objs||[])){
      if(o.t!=="photopoint"||!o.photoId||!String(o.n||"").trim())continue;
      try{ const img=await photoGet(o.photoId); if(img)out[String(o.n).trim()]=img }catch(e){}
    }
  }
  return out;
}
function photoRowsPDF(doc,rows,cols,thumbs,ctx){
  const {M,W,need}=ctx; const TW=240, TH=180, GAP=14;
  rows.forEach(row=>{
    need(TH+18); let y=ctx.getY(); const top=y;
    const n=String(row[cols[0]]||"").trim(), img=thumbs[n];
    if(img){
      const ih=Math.min(TH,TW*img.hh/img.w), iw=Math.min(TW,TH*img.w/img.hh);
      try{ doc.addImage(img.data,"JPEG",M,top,iw,ih,undefined,"FAST") }catch(e){}
      doc.setDrawColor(170);doc.setLineWidth(.6);doc.rect(M,top,iw,ih);
    }else{
      doc.setDrawColor(190);doc.setLineWidth(.6);doc.rect(M,top,TW,TH);
      doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(150);
      doc.text("No copy attached",M+TW/2,top+TH/2+3,{align:"center"});
    }
    const tx=M+TW+GAP, tw=W-M-tx;
    doc.setFont("helvetica","bold");doc.setFontSize(9.5);doc.setTextColor(0);
    const meta=[n?"Photograph "+n:"Photograph",row["Facing"]?"facing "+row["Facing"]:"",row["Time"]?row["Time"]:""].filter(Boolean).join("  \u00b7  ");
    doc.text(meta,tx,top+11);
    doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(30);
    const lines=doc.splitTextToSize(String(row["What it shows"]||"\u2014"),tw);
    doc.text(lines,tx,top+25);
    const extra=cols.filter(c=>!["Facing","Time","What it shows"].includes(c)&&c!==cols[0]&&String(row[c]||"").trim())
      .map(c=>c+": "+row[c]).join("  \u00b7  ");
    let bottom=top+25+lines.length*11;
    if(extra){doc.setFontSize(8.5);doc.setTextColor(110);doc.text(doc.splitTextToSize(extra,tw),tx,bottom+2);bottom+=11}
    y=Math.max(top+TH,bottom)+GAP;
    doc.setDrawColor(225);doc.setLineWidth(.5);doc.line(M,y-6,W-M,y-6);
    ctx.setY(y);
  });
  ctx.setY(ctx.getY()+4);
}
async function exportFill(r,shared){
  const f=S.forms.find(x=>x.id===r.formId)||{fields:[]};
  let JsPDF; try{ JsPDF=await loadPDF() }catch(e){ return toast(e.message) }
  const doc=shared||new JsPDF({unit:"pt",format:"letter"});
  const M=54, W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight();
  let y=M;
  const page=()=>{ if(shared)return;      // the bundle numbers its own pages
    doc.setFontSize(8);doc.setTextColor(120);
    doc.text("FSU "+APP_VERSION+"  ·  Captured "+new Date().toISOString().slice(0,16).replace("T"," ")+"  ·  page "+doc.internal.getNumberOfPages(),M,H-28);
    doc.setTextColor(0)};
  const need=n=>{if(y+n>H-56){page();doc.addPage();y=M}};
  // department badge, top right of the header block
  const BW=54, BH=BW*163/190;
  try{ doc.addImage(BADGE,"PNG",W-M-BW,y-6,BW,BH,undefined,"FAST") }catch(e){}
  doc.setFont("helvetica","bold");doc.setFontSize(16);
  doc.text(String(r.formName),M,y+8);
  doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(60);
  doc.text("Williamsport Bureau of Police",M,y+22);
  doc.setFontSize(9);doc.setTextColor(120);
  doc.text([r.rev?"Revision "+r.rev:"",r.cat||""].filter(Boolean).join("  ·  "),M,y+34);
  doc.text("Started "+r.started.slice(0,16).replace("T"," "),M,y+45);
  y=Math.max(y+52,y-6+BH+8);
  doc.setTextColor(0);doc.setDrawColor(30);doc.setLineWidth(1);
  doc.line(M,y,W-M,y);y+=20;
  const thumbs=r.formName==="Photograph log"?await photoThumbs(r):null;
  (f.fields||[]).forEach(x=>{
    const v=r.values[x.id];
    if(x.type==="table"){
      const rows=(Array.isArray(v)?v:[]).filter(row=>Object.values(row||{}).some(s=>String(s||"").trim()));
      const cols=x.cols||[];
      need(60);doc.setFont("helvetica","bold");doc.setFontSize(9);
      doc.text(String(x.label),M,y);y+=12;
      if(thumbs){ photoRowsPDF(doc,rows,cols,thumbs,{M,W,need,getY:()=>y,setY:v=>{y=v}}); return }

      // columns sized to what they actually hold
      const avail=W-2*M;
      const weigh=c=>{const longest=Math.max(String(c).length,
        ...rows.map(r=>String((r||{})[c]||"").length),1);
        return Math.min(Math.max(longest,4),46)};
      const PADX=6, PADY=6, LH=11;
      // never narrower than its heading, nor than the longest unbreakable value
      doc.setFont("helvetica","bold");doc.setFontSize(8);
      const headW=cols.map(c=>doc.getTextWidth(String(c))+PADX*2+2);
      doc.setFont("helvetica","normal");doc.setFontSize(9);
      const wordW=cols.map(c=>{
        let m=0;
        rows.forEach(r=>String((r||{})[c]||"").split(/\s+/).forEach(w=>{
          m=Math.max(m,doc.getTextWidth(w))}));
        return Math.min(m+PADX*2+2,120);
      });
      const hMin=cols.map((c,i)=>Math.max(headW[i],wordW[i]));
      const raw=cols.map(weigh), tot=raw.reduce((a,n)=>a+n,0)||1;
      let pre=cols.map((c,i)=>Math.max(hMin[i],avail*raw[i]/tot));
      const over=pre.reduce((a,n)=>a+n,0)-avail;
      if(over>0){                                  // trim the slack from the roomiest columns
        const slack=pre.map((n,i)=>Math.max(0,n-hMin[i]));
        const st=slack.reduce((a,n)=>a+n,0)||1;
        pre=pre.map((n,i)=>n-over*slack[i]/st);
      }else{
        const sc=avail/pre.reduce((a,n)=>a+n,0);
        pre=pre.map(n=>n*sc);
      }
      const wArr=pre;
      const xAt=i=>M+wArr.slice(0,i).reduce((a,n)=>a+n,0);
      const hCells=cols.map((c,i)=>doc.splitTextToSize(String(c),wArr[i]-PADX*2));
      const HDR=Math.max(1,...hCells.map(a=>a.length))*10+9;
      const head=()=>{
        doc.setFillColor(237);doc.setDrawColor(55);doc.setLineWidth(.8);
        doc.rect(M,y,avail,HDR,"FD");
        doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(20);
        cols.forEach((c,i)=>{
          if(i){doc.setLineWidth(.8);doc.line(xAt(i),y,xAt(i),y+HDR)}
          doc.text(hCells[i],xAt(i)+PADX,y+13)});
        y+=HDR;doc.setTextColor(0);doc.setFont("helvetica","normal");doc.setFontSize(9);
      };
      head();
      (rows.length?rows:[{}]).forEach(row=>{
        const cells=cols.map((c,i)=>doc.splitTextToSize(String(row[c]||""),wArr[i]-PADX*2));
        const lineCount=Math.max(1,...cells.map(a=>a.length));
        const rh=lineCount*LH+PADY*2;
        if(y+rh>H-M-26){doc.addPage();y=M;head()}
        doc.setDrawColor(120);doc.setLineWidth(.5);
        doc.rect(M,y,avail,rh);                        // box around the whole row
        cols.forEach((c,i)=>{
          if(i)doc.line(xAt(i),y,xAt(i),y+rh);         // divider between columns
          doc.text(cells[i],xAt(i)+PADX,y+PADY+8);     // text inset, clear of every line
        });
        y+=rh;
      });
      y+=14;return;
    }
    const val=x.type==="check"?(v?"Yes":"No"):String(v||"");
    // wrap at the same size the text is drawn at, or it overruns the margin
    doc.setFont("helvetica","normal");doc.setFontSize(10);
    const paras=String(val||"—").split(/\n{2,}/);
    const blocks=paras.map(t=>doc.splitTextToSize(t,W-2*M));
    const total=blocks.reduce((a,b)=>a+b.length,0)+(blocks.length-1);
    need(20+Math.min(total,4)*12);
    doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(90);
    doc.text(String(x.label).toUpperCase(),M,y);y+=12;
    doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(0);
    blocks.forEach((lines,bi)=>{
      lines.forEach(ln=>{                       // a long narrative can cross a page
        if(y>H-M-30){page();doc.addPage();y=M;
          doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(0)}
        doc.text(ln,M,y);y+=12;
      });
      if(bi<blocks.length-1)y+=6;               // gap between paragraphs
    });
    y+=10;
  });
  if(shared)return doc;                       // the bundle handles paging and saving
  page();
  const safe=String(r.formName).replace(/[^a-z0-9]+/gi,"-").toLowerCase();
  const name=safe+"-"+new Date().toISOString().slice(0,10)+".pdf";
  const blob=doc.output("blob");
  try{
    const file=new File([blob],name,{type:"application/pdf"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:r.formName});
      return afterExport(r);
    }
  }catch(e){ if(e&&e.name==="AbortError")return; }
  const u=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
  afterExport(r);
}
async function exportSketch(sk,shared){
  let JsPDF; try{ JsPDF=await loadPDF() }catch(e){ return toast(e.message) }
  const portrait=!!sk.portrait;
  const doc=shared||new JsPDF({unit:"pt",format:(EXPORTOPT.paper||"letter"),orientation:portrait?"portrait":"landscape"});
  const M=40, W=doc.internal.pageSize.getWidth(), H=doc.internal.pageSize.getHeight();
  let y=M;

  // title block, matching the one drawn on the canvas
  const BX=M, BY=y-6, BW=W-2*M, BH=88;
  doc.setDrawColor(20);doc.setLineWidth(1.4);
  doc.rect(BX,BY,BW,BH);
  const badgeW=112;
  try{ doc.addImage(BADGE,"PNG",BX+10,BY+7,34,29,undefined,"FAST") }catch(e){}
  doc.setFont("helvetica","bold");doc.setFontSize(6.2);doc.setTextColor(20);
  ["WILLIAMSPORT","BUREAU OF POLICE","FORENSIC SERVICES"].forEach((t,i)=>
    doc.text(t,BX+10,BY+50+i*9));
  doc.setLineWidth(1.4);doc.line(BX+badgeW,BY,BX+badgeW,BY+BH);
  const colW=(BW-badgeW)/3;
  const rows=[
    [["Case number",sk.caseNo||"",true],["Offence or incident",sk.offence||""],["Scene",sk.addr||""]],
    [["Scene attended",(sk.when||"").replace("T"," ")],
     ["Sketch prepared",(sk.prepared||"").replace("T"," ")],["Depicts",sk.depicts||""]],
    [["Sketch",(sk.kind?sk.kind+(sk.sheet?" - ":""):"")+(sk.sheet||"")],
     ["Scale",scaleOf(sk)?("To scale - "+measure(sk,pageW(sk)).replace(/\u2032/g,"'").replace(/\u2033/g,'"')+" across"):"Not to scale"],
     ["Prepared by",sk.by||""]]
  ];
  rows.forEach((col,ci)=>{
    const cx=BX+badgeW+ci*colW;
    if(ci){doc.setLineWidth(.5);doc.setDrawColor(150);doc.line(cx,BY,cx,BY+BH)}
    col.forEach(([lab,val,big],ri)=>{
      const ty=BY+16+ri*27;
      doc.setFont("helvetica","bold");doc.setFontSize(5.8);doc.setTextColor(110);
      doc.text(String(lab).toUpperCase(),cx+9,ty);
      doc.setTextColor(0);
      if(big){doc.setFont("helvetica","bold");doc.setFontSize(13)}
      else{doc.setFont("helvetica","normal");doc.setFontSize(8.6)}
      const txt=doc.splitTextToSize(String(val||"\u2014"),colW-18)[0]||"\u2014";
      doc.text(txt,cx+9,ty+(big?13:11));
    });
  });
  doc.setDrawColor(20);
  y=BY+BH+16;

  // crop to what is actually drawn, so the sketch fills the page
  const objs=sk.objs||[];
  const PAD=45;
  const xs=[...objs.map(o=>o.x),...objs.map(o=>o.x+o.w)];
  const ys=[...objs.map(o=>o.y),...objs.map(o=>o.y+o.h)];
  if(sk.bg&&(sk.bg.data||sk.bg.imgId)){xs.push(sk.bg.x,sk.bg.x+sk.bg.w); ys.push(sk.bg.y,sk.bg.y+sk.bg.h)}
  if(scaleOf(sk)){xs.push(pageW(sk)-20); ys.push(pageH(sk)-14)}
  if(sk.bg&&sk.bg.src){xs.push(6); ys.push(pageH(sk)-4)}
  let bx=Math.min(...xs)-PAD, by=Math.min(...ys)-PAD;
  let bw=Math.max(...xs)+PAD-bx, bh=Math.max(...ys)+PAD-by;
  bx=Math.max(0,bx); by=Math.max(0,by);
  bw=Math.min(bw,pageW(sk)-bx); bh=Math.min(bh,pageH(sk)-by);
  if(sk.bg&&sk.bg.imgId&&!BGMEM[sk.bg.imgId]){ await bgData(sk) }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(bw*2)}" height="${Math.round(bh*2)}"
      viewBox="${bx} ${by} ${bw} ${bh}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#fff"/>
      ${bgSVG(sk)}
      ${(LABELDY=layoutLabels(objs),"")}${objs.map(o=>objSVG(o,false)).join("")}
      ${measSVG(sk)}
      ${scaleBarSVG(sk)}</svg>`;
  const vbW=bw, vbH=bh;
  const styled=svg.replace("</svg>",`<style>
      .k-line{fill:none;stroke:var(--kc,#111);stroke-width:2}
      .k-fill,.k-solid{fill:var(--kc,#111)}
      .k-stroke{stroke:var(--kc,#111);stroke-width:1.6;fill:none}
      .k-thin{stroke:var(--kc,#111);stroke-width:1;fill:none}
      .k-thick{stroke:var(--kc,#111);stroke-width:3.4;fill:none;stroke-linecap:round}
      .k-dash{stroke:var(--kc,#111);stroke-width:2;fill:none;stroke-dasharray:8 6}
      .k-text,.k-tag{fill:var(--kc,#111);font-family:sans-serif;
        paint-order:stroke fill;stroke:#fff;stroke-width:3.2px;stroke-linejoin:round}
      .k-num{fill:#111;font-family:sans-serif;font-weight:800}
      .k-pnum{fill:#111;font-family:sans-serif;font-size:11px;font-weight:700}
      .k-legt,.k-legn,.k-legr{fill:var(--kc,#111);font-family:sans-serif}
      .k-legu{fill:#888;font-family:sans-serif;font-style:italic}
      .k-credit{fill:#555;font-family:sans-serif;font-size:9.5px}
      .tbbox{stroke:#111;stroke-width:1.6;fill:none}
      .tbrule{stroke:#999;stroke-width:.8}
      .tbunit{font-family:sans-serif;font-size:7.6px;font-weight:700;letter-spacing:.03em;fill:#111}
      .tblab{font-family:sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.07em;fill:#666}
      .tbval{font-family:sans-serif;font-size:11.5px;fill:#111}
      .tbbig{font-family:sans-serif;font-size:17px;font-weight:700;fill:#111}
      .k-lead{stroke:var(--kc,#111);stroke-width:1;opacity:.55}
      .k-dim{stroke:var(--kc,#111);stroke-width:1.6;fill:none}
      .k-dimbg{fill:#fff;stroke:var(--kc,#111);stroke-width:.8}
      .k-dimt{fill:var(--kc,#111);font-family:sans-serif;font-size:10px;font-weight:600}
      .k-meas{stroke:#1258A8;stroke-width:1.2;stroke-dasharray:5 4;fill:none}
      .k-measbase{stroke:#1258A8;stroke-width:1;opacity:.45;fill:none}
      .k-meast{fill:#1258A8;font-family:sans-serif;font-size:10px;font-weight:600}
      .k-area{stroke:none}
      .k-broken{fill:none;stroke:#C62828;stroke-width:2;stroke-dasharray:6 4}
      .k-brokent{fill:#C62828;font-family:sans-serif;font-size:11px}
      .k-ink{fill:none;stroke:var(--kc,#111);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
    </style></svg>`);
  const png=EXPORTOPT.vector?null:await svgToPNG(styled, Math.round(vbW*2), Math.round(vbH*2));
  const hasOwnLegend=(sk.objs||[]).some(o=>o.t==="legend");
  const markerList=hasOwnLegend?[]:(sk.objs||[]).filter(o=>o.t==="marker")
    .sort((a,b)=>(parseInt(a.n,10)||0)-(parseInt(b.n,10)||0));
  const legendH = markerList.length ? 34+markerList.length*13 : 0;
  const measH = measRows(sk).length ? 44+measRows(sk).length*14 : 0;
  const availW=W-2*M, availH=H-y-M-legendH-measH-24;
  let dw=availW, dh=dw*vbH/vbW;
  if(dh>availH){dh=availH;dw=dh*vbW/vbH}
  // a fixed ratio, so the print can be measured with a ruler
  let printedAt="";
  if(!shared&&EXPORTOPT.mode==="scale"&&scaleOf(sk)){
    const ppi=EXPORTOPT.ratio/unitsPer(sk);          // page units per inch of paper
    const fw=vbW/ppi*72, fh=vbH/ppi*72;
    if(fw<=availW&&fh<=availH){dw=fw;dh=fh;printedAt="Printed at 1 in = "+EXPORTOPT.ratio+" "+(sk.scale.unit||"ft")+". "}
    else toast("Too big for the page at 1 in = "+EXPORTOPT.ratio+" \u2014 fitted to the page instead");
  }
  if(png)doc.addImage(png,"PNG",M+(availW-dw)/2,y,dw,dh,undefined,"MEDIUM");
  else if(!(await svgVector(doc,styled,M+(availW-dw)/2,y,dw,dh))){
    const p2=await svgToPNG(styled, Math.round(vbW*2), Math.round(vbH*2));
    doc.addImage(p2,"PNG",M+(availW-dw)/2,y,dw,dh,undefined,"MEDIUM"); toast("Vector drawing failed, used an image instead") }
  y+=dh+16;

  // the marker index, printed rather than drawn, so nothing is cut off
  const markers=markerList;
  if(markers.length){
    if(y>H-M-40){doc.addPage();y=M}
    doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(0);
    doc.text("Legend",M,y);y+=6;
    doc.setDrawColor(120);doc.setLineWidth(.6);doc.line(M,y,W-M,y);y+=13;
    doc.setFontSize(9.5);
    markers.forEach((m,i)=>{
      const ly=y+i*13;
      doc.setFont("helvetica","bold");doc.text(String(m.n||"?"),M,ly);
      doc.setFont("helvetica","normal");
      const nm=(m.label||"").trim();
      doc.setTextColor(nm?0:150);
      doc.text(nm||"not named",M+20,ly);
      doc.setTextColor(0);
    });
    y+=markers.length*13+6;
  }
  // measurements, printed as a table so the placement can be checked against the notes
  const mrows=measRows(sk);
  if(mrows.length){
    if(y+34+mrows.length*24>H-M-40){doc.addPage();y=M}
    doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(0);
    doc.text("Measurements",M,y);y+=6;
    doc.setDrawColor(120);doc.setLineWidth(.6);doc.line(M,y,W-M,y);y+=13;
    doc.setFontSize(8.5);
    const plain=s=>String(s).replace(/\u2032/g,"'").replace(/\u2033/g,'"');
    mrows.forEach(([nm,txt])=>{
      const lines=doc.splitTextToSize(plain(txt),W-2*M-120);
      if(y+lines.length*11>H-M-40){doc.addPage();y=M}
      const nmLines=doc.splitTextToSize(plain(nm),112);
      doc.setFont("helvetica","bold");doc.text(nmLines,M,y);
      doc.setFont("helvetica","normal");doc.text(lines,M+120,y);
      y+=Math.max(lines.length,nmLines.length,1)*11+4;
    });
    y+=4;
  }
  doc.setFontSize(8);doc.setTextColor(120);
  // jsPDF's default font has no typographic prime, so keep this line plain ASCII
  const sc=scaleOf(sk);
  if(sk.bg&&sk.bg.src){
    doc.setFontSize(8);doc.setTextColor(110);
    doc.text("Aerial imagery from county GIS - "+String(sk.bg.src).replace(/\u2013/g,"-")
      +(sk.bg.place?". "+sk.bg.place:"")
      +(sk.bg.ground?". Image covers "+sk.bg.ground+" ft across.":""),
      M,H-36,{maxWidth:W-2*M});
  }
  doc.setFontSize(8);doc.setTextColor(120);
  doc.text((sc ? "Drawn to scale - measure using the scale bar (" +
        (Math.round(sc.real*100)/100)+" "+(sc.unit||"ft")+" shown). "
      : "Not to scale. ")
    +printedAt+"FSU "+APP_VERSION+". Exported "+new Date().toISOString().slice(0,16).replace("T"," "), M,H-24);

  if(shared)return doc;
  const safe=String(sk.caseNo||"sketch").replace(/[^a-z0-9]+/gi,"-").toLowerCase();
  const name=safe+"-sketch-"+new Date().toISOString().slice(0,10)+".pdf";
  const blob=doc.output("blob");
  try{
    const file=new File([blob],name,{type:"application/pdf"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:sk.caseNo||"Scene sketch"});
      markExported(sk); return toast("Saved \u2014 put it in the case file");
    }
  }catch(e){ if(e&&e.name==="AbortError")return; }
  const u=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
  markExported(sk); toast("Sketch exported");
}
function svgToPNG(svg,w,hh){
  return new Promise((res,rej)=>{
    const img=new Image();
    const blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    img.onload=()=>{
      const c=document.createElement("canvas");c.width=w;c.height=hh;
      const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,w,hh);
      ctx.drawImage(img,0,0,w,hh);URL.revokeObjectURL(url);
      res(c.toDataURL("image/png"));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("Couldn't render the sketch"))};
    img.src=url;
  });
}
function markExported(rec){ if(rec){rec.exported=new Date().toISOString();logAct("export","Exported "+(rec.caseNo||rec.name||"a document"));saveLocal()} }
const unsent=()=>[
  ...(S.fills||[]).filter(f=>!f.exported).map(f=>({name:f.formName||"Filled form",id:f.id})),
  ...(S.sketches||[]).filter(s=>!s.exported&&(s.objs||[]).length)
      .map(s=>({name:s.caseNo?"Sketch "+s.caseNo:"Untitled sketch",id:s.id}))];
function afterExport(r){ markExported(r);
  askConfirm("Exported","Save it into FSU \u203a Van app backups, then clear it from the app. Filled forms are never synced, so the copy you just made is the only one.",
    "Clear it from the app",false,()=>{
      S.fills=S.fills.filter(x=>x.id!==r.id);saveLocal();
      view="active";$$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-active"));
      render();toast("Cleared")});
}



