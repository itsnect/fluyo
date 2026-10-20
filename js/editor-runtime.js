"use strict";
/* Bootstrap exclusivo del editor: reloj, renderState, resize y bucle RAF. */

let t0=performance.now(), playing=true, pausedAt=0;

function now(){ return playing? (performance.now()-t0)/1000 : pausedAt; }

/* FLUYO-019.4b (P1, decisión 226): el editor sigue a settings.skin, como Present, el Viewer y la exportación («lo que diseñas
   es lo que presentas»); no hay mando propio. editorSkinOn() es el ÚNICO predicado de «el editor pinta con la piel»: el mismo
   skinActive (umbral SKIN_MIN_PX) sobre los mismos datos que render() recibe aquí (viewport.skin y zoom). Lo usan el acierto,
   el puerto y el textarea (interaction.js). */
function editorSkin(){ return projectSkin(settings); }
function editorSkinOn(){ return typeof skinActive==="function" && skinActive(editorSkin(), viewZoom); }

function buildEditorRenderState(){
  const single=singleSel();
  const rs={
    /* width/height en px CSS: el respaldo del lienzo puede ser mayor (pantallas de alta densidad, FLUYO-018.12)
       y render() escala una sola vez con `dpr`. Todo lo demás —gestos, vista, textarea— sigue en px CSS. */
    viewport:{x:viewX,y:viewY,zoom:viewZoom,width:cv.width/(cv.fluyoDpr||1),height:cv.height/(cv.fluyoDpr||1),dpr:cv.fluyoDpr||1,presenting:!!presenting,
      /* FLUYO-019.1/019.2/019.4b: la piel la decide el documento (settings.skin), en el editor y en Present */
      skin: editorSkin()},
    interaction:{
      mode,
      pendingShape:!!pendingShape,
      pendingIcon:!!pendingIcon,
      pendingAnim:!!pendingAnim,
      connecting,
      linkFrom:typeof touchModes==="function" ? touchModes().link : null,
      drag:!!drag,
      resizing:!!resizing,
      wpDrag:!!wpDrag,
      connectDrag,
      endDrag,
      marquee,
      hoverNode,
      editing,
      mouse:{x:mouse.x,y:mouse.y}
    },
    selection:{
      nodes:new Set(selN),
      edges:new Set(selE),
      single,
      arrowHost:arrowHostNode()
    }
  };
  // Overlay de Scenario playback; la función la provee editor-scenarios.js.
  if(typeof buildScenarioRenderState === "function"){
    const scRS = buildScenarioRenderState();
    if(scRS) rs.scenarioRuntime = scRS;
  }
  return rs;
}

function resizeEditorCanvas(){ resizeCanvas(cv,$("wrap")); }
function scheduleEditorResize(afterResize=null){
  requestAnimationFrame(()=>{
    resizeEditorCanvas();
    if(typeof afterResize==="function") afterResize();
  });
}

function renderEditorFrame(){
  resizeEditorCanvas();
  render(ctx,now(),{renderState:buildEditorRenderState()});
  /* El textarea de edición vive en el DOM, fuera del canvas. */
  if(typeof syncEditBoxIfMoved==="function") syncEditBoxIfMoved();
  /* Deshacer/Rehacer visibles (ui.js): el bucle es el único sitio por el que pasan todos los cambios de las pilas. */
  if(typeof syncHistoryButtons==="function") syncHistoryButtons();
  /* Lectura del zoom en la barra inferior (ui.js, FLUYO-018.13): mismo criterio, solo escribe si cambia. */
  if(typeof syncZoomReadout==="function") syncZoomReadout();
  /* Rótulo del momento sobre el lienzo (editor-scenarios.js, FLUYO-018.18): nunca encima del destino que cuenta. */
  if(typeof scPlaceNow==="function") scPlaceNow();
}

/* Se pide el siguiente frame antes de dibujar para que un fallo aislado no
   detenga definitivamente la animación del editor. */
(function editorLoop(){
  requestAnimationFrame(editorLoop);
  renderEditorFrame();
})();
