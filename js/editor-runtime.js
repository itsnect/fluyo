"use strict";
/* Bootstrap exclusivo del editor: reloj, renderState, resize y bucle RAF. */

let t0=performance.now(), playing=true, pausedAt=0;

function now(){ return playing? (performance.now()-t0)/1000 : pausedAt; }

function buildEditorRenderState(){
  const single=singleSel();
  const rs={
    /* width/height en px CSS: el respaldo del lienzo puede ser mayor (pantallas de alta densidad, FLUYO-018.12)
       y render() escala una sola vez con `dpr`. Todo lo demás —gestos, vista, textarea— sigue en px CSS. */
    viewport:{x:viewX,y:viewY,zoom:viewZoom,width:cv.width/(cv.fluyoDpr||1),height:cv.height/(cv.fluyoDpr||1),dpr:cv.fluyoDpr||1,presenting:!!presenting},
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
}

/* Se pide el siguiente frame antes de dibujar para que un fallo aislado no
   detenga definitivamente la animación del editor. */
(function editorLoop(){
  requestAnimationFrame(editorLoop);
  renderEditorFrame();
})();
