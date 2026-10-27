"use strict";
/* FLUYO-019.3 — Una sola semántica de color en la piel (js/skin.js, skinColor), antes del port al MCP. Contratos en vm.
   · skinColor: #rgb y #rrggbb → el mismo string; #rrggbbaa → el color opaco compuesto sobre el fondo de la piel
     (round(fondo·(1−α) + color·α), α = aa/255; customBg #rgb/#rrggbb si lo hay, si no el del tema); otro → null.
   · skinTones: color ilegible → PALETTE[0] (el respaldo histórico de normalizeProjectNode/colHex), con y sin render.js.
   · Relleno: "none" → fondo; #rgb/#rrggbb → tal cual; #rrggbbaa → compuesto; otro → tono de cara.
   · Totalidad: skinNode/skinTones no lanzan con ningún string ni tipo; deterministas.
   · Sin cambios para #rgb/#rrggbb: el skin.js de 1ee65ee (antes de 019.3) y el actual dan exactamente las mismas capas en
     todo el corpus (8 ejemplos + fixtures) × 3 temas + fondo personalizado, y en una batería de colores HEX.
   · Paridad lienzo/SVG con #rrggbbaa: traceSegments y segmentsToSVGPath, mismos vértices; el SVG lleva los tonos de la capa.
   · Golden de colores compartido con fluyo-mcp: test/fixtures/fluyo-019-3-colores.json (FLUYO_UPDATE_GOLDEN=1 lo regenera).
   Lo que necesita lienzo real (Present, Viewer, exportación sin errores con #rrggbbaa) lo mide test/fluyo-019-3-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
/* el skin.js anterior a 019.3 (commit de 019.2): referencia fija, válida también después de commitear */
const BEFORE = "1ee65ee";
const before = (f) => execFileSync("git", ["-C", gitRoot, "show", BEFORE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));
const GOLDEN = "test/fixtures/fluyo-019-3-colores.json";

/* withRender: true = el render.js actual; un string = ese render.js (OLD usa el de 1ee65ee, que aún tenía colHex: FLUYO-019.5 lo sustituyó por nodeTint) */
function ctxWith(skinSrc, withRender) {
  const ctx = vm.createContext({ doc: { pages: [], cur: 0, theme: "dark", customBg: "" }, settings: { font: "Georgia, serif" },
    lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), console });
  vm.runInContext(read("js/config.js"), ctx);
  vm.runInContext("P=()=>doc.pages[doc.cur]; nodeById=id=>P().nodes.find(n=>n.id===id); edgeById=id=>P().edges.find(e=>e.id===id);", ctx);
  vm.runInContext(read("js/geometry.js"), ctx);
  vm.runInContext(skinSrc, ctx);
  if (withRender) vm.runInContext(typeof withRender === "string" ? withRender : read("js/render.js"), ctx);
  return ctx;
}
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const G = ctxWith(read("js/skin.js"), true), G0 = ctxWith(read("js/skin.js"), false);
const OLD = ctxWith(before("js/skin.js"), before("js/render.js"));
const PALETTE0 = run(G, "PALETTE[0].c");
const THEME_BG = run(G, "({dark:THEMES.dark.bg, crema:THEMES.crema.bg, claro:THEMES.claro.bg})");

/* composición independiente (no usa skin.js): la regla escrita en la tarea */
const rgb = (h) => { let s = h.slice(1); if (s.length === 3) s = s.split("").map((c) => c + c).join(""); const v = parseInt(s.slice(0, 6), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const over = (bg, c8) => { const a = parseInt(c8.slice(7, 9), 16) / 255, B = rgb(bg), C = rgb(c8); return hex([0, 1, 2].map((i) => Math.round(B[i] * (1 - a) + C[i] * a))); };

const VALID_SAME = ["#6a9fb5", "#D08B5B", "#abc", "#ABC", "#000000", "#ffffff", "#fff"];
const VALID_ALPHA = ["#6a9fb5cc", "#6A9FB5CC", "#d08b5b80", "#7fa66bff", "#7fa66b00", "#00000001", "#ffffffee"];
const INVALID = ["red", "rgb(1,2,3)", "#12345", "#abcd", "#6a9fb5c", "#6a9fb5ccc", "#gggggg", "#", "", " ", "6a9fb5", "#6a9fb5cc ".repeat(2)];
const NON_STRING = [null, undefined, 1, 0, true, {}, []];
const BGS = [["dark", THEME_BG.dark], ["crema", THEME_BG.crema], ["claro", THEME_BG.claro], ["crema", "#123456"], ["dark", "#abc"], ["claro", "#12345678"], ["dark", ""], ["crema", null]];

test("skinColor · #rgb y #rrggbb: el mismo string; #rrggbbaa: compuesto sobre el fondo; lo demás: null", () => {
  for (const [, bg] of BGS.filter(([, b]) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(b)))) {
    for (const c of VALID_SAME) assert.equal(run(G, "skinColor(__a.c, __a.b)", { c, b: bg }), c, c);
    for (const c of VALID_ALPHA) assert.equal(run(G, "skinColor(__a.c, __a.b)", { c, b: bg }), over(bg.length === 4 ? hex(rgb(bg)) : bg, c.toLowerCase()), c + " sobre " + bg);
    for (const c of INVALID) assert.equal(run(G, "skinColor(__a.c, __a.b)", { c, b: bg }), null, JSON.stringify(c));
    for (const c of NON_STRING) { G.__c = c; G.__b = bg; assert.equal(vm.runInContext("skinColor(__c, __b)", G), null, String(c)); }
  }
  /* valores concretos, escritos a mano */
  assert.equal(run(G, 'skinColor("#6a9fb5cc", THEMES.crema.bg)'), "#86afbe");
  assert.equal(run(G, 'skinColor("#7fa66bff", "#161616")'), "#7fa66b", "α = 1: el color, en minúsculas");
  assert.equal(run(G, 'skinColor("#7fa66b00", "#161616")'), "#161616", "α = 0: el fondo");
  assert.equal(run(G, 'skinColor(" #6a9fb5cc", THEMES.crema.bg)'), "#86afbe", "espacios alrededor, como skinHexRGB");
});

test("skinTones · el fondo de la composición es el de la piel: customBg #rgb/#rrggbb si lo hay, si no el del tema", () => {
  for (const [theme, bg] of BGS) {
    const base = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(bg)) ? bg : THEME_BG[theme];
    const t = run(G, "skinTones(__a.c, __a.t, __a.b)", { c: "#d08b5b80", t: theme, b: bg });
    assert.equal(t.bg, base, theme + "/" + bg);
    assert.equal(t.color, over(base.length === 4 ? hex(rgb(base)) : base, "#d08b5b80"), theme + "/" + bg + ": color compuesto sobre " + base);
  }
});

test("respaldo · un color ilegible cae en PALETTE[0] (no en DEFAULT_NODE_COLOR), con y sin render.js", () => {
  assert.notEqual(PALETTE0, run(G, "DEFAULT_NODE_COLOR"));
  for (const ctx of [G, G0]) for (const c of [...INVALID, ...NON_STRING]) {
    ctx.__c = c;
    assert.equal(J(vm.runInContext('skinTones(__c, "crema", THEMES.crema.bg)', ctx)).color, PALETTE0, JSON.stringify(c));
  }
  assert.ok(!/colHex|DEFAULT_NODE_COLOR/.test(read("js/skin.js").replace(/\/\*[\s\S]*?\*\//g, "")), "skin.js ya no depende de colHex ni de DEFAULT_NODE_COLOR");
});

test("relleno · \"none\" → fondo; #rgb/#rrggbb → tal cual; #rrggbbaa → compuesto; otro o null → tono de cara (rect y cylinder)", () => {
  const cases = [["none", (T) => T.bg], ["#ffffff", () => "#ffffff"], ["#abc", () => "#abc"], ["#ffffff80", (T) => over(T.bg, "#ffffff80")], [null, (T) => T.front], ["red", (T) => T.front], ["#12345", (T) => T.front], [undefined, (T) => T.front]];
  for (const theme of ["dark", "crema"]) for (const shape of ["rect", "cylinder"]) for (const [fill, want] of cases) {
    const n = { id: 1, shape, x: 200, y: 150, w: 160, h: shape === "cylinder" ? 110 : 70, color: "#6a9fb5", ...(fill === undefined ? {} : { fill }) };
    const T = run(G, "skinTones(__a.c, __a.t, THEMES[__a.t].bg)", { c: "#6a9fb5", t: theme });
    const sk = run(G, "skinNode(__a.n, __a.t, THEMES[__a.t].bg)", { n, t: theme });
    const face = sk.layers.find((l) => l.k === (shape === "cylinder" ? "body" : "front"));
    assert.equal(face.fill, want(T), `${theme}/${shape}/fill=${JSON.stringify(fill)}`);
  }
});

test("totalidad · skinNode no lanza con ningún color/relleno/fondo; el LED es el color leído; determinista", () => {
  const shapes = ["rect", "cylinder", "icon", "unknown-shape"];
  let n = 0;
  for (const c of [...VALID_SAME, ...VALID_ALPHA, ...INVALID, ...NON_STRING]) for (const fill of [null, "none", "#ffffff", "#ffffff80", "zzz"]) for (const [theme, bg] of BGS) for (const shape of shapes) {
    const node = { id: 1, shape, x: 200, y: 150, w: 160, h: 110, color: c, fill, icon: "kafka" };
    const a = run(G, "skinNode(__a.n, __a.t, __a.b)", { n: node, t: theme, b: bg }), b = run(G0, "skinNode(__a.n, __a.t, __a.b)", { n: node, t: theme, b: bg });
    assert.deepEqual(a, b, "igual con y sin render.js");
    const led = a.layers.find((l) => l.k === "led");
    if (led) assert.equal(led.fill, run(G, "skinTones(__a.c, __a.t, __a.b).color", { c, t: theme, b: bg }));
    for (const l of a.layers) for (const k of ["fill", "stroke"]) if (l[k] !== undefined) assert.ok(/^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba\([\d,.]+\))$/i.test(l[k]), `${k}=${l[k]} es un color pintable`);
    n++;
  }
  assert.ok(n > 2000, "casos: " + n);
});

/* ── sin cambios para #rgb / #rrggbb ── */
function corpus() {
  const docs = [];
  for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".fluyo.json")))
    docs.push([f, JSON.parse(read(dir + "/" + f))]);
  return docs;
}
test("sin cambios · el skin.js de " + BEFORE + " y el actual dan las mismas capas para todo #rgb/#rrggbb (corpus × temas × fondo propio)", () => {
  let n = 0;
  for (const [name, d] of corpus()) for (const pg of d.doc.pages) for (const node of pg.nodes) for (const [theme, bg] of BGS.slice(0, 5)) {
    assert.ok(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(node.color || "#6a9fb5"), name + ": el corpus solo usa #rgb/#rrggbb");
    assert.deepEqual(run(G, "skinNode(__a.n, __a.t, __a.b)", { n: node, t: theme, b: bg }), run(OLD, "skinNode(__a.n, __a.t, __a.b)", { n: node, t: theme, b: bg }), `${name} #${node.id} ${theme}/${bg}`);
    n++;
  }
  for (const c of [...VALID_SAME, "#5bb0a0", "#9b7fb5", "#857F6C"]) for (const fill of [null, "none", "#ffffff", "#abc"]) for (const [theme, bg] of BGS.slice(0, 5)) for (const shape of ["rect", "cylinder", "icon"]) {
    const node = { id: 2, shape, x: 0, y: 0, w: 160, h: 110, color: c, fill, icon: "kafka" };
    assert.deepEqual(run(G, "skinNode(__a.n, __a.t, __a.b)", { n: node, t: theme, b: bg }), run(OLD, "skinNode(__a.n, __a.t, __a.b)", { n: node, t: theme, b: bg }), `${c}/${fill}/${theme}/${shape}`);
    n++;
  }
  assert.ok(n > 1000, "comparaciones: " + n);
  /* y los colores ilegibles sin # caen donde ya caían en las superficies reales (render.js cargado) */
  for (const c of ["red", "rgb(1,2,3)"]) assert.deepEqual(run(G, 'skinTones(__a, "crema", THEMES.crema.bg)', c), run(OLD, 'skinTones(__a, "crema", THEMES.crema.bg)', c), c);
});

test("antes de 019.3 · #rrggbbaa (válido en el dominio) y #12345 hacían lanzar a skinTones con render.js cargado", () => {
  for (const c of ["#6a9fb5cc", "#12345"]) { OLD.__c = c; assert.throws(() => vm.runInContext('skinTones(__c, "crema", THEMES.crema.bg)', OLD), /Cannot read properties of null/, c); }
  assert.ok(new RegExp(read("js/story-authoring.js").match(/const HEX_COLOR = (\/.*\/);/)[1].slice(1, -1)).test("#6a9fb5cc"), "HEX_COLOR del kernel acepta #rrggbbaa");
});

/* ── paridad lienzo / SVG ── */
test("paridad · con #rrggbbaa, traceSegments (lienzo) y segmentsToSVGPath (SVG) recorren los mismos vértices; el SVG lleva los tonos de la capa", () => {
  const rec = () => { const v = []; return { ops: v, moveTo: (x, y) => v.push(["M", x, y]), lineTo: (x, y) => v.push(["L", x, y]), quadraticCurveTo: (cx, cy, x, y) => v.push(["Q", cx, cy, x, y]),
    ellipse: (cx, cy, rx, ry, rot, a0, a1, ccw) => v.push(["A", rx, ry, ccw ? 0 : 1, +(cx + rx * Math.cos(a1)).toFixed(2), +(cy + ry * Math.sin(a1)).toFixed(2)]), closePath: () => v.push(["Z"]) }; };
  const fromSVG = (d) => d.split(" ").reduce((acc, tok) => { if (/^[MLQAZ]$/.test(tok)) acc.push([tok]); else acc[acc.length - 1].push(+tok); return acc; }, [])
    .map((t) => t[0] === "A" ? ["A", t[1], t[2], t[5], t[6], t[7]] : t);
  /* el exportador real: export.js necesita algunos globales de DOM; basta con su skinLayersToSVG */
  const exp = read("js/export.js"), body = exp.slice(exp.indexOf("function skinLayersToSVG"), exp.indexOf("function renderNodeToSVG"));
  vm.runInContext("function escapeAttribute(v){ return String(v).replace(/&/g,'&amp;').replace(/\"/g,'&quot;').replace(/</g,'&lt;'); }\n" + body, G);
  let layers = 0;
  for (const theme of ["dark", "crema"]) for (const shape of ["rect", "cylinder", "icon"]) {
    const n = { id: 9, shape, x: 300, y: 200, w: 160, h: 110, color: "#d08b5b80", fill: shape === "rect" ? "#ffffff80" : null, icon: "kafka" };
    const sk = run(G, "skinNode(__a.n, __a.t, THEMES[__a.t].bg)", { n, t: theme });
    for (const L of sk.layers) for (const segs of [L.segs, L.clip].filter(Boolean)) {
      G.__s = segs; G.__c = rec(); vm.runInContext("traceSegments(__c, __s)", G);
      assert.deepEqual(fromSVG(vm.runInContext("segmentsToSVGPath(__s)", G)), G.__c.ops.map((o) => o.map((v) => typeof v === "number" ? +v.toFixed(2) : v)), `${theme}/${shape}/${L.k}`);
      layers++;
    }
    G.__l = sk.layers; G.__n = n;
    const svg = vm.runInContext("skinLayersToSVG(__l, __n)", G);
    for (const L of sk.layers) if (L.fill) assert.ok(svg.includes(`fill="${L.fill}"`), `${theme}/${shape}/${L.k}: fill ${L.fill} en el SVG`);
    assert.ok(!/(fill|stroke)="#[0-9a-f]{8}"/i.test(svg), "ningún color con alfa llega al SVG de la piel");
  }
  assert.ok(layers >= 20, "capas: " + layers);
});

/* ── golden compartido con fluyo-mcp ── */
function colorGolden() {
  const node = (shape, color, fill) => ({ id: 1, shape, x: 300, y: 200, w: 160, h: shape === "icon" ? 120 : 90, color, fill, icon: "kafka", label: "N" });
  const out = { generatedBy: "test/fluyo-019-3.test.cjs (node --test) · regenerar solo si cambia skinColor a propósito", palette0: PALETTE0, skinColor: [], tones: [], nodes: [] };
  for (const [, bg] of BGS.filter(([, b]) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(b))))
    for (const c of [...VALID_SAME, ...VALID_ALPHA, ...INVALID, null, 1]) out.skinColor.push({ c, bg, out: run(G, "skinColor(__a.c, __a.b)", { c, b: bg }) });
  for (const [theme, bg] of BGS) for (const c of [...VALID_SAME.slice(0, 3), ...VALID_ALPHA, "red", "#12345", null])
    out.tones.push({ c, theme, bg, out: run(G, "skinTones(__a.c, __a.t, __a.b)", { c, t: theme, b: bg }) });
  for (const [theme, bg] of [["crema", THEME_BG.crema], ["dark", THEME_BG.dark], ["crema", "#123456"]]) for (const shape of ["rect", "cylinder", "icon"])
    for (const [c, fill] of [["#6a9fb5cc", null], ["#6a9fb5", "#ffffff80"], ["#d08b5b80", "none"], ["red", "zzz"], ["#12345", "#abc"]])
      out.nodes.push({ theme, bg, n: node(shape, c, fill), out: run(G, "skinNode(__a.n, __a.t, __a.b)", { n: node(shape, c, fill), t: theme, b: bg }) });
  return out;
}
test("golden · test/fixtures/fluyo-019-3-colores.json = skinColor/skinTones/skinNode de skin.js (contrato de color para el MCP)", () => {
  const got = colorGolden();
  if (process.env.FLUYO_UPDATE_GOLDEN === "1") fs.writeFileSync(path.join(root, GOLDEN), JSON.stringify(got, null, 1) + "\n");
  assert.ok(fs.existsSync(path.join(root, GOLDEN)), "FLUYO_UPDATE_GOLDEN=1 node --test test/fluyo-019-3.test.cjs");
  assert.deepEqual(got, JSON.parse(read(GOLDEN)));
  assert.ok(got.skinColor.length > 100 && got.tones.length > 100 && got.nodes.length === 45);
});
test("golden · fixtures compartidos con fluyo-mcp (si está al lado): byte a byte los mismos", () => {
  const mcp = path.resolve(root, "..", "fluyo-mcp", "test", "fixtures");
  if (!fs.existsSync(mcp)) return;
  for (const f of ["fluyo-019-3-colores.json"]) {
    const other = path.join(mcp, f);
    if (!fs.existsSync(other)) continue;
    assert.equal(fs.readFileSync(other, "utf8").replace(/\r\n/g, "\n"), read("test/fixtures/" + f), f + " igual en los dos repos");
  }
});

/* ── alcance ── */
test("alcance · skin.js: skinColor es el único lector de color (tonos, LED y relleno); el anillo de salida no interpreta colores; sw.js v87", () => {
  const src = read("js/skin.js");
  assert.equal((src.match(/skinColor\(/g) || []).length, 4, "definición + skinTones + los dos frentes (rect y cylinder)");
  assert.ok(/const col=skinColor\(color, base\) \|\| PALETTE\[0\]\.c;/.test(src));
  assert.equal((src.match(/skinColor\(n\.fill, T\.bg\) \|\| T\.front/g) || []).length, 2);
  assert.ok(!/skinHexRGB\(n\.fill\)/.test(src), "el relleno ya no se lee aparte");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v111";/);
  /* el resto de skin.js no cambia respecto a 019.2: mismas funciones exportadas. FLUYO-019.4a añade a propósito la
     silueta del aterrizaje (skinSilhouette, skinLineCuts, skinLayerSpan): su alcance lo vigila test/fluyo-019-4a.test.cjs */
  const fns = (s) => [...s.matchAll(/^function (\w+)/gm)].map((m) => m[1]);
  const added4a = ["skinColor", "skinSilhouette", "skinLineCuts", "skinLayerSpan"];
  assert.deepEqual(fns(src).filter((f) => !added4a.includes(f)), fns(before("js/skin.js")));
});
