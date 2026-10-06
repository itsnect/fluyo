"use strict";
/* Arnés de FLUYO-018.7a: model.js + selection.js REALES en `vm` (sin DOM) con los stubs mínimos del editor. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

function makeEditor() {
  const clipboard = [];
  const ctx = {
    console, JSON, Math, Set, Map, Number, Object, Array, String, Error, Date, localStorage: {},
    navigator: { clipboard: { writeText: (t) => { clipboard.push(t); return Promise.resolve(); } } },
    document: { getElementById: () => ({}) },
  };
  vm.createContext(ctx);
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js"]) vm.runInContext(read(f), ctx, { filename: f });
  vm.runInContext(`var selN=new Set(), selE=new Set(), clip=null, __autosaves=0;
    function refreshPanel(){} function scheduleAutosave(){ __autosaves++; } function renderTabs(){}`, ctx);
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  const run = (code) => vm.runInContext(code, ctx);
  return { ctx, run, clipboard };
}

/* Página con 4 nodos, 4 conexiones (una con waypoints, una externa al conjunto {1,2,3}) y 2 Behaviors. */
const SETUP = `
  doc.pages=[blankPage("P")]; doc.cur=0; undoStack.length=0; redoStack.length=0; clip=null; selN.clear(); selE.clear();
  const pg=P();
  const nn=(id,x,y,label)=>pg.nodes.push({id,shape:"rect",x,y,w:100,h:60,label,color:"#6a9fb5",fill:null,border:"solid",lblPos:"center",textBg:null,textColor:null,font:null,bold:false,pulse:false,order:pg.nodes.length});
  nn(1,100,100,"A"); nn(2,300,100,"B"); nn(3,500,100,"C"); nn(4,700,100,"D");
  const ee=(id,from,to,extra)=>pg.edges.push(Object.assign({id,from,to,fromSide:null,toSide:null,route:"straight",waypoints:[],label:"",font:null,bold:false,animated:true,dashed:false,startArrow:false,endArrow:true,flowDir:"normal"},extra||{}));
  ee(5,1,2,{waypoints:[{x:200,y:60},{x:200,y:140}],label:"uno",lineColor:"#ff0000"}); ee(6,2,3); ee(7,3,4); ee(8,1,4);
  pg.behaviors=[{nodeId:2,initialState:"DOWN"},{nodeId:4,initialState:"DOWN"}];
  pg.nextId=9;
`;
const STATE = `JSON.stringify({
  nodes:P().nodes.map(n=>[n.id,n.x,n.y,n.order,n.label]),
  edges:P().edges.map(e=>[e.id,e.from,e.to,e.waypoints.map(w=>[w.x,w.y]),e.label,e.lineColor||null]),
  behaviors:P().behaviors.map(b=>[b.nodeId,b.initialState]),
  selN:[...selN], selE:[...selE], nextId:P().nextId, undo:undoStack.length, redo:redoStack.length,
  clip:clip&&{n:clip.nodes.map(n=>[n.id,n.x,n.y]),e:clip.edges.map(e=>[e.id,e.from,e.to]),b:clip.behaviors.map(b=>b.nodeId)}
})`;

module.exports = { makeEditor, SETUP, STATE, read };
