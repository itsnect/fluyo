"use strict";
/* Restricción del transporte Share MVP; no limita archivos .fluyo.json. */
const MAX_SHARE_URL_LENGTH=65536;
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
async function createShareUrl(projectData,baseUrl){
  // Validar el origen antes de serializar. El normalizador copia el documento.
  const base=new URL(baseUrl);
  if(!["http:","https:"].includes(base.protocol)) throw shareUrlError("web_required");
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
    payload=await encodeDeepLink({version:4,app:"fluyo",...normalized});
  }catch(e){
    // El tope descomprimido no es el límite de URL. Ninguna excepción del
    // encoder puede hacerse pasar por un exceso calculado del enlace final.
    const error=shareUrlError("encoding_failed");
    if(e.motivo==="too_large") error.reason="uncompressed_limit";
    throw error;
  }
  return buildShareUrl(baseUrl,payload);
}
