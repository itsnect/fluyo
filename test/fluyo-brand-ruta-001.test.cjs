"use strict";
/* FLUYO-BRAND-RUTA-001 — La marca Ruta es la identidad de Fluyo (decisión 325, sustituye a la 267). Referencia: .ai/referencias/logo-ruta/.
   · R1 marca: en las once cabeceras (editor, Viewer, docs, ejemplos, legales, soporte, 404) el mismo símbolo inline + «fluyo»; .still es
     svg/fluyo-simbolo.svg exacto y .loop la animación de codigo/logo-cabecera.html, ambos con los colores en tokens.
   · R2 favicon: el data URI de la referencia, exacto, en las once páginas.
   · R3 assets: logo.svg, iconos y og-image son los bytes de la referencia; manifest intacto.
   · R4 movimiento: keyframes y reglas del bucle tal cual la referencia (4.8 s), declarados SOLO con prefers-reduced-motion: no-preference.
   · R5 fijo: donde antes se ocultaban los puntos (móvil, 701–860 del editor, teléfono en apaisado) el símbolo fijo y el bucle sin animar.
   · R6 nada de la marca anterior; Playfair solo en la palabra; «Hecho con Fluyo» igual.
   · R7 decisión 325, la 267 marcada como sustituida, tarea.
   · C1 alcance frente a d7e1177 (git): solo estos archivos; undoRuta da la base EXACTA; sw.js solo CACHE v123; JS intacto.
   Lo visual (el bucle completo, móvil, tema oscuro, tamaños pequeños) lo prueba test/fluyo-brand-ruta-001-browser.cjs en Chrome. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const REF = ".ai/referencias/logo-ruta/";
const ref = (p) => read(REF + p);
const BASE = "d7e1177";

const PAGES = ["index.html", "s/index.html", "404.html", "docs/index.html", "ejemplos/index.html", "privacidad/index.html", "privacy/index.html",
  "terminos/index.html", "terms/index.html", "soporte/index.html", "support/index.html"];
const OPEN = { "index.html": '<span class="logo">', "s/index.html": '<a class="logo" href="../" title="Fluyo" aria-label="Fluyo">', "404.html": '<a class="logo" href="/">' };
const CLOSE = { "index.html": "</span>" };

/* El símbolo de la cabecera, construido desde la referencia: el fijo de svg/fluyo-simbolo.svg y el bucle de codigo/logo-cabecera.html,
   con la tinta en currentColor y el envío pintado por CSS (--attention). */
const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "").replace(/\n/g, "");
const STILL = inner(ref("svg/fluyo-simbolo.svg")).replace(/#16150f/g, "currentColor").replace(/ fill="#a33a22"/, "");
const LOOP = inner(ref("codigo/logo-cabecera.html")).replace(/ fill="var\(--attention\)"/, "").replace(/>\s+</g, "><").trim();
const SVG_OPEN = ref("codigo/logo-cabecera.html").match(/<svg [^>]*>/)[0];
const MARK = '<svg class="logoMark" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
  + `<g class="still">${STILL}</g><g class="loop">${LOOP}</g></svg><span class="logoWord" translate="no">fluyo</span>`;

test("R1 · marca: las once cabeceras llevan el símbolo Ruta (fijo exacto + bucle de la referencia) y «fluyo» (translate=no, decisión 305)", () => {
  assert.match(SVG_OPEN, /viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" class="logoMark" aria-hidden="true"/, "la referencia no cambió");
  assert.match(STILL, /^<rect x="6" y="8" width="16" height="16" rx="4" stroke="currentColor" stroke-width="3.5"\/><path d="M22 16 H36 V48 H42" stroke="currentColor" stroke-width="3.5"\/><rect x="42" y="40" width="16" height="16" rx="4" fill="currentColor"\/><circle cx="36" cy="32" r="5.5"\/>$/);
  assert.match(LOOP, /^<g class="pan"><g class="old">.*<circle class="tok" cx="0" cy="0" r="5.5"\/>$/);
  for (const f of PAGES) {
    const h = read(f);
    assert.equal((h.match(/class="logo"/g) || []).length, 1, f + ": una marca");
    const open = OPEN[f] || '<a class="logo" href="../">';
    assert.ok(h.includes(open + MARK + (CLOSE[f] || "</a>")), f + ": marcado de la marca Ruta");
    assert.equal((h.match(/<svg class="logoMark"/g) || []).length, 1, f);
  }
});

test("R2 · favicon: el data URI de la referencia, exacto y único, en las once páginas", () => {
  const icon = ref("svg/favicon-data-uri.txt").trim();
  assert.ok(icon.startsWith("data:image/svg+xml,") && icon.includes("%23a33a22"));
  for (const f of PAGES) {
    const links = [...read(f).matchAll(/<link rel="icon" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(links, [icon], f);
  }
});

test("R3 · assets: logo.svg, iconos PWA y og-image son los bytes de la referencia, con sus medidas; manifest con los mismos nombres y colores", () => {
  const bytes = (p) => fs.readFileSync(path.join(root, p));
  const same = (a, b) => bytes(a).toString("latin1").replace(/\r\n/g, "\n") === bytes(b).toString("latin1").replace(/\r\n/g, "\n");
  assert.ok(same("assets/logo.svg", REF + "svg/favicon.svg"), "logo.svg = svg/favicon.svg");
  const png = (p) => { const b = bytes(p); assert.equal(b.toString("ascii", 1, 4), "PNG", p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const [a, r, d] of [["assets/icon-192.png", "png/icon-192.png", [192, 192]], ["assets/icon-512.png", "png/icon-512.png", [512, 512]], ["assets/og-image.png", "og/og-image.png", [1200, 630]]]) {
    assert.ok(bytes(a).equals(bytes(REF + r)), a + " = " + r);
    assert.deepEqual(png(a), d, a);
  }
  const man = JSON.parse(read("manifest.webmanifest"));
  assert.deepEqual(man.icons.map((i) => [i.src, i.sizes]), [["assets/icon-192.png", "192x192"], ["assets/icon-512.png", "512x512"]]);
  assert.equal(man.background_color, "#F2EDE3"); assert.equal(man.theme_color, "#F2EDE3");
  for (const f of PAGES.filter((f) => /og:image/.test(read(f)))) {
    assert.ok(read(f).includes('<meta property="og:image" content="https://fluyo.space/assets/og-image.png">'), f + ": OG");
    assert.ok(read(f).includes('<meta name="twitter:image" content="https://fluyo.space/assets/og-image.png">'), f + ": twitter");
  }
});

/* El bloque de la marca en identity.css (de su comentario a la última @keyframes) y el CSS de la referencia */
const idCss = () => read("css/identity.css");
const refCss = () => ref("codigo/logo-cabecera.html").match(/<style>([\s\S]*?)<\/style>/)[1];
const mediaBody = (css, head) => { const a = css.indexOf(head); assert.ok(a >= 0, "falta " + head); let i = css.indexOf("{", a) + 1, d = 1; const s = i; for (; d; i++) d += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0; return css.slice(s, i - 1); };

test("R4 · movimiento: keyframes y reglas del bucle tal cual la referencia (4.8 s), declarados solo sin «reducir movimiento»", () => {
  const css = idCss(), r = refCss();
  const kf = (t) => [...t.matchAll(/@keyframes logoMark-[a-z0-9]+\{.*\}\}/g)].map((m) => m[0]).sort();
  assert.equal(kf(r).length, 6); assert.deepEqual(kf(css), kf(r), "las seis @keyframes, idénticas");
  const rules = (t) => [...t.matchAll(/^\.logoMark \.(pan|old|n2|n3|r2|tok)\{.*\}$/gm)].map((m) => m[0]).sort();
  const motion = mediaBody(css, "@media (prefers-reduced-motion: no-preference){");
  assert.equal(rules(r).length, 6); assert.deepEqual(rules(motion), rules(r), "las seis reglas del bucle, idénticas y dentro de no-preference");
  assert.ok(rules(r).every((x) => /4\.8s/.test(x)) && rules(r).every((x) => /infinite/.test(x)), "4.8 s en bucle");
  assert.match(motion, /\.logoMark \.still\{display:none;\} \.logoMark \.loop\{display:inline;\}/, "con movimiento: el bucle a la vista, el fijo no");
  const outside = css.replace(motion, "");
  assert.doesNotMatch(outside.replace(/animation:none/g, ""), /animation:|offset-path/, "ninguna animación fuera de no-preference (ni para el bucle oculto)");
  assert.match(outside, /\n\.logoMark \.loop\{display:none;\}\n/, "sin movimiento: el bucle no se ve");
  assert.match(css, /\n\.logo \.logoMark\{width:calc\(24em \/ 21\); height:calc\(24em \/ 21\); flex:none; overflow:hidden;\}\n/, "24 px con la palabra a 21 px");
  assert.match(css, /\n\.logoMark circle\{fill:var\(--attention\);\}\n/, "el envío en --attention");
  const block = css.slice(css.indexOf("/* Marca Ruta"), css.lastIndexOf("@keyframes logoMark-"));
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b|rgba?\(/i, "sin colores sueltos");
  assert.doesNotMatch(css, /prefers-reduced-motion: reduce/, "«reducir movimiento» no necesita regla: el bucle ni se declara");
});

test("R5 · fijo donde antes se ocultaban los puntos: el símbolo fijo y el bucle oculto y sin animar", () => {
  const STATIC = (sel) => `${sel} .still{display:inline;} ${sel} :is(.loop, .loop *){display:none; animation:none;}`;
  const sp = (s) => s.replace(/\{ /g, "{").replace(/; \}/g, ";}");
  const where = [
    ["css/styles.css", "@media (min-width:701px) and (max-width:860px){", "body > header .logo"],
    ["css/styles.css", "@media (max-width:700px), (orientation:landscape) and (max-height:500px) and (pointer:coarse){", "body > header .logo"],
    ["css/share.css", "@media (max-width:700px){", "#chrome .logo"],
    ["css/pages.css", "@media (max-width:620px){", ".siteHead .logo"],
    ["css/identity.css", "@media (orientation:landscape) and (max-height:500px) and (pointer:coarse){", ".logo .logoMark"],
  ];
  for (const [f, head, sel] of where) assert.ok(sp(mediaBody(read(f), head)).includes(STATIC(sel)), `${f} ${head} → ${sel}`);
  /* editor de 701–860 px: el par a la escala del teléfono (palabra 19 px); con 21 px, a 768 px táctil la cabecera desbordaba 8 px */
  assert.ok(mediaBody(read("css/styles.css"), "@media (min-width:701px) and (max-width:860px){").includes("body > header .logo{font-size:19px;}"), "701–860: palabra a 19 px");
  /* y la cabecera conserva lo demás: centrada, 8 px entre símbolo y palabra */
  for (const [f, sel] of [["css/styles.css", "body > header .logo{"], ["css/share.css", "#chrome .logo{"], ["css/pages.css", ".siteHead .logo{"]])
    assert.match(mediaBody(read(f), sel), /display:flex; align-items:center; gap:calc\(8em \/ 21\);/, f);
});

test("R6 · nada de la marca anterior; Playfair solo en la palabra; «Hecho con Fluyo» igual", () => {
  const css = ["css/identity.css", "css/styles.css", "css/share.css", "css/pages.css", "css/system.css"].map(read).join("\n");
  assert.doesNotMatch(css, /\.dots|\.logo b\b|@keyframes flow|animation:flow/, "sin puntos, sin «yo» aparte, sin @keyframes flow");
  const served = [...PAGES, "assets/logo.svg", "sw.js", "manifest.webmanifest"].map(read).join("\n");
  assert.doesNotMatch(served, /flu<b>yo<\/b>|class="dots"|cx='18' cy='32' r='7'|cx="18" cy="32" r="7"/, "ni marcado, ni favicon, ni logo.svg viejos");
  assert.doesNotMatch(read("css/identity.css"), /Playfair|font-family|--font-serif/, "la marca no trae tipografía propia: la palabra usa la voz que ya tenía cada cabecera");
  assert.ok(read("s/index.html").includes("Hecho con"), "«Hecho con Fluyo» sigue en el Viewer");
});

test("R7 · decisión 325 (sustituye a la 267), la 267 marcada y la tarea", () => {
  const d = read(".ai/DECISIONS.md");
  assert.match(d, /\n325\. \*\*La marca Ruta es la identidad de Fluyo\*\*/);
  assert.match(d, /\n267\. \*\(Sustituida por la 325 en FLUYO-BRAND-RUTA-001\.\)\* \*\*La marca fuera del HTML pertenece al Fluyo actual\*\*/);
  assert.ok(fs.existsSync(path.join(root, ".ai/tasks/FLUYO-BRAND-RUTA-001.md")));
});

test("C1 · alcance frente a " + BASE + ": solo los archivos de esta tarea; undoRuta da la base EXACTA; sw.js solo CACHE v123; JS y manifest intactos", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
  try { atBase("sw.js"); } catch { return; }   // sin git
  const { undoRuta, PIECES, NEW_FILES, BASE_RUTA } = require("./fluyo-brand-ruta-001-undo.cjs");
  assert.equal(BASE_RUTA, BASE); assert.deepEqual(NEW_FILES, []);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const FILES = ["404.html", "assets/logo.svg", "css/identity.css", "css/pages.css", "css/share.css", "css/styles.css", "docs/index.html", "ejemplos/index.html",
    "index.html", "privacidad/index.html", "privacy/index.html", "s/index.html", "soporte/index.html", "support/index.html", "terminos/index.html", "terms/index.html"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, "assets/icon-192.png", "assets/icon-512.png", "assets/og-image.png", "sw.js"].sort());
  for (const f of FILES) assert.equal(undoRuta(f, read(f)), atBase(f), f + ": undoRuta exacto");
  assert.equal(read("sw.js").replace('const CACHE = "fluyo-static-v123";', 'const CACHE = "fluyo-static-v121";'), atBase("sw.js"), "sw.js: solo la constante");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v123";/);
  /* index.html y s/index.html: solo la marca y el favicon */
  for (const f of ["index.html", "s/index.html"]) {
    const a = atBase(f).split("\n"), b = read(f).split("\n");
    assert.equal(a.length, b.length, f);
    assert.equal(b.filter((l, i) => l !== a[i]).length, 2, f + ": dos líneas (favicon y marca)");
  }
});
