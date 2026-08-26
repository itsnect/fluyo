"use strict";
/* Carga de diagramas de ejemplo mediante ?ejemplo=<slug>

   Por qué un query param con slug en lista blanca, y no las alternativas:

   · El diagrama vive en un .fluyo.json estático servido junto a la app. La URL
     queda corta, se puede compartir y enlazar, y cada ejemplo es una página de
     entrada real — que es justo lo que le da valor de búsqueda a /ejemplos.
     Además esos mismos archivos se pueden descargar y abrir con «Abrir», así
     que sirven de documentación del formato.

   · El slug se valida contra EXAMPLES ANTES de tocar la red, y la ruta se
     construye aquí. Nunca se hace fetch de algo que venga de la URL: un
     ?ejemplo=https://otro-sitio o un ?ejemplo=../../etc no llegan a generar
     ninguna petición, simplemente no coinciden con ninguna clave.

   · Descartado meter el diagrama entero en el hash (#d=<base64>): funcionaría
     incluso sin servidor, pero produce URLs enormes e ilegibles y no aporta
     nada indexable.

   · Descartado traspasarlo por sessionStorage desde /ejemplos: rompe el enlace
     directo, que es el único motivo por el que esta página existe.

   Límite conocido: si abres index.html con doble clic (file://) el fetch queda
   bloqueado y el enlace profundo no carga. El editor funciona igual; solo este
   atajo necesita un servidor, aunque sea `python -m http.server`. */

/* Lista blanca. Añadir un ejemplo = un archivo en ejemplos/data/ y una línea
   aquí. El texto es el que se usa como nombre visible del diagrama. */
/* El orden es el de la galería: primero los procesos de negocio, que es lo que
   busca quien no viene del mundo del software. Aquí es solo cosmética —este mapa
   es una lista blanca de slugs y una fuente de nombres, no dibuja nada— pero
   mantenerlo alineado con /ejemplos evita que diverjan. */
const EXAMPLES = {
  "funnel-de-ventas":            "Funnel de ventas",
  "onboarding-de-cliente":       "Onboarding de cliente",
  "cadena-de-suministro":        "Cadena de suministro",
  "kafka-event-pipeline":        "Pipeline de eventos con Apache Kafka",
  "microservicios-api-gateway":  "Arquitectura de microservicios con API Gateway",
  "oauth2-flujo-autenticacion":  "Flujo de autenticación OAuth 2.0",
  "pipeline-etl-datos":          "Pipeline ETL de datos",
  "arquitectura-serverless-aws": "Arquitectura serverless en AWS",
};
const EXAMPLES_DIR = "ejemplos/data/";

/* Se resuelve al cargar el script, antes que ui.js, para que este sepa que hay
   un documento en camino y no ofrezca restaurar la sesión por su cuenta. */
const EXAMPLE_SLUG = (()=>{
  try{
    const s=new URLSearchParams(location.search).get("ejemplo");
    return (s && Object.prototype.hasOwnProperty.call(EXAMPLES,s)) ? s : null;
  }catch(e){ return null; }
})();

/* Lo que ui.js necesita saber en el arranque, y lo único que tiene que saber:
   ¿va a llegar un documento por la URL? La respuesta tiene que ser SÍNCRONA
   —ui.js decide en el momento en que se evalúa— aunque el documento en sí
   tarde en llegar, o no llegue nunca. */
function urlBringsDocument(){ return !!EXAMPLE_SLUG; }

function loadExampleFromURL(){
  if(!EXAMPLE_SLUG) return;
  fetch(EXAMPLES_DIR+EXAMPLE_SLUG+".fluyo.json")
    .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(d=>{
      /* Ya no se aplica a lo bruto. Si hay una sesión guardada, esto abre el
         modal de conflicto y la decisión es de quien está delante; si no la
         hay, entra directo como antes. */
      presentIncomingDocument(d, {
        titulo:"Tienes trabajo sin guardar",
        abrirLabel:"Abrir el ejemplo y descartar la sesión",
        paginaLabel:"Añadir el ejemplo como página nueva",
        /* El evento cuenta el ejemplo que se llegó a ver, no el que se pidió:
           si la respuesta fue «seguir con lo mío», aquí no se cargó nada. */
        onResuelto:eleccion=>{ if(eleccion!=="keep") trackEvent("example_loaded",{example:EXAMPLE_SLUG}); }
      });
    })
    .catch(err=>{
      console.warn("No se pudo cargar el ejemplo «"+EXAMPLE_SLUG+"»:",err);
      /* El ejemplo no llegó (típico: `file://`, donde el fetch está bloqueado).
         ui.js se calló el prompt de restauración esperando a este documento, así
         que ahora le toca a él ofrecerlo: un ejemplo que no carga no puede
         costarle a nadie la sesión anterior. */
      offerRestoreIfIdle();
    });
}

/* Se espera a que todos los scripts estén evaluados: applyProjectData() usa
   renderTabs(), que se define en ui.js, más abajo en el orden de carga. */
if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded", loadExampleFromURL, {once:true});
else
  loadExampleFromURL();
