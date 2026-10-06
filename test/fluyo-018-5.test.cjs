"use strict";
/* FLUYO-018.5 — páginas (createPageIn, renamePageIn, create_page, rename_page), reglas de ENTRADA de nodo (color HEX, icon, anim, border:none),
   límites de autoría sobre el ESTADO FINAL del lote, no retroactividad con documentos antiguos y PARIDAD con el editor real
   (documento completo sin normalizar, multipágina, Historias, Trace). El golden se comparte con fluyo-mcp. */
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
/* El editor real: state.js (addPage, renamePage, newNode, newEdge…) y selection.js. */
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

const CP = (name, extra = {}) => Object.assign({ op: "create_page", scope: "document" }, name === undefined ? {} : { name }, extra);
const RP = (pageIndex, name, extra = {}) => Object.assign({ op: "rename_page", scope: "document", pageIndex, name }, extra);
const N = (pageIndex, spec = {}, extra = {}) => Object.assign({ op: "create_node", scope: "page", pageIndex, spec: Object.assign({ shape: "rect", x: 0, y: 0 }, spec) }, extra);
const C = (pageIndex, source, target, extra = {}) => Object.assign({ op: "create_connection", scope: "page", pageIndex, source, target }, extra);
const UN = (pageIndex, node, spec) => ({ op: "update_node", scope: "page", pageIndex, node, spec });
const UC = (pageIndex, connection, spec, extra = {}) => Object.assign({ op: "update_connection", scope: "page", pageIndex, connection, spec }, extra);
const DN = (pageIndex, node) => ({ op: "delete_node", scope: "page", pageIndex, node });
const R = (ref) => ({ ref });
const I = (id) => ({ id });

/* Documento «grande» construido a mano (la autoría admite 200 operaciones por lote): n nodos y m conexiones en la página 0. */
function bigProject(nodes, edges, extra = {}) {
  const pg = page("Grande");
  for (let i = 1; i <= nodes; i++) pg.nodes.push(Object.assign({ id: i, shape: "rect", x: (i % 50) * 200, y: Math.floor(i / 50) * 100, w: 180, h: 70, label: "n" + i }, i === 1 ? extra : {}));
  for (let j = 1; j <= edges; j++) pg.edges.push({ id: nodes + j, from: 1, to: 2, route: "straight", label: "" });
  pg.nextId = nodes + edges + 1;
  return project(pg);
}

/* ─────────── dominio: createPageIn / renamePageIn ─────────── */
function dom(d, code) { return K.call(`(function(){ const d=__a; try { const r=(${code}); return {ok:true,r,d}; } catch(e){ return {ok:false,code:e.code,field:e.field,isType:e instanceof TypeError,d}; } })()`, d); }
const docOf = (...pages) => project(...pages).doc;

test("createPageIn: añade SIEMPRE al final, nombre por defecto del editor, devuelve pageIndex y NO toca cur", () => {
  const d = docOf(page("A"), page("B"));
  d.cur = 1;
  const r = dom(d, "createPageIn(d)");
  assert.equal(r.ok, true);
  assert.equal(r.r.pageIndex, 2);
  assert.equal(r.d.pages.length, 3);
  assert.equal(r.d.pages[2].name, "Página 3");
  assert.deepEqual(r.d.pages[2], page("Página 3"), "mismo registro que blankPage");
  assert.equal(r.d.cur, 1, "el dominio no cambia de página");
  assert.deepEqual(r.d.pages.slice(0, 2).map((p) => p.name), ["A", "B"]);
});

test("createPageIn: nombre explícito válido (1..80) y rechazos estructurados, sin TypeError", () => {
  const d = docOf(page("A"));
  assert.equal(dom(d, "createPageIn(d,'x')").d.pages[1].name, "x");
  assert.equal(dom(d, "createPageIn(d,'ñ'.repeat(80))").ok, true);
  assert.equal(dom(d, "createPageIn(d,' a ')").d.pages[1].name, " a ", "se guarda tal cual, como el editor");
  for (const bad of ["''", "'   '", "'x'.repeat(81)", "null", "5", "{}", "[]", "true"]) {
    const r = dom(d, `createPageIn(d,${bad})`);
    assert.deepEqual([r.ok, r.code, r.field, r.isType], [false, "invalid_page_name", "name", false], bad);
    assert.equal(r.d.pages.length, 1, "no muta ante un error");
  }
  for (const bad of ["null", "{}", "{pages:5}"]) assert.equal(dom(d, `createPageIn(${bad},'x')`).code, "invalid_document");
});

test("renamePageIn: página inexistente, nombre vacío o >80 se rechazan; no muta ante el error", () => {
  const d = docOf(page("A"), page("B"));
  const r = dom(d, "renamePageIn(d,1,'Datos')");
  assert.deepEqual([r.ok, r.d.pages[1].name, r.r.from, r.r.pageIndex], [true, "Datos", "B", 1]);
  for (const idx of ["2", "-1", "1.5", "'1'", "null", "undefined", "NaN"]) assert.equal(dom(d, `renamePageIn(d,${idx},'x')`).code, "page_not_found", idx);
  for (const bad of ["''", "'  '", "'x'.repeat(81)", "undefined", "null", "7"]) {
    const e = dom(d, `renamePageIn(d,0,${bad})`);
    assert.deepEqual([e.ok, e.code, e.isType, e.d.pages[0].name], [false, "invalid_page_name", false, "A"], bad);
  }
});

/* ─────────── author_document: create_page / rename_page ─────────── */
test("create_page: scope document, al final, devuelve pageIndex, no cambia cur, sin page ids", () => {
  const p = project(page("A"));
  const r = ok(apply(p, [CP("Pagos"), CP()]));
  assert.deepEqual(r.project.doc.pages.map((x) => x.name), ["A", "Pagos", "Página 3"]);
  assert.equal(r.project.doc.cur, 0, "no cambia doc.cur");
  assert.deepEqual(r.changes.map((c) => [c.operation, c.scope, c.entityKind, c.pageIndex, c.created, c.name]),
    [["create_page", "document", "page", 1, true, "Pagos"], ["create_page", "document", "page", 2, true, "Página 3"]]);
  assert.equal(JSON.stringify(r.project).includes('"pageId"'), false);
  assert.deepEqual(r.project.doc.pages[1], page("Pagos"));
});

test("create_page: las operaciones siguientes del MISMO lote usan el pageIndex nuevo (nodos, conexión, Historia)", () => {
  const ops = [CP("Nueva"), N(1, { x: 100, y: 50, label: "A" }, { ref: "a" }), N(1, { x: 400, y: 50, label: "B" }, { ref: "b" }),
    C(1, R("a"), R("b"), { ref: "k", spec: { label: "va" } }),
    { op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source} → {target}", ref: "ev" },
    { op: "create_story", scope: "story", pageIndex: 1, name: "Historia nueva", ref: "s" },
    { op: "add_step", scope: "story", pageIndex: 1, storyId: R("s"), eventTypeId: R("ev"), target: R("k") }];
  const r = ok(apply(project(page("A")), ops));
  const pg = r.project.doc.pages;
  assert.equal(pg.length, 2);
  assert.deepEqual(pg[0], page("A"), "la página existente no cambia");
  assert.deepEqual([pg[1].nodes.map((n) => n.label), pg[1].edges.map((e) => [e.from, e.to])], [["A", "B"], [[1, 2]]]);
  assert.equal(pg[1].scenarios[0].steps.length, 1);
  assert.deepEqual(r.refs.map((x) => [x.ref, x.type, x.pageIndex]), [["a", "node", 1], ["b", "node", 1], ["k", "connection", 1]]);
  // La página recién creada tiene su propio espacio de ids y de refs.
  const two = ok(apply(project(page("A")), [N(0, {}, { ref: "x" }), CP(), N(1, {}, { ref: "x" }), N(1, { x: 5 }, { ref: "y" })]));
  assert.deepEqual(two.project.doc.pages.map((x) => x.nodes.map((n) => n.id)), [[1], [1, 2]]);
});

test("create_page: un pageIndex que todavía no existe falla; después de crearlo, vale", () => {
  assert.equal(first(apply(project(), [N(1), CP()])).code, "PAGE_NOT_FOUND");
  assert.equal(first(apply(project(), [CP(), N(2)])).code, "PAGE_NOT_FOUND");
  ok(apply(project(), [CP(), N(1)]));
});

test("create_page / rename_page: nombre vacío, de solo espacios o >80 rechazados con INVALID_NAME; sin TypeError", () => {
  for (const bad of ["", "   ", "x".repeat(81), 5, null, {}]) {
    for (const op of [CP(bad), RP(0, bad)]) {
      const e = first(apply(project(page("A")), [op]));
      assert.deepEqual([e.code, e.field, e.operationIndex], ["INVALID_NAME", "name", 0], JSON.stringify([op.op, bad]).slice(0, 40));
    }
  }
  assert.equal(first(apply(project(), [RP(0, undefined)])).code, "INVALID_NAME", "rename_page exige nombre");
  ok(apply(project(), [CP("x".repeat(80)), RP(0, "y".repeat(80))]));
});

test("rename_page: renombra por pageIndex, informa from/to, rechaza página inexistente; también la creada en el lote", () => {
  const r = ok(apply(project(page("A"), page("B")), [RP(1, "Datos"), CP("Z"), RP(2, "Zeta")]));
  assert.deepEqual(r.project.doc.pages.map((x) => x.name), ["A", "Datos", "Zeta"]);
  assert.deepEqual(r.changes.map((c) => [c.operation, c.pageIndex, c.from, c.to ?? null]), [["rename_page", 1, "B", "Datos"], ["create_page", 2, undefined, null], ["rename_page", 2, "Z", "Zeta"]].map((x) => x));
  for (const bad of [2, -1, 1.5, "0", null]) {
    const e = first(apply(project(page("A"), page("B")), [RP(bad, "x")]));
    assert.ok(["PAGE_NOT_FOUND", "INVALID_OPERATION"].includes(e.code), JSON.stringify([bad, e.code]));
  }
  assert.equal(first(apply(project(page("A"), page("B")), [RP(2, "x")])).code, "PAGE_NOT_FOUND");
  assert.equal(first(apply(project(page("A")), [RP(5, "x")])).pageIndex, 5);
});

test("create_page / rename_page: forma de la operación (scope, campos desconocidos) y atomicidad", () => {
  assert.equal(first(apply(project(), [{ op: "create_page", scope: "page", pageIndex: 0 }])).code, "SCOPE_MISMATCH");
  assert.equal(first(apply(project(), [{ op: "create_page", name: "x" }])).code, "SCOPE_MISMATCH");
  assert.equal(first(apply(project(), [{ op: "rename_page", scope: "story", pageIndex: 0, name: "x" }])).code, "SCOPE_MISMATCH");
  assert.equal(first(apply(project(), [CP("x", { pageIndex: 0 })])).code, "INVALID_OPERATION", "create_page no lleva pageIndex");
  assert.equal(first(apply(project(), [CP("x", { ref: "p" })])).code, "INVALID_OPERATION", "las páginas no tienen refs");
  assert.equal(first(apply(project(), [RP(0, "x", { id: 1 })])).code, "INVALID_OPERATION");
  assert.equal(first(apply(project(), [{ op: "rename_page", scope: "document", name: "x" }])).code, "INVALID_OPERATION", "rename_page exige pageIndex");
  const p = frozen(project(page("A")));
  const snap = JSON.stringify(p);
  const r = apply(p, [CP("B"), RP(0, "Z"), N(1), RP(0, "")]);
  assert.equal(r.ok, false);
  assert.equal(r.project, undefined);
  assert.equal(JSON.stringify(p), snap, "el original no se modifica");
  assert.equal(first(r).operationIndex, 3);
});

test("create_page/rename_page: determinismo (mismo lote, mismo documento)", () => {
  const ops = [CP("A"), RP(0, "Inicio"), N(1, {}, { ref: "n" })];
  assert.equal(JSON.stringify(apply(project(), ops)), JSON.stringify(apply(project(), ops)));
});

test("describe/contrato: FluyoAuthoring publica el scope document y los límites", () => {
  const scope = K.call("FluyoAuthoring.OPERATION_SCOPE");
  assert.deepEqual([scope.create_page, scope.rename_page], ["document", "document"]);
  assert.deepEqual(K.call("FluyoAuthoring.LIMITS"), { coordMax: 100000, sizeMin: 10, sizeMax: 5000, maxNodesPerPage: 300, maxConnectionsPerPage: 600 });
});

/* ─────────── reglas de entrada de nodo ─────────── */
test("color HEX: #rgb, #rrggbb y #rrggbbaa valen; nombres, formatos truncados y tipos erróneos se rechazan (create_node y update_node)", () => {
  for (const good of ["#abc", "#AABBCC", "#a1b2c3", "#a1b2c3d4", "#ABCD".slice(0, 4)]) {
    const r = ok(apply(project(), [N(0, { color: good, fill: good, textBg: good, textColor: good })]));
    assert.equal(r.project.doc.pages[0].nodes[0].color, good);
  }
  for (const bad of ["red", "#ab", "#abcd", "#abcde", "#abcdefg", "#abcdef0", "abc", "#ggg", "rgb(1,2,3)", "", " #abc", "#abc ", 5, true, {}]) {
    for (const field of ["color", "fill", "textBg", "textColor", "kwBg", "kwColor"]) {
      const e = first(apply(project(), [N(0, { shape: field.startsWith("kw") ? "code" : "rect", [field]: bad })]));
      assert.deepEqual([e && e.code, e && e.field], ["INVALID_FIELD", field], JSON.stringify([field, bad]));
    }
  }
  const base = ok(apply(project(), [N(0, {}, { ref: "a" }), N(0, { shape: "code", x: 9 })])).project;
  for (const f of ["color", "fill", "textBg", "textColor"]) {
    assert.equal(first(apply(base, [UN(0, I(1), { [f]: "azul" })])).code, "INVALID_FIELD", "update_node " + f);
    ok(apply(base, [UN(0, I(1), { [f]: "#12345678" })]));
  }
  for (const f of ["kwBg", "kwColor"]) {
    assert.equal(first(apply(base, [UN(0, I(2), { [f]: "azul" })])).field, f);
    ok(apply(base, [UN(0, I(2), { [f]: "#fff" })]));
  }
  // null: vacía lo anulable; en `color` (obligatorio) update lo rechaza y create lo toma como «el de por defecto».
  ok(apply(base, [UN(0, I(1), { fill: null, textBg: null, textColor: null })]));
  assert.equal(first(apply(base, [UN(0, I(1), { color: null })])).code, "INVALID_FIELD");
  ok(apply(project(), [N(0, { color: null, fill: null })]));
});

test("icon / anim: deben existir en el catálogo; la forma icon exige icon y la forma anim exige anim", () => {
  const icons = K.call("Object.keys(ICONS)"), anims = K.call("Object.keys(ANIMS)");
  assert.ok(icons.length > 10 && anims.length > 3);
  for (const key of icons) assert.equal(ok(apply(project(), [N(0, { shape: "icon", icon: key })])).project.doc.pages[0].nodes[0].icon, key);
  for (const key of anims) assert.equal(ok(apply(project(), [N(0, { shape: "anim", anim: key })])).project.doc.pages[0].nodes[0].anim, key);
  for (const bad of ["no-existe", "", "KAFKA", "constructor", "__proto__", "toString", 5, null, {}]) {
    assert.deepEqual([first(apply(project(), [N(0, { shape: "icon", icon: bad })])).code, first(apply(project(), [N(0, { shape: "icon", icon: bad })])).field], ["INVALID_FIELD", "icon"], JSON.stringify(bad));
    assert.equal(first(apply(project(), [N(0, { shape: "anim", anim: bad })])).field, "anim", JSON.stringify(bad));
  }
  assert.deepEqual([first(apply(project(), [N(0, { shape: "icon" })])).field, first(apply(project(), [N(0, { shape: "anim" })])).field], ["icon", "anim"]);
  assert.match(first(apply(project(), [N(0, { shape: "icon" })])).message, /necesita «icon»/);
  // un icono inexistente también se rechaza en otra forma; un nodo normal sin icon sigue valiendo
  assert.equal(first(apply(project(), [N(0, { shape: "rect", icon: "zzz" })])).field, "icon");
  ok(apply(project(), [N(0, { shape: "rect" }), N(0, { shape: "text" }), N(0, { shape: "code" })]));
  // update_node no puede cambiar icon/anim (018.3) y la regla no lo altera
  const b = ok(apply(project(), [N(0, { shape: "icon", icon: "kafka" })])).project;
  assert.equal(first(apply(b, [UN(0, I(1), { icon: "db" })])).field, "icon");
});

test("border:\"none\" es válido en create_node (como en update_node y en el selector)", () => {
  for (const border of ["solid", "dashed", "dotted", "none"]) assert.equal(ok(apply(project(), [N(0, { border })])).project.doc.pages[0].nodes[0].border, border);
  assert.equal(first(apply(project(), [N(0, { border: "doble" })])).code, "INVALID_FIELD");
  const b = ok(apply(project(), [N(0, { border: "none" })])).project;
  ok(apply(b, [UN(0, I(1), { border: "dotted" })]));
});

/* ─────────── no retroactividad: documentos antiguos ─────────── */
test("documento antiguo con color, icono y anim inválidos bajo las reglas nuevas: se abre, valida, describe y se edita en lo demás", () => {
  const legacy = project(page("Viejo"));
  legacy.doc.pages[0].nodes.push(
    { id: 1, shape: "rect", x: 0, y: 0, w: 180, h: 70, label: "viejo", color: "red", fill: "azul", textBg: "nope", textColor: "rgb(1,2,3)" },
    { id: 2, shape: "icon", x: 300, y: 0, w: 120, h: 92, label: "ico", icon: "ya-no-existe" },
    { id: 3, shape: "anim", x: 600, y: 0, w: 120, h: 100, label: "gif", anim: "tampoco" },
    { id: 4, shape: "icon", x: 900, y: 0, w: 120, h: 92, label: "sin icono" });
  legacy.doc.pages[0].nextId = 5;
  assert.equal(K.call("FluyoAuthoring.normalizedProject(__a)", legacy).ok, true, "abre");
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", legacy).valid, true, "FluyoIntegrity no conoce las reglas de entrada");
  const r = ok(apply(legacy, [UN(0, I(1), { label: "nuevo", bold: true }), UN(0, I(2), { x: 10 }), UN(0, I(3), { label: "g" }), UN(0, I(4), { w: 130 }), N(0, { x: 1200, label: "otro" }), CP("Otra"), RP(0, "Renombrada")]));
  const n = r.project.doc.pages[0].nodes;
  assert.deepEqual([n[0].color, n[0].fill, n[0].textBg, n[0].textColor], ["red", "azul", "nope", "rgb(1,2,3)"], "los valores antiguos se conservan");
  assert.deepEqual([n[1].icon, n[2].anim, n[3].icon], ["ya-no-existe", "tampoco", undefined]);
  // El valor antiguo no se revalida, pero escribirlo de nuevo sí es una entrada.
  assert.equal(first(apply(legacy, [UN(0, I(1), { color: "red" })])).code, "INVALID_FIELD");
  // Y se puede ejecutar una Historia sobre él.
  const story = ok(apply(legacy, [{ op: "create_event_type", scope: "eventType", name: "Ver", primitive: "OCCURRENCE", sentence: "{target} se ve", ref: "e" },
    { op: "create_story", scope: "story", pageIndex: 0, name: "H", ref: "s" }, { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s"), eventTypeId: R("e"), target: { nodeId: 1 } }]));
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", story.project).valid, true);
});

test("documento antiguo que EXCEDE los límites: se abre, valida y se edita en lo que no los empeora", () => {
  const legacy = bigProject(350, 700, { x: 500000, w: 9000 });
  assert.equal(K.call("FluyoAuthoring.normalizedProject(__a)", legacy).ok, true);
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", legacy).valid, true);
  // No tocar lo que ya excede: etiqueta, otra página, renombrar, otro nodo, borrar.
  ok(apply(legacy, [UN(0, I(1), { label: "sigue fuera" }), CP("Extra"), RP(0, "Grande 2"), N(1, { x: 5 }), UN(0, I(2), { x: 99999 }), DN(0, I(3))]));
  assert.equal(ok(apply(legacy, [DN(0, I(3)), DN(0, I(4))])).project.doc.pages[0].nodes.length, 348, "reducir siempre es posible");
  // Mantener el número (crear y borrar) no es crecer.
  ok(apply(legacy, [N(0, { x: 1 }, { ref: "t" }), DN(0, R("t"))]));
  // Lo que escribe el lote sí se valida, aunque el documento ya esté fuera.
  assert.equal(first(apply(legacy, [UN(0, I(1), { x: 300000 })])).code, "LIMIT_EXCEEDED", "mover un nodo ya fuera a otro valor fuera");
  assert.equal(first(apply(legacy, [UN(0, I(1), { w: 6000 })])).limitName, "sizeMax");
  ok(apply(legacy, [UN(0, I(1), { x: 100, w: 200 })]));
  // Crecer sobre un documento que ya excede: se rechaza (350 → 351) con la cifra real.
  const e = first(apply(legacy, [N(0, { x: 7 })]));
  assert.deepEqual([e.code, e.limit, e.actual, e.field, e.limitName], ["LIMIT_EXCEEDED", 300, 351, "nodes", "maxNodesPerPage"]);
  assert.equal(first(apply(legacy, [C(0, I(1), I(2))])).actual, 701);
});

/* ─────────── límites de autoría ─────────── */
const lim = (r) => (r.ok ? null : r.errors.filter((e) => e.code === "LIMIT_EXCEEDED"));

test("coordenadas ±100000: exactamente en el límite vale; uno por encima se rechaza (x, y, ambos signos)", () => {
  for (const [x, y] of [[100000, 0], [-100000, 0], [0, 100000], [0, -100000], [100000, -100000]]) ok(apply(project(), [N(0, { x, y })]));
  for (const [spec, field, actual] of [[{ x: 100001 }, "x", 100001], [{ x: -100001 }, "x", -100001], [{ y: 100000.5 }, "y", 100000.5], [{ y: -100000.01 }, "y", -100000.01]]) {
    const e = first(apply(project(), [N(0, spec)]));
    assert.deepEqual([e.code, e.limit, e.actual, e.field, e.limitName, e.pageIndex, e.operationIndex, e.entity], ["LIMIT_EXCEEDED", 100000, actual, field, "coordMax", 0, 0, { kind: "node", id: 1 }]);
  }
  const b = ok(apply(project(), [N(0, {})])).project;
  ok(apply(b, [UN(0, I(1), { x: 100000, y: -100000 })]));
  assert.equal(first(apply(b, [UN(0, I(1), { x: 100001 })])).code, "LIMIT_EXCEEDED");
  assert.equal(first(apply(b, [UN(0, I(1), { x: 5, y: 1e9 })])).field, "y");
});

test("w/h entre 10 y 5000: en el límite valen; uno por debajo/encima se rechaza (create y update)", () => {
  ok(apply(project(), [N(0, { w: 10, h: 10 }), N(0, { w: 5000, h: 5000 }), N(0, { w: 10, h: 5000 })]));
  for (const [spec, field, limitName, limit] of [[{ w: 9.99 }, "w", "sizeMin", 10], [{ h: 9 }, "h", "sizeMin", 10], [{ w: 5001 }, "w", "sizeMax", 5000], [{ h: 5000.5 }, "h", "sizeMax", 5000]]) {
    const e = first(apply(project(), [N(0, spec)]));
    assert.deepEqual([e.code, e.field, e.limitName, e.limit, e.actual], ["LIMIT_EXCEEDED", field, limitName, limit, spec[field]]);
  }
  const b = ok(apply(project(), [N(0, {})])).project;
  assert.equal(first(apply(b, [UN(0, I(1), { w: 5001 })])).limitName, "sizeMax");
  assert.equal(first(apply(b, [UN(0, I(1), { h: 9 })])).limitName, "sizeMin");
  ok(apply(b, [UN(0, I(1), { w: 10, h: 5000 })]));
});

test("waypoints: sus puntos también respetan coordMax (create_connection y update_connection)", () => {
  const b = ok(apply(project(), [N(0, {}), N(0, { x: 300 }), C(0, I(1), I(2))])).project;
  ok(apply(b, [UC(0, I(3), { waypoints: [{ x: 100000, y: -100000 }] })]));
  const e = first(apply(b, [UC(0, I(3), { waypoints: [{ x: 1, y: 1 }, { x: 5, y: 100001 }] })]));
  assert.deepEqual([e.code, e.field, e.actual, e.entity], ["LIMIT_EXCEEDED", "waypoints[1].y", 100001, { kind: "connection", id: 3 }]);
  assert.equal(first(apply(project(), [N(0, {}, { ref: "a" }), N(0, { x: 9 }, { ref: "b" }), C(0, R("a"), R("b"), { spec: { waypoints: [{ x: -100002, y: 0 }] } })])).field, "waypoints[0].x");
  ok(apply(b, [UC(0, I(3), { label: "sin tocar waypoints" })]));
});

test("nodos por página: 300 vale, 301 se rechaza; el rechazo da limit, actual y field", () => {
  const at299 = bigProject(299, 0), at300 = bigProject(300, 0);
  ok(apply(at299, [N(0, { x: 1 })]));
  const e = first(apply(at300, [N(0, { x: 1 })]));
  assert.deepEqual([e.code, e.limit, e.actual, e.field, e.limitName, e.pageIndex, e.operation], ["LIMIT_EXCEEDED", 300, 301, "nodes", "maxNodesPerPage", 0, "create_node"]);
  assert.equal(first(apply(at299, [N(0, { x: 1 }), N(0, { x: 2 })])).actual, 301, "uno por encima, en un lote");
  assert.equal(first(apply(at299, [N(0, {}), N(0, {}), N(0, {})])).actual, 302);
  assert.equal(ok(apply(at300, [UN(0, I(1), { x: 5 })])).project.doc.pages[0].nodes.length, 300, "exactamente en el límite se puede seguir editando");
});

test("conexiones por página: 600 vale, 601 se rechaza", () => {
  const at599 = bigProject(5, 599), at600 = bigProject(5, 600);
  ok(apply(at599, [C(0, I(1), I(2))]));
  const e = first(apply(at600, [C(0, I(1), I(2))]));
  assert.deepEqual([e.code, e.limit, e.actual, e.field, e.limitName, e.operation], ["LIMIT_EXCEEDED", 600, 601, "connections", "maxConnectionsPerPage", "create_connection"]);
  ok(apply(at600, [UC(0, I(6), { label: "x" })]));
});

test("el límite es POR página: 300 nodos en la página 0 no cuentan en la 1", () => {
  const p = bigProject(300, 0);
  p.doc.pages.push(page("B"));
  ok(apply(p, [N(1, {}), N(1, {})]));
  assert.equal(first(apply(p, [N(0, {})])).pageIndex, 0);
  assert.equal(first(apply(p, [CP("C"), N(0, {})])).pageIndex, 0);
});

test("ESTADO FINAL: un lote que cruza el límite en un paso intermedio pero termina dentro es válido", () => {
  const at299 = bigProject(299, 0);
  // 299 → 302 → 300
  const r = ok(apply(at299, [N(0, { x: 1 }, { ref: "a" }), N(0, { x: 2 }, { ref: "b" }), N(0, { x: 3 }, { ref: "c" }), DN(0, R("a")), DN(0, R("b"))]));
  assert.equal(r.project.doc.pages[0].nodes.length, 300);
  // termina uno por encima: 299 → 302 → 301
  assert.equal(first(apply(at299, [N(0, {}, { ref: "a" }), N(0, {}), N(0, {}), DN(0, R("a"))])).actual, 301);
  // borrar nodos existentes y crear otros
  ok(apply(bigProject(300, 0), [DN(0, I(1)), N(0, {}), DN(0, I(2)), N(0, {})]));
  // conexiones: 599 → 602 → 600 (el borrado del nodo arrastra sus conexiones)
  const casc = bigProject(5, 599);
  casc.doc.pages[0].edges.forEach((e, i) => { if (i < 10) { e.from = 3; e.to = 4; } });
  assert.equal(ok(apply(casc, [C(0, I(1), I(2)), C(0, I(1), I(2)), C(0, I(1), I(2)), DN(0, I(3))])).project.doc.pages[0].edges.length, 592);
});

test("ESTADO FINAL: coordenadas y tamaños que salen del rango en un paso y vuelven, o se crean y se eliminan, son válidos", () => {
  const b = ok(apply(project(), [N(0, {}), N(0, { x: 300 })])).project;
  ok(apply(b, [UN(0, I(1), { x: 5e6 }), UN(0, I(1), { x: 20 })]));
  ok(apply(b, [UN(0, I(1), { w: 1e6 }), UN(0, I(1), { w: 200 })]));
  ok(apply(b, [N(0, { x: 1e9, w: 1 }, { ref: "tmp" }), DN(0, R("tmp"))]));
  ok(apply(b, [UN(0, I(1), { w: 1 }), DN(0, I(1))]));
  // el último valor manda
  assert.equal(first(apply(b, [UN(0, I(1), { x: 20 }), UN(0, I(1), { x: 5e6 })])).code, "LIMIT_EXCEEDED");
  assert.equal(first(apply(b, [UN(0, I(1), { x: 5e6 }), UN(0, I(2), { y: 1 })])).code, "LIMIT_EXCEEDED");
});

test("LIMIT_EXCEEDED: varios límites a la vez se listan todos, ordenados por operación y con operationIndex", () => {
  const r = apply(project(), [N(0, { x: 1 }), N(0, { x: 200000, w: 1 }), N(0, { y: -300000 })]);
  assert.equal(r.ok, false);
  assert.deepEqual(lim(r).map((e) => [e.operationIndex, e.field, e.limitName]), [[1, "x", "coordMax"], [1, "w", "sizeMin"], [2, "y", "coordMax"]]);
  assert.equal(r.project, undefined);
  assert.ok(r.errors.every((e) => e.limit !== undefined && e.actual !== undefined && e.field && e.message));
});

test("atomicidad: un rechazo por límite no muta el documento original (congelado) ni deja nada a medias", () => {
  const p = frozen(bigProject(300, 0));
  const snap = JSON.stringify(p);
  for (const ops of [[N(0, {})], [CP("Nueva"), N(1, { x: 1e7 })], [RP(0, "Z"), N(0, { x: 1 }), N(0, { w: 4 })], [UN(0, I(1), { x: 1 }), N(0, {})]]) {
    const r = apply(p, ops);
    assert.deepEqual([r.ok, r.project], [false, undefined]);
    assert.equal(r.errors[0].code, "LIMIT_EXCEEDED");
    assert.equal(JSON.stringify(p), snap);
  }
});

test("los límites no sustituyen a la integridad: un error de operación gana sobre el de límites; B2 sigue rechazando", () => {
  const e = first(apply(project(), [N(0, { x: 1e9 }), UN(0, I(99), { x: 1 })]));
  assert.equal(e.code, "NODE_NOT_FOUND", "el primer error de operación gana");
  const r = ok(apply(project(), [N(0, {}, { ref: "a" }), N(0, { x: 400 }, { ref: "b" }), C(0, R("a"), R("b"), { ref: "k" }),
    { op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source}→{target}", ref: "ev" },
    { op: "create_story", scope: "story", pageIndex: 0, name: "H", ref: "s" },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s"), eventTypeId: R("ev"), target: R("k") }]));
  assert.equal(first(apply(r.project, [DN(0, I(1))])).code, "REFERENCED_ENTITY");
});

test("los topes de entrada NO están en FluyoIntegrity ni en la carga: abrir, normalizar y describir no los aplican", () => {
  const big = bigProject(310, 610, { x: 250000, y: -250000, w: 9999, h: 3 });
  assert.equal(K.call("FluyoAuthoring.normalizedProject(__a)", big).ok, true);
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", big).valid, true);
  const doc = K.call("projectFromProjectData(__a).doc", big);
  assert.deepEqual([doc.pages[0].nodes.length, doc.pages[0].edges.length, doc.pages[0].nodes[0].x], [310, 610, 250000]);
});

test("las 8 plantillas/ejemplos (y los de regresión visual) se abren, y create_page + nodo + rename los admite sin tocar lo existente", () => {
  const dirs = ["ejemplos/data", "test/fixtures/regresion-visual"];
  let n = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(path.join(__dirname, "..", dir)).filter((x) => x.endsWith(".fluyo.json"))) {
      const p = JSON.parse(read(dir + "/" + f));
      const norm = K.call("FluyoAuthoring.normalizedProject(__a)", p);
      assert.equal(norm.ok, true, f);
      const r = ok(apply(p, [CP("Extra"), N(norm.project.doc.pages.length, { label: "nuevo" }), RP(0, "Renombrada")]));
      const before = norm.project.doc.pages, after = r.project.doc.pages;
      assert.equal(after.length, before.length + 1, f);
      assert.deepEqual(after[0], Object.assign({}, before[0], { name: "Renombrada" }), f + ": la página 0 solo cambia de nombre");
      assert.deepEqual(after.slice(1, before.length), before.slice(1), f + ": el resto no cambia");
      assert.equal(K.call("FluyoIntegrity.validateProject(__a)", r.project).valid, K.call("FluyoIntegrity.validateProject(__a)", p).valid, f);
      n++;
    }
  }
  assert.ok(n >= 11, "se probaron " + n);
});

/* ─────────── PARIDAD con el editor real ─────────── */
const GOLDEN = "test/fixtures/fluyo-018-5-golden.json";
const BASE_OPS = [
  N(0, { x: 200, y: 300, label: "Cliente" }, { ref: "cliente" }), N(0, { x: 600, y: 300, label: "Comercio" }, { ref: "comercio" }),
  C(0, R("cliente"), R("comercio"), { ref: "pago", spec: { label: "Pago" } }),
  CP("Datos"), N(1, { shape: "cylinder", x: 100, y: 100, label: "Base" }),
  { op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", ref: "pago" },
  { op: "create_event_type", scope: "eventType", name: "Aviso", primitive: "OCCURRENCE", sentence: "{target} avisa", ref: "aviso" },
  { op: "create_story", scope: "story", pageIndex: 0, name: "Compra", ref: "s" },
  { op: "add_step", scope: "story", pageIndex: 0, storyId: R("s"), eventTypeId: R("pago"), target: { edgeId: 3 } },
];
const start = () => ok(apply(project(), BASE_OPS)).project;
const traceOf = (p, pageIndex, storyId) => K.call("(function(){ const d=projectFromProjectData(__a.p).doc; const pg=d.pages[__a.pi]; return FluyoStory.run(pg, pg.scenarios.find(s=>s.id===__a.id)); })()", { p, pi: pageIndex, id: storyId });

/* Lote de author_document: documento multipágina; páginas nuevas (con y sin nombre), renombrados, nodos y conexión en la página nueva,
   y una Historia en una página existente y otra en la nueva. */
const PARITY_OPS = [
  CP(), CP("Reportes"), RP(1, "Datos 2"), RP(0, "Inicio"),
  N(2, { shape: "hex", x: 100, y: 100, label: "Origen" }, { ref: "a" }), N(2, { shape: "icon", icon: "db", x: 400, y: 100, label: "BD" }, { ref: "b" }),
  C(2, R("a"), R("b"), { ref: "k", spec: { label: "Lee", route: "ortho", fromSide: "e", toSide: "w" } }),
  N(3, { shape: "text", x: 0, y: 0, label: "Nota", border: "none" }),
  { op: "create_story", scope: "story", pageIndex: 2, name: "Lectura", ref: "t" },
  { op: "add_step", scope: "story", pageIndex: 2, storyId: R("t"), eventTypeId: 1, target: R("k") },
  { op: "add_step", scope: "story", pageIndex: 2, storyId: R("t"), eventTypeId: 2, target: { nodeId: R("b") } },
  { op: "add_step", scope: "story", pageIndex: 0, storyId: 1, eventTypeId: 2, target: { nodeId: 1 } },
];

test("PARIDAD: editor real (addPage/renamePage/newNode/newEdge + Historias) vs author_document — documento completo, deepStrictEqual sin normalizar", () => {
  const st = start();
  const E = editor();
  E.load(st);
  // Mismo orden que PARITY_OPS: create_page sin nombre → «Página 3», create_page «Reportes», renombrados, nodos, conexión, Historias.
  E.run(`
    const a3=createPageIn(doc);                          // Página 3 → pageIndex 2 (sin nombre)
    const a4=createPageIn(doc,"Reportes");               // pageIndex 3
    renamePage(1,"Datos 2"); renamePage(0,"Inicio");
    doc.cur=2;
    const na=newNode("hex",100,100,{label:"Origen"}), nb=newNode("icon",400,100,{icon:"db",label:"BD"});
    const ek=newEdge(na.id,nb.id,{label:"Lee",route:"ortho",fromSide:"e",toSide:"w"});
    doc.cur=3; newNode("text",0,0,{label:"Nota",border:"none"});
    const stepFor=(pg,sc,et,target)=>createStep(sc,stepDefinitionForEvent(eventTypeById(et),target,defaultStepTime(sc)));
    doc.cur=2; { const pg=P(); const sc=createScenario(pg,"Lectura"); stepFor(pg,sc,1,ek.id); stepFor(pg,sc,2,nb.id); }
    doc.cur=0; { const pg=P(); const sc=pg.scenarios.find(s=>s.id===1); stepFor(pg,sc,2,1); }
    doc.cur=${st.doc.cur};                               // MCP no cambia la página activa; addPage() del editor sí (ver test siguiente)
  `);
  const A = J(E.run("serializeProject()"));
  const au = ok(apply(st, PARITY_OPS));
  assert.deepStrictEqual(au.project, A);
  assert.equal(JSON.stringify(au.project), JSON.stringify(A), "mismo orden de claves");
  const B = au.project.doc;
  assert.deepEqual(B.pages.map((x) => x.name), ["Inicio", "Datos 2", "Página 3", "Reportes"]);
  assert.deepEqual([B.cur, B.nextEventTypeId, B.pages[2].nextId, B.pages[2].nextScenarioId], [0, 3, 4, 2]);
  // golden compartido con fluyo-mcp
  const golden = { start: st, operations: PARITY_OPS, document: au.project };
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(path.join(__dirname, "..", GOLDEN), JSON.stringify(golden, null, 2) + "\n");
  assert.deepStrictEqual(golden, JSON.parse(read(GOLDEN)), "golden compartido con fluyo-mcp desactualizado: UPDATE_GOLDEN=1");
  // Trace idéntico: Historia en página existente (0) y en la nueva (2), ejecutadas sobre cada documento.
  const edDoc = A, auDoc = au.project;
  assert.deepStrictEqual(traceOf(auDoc, 2, 1), traceOf(edDoc, 2, 1));
  assert.deepStrictEqual(traceOf(auDoc, 0, 1), traceOf(edDoc, 0, 1));
  assert.ok(traceOf(auDoc, 2, 1).trace.events.length >= 2, "la Historia de la página nueva se ejecuta");
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", au.project).valid, true);
});

test("PARIDAD: create_page + nodos + conexión sobre el documento mínimo y rename_page — editor = author_document, revisión determinista", () => {
  const E = editor(); E.load(project(page("A")));
  E.run(`createPageIn(doc,"B"); doc.cur=1; const x=newNode("rect",10,20,{label:"x"}), y=newNode("circle",300,20,{label:"y"}); newEdge(x.id,y.id); renamePage(0,"Inicio"); doc.cur=0;`);
  const au = ok(apply(project(page("A")), [CP("B"), N(1, { x: 10, y: 20, label: "x" }, { ref: "x" }), N(1, { shape: "circle", x: 300, y: 20, label: "y" }, { ref: "y" }), C(1, R("x"), R("y")), RP(0, "Inicio")]));
  assert.deepStrictEqual(au.project, J(E.run("serializeProject()")));
  assert.equal(JSON.stringify(au.project), E.run("JSON.stringify(serializeProject())"));
  assert.equal(JSON.stringify(ok(apply(project(page("A")), [CP("B")])).project), JSON.stringify(ok(apply(project(page("A")), [CP("B")])).project));
});

test("editor: addPage() crea y ACTIVA la página (navegación del editor); createPageIn no; renamePage rechaza nombres inválidos sin tocar la página", () => {
  const E = editor(); E.load(project(page("A"), page("B")));
  assert.equal(E.run("addPage().name"), "Página 3");
  assert.deepEqual(J(E.run("[doc.cur, doc.pages.length]")), [2, 3]);
  E.run("createPageIn(doc)");
  assert.deepEqual(J(E.run("[doc.cur, doc.pages.length, doc.pages[3].name]")), [2, 4, "Página 4"]);
  assert.equal(E.run("renamePage(0,'Nuevo').name"), "Nuevo");
  for (const bad of ["''", "'x'.repeat(81)", "'   '"]) assert.equal(E.run(`(function(){ try{ renamePage(1,${bad}); return "no"; }catch(e){ return e.code; } })()`), "invalid_page_name");
  assert.equal(E.run("doc.pages[1].name"), "B");
  assert.equal(E.run("(function(){ try{ renamePage(9,'x'); return 'no'; }catch(e){ return e.code; } })()"), "page_not_found");
});

test("el editor y MCP comparten las MISMAS funciones: ui.js no toca blankPage ni pg.name directamente", () => {
  const ui = read("js/ui.js");
  assert.equal(/blankPage\(/.test(ui), false, "ui.js no crea páginas por su cuenta");
  assert.equal(/pg\.name\s*=[^=]/.test(ui), false, "ui.js no renombra páginas por su cuenta");
  assert.match(ui, /addPage\(\)/);
  assert.match(ui, /renamePage\(i,nn\)/);
  const auth = read("js/story-authoring.js");
  assert.match(auth, /createPageIn\(ctx\.d, op\.name\)/);
  assert.match(auth, /renamePageIn\(ctx\.d, op\.pageIndex, op\.name\)/);
  assert.equal(/blankPage\(/.test(auth), false);
});

test("describe/limits: FluyoAuthoring.LIMITS es la única fuente de los topes (ningún literal duplicado en model.js ni en el editor)", () => {
  for (const f of ["js/model.js", "js/state.js", "js/ui.js", "js/interaction.js"]) assert.equal(/maxNodesPerPage|maxConnectionsPerPage|coordMax/.test(read(f)), false, f);
});
