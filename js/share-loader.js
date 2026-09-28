"use strict";
/* Frontera de carga de documentos compartidos para el viewer de /s/.

   Contrato mínimo: loadSharedDocument(id) devuelve una PROMESA de
   {doc, settings} ya validados y normalizados con el mismo normalizador que
   usan archivo y deep link (projectFromProjectData de js/model.js), o lanza
   un Error con `code` de baja cardinalidad:
   invalid_id | not_found | invalid_document | unsupported_version | unavailable

   La fuente es intercambiable: hoy es un adapter de fixtures locales.
   FLUYO-006 la sustituirá por `GET /api/shares/:id` SIN reescribir el viewer:
   basta con reemplazar shareSource.fetch. El resto del contrato (validación,
   normalización, códigos de error) es estable.

   Este archivo no toca el DOM: es ejecutable en Node para los tests. */

/* Regex pública del ID de share (capability URL de 128 bits, base64url).
   Copia del contrato aprobado en FLUYO-003 §2. */
const SHARE_ID_PATTERN=/^[A-Za-z0-9_-]{22}$/;

function shareError(code){
  const e=new Error(code);
  e.code=code;
  return e;
}

/* ─────────────────────────── Adapter local ───────────────────────────
   Fixtures embebidos para desarrollo y pruebas antes de que exista backend.
   Las claves son IDs de demo; cualquier otro ID exige la regex oficial.
   FLUYO-006: borrar SHARE_FIXTURES y implementar fetch con
   `await (await fetch("/api/shares/"+encodeURIComponent(id))).json()`,
   mapeando 404 → not_found y respuestas no JSON → unavailable. */
const SHARE_FIXTURES={
  demo:{
    version:3, app:"fluyo",
    doc:{ theme:"dark", customBg:"", cur:0, pages:[
      { name:"Flujo principal", nextId:4,
        nodes:[
          {id:1, shape:"rect", x:340, y:300, w:170, h:76, label:"Servicio", color:"#3aa7e8"},
          {id:2, shape:"cylinder", x:680, y:300, w:190, h:92, label:"Base de datos", color:"#d08b5b"}
        ],
        edges:[
          {id:3, from:1, to:2, label:"lee / escribe", animated:true}
        ] },
      { name:"Estado", nextId:6,
        nodes:[
          {id:4, shape:"anim", anim:"spinner", x:400, y:300, w:120, h:100, label:"Procesando", color:"#3aa7e8"},
          {id:5, shape:"rect", x:720, y:300, w:170, h:76, label:"Listo", color:"#7bb85b"}
        ],
        edges:[] }
    ] },
    settings:{speed:.5, dots:3, build:false, stagger:.45, grid:true, snap:false, font:DEFAULT_FONT, single:false}
  }
};

const shareSource={
  async fetch(id){
    if(!projectOwn(SHARE_FIXTURES,id)) throw shareError("not_found");
    const fixture=SHARE_FIXTURES[id];
    /* Copia profunda: el viewer normaliza y muta doc.cur; el fixture debe
       quedar intacto para poder recargar o reinstalar. */
    return deep(fixture);
  }
};

/* Carga, valida y normaliza un documento compartido. */
async function loadSharedDocument(id){
  if(typeof id!=="string" || (!projectOwn(SHARE_FIXTURES,id) && !SHARE_ID_PATTERN.test(id)))
    throw shareError("invalid_id");
  let data;
  try{ data=await shareSource.fetch(id); }
  catch(e){ throw shareError(["not_found","unavailable"].includes(e&&e.code)? e.code : "unavailable"); }
  try{ return projectFromProjectData(data); }
  catch(e){ throw shareError(e&&e.code==="unsupported_version"? "unsupported_version" : "invalid_document"); }
}

/* ─────────────────────── Abrir en Fluyo (copia) ───────────────────────
   Entrega el documento al editor como COPIA editable mediante el deep link
   existente (`/#d=`), que el editor ya valida y trata como documento
   entrante. Nunca existe identidad de escritura hacia el share original:
   el editor recibe bytes, no un ID.

   Mismo formato que js/deeplink.js: [1 byte de versión] + carga.
   Versión 1 = deflate-raw (CompressionStream, ~5× menos caracteres que el
   JSON a pelo); versión 0 = JSON UTF-8 tal cual, como fallback para
   navegadores sin CompressionStream (la versión la decide el primer byte,
   no la URL, así que el editor lee ambas sin saber quién las emitió).

   FLUYO-006: esta función dejará de usarse en producción en cuanto el
   editor sepa resolver `/#s=<id>`; se conserva para self-host y para
   enlazar documentos sin servicio de shares. */

function bytesToBase64url(bytes){
  let bin="";
  for(let i=0;i<bytes.length;i+=8192)
    bin+=String.fromCharCode.apply(null, bytes.subarray(i,i+8192));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function buildOpenInFluyoURL(projectData, baseHref){
  const json=JSON.stringify(projectData);
  let payload;
  if(typeof CompressionStream==="function"){
    const bytes=new TextEncoder().encode(json);
    const cs=new CompressionStream("deflate-raw");
    const w=cs.writable.getWriter();
    w.write(bytes).catch(()=>{});
    w.close().catch(()=>{});
    const chunks=[]; let total=0;
    const r=cs.readable.getReader();
    for(;;){
      const {value,done}=await r.read();
      if(done) break;
      chunks.push(value); total+=value.length;
    }
    payload=new Uint8Array(total+1);
    payload[0]=1;
    let off=1;
    for(const c of chunks){ payload.set(c,off); off+=c.length; }
  }else{
    const bytes=new TextEncoder().encode(json);
    payload=new Uint8Array(bytes.length+1);
    payload[0]=0;
    payload.set(bytes,1);
  }
  return new URL("../index.html#d="+bytesToBase64url(payload), baseHref).href;
}
