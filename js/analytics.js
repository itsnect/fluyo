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

/* Website ID de Umami Cloud. Vacío = telemetría apagada en todas partes,
   incluido el sitio público. Es el valor que se comitea a propósito: el repo
   no debe traer un id ajeno preconfigurado. */
const UMAMI_WEBSITE_ID = "";

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
    document.head.appendChild(s);
    return true;
  },
  /* Envía un evento ya validado. Puede ejecutarse antes de que el script del
     proveedor haya terminado de cargar, o con el script bloqueado por un ad
     blocker: en los dos casos window.umami no existe y esto no hace nada. */
  send(name, props){
    if(typeof window.umami?.track !== "function") return;
    if(props) window.umami.track(name, props);
    else window.umami.track(name);
  }
};

/* ═════════════════════════════════════════════════════════════════════════
   De aquí hacia abajo nada es específico del proveedor.
   ═════════════════════════════════════════════════════════════════════════ */

/* Se evalúa una sola vez, al cargar. En un clon local, en file:// o en un
   self-host el hostname no coincide, load() no se llama y no se inyecta
   ningún script: cero llamadas de red, cero telemetría. */
const ANALYTICS_ON = ANALYTICS_HOSTS.includes(location.hostname) && ANALYTICS_PROVIDER.load();

/* Helper único de la app. Es seguro llamarlo siempre y desde cualquier sitio:
   si la telemetría está apagada o el proveedor no está disponible, no hace
   nada y no lanza. Medir nunca puede romper el editor. */
function trackEvent(name, props){
  if(!ANALYTICS_ON) return;
  try{ ANALYTICS_PROVIDER.send(name, props); }
  catch(e){ /* silencio a propósito */ }
}

/* diagram_created se manda UNA sola vez por sesión: la pregunta que responde
   es «¿esta persona llegó a dibujar algo?», no «¿cuántos nodos puso?».

   El flag vive en memoria y no en localStorage a propósito: recargar cuenta
   como sesión nueva, y así el dato no depende de un almacenamiento que el
   usuario puede haber limpiado. */
let _diagramStarted=false;
function trackFirstNode(){
  if(_diagramStarted) return;
  _diagramStarted=true;
  trackEvent("diagram_created");
}
