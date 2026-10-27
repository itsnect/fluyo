"use strict";
/* FLUYO-PRODUCT-NARRATION-001 — La frase del autor en CUALQUIER paso de una Historia (decisión 258; contrato en
   .ai/tasks/FLUYO-PRODUCT-NARRATION-001.md). Extiende STEP-MESSAGE-001 (decisión 255): `message` también en un SEND, y al reproducir es
   el título de su momento en vez del nombre del evento. Presentación pura: ni el motor ni el reloj lo leen.
   · A  Kernel (model.js): forma y carga en un SEND (con y sin reverse), stepDefinitionForEvent, setStepMessage (fijar, cambiar, null).
   · B  Motor e integridad: el motor filtra la clave en cualquier acción; Trace y outcomes BYTE A BYTE iguales con y sin mensaje.
   · C  Presentación: FluyoStory.momentText / describe (el título del editor, Present y Viewer): el message si existe; si no, el evento,
        IDÉNTICO a la base; el playback (envíos, cues, horario visible) idéntico; un envío no tiene globo.
   · D  Autoría por lote (contrato MCP): add_step {message} y set_step_message en FLOW; duplicate_story y duplicate_step lo conservan.
   · E  Editor: «Mensaje del paso…» en el menú de un envío (tras «Invertir sentido»); una entrada de Undo; Undo/Redo exactos.
   · F  Share (#d=) ida y vuelta EXACTA; documentos antiguos (ejemplos y fixtures) idénticos a la base; un lector anterior rechaza un
        envío con message (no lo lee mal).
   · G  Caso real: Cliente → API → Pagos → PSP → Base de datos, narrado con 2 eventos frente a 6 eventos artificiales.
   · H  Alcance frente a 87a9d76: solo estos archivos servidos; undoNarr los devuelve EXACTOS; CACHE v104; engineVersion 2, version 5.
   Present, Viewer y móvil en Chrome real: test/fluyo-product-narration-001-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { shellOnly, undoShell } = require("./fluyo-shell-001-undo.cjs");   /* FLUYO-SHELL-001 (páginas públicas, favicon, manifest): lo suyo se descuenta */
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "6925ffe";   // FLUYO-I18N-001 (CACHE v105), sobre FLUYO-018.30: esta tarea se integra encima
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js", "document-integrity.js", "story-authoring.js"];
function context(src = read, files = KERNEL) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, CompressionStream, DecompressionStream, crypto, console });
  for (const f of files) vm.runInContext(src("js/" + f), ctx, { filename: f });
  return ctx;
}
const K = context();
const runIn = (C, code, arg) => { C.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, C)); };
const run = (code, arg) => runIn(K, code, arg);
const err = (code, arg) => run(`(()=>{ try{ ${code}; return null; }catch(e){ return {code:e.code}; } })()`, arg);

/* ── fixture pequeña: 1 Usuario · 2 API · 3 DB; 4 U→A · 5 A→D ── */
const U = 1, A = 2, D = 3;
const rect = (id, label) => ({ id, shape: "rect", x: id * 200, y: 100, w: 140, h: 60, label });
const edge = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [] });
const ETS = [
  { id: 1, name: "Pide", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
  { id: 2, name: "Pregunta", primitive: "OCCURRENCE", sentenceTemplate: "{target} pregunta", visual: { kind: "token", value: "?" },
    presentation: { nodeEffects: { message: "", highlight: true, visualDuration: "long" } } },
  { id: 3, name: "Cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" },
    presentation: { nodeEffects: { message: "Caída" } } },
];
const occ = (id, at, nodeId, extra = {}) => Object.assign({ id, at, eventTypeId: 2, action: "OCCURRENCE", nodeId }, extra);
const down = (id, at, nodeId, extra = {}) => Object.assign({ id, at, eventTypeId: 3, action: "SET_STATE", nodeId, state: "DOWN" }, extra);
const send = (id, at, edgeId, extra = {}) => Object.assign({ id, at, eventTypeId: 1, action: "SEND", edgeId }, extra);
const story = (id, steps, extra = {}) => Object.assign({ id, engineVersion: 2, name: "Historia " + id, nextStepId: Math.max(0, ...steps.map((s) => s.id)) + 1, steps }, extra);
const page = (steps, storyExtra) => ({ name: "Página", nextId: 100, behaviors: [], nextScenarioId: 2,
  nodes: [rect(U, "Usuario"), rect(A, "API"), rect(D, "DB")], edges: [edge(4, U, A), edge(5, A, D)], scenarios: [story(1, steps, storyExtra)] });
const project = (steps, storyExtra) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: ETS, nextEventTypeId: 4, pages: [page(steps, storyExtra)], cur: 0 }, settings: {} });
/* La Historia de la suite: dos envíos narrados (uno al revés), uno sin narrar, un elemento narrado y uno sin narrar a la vez. */
const STEPS = [send(1, 0, 4, { message: "El usuario pide su saldo" }), occ(2, 900, A, { message: "La API comprueba la sesión" }), send(3, 1800, 5),
  send(4, 2700, 5, { reverse: true, message: "La BD devuelve el saldo" }), down(5, 3600, D), occ(6, 3600, A)];
const BARE = STEPS.map(({ message, ...s }) => s);
const LOAD = "projectFromProjectData(__a)";
const loads = (p, C = K) => runIn(C, `(()=>{ try{ ${LOAD}; return "abre"; }catch(e){ return e.code; } })()`, p);

/* ═══════════════ A. Kernel (model.js) ═══════════════ */
test("A1 · validatePersistedStep: message en un SEND (normal y reverse) con las mismas reglas que en un paso de elemento", () => {
  const v = (step) => run(`(()=>{ try{ validatePersistedStep(__a, 2); return "ok"; }catch(e){ return e.code; } })()`, step);
  for (const m of ["Cliente solicita checkout", "x", "x".repeat(120), "a".repeat(118) + "😀", "  con espacios  ", "שלום · 你好", "dos\nlíneas"]) {
    assert.equal(v(send(1, 0, 4, { message: m })), "ok", JSON.stringify(m));
    assert.equal(v(send(1, 0, 4, { message: m, reverse: true })), "ok", "reverse " + JSON.stringify(m));
  }
  for (const m of ["", " ", "\t\n ", "x".repeat(121), "a".repeat(119) + "😀", null, 42, true, {}, ["x"]])
    assert.equal(v(send(1, 0, 4, { message: m })), "invalid_document", JSON.stringify(m));
  assert.equal(v({ id: 1, at: 0, action: "SEND", edgeId: 4, message: "sin evento" }), "ok", "un envío sin eventTypeId también");
});

test("A2 · carga: un SEND con message abre y vuelve EXACTO (sin trim ni normalizar); sin message, lo de siempre", () => {
  const out = run(`(()=>{ const once = ${LOAD}; const saved = JSON.stringify(projectToSerializable(once.doc, once.settings));
    const twice = projectFromProjectData(JSON.parse(saved)); return [once.doc.pages[0].scenarios[0].steps, saved === JSON.stringify(projectToSerializable(twice.doc, twice.settings))]; })()`, project(STEPS));
  assert.deepEqual(out[0], STEPS, "los Steps tal cual, también el orden de claves");
  assert.ok(out[1], "guardar/abrir/guardar: idéntico");
  assert.deepEqual(run(`${LOAD}.doc.pages[0].scenarios[0].steps.map(s => s.message)`, project([send(1, 0, 4, { message: "  hola   " })])), ["  hola   "]);
  for (const m of ["", "   ", "x".repeat(121), null]) assert.equal(loads(project([send(1, 0, 4, { message: m })])), "invalid_document", JSON.stringify(m));
  assert.equal(loads(project(BARE)), "abre");
});

test("A3 · stepDefinitionForEvent y setStepMessage en un SEND: fijar, cambiar, quitar (null); nada más cambia (ni el sentido)", () => {
  assert.deepEqual(run(`stepDefinitionForEvent(__a[0], 4, 0, undefined, "hola")`, ETS), { at: 0, eventTypeId: 1, action: "SEND", edgeId: 4, message: "hola" });
  assert.deepEqual(run(`stepDefinitionForEvent(__a[0], 4, 0, true, "al revés")`, ETS), { at: 0, eventTypeId: 1, action: "SEND", edgeId: 4, reverse: true, message: "al revés" });
  assert.deepEqual(run(`stepDefinitionForEvent(__a[0], 4, 0)`, ETS), { at: 0, eventTypeId: 1, action: "SEND", edgeId: 4 }, "sin message, sin clave");
  for (const m of ["", "  ", "x".repeat(121), null, 3]) assert.deepEqual(err(`stepDefinitionForEvent(__a[0], 4, 0, undefined, ${JSON.stringify(m)})`, ETS), { code: "invalid_document" }, JSON.stringify(m));
  const r = run(`(()=>{ const sc = ${LOAD}.doc.pages[0].scenarios[0];
    const a = JSON.stringify(setStepMessage(sc, 3, "Nuevo")), b = JSON.stringify(setStepMessage(sc, 3, "Otro")), c = JSON.stringify(setStepMessage(sc, 4, null));
    const errs = [[3,""],[3,"   "],[3,"x".repeat(121)],[99,"x"],[3,undefined],[3,7]].map(([id,m]) => { try{ setStepMessage(sc, id, m); return "ok"; }catch(e){ return e.code; } });
    return {a, b, c, errs, steps: sc.steps}; })()`, project(STEPS));
  assert.deepEqual(JSON.parse(r.a), send(3, 1800, 5, { message: "Nuevo" }));
  assert.deepEqual(JSON.parse(r.b), send(3, 1800, 5, { message: "Otro" }), "cambiar");
  assert.deepEqual(JSON.parse(r.c), send(4, 2700, 5, { reverse: true }), "null quita la clave; el sentido se queda");
  assert.deepEqual(r.errs, ["invalid_document", "invalid_document", "invalid_document", "step_not_found", "invalid_document", "invalid_document"]);
  assert.deepEqual(r.steps.map(({ message, ...s }) => s), BARE, "id, at, orden, objetivo, sentido y evento intactos");
});

/* ═══════════════ B. Motor e integridad ═══════════════ */
test("B1 · motor: message es presentación en CUALQUIER acción; FluyoIntegrity lo valida en un SEND (invalid_step si no es un texto válido)", () => {
  const S = { nodes: [{ id: 1 }, { id: 2 }], edges: [{ id: 3, from: 1, to: 2 }] };
  const scen = (steps) => ({ id: 1, engineVersion: 2, name: "H", nextStepId: 9, steps });
  assert.equal(run(`FluyoScenarios.runScenario(__a.s, [], __a.sc).ok`, { s: S, sc: scen([{ id: 1, at: 0, action: "SEND", edgeId: 3, message: "x" }, { id: 2, at: 10, action: "SEND", edgeId: 3, reverse: true, message: "y" }]) }), true);
  const en = read("js/scenario-engine.js");
  assert.match(en, /k!=="message"/, "el motor solo filtra la clave");
  assert.equal(run(`FluyoIntegrity.validateProject(__a).valid`, project(STEPS)), true);
  assert.deepEqual(run(`FluyoIntegrity.validateProject(__a).errors.map(e => [e.code, e.stepId])`, project([send(1, 0, 4), send(2, 10, 5, { message: "   " })])), [["invalid_step", 2]]);
});

test("B2 · Trace y outcomes BYTE A BYTE iguales con y sin message, y a los de la base (también con dependencias de llegada)", () => {
  const OLD = context(atBase);
  const SURF = `(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0]; const r = FluyoStory.run(pg, sc);
    return {trace: JSON.stringify(r.trace), outcomes: JSON.stringify(FluyoStory.outcomes(r.trace, sc, pg))}; })()`;
  for (const extra of [undefined, { arrivalDependencies: [{ stepId: 2, waitsForArrivalOf: [1] }] }]) {
    const bare = run(SURF, project(BARE, extra));
    assert.deepEqual(run(SURF, project(STEPS, extra)), bare, "con y sin message");
    assert.deepEqual(runIn(OLD, SURF, project(BARE, extra)), bare, "sin message: igual que en " + BASE);
  }
});

/* ═══════════════ C. Presentación: el título del momento (editor, Present, Viewer) ═══════════════ */
const LABELS = (phase = "ready") => `(()=>{ const p = ${LOAD}; doc = p.doc; const sc = doc.pages[0].scenarios[0];
  return FluyoStoryClock.describe("${phase}", sc, null, () => "", () => null).moments.map(m => m.label); })()`;
test("C1 · momentText: el message del paso si lo tiene (envío o elemento); si no, el nombre de su evento; sin evento, nada", () => {
  assert.deepEqual(run(`[__a.map(s => FluyoStory.momentText(s))]`, STEPS)[0],
    ["El usuario pide su saldo", "La API comprueba la sesión", "Pide", "La BD devuelve el saldo", "Cae", "Pregunta"]);
  assert.equal(run(`FluyoStory.momentText({id:1, at:0, action:"SEND", edgeId:4})`), "", "sin evento ni message");
  assert.equal(run(`FluyoStory.momentText({id:1, at:0, action:"SEND", edgeId:4, message:"solo texto"})`), "solo texto");
  /* la frase del evento (la fila del editor, describe_document y run_story del MCP) no cambia: la del autor va aparte */
  const sentences = `(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0]; return pg.scenarios[0].steps.map(s => FluyoStory.sentence(pg, s, eventTypeById(s.eventTypeId))); })()`;
  assert.deepEqual(run(sentences, project(STEPS)), run(sentences, project(BARE)));
  assert.deepEqual(run(sentences, project(STEPS)), ["Usuario pide a API", "API pregunta", "API pide a DB", "DB pide a API", "DB cae", "API pregunta"]);
});

test("C2 · describe: los títulos de los momentos dicen la frase del autor; un momento con varios pasos las junta con « · » sin repetir", () => {
  assert.deepEqual(run(LABELS(), project(STEPS)), ["El usuario pide su saldo", "La API comprueba la sesión", "Pide", "La BD devuelve el saldo", "Cae · Pregunta"]);
  const same = [send(1, 0, 4, { message: "A la vez" }), send(2, 0, 5, { message: "A la vez" }), occ(3, 0, A)];
  assert.deepEqual(run(LABELS(), project(same)), ["A la vez · Pregunta"], "sin repetir; el paso sin message pone su evento");
  const d = run(`(()=>{ const p = ${LOAD}; doc = p.doc; const sc = doc.pages[0].scenarios[0]; const s = FluyoStory.start(doc.pages[0], sc, 0);
    FluyoScenarioPlayback.tick(s.playback, 950); return [FluyoStory.describe("playing", sc, s.playback, () => "", () => null).title, FluyoStory.describe("ready", sc, null, () => "", () => null).title]; })()`, project(STEPS));
  assert.deepEqual(d, ["La API comprueba la sesión", "Historia 1"], "reproduciendo, el momento en curso; lista, el nombre de la Historia");
  /* D-PO-2: `narrated` marca SOLO los momentos con una frase del autor (los únicos rótulos que pueden crecer); sin frase, ni la clave */
  const marks = run(`(()=>{ const p = ${LOAD}; doc = p.doc; const sc = doc.pages[0].scenarios[0];
    return FluyoStoryClock.describe("ready", sc, null, () => "", () => null).moments.map(m => "narrated" in m ? m.narrated : null); })()`, project(STEPS));
  assert.deepEqual(marks, [true, true, null, true, null]);
  assert.deepEqual(run(`(()=>{ const p = ${LOAD}; doc = p.doc; return FluyoStory.describe("ready", doc.pages[0].scenarios[0], null, () => "", () => null).moments.map(m => Object.keys(m)); })()`, project(BARE)),
    [["at", "label"], ["at", "label"], ["at", "label"], ["at", "label"], ["at", "label"]], "sin frases, los momentos son los de la base");
});

test("C3 · sin message, el título de cada momento es IDÉNTICO al de la base (ejemplos, fixtures y esta Historia)", () => {
  const OLD = context(atBase);
  assert.deepEqual(run(LABELS(), project(BARE)), runIn(OLD, LABELS(), project(BARE)));
  assert.deepEqual(run(LABELS(), project(BARE)), ["Pide", "Pregunta", "Pide", "Pide", "Cae · Pregunta"]);
  let stories = 0;
  for (const f of corpus()) {
    const p = JSON.parse(read(f));
    const ALL = `(()=>{ let x; try{ x = projectFromProjectData(__a); }catch(e){ return e.code; } doc = x.doc;
      return x.doc.pages.map(pg => pg.scenarios.map(sc => FluyoStoryClock.describe("finished", sc, null, () => "", () => null).moments.map(m => m.label))); })()`;
    const now = run(ALL, p);
    assert.deepEqual(now, runIn(OLD, ALL, p), f);
    if (Array.isArray(now)) stories += now.flat().length;
  }
  assert.ok(stories >= 8, "corpus con Historias (" + stories + ")");
});

test("C4 · reproducción idéntica con y sin message: envíos, cues, horario visible y metadata (salvo el texto del globo de elemento)", () => {
  const SURF = `(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0]; const meta = FluyoStory.stepMeta(sc.steps);
    const s = FluyoStory.start(pg, sc, 0), ticks = [];
    for(let t = 0; t <= 7000; t += 125){ const rs = FluyoScenarioPlayback.tick(s.playback, t);
      ticks.push(JSON.stringify([rs.nodeStates, rs.activeSends, rs.completedSends, rs.activeOccurrences, rs.activeNodeEffects.map(e => [e.stepId, e.nodeId, e.virtualAt, e.duration, e.token])])); }
    return {ticks, schedule: JSON.stringify(FluyoStoryClock.schedule(sc, meta)),
      meta: JSON.stringify(Object.values(meta).map(m => Object.assign({}, m, {nodeEffects: Object.assign({}, m.nodeEffects, {message: 0})})))}; })()`;
  const deps = { arrivalDependencies: [{ stepId: 2, waitsForArrivalOf: [1] }] };
  for (const extra of [undefined, deps]) assert.deepEqual(run(SURF, project(STEPS, extra)), run(SURF, project(BARE, extra)), extra ? "con dependencias" : "sin dependencias");
  /* un envío no tiene globo: su message nunca llega a la pintura del lienzo */
  const cues = run(`(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0]; const s = FluyoStory.start(pg, sc, 0), seen = new Set();
    for(let t = 0; t <= 7000; t += 50) for(const e of FluyoStory.renderState(s.playback, sc, t).activeNodeEffects) seen.add(e.stepId + ":" + e.effects.message);
    return [...seen]; })()`, project(STEPS));
  assert.deepEqual(cues.sort(), ["2:La API comprueba la sesión", "5:Caída", "6:"].sort());
});

/* ═══════════════ D. Autoría por lote (el contrato del MCP) ═══════════════ */
const sop = (op, extra) => Object.assign({ op, scope: "story", pageIndex: 0, storyId: 1 }, extra);
const apply = (p, ops, C = K) => runIn(C, `(()=>{ const r = FluyoAuthoring.apply(__a.p, __a.ops); return r.ok
  ? {ok:true, steps: r.project.doc.pages[0].scenarios[0].steps, stories: r.project.doc.pages[0].scenarios, changes: r.changes}
  : {ok:false, errors: r.errors.map(e => ({code:e.code, field:e.field, message:e.message}))}; })()`, { p, ops });
test("D1 · add_step {message} en un evento FLOW (al final, en el mismo momento y al revés); inválido, INVALID_FIELD", () => {
  const p = project(BARE);
  const r = apply(p, [sop("add_step", { eventTypeId: 1, target: { edgeId: 4 }, message: "Cliente solicita checkout" }),
    sop("add_step", { eventTypeId: 1, target: { edgeId: 5, reverse: true }, placement: { sameMomentAs: 1 }, message: "La BD responde" })]);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.steps.find((s) => s.id === 7), send(7, 4600, 4, { message: "Cliente solicita checkout" }));
  assert.deepEqual(r.steps.find((s) => s.id === 8), send(8, 0, 5, { reverse: true, message: "La BD responde" }));
  for (const m of ["", "   ", "x".repeat(121), null, 5])
    assert.deepEqual(apply(p, [sop("add_step", { eventTypeId: 1, target: { edgeId: 4 }, message: m })]).errors.map((e) => [e.code, e.field]), [["INVALID_FIELD", "message"]], JSON.stringify(m));
});

test("D2 · set_step_message en un SEND: fija, cambia y quita (null); igual → changed:false; solo afecta a ese paso", () => {
  const p = project(STEPS);
  let r = apply(p, [sop("set_step_message", { stepId: 3, message: "La API consulta la BD" })]);
  assert.ok(r.ok);
  assert.deepEqual(r.steps.find((s) => s.id === 3), send(3, 1800, 5, { message: "La API consulta la BD" }));
  assert.deepEqual([r.changes[0].from, r.changes[0].to, r.changes[0].changed], [null, "La API consulta la BD", true]);
  assert.deepEqual(r.changes[0].affects.stories.map((s) => s.stepIds), [[3]]);
  r = apply(p, [sop("set_step_message", { stepId: 1, message: "Cambiado" }), sop("set_step_message", { stepId: 4, message: null })]);
  assert.deepEqual(r.steps[0], send(1, 0, 4, { message: "Cambiado" }));
  assert.deepEqual(r.steps[3], send(4, 2700, 5, { reverse: true }), "null la quita; el sentido se queda");
  assert.equal(apply(p, [sop("set_step_message", { stepId: 1, message: "El usuario pide su saldo" })]).changes[0].changed, false);
  assert.equal(apply(p, [sop("set_step_message", { stepId: 3, message: null })]).changes[0].changed, false);
  for (const m of ["", "  ", "x".repeat(121), 3]) assert.deepEqual(apply(p, [sop("set_step_message", { stepId: 3, message: m })]).errors.map((e) => e.code), ["INVALID_FIELD"], JSON.stringify(m));
});

test("D3 · duplicate_story y duplicate_step conservan el message de un envío; remove_step se lo lleva", () => {
  const p = project(STEPS);
  let r = apply(p, [{ op: "duplicate_story", scope: "story", pageIndex: 0, storyId: 1 }]);
  assert.ok(r.ok);
  assert.deepEqual(r.stories[1].steps.filter((s) => s.message).map((s) => [s.action, s.message]), STEPS.filter((s) => s.message).map((s) => [s.action, s.message]));
  r = apply(p, [sop("duplicate_step", { stepId: 4 })]);
  assert.deepEqual(r.steps.find((s) => s.id === 7), Object.assign({}, STEPS[3], { id: 7 }), "la copia es idéntica (también reverse y message)");
  r = apply(p, [sop("remove_step", { stepId: 1 })]);
  assert.ok(!r.steps.some((s) => s.message === "El usuario pide su saldo"));
});

test("D4 · el editor duplica la Historia (duplicateScenario) y un paso (duplicateStep) con el message del envío", () => {
  const out = run(`(()=>{ const p = ${LOAD}, pg = p.doc.pages[0], sc = pg.scenarios[0];
    const dup = duplicateStep(sc, 1), ds = duplicateScenario(pg, 1);
    return {dup: dup.message, ds: ds.steps.filter(s => s.message !== undefined).map(s => [s.id, s.message])}; })()`, project(STEPS));
  assert.equal(out.dup, "El usuario pide su saldo");
  assert.deepEqual(out.ds.map((x) => x[1]), ["El usuario pide su saldo", "El usuario pide su saldo", "La API comprueba la sesión", "La BD devuelve el saldo"]);
});

/* ═══════════════ E. Editor: «Mensaje del paso…» en un envío ═══════════════ */
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
  "scDuplicateStep", "scSetArrivalDependencies", "scUseTarget", "scStepMessage", "scMessageMenuItem", "scSetStepMessage"];
function editor(src = read("js/editor-scenarios.js")) {
  const fakeNode = (tag) => ({ tag, children: [], textContent: "", className: "", classList: { add() {}, contains() { return false; } }, appendChild(c) { this.children.push(c); return c; } });
  const els = {}, $ = (id) => (els[id] = els[id] || fakeNode(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, $, GRID: 20, innerWidth: 1280, innerHeight: 800,
    document: { createElement: fakeNode, createTextNode: (t) => ({ textContent: t, children: [] }) } });
  const R = (code) => vm.runInContext(code, ctx);
  for (const f of KERNEL.slice(0, 9)) vm.runInContext(read("js/" + f), ctx, { filename: f });
  /* los textos nuevos de «Mensaje del paso…» pasan por FluyoI18n (decisión 261): el runtime real, en español */
  vm.runInContext(read("js/i18n.js"), ctx, { filename: "i18n.js" });
  R(`var selN=new Set(), selE=new Set(), clip=null, scPlayback=null, scStatus="idle", scActive=1, scPlacement=null, scContext=null, scSelectedStep=null, __commits=0, __menu=null, __notices=[];
     function confirm(){ return true; } function alert(){} function refreshPanel(){} function renderTabs(){} function scheduleAutosave(){}
     function isScenarioPlaybackActive(){ return scStatus==="running"; } function scActiveScenario(){ return P().scenarios.find(s=>s.id===scActive) || null; }
     function scCancelPlacement(){ scPlacement=null; } function scCommit(){ __commits++; } function scNotice(t){ __notices.push(t); }
     function scMenuSections(anchor, menu){ __menu = menu; } function scArrivalMenuItem(){ return { label: "Esperar a que llegue…" }; }
     function scVisibleAt(step){ return step.at; }`);
  R(read("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  vm.runInContext(ED_FNS.map((n) => extract(src, n)).join("\n"), ctx, { filename: "js/editor-scenarios.js#extract" });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0; __commits=0; scSelectedStep=null;");
  const menu = (id) => { R(`__menu=null; scStoryMenu(scActiveScenario().steps.find(s=>s.id===${id}), null)`);
    return J(R("__menu.sections.map(sec => sec.map(it => ({label: it.label, hint: it.hint || '', disabled: !!it.disabled})))")); };
  return { R, load, menu, steps: () => J(R("scActiveScenario().steps")) };
}
test("E1 · menú de un envío: «Mensaje del paso…» tras «Invertir sentido»; el hint dice lo que se lee ahora; el resto, como en la base", () => {
  const { undoNarr } = require("./fluyo-product-narration-001-undo.cjs");
  const e = editor(), base = editor(undoNarr("js/editor-scenarios.js", read("js/editor-scenarios.js")));
  e.load(project(STEPS)); base.load(project(STEPS));
  assert.deepEqual(e.menu(3)[1], [{ label: "Cambiar dónde ocurre…", hint: "Ahora: API → DB", disabled: false }, { label: "Invertir sentido", hint: "Pasa a: DB → API", disabled: false },
    { label: "Mensaje del paso…", hint: "Ahora se lee «Pide»", disabled: false }]);
  assert.deepEqual(e.menu(1)[1][2], { label: "Mensaje del paso…", hint: "«El usuario pide su saldo»", disabled: false });
  for (const id of [1, 3, 4]) assert.deepEqual(e.menu(id).map((sec) => sec.filter((it) => it.label !== "Mensaje del paso…")), base.menu(id).map((sec) => sec.filter((it) => it.label !== "Mensaje del paso…")), "envío " + id);
  for (const id of [2, 5, 6]) assert.deepEqual(e.menu(id), base.menu(id), "un paso de elemento: su menú no cambia (" + id + ")");
});

test("E2 · en un envío, guardar, cambiar y quitar: UNA entrada de Undo cada vez; Undo/Redo exactos; la selección no cambia; sin cambio, nada", () => {
  const e = editor();
  e.load(project(BARE));
  e.R("scSelectedStep = 3");
  const s0 = e.steps();
  assert.equal(e.R(`scSetStepMessage(3, "La API consulta la BD")`), true);
  const s1 = e.steps();
  assert.deepEqual(s1[2], send(3, 1800, 5, { message: "La API consulta la BD" }));
  assert.equal(e.R("undoStack.length"), 1); assert.equal(e.R("__commits"), 1); assert.equal(e.R("scSelectedStep"), 3);
  assert.equal(e.R(`scSetStepMessage(3, "La API consulta la BD")`), false, "el mismo texto: ni Undo ni commit");
  assert.equal(e.R(`scSetStepMessage(3, "La API lee el saldo")`), true, "cambiar");
  const s2 = e.steps();
  assert.equal(e.R(`scSetStepMessage(3, null)`), true, "quitar");
  assert.deepEqual(e.steps(), s0, "sin la clave: el original");
  assert.equal(e.R("undoStack.length"), 3);
  e.R("undo()"); assert.deepEqual(e.steps(), s2);
  e.R("undo()"); assert.deepEqual(e.steps(), s1);
  e.R("undo()"); assert.deepEqual(e.steps(), s0, "Undo ×3: el original exacto");
  e.R("redo()"); e.R("redo()"); e.R("redo()"); assert.deepEqual(e.steps(), s0, "Redo ×3: sin mensaje otra vez");
  e.R("undo()"); assert.deepEqual(e.steps(), s2);
  assert.equal(e.R(`scSetStepMessage(4, null)`), false, "quitar lo que no hay: nada");
  assert.equal(e.R("scSelectedStep"), 3);
});

test("E3 · la fila del paso enseña el message de un envío bajo la frase (scStepMessage ya no excluye SEND)", () => {
  const src = read("js/editor-scenarios.js");
  assert.match(extract(src, "scStepMessage"), /typeof step\.message === "string"/);
  assert.doesNotMatch(extract(src, "scStepMessage"), /SEND/);
  assert.doesNotMatch(extract(src, "scSetStepMessage"), /SEND/);
});

/* ═══════════════ F. Share y lectores anteriores ═══════════════ */
test("F1 · Share: el enlace #d= de la Historia conserva el message de los envíos EXACTO de ida y vuelta", async () => {
  const L = context(read, ["config.js", "safe-svg.js", "model.js", "geometry.js", "link-codec.js", "share-url.js"]);
  L.__a = project(STEPS);
  const back = await vm.runInContext(`createShareUrl(__a, "https://fluyo.space/", {kind:"story", scenarioId:1}).then(u => decodeDeepLink(new URL(u).hash.slice(3))).then(x => JSON.stringify([x.doc.pages[0].scenarios[0].steps, projectFromProjectData(x).doc.pages[0].scenarios[0].steps]))`, L);
  assert.deepEqual(JSON.parse(back), [STEPS, STEPS]);
});

function corpus() {
  const files = [];
  for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of fs.readdirSync(path.join(root, dir))) if (/\.json$/.test(f)) files.push(dir + "/" + f);
  return files;
}
test("F2 · documentos antiguos (ejemplos y fixtures): carga, guardado, integridad, Trace, outcomes, stepMeta y títulos IDÉNTICOS a " + BASE, () => {
  const OLD = context(atBase);
  const SURFACE = `(()=>{ let loaded; try{ loaded = projectFromProjectData(__a); }catch(e){ return {load:e.code}; }
    const out = {saved: JSON.stringify(projectToSerializable(loaded.doc, loaded.settings)), integrity: JSON.stringify(FluyoIntegrity.validateProject(__a)), pages: []};
    loaded.doc.pages.forEach((pg, i) => { doc = loaded.doc; doc.cur = i;
      for(const sc of pg.scenarios){ const r = FluyoStory.run(pg, sc); const row = {run: JSON.stringify(r)};
        if(r.ok){ const meta = FluyoStory.stepMeta(sc.steps); row.outcomes = JSON.stringify(FluyoStory.outcomes(r.trace, sc, pg)); row.meta = JSON.stringify(meta);
          row.labels = JSON.stringify(FluyoStoryClock.describe("finished", sc, null, () => "", () => null).moments); }
        out.pages.push(row); } });
    return out; })()`;
  let docs = 0;
  for (const f of corpus()) { const p = JSON.parse(read(f)); assert.deepEqual(run(SURFACE, p), runIn(OLD, SURFACE, p), f); docs++; }
  assert.ok(docs >= 10, docs + " documentos");
});

test("F3 · un lector anterior (" + BASE + ") RECHAZA un envío con message (no lo lee mal); sin él, abre igual; con message solo en elementos, abre", () => {
  const OLD = context(atBase);
  assert.equal(loads(project(STEPS), OLD), "invalid_document");
  assert.equal(loads(project(BARE), OLD), "abre");
  assert.equal(loads(project(STEPS.map((s) => (s.action === "SEND" ? (({ message, ...x }) => x)(s) : s))), OLD), "abre", "decisión 255: en elementos ya lo leía");
  assert.deepEqual(runIn(OLD, `FluyoAuthoring.apply(__a, [{op:"set_step_message", scope:"story", pageIndex:0, storyId:1, stepId:1, message:"x"}]).errors.map(e=>[e.code, e.field])`, project(BARE)), [["INVALID_OPERATION", "message"]]);
});

/* ═══════════════ G. Caso real: Cliente → API → Pagos → PSP → Base de datos ═══════════════ */
const CASE = [["SEND", 6, "Cliente solicita el checkout del carrito"], ["OCCURRENCE", 2, "Checkout valida la sesión del cliente"], ["SEND", 7, "Checkout pide a Pagos cobrar $49"],
  ["SEND", 8, "Pagos cobra la tarjeta en el PSP"], ["SEND", 8, "El PSP confirma el pago", true], ["SEND", 9, "El pedido queda confirmado y pagado"]];
function checkout(variant) {
  const N = (id, label) => ({ id, shape: "rect", x: id * 250, y: 300, w: 170, h: 64, label });
  const nodes = [N(1, "Cliente (web)"), N(2, "API Checkout"), N(3, "Servicio Pagos"), N(4, "PSP (Stripe)"), N(5, "Base de datos")];
  const edges = [edge(6, 1, 2), edge(7, 2, 3), edge(8, 3, 4), edge(9, 3, 5)];
  let ets, steps;
  if (variant === "artificial") {   // lo de antes: un EventType por frase
    ets = CASE.map(([a, , s], i) => a === "SEND" ? { id: i + 1, name: s, primitive: "FLOW", sentenceTemplate: "{source} → {target}", visual: { kind: "token", value: "●" } }
      : { id: i + 1, name: s, primitive: "OCCURRENCE", sentenceTemplate: "{target}", visual: { kind: "token", value: "✓" }, presentation: { nodeEffects: { message: s } } });
    steps = CASE.map(([a, t, , r], i) => Object.assign({ id: i + 1, at: i * 1600, eventTypeId: i + 1, action: a }, a === "SEND" ? { edgeId: t } : { nodeId: t }, r ? { reverse: true } : {}));
  } else {                           // ahora: dos eventos y la frase en cada paso
    ets = [{ id: 1, name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { kind: "token", value: "●" } },
      { id: 2, name: "Comprobación", primitive: "OCCURRENCE", sentenceTemplate: "{target} comprueba", visual: { kind: "token", value: "✓" }, presentation: { nodeEffects: { message: "" } } }];
    steps = CASE.map(([a, t, s, r], i) => Object.assign({ id: i + 1, at: i * 1600, eventTypeId: a === "SEND" ? 1 : 2, action: a }, a === "SEND" ? { edgeId: t } : { nodeId: t }, r ? { reverse: true } : {}, variant === "narrated" ? { message: s } : {}));
  }
  return { version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: ets, nextEventTypeId: ets.length + 1, cur: 0,
    pages: [{ name: "Checkout", nextId: 100, behaviors: [], nextScenarioId: 2, nodes, edges, scenarios: [story(1, steps, { name: "Pago con tarjeta" })] }] }, settings: {} };
}
test("G1 · caso real: con 2 eventos y message se lee la MISMA Historia que con 6 eventos artificiales; sin message, «Petición» ×5", () => {
  assert.deepEqual(run(LABELS(), checkout("narrated")), CASE.map((c) => c[2]));
  assert.deepEqual(run(LABELS(), checkout("artificial")), CASE.map((c) => c[2]), "lo de antes, con un evento por frase");
  assert.deepEqual(run(LABELS(), checkout("before")), ["Petición", "Comprobación", "Petición", "Petición", "Petición", "Petición"]);
  const SURF = `(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0]; const r = FluyoStory.run(pg, sc);
    return {trace: JSON.stringify(r.trace), schedule: JSON.stringify(FluyoStoryClock.schedule(sc, FluyoStory.stepMeta(sc.steps)))}; })()`;
  assert.deepEqual(run(SURF, checkout("narrated")), run(SURF, checkout("before")), "mismo Trace y horario visible");
  const lib = (v) => checkout(v).doc.eventTypes.length;
  assert.deepEqual([lib("narrated"), lib("artificial")], [2, 6], "la biblioteca no se llena de eventos de un solo uso");
  assert.ok(JSON.stringify(checkout("narrated")).length < JSON.stringify(checkout("artificial")).length, "y el documento es más pequeño");
});

/* ═══════════════ H. Alcance ═══════════════ */
test("H1 · versiones: engineVersion 2 y version 5 (NO v3); sw.js sube a v106 y solo cambia la constante", () => {
  assert.equal(run("FluyoScenarios.ENGINE_VERSION"), 2);
  assert.equal(run("projectToSerializable({}, {}).version"), 5);
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v111";/);
  /* FLUYO-SW-VIEWER-001 va encima: su instalación del Viewer y sus navegaciones a /s/ se deshacen antes (undoSwv) */
  const { undoSwv } = require("./fluyo-sw-viewer-001-undo.cjs");
  assert.equal(undoSwv("sw.js", read("sw.js")).replace('"fluyo-static-v111"', '"fluyo-static-v' + (106 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante (el precache no cambia)");
});

test("H2 · alcance frente a " + BASE + ": solo cambian estos archivos servidos (index.html y s/index.html, no) y undoNarr los devuelve EXACTOS", () => {
  const SERVED = ["js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !shellOnly(f, read, atBase));
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const { undoNarr, PIECES } = require("./fluyo-product-narration-001-undo.cjs");
  const FILES = ["css/share.css", "css/styles.css", "docs/index.html", "js/editor-scenarios.js", "js/i18n-en.js", "js/model.js", "js/present-story.js", "js/scenario-engine.js", "js/story-authoring.js", "js/story-playback.js", "js/viewer.js"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoNarr(f, read(f)), atBase(f), f);
  for (const f of ["js/viewer-viewport.js", "js/render.js", "js/scenario-playback.js", "js/story-clock.js", "index.html", "s/index.html"]) assert.equal(undoShell(f, read(f)), atBase(f), f + " sin cambios (FLUYO-SHELL-001, encima, solo cambia el favicon)");
  const { undoI18n } = require("./fluyo-i18n-001-undo.cjs");
  assert.ok(read("test/fluyo-i18n-001-undo.cjs").includes("src = undoNarr(file, src);"), "undoI18n deshace antes esta tarea");
  for (const f of FILES) assert.equal(undoI18n(f, read(f)), undoI18n(f, atBase(f)), "undoI18n la lleva debajo: " + f);
});
