"use strict";
/* FLUYO-018.13 — Base visual: comprobaciones estáticas (rápidas, sin navegador).
   · Tipografías locales: woff2 + licencia OFL en el repo, @font-face con URL de este origen, cero fuentes de terceros.
   · Service worker: CACHE v72 y system.css + fuentes en el precache (index.html sigue entero precacheado).
   · Sistema: los tokens viven en css/system.css y styles.css no reintroduce el chrome oscuro ni colores sueltos de estado.
   · Iconos: cada <use href="#i-…"> tiene su símbolo; los controles migrados ya no llevan emoji ni glifos como icono.
   · Alcance: model.js, config.js e identity.css (Viewer) no cambian respecto a HEAD; las marcas del editor no salen en
     el Viewer ni en la exportación (se dibujan solo con selección). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const FONTS = ["ibm-plex-mono-latin-400.woff2", "ibm-plex-mono-latin-500.woff2", "playfair-display-latin-400.woff2"];

test("tipografías: woff2 locales, licencia OFL incluida y @font-face sin terceros", () => {
  for (const f of FONTS) {
    const b = fs.readFileSync(path.join(root, "assets/fonts", f));
    assert.equal(b.subarray(0, 4).toString("latin1"), "wOF2", f + " es WOFF2");
    assert.ok(b.length > 8000 && b.length < 60000, f + " es un subset razonable (" + b.length + " B)");
  }
  for (const l of ["OFL-ibm-plex-mono.txt", "OFL-playfair-display.txt"]) assert.match(read("assets/fonts/" + l), /SIL Open Font License/, l);
  const sys = read("css/system.css");
  const srcs = [...sys.matchAll(/src:url\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(srcs.map((s) => s.replace("../assets/fonts/", "")).sort(), [...FONTS].sort(), "un @font-face por archivo, todos en assets/fonts");
  /* el subset latin cubre el español: ñ, tildes, ¿¡ y «» están en U+00A0–00FF; — y … en U+2000–206F */
  for (const m of sys.matchAll(/unicode-range:([^;]+);/g)) assert.match(m[1], /U\+0000-00FF.*U\+2000-206F/);
  for (const f of ["index.html", "css/system.css", "css/styles.css", "css/identity.css"]) {
    assert.ok(!/fonts\.googleapis|fonts\.gstatic|use\.typekit|fonts\.bunny/i.test(read(f)), f + " no pide fuentes a terceros");
  }
  assert.match(read("index.html"), /<link rel="preload" href="assets\/fonts\/ibm-plex-mono-latin-400\.woff2" as="font" type="font\/woff2" crossorigin>/);
});

test("sw.js: CACHE v72, system.css y las tres fuentes precacheadas; nada de index.html queda fuera", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v75";/);
  const core = sw.slice(sw.indexOf("const ASSETS"), sw.indexOf("const PAGE_ASSETS"));
  for (const a of ["./css/system.css", ...FONTS.map((f) => "./assets/fonts/" + f)]) assert.ok(core.includes('"' + a + '"'), a + " en ASSETS (núcleo)");
  const html = read("index.html");
  const local = [...html.matchAll(/(?:src|href)="((?:css|js|assets)\/[^"#?]+)"/g)].map((m) => "./" + m[1]);
  for (const a of local) assert.ok(core.includes('"' + a + '"'), a + " (cargado por index.html) está precacheado");
});

test("index.html carga el sistema entre identity.css y styles.css", () => {
  const html = read("index.html");
  const i = html.indexOf('href="css/identity.css"'), s = html.indexOf('href="css/system.css"'), st = html.indexOf('href="css/styles.css"');
  assert.ok(i > 0 && i < s && s < st, "orden identity → system → styles");
  /* Desde FLUYO-018.14a el Viewer también carga system.css (lo afirma test/fluyo-018-14a.test.cjs). */
});

test("tokens: la paleta vive en system.css; styles.css no vuelve al chrome oscuro ni a colores de estado sueltos", () => {
  const sys = read("css/system.css");
  for (const [k, v] of [["--c-hueso", "#F2EDE3"], ["--c-tinta", "#16150F"], ["--c-oliva", "#4E5A3F"], ["--c-terracota", "#A33A22"]]) {
    assert.match(sys, new RegExp(k + ":" + v + ";"), k);
  }
  for (const k of ["--surface", "--surface-raised", "--ink", "--ink-3", "--rule", "--rule-2", "--active", "--attention", "--font-serif", "--font-mono", "--ctl-h", "--ctl-h-touch", "--r-sm", "--shadow-menu"]) {
    assert.ok(new RegExp("\\s" + k + ":").test(sys), k + " definido");
  }
  assert.match(sys, /--font-serif:"Playfair Display"/); assert.match(sys, /--font-mono:"IBM Plex Mono"/);
  /* los nombres de identity.css que usa el resto del CSS quedan mapeados al sistema */
  for (const k of ["--bg", "--panel", "--panel2", "--line", "--text", "--muted", "--accent"]) assert.match(sys, new RegExp(k + ":var\\(--"), k + " → token");
  const st = read("css/styles.css");
  assert.ok(!/#111213|#1b1d1f|#222527|#3a3326|#2c2620|#e08585|#7bb85b|#e5706a/i.test(st), "sin los colores del chrome oscuro ni de estado sueltos");
  assert.ok(!/Georgia/.test(st) && !/Georgia/.test(sys), "Georgia ya no es la serif de la UI");
  /* el componente de menú es uno: «Más», el menú de página y los de Historias comparten material */
  assert.match(sys, /\.menu, \.scPopover, \.moreMenu\{/);
});

test("iconos: sprite único; cada <use> resuelve; los controles migrados no llevan emoji ni glifos como icono", () => {
  const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
  const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const uses = [...html.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(uses.length >= 30, "la UI usa el sprite (" + uses.length + ")");
  for (const u of uses) assert.ok(symbols.has(u), "#" + u + " existe");
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{23E9}-\u{23FA}\u{FF0B}\u{FF0D}]/u;
  for (const id of ["btnJsonOut", "btnJsonIn", "btnExport", "btnPresent", "btnShare", "btnEyedrop", "btnFront", "btnBack", "btnForward", "btnBackward", "btnPlay", "btnDel", "tbConnect", "tbMulti", "tbDone", "tbCancel", "btnStories"]) {
    const m = html.match(new RegExp('<button id="' + id + '"[^>]*>([\\s\\S]*?)</button>'));
    assert.ok(m, id);
    const text = m[1].replace(/<[^>]+>/g, "");
    assert.ok(!EMOJI.test(text), id + " sin emoji/glifo de icono: «" + text.trim() + "»");
    assert.match(m[1], /<use href="#i-/, id + " lleva icono del sprite");
  }
  /* togglePlay cambia la palabra, no el icono (lo decide la clase .toggled) */
  const ui = read("js/ui.js");
  assert.ok(!/⏸|▶ Play/.test(ui.slice(ui.indexOf("function togglePlay"), ui.indexOf("$(\"btnPlay\").onclick"))), "togglePlay sin glifos");
});

test("cabecera: barra agrupada con filetes; enlaces y Open Source en «Más» por secciones; ids de 018.12 intactos", () => {
  const html = read("index.html");
  const header = html.slice(html.indexOf("<header>"), html.indexOf("</header>"));
  /* FLUYO-018.14b: tres zonas (marca · historial | modo ··· Lienzo | salida); Archivo vive en «Más» y el lienzo en «Lienzo ▾» */
  assert.equal((header.match(/class="vdivider hdrDiv/g) || []).length, 3, "tres filetes de grupo");
  assert.match(header, /class="menuKicker hdrKicker kDoc">Archivo</); assert.match(header, /class="menuKicker kCanvas">Lienzo · este documento</);
  for (const id of ["btnUndo", "btnRedo", "hdrTools", "btnDemo", "btnClear", "themeSel", "fontGlobalSel", "chkGrid", "chkSnap", "bgCustom", "btnBgClear", "btnJsonOut", "btnJsonIn", "btnPresent", "btnShare", "btnExport", "btnPanel", "btnMore", "moreMenu", "moreTools", "siteLinks"]) {
    assert.equal((html.match(new RegExp('id="' + id + '"', "g")) || []).length, 1, id + " una vez");
  }
  const menu = header.slice(header.indexOf('id="moreMenu"'));
  assert.equal((menu.match(/<a class="menuItem/g) || []).length, 6, "Docs, Ejemplos, Privacidad, Soporte y los dos repos son ítems de menú");
  /* sin marca ajena dentro de Fluyo */
  assert.ok(!/NECT/.test(html.replace(/itsnect/g, "")), "sin branding NECT en la UI");
});

/* config.js cambia en FLUYO-018.14a (FONTS y THEMES.code*): su diff exacto lo vigila test/fluyo-018-14a.test.cjs. */
/* FLUYO-018.15 cambió model.js en un solo punto (el color con el que nace un nodo y el comentario del respaldo
   histórico; su diff exacto lo fija fluyo-018-15.test.cjs). Se deshace aquí para seguir vigilando todo lo demás. */
const undo15 = (s) => s.replace("color:DEFAULT_NODE_COLOR, fill:null", "color:PALETTE[0].c, fill:null").replace(/  \/\* Respaldo HISTÓRICO[\s\S]*?MCP\. \*\/\n/, "");
test("alcance: model.js e identity.css idénticos a HEAD", () => {
  /* FLUYO_GIT_ROOT: las mutaciones corren sobre una copia sin .git y comparan con el HEAD del repo real */
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "css/identity.css"]) {
    const head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    assert.equal(undo15(read(f).replace(/\r\n/g, "\n")), head, f + " sin cambios");
  }
});

test("render.js: las marcas del editor son oliva por tema y solo se piden con selección (Viewer y exportación no las ven)", () => {
  const r = read("js/render.js");
  const marks = r.slice(r.indexOf("const EDITOR_MARK"), r.indexOf("function editorMark"));
  assert.match(marks, /dark\s*:\{ink:"#C3CDA4"/); assert.match(marks, /crema:\{ink:"#4E5A3F"/); assert.match(marks, /claro:\{ink:"#4E5A3F"/);
  assert.ok(!/3aa7e8|58,167,232/.test(marks));
  assert.match(r, /const M=\(seld\|\|single\)\? editorMark\(theme\) : null;/, "drawEdge solo calcula marcas con selección");
  const sel = r.slice(r.indexOf("if(!isExport && rs.selection.nodes.has(n.id)){"), r.indexOf("/* Medidor de etiquetas"));
  assert.ok(sel.includes("editorMark(theme)") && !/3aa7e8/.test(sel), "selección de nodo con la marca del sistema");
  /* el dibujo del diagrama no cambia: radio 10 de las cajas y trazo 2.5 siguen siendo los de SVG/Viewer */
  assert.match(r, /default: roundRect\(c,x-w\/2,y-h\/2,w,h,10\);/);
  assert.match(r, /c\.strokeStyle=n\.color; c\.lineWidth=2\.5\+glow\*1\.5;/);
});
