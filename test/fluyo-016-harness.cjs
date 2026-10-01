"use strict";
/* Arnés compartido de FLUYO-016: DOM falso + editor de Historias en `vm` (extraído de los tests de 011). */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

function makeFakeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    dataset: {},
    hidden: false,
    checked: false,
    _value: "",
    get value() { return this._value || this.getAttribute("value") || ""; },
    set value(v) { this._value = String(v); },
    attrs: {},
    style: {
      _props: {},
      setProperty(k, v) { this._props[k] = String(v); },
      removeProperty(k) { delete this._props[k]; },
      getPropertyValue(k) { return this._props[k] || ""; },
    },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      toggle(c, on) { if (on === undefined) on = !this._set.has(c); if (on) this._set.add(c); else this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      remove(c) { this._set.delete(c); },
    },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
    get open() { return this.hasAttribute("open"); },
    set open(v) { if (v) this.setAttribute("open", ""); else this.removeAttribute("open"); },
    appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
    append(...cs) { cs.forEach((c) => this.appendChild(c)); },
    replaceChildren(...cs) { this._text = ""; this.children = []; this.append(...cs); },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    insertBefore(c, ref) { const i = this.children.indexOf(ref); if (i >= 0) this.children.splice(i, 0, c); else this.children.push(c); return c; },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    blur() {},
    getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }; },
    _text: "",
    get textContent() { return this._text || this.children.map((c) => c.textContent).join(""); },
    set textContent(v) { this._text = String(v); this.children = []; },
    querySelector(sel) { return queryElement(this, sel); },
    querySelectorAll(sel) { return queryAll(this, sel); },
    get className() { return [...this.classList._set].join(" "); },
    set className(v) { this.classList._set.clear(); for (const c of String(v).trim().split(/\s+/)) if (c) this.classList._set.add(c); },
    get id() { return this.attrs.id; },
    set id(v) { this.attrs.id = String(v); },
    get innerHTML() { return this.children.map((c) => c.outerHTML || c.textContent).join(""); },
    set innerHTML(v) { this._text = ""; this.children = []; if (v && typeof v === "string") { /* no parse needed */ } },
  };
  return el;
}

function matches(el, sel) {
  if (!el || !el.attrs) return false;
  const pseudo = sel.includes(":checked") ? "checked" : null;
  const base = pseudo ? sel.replace(":checked", "") : sel;
  if (base.startsWith("#")) return el.attrs.id === base.slice(1);
  if (base.startsWith(".")) return el.classList._set.has(base.slice(1));
  const m = base.match(/^([A-Za-z0-9]+)\[([A-Za-z0-9-]+)=([^\]]+)\]$/);
  let ok;
  if (m) {
    const tag = m[1].toUpperCase(), attr = m[2], val = m[3].replace(/^["']|["']$/g, "");
    ok = el.tagName === tag && el.getAttribute(attr) === val;
  } else {
    ok = el.tagName === base.toUpperCase();
  }
  if (ok && pseudo === "checked") return el.checked === true;
  return ok;
}
function queryElement(root, sel) {
  if (matches(root, sel)) return root;
  for (const c of root.children) { const r = queryElement(c, sel); if (r) return r; }
  return null;
}
function queryAll(root, sel) {
  const out = [];
  if (matches(root, sel)) out.push(root);
  for (const c of root.children) out.push(...queryAll(c, sel));
  return out;
}

function makeDOM() {
  const registry = new Map();
  const doc = {
    getElementById(id) { return registry.get(String(id)) || null; },
    createElement(tag) { return makeFakeElement(tag); },
    createTextNode(t) { const el = makeFakeElement("#text"); el.textContent = String(t); return el; },
    body: makeFakeElement("body"),
    querySelector(sel) { return queryElement(this.body, sel); },
    querySelectorAll(sel) { return queryAll(this.body, sel); },
    addEventListener() {},
    removeEventListener() {},
    _registry: registry,
  };
  function $(id) { return doc.getElementById(id); }
  function register(id, el) { el.attrs.id = String(id); registry.set(String(id), el); doc.body.appendChild(el); }
  return { doc, $, register };
}

function makeScenarioUIContext() {
  const { doc, $, register } = makeDOM();
  const ctx = vm.createContext({
    run: function (code) { return vm.runInContext(code, this); },
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Math,
    Number,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Error,
    TypeError,
    RangeError,
    RegExp,
    Date,
    String,
    Boolean,
    parseInt,
    isNaN,
    isFinite,
    Infinity,
    NaN,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    URL,
    URLSearchParams,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    window: {},
    document: doc,
    navigator: {},
    location: {},
    $,
    pushUndo: () => {},
    scheduleAutosave: () => {},
    switchPanelTab: () => {},
    clearSel: () => {},
    renderTabs: () => {},
    refreshPanel: () => {},
    selectOnly: (type, id) => { ctx.selN.clear(); ctx.selE.clear(); (type === "node" ? ctx.selN : ctx.selE).add(id); },
    singleSel: () => {
      if (ctx.selN.size === 1 && ctx.selE.size === 0) { const id = [...ctx.selN][0]; const n = ctx.run(`nodeById(${id})`); return n ? { type: "node", obj: n } : null; }
      if (ctx.selE.size === 1 && ctx.selN.size === 0) { const id = [...ctx.selE][0]; const e = ctx.run(`edgeById(${id})`); return e ? { type: "edge", obj: e } : null; }
      return null;
    },
    selN: new Set(),
    selE: new Set(),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  vm.runInContext(read("js/config.js"), ctx);
  vm.runInContext(read("js/safe-svg.js"), ctx);
  vm.runInContext(read("js/model.js"), ctx);
  vm.runInContext(read("js/scenario-engine.js"), ctx);
  vm.runInContext(read("js/scenario-playback.js"), ctx);
  vm.runInContext(read("js/story-playback.js"), ctx);
  vm.runInContext(read("js/editor-scenarios.js"), ctx);
  vm.runInContext(read("js/selection.js"), ctx);
  return { ctx, doc, register };
}

function freshPage(ctx) {
  ctx.run(`
    doc={theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    undoStack=[]; redoStack=[];
  `);
}

function buildExample(ctx, labels = { source: "Cliente", target: "Comercio" }) {
  freshPage(ctx);
  ctx.run(`
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:${JSON.stringify(labels.source)}};
    const B={id:P().nextId++, shape:"rect", x:200, y:0, label:${JSON.stringify(labels.target)}};
    P().nodes.push(A,B);
    const E={id:P().nextId++, from:A.id, to:B.id};
    P().edges.push(E);
    edgeId=E.id; nodeId=B.id; sourceId=A.id;
  `);
  return { nodeId: ctx.nodeId, edgeId: ctx.edgeId, sourceId: ctx.sourceId };
}

function setupPanel(ctx, register) {
  const ids = [
    "scPlacementBar", "scPaletteToggle", "scScenarioTitle", "scDetailsDialog", "panelScenarios", "scSel", "scName",
    "scUnsupported", "scErrors", "scBehaviors", "scStoryboard", "scEmptyState", "scAddBehavior", "scAddMoment",
    "scRun", "scReset", "scTraceLog", "scStatus", "tabProperties", "scToggleConfig", "scConfig", "scToggleTrace",
    "scTraceWrap", "scMomentDialog", "scMomentState", "scMomentSend", "scMomentCancel", "scEventLibrary",
    "scEventDialog", "scEventDialogTitle", "scEventName", "scEventVisual", "scEventPreview", "scEventSave",
    "scEventCancel", "scEventNew", "scMotion", "scPreviewDiagram", "scPhrase", "scPhraseInsert", "scVisualPicker",
    "scCustomVisual", "scVisualHelp", "scEventScope", "scEventLocked", "scEventError", "scPreviewPlay", "scEventDialogSubtitle",
    "scVisualLabel", "scPhraseLabel", "scMessageColorLabel", "scFillColorLabel",
    "scWhere", "scConsequence", "scAppearance", "scAppearanceSummary", "scBehavior", "scBehaviorSummary", "scShowSymbol",
    "scMessage", "scMessageColorCustom", "scHighlight", "scBlink", "scDim", "scUseFill", "scFillColorCustom",
    "scUseMessage", "scFillConfig", "scMessageConfig", "scShowSymbolConfig", "scMessageSwatches", "scFillSwatches", "scSymbolUse", "scChangeSymbol", "scDurationSeconds", "scDurationCustom",
  ];
  for (const id of ids) {
    const tag = ["scWhere", "scConsequence", "scMotion", "scShowSymbol", "scUseMessage", "scHighlight", "scBlink", "scDim", "scUseFill", "scMessageColorCustom", "scFillColorCustom", "scDurationSeconds"].includes(id) ? "input" : "div";
    const el = ctx.document.createElement(tag);
    if (id === "scSel") {
      Object.defineProperty(el, "value", { get() { return String(el._value || ""); }, set(v) { el._value = String(v); }, configurable: true });
      el.onchange = null;
    }
    if (tag === "input") el.setAttribute("type", ["scShowSymbol", "scUseMessage", "scHighlight", "scBlink", "scDim", "scUseFill"].includes(id) ? "checkbox" : (id === "scDurationSeconds" ? "number" : "radio"));
    if (id === "scWhere") { el.setAttribute("name", "scWhere"); el.setAttribute("value", "element"); }
    if (id === "scConsequence") { el.setAttribute("name", "scConsequence"); el.setAttribute("value", "none"); }
    if (id === "scMotion") { el.setAttribute("name", "scMotion"); el.setAttribute("value", "normal"); }
    if (id === "scEventDialog") { el.showModal = () => {}; el.close = () => {}; }
    register(id, el);
  }
}

function ensureUI(ctx) {
  ctx.run("ensureScenariosUI();");
}


module.exports = { makeScenarioUIContext, freshPage, buildExample, setupPanel, ensureUI, read };
