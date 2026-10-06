"use strict";
/* FLUYO-018.7a · F1 — regresión: borrar una página no puede dejar entradas de Undo/Redo que apunten por ÍNDICE.
   Usa el selection.js real y el renderTabs() real (extraído de ui.js, que no tiene arnés propio); la ✕ de la pestaña
   es la única puerta de borrado de página. Hasta el hotfix, este archivo FALLA (reproduce el defecto). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

function renderTabsSource() {
  const ui = read("js/ui.js");
  const a = ui.indexOf("function renderTabs(){");
  const b = ui.indexOf("/* ===================== Modo presentación");
  assert.ok(a >= 0 && b > a, "renderTabs() debe seguir existiendo en ui.js");
  return ui.slice(a, b);
}

function makeEditor() {
  const el = () => ({ children: [], style: {}, appendChild(c) { this.children.push(c); return c; }, set innerHTML(v) { this.children = []; }, get innerHTML() { return ""; } });
  const bar = el();
  const ctx = {
    console, JSON, Math, Set, Map, Number, Object, Array, String, Error, Date, navigator: {}, localStorage: {},
    document: { getElementById: () => ({}), createElement: el },
    confirm: () => true, alert() {}, prompt: () => null,
  };
  vm.createContext(ctx);
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js"]) vm.runInContext(read(f), ctx, { filename: f });
  vm.runInContext(`var selN=new Set(), selE=new Set(), clip=null;
    function refreshPanel(){} function scheduleAutosave(){} const $=()=>__bar;`, Object.assign(ctx, { __bar: bar }));
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  vm.runInContext(renderTabsSource(), ctx, { filename: "js/ui.js#renderTabs" });
  const run = (code) => vm.runInContext(code, ctx);
  // la ✕ de la pestaña i (la misma función que el usuario pulsa)
  const clickClose = (i) => {
    run("renderTabs()");
    const tab = bar.children[i];
    const x = tab.children.find((c) => c.className === "x");
    assert.ok(x && typeof x.onclick === "function", "la pestaña " + i + " tiene ✕");
    x.onclick({ stopPropagation() {} });
  };
  return { run, clickClose };
}

const SETUP = `
  const mk=(name,label)=>{ const p=blankPage(name); p.nodes.push({id:1,shape:"rect",x:0,y:0,w:100,h:60,label,color:"#fff",order:0}); p.nextId=2; return p; };
  doc.pages=[mk("A","a0"),mk("B","b0"),mk("C","c0")]; doc.cur=0; undoStack.length=0; redoStack.length=0;
`;
const labels = (e) => JSON.parse(e.run(`JSON.stringify(doc.pages.map(p=>p.name+":"+p.nodes[0].label))`));

test("F1: Undo tras borrar una página anterior NO escribe el contenido de una página en otra", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b-EDIT";`);   // snapshot de B (pi=1) y edición posterior
  e.clickClose(0);                                                        // borrar A: B pasa al índice 0, C al 1
  assert.deepEqual(labels(e), ["B:b-EDIT", "C:c0"]);
  e.run("undo()");
  assert.deepEqual(labels(e), ["B:b-EDIT", "C:c0"], "C conserva su contenido (hoy recibe el de B: C:b0)");
});

test("F1: borrar una página vacía las pilas de Undo y Redo", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b-EDIT"; undo(); doc.pages[1].nodes[0].label="b2"; pushUndo();`); // deja undo y redo con contenido
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b3"; undo();`);                                                     // redoStack no vacía
  assert.ok(e.run("undoStack.length") > 0 && e.run("redoStack.length") > 0, "precondición: ambas pilas con entradas");
  e.clickClose(2);
  assert.equal(e.run("undoStack.length"), 0, "undoStack vacía");
  assert.equal(e.run("redoStack.length"), 0, "redoStack vacía");
});

test("F1: Redo tras borrar tampoco restaura por índice", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b-EDIT"; undo();`);   // redo guarda B editada (pi=1)
  e.clickClose(0);                                                                  // B → índice 0
  const before = labels(e);
  e.run("redo()");
  assert.deepEqual(labels(e), before, "redo no cambia ninguna página tras el borrado");
});

test("F1: tras borrar, Undo/Redo no hacen nada y el estado es el esperado", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=2; pushUndo(); doc.pages[2].nodes[0].label="c-EDIT";`);
  e.clickClose(1);                                                                  // borrar B
  assert.equal(e.run("doc.pages.length"), 2);
  assert.deepEqual(labels(e), ["A:a0", "C:c-EDIT"]);
  e.run("undo()"); assert.deepEqual(labels(e), ["A:a0", "C:c-EDIT"], "Undo no revierte nada tras el borrado"); e.run("redo()");
  assert.deepEqual(labels(e), ["A:a0", "C:c-EDIT"]);
  assert.equal(e.run("selN.size+selE.size"), 0, "selección limpia");
});

test("F1: una edición POSTERIOR al borrado vuelve a ser deshacible (la pila no queda inutilizada)", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.clickClose(0);                                                                  // pages: B, C; pilas vacías
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="c-EDIT";`);
  e.run("undo()");
  assert.deepEqual(labels(e), ["B:b0", "C:c0"]);
});

test("F1: cancelar el confirm no borra ni toca las pilas", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); confirm=()=>false;`);
  e.clickClose(0);
  assert.equal(e.run("doc.pages.length"), 3);
  assert.equal(e.run("undoStack.length"), 1, "la pila no se toca si se cancela");
});
