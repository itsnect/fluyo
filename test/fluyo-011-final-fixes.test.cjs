"use strict";
/* FLUYO-011 — Final Fixes: clear page semantics, Event identity, custom FLOW token,
   visual movement speed and playback pacing. node --test test/fluyo-011-final-fixes.test.cjs */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const json = (o) => JSON.parse(JSON.stringify(o));

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

function pageSnapshot(ctx) {
  return json(ctx.run("P()"));
}

/* ─────────────────────────── G1. Clear Page semantics ─────────────────────────── */

test("clearPageContents elimina estructura, comportamientos y escenarios de la página pero conserva EventTypes", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    P().behaviors.push({nodeId:sourceId, initialState:"DOWN"});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:edgeId, eventTypeId:et.id});
    eventTypeCount=doc.eventTypes.length;
  `);
  assert.equal(ctx.run("P().nodes.length"), 2);
  ctx.run("clearPageContents(P());");
  assert.equal(ctx.run("P().nodes.length"), 0);
  assert.equal(ctx.run("P().edges.length"), 0);
  assert.equal(ctx.run("P().behaviors.length"), 0);
  assert.equal(ctx.run("P().scenarios.length"), 0);
  assert.equal(ctx.run("P().nextId"), 1);
  assert.equal(ctx.run("P().nextScenarioId"), 1);
  assert.equal(ctx.run("doc.eventTypes.length"), ctx.run("eventTypeCount"));
});

test("Clear page: undo restaura estructura, comportamientos y escenarios en una sola operación", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    P().behaviors.push({nodeId:sourceId, initialState:"DOWN"});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:edgeId, eventTypeId:et.id});
    before=JSON.stringify(P());
    pushUndo();
    clearPageContents(P());
    after=JSON.stringify(P());
    undo();
  `);
  assert.equal(ctx.run("JSON.stringify(P())"), ctx.run("before"));
  assert.notEqual(ctx.run("after"), ctx.run("before"));
  assert.equal(ctx.run("undoStack.length"), 0);
  assert.equal(ctx.run("redoStack.length"), 1);
});

test("Borrar nodo manualmente preserva Scenario con referencia missing", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:edgeId, eventTypeId:et.id});
    pushUndo();
    P().nodes=P().nodes.filter(n=>n.id!==sourceId);
    clearSel();
  `);
  assert.equal(ctx.run("scActiveScenario().steps.length"), 1);
  assert.equal(ctx.run("scActiveScenario().steps[0].eventTypeId"), 1);
});

/* ─────────────────────────── G3/G4. Event identity ─────────────────────────── */

test("Historia muestra identidad del evento: token + nombre primario y frase secundaria", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    scApplyTargets(et.id,[edgeId]);
    scRenderStoryboard();
  `);
  const rows = ctx.document.querySelectorAll(".scStoryRow");
  assert.equal(rows.length, 1);
  const primary = rows[0].querySelector(".scStepPrimary").textContent;
  const secondary = rows[0].querySelector(".scStepSecondary")?.textContent || "";
  assert.ok(primary.includes("💵"), "primary incluye token");
  assert.ok(primary.includes("Pago"), "primary incluye nombre del evento");
  assert.ok(secondary.includes("Cliente paga a Comercio"), "secondary incluye frase");
});

test("Renombrar EventType actualiza la identidad en Historia sin tocar Step", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    scApplyTargets(et.id,[edgeId]);
    before=JSON.stringify(scActiveScenario().steps);
    updateEventType(et.id,{name:"Transferencia"});
    scRenderStoryboard();
  `);
  assert.equal(ctx.run("JSON.stringify(scActiveScenario().steps)"), ctx.run("before"));
  const primary = ctx.document.querySelector(".scStepPrimary").textContent;
  assert.ok(primary.includes("Transferencia"));
});

test("No se duplica la línea cuando frase y nombre son idénticos", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et=createEventType({name:"Aprobación", primitive:"OCCURRENCE", sentenceTemplate:"{name}", visual:{value:"✓"}});
    scApplyTargets(et.id,[nodeId]);
    scRenderStoryboard();
  `);
  const rows = ctx.document.querySelectorAll(".scStoryRow");
  assert.equal(rows.length, 1);
  assert.ok(rows[0].querySelector(".scStepPrimary").textContent.includes("Aprobación"));
  assert.equal(rows[0].querySelector(".scStepSecondary"), null);
});

/* ─────────────────────────── G5/G6/G7. Custom FLOW token ─────────────────────────── */

test("Playback recibe el token personalizado del EventType en activeSends", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    scApplyTargets(et.id,[edgeId]);
    scRun();
    rs=FluyoScenarioPlayback.tick(scPlayback, 100);
  `);
  assert.equal(ctx.run("rs.activeSends.length"), 1);
  assert.equal(ctx.run("rs.activeSends[0].token"), "💵");
});

test("Dos eventos distintos usan su token correspondiente en playback", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    P().edges.push({id:P().nextId++, from:sourceId, to:nodeId});
  `);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const pago=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const despacho=createEventType({name:"Despacho", primitive:"FLOW", sentenceTemplate:"{source} despacha a {target}", visual:{value:"📦"}});
    const edges=P().edges.map(e=>e.id);
    scApplyTargets(pago.id,[edges[0]]);
    scApplyTargets(despacho.id,[edges[1]]);
    scActiveScenario().steps[1].at=0;
    scRun();
    rs=FluyoScenarioPlayback.tick(scPlayback, 100);
  `);
  const tokens = ctx.run("rs.activeSends.map(s=>s.token)").sort().join(",");
  assert.equal(tokens, "💵,📦");
});

test("SEND histórico sin EventType usa token vacío (fallback genérico)", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:edgeId});
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
    pb=FluyoScenarioPlayback.makePlayback(res.trace);
    pb.startedAtReal=0;
    rs=FluyoScenarioPlayback.tick(pb, 100);
  `);
  assert.equal(ctx.run("rs.activeSends.length"), 1);
  assert.equal(ctx.run("rs.activeSends[0].token"), "");
});

/* ─────────────────────────── G8/G9. Visual speed ─────────────────────────── */

test("EventType FLOW con motion fast/normal/slow produce duraciones diferentes", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    const speeds={};
    for(const m of ["fast","normal","slow"]){
      const et=createEventType({name:"Pago "+m, primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}, motion:m});
      const sc=createScenario(P(),"S"+m);
      createStep(sc, {at:0, action:"SEND", edgeId:edgeId, eventTypeId:et.id});
      const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
      const meta={}; meta[sc.steps[0].id]={token:et.visual.value, motion:et.motion};
      const pb=FluyoScenarioPlayback.makePlayback(res.trace, meta);
      pb.startedAtReal=0;
      FluyoScenarioPlayback.tick(pb, 1);
      speeds[m]=pb.activeSends[0].duration;
    }
  `);
  const speeds = ctx.run("speeds");
  assert.equal(speeds.fast, ctx.run('EVENT_MOTION_MS.fast'));
  assert.equal(speeds.normal, ctx.run('EVENT_MOTION_MS.normal'));
  assert.equal(speeds.slow, ctx.run('EVENT_MOTION_MS.slow'));
  assert.ok(speeds.fast < speeds.normal && speeds.normal < speeds.slow);
});

test("Cambiar motion no altera el Trace del engine", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    const traces=[];
    for(const m of ["fast","normal","slow"]){
      const et=createEventType({name:"Pago "+m, primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}, motion:m});
      const sc=createScenario(P(),"S"+m);
      createStep(sc, {at:0, action:"SEND", edgeId:edgeId, eventTypeId:et.id});
      const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
      traces.push(res.trace);
    }
  `);
  const traces = ctx.run("traces");
  const events = traces.map((t) => json(t.events));
  assert.equal(JSON.stringify(events[0]), JSON.stringify(events[1]));
  assert.equal(JSON.stringify(events[1]), JSON.stringify(events[2]));
});

/* ─────────────────────────── G10. Simultaneous FLOWs ─────────────────────────── */

test("Dos FLOW simultáneos son independientes y pueden tener velocidades distintas", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`
    P().edges.push({id:P().nextId++, from:sourceId, to:nodeId});
    const fast=createEventType({name:"Rápido", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"💵"}, motion:"fast"});
    const slow=createEventType({name:"Lento", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"📦"}, motion:"slow"});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:P().edges[0].id, eventTypeId:fast.id});
    createStep(sc, {at:0, action:"SEND", edgeId:P().edges[1].id, eventTypeId:slow.id});
    scRun();
    rs=FluyoScenarioPlayback.tick(scPlayback, 300);
  `);
  const active = ctx.run("rs.activeSends");
  assert.equal(active.length, 2);
  assert.ok(active.some((s) => s.token === "💵" && s.duration === ctx.run('EVENT_MOTION_MS.fast')));
  assert.ok(active.some((s) => s.token === "📦" && s.duration === ctx.run('EVENT_MOTION_MS.slow')));
});

/* ─────────────────────────── G11/G12. Reset & Run again ─────────────────────────── */

test("Reset durante FLOW lento cancela token y resultado pendiente", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"💵"}, motion:"slow"});
    scApplyTargets(et.id,[edgeId]);
    scRun();
    FluyoScenarioPlayback.tick(scPlayback, 500);
    scReset();
  `);
  assert.equal(ctx.run("scPlayback"), null);
  assert.equal(ctx.run("scStatus"), "idle");
  assert.equal(ctx.run("scActiveScenario().steps.length"), 1);
});

test("Run → Reset → Run conserva token y duración correctos", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"💵"}, motion:"slow"});
    scApplyTargets(et.id,[edgeId]);
    scRun();
    const firstToken=FluyoScenarioPlayback.tick(scPlayback,100).activeSends[0].token;
    const firstDuration=scPlayback.activeSends[0].duration;
    scReset();
    scRun();
    const secondToken=FluyoScenarioPlayback.tick(scPlayback,100).activeSends[0].token;
    const secondDuration=scPlayback.activeSends[0].duration;
    result={firstToken, firstDuration, secondToken, secondDuration};
  `);
  const r = ctx.run("result");
  assert.equal(r.firstToken, "💵");
  assert.equal(r.secondToken, "💵");
  assert.equal(r.firstDuration, ctx.run('EVENT_MOTION_MS.slow'));
  assert.equal(r.secondDuration, ctx.run('EVENT_MOTION_MS.slow'));
});

/* ─────────────────────────── H. Create/Edit Event UX Final Polish ─────────────────────────── */

function openEventEditor(ctx) {
  ctx.run(`
    scOpenEventDialog(null);
    scEditorLayout();
  `);
}

function setWhere(ctx, value) {
  ctx.run(`
    document.querySelectorAll('input[name="scWhere"]').forEach((e) => { e.checked = e.value === "${value}"; });
    scEditorLayout();
  `);
}

function toggleEffectInTest(ctx, id) {
  ctx.run(`
    var __fx = document.getElementById("${id}");
    if (__fx) __fx.checked = !__fx.checked;
    scEditorLayout();
    scUpdateEventPreview();
  `);
}

function pickSwatch(ctx, containerId, color) {
  ctx.run(`
    var sw = document.querySelector('#${containerId} .scSwatch[title="${color}"]');
    if (sw) sw.click();
  `);
}

test("Effect adjacency: Mensaje fields live inside the Message block", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  openEventEditor(ctx);
  setWhere(ctx, "element");
  toggleEffectInTest(ctx, "scUseMessage");
  const config = ctx.document.getElementById("scMessageConfig");
  assert.ok(config, "scMessageConfig exists");
  assert.equal(config.hidden, false, "Message config is visible");
  assert.ok(ctx.document.getElementById("scMessage"), "scMessage inside config");
  assert.ok(ctx.document.getElementById("scMessageSwatches"), "scMessageSwatches inside config");
});

test("Effect collapse: disabling Mensaje hides its fields", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  openEventEditor(ctx);
  setWhere(ctx, "element");
  toggleEffectInTest(ctx, "scUseMessage");
  assert.equal(ctx.document.getElementById("scMessageConfig").hidden, false);
  toggleEffectInTest(ctx, "scUseMessage");
  assert.equal(ctx.document.getElementById("scMessageConfig").hidden, true);
});

test("Color swatches update the native color input", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  openEventEditor(ctx);
  setWhere(ctx, "element");
  toggleEffectInTest(ctx, "scUseMessage");
  pickSwatch(ctx, "scMessageSwatches", "#d0576a");
  assert.equal(ctx.document.getElementById("scMessageColorCustom").value, "#d0576a");
});

test("New node event: Appearance and Behavior collapsed by default", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  openEventEditor(ctx);
  setWhere(ctx, "element");
  assert.equal(ctx.document.getElementById("scAppearance").open, false, "Appearance collapsed");
  assert.equal(ctx.document.getElementById("scBehavior").open, false, "Behavior collapsed");
  assert.equal(ctx.document.getElementById("scConsequence").value, "none", "Default behavior is none");
});

test("Existing configured Event: Appearance opens and summary reflects effects", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    const et = createEventType({
      name: "Incidente",
      primitive: "OCCURRENCE",
      sentenceTemplate: "{target} tiene un incidente",
      visual: { value: "⚠" },
      presentation: {
        nodeEffects: {
          showSymbol: true,
          message: "Fuera de servicio",
          messageColor: "#d0576a",
          dim: true,
          highlight: true,
          blink: false,
          fillColor: ""
        }
      }
    });
    scOpenEventDialog(et.id);
  `);
  assert.equal(ctx.document.getElementById("scAppearance").open, true, "Appearance opens for configured event");
  const summary = ctx.document.getElementById("scAppearanceSummary").textContent;
  assert.ok(summary.includes("Mensaje"), "Summary mentions Mensaje");
  assert.ok(summary.includes("Oscurecer"), "Summary mentions Oscurecer");
});

test("Connection event compactness: node-only Appearance/Behavior hidden", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  ensureUI(ctx);
  openEventEditor(ctx);
  setWhere(ctx, "connection");
  assert.equal(ctx.document.getElementById("scAppearance").hidden, true, "Appearance hidden for connection");
  assert.equal(ctx.document.getElementById("scBehavior").hidden, true, "Behavior hidden for connection");
  assert.equal(ctx.document.getElementById("scMotion").hidden, false, "Motion visible for connection");
});



/* ─────────── Event Identity + Message Styling (un Evento = un símbolo) ─────────── */

const RECIBIR_PAGO = `{
  name: "Recibir pago", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe un pago", visual: { value: "📦" },
  presentation: { nodeEffects: { showSymbol: true, message: "Pago recibido", messageSize: "large", messageWeight: "semibold", messagePosition: "above" } }
}`;

test("Identidad: un solo selector de símbolo; Appearance no tiene picker propio", () => {
  const html = read("index.html");
  assert.equal((html.match(/id="scVisualPicker"/g) || []).length, 1);
  assert.ok(!html.includes("scEffectIconPicker"), "no segundo picker de iconos");
  const cfg = html.slice(html.indexOf('id="scShowSymbolConfig"'), html.indexOf('id="scMessageConfig"'));
  assert.ok(cfg.includes("scSymbolUse") && !/<button[^>]*>\s*[⚠✓❗🔒🎉]/u.test(cfg));
  assert.ok(html.includes("Símbolo del evento") || read("js/editor-scenarios.js").includes("Símbolo del evento"));
  assert.ok(!read("js/editor-scenarios.js").includes("¿Qué aparece?"));
});

test("Phrase builder determinista: nunca concatena marcadores ni nombre implícito", () => {
  const { ctx } = makeScenarioUIContext();
  const r = (tpl, src, tgt) => ctx.run(`renderEventSentence({sentenceTemplate:${JSON.stringify(tpl)}, name:"Recibir pago"}, ${JSON.stringify(src)}, ${JSON.stringify(tgt)})`);
  assert.equal(r("{target} cambia", null, "Nodo"), "Nodo cambia");
  assert.equal(r("{target} recibe un pago", null, "Nodo"), "Nodo recibe un pago");
  assert.equal(r("{target} cambia a {name}", null, "Nodo"), "Nodo cambia a Recibir pago");
  assert.equal(r("{target}{name}", null, "Nodo"), "Nodo Recibir pago");
  assert.equal(r("{target}recibe un pago", null, "Nodo"), "Nodo recibe un pago");
  assert.equal(r("{target}, listo", null, "Nodo"), "Nodo, listo");
  assert.ok(!/NodoRECIBIR|NodoRecibir/.test(r("{target}{name}", null, "Nodo")));
});

test("nodeEffects: defaults, presets y compatibilidad showIcon→showSymbol", () => {
  const { ctx } = makeScenarioUIContext();
  const d = json(ctx.run(`normalizeNodeEffects({showIcon:true, message:"Hola"})`));
  assert.equal(d.showSymbol, true);
  assert.equal(d.messageSize, "medium"); assert.equal(d.messageWeight, "normal");
  assert.equal(d.messageFont, "default"); assert.equal(d.messagePosition, "above");
  const v = json(ctx.run(`normalizeNodeEffects({messageSize:"huge", messageWeight:"900", messageFont:"Comic", messagePosition:"left"})`));
  assert.equal(v.messageSize, "medium"); assert.equal(v.messageWeight, "normal"); assert.equal(v.messageFont, "default"); assert.equal(v.messagePosition, "above");
  const st = json(ctx.run(`nodeMessageStyle({messageSize:"large", messageWeight:"bold", messageFont:"mono", messagePosition:"below"})`));
  assert.ok(st.px > json(ctx.run(`nodeMessageStyle({messageSize:"small"})`)).px);
  assert.equal(st.weight, "700"); assert.equal(st.position, "below");
});

test("Icono secundario legado no se pierde: se eleva a símbolo principal al normalizar", () => {
  const { ctx } = makeScenarioUIContext();
  const et = json(ctx.run(`(() => { const e={visual:{kind:"token",value:"●"}, presentation:{nodeEffects:{showIcon:true, icon:"📦"}}}; normalizeEventTypePresentation(e); return e; })()`));
  assert.equal(et.visual.value, "📦");
  assert.equal(et.presentation.nodeEffects.showSymbol, true);
  assert.equal("icon" in et.presentation.nodeEffects, false);
  const off = json(ctx.run(`(() => { const e={visual:{kind:"token",value:"●"}, presentation:{nodeEffects:{showIcon:false, icon:"📦"}}}; normalizeEventTypePresentation(e); return e; })()`));
  assert.equal(off.visual.value, "●", "sin símbolo visible no se reescribe la identidad");
});

test("Historia: símbolo + nombre primario; frase secundaria sin concatenar; dedupe normalizado", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx, { source: "Cliente", target: "Nodo" });
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et = createEventType(${RECIBIR_PAGO});
    scApplyTargets(et.id, [nodeId]);
    const same = createEventType({name:"Aprobación", primitive:"OCCURRENCE", sentenceTemplate:"aprobación", visual:{value:"✓"}});
    scApplyTargets(same.id, [nodeId]);
    scRenderStoryboard();
  `);
  const rows = ctx.document.querySelectorAll(".scStoryRow");
  assert.equal(rows[0].querySelector(".scStepPrimary").textContent, "📦 Recibir pago");
  assert.equal(rows[0].querySelector(".scStepSecondary").textContent, "Nodo recibe un pago");
  assert.equal(rows[1].querySelector(".scStepSecondary"), null, "frase idéntica al nombre no se repite");
});

test("Símbolo único: cambiar 📦→💵 llega a biblioteca, Historia y metadata de Playback sin tocar Steps", () => {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx, { source: "Cliente", target: "Nodo" });
  setupPanel(ctx, register);
  ensureUI(ctx);
  ctx.run(`
    scNewScenario();
    const et = createEventType(${RECIBIR_PAGO});
    etId = et.id;
    scApplyTargets(et.id, [nodeId]);
    stepsBefore = JSON.stringify(scActiveScenario().steps);
  `);
  assert.equal(ctx.run("eventSymbol(eventTypeById(etId))"), "📦");
  assert.equal(ctx.run("scPlaybackEffects(eventTypeById(etId)).symbol"), undefined, "symbol no se duplica en efectos");
  ctx.run(`updateEventType(etId, {visual:{value:"💵"}}); scStorySignature=""; scRenderStoryboard(); scRenderEventLibrary();`);
  assert.equal(ctx.document.querySelectorAll(".scStoryRow")[0].querySelector(".scStepPrimary").textContent, "💵 Recibir pago");
  assert.equal(ctx.run("eventSymbol(eventTypeById(etId))"), "💵");
  assert.equal(ctx.run("JSON.stringify(scActiveScenario().steps)"), ctx.run("stepsBefore"));
});

test("Presentación ≠ semántica: estilo de mensaje/símbolo no cambia el Trace", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx, { source: "Cliente", target: "Nodo" });
  ctx.run(`
    const et = createEventType(${RECIBIR_PAGO});
    const sc = createScenario(P(), "S");
    createStep(sc, {at:0, action:"OCCURRENCE", nodeId:nodeId, eventTypeId:et.id});
    run = () => JSON.stringify(FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc).trace);
    t1 = run();
    updateEventType(et.id, {visual:{value:"💵"}, presentation:{nodeEffects:{showSymbol:false, message:"Otro", messageSize:"small", messageWeight:"bold", messageFont:"mono", messagePosition:"below"}}});
    t2 = run();
  `);
  assert.equal(ctx.run("t1"), ctx.run("t2"));
});

test("Paridad preview/Playback: misma metadata visual desde nodeEffectsVisualSpec", () => {
  const { ctx } = makeScenarioUIContext();
  ctx.run(`
    def = ${RECIBIR_PAGO};
    et = { visual:{value:def.visual.value}, presentation:def.presentation };
    previewSpec = nodeEffectsVisualSpec(et);
    pb = scPlaybackEffects(et);
  `);
  const spec = json(ctx.run("previewSpec")), pb = json(ctx.run("pb"));
  const { symbol, ...rest } = spec;
  assert.equal(symbol, "📦");
  assert.deepEqual(rest, pb);
  assert.equal(pb.messageSize, "large"); assert.equal(pb.messageWeight, "semibold"); assert.equal(pb.messagePosition, "above");
});

test("Evento legado con mensaje sin estilos renderiza con defaults válidos", () => {
  const { ctx } = makeScenarioUIContext();
  const fx = json(ctx.run(`scPlaybackEffects({visual:{value:"⚠"}, presentation:{nodeEffects:{showIcon:true, message:"Fuera de servicio"}}})`));
  assert.deepEqual([fx.messageSize, fx.messageWeight, fx.messageFont, fx.messagePosition], ["medium", "normal", "default", "above"]);
  assert.equal(fx.showSymbol, true);
});

/* ─────────── Layout del modal de Evento: header / body scrollable / footer ─────────── */

test("Modal de Evento: header, body scrollable y footer independientes; Comportamiento dentro del body", () => {
  const html = read("index.html"), css = read("css/styles.css");
  const dlg = html.slice(html.indexOf('<dialog id="scEventDialog"'), html.indexOf("</dialog>", html.indexOf('<dialog id="scEventDialog"')));
  const bodyStart = dlg.indexOf('<div class="scDialogBody">'), footerStart = dlg.indexOf("<footer>");
  assert.ok(dlg.indexOf("<header>") >= 0 && dlg.indexOf("<header>") < bodyStart && bodyStart < footerStart, "orden header/body/footer");
  for (const id of ['id="scAppearance"', 'id="scBehavior"', 'id="scEventError"'])
    assert.ok(dlg.indexOf(id) > bodyStart && dlg.indexOf(id) < footerStart, id + " dentro del body");
  assert.ok(!dlg.slice(footerStart).includes("scBehavior"), "el footer no contiene contenido dinámico");
  // El body es el único scroller; el dialog no scrollea (evita que el foco de un input oculto lo desplace).
  assert.match(css, /\.scDialog\[open\]\{[^}]*overflow:hidden/);
  assert.match(css, /\.scDialogBody\{[^}]*position:relative[^}]*overflow:auto[^}]*min-height:0/);
});

/* ─────────── Auto-crear Scenario al aplicar un Evento válido ─────────── */

function autoSetup() {
  const { ctx, register } = makeScenarioUIContext();
  const ids = buildExample(ctx, { source: "Cliente", target: "Comercio" });
  setupPanel(ctx, register);
  for (const id of ["scPlacementText", "scPlacementConfirm"]) register(id, ctx.document.createElement("div"));
  ensureUI(ctx);
  ctx.run(`
    flowEt = createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    nodeEt = createEventType(${RECIBIR_PAGO});
    scActiveId = null;
  `);
  return ctx;
}
const scCount = (ctx) => ctx.run("P().scenarios.length");
const stepCount = (ctx) => ctx.run("P().scenarios.reduce((n,s)=>n+s.steps.length,0)");

test("Auto-crear: aplicar FLOW válido sin Scenario crea Escenario 1 + Step, activo, y Historia lo muestra", () => {
  const ctx = autoSetup();
  assert.equal(scCount(ctx), 0);
  ctx.run("scApplyTargets(flowEt.id,[edgeId])");
  assert.equal(scCount(ctx), 1);
  assert.equal(stepCount(ctx), 1);
  assert.equal(ctx.run("P().scenarios[0].name"), "Escenario 1");
  assert.equal(ctx.run("scActiveScenario().id === P().scenarios[0].id"), true);
  assert.equal(ctx.run("P().scenarios[0].engineVersion"), ctx.run("FluyoScenarios.ENGINE_VERSION"));
  assert.equal(ctx.document.querySelectorAll(".scStoryRow").length, 1);
});

test("Auto-crear: Evento de nodo y click-to-place producen el mismo resultado", () => {
  const ctx = autoSetup();
  ctx.run("scApplyTargets(nodeEt.id,[nodeId])");
  assert.equal(scCount(ctx), 1); assert.equal(stepCount(ctx), 1);
  const ctx2 = autoSetup();
  ctx2.run("scBeginPlacement(flowEt.id); scUseTarget(edgeId,false);");
  assert.equal(scCount(ctx2), 1); assert.equal(stepCount(ctx2), 1);
  assert.equal(ctx2.run("P().scenarios[0].steps[0].eventTypeId === flowEt.id"), true);
});

test("Auto-crear: empezar/cancelar colocación, drop vacío e incompatible no crean Scenario ni tocan el documento", () => {
  const ctx = autoSetup();
  const before = ctx.run("JSON.stringify(doc)");
  ctx.run("scBeginPlacement(flowEt.id)");
  assert.equal(scCount(ctx), 0, "iniciar drag no crea");
  ctx.run("scCancelPlacement()");
  assert.equal(ctx.run("JSON.stringify(doc)"), before);
  ctx.run("hitNode=()=>null; scEdgeCandidates=()=>[]; scBeginPlacement(flowEt.id); scResolveDrop(flowEt.id, 9999, 9999);");
  assert.equal(scCount(ctx), 0, "drop vacío");
  ctx.run("scApplyTargets(flowEt.id,[nodeId])");
  assert.equal(scCount(ctx), 0, "FLOW sobre nodo no crea");
  ctx.run("scApplyTargets(nodeEt.id,[edgeId])");
  assert.equal(scCount(ctx), 0, "evento de nodo sobre conexión no crea");
  assert.equal(ctx.run("JSON.stringify(doc)"), before);
});

test("Auto-crear: un solo undo quita Scenario y Step; redo los restaura una vez; IDs estables", () => {
  const ctx = autoSetup();
  const structure = ctx.run("JSON.stringify([P().nodes,P().edges,doc.eventTypes])");
  ctx.run("scApplyTargets(flowEt.id,[edgeId]); first=P().scenarios[0].id;");
  ctx.run("undo()");
  assert.equal(scCount(ctx), 0); assert.equal(stepCount(ctx), 0);
  assert.equal(ctx.run("JSON.stringify([P().nodes,P().edges,doc.eventTypes])"), structure);
  ctx.run("redo()");
  assert.equal(scCount(ctx), 1); assert.equal(stepCount(ctx), 1);
  assert.equal(ctx.run("P().scenarios[0].id === first"), true);
  ctx.run("undo(); scApplyTargets(flowEt.id,[edgeId]);");
  assert.equal(scCount(ctx), 1); assert.equal(stepCount(ctx), 1);
  assert.equal(ctx.run("P().scenarios[0].steps[0].id >= 1 && P().nextScenarioId > P().scenarios[0].id"), true);
});

test("Auto-crear: con Scenario activo no se crea otro; multi-target crea un solo Scenario con un mismo momento", () => {
  const ctx = autoSetup();
  ctx.run("scApplyTargets(flowEt.id,[edgeId]); scApplyTargets(flowEt.id,[edgeId]);");
  assert.equal(scCount(ctx), 1); assert.equal(stepCount(ctx), 2);
  const ctx2 = autoSetup();
  ctx2.run(`
    const C={id:P().nextId++, shape:"rect", x:400, y:0, label:"C"}; P().nodes.push(C);
    e2=P().edges.push({id:P().nextId++, from:nodeId, to:C.id}); e3=P().edges.push({id:P().nextId++, from:sourceId, to:C.id});
    scApplyTargets(flowEt.id, P().edges.map(e=>e.id));
  `);
  assert.equal(scCount(ctx2), 1); assert.equal(stepCount(ctx2), 3);
  assert.equal(ctx2.run("new Set(P().scenarios[0].steps.map(s=>s.at)).size"), 1);
  assert.equal(ctx2.run("undo(), P().scenarios.length"), 0);
});

test("Auto-crear: Scenario no soportado activo no se oculta creando otro", () => {
  const ctx = autoSetup();
  ctx.run("const sc=createScenario(P(),'Futuro'); sc.engineVersion=99; scActiveId=sc.id;");
  ctx.run("scApplyTargets(flowEt.id,[edgeId])");
  assert.equal(scCount(ctx), 1); assert.equal(stepCount(ctx), 0);
});

/* ─────────── FLUYO-012: Historia manipulable (capa UI sobre la semántica compartida) ─────────── */

function story012(ctx) {
  ctx.run(`
    pushCount = 0; pushUndo = () => { pushCount++; };
    const et = createEventType({name:"Recibir",primitive:"OCCURRENCE",sentenceTemplate:"{target} recibe",visual:{value:"📦"}});
    sc = createScenario(P(), "S"); scActiveId = sc.id;
    mk = (at) => createStep(sc, {at, action:"OCCURRENCE", nodeId:nodeId, eventTypeId:et.id});
    a = mk(0); b = mk(1000); c = mk(5000);
    order = () => sc.steps.map(s => s.id + "@" + s.at).join(" ");
  `);
}

test("FLUYO-012: drag = una operación de undo, semántica de Mover antes, selección intacta", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  story012(ctx);
  const ids = ctx.run("[a.id,b.id,c.id].join(',')").split(",").map(Number);
  ctx.run("scSelectedStep = 12345");
  assert.equal(ctx.run(`scMoveStepTo(${ids[2]}, {kind:"gap", index:1})`), true);
  assert.equal(ctx.run("pushCount"), 1);
  assert.equal(ctx.run("order()"), `${ids[0]}@0 ${ids[2]}@1000 ${ids[1]}@5000`);
  assert.equal(ctx.run("scSelectedStep"), 12345);
  // equivale a Mover antes aplicado al estado original
  ctx.run("sc.steps = [a,b,c].map(s=>({...s, at:s.at}));");
  ctx.run(`sc.steps = [{...a,at:0},{...b,at:1000},{...c,at:5000}]`);
  ctx.run(`pushCount=0; scMoveStep(${ids[2]}, -1)`);
  assert.equal(ctx.run("order()"), `${ids[0]}@0 ${ids[2]}@1000 ${ids[1]}@5000`);
  assert.equal(ctx.run("pushCount"), 1);
});

test("FLUYO-012: drop sin cambios o inválido no crea undo ni toca el documento", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  story012(ctx);
  const before = ctx.run("JSON.stringify(sc)");
  const b = ctx.run("b.id");
  assert.equal(ctx.run(`scMoveStepTo(${b}, {kind:"gap", index:1})`), false);   // hueco adyacente
  assert.equal(ctx.run(`scMoveStepTo(${b}, {kind:"join", anchorId:${b}, after:true})`), false);
  assert.equal(ctx.run(`scMoveStepTo(9999, {kind:"gap", index:0})`), false);
  assert.equal(ctx.run("pushCount"), 0);
  assert.equal(ctx.run("JSON.stringify(sc)"), before);
});

test("FLUYO-012: cancelar un arrastre activo (scStoryDragCleanup) deja documento y undo intactos", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  story012(ctx);
  const before = ctx.run("JSON.stringify(sc)");
  ctx.run(`
    handle = document.createElement("button"); handle.setPointerCapture = () => {}; handle.releasePointerCapture = () => {};
    row = document.createElement("div");
    scStoryDrag = { id: a.id, pointerId: 1, x: 0, y: 0, active: true, ghost: Object.assign(document.createElement("div"), {remove(){}}), line: Object.assign(document.createElement("div"), {remove(){}}), target: {kind:"gap", index:3}, row, handle };
    scStoryDragCancel();
  `);
  assert.equal(ctx.run("scStoryDrag"), null);
  assert.equal(ctx.run("JSON.stringify(sc)"), before);
  assert.equal(ctx.run("pushCount"), 0);
});

test("FLUYO-012: durante Playback no se reordena (scMoveStepTo / scMoveStep / inicio de drag)", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  story012(ctx);
  ctx.run(`scStatus = "running"`);
  const before = ctx.run("JSON.stringify(sc)");
  assert.equal(ctx.run(`scMoveStepTo(c.id, {kind:"gap", index:0})`), false);
  assert.equal(ctx.run(`scMoveStep(c.id, -1)`), false);
  ctx.run(`scStoryDragStart({pointerType:"mouse", button:0, pointerId:1, clientX:0, clientY:0, preventDefault(){}}, c, document.createElement("div"), document.createElement("button"))`);
  assert.equal(ctx.run("scStoryDrag"), null);
  assert.equal(ctx.run("JSON.stringify(sc)"), before);
  assert.equal(ctx.run("pushCount"), 0);
});

test("FLUYO-012: soltar dentro de un momento conserva el at y las filas vacías desaparecen de Historia", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  story012(ctx);
  ctx.run(`scMoveStepTo(c.id, {kind:"join", anchorId:a.id, after:true})`);
  assert.equal(ctx.run("scGroups().length"), 2);
  assert.equal(ctx.run("scGroups()[0].steps.map(s=>s.id).join()"), ctx.run("[a.id,c.id].join()"));
  assert.equal(ctx.run("sc.steps.every(s => s.id === a.id || s.id === c.id ? s.at === 0 : s.at === 1000)"), true);
});

test("FLUYO-012: Historia sigue ofreciendo Mover antes/después (alternativa accesible) y handle con teclado", () => {
  const src = read("js/editor-scenarios.js");
  assert.ok(src.includes('label: "Mover"') && src.includes('label: "Antes"') && src.includes('label: "Después"'));
  assert.ok(src.includes("Alt y las flechas"));
  assert.ok(src.includes("scStoryDragCleanup") && src.includes("pointercancel"));
  const row = src.slice(src.indexOf("function scStoryRow"), src.indexOf("function scNormText"));
  assert.ok(/!isScenarioPlaybackActive\(\)[^]*scHandle/.test(row), "el handle no existe durante Playback");
});

test("FLUYO-012.1: Duplicar crea la copia en el mismo momento, sin inventar espera ni desplazar nada, y es un único undo", () => {
  const { ctx } = makeScenarioUIContext();
  buildExample(ctx);
  story012(ctx);
  ctx.run("pushCount = 0; scDuplicateStep(a.id)");
  assert.equal(ctx.run("pushCount"), 1);
  assert.equal(ctx.run("sc.steps.length"), 4);
  // a@0, copia@0 (al mismo tiempo), b@1000, c@5000: ni espera inventada ni desplazamiento
  assert.equal(ctx.run("scOrderedSteps().map(s => s.at).join()"), "0,0,1000,5000");
  assert.equal(ctx.run("scOrderedSteps()[1].eventTypeId === a.eventTypeId && scOrderedSteps()[1].nodeId === a.nodeId"), true);
});
