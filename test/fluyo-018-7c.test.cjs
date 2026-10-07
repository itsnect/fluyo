"use strict";
/* FLUYO-018.7c — editor: la ✕ de página (confirmación con impacto, Cancelar/Aceptar, Playback, regla de cur) y el Undo/Redo
   estructural por referencia de página (insertPage/removePage), con secuencias aleatorias contra un modelo de referencia.
   Editor real: model.js, state.js (sin DOM), selection.js y renderTabs() de ui.js en `vm` (arnés 018.7c). */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { kernel, editor, read, J, page, project } = require("./fluyo-018-7c-harness.cjs");

const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };

/* A (1 nodo) · B (2 nodos + conexión + Behavior + 2 Historias, «Compra» con 2 momentos) · C (vacía); activa: B. */
function doc3() {
  const ops = [
    { op: "rename_page", scope: "document", pageIndex: 0, name: "A" }, { op: "create_page", scope: "document", name: "B" }, { op: "create_page", scope: "document", name: "C" },
    { op: "create_node", scope: "page", pageIndex: 0, spec: { shape: "rect", x: 0, y: 0, label: "a" } },
    { op: "create_node", scope: "page", pageIndex: 1, spec: { shape: "rect", x: 0, y: 0, label: "b1" }, ref: "b1" },
    { op: "create_node", scope: "page", pageIndex: 1, spec: { shape: "rect", x: 300, y: 0, label: "b2" }, ref: "b2" },
    { op: "create_connection", scope: "page", pageIndex: 1, source: { ref: "b1" }, target: { ref: "b2" }, ref: "e", spec: { waypoints: [{ x: 150, y: -50 }] } },
    { op: "set_initial_availability", scope: "page", pageIndex: 1, nodeId: { ref: "b2" }, state: "DOWN" },
    { op: "create_event_type", scope: "eventType", name: "Envío", primitive: "FLOW", sentence: "{source} → {target}", ref: "et" },
    { op: "create_story", scope: "story", pageIndex: 1, name: "Compra", ref: "s" },
    { op: "add_step", scope: "story", pageIndex: 1, storyId: { ref: "s" }, eventTypeId: { ref: "et" }, target: { edgeId: { ref: "e" } } },
    { op: "add_step", scope: "story", pageIndex: 1, storyId: { ref: "s" }, eventTypeId: { ref: "et" }, target: { edgeId: { ref: "e" } } },
    { op: "create_story", scope: "story", pageIndex: 1, name: "Devolución" },
  ];
  const p = J(ok(apply(project([page("Página 1")]), ops)).project); p.doc.cur = 1; return p;
}
const D3 = doc3();
const names = (E) => J(E.run("doc.pages.map(p=>p.name)"));
const active = (E) => E.run("doc.pages[doc.cur].name");

/* ───────── confirmación ───────── */
test("confirmación: página vacía → el mensaje corto de siempre; con contenido → elementos, conexiones, condiciones e Historias con sus momentos", () => {
  const E = editor(); E.load(D3);
  E.run("__confirmAnswer=false"); E.close(2);
  assert.deepEqual(J(E.run("__confirms")), ["¿Eliminar «C»?"]);
  E.close(1);
  assert.equal(E.run("__confirms[1]"), [
    "La página «B» tiene 2 elementos, 1 conexión, 1 condición de disponibilidad inicial y 2 Historias:", "",
    "• Compra — 2 momentos", "• Devolución — sin momentos", "",
    "Si la eliminas se pierde todo su contenido (puedes deshacerlo con Ctrl+Z). Los eventos de la biblioteca se conservan.", "¿Eliminar la página?"].join("\n"));
  E.close(0);
  assert.equal(E.run("__confirms[2]").split("\n")[0], "La página «A» tiene 1 elemento.");
  // muchas Historias: se listan 8 y se resume el resto
  const many = J(D3); for (let i = 0; i < 10; i++) many.doc.pages[2].scenarios.push({ id: 10 + i, name: "H" + i, engineVersion: 2, nextStepId: 1, steps: [] });
  const E2 = editor(); E2.load(many); E2.run("__confirmAnswer=false"); E2.close(2);
  const m = E2.run("__confirms[0]");
  assert.match(m, /tiene 10 Historias:/); assert.match(m, /• H7 — sin momentos\n• …y 2 Historias más/); assert.equal(/H8/.test(m), false);
});

test("Cancelar: no cambia el documento, la página activa, las pilas ni el Playback", () => {
  const E = editor(); E.load(D3);
  E.run("doc.cur=1; pushUndo(); P().nodes[0].label='x'; pushUndo(); undo(); __confirmAnswer=false; __playing=true;");
  const before = J(E.run("doc")), stacks = [E.run("undoStack.length"), E.run("redoStack.length")];
  for (const i of [0, 1, 2]) E.close(i);
  assert.deepEqual(J(E.run("doc")), before);
  assert.deepEqual([E.run("undoStack.length"), E.run("redoStack.length")], stacks);
  assert.equal(E.run("__resets"), 0, "el Playback sigue"); assert.equal(E.run("__playing"), true);
  assert.equal(E.run("__confirms.length"), 3, "un diálogo por clic");
});

test("Aceptar: una sola entrada de Undo, Redo vacío, selección limpia, cur por la regla del dominio, EventTypes intactos", () => {
  const E = editor(); E.load(D3);
  E.run("selN=new Set([1]); pushUndo(); undo();");                      // deja algo en Redo
  const ets = J(E.run("doc.eventTypes")), undoBefore = E.run("undoStack.length");
  E.close(0);
  assert.deepEqual(names(E), ["B", "C"]);
  assert.equal(active(E), "B", "borrar una anterior a la activa no cambia de página (F2 corregido)");
  assert.equal(E.run("undoStack.length"), undoBefore + 1);
  assert.equal(E.run("redoStack.length"), 0);
  assert.equal(E.run("selN.size+selE.size"), 0);
  assert.deepEqual(J(E.run("doc.eventTypes")), ets);
  assert.equal(E.run("undoStack[undoStack.length-1].kind"), "insertPage");
  E.close(0);                                                            // borrar la activa (B): pasa a la que ocupa su sitio
  assert.deepEqual([names(E), active(E)], [["C"], "C"]);
  assert.deepEqual(E.tabs(), [{ active: true, close: false }], "con una sola página no hay ✕");
  assert.equal(E.run("requestDeletePage(0)"), false, "y la función tampoco borra la única página");
  assert.equal(E.run("doc.pages.length"), 1);
});

test("Playback: aceptar detiene el Playback (decisión 64) antes de borrar; sin Playback no se llama a scReset", () => {
  let E = editor(); E.load(D3);
  E.run("__playing=true"); E.close(2);
  assert.deepEqual([E.run("__resets"), E.run("__playing"), names(E).length], [1, false, 2]);
  E = editor(); E.load(D3); E.close(2);
  assert.equal(E.run("__resets"), 0);
});

test("ui.js: la ✕ pasa por requestDeletePage; ni splice ni vaciado de pilas en ui.js; selection.js usa la autoridad del dominio", () => {
  const ui = read("js/ui.js"), sel = read("js/selection.js");
  assert.match(ui, /x\.onclick=ev=>\{ ev\.stopPropagation\(\); requestDeletePage\(i\); \};/);
  assert.equal(/pages\.splice/.test(ui), false); assert.equal(/undoStack\.length=0|redoStack\.length=0/.test(ui), false);
  assert.equal(/pages\.splice/.test(sel), false, "selection.js no borra páginas a mano");
  assert.match(sel, /deletePageIn\(doc, index\)/); assert.match(sel, /restorePageIn\(doc, s\.index, s\.page\)/); assert.match(sel, /pageRemovalImpactIn\(doc, index\)/);
  assert.equal(/\bpi:/.test(sel), false, "ninguna entrada de Undo guarda el índice de página");
});

/* ───────── Undo/Redo estructural ───────── */
test("Undo/Redo del borrado: restaura nombre, posición, nodos, conexiones, waypoints, Behaviors, Historias, Steps y contadores (el MISMO objeto)", () => {
  for (const i of [0, 1, 2]) for (const cur of [0, 1, 2]) {
    const E = editor(); E.load(D3); E.run(`doc.cur=${cur}`);
    const before = J(E.run("doc")); E.run("__objs=doc.pages.slice()");
    E.close(i);
    E.run("undo()");
    assert.deepEqual(J(E.run("doc")), before, `borrar ${i} con activa ${cur}: Undo exacto (incl. cur)`);
    assert.equal(E.run("doc.pages.every((p,k)=>p===__objs[k])"), true, "identidad de las páginas");
    E.run("redo()");
    const after = J(E.run("doc"));
    E.run("undo(); redo();");
    assert.deepEqual(J(E.run("doc")), after, "Undo/Redo repetidos son estables");
  }
});

test("borrar → Undo → otra edición → Undo: la edición se deshace en su página y el borrado ya no se rehace (Redo vaciado)", () => {
  const E = editor(); E.load(D3);
  E.close(0); E.run("undo()");
  assert.equal(E.run("redoStack.length"), 1);
  E.run("doc.cur=2; pushUndo(); P().nodes.push({id:9,shape:'rect',x:0,y:0,w:10,h:10});");
  assert.equal(E.run("redoStack.length"), 0);
  E.run("undo()");
  assert.deepEqual(J(E.run("doc.pages[2].nodes")), [], "deshace en C");
  assert.deepEqual(names(E), ["A", "B", "C"]);
  E.run("undo()");                                                       // ahora deshace lo anterior al borrado (nada: pila vacía)
  assert.deepEqual(names(E), ["A", "B", "C"]);
});

test("borrar y luego crear otra página: Undo reinserta la borrada en su sitio y la nueva queda al final", () => {
  const E = editor(); E.load(D3);
  E.close(1); E.run("addPage(); renderTabs();");
  assert.deepEqual(names(E), ["A", "C", "Página 3"]);
  assert.equal(active(E), "Página 3");
  E.run("undo()");
  assert.deepEqual(names(E), ["A", "B", "C", "Página 3"]);
  assert.equal(active(E), "B");
  E.run("redo()");
  assert.deepEqual(names(E), ["A", "C", "Página 3"]);
  // borrar la última y crear otra: la borrada vuelve a SU índice, delante de la nueva
  const F = editor(); F.load(D3); F.close(2); F.run("addPage(); renderTabs(); undo();");
  assert.deepEqual(names(F), ["A", "B", "C", "Página 3"]);
});

test("Undo de una edición tras navegar: la inversa es la de la MISMA página (antes: la de la página activa) y Redo rehace en ella", () => {
  const E = editor(); E.load(D3);
  E.run("doc.cur=0; pushUndo(); P().nodes[0].label='a-EDIT'; doc.cur=2;");
  E.run("undo()");
  assert.deepEqual([active(E), E.run("doc.pages[0].nodes[0].label")], ["A", "a"]);
  E.run("doc.cur=2; redo()");
  assert.deepEqual([active(E), E.run("doc.pages[0].nodes[0].label")], ["A", "a-EDIT"], "Redo rehace la edición de A (no una foto de C)");
});

test("entradas que ya no aplican se descartan sin tocar nada; applyProjectData vacía las pilas; el tope de 60 se mantiene", () => {
  const E = editor(); E.load(D3);
  E.run("undoStack.push({kind:'page', page:blankPage('fantasma'), data:blankPage('x')}); undoStack.push({kind:'removePage', page:blankPage('otra')});");
  const before = J(E.run("doc"));
  E.run("undo()");
  assert.deepEqual(J(E.run("doc")), before); assert.equal(E.run("undoStack.length"), 0); assert.equal(E.run("redoStack.length"), 0);
  assert.match(read("js/state.js").split("function applyProjectData")[1].split("\n}")[0], /undoStack\.length=0; redoStack\.length=0;/, "cambiar de documento vacía ambas pilas");
  for (let k = 0; k < 70; k++) E.run("pushUndo()");
  E.close(0);
  assert.equal(E.run("undoStack.length"), 60);
});

test("Share/Viewer tras borrar: el documento normalizado tiene cur válido y applyShareKind comparte la Historia de la página activa", () => {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of ["config.js", "safe-svg.js", "model.js", "share-url.js"]) vm.runInContext(read("js/" + f), ctx);
  const E = editor(); E.load(D3); E.run("doc.cur=2"); E.close(0);                      // activa: C (índice 1)
  E.run("doc.cur=0");                                                                     // activa: B, con Historias
  ctx.__p = JSON.stringify({ version: 5, app: "fluyo", doc: J(E.run("doc")), settings: {} });
  const shared = JSON.parse(vm.runInContext("JSON.stringify(applyShareKind(projectFromProjectData(JSON.parse(__p)),{kind:'story',scenarioId:1}))", ctx));
  assert.equal(shared.doc.cur, 0);
  assert.deepEqual(shared.doc.pages.map((p) => p.scenarios.map((s) => s.name)), [["Compra"], []]);
});

/* Secuencias aleatorias contra un modelo de referencia: el historial (sin crear ni renombrar páginas, que no son de Undo) es una pila de
   documentos completos. Tras cada Undo/Redo el contenido y el orden de las páginas deben coincidir con el modelo, y cur siempre en rango. */
test("aleatorio: editar/borrar/navegar/deshacer/rehacer — Undo/Redo coinciden con el modelo de referencia y nunca corrompen", () => {
  let seed = 2026; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const content = (E) => J(E.run("doc.pages.map(p=>({name:p.name, nodes:p.nodes, edges:p.edges, behaviors:p.behaviors, scenarios:p.scenarios}))"));
  for (let t = 0; t < 60; t++) {
    const base = J(D3); base.doc.pages.push(J(base.doc.pages[1])); base.doc.pages[3].name = "D";
    const E = editor(); E.load(base);
    const past = [], future = []; let n = 0;
    for (let k = 0; k < 40; k++) {
      const r = rnd(), len = E.run("doc.pages.length");
      if (r < 0.3) {                                                      // editar una página cualquiera
        const i = Math.floor(rnd() * len); past.push(content(E)); future.length = 0;
        E.run(`doc.cur=${i}; pushUndo(); P().nodes.push({id:${1000 + n},shape:"rect",x:${n},y:0,w:10,h:10}); P().nextId=${1001 + n};`); n++;
      } else if (r < 0.45 && len > 1) {                                   // borrar
        past.push(content(E)); future.length = 0;
        E.close(Math.floor(rnd() * len));
      } else if (r < 0.55) {                                              // navegar (no es de Undo)
        E.run(`doc.cur=${Math.floor(rnd() * len)}`);
      } else if (r < 0.8) {
        E.run("undo()"); if (past.length) { future.push(content(E)); past.pop(); }
      } else {
        E.run("redo()"); if (future.length) { past.push(content(E)); future.pop(); }
      }
      const cur = E.run("doc.cur"), L = E.run("doc.pages.length");
      assert.ok(Number.isInteger(cur) && cur >= 0 && cur < L, `t${t} k${k}: cur en rango`);
    }
    // deshacer todo vuelve exactamente al documento inicial (contenido y orden)
    for (let k = 0; k < 100; k++) E.run("undo()");
    assert.deepEqual(content(E).map((p) => [p.name, p.nodes.length]), J(base.doc.pages).map((p) => [p.name, p.nodes.length]), `t${t}: Undo completo`);
    const norm = (ps) => ps.map((p) => ({ name: p.name, nodes: p.nodes.map((x) => x.id), edges: p.edges.map((x) => x.id), behaviors: p.behaviors, stories: p.scenarios.map((s) => s.steps.length) }));
    assert.deepEqual(norm(content(E)), norm(K.call("projectFromProjectData(__a).doc.pages", base)), `t${t}: contenido inicial exacto`);
  }
});

test("aleatorio (modelo paso a paso): cada Undo devuelve exactamente el documento anterior y cada Redo el siguiente", () => {
  let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const content = (E) => JSON.stringify(J(E.run("doc.pages.map(p=>({name:p.name, nodes:p.nodes.map(n=>n.id), edges:p.edges.map(e=>e.id), sc:p.scenarios.length, b:p.behaviors.length}))")));
  for (let t = 0; t < 60; t++) {
    const E = editor(); E.load(D3);
    const past = [], future = []; let n = 0;
    for (let k = 0; k < 30; k++) {
      const r = rnd(), len = E.run("doc.pages.length");
      if (r < 0.35) { const i = Math.floor(rnd() * len); past.push(content(E)); future.length = 0; E.run(`doc.cur=${i}; pushUndo(); P().nodes.push({id:${500 + n++},shape:"rect",x:0,y:0,w:10,h:10});`); }
      else if (r < 0.5 && len > 1) { past.push(content(E)); future.length = 0; E.close(Math.floor(rnd() * len)); }
      else if (r < 0.8) { const had = past.length; const now = content(E); E.run("undo()"); if (had) { assert.equal(content(E), past.pop(), `t${t} k${k} undo`); future.push(now); } }
      else { const had = future.length; const now = content(E); E.run("redo()"); if (had) { assert.equal(content(E), future.pop(), `t${t} k${k} redo`); past.push(now); } }
    }
  }
});
