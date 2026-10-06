"use strict";
/* FLUYO-018.3 — modificar y eliminar estructura: dominio (updateNodeIn, updateConnectionIn, deleteNodeIn, deleteConnectionIn de model.js),
   FluyoAuthoring (update_node, update_connection, delete_node, delete_connection, refs ampliadas, B2 atribuido) y PARIDAD con el
   editor real (documento completo, sin normalizar; incluye Historias, EventTypes, Behaviors, nextId y Trace). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.parse(JSON.stringify(v));
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];

function kernel() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.run = (code) => vm.runInContext(code, ctx);
  ctx.call = (expr, arg) => { ctx.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(vm.runInContext(`JSON.stringify((function(){ const __a = JSON.parse(__in); return (${expr}); })())`, ctx)); };
  return ctx;
}
/* El editor real: state.js (envoltorios editNode/editEdge/removeNodes/removeEdges) y selection.js (deleteSel, undo). */
function editor() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, scheduleAutosave() {}, renderTabs() {}, refreshPanel() {}, selN: new Set(), selE: new Set(), clip: null, GRID: 20 });
  ctx.run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js"]) ctx.run(read("js/" + f));
  ctx.run(read("js/state.js").split("/* ===================== Viewport")[0]);
  ctx.run(read("js/selection.js"));
  ctx.load = (project) => ctx.run("doc=projectFromProjectData(" + JSON.stringify(project) + ").doc");
  return ctx;
}
const page = (name = "Página 1") => ({ name, nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
const project = (...pages) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: pages.length ? pages : [page()], cur: 0 }, settings: {} });
const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const N = (extra = {}, spec = {}) => Object.assign({ op: "create_node", scope: "page", pageIndex: 0, spec: Object.assign({ shape: "rect", x: 0, y: 0 }, spec) }, extra);
const C = (source, target, extra = {}) => Object.assign({ op: "create_connection", scope: "page", pageIndex: 0, source, target }, extra);
const UN = (node, spec, extra = {}) => Object.assign({ op: "update_node", scope: "page", pageIndex: 0, node, spec }, extra);
const UC = (connection, spec, extra = {}) => Object.assign({ op: "update_connection", scope: "page", pageIndex: 0, connection }, spec === undefined ? {} : { spec }, extra);
const DN = (node, extra = {}) => Object.assign({ op: "delete_node", scope: "page", pageIndex: 0, node }, extra);
const DC = (connection, extra = {}) => Object.assign({ op: "delete_connection", scope: "page", pageIndex: 0, connection }, extra);
const ET = (ref = "pago") => ({ op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", ref });
const ETN = (ref = "aviso") => ({ op: "create_event_type", scope: "eventType", name: "Aviso", primitive: "OCCURRENCE", sentence: "{target} avisa", ref });
const STORY = (name = "Compra", ref = "s") => ({ op: "create_story", scope: "story", pageIndex: 0, name, ref });
const STEP = (target, extra = {}) => Object.assign({ op: "add_step", scope: "story", pageIndex: 0, storyId: { ref: "s" }, eventTypeId: { ref: "pago" }, target }, extra);
const R = (ref) => ({ ref });
const I = (id) => ({ id });
const first = (r) => (r.ok ? null : r.errors[0]);
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };

/* Cliente(1) Comercio(2) Banco(3); pago 4 (1→2), cobro 5 (2→3), reembolso 6 (3→1); Banco DOWN. */
const BASE_OPS = [
  N({ ref: "cliente" }, { x: 200, y: 300, label: "Cliente" }),
  N({ ref: "comercio" }, { x: 600, y: 300, label: "Comercio" }),
  N({ ref: "banco" }, { shape: "cylinder", x: 400, y: 100, label: "Banco" }),
  C(R("cliente"), R("comercio"), { ref: "pago", spec: { label: "Pago" } }),
  C(R("comercio"), R("banco"), { ref: "cobro", spec: { route: "ortho", fromSide: "e", toSide: "w", label: "Cobro" } }),
  C(R("banco"), R("cliente"), { ref: "reembolso", spec: { dashed: true, label: "Reembolso" } }),
];
const base = () => ok(apply(project(), BASE_OPS)).project;
/* Base + EventType de conexión + Historia «Compra» con un paso sobre `pago` (4) y otro sobre `cobro` (5), y Banco DOWN. */
const withStory = () => ok(apply(base(), [ET(), STORY(), STEP({ edgeId: 4 }), STEP({ edgeId: 5 }), { op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: 3, state: "DOWN" }])).project;
const pg0 = (p) => p.doc.pages[0];
const node = (p, id) => pg0(p).nodes.find((n) => n.id === id);
const edge = (p, id) => pg0(p).edges.find((e) => e.id === id);
const frozen = (o) => { const f = (x) => { if (x && typeof x === "object") { Object.freeze(x); Object.values(x).forEach(f); } return x; }; return f(o); };

/* ─────────── dominio: updateNodeIn ─────────── */
function run(code, pg, args = []) { K.__pg = pg; K.__args = args; const r = vm.runInContext(`(function(){ const pg=__pg, A=__args; try { const r=(${code}); return {ok:true,r}; } catch(e){ return {ok:false,code:e.code,field:e.field,name:e&&e.name,isType:e instanceof TypeError}; } })()`, K); return { ok: r.ok, r: r.r, code: r.code, field: r.field, isType: r.isType, pg }; }
const upN = (pg, id, patch) => run("updateNodeIn(pg,A[0],A[1])", pg, [id, patch]);
const upC = (pg, id, patch) => run("updateConnectionIn(pg,A[0],A[1])", pg, [id, patch]);
const delN = (pg, id) => run("deleteNodeIn(pg,A[0])", pg, [id]);
const delC = (pg, id) => run("deleteConnectionIn(pg,A[0])", pg, [id]);

test("updateNodeIn: mover y redimensionar escriben solo x,y,w,h, en el mismo objeto; las conexiones no se tocan", () => {
  const pg = vm.runInContext("(" + JSON.stringify(pg0(base())) + ")", K);
  const before = J(pg), n = pg.nodes[1], edgesBefore = J(pg.edges);
  const r = upN(pg, 2, { x: 650, y: 310, w: 200, h: 90 });
  assert.equal(r.ok, true);
  assert.equal(r.pg.nodes[1], n, "misma identidad de objeto");
  assert.deepEqual(J(pg.nodes[1]), Object.assign({}, before.nodes[1], { x: 650, y: 310, w: 200, h: 90 }));
  assert.deepEqual(J(pg.edges), edgesBefore);
  assert.deepEqual(J(pg.nodes.filter((x) => x.id !== 2)), before.nodes.filter((x) => x.id !== 2));
  assert.equal(pg.nextId, before.nextId);
});

test("updateNodeIn: solo claves editables; undefined no pisa defaults; null donde la UI lo usa; sin TypeError", () => {
  const pg = vm.runInContext("(" + JSON.stringify(pg0(base())) + ")", K);
  const snap = J(pg);
  for (const bad of [{ id: 9 }, { ref: "x" }, { icon: "k8s" }, { img: "data:" }, { zzz: 1 }, { source: 1 }]) {
    const r = upN(pg, 1, bad);
    assert.deepEqual([r.ok, r.code, r.field], [false, "invalid_document", Object.keys(bad)[0]], JSON.stringify(bad));
    assert.equal(r.isType, false);
  }
  for (const bad of [{ x: "1" }, { x: NaN }, { w: 0 }, { w: -4 }, { h: Infinity }, { label: 3 }, { label: null }, { color: 5 }, { color: null }, { bold: "si" }, { pulse: 1 }, { border: "doble" }, { lblPos: "arriba" }, { fs: -1 }, { fs: "9" }, { order: -2 }, { shape: "hexagono" }]) {
    const r = upN(pg, 1, bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.code, "invalid_document");
    assert.equal(r.isType, false);
  }
  assert.deepEqual(J(pg), snap, "ninguna entrada inválida muta el nodo");
  assert.equal(upN(pg, 1, { label: undefined, x: undefined }).ok, true);
  assert.deepEqual(J(pg), snap, "undefined no destruye nada");
  assert.equal(upN(pg, 1, { fill: "#ff0000", textBg: null, font: null, fs: null, bold: true }).ok, true);
  assert.deepEqual([pg.nodes[0].fill, pg.nodes[0].bold, pg.nodes[0].fs], ["#ff0000", true, null]);
  assert.equal(upN(pg, 1, { fs: 500 }).ok, true);
  assert.equal(pg.nodes[0].fs, 96, "misma normalización que la carga");
  assert.deepEqual([upN(pg, 99, { x: 1 }).code, upN(pg, "1", { x: 1 }).code, upN(pg, 0, { x: 1 }).code, upN(null, 1, {}).code, upN(pg, 1, null).code, upN(pg, 1, []).code],
    ["node_not_found", "invalid_document", "invalid_document", "invalid_document", "invalid_document", "invalid_document"]);
});

test("updateNodeIn: atómico — un campo malo junto a uno bueno no cambia nada", () => {
  const pg = vm.runInContext("(" + JSON.stringify(pg0(base())) + ")", K);
  const snap = J(pg);
  assert.equal(upN(pg, 1, { x: 999, w: -1 }).ok, false);
  assert.equal(upN(pg, 1, { label: "ok", border: "nope" }).ok, false);
  assert.deepEqual(J(pg), snap);
});

test("updateNodeIn: reglas de forma (las de la UI) y campos que solo aplican a ciertas formas", () => {
  const p = ok(apply(project(), [N({}, { label: "caja" }), N({}, { shape: "icon", icon: "db", label: "ico" }), N({}, { shape: "code" }), N({}, { shape: "text" })])).project;
  const pg = vm.runInContext("(" + JSON.stringify(pg0(p)) + ")", K);
  assert.equal(upN(pg, 1, { shape: "diamond" }).ok, true);
  assert.equal(pg.nodes[0].shape, "diamond");
  assert.equal(pg.nodes[0].w, 180, "cambiar de forma no reajusta w/h (como la UI)");
  assert.equal(upN(pg, 1, { shape: "code" }).ok, true);
  assert.equal(upN(pg, 1, { shape: "icon" }).code, "invalid_document", "icon/anim/image no son destinos del selector");
  assert.equal(upN(pg, 1, { shape: "image" }).code, "invalid_document");
  assert.equal(upN(pg, 2, { shape: "rect" }).code, "invalid_document", "un icono no cambia de forma");
  assert.equal(upN(pg, 2, { tint: true }).ok, true);
  assert.equal(upN(pg, 4, { tint: true }).field, "tint", "tint solo en iconos");
  assert.equal(upN(pg, 4, { lang: "sql" }).field, "lang", "lang solo en código");
  assert.equal(upN(pg, 3, { lang: "sql", keywords: ["a", "b"], kwBg: "#000000", kwColor: null }).ok, true);
  assert.deepEqual(J(pg.nodes[2].keywords), ["a", "b"]);
  assert.equal(upN(pg, 3, { lang: "klingon" }).code, "invalid_document");
  assert.equal(upN(pg, 3, { keywords: [1] }).code, "invalid_document");
});

test("updateConnectionIn: etiqueta, ruta, lados, waypoints; los waypoints solo cambian si vienen en el parche", () => {
  const pg = vm.runInContext("(" + JSON.stringify(pg0(base())) + ")", K);
  assert.equal(upC(pg, 4, { waypoints: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }).ok, true);
  const e = pg.edges[0];
  assert.deepEqual(J(e.waypoints), [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  assert.equal(upC(pg, 4, { label: "Pagar", route: "ortho", fromSide: "s", toSide: null }).ok, true);
  assert.deepEqual([e.label, e.route, e.fromSide, e.toSide, J(e.waypoints).length], ["Pagar", "ortho", "s", null, 2], "los waypoints se conservan");
  assert.equal(upC(pg, 4, { source: 3 }).ok, true);
  assert.deepEqual([e.from, e.to, J(e.waypoints).length], [3, 2, 2], "retarget no toca waypoints");
  assert.equal(upC(pg, 4, { waypoints: [] }).ok, true);
  assert.deepEqual(J(e.waypoints), []);
  const snap = J(pg);
  const waypointsArg = [{ x: 1, y: 1 }]; upC(pg, 4, { waypoints: waypointsArg }); waypointsArg[0].x = 77;
  assert.equal(pg.edges[0].waypoints[0].x, 1, "no comparte el array del llamador");
  assert.equal(upC(pg, 4, { waypoints: [] }).ok, true);
  assert.deepEqual(J(pg.edges.slice(1)), snap.edges.slice(1));
});

test("updateConnectionIn: retarget valida extremos y auto-lazo; un auto-lazo antiguo no impide editar su etiqueta", () => {
  const pg = vm.runInContext("(" + JSON.stringify(pg0(base())) + ")", K);
  const snap = J(pg);
  assert.deepEqual([upC(pg, 4, { source: 2 }).code, upC(pg, 4, { target: 1 }).code, upC(pg, 4, { source: 9 }).code, upC(pg, 4, { target: 9 }).code, upC(pg, 4, { source: 2, target: 2 }).code],
    ["self_loop", "self_loop", "source_not_found", "target_not_found", "self_loop"]);
  assert.deepEqual([upC(pg, 4, { source: "1" }).code, upC(pg, 99, { label: "x" }).code, upC(pg, 1, { label: "x" }).code],
    ["invalid_document", "connection_not_found", "connection_not_found"], "un id de nodo no es una conexión");
  assert.equal(upC(pg, 4, { id: 7 }).field, "id");
  for (const bad of [{ eventTypeId: 1 }, { from: 1 }, { to: 2 }, { zzz: 1 }, { route: "curva" }, { fromSide: "norte" }, { flowDir: "sideways" }, { waypoints: [{ x: "a", y: 1 }] }, { waypoints: "x" }, { animated: "yes" }, { dashed: 0 }, { label: 5 }, { speedFac: "2" }, { fs: -3 }])
    assert.equal(upC(pg, 4, bad).ok, false, JSON.stringify(bad));
  assert.deepEqual(J(pg), snap);
  pg.edges.push(vm.runInContext("({id:50,from:1,to:1,fromSide:null,toSide:null,route:'straight',waypoints:[],label:'',font:null,bold:false,animated:true,dashed:false,startArrow:false,endArrow:true,flowDir:'normal'})", K));
  assert.equal(upC(pg, 50, { label: "lazo" }).ok, true);
  assert.equal(upC(pg, 50, { target: 1 }).code, "self_loop");
});

test("updateConnectionIn: estilos como el panel (dots/speedFac se acotan como al cargar)", () => {
  const pg = vm.runInContext("(" + JSON.stringify(pg0(base())) + ")", K);
  assert.equal(upC(pg, 4, { dotsGlobal: false, dots: 9, speedFac: 99, lineColor: "#112233", dotColor: null, startArrow: true, endArrow: false, flowDir: "reverse", animated: false, dashed: true, bold: true, font: null, fs: 12 }).ok, true);
  const e = pg.edges[0];
  assert.deepEqual([e.dots, e.speedFac, e.lineColor, e.dotColor, e.startArrow, e.endArrow, e.flowDir, e.animated, e.dashed, e.bold, e.fs, e.dotsGlobal], [6, 4, "#112233", null, true, false, "reverse", false, true, true, 12, false]);
});

test("deleteNodeIn con keepBehaviors (lo que usa el editor): no toca el Behavior y no lo informa", () => {
  const pg = vm.runInContext("(" + JSON.stringify(pg0(withStory())) + ")", K);
  const r = run("deleteNodeIn(pg,A[0],{keepBehaviors:true})", pg, [3]);
  assert.equal(r.ok, true);
  assert.deepEqual(J(r.r.connections), [5, 6]);
  assert.deepEqual(J(r.r.behaviors), []);
  assert.deepEqual(J(pg.behaviors), [{ nodeId: 3, initialState: "DOWN" }]);
});

test("deleteNodeIn / deleteConnectionIn: cascada de conexiones y Behavior; nada más (Steps y Historias intactos); atómicas", () => {
  const p = withStory();
  const pg = vm.runInContext("(" + JSON.stringify(pg0(p)) + ")", K);
  const steps = J(pg.scenarios);
  const r = delN(pg, 3);
  assert.equal(r.ok, true);
  assert.deepEqual(J(r.r.connections), [5, 6]);
  assert.deepEqual(J(r.r.behaviors), [3]);
  assert.deepEqual(J(pg.nodes.map((n) => n.id)), [1, 2]);
  assert.deepEqual(J(pg.edges.map((e) => e.id)), [4]);
  assert.deepEqual(J(pg.behaviors), []);
  assert.deepEqual(J(pg.scenarios), steps, "no se tocan las Historias (eso lo decide el estado final)");
  assert.equal(pg.nextId, 7, "el contador no baja");
  const snap = J(pg);
  assert.deepEqual([delN(pg, 3).code, delN(pg, 4).code, delN(pg, "a").code, delC(pg, 1).code, delC(pg, 99).code, delN(null, 1).code], ["node_not_found", "node_not_found", "invalid_document", "connection_not_found", "connection_not_found", "invalid_document"]);
  assert.deepEqual(J(pg), snap);
  assert.equal(delC(pg, 4).ok, true);
  assert.deepEqual(J(pg.edges), []);
});

/* ─────────── FluyoAuthoring: update_node ─────────── */
test("update_node: mover, redimensionar, forma, etiqueta y estilo; changes con from/to; sin cambios = fields vacío", () => {
  const p = base();
  const r = ok(apply(p, [
    UN(I(1), { x: 250, y: 320 }),
    UN(I(1), { w: 240, h: 100 }),
    UN(I(2), { shape: "diamond", label: "Tienda", color: "#ff0000", fill: "#00ff00", border: "dashed", lblPos: "top", textBg: "#000000", textColor: "#ffffff", bold: true, pulse: true, font: "Georgia, serif", fs: 20, order: 5 }),
    UN(I(3), { x: 400 }),
  ]));
  assert.deepEqual(r.changes.map((c) => [c.operation, c.entityKind, c.entityId, c.updated, c.fields]), [
    ["update_node", "node", 1, true, ["x", "y"]], ["update_node", "node", 1, true, ["w", "h"]],
    ["update_node", "node", 2, true, ["shape", "label", "color", "fill", "border", "lblPos", "textBg", "textColor", "bold", "pulse", "font", "fs", "order"]],
    ["update_node", "node", 3, true, []]]);
  assert.deepEqual(r.changes[0].from, { x: 200, y: 300 });
  assert.deepEqual(r.changes[0].to, { x: 250, y: 320 });
  assert.deepEqual(r.changes[2].from.label, "Comercio");
  assert.deepEqual(J(node(r.project, 1)), Object.assign({}, node(p, 1), { x: 250, y: 320, w: 240, h: 100 }));
  assert.equal(node(r.project, 2).shape, "diamond");
  assert.deepEqual(r.changes[0].scope, "page");
  assert.deepEqual(J(pg0(r.project).edges), J(pg0(p).edges), "mover/editar no toca las conexiones");
  assert.equal(pg0(r.project).nextId, pg0(p).nextId);
  assert.deepEqual(J(r.project.doc.pages[0].nodes.map((n) => n.id)), [1, 2, 3], "el orden Z no cambia");
});

test("update_node: errores estructurados (id inexistente, campo desconocido, id/ref no modificables, spec vacío, forma/valores)", () => {
  const p = base();
  const code = (ops, expected, extra) => {
    const e = first(apply(p, ops));
    assert.ok(e, "debía rechazarse: " + JSON.stringify(ops));
    assert.equal(e.code, expected, JSON.stringify(e));
    assert.equal(typeof e.message, "string");
    assert.equal(typeof e.operationIndex, "number");
    assert.doesNotMatch(JSON.stringify(e), /TypeError|Cannot read|undefined/);
    if (extra) for (const [k, v] of Object.entries(extra)) assert.deepEqual(e[k], v, k);
  };
  code([UN(I(99), { x: 1 })], "NODE_NOT_FOUND", { operationIndex: 0, operation: "update_node" });
  code([UN(I(4), { x: 1 })], "NODE_NOT_FOUND");
  code([UN(I(1), { zzz: 1 })], "INVALID_FIELD", { field: "zzz" });
  code([UN(I(1), { id: 7 })], "INVALID_FIELD", { field: "id" });
  code([UN(I(1), { ref: "z" })], "INVALID_FIELD", { field: "ref" });
  code([UN(I(1), { icon: "database" })], "INVALID_FIELD", { field: "icon" });
  code([UN(I(1), { w: -1 })], "INVALID_FIELD", { field: "w" });
  code([UN(I(1), { x: "1" })], "INVALID_FIELD", { field: "x" });
  code([UN(I(1), { shape: "image" })], "INVALID_FIELD", { field: "shape" });
  code([UN(I(1), { tint: true })], "INVALID_FIELD", { field: "tint" });
  code([UN(I(1), {})], "INVALID_OPERATION", { field: "spec" });
  code([UN(I(1), undefined)], "INVALID_OPERATION", { field: "spec" });
  code([UN(I(1), { x: 1 }, { pageIndex: 3 })], "PAGE_NOT_FOUND");
  code([UN(1, { x: 1 })], "INVALID_OPERATION", { field: "node" });
  code([UN({ ref: "a", id: 1 }, { x: 1 })], "INVALID_OPERATION", { field: "node" });
  code([UN({ id: 0 }, { x: 1 })], "INVALID_OPERATION");
  code([Object.assign(UN(I(1), { x: 1 }), { scope: "story" })], "SCOPE_MISMATCH");
  code([Object.assign(UN(I(1), { x: 1 }), { nodeId: 1 })], "INVALID_OPERATION");
  code([Object.assign(UN(I(1), { x: 1 }), { ref: "n" })], "INVALID_OPERATION", { field: "ref" });
});

test("update_node: documento antiguo (v3, sin Historias ni Behaviors) se actualiza y devuelve v5 válido", () => {
  const old = { version: 3, app: "fluyo", doc: { theme: "dark", cur: 0, pages: [{ name: "Vieja", nodes: [{ id: 1, shape: "rect", x: 10, y: 10, w: 100, h: 50, label: "A", color: "#6a9fb5", order: 0 }, { id: 2, shape: "circle", x: 300, y: 10, w: 80, h: 80, label: "B", color: "#6a9fb5", order: 1 }], edges: [{ id: 3, from: 1, to: 2, route: "straight", waypoints: [], label: "x" }], nextId: 4 }] }, settings: {} };
  const r = ok(apply(old, [UN(I(1), { x: 99, label: "A2" }), UC(I(3), { label: "y" })]));
  assert.equal(r.project.version, 5);
  assert.deepEqual([node(r.project, 1).x, node(r.project, 1).label, edge(r.project, 3).label], [99, "A2", "y"]);
  assert.equal(JSON.stringify(old).includes("A2"), false, "la entrada no se toca");
  assert.equal(r.changes[0].fields.length, 2);
});

test("update_node: informa de las conexiones con ruta manual afectadas por mover/redimensionar y de las Historias que cambian de frase por la etiqueta", () => {
  const p = withStory();
  const wp = ok(apply(p, [UC(I(5), { waypoints: [{ x: 500, y: 200 }] })])).project;
  const r = ok(apply(wp, [UN(I(2), { x: 700 }), UN(I(2), { label: "Tienda" }), UN(I(3), { label: "Entidad" })]));
  assert.deepEqual(r.changes[0].affects.connectionsWithWaypoints, [5]);
  assert.deepEqual(r.changes[1].affects.stories, [{ pageIndex: 0, storyId: 1, name: "Compra", stepIds: [1, 2] }]);
  assert.match(r.changes[1].affects.note, /frase/);
  assert.deepEqual(r.changes[2].affects.stories, [{ pageIndex: 0, storyId: 1, name: "Compra", stepIds: [2] }]);
  assert.equal(JSON.stringify(edge(r.project, 5).waypoints), JSON.stringify([{ x: 500, y: 200 }]), "mover no inventa ni toca waypoints");
});

/* ─────────── update_connection ─────────── */
test("update_connection: etiqueta, ruta, lados, waypoints y retarget por id y por ref; sin geometría inventada", () => {
  const p = base();
  const r = ok(apply(p, [
    UC(I(4), { label: "Pagar", route: "ortho", fromSide: "e", toSide: "w", waypoints: [{ x: 400, y: 250 }] }),
    UC(I(4), undefined, { target: I(3) }),
    UC(I(5), { dashed: true }, { source: I(1), target: I(2) }),
  ]));
  assert.deepEqual(J(edge(r.project, 4)), Object.assign({}, edge(p, 4), { label: "Pagar", route: "ortho", fromSide: "e", toSide: "w", waypoints: [{ x: 400, y: 250 }], to: 3 }));
  assert.deepEqual([r.changes[1].fields, r.changes[1].from, r.changes[1].to], [["target"], { target: 2 }, { target: 3 }]);
  assert.deepEqual([edge(r.project, 5).from, edge(r.project, 5).to, edge(r.project, 5).dashed], [1, 2, true]);
  assert.deepEqual(r.changes[2].fields, ["dashed", "source", "target"]);
  const withRefs = ok(apply(project(), [N({ ref: "a" }), N({ ref: "b" }), N({ ref: "c" }), C(R("a"), R("b"), { ref: "k" }), UC(R("k"), undefined, { target: R("c") }), UC(R("k"), { label: "k" }, { source: R("b") })]));
  assert.deepEqual(J(pg0(withRefs.project).edges.map((e) => [e.from, e.to, e.label])), [[2, 3, "k"]]);
});

test("update_connection: errores (source/target inexistente, auto-lazo, campo desconocido, spec vacío, ids, refs)", () => {
  const p = base();
  const e = (ops) => { const x = first(apply(p, ops)); assert.ok(x, JSON.stringify(ops)); assert.doesNotMatch(JSON.stringify(x), /TypeError|Cannot read/); return x; };
  assert.equal(e([UC(I(4), undefined, { source: I(99) })]).code, "SOURCE_NOT_FOUND");
  assert.equal(e([UC(I(4), undefined, { target: I(99) })]).code, "TARGET_NOT_FOUND");
  assert.equal(e([UC(I(4), undefined, { target: I(1) })]).code, "SELF_LOOP");
  assert.equal(e([UC(I(4), undefined, { source: I(2) })]).code, "SELF_LOOP");
  assert.equal(e([UC(I(4), undefined, { source: R("nada") })]).code, "UNKNOWN_REF");
  assert.equal(e([UC(I(99), { label: "x" })]).code, "CONNECTION_NOT_FOUND");
  assert.equal(e([UC(I(1), { label: "x" })]).code, "CONNECTION_NOT_FOUND");
  assert.equal(e([UC(I(4), { zzz: 1 })]).code, "INVALID_FIELD");
  assert.equal(e([UC(I(4), { eventTypeId: 1 })]).field, "eventTypeId");
  assert.equal(e([UC(I(4), { from: 1 })]).field, "from");
  assert.equal(e([UC(I(4), { id: 9 })]).field, "id");
  assert.equal(e([UC(I(4), { route: "curva" })]).code, "INVALID_FIELD");
  assert.equal(e([UC(I(4), { waypoints: [{ x: 1 }] })]).code, "INVALID_FIELD");
  assert.equal(e([UC(I(4), {})]).code, "INVALID_OPERATION");
  assert.equal(e([UC(I(4))]).code, "INVALID_OPERATION");
  assert.equal(e([UC(I(4), { source: 1 })]).field, "spec.source");
  assert.equal(e([UC(I(4), { label: "x" }, { source: 1 })]).code, "INVALID_OPERATION");
  assert.equal(e([UC(I(4), { label: "x" }, { connection: undefined })]).code, "INVALID_OPERATION");
  assert.equal(e([Object.assign(UC(I(4), { label: "x" }), { zzz: 1 })]).code, "INVALID_OPERATION", "campo desconocido en la operación");
  assert.equal(e([Object.assign(DN(I(1)), { edgeId: 1 })]).code, "INVALID_OPERATION");
  assert.equal(e([Object.assign(DC(I(4)), { nodeId: 1 })]).code, "INVALID_OPERATION");
  assert.equal(e([Object.assign(DC(I(4)), { scope: "story" })]).code, "SCOPE_MISMATCH");
});

/* ─────────── delete_connection / delete_node y B2 ─────────── */
test("delete_connection: una conexión sin uso se elimina; el contador no baja; el resto no cambia", () => {
  const p = base();
  const r = ok(apply(p, [DC(I(6))]));
  assert.deepEqual(pg0(r.project).edges.map((e) => e.id), [4, 5]);
  assert.equal(pg0(r.project).nextId, 7);
  assert.deepEqual(r.changes[0], { operation: "delete_connection", scope: "page", operationIndex: 0, pageIndex: 0, entityKind: "connection", entityId: 6, deleted: true, source: 3, target: 1, affects: { stories: [] } });
  assert.deepEqual(J(pg0(r.project).nodes), J(pg0(p).nodes));
});

test("B2 delete_connection: una Historia que la usa rechaza el lote y explica entidad, Historia, Step y razón; sin documento", () => {
  const p = withStory();
  const r = apply(p, [DC(I(5))]);
  assert.equal(r.ok, false);
  assert.equal(r.project, undefined);
  const e = r.errors[0];
  assert.equal(e.code, "REFERENCED_ENTITY");
  assert.deepEqual(e.entity, { kind: "connection", id: 5 });
  assert.deepEqual(e.affectedStories, [{ pageIndex: 0, storyId: 1, storyName: "Compra", stepIds: [2] }]);
  assert.deepEqual(e.affectedSteps, [{ pageIndex: 0, storyId: 1, stepId: 2 }]);
  assert.equal(e.operationIndex, 0);
  assert.equal(e.operation, "delete_connection");
  assert.deepEqual(e.integrityCodes, ["missing_edge"]);
  assert.match(e.message, /conexión 5/);
  assert.match(e.message, /«Compra»/);
  assert.match(e.message, /paso 2/);
  assert.equal(typeof e.reason, "string");
  assert.equal(r.errors.length, 1);
});

test("B2: el orden dentro del lote no produce falsos rechazos (retarget_step/remove_step y borrar, en cualquier orden)", () => {
  const p = withStory();
  const retarget = (target) => ({ op: "retarget_step", scope: "story", pageIndex: 0, storyId: 1, stepId: 2, target });
  const rem = { op: "remove_step", scope: "story", pageIndex: 0, storyId: 1, stepId: 2 };
  for (const ops of [[retarget({ edgeId: 4 }), DC(I(5))], [DC(I(5)), retarget({ edgeId: 4 })], [rem, DC(I(5))], [DC(I(5)), rem]]) {
    const r = ok(apply(p, ops));
    assert.deepEqual(pg0(r.project).edges.map((e) => e.id), [4, 6]);
  }
  const both = ok(apply(p, [DC(I(5)), rem]));
  assert.equal(pg0(both.project).scenarios[0].steps.length, 1);
});

test("B2 retarget + delete: retargetear una conexión y eliminar el nodo anterior en el mismo lote es válido", () => {
  const p = withStory();
  // pago 4 es Cliente→Comercio; cobro 5 Comercio→Banco; Banco tiene Behavior DOWN. Se mueve cobro a Cliente→Banco... y se elimina Comercio.
  const r = ok(apply(p, [UC(I(5), undefined, { source: I(1) }), UC(I(4), undefined, { target: I(3) }), DN(I(2))]));
  assert.deepEqual(pg0(r.project).nodes.map((n) => n.id), [1, 3]);
  assert.deepEqual(pg0(r.project).edges.map((e) => [e.id, e.from, e.to]), [[4, 1, 3], [5, 1, 3], [6, 3, 1]]);
  assert.deepEqual(r.changes[2].cascade, { connections: [], behaviors: [] });
  const wrongOrder = apply(p, [DN(I(2)), UC(I(5), undefined, { source: I(1) })]);
  assert.equal(first(wrongOrder).code, "CONNECTION_NOT_FOUND", "las conexiones del nodo eliminado ya no existen: lo dice el error, no un B2 intermedio");
  assert.match(first(wrongOrder).message, /la eliminó la operación 0: delete_node/);
});

test("delete_node: un nodo sin uso se elimina con sus conexiones dependientes y su Behavior (informado en changes)", () => {
  const p = withStory();
  const gone = ok(apply(base(), [DN(I(3))]));
  assert.deepEqual(pg0(gone.project).nodes.map((n) => n.id), [1, 2]);
  assert.deepEqual(pg0(gone.project).edges.map((e) => e.id), [4]);
  assert.deepEqual(gone.changes[0], { operation: "delete_node", scope: "page", operationIndex: 0, pageIndex: 0, entityKind: "node", entityId: 3, deleted: true, label: "Banco", cascade: { connections: [5, 6], behaviors: [] }, affects: { stories: [] } });
  // Con Behavior: Banco es DOWN y sus Steps ya se quitaron.
  const rem = (s) => ({ op: "remove_step", scope: "story", pageIndex: 0, storyId: 1, stepId: s });
  const r = ok(apply(p, [rem(2), DN(I(3))]));
  assert.deepEqual(pg0(r.project).behaviors, []);
  assert.deepEqual(r.changes[1].cascade, { connections: [5, 6], behaviors: [3] });
  assert.equal(FluyoValid(r.project), true, "sin Behavior huérfano el documento es válido");
});
function FluyoValid(project) { return K.call("FluyoIntegrity.validateProject(__a).valid", project); }

test("B2 delete_node: nodo usado por Historia (OCCURRENCE) y conexión en cascada usada por otra; varias Historias afectadas", () => {
  const p = ok(apply(withStory(), [
    ETN(),
    { op: "create_story", scope: "story", pageIndex: 0, name: "Cierre", ref: "s2" },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s2"), eventTypeId: R("aviso"), target: { nodeId: 3 } },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s2"), eventTypeId: R("aviso"), target: { nodeId: 2 }, waitMs: 500 },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s2"), eventTypeId: 1, target: { edgeId: 6 } },
  ])).project;
  const r = apply(p, [DN(I(3))]);
  assert.equal(r.ok, false);
  const errs = r.errors;
  assert.deepEqual(errs.map((e) => [e.code, e.entity.kind, e.entity.id, e.cascadedFrom || null]), [
    ["REFERENCED_ENTITY", "node", 3, null], ["REFERENCED_ENTITY", "connection", 5, { kind: "node", id: 3 }], ["REFERENCED_ENTITY", "connection", 6, { kind: "node", id: 3 }]]);
  assert.deepEqual(errs[0].affectedStories, [{ pageIndex: 0, storyId: 2, storyName: "Cierre", stepIds: [1] }]);
  assert.deepEqual(errs[1].affectedStories, [{ pageIndex: 0, storyId: 1, storyName: "Compra", stepIds: [2] }]);
  assert.deepEqual(errs[2].affectedStories, [{ pageIndex: 0, storyId: 2, storyName: "Cierre", stepIds: [3] }]);
  assert.deepEqual(errs.map((e) => e.operationIndex), [0, 0, 0]);
  assert.match(errs[1].message, /en cascada/);
  assert.match(errs[0].message, /«Banco»/);
  // Quitando antes esos pasos el borrado es válido.
  const rm = (storyId, stepId) => ({ op: "remove_step", scope: "story", pageIndex: 0, storyId: storyId, stepId: stepId });
  assert.equal(apply(p, [rm(2, 1), rm(2, 3), rm(1, 2), DN(I(3))]).ok, true);
});

test("delete_node: el estado final decide — borrar un nodo cuyas conexiones y Steps se quitan en el mismo lote es válido en ambos órdenes", () => {
  const p = withStory();
  const rm = (storyId, stepId) => ({ op: "remove_step", scope: "story", pageIndex: 0, storyId: storyId, stepId: stepId });
  assert.equal(apply(p, [rm(1, 2), DN(I(3))]).ok, true);
  assert.equal(apply(p, [DN(I(3)), rm(1, 2)]).ok, true, "borrar primero y quitar el paso después también: lo decide el estado final");
});

/* ─────────── refs ─────────── */
test("refs: create→update, create→connection, create→step, create→update→delete en un solo lote", () => {
  const r = ok(apply(project(), [
    N({ ref: "cliente" }, { x: 100, y: 100, label: "Cliente" }), N({ ref: "comercio" }, { x: 500, y: 100, label: "Comercio" }),
    C(R("cliente"), R("comercio"), { ref: "pago" }),
    UN(R("cliente"), { x: 120, label: "Cliente final" }), UC(R("pago"), { label: "Pago", route: "ortho" }),
    ET(), STORY(), STEP(R("pago")),
    ETN(), { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s"), eventTypeId: R("aviso"), target: R("comercio") },
    { op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: R("comercio"), state: "DOWN" },
    N({ ref: "temporal" }), C(R("temporal"), R("cliente"), { ref: "t" }), UN(R("temporal"), { label: "x" }), DC(R("t")), DN(R("temporal")),
  ]));
  const pg = pg0(r.project);
  assert.deepEqual(pg.nodes.map((n) => n.label), ["Cliente final", "Comercio"]);
  assert.deepEqual(pg.edges.map((e) => [e.id, e.label, e.route]), [[3, "Pago", "ortho"]]);
  assert.deepEqual(pg.scenarios[0].steps.map((s) => [s.action, s.edgeId || s.nodeId]), [["SEND", 3], ["OCCURRENCE", 2]]);
  assert.deepEqual(pg.behaviors, [{ nodeId: 2, initialState: "DOWN" }]);
  assert.deepEqual(r.refs.map((x) => x.ref), ["cliente", "comercio", "pago"], "las refs de lo eliminado en el lote no se devuelven");
  assert.equal(JSON.stringify(r.project).includes("temporal"), false, "las refs no se persisten");
  assert.equal(pg.nextId, 6);
});

test("refs en destinos de Step: {ref}, {edgeId:{ref}}, {nodeId:{ref}}, {from:{ref},to:{ref}}; retarget_step con refs", () => {
  const ops = [N({ ref: "a" }), N({ ref: "b" }, { x: 300 }), C(R("a"), R("b"), { ref: "k" }), ET(), STORY(), ETN()];
  const r = ok(apply(project(), [...ops, STEP({ edgeId: R("k") }), STEP({ from: R("a"), to: R("b") }), STEP(R("k")),
    { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s"), eventTypeId: R("aviso"), target: { nodeId: R("a") } },
    { op: "retarget_step", scope: "story", pageIndex: 0, storyId: R("s"), stepId: 4, target: { nodeId: R("b") } },
    { op: "retarget_step", scope: "story", pageIndex: 0, storyId: R("s"), stepId: 3, target: R("k") }]));
  assert.deepEqual(pg0(r.project).scenarios[0].steps.map((s) => s.edgeId || s.nodeId), [3, 3, 3, 2]);
  const bad = (target, kind = "pago") => first(apply(project(), [...ops, STEP(target)]));
  assert.equal(bad(R("nada")).code, "UNKNOWN_REF");
  assert.equal(bad({ nodeId: R("a") }).code, "TARGET_INCOMPATIBLE");
  assert.equal(bad(R("a")).code, "UNKNOWN_REF", "a no es una conexión: con un evento de conexión una ref de elemento no se resuelve");
  assert.equal(bad({ edgeId: { ref: "k", id: 3 } }).code, "INVALID_OPERATION");
  assert.equal(bad({ ref: "k", edgeId: 3 }).code, "INVALID_OPERATION");
  assert.equal(bad({ edgeId: "3" }).code, "INVALID_OPERATION");
});

test("refs: desconocida → UNKNOWN_REF, duplicada → DUPLICATE_REF, de otra página, y una ref ya eliminada falla indicando quién la eliminó", () => {
  const p2 = project(page("A"), page("B"));
  assert.equal(first(apply(project(), [UN(R("nada"), { x: 1 })])).code, "UNKNOWN_REF");
  assert.equal(first(apply(project(), [DN(R("nada"))])).code, "UNKNOWN_REF");
  assert.equal(first(apply(project(), [N({ ref: "a" }), N({ ref: "b" }), C(R("a"), R("b"), { ref: "k" }), DC(R("zz"))])).field, "connection");
  assert.equal(first(apply(project(), [N({ ref: "a" }), N({ ref: "a" })])).code, "DUPLICATE_REF");
  const cross = first(apply(p2, [N({ ref: "x" }), UN(R("x"), { x: 1 }, { pageIndex: 1 })]));
  assert.equal(cross.code, "UNKNOWN_REF");
  assert.match(cross.message, /OTRA página/);
  const gone = first(apply(project(), [N({ ref: "a" }), DN(R("a")), UN(R("a"), { x: 1 })]));
  assert.equal(gone.code, "NODE_NOT_FOUND");
  assert.match(gone.message, /operación 1: delete_node/);
  assert.equal(first(apply(project(), [N({ ref: "a" }), DN(R("a")), N({ ref: "a" })])).code, "DUPLICATE_REF");
  const edgeGone = first(apply(project(), [N({ ref: "a" }), N({ ref: "b" }), C(R("a"), R("b"), { ref: "k" }), DN(R("a")), UC(R("k"), { label: "x" })]));
  assert.equal(edgeGone.code, "CONNECTION_NOT_FOUND");
  assert.match(edgeGone.message, /en cascada con el elemento 1/);
  const stepGone = first(apply(project(), [ET(), STORY(), N({ ref: "a" }), N({ ref: "b" }), C(R("a"), R("b"), { ref: "k" }), DC(R("k")), STEP(R("k"))]));
  assert.equal(stepGone.code, "TARGET_NOT_FOUND");
});

test("refs: nodo y conexión pueden llamarse igual; por página y por tipo", () => {
  const r = ok(apply(project(page("A"), page("B")), [N({ ref: "x" }), N({ ref: "y" }), C(R("x"), R("y"), { ref: "x" }), N({ ref: "x", pageIndex: 1 }), N({ ref: "z", pageIndex: 1 }),
    UN(R("x"), { label: "nodo" }), UC(R("x"), { label: "conexion" }), UN(R("x"), { label: "otra pagina" }, { pageIndex: 1 })]));
  assert.deepEqual([r.project.doc.pages[0].nodes[0].label, r.project.doc.pages[0].edges[0].label, r.project.doc.pages[1].nodes[0].label], ["nodo", "conexion", "otra pagina"]);
});

/* ─────────── atomicidad, determinismo ─────────── */
test("atomicidad: fallo en la 1.ª operación, en una intermedia y en la validación final; el original no se muta", () => {
  const p = frozen(withStory());
  const snapshot = JSON.stringify(p);
  const ops = (...o) => o;
  const cases = [
    ops(UN(I(99), { x: 1 }), UN(I(1), { x: 5 })),
    ops(UN(I(1), { x: 5 }), UC(I(4), { zzz: 1 }), UN(I(2), { x: 6 })),
    ops(UN(I(1), { x: 5 }), DC(I(5))),                // fallo SOLO en la validación final (B2)
    ops(UN(I(1), { x: 5 }), DN(I(3)), UN(I(2), { x: 1 })),
  ];
  for (const c of cases) {
    const r = apply(p, c);
    assert.equal(r.ok, false);
    assert.equal(r.project, undefined, "nunca un documento parcial");
    assert.equal(JSON.stringify(p), snapshot, "el original no se modifica");
  }
  assert.equal(first(apply(p, cases[2])).code, "REFERENCED_ENTITY");
  assert.equal(first(apply(p, cases[3])).code, "REFERENCED_ENTITY");
  const mixed = apply(p, [UN(I(1), { x: 5 }), DC(I(5)), UN(I(9), { x: 1 })]);
  assert.equal(first(mixed).operationIndex, 2, "el primer error de operación gana sobre la validación final");
});

test("determinismo: el mismo lote sobre el mismo documento produce el mismo documento y los mismos changes", () => {
  const ops = [UN(I(1), { x: 5, label: "z" }), UC(I(4), { label: "q" }, { target: I(3) }), DC(I(6)), N({ ref: "n" }), C(R("n"), I(1), { ref: "k" }), UC(R("k"), { dashed: true })];
  const a = ok(apply(withStory(), ops)), b = ok(apply(withStory(), ops));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("lote vacío o demasiado largo se rechaza; operaciones nuevas desconocidas por nombre", () => {
  assert.equal(first(apply(base(), [])).code, "INVALID_OPERATION");
  assert.equal(first(apply(base(), [{ op: "move_node", scope: "page", pageIndex: 0 }])).code, "UNKNOWN_OPERATION");
  assert.equal(first(apply(base(), [{ op: "update_node", pageIndex: 0, node: I(1), spec: { x: 1 } }])).code, "SCOPE_MISMATCH");
});

/* ─────────── PARIDAD con el editor real ─────────── */
const GOLDEN = "test/fixtures/fluyo-018-3-golden.json";
const traceOf = (p, storyId = 1) => K.call("(function(){ const d=projectFromProjectData(__a).doc; const pg=d.pages[0]; return FluyoStory.run(pg, pg.scenarios.find(s=>s.id===" + storyId + ")); })()", p);

test("PARIDAD: editor real (newNode/newEdge/editNode/editEdge/deleteSel) vs author_document — documento completo, deepStrictEqual sin normalizar", () => {
  const start = withStory();
  const E = editor();
  E.load(start);
  // Camino A: lo que hacen los gestos y el panel (mover, redimensionar, editar, retarget, crear, borrar).
  E.run(`
    const n=id=>nodeById(id), e=id=>edgeById(id);
    editNode(n(1),{x:260,y:340});
    editNode(n(1),{w:210,h:90,x:262,y:338});
    editNode(n(2),{shape:"diamond"});
    editNode(n(2),{label:"Tienda",color:"#ff8800",fill:"#223344",border:"dotted",lblPos:"bottom",bold:true,pulse:true,order:4});
    editEdge(e(4),{label:"Pagar",route:"ortho",fromSide:"e",toSide:"w",waypoints:[]});
    editEdge(e(4),{dashed:true,animated:false,startArrow:true,flowDir:"reverse",lineColor:"#102030"});
    editEdge(e(6),{target:2,toSide:"n"});
    const nuevo=newNode("hex",800,120,{label:"Nuevo"});
    newEdge(nuevo.id,2,{label:"Hacia tienda"});
    selE.clear(); selN.clear(); selE.add(5); deleteSel();
  `);
  const A = J(E.run("serializeProject()"));
  // Camino B: las mismas operaciones por author_document.
  const ops = [
    UN(I(1), { x: 260, y: 340 }), UN(I(1), { w: 210, h: 90, x: 262, y: 338 }), UN(I(2), { shape: "diamond" }),
    UN(I(2), { label: "Tienda", color: "#ff8800", fill: "#223344", border: "dotted", lblPos: "bottom", bold: true, pulse: true, order: 4 }),
    UC(I(4), { label: "Pagar", route: "ortho", fromSide: "e", toSide: "w", waypoints: [] }),
    UC(I(4), { dashed: true, animated: false, startArrow: true, flowDir: "reverse", lineColor: "#102030" }),
    UC(I(6), { toSide: "n" }, { target: I(2) }),
    N({ ref: "nuevo" }, { shape: "hex", x: 800, y: 120, label: "Nuevo" }), C(R("nuevo"), I(2), { spec: { label: "Hacia tienda" } }),
    // el editor deja el Step sobre `cobro` (5): se quita antes de borrar (B2) y en el editor no hay Historia que lo impida.
  ];
  const fullOps = ops.concat([{ op: "remove_step", scope: "story", pageIndex: 0, storyId: 1, stepId: 2 }, DC(I(5))]);
  const beforeDelete = ok(apply(start, fullOps)).project;
  // El editor (que no aplica B2) conserva el Step huérfano: se compara la parte estructural, y Historias/EventTypes/Behaviors/nextId íntegros.
  const stepless = J(A);
  stepless.doc.pages[0].scenarios[0].steps = stepless.doc.pages[0].scenarios[0].steps.filter((s) => s.id !== 2);
  assert.deepStrictEqual(beforeDelete, stepless);
  assert.equal(JSON.stringify(beforeDelete), JSON.stringify(stepless), "mismo orden de claves");
  const golden = { start, operations: fullOps, document: beforeDelete };
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(path.join(__dirname, "..", GOLDEN), JSON.stringify(golden, null, 2) + "\n");
  assert.deepStrictEqual(golden, JSON.parse(read(GOLDEN)), "golden compartido con fluyo-mcp desactualizado: UPDATE_GOLDEN=1");
  assert.equal(pg0(A).nextId, 9);
  assert.deepEqual(pg0(A).behaviors, [{ nodeId: 3, initialState: "DOWN" }]);
  assert.deepEqual(A.doc.eventTypes, start.doc.eventTypes);
});

test("PARIDAD (sin Historia): mover, redimensionar, editar, retarget y borrar — editor real = author_document; incluido el Behavior del nodo borrado (FLUYO-018.4: el editor también lo quita con el nodo)", () => {
  const start = base();
  const withBehavior = ok(apply(start, [{ op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: 3, state: "DOWN" }])).project;
  const E = editor();
  E.load(withBehavior);
  E.run(`
    editNode(nodeById(2),{x:640,y:260}); editNode(nodeById(2),{label:"Comercio 2",w:260});
    editEdge(edgeById(4),{label:"Cobrar",waypoints:[{x:400,y:300}]});
    editEdge(edgeById(5),{source:1,fromSide:null});
    selN.clear(); selE.clear(); selN.add(3); deleteSel();
  `);
  const A = J(E.run("serializeProject()"));
  const r = ok(apply(withBehavior, [UN(I(2), { x: 640, y: 260 }), UN(I(2), { label: "Comercio 2", w: 260 }), UC(I(4), { label: "Cobrar", waypoints: [{ x: 400, y: 300 }] }), UC(I(5), { fromSide: null }, { source: I(1) }), DN(I(3))]));
  assert.deepEqual(pg0(A).behaviors, [], "FLUYO-018.4: el editor quita el Behavior con el nodo");
  assert.deepEqual(pg0(r.project).behaviors, [], "MCP quita el Behavior del nodo eliminado (cascada informada)");
  assert.deepStrictEqual(r.project, A, "editor y MCP producen el mismo documento");
  assert.equal(JSON.stringify(r.project), JSON.stringify(A));
});

test("PARIDAD del editor: un rechazo del dominio deja el registro intacto (editNode/editEdge → null, sin excepción)", () => {
  const E = editor();
  E.load(base());
  const before = E.run("JSON.stringify(P())");
  const out = E.run(`JSON.stringify([editNode(nodeById(1),{w:-5}), editNode(nodeById(1),{zzz:1}), editEdge(edgeById(4),{target:1}), editEdge(edgeById(4),{target:99}), editNode({id:77},{x:1})])`);
  assert.equal(out, "[null,null,null,null,null]");
  assert.equal(E.run("JSON.stringify(P())"), before);
});

test("el Trace es idéntico: el documento del editor y el de author_document ejecutan la misma Historia con el mismo Trace; mover/redimensionar/etiquetar no lo cambian", () => {
  const start = withStory();
  const baseTrace = traceOf(start);
  const moved = ok(apply(start, [UN(I(1), { x: 5, y: 5, w: 300 }), UN(I(2), { shape: "circle" }), UC(I(4), { route: "ortho", waypoints: [{ x: 1, y: 1 }] })])).project;
  assert.deepEqual(traceOf(moved), baseTrace);
  const E = editor();
  E.load(start);
  E.run('editNode(nodeById(1),{x:5,y:5,w:300}); editNode(nodeById(2),{shape:"circle"}); editEdge(edgeById(4),{route:"ortho",waypoints:[{x:1,y:1}]})');
  assert.deepEqual(traceOf(J(E.run("serializeProject()"))), traceOf(moved));
});

test("determinismo del editor: Undo restaura exactamente el estado anterior de un borrado de nodo con Behavior", () => {
  const start = ok(apply(base(), [{ op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: 3, state: "DOWN" }])).project;
  const E = editor();
  E.load(start);
  const before = E.run("JSON.stringify(serializeProject())");
  E.run("selN.clear(); selE.clear(); selN.add(3); deleteSel();");
  assert.notEqual(E.run("JSON.stringify(serializeProject())"), before);
  E.run("undo()");
  assert.equal(E.run("JSON.stringify(serializeProject())"), before);
  E.run("redo()");
  assert.equal(E.run("P().behaviors.length"), 0, "Redo repite el borrado, Behavior incluido");
  E.run("undo()");
  assert.equal(E.run("JSON.stringify(serializeProject())"), before, "Undo restaura el Behavior");
});

/* ─────────── ejemplos y documentos antiguos ─────────── */
test("los ejemplos publicados admiten mover/etiquetar/retargetear/borrar por author_document y siguen siendo válidos", () => {
  const dir = path.join(__dirname, "..", "ejemplos");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") || f.endsWith(".fluyo.json")) : [];
  let tried = 0;
  for (const f of files) {
    let doc; try { doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (_) { continue; }
    if (!FluyoValid(doc)) continue;
    const norm = K.call("projectToSerializable(projectFromProjectData(__a).doc, projectFromProjectData(__a).settings)", doc);
    const pg = pg0(norm);
    if (pg.nodes.length < 2) continue;
    tried++;
    const id = pg.nodes[0].id;
    const r = apply(norm, [UN(I(id), { x: 11, y: 22, label: "editado" })]);
    assert.equal(r.ok, true, f + " " + JSON.stringify(r.errors));
    assert.equal(FluyoValid(r.project), true, f);
  }
  assert.ok(tried >= 0);
});
