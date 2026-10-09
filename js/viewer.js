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
let viewerPayload=null;
let viewerPhase="loading";
let canvasDirty=false;
let viewerGeneration=0,viewerRaf=null,presentationRaf=null,viewerInputKey=null;
let viewportWired=false;
const viewerPointers=new Map();
let viewerPinch=null;
const VIEWER_CONTROLS=["btnFit","btnZoomIn","btnZoomOut","btnPresent","btnOpen","stPlay","stStop","stOpen"];
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
function clearViewerDocument(){
  if(viewerRaf!==null) cancelAnimationFrame(viewerRaf);
  if(presentationRaf!==null) cancelAnimationFrame(presentationRaf);
  viewerRaf=presentationRaf=null;
  const wasPresenting=presenting;
  presenting=false;preView=null;
  document.body.classList.remove("presenting");
  if(wasPresenting && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  for(const id of viewerPointers.keys()){
    try{sv?.releasePointerCapture?.(id);}catch(e){/* Puntero ya liberado. */}
  }
  viewerPointers.clear();viewerPinch=null;
  story=null;storyError=null;storyLast={};
  $("story").hidden=true;
  viewerPayload=null;shareViewed=false;
  doc={theme:"dark",customBg:"",pages:[{name:"",nodes:[],edges:[],nextId:1,behaviors:[],scenarios:[],nextScenarioId:1}],cur:0};
  settings={...DEFAULT_SETTINGS};
  Object.assign(view,makeViewerViewport());
  playing=false;pausedAt=0;t0=performance.now();
  edgeLabelPos.clear();
  for(const key of Object.keys(imgCache)) delete imgCache[key];
  for(const key of Object.keys(tintedURL)) delete tintedURL[key];
  $("prBar").hidden=true;
  $("prPos").textContent="";
  $("prPrev").disabled=$("prNext").disabled=true;
  $("pgTabs").textContent="";
  $("pgTabs").hidden=true;
  // Limpiar frame parcial y pila/transformación de Canvas tras una excepción.
  if(sv && canvasDirty){
    sv.width=sv.width;
    sctx?.clearRect(0,0,sv.width,sv.height);
    canvasDirty=false;
  }
}
function showShareError(code){
  viewerGeneration++;viewerInputKey=null;
  setViewerPhase("error");
  clearViewerDocument();
  setStatus(SHARE_ERROR_MESSAGES[code]||SHARE_ERROR_MESSAGES.unavailable);
}

/* ─────────────────────── Render y bucle ─────────────────────── */

function viewerRenderState(){
  /* Tamaño en px CSS y densidad aparte: resizeCanvas dimensiona el respaldo a la densidad de la pantalla (FLUYO-018.12). */
  const dpr=sv.fluyoDpr||1;
  return makeReadOnlyRenderState({
    x:view.x, y:view.y, zoom:view.zoom,
    width:sv.width/dpr, height:sv.height/dpr, dpr, presenting
  });
}
function renderViewerFrame(){
  resizeCanvas(sv, $("wrap"));
  canvasDirty=true;
  const rs=viewerRenderState();
  /* La Historia se pinta con el mismo runtime que el editor (story-playback.js). */
  if(story) rs.scenarioRuntime=FluyoStory.renderState(story.playback, story.scenario, performance.now());
  render(sctx, now(), {renderState:rs, emptyHint:"Esta página no contiene elementos."});
  if(story && story.status==="running" && FluyoStory.isFinished(story.playback)) story.status="completed";
  storyRefresh();
}
/* Un fallo de render es terminal y no programa otro RAF. */
function viewerLoop(generation=viewerGeneration){
  if(generation!==viewerGeneration || viewerPhase!=="ready") return;
  viewerRaf=null;
  if(viewerSourceKey()!==viewerInputKey){bootViewer();return;}
  try{ renderViewerFrame(); }
  catch(e){ showShareError("invalid_document"); return; }
  viewerRaf=requestAnimationFrame(()=>viewerLoop(generation));
}

/* ─────────────────────── Historia compartida (FLUYO-014) ───────────────────────
   La Historia de una página es SU primer Scenario con pasos: el autor decide
   cuál es al compartir (editor-share.js lo coloca primero en la copia). Aquí no
   hay selección. El viewer sólo reproduce con FluyoStory (receta compartida con
   el editor y Present) y nunca modifica el documento: el runtime es efímero,
   pertenece a esta generación del viewer y se descarta al cambiar de documento
   o de página. */
let story=null, storyError=null, storyLast={};
function storyScenario(){
  const pg=doc.pages[doc.cur], sc=pg && pg.scenarios && pg.scenarios[0];
  return sc && sc.steps.length ? sc : null;
}
function storyNodeName(id){
  const n=nodeById(id);
  return (n && String(n.label||"").split("\n")[0].trim()) || "Elemento sin nombre";
}
function storyPlay(){
  if(viewerPhase!=="ready" || presenting) return;
  const sc=storyScenario();
  if(!sc || (story && story.status==="running")) return;
  storyReset();
  const started=FluyoStory.start(P(), sc, performance.now());
  if(!started.ok){ storyError=started.errors[0]||null; storyRefresh(); return; }
  story={scenario:sc, playback:started.playback, status:"running"};
  storyRefresh();
}
function storyReset(){
  story=null; storyError=null;
  if(viewerPhase==="ready") storyRefresh();
}
function storySet(id, prop, value){
  const key=id+"."+prop;
  if(storyLast[key]===value) return;
  storyLast[key]=value;
  const el=$(id);
  if(prop==="text") el.textContent=value; else el[prop]=value;
}
function storyRefresh(){
  const sc=viewerPhase==="ready" ? storyScenario() : null;
  storySet("story","hidden",!sc);
  if(!sc) return;
  const phase=!story ? "ready" : story.status==="running" ? "playing" : "finished";
  const d=FluyoStory.describe(phase, sc, story && story.playback, storyNodeName, id=>edgeById(id));
  storySet("stKicker","text",phase==="ready" ? "Historia" : "Historia · "+sc.name);
  storySet("stTitle","text",d.title);
  storySet("stCaption","text",storyError || d.caption);
  storySet("stSummary","text",d.summary);
  storySet("stPlay","hidden",phase==="playing");
  storySet("stPlay","text",phase==="finished" ? "↻ Repetir" : "▶ Reproducir historia");
  storySet("stStop","hidden",phase!=="playing");
  storySet("stOpen","hidden",phase!=="finished");
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
    storyReset();
    doc.cur=j;
    /* la aparición escalonada se reinicia en cada página, como en el editor */
    if(settings.build) restartClock();
    fitView();
    updateTabs();
    updatePresentBar();
    storyRefresh();
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
  if(viewportWired) return;
  viewportWired=true;
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
  const pointers=viewerPointers;
  const localPointers=()=>{
    const r=sv.getBoundingClientRect();
    return [...pointers.values()].map(p=>({x:p.x-r.left,y:p.y-r.top}));
  };
  sv.addEventListener("pointerdown", ev=>{
    if(viewerPhase!=="ready") return;
    sv.setPointerCapture?.(ev.pointerId);
    pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
    if(pointers.size===2){
      viewerPinch=beginViewportPinch(view,...localPointers());
    }
  });
  sv.addEventListener("pointermove", ev=>{
    if(viewerPhase!=="ready") return;
    const prev=pointers.get(ev.pointerId);
    if(!prev) return;
    if(pointers.size===1){
      panViewportBy(view, ev.clientX-prev.x, ev.clientY-prev.y);
    }else if(viewerPinch && pointers.size===2){
      pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
      const [a,b]=localPointers();
      if(viewerPinch.distance===0) viewerPinch=beginViewportPinch(view,a,b);
      updateViewportPinch(view,viewerPinch,a,b);
      return;
    }
    pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
  });
  const release=ev=>{
    pointers.delete(ev.pointerId);
    viewerPinch=pointers.size===2? beginViewportPinch(view,...localPointers()) : null;
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
  storyReset();
  preView={x:view.x, y:view.y, zoom:view.zoom};
  presenting=true;
  document.body.classList.add("presenting");
  $("prBar").hidden=false;
  if(document.documentElement.requestFullscreen)
    document.documentElement.requestFullscreen().catch(()=>{});
  if(settings.build) restartClock();
  /* el chrome se acaba de ocultar: esperar un frame para medir el lienzo
     con su tamaño nuevo antes de encajar la vista */
  const generation=viewerGeneration;
  presentationRaf=requestAnimationFrame(()=>{
    if(generation!==viewerGeneration || viewerPhase!=="ready" || !presenting) return;
    presentationRaf=null;
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
  if(presentationRaf!==null) cancelAnimationFrame(presentationRaf);
  const generation=viewerGeneration;
  presentationRaf=requestAnimationFrame(()=>{
    if(generation!==viewerGeneration || viewerPhase!=="ready") return;
    presentationRaf=null;resizeCanvas(sv, $("wrap"));
  });
}
/* salir de la pantalla completa por la vía del navegador (Esc, F11) también
   deshace el modo; si no, el chrome se quedaría escondido */
document.addEventListener("fullscreenchange", ()=>{
  if(!document.fullscreenElement && presenting) exitPresent();
});

/* ─────────────────────── Abrir en Fluyo ─────────────────────── */

function openInFluyo(){
  if(viewerPhase!=="ready") return;
  if(viewerSourceKey()!==viewerInputKey){bootViewer();return;}
  const generation=viewerGeneration;
  /* El gesto explícito del usuario es el momento semántico fiable: sólo
     aquí se dispara share_opened_in_editor (FLUYO-003 §10). El documento se
     entrega como copia editable vía deep link; nunca hay escritura de vuelta
     hacia el share original. */
  trackEvent("share_opened_in_editor");
  return buildOpenInFluyoURL(serializeProject(), location.href, viewerPayload)
    .then(url=>{
      if(generation===viewerGeneration && viewerPhase==="ready" && viewerSourceKey()===viewerInputKey){
        storyReset();
        location.href=url;
      }
    })
    .catch(err=>{
      if(generation!==viewerGeneration) return;
      console.error("No se pudo preparar la copia editable.");
      setStatus("No se pudo preparar la copia editable. Inténtalo de nuevo.");
    });
}

/* ─────────────────────── Teclado ─────────────────────── */

document.addEventListener("keydown", ev=>{
  if(viewerPhase!=="ready") return;
  /* Espacio sobre un botón lo activa (Reproducir/Detener); en otro sitio pausa el movimiento ambiental. */
  if(ev.key===" " && !(ev.target && ev.target.tagName==="BUTTON")){ ev.preventDefault(); togglePlay(); }
  if(ev.key==="Escape" && presenting) exitPresent();
  if(!presenting) return;
  if(ev.key==="ArrowRight" || ev.key==="PageDown"){ ev.preventDefault(); nextSlide(); }
  if(ev.key==="ArrowLeft" || ev.key==="PageUp"){ ev.preventDefault(); prevSlide(); }
  if(ev.key==="Home"){ ev.preventDefault(); goPage(0); }
  if(ev.key==="End"){ ev.preventDefault(); goPage(doc.pages.length-1); }
});

/* ─────────────────────── Arranque ─────────────────────── */

function viewerSourceKey(){
  try{
    const payload=sharePayloadFromHash(location.hash);
    return payload===null?"fixture:"+location.search:"d:"+payload;
  }catch(e){return null;}
}
async function bootViewer(){
  const key=viewerSourceKey();
  if(key!==null && key===viewerInputKey) return;
  const generation=++viewerGeneration;
  sv=$("sv");
  setViewerPhase("loading");
  clearViewerDocument();
  viewerInputKey=key;
  try{ sctx=sv.getContext("2d"); }
  catch(e){ showShareError("unavailable"); return; }
  if(!sctx){ showShareError("unavailable"); return; }
  setStatus("Cargando diagrama…");
  let loaded;
  const input={hash:location.hash,search:location.search};
  try{ loaded=await loadShareFromLocation(input); }
  catch(e){if(generation===viewerGeneration) showShareError(e&&e.code);return;}
  if(generation!==viewerGeneration) return;
  if(viewerSourceKey()!==key){bootViewer();return;}
  /* FLUYO-018.14a: el lienzo solo pinta con webfonts ya cargadas. Antes del primer
     render se espera (con tope) a las que usa el documento: Playfair o IBM Plex Mono
     en etiquetas y la mono del bloque `code`. Sin ellas se pinta con la reserva. */
  if(typeof waitForRenderFonts==="function"){
    await waitForRenderFonts(loaded.project.doc, 2000, loaded.project.settings);
    if(generation!==viewerGeneration) return;
  }
  /* Instalar el snapshot read-only en el modelo compartido. Es la única
     "instalación" que hace el viewer: el modelo no toca DOM, autosave ni
     persistencia; todo lo demás es estado de vista local a este archivo. */
  try{
    doc=loaded.project.doc;
    settings=loaded.project.settings;
    viewerPayload=loaded.payload;
    playing=true;
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
    $("stOpen").onclick=openInFluyo;
    $("stPlay").onclick=storyPlay;
    $("stStop").onclick=storyReset;
    setViewerPhase("ready");
    storyRefresh();
    setStatus("");
    shareViewed=true;
    trackEvent("share_viewed");
    viewerRaf=requestAnimationFrame(()=>viewerLoop(generation));
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
window.addEventListener("hashchange",()=>{bootViewer();});

/* Gancho de inspección para tests y depuración. Expone sólo estado de
   vista; el documento se lee del modelo compartido. */
window.__viewer={
  get phase(){ return viewerPhase; },
  get view(){ return {...view}; },
  get presenting(){ return presenting; },
  get playing(){ return playing; },
  get cur(){ return doc.cur; },
  get pages(){ return doc.pages.length; },
  get shareViewed(){ return shareViewed; },
  get story(){ return story ? story.status : (storyScenario() ? "ready" : "none"); }
};
