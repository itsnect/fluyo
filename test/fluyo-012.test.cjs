"use strict";
/* FLUYO-012 — Historia manipulable, duración visual, overlays y cues.
   Lógica pura (sin DOM): node --test test/fluyo-012.test.cjs */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const json = (o) => JSON.parse(JSON.stringify(o));

function makeCtx() {
  const ctx = vm.createContext({
    console, Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError, RegExp, Date, String, Boolean,
    parseInt, isNaN, isFinite, Infinity, NaN, URL, window: {}, performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    run(code) { return vm.runInContext(code, ctx); },
  });
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js"])
    vm.runInContext(read(f), ctx);
  return ctx;
}
/* render.js sólo para sus funciones puras de layout; sus dependencias se resuelven en llamada. */
function makeRenderCtx() {
  const ctx = makeCtx();
  vm.runInContext(read("js/render.js"), ctx);
  return ctx;
}
const steps = (...xs) => xs.map(([id, at]) => ({ id, at, action: "OCCURRENCE", nodeId: 1 }));
const view = (ctx, name, ...args) => json(ctx.run(`${name}(${args.map((a) => JSON.stringify(a)).join(",")})`));
const flat = (r) => r.steps.map((s) => `${s.id}@${s.at}`).join(" ");

/* ───────── Reordenar: semántica compartida ───────── */

test("Mover antes/después: intercambio plano, los tiempos se quedan en sus ranuras", () => {
  const ctx = makeCtx();
  const r = view(ctx, "storyboardMoveByOne", steps([1, 0], [2, 1000], [3, 5000]), 3, -1);
  assert.equal(flat(r), "1@0 3@1000 2@5000");
  assert.equal(view(ctx, "storyboardMoveByOne", steps([1, 0]), 1, -1), null);
});

test("Drag a un hueco entre momentos == Mover antes/después repetido (ritmo conservado)", () => {
  const ctx = makeCtx();
  const base = steps([10, 0], [20, 1000], [30, 5000]);
  // arrastrar 30 al hueco 0 (antes de todo) = dos «Mover antes»
  const drag = view(ctx, "storyboardMoveStep", base, 30, { kind: "gap", index: 0 });
  let menu = view(ctx, "storyboardMoveByOne", base, 30, -1);
  menu = view(ctx, "storyboardMoveByOne", menu.steps, 30, -1);
  assert.equal(flat(drag), flat(menu));
  assert.equal(flat(drag), "30@0 10@1000 20@5000");
  assert.equal(drag.changed, true);
});

test("Drag al hueco adyacente es un no-op (changed=false)", () => {
  const ctx = makeCtx();
  const base = steps([1, 0], [2, 1000], [3, 2000]);
  assert.equal(view(ctx, "storyboardMoveStep", base, 2, { kind: "gap", index: 1 }).changed, false);
  assert.equal(view(ctx, "storyboardMoveStep", base, 2, { kind: "gap", index: 2 }).changed, false);
});

test("Drag de un momento único sobre simultáneos mueve el momento completo, sin romper grupos", () => {
  const ctx = makeCtx();
  const base = steps([1, 0], [2, 1000], [3, 1000], [4, 2000]);
  const r = view(ctx, "storyboardMoveStep", base, 4, { kind: "gap", index: 1 });
  assert.equal(flat(r), "1@0 4@1000 2@2000 3@2000");
});

test("Unirse a un momento: at = at del ancla, resto de tiempos intactos, grupo vacío desaparece", () => {
  const ctx = makeCtx();
  const base = steps([1, 0], [2, 1000], [3, 4000]);
  const r = view(ctx, "storyboardMoveStep", base, 3, { kind: "join", anchorId: 1, after: true });
  assert.equal(flat(r), "1@0 3@0 2@1000");
  const groups = view(ctx, "storyboardGroups", r.steps);
  assert.deepEqual(groups.map((g) => [g.at, g.steps.map((s) => s.id)]), [[0, [1, 3]], [1000, [2]]]);
  const gone = view(ctx, "storyboardMoveStep", base, 2, { kind: "join", anchorId: 3, after: false });
  assert.deepEqual(view(ctx, "storyboardGroups", gone.steps).map((g) => g.at), [0, 3000]); // la espera de 1 s de B se colapsa; C conserva su «3 s después»
});

test("Mismo momento: reordenar cambia el array, no el at; el desempate es el orden del array, no id/nombre", () => {
  const ctx = makeCtx();
  // ids engañosos: el id menor va DESPUÉS en el array
  const base = steps([9, 1000], [2, 1000], [5, 1000]);
  const r = view(ctx, "storyboardMoveStep", base, 5, { kind: "join", anchorId: 9, after: false });
  assert.equal(flat(r), "5@1000 9@1000 2@1000");
  assert.ok(r.steps.every((s) => s.at === 1000));
  // el motor consume ese orden (send_started/occurrence en orden de array)
  const sc = { id: 1, engineVersion: 2, name: "S", nextStepId: 10, steps: r.steps };
  const out = json(ctx.run(`FluyoScenarios.runScenario({nodes:[{id:1}],edges:[]},[],${JSON.stringify(sc)})`));
  assert.deepEqual(out.trace.events.map((e) => e.stepId), [5, 9, 2]);
});

test("Sacar un Step de un momento simultáneo a un hueco no está soportado (no se inventa tiempo)", () => {
  const ctx = makeCtx();
  const base = steps([1, 0], [2, 1000], [3, 1000]);
  assert.equal(view(ctx, "storyboardMoveStep", base, 2, { kind: "gap", index: 0 }), null);
  assert.equal(view(ctx, "storyboardMoveStep", base, 99, { kind: "gap", index: 0 }), null);
  assert.equal(view(ctx, "storyboardMoveStep", base, 2, { kind: "join", anchorId: 2, after: true }), null);
});

test("Multi-target: apariciones del mismo at siguen siendo Steps independientes", () => {
  const ctx = makeCtx();
  const base = [
    { id: 1, at: 0, action: "SEND", edgeId: 7 }, { id: 2, at: 0, action: "SEND", edgeId: 8 }, { id: 3, at: 500, action: "SEND", edgeId: 9 },
  ];
  const r = view(ctx, "storyboardMoveStep", base, 3, { kind: "join", anchorId: 1, after: false });
  assert.equal(flat(r), "3@0 1@0 2@0");
  assert.equal(r.steps.length, 3);
});

test("storyboardMoveStep no muta la entrada", () => {
  const ctx = makeCtx();
  ctx.run(`base=[{id:1,at:0,action:"OCCURRENCE",nodeId:1},{id:2,at:1000,action:"OCCURRENCE",nodeId:1}]; before=JSON.stringify(base); storyboardMoveStep(base,2,{kind:"gap",index:0});`);
  assert.equal(ctx.run("JSON.stringify(base)"), ctx.run("before"));
});

test("storyboardDropTarget: huecos, unirse y límites", () => {
  const ctx = makeCtx();
  // 3 momentos de una fila (alto 40); fuente = 3 (momento único)
  const rows = [1, 2, 3].map((id, i) => ({ stepId: id, groupIndex: i, groupSize: 1, indexInGroup: 0, top: i * 40, bottom: i * 40 + 40 }));
  const hit = (y, src = 3) => view(ctx, "storyboardDropTarget", rows, src, y, 3, 1);
  assert.deepEqual(hit(45).target, { kind: "gap", index: 1 });           // parte alta de la 2ª
  assert.deepEqual(hit(76).target, { kind: "gap", index: 2 });           // parte baja de la 2ª
  assert.deepEqual(hit(60).target, { kind: "join", anchorId: 2, after: false }); // centro → mismo tiempo
  assert.equal(hit(100, 3), null);                                       // sobre su propia fila
  // fuente en un momento simultáneo: los bordes no ofrecen huecos, sí unirse
  const r2 = view(ctx, "storyboardDropTarget", rows, 9, 41, 3, 2);
  assert.equal(r2.target.kind, "join");
});

/* ───────── Duración visual ───────── */

test("Presets de duración visual y defaults legacy", () => {
  const ctx = makeCtx();
  const ms = (fx) => json(ctx.run(`nodeEffectDurationMs(${JSON.stringify(fx)})`));
  assert.equal(ms({ visualDuration: "brief" }), 700);
  assert.equal(ms({ visualDuration: "normal" }), 1500);
  assert.equal(ms({ visualDuration: "long" }), 3000);
  assert.equal(ms({}), 1500, "legacy sin duración = Normal");
  assert.equal(ms(null), 1500);
  assert.equal(ms({ visualDuration: "banana" }), 1500);
});

test("Duración personalizada: 2.5 s exactos y límites 0.3–10 s", () => {
  const ctx = makeCtx();
  const p = (v) => json(ctx.run(`parseVisualDurationSeconds(${JSON.stringify(v)})`));
  assert.equal(p("2.5"), 2500);
  assert.equal(p("2,5"), 2500);
  assert.equal(p(0.3), 300);
  assert.equal(p(10), 10000);
  for (const bad of ["0", "-1", "abc", "", "99999", "0.1", null]) assert.equal(p(bad), null, String(bad));
  const n = (fx) => json(ctx.run(`normalizeNodeEffects(${JSON.stringify(fx)})`));
  assert.equal(n({ visualDuration: "custom", visualDurationMs: 2500 }).visualDurationMs, 2500);
  assert.equal(n({ visualDuration: "custom", visualDurationMs: 99999999 }).visualDurationMs, 10000);
  assert.equal(n({ visualDuration: "custom", visualDurationMs: 1 }).visualDurationMs, 300);
  const nan = n({ visualDuration: "custom", visualDurationMs: NaN });
  assert.equal(nan.visualDuration, "normal");
  assert.equal(n({ visualDuration: "custom", visualDurationMs: -5 }).visualDurationMs, 300);
  assert.equal(n({ visualDuration: "custom" }).visualDuration, "normal");
});

test("Un Evento guardado conserva visualDuration en presentation.nodeEffects (sin bump de schema)", () => {
  const ctx = makeCtx();
  ctx.run(`doc={eventTypes:[],nextEventTypeId:1,pages:[],cur:0}`);
  const et = json(ctx.run(`createEventType({name:"Caída",primitive:"OCCURRENCE",sentenceTemplate:"{target} cae",visual:{value:"⚠"},presentation:{nodeEffects:{showSymbol:true,message:"X",visualDuration:"custom",visualDurationMs:2500}}})`));
  assert.equal(et.presentation.nodeEffects.visualDuration, "custom");
  assert.equal(et.presentation.nodeEffects.visualDurationMs, 2500);
});

function buildScenario(ctx, extra = "") {
  ctx.run(`
    structure={nodes:[{id:1},{id:2},{id:3}],edges:[{id:4,from:1,to:2}]};
    behaviors=[];
    scn={id:1,engineVersion:2,name:"S",nextStepId:10,steps:[
      {id:1,at:0,action:"SET_STATE",nodeId:2,state:"DOWN"},
      {id:2,at:5000,action:"SEND",edgeId:4}${extra}
    ]};
    runT=()=>JSON.stringify(FluyoScenarios.runScenario(structure,behaviors,scn).trace);
  `);
}

test("La duración visual no cambia el Trace", () => {
  const ctx = makeCtx();
  buildScenario(ctx);
  const t1 = ctx.run("runT()");
  // Cambiar la presentación (stepMeta) no entra en el motor en absoluto
  const P = ctx.FluyoScenarioPlayback;
  const trace = json(ctx.run("FluyoScenarios.runScenario(structure,behaviors,scn).trace"));
  const meta = (d) => ({ 1: { nodeEffects: { ...json(ctx.run("defaultNodeEffects()")), visualDuration: d, visualDurationMs: d === "brief" ? 700 : 3000 } } });
  const a = P.makePlayback(trace, meta("brief")), b = P.makePlayback(trace, meta("long"));
  assert.deepEqual(json(a.trace), json(b.trace));
  assert.equal(ctx.run("runT()"), t1);
});

test("Playback: el cue dura lo configurado y el Trace no cambia", () => {
  const ctx = makeCtx();
  buildScenario(ctx);
  const P = ctx.FluyoScenarioPlayback;
  const trace = json(ctx.run("FluyoScenarios.runScenario(structure,behaviors,scn).trace"));
  const fx = (ms) => ({ ...json(ctx.run("defaultNodeEffects()")), showSymbol: true, message: "ENVIADO", visualDurationMs: ms });
  for (const [ms, expectGoneAt] of [[700, 720], [1500, 1520], [3000, 3020], [2500, 2520]]) {
    const pb = P.makePlayback(trace, { 1: { token: "📦", nodeEffects: fx(ms) } });
    pb.startedAtReal = 0;
    assert.equal(P.tick(pb, 10).activeNodeEffects.length, 1);
    assert.equal(P.tick(pb, ms - 10).activeNodeEffects.length, 1, ms + " aún visible");
    assert.equal(P.tick(pb, expectGoneAt).activeNodeEffects.length, 0, ms + " ya no");
  }
});

test("Envolvente: fade in/out breve, alpha 1 en el medio, sin salto de un frame", () => {
  const ctx = makeCtx();
  const E = ctx.FluyoScenarioPlayback.cueEnvelope;
  assert.equal(E(0, 1500).alpha, 0);
  assert.ok(E(70, 1500).alpha > 0 && E(70, 1500).alpha < 1);
  assert.equal(E(700, 1500).alpha, 1);
  assert.ok(E(1450, 1500).alpha < 0.3);
  assert.equal(E(1500, 1500).alpha, 0);
  // un cue breve conserva una zona plena
  assert.equal(E(350, 700).alpha, 1);
});

test("Consecuencia funcional persiste aunque el visual ya haya terminado", () => {
  const ctx = makeCtx();
  buildScenario(ctx);
  const P = ctx.FluyoScenarioPlayback;
  const trace = json(ctx.run("FluyoScenarios.runScenario(structure,behaviors,scn).trace"));
  // SEND posterior (t=5000) falla porque el nodo 2 sigue DOWN (visual de 700 ms terminó en t=700)
  assert.ok(trace.events.some((e) => e.type === "send_failed" && e.reason === "target_down"));
  const fx = { ...json(ctx.run("defaultNodeEffects()")), showSymbol: true, visualDurationMs: 700 };
  const pb = P.makePlayback(trace, { 1: { token: "⚠", nodeEffects: fx } });
  pb.startedAtReal = 0;
  assert.equal(P.tick(pb, 800).activeNodeEffects.length, 0);
  assert.equal(P.tick(pb, 800).nodeStates[2], "DOWN", "estado funcional intacto");
  const last = P.tick(pb, 5200);
  assert.equal(last.nodeStates[2], "DOWN");
});

test("Cues solapados del mismo nodo: identidad y duración propias, sin estado compartido", () => {
  const ctx = makeCtx();
  const P = ctx.FluyoScenarioPlayback;
  const trace = { engineVersion: 2, scenarioId: 1, events: [
    { at: 0, type: "event_occurred", stepId: 1, nodeId: 3 },
    { at: 500, type: "event_occurred", stepId: 2, nodeId: 3 },
  ] };
  const base = json(ctx.run("defaultNodeEffects()"));
  const meta = {
    1: { token: "📦", nodeEffects: { ...base, showSymbol: true, visualDurationMs: 3000 } },
    2: { token: "✓", nodeEffects: { ...base, message: "OK", visualDurationMs: 700 } },
  };
  const pb = P.makePlayback(trace, meta);
  pb.startedAtReal = 0;
  let rs = P.tick(pb, 600);
  assert.deepEqual(json(rs.activeNodeEffects.map((c) => c.stepId)), [1, 2]);
  assert.notEqual(rs.activeNodeEffects[0].effects, rs.activeNodeEffects[1].effects);
  rs = P.tick(pb, 1300); // el 2º (500→1200) terminó; el 1º sigue
  assert.deepEqual(json(rs.activeNodeEffects.map((c) => c.stepId)), [1]);
  assert.equal(rs.activeNodeEffects[0].effects.message, "");
});

test("Reset: un playback nuevo no hereda cues del anterior", () => {
  const ctx = makeCtx();
  const P = ctx.FluyoScenarioPlayback;
  const trace = { engineVersion: 2, scenarioId: 1, events: [{ at: 0, type: "event_occurred", stepId: 1, nodeId: 3 }] };
  const fx = { ...json(ctx.run("defaultNodeEffects()")), showSymbol: true, visualDurationMs: 10000 };
  const a = P.makePlayback(trace, { 1: { token: "📦", nodeEffects: fx } });
  a.startedAtReal = 0;
  assert.equal(P.tick(a, 100).activeNodeEffects.length, 1);
  const b = P.makePlayback(trace, { 1: { token: "📦", nodeEffects: fx } });
  assert.equal(b.activeNodeEffects.length, 0);
  assert.equal(b.completedNodeEffects.length, 0);
});

test("Éxito/fallo: sólo cue breve en ventana fija (TERMINAL_MS), luego Canvas limpio", () => {
  const ctx = makeCtx();
  const P = ctx.FluyoScenarioPlayback;
  const trace = { engineVersion: 2, scenarioId: 1, events: [
    { at: 0, type: "send_started", stepId: 1, edgeId: 4 }, { at: 0, type: "send_succeeded", stepId: 1, edgeId: 4 },
    { at: 0, type: "send_started", stepId: 2, edgeId: 4 }, { at: 0, type: "send_failed", stepId: 2, edgeId: 4, reason: "target_down" },
  ] };
  const pb = P.makePlayback(trace, { 1: { motion: "fast" }, 2: { motion: "fast" } });
  pb.startedAtReal = 0;
  let rs = P.tick(pb, 100);
  assert.deepEqual(json(rs.activeSends.map((s) => s.terminalType)), ["send_succeeded", "send_failed"]);
  rs = P.tick(pb, 600);
  assert.equal(rs.completedSends.length, 2);
  assert.ok(rs.completedSends.every((s) => s.ageMs < s.cueMs && s.cueMs === P.TERMINAL_MS));
  rs = P.tick(pb, 500 + P.TERMINAL_MS + 50);
  assert.equal(rs.completedSends.length, 0);
  assert.equal(rs.activeSends.length, 0);
  assert.equal(rs.finished, true);
});

/* ───────── Layout de overlays ───────── */

const NODE = { x: 400, y: 300, w: 140, h: 60 };
const measure = (t, font) => t.length * (/(\d+)px/.exec(font)?.[1] ?? 14) * 0.5;
const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function layout(ctx, fx, token = "📦", node = NODE) {
  ctx.fx = { ...json(ctx.run("defaultNodeEffects()")), showSymbol: true, message: "Pago recibido", ...fx };
  ctx.node = node; ctx.token = token; ctx.measure = measure;
  return json(ctx.run("computeNodeCueLayout(node, fx, token, measure)"));
}

test("Símbolo + mensaje arriba: compuestos juntos, sin superponerse y sobre el nodo", () => {
  const ctx = makeRenderCtx();
  const l = layout(ctx, { messagePosition: "above" });
  const sym = { x: l.symbol.x - l.symbol.size / 2, y: l.symbol.y - l.symbol.size / 2, w: l.symbol.size, h: l.symbol.size };
  assert.ok(!rectsOverlap(sym, l.message));
  assert.ok(l.message.y + l.message.h <= sym.y, "el mensaje queda sobre el símbolo");
  assert.ok(sym.y + sym.h <= NODE.y - NODE.h / 2, "el símbolo queda sobre el nodo");
});

test("Posiciones above/center/below producen geometrías distintas", () => {
  const ctx = makeRenderCtx();
  const ys = ["above", "center", "below"].map((p) => layout(ctx, { messagePosition: p }).message.y);
  assert.equal(new Set(ys).size, 3);
  const below = layout(ctx, { messagePosition: "below" }).message;
  assert.ok(below.y >= NODE.y + NODE.h / 2);
  const center = layout(ctx, { messagePosition: "center" }).message;
  assert.ok(Math.abs(center.y + center.h / 2 - NODE.y) < 1);
  assert.ok(center.w <= NODE.w, "el mensaje central no excede el nodo");
});

test("Mensaje largo: wrap con ancho máximo y sigue pegado al nodo", () => {
  const ctx = makeRenderCtx();
  const l = layout(ctx, { message: "Revisión manual requerida antes de continuar", messageSize: "large", messagePosition: "above" });
  assert.ok(l.message.lines.length >= 2);
  assert.ok(l.message.w <= 260);
  assert.ok(l.message.y + l.message.h <= NODE.y - NODE.h / 2);
  const small = layout(ctx, { message: "Revisión manual requerida antes de continuar", messageSize: "small", messagePosition: "center" });
  assert.ok(small.message.w <= NODE.w);
});

test("Sin símbolo visible no se reserva hueco; sin mensaje no hay mensaje", () => {
  const ctx = makeRenderCtx();
  const a = layout(ctx, { showSymbol: false });
  assert.equal(a.symbol, null);
  const b = layout(ctx, { message: "" });
  assert.equal(b.message, null);
  assert.ok(b.symbol);
});

test("Cues solapados del mismo nodo se apilan: el más reciente pegado al nodo, sin solaparse", () => {
  const ctx = makeRenderCtx();
  const base = json(ctx.run("defaultNodeEffects()"));
  ctx.cues = [
    { fx: { ...base, showSymbol: true, message: "Pago recibido" }, token: "💵", alpha: 1, enter: 1 },
    { fx: { ...base, showSymbol: true, message: "Error" }, token: "⚠", alpha: 1, enter: 1 },
    { fx: { ...base, highlight: true }, token: "", alpha: 1, enter: 1 },
  ];
  const stack = json(ctx.run("nodeTextCues(cues)"));
  assert.deepEqual(stack.map((q) => q.fx.message), ["Error", "Pago recibido"], "más reciente primero; el cue sólo-highlight no entra");
  ctx.node = NODE; ctx.measure = measure;
  const l1 = json(ctx.run("computeNodeCueLayout(node, cues[1].fx, cues[1].token, measure, {above:0,below:0})"));
  const l0 = json(ctx.run("computeNodeCueLayout(node, cues[0].fx, cues[0].token, measure, " + JSON.stringify(l1.extent) + ")"));
  assert.ok(l0.message.y + l0.message.h <= l1.message.y, "el anterior queda por encima del reciente");
  assert.ok(l0.extent.above > l1.extent.above);
});

test("Composición: máximo 3 cues apilados y un solo mensaje centrado (el más reciente)", () => {
  const ctx = makeRenderCtx();
  const base = json(ctx.run("defaultNodeEffects()"));
  ctx.cues = [1, 2, 3, 4].map((i) => ({ fx: { ...base, message: "M" + i }, token: "", alpha: 1, enter: 1 }));
  assert.deepEqual(json(ctx.run("nodeTextCues(cues)")).map((q) => q.fx.message), ["M4", "M3", "M2"]);
  ctx.cues = [
    { fx: { ...base, message: "viejo", messagePosition: "center" }, token: "", alpha: 1, enter: 1 },
    { fx: { ...base, message: "nuevo", messagePosition: "center" }, token: "", alpha: 1, enter: 1 },
  ];
  assert.deepEqual(json(ctx.run("nodeTextCues(cues)")).map((q) => q.fx.message), ["nuevo"]);
  ctx.cues = [{ fx: { ...base, highlight: true }, token: "", alpha: 1, enter: 1 }];
  assert.equal(json(ctx.run("nodeTextCues(cues)")).length, 0);
});

test("render.js: sin badges permanentes ni mutación del documento en overlays", () => {
  const src = read("js/render.js");
  const overlay = src.slice(src.indexOf("function drawScenarioNodeOverlay"), src.indexOf("function drawNode("));
  assert.ok(!/n\.(fill|label|font|opacity)\s*=[^=]/.test(overlay), "overlay no escribe en el nodo");
  assert.ok(!/✓|✕/.test(src.slice(src.indexOf("function drawScenarioEdgeOverlay"), src.indexOf("function drawEdge("))), "sin glifos de badge en el Canvas");
});

test("«¿Cuánto tiempo se ve?»: lenguaje humano, sin ms ni «duración visual», con ayuda de presentación", () => {
  const html = read("index.html");
  const app = html.slice(html.indexOf('id="scAppearance"'), html.indexOf('id="scBehavior"'));
  for (const v of ["brief", "normal", "long", "custom"]) assert.ok(app.includes(`name="scVisDur" value="${v}"`));
  assert.ok(app.includes("¿Cuánto tiempo se ve?"));
  for (const t of ["Poco tiempo", "Mucho tiempo", "Personalizado"]) assert.ok(app.includes(t), t);
  assert.ok(app.includes("Esto solo cambia cómo se muestra. No cambia cuándo ocurre."));
  assert.ok(!/Duración visual|milisegundos|ms/i.test(app), "sin lenguaje técnico");
  assert.ok(app.includes('id="scDurationSeconds"') && app.includes('min="0.3"') && app.includes('max="10"'));
});

const waits = (ctx, list) => json(ctx.run(`storyboardGroups(${JSON.stringify(list)})`)).map((g, i, a) => g.at - (i ? a[i - 1].at : 0));

test("Historia: las esperas se conservan como ritmo al reordenar (A·1 s·B·3 s·C)", () => {
  const ctx = makeCtx();
  const base = steps([1, 0], [2, 1000], [3, 4000]);
  assert.deepEqual(waits(ctx, base), [0, 1000, 3000]);
  const r = view(ctx, "storyboardMoveStep", base, 3, { kind: "gap", index: 1 });
  assert.deepEqual(r.steps.map((s) => s.id), [1, 3, 2]);
  assert.deepEqual(waits(ctx, r.steps), [0, 1000, 3000], "el ritmo de la historia no cambia");
});

test("Historia: al unir un momento a otro, las demás esperas no cambian", () => {
  const ctx = makeCtx();
  // A·1 s·B·2 s·C·5 s·D ; B se une a A → C sigue «2 s después» de A, D «5 s después» de C
  const base = steps([1, 0], [2, 1000], [3, 3000], [4, 8000]);
  const r = view(ctx, "storyboardMoveStep", base, 2, { kind: "join", anchorId: 1, after: true });
  assert.deepEqual(waits(ctx, r.steps), [0, 2000, 5000]);
  // B se une a D (más adelante): C conserva su espera y B aparece con D
  const r2 = view(ctx, "storyboardMoveStep", base, 2, { kind: "join", anchorId: 4, after: false });
  assert.deepEqual(waits(ctx, r2.steps), [0, 2000, 5000]);
  assert.equal(r2.steps.find((s) => s.id === 2).at, r2.steps.find((s) => s.id === 4).at);
});

test("Historia: un documento anterior sin nada nuevo se sigue leyendo igual", () => {
  const ctx = makeCtx();
  const legacy = { showIcon: true, message: "Pago recibido" };
  const fx = json(ctx.run(`normalizeNodeEffects(${JSON.stringify(legacy)})`));
  assert.equal(fx.showSymbol, true);
  assert.equal(fx.visualDuration, "normal");
  assert.equal(fx.message, "Pago recibido");
});

test("Tres historias no técnicas (negocio, sistema, proceso humano) corren y dan el mismo Trace que sus tiempos", () => {
  const ctx = makeCtx();
  const structure = { nodes: [{ id: 1 }, { id: 2 }, { id: 3 }], edges: [{ id: 4, from: 1, to: 2 }, { id: 5, from: 2, to: 3 }] };
  for (const [a, b] of [[0, 1000], [0, 2000], [0, 500]]) {
    const sc = { id: 1, engineVersion: 2, name: "H", nextStepId: 9, steps: [
      { id: 1, at: a, action: "SEND", edgeId: 4 }, { id: 2, at: b, action: "SEND", edgeId: 5 }, { id: 3, at: b + 1000, action: "OCCURRENCE", nodeId: 3 } ] };
    const out = json(ctx.run(`FluyoScenarios.runScenario(${JSON.stringify(structure)},[],${JSON.stringify(sc)})`));
    assert.equal(out.ok, true);
    assert.equal(out.trace.events.filter((e) => e.type === "send_succeeded").length, 2);
  }
});

test("Lenguaje: Historia y registro evitan «Éxito/Falló/event_occurred» y usan palabras humanas", () => {
  const src = read("js/editor-scenarios.js");
  for (const bad of ['"Éxito"', '"Falló"', "  event_occurred", '"Origen caído"', "No pudo realizarse"]) assert.ok(!src.includes(bad), bad);
  for (const good of ["No se completó", '"Llegó"', "Origen no disponible"]) assert.ok(src.includes(good), good);
});

test("Aparición como objeto: pulsarla abre un menú agrupado (Editar este evento / Usar otro aquí / Duplicar / Mover ▸ / Eliminar)", () => {
  const src = read("js/editor-scenarios.js");
  const menu = src.slice(src.indexOf("function scStoryMenu"), src.indexOf("function scDuplicateStep"));
  for (const label of ["Editar este evento…", "Usar otro evento aquí…", "Cambiar dónde ocurre…", '"Duplicar"', '"Eliminar"']) assert.ok(menu.includes(label), label);
  const row = src.slice(src.indexOf("function scStoryRow"), src.indexOf("function scNormText"));
  assert.ok(row.includes("scStoryMenu(step, again)"));
});
