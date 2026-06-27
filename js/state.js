"use strict";
/* Estado del documento, estado de UI, utilidades y fábricas de nodos/flechas */

/* ===================== Documento (páginas) ===================== */
function blankPage(name){ return {name, nodes:[], edges:[], nextId:1}; }
let doc={ theme:"dark", pages:[blankPage("Página 1")], cur:0 };
let settings={ speed:.5, dots:3, build:false, stagger:.45 };
const P=()=>doc.pages[doc.cur];

/* ===================== Estado de UI ===================== */
const cv=document.getElementById("cv"), ctx=cv.getContext("2d");
let mode="select", pendingShape=null, pendingIcon=null, connecting=null;
let selN=new Set(), selE=new Set();
let drag=null;                // {offs:{id:{dx,dy}}, wps:[{w,dx,dy}]}
let resizing=null;            // {id, fx, fy, aspect}
let wpDrag=null;              // {edgeId, idx}
let connectDrag=null;         // {fromId, fromSide}
let marquee=null;             // {x0,y0,x1,y1,add}
let hoverNode=null;
let clip=null;                // portapapeles interno
let pasteTimer=null;
let t0=performance.now(), playing=true, pausedAt=0;
const mouse={x:0,y:0};

/* ===================== Utilidades ===================== */
const $=id=>document.getElementById(id);
const nodeById=id=>P().nodes.find(n=>n.id===id);
const edgeById=id=>P().edges.find(e=>e.id===id);
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t,0,1); return t*t*(3-2*t);};
const snap=v=>Math.round(v/GRID)*GRID;
const deep=o=>JSON.parse(JSON.stringify(o));
function hexA(col,a){ const v=parseInt(col.slice(1),16);
  return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`; }

function newNode(shape,x,y,extra={}){
  const sizes={rect:[180,70], cylinder:[150,90], diamond:[160,100], circle:[110,110], hex:[170,80], text:[200,40], icon:[120,92], image:[220,160]};
  const [w,h]=sizes[shape]||[160,70];
  const n=Object.assign({ id:P().nextId++, shape, x:snap(x), y:snap(y), w, h,
    label: shape==="text"?"Texto":(shape==="icon"||shape==="image")?"":"Nodo",
    color:PALETTE[0].c, pulse:false, order:P().nodes.length }, extra);
  P().nodes.push(n); return n;
}
function newEdge(a,b,opts={}){
  if(a===b) return null;
  const e=Object.assign({ id:P().nextId++, from:a, to:b, fromSide:null, toSide:null,
    route:"straight", waypoints:[], label:"", animated:true, dashed:false, startArrow:false, endArrow:true, flowDir:"normal" }, opts);
  P().edges.push(e); return e;
}
