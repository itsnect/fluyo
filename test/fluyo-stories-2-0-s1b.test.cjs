"use strict";
/* FLUYO-STORIES-2.0 S1b · Fallar — tests de unidad (vm, sobre el editor de Historias real).
   «Falla aquí» convierte un envío en un fallo real del motor (el destino cae en un momento propio justo antes); «Duplicar como
   fallo» copia la Historia y deja elegir dónde falla; el desenlace («Termina bien» / «Falla en el paso N») sale de una sola
   función (FluyoStoryClock.outcome) para el editor, Present y el Viewer. Undo de una acción; es/en; nada más cambia. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { makeScenarioUIContext, setupPanel, ensureUI, read } = require("./fluyo-016-harness.cjs");
const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "a7af856";

/* Cliente → Tienda → Pagos, a zoom 1: la Historia se cuenta tocando (S1a), como la contaría el usuario. */
function boot(lang) {
  const { ctx, register } = makeScenarioUIContext();
  setupPanel(ctx, register);
  if (lang) { vm.runInContext(read("js/i18n-en.js"), ctx); vm.runInContext(read("js/i18n-en-editor.js"), ctx); ctx.run(`FluyoI18n.setLocale(${JSON.stringify(lang)})`); }
  ctx.run(`
    var uiMode = "story", presenting = false, viewZoom = 1, viewX = 0, viewY = 0, __now = 1000;
    performance = { now: () => __now };
    var cv = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }) };
    doc = { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0,
      pages: [{ name: "P", nextId: 6, behaviors: [], scenarios: [], nextScenarioId: 1,
        nodes: [{ id: 1, shape: "rect", x: 100, y: 100, w: 100, h: 40, label: "Cliente" }, { id: 2, shape: "rect", x: 400, y: 100, w: 100, h: 40, label: "Tienda" },
                { id: 3, shape: "rect", x: 700, y: 100, w: 100, h: 40, label: "Pagos" }],
        edges: [{ id: 4, from: 1, to: 2 }, { id: 5, from: 2, to: 3 }] }] };
    undoStack = []; redoStack = [];
    var __in = (n, x, y) => Math.abs(x - n.x) <= n.w / 2 && Math.abs(y - n.y) <= n.h / 2;
    hitLeafNode = (x, y) => P().nodes.find((n) => n.shape !== "container" && __in(n, x, y)) || null;
    hitNode = (x, y) => P().nodes.find((n) => __in(n, x, y)) || null;
    edgePoints = (e) => { const a = nodeById(e.from), b = nodeById(e.to); return [{ x: a.x + a.w / 2, y: a.y }, { x: b.x - b.w / 2, y: b.y }]; };
    clearSel = () => { selN.clear(); selE.clear(); };
    scScrollIntoView = () => {};
  `);
  ensureUI(ctx);
  /* el popover de los menús (como en fluyo-012-1-qa) */
  const pop = ctx.document.createElement("div");
  pop.id = "scPopover"; pop.hidden = true; ctx.document.body.appendChild(pop);
  ctx.document._registry.set("scPopover", pop);
  ctx.innerWidth = 1200; ctx.innerHeight = 800;
  return ctx;
}
const J = (ctx, js) => JSON.parse(ctx.run(`JSON.stringify(${js})`));
const steps = (ctx) => J(ctx, "(scActiveScenario() || { steps: [] }).steps");
const tap = (ctx, x, y) => ctx.run(`__now += 1000; scTapPointerDown({ pointerId: 1, clientX: ${x}, clientY: ${y}, button: 0 }); scTapPointerUp({ pointerId: 1, clientX: ${x}, clientY: ${y}, button: 0 }); scInlineStep = null;`);
/* A → B → C contada con dos toques: Cliente → Tienda (paso 1) y Tienda → Pagos (paso 2) */
function story(lang) {
  const ctx = boot(lang);
  tap(ctx, 300, 100); tap(ctx, 600, 100);
  ctx.run("undoStack.length = 0; redoStack.length = 0;");
  return ctx;
}
const shape = (s) => s.map((x) => [x.at, x.action, x.edgeId || x.nodeId, x.state || "", x.message || ""]);
const outcome = (ctx) => J(ctx, "FluyoStoryClock.outcome(scActiveScenario(), FluyoStory.run(P(), scActiveScenario()).trace)");
const boardOutcome = (ctx) => ctx.run(`(() => { scStorySignature = ""; scRenderStoryboard(); const o = $("scStoryboard").children.find((c) => /scOutcome/.test(c.className)); return o ? o.className + " | " + o.textContent : ""; })()`);
const noCounter = (o) => JSON.stringify(o).replace(/"nextStepId":\d+/g, "");
function menu(ctx, js) {
  ctx.run(js);
  const p = ctx.run(`$("scPopover")`);
  return p.children.filter((c) => c.tagName === "BUTTON").map((b) => ({ label: b._text, hint: (b.children.find((c) => c.className === "scMenuHint") || {})._text || "", disabled: !!b.disabled, click: () => b.onclick() }));
}

test("F1 · «Falla aquí» en el paso 1: el destino cae en un momento propio justo antes del envío, con su frase, en UNA entrada de Undo", () => {
  const ctx = story();
  assert.equal(ctx.run("scFailHere(1)"), true);
  assert.deepEqual(shape(steps(ctx)), [[0, "SET_STATE", 2, "DOWN", "Tienda no responde"], [1000, "SEND", 4, "", ""], [2000, "SEND", 5, "", ""]],
    "DOWN de Tienda → envío Cliente → Tienda → envío Tienda → Pagos");
  const down = steps(ctx)[0];
  assert.equal(down.eventTypeId, undefined, "el paso de caída no lleva evento");
  ctx.run(`validatePersistedStep(${JSON.stringify(down)}, 2)`);
  assert.equal(ctx.run("undoStack.length"), 1, "una sola entrada de Undo");
  assert.equal(ctx.run("scSelectedStep"), down.id, "queda seleccionado el paso nuevo");
  assert.equal(ctx.run("doc.eventTypes.length"), 1, "no crea ningún evento");
});

test("F2 · es un fallo del MOTOR: el envío termina en target_down, lo que depende de Tienda también falla, y el desenlace es «Falla en el paso 2»", () => {
  const ctx = story();
  assert.deepEqual(outcome(ctx), { ok: true });
  assert.equal(boardOutcome(ctx), "scOutcome ok | Termina bien");
  ctx.run("scFailHere(1)");
  const out = J(ctx, "FluyoStory.outcomes(FluyoStory.run(P(), scActiveScenario()).trace, scActiveScenario(), P())").map((o) => [o.action, o.status, o.reason || "", o.reasonNodeId || ""]);
  assert.deepEqual(out, [["SET_STATE", "state_changed", "", ""], ["SEND", "not_completed", "target_down", 2], ["SEND", "not_completed", "source_down", 2]]);
  assert.deepEqual(outcome(ctx), { ok: false, moment: 2, stepId: 1 });
  assert.equal(boardOutcome(ctx), "scOutcome failed | Falla en el paso 2");
  assert.equal(ctx.run(`FluyoStoryClock.outcomeText(FluyoStoryClock.outcome(scActiveScenario(), FluyoStory.run(P(), scActiveScenario()).trace), FluyoI18n.t)`), "Falla en el paso 2");
});

test("F3 · en el paso 2 (en medio): la caída entra justo antes; el primer envío sigue completándose y N es el momento del envío", () => {
  const ctx = story();
  ctx.run("scFailHere(2)");
  assert.deepEqual(shape(steps(ctx)), [[0, "SEND", 4, "", ""], [1000, "SET_STATE", 3, "DOWN", "Pagos no responde"], [2000, "SEND", 5, "", ""]]);
  assert.deepEqual(outcome(ctx), { ok: false, moment: 3, stepId: 2 });
});

test("F4 · respeta el sentido: en un envío invertido (Tienda → Cliente) cae Cliente, el destino del recorrido", () => {
  const ctx = story();
  ctx.run("setStepReverse(scActiveScenario(), 1, true)");
  ctx.run("scFailHere(1)");
  assert.deepEqual(shape(steps(ctx))[0], [0, "SET_STATE", 1, "DOWN", "Cliente no responde"]);
  assert.deepEqual(outcome(ctx), { ok: false, moment: 2, stepId: 1 });
});

test("F5 · Undo devuelve la Historia EXACTA (salvo el contador nextStepId, que nunca baja) y Redo rehace el fallo entero", () => {
  const ctx = story();
  const before = J(ctx, "P()");
  ctx.run("scFailHere(1)");
  const failed = J(ctx, "P()");
  ctx.run("undo()");
  assert.equal(noCounter(J(ctx, "P()")), noCounter(before), "un Undo: la página tal cual");
  assert.equal(ctx.run("undoStack.length"), 0);
  ctx.run("redo()");
  assert.equal(JSON.stringify(J(ctx, "P()")), JSON.stringify(failed), "un Redo: el fallo entero");
});

test("F6 · con momentos simultáneos y esperas de llegada: los demás momentos conservan orden y espera, y la dependencia sigue valiendo", () => {
  const ctx = boot();
  ctx.run(`const et = createEventType(eventTypeDefinition({ name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", symbol: "📨", connectionEffects: defaultConnectionEffects() }));
    const sc = createScenario(P(), "Compra"); scSelectStory(sc.id);
    createStep(sc, stepDefinitionForEvent(et, 4, 0)); createStep(sc, stepDefinitionForEvent(et, 4, 0)); createStep(sc, stepDefinitionForEvent(et, 5, 1500));
    sc.arrivalDependencies = [{ stepId: 3, waitsForArrivalOf: [1] }];`);
  ctx.run("undoStack.length = 0");
  ctx.run("scFailHere(3)");
  const s = steps(ctx);
  assert.deepEqual(shape(s), [[0, "SEND", 4, "", ""], [0, "SEND", 4, "", ""], [1500, "SET_STATE", 3, "DOWN", "Pagos no responde"], [2500, "SEND", 5, "", ""]],
    "la caída toma la ranura del envío y el envío la siguiente (la del paso nuevo): nada antes se mueve");
  assert.deepEqual(J(ctx, "FluyoStoryClock.arrivalDependencies(scActiveScenario()).ignored"), [], "la espera de llegada no se invalida");
  assert.deepEqual(outcome(ctx), { ok: false, moment: 3, stepId: 3 });
  assert.equal(ctx.run("undoStack.length"), 1);
});

test("F7 · el menú del paso: «Falla aquí» es la primera acción de un envío, dice quién cae, y no aparece en un elemento", () => {
  const ctx = story();
  const items = menu(ctx, "scStoryMenu(scActiveScenario().steps[0], document.createElement('button'))");
  assert.equal(items[0].label, "Falla aquí");
  assert.equal(items[0].hint, "Tienda no responde justo antes");
  assert.equal(items[0].disabled, false);
  items[0].click();
  assert.equal(steps(ctx)[0].state, "DOWN", "elegirla hace el fallo");
  assert.equal(ctx.run("undoStack.length"), 1);
  /* un envío que ya no se completa (Tienda → Pagos sale de Tienda caída) no lo ofrece; un paso de elemento, tampoco */
  const again = menu(ctx, "scStoryMenu(scActiveScenario().steps.find((x) => x.id === 2), document.createElement('button'))");
  assert.deepEqual([again[0].label, again[0].disabled, again[0].hint], ["Falla aquí", true, "Este envío ya no se completa"]);
  assert.equal(ctx.run("scFailHere(2)"), false);
  assert.equal(ctx.run("undoStack.length"), 1, "ni una entrada más");
  const onNode = menu(ctx, "scStoryMenu(scActiveScenario().steps[0], document.createElement('button'))");
  assert.ok(!onNode.some((i) => i.label === "Falla aquí"), "la caída (SET_STATE) no ofrece «Falla aquí»");
});

test("F8 · no se hace nada fuera de edición: reproduciendo, sin Historia o con un objetivo que ya no existe", () => {
  const ctx = story();
  ctx.run(`var __play = isScenarioPlaybackActive; isScenarioPlaybackActive = () => true`);
  assert.equal(ctx.run("scFailHere(1)"), false);
  ctx.run(`isScenarioPlaybackActive = __play`);
  ctx.run("P().edges = P().edges.filter((e) => e.id !== 4)");
  assert.equal(ctx.run("scFailHere(1)"), false, "conexión borrada");
  assert.equal(ctx.run("undoStack.length"), 0);
  assert.equal(steps(ctx).length, 2);
});

test("D1 · «Duplicar como fallo»: la original no cambia; la copia «— falla» entra con una entrada de Undo y abre «¿Dónde falla?»", () => {
  const ctx = story();
  ctx.run("scRenameScenario('Compra'); undoStack.length = 0;");
  const original = J(ctx, "P().scenarios[0]");
  const items = menu(ctx, "scScenarioMenu(document.createElement('button'))");
  const dup = items.find((i) => i.label === "Duplicar como fallo");
  assert.ok(dup && !dup.disabled, "en el menú de la Historia");
  dup.click();
  assert.equal(ctx.run("P().scenarios.length"), 2);
  assert.equal(ctx.run("scActiveScenario().name"), "Compra — falla");
  assert.equal(ctx.run("undoStack.length"), 1, "duplicar: una entrada, como siempre");
  assert.equal(ctx.run(`$("scPopover").children.find((c) => c.className === "scMenuHead")._text`), "¿Dónde falla?");
  const where = ctx.run(`$("scPopover")`).children.filter((c) => c.tagName === "BUTTON");
  assert.deepEqual(where.map((b) => b._text), ["Paso 1 · ● Paso", "Paso 2 · ● Paso"]);
  where[1].onclick();
  assert.deepEqual(shape(steps(ctx)).map((x) => x.slice(1, 4)), [["SEND", 4, ""], ["SET_STATE", 3, "DOWN"], ["SEND", 5, ""]]);
  assert.deepEqual(J(ctx, "P().scenarios[0]"), original, "la original, intacta");
  assert.deepEqual(outcome(ctx), { ok: false, moment: 3, stepId: 2 });
  assert.equal(ctx.run("undoStack.length"), 2, "duplicar + fallar = dos entradas");
  ctx.run("undo()");
  assert.equal(ctx.run("scActiveScenario().steps.length"), 2, "el primer Undo quita el fallo");
  ctx.run("undo()");
  assert.equal(ctx.run("P().scenarios.length"), 1, "el segundo, la copia");
  assert.deepEqual(J(ctx, "P().scenarios[0]"), original);
});

test("D2 · cerrar «¿Dónde falla?» deja la copia sin fallo; con la copia modificada la original sigue igual; segunda copia «— falla 2»", () => {
  const ctx = story();
  const original = J(ctx, "P().scenarios[0]");
  ctx.run("scDuplicateAsFailure(document.createElement('button')); scClosePopover();");
  assert.deepEqual(outcome(ctx), { ok: true }, "sin elegir, la copia es la misma Historia");
  ctx.run("scFailHere(1); scSetStepMessage(scActiveScenario().steps[0].id, 'La tienda se cae')");
  assert.deepEqual(J(ctx, "P().scenarios[0]"), original, "modificar la copia no toca la original");
  /* con Tienda caída desde el principio ningún envío se completa: «¿Dónde falla?» no tiene nada que ofrecer */
  ctx.run("scChooseFailure(document.createElement('button'))");
  assert.equal(ctx.run(`$("scPopover").hidden`), true, "no ofrece envíos que ya no se completan");
  ctx.run("scSelectStory(P().scenarios[0].id); scDuplicateAsFailure(document.createElement('button')); scClosePopover();");
  assert.deepEqual(J(ctx, "P().scenarios.map((s) => s.name)"), ["Historia 1", "Historia 1 — falla 2", "Historia 1 — falla"]);
});

test("D3 · una Historia sin envíos que puedan fallar lo dice y no abre el menú", () => {
  const ctx = boot();
  tap(ctx, 700, 100);
  ctx.run("scDuplicateAsFailure(document.createElement('button'))");
  assert.equal(ctx.run("P().scenarios.length"), 2);
  assert.equal(ctx.run(`$("scPopover").hidden`), true);
});

test("O1 · el desenlace es UNA función: la línea de Present y el Viewer (outcomeLine) solo al terminar, del Trace de la reproducción; describe() no cambia", () => {
  const ctx = story();
  ctx.run("scFailHere(1)");
  const d = J(ctx, `(() => { const sc = scActiveScenario(), st = FluyoStoryClock.start(P(), sc, 0);
    const ph = (p, vt) => { st.playback.cursorVirtual = vt; return FluyoStoryClock.outcomeLine(p, sc, st.playback, FluyoI18n.t); };
    return [ph("ready", 0), ph("playing", 500), ph("finished", 99999)]; })()`);
  assert.deepEqual(d, ["", "", "Falla en el paso 2"]);
  /* sin pasos, sin desenlace; con éxito, «Termina bien» */
  assert.equal(J(ctx, "FluyoStoryClock.outcome({ steps: [] }, { events: [] })"), null);
  assert.equal(J(ctx, "FluyoStoryClock.outcome(scActiveScenario(), null)"), null);
  assert.equal(ctx.run("FluyoStoryClock.outcomeText({ ok: true })"), "Termina bien", "sin función de texto, la reserva");
  assert.equal(ctx.run("FluyoStoryClock.outcomeText({ ok: false, moment: 7 })"), "Falla en el paso 7");
  assert.equal(ctx.run("FluyoStoryClock.outcomeText(null)"), "");
});

test("O2 · con esperas de llegada (horario visible desplazado) el desenlace dice el mismo N que el progreso", () => {
  const ctx = story();
  /* la caída (paso 3, a 1000 ms) espera a que llegue el envío 1 (viaja 1100 ms): el horario visible se desplaza */
  ctx.run("scFailHere(2); scActiveScenario().arrivalDependencies = [{ stepId: 3, waitsForArrivalOf: [1] }];");
  const r = J(ctx, `(() => { const sc = scActiveScenario(), st = FluyoStoryClock.start(P(), sc, 0); st.playback.cursorVirtual = 1e9;
    return [st.playback.schedule.shifted, FluyoStoryClock.outcomeLine("finished", sc, st.playback, FluyoI18n.t)]; })()`);
  assert.deepEqual(r, [true, "Falla en el paso 3"]);
});

test("O3 · las Historias de los ejemplos: los desenlaces previstos, y calcularlos no cambia nada del documento", () => {
  const ctx = boot();
  const expect = {
    "compra-online": { "Compra con éxito": "Termina bien", "El banco no responde": "Falla en el paso 4" },
    "inicio-de-sesion-oauth2": { "Iniciar sesión": "Termina bien", "El usuario no autoriza": "Termina bien" },
    "pedido-asincrono-cola": { "Un pedido": "Termina bien", "Un mensaje que falla": "Falla en el paso 4" },
  };
  for (const [slug, stories] of Object.entries(expect)) {
    const raw = read(`ejemplos/data/${slug}.fluyo.json`);
    ctx.raw = raw;
    const got = J(ctx, `(() => { const data = JSON.parse(raw), pg = (data.doc || data).pages[0], before = JSON.stringify(data), out = {};
      for (const sc of pg.scenarios) out[sc.name] = FluyoStoryClock.outcomeText(FluyoStoryClock.outcome(sc, FluyoStory.run(pg, sc).trace), FluyoI18n.t);
      out.__same = JSON.stringify(data) === before; return out; })()`);
    assert.equal(got.__same, true, slug + ": el documento no cambia");
    delete got.__same;
    assert.deepEqual(got, stories, slug);
  }
});

test("O4 · pintar el desenlace en el editor no toca el documento ni el Undo, y no recalcula el motor si nada cambia", () => {
  const ctx = story();
  const before = JSON.stringify(J(ctx, "doc"));
  ctx.run("var __runs = 0, __run = FluyoStory.run; FluyoStory.run = (p, s) => { __runs++; return __run(p, s); };");
  boardOutcome(ctx); boardOutcome(ctx); boardOutcome(ctx);
  assert.equal(ctx.run("__runs"), 0, "memorizado: la Historia no ha cambiado desde el último cálculo");
  ctx.run("P().behaviors.push({ id: 1, nodeId: 2, kind: 'availability', initial: 'DOWN' })");
  boardOutcome(ctx);
  assert.equal(ctx.run("__runs"), 1, "una condición inicial nueva sí recalcula");
  ctx.run("P().behaviors.length = 0; FluyoStory.run = __run;");
  assert.equal(JSON.stringify(J(ctx, "doc")), before);
  assert.equal(ctx.run("undoStack.length"), 0);
});

test("E1 · en inglés: «Fail here», «{name} doesn't respond», «— fails», «Where does it fail?», «Ends well» / «Fails at step N»", () => {
  const ctx = story("en");
  const items = menu(ctx, "scStoryMenu(scActiveScenario().steps[0], document.createElement('button'))");
  assert.deepEqual([items[0].label, items[0].hint], ["Fail here", "Tienda doesn't respond just before"]);
  assert.equal(boardOutcome(ctx), "scOutcome ok | Ends well");
  const sm = menu(ctx, "scScenarioMenu(document.createElement('button'))");
  sm.find((i) => i.label === "Duplicate as failure").click();
  assert.equal(ctx.run("scActiveScenario().name"), "Story 1 — fails");
  assert.equal(ctx.run(`$("scPopover").children.find((c) => c.className === "scMenuHead")._text`), "Where does it fail?");
  const where = ctx.run(`$("scPopover")`).children.filter((c) => c.tagName === "BUTTON");
  assert.deepEqual(where.map((b) => b._text), ["Step 1 · ● Step", "Step 2 · ● Step"]);
  where[0].onclick();
  assert.equal(steps(ctx)[0].message, "Tienda doesn't respond");
  assert.equal(boardOutcome(ctx), "scOutcome failed | Fails at step 2");
  /* la frase es contenido: volver a español no la retraduce */
  ctx.run(`FluyoI18n.setLocale("es")`);
  assert.equal(J(ctx, "scActiveScenario().steps[0].message"), "Tienda doesn't respond");
});

test("C1 · Present y el Viewer pintan el desenlace de FluyoStoryClock.outcomeLine en su propia línea, encima del resumen", () => {
  /* S2a (portada y otras formas) cambia estas líneas: se miran con S2a deshecha */
  const { undoS2a } = require("./fluyo-stories-2-0-s2a-undo.cjs"), r = (f) => undoS2a(f, read(f));
  const html = r("index.html"), share = r("s/index.html"), ps = r("js/present-story.js"), vw = r("js/viewer.js");
  assert.match(html, /<div id="psCaption"[^>]*><\/div>\s*<!--[^>]*-->\s*<div id="psOutcome" class="psOutcome"><\/div>\s*<div id="psSummary"/);
  assert.match(share, /<span id="stCaption"[^>]*><\/span><span id="stOutcome" class="stOutcome"><\/span><span id="stSummary"/);
  assert.match(ps, /psSet\("psOutcome","text",typeof FluyoStoryClock!=="undefined" \? FluyoStoryClock\.outcomeLine\(dphase, sc, scPlayback, FluyoI18n\.t\) : ""\);/);
  assert.match(vw, /storySet\("stOutcome","text",FluyoStoryClock\.outcomeLine\(phase, sc, story && story\.playback, FluyoI18n\.t\)\);/);
  for (const src of [ps, vw]) assert.ok(!/outcome\w*\s*\(/i.test(src.replace(/FluyoStoryClock\.outcome(Text|Line)?\(/g, "")), "ninguna superficie calcula su propio desenlace");
  assert.match(r("js/story-clock.js"), /const d = FluyoStory\.describe\(phase, scenario, playback, nodeName, edgeEnds, text\);/, "describe() no cambia");
});

test("C2 · kernel, render, formato, Share, ejemplos y MCP intactos respecto a la base", () => {
  const KEEP = ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/render.js", "js/link-codec.js", "js/deeplink.js", "js/examples.js", "ejemplos"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...KEEP], { encoding: "utf8" }).trim();
  assert.equal(changed, "", "nada de esto cambia");
  /* Share lo cambia S2a (las otras formas): con S2a deshecha, igual que en la base */
  const { undoS2a } = require("./fluyo-stories-2-0-s2a-undo.cjs");
  for (const f of ["js/share-url.js", "js/editor-share.js"])
    assert.equal(undoS2a(f, read(f)), execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"), f);
});

test("C2b · alcance frente a a7af856: solo estos archivos servidos; undoS1b (para los alcances antiguos) los devuelve EXACTOS", () => {
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const { undoS1b, PIECES, NEW_FILES } = require("./fluyo-stories-2-0-s1b-undo.cjs");
  const { PIECES: PIECES_ST2A } = require("./fluyo-stories-2-0-s2a-undo.cjs");   /* FLUYO-STORIES-2.0 S2a va encima (undoS1b la deshace antes) */
  const { PIECES: PIECES_ST2B } = require("./fluyo-stories-2-0-s2b-undo.cjs");   /* FLUYO-STORIES-2.0 S2b va encima de S2a (undoS2a la deshace antes) */
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), ["css/share.css", "css/styles.css", "index.html", "js/editor-scenarios.js", "js/i18n-en-editor.js", "js/i18n-en.js",
    "js/present-story.js", "js/story-clock.js", "js/viewer.js", "s/index.html", "sw.js", ...Object.keys(PIECES_ST2A), ...Object.keys(PIECES_ST2B)].filter((f, i, a) => a.indexOf(f) === i).sort());
  assert.deepEqual(NEW_FILES, []);
  for (const f of [...new Set(Object.keys(PIECES).concat(Object.keys(PIECES_ST2A), Object.keys(PIECES_ST2B), "sw.js"))]) {
    /* la constante CACHE no es una pieza (sube en cada tarea): se compara sin ella; y sin CRLF (checkouts con core.autocrlf) */
    const noCache = (t) => t.replace(/\r\n/g, "\n").replace(/const CACHE = "fluyo-static-v\d+";/, "");
    const base = execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" });
    assert.equal(noCache(undoS1b(f, read(f))), noCache(base), f + ": undoS1b exacto");
  }
});

test("C3 · claves nuevas en inglés, todas usadas, y CACHE v118", () => {
  const ed = read("js/editor-scenarios.js"), sc = read("js/story-clock.js"), en = read("js/i18n-en.js"), ene = read("js/i18n-en-editor.js");
  for (const k of ["step.failHere", "step.failHereHint", "step.failHereNo", "step.failHereMessage", "step.failHereDone", "stories.duplicateAsFail", "stories.chooseFail",
    "stories.chooseFailStep", "stories.chooseFailNone", "seed.storyFail", "seed.storyFailN"]) {
    assert.ok(ed.includes(`"${k}"`), k + " se usa");
    assert.ok(ene.includes(`"${k}":`), k + " en inglés (editor)");
  }
  for (const k of ["story.outcome.ok", "story.outcome.failed"]) {
    assert.ok(sc.includes(`"${k}"`), k + " se usa (story-clock.js)");
    assert.ok(en.includes(`"${k}":`), k + " en inglés (también el Viewer)");
  }
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v120";/);
});
