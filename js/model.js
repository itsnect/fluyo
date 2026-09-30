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
/* Presets de presentación del mensaje: la UI habla en presets, nunca en px. */
const NODE_MESSAGE_SIZE_PX={small:11, medium:14, large:18};
const NODE_MESSAGE_WEIGHT_CSS={normal:"400", semibold:"600", bold:"700"};
const NODE_MESSAGE_FONT_STACK={
  default:"Georgia, serif",
  sans:"'Segoe UI', system-ui, Arial, Helvetica, sans-serif",
  mono:'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
};
function defaultNodeEffects(){
  return { showSymbol:false, message:"", messageColor:"", messageSize:"medium", messageWeight:"normal", messageFont:"default", messagePosition:"above", highlight:false, blink:false, dim:false, fillColor:"" };
}
function normalizeNodeEffects(effects){
  const out=defaultNodeEffects();
  if(effects==null) return out;
  /* showIcon es el nombre previo (FLUYO-011 sin publicar): mismo booleano. */
  if(typeof effects.showSymbol==="boolean") out.showSymbol=effects.showSymbol;
  else if(typeof effects.showIcon==="boolean") out.showSymbol=effects.showIcon;
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
  return out;
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
    et.presentation={ nodeEffects: normalizeNodeEffects(changes.presentation&&changes.presentation.nodeEffects) };
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
}
