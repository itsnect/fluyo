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

   · Para ESTA página se descartó meter el diagrama entero en el hash
     (#d=<base64>). Sigue descartado, y conviene saber por qué, porque js/
     deeplink.js hace exactamente eso: son dos problemas distintos.

     Un ejemplo publicado tiene que ser una URL corta, legible, estable e
     indexable — es una página de entrada, y ese es el único motivo por el que
     /ejemplos existe. Un diagrama en el hash no es ninguna de las cuatro cosas:
     son mil caracteres de base64, cambian cada vez que se retoca el ejemplo, y
     Google no indexa fragmentos. Además el archivo servido aparte se puede
     descargar y abrir con «Abrir», así que documenta el formato.

     El enlace del MCP no tiene ninguno de esos requisitos y sí tiene uno que
     aquí no existe: el diagrama no está en el servidor y no puede estarlo. No
     hay archivo al que apuntar ni slug que dar de alta, y montar un backend
     para eso es justo lo que este proyecto no hace. Por eso ahí el hash es la
     respuesta correcta y aquí no.

   · Descartado traspasarlo por sessionStorage desde /ejemplos: rompe el enlace
     directo, que es el único motivo por el que esta página existe.

   Límite conocido: si abres index.html con doble clic (file://) el fetch queda
   bloqueado y el enlace profundo no carga. El editor funciona igual; solo este
   atajo necesita un servidor, aunque sea `python -m http.server`. */

/* Lista blanca. Añadir un ejemplo = un archivo en ejemplos/data/ y una línea aquí. Solo importa la clave (el slug); el nombre
   visible es el de la página dentro del propio JSON, en el idioma de su edición. */
/* FLUYO-EXAMPLES-001: 1 = catálogo de /ejemplos, y todos traen dos Historias (regla de producto: ningún ejemplo publicado es
   solo un diagrama estático); «compra-online» es además el del botón «Ejemplo». 0 = RETIRADO: no se lista en la galería, pero
   su slug sigue cargando su JSON de siempre para no romper enlaces publicados. */
const EXAMPLES = {
  "compra-online":               1,
  "inicio-de-sesion-oauth2":     1,
  "pedido-asincrono-cola":       1,
  "oauth2-flujo-autenticacion":  0,
  "funnel-de-ventas":            0,
  "onboarding-de-cliente":       0,
  "cadena-de-suministro":        0,
  "kafka-event-pipeline":        0,
  "microservicios-api-gateway":  0,
  "pipeline-etl-datos":          0,
  "arquitectura-serverless-aws": 0,
};
const EXAMPLES_DIR = "ejemplos/data/";
/* Ediciones escritas a mano en otros idiomas (misma estructura, solo cambia el texto). El idioma se elige al CARGAR, según
   la interfaz de quien lo abre; después el documento es suyo y no se retraduce (decisión 260). Sin edición → la española. */
const EXAMPLE_EDITIONS = {
  "compra-online":              ["en"],
  "inicio-de-sesion-oauth2": ["en"],
  "pedido-asincrono-cola":      ["en"],
};
const EXAMPLE_DEMO = "compra-online";
function exampleDataUrl(slug){
  const loc=FluyoI18n.locale(), eds=EXAMPLE_EDITIONS[slug]||[];
  return EXAMPLES_DIR+(eds.includes(loc) ? loc+"/" : "")+slug+".fluyo.json";
}
function fetchExample(slug){
  return fetch(exampleDataUrl(slug)).then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); });
}

/* Se resuelve al cargar el script, antes que ui.js, para que este sepa que hay
   un documento en camino y no ofrezca restaurar la sesión por su cuenta. */
const EXAMPLE_SLUG = (()=>{
  try{
    const s=new URLSearchParams(location.search).get("ejemplo");
    return (s && Object.prototype.hasOwnProperty.call(EXAMPLES,s)) ? s : null;
  }catch(e){ return null; }
})();

/* La respuesta a «¿va a llegar un documento por la URL?» la da
   urlBringsDocument(), en js/deeplink.js: hay dos vías que traen documentos y
   para quien arranca la pregunta es una sola. */

function loadExampleFromURL(){
  if(!EXAMPLE_SLUG) return;
  fetchExample(EXAMPLE_SLUG)
    .then(d=>{
      /* Ya no se aplica a lo bruto. Si hay una sesión guardada, esto abre el
         modal de conflicto y la decisión es de quien está delante; si no la
         hay, entra directo como antes. */
      presentIncomingDocument(d, {
        titulo:FluyoI18n.t("incoming.title","Tienes trabajo sin guardar"),
        abrirLabel:FluyoI18n.t("incoming.openExample","Abrir el ejemplo y descartar la sesión"),
        paginaLabel:FluyoI18n.t("incoming.addExample","Añadir el ejemplo como página nueva"),
        /* El evento cuenta el ejemplo que se llegó a ver, no el que se pidió:
           si la respuesta fue «seguir con lo mío», aquí no se cargó nada. */
        onResuelto:eleccion=>{
          if(eleccion==="keep") return;
          /* Con Historias, se abre en modo Historias con la primera seleccionada (export.js), como el botón «Ejemplo». */
          showExampleStories();
          trackEvent("example_loaded",{example:EXAMPLE_SLUG});
        }
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
