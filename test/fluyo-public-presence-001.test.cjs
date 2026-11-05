"use strict";
/* FLUYO-PUBLIC-PRESENCE-001 — la presencia pública usa el correo de marca y enlaza las redes oficiales, sin tocar el producto (decisiones 335–336).
   · Alcance frente a la base: solo texto y enlaces en las páginas públicas, una regla de css/styles.css, una clave de catálogo y CACHE.
   · Ningún archivo servido conserva el correo antiguo; la identificación del responsable sigue intacta.
   · Enlaces a redes: los tres perfiles exactos, sin embeds ni scripts de las plataformas.
   · Telemetría, kernel del MCP y Viewer, idénticos a la base. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const BASE = "5d10065";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const OLD = ["nectdnb", "@gmail.com"].join("");
const MAIL = "hello@fluyo.space";
const IG = "https://www.instagram.com/fluyospace/", TT = "https://www.tiktok.com/@fluyospace", YT = "https://www.youtube.com/@fluyospace";
const FOOTER_ES = ["docs/index.html", "ejemplos/index.html", "privacidad/index.html", "soporte/index.html", "terminos/index.html", "404.html"];
const FOOTER_EN = ["privacy/index.html", "support/index.html", "terms/index.html"];
const FOOTERS = [...FOOTER_ES, ...FOOTER_EN];
const CONTACT = ["privacidad/index.html", "privacy/index.html", "soporte/index.html", "support/index.html", "terminos/index.html", "terms/index.html"];

test("alcance frente a " + BASE + ": solo los archivos de esta tarea; undoPresence da la base EXACTA; sw.js solo CACHE v125; telemetría y kernel intactos", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).replace(/\r\n/g, "\n");
  try { atBase("sw.js"); } catch { return; }   // sin git
  const { undoPresence, PIECES, NEW_FILES, BASE_PRESENCE } = require("./fluyo-public-presence-001-undo.cjs");
  assert.equal(BASE_PRESENCE, BASE); assert.deepEqual(NEW_FILES, []);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "robots.txt", "sitemap.xml", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").map((s) => s.trim()).filter(Boolean);
  const FILES = ["404.html", "css/styles.css", "docs/index.html", "ejemplos/index.html", "index.html", "js/i18n-en-editor.js", "js/i18n-en.js",
    "privacidad/index.html", "privacy/index.html", "soporte/index.html", "support/index.html", "terminos/index.html", "terms/index.html"];
  assert.deepEqual(Object.keys(PIECES).sort(), [...FILES].sort());
  assert.deepEqual(changed.sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoPresence(f, read(f)), atBase(f), f + ": undoPresence exacto");
  const noCache = (s) => s.replace(/const CACHE = "fluyo-static-v\d+";/, "");
  assert.equal(noCache(read("sw.js")), noCache(atBase("sw.js")), "sw.js: solo la constante");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v125";/);
  for (const f of ["js/analytics.js", "js/editor-analytics.js", "s/index.html", "manifest.webmanifest", "js/config.js", "js/model.js", "js/story-clock.js"]) assert.equal(read(f), atBase(f), f + ": idéntico a la base");
});

test("ningún archivo servido ni documento de contacto conserva el correo antiguo", () => {
  const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = ["index.html", "404.html", "sw.js", "manifest.webmanifest", "README.md", "SECURITY.md", "CONTRIBUTING.md", "AGENTS.md", ...["js", "css", "s", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"].flatMap(walk)]
    .filter((f) => /\.(html|js|css|md|json|webmanifest|xml)$/.test(f));
  assert.ok(files.length > 40, "recorre los archivos servidos");
  for (const f of files) assert.ok(!read(f).toLowerCase().includes(OLD), f);
});

test("el correo de marca está como enlace en las páginas de contacto, y el responsable sigue identificado", () => {
  const COUNT = { "privacidad/index.html": 2, "privacy/index.html": 2, "soporte/index.html": 1, "support/index.html": 1, "terminos/index.html": 1, "terms/index.html": 1 };
  for (const f of CONTACT) assert.equal(read(f).split('<a href="mailto:' + MAIL + '">' + MAIL + "</a>").length - 1, COUNT[f], f);
  for (const f of ["privacidad/index.html", "privacy/index.html", "terminos/index.html", "terms/index.html"]) assert.ok(read(f).includes("<strong>itsnect</strong> (Claudio Jiménez Flores)"), f + ": responsable");
  assert.ok(read("README.md").includes("© 2026 Claudio Jiménez Flores"));
  assert.ok(read("README.md").includes("mailto:" + MAIL));
  assert.ok(read("SECURITY.md").includes("mailto:" + MAIL));
  assert.ok(read("SECURITY.md").includes("security/advisories/new"), "el advisory privado sigue siendo la primera vía");
});

test("las fechas legales cambian con el contacto, en los dos idiomas", () => {
  assert.ok(read("privacidad/index.html").includes("Última actualización: 5 de noviembre de 2026."));
  assert.ok(read("terminos/index.html").includes("Última actualización: 5 de noviembre de 2026."));
  assert.ok(read("privacy/index.html").includes("Last updated: 5 November 2026."));
  assert.ok(read("terms/index.html").includes("Last updated: 5 November 2026."));
});

test("la política declara quién trata el correo de contacto, en los dos idiomas", () => {
  assert.ok(read("privacidad/index.html").includes("Cloudflare los recibe y los reenvía a la cuenta de Gmail del proyecto"));
  assert.ok(read("privacy/index.html").includes("Cloudflare receives them and forwards them to the project's Gmail account"));
});

test("los pies enlazan los tres perfiles exactos en un nav propio con nombre, y abren fuera con noopener", () => {
  for (const f of FOOTERS) {
    const h = read(f), foot = h.slice(h.indexOf('<footer class="siteFoot">'), h.indexOf("</footer>", h.indexOf('<footer class="siteFoot">')));
    const label = FOOTER_EN.includes(f) ? 'aria-label="Fluyo on social media"' : 'aria-label="Redes sociales de Fluyo"';
    assert.ok(foot.includes("<nav " + label), f + ": nombre accesible");
    for (const [u, n] of [[IG, "Instagram"], [TT, "TikTok"], [YT, "YouTube"]]) assert.ok(foot.includes('<a href="' + u + '" target="_blank" rel="noopener" translate="no">' + n + "<svg"), f + ": " + n);
  }
  assert.ok(read("404.html").includes('data-i18n-aria-label="shell.social"'));
  assert.match(read("js/i18n-en.js"), /"shell\.social":"Fluyo on social media"/);
  for (const l of ["fr", "ja", "zh"]) assert.ok(!read("js/i18n-" + l + ".js").includes("shell.social"), l + ": sin publicar, cae al inglés");
});

test("el editor las lleva dentro del menú Más, no en una barra permanente", () => {
  const h = read("index.html"), menu = h.indexOf('<section class="moreLinks menuSection"'), end = h.indexOf("</section>", menu), nav = h.indexOf('<nav id="socialLinks"');
  assert.ok(menu > 0 && nav > menu && nav < end, "dentro de la sección del menú");
  assert.equal(h.split('id="socialLinks"').length, 2);
  assert.match(h, /<nav id="socialLinks" aria-label="Redes sociales de Fluyo" data-i18n-aria-label="more\.social">/);
  for (const [u, n] of [[IG, "Instagram"], [TT, "TikTok"], [YT, "YouTube"]]) assert.ok(h.includes('<a class="menuItem" href="' + u + '" target="_blank" rel="noopener" translate="no">' + n + "</a>"), n);
  assert.match(read("js/i18n-en-editor.js"), /"more\.social":"Fluyo on social media"/);
  assert.match(read("css/styles.css"), /#socialLinks\{display:grid; grid-template-columns:repeat\(3,1fr\); gap:1px;\}/);
});

test("sin embeds, feeds ni scripts de las plataformas", () => {
  for (const f of ["index.html", ...FOOTERS]) {
    const h = read(f);
    for (const re of [/<script[^>]+(instagram|tiktok|youtube)/i, /<iframe/i, /<link[^>]+(instagram|tiktok|youtube)/i, /<img[^>]+(instagram|tiktok|youtube)/i]) assert.ok(!re.test(h), f + ": " + re);
  }
  const sw = read("sw.js");
  for (const d of ["instagram.com", "tiktok.com", "youtube.com"]) assert.ok(!sw.includes(d), "sw.js no precachea " + d);
});
