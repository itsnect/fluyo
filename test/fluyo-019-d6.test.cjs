"use strict";
/* FLUYO-019-HIT-TEST-D6 — Capas de pintado con la piel «construido». Contratos en vm (sin navegador) y estáticos; lo que solo
   existe al pintar (visibilidad real, Present, Viewer, PNG, SVG, flujo, tokens) lo mide test/fluyo-019-d6-browser.cjs.
   · containmentPaintOrder(nodes, order) (geometry.js) cumple el contrato compartido test/fixtures/fluyo-019-d6-capas.json:
     contenedores en recorrido en profundidad de fuera adentro, hermanos con el orden de pintor de la piel; hojas con ese orden.
   · Sin contenedores (los 8 ejemplos y todas las páginas de los fixtures): containers = [] y leaves = skinPaintOrder(nodes).
   · Pura y determinista.
   · render.js: las dos ramas pintan contenedores → conexiones → flujo → hojas, y las capas solo existen con rs.skinOn
     (en plano: containers = [] y leaves = P().nodes, el orden de siempre). export.js igual con skinOn.
   · Alcance frente a ce8e699: solo geometry.js (+ containmentPaintOrder), render.js, export.js y sw.js (CACHE v91); skin.js,
     model.js, interaction.js, viewer.js, Share e index idénticos. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "ce8e699";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };
const { undo4a } = require("./fluyo-019-4a-undo.cjs");   /* FLUYO-019.4a cambia a propósito skin.js, render.js y export.js: se deshace aquí; su alcance lo vigila test/fluyo-019-4a.test.cjs */
const { undo4b } = require("./fluyo-019-4b-undo.cjs");   /* FLUYO-019.4b cambia a propósito render.js, interaction.js, geometry.js, editor-runtime.js, state.js e index.html: se deshace aquí (antes que 019.4a y FASE 1); su alcance lo vigila test/fluyo-019-4b.test.cjs */
const { undo3: undo3only } = require("./fluyo-scenarios-semantics-3-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 3 cambia a propósito model.js, document-integrity.js, story-authoring.js, flow-semantics.js, editor-scenarios.js, index.html, styles.css y sw.js (precache): se deshace aquí, antes que todo lo demás; su alcance lo vigila test/fluyo-scenarios-semantics-3.test.cjs */
const { undoReverse } = require("./fluyo-step-reverse-002-undo.cjs");   /* FLUYO-STEP-REVERSE-002 cambia a propósito model.js, scenario-engine.js, story-playback.js, scenario-playback.js, story-authoring.js, document-integrity.js, render.js, editor-scenarios.js y selection.js: se deshace aquí, antes que FASE 3; su alcance lo vigila test/fluyo-step-reverse-002.test.cjs */
const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* FLUYO-STEP-REVERSE-003 añade «Invertir sentido» a editor-scenarios.js: se deshace aquí, antes que 002; su alcance lo vigila test/fluyo-step-reverse-003.test.cjs */
const { undo4 } = require("./fluyo-scenarios-semantics-4-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima de STEP-REVERSE-003: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-4.test.cjs */
const undo3 = (f, src) => undo3only(f, undoReverse(f, undoReverseUi(f, undo4(f, src))));
const { undoSemantics } = require("./fluyo-scenarios-semantics-undo.cjs");   /* SCENARIOS-SEMANTICS-001 (FASE 1) cambia a propósito model.js, geometry.js, render.js, ui.js, index.html y styles.css: se deshace aquí; su alcance lo vigila test/fluyo-scenarios-semantics-1.test.cjs */
const J = (v) => JSON.parse(JSON.stringify(v));

const G = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
for (const f of ["config.js", "safe-svg.js", "model.js", "geometry.js", "skin.js"]) vm.runInContext(read("js/" + f), G, { filename: f });
const run = (code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const layers = (nodes) => run("(()=>{ const r=containmentPaintOrder(__a, skinPaintOrder); return {containers:r.containers.map(n=>n.id), leaves:r.leaves.map(n=>n.id)}; })()", nodes);
const FIX = JSON.parse(read("test/fixtures/fluyo-019-d6-capas.json"));

/* ───────── contrato compartido ───────── */
for (const c of FIX.cases) {
  test("contrato · " + c.name, () => {
    assert.deepEqual(layers(c.nodes), { containers: c.containers, leaves: c.leaves });
  });
}
test("contrato · cada nodo sale exactamente una vez; los contenedores son los de isContainerNode (D1)", () => {
  for (const c of FIX.cases) {
    const r = layers(c.nodes);
    assert.deepEqual([...r.containers, ...r.leaves].sort((a, b) => a - b), c.nodes.map((n) => n.id).sort((a, b) => a - b), c.name);
    assert.deepEqual(r.containers.slice().sort((a, b) => a - b), run("__a.filter(n=>isContainerNode(n,__a)).map(n=>n.id)", c.nodes).sort((a, b) => a - b), c.name);
  }
});
test("contrato · un contenedor anidado se pinta después de su padre, sea cual sea su y", () => {
  const D = FIX.cases.find((c) => c.name.startsWith("D ")).nodes;
  assert.ok(D.find((n) => n.id === 1).y < D.find((n) => n.id === 7).y, "el fixture pone el GCP interior por encima del centro de Región");
  assert.deepEqual(run("skinPaintOrder(__a.filter(n=>isContainerNode(n,__a))).map(n=>n.id)", D), [1, 7], "el pintor por y los invertiría");
  assert.deepEqual(layers(D).containers, [7, 1]);
});

/* ───────── sin contenedores: el orden de hoy ───────── */
test("sin contenedores (8 ejemplos y todas las páginas de los fixtures): containers = [] y leaves = skinPaintOrder(nodes)", () => {
  const docs = [];
  for (const f of fs.readdirSync(path.join(root, "ejemplos", "data"))) docs.push(["ejemplos/data/" + f, JSON.parse(read("ejemplos/data/" + f))]);
  for (const f of fs.readdirSync(path.join(root, "test", "fixtures")).filter((f) => f.endsWith(".json") && f !== "fluyo-019-d6-capas.json")) {
    try { docs.push(["test/fixtures/" + f, JSON.parse(read("test/fixtures/" + f))]); } catch {}
  }
  let pages = 0;
  for (const [name, d] of docs) {
    const found = []; (function walk(o) { if (!o || typeof o !== "object") return; if (Array.isArray(o.nodes) && o.nodes.length && o.nodes.every((n) => n && typeof n.x === "number" && typeof n.w === "number")) found.push(o.nodes); for (const k in o) walk(o[k]); })(d);
    for (const nodes of found) {
      if (run("__a.some(n=>isContainerNode(n,__a))", nodes)) continue;
      pages++;
      assert.deepEqual(layers(nodes), { containers: [], leaves: run("skinPaintOrder(__a).map(n=>n.id)", nodes) }, name);
    }
  }
  assert.ok(pages >= 15, "páginas sin contenedores comparadas: " + pages);
});

/* ───────── pureza y determinismo ───────── */
test("pura: no muta los nodos ni su orden; determinista; empates por orden del documento", () => {
  const c = FIX.cases.find((x) => x.name.startsWith("N "));
  const r = run("(()=>{ const a=JSON.parse(JSON.stringify(__a)), before=JSON.stringify(a); const x=containmentPaintOrder(a, skinPaintOrder), y=containmentPaintOrder(a, skinPaintOrder); return { same: JSON.stringify(a)===before, det: JSON.stringify(x)===JSON.stringify(y), ids: x.containers.map(n=>n.id).concat(x.leaves.map(n=>n.id)) }; })()", c.nodes);
  assert.ok(r.same && r.det);
  const tie = [{ id: 1, shape: "rect", x: 0, y: 0, w: 50, h: 50 }, { id: 2, shape: "rect", x: 0, y: 0, w: 50, h: 50 }, { id: 3, shape: "rect", x: 0, y: 0, w: 50, h: 50 }];
  assert.deepEqual(layers(tie).leaves, [1, 2, 3], "tres hojas con la misma y y la misma x: orden del documento");
  assert.deepEqual(layers(tie.slice().reverse()).leaves, [3, 2, 1]);
  assert.match(between(read("js/geometry.js"), "function containmentPaintOrder(", "\n}\n"), /isContainerNode\(n,nodes\)/, "misma definición de contenedor que el acierto (D1)");
  assert.ok(!/skinPaintOrder|document\.|window\./.test(between(read("js/geometry.js"), "function containmentPaintOrder(", "\n}\n")), "no depende de skin.js ni del DOM: el orden llega como argumento");
});

/* ───────── pintores (estáticos) ───────── */
test("render.js: las dos ramas pintan contenedores → conexiones → flujo → hojas; las capas solo existen con la piel", () => {
  const r = undoSemantics("js/render.js", undo4a("js/render.js", undo4b("js/render.js", undo3("js/render.js", read("js/render.js")))));
  const fn = between(r, "function render(c,t,opts={}){", "\n}\n");
  /* FLUYO-019.4b: la regla vive ahora en nodePaintLayers (la comparten render() y el acierto); se mira en el árbol tal cual */
  const cur = read("js/render.js");
  assert.match(cur, /function nodePaintLayers\(nodes, skinOn\)\{\n  return skinOn \? containmentPaintOrder\(nodes, skinPaintOrder\) : \{containers:\[\], leaves:nodes\};\n\}/);
  assert.match(between(cur, "function render(c,t,opts={}){", "\n}\n"), /const paintLayers=\(\)=> nodePaintLayers\(P\(\)\.nodes, rs\.skinOn\);/);
  assert.match(fn, /const paintLayers=\(\)=> rs\.skinOn \? containmentPaintOrder\(P\(\)\.nodes, skinPaintOrder\) : \{containers:\[\], leaves:P\(\)\.nodes\};/);
  assert.ok(!/nodesInPaintOrder/.test(fn), "sin el orden antiguo");
  const exp = between(fn, "if(isExport){", "\n    return;\n  }");
  assert.match(exp, /const lay=paintLayers\(\);\n    for\(const n of lay\.containers\) drawNode\(c,n,t,theme,isExport,rs\);\n    for\(const e of P\(\)\.edges\) drawEdge\(c,e,t,theme,isExport,rs\);\n    drawFlowBalls\(c,t\);\n    for\(const n of lay\.leaves\) drawNode\(c,n,t,theme,isExport,rs\);/);
  const live = fn.slice(fn.indexOf("refreshEdgeLabels(measureCanvasLabel(c));"));
  assert.match(live, /const lay=paintLayers\(\);\n  for\(const n of lay\.containers\) drawNode\(c,n,t,theme,isExport,rs\);\n  for\(const e of P\(\)\.edges\) drawEdge\(c,e,t,theme,isExport,rs\);\n  if\(!rs\.scenarioRuntime\) drawFlowBalls\(c,t\);\n  for\(const n of lay\.leaves\) drawNode\(c,n,t,theme,isExport,rs\);/);
  /* fuera de las capas, render.js es el de la base */
  const strip = (s) => s.replace(/\n  const nodesInPaintOrder=[^\n]*/, "").replace(/\n  \/\* FLUYO-019-HIT-TEST-D6[\s\S]*?\*\/\n  const paintLayers=[^\n]*/, "")
    .replace(/\n\s*const lay=paintLayers\(\);\n\s*for\(const n of lay\.containers\) drawNode\(c,n,t,theme,isExport,rs\);/g, "")
    .replace(/for\(const n of (nodesInPaintOrder\(\)|lay\.leaves)\)/g, "for(const n of NODES)");
  assert.equal(strip(r), strip(atBase("js/render.js")), "render.js fuera del bucle de pintado: idéntico a la base");
});
test("export.js: buildSVGDocument pinta contenedores → conexiones → hojas con la piel; sin contenedores, el SVG de siempre", () => {
  const e = between(read("js/export.js"), "function buildSVGDocument(", "\n}\n");
  assert.match(e, /const lay=skinOn\? containmentPaintOrder\(page\.nodes\|\|\[\], skinPaintOrder\) : \{containers:\[\], leaves:page\.nodes\|\|\[\]\};/);
  assert.match(e, /if\(contenedores\.length\)\{ if\(defs\) parts\.push\(defs\); parts\.push\(\.\.\.contenedores, \.\.\.conexiones\); \}\n\s*else \{ parts\.push\(\.\.\.conexiones\); if\(defs\) parts\.push\(defs\); \}\n\s*parts\.push\(\.\.\.nodos, "<\/svg>"\);/);
  assert.ok(!/skinPaintOrder\(page\.nodes\|\|\[\]\) : \(page\.nodes/.test(e), "sin el orden antiguo");
});

/* ───────── alcance ───────── */
test("alcance: frente a ce8e699 solo cambian geometry.js (+ containmentPaintOrder), render.js, export.js y sw.js (CACHE)", () => {
  /* FLUYO-019-PRSKIN sube CACHE a v92 (y solo toca css/styles.css): su alcance lo vigila test/fluyo-019-prskin.test.cjs */
  for (const f of ["js/skin.js", "js/model.js", "js/interaction.js", "js/viewer.js", "js/config.js", "js/ui.js", "js/state.js", "js/selection.js", "js/editor-scenarios.js",
    "js/editor-runtime.js", "js/share-url.js", "js/share-loader.js", "js/deeplink.js", "js/link-codec.js", "index.html", "s/index.html"])
    if (fs.existsSync(path.join(root, f))) assert.equal(undoSemantics(f, undo4a(f, undo4b(f, undo3(f, read(f))))), atBase(f), f + " idéntico");
  const g = undoSemantics("js/geometry.js", undo4b("js/geometry.js", undo3("js/geometry.js", read("js/geometry.js")))), added = between(g, "/* FLUYO-019-HIT-TEST-D6", "function containmentPaintOrder(") + between(g, "function containmentPaintOrder(", "\n}\n") + "\n}\n";
  assert.equal(g.replace(added, ""), atBase("js/geometry.js"), "geometry.js: solo se añade containmentPaintOrder");
  const sw = undo3("sw.js", read("sw.js")), cur = +/const CACHE = "fluyo-static-v(\d+)";/.exec(sw)[1];
  assert.ok(cur >= 91, "CACHE ≥ v91");
  /* la de ce8e699 (v90) se construye sin literal: fluyo-019-1 vigila que ningún test fuera de las mutaciones nombre la anterior */
  assert.equal(sw.replace('"fluyo-static-v' + cur + '"', '"fluyo-static-v' + 90 + '"'), atBase("sw.js"), "sw.js: solo cambia CACHE");
});

/* ───────── contrato compartido con fluyo-mcp ───────── */
/* FLUYO-019-MCP-PARITY portó D6 al MCP (fase 2): con fluyo-mcp al lado, los dos fixtures tienen que estar allí, idénticos */
test("fixtures compartidos con fluyo-mcp (si está al lado): mismos bytes", () => {
  const mcp = path.resolve(root, "..", "fluyo-mcp", "test", "fixtures");
  for (const f of ["fluyo-019-d6-capas.json", "fluyo-019-d6-capas-svg.json"]) {
    assert.ok(fs.existsSync(path.join(root, "test", "fixtures", f)), "falta " + f);
    const other = path.join(mcp, f);
    if (!fs.existsSync(mcp)) continue;
    assert.ok(fs.existsSync(other), "falta en fluyo-mcp: " + f);
    assert.equal(fs.readFileSync(other, "utf8").replace(/\r\n/g, "\n"), read("test/fixtures/" + f), f + " idéntico en los dos repos");
  }
});
