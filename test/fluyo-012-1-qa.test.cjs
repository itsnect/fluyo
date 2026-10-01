"use strict";
/* FLUYO-012.1 — QA final de producto y semántica de Historia.
   Reproduce con el editor real (DOM falso + undo real) la semántica temporal:
   reordenar, mover antes/después, simultaneidad, eliminar, duplicar, undo/redo,
   serialización, y la coherencia Historia = timestamps = Trace.
   node --test test/fluyo-012-1-qa.test.cjs */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const json = (o) => JSON.parse(JSON.stringify(o));

/* Reutiliza el DOM falso y la fábrica de contexto de la suite de FLUYO-011 (misma fuente de
   verdad; no se duplican 200 líneas). Falla en voz alta si esa suite cambia de forma. */
const src011 = read("test/fluyo-011-final-fixes.test.cjs");
const from = src011.indexOf("function makeFakeElement");
const to = src011.indexOf("/* ─────────────────────────── G1.");
assert.ok(from >= 0 && to > from, "no se encontró el harness de FLUYO-011");
const harness = new Function("read", "vm", "json", src011.slice(from, to) + "\nreturn {makeScenarioUIContext, buildExample, setupPanel, ensureUI};")(read, vm, json);

function setup() {
  const { ctx, register } = harness.makeScenarioUIContext();
  harness.buildExample(ctx, { source: "Cliente", target: "Comercio" });
  harness.setupPanel(ctx, register);
  harness.ensureUI(ctx);
  ctx.innerWidth = 1200; ctx.innerHeight = 800;
  ctx.run(`
    const evt = createEventType({name:"Aparece",primitive:"OCCURRENCE",sentenceTemplate:"{target} ocurre",visual:{value:"⭐"}});
    sc = createScenario(P(), "Historia"); scActiveId = sc.id;
    mk = (name, at) => createStep(sc, {at, action:"OCCURRENCE", nodeId:nodeId, eventTypeId:evt.id, _n:name});
  `);
  return ctx;
}
/* Pasos con nombre: se guardan en un mapa aparte (el schema de Step no admite claves extra). */
function build(ctx, spec) {
  ctx.run(`names = {}; sc.steps = []; sc.nextStepId = 1; undoStack = []; redoStack = [];`);
  for (const [name, at] of spec) {
    ctx.run(`{ const s = createStep(sc, {at:${at}, action:"OCCURRENCE", nodeId:nodeId, eventTypeId:evt.id}); names[${JSON.stringify(name)}] = s.id; }`);
  }
  ctx.run(`scRenderStoryboard();`);
  return json(ctx.run("names"));
}
const nameOf = (ids) => (id) => Object.keys(ids).find((k) => ids[k] === id);
/* Historia tal como la ve la persona: [«2 s después», [A]], … */
function story(ctx, ids) {
  const n = nameOf(ids);
  return json(ctx.run("scGroups().map(g => ({at:g.at, ids:g.steps.map(s => s.id)}))")).map((g, i, all) => ({
    wait: g.at - (all[i - 1]?.at || 0),
    at: g.at,
    names: g.ids.map(n),
  }));
}
const rhythm = (st) => st.map((g) => (g.names.length > 1 ? "{" + g.names.join("+") + "}" : g.names[0]) + "@" + g.at).join(" ");
function snapshot(ctx) {
  return json({
    steps: ctx.run("scActiveScenario().steps"),
    ordered: ctx.run("scOrderedSteps().map(s => s.id)"),
    nextStepId: ctx.run("scActiveScenario().nextStepId"),
    scenarios: ctx.run("P().scenarios"),
  });
}
/* Invariante central: Historia visual = timestamps = Trace = Playback. */
function assertStoryEqualsEngine(ctx, ids) {
  const ordered = json(ctx.run("scOrderedSteps().map(s => ({id:s.id, at:s.at}))"));
  const res = json(ctx.run(`FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},P().behaviors||[],scActiveScenario())`));
  assert.equal(res.ok, true);
  // un SEND emite varios eventos (send_started/…): se cuenta cada Step una vez, en su primera aparición
  const first = [];
  for (const e of res.trace.events) if (!first.some((x) => x.stepId === e.stepId)) first.push(e);
  assert.deepEqual(first.map((e) => e.stepId), ordered.map((s) => s.id), "el Trace ejecuta lo que la Historia muestra");
  assert.deepEqual(first.map((e) => e.at), ordered.map((s) => s.at), "los timestamps del Trace son los de la Historia");
  // lo que pinta el DOM (filas y esperas) coincide con lo mismo
  ctx.run("scStorySignature=''; scRenderStoryboard();");
  const rows = ctx.document.querySelectorAll(".scStoryRow").map((r) => Number(r.dataset.stepId));
  assert.deepEqual(rows, ordered.map((s) => s.id), "las filas del DOM siguen el orden del motor");
  const delays = ctx.document.querySelectorAll(".scDelay").map((b) => b.textContent);
  const groups = json(ctx.run("scGroups().map(g => g.at)"));
  assert.equal(delays.length, groups.length);
  groups.forEach((at, i) => {
    const prev = groups[i - 1] || 0;
    const label = at === 0 ? "Al comenzar" : json(ctx.run(`formatRelativeDelay(${at - prev})`));
    assert.equal(delays[i], label);
  });
  // Playback: procesa los eventos del Trace en el mismo orden y no deja ninguno
  const played = json(ctx.run(`(() => { const tr = FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},[],scActiveScenario()).trace; const pb = FluyoScenarioPlayback.makePlayback(tr, {}); for (let t = 0; t <= 80000; t += 50) FluyoScenarioPlayback.tick(pb, t); return {done: pb.nextEventIndex, total: tr.events.length}; })()`));
  assert.equal(played.done, played.total, "Playback consume todo el Trace");
}

/* ───────────── 2–3. Caso temporal base ───────────── */

test("A·2 s·B·5 s·C: el Scenario interno es t=0 / 2000 / 7000 y la Historia se lee igual", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  const st = story(ctx, ids);
  assert.deepEqual(st.map((g) => [g.names[0], g.wait, g.at]), [["A", 0, 0], ["B", 2000, 2000], ["C", 5000, 7000]]);
  assertStoryEqualsEngine(ctx, ids);
  const delays = ctx.document.querySelectorAll(".scDelay").map((b) => b.textContent);
  assert.deepEqual(delays, ["Al comenzar", "2 s después", "5 s después"]);
});

/* ───────────── 4–5. Reorder temporal ───────────── */

test("Mover C antes de B: A·2 s·C·5 s·B (el ritmo se queda en los huecos) y el motor ejecuta lo mismo", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  assert.equal(ctx.run(`scMoveStep(${ids.C}, -1)`), true);
  const st = story(ctx, ids);
  assert.equal(rhythm(st), "A@0 C@2000 B@7000");
  assert.deepEqual(st.map((g) => g.wait), [0, 2000, 5000]);
  assertStoryEqualsEngine(ctx, ids);
});

test("Mover A después de C: B·2 s·C·5 s·A — el arranque y las esperas son de los huecos, no de las tarjetas", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  ctx.run(`scMoveStep(${ids.A}, 1)`); // A pasa tras B
  ctx.run(`scMoveStep(${ids.A}, 1)`); // y tras C
  const st = story(ctx, ids);
  assert.equal(rhythm(st), "B@0 C@2000 A@7000");
  assert.deepEqual(st.map((g) => g.wait), [0, 2000, 5000]);
  assertStoryEqualsEngine(ctx, ids);
});

test("Arrastrar C al hueco anterior a B == Mover antes (menú y drag comparten una capa de modelo)", () => {
  const a = setup(), b = setup();
  const ia = build(a, [["A", 0], ["B", 2000], ["C", 7000]]);
  const ib = build(b, [["A", 0], ["B", 2000], ["C", 7000]]);
  a.run(`scMoveStep(${ia.C}, -1)`);
  assert.equal(b.run(`scMoveStepTo(${ib.C}, {kind:"gap", index:1})`), true);
  assert.equal(rhythm(story(a, ia)), rhythm(story(b, ib)));
});

/* ───────────── 6. Simultaneidad ───────────── */

test("A·2 s·{B+C}·5 s·D: reordenar dentro del grupo conserva el mismo `at`; el array decide el orden, no el id", () => {
  const ctx = setup();
  // ids engañosos: creados en orden 100, 1, 50 → forzamos ids no monótonos
  ctx.run(`names = {}; sc.steps = []; undoStack = []; redoStack = [];
    const mkId = (name, id, at) => { sc.steps.push({id, at, action:"OCCURRENCE", nodeId, eventTypeId:evt.id}); names[name] = id; };
    mkId("A", 7, 0); mkId("B", 100, 2000); mkId("C", 1, 2000); mkId("X", 50, 2000); mkId("D", 3, 7000); sc.nextStepId = 101;`);
  const ids = json(ctx.run("names"));
  assert.equal(rhythm(story(ctx, ids)), "A@0 {B+C+X}@2000 D@7000");
  // mover X antes de B dentro del grupo
  assert.equal(ctx.run(`scMoveStepTo(${ids.X}, {kind:"join", anchorId:${ids.B}, after:false})`), true);
  const st = story(ctx, ids);
  assert.equal(rhythm(st), "A@0 {X+B+C}@2000 D@7000");
  const at = ctx.run("sc.steps.filter(s => [100,1,50].includes(s.id)).map(s => s.at)");
  assert.deepEqual(json(at), [2000, 2000, 2000]);
  assertStoryEqualsEngine(ctx, ids);
  // el motor ejecuta 50, 100, 1 (orden del array), NO 1, 50, 100 (orden de id)
  const trace = json(ctx.run(`FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},[],sc).trace.events.map(e => e.stepId)`));
  assert.deepEqual(trace, [7, 50, 100, 1, 3]);
});

/* ───────────── 7. Sacar de simultaneidad ───────────── */

test("Sacar B de {B+C} a un hueco no se soporta por drag (no inventa tiempo); Mover antes/después sí lo logra", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 1000], ["C", 1000], ["D", 4000]]);
  const before = snapshot(ctx);
  assert.equal(ctx.run(`scMoveStepTo(${ids.B}, {kind:"gap", index:0})`), false);
  assert.equal(ctx.run(`scMoveStepTo(${ids.B}, {kind:"gap", index:3})`), false);
  assert.deepEqual(snapshot(ctx), before, "sin cambios ni undo");
  assert.equal(ctx.run("undoStack.length"), 0);
  // Vía válida con las reglas actuales: C pasa tras D (ranura de D) → {B} ... y C se separa sin inventar tiempo
  ctx.run(`scMoveStep(${ids.C}, 1)`);
  assert.equal(rhythm(story(ctx, ids)), "A@0 {B+D}@1000 C@4000");
  assertStoryEqualsEngine(ctx, ids);
});

/* ───────────── 8. Eliminar un momento ───────────── */

test("Eliminar B en A·3 s·B·4 s·C: la espera de B se colapsa → A·4 s·C (no «7 s»)", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 3000], ["C", 7000]]);
  ctx.run(`scDeleteStep(${ids.B})`);
  const st = story(ctx, ids);
  assert.equal(rhythm(st), "A@0 C@4000");
  assert.deepEqual(st.map((g) => g.wait), [0, 4000], "C conserva SU espera (4 s), no la suma 3+4");
  assertStoryEqualsEngine(ctx, ids);
});

test("Eliminar el primer momento: el siguiente pasa a ser el arranque; eliminar un miembro de un grupo no mueve nada", () => {
  const ctx = setup();
  let ids = build(ctx, [["A", 0], ["B", 3000], ["C", 7000]]);
  ctx.run(`scDeleteStep(${ids.A})`);
  assert.equal(rhythm(story(ctx, ids)), "B@0 C@4000");
  ids = build(ctx, [["A", 0], ["B", 3000], ["C", 3000], ["D", 7000]]);
  ctx.run(`scDeleteStep(${ids.C})`);
  assert.equal(rhythm(story(ctx, ids)), "A@0 B@3000 D@7000");
  assertStoryEqualsEngine(ctx, ids);
});

test("Eliminar el último momento no altera nada más; el arranque no nulo se conserva", () => {
  const ctx = setup();
  let ids = build(ctx, [["A", 0], ["B", 3000], ["C", 7000]]);
  ctx.run(`scDeleteStep(${ids.C})`);
  assert.equal(rhythm(story(ctx, ids)), "A@0 B@3000");
  ids = build(ctx, [["A", 500], ["B", 3500], ["C", 7500]]);
  ctx.run(`scDeleteStep(${ids.A})`);
  assert.equal(rhythm(story(ctx, ids)), "B@500 C@4500", "el arranque de la historia (500 ms) se conserva");
});

/* ───────────── 11–13. Duplicar ───────────── */

test("Duplicar: la copia entra en el mismo momento justo después del original; sin espera inventada ni desplazamientos", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  ctx.run(`scDuplicateStep(${ids.B})`);
  const steps = json(ctx.run("scOrderedSteps()"));
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map((s) => s.at), [0, 2000, 2000, 7000], "mismo at; C intacto");
  assert.equal(steps[1].id, ids.B);
  assert.notEqual(steps[2].id, ids.B);
  assert.equal(steps[2].eventTypeId, steps[1].eventTypeId);
  assert.equal(ctx.run("scSelectedStep"), steps[2].id);
  const src = read("js/editor-scenarios.js");
  const dup = src.slice(src.indexOf("function scDuplicateStep"), src.indexOf("function scEditTime"));
  assert.ok(!/DEFAULT_STEP_DELAY/.test(dup), "Duplicar no esconde un 1 s en el código");
  assert.equal(ctx.run("scGroups().length"), 3);
  assertStoryEqualsEngine(ctx, ids);
});

test("Duplicar un miembro de un grupo simultáneo lo deja justo debajo, dentro del grupo", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 1000], ["C", 1000]]);
  ctx.run(`scDuplicateStep(${ids.B})`);
  const g = json(ctx.run("scGroups().map(g => g.steps.map(s => s.id))"));
  assert.equal(g[1].length, 3);
  assert.equal(g[1][0], ids.B);
  assert.equal(g[1][2], ids.C);
});

test("Duplicar respeta el máximo de eventos y no crea undo si no hace nada", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0]]);
  ctx.run(`for (let i = sc.steps.length; i < FluyoScenarios.MAX_SCENARIO_STEPS; i++) sc.steps.push({id: 1000 + i, at: 0, action:"OCCURRENCE", nodeId, eventTypeId: evt.id}); sc.nextStepId = 5000;`);
  const n = ctx.run("sc.steps.length");
  ctx.run("undoStack = []");
  ctx.run(`scDuplicateStep(${ids.A})`);
  assert.equal(ctx.run("sc.steps.length"), n);
  assert.equal(ctx.run("undoStack.length"), 0);
});

/* ───────────── 9. Undo / Redo exacto para TODAS las operaciones ───────────── */

const OPS = {
  "drag (hueco)": (ids) => `scMoveStepTo(${ids.C}, {kind:"gap", index:1})`,
  "mover antes": (ids) => `scMoveStep(${ids.C}, -1)`,
  "mover después": (ids) => `scMoveStep(${ids.A}, 1)`,
  "unirse a un momento": (ids) => `scMoveStepTo(${ids.C}, {kind:"join", anchorId:${ids.A}, after:true})`,
  "eliminar": (ids) => `scDeleteStep(${ids.B})`,
  "duplicar": (ids) => `scDuplicateStep(${ids.B})`,
  "cambiar espera": (ids) => `scSetStepDelay(${ids.B}, 500)`,
};
for (const [label, op] of Object.entries(OPS)) {
  test(`Undo/Redo exacto — ${label}`, () => {
    const ctx = setup();
    const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
    const before = snapshot(ctx);
    ctx.run(op(ids));
    const after = snapshot(ctx);
    assert.notDeepEqual(after.steps, before.steps, "la operación cambió algo");
    assert.equal(ctx.run("undoStack.length"), 1, "una operación = un undo");
    ctx.run("undo()");
    const undone = snapshot(ctx);
    assert.deepEqual(undone.steps, before.steps, "steps (order, at, ids) exactos");
    assert.deepEqual(undone.ordered, before.ordered);
    // Contador de ids: nunca baja (decisión vigente); sólo puede quedar >= al anterior.
    assert.ok(undone.nextStepId >= before.nextStepId);
    if (label !== "duplicar") assert.equal(undone.nextStepId, before.nextStepId, "sin ids nuevos el contador no cambia");
    ctx.run("redo()");
    const redone = snapshot(ctx);
    assert.deepEqual(redone.steps, after.steps, "redo restaura exactamente el estado posterior");
    assert.deepEqual(redone.ordered, after.ordered);
    assert.equal(redone.nextStepId, after.nextStepId);
    assertStoryEqualsEngine(ctx, ids);
  });
}

/* ───────────── 10. Guardar / importar / deep link / Share ───────────── */

test("Tras manipular la Historia: guardar → importar → deep link → copia editable conservan Historia = at = Trace", async () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  ctx.run(`scMoveStep(${ids.C}, -1); scDuplicateStep(${ids.A}); scDeleteStep(${ids.B});`);
  const expectedSteps = json(ctx.run("scOrderedSteps().map(s => ({id:s.id, at:s.at, eventTypeId:s.eventTypeId, nodeId:s.nodeId}))"));
  const traceOf = (c) => json(c.run(`FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},P().behaviors||[],P().scenarios[0]).trace.events`));
  const original = traceOf(ctx);
  // 1) guardar → importar
  const saved = json(ctx.run("serializeProject()"));
  const text = JSON.stringify(saved);
  const loaded = json(ctx.run(`projectFromProjectData(${JSON.stringify(text)}.length ? JSON.parse(${JSON.stringify(text)}) : null).doc.pages[0].scenarios[0].steps`));
  const order = (steps) => json(steps).map((s, i) => ({ s, i })).sort((a, b) => a.s.at - b.s.at || a.i - b.i).map((x) => ({ id: x.s.id, at: x.s.at, eventTypeId: x.s.eventTypeId, nodeId: x.s.nodeId }));
  assert.deepEqual(order(loaded), expectedSteps);
  // 2) deep link / Share (codec real, deflate)
  ctx.CompressionStream = CompressionStream;
  ctx.DecompressionStream = DecompressionStream;
  ctx.Response = Response; ctx.Blob = Blob; ctx.ReadableStream = ReadableStream;
  ctx.Uint8Array = Uint8Array;
  vm.runInContext(read("js/link-codec.js"), ctx);
  const payload = await ctx.encodeDeepLink(saved);
  const decoded = json(await ctx.decodeDeepLink(payload));
  assert.deepEqual(order(decoded.doc.pages[0].scenarios[0].steps), expectedSteps, "el deep link conserva orden y tiempos");
  // 3) copia editable: cargar el decodificado en un editor nuevo y comparar el Trace
  const ctx2 = setup();
  ctx2.run(`doc = projectFromProjectData(${JSON.stringify(decoded)}).doc; sc = P().scenarios[0]; scActiveId = sc.id;`);
  assert.deepEqual(traceOf(ctx2).map((e) => [e.stepId, e.at, e.type]), original.map((e) => [e.stepId, e.at, e.type]));
  assert.deepEqual(json(ctx2.run("scGroups().map(g => g.at)")), json(ctx.run("scGroups().map(g => g.at)")));
});

/* ───────────── 26. Playback: Historia de sólo lectura ───────────── */

test("Playback: reordenar, duplicar, eliminar y mover por menú quedan deshabilitados; no hay handle ni menú", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  const before = snapshot(ctx);
  ctx.run("isScenarioPlaybackActive = () => true");
  for (const op of [`scMoveStep(${ids.C}, -1)`, `scMoveStepTo(${ids.C}, {kind:"gap", index:0})`, `scDuplicateStep(${ids.B})`, `scDeleteStep(${ids.B})`, `scSetStepDelay(${ids.B}, 100)`])
    ctx.run(op);
  assert.deepEqual(snapshot(ctx), before);
  assert.equal(ctx.run("undoStack.length"), 0);
  ctx.run("scStorySignature=''; scRenderStoryboard();");
  assert.equal(ctx.document.querySelectorAll(".scHandle").length, 0, "sin handle de arrastre");
  assert.equal(ctx.document.querySelectorAll(".scMore").length, 0, "sin botón de menú");
  assert.ok(ctx.document.querySelectorAll(".scDelay").every((b) => b.disabled), "esperas bloqueadas");
});

/* ───────────── 14–19. Menú de una aparición ───────────── */

function openMenu(ctx, stepId) {
  const anchor = ctx.document.createElement("button");
  ctx.run(`scStoryMenu(sc.steps.find(s => s.id === ${stepId}), ${"document.createElement('button')"})`);
  void anchor;
  return ctx.document.getElementById("scPopover");
}
function menuLabels(pop) {
  return pop.children.filter((c) => c.tagName === "BUTTON").map((b) => b._text);
}
function withPopover(ctx) {
  const pop = ctx.document.createElement("div");
  pop.id = "scPopover"; ctx.document.body.appendChild(pop);
  ctx.document._registry.set("scPopover", pop);
  return pop;
}

test("El menú de una aparición es corto y agrupado: 1 cabecera, 4 secciones, submenús Mover/Añadir; nada de jerga", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  const pop = withPopover(ctx);
  openMenu(ctx, ids.B);
  const top = menuLabels(pop);
  assert.deepEqual(top, ["Editar este evento…", "Usar otro evento aquí…", "Cambiar dónde ocurre…", "Duplicar", "Mover", "Añadir al mismo tiempo", "Eliminar"]);
  assert.ok(top.length <= 7, "no más de 7 filas en el primer nivel");
  assert.equal(pop.children.filter((c) => c.className === "scMenuSep").length, 3, "4 secciones");
  assert.ok(pop.children.some((c) => c.className === "scMenuHead" && /Aparece/.test(c._text)), "cabecera con el evento");
  const text = pop.children.map((c) => c.textContent).join(" | ");
  for (const jerga of [/\bnode\b/i, /\bedge\b/i, /\bsource\b/i, /\btarget\b/i, /OCCURRENCE|SET_STATE|\bSEND\b/, /\bms\b/, /\bstep\b/i, /EventType/i])
    assert.ok(!jerga.test(text), "sin jerga: " + jerga);
});

test("Editar ≠ Usar otro: textos y efectos distintos (global vs sólo esta aparición)", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  const pop = withPopover(ctx);
  openMenu(ctx, ids.B);
  const buttons = pop.children.filter((c) => c.tagName === "BUTTON");
  const edit = buttons.find((b) => b._text === "Editar este evento…"), other = buttons.find((b) => b._text === "Usar otro evento aquí…");
  assert.match(edit.children.find((c) => c.className === "scMenuHint")._text, /en sus 3 usos/, "avisa del alcance global");
  assert.match(other.children.find((c) => c.className === "scMenuHint")._text, /Sólo cambia esta aparición/);
  // «Usar otro evento aquí» sólo cambia ESTA aparición
  ctx.run(`et2 = createEventType({name:"Otro",primitive:"OCCURRENCE",sentenceTemplate:"{target} otro",visual:{value:"🔔"}});`);
  other.onclick();
  const choice = pop.children.filter((c) => c.tagName === "BUTTON").find((b) => b._text === "Otro");
  choice.onclick();
  assert.equal(ctx.run(`sc.steps.find(s => s.id === ${ids.B}).eventTypeId === et2.id`), true);
  assert.equal(ctx.run(`sc.steps.filter(s => s.eventTypeId === evt.id).length`), 2, "las otras apariciones siguen con el Evento original");
  assert.equal(ctx.run("eventTypeById(evt.id).name"), "Aparece", "la biblioteca no cambió");
});

test("Mover ▸ ofrece Antes / Después / Al mismo tiempo que…, con los extremos deshabilitados; coincide con el drag", () => {
  const ctx = setup();
  const ids = build(ctx, [["A", 0], ["B", 2000], ["C", 7000]]);
  const pop = withPopover(ctx);
  openMenu(ctx, ids.A);
  pop.children.find((c) => c.tagName === "BUTTON" && c._text === "Mover").onclick();
  const sub = pop.children.filter((c) => c.tagName === "BUTTON");
  assert.deepEqual(sub.map((b) => b._text), ["‹ Volver", "Antes", "Después", "Al mismo tiempo que…"]);
  assert.equal(sub.find((b) => b._text === "Antes").disabled, true, "A es la primera");
  assert.equal(sub.find((b) => b._text === "Después").disabled, false);
  // «Al mismo tiempo que…» lista las otras apariciones y usa la misma operación que el drop «unirse»
  sub.find((b) => b._text === "Al mismo tiempo que…").onclick();
  const targets = pop.children.filter((c) => c.tagName === "BUTTON").map((b) => b._text);
  assert.equal(targets.length, 1 + 2, "Volver + B + C");
  pop.children.filter((c) => c.tagName === "BUTTON")[2].onclick(); // C
  const st = story(ctx, ids);
  assert.equal(rhythm(st), "B@0 {C+A}@5000", "A se une al momento de C; su espera (2 s) se colapsa y B→C conserva sus 5 s");
});

test("Cambiar dónde ocurre muestra el dónde actual (Cliente → Comercio) y es una entrada distinta de Usar otro evento", () => {
  const ctx = setup();
  ctx.run(`flow = createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
    st1 = createStep(sc, {at:0, action:"SEND", edgeId:edgeId, eventTypeId:flow.id});`);
  const pop = withPopover(ctx);
  ctx.run(`scStoryMenu(st1, document.createElement('button'))`);
  const where = pop.children.filter((c) => c.tagName === "BUTTON").find((b) => b._text === "Cambiar dónde ocurre…");
  assert.match(where.children.find((c) => c.className === "scMenuHint")._text, /Cliente → Comercio/);
  const labels = menuLabels(pop);
  assert.notEqual(labels.indexOf("Cambiar dónde ocurre…"), labels.indexOf("Usar otro evento aquí…"));
  const head = pop.children.find((c) => c.className === "scMenuHead")._text;
  assert.match(head, /💵 Pago/);
  assert.match(pop.children.find((c) => c.className === "scMenuSub")._text, /Cliente paga a Comercio/);
  // Una conexión añade «Esta misma acción en otras conexiones…» en el submenú Añadir
  pop.children.find((c) => c._text === "Añadir al mismo tiempo").onclick();
  assert.deepEqual(menuLabels(pop), ["‹ Volver", "Otro evento…", "Esta misma acción en otras conexiones…"]);
});

test("Drag handle: sólo el handle inicia el arrastre (la card no es draggable) y existe equivalente por teclado", () => {
  const src = read("js/editor-scenarios.js");
  const row = src.slice(src.indexOf("function scStoryRow"), src.indexOf("function scNormText"));
  assert.ok(/handle\.onpointerdown/.test(row));
  assert.ok(!/row\.onpointerdown|row\.draggable|setAttribute\("draggable"/.test(row), "la fila no es draggable");
  assert.ok(/Alt/.test(row));
});

/* ───────────── 20–21. Neutralidad: tres historias, mismo modelo, sin jerga ───────────── */

const NEUTRAL_BANNED = [/\bsource\b/, /\btarget\b/, /\bSEND\b/, /SET_STATE/, /\bUP\b/, /\bDOWN\b/, /\bsuccess\b/, /\bfailure\b/, /\bnode\b/, /\bedge\b/, /target_down|source_down/];

function humanStory(ctx, texts) {
  const rows = ctx.document.querySelectorAll(".scStoryRow").map((r) => r.textContent);
  const all = rows.join("\n") + "\n" + ctx.document.querySelectorAll(".scDelay").map((b) => b.textContent).join("\n");
  for (const re of NEUTRAL_BANNED) assert.ok(!re.test(all), `jerga ${re} en:\n${all}`);
  for (const t of texts) assert.ok(all.includes(t), `falta «${t}» en:\n${all}`);
}
function threeNodes(ctx, a, b, c) {
  ctx.run(`
    P().nodes.length = 0; P().edges.length = 0; P().behaviors = []; P().scenarios = []; P().nextId = 1; P().nextScenarioId = 1; doc.eventTypes = []; doc.nextEventTypeId = 1;
    NN = [${[a, b, c].map((l) => JSON.stringify(l)).join(",")}].map((label, i) => { const n = {id:P().nextId++, shape:"rect", x:i*200, y:0, label}; P().nodes.push(n); return n; });
    EE = [[0,1],[1,2]].map(([x,y]) => { const e = {id:P().nextId++, from:NN[x].id, to:NN[y].id}; P().edges.push(e); return e; });
    sc = createScenario(P(), "Historia"); scActiveId = sc.id; undoStack=[]; redoStack=[];
  `);
}

test("Historia A (negocio): Cliente paga → Comercio envía → Cliente recibe, en lenguaje de negocio", () => {
  const ctx = setup();
  threeNodes(ctx, "Cliente", "Comercio", "Banco");
  ctx.run(`
    pago = createEventType({name:"Realiza pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
    envio = createEventType({name:"Envía producto",primitive:"FLOW",sentenceTemplate:"{source} envía producto a {target}",visual:{value:"📦"}});
    recibe = createEventType({name:"Recibe producto",primitive:"OCCURRENCE",sentenceTemplate:"{target} recibe su producto",visual:{value:"⭐"},presentation:{nodeEffects:{showSymbol:true,message:"¡Pedido recibido!"}}});
    createStep(sc,{at:0,action:"SEND",edgeId:EE[0].id,eventTypeId:pago.id});
    createStep(sc,{at:2000,action:"SEND",edgeId:EE[1].id,eventTypeId:envio.id});
    createStep(sc,{at:5000,action:"OCCURRENCE",nodeId:NN[0].id,eventTypeId:recibe.id});
    scRenderStoryboard();`);
  humanStory(ctx, ["Realiza pago", "Cliente paga a Comercio", "Envía producto", "Recibe producto", "2 s después", "3 s después"]);
  assert.equal(json(ctx.run("FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},[],sc).ok")), true);
});

test("Historia B (sistema): Producer → Kafka → Consumer con Kafka caído; el motivo se dice en humano", () => {
  const ctx = setup();
  threeNodes(ctx, "Producer", "Kafka", "Consumer");
  ctx.run(`
    publica = createEventType({name:"Producer publica",primitive:"FLOW",sentenceTemplate:"{source} publica en {target}",visual:{value:"📨"}});
    cae = createEventType({name:"Kafka deja de responder",primitive:"SET_AVAILABILITY",availability:"DOWN",sentenceTemplate:"{target} deja de responder",visual:{value:"⚠"}});
    createStep(sc,{at:0,action:"SET_STATE",nodeId:NN[1].id,state:"DOWN",eventTypeId:cae.id});
    createStep(sc,{at:1000,action:"SEND",edgeId:EE[0].id,eventTypeId:publica.id});
    scRenderStoryboard();`);
  humanStory(ctx, ["Kafka deja de responder", "Producer publica", "Kafka"]);
  // El resultado negativo se describe sin códigos
  const res = json(ctx.run("FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},[],sc)"));
  assert.equal(res.trace.events.some((e) => /send_failed/.test(e.type)), true);
  const src = read("js/editor-scenarios.js");
  assert.ok(src.includes("no está disponible") || src.includes("Destino no disponible") || src.includes("X no está disponible") || /no está disponible/.test(src));
  assert.ok(!/target_down/.test(src.split("\n").filter((l) => /textContent|scEl\(|detail/.test(l)).join("\n").replace(/reason\s*===?\s*["']target_down["']/g, "")), "los códigos no se pintan tal cual");
});

test("Historia C (proceso humano): Empleado → Jefe → RRHH sin vocabulario de software", () => {
  const ctx = setup();
  threeNodes(ctx, "Empleado", "Jefe", "RRHH");
  ctx.run(`
    pide = createEventType({name:"Solicita permiso",primitive:"FLOW",sentenceTemplate:"{source} solicita permiso a {target}",visual:{value:"📝"}});
    aprueba = createEventType({name:"Aprueba solicitud",primitive:"OCCURRENCE",sentenceTemplate:"{target} aprueba la solicitud",visual:{value:"👍"}});
    actualiza = createEventType({name:"Actualiza registro",primitive:"FLOW",sentenceTemplate:"{source} actualiza el registro en {target}",visual:{value:"🗂️"}});
    createStep(sc,{at:0,action:"SEND",edgeId:EE[0].id,eventTypeId:pide.id});
    createStep(sc,{at:3000,action:"OCCURRENCE",nodeId:NN[1].id,eventTypeId:aprueba.id});
    createStep(sc,{at:6000,action:"SEND",edgeId:EE[1].id,eventTypeId:actualiza.id});
    scRenderStoryboard();`);
  humanStory(ctx, ["Solicita permiso", "Empleado solicita permiso a Jefe", "Aprueba solicitud", "Actualiza registro", "3 s después"]);
  assertStoryEqualsEngine(ctx, json(ctx.run("({})")));
});

/* ───────────── 23. Consecuencia funcional ───────────── */

test("Un mensaje visual breve no depende de la duración: Kafka sigue DOWN y un SEND posterior sigue fallando", () => {
  const ctx = setup();
  threeNodes(ctx, "Producer", "Kafka", "Consumer");
  const run = (ms) => {
    ctx.run(`
      sc.steps = [];
      cae = createEventType({name:"Kafka se cae ${ms}",primitive:"SET_AVAILABILITY",availability:"DOWN",sentenceTemplate:"{target} no responde",visual:{value:"⚠"},
        presentation:{nodeEffects:{showSymbol:true,message:"⚠ Kafka no responde",visualDuration:"custom",visualDurationMs:${ms}}}});
      createStep(sc,{at:0,action:"SET_STATE",nodeId:NN[1].id,state:"DOWN",eventTypeId:cae.id});
      createStep(sc,{at:600000-590000+${ms},action:"SEND",edgeId:EE[0].id});`);
    return json(ctx.run("FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},[],sc)"));
  };
  const short = run(700), long = run(10000);
  const sig = (r) => r.trace.events.map((e) => [e.type, e.nodeId, e.edgeId, e.reason].join(":"));
  const kinds = (r) => r.trace.events.map((e) => e.type + (e.reason ? ":" + e.reason : ""));
  assert.deepEqual(kinds(short), kinds(long), "el Trace no depende de la duración visual");
  assert.ok(kinds(short).some((k) => /send_failed:target_down/.test(k)), "el SEND posterior sigue fallando: " + kinds(short));
  void sig;
});
