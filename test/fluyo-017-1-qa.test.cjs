"use strict";
/* FLUYO-017.1 — QA independiente y adversarial (lectura / validación / ejecución).
   Complementa test/fluyo-017-1.test.cjs: documentos hostiles, `removalImpact` bajo ataque, paridad con un fixture
   complejo (waits, simultaneidad, disponibilidad inicial, efectos visuales, fallos, EventTypes con motion/presentation),
   aislamiento (entradas congeladas, ejecuciones repetidas) y un fuzz determinista con invariantes.
   Sólo detecta y ejecuta: no hay ninguna prueba de autoría. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { makeScenarioUIContext, setupPanel, ensureUI, freshPage } = require("./fluyo-016-harness.cjs");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js"];
const J = (v) => JSON.parse(JSON.stringify(v));
const simple = () => JSON.parse(read("test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json"));
const complex = () => JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));
const GOLDEN2 = "test/fixtures/fluyo-017-1-qa-golden.json";

function kernel() {
  const ctx = vm.createContext({});
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, ctx)); };
  return ctx;
}
const K = kernel();
const validate = (p) => K.call("FluyoIntegrity.validateProject(__a)", p);
const impact = (p, r) => K.call("FluyoIntegrity.removalImpact(__a.p, __a.r)", { p, r });
const pg = (d, i = 0) => d.doc.pages[i];
const sc = (d, i, pi = 0) => pg(d, pi).scenarios[i];
const brief = (r) => r.errors.map((e) => [e.code, e.scope, e.storyId, e.stepId, e.entityKind, e.entityId]);

/* ═══════════════ 1. Integridad adversarial ═══════════════ */

const HOSTILE = [
  // [nombre, mutación, errores esperados [code, scope, storyId, stepId, entityKind, entityId]]
  ["Step de conexión apuntando a un nodo", (d) => { sc(d, 0).steps[0].edgeId = 2; }, [["missing_edge", "step", 1, 1, "edge", 2]]],
  ["Step de nodo (OCCURRENCE) apuntando a una conexión", (d) => { sc(d, 0).steps[1].nodeId = 4; }, [["missing_node", "step", 1, 2, "node", 4]]],
  ["Step de nodo (SET_STATE) apuntando a una conexión", (d) => { sc(d, 1).steps[0].nodeId = 5; }, [["missing_node", "step", 2, 1, "node", 5]]],
  ["Step con conexión inexistente", (d) => { sc(d, 0).steps[0].edgeId = 99; }, [["missing_edge", "step", 1, 1, "edge", 99]]],
  ["conexión con origen inexistente", (d) => { pg(d).edges[0].from = 77; }, [["missing_edge_endpoint", "page", undefined, undefined, "edge", 4]]],
  ["conexión con destino inexistente", (d) => { pg(d).edges[0].to = 77; }, [["missing_edge_endpoint", "page", undefined, undefined, "edge", 4]]],
  ["Behavior de un nodo inexistente", (d) => { pg(d).behaviors.push({ nodeId: 42, initialState: "DOWN" }); }, [["missing_behavior_node", "page", undefined, undefined, "node", 42]]],
  ["Behavior con estado inválido", (d) => { pg(d).behaviors.push({ nodeId: 2, initialState: "MAYBE" }); }, [["invalid_behavior", "page", undefined, undefined, "node", 2]]],
  ["EventType inexistente", (d) => { sc(d, 0).steps[0].eventTypeId = 99; }, [["missing_event_type", "step", 1, 1, "eventType", 99]]],
  ["EventType de otra primitiva (FLOW sobre OCCURRENCE)", (d) => { sc(d, 0).steps[1].eventTypeId = 1; }, [["event_type_action_mismatch", "step", 1, 2, "eventType", 1]]],
  ["EventType de disponibilidad usado en un envío", (d) => { sc(d, 0).steps[0].eventTypeId = 4; }, [["event_type_action_mismatch", "step", 1, 1, "eventType", 4]]],
  ["SET_STATE contradice la disponibilidad de su EventType", (d) => { sc(d, 1).steps[0].state = "UP"; }, [["event_type_action_mismatch", "step", 2, 1, "eventType", 4]]],
  ["ids de Historia repetidos en una página", (d) => { sc(d, 1).id = 1; }, [["duplicate_story_id", "story", 1, undefined, undefined, undefined]]],
  ["ids de Step repetidos en una Historia", (d) => { sc(d, 0).steps[1].id = 1; }, [["duplicate_step_id", "step", 1, 1, undefined, undefined]]],
  ["ids de EventType repetidos", (d) => { d.doc.eventTypes[1].id = 1; }, [["duplicate_event_type_id", "document", undefined, undefined, "eventType", 1]]],
  ["ids de nodo repetidos", (d) => { pg(d).nodes[1].id = 1; }, [["duplicate_node_id", "page", undefined, undefined, "node", 1]]],
  ["id de conexión igual al de un nodo", (d) => { pg(d).edges[0].id = 1; }, [["duplicate_structure_id", "page", undefined, undefined, "edge", 1]]],
  ["tiempo negativo", (d) => { sc(d, 0).steps[0].at = -1; }, [["invalid_step", "step", 1, 1, undefined, undefined]]],
  ["tiempo fuera del máximo de 24 h", (d) => { sc(d, 0).steps[0].at = 86400001; }, [["invalid_timestamp", "step", 1, 1, undefined, undefined]]],
  ["tiempo no entero / texto / 1e308", (d) => { sc(d, 0).steps[0].at = 1.5; }, [["invalid_step", "step", 1, 1, undefined, undefined]]],
  ["acción desconocida", (d) => { sc(d, 0).steps[0].action = "TELEPORT"; }, [["invalid_step", "step", 1, 1, undefined, undefined]]],
  ["campo extra en un Step", (d) => { sc(d, 0).steps[0].payload = 1; }, [["invalid_step", "step", 1, 1, undefined, undefined]]],
  ["Step SET_STATE sin estado", (d) => { delete sc(d, 1).steps[0].state; }, [["invalid_step", "step", 2, 1, undefined, undefined]]],
  ["nombre de Historia vacío", (d) => { sc(d, 0).name = "  "; }, [["invalid_scenario", "story", 1, undefined, undefined, undefined]]],
  ["Historia sin lista de Steps", (d) => { delete sc(d, 0).steps; }, [["invalid_scenario", "story", 1, undefined, undefined, undefined]]],
  ["motor 0 / «2» / 2,5 (forma inválida)", (d) => { sc(d, 0).engineVersion = "2"; }, [["invalid_scenario", "story", 1, undefined, undefined, undefined]]],
  ["OCCURRENCE en una Historia de motor 1", (d) => { sc(d, 0).engineVersion = 1; }, [["invalid_scenario", "story", 1, undefined, undefined, undefined]]],
  ["motor demasiado nuevo (3)", (d) => { sc(d, 1).engineVersion = 3; }, [["unsupported_engine_version", "story", 2, undefined, undefined, undefined]]],
  ["schema demasiado nuevo (6)", (d) => { d.version = 6; }, [["unsupported_version", "document", undefined, undefined, undefined, undefined]]],
  ["schema 0", (d) => { d.version = 0; }, [["unsupported_version", "document", undefined, undefined, undefined, undefined]]],
  ["schema como texto", (d) => { d.version = "5"; }, [["invalid_document", "document", undefined, undefined, undefined, undefined]]],
  ["app distinta de «fluyo»", (d) => { d.app = "otra"; }, [["invalid_document", "document", undefined, undefined, undefined, undefined]]],
  ["EventType con frase inválida", (d) => { d.doc.eventTypes[0].sentenceTemplate = "{nope}"; }, [["invalid_event_type", "document", undefined, undefined, "eventType", 1]]],
  ["elemento con id no entero", (d) => { pg(d).nodes[0].id = "uno"; }, [["invalid_structure", "page", undefined, undefined, "node", "uno"]]],
];
for (const [name, mutate, expected] of HOSTILE) {
  test(`hostil · ${name}`, () => {
    const d = simple(), before = (mutate(d), JSON.stringify(d));
    const r = validate(d);
    assert.equal(r.valid, false);
    assert.deepEqual(brief(r), expected);
    assert.equal(JSON.stringify(d), before, "la validación no muta la entrada");
    assert.deepEqual(validate(d), r, "determinista");
  });
}

test("legal · ids repetidos ENTRE páginas, Historia vacía, mismo EventType y misma conexión en varias Historias", () => {
  const d = complex();
  assert.equal(pg(d, 0).scenarios[0].id, pg(d, 1).scenarios[0].id);       // id 1 en las dos páginas
  const empty = simple(); sc(empty, 0).steps = [];
  assert.equal(validate(empty).valid, true);
  assert.equal(validate(d).valid, true);
  assert.equal(validate(simple()).valid, true);
});

test("versiones: 1..5 (y sin versión) se aceptan; v1 con motor 1 es válida y ejecutable", () => {
  for (const v of [1, 2, 3, 4, 5, undefined]) { const d = simple(); if (v === undefined) delete d.version; else d.version = v; assert.equal(validate(d).valid, true, `version ${v}`); }
  const r = validate(complex());
  assert.deepEqual(r.stories.map((s) => [s.pageIndex, s.storyId, s.executable]), [[0, 1, true], [0, 2, true], [0, 3, true], [1, 1, true]]);
  const v1 = K.call("(function(){ doc = projectFromProjectData(__a).doc; const p = doc.pages[0], s = p.scenarios[2]; const r = FluyoStory.run(p, s); return {ok: r.ok, ev: r.ok && r.trace.events.length, ver: s.engineVersion}; })()", complex());
  assert.deepEqual(v1, { ok: true, ev: 3, ver: 1 });
});

test("formato legacy v1 (`state` en vez de `doc`) se lee y valida", () => {
  const legacy = { version: 1, app: "fluyo", state: { theme: "dark", nodes: [{ id: 1, label: "A", x: 0, y: 0 }, { id: 2, label: "B", x: 200, y: 0 }], edges: [{ id: 3, from: 1, to: 2 }], nextId: 4 }, settings: {} };
  const r = validate(legacy);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.equal(r.schemaVersion, 1);
});

test("los ejemplos publicados (ejemplos/data) validan sin errores", () => {
  const dir = path.join(__dirname, "..", "ejemplos", "data");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const r = validate(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
    assert.equal(r.valid, true, `${f}: ${JSON.stringify(r.errors)}`);
  }
});

test("entradas que no son documento no lanzan nunca", () => {
  for (const bad of [null, undefined, [], "x", 5, true, {}, { doc: null }, { doc: { pages: [null] } }, { doc: { pages: [{ nodes: null, edges: [] }] } }])
    assert.equal(validate(bad).valid, false);
});

test("sin DOM ni globales del navegador y sin estado entre validaciones", () => {
  assert.equal(K.call("typeof window + typeof document + typeof localStorage + typeof navigator"), "undefinedundefinedundefinedundefined");
  const a = validate(complex());
  validate(simple());
  assert.deepEqual(validate(complex()), a);
});

/* ═══════════════ 2. removalImpact bajo ataque ═══════════════ */

/* A → B (nodos 1 y 2, conexión 4). `uses[i]` = ¿la Historia i usa A→B? (si no, usa sólo el nodo A). */
function mini(uses) {
  const d = simple(), p = pg(d);
  p.nodes = p.nodes.slice(0, 2); p.edges = [p.edges[0]]; p.behaviors = [];
  p.scenarios = uses.map((u, i) => ({ id: i + 1, engineVersion: 2, name: "H" + (i + 1), nextStepId: 2,
    steps: [u ? { id: 1, at: 0, action: "SEND", edgeId: 4, eventTypeId: 1 } : { id: 1, at: 0, action: "OCCURRENCE", nodeId: 1, eventTypeId: 2 }] }));
  p.nextScenarioId = 10;
  return d;
}
const aff = (r) => r.affectedStories.map((s) => [s.storyId, s.stepIds, s.codes]);

test("removalImpact · una Historia usa A→B: quitar A, B o A→B la invalida exactamente", () => {
  const d = mini([true]);
  for (const removal of [{ nodeIds: [1] }, { nodeIds: [2] }, { edgeIds: [4] }]) {
    const r = impact(d, { pageIndex: 0, ...removal });
    assert.equal(r.wouldInvalidate, true);
    assert.deepEqual(aff(r), [[1, [1], ["missing_edge"]]], JSON.stringify(removal));
    assert.deepEqual(brief({ errors: r.errors }), [["missing_edge", "step", 1, 1, "edge", 4]]);
  }
});

test("removalImpact · Historias 1 y 2 usan A→B y la 3 no: informa 1 y 2, no la 3", () => {
  const d = mini([true, true, false]);
  for (const removal of [{ nodeIds: [2] }, { edgeIds: [4] }]) {
    const r = impact(d, { pageIndex: 0, ...removal });
    assert.deepEqual(r.affectedStories.map((s) => s.storyId), [1, 2], JSON.stringify(removal));
    assert.deepEqual(r.affectedStories.map((s) => s.storyName), ["H1", "H2"]);
  }
  // Quitar A (nodo 1) también invalida a la 3, que usa OCCURRENCE sobre A: se informa con su código propio.
  assert.deepEqual(aff(impact(d, { pageIndex: 0, nodeIds: [1] })), [[1, [1], ["missing_edge"]], [2, [1], ["missing_edge"]], [3, [1], ["missing_node"]]]);
});

test("removalImpact · evalúa el ESTADO FINAL: Step retargetado + conexión eliminada no se bloquea", () => {
  const d = mini([true]), p = pg(d);
  p.edges.push({ ...p.edges[0], id: 6, label: "alternativa" }); p.nextId = 7;
  p.scenarios[0].steps[0].edgeId = 6;                                 // ya retargetado a la conexión 6
  const r = impact(d, { pageIndex: 0, edgeIds: [4] });
  assert.deepEqual([r.wouldInvalidate, r.errors, r.affectedStories], [false, [], []]);
  // Y el mismo documento SIN retarget sí queda inválido (el caso se distingue).
  assert.equal(impact(mini([true]), { pageIndex: 0, edgeIds: [4] }).wouldInvalidate, true);
});

test("removalImpact · no modifica nada y soporta argumentos hostiles sin lanzar", () => {
  const d = complex(), before = JSON.stringify(d);
  for (const removal of [undefined, null, {}, { pageIndex: 0 }, { pageIndex: -1, edgeIds: [5] }, { pageIndex: 9, nodeIds: [1] }, { pageIndex: 0, nodeIds: "x", edgeIds: 5 }, { pageIndex: 0, edgeIds: [999] }])
    assert.doesNotThrow(() => impact(d, removal));
  assert.equal(impact(d, undefined).error, "page_not_found");
  assert.equal(impact(d, { pageIndex: 0, edgeIds: [999] }).wouldInvalidate, false);
  assert.equal(JSON.stringify(d), before);
});

test("removalImpact · sobre varias páginas sólo afecta a la página indicada (ids repetidos entre páginas)", () => {
  const d = complex();
  const r = impact(d, { pageIndex: 1, edgeIds: [3] });                // la conexión 3 de la página 2; la página 1 también tiene un id 3 (nodo Comercio)
  assert.deepEqual(r.affectedStories.map((s) => [s.pageIndex, s.storyId]), [[1, 1]]);
});

test("removalImpact · errores previos no se atribuyen a la eliminación", () => {
  const d = mini([true, true]); sc(d, 1).steps[0].edgeId = 99;
  assert.deepEqual(impact(d, { pageIndex: 0, edgeIds: [4] }).affectedStories.map((s) => s.storyId), [1]);
});

/* ═══════════════ 3. Paridad editor ↔ kernel con un fixture complejo ═══════════════ */

/* Camino 1: el EDITOR real (scRun → FluyoStory.start → playback). Devuelve la representación que se compara. */
function editorPath(fixture, pageIndex, storyId) {
  const { ctx, register } = makeScenarioUIContext();
  freshPage(ctx); setupPanel(ctx, register);
  ctx.renderTabs = () => ctx.run("scSyncPage()");
  ensureUI(ctx);
  ctx.__fixture = fixture;
  ctx.run(`doc = projectFromProjectData(__fixture).doc; doc.cur = ${pageIndex}; undoStack = []; redoStack = [];`);
  ctx.run(`scSyncPage(); scSelectStory(${storyId}); scRun();`);
  // Estado final: se lleva el reloj del Playback del editor hasta el final y se lee lo que pintaría.
  const out = J({
    trace: ctx.run("scPlayback.trace"),
    stepMeta: ctx.run("scPlayback.stepMeta"),
    finalNodeStates: ctx.run("FluyoScenarioPlayback.tick(scPlayback, scPlayback.startedAtReal + 1e9).nodeStates"),
    activeStory: ctx.run("scActiveScenario().id"),
  });
  assert.equal(out.activeStory, storyId, "el editor ejecutó la Historia pedida");
  return out;
}
/* Camino 2: el kernel, con la misma receta que usa MCP (run + outcomes + finalAvailability). */
function kernelPath(fixture, pageIndex, storyId) {
  return K.call(`(function(){
    const d = projectFromProjectData(__a.p).doc; doc = d;
    const page = d.pages[__a.pi], story = page.scenarios.find(s => s.id === __a.id);
    const r = FluyoStory.run(page, story);
    const pb = FluyoStory.start(page, story, 0).playback;
    return {trace: r.trace, stepMeta: pb.stepMeta, outcomes: FluyoStory.outcomes(r.trace, story, page),
            finalAvailability: FluyoStory.finalAvailability(r.trace, page),
            finalNodeStates: FluyoScenarioPlayback.tick(pb, 1e9).nodeStates};
  })()`, { p: fixture, pi: pageIndex, id: storyId });
}

const COMPLEX_STORIES = [[0, 1], [0, 2], [0, 3], [1, 1]];
test("paridad compleja: Trace, metadata, estado final y resultados == camino real del editor (deepStrictEqual)", () => {
  const golden = {};
  for (const [pi, id] of COMPLEX_STORIES) {
    const ed = editorPath(complex(), pi, id), k = kernelPath(complex(), pi, id);
    assert.deepStrictEqual(k.trace, ed.trace, `Trace ${pi}:${id}`);
    assert.deepStrictEqual(k.stepMeta, ed.stepMeta, `stepMeta ${pi}:${id}`);
    assert.deepStrictEqual(k.finalNodeStates, ed.finalNodeStates, `estado final (Playback) ${pi}:${id}`);
    // La disponibilidad final derivada del Trace coincide con la del Playback para todo elemento que cambió.
    for (const [nodeId, st] of Object.entries(ed.finalNodeStates)) assert.equal(k.finalAvailability[nodeId], st, `disponibilidad final del nodo ${nodeId}`);
    golden[`${pi}:${id}`] = { trace: ed.trace, stepMeta: ed.stepMeta, outcomes: k.outcomes, finalAvailability: k.finalAvailability, finalNodeStates: ed.finalNodeStates };
  }
  const file = path.join(__dirname, "..", GOLDEN2);
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(file, JSON.stringify(golden, null, 2) + "\n");
  assert.deepStrictEqual(golden, JSON.parse(fs.readFileSync(file, "utf8")), "golden compartido con fluyo-mcp");
});

test("el fixture complejo no es trivial: waits, simultaneidad, disponibilidad inicial, fallo, narrado y motion/presentation", () => {
  const d = complex();
  const s1 = kernelPath(d, 0, 1), s2 = kernelPath(d, 0, 2);
  // S1: el Banco está DOWN desde el inicio → el envío Kafka→Banco falla con target_down; los simultáneos al mismo instante se resuelven por orden de array.
  assert.deepEqual(s1.outcomes.map((o) => [o.stepId, o.at, o.status, o.reason, o.nodeAvailability]), [
    [1, 0, "completed", undefined, undefined], [2, 500, "narrated", undefined, "UP"],
    [3, 2500, "not_completed", "target_down", undefined], [4, 2500, "completed", undefined, undefined], [5, 2500, "narrated", undefined, "UP"],
    [6, 7000, "completed", undefined, undefined], [7, 7000, "state_changed", undefined, undefined]]);
  assert.equal(s1.finalAvailability[4], "UP");                        // Banco vuelve al final
  // S2: «Kafka cae» y «confirmar» en el MISMO momento: el orden del array decide (cae antes → source_down); el pago con Kafka caído falla; procesar se narra con Kafka DOWN.
  assert.deepEqual(s2.outcomes.map((o) => [o.stepId, o.status, o.reason, o.nodeAvailability]), [
    [1, "completed", undefined, undefined], [2, "state_changed", undefined, undefined], [3, "not_completed", "source_down", undefined],
    [4, "not_completed", "target_down", undefined], [5, "narrated", undefined, "DOWN"], [6, "state_changed", undefined, undefined],
    [7, "state_changed", undefined, undefined], [8, "completed", undefined, undefined]]);   // el Behavior inicial (Banco DOWN) es de la PÁGINA: también rige en esta Historia
  assert.equal(s2.finalAvailability[2], "UP");
  assert.equal(s1.stepMeta[1].motion, "slow");
  assert.equal(s1.stepMeta[2].nodeEffects.highlight, true);
  assert.equal(s1.stepMeta[1].connection.style, "impulse");
  assert.equal(s1.stepMeta[7].name, "", "un Step sin EventType usa el fallback legacy");
});

test("el orden de array en el mismo momento cambia el resultado (y el contrato lo preserva)", () => {
  const d = complex();
  const swapped = J(d); const st = sc(swapped, 1).steps; [st[1], st[2]] = [st[2], st[1]];  // confirmar ANTES de que Kafka caiga
  const a = kernelPath(d, 0, 2).outcomes.find((o) => o.stepId === 3), b = kernelPath(swapped, 0, 2).outcomes.find((o) => o.stepId === 3);
  assert.equal(a.status, "not_completed");
  assert.equal(b.status, "completed");
});

/* ═══════════════ 4. Aislamiento ═══════════════ */

function deepFreezeIn(ctx, name) { return ctx.run(`(function f(o){ if(o && typeof o==='object'){ Object.freeze(o); for(const k of Object.keys(o)) f(o[k]); } return o; })(${name})`); }

test("aislamiento · run/outcomes/validate sobre entradas congeladas no intentan mutar nada", () => {
  const out = K.call(`(function(){
    const frozen = (function f(o){ if(o && typeof o==='object'){ Object.freeze(o); for(const k of Object.keys(o)) f(o[k]); } return o; });
    const p = frozen(__a);
    const rep = FluyoIntegrity.validateProject(p);                       // proyecto congelado
    const d = frozen(projectFromProjectData(p).doc); doc = d;            // documento normalizado congelado
    const page = d.pages[0], story = page.scenarios[0];
    const r = FluyoStory.run(page, story);                                // página y Historia congeladas
    const o = FluyoStory.outcomes(r.trace, story, page);
    FluyoStory.finalAvailability(r.trace, page); FluyoStory.stepMeta(story.steps);
    FluyoIntegrity.removalImpact(p, {pageIndex: 0, nodeIds: [2]});
    return {valid: rep.valid, outcomes: o.length};
  })()`, complex());
  assert.deepEqual(out, { valid: true, outcomes: 7 });
});

test("aislamiento · run(A), run(B), run(A) en el mismo contexto: la tercera es idéntica a la primera", () => {
  const out = K.call(`(function(){
    const d = projectFromProjectData(__a).doc; doc = d; const page = d.pages[0];
    const go = id => { const s = page.scenarios.find(x => x.id === id); const r = FluyoStory.run(page, s); return {trace: r.trace, outcomes: FluyoStory.outcomes(r.trace, s, page), fin: FluyoStory.finalAvailability(r.trace, page), meta: FluyoStory.stepMeta(s.steps)}; };
    const before = JSON.stringify(d);
    const a1 = go(1), b = go(2), a2 = go(1);
    return {same: JSON.stringify(a1) === JSON.stringify(a2), differs: JSON.stringify(a1) !== JSON.stringify(b), docUntouched: before === JSON.stringify(d)};
  })()`, complex());
  assert.deepEqual(out, { same: true, differs: true, docUntouched: true });
});

/* ═══════════════ 5. Fuzz determinista con invariantes ═══════════════ */

test("fuzz (1.500 mutaciones deterministas): nunca lanza; válido ⇒ toda Historia ejecutable; no muta; determinista", () => {
  let seed = 20261001;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const weird = [null, 0, -1, 1, 2, 3, 6, 99, 1e308, 1.5, "", "x", "1", true, false, [], {}, [1], { a: 1 }, "__proto__"];
  const paths = (o, p = [], out = []) => { if (o && typeof o === "object") for (const k of Object.keys(o)) { out.push([...p, k]); paths(o[k], [...p, k], out); } return out; };
  const base = complex();
  let invalid = 0, valid = 0;
  for (let i = 0; i < 1500; i++) {
    const d = J(base), ps = paths(d);
    for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
      const p = pick(ps); let o = d;
      try { for (const k of p.slice(0, -1)) o = o[k]; const k = p[p.length - 1], r = rnd();
        if (r < 0.2) delete o[k]; else if (r < 0.3 && Array.isArray(o)) o.splice(Number(k), 1); else if (r < 0.4 && Array.isArray(o)) o.push(J(o[Number(k)] ?? null)); else o[k] = pick(weird); } catch { /* ruta ya borrada */ }
    }
    const src = JSON.stringify(d);
    const r = validate(JSON.parse(src));
    assert.equal(JSON.stringify(validate(JSON.parse(src))), JSON.stringify(r), "determinista");
    for (const e of r.errors) assert.ok(e.code && e.message && e.scope, "error bien formado: " + JSON.stringify(e));
    assert.equal(r.valid, r.errors.length === 0);
    if (r.valid) { valid++; assert.ok(r.stories.every((s) => s.executable), `válido pero con una Historia no ejecutable (#${i})`); }
    else { invalid++; if (r.errors.some((e) => e.code === "invalid_document")) assert.deepEqual(r.stories, []); }
    // La entrada no se muta por validar.
    const probe = JSON.parse(src); validate(probe); assert.equal(JSON.stringify(probe), src);
  }
  assert.ok(invalid > 300 && valid > 30, `el fuzz debe ejercitar ambos lados (${valid} válidos / ${invalid} inválidos)`);
});
