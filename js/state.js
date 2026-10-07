"use strict";
/* Runtime mutable, persistencia e integración DOM exclusivos del editor. */

/* Fábricas de edición: no se cargan en consumidores read-only.
   Envoltorios de la autoridad de dominio (createNodeIn/createConnectionIn, model.js): aquí solo
   queda lo que es del editor —la página activa y el snap de la interacción—. */
function newNode(shape,x,y,extra={}){
  return createNodeIn(P(), Object.assign({shape, x:snapV(x), y:snapV(y)}, extra));
}
function newEdge(a,b,opts={}){
  /* Una arista no puede salir y entrar en el mismo nodo: la regla es del dominio; el editor solo
     traduce ese rechazo al «no hacer nada» de siempre. */
  try{ return createConnectionIn(P(), Object.assign({source:a, target:b}, opts)); }
  catch(err){ if(err && err.code==="self_loop") return null; throw err; }
}

/* Modificar y eliminar (FLUYO-018.3): envoltorios de updateNodeIn/updateConnectionIn/deleteNodeIn/deleteConnectionIn
   (model.js). El editor solo aporta la página activa, el undo y el autoguardado de quien llama; las reglas son del
   dominio. Un rechazo del dominio (un valor que el documento no admitiría) deja el registro intacto y devuelve null,
   como newEdge con el auto-lazo; cualquier otro error se propaga. */
function domainOrNull(fn){
  try{ return fn(); }
  catch(err){ if(err && typeof err.code==="string") return null; throw err; }
}
function editNode(n,patch){ return domainOrNull(()=>updateNodeIn(P(), n.id, patch)); }
function editEdge(e,patch){ return domainOrNull(()=>updateConnectionIn(P(), e.id, patch)); }
function editObj(o,patch){ return P().nodes.includes(o) ? editNode(o,patch) : editEdge(o,patch); }   // nodo o conexión (texto, fuente, negrita, tamaño)
function removeEdges(ids){ for(const id of ids) domainOrNull(()=>deleteConnectionIn(P(), id)); }
function removeNodes(ids){ for(const id of ids) domainOrNull(()=>deleteNodeIn(P(), id)); }

/* Páginas (FLUYO-018.5): envoltorios de createPageIn/renamePageIn (model.js). El editor solo aporta la página activa
   (addPage la activa; el dominio no toca doc.cur). A diferencia de editNode, un nombre rechazado se propaga: la UI decide qué decir. */
function addPage(){ const r=createPageIn(doc); doc.cur=r.pageIndex; return r.page; }
function renamePage(index,name){ return renamePageIn(doc,index,name).page; }

/* ===================== Viewport ===================== */
const cv=document.getElementById("cv"), ctx=cv.getContext("2d");
let viewX=0, viewY=0, viewZoom=0.8;
let presenting=false;         // modo presentación: el lienzo ocupa la pantalla y las páginas son diapositivas
let panDrag=null;

/* ===================== Interacción del editor ===================== */
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
/* Nodo o arista que se está editando in-situ. editor-runtime.js lo incorpora al
   renderState para que el renderer no pinte dos veces el texto del textarea. */
let editing=null;
let clip=null;                // portapapeles interno
let pasteTimer=null;
const mouse={x:0,y:0};

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

/* ===================== Autoguardado local ===================== */
const AUTOSAVE_KEY="fluyo.autosave.v1";
const AUTOSAVE_DELAY=500;
let autosaveTimer=null, autosavePaused=false, autosaveReady=true, autosaveSuppressed=0;

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
  scheduleAnalyticsEdit();
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
function applyProjectData(d){
  const normalized=projectFromProjectData(d);
  /* FLUYO-015 (QA): un Playback en curso pertenece al documento anterior; al cambiar de documento
     no puede quedar ningún símbolo animándose sobre el nuevo. */
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive() && typeof scReset==="function") scReset();
  runWithoutAutosave(()=>{
    doc=normalized.doc;
    undoStack.length=0; redoStack.length=0;
    settings=normalized.settings;
    syncProjectControls();
    clearSel(); renderTabs();
  });
  resetAnalyticsBaseline();
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
   pegar páginas enteras no puede colisionar con nada y no hay que renumerar.
   Los EventTypes, en cambio, son del documento: las páginas llegan con su
   biblioteca, con ids nuevos y los Steps reescritos (FLUYO-018.8). Eso lo hace
   el dominio (importPagesIn, model.js); aquí solo queda la navegación y el
   historial: la importación cambia páginas Y biblioteca, así que es una
   frontera de estado como abrir un documento y Undo/Redo se vacían (una
   entrada anterior restauraría la biblioteca sin los EventTypes importados). */
function appendPagesFrom(d){
  const nd=documentFromProjectData(d);
  runWithoutAutosave(()=>{
    const {pageIndex}=importPagesIn(doc, nd);
    doc.cur=pageIndex;
    undoStack.length=0; redoStack.length=0;
    clearSel(); renderTabs();
  });
  resetAnalyticsBaseline();
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
