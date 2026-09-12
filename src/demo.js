/* ---------- sample van ---------- */
const DEMO_COMPS=[
 ["D1","Camera case","Driver side",0,0,6,5],["D2","Photo accessories","Driver side",6,0,6,5],
 ["D3","Latent print kit","Driver side",12,0,6,5],["D4","Powders and brushes","Driver side",18,0,6,5],
 ["D5","Drawer bank","Driver side",0,5,12,4],["D6","Lifters and tape","Driver side",12,5,6,4],
 ["D7","Scales and rulers","Driver side",18,5,6,4],["D8","Floor bin","Driver side",0,9,10,3],
 ["D9","Long shelf","Driver side",10,9,14,3],
 ["P1","DNA and biological","Passenger side",0,0,5,6],["P2","Swab storage","Passenger side",5,0,5,6],
 ["P3","Presumptive tests","Passenger side",10,0,5,6],["P4","Trace and GSR","Passenger side",15,0,9,6],
 ["P5","Packaging, paper","Passenger side",0,6,8,4],["P6","Packaging, rigid","Passenger side",8,6,8,4],
 ["P7","Seals and tape","Passenger side",16,6,8,4],["P8","PPE locker","Passenger side",0,10,6,2],
 ["P9","Sharps and biohazard","Passenger side",6,10,6,2],["P10","Respirators","Passenger side",12,10,6,2],
 ["R1","Rear door pouch","Rear doors",0,0,12,4]];
const DEMO_ITEMS=[
 ["DSLR body, Nikon D850","D1","B","Durable",1,1,"2027-03-01"],
 ["Macro lens, 60 mm","D1","B","Durable",1,1,""],
 ["Ring flash","D1","B","Durable",1,1,""],
 ["Spare camera batteries","D1","B","Consumable",6,4,""],
 ["SD cards, 64 GB","D2","B","Consumable",12,6,""],
 ["Tripod, aluminium","D2","B","Durable",1,1,""],
 ["Photo scale placards, set","D2","B","Durable",3,2,""],
 ["Black magnetic powder, 1 lb","D3","C","Consumable",2,4,"2026-06-30"],
 ["White latent powder, 8 oz","D3","C","Consumable",3,2,"2027-01-31"],
 ["Fibreglass brushes","D3","C","Consumable",4,4,""],
 ["Magnetic applicator","D3","C","Durable",2,1,""],
 ["Bi-chromatic powder, 8 oz","D4","C","Consumable",1,2,"2026-05-15"],
 ["Fluorescent powder, 2 oz","D4","C","Consumable",2,2,"2027-06-30"],
 ["Ninhydrin spray","D4","C","Reagent",2,2,"2026-11-20"],
 ["Screwdriver set","D5","I","Durable",1,1,""],
 ["Bolt cutters","D5","I","Durable",1,1,""],
 ["Extension cord, 50 ft","D5","I","Durable",2,2,""],
 ["Work light, LED","D5","I","Durable",2,2,""],
 ["Hinge lifters, 2 in","D6","C","Consumable",18,10,""],
 ["Rubber lifters, black","D6","C","Consumable",14,10,""],
 ["Lifting tape, 2 in","D6","C","Consumable",6,4,""],
 ["ABFO No. 2 scales","D7","B","Durable",4,2,""],
 ["Tape measure, 25 ft","D7","B","Durable",2,2,""],
 ["Laser measure","D7","B","Durable",1,1,"2026-09-20"],
 ["Traffic cones","D8","A","Durable",6,6,""],
 ["Barrier tape, 1000 ft","D8","A","Consumable",2,4,""],
 ["Blood collection kit","P1","D","Reagent",4,3,"2026-10-12"],
 ["Sterile water vials","P1","D","Reagent",10,8,"2026-11-05"],
 ["DNA swab boxes","P1","D","Consumable",22,15,""],
 ["Sterile swabs, long handle","P2","D","Consumable",8,50,"2027-04-30"],
 ["Swab drying rack","P2","D","Durable",1,1,""],
 ["Phenolphthalein kit","P3","D","Reagent",3,4,"2026-08-10"],
 ["Leucomalachite green","P3","D","Reagent",5,4,"2027-02-28"],
 ["Presumptive drug test pouches","P3","D","Reagent",12,10,"2026-10-30"],
 ["GSR collection stubs","P4","E","Consumable",14,10,"2027-08-31"],
 ["Tape lifts, trace","P4","E","Consumable",30,20,""],
 ["Forceps, fine point","P4","E","Durable",4,3,""],
 ["Paper bags, large","P5","H","Consumable",45,30,""],
 ["Paper bags, small","P5","H","Consumable",60,40,""],
 ["Manila envelopes","P5","H","Consumable",50,30,""],
 ["Evidence boxes, medium","P6","H","Consumable",14,10,""],
 ["Paint cans, quart","P6","H","Consumable",9,8,""],
 ["Evidence tape, red","P7","H","Consumable",7,5,""],
 ["Tamper-evident seals","P7","H","Consumable",40,25,""],
 ["Tyvek suits, XL","P8","A","Consumable",0,4,""],
 ["Nitrile gloves, box","P8","A","Consumable",3,6,"2027-05-31"],
 ["Shoe covers","P8","A","Consumable",20,15,""],
 ["Sharps container","P9","A","Regulated",2,2,""],
 ["Biohazard bags","P9","A","Consumable",25,15,""],
 ["Half-mask respirator","P10","A","Durable",2,2,"2026-09-14"],
 ["P100 cartridges","P10","A","Consumable",6,4,"2027-01-31"],
 ["First aid kit","R1","K","Durable",1,1,"2026-12-01"],
 ["Fire extinguisher","R1","K","Durable",1,1,"2027-02-01"]];
const DEMO_STEPS={
 "Black magnetic powder, 1 lb":[["Load the applicator by dipping the magnetic tip into the powder jar.",
   "Pass over the surface without touching it, letting the powder beard do the work.",
   "Photograph with a scale in frame before lifting.",
   "Lift with a hinge lifter, working from one edge to avoid trapping air."],
   "Sample text, not verified"],
 "Phenolphthalein kit":[["Collect a small sample on a clean swab tip.",
   "Add the reagent drops in the order printed on the kit.",
   "Read the result within the time window on the packaging.",
   "Record a negative control alongside every test."],"Sample text, not verified"],
 "Tyvek suits, XL":[["Put on over uniform, boots first, before entering the scene perimeter.",
   "Tape cuffs to gloves if handling wet biological material.",
   "Remove inside out at the perimeter and bag as contaminated waste."],"Sample text, not verified"]};
const FARO_STEPS=[
 "Format the SD card.",
 "From the home screen, press Manage at the lower right.",
 "Open Projects/Clusters at the top of the list.",
 "Select Default_Project, press Duplicate, then open Copy_of_Default_Project.",
 "Change the project name to the incident number followed by the operator's initials. No spaces anywhere in the name. Example: 250000_JMD",
 "Press the house icon at the top right to return to the home screen.",
 "Press the target icon at the top left and level the machine.",
 "Return to the home screen, then select the down arrow at the top.",
 "Select the Color Profile and set it for the conditions.",
 "Return to the home screen and press the large start button to begin scanning."];
const DEMO_REQ=[["FARO Focus laser scanner","B","Regional lab, evidence unit","555-0142","2 to 4 hours",
  "Approval from the on-call supervisor. Operator comes with the unit.",
  FARO_STEPS,
  [["FARO — Starting a New Project (cleaned)","https://docs.google.com/document/d/1VBOP1e9vxZeFuBAZBvzrlVlFJ0_TZsTrnO0_QfrXI4g/edit"]]]];
const DEMO_GAPS=[["Electrostatic dust lifter","F","gap","Roughly $900. Ask about next budget cycle."],
 ["Snow print wax","F","deliberate","Not needed in this climate."],
 ["Alternate light source, portable","J","gap","Borrowing the lab unit currently."]];

const DEMO_FORMS=[
 ["Evidence submission form","Evidence and custody","2024-A","Every item leaving the scene. One per item, sealed with the packaging.",[["Blank PDF","https://example.com/evidence-submission.pdf"]],"2026-07-14"],
 ["Chain of custody log","Evidence and custody","2023-C","Stays with the item. Every transfer signed by both parties.",[["Blank PDF","https://example.com/coc.pdf"]],""],
 ["Scene entry and exit log","Scene documentation","2025-B","Everyone who crosses the tape, in and out, with times.",[["Blank PDF","https://example.com/entry-log.pdf"]],"2026-08-02"],
 ["Photography log","Photography","2022-A","Frame numbers, subject, scale used, direction of view.",[["Blank PDF","https://example.com/photo-log.pdf"]],"2024-01-10"],
 ["Consent to search","Reports and statements","2025-A","Signed before any consent search. Witnessed.",[],"2026-06-30"]];
function seedVan(){
  S.comps=VANCOMPS.map(r=>({code:r[0],desc:r[1],side:VANSIDES[r[2]],
    x:r[3],y:r[4],w:r[5],h:r[6]}));
  S.walls=JSON.parse(JSON.stringify(VANWALLS));
  S.demo=false; save();
}
function loadDemo(){
  DEMO_FORMS.forEach(([name,cat,rev,desc,links,verified])=>{
    if(!S.forms.some(f=>f.name===name))
      S.forms.push({id:newId(),name,cat,rev,desc,verified,demo:true,
        links:links.map(([label,url])=>({label,url}))})});
  DEMO_COMPS.forEach(([code,desc,side,x,y,w,hh])=>{
    if(!S.comps.some(c=>c.code===code))
      S.comps.push({code,desc,side,x,y,w,h:hh,checked:"2026-08-28",demo:true})});
  DEMO_ITEMS.forEach(([name,loc,cat,cls,qty,par,date])=>{
    const g=DEMO_STEPS[name];
    S.items.push({id:newId(),name,loc,cat,cls,qty,par:String(par),date,
      status:"Stocked",gapType:"",note:"",steps:g?g[0]:[],source:g?g[1]:"",verified:"",
      uses:[],fav:false,demo:true})});
  DEMO_REQ.forEach(([name,cat,contact,phone,lead,note,steps,links])=>{
    S.items.push({id:newId(),name,loc:"",cat,cls:"Durable",qty:0,par:"",date:"",
      status:"Not carried",gapType:"request",note,contact,phone,lead,
      steps,source:"STARTING A NEW PROJECT ON FARO.docx",verified:"",uses:[],fav:false,rel:[],
      links:links.map(([label,url])=>({label,url})),demo:true})});
  DEMO_GAPS.forEach(([name,cat,gt,note])=>{
    S.items.push({id:newId(),name,loc:"",cat,cls:"Consumable",qty:0,par:"",date:"",
      status:"Not carried",gapType:gt,note,steps:[],source:"",verified:"",uses:[],demo:true})});
  S.demo=true;save();
}
function clearDemo(){
  S.forms=S.forms.filter(f=>!f.demo);
  S.items=S.items.filter(i=>!i.demo);
  S.comps=S.comps.filter(c=>!c.demo);
  if(S.curLoc&&!S.comps.some(c=>c.code===S.curLoc))S.curLoc="";
  S.demo=false;save();
}
function renderDemoBar(){
  const b=$("#demobar");
  if(!S.demo){b.style.display="none";b.innerHTML="";return}
  b.style.display="";
  b.innerHTML=`<span>Sample van loaded. Clear it before the real sweep.</span>
    <button id="cleardemo">Clear sample</button>`;
}


