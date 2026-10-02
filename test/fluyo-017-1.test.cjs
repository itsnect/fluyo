"use strict";
/* FLUYO-017.1 — Integridad de documento (FluyoIntegrity), receta única de ejecución y resultados por Step.
   Todo en `vm` sin DOM salvo la prueba de paridad con el camino REAL del editor (scRun).
   La misma fixture y el mismo golden se verifican en fluyo-mcp (test/fluyo-017-1-parity.test.ts). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { makeScenarioUIContext, setupPanel, ensureUI, freshPage } = require("./fluyo-016-harness.cjs");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js"];
const FIXTURE_FILE = "test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json";
const GOLDEN_FILE = "test/fixtures/fluyo-017-1-golden.json";
const J = (v) => JSON.parse(JSON.stringify(v));
const fixture = () => JSON.parse(read(FIXTURE_FILE));

function kernel() {
  const ctx = vm.createContext({});
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, ctx)); };
  return ctx;
}
const K = kernel();
const validate = (project) => K.call("FluyoIntegrity.validateProject(__a)", project);
const impact = (project, removal) => K.call("FluyoIntegrity.removalImpact(__a.p, __a.r)", { p: project, r: removal });
const page = (p) => p.doc.pages[0];
const story = (p, id) => page(p).scenarios.find((s) => s.id === id);
const extraNode = (id) => ({ id, label: "Auditoría", shape: "rect", x: 900, y: 500, w: 160, h: 70, order: 3, color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false });

/* ───────────────────────── FluyoIntegrity: documento válido ───────────────────────── */

test("el documento Cliente → Kafka → Comercio es válido y sus tres Historias ejecutables", () => {
  const r = validate(fixture());
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.schemaVersion, 5);
  assert.equal(r.engineVersion, 2);
  assert.deepEqual(r.stories, [1, 2, 3].map((storyId) => ({ pageIndex: 0, storyId, executable: true })));
});

test("Step válido: cada acción es la que corresponde a su EventType", () => {
  const spec = (et) => K.call("FluyoIntegrity.eventActionSpec(__a)", et);
  assert.deepEqual(spec({ primitive: "FLOW" }), { action: "SEND", target: "connection" });
  assert.deepEqual(spec({ primitive: "OCCURRENCE" }), { action: "OCCURRENCE", target: "element" });
  assert.deepEqual(spec({ primitive: "SET_AVAILABILITY", availability: "DOWN" }), { action: "SET_STATE", target: "element", state: "DOWN" });
  assert.equal(spec({ primitive: "otra" }), null);
});

test("validar no muta el documento recibido ni necesita DOM", () => {
  const p = fixture(), before = JSON.stringify(p);
  validate(p);
  impact(p, { pageIndex: 0, edgeIds: [5] });
  assert.equal(JSON.stringify(p), before);
  assert.equal(K.call("typeof window + typeof document"), "undefinedundefined");
});

/* ───────────────────────── B2: referencias a estructura ───────────────────────── */

test("B2: conexión eliminada y referenciada → error por Historia y Step, sin tocar nada más", () => {
  const p = fixture();
  page(p).edges = page(p).edges.filter((e) => e.id !== 5);          // lo que hoy hacen el editor y MCP
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.deepEqual(r.errors.map((e) => [e.code, e.scope, e.pageIndex, e.storyId, e.stepId, e.entityKind, e.entityId]), [
    ["missing_edge", "step", 0, 1, 3, "edge", 5],
    ["missing_edge", "step", 0, 2, 4, "edge", 5],
  ]);
  assert.match(r.errors[0].message, /conexión que ya no existe/);
  // La Historia C no usaba esa conexión y sigue ejecutable.
  assert.deepEqual(r.stories.map((s) => s.executable), [false, false, true]);
  // Detectar no limpia: el documento sigue teniendo los Steps.
  assert.equal(story(p, 1).steps.length, 3);
});

test("B2: nodo eliminado y referenciado → conexiones, Steps y Behaviors huérfanos", () => {
  const p = fixture();
  page(p).behaviors.push({ nodeId: 3, initialState: "DOWN" });
  page(p).nodes = page(p).nodes.filter((n) => n.id !== 3);
  page(p).edges = page(p).edges.filter((e) => e.to !== 3);
  const r = validate(p);
  const got = r.errors.map((e) => `${e.code}:${e.scope}:${e.storyId ?? "-"}:${e.stepId ?? "-"}:${e.entityKind}:${e.entityId}`);
  assert.ok(got.includes("missing_behavior_node:page:-:-:node:3"));
  assert.ok(got.includes("missing_edge:step:1:3:edge:5"));
  assert.ok(got.includes("missing_edge:step:2:4:edge:5"));
});

test("B2: un Step que apunta a un nodo inexistente", () => {
  const p = fixture();
  story(p, 3).steps[1].nodeId = 99;
  const e = validate(p).errors;
  assert.deepEqual(e.map((x) => [x.code, x.storyId, x.stepId, x.entityKind, x.entityId]), [["missing_node", 3, 2, "node", 99]]);
});

test("removalImpact: conexión usada por varias Historias → afecta exactamente a esas Historias y Steps", () => {
  const r = impact(fixture(), { pageIndex: 0, edgeIds: [4] });         // Cliente → Kafka: la usan A (step 2) y B (step 2)
  assert.equal(r.wouldInvalidate, true);
  assert.deepEqual(r.affectedStories, [
    { pageIndex: 0, storyId: 1, storyName: "Historia A", stepIds: [1], codes: ["missing_edge"] },
    { pageIndex: 0, storyId: 2, storyName: "Historia B", stepIds: [2], codes: ["missing_edge"] },
  ]);
});

test("removalImpact: la conexión 5 la usan A (step 3) y B (step 4); C queda intacta", () => {
  const r = impact(fixture(), { pageIndex: 0, edgeIds: [5] });
  assert.deepEqual(r.affectedStories.map((s) => [s.storyId, s.stepIds]), [[1, [3]], [2, [4]]]);
});

test("removalImpact: conexión no usada → nada queda inválido", () => {
  const p = fixture();
  page(p).edges.push({ id: 6, from: 1, to: 3, label: "sin usar", fromSide: null, toSide: null, route: "straight", waypoints: [], endArrow: true, startArrow: false, flowDir: "normal" });
  page(p).nextId = 7;
  assert.equal(validate(p).valid, true);
  const r = impact(p, { pageIndex: 0, edgeIds: [6] });
  assert.deepEqual([r.wouldInvalidate, r.errors, r.affectedStories], [false, [], []]);
});

test("removalImpact: nodo usado → todas las Historias que lo tocan, y sus conexiones", () => {
  const r = impact(fixture(), { pageIndex: 0, nodeIds: [2] });          // Kafka: lo usan A, B y C
  assert.equal(r.wouldInvalidate, true);
  assert.deepEqual(r.affectedStories.map((s) => s.storyId), [1, 2, 3]);
  const a = r.affectedStories.find((s) => s.storyId === 1);
  assert.deepEqual(a.stepIds, [1, 2, 3]);
  assert.ok(a.codes.includes("missing_edge") && a.codes.includes("missing_node"));
});

test("removalImpact: nodo no usado → nada queda inválido", () => {
  const p = fixture();
  page(p).nodes.push(extraNode(6));
  page(p).nextId = 7;
  assert.equal(validate(p).valid, true);
  const r = impact(p, { pageIndex: 0, nodeIds: [6] });
  assert.equal(r.wouldInvalidate, false);
  assert.deepEqual(r.affectedStories, []);
});

test("removalImpact: un nodo con Behavior propio deja el Behavior huérfano (página, no Historia)", () => {
  const p = fixture();
  page(p).nodes.push(extraNode(6));
  page(p).behaviors.push({ nodeId: 6, initialState: "DOWN" });
  page(p).nextId = 7;
  const r = impact(p, { pageIndex: 0, nodeIds: [6] });
  assert.deepEqual(r.errors.map((e) => [e.code, e.scope, e.entityId]), [["missing_behavior_node", "page", 6]]);
  assert.deepEqual(r.affectedStories, []);
});

test("removalImpact: los errores que ya existían no se atribuyen a la eliminación", () => {
  const p = fixture();
  story(p, 3).steps[1].nodeId = 99;                                      // ya roto de antemano
  const r = impact(p, { pageIndex: 0, edgeIds: [4] });
  assert.deepEqual(r.affectedStories.map((s) => s.storyId), [1, 2]);
  assert.equal(impact(p, { pageIndex: 7, edgeIds: [4] }).error, "page_not_found");
});

/* ───────────────────────── EventTypes y acciones ───────────────────────── */

test("EventType inexistente → missing_event_type con Historia, Step y EventType", () => {
  const p = fixture();
  story(p, 1).steps[0].eventTypeId = 99;
  const r = validate(p);
  assert.deepEqual(r.errors.map((e) => [e.code, e.scope, e.storyId, e.stepId, e.entityKind, e.entityId]), [["missing_event_type", "step", 1, 1, "eventType", 99]]);
  assert.equal(r.stories[0].executable, false);
});

test("acción incompatible con su EventType: primitiva y disponibilidad", () => {
  const p = fixture();
  story(p, 1).steps[1].eventTypeId = 1;                                  // OCCURRENCE con un EventType FLOW
  story(p, 2).steps[0].state = "UP";                                     // «Caída» (DOWN) aplicada como UP
  const r = validate(p);
  assert.deepEqual(r.errors.map((e) => [e.code, e.storyId, e.stepId, e.reason]), [
    ["event_type_action_mismatch", 1, 2, "action"],
    ["event_type_action_mismatch", 2, 1, "availability"],
  ]);
});

test("un Step sin eventTypeId (legacy) es válido", () => {
  const p = fixture();
  delete story(p, 1).steps[0].eventTypeId;
  assert.equal(validate(p).valid, true);
});

/* ───────────────────────── Historias, ids, schema y engine ───────────────────────── */

test("Behavior que apunta a un elemento inexistente → error de página", () => {
  const p = fixture();
  page(p).behaviors.push({ nodeId: 42, initialState: "DOWN" });
  const e = validate(p).errors;
  assert.deepEqual(e.map((x) => [x.code, x.scope, x.pageIndex, x.entityKind, x.entityId]), [["missing_behavior_node", "page", 0, "node", 42]]);
  assert.equal(e[0].storyId, undefined);
});

test("ids de conexión duplicados → error de página; una página sin Historias también se valida", () => {
  const p = fixture();
  page(p).scenarios = [];
  page(p).edges[1].id = 4;
  const e = validate(p).errors;
  assert.deepEqual(e.map((x) => [x.code, x.scope]), [["duplicate_edge_id", "page"]]);
});

test("Historia con engineVersion no soportada → error de Historia, no ejecutable", () => {
  const p = fixture();
  story(p, 2).engineVersion = 3;
  const r = validate(p);
  assert.deepEqual(r.errors.map((e) => [e.code, e.scope, e.storyId]), [["unsupported_engine_version", "story", 2]]);
  assert.deepEqual(r.stories.map((s) => s.executable), [true, false, true]);
});

test("tiempo fuera de rango", () => {
  const p = fixture();
  story(p, 1).steps[2].at = 86400001;
  assert.deepEqual(validate(p).errors.map((e) => [e.code, e.stepId]), [["invalid_timestamp", 3]]);
});

test("Step con forma inválida → invalid_step localizado (la normalización no deja continuar)", () => {
  const p = fixture();
  story(p, 2).steps[1].extra = true;
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.deepEqual(r.errors.map((e) => [e.code, e.scope, e.pageIndex, e.storyId, e.stepId]), [["invalid_step", "step", 0, 2, 2]]);
  assert.deepEqual(r.stories, []);
});

test("EventType con datos inválidos → invalid_event_type", () => {
  const p = fixture();
  p.doc.eventTypes[0].sentenceTemplate = "{nope}";
  assert.deepEqual(validate(p).errors.map((e) => [e.code, e.scope, e.entityKind, e.entityId]), [["invalid_event_type", "document", "eventType", 1]]);
});

test("versión de documento no soportada, documento vacío y documento que no es objeto", () => {
  const p = fixture(); p.version = 6;
  assert.deepEqual(validate(p).errors.map((e) => e.code), ["unsupported_version"]);
  assert.deepEqual(validate({}).errors.map((e) => [e.code, e.scope]), [["invalid_document", "document"]]);
  assert.equal(validate(null).valid, false);
  assert.equal(validate("x").schemaVersion, null);
});

test("documento legacy (v3, sin EventTypes ni Historias) es válido", () => {
  const legacy = { version: 3, app: "fluyo", doc: { theme: "dark", cur: 0, pages: [{ name: "P", nodes: [{ id: 1, label: "A", shape: "rect", x: 0, y: 0 }], edges: [], nextId: 2 }] }, settings: {} };
  const r = validate(legacy);
  assert.equal(r.valid, true);
  assert.equal(r.schemaVersion, 3);
  assert.deepEqual(r.stories, []);
});

/* ───────────────────────── Receta única: run + outcomes ───────────────────────── */

function runStory(project, storyId) {
  return K.call(`(function(){
    const d = projectFromProjectData(__a.p).doc; doc = d;
    const pg = d.pages[0], sc = pg.scenarios.find(s => s.id === __a.id);
    const r = FluyoStory.run(pg, sc);
    return r.ok ? {ok:true, trace:r.trace, outcomes:FluyoStory.outcomes(r.trace, sc, pg), stepMeta:FluyoStory.stepMeta(sc.steps)} : r;
  })()`, { p: project, id: storyId });
}
const statuses = (r) => r.outcomes.map((o) => [o.stepId, o.status, o.reason, o.nodeAvailability]);

test("Historia A: los dos envíos se completan y Procesamiento se narra con Kafka disponible", () => {
  const r = runStory(fixture(), 1);
  assert.deepEqual(statuses(r), [[1, "completed", undefined, undefined], [2, "narrated", undefined, "UP"], [3, "completed", undefined, undefined]]);
  assert.equal(r.trace.engineVersion, 2);
});

test("Historia B: Kafka caído → el pago no llega, «procesa» queda narrado y la confirmación no sale", () => {
  const r = runStory(fixture(), 2);
  assert.deepEqual(r.outcomes.map((o) => [o.stepId, o.at, o.status, o.reason, o.reasonNodeId, o.nodeAvailability]), [
    [1, 0, "state_changed", undefined, undefined, undefined],
    [2, 1000, "not_completed", "target_down", 2, undefined],
    [3, 2000, "narrated", undefined, undefined, "DOWN"],
    [4, 3000, "not_completed", "source_down", 2, undefined],
  ]);
  assert.equal(r.outcomes[0].from, "UP");
  assert.equal(r.outcomes[0].to, "DOWN");
});

test("OCCURRENCE con Kafka DOWN es un acontecimiento narrado: el motor lo registra igualmente", () => {
  const r = runStory(fixture(), 3);
  const occ = r.outcomes[1];
  assert.equal(occ.status, "narrated");
  assert.equal(occ.nodeAvailability, "DOWN");
  assert.match(occ.note, /no comprueba disponibilidad/);
  assert.ok(r.trace.events.some((e) => e.type === "event_occurred" && e.nodeId === 2), "el Trace contiene event_occurred");
  assert.ok(!r.trace.events.some((e) => e.type === "send_failed"), "no hay ningún fallo inventado");
});

test("un SET_STATE hacia el estado que ya tiene no emite evento: no_change", () => {
  const p = fixture();
  story(p, 3).steps.push({ id: 3, at: 2000, action: "SET_STATE", nodeId: 2, state: "DOWN", eventTypeId: 4 });
  story(p, 3).nextStepId = 4;
  assert.deepEqual(runStory(p, 3).outcomes.map((o) => o.status), ["state_changed", "narrated", "no_change"]);
});

test("Historia inválida: no hay Trace, sólo los errores del motor", () => {
  const p = fixture();
  page(p).edges = page(p).edges.filter((e) => e.id !== 5);
  const r = runStory(p, 1);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => e.code), ["missing_edge"]);
});

test("el resultado se deriva únicamente del Trace (cada Step apunta a sus eventos)", () => {
  const r = runStory(fixture(), 2);
  for (const o of r.outcomes) for (const i of o.eventIndexes) assert.equal(r.trace.events[i].stepId, o.stepId);
  assert.equal(r.outcomes.flatMap((o) => o.eventIndexes).length, r.trace.events.length);
});

test("sentence: misma regla que el panel de Historia", () => {
  const out = K.call(`(function(){ doc = projectFromProjectData(__a).doc; const pg = doc.pages[0];
    return pg.scenarios[1].steps.map(s => FluyoStory.sentence(pg, s, eventTypeById(s.eventTypeId))); })()`, fixture());
  assert.deepEqual(out, ["Kafka deja de responder", "Cliente paga a Kafka", "Kafka procesa el evento", "Comercio recibe confirmación de Kafka"]);
});

/* ───────────────────────── Paridad con el editor ───────────────────────── */

/* Camino 1: el EDITOR real (editor-scenarios.js, scRun → FluyoStory.start → playback.trace). */
function editorPath(storyId) {
  const h = makeScenarioUIContext();
  const { ctx, register } = h;
  freshPage(ctx);
  setupPanel(ctx, register);
  ctx.renderTabs = () => ctx.run("scSyncPage()");
  ensureUI(ctx);
  ctx.__fixture = fixture();
  ctx.run("doc = projectFromProjectData(__fixture).doc; undoStack = []; redoStack = [];");
  ctx.run(`scSelectStory(${storyId}); scRun();`);
  return J({
    trace: ctx.run("scPlayback.trace"),
    stepMeta: ctx.run("scPlayback.stepMeta"),
  });
}

test("paridad: el Trace y la metadata de Step del editor real == FluyoStory.run en el kernel", () => {
  for (const id of [1, 2, 3]) {
    const ed = editorPath(id);
    const k = runStory(fixture(), id);
    assert.ok(ed.trace && ed.trace.events.length, `el editor ejecutó la Historia ${id}`);
    assert.deepEqual(ed.trace, k.trace, `Trace de la Historia ${id}`);
    assert.deepEqual(ed.stepMeta, k.stepMeta, `stepMeta de la Historia ${id}`);
  }
});

test("golden: lo que producen el editor y el kernel es EXACTAMENTE el golden compartido con fluyo-mcp", () => {
  const golden = {};
  for (const id of [1, 2, 3]) {
    const ed = editorPath(id), k = runStory(fixture(), id);
    golden[id] = { trace: ed.trace, stepMeta: ed.stepMeta, outcomes: k.outcomes };
  }
  const file = path.join(__dirname, "..", GOLDEN_FILE);
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(file, JSON.stringify(golden, null, 2) + "\n");
  assert.deepEqual(golden, JSON.parse(fs.readFileSync(file, "utf8")));
});

test("start() sigue entregando el mismo Trace que run() (una sola receta)", () => {
  const out = K.call(`(function(){ doc = projectFromProjectData(__a).doc; const pg = doc.pages[0], sc = pg.scenarios[1];
    return {run:FluyoStory.run(pg, sc).trace, start:FluyoStory.start(pg, sc, 0).playback.trace}; })()`, fixture());
  assert.deepEqual(out.start, out.run);
});
