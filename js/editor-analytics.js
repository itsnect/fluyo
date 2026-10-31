"use strict";
/* Instrumentación de edición del editor: snapshots en memoria,
   first_edit_completed, diagram_created y editor_opened.

   Vive separada de js/analytics.js (transporte genérico) para que el viewer
   read-only de /s/ pueda cargar sólo el transporte: este archivo NO se carga
   en el viewer. Sus funciones leen estado del editor en el momento de la
   llamada (doc/settings desde model.js; gestos desde state.js), así que el
   orden de carga solo exige que esté disponible antes del primer evento. */

/* Sesión = una carga del editor. Comparar sólo estado editable, en memoria:
   nunca enviar ni persistir esta instantánea. Cambiar de página, pan, zoom,
   selección y preferencias de rejilla no son ediciones del diagrama. */
let analyticsBaseline=null, analyticsHadNodes=false;
let analyticsFirstEdit=false, analyticsCreated=false, analyticsEditTimer=null;
function analyticsSnapshot(){
  return JSON.stringify({theme:doc.theme,customBg:doc.customBg,
    pages:doc.pages.map(pg=>({name:pg.name,nodes:pg.nodes,edges:pg.edges})),
    settings:{speed:settings.speed,dots:settings.dots,build:settings.build,
      stagger:settings.stagger,font:settings.font}});
}
function resetAnalyticsBaseline(){
  if(!ANALYTICS_ON || (analyticsFirstEdit && analyticsCreated)) return;
  try{
    analyticsBaseline=analyticsSnapshot();
    analyticsHadNodes=doc.pages.some(pg=>pg.nodes.length>0);
  }catch(e){}
}
function checkAnalyticsEdit(){
  if(!ANALYTICS_ON || (analyticsFirstEdit && analyticsCreated)) return;
  // Esperar al resultado confirmado del gesto/texto, no a su estado provisional.
  if(editing || drag || resizing || wpDrag || segDrag || endDrag || connectDrag) return;
  // El exportador GIF ajusta temporalmente la velocidad para cerrar el bucle.
  if(typeof activeGif!=="undefined" && activeGif) return;
  try{
    const current=analyticsSnapshot();
    if(analyticsBaseline!==null && current!==analyticsBaseline){
      if(!analyticsFirstEdit){ analyticsFirstEdit=true; trackEvent("first_edit_completed"); }
      if(!analyticsCreated && !analyticsHadNodes && doc.pages.some(pg=>pg.nodes.length>0)){
        analyticsCreated=true; trackEvent("diagram_created");
      }
    }
    resetAnalyticsBaseline();
    if(analyticsFirstEdit && analyticsCreated) analyticsBaseline=null;
  }catch(e){}
}
function scheduleAnalyticsEdit(){
  if(!ANALYTICS_ON || (analyticsFirstEdit && analyticsCreated)) return;
  clearTimeout(analyticsEditTimer);
  analyticsEditTimer=setTimeout(checkAnalyticsEdit,0);
}
/* FLUYO-GROWTH-FOUNDATION-001: por dónde entró esta carga (sin la URL: solo si traía ejemplo o enlace), si este navegador ya
   había abierto Fluyo (js/entry.js; nunca un identificador) y el idioma de la interfaz. */
function editorOpenedProps(){
  const entry=(typeof EXAMPLE_SLUG!=="undefined" && EXAMPLE_SLUG) ? "example"
    : (typeof DEEP_LINK_PAYLOAD!=="undefined" && DEEP_LINK_PAYLOAD) ? "link" : "direct";
  const returning=(typeof ENTRY_STATE==="object" && ENTRY_STATE && ENTRY_STATE.returning) ? "yes" : "no";
  return {entry, returning, locale:analyticsLocale()};
}
document.addEventListener("DOMContentLoaded",()=>{
  if(!document.getElementById("cv")) return;
  resetAnalyticsBaseline();
  trackEvent("editor_opened", editorOpenedProps());
},{once:true});
