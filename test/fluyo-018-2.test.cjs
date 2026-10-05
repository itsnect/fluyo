"use strict";
/* FLUYO-018.2 — FluyoAuthoring: create_node / create_connection (alcance «page») sobre createNodeIn / createConnectionIn (model.js).
   Aquí: refs del lote acotadas por página, errores estructurados, atomicidad y PARIDAD con el editor real (documento completo,
   sin normalizar). El golden de paridad se comparte con fluyo-mcp (test/fluyo-018-2.test.ts). */
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
function editor() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, scheduleAutosave() {}, renderTabs() {}, refreshPanel() {}, selN: new Set(), selE: new Set(), clip: null });
  ctx.run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js"]) ctx.run(read("js/" + f));
  ctx.run(read("js/state.js").split("/* ===================== Viewport")[0]);
  return ctx;
}
const page = (name = "Página 1") => ({ name, nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
const project = (...pages) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: pages.length ? pages : [page()], cur: 0 }, settings: {} });
const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const N = (extra = {}, spec = {}) => Object.assign({ op: "create_node", scope: "page", pageIndex: 0, spec: Object.assign({ shape: "rect", x: 0, y: 0 }, spec) }, extra);
const C = (source, target, extra = {}) => Object.assign({ op: "create_connection", scope: "page", pageIndex: 0, source, target }, extra);
const R = (ref) => ({ ref });
const I = (id) => ({ id });
const first = (r) => (r.ok ? null : r.errors[0]);

/* El fixture de QA de 018.1: Cliente, Comercio, Banco y un ciclo Cliente → Comercio → Banco → Cliente. */
const GOLDEN = "test/fixtures/fluyo-018-2-golden.json";
const QA_OPERATIONS = [
  N({ ref: "cliente" }, { x: 200, y: 300, label: "Cliente" }),
  N({ ref: "comercio" }, { x: 600, y: 300, label: "Comercio" }),
  N({ ref: "banco" }, { shape: "cylinder", x: 400, y: 100, label: "Banco" }),
  C(R("cliente"), R("comercio"), { ref: "pago" }),
  C(R("comercio"), R("banco"), { ref: "cobro", spec: { route: "ortho", fromSide: "e", toSide: "w", label: "Cobro" } }),
  C(R("banco"), R("cliente"), { ref: "reembolso", spec: { dashed: true, label: "Reembolso" } }),
];

test("PARIDAD: Cliente/Comercio/Banco — editor real (newNode/newEdge) vs FluyoAuthoring: documento completo, deepStrictEqual sin normalizar", () => {
  const E = editor();
  E.run("doc=" + JSON.stringify(project().doc));
  E.run('newNode("rect",200,300,{label:"Cliente"});newNode("rect",600,300,{label:"Comercio"});newNode("cylinder",400,100,{label:"Banco"});' +
    'newEdge(1,2);newEdge(2,3,{route:"ortho",fromSide:"e",toSide:"w",label:"Cobro"});newEdge(3,1,{dashed:true,label:"Reembolso"})');
  const A = J(E.run("serializeProject()"));
  const r = apply(project(), QA_OPERATIONS);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepStrictEqual(r.project, A);
  assert.equal(JSON.stringify(r.project), JSON.stringify(A), "mismo orden de claves");
  assert.equal(A.doc.pages[0].nextId, 7);
  assert.deepStrictEqual(r.refs.map((x) => [x.ref, x.type, x.id]), [["cliente", "node", 1], ["comercio", "node", 2], ["banco", "node", 3], ["pago", "connection", 4], ["cobro", "connection", 5], ["reembolso", "connection", 6]]);
  const golden = { operations: QA_OPERATIONS, document: A, refs: r.refs };
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(path.join(__dirname, "..", GOLDEN), JSON.stringify(golden, null, 2) + "\n");
  assert.deepStrictEqual(golden, JSON.parse(read(GOLDEN)), "golden compartido con fluyo-mcp desactualizado: UPDATE_GOLDEN=1");
});

test("un lote Cliente → Comercio → Banco sin conocer ningún id; el documento resultante es ejecutable por el motor", () => {
  const r = apply(project(), QA_OPERATIONS.slice(0, 5));
  assert.equal(r.ok, true);
  const pg = r.project.doc.pages[0];
  assert.deepEqual(pg.edges.map((e) => [e.from, e.to]), [[1, 2], [2, 3]]);
  const again = apply(r.project, [{ op: "create_story", scope: "story", pageIndex: 0, name: "Pago", ref: "s" }]);
  assert.equal(again.ok, true);
});

test("la ref es del lote: no se persiste en el documento", () => {
  const r = apply(project(), QA_OPERATIONS);
  assert.equal(JSON.stringify(r.project).includes('"ref"'), false);
  assert.equal(JSON.stringify(r.project).includes("cliente"), false);
});

test("refs: A→B, luego C y B→C; ref disponible inmediatamente; refs cruzadas y ids existentes", () => {
  const r = apply(project(), [N({ ref: "a" }), N({ ref: "b" }), C(R("a"), R("b")), N({ ref: "c" }), C(R("b"), R("c")), C(R("c"), R("a")), C(I(1), R("c"))]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.project.doc.pages[0].edges.map((e) => [e.id, e.from, e.to]), [[3, 1, 2], [5, 2, 4], [6, 4, 1], [7, 1, 4]]);
  const existing = apply(r.project, [N({ ref: "nuevo" }, { x: 5 }), C(I(2), R("nuevo"), { ref: "k" })]);
  assert.equal(existing.ok, true);
  assert.deepEqual(existing.refs, [{ ref: "nuevo", type: "node", pageIndex: 0, id: 8 }, { ref: "k", type: "connection", pageIndex: 0, id: 9 }]);
  const last = existing.changes[1];
  assert.deepEqual([last.entityKind, last.entityId, last.source, last.target, last.ref, last.created], ["connection", 9, 2, 8, "k", true]);
});

test("cambios: qué se creó, dónde, con qué ref y qué id (sin devolver el documento)", () => {
  const r = apply(project(), QA_OPERATIONS.slice(0, 4));
  assert.deepEqual(r.changes[0], { operation: "create_node", scope: "page", operationIndex: 0, pageIndex: 0, entityKind: "node", entityId: 1, created: true, ref: "cliente", shape: "rect", label: "Cliente", x: 200, y: 300, w: 180, h: 70, affects: { stories: [] } });
  assert.deepEqual(r.changes[3], { operation: "create_connection", scope: "page", operationIndex: 3, pageIndex: 0, entityKind: "connection", entityId: 4, created: true, ref: "pago", source: 1, target: 2, affects: { stories: [] } });
  assert.deepEqual(r.touched, []);
});

test("páginas: la misma ref en dos páginas es válida y nunca se resuelve en la otra", () => {
  const p = project(page("A"), page("B"));
  const ok = apply(p, [N({ ref: "cliente" }, { label: "A" }), N({ ref: "cliente", pageIndex: 1 }, { label: "B" }), N({ ref: "x", pageIndex: 1 }), C(R("cliente"), R("x"), { pageIndex: 1 })]);
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  assert.deepEqual(ok.project.doc.pages.map((pg) => [pg.nodes.length, pg.edges.length]), [[1, 0], [2, 1]]);
  assert.deepEqual(ok.project.doc.pages[1].edges[0], Object.assign({}, ok.project.doc.pages[1].edges[0], { from: 1, to: 2 }));
  assert.deepEqual(ok.refs.filter((x) => x.ref === "cliente").map((x) => x.pageIndex), [0, 1]);
  const cross = apply(p, [N({ ref: "solo0" }), N({ pageIndex: 1, ref: "otro" }), C(R("solo0"), R("otro"), { pageIndex: 1 })]);
  assert.equal(first(cross).code, "UNKNOWN_REF");
  assert.match(first(cross).message, /OTRA página/);
  assert.equal(first(cross).operationIndex, 2);
  assert.equal(first(apply(p, [N({ pageIndex: 2 })])).code, "PAGE_NOT_FOUND");
});

test("errores estructurados: cada uno con code, operationIndex y operation (nunca TypeError)", () => {
  const p = project();
  const code = (ops, expected, extra) => {
    const e = first(apply(p, ops));
    assert.ok(e, "debía rechazarse: " + JSON.stringify(ops));
    assert.equal(e.code, expected, JSON.stringify(e));
    assert.equal(typeof e.message, "string");
    assert.equal(typeof e.operationIndex, "number");
    assert.doesNotMatch(JSON.stringify(e), /TypeError|Cannot read|undefined/);
    if (extra) for (const [k, v] of Object.entries(extra)) assert.deepEqual(e[k], v, k);
    return e;
  };
  code([N({ ref: "a" }), N({ ref: "a" })], "DUPLICATE_REF", { operationIndex: 1, field: "ref" });
  code([N({ ref: "a" }), N({ ref: "b" }), C(R("a"), R("b"), { ref: "k" }), C(R("b"), R("a"), { ref: "k" })], "DUPLICATE_REF", { operationIndex: 3 });
  code([C(R("nada"), I(1))], "UNKNOWN_REF", { field: "source", ref: "nada" });
  code([N(), C(I(1), R("nada"))], "UNKNOWN_REF", { field: "target" });
  code([N(), C(I(1), I(9))], "TARGET_NOT_FOUND", { field: "target" });
  code([N(), C(I(9), I(1))], "SOURCE_NOT_FOUND", { field: "source" });
  code([N({ ref: "a" }), C(R("a"), R("a"))], "SELF_LOOP");
  code([N(), C(I(1), I(1))], "SELF_LOOP");
  code([N({}, { id: 1 }), N({}, { id: 1 })], "DUPLICATE_ID", { field: "id" });
  code([N({}, { shape: "hexagono" })], "INVALID_FIELD", { field: "shape" });
  code([N({}, { x: "1" })], "INVALID_FIELD", { field: "x" });
  code([N({}, { colorr: "#fff" })], "INVALID_FIELD", { field: "colorr" });
  code([N({}, { w: -5 })], "INVALID_FIELD");
  code([N(), N(), C(I(1), I(2), { spec: { route: "curva" } })], "INVALID_FIELD");
  code([N(), N(), C(I(1), I(2), { spec: { fromSide: "norte" } })], "INVALID_FIELD");
  code([N({ spec: undefined })], "INVALID_OPERATION", { field: "spec" });
  code([N({ spec: { shape: "rect", x: 0, y: 0, ref: "z" } })], "INVALID_OPERATION", { field: "spec.ref" });
  code([N(), N(), C(I(1), I(2), { spec: { source: 1 } })], "INVALID_OPERATION", { field: "spec.source" });
  code([N({ ref: 7 })], "INVALID_OPERATION", { field: "ref" });
  code([N({ ref: "" })], "INVALID_OPERATION", { field: "ref" });
  code([N(), N(), C({ ref: "a", id: 1 }, I(2))], "INVALID_OPERATION", { field: "source" });
  code([N(), N(), C(1, I(2))], "INVALID_OPERATION", { field: "source" });
  code([N(), N(), C({ id: 0 }, I(2))], "INVALID_OPERATION");
  code([N(), N(), C({ nodeId: 1 }, I(2))], "INVALID_OPERATION");
  code([Object.assign(N(), { scope: "story" })], "SCOPE_MISMATCH");
  code([Object.assign(N(), { extra: 1 })], "INVALID_OPERATION", { field: "extra" });
  code([C(I(1), I(2), { spec: [] })], "INVALID_OPERATION", { field: "spec" });
  code([N(), N(), C(I(1), I(2), { spec: { id: 1 } })], "DUPLICATE_ID");
});

test("atomicidad: una operación inválida al final descarta cliente, comercio y pago; la entrada queda intacta", () => {
  const p = project();
  const before = JSON.stringify(p);
  const r = apply(p, [N({ ref: "cliente" }), N({ ref: "comercio" }), C(R("cliente"), R("comercio"), { ref: "pago" }), C(R("cliente"), R("cliente"))]);
  assert.equal(r.ok, false);
  assert.equal(r.project, undefined);
  assert.deepEqual([r.errors[0].code, r.errors[0].operationIndex], ["SELF_LOOP", 3]);
  assert.equal(JSON.stringify(p), before);
  assert.equal(apply(p, QA_OPERATIONS).ok, true);
  assert.equal(JSON.stringify(p), before, "una ejecución correcta tampoco muta la entrada");
});

test("determinismo: el mismo lote sobre el mismo documento da el mismo documento", () => {
  assert.equal(JSON.stringify(apply(project(), QA_OPERATIONS).project), JSON.stringify(apply(project(), QA_OPERATIONS).project));
});

test("ids: un id explícito adelanta el contador; ids de Behavior/Step no se reutilizan; ref sin spec.id usa el siguiente", () => {
  const r = apply(project(), [N({ ref: "a" }, { id: 10 }), N({ ref: "b" }), C(R("a"), R("b"))]);
  assert.deepEqual(r.project.doc.pages[0].nodes.map((n) => n.id), [10, 11]);
  assert.equal(r.project.doc.pages[0].edges[0].id, 12);
  assert.equal(r.project.doc.pages[0].nextId, 13);
});

test("un lote mixto de diagrama + Historia: la Historia usa los ids creados y es ejecutable", () => {
  const base = project(); const created = apply(base, [N({ ref: "a" }), N({ ref: "b" }), C(R("a"), R("b"))]).project;
  const withEvent = apply(created, [{ op: "create_event_type", scope: "eventType", name: "Enviar", primitive: "FLOW", sentence: "{source} envía a {target}" }]);
  assert.equal(withEvent.ok, true, JSON.stringify(withEvent.errors));
  const story = apply(withEvent.project, [
    N({ ref: "c" }, { x: 900 }), C(I(2), R("c"), { ref: "k" }),
    { op: "create_story", scope: "story", pageIndex: 0, name: "Flujo", ref: "s" },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s"), eventTypeId: 1, target: { from: 1, to: 2 } },
  ]);
  assert.equal(story.ok, true, JSON.stringify(story.errors));
  assert.deepEqual(story.touched.length, 1);
});

test("el kernel no duplica reglas de creación: sin push, nextId, geometría ni ids propios en story-authoring.js", () => {
  const src = read("js/story-authoring.js");
  assert.match(src, /createNodeIn\(pg, spec/);
  assert.match(src, /createConnectionIn\(pg, spec/);
  for (const bad of [".nodes.push", ".edges.push", "nextId", "calculateRoute", "edgePoints", "reserveStructureIds", "structuralNextId"]) assert.ok(!src.includes(bad), `story-authoring.js contiene lógica de creación: ${bad}`);
});

test("límite de lote (antes de ejecutar nada): 201 operaciones se rechazan con INVALID_OPERATION", () => {
  const ops = Array.from({ length: 201 }, (_, i) => N({ ref: "n" + i }));
  const e = first(apply(project(), ops));
  assert.equal(e.code, "INVALID_OPERATION");
  assert.equal(apply(project(), ops.slice(0, 200)).ok, true);
});

test("un documento con Historias y EventTypes no cambia al crear en otra página (sólo crece lo creado)", () => {
  const p = project(page("A"), page("B"));
  const r = apply(p, [N({ pageIndex: 1 })]);
  assert.deepStrictEqual(r.project.doc.pages[0], apply(p, [{ op: "create_story", scope: "story", pageIndex: 1, name: "x" }]).project.doc.pages[0]);
  assert.equal(r.project.doc.pages[1].nodes.length, 1);
});
