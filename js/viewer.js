"use strict";
/* Viewer read-only de /s/<id>. Reutiliza el core compartido
   (config → model → geometry → render) y makeReadOnlyRenderState(); NO carga
   estado mutable del editor, selección, interacción de edición, UI de editor,
   exportación, autosave ni persistencia local.

   Su único estado mutable es de presentación: viewport propio (pan/zoom),
   página activa, pausa de animación y presentación. Nada de ello se escribe
   sobre el share ni sale de esta pestaña. */

const $=id=>document.getElementById(id);
let sv, sctx;
const view=makeViewerViewport();
let presenting=false, preView=null;

/* Reloj de animación propio (el del editor vive en js/editor-runtime.js,
   que aquí no se carga). Mismo modelo: tiempo en segundos, pausable. */
let t0=performance.now(), playing=true, pausedAt=0;
function now(){ return playing? (performance.now()-t0)/1000 : pausedAt; }
function restartClock(){ t0=performance.now(); pausedAt=0; }
function togglePlay(){
  if(playing){ pausedAt=now(); playing=false; }
  else{ t0=performance.now()-pausedAt*1000; playing=true; }
}

let shareViewed=false;
let viewerPhase="loading";
let canvasDirty=false;
const VIEWER_CONTROLS=["btnFit","btnZoomIn","btnZoomOut","btnPresent","btnOpen"];
function setViewerPhase(phase){
  viewerPhase=phase;
  for(const id of VIEWER_CONTROLS) $(id).disabled=phase!=="ready";
  for(const tab of $("pgTabs").children) tab.disabled=phase!=="ready";
}

/* ───────────────────────────── Estados ───────────────────────────── */

const SHARE_ERROR_MESSAGES={
  invalid_id:"El enlace del diagrama no es válido.",
  not_found:"Este diagrama compartido no está disponible.",
  invalid_document:"El documento compartido no es un diagrama Fluyo válido.",
  unsupported_version:"Este diagrama necesita una versión más reciente de Fluyo.",
  unavailable:"No se pudo cargar el diagrama ahora mismo. Inténtalo de nuevo más tarde."
};
function setStatus(msg){ const el=$("status"); el.textContent=msg; el.hidden=!msg; }
function showShareError(code){
  setViewerPhase("error");
  if(presenting) exitPresent();
  $("prBar").hidden=true;
  $("pgTabs").textContent="";
  $("pgTabs").hidden=true;
  // Limpiar frame parcial y pila/transformación de Canvas tras una excepción.
  if(sv && canvasDirty){
    sv.width=sv.width;
    sctx?.clearRect(0,0,sv.width,sv.height);
    canvasDirty=false;
  }
  setStatus(SHARE_ERROR_MESSAGES[code]||SHARE_ERROR_MESSAGES.unavailable);
}

/* ─────────────────────── Render y bucle ─────────────────────── */

function viewerRenderState(){
  return makeReadOnlyRenderState({
    x:view.x, y:view.y, zoom:view.zoom,
    width:sv.width, height:sv.height, presenting
  });
}
function renderViewerFrame(){
  resizeCanvas(sv, $("wrap"));
  canvasDirty=true;
  render(sctx, now(), {renderState:viewerRenderState(), emptyHint:"Esta página no contiene elementos."});
}
/* Un fallo de render es terminal y no programa otro RAF. */
function viewerLoop(){
  if(viewerPhase!=="ready") return;
  try{ renderViewerFrame(); }
  catch(e){ showShareError("invalid_document"); return; }
  requestAnimationFrame(viewerLoop);
}

/* ─────────────────────── Navegación de páginas ─────────────────────── */

function buildTabs(){
  const nav=$("pgTabs");
  nav.textContent="";
  doc.pages.forEach((pg,i)=>{
    const b=document.createElement("button");
    b.type="button";
    b.textContent=pg.name||("Página "+(i+1));
    b.className=i===doc.cur? "active":"";
    b.setAttribute("aria-current", i===doc.cur? "page":"false");
    b.onclick=()=>goPage(i);
    nav.appendChild(b);
  });
  $("pgTabs").hidden=doc.pages.length<2;
}
function updateTabs(){
  [...$("pgTabs").children].forEach((b,i)=>{
    b.className=i===doc.cur? "active":"";
    b.setAttribute("aria-current", i===doc.cur? "page":"false");
  });
}
function goPage(i){
  if(viewerPhase!=="ready") return;
  try{
    const j=clamp(i, 0, doc.pages.length-1);
    if(j===doc.cur) return;
    doc.cur=j;
    /* la aparición escalonada se reinicia en cada página, como en el editor */
    if(settings.build) restartClock();
    fitView();
    updateTabs();
    updatePresentBar();
  }catch(e){ showShareError("invalid_document"); }
}
function nextSlide(){ goPage(doc.cur+1); }
function prevSlide(){ goPage(doc.cur-1); }

/* ─────────────────────── Vista: pan y zoom ─────────────────────── */

function fitView(){
  const r=$("wrap").getBoundingClientRect();
  fitViewportToBounds(view, getBounds(), r.width, r.height);
  if(![view.x,view.y,view.zoom].every(Number.isFinite)) throw projectDataError();
}
function zoomAtClient(factor, clientX, clientY){
  const r=sv.getBoundingClientRect();
  zoomViewportAt(view, clientX-r.left, clientY-r.top, factor);
}

function wireViewport(){
  /* Rueda: sin modificador = pan; Ctrl/Meta = zoom anclado al cursor.
     Misma semántica que el lienzo del editor. */
  sv.addEventListener("wheel", ev=>{
    if(viewerPhase!=="ready") return;
    ev.preventDefault();
    if(ev.ctrlKey || ev.metaKey) zoomAtClient(ev.deltaY>0? 0.9 : 1.1, ev.clientX, ev.clientY);
    else panViewportBy(view, -ev.deltaX, -ev.deltaY);
  }, {passive:false});

  /* Puntero: arrastre = pan; dos punteros = pinch (zoom anclado al punto
     medio). Los eventos de puntero unifican ratón y táctil; ningún gesto
     hace hit-testing sobre nodos: no hay nada editable que seleccionar. */
  const pointers=new Map();
  let pinch=null;
  const localPointers=()=>{
    const r=sv.getBoundingClientRect();
    return [...pointers.values()].map(p=>({x:p.x-r.left,y:p.y-r.top}));
  };
  sv.addEventListener("pointerdown", ev=>{
    if(viewerPhase!=="ready") return;
    sv.setPointerCapture?.(ev.pointerId);
    pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
    if(pointers.size===2){
      pinch=beginViewportPinch(view,...localPointers());
    }
  });
  sv.addEventListener("pointermove", ev=>{
    if(viewerPhase!=="ready") return;
    const prev=pointers.get(ev.pointerId);
    if(!prev) return;
    if(pointers.size===1){
      panViewportBy(view, ev.clientX-prev.x, ev.clientY-prev.y);
    }else if(pinch && pointers.size===2){
      pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
      const [a,b]=localPointers();
      if(pinch.distance===0) pinch=beginViewportPinch(view,a,b);
      updateViewportPinch(view,pinch,a,b);
      return;
    }
    pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
  });
  const release=ev=>{
    pointers.delete(ev.pointerId);
    pinch=pointers.size===2? beginViewportPinch(view,...localPointers()) : null;
  };
  sv.addEventListener("pointerup", release);
  sv.addEventListener("pointercancel", release);
  sv.addEventListener("lostpointercapture", release);
}

/* ─────────────────────── Presentación ─────────────────────── */

function updatePresentBar(){
  $("prPos").textContent=(doc.cur+1)+" / "+doc.pages.length;
  $("prPrev").disabled=doc.cur===0;
  $("prNext").disabled=doc.cur===doc.pages.length-1;
}
function enterPresent(){
  if(viewerPhase!=="ready" || presenting) return;
  preView={x:view.x, y:view.y, zoom:view.zoom};
  presenting=true;
  document.body.classList.add("presenting");
  $("prBar").hidden=false;
  if(document.documentElement.requestFullscreen)
    document.documentElement.requestFullscreen().catch(()=>{});
  if(settings.build) restartClock();
  /* el chrome se acaba de ocultar: esperar un frame para medir el lienzo
     con su tamaño nuevo antes de encajar la vista */
  requestAnimationFrame(()=>{
    if(viewerPhase!=="ready" || !presenting) return;
    try{ resizeCanvas(sv, $("wrap")); fitView(); }
    catch(e){ showShareError("invalid_document"); }
  });
  updatePresentBar();
}
function exitPresent(){
  if(!presenting) return;
  presenting=false;
  document.body.classList.remove("presenting");
  $("prBar").hidden=true;
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  if(preView){ Object.assign(view, preView); preView=null; }
  requestAnimationFrame(()=>{ resizeCanvas(sv, $("wrap")); });
}
/* salir de la pantalla completa por la vía del navegador (Esc, F11) también
   deshace el modo; si no, el chrome se quedaría escondido */
document.addEventListener("fullscreenchange", ()=>{
  if(!document.fullscreenElement && presenting) exitPresent();
});

/* ─────────────────────── Abrir en Fluyo ─────────────────────── */

function openInFluyo(){
  if(viewerPhase!=="ready") return;
  /* El gesto explícito del usuario es el momento semántico fiable: sólo
     aquí se dispara share_opened_in_editor (FLUYO-003 §10). El documento se
     entrega como copia editable vía deep link; nunca hay escritura de vuelta
     hacia el share original. */
  trackEvent("share_opened_in_editor");
  return buildOpenInFluyoURL(serializeProject(), location.href)
    .then(url=>{ location.href=url; })
    .catch(err=>{
      console.error("No se pudo preparar la copia editable:", err);
      setStatus("No se pudo preparar la copia editable. Inténtalo de nuevo.");
    });
}

/* ─────────────────────── Teclado ─────────────────────── */

document.addEventListener("keydown", ev=>{
  if(viewerPhase!=="ready") return;
  if(ev.key===" "){ ev.preventDefault(); togglePlay(); }
  if(ev.key==="Escape" && presenting) exitPresent();
  if(!presenting) return;
  if(ev.key==="ArrowRight" || ev.key==="PageDown"){ ev.preventDefault(); nextSlide(); }
  if(ev.key==="ArrowLeft" || ev.key==="PageUp"){ ev.preventDefault(); prevSlide(); }
  if(ev.key==="Home"){ ev.preventDefault(); goPage(0); }
  if(ev.key==="End"){ ev.preventDefault(); goPage(doc.pages.length-1); }
});

/* ─────────────────────── Arranque ─────────────────────── */

/* El ID real de /s/<id> lo resolverá FLUYO-006 con routing de hosting.
   Hoy: pathname /s/<id>, fallback a ?s=<id> o #s=<id> para servir la
   entrada estática s/index.html en desarrollo. La demo exige un ID explícito. */
function shareIdFromLocation(){
  // Leer el ID completo; la validación pertenece al loader, sin truncamientos.
  const fromPath=/\/s\/(.+?)\/?$/.exec(location.pathname);
  if(fromPath && fromPath[1]!=="index.html"){
    try{ return decodeURIComponent(fromPath[1]); }catch(e){ return ""; }
  }
  const search=new URLSearchParams(location.search);
  if(search.has("s")) return search.get("s");
  const hash=new URLSearchParams(location.hash.slice(1));
  if(hash.has("s")) return hash.get("s");
  return null;
}

async function bootViewer(){
  sv=$("sv");
  setViewerPhase("loading");
  try{ sctx=sv.getContext("2d"); }
  catch(e){ showShareError("unavailable"); return; }
  if(!sctx){ showShareError("unavailable"); return; }
  setStatus("Cargando diagrama…");
  const id=shareIdFromLocation();
  let loaded;
  try{ loaded=await loadSharedDocument(id); }
  catch(e){ showShareError(e&&e.code); return; }
  /* Instalar el snapshot read-only en el modelo compartido. Es la única
     "instalación" que hace el viewer: el modelo no toca DOM, autosave ni
     persistencia; todo lo demás es estado de vista local a este archivo. */
  try{
    doc=loaded.doc;
    settings=loaded.settings;
    restartClock();
    buildTabs();
    updatePresentBar();
    resizeCanvas(sv, $("wrap"));
    fitView();
    // El primer render sucede aún en loading: sin ready ni analytics anticipados.
    renderViewerFrame();
    wireViewport();
    $("btnFit").onclick=fitView;
    $("btnZoomIn").onclick=()=>{ zoomAtClient(1.25, ...centerClient()); };
    $("btnZoomOut").onclick=()=>{ zoomAtClient(0.8, ...centerClient()); };
    $("btnPresent").onclick=enterPresent;
    $("prPrev").onclick=prevSlide;
    $("prNext").onclick=nextSlide;
    $("prExit").onclick=exitPresent;
    $("btnOpen").onclick=openInFluyo;
    setViewerPhase("ready");
    setStatus("");
    shareViewed=true;
    trackEvent("share_viewed");
    requestAnimationFrame(viewerLoop);
  }catch(e){ showShareError("invalid_document"); }
}
function centerClient(){
  const r=sv.getBoundingClientRect();
  return [r.left+r.width/2, r.top+r.height/2];
}

if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded", bootViewer, {once:true});
else
  bootViewer();

/* Gancho de inspección para tests y depuración. Expone sólo estado de
   vista; el documento se lee del modelo compartido. */
window.__viewer={
  get phase(){ return viewerPhase; },
  get view(){ return {...view}; },
  get presenting(){ return presenting; },
  get playing(){ return playing; },
  get cur(){ return doc.cur; },
  get pages(){ return doc.pages.length; },
  get shareViewed(){ return shareViewed; }
};
