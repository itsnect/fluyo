"use strict";
/* FLUYO-GROWTH-FOUNDATION-001 — La entrada del primer minuto.

   Quien abre fluyo.space por primera vez llega a un lienzo vacío y la pregunta «¿qué creo primero?». Esta tarjeta, sobre el
   lienzo y sin bloquearlo, le da dos salidas: ver un sistema real en marcha (el ejemplo del botón «Ejemplo», en modo Historias y
   reproduciendo su primera Historia) o empezar en blanco. No es un tutorial ni un modal: Escape o tocar el lienzo la cierran.

   Cuándo aparece — TODAS a la vez:
     · editor (no /s/), y la URL no trae documento (`?ejemplo=`, `#d=`): un enlace profundo nunca acaba interceptado;
     · no hay sesión guardada;
     · este navegador no tiene NINGUNA clave `fluyo.*` (autoguardado, preferencias, idioma o `fluyo.seen`);
     · `localStorage` responde (sin él no se podría recordar la elección y saldría en cada carga).

   `fluyo.seen` es la única clave nueva: vale "1", sin fecha ni identificador, y nunca sale del navegador. Lo que sale es su
   consecuencia, un `returning: yes/no` en `editor_opened` (editor-analytics.js). Se escribe al cargar si la tarjeta no se
   muestra, o al resolverla si se muestra (si se cierra la pestaña sin elegir, la próxima carga vuelve a ofrecerla).

   Cargar después de examples.js, deeplink.js, state.js, editor-scenarios.js y export.js (usa fetchExample, urlBringsDocument,
   hasAutosave, presentIncomingDocument, showExampleStories y scRun). Las dos funciones puras de arriba se prueban en Node. */

const ENTRY_SEEN_KEY = "fluyo.seen";

/* ¿Este navegador ya había abierto Fluyo? `storage` = localStorage (o un doble en los tests). */
function entryStorageState(storage){
  try{
    if(!storage) return {available:false, returning:false};
    if(storage.getItem(ENTRY_SEEN_KEY)!==null) return {available:true, returning:true};
    for(let i=0; i<storage.length; i++){
      const k=storage.key(i);
      if(typeof k==="string" && k.startsWith("fluyo.")) return {available:true, returning:true};
    }
    return {available:true, returning:false};
  }catch(e){ return {available:false, returning:false}; }
}
/* La URL trae (o trajo) un documento: además de lo que ya resolvieron examples.js y deeplink.js, cualquier `ejemplo=` o `d=`,
   aunque sea inválido o ya se hubiera abierto en esta pestaña. Ante la duda, no se muestra nada. */
function entryUrlIsDeep(search, hash){
  try{
    if(new URLSearchParams(search||"").has("ejemplo")) return true;
    return /(?:^|[#&])d=/.test(hash||"");
  }catch(e){ return true; }
}
function entryShouldOffer({deepLink, autosave, state}){
  return !deepLink && !autosave && !!state && state.available && !state.returning;
}

const ENTRY_STATE = (()=>{
  let storage=null;
  try{ storage=window.localStorage; }catch(e){}
  const state=entryStorageState(storage);
  let deepLink=true, autosave=true;
  try{ deepLink=urlBringsDocument() || entryUrlIsDeep(location.search, location.hash); }catch(e){}
  try{ autosave=hasAutosave(); }catch(e){}
  return Object.assign({}, state, {offer:!!document.getElementById("entryCard") && entryShouldOffer({deepLink, autosave, state})});
})();

function entryRemember(){ try{ localStorage.setItem(ENTRY_SEEN_KEY, "1"); }catch(e){} }

let entryOpen=false, entryBusy=false;
function entryVisible(){ return entryOpen; }
function entryClose(choice){
  if(!entryOpen) return;
  entryOpen=false;
  const card=$("entryCard");
  if(card) card.hidden=true;
  entryRemember();
  trackEvent("entry_chosen", {choice});
}
/* «Ver un sistema en marcha»: el ejemplo real del botón «Ejemplo», por la misma puerta que `?ejemplo=` (sin sesión guardada
   entra directo; si mientras tanto apareció una, decide el modal de siempre). La URL no cambia. */
function entryExplore(){
  if(!entryOpen || entryBusy) return;
  entryBusy=true;
  for(const b of document.querySelectorAll("#entryCard button")) b.disabled=true;
  fetchExample(EXAMPLE_DEMO)
    .then(d=>{
      entryClose("explore");
      presentIncomingDocument(d, {
        titulo:FluyoI18n.t("incoming.title","Tienes trabajo sin guardar"),
        abrirLabel:FluyoI18n.t("incoming.openExample","Abrir el ejemplo y descartar la sesión"),
        paginaLabel:FluyoI18n.t("incoming.addExample","Añadir el ejemplo como página nueva"),
        onResuelto:eleccion=>{
          if(eleccion==="keep") return;
          showExampleStories();
          trackEvent("example_loaded", {example:EXAMPLE_DEMO, source:"entry"});
          /* Elegir «ver en marcha» es pedir verlo moverse; con movimiento reducido queda lista para «Reproducir». */
          if(!prefersReducedMotion()) scRun({trigger:"entry"});
        }
      });
    })
    .catch(err=>{
      /* Sin red y sin caché: la tarjeta se va y queda el lienzo en blanco, que funciona igual. */
      console.warn(err);
      entryClose("blank");
    })
    .finally(()=>{ entryBusy=false; });
}
/* El lienzo dejó de estar vacío por otra vía (abrir un archivo, «Ejemplo», pegar…): la tarjeta ya no tiene sentido. La llama el
   bucle del editor (editor-runtime.js), que es quien sabe cuándo se pinta el lienzo vacío. */
function entryTick(){
  if(entryOpen && !entryBusy && P().nodes.length) entryClose("dismiss");
}

(function entryBoot(){
  if(!ENTRY_STATE.offer){ if(ENTRY_STATE.available) entryRemember(); return; }
  const card=$("entryCard");
  entryOpen=true;
  card.hidden=false;
  $("entryExplore").onclick=entryExplore;
  $("entryBlank").onclick=()=>entryClose("blank");
  document.addEventListener("keydown", ev=>{ if(/^Esc(ape)?$/.test(ev.key) && entryOpen && !entryBusy) entryClose("dismiss"); });
  /* Tocar el lienzo (no la tarjeta) es empezar en blanco sin decirlo; el gesto sigue su curso normal. */
  $("wrap").addEventListener("pointerdown", ev=>{ if(entryOpen && !entryBusy && !card.contains(ev.target)) entryClose("dismiss"); }, true);
})();
