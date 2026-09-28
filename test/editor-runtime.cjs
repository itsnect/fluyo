"use strict";
/* Regresión FLUYO-004: el runtime del editor posee RAF/reloj/resize y siempre
   entrega canvas + contenedor explícitos, también en los resizes diferidos de
   entrada/salida de presentación. */

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const source=fs.readFileSync(path.join(__dirname,"..","js","editor-runtime.js"),"utf8");
const frames=[];
const resizeCalls=[];
const renderCalls=[];
const canvas={width:800,height:600};
const container={name:"wrap"};
let syncCalls=0;

const context=vm.createContext({
  performance:{now:()=>1000},
  requestAnimationFrame:fn=>{ frames.push(fn); return frames.length; },
  resizeCanvas:(a,b)=>resizeCalls.push([a,b]),
  render:(...args)=>renderCalls.push(args),
  syncEditBoxIfMoved:()=>{ syncCalls++; },
  singleSel:()=>null,
  arrowHostNode:()=>null,
  cv:canvas,
  ctx:{},
  $:id=>{ if(id!=="wrap") throw new Error("control DOM inesperado: "+id); return container; },
  viewX:10,viewY:20,viewZoom:.8,presenting:false,
  selN:new Set(),selE:new Set(),
  mode:"select",pendingShape:null,pendingIcon:null,pendingAnim:null,
  connecting:null,drag:null,resizing:null,wpDrag:null,connectDrag:null,endDrag:null,
  marquee:null,hoverNode:null,editing:null,mouse:{x:0,y:0},
  afterCount:0
});

function assert(cond,msg){ if(!cond) throw new Error(msg); }

vm.runInContext(source,context,{filename:"editor-runtime.js"});

assert(resizeCalls.length===1,"el primer frame no redimensionó exactamente una vez");
assert(resizeCalls[0][0]===canvas && resizeCalls[0][1]===container,"resize inicial no recibió canvas + container");
assert(renderCalls.length===1 && renderCalls[0][2].renderState,"el frame no pasó renderState explícito");
assert(syncCalls===1,"el post-render del editor no se ejecutó");

vm.runInContext("scheduleEditorResize(()=>afterCount++)",context);
frames.pop()(12345.6);
assert(resizeCalls.length===2,"resize diferido de entrada no se ejecutó");
assert(resizeCalls[1][0]===canvas && resizeCalls[1][1]===container,"timestamp RAF usado como canvas al entrar");
assert(context.afterCount===1,"callback posterior al resize no se ejecutó");

vm.runInContext("scheduleEditorResize()",context);
frames.pop()(23456.7);
assert(resizeCalls.length===3,"resize diferido de salida no se ejecutó");
assert(resizeCalls[2][0]===canvas && resizeCalls[2][1]===container,"timestamp RAF usado como canvas al salir");

console.log("PASS: editor-runtime.cjs — RAF, renderState y resize de presentación explícitos.");
