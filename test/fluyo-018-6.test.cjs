"use strict";
/* FLUYO-018.6 — reglas de ENTRADA de autoría: (a) fill:"none" («Sin relleno») es un valor válido de create_node/update_node;
   (b) lineColor y dotColor de las conexiones siguen la misma regla HEX que los colores de nodo (null = color del tema),
   solo sobre lo que el lote escribe. Paridad con el editor real (misma autoridad de dominio) y documentos antiguos. */
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
  ctx.call = (expr, arg) => { ctx.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(vm.runInContext(`JSON.stringify((function(){ const __a = JSON.parse(__in); return (${expr}); })())`, ctx)); };
  return ctx;
}
function editor() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, scheduleAutosave() {}, renderTabs() {}, refreshPanel() {}, selN: new Set(), selE: new Set(), clip: null, GRID: 20 });
  ctx.run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js"]) ctx.run(read("js/" + f));
  ctx.run(read("js/state.js").split("/* ===================== Viewport")[0]);
  ctx.run(read("js/selection.js"));
  ctx.load = (project) => ctx.run("doc=projectFromProjectData(" + JSON.stringify(project) + ").doc");
  return ctx;
}
const K = kernel();
const page = (name = "Página 1") => ({ name, nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
const project = (...pages) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: pages.length ? pages : [page()], cur: 0 }, settings: {} });
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const first = (r) => (r.ok ? null : r.errors[0]);
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };
const frozen = (o) => { const f = (x) => { if (x && typeof x === "object") { Object.freeze(x); Object.values(x).forEach(f); } return x; }; return f(o); };
const N = (pageIndex, spec = {}, extra = {}) => Object.assign({ op: "create_node", scope: "page", pageIndex, spec: Object.assign({ shape: "rect", x: 0, y: 0 }, spec) }, extra);
const C = (pageIndex, source, target, spec, extra = {}) => Object.assign({ op: "create_connection", scope: "page", pageIndex, source, target }, spec === undefined ? {} : { spec }, extra);
const UN = (pageIndex, node, spec) => ({ op: "update_node", scope: "page", pageIndex, node, spec });
const UC = (pageIndex, connection, spec) => ({ op: "update_connection", scope: "page", pageIndex, connection, spec });
const R = (ref) => ({ ref });
const I = (id) => ({ id });
const two = () => ok(apply(project(), [N(0, { x: 0 }, { ref: "a" }), N(0, { x: 300 }, { ref: "b" }), C(0, R("a"), R("b"), { label: "x" }, { ref: "e" })])).project;

/* ─────────── fill:"none" ─────────── */
test('fill:"none" se acepta en create_node y update_node (formas de caja) y se persiste tal cual', () => {
  for (const shape of ["rect", "cylinder", "diamond", "circle", "hex", "code"]) {
    const r = ok(apply(project(), [N(0, { shape, fill: "none" })]));
    assert.equal(r.project.doc.pages[0].nodes[0].fill, "none", shape);
    assert.equal(K.call("FluyoIntegrity.validateProject(__a)", r.project).valid, true);
  }
  const base = ok(apply(project(), [N(0, { fill: "#112233" })])).project;
  const u = ok(apply(base, [UN(0, I(1), { fill: "none" })]));
  assert.equal(u.project.doc.pages[0].nodes[0].fill, "none");
  assert.deepEqual(u.changes[0].fields, ["fill"]);
  assert.deepEqual([u.changes[0].from.fill, u.changes[0].to.fill], ["#112233", "none"]);
  assert.equal(ok(apply(u.project, [UN(0, I(1), { fill: "#fff" })])).project.doc.pages[0].nodes[0].fill, "#fff");
  assert.equal(ok(apply(u.project, [UN(0, I(1), { fill: null })])).project.doc.pages[0].nodes[0].fill, null);
});

test("fill: «none» es EXACTO y solo de fill; el resto de valores conserva su semántica", () => {
  for (const bad of ["None", "NONE", " none", "none ", "transparent", "", "no", false, 0, [], ["none"], { v: "none" }]) {
    const e = first(apply(project(), [N(0, { fill: bad })]));
    assert.deepEqual([e && e.code, e && e.field], ["INVALID_FIELD", "fill"], JSON.stringify(bad));
  }
  for (const field of ["color", "textBg", "textColor", "kwBg", "kwColor"]) {
    const e = first(apply(project(), [N(0, { shape: field.startsWith("kw") ? "code" : "rect", [field]: "none" })]));
    assert.deepEqual([e && e.code, e && e.field], ["INVALID_FIELD", field], "«none» no vale en " + field);
  }
  const base = ok(apply(project(), [N(0, {})])).project;
  for (const f of ["color", "textBg", "textColor"]) assert.equal(first(apply(base, [UN(0, I(1), { [f]: "none" })])).field, f);
  assert.equal(first(apply(base, [UN(0, I(1), { fill: "red" })])).field, "fill");
  assert.match(first(apply(base, [UN(0, I(1), { fill: "red" })])).message, /none/, "el mensaje menciona la alternativa");
});

test('fill:"none" y colores de conexión: paridad con el editor real (mismo dominio) y con el documento/render', () => {
  const st = ok(apply(project(), [N(0, { fill: "#445566" }, { ref: "a" }), N(0, { x: 300 }), C(0, R("a"), I(2), { lineColor: "#112233", dotColor: "#abc" })])).project;
  const E = editor(); E.load(st);
  E.run('editNode(P().nodes[0],{fill:"none"}); editEdge(P().edges[0],{lineColor:"#aa00ff",dotColor:null});');
  const A = J(E.run("serializeProject()"));
  const au = ok(apply(st, [UN(0, I(1), { fill: "none" }), UC(0, I(3), { lineColor: "#aa00ff", dotColor: null })]));
  assert.deepStrictEqual(au.project.doc.pages[0].nodes, A.doc.pages[0].nodes);
  assert.deepStrictEqual(au.project.doc.pages[0].edges, A.doc.pages[0].edges);
  assert.equal(JSON.stringify(au.project), JSON.stringify(A), "mismo documento, mismo orden de claves");
  assert.equal(K.call("projectFromProjectData(__a).doc.pages[0].nodes[0].fill", au.project), "none");
  assert.match(read("js/render.js"), /n\.fill==="none"\)\s*return null/, "el render trata «none» como forma hueca");
  assert.match(read("js/ui.js"), /label:"Sin relleno", value:"none"/, "el selector del editor lo ofrece");
});

/* ─────────── colores de conexión ─────────── */
test("lineColor/dotColor: HEX (#rgb, #rrggbb, #rrggbbaa) y null valen; todo lo demás es INVALID_FIELD con el campo (create_connection)", () => {
  for (const good of ["#abc", "#AABBCC", "#a1b2c3", "#a1b2c3d4"]) {
    const r = ok(apply(project(), [N(0, {}, { ref: "a" }), N(0, { x: 300 }, { ref: "b" }), C(0, R("a"), R("b"), { lineColor: good, dotColor: good })]));
    const e = r.project.doc.pages[0].edges[0];
    assert.deepEqual([e.lineColor, e.dotColor], [good, good]);
  }
  const nulls = ok(apply(project(), [N(0, {}, { ref: "a" }), N(0, { x: 300 }, { ref: "b" }), C(0, R("a"), R("b"), { lineColor: null, dotColor: null })]));
  assert.equal(nulls.project.doc.pages[0].edges[0].lineColor, null);
  for (const bad of ["not-a-color", "red", "#ab", "#abcd", "#abcde", "#abcdefg", "#abcdef0", "abc", "#ggg", "rgb(1,2,3)", "", " #abc", "#abc ", 5, true, {}, [], ["#abc"]]) {
    for (const field of ["lineColor", "dotColor"]) {
      const e = first(apply(project(), [N(0, {}, { ref: "a" }), N(0, { x: 300 }, { ref: "b" }), C(0, R("a"), R("b"), { [field]: bad })]));
      assert.deepEqual([e && e.code, e && e.field, e && e.operation, e && e.operationIndex], ["INVALID_FIELD", field, "create_connection", 2], JSON.stringify([field, bad]));
    }
  }
});

test("lineColor/dotColor en update_connection: solo las claves del parche; mismo error; atómico", () => {
  const base = two();
  for (const field of ["lineColor", "dotColor"]) {
    ok(apply(base, [UC(0, I(3), { [field]: "#12345678" })]));
    ok(apply(base, [UC(0, I(3), { [field]: null })]));
    for (const bad of ["not-a-color", "red", "#12", 7, {}]) {
      const e = first(apply(base, [UC(0, I(3), { [field]: bad })]));
      assert.deepEqual([e.code, e.field, e.operation], ["INVALID_FIELD", field, "update_connection"], JSON.stringify(bad));
    }
  }
  const batch = frozen(structuredClone([UN(0, I(1), { x: 77 }), UC(0, I(3), { label: "nuevo", lineColor: "#fff", dotColor: "verde" })]));
  const r = apply(base, batch);
  assert.equal(r.ok, false);
  assert.equal(r.project, undefined, "sin documento parcial");
  assert.deepEqual([r.errors[0].field, r.errors[0].operationIndex], ["dotColor", 1]);
  // las reglas de ENTRADA van antes que las del dominio: un color inválido junto a un retarget imposible se informa como color
  const both = first(apply(base, [{ op: "update_connection", scope: "page", pageIndex: 0, connection: I(3), source: I(999), spec: { lineColor: "x" } }]));
  assert.deepEqual([both.code, both.field], ["INVALID_FIELD", "lineColor"]);
  assert.equal(first(apply(base, [{ op: "update_connection", scope: "page", pageIndex: 0, connection: I(3), source: I(999) }])).code, "SOURCE_NOT_FOUND");
  const mk = (color) => [N(0, {}, { ref: "a" }), N(0, { x: 300 }, { ref: "b" }), C(0, R("a"), R("b"), {}, { ref: "e" }), UC(0, R("e"), { lineColor: color })];
  ok(apply(project(), mk("#0f0")));
  assert.equal(first(apply(project(), mk("verde"))).field, "lineColor");
});

test("documentos antiguos: un color de conexión inválido ya guardado se abre, se describe y se edita; solo se valida lo que el lote escribe", () => {
  const old = two();
  old.doc.pages[0].edges[0].lineColor = "not-a-color";
  old.doc.pages[0].edges[0].dotColor = "red";
  old.doc.pages[0].nodes[0].fill = "azul";
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", old).valid, true, "el documento antiguo sigue siendo válido");
  const r = ok(apply(old, [UC(0, I(3), { label: "otra", dashed: true }), UN(0, I(1), { x: 5, label: "n" })]));
  const e = r.project.doc.pages[0].edges[0];
  assert.deepEqual([e.lineColor, e.dotColor, e.label], ["not-a-color", "red", "otra"]);
  assert.equal(r.project.doc.pages[0].nodes[0].fill, "azul");
  ok(apply(old, [UC(0, I(3), { waypoints: [] }), C(0, I(1), I(2), { lineColor: "#fff" })]));
  const fixed = ok(apply(old, [UC(0, I(3), { lineColor: "#00ff00" })]));
  assert.equal(fixed.project.doc.pages[0].edges[0].lineColor, "#00ff00");
  assert.equal(fixed.project.doc.pages[0].edges[0].dotColor, "red", "dotColor, no escrito, intacto");
  assert.equal(first(apply(old, [UC(0, I(3), { dotColor: "red" })])).field, "dotColor", "reescribir el mismo valor inválido es una escritura: se rechaza");
});

test("atomicidad: sin documento parcial, entrada intacta y errores estructurados (nunca TypeError); multipágina", () => {
  const base = frozen(two());
  const before = JSON.stringify(base);
  for (const spec of [{ lineColor: "red" }, { dotColor: 5 }, { lineColor: {} }, { dotColor: [] }]) {
    const r = apply(base, [UC(0, I(3), spec)]);
    assert.equal(r.ok, false);
    assert.equal(r.errors[0].code, "INVALID_FIELD");
    assert.equal(typeof r.errors[0].message, "string");
    assert.ok(!/TypeError|undefined/.test(JSON.stringify(r.errors)), JSON.stringify(r.errors));
  }
  assert.equal(JSON.stringify(base), before);
  const mp = ok(apply(project(), [{ op: "create_page", scope: "document", name: "B" }, N(0, {}, { ref: "a" }), N(0, { x: 300 }, { ref: "b" }), C(0, R("a"), R("b"), {}), N(1, {}, { ref: "a" }), N(1, { x: 300 }, { ref: "b" }), C(1, R("a"), R("b"), {})])).project;
  const e = first(apply(mp, [UC(0, I(3), { lineColor: "#fff" }), UC(1, I(3), { lineColor: "x" })]));
  assert.deepEqual([e.field, e.operationIndex], ["lineColor", 1]);
  const good = ok(apply(mp, [UC(0, I(3), { lineColor: "#fff" }), UC(1, I(3), { dotColor: "#000" }), UN(1, I(1), { fill: "none" })]));
  assert.equal(good.project.doc.pages[0].edges[0].lineColor, "#fff");
  assert.equal(good.project.doc.pages[1].edges[0].dotColor, "#000");
  assert.equal(good.project.doc.pages[1].nodes[0].fill, "none");
  assert.equal(good.project.doc.pages[0].nodes[0].fill ?? null, null);
});

/* ─────────── golden compartido con fluyo-mcp ─────────── */
const GOLDEN = "test/fixtures/fluyo-018-6-golden.json";
test("PARIDAD: documento construido por el editor real (fill:none, colores de conexión) == author_document; golden compartido con fluyo-mcp", () => {
  const start = project(page("A"));
  const OPS = [
    N(0, { x: 100, y: 100, label: "Origen", fill: "none", color: "#6a9fb5" }, { ref: "a" }),
    N(0, { x: 400, y: 100, label: "Destino", fill: "#223344" }, { ref: "b" }),
    C(0, R("a"), R("b"), { label: "Pago", lineColor: "#ff8800", dotColor: "#00ccff88", route: "ortho" }, { ref: "e" }),
    UN(0, R("b"), { fill: "none" }),
    UC(0, R("e"), { dotColor: null }),
  ];
  const E = editor(); E.load(start);
  E.run(`
    const a=newNode("rect",100,100,{label:"Origen",fill:"none",color:"#6a9fb5"}), b=newNode("rect",400,100,{label:"Destino",fill:"#223344"});
    const e=newEdge(a.id,b.id,{label:"Pago",lineColor:"#ff8800",dotColor:"#00ccff88",route:"ortho"});
    editNode(b,{fill:"none"}); editEdge(e,{dotColor:null});
  `);
  const A = J(E.run("serializeProject()"));
  const au = ok(apply(start, OPS));
  // El editor crea el nodo con sus propios defaults y author_document con la normalización de carga: el documento NORMALIZADO es el mismo.
  const norm = (p) => K.call("projectFromProjectData(__a)", p);
  assert.deepStrictEqual(norm(au.project), norm(A));
  const golden = { start, operations: OPS, document: au.project };
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(path.join(__dirname, "..", GOLDEN), JSON.stringify(golden, null, 2) + "\n");
  assert.deepStrictEqual(golden, JSON.parse(read(GOLDEN)), "golden compartido con fluyo-mcp desactualizado: UPDATE_GOLDEN=1");
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", au.project).valid, true);
});
