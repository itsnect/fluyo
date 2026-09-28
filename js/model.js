"use strict";
/* Modelo/documento compartido por editor y consumidores read-only.
   No accede al DOM, localStorage, autosave ni estado de interacción. */

/* ===================== Documento (páginas) ===================== */
function blankPage(name){ return {name, nodes:[], edges:[], nextId:1}; }
let doc={ theme:"dark", customBg:"", pages:[blankPage("Página 1")], cur:0 };
let settings={ speed:.5, dots:3, build:false, stagger:.45, grid:true, snap:false, font:DEFAULT_FONT, single:false };
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

function newNode(shape,x,y,extra={}){
  const [w,h]=DEFAULT_SIZES[shape]||[160,70];
  const n=Object.assign({ id:P().nextId++, shape, x:snapV(x), y:snapV(y), w, h,
    label: shape==="text"?"Texto":shape==="code"?CODE_DEFAULT_LABEL:(shape==="icon"||shape==="image"||shape==="anim")?"":"Nodo",
    color:PALETTE[0].c, fill:null, border:"solid", lblPos:"center", textBg:null, textColor:null,
    font:null, bold:false, pulse:false, order:P().nodes.length }, extra);
  /* Los campos de `code` solo se ponen en nodos `code`, igual que `icon` solo va
     en los de icono: no tiene sentido cargar todos los nodos con ellos. */
  if(shape==="code" && !("lang" in n)) Object.assign(n,{lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null});
  /* `tint` nace apagado también en los iconos nuevos: el interruptor tiene que
     significar lo mismo en un diagrama de hoy y en uno de hace un mes. */
  if(shape==="icon" && !("tint" in n)) n.tint=false;
  P().nodes.push(n); return n;
}
function newEdge(a,b,opts={}){
  if(a===b) return null;
  const e=Object.assign({ id:P().nextId++, from:a, to:b, fromSide:null, toSide:null,
    route:"straight", waypoints:[], label:"", font:null, bold:false, animated:true, dashed:false, startArrow:false, endArrow:true, flowDir:"normal" }, opts);
  P().edges.push(e); return e;
}

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

/* Migra y normaliza un `.fluyo.json` sin instalarlo en un editor. */
function documentFromProjectData(d){
  let nd;
  if(d && d.doc && Array.isArray(d.doc.pages) && d.doc.pages.length) nd=d.doc;
  else if(d && d.state && Array.isArray(d.state.nodes)){
    nd={theme:d.state.theme||"dark", cur:0,
        pages:[Object.assign(blankPage("Página 1"),{nodes:d.state.nodes,edges:(d.state.edges||[]).map(e=>Object.assign({fromSide:null,toSide:null,route:"straight",waypoints:[]},e)),nextId:d.state.nextId||999})]};
  } else throw new Error("invalid");
  nd.pages.forEach(pg=>{
    if(!pg || !Array.isArray(pg.nodes) || !Array.isArray(pg.edges)) throw new Error("invalid");
  });
  nd.pages.forEach(pg=>pg.edges.forEach(e=>{
    if(e.endArrow===undefined){ e.endArrow=true; e.startArrow=!!e.bidir; }
    if(!e.flowDir) e.flowDir="normal";
    if(!e.waypoints) e.waypoints=[];
    if(!e.route) e.route="straight";
    if(e.font===undefined) e.font=null;
    if(e.bold===undefined) e.bold=false;
  }));
  nd.pages.forEach(pg=>pg.nodes.forEach(n=>{
    if(n.fill===undefined) n.fill=null;
    if(!n.border) n.border="solid";
    if(!n.lblPos) n.lblPos="center";
    if(n.textBg===undefined) n.textBg=null;
    if(n.textColor===undefined) n.textColor=null;
    if(n.font===undefined) n.font=null;
    if(n.bold===undefined) n.bold=false;
  }));
  if(nd.customBg===undefined) nd.customBg="";
  return nd;
}
