"use strict";
/* Estado del documento, estado de UI, utilidades, fábricas de nodos/flechas y autoguardado local */

/* ===================== Documento (páginas) ===================== */
function blankPage(name){ return {name, nodes:[], edges:[], nextId:1}; }
let doc={ theme:"dark", customBg:"", pages:[blankPage("Página 1")], cur:0 };
let settings={ speed:.5, dots:3, build:false, stagger:.45, grid:true, snap:false, font:DEFAULT_FONT, single:false };
const P=()=>doc.pages[doc.cur];

/* ===================== Estado de UI ===================== */
const cv=document.getElementById("cv"), ctx=cv.getContext("2d");
let mode="select", pendingShape=null, pendingIcon=null, pendingAnim=null, connecting=null;
let selN=new Set(), selE=new Set();
let drag=null;                // {offs:{id:{dx,dy}}, wps:[{w,dx,dy}]}
let resizing=null;            // {id, fx, fy, aspect}
let wpDrag=null;              // {edgeId, idx}
let connectDrag=null;         // {fromId, fromSide}
/* Arrastre de un extremo de arista. NO muta el documento mientras dura: solo
   guarda qué extremo se está moviendo y se aplica al soltar, igual que
   connectDrag. Es lo que garantiza que el gesto no genere waypoints. */
let endDrag=null;             // {edgeId, which:"from"|"to"}
/* Arrastre de un TRAMO entero. El manejador de un tramo ortogonal ya no inserta
   un vértice en la posición del cursor —eso partía la ruta en dos diagonales—
   sino que desliza el tramo completo por su eje perpendicular, como un escalón.
   `i0`/`i1` son los dos waypoints que forman el tramo, `eje` el que se mueve
   ("x" para un tramo vertical, "y" para uno horizontal) y `lim` el tope que
   impide cruzar el pasillo de aproximación de cualquiera de los dos extremos.
   Ver moverTramo() en interaction.js. */
let segDrag=null;             // {edgeId, i0, i1, eje, lim:{min,max}}
let marquee=null;             // {x0,y0,x1,y1,add}
let hoverNode=null;
/* Nodo o arista que se está editando in-situ. Vive aquí y no en interaction.js
   porque lo LEE render.js —que se carga antes— para no dibujar dos veces el texto
   que ya pinta el textarea. Un `let` de otro script estaría en zona muerta
   temporal en el primer fotograma, y ni siquiera `typeof` lo salva. */
let editing=null;
let clip=null;                // portapapeles interno
let pasteTimer=null;
let t0=performance.now(), playing=true, pausedAt=0;
const mouse={x:0,y:0};
let viewX=0, viewY=0, viewZoom=0.8;
let panDrag=null;
let presenting=false;         // modo presentación: el lienzo ocupa la pantalla y las páginas son diapositivas

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
/* Como centerView, pero además elige el zoom para que la página entre entera.
   getBounds ya deja 40 px de aire alrededor, así que aquí no se añade más. */
function fitView(maxZoom=2.5){
  const r=$("wrap").getBoundingClientRect();
  if(r.width===0 || r.height===0) return;
  const b=getBounds();
  if(b.w<=0 || b.h<=0) return;
  viewZoom=clamp(Math.min(r.width/b.w, r.height/b.h), 0.05, maxZoom);
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
/* Movimiento libre por defecto; snap a rejilla solo si settings.snap está activo */
const snapV=v=>settings.snap? Math.round(v/GRID)*GRID : Math.round(v);
const deep=o=>JSON.parse(JSON.stringify(o));
function hexA(col,a){ const v=parseInt(col.slice(1),16);
  return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`; }

function newNode(shape,x,y,extra={}){
  const [w,h]=DEFAULT_SIZES[shape]||[160,70];
  const n=Object.assign({ id:P().nextId++, shape, x:snapV(x), y:snapV(y), w, h,
    label: shape==="text"?"Texto":shape==="code"?CODE_DEFAULT_LABEL:(shape==="icon"||shape==="image"||shape==="anim")?"":"Nodo",
    color:PALETTE[0].c, fill:null, border:"solid", lblPos:"center", textBg:null, textColor:null,
    font:null, bold:false, pulse:false, order:P().nodes.length }, extra);
  /* Los campos de `code` solo se ponen en nodos `code`, igual que `icon` solo va
     en los de icono: no tiene sentido cargar todos los nodos con ellos. */
  if(shape==="code" && !("lang" in n)) Object.assign(n,{lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null});
  /* `tint` nace apagado también en los iconos nuevos: el interruptor tiene que
     significar lo mismo en un diagrama de hoy y en uno de hace un mes. */
  if(shape==="icon" && !("tint" in n)) n.tint=false;
  P().nodes.push(n); return n;
}
function newEdge(a,b,opts={}){
  if(a===b) return null;
  const e=Object.assign({ id:P().nextId++, from:a, to:b, fromSide:null, toSide:null,
    route:"straight", waypoints:[], label:"", font:null, bold:false, animated:true, dashed:false, startArrow:false, endArrow:true, flowDir:"normal" }, opts);
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
  if($("chkGrid")) $("chkGrid").checked=settings.grid!==false;
  if($("chkSnap")) $("chkSnap").checked=!!settings.snap;
  if($("chkSingle")) $("chkSingle").checked=!!settings.single;
  if($("bgCustom") && doc.customBg) $("bgCustom").value=doc.customBg;
  if($("fontGlobalSel")) $("fontGlobalSel").value=settings.font||DEFAULT_FONT;
}
/* Migra y normaliza un `.fluyo.json` hasta dejarlo como documento válido, SIN
   instalarlo en el editor. Está separado de applyProjectData() porque «abrir
   como página nueva» necesita las páginas ya migradas para engancharlas a OTRO
   documento, y duplicar esta normalización es exactamente cómo se acaba con dos
   importadores que divergen.

   Lanza si lo que llega no es un documento Fluyo. Comprueba que `nodes` y
   `edges` sean arrays de verdad y no solo que exista `pages`: hasta ahora todo
   lo que pasaba por aquí venía de un archivo que el usuario había elegido a
   mano, y a partir del enlace compartible viene de donde sea. */
function documentFromProjectData(d){
  let nd;
  if(d && d.doc && Array.isArray(d.doc.pages) && d.doc.pages.length) nd=d.doc;
  else if(d && d.state && Array.isArray(d.state.nodes)){
    nd={theme:d.state.theme||"dark", cur:0,
        pages:[Object.assign(blankPage("Página 1"),{nodes:d.state.nodes,edges:(d.state.edges||[]).map(e=>Object.assign({fromSide:null,toSide:null,route:"straight",waypoints:[]},e)),nextId:d.state.nextId||999})]};
  } else throw new Error("invalid");
  nd.pages.forEach(pg=>{
    if(!pg || !Array.isArray(pg.nodes) || !Array.isArray(pg.edges)) throw new Error("invalid");
  });
  nd.pages.forEach(pg=>pg.edges.forEach(e=>{
    if(e.endArrow===undefined){ e.endArrow=true; e.startArrow=!!e.bidir; }
    if(!e.flowDir) e.flowDir="normal";
    if(!e.waypoints) e.waypoints=[];
    if(!e.route) e.route="straight";
    if(e.font===undefined) e.font=null;
    if(e.bold===undefined) e.bold=false;
  }));
  nd.pages.forEach(pg=>pg.nodes.forEach(n=>{
    if(n.fill===undefined) n.fill=null;
    if(!n.border) n.border="solid";
    if(!n.lblPos) n.lblPos="center";
    if(n.textBg===undefined) n.textBg=null;
    if(n.textColor===undefined) n.textColor=null;
    if(n.font===undefined) n.font=null;
    if(n.bold===undefined) n.bold=false;
  }));
  if(nd.customBg===undefined) nd.customBg="";
  return nd;
}
function applyProjectData(d){
  const nd=documentFromProjectData(d);
  runWithoutAutosave(()=>{
    doc=nd;
    if(!settings.font) settings.font=DEFAULT_FONT;
    undoStack.length=0; redoStack.length=0;
    if(d.settings) Object.assign(settings,d.settings);
    if(settings.grid===undefined) settings.grid=true;
    doc.cur=clamp(doc.cur||0,0,doc.pages.length-1);
    syncProjectControls();
    clearSel(); renderTabs();
  });
}
/* Engancha las páginas de un documento entrante al final del que ya está
   abierto, y salta a la primera de las nuevas.

   Solo las páginas. El tema, la tipografía global y el resto de ajustes son del
   documento que ya estaba abierto y NO se tocan: cambiarlos por los del
   entrante sería justo el destrozo que esta opción existe para evitar. La
   contrapartida es real y conviene saberla: el diagrama añadido puede verse
   distinto de como lo dibujó quien lo compartió, porque el tema y la
   tipografía son propiedades del documento, no de la página.

   Los ids de nodo y arista son por página (`newNode` usa `P().nextId`), así que
   pegar páginas enteras no puede colisionar con nada y no hay que renumerar. */
function appendPagesFrom(d){
  const nd=documentFromProjectData(d);
  runWithoutAutosave(()=>{
    const primeraNueva=doc.pages.length;
    doc.pages.push(...nd.pages);
    doc.cur=primeraNueva;
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

/* ===================== Documento que llega por la URL =====================

   Un diagrama que llega por la URL —hoy `?ejemplo=<slug>`, y el enlace
   compartible `#d=` — no puede pisar el trabajo en curso sin preguntar.

   Antes sí lo hacía, y de la peor forma posible: el ejemplo se cargaba en
   silencio saltándose el prompt de restauración, el `localStorage` seguía
   intacto un rato más, y la sesión anterior desaparecía en cuanto la persona
   tocaba cualquier cosa —o sea, después de que ya no hubiera nada que decidir.
   Nadie llegaba a ver nunca que había trabajo guardado.

   El trato ahora es explícito y tiene tres salidas, y solo aparece cuando hay
   algo real que perder (`hasAutosave()` solo es cierto si alguien editó algo:
   el autoguardado únicamente escribe desde una edición). Sin sesión guardada no
   hay conflicto y el documento entra directo, como siempre. */
let incoming=null;   // {data, meta:{titulo, abrirLabel, onResuelto}}

function presentIncomingDocument(data, meta){
  incoming={data, meta};
  if(!hasAutosave()){ incomingOpen(); return; }
  autosavePaused=true;
  autosaveReady=false;
  clearTimeout(autosaveTimer);
  $("incomingTitle").textContent=meta.titulo;
  $("incomingOpen").textContent=meta.abrirLabel;
  $("incomingPage").textContent=meta.paginaLabel;
  $("incomingModal").style.display="flex";
}
function closeIncomingPrompt(){
  $("incomingModal").style.display="none";
  enableAutosave();
}
/* Resuelve el conflicto y avisa a quien trajo el documento, para que la
   telemetría cuente lo que de verdad pasó y no lo que se intentó. */
function finishIncoming(eleccion){
  const meta=incoming ? incoming.meta : null;
  incoming=null;
  closeIncomingPrompt();
  if(meta && meta.onResuelto) meta.onResuelto(eleccion);
}
/* Abrir el entrante descartando lo guardado. El descarte se hace efectivo AQUÍ,
   no «cuando toques algo»: si alguien elige descartar y cierra la pestaña sin
   editar, la sesión que dijo descartar no puede seguir esperándole mañana. */
function incomingOpen(){
  if(!incoming) return;
  const {data}=incoming;
  clearAutosave();
  applyProjectData(data);
  centerView();
  finishIncoming("open");
}
/* La salida no destructiva: se recupera lo guardado y el entrante se añade
   detrás como páginas nuevas. Si lo guardado resulta ilegible no hay nada que
   preservar, así que se abre el entrante y se dice. */
function incomingAsNewPage(){
  if(!incoming) return;
  const {data}=incoming;
  if(!restoreMineOrWarn()){ incomingOpen(); return; }
  appendPagesFrom(data);
  centerView();
  finishIncoming("page");
  /* Después de finishIncoming(), que es quien vuelve a habilitar el
     autoguardado: el documento ya no es el que había en localStorage y hay que
     escribirlo, pero scheduleAutosave() aquí arriba no haría nada porque el
     prompt lo deja pausado hasta que se resuelve. */
  saveAutosave(true);
}
/* Seguir con lo mío: se restaura la sesión y el entrante se descarta. La URL no
   se toca — recargar vuelve a preguntar, que es lo correcto: la decisión fue
   para esta vez, no para siempre. */
function incomingKeepMine(){
  if(!incoming) return;
  restoreMineOrWarn();
  finishIncoming("keep");
}
/* Devuelve false si no había sesión utilizable. El aviso es el mismo que ya
   daba el botón «Restaurar», y el localStorage ilegible se limpia para no
   volver a tropezar con él en cada carga. */
function restoreMineOrWarn(){
  try{ if(restoreAutosaveSession()) return true; }
  catch(e){}
  clearAutosave();
  alert("No se pudo restaurar la sesión guardada.");
  return false;
}
