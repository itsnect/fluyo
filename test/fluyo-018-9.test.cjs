"use strict";
/* FLUYO-018.9 — campos de `code` al crear un nodo (createNodeIn, model.js).

   Antes de 018.9, createNodeIn completaba los campos de `code` con
     if(shape==="code" && !("lang" in n)) Object.assign(n,{lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null});
   DESPUÉS de copiar el spec: sin `lang`, el Object.assign PISABA keywords/kwBg/kwColor del spec con null (se perdían en silencio);
   con `lang`, no completaba nada y kwBg/kwColor/keywords no pedidos quedaban AUSENTES. Lo sufrían create_node de author_document y,
   desde 018.9, create_diagram. Este archivo FALLA sobre ese código.

   Representación canónica = la del editor: newNode("code",x,y) (state.js → createNodeIn sin campos de code) deja, tras `order`,
   lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null (null = el preset / el color del tema); el panel solo cambia valores
   (editNode → updateNodeIn), nunca el orden ni la presencia de las claves. Crear con esos campos debe dar el MISMO registro, byte a
   byte, que crear en el editor y luego editarlos. Kernel real (FluyoAuthoring) y editor real (state.js) en `vm`. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.parse(JSON.stringify(v));
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
function kernel() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__in = JSON.stringify(arg === undefined ? null : arg); return JSON.parse(vm.runInContext(`JSON.stringify((function(){ const __a = JSON.parse(__in); return (${expr}); })())`, ctx)); };
  return ctx;
}
/* El editor real: model.js + state.js (newNode, editNode) sin DOM. */
function editor() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, scheduleAutosave() {}, renderTabs() {}, refreshPanel() {}, selN: new Set(), selE: new Set(), clip: null, GRID: 20 });
  ctx.run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js"]) ctx.run(read("js/" + f));
  ctx.run(read("js/state.js").split("/* ===================== Viewport")[0]);
  return ctx;
}

const K = kernel();
const DEFAULT_LANG = K.call("DEFAULT_LANG");
const blank = () => K.call("serializeProject()");
const create = (spec) => {
  const r = K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p: blank(), o: [{ op: "create_node", scope: "page", pageIndex: 0, spec: Object.assign({ shape: "code", x: 0, y: 0 }, spec) }] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.project.doc.pages[0].nodes[0];
};
/* El mismo nodo hecho en el editor: crear (lo que hace un clic con la herramienta `code`) y luego editar en el panel. */
function inEditor(patch) {
  const E = editor();
  E.run("var __n=newNode('code',0,0);");
  if (Object.keys(patch).length) assert.notEqual(E.run(`editNode(__n, ${JSON.stringify(patch)})`), null, "el editor acepta el parche");
  return J(E.run("__n"));
}
const CODE_KEYS = ["lang", "keywords", "kwBg", "kwColor"];
const tail = (n) => Object.keys(n).slice(-4);

const CASES = [
  ["keywords sin lang", { keywords: ["cat", "grep"] }, { lang: DEFAULT_LANG, keywords: ["cat", "grep"], kwBg: null, kwColor: null }],
  ["keywords con lang", { lang: "none", keywords: ["SELECT"] }, { lang: "none", keywords: ["SELECT"], kwBg: null, kwColor: null }],
  ["kwBg/kwColor sin lang", { kwBg: "#c9b458", kwColor: "#161410" }, { lang: DEFAULT_LANG, keywords: null, kwBg: "#c9b458", kwColor: "#161410" }],
  ["kwBg/kwColor con lang", { lang: "sql", kwBg: "#c9b458", kwColor: "#161410" }, { lang: "sql", keywords: null, kwBg: "#c9b458", kwColor: "#161410" }],
  ["solo kwColor", { kwColor: "#161410" }, { lang: DEFAULT_LANG, keywords: null, kwBg: null, kwColor: "#161410" }],
  ["los cuatro, en otro orden", { kwColor: "#000", keywords: ["a"], kwBg: "#fff", lang: "none" }, { lang: "none", keywords: ["a"], kwBg: "#fff", kwColor: "#000" }],
  ["ninguno (como el editor)", {}, { lang: DEFAULT_LANG, keywords: null, kwBg: null, kwColor: null }],
];

for (const [name, spec, want] of CASES) {
  test(`createNodeIn · code · ${name}: no pierde lo pedido y completa el resto con los defaults del editor`, () => {
    const n = create(spec);
    assert.deepEqual(Object.fromEntries(CODE_KEYS.map(k => [k, n[k]])), want);
    assert.deepEqual(tail(n), CODE_KEYS, "las cuatro claves, en el orden del editor, tras `order`");
  });
  test(`paridad con el editor · code · ${name}: crear con los campos = crear en el editor y editarlos (byte a byte)`, () => {
    assert.equal(JSON.stringify(create(spec)), JSON.stringify(inEditor(spec)));
  });
}

test("los campos de code siguen sin aparecer en otras formas", () => {
  for (const shape of ["rect", "text", "cylinder"]) {
    const n = create({ shape });
    for (const k of CODE_KEYS) assert.equal(k in n, false, `${shape}: ${k}`);
  }
});

test("keywords no texto y lang desconocido se rechazan (antes, sin lang, se descartaban en silencio)", () => {
  for (const spec of [{ keywords: [1] }, { keywords: "SELECT" }, { lang: "cobol" }]) {
    const r = K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p: blank(), o: [{ op: "create_node", scope: "page", pageIndex: 0, spec: Object.assign({ shape: "code", x: 0, y: 0 }, spec) }] });
    assert.equal(r.ok, false, JSON.stringify(spec));
    assert.equal(r.errors[0].code, "INVALID_FIELD");
  }
});

test("null explícito = el default del editor (lang null → preset por defecto; el resto, null)", () => {
  assert.deepEqual(Object.fromEntries(CODE_KEYS.map(k => [k, create({ lang: null, keywords: null, kwBg: null, kwColor: null })[k]])), { lang: DEFAULT_LANG, keywords: null, kwBg: null, kwColor: null });
});

test("el editor sigue creando el mismo nodo code que antes (sin campos en el spec)", () => {
  const n = inEditor({});
  assert.deepEqual(Object.keys(n), ["id", "shape", "x", "y", "w", "h", "label", "color", "fill", "border", "lblPos", "textBg", "textColor", "font", "bold", "pulse", "order", ...CODE_KEYS]);
  assert.equal(n.label, K.call("CODE_DEFAULT_LABEL"));
});

test("la regla vive solo en el dominio: createNodeIn ya no completa los campos de code DESPUÉS del spec", () => {
  const body = read("js/model.js").split("function createNodeIn")[1].split("function createConnectionIn")[0];
  assert.doesNotMatch(body, /Object\.assign\(n,\s*\{\s*lang/);
});
