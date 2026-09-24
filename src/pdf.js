/* ---------- pdf ---------- */
let jsPDFlib=null;
function loadPDF(){
  if(jsPDFlib)return Promise.resolve(jsPDFlib);
  return new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="lib/jspdf.umd.min.js";
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
    else if(typeof exportSketch==="function") await exportSketch(it.rec,doc);
    else { doc.setFontSize(11);
      doc.text("This sketch is drawn in the Sketch app; open it there to add it.",40,60) }
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
function afterExport(r){ markExported(r);
  askConfirm("Exported","Save it into FSU \u203a Van app backups, then clear it from the app. Filled forms are never synced, so the copy you just made is the only one.",
    "Clear it from the app",false,()=>{
      S.fills=S.fills.filter(x=>x.id!==r.id);saveLocal();
      view="active";$$(".view").forEach(v=>v.classList.toggle("on",v.id==="v-active"));
      render();toast("Cleared")});
}



