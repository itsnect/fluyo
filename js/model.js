"use strict";
/* Modelo/documento compartido por editor y consumidores read-only.
   No accede al DOM, localStorage, autosave ni estado de interacción. */

/* ===================== Documento (páginas) ===================== */
function blankPage(name){ return {name, nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}; }
let doc={ theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[blankPage("Página 1")], cur:0 };
const DEFAULT_SETTINGS={speed:.5, dots:3, build:false, stagger:.45, grid:true, snap:false, font:DEFAULT_FONT, single:false};
let settings={...DEFAULT_SETTINGS};
const P=()=>doc.pages[doc.cur];

/* ===================== Utilidades puras de modelo ===================== */
const nodeById=id=>P().nodes.find(n=>n.id===id);
const edgeById=id=>P().edges.find(e=>e.id===id);
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t,0,1); return t*t*(3-2*t);};
const snap=v=>Math.round(v/GRID)*GRID;
/* Movimiento libre por defecto; snap a rejilla solo si settings.snap está activo */
const snapV=v=>settings.snap? Math.round(v/GRID)*GRID : Math.round(v);
const deep=o=>JSON.parse(JSON.stringify(o));
function hexA(col,a){ const v=parseInt(col.slice(1),16);
  return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`; }

function getBounds(){
  if(P().nodes.length===0) return {x:0, y:0, w:1280, h:720};
  let mx=Infinity, my=Infinity, Mx=-Infinity, My=-Infinity;
  const addP=(x,y)=>{ if(x<mx)mx=x; if(x>Mx)Mx=x; if(y<my)my=y; if(y>My)My=y; };
  P().nodes.forEach(n=>{
    addP(n.x-n.w/2, n.y-n.h/2);
    addP(n.x+n.w/2, n.y+n.h/2);
  });
  P().edges.forEach(e=>edgePoints(e).forEach(p=>addP(p.x,p.y)));
  mx-=40; my-=40; Mx+=40; My+=40;
  return {x:mx, y:my, w:Mx-mx, h:My-my};
}

/* ===================== Contrato .fluyo.json ===================== */
/* Formato de guardado (única definición): el editor serializa su doc vivo; los consumidores sin estado
   (fluyo-mcp) lo usan con su propio doc/settings normalizados. */
function projectToSerializable(d,st){ return {version:5,app:"fluyo",doc:d,settings:st}; }
function serializeProject(){ return projectToSerializable(doc,settings); }

function projectDataError(code="invalid_document", field){
  const err=new Error(code); err.code=code; if(field!==undefined) err.field=field; return err;
}
const projectObject=o=>o!==null && typeof o==="object" && !Array.isArray(o);
const projectOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function projectNumber(value,fallback){
  return typeof value==="number" && Number.isFinite(value)? value : fallback;
}
/* Límites de los controles existentes: speedIn, dotsIn y staggerIn.
   No dependen del DOM; archivo, deep link y viewer comparten la semántica. */
/* Scenarios v2 (v1 se conserva para documentos históricos) */
const SCENARIO_ENGINE_VERSION=2;
const SCENARIO_STATES=new Set(["UP","DOWN"]);
const SCENARIO_ACTIONS=new Set(["SET_STATE","SEND","OCCURRENCE"]);
const EVENT_TYPE_PRIMITIVES=new Set(["FLOW","OCCURRENCE","SET_AVAILABILITY"]);
const EVENT_TYPE_AVAILABILITY=new Set(["UP","DOWN"]);
const EVENT_TOKEN_MAX_LEN=8;
const EVENT_TYPE_MOTIONS=new Set(["fast","normal","slow"]);
const DEFAULT_EVENT_MOTION="normal";
const EVENT_MOTION_MS={fast:500, normal:1100, slow:1800};
const NODE_EFFECT_MAX_MESSAGE_LEN=120;
const NODE_MESSAGE_SIZES=["small","medium","large"];
const NODE_MESSAGE_WEIGHTS=["normal","semibold","bold"];
const NODE_MESSAGE_FONTS=["default","sans","mono"];
const NODE_MESSAGE_POSITIONS=["above","center","below"];
/* FLUYO-015: lenguaje visual del símbolo en movimiento. Presentación pura: el
   motor y el Trace no conocen estos valores. Listas cerradas, sin valores libres. */
const SYMBOL_SIZES=["small","medium","large"];
const SYMBOL_SIZE_PX={small:15, medium:20, large:28};
const SYMBOL_NODE_PX={small:16, medium:22, large:32};   // símbolo de un Evento de elemento (cue sobre el nodo)
const SYMBOL_SIZE_DEFAULT="medium";
const FLOW_STYLES=["direct","smooth","impulse"];
const FLOW_TRAILS=["none","subtle","marked"];
const FLOW_ARRIVALS=["none","pulse","glow","bounce"];
const FLOW_DURINGS=["none","halo","breathe"];
/* Duración VISUAL del cue de un Evento de elemento (presentación pura: nunca
   toca step.at, Trace ni consecuencias). Presets + personalizado en ms. */
const NODE_VISUAL_DURATIONS=["brief","normal","long","custom"];
const NODE_VISUAL_DURATION_MS={brief:700, normal:1500, long:3000};
const NODE_VISUAL_DURATION_MIN_MS=300;
const NODE_VISUAL_DURATION_MAX_MS=10000;
const NODE_VISUAL_DURATION_DEFAULT="normal";
/* Presets de presentación del mensaje: la UI habla en presets, nunca en px. */
const NODE_MESSAGE_SIZE_PX={small:11, medium:14, large:18};
const NODE_MESSAGE_WEIGHT_CSS={normal:"400", semibold:"600", bold:"700"};
const NODE_MESSAGE_FONT_STACK={
  default:"Georgia, serif",
  sans:"'Segoe UI', system-ui, Arial, Helvetica, sans-serif",
  mono:'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
};
function defaultConnectionEffects(){
  return { size:SYMBOL_SIZE_DEFAULT, style:"direct", trail:"none", arrival:"none", during:"none" };
}
/* Campo a campo: lo inválido vuelve al defecto (nunca lanza). */
function normalizeConnectionEffects(fx){
  const out=defaultConnectionEffects();
  if(!projectObject(fx)) return out;
  if(SYMBOL_SIZES.includes(fx.size)) out.size=fx.size;
  if(FLOW_STYLES.includes(fx.style)) out.style=fx.style;
  if(FLOW_TRAILS.includes(fx.trail)) out.trail=fx.trail;
  if(FLOW_ARRIVALS.includes(fx.arrival)) out.arrival=fx.arrival;
  if(FLOW_DURINGS.includes(fx.during)) out.during=fx.during;
  return out;
}
/* Única especificación que consumen Playback (Editor/Present/Viewer) y el preview del modal. */
function connectionVisualSpec(et){
  const fx=normalizeConnectionEffects(et && et.presentation && et.presentation.connectionEffects);
  return Object.assign({}, fx, { symbol: eventSymbol(et), px: SYMBOL_SIZE_PX[fx.size] });
}
/* Presentación completa de un EventType: conserva ambas ramas, sólo escribe las presentes. */
function normalizePresentation(p){
  const out={};
  if(!projectObject(p)) return out;
  if(p.nodeEffects!==undefined) out.nodeEffects=normalizeNodeEffects(p.nodeEffects);
  if(p.connectionEffects!==undefined) out.connectionEffects=normalizeConnectionEffects(p.connectionEffects);
  return out;
}
function defaultNodeEffects(){
  return { showSymbol:false, symbolSize:SYMBOL_SIZE_DEFAULT, message:"", messageColor:"", messageSize:"medium", messageWeight:"normal", messageFont:"default", messagePosition:"above", highlight:false, blink:false, dim:false, fillColor:"", visualDuration:NODE_VISUAL_DURATION_DEFAULT, visualDurationMs:NODE_VISUAL_DURATION_MS.normal };
}
function normalizeNodeEffects(effects){
  const out=defaultNodeEffects();
  if(effects==null) return out;
  /* showIcon es el nombre previo (FLUYO-011 sin publicar): mismo booleano. */
  if(typeof effects.showSymbol==="boolean") out.showSymbol=effects.showSymbol;
  else if(typeof effects.showIcon==="boolean") out.showSymbol=effects.showIcon;
  if(SYMBOL_SIZES.includes(effects.symbolSize)) out.symbolSize=effects.symbolSize;
  if(typeof effects.message==="string") out.message=effects.message.slice(0,NODE_EFFECT_MAX_MESSAGE_LEN);
  if(typeof effects.messageColor==="string" && /^#[0-9a-fA-F]{6}$/.test(effects.messageColor)) out.messageColor=effects.messageColor;
  if(NODE_MESSAGE_SIZES.includes(effects.messageSize)) out.messageSize=effects.messageSize;
  if(NODE_MESSAGE_WEIGHTS.includes(effects.messageWeight)) out.messageWeight=effects.messageWeight;
  if(NODE_MESSAGE_FONTS.includes(effects.messageFont)) out.messageFont=effects.messageFont;
  if(NODE_MESSAGE_POSITIONS.includes(effects.messagePosition)) out.messagePosition=effects.messagePosition;
  if(typeof effects.highlight==="boolean") out.highlight=effects.highlight;
  if(typeof effects.blink==="boolean") out.blink=effects.blink;
  if(typeof effects.dim==="boolean") out.dim=effects.dim;
  if(typeof effects.fillColor==="string" && /^#[0-9a-fA-F]{6}$/.test(effects.fillColor)) out.fillColor=effects.fillColor;
  if(NODE_VISUAL_DURATIONS.includes(effects.visualDuration)){
    out.visualDuration=effects.visualDuration;
    if(effects.visualDuration==="custom"){
      const ms=normalizeVisualDurationMs(effects.visualDurationMs);
      if(ms===null) out.visualDuration=NODE_VISUAL_DURATION_DEFAULT;
      else out.visualDurationMs=ms;
    }
  }
  if(out.visualDuration!=="custom") out.visualDurationMs=NODE_VISUAL_DURATION_MS[out.visualDuration];
  return out;
}
/* ms válidos (entero dentro de límites) o null. Los fuera de rango se acotan;
   NaN/no numéricos se rechazan. */
function normalizeVisualDurationMs(v){
  if(typeof v!=="number" || !Number.isFinite(v)) return null;
  return Math.min(NODE_VISUAL_DURATION_MAX_MS, Math.max(NODE_VISUAL_DURATION_MIN_MS, Math.round(v)));
}
/* Segundos escritos por la persona → ms o null si inválido (<=0, NaN, fuera de rango). */
function parseVisualDurationSeconds(value){
  const n=typeof value==="number"?value:Number(String(value).trim().replace(",","."));
  if(!Number.isFinite(n) || n<=0) return null;
  const ms=Math.round(n*1000);
  if(ms<NODE_VISUAL_DURATION_MIN_MS || ms>NODE_VISUAL_DURATION_MAX_MS) return null;
  return ms;
}
function nodeEffectDurationMs(fx){
  return normalizeNodeEffects(fx).visualDurationMs;
}
/* Única fuente del símbolo de un Evento: EventType.visual.value. */
function eventSymbol(et){
  return et && et.visual && et.visual.value ? et.visual.value : "●";
}
/* Metadata visual única que consumen preview y Playback (paridad por construcción). */
function nodeEffectsVisualSpec(et){
  const fx=normalizeNodeEffects(et && et.presentation && et.presentation.nodeEffects);
  return Object.assign({}, fx, { symbol: eventSymbol(et) });
}
function nodeMessageStyle(fx){
  const e=normalizeNodeEffects(fx);
  return { px:NODE_MESSAGE_SIZE_PX[e.messageSize], weight:NODE_MESSAGE_WEIGHT_CSS[e.messageWeight], family:NODE_MESSAGE_FONT_STACK[e.messageFont], position:e.messagePosition };
}
function normalizeEventTypePresentation(et){
  if(et.presentation===undefined) return;
  if(!projectObject(et.presentation)) throw projectDataError();
  if(et.presentation.nodeEffects!==undefined){
    const raw=et.presentation.nodeEffects;
    const norm=normalizeNodeEffects(raw);
    /* Política de compatibilidad: un `icon` secundario distinto del símbolo principal
       nunca se persistió en v5, pero si aparece se eleva a símbolo principal (sin perderlo)
       cuando el símbolo estaba visible y cabe en un token. */
    if(raw && typeof raw.icon==="string" && norm.showSymbol && et.visual && typeof et.visual==="object"
       && raw.icon && [...raw.icon].length<=EVENT_TOKEN_MAX_LEN && raw.icon!==et.visual.value){
      et.visual.value=raw.icon;
    }
    et.presentation.nodeEffects=norm;
  }
  if(et.presentation.connectionEffects!==undefined){
    et.presentation.connectionEffects=normalizeConnectionEffects(et.presentation.connectionEffects);
  }
}

/* Marcas de identidad persistidas, sin guards de ejecución. El último entero
   seguro se reserva como marca de agotamiento: nunca se asigna y luego suma 1. */
function projectCounter(value,maxId=0){
  if(value===undefined) value=1;
  if(!Number.isSafeInteger(value) || value<1 || !Number.isSafeInteger(maxId) || maxId<0 || maxId>=Number.MAX_SAFE_INTEGER)
    throw projectDataError();
  return Math.max(value,maxId+1);
}
function structuralNextId(pg){
  let maxId=0;
  const reserve=id=>{ if(Number.isSafeInteger(id) && id>0) maxId=Math.max(maxId,id); };
  for(const n of pg.nodes) reserve(n.id);
  for(const e of pg.edges){ reserve(e.id); reserve(e.from); reserve(e.to); }
  for(const b of pg.behaviors||[]) reserve(b.nodeId);
  for(const sc of pg.scenarios||[]) for(const step of sc.steps){
    if(step.action==="SET_STATE") reserve(step.nodeId);
    if(step.action==="SEND") reserve(step.edgeId);
  }
  return projectCounter(pg.nextId,maxId);
}
function reserveProjectIds(owner,key,count=1,minimum=1){
  const first=projectCounter(owner[key]);
  const next=Math.max(first,minimum);
  if(!Number.isSafeInteger(count) || count<1 || !Number.isSafeInteger(next) || count>Number.MAX_SAFE_INTEGER-next)
    throw projectDataError("id_exhausted");
  owner[key]=next+count;
  return next;
}
function reserveStructureIds(pg,count=1){ return reserveProjectIds(pg,"nextId",count,structuralNextId(pg)); }

/* ===================== EventTypes ===================== */
const EVENT_TEMPLATE_PLACEHOLDERS=new Set(["source","target","name"]);
const EVENT_TYPE_NAME_MAX=60;
const EVENT_TYPE_SENTENCE_MAX=200;
const DEFAULT_EVENT_SYMBOL="●";
/* FLUYO-017.3. Las funciones `…In(d, …)` operan sobre UN documento explícito (editor: el `doc` vivo;
   fluyo-mcp: una copia). Las globales sin sufijo son su versión sobre `doc` y es lo que llama el editor:
   no existe una segunda implementación de las reglas. */
function eventTypeByIdIn(d,id){ return d.eventTypes.find(e=>e.id===id)||null; }
function eventTypeById(id){ return eventTypeByIdIn(doc,id); }

function eventTypeUseCountIn(d,id){
  let count=0;
  for(const pg of d.pages){
    for(const sc of pg.scenarios||[]){
      for(const step of sc.steps||[]){
        if(step.eventTypeId===id) count++;
      }
    }
  }
  return count;
}
function eventTypeUseCount(id){ return eventTypeUseCountIn(doc,id); }
function eventTypeIsUsed(id){ return eventTypeUseCount(id)>0; }
/* Dónde se usa un EventType: [{pageIndex, storyId, storyName, stepIds}] (orden de páginas, Historias y Steps). */
function eventTypeUsagesIn(d,id){
  const out=[];
  d.pages.forEach((pg,pageIndex)=>{
    for(const sc of pg.scenarios||[]){
      const stepIds=(sc.steps||[]).filter(s=>s.eventTypeId===id).map(s=>s.id);
      if(stepIds.length) out.push({pageIndex, storyId:sc.id, storyName:sc.name, stepIds});
    }
  });
  return out;
}

/* Una llave suelta ({ o } fuera de {source}, {target}, {name}) no es texto: el modal del editor lo impide (los marcadores se
   insertan con los chips) y MCP aplica la misma regla. Es una regla de ENTRADA: el dominio (validateEventType, createEventType)
   no rechaza lo ya guardado, p. ej. «{{source}}» (test 010-qa «double curlies»). */
function eventSentenceHasStrayBraces(template){
  return /[{}]/.test(String(template).replace(/{(source|target|name)}/g,""));
}

/* Los errores de validación llevan `field` (qué campo del EventType los causó) para poder explicarlos. */
function validateEventType(et){
  if(!projectObject(et) || !Number.isSafeInteger(et.id) || et.id<1) throw projectDataError("invalid_document","id");
  if(typeof et.name!=="string" || et.name.trim().length===0 || et.name.length>EVENT_TYPE_NAME_MAX) throw projectDataError("invalid_document","name");
  if(!EVENT_TYPE_PRIMITIVES.has(et.primitive)) throw projectDataError("invalid_document","primitive");
  if(typeof et.sentenceTemplate!=="string" || et.sentenceTemplate.trim().length===0 || et.sentenceTemplate.length>EVENT_TYPE_SENTENCE_MAX) throw projectDataError("invalid_document","sentenceTemplate");
  // placeholders allowlisted y bien formados
  for(const m of et.sentenceTemplate.matchAll(/\{([a-zA-Z0-9_]*)\}/g)){
    if(!EVENT_TEMPLATE_PLACEHOLDERS.has(m[1])) throw projectDataError("invalid_document","sentenceTemplate");
  }
  if(!projectObject(et.visual) || et.visual.kind!=="token" || typeof et.visual.value!=="string") throw projectDataError("invalid_document","visual");
  if([...et.visual.value].length>EVENT_TOKEN_MAX_LEN) throw projectDataError("invalid_document","visual");
  if(et.motion!==undefined && !EVENT_TYPE_MOTIONS.has(et.motion)) throw projectDataError("invalid_document","motion");
  normalizeEventTypePresentation(et);
  if(et.primitive==="SET_AVAILABILITY"){
    if(!EVENT_TYPE_AVAILABILITY.has(et.availability)) throw projectDataError("invalid_document","availability");
  } else if(Object.prototype.hasOwnProperty.call(et,"availability")){
    // availability solo tiene sentido para SET_AVAILABILITY
    delete et.availability;
  }
  return et;
}

function normalizeEventTypes(d){
  if(d.eventTypes===undefined) d.eventTypes=[];
  if(!Array.isArray(d.eventTypes)) throw projectDataError();
  d.nextEventTypeId=projectCounter(d.nextEventTypeId);
  const seen=new Set();
  let maxId=0;
  for(const et of d.eventTypes){
    validateEventType(et);
    if(seen.has(et.id)) throw projectDataError();
    seen.add(et.id);
    maxId=Math.max(maxId,et.id);
  }
  d.nextEventTypeId=projectCounter(d.nextEventTypeId,maxId);
}

/* Primitiva de un EventType según lo que elige la persona: «dónde» (conexión|elemento) y, para un
   elemento, su consecuencia (none|up|down). Es la traducción del modal del editor, compartida. */
function eventTypePrimitiveFor(where, consequence){
  if(where==="connection") return "FLOW";
  return consequence==="up" || consequence==="down" ? "SET_AVAILABILITY" : "OCCURRENCE";
}
/* Definición de un EventType a partir de lo que edita el modal (única fuente: el editor y MCP la usan).
   Reglas de forma por primitiva: sólo una conexión tiene movimiento y efectos de conexión; sólo un
   elemento tiene efectos de elemento; sólo SET_AVAILABILITY tiene disponibilidad. */
function eventTypeDefinition(input){
  const primitive=input.primitive;
  const flow=primitive==="FLOW";
  const def={
    name:input.name,
    primitive,
    sentenceTemplate:input.sentenceTemplate,
    visual:{value:input.symbol},
    motion:flow? (input.motion||DEFAULT_EVENT_MOTION) : DEFAULT_EVENT_MOTION
  };
  def.presentation=flow? {connectionEffects:input.connectionEffects} : {nodeEffects:input.nodeEffects};
  if(primitive==="SET_AVAILABILITY") def.availability=input.availability;
  return def;
}

/* Sólo lo que la presentación de un EventType tiene DISTINTO del valor por defecto, de la rama que aplica a su
   primitiva (conexión: size/style/trail/arrival/during; elemento: efectos del elemento). {} si todo es el defecto.
   Lectura compacta para describir un documento; no decide nada. */
function eventTypePresentationDiff(et){
  const flow=et.primitive==="FLOW";
  const cur=flow? normalizeConnectionEffects(et.presentation&&et.presentation.connectionEffects) : normalizeNodeEffects(et.presentation&&et.presentation.nodeEffects);
  const def=flow? defaultConnectionEffects() : defaultNodeEffects();
  const out={};
  for(const k of Object.keys(def)){
    if(k==="visualDurationMs" && cur.visualDuration!=="custom") continue;     // el preset ya lo implica
    if(cur[k]!==def[k]) out[k]=cur[k];
  }
  return out;
}

function createEventTypeIn(d, definition){
  if(!projectObject(definition)) throw projectDataError();
  const name=String(definition.name||"").trim();
  if(!name || name.length>EVENT_TYPE_NAME_MAX) throw projectDataError("invalid_document","name");
  const primitive=definition.primitive;
  if(!EVENT_TYPE_PRIMITIVES.has(primitive)) throw projectDataError("invalid_document","primitive");
  const sentenceTemplate=String(definition.sentenceTemplate||"").trim();
  if(!sentenceTemplate || sentenceTemplate.length>EVENT_TYPE_SENTENCE_MAX) throw projectDataError("invalid_document","sentenceTemplate");
  const visual={kind:"token", value:String(definition.visual&&definition.visual.value||"")};
  if([...visual.value].length>EVENT_TOKEN_MAX_LEN) throw projectDataError("invalid_document","visual");
  const motion=EVENT_TYPE_MOTIONS.has(definition.motion)? definition.motion : DEFAULT_EVENT_MOTION;
  let availability;
  if(primitive==="SET_AVAILABILITY"){
    availability=definition.availability;
    if(!EVENT_TYPE_AVAILABILITY.has(availability)) throw projectDataError("invalid_document","availability");
  }
  let presentation;
  if(definition.presentation!==undefined){
    presentation={ nodeEffects: normalizeNodeEffects(definition.presentation&&definition.presentation.nodeEffects) };
    if(projectObject(definition.presentation) && definition.presentation.connectionEffects!==undefined)
      presentation.connectionEffects=normalizeConnectionEffects(definition.presentation.connectionEffects);
  }
  let maxId=0;
  for(const et of d.eventTypes) maxId=Math.max(maxId,et.id);
  const id=projectCounter(d.nextEventTypeId,maxId);          // el mismo que reservaría reserveProjectIds
  const et={id,name,primitive,sentenceTemplate,visual,motion};
  if(availability!==undefined) et.availability=availability;
  if(presentation!==undefined) et.presentation=presentation;
  validateEventType(et);
  reserveProjectIds(d,"nextEventTypeId",1,id);               // el contador sólo avanza si el EventType es válido
  d.eventTypes.push(et);
  return et;
}
function createEventType(definition){ return createEventTypeIn(doc,definition); }

/* Todo o nada: se aplica sobre una copia y sólo si el resultado es válido se vuelca en el EventType
   (que conserva su identidad de objeto). Primitiva y disponibilidad no cambian si está en uso. */
function updateEventTypeIn(d, id, changes){
  const et=eventTypeByIdIn(d,id);
  if(!et) throw projectDataError("event_type_not_found");
  if(!projectObject(changes)) throw projectDataError();
  const used=eventTypeUseCountIn(d,id)>0;
  if(changes.primitive!==undefined && changes.primitive!==et.primitive && used)
    throw projectDataError("event_type_primitive_immutable_when_used","primitive");
  if(changes.availability!==undefined && et.primitive==="SET_AVAILABILITY" && changes.availability!==et.availability && used)
    throw projectDataError("event_type_availability_immutable_when_used","availability");
  const next=JSON.parse(JSON.stringify(et));
  if(changes.name!==undefined){
    const n=String(changes.name).trim();
    if(!n || n.length>EVENT_TYPE_NAME_MAX) throw projectDataError("invalid_document","name");
    next.name=n;
  }
  if(changes.sentenceTemplate!==undefined){
    const t=String(changes.sentenceTemplate).trim();
    if(!t || t.length>EVENT_TYPE_SENTENCE_MAX) throw projectDataError("invalid_document","sentenceTemplate");
    for(const m of t.matchAll(/\{([a-zA-Z0-9_]*)\}/g)){
      if(!EVENT_TEMPLATE_PLACEHOLDERS.has(m[1])) throw projectDataError("invalid_document","sentenceTemplate");
    }
    next.sentenceTemplate=t;
  }
  if(changes.visual!==undefined){
    const v={kind:"token", value:String(changes.visual&&changes.visual.value||"")};
    if([...v.value].length>EVENT_TOKEN_MAX_LEN) throw projectDataError("invalid_document","visual");
    next.visual=v;
  }
  if(changes.motion!==undefined){
    const m=String(changes.motion||"");
    if(!EVENT_TYPE_MOTIONS.has(m)) throw projectDataError("invalid_document","motion");
    next.motion=m;
  }
  if(changes.presentation!==undefined){
    const np={ nodeEffects: normalizeNodeEffects(changes.presentation&&changes.presentation.nodeEffects) };
    if(projectObject(changes.presentation) && changes.presentation.connectionEffects!==undefined)
      np.connectionEffects=normalizeConnectionEffects(changes.presentation.connectionEffects);
    next.presentation=np;
  }
  if(changes.primitive!==undefined && changes.primitive!==et.primitive){
    if(!EVENT_TYPE_PRIMITIVES.has(changes.primitive)) throw projectDataError("invalid_document","primitive");
    next.primitive=changes.primitive;
    if(next.primitive!=="SET_AVAILABILITY" && Object.prototype.hasOwnProperty.call(next,"availability")) delete next.availability;
  }
  if(changes.availability!==undefined && next.primitive==="SET_AVAILABILITY"){
    if(!EVENT_TYPE_AVAILABILITY.has(changes.availability)) throw projectDataError("invalid_document","availability");
    next.availability=changes.availability;
  }
  validateEventType(next);
  for(const k of Object.keys(et)) delete et[k];
  Object.assign(et,next);
  return et;
}
function updateEventType(id, changes){ return updateEventTypeIn(doc,id,changes); }

function deleteEventTypeIn(d, id){
  if(eventTypeUseCountIn(d,id)>0) throw projectDataError("event_type_in_use");
  d.eventTypes=d.eventTypes.filter(et=>et.id!==id);
}
function deleteEventType(id){ deleteEventTypeIn(doc,id); }

function renderEventSentence(et, source, target){
  if(!et) return "";
  /* Un marcador nunca se pega a letras/dígitos vecinos ni a otro marcador. */
  const tpl=et.sentenceTemplate
    .replace(/\}(?=[\p{L}\p{N}{])/gu,"} ")
    .replace(/([\p{L}\p{N}])(?=\{)/gu,"$1 ");
  return tpl
    .replaceAll("{source}", source||"Origen")
    .replaceAll("{target}", target||"Destino")
    .replaceAll("{name}", et.name)
    .replace(/\s{2,}/g," ").trim();
}

function eventTypeAllowedTargets(et){
  if(!et) return new Set();
  if(et.primitive==="FLOW") return new Set(["edge"]);
  return new Set(["node"]); // OCCURRENCE y SET_AVAILABILITY
}

function validatePersistedStep(step, engineVersion){
  if(!projectObject(step) || !Number.isSafeInteger(step.id) || step.id<1) throw projectDataError();
  if(!Number.isSafeInteger(step.at) || step.at<0) throw projectDataError();
  if(!SCENARIO_ACTIONS.has(step.action)) throw projectDataError();
  // eventTypeId es opcional en cualquier Step de cualquier versión (compatibilidad).
  const baseFields=["id","at","action"];
  const actionFields=step.action==="SET_STATE"?["nodeId","state"]:(step.action==="OCCURRENCE"?["nodeId"]:["edgeId"]);
  // OCCURRENCE solo existe a partir de engineVersion 2; en v1 se rechaza en normalizeScenarios.
  const allowed=[...baseFields, ...actionFields];
  if(step.eventTypeId!==undefined) allowed.push("eventTypeId");
  const keys=Object.keys(step);
  if(keys.length!==allowed.length || !allowed.every(k=>projectOwn(step,k))) throw projectDataError();
  if(step.action==="SET_STATE"){
    if(!Number.isSafeInteger(step.nodeId) || step.nodeId<1 || !SCENARIO_STATES.has(step.state)) throw projectDataError();
  }else if(step.action==="OCCURRENCE"){
    if(!Number.isSafeInteger(step.nodeId) || step.nodeId<1) throw projectDataError();
  }else if(!Number.isSafeInteger(step.edgeId) || step.edgeId<1) throw projectDataError();
  if(step.eventTypeId!==undefined && (!Number.isSafeInteger(step.eventTypeId) || step.eventTypeId<1)) throw projectDataError();
}

function normalizeBehaviors(pg){
  if(pg.behaviors===undefined) pg.behaviors=[];
  if(!Array.isArray(pg.behaviors)) throw projectDataError();
  const seen=new Set();
  // Último valor ganante para cada nodeId; el documento queda canonicalizado.
  pg.behaviors=pg.behaviors.reverse().filter(b=>{
    if(!projectObject(b) || !Number.isSafeInteger(b.nodeId) || b.nodeId<1) throw projectDataError();
    if(!SCENARIO_STATES.has(b.initialState)) throw projectDataError();
    if(seen.has(b.nodeId)) return false;
    seen.add(b.nodeId);
    return true;
  }).reverse();
}
function normalizeScenarios(pg){
  if(pg.scenarios===undefined) pg.scenarios=[];
  if(!Array.isArray(pg.scenarios)) throw projectDataError();
  pg.nextScenarioId=projectCounter(pg.nextScenarioId);
  const scenarioIds=new Set();
  let maxScenarioId=0;
  for(const sc of pg.scenarios){
    if(!projectObject(sc) || !Number.isSafeInteger(sc.id) || sc.id<1) throw projectDataError();
    if(scenarioIds.has(sc.id)) throw projectDataError();
    scenarioIds.add(sc.id);
    maxScenarioId=Math.max(maxScenarioId,sc.id);
    if(!Number.isSafeInteger(sc.engineVersion) || sc.engineVersion<1) throw projectDataError();
    if(typeof sc.name!=="string" || sc.name.trim().length===0 || sc.name.length>120) throw projectDataError();
    if(!Array.isArray(sc.steps)) throw projectDataError();
    const stepIds=new Set();
    let maxStepId=0;
    for(const step of sc.steps){
      validatePersistedStep(step, sc.engineVersion);
      if(sc.engineVersion<2 && step.action==="OCCURRENCE") throw projectDataError();
      if(stepIds.has(step.id)) throw projectDataError();
      stepIds.add(step.id);
      maxStepId=Math.max(maxStepId,step.id);
    }
    sc.nextStepId=projectCounter(sc.nextStepId,maxStepId);
  }
  pg.nextScenarioId=projectCounter(pg.nextScenarioId,maxScenarioId);
}

/* Autoría mínima de modelo: no DOM, undo ni autosave. El coordinador futuro
   puede envolver estas operaciones con el historial existente. */
function createScenario(pg,name="Escenario"){
  if(typeof name!=="string" || !name.trim() || name.length>120) throw projectDataError();
  let maxId=0; for(const sc of pg.scenarios) maxId=Math.max(maxId,sc.id);
  const minimum=projectCounter(pg.nextScenarioId,maxId);
  const sc={id:reserveProjectIds(pg,"nextScenarioId",1,minimum),engineVersion:SCENARIO_ENGINE_VERSION,name,nextStepId:1,steps:[]};
  pg.scenarios.push(sc); return sc;
}
function deleteScenario(pg,id){ pg.scenarios=pg.scenarios.filter(sc=>sc.id!==id); }
/* FLUYO-016. Una Historia es un Scenario; estas dos funciones sólo dan nombres y copia al modelo
   (puras, sin DOM ni undo). Los ids de Step son por Scenario: la copia conserva los de sus Steps
   y su contador, pero recibe un id de Scenario nuevo e irreutilizable. */
function defaultScenarioName(pg){
  const names=new Set((pg.scenarios||[]).map(sc=>sc.name));
  let n=(pg.scenarios||[]).length+1;
  while(names.has("Historia "+n)) n++;
  return "Historia "+n;
}
function copyScenarioName(pg,name){
  const names=new Set(pg.scenarios.map(sc=>sc.name));
  const clip=base=>base.slice(0,120-" copia 999".length);
  const base=clip(name);
  let candidate=base+" copia", n=2;
  while(names.has(candidate)) candidate=base+" copia "+n++;
  return candidate;
}
function duplicateScenario(pg,id){
  const index=pg.scenarios.findIndex(sc=>sc.id===id);
  if(index<0) return null;
  let maxId=0; for(const sc of pg.scenarios) maxId=Math.max(maxId,sc.id);
  const minimum=projectCounter(pg.nextScenarioId,maxId);
  const copy=JSON.parse(JSON.stringify(pg.scenarios[index]));
  copy.id=reserveProjectIds(pg,"nextScenarioId",1,minimum);
  copy.name=copyScenarioName(pg,pg.scenarios[index].name);
  pg.scenarios.splice(index+1,0,copy);
  return copy;
}
function createStep(sc,definition){
  if(sc.engineVersion>SCENARIO_ENGINE_VERSION) throw projectDataError("unsupported_engine_version");
  if(!projectObject(definition) || projectOwn(definition,"id")) throw projectDataError();
  let maxId=0; for(const step of sc.steps) maxId=Math.max(maxId,step.id);
  const next=projectCounter(sc.nextStepId,maxId);
  const step={id:next,...definition}; validatePersistedStep(step, sc.engineVersion);
  reserveProjectIds(sc,"nextStepId",1,next);
  sc.steps.push(step); return step;
}
function deleteStep(sc,id){
  if(sc.engineVersion!==SCENARIO_ENGINE_VERSION) throw projectDataError("unsupported_engine_version");
  sc.steps=sc.steps.filter(step=>step.id!==id);
}

/* ===================== Autoría de Historia compartida (FLUYO-017.2) =====================
   Lógica que antes vivía dentro de editor-scenarios.js. Puro: sin DOM, undo ni autosave. El editor
   y fluyo-mcp (story-authoring.js) llaman a estas mismas funciones; ninguno recalcula tiempos,
   acciones ni destinos por su cuenta. */
const DEFAULT_STEP_DELAY_MS=1000;
const EVENT_ACTION_BY_PRIMITIVE={FLOW:"SEND", OCCURRENCE:"OCCURRENCE", SET_AVAILABILITY:"SET_STATE"};
/* Acción del motor y tipo de objetivo que determina un EventType (la AUTORIDAD: nadie escribe `action`). */
function eventTypeActionSpec(et){
  const action=EVENT_ACTION_BY_PRIMITIVE[et && et.primitive];
  if(!action) return null;
  const spec={action, target: action==="SEND" ? "connection" : "element"};
  if(action==="SET_STATE") spec.state=et.availability;
  return spec;
}
/* Definición de Step para colocar `et` sobre `target` (id de conexión si FLOW; de elemento en otro caso). */
function stepDefinitionForEvent(et,target,at){
  const spec=eventTypeActionSpec(et);
  if(!spec) throw projectDataError("event_type_invalid");
  const def={at, eventTypeId:et.id, action:spec.action};
  if(spec.action==="SEND") def.edgeId=target; else def.nodeId=target;
  if(spec.action==="SET_STATE") def.state=spec.state;
  return def;
}
/* Tiempo al que entra un Step añadido al final: «espera por defecto» tras el último momento (0 si no hay). */
function defaultStepTime(sc,delay=DEFAULT_STEP_DELAY_MS){
  return sc && sc.steps.length ? Math.max(...sc.steps.map(s=>s.at))+delay : 0;
}
/* Cambiar la espera de un momento: `delay` es el tiempo desde el momento anterior (desde 0 si es el primero);
   el momento y TODOS los posteriores se desplazan (dec. 31/44). Devuelve null (Step inexistente / espera
   inválida), {error:"out_of_range"} o {steps, changed}. `maxAt` = tope de tiempo virtual del motor. */
function storyboardSetWait(steps,id,delay,maxAt){
  if(!Number.isSafeInteger(delay)||delay<0) return null;
  const groups=storyboardGroups(steps);
  const i=groups.findIndex(g=>g.steps.some(s=>s.id===id));
  if(i<0) return null;
  const g=groups[i];
  const delta=(i>0?groups[i-1].at:0)+delay-g.at;
  if(!delta) return {steps:steps.map(s=>({...s})), changed:false};
  const out=steps.map(s=>s.at>=g.at?{...s,at:s.at+delta}:{...s});
  if(out.some(s=>!Number.isSafeInteger(s.at)||s.at<0||s.at>maxAt)) return {error:"out_of_range"};
  return {steps:out, changed:true};
}
/* Duplicar un Step: nuevo id, mismo momento, justo debajo (dec. 48). Devuelve la copia o null. */
function duplicateStep(sc,id){
  const src=sc.steps.find(s=>s.id===id);
  if(!src) return null;
  const {id:_id,...rest}=src;
  const copy=createStep(sc,{...rest});
  const r=storyboardInsertDuplicate(sc.steps.filter(s=>s.id!==copy.id),id,copy);
  sc.steps=r.steps;
  return copy;
}
/* Cambiar SÓLO el objetivo de un Step: conserva id, EventType, tiempo, orden y presentación. */
function retargetStep(pg,sc,stepId,targetId){
  const step=sc.steps.find(s=>s.id===stepId);
  if(!step) throw projectDataError("step_not_found");
  if(step.action==="SEND"){
    if(!pg.edges.some(e=>e.id===targetId)) throw projectDataError("target_not_found");
    step.edgeId=targetId;
  }else{
    if(!pg.nodes.some(n=>n.id===targetId)) throw projectDataError("target_not_found");
    step.nodeId=targetId;
  }
  return step;
}
/* Disponibilidad INICIAL de un elemento: es de la PÁGINA (Behavior), rige en todas sus Historias.
   UP es el valor por defecto y se representa sin Behavior. */
function setInitialAvailability(pg,nodeId,state){
  if(state!=="UP" && state!=="DOWN") throw projectDataError();
  if(!pg.nodes.some(n=>n.id===nodeId)) throw projectDataError("node_not_found");
  pg.behaviors=pg.behaviors.filter(b=>b.nodeId!==nodeId);
  if(state==="DOWN") pg.behaviors.push({nodeId, initialState:"DOWN"});
}

/* ===================== Autoría del diagrama: crear nodos y conexiones (FLUYO-018.1) =====================
   Autoridad ÚNICA de creación. La llaman newNode/newEdge del editor (state.js) y, más adelante,
   FluyoAuthoring: no existe una segunda implementación. Operan sobre UNA página explícita (como las
   `…In` de EventTypes) y no saben nada de DOM, selección, undo, snap, geometría ni revisiones.

   · Reciben valores YA decididos: sin snap, sin redondeo (los decimales se conservan).
   · Producen exactamente el registro que escribía el editor, con sus defaults.
   · Un nodo NO crea Behavior (UP implícito; ver setInitialAvailability). Una conexión NO tiene
     Behavior ni EventType: eso lo une el Step de una Historia.
   · Geometría: se persisten fromSide/toSide/route/waypoints con los defaults del editor
     (null/null/"straight"/[]). Los puntos de la ruta se DERIVAN en geometry.js (edgePoints); por eso
     nada de aquí la calcula ni la copia. Quien quiera lados fijos los pasa ya decididos.
   · Todo o nada: se valida con la misma normalización que la carga de documentos y solo entonces se
     reserva el id y se inserta. Error estructurado (projectDataError): {code, field?}, nunca TypeError.
   · `ref` es un concepto de la capa de autoría y NO se persiste. Si `context.refs` (un Map ref→id del
     lote, uno por tipo de entidad) viene, se rechaza la repetida (duplicate_ref) y se registra la nueva.

   Códigos: invalid_document(field) · source_not_found · target_not_found · self_loop ·
            duplicate_structure_id · duplicate_ref · id_exhausted. */
const NODE_SPEC_KEYS=new Set(["ref","id","shape","x","y","w","h","label","color","fill","border","lblPos",
  "textBg","textColor","font","bold","pulse","order","fs","icon","anim","img","tint","lang","keywords","kwBg","kwColor"]);
const CONNECTION_SPEC_KEYS=new Set(["ref","id","source","target","fromSide","toSide","route","waypoints","label",
  "font","bold","animated","dashed","startArrow","endArrow","flowDir","lineColor","dotColor","fs","speedFac","dots","dotsGlobal"]);

function authoringPage(pg){
  if(!projectObject(pg) || !Array.isArray(pg.nodes) || !Array.isArray(pg.edges)) throw projectDataError("invalid_document","page");
}
function authoringSpec(spec,allowed){
  if(!projectObject(spec)) throw projectDataError("invalid_document","spec");
  for(const key of Object.keys(spec)) if(!allowed.has(key)) throw projectDataError("invalid_document",key);
}
function authoringRef(spec,context){
  if(spec.ref===undefined) return undefined;
  if(typeof spec.ref!=="string" || !spec.ref) throw projectDataError("invalid_document","ref");
  if(context && context.refs && context.refs.has(spec.ref)) throw projectDataError("duplicate_ref","ref");
  return spec.ref;
}
/* Un id de estructura está en uso si lo ocupa un nodo, una conexión o algo que ya lo referencia
   (Behavior, Step): los ids de una página nunca se reutilizan. */
function structureIdInUse(pg,id){
  return pg.nodes.some(n=>n.id===id) || pg.edges.some(e=>e.id===id) ||
    (pg.behaviors||[]).some(b=>b.nodeId===id) ||
    (pg.scenarios||[]).some(sc=>(sc.steps||[]).some(st=>st.nodeId===id || st.edgeId===id));
}
/* Id que se asignaría (sin reservarlo). Explícito → validado; sin id → el próximo del contador. */
function authoringId(pg,spec){
  if(spec.id===undefined) return structuralNextId(pg);
  if(!Number.isSafeInteger(spec.id) || spec.id<1 || spec.id>=Number.MAX_SAFE_INTEGER) throw projectDataError("invalid_document","id");
  if(structureIdInUse(pg,spec.id)) throw projectDataError("duplicate_structure_id","id");
  return spec.id;
}
function commitAuthoringId(pg,spec,id){
  if(spec.id===undefined) reserveStructureIds(pg);
  else pg.nextId=Math.max(structuralNextId(pg),id+1);   // el contador nunca queda por detrás de un id explícito
}
function authoringClone(record){
  try{ return deep(record); }catch(e){ throw projectDataError(); }   // BigInt, ciclos… → error estructurado, no TypeError
}
function authoringAssign(target,spec,skip){
  for(const key of Object.keys(spec)) if(!skip.includes(key) && spec[key]!==undefined) target[key]=spec[key];
  return target;
}

function createNodeIn(pg, spec, context){
  authoringPage(pg); authoringSpec(spec,NODE_SPEC_KEYS);
  const {shape,x,y}=spec;
  if(typeof shape!=="string" || !projectOwn(DEFAULT_SIZES,shape)) throw projectDataError("invalid_document","shape");
  for(const [key,v] of [["x",x],["y",y]]) if(typeof v!=="number" || !Number.isFinite(v)) throw projectDataError("invalid_document",key);
  const ref=authoringRef(spec,context);
  const id=authoringId(pg,spec);
  const [w,h]=DEFAULT_SIZES[shape];
  const n=authoringAssign({ id, shape, x, y, w, h,
    label: shape==="text"?"Texto":shape==="code"?CODE_DEFAULT_LABEL:(shape==="icon"||shape==="image"||shape==="anim")?"":"Nodo",
    color:PALETTE[0].c, fill:null, border:"solid", lblPos:"center", textBg:null, textColor:null,
    font:null, bold:false, pulse:false, order:pg.nodes.length }, spec, ["ref","id"]);
  /* Los campos de `code` solo se ponen en nodos `code`, igual que `icon` solo va
     en los de icono: no tiene sentido cargar todos los nodos con ellos. */
  if(shape==="code" && !("lang" in n)) Object.assign(n,{lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null});
  /* `tint` nace apagado también en los iconos nuevos: el interruptor tiene que
     significar lo mismo en un diagrama de hoy y en uno de hace un mes. */
  if(shape==="icon" && !("tint" in n)) n.tint=false;
  const node=authoringClone(n);                               // copia: la validación normaliza, y la entrada no se toca
  normalizeProjectItem(node); normalizeProjectNode(node,pg.nodes.length);
  commitAuthoringId(pg,spec,id);
  pg.nodes.push(node);
  if(ref!==undefined && context && context.refs) context.refs.set(ref,id);
  return node;
}

function createConnectionIn(pg, spec, context){
  authoringPage(pg); authoringSpec(spec,CONNECTION_SPEC_KEYS);
  const {source,target}=spec;
  /* Regla de dominio compartida (editor y MCP): una conexión no sale y entra en el mismo nodo. */
  if(source===target && source!==undefined) throw projectDataError("self_loop","target");
  if(!pg.nodes.some(n=>n.id===source)) throw projectDataError("source_not_found","source");
  if(!pg.nodes.some(n=>n.id===target)) throw projectDataError("target_not_found","target");
  const ref=authoringRef(spec,context);
  const id=authoringId(pg,spec);
  const e=authoringAssign({ id, from:source, to:target, fromSide:null, toSide:null,
    route:"straight", waypoints:[], label:"", font:null, bold:false, animated:true, dashed:false, startArrow:false, endArrow:true, flowDir:"normal" },
    spec, ["ref","id","source","target"]);
  const edge=authoringClone(e);
  normalizeProjectItem(edge); normalizeProjectEdge(edge,DEFAULT_SETTINGS.dots);
  commitAuthoringId(pg,spec,id);
  pg.edges.push(edge);
  if(ref!==undefined && context && context.refs) context.refs.set(ref,id);
  return edge;
}

/* ===================== Autoría del diagrama: modificar y eliminar (FLUYO-018.3) =====================
   Misma autoridad única que la creación: las llaman el panel y los gestos del editor (state.js: editNode, editEdge,
   removeNodes, removeEdges) y FluyoAuthoring (update_node, update_connection, delete_node, delete_connection).

   · Parche: SOLO las claves que la UI del editor escribe hoy. Una desconocida (también `id` y `ref`) se rechaza.
     `undefined` se ignora (no pisa defaults). Se valida una COPIA con la normalización de la carga y solo se vuelcan
     las claves del parche ya normalizadas: nada se «completa» por detrás (igual que el editor).
   · Todo o nada: ante cualquier error el registro queda intacto. Error estructurado {code, field?}, nunca TypeError.
   · No saben de geometría, snap, undo, selección ni DOM. Mover/redimensionar solo escribe x,y,w,h: la ruta de las
     conexiones se deriva en geometry.js, y los waypoints no se tocan salvo que el parche los traiga.
   · Borrar NO toca Historias, Steps ni EventTypes: que el documento resultante sea válido (B2) lo decide el estado
     final con FluyoIntegrity. Sí quita lo que es del propio elemento: sus conexiones incidentes y su Behavior.

   Códigos: invalid_document(campo) · node_not_found · connection_not_found · source_not_found · target_not_found · self_loop. */
const NODE_UPDATE_KEYS=new Set(["x","y","w","h","shape","label","color","fill","border","lblPos","textBg","textColor",
  "font","bold","pulse","order","fs","tint","lang","keywords","kwBg","kwColor"]);
const CONNECTION_UPDATE_KEYS=new Set(["source","target","fromSide","toSide","route","waypoints","label","font","bold","fs",
  "animated","dashed","startArrow","endArrow","flowDir","lineColor","dotColor","speedFac","dots","dotsGlobal"]);
/* Formas que ofrece el selector de forma; image/icon/anim no cambian de forma (el control se oculta). */
const EDITABLE_SHAPES=new Set(["rect","cylinder","diamond","circle","hex","text","code"]);
const FROZEN_SHAPES=new Set(["image","icon","anim"]);
const UPDATE_BOOLEANS=new Set(["bold","pulse","tint","animated","dashed","startArrow","endArrow","dotsGlobal"]);
const UPDATE_NUMBERS=new Set(["speedFac","dots"]);               // la normalización de la carga sustituye en silencio un valor no numérico: aquí se rechaza
const UPDATE_NULLABLE_STRINGS=new Set(["lineColor","dotColor"]);   // normalizeProjectItem no los comprueba
const NODE_FIELDS_BY_SHAPE={tint:["icon"], lang:["code"], keywords:["code"], kwBg:["code"], kwColor:["code"]};

const connectionKey=k=>k==="source"?"from":k==="target"?"to":k;   // en el documento una conexión guarda from/to
function updateEntry(pg,listKey,id,notFound){
  authoringPage(pg);
  if(!Number.isSafeInteger(id) || id<1) throw projectDataError("invalid_document","id");
  const item=pg[listKey].find(x=>x.id===id);
  if(!item) throw projectDataError(notFound,"id");
  return item;
}
function updatePatch(patch,allowed){
  authoringSpec(patch,allowed);
  const fields=Object.keys(patch).filter(k=>patch[k]!==undefined);
  for(const k of fields){
    const v=patch[k];
    if(UPDATE_BOOLEANS.has(k) && typeof v!=="boolean") throw projectDataError("invalid_document",k);
    if(UPDATE_NUMBERS.has(k) && !(typeof v==="number" && Number.isFinite(v)) && !(v===null && k==="dots")) throw projectDataError("invalid_document",k);
    if(UPDATE_NULLABLE_STRINGS.has(k) && v!==null && typeof v!=="string") throw projectDataError("invalid_document",k);
  }
  return fields;
}
/* Aplica el parche a una copia y la valida con la normalización de la carga. Si falla sin nombrar el campo, se atribuye al
   primer campo del parche que falla por sí solo (así el rechazo dice QUÉ valor no vale). */
function validatedCandidate(record,fields,patch,drop,normalize){
  const build=keys=>{
    const cand=Object.assign({},record);
    for(const k of drop) delete cand[k];
    for(const k of keys) cand[connectionKey(k)]=authoringClone(patch[k]);
    return cand;
  };
  try{ const cand=build(fields); normalize(cand); return cand; }
  catch(err){
    if(err && err.code && err.field===undefined)
      for(const k of fields){ try{ normalize(build([k])); }catch(e2){ throw projectDataError("invalid_document",k); } }
    throw err;
  }
}
function updateNodeIn(pg, id, patch, context){
  const n=updateEntry(pg,"nodes",id,"node_not_found");
  const fields=updatePatch(patch,NODE_UPDATE_KEYS);
  const shape=patch.shape===undefined? n.shape : patch.shape;
  if(patch.shape!==undefined && patch.shape!==n.shape && (!EDITABLE_SHAPES.has(patch.shape) || FROZEN_SHAPES.has(n.shape)))
    throw projectDataError("invalid_document","shape");
  for(const k of fields) if(NODE_FIELDS_BY_SHAPE[k] && !NODE_FIELDS_BY_SHAPE[k].includes(shape)) throw projectDataError("invalid_document",k);
  for(const k of ["label","color"]) if(fields.includes(k) && typeof patch[k]!=="string") throw projectDataError("invalid_document",k);
  const index=pg.nodes.indexOf(n);
  // `img` queda fuera de la copia validada: el saneado de la imagen no cambia al mover/editar y no se repite en cada fotograma.
  const cand=validatedCandidate(n,fields,patch,["img"],c=>{ normalizeProjectItem(c); normalizeProjectNode(c,index); });
  for(const k of fields) n[k]=cand[k];
  return n;
}
function updateConnectionIn(pg, id, patch, context){
  const e=updateEntry(pg,"edges",id,"connection_not_found");
  const fields=updatePatch(patch,CONNECTION_UPDATE_KEYS);
  for(const k of ["source","target"]) if(fields.includes(k) && !Number.isSafeInteger(patch[k])) throw projectDataError("invalid_document",k);
  if(fields.includes("label") && typeof patch.label!=="string") throw projectDataError("invalid_document","label");
  const from=fields.includes("source")? patch.source : e.from, to=fields.includes("target")? patch.target : e.to;
  if(fields.includes("source")||fields.includes("target")){
    if(from===to) throw projectDataError("self_loop","target");
    if(fields.includes("source") && !pg.nodes.some(n=>n.id===from)) throw projectDataError("source_not_found","source");
    if(fields.includes("target") && !pg.nodes.some(n=>n.id===to)) throw projectDataError("target_not_found","target");
  }
  const cand=validatedCandidate(e,fields,patch,[],c=>{ normalizeProjectItem(c); normalizeProjectEdge(c,DEFAULT_SETTINGS.dots); });
  for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];
  return e;
}
/* Quita el nodo, las conexiones que lo tocan y su Behavior. Devuelve lo que se llevó: {node, connections, behaviors}. */
function deleteNodeIn(pg, id, context){
  const n=updateEntry(pg,"nodes",id,"node_not_found");
  const connections=pg.edges.filter(e=>e.from===id || e.to===id).map(e=>e.id);
  // El Behavior del nodo se quita con él (editor, desde FLUYO-018.4, y author_document, que además lo informa): un Behavior huérfano
  // invalida todas las Historias de la página. context.keepBehaviors lo conserva (ningún llamador actual lo usa).
  const keep=!!(context && context.keepBehaviors);
  const behaviors=keep? [] : (pg.behaviors||[]).filter(b=>b.nodeId===id).map(b=>b.nodeId);
  pg.edges=pg.edges.filter(e=>e.from!==id && e.to!==id);
  pg.nodes=pg.nodes.filter(x=>x!==n);
  if(!keep && pg.behaviors) pg.behaviors=pg.behaviors.filter(b=>b.nodeId!==id);
  return {node:n, connections, behaviors};
}
function deleteConnectionIn(pg, id, context){
  const e=updateEntry(pg,"edges",id,"connection_not_found");
  pg.edges=pg.edges.filter(x=>x!==e);
  return e;
}

function clearPageContents(pg){
  pg.nodes=[];
  pg.edges=[];
  pg.behaviors=[];
  pg.scenarios=[];
  pg.nextId=1;
  pg.nextScenarioId=1;
}

function settingsFromProjectData(source){
  if(source==null) source={};
  if(!projectObject(source)) throw projectDataError();
  const normalized={...source,...DEFAULT_SETTINGS};
  normalized.speed=clamp(projectNumber(source.speed,DEFAULT_SETTINGS.speed),.2,2);
  normalized.dots=clamp(Math.round(projectNumber(source.dots,DEFAULT_SETTINGS.dots)),1,6);
  normalized.stagger=clamp(projectNumber(source.stagger,DEFAULT_SETTINGS.stagger),.2,1.2);
  for(const key of ["build","grid","snap","single"])
    normalized[key]=typeof source[key]==="boolean"? source[key] : DEFAULT_SETTINGS[key];
  normalized.font=FONTS.some(font=>font.f===source.font)? source.font : DEFAULT_FONT;
  return normalized;
}
function normalizeProjectItem(item){
  if(!projectObject(item) || !Number.isSafeInteger(item.id) || item.id<1)
    throw projectDataError();
  for(const key of ["label","font","color","fill","textBg","textColor","kwBg","kwColor","img","icon"]){
    if(item[key]!=null && typeof item[key]!=="string") throw projectDataError();
  }
  if(item.label==null) item.label="";
  if(item.font===undefined) item.font=null;
  if(item.bold===undefined) item.bold=false;
  if(item.fs!=null){
    if(typeof item.fs!=="number" || !Number.isFinite(item.fs) || item.fs<0) throw projectDataError();
    // 0 significa automático; fsIn admite valores manuales entre 8 y 96.
    if(item.fs) item.fs=clamp(item.fs,8,96);
  }
}
/* Normalización/validación de UNA arista o UN nodo. Es la de la carga de documentos
   (projectFromProjectData) y también la que aplica la autoría (createConnectionIn /
   createNodeIn): una sola regla de «registro válido». Mutan su argumento. */
function normalizeProjectEdge(e,defaultDots){
  if(!Number.isSafeInteger(e.from) || !Number.isSafeInteger(e.to)) throw projectDataError();
  for(const key of ["fromSide","toSide"]){
    if(e[key]==="" || e[key]===undefined) e[key]=null;
    if(e[key]!==null && !SIDES.includes(e[key])) throw projectDataError();
  }
  if(e.endArrow===undefined){ e.endArrow=true; e.startArrow=!!e.bidir; }
  if(!e.flowDir) e.flowDir="normal";
  if(!e.waypoints) e.waypoints=[];
  if(!e.route) e.route="straight";
  if(!["straight","ortho"].includes(e.route) || !["normal","reverse","alternate"].includes(e.flowDir)) throw projectDataError();
  if(!Array.isArray(e.waypoints) || e.waypoints.some(wp=>!projectObject(wp) || !Number.isFinite(wp.x) || !Number.isFinite(wp.y))) throw projectDataError();
  if(e.speedFac!==undefined) e.speedFac=clamp(projectNumber(e.speedFac,1),1,4);
  if(e.dots!==undefined) e.dots=clamp(Math.round(projectNumber(e.dots,defaultDots)),1,6);
}
function normalizeProjectNode(n,i){
  // Mismo contrato para archivo, deep link y viewer; SVG estático seguro.
  if(n.img) n.img=normalizeDocumentImage(n.img);
  if(n.shape===undefined) n.shape="rect";
  if(!projectOwn(DEFAULT_SIZES,n.shape)) throw projectDataError();
  const [w,h]=DEFAULT_SIZES[n.shape];
  for(const [key,fallback] of [["x",0],["y",0],["w",w],["h",h],["order",i]]){
    if(n[key]===undefined) n[key]=fallback;
    if(typeof n[key]!=="number" || !Number.isFinite(n[key])) throw projectDataError();
  }
  if(n.w<=0 || n.h<=0 || n.order<0 || ![n.x-n.w/2,n.x+n.w/2,n.y-n.h/2,n.y+n.h/2].every(Number.isFinite)) throw projectDataError();
  if(n.color==null) n.color=PALETTE[0].c;
  if(n.fill===undefined) n.fill=null;
  if(!n.border) n.border="solid";
  if(!n.lblPos) n.lblPos="center";
  if(!["solid","dashed","dotted","none"].includes(n.border) || !["center","top","bottom","left","right"].includes(n.lblPos)) throw projectDataError();
  if(n.textBg===undefined) n.textBg=null;
  if(n.textColor===undefined) n.textColor=null;
  if(n.shape==="code"){
    if(n.lang==null) n.lang=DEFAULT_LANG;
    if(!projectOwn(CODE_LANGS,n.lang)) throw projectDataError();
    if(n.keywords!=null && (!Array.isArray(n.keywords) || n.keywords.some(word=>typeof word!=="string"))) throw projectDataError();
  }
}
/* Única frontera de entrada: migra, normaliza y devuelve documento + settings
   sin instalar estado ni conservar referencias al objeto de entrada. */
function projectFromProjectData(input){
  if(!projectObject(input)) throw projectDataError();
  if(input.version!==undefined){
    if(!Number.isInteger(input.version)) throw projectDataError();
    if(input.version<1 || input.version>5) throw projectDataError("unsupported_version");
  }
  if(input.app!==undefined && input.app!=="fluyo") throw projectDataError();
  let d;
  try{ d=deep(input); }catch(e){ throw projectDataError(); }
  const normalizedSettings=settingsFromProjectData(d.settings);
  let nd;
  if(d && d.doc && Array.isArray(d.doc.pages) && d.doc.pages.length) nd=d.doc;
  else if(d && d.state && Array.isArray(d.state.nodes)){
    if(d.state.edges!=null && !Array.isArray(d.state.edges)) throw projectDataError();
    nd={theme:d.state.theme||"dark", cur:0,
        pages:[Object.assign(blankPage("Página 1"),{nodes:d.state.nodes,edges:(d.state.edges||[]).map(e=>Object.assign({fromSide:null,toSide:null,route:"straight",waypoints:[]},e)),nextId:d.state.nextId===undefined?999:d.state.nextId})]};
  } else throw projectDataError();
  if(nd.theme===undefined) nd.theme="dark";
  if(!projectOwn(THEMES,nd.theme)) throw projectDataError();
  nd.cur=clamp(Math.trunc(projectNumber(nd.cur,0)),0,nd.pages.length-1);
  if(nd.customBg===undefined) nd.customBg="";
  if(typeof nd.customBg!=="string") throw projectDataError();
  nd.pages.forEach(pg=>{
    if(!projectObject(pg) || !Array.isArray(pg.nodes) || !Array.isArray(pg.edges)) throw projectDataError();
    if(pg.name!=null && typeof pg.name!=="string") throw projectDataError();
    const ids=new Set();
    for(const item of [...pg.nodes,...pg.edges]){
      normalizeProjectItem(item);
      if(ids.has(item.id)) throw projectDataError();
      ids.add(item.id);
    }
    pg.nextId=projectCounter(pg.nextId);
  });
  nd.pages.forEach(pg=>pg.edges.forEach(e=>normalizeProjectEdge(e,normalizedSettings.dots)));
  nd.pages.forEach(pg=>pg.nodes.forEach((n,i)=>normalizeProjectNode(n,i)));
  normalizeEventTypes(nd);
  nd.pages.forEach(pg=>{ normalizeBehaviors(pg); normalizeScenarios(pg); pg.nextId=structuralNextId(pg); });
  return {doc:nd,settings:normalizedSettings};
}
/* Compatibilidad de la API usada por migración/añadir páginas y deep link. */
function documentFromProjectData(d){ return projectFromProjectData(d).doc; }

/* ===================== Historia: orden de apariciones (FLUYO-012) =====================
   Única fuente de la semántica de reordenar. «Mover antes/después» (menú) y el
   arrastre directo son dos formas de invocar estas mismas funciones.

   Orden efectivo: por step.at y, a igualdad, por POSICIÓN en el array (nunca por id,
   nombre ni destino). Un «momento» es un grupo de Steps con el mismo at.

   Regla central: los instantes son RANURAS. Al reordenar, el contenido se mueve y las
   ranuras (los tiempos) se quedan en su sitio; por eso el ritmo de la Historia
   («1 s después… 4 s después…») se conserva. No se inventan timestamps.

   - Plano (menú Mover antes/después): ranura = posición en la lista de Steps ordenada.
   - Por momentos (arrastrar a un hueco entre momentos): ranura = momento. Sólo para
     un Step que es su propio momento; coincide con el plano cuando no hay simultáneos.
   - Unirse a un momento (soltar entre/sobre filas de un momento): at = at del ancla.
     Si el momento de origen desaparece, su espera se colapsa y las esperas restantes
     se conservan (los at posteriores se adelantan). Ver FLUYO-012.1.
   Sacar un Step de un momento simultáneo hacia un hueco NO está soportado (exigiría
   inventar un instante); se hace con Mover antes/después o editando la espera. */
function storyboardOrderedSteps(steps){
  return (steps||[]).map((s,i)=>({s,i})).sort((a,b)=>a.s.at-b.s.at||a.i-b.i).map(x=>x.s);
}
function storyboardGroups(steps){
  const groups=[];
  for(const s of storyboardOrderedSteps(steps)){
    let g=groups[groups.length-1];
    if(!g||g.at!==s.at){ g={at:s.at,steps:[]}; groups.push(g); }
    g.steps.push(s);
  }
  return groups;
}
/* Mueve items[from] a la posición final `to` manteniendo los tiempos en sus ranuras. */
function storyboardRotateSlots(items, atOf, from, to){
  const slots=items.map(atOf);
  const list=items.slice();
  const [moved]=list.splice(from,1);
  list.splice(to,0,moved);
  return {list, slots};
}
function storyboardSameArrangement(a,b){
  return a.length===b.length && a.every((s,i)=>s.id===b[i].id && s.at===b[i].at);
}
/* Mover antes/después: intercambio en la lista plana (dir -1 | +1). */
function storyboardMoveByOne(steps,id,dir){
  const ordered=storyboardOrderedSteps(steps);
  const i=ordered.findIndex(s=>s.id===id), j=i+dir;
  if(i<0||j<0||j>=ordered.length) return null;
  const {list,slots}=storyboardRotateSlots(ordered,s=>s.at,i,j);
  const out=list.map((s,k)=>({...s,at:slots[k]}));
  return {steps:out, changed:true};
}
/* Política única de «un momento desaparece» (unirse a otro, o eliminar su única aparición):
   su espera se colapsa, los momentos posteriores se adelantan esa cantidad y conservan sus
   propias esperas («3 s después» sigue siendo «3 s después»). El primer momento conserva el
   arranque de la historia. Si el momento no desaparece (tiene más apariciones), nada cambia.
   Devuelve los grupos resultantes SIN el Step `id` (puede incluir grupos vacíos). */
function storyboardCollapsedGroups(groups,gi,id){
  const vanishes=groups[gi].steps.length===1;
  const gap=!vanishes?0:(gi>0?groups[gi].at-groups[gi-1].at:(groups[gi+1]?groups[gi+1].at-groups[gi].at:0));
  return groups.map((g,k)=>{
    const at=vanishes&&k>gi?g.at-gap:g.at;
    return {at,steps:g.steps.filter(s=>s.id!==id).map(s=>({...s,at}))};
  });
}
/* Eliminar una aparición: misma política que unirse (no deja esperas absurdas tipo «7 s»). */
function storyboardRemoveStep(steps,id){
  const groups=storyboardGroups(steps);
  const gi=groups.findIndex(g=>g.steps.some(s=>s.id===id));
  if(gi<0) return null;
  const out=storyboardCollapsedGroups(groups,gi,id).flatMap(g=>g.steps);
  return {steps:out, changed:true};
}
/* Duplicar: la copia entra en el MISMO momento, justo después del original (mismo `at`,
   posición de array contigua). No inventa esperas ni desplaza nada. `copy` ya trae su id. */
function storyboardInsertDuplicate(steps,id,copy){
  const ordered=storyboardOrderedSteps(steps);
  const i=ordered.findIndex(s=>s.id===id);
  if(i<0||!copy) return null;
  const out=ordered.map(s=>({...s}));
  out.splice(i+1,0,{...copy,at:ordered[i].at});
  return {steps:out, changed:true};
}
/* Arrastre. target:
     {kind:"gap", index}            hueco ANTES del momento `index` (0..momentos)
     {kind:"join", anchorId, after} dentro del momento del ancla, antes/después de ella
   Devuelve {steps, changed} o null si la operación no está soportada/ es inválida. */
function storyboardMoveStep(steps,id,target){
  const groups=storyboardGroups(steps);
  const gi=groups.findIndex(g=>g.steps.some(s=>s.id===id));
  if(gi<0||!target) return null;
  const before=storyboardOrderedSteps(steps);
  let resultGroups;
  if(target.kind==="gap"){
    if(!Number.isInteger(target.index)||target.index<0||target.index>groups.length) return null;
    if(groups[gi].steps.length!==1) return null;
    const to=target.index>gi?target.index-1:target.index;
    const {list,slots}=storyboardRotateSlots(groups,g=>g.at,gi,to);
    resultGroups=list.map((g,k)=>({at:slots[k],steps:g.steps.map(s=>({...s,at:slots[k]}))}));
  }else if(target.kind==="join"){
    if(target.anchorId===id) return null;
    const ai=groups.findIndex(g=>g.steps.some(s=>s.id===target.anchorId));
    if(ai<0) return null;
    /* Si el momento de origen desaparece, su espera se colapsa (storyboardCollapsedGroups). */
    resultGroups=storyboardCollapsedGroups(groups,gi,id);
    const at=resultGroups[ai].at;
    const moved={...groups[gi].steps.find(s=>s.id===id),at};
    const list=resultGroups[ai].steps;
    const pos=list.findIndex(s=>s.id===target.anchorId)+(target.after?1:0);
    list.splice(pos,0,moved);
    resultGroups=resultGroups.filter(g=>g.steps.length);
  }else return null;
  const out=resultGroups.flatMap(g=>g.steps);
  return {steps:out, changed:!storyboardSameArrangement(before,out)};
}
/* Destino de soltado a partir de la geometría de las filas (puro, testeable).
   rows: [{stepId, groupIndex, groupSize, indexInGroup, top, bottom}] en orden visual.
   Devuelve {target, line:{y, kind}} o null. `y` es la coordenada vertical del puntero. */
function storyboardDropTarget(rows, sourceId, y, groupsCount, sourceGroupSize){
  if(!rows.length) return null;
  const canGap=sourceGroupSize===1;
  let row=rows.find(r=>y>=r.top&&y<r.bottom);
  if(!row) row=y<rows[0].top?rows[0]:rows[rows.length-1];
  const h=Math.max(1,row.bottom-row.top), k=(y-row.top)/h;
  const first=row.indexInGroup===0, last=row.indexInGroup===row.groupSize-1;
  const gapTop={kind:"gap",index:row.groupIndex}, gapBottom={kind:"gap",index:row.groupIndex+1};
  const lineTop=row.top, lineBottom=row.bottom;
  if(canGap && first && k<0.35) return {target:gapTop,line:{y:lineTop,kind:"gap"}};
  if(canGap && last && k>0.65) return {target:gapBottom,line:{y:lineBottom,kind:"gap"}};
  if(row.stepId===sourceId){
    return null;
  }
  if(row.groupSize===1){
    // Fila única de otro momento: el centro es «al mismo tiempo» (unirse).
    if(!canGap || (k>=0.35&&k<=0.65)) return {target:{kind:"join",anchorId:row.stepId,after:k>0.5},line:{y:k>0.5?lineBottom:lineTop,kind:"join",row:row.stepId}};
  }
  const after=k>0.5;
  return {target:{kind:"join",anchorId:row.stepId,after},line:{y:after?lineBottom:lineTop,kind:"join",row:row.stepId}};
}

/* Exposición mínima para el editor de Scenarios. */
if(typeof window!=="undefined"){
  window.eventTypeById=eventTypeById;
  window.createEventType=createEventType;
  window.updateEventType=updateEventType;
  window.deleteEventType=deleteEventType;
  window.eventTypeIsUsed=eventTypeIsUsed;
  window.eventTypeUseCount=eventTypeUseCount;
  window.renderEventSentence=renderEventSentence;
  window.eventTypeAllowedTargets=eventTypeAllowedTargets;
  window.clearPageContents=clearPageContents;
  window.EVENT_MOTION_MS=EVENT_MOTION_MS;
  window.DEFAULT_EVENT_MOTION=DEFAULT_EVENT_MOTION;
  window.NODE_EFFECT_MAX_MESSAGE_LEN=NODE_EFFECT_MAX_MESSAGE_LEN;
  window.defaultNodeEffects=defaultNodeEffects;
  window.normalizeNodeEffects=normalizeNodeEffects;
  window.normalizeConnectionEffects=normalizeConnectionEffects;
  window.defaultConnectionEffects=defaultConnectionEffects;
  window.connectionVisualSpec=connectionVisualSpec;
  window.nodeEffectDurationMs=nodeEffectDurationMs;
  window.parseVisualDurationSeconds=parseVisualDurationSeconds;
}
