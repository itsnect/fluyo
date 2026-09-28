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
  if(url.href.length>MAX_SHARE_URL_LENGTH) throw shareUrlError("too_large");
  return url.href;
}
async function createShareUrl(projectData,baseUrl){
  // Validar el origen antes de serializar. El normalizador copia el documento.
  const base=new URL(baseUrl);
  if(!["http:","https:"].includes(base.protocol)) throw shareUrlError("web_required");
  const normalized=projectFromProjectData(projectData);
  try{
    const payload=await encodeDeepLink({version:3,app:"fluyo",...normalized});
    return buildShareUrl(baseUrl,payload);
  }catch(e){
    if(e.motivo==="too_large") throw shareUrlError("too_large");
    throw e;
  }
}
