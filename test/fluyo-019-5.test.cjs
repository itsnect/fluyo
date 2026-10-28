"use strict";
/* FLUYO-019.5 — El tinte de un color de nodo con todos los HEX del dominio (decisión 207). Contratos en vm.
   · colorTint (js/geometry.js): #rrggbb → rgba(r,g,b,k), el string de siempre; #rgb → expandido; #rrggbbaa → alfa k·aa/255 con
     4 decimales (aa=ff → k exacto); mayúsculas y espacios de los extremos dan igual; cualquier otro valor → null.
   · Usuarios: fillFor, la pista de drawAnim (spinner/progress/ticket) y svgFillColor tiñen con nodeTint (ilegible → PALETTE[0]);
     codePanelTint usa colorTint (ilegible → el fondo del tema, como antes).
   · Identidad: para todo #rrggbb (paleta, corpus y un barrido con semilla, en mayúsculas y minúsculas) fillFor, svgFillColor,
     codeColors y los estilos que drawAnim pinta son EXACTAMENTE los de b534a97 (antes de 019.5).
   · Guarda: hexA (kernel, sin tocar) ya no recibe colores de nodo; no queda ningún otro lector «parseInt(…slice(1),16)» en el
     pintor ni en el SVG.
   · Alcance: model.js, config.js, skin.js y el resto del kernel idénticos a b534a97; solo cambian geometry/render/export y sw.js (v88).
   · Fixture compartido con fluyo-mcp (test/fixtures/fluyo-019-5-tinte.json): sus tints = colorTint = la regla escrita aquí.
   Lo que necesita lienzo real (píxeles en el raster, el editor, Present y el Viewer; paridad lienzo/SVG; corpus byte a byte) lo
   mide test/fluyo-019-5-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BEFORE = "b534a97";
const before = (f) => execFileSync("git", ["-C", gitRoot, "show", BEFORE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));
const GOLDEN = JSON.parse(read("test/fixtures/fluyo-019-5-tinte.json"));

/* svgFillColor y svgNodeFill se sacan de export.js (que necesita DOM para cargarse entero) */
const exportFns = (src) => ["svgFillColor", "svgNodeFill", "escapeXML", "escapeAttribute"].map((name) => {
  const i = src.indexOf("function " + name + "("); assert.ok(i >= 0, "export.js: " + name);
  let depth = 0, j = src.indexOf("{", i);
  for (; j < src.length; j++) { if (src[j] === "{") depth++; else if (src[j] === "}" && --depth === 0) break; }
  return src.slice(i, j + 1);
}).join("\n");
function ctxFrom(get) {
  const ctx = vm.createContext({ doc: { pages: [], cur: 0, theme: "dark", customBg: "" }, settings: { font: "Georgia, serif", speed: 1 },
    lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), smooth: (t) => t, console });
  require("./i18n-vm.cjs").loadI18n(ctx);   /* FLUYO-I18N-002 S2a: Historias pasa por FluyoI18n.t, como en la página (en español, el texto de siempre) */
  vm.runInContext(get("js/config.js"), ctx);
  vm.runInContext("P=()=>doc.pages[doc.cur]; nodeById=id=>P().nodes.find(n=>n.id===id); edgeById=id=>P().edges.find(e=>e.id===id);", ctx);
  vm.runInContext(get("js/model.js").match(/function hexA\(col,a\)\{[^\n]*\n[^\n]*/)[0], ctx);   // hexA, del kernel, sin cargar model.js entero
  vm.runInContext(get("js/geometry.js"), ctx);
  vm.runInContext(get("js/skin.js"), ctx);
  vm.runInContext(get("js/render.js"), ctx);
  vm.runInContext(exportFns(get("js/export.js")), ctx);
  /* lienzo que apunta qué estilos se asignan (fillStyle/strokeStyle) y absorbe todo lo demás */
  vm.runInContext(`function recorder(){ const log=[]; const target={log};
    return new Proxy(target,{ get:(t,k)=>k in t? t[k] : (()=>{}), set:(t,k,v)=>{ if(k==="fillStyle"||k==="strokeStyle") log.push(k[0]+":"+v); t[k]=v; return true; } }); }`, ctx);
  return ctx;
}
const NOW = ctxFrom(read), OLD = ctxFrom(before);
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const PALETTE0 = run(NOW, "PALETTE[0].c");
const THEMES = ["dark", "crema", "claro"];
const kOf = (theme) => theme === "crema" ? 0.16 : 0.18;

/* la regla, escrita aquí */
function rule(c, k) {
  const m = typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c.trim()); if (!m) return null;
  const s = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1], v = parseInt(s.slice(0, 6), 16);
  return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${s.length === 8 ? Math.round(k * parseInt(s.slice(6), 16) / 255 * 1e4) / 1e4 : k})`;
}
/* barrido con semilla de #rrggbb (mitad en mayúsculas) */
function sweep(n) { let s = 0x5eed; const out = []; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const h = "#" + (s & 0xffffff).toString(16).padStart(6, "0"); out.push(i % 2 ? h.toUpperCase() : h); } return out; }
function corpusColors() {
  const out = new Set();
  for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".fluyo.json")))
    for (const pg of JSON.parse(read(dir + "/" + f)).doc.pages) for (const n of pg.nodes) if (n.color != null) out.add(n.color);
  return [...out];
}
const HEX6 = [...new Set([...run(NOW, "PALETTE.map(p=>p.c)"), "#857F6C", "#000000", "#ffffff", "#FFFFFF", ...corpusColors(), ...sweep(400)])];

test("colorTint · tabla escrita a mano (k = 0,16 y 0,18)", () => {
  const T = [
    ["#7fa66b", 0.16, "rgba(127,166,107,0.16)"], ["#7FA66B", 0.18, "rgba(127,166,107,0.18)"],
    ["#abc", 0.16, "rgba(170,187,204,0.16)"], ["#ABC", 0.18, "rgba(170,187,204,0.18)"],
    ["#7fa66b80", 0.16, "rgba(127,166,107,0.0803)"], ["#7fa66b80", 0.18, "rgba(127,166,107,0.0904)"],
    ["#7FA66BCC", 0.16, "rgba(127,166,107,0.128)"], ["#7fa66bff", 0.16, "rgba(127,166,107,0.16)"], ["#7fa66bff", 0.18, "rgba(127,166,107,0.18)"],
    ["#7fa66b00", 0.16, "rgba(127,166,107,0)"], ["#00000001", 0.16, "rgba(0,0,0,0.0006)"], ["#00000001", 0.18, "rgba(0,0,0,0.0007)"],
    [" #d08b5b80 ", 0.16, "rgba(208,139,91,0.0803)"], ["#7fa66b80", 0.2, "rgba(127,166,107,0.1004)"], ["#7fa66b80", 0.15, "rgba(127,166,107,0.0753)"],
  ];
  for (const [c, k, want] of T) assert.equal(run(NOW, "colorTint(__a.c, __a.k)", { c, k }), want, `${JSON.stringify(c)} · ${k}`);
  for (const c of ["red", "rgb(1,2,3)", "#12345", "#abcd", "#7fa66b8", "#7fa66b80f", "#gggggg", "#", "", " ", "7fa66b", "#d08b5bcc #"])
    assert.equal(run(NOW, "colorTint(__a, 0.16)", c), null, JSON.stringify(c));
  for (const c of [null, undefined, 1, true, {}, []]) { NOW.__c = c; assert.equal(vm.runInContext("colorTint(__c, 0.16)", NOW), null, String(c)); }
});

test("colorTint · = la regla escrita = el fixture compartido con fluyo-mcp", () => {
  assert.ok(GOLDEN.tints.length >= 60, "casos del fixture: " + GOLDEN.tints.length);
  for (const t of GOLDEN.tints) {
    assert.equal(run(NOW, "colorTint(__a.color, __a.k)", t), t.tint, `${JSON.stringify(t.color)} · ${t.k}`);
    assert.equal(rule(t.color, t.k), t.tint, `regla escrita: ${JSON.stringify(t.color)} · ${t.k}`);
  }
  for (const c of [...HEX6.slice(0, 60), "#abc", "#7fa66b80", "#AABBCCEE"]) for (const k of [0.16, 0.18, 0.2, 0.15]) assert.equal(run(NOW, "colorTint(__a.c, __a.k)", { c, k }), rule(c, k), c);
});

test("identidad · para todo #rrggbb, fillFor, svgFillColor, svgNodeFill y codeColors dan el string de " + BEFORE, () => {
  let n = 0;
  for (const theme of THEMES) for (const color of HEX6) {
    const node = { id: 1, shape: "rect", x: 0, y: 0, w: 160, h: 80, color, fill: null }, code = { ...node, shape: "code", label: "SELECT 1" };
    for (const [expr, arg] of [["fillFor(__a.n, __a.t)", node], ["svgFillColor(__a.n.color, __a.t)", node], ["svgNodeFill(__a.n, __a.t)", node], ["codeColors(__a.n, __a.t)", code]]) {
      assert.deepEqual(run(NOW, expr, { n: arg, t: theme }), run(OLD, expr, { n: arg, t: theme }), `${expr} ${color} ${theme}`); n++;
    }
  }
  assert.ok(n > 4000, "comparaciones: " + n);
});

test("identidad · drawAnim (spinner, progress, ticket) asigna los mismos estilos que " + BEFORE + " para todo #rrggbb", () => {
  let n = 0;
  for (const anim of ["spinner", "progress", "ticket"]) for (const color of HEX6) for (const t of [0, 0.3]) {
    const draw = `(()=>{ const c=recorder(); drawAnim(c, {id:1, shape:"anim", anim:${JSON.stringify(anim)}, x:100, y:100, w:120, h:100, label:"", color:__a}, ${t}, "crema", 0); return c.log; })()`;
    const a = run(NOW, draw, color), b = run(OLD, draw, color);
    assert.ok(a.length >= 2, anim + ": la pista se pinta"); assert.deepEqual(a, b, `${anim} ${color} t=${t}`); n++;
  }
  assert.ok(n > 1000, "comparaciones: " + n);
});

test("usuarios · #rgb, #rrggbbaa y espacios tiñen con colorTint; ilegible → PALETTE[0] (relleno, SVG, pista) o fondo del tema (code)", () => {
  for (const theme of THEMES) {
    const k = kOf(theme);
    for (const color of ["#abc", "#7fa66b80", "#7FA66BCC", "#7fa66b00", " #d08b5b80 ", "#aabbcc80"]) {
      const node = { id: 1, shape: "circle", x: 0, y: 0, w: 120, h: 120, color, fill: null };
      assert.equal(run(NOW, "fillFor(__a.n, __a.t)", { n: node, t: theme }), rule(color, k), `fillFor ${color} ${theme}`);
      assert.equal(run(NOW, "svgNodeFill(__a.n, __a.t)", { n: node, t: theme }), rule(color, k), `svgNodeFill ${color} ${theme}`);
      assert.equal(run(NOW, "codeColors(__a.n, __a.t).panel", { n: { ...node, shape: "code", label: "x" }, t: theme }), rule(color, k), `code ${color} ${theme}`);
    }
    for (const color of ["red", "#12345", "", "rgb(1,2,3)", "#abcd"]) {
      const node = { id: 1, shape: "diamond", x: 0, y: 0, w: 140, h: 110, color, fill: null };
      assert.equal(run(NOW, "fillFor(__a.n, __a.t)", { n: node, t: theme }), rule(PALETTE0, k), `fillFor ${JSON.stringify(color)} ${theme}: PALETTE[0]`);
      assert.equal(run(NOW, "svgNodeFill(__a.n, __a.t)", { n: node, t: theme }), rule(PALETTE0, k), `svgNodeFill ${JSON.stringify(color)} ${theme}: PALETTE[0]`);
      assert.equal(run(NOW, "codeColors(__a.n, __a.t).panel", { n: { ...node, shape: "code", label: "x" }, t: theme }), run(NOW, "THEMES[__a].lblBg", theme), `code ${JSON.stringify(color)} ${theme}: el fondo del tema`);
    }
    /* lo explícito sigue mandando, sin pasar por el tinte */
    assert.equal(run(NOW, "fillFor(__a.n, __a.t)", { n: { color: "#7fa66b80", fill: "#ffffff80" }, t: theme }), "#ffffff80");
    assert.equal(run(NOW, "fillFor(__a.n, __a.t)", { n: { color: "#7fa66b80", fill: "none" }, t: theme }), null);
  }
  /* la pista de las animaciones: el mismo tinte (0,2 y 0,15); el trazo sigue siendo el color tal cual (nativo) */
  const log = (anim, color) => run(NOW, `(()=>{ const c=recorder(); drawAnim(c, {id:1, shape:"anim", anim:${JSON.stringify(anim)}, x:100, y:100, w:120, h:100, label:"", color:__a}, 0.3, "crema", 0); return c.log; })()`, color);
  assert.deepEqual(log("spinner", "#7fa66b80").slice(0, 2), ["s:" + rule("#7fa66b80", 0.2), "s:#7fa66b80"]);
  assert.ok(log("progress", "#abc").includes("f:" + rule("#abc", 0.2)), "progress #abc");
  assert.ok(log("ticket", "#7fa66b80").includes("f:" + rule("#7fa66b80", 0.15)), "ticket #7fa66b80");
  assert.ok(log("progress", "red").includes("f:" + rule(PALETTE0, 0.2)), "progress «red»: PALETTE[0]");
});

test("antes de 019.5 (" + BEFORE + ") · el defecto: #rrggbbaa, #rgb e ilegibles con los canales desplazados", () => {
  const f = (color) => run(OLD, 'fillFor(__a, "crema")', { color, fill: null });
  assert.equal(f("#7fa66b80"), "rgba(166,107,128,0.16)", "#7fa66b80 salía rosa");
  assert.equal(f("#d08b5bcc"), "rgba(139,91,204,0.16)", "#d08b5bcc salía lavanda");
  assert.equal(f("#abc"), "rgba(0,10,188,0.16)", "#abc salía azul");
  assert.equal(f("red"), "rgba(0,0,237,0.16)", "«red» salía azul");
  assert.equal(run(OLD, 'codeColors(__a, "dark").panel', { shape: "code", label: "x", color: "#7fa66b80" }), "#161616", "code #rrggbbaa sin tinte");
});

test("guarda · hexA (kernel) solo recibe constantes y colores de evento ya normalizados; ningún otro lector de 6 dígitos", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const r = strip(read("js/render.js")), e = strip(read("js/export.js")), g = strip(read("js/geometry.js"));
  const calls = [...r.matchAll(/hexA\(([^)]*)\)/g), ...e.matchAll(/hexA\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, ""));
  assert.deepEqual(calls.sort(), ["FLOW_ACCENT,0", "FLOW_ACCENT,a", "col,0.92", "fx.fillColor,0.38"].sort());
  assert.match(r, /function drawNodeCueMessage\(c, m, fx\)\{\n  const col = fx\.messageColor \|\| "#d0576a";/, "hexA(col, …) es el mensaje del evento");
  const md = read("js/model.js");
  assert.match(md, /if\(typeof effects\.messageColor==="string" && \/\^#\[0-9a-fA-F\]\{6\}\$\/\.test\(effects\.messageColor\)\)/);
  assert.match(md, /if\(typeof effects\.fillColor==="string" && \/\^#\[0-9a-fA-F\]\{6\}\$\/\.test\(effects\.fillColor\)\)/);
  assert.ok(!/colHex/.test(r + e + g), "colHex ya no existe: el respaldo vive en nodeTint");
  assert.ok(!/parseInt\([^)]*\.slice\(1\)/.test(r + e), "render.js/export.js: ningún parseInt(…slice(1)) de color");
  assert.equal((g.match(/parseInt\(/g) || []).length, 2, "geometry.js: solo los dos parseInt de colorTint");
  assert.match(r, /function fillFor\(n,theme\)\{\n  if\(n\.fill==="none"\) return null;\n  if\(n\.fill\) return n\.fill;\n  return nodeTint\(n\.color, theme==="crema"\?\.16:\.18\);\n\}/);
  assert.match(e, /function svgFillColor\(hex, theme\)\{ return nodeTint\(hex, theme==="crema"\?\.16:\.18\); \}/);
  assert.match(g, /function codePanelTint\(color,theme\)\{ return colorTint\(color, theme==="crema"\?\.16:\.18\); \}/);
  assert.equal((r.match(/nodeTint\(col,\.2\)/g) || []).length, 2); assert.equal((r.match(/nodeTint\(col,\.15\)/g) || []).length, 1);
});

test("alcance · kernel (model, config, motor, playback, integridad, autoría), skin.js y Viewer idénticos a " + BEFORE + "; solo geometry/render/export y sw.js v88", () => {
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js",
    "js/story-authoring.js", "js/skin.js", "js/viewer.js", "s/index.html", "index.html"]) assert.equal(read(f), before(f), f + " idéntico a " + BEFORE);
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BEFORE, "--", "js", "s", "css", "index.html", "sw.js", "manifest.webmanifest"], { encoding: "utf8" })
    .split("\n").filter(Boolean).sort();
  /* FLUYO-019-HIT-TEST cambia a propósito editor-scenarios.js e interaction.js (acierto, puerto y foco): su alcance lo vigila test/fluyo-019-hit-test.test.cjs */
  assert.deepEqual(changed, ["js/editor-scenarios.js", "js/export.js", "js/geometry.js", "js/interaction.js", "js/render.js", "sw.js"]);
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v115";/);
  for (const f of ["./js/geometry.js", "./js/render.js", "./js/export.js"]) assert.ok(read("sw.js").includes(`"${f}"`) || read("sw.js").includes(`'${f}'`) || read("sw.js").includes(f.slice(1)), "precacheado: " + f);
});
