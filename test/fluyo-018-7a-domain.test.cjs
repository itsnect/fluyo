"use strict";
/* FLUYO-018.7a — dominio y autoría de set_theme, orden Z y duplicate_node: kernel real en `vm`, paridad con el editor real
   (state.js + selection.js) y documentos antiguos. El golden compartido con fluyo-mcp se genera desde este archivo. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { makeEditor, SETUP } = require("./fluyo-018-7a-harness.cjs");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.parse(JSON.stringify(v));
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
function kernel() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(vm.runInContext(`JSON.stringify((function(){ const __a = JSON.parse(__in); return (${expr}); })())`, ctx)); };
  return ctx;
}
/* El editor real: state.js (newNode…) y selection.js (Z, dupSel, pasteClip, undo). */
function editor() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, scheduleAutosave() {}, renderTabs() {}, refreshPanel() {}, selN: new Set(), selE: new Set(), clip: null, GRID: 20 });
  ctx.run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js"]) ctx.run(read("js/" + f));
  ctx.run(read("js/state.js").split("/* ===================== Viewport")[0]);
  ctx.run(read("js/selection.js"));
  ctx.load = (project) => ctx.run("doc=projectFromProjectData(" + JSON.stringify(project) + ").doc; undoStack.length=0; redoStack.length=0; selN.clear(); selE.clear();");
  return ctx;
}
const K = kernel();
const page = (name = "Página 1") => ({ name, nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
const project = (...pages) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: pages.length ? pages : [page()], cur: 0 }, settings: {} });
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };
const err = (r, code) => { assert.equal(r.ok, false, "debía rechazarse"); assert.equal(r.errors[0].code, code, JSON.stringify(r.errors)); return r.errors[0]; };
const normalize = (p) => K.call("projectFromProjectData(__a).doc", p);
const frozen = (o) => { const f = (x) => { if (x && typeof x === "object") { Object.freeze(x); Object.values(x).forEach(f); } return x; }; return f(o); };

const N = (spec = {}, extra = {}) => Object.assign({ op: "create_node", scope: "page", pageIndex: 0, spec: Object.assign({ shape: "rect", x: 0, y: 0 }, spec) }, extra);
const C = (source, target, extra = {}) => Object.assign({ op: "create_connection", scope: "page", pageIndex: 0, source, target }, extra);
const DN = (node) => ({ op: "delete_node", scope: "page", pageIndex: 0, node });
const TH = (patch) => Object.assign({ op: "set_theme", scope: "document" }, patch);
const RZ = (nodes, to, pageIndex = 0) => ({ op: "reorder_nodes", scope: "page", pageIndex, nodes, to });
const DUP = (nodes, extra = {}) => Object.assign({ op: "duplicate_node", scope: "page", pageIndex: 0, nodes }, extra);
const R = (ref) => ({ ref });
const I = (id) => ({ id });
const SRC = (source, ref) => Object.assign({ source }, ref === undefined ? {} : { ref });

/* Página de trabajo: nodos 1..4 (A..D), conexiones 5 (1→2 con waypoints), 6 (2→3), 7 (3→4), 8 (1→4); Behavior DOWN en 2 y 4; una Historia. */
function base() {
  const ops = [
    N({ x: 100, y: 100, label: "A" }, { ref: "a" }), N({ x: 300, y: 100, label: "B" }, { ref: "b" }), N({ x: 500, y: 100, label: "C" }, { ref: "c" }), N({ x: 700, y: 100, label: "D" }, { ref: "d" }),
    C(R("a"), R("b"), { spec: { waypoints: [{ x: 200, y: 60 }, { x: 200, y: 140 }], label: "uno", lineColor: "#ff0000" } }), C(R("b"), R("c")), C(R("c"), R("d")), C(R("a"), R("d")),
    { op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: R("b"), state: "DOWN" }, { op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: R("d"), state: "DOWN" },
    { op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", ref: "pago" },
    { op: "create_story", scope: "story", pageIndex: 0, name: "Compra", ref: "s" },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s"), eventTypeId: R("pago"), target: { edgeId: 6 } },
  ];
  return ok(apply(project(), ops)).project;
}
const ids = (p, pi = 0) => p.doc.pages[pi].nodes.map((n) => n.id);
const traceOf = (p) => K.call("(function(){ const d=projectFromProjectData(__a).doc; const pg=d.pages[0]; return FluyoStory.run(pg, pg.scenarios[0]); })()", p);

/* ───────────── set_theme ───────────── */
test("setThemeIn: tema válido, fondo, parche, null→\"\", idempotente y todo o nada", () => {
  const run = (code, d) => K.call(`(function(){ const d=__a; let r,e=null; try{ r=(${code}); }catch(x){ e={code:x.code,field:x.field}; } return {r,e,d}; })()`, d);
  const d0 = { theme: "dark", customBg: "", pages: [] };
  let x = run('setThemeIn(d,{theme:"crema"})', d0);
  assert.deepEqual(x.r, { changed: true, theme: { from: "dark", to: "crema" }, customBg: { from: "", to: "" } });
  assert.equal(x.d.theme, "crema");
  x = run('setThemeIn(d,{customBg:"#112233"})', d0); assert.equal(x.d.customBg, "#112233"); assert.equal(x.d.theme, "dark", "parche: lo no enviado no cambia");
  x = run("setThemeIn(d,{customBg:null})", { ...d0, customBg: "#fff" }); assert.equal(x.d.customBg, ""); assert.equal(x.r.changed, true);
  x = run('setThemeIn(d,{theme:"dark"})', d0); assert.equal(x.r.changed, false, "mismo valor: idempotente");
  x = run('setThemeIn(d,{theme:"neon"})', d0); assert.deepEqual(x.e, { code: "invalid_theme", field: "theme" }); assert.equal(x.d.theme, "dark");
  x = run('setThemeIn(d,{theme:"claro", customBg:5})', d0); assert.equal(x.e.code, "invalid_document"); assert.equal(x.d.theme, "dark", "todo o nada: no se escribió theme");
  x = run("setThemeIn(d,{})", d0); assert.equal(x.e.code, "empty_patch");
  x = run("setThemeIn(d,{theme:undefined})", d0); assert.equal(x.e.code, "empty_patch");
  x = run('setThemeIn(d,{bg:"x"})', d0); assert.equal(x.e.code, "invalid_document");
  x = run('setThemeIn(d,{theme:"toString"})', d0); assert.equal(x.e.code, "invalid_theme", "claves heredadas no valen como tema");
});
test("set_theme (autoría): los tres temas, customBg HEX/null/\"\", rechazos y no retroactividad", () => {
  const b = base();
  for (const t of ["dark", "crema", "claro"]) assert.equal(ok(apply(b, [TH({ theme: t })])).project.doc.theme, t);
  const r = ok(apply(b, [TH({ theme: "crema", customBg: "#f4eee1" })]));
  assert.equal(r.project.doc.customBg, "#f4eee1"); assert.deepEqual(r.changes[0].theme, { from: "dark", to: "crema" });
  for (const v of ["#fff", "#ffffff", "#ffffff80"]) assert.equal(ok(apply(b, [TH({ customBg: v })])).project.doc.customBg, v);
  assert.equal(ok(apply(r.project, [TH({ customBg: null })])).project.doc.customBg, "");
  assert.equal(ok(apply(r.project, [TH({ customBg: "" })])).project.doc.customBg, "");
  for (const v of ["red", "#12", "rgb(1,2,3)", "#gggggg", 5, "url(x)"]) assert.equal(err(apply(b, [TH({ customBg: v })]), "INVALID_FIELD").field, "customBg");
  assert.equal(err(apply(b, [TH({ theme: "neon" })]), "INVALID_FIELD").field, "theme");
  err(apply(b, [TH({})]), "INVALID_OPERATION");
  err(apply(b, [TH({ theme: "dark", extra: 1 })]), "INVALID_OPERATION");
  err(apply(b, [{ op: "set_theme", scope: "page", pageIndex: 0, theme: "dark" }]), "SCOPE_MISMATCH");
  const same = ok(apply(b, [TH({ theme: "dark" })]));
  assert.equal(same.changes[0].changed, false); assert.deepEqual(same.project, b);
  const old = J(b); old.doc.customBg = "papayawhip";
  const o = ok(apply(old, [TH({ theme: "claro" })]));
  assert.equal(o.project.doc.customBg, "papayawhip"); assert.equal(o.project.doc.theme, "claro");
  err(apply(b, [TH({ theme: "crema" }), TH({ theme: "neon" })]), "INVALID_FIELD");
});
test("set_theme: el editor (themeSel/bgCustom) y MCP dan el mismo documento; no entra en Undo; ui.js no lo escribe a mano", () => {
  const b = base(); const E = editor(); E.load(b);
  E.run('setThemeIn(doc,{theme:"crema"}); setThemeIn(doc,{customBg:"#f4eee1"});');
  const m = ok(apply(b, [TH({ theme: "crema" }), TH({ customBg: "#f4eee1" })])).project;
  assert.deepEqual(J(E.run("doc")), normalize(m));
  assert.equal(E.run("undoStack.length"), 0);
  assert.equal(/doc\.theme\s*=[^=]|doc\.customBg\s*=[^=]/.test(read("js/ui.js")), false);
});

/* ───────────── orden Z ───────────── */
const reorder = (list, sel, to) => { // modelo de referencia independiente del dominio: el algoritmo histórico del editor
  let ns = list.slice(); const s = new Set(sel);
  if (to === "front") ns = ns.filter((x) => !s.has(x)).concat(ns.filter((x) => s.has(x)));
  else if (to === "back") ns = ns.filter((x) => s.has(x)).concat(ns.filter((x) => !s.has(x)));
  else if (to === "forward") { for (let i = ns.length - 2; i >= 0; i--) if (s.has(ns[i]) && !s.has(ns[i + 1])) [ns[i], ns[i + 1]] = [ns[i + 1], ns[i]]; }
  else { for (let i = 1; i < ns.length; i++) if (s.has(ns[i]) && !s.has(ns[i - 1])) [ns[i], ns[i - 1]] = [ns[i - 1], ns[i]]; }
  return ns;
};
test("reorder_nodes: las cuatro colocaciones coinciden con el modelo del editor (selecciones contiguas, discontinuas y completas)", () => {
  const b = base();
  const subsets = [[1], [2], [4], [1, 2], [2, 3], [1, 3], [2, 4], [1, 4], [1, 2, 3], [1, 3, 4], [1, 2, 3, 4]];
  for (const to of ["front", "back", "forward", "backward"]) for (const sel of subsets) {
    const r = ok(apply(b, [RZ(sel.map(I), to)]));
    assert.deepEqual(ids(r.project), reorder([1, 2, 3, 4], sel, to), `${to} ${sel}`);
  }
});
test("reorder_nodes: orden de la lista irrelevante, no-op válido, solo cambia la posición y el Trace no cambia", () => {
  const b = base();
  const a = ok(apply(b, [RZ([I(3), I(1)], "front")])), c = ok(apply(b, [RZ([I(1), I(3)], "front")]));
  assert.deepEqual(a.project, c.project); assert.deepEqual(ids(a.project), [2, 4, 1, 3]);
  const noop = ok(apply(b, [RZ([I(4)], "front")]));
  assert.equal(noop.changes[0].changed, false); assert.deepEqual(noop.project, b); assert.equal(noop.changes[0].affects.order, undefined);
  const moved = ok(apply(b, [RZ([I(2)], "back")]));
  assert.deepEqual(moved.changes[0].affects.order, { from: [1, 2, 3, 4], to: [2, 1, 3, 4] });
  const strip = (p) => { const q = J(p); q.doc.pages[0].nodes.sort((x, y) => x.id - y.id); return q; };
  assert.deepEqual(strip(moved.project), strip(b), "solo cambia la posición en nodes[]");
  assert.deepEqual(traceOf(moved.project), traceOf(b), "Trace antes = después");
  assert.equal(K.call("FluyoIntegrity.validateProject(__a).valid", moved.project), true);
});
test("reorder_nodes: refs, errores y todo o nada", () => {
  const b = base();
  assert.deepEqual(ids(ok(apply(b, [N({ x: 900, y: 100 }, { ref: "e" }), RZ([R("e")], "back")])).project), [9, 1, 2, 3, 4]);
  err(apply(b, [RZ([R("zz")], "back")]), "UNKNOWN_REF");
  err(apply(b, [RZ([I(99)], "back")]), "NODE_NOT_FOUND");
  err(apply(b, [RZ([I(5)], "back")]), "NODE_NOT_FOUND");
  assert.match(err(apply(b, [DN(I(2)), RZ([I(2)], "front")]), "NODE_NOT_FOUND").message, /la eliminó la operación 0/);
  assert.equal(err(apply(b, [RZ([I(1)], "up")]), "INVALID_FIELD").field, "to");
  err(apply(b, [RZ([], "front")]), "INVALID_OPERATION");
  err(apply(b, [RZ(Array.from({ length: 101 }, (_, i) => I(i + 1)), "front")]), "INVALID_OPERATION");
  err(apply(b, [RZ([I(1)], "front"), RZ([I(99)], "front")]), "NODE_NOT_FOUND");
  err(apply(b, [{ op: "reorder_nodes", scope: "page", pageIndex: 0, nodes: [I(1)] }]), "INVALID_FIELD");
  err(apply(b, [RZ([I(1)], "front", 7)]), "PAGE_NOT_FOUND");
  assert.equal(ok(apply(b, [RZ([I(1), I(1)], "front")])).project.doc.pages[0].nodes.at(-1).id, 1, "ids repetidos se ignoran");
  ok(apply(frozen(J(b)), [RZ([I(1)], "front")]));
});
test("orden Z: editor real y MCP dan el mismo documento (4 acciones × selecciones) y Undo solo si hay cambio", () => {
  const b = base();
  const to = { bringToFront: "front", sendToBack: "back", bringForward: "forward", sendBackward: "backward" };
  for (const [fn, placement] of Object.entries(to)) for (const sel of [[1], [2, 3], [1, 3], [1, 2, 3, 4], [4]]) {
    const E = editor(); E.load(b); E.run(`selN=new Set(${JSON.stringify(sel)});`);
    E.run(`${fn}()`);
    const m = ok(apply(b, [RZ(sel.map(I), placement)])).project;
    assert.deepEqual(J(E.run("doc")), normalize(m), `${fn} ${sel}`);
    const changed = JSON.stringify(ids(m)) !== JSON.stringify([1, 2, 3, 4]);
    assert.equal(E.run("undoStack.length"), changed ? 1 : 0, "una entrada de Undo solo si hay cambio");
  }
});
test("orden Z (editor): Undo/Redo restauran el orden; sin selección, sin cambio o con conexiones no hay entrada", () => {
  const E = editor(); E.load(base());
  E.run("selN.clear(); bringToFront();"); assert.equal(E.run("undoStack.length"), 0);
  E.run("selN=new Set([4]); bringToFront();"); assert.equal(E.run("undoStack.length"), 0, "ya está al frente");
  E.run("sendBackward();"); assert.deepEqual(J(E.run("P().nodes.map(n=>n.id)")), [1, 2, 4, 3]); assert.equal(E.run("undoStack.length"), 1);
  E.run("undo();"); assert.deepEqual(J(E.run("P().nodes.map(n=>n.id)")), [1, 2, 3, 4]);
  E.run("redo();"); assert.deepEqual(J(E.run("P().nodes.map(n=>n.id)")), [1, 2, 4, 3]);
  E.run("selN=new Set([4]); selE=new Set([5]); bringToFront(); sendToBack();");
  assert.deepEqual(J(E.run("P().nodes.map(n=>n.id)")), [4, 1, 2, 3], "las conexiones seleccionadas se ignoran");
  E.run("selE=new Set([5]); selN.clear(); bringToFront();"); assert.equal(E.run("undoStack.length"), 3, "solo conexiones: nada que reordenar");
});
test("orden Z: el campo order (animación build) y la identidad de los nodos no cambian", () => {
  const E = editor(); E.load(base());
  const byId = (a) => Object.fromEntries(a.map((n) => [n.id, n.order]));
  const before = byId(J(E.run("P().nodes.map(n=>({id:n.id,order:n.order}))")));
  E.run("globalThis.orig=P().nodes.slice(); selN=new Set([1,2]); bringToFront();");
  assert.deepEqual(byId(J(E.run("P().nodes.map(n=>({id:n.id,order:n.order}))"))), before);
  assert.equal(E.run("P().nodes.every(n=>orig.includes(n))"), true, "los mismos objetos");
});

/* ───────────── duplicate_node ───────────── */
test("duplicate_node: un nodo con Behavior; ids nuevos; order; sin tocar Historias ni EventTypes; Trace igual", () => {
  const b = base();
  const r = ok(apply(b, [DUP([SRC(I(2), "b2")])]));
  const pg = r.project.doc.pages[0];
  assert.deepEqual(ids(r.project), [1, 2, 3, 4, 9]);
  assert.equal(pg.nodes[4].label, "B"); assert.equal(pg.nodes[4].x, 320); assert.equal(pg.nodes[4].y, 120); assert.equal(pg.nodes[4].order, 4);
  assert.deepEqual(pg.behaviors.map((x) => [x.nodeId, x.initialState]), [[2, "DOWN"], [4, "DOWN"], [9, "DOWN"]]);
  assert.equal(pg.edges.length, 4, "las conexiones con extremos fuera del conjunto no se copian");
  assert.deepEqual(pg.scenarios, b.doc.pages[0].scenarios, "Historias y Steps intactos");
  assert.deepEqual(r.project.doc.eventTypes, b.doc.eventTypes);
  assert.deepEqual(traceOf(r.project), traceOf(b), "Trace antes = después");
  assert.deepEqual(r.refs.map((x) => [x.ref, x.id]), [["b2", 9]]);
  assert.deepEqual(r.changes[0].created, [{ kind: "node", from: 2, id: 9, ref: "b2" }]);
  assert.equal(JSON.stringify(r.project).includes('"ref"'), false, "las refs no se persisten");
});
test("duplicate_node: conjunto con conexiones internas (también las no seleccionadas), waypoints desplazados e ids por orden del documento", () => {
  const b = base();
  const a = ok(apply(b, [DUP([SRC(I(3)), SRC(I(1)), SRC(I(2))])]));
  const pg = a.project.doc.pages[0];
  assert.deepEqual(a.changes[0].created.map((x) => [x.kind, x.from, x.id]), [["node", 1, 9], ["node", 2, 10], ["node", 3, 11], ["connection", 5, 12], ["connection", 6, 13]]);
  const e12 = pg.edges.find((e) => e.id === 12), e13 = pg.edges.find((e) => e.id === 13);
  assert.deepEqual([e12.from, e12.to, e13.from, e13.to], [9, 10, 10, 11]);
  assert.deepEqual(e12.waypoints, [{ x: 220, y: 80 }, { x: 220, y: 160 }]); assert.equal(e12.label, "uno"); assert.equal(e12.lineColor, "#ff0000");
  assert.deepEqual(b.doc.pages[0].edges.find((e) => e.id === 5).waypoints, [{ x: 200, y: 60 }, { x: 200, y: 140 }], "el original no cambia");
  assert.deepEqual(pg.nodes.slice(4).map((n) => n.order), [4, 5, 6]);
  assert.equal(pg.nextId, 14);
  assert.deepEqual(ok(apply(b, [DUP([SRC(I(1)), SRC(I(2)), SRC(I(3))])])).project, a.project, "el orden de la lista no cambia el resultado");
  assert.deepEqual(a.changes[0].affects.connectionsWithWaypoints, [12]);
});
test("duplicate_node: connections:\"none\", offset explícito y conexión interna entre nodos no contiguos", () => {
  const b = base();
  const n = ok(apply(b, [DUP([SRC(I(1)), SRC(I(2))], { connections: "none", offset: { x: 0, y: 50 } })])).project.doc.pages[0];
  assert.equal(n.edges.length, 4); assert.deepEqual(n.nodes.slice(4).map((x) => [x.x, x.y]), [[100, 150], [300, 150]]);
  const e = ok(apply(b, [DUP([SRC(I(1)), SRC(I(4))])])).project.doc.pages[0];
  assert.equal(e.edges.length, 5, "la conexión 8 (1→4) es interna al conjunto {1,4}");
  assert.deepEqual([e.edges.at(-1).from, e.edges.at(-1).to], [9, 10]);
  assert.equal(err(apply(b, [DUP([SRC(I(1))], { connections: "all" })]), "INVALID_FIELD").field, "connections");
  err(apply(b, [DUP([SRC(I(1))], { offset: { x: "a", y: 1 } })]), "INVALID_FIELD");
  err(apply(b, [DUP([SRC(I(1))], { offset: { x: 1, y: 1, z: 2 } })]), "INVALID_OPERATION");
});
test("duplicate_node: refs de las copias usables en el mismo lote; DUPLICATE_REF/UNKNOWN_REF; errores; todo o nada", () => {
  const b = base();
  const r = ok(apply(b, [DUP([SRC(I(1), "a2"), SRC(I(2), "b2")]), C(R("a2"), I(4), { ref: "x" }), RZ([R("b2")], "back")]));
  assert.equal(r.project.doc.pages[0].edges.at(-1).from, 9);
  assert.equal(r.project.doc.pages[0].nodes[0].id, 10);
  err(apply(b, [N({}, { ref: "a" }), DUP([SRC(I(1), "a")])]), "DUPLICATE_REF");
  err(apply(b, [DUP([SRC(I(1), "k"), SRC(I(2), "k")])]), "DUPLICATE_REF");
  err(apply(b, [DUP([SRC(R("nope"))])]), "UNKNOWN_REF");
  err(apply(b, [DUP([SRC(I(99))])]), "NODE_NOT_FOUND");
  err(apply(b, [DUP([SRC(I(5))])]), "NODE_NOT_FOUND");
  err(apply(b, [DUP([SRC(I(1)), SRC(I(1))])]), "INVALID_OPERATION");
  err(apply(b, [DUP([])]), "INVALID_OPERATION");
  err(apply(b, [DUP([{ ref: "x" }])]), "INVALID_OPERATION");
  err(apply(b, [DUP([{ source: I(1), extra: 1 }])]), "INVALID_OPERATION");
  assert.match(err(apply(b, [DN(I(1)), DUP([SRC(I(1))])]), "NODE_NOT_FOUND").message, /la eliminó la operación 0/);
  err(apply(b, [DUP([SRC(I(1))]), DUP([SRC(I(99))])]), "NODE_NOT_FOUND");
  err(apply(b, [DUP([SRC(I(1))], { pageIndex: 3 })]), "PAGE_NOT_FOUND");
  ok(apply(frozen(J(b)), [DUP([SRC(I(1))])]));
});
test("duplicate_node: límites de autoría sobre el estado final (300 nodos, 600 conexiones, coordMax), no retroactivos", () => {
  const big = (nodes, edges) => { const pg = page("G"); for (let i = 1; i <= nodes; i++) pg.nodes.push({ id: i, shape: "rect", x: i, y: 0, w: 100, h: 60, label: "n" + i }); for (let j = 1; j <= edges; j++) pg.edges.push({ id: nodes + j, from: 1, to: 2, route: "straight", label: "" }); pg.nextId = nodes + edges + 1; return project(pg); };
  assert.equal(ok(apply(big(298, 0), [DUP([SRC(I(1)), SRC(I(2))])])).project.doc.pages[0].nodes.length, 300);
  { const e = err(apply(big(299, 0), [DUP([SRC(I(1)), SRC(I(2))])]), "LIMIT_EXCEEDED"); assert.equal(e.limitName, "maxNodesPerPage"); assert.equal(e.operationIndex, 0); }
  { const e = err(apply(big(10, 599), [DUP([SRC(I(1)), SRC(I(2))])]), "LIMIT_EXCEEDED"); assert.equal(e.limitName, "maxConnectionsPerPage"); assert.equal(e.operationIndex, 0, "el error señala la operación que subió el conteo"); }
  assert.equal(ok(apply(big(10, 599), [DUP([SRC(I(1)), SRC(I(2))], { connections: "none" })])).project.doc.pages[0].edges.length, 599);
  assert.equal(err(apply(base(), [DUP([SRC(I(1))], { offset: { x: 200000, y: 0 } })]), "LIMIT_EXCEEDED").limitName, "coordMax");
  const old = big(350, 0);
  assert.equal(ok(apply(old, [DUP([SRC(I(1))], { connections: "none" }), DN(I(2)), DN(I(3))])).project.doc.pages[0].nodes.length, 349, "reducir en un documento antiguo es posible");
  assert.equal(err(apply(old, [DUP([SRC(I(1))])]), "LIMIT_EXCEEDED").limitName, "maxNodesPerPage");
});
test("duplicateNodesIn: agotamiento de ids sin copia parcial ni entrada de Undo", () => {
  const E = editor(); E.load(base());
  E.run("P().nextId=Number.MAX_SAFE_INTEGER-1;");
  const before = J(E.run("P()"));
  assert.equal(E.run("(function(){ try{ duplicateNodesIn(P(),[1,2],{}); }catch(e){ return e.code; } })()"), "id_exhausted");
  assert.deepEqual(J(E.run("P()")), before);
  assert.throws(() => E.run("selN=new Set([1,2]); dupSel();"), /id_exhausted/);
  assert.equal(E.run("undoStack.length"), 0, "sin entrada de Undo si el dominio falla");
  assert.deepEqual(J(E.run("P()")), before);
});
test("duplicate_node: el editor (Ctrl+D) y MCP dan el mismo documento; selección final = lo nuevo; un único Undo/Redo", () => {
  const b = base();
  for (const sel of [[2], [1, 2, 3], [1, 4], [4], [1, 2, 3, 4]]) {
    const E = editor(); E.load(b); E.run(`selN=new Set(${JSON.stringify(sel)});`);
    E.run("dupSel();");
    const r = ok(apply(b, [DUP(sel.map((id) => SRC(I(id))))]));
    assert.deepEqual(J(E.run("doc")), normalize(r.project), `sel ${sel}`);
    assert.equal(E.run("undoStack.length"), 1, "un solo Undo");
    const created = r.changes[0].created;
    assert.deepEqual(J(E.run("[...selN]")), created.filter((c) => c.kind === "node").map((c) => c.id));
    assert.deepEqual(J(E.run("[...selE]")), created.filter((c) => c.kind === "connection").map((c) => c.id));
    E.run("undo();");
    assert.deepEqual(J(E.run("P().nodes.map(n=>n.id)")), [1, 2, 3, 4]); assert.equal(E.run("P().edges.length"), 4); assert.equal(E.run("P().behaviors.length"), 2);
    assert.equal(E.run("P().nextId") > 9, true, "los ids no se reutilizan tras Undo");
    E.run("redo();"); assert.deepEqual(J(E.run("doc")), normalize(r.project));
  }
});
test("dupSel ya no usa el portapapeles (ni el interno ni el del sistema); Ctrl+C sí", () => {
  const e = makeEditor(); e.run(SETUP); e.run("selN=new Set([1,2,3]); dupSel();");
  assert.equal(e.clipboard.length, 0, "Ctrl+D no pisa el portapapeles del sistema");
  assert.equal(e.run("clip"), null);
  e.run("copySel();"); assert.equal(e.clipboard.length, 1);
});
test("pegar, duplicar y reordenar usan el dominio: selection.js no clona ni reordena estructura por su cuenta", () => {
  const src = read("js/selection.js");
  const paste = src.split("function pasteClip")[1].split("\n}")[0];
  assert.equal(/cloneStructureIn/.test(paste) && !/\.nodes\.push|\.edges\.push|behaviors\.push/.test(paste), true);
  assert.equal(/duplicateNodesIn/.test(src.split("function dupSel")[1].split("\n}")[0]), true);
  assert.equal(/reorderNodesIn/.test(src), true);
  assert.equal(/P\(\)\.nodes\s*=|ns\[i\]\s*,/.test(src), false);
});
test("documentos antiguos (v3 sin order/customBg) se abren y las tres operaciones los modifican sin invalidarlos", () => {
  const old = { version: 3, app: "fluyo", doc: { theme: "crema", pages: [{ name: "x", nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: 200, y: 0 }], edges: [{ id: 3, from: 1, to: 2 }], nextId: 4 }] }, settings: {} };
  const r = ok(apply(old, [TH({ theme: "claro" }), RZ([I(1)], "front"), DUP([SRC(I(1)), SRC(I(2))])]));
  const pg = r.project.doc.pages[0];
  assert.equal(r.project.doc.theme, "claro"); assert.equal(r.project.doc.customBg, "");
  assert.equal(pg.nodes.length, 4); assert.equal(pg.edges.length, 2);
  assert.equal(K.call("FluyoIntegrity.validateProject(__a).valid", r.project), true);
});
test("ninguna de las tres operaciones añade claves nuevas al documento", () => {
  const b = base();
  const r = ok(apply(b, [TH({ theme: "crema", customBg: "#fff" }), RZ([I(1)], "front"), DUP([SRC(I(1), "q")])])).project;
  const keys = (o, acc = new Set()) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { acc.add(k); keys(v, acc); } return acc; };
  const known = keys(b);
  assert.deepEqual([...keys(r)].filter((k) => !known.has(k) && !/^\d+$/.test(k)), []);
});

/* ───────────── golden compartido con fluyo-mcp ─────────────
   Cada caso: la operación de autoría, el código equivalente del editor real y la revisión (sha256 del JSON canónico del documento
   normalizado, la misma que describe_document) del documento resultante. fluyo-mcp aplica las mismas operaciones y debe obtener la misma
   resultRevision; aquí se comprueba que el editor real y el kernel coinciden con ella. FLUYO_UPDATE_GOLDEN=1 lo regenera. */
const crypto = require("node:crypto");
const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v !== null && typeof v === "object" ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v);
const revisionOf = (p) => "sha256:" + crypto.createHash("sha256").update(canonical(p)).digest("hex");
const GOLDEN_CASES = [
  { name: "set_theme tema y fondo", ops: [TH({ theme: "crema", customBg: "#f4eee1" })], editor: 'setThemeIn(doc,{theme:"crema"}); setThemeIn(doc,{customBg:"#f4eee1"});' },
  { name: "reorder_nodes: subir 2 y 3 una capa", ops: [RZ([I(2), I(3)], "forward")], editor: "selN=new Set([2,3]); bringForward();" },
  { name: "reorder_nodes: 1 al frente", ops: [RZ([I(1)], "front")], editor: "selN=new Set([1]); bringToFront();" },
  { name: "reorder_nodes: 4 al fondo", ops: [RZ([I(4)], "back")], editor: "selN=new Set([4]); sendToBack();" },
  { name: "duplicate_node: conjunto 1,2,3", ops: [DUP([SRC(I(1)), SRC(I(2)), SRC(I(3))])], editor: "selN=new Set([1,2,3]); dupSel();" },
  { name: "duplicate_node: un nodo con Behavior", ops: [DUP([SRC(I(2))])], editor: "selN=new Set([2]); dupSel();" },
];
test("golden: editor real, kernel y fixture compartido dan el mismo documento y la misma revisión", () => {
  const b = base();
  const file = path.join(__dirname, "fixtures", "fluyo-018-7a-golden.json");
  const out = { baseRevision: revisionOf(K.call("FluyoAuthoring.normalizedProject(__a)", b).project), document: b, cases: [] };
  for (const c of GOLDEN_CASES) {
    const r = ok(apply(b, c.ops));
    const E = editor(); E.load(b); E.run(c.editor);
    const edDoc = J(E.run("doc"));
    assert.deepEqual(edDoc, normalize(r.project), `${c.name}: editor ≠ kernel`);
    out.cases.push({ name: c.name, operations: c.ops, resultRevision: revisionOf(r.project) });
  }
  if (process.env.FLUYO_UPDATE_GOLDEN) fs.writeFileSync(file, JSON.stringify(out, null, 1));
  const golden = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(golden, J(out), "el golden cambió: revisa el comportamiento o regenera con FLUYO_UPDATE_GOLDEN=1");
});

test("reorder_nodes y duplicate_node: el orden relativo y los ids nuevos salen del orden del documento, no de los ids", () => {
  const start = ok(apply(base(), [RZ([I(1), I(4)], "front"), RZ([I(2)], "front")])).project;
  assert.deepEqual(ids(start), [3, 1, 4, 2]);
  for (const to of ["front", "back", "forward", "backward"]) for (const sel of [[1, 2], [3, 4], [1, 3, 2], [4, 2]])
    assert.deepEqual(ids(ok(apply(start, [RZ(sel.map(I), to)])).project), reorder([3, 1, 4, 2], sel, to), `${to} ${sel}`);
  const d = ok(apply(start, [DUP([SRC(I(2)), SRC(I(3)), SRC(I(4))])]));
  assert.deepEqual(d.changes[0].created.filter((c) => c.kind === "node").map((c) => c.from), [3, 4, 2]);
  const E = editor(); E.load(start); E.run("selN=new Set([2,3,4]); dupSel();");
  assert.deepEqual(J(E.run("doc")), normalize(d.project), "editor y MCP coinciden también con un orden Z no trivial");
});
test("ui.js: el tema y el fondo no entran en Undo ni se escriben a mano", () => {
  const ui = read("js/ui.js");
  assert.equal(/themeSel[^\n]*pushUndo|bgCustom[^\n]*pushUndo|btnBgClear[^\n]*pushUndo/.test(ui), false);
  assert.equal(/\$\("themeSel"\)\.onchange=\(\)=>\{ setThemeIn\(doc,\{theme:/.test(ui), true);
});
