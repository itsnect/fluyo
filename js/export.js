"use strict";
/* Guardar/abrir, ejemplo y exportación (PNG/JPG/GIF) */

/* ===================== Guardar / abrir ===================== */
function saveJSON(){
  const blob=new Blob([JSON.stringify({version:3,app:"fluyo",doc,settings},null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="diagrama.fluyo.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}
$("btnJsonOut").onclick=saveJSON;
$("btnJsonIn").onclick=()=>$("fileIn").click();
$("fileIn").onchange=ev=>{
  const f=ev.target.files[0]; if(!f) return;
  f.text().then(txt=>{
    try{
      const d=JSON.parse(txt);
      if(d.doc&&Array.isArray(d.doc.pages)){ doc=d.doc; }
      else if(d.state&&Array.isArray(d.state.nodes)){ // formato v1
        doc={theme:d.state.theme||"dark", cur:0,
             pages:[Object.assign(blankPage("Página 1"),{nodes:d.state.nodes,edges:(d.state.edges||[]).map(e=>Object.assign({fromSide:null,toSide:null,route:"straight",waypoints:[]},e)),nextId:d.state.nextId||999})]};
      } else throw 0;
      doc.pages.forEach(pg=>pg.edges.forEach(e=>{
        if(e.endArrow===undefined){ e.endArrow=true; e.startArrow=!!e.bidir; }
        if(!e.flowDir) e.flowDir="normal";
        if(!e.waypoints) e.waypoints=[];
        if(!e.route) e.route="straight";
      }));
      undoStack.length=0; redoStack.length=0;
      if(d.settings) Object.assign(settings,d.settings);
      doc.cur=clamp(doc.cur||0,0,doc.pages.length-1);
      $("themeSel").value=doc.theme;
      $("speedIn").value=settings.speed; $("dotsIn").value=settings.dots;
      $("buildChk").checked=settings.build; $("staggerIn").value=settings.stagger;
      clearSel(); renderTabs();
    }catch(e){ alert("El archivo no es un diagrama Fluyo válido."); }
  });
  ev.target.value="";
};

/* ===================== Ejemplo ===================== */
$("btnDemo").onclick=()=>{
  pushUndo();
  const pg=P(); pg.nodes=[]; pg.edges=[]; pg.nextId=1; clearSel();
  const A=newNode("rect",200,180);  A.label="API\nGateway";   A.color="#6a9fb5"; A.order=0;
  const B=newNode("icon",560,180,{icon:"kafka",label:"Kafka dispersiones"}); B.order=1; B.pulse=true; B.color="#d08b5b";
  const C=newNode("rect",940,120);  C.label="Servicio\npagos";  C.color="#6a9fb5"; C.order=2;
  const D=newNode("rect",940,340);  D.label="Servicio\nnotificaciones"; D.color="#9b7fb5"; D.order=3;
  const E=newNode("icon",560,500,{icon:"cloudsql",label:"Cloud SQL"}); E.color="#7fa66b"; E.order=4;
  const F=newNode("circle",200,500); F.label="Banco\ncentral"; F.color="#8f8f8f"; F.order=5;
  const T=newNode("text",640,55);   T.label="Dispersión de pagos en tiempo real"; T.color="#d08b5b"; T.order=0; T.w=620;
  let e;
  e=newEdge(A.id,B.id); e.label="evento"; e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(B.id,C.id); e.label="topic: pagos"; e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(B.id,D.id); e.label="topic: avisos"; e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(C.id,E.id); e.dashed=true; e.label="persistencia";
  e=newEdge(F.id,A.id); e.label="instrucción"; e.fromSide="n"; e.toSide="s"; e.route="ortho";
};

/* ===================== Exportación ===================== */
const exModal=$("exModal");
function syncExportRows(){
  const f=$("exFmt").value;
  $("exRowTr").style.display = (f==="png"||f==="gif") ? "flex":"none";
  $("exRowFps").style.display = f==="gif" ? "flex":"none";
  $("exRowDur").style.display = f==="gif" ? "flex":"none";
  $("exHint").style.display = f==="gif" ? "block":"none";
}
$("exFmt").onchange=syncExportRows;
$("btnExport").onclick=()=>{ exModal.style.display="flex"; syncExportRows(); };
$("exCancel").onclick=()=>exModal.style.display="none";
function slug(){ return (P().name||"diagrama").toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi,"-"); }

$("exGo").onclick=()=>{
  const fmt=$("exFmt").value, scale=+$("exRes").value;
  exModal.style.display="none";
  if(P().nodes.length===0){ alert("La página está vacía."); return; }
  if(fmt==="gif") exportGIF(scale, $("exTr").checked);
  else exportStatic(fmt, scale, $("exTr").checked);
};
function exportStatic(fmt,scale,transparent){
  const w=Math.round(W*scale), h=Math.round(H*scale);
  const off=document.createElement("canvas"); off.width=w; off.height=h;
  const oc=off.getContext("2d");
  oc.save(); oc.scale(scale,scale);
  render(oc, now(), {export:true, transparent: fmt==="png"&&transparent});
  oc.restore();
  const mime=fmt==="png"?"image/png":"image/jpeg";
  off.toBlob(blob=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=slug()+"."+(fmt==="png"?"png":"jpg");
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  }, mime, .92);
}
let workerUrl=null;
async function getWorker(){
  if(workerUrl) return workerUrl;
  const src=await fetch("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js").then(r=>r.text());
  workerUrl=URL.createObjectURL(new Blob([src],{type:"application/javascript"}));
  return workerUrl;
}
async function exportGIF(scale, transparent){
  const fps=+$("exFps").value;
  let dur=clamp(+$("exDur").value||3,1,15);
  const bDur=buildDuration();
  const flowDur=Math.max(0.5,dur-bDur);
  const cycles=Math.max(1,Math.round(settings.speed*flowDur));
  const exSpeed=cycles/flowDur, realSpeed=settings.speed;

  const ov=$("progOv"), fill=$("barFill"), msg=$("ovMsg");
  ov.style.display="flex"; fill.style.width="0%"; msg.textContent="Renderizando fotogramas…";
  try{
    const wurl=await getWorker();
    const w=Math.round(W*scale), h=Math.round(H*scale);
    const off=document.createElement("canvas"); off.width=w; off.height=h;
    const oc=off.getContext("2d");
    const keyNum = doc.theme==="crema"? 0xfefdfc : 0x010101;
    const keyCss = doc.theme==="crema"? "#fefdfc" : "#010101";
    const gifOpts={workers:2, quality:8, width:w, height:h, workerScript:wurl};
    if(transparent) gifOpts.transparent=keyNum;
    const gif=new GIF(gifOpts);
    const frames=Math.round(dur*fps);
    settings.speed=exSpeed;
    for(let f=0;f<frames;f++){
      const t=f/fps;
      oc.save(); oc.scale(scale,scale);
      render(oc,t, transparent? {export:true, bg:keyCss} : {export:true});
      oc.restore();
      gif.addFrame(off,{copy:true, delay:Math.round(1000/fps)});
      if(f%5===0){ fill.style.width=(f/frames*40)+"%"; await new Promise(r=>setTimeout(r)); }
    }
    settings.speed=realSpeed;
    msg.textContent="Codificando GIF…";
    gif.on("progress",p=>{ fill.style.width=(40+p*60)+"%"; });
    gif.on("finished",blob=>{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download=slug()+".gif"; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),5000);
      ov.style.display="none";
    });
    gif.render();
  }catch(err){
    settings.speed=realSpeed;
    ov.style.display="none";
    alert("No se pudo generar el GIF: "+err.message);
  }
}
