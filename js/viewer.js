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
    width:sv.width/dpr, height:sv.height/dpr, dpr, presenting,
    /* FLUYO-019.2: el aspecto lo dice el documento compartido (settings.skin); se aplica en la vista normal y en Present.
       Sin conmutador: el Viewer lee, no decide. Por debajo de 3 px de canto en pantalla, skinActive lo apaga solo. */
    skin: projectSkin(settings)
  });
}
function renderViewerFrame(){
  resizeCanvas(sv, $("wrap"));
  canvasDirty=true;
  const rs=viewerRenderState();
  /* La Historia se pinta con el mismo runtime que el editor (story-playback.js), con el reloj de story-clock.js: en pausa,
     la proyección se queda quieta. */
  if(story) rs.scenarioRuntime=FluyoStory.renderState(story.playback, story.scenario, storyNow());
  render(sctx, now(), {renderState:rs, emptyHint:"Esta página no contiene elementos."});
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
function storyScenario(){
  const pg=doc.pages[doc.cur], sc=pg && pg.scenarios && pg.scenarios[0];
  return sc && sc.steps.length ? sc : null;
}
function storyNodeName(id){
  const n=nodeById(id);
  return (n && String(n.label||"").split("\n")[0].trim()) || "Elemento sin nombre";
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
  const started=FluyoStoryClock.start(P(), sc, FluyoStoryClock.now(clock, performance.now()));
  if(!started.ok){ storyError=started.errors[0]||null; storyRefresh(); return; }
  story={scenario:sc, playback:started.playback, status:"running", clock};
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
  storyRefresh();
}
function storyPrev(){ storySeek(storyNav().prev); }
function storyNext(){ storySeek(storyNav().next); }
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
  const label=paused ? "Reanudar" : "Pausar";
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
  const d=FluyoStoryClock.describe(phase, sc, story && story.playback, storyNodeName, id=>edgeById(id));
  storySet("stKicker","text",phase==="ready" ? "Historia" : "Historia · "+sc.name);
  storySet("stTitle","text",d.title);
  storySet("stCaption","text",storyError || (paused ? (d.caption ? "En pausa · "+d.caption : "En pausa") : d.caption));
  storySet("stSummary","text",d.summary);
  storySet("stProgress","text",phase!=="ready" && d.moments.length>1 ? Math.max(0,d.idx+1)+" / "+d.moments.length : "");
  storySet("stPlay","hidden",phase==="playing");
  if(phase==="finished") storyGlyph("stPlay","↻","g-replay","Repetir");
  else storyGlyph("stPlay","▶","g-play","Reproducir historia");
  storySet("stPause","hidden",phase!=="playing");
  if(phase==="playing") storyPauseLabel(paused);
  const nav=storyNav();
  storySet("stPrev","hidden",phase==="ready");
  storySet("stNext","hidden",phase==="ready");
  storySet("stPrev","disabled",nav.prev===null);
  storySet("stNext","disabled",nav.next===null);
  storySet("stStop","hidden",phase==="ready");
  if(phase!=="ready") storyGlyph("stStop","■","g-stop","Detener");
  /* «Abrir en Fluyo» está siempre en la cabecera: repetirlo en la banda la partía en dos filas al terminar (018.18). */
  storySet("stOpen","hidden",true);
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
/* El transporte vive en la banda y, presentando, se muda al mando (mismos nodos, mismos ids). */
function storyHome(){ const a=$("stActions"); if(a && a.parentNode && a.parentNode!==$("story")) $("story").appendChild(a); }

/* ─────────────────────── Navegación de páginas ─────────────────────── */

function buildTabs(){
  const nav=$("pgTabs"), sel=$("pgSelect");
  sel.textContent="";
  doc.pages.forEach((pg,i)=>{
    const o=document.createElement("option");
    o.value=String(i); o.textContent=String(i+1).padStart(2,"0")+" · "+(pg.name||("Página "+(i+1)));
    sel.appendChild(o);
  });
  sel.value=String(doc.cur);
  sel.onchange=()=>goPage(+sel.value);
  sel.hidden=doc.pages.length<2;
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
  const r=$("wrap").getBoundingClientRect();
  const card=$("stNow"), top=card && !card.hidden && card.offsetHeight ? card.offsetHeight+20 : 0;
  const bottom=presenting && !$("prBar").hidden && $("prBar").offsetHeight ? $("prBar").offsetHeight+28 : 0;
  fitViewportToBounds(view, getBounds(), r.width, Math.max(40, r.height-top-bottom));
  view.y+=top;
  viewMoved=false;
  if(![view.x,view.y,view.zoom].every(Number.isFinite)) throw projectDataError();
}
function zoomAtClient(factor, clientX, clientY){
  viewMoved=true;
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
    viewMoved=true;
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
      if(ev.clientX!==prev.x || ev.clientY!==prev.y) viewMoved=true;
      panViewportBy(view, ev.clientX-prev.x, ev.clientY-prev.y);
    }else if(viewerPinch && pointers.size===2){
      pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
      const [a,b]=localPointers();
      if(viewerPinch.distance===0) viewerPinch=beginViewportPinch(view,a,b);
      viewMoved=true;
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
      setStatus("No se pudo preparar la copia editable. Inténtalo de nuevo.");
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
      wrapObserver=new ResizeObserver(()=>{ if(viewerPhase==="ready" && !viewMoved && !presentationRaf){ try{ resizeCanvas(sv, $("wrap")); fitView(); }catch(e){ showShareError("invalid_document"); } } });
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
