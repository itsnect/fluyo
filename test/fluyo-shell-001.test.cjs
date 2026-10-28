"use strict";
/* FLUYO-SHELL-001 — Product Shell de las páginas públicas (/ejemplos, /docs, legales, soporte y 404).
   · Cada página pública carga identity.css + system.css + pages.css (en ese orden), precarga la mono, theme-color hueso, favicon
     del producto, sin estilos en línea ni emoji.
   · Cabecera y pie: el mismo marcado en todas (marca · Ejemplos · Docs · «Abrir Fluyo»; pie con lo legal y el proyecto), la página
     actual marcada, el idioma hermano en el pie con su hreflang.
   · pages.css: todo valor de color en :root (tokens), nada de la identidad oscura anterior a 018.13.
   · 404.html: rutas absolutas, i18n de la decisión 261 (data-i18n + i18n.js), claves en inglés.
   · Marca: favicon, logo.svg, manifest, iconos y og-image del Fluyo actual.
   · Alcance frente a la base: solo los archivos de esta tarea; editor, Viewer, Present, Share, kernel y runtime del SW intactos;
     undoShell devuelve la base EXACTA; CACHE v108. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const { undoShell, PIECES, NEW_FILES, BASE_SHELL } = require("./fluyo-shell-001-undo.cjs");
/* FLUYO-I18N-002 S0 va encima: el alcance de esta tarea se mide sobre el texto sin sus cambios (undoS0) y sin sus archivos nuevos. */
const { undoS0, PIECES: PIECES_S0, NEW_FILES: NEW_S0 } = require("./fluyo-i18n-002-s0-undo.cjs");
const { PIECES: PIECES_S1 } = require("./fluyo-i18n-002-s1-undo.cjs");   /* S1 se deshace dentro de undoS0 */
const readS = (f) => undoS0(f, read(f));
const BASE = "53552a2";

const PAGES = [
  { file: "docs/index.html", lang: "es", nav: "docs" },
  { file: "ejemplos/index.html", lang: "es", nav: "examples" },
  { file: "privacidad/index.html", lang: "es", foot: "privacy", sib: ["../privacy/", "en"] },
  { file: "privacy/index.html", lang: "en", foot: "privacy", sib: ["../privacidad/", "es"] },
  { file: "terminos/index.html", lang: "es", foot: "terms", sib: ["../terms/", "en"] },
  { file: "terms/index.html", lang: "en", foot: "terms", sib: ["../terminos/", "es"] },
  { file: "soporte/index.html", lang: "es", foot: "support", sib: ["../support/", "en"] },
  { file: "support/index.html", lang: "en", foot: "support", sib: ["../soporte/", "es"] },
];
const ALL = [...PAGES.map((p) => p.file), "404.html"];
const FAVICON = "fill='%23F2EDE3'/%3E%3Ccircle cx='18' cy='32' r='7' fill='%23A33A22'/%3E";
const block = (html, open, close) => { const a = html.indexOf(open); assert.ok(a >= 0, "falta " + open); const b = html.indexOf(close, a); return html.slice(a, b + close.length); };

test("<head>: identity.css → system.css → pages.css, mono precargada, theme-color hueso y favicon del producto", () => {
  for (const f of ALL) {
    const h = read(f), pre = f === "404.html" ? "/" : "../", head = block(h, "<head>", "</head>");
    const css = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(css, ["identity.css", "system.css", "pages.css"].map((c) => pre + "css/" + c), f + ": hojas");
    assert.ok(head.includes(`<link rel="preload" href="${pre}assets/fonts/ibm-plex-mono-latin-400.woff2" as="font" type="font/woff2" crossorigin>`), f + ": mono precargada");
    assert.match(head, /<meta name="theme-color" content="#F2EDE3">/, f + ": theme-color");
    assert.ok(head.includes(FAVICON), f + ": favicon hueso y terracota");
    assert.doesNotMatch(h, /#111213|%23161616'\/%3E%3Ccircle|d08b5b/i, f + ": nada de la identidad oscura");
    assert.doesNotMatch(h, / style="/, f + ": sin estilos en línea");
    assert.doesNotMatch(h.replace(/<!--[\s\S]*?-->/g, ""), /<style/, f + ": sin <style>");
    /* Única excepción, de CONTENIDO: docs/ nombra una vez el control «⚙» del editor (sin tocar en este slice; NORTHSTAR-SURFACES-001 § 4.8). */
    const text = f === "docs/index.html" ? h.replace("plegar con su botón o con ⚙;", "") : h;
    assert.doesNotMatch(text, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, f + ": sin emoji ni dingbats");
  }
});

test("cabecera: el mismo marcado (marca · Ejemplos · Docs · «Abrir Fluyo»), la página actual marcada", () => {
  const T = { es: ["Ejemplos", "Docs", "Abrir Fluyo", "Ir al contenido"], en: ["Examples", "Docs", "Open Fluyo", "Skip to content"] };
  for (const p of PAGES) {
    const h = read(p.file), head = block(h, `<header class="siteHead">`, "</header>"), [ex, docs, open, skip] = T[p.lang];
    assert.ok(head.includes(`<a class="logo" href="../">flu<b>yo</b><span class="dots" aria-hidden="true"><span></span><span></span><span></span></span></a>`), p.file + ": marca");
    const links = [...block(head, `<nav class="siteNav"`, "</nav>").matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)].map((m) => [m[1], m[3], /aria-current="page"/.test(m[2])]);
    assert.deepEqual(links, [[p.nav === "examples" ? "./" : "../ejemplos/", ex, p.nav === "examples"], [p.nav === "docs" ? "./" : "../docs/", docs, p.nav === "docs"]], p.file + ": navegación");
    assert.ok(head.includes(`<a class="btn siteOpen" href="../"><svg class="ic" aria-hidden="true"><use href="#i-edit"/></svg><span>${open}</span></a>`), p.file + ": Abrir Fluyo");
    assert.ok(h.includes(`<a class="skip" href="#main">${skip}</a>`) && h.includes(`<main class="wrap" id="main">`), p.file + ": ir al contenido");
    assert.doesNotMatch(h, /class="topbar"|class="pagefoot"/, p.file + ": sin la cabecera ni el pie antiguos");
  }
});

test("pie: lo legal y el proyecto en todas las páginas; el idioma hermano con su hreflang", () => {
  const T = { es: { privacy: "../privacidad/", terms: "../terminos/", support: "../soporte/" }, en: { privacy: "../privacy/", terms: "../terms/", support: "../support/" } };
  for (const p of PAGES) {
    const h = read(p.file), foot = block(h, `<footer class="siteFoot">`, "</footer>");
    assert.ok(h.indexOf("</main>") < h.indexOf(`<footer class="siteFoot">`), p.file + ": el pie va fuera de <main>");
    const hrefs = [...foot.matchAll(/<a (?:class="siteLang" )?href="([^"]+)"/g)].map((m) => m[1]);
    const legal = ["privacy", "terms", "support"].map((k) => (p.foot === k ? "./" : T[p.lang][k]));
    assert.deepEqual(hrefs.slice(0, 5), [...legal, "https://github.com/itsnect/fluyo", "https://github.com/itsnect/fluyo-mcp"], p.file + ": enlaces del pie");
    if (p.foot) assert.match(foot, /<a href="\.\/" aria-current="page">/, p.file + ": la legal actual marcada");
    if (p.sib) {
      assert.ok(foot.includes(`<a class="siteLang" href="${p.sib[0]}" hreflang="${p.sib[1]}" lang="${p.sib[1]}">`), p.file + ": idioma hermano");
      assert.ok(read(p.file).includes(`hreflang="${p.sib[1]}" href="https://fluyo.space/${p.sib[0].slice(3)}"`), p.file + ": coincide con el <link rel=alternate>");
    } else assert.doesNotMatch(foot, /siteLang/, p.file + ": sin hermana, sin enlace de idioma");
  }
});

test("enlaces internos: todo href/src relativo de las páginas existe en el repo", () => {
  for (const f of ALL) {
    const h = read(f), dir = f === "404.html" ? root : path.dirname(path.join(root, f));
    for (const m of h.matchAll(/(?:href|src)="((?!https?:|mailto:|#|data:|\?)[^"#?]+)/g)) {
      const u = m[1], target = u.startsWith("/") ? path.join(root, u) : path.resolve(dir, u);
      const exists = fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")));
      assert.ok(exists, `${f}: ${u}`);
    }
  }
});

test("sprite: solo i-edit e i-arrow, idénticos a los del Viewer y el editor", () => {
  const sym = (h, id) => (h.match(new RegExp(`<symbol id="${id}"[\\s\\S]*?</symbol>`)) || [])[0];
  const src = { "i-edit": sym(read("s/index.html"), "i-edit"), "i-arrow": sym(read("index.html"), "i-arrow") };
  for (const f of ALL) {
    const h = read(f);
    assert.deepEqual([...h.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]), ["i-edit", "i-arrow"], f);
    for (const id of Object.keys(src)) assert.equal(sym(h, id), src[id], f + ": " + id);
    for (const m of h.matchAll(/<use href="#([^"]+)"/g)) assert.ok(src[m[1]], f + ": usa #" + m[1]);
  }
});

test("pages.css: valores de color solo en :root, sobre los tokens del producto; nada del tema oscuro anterior", () => {
  const css = read("css/pages.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rootBlocks = [...css.matchAll(/:root\{[^}]*\}/g)].map((m) => m[0]).join("\n");
  const rules = css.replace(/:root\{[^}]*\}/g, "");
  assert.doesNotMatch(rules, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "ningún color suelto fuera de :root");
  assert.doesNotMatch(css, /Georgia|Segoe|Cascadia|Consolas|#111213|#1b1d1f|#222527|#d08b5b|#3aa7e8/i, "sin la identidad anterior");
  assert.match(rules, /var\(--font-serif\)/); assert.match(rules, /var\(--font-mono\)/);
  assert.deepEqual([...rootBlocks.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0]), ["#161616"], "el único hex: el fondo del lienzo oscuro (contenido)");
  assert.ok(read("js/config.js").includes('dark : {bg:"#161616"'), "y es THEMES.dark.bg");
  assert.match(css, /\.siteHead \.logo\{[^}]*gap:0/, "la marca sin el hueco de «flu yo»");
  assert.match(css, /@media \(pointer:coarse\)\{[^}]*\.siteNav a, \.btn\{ min-height:var\(--ctl-h-touch\); \}/, "44 px con el dedo");
  assert.doesNotMatch(css, /data-ui-theme/, "las páginas no siguen el tema oscuro de la interfaz (D3)");
  assert.doesNotMatch(css, /margin-left|margin-right|padding-left|padding-right|text-align:left/, "propiedades lógicas (idiomas RTL)");
});

test("404.html: rutas absolutas, i18n de la decisión 261 y salidas a Fluyo", () => {
  const h = read("404.html");
  for (const m of h.matchAll(/(?:href|src)="((?!https?:|#|data:)[^"]+)"/g)) assert.ok(m[1].startsWith("/"), "absoluta: " + m[1]);
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.ok(h.indexOf('<script src="/js/i18n-en.js"></script>') < h.indexOf('<script src="/js/i18n.js"></script>'), "diccionario antes que i18n.js");
  assert.match(h, /<a class="btn primary" href="\/">/, "una sola primaria: Abrir Fluyo");
  assert.equal((h.match(/class="btn primary"/g) || []).length, 1);
  const keys = [...h.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map((m) => m[1]);
  const en = read("js/i18n-en.js");
  for (const k of keys) assert.ok(en.includes(`"${k}":`), "en: " + k);
  assert.ok(require("./i18n-scan.cjs").catalog().uses.some((u) => u.file === "404.html"), "el escáner de I18N-001 lo cubre");
});

test("marca: logo.svg, manifest, iconos y og-image del Fluyo actual", () => {
  const svg = read("assets/logo.svg");
  assert.match(svg, /fill="#F2EDE3"/); assert.equal((svg.match(/fill="#A33A22"/g) || []).length, 3); assert.doesNotMatch(svg, /#161616|#d08b5b/i);
  const man = JSON.parse(read("manifest.webmanifest"));
  assert.equal(man.background_color, "#F2EDE3"); assert.equal(man.theme_color, "#F2EDE3");
  const dims = (p) => { const b = fs.readFileSync(path.join(root, p)); assert.equal(b.toString("ascii", 1, 4), "PNG", p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(dims("assets/icon-192.png"), [192, 192]);
  assert.deepEqual(dims("assets/icon-512.png"), [512, 512]);
  assert.deepEqual(dims("assets/og-image.png"), [1200, 630]);
  for (const f of ["index.html", "s/index.html"]) assert.ok(read(f).includes(FAVICON), f + ": el mismo favicon");
});

test("alcance frente a " + BASE + ": solo los archivos de esta tarea; undoShell da la base EXACTA; editor, Viewer, Present, Share y SW intactos; CACHE v108", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
  try { atBase("sw.js"); } catch { return; }   // sin git
  assert.equal(BASE_SHELL, BASE);
  assert.deepEqual(NEW_FILES, ["404.html"]);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean)
    .filter((f) => !NEW_S0.includes(f) && !((PIECES_S0[f] || PIECES_S1[f] || require("./fluyo-i18n-002-s2a-undo.cjs").PIECES[f] || require("./fluyo-i18n-002-s4-undo.cjs").PIECES[f] || require("./fluyo-i18n-002-s2b-undo.cjs").PIECES[f]) && !NEW_FILES.includes(f) && readS(f) === atBase(f)));   /* lo que solo cambian I18N-002 S0, S1, S2a, S4 y S2b */
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !NEW_S0.includes(f));
  const FILES = Object.keys(PIECES).sort();
  assert.deepEqual(FILES, ["assets/logo.svg", "css/pages.css", "docs/index.html", "ejemplos/index.html", "index.html", "js/i18n-en.js", "manifest.webmanifest",
    "privacidad/index.html", "privacy/index.html", "s/index.html", "soporte/index.html", "support/index.html", "terminos/index.html", "terms/index.html"]);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, ...NEW_FILES, "assets/icon-192.png", "assets/icon-512.png", "assets/og-image.png", "sw.js"].sort());
  for (const f of FILES) assert.equal(undoShell(f, read(f)), atBase(f), f + ": undoShell exacto");
  /* index.html y s/index.html: solo la línea del favicon; i18n-en.js: solo claves nuevas al final */
  for (const f of ["index.html", "s/index.html"]) {
    const a = atBase(f).split("\n"), b = readS(f).split("\n");
    assert.equal(a.length, b.length, f);
    assert.deepEqual(b.map((l, i) => (l === a[i] ? null : l)).filter(Boolean).map((l) => l.slice(0, 16)), ['<link rel="icon"'], f + ": solo el favicon");
  }
  assert.ok(readS("js/i18n-en.js").startsWith(atBase("js/i18n-en.js").replace(/\n\};\n$/, "")), "i18n-en.js: nada cambia, solo se añaden claves");
  assert.equal(readS("sw.js").replace('"fluyo-static-v115"', '"fluyo-static-v' + (108 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante (sin cambio de comportamiento)");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v115";/);
  for (const f of ["css/system.css", "css/styles.css", "css/share.css", "css/identity.css", "js/i18n.js", "ejemplos/data/funnel-de-ventas.fluyo.json"]) assert.equal(readS(f), atBase(f), f + " sin cambios");
  for (const f of fs.readdirSync(path.join(root, "js")).filter((x) => x.endsWith(".js") && x !== "i18n-en.js" && !NEW_S0.includes("js/" + x))) assert.equal(readS("js/" + f), atBase("js/" + f), "js/" + f + " sin cambios");
});
