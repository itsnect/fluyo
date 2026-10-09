"use strict";
/* FLUYO-018.16 — gramática de las conexiones: comprobaciones en vm y estáticas (sin navegador).
   · Geometría compartida (edgeStroke, geometry.js): línea de 1,5 con esquinas cuadráticas, sin marca en el origen y
     una aguja con muesca cuya punta queda a EDGE_GAP del ancla; la línea termina en la muesca. endArrow/startArrow
     (datos del documento) deciden las puntas. Casos límite sin NaN.
   · Lienzo (render.js): el trazo sale de edgeStroke; seleccionar NO recolorea la línea (funda oliva debajo); los
     instrumentos de edición miden lo mismo en pantalla a cualquier zoom; ya no hay flechas de bloque de lado sino un
     puerto único (drawConnectPort) en el lado que mira al cursor.
   · Interacción: aciertos en px de pantalla y nunca menores que antes; puerto solo con ratón; arrowHostNode = el nodo
     bajo el ratón.
   · SVG (export.js): sin <marker> ni context-stroke; trazo y puntas explícitos de la misma geometría.
   · Sin tocar modelo ni formato; CACHE v75; fixtures compartidos con fluyo-mcp. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const head = (f) => execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" });
const J = (v) => JSON.parse(JSON.stringify(v));
const LF = (s) => s.replace(/\r\n/g, "\n");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const slice = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = b ? s.indexOf(b, i + a.length) : s.length; return s.slice(i, j < 0 ? s.length : j); };

function geometry() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of ["config.js", "safe-svg.js", "model.js"]) vm.runInContext(read("js/" + f), ctx, { filename: f });
  vm.runInContext(read("js/geometry.js"), ctx, { filename: "geometry.js" });
  return ctx;
}
const G = geometry();
const call = (src, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(src, G)); };
const stroke = (e, pts) => call("edgeStroke(__a.e, __a.pts)", { e, pts });
const H = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

test("edgeStroke: constantes de la gramática", () => {
  assert.deepEqual(call("[EDGE_W, EDGE_CORNER, EDGE_GAP, EDGE_HEAD_LEN, EDGE_HEAD_HALF, EDGE_HEAD_NOTCH]"), [1.5, 8, 3, 11, 4, 2.8]);
  assert.deepEqual(call("[CONNECT_PORT_OFF, CONNECT_PORT_HIT, CONNECT_PORT_R]"), [18, 11, 4.5]);
});

test("edgeStroke: la punta no toca el destino (EDGE_GAP) y la línea termina en la muesca", () => {
  const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }];
  const s = stroke({ endArrow: true }, pts);
  assert.equal(s.heads.length, 1);
  const tip = s.heads[0][0], notch = s.heads[0][2];
  assert.deepEqual([tip.op, tip.x, tip.y], ["M", 197, 0], "punta a 3 px del ancla");
  assert.ok(Math.abs(notch.x - (197 - 11 + 2.8)) < 1e-9 && notch.y === 0, "muesca");
  const end = s.line[s.line.length - 1];
  assert.ok(Math.abs(end.x - notch.x) < 1e-9 && end.y === 0, "la línea muere en la muesca: no asoma bajo la punta");
  assert.deepEqual(s.line[0], { op: "M", x: 0, y: 0 }, "sin marca ni recorte en el origen");
  const ancho = Math.abs(s.heads[0][1].y - s.heads[0][3].y);
  assert.equal(ancho, 8, "aguja de 11 × 8 (antes 12 × 12 en el lienzo y 20 × 16 en el SVG)");
});

test("edgeStroke: endArrow/startArrow son datos del documento y deciden las puntas", () => {
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 120 }];
  assert.equal(stroke({ endArrow: false }, pts).heads.length, 0);
  assert.equal(stroke({}, pts).heads.length, 1, "endArrow ausente = true (como normalizeProjectEdge)");
  const both = stroke({ endArrow: true, startArrow: true }, pts);
  assert.equal(both.heads.length, 2);
  assert.deepEqual([both.heads[1][0].x, both.heads[1][0].y], [0, 3], "la punta del origen, a 3 px del origen");
  assert.ok(both.line[0].y > 3 && both.line[both.line.length - 1].y < 117);
});

test("edgeStroke: esquinas cuadráticas de radio ≤ 8 con el vértice como control; vértices colineales sin curva", () => {
  const s = stroke({ endArrow: false }, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 103, y: 100 }]);
  const q = s.line.filter((x) => x.op === "Q");
  assert.equal(q.length, 2);
  assert.deepEqual([q[0].cx, q[0].cy, q[0].x, q[0].y], [100, 0, 100, 8]);
  assert.ok(Math.abs(q[1].x - 101.5) < 1e-9, "el radio se limita a medio tramo (tramo de 3 → 1,5)");
  const col = stroke({ endArrow: false }, [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 0, y: 90 }]);
  assert.ok(col.line.every((x) => x.op !== "Q"), "sin giro no hay esquina");
});

test("edgeStroke: casos límite sin NaN (tramo nulo, waypoint repetido, tramo más corto que la punta)", () => {
  for (const pts of [[{ x: 0, y: 0 }, { x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }], [{ x: 0, y: 0 }, { x: 4, y: 0 }], [{ x: 3, y: 3 }]])
    for (const e of [{}, { startArrow: true }]) {
      const s = stroke(e, pts);
      assert.ok(!JSON.stringify(s).includes("null"), "sin NaN: " + JSON.stringify(pts));
    }
  const rep = stroke({}, [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }]);
  assert.equal(rep.heads.length, 1, "un waypoint repetido no deja la punta sin orientación");
  assert.equal(rep.heads[0][0].x, 47);
});

test("segmentsToSVGPath entiende Q; traceSegments (lienzo) también", () => {
  assert.equal(call("segmentsToSVGPath(__a)", [{ op: "M", x: 0, y: 0 }, { op: "Q", cx: 10, cy: 0, x: 10, y: 10 }]), "M 0.00 0.00 Q 10.00 0.00 10.00 10.00");
  assert.match(slice(read("js/render.js"), "function traceSegments", "\n}"), /s\.op==="Q"\) c\.quadraticCurveTo\(s\.cx,s\.cy,s\.x,s\.y\)/);
});

test("connectPortPoint: a CONNECT_PORT_OFF px de PANTALLA del lado, a cualquier zoom", () => {
  const n = { x: 100, y: 100, w: 120, h: 60, shape: "rect" };
  assert.deepEqual(call("connectPortPoint(__a,'e',1)", n), { x: 178, y: 100 });
  assert.deepEqual(call("connectPortPoint(__a,'n',0.5)", n), { x: 100, y: 34 });
  assert.deepEqual(call("connectPortPoint(__a,'w',2)", n), { x: 31, y: 100 });
});

test("render.js: el trazo sale de edgeStroke; la selección no recolorea la línea; sin flechas de bloque ni triángulo", () => {
  const r = read("js/render.js"), de = code(slice(r, "function drawEdge(", "\nfunction drawDropPreview"));
  assert.match(de, /const stroke=edgeStroke\(e,pts\)/);
  assert.match(de, /c\.strokeStyle=lineCol; c\.lineWidth=EDGE_W;/, "la línea siempre con su color y grosor");
  assert.ok(!/seld\?\s*M\.ink/.test(de) && !/2\.6/.test(de), "seleccionar ya no pinta la línea de oliva ni la engorda");
  assert.match(de, /if\(seld\)\{[\s\S]*?M\.sleeve[\s\S]*?10\/zoom/, "funda oliva de 10 px de pantalla bajo la línea");
  assert.match(de, /for\(const h of stroke\.heads\)\{ c\.beginPath\(\); traceSegments\(c,h\); c\.fill\(\); \}/);
  assert.ok(!/function arrowHead|arrowHead\(/.test(r), "el triángulo 12 × 12 ya no existe");
  assert.ok(!/function drawSideArrows|drawSideArrows\(/.test(r), "las 4 flechas de bloque ya no existen");
  assert.ok(!/ARROW_OFF/.test(code(r)));
  assert.ok(!/3aa7e8|58,\s*167,\s*232/i.test(code(r)), "sin cian");
});

test("render.js: instrumentos de edición de tamaño constante en pantalla, una forma por operación", () => {
  const de = code(slice(read("js/render.js"), "if(single){", "if(!isExport && typeof scHighlight"));
  assert.match(de, /const px=v=>v\/zoom;/);
  assert.match(de, /c\.rect\(wp\.x-s\/2,wp\.y-s\/2,s,s\)/, "codo = cuadrado");
  assert.match(de, /c\.arc\(q\.x,q\.y,px\(4\.5\)/, "extremo = círculo r 4,5 px");
  assert.match(de, /c\.arc\(mx,my,px\(3\.5\)/, "insertar codo = anillo r 3,5 px");
  assert.match(de, /Math\.min\(px\(8\), L\/2\)/, "barra de 16 px");
  assert.ok(!/arc\([^)]*,\s*6,\s*0/.test(de) && !/lineWidth=7;/.test(de), "nada en unidades de mundo");
});

test("render.js: puerto único en el lado que mira al cursor; marco discontinuo del origen en «Conectar»", () => {
  const r = read("js/render.js");
  const p = code(slice(r, "function drawConnectPort(", "\n}"));
  assert.match(p, /const side=inferSide\(n, mouse\)/);
  assert.match(p, /connectPortPoint\(n,side,zoom\)/);
  assert.equal((p.match(/c\.arc\(/g) || []).length, 1, "un solo punto");
  assert.match(code(r), /if\(host\) drawConnectPort\(c,host,rs\);/);
  assert.match(code(r), /if\(I\.linkFrom!==null && I\.linkFrom!==undefined\)\{[\s\S]*?drawLinkOrigin\(c, A, theme, vp\.zoom\)/);
  assert.match(read("js/editor-runtime.js"), /linkFrom:typeof touchModes==="function" \? touchModes\(\)\.link : null,/);
  assert.match(slice(r, "function drawDropPreview(", "\n}"), /CONNECT_PORT_R\/viewZoom/);
});

test("render.js: EDITOR_MARK añade la funda (sleeve) sin tocar los demás valores", () => {
  const r = read("js/render.js");
  const m = slice(r, "const EDITOR_MARK={", "};");
  assert.match(m, /dark :\{ink:"#C3CDA4", soft:"rgba\(195,205,164,\.14\)", arrow:"rgba\(195,205,164,\.92\)", sleeve:"rgba\(195,205,164,\.26\)"\}/);
  assert.match(m, /crema:\{ink:"#4E5A3F",[^}]*sleeve:"rgba\(78,90,63,\.20\)"\}/);
  assert.match(m, /claro:\{ink:"#4E5A3F",[^}]*sleeve:"rgba\(78,90,63,\.20\)"\}/);
  assert.match(r, /return \{ink:m\.ink, soft:m\.soft, arrow:m\.arrow, sleeve:m\.sleeve, knob:/);
});

test("interaction.js: aciertos en px de pantalla, nunca menores que antes; puerto solo con ratón", () => {
  const i = code(read("js/interaction.js"));
  assert.match(i, /function edgeHitTol\(\)\{ return Math\.max\(8, \(isTouch\(\)\? 16 : 6\)\/viewZoom\); \}/);
  assert.match(i, /if\(d<tol\) return es\[i\];/);
  assert.match(i, /function hitSideArrow\(n,x,y,r\)\{\s*if\(!n \|\| isTouch\(\)\) return null;/);
  assert.match(i, /connectPortPoint\(n,s,viewZoom\)/);
  assert.match(i, /function arrowHitRadius\(\)\{ return CONNECT_PORT_HIT\/viewZoom; \}/);
  assert.match(i, /function endHitRadius\(\)\{ return isTouch\(\)\? Math\.max\(16, 22\/viewZoom\) : Math\.max\(9, 7\/viewZoom\); \}/);
  assert.match(i, /isTouch\(\)\? Math\.max\(10, 18\/viewZoom\) : Math\.max\(10, 7\/viewZoom\)/, "codos");
  assert.match(i, /isTouch\(\)\? Math\.max\(14, 18\/viewZoom\) : Math\.max\(9, 7\/viewZoom\)/, "tramos");
  assert.match(i, /const grip = Math\.max\(SEG_GRIP, 10\/viewZoom\);/);
  assert.ok(!/ARROW_OFF/.test(i));
});

test("selection.js: arrowHostNode es el nodo bajo el ratón (ni el seleccionado ni nada con el dedo)", () => {
  const s = code(slice(read("js/selection.js"), "function arrowHostNode(){", "\n}"));
  assert.match(s, /if\(typeof isTouch==="function" && isTouch\(\)\) return null;/);
  assert.match(s, /const n=hoverNode;/);
  assert.ok(!/singleSel|s\.obj/.test(s), "la selección ya no saca el puerto");
});

test("export.js: sin <marker> ni context-stroke; trazo y puntas de edgeStroke con el color de la línea", () => {
  const x = read("js/export.js"), c = code(x);
  assert.ok(!/<marker|context-stroke|marker-end|marker-start|<polyline|buildSVGDefs/.test(c));
  const f = code(slice(x, "function renderConnectorToSVG(", "\nfunction buildSVGDocument"));
  assert.match(f, /const stroke=edgeStroke\(e,pts\);/);
  assert.match(f, /<path d="\$\{segmentsToSVGPath\(stroke\.line\)\}" fill="none" stroke="\$\{lineCol\}" stroke-width="\$\{EDGE_W\}" stroke-linejoin="round"\$\{dash\}\/>/);
  assert.match(f, /for\(const h of stroke\.heads\) parts\.push\(`<path d="\$\{segmentsToSVGPath\(h\)\}" fill="\$\{lineCol\}"\/>`\);/);
});

test("Viewer y editor cargan geometry.js (edgeStroke) antes que render.js; el Viewer no dibuja su propia conexión", () => {
  for (const f of ["index.html", "s/index.html"]) {
    const h = read(f), g = h.indexOf("geometry.js"), r = h.indexOf("render.js");
    assert.ok(g > 0 && r > g, f);
  }
  assert.ok(!/edgeStroke|arrowHead|lineTo/.test(code(read("js/viewer.js"))));
});

test("sin cambios de modelo ni de formato: model.js y config.js idénticos a antes de 018.16", () => {
  /* 018.15 dejó model.js y config.js en su estado final; 018.16 no los toca (los compara 018.15 contra HEAD). */
  const m = read("js/model.js"), c = read("js/config.js");
  assert.ok(!/edgeStroke|EDGE_W|CONNECT_PORT/.test(m + c));
  assert.match(c, /ARROW_OFF=24/, "la constante histórica sigue (config.js es kernel del MCP); ya no la usa nadie");
});

test("textos: la ayuda y docs/ hablan del punto de conectar, no de flechas en los lados", () => {
  const i = read("index.html"), d = read("docs/index.html");
  assert.ok(!/arrastra una de sus flechas|flechas que aparecen en sus lados/.test(i + d));
  assert.match(i, /arrastra el punto<\/b> que aparece en el lado más cercano/);
  assert.match(d, /arrastra el punto que aparece en el lado más cercano/);
});

test("fixtures compartidos con fluyo-mcp (si está al lado)", () => {
  for (const f of ["fluyo-018-16-conexiones.json", "fluyo-018-16-conexiones-svg.json"]) {
    const mine = path.join(root, "test", "fixtures", f), other = path.join(root, "..", "fluyo-mcp", "test", "fixtures", f);
    assert.ok(fs.existsSync(mine), f);
    if (fs.existsSync(other)) assert.equal(LF(fs.readFileSync(mine, "utf8")), LF(fs.readFileSync(other, "utf8")), f);
  }
});

test("sw.js: CACHE v75 (cambian geometry, render, interaction, selection, export, editor-runtime, index y docs; ya precacheados)", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v75";/);
  for (const f of ["./js/geometry.js", "./js/render.js", "./js/interaction.js", "./js/selection.js", "./js/export.js", "./js/editor-runtime.js", "./docs/"]) assert.ok(sw.includes(f), f);
  assert.match(LF(head("sw.js")), /fluyo-static-v\d+/);
});

test("Historias: la vista previa del diálogo de evento dibuja la conexión del lienzo (edgeStroke), sin rediseñar nada más", () => {
  const f = code(slice(read("js/editor-scenarios.js"), "function scPreviewFrame", "\n}"));
  assert.match(f, /const previewStroke = edgeStroke\(\{ endArrow: true \}, \[\{ x: x0, y \}, \{ x: x1, y \}\]\);/);
  assert.match(f, /c\.lineWidth = EDGE_W;/);
  assert.match(f, /for \(const hd of previewStroke\.heads\) \{ c\.beginPath\(\); traceSegments\(c, hd\); c\.fill\(\); \}/);
  assert.ok(!/c\.lineWidth = 2;/.test(f));
});
