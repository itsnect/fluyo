"use strict";
/* Restricción del transporte Share MVP; no limita archivos .fluyo.json. */
const MAX_SHARE_URL_LENGTH=65536;
/* Origen público del visor. El payload `#d=` es autocontenido (no depende del origen
   que lo generó), pero un enlace `file:///…/s/` no abre en el equipo de nadie más.
   Sólo desde un origen no web (p. ej. `start index.html`) se usa este origen; en
   http(s), incluido localhost, el enlace sigue apuntando al origen actual. */
const SHARE_PUBLIC_ORIGIN="https://fluyo.space/";
function isWebOrigin(href){ try{return ["http:","https:"].includes(new URL(href).protocol);}catch{return false;} }
function shareBaseUrl(href){ return isWebOrigin(href)?href:SHARE_PUBLIC_ORIGIN; }
function shareUrlError(code){ const e=new Error(code); e.code=code; return e; }
function buildShareUrl(baseUrl,payload){
  const base=new URL(baseUrl);
  if(!["http:","https:"].includes(base.protocol)) throw shareUrlError("web_required");
  if(typeof payload!=="string" || !/^[A-Za-z0-9_-]+$/.test(payload)) throw shareUrlError("invalid_document");
  const url=new URL("/s/",base);
  url.hash="d="+payload;
  if(url.href.length>MAX_SHARE_URL_LENGTH){
    const error=shareUrlError("too_large");error.stage="url";throw error;
  }
  return url.href;
}
/* Qué viaja en el enlace (FLUYO-014). Opera sobre la COPIA ya normalizada:
   - kind "diagram": sin Historias (más pequeño, sin «Reproducir»).
   - kind "story" (por defecto): el Scenario activo del autor (scenarioId) pasa a ser
     el primero de la página abierta; el viewer reproduce scenarios[0] de cada página.
   El documento del autor nunca se modifica y no hay campo de schema nuevo. */
function applyShareKind(normalized,options){
  const kind=options&&options.kind==="diagram"?"diagram":"story";
  if(kind==="diagram"){
    for(const page of normalized.doc.pages) page.scenarios=[];
    return normalized;
  }
  const id=options&&options.scenarioId;
  const page=normalized.doc.pages[normalized.doc.cur];
  const index=id==null||!page?-1:(page.scenarios||[]).findIndex(s=>s.id===id);
  if(index>0) page.scenarios.unshift(...page.scenarios.splice(index,1));
  return normalized;
}
async function createShareUrl(projectData,baseUrl,options){
  // Origen no web (file://): el enlace se construye sobre el origen público.
  baseUrl=shareBaseUrl(baseUrl);
  let normalized;
  try{normalized=projectFromProjectData(projectData);}
  catch(e){
    // El normalizador distingue schema; precisar sólo si la copia JSON falló.
    // No serializar una segunda vez en la ruta exitosa ni incluir runtime.
    try{JSON.stringify(projectData);}catch{throw shareUrlError("serialization_failed");}
    throw e;
  }
  let payload;
  try{
    applyShareKind(normalized,options);
    payload=await encodeDeepLink({version:5,app:"fluyo",...normalized});
  }catch(e){
    // El tope descomprimido no es el límite de URL. Ninguna excepción del
    // encoder puede hacerse pasar por un exceso calculado del enlace final.
    const error=shareUrlError("encoding_failed");
    if(e.motivo==="too_large") error.reason="uncompressed_limit";
    throw error;
  }
  return buildShareUrl(baseUrl,payload);
}
