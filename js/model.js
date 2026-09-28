"use strict";
/* Modelo/documento compartido por editor y consumidores read-only.
   No accede al DOM, localStorage, autosave ni estado de interacción. */

/* ===================== Documento (páginas) ===================== */
function blankPage(name){ return {name, nodes:[], edges:[], nextId:1}; }
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
function serializeProject(){ return {version:3,app:"fluyo",doc,settings}; }

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
    if(input.version<1 || input.version>3) throw projectDataError("unsupported_version");
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
        pages:[Object.assign(blankPage("Página 1"),{nodes:d.state.nodes,edges:(d.state.edges||[]).map(e=>Object.assign({fromSide:null,toSide:null,route:"straight",waypoints:[]},e)),nextId:d.state.nextId||999})]};
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
    // Nodos y flechas comparten el contador. Nunca reutilizar un ID existente.
    let nextId=1;
    for(const id of ids) nextId=Math.max(nextId,id+1);
    if(!Number.isSafeInteger(nextId)) throw projectDataError();
    pg.nextId=Math.max(nextId,Number.isSafeInteger(pg.nextId)? pg.nextId : 1);
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
  return {doc:nd,settings:normalizedSettings};
}
/* Compatibilidad de la API usada por migración/añadir páginas y deep link. */
function documentFromProjectData(d){ return projectFromProjectData(d).doc; }
