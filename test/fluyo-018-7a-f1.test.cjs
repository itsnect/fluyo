"use strict";
/* FLUYO-018.7a · F1 — regresión PERMANENTE: borrar una página no puede hacer que Undo/Redo escriban el contenido de una página en otra.
   Usa el selection.js real y el renderTabs() real (extraído de ui.js, que no tiene arnés propio); la ✕ de la pestaña es la única puerta
   de borrado de página.
   · 018.7a (hotfix): la ✕ vaciaba Undo/Redo (las entradas identificaban la página por ÍNDICE).
   · 018.7c (este archivo, adaptado): las entradas identifican la página por REFERENCIA y el borrado es una entrada más: Undo reinserta la
     MISMA página en su sitio, Redo la vuelve a quitar, y las entradas anteriores siguen siendo válidas. Las pruebas 2–4 del hotfix (que
     codificaban «vaciar») se sustituyen por su equivalente correcto; la 1, la 5 y la 6 se conservan y se refuerzan. */
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
const cur = (e) => e.run("doc.pages[doc.cur].name");

test("F1: Undo tras borrar una página anterior NO escribe el contenido de una página en otra; restaura la página correcta", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b-EDIT";`);   // snapshot de B y edición posterior
  e.clickClose(0);                                                        // borrar A: B pasa al índice 0, C al 1
  assert.deepEqual(labels(e), ["B:b-EDIT", "C:c0"]);
  assert.equal(cur(e), "B", "la página activa sigue siendo B (no salta a C)");
  e.run("undo()");                                                        // deshace el borrado: A vuelve a su sitio
  assert.deepEqual(labels(e), ["A:a0", "B:b-EDIT", "C:c0"], "C conserva su contenido (con el defecto F1 recibía el de B: C:b0)");
  assert.equal(cur(e), "B", "Undo vuelve a la página que estaba activa al borrar");
  e.run("undo()");                                                        // deshace la edición de B, en B
  assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c0"]);
  e.run("redo()"); e.run("redo()");                                       // Redo es reversible: vuelve a editar B y a borrar A
  assert.deepEqual(labels(e), ["B:b-EDIT", "C:c0"]);
  assert.equal(cur(e), "B");
});

test("F1: borrar una página ya NO vacía las pilas: conserva el historial y añade UNA entrada (deshacer el borrado)", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b1"; pushUndo(); doc.pages[1].nodes[0].label="b2"; undo();`); // undo 1, redo 1
  assert.deepEqual([e.run("undoStack.length"), e.run("redoStack.length")], [1, 1], "precondición: ambas pilas con entradas");
  e.clickClose(2);
  assert.equal(e.run("undoStack.length"), 2, "el historial previo se conserva y el borrado es una entrada más");
  assert.equal(e.run("redoStack.length"), 0, "una acción nueva vacía Redo (como cualquier edición)");
  e.run("undo(); undo();");
  assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c0"], "deshacer el borrado y la edición anterior, cada uno en su página");
});

test("F1: Redo tras borrar no restaura nada por índice; Undo/Redo del propio borrado son exactos", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b-EDIT"; undo();`);   // Redo guarda la edición de B
  e.clickClose(0);                                                                  // B → índice 0 (Redo se vacía: acción nueva)
  const after = labels(e);
  e.run("redo()");
  assert.deepEqual(labels(e), after, "Redo no cambia ninguna página tras el borrado");
  e.run("undo()");
  assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c0"]);
  e.run("redo()");
  assert.deepEqual(labels(e), after);
});

test("F1: tras borrar la página activa, Undo la reinserta en su sitio con su contenido y Redo la vuelve a quitar", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=2; pushUndo(); doc.pages[2].nodes[0].label="c-EDIT"; doc.cur=1;`);
  e.clickClose(1);                                                                  // borrar B (la activa)
  assert.equal(e.run("doc.pages.length"), 2);
  assert.deepEqual(labels(e), ["A:a0", "C:c-EDIT"]);
  assert.equal(cur(e), "C", "al borrar la activa pasa a la que ocupa su posición");
  assert.equal(e.run("selN.size+selE.size"), 0, "selección limpia");
  e.run("undo()");
  assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c-EDIT"], "B vuelve a su índice con su contenido");
  assert.equal(cur(e), "B", "y vuelve a ser la activa");
  e.run("undo()");
  assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c0"], "la entrada anterior a la eliminación sigue siendo de C");
  assert.equal(cur(e), "C");
  e.run("redo(); redo()");
  assert.deepEqual(labels(e), ["A:a0", "C:c-EDIT"]);
  assert.equal(cur(e), "C");
});

test("F1: una edición POSTERIOR al borrado es deshacible y no rompe el Undo del borrado", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.clickClose(0);                                                                  // pages: B, C
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="c-EDIT";`);
  e.run("undo()");
  assert.deepEqual(labels(e), ["B:b0", "C:c0"]);
  e.run("undo()");
  assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c0"]);
});

test("F1: cancelar el confirm no borra ni toca las pilas ni la página activa", () => {
  const e = makeEditor();
  e.run(SETUP);
  e.run(`doc.cur=1; pushUndo(); doc.pages[1].nodes[0].label="b1"; pushUndo(); undo(); confirm=()=>false;`);
  const stacks = [e.run("undoStack.length"), e.run("redoStack.length")];
  e.clickClose(0);
  assert.equal(e.run("doc.pages.length"), 3);
  assert.deepEqual([e.run("undoStack.length"), e.run("redoStack.length")], stacks, "las pilas no se tocan si se cancela");
  assert.equal(cur(e), "B");
});

test("F1: matriz A·B·C — cada página borrada × cada página con snapshot × cada página activa: nada se corrompe y todo es reversible", () => {
  for (let del = 0; del < 3; del++) for (let snap = 0; snap < 3; snap++) for (let active = 0; active < 3; active++) {
    const tag = `borrar ${"ABC"[del]}, snapshot ${"ABC"[snap]}, activa ${"ABC"[active]}`;
    const e = makeEditor();
    e.run(SETUP);
    e.run(`doc.cur=${snap}; pushUndo(); doc.pages[${snap}].nodes[0].label="edit"; doc.cur=${active};`);
    const edited = labels(e);
    e.clickClose(del);
    const expected = edited.filter((_, i) => i !== del);
    assert.deepEqual(labels(e), expected, tag);
    const want = active === del ? Math.min(del, 1) : active < del ? active : active - 1;
    assert.equal(cur(e), expected[want].split(":")[0], `${tag}: regla de cur`);
    e.run("undo()");
    assert.deepEqual(labels(e), edited, `${tag}: Undo reinserta la página correcta`);
    assert.equal(cur(e), "ABC"[active], `${tag}: Undo devuelve la página activa`);
    e.run("undo()");
    assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c0"], `${tag}: el snapshot vuelve a SU página`);
    e.run("redo(); redo()");
    assert.deepEqual(labels(e), expected, `${tag}: Redo`);
    e.run("undo(); undo(); undo()");                                               // una de más: no hace nada
    assert.deepEqual(labels(e), ["A:a0", "B:b0", "C:c0"], `${tag}: Undo completo`);
  }
});
