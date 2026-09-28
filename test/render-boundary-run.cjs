"use strict";
/* FLUYO-004 — Ejecución del core read-only con un mock estricto de Canvas.
   No carga ni simula DOM, editor, autosave, localStorage, RAF o UI. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function read(p){ return fs.readFileSync(path.join(__dirname, "..", p), "utf8"); }

function makeCtxMock(){
  const state = {
    font: "10px sans-serif",
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1,
    lineCap: "butt", lineJoin: "miter", textAlign: "start", textBaseline: "alphabetic",
    globalAlpha: 1, shadowColor: "#000", shadowBlur: 0
  };
  const noop = () => {};
  const handlers = {
    save: noop, restore: noop,
    translate: noop, scale: noop, rotate: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, arcTo: noop,
    closePath: noop, bezierCurveTo: noop, ellipse: noop, rect: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fill: noop, stroke: noop, clip: noop,
    fillText: noop, setLineDash: noop,
    drawImage: noop,
    measureText: (t) => ({width: (t||"").length * 8})
  };
  return new Proxy({}, {
    get(_target, prop){
      if(prop in handlers) return handlers[prop];
      if(prop in state) return state[prop];
      return undefined;
    },
    set(_target, prop, value){
      if(prop in state){ state[prop]=value; return true; }
      return true;
    }
  });
}

const ctxMock = makeCtxMock();
const context = vm.createContext({
  console,
  ctx:ctxMock,
  assert: (cond, msg) => { if(!cond) throw new Error(msg); }
});

const viewerScripts = [
  "js/config.js",
  "js/model.js",
  "js/geometry.js",
  "js/render.js"
];

const src = viewerScripts.map(read).join("\n;\n");
vm.runInContext(src, context);

function assert(cond, msg){ if(!cond) throw new Error(msg); }

try {
  // Normalizar e instalar un documento mínimo sin runtime de editor.
  vm.runInContext(`
    assert(typeof document === "undefined", "el core requiere DOM");
    assert(typeof localStorage === "undefined", "el core requiere localStorage");
    assert(typeof requestAnimationFrame === "undefined", "el core requiere RAF");

    const fixture={version:3,app:"fluyo",doc:{theme:"dark",customBg:"",cur:0,pages:[{
      name:"Run test",nextId:4,
      nodes:[
        {id:1,shape:"rect",x:200,y:200,w:160,h:70,label:"A",color:"#3aa7e8"},
        {id:2,shape:"rect",x:500,y:200,w:160,h:70,label:"B",color:"#7bb85b"}
      ],
      edges:[{id:3,from:1,to:2,label:"link",animated:true}]
    }]},settings:{speed:.5,dots:3,build:false,stagger:.45,grid:false,snap:false,font:DEFAULT_FONT,single:false}};
    doc=documentFromProjectData(fixture);
    settings=Object.assign(settings,fixture.settings);

    const rsViewer = makeReadOnlyRenderState({x:0, y:0, zoom:1, width:800, height:600, presenting:false});
    rsViewer.selection.nodes.add=()=>{ throw new Error("renderer mutó nodes"); };
    rsViewer.selection.edges.add=()=>{ throw new Error("renderer mutó edges"); };
    render(ctx, 0, {renderState: rsViewer});

    assert(rsViewer.selection.nodes.size === 0, "read-only nodes no vacío");
    assert(rsViewer.selection.edges.size === 0, "read-only edges no vacío");
    assert(rsViewer.selection.single === null, "read-only single no nulo");
    assert(rsViewer.selection.arrowHost === null, "read-only arrowHost no nulo");
    assert(rsViewer.interaction.editing === null, "read-only editing no nulo");

    let missingFailed=false;
    try{ render(ctx,0.2); }catch(e){ missingFailed=/renderState/.test(e.message); }
    assert(missingFailed,"render() aceptó una llamada sin renderState");
  `, context);

  console.log("PASS: core read-only ejecutable sin runtime, DOM, persistencia ni UI del editor.");
} catch(e) {
  console.error("FAIL: render-boundary-run.cjs —", e.message);
  process.exit(1);
}
