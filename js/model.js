"use strict";
/* Modelo/documento compartido por editor y consumidores read-only.
   No accede al DOM, localStorage, autosave ni estado de interacción. */

/* ===================== Documento (páginas) ===================== */
function blankPage(name){ return {name, nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}; }
let doc={ theme:"dark", customBg:"", pages:[blankPage("Página 1")], cur:0 };
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
function serializeProject(){ return {version:4,app:"fluyo",doc,settings}; }

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
/* Scenarios v1 */
const SCENARIO_ENGINE_VERSION=1;
const SCENARIO_STATES=new Set(["UP","DOWN"]);
const SCENARIO_ACTIONS=new Set(["SET_STATE","SEND"]);

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

function validatePersistedStep(step){
  if(!projectObject(step) || !Number.isSafeInteger(step.id) || step.id<1) throw projectDataError();
  if(!Number.isSafeInteger(step.at) || step.at<0) throw projectDataError();
  if(!SCENARIO_ACTIONS.has(step.action)) throw projectDataError();
  const allowed=step.action==="SET_STATE"?["id","at","action","nodeId","state"]:["id","at","action","edgeId"];
  const keys=Object.keys(step);
  if(keys.length!==allowed.length || !allowed.every(k=>projectOwn(step,k))) throw projectDataError();
  if(step.action==="SET_STATE"){
    if(!Number.isSafeInteger(step.nodeId) || step.nodeId<1 || !SCENARIO_STATES.has(step.state)) throw projectDataError();
  }else if(!Number.isSafeInteger(step.edgeId) || step.edgeId<1) throw projectDataError();
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
      validatePersistedStep(step);
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
  if(sc.engineVersion!==SCENARIO_ENGINE_VERSION) throw projectDataError("unsupported_engine_version");
  if(!projectObject(definition) || projectOwn(definition,"id")) throw projectDataError();
  let maxId=0; for(const step of sc.steps) maxId=Math.max(maxId,step.id);
  const next=projectCounter(sc.nextStepId,maxId);
  const step={id:next,...definition}; validatePersistedStep(step);
  reserveProjectIds(sc,"nextStepId",1,next);
  sc.steps.push(step); return step;
}
function deleteStep(sc,id){
  if(sc.engineVersion!==SCENARIO_ENGINE_VERSION) throw projectDataError("unsupported_engine_version");
  sc.steps=sc.steps.filter(step=>step.id!==id);
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
    if(input.version<1 || input.version>4) throw projectDataError("unsupported_version");
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
  nd.pages.forEach(pg=>{ normalizeBehaviors(pg); normalizeScenarios(pg); pg.nextId=structuralNextId(pg); });
  return {doc:nd,settings:normalizedSettings};
}
/* Compatibilidad de la API usada por migración/añadir páginas y deep link. */
function documentFromProjectData(d){ return projectFromProjectData(d).doc; }
