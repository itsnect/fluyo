"use strict";
/* FLUYO-018.22 — Dependencias de llegada en el MCP (lado Fluyo). Rápido (vm, sin navegador).
   · la REGLA de validez y la forma canónica viven en model.js (kernel, la copia fluyo-mcp); story-clock.js la reexporta y sigue
     fuera del kernel;
   · FluyoAuthoring (kernel del MCP) crea la cadena A→B→C y Fluyo la reproduce 0 → 1100 → 1600 → 2700 (y 0 → 500 → 1100);
   · el editor sigue usando las mismas funciones al eliminar y duplicar; duplicar copia solo lo válido;
   · CACHE v80. El contrato completo (validación, remove/duplicate, describe, mutaciones) está en fluyo-mcp/test/fluyo-018-22.test.ts.
   Uso: node --test test/fluyo-018-22.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];

function ctx(files) {
  const c = vm.createContext({ TextEncoder, TextDecoder, atob, btoa });
  for (const f of files) vm.runInContext(read("js/" + f), c, { filename: f });
  return (code, arg) => { c.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(vm.runInContext(`JSON.stringify((function(){ const __a = JSON.parse(__in); ${code} })())`, c)); };
}
const BLANK = { version: 5, app: "fluyo", settings: {}, doc: { theme: "dark", customBg: "", cur: 0, nextEventTypeId: 1, eventTypes: [],
  pages: [{ name: "Llegadas", nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 }] } };
const P = (op, extra) => Object.assign({ op, scope: "page", pageIndex: 0 }, extra);
const S = (op, extra) => Object.assign({ op, scope: "story", pageIndex: 0, storyId: 1 }, extra);
const DIAGRAM = [
  P("create_node", { ref: "A", spec: { shape: "rect", x: 200, y: 300, label: "A" } }), P("create_node", { ref: "B", spec: { shape: "rect", x: 500, y: 300, label: "B" } }),
  P("create_node", { ref: "C", spec: { shape: "rect", x: 800, y: 300, label: "C" } }), P("create_node", { ref: "X", spec: { shape: "rect", x: 500, y: 520, label: "X" } }),
  P("create_connection", { source: { ref: "A" }, target: { ref: "B" } }), P("create_connection", { source: { ref: "B" }, target: { ref: "C" } }),
  { op: "create_event_type", scope: "eventType", name: "Petición", primitive: "FLOW", sentence: "{source} envía a {target}", motion: "normal" },
  { op: "create_event_type", scope: "eventType", name: "Recibe", primitive: "OCCURRENCE", sentence: "{target} recibe" },
  { op: "create_event_type", scope: "eventType", name: "Cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentence: "{target} cae" },
  { op: "create_story", scope: "story", pageIndex: 0, name: "Historia" },
];
const add = (eventTypeId, target, extra) => S("add_step", Object.assign({ eventTypeId, target, waitMs: 500 }, extra));
/* Lo que haría el MCP: FluyoAuthoring.apply del kernel. */
function author(ops) {
  const r = ctx(KERNEL)("return FluyoAuthoring.apply(__a.p, __a.o);", { p: BLANK, o: DIAGRAM.concat(ops) });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.project;
}
/* Lo que se ve en Fluyo: el Playback real a 1 ms con el reloj de la Historia (story-clock.js). */
function play(project) {
  return ctx(["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js"])(
    `doc = projectFromProjectData(__a).doc; const pg = doc.pages[0], sc = pg.scenarios[0];
     const st = FluyoStoryClock.start(pg, sc, 0), shown = {};
     for (let t = 0; t <= 20000; t++) { const rs = FluyoScenarioPlayback.tick(st.playback, t); for (const e of rs.logEvents) if (shown[e.stepId] === undefined) shown[e.stepId] = t; if (rs.finished) break; }
     return storyboardGroups(sc.steps).map(g => shown[g.steps[0].id]);`, project);
}

test("integración: la cadena creada por FluyoAuthoring se ve 0 → 1100 → 1600 → 2700; lo independiente 0 → 500 → 1100", () => {
  const chain = author([add(1, { edgeId: 5 }, { ref: "m1" }), add(2, { nodeId: 2 }, { waitsForArrivalOf: [{ ref: "m1" }] }), add(1, { edgeId: 6 }, { ref: "m3" }), add(2, { nodeId: 3 }, { waitsForArrivalOf: [{ ref: "m3" }] })]);
  const sc = chain.doc.pages[0].scenarios[0];
  assert.deepEqual(sc.arrivalDependencies, [{ stepId: 2, waitsForArrivalOf: [1] }, { stepId: 4, waitsForArrivalOf: [3] }]);
  assert.ok(sc.steps.every((s) => !("waitsForArrivalOf" in s)), "nunca en el Step");
  assert.deepEqual(play(chain), [0, 1100, 1600, 2700]);
  const indep = author([add(1, { edgeId: 5 }, { ref: "a" }), add(3, { nodeId: 4 }), add(2, { nodeId: 2 }, { waitsForArrivalOf: [{ ref: "a" }] })]);
  assert.deepEqual(play(indep), [0, 500, 1100]);
});

test("kernel: la regla está en model.js; story-clock.js la reexporta (mismas funciones) y no entra en el kernel", () => {
  const k = ctx(["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js"]);
  assert.equal(k(`return ["arrivalDependencies","arrivalCandidates","pruneArrivalDependencies","withArrivalWait","withoutArrivalWaits","copyArrivalWaits"].every(n => FluyoStoryClock[n] === globalThis[n])
    && FluyoStoryClock.stepWaits === arrivalStepWaits && FluyoStoryClock.momentWaits === arrivalMomentWaits;`), true);
  assert.doesNotMatch(read("js/story-clock.js"), /function arrivalDependencies|function arrivalCandidates|function canonical/, "una sola implementación");
  const sync = path.join(root, "..", "fluyo-mcp", "scripts", "sync-kernel.ts");
  if (fs.existsSync(sync)) {
    const list = fs.readFileSync(sync, "utf8");
    assert.ok(list.includes('"model.js"') && list.includes('"story-authoring.js"') && !list.includes('"story-clock.js"'));
  }
});

test("editor: eliminar y duplicar siguen usando prune / copy; duplicar copia solo lo válido; el original no se redirige", () => {
  const es = read("js/editor-scenarios.js");
  assert.ok(es.includes("scSetArrivalDependencies(sc, FluyoStoryClock.pruneArrivalDependencies(sc));"));
  assert.ok(es.includes("scSetArrivalDependencies(sc, FluyoStoryClock.copyArrivalWaits(sc, id, copy.id));"));
  const k = ctx(["config.js", "safe-svg.js", "model.js"]);
  const sc = { steps: [{ id: 1, at: 0, action: "SEND" }, { id: 2, at: 500, action: "OCCURRENCE" }, { id: 3, at: 1000, action: "SEND" }, { id: 4, at: 500, action: "OCCURRENCE" }],
    arrivalDependencies: [{ stepId: 2, waitsForArrivalOf: [1, 3] }] };
  assert.deepEqual(k("return copyArrivalWaits(__a, 2, 4);", sc), [{ stepId: 2, waitsForArrivalOf: [1, 3] }, { stepId: 4, waitsForArrivalOf: [1] }]);
  const send = { steps: sc.steps.concat([{ id: 5, at: 0, action: "SEND" }]), arrivalDependencies: [{ stepId: 2, waitsForArrivalOf: [1] }] };
  assert.deepEqual(k("return copyArrivalWaits(__a, 1, 5);", send), [{ stepId: 2, waitsForArrivalOf: [1] }], "duplicar el envío no redirige nada");
  assert.deepEqual(k("return withArrivalWaits(__a, 2, []);", send), null, "[] = sin dependencias, sin campo");
});

test("release: CACHE v80; model.js y story-clock.js precacheados; el editor y el Viewer cargan model.js antes de story-clock.js", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v105";/);
  assert.ok(sw.includes('"./js/model.js"') && sw.includes('"./js/story-clock.js"'));
  for (const [f, pre] of [["index.html", "js/"], ["s/index.html", "../js/"]]) {
    const html = read(f);
    assert.ok(html.indexOf(`<script src="${pre}model.js">`) < html.indexOf(`<script src="${pre}story-clock.js">`), f);
  }
});
