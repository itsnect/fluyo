"use strict";
/* FLUYO-STEP-REVERSE-002 — Contrato `reverse: true` en un Step SEND (diseño: .ai/tasks/FLUYO-STEP-REVERSE-001.md, D1–D12).
   · Kernel (model.js): validatePersistedStep (solo SEND, solo `true`), normalizeScenarios quita `false`, traversalEnds (la ÚNICA
     regla), stepDefinitionForEvent/retargetStep con el sentido, setStepReverse; duplicar y guardar/abrir lo conservan.
   · Motor y Trace: source/target del recorrido; `reverse:true` en los tres eventos del envío; sin `reverse`, el Trace de siempre.
   · Playback y texto: activeSends/completedSends/logEvents, outcomes (reasonNodeId), sentence y caption en el sentido del Step.
   · Render: el token recorre la conexión al revés sobre una copia invertida de la ruta.
   · Autoría por lote: {from,to} directa → inversa, {edgeId,reverse}, {ref,reverse}, retarget_step da la vuelta, duplicate_step.
   · Integridad, Share, editor (etiquetas, motivo, registro, «Cambiar dónde ocurre», colocación múltiple) y documentos antiguos.
   Sin el menú «Invertir sentido» (STEP-REVERSE-003). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { shellOnly } = require("./fluyo-shell-001-undo.cjs");   /* FLUYO-SHELL-001 (páginas públicas, favicon, manifest): lo suyo se descuenta */
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "544fd4b";   // main al empezar 002 (producción v96, FASE 3)
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js", "document-integrity.js", "story-authoring.js"];
function context(src = read, files = KERNEL, extra = {}) {
  const ctx = vm.createContext(Object.assign({ TextEncoder, TextDecoder, atob, btoa, URL, CompressionStream, DecompressionStream, crypto, console }, extra));
  for (const f of files) vm.runInContext(src("js/" + f), ctx, { filename: f });
  return ctx;
}
const K = context();
const runIn = (C, code, arg) => { C.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, C)); };
const run = (code, arg) => runIn(K, code, arg);
const err = (code, arg) => run(`(()=>{ try{ ${code}; return null; }catch(e){ return {code:e.code}; } })()`, arg);

/* ── fixture: request/response (§4 de 001). 1 Usuario · 2 API · 3 Servicio · 4 DB; 5 U→A · 6 A→S · 7 S→D ── */
const U = 1, A = 2, S = 3, D = 4;
const rect = (id, label) => ({ id, shape: "rect", x: id * 200, y: 100, w: 140, h: 60, label });
const edge = (id, from, to, extra = {}) => Object.assign({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [] }, extra);
const ETS = [
  { id: 1, name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
  { id: 2, name: "Respuesta", primitive: "FLOW", sentenceTemplate: "{source} responde a {target}", visual: { kind: "token", value: "◆" }, motion: "normal" },
  { id: 3, name: "Cae", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN" },
  { id: 4, name: "Aviso", primitive: "OCCURRENCE", sentenceTemplate: "{target} avisa", visual: { kind: "token", value: "!" } },
];
const send = (id, at, edgeId, extra = {}) => Object.assign({ id, at, action: "SEND", edgeId }, extra);
const down = (id, at, nodeId) => ({ id, at, action: "SET_STATE", nodeId, state: "DOWN", eventTypeId: 3 });
const story = (id, steps, extra = {}) => Object.assign({ id, engineVersion: 2, name: "Historia " + id, nextStepId: Math.max(0, ...steps.map((s) => s.id)) + 1, steps }, extra);
function page(steps, { edges, behaviors = [] } = {}) {
  return { name: "Petición", nextId: 100, behaviors, nextScenarioId: 2,
    nodes: [rect(U, "Usuario"), rect(A, "API"), rect(S, "Servicio"), rect(D, "DB")],
    edges: edges || [edge(5, U, A), edge(6, A, S), edge(7, S, D)],
    scenarios: [story(1, steps)] };
}
const project = (pages, extra = {}) => ({ version: 5, app: "fluyo", doc: Object.assign({ theme: "dark", customBg: "", eventTypes: ETS, nextEventTypeId: 5, pages, cur: 0 }, extra), settings: {} });
/* La ida y vuelta de §4: 3 conexiones, 6 SEND. */
const ROUND = [send(1, 0, 5, { eventTypeId: 1 }), send(2, 1200, 6, { eventTypeId: 1 }), send(3, 2400, 7, { eventTypeId: 1 }),
  send(4, 3600, 7, { eventTypeId: 2, reverse: true }), send(5, 4800, 6, { eventTypeId: 2, reverse: true }), send(6, 6000, 5, { eventTypeId: 2, reverse: true })];
const LOAD = "projectFromProjectData(__a)";
const trace = (p, C = K) => runIn(C, `(()=>{ const d = ${LOAD}.doc, pg = d.pages[0]; return FluyoStory.run(pg, pg.scenarios[0]); })()`, p);

/* ═══════════════ A. Kernel (model.js) ═══════════════ */
test("A1 · validatePersistedStep: `reverse:true` solo en SEND; cualquier otro valor o la clave en otra acción → invalid_document", () => {
  const ok = run(`[{id:1,at:0,action:"SEND",edgeId:5,reverse:true}, {id:1,at:0,action:"SEND",edgeId:5,eventTypeId:1,reverse:true}, {id:1,at:0,action:"SEND",edgeId:5}]
    .map(s => { try{ validatePersistedStep(s, 2); validatePersistedStep(s, 1); return "ok"; }catch(e){ return e.code; } })`);
  assert.deepEqual(ok, ["ok", "ok", "ok"]);
  const bad = run(`["true", 1, 0, null, false, {}, [], "reverse"].map(v => { try{ validatePersistedStep({id:1,at:0,action:"SEND",edgeId:5,reverse:v}, 2); return "ok"; }catch(e){ return e.code; } })`);
  assert.deepEqual(bad, Array(8).fill("invalid_document"), "solo `true` (false lo quita la carga, nunca validatePersistedStep)");
  const other = run(`[true, false].flatMap(v => [{id:1,at:0,action:"SET_STATE",nodeId:1,state:"DOWN",reverse:v}, {id:1,at:0,action:"OCCURRENCE",nodeId:1,reverse:v}]
    .map(s => { try{ validatePersistedStep(s, 2); return "ok"; }catch(e){ return e.code; } }))`);
  assert.deepEqual(other, Array(4).fill("invalid_document"), "reverse en SET_STATE/OCCURRENCE, también false");
});

test("A2 · carga: `reverse:false` se quita (canónico); `true` se conserva; el documento entero no abre con un valor inválido; idempotente", () => {
  const p = project([page([send(1, 0, 7, { reverse: false }), send(2, 1000, 7, { reverse: true }), send(3, 2000, 7)])]);
  const out = run(`(()=>{ const once = ${LOAD}; const twice = projectFromProjectData(JSON.parse(JSON.stringify(projectToSerializable(once.doc, once.settings))));
    return [once.doc.pages[0].scenarios[0].steps, JSON.stringify(once.doc) === JSON.stringify(twice.doc)]; })()`, p);
  assert.deepEqual(out[0], [send(1, 0, 7), send(2, 1000, 7, { reverse: true }), send(3, 2000, 7)]);
  assert.ok(out[1], "guardar/abrir: idéntico");
  for (const v of ["true", 1, null, 0]) assert.deepEqual(err(`projectFromProjectData(__a)`, project([page([send(1, 0, 7, { reverse: v })])])), { code: "invalid_document" }, String(v));
  assert.deepEqual(err(`projectFromProjectData(__a)`, project([page([down(1, 0, D)].map((s) => Object.assign(s, { reverse: false })))])), { code: "invalid_document" }, "false en SET_STATE no se canonicaliza: se rechaza");
  const v1 = project([page([send(1, 0, 7, { reverse: true })])]); v1.doc.pages[0].scenarios[0].engineVersion = 1;
  assert.equal(err(`projectFromProjectData(__a)`, v1), null, "una Historia v1 (SET_STATE/SEND) admite el sentido igual que eventTypeId");
});

test("A3 · traversalEnds es la regla; el motor la repite y las dos coinciden en los cuatro casos (sentido × extremo caído)", () => {
  assert.deepEqual(run(`[traversalEnds({from:3,to:4}), traversalEnds({from:3,to:4}, true), traversalEnds({from:3,to:4}, false), traversalEnds(null, true), traversalEnds({from:3,to:4}, "true")]`),
    [{ source: 3, target: 4 }, { source: 4, target: 3 }, { source: 3, target: 4 }, {}, { source: 3, target: 4 }]);
  for (const reverse of [false, true]) for (const fallen of [S, D]) {
    const steps = [down(1, 0, fallen), send(2, 10, 7, reverse ? { reverse: true } : {})];
    const r = trace(project([page(steps)]));
    const ends = run(`traversalEnds({from:${S},to:${D}}, ${reverse})`);
    const reason = r.trace.events.find((e) => e.type === "send_failed").reason;
    assert.equal(reason, fallen === ends.source ? "source_down" : "target_down", `reverse=${reverse}, cae ${fallen}`);
  }
});

test("A4 · stepDefinitionForEvent escribe `reverse` solo si es true; un evento de elemento con reverse o un valor no booleano se rechazan", () => {
  const out = run(`(()=>{ const d = ${LOAD}.doc, f = id => eventTypeByIdIn(d, id);
    return [stepDefinitionForEvent(f(2), 7, 0, true), stepDefinitionForEvent(f(2), 7, 0, false), stepDefinitionForEvent(f(2), 7, 0)]; })()`, project([page([])]));
  assert.deepEqual(out, [{ at: 0, eventTypeId: 2, action: "SEND", edgeId: 7, reverse: true }, { at: 0, eventTypeId: 2, action: "SEND", edgeId: 7 }, { at: 0, eventTypeId: 2, action: "SEND", edgeId: 7 }]);
  const p = project([page([])]);
  assert.deepEqual(err(`(()=>{ const d = ${LOAD}.doc; stepDefinitionForEvent(eventTypeByIdIn(d, 3), 4, 0, true); })()`, p), { code: "invalid_document" });
  assert.deepEqual(err(`(()=>{ const d = ${LOAD}.doc; stepDefinitionForEvent(eventTypeByIdIn(d, 2), 7, 0, "true"); })()`, p), { code: "invalid_document" });
  assert.deepEqual(err(`(()=>{ const d = ${LOAD}.doc; createStep(d.pages[0].scenarios[0], {at:0, action:"SEND", edgeId:7, reverse:false}); })()`, p), { code: "invalid_document" }, "nadie escribe false");
});

test("A5 · retargetStep fija el recorrido completo; setStepReverse da la vuelta en el sitio; duplicar Step e Historia heredan el sentido", () => {
  const p = project([page([send(1, 0, 7, { eventTypeId: 2, reverse: true }), down(2, 500, D)])]);
  const out = run(`(()=>{ const d = ${LOAD}.doc, pg = d.pages[0], sc = pg.scenarios[0], snap = () => JSON.parse(JSON.stringify(sc.steps[0]));
    const r = [];
    retargetStep(pg, sc, 1, 6); r.push(snap());            // sin reverse = normal
    retargetStep(pg, sc, 1, 6, true); r.push(snap());
    retargetStep(pg, sc, 1, 7, false); r.push(snap());
    setStepReverse(sc, 1, true); r.push(snap());
    setStepReverse(sc, 1, false); r.push(snap());
    setStepReverse(sc, 1, true);
    const dup = duplicateStep(sc, 1); r.push(JSON.parse(JSON.stringify(dup)), sc.steps.map(s => s.id));
    const copy = duplicateScenario(pg, 1); r.push(JSON.parse(JSON.stringify(copy.steps)));
    return r; })()`, p);
  assert.deepEqual(out[0], send(1, 0, 6, { eventTypeId: 2 }));
  assert.deepEqual(out[1], send(1, 0, 6, { eventTypeId: 2, reverse: true }));
  assert.deepEqual(out[2], send(1, 0, 7, { eventTypeId: 2 }));
  assert.deepEqual(out[3], send(1, 0, 7, { eventTypeId: 2, reverse: true }), "id, at, conexión y EventType intactos");
  assert.deepEqual(out[4], send(1, 0, 7, { eventTypeId: 2 }));
  assert.deepEqual(out[5], { id: 3, at: 0, action: "SEND", edgeId: 7, eventTypeId: 2, reverse: true }, "duplicateStep conserva reverse");
  assert.deepEqual(out[6], [1, 3, 2], "la copia, justo debajo");
  assert.ok(out[7].filter((s) => s.action === "SEND").every((s) => s.reverse === true), "duplicateScenario conserva reverse");
  for (const [code, why] of [[`setStepReverse(sc, 2, true)`, "setStepReverse en SET_STATE"], [`setStepReverse(sc, 1, "true")`, "valor no booleano"],
    [`retargetStep(pg, sc, 2, 3, true)`, "retarget de un evento de elemento con reverse"], [`retargetStep(pg, sc, 1, 6, 1)`, "reverse no booleano"]])
    assert.deepEqual(err(`(()=>{ const d = ${LOAD}.doc, pg = d.pages[0], sc = pg.scenarios[0]; ${code}; })()`, p), { code: "invalid_document" }, why);
  assert.deepEqual(err(`(()=>{ const d = ${LOAD}.doc; setStepReverse(d.pages[0].scenarios[0], 99, true); })()`, p), { code: "step_not_found" });
});

/* ═══════════════ B. Motor y Trace ═══════════════ */
test("B1 · ida normal: el Trace de siempre, sin la clave reverse (byte a byte)", () => {
  const r = trace(project([page([send(1, 0, 7, { eventTypeId: 1 })])]));
  assert.equal(JSON.stringify(r.trace.events), '[{"at":0,"type":"send_started","stepId":1,"edgeId":7},{"at":0,"type":"send_succeeded","stepId":1,"edgeId":7}]');
});

test("B2 · ida inversa: los tres eventos llevan reverse:true detrás de edgeId (y antes de reason)", () => {
  const ok = trace(project([page([send(1, 0, 7, { eventTypeId: 2, reverse: true })])]));
  assert.equal(JSON.stringify(ok.trace.events), '[{"at":0,"type":"send_started","stepId":1,"edgeId":7,"reverse":true},{"at":0,"type":"send_succeeded","stepId":1,"edgeId":7,"reverse":true}]');
  const ko = trace(project([page([down(1, 0, D), send(2, 3600, 7, { eventTypeId: 2, reverse: true })])]));
  assert.equal(JSON.stringify(ko.trace.events.slice(1)), '[{"at":3600,"type":"send_started","stepId":2,"edgeId":7,"reverse":true},{"at":3600,"type":"send_failed","stepId":2,"edgeId":7,"reverse":true,"reason":"source_down"}]',
    "§4 de 001: DB caída → la respuesta DB→Servicio falla en el ORIGEN");
});

test("B3 · source_down / target_down siguen al recorrido en los dos sentidos", () => {
  const reason = (fallen, rev) => trace(project([page([down(1, 0, fallen), send(2, 10, 7, rev ? { reverse: true } : {})])])).trace.events.find((e) => e.type === "send_failed").reason;
  assert.deepEqual([reason(S, false), reason(D, false), reason(S, true), reason(D, true)], ["source_down", "target_down", "target_down", "source_down"]);
});

test("B4 · ida y vuelta: varias respuestas sobre una conexión, los dos sentidos en el MISMO momento, y una conexión bidireccional (puntas)", () => {
  const r = trace(project([page(ROUND)]));
  assert.ok(r.ok);
  assert.deepEqual(r.trace.events.filter((e) => e.type === "send_succeeded").map((e) => [e.stepId, e.edgeId, !!e.reverse]),
    [[1, 5, false], [2, 6, false], [3, 7, false], [4, 7, true], [5, 6, true], [6, 5, true]]);
  const same = trace(project([page([down(1, 0, S), send(2, 10, 7), send(3, 10, 7, { reverse: true }), send(4, 10, 7, { reverse: true })])]));
  assert.deepEqual(same.trace.events.filter((e) => e.type === "send_failed").map((e) => [e.stepId, e.reason]), [[2, "source_down"], [3, "target_down"], [4, "target_down"]]);
  /* «bidireccional» de apariencia (dos puntas) o dos conexiones opuestas: el sentido lo sigue diciendo solo el Step */
  const bi = project([page([down(1, 0, D), send(2, 10, 7, { reverse: true }), send(3, 20, 8)], { edges: [edge(5, U, A), edge(6, A, S), edge(7, S, D, { startArrow: true, endArrow: true }), edge(8, D, S)] })]);
  assert.deepEqual(trace(bi).trace.events.filter((e) => e.type === "send_failed").map((e) => [e.stepId, e.edgeId, e.reason, !!e.reverse]),
    [[2, 7, "source_down", true], [3, 8, "source_down", false]]);
});

test("B5 · una conexión en bucle (documento antiguo) acepta reverse sin regla especial", () => {
  const r = trace(project([page([send(1, 0, 9, { reverse: true })], { edges: [edge(9, S, S)] })]));
  assert.ok(r.ok);
  assert.equal(r.trace.events[1].type, "send_succeeded");
});

test("B6 · motor: reverse no booleano o en otra acción → invalid_scenario; sin emitir nada", () => {
  const st = { nodes: [{ id: 1 }, { id: 2 }], edges: [{ id: 3, from: 1, to: 2 }] };
  const sc = (step) => ({ id: 1, engineVersion: 2, name: "H", nextStepId: 2, steps: [step] });
  const runE = (step) => run(`FluyoScenarios.runScenario(${JSON.stringify(st)}, [], ${JSON.stringify(sc(step))})`);
  for (const v of ["true", 1, null, false, 0]) {
    const r = runE({ id: 1, at: 0, action: "SEND", edgeId: 3, reverse: v });
    assert.equal(r.ok, false, String(v));
    assert.deepEqual(r.errors.map((e) => e.code), ["invalid_scenario"], String(v));
  }
  for (const step of [{ id: 1, at: 0, action: "SET_STATE", nodeId: 1, state: "DOWN", reverse: true }, { id: 1, at: 0, action: "OCCURRENCE", nodeId: 1, reverse: true }]) {
    const r = runE(step);
    assert.deepEqual(r.errors.map((e) => [e.code, e.reason]), [["invalid_scenario", "extra_fields"]], step.action);
  }
  assert.equal(runE({ id: 1, at: 0, action: "SEND", edgeId: 3, reverse: true }).ok, true);
});

/* ═══════════════ C. Playback y texto ═══════════════ */
const nodeName = `(id => { const n = pg.nodes.find(x=>x.id===id); return n ? n.label : "?"; })`;
const edgeEnds = `(id => { const e = pg.edges.find(x=>x.id===id); return e ? {from:e.from, to:e.to} : null; })`;
test("C1 · outcomes: reverse:true y reasonNodeId del recorrido (DB caída / Servicio caído en los dos sentidos)", () => {
  const oc = (fallen, rev) => run(`(()=>{ const d = ${LOAD}.doc, pg = d.pages[0], sc = pg.scenarios[0]; const r = FluyoStory.run(pg, sc); return FluyoStory.outcomes(r.trace, sc, pg)[1]; })()`,
    project([page([down(1, 0, fallen), send(2, 3600, 7, Object.assign({ eventTypeId: 2 }, rev ? { reverse: true } : {}))])]));
  assert.deepEqual(oc(D, true), { stepId: 2, at: 3600, action: "SEND", eventIndexes: [1, 2], eventTypeId: 2, edgeId: 7, reverse: true, status: "not_completed", reason: "source_down", reasonNodeId: D });
  assert.deepEqual(oc(S, true), { stepId: 2, at: 3600, action: "SEND", eventIndexes: [1, 2], eventTypeId: 2, edgeId: 7, reverse: true, status: "not_completed", reason: "target_down", reasonNodeId: S });
  assert.deepEqual(oc(D, false), { stepId: 2, at: 3600, action: "SEND", eventIndexes: [1, 2], eventTypeId: 2, edgeId: 7, status: "not_completed", reason: "target_down", reasonNodeId: D }, "sin reverse, sin clave");
  assert.deepEqual(oc(S, false).reasonNodeId, S);
});

test("C2 · sentence: la frase va en el sentido del Step («DB responde a Servicio»)", () => {
  const out = run(`(()=>{ const d = ${LOAD}.doc, pg = d.pages[0], sc = pg.scenarios[0]; return sc.steps.map(s => FluyoStory.sentence(pg, s, eventTypeByIdIn(d, s.eventTypeId))); })()`, project([page(ROUND)]));
  assert.deepEqual(out, ["Usuario pide a API", "API pide a Servicio", "Servicio pide a DB", "DB responde a Servicio", "Servicio responde a API", "API responde a Usuario"]);
});

test("C3 · caption (Present y Viewer): «No se completó · DB no está disponible» para la respuesta con DB caída; la firma de edgeEnds no cambia", () => {
  const cap = (fallen, rev) => run(`(()=>{ const d = ${LOAD}.doc, pg = d.pages[0], sc = pg.scenarios[0]; const s = FluyoStory.start(pg, sc, 0);
    FluyoScenarioPlayback.tick(s.playback, 3700); return FluyoStory.caption(s.playback.logEvents, 3700, ${nodeName}, ${edgeEnds}); })()`,
    project([page([down(1, 0, fallen), send(2, 3600, 7, Object.assign({ eventTypeId: 2 }, rev ? { reverse: true } : {}))])]));
  assert.equal(cap(D, true), "No se completó · DB no está disponible");
  assert.equal(cap(S, true), "No se completó · Servicio no está disponible");
  assert.equal(cap(D, false), "No se completó · DB no está disponible");
  assert.equal(cap(S, false), "No se completó · Servicio no está disponible");
  /* el motivo sale del evento, no del Step: con el Trace sin la clave, el mensaje se equivoca (lo que la mutación «Trace sin reverse» rompe) */
  assert.equal(run(`(()=>{ const pg = {nodes:[{id:3,label:"Servicio"},{id:4,label:"DB"}], edges:[{id:7,from:3,to:4}]};
    return FluyoStory.caption([{at:0, type:"send_failed", edgeId:7, reverse:true, stepId:1, reason:"target_down"}], 10, ${nodeName}, ${edgeEnds}); })()`), "No se completó · Servicio no está disponible");
});

test("C4 · scenario-playback lleva reverse a activeSends, completedSends y logEvents; sin reverse, los mismos objetos que antes", () => {
  const out = run(`(()=>{ const d = ${LOAD}.doc, pg = d.pages[0], sc = pg.scenarios[0]; const s = FluyoStory.start(pg, sc, 0);
    const a = FluyoScenarioPlayback.tick(s.playback, 10); const b = FluyoScenarioPlayback.tick(s.playback, 1200);
    const k = x => "reverse" in x ? [x.stepId, x.reverse] : [x.stepId];
    return {active: a.activeSends.map(k), done: b.completedSends.map(k), log: b.logEvents.map(e => [e.type, ...k(e)])}; })()`,
    project([page([send(1, 0, 7, { eventTypeId: 1 }), send(2, 0, 7, { eventTypeId: 2, reverse: true })])]));
  assert.deepEqual(out.active, [[1], [2, true]]);
  assert.deepEqual(out.done, [[1], [2, true]]);
  assert.deepEqual(out.log, [["send_started", 1], ["send_succeeded", 1], ["send_started", 2, true], ["send_succeeded", 2, true]]);
  const keys = run(`(()=>{ const d = ${LOAD}.doc, pg = d.pages[0], sc = pg.scenarios[0]; const s = FluyoStory.start(pg, sc, 0);
    const a = FluyoScenarioPlayback.tick(s.playback, 10); return [Object.keys(a.activeSends[0]), Object.keys(a.logEvents[0]), Object.keys(a.activeSends[1])]; })()`,
    project([page([send(1, 0, 7, { eventTypeId: 1 }), send(2, 0, 7, { eventTypeId: 2, reverse: true })])]));
  assert.ok(!keys[0].includes("reverse") && !keys[1].includes("reverse"), "un envío normal no lleva la clave");
  assert.deepEqual(keys[2].slice(0, 3), ["stepId", "edgeId", "reverse"]);
});

/* ═══════════════ D. Render: el token en el sentido del Step ═══════════════ */
function renderCtx() {
  const ctx = { console, performance: { now: () => 0 }, Math, JSON };
  ctx.window = ctx; ctx.matchMedia = () => ({ matches: false });
  vm.createContext(ctx);
  for (const f of ["config", "model", "geometry", "scenario-engine", "scenario-playback", "story-playback", "render"]) vm.runInContext(read("js/" + f + ".js"), ctx, { filename: f });
  return ctx;
}
function mockCanvas() {
  const log = { text: [], arcs: [] };
  let alpha = 1; const stack = [];
  const c = { save() { stack.push(alpha); }, restore() { alpha = stack.length ? stack.pop() : 1; }, beginPath() {}, moveTo() {}, lineTo() {}, fill() {}, stroke() {},
    arc(x, y, r) { log.arcs.push({ x, y }); }, fillText(t, x, y) { log.text.push({ t, x, y }); }, createRadialGradient() { return { addColorStop() {} }; },
    set globalAlpha(v) { alpha = v; }, get globalAlpha() { return alpha; }, font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, lineCap: "", lineJoin: "", textAlign: "", textBaseline: "", shadowColor: "", shadowBlur: 0, setLineDash() {} };
  return { c, log };
}
const PTS = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }];
function overlay(R, active, completed) {
  const m = mockCanvas();
  R.m = m; R.pts = J(PTS); R.active = active; R.completed = completed;
  vm.runInContext(`drawScenarioEdgeOverlay(m.c, {id:7}, pts, active, completed, "dark", {scenarioRuntime:{scenario:null}})`, R);
  return { log: m.log, pts: J(R.pts) };
}
test("D1 · token: con reverse sale del final de la ruta (progreso 0,25 ↔ 0,75 del normal); la ruta no se muta; los dos sentidos a la vez", () => {
  const R = renderCtx();
  const tok = (progress, reverse) => overlay(R, [Object.assign({ stepId: 1, edgeId: 7, progress, duration: 1100, token: "◆", connection: null, terminalType: null }, reverse ? { reverse: true } : {})], []);
  const at = (o) => [Math.round(o.log.text[0].x), Math.round(o.log.text[0].y)];
  assert.deepEqual(at(tok(0.25, false)), [100, 0]);
  assert.deepEqual(at(tok(0.75, false)), [200, 100]);
  assert.deepEqual(at(tok(0.25, true)), [200, 100], "reverse a 0,25 = normal a 0,75");
  assert.deepEqual(at(tok(0.75, true)), [100, 0]);
  assert.deepEqual(at(tok(0, true)), [200, 200], "sale de e.to");
  assert.deepEqual(tok(0.25, true).pts, PTS, "la ruta no cambia");
  const both = overlay(R, [{ stepId: 1, edgeId: 7, progress: 0.25, duration: 1100, token: "●", connection: null }, { stepId: 2, edgeId: 7, reverse: true, progress: 0.25, duration: 1100, token: "◆", connection: null }], []);
  assert.deepEqual(both.log.text.map((t) => [t.t, Math.round(t.x), Math.round(t.y)]), [["●", 100, 0], ["◆", 200, 100]]);
});

test("D2 · marcas: la llegada de un retorno cae en e.from y el fallo source_down en e.to (el origen del recorrido)", () => {
  const R = renderCtx();
  const mark = (terminalType, terminalReason, reverse) => overlay(R, [], [Object.assign({ stepId: 1, edgeId: 7, terminalType, terminalReason, ageMs: 100, cueMs: 700, token: "", connection: null }, reverse ? { reverse: true } : {})]).log.arcs[0];
  assert.deepEqual(mark("send_succeeded", undefined, false), { x: 200, y: 200 });
  assert.deepEqual(mark("send_succeeded", undefined, true), { x: 0, y: 0 });
  assert.deepEqual(mark("send_failed", "source_down", false), { x: 0, y: 0 });
  assert.deepEqual(mark("send_failed", "source_down", true), { x: 200, y: 200 });
  assert.deepEqual(mark("send_failed", "target_down", true), { x: 0, y: 0 });
});

/* ═══════════════ E. Autoría por lote (story-authoring.js) ═══════════════ */
const apply = (p, ops, C = K) => runIn(C, `FluyoAuthoring.apply(__a.p, __a.ops)`, { p, ops });
const sop = (op, extra) => Object.assign({ op, scope: "story", pageIndex: 0, storyId: 1 }, extra);
const lastStep = (r) => r.project.doc.pages[0].scenarios[0].steps.slice(-1)[0];
test("E1 · {from,to}: directa si existe; si solo hay la inversa, esa con reverse:true; si hay las dos, la directa", () => {
  const p = project([page([])]);
  const d = apply(p, [sop("add_step", { eventTypeId: 1, target: { from: S, to: D } })]);
  assert.ok(d.ok); assert.deepEqual(lastStep(d), { id: 1, at: 0, eventTypeId: 1, action: "SEND", edgeId: 7 });
  assert.ok(!("reverse" in d.changes[0]), "el resultado de siempre");
  const i = apply(p, [sop("add_step", { eventTypeId: 2, target: { from: D, to: S } })]);
  assert.ok(i.ok); assert.deepEqual(lastStep(i), { id: 1, at: 0, eventTypeId: 2, action: "SEND", edgeId: 7, reverse: true });
  assert.equal(i.changes[0].reverse, true);
  const both = project([page([], { edges: [edge(5, U, A), edge(6, A, S), edge(7, S, D), edge(8, D, S)] })]);
  assert.deepEqual(lastStep(apply(both, [sop("add_step", { eventTypeId: 2, target: { from: D, to: S } })])), { id: 1, at: 0, eventTypeId: 2, action: "SEND", edgeId: 8 }, "la directa gana");
});

test("E2 · ambigüedad en cada nivel → AMBIGUOUS_TARGET; ninguna conexión → TARGET_NOT_FOUND; el lote rechazado no deja documento", () => {
  const two = project([page([], { edges: [edge(5, U, A), edge(6, A, S), edge(7, S, D), edge(8, S, D)] })]);
  const a1 = apply(two, [sop("add_step", { eventTypeId: 1, target: { from: S, to: D } })]);
  assert.equal(a1.ok, false); assert.equal(a1.errors[0].code, "AMBIGUOUS_TARGET"); assert.ok(!("project" in a1));
  const a2 = apply(two, [sop("add_step", { eventTypeId: 2, target: { from: D, to: S } })]);
  assert.equal(a2.errors[0].code, "AMBIGUOUS_TARGET"); assert.deepEqual(a2.errors[0].edgeIds, [7, 8]); assert.equal(a2.errors[0].reverse, true);
  const mixed = project([page([], { edges: [edge(5, U, A), edge(6, A, S), edge(7, S, D), edge(8, S, D), edge(9, D, S)] })]);
  assert.deepEqual(lastStep(apply(mixed, [sop("add_step", { eventTypeId: 2, target: { from: D, to: S } })])).edgeId, 9, "una directa decide aunque haya varias inversas");
  const none = apply(project([page([])]), [sop("add_step", { eventTypeId: 1, target: { from: U, to: D } })]);
  assert.equal(none.errors[0].code, "TARGET_NOT_FOUND");
  const rej = apply(project([page([])]), [sop("add_step", { eventTypeId: 2, target: { from: D, to: S } }), sop("add_step", { eventTypeId: 1, target: { from: U, to: D } })]);
  assert.equal(rej.ok, false); assert.ok(!("project" in rej), "atómico");
});

test("E3 · formas explícitas {edgeId, reverse} y {ref, reverse}; reverse sobre un elemento → TARGET_INCOMPATIBLE; mal formado → INVALID_OPERATION", () => {
  const p = project([page([])]);
  assert.deepEqual(lastStep(apply(p, [sop("add_step", { eventTypeId: 2, target: { edgeId: 7, reverse: true } })])), { id: 1, at: 0, eventTypeId: 2, action: "SEND", edgeId: 7, reverse: true });
  assert.deepEqual(lastStep(apply(p, [sop("add_step", { eventTypeId: 2, target: { edgeId: 7, reverse: false } })])), { id: 1, at: 0, eventTypeId: 2, action: "SEND", edgeId: 7 }, "false = normal, sin clave");
  const ref = apply(p, [{ op: "create_connection", scope: "page", pageIndex: 0, source: { id: D }, target: { id: U }, ref: "back" },
    sop("add_step", { eventTypeId: 2, target: { ref: "back", reverse: true } })]);
  assert.ok(ref.ok, JSON.stringify(ref.errors));
  const created = ref.project.doc.pages[0].edges.find((e) => e.from === D && e.to === U);
  assert.deepEqual(lastStep(ref), { id: 1, at: 0, eventTypeId: 2, action: "SEND", edgeId: created.id, reverse: true });
  const code = (target, et = 3) => { const r = apply(p, [sop("add_step", { eventTypeId: et, target })]); return r.ok ? "ok" : r.errors[0].code; };
  assert.equal(code({ nodeId: D, reverse: true }), "TARGET_INCOMPATIBLE");
  assert.equal(code({ nodeId: D, reverse: false }), "TARGET_INCOMPATIBLE");
  assert.equal(code({ edgeId: 7, reverse: true }), "TARGET_INCOMPATIBLE", "evento de elemento sobre una conexión, como siempre");
  assert.equal(code({ from: D, to: S, reverse: true }, 2), "INVALID_OPERATION", "{from,to} ya dice el sentido");
  assert.equal(code({ edgeId: 7, reverse: "true" }, 2), "INVALID_OPERATION");
  assert.equal(code({ edgeId: 7, reverse: 1 }, 2), "INVALID_OPERATION");
  assert.equal(code({ edgeId: 7, sentido: "inverso" }, 2), "INVALID_OPERATION");
  const refEl = apply(p, [{ op: "create_node", scope: "page", pageIndex: 0, spec: { shape: "rect", x: 0, y: 0 }, ref: "n" }, sop("add_step", { eventTypeId: 3, target: { ref: "n", reverse: true } })]);
  assert.equal(refEl.errors[0].code, "TARGET_INCOMPATIBLE");
});

test("E4 · retarget_step: el target es el recorrido completo; da la vuelta en el sitio y vuelve; resultado con reverse/previousReverse", () => {
  const p = project([page([send(1, 0, 7, { eventTypeId: 1 }), send(2, 1000, 6, { eventTypeId: 1 })])]);
  const flip = apply(p, [sop("retarget_step", { stepId: 1, target: { edgeId: 7, reverse: true } })]);
  assert.ok(flip.ok);
  assert.deepEqual(flip.project.doc.pages[0].scenarios[0].steps[0], send(1, 0, 7, { eventTypeId: 1, reverse: true }), "id, at, orden y EventType intactos");
  assert.deepEqual([flip.changes[0].from, flip.changes[0].to, flip.changes[0].reverse, flip.changes[0].previousReverse], [7, 7, true, false]);
  const back = apply(flip.project, [sop("retarget_step", { stepId: 1, target: { edgeId: 7 } })]);
  assert.deepEqual(back.project.doc.pages[0].scenarios[0].steps[0], send(1, 0, 7, { eventTypeId: 1 }));
  assert.deepEqual([back.changes[0].reverse, back.changes[0].previousReverse], [false, true]);
  const viaPair = apply(p, [sop("retarget_step", { stepId: 2, target: { from: S, to: A } })]);
  assert.deepEqual(viaPair.project.doc.pages[0].scenarios[0].steps[1], send(2, 1000, 6, { eventTypeId: 1, reverse: true }));
  const plain = apply(p, [sop("retarget_step", { stepId: 2, target: { edgeId: 7 } })]);
  assert.ok(!("reverse" in plain.changes[0]) && !("previousReverse" in plain.changes[0]), "normal → normal: el resultado de siempre (sin las claves nuevas)");
});

test("E5 · duplicate_step conserva reverse (y lo dice); duplicate_story también", () => {
  const p = project([page([send(1, 0, 7, { eventTypeId: 2, reverse: true })])]);
  const r = apply(p, [sop("duplicate_step", { stepId: 1 }), { op: "duplicate_story", scope: "story", pageIndex: 0, storyId: 1 }]);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.project.doc.pages[0].scenarios[0].steps[1], { id: 2, at: 0, action: "SEND", edgeId: 7, eventTypeId: 2, reverse: true });
  assert.equal(r.changes[0].reverse, true);
  assert.ok(r.project.doc.pages[0].scenarios[1].steps.every((s) => s.reverse === true));
  const plain = apply(project([page([send(1, 0, 7, { eventTypeId: 2 })])]), [sop("duplicate_step", { stepId: 1 })]);
  assert.ok(!("reverse" in plain.changes[0]));
});

/* ═══════════════ F. Integridad y Share ═══════════════ */
const check = (p) => run(`FluyoIntegrity.validateProject(__a)`, p);
test("F1 · integridad: reverse válido → valid; reverse:false escrito a mano → valid; inválido → invalid_step localizado (y solo ese)", () => {
  assert.equal(check(project([page(ROUND)])).valid, true);
  assert.equal(check(project([page([send(1, 0, 7, { reverse: false })])])).valid, true);
  for (const v of ["true", 1, null]) {
    const r = check(project([page([send(1, 0, 7), send(2, 10, 7, { reverse: v })])]));
    assert.equal(r.valid, false);
    assert.deepEqual(r.errors.map((e) => [e.code, e.stepId, e.message]), [["invalid_step", 2, "Un evento de la historia tiene datos inválidos."]], String(v));
  }
  const both = check(project([page([send(1, 0, 7, { reverse: false }), send(2, 10, 7, { reverse: 1 })])]));
  assert.deepEqual(both.errors.map((e) => [e.code, e.stepId]), [["invalid_step", 2]], "un false de otro Step no se señala");
  const onSet = check(project([page([Object.assign(down(1, 0, D), { reverse: true })])]));
  assert.deepEqual(onSet.errors.map((e) => [e.code, e.stepId]), [["invalid_step", 1]]);
});

test("F2 · Share: el enlace #d= con la Historia elegida conserva reverse de ida y vuelta", async () => {
  const L = context(read, ["config.js", "safe-svg.js", "model.js", "geometry.js", "link-codec.js", "share-url.js"]);
  L.__a = project([page(ROUND)]);
  const back = await vm.runInContext(`createShareUrl(__a, "https://fluyo.space/", {kind:"story", scenarioId:1}).then(u => decodeDeepLink(new URL(u).hash.slice(3))).then(x => JSON.stringify(projectFromProjectData(x).doc.pages[0].scenarios[0].steps))`, L);
  assert.deepEqual(JSON.parse(back), ROUND);
});

/* ═══════════════ G. Editor (editor-scenarios.js / selection.js) ═══════════════ */
function extract(src, name) {
  const at = src.indexOf("\nfunction " + name + "(");
  assert.ok(at >= 0, "función " + name);
  let i = src.indexOf("{", at), depth = 0, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") q = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return src.slice(at + 1, i + 1);
  }
  throw new Error("sin cierre: " + name);
}
const ED_FNS = ["scNum", "scFormatTime", "scNodeLabel", "scNodeFallback", "scEdgeLabel", "scEdgeSecondary", "scTargetLabel", "scIsTargetMissing", "describeScenarioStep",
  "scSendFailText", "scRuntimeStateForStep", "scRenderTraceLog", "scWhereLabel", "scUseTarget", "scBeginMulti", "scConfirmMulti"];
function fakeNode(tag) {
  return { tag, children: [], textContent: "", className: "", classList: { add() {} }, appendChild(c) { this.children.push(c); return c; }, set innerHTML(v) { this.children = []; } };
}
const text = (n) => (n.textContent || "") + n.children.map(text).join("");
function editor() {
  const els = {};
  const $ = (id) => (els[id] = els[id] || fakeNode(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, $, GRID: 20, innerWidth: 1280, innerHeight: 800,
    document: { createElement: fakeNode, createTextNode: (t) => ({ textContent: t, children: [] }) } });
  require("./i18n-vm.cjs").loadI18n(ctx);   /* FLUYO-I18N-002 S2a: Historias pasa por FluyoI18n.t, como en la página (en español, el texto de siempre) */
  const R = (code) => vm.runInContext(code, ctx);
  for (const f of KERNEL.slice(0, 9)) vm.runInContext(read("js/" + f), ctx, { filename: f });
  R(`var selN=new Set(), selE=new Set(), clip=null, scPlayback=null, scStatus="idle", scActive=1, scPlacement=null, scContext=null, scSelectedStep=null, __commits=0;
     function confirm(){ return true; } function alert(){} function refreshPanel(){} function renderTabs(){} function scheduleAutosave(){}
     function isScenarioPlaybackActive(){ return scStatus==="running"; } function scActiveScenario(){ return P().scenarios.find(s=>s.id===scActive) || null; }
     function scEditable(){ return true; } function scCanPlaceEvents(){ return true; } function scCancelPlacement(){ scPlacement=null; } function scCommit(){ __commits++; }
     function scUpdatePlacementBar(){} function scVisibleAt(step){ return step.at; }
     function scBeginPlacement(id, kind, stepId){ scPlacement={eventTypeId:id, kind, stepId, existing:new Set(), targets:new Set(), targetType:"edge"}; }`);
  R(read("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  const src = read("js/editor-scenarios.js");
  vm.runInContext(ED_FNS.map((n) => extract(src, n)).join("\n"), ctx, { filename: "js/editor-scenarios.js#extract" });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0;");
  const play = (t) => R(`(()=>{ const s = FluyoStory.start(P(), scActiveScenario(), 0); scPlayback = s.playback; scStatus = "running"; FluyoScenarioPlayback.tick(scPlayback, ${t}); })()`);
  return { R, $, load, play, steps: () => J(R("scActiveScenario().steps")) };
}
test("G1 · panel: etiqueta «DB → Servicio», frase, «Dónde», motivo «DB no está disponible» y registro, en el sentido del Step", () => {
  const e = editor();
  e.load(project([page([down(1, 0, D), send(2, 3600, 7, { eventTypeId: 2, reverse: true }), send(3, 3600, 7, { eventTypeId: 1 })])]));
  assert.deepEqual(J(e.R(`scActiveScenario().steps.slice(1).map(s => [scTargetLabel(s), describeScenarioStep(s).primary, scWhereLabel(s)])`)),
    [["DB → Servicio", "DB responde a Servicio", "DB → Servicio"], ["Servicio → DB", "Servicio pide a DB", "Servicio → DB"]]);
  e.play(3700);
  assert.deepEqual(J(e.R(`scActiveScenario().steps.slice(1).map(s => scRuntimeStateForStep(s))`)),
    [{ status: "active", detail: null }, { status: "active", detail: null }]);
  e.play(6000);
  assert.deepEqual(J(e.R(`scActiveScenario().steps.slice(1).map(s => scRuntimeStateForStep(s).detail)`)), ["DB no está disponible", "DB no está disponible"],
    "respuesta: falla el origen (DB); petición: falla el destino (DB)");
  e.R("scRenderTraceLog()");
  const lines = e.$("scTraceLog").children.map(text);
  assert.ok(lines.some((l) => /DB → Servicio\s+Sale/.test(l)) && lines.some((l) => /DB → Servicio\s+Origen no disponible/.test(l)), lines.join(" | "));
  assert.ok(lines.some((l) => /Servicio → DB\s+Destino no disponible/.test(l)), lines.join(" | "));
});

test("G2 · «Cambiar dónde ocurre» conserva el sentido (una entrada de Undo; Undo/Redo exactos)", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2, reverse: true }), down(2, 500, D)])]));
  e.R(`scPlacement = {kind:"retarget", stepId:1, targetType:"edge"}; scUseTarget(6, false);`);
  assert.deepEqual(e.steps()[0], send(1, 0, 6, { eventTypeId: 2, reverse: true }));
  assert.equal(e.R("undoStack.length"), 1);
  e.R("undo()"); assert.deepEqual(e.steps()[0], send(1, 0, 7, { eventTypeId: 2, reverse: true }));
  e.R("redo()"); assert.deepEqual(e.steps()[0], send(1, 0, 6, { eventTypeId: 2, reverse: true }));
  e.R(`scPlacement = {kind:"retarget", stepId:2, targetType:"node"}; scUseTarget(${S}, false);`);
  assert.deepEqual(e.steps()[1], { id: 2, at: 500, action: "SET_STATE", nodeId: S, state: "DOWN", eventTypeId: 3 }, "un evento de elemento, como siempre");
  e.load(project([page([send(1, 0, 7, { eventTypeId: 1 })])]));
  e.R(`scPlacement = {kind:"retarget", stepId:1, targetType:"edge"}; scUseTarget(6, false);`);
  assert.deepEqual(e.steps()[0], send(1, 0, 6, { eventTypeId: 1 }), "un Step normal sigue normal");
});

test("G3 · «Esta misma acción en otras conexiones»: compara por (conexión, sentido) y las copias heredan reverse", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2, reverse: true }), send(2, 0, 6, { eventTypeId: 2 })])]));
  e.R("scBeginMulti(1)");
  assert.deepEqual(J(e.R("[...scPlacement.existing]")), [7], "la 6 normal no cuenta como ya colocada en sentido inverso");
  e.R("scPlacement.targets.add(6); scPlacement.targets.add(5); scConfirmMulti()");
  assert.deepEqual(e.steps().slice(2), [{ id: 3, at: 0, action: "SEND", edgeId: 6, eventTypeId: 2, reverse: true }, { id: 4, at: 0, action: "SEND", edgeId: 5, eventTypeId: 2, reverse: true }]);
  e.R("scBeginMulti(2)");
  assert.deepEqual(J(e.R("[...scPlacement.existing]")), [6], "desde la normal: solo las normales");
});

test("G4 · borrar una conexión usada: la confirmación nombra el recorrido del Step («DB → Servicio»)", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2, reverse: true })])]));
  assert.deepEqual(J(e.R("deleteImpact([], [7]).stories.map(s => s.targets)")), [["DB → Servicio"]]);
});

/* ═══════════════ H. Documentos antiguos: lo de siempre, byte a byte, frente a 544fd4b ═══════════════ */
function corpus() {
  const files = [];
  for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of fs.readdirSync(path.join(root, dir))) if (/\.json$/.test(f)) files.push(dir + "/" + f);
  return files;
}
const SURFACE = `(()=>{ let loaded; try{ loaded = projectFromProjectData(__a); }catch(e){ return {load:e.code}; }
  const out = {saved: JSON.stringify(projectToSerializable(loaded.doc, loaded.settings)), integrity: JSON.stringify(FluyoIntegrity.validateProject(__a)), pages: []};
  loaded.doc.pages.forEach((pg, i) => { doc = loaded.doc; doc.cur = i;
    const nodeName = id => { const n = pg.nodes.find(x=>x.id===id); return n ? n.label : "?"; }, edgeEnds = id => { const e = pg.edges.find(x=>x.id===id); return e ? {from:e.from, to:e.to} : null; };
    for(const sc of pg.scenarios){
      const r = FluyoStory.run(pg, sc);
      const row = {run: JSON.stringify(r)};
      if(r.ok){
        row.outcomes = JSON.stringify(FluyoStory.outcomes(r.trace, sc, pg));
        row.sentences = JSON.stringify(sc.steps.map(s => FluyoStory.sentence(pg, s, s.eventTypeId ? eventTypeByIdIn(loaded.doc, s.eventTypeId) : null)));
        const s = FluyoStory.start(pg, sc, 0), ticks = [];
        const end = Math.max(0, ...sc.steps.map(x => x.at)) + 3000;
        for(let t = 0; t <= end; t += Math.max(50, Math.round(end / 40))){ const rs = FluyoScenarioPlayback.tick(s.playback, t); ticks.push(JSON.stringify([rs.activeSends, rs.completedSends, rs.logEvents, FluyoStory.caption(rs.logEvents, t, nodeName, edgeEnds)])); }
        row.ticks = ticks;
      }
      out.pages.push(row);
    } });
  return out; })()`;
test("H1 · ejemplos y fixtures: carga, guardado, integridad, Trace, outcomes, frases, playback y mensajes IDÉNTICOS a " + BASE, () => {
  const OLD = context(atBase);
  let docs = 0, stories = 0;
  for (const f of corpus()) {
    const p = JSON.parse(read(f));
    const now = runIn(K, SURFACE, p), was = runIn(OLD, SURFACE, p);
    assert.deepEqual(now, was, f);
    if (!now.load) { docs++; stories += now.pages.length; }
  }
  assert.ok(docs >= 10 && stories >= 5, `corpus real (${docs} documentos, ${stories} Historias)`);
});

test("H2 · autoría de siempre: los mismos lotes dan el mismo documento y los mismos resultados que " + BASE, () => {
  const OLD = context(atBase);
  const p = project([page([send(1, 0, 5, { eventTypeId: 1 }), down(2, 500, D)])]);
  const ops = [sop("add_step", { eventTypeId: 1, target: { from: A, to: S } }), sop("add_step", { eventTypeId: 1, target: { edgeId: 7 }, waitMs: 300 }),
    sop("duplicate_step", { stepId: 1 }), sop("retarget_step", { stepId: 1, target: { edgeId: 6 } }), sop("retarget_step", { stepId: 2, target: { nodeId: S } }),
    { op: "duplicate_story", scope: "story", pageIndex: 0, storyId: 1 }];
  for (let k = 1; k <= ops.length; k++) assert.deepEqual(apply(p, ops.slice(0, k)), apply(p, ops.slice(0, k), OLD), "lote de " + k);
  for (const bad of [{ edgeId: 99 }, { nodeId: D }, { from: U }])
    assert.deepEqual(apply(p, [sop("add_step", { eventTypeId: 1, target: bad })]), apply(p, [sop("add_step", { eventTypeId: 1, target: bad })], OLD), JSON.stringify(bad));
  /* sin directa ni inversa: el mismo código y los mismos datos; el mensaje ahora dice que también se buscó la inversa */
  const none = apply(p, [sop("add_step", { eventTypeId: 1, target: { from: U, to: D } })]), was = apply(p, [sop("add_step", { eventTypeId: 1, target: { from: U, to: D } })], OLD);
  const noMsg = (r) => r.errors.map(({ message, ...rest }) => rest);
  assert.deepEqual(noMsg(none), noMsg(was));
  assert.equal(none.errors[0].message, "No existe una conexión de 1 a 4 (ni de 4 a 1 para recorrerla al revés).");
});

test("H3 · un lector anterior (" + BASE + ") RECHAZA un documento con reverse (no lo lee mal): carga, motor e integridad", () => {
  const OLD = context(atBase);
  const p = project([page(ROUND)]);
  assert.deepEqual(runIn(OLD, `(()=>{ try{ projectFromProjectData(__a); return "abre"; }catch(e){ return e.code; } })()`, p), "invalid_document");
  assert.deepEqual(runIn(OLD, `FluyoScenarios.runScenario({nodes:[{id:1},{id:2}], edges:[{id:3,from:1,to:2}]}, [], {id:1, engineVersion:2, name:"H", nextStepId:2, steps:[{id:1,at:0,action:"SEND",edgeId:3,reverse:true}]}).errors.map(e=>[e.code,e.reason])`),
    [["invalid_scenario", "extra_fields"]]);
  assert.deepEqual(runIn(OLD, `FluyoIntegrity.validateProject(__a).errors.map(e=>e.code)`, p), ["invalid_step", "invalid_step", "invalid_step"]);
});

/* ═══════════════ I. Alcance ═══════════════ */
test("I1 · versiones: engineVersion 2 y version 5 (NO v3); sw.js sube a v97; Viewer, Present, reloj y semántica de flujo sin diff", () => {
  assert.equal(run("FluyoScenarios.ENGINE_VERSION"), 2);
  assert.equal(run("SCENARIO_ENGINE_VERSION"), 2);
  assert.equal(run("projectToSerializable({}, {}).version"), 5);
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v113";/);
  const { undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade al precache js/i18n-en.js y js/i18n.js */
  assert.equal(undoI18n("sw.js", read("sw.js")).replace('"fluyo-static-v113"', '"fluyo-static-v' + (97 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante");
  const { undo4: undo4only, PIECES: PIECES4 } = require("./fluyo-scenarios-semantics-4-undo.cjs"), { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs"), undo4 = (f, src) => undo4only(f, undo5(f, src));   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima: se deshace antes */
  for (const f of ["js/viewer.js", "js/present-story.js", "js/story-clock.js", "js/flow-semantics.js", "js/link-codec.js", "js/share-url.js", "index.html", "s/index.html", "css/styles.css"])
    assert.equal(undo4(f, read(f)), atBase(f), f + " sin cambios");
  const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* el menú llega en STEP-REVERSE-003: fuera de 003, no está */
  assert.ok(!/Invertir sentido/.test(undoReverseUi("js/editor-scenarios.js", undo4("js/editor-scenarios.js", read("js/editor-scenarios.js")))), "el menú «Invertir sentido» es de STEP-REVERSE-003");
});

test("I2 · una sola regla: fuera de traversalEnds nadie deduce el recorrido de e.from/e.to en el texto ni en los resultados", () => {
  const sp = read("js/story-playback.js");
  assert.ok(!/e\.from|e\.to\b/.test(sp.slice(sp.indexOf("function outcomes"), sp.indexOf("function isFinished"))), "outcomes y sentence");
  assert.ok(!/e\.from|e\.to\b/.test(sp.slice(sp.indexOf("function caption"), sp.indexOf("function failedCount"))), "caption");
  const ed = read("js/editor-scenarios.js");
  for (const n of ["scEdgeLabel", "describeScenarioStep", "scSendFailText", "scRuntimeStateForStep", "scWhereLabel"]) assert.ok(!/\.from\b|\.to\b/.test(extract(ed, n)), n);
  const en = read("js/scenario-engine.js");
  assert.ok(en.includes("states.get(reverse ? edge.to : edge.from)") && en.includes("states.get(reverse ? edge.from : edge.to)"), "la línea del motor (atada por A3)");
});

test("I3 · alcance frente a " + BASE + ": solo cambian estos archivos servidos, y undoReverse (para los alcances antiguos) los devuelve EXACTOS a la base", () => {
  const SERVED = ["js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !shellOnly(f, read, atBase));
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const { undoReverse, REGIONS } = require("./fluyo-step-reverse-002-undo.cjs");
  const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* STEP-REVERSE-003 va encima: se deshace antes */
  const { undo4: undo4only, PIECES: PIECES4 } = require("./fluyo-scenarios-semantics-4-undo.cjs"), { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs"), undo4 = (f, src) => undo4only(f, undo5(f, src));   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima: se deshace antes */
  const PIECES5 = require("./fluyo-scenarios-semantics-5-undo.cjs").PIECES;   /* SCENARIOS-SEMANTICS-001 FASE 5: lo suyo se descuenta como lo de FASE 4 */
  const PIECES6 = require("./fluyo-scenarios-semantics-6-undo.cjs").PIECES;   /* SCENARIOS-SEMANTICS-001 FASE 6, igual */
  const { undo029 } = require("./fluyo-018-29-undo.cjs"), ONLY029 = ["js/story-clock.js"].filter((f) => undo029(f, read(f)) === atBase(f));   /* FLUYO-018.29 (G1) solo añade reveal al reloj: deshecho (undo029) es el de la base */
  const { undo030 } = require("./fluyo-018-30-undo.cjs"), ONLY030 = ["js/viewer-viewport.js"].filter((f) => undo030(f, read(f)) === atBase(f));   /* FLUYO-018.30 solo añade la cámara de la Historia al Viewer: deshecho (undo030) es el de la base */
  const { NEW_FILES: NEW_I18N, undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade js/i18n.js y js/i18n-en.js (no existen en la base) */
  assert.deepEqual([...new Set([...changed, ...untracked])].filter((f) => !NEW_I18N.includes(f)).filter((f) => (!Object.keys(PIECES4).includes(f) && !Object.keys(PIECES5).includes(f) && !Object.keys(PIECES6).includes(f) && !ONLY029.includes(f) && !ONLY030.includes(f)) || Object.keys(REGIONS).includes(f)).sort(), [...Object.keys(REGIONS), "sw.js"].sort());
  for (const f of Object.keys(PIECES6)) if (!Object.keys(REGIONS).includes(f) && !Object.keys(PIECES4).includes(f)) assert.equal(undo4(f, read(f)), atBase(f), f + ": solo FASE 5/6");
  for (const f of Object.keys(PIECES4)) if (!Object.keys(REGIONS).includes(f)) assert.equal(undo4(f, read(f)), atBase(f), f + ": solo FASE 4");
  for (const f of Object.keys(REGIONS)) assert.equal(undoReverse(f, undoReverseUi(f, undo4(f, read(f)))), atBase(f), f);
});
