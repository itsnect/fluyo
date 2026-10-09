"use strict";
/* FLUYO-018.14a — Viewer, tipografía, nodos `code` y BD: comprobaciones estáticas y en vm (sin navegador).
   · Contrato FONTS: Playfair Display e IBM Plex Mono entre las históricas y «Mono»; primera (global por defecto) y
     última (reserva de `code`) intactas; el resto de config.js idéntico a HEAD salvo THEMES.code*.
   · Documentos existentes: la global histórica se conserva; la nueva se acepta; una desconocida sigue cayendo a Georgia.
   · `code`: respaldos del sistema (panel teñido, velo, oliva sin caja, Plex Mono) y lo explícito del nodo manda.
   · Cilindro: UNA geometría (cylinderSegments) con arcos reales, tapa una vez, laterales tangentes; lienzo, shapePath
     y SVG la usan, sin Bézier ni segunda elipse.
   · Fuentes: el Viewer y la exportación rasterizada esperan a las del documento antes de pintar.
   · Viewer: system.css cargado, CSP intacta (sin style inline), iconos del sprite. model.js idéntico a HEAD. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const head = (f) => execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" });
const J = (v) => JSON.parse(JSON.stringify(v));
const PLEX = `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`;
const PLAYFAIR = "'Playfair Display', Georgia, serif";

function configOf(src) {
  const ctx = vm.createContext({});
  vm.runInContext(src + "\n;globalThis.__c={W,H,GRID,PALETTE,EVENT_SWATCHES,SWATCH_COLORS,THEMES,DIR,SIDES,FONTS,DEFAULT_FONT,DEFAULT_SIZES,CODE_ADV,CODE_LANGS,DEFAULT_LANG,CODE_DEFAULT_LABEL,iconKeys:Object.keys(ICONS),animKeys:Object.keys(ANIMS)};", ctx);
  return J(ctx.__c);
}
/* config.js + geometry.js con los globales mínimos que geometry espera (como el arnés de fluyo-mcp). */
function geometry() {
  const ctx = vm.createContext({ doc: { pages: [], cur: 0 }, lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.min(b, Math.max(a, v)) });
  vm.runInContext(read("js/config.js"), ctx);
  vm.runInContext("P=()=>doc.pages[doc.cur]; nodeById=id=>P().nodes.find(n=>n.id===id);", ctx);
  vm.runInContext(read("js/geometry.js"), ctx);
  return { ctx, run: (code) => J(vm.runInContext(code, ctx)) };
}

test("FONTS: las dos voces nuevas entre las históricas y «Mono»; primera, última y global por defecto intactas", () => {
  const now = configOf(read("js/config.js")), old = configOf(head("js/config.js"));
  assert.equal(now.FONTS.length, old.FONTS.length + 2);
  assert.deepEqual(now.FONTS.filter((f) => !["Playfair Display", "IBM Plex Mono"].includes(f.n)), old.FONTS, "las 12 históricas, en su orden y con sus pilas");
  assert.deepEqual(now.FONTS.slice(-3).map((f) => f.n), ["Playfair Display", "IBM Plex Mono", "Mono"]);
  assert.equal(now.FONTS.find((f) => f.n === "Playfair Display").f, PLAYFAIR, "pila exacta (termina en Georgia)");
  assert.equal(now.FONTS.find((f) => f.n === "IBM Plex Mono").f, PLEX, "pila exacta (termina en la pila «Mono»)");
  assert.ok(PLEX.endsWith(old.FONTS[old.FONTS.length - 1].f), "la reserva de Plex es la pila «Mono» histórica");
  assert.equal(now.DEFAULT_FONT, old.DEFAULT_FONT, "la global por defecto sigue siendo Georgia");
  assert.equal(now.FONTS[now.FONTS.length - 1].f, old.FONTS[old.FONTS.length - 1].f, "la última entrada sigue siendo «Mono»");
});

test("config.js: fuera de FONTS solo cambian los respaldos code* de THEMES", () => {
  const now = configOf(read("js/config.js")), old = configOf(head("js/config.js"));
  for (const k of Object.keys(old)) {
    if (k === "FONTS" || k === "THEMES") continue;
    assert.deepEqual(now[k], old[k], k + " sin cambios");
  }
  for (const t of Object.keys(old.THEMES)) {
    const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("code")));
    assert.deepEqual(strip(now.THEMES[t]), strip(old.THEMES[t]), t + ": fondo, rejilla, texto y aristas sin cambios");
    assert.equal(now.THEMES[t].codeKwBg, "", t + ": palabra clave sin caja por defecto");
    assert.ok(!/a8b34a|101010/i.test(JSON.stringify(now.THEMES[t])), t + ": ni caja verde ni bloque negro");
  }
  assert.deepEqual([now.THEMES.dark.codeText, now.THEMES.dark.codeKwText, now.THEMES.crema.codeKwText, now.THEMES.claro.codeKwText], ["#e8e1d3", "#c3cda4", "#4e5a3f", "#4e5a3f"], "hueso/oliva pálido en oscuro, oliva en crema y claro");
});

/* FLUYO-018.15 cambió model.js en un solo punto (el color con el que nace un nodo y el comentario del respaldo
   histórico; su diff exacto lo fija fluyo-018-15.test.cjs). Se deshace aquí para seguir vigilando todo lo demás. */
const undo15 = (s) => s.replace("color:DEFAULT_NODE_COLOR, fill:null", "color:PALETTE[0].c, fill:null").replace(/  \/\* Respaldo HISTÓRICO[\s\S]*?MCP\. \*\/\n/, "");
test("model.js idéntico a HEAD (no hay migración ni cambio de formato)", () => {
  assert.equal(undo15(read("js/model.js").replace(/\r\n/g, "\n")), head("js/model.js").replace(/\r\n/g, "\n"));
});

test("documentos: la global histórica se conserva, la nueva se acepta y una desconocida cae a Georgia como siempre", () => {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of ["config.js", "safe-svg.js", "model.js"]) vm.runInContext(read("js/" + f), ctx, { filename: f });
  const norm = (font) => J(vm.runInContext(`settingsFromProjectData(${JSON.stringify({ font })}).font`, ctx));
  assert.equal(norm("Georgia, serif"), "Georgia, serif");
  assert.equal(norm("'Comic Sans MS', 'Comic Sans', cursive"), "'Comic Sans MS', 'Comic Sans', cursive");
  assert.equal(norm('ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'), 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace');
  assert.equal(norm(PLAYFAIR), PLAYFAIR, "Playfair Display como global");
  assert.equal(norm(PLEX), PLEX, "IBM Plex Mono como global");
  assert.equal(norm("'Fuente Inventada', serif"), "Georgia, serif", "desconocida → la global por defecto (comportamiento de siempre)");
  assert.equal(norm(undefined), "Georgia, serif");
});

test("code: respaldos del sistema por tema y lo explícito del nodo manda", () => {
  const g = geometry();
  const n = (o) => JSON.stringify({ id: 1, shape: "code", x: 0, y: 0, w: 300, h: 150, label: "SELECT a", color: "#6a9fb5", bold: false, ...o });
  const col = (o, t) => g.run(`codeColors(${n(o)}, ${JSON.stringify(t)})`);
  assert.deepEqual(col({}, "dark"), { panel: "rgba(106,159,181,0.18)", paper: "rgba(0,0,0,.32)", text: "#e8e1d3", kwBg: "", kwText: "#c3cda4" });
  assert.deepEqual(col({}, "crema"), { panel: "rgba(106,159,181,0.16)", paper: "rgba(22,21,15,.055)", text: "#16150f", kwBg: "", kwText: "#4e5a3f" });
  assert.deepEqual(col({}, "claro"), { panel: "rgba(106,159,181,0.18)", paper: "rgba(22,21,15,.045)", text: "#16150f", kwBg: "", kwText: "#4e5a3f" });
  const exp = col({ fill: "#112233", textBg: "#000000", textColor: "#ff0000", kwBg: "#a8b34a", kwColor: "#123456" }, "dark");
  assert.deepEqual(exp, { panel: "#112233", paper: "#000000", text: "#ff0000", kwBg: "#a8b34a", kwText: "#123456" }, "cada valor explícito gana");
  assert.equal(col({ fill: "none" }, "dark").panel, "#161616", "fill:none conserva el fondo del tema (como antes)");
  assert.equal(col({ color: "#abc" }, "dark").panel, "#161616", "color no hex de 6: el respaldo de siempre");
  /* tipografía y peso */
  assert.equal(g.run(`codeFont(${n({ font: null })})`), PLEX, "sin font propio: IBM Plex Mono");
  assert.equal(g.run(`codeFont(${n({ font: "Georgia, serif" })})`), "Georgia, serif", "font explícito: se respeta");
  assert.deepEqual([g.run(`codeTokenWeight(${n({})}, true)`), g.run(`codeTokenWeight(${n({})}, false)`)], [500, 400]);
  assert.deepEqual([g.run(`codeTokenWeight(${n({ bold: true })}, true)`), g.run(`codeTokenWeight(${n({ bold: true })}, false)`)], [700, 700], "negrita del nodo: 700 en todo");
  /* la maquetación no cambia: mismos números que la rejilla CODE_ADV */
  const L = g.run(`codeBlockLayout(${n({ label: "SELECT nombre FROM t" })})`);
  assert.ok(L.rows[0].tokens.every((t) => Math.abs(t.w - t.t.length * L.adv) < 1e-9));
});

test("cilindro: una geometría con arcos reales, tapa una vez, laterales tangentes", () => {
  const g = geometry();
  for (const [w, h] of [[150, 90], [60, 40], [400, 300], [150, 20]]) {
    const node = JSON.stringify({ x: 10, y: 20, w, h });
    const s = g.run(`cylinderSegments(${node})`), ry = Math.min(16, h * .18), top = 20 - h / 2, bot = 20 + h / 2;
    const [m, l1, a1, l2, a2, z] = s.outline;
    assert.deepEqual([m.op, l1.op, a1.op, l2.op, a2.op, z.op], ["M", "L", "A", "L", "A", "Z"]);
    assert.deepEqual([m.x, m.y, l1.x, l1.y], [10 - w / 2, top + ry, 10 - w / 2, bot - ry], "lateral izquierdo vertical desde el ecuador de la tapa");
    assert.deepEqual([l2.x, l2.y], [10 + w / 2, top + ry], "lateral derecho vertical hasta el ecuador de la tapa");
    /* tangencia: en a=0 y a=π la derivada de la elipse (−rx·sin a, ry·cos a) es vertical */
    for (const a of [a1.a0, a1.a1, a2.a0, a2.a1]) assert.ok(Math.abs(Math.sin(a)) < 1e-12, "los arcos empiezan y acaban donde la tangente es vertical");
    assert.deepEqual([a1.cy, a1.ry, a1.rx, a1.ccw], [bot - ry, ry, w / 2, true], "base: media elipse inferior (frente)");
    assert.deepEqual([a2.cy, a2.ccw], [top + ry, true], "tapa trasera: media elipse superior");
    assert.equal(s.lip.length, 2); assert.deepEqual([s.lip[1].cy, s.lip[1].ccw], [top + ry, false], "labio: la otra mitad de la MISMA elipse");
    const d = g.run(`segmentsToSVGPath(cylinderSegments(${node}).outline)`) + " | " + g.run(`segmentsToSVGPath(cylinderSegments(${node}).lip)`);
    assert.equal((d.match(/ A /g) || []).length + (d.startsWith("A ") ? 1 : 0), 3, "tres arcos: base, tapa trasera y labio");
    assert.ok(!/ C /.test(d), "sin Bézier");
  }
});

test("lienzo, shapePath y SVG usan la geometría compartida (sin Bézier de 0,8 ni segunda elipse)", () => {
  const r = read("js/render.js"), e = read("js/export.js");
  const cyl = r.slice(r.indexOf('else if(n.shape==="cylinder"){'), r.indexOf('else if(n.shape==="text"){'));
  assert.match(cyl, /cylinderSegments\(n\)/); assert.ok(!/bezierCurveTo|ellipse\(/.test(cyl), "el lienzo no construye el cilindro por su cuenta");
  assert.match(r, /case "cylinder": traceSegments\(c, cylinderSegments\(n\)\.outline\); break;/, "shapePath (resaltado de Historias) abraza el cilindro");
  const svg = e.slice(e.indexOf('case "cylinder":{'), e.indexOf('case "text":'));
  assert.match(svg, /segmentsToSVGPath\(seg\.outline\)/); assert.match(svg, /segmentsToSVGPath\(seg\.lip\)/);
  assert.ok(!/<ellipse| C \$/.test(svg), "el SVG no construye el cilindro por su cuenta");
  /* code: la caja de la palabra clave solo con kwBg; peso por token; fuente desde codeFont */
  const dc = r.slice(r.indexOf("function drawCodeNode"), r.indexOf("function colHex"));
  assert.match(dc, /if\(tk\.kw && col\.kwBg\)/); assert.match(dc, /codeTokenWeight\(n,tk\.kw\)/); assert.match(dc, /codeFont\(n\)/);
  const sc = e.slice(e.indexOf('case "code":{'), e.indexOf('case "anim":{'));
  assert.match(sc, /if\(tk\.kw && col\.kwBg\)/); assert.match(sc, /codeTokenWeight\(n,tk\.kw\)/);
});

test("fuentes: la exportación rasterizada y el Viewer esperan a las del documento antes de pintar", () => {
  const r = read("js/render.js"), e = read("js/export.js"), v = read("js/viewer.js");
  assert.match(r, /function renderFontStacks\(d, st\)/); assert.match(r, /function waitForRenderFonts\(d, timeoutMs=2500, st\)/);
  assert.match(r, /if\(n\.shape==="code"\) out\.add\(codeFont\(n\)\)/, "incluye la fuente del bloque code");
  assert.match(e, /waitForRenderFonts\(doc\)\.then\(\(\)=>\{ if\(fmt==="gif"\) exportGIF\(scale, tr\); else exportStatic\(fmt, scale, tr\); \}\);/);
  const boot = v.slice(v.indexOf("async function bootViewer"), v.indexOf("function centerClient"));
  const wait = boot.indexOf("await waitForRenderFonts("), first = boot.indexOf("renderViewerFrame();");
  assert.ok(wait > 0 && wait < first, "el Viewer espera antes del primer render");
});

test("Viewer: system.css y la mono precargada, CSP intacta (sin style inline), iconos del sprite", () => {
  const html = read("s/index.html");
  const i = html.indexOf('href="../css/identity.css"'), s = html.indexOf('href="../css/system.css"'), sh = html.indexOf('href="../css/share.css"');
  assert.ok(i > 0 && i < s && s < sh, "identity → system → share");
  assert.match(html, /<link rel="preload" href="\.\.\/assets\/fonts\/ibm-plex-mono-latin-400\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.match(html, /content="default-src 'self'; script-src 'self' https:\/\/cloud\.umami\.is; style-src 'self';/, "CSP sin cambios");
  assert.ok(!/\sstyle="/.test(html), "sin atributos style (la CSP los bloquearía)");
  const body = html.replace(/<!--[\s\S]*?-->/g, "");
  const symbols = new Set([...body.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const uses = [...body.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(uses.length >= 7); for (const u of uses) assert.ok(symbols.has(u), "#" + u);
  for (const id of ["btnFit", "btnZoomOut", "btnZoomIn", "btnPresent", "btnOpen", "prPrev", "prNext", "prExit", "stPlay", "stStop", "stOpen", "pgTabs", "story", "brand"]) assert.equal((html.match(new RegExp('id="' + id + '"', "g")) || []).length, 1, id);
  const css = read("css/share.css");
  assert.ok(!/#1b1d1f|#2c2620|#4a3d2c|#0008/i.test(css), "sin el chrome oscuro de antes");
  assert.match(css, /background:var\(--surface\)/);
});

test("sw.js: CACHE v72; lo que carga el Viewer está precacheado", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v75";/);
  const html = read("s/index.html");
  for (const m of html.matchAll(/(?:src|href)="\.\.\/((?:css|js|assets)\/[^"#?]+)"/g)) assert.ok(sw.includes('"./' + m[1] + '"'), m[1] + " precacheado");
});

test("docs y editor: el bloque code usa IBM Plex Mono por defecto; el selector agrupa sin cambiar valores", () => {
  assert.match(read("docs/index.html"), /que por defecto es <code>IBM Plex Mono<\/code>/);
  const ui = read("js/ui.js");
  assert.match(ui, /const SYSTEM_FONTS=\["Playfair Display","IBM Plex Mono"\];/);
  assert.match(ui, /o\.value=ft\.f; o\.textContent=ft\.n;/, "el valor de cada opción es la pila de FONTS");
});
