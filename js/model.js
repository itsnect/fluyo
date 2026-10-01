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
function serializeProject(){ return {version:5,app:"fluyo",doc,settings}; }

function projectDataError(code="invalid_document"){
  const err=new Error(code); err.code=code; return err;
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
function eventTypeById(id){ return doc.eventTypes.find(e=>e.id===id)||null; }

function eventTypeUseCount(id){
  let count=0;
  for(const pg of doc.pages){
    for(const sc of pg.scenarios||[]){
      for(const step of sc.steps||[]){
        if(step.eventTypeId===id) count++;
      }
    }
  }
  return count;
}
function eventTypeIsUsed(id){ return eventTypeUseCount(id)>0; }

function validateEventType(et){
  if(!projectObject(et) || !Number.isSafeInteger(et.id) || et.id<1) throw projectDataError();
  if(typeof et.name!=="string" || et.name.trim().length===0 || et.name.length>60) throw projectDataError();
  if(!EVENT_TYPE_PRIMITIVES.has(et.primitive)) throw projectDataError();
  if(typeof et.sentenceTemplate!=="string" || et.sentenceTemplate.trim().length===0 || et.sentenceTemplate.length>200) throw projectDataError();
  // placeholders allowlisted y bien formados
  for(const m of et.sentenceTemplate.matchAll(/\{([a-zA-Z0-9_]*)\}/g)){
    if(!EVENT_TEMPLATE_PLACEHOLDERS.has(m[1])) throw projectDataError();
  }
  if(!projectObject(et.visual) || et.visual.kind!=="token" || typeof et.visual.value!=="string") throw projectDataError();
  if([...et.visual.value].length>EVENT_TOKEN_MAX_LEN) throw projectDataError();
  if(et.motion!==undefined && !EVENT_TYPE_MOTIONS.has(et.motion)) throw projectDataError();
  normalizeEventTypePresentation(et);
  if(et.primitive==="SET_AVAILABILITY"){
    if(!EVENT_TYPE_AVAILABILITY.has(et.availability)) throw projectDataError();
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

function createEventType(definition){
  if(!projectObject(definition)) throw projectDataError();
  const name=String(definition.name||"").trim();
  if(!name || name.length>60) throw projectDataError();
  const primitive=definition.primitive;
  if(!EVENT_TYPE_PRIMITIVES.has(primitive)) throw projectDataError();
  const sentenceTemplate=String(definition.sentenceTemplate||"").trim();
  if(!sentenceTemplate || sentenceTemplate.length>200) throw projectDataError();
  const visual={kind:"token", value:String(definition.visual&&definition.visual.value||"")};
  if([...visual.value].length>EVENT_TOKEN_MAX_LEN) throw projectDataError();
  const motion=EVENT_TYPE_MOTIONS.has(definition.motion)? definition.motion : DEFAULT_EVENT_MOTION;
  let availability;
  if(primitive==="SET_AVAILABILITY"){
    availability=definition.availability;
    if(!EVENT_TYPE_AVAILABILITY.has(availability)) throw projectDataError();
  }
  let presentation;
  if(definition.presentation!==undefined){
    presentation={ nodeEffects: normalizeNodeEffects(definition.presentation&&definition.presentation.nodeEffects) };
    if(projectObject(definition.presentation) && definition.presentation.connectionEffects!==undefined)
      presentation.connectionEffects=normalizeConnectionEffects(definition.presentation.connectionEffects);
  }
  let maxId=0;
  for(const et of doc.eventTypes) maxId=Math.max(maxId,et.id);
  const id=reserveProjectIds(doc,"nextEventTypeId",1,projectCounter(doc.nextEventTypeId,maxId));
  const et={id,name,primitive,sentenceTemplate,visual,motion};
  if(availability!==undefined) et.availability=availability;
  if(presentation!==undefined) et.presentation=presentation;
  validateEventType(et);
  doc.eventTypes.push(et);
  return et;
}

function updateEventType(id, changes){
  const et=eventTypeById(id);
  if(!et) throw projectDataError("event_type_not_found");
  const used=eventTypeIsUsed(id);
  if(changes.primitive!==undefined && changes.primitive!==et.primitive && used)
    throw projectDataError("event_type_primitive_immutable_when_used");
  if(changes.availability!==undefined && et.primitive==="SET_AVAILABILITY" && used)
    throw projectDataError("event_type_availability_immutable_when_used");
  if(changes.name!==undefined){
    const n=String(changes.name).trim();
    if(!n || n.length>60) throw projectDataError();
    et.name=n;
  }
  if(changes.sentenceTemplate!==undefined){
    const t=String(changes.sentenceTemplate).trim();
    if(!t || t.length>200) throw projectDataError();
    for(const m of t.matchAll(/\{([a-zA-Z0-9_]*)\}/g)){
      if(!EVENT_TEMPLATE_PLACEHOLDERS.has(m[1])) throw projectDataError();
    }
    et.sentenceTemplate=t;
  }
  if(changes.visual!==undefined){
    const v={kind:"token", value:String(changes.visual&&changes.visual.value||"")};
    if([...v.value].length>EVENT_TOKEN_MAX_LEN) throw projectDataError();
    et.visual=v;
  }
  if(changes.motion!==undefined){
    const m=String(changes.motion||"");
    if(!EVENT_TYPE_MOTIONS.has(m)) throw projectDataError();
    et.motion=m;
  }
  if(changes.presentation!==undefined){
    const np={ nodeEffects: normalizeNodeEffects(changes.presentation&&changes.presentation.nodeEffects) };
    if(projectObject(changes.presentation) && changes.presentation.connectionEffects!==undefined)
      np.connectionEffects=normalizeConnectionEffects(changes.presentation.connectionEffects);
    et.presentation=np;
  }
  if(changes.primitive!==undefined && !used){
    if(!EVENT_TYPE_PRIMITIVES.has(changes.primitive)) throw projectDataError();
    et.primitive=changes.primitive;
    if(et.primitive!=="SET_AVAILABILITY" && Object.prototype.hasOwnProperty.call(et,"availability")) delete et.availability;
  }
  if(changes.availability!==undefined && et.primitive==="SET_AVAILABILITY" && !used){
    if(!EVENT_TYPE_AVAILABILITY.has(changes.availability)) throw projectDataError();
    et.availability=changes.availability;
  }
  return et;
}

function deleteEventType(id){
  if(eventTypeIsUsed(id)) throw projectDataError("event_type_in_use");
  doc.eventTypes=doc.eventTypes.filter(et=>et.id!==id);
}

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
  nd.pages.forEach(pg=>pg.edges.forEach(e=>{
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
    if(e.dots!==undefined) e.dots=clamp(Math.round(projectNumber(e.dots,normalizedSettings.dots)),1,6);
  }));
  nd.pages.forEach(pg=>pg.nodes.forEach((n,i)=>{
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
  }));
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
