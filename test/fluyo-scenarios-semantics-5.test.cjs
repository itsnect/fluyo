"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 5 — Paridad de superficies (decisiones 245–249). Sobre el contrato cerrado de FASE 3 y FASE 4 (D5,
   D-Ruta, observedFlow, AVAILABLE / UNAVAILABLE / NO_PATH, la derivación y el pintado): nada de eso cambia aquí.
   · A (receta, flow-semantics.js): routeOverlay da EXACTAMENTE lo que pintaba scFlowOverlay en 6701261 (editor con labs), y routeLine
     dice lo mismo que la herramienta. Determinismo; nada se persiste.
   · B (Present, editor con labs): la misma ruta en el lienzo; la línea de estado en el rótulo (#psFlow), solo reproduciendo (también en
     pausa y terminada) y solo con par; el mando no cambia.
   · C (Viewer, sin bandera): las funciones reales de viewer.js dan la MISMA ruta y la MISMA línea que el editor en el mismo instante;
     misma regla de existencia (Flujo + par); NO_PATH solo la línea; ENDPOINT_MISSING y sin par, nada; sin flow-semantics.js, nada.
   · D (exportación): marcas en el raster (render.js) y en el SVG (export.js), en el orden del lienzo, con N3; overlays nunca; sin
     `kind`, todo idéntico a 6701261 en los ejemplos (plano y piel); el golden compartido con el MCP coincide.
   · E (kernel): avisos W2/W3 solo si hay; set_observed_flow con la autoridad del editor.
   · G (estático): markup, carga, alcance frente a 6701261, undo5, CACHE v100, docs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { shellOnly } = require("./fluyo-shell-001-undo.cjs");   /* FLUYO-SHELL-001 (páginas públicas, favicon, manifest): lo suyo se descuenta */
const root = path.resolve(__dirname, "..");
const { historicalExamples } = require("./corpus-historico.cjs");   /* FLUYO-EXAMPLES-001: el corpus de esta slice es el de su commit; los ejemplos nuevos los cubren sus propios tests */
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "6701261";   // main al empezar FASE 5 (producción v99)
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js"];
const INTEGRITY = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
function context(src = read, files = KERNEL, extra = {}) {
  const ctx = vm.createContext(Object.assign({ TextEncoder, TextDecoder, atob, btoa, URL, console }, extra));
  for (const f of files) vm.runInContext(src("js/" + f), ctx, { filename: f });
  return ctx;
}
function extract(src, name) {
  const i = src.indexOf("function " + name + "(");
  assert.ok(i >= 0, name);
  let depth = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") depth++; else if (src[k] === "}" && --depth === 0) return src.slice(i, k + 1); }
  throw new Error(name);
}

/* ── constructores (los de FASE 3/4) ── */
const rect = (id, label) => ({ id, shape: "rect", x: id * 200, y: 0, w: 140, h: 60, label: label || "N" + id });
const edge = (id, from, to, kind) => Object.assign({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [] }, kind ? { kind } : {});
const project = (pages, extra = {}) => ({ version: 5, app: "fluyo", doc: Object.assign({ theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages, cur: 0 }, extra), settings: {} });
const story = (id, steps, extra = {}) => Object.assign({ id, engineVersion: 2, name: "Historia " + id, nextStepId: steps.length + 1, steps }, extra);
const setS = (id, at, nodeId, state = "DOWN") => ({ id, at, action: "SET_STATE", nodeId, state });
const send = (id, at, edgeId, extra = {}) => Object.assign({ id, at, action: "SEND", edgeId }, extra);
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
let seed = 5; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
/* Historias aleatorias sobre el fixture de dos workers: envíos, caídas y vueltas, a veces con una ruta guardada; a veces sin una conexión */
function randomPage() {
  const steps = []; let at = 0;
  const n = 1 + Math.floor(rnd() * 6);
  for (let s = 1; s <= n; s++) {
    if (rnd() < 0.6) at += 200 + Math.floor(rnd() * 4) * 400;
    if (rnd() < 0.35) steps.push(send(s, at, 11 + Math.floor(rnd() * 6)));
    else steps.push(setS(s, at, 1 + Math.floor(rnd() * 8), rnd() < 0.7 ? "DOWN" : "UP"));
  }
  const pairs = [null, null, { from: CLI, to: BD }, { from: API, to: WB }, { from: COLA, to: BD }, { from: BD, to: CLI }];
  const of = pairs[Math.floor(rnd() * pairs.length)];
  const pg = workersPage(of ? { observedFlow: of } : {}, steps);
  if (rnd() < 0.15) pg.edges = pg.edges.filter((e) => e.id !== 12);
  if (rnd() < 0.2) pg.behaviors = [{ nodeId: 1 + Math.floor(rnd() * 8), initialState: rnd() < 0.5 ? "UP" : "DOWN" }];
  return pg;
}

/* ═══════════════ Editor real (bloque «Ruta observada» de editor-scenarios.js) y Present (present-story.js) ═══════════════ */
function flowBlock(src) {
  const a = src.indexOf("/* ===================== Ruta observada (SCENARIOS-SEMANTICS-001 FASE 3"), b = src.indexOf("/* ===================== fin de la ruta observada");
  assert.ok(a > 0 && b > a, "bloque de la ruta observada en editor-scenarios.js");
  return src.slice(a, b);
}
function fakeEl(id) {
  return { id, hidden: false, value: "", disabled: false, textContent: "", title: "", className: "", dataset: {}, style: {}, children: [], writes: 0,
    replaceChildren(...c) { this.children = c; this.writes++; if (!c.some((o) => o.value === this.value)) this.value = c.length ? c[0].value : ""; },
    appendChild(c) { this.children.push(c); }, append(...c) { this.children.push(...c); }, setAttribute() {}, classList: { toggle() {} } };
}
function editor({ labs = true, src = read } = {}) {
  const els = {};
  const $ = (id) => (els[id] = els[id] || fakeEl(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, $, GRID: 20, innerWidth: 1280, innerHeight: 800, LABS_SEMANTICS: labs,
    document: { createElement: (tag) => Object.assign(fakeEl(tag), { tag }), createTextNode: (t) => ({ t }), createElementNS: () => fakeEl("svg") } });
  const R = (code) => vm.runInContext(code, ctx);
  vm.runInContext(read("js/i18n.js"), ctx, { filename: "js/i18n.js" });   /* FLUYO-I18N-001: el texto de la interfaz pasa por FluyoI18n */
  for (const f of KERNEL) vm.runInContext(src("js/" + f), ctx, { filename: f });
  R(`var selN=new Set(), selE=new Set(), clip=null, __autosaves=0, __routes=0, scPlayback=null, scStatus="idle", scActive=1, presenting=false, __now=0, __paused=false, scErrors=[];
     function confirm(){ return true; } function alert(){} function prompt(){ return null; }
     function refreshPanel(){} function renderTabs(){} function scheduleAutosave(){ __autosaves++; }
     function isScenarioPlaybackActive(){ return scStatus==="running" || scStatus==="completed"; } function scReset(){ scStatus="idle"; scPlayback=null; }
     function scActiveScenario(){ return P().scenarios.find(s=>s.id===scActive) || null; }
     function scNodeFallback(id){ const n=P().nodes.find(x=>x.id===id); return n ? n.label : "Elemento"; }
     function scEl(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!==undefined) el.textContent=text; return el; }
     function scNow(){ return __now; } function scIsPaused(){ return scStatus==="running" && __paused; }
     function scMomentNav(){ return {prev:null, next:null}; } function scSetPauseLabel(){}
     const __route = FluyoFlow.flowRoute; FluyoFlow.flowRoute = function(){ __routes++; return __route.apply(this, arguments); };`);
  R(src("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(src("js/selection.js"), ctx, { filename: "js/selection.js" });
  const es = src("js/editor-scenarios.js");
  vm.runInContext(flowBlock(es), ctx, { filename: "js/editor-scenarios.js#ruta-observada" });
  vm.runInContext(extract(es, "buildScenarioRenderState"), ctx, { filename: "js/editor-scenarios.js#buildScenarioRenderState" });
  if (src === read) vm.runInContext(read("js/present-story.js"), ctx, { filename: "js/present-story.js" });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0; scStatus='idle'; scPlayback=null; scFlowLast=null; scFlowPending=null; scFlowCursorLast=undefined; psLast={}; __paused=false;");
  const play = (t) => R(`(()=>{ const s = FluyoStoryClock.start(P(), scActiveScenario(), 0); if(!s.ok){ scPlayback = null; scStatus = "idle"; return; } scPlayback = s.playback; scStatus = "running"; __now = ${t}; FluyoScenarioPlayback.tick(scPlayback, ${t}); })()`);
  const tick = (t) => R(`(()=>{ __now = ${t}; if(scPlayback) FluyoScenarioPlayback.tick(scPlayback, ${t}); })()`);
  const overlay = () => J(R("scFlowOverlay()"));
  const present = () => { R("presentStoryRefresh()"); const f = $("psFlow"); return { hidden: !!f.hidden, text: f.textContent, cls: f.className, story: !$("presentStory").hidden }; };
  return { ctx, R, $, els, load, play, tick, overlay, present };
}

/* ═══════════════ Viewer: las funciones REALES de viewer.js (FASE 5 y la Historia), sobre el mismo kernel ═══════════════ */
const VIEWER_FNS = ["storyScenario", "storyNodeName", "storyPaused", "storyNav", "storySet", "storyGlyph", "storyPauseLabel", "storyRefresh", "storyFlowData", "storyFlowOverlay", "storyFlowLine", "renderViewerFrame"];
function viewer({ withFlow = true } = {}) {
  const els = {};
  const $ = (id) => (els[id] = els[id] || fakeEl(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, $, performance: { now: () => 0 },
    document: { createElement: (tag) => Object.assign(fakeEl(tag), { tag }), createTextNode: (t) => ({ t }), createElementNS: () => fakeEl("svg") } });
  const R = (code) => vm.runInContext(code, ctx);
  vm.runInContext(read("js/i18n.js"), ctx, { filename: "js/i18n.js" });   /* FLUYO-I18N-001: el texto de la interfaz pasa por FluyoI18n */
  for (const f of KERNEL) if (withFlow || f !== "flow-semantics.js") vm.runInContext(read("js/" + f), ctx, { filename: f });
  const v = read("js/viewer.js");
  R(`var viewerPhase="ready", story=null, storyError=null, storyLast={}, storyFlowMemo={playback:null, page:null, value:null}, __rs=null, __routes=0, __frames=0;
     function resizeCanvas(){} function storyPlace(){} function viewerRenderState(){ return {}; } function now(){ return 0; } var sctx={}, sv={};
     function storyFollow(){} function cameraStep(){}   /* FLUYO-018.30: la cámara de la Historia no es de esta prueba */
     function render(c, t, o){ __rs = o.renderState; __frames++; } function storyNow(){ return __now; } var __now=0;`);
  if (withFlow) R("const __route = FluyoFlow.flowRoute; FluyoFlow.flowRoute = function(){ __routes++; return __route.apply(this, arguments); };");
  for (const n of VIEWER_FNS) vm.runInContext(extract(v, n), ctx, { filename: "js/viewer.js#" + n });
  const load = (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; story=null; storyLast={}; storyFlowMemo={playback:null, page:null, value:null};");
  /* reproducir como el Viewer (storyPlay): FluyoStoryClock.start sobre la primera Historia con pasos de la página */
  const play = (t) => R(`(()=>{ const sc = storyScenario(); const s = FluyoStoryClock.start(P(), sc, 0); if(!s.ok){ story = null; return; } story = {scenario: sc, playback: s.playback, status: "running", clock: FluyoStoryClock.create()}; __now = ${t}; FluyoScenarioPlayback.tick(story.playback, ${t}); })()`);
  const tick = (t) => R(`(()=>{ __now = ${t}; if(story) FluyoScenarioPlayback.tick(story.playback, ${t}); })()`);
  const overlay = () => J(R("storyFlowOverlay()"));
  const line = () => J(R("storyFlowLine()"));
  const refresh = () => { R("storyRefresh()"); const f = $("stFlow"); return { hidden: !!f.hidden, text: f.textContent, cls: f.className }; };
  return { ctx, R, $, load, play, tick, overlay, line, refresh };
}

/* ═══════════════ A. La receta compartida (flow-semantics.js) ═══════════════ */
test("A1 · routeOverlay (editor con labs) = lo que pintaba scFlowOverlay en " + BASE + ", instante a instante, en 150 Historias aleatorias", () => {
  const now = editor(), old = editor({ src: atBase });
  seed = 5;
  let compared = 0, nonNull = 0;
  for (let k = 0; k < 150; k++) {
    const p = project([randomPage()]);
    now.load(p); old.load(p); now.play(0); old.play(0);
    for (const t of [0, 100, 250, 450, 700, 900, 1200, 1600, 2050, 2600, 3300, 4200, 6000]) {
      now.tick(t); old.tick(t);
      const a = now.overlay(), b = old.overlay();
      assert.deepEqual(a, b, "Historia " + k + ", t = " + t);
      compared++; if (a) nonNull++;
    }
  }
  assert.ok(nonNull > 300, "la comparación no es trivial (" + nonNull + " de " + compared + " fotogramas con ruta)");
});

test("A2 · routeLine: los textos aprobados son los de SC_FLOW_WORDS; solo con par; procedencia; NO_PATH; ENDPOINT_MISSING y sin par → null", () => {
  /* FLUYO-I18N-002 S2a: los textos de la ruta pasan por FluyoI18n.t (las mismas claves en el editor y en flow-semantics.js) */
  const { loadI18n } = require("./i18n-vm.cjs");
  const K = context();
  loadI18n(K);
  const words = vm.runInContext(flowBlock(read("js/editor-scenarios.js")).match(/const SC_FLOW_WORDS = \{[\s\S]*?\n\};/)[0].replace("const SC_FLOW_WORDS =", "(").replace(/;$/, "") + ")", loadI18n(vm.createContext({})));
  const W = J(vm.runInContext("FluyoFlow.ROUTE_WORDS", K));
  assert.deepEqual(W, { AVAILABLE: words.AVAILABLE, UNAVAILABLE: words.UNAVAILABLE, NO_PATH: words.NO_PATH, byDefault: words.byDefault }, "una sola fuente de texto (decisión 246)");
  const line = (pg, t) => { K.__p = J(project([pg])); return J(vm.runInContext(`(()=>{ const p = projectFromProjectData(__p).doc.pages[0], sc = p.scenarios[0];
    const ev = FluyoStory.run(p, sc).trace.events; return FluyoFlow.routeLine(p, sc, ev, ${t}); })()`, K)); };
  assert.deepEqual(line(workersPage(), 0), { status: "AVAILABLE", text: "Ruta disponible · incluye estados por defecto" });
  assert.deepEqual(line(workersPage(), 1500), { status: "AVAILABLE", text: "Ruta disponible · incluye estados por defecto" }, "cae A: la ruta sigue disponible");
  assert.deepEqual(line(workersPage(), 3000), { status: "UNAVAILABLE", text: "Ruta no disponible" });
  const explicit = workersPage(); explicit.behaviors = [CLI, API, COLA, WA, WB, BD].map((nodeId) => ({ nodeId, initialState: "UP" }));
  assert.deepEqual(line(explicit, 0), { status: "AVAILABLE", text: "Ruta disponible" }, "todo afirmado: sin «por defecto»");
  const cut = workersPage({ observedFlow: { from: CLI, to: BD } }); cut.edges = cut.edges.filter((e) => e.id !== 12);
  assert.deepEqual(line(cut, 0), { status: "NO_PATH", text: "Sin ruta de flujo" });
  assert.equal(line(workersPage({ observedFlow: { from: 77, to: BD } }), 0), null, "ENDPOINT_MISSING: nada");
  const amb = workersPage(); amb.nodes.push(rect(9, "Otro")); amb.edges.push(edge(19, 9, API, "FLOWS_TO"));
  assert.equal(line(amb, 0), null, "sin par: nada");
});

test("A3 · routeOverlay: sin timeline (NO_PATH) → null; t inválido → invalid_document; determinista; nada se escribe en el documento (B6)", () => {
  const K = context();
  require("./i18n-vm.cjs").loadI18n(K);   /* FLUYO-I18N-002 S2a: routeLine dice sus textos con FluyoI18n.t */
  K.__p = J(project([workersPage({ observedFlow: { from: CLI, to: BD } })]));
  const r = J(vm.runInContext(`(()=>{ const d = projectFromProjectData(__p).doc, p = d.pages[0], sc = p.scenarios[0], before = JSON.stringify(projectToSerializable(d, {}));
    const ev = FluyoStory.run(p, sc).trace.events, route = FluyoFlow.flowRoute(p, ${CLI}, ${BD}), tl = FluyoFlow.routeTimeline(p, route, ev, 0);
    const a = FluyoFlow.routeOverlay(p, route, tl, 3100), b = FluyoFlow.routeOverlay(p, route, tl, 3100);
    let code = null; try { FluyoFlow.routeOverlay(p, route, tl, NaN); } catch(e) { code = e.code; }
    return {same: JSON.stringify(a) === JSON.stringify(b), none: FluyoFlow.routeOverlay(p, route, null, 10), code, a,
            untouched: before === JSON.stringify(projectToSerializable(d, {})), line: FluyoFlow.routeLine(p, sc, ev, 3100)}; })()`, K));
  assert.deepEqual([r.same, r.none, r.code, r.untouched], [true, null, "invalid_document", true]);
  assert.equal(r.a.sweep.status, "UNAVAILABLE"); assert.ok(Math.abs(r.a.sweep.p - 100 / 900) < 1e-9, "barrido a 100 ms de la frontera");
  assert.deepEqual(r.a.pips, [WA, WB]); assert.deepEqual(r.line, { status: "UNAVAILABLE", text: "Ruta no disponible" });
  assert.deepEqual(J(vm.runInContext("[FluyoFlow.ROUTE_FADE_MS, FluyoFlow.ROUTE_SWEEP_MS, FluyoFlow.ROUTE_PULSE_MS]", K)), [450, 900, 1100], "las duraciones de § Pintado (decisión 244)");
});

/* ═══════════════ B. Present (editor con labs) ═══════════════ */
test("B1 · Present pinta la MISMA ruta que el editor (D8); sin bandera desde FASE 6 (decisión 253), igual", () => {
  const e = editor(); e.load(project([workersPage()]));
  for (const t of [100, 1500, 1725, 3000, 3400]) {
    e.play(0); e.tick(t); const out = e.overlay();
    e.R("presenting = true"); assert.deepEqual(e.overlay(), out, "t = " + t); assert.ok(out, "hay ruta");
    assert.deepEqual(J(e.R("buildScenarioRenderState().flow")), out, "llega al renderState de Present");
    e.R("presenting = false");
  }
  const off = editor({ labs: false }); off.load(project([workersPage()])); off.R("presenting = true"); off.play(1500);
  e.R("presenting = true"); e.play(0); e.tick(1500);
  assert.ok(off.overlay(), "el valor antiguo de la bandera ya no cuenta"); assert.deepEqual(off.overlay(), e.overlay());
});

test("B2 · la línea de Present va en el rótulo (#psFlow), solo reproduciendo (también en pausa y terminada) y con par; nunca «Al inicio»", () => {
  const e = editor(); e.R("presenting = true");
  e.load(project([workersPage()]));
  let v = e.present();
  assert.ok(v.story && v.hidden, "sin reproducir: el rótulo sí, la línea no (decisión del PO)");
  e.play(100); v = e.present();
  assert.deepEqual([v.hidden, v.text, v.cls], [false, "Ruta disponible · incluye estados por defecto", "psFlow isAVAILABLE"]);
  e.tick(1600); assert.equal(e.present().text, "Ruta disponible · incluye estados por defecto", "cae A: la ruta sigue disponible");
  e.tick(3050); v = e.present(); assert.deepEqual([v.text, v.cls], ["Ruta no disponible", "psFlow isUNAVAILABLE"]);
  e.R("__paused = true"); v = e.present(); assert.deepEqual([v.hidden, v.text], [false, "Ruta no disponible"], "en pausa");
  e.R('__paused = false; scStatus = "completed"'); v = e.present(); assert.deepEqual([v.hidden, v.text], [false, "Ruta no disponible"], "terminada");
  e.R('scStatus = "idle"; scPlayback = null'); assert.equal(e.present().hidden, true, "Detener: vuelve a «sin reproducir»");
  assert.ok(!/Al inicio/.test(JSON.stringify(e.els)), "«Al inicio · » nunca llega a Present");
  const cut = workersPage({ observedFlow: { from: CLI, to: BD } }); cut.edges = cut.edges.filter((x) => x.id !== 12);
  e.load(project([cut])); e.play(100); v = e.present(); assert.deepEqual([v.hidden, v.text, v.cls], [false, "Sin ruta de flujo", "psFlow isNO_PATH"], "NO_PATH: la línea, neutra");
  e.load(project([workersPage({ observedFlow: { from: 77, to: BD } })])); e.play(100); assert.equal(e.present().hidden, true, "ENDPOINT_MISSING: nada");
  const amb = workersPage(); amb.nodes.push(rect(9, "Otro")); amb.edges.push(edge(19, 9, API, "FLOWS_TO"));
  e.load(project([amb])); e.play(100); assert.equal(e.present().hidden, true, "sin par: nada");
  const off = editor({ labs: false }); off.R("presenting = true"); off.load(project([workersPage()])); off.play(100);
  assert.deepEqual([off.present().hidden, off.present().text], [false, "Ruta disponible · incluye estados por defecto"], "sin bandera (FASE 6): la línea igual");
  e.load(project([workersPage()])); e.play(100); e.present();
  assert.equal(e.R('psLast["psFlow.text"]'), "Ruta disponible · incluye estados por defecto", "el DOM solo se escribe si cambia (psSet)");
  /* la página siguiente no tiene Historia: la línea que se veía se oculta */
  const empty = workersPage(); empty.scenarios[0].steps = [];
  e.R(`doc.pages.push(projectFromProjectData(${JSON.stringify(project([empty]))}).doc.pages[0]); doc.cur = 1; scStatus = "idle"; scPlayback = null;`);
  assert.equal(e.present().hidden, true, "sin Historia: sin línea");
});

/* ═══════════════ C. Viewer (sin bandera) ═══════════════ */
test("C1 · PARIDAD: el Viewer da la MISMA ruta y la MISMA línea que el editor/Present en el mismo instante (200 Historias aleatorias)", () => {
  const e = editor(), v = viewer();
  seed = 77;
  let lines = 0, overlays = 0;
  for (let k = 0; k < 200; k++) {
    const p = project([randomPage()]);
    e.load(p); v.load(p); e.play(0); v.play(0);
    for (const t of [0, 300, 900, 1400, 2100, 3050, 4600]) {
      e.tick(t); v.tick(t);
      const eo = e.overlay(), vo = v.overlay();
      assert.deepEqual(vo, eo, "Historia " + k + ", t = " + t + ": lienzo");
      const el = J(e.R("scFlowPresentLine()")), vl = v.line();
      assert.deepEqual(vl, el, "Historia " + k + ", t = " + t + ": línea");
      if (vl) lines++; if (vo) overlays++;
    }
  }
  assert.ok(lines > 400 && overlays > 300, "no trivial: " + lines + " líneas y " + overlays + " fotogramas con ruta");
});

test("C1b · PARIDAD con el horario VISIBLE: con una dependencia de llegada, la procedencia del Viewer cambia cuando se VE el paso (como el editor)", () => {
  /* Todo afirmado salvo Worker B; Worker A caído: la única ruta disponible pasa por B, que es «por defecto» hasta que se VE su
     SET_STATE UP. Ese paso espera la llegada del pedido (1100 ms), aunque su `at` narrativo sea 300. */
  const pg = workersPage({ arrivalDependencies: [{ stepId: 2, waitsForArrivalOf: [1] }] }, [send(1, 0, 11), setS(2, 300, WB, "UP")]);
  pg.behaviors = [CLI, API, COLA, BD].map((nodeId) => ({ nodeId, initialState: "UP" })).concat([{ nodeId: WA, initialState: "DOWN" }]);
  const e = editor(), v = viewer();
  e.load(project([pg])); v.load(project([pg])); e.play(0); v.play(0);
  for (const [t, text] of [[500, "Ruta disponible · incluye estados por defecto"], [1200, "Ruta disponible"]]) {
    e.tick(t); v.tick(t);
    assert.deepEqual(v.line(), { status: "AVAILABLE", text }, "t = " + t);
    assert.deepEqual(v.line(), J(e.R("scFlowPresentLine()")), "t = " + t + ": igual que el editor");
  }
});

test("C2 · Viewer: misma regla de existencia que la herramienta (Flujo + par); NO_PATH solo la línea; ENDPOINT_MISSING y sin par, nada; sin flow-semantics.js (SW anterior), nada", () => {
  const v = viewer();
  v.load(project([workersPage()])); v.play(1600);
  assert.ok(v.overlay() && v.line(), "con par estructural");
  const noFlow = workersPage({ observedFlow: { from: CLI, to: BD } }); noFlow.edges = noFlow.edges.map((x) => Object.assign({}, x, { kind: undefined }));
  v.load(project([noFlow])); v.play(1600); assert.deepEqual([v.overlay(), v.line()], [null, null], "sin ninguna conexión Flujo no hay herramienta (D6) ni nada en el Viewer");
  const cut = workersPage({ observedFlow: { from: CLI, to: BD } }); cut.edges = cut.edges.filter((x) => x.id !== 12);
  v.load(project([cut])); v.play(1600); assert.deepEqual([v.overlay(), v.line()], [null, { status: "NO_PATH", text: "Sin ruta de flujo" }]);
  v.load(project([workersPage({ observedFlow: { from: 77, to: BD } })])); v.play(1600); assert.deepEqual([v.overlay(), v.line()], [null, null]);
  const amb = workersPage(); amb.nodes.push(rect(9, "Otro")); amb.edges.push(edge(19, 9, API, "FLOWS_TO"));
  v.load(project([amb])); v.play(1600); assert.deepEqual([v.overlay(), v.line()], [null, null]);
  const old = viewer({ withFlow: false }); old.load(project([workersPage()])); old.play(1600);
  assert.deepEqual([old.overlay(), old.line()], [null, null], "sin el módulo: el Viewer de siempre");
  assert.equal(old.refresh().hidden, true);
  /* memoización: una ruta por reproducción; un salto (otra reproducción) la recalcula */
  v.load(project([workersPage()])); v.play(0); v.R("__routes = 0");
  for (const t of [100, 900, 1600, 3100]) { v.tick(t); v.overlay(); v.line(); }
  assert.equal(v.R("__routes"), 1, "una ruta por reproducción, no por fotograma");
  v.play(0); v.overlay(); assert.equal(v.R("__routes"), 2);
});

test("C3 · Viewer: la línea va en el rótulo (#stFlow) solo reproduciendo (también en pausa y terminada); renderViewerFrame entrega la ruta al lienzo", () => {
  const v = viewer(); v.load(project([workersPage()]));
  let r = v.refresh(); assert.equal(r.hidden, true, "lista para reproducir: sin línea (D7)");
  v.play(100); r = v.refresh(); assert.deepEqual([r.hidden, r.text, r.cls], [false, "Ruta disponible · incluye estados por defecto", "stFlow isAVAILABLE"]);
  v.tick(3100); r = v.refresh(); assert.deepEqual([r.text, r.cls], ["Ruta no disponible", "stFlow isUNAVAILABLE"]);
  v.R('story.status = "completed"'); assert.equal(v.refresh().text, "Ruta no disponible", "terminada");
  v.R('story.status = "running"; story.clock.pausedAt = 0'); assert.equal(v.refresh().hidden, false, "en pausa (running con el reloj congelado)");
  v.R("story = null"); assert.equal(v.refresh().hidden, true, "Detener");
  v.play(0); v.R("__now = 3100; renderViewerFrame()");
  const rs = J(v.R("__rs"));
  assert.ok(rs.scenarioRuntime && rs.scenarioRuntime.flow, "renderViewerFrame: scenarioRuntime.flow");
  assert.deepEqual(rs.scenarioRuntime.flow, v.overlay(), "el mismo dato que storyFlowOverlay");
  assert.equal(v.$("stFlow").textContent, "Ruta no disponible", "y el rótulo en el mismo fotograma");
  v.load(project([workersPage({ observedFlow: { from: 77, to: BD } })])); v.play(0); v.R("__now = 3100; renderViewerFrame()");
  assert.equal(J(v.R("__rs")).scenarioRuntime.flow, undefined, "sin par resuelto: el renderState de siempre");
});

/* ═══════════════ D. Exportación ═══════════════ */
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
function renderCtx(src = read) {
  const ctx = { console, performance: { now: () => 0 }, Math, JSON, Image: function () { this.complete = false; }, document: { createElement: () => ({ getContext: () => null }) } };
  ctx.window = ctx; ctx.matchMedia = () => ({ matches: false });
  vm.createContext(ctx);
  for (const f of ["config", "safe-svg", "model", "geometry", "skin", "scenario-engine", "scenario-playback", "story-playback", "render"]) vm.runInContext(src("js/" + f + ".js"), ctx, { filename: f });
  vm.runInContext(`settings = {speed:.5, dots:3, build:false, stagger:.45, grid:false, snap:false, font:"Georgia, serif", single:false};`, ctx);
  /* el exportador SVG real (export.js): sus funciones puras; svgTextWidth mide como el registro (los rótulos no son de esta fase) */
  const ex = src("js/export.js");
  vm.runInContext(`function svgTextWidth(text, fs){ return String(text).length * fs * .55; }`, ctx);
  for (const n of ["escapeXML", "escapeAttribute", "renderConnectorToSVG"].concat(ex.includes("function semanticMarksToSVG(") ? ["semanticMarksToSVG"] : []))
    vm.runInContext(extract(ex, n), ctx, { filename: "js/export.js#" + n });
  return ctx;
}
function canvasPage() {
  const N = (id, x, y, label) => ({ id, shape: "rect", x, y, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
  const E = (id, from, to, kind, extra) => Object.assign({ id, from, to, route: "ortho", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" }, kind ? { kind } : {}, extra || {});
  return { name: "W", nextId: 100, behaviors: [], nextScenarioId: 2,
    nodes: [N(CLI, 120, 300, "Cliente"), N(API, 340, 300, "API"), N(COLA, 560, 300, "Cola"), N(WA, 800, 200, "Worker A"), N(WB, 800, 400, "Worker B"), N(BD, 1040, 300, "BD"), N(AUTH, 340, 470, "Auth"), N(MET, 340, 130, "Métricas")],
    edges: [E(11, CLI, API, "FLOWS_TO"), E(12, API, COLA, "FLOWS_TO", { startArrow: true, dashed: true }), E(13, COLA, WA, "FLOWS_TO"), E(14, COLA, WB, "FLOWS_TO"), E(15, WA, BD, "FLOWS_TO"),
      E(16, WB, BD, "FLOWS_TO"), E(17, API, AUTH, "REQUIRES"), E(18, API, MET), E(19, MET, AUTH, "REQUIRES", { startArrow: true, arrowSize: 2, lineColor: "#d08b5b" }), E(20, CLI, MET, "FUTURO")],
    scenarios: [story(1, [send(1, 0, 11), setS(2, 1500, WA), setS(3, 3000, WB)])] };
}
function setDoc(R, pg, theme = "crema", customBg = "") { R.__pg = J(pg); vm.runInContext(`doc = {theme:"${theme}", customBg:"${customBg}", cur:0, pages:[projectFromProjectData({version:5, app:"fluyo", doc:{theme:"${theme}", cur:0, pages:[__pg]}}).doc.pages[0]]};`, R); }
function drawEdgeOps(R, edgeId, { skin = false, isExport = false, theme = "crema", flow = null } = {}) {
  const m = recCanvas(); R.m = m; R.__flow = flow;
  vm.runInContext(`(()=>{ const rs = makeReadOnlyRenderState({zoom:1, skin:${skin ? '"built"' : "undefined"}}); rs.skinOn = ${skin ? 'skinActive("built", 1)' : "false"}; rs.skinBg = "#F3EEE3";
    if(__flow) rs.scenarioRuntime = {nodeStates:{}, activeSends:[], completedSends:[], activeOccurrences:[], completedOccurrences:[], activeNodeEffects:[], completedNodeEffects:[], scenario:null, flow:__flow};
    drawEdge(m.c, P().edges.find(e => e.id === ${edgeId}), 10, "${theme}", ${isExport}, rs); })()`, R);
  return J(m.log);
}
const svgOf = (R, edgeId, skin = false, theme = "crema") => vm.runInContext(`renderConnectorToSVG(P().edges.find(e => e.id === ${edgeId}), "${theme}", ${skin})`, R);

test("D1 · raster (PNG/JPG/GIF): las marcas salen al exportar, con N3; los overlays de comportamiento nunca", () => {
  const R = renderCtx(); setDoc(R, canvasPage());
  for (const id of [11, 12, 17, 19]) assert.deepEqual(drawEdgeOps(R, id, { isExport: true }), drawEdgeOps(R, id), "conexión " + id + ": la exportación pinta lo mismo que el lienzo");
  const chevrons = (log) => log.filter((x) => x[0] === "@stroke" && x[3] === 1.6).length;
  assert.equal(chevrons(drawEdgeOps(R, 11, { isExport: true })), 2, "Flujo: dos cuñas");
  assert.equal(drawEdgeOps(R, 17, { isExport: true }).filter((x) => x[0] === "arc").length, 1, "Requisito: el anillo");
  for (const id of [18, 20]) assert.equal(chevrons(drawEdgeOps(R, id, { isExport: true })) + drawEdgeOps(R, id, { isExport: true }).filter((x) => x[0] === "arc").length, 0, "conexión " + id + " (genérica / kind desconocido): sin marcas");
  const rings = (log) => log.filter((x) => x[0] === "@stroke" && x[3] === 1.5 && x[2] === "#F3EEE3").length;
  assert.equal(rings(drawEdgeOps(R, 17, { skin: true, isExport: true })), 0, "N3 al exportar: sin anillo de salida en el Requisito");
  assert.equal(rings(drawEdgeOps(R, 11, { skin: true, isExport: true })), 1, "el Flujo conserva su anillo de salida");
  const flow = { edges: { 11: { cls: "UNAVAILABLE", prev: "AVAILABLE", k: 0.5 } }, sweep: { status: "UNAVAILABLE", p: 0.3, depth: { 11: 0 }, layers: 1 }, pips: [], pulses: {} };
  assert.deepEqual(drawEdgeOps(R, 11, { isExport: true, flow }), drawEdgeOps(R, 11, { isExport: true }), "al exportar en plena reproducción: ni funda ni barrido");
});

test("D2 · sin `kind`, la exportación raster de los ejemplos es la de " + BASE + " operación a operación (plano y piel)", () => {
  const R = renderCtx(), OLD = renderCtx(atBase);
  let n = 0;
  for (const f of historicalExamples(root, BASE).filter((x) => /\.json$/.test(x))) {
    const d = JSON.parse(read("ejemplos/data/" + f));
    if (!d || d.app !== "fluyo" || !d.doc) continue;
    assert.ok(!JSON.stringify(d).includes('"kind"'), f + ": ningún ejemplo usa kind (premisa)");
    for (const skin of [false, true]) {
      const frame = (R2) => { const m = recCanvas(); R2.m = m; R2.__d = J(d);
        vm.runInContext(`(()=>{ const r = projectFromProjectData(__d); doc = r.doc; doc.cur = 0; const rs = makeReadOnlyRenderState({width:1200, height:800, skin:${skin ? '"built"' : "undefined"}});
          render(m.c, 1.3, {export:true, skin:${skin ? '"built"' : "undefined"}, bounds:{x:0, y:0, w:1200, h:800}, renderState: rs}); })()`, R2);
        return JSON.stringify(m.log); };
      assert.equal(frame(R), frame(OLD), f + (skin ? " (piel)" : ""));
      n++;
    }
  }
  assert.ok(n >= 16, "8 ejemplos × 2");
});

test("D3 · SVG (export.js): sin `kind` cada conexión de los ejemplos sale byte a byte como en " + BASE + " (plano y piel); con kind, las marcas en el orden del lienzo y N3", () => {
  const R = renderCtx(), OLD = renderCtx(atBase);
  let edges = 0;
  for (const f of historicalExamples(root, BASE).filter((x) => /\.json$/.test(x))) {
    const d = JSON.parse(read("ejemplos/data/" + f));
    if (!d || d.app !== "fluyo" || !d.doc) continue;
    for (const R2 of [R, OLD]) { R2.__d = J(d); vm.runInContext("doc = projectFromProjectData(__d).doc; doc.cur = 0; edgeLabelPos = new Map();", R2); }
    for (const e of JSON.parse(vm.runInContext("JSON.stringify(P().edges)", R))) for (const skin of [false, true]) {
      assert.equal(svgOf(R, e.id, skin, d.doc.theme || "dark"), svgOf(OLD, e.id, skin, d.doc.theme || "dark"), f + " #" + e.id + (skin ? " piel" : ""));
      edges++;
    }
  }
  assert.ok(edges > 40, String(edges));
  setDoc(R, canvasPage(), "crema", "#20262b"); vm.runInContext("edgeLabelPos = new Map();", R);
  const flow = svgOf(R, 11).split("\n"), req = svgOf(R, 17).split("\n");
  assert.equal(flow.length, 1 + 1 + 2, "Flujo: línea, punta y dos cuñas");
  assert.match(flow[2], /^<path d="M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+" fill="none" stroke="#[0-9a-fA-F]+" stroke-width="1\.6" stroke-linecap="round" stroke-linejoin="round"\/>$/);
  assert.match(req[2], /^<circle cx="[\d.]+" cy="[\d.]+" r="4\.2" fill="#20262b" stroke="#[0-9a-fA-F]+" stroke-width="1\.6" stroke-linecap="round" stroke-linejoin="round"\/>$/, "Requisito: anillo relleno del fondo propio del documento");
  assert.match(svgOf(R, 19).split("\n").find((l) => l.startsWith("<circle")), /fill="#20262b" stroke="#d08b5b"/, "con el color de la línea (y detrás de la punta de inicio)");
  assert.equal(svgOf(R, 12).split("\n").length, 1 + 2 + 2, "punta de inicio y discontinuo: las cuñas siguen, macizas");
  assert.ok(!/stroke-dasharray/.test(svgOf(R, 12).split("\n").slice(3).join("\n")), "las marcas nunca usan el discontinuo del usuario");
  for (const id of [18, 20]) assert.equal(svgOf(R, id).split("\n").length, 2, "conexión " + id + ": sin marcas");
  /* N3 con la piel: el Requisito no lleva el anillo de salida; el Flujo sí, después de sus marcas */
  const skinReq = svgOf(R, 17, true).split("\n"), skinFlow = svgOf(R, 11, true).split("\n");
  assert.equal(skinReq.filter((l) => /^<circle/.test(l)).length, 1); assert.equal(skinReq.length, 3, "línea, punta, anillo de Requisito (sin anillo de salida)");
  assert.equal(skinFlow.length, 5, "línea, punta, dos cuñas y el anillo de salida"); assert.ok(/stroke-width="1\.6"/.test(skinFlow[3]) && !/stroke-width="1\.6"/.test(skinFlow[4]), "orden del lienzo: marcas → anillo de salida");
});

test("D4 · el golden compartido con el MCP (fluyo-scenarios-semantics-5-marcas-svg.json): las conexiones de cada variante coinciden con el SVG de export.js", () => {
  const G = JSON.parse(read("test/fixtures/fluyo-scenarios-semantics-5-marcas-svg.json"));
  assert.ok(G.variants.length >= 2);
  const R = renderCtx();
  for (const v of G.variants) {
    const d = J(G.doc); d.doc.theme = v.theme; d.doc.customBg = v.customBg; R.__d = d;
    vm.runInContext("doc = projectFromProjectData(__d).doc; doc.cur = 0; edgeLabelPos = new Map();", R);
    const mine = JSON.parse(vm.runInContext("JSON.stringify(P().edges.map(e => e.id))", R)).map((id) => svgOf(R, id, v.skin === "built", v.theme)).filter(Boolean).join("\n").split("\n");
    const gold = G.svgs[v.name].split("\n").filter((l) => mine.includes(l));
    assert.deepEqual(gold, mine, v.name + ": las líneas de las conexiones, en orden");
    assert.ok(mine.some((l) => l.startsWith("<circle")) && mine.filter((l) => /stroke-width="1\.6"/.test(l)).length >= 6, v.name + ": hay marcas (no trivial)");
  }
});

/* ═══════════════ E. Kernel: avisos W2/W3 y set_observed_flow ═══════════════ */
test("E1 · validateProject: W2 y W3 son avisos (no cambian `valid`) y solo existen si hay; los ejemplos y los fixtures dan la salida de " + BASE, () => {
  const K = context(read, INTEGRITY), OLD = context(atBase, INTEGRITY);
  const val = (C, p) => { C.__p = J(p); return vm.runInContext("JSON.stringify(FluyoIntegrity.validateProject(__p))", C); };
  let n = 0;
  for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of (dir === "ejemplos/data" ? historicalExamples(root, BASE) : fs.readdirSync(path.join(root, dir))).filter((x) => /\.json$/.test(x))) {
    let d; try { d = JSON.parse(read(dir + "/" + f)); } catch { continue; }
    if (!d || d.app !== "fluyo" || !d.doc) continue;
    assert.equal(val(K, d), val(OLD, d), dir + "/" + f); n++;
  }
  assert.ok(n >= 8, String(n));
  const pg = workersPage({ observedFlow: { from: CLI, to: 77 } }); pg.edges.push(edge(19, CLI, MET, "FUTURO"), edge(20, MET, CLI, "GENERIC"));
  const r = JSON.parse(val(K, project([pg])));
  assert.equal(r.valid, true, "los avisos no invalidan");
  assert.deepEqual(r.warnings.map((w) => [w.code, w.pageIndex, w.entityId || w.storyId, w.kind || w.missing]),
    [["unknown_connection_kind", 0, 19, "FUTURO"], ["observed_flow_endpoint_missing", 0, 1, ["to"]]], "W3 (no «GENERIC»: es la lectura de Conexión) y W2");
  assert.ok(r.warnings.every((w) => typeof w.message === "string" && w.message.length > 10));
  assert.equal("warnings" in JSON.parse(val(K, project([workersPage({ observedFlow: { from: CLI, to: BD } })]))), false, "sin nada que avisar, sin la clave");
});

test("E2 · set_observed_flow (author_document): la MISMA escritura que el editor (setObservedFlowIn); refs del lote; null = Automática; rechazos", () => {
  const K = context(read, INTEGRITY);
  const apply = (p, ops) => { K.__p = J(p); K.__o = J(ops); return J(vm.runInContext("FluyoAuthoring.apply(__p, __o)", K)); };
  const op = (extra) => Object.assign({ op: "set_observed_flow", scope: "story", pageIndex: 0, storyId: 1 }, extra);
  const p = project([workersPage()]);
  const ok = apply(p, [op({ source: API, target: WB })]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.project.doc.pages[0].scenarios[0].observedFlow, { from: API, to: WB });
  assert.deepEqual([ok.changes[0].from, ok.changes[0].to, ok.changes[0].changed, ok.touched], [null, { source: API, target: WB }, true, [{ pageIndex: 0, storyId: 1 }]]);
  K.__p = J(p); const viaEditor = J(vm.runInContext(`(()=>{ const d = projectFromProjectData(__p).doc; setObservedFlowIn(d.pages[0], 1, {from:${API}, to:${WB}}); return projectToSerializable(d, {}); })()`, K));
  assert.deepEqual(ok.project.doc, viaEditor.doc, "el documento es el que escribe el editor");
  assert.deepEqual(ok.project.doc.pages[0].scenarios[0].steps, p.doc.pages[0].scenarios[0].steps, "no toca los pasos");
  const same = apply(ok.project, [op({ source: API, target: WB })]);
  assert.deepEqual([same.ok, same.changes[0].changed], [true, false], "lo que ya hay: changed:false");
  const auto = apply(ok.project, [op({ source: null, target: null })]);
  assert.deepEqual([auto.ok, "observedFlow" in auto.project.doc.pages[0].scenarios[0], auto.changes[0].to], [true, false, null], "null + null = Automática (quita la clave)");
  const withRef = apply(p, [{ op: "create_node", scope: "page", pageIndex: 0, ref: "x", spec: { shape: "rect", x: 0, y: 400 } }, op({ source: { ref: "x" }, target: BD })]);
  assert.equal(withRef.ok, true); assert.deepEqual(withRef.project.doc.pages[0].scenarios[0].observedFlow, { from: withRef.refs[0].id, to: BD }, "{ref} del lote");
  const codes = (ops) => { const r = apply(p, ops); return r.ok ? "ok" : r.errors[0].code; };
  assert.equal(codes([op({ source: API })]), "INVALID_OPERATION", "falta target");
  assert.equal(codes([op({ source: null, target: BD })]), "INVALID_OPERATION", "uno solo null");
  assert.equal(codes([op({ source: API, target: API })]), "INVALID_OPERATION", "origen = destino");
  assert.equal(codes([op({ source: API, target: 99 })]), "TARGET_NOT_FOUND");
  assert.equal(codes([op({ storyId: 9, source: API, target: BD })]), "STORY_NOT_FOUND");
  assert.equal(codes([op({ source: { ref: "nada" }, target: BD })]), "UNKNOWN_REF");
  assert.equal(codes([Object.assign(op({ source: API, target: BD }), { scope: "page" })]), "SCOPE_MISMATCH");
  assert.equal(codes([op({ source: API, target: BD, extra: 1 })]), "INVALID_OPERATION", "campo no permitido");
  /* la cascada de FASE 3 sigue: borrar el extremo quita la ruta en el mismo lote */
  const cascade = apply(ok.project, [{ op: "delete_node", scope: "page", pageIndex: 0, node: { id: WB } }]);
  assert.equal(cascade.ok, false, "WB lo usa la Historia (paso 3): B2 manda, como siempre");
  const free = apply(ok.project, [op({ source: API, target: MET }), { op: "delete_node", scope: "page", pageIndex: 0, node: { id: MET } }]);
  assert.deepEqual([free.ok, "observedFlow" in free.project.doc.pages[0].scenarios[0], free.changes[1].cascade.observedFlows], [true, false, [1]]);
});

/* ═══════════════ G. Estático y alcance ═══════════════ */
test("G1 · markup: #psFlow en el rótulo de Present y #stFlow en el del Viewer; la fila de controles (#psGroup, banda #story) es la de " + BASE + "; el Viewer carga flow-semantics.js entre story-clock.js y viewer.js", () => {
  const { NEW_FILES: NEW_I18N, undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade js/i18n.js y js/i18n-en.js (no existen en la base) */
  const idx = undoI18n("index.html", read("index.html")), old = atBase("index.html");
  const block = (s, open, close) => s.slice(s.indexOf(open), s.indexOf(close, s.indexOf(open)) + close.length);
  assert.equal(block(idx, '<div id="presentBar">', "\n</div>"), block(old, '<div id="presentBar">', "\n</div>"), "el mando de Present no cambia");
  const ps = block(idx, '<div id="presentStory"', "\n</div>");
  assert.ok(/<div id="psSummary"[^>]*><\/div>[\s\S]*<div id="psFlow" class="psFlow" role="status" hidden><\/div>/.test(ps), "#psFlow, tras el resumen, oculto de inicio");
  const s = undoI18n("s/index.html", read("s/index.html")), sOld = atBase("s/index.html");
  assert.equal(block(s, '<section id="story"', "</section>"), block(sOld, '<section id="story"', "</section>"), "la banda del Viewer sigue siendo solo el transporte");
  assert.ok(/<div id="stNow"[\s\S]*<div id="stFlow" class="stFlow" role="status" hidden><\/div>\n  <\/div>/.test(s), "#stFlow dentro del rótulo");
  const at = (f) => s.indexOf('<script src="../js/' + f + '"></script>');
  assert.ok(at("story-clock.js") > 0 && at("story-clock.js") < at("flow-semantics.js") && at("flow-semantics.js") < at("viewer.js"), "orden de carga (D7)");
  const css = read("css/styles.css"), share = read("css/share.css");
  for (const r of ["#presentStory .psFlow{", "#presentStory .psFlow[hidden]{display:none;}", "#presentStory .psFlow.isAVAILABLE{", "#presentStory .psFlow.isUNAVAILABLE{"]) assert.ok(css.includes(r), r);
  for (const r of [".stNow .stFlow{", ".stNow .stFlow[hidden]{ display:none; }", ".stNow .stFlow.isAVAILABLE{", ".stNow .stFlow.isUNAVAILABLE{"]) assert.ok(share.includes(r), r);
  assert.ok(!/text-overflow:ellipsis/.test(share.slice(share.indexOf(".stNow .stFlow{"), share.indexOf("\n", share.indexOf(".stNow .stFlow{")))), "la línea nunca se corta");
});

test("G2 · textos y vocabulario: solo los aprobados; sin UNKNOWN ni vocabulario de salud o causa (§ 0)", () => {
  const fsx = read("js/flow-semantics.js"), five = fsx.slice(fsx.indexOf("/* ─────────── FASE 5"));
  const v = read("js/viewer.js"), vb = v.slice(v.indexOf("/* ─────────────────────── Ruta observada"), v.indexOf("/* El transporte vive en la banda"));
  for (const src of [five, vb, read("js/present-story.js")]) {
    assert.ok(!/\b(sano|degradad|afectad|bloquead|impacto|causa)/i.test(src), "sin vocabulario de salud");
    assert.ok(!/UNKNOWN|desconocid/.test(src.replace(/UNKNOWN, EXPLICIT/, "")), "sin UNKNOWN");
  }
  assert.ok(!/PROTO_|prototipo=|protoSemantic|proto-semantic/.test(fsx + v + read("js/export.js") + read("s/index.html")), "B7");
});

test("G3 · alcance frente a " + BASE + ": solo los archivos de FASE 5 y sw.js (CACHE v100, precache igual); undo5 los devuelve EXACTOS", () => {
  const SERVED = ["js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !shellOnly(f, read, atBase));
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const { undo5, PIECES } = require("./fluyo-scenarios-semantics-5-undo.cjs");
  /* SCENARIOS-SEMANTICS-001 FASE 6 va encima (B1 en model.js y selection.js): se deshace con undo6 y su alcance lo vigila -6.test.cjs */
  const { PIECES: PIECES6 } = require("./fluyo-scenarios-semantics-6-undo.cjs"), { undoMsg6: undo6 } = require("./fluyo-step-message-001-undo.cjs"), read5 = (f) => undo6(f, read(f));
  const FILES = ["css/share.css", "css/styles.css", "docs/index.html", "index.html", "js/document-integrity.js", "js/editor-scenarios.js", "js/export.js", "js/flow-semantics.js",
    "js/present-story.js", "js/render.js", "js/story-authoring.js", "js/viewer.js", "s/index.html"];
  const PIECESM = require("./fluyo-step-message-001-undo.cjs").PIECES;   /* FLUYO-MCP-STEP-MESSAGE-001, igual */
  const { NEW_FILES: NEW_I18N, undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade js/i18n.js y js/i18n-en.js (no existen en la base) */
  assert.deepEqual([...new Set([...changed, ...untracked])].filter((f) => !NEW_I18N.includes(f)).filter((f) => !(f in PIECES6 || f in PIECESM) || read5(f) !== atBase(f)).sort(), FILES.concat("sw.js").sort());
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  for (const f of FILES) assert.equal(undo5(f, read5(f)), atBase(f), f + ": undo5 exacto");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v116";/);
  assert.equal(undoI18n("sw.js", read("sw.js")).replace('"fluyo-static-v116"', '"fluyo-static-v' + (100 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante; flow-semantics.js, viewer.js y s/ ya se precachean");
  for (const f of ["js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/story-clock.js", "js/geometry.js", "js/skin.js", "js/interaction.js", "js/ui.js", "js/state.js", "js/share-url.js", "js/editor-share.js", "js/deeplink.js"])
    assert.equal(read5(f), atBase(f), f + " intacto (modelo, motor, reloj, geometría, piel, Share y #d= sin cambios)");
  /* FASE 2/3/4 intactas en flow-semantics.js: FASE 5 solo añade al final (y una nota en la cabecera) */
  const cut = (s) => s.slice(s.indexOf("var FluyoFlow"), s.indexOf("    return {paths, total, exact, mustPass};"));
  assert.equal(cut(read("js/flow-semantics.js")), cut(atBase("js/flow-semantics.js")), "funciones de FASE 2, 3 y 4 sin cambios");
});

test("G4 · docs/index.html dice lo factual (kind, observedFlow, marcas en la exportación, connectionKind y set_observed_flow) y nada de la bandera labs; el kernel del MCP está sincronizado", () => {
  const d = read("docs/index.html");
  for (const s of ["<code>kind</code>", '<code>"FLOWS_TO"</code>', '<code>"REQUIRES"</code>', "<code>observedFlow</code>", "<code>connectionKind</code>", "<code>set_observed_flow</code>", "marcas de Flujo y Requisito"]) assert.ok(d.includes(s), s);
  assert.ok(!/labs/i.test(d), "sin la bandera labs (no hay interruptor visible hasta FASE 6)");
  const mcp = path.join(root, "..", "fluyo-mcp", "src", "generated", "kernel-sources.ts");
  if (fs.existsSync(mcp)) {
    const k = fs.readFileSync(mcp, "utf8");
    for (const s of ["set_observed_flow(ctx, op, pg){", "function semanticWarnings(doc){"]) assert.ok(k.includes(s), "kernel del MCP: " + s);
    assert.ok(!/name: "(flow-semantics|render|editor-scenarios|viewer|export)\.js"/.test(k), "la receta de la ruta, el Viewer y el exportador no son kernel");
  }
});
