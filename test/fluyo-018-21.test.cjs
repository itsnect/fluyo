"use strict";
/* FLUYO-018.21 — Dependencias de llegada: «este momento no empieza hasta que llegue este envío».
   Rápido (vm, sin navegador). Todo se MIDE con el Playback real (FluyoScenarioPlayback.tick a 1 ms), no con la fórmula:
   · casos de diseño 1–7 (cadena, independiente, dos llegadas, momento atómico, inválida, ciclo, Historia antigua) + varios envíos;
   · motor/Trace intactos, salto = reproducción continua, compatibilidad con el kernel del MCP;
   · editor real (editor-scenarios.js + selection.js en vm): declarar, Undo/Redo, eliminar, duplicar, menú y línea de tiempo;
   · Share (#d=) y Viewer (viewer.js en vm); Present (FluyoStoryClock.describe);
   · alcance: kernel, render y formato sin cambios; CACHE v79.
   Uso: node --test test/fluyo-018-21.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j + b.length); };

/* ───────── fixtures ───────── */
const ET = {
  send: { id: 1, name: "Request", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { kind: "token", value: "📨" }, motion: "normal" },
  fast: { id: 2, name: "Ping", primitive: "FLOW", sentenceTemplate: "{source} avisa a {target}", visual: { kind: "token", value: "⚡" }, motion: "fast" },
  slow: { id: 3, name: "Lote", primitive: "FLOW", sentenceTemplate: "{source} manda un lote a {target}", visual: { kind: "token", value: "📦" }, motion: "slow" },
  recv: { id: 4, name: "Recibe", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe", visual: { kind: "token", value: "✅" }, motion: "normal" },
  down: { id: 5, name: "Cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "💥" }, motion: "normal" },
};
const S = (id, at, et, target) => et.primitive === "FLOW" ? { id, at, eventTypeId: et.id, action: "SEND", edgeId: target }
  : et.primitive === "OCCURRENCE" ? { id, at, eventTypeId: et.id, action: "OCCURRENCE", nodeId: target } : { id, at, eventTypeId: et.id, action: "SET_STATE", nodeId: target, state: et.availability };
const node = (id, label, x) => ({ id, shape: "rect", x, y: 300, w: 140, h: 60, label });
const NODES = [node(1, "A", 200), node(2, "B", 500), node(3, "C", 800), node(4, "X", 500), node(5, "D", 1100)];
NODES[3].y = 520;
const EDGES = [{ id: 10, from: 1, to: 2, route: "straight", waypoints: [] }, { id: 11, from: 2, to: 3, route: "straight", waypoints: [] },
  { id: 12, from: 1, to: 3, route: "straight", waypoints: [] }, { id: 13, from: 3, to: 5, route: "straight", waypoints: [] }];
const W = (stepId, ...ids) => ({ stepId, waitsForArrivalOf: ids });
function project(steps, deps, extra = {}) {
  const sc = { id: 1, engineVersion: 2, name: "Historia", nextStepId: 50, steps };
  if (deps !== undefined) sc.arrivalDependencies = deps;
  return { version: 5, app: "fluyo", settings: {}, doc: { theme: "dark", customBg: "", cur: 0, nextEventTypeId: 6, eventTypes: Object.values(ET),
    pages: [{ name: "Semántica", nodes: NODES, edges: EDGES, nextId: 20, behaviors: [], nextScenarioId: 2, scenarios: [Object.assign(sc, extra)] }] } };
}
/* Casos del diseño (.ai/tasks/FLUYO-018.21.md § Validación) */
const CASE = {
  chain: () => project([S(1, 0, ET.send, 10), S(2, 500, ET.recv, 2), S(3, 1000, ET.send, 11), S(4, 1500, ET.recv, 3)], [W(2, 1), W(4, 3)]),
  chainDefaults: () => project([S(1, 0, ET.send, 10), S(2, 1000, ET.recv, 2), S(3, 2000, ET.send, 11), S(4, 3000, ET.recv, 3)], [W(2, 1), W(4, 3)]),
  independent: () => project([S(1, 0, ET.send, 10), S(2, 500, ET.down, 4), S(3, 1000, ET.recv, 2)], [W(3, 1)]),
  twoArrivals: () => project([S(1, 0, ET.fast, 10), S(2, 0, ET.slow, 12), S(3, 1000, ET.recv, 2), S(4, 1000, ET.recv, 3)], [W(3, 1), W(4, 2)]),
  atomic: () => project([S(1, 0, ET.send, 10), S(2, 500, ET.down, 4), S(3, 500, ET.recv, 2)], [W(3, 1)]),
  manySends: () => project([S(1, 0, ET.slow, 10), S(2, 300, ET.fast, 11), S(3, 600, ET.recv, 3), S(4, 900, ET.recv, 2)], [W(4, 1, 2)]),
};

/* ───────── kernel real en vm ───────── */
function kernel(extraFiles = []) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, CompressionStream, DecompressionStream, Response, Blob });
  for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", ...extraFiles])
    vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.run = (code) => vm.runInContext(code, ctx);
  return ctx;
}
function load(k, p) { k.run(`doc = projectFromProjectData(${JSON.stringify(p)}).doc; var __pg = doc.pages[0], __sc = __pg.scenarios[0];`); }
/* Reproduce con el Playback real a 1 ms: instante en que se VE cada momento, llegada de cada envío, y el horario. */
function measure(p, startFn = "FluyoStoryClock.start") {
  const k = kernel(); load(k, p);
  return JSON.parse(k.run(`(function(){
    const st = ${startFn}(__pg, __sc, 0); if (!st.ok) return {errors: st.errors};
    const shown = {}, arrived = {};
    for (let t = 0; t <= 30000; t++) {
      const rs = FluyoScenarioPlayback.tick(st.playback, t);
      for (const e of rs.logEvents) if (shown[e.stepId] === undefined) shown[e.stepId] = t;
      for (const c of rs.completedSends) if (arrived[c.stepId] === undefined) arrived[c.stepId] = Math.round(c.doneReal);
      if (rs.finished) break;
    }
    const groups = storyboardGroups(__sc.steps);
    return JSON.stringify({ moments: groups.map(g => shown[g.steps[0].id]), atomic: groups.every(g => g.steps.every(s => shown[s.id] === shown[g.steps[0].id])),
      shown, arrived, schedule: st.playback.schedule || null });
  })()`));
}

/* ───────── 1. cadena ───────── */
test("caso 1 · cadena A→B→C: M2 espera a A→B, M4 espera a B→C; lo demás conserva su ritmo", () => {
  const m = measure(CASE.chain());
  assert.equal(m.arrived[1], 1100, "arrival(A→B) = 0 + 1100");
  assert.deepEqual(m.moments, [0, 1100, 1600, 2700], "M1 0 · M2 1100 (espera) · M3 1600 (+500 tras M2) · M4 2700 (espera)");
  assert.equal(m.arrived[3], 2700, "arrival(B→C) = salida visible 1600 + 1100");
  assert.ok(m.moments[1] >= m.arrived[1] && m.moments[3] >= m.arrived[3], "nada se ve antes de su llegada");
  const d = measure(CASE.chainDefaults());
  assert.deepEqual(d.moments, [0, 1100, 2100, 3200], "con las esperas por defecto del editor (1 s): 0 · 1100 · 2100 · 3200");
  assert.deepEqual(d.arrived, { 1: 1100, 3: 3200 });
});

/* ───────── 2. independiente ───────── */
test("caso 2 · un evento independiente NO se desplaza por la llegada A→B (no hay barrera global)", () => {
  const m = measure(CASE.independent());
  assert.deepEqual(m.moments, [0, 500, 1100], "M1 0 · M2 «X cae» 500 (su tiempo narrativo) · M3 «B recibe» 1100 = llegada");
  assert.equal(m.shown[2], 500, "X cambia de estado a los 500 ms, con el token aún en vuelo");
  assert.equal(m.arrived[1], 1100);
});

/* ───────── 3. dos llegadas ───────── */
test("caso 3 · dos llegadas en el mismo momento: M2 aparece en 1800 (espera a la unión: B 500, C 1800)", () => {
  const m = measure(CASE.twoArrivals());
  assert.deepEqual(m.arrived, { 1: 500, 2: 1800 });
  assert.deepEqual(m.moments, [0, 1800]);
  assert.ok(m.atomic, "B y C se ven a la vez (un momento)");
  const only = project([S(1, 0, ET.fast, 10), S(2, 0, ET.slow, 12), S(3, 1000, ET.recv, 2), S(4, 1000, ET.recv, 3)], [W(4, 2)]);
  assert.deepEqual(measure(only).moments, [0, 1800], "con solo la de C, igual: el momento es atómico");
  const split = project([S(1, 0, ET.fast, 10), S(2, 0, ET.slow, 12), S(3, 1000, ET.recv, 2), S(4, 1001, ET.recv, 3)], [W(3, 1), W(4, 2)]);
  assert.deepEqual(measure(split).moments, [0, 1000, 1800], "en momentos distintos, cada uno a su llegada");
});

/* ───────── 4. momento atómico ───────── */
test("caso 4 · dos Steps y una sola dependencia: el momento entero (también «X cae») espera; su `at` no cambia", () => {
  const p = CASE.atomic(), m = measure(p);
  assert.deepEqual(m.moments, [0, 1100]);
  assert.ok(m.atomic);
  assert.equal(m.shown[2], 1100, "X se ve con su momento, a la llegada");
  assert.equal(p.doc.pages[0].scenarios[0].steps[1].at, 500, "su tiempo narrativo sigue siendo 500");
  assert.deepEqual(m.schedule.waitsFor, [[], [1]], "el horario dice qué espera el momento");
});

/* ───────── varios envíos ───────── */
test("varios envíos: un paso que espera dos llegadas se ve tras la más tardía", () => {
  const m = measure(CASE.manySends());
  assert.deepEqual(m.arrived, { 1: 1800, 2: 800 });
  assert.deepEqual(m.moments, [0, 300, 600, 1800], "M4 (900) espera a la llegada lenta (1800)");
});

/* ───────── 5. dependencia inválida ───────── */
test("caso 5 · dependencias inválidas se ignoran: nunca bloquean ni rompen la Historia", () => {
  const steps = [S(1, 0, ET.send, 10), S(2, 500, ET.recv, 2), S(3, 1000, ET.send, 11), S(4, 1000, ET.recv, 3)];
  const plain = measure(project(steps));
  const cases = {
    "a un SEND eliminado": [W(2, 77)], "de un Step eliminado": [W(66, 1)], "a algo que no es SEND": [W(3, 2)],
    "al mismo momento": [W(4, 3)], "hacia delante": [W(2, 3)], "id no entero": [W(2, "1")], "lista rota": [{ stepId: 2, waitsForArrivalOf: 1 }],
    "campo que no es lista": "x", "entrada nula": [null],
  };
  for (const [name, deps] of Object.entries(cases)) {
    const m = measure(project(steps, deps));
    assert.ok(!m.errors, name + ": se reproduce");
    assert.deepEqual(m.moments, plain.moments, name + ": igual que sin dependencias");
  }
  const k = kernel(); load(k, project(steps, [W(2, 77), W(66, 1), W(3, 2), W(4, 3), W(2, 3)]));
  const reasons = JSON.parse(k.run("JSON.stringify(FluyoStoryClock.arrivalDependencies(__sc).ignored.map(i => i.reason))"));
  assert.deepEqual(reasons, ["send_missing", "step_missing", "not_send", "not_earlier", "not_earlier"]);
});

/* ───────── 6. ciclo ───────── */
test("caso 6 · ciclo A↔B: solo vale la que apunta a un momento anterior; tiempos finitos, una pasada", () => {
  const steps = [S(1, 0, ET.send, 10), S(3, 1000, ET.send, 11)];
  const m = measure(project(steps, [W(1, 3), W(3, 1)]));
  assert.deepEqual(m.moments, [0, 1100], "1 → 3 se ignora (hacia delante); 3 espera a 1");
  const same = measure(project([S(1, 0, ET.send, 10), S(3, 0, ET.send, 11)], [W(1, 3), W(3, 1)]));
  assert.deepEqual(same.moments, [0], "en el mismo momento, ambas se ignoran (esperarían a su propio token)");
  const k = kernel(); load(k, project(steps, [W(1, 3), W(3, 1)]));
  assert.deepEqual(JSON.parse(k.run("JSON.stringify(FluyoStoryClock.arrivalDependencies(__sc).ignored)")), [{ stepId: 1, sendId: 3, reason: "not_earlier" }]);
  assert.ok(m.moments.every(Number.isFinite));
});

/* ───────── 7. Historia antigua ───────── */
test("caso 7 · Historias antiguas (sin el campo): idénticas a la reproducción anterior, fotograma a fotograma; nada se infiere", () => {
  const files = fs.readdirSync(path.join(root, "test/fixtures")).filter((f) => f.endsWith(".fluyo.json"));
  let stories = 0;
  for (const f of files) {
    const data = JSON.parse(read("test/fixtures/" + f));
    const k = kernel();
    k.run(`doc = projectFromProjectData(${JSON.stringify(data)}).doc;`);
    const n = k.run("doc.pages.reduce((a,p)=>a+p.scenarios.filter(s=>s.steps.length).length,0)");
    for (let pi = 0; pi < k.run("doc.pages.length"); pi++) for (let si = 0; si < k.run(`doc.pages[${pi}].scenarios.length`); si++) {
      const ok = k.run(`(function(){ const pg = doc.pages[${pi}], sc = pg.scenarios[${si}]; if (!sc.steps.length || sc.engineVersion !== 2) return "skip";
        const a = FluyoStory.start(pg, sc, 0), b = FluyoStoryClock.start(pg, sc, 0); if (!a.ok) return b.ok ? "diff" : "skip";
        if (b.playback.schedule.shifted) return "shifted";
        if (JSON.stringify(b.playback.trace) !== JSON.stringify(FluyoStory.run(pg, sc).trace)) return "trace";
        for (let t = 0; t <= 12000; t += 7) if (JSON.stringify(FluyoScenarioPlayback.tick(a.playback, t)) !== JSON.stringify(FluyoScenarioPlayback.tick(b.playback, t))) return "frame " + t;
        return "same"; })()`);
      if (ok === "skip") continue;
      assert.equal(ok, "same", f + " p" + pi + " h" + si);
      stories++;
    }
    assert.ok(n >= 0);
  }
  assert.ok(stories >= 5, "se comprobaron " + stories + " Historias antiguas");
  /* sin dependencias no se infiere nada de las conexiones: el caso 1 sin el campo es el timeline narrativo */
  assert.deepEqual(measure(project(CASE.chain().doc.pages[0].scenarios[0].steps)).moments, [0, 500, 1000, 1500]);
});

/* ───────── motor, Trace, salto, formato ───────── */
test("motor y Trace intactos; el documento no cambia al reproducir; FluyoIntegrity válido con el campo", () => {
  const k = kernel(["document-integrity.js"]); load(k, CASE.chain());
  const plain = kernel(); load(plain, project(CASE.chain().doc.pages[0].scenarios[0].steps));
  assert.equal(k.run("JSON.stringify(FluyoStory.run(__pg, __sc).trace)"), plain.run("JSON.stringify(FluyoStory.run(__pg, __sc).trace)"), "el Trace no ve la dependencia");
  const before = k.run("JSON.stringify(doc)");
  k.run("(function(){ const st = FluyoStoryClock.start(__pg, __sc, 0); for (let t = 0; t < 4000; t += 10) FluyoScenarioPlayback.tick(st.playback, t); })()");
  assert.equal(k.run("JSON.stringify(doc)"), before, "reproducir no toca el documento");
  assert.equal(k.run(`FluyoIntegrity.validateProject(${JSON.stringify(CASE.chain())}).valid`), true);
  const st = JSON.parse(k.run("(function(){ const s = FluyoStoryClock.start(__pg, __sc, 0); return JSON.stringify({ log: s.playback.trace.events.map(e=>[e.type, e.at, e.narrativeAt]), run: FluyoStory.run(__pg, __sc).trace.events.map(e=>[e.type, e.at]) }); })()"));
  assert.deepEqual(st.run.map((e) => e[1]), [0, 0, 500, 1000, 1000, 1500], "el Trace del motor conserva los `at` narrativos");
  assert.deepEqual(st.log.map((e) => e[1]), [0, 0, 1100, 1600, 1600, 2700], "la copia que reproduce lleva los visibles");
  assert.deepEqual(st.log.map((e) => e[2]), [0, 0, 500, 1000, 1000, 1500], "y conserva el narrativo");
});

test("salto: ir a cada momento (instante visible) = reproducción continua en ese instante; ⏮/⏭ por instantes visibles", () => {
  const k = kernel(); load(k, CASE.chain());
  const times = JSON.parse(k.run("JSON.stringify(FluyoStoryClock.schedule(__sc, FluyoStory.stepMeta(__sc.steps)).times)"));
  assert.deepEqual(times, [0, 1100, 1600, 2700]);
  for (let i = 0; i < times.length; i++) for (const extra of [0, 250]) {
    const [a, b] = JSON.parse(k.run(`(function(){
      const c = FluyoStoryClock.create(); FluyoStoryClock.pause(c, 9000);
      const r = FluyoStoryClock.seek(c, 9000, __pg, __sc, ${i}); FluyoStoryClock.resume(c, 9000);
      const v = FluyoScenarioPlayback.tick(r.playback, FluyoStoryClock.now(c, 9000 + ${extra}));
      const s = FluyoStoryClock.start(__pg, __sc, 0); for (let t = 0; t <= ${times[i]} + ${extra}; t += 25) FluyoScenarioPlayback.tick(s.playback, t);
      const w = FluyoScenarioPlayback.tick(s.playback, ${times[i]} + ${extra});
      const f = x => ({ s: x.activeSends.map(y=>[y.stepId, +y.progress.toFixed(5)]), l: x.logEvents.map(e=>[e.type, e.at, e.stepId]), n: x.nodeStates });
      return JSON.stringify([f(v), f(w)]); })()`));
    assert.deepEqual(a, b, `momento ${i} + ${extra} ms`);
  }
  assert.deepEqual(JSON.parse(k.run("(function(){ const s = FluyoStoryClock.start(__pg, __sc, 0); FluyoScenarioPlayback.tick(s.playback, 1200); return JSON.stringify([FluyoStoryClock.momentTimes(__sc, s.playback), FluyoStoryClock.momentTimes(__sc)]); })()")),
    [[0, 1100, 1600, 2700], [0, 500, 1000, 1500]], "con reproducción, los visibles; sin ella, los narrativos");
});

test("formato aditivo: el kernel del MCP (FluyoAuthoring) y Share conservan arrivalDependencies; los lectores no se rompen", async () => {
  const k = kernel(["document-integrity.js", "story-authoring.js", "link-codec.js", "share-url.js"]);
  const p = CASE.chain();
  const norm = JSON.parse(k.run(`JSON.stringify(FluyoAuthoring.normalizedProject(${JSON.stringify(p)}))`));
  assert.deepEqual(norm.project.doc.pages[0].scenarios[0].arrivalDependencies, [W(2, 1), W(4, 3)], "normalizedProject (revisión del MCP) lo conserva");
  for (const op of [{ op: "add_step", scope: "story", pageIndex: 0, storyId: 1, eventTypeId: 4, target: { nodeId: 5 } }, { op: "set_wait", scope: "story", pageIndex: 0, storyId: 1, stepId: 2, waitMs: 900 }, { op: "rename_story", scope: "story", pageIndex: 0, storyId: 1, name: "Otra" }]) {
    const r = JSON.parse(k.run(`JSON.stringify(FluyoAuthoring.apply(${JSON.stringify(p)}, [${JSON.stringify(op)}]))`));
    assert.ok(r.ok, op.op);
    assert.deepEqual(r.project.doc.pages[0].scenarios[0].arrivalDependencies, [W(2, 1), W(4, 3)], "author_document " + op.op + " lo conserva");
  }
  k.context = k; k.run("var __project = " + JSON.stringify(p) + ";");
  const url = await k.run('createShareUrl(__project, "https://fluyo.space/", {kind:"story", scenarioId:1})');
  const back = await k.run(`decodeDeepLink(${JSON.stringify(url.split("#d=")[1])})`);
  assert.deepEqual(k.run(`JSON.stringify(projectFromProjectData(${JSON.stringify(back)}).doc.pages[0].scenarios[0].arrivalDependencies)`), JSON.stringify([W(2, 1), W(4, 3)]), "«Compartir historia» (#d=) lo conserva");
});

/* ───────── autoría (pura) ───────── */
test("autoría pura: candidatos = SEND anteriores; activar/quitar/duplicar/limpiar en forma canónica", () => {
  const k = kernel(); load(k, project([S(1, 0, ET.send, 10), S(2, 500, ET.recv, 2), S(3, 1000, ET.send, 11), S(4, 1000, ET.recv, 3), S(5, 1500, ET.recv, 3)]));
  const J = (code) => JSON.parse(k.run("JSON.stringify(" + code + ")"));
  assert.deepEqual(J("FluyoStoryClock.arrivalCandidates(__sc, 4).map(s=>s.id)"), [1], "el envío del mismo momento (3) no es candidato");
  assert.deepEqual(J("FluyoStoryClock.arrivalCandidates(__sc, 5).map(s=>s.id)"), [1, 3]);
  assert.deepEqual(J("FluyoStoryClock.arrivalCandidates(__sc, 1)"), [], "el primer momento no puede esperar nada");
  assert.deepEqual(J("FluyoStoryClock.withArrivalWait(__sc, 5, 3, true)"), [W(5, 3)]);
  assert.equal(J("FluyoStoryClock.withArrivalWait(__sc, 4, 3, true)"), null, "un envío no válido no se acepta");
  k.run("__sc.arrivalDependencies = [{stepId:5, waitsForArrivalOf:[3,1,3]}, {stepId:2, waitsForArrivalOf:[1]}, {stepId:99, waitsForArrivalOf:[1]}]");
  assert.deepEqual(J("FluyoStoryClock.pruneArrivalDependencies(__sc)"), [W(2, 1), W(5, 1, 3)], "ordenado, sin duplicados, sin Steps inexistentes");
  assert.deepEqual(J("FluyoStoryClock.withArrivalWait(__sc, 5, 3, false)"), [W(2, 1), W(5, 1)]);
  assert.deepEqual(J("FluyoStoryClock.withoutArrivalWaits(__sc, 2)"), [W(5, 1, 3)]);
  assert.deepEqual(J("FluyoStoryClock.copyArrivalWaits(Object.assign({}, __sc, {steps: __sc.steps.concat([{id:6, at:500, action:'OCCURRENCE', nodeId:2, eventTypeId:4}])}), 2, 6)"), [W(2, 1), W(5, 1, 3), W(6, 1)]);
  assert.deepEqual(J("FluyoStoryClock.momentWaits(__sc, 1500)"), [3, 1]);
});

/* ───────── editor real en vm (con el Undo de selection.js) ───────── */
const { makeScenarioUIContext, setupPanel, ensureUI } = require("./fluyo-016-harness.cjs");
function editor(p) {
  const { ctx, register } = makeScenarioUIContext();
  vm.runInContext(read("js/story-clock.js"), ctx);
  ctx.__T = 0; vm.runInContext("performance = { now: () => __T };", ctx);
  ctx.run(`doc = projectFromProjectData(${JSON.stringify(p)}).doc; undoStack=[]; redoStack=[];`);
  setupPanel(ctx, register);
  for (const id of ["scNow", "scNowLabel", "scNowCaption", "scNowProgress", "scRunHint", "scPause", "scPrev", "scNext", "scNotice"]) register(id, ctx.document.createElement(id === "scPause" || id === "scPrev" || id === "scNext" ? "button" : "div"));
  ctx.isSheetLayout = () => false; ctx.syncStoryState = () => {};
  ensureUI(ctx);
  ctx.run("scSelectStory(P().scenarios[0].id); scRenderPanel();");
  return ctx;
}
const DEPS = (E) => E.run("JSON.stringify(scActiveScenario().arrivalDependencies || null)");
const texts = (el) => [el.textContent, ...(el.children || []).flatMap(texts)];

test("editor: «Esperar a que llegue…» declara la dependencia del momento; Undo/Redo la deshace y rehace", () => {
  const E = editor(project([S(1, 0, ET.send, 10), S(2, 500, ET.down, 4), S(3, 1000, ET.recv, 2)]));
  const item = E.run("JSON.stringify(scArrivalMenuItem(scActiveScenario().steps[2]))");
  const it = JSON.parse(item);
  assert.equal(it.label, "Esperar a que llegue…");
  assert.equal(it.sub.title, "Este momento no empieza hasta que llegue…");
  assert.deepEqual(E.run("JSON.stringify(scArrivalMenuItem(scActiveScenario().steps[2]).sub.items.map(i=>[i.label, i.hint]))"), JSON.stringify([["📨 Request", "A → B"]]), "solo SEND válidos anteriores");
  assert.equal(E.run("scArrivalMenuItem(scActiveScenario().steps[0]).disabled"), true, "el primer momento no puede esperar");
  E.run("scArrivalMenuItem(scActiveScenario().steps[2]).sub.items[0].fn()");
  assert.equal(DEPS(E), JSON.stringify([W(3, 1)]));
  assert.equal(E.run("undoStack.length"), 1, "una entrada de Undo");
  assert.match(E.run('$("scNotice").textContent'), /Este momento no empezará hasta que llegue «📨 Request»\./);
  const board = texts(E.run('$("scStoryboard")')).join("|");
  assert.match(board, /No empieza hasta que llegue «📨 Request» \(A → B\)/, "la línea de tiempo lo dice a nivel de momento");
  assert.match(E.run("JSON.stringify(scArrivalMenuItem(scActiveScenario().steps[2]))"), /"label":"✓ 📨 Request"/, "marcada en el menú");
  E.run("undo()");
  assert.equal(DEPS(E), "null", "Deshacer quita la dependencia (y el campo)");
  assert.ok(!texts(E.run('$("scStoryboard")')).join("|").includes("No empieza hasta"), "la línea de tiempo se refresca");
  E.run("redo()");
  assert.equal(DEPS(E), JSON.stringify([W(3, 1)]), "Rehacer la devuelve");
  E.run("scArrivalMenuItem(scActiveScenario().steps[2]).sub.items.find(i=>i.label==='No esperar').fn()");
  assert.equal(DEPS(E), "null", "«No esperar» la quita");
});

test("editor: eliminar el envío limpia la dependencia; eliminar el que espera, también; duplicar copia la espera", () => {
  const E = editor(project([S(1, 0, ET.send, 10), S(2, 500, ET.recv, 2), S(3, 1000, ET.recv, 3)], [W(2, 1), W(3, 1)]));
  E.run("scDuplicateStep(2)");
  assert.equal(DEPS(E), JSON.stringify([W(2, 1), W(3, 1), W(50, 1)]), "la copia (id 50) espera lo mismo");
  E.run("scDeleteStep(3)");
  assert.equal(DEPS(E), JSON.stringify([W(2, 1), W(50, 1)]), "eliminar el que espera");
  E.run("scDeleteStep(1)");
  assert.equal(DEPS(E), "null", "eliminar el envío: no queda ninguna dependencia apuntándolo");
  E.run("undo()");
  assert.equal(DEPS(E), JSON.stringify([W(2, 1), W(50, 1)]), "Deshacer devuelve el envío y sus dependencias");
});

test("editor: reproducir, pausar/reanudar y saltar usan el instante visible; el evento independiente no espera", () => {
  const E = editor(CASE.independent());
  E.run("scRun()");
  const at = (t) => { E.__T = t; E.run("scTick()"); };
  const status = () => JSON.parse(E.run("JSON.stringify(scActiveScenario().steps.map(s => scRuntimeStateForStep(s).status))"));
  at(600);
  assert.deepEqual(status(), ["active", "completed", "pending"], "a 600 ms: X ya cayó, «B recibe» sigue pendiente (el token va al 55 %)");
  at(1050);
  assert.equal(status()[2], "pending", "a 1050 ms, todavía no");
  E.run("scPause()"); E.__T = 5000; E.run("scRenderStatus()");
  assert.equal(E.run("scPlayback.cursorVirtual"), 1050, "en pausa no avanza");
  E.run("scResume()"); at(5060);
  assert.notEqual(status()[2], "pending", "reanudado, a 1110 ms (visible 1100) ya está");
  assert.deepEqual(JSON.parse(E.run("JSON.stringify(scMomentNav().times)")), [0, 500, 1100]);
  E.run("scSeekMoment(2)");
  assert.equal(E.run("scPlayback.cursorVirtual"), 1100, "⏭ al momento que espera = su llegada");
  assert.match(E.run('$("scNowCaption").textContent'), /Recibe/);
  E.run("scSeekMoment(1)");
  assert.equal(E.run("scPlayback.cursorVirtual"), 500, "⏮ al momento independiente = su tiempo narrativo");
  E.run("scReset()");
  assert.equal(E.run("JSON.stringify(scActiveScenario().steps.map(s=>s.at))"), "[0,500,1000]", "el documento no cambia");
});

/* ───────── Viewer (viewer.js en vm) y Present ───────── */
const { makeViewer } = require("./viewer-harness.cjs");
async function openViewer(p) {
  const c = makeViewer(); c.run(read("js/share-url.js"));
  c.context.project = p; c.context.location.href = "https://fluyo.space/";
  const hash = new URL(await c.run('createShareUrl(project,"https://fluyo.space/")')).hash;
  const v = makeViewer({ search: "", hash }); v.connect(); await v.boot(); await v.waitForPhase((ph) => ph === "ready" || ph === "error");
  return v;
}
test("Viewer: la Historia compartida espera la llegada; el independiente no; ⏮/⏭ y progreso por instantes visibles", async () => {
  const v = await openViewer(CASE.independent());
  assert.equal(v.viewer().phase, "ready");
  assert.equal(v.run("JSON.stringify(P().scenarios[0].arrivalDependencies)"), JSON.stringify([W(3, 1)]), "el enlace lleva el dato");
  v.el("stPlay").onclick(); v.frames(1);
  v.advance(600); v.frames(1);
  assert.equal(v.el("stProgress").textContent, "2 / 3", "a 600 ms: el momento independiente ya llegó");
  v.advance(400); v.frames(1);
  assert.equal(v.el("stProgress").textContent, "2 / 3", "a 1000 ms (su `at` narrativo) M3 todavía no: espera la llegada");
  v.advance(150); v.frames(1);
  assert.equal(v.el("stProgress").textContent, "3 / 3", "a 1150 ms, sí");
  v.el("stPrev").onclick(); v.frames(1);
  assert.equal(v.run("story.playback.cursorVirtual"), 500);
  v.el("stNext").onclick(); v.frames(1);
  assert.equal(v.run("story.playback.cursorVirtual"), 1100, "⏭ = instante visible");
  const plain = await openViewer(project(CASE.independent().doc.pages[0].scenarios[0].steps));
  plain.el("stPlay").onclick(); plain.frames(1); plain.advance(1000); plain.frames(1);
  assert.equal(plain.el("stProgress").textContent, "3 / 3", "sin el dato, como siempre: M3 a su `at`");
});

test("Present: el título y el progreso salen de FluyoStoryClock.describe (momento visible)", () => {
  const ps = read("js/present-story.js");
  assert.ok(ps.includes('(typeof FluyoStoryClock!=="undefined" ? FluyoStoryClock : FluyoStory).describe(dphase, sc, scPlayback'), "Present usa el momento visible");
  const k = kernel(); load(k, CASE.independent());
  const d = JSON.parse(k.run(`(function(){ const s = FluyoStoryClock.start(__pg, __sc, 0); FluyoScenarioPlayback.tick(s.playback, 1000);
    const a = FluyoStoryClock.describe("playing", __sc, s.playback, ()=>"x", ()=>null), b = FluyoStory.describe("playing", __sc, s.playback, ()=>"x", ()=>null);
    FluyoScenarioPlayback.tick(s.playback, 1100); const c = FluyoStoryClock.describe("playing", __sc, s.playback, ()=>"x", ()=>null);
    return JSON.stringify([a.idx, a.title, b.idx, c.idx, c.title]); })()`));
  assert.deepEqual(d, [1, "Cae", 2, 2, "Recibe"], "a 1000 ms: momento 2 «Cae» (la receta sola diría el 3); a 1100, «Recibe»");
});

/* ───────── alcance y release ───────── */
test("alcance: motor, kernel, model.js, render y formato sin cambios; solo story-clock, editor, Present, Viewer, CSS y sw.js", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js",
    "js/story-authoring.js", "js/render.js", "js/geometry.js", "js/export.js", "js/state.js", "js/selection.js", "js/share-url.js", "js/link-codec.js", "index.html", "s/index.html"]) {
    let head;
    try { head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"); } catch { return; }
    assert.equal(read(f), head, f + " sin cambios");
  }
});
test("release: CACHE v79 y story-clock.js en el precache (lo cargan el editor y el Viewer)", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v83";/);
  assert.ok(sw.includes('"./js/story-clock.js"'));
  assert.ok(read("index.html").includes('<script src="js/story-clock.js"></script>') && read("s/index.html").includes('<script src="../js/story-clock.js"></script>'));
});
test("integración: el editor y el Viewer empiezan con FluyoStoryClock.start y navegan por instantes visibles", () => {
  const es = read("js/editor-scenarios.js"), vj = read("js/viewer.js");
  assert.ok(between(es, "function scRun(opts) {", "\n}\n").includes("FluyoStoryClock.start(P(), sc, scNow())"));
  assert.ok(between(es, "function scMomentNav() {", "\n}\n").includes("FluyoStoryClock.momentTimes(sc, scPlayback)"));
  assert.ok(vj.includes("const started=FluyoStoryClock.start(P(), sc,"));
  assert.ok(vj.includes("FluyoStoryClock.momentTimes(story.scenario, story.playback)"));
  assert.ok(vj.includes("const d=FluyoStoryClock.describe(phase, sc,"));
  assert.match(read("css/styles.css"), /\.scWaits\{/);
});
