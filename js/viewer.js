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
const VIEWER_CONTROLS=["btnFit","btnZoomIn","btnZoomOut","btnPresent","btnOpen","stPlay","stStop","stOpen","pgSelect"];
function setViewerPhase(phase){
  viewerPhase=phase;
  for(const id of VIEWER_CONTROLS) $(id).disabled=phase!=="ready";
  for(const tab of $("pgTabs").children) tab.disabled=phase!=="ready";
}
/* FLUYO-018.18: ¿ha movido la vista quien mira? Mientras no, cualquier cambio de tamaño del lienzo (girar el teléfono, la
   barra del navegador, la banda de la Historia) vuelve a encajar el diagrama. Encajar, cambiar de página o presentar lo
   devuelven a «no». */
let viewMoved=false, wrapObserver=null, preMoved=false;
/* FLUYO-018.30: la cámara de la Historia. followOn = la cámara sigue el momento en curso (Reproducir, Repetir, ⏭/⏮ la encienden;
   arrastrar, pellizcar, la rueda, −/+, Encajar y Detener la apagan); solo actúa si el diagrama entero no se lee
   (viewportFollowZoom). followApplied = ya movió la vista (Detener la devuelve entonces al diagrama entero). camera = transición en
   curso {from,to,t0,dur}, que avanza en cada fotograma. */
let followOn=false, followApplied=false, followKey=null, camera=null, followMemo={scenario:null, page:null, boxes:null};
const CAMERA_MS=450, FOLLOW_MARGIN=16;

/* ───────────────────────────── Estados ───────────────────────────── */

/* FLUYO-I18N-001: texto de la interfaz por FluyoI18n (js/i18n.js); el español es el texto por defecto de cada llamada. Getters: el
   mapa sigue dando textos y se lee en el idioma de ese momento. */
const SHARE_ERROR_MESSAGES={
  get invalid_id(){ return FluyoI18n.t("viewer.error.invalidId","El enlace del diagrama no es válido."); },
  get not_found(){ return FluyoI18n.t("viewer.error.notFound","Este diagrama compartido no está disponible."); },
  get invalid_document(){ return FluyoI18n.t("viewer.error.invalidDocument","El documento compartido no es un diagrama Fluyo válido."); },
  get unsupported_version(){ return FluyoI18n.t("viewer.error.unsupportedVersion","Este diagrama necesita una versión más reciente de Fluyo."); },
  get unavailable(){ return FluyoI18n.t("viewer.error.unavailable","No se pudo cargar el diagrama ahora mismo. Inténtalo de nuevo más tarde."); }
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
  story=null;storyError=null;storyLast={};storyChoice=null;
  followOn=followApplied=false;followKey=camera=null;followMemo={scenario:null, page:null, boxes:null};
  $("story").hidden=true;
  $("stNow").hidden=true;
  storyHome();
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
  $("pgSelect").textContent="";
  $("pgSelect").hidden=true;
  // Limpiar frame parcial y pila/transformación de Canvas tras una excepción.
  if(sv && canvasDirty){
    sv.width=sv.width;
    sctx?.clearRect(0,0,sv.width,sv.height);
    canvasDirty=false;
  }
}
let shareErrorCode=null;
function showShareError(code){
  viewerGeneration++;viewerInputKey=null;
  setViewerPhase("error");
  clearViewerDocument();
  shareErrorCode=code;
  setStatus(SHARE_ERROR_MESSAGES[code]||SHARE_ERROR_MESSAGES.unavailable);
}

/* ─────────────────────── Render y bucle ─────────────────────── */

function viewerRenderState(){
  /* Tamaño en px CSS y densidad aparte: resizeCanvas dimensiona el respaldo a la densidad de la pantalla (FLUYO-018.12). */
  const dpr=sv.fluyoDpr||1;
  return makeReadOnlyRenderState({
    x:view.x, y:view.y, zoom:view.zoom,
    width:sv.width/dpr, height:sv.height/dpr, dpr, presenting,
    /* FLUYO-019.2: el aspecto lo dice el documento compartido (settings.skin); se aplica en la vista normal y en Present.
       Sin conmutador: el Viewer lee, no decide. Por debajo de 3 px de canto en pantalla, skinActive lo apaga solo. */
    skin: projectSkin(settings)
  });
}
function renderViewerFrame(){
  resizeCanvas(sv, $("wrap"));
  canvasDirty=true;
  /* FLUYO-018.30: la cámara antes de pintar, para que el lienzo y el rótulo (storyPlace) usen la misma vista */
  storyFollow();
  cameraStep();
  const rs=viewerRenderState();
  /* La Historia se pinta con el mismo runtime que el editor (story-playback.js), con el reloj de story-clock.js: en pausa,
     la proyección se queda quieta. */
  if(story){
    /* FLUYO-018.29 (G1): el momento al que se saltó en pausa se ve entero ya (story-clock.js) */
    rs.scenarioRuntime=FluyoStoryClock.reveal(FluyoStory.renderState(story.playback, story.scenario, storyNow()), story.playback);
    /* SCENARIOS-SEMANTICS-001 FASE 5 (D7): lo que el lienzo pinta de la ruta observada, la misma receta que el editor y Present */
    const flow=storyFlowOverlay();
    if(flow) rs.scenarioRuntime.flow=flow;
  }
  render(sctx, now(), {renderState:rs, emptyHint:FluyoI18n.t("viewer.emptyPage","Esta página no contiene elementos.")});
  if(story && story.status==="running" && !FluyoStoryClock.isPaused(story.clock) && FluyoStory.isFinished(story.playback)) story.status="completed";
  storyRefresh();
  storyPlace();
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
/* FLUYO-STORIES-2.0 S2a: la Historia elegida en «Otras formas» (id, de la página abierta), efímera como el runtime: nunca toca el
   documento, se olvida al cambiar de página o de documento. Sin elección, la de siempre: scenarios[0] (la que se compartió). La
   familia es la página (D1): las otras formas solo existen si scenarios[0] es una Historia con pasos. */
let storyChoice=null;
function storyScenario(){
  const pg=doc.pages[doc.cur], sc=pg && pg.scenarios && pg.scenarios[0];
  if(!sc || !sc.steps.length) return null;
  return (storyChoice!==null && pg.scenarios.find(s=>s.id===storyChoice && s.steps.length)) || sc;
}
/* Abrir otra forma: se detiene la que había (y la vista vuelve al diagrama entero si la cámara la seguía) y queda lista, con su portada. */
function storyOpen(id){
  if(viewerPhase!=="ready") return;
  storyChoice=id;
  storyStop();
}
function storyNodeName(id){
  const n=nodeById(id);
  return (n && String(n.label||"").split("\n")[0].trim()) || FluyoI18n.t("story.unnamed","Elemento sin nombre");
}
/* FLUYO-018.18: Reproducir también en Presentar (antes no se podía); pausar, reanudar y saltar entre momentos con el MISMO reloj
   que el editor (story-clock.js). La unidad es el momento. Nada de esto toca el documento instalado. */
function storyNow(){ return story ? FluyoStoryClock.now(story.clock, performance.now()) : performance.now(); }
function storyPlay(){
  if(viewerPhase!=="ready") return;
  const sc=storyScenario();
  if(!sc || (story && story.status==="running")) return;
  storyReset();
  const clock=FluyoStoryClock.create();
  /* FLUYO-018.21: la misma receta + el instante visible de cada momento (dependencias de llegada) */
  const started=FluyoStoryClock.start(P(), sc, FluyoStoryClock.now(clock, performance.now()), FluyoI18n.t);
  if(!started.ok){ storyError=started.errors[0]||null; storyRefresh(); return; }
  story={scenario:sc, playback:started.playback, status:"running", clock};
  followOn=true; followKey=null;
  storyRefresh();
}
function storyPaused(){ return !!story && story.status==="running" && FluyoStoryClock.isPaused(story.clock); }
function storyTogglePause(){
  if(!story || story.status!=="running") return;
  if(FluyoStoryClock.isPaused(story.clock)) FluyoStoryClock.resume(story.clock, performance.now());
  else FluyoStoryClock.pause(story.clock, performance.now());
  storyRefresh();
}
function storyNav(){
  if(!story) return {times:[], index:-1, prev:null, next:null};
  const times=FluyoStoryClock.momentTimes(story.scenario, story.playback), vt=story.playback.cursorVirtual||0, index=FluyoStoryClock.momentIndex(times, vt);
  const done=story.status==="completed";
  return {times, index, prev:done ? (times.length ? times.length-1 : null) : FluyoStoryClock.prevTarget(times, vt), next:done ? null : FluyoStoryClock.nextTarget(times, vt)};
}
function storySeek(i){
  if(!story || i===null) return;
  if(story.status==="completed") FluyoStoryClock.pause(story.clock, performance.now());
  const r=FluyoStoryClock.seek(story.clock, performance.now(), P(), story.scenario, i);
  if(!r.ok) return;
  story.playback=r.playback; story.status="running";
  /* saltar es pedir ver ESE momento: la cámara vuelve a seguir aunque se hubiera movido la vista */
  followOn=true; followKey=null;
  storyRefresh();
}
function storyPrev(){ storySeek(storyNav().prev); }
function storyNext(){ storySeek(storyNav().next); }
function storyReset(){
  story=null; storyError=null;
  followOn=followApplied=false; followKey=null; camera=null;
  if(viewerPhase==="ready") storyRefresh();
}
/* Detener: si la cámara de la Historia llegó a acercarse (aunque luego quien mira moviera la vista), vuelve al diagrama entero: el
   estado de antes de reproducir. Donde no hizo falta seguir (escritorio), la vista no se toca. */
function storyStop(){
  const back=followApplied;
  storyReset();
  if(back && viewerPhase==="ready"){ viewMoved=false; cameraTo(fitTarget()); }
}

/* ─────────────────────── Cámara de la Historia (FLUYO-018.30) ───────────────────────
   En un teléfono en vertical el diagrama entero sale a zoom 0,26–0,44 (etiquetas de 3–7 px) y no cambia en toda la Historia:
   se ve DÓNDE pasa algo, pero no QUÉ. Reproduciendo, si el diagrama entero no se lee (viewportFollowZoom), la cámara se acerca
   a un zoom legible (≥ 0,6, ≤ 1, el mismo en toda la Historia) y, al cambiar de momento, se desplaza para enseñarlo entero en la
   zona libre (bajo el rótulo y, presentando, sobre el mando) solo si no se ve ya. Nunca en cada fotograma: solo al cambiar de
   momento, al saltar y al cambiar el tamaño del lienzo. Donde el diagrama entero se lee (escritorio, tableta) nada cambia. */
function viewerFreeRect(){
  const r=$("wrap").getBoundingClientRect();
  const card=$("stNow"), top=card && !card.hidden && card.offsetHeight ? card.offsetHeight+20 : 0;
  const bottom=presenting && !$("prBar").hidden && $("prBar").offsetHeight ? $("prBar").offsetHeight+28 : 0;
  return {left:0, top, width:r.width, height:Math.max(40, r.height-top-bottom)};
}
/* La caja de cada momento (mismo orden que FluyoStoryClock.momentTimes): sus elementos, los dos extremos y el trazado de sus
   conexiones, con aire para el globo (encima) y la etiqueta de icono/imagen (debajo). focus = su primer elemento (o el punto
   medio de su primera conexión), lo que se centra si el momento no cabe. */
function followBoxes(){
  const pg=P(), sc=story.scenario;
  if(followMemo.scenario===sc && followMemo.page===pg) return followMemo.boxes;
  const times=FluyoStoryClock.momentTimes(sc);
  const boxes=times.map(at=>{
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity, focus=null;
    const addNode=nd=>{ if(!nd) return; x0=Math.min(x0,nd.x-nd.w/2); y0=Math.min(y0,nd.y-nd.h/2); x1=Math.max(x1,nd.x+nd.w/2); y1=Math.max(y1,nd.y+nd.h/2); };
    for(const st of sc.steps){
      if(st.at!==at) continue;
      if(st.edgeId){
        const e=edgeById(st.edgeId); if(!e) continue;
        addNode(nodeById(e.from)); addNode(nodeById(e.to));
        const pts=edgePoints(e)||[];
        for(const p of pts){ x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x); y1=Math.max(y1,p.y); }
        if(!focus && pts.length) focus={x:(pts[0].x+pts[pts.length-1].x)/2, y:(pts[0].y+pts[pts.length-1].y)/2, hw:0, hh:0, edge:true};
      } else {
        const nd=nodeById(st.nodeId); addNode(nd);
        if(nd && (!focus || focus.edge)) focus={x:nd.x, y:nd.y, hw:nd.w/2+12, hh:nd.h/2+24};
      }
    }
    if(!Number.isFinite(x0)) return null;
    x0-=12; x1+=12; y0-=40; y1+=24;
    return {x:x0, y:y0, w:x1-x0, h:y1-y0, focus};
  });
  followMemo={scenario:sc, page:pg, boxes};
  return boxes;
}
/* El encuadre del diagrama entero, sin aplicarlo (lo que haría fitView). */
function fitTarget(){
  const r=$("wrap").getBoundingClientRect(), f=viewerFreeRect();
  const vp=fitViewportToBounds({x:0, y:0, zoom:view.zoom}, getBounds(), r.width, f.height);
  vp.y+=f.top;
  return vp;
}
function prefersReducedMotion(){ try{ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; } }
function cameraTo(target, instant){
  if(!target || ![target.x,target.y,target.zoom].every(Number.isFinite)) return;
  if(instant || prefersReducedMotion()){ camera=null; Object.assign(view, {x:target.x, y:target.y, zoom:target.zoom}); return; }
  camera={from:{x:view.x, y:view.y, zoom:view.zoom}, to:{x:target.x, y:target.y, zoom:target.zoom}, t0:performance.now(), dur:CAMERA_MS};
}
function cameraStep(){
  if(!camera) return;
  const k=Math.min(1, Math.max(0, (performance.now()-camera.t0)/camera.dur)), e=k<.5 ? 4*k*k*k : 1-Math.pow(-2*k+2,3)/2;
  const r=$("wrap").getBoundingClientRect();
  Object.assign(view, lerpViewport(camera.from, camera.to, e, r.width/2, r.height/2));
  if(k>=1) camera=null;
}
/* Quien mira toma la cámara: la Historia deja de moverla hasta Reproducir/Repetir o ⏭/⏮. */
function takeCamera(){ viewMoved=true; followOn=false; camera=null; }
/* ¿Sigue la cámara AHORA? Devuelve el zoom de seguimiento o null. */
function followZoomNow(){
  if(!story || !followOn) return null;
  return viewportFollowZoom(followBoxes(), viewerFreeRect(), fitTarget().zoom, FOLLOW_MARGIN);
}
/* Encuadra el momento en curso (o el primero, si aún no ha llegado ninguno), solo si no se ve ya entero. instant: sin transición
   (al cambiar el tamaño del lienzo). */
function followFrame(instant){
  const z=followZoomNow();
  if(z===null) return false;
  const boxes=followBoxes(), i=Math.max(0, storyNav().index), box=boxes[i] || boxes.find(Boolean);
  if(!box) return false;
  const from=camera ? camera.to : view;
  const target=viewportFrameBox(from, box, viewerFreeRect(), z, FOLLOW_MARGIN, box.focus);
  followApplied=true; viewMoved=false;
  if(target) cameraTo(target, instant);
  return true;
}
function storyFollow(){
  if(!story || !followOn) return;
  const key=storyNav().index+"";
  if(key===followKey) return;
  followKey=key;
  followFrame(false);
}
/* El lienzo cambió de tamaño (girar, la barra del navegador): seguir encuadrando el momento o, si no se sigue, el diagrama entero. */
function viewerReframe(){
  if(followOn && followZoomNow()!==null){ camera=null; followFrame(true); return; }
  if(!viewMoved) fitView();
}
function storySet(id, prop, value){
  const key=id+"."+prop;
  if(storyLast[key]===value) return;
  storyLast[key]=value;
  const el=$(id);
  if(prop==="text") el.textContent=value; else el[prop]=value;
}
function storyGlyph(id, glyph, cls, label){
  const key=id+".glyph";
  if(storyLast[key]===label) return;
  storyLast[key]=label;
  const el=$(id);
  if(typeof el.replaceChildren!=="function" || typeof document.createTextNode!=="function"){ el.textContent=glyph+" "+label; return; }
  /* glifo y rótulo en UN elemento en línea: el innerText del botón (flex) sigue siendo «▶ Reproducir historia» */
  const w=document.createElement("span"), g=document.createElement("span");
  w.className="glyphText"; g.className="glyph "+cls; g.textContent=glyph; g.setAttribute("aria-hidden","true");
  w.append(g, document.createTextNode(" "+label)); el.replaceChildren(w);
}
function storyPauseLabel(paused){
  const label=paused ? FluyoI18n.t("story.resume","Reanudar") : FluyoI18n.t("story.pause","Pausar");
  if(storyLast["stPause.label"]===label) return;
  storyLast["stPause.label"]=label;
  if(typeof document.createElementNS!=="function" || typeof $("stPause").replaceChildren!=="function"){ $("stPause").textContent=label; return; }
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"), use=document.createElementNS("http://www.w3.org/2000/svg","use");
  svg.setAttribute("class","ic"); svg.setAttribute("aria-hidden","true"); use.setAttribute("href", paused ? "#i-play" : "#i-pause"); svg.appendChild(use);
  $("stPause").replaceChildren(svg, document.createTextNode(label));
}
function storyRefresh(){
  const sc=viewerPhase==="ready" ? storyScenario() : null;
  storySet("story","hidden",!sc);
  storySet("stNow","hidden",!sc);
  storySet("prStory","hidden",!sc);
  if(!sc) return;
  const paused=storyPaused();
  const phase=!story ? "ready" : story.status==="running" ? "playing" : "finished";
  const d=FluyoStoryClock.describe(phase, sc, story && story.playback, storyNodeName, id=>edgeById(id), FluyoI18n.t);
  /* S2a: en la portada, el sistema (el nombre de la página; «Historia» si es el de semilla) encima del nombre de la Historia */
  storySet("stKicker","text",phase==="ready" ? (FluyoStoryClock.systemName(P(), FluyoI18n.t) || FluyoI18n.t("story.group","Historia")) : FluyoI18n.t("story.kicker","Historia · {name}",{name:sc.name}));
  storySet("stTitle","text",d.title);
  /* PRODUCT-NARRATION-001 (D-PO-2): solo el título con una frase del autor puede crecer en vez de cortarse (share.css) */
  storySet("stTitle","className","stTitle"+(phase!=="ready" && d.moments[d.idx] && d.moments[d.idx].narrated ? " narrated" : ""));
  storySet("stCaption","text",storyError || (paused ? (d.caption ? FluyoI18n.t("story.pausedCaption","En pausa · {caption}",{caption:d.caption}) : FluyoI18n.t("story.paused","En pausa")) : d.caption));
  /* FLUYO-STORIES-2.0 S1b: el desenlace al terminar, del mismo cálculo que Present y el editor (FluyoStoryClock); S2a (D5): también
     en la portada, antes de reproducir */
  if($("stOutcome")) storySet("stOutcome","text",FluyoStoryClock.phaseOutcome(phase, P(), sc, story && story.playback, FluyoI18n.t));
  if($("stOthers")) storyOthers(phase==="finished" ? FluyoStoryClock.otherForms(P(), sc).slice(0, 3) : []);
  storySet("stSummary","text",d.summary);
  storySet("stProgress","text",phase!=="ready" && d.moments.length>1 ? Math.max(0,d.idx+1)+" / "+d.moments.length : "");
  /* SCENARIOS-SEMANTICS-001 FASE 5 (D7, decisión 246): la línea de estado de la ruta, solo reproduciendo (también en pausa y terminada) */
  if($("stFlow")){
    const route=phase!=="ready" ? storyFlowLine() : null;
    storySet("stFlow","hidden",!route);
    if(route){ storySet("stFlow","text",route.text); storySet("stFlow","className","stFlow is"+route.status); }
  }
  storySet("stPlay","hidden",phase==="playing");
  if(phase==="finished") storyGlyph("stPlay","↻","g-replay",FluyoI18n.t("story.replay","Repetir"));
  else storyGlyph("stPlay","▶","g-play",FluyoI18n.t("story.playStory","Reproducir historia"));
  storySet("stPause","hidden",phase!=="playing");
  if(phase==="playing") storyPauseLabel(paused);
  const nav=storyNav();
  storySet("stPrev","hidden",phase==="ready");
  storySet("stNext","hidden",phase==="ready");
  storySet("stPrev","disabled",nav.prev===null);
  storySet("stNext","disabled",nav.next===null);
  storySet("stStop","hidden",phase==="ready");
  if(phase!=="ready") storyGlyph("stStop","■","g-stop",FluyoI18n.t("story.stop","Detener"));
  /* «Abrir en Fluyo» está siempre en la cabecera: repetirlo en la banda la partía en dos filas al terminar (018.18). */
  storySet("stOpen","hidden",true);
}
/* FLUYO-STORIES-2.0 S2a: «Otras formas», al terminar: hasta 3 Historias más de la página, con su nombre (contenido del autor) y su
   desenlace. Elegir una la abre en su portada, sin recargar. Solo se reescribe si cambia la lista o el idioma. */
function storyOthers(list){
  const items=list.map(s=>({id:s.id, name:s.name, outcome:FluyoStoryClock.outcomeText(FluyoStoryClock.outcomeOf(P(), s), FluyoI18n.t)}));
  const sig=JSON.stringify(items);
  if(storyLast["stOthers.sig"]===sig) return;
  storyLast["stOthers.sig"]=sig;
  const box=$("stOthersList");
  box.textContent="";
  for(const it of items){
    const b=document.createElement("button"), name=document.createElement("span"), out=document.createElement("span");
    b.type="button"; b.className="stOther";
    name.className="stOtherName"; name.textContent=it.name;
    out.className="stOtherOutcome"; out.textContent=it.outcome;
    b.appendChild(name); b.appendChild(out);
    b.onclick=()=>storyOpen(it.id);
    box.appendChild(b);
  }
  $("stOthers").hidden=!items.length;
}
/* El rótulo de la Historia va arriba del lienzo; si el destino del momento en curso queda debajo, baja al pie. */
let storyPlaceKey="";
function storyPlace(){
  const card=$("stNow");
  if(!card || card.hidden) return;
  const W=$("wrap").getBoundingClientRect(), h=card.offsetHeight||0, w=card.offsetWidth||0, left=(W.width-w)/2, M=10;
  const bottomInset=presenting ? ($("prBar").offsetHeight||0)+28 : 0;
  const rects=[];
  if(story){
    const n=storyNav(), at=n.index>=0 ? FluyoStoryClock.momentTimes(story.scenario)[n.index] : null;
    const box=(x0,y0,x1,y1)=>({left:x0*view.zoom+view.x, top:y0*view.zoom+view.y, right:x1*view.zoom+view.x, bottom:y1*view.zoom+view.y});
    for(const step of story.scenario.steps){
      if(step.at!==at) continue;
      if(step.edgeId){ const e=edgeById(step.edgeId), pts=e ? edgePoints(e) : null; if(pts && pts.length) rects.push(box(Math.min(...pts.map(p=>p.x)),Math.min(...pts.map(p=>p.y)),Math.max(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.y)))); for(const nd of e ? [nodeById(e.from), nodeById(e.to)] : []) if(nd) rects.push(box(nd.x-nd.w/2,nd.y-nd.h/2,nd.x+nd.w/2,nd.y+nd.h/2)); }
      else { const nd=nodeById(step.nodeId); if(nd) rects.push(box(nd.x-nd.w/2,nd.y-nd.h/2,nd.x+nd.w/2,nd.y+nd.h/2)); }
    }
  }
  const hit=y=>rects.some(r=>r.right>left-8 && r.left<left+w+8 && r.bottom>y-8 && r.top<y+h+8);
  const top=M, bottom=W.height-bottomInset-h-M;
  const y=hit(top) && bottom>top && !hit(bottom) ? bottom : top;
  const key=Math.round(y)+"";
  if(key===storyPlaceKey) return;
  storyPlaceKey=key;
  card.style.top=Math.round(y)+"px";
  card.classList.toggle("atBottom", y!==top);
}
/* ─────────────────────── Ruta observada (SCENARIOS-SEMANTICS-001 FASE 5; D7, decisiones 245–246) ───────────────────────
   El Viewer pinta lo que diga el documento, sin bandera: reproduciendo la Historia (también en pausa y terminada) y con un par
   resuelto (FluyoFlow.resolveObservedFlow), las fundas, el barrido y las marcas de nodo de la ruta en el lienzo, y una línea de
   estado en el rótulo (#stFlow; la banda sigue siendo solo el transporte). Misma regla de existencia que la herramienta del editor
   (D6): la página tiene alguna conexión Flujo. Sin selectores, filas ni línea de tiempo. Lee el Trace VISIBLE de la reproducción y
   su cursor: lo mismo que el editor y Present en el mismo instante. ENDPOINT_MISSING y sin par: nada; NO_PATH: solo la línea.
   Con el service worker anterior (sin flow-semantics.js) nada de esto existe y el documento se ve como antes. */
let storyFlowMemo={playback:null, page:null, value:null};
function storyFlowData(){
  if(!story || typeof FluyoFlow==="undefined") return null;
  const pg=P(), pb=story.playback;
  if(storyFlowMemo.playback===pb && storyFlowMemo.page===pg) return storyFlowMemo.value;
  let value=null;
  try{
    if(pg.edges.some(e=>edgeKind(e)==="FLOWS_TO")){
      const pair=FluyoFlow.resolveObservedFlow(pg, story.scenario);
      if(pair.state===FluyoFlow.PAIR){
        const events=pb.trace.events, route=FluyoFlow.flowRoute(pg, pair.source, pair.target);
        /* sin línea de tiempo en el Viewer: el fin solo da sus tramos, que no se pintan (lo pintado sale de los instantes) */
        value={events, timeOf:st=>FluyoStoryClock.visibleAt(pb, st), route, tl:FluyoFlow.routeTimeline(pg, route, events, 0)};
      }
    }
  }catch(err){ if(!err || typeof err.code!=="string") throw err; }
  storyFlowMemo={playback:pb, page:pg, value};
  return value;
}
function storyFlowOverlay(){
  const d=storyFlowData();
  return d && d.tl ? FluyoFlow.routeOverlay(P(), d.route, d.tl, story.playback.cursorVirtual||0) : null;
}
function storyFlowLine(){
  const d=storyFlowData();
  if(!d) return null;
  try{ return FluyoFlow.routeLine(P(), story.scenario, d.events, story.playback.cursorVirtual||0, d.timeOf); }
  catch(err){ if(!err || typeof err.code!=="string") throw err; return null; }
}
/* El transporte vive en la banda y, presentando, se muda al mando (mismos nodos, mismos ids). */
function storyHome(){ const a=$("stActions"); if(a && a.parentNode && a.parentNode!==$("story")) $("story").appendChild(a); }

/* ─────────────────────── Navegación de páginas ─────────────────────── */

function buildTabs(){
  const nav=$("pgTabs"), sel=$("pgSelect");
  sel.textContent="";
  doc.pages.forEach((pg,i)=>{
    const o=document.createElement("option");
    o.value=String(i); o.textContent=String(i+1).padStart(2,"0")+" · "+(pg.name||FluyoI18n.t("page.untitled","Página {n}",{n:i+1}));
    sel.appendChild(o);
  });
  sel.value=String(doc.cur);
  sel.onchange=()=>goPage(+sel.value);
  sel.hidden=doc.pages.length<2;
  nav.textContent="";
  doc.pages.forEach((pg,i)=>{
    const b=document.createElement("button");
    b.type="button";
    b.textContent=pg.name||FluyoI18n.t("page.untitled","Página {n}",{n:i+1});
    b.className=i===doc.cur? "active":"";
    b.setAttribute("aria-current", i===doc.cur? "page":"false");
    b.onclick=()=>goPage(i);
    nav.appendChild(b);
  });
  $("pgTabs").hidden=doc.pages.length<2;
}
function updateTabs(){
  $("pgSelect").value=String(doc.cur);
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
    storyChoice=null;
    storyReset();
    doc.cur=j;
    /* la aparición escalonada se reinicia en cada página, como en el editor */
    if(settings.build) restartClock();
    storyRefresh();
    fitView();
    updateTabs();
    updatePresentBar();
    storyRefresh();
  }catch(e){ showShareError("invalid_document"); }
}
function nextSlide(){ goPage(doc.cur+1); }
function prevSlide(){ goPage(doc.cur-1); }

/* ─────────────────────── Vista: pan y zoom ─────────────────────── */

/* FLUYO-018.18: se encaja en el lienzo REAL (después de colocar la banda de la Historia) y se reserva arriba el rótulo de la
   Historia y, presentando, abajo el mando: el diagrama no nace debajo de ninguno de los dos. */
function fitView(){
  /* la zona libre y el encuadre los calcula fitTarget (FLUYO-018.30: la misma zona que usa la cámara de la Historia) */
  Object.assign(view, fitTarget());
  camera=null;
  viewMoved=false;
  if(![view.x,view.y,view.zoom].every(Number.isFinite)) throw projectDataError();
}
function zoomAtClient(factor, clientX, clientY){
  takeCamera();
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
    takeCamera();
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
      if(ev.clientX!==prev.x || ev.clientY!==prev.y) takeCamera();
      panViewportBy(view, ev.clientX-prev.x, ev.clientY-prev.y);
    }else if(viewerPinch && pointers.size===2){
      pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
      const [a,b]=localPointers();
      if(viewerPinch.distance===0) viewerPinch=beginViewportPinch(view,a,b);
      takeCamera();
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
  /* si la cámara seguía la Historia, al salir se vuelve al diagrama entero, no al momento en que se entró */
  const followed=followApplied;
  storyReset();
  if(followed) fitView();
  preView={x:view.x, y:view.y, zoom:view.zoom}; preMoved=viewMoved;
  presenting=true;
  document.body.classList.add("presenting");
  /* la Historia se puede reproducir también presentando: su transporte se muda al mando (FLUYO-018.18) */
  $("prStory").appendChild($("stActions"));
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
  storyReset();
  storyHome();
  document.body.classList.remove("presenting");
  $("prBar").hidden=true;
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  if(preView){ Object.assign(view, preView); preView=null; viewMoved=preMoved; }
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
      setStatus(FluyoI18n.t("viewer.openFailed","No se pudo preparar la copia editable. Inténtalo de nuevo."));
    });
}

/* ─────────────────────── Teclado ─────────────────────── */

document.addEventListener("keydown", ev=>{
  if(viewerPhase!=="ready") return;
  /* Espacio sobre un botón lo activa (Reproducir/Detener); en otro sitio pausa la Historia si se está reproduciendo
     (FLUYO-018.18) o, si no, el movimiento ambiental. */
  if(ev.key===" " && !(ev.target && ev.target.tagName==="BUTTON")){ ev.preventDefault(); if(story && story.status==="running") storyTogglePause(); else togglePlay(); }
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
  setStatus(FluyoI18n.t("viewer.loading","Cargando diagrama…"));
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
    /* Encajar enseña el diagrama entero también reproduciendo: la cámara deja de seguir hasta ⏭/⏮ o Reproducir (FLUYO-018.30) */
    $("btnFit").onclick=()=>{ followOn=false; followApplied=false; fitView(); };
    $("btnZoomIn").onclick=()=>{ zoomAtClient(1.25, ...centerClient()); };
    $("btnZoomOut").onclick=()=>{ zoomAtClient(0.8, ...centerClient()); };
    $("btnPresent").onclick=enterPresent;
    $("prPrev").onclick=prevSlide;
    $("prNext").onclick=nextSlide;
    $("prExit").onclick=exitPresent;
    $("btnOpen").onclick=openInFluyo;
    $("stOpen").onclick=openInFluyo;
    $("stPlay").onclick=storyPlay;
    $("stStop").onclick=storyStop;
    $("stPause").onclick=storyTogglePause;
    $("stPrev").onclick=storyPrev;
    $("stNext").onclick=storyNext;
    setViewerPhase("ready");
    storyRefresh();
    /* FLUYO-018.18 (D9): encajar DESPUÉS de colocar la banda y el rótulo de la Historia (antes se encajaba en el lienzo sin
       ellos y el diagrama nacía cortado: apaisado y 1280 × 720), y otra vez si el lienzo cambia de tamaño mientras nadie ha
       movido la vista (girar el teléfono). */
    resizeCanvas(sv, $("wrap"));
    fitView();
    if(!wrapObserver && typeof ResizeObserver==="function"){
      wrapObserver=new ResizeObserver(()=>{ if(viewerPhase==="ready" && (followOn || !viewMoved) && !presentationRaf){ try{ resizeCanvas(sv, $("wrap")); viewerReframe(); }catch(e){ showShareError("invalid_document"); } } });
      wrapObserver.observe($("wrap"));
    }
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
/* FLUYO-I18N-002 (S0): cambiar de idioma en vivo. Lo marcado en el HTML ya lo traduce FluyoI18n; aquí se repinta lo que pone JS
   (pestañas, banda de la Historia, aviso de estado). El lienzo se repinta en cada fotograma. El documento no cambia. */
if(typeof FluyoI18n==="object") FluyoI18n.onChange(()=>{
  if(viewerPhase==="ready"){ buildTabs(); storyRefresh(); }
  else if(viewerPhase==="error") setStatus(SHARE_ERROR_MESSAGES[shareErrorCode]||SHARE_ERROR_MESSAGES.unavailable);
  else if(viewerPhase==="loading") setStatus(FluyoI18n.t("viewer.loading","Cargando diagrama…"));
});

/* FLUYO-SW-VIEWER-001: quien solo abre un enlace también tiene el enlace sin red desde su segunda apertura. Mismo service worker
   y mismo ámbito que el editor (../sw.js, «/»); instalado desde aquí precachea solo lo del Viewer (sw.js, VIEWER_ASSETS), sin
   gif.js ni terceros. Como en el editor (FLUYO-004): solo en http/https y tras «load», para no competir con la primera carga. */
function registerViewerServiceWorker(){
  if(location.protocol!=="http:" && location.protocol!=="https:") return;
  if(typeof navigator==="undefined" || !("serviceWorker" in navigator)) return;
  const register=()=> navigator.serviceWorker.register("../sw.js").catch(console.error);
  if(document.readyState==="complete") register();
  else window.addEventListener("load", register, {once:true});
}
registerViewerServiceWorker();

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
  get story(){ return story ? story.status : (storyScenario() ? "ready" : "none"); },
  /* FLUYO-018.30: la cámara de la Historia */
  get follow(){ return {on:followOn, applied:followApplied, moving:!!camera, zoom:story && followOn ? followZoomNow() : null}; }
};
