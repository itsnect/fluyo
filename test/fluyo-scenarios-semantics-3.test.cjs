"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 3 — Story Observed Flow (decisiones 230–233).
   · Kernel (model.js): scenario.observedFlow opcional, normalización conservadora, setObservedFlowIn, cascada en deleteNodeIn,
     removalImpact lo informa; Condiciones guarda {initialState:"UP"}.
   · Derivación (flow-semantics.js): resolveObservedFlow (explícito, estructural único, ENDPOINT_MISSING, sin par) y
     observedFlowAt (AVAILABLE / UNAVAILABLE / NO_PATH con el reloj VISIBLE de la Historia); UNKNOWN inalcanzable.
   · Editor (editor-scenarios.js, bloque «Ruta observada»): solo con labs, con Flujo y con eventos; textos aprobados; reacciona a
     reproducción, pausa y saltos; elegir/quitar = UNA entrada de Undo; borrar un extremo = la misma entrada que el borrado.
   · Sin timeline, sin pintado en el lienzo, sin Viewer/Present, sin autoría MCP. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "16ee642";   // main al empezar FASE 3 (producción v95)
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js", "document-integrity.js", "story-authoring.js"];
function context(src = read, files = KERNEL, extra = {}) {
  const ctx = vm.createContext(Object.assign({ TextEncoder, TextDecoder, atob, btoa, URL, CompressionStream, DecompressionStream, crypto, console }, extra));
  for (const f of files) vm.runInContext(src("js/" + f), ctx, { filename: f });
  return ctx;
}
const K = context();
const run = (code, arg) => { K.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, K)); };
const err = (code, arg) => { K.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(`(()=>{ try{ ${code}; return null; }catch(e){ return {code:e.code, field:e.field}; } })()`, K)); };

/* ── constructores ── */
const rect = (id, label) => ({ id, shape: "rect", x: id * 200, y: 0, w: 140, h: 60, label: label || "N" + id });
const edge = (id, from, to, kind) => Object.assign({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [] }, kind ? { kind } : {});
const project = (pages, extra = {}) => ({ version: 5, app: "fluyo", doc: Object.assign({ theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages, cur: 0 }, extra), settings: {} });
const story = (id, steps, extra = {}) => Object.assign({ id, engineVersion: 2, name: "Historia " + id, nextStepId: steps.length + 1, steps }, extra);
const down = (id, at, nodeId, state = "DOWN") => ({ id, at, action: "SET_STATE", nodeId, state });
const send = (id, at, edgeId) => ({ id, at, action: "SEND", edgeId });

/* Fixture de aceptación (dos workers): Cliente → API → Cola → {Worker A | Worker B} → BD (Flujo); API → Auth (Requisito);
   API → Métricas (Conexión). La Historia: un pedido, cae A, cae B. */
const CLI = 1, API = 2, COLA = 3, WA = 4, WB = 5, BD = 6, AUTH = 7, MET = 8;
function workersPage(storyExtra = {}, steps) {
  return {
    name: "Workers", nextId: 100, behaviors: [], nextScenarioId: 2,
    nodes: [rect(CLI, "Cliente"), rect(API, "API"), rect(COLA, "Cola"), rect(WA, "Worker A"), rect(WB, "Worker B"), rect(BD, "BD"), rect(AUTH, "Auth"), rect(MET, "Métricas")],
    edges: [edge(11, CLI, API, "FLOWS_TO"), edge(12, API, COLA, "FLOWS_TO"), edge(13, COLA, WA, "FLOWS_TO"), edge(14, COLA, WB, "FLOWS_TO"),
      edge(15, WA, BD, "FLOWS_TO"), edge(16, WB, BD, "FLOWS_TO"), edge(17, API, AUTH, "REQUIRES"), edge(18, API, MET)],
    scenarios: [story(1, steps || [send(1, 0, 11), down(2, 1500, WA), down(3, 3000, WB)], storyExtra)],
  };
}
/* Estado de la ruta en t con la receta del editor: Trace del motor + horario visible (story-clock.js). */
const AT = `(function(p, sc, t){ const run = FluyoStory.run(p, sc); if(!run.ok) return {error:run.errors};
  const meta = FluyoStory.stepMeta(sc.steps), sch = FluyoStoryClock.schedule(sc, meta);
  const events = sch.shifted ? FluyoStoryClock.visibleTrace(run.trace, sch.byStep).events : run.trace.events;
  return FluyoFlow.observedFlowAt(p, sc, events, t, st => sch.byStep[st.id] !== undefined ? sch.byStep[st.id] : st.at); })`;
const loadPage = (pg) => `projectFromProjectData({version:5, app:"fluyo", doc:{theme:"dark", eventTypes:[], nextEventTypeId:1, cur:0, pages:[${JSON.stringify(pg)}]}}).doc.pages[0]`;
const statusAt = (pg, ts) => run(`(()=>{ const p = ${loadPage(pg)}; return __a.map(t => ${AT}(p, p.scenarios[0], t)); })()`, ts);

/* ═══════════════ A. Kernel: observedFlow ═══════════════ */
test("A1 · normalización conservadora: ausente no se rellena; null y formas rotas se quitan; un par válido se conserva TAL CUAL", () => {
  const cases = [undefined, null, "1-6", [1, 6], { from: 1 }, { from: 1, to: 1 }, { from: 0, to: 6 }, { from: 1.5, to: 6 }, { from: "1", to: 6 },
    { from: 1, to: 6 }, { from: 1, to: 99 }, { from: 98, to: 99 }, { from: 6, to: 1, via: [3], futuro: { x: 1 } }];
  const out = run(`__a.map(f => { const sc = {id:1, engineVersion:2, name:"H", nextStepId:1, steps:[]}; if(f !== "__none") sc.observedFlow = f;
    const p = ${loadPage({ name: "P", nodes: [rect(1), rect(6)], edges: [], nextId: 10 })}; const pg = Object.assign({}, p, {scenarios:[sc], nextScenarioId:2});
    const once = projectFromProjectData({version:5, app:"fluyo", doc:{theme:"dark", cur:0, pages:[pg]}});
    const twice = projectFromProjectData(JSON.parse(JSON.stringify(projectToSerializable(once.doc, once.settings))));
    const a = once.doc.pages[0].scenarios[0], b = twice.doc.pages[0].scenarios[0];
    return {has: "observedFlow" in a, value: a.observedFlow === undefined ? "absent" : a.observedFlow, idem: JSON.stringify(a) === JSON.stringify(b)}; })`,
  cases.map((c) => (c === undefined ? "__none" : c)));
  const kept = out.map((o) => o.value);
  assert.deepEqual(kept.slice(0, 9), Array(9).fill("absent"), "ausente, null y formas rotas → sin clave");
  assert.deepEqual(kept.slice(9), [{ from: 1, to: 6 }, { from: 1, to: 99 }, { from: 98, to: 99 }, { from: 6, to: 1, via: [3], futuro: { x: 1 } }],
    "par válido, extremos perdidos (ENDPOINT_MISSING) y claves futuras se conservan");
  assert.ok(out.every((o) => o.idem), "idempotente");
});

test("A2 · B4 corpus: ejemplos y fixtures cargan IDÉNTICOS con el model.js de " + BASE + " (byte a byte tras serializar)", () => {
  const OLD = context(atBase, ["config.js", "safe-svg.js", "model.js"]);
  const files = [];
  for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of fs.readdirSync(path.join(root, dir))) if (/\.json$/.test(f)) files.push(dir + "/" + f);
  let compared = 0;
  for (const f of files) {
    let data; try { data = JSON.parse(read(f)); } catch { continue; }
    const docs = [];
    (function walk(v) { if (v && typeof v === "object") { if (v.app === "fluyo" && v.doc) docs.push(v); else for (const k of Object.keys(v)) walk(v[k]); } })(data);
    for (const d of docs) {
      const load = (G) => { G.__d = JSON.stringify(d); try { return vm.runInContext("JSON.stringify((r => projectToSerializable(r.doc, r.settings))(projectFromProjectData(JSON.parse(__d))))", G); } catch (e) { return "ERR:" + e.code; } };
      assert.equal(load(K), load(OLD), f);
      compared++;
    }
  }
  assert.ok(compared >= 20, "corpus comparado: " + compared + " documentos");
});

test("A3 · setObservedFlowIn: escribe {from, to}; el valor actual no cambia nada; null quita; rechazos sin tocar la Historia", () => {
  const out = run(`(()=>{ const p = ${loadPage(workersPage())}; const sc = p.scenarios[0], r = [];
    r.push(setObservedFlowIn(p, 1, {from:1, to:6})); r.push(JSON.stringify(sc.observedFlow));
    r.push(setObservedFlowIn(p, 1, {from:1, to:6}));
    r.push(setObservedFlowIn(p, 1, {from:2, to:6})); r.push(JSON.stringify(sc.observedFlow));
    r.push(setObservedFlowIn(p, 1, null)); r.push("observedFlow" in sc);
    r.push(setObservedFlowIn(p, 1, null));
    return r; })()`);
  assert.deepEqual(out, [{ changed: true, before: null, after: { from: 1, to: 6 } }, '{"from":1,"to":6}', { changed: false, before: { from: 1, to: 6 }, after: { from: 1, to: 6 } },
    { changed: true, before: { from: 1, to: 6 }, after: { from: 2, to: 6 } }, '{"from":2,"to":6}', { changed: true, before: { from: 2, to: 6 }, after: null }, false,
    { changed: false, before: null, after: null }]);
  const P0 = loadPage(workersPage({ observedFlow: { from: 1, to: 6 } }));
  const bad = [["9, {from:1, to:6}", "scenario_not_found", "storyId"], ["1, [1,6]", "invalid_document", "observedFlow"], ["1, {from:'1', to:6}", "invalid_document", "from"],
    ["1, {from:1}", "invalid_document", "to"], ["1, {from:99, to:6}", "node_not_found", "from"], ["1, {from:1, to:99}", "node_not_found", "to"], ["1, {from:6, to:6}", "self_loop", "to"]];
  for (const [args, code, field] of bad) {
    assert.deepEqual(err(`const p = ${P0}; setObservedFlowIn(p, ${args})`), { code, field }, args);
    assert.deepEqual(run(`(()=>{ const p = ${P0}; try{ setObservedFlowIn(p, ${args}); }catch(e){} return p.scenarios[0].observedFlow; })()`), { from: 1, to: 6 }, "intacta tras " + args);
  }
});

test("A4 · B5 cascada: deleteNodeIn quita la ruta de las Historias que nombran el nodo (origen o destino) y solo de esas", () => {
  const pg = workersPage({ observedFlow: { from: CLI, to: BD } });
  pg.scenarios.push(story(2, [down(1, 0, WA)], { observedFlow: { from: API, to: BD } }), story(3, [down(1, 0, WA)], { observedFlow: { from: COLA, to: WA } }), story(4, [down(1, 0, WA)]));
  pg.nextScenarioId = 5;
  const out = run(`(()=>{ const p = ${loadPage(pg)}; const fl = () => p.scenarios.map(s => s.observedFlow || null);
    const a = deleteNodeIn(p, ${BD}).observedFlows, after1 = fl();
    const b = deleteNodeIn(p, ${MET}).observedFlows;
    const c = deleteConnectionIn(p, 13) && fl();
    return {a, after1, b, c}; })()`);
  assert.deepEqual(out.a, [1, 2], "las dos Historias que terminan en BD");
  assert.deepEqual(out.after1, [null, null, { from: COLA, to: WA }, null]);
  assert.deepEqual(out.b, [], "un nodo que nadie observa no toca ninguna ruta");
  assert.deepEqual(out.c, [null, null, { from: COLA, to: WA }, null], "borrar una CONEXIÓN no toca observedFlow (la derivación dirá NO_PATH)");
});

test("A5 · removalImpact informa la ruta observada que se perdería (aviso: no cuenta en wouldInvalidate) y no muta nada", () => {
  const pg = workersPage({ observedFlow: { from: CLI, to: BD } }, [down(1, 0, WA)]);
  pg.scenarios.push(story(2, [down(1, 0, WB)], { observedFlow: { from: BD, to: CLI } }));
  pg.nextScenarioId = 3;
  const p = project([pg]);
  const before = JSON.stringify(p);
  const r = run("FluyoIntegrity.removalImpact(__a, {pageIndex:0, nodeIds:[" + CLI + "]})", p);
  assert.equal(r.wouldInvalidate, false);
  assert.deepEqual(r.observedFlows, [{ pageIndex: 0, storyId: 1, storyName: "Historia 1", endpoints: ["from"] }, { pageIndex: 0, storyId: 2, storyName: "Historia 2", endpoints: ["to"] }]);
  assert.deepEqual(run("FluyoIntegrity.removalImpact(__a, {pageIndex:0, nodeIds:[" + MET + "]})", p).observedFlows, []);
  assert.deepEqual(run("FluyoIntegrity.removalImpact(__a, {pageIndex:0, edgeIds:[12]})", p).observedFlows, []);
  assert.equal(JSON.stringify(p), before);
});

test("A6 · MCP (kernel): delete_node informa cascade.observedFlows y el documento sale sin la ruta; sin ruta la respuesta es la de siempre", () => {
  const p = project([workersPage({ observedFlow: { from: CLI, to: BD } }, [down(1, 0, WA)])]);
  const r = run(`FluyoAuthoring.apply(__a, [{op:"delete_node", scope:"page", pageIndex:0, node:{id:${BD}}}])`, p);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.changes[0].cascade.observedFlows, [1]);
  assert.equal("observedFlow" in r.project.doc.pages[0].scenarios[0], false);
  const r2 = run(`FluyoAuthoring.apply(__a, [{op:"delete_node", scope:"page", pageIndex:0, node:{id:${MET}}}])`, p);
  assert.deepEqual(Object.keys(r2.changes[0].cascade), ["connections", "behaviors"]);
  assert.deepEqual(r2.project.doc.pages[0].scenarios[0].observedFlow, { from: CLI, to: BD }, "el resto de operaciones conserva la clave (passthrough)");
});

test("A7 · observedFlow viaja con la Historia: duplicar, guardar/abrir y el enlace #d= (Share)", async () => {
  const p = project([workersPage({ observedFlow: { from: CLI, to: BD } })]);
  assert.deepEqual(run(`(()=>{ const d = projectFromProjectData(__a).doc, pg = d.pages[0]; const c = duplicateScenario(pg, 1); return [c.observedFlow, c.id]; })()`, p), [{ from: CLI, to: BD }, 2]);
  const L = context(read, ["config.js", "safe-svg.js", "model.js", "geometry.js", "link-codec.js"]);
  L.__a = p;
  const back = await vm.runInContext("encodeDeepLink(__a).then(x=>decodeDeepLink(x)).then(x=>JSON.stringify(projectFromProjectData(x)))", L);
  assert.deepEqual(JSON.parse(back).doc.pages[0].scenarios[0].observedFlow, { from: CLI, to: BD });
});

test("A8 · Condiciones → «Disponible» se GUARDA ({initialState:\"UP\"}); el Trace del motor es idéntico con y sin ese Behavior", () => {
  const out = run(`(()=>{ const p = ${loadPage(workersPage())}; const sc = p.scenarios[0];
    const t0 = JSON.stringify(FluyoStory.run(p, sc).trace);
    setInitialAvailability(p, ${WA}, "DOWN"); const b1 = JSON.stringify(p.behaviors);
    setInitialAvailability(p, ${WA}, "UP"); const b2 = JSON.stringify(p.behaviors);
    setInitialAvailability(p, ${CLI}, "UP"); const b3 = JSON.stringify(p.behaviors);
    return {b1, b2, b3, same: JSON.stringify(FluyoStory.run(p, sc).trace) === t0}; })()`);
  assert.equal(out.b1, `[{"nodeId":${WA},"initialState":"DOWN"}]`);
  assert.equal(out.b2, `[{"nodeId":${WA},"initialState":"UP"}]`, "DOWN → UP sustituye, no borra");
  assert.equal(out.b3, `[{"nodeId":${WA},"initialState":"UP"},{"nodeId":${CLI},"initialState":"UP"}]`);
  assert.ok(out.same, "afirmar UP no cambia el Trace");
});

/* ═══════════════ B. Derivación ═══════════════ */
const resolve = (pg) => run(`FluyoFlow.resolveObservedFlow(${loadPage(pg)}, (${loadPage(pg)}).scenarios[0])`);
test("B1 · resolveObservedFlow: explícito · ENDPOINT_MISSING sin caer al estructural · estructural único · sin par", () => {
  assert.deepEqual(resolve(workersPage({ observedFlow: { from: API, to: WB } })), { state: "PAIR", origin: "story", source: API, target: WB, missing: [] });
  assert.deepEqual(resolve(workersPage()), { state: "PAIR", origin: "structural", source: CLI, target: BD, missing: [] }, "Requisito y Conexión no cuentan: un origen y un destino");
  assert.deepEqual(resolve(workersPage({ observedFlow: { from: 90, to: BD } })), { state: "ENDPOINT_MISSING", origin: "story", source: 90, target: BD, missing: ["from"] });
  assert.deepEqual(resolve(workersPage({ observedFlow: { from: CLI, to: 91 } })).missing, ["to"]);
  assert.deepEqual(resolve(workersPage({ observedFlow: { from: 90, to: 91 } })).missing, ["from", "to"]);
  const two = workersPage(); two.nodes.push(rect(9, "Otro cliente")); two.edges.push(edge(19, 9, API, "FLOWS_TO"));
  assert.equal(resolve(two).state, "NO_PAIR", "dos orígenes");
  const sinks = workersPage(); sinks.edges = sinks.edges.filter((e) => e.id !== 16);
  assert.equal(resolve(sinks).state, "NO_PAIR", "dos destinos (BD y Worker B)");
  const none = workersPage(); none.edges = none.edges.map((e) => Object.assign({}, e, { kind: e.kind === "FLOWS_TO" ? undefined : e.kind }));
  assert.equal(resolve(none).state, "NO_PAIR", "sin Flujo");
  const cyc = { name: "C", nextId: 20, behaviors: [], nextScenarioId: 2, nodes: [rect(1), rect(2), rect(3)], edges: [edge(11, 1, 2, "FLOWS_TO"), edge(12, 2, 3, "FLOWS_TO"), edge(13, 3, 1, "FLOWS_TO")], scenarios: [story(1, [down(1, 0, 2)])] };
  assert.equal(resolve(cyc).state, "NO_PAIR", "ciclo sin origen");
  assert.deepEqual(err("FluyoFlow.resolveObservedFlow(__a.p, __a.s)", { p: workersPage(), s: { observedFlow: { from: 1, to: 1 } } }), { code: "invalid_document", field: "observedFlow" });
  assert.deepEqual(run(`FluyoFlow.flowNodes(${loadPage(workersPage())})`), [CLI, API, COLA, WA, WB, BD], "selectores: los nodos de algún Flujo, en orden del documento");
});

test("B2 · ACEPTACIÓN (dos workers): disponible → cae A, sigue disponible → cae B, no disponible → sin estructura, «Sin ruta de flujo»", () => {
  const st = statusAt(workersPage({ observedFlow: { from: CLI, to: BD } }), [0, 1499, 1500, 2999, 3000, 9000]).map((r) => r.status);
  assert.deepEqual(st, ["AVAILABLE", "AVAILABLE", "AVAILABLE", "AVAILABLE", "UNAVAILABLE", "UNAVAILABLE"]);
  assert.deepEqual(statusAt(workersPage(), [0, 1500, 3000]).map((r) => r.status), ["AVAILABLE", "AVAILABLE", "UNAVAILABLE"], "igual con el par estructural");
  const cut = workersPage({ observedFlow: { from: CLI, to: BD } }); cut.edges = cut.edges.filter((e) => e.id !== 12);
  assert.deepEqual(statusAt(cut, [0, 1500, 3000]).map((r) => r.status), ["NO_PATH", "NO_PATH", "NO_PATH"]);
  const asConn = workersPage({ observedFlow: { from: CLI, to: BD } }); asConn.edges = asConn.edges.map((e) => (e.id === 12 ? Object.assign({}, e, { kind: undefined }) : e));
  assert.deepEqual(statusAt(asConn, [0]).map((r) => r.status), ["NO_PATH"], "Conexión en lugar de Flujo: no hay ruta de flujo");
});

test("B3 · NO_PATH ≠ UNAVAILABLE: sin estructura es NO_PATH aunque todo esté caído; con estructura y todo caído es UNAVAILABLE", () => {
  const allDown = (pg) => { pg.behaviors = pg.nodes.map((n) => ({ nodeId: n.id, initialState: "DOWN" })); return pg; };
  const cut = allDown(workersPage({ observedFlow: { from: CLI, to: BD } })); cut.edges = cut.edges.filter((e) => e.id !== 12);
  assert.equal(statusAt(cut, [0])[0].status, "NO_PATH");
  assert.equal(statusAt(allDown(workersPage({ observedFlow: { from: CLI, to: BD } })), [0])[0].status, "UNAVAILABLE");
});

test("B4 · más de 64 caminos: 7 rombos (128 caminos), el único disponible es el último en orden DFS → AVAILABLE; cerrándolo → UNAVAILABLE", () => {
  const nodes = [], edges = [], downs = [];
  let id = 1; const S = id++; nodes.push(rect(S)); let j = S, eid = 100;
  for (let i = 0; i < 7; i++) {
    const a = id++, b = id++, nj = id++; nodes.push(rect(a), rect(b), rect(nj));
    edges.push(edge(eid++, j, a, "FLOWS_TO"), edge(eid++, j, b, "FLOWS_TO"), edge(eid++, a, nj, "FLOWS_TO"), edge(eid++, b, nj, "FLOWS_TO"));
    downs.push(a); j = nj;
  }
  const lastB = j - 1;
  const steps = downs.map((n, i) => down(i + 1, 1000, n)).concat([down(downs.length + 1, 2000, lastB)]);
  const pg = { name: "R", nextId: 999, behaviors: [], nextScenarioId: 2, nodes, edges, scenarios: [story(1, steps, { observedFlow: { from: S, to: j } })] };
  assert.deepEqual(statusAt(pg, [0, 1000, 2000]).map((r) => r.status), ["AVAILABLE", "AVAILABLE", "UNAVAILABLE"]);
});

test("B5 · ciclos: un ciclo con salida conserva la ruta; un ciclo sin salida hacia el destino es NO_PATH; ningún cálculo cuelga", () => {
  const pg = { name: "C", nextId: 20, behaviors: [], nextScenarioId: 2, nodes: [rect(1), rect(2), rect(3), rect(4), rect(5)],
    edges: [edge(11, 1, 2, "FLOWS_TO"), edge(12, 2, 3, "FLOWS_TO"), edge(13, 3, 2, "FLOWS_TO"), edge(14, 3, 4, "FLOWS_TO"), edge(15, 5, 1, "FLOWS_TO")],
    scenarios: [story(1, [down(1, 1000, 2)], { observedFlow: { from: 1, to: 4 } })] };
  assert.deepEqual(statusAt(pg, [0, 1000]).map((r) => r.status), ["AVAILABLE", "UNAVAILABLE"]);
  const back = J(pg); back.scenarios[0].observedFlow = { from: 2, to: 5 };
  assert.deepEqual(statusAt(back, [0]).map((r) => r.status), ["NO_PATH"]);
});

test("B6 · T1 horario VISIBLE: con dependencias de llegada, la ruta cambia en el instante visible del estado, no en el narrativo", () => {
  /* el momento de «cae B» (narrativo 1000) espera a que llegue el pedido (SEND en 0, viaje normal 1100) → visible 1100 */
  const pg = workersPage({ observedFlow: { from: CLI, to: BD }, arrivalDependencies: [{ stepId: 3, waitsForArrivalOf: [1] }] },
    [send(1, 0, 11), down(2, 0, WA), down(3, 1000, WB)]);
  const st = statusAt(pg, [0, 1000, 1099, 1100]).map((r) => r.status);
  assert.deepEqual(st, ["AVAILABLE", "AVAILABLE", "AVAILABLE", "UNAVAILABLE"]);
});

test("B7 · procedencia: por defecto → «incluye estados por defecto» (explicitPath false); Condiciones o SET_STATE UP en toda la ruta → afirmada", () => {
  assert.equal(statusAt(workersPage({ observedFlow: { from: CLI, to: BD } }), [0])[0].explicitPath, false);
  const cond = workersPage({ observedFlow: { from: CLI, to: BD } });
  cond.behaviors = [CLI, API, COLA, WB, BD].map((n) => ({ nodeId: n, initialState: "UP" }));
  assert.deepEqual(statusAt(cond, [0, 1500]).map((r) => [r.status, r.explicitPath]), [["AVAILABLE", true], ["AVAILABLE", true]], "ruta por B, toda afirmada en Condiciones");
  const set = workersPage({ observedFlow: { from: CLI, to: BD } }, [down(1, 0, CLI, "UP"), down(2, 0, API, "UP"), down(3, 0, COLA, "UP"), down(4, 0, WA, "UP"), down(5, 0, BD, "UP"), down(6, 1500, WA)]);
  assert.deepEqual(statusAt(set, [0, 1500]).map((r) => [r.status, r.explicitPath]), [["AVAILABLE", true], ["AVAILABLE", false]], "cae A: queda la ruta por B, que no está afirmado");
  assert.equal(statusAt(workersPage({ observedFlow: { from: CLI, to: BD } }), [3000])[0].explicitPath, null, "solo matiza un resultado disponible");
});

test("B7b · la procedencia también usa el instante VISIBLE: una afirmación que espera una llegada cuenta cuando se ve, no antes", () => {
  const steps = [send(1, 0, 11)].concat([CLI, API, COLA, WB, BD].map((n, i) => down(i + 2, 1000, n, "UP")));
  const pg = workersPage({ observedFlow: { from: CLI, to: BD }, arrivalDependencies: [{ stepId: 2, waitsForArrivalOf: [1] }] }, steps);
  assert.deepEqual(statusAt(pg, [1000, 1099, 1100]).map((r) => r.explicitPath), [false, false, true]);
});

test("B8 · determinismo: reordenar nodos, conexiones y Behaviors no cambia nada; repetir da lo mismo", () => {
  const pg = workersPage({ observedFlow: { from: CLI, to: BD } });
  pg.behaviors = [{ nodeId: WB, initialState: "UP" }, { nodeId: API, initialState: "UP" }];
  const a = statusAt(pg, [0, 1500, 3000]);
  const r = J(pg); r.nodes.reverse(); r.edges.reverse(); r.behaviors.reverse();
  assert.deepEqual(statusAt(r, [0, 1500, 3000]), a);
  assert.deepEqual(statusAt(pg, [0, 1500, 3000]), a);
  const s = workersPage(); s.nodes.reverse(); s.edges.reverse();
  assert.deepEqual(resolve(s), resolve(workersPage()), "el par estructural tampoco depende del orden");
});

test("B9 · B6 nada derivado se persiste: tras elegir la ruta y derivar en todos los instantes, el documento solo guarda {from, to}", () => {
  const out = run(`(()=>{ const d = projectFromProjectData(__a).doc, p = d.pages[0], sc = p.scenarios[0];
    setObservedFlowIn(p, 1, {from:${CLI}, to:${BD}});
    for(const t of [0, 1500, 3000]) ${AT}(p, sc, t);
    return projectToSerializable(d, {}); })()`, project([workersPage()]));
  const sc = out.doc.pages[0].scenarios[0];
  assert.deepEqual(Object.keys(sc).sort(), ["engineVersion", "id", "name", "nextStepId", "observedFlow", "steps"]);
  assert.deepEqual(sc.observedFlow, { from: CLI, to: BD });
  assert.ok(!/status|explicitPath|provenance|AVAILABLE|NO_PATH|ENDPOINT_MISSING|structural/.test(JSON.stringify(out)), "sin claves ni valores derivados");
});

test("B10 · UNKNOWN inalcanzable: 300 Historias aleatorias (semilla fija) nunca dan UNKNOWN ni un estado fuera de los tres", () => {
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const seen = new Set();
  for (let k = 0; k < 300; k++) {
    const n = 3 + Math.floor(rnd() * 6), nodes = [], edges = []; let eid = 100;
    for (let i = 1; i <= n; i++) nodes.push(rect(i));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) if (i !== j && rnd() < 0.3) edges.push(edge(eid++, i, j, rnd() < 0.7 ? "FLOWS_TO" : rnd() < 0.5 ? "REQUIRES" : undefined));
    const steps = []; for (let s = 1; s <= 3; s++) steps.push(down(s, s * 500, 1 + Math.floor(rnd() * n), rnd() < 0.6 ? "DOWN" : "UP"));
    const pg = { name: "R", nextId: 999, behaviors: [], nextScenarioId: 2, nodes, edges, scenarios: [story(1, steps, { observedFlow: { from: 1, to: n } })] };
    for (const r of statusAt(pg, [0, 700, 1600])) seen.add(r.status);
  }
  assert.deepEqual([...seen].sort(), ["AVAILABLE", "NO_PATH", "UNAVAILABLE"]);
});

/* ═══════════════ C. Editor: el bloque «Ruta observada» de editor-scenarios.js con el editor real (state.js + selection.js) ═══════════════ */
function flowBlock() {
  const src = read("js/editor-scenarios.js");
  const a = src.indexOf("/* ===================== Ruta observada (SCENARIOS-SEMANTICS-001 FASE 3"), b = src.indexOf("/* ===================== fin de la ruta observada");
  assert.ok(a > 0 && b > a, "bloque de la ruta observada en editor-scenarios.js");
  return src.slice(a, b);
}
function fakeEl(id) {
  return { id, hidden: false, value: "", disabled: false, textContent: "", dataset: {}, children: [], writes: 0,
    replaceChildren(...c) { this.children = c; this.writes++; if (!c.some((o) => o.value === this.value)) this.value = c.length ? c[0].value : ""; } };
}
function editor({ labs = true } = {}) {
  const els = {};
  const $ = (id) => (els[id] = els[id] || fakeEl(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, $, GRID: 20, innerWidth: 1280, innerHeight: 800, LABS_SEMANTICS: labs,
    document: { createElement: (tag) => ({ tag, value: "", textContent: "", disabled: false }) } });
  const R = (code) => vm.runInContext(code, ctx);
  for (const f of KERNEL.slice(0, 9)) vm.runInContext(read("js/" + f), ctx, { filename: f });
  R(`var selN=new Set(), selE=new Set(), clip=null, __confirms=[], __autosaves=0, __runs=0, scPlayback=null, scStatus="idle", scActive=1;
     function confirm(m){ __confirms.push(m); return true; } function alert(){} function prompt(){ return null; }
     function refreshPanel(){} function renderTabs(){} function scheduleAutosave(){ __autosaves++; }
     function isScenarioPlaybackActive(){ return scStatus==="running" || scStatus==="completed"; } function scReset(){ scStatus="idle"; scPlayback=null; }
     function scActiveScenario(){ return P().scenarios.find(s=>s.id===scActive) || null; }
     function scNodeFallback(id){ const n=P().nodes.find(x=>x.id===id); return n ? n.label : "Elemento"; }
     function scEl(tag, cls, text){ const el=document.createElement(tag); if(text!==undefined) el.textContent=text; return el; }
     const __run = FluyoStory.run; FluyoStory.run = function(){ __runs++; return __run.apply(this, arguments); };`);
  R(read("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  vm.runInContext(flowBlock(), ctx, { filename: "js/editor-scenarios.js#ruta-observada" });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0; scStatus='idle'; scPlayback=null; scFlowLast=null; scFlowPending=null;");
  const model = () => J(R("scFlowModel()"));
  const view = () => { R("scRenderFlow()"); const f = $("scFlowFrom"), t = $("scFlowTo");
    return { hidden: $("scFlow").hidden, word: $("scFlowWord").textContent, why: $("scFlowWhy").textContent, state: $("scFlow").dataset.state,
      from: f.value, to: t.value, fromOpts: f.children.map((o) => [o.value, o.textContent, !!o.disabled]), toOpts: t.children.map((o) => [o.value, o.textContent, !!o.disabled]), disabled: f.disabled }; };
  const pick = (end, value) => { $(end === "from" ? "scFlowFrom" : "scFlowTo").value = String(value); R(`scFlowPick("${end}")`); };
  /* reproducción real: la receta del editor (FluyoStoryClock.start + tick) con un reloj controlado */
  const play = (t) => R(`(()=>{ const s = FluyoStoryClock.start(P(), scActiveScenario(), 0); scPlayback = s.playback; scStatus = "running"; FluyoScenarioPlayback.tick(scPlayback, ${t}); })()`);
  const tick = (t) => R(`FluyoScenarioPlayback.tick(scPlayback, ${t})`);
  const seek = (i, t) => R(`(()=>{ const c = {base:0, pausedAt:${t}}; const r = FluyoStoryClock.seek(c, ${t}, P(), scActiveScenario(), ${i}); scPlayback = r.playback; })()`);
  return { ctx, R, $, load, model, view, pick, play, tick, seek, undo: () => R("undo()"), redo: () => R("redo()"), undos: () => R("undoStack.length"), doc: () => J(R("P()")) };
}

test("C1 · la herramienta solo existe con labs, con alguna conexión Flujo y con eventos en la Historia", () => {
  const off = editor({ labs: false }); off.load(project([workersPage()]));
  assert.equal(off.view().hidden, true, "labs apagado: no existe");
  const e = editor(); e.load(project([workersPage()]));
  assert.equal(e.view().hidden, false);
  const noFlow = workersPage(); noFlow.edges = noFlow.edges.map((x) => Object.assign({}, x, { kind: x.kind === "FLOWS_TO" ? undefined : x.kind }));
  e.load(project([noFlow])); assert.equal(e.view().hidden, true, "sin Flujo");
  e.load(project([workersPage({}, [])])); assert.equal(e.view().hidden, true, "Historia sin eventos");
});

test("C2 · sin reproducir: «Al inicio · Ruta disponible · incluye estados por defecto»; con la ruta afirmada en Condiciones, sin el matiz", () => {
  const e = editor(); e.load(project([workersPage()]));
  const v = e.view();
  assert.equal(v.word, "Al inicio · Ruta disponible"); assert.equal(v.why, " · incluye estados por defecto"); assert.equal(v.state, "AVAILABLE");
  const cond = workersPage(); cond.behaviors = [CLI, API, COLA, WA, WB, BD].map((n) => ({ nodeId: n, initialState: "UP" }));
  e.load(project([cond]));
  assert.deepEqual([e.view().word, e.view().why], ["Al inicio · Ruta disponible", ""]);
});

test("C3 · ACEPTACIÓN en el editor: la reproducción actualiza el estado; la pausa lo congela; saltar lo recalcula; terminada, el final", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.play(0); assert.equal(e.view().word, "Ruta disponible");
  e.tick(1600); assert.equal(e.view().word, "Ruta disponible", "cae A: sigue disponible");
  e.tick(3100); assert.equal(e.view().word, "Ruta no disponible", "cae B");
  assert.equal(e.view().state, "UNAVAILABLE");
  assert.equal(e.view().disabled, true, "reproduciendo, la ruta no se elige (el documento no se edita)");
  /* pausa: el reloj no avanza, el cursor tampoco (FluyoStoryClock.now devuelve el instante pausado) */
  const c = e.R("(()=>{ const c = FluyoStoryClock.create(); FluyoStoryClock.pause(c, 3100); return FluyoStoryClock.now(c, 99999); })()");
  e.tick(c); assert.equal(e.view().word, "Ruta no disponible");
  e.seek(0, 3100); assert.equal(e.view().word, "Ruta disponible", "saltar al primer momento");
  e.seek(1, 3100); assert.equal(e.view().word, "Ruta disponible", "momento 2: cae A");
  e.seek(2, 3100); assert.equal(e.view().word, "Ruta no disponible", "momento 3: cae B");
  e.R('scStatus = "completed"'); assert.equal(e.view().word, "Ruta no disponible");
  e.R("scReset()"); assert.equal(e.view().word, "Al inicio · Ruta disponible", "Detener vuelve a «Al inicio»");
  /* sin estructura: «Sin ruta de flujo» */
  const cut = workersPage({ observedFlow: { from: CLI, to: BD } }); cut.edges = cut.edges.filter((x) => x.id !== 12);
  e.load(project([cut])); assert.deepEqual([e.view().word, e.view().state], ["Al inicio · Sin ruta de flujo", "NO_PATH"]);
  e.play(3100); assert.equal(e.view().word, "Sin ruta de flujo");
});

test("C4 · selectores: nodos de algún Flujo en orden del documento; «Automática · nombre» con el par estructural; cada uno excluye al otro", () => {
  const e = editor(); e.load(project([workersPage()]));
  const v = e.view();
  assert.deepEqual([v.from, v.to], ["auto", "auto"]);
  assert.deepEqual(v.fromOpts.map((o) => o[1]), ["Automática · Cliente", "Cliente", "API", "Cola", "Worker A", "Worker B"], "sin BD: es el destino que se muestra");
  assert.deepEqual(v.toOpts.map((o) => o[1]), ["Automática · BD", "API", "Cola", "Worker A", "Worker B", "BD"], "sin Cliente: es el origen que se muestra");
  e.load(project([workersPage({ observedFlow: { from: API, to: WB } })]));
  const w = e.view();
  assert.deepEqual([w.from, w.to], [String(API), String(WB)]);
  assert.ok(!w.fromOpts.some((o) => o[0] === String(WB)) && !w.toOpts.some((o) => o[0] === String(API)));
  assert.equal(w.fromOpts[0][1], "Automática", "con la ruta guardada, «Automática» sin nombre");
  /* un extremo guardado que ya no participa en ningún Flujo sigue en la lista */
  e.load(project([workersPage({ observedFlow: { from: AUTH, to: BD } })]));
  assert.ok(e.view().fromOpts.some((o) => o[0] === String(AUTH)));
});

test("C5 · Undo: elegir escribe AMBOS extremos con UNA entrada; elegir lo actual no apila; «Automática» quita con UNA entrada; Undo/Redo exactos", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.pick("from", API);
  assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: API, to: BD }, "el otro extremo es el que mostraba su selector (el automático)");
  assert.equal(e.undos(), 1);
  e.pick("from", API); assert.equal(e.undos(), 1, "elegir lo actual no apila");
  e.pick("to", WB); assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: API, to: WB }); assert.equal(e.undos(), 2);
  e.pick("to", "auto"); assert.equal("observedFlow" in e.doc().scenarios[0], false); assert.equal(e.undos(), 3);
  e.pick("from", "auto"); assert.equal(e.undos(), 3, "quitar lo que no está no apila");
  e.undo(); assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: API, to: WB });
  e.undo(); assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: API, to: BD });
  e.undo(); assert.equal("observedFlow" in e.doc().scenarios[0], false);
  e.redo(); assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: API, to: BD });
  assert.ok(e.R("__autosaves") >= 3);
});

test("C6 · sin par: «Elige origen y destino»; un extremo solo no escribe (ni Undo); el segundo escribe los dos con UNA entrada", () => {
  const pg = workersPage(); pg.nodes.push(rect(9, "Otro cliente")); pg.edges.push(edge(19, 9, API, "FLOWS_TO"));
  const e = editor(); e.load(project([pg]));
  assert.equal(e.view().word, "Elige origen y destino");
  assert.equal(e.view().state, "NO_PAIR");
  e.pick("from", 9);
  assert.equal("observedFlow" in e.doc().scenarios[0], false); assert.equal(e.undos(), 0);
  assert.equal(e.view().from, "9", "la elección a medias se ve");
  assert.ok(!e.view().toOpts.some((o) => o[0] === "9"));
  e.pick("to", BD);
  assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: 9, to: BD }); assert.equal(e.undos(), 1);
  assert.equal(e.view().word, "Al inicio · Ruta disponible");
});

test("C7 · ENDPOINT_MISSING (documento externo): aviso, el extremo perdido se marca «—» y se recupera eligiendo otro (UNA entrada)", () => {
  const e = editor(); e.load(project([workersPage({ observedFlow: { from: 77, to: BD } })]));
  const v = e.view();
  assert.equal(v.word, "Un extremo de la ruta ya no existe"); assert.equal(v.state, "ENDPOINT_MISSING");
  assert.equal(v.from, ""); assert.deepEqual(v.fromOpts[1], ["", "—", true]); assert.equal(v.to, String(BD));
  e.pick("from", CLI);
  assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: CLI, to: BD }); assert.equal(e.undos(), 1);
  assert.equal(e.view().word, "Al inicio · Ruta disponible");
  e.load(project([workersPage({ observedFlow: { from: 77, to: 78 } })]));
  e.pick("from", CLI); assert.equal(e.undos(), 0, "con los dos perdidos, uno solo no escribe");
  e.pick("to", BD); assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: CLI, to: BD }); assert.equal(e.undos(), 1);
});

test("C8 · B5 en el editor: borrar un extremo (deleteSel) quita la ruta en la MISMA entrada de Undo; Undo devuelve nodo y ruta", () => {
  const e = editor(); e.load(project([workersPage({ observedFlow: { from: CLI, to: BD } })]));
  e.R(`selN = new Set([${BD}]); deleteSel()`);
  assert.equal("observedFlow" in e.doc().scenarios[0], false);
  assert.equal(e.undos(), 1);
  assert.deepEqual(e.R("__confirms").length, 0, "sin Steps afectados, sin confirmación (política de 018.4)");
  assert.equal(e.view().word, "Elige origen y destino", "sin BD hay dos destinos: la Historia vuelve a pedir el par");
  e.undo();
  assert.deepEqual(e.doc().scenarios[0].observedFlow, { from: CLI, to: BD });
  assert.ok(e.doc().nodes.some((n) => n.id === BD));
});

test("C9 · memoización: sin cambios en el documento la receta corre UNA vez; un cambio la repite; reproduciendo no corre", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.R("__runs = 0"); for (let i = 0; i < 5; i++) e.model();
  assert.equal(e.R("__runs"), 1);
  e.R(`setInitialAvailability(P(), ${WA}, "DOWN")`); e.model(); e.model();
  assert.equal(e.R("__runs"), 2);
  e.play(0); e.R("__runs = 0"); for (const t of [100, 1600, 3100]) { e.tick(t); e.model(); }
  assert.equal(e.R("__runs"), 0, "la reproducción ya trae su Trace visible");
});

test("C9b · reproduciendo, la herramienta lee el MISMO Trace visible que proyecta la reproducción (no una receta paralela)", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.model();                                   // la base de edición queda memoizada
  e.play(3100); assert.equal(e.view().word, "Ruta no disponible");
  /* si la reproducción proyectara otro Trace, la herramienta debe seguirlo: se quita «cae B» del Trace de la reproducción */
  e.R(`(()=>{ const ev = scPlayback.trace.events; const i = ev.findIndex(x => x.type === "state_changed" && x.nodeId === ${WB}); ev.splice(i, 1); })()`);
  e.R("scFlowLast = null");
  assert.equal(e.view().word, "Ruta disponible");
});

test("C10 · el DOM solo se escribe cuando cambia algo", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.view(); const w = e.$("scFlowFrom").writes;
  e.R("scRenderFlow(); scRenderFlow();");
  assert.equal(e.$("scFlowFrom").writes, w);
});

/* ═══════════════ D. Estático y alcance ═══════════════ */
test("D1 · markup estático bajo el transporte, oculto por defecto; textos aprobados en el bloque del editor", () => {
  const html = read("index.html");
  const a = html.indexOf('id="scErrors"'), f = html.indexOf('<section id="scFlow"'), p = html.indexOf('id="scPaletteToggle"');
  assert.ok(a > 0 && f > a && p > f, "#scFlow entre #scErrors y la paleta, dentro de la cabecera de Historias");
  const sec = html.slice(f, html.indexOf("</section>", f));
  assert.match(sec, /class="scFlow" aria-label="Ruta observada" hidden>/);
  for (const s of ['<span class="srOnly">Origen</span><select id="scFlowFrom">', '<span class="srOnly">Destino</span><select id="scFlowTo">', 'id="scFlowState" class="scFlowState" role="status"']) assert.ok(sec.includes(s), s);
  const block = flowBlock();
  for (const s of ['"Ruta disponible"', '"Ruta no disponible"', '"Sin ruta de flujo"', '"incluye estados por defecto"', '"Al inicio · "', '"Automática"', '"Elige origen y destino"'])
    assert.ok(block.includes(s), s);
  assert.ok(!/UNKNOWN|desconocid/.test(block), "UNKNOWN no se ofrece ni se nombra");
});

test("D2 · carga: el editor carga flow-semantics.js (tras story-clock.js) y lo precachea con CACHE v96; el Viewer NO lo carga", () => {
  const html = read("index.html");
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i("story-clock.js") < i("flow-semantics.js") && i("flow-semantics.js") < i("editor-scenarios.js") && i("flow-semantics.js") > 0);
  assert.ok(!read("s/index.html").includes("flow-semantics"), "Viewer sin cambios (FASE 5)");
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v96";/);
  assert.ok(sw.includes('"./js/story-clock.js",\n  "./js/flow-semantics.js",\n  "./js/document-integrity.js",'));
});

test("D3 · alcance frente a " + BASE + ": solo cambian estos archivos servidos; render, Viewer, Present y exportación intactos", () => {
  const SERVED = ["js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(),
    ["css/styles.css", "index.html", "js/document-integrity.js", "js/editor-scenarios.js", "js/flow-semantics.js", "js/model.js", "js/story-authoring.js", "sw.js"]);
  for (const f of ["js/render.js", "js/viewer.js", "js/present-story.js", "js/export.js", "js/story-clock.js", "js/scenario-engine.js", "js/ui.js", "s/index.html"])
    assert.equal(read(f), atBase(f), f + " intacto");
});

test("D5 · undo3 (para los alcances de slices anteriores) deshace EXACTAMENTE FASE 3: cada archivo servido vuelve a " + BASE, () => {
  const { undo3, REGIONS } = require("./fluyo-scenarios-semantics-3-undo.cjs");
  for (const f of Object.keys(REGIONS)) {
    let back = undo3(f, read(f));
    if (f === "sw.js") back = back.replace('"fluyo-static-v96"', '"fluyo-static-v' + (96 - 1) + '"');
    assert.equal(back, atBase(f), f);
  }
});

test("D4 · B7: sin restos del prototipo en los archivos servidos", () => {
  for (const f of ["index.html", "js/editor-scenarios.js", "js/flow-semantics.js", "js/model.js", "css/styles.css", "sw.js"])
    assert.ok(!/PROTO_|prototipo=|protoSemantic|proto-semantic/.test(read(f)), f);
});
