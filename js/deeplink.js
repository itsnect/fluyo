"use strict";
/* Diagrama incrustado en la URL: fluyo.space/#d=<base64url>

   Es el último paso del recorrido que faltaba. El servidor MCP devolvía JSON en
   el chat y para ver la animación —que es el diferenciador del producto— había
   que copiar el JSON, guardarlo como .fluyo.json y abrirlo a mano. Ahora
   devuelve además un enlace, y abrirlo carga el diagrama.

   POR QUÉ EL FRAGMENTO Y NO UN QUERY PARAM

   Tres razones, y las tres importan aquí:

   · El fragmento NO se envía al servidor. No va en la petición HTTP ni en la
     cabecera `Referer`. El diagrama viaja dentro del enlace y no llega a
     ningún registro de acceso, que es lo que permite que esto exista sin
     contradecir lo que la política de privacidad promete. Comprobado contra un
     log de acceso real, no solo contra la especificación.
     (Ojo: eso vale para el navegador. Un script de la página SÍ puede leer el
     hash y mandarlo. Por eso js/analytics.js pone `data-exclude-hash`.)

   · No necesita servidor. `?ejemplo=` usa fetch, que `file://` bloquea; esto no
     pide nada a la red, así que un enlace también funciona sobre una copia
     local abierta con doble clic.

   · No hay backend que montar ni nada que caduque. El enlace es el diagrama.

   Y la contrapartida, que hay que decir en voz alta: el contenido va CODIFICADO,
   no cifrado. Quien reciba el enlace puede leer el diagrama, y quien lo vea de
   refilón en un historial también. Está en la política.

   TAMAÑO

   Medido sobre los ocho ejemplos publicados: 3.971 bytes de JSON minificado de
   media acaban en 1.061 caracteres de URL, factor 5. Un diagrama de 8 nodos son
   987 caracteres; uno de 30, 2.429. Chrome aguanta fragmentos de 2.000.000 de
   caracteres sin despeinarse, así que el navegador no es el límite: lo es el
   medio por el que viaja el enlace. El servidor MCP corta en 16.000 caracteres
   y por encima de eso no emite enlace.

   FORMATO

       #d= base64url( [1 byte de versión] + [carga] )

   El primer byte del contenido decodificado dice cómo leer el resto:

       1 → deflate-raw            (lo que emite el MCP)
       0 → JSON en UTF-8 tal cual (sin comprimir)

   Un byte, dentro de la carga y no en la URL, para no ensuciarla. La versión no
   es decorativa: `DecompressionStream` no existe en Safari anterior a 16.4 ni
   en Firefox anterior a 113, y sin ella el formato 1 no se puede leer. Tener el
   0 definido desde el principio deja esa puerta abierta sin romper ningún
   enlace ya compartido, y deja también la de cambiar de algoritmo más adelante.

   Se descartó brotli, que comprime un 13 % mejor: `DecompressionStream` solo
   admite gzip, deflate y deflate-raw. Y se descartó quitar las claves con valor
   por defecto antes de comprimir —otro 14 %— porque acopla el formato del
   enlace a la tabla de valores por defecto del schema, en dos repositorios, a
   cambio de nada que se note en una URL de mil caracteres. */

/* Tope de lo que se acepta descomprimir. Deflate expande hasta unas 1000 veces:
   sin esto, un enlace de 20 KB puede pedirle al navegador 20 MB. Hasta hoy todo
   lo que entraba al editor venía de un archivo que alguien había elegido a
   mano; un enlace viene de donde sea, y hay que tratarlo como tal. */
const DEEP_LINK_MAX_BYTES = 2 * 1024 * 1024;

/* Clave de sesión —por pestaña, no persistente— con la carga ya resuelta.
   Recargar una pestaña donde el enlace ya se abrió NO puede volver a preguntar:
   a esas alturas el diagrama del enlace ya está dentro de la sesión guardada, y
   la respuesta natural («abrir y descartar») se llevaría por delante justo las
   ediciones que se acaban de hacer sobre él. Quien quiera abrir el enlace otra
   vez desde cero tiene la pestaña nueva. */
const DEEP_LINK_DONE_KEY = "fluyo.deeplink.hecho";

/* Se resuelve al cargar el script. Tiene que ser síncrono porque ui.js decide
   en el momento en que se evalúa si ofrece restaurar la sesión, aunque el
   documento tarde en descodificarse o no llegue a descodificarse nunca. */
const DEEP_LINK_PAYLOAD = (()=>{
  try{
    const m=/(?:^|&)d=([A-Za-z0-9\-_]+)/.exec(location.hash.slice(1));
    if(!m) return null;
    if(sessionStorage.getItem(DEEP_LINK_DONE_KEY)===m[1]) return null;
    return m[1];
  }catch(e){ return null; }
})();

/* Lo único que ui.js necesita saber en el arranque: ¿va a llegar un documento
   por la URL? Responde por las DOS vías que traen documentos —el ejemplo de
   lista blanca de examples.js y el enlace de aquí— porque para quien arranca la
   pregunta es la misma y la respuesta tiene que ser una. */
function urlBringsDocument(){ return !!EXAMPLE_SLUG || !!DEEP_LINK_PAYLOAD; }

function base64urlToBytes(s){
  const b64=s.replace(/-/g,"+").replace(/_/g,"/");
  /* atob rechaza una longitud que no sea múltiplo de 4, y base64url viaja sin
     relleno para no gastar caracteres en la URL. */
  const bin=atob(b64 + "=".repeat((4 - b64.length % 4) % 4));
  const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return u;
}

/* Descomprime contando lo que sale y abortando en cuanto se pasa del tope, sin
   esperar a tener el resultado entero en memoria. */
async function inflateRaw(bytes, max){
  const ds=new DecompressionStream("deflate-raw");
  const w=ds.writable.getWriter();
  /* Si los bytes no son deflate válido, el error sale por el lado de lectura.
     Estos dos catch evitan además la promesa rechazada sin dueño del escritor. */
  w.write(bytes).catch(()=>{});
  w.close().catch(()=>{});
  const r=ds.readable.getReader();
  const trozos=[]; let total=0;
  for(;;){
    const {value,done}=await r.read();
    if(done) break;
    total+=value.length;
    if(total>max){ r.cancel().catch(()=>{}); const e=new Error("too_large"); e.motivo="too_large"; throw e; }
    trozos.push(value);
  }
  const todo=new Uint8Array(total); let off=0;
  for(const t of trozos){ todo.set(t,off); off+=t.length; }
  return new TextDecoder().decode(todo);
}

/* Devuelve el diagrama del enlace, ya validado, o lanza. El error lleva
   `motivo`, que es lo único que acaba en la telemetría: vocabulario cerrado de
   cuatro valores, ningún dato del contenido.

       decode       la carga no se puede leer — base64 roto, no es deflate,
                    versión desconocida, o el resultado no es JSON.
                    El caso probable: un cliente de correo partió la URL.
       schema       se leyó bien, pero lo que traía no es un diagrama Fluyo.
                    Reenviar el enlace no lo arregla; es otro problema.
       too_large    se pasó del tope de descompresión.
       unsupported  este navegador no sabe inflar deflate-raw.

   La validación va aquí dentro y no en quien llama, para que la función tenga
   un contrato entero: o devuelve un diagrama utilizable, o dice por qué no. */
async function decodeDeepLink(payload){
  let bytes;
  try{ bytes=base64urlToBytes(payload); }
  catch(e){ const err=new Error("base64"); err.motivo="decode"; throw err; }
  if(!bytes.length){ const err=new Error("vacío"); err.motivo="decode"; throw err; }

  const version=bytes[0], carga=bytes.subarray(1);
  let texto;
  if(version===1){
    if(typeof DecompressionStream==="undefined"){
      const err=new Error("sin DecompressionStream"); err.motivo="unsupported"; throw err;
    }
    try{ texto=await inflateRaw(carga, DEEP_LINK_MAX_BYTES); }
    catch(e){ if(e.motivo) throw e; const err=new Error("inflate"); err.motivo="decode"; throw err; }
  }else if(version===0){
    if(carga.length>DEEP_LINK_MAX_BYTES){ const err=new Error("grande"); err.motivo="too_large"; throw err; }
    texto=new TextDecoder().decode(carga);
  }else{
    const err=new Error("versión "+version); err.motivo="decode"; throw err;
  }

  let d;
  try{ d=JSON.parse(texto); }
  catch(e){ const err=new Error("json"); err.motivo="decode"; throw err; }

  /* Que el JSON esté bien formado no lo convierte en un diagrama. */
  try{ documentFromProjectData(d); }
  catch(e){ const err=new Error("no es un diagrama Fluyo"); err.motivo="schema"; throw err; }
  return d;
}

function loadDeepLinkFromURL(){
  if(!DEEP_LINK_PAYLOAD) return;
  decodeDeepLink(DEEP_LINK_PAYLOAD)
    .then(d=>{
      presentIncomingDocument(d, {
        titulo:"Tienes trabajo sin guardar",
        abrirLabel:"Abrir el diagrama y descartar la sesión",
        paginaLabel:"Añadir el diagrama como página nueva",
        onResuelto:eleccion=>{
          recordarEnlaceResuelto();
          /* Mismo evento que abrir un archivo, porque es lo mismo que hace la
             persona: meter un diagrama en el editor. La propiedad dice por
             dónde entró, que es justo lo que no se podía saber hasta ahora.
             Si la respuesta fue «seguir con lo mío», aquí no entró nada. */
          if(eleccion!=="keep") trackEvent("file_imported",{source:"link"});
        }
      });
    })
    .catch(err=>{
      const motivo=err && err.motivo ? err.motivo : "decode";
      console.warn("No se pudo abrir el diagrama del enlace:",err);
      /* El fallo probable no es un enlace corrupto a propósito: es un cliente de
         correo en texto plano que parte la URL en dos a los 76 caracteres. Sin
         este evento eso es invisible, porque la persona ve un aviso y se va. */
      trackEvent("link_failed",{reason:motivo});
      alert(motivo==="unsupported"
        ? "Este navegador no puede abrir diagramas incrustados en un enlace. Actualízalo, o pide el archivo .fluyo.json y ábrelo con «Abrir»."
        : "El enlace no contiene un diagrama Fluyo válido. Puede que se haya cortado al copiarlo o al enviarlo.");
      /* ui.js se calló el prompt de restauración esperando a este documento. Un
         enlace roto no puede costarle a nadie la sesión anterior. */
      offerRestoreIfIdle();
    });
}

/* La URL se deja como está: sigue siendo compartible y recargar reproduce el
   diagrama. Lo que se recuerda es que ESTA carga ya se resolvió, y solo para
   esta pestaña. */
function recordarEnlaceResuelto(){
  try{ sessionStorage.setItem(DEEP_LINK_DONE_KEY, DEEP_LINK_PAYLOAD); }catch(e){}
}

/* Igual que examples.js: se espera a que todos los scripts estén evaluados,
   porque presentIncomingDocument() acaba en renderTabs(), que se define en
   ui.js, más abajo en el orden de carga. */
if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded", loadDeepLinkFromURL, {once:true});
else
  loadDeepLinkFromURL();
