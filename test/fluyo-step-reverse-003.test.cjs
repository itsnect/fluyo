"use strict";
/* FLUYO-STEP-REVERSE-003 — «Invertir sentido» en el menú de un Step FLOW (contrato: STEP-REVERSE-001 D10 y decisiones 237–238).
   · El menú: solo en Steps FLOW, en el grupo «Dónde», justo después de «Cambiar dónde ocurre…»; el hint dice cómo QUEDARÁ.
   · La acción: alterna `reverse` con setStepReverse (sin operación nueva), conserva la conexión y todo lo demás, es UNA entrada de
     Undo, y normal → reverse → Undo → Redo es exacto. reverse → normal quita la clave (nunca `false`).
   · Después de invertir: el texto, el Trace y el playback, duplicar, Share/Viewer/Present y «Cambiar dónde ocurre» siguen el sentido.
   · Alcance frente a 702f269: solo editor-scenarios.js y la CACHE; undoReverseUi lo devuelve EXACTO. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "702f269";   // main al empezar 003 (producción v97, STEP-REVERSE-002)
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js", "document-integrity.js"];

/* ── fixture (la de 002): 1 Usuario · 2 API · 3 Servicio · 4 DB; 5 U→A · 6 A→S · 7 S→D ── */
const U = 1, A = 2, S = 3, D = 4;
const rect = (id, label) => ({ id, shape: "rect", x: id * 200, y: 100, w: 140, h: 60, label });
const edge = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [] });
const ETS = [
  { id: 1, name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
  { id: 2, name: "Respuesta", primitive: "FLOW", sentenceTemplate: "{source} responde a {target}", visual: { kind: "token", value: "◆" }, motion: "normal" },
  { id: 3, name: "Cae", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN" },
  { id: 4, name: "Aviso", primitive: "OCCURRENCE", sentenceTemplate: "{target} avisa", visual: { kind: "token", value: "!" } },
];
const send = (id, at, edgeId, extra = {}) => Object.assign({ id, at, action: "SEND", edgeId }, extra);
const down = (id, at, nodeId) => ({ id, at, action: "SET_STATE", nodeId, state: "DOWN", eventTypeId: 3 });
const occ = (id, at, nodeId) => ({ id, at, action: "OCCURRENCE", nodeId, eventTypeId: 4 });
const story = (id, steps, extra = {}) => Object.assign({ id, engineVersion: 2, name: "Historia " + id, nextStepId: Math.max(0, ...steps.map((s) => s.id)) + 1, steps }, extra);
function page(steps, { edges, storyExtra } = {}) {
  return { name: "Petición", nextId: 100, behaviors: [], nextScenarioId: 2,
    nodes: [rect(U, "Usuario"), rect(A, "API"), rect(S, "Servicio"), rect(D, "DB")],
    edges: edges || [edge(5, U, A), edge(6, A, S), edge(7, S, D)],
    scenarios: [story(1, steps, storyExtra)] };
}
const project = (pages) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: ETS, nextEventTypeId: 5, pages, cur: 0 }, settings: {} });

/* ── editor: las funciones reales del menú y de la acción, sobre el kernel real, state.js y selection.js (Undo/Redo) ── */
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
const ED_FNS = ["scNodeLabel", "scNodeFallback", "scEdgeLabel", "scEdgeSecondary", "scTargetLabel", "scIsTargetMissing", "describeScenarioStep",
  "scWhereLabel", "scStepTitle", "scStoryMenu", "scReverseMenuItem", "scToggleStepReverse", "scEditable", "scOrderedSteps",
  "scDuplicateStep", "scSetArrivalDependencies", "scUseTarget"];
const ED_BASE = ED_FNS.filter((n) => n !== "scReverseMenuItem" && n !== "scToggleStepReverse");
function editor(src = read("js/editor-scenarios.js"), fns = ED_FNS) {
  const els = {};
  const fakeNode = (tag) => ({ tag, children: [], textContent: "", className: "", classList: { add() {}, contains() { return false; } }, appendChild(c) { this.children.push(c); return c; } });
  const $ = (id) => (els[id] = els[id] || fakeNode(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, $, GRID: 20, innerWidth: 1280, innerHeight: 800,
    document: { createElement: fakeNode, createTextNode: (t) => ({ textContent: t, children: [] }) } });
  const R = (code) => vm.runInContext(code, ctx);
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  R(`var selN=new Set(), selE=new Set(), clip=null, scPlayback=null, scStatus="idle", scActive=1, scPlacement=null, scContext=null, scSelectedStep=null, __commits=0, __menu=null, __notices=[];
     function confirm(){ return true; } function alert(){} function refreshPanel(){} function renderTabs(){} function scheduleAutosave(){}
     function isScenarioPlaybackActive(){ return scStatus==="running"; } function scActiveScenario(){ return P().scenarios.find(s=>s.id===scActive) || null; }
     function scCancelPlacement(){ scPlacement=null; } function scCommit(){ __commits++; } function scNotice(t){ __notices.push(t); }
     function scMenuSections(anchor, menu){ __menu = menu; } function scArrivalMenuItem(){ return { label: "Esperar a que llegue…" }; }
     function scVisibleAt(step){ return step.at; }`);
  R(read("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  vm.runInContext(fns.map((n) => extract(src, n)).join("\n"), ctx, { filename: "js/editor-scenarios.js#extract" });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0; __commits=0;");
  /* El menú tal como lo pinta scMenuSections: secciones con {label, hint, disabled}. */
  const menu = (id) => { R(`__menu=null; scStoryMenu(scActiveScenario().steps.find(s=>s.id===${id}), null)`);
    return J(R("__menu.sections.map(sec => sec.map(it => ({label: it.label, hint: it.hint || '', disabled: !!it.disabled})))")); };
  const item = (id, label) => { R(`__menu=null; scStoryMenu(scActiveScenario().steps.find(s=>s.id===${id}), null)`);
    return R(`__menu.sections.flat().find(it => it.label === ${JSON.stringify(label)})`); };
  const docJson = () => R("JSON.stringify(projectToSerializable(doc, {}))");
  return { R, load, menu, item, docJson, steps: () => J(R("scActiveScenario().steps")), sc: () => J(R("scActiveScenario()")) };
}
const labels = (m) => m.map((sec) => sec.map((it) => it.label));
const ROUND = [send(1, 0, 7, { eventTypeId: 1 }), send(2, 1200, 7, { eventTypeId: 2 }), down(3, 1200, U), occ(4, 2400, A)];

/* ═══════════════ A. El menú ═══════════════ */
test("A1 · Step FLOW: «Invertir sentido» en el grupo «Dónde», justo después de «Cambiar dónde ocurre…»; nada más cambia en el menú", () => {
  const e = editor(), base = editor(atBase("js/editor-scenarios.js"), ED_BASE);
  e.load(project([page(ROUND)])); base.load(project([page(ROUND)]));
  const m = e.menu(2), mb = base.menu(2);
  assert.deepEqual(m[1].map((it) => it.label), ["Cambiar dónde ocurre…", "Invertir sentido"]);
  assert.deepEqual(m[1][0], mb[1][0], "«Cambiar dónde ocurre…» igual que en " + BASE);
  /* Quitando la entrada nueva, el menú es el de la base, entrada a entrada. */
  assert.deepEqual(m.map((sec) => sec.filter((it) => it.label !== "Invertir sentido")), mb);
  assert.equal(labels(m).flat().filter((l) => l === "Invertir sentido").length, 1, "una sola entrada");
});

test("A2 · el hint dice cómo QUEDARÁ: normal «Pasa a: DB → Servicio»; inverso «Pasa a: Servicio → DB»", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 1 }), send(2, 0, 7, { eventTypeId: 2, reverse: true })])]));
  assert.deepEqual(e.menu(1)[1], [{ label: "Cambiar dónde ocurre…", hint: "Ahora: Servicio → DB", disabled: false }, { label: "Invertir sentido", hint: "Pasa a: DB → Servicio", disabled: false }]);
  assert.deepEqual(e.menu(2)[1], [{ label: "Cambiar dónde ocurre…", hint: "Ahora: DB → Servicio", disabled: false }, { label: "Invertir sentido", hint: "Pasa a: Servicio → DB", disabled: false }]);
});

test("A3 · solo Steps FLOW: un evento de disponibilidad o de ocurrencia NO tiene la acción (su menú es el de " + BASE + ")", () => {
  /* FLUYO-MCP-STEP-MESSAGE-001 añade «Mensaje del paso…» a estos menús: su alcance lo vigila test/fluyo-step-message-001.test.cjs */
  const { undoMsg } = require("./fluyo-step-message-001-undo.cjs");
  const e = editor(undoMsg("js/editor-scenarios.js", read("js/editor-scenarios.js"))), base = editor(atBase("js/editor-scenarios.js"), ED_BASE);
  e.load(project([page(ROUND)])); base.load(project([page(ROUND)]));
  for (const id of [3, 4]) {
    assert.ok(!labels(e.menu(id)).flat().includes("Invertir sentido"), "Step " + id);
    assert.deepEqual(e.menu(id), base.menu(id), "Step " + id + " como en la base");
  }
});

test("A4 · sin conexión (conexión borrada o un extremo perdido) la acción está desactivada y no hace nada", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 1 })])]));
  e.R("P().edges = P().edges.filter(x => x.id !== 7)");
  assert.deepEqual(e.menu(1)[1][1], { label: "Invertir sentido", hint: "", disabled: true });
  const before = e.docJson();
  assert.equal(e.R("scToggleStepReverse(1)"), false);
  assert.equal(e.docJson(), before);
  assert.equal(e.R("undoStack.length"), 0);
});

/* ═══════════════ B. La acción: setStepReverse, una entrada de Undo, exacta ═══════════════ */
test("B1 · normal → reverse → Undo → Redo es exacto (documento entero); una sola entrada; conexión, id, at, orden, EventType y espera intactos", () => {
  const e = editor();
  const deps = [{ stepId: 3, waitsForArrivalOf: 1 }];
  e.load(project([page([send(1, 0, 7, { eventTypeId: 1 }), send(2, 0, 6, { eventTypeId: 1 }), send(3, 1200, 7, { eventTypeId: 2 })], { storyExtra: { arrivalDependencies: deps } })]));
  const sc0 = e.sc(), before = e.docJson();
  e.R("scSelectedStep = 1");
  e.item(1, "Invertir sentido").fn();   // lo que hace el clic en el menú
  const sc1 = e.sc();
  assert.deepEqual(sc1.steps[0], send(1, 0, 7, { eventTypeId: 1, reverse: true }), "misma conexión, solo el sentido");
  assert.deepEqual(sc1.steps.slice(1), sc0.steps.slice(1), "los demás Steps no cambian");
  assert.deepEqual(Object.assign({}, sc1, { steps: null }), Object.assign({}, sc0, { steps: null }), "la Historia (nombre, nextStepId, esperas…) no cambia");
  assert.equal(e.R("undoStack.length"), 1, "UNA entrada de Undo");
  assert.equal(e.R("__commits"), 1, "un solo commit: el panel se repinta al momento");
  assert.equal(e.R("scSelectedStep"), 1, "la selección se conserva (decisión 189)");
  const after = e.docJson();
  e.R("undo()");
  assert.equal(e.docJson(), before, "Undo exacto");
  assert.equal(e.R("scSelectedStep"), 1);
  e.R("redo()");
  assert.equal(e.docJson(), after, "Redo exacto");
  assert.equal(e.R("undoStack.length"), 1);
  assert.equal(e.R("redoStack.length"), 0);
});

test("B2 · reverse → normal quita la clave (nunca `false`); Undo/Redo exactos; dos inversiones vuelven al documento de partida", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2, reverse: true })])]));
  const before = e.docJson();
  assert.equal(e.R("scToggleStepReverse(1)"), true);
  assert.deepEqual(e.steps()[0], send(1, 0, 7, { eventTypeId: 2 }));
  assert.ok(!("reverse" in e.steps()[0]), "sin la clave");
  assert.ok(!e.docJson().includes('"reverse"'), "el documento guardado no lleva reverse");
  const after = e.docJson();
  e.R("undo()"); assert.equal(e.docJson(), before);
  e.R("redo()"); assert.equal(e.docJson(), after);
  e.R("scToggleStepReverse(1)");
  assert.equal(e.docJson(), before, "dos inversiones = el documento de partida");
  assert.equal(e.R("undoStack.length"), 2, "una entrada por inversión");
});

test("B3 · no edita lo que no se puede editar: con la Historia en reproducción o en motor v1 no hace nada ni deja Undo", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 1 })])]));
  const before = e.docJson();
  e.R('scStatus = "running"');
  assert.equal(e.R("scToggleStepReverse(1)"), false);
  e.R('scStatus = "idle"; scActiveScenario().engineVersion = 1');
  assert.equal(e.R("scToggleStepReverse(1)"), false);
  e.R("scActiveScenario().engineVersion = 2");
  assert.equal(e.docJson(), before);
  assert.equal(e.R("undoStack.length"), 0);
  assert.equal(e.R("scToggleStepReverse(99)"), false, "Step inexistente");
});

test("B4 · reutiliza el contrato de 002: la acción llama a setStepReverse y no añade operación de autoría ni toca el kernel", () => {
  const src = read("js/editor-scenarios.js");
  const fn = extract(src, "scToggleStepReverse");
  assert.match(fn, /pushUndo\(\);\n\s*setStepReverse\(sc, id, s\.reverse !== true\);\n\s*scCommit\(\);/);
  const { undo4: undo4only, PIECES: PIECES4 } = require("./fluyo-scenarios-semantics-4-undo.cjs"), { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs"), undo4 = (f, src) => undo4only(f, undo5(f, src));   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima: se deshace antes */
  for (const f of ["js/model.js", "js/story-authoring.js", "js/scenario-engine.js", "js/flow-semantics.js"]) assert.equal(undo4(f, read(f)), atBase(f), f + " sin cambios");
});

/* ═══════════════ C. Después de invertir: texto, Trace, playback, duplicar, retarget ═══════════════ */
test("C1 · el texto se actualiza: etiqueta, frase y «Dónde» pasan a «DB → Servicio» / «DB responde a Servicio»; y vuelven", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2 })])]));
  const row = () => J(e.R("(s => [scTargetLabel(s), describeScenarioStep(s).primary, scWhereLabel(s)])(scActiveScenario().steps[0])"));
  assert.deepEqual(row(), ["Servicio → DB", "Servicio responde a DB", "Servicio → DB"]);
  e.R("scToggleStepReverse(1)");
  assert.deepEqual(row(), ["DB → Servicio", "DB responde a Servicio", "DB → Servicio"]);
  e.R("undo()");
  assert.deepEqual(row(), ["Servicio → DB", "Servicio responde a DB", "Servicio → DB"]);
});

test("C2 · el Trace y el playback siguen el sentido nuevo: reverse:true en los tres eventos, token invertido en activeSends, motivo del recorrido", () => {
  const e = editor();
  e.load(project([page([down(1, 0, D), send(2, 1200, 7, { eventTypeId: 2 })])]));
  const run = () => J(e.R("FluyoStory.run(P(), scActiveScenario()).trace"));
  const t0 = run();
  e.R("scToggleStepReverse(2)");
  const t1 = run();
  const sends = (t) => t.events.filter((x) => /^send_/.test(x.type));
  assert.ok(sends(t0).every((x) => !("reverse" in x)));
  assert.ok(sends(t1).length > 0 && sends(t1).every((x) => x.reverse === true), JSON.stringify(sends(t1)));
  assert.equal(sends(t0).find((x) => x.type === "send_failed").reason, "target_down", "normal: falla el destino (DB)");
  assert.equal(sends(t1).find((x) => x.type === "send_failed").reason, "source_down", "inverso: falla el origen (DB)");
  const out = J(e.R("FluyoStory.outcomes(FluyoStory.run(P(), scActiveScenario()).trace, scActiveScenario(), P())"));
  assert.ok(JSON.stringify(out).includes('"reverse":true'), JSON.stringify(out));
  /* Playback: el envío en curso lleva reverse (el token sale de DB). */
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2 })])]));
  e.R("scToggleStepReverse(1)");
  const active = J(e.R("(()=>{ const s = FluyoStory.start(P(), scActiveScenario(), 0); FluyoScenarioPlayback.tick(s.playback, 300); return s.playback.activeSends; })()"));
  assert.equal(active.length, 1);
  assert.equal(active[0].edgeId, 7);
  assert.equal(active[0].reverse, true);
});

test("C3 · Duplicar después de invertir: la copia hereda el sentido; Undo la quita y deja el inverso", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2 })])]));
  e.R("scToggleStepReverse(1)");
  e.item(1, "Duplicar").fn();
  assert.deepEqual(e.steps(), [send(1, 0, 7, { eventTypeId: 2, reverse: true }), send(2, 0, 7, { eventTypeId: 2, reverse: true })]);
  e.R("undo()");
  assert.deepEqual(e.steps(), [send(1, 0, 7, { eventTypeId: 2, reverse: true })], "Undo quita la copia (el contador de ids no baja, como siempre)");
  e.R("undo()");
  assert.deepEqual(e.steps(), [send(1, 0, 7, { eventTypeId: 2 })]);
});

test("C4 · «Cambiar dónde ocurre» después de invertir conserva el sentido actual (y el normal sigue normal)", () => {
  const e = editor();
  e.load(project([page([send(1, 0, 7, { eventTypeId: 2 }), send(2, 0, 7, { eventTypeId: 1 })])]));
  e.R("scToggleStepReverse(1)");
  e.R(`scPlacement = {kind:"retarget", stepId:1, targetType:"edge"}; scUseTarget(6, false);`);
  e.R(`scPlacement = {kind:"retarget", stepId:2, targetType:"edge"}; scUseTarget(6, false);`);
  assert.deepEqual(e.steps(), [send(1, 0, 6, { eventTypeId: 2, reverse: true }), send(2, 0, 6, { eventTypeId: 1 })]);
  assert.deepEqual(e.menu(1)[1][1], { label: "Invertir sentido", hint: "Pasa a: API → Servicio", disabled: false });
});

/* ═══════════════ D. Compartir / Viewer / Present reciben el Step invertido ═══════════════ */
test("D1 · Share #d= después de invertir: el enlace lleva el Step invertido; Viewer y Present leen la misma Historia (caption del recorrido)", async () => {
  const e = editor();
  e.load(project([page([down(1, 0, D), send(2, 1200, 7, { eventTypeId: 2 })])]));
  e.R("scToggleStepReverse(2)");
  const data = JSON.parse(e.docJson());
  const L = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, CompressionStream, DecompressionStream, crypto, console });
  for (const f of ["config.js", "safe-svg.js", "model.js", "geometry.js", "link-codec.js", "share-url.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js"])
    vm.runInContext(read("js/" + f), L, { filename: f });
  L.__a = data;
  const back = JSON.parse(await vm.runInContext(`createShareUrl(__a, "https://fluyo.space/", {kind:"story", scenarioId:1}).then(u => decodeDeepLink(new URL(u).hash.slice(3))).then(x => JSON.stringify(projectFromProjectData(x).doc))`, L));
  assert.deepEqual(back.pages[0].scenarios[0].steps, [down(1, 0, D), send(2, 1200, 7, { eventTypeId: 2, reverse: true })]);
  /* Viewer y Present usan FluyoStory (story-playback.js): mismo Trace y el caption nombra el origen del recorrido. */
  L.__d = back;
  const seen = J(vm.runInContext(`(()=>{ const pg = __d.pages[0], sc = pg.scenarios[0]; const s = FluyoStory.start(pg, sc, 0);
    FluyoScenarioPlayback.tick(s.playback, 1300);
    const nodeName = id => { const n = pg.nodes.find(x=>x.id===id); return n ? n.label : "?"; }, edgeEnds = id => { const e = pg.edges.find(x=>x.id===id); return e ? {from:e.from, to:e.to} : null; };
    return { caption: FluyoStory.caption(s.playback.logEvents, 1300, nodeName, edgeEnds), failed: s.playback.logEvents.find(x => x.type === "send_failed") }; })()`, L));
  assert.equal(seen.caption, "No se completó · DB no está disponible");
  assert.equal(seen.failed.reverse, true);
  assert.equal(seen.failed.reason, "source_down", "la respuesta sale de DB caída: falla el ORIGEN del recorrido");
});

/* ═══════════════ E. Alcance frente a 702f269 ═══════════════ */
test("E1 · alcance: solo cambian js/editor-scenarios.js y sw.js (CACHE v98); undoReverseUi los devuelve EXACTOS a " + BASE, () => {
  const SERVED = ["index.html", "s", "css", "js", "sw.js", "manifest.webmanifest"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const { undo4: undo4only, PIECES: PIECES4 } = require("./fluyo-scenarios-semantics-4-undo.cjs"), { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs"), undo4 = (f, src) => undo4only(f, undo5(f, src));   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima: se deshace antes */
  const PIECES5 = require("./fluyo-scenarios-semantics-5-undo.cjs").PIECES;   /* SCENARIOS-SEMANTICS-001 FASE 5: lo suyo se descuenta como lo de FASE 4 */
  const PIECES6 = require("./fluyo-scenarios-semantics-6-undo.cjs").PIECES;   /* SCENARIOS-SEMANTICS-001 FASE 6 (B1), igual */
  const PIECESM = require("./fluyo-step-message-001-undo.cjs").PIECES;   /* FLUYO-MCP-STEP-MESSAGE-001, igual */
  const { NEW_FILES: NEW_I18N, undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade js/i18n.js y js/i18n-en.js (no existen en la base) */
  assert.deepEqual([...new Set([...changed, ...untracked])].filter((f) => !NEW_I18N.includes(f)).filter((f) => f === "js/editor-scenarios.js" || (!Object.keys(PIECES4).includes(f) && !Object.keys(PIECES5).includes(f) && !Object.keys(PIECES6).includes(f) && !Object.keys(PIECESM).includes(f))).sort(), ["js/editor-scenarios.js", "sw.js"]);
  for (const f of Object.keys(PIECES4)) if (f !== "js/editor-scenarios.js") assert.equal(undo4(f, read(f)), atBase(f), f + ": solo FASE 4");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v105";/);
  assert.equal(undoI18n("sw.js", read("sw.js")).replace('"fluyo-static-v105"', '"fluyo-static-v' + (98 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante");
  const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");
  assert.equal(undoReverseUi("js/editor-scenarios.js", undo4("js/editor-scenarios.js", read("js/editor-scenarios.js"))), atBase("js/editor-scenarios.js"));
  assert.equal((read("js/editor-scenarios.js").match(/Invertir sentido/g) || []).length, 2, "el rótulo, una vez (más el comentario)");
});
