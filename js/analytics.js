"use strict";
/* Telemetría del sitio público. La política, en prosa y para quien llega nuevo
   al repo, está comentada en el <head> de index.html junto a la etiqueta que
   carga este archivo. Aquí está el porqué de las decisiones técnicas. */

/* ═════════════════════════════════════════════════════════════════════════
   PROVEEDOR

   Este es el ÚNICO bloque que hay que editar para cambiar de servicio de
   analítica. Nada por debajo de la línea siguiente sabe qué proveedor es.
   ═════════════════════════════════════════════════════════════════════════ */

/* Hosts donde la telemetría está activa.

   Deliberadamente NO incluye los dominios de preview de Vercel (*.vercel.app).
   Un preview es el mantenedor probando su propia rama: no es tráfico real, y
   mezclarlo con producción ensucia justo los datos que queremos poder leer de
   un vistazo. Al quedar fuera, un fork que despliegue en Vercel tampoco
   reporta nada a este proyecto, que es el comportamiento correcto. */
const ANALYTICS_HOSTS = ["fluyo.space", "www.fluyo.space"];

/* Website ID de Umami Cloud. No es un secreto: va en el HTML de cada carga de
   página y cualquiera que visite el sitio puede leerlo, igual que un id de
   Google Analytics. Está en el repo a propósito.

   Que sea público no expone nada de nadie, pero sí permite que alguien mande
   eventos falsos a este panel. Se acepta: es inherente a cualquier analítica
   de cliente, y aquí el dato es orientativo, no una métrica de negocio.

   Vaciar esta constante apaga la telemetría en todas partes, producción
   incluida, sin tocar nada más. */
const UMAMI_WEBSITE_ID = "bf627279-0eb4-4be4-aee7-ce020e7e66f6";

/* Se eligió Umami Cloud sobre Vercel Web Analytics por una razón concreta:
   los eventos custom de Vercel requieren plan Pro. En el plan Hobby la llamada
   va('event', …) no falla, pero el evento se descarta del lado del servidor —
   la instrumentación existiría sin medir nada. Umami tiene eventos custom en
   su plan gratuito, y además no usa cookies ni fingerprinting, que es
   coherente con lo que este proyecto le promete a quien lo usa. */
const ANALYTICS_PROVIDER = {
  /* Inyecta el script del proveedor. Solo se llama si el host ya coincidió.
     Devuelve false si no hay nada que cargar, para que la telemetría quede
     apagada de forma explícita en lugar de a medias. */
  load(){
    if(!UMAMI_WEBSITE_ID) return false;
    const s=document.createElement("script");
    s.async=true;
    s.src="https://cloud.umami.is/script.js";
    s.dataset.websiteId=UMAMI_WEBSITE_ID;
    // Defensa adicional al filtro de payload: ninguna URL de usuario sale.
    s.dataset.autoTrack="false";
    s.dataset.excludeHash="true";
    s.dataset.excludeSearch="true";
    s.dataset.beforeSend="analyticsBeforeSend";
    s.onload=flushAnalytics;
    s.onerror=()=>{ analyticsQueue.length=0; };
    document.head.appendChild(s);
    return true;
  },
  /* Envía un evento ya validado. Puede ejecutarse antes de que el script del
     proveedor haya terminado de cargar, o con el script bloqueado por un ad
     blocker: en los dos casos window.umami no existe y esto no hace nada. */
  send(name, props){
    if(typeof window.umami?.track !== "function") return;
    return props ? window.umami.track(name, props) : window.umami.track(name);
  }
};

/* ═════════════════════════════════════════════════════════════════════════
   De aquí hacia abajo nada es específico del proveedor.
   ═════════════════════════════════════════════════════════════════════════ */

/* Lista cerrada validada antes de encolar y antes de enviar al proveedor.
   `share_viewed` y `share_opened_in_editor` se emiten desde el viewer de /s/
   (js/viewer.js): sin propiedades, sin ID, sin URL, sin nada del documento.
   `share_created` se emite tras generar una URL válida en el editor. */
const ANALYTICS_EVENTS = {
  editor_opened:{}, first_edit_completed:{}, diagram_created:{},
  diagram_saved:{format:["fluyo_json"]}, present_started:{},
  diagram_exported:{format:["png","jpg","svg","gif"]},
  file_imported:{source:["file","link"],format:["fluyo_json"]},
  example_loaded:{example:["demo","funnel-de-ventas","onboarding-de-cliente","cadena-de-suministro","kafka-event-pipeline","microservicios-api-gateway","oauth2-flujo-autenticacion","pipeline-etl-datos","arquitectura-serverless-aws"]},
  gif_animation_added:{anim:["spinner","progress","ticket","errmove","check","typing","upload","pulse"]},
  link_failed:{reason:["decode","schema","too_large","unsupported"]},
  share_created:{}, share_viewed:{}, share_opened_in_editor:{}
};
function analyticsProps(name, props={}){
  if(!Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS,name)) return null;
  const schema=ANALYTICS_EVENTS[name], clean={};
  for(const key of Object.keys(schema)){
    if(!schema[key].includes(props[key])) return null;
    clean[key]=props[key];
  }
  return clean;
}
// Umami incluye URL, referrer y título también en eventos custom. Reconstruir
// el payload evita enviar rutas privadas, queries, hashes o títulos variables.
function analyticsBeforeSend(type, payload){
  if(type!=="event") return false;
  const safe={website:UMAMI_WEBSITE_ID,hostname:location.hostname,url:"/",title:"Fluyo",referrer:""};
  if(payload.name){
    const data=analyticsProps(payload.name,payload.data);
    if(!data) return false;
    safe.name=payload.name;
    if(Object.keys(data).length) safe.data=data;
  }
  return safe;
}
const analyticsQueue=[];
const ANALYTICS_ON = ANALYTICS_HOSTS.includes(location.hostname) && ANALYTICS_PROVIDER.load();
function flushAnalytics(){
  if(typeof window.umami?.track!=="function") return;
  while(analyticsQueue.length){
    const [name,props]=analyticsQueue.shift();
    try{ Promise.resolve(ANALYTICS_PROVIDER.send(name,props)).catch(()=>{}); }
    catch(e){ /* Medir nunca rompe el editor; no reintentar ni duplicar. */ }
  }
}
function trackEvent(name, props){
  if(!ANALYTICS_ON) return;
  try{
    const clean=analyticsProps(name,props);
    if(!clean) return;
    // Cola acotada, sólo en memoria, para la carga asíncrona de Umami.
    if(analyticsQueue.length<100) analyticsQueue.push([name,clean]);
    flushAnalytics();
  }catch(e){ /* La telemetría es opcional. */ }
}

/* ═════════════════════════════════════════════════════════════════════════
   FIN DEL TRANSPORTE GENÉRICO.

   Todo lo que hay por debajo de esta línea en otro tiempo vivía aquí:
   snapshots de edición, first_edit_completed y el evento editor_opened.
   Es instrumentación exclusiva del editor y se movió a
   js/editor-analytics.js para que el viewer de /s/ pueda cargar sólo este
   transporte sin arrastrar estado editable ni emitir eventos de edición.
   ═════════════════════════════════════════════════════════════════════════ */
