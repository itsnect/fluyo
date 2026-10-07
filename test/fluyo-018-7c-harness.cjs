"use strict";
/* Arnés de FLUYO-018.7c: kernel real (model.js + motor + integridad + FluyoAuthoring) y editor real (model.js, state.js sin DOM,
   selection.js y renderTabs() extraído de ui.js) en `vm`. La ✕ de la pestaña es la que pulsa el usuario. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
function kernel() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(vm.runInContext(`JSON.stringify((function(){ const __a = JSON.parse(__in); return (${expr}); })())`, ctx)); };
  return ctx;
}

function renderTabsSource() {
  const ui = read("js/ui.js");
  const a = ui.indexOf("function renderTabs(){"), b = ui.indexOf("/* ===================== Modo presentación");
  assert.ok(a >= 0 && b > a, "renderTabs() debe seguir existiendo en ui.js");
  return ui.slice(a, b);
}
/* Editor real. `confirm` responde con __confirmAnswer y guarda los mensajes; el Playback se simula con __playing/__resets. */
function editor() {
  const el = () => ({ children: [], style: {}, appendChild(c) { this.children.push(c); return c; }, set innerHTML(v) { this.children = []; }, get innerHTML() { return ""; } });
  const bar = el();
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, __bar: bar, GRID: 20 });
  const run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js"]) vm.runInContext(read("js/" + f), ctx, { filename: f });
  run(`var selN=new Set(), selE=new Set(), clip=null, __confirms=[], __confirmAnswer=true, __playing=false, __resets=0, __autosaves=0;
       function confirm(m){ __confirms.push(m); return __confirmAnswer; } function alert(){} function prompt(){ return null; }
       function refreshPanel(){} function scheduleAutosave(){ __autosaves++; }
       function isScenarioPlaybackActive(){ return __playing; } function scReset(){ __playing=false; __resets++; }
       const $=()=>__bar; const document={ createElement:()=>__mk() };`);
  ctx.__mk = el;
  run(read("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(read("js/selection.js"), ctx, { filename: "js/selection.js" });
  vm.runInContext(renderTabsSource(), ctx, { filename: "js/ui.js#renderTabs" });
  const close = (i) => {
    run("renderTabs()");
    const x = bar.children[i] && bar.children[i].children.find((c) => c.className === "x");
    assert.ok(x && typeof x.onclick === "function", "la pestaña " + i + " tiene ✕");
    x.onclick({ stopPropagation() {} });
  };
  const tabs = () => { run("renderTabs()"); return bar.children.filter((t) => t.className && t.className.startsWith("tab")).map((t) => ({ active: t.className.includes("active"), close: t.children.some((c) => c.className === "x") })); };
  const load = (project) => run("doc=projectFromProjectData(" + JSON.stringify(project) + ").doc; undoStack.length=0; redoStack.length=0; selN.clear(); selE.clear(); __confirms.length=0;");
  return { ctx, run, close, tabs, load };
}

const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v !== null && typeof v === "object" ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v);
const revisionOf = (p) => "sha256:" + crypto.createHash("sha256").update(canonical(p)).digest("hex");

const page = (name) => ({ name, nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
const project = (pages, cur = 0) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages, cur }, settings: {} });

module.exports = { kernel, editor, read, J, revisionOf, canonical, page, project };
