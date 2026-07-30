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
const EXAMPLES = {
  "kafka-event-pipeline":        "Pipeline de eventos con Apache Kafka",
  "microservicios-api-gateway":  "Arquitectura de microservicios con API Gateway",
  "oauth2-flujo-autenticacion":  "Flujo de autenticación OAuth 2.0",
  "pipeline-etl-datos":          "Pipeline ETL de datos",
  "arquitectura-serverless-aws": "Arquitectura serverless en AWS",
};
const EXAMPLES_DIR = "ejemplos/data/";

/* Se resuelve al cargar el script, antes que ui.js, para que este pueda
   saltarse el prompt de «sesión guardada»: si la URL pide un ejemplo concreto,
   esa intención explícita gana sobre restaurar lo que hubiera antes. */
const EXAMPLE_SLUG = (()=>{
  try{
    const s=new URLSearchParams(location.search).get("ejemplo");
    return (s && Object.prototype.hasOwnProperty.call(EXAMPLES,s)) ? s : null;
  }catch(e){ return null; }
})();

function loadExampleFromURL(){
  if(!EXAMPLE_SLUG) return;
  fetch(EXAMPLES_DIR+EXAMPLE_SLUG+".fluyo.json")
    .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(d=>{
      applyProjectData(d);
      centerView();
      /* el prompt de restauración no se mostró, así que hay que reactivar el
         autoguardado a mano o las ediciones sobre el ejemplo no se guardarían */
      enableAutosave();
      trackEvent("example_loaded",{example:EXAMPLE_SLUG});
    })
    .catch(err=>{
      console.warn("No se pudo cargar el ejemplo «"+EXAMPLE_SLUG+"»:",err);
    });
}

/* Se espera a que todos los scripts estén evaluados: applyProjectData() usa
   renderTabs(), que se define en ui.js, más abajo en el orden de carga. */
if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded", loadExampleFromURL, {once:true});
else
  loadExampleFromURL();
