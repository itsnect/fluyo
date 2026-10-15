"use strict";
/* FLUYO-019.1 — Piel «construido» (2.5D) en Present y exportación. Contratos en vm (sin navegador).
   · Golden: skinNode / skinExtent / skinEdgeLanding por pieza (rect, dashed+fill, fill none, cylinder, icon, hex, text,
     forma desconocida) y tema (dark, crema, claro, fondo personalizado) = test/fixtures/fluyo-019-1-skin.json.
   · Pureza: la piel no escribe en el nodo ni en la ruta, es determinista y devuelve null para las formas planas.
   · skinActive: solo "built", y solo con ≥ 3 px de canto en pantalla (zoom ≥ 0,375).
   · Aterrizaje: solo n/e, solo con tramo final ortogonal, nunca en una recta de dos puntos; el penúltimo acompaña.
   · Paridad lienzo/SVG: las mismas capas recorridas por traceSegments (render.js) y por segmentsToSVGPath (geometry.js)
     dan los mismos vértices, también en los arcos (clip incluido).
   · Alcance (actualizado en FLUYO-019.2): kernel salvo model.js, geometría, Historias y Share idénticos a HEAD; la piel es
     settings.skin (lista cerrada, solo se persiste "built", DEFAULT_SETTINGS sin `skin`); skin.js lo cargan el editor y el
     Viewer entre geometry y render; sw.js con skin.js; las aserciones de CACHE del árbol de tests miran la versión actual.
   Lo que necesita lienzo y Chrome (editor plano byte a byte, Present construido, tecla B, zoom, export) lo mide
   test/fluyo-019-1-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const head = (f) => execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));
const GOLDEN = JSON.parse(read("test/fixtures/fluyo-019-1-skin.json"));

/* config + geometry + skin (+ render para traceSegments) con los globales mínimos que esperan */
function skinCtx(withRender) {
  const ctx = vm.createContext({ doc: { pages: [], cur: 0, theme: "dark", customBg: "" }, settings: { font: "Georgia, serif" },
    lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), console });
  vm.runInContext(read("js/config.js"), ctx);
  vm.runInContext("P=()=>doc.pages[doc.cur]; nodeById=id=>P().nodes.find(n=>n.id===id); edgeById=id=>P().edges.find(e=>e.id===id);", ctx);
  vm.runInContext(read("js/geometry.js"), ctx);
  vm.runInContext(read("js/skin.js"), ctx);
  if (withRender) vm.runInContext(read("js/render.js"), ctx);
  return ctx;
}
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const G = skinCtx(true);
const NODES = GOLDEN.nodes;
const byId = (id) => NODES.find((n) => n.id === id);

/* ── golden ── */
test("golden · skinNode por pieza y tema coincide con el fixture (dark, crema, claro)", () => {
  for (const theme of ["dark", "crema", "claro"]) for (const n of NODES) {
    const got = run(G, "skinNode(__a.n, __a.t, THEMES[__a.t].bg)", { n, t: theme });
    assert.deepEqual(got, GOLDEN.themes[theme][n.id], `${theme} / ${n.shape} #${n.id}`);
  }
});
test("golden · fondo personalizado: los tonos se mezclan con ese fondo, no con el del tema", () => {
  const got = run(G, 'skinNode(__a, "crema", "#123456")', byId(1));
  assert.deepEqual(got, GOLDEN.themes.customBg);
  const tone = got.layers.find((l) => l.k === "top").fill, tema = GOLDEN.themes.crema[1].layers.find((l) => l.k === "top").fill;
  assert.notEqual(tone, tema);
});
test("golden · skinExtent y skinEdgeLanding coinciden con el fixture", () => {
  for (const n of NODES) assert.deepEqual(run(G, "skinExtent(__a)", n), GOLDEN.extent[n.id], n.shape);
  for (const [k, v] of Object.entries(GOLDEN.landing)) {
    const [route, side] = k.split("/");
    const pts = { n3: [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 100 }], e3: [{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 200 }, { x: 120, y: 200 }],
      n2: [{ x: 100, y: 0 }, { x: 100, y: 100 }], diag: [{ x: 0, y: 0 }, { x: 40, y: 40 }, { x: 80, y: 100 }] }[route];
    assert.deepEqual(run(G, "skinEdgeLanding(__a.p, __a.s)", { p: pts, s: side }), v, k);
  }
});

/* ── contrato de las piezas ── */
test("piezas · rect: contacto, tapa, lateral, frente (radio 2) y LED; el frente es exactamente la caja semántica", () => {
  const sk = run(G, 'skinNode(__a, "crema", THEMES.crema.bg)', byId(1));
  assert.deepEqual(sk.layers.map((l) => l.k), ["contact", "top", "side", "front", "led"]);
  const n = byId(1), front = sk.layers.find((l) => l.k === "front").segs, xs = front.filter((s) => s.x !== undefined).map((s) => s.x), ys = front.filter((s) => s.y !== undefined).map((s) => s.y);
  assert.equal(Math.min(...xs), n.x - n.w / 2); assert.equal(Math.max(...xs), n.x + n.w / 2);
  assert.equal(Math.min(...ys), n.y - n.h / 2); assert.equal(Math.max(...ys), n.y + n.h / 2);
  const top = sk.layers.find((l) => l.k === "top").segs;
  assert.deepEqual(top.slice(0, 4).map((s) => [s.x, s.y]), [[n.x - n.w / 2, n.y - n.h / 2], [n.x + n.w / 2, n.y - n.h / 2], [n.x + n.w / 2 + 8, n.y - n.h / 2 - 8], [n.x - n.w / 2 + 8, n.y - n.h / 2 - 8]], "tapa = frente + d");
  assert.equal(sk.layers.find((l) => l.k === "led").fill, n.color, "el LED es el color del nodo");
  for (const l of sk.layers) assert.ok(!("fill" in l) || !/gradient|url\(/.test(String(l.fill)), "sin gradientes");
});
test("piezas · cylinder: la geometría es la de cylinderSegments (018.14a); tapa clara, banda recortada al contorno, LED", () => {
  const n = byId(4), sk = run(G, 'skinNode(__a, "dark", THEMES.dark.bg)', n);
  assert.deepEqual(sk.layers.map((l) => l.k), ["body", "band", "cap", "led"]);
  assert.deepEqual(sk.layers[0].segs, run(G, "cylinderSegments(__a).outline", n), "el cuerpo es el contorno compartido");
  assert.deepEqual(sk.layers[1].clip, run(G, "cylinderSegments(__a).outline", n), "la banda se recorta al contorno");
});
test("piezas · icon: solo una peana (tapa, lateral, frente) bajo el glifo; el glifo mide lo mismo que en drawNode/anchorBox", () => {
  const n = byId(5), sk = run(G, 'skinNode(__a, "crema", THEMES.crema.bg)', n);
  assert.deepEqual(sk.layers.map((l) => l.k), ["top", "side", "front"]);
  const s = Math.min(n.w, n.h - 26) * 0.78, front = sk.layers[2].segs;
  assert.ok(Math.abs(front[1].x - front[0].x - (s + 16)) < 1e-9, "peana = glifo + 16");
  assert.equal(front[0].y, n.y - n.h / 2 + 4 + s - 2, "apoyada 2 px dentro del borde inferior del glifo");
});
test("piezas · dashed/dotted y fill: el frente hereda el borde y el relleno explícito; fill:none = papel del fondo", () => {
  const d = run(G, 'skinNode(__a, "claro", THEMES.claro.bg)', byId(2)), h = run(G, 'skinNode(__a, "claro", THEMES.claro.bg)', byId(3));
  assert.deepEqual(d.layers.find((l) => l.k === "front").dash, [9, 7]); assert.equal(d.layers.find((l) => l.k === "front").fill, "#ffffff");
  assert.equal(h.layers.find((l) => l.k === "front").fill, "#ffffff", "fill:none → el fondo (claro)");
});
test("piezas · formas planas devuelven null (hex, diamond, circle, text, code, image, anim); una forma desconocida es un bloque", () => {
  for (const shape of ["hex", "diamond", "circle", "text", "code", "image", "anim"])
    assert.equal(run(G, 'skinNode(__a, "dark", THEMES.dark.bg)', { ...byId(1), shape }), null, shape);
  assert.equal(run(G, 'skinNode(__a, "dark", THEMES.dark.bg)', byId(8)).layers.length, 5);
  assert.equal(run(G, "skinExtent(__a)", byId(6)), null);
});

/* ── pureza y activación ── */
test("pureza · determinista y sin efectos: el nodo y la ruta quedan intactos; dos llamadas dan lo mismo", () => {
  for (const n of NODES) {
    const before = J(n);
    const a = run(G, 'skinNode(__a, "crema", THEMES.crema.bg)', n), b = run(G, 'skinNode(__a, "crema", THEMES.crema.bg)', n);
    assert.deepEqual(a, b); assert.deepEqual(n, before);
  }
  G.__p = [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 100 }];
  const out = J(vm.runInContext('skinEdgeLanding(__p, "n")', G));
  assert.deepEqual(J(G.__p), [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 100 }], "la ruta de entrada no se toca");
  assert.deepEqual(out, [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 204, y: 50 }, { x: 204, y: 96 }]);
});
test("skinActive · solo \"built\" y solo con canto ≥ 3 px en pantalla (zoom ≥ 0,375); sin bandera, plano", () => {
  const act = (s, z) => run(G, "skinActive(__a.s, __a.z)", { s, z });
  assert.equal(act("built", 1), true); assert.equal(act("built", 0.375), true); assert.equal(act("built", 0.3), false);
  assert.equal(act("flat", 1), false); assert.equal(act(undefined, 1), false); assert.equal(act(null, 2), false); assert.equal(act("otra", 1), false);
  assert.equal(act("built", undefined), true, "zoom ausente = 1 (exportación)");
});
test("aterrizaje · n/e desplazan d/2 y el penúltimo acompaña; s/w, rectas de dos puntos y tramos finales diagonales no cambian", () => {
  const L = (p, s) => run(G, "skinEdgeLanding(__a.p, __a.s)", { p, s });
  const n3 = [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 100 }];
  assert.deepEqual(L(n3, "n"), [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 204, y: 50 }, { x: 204, y: 96 }]);
  assert.deepEqual(L(n3, "s"), n3); assert.deepEqual(L(n3, "w"), n3);
  const e3 = [{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 200 }, { x: 120, y: 200 }];
  assert.deepEqual(L(e3, "e"), [{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 196 }, { x: 124, y: 196 }]);
  assert.deepEqual(L([{ x: 100, y: 0 }, { x: 100, y: 100 }], "n"), [{ x: 100, y: 0 }, { x: 100, y: 100 }], "recta de dos puntos: sin vértice que acompañe");
  const diag = [{ x: 0, y: 0 }, { x: 40, y: 40 }, { x: 80, y: 100 }];
  assert.deepEqual(L(diag, "n"), diag); assert.deepEqual(L(diag, "e"), diag);
  assert.deepEqual(L(e3, "n"), e3, "entra por n pero el tramo final es horizontal: no se toca");
});
test("rótulo · skinLabelFont: Plex Mono 500 solo sin fuente propia y con la global de serie; negrita se respeta", () => {
  const F = (n, g) => run(G, "skinLabelFont(__a.n, __a.g)", { n, g });
  const plex = run(G, 'FONTS.find(f=>f.n==="IBM Plex Mono").f');
  assert.deepEqual(F({ label: "x" }, run(G, "DEFAULT_FONT")), { family: plex, weight: "500" });
  assert.deepEqual(F({ label: "x", bold: true }, undefined), { family: plex, weight: "bold" });
  assert.equal(F({ label: "x", font: "Georgia, serif" }, undefined), null, "fuente del nodo manda");
  assert.equal(F({ label: "x" }, plex), null, "fuente global elegida manda (aunque sea Plex)");
});
test("orden de pintor · derivado (y ascendente, x descendente), estable y sin tocar el array del documento", () => {
  const nodes = [{ id: 1, x: 100, y: 200 }, { id: 2, x: 300, y: 100 }, { id: 3, x: 100, y: 100 }, { id: 4, x: 300, y: 200 }];
  assert.deepEqual(run(G, "skinPaintOrder(__a).map(n=>n.id)", nodes), [2, 3, 4, 1]);
  assert.deepEqual(nodes.map((n) => n.id), [1, 2, 3, 4]);
});

/* ── paridad lienzo / SVG ── */
test("paridad · traceSegments (lienzo) y segmentsToSVGPath (SVG) recorren los mismos vértices en todas las capas y clips", () => {
  const rec = () => { const v = []; return { ops: v, moveTo: (x, y) => v.push(["M", x, y]), lineTo: (x, y) => v.push(["L", x, y]), quadraticCurveTo: (cx, cy, x, y) => v.push(["Q", cx, cy, x, y]),
    ellipse: (cx, cy, rx, ry, rot, a0, a1, ccw) => v.push(["A", rx, ry, ccw ? 0 : 1, +(cx + rx * Math.cos(a1)).toFixed(2), +(cy + ry * Math.sin(a1)).toFixed(2)]), closePath: () => v.push(["Z"]) }; };
  const fromSVG = (d) => d.split(" ").reduce((acc, tok) => { if (/^[MLQAZ]$/.test(tok)) acc.push([tok]); else acc[acc.length - 1].push(+tok); return acc; }, [])
    .map((t) => t[0] === "A" ? ["A", t[1], t[2], t[5], t[6], t[7]] : t);   // A rx ry 0 0 sweep x y → [A, rx, ry, sweep, x, y]
  let layers = 0;
  for (const theme of ["dark", "crema"]) for (const n of NODES) {
    const sk = run(G, "skinNode(__a.n, __a.t, THEMES[__a.t].bg)", { n, t: theme });
    if (!sk) continue;
    for (const L of sk.layers) for (const segs of [L.segs, L.clip].filter(Boolean)) {
      G.__s = segs; G.__c = rec();
      vm.runInContext("traceSegments(__c, __s)", G);
      const canvas = G.__c.ops.map((o) => o.map((v) => typeof v === "number" ? +v.toFixed(2) : v));
      const svg = fromSVG(vm.runInContext("segmentsToSVGPath(__s)", G));
      assert.deepEqual(svg, canvas, `${theme}/${n.shape}/${L.k}`);
      layers++;
    }
  }
  assert.ok(layers >= 30, "capas comparadas: " + layers);
  G.__p = [{ x: 10, y: 10 }];
  const port = J(vm.runInContext('skinEdgePort(__p[0], "#777", "#161616")', G));
  G.__s = port.segs; G.__c = rec(); vm.runInContext("traceSegments(__c, __s)", G);
  assert.deepEqual(fromSVG(vm.runInContext("segmentsToSVGPath(__s)", G)), G.__c.ops.map((o) => o.map((v) => typeof v === "number" ? +v.toFixed(2) : v)), "puerto");
});

/* ── alcance ── */
/* FLUYO-019.2 sacó de esta lista js/model.js (settings.skin), js/viewer.js y s/index.html (el Viewer pinta la piel del documento). */
const SAME_AS_HEAD = ["js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/story-clock.js",
  "js/document-integrity.js", "js/story-authoring.js", "js/share-url.js", "js/editor-share.js", "js/deeplink.js", "js/link-codec.js", "js/share-loader.js",
  "js/viewer-viewport.js", "css/share.css", "css/identity.css", "js/geometry.js", "js/selection.js", "js/editor-scenarios.js", "js/present-story.js"];
test("alcance · kernel (salvo model.js), geometría, Historias y Share idénticos a HEAD; skin.js lo cargan el editor y el Viewer (019.2) entre geometry y render", () => {
  for (const f of SAME_AS_HEAD) assert.equal(read(f), head(f), f + " idéntico a HEAD");
  const html = read("index.html"), viewer = read("s/index.html");
  assert.ok(html.indexOf('<script src="js/geometry.js">') < html.indexOf('<script src="js/skin.js">') && html.indexOf('<script src="js/skin.js">') < html.indexOf('<script src="js/render.js">'), "editor: geometry → skin → render");
  assert.ok(viewer.indexOf('<script src="../js/geometry.js">') < viewer.indexOf('<script src="../js/skin.js">') && viewer.indexOf('<script src="../js/skin.js">') < viewer.indexOf('<script src="../js/render.js">'), "Viewer (019.2): geometry → skin → render");
  assert.ok(!/^\s*import\s/m.test(read("js/skin.js")), "script clásico, sin import");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v87";/);
  assert.ok(read("sw.js").includes('"./js/skin.js",'), "skin.js precacheado");
  /* skin.js va justo después de geometry.js también en la lista precacheada (el orden de carga del editor) */
  const sw = read("sw.js");
  assert.ok(sw.indexOf('"./js/geometry.js",') < sw.indexOf('"./js/skin.js",') && sw.indexOf('"./js/skin.js",') < sw.indexOf('"./js/render.js",'), "sw.js: geometry → skin → render");
});
test("alcance (019.2) · la piel es un ajuste del documento: DEFAULT_SETTINGS sin `skin` (ausente = plano), solo se persiste \"built\", presentSkin ya no existe", () => {
  const M = skinCtx(false);
  vm.runInContext(read("js/model.js"), M);
  assert.ok(!("skin" in run(M, "DEFAULT_SETTINGS")), "DEFAULT_SETTINGS no conoce la piel: ausente = plano");
  assert.deepEqual(run(M, "SKIN_VALUES"), ["flat", "built"], "lista cerrada");
  assert.equal(run(M, 'settingsFromProjectData({skin:"built"}).skin'), "built");
  assert.ok(!("skin" in run(M, 'settingsFromProjectData({skin:"flat"})')), "\"flat\" se representa por ausencia");
  for (const f of ["js/state.js", "js/ui.js", "js/editor-runtime.js", "js/export.js", "js/interaction.js", "js/model.js", "js/share-url.js", "index.html"]) assert.ok(!/presentSkin/.test(read(f)), f + ": sin presentSkin");
  assert.ok(!/localStorage/.test(read("js/skin.js")) && !read("js/ui.js").slice(read("js/ui.js").indexOf("function setDocumentSkin"), read("js/ui.js").indexOf("function updatePresentBar")).includes("localStorage"), "sin localStorage");
  /* el editor-runtime solo pasa la piel al viewport en Present, y la decide el documento */
  assert.match(read("js/editor-runtime.js"), /skin: presenting \? projectSkin\(settings\) : "flat"/);
});
test("alcance · render.js y export.js: la piel es un argumento (opts.skin / viewport.skin) y todo queda bajo typeof-guard para el Viewer", () => {
  const r = read("js/render.js"), e = read("js/export.js");
  assert.match(r, /rs\.skinOn=typeof skinActive==="function" && skinActive\(opts\.skin!==undefined\? opts\.skin : \(rs\.viewport&&rs\.viewport\.skin\), skinZoom\)/);
  assert.match(e, /function buildSVGDocument\(scale=1, skin\)/);
  assert.match(e, /const skinOn=typeof skinActive==="function" && skinActive\(skin, 1\);/);
  for (const fn of ["skinNode", "skinEdgeLanding", "skinEdgePort"]) assert.ok(r.includes(`typeof ${fn}==="function"`) && e.includes(`typeof ${fn}==="function"`), fn + " con guardia");
  assert.ok(!/settings\.skin/.test(r), "render.js no lee settings.skin: la piel le llega como argumento (viewport.skin / opts.skin)");
  assert.match(e, /\$\("exSkin"\)\.value = projectSkin\(settings\);/, "export.js (019.2): la fila del diálogo arranca con el aspecto del documento, vía projectSkin");
});
test("alcance · las aserciones de CACHE de los tests ya miran la versión actual (ningún test del árbol espera la anterior como actual)", () => {
  const current = /const CACHE = "fluyo-static-v(\d+)";/.exec(read("sw.js"))[1], previous = "fluyo-static-v" + (current - 1);
  /* las mutaciones usan la anterior como «no sube»; el smoke del service worker de 019.2 instala la anterior para medir el upgrade */
  const mutations = (f) => /-mutations\.cjs$/.test(f) || f === "fluyo-019-1.test.cjs" || f === "fluyo-019-2-browser.cjs";
  const stale = fs.readdirSync(path.join(root, "test")).filter((f) => f.endsWith(".cjs") && !mutations(f) && read("test/" + f).includes(previous));
  assert.deepEqual(stale, []);
});
