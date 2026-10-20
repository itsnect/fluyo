"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 4 — Scenario Experience (decisiones 241–244). Sobre el contrato cerrado de FASE 3 (D5, D-Ruta,
   observedFlow, AVAILABLE / UNAVAILABLE / NO_PATH): nada de eso cambia aquí.
   · A (derivación, flow-semantics.js): ruta estructural (flowRoute), estado de cada conexión (routeEdgeStates), línea de tiempo
     DERIVADA (routeTimeline) y filas (routePaths). Nunca cambian el estado de la ruta y nada se persiste (N3/B6).
   · B (editor, scFlowOverlay): lo que el lienzo pinta en cada instante de la reproducción: solo con labs, con par y con ruta,
     nunca en Present; pausa y saltos dan lo mismo que una reproducción continua; Requisito y Conexión nunca entran.
   · C (editor, la herramienta): línea de tiempo (edición sin cursor; reproduciendo con cursor), extremos, filas, fin VISIBLE de la
     Historia, Undo solo en lo persistido, DOM solo si cambia.
   · D (render.js): fundas bajo la línea pintada (también con la piel), barrido solo en frontera y nunca con «reducir movimiento»,
     transición local y pastilla en el pintor de overlays de nodo, Requisito estable, N3; sin `flow` el pintado es el de ae0d619
     operación a operación (labs apagado = producción).
   · E (estático): markup, textos, alcance frente a ae0d619 y undo4. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "ae0d619";   // main al empezar FASE 4 (producción v98)
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js"];
function context(src = read, files = KERNEL, extra = {}) {
  const ctx = vm.createContext(Object.assign({ TextEncoder, TextDecoder, atob, btoa, URL, console }, extra));
  for (const f of files) vm.runInContext(src("js/" + f), ctx, { filename: f });
  return ctx;
}
const K = context();
const run = (code, arg) => { K.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, K)); };

/* ── constructores ── */
const rect = (id, label) => ({ id, shape: "rect", x: id * 200, y: 0, w: 140, h: 60, label: label || "N" + id });
const edge = (id, from, to, kind) => Object.assign({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [] }, kind ? { kind } : {});
const project = (pages, extra = {}) => ({ version: 5, app: "fluyo", doc: Object.assign({ theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages, cur: 0 }, extra), settings: {} });
const story = (id, steps, extra = {}) => Object.assign({ id, engineVersion: 2, name: "Historia " + id, nextStepId: steps.length + 1, steps }, extra);
const setS = (id, at, nodeId, state = "DOWN") => ({ id, at, action: "SET_STATE", nodeId, state });
const send = (id, at, edgeId, extra = {}) => Object.assign({ id, at, action: "SEND", edgeId }, extra);

/* Fixture de aceptación (dos workers, el de FASE 3): Cliente → API → Cola → {Worker A | Worker B} → BD (Flujo); API → Auth
   (Requisito); API → Métricas (Conexión). La Historia: un pedido (0), cae A (1500), cae B (3000). */
const CLI = 1, API = 2, COLA = 3, WA = 4, WB = 5, BD = 6, AUTH = 7, MET = 8;
function workersPage(storyExtra = {}, steps) {
  return {
    name: "Workers", nextId: 100, behaviors: [], nextScenarioId: 2,
    nodes: [rect(CLI, "Cliente"), rect(API, "API"), rect(COLA, "Cola"), rect(WA, "Worker A"), rect(WB, "Worker B"), rect(BD, "BD"), rect(AUTH, "Auth"), rect(MET, "Métricas")],
    edges: [edge(11, CLI, API, "FLOWS_TO"), edge(12, API, COLA, "FLOWS_TO"), edge(13, COLA, WA, "FLOWS_TO"), edge(14, COLA, WB, "FLOWS_TO"),
      edge(15, WA, BD, "FLOWS_TO"), edge(16, WB, BD, "FLOWS_TO"), edge(17, API, AUTH, "REQUIRES"), edge(18, API, MET)],
    scenarios: [story(1, steps || [send(1, 0, 11), setS(2, 1500, WA), setS(3, 3000, WB)], storyExtra)],
  };
}
const loadPage = (pg) => `projectFromProjectData({version:5, app:"fluyo", doc:{theme:"dark", eventTypes:[], nextEventTypeId:1, cur:0, pages:[${JSON.stringify(pg)}]}}).doc.pages[0]`;
/* Línea de tiempo con la receta del editor: Trace del motor + horario visible (story-clock.js) y un fin dado. */
const TL = (pg, from, to, end) => run(`(()=>{ const p = ${loadPage(pg)}, sc = p.scenarios[0]; const r = FluyoStory.run(p, sc);
  const meta = FluyoStory.stepMeta(sc.steps), sch = FluyoStoryClock.schedule(sc, meta);
  const ev = sch.shifted ? FluyoStoryClock.visibleTrace(r.trace, sch.byStep).events : r.trace.events;
  const route = FluyoFlow.flowRoute(p, ${from}, ${to}); return FluyoFlow.routeTimeline(p, route, ev, ${end}); })()`);
const ROUTE = (pg, from, to) => run(`FluyoFlow.flowRoute(${loadPage(pg)}, ${from}, ${to})`);
const PATHS = (pg, from, to, limit) => run(`FluyoFlow.routePaths(FluyoFlow.flowRoute(${loadPage(pg)}, ${from}, ${to}), ${limit})`);
const statesOf = (pg, down) => Object.fromEntries(pg.nodes.map((n) => [n.id, down.includes(n.id) ? "DOWN" : "UP"]));
const EDGE_STATES = (pg, from, to, down) => run(`FluyoFlow.routeEdgeStates(FluyoFlow.flowRoute(${loadPage(pg)}, ${from}, ${to}), __a)`, statesOf(pg, down));
let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
function randomPage(n, p) {
  const nodes = [], edges = []; let eid = 100;
  for (let i = 1; i <= n; i++) nodes.push(rect(i));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) if (i !== j && rnd() < p) edges.push(edge(eid++, i, j, rnd() < 0.75 ? "FLOWS_TO" : rnd() < 0.5 ? "REQUIRES" : undefined));
  return { name: "R", nextId: 999, behaviors: [], nextScenarioId: 1, nodes, edges, scenarios: [] };
}
/* Oráculo de fuerza bruta (solo en el test): caminos simples de nodos por Flujo, de s a t. */
function simplePaths(pg, s, t) {
  const adj = new Map();
  for (const e of pg.edges) if (e.kind === "FLOWS_TO") { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push({ to: e.to, id: e.id }); }
  const out = [];
  (function walk(at, nodes, eds) {
    if (at === t) { out.push({ nodes: nodes.slice(), edges: eds.slice() }); return; }
    for (const x of adj.get(at) || []) if (!nodes.includes(x.to)) { nodes.push(x.to); eds.push(x.id); walk(x.to, nodes, eds); nodes.pop(); eds.pop(); }
  })(s, [s], []);
  return out;
}

/* ═══════════════ A. Derivación (flow-semantics.js) ═══════════════ */
test("A1 · flowRoute: nodos y conexiones de la ruta en orden del documento, con su capa; Conexión y Requisito fuera", () => {
  const r = ROUTE(workersPage(), CLI, BD);
  assert.equal(r.status, "ROUTE");
  assert.deepEqual(r.nodes, [CLI, API, COLA, WA, WB, BD], "ni Auth (Requisito) ni Métricas (Conexión)");
  assert.deepEqual(r.edges.map((e) => [e.id, e.depth]), [[11, 0], [12, 1], [13, 2], [14, 2], [15, 3], [16, 3]]);
  assert.equal(r.maxDepth, 4);
  const sub = ROUTE(workersPage(), API, WB);
  assert.deepEqual([sub.nodes, sub.edges.map((e) => e.id)], [[API, COLA, WB], [12, 14]], "solo lo que está entre el origen y el destino");
  const cut = workersPage(); cut.edges = cut.edges.filter((e) => e.id !== 12);
  assert.deepEqual(ROUTE(cut, CLI, BD), { status: "NO_PATH", source: CLI, target: BD, nodes: [], edges: [], maxDepth: 0 });
});

test("A2 · flowRoute: NO_PATH exactamente cuando flowStatus lo da; las conexiones que entran al origen o salen del destino no son de la ruta (600 grafos)", () => {
  seed = 11;
  for (let k = 0; k < 600; k++) {
    const n = 3 + Math.floor(rnd() * 5), pg = randomPage(n, 0.35);
    const out = run(`(()=>{ const p = ${loadPage(pg)}; const st = {}; for(const n of p.nodes) st[n.id] = "UP";
      return {route: FluyoFlow.flowRoute(p, 1, ${n}), status: FluyoFlow.flowStatus(p, 1, ${n}, st)}; })()`);
    assert.equal(out.route.status === "NO_PATH", out.status === "NO_PATH", "grafo " + k);
    for (const e of out.route.edges) assert.ok(e.to !== 1 && e.from !== n, "grafo " + k + ": " + e.id);
    /* toda conexión de algún camino simple está en la ruta (la ruta puede añadir un ciclo interior, nunca quitar) */
    const ids = new Set(out.route.edges.map((e) => e.id));
    for (const p of simplePaths(pg, 1, n)) for (const id of p.edges) assert.ok(ids.has(id), "grafo " + k + ": " + id + " está en un camino simple");
  }
});

test("A3 · routeEdgeStates: rama caída no disponible y la otra disponible; todo caído: ninguna disponible; con ciclos y sin ellos frente al oráculo", () => {
  const pg = workersPage();
  assert.deepEqual(EDGE_STATES(pg, CLI, BD, []), { 11: "AVAILABLE", 12: "AVAILABLE", 13: "AVAILABLE", 14: "AVAILABLE", 15: "AVAILABLE", 16: "AVAILABLE" });
  assert.deepEqual(EDGE_STATES(pg, CLI, BD, [WA]), { 11: "AVAILABLE", 12: "AVAILABLE", 13: "UNAVAILABLE", 14: "AVAILABLE", 15: "UNAVAILABLE", 16: "AVAILABLE" });
  assert.deepEqual(EDGE_STATES(pg, CLI, BD, [WA, WB]), { 11: "UNAVAILABLE", 12: "UNAVAILABLE", 13: "UNAVAILABLE", 14: "UNAVAILABLE", 15: "UNAVAILABLE", 16: "UNAVAILABLE" });
  assert.deepEqual(EDGE_STATES(pg, CLI, BD, [CLI]), { 11: "UNAVAILABLE", 12: "UNAVAILABLE", 13: "UNAVAILABLE", 14: "UNAVAILABLE", 15: "UNAVAILABLE", 16: "UNAVAILABLE" }, "el origen caído");
  seed = 23;
  for (let k = 0; k < 400; k++) {
    const n = 3 + Math.floor(rnd() * 5), pg2 = randomPage(n, 0.35), down = pg2.nodes.filter(() => rnd() < 0.25).map((x) => x.id);
    const st = statesOf(pg2, down);
    const out = run(`(()=>{ const p = ${loadPage(pg2)}; const r = FluyoFlow.flowRoute(p, 1, ${n}); return {es: FluyoFlow.routeEdgeStates(r, __a), status: FluyoFlow.flowStatus(p, 1, ${n}, __a)}; })()`, st);
    const avail = Object.keys(out.es).filter((id) => out.es[id] === "AVAILABLE");
    assert.equal(avail.length > 0, out.status === "AVAILABLE", "grafo " + k + ": alguna conexión disponible ⇔ ruta disponible");
    const upPaths = simplePaths(pg2, 1, n).filter((p) => p.nodes.every((id) => st[id] === "UP"));
    for (const p of upPaths) for (const id of p.edges) assert.equal(out.es[id], "AVAILABLE", "grafo " + k + ": " + id + " en un camino disponible");
  }
});

test("A4 · routeTimeline (aceptación): disponible → cae A (punto, sin frontera) → cae B (barra); tramos, extremos y fin", () => {
  const tl = TL(workersPage(), CLI, BD, 4500);
  assert.equal(tl.start, "AVAILABLE"); assert.equal(tl.final, "UNAVAILABLE"); assert.equal(tl.frontiers, 1); assert.equal(tl.end, 4500);
  assert.deepEqual(tl.segments, [{ from: 0, to: 3000, status: "AVAILABLE" }, { from: 3000, to: 4500, status: "UNAVAILABLE" }]);
  assert.deepEqual(tl.marks, [{ at: 1500, frontier: false }, { at: 3000, frontier: true }]);
  assert.deepEqual(tl.instants.map((i) => [i.at, i.status, i.frontier, i.onRoute, i.changes]),
    [[0, "AVAILABLE", false, false, []], [1500, "AVAILABLE", false, true, [{ nodeId: WA, to: "DOWN" }]], [3000, "UNAVAILABLE", true, true, [{ nodeId: WB, to: "DOWN" }]]]);
  assert.equal(TL(workersPage(), CLI, BD, 100).end, 3000, "el fin nunca queda antes del último cambio");
});

test("A5 · routeTimeline: ruido fuera de la ruta no marca; el mismo instante se aplica junto (una marca); en 0 nunca hay frontera; vuelta del extremo; NO_PATH sin timeline", () => {
  const noise = TL(workersPage({}, [setS(1, 500, MET), setS(2, 800, AUTH), setS(3, 1000, WA)]), CLI, BD, 2000);
  assert.deepEqual(noise.marks, [{ at: 1000, frontier: false }], "Métricas (Conexión) y Auth (Requisito) cambian: nada");
  assert.equal(noise.instants.length, 4, "pero sí son instantes (el estado de los nodos cambia)");
  const same = TL(workersPage({}, [setS(1, 1000, WA), setS(2, 1000, WB)]), CLI, BD, 2000);
  assert.deepEqual(same.marks, [{ at: 1000, frontier: true }]); assert.equal(same.instants.length, 2, "un solo instante para los dos");
  const zero = TL(workersPage({}, [setS(1, 0, WA), setS(2, 0, WB), setS(3, 900, WB, "UP")]), CLI, BD, 2000);
  assert.equal(zero.start, "UNAVAILABLE", "lo de 0 ya rige al inicio (como «Al inicio»)");
  assert.deepEqual(zero.marks, [{ at: 0, frontier: false }, { at: 900, frontier: true }], "en 0, punto; nunca barra");
  const back = TL(workersPage({}, [setS(1, 500, BD), setS(2, 1500, BD, "UP")]), CLI, BD, 2000);
  assert.deepEqual(back.segments.map((s) => s.status), ["AVAILABLE", "UNAVAILABLE", "AVAILABLE"]); assert.equal(back.frontiers, 2);
  const one = TL(workersPage({}, [setS(1, 500, MET)]), CLI, BD, 2000);
  assert.deepEqual([one.segments.length, one.frontiers, one.marks.length], [1, 0, 0], "un solo estado: un tramo, ninguna marca");
  const cut = workersPage(); cut.edges = cut.edges.filter((e) => e.id !== 12);
  assert.equal(TL(cut, CLI, BD, 4500), null, "NO_PATH: sin línea de tiempo (D6)");
});

test("A6 · routeTimeline con el horario VISIBLE: con una dependencia de llegada la frontera cae cuando se VE, no en el `at` narrativo", () => {
  const pg = workersPage({ arrivalDependencies: [{ stepId: 3, waitsForArrivalOf: [1] }] }, [send(1, 0, 11), setS(2, 200, WA), setS(3, 300, WB)]);
  pg.scenarios[0].steps[0].eventTypeId = undefined;
  const tl = TL(pg, CLI, BD, 3000);
  assert.deepEqual(tl.marks, [{ at: 200, frontier: false }, { at: 1100, frontier: true }], "cae B espera a que llegue el pedido (1100 ms)");
});

test("A7 · routePaths: caminos simples en orden del documento; nodos por los que pasa todo camino; recuento exacto sin enumerar (128 caminos)", () => {
  assert.deepEqual(PATHS(workersPage(), CLI, BD, 3), { paths: [[CLI, API, COLA, WA, BD], [CLI, API, COLA, WB, BD]], total: 2, exact: true, mustPass: [CLI, API, COLA, BD] });
  /* paralelas: dos conexiones Cola → Worker A no son dos filas */
  const par = workersPage(); par.edges.push(edge(19, COLA, WA, "FLOWS_TO"));
  assert.equal(PATHS(par, CLI, BD, 3).total, 2);
  /* 7 rombos en cadena: 128 caminos; el recuento es exacto y solo se enumeran los 3 primeros */
  const nodes = [rect(1)], edges = []; let id = 1, eid = 500;
  for (let k = 0; k < 7; k++) { const a = ++id, b = ++id, c = ++id; nodes.push(rect(a), rect(b), rect(c)); const from = k === 0 ? 1 : id - 3;
    edges.push(edge(eid++, from, a, "FLOWS_TO"), edge(eid++, from, b, "FLOWS_TO"), edge(eid++, a, c, "FLOWS_TO"), edge(eid++, b, c, "FLOWS_TO")); }
  const chain = { name: "C", nextId: 9999, behaviors: [], nextScenarioId: 1, nodes, edges, scenarios: [] };
  const r = PATHS(chain, 1, id, 3);
  assert.equal(r.total, 128); assert.equal(r.exact, true); assert.equal(r.paths.length, 3);
  assert.deepEqual(r.paths[0], simplePaths(chain, 1, id)[0].nodes, "el primero en orden del documento");
  /* con un ciclo interior: recuento por enumeración, igual al oráculo */
  const cyc = workersPage(); cyc.edges.push(edge(19, WA, WB, "FLOWS_TO"), edge(20, WB, WA, "FLOWS_TO"));
  const c = PATHS(cyc, CLI, BD, 3);
  assert.equal(c.total, simplePaths(cyc, CLI, BD).length); assert.equal(c.exact, true);
  /* sin ruta / camino trivial */
  const cut = workersPage(); cut.edges = cut.edges.filter((e) => e.id !== 12);
  assert.deepEqual(PATHS(cut, CLI, BD, 3), { paths: [], total: 0, exact: true, mustPass: [] });
});

test("A8 · routePaths: el recuento coincide con el oráculo en 300 grafos con ciclos; mustPass = nodos de TODOS los caminos", () => {
  seed = 37;
  for (let k = 0; k < 300; k++) {
    const n = 3 + Math.floor(rnd() * 5), pg = randomPage(n, 0.4), r = PATHS(pg, 1, n, 3);
    const all = simplePaths(pg, 1, n);
    if (!all.length) { assert.equal(r.total, 0); continue; }
    const uniq = []; for (const p of all) if (!uniq.some((u) => u.join() === p.nodes.join())) uniq.push(p.nodes);
    assert.equal(r.total, uniq.length, "grafo " + k + ": recuento");
    assert.deepEqual(r.paths, uniq.slice(0, 3), "grafo " + k + ": las 3 primeras, en orden del documento");
    const common = pg.nodes.map((x) => x.id).filter((id) => all.every((p) => p.nodes.includes(id)));
    assert.deepEqual(r.mustPass, common, "grafo " + k + ": mustPass");
  }
});

test("A9 · determinismo y B6: repetir da lo mismo; reordenar Behaviors no cambia nada; el documento no gana claves derivadas", () => {
  const pg = workersPage({ observedFlow: { from: CLI, to: BD } });
  pg.behaviors = [{ nodeId: WB, initialState: "UP" }, { nodeId: API, initialState: "UP" }];
  const a = TL(pg, CLI, BD, 4500);
  assert.deepEqual(TL(pg, CLI, BD, 4500), a);
  const r = J(pg); r.behaviors.reverse();
  assert.deepEqual(TL(r, CLI, BD, 4500), a);
  const out = run(`(()=>{ const d = projectFromProjectData(__a).doc, p = d.pages[0], sc = p.scenarios[0]; const before = JSON.stringify(projectToSerializable(d, {}));
    const ev = FluyoStory.run(p, sc).trace.events, route = FluyoFlow.flowRoute(p, ${CLI}, ${BD});
    FluyoFlow.routeTimeline(p, route, ev, 4500); FluyoFlow.routePaths(route, 3); FluyoFlow.routeEdgeStates(route, FluyoFlow.availabilityAt(p, ev, 3000));
    return before === JSON.stringify(projectToSerializable(d, {})); })()`, project([pg]));
  assert.equal(out, true, "nada se escribe en el documento");
});

/* ═══════════════ B y C. Editor: el bloque «Ruta observada» de editor-scenarios.js con el editor real ═══════════════ */
function flowBlock() {
  const src = read("js/editor-scenarios.js");
  const a = src.indexOf("/* ===================== Ruta observada (SCENARIOS-SEMANTICS-001 FASE 3"), b = src.indexOf("/* ===================== fin de la ruta observada");
  assert.ok(a > 0 && b > a, "bloque de la ruta observada en editor-scenarios.js");
  return src.slice(a, b);
}
function extract(src, name) {
  const i = src.indexOf("function " + name + "(");
  assert.ok(i >= 0, name);
  let depth = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") depth++; else if (src[k] === "}" && --depth === 0) return src.slice(i, k + 1); }
  throw new Error(name);
}
function fakeEl(id) {
  return { id, hidden: false, value: "", disabled: false, textContent: "", title: "", dataset: {}, style: {}, children: [], writes: 0,
    replaceChildren(...c) { this.children = c; this.writes++; if (!c.some((o) => o.value === this.value)) this.value = c.length ? c[0].value : ""; } };
}
function editor({ labs = true } = {}) {
  const els = {};
  const $ = (id) => (els[id] = els[id] || fakeEl(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, $, GRID: 20, innerWidth: 1280, innerHeight: 800, LABS_SEMANTICS: labs,
    document: { createElement: (tag) => ({ tag, value: "", textContent: "", title: "", disabled: false, dataset: {}, style: {}, className: "" }) } });
  const R = (code) => vm.runInContext(code, ctx);
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  R(`var selN=new Set(), selE=new Set(), clip=null, __autosaves=0, __routes=0, scPlayback=null, scStatus="idle", scActive=1, presenting=false, __now=0;
     function confirm(){ return true; } function alert(){} function prompt(){ return null; }
     function refreshPanel(){} function renderTabs(){} function scheduleAutosave(){ __autosaves++; }
     function isScenarioPlaybackActive(){ return scStatus==="running" || scStatus==="completed"; } function scReset(){ scStatus="idle"; scPlayback=null; }
     function scActiveScenario(){ return P().scenarios.find(s=>s.id===scActive) || null; }
     function scNodeFallback(id){ const n=P().nodes.find(x=>x.id===id); return n ? n.label : "Elemento"; }
     function scEl(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!==undefined) el.textContent=text; return el; }
     function scNow(){ return __now; }
     const __route = FluyoFlow.flowRoute; FluyoFlow.flowRoute = function(){ __routes++; return __route.apply(this, arguments); };`);
  R(read("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  vm.runInContext(flowBlock(), ctx, { filename: "js/editor-scenarios.js#ruta-observada" });
  vm.runInContext(extract(read("js/editor-scenarios.js"), "buildScenarioRenderState"), ctx, { filename: "js/editor-scenarios.js#buildScenarioRenderState" });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0; scStatus='idle'; scPlayback=null; scFlowLast=null; scFlowPending=null; scFlowCursorLast=undefined;");
  const view = () => { R("scRenderFlow()");
    const kids = (id) => $(id).children;
    return { hidden: $("scFlow").hidden, word: $("scFlowWord").textContent, track: !$("scFlowTrack").hidden, ends: !$("scFlowEnds").hidden,
      segs: kids("scFlowSegs").map((s) => [s.dataset.state, s.style.left, s.style.width]), marks: kids("scFlowMarks").map((m) => [m.className, m.style.left]),
      start: $("scFlowStart").textContent, count: $("scFlowCount").textContent, final: $("scFlowFinal").textContent,
      cursor: $("scFlowCursor").hidden ? null : $("scFlowCursor").style.left,
      rows: $("scFlowRows").hidden ? [] : kids("scFlowRows").map((r) => [r.dataset.state || "", r.textContent, r.title || ""]) }; };
  const pick = (end, value) => { $(end === "from" ? "scFlowFrom" : "scFlowTo").value = String(value); R(`scFlowPick("${end}")`); };
  /* reproducción real: la receta del editor (FluyoStoryClock.start + tick) con un reloj controlado */
  const play = (t) => R(`(()=>{ const s = FluyoStoryClock.start(P(), scActiveScenario(), 0); scPlayback = s.playback; scStatus = "running"; __now = ${t}; FluyoScenarioPlayback.tick(scPlayback, ${t}); })()`);
  const tick = (t) => R(`(()=>{ __now = ${t}; FluyoScenarioPlayback.tick(scPlayback, ${t}); })()`);
  const seek = (i, t) => R(`(()=>{ const c = {base:0, pausedAt:${t}}; const r = FluyoStoryClock.seek(c, ${t}, P(), scActiveScenario(), ${i}); scPlayback = r.playback; __now = ${t}; })()`);
  const overlay = () => J(R("scFlowOverlay()"));
  const frame = () => J(R("(()=>{ const r = buildScenarioRenderState(); return r ? (r.flow || null) : 'none'; })()"));
  return { ctx, R, $, load, view, pick, play, tick, seek, overlay, frame, undo: () => R("undo()"), undos: () => R("undoStack.length"), doc: () => J(R("P()")) };
}

test("B1 · el lienzo solo recibe la ruta reproduciendo, con labs, con par y con ruta; nunca en Present; sin reproducir, nada", () => {
  const off = editor({ labs: false }); off.load(project([workersPage()])); off.play(100);
  assert.equal(off.overlay(), null, "labs apagado"); assert.equal(off.frame(), null, "labs apagado: el renderState no lleva `flow`");
  const e = editor(); e.load(project([workersPage()]));
  assert.equal(e.overlay(), null, "sin reproducir (edición): el lienzo es el de siempre");
  e.play(100); assert.ok(e.overlay(), "reproduciendo"); assert.ok(e.frame() && e.frame().edges, "buildScenarioRenderState lo entrega en scenarioRuntime.flow");
  e.R("presenting = true"); assert.equal(e.overlay(), null, "Present: FASE 5 (D8)"); assert.equal(e.frame(), null);
  e.R("presenting = false"); e.R('scStatus = "completed"'); assert.ok(e.overlay(), "terminada: el último fotograma sigue");
  const cut = workersPage({ observedFlow: { from: CLI, to: BD } }); cut.edges = cut.edges.filter((x) => x.id !== 12);
  e.load(project([cut])); e.play(100); assert.equal(e.overlay(), null, "NO_PATH: el lienzo no pinta fundas (D-Ruta)");
  const amb = workersPage(); amb.nodes.push(rect(9, "Otro")); amb.edges.push(edge(19, 9, API, "FLOWS_TO"));
  e.load(project([amb])); e.play(100); assert.equal(e.overlay(), null, "sin par");
  e.load(project([workersPage({ observedFlow: { from: 77, to: BD } })])); e.play(100); assert.equal(e.overlay(), null, "ENDPOINT_MISSING");
});

test("B2 · ACEPTACIÓN en el lienzo: disponible → cae A (rama A terracota, B oliva, sin barrido) → cae B (todo terracota y barrido)", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.play(100);
  let o = e.overlay();
  assert.deepEqual(Object.keys(o.edges).map(Number).sort((a, b) => a - b), [11, 12, 13, 14, 15, 16], "solo conexiones Flujo de la ruta: ni Requisito (17) ni Conexión (18)");
  assert.ok(Object.values(o.edges).every((x) => x.cls === "AVAILABLE" && x.prev === "AVAILABLE" && x.k === 1));
  assert.deepEqual([o.sweep, o.pips], [null, []]);
  e.tick(1500); o = e.overlay();
  assert.deepEqual([o.edges[13], o.edges[15]], [{ cls: "UNAVAILABLE", prev: "AVAILABLE", k: 0 }, { cls: "UNAVAILABLE", prev: "AVAILABLE", k: 0 }], "en el instante del cambio (T1)");
  assert.deepEqual(o.edges[14], { cls: "AVAILABLE", prev: "AVAILABLE", k: 0 });
  assert.equal(o.sweep, null, "cambió un nodo, no la ruta: sin barrido"); assert.deepEqual(o.pips, [WA]); assert.deepEqual(o.pulses, { [WA]: { to: "DOWN", k: 0 } });
  e.tick(1725); o = e.overlay(); assert.equal(o.edges[13].k, 0.5, "fundido a mitad (450 ms)");
  e.tick(2700); o = e.overlay(); assert.equal(o.edges[13].k, 1); assert.deepEqual(o.pulses, {}, "la transición local acaba (1100 ms)");
  e.tick(3000); o = e.overlay();
  assert.ok(Object.values(o.edges).every((x) => x.cls === "UNAVAILABLE"));
  assert.deepEqual(o.sweep && [o.sweep.status, o.sweep.p, o.sweep.layers], ["UNAVAILABLE", 0, 4], "barrido desde el instante de la frontera");
  assert.deepEqual(o.sweep.depth, { 11: 0, 12: 1, 13: 2, 14: 2, 15: 3, 16: 3 });
  assert.deepEqual(o.pips, [WA, WB]);
  e.tick(3450); assert.equal(e.overlay().sweep.p, 0.5);
  e.tick(3900); assert.equal(e.overlay().sweep, null, "un solo barrido (900 ms)");
});

test("B3 · pausa y saltos: el dibujo es función del cursor; un salto da lo mismo que la reproducción continua en ese instante", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.play(0); e.tick(1600); const cont = e.overlay();
  e.tick(1600); assert.deepEqual(e.overlay(), cont, "en pausa (el mismo cursor) no cambia nada");
  e.seek(1, 1600); const at = e.overlay();
  e.play(0); e.tick(1500); assert.deepEqual(at, e.overlay(), "⏭ al momento 2 = la reproducción continua en 1500");
  e.seek(2, 9000); const b = e.overlay(); assert.equal(b.sweep.p, 0); e.seek(0, 9000); const z = e.overlay();
  assert.ok(Object.values(z.edges).every((x) => x.cls === "AVAILABLE") && z.sweep === null && !z.pips.length, "⏮ al primero: todo disponible");
});

test("B4 · Requisito y Conexión estables: ninguna funda, en ningún instante, ni siquiera cuando cae lo requerido", () => {
  const e = editor(); e.load(project([workersPage({}, [send(1, 0, 11), setS(2, 500, AUTH), setS(3, 1000, API), setS(4, 1500, AUTH, "UP")])]));
  e.play(0);
  for (const t of [0, 500, 700, 1000, 1200, 1500, 2600]) { e.tick(t); const o = e.overlay(); assert.ok(!("17" in o.edges) && !("18" in o.edges), "t=" + t); }
  e.tick(700); assert.ok(e.overlay().pips.includes(AUTH), "el estado del nodo requerido se ve en ESE nodo");
});

test("B5 · Undo solo en lo persistido: reproducir, pausar, saltar y pintar no escriben el documento ni apilan Undo", () => {
  const e = editor(); e.load(project([workersPage()]));
  const before = JSON.stringify(e.doc()), saves = e.R("__autosaves");
  e.view(); e.play(0);
  for (const t of [100, 1500, 3000, 4000]) { e.tick(t); e.overlay(); e.frame(); e.view(); }
  e.seek(1, 5000); e.overlay(); e.view();
  assert.equal(JSON.stringify(e.doc()), before); assert.equal(e.undos(), 0); assert.equal(e.R("__autosaves"), saves);
});

test("C1 · edición: línea de tiempo completa, sin cursor; extremos y filas «vía …» al inicio", () => {
  const e = editor(); e.load(project([workersPage()]));
  const v = e.view();
  assert.equal(v.word, "Al inicio · Ruta disponible");
  assert.equal(v.track, true); assert.equal(v.ends, true); assert.equal(v.cursor, null, "sin cursor en edición (D6)");
  /* fin visible = cae B (3000) + efecto de elemento (1500): 4500 */
  assert.deepEqual(v.segs, [["AVAILABLE", "0.000%", "66.667%"], ["UNAVAILABLE", "66.667%", "33.333%"]]);
  assert.deepEqual(v.marks, [["scFlowMark", "33.333%"], ["scFlowMark scFlowFrontier", "66.667%"]], "cae A = punto; cae B = barra");
  assert.deepEqual([v.start, v.count, v.final], ["disponible", "1", "no disponible"]);
  assert.deepEqual(v.rows, [["AVAILABLE", "vía Worker A · disponible", "Cliente → API → Cola → Worker A → BD"], ["AVAILABLE", "vía Worker B · disponible", "Cliente → API → Cola → Worker B → BD"]]);
});

test("C2 · reproduciendo: el cursor sigue al instante visible; las filas cambian con los nodos; Detener vuelve a edición", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.play(0); assert.equal(e.view().cursor, "0.000%");
  e.tick(1600); let v = e.view();
  assert.equal(v.cursor, "35.556%");
  assert.deepEqual(v.rows.map((r) => r[1]), ["vía Worker A · no disponible", "vía Worker B · disponible"]);
  e.tick(3100); v = e.view();
  assert.deepEqual(v.rows.map((r) => [r[0], r[1]]), [["UNAVAILABLE", "vía Worker A · no disponible"], ["UNAVAILABLE", "vía Worker B · no disponible"]]);
  e.tick(9000); assert.equal(e.view().cursor, "100.000%", "terminada: al final, nunca fuera");
  e.seek(0, 9000); assert.equal(e.view().cursor, "0.000%", "un salto mueve el cursor");
  e.R("scReset()"); v = e.view(); assert.equal(v.cursor, null); assert.equal(v.word, "Al inicio · Ruta disponible");
});

test("C3 · NO_PATH, sin par y ENDPOINT_MISSING: sin línea de tiempo ni filas; una ruta lineal: línea de tiempo sin filas; un solo estado: «ninguno»", () => {
  const e = editor();
  const cut = workersPage({ observedFlow: { from: CLI, to: BD } }); cut.edges = cut.edges.filter((x) => x.id !== 12);
  e.load(project([cut])); let v = e.view(); assert.deepEqual([v.word, v.track, v.ends, v.rows.length], ["Al inicio · Sin ruta de flujo", false, false, 0]);
  const amb = workersPage(); amb.nodes.push(rect(9, "Otro")); amb.edges.push(edge(19, 9, API, "FLOWS_TO"));
  e.load(project([amb])); v = e.view(); assert.deepEqual([v.track, v.rows.length], [false, 0]);
  e.load(project([workersPage({ observedFlow: { from: 77, to: BD } })])); v = e.view(); assert.deepEqual([v.track, v.rows.length], [false, 0]);
  e.load(project([workersPage({ observedFlow: { from: CLI, to: COLA } })])); v = e.view();
  assert.deepEqual([v.track, v.rows.length, v.count, v.segs.length], [true, 0, "ninguno", 1], "un solo camino: sin filas; los workers no son de esta ruta");
});

test("C4 · filas: como mucho 3 y «+N rutas» (exacto; «+1 ruta» en singular); nombradas por sus nodos distintivos", () => {
  const pg = workersPage(); pg.nodes.push(rect(9, "Worker C"), rect(10, "Worker D"));
  pg.edges.push(edge(19, COLA, 9, "FLOWS_TO"), edge(20, 9, BD, "FLOWS_TO"));
  const e = editor(); e.load(project([pg]));
  assert.deepEqual(e.view().rows.map((r) => r[1]), ["vía Worker A · disponible", "vía Worker B · disponible", "vía Worker C · disponible"], "3 caminos: sin «+N»");
  pg.edges.push(edge(21, COLA, 10, "FLOWS_TO"), edge(22, 10, BD, "FLOWS_TO")); e.load(project([pg]));
  assert.deepEqual(e.view().rows.map((r) => r[1]).slice(3), ["+1 ruta"]);
  pg.edges.push(edge(23, API, BD, "FLOWS_TO")); e.load(project([pg]));
  const rows = e.view().rows;
  assert.equal(rows[3][1], "+2 rutas"); assert.equal(rows[3][0], "", "la fila «+N» no tiene estado");
  assert.ok(rows.every((r) => !/por defecto/.test(r[1])), "sin contador «por defecto» por fila (§ 3.1)");
});

test("C4b · recuento NO exacto (ciclos y más de 10 000 caminos): «Más de 10 000 rutas», nunca un número derivado del tope", () => {
  /* malla: 8 intermedios todos con todos (109 601 caminos simples reales) */
  const nodes = [rect(1, "Origen"), rect(2, "Destino")], edges = []; let id = 100;
  for (let i = 0; i < 8; i++) nodes.push(rect(10 + i, "M" + (i + 1)));
  for (let i = 0; i < 8; i++) { edges.push(edge(id++, 1, 10 + i, "FLOWS_TO"), edge(id++, 10 + i, 2, "FLOWS_TO")); for (let j = 0; j < 8; j++) if (i !== j) edges.push(edge(id++, 10 + i, 10 + j, "FLOWS_TO")); }
  const pg = { name: "Malla", nextId: 999, behaviors: [], nextScenarioId: 2, nodes, edges, scenarios: [story(1, [setS(1, 500, 10)])] };
  assert.equal(PATHS(pg, 1, 2, 3).exact, false, "premisa: por encima del tope el recuento no es exacto");
  const e = editor(); e.load(project([pg]));
  const rows = e.view().rows;
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[3], ["", "Más de 10 000 rutas", ""]);
  assert.ok(rows.every((r) => !/\+\d|o más|9\s?99[0-9]/.test(r[1])), "ni «+N» ni «o más» ni el tope menos las filas: " + rows.map((r) => r[1]).join(" | "));
});

test("C5 · el cursor se escribe en cada fotograma solo si se mueve; tramos, marcas y filas solo cuando cambian", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.play(0); e.view();
  const segW = e.$("scFlowSegs").writes, rowW = e.$("scFlowRows").writes;
  e.tick(200); e.view(); e.tick(400); e.view();
  assert.equal(e.$("scFlowSegs").writes, segW, "los tramos no se reescriben al avanzar");
  assert.equal(e.$("scFlowRows").writes, rowW, "las filas tampoco si no cambia ningún nodo");
  assert.equal(e.$("scFlowCursor").style.left, "8.889%");
  e.tick(1600); e.view(); assert.equal(e.$("scFlowRows").writes, rowW + 1, "cae A: las filas se reescriben una vez");
});

test("C6 · Undo de lo persistido: elegir la ruta (UNA entrada) cambia la línea de tiempo; Ctrl+Z la devuelve (es derivada)", () => {
  const e = editor(); e.load(project([workersPage()]));
  const before = e.view();
  e.pick("to", WB);
  assert.equal(e.undos(), 1);
  const after = e.view();
  assert.deepEqual([after.rows.length, after.count], [0, "1"], "Cliente → Worker B: un camino, frontera al caer B");
  e.undo(); assert.deepEqual(e.view(), before);
});

test("C7 · memoización: la ruta se deriva una vez por base y par, no en cada fotograma", () => {
  const e = editor(); e.load(project([workersPage()]));
  e.R("__routes = 0"); for (let i = 0; i < 4; i++) { e.R("scFlowLast = null"); e.view(); }
  assert.equal(e.R("__routes"), 1);
  e.play(0); e.R("__routes = 0");
  for (const t of [100, 900, 1600, 3100, 4000]) { e.tick(t); e.view(); e.overlay(); e.frame(); }
  assert.equal(e.R("__routes"), 1, "una vez por reproducción");
});

test("C8 · fin visible = el instante en que la reproducción queda «terminada» (FluyoStory.isFinished), en 200 Historias aleatorias", () => {
  const e = editor();
  const ets = [
    { id: 1, name: "Rápido", primitive: "FLOW", sentenceTemplate: "{source} → {target}", visual: { kind: "token", value: "●" }, motion: "fast" },
    { id: 2, name: "Lento", primitive: "FLOW", sentenceTemplate: "{source} → {target}", visual: { kind: "token", value: "●" }, motion: "slow" },
    { id: 3, name: "Cae largo", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN", presentation: { nodeEffects: { visualDuration: "long" } } },
    { id: 4, name: "Vuelve breve", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} vuelve", visual: { kind: "token", value: "✓" }, availability: "UP", presentation: { nodeEffects: { visualDuration: "brief" } } },
    { id: 5, name: "Pasa", primitive: "OCCURRENCE", sentenceTemplate: "{target}", visual: { kind: "token", value: "★" } }];
  seed = 51;
  for (let k = 0; k < 200; k++) {
    const steps = []; let at = 0;
    for (let s = 1; s <= 1 + Math.floor(rnd() * 5); s++) {
      at += Math.floor(rnd() * 3) * 500;
      const r = rnd();
      if (r < 0.4) steps.push(send(s, at, 11 + Math.floor(rnd() * 6), rnd() < 0.5 ? { eventTypeId: 1 + Math.floor(rnd() * 2) } : {}));
      else if (r < 0.8) { const down = rnd() < 0.6; steps.push(Object.assign(setS(s, at, 1 + Math.floor(rnd() * 8), down ? "DOWN" : "UP"), rnd() < 0.6 ? { eventTypeId: down ? 3 : 4 } : {})); }
      else steps.push({ id: s, at, action: "OCCURRENCE", nodeId: 1 + Math.floor(rnd() * 8), eventTypeId: 5 });
    }
    const p = project([workersPage({}, steps)], { eventTypes: ets, nextEventTypeId: 6 });
    e.load(p);
    const r = J(e.R(`(()=>{ const sc = scActiveScenario(), base = scFlowTimeline(P(), sc); if(!base.ok) return null;
      const s = FluyoStoryClock.start(P(), sc, 0), pb = s.playback, end = base.end;
      if(end === 0) return {end, ok: (FluyoScenarioPlayback.tick(pb, 0), FluyoStory.isFinished(pb))};
      FluyoScenarioPlayback.tick(pb, end - 1); const before = FluyoStory.isFinished(pb);
      FluyoScenarioPlayback.tick(pb, end); return {end, before, after: FluyoStory.isFinished(pb)}; })()`));
    if (!r) continue;
    if (r.end === 0) assert.ok(r.ok, "Historia " + k);
    else assert.deepEqual([r.before, r.after], [false, true], "Historia " + k + " (fin " + r.end + ")");
  }
});

/* ═══════════════ D. Render (render.js) ═══════════════ */
function recCanvas() {
  const log = [], st = { globalAlpha: 1 }, stack = [];
  const num = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.slice() : v);
  const c = new Proxy({}, {
    get(t, k) {
      if (k in st) return st[k];
      if (k === "canvas") return { width: 2000, height: 2000 };
      if (k === "measureText") return (s) => ({ width: String(s).length * 7 });
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (k === "save") return () => { stack.push(Object.assign({}, st)); log.push(["save"]); };
      if (k === "restore") return () => { const s = stack.pop() || {}; for (const key of Object.keys(st)) delete st[key]; Object.assign(st, s); log.push(["restore"]); };
      return (...a) => { log.push([k, ...a.map(num)]); if (k === "stroke" || k === "fill") log.push(["@" + k, st.strokeStyle, st.fillStyle, num(st.lineWidth), num(st.globalAlpha), st.lineDash || null]); if (k === "setLineDash") st.lineDash = a[0].slice(); };
    },
    set(t, k, v) { st[k] = v; log.push(["=", k, num(v)]); return true; },
  });
  return { c, log };
}
function renderCtx(src = read, { reduced = false } = {}) {
  const ctx = { console, performance: { now: () => 0 }, Math, JSON, Image: function () { this.complete = false; }, document: { createElement: () => ({ getContext: () => null }) } };
  ctx.window = ctx; ctx.matchMedia = () => ({ matches: reduced });
  vm.createContext(ctx);
  for (const f of ["config", "safe-svg", "model", "geometry", "skin", "scenario-engine", "scenario-playback", "story-playback", "render"]) vm.runInContext(src("js/" + f + ".js"), ctx, { filename: f });
  vm.runInContext(`settings = {speed:.5, dots:3, build:false, stagger:.45, grid:false, snap:false, font:"Georgia, serif", single:false};`, ctx);
  return ctx;
}
/* Una página ORTOGONAL real (como la del editor) para que geometry/skin trabajen con anclas y aterrizaje de verdad */
function canvasPage() {
  const N = (id, x, y, label) => ({ id, shape: "rect", x, y, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
  const E = (id, from, to, kind) => Object.assign({ id, from, to, route: "ortho", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" }, kind ? { kind } : {});
  return { name: "W", nextId: 100, behaviors: [], nextScenarioId: 2,
    nodes: [N(CLI, 120, 300, "Cliente"), N(API, 340, 300, "API"), N(COLA, 560, 300, "Cola"), N(WA, 800, 200, "Worker A"), N(WB, 800, 400, "Worker B"), N(BD, 1040, 300, "BD"), N(AUTH, 340, 470, "Auth"), N(MET, 340, 130, "Métricas")],
    edges: [E(11, CLI, API, "FLOWS_TO"), E(12, API, COLA, "FLOWS_TO"), E(13, COLA, WA, "FLOWS_TO"), E(14, COLA, WB, "FLOWS_TO"), E(15, WA, BD, "FLOWS_TO"), E(16, WB, BD, "FLOWS_TO"), E(17, API, AUTH, "REQUIRES"), E(18, API, MET)],
    scenarios: [story(1, [send(1, 0, 11), setS(2, 1500, WA), setS(3, 3000, WB)])] };
}
function setDoc(R, pg, theme = "crema") { R.__pg = J(pg); vm.runInContext(`doc = {theme:"${theme}", customBg:"", cur:0, pages:[projectFromProjectData({version:5, app:"fluyo", doc:{theme:"${theme}", cur:0, pages:[__pg]}}).doc.pages[0]]};`, R); }
const RS = (skin, extra = "") => `(()=>{ const rs = makeReadOnlyRenderState({zoom:1, skin:${skin ? '"built"' : "undefined"}}); rs.skinOn = ${skin ? 'skinActive("built", 1)' : "false"}; rs.skinBg = "#F3EEE3"; ${extra} return rs; })()`;
function drawEdgeOps(R, edgeId, { skin = false, flow = null, isExport = false, theme = "crema" } = {}) {
  const m = recCanvas(); R.m = m; R.__flow = flow;
  vm.runInContext(`(()=>{ const rs = ${RS(skin, "if(__flow) rs.scenarioRuntime = {nodeStates:{}, activeSends:[], completedSends:[], activeOccurrences:[], completedOccurrences:[], activeNodeEffects:[], completedNodeEffects:[], scenario:null, flow:__flow};")};
    drawEdge(m.c, P().edges.find(e => e.id === ${edgeId}), 10, "${theme}", ${isExport}, rs); })()`, R);
  return m.log;
}
/* Compara dos registros de operaciones y, si difieren, dice dónde (la primera operación distinta, con contexto). */
function sameOps(a, b, msg) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  let i = 0; while (i < Math.max(a.length, b.length) && JSON.stringify(a[i]) === JSON.stringify(b[i])) i++;
  assert.fail(msg + " · primera diferencia en la operación " + i + "/" + a.length + " vs " + b.length + ": ahora " + JSON.stringify(a.slice(Math.max(0, i - 2), i + 3)) + " · base " + JSON.stringify(b.slice(Math.max(0, i - 2), i + 3)));
}
const FLOW_AT = (edges, extra = {}) => Object.assign({ edges, sweep: null, pips: [], pulses: {} }, extra);
const strokes = (log) => J(log.filter((x) => x[0] === "@stroke").map((x) => x.slice(1)));   // J: los arrays del vm son de otro reino

test("D1 · funda bajo la línea: halo oliva estático (disponible) o terracota fina discontinua (no disponible); sin `flow`, drawEdge = el de " + BASE, () => {
  const R = renderCtx(), OLD = renderCtx(atBase); setDoc(R, canvasPage()); setDoc(OLD, canvasPage());
  for (const id of [11, 13, 17, 18]) for (const skin of [false, true]) {
    if (skin && id === 17) continue;   /* N3: D7 */
    sameOps(drawEdgeOps(R, id, { skin }), drawEdgeOps(OLD, id, { skin }), "sin flow, conexión " + id + (skin ? " con piel" : ""));
  }
  const ok = strokes(drawEdgeOps(R, 13, { flow: FLOW_AT({ 13: { cls: "AVAILABLE", prev: "AVAILABLE", k: 1 } }) }));
  assert.deepEqual([ok[0][0], ok[0][2], ok[0][3], ok[0][4]], ["rgba(78,90,63,.22)", 12, 1, null], "primero el halo oliva (9/zoom + 3), sin discontinuo");
  const off = strokes(drawEdgeOps(R, 13, { flow: FLOW_AT({ 13: { cls: "UNAVAILABLE", prev: "UNAVAILABLE", k: 1 } }) }));
  assert.deepEqual([off[0][0], off[0][2], off[0][3], off[0][4]], ["rgba(181,83,47,.34)", 6.5, 1, [2, 6]], "terracota apagada, fina y discontinua");
  const plain = strokes(drawEdgeOps(R, 13));
  assert.deepEqual(ok.slice(1), plain, "después, la conexión exactamente como siempre (la funda va DEBAJO)");
  const dark = strokes(drawEdgeOps(R, 13, { theme: "dark", flow: FLOW_AT({ 13: { cls: "UNAVAILABLE", prev: "UNAVAILABLE", k: 1 } }) }));
  assert.equal(dark[0][0], "rgba(217,130,95,.42)", "en oscuro, su variante");
  /* QA del PO: en claro el halo es el oliva PÁLIDO del sistema (#C3CDA4 al 55 %); el oliva al 20 % se leía gris sobre blanco */
  const claroOk = strokes(drawEdgeOps(R, 13, { theme: "claro", flow: FLOW_AT({ 13: { cls: "AVAILABLE", prev: "AVAILABLE", k: 1 } }) }));
  const claroOff = strokes(drawEdgeOps(R, 13, { theme: "claro", flow: FLOW_AT({ 13: { cls: "UNAVAILABLE", prev: "UNAVAILABLE", k: 1 } }) }));
  assert.deepEqual([claroOk[0][0], claroOk[0][2], claroOk[0][4]], ["rgba(195,205,164,.55)", 12, null], "claro: halo oliva pálido, mismo grosor, sin discontinuo");
  assert.deepEqual([claroOff[0][0], claroOff[0][4]], ["rgba(181,83,47,.30)", [2, 6]], "claro: la terracota no cambia");
  const crema = strokes(drawEdgeOps(R, 13, { flow: FLOW_AT({ 13: { cls: "AVAILABLE", prev: "AVAILABLE", k: 1 } }) }));
  assert.equal(crema[0][0], "rgba(78,90,63,.22)", "crema no cambia");
});

test("D2 · fundido: desde el instante del cambio la clase nueva va entera y la anterior se desvanece debajo; al acabar, solo la nueva", () => {
  const R = renderCtx(); setDoc(R, canvasPage());
  const mid = strokes(drawEdgeOps(R, 13, { flow: FLOW_AT({ 13: { cls: "UNAVAILABLE", prev: "AVAILABLE", k: 0.25 } }) }));
  assert.deepEqual(mid.slice(0, 2).map((s) => [s[0], s[3]]), [["rgba(78,90,63,.22)", 0.75], ["rgba(181,83,47,.34)", 1]]);
  const done = strokes(drawEdgeOps(R, 13, { flow: FLOW_AT({ 13: { cls: "UNAVAILABLE", prev: "AVAILABLE", k: 1 } }) }));
  assert.deepEqual(done[0].slice(0, 1), ["rgba(181,83,47,.34)"]); assert.notEqual(done[1][0], "rgba(78,90,63,.22)");
});

test("D3 · barrido: solo con `sweep` (frontera), por capas del origen al destino, del color nuevo; nunca con «reducir movimiento»; nunca al exportar", () => {
  const R = renderCtx(), RED = renderCtx(read, { reduced: true }); setDoc(R, canvasPage()); setDoc(RED, canvasPage());
  const depth = { 11: 0, 12: 1, 13: 2, 14: 2, 15: 3, 16: 3 };
  const fl = (p) => FLOW_AT(Object.fromEntries(Object.keys(depth).map((k) => [k, { cls: "UNAVAILABLE", prev: "AVAILABLE", k: 1 }])), { sweep: { status: "UNAVAILABLE", p, depth, layers: 4 } });
  const sweepAlpha = (R2, id, p) => { const s = strokes(drawEdgeOps(R2, id, { flow: fl(p) })).find((x) => x[0] === "#B5532F" && x[2] === 9.5); return s ? s[3] : 0; };
  assert.ok(sweepAlpha(R, 11, 0.1) > sweepAlpha(R, 15, 0.1), "al empezar, el frente está en el origen");
  assert.ok(sweepAlpha(R, 15, 0.8) > sweepAlpha(R, 11, 0.8), "al final, en el destino");
  assert.equal(sweepAlpha(RED, 11, 0.1), 0, "«reducir movimiento»: sin barrido");
  assert.equal(strokes(drawEdgeOps(R, 11, { flow: fl(0.1), isExport: true })).some((x) => /181,83,47|#B5532F/.test(x[0])), false, "al exportar, nada");
});

test("D4 · con la piel, la funda sigue la línea PINTADA (aterrizaje de la 213), no la lógica", () => {
  const R = renderCtx(), pg = canvasPage(); pg.edges.find((e) => e.id === 13).toSide = "n";   /* llega por la tapa: ahí aterriza la piel */
  setDoc(R, pg);
  const log = drawEdgeOps(R, 13, { skin: true, flow: FLOW_AT({ 13: { cls: "AVAILABLE", prev: "AVAILABLE", k: 1 } }) });
  const firstStroke = log.findIndex((x) => x[0] === "stroke");
  const path = log.slice(0, firstStroke).filter((x) => x[0] === "moveTo" || x[0] === "lineTo" || x[0] === "arcTo").slice(-1)[0];
  const painted = J(vm.runInContext(`(()=>{ const e = P().edges.find(x => x.id === 13); return {p: edgePaintedPoints(e, true), l: edgePoints(e)}; })()`, R));
  const end = painted.p[painted.p.length - 1], logical = painted.l[painted.l.length - 1];
  assert.notDeepEqual(end, logical, "la piel aterriza (premisa)");
  const stroke = J(vm.runInContext(`edgeStroke(P().edges.find(x => x.id === 13), ${JSON.stringify(painted.p)}).line`, R));
  const last = stroke[stroke.length - 1];
  assert.deepEqual([path[1], path[2]], [Math.round(last.x * 1000) / 1000, Math.round(last.y * 1000) / 1000], "el último punto de la funda = el del trazo pintado");
});

test("D5 · nodo: pastilla de «no disponible» en la esquina (en la envolvente con la piel) y transición local del color nuevo; sin `flow`, el pintor de " + BASE, () => {
  const R = renderCtx(), OLD = renderCtx(atBase); setDoc(R, canvasPage()); setDoc(OLD, canvasPage());
  const ops = (R2, flow, { skin = false, state, reduced } = {}) => { const m = recCanvas(); R2.m = m; R2.__flow = flow; R2.__state = state || null;
    vm.runInContext(`(()=>{ const rs = ${RS(skin, "rs.scenarioRuntime = {nodeStates:{}, activeSends:[], completedSends:[], activeOccurrences:[], completedOccurrences:[], activeNodeEffects:[], completedNodeEffects:[], scenario:null}; if(__flow) rs.scenarioRuntime.flow = __flow;")};
      drawScenarioNodeOverlay(m.c, P().nodes.find(n => n.id === ${WA}), 10, __state, "crema", rs); })()`, R2); return m.log; };
  for (const state of [null, "DOWN"]) for (const skin of [false, true]) assert.deepEqual(ops(R, null, { state, skin }), ops(OLD, null, { state, skin }), "sin flow: " + state + (skin ? " piel" : ""));
  const pip = ops(R, FLOW_AT({}, { pips: [WA] }), { state: "DOWN" }).filter((x) => x[0] === "arc");
  assert.deepEqual(pip.map((a) => a.slice(1, 4)), [[875, 170, 9], [875, 170, 7]], "esquina superior derecha de la caja (800+75, 200−30)");
  const pipSkin = ops(R, FLOW_AT({}, { pips: [WA] }), { state: "DOWN", skin: true }).filter((x) => x[0] === "arc");
  const X = J(vm.runInContext(`skinExtent(P().nodes.find(n => n.id === ${WA}))`, R));
  assert.deepEqual(pipSkin[0].slice(1, 3), [X.x1, X.y0], "con la piel, la esquina de lo que se ve (tapa y lateral)");
  const pulse = strokes(ops(R, FLOW_AT({}, { pulses: { [WA]: { to: "DOWN", k: 0.5 } } })));
  assert.deepEqual(pulse.map((s) => [s[0], s[3]]), [["#B5532F", 0.45]], "anillo terracota a media vida");
  const up = strokes(ops(R, FLOW_AT({}, { pulses: { [WA]: { to: "UP", k: 0 } } })));
  assert.equal(up[0][0], "#4E5A3F", "vuelve: oliva");
});

test("D6 · Requisito estable: su trazo es idéntico con y sin ruta y en cualquier instante (fundas, barrido y pastillas no lo tocan)", () => {
  const R = renderCtx(); setDoc(R, canvasPage());
  const ref = drawEdgeOps(R, 17);
  const all = (cls) => Object.fromEntries([11, 12, 13, 14, 15, 16].map((k) => [k, { cls, prev: "AVAILABLE", k: 0.3 }]));
  for (const f of [FLOW_AT(all("AVAILABLE")), FLOW_AT(all("UNAVAILABLE"), { sweep: { status: "UNAVAILABLE", p: 0.4, depth: { 11: 0 }, layers: 4 }, pips: [API, AUTH], pulses: { [AUTH]: { to: "DOWN", k: 0.1 } } })])
    assert.deepEqual(drawEdgeOps(R, 17, { flow: f }), ref);
  assert.deepEqual(drawEdgeOps(R, 18, { flow: FLOW_AT(all("UNAVAILABLE")) }), drawEdgeOps(R, 18), "Conexión, igual");
});

test("D7 · N3: con la piel, donde se pinta el anillo de Requisito no se pinta el anillo de salida; al exportar (sin marcas) sale como en " + BASE, () => {
  const R = renderCtx(), OLD = renderCtx(atBase); setDoc(R, canvasPage()); setDoc(OLD, canvasPage());
  const rings = (log) => log.filter((x) => x[0] === "@stroke" && x[3] === 1.5 && x[2] === "#F3EEE3").length;   /* el anillo de salida: relleno del fondo, trazo 1,5 */
  assert.equal(rings(drawEdgeOps(OLD, 17, { skin: true })), 1, "premisa: en " + BASE + " el Requisito con piel lleva el anillo de salida");
  assert.equal(rings(drawEdgeOps(R, 17, { skin: true })), 0, "FASE 4: no");
  assert.equal(drawEdgeOps(R, 17, { skin: true }).filter((x) => x[0] === "arc").length, 1, "queda un solo anillo: el de Requisito");
  sameOps(drawEdgeOps(R, 17, { skin: true, isExport: true }), drawEdgeOps(OLD, 17, { skin: true, isExport: true }), "exportar: igual que antes (SVG y MCP coinciden)");
  for (const id of [11, 18]) assert.equal(rings(drawEdgeOps(R, id, { skin: true })), 1, "Flujo y Conexión conservan su anillo de salida");
  sameOps(drawEdgeOps(R, 17), drawEdgeOps(OLD, 17), "en plano nada cambia");
});

test("D8 · labs apagado = producción: un fotograma completo (render) sin `flow`, también reproduciendo, es el de " + BASE + " en los ejemplos (plano y con piel)", () => {
  const R = renderCtx(), OLD = renderCtx(atBase);
  let compared = 0;
  for (const f of fs.readdirSync(path.join(root, "ejemplos/data")).filter((x) => /\.json$/.test(x))) {
    const d = JSON.parse(read("ejemplos/data/" + f));
    if (!d || d.app !== "fluyo" || !d.doc) continue;
    for (const skin of [false, true]) {
      const frame = (R2) => { const m = recCanvas(); R2.m = m; R2.__d = J(d);
        vm.runInContext(`(()=>{ const r = projectFromProjectData(__d); doc = r.doc; doc.cur = 0; const pg = P(); const rs = makeReadOnlyRenderState({x:0, y:0, zoom:1, width:1200, height:800, skin:${skin ? '"built"' : "undefined"}});
          const sc = (pg.scenarios || [])[0]; if(sc && sc.steps.length){ const s = FluyoStory.start(pg, sc, 0); if(s.ok) rs.scenarioRuntime = FluyoStory.renderState(s.playback, sc, 1200); }
          render(m.c, 1.3, {renderState: rs}); })()`, R2);
        return m.log; };
      sameOps(frame(R), frame(OLD), f + (skin ? " con piel" : ""));
      compared++;
    }
  }
  assert.ok(compared >= 8, "ejemplos comparados: " + compared);
});

/* ═══════════════ E. Estático y alcance ═══════════════ */
test("E1 · markup estático dentro de #scFlow, oculto por defecto; textos del prototipo validado; sin UNKNOWN ni vocabulario de salud", () => {
  const html = read("index.html");
  const f = html.indexOf('<section id="scFlow"'), sec = html.slice(f, html.indexOf("</section>", f));
  for (const s of ['<div id="scFlowTrack" class="scFlowTrack" aria-hidden="true" hidden>', '<span id="scFlowCursor" class="scFlowCursor" hidden>', '<dl id="scFlowEnds" class="scFlowEnds" hidden>',
    "<dt>Inicio</dt>", "<dt>Cambios de la ruta</dt>", "<dt>Final</dt>", '<ul id="scFlowRows" class="scFlowRows" hidden></ul>'])
    assert.ok(sec.includes(s), s);
  assert.ok(sec.indexOf('id="scFlowState"') < sec.indexOf('id="scFlowTrack"') && sec.indexOf('id="scFlowTrack"') < sec.indexOf('id="scFlowRows"'), "orden de D6: estado → línea de tiempo → filas");
  const block = flowBlock() + read("js/render.js").slice(read("js/render.js").indexOf("/* ===================== Ruta observada en el lienzo"), read("js/render.js").indexOf("/* ===================== Marcas del editor"));
  for (const s of ['"disponible"', '"no disponible"', '"ninguno"', '"vía "', '" rutas"', '" ruta"', '"Más de 10 000 rutas"']) assert.ok(block.includes(s), s);
  assert.ok(!/o más/.test(flowBlock()), "«+N rutas o más» ya no existe (QA del PO)");
  assert.ok(!/UNKNOWN|desconocid/.test(flowBlock()), "UNKNOWN no se ofrece ni se nombra en el editor");
  assert.ok(!/\b(sano|degradad|afectad|bloquead|impacto|causa)/i.test(block + sec), "sin vocabulario de salud ni de causa (§ 0)");
  assert.ok(!/breath|Math\.sin|performance\.now/.test(block.slice(block.indexOf("ROUTE_MARK"))), "el halo no «respira» (§ Pintado: TUNE)");
});

test("E2 · alcance frente a " + BASE + ": solo cambian render.js, editor-scenarios.js, flow-semantics.js, index.html, styles.css y sw.js (CACHE v99)", () => {
  const SERVED = ["js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), ["css/styles.css", "index.html", "js/editor-scenarios.js", "js/flow-semantics.js", "js/render.js", "sw.js"]);
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v99";/);
  assert.equal(read("sw.js").replace('"fluyo-static-v99"', '"fluyo-static-v' + (99 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante (el precache no cambia)");
  for (const f of ["js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/story-clock.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/viewer.js", "js/present-story.js", "js/export.js", "js/geometry.js", "js/skin.js", "js/interaction.js", "js/ui.js", "s/index.html"])
    assert.equal(read(f), atBase(f), f + " intacto (kernel del MCP, Viewer, Present y exportación)");
  /* las funciones de FASE 2 y FASE 3 no cambian: FASE 4 solo añade */
  const fs4 = read("js/flow-semantics.js"), fsb = atBase("js/flow-semantics.js");
  const cut = (s) => s.slice(s.indexOf("var FluyoFlow"), s.indexOf("  /* ─────────── FASE 4"));
  assert.equal(cut(fs4), fsb.slice(fsb.indexOf("var FluyoFlow"), fsb.indexOf("  return {AVAILABLE")), "FASE 2 y FASE 3 intactas");
});

test("E3 · undo4 (para los alcances de slices anteriores) deshace EXACTAMENTE FASE 4: cada archivo servido vuelve a " + BASE, () => {
  const { undo4, PIECES } = require("./fluyo-scenarios-semantics-4-undo.cjs");
  for (const f of Object.keys(PIECES)) assert.equal(undo4(f, read(f)), atBase(f), f);
  assert.deepEqual(Object.keys(PIECES).sort(), ["css/styles.css", "index.html", "js/editor-scenarios.js", "js/flow-semantics.js", "js/render.js"]);
});

test("E4 · B7: sin restos del prototipo; flow-semantics.js sigue fuera del kernel del MCP y el Viewer no lo carga", () => {
  for (const f of ["index.html", "js/editor-scenarios.js", "js/flow-semantics.js", "js/render.js", "css/styles.css"])
    assert.ok(!/PROTO_|prototipo=|protoSemantic|proto-semantic/.test(read(f)), f);
  assert.ok(!read("s/index.html").includes("flow-semantics"));
  const mcp = path.join(root, "..", "fluyo-mcp", "src", "generated", "kernel-sources.ts");
  if (fs.existsSync(mcp)) assert.ok(!/name: "(flow-semantics|render|editor-scenarios)\.js"/.test(fs.readFileSync(mcp, "utf8")), "ningún archivo de FASE 4 es kernel: el MCP no se toca");
});
