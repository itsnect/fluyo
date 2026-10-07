"use strict";
/* Arnés de FLUYO-018.8: editor real COMPLETO en `vm` — model.js, motor, FluyoStory, FluyoIntegrity, link-codec.js, share-url.js,
   state.js entero (autoguardado y documento entrante: presentIncomingDocument → incomingAsNewPage → appendPagesFrom), selection.js
   y renderTabs() de ui.js (más geometry.js, que usa centerView) — con un DOM mínimo y un localStorage en memoria. Sin red, sin timers reales. */
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { read, J } = require("./fluyo-018-7c-harness.cjs");

function renderTabsSource() {
  const ui = read("js/ui.js");
  const a = ui.indexOf("function renderTabs(){"), b = ui.indexOf("/* ===================== Modo presentación");
  assert.ok(a >= 0 && b > a, "renderTabs() debe seguir existiendo en ui.js");
  return ui.slice(a, b);
}

function element() {
  return {
    children: [], style: {}, value: "", checked: false, textContent: "", className: "",
    appendChild(c) { this.children.push(c); return c; },
    set innerHTML(v) { this.children = []; }, get innerHTML() { return ""; },
    getContext: () => ({}), getBoundingClientRect: () => ({ width: 800, height: 600 }),
    addEventListener() {}, click() {}, remove() {},
  };
}

/* `stored`: proyecto que ya está en el autoguardado (la sesión del destinatario). */
function fullEditor({ stored } = {}) {
  const elements = {}, store = new Map(), alerts = [], timers = [];
  if (stored !== undefined) store.set("fluyo.autosave.v1", JSON.stringify(stored));
  const ctx = vm.createContext({
    TextEncoder, TextDecoder, atob, btoa, URL, console, Blob, Response, CompressionStream, DecompressionStream, GRID: 20,
    document: { getElementById: (id) => (elements[id] ||= element()), createElement: () => element(), readyState: "complete", addEventListener() {} },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
    alert: (m) => alerts.push(m), confirm: () => true, prompt: () => null,
  });
  const run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "geometry.js", "link-codec.js", "share-url.js"])
    vm.runInContext(read("js/" + f), ctx, { filename: f });
  run(`var __playing=false, __resets=0, __edits=0, __baselines=0;
       function refreshPanel(){} function scheduleAnalyticsEdit(){ __edits++; } function resetAnalyticsBaseline(){ __baselines++; }
       function isScenarioPlaybackActive(){ return __playing; } function scReset(){ __playing=false; __resets++; }`);
  vm.runInContext(read("js/state.js"), ctx, { filename: "js/state.js" });
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  vm.runInContext(renderTabsSource(), ctx, { filename: "js/ui.js#renderTabs" });
  const call = (expr, arg) => { ctx.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(run(`JSON.stringify((function(){ const __a = JSON.parse(__in); return (${expr}); })())`)); };
  const callAsync = async (expr, arg) => { ctx.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(await run(`(async function(){ const __a = JSON.parse(__in); return JSON.stringify(await (${expr})); })()`)); };
  const load = (project) => run("applyProjectData(" + JSON.stringify(project) + ")");
  const docOf = () => J(run("doc"));
  const stored_ = () => (store.has("fluyo.autosave.v1") ? JSON.parse(store.get("fluyo.autosave.v1")) : null);
  /* La ✕ de una pestaña, como en el arnés de 018.7c. */
  const close = (i) => {
    run("renderTabs()");
    const bar = elements.pagesBar, x = bar.children[i] && bar.children[i].children.find((c) => c.className === "x");
    assert.ok(x && typeof x.onclick === "function", "la pestaña " + i + " tiene ✕");
    x.onclick({ stopPropagation() {} });
  };
  return { ctx, run, call, callAsync, load, docOf, close, elements, alerts, stored: stored_ };
}

/* Huella SEMÁNTICA de cada Historia de una página, resuelta contra la biblioteca de SU documento: lo que el Playback ve y ejecuta.
   Por Step: momento, acción, destino, estado y el EventType completo SIN su id (nombre, primitiva, frase, símbolo, presentación…),
   la frase ya renderizada y la metadata real de Playback (FluyoStory.stepMeta con ese documento instalado). Más el Trace. */
const FINGERPRINT = `(function(d, pi){
  const pg=d.pages[pi], saved=doc; doc=d;
  try{
    return (pg.scenarios||[]).map(sc=>{
      const meta=FluyoStory.stepMeta(sc.steps), run=FluyoStory.run(pg, sc);
      return {name:sc.name, engineVersion:sc.engineVersion, trace: run.ok? run.trace : {errors:run.errors},
        steps: sc.steps.map(s=>{
          const et=s.eventTypeId===undefined? undefined : (d.eventTypes.find(e=>e.id===s.eventTypeId)||null);
          let def=et; if(et){ def=JSON.parse(JSON.stringify(et)); delete def.id; }
          return {id:s.id, at:s.at, action:s.action, nodeId:s.nodeId, edgeId:s.edgeId, state:s.state, eventType:def,
                  sentence: et? FluyoStory.sentence(pg, s, et) : "", meta: meta[s.id]};
        })};
    });
  } finally { doc=saved; }
})`;

module.exports = { fullEditor, FINGERPRINT };
