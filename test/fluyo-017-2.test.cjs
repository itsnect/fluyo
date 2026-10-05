"use strict";
/* FLUYO-017.2 — Autoría de Historias: funciones de dominio extraídas del editor, FluyoAuthoring (lote atómico sobre
   una copia, integridad del estado final, B2) y PARIDAD con el editor real.
   Las mismas operaciones y el mismo golden se verifican en fluyo-mcp (test/fluyo-017-2.test.ts). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { makeScenarioUIContext, setupPanel, ensureUI, freshPage } = require("./fluyo-016-harness.cjs");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
const J = (v) => JSON.parse(JSON.stringify(v));
const simple = () => JSON.parse(read("test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json"));
const complex = () => JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));
const GOLDEN = "test/fixtures/fluyo-017-2-golden.json";

function kernel() {
  const ctx = vm.createContext({});
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, ctx)); };
  return ctx;
}
const K = kernel();
const apply = (project, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p: project, o: ops });
const S = (op, extra) => ({ op, scope: "story", pageIndex: 0, ...extra });
const P = (op, extra) => ({ op, scope: "page", pageIndex: 0, ...extra });
const pg = (d, i = 0) => d.doc.pages[i];
const story = (d, id, pi = 0) => pg(d, pi).scenarios.find((s) => s.id === id);
const at = (d, id) => story(d, id).steps.map((s) => [s.id, s.at]);
const codes = (r) => r.errors.map((e) => e.code);

/* ═══════════════ 1. Dominio extraído del editor (model.js) ═══════════════ */

/* A · 3 s · B · 4 s · C */
const abc = () => [{ id: 1, at: 0, action: "OCCURRENCE", nodeId: 1 }, { id: 2, at: 3000, action: "OCCURRENCE", nodeId: 1 }, { id: 3, at: 7000, action: "OCCURRENCE", nodeId: 1 }];
const MAX = 86400000;
const setWait = (steps, id, delay) => K.call("storyboardSetWait(__a.s, __a.id, __a.d, __a.max)", { s: steps, id, d: delay, max: MAX });
const atsOf = (r) => r.steps.map((s) => [s.id, s.at]);

test("storyboardSetWait: espera = tiempo desde el momento anterior; mueve ese momento y TODOS los posteriores", () => {
  assert.deepEqual(atsOf(setWait(abc(), 2, 1000)), [[1, 0], [2, 1000], [3, 5000]]);       // B: 3 s → 1 s; C conserva su espera de 4 s
  assert.deepEqual(atsOf(setWait(abc(), 3, 1000)), [[1, 0], [2, 3000], [3, 4000]]);
  assert.deepEqual(atsOf(setWait(abc(), 1, 500)), [[1, 500], [2, 3500], [3, 7500]]);       // el primero: desplazamiento inicial
});

test("storyboardSetWait: sin cambio, simultaneidad, esperas 0 y entradas inválidas", () => {
  assert.equal(setWait(abc(), 2, 3000).changed, false);
  const sim = [...abc(), { id: 4, at: 3000, action: "OCCURRENCE", nodeId: 1 }];
  assert.deepEqual(atsOf(setWait(sim, 4, 1000)).sort((a, b) => a[0] - b[0]), [[1, 0], [2, 1000], [3, 5000], [4, 1000]]);   // mueve el momento ENTERO
  assert.deepEqual(atsOf(setWait(abc(), 2, 0)), [[1, 0], [2, 0], [3, 4000]]);              // espera 0 = «al mismo tiempo»
  assert.equal(setWait(abc(), 99, 1000), null);
  for (const bad of [-1, 1.5, "1", null]) assert.equal(setWait(abc(), 2, bad), null);
  assert.deepEqual(setWait(abc(), 2, MAX), { error: "out_of_range" });                      // C quedaría fuera del tope de 24 h
});

test("storyboardSetWait no muta la entrada", () => {
  const s = abc(), before = JSON.stringify(s);
  setWait(s, 2, 1000);
  assert.equal(JSON.stringify(s), before);
});

test("eventTypeActionSpec / stepDefinitionForEvent: el EventType es la autoridad de la acción", () => {
  const def = (et, t, at) => K.call("stepDefinitionForEvent(__a.et, __a.t, __a.at)", { et, t, at });
  assert.deepEqual(def({ id: 1, primitive: "FLOW" }, 5, 100), { at: 100, eventTypeId: 1, action: "SEND", edgeId: 5 });
  assert.deepEqual(def({ id: 2, primitive: "OCCURRENCE" }, 2, 0), { at: 0, eventTypeId: 2, action: "OCCURRENCE", nodeId: 2 });
  assert.deepEqual(def({ id: 4, primitive: "SET_AVAILABILITY", availability: "DOWN" }, 2, 7), { at: 7, eventTypeId: 4, action: "SET_STATE", nodeId: 2, state: "DOWN" });
  assert.throws(() => K.call("stepDefinitionForEvent({id:1, primitive:'X'}, 1, 0)"));
  assert.deepEqual(K.call("FluyoIntegrity.eventActionSpec(__a)", { primitive: "FLOW" }), { action: "SEND", target: "connection" });   // la integridad delega en la misma función
});

test("defaultStepTime: 0 en una Historia vacía; tras el último momento + espera por defecto (1 s)", () => {
  assert.equal(K.call("defaultStepTime({steps: []})"), 0);
  assert.equal(K.call("defaultStepTime(__a)", { steps: abc() }), 8000);
  assert.equal(K.call("defaultStepTime(__a, 250)", { steps: abc() }), 7250);
});

test("duplicateStep: nuevo id, mismo momento y objetivo, justo debajo; no desplaza nada", () => {
  const r = K.call(`(function(){ const sc = {engineVersion:2, nextStepId:4, steps: __a}; const c = duplicateStep(sc, 2); return {c, steps: sc.steps}; })()`, abc());
  assert.equal(r.c.id, 4);
  assert.deepEqual(r.steps.map((s) => [s.id, s.at]), [[1, 0], [2, 3000], [4, 3000], [3, 7000]]);
  assert.equal(K.call("duplicateStep({engineVersion:2, nextStepId:4, steps: []}, 9)"), null);
});

test("retargetStep: sólo cambia el objetivo; conserva id, EventType, tiempo y orden", () => {
  const r = K.call(`(function(){ const pg = {nodes:[{id:1},{id:2}], edges:[{id:4},{id:5}]};
    const sc = {steps:[{id:1, at:5, action:"SEND", edgeId:4, eventTypeId:1, extra:undefined}]};
    const before = JSON.stringify(sc.steps[0]); retargetStep(pg, sc, 1, 5); return {before, after: sc.steps[0]}; })()`);
  assert.deepEqual(r.after, { id: 1, at: 5, action: "SEND", edgeId: 5, eventTypeId: 1 });
  const bad = (code, src) => assert.throws(() => K.call(src), (e) => e.code === code);
  bad("target_not_found", "retargetStep({nodes:[], edges:[{id:4}]}, {steps:[{id:1,at:0,action:'SEND',edgeId:4}]}, 1, 77)");
  bad("step_not_found", "retargetStep({nodes:[], edges:[]}, {steps:[]}, 1, 77)");
});

test("setInitialAvailability: es de la página; UP no deja Behavior; DOWN queda una sola vez", () => {
  const r = K.call(`(function(){ const pg = {nodes:[{id:1},{id:2}], behaviors:[]};
    setInitialAvailability(pg, 2, "DOWN"); setInitialAvailability(pg, 2, "DOWN"); const a = JSON.stringify(pg.behaviors);
    setInitialAvailability(pg, 2, "UP"); return {a, b: pg.behaviors}; })()`);
  assert.equal(r.a, '[{"nodeId":2,"initialState":"DOWN"}]');
  assert.deepEqual(r.b, []);
  assert.throws(() => K.call("setInitialAvailability({nodes:[], behaviors:[]}, 9, 'DOWN')"), (e) => e.code === "node_not_found");
  assert.throws(() => K.call("setInitialAvailability({nodes:[{id:1}], behaviors:[]}, 1, 'MAYBE')"));
});

/* ═══════════════ 2. FluyoAuthoring: creación y edición ═══════════════ */

test("crear una Historia vacía, con nombre y con un Step; ids deterministas", () => {
  const a = apply(simple(), [S("create_story")]);
  assert.equal(a.ok, true);
  assert.deepEqual(a.changes.map((c) => [c.operation, c.scope, c.entityKind, c.entityId, c.created]), [["create_story", "story", "story", 4, true]]);
  assert.equal(story(a.project, 4).name, "Historia 4");
  assert.deepEqual(story(a.project, 4).steps, []);
  assert.equal(a.project.doc.pages[0].nextScenarioId, 5);
  const b = apply(simple(), [S("create_story", { name: "Con paso", ref: "x" }), S("add_step", { storyId: { ref: "x" }, eventTypeId: 1, target: { edgeId: 4 } })]);
  assert.deepEqual(story(b.project, 4).steps, [{ id: 1, at: 0, action: "SEND", edgeId: 4, eventTypeId: 1 }]);
  assert.deepEqual(apply(simple(), [S("create_story", { name: "Con paso", ref: "x" }), S("add_step", { storyId: { ref: "x" }, eventTypeId: 1, target: { edgeId: 4 } })]), b, "determinista");
});

test("una Historia con varios Steps: esperas narrativas, no tiempos absolutos", () => {
  const r = apply(simple(), [
    S("create_story", { name: "A 2s B 5s C", ref: "n" }),
    S("add_step", { storyId: { ref: "n" }, eventTypeId: 1, target: { from: 1, to: 2 }, ref: "a" }),
    S("add_step", { storyId: { ref: "n" }, eventTypeId: 2, target: { nodeId: 2 }, waitMs: 2000, ref: "b" }),
    S("add_step", { storyId: { ref: "n" }, eventTypeId: 3, target: { edgeId: 5 }, waitMs: 5000, ref: "c" }),
  ]);
  assert.deepEqual(at(r.project, 4), [[1, 0], [2, 2000], [3, 7000]]);
  assert.deepEqual(r.changes.map((c) => c.at), [undefined, 0, 2000, 7000]);
});

test("rename, duplicate_story (con y sin nombre) y delete_story", () => {
  const r = apply(simple(), [S("rename_story", { storyId: 1, name: "Camino feliz" }), S("duplicate_story", { storyId: 2, ref: "d" }), S("duplicate_story", { storyId: 3, name: "Variante C" }), S("delete_story", { storyId: 1 })]);
  assert.equal(r.ok, true);
  assert.deepEqual(pg(r.project).scenarios.map((s) => [s.id, s.name]), [[2, "Historia B"], [4, "Historia B copia"], [3, "Historia C"], [5, "Variante C"]]);
  assert.deepEqual(story(r.project, 4).steps, story(simple(), 2).steps);          // copia profunda con los mismos ids de Step
  assert.equal(story(simple(), 1).name, "Historia A");
});

test("duplicate_story deja la original intacta (la variante es independiente)", () => {
  const base = simple();
  const r = apply(base, [S("duplicate_story", { storyId: 1, name: "Variante", ref: "v" }), S("add_step", { storyId: { ref: "v" }, eventTypeId: 4, target: { nodeId: 2 }, placement: { sameMomentAs: 2, position: "before" } })]);
  assert.deepEqual(story(r.project, 1), story(base, 1), "Historia A idéntica");
  assert.equal(story(r.project, 4).steps.length, 4);
});

test("add_step: la acción la decide el EventType (SEND / OCCURRENCE / SET_STATE con su estado)", () => {
  const r = apply(simple(), [S("create_story", { ref: "n" }), ...[[1, { edgeId: 4 }], [2, { nodeId: 2 }], [4, { nodeId: 2 }]].map(([et, target]) => S("add_step", { storyId: { ref: "n" }, eventTypeId: et, target }))]);
  assert.deepEqual(story(r.project, 4).steps.map((s) => [s.action, s.edgeId, s.nodeId, s.state]), [["SEND", 4, undefined, undefined], ["OCCURRENCE", undefined, 2, undefined], ["SET_STATE", undefined, 2, "DOWN"]]);
});

test("add_step: simultaneidad (al mismo tiempo) con y sin position", () => {
  const r = apply(simple(), [
    S("add_step", { storyId: 1, eventTypeId: 4, target: { nodeId: 3 }, placement: { sameMomentAs: 2, position: "before" } }),
    S("add_step", { storyId: 1, eventTypeId: 4, target: { nodeId: 1 }, placement: { sameMomentAs: 2, position: "after" } }),
    S("add_step", { storyId: 1, eventTypeId: 2, target: { nodeId: 1 }, placement: { sameMomentAs: 2 } }),
  ]);
  const ordered = K.call("storyboardOrderedSteps(__a)", story(r.project, 1).steps);
  assert.deepEqual(ordered.map((s) => [s.id, s.at]), [[1, 0], [4, 1000], [2, 1000], [5, 1000], [6, 1000], [3, 2000]]);   // before / ancla / after / sin position (al final del momento)
  assert.deepEqual(K.call("storyboardGroups(__a).map(g => g.steps.length)", story(r.project, 1).steps), [1, 4, 1]);
});

test("remove_step: la espera del momento que desaparece se colapsa (A·3s·B·4s·C → A·4s·C, no 7 s)", () => {
  const base = simple();
  story(base, 1).steps = [{ id: 1, at: 0, action: "SEND", edgeId: 4, eventTypeId: 1 }, { id: 2, at: 3000, action: "OCCURRENCE", nodeId: 2, eventTypeId: 2 }, { id: 3, at: 7000, action: "SEND", edgeId: 5, eventTypeId: 3 }];
  const r = apply(base, [S("remove_step", { storyId: 1, stepId: 2 })]);
  assert.deepEqual(at(r.project, 1), [[1, 0], [3, 4000]]);
  assert.deepEqual(r.changes[0].affects.stories[0].removedStepIds, [2]);
  assert.deepEqual(r.changes[0].affects.stories[0].stepIds, [3]);       // C se adelantó
});

test("set_wait: A 2s B 5s C — fijar esperas y ver qué Steps se desplazan", () => {
  const base = simple();
  story(base, 1).steps = [{ id: 1, at: 0, action: "SEND", edgeId: 4, eventTypeId: 1 }, { id: 2, at: 3000, action: "OCCURRENCE", nodeId: 2, eventTypeId: 2 }, { id: 3, at: 7000, action: "SEND", edgeId: 5, eventTypeId: 3 }];
  const r = apply(base, [S("set_wait", { storyId: 1, stepId: 2, waitMs: 2000 }), S("set_wait", { storyId: 1, stepId: 3, waitMs: 5000 })]);
  assert.deepEqual(at(r.project, 1), [[1, 0], [2, 2000], [3, 7000]]);
  assert.deepEqual(r.changes.map((c) => c.affects.stories[0].stepIds), [[2, 3], [3]]);
  assert.equal(r.changes[0].waitMs, 2000);
});

test("move_step: antes/después (misma semántica que el menú), a un hueco y junto a otro paso", () => {
  const r = apply(simple(), [S("move_step", { storyId: 1, stepId: 3, direction: "earlier" })]);
  assert.deepEqual(K.call("storyboardOrderedSteps(__a).map(s => s.id)", story(r.project, 1).steps), [1, 3, 2]);
  assert.deepEqual(at(r.project, 1).map((x) => x[1]).sort((a, b) => a - b), [0, 1000, 2000], "los instantes son ranuras: no se inventa ninguno");
  const g = apply(simple(), [S("move_step", { storyId: 1, stepId: 3, to: { gapIndex: 1 } })]);
  assert.deepEqual(K.call("storyboardOrderedSteps(__a).map(s => s.id)", story(g.project, 1).steps), [1, 3, 2]);
  const j = apply(simple(), [S("move_step", { storyId: 1, stepId: 3, to: { sameMomentAs: 1, after: true } })]);
  assert.equal(story(j.project, 1).steps.find((s) => s.id === 3).at, 0, "se une al momento del ancla");
  assert.deepEqual(codes(apply(simple(), [S("move_step", { storyId: 1, stepId: 1, direction: "earlier" })])), ["MOVE_UNSUPPORTED"]);
});

test("duplicate_step: mismo momento, mismo EventType/objetivo/presentación, nuevo id, sin desplazar posteriores", () => {
  const base = complex();
  const r = apply(base, [S("duplicate_step", { storyId: 1, stepId: 2, ref: "d" })]);
  const orig = story(base, 1).steps.find((s) => s.id === 2), copy = story(r.project, 1).steps.find((s) => s.id === 8);
  assert.deepEqual({ ...copy, id: 2 }, orig);
  assert.deepEqual(at(r.project, 1).filter(([id]) => id !== 8), at(base, 1), "ningún otro paso se movió");
  assert.deepEqual(K.call("storyboardOrderedSteps(__a).map(s => s.id)", story(r.project, 1).steps).slice(0, 3), [1, 2, 8]);   // justo debajo del original
  assert.deepEqual(r.changes[0].affects.stories[0].stepIds, [8]);
});

test("retarget_step: sólo cambia el objetivo (id, EventType, tiempo, orden y presentación se conservan)", () => {
  const base = complex();
  const r = apply(base, [S("retarget_step", { storyId: 1, stepId: 3, target: { edgeId: 8 } })]);       // Kafka→Banco  →  Comercio→Cliente
  const a = story(base, 1).steps.find((s) => s.id === 3), b = story(r.project, 1).steps.find((s) => s.id === 3);
  assert.deepEqual({ ...b, edgeId: a.edgeId }, a);
  assert.equal(b.edgeId, 8);
  assert.deepEqual(r.project.doc.eventTypes, base.doc.eventTypes, "la presentación del EventType no se toca");
  assert.deepEqual(K.call("storyboardOrderedSteps(__a).map(s => s.id)", story(r.project, 1).steps), K.call("storyboardOrderedSteps(__a).map(s => s.id)", story(base, 1).steps));
});

test("set_initial_availability: es de la PÁGINA, usa el Behavior actual y declara qué Historias ve", () => {
  const r = apply(simple(), [P("set_initial_availability", { nodeId: 2, state: "DOWN" })]);
  assert.deepEqual(pg(r.project).behaviors, [{ nodeId: 2, initialState: "DOWN" }]);
  assert.deepEqual(r.changes[0].affects.stories.map((s) => s.storyId), [1, 2, 3]);
  assert.match(r.changes[0].affects.note, /pertenece a la página/);
  assert.equal(r.changes[0].pageLevel, true);
  assert.deepEqual(pg(apply(r.project, [P("set_initial_availability", { nodeId: 2, state: "UP" })]).project).behaviors, []);
});

/* ═══════════════ 3. Rechazos de operación (atomicidad incluida) ═══════════════ */

const REJECT = [
  ["operación desconocida", [{ op: "teleport", scope: "story" }], "UNKNOWN_OPERATION"],
  ["scope incorrecto", [{ op: "rename_story", scope: "page", pageIndex: 0, storyId: 1, name: "x" }], "SCOPE_MISMATCH"],
  ["scope de página declarado como Historia", [S("set_initial_availability", { nodeId: 2, state: "DOWN" })], "SCOPE_MISMATCH"],
  ["página inexistente", [S("create_story", { pageIndex: 9 })], "PAGE_NOT_FOUND"],
  ["Historia inexistente", [S("rename_story", { storyId: 42, name: "x" })], "STORY_NOT_FOUND"],
  ["Step inexistente", [S("remove_step", { storyId: 1, stepId: 42 })], "STEP_NOT_FOUND"],
  ["EventType inexistente", [S("add_step", { storyId: 1, eventTypeId: 99, target: { edgeId: 4 } })], "EVENT_TYPE_NOT_FOUND"],
  ["objetivo inexistente (conexión)", [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 99 } })], "TARGET_NOT_FOUND"],
  ["objetivo inexistente (elemento)", [S("add_step", { storyId: 1, eventTypeId: 2, target: { nodeId: 99 } })], "TARGET_NOT_FOUND"],
  ["conexión from/to inexistente", [S("add_step", { storyId: 1, eventTypeId: 1, target: { from: 3, to: 1 } })], "TARGET_NOT_FOUND"],
  ["conexión para un evento de elemento", [S("add_step", { storyId: 1, eventTypeId: 2, target: { edgeId: 4 } })], "TARGET_INCOMPATIBLE"],
  ["elemento para un evento de conexión", [S("add_step", { storyId: 1, eventTypeId: 1, target: { nodeId: 2 } })], "TARGET_INCOMPATIBLE"],
  ["from/to para un evento de elemento", [S("add_step", { storyId: 1, eventTypeId: 4, target: { from: 1, to: 2 } })], "TARGET_INCOMPATIBLE"],
  ["retarget a un destino incompatible (nodo para un envío)", [S("retarget_step", { storyId: 1, stepId: 1, target: { nodeId: 2 } })], "TARGET_INCOMPATIBLE"],
  ["retarget a un destino inexistente", [S("retarget_step", { storyId: 1, stepId: 1, target: { edgeId: 99 } })], "TARGET_NOT_FOUND"],
  ["target con dos formas", [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4, nodeId: 2 } })], "INVALID_OPERATION"],
  ["nombre vacío", [S("rename_story", { storyId: 1, name: "  " })], "INVALID_NAME"],
  ["nombre demasiado largo", [S("create_story", { name: "x".repeat(121) })], "INVALID_NAME"],
  ["espera negativa", [S("set_wait", { storyId: 1, stepId: 2, waitMs: -1 })], "INVALID_WAIT"],
  ["espera no entera", [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4 }, waitMs: 1.5 })], "INVALID_WAIT"],
  ["espera fuera de las 24 h", [S("set_wait", { storyId: 1, stepId: 2, waitMs: 86400000 })], "WAIT_OUT_OF_RANGE"],
  ["ref desconocida", [S("add_step", { storyId: { ref: "nada" }, eventTypeId: 1, target: { edgeId: 4 } })], "UNKNOWN_REF"],
  ["waitMs con placement", [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4 }, waitMs: 5, placement: { sameMomentAs: 1 } })], "INVALID_OPERATION"],
  ["placement.sameMomentAs inexistente", [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4 }, placement: { sameMomentAs: 99 } })], "STEP_NOT_FOUND"],
  ["move_step sin direction ni to", [S("move_step", { storyId: 1, stepId: 1 })], "INVALID_OPERATION"],
  ["set_initial_availability: nodo inexistente", [P("set_initial_availability", { nodeId: 99, state: "DOWN" })], "TARGET_NOT_FOUND"],
  ["set_initial_availability: estado inválido", [P("set_initial_availability", { nodeId: 2, state: "MAYBE" })], "INVALID_OPERATION"],
  ["lote vacío", [], "INVALID_OPERATION"],
];
for (const [name, ops, code] of REJECT) {
  test(`rechazo · ${name} → ${code}`, () => {
    const base = simple(), before = JSON.stringify(base);
    const r = apply(base, ops);
    assert.equal(r.ok, false);
    assert.equal(r.project, undefined, "no se devuelve ningún documento");
    assert.equal(r.errors[0].code, code);
    assert.equal(JSON.stringify(base), before, "el original no cambia");
  });
}

test("rechazo · Historia del motor v1 no se edita; no se supera el máximo de pasos", () => {
  const v1 = complex();
  assert.deepEqual(codes(apply(v1, [S("add_step", { storyId: 3, eventTypeId: 1, target: { edgeId: 5 } })])), ["UNSUPPORTED_ENGINE_VERSION"]);
  assert.equal(apply(v1, [S("rename_story", { storyId: 3, name: "renombrar sí" })]).ok, true);
  const big = simple();
  story(big, 1).steps = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, at: i, action: "OCCURRENCE", nodeId: 2 }));
  story(big, 1).nextStepId = 1001;
  assert.deepEqual(codes(apply(big, [S("add_step", { storyId: 1, eventTypeId: 2, target: { nodeId: 2 } })])), ["MAX_STEPS"]);
  assert.deepEqual(codes(apply(big, [S("duplicate_step", { storyId: 1, stepId: 1 })])), ["MAX_STEPS"]);
});

test("rechazo · conexión from/to ambigua (dos conexiones del mismo origen al mismo destino)", () => {
  const d = simple();
  pg(d).edges.push({ ...pg(d).edges[0], id: 6 }); pg(d).nextId = 7;
  const r = apply(d, [S("add_step", { storyId: 1, eventTypeId: 1, target: { from: 1, to: 2 } })]);
  assert.deepEqual([r.errors[0].code, r.errors[0].edgeIds], ["AMBIGUOUS_TARGET", [4, 6]]);
  assert.equal(apply(d, [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 6 } })]).ok, true);
});

test("ATOMICIDAD: op1 válida, op2 válida, op3 inválida → ningún documento y el original intacto", () => {
  const base = simple(), before = JSON.stringify(base);
  const r = apply(base, [S("create_story", { name: "Nueva" }), S("add_step", { storyId: 1, eventTypeId: 4, target: { nodeId: 3 } }), S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 99 } })]);
  assert.equal(r.ok, false);
  assert.equal(r.project, undefined);
  assert.deepEqual([r.errors[0].code, r.errors[0].operationIndex], ["TARGET_NOT_FOUND", 2]);
  assert.equal(JSON.stringify(base), before);
  assert.equal(story(base, 1).steps.length, 3);
});

test("la entrada nunca se muta (ni congelada) y la misma entrada + las mismas operaciones dan el mismo resultado", () => {
  const ops = [S("create_story", { name: "Det", ref: "d" }), S("add_step", { storyId: { ref: "d" }, eventTypeId: 2, target: { nodeId: 2 } }), P("set_initial_availability", { nodeId: 2, state: "DOWN" })];
  const out = K.call(`(function(){
    const fr = o => { if(o && typeof o==="object"){ Object.freeze(o); for(const k of Object.keys(o)) fr(o[k]); } return o; };
    const p = fr(__a.p), o = fr(__a.o);
    const a = FluyoAuthoring.apply(p, o), b = FluyoAuthoring.apply(p, o);
    return {ok: a.ok, same: JSON.stringify(a) === JSON.stringify(b)};
  })()`, { p: simple(), o: ops });
  assert.deepEqual(out, { ok: true, same: true });
});

/* ═══════════════ 4. B2: la política de borrado estructural sigue fijada en FluyoIntegrity.removalImpact ═══════════════
   FLUYO-017.3 (corrección de scope de 017.2): MCP NO expone delete_connection ni delete_node. La política B2 («una
   eliminación que deje una Historia inválida se rechaza y se explica») se conserva en la autoridad de integridad y se
   prueba aquí sobre el estado final: lo que MCP podrá hacer en el slice de edición estructural. */

const impact = (project, removal) => K.call("FluyoIntegrity.removalImpact(__a.p, __a.r)", { p: project, r: removal });

test("estructura del diagrama (018.2 crear · 018.3 modificar y eliminar): delete_* y update_* existen con alcance «page» y no admiten la forma antigua de 017.2 (edgeId/nodeId sueltos)", () => {
  assert.deepEqual(Object.keys(K.call("FluyoAuthoring.OPERATION_SCOPE")).filter((o) => /connection|node|edge/.test(o)),
    ["create_node", "create_connection", "update_node", "update_connection", "delete_node", "delete_connection"]);
  for (const op of ["delete_connection", "delete_node"]) {
    const r = apply(simple(), [P(op, { edgeId: 5, nodeId: 2 })]);
    assert.deepEqual([r.ok, r.errors[0].code], [false, "INVALID_OPERATION"], op);
  }
});

test("B2 · borrar una conexión usada → impacto con las Historias y los Steps exactos", () => {
  const r = impact(simple(), { pageIndex: 0, edgeIds: [5] });
  assert.equal(r.wouldInvalidate, true);
  assert.deepEqual(r.affectedStories.map((s) => [s.storyId, s.storyName, s.stepIds]), [[1, "Historia A", [3]], [2, "Historia B", [4]]]);
  assert.deepEqual([...new Set(r.errors.map((e) => `${e.entityKind}:${e.entityId}`))], ["edge:5"]);
});

test("B2 · borrar un nodo usado (con sus conexiones) → todas las Historias afectadas, cada una con su Step", () => {
  const r = impact(simple(), { pageIndex: 0, nodeIds: [2] });
  assert.equal(r.wouldInvalidate, true);
  assert.deepEqual([...new Set(r.errors.map((e) => `${e.entityKind}:${e.entityId}`))].sort(), ["edge:4", "edge:5", "node:2"]);
  assert.deepEqual(r.affectedStories.map((s) => [s.storyId, s.stepIds]), [[1, [1, 2, 3]], [2, [1, 2, 3, 4]], [3, [1, 2]]]);
});

test("B2 · varias Historias usan la misma conexión → todas identificadas; la que no la usa, no", () => {
  assert.deepEqual(impact(simple(), { pageIndex: 0, edgeIds: [4] }).affectedStories.map((s) => s.storyId), [1, 2]);   // la C no usa la conexión 4
});

test("B2 · retarget (autoría) + eliminación sería VÁLIDA sobre el estado final; sin retargetear a una Historia, se nombra la que falta", () => {
  const base = simple();
  pg(base).edges.push({ ...pg(base).edges[1], id: 6, label: "alternativa" }); pg(base).nextId = 7;
  const both = apply(base, [S("retarget_step", { storyId: 1, stepId: 3, target: { edgeId: 6 } }), S("retarget_step", { storyId: 2, stepId: 4, target: { edgeId: 6 } })]);
  assert.equal(both.ok, true, JSON.stringify(both.errors));
  assert.equal(impact(both.project, { pageIndex: 0, edgeIds: [5] }).wouldInvalidate, false);
  const half = apply(base, [S("retarget_step", { storyId: 1, stepId: 3, target: { edgeId: 6 } })]);
  assert.deepEqual(impact(half.project, { pageIndex: 0, edgeIds: [5] }).affectedStories.map((s) => [s.storyId, s.stepIds]), [[2, [4]]]);
});

test("B2 · quitar los pasos que referencian (autoría) deja la eliminación válida sobre el estado final", () => {
  const r = apply(simple(), [S("remove_step", { storyId: 1, stepId: 3 }), S("remove_step", { storyId: 2, stepId: 4 })]);
  assert.equal(r.ok, true);
  assert.equal(story(r.project, 1).steps.length, 2);
  assert.equal(impact(r.project, { pageIndex: 0, edgeIds: [5] }).wouldInvalidate, false);
});

test("B2 · borrar una conexión o un nodo NO usados es válido (el nodo se lleva sus conexiones)", () => {
  const base = simple();
  pg(base).nodes.push({ id: 6, label: "Auditoría", shape: "rect", x: 900, y: 500, w: 160, h: 70, order: 3, color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false });
  pg(base).edges.push({ ...pg(base).edges[0], id: 7, from: 1, to: 6 }); pg(base).nextId = 8;
  assert.equal(impact(base, { pageIndex: 0, edgeIds: [7] }).wouldInvalidate, false);
  assert.equal(impact(base, { pageIndex: 0, nodeIds: [6] }).wouldInvalidate, false);
  pg(base).behaviors.push({ nodeId: 6, initialState: "DOWN" });                 // el Behavior huérfano SÍ lo detecta la integridad
  assert.deepEqual(impact(base, { pageIndex: 0, nodeIds: [6] }).errors.map((e) => e.code), ["missing_behavior_node"]);
});

test("integridad: una Historia tocada por el lote siempre queda ejecutable; los errores PREEXISTENTES de otras no bloquean", () => {
  const broken = simple();
  story(broken, 1).steps[0].eventTypeId = 99;                                     // Historia A ya estaba rota
  const edit = apply(broken, [S("rename_story", { storyId: 2, name: "Sigue" })]);
  assert.equal(edit.ok, true);
  assert.equal(edit.validation.valid, false);
  assert.equal(edit.validation.preexistingErrors, 1);
  const touch = apply(broken, [S("add_step", { storyId: 1, eventTypeId: 2, target: { nodeId: 2 } })]);
  assert.deepEqual(codes(touch), ["STORY_NOT_EXECUTABLE"]);                       // tocar la rota sin repararla se rechaza
  assert.equal(apply(broken, [S("remove_step", { storyId: 1, stepId: 1 })]).ok, true);   // quitar el paso roto la repara
});

test("documento ilegible → DOCUMENT_UNREADABLE (sin lanzar)", () => {
  for (const bad of [null, {}, { version: 6, app: "fluyo", doc: { pages: [] } }, "x"]) assert.deepEqual(codes(apply(bad, [S("create_story")])), ["DOCUMENT_UNREADABLE"]);
});

/* ═══════════════ 5. PARIDAD con el editor real ═══════════════ */

/* Las mismas operaciones, expresadas con refs, para fluyo-mcp (author_document). */
const OPERATIONS = [
  S("create_story", { ref: "S" }),
  S("add_step", { storyId: { ref: "S" }, eventTypeId: 1, target: { edgeId: 5 }, ref: "a" }),
  S("add_step", { storyId: { ref: "S" }, eventTypeId: 2, target: { nodeId: 2 }, ref: "b" }),
  S("add_step", { storyId: { ref: "S" }, eventTypeId: 3, target: { from: 2, to: 3 }, ref: "c" }),
  S("set_wait", { storyId: { ref: "S" }, stepId: { ref: "c" }, waitMs: 2000 }),
  S("add_step", { storyId: { ref: "S" }, eventTypeId: 6, target: { edgeId: 7 }, placement: { sameMomentAs: { ref: "c" } }, ref: "n" }),
  S("duplicate_step", { storyId: { ref: "S" }, stepId: { ref: "a" }, ref: "a2" }),
  S("move_step", { storyId: { ref: "S" }, stepId: { ref: "b" }, direction: "later" }),
  S("retarget_step", { storyId: { ref: "S" }, stepId: { ref: "n" }, target: { edgeId: 8 } }),
  S("remove_step", { storyId: { ref: "S" }, stepId: { ref: "b" } }),
  P("set_initial_availability", { nodeId: 2, state: "DOWN" }),
];

/* El mismo relato construido con las funciones REALES del editor (panel de Historias). */
function editorBuild(fixture) {
  const { ctx, register } = makeScenarioUIContext();
  freshPage(ctx); setupPanel(ctx, register);
  for (const id of ["scPlacementText", "scPlacementConfirm"]) register(id, ctx.document.createElement("div"));   // los usa la barra de colocación
  ctx.renderTabs = () => ctx.run("scSyncPage()");
  ensureUI(ctx);
  ctx.confirm = () => true;
  ctx.__fixture = fixture;
  ctx.run("doc = projectFromProjectData(__fixture).doc; undoStack = []; redoStack = []; scSyncPage();");
  const run = (c) => ctx.run(c);
  const lastId = () => run("scActiveScenario().steps.at(-1).id");
  run("scNewScenario()");
  const sid = run("scActiveScenario().id");
  run("scApplyTargets(1, [5])"); const a = lastId();
  run("scApplyTargets(2, [2])"); const b = lastId();
  run("scApplyTargets(3, [6])"); const c = lastId();
  run(`scSetStepDelay(${c}, 2000)`);
  run(`scContext = {kind:"same", stepId:${c}, scenarioId:scActiveScenario().id, page:P()}; scApplyTargets(6, [7])`); const n = lastId();
  run(`scDuplicateStep(${a})`);
  run(`scMoveStep(${b}, 1)`);
  run(`scChangeTarget(scActiveScenario().steps.find(s => s.id === ${n})); scUseTarget(8, false)`);
  run(`scDeleteStep(${b})`);
  run("scSetBehavior(2, 'DOWN')");
  return { storyId: sid, steps: J(run("scActiveScenario().steps")), behaviors: J(run("P().behaviors")), scenario: J(run("scActiveScenario()")), nextStepId: run("scActiveScenario().nextStepId") };
}

function runInKernel(project, storyId) {
  return K.call(`(function(){
    const d = projectFromProjectData(__a.p).doc; doc = d; const page = d.pages[0], sc = page.scenarios.find(s => s.id === __a.id);
    const r = FluyoStory.run(page, sc);
    return {trace: r.trace, outcomes: FluyoStory.outcomes(r.trace, sc, page), finalAvailability: FluyoStory.finalAvailability(r.trace, page), stepMeta: FluyoStory.stepMeta(sc.steps)};
  })()`, { p: project, id: storyId });
}

test("PARIDAD: la misma Historia construida por el editor y por author_document (kernel) es idéntica paso a paso", () => {
  const ed = editorBuild(complex());
  const au = apply(complex(), OPERATIONS);
  assert.equal(au.ok, true, JSON.stringify(au.errors));
  const sc = story(au.project, ed.storyId);
  assert.deepStrictEqual(sc.steps, ed.steps, "Steps (ids, tiempos, orden, EventType, objetivo, presentación)");
  assert.deepStrictEqual(sc.name, ed.scenario.name);
  assert.deepStrictEqual(sc.nextStepId, ed.nextStepId);
  assert.deepStrictEqual(pg(au.project).behaviors, ed.behaviors, "disponibilidad inicial");
});

test("PARIDAD: ejecutadas, ambas dan el mismo Trace, outcomes y disponibilidad final (y el golden se comparte con fluyo-mcp)", () => {
  const ed = editorBuild(complex());
  const au = apply(complex(), OPERATIONS);
  // Documento del editor = el original + su Historia y Behavior; el de author_document = su resultado.
  const edDoc = complex(); pg(edDoc).scenarios.push(ed.scenario); pg(edDoc).behaviors = ed.behaviors;
  const a = runInKernel(edDoc, ed.storyId), b = runInKernel(au.project, ed.storyId);
  assert.deepStrictEqual(b.trace, a.trace);
  assert.deepStrictEqual(b.outcomes, a.outcomes);
  assert.deepStrictEqual(b.finalAvailability, a.finalAvailability);
  assert.deepStrictEqual(b.stepMeta, a.stepMeta);
  assert.ok(a.trace.events.length > 5);
  assert.ok(a.outcomes.some((o) => o.status === "not_completed"), "el relato incluye un fallo (Kafka caído desde el inicio)");
  const golden = { operations: OPERATIONS, storyId: ed.storyId, steps: ed.steps, behaviors: ed.behaviors, trace: a.trace, outcomes: a.outcomes, finalAvailability: a.finalAvailability, stepMeta: a.stepMeta };
  const file = path.join(__dirname, "..", GOLDEN);
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(file, JSON.stringify(golden, null, 2) + "\n");
  assert.deepStrictEqual(golden, JSON.parse(fs.readFileSync(file, "utf8")));
});

test("PARIDAD: lo que pinta el Playback del editor con la Historia creada por author_document es el mismo Trace", () => {
  const au = apply(complex(), OPERATIONS);
  const { ctx, register } = makeScenarioUIContext();
  freshPage(ctx); setupPanel(ctx, register);
  ctx.renderTabs = () => ctx.run("scSyncPage()");
  ensureUI(ctx);
  ctx.__fixture = au.project;
  ctx.run("doc = projectFromProjectData(__fixture).doc; undoStack = []; scSyncPage(); scSelectStory(4); scRun();");
  assert.deepStrictEqual(J(ctx.run("scPlayback.trace")), runInKernel(au.project, 4).trace, "Fluyo ejecuta la Historia sin saber que la creó MCP");
});

test("el resultado de author_document se abre y se valida en Fluyo (ida y vuelta por el normalizador del editor)", () => {
  const au = apply(complex(), OPERATIONS);
  const again = K.call("FluyoAuthoring.normalizedProject(__a)", au.project);
  assert.equal(again.ok, true);
  assert.deepStrictEqual(again.project, au.project, "normalizar el resultado no lo cambia (idempotente)");
  assert.equal(K.call("FluyoIntegrity.validateProject(__a)", au.project).valid, true);
});

test("el editor sigue consumiendo las funciones compartidas (no las reimplementa)", () => {
  const src = read("js/editor-scenarios.js");
  for (const fn of ["storyboardSetWait(", "setInitialAvailability(", "stepDefinitionForEvent(", "duplicateStep(", "retargetStep(", "defaultStepTime("]) assert.ok(src.includes(fn), `editor-scenarios.js no llama a ${fn}`);
  for (const bad of ["DEFAULT_STEP_DELAY", "Object.assign(def, { action:", "pg.behaviors.filter((b) => b.nodeId !== nodeId)"]) assert.ok(!src.includes(bad), `editor-scenarios.js conserva lógica propia: ${bad}`);
  const authoring = read("js/story-authoring.js");
  for (const bad of ["send_failed", "runScenario", "validateExecution"]) assert.ok(!authoring.includes(bad), `story-authoring.js contiene lógica del motor: ${bad}`);
});
