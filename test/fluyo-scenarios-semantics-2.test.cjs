"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 2 — núcleo de derivación (js/flow-semantics.js, FluyoFlow). Contrato congelado ANTES del código:
   .ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md § «FASE 2 — FROZEN SEMANTIC CONTRACT»; decisiones 219–220.
   · Estructura: NO_PATH / AVAILABLE / UNAVAILABLE por alcanzabilidad exacta sobre FLOWS_TO (M1–M6, C1–C3, S1–S3, source == target).
   · Estado: origen, destino e intermedios participan; un nodo sin afirmación es UP (por defecto).
   · Procedencia: DEFAULT / EXPLICIT (Behavior, SET_STATE aunque no cambie, Condiciones persistida); no altera el estado.
   · Seguridad: UNKNOWN y valores mal formados se rechazan (nunca se coaccionan); extremos ausentes; determinismo.
   · Propiedad: grafos aleatorios (semilla fija) frente a un oráculo de fuerza bruta de caminos simples que SOLO vive aquí.
   · Alcance: sin UI, sin sw.js, sin cambios en archivos servidos ni en el kernel; el módulo no lo carga la app en FASE 2. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const MAIN = "0409f4d";   // main al reintegrar; FASE 1 de referencia: 59588a9 (sobre ce8e699; la histórica es 4fb5872)
const { undo4b } = require("./fluyo-019-4b-undo.cjs");   /* FLUYO-019.4b cambia a propósito render.js, interaction.js, geometry.js, editor-runtime.js, state.js e index.html: se deshace aquí (antes que 019.4a y FASE 1); su alcance lo vigila test/fluyo-019-4b.test.cjs */
const { undo3: undo3only } = require("./fluyo-scenarios-semantics-3-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 3 cambia a propósito model.js, document-integrity.js, story-authoring.js, flow-semantics.js, editor-scenarios.js, index.html, styles.css y sw.js (precache): se deshace aquí, antes que todo lo demás; su alcance lo vigila test/fluyo-scenarios-semantics-3.test.cjs */
const { undoReverse } = require("./fluyo-step-reverse-002-undo.cjs");   /* FLUYO-STEP-REVERSE-002 cambia a propósito model.js, scenario-engine.js, story-playback.js, scenario-playback.js, story-authoring.js, document-integrity.js, render.js, editor-scenarios.js y selection.js: se deshace aquí, antes que FASE 3; su alcance lo vigila test/fluyo-step-reverse-002.test.cjs */
const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* FLUYO-STEP-REVERSE-003 añade «Invertir sentido» a editor-scenarios.js: se deshace aquí, antes que 002; su alcance lo vigila test/fluyo-step-reverse-003.test.cjs */
const { undo4: undo4only } = require("./fluyo-scenarios-semantics-4-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima de STEP-REVERSE-003: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-4.test.cjs */
const { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 5 va encima de FASE 4: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-5.test.cjs */
const undo4 = (f, src) => undo4only(f, undo5(f, src));
const undo3 = (f, src) => undo3only(f, undoReverse(f, undoReverseUi(f, undo4(f, src))));
const J = (v) => JSON.parse(JSON.stringify(v));

const G = vm.createContext({ console });
for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "flow-semantics.js"])
  vm.runInContext(read("js/" + f), G, { filename: f });
const call = (fn, ...args) => { G.__a = J(args); return J(vm.runInContext(`FluyoFlow.${fn}(...__a)`, G)); };
const fails = (fn, ...args) => { G.__a = J(args); return J(vm.runInContext(`(()=>{ try{ FluyoFlow.${fn}(...__a); return null; }catch(e){ return {code:e.code, field:e.field}; } })()`, G)); };

/* ── constructores ── */
const node = (id) => ({ id, shape: "rect", x: id * 10, y: 0, w: 100, h: 50, label: "N" + id });
/* edges: [from, to, kind?] ; kind: "F" = FLOWS_TO, "R" = REQUIRES, "G" = Conexión (sin clave), u otro texto tal cual */
const KIND = { F: "FLOWS_TO", R: "REQUIRES", G: undefined };
function page(n, edges, behaviors = []) {
  const ids = typeof n === "number" ? Array.from({ length: n }, (_, i) => i + 1) : n;
  return { name: "P", nodes: ids.map(node), behaviors, scenarios: [], nextScenarioId: 1, nextId: 1000,
    edges: edges.map(([from, to, k = "F"], i) => { const e = { id: 500 + i, from, to, route: "straight", waypoints: [] }; const kind = k in KIND ? KIND[k] : k; if (kind !== undefined) e.kind = kind; return e; }) };
}
const up = (pg, down = []) => Object.fromEntries(pg.nodes.map((n) => [n.id, down.includes(n.id) ? "DOWN" : "UP"]));
const status = (pg, s, t, down = []) => call("flowStatus", pg, s, t, up(pg, down));

/* ── oráculo de fuerza bruta (solo en el test): caminos simples sobre FLOWS_TO ── */
function oracle(pg, s, t, states) {
  if (s === t) return states[s] === "UP" ? "AVAILABLE" : "UNAVAILABLE";
  const adj = new Map();
  for (const e of pg.edges) if (e.kind === "FLOWS_TO") { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); }
  let any = false, avail = false;
  const seen = new Set([s]);
  (function walk(at, ok) {
    if (avail) return;
    if (at === t) { any = true; if (ok) avail = true; return; }
    for (const n of adj.get(at) || []) { if (seen.has(n)) continue; seen.add(n); walk(n, ok && states[n] === "UP"); seen.delete(n); }
  })(s, states[s] === "UP");
  return !any ? "NO_PATH" : avail ? "AVAILABLE" : "UNAVAILABLE";
}
function pathCount(pg, s, t) {
  const adj = new Map(); for (const e of pg.edges) if (e.kind === "FLOWS_TO") { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); }
  let n = 0; const seen = new Set([s]);
  (function walk(at) { if (at === t) { n++; return; } for (const x of adj.get(at) || []) { if (seen.has(x)) continue; seen.add(x); walk(x); seen.delete(x); } })(s);
  return n;
}

/* ── Estructura ── */
test("M1 · un camino A→B→D, todo disponible → AVAILABLE", () => {
  assert.equal(status(page(4, [[1, 2], [2, 4]]), 1, 4), "AVAILABLE");
});
test("M2 · camino alternativo: A→B→D y A→C→D con B caído y C disponible → AVAILABLE", () => {
  assert.equal(status(page(4, [[1, 2], [2, 4], [1, 3], [3, 4]]), 1, 4, [2]), "AVAILABLE");
});
test("M3 · todos los caminos cerrados: B y C caídos → UNAVAILABLE", () => {
  assert.equal(status(page(4, [[1, 2], [2, 4], [1, 3], [3, 4]]), 1, 4, [2, 3]), "UNAVAILABLE");
});
test("M4 · prefijo compartido: A→B, B→C→E, B→D→E con C caído → AVAILABLE (no es disyunción de conexiones)", () => {
  assert.equal(status(page(5, [[1, 2], [2, 3], [3, 5], [2, 4], [4, 5]]), 1, 5, [3]), "AVAILABLE");
});
test("M5 · bloqueador compartido: el mismo grafo con B caído → UNAVAILABLE", () => {
  assert.equal(status(page(5, [[1, 2], [2, 3], [3, 5], [2, 4], [4, 5]]), 1, 5, [2]), "UNAVAILABLE");
});
/* 7 rombos en cadena: 2^7 = 128 caminos distintos. Los «primeros» de cada rombo (en el orden del documento) están caídos, así que el
   único camino disponible es el último que enumeraría un DFS en orden del documento (el 128.º, muy por encima del tope 64). */
function manyPaths(k = 7) {
  const edges = []; let id = 1; const S = id++; let j = S; const down = [];
  for (let i = 0; i < k; i++) { const a = id++, b = id++, nj = id++; edges.push([j, a], [j, b], [a, nj], [b, nj]); down.push(a); j = nj; }
  return { pg: page(id - 1, edges), S, T: j, down };
}
test("M6 · > 64 caminos y el único disponible está detrás del corte del prototipo → AVAILABLE (exacto, sin tope)", () => {
  const { pg, S, T, down } = manyPaths(7);
  assert.equal(pathCount(pg, S, T), 128, "128 caminos simples distintos");
  assert.equal(status(pg, S, T, down), "AVAILABLE");
  assert.equal(status(pg, S, T, [...down, T - 1]), "UNAVAILABLE", "cerrar también el último camino (b del último rombo)");
  const big = manyPaths(16);    /* 65 536 caminos: una enumeración no terminaría a tiempo; la alcanzabilidad sí */
  const t0 = Date.now(); assert.equal(status(big.pg, big.S, big.T, big.down), "AVAILABLE"); assert.ok(Date.now() - t0 < 500, "lineal");
});
test("C1 · ciclo con salida (A→B→C, C→B, C→D), todo disponible → AVAILABLE y termina", () => {
  assert.equal(status(page(4, [[1, 2], [2, 3], [3, 2], [3, 4]]), 1, 4), "AVAILABLE");
});
test("C2 · ciclo sin salida hacia el destino (A→B→C→B; D aislado) → NO_PATH", () => {
  assert.equal(status(page(4, [[1, 2], [2, 3], [3, 2]]), 1, 4), "NO_PATH");
});
test("C3 · un ciclo con un nodo caído no contamina una ruta externa disponible → AVAILABLE", () => {
  /* A→B→C→B (C caído) y C→D ; ruta externa A→E→D */
  const pg = page(5, [[1, 2], [2, 3], [3, 2], [3, 4], [1, 5], [5, 4]]);
  assert.equal(status(pg, 1, 4, [3]), "AVAILABLE");
  assert.equal(status(pg, 1, 4, [3, 5]), "UNAVAILABLE");
});
test("S1/S2 · Conexión y Requisito no existen para la derivación: A–B genérica o A REQUIRES B, B FLOWS_TO C → NO_PATH", () => {
  assert.equal(status(page(3, [[1, 2, "G"], [2, 3]]), 1, 3), "NO_PATH");
  assert.equal(status(page(3, [[1, 2, "R"], [2, 3]]), 1, 3), "NO_PATH");
  assert.equal(status(page(3, [[1, 2, "TRIGGERS"], [2, 3]]), 1, 3), "NO_PATH", "un kind desconocido se lee como Conexión (decisión 215)");
});
test("S3 · misma adyacencia visual, distintos kind → resultados distintos", () => {
  const shape = [[1, 2], [2, 3], [1, 3]];
  const a = page(3, shape.map(([f, t]) => [f, t, "F"]));
  const b = page(3, shape.map(([f, t], i) => [f, t, i === 2 ? "R" : "F"]));
  const c = page(3, shape.map(([f, t], i) => [f, t, i === 0 ? "G" : "F"]));
  assert.deepEqual([status(a, 1, 3, [2]), status(b, 1, 3, [2]), status(c, 1, 3, [2])], ["AVAILABLE", "UNAVAILABLE", "AVAILABLE"]);
  assert.deepEqual([status(a, 1, 2), status(c, 1, 2)], ["AVAILABLE", "NO_PATH"]);
});
test("source == target · camino trivial: disponible → AVAILABLE, caído → UNAVAILABLE, nunca NO_PATH (también aislado)", () => {
  const pg = page(3, [[1, 2]]);
  assert.equal(status(pg, 3, 3), "AVAILABLE");
  assert.equal(status(pg, 3, 3, [3]), "UNAVAILABLE");
  assert.equal(status(pg, 1, 1), "AVAILABLE");
});
test("la dirección es from → to: el sentido contrario no tiene camino; puntas y flowDir no cuentan (W5)", () => {
  const pg = page(2, [[1, 2]]);
  assert.equal(status(pg, 2, 1), "NO_PATH");
  pg.edges[0].startArrow = true; pg.edges[0].endArrow = false; pg.edges[0].flowDir = "reverse";
  assert.deepEqual([status(pg, 1, 2), status(pg, 2, 1)], ["AVAILABLE", "NO_PATH"]);
});

/* ── Estado ── */
test("estado · el origen caído cierra (A caído → B)", () => { assert.equal(status(page(2, [[1, 2]]), 1, 2, [1]), "UNAVAILABLE"); });
test("estado · el destino caído cierra", () => { assert.equal(status(page(2, [[1, 2]]), 1, 2, [2]), "UNAVAILABLE"); });
test("estado · un intermedio caído cierra su camino", () => { assert.equal(status(page(3, [[1, 2], [2, 3]]), 1, 3, [2]), "UNAVAILABLE"); });
test("estado · por defecto todo nodo es UP: availabilityAt sin Behaviors ni eventos → AVAILABLE", () => {
  const pg = page(3, [[1, 2], [2, 3]]);
  const st = call("availabilityAt", pg, [], 0);
  assert.deepEqual(st, { 1: "UP", 2: "UP", 3: "UP" });
  assert.equal(call("flowStatus", pg, 1, 3, st), "AVAILABLE");
});
test("estado · availabilityAt: Behaviors + state_changed con at ≤ t, en orden (inclusivo)", () => {
  const pg = page(3, [[1, 2], [2, 3]], [{ nodeId: 2, initialState: "DOWN" }]);
  const ev = [{ at: 0, type: "send_started", edgeId: 500 }, { at: 1000, type: "state_changed", nodeId: 2, from: "DOWN", to: "UP" },
    { at: 2000, type: "state_changed", nodeId: 3, from: "UP", to: "DOWN" }, { at: 2000, type: "state_changed", nodeId: 3, from: "DOWN", to: "UP" }];
  assert.deepEqual(call("availabilityAt", pg, ev, 999), { 1: "UP", 2: "DOWN", 3: "UP" });
  assert.deepEqual(call("availabilityAt", pg, ev, 1000), { 1: "UP", 2: "UP", 3: "UP" });
  assert.deepEqual(call("availabilityAt", pg, ev, 2000), { 1: "UP", 2: "UP", 3: "UP" }, "dos cambios en el mismo instante: el último gana");
});
test("equivalencia · availabilityAt sobre el Trace del motor (FluyoStory.run) = reproducir los Steps en el orden del motor", () => {
  const pg = page(4, [[1, 2], [2, 4], [1, 3], [3, 4]], [{ nodeId: 3, initialState: "DOWN" }]);
  const steps = [{ id: 1, at: 0, action: "SET_STATE", nodeId: 2, state: "UP" }, { id: 2, at: 1500, action: "SET_STATE", nodeId: 2, state: "DOWN" },
    { id: 3, at: 1500, action: "SET_STATE", nodeId: 3, state: "UP" }, { id: 4, at: 3000, action: "SET_STATE", nodeId: 3, state: "DOWN" },
    { id: 5, at: 3000, action: "SET_STATE", nodeId: 3, state: "UP" }, { id: 6, at: 4500, action: "SET_STATE", nodeId: 4, state: "DOWN" }];
  const sc = { id: 1, engineVersion: 2, name: "H", nextStepId: 7, steps };
  G.__pg = J(pg); G.__sc = J(sc);
  const r = J(vm.runInContext("FluyoStory.run(__pg, __sc)", G));
  assert.ok(r.ok, JSON.stringify(r.errors));
  for (const t of [0, 1499, 1500, 2999, 3000, 4499, 4500, 99999]) {
    const replay = Object.fromEntries(pg.nodes.map((n) => [n.id, "UP"])); for (const b of pg.behaviors) replay[b.nodeId] = b.initialState;
    steps.map((s, i) => ({ s, i })).sort((a, b) => a.s.at - b.s.at || a.i - b.i).filter(({ s }) => s.at <= t).forEach(({ s }) => { replay[s.nodeId] = s.state; });
    assert.deepEqual(call("availabilityAt", pg, r.trace.events, t), replay, "t=" + t);
  }
  const fin = J(vm.runInContext("FluyoStory.finalAvailability(FluyoStory.run(__pg, __sc).trace, __pg)", G));
  assert.deepEqual(call("availabilityAt", pg, r.trace.events, 1e12), Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, v])));
});

/* ── Procedencia ── */
const prov = (pg, steps, t, timeOf) => { G.__a = J([pg, steps, t]); G.__timeOf = timeOf ? new vm.Script(`(${timeOf})`).runInContext(G) : undefined; return J(vm.runInContext("FluyoFlow.availabilityProvenance(...__a, __timeOf)", G)); };
const set = (id, at, nodeId, state) => ({ id, at, action: "SET_STATE", nodeId, state });
test("procedencia · sin afirmación → DEFAULT", () => {
  assert.deepEqual(prov(page(3, [[1, 2]]), [], 5000), { 1: "DEFAULT", 2: "DEFAULT", 3: "DEFAULT" });
});
test("procedencia · Behavior (Condiciones «No disponible», o «Disponible» persistida como Behavior UP) → EXPLICIT desde t=0", () => {
  const pg = page(3, [[1, 2]], [{ nodeId: 1, initialState: "DOWN" }, { nodeId: 2, initialState: "UP" }]);
  assert.deepEqual(prov(pg, [], 0), { 1: "EXPLICIT", 2: "EXPLICIT", 3: "DEFAULT" });
});
test("procedencia · SET_STATE que cambia el valor → EXPLICIT desde su instante (inclusivo), antes DEFAULT", () => {
  const pg = page(2, [[1, 2]]); const steps = [set(1, 2000, 2, "DOWN")];
  assert.equal(prov(pg, steps, 1999)[2], "DEFAULT");
  assert.equal(prov(pg, steps, 2000)[2], "EXPLICIT");
});
test("procedencia · SET_STATE del MISMO valor (UP sobre UP por defecto) → EXPLICIT, aunque el Trace no tenga cambio", () => {
  const pg = page(2, [[1, 2]]); const steps = [set(1, 3000, 1, "UP")];
  assert.equal(prov(pg, steps, 3000)[1], "EXPLICIT");
  G.__pg = J(pg); G.__sc = J({ id: 1, engineVersion: 2, name: "H", nextStepId: 2, steps });
  assert.equal(J(vm.runInContext("FluyoStory.run(__pg, __sc).trace.events", G)).length, 0, "el motor no emite nada: por eso se leen los Steps");
});
test("procedencia · la última afirmación gana el VALOR; una vez afirmado, el nodo no vuelve a DEFAULT", () => {
  const pg = page(2, [[1, 2]]); const steps = [set(1, 1000, 2, "DOWN"), set(2, 2000, 2, "UP")];
  G.__pg = J(pg); G.__sc = J({ id: 1, engineVersion: 2, name: "H", nextStepId: 3, steps });
  const ev = J(vm.runInContext("FluyoStory.run(__pg, __sc).trace.events", G));
  assert.equal(call("availabilityAt", pg, ev, 1500)[2], "DOWN"); assert.equal(call("availabilityAt", pg, ev, 2500)[2], "UP");
  assert.deepEqual([prov(pg, steps, 1500)[2], prov(pg, steps, 2500)[2]], ["EXPLICIT", "EXPLICIT"]);
});
test("procedencia · timeOf (instante visible) decide cuándo cuenta una afirmación", () => {
  const pg = page(2, [[1, 2]]); const steps = [set(1, 1000, 2, "UP")];
  assert.equal(prov(pg, steps, 1500, "s=>s.at+1000")[2], "DEFAULT", "visible en 2000");
  assert.equal(prov(pg, steps, 2000, "s=>s.at+1000")[2], "EXPLICIT");
  assert.equal(prov(pg, [{ id: 9, at: 0, action: "OCCURRENCE", nodeId: 2 }, { id: 8, at: 0, action: "SEND", edgeId: 500 }], 99)[2], "DEFAULT", "OCCURRENCE y SEND no afirman disponibilidad");
});
test("flowAvailability · explicitPath: un camino AVAILABLE todo EXPLICIT → true; si todos los disponibles tienen un DEFAULT → false; null si no es AVAILABLE", () => {
  const pg = page(4, [[1, 2], [2, 4], [1, 3], [3, 4]]);
  const st = up(pg);
  const P = (explicit) => Object.fromEntries(pg.nodes.map((n) => [n.id, explicit.includes(n.id) ? "EXPLICIT" : "DEFAULT"]));
  assert.deepEqual(call("flowAvailability", pg, 1, 4, st, P([1, 2, 4])), { status: "AVAILABLE", explicitPath: true });
  assert.deepEqual(call("flowAvailability", pg, 1, 4, st, P([1, 4])), { status: "AVAILABLE", explicitPath: false });
  assert.deepEqual(call("flowAvailability", pg, 1, 4, up(pg, [2]), P([1, 2, 4])), { status: "AVAILABLE", explicitPath: false }, "el camino explícito está caído");
  assert.deepEqual(call("flowAvailability", pg, 1, 4, up(pg, [2, 3]), P([1, 2, 3, 4])), { status: "UNAVAILABLE", explicitPath: null });
  assert.deepEqual(call("flowAvailability", pg, 4, 1, st, P([1, 2, 3, 4])), { status: "NO_PATH", explicitPath: null });
});
test("procedencia · no altera el estado: flowAvailability(...).status = flowStatus para cualquier procedencia", () => {
  const { pg, S, T, down } = manyPaths(4);
  for (const mode of ["DEFAULT", "EXPLICIT"]) {
    const P = Object.fromEntries(pg.nodes.map((n) => [n.id, mode]));
    for (const d of [[], down, [S], [T]]) assert.equal(call("flowAvailability", pg, S, T, up(pg, d), P).status, call("flowStatus", pg, S, T, up(pg, d)));
  }
});

/* ── Seguridad ── */
test("UNKNOWN se RECHAZA en las cuatro entradas (states, Behaviors, SET_STATE, eventos): nunca se coacciona", () => {
  const pg = page(2, [[1, 2]]);
  assert.deepEqual(fails("flowStatus", pg, 1, 2, { 1: "UP", 2: "UNKNOWN" }), { code: "invalid_availability", field: "2" });
  assert.deepEqual(fails("availabilityAt", page(2, [[1, 2]], [{ nodeId: 1, initialState: "UNKNOWN" }]), [], 0), { code: "invalid_availability", field: "1" });
  assert.deepEqual(fails("availabilityAt", pg, [{ at: 0, type: "state_changed", nodeId: 2, from: "UP", to: "UNKNOWN" }], 10), { code: "invalid_availability", field: "2" });
  assert.deepEqual(fails("availabilityProvenance", pg, [set(1, 0, 2, "UNKNOWN")], 10), { code: "invalid_availability", field: "2" });
  assert.deepEqual(fails("availabilityProvenance", page(2, [[1, 2]], [{ nodeId: 1, initialState: "UNKNOWN" }]), [], 10), { code: "invalid_availability", field: "1" });
  assert.deepEqual(fails("flowAvailability", pg, 1, 2, { 1: "UP", 2: "UNKNOWN" }, { 1: "DEFAULT", 2: "DEFAULT" }), { code: "invalid_availability", field: "2" });
});
test("valores mal formados: estado ausente, minúsculas, AVAILABLE, null, número → invalid_availability; procedencia mal formada → invalid_provenance", () => {
  const pg = page(2, [[1, 2]]);
  for (const v of [undefined, "up", "AVAILABLE", null, 1, ""]) {
    const st = { 1: "UP" }; if (v !== undefined) st[2] = v;
    assert.deepEqual(fails("flowStatus", pg, 1, 2, st), { code: "invalid_availability", field: "2" }, String(v));
  }
  assert.deepEqual(fails("flowAvailability", pg, 1, 2, up(pg), { 1: "DEFAULT", 2: "explicit" }), { code: "invalid_provenance", field: "2" });
  assert.deepEqual(fails("flowAvailability", pg, 1, 2, up(pg), { 1: "DEFAULT" }), { code: "invalid_provenance", field: "2" });
});
test("extremos y documento: origen/destino inexistentes, conexión FLOWS_TO colgante, kind no-texto, página o t inválidos", () => {
  const pg = page(2, [[1, 2]]);
  assert.deepEqual(fails("flowStatus", pg, 9, 2, up(pg)), { code: "node_not_found", field: "source" });
  assert.deepEqual(fails("flowStatus", pg, 1, 9, up(pg)), { code: "node_not_found", field: "target" });
  assert.deepEqual(fails("flowStatus", pg, null, 2, up(pg)), { code: "node_not_found", field: "source" });
  assert.deepEqual(fails("flowStatus", page(2, [[1, 2], [2, 7]]), 1, 2, up(page(2, []))), { code: "missing_edge_endpoint", field: "edges" });
  assert.equal(status(page(2, [[1, 2], [2, 7, "G"]]), 1, 2), "AVAILABLE", "una conexión genérica colgante no es de la derivación");
  const bad = page(2, [[1, 2]]); bad.edges[0].kind = 7;
  assert.deepEqual(fails("flowStatus", bad, 1, 2, up(bad)), { code: "invalid_document", field: "kind" });
  assert.deepEqual(fails("flowStatus", { nodes: [] }, 1, 2, {}), { code: "invalid_document", field: "page" });
  assert.deepEqual(fails("availabilityAt", pg, [], NaN), { code: "invalid_document", field: "t" });
  assert.deepEqual(fails("availabilityProvenance", pg, [], Infinity), { code: "invalid_document", field: "t" });
});

/* ── Determinismo y propiedad ── */
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
test("determinismo · el resultado no depende del orden de nodos, conexiones, claves de los estados ni de la procedencia", () => {
  const r = rng(7);
  const { pg, S, T, down } = manyPaths(5);
  const ref = status(pg, S, T, down), refA = call("flowAvailability", pg, S, T, up(pg, down), Object.fromEntries(pg.nodes.map((n) => [n.id, "EXPLICIT"])));
  for (let k = 0; k < 25; k++) {
    const q = J(pg); q.nodes = shuffle(q.nodes, r); q.edges = shuffle(q.edges, r);
    const st = Object.fromEntries(shuffle(Object.entries(up(pg, down)), r));
    const pv = Object.fromEntries(shuffle(pg.nodes.map((n) => [n.id, "EXPLICIT"]), r));
    assert.equal(call("flowStatus", q, S, T, st), ref);
    assert.deepEqual(call("flowAvailability", q, S, T, st, pv), refA);
  }
});
test("propiedad · 600 grafos aleatorios (semilla fija, con ciclos, Conexión y Requisito): flowStatus = oráculo de caminos simples", () => {
  const r = rng(20261018); let seen = { AVAILABLE: 0, UNAVAILABLE: 0, NO_PATH: 0 };
  for (let k = 0; k < 600; k++) {
    const n = 2 + Math.floor(r() * 7), edges = [];
    for (let a = 1; a <= n; a++) for (let b = 1; b <= n; b++) if (a !== b && r() < 0.3) edges.push([a, b, ["F", "F", "F", "R", "G"][Math.floor(r() * 5)]]);
    const pg = page(n, edges), down = pg.nodes.filter(() => r() < 0.3).map((x) => x.id);
    const s = 1 + Math.floor(r() * n), t = 1 + Math.floor(r() * n), st = up(pg, down);
    const got = call("flowStatus", pg, s, t, st);
    assert.equal(got, oracle(pg, s, t, st), JSON.stringify({ edges, down, s, t }));
    seen[got]++;
  }
  assert.ok(seen.AVAILABLE > 50 && seen.UNAVAILABLE > 50 && seen.NO_PATH > 50, JSON.stringify(seen));
});

/* ── Alcance ── */
test("alcance · FASE 2 solo añade js/flow-semantics.js: ningún archivo servido cambia, sw.js tampoco; la app no lo carga", () => {
  /* FASE 1 y FASE 2 se reintegran juntas sobre main (MAIN): en los archivos servidos, lo único que cambia frente a MAIN es el
     parche de FASE 1 (el de 59588a9 sobre ce8e699, línea a línea; en sw.js, salvo la CACHE); FASE 2 solo añade el módulo */
  const FASE1 = ["css/styles.css", "index.html", "js/geometry.js", "js/model.js", "js/render.js", "js/ui.js", "sw.js"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", MAIN, "--", "js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos"], { encoding: "utf8" })
    .split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", "js", "s", "css", "index.html", "sw.js"], { encoding: "utf8" }).split("\n").filter(Boolean);
  /* FLUYO-019.4b toca además interaction.js, editor-runtime.js y state.js: deshechos, son los de MAIN */
  const ONLY4B = ["js/editor-runtime.js", "js/interaction.js", "js/state.js"];
  for (const f of ONLY4B) assert.equal(undo4b(f, undo3(f, read(f))), execFileSync("git", ["-C", gitRoot, "show", MAIN + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"), f + " = " + MAIN + " fuera de 019.4b");
  /* SCENARIOS-SEMANTICS-001 FASE 3 añade document-integrity.js, story-authoring.js y editor-scenarios.js, y cablea el módulo
     (index.html y el precache): deshechos, son los de MAIN */
  const ONLY3 = ["js/document-integrity.js", "js/editor-scenarios.js", "js/story-authoring.js"];
  for (const f of ONLY3) assert.equal(undo3(f, read(f)), execFileSync("git", ["-C", gitRoot, "show", MAIN + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"), f + " = " + MAIN + " fuera de FASE 3");
  /* FLUYO-STEP-REVERSE-002 añade scenario-engine.js, scenario-playback.js, story-playback.js y selection.js: deshechos (undoReverse, dentro de undo3), son los de MAIN */
  const ONLY_REV = ["js/scenario-engine.js", "js/scenario-playback.js", "js/selection.js", "js/story-playback.js"];
  for (const f of ONLY_REV) assert.equal(undo3(f, read(f)), execFileSync("git", ["-C", gitRoot, "show", MAIN + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"), f + " = " + MAIN + " fuera de STEP-REVERSE-002");
  /* SCENARIOS-SEMANTICS-001 FASE 5 añade el Viewer, Present, la exportación SVG, share.css y docs: su alcance lo vigila test/fluyo-scenarios-semantics-5.test.cjs */
  const ONLY5 = ["css/share.css", "docs/index.html", "js/export.js", "js/present-story.js", "js/viewer.js", "s/index.html"];
  const { undo029 } = require("./fluyo-018-29-undo.cjs"), ONLY029 = ["js/story-clock.js"].filter((f) => undo029(f, read(f)) === execFileSync("git", ["-C", gitRoot, "show", MAIN + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"));   /* FLUYO-018.29 (G1) solo añade reveal al reloj: deshecho (undo029) es el de la base */
  assert.deepEqual([...new Set([...changed, ...untracked])].filter((f) => !FASE1.includes(f) && !ONLY4B.includes(f) && !ONLY3.includes(f) && !ONLY_REV.includes(f) && !ONLY5.includes(f) && !ONLY029.includes(f)).sort(), ["js/flow-semantics.js"]);
  for (const f of ["index.html", "s/index.html", "sw.js"]) assert.ok(!undo3(f, read(f)).includes("flow-semantics"), f + " no carga ni precachea el módulo (fuera de FASE 3)");
  const lines = (args, f) => execFileSync("git", ["-C", gitRoot, "diff", "-U0", ...args, "--", f], { encoding: "utf8" }).replace(/\r\n/g, "\n").split("\n")
    .filter((l) => /^[-+]/.test(l) && !/^(---|\+\+\+) /.test(l) && !/const CACHE = /.test(l));
  /* el árbol frente a MAIN, con 019.4b deshecho (git diff --no-index entre MAIN y el texto deshecho) */
  const linesNow = (f) => {
    const dir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "fluyo-sem2-")), a = path.join(dir, "a"), b = path.join(dir, "b");
    fs.writeFileSync(a, execFileSync("git", ["-C", gitRoot, "show", MAIN + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"));
    fs.writeFileSync(b, undo4b(f, undo3(f, read(f))));
    let out = ""; try { execFileSync("git", ["diff", "--no-index", "-U0", "--", a, b], { encoding: "utf8" }); } catch (e) { out = e.stdout || ""; }
    fs.rmSync(dir, { recursive: true, force: true });
    return out.replace(/\r\n/g, "\n").split("\n").filter((l) => /^[-+]/.test(l) && !/^(---|\+\+\+) /.test(l) && !/const CACHE = /.test(l));
  };
  for (const f of FASE1) assert.deepEqual(linesNow(f), lines(["ce8e699", "59588a9"], f), f + ": solo el parche de FASE 1");
  const src = read("js/flow-semantics.js");
  assert.ok(!/document\.|window\.|localStorage|requestAnimationFrame|setTimeout|Math\.random|Date\.now/.test(src), "puro: sin DOM, timers ni azar");
  assert.ok(!/enumerat|allPaths|MAX_PATHS|\b64\b/.test(src), "el estado no enumera caminos ni tiene tope");
});
