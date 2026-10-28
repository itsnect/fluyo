"use strict";
/* FLUYO-MCP-STEP-MESSAGE-001 — `message` en un Step de elemento: el texto del globo de ESA ocurrencia (decisión 255; contrato en
   .ai/tasks/FLUYO-MCP-STEP-MESSAGE-001.md). Presentación pura: ni el motor ni el reloj lo leen.
   · Kernel (model.js): validatePersistedStep (solo OCCURRENCE/SET_STATE; 1..120 UTF-16 con algo más que espacios; "" y solo espacios se
     RECHAZAN; nunca se trunca), stepDefinitionForEvent, setStepMessage; guardar/abrir y todo lo que copia Steps lo conserva tal cual.
   · Motor e integridad: el motor lo ignora en pasos de elemento (como eventTypeId) y lo rechaza en un SEND; FluyoIntegrity da invalid_step.
   · Playback (editor, Present y Viewer): stepMeta pone el texto del paso en el globo, con el estilo y la duración del evento. La frase y
     el título del momento siguen siendo los del evento. Trace, outcomes y horario visible: idénticos con y sin mensaje.
   · Autoría por lote: add_step {message} y set_step_message {stepId, message|null}.
   · Editor: «Mensaje del paso…» (solo eventos de elemento), una entrada de Undo; Undo/Redo exactos.
   · Share (#d=) y caso real (test/fixtures/step-message/rag-mcp.fluyo.json: 38 pasos, 9 eventos → 5 con message).
   · Un lector anterior (2da088e) lo RECHAZA. Alcance frente a 2da088e. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { shellOnly } = require("./fluyo-shell-001-undo.cjs");   /* FLUYO-SHELL-001 (páginas públicas, favicon, manifest): lo suyo se descuenta */
const root = path.resolve(__dirname, "..");
const { historicalExamples } = require("./corpus-historico.cjs");   /* FLUYO-EXAMPLES-001: el corpus de esta slice es el de su commit; los ejemplos nuevos los cubren sus propios tests */
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "2da088e";   // main al empezar (producción v101, SCENARIOS-SEMANTICS-001 FASE 6)
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
const STEPS = [occ(1, 0, U, { message: "¿Cuál es mi saldo?" }), send(2, 900, 4), send(3, 1100, 5), down(4, 2000, D, { message: "La BD no responde" }), occ(5, 2000, A)];
const LOAD = "projectFromProjectData(__a)";
const loads = (p) => run(`(()=>{ try{ ${LOAD}; return "abre"; }catch(e){ return e.code; } })()`, p);

/* ── caso real: el documento de la prueba agéntica (10 nodos, 3 Historias, 38 pasos, 9 eventos), y la variante con 5 eventos ── */
const RAG = JSON.parse(read("test/fixtures/step-message/rag-mcp.fluyo.json"));
/* 3, 4 y 5 («Pregunta: …») y 6, 7 y 8 («Decide: …») solo difieren en el texto: se funden en «Pregunta» y «Decide» y cada paso lleva su
   texto en `message`; Envía, Devuelve y Recibe respuesta (usado 3 veces con el mismo texto) se quedan. */
function ragWithMessages(withMessages = true) {
  const ets = RAG.doc.eventTypes, base = (id) => J(ets.find((e) => e.id === id));
  const remap = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5 };
  const pregunta = Object.assign(base(3), { id: 3, name: "Pregunta", sentenceTemplate: "{target} pregunta" }); pregunta.presentation.nodeEffects.message = "";
  const decide = Object.assign(base(6), { id: 4, name: "Decide", sentenceTemplate: "{target} decide la ruta" }); decide.presentation.nodeEffects.message = "";
  const out = J(RAG);
  out.doc.eventTypes = [base(1), base(2), pregunta, decide, Object.assign(base(9), { id: 5 })]; out.doc.nextEventTypeId = 6;
  for (const sc of out.doc.pages[0].scenarios) sc.steps = sc.steps.map((st) => {
    const s = Object.assign({}, st, { eventTypeId: remap[st.eventTypeId] });
    if (withMessages && st.eventTypeId >= 3 && st.eventTypeId <= 8) s.message = ets.find((e) => e.id === st.eventTypeId).presentation.nodeEffects.message;
    return s;
  });
  return out;
}

/* ═══════════════ A. Forma y carga (model.js) ═══════════════ */
test("A1 · validatePersistedStep: message en OCCURRENCE y SET_STATE (cualquier versión del motor); límites en unidades UTF-16; nunca se trunca", () => {
  const v = (step, ev = 2) => run(`(()=>{ try{ validatePersistedStep(__a, ${ev}); return "ok"; }catch(e){ return e.code; } })()`, step);
  const s118 = "a".repeat(118), s119 = "a".repeat(119), emoji = "😀";
  assert.equal("x".repeat(120).length, 120);
  for (const m of ["¿Cuál es mi saldo?", "x", "x".repeat(120), s118 + emoji, "  con espacios  ", "שלום · 你好 · é", "dos\nlíneas"])
    for (const s of [occ(1, 0, U, { message: m }), down(1, 0, U, { message: m })]) assert.equal(v(s), "ok", JSON.stringify(m) + " " + s.action);
  assert.equal(v(down(1, 0, U, { message: "en v1" }), 1), "ok", "como eventTypeId, vale en un SET_STATE de una Historia v1");
  for (const m of ["", " ", "   ", "\t\n ", "x".repeat(121), s119 + emoji, null, 42, true, {}, ["x"]])
    assert.equal(v(occ(1, 0, U, { message: m })), "invalid_document", JSON.stringify(m));
  /* PRODUCT-NARRATION-001 (decisión 258): un SEND también admite message; las mismas reglas de texto */
  for (const s of [send(1, 0, 4, { message: "hola" }), send(1, 0, 4, { message: "hola", reverse: true })]) assert.equal(v(s), "ok", "SEND: " + JSON.stringify(s));
  assert.equal(v(send(1, 0, 4, { message: "" })), "invalid_document", "SEND con \"\"");
  assert.equal(v({ id: 1, at: 0, action: "OCCURRENCE", nodeId: 1, message: "sin evento" }), "ok", "un paso sin eventTypeId también");
});

test("A2 · carga: sin message, lo de siempre; con message, ida y vuelta EXACTA (sin trim, sin normalizar); \"\" o solo espacios no abren", () => {
  const p = project(STEPS);
  const out = run(`(()=>{ const once = ${LOAD}; const saved = JSON.stringify(projectToSerializable(once.doc, once.settings));
    const twice = projectFromProjectData(JSON.parse(saved)); return [once.doc.pages[0].scenarios[0].steps, saved === JSON.stringify(projectToSerializable(twice.doc, twice.settings))]; })()`, p);
  assert.deepEqual(out[0], STEPS, "los Steps tal cual, también el orden de claves");
  assert.ok(out[1], "guardar/abrir/guardar: idéntico");
  const raw = project([occ(1, 0, U, { message: "  hola   " }), occ(2, 1000, A, { message: "שלום 😀" })]);
  assert.deepEqual(run(`${LOAD}.doc.pages[0].scenarios[0].steps.map(s => s.message)`, raw), ["  hola   ", "שלום 😀"]);
  for (const m of ["", "   ", "x".repeat(121), null]) assert.equal(loads(project([occ(1, 0, U, { message: m })])), "invalid_document", JSON.stringify(m));
  assert.equal(loads(project([send(1, 0, 4, { message: "x" })])), "abre", "SEND (decisión 258)");
});

test("A3 · stepDefinitionForEvent y setStepMessage: solo eventos de elemento; null quita la clave; nada más cambia", () => {
  assert.deepEqual(run(`stepDefinitionForEvent(__a[1], 1, 0, undefined, "hola")`, ETS), { at: 0, eventTypeId: 2, action: "OCCURRENCE", nodeId: 1, message: "hola" });
  assert.deepEqual(run(`stepDefinitionForEvent(__a[2], 1, 0, undefined, "cae")`, ETS), { at: 0, eventTypeId: 3, action: "SET_STATE", nodeId: 1, state: "DOWN", message: "cae" });
  assert.deepEqual(run(`stepDefinitionForEvent(__a[1], 1, 0)`, ETS), { at: 0, eventTypeId: 2, action: "OCCURRENCE", nodeId: 1 }, "sin message, sin clave");
  assert.deepEqual(run(`stepDefinitionForEvent(__a[0], 4, 0, undefined, "hola")`, ETS), { at: 0, eventTypeId: 1, action: "SEND", edgeId: 4, message: "hola" }, "FLOW (decisión 258)");
  for (const [i, m] of [[1, ""], [1, "  "], [1, "x".repeat(121)], [1, null]])
    assert.deepEqual(err(`stepDefinitionForEvent(__a[${i}], 1, 0, undefined, ${JSON.stringify(m)})`, ETS), { code: "invalid_document" }, `${i} ${JSON.stringify(m)}`);
  const r = run(`(()=>{ const d = ${LOAD}.doc, sc = d.pages[0].scenarios[0], before = JSON.stringify(sc);
    const a = JSON.stringify(setStepMessage(sc, 5, "nuevo")), b = JSON.stringify(setStepMessage(sc, 1, null)), c = JSON.stringify(setStepMessage(sc, 4, "otro"));
    const errs = [[2,"x"],[5,""],[5,"   "],[5,"x".repeat(121)],[99,"x"],[5,undefined],[5,7]].map(([id,m]) => { try{ setStepMessage(sc, id, m); return "ok"; }catch(e){ return e.code; } });
    return {a, b, c, errs, steps: sc.steps, deps: sc.arrivalDependencies || null, before}; })()`, project(STEPS));
  assert.deepEqual(JSON.parse(r.a), occ(5, 2000, A, { message: "nuevo" }));
  assert.deepEqual(JSON.parse(r.b), occ(1, 0, U), "null quita la clave");
  assert.deepEqual(JSON.parse(r.c), down(4, 2000, D, { message: "otro" }));
  assert.deepEqual(r.errs, ["ok", "invalid_document", "invalid_document", "invalid_document", "step_not_found", "invalid_document", "invalid_document"], "el SEND (2) ya admite message (decisión 258)");
  assert.deepEqual(r.steps.map(({ message, ...s }) => s), STEPS.map(({ message, ...s }) => s), "id, at, orden, objetivo y evento intactos");
});

/* ═══════════════ B. Motor, integridad y los tres lectores ═══════════════ */
test("B1 · motor: message es presentación en pasos de elemento (no es un campo de más); en un SEND sí (extra_fields)", () => {
  const scen = (steps) => ({ id: 1, engineVersion: 2, name: "H", nextStepId: 9, steps });
  const S = { nodes: [{ id: 1 }, { id: 2 }], edges: [{ id: 3, from: 1, to: 2 }] };
  const ok = run(`FluyoScenarios.runScenario(__a.s, [], __a.sc)`, { s: S, sc: scen([{ id: 1, at: 0, action: "OCCURRENCE", nodeId: 1, message: "x" }, { id: 2, at: 0, action: "SET_STATE", nodeId: 2, state: "DOWN", message: "y" }]) });
  assert.equal(ok.ok, true);
  /* PRODUCT-NARRATION-001 (decisión 258): en un SEND ya no es un campo de más */
  const sendOk = run(`FluyoScenarios.runScenario(__a.s, [], __a.sc).ok`, { s: S, sc: scen([{ id: 1, at: 0, action: "SEND", edgeId: 3, message: "x" }]) });
  assert.equal(sendOk, true);
});

test("B2 · FluyoIntegrity: un message inválido es invalid_step del paso; uno válido no es un error", () => {
  const check = (p) => run(`FluyoIntegrity.validateProject(__a)`, p);
  assert.equal(check(project(STEPS)).valid, true);
  for (const m of ["", "   ", "x".repeat(121), 7]) {
    const r = check(project([occ(1, 0, U), occ(2, 10, A, { message: m })]));
    assert.deepEqual(r.errors.map((e) => [e.code, e.stepId]), [["invalid_step", 2]], JSON.stringify(m));
  }
  assert.deepEqual(check(project([send(1, 0, 4, { message: "x" })])).errors, [], "SEND (decisión 258)");
  assert.deepEqual(check(project([send(1, 0, 4, { message: " " })])).errors.map((e) => [e.code, e.stepId]), [["invalid_step", 1]]);
});

/* ═══════════════ C. Playback (editor, Present y Viewer): el globo; nada temporal cambia ═══════════════ */
const META = `(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0];
  return FluyoStory.stepMeta(sc.steps); })()`;
test("C1 · stepMeta: el globo dice el texto del paso con el estilo y la duración del evento; sin message, el del evento; sin evento, el de por defecto", () => {
  const m = run(META, project([...STEPS, { id: 6, at: 3000, action: "OCCURRENCE", nodeId: U, message: "sin evento" }]));
  const typeFx = run(`(()=>{ const {symbol, ...fx} = nodeEffectsVisualSpec(__a); return fx; })()`, ETS[1]);
  assert.deepEqual(m[1].nodeEffects, Object.assign({}, typeFx, { message: "¿Cuál es mi saldo?" }), "solo cambia message");
  assert.equal(m[1].nodeEffects.visualDurationMs, 3000, "la duración del evento («long»), no la del texto");
  assert.equal(m[4].nodeEffects.message, "La BD no responde", "SET_STATE: también");
  assert.equal(m[5].nodeEffects.message, "", "sin message: el del evento (vacío)");
  assert.deepEqual(m[6].nodeEffects, Object.assign(run("defaultNodeEffects()"), { message: "sin evento" }));
  assert.equal(run(META, project([down(1, 0, D)]))[1].nodeEffects.message, "Caída", "sin message, el del evento");
  assert.deepEqual([m[1].name, m[1].token, m[1].motion], ["Pregunta", "?", "normal"], "nombre, símbolo y movimiento: del evento");
});

test("C2 · la frase y el título del momento (Present, Viewer) siguen siendo los del evento", () => {
  const out = run(`(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0];
    return {sentences: sc.steps.map(s => FluyoStory.sentence(pg, s, eventTypeById(s.eventTypeId))),
            labels: FluyoStory.describe("ready", sc, null, () => "", () => null).moments.map(x => x.label)}; })()`, project(STEPS));
  assert.deepEqual(out.sentences, ["Usuario pregunta", "Usuario pide a API", "API pide a DB", "DB cae", "API pregunta"]);
  /* PRODUCT-NARRATION-001 (decisión 258): el título de un momento dice el message de cada paso que lo tiene; el resto, su evento */
  assert.deepEqual(out.labels, ["¿Cuál es mi saldo?", "Pide", "Pide", "La BD no responde · Pregunta"]);
});

test("C3 · la reproducción (FluyoStory.start → tick, la receta de editor, Present y Viewer) pinta el texto del paso en el globo de su nodo", () => {
  const out = run(`(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0];
    const s = FluyoStory.start(pg, sc, 0); const at = t => FluyoStory.renderState(s.playback, sc, t).activeNodeEffects.map(e => [e.stepId, e.nodeId, e.effects.message]);
    return [at(10), at(2050)]; })()`, project(STEPS));
  assert.deepEqual(out[0], [[1, U, "¿Cuál es mi saldo?"]]);
  assert.deepEqual(out[1], [[1, U, "¿Cuál es mi saldo?"], [4, D, "La BD no responde"], [5, A, ""]]);
});

test("C4 · Trace, outcomes y horario visible BYTE A BYTE iguales con y sin message (también al cambiarlo); el playback solo cambia el texto", () => {
  const SURF = `(()=>{ const p = ${LOAD}; doc = p.doc; const pg = doc.pages[0], sc = pg.scenarios[0];
    const r = FluyoStory.run(pg, sc), meta = FluyoStory.stepMeta(sc.steps);
    const s = FluyoStory.start(pg, sc, 0), ticks = [];
    for(let t = 0; t <= 6000; t += 150){ const rs = FluyoScenarioPlayback.tick(s.playback, t);
      ticks.push(JSON.stringify([rs.nodeStates, rs.activeSends, rs.completedSends, rs.activeOccurrences, rs.activeNodeEffects.map(e => [e.stepId, e.nodeId, e.virtualAt, e.duration])])); }
    return {trace: JSON.stringify(r.trace), outcomes: JSON.stringify(FluyoStory.outcomes(r.trace, sc, pg)), schedule: JSON.stringify(FluyoStoryClock.schedule(sc, meta)), ticks,
      fx: JSON.stringify(Object.values(meta).map(m => Object.assign({}, m.nodeEffects, {message: 0})))}; })()`;
  const bare = STEPS.map(({ message, ...s }) => s);
  const deps = { arrivalDependencies: [{ stepId: 4, waitsForArrivalOf: [3] }] };
  for (const extra of [undefined, deps]) {
    const a = run(SURF, project(bare, extra));
    for (const m of [STEPS, STEPS.map((s) => (s.action === "SEND" ? s : Object.assign({}, s, { message: "x".repeat(120) })))]) assert.deepEqual(run(SURF, project(m, extra)), a, extra ? "con dependencias" : "sin dependencias");
  }
});

test("C5 · caso real (38 pasos): con 5 eventos y message, Trace, outcomes, horario visible y metadata de cada paso (salvo el nombre) idénticos al original", () => {
  const SURF = `(()=>{ const p = ${LOAD}; doc = p.doc; return doc.pages[0].scenarios.map(sc => { const pg = doc.pages[0];
    const r = FluyoStory.run(pg, sc), meta = FluyoStory.stepMeta(sc.steps);
    return {trace: JSON.stringify(r.trace), outcomes: JSON.stringify(FluyoStory.outcomes(r.trace, sc, pg).map(({eventTypeId, ...o}) => o)),
      schedule: JSON.stringify(FluyoStoryClock.schedule(sc, meta)), meta: JSON.stringify(Object.values(meta).map(({name, ...m}) => m)), steps: sc.steps.length}; }); })()`;
  const orig = run(SURF, RAG), now = run(SURF, ragWithMessages()), plain = run(SURF, ragWithMessages(false));
  assert.equal(orig.reduce((n, s) => n + s.steps, 0), 38);
  assert.deepEqual(now, orig, "el globo de cada paso es el mismo texto que antes daba su evento de un solo uso");
  for (let i = 0; i < 3; i++) for (const k of ["trace", "outcomes", "schedule"]) assert.equal(plain[i][k], orig[i][k], `sin mensajes: ${k} igual (H${i + 1})`);
  assert.equal(ragWithMessages().doc.eventTypes.length, 5);
  assert.ok(JSON.stringify(ragWithMessages()).length < JSON.stringify(RAG).length * 0.9, "el documento baja más de un 10 %");
});

/* ═══════════════ D. Lo que copia o mueve Steps lo conserva ═══════════════ */
test("D1 · duplicateStep, retargetStep, storyboard (esperas, mover, quitar otro), duplicateScenario e importPagesIn conservan message", () => {
  const out = run(`(()=>{ const p = ${LOAD}, pg = p.doc.pages[0], sc = pg.scenarios[0];
    const dup = duplicateStep(sc, 1); retargetStep(pg, sc, 1, ${A}); retargetStep(pg, sc, 4, ${U});
    let r = storyboardSetWait(sc.steps, 4, 500, 86400000); sc.steps = r.steps;
    r = storyboardMoveByOne(sc.steps, 4, -1); if(r) sc.steps = r.steps;
    r = storyboardMoveStep(sc.steps, 1, {kind:"join", anchorId:2, after:true}); if(r) sc.steps = r.steps;
    sc.steps = storyboardRemoveStep(sc.steps, 3).steps;
    const ds = duplicateScenario(pg, 1);
    const other = projectFromProjectData(__a); const imp = importPagesIn(p.doc, other.doc);
    const msgs = steps => steps.filter(s => s.message !== undefined).map(s => [s.id, s.message]).sort((a,b) => a[0]-b[0]);
    return {dup: dup.message, sc: msgs(sc.steps), ds: msgs(ds.steps), imp: msgs(imp.pages[0].scenarios[0].steps),
            targets: [sc.steps.find(s=>s.id===1).nodeId, sc.steps.find(s=>s.id===4).nodeId]}; })()`, project(STEPS));
  assert.equal(out.dup, "¿Cuál es mi saldo?");
  assert.deepEqual(out.sc, [[1, "¿Cuál es mi saldo?"], [4, "La BD no responde"], [6, "¿Cuál es mi saldo?"]]);
  assert.deepEqual(out.ds, out.sc);
  assert.deepEqual(out.imp, [[1, "¿Cuál es mi saldo?"], [4, "La BD no responde"]]);
  assert.deepEqual(out.targets, [A, U], "el texto es de la ocurrencia, no del objetivo");
});

/* ═══════════════ E. Autoría por lote (story-authoring.js) ═══════════════ */
const sop = (op, extra) => Object.assign({ op, scope: "story", pageIndex: 0, storyId: 1 }, extra);
const apply = (p, ops, C = K) => runIn(C, `(()=>{ const r = FluyoAuthoring.apply(__a.p, __a.ops); return r.ok
  ? {ok:true, steps: r.project.doc.pages[0].scenarios[0].steps, changes: r.changes, deps: r.project.doc.pages[0].scenarios[0].arrivalDependencies || null, project: r.project}
  : {ok:false, errors: r.errors.map(e => ({code:e.code, field:e.field, message:e.message}))}; })()`, { p, ops });
test("E1 · add_step {message}: en eventos de elemento (al final y en el mismo momento); en FLOW o inválido, rechazo explicado", () => {
  const p = project(STEPS);
  let r = apply(p, [sop("add_step", { eventTypeId: 2, target: { nodeId: D }, message: "¿Y el límite?" }), sop("add_step", { eventTypeId: 3, target: { nodeId: A }, placement: { sameMomentAs: 1 }, message: "API cae" })]);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.steps.find((s) => s.id === 6), occ(6, 3000, D, { message: "¿Y el límite?" }));
  assert.deepEqual(r.steps.find((s) => s.id === 7), down(7, 0, A, { message: "API cae" }));
  assert.ok(!("message" in r.changes[0]), "la respuesta no repite el texto");
  r = apply(p, [sop("add_step", { eventTypeId: 1, target: { edgeId: 4 }, message: "hola" })]);
  assert.ok(r.ok, "FLOW (decisión 258)");
  assert.deepEqual(r.steps.at(-1), send(6, 3000, 4, { message: "hola" }));
  for (const m of ["", "   ", "x".repeat(121), null, 5]) {
    r = apply(p, [sop("add_step", { eventTypeId: 2, target: { nodeId: D }, message: m })]);
    assert.deepEqual(r.errors.map((e) => [e.code, e.field]), [["INVALID_FIELD", "message"]], JSON.stringify(m));
  }
  assert.deepEqual(apply(p, [sop("add_step", { eventTypeId: 2, target: { nodeId: D } })]).steps.at(-1), occ(6, 3000, D), "sin message, sin clave");
});

test("E2 · set_step_message: fija, cambia y quita (null); igual → changed:false; solo afecta a ese paso; SEND y valores inválidos se rechazan", () => {
  const p = project(STEPS);
  let r = apply(p, [sop("set_step_message", { stepId: 5, message: "Nuevo" })]);
  assert.ok(r.ok);
  assert.deepEqual(r.steps.find((s) => s.id === 5), occ(5, 2000, A, { message: "Nuevo" }));
  assert.deepEqual(J(r.changes[0]), { operationIndex: 0, operation: "set_step_message", scope: "story", pageIndex: 0, entityKind: "step", entityId: 5, storyId: 1, from: null, to: "Nuevo", changed: true, affects: r.changes[0].affects });
  assert.deepEqual(r.changes[0].affects.stories.map((s) => s.stepIds), [[5]]);
  r = apply(p, [sop("set_step_message", { stepId: 1, message: null })]);
  assert.deepEqual(r.steps[0], occ(1, 0, U));
  assert.deepEqual([r.changes[0].from, r.changes[0].to, r.changes[0].changed], ["¿Cuál es mi saldo?", null, true]);
  assert.equal(apply(p, [sop("set_step_message", { stepId: 1, message: "¿Cuál es mi saldo?" })]).changes[0].changed, false);
  assert.equal(apply(p, [sop("set_step_message", { stepId: 5, message: null })]).changes[0].changed, false);
  const deps = { arrivalDependencies: [{ stepId: 4, waitsForArrivalOf: [3] }] }, pd = project(STEPS, deps);
  r = apply(pd, [sop("set_step_message", { stepId: 4, message: "otra" })]);
  assert.deepEqual(r.steps.map(({ message, ...s }) => s), STEPS.map(({ message, ...s }) => s), "ids, at, orden, objetivos y eventos");
  assert.deepEqual(r.deps, deps.arrivalDependencies, "dependencias");
  /* PRODUCT-NARRATION-001 (decisión 258): un SEND también */
  r = apply(p, [sop("set_step_message", { stepId: 2, message: "x" })]);
  assert.ok(r.ok, "SEND");
  assert.deepEqual(r.steps.find((s) => s.id === 2), send(2, 900, 4, { message: "x" }));
  assert.equal(apply(p, [sop("set_step_message", { stepId: 2, message: null })]).changes[0].changed, false, "SEND sin message: quitar no cambia nada");
  for (const m of ["", "  ", "x".repeat(121), 3]) assert.deepEqual(apply(p, [sop("set_step_message", { stepId: 1, message: m })]).errors.map((e) => e.code), ["INVALID_FIELD"], JSON.stringify(m));
  assert.deepEqual(apply(p, [sop("set_step_message", { stepId: 1 })]).errors.map((e) => [e.code, e.field]), [["INVALID_OPERATION", "message"]], "sin message");
  assert.deepEqual(apply(p, [sop("set_step_message", { stepId: 9, message: "x" })]).errors.map((e) => e.code), ["STEP_NOT_FOUND"]);
  assert.deepEqual(apply(p, [sop("set_step_message", { stepId: 1, message: "x", at: 5 })]).errors.map((e) => e.code), ["INVALID_OPERATION"], "campo no permitido");
  r = apply(p, [sop("add_step", { eventTypeId: 2, target: { nodeId: D }, ref: "n" }), sop("set_step_message", { stepId: { ref: "n" }, message: "por ref" })]);
  assert.equal(r.steps.at(-1).message, "por ref");
  assert.equal(run("FluyoAuthoring.OPERATION_SCOPE.set_step_message"), "story");
});

test("E3 · duplicate_step, retarget_step, duplicate_story y update_event_type conservan el message; remove_step se lo lleva", () => {
  const p = project(STEPS);
  let r = apply(p, [sop("duplicate_step", { stepId: 1 }), sop("retarget_step", { stepId: 4, target: { nodeId: U } })]);
  assert.deepEqual(r.steps.filter((s) => s.message).map((s) => [s.id, s.message, s.nodeId]), [[1, "¿Cuál es mi saldo?", U], [6, "¿Cuál es mi saldo?", U], [4, "La BD no responde", U]]);
  r = apply(p, [{ op: "duplicate_story", scope: "story", pageIndex: 0, storyId: 1 }]);
  assert.deepEqual(r.project.doc.pages[0].scenarios[1].steps, STEPS);
  r = apply(p, [{ op: "update_event_type", scope: "eventType", eventTypeId: 2, presentation: { nodeEffects: { message: "genérico" } } }]);
  assert.equal(r.steps[0].message, "¿Cuál es mi saldo?", "el texto del evento no pisa el del paso");
  r = apply(p, [sop("remove_step", { stepId: 1 })]);
  assert.ok(!JSON.stringify(r.project).includes("¿Cuál es mi saldo?"), "sin huérfanos");
});

test("E4 · el caso real se reconstruye con un lote: 5 eventos y 6 message dan EXACTAMENTE la variante (y su Trace es el del original)", () => {
  const variant = ragWithMessages(), ops = [];
  for (const et of variant.doc.eventTypes) {
    const branch = et.primitive === "FLOW" ? "connectionEffects" : "nodeEffects";
    ops.push({ op: "create_event_type", scope: "eventType", name: et.name, primitive: et.primitive, sentence: et.sentenceTemplate, symbol: et.visual.value, ...(et.primitive === "FLOW" ? { motion: et.motion } : {}), presentation: { [branch]: et.presentation[branch] }, ref: "e" + et.id });
  }
  for (const sc of variant.doc.pages[0].scenarios) {
    ops.push({ op: "create_story", scope: "story", pageIndex: 0, name: sc.name, ref: "h" + sc.id });
    const deps = new Map((sc.arrivalDependencies || []).map((d) => [d.stepId, d.waitsForArrivalOf]));
    let prev = null, anchor = null;
    for (const st of sc.steps) {
      const op = { op: "add_step", scope: "story", pageIndex: 0, storyId: { ref: "h" + sc.id }, eventTypeId: { ref: "e" + st.eventTypeId },
        target: st.action === "SEND" ? Object.assign({ edgeId: st.edgeId }, st.reverse ? { reverse: true } : {}) : { nodeId: st.nodeId } };
      if (prev !== null && st.at === prev) op.placement = { sameMomentAs: { ref: `h${sc.id}s${anchor}` } };
      else if (prev !== null) op.waitMs = st.at - prev;
      if (deps.has(st.id)) op.waitsForArrivalOf = deps.get(st.id).map((i) => ({ ref: `h${sc.id}s${i}` }));
      if (st.message !== undefined) op.message = st.message;
      op.ref = `h${sc.id}s${st.id}`;
      if (prev === null || st.at !== prev) anchor = st.id;
      prev = st.at; ops.push(op);
    }
  }
  const empty = J(RAG); empty.doc.eventTypes = []; empty.doc.nextEventTypeId = 1; empty.doc.pages[0].scenarios = []; empty.doc.pages[0].nextScenarioId = 1;
  const r = runIn(K, `(()=>{ const r = FluyoAuthoring.apply(__a.p, __a.ops); return r.ok ? r.project : r.errors; })()`, { p: empty, ops });
  assert.ok(r.doc, JSON.stringify(r).slice(0, 400));
  assert.equal(ops.length, 46);
  assert.deepEqual(r.doc.pages[0].scenarios.map((s) => [s.steps, s.arrivalDependencies]), variant.doc.pages[0].scenarios.map((s) => [s.steps, s.arrivalDependencies]));
  const tr = (p) => run(`(()=>{ const d = ${LOAD}.doc; return d.pages[0].scenarios.map(sc => JSON.stringify(FluyoStory.run(d.pages[0], sc).trace)); })()`, p);
  assert.deepEqual(tr(r), tr(RAG));
});

/* ═══════════════ F. Share (#d=) ═══════════════ */
test("F1 · Share: el enlace #d= de la Historia conserva message EXACTO de ida y vuelta (sin representación paralela)", async () => {
  const L = context(read, ["config.js", "safe-svg.js", "model.js", "geometry.js", "link-codec.js", "share-url.js"]);
  L.__a = project(STEPS);
  const back = await vm.runInContext(`createShareUrl(__a, "https://fluyo.space/", {kind:"story", scenarioId:1}).then(u => decodeDeepLink(new URL(u).hash.slice(3))).then(x => JSON.stringify([x.doc.pages[0].scenarios[0].steps, projectFromProjectData(x).doc.pages[0].scenarios[0].steps]))`, L);
  assert.deepEqual(JSON.parse(back), [STEPS, STEPS]);
  L.__b = ragWithMessages();
  const rag = await vm.runInContext(`encodeDeepLink(__b).then(decodeDeepLink).then(x => JSON.stringify(projectFromProjectData(x).doc.pages[0].scenarios.map(s => s.steps)))`, L);
  assert.deepEqual(JSON.parse(rag), ragWithMessages().doc.pages[0].scenarios.map((s) => s.steps));
});

/* ═══════════════ G. Editor: «Mensaje del paso…» ═══════════════ */
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
const ED_FNS = ["scNodeLabel", "scNodeFallback", "scSourceFallback", "scEdgeLabel", "scEdgeSecondary", "scTargetLabel", "scIsTargetMissing", "describeScenarioStep",
  "scWhereLabel", "scStepTitle", "scStoryMenu", "scReverseMenuItem", "scToggleStepReverse", "scEditable", "scOrderedSteps",
  "scDuplicateStep", "scSetArrivalDependencies", "scUseTarget", "scStepMessage", "scMessageMenuItem", "scSetStepMessage"];
function editor(src = read("js/editor-scenarios.js"), fns = ED_FNS) {
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
  vm.runInContext(fns.map((n) => extract(src, n)).join("\n"), ctx, { filename: "js/editor-scenarios.js#extract" });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0; __commits=0; scSelectedStep=null;");
  const menu = (id) => { R(`__menu=null; scStoryMenu(scActiveScenario().steps.find(s=>s.id===${id}), null)`);
    return J(R("__menu.sections.map(sec => sec.map(it => ({label: it.label, hint: it.hint || '', disabled: !!it.disabled})))")); };
  return { R, load, menu, steps: () => J(R("scActiveScenario().steps")) };
}
const ED_BASE = ED_FNS.filter((n) => !["scStepMessage", "scMessageMenuItem", "scSetStepMessage", "scSourceFallback"].includes(n));   /* scSourceFallback: FLUYO-I18N-002 S3a */
test("G1 · menú: «Mensaje del paso…» solo en eventos de elemento, justo después de «Cambiar dónde ocurre…»; el hint dice el texto que se ve ahora", () => {
  const e = editor(), base = editor(atBase("js/editor-scenarios.js"), ED_BASE);
  e.load(project(STEPS)); base.load(project(STEPS));
  assert.deepEqual(e.menu(1)[1], [{ label: "Cambiar dónde ocurre…", hint: "Ahora: Usuario", disabled: false }, { label: "Mensaje del paso…", hint: "«¿Cuál es mi saldo?»", disabled: false }]);
  assert.deepEqual(e.menu(5)[1][1], { label: "Mensaje del paso…", hint: "Ahora sin mensaje", disabled: false }, "evento sin mensaje");
  e.load(project([down(1, 0, D)]));
  assert.deepEqual(e.menu(1)[1][1], { label: "Mensaje del paso…", hint: "Ahora el del evento: «Caída»", disabled: false });
  e.load(project(STEPS));
  for (const id of [1, 4, 5]) assert.deepEqual(e.menu(id).map((sec) => sec.filter((it) => it.label !== "Mensaje del paso…")), base.menu(id), "el resto del menú, como en " + BASE);
  /* PRODUCT-NARRATION-001 (decisión 258): un SEND también la tiene, tras «Invertir sentido»; el resto, como en la base */
  assert.deepEqual(e.menu(2)[1].map((it) => it.label), ["Cambiar dónde ocurre…", "Invertir sentido", "Mensaje del paso…"]);
  assert.deepEqual(e.menu(2).map((sec) => sec.filter((it) => it.label !== "Mensaje del paso…")), base.menu(2), "SEND: el resto del menú, como en " + BASE);
});

test("G2 · editar, cambiar y quitar: UNA entrada de Undo cada vez; Undo/Redo exactos; la selección no cambia; sin cambio, nada", () => {
  const e = editor();
  e.load(project(STEPS));
  e.R("scSelectedStep = 5");
  const s0 = e.steps();
  assert.equal(e.R(`scSetStepMessage(5, "Nuevo texto")`), true);
  const s1 = e.steps();
  assert.deepEqual(s1[4], occ(5, 2000, A, { message: "Nuevo texto" }));
  assert.equal(e.R("undoStack.length"), 1); assert.equal(e.R("__commits"), 1); assert.equal(e.R("scSelectedStep"), 5);
  assert.equal(e.R(`scSetStepMessage(5, "Nuevo texto")`), false, "el mismo texto: ni Undo ni commit");
  assert.equal(e.R(`scSetStepMessage(1, null)`), true);
  assert.deepEqual(e.steps()[0], occ(1, 0, U), "quitar: sin la clave");
  assert.equal(e.R("undoStack.length"), 2);
  e.R("undo()"); assert.deepEqual(e.steps(), s1, "Undo: vuelve el mensaje");
  e.R("undo()"); assert.deepEqual(e.steps(), s0, "Undo: el original exacto");
  e.R("redo()"); e.R("redo()"); assert.deepEqual(e.steps()[0], occ(1, 0, U)); assert.equal(e.steps()[4].message, "Nuevo texto");
  assert.equal(e.R(`scSetStepMessage(2, "x")`), true, "SEND (decisión 258)");
  assert.equal(e.R(`scSetStepMessage(4, null)`), true);
  assert.equal(e.R(`scSetStepMessage(4, null)`), false, "quitar lo que no hay: nada");
});

test("G3 · duplicar desde el editor y «Usar otro evento aquí» conservan el message", () => {
  const e = editor();
  e.load(project(STEPS));
  e.R("scDuplicateStep(1)");
  assert.deepEqual(e.steps().filter((s) => s.message === "¿Cuál es mi saldo?").map((s) => s.id), [1, 6]);
  e.R("undo()"); assert.deepEqual(e.steps(), STEPS);
  const src = read("js/editor-scenarios.js"), change = extract(src, "scChangeEvent");
  assert.ok(/step\.eventTypeId = e\.id;/.test(change) && !/message/.test(change), "solo cambia eventTypeId (y state); el texto se queda");
});

/* ═══════════════ H. Documentos antiguos y lectores anteriores ═══════════════ */
function corpus() {
  const files = [];
  for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of (dir === "ejemplos/data" ? historicalExamples(root, BASE) : fs.readdirSync(path.join(root, dir)))) if (/\.json$/.test(f)) files.push(dir + "/" + f);
  return files;
}
const SURFACE = `(()=>{ let loaded; try{ loaded = projectFromProjectData(__a); }catch(e){ return {load:e.code}; }
  const out = {saved: JSON.stringify(projectToSerializable(loaded.doc, loaded.settings)), integrity: JSON.stringify(FluyoIntegrity.validateProject(__a)), pages: []};
  loaded.doc.pages.forEach((pg, i) => { doc = loaded.doc; doc.cur = i;
    for(const sc of pg.scenarios){
      const r = FluyoStory.run(pg, sc);
      const row = {run: JSON.stringify(r)};
      if(r.ok){
        const meta = FluyoStory.stepMeta(sc.steps);
        row.outcomes = JSON.stringify(FluyoStory.outcomes(r.trace, sc, pg));
        row.meta = JSON.stringify(meta);
        row.schedule = JSON.stringify(FluyoStoryClock.schedule(sc, meta));
        const s = FluyoStory.start(pg, sc, 0), ticks = [];
        const end = Math.max(0, ...sc.steps.map(x => x.at)) + 3000;
        for(let t = 0; t <= end; t += Math.max(50, Math.round(end / 40))){ const rs = FluyoScenarioPlayback.tick(s.playback, t); ticks.push(JSON.stringify([rs.activeSends, rs.activeNodeEffects, rs.logEvents])); }
        row.ticks = ticks;
      }
      out.pages.push(row);
    } });
  return out; })()`;
test("H1 · ejemplos y fixtures (sin message): carga, guardado, integridad, Trace, outcomes, stepMeta, horario y playback IDÉNTICOS a " + BASE, () => {
  const OLD = context(atBase);
  let docs = 0, stories = 0;
  for (const f of corpus()) {
    const p = JSON.parse(read(f));
    const now = runIn(K, SURFACE, p), was = runIn(OLD, SURFACE, p);
    assert.deepEqual(now, was, f);
    if (!now.load) { docs++; stories += now.pages.length; }
  }
  assert.ok(docs >= 10 && stories >= 8, `corpus real (${docs} documentos, ${stories} Historias)`);
});

test("H2 · autoría de siempre (sin message): los mismos lotes dan el mismo documento y los mismos resultados que " + BASE, () => {
  const OLD = context(atBase);
  const p = project(STEPS.map(({ message, ...s }) => s));
  const ops = [sop("add_step", { eventTypeId: 2, target: { nodeId: D } }), sop("add_step", { eventTypeId: 1, target: { edgeId: 5 }, waitMs: 300 }),
    sop("duplicate_step", { stepId: 1 }), sop("retarget_step", { stepId: 1, target: { nodeId: A } }), { op: "duplicate_story", scope: "story", pageIndex: 0, storyId: 1 }];
  for (let k = 1; k <= ops.length; k++) assert.deepEqual(apply(p, ops.slice(0, k)), apply(p, ops.slice(0, k), OLD), "lote de " + k);
  const unknown = apply(p, [sop("bogus", {})]), unknownOld = apply(p, [sop("bogus", {})], OLD);
  assert.deepEqual(unknown.errors.map((e) => e.code), unknownOld.errors.map((e) => e.code));
  assert.equal(unknown.errors[0].message, unknownOld.errors[0].message.replace("set_observed_flow, ", "set_observed_flow, set_step_message, "), "solo se añade el nombre a la lista");
});

test("H3 · un lector anterior (" + BASE + ") RECHAZA un documento con message (no lo lee mal): carga, motor e integridad; sin message abre igual", () => {
  const OLD = context(atBase);
  const opens = (p) => runIn(OLD, `(()=>{ try{ projectFromProjectData(__a); return "abre"; }catch(e){ return e.code; } })()`, p);
  assert.equal(opens(project(STEPS)), "invalid_document");
  assert.equal(opens(ragWithMessages()), "invalid_document");
  assert.equal(opens(ragWithMessages(false)), "abre");
  assert.deepEqual(runIn(OLD, `FluyoScenarios.runScenario({nodes:[{id:1}], edges:[]}, [], {id:1, engineVersion:2, name:"H", nextStepId:2, steps:[{id:1,at:0,action:"OCCURRENCE",nodeId:1,message:"x"}]}).errors.map(e=>[e.code,e.reason])`),
    [["invalid_scenario", "extra_fields"]]);
  assert.deepEqual(runIn(OLD, `FluyoIntegrity.validateProject(__a).errors.map(e=>[e.code, e.stepId])`, project(STEPS)), [["invalid_step", 1], ["invalid_step", 4]]);
  assert.deepEqual(runIn(OLD, `FluyoAuthoring.apply(__a, [{op:"set_step_message", scope:"story", pageIndex:0, storyId:1, stepId:1, message:"x"}]).errors.map(e=>e.code)`, project([occ(1, 0, U)])), ["UNKNOWN_OPERATION"]);
});

/* ═══════════════ I. Alcance ═══════════════ */
test("I1 · versiones: engineVersion 2 y version 5 (NO v3); sw.js sube a v102; motor solo filtra la clave; reloj, Viewer y Present sin diff", () => {
  assert.equal(run("FluyoScenarios.ENGINE_VERSION"), 2);
  assert.equal(run("projectToSerializable({}, {}).version"), 5);
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v116";/);
  const { undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade al precache js/i18n-en.js y js/i18n.js */
  assert.equal(undoI18n("sw.js", read("sw.js")).replace('"fluyo-static-v116"', '"fluyo-static-v' + (102 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante");
  const { undo029 } = require("./fluyo-018-29-undo.cjs"), { undo030 } = require("./fluyo-018-30-undo.cjs");   /* FLUYO-018.29 (R1 + G1) y FLUYO-018.30 van encima: se deshacen antes */
  for (const f of ["js/story-clock.js", "js/scenario-playback.js", "js/render.js", "js/viewer.js", "js/present-story.js", "js/link-codec.js", "js/share-url.js", "js/document-integrity.js", "index.html", "s/index.html"])
    assert.equal(undo029(f, undo030(f, undoI18n(f, read(f)))), atBase(f), f + " sin cambios");   /* FLUYO-I18N-001 encima de 018.30 */
  const en = read("js/scenario-engine.js");
  assert.equal(en.split("message").length - 1, 2, "el motor solo nombra la clave para filtrarla (y en su comentario)");
});

test("I2 · alcance frente a " + BASE + ": solo cambian estos archivos servidos, y undoMsg (para los alcances antiguos) los devuelve EXACTOS", () => {
  const SERVED = ["js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !shellOnly(f, read, atBase));
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const { undoMsg, PIECES } = require("./fluyo-step-message-001-undo.cjs");
  const { NEW_FILES: NEW_I18N, undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade js/i18n.js y js/i18n-en.js (no existen en la base) */
  assert.deepEqual([...new Set([...changed, ...untracked])].filter((f) => !NEW_I18N.includes(f)).sort(), [...Object.keys(PIECES), "sw.js"].sort());
  for (const f of Object.keys(PIECES)) assert.equal(undoMsg(f, read(f)), atBase(f), f);
});
