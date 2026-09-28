"use strict";
/* Frontera de carga de documentos compartidos para el viewer de /s/.

   Contrato mínimo: loadSharedDocument(id) devuelve una PROMESA de
   {doc, settings} ya validados y normalizados con el mismo normalizador que
   usan archivo y deep link (projectFromProjectData de js/model.js), o lanza
   un Error con `code` de baja cardinalidad:
   invalid_id | not_found | invalid_document | unsupported_version | unavailable

   Producción usa el fragmento autocontenido; demo es sólo una fixture explícita.

   Este archivo no toca el DOM: es ejecutable en Node para los tests. */

/* Regex pública del ID de share (capability URL de 128 bits, base64url).
   Copia del contrato aprobado en FLUYO-003 §2. */
const SHARE_ID_PATTERN=/^[A-Za-z0-9_-]{22}$/;

function shareError(code){
  const e=new Error(code);
  e.code=code;
  return e;
}

/* Fixture embebida para desarrollo y tests (?s=demo). */
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

/* Prioridad determinista: presencia de d (incluso vacío/duplicado) bloquea demo.
   No se lee almacenamiento local ni se consulta un servidor. */
function sharePayloadFromHash(hash){
  const params=new URLSearchParams(hash.replace(/^#/, ""));
  if(!params.has("d")) return null;
  const values=params.getAll("d");
  if(values.length!==1) throw shareError("invalid_document");
  return values[0];
}
async function loadShareFromLocation(loc){
  const payload=sharePayloadFromHash(loc.hash);
  if(payload!==null){
    try{
      const data=await decodeDeepLink(payload);
      return {project:projectFromProjectData(data),payload};
    }catch(e){
      throw shareError(e.code==="unsupported_version"? "unsupported_version" : "invalid_document");
    }
  }
  const search=new URLSearchParams(loc.search);
  // La única fixture pública de desarrollo requiere exactamente ?s=demo.
  if(search.getAll("s").length!==1 || search.get("s")!=="demo") throw shareError("invalid_id");
  return {project:await loadSharedDocument("demo"),payload:null};
}
async function buildOpenInFluyoURL(projectData, baseHref, validPayload=null){
  const payload=validPayload===null? await encodeDeepLink(projectData) : validPayload;
  const target=new URL("../",baseHref);
  target.search="";
  target.hash="d="+payload;
  return target.href;
}
