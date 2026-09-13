/* ---------- the sketch export: the page, the measurement table and the key ---------- */
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
