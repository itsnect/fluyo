"use strict";
/* Estado del documento, estado de UI, utilidades, fábricas de nodos/flechas y autoguardado local */

/* ===================== Documento (páginas) ===================== */
function blankPage(name){ return {name, nodes:[], edges:[], nextId:1}; }
let doc={ theme:"dark", pages:[blankPage("Página 1")], cur:0 };
let settings={ speed:.5, dots:3, build:false, stagger:.45, grid:true };
const P=()=>doc.pages[doc.cur];

/* ===================== Estado de UI ===================== */
const cv=document.getElementById("cv"), ctx=cv.getContext("2d");
let mode="select", pendingShape=null, pendingIcon=null, connecting=null;
let selN=new Set(), selE=new Set();
let drag=null;                // {offs:{id:{dx,dy}}, wps:[{w,dx,dy}]}
let resizing=null;            // {id, fx, fy, aspect}
let wpDrag=null;              // {edgeId, idx}
let connectDrag=null;         // {fromId, fromSide}
let marquee=null;             // {x0,y0,x1,y1,add}
let hoverNode=null;
let clip=null;                // portapapeles interno
let pasteTimer=null;
let t0=performance.now(), playing=true, pausedAt=0;
const mouse={x:0,y:0};
let viewX=0, viewY=0, viewZoom=0.8;
let panDrag=null;

function getBounds(){
  if(P().nodes.length===0) return {x:0, y:0, w:1280, h:720};
  let mx=Infinity, my=Infinity, Mx=-Infinity, My=-Infinity;
  const addP=(x,y)=>{ if(x<mx)mx=x; if(x>Mx)Mx=x; if(y<my)my=y; if(y>My)My=y; };
  P().nodes.forEach(n=>{
    addP(n.x-n.w/2, n.y-n.h/2);
    addP(n.x+n.w/2, n.y+n.h/2);
  });
  P().edges.forEach(e=>{
    const pts=edgePoints(e);
    pts.forEach(p=>addP(p.x, p.y));
  });
  mx-=40; my-=40; Mx+=40; My+=40;
  return {x: mx, y: my, w: Mx-mx, h: My-my};
}

function centerView(){
  const r=$("wrap").getBoundingClientRect();
  if(r.width===0){ setTimeout(centerView,50); return; }
  const b = getBounds();
  viewX=(r.width-b.w*viewZoom)/2 - b.x*viewZoom;
  viewY=(r.height-b.h*viewZoom)/2 - b.y*viewZoom;
}
setTimeout(centerView, 100);

/* ===================== Utilidades ===================== */
const $=id=>document.getElementById(id);
const nodeById=id=>P().nodes.find(n=>n.id===id);
const edgeById=id=>P().edges.find(e=>e.id===id);
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t,0,1); return t*t*(3-2*t);};
const snap=v=>Math.round(v/GRID)*GRID;
const deep=o=>JSON.parse(JSON.stringify(o));
function hexA(col,a){ const v=parseInt(col.slice(1),16);
  return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`; }

function newNode(shape,x,y,extra={}){
  const sizes={rect:[180,70], cylinder:[150,90], diamond:[160,100], circle:[110,110], hex:[170,80], text:[200,40], icon:[120,92], image:[220,160]};
  const [w,h]=sizes[shape]||[160,70];
  const n=Object.assign({ id:P().nextId++, shape, x:snap(x), y:snap(y), w, h,
    label: shape==="text"?"Texto":(shape==="icon"||shape==="image")?"":"Nodo",
    color:PALETTE[0].c, pulse:false, order:P().nodes.length }, extra);
  P().nodes.push(n); return n;
}
function newEdge(a,b,opts={}){
  if(a===b) return null;
  const e=Object.assign({ id:P().nextId++, from:a, to:b, fromSide:null, toSide:null,
    route:"straight", waypoints:[], label:"", animated:true, dashed:false, startArrow:false, endArrow:true, flowDir:"normal" }, opts);
  P().edges.push(e); return e;
}

/* ===================== Autoguardado local ===================== */
const AUTOSAVE_KEY="fluyo.autosave.v1";
const AUTOSAVE_DELAY=500;
let autosaveTimer=null, autosavePaused=false, autosaveReady=true, autosaveSuppressed=0;

function serializeProject(){ return {version:3,app:"fluyo",doc,settings}; }
function canAutosave(){ return autosaveReady && !autosavePaused && autosaveSuppressed===0; }
function suppressAutosave(){
  autosaveSuppressed++;
  clearTimeout(autosaveTimer);
}
function releaseAutosave(){ autosaveSuppressed=Math.max(0, autosaveSuppressed-1); }
function runWithoutAutosave(fn){
  suppressAutosave();
  try{ return fn(); }
  finally{ releaseAutosave(); }
}
function saveAutosave(force=false){
  if(!force && !canAutosave()) return;
  try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProject())); }
  catch(e){ console.error("Autosave failed:", e); }
}
function scheduleAutosave(){
  if(!canAutosave()) return;
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(saveAutosave, AUTOSAVE_DELAY);
}
function clearAutosave(){
  try{ localStorage.removeItem(AUTOSAVE_KEY); }catch(e){}
}
function hasAutosave(){
  try{ return localStorage.getItem(AUTOSAVE_KEY)!==null; }catch(e){ return false; }
}
if(hasAutosave()){ autosavePaused=true; autosaveReady=false; }
function loadAutosaveData(){
  try{
    const raw=localStorage.getItem(AUTOSAVE_KEY);
    return raw? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function syncProjectControls(){
  $("themeSel").value=doc.theme;
  $("speedIn").value=settings.speed;
  $("dotsIn").value=settings.dots;
  $("buildChk").checked=settings.build;
  $("staggerIn").value=settings.stagger;
}
function applyProjectData(d){
  runWithoutAutosave(()=>{
    if(d.doc&&Array.isArray(d.doc.pages)) doc=d.doc;
    else if(d.state&&Array.isArray(d.state.nodes)){
      doc={theme:d.state.theme||"dark", cur:0,
           pages:[Object.assign(blankPage("Página 1"),{nodes:d.state.nodes,edges:(d.state.edges||[]).map(e=>Object.assign({fromSide:null,toSide:null,route:"straight",waypoints:[]},e)),nextId:d.state.nextId||999})]};
    } else throw new Error("invalid");
    doc.pages.forEach(pg=>pg.edges.forEach(e=>{
      if(e.endArrow===undefined){ e.endArrow=true; e.startArrow=!!e.bidir; }
      if(!e.flowDir) e.flowDir="normal";
      if(!e.waypoints) e.waypoints=[];
      if(!e.route) e.route="straight";
    }));
    undoStack.length=0; redoStack.length=0;
    if(d.settings) Object.assign(settings,d.settings);
    doc.cur=clamp(doc.cur||0,0,doc.pages.length-1);
    syncProjectControls();
    clearSel(); renderTabs();
  });
}
function restoreAutosaveSession(){
  const d=loadAutosaveData();
  if(!d) return false;
  applyProjectData(d);
  return true;
}
function showAutosaveRestorePrompt(){
  autosavePaused=true;
  autosaveReady=false;
  clearTimeout(autosaveTimer);
  $("autosaveModal").style.display="flex";
}
function hideAutosaveRestorePrompt(){
  $("autosaveModal").style.display="none";
}
function enableAutosave(){
  clearTimeout(autosaveTimer);
  autosavePaused=false;
  autosaveReady=true;
}
function closeRestorePrompt(){
  hideAutosaveRestorePrompt();
  enableAutosave();
}
