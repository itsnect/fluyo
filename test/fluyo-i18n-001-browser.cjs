"use strict";
/* FLUYO-I18N-001 — Chrome REAL: la vertical slice en inglés (?lang=en) y el español de siempre, en el editor (cabecera y Present) y
   en el Viewer (escritorio y teléfono). Mide: textos, atributos, <html lang>, ninguna clave sin traducir (FluyoI18n.missing()),
   ningún error de consola y que la cabecera no desborde en inglés.
   Uso: node test/fluyo-i18n-001-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-i18n-001-"));
fs.mkdirSync(shots, { recursive: true });
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      const body = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

async function open(browser, base, url, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.mobile, isMobile: !!vp.mobile, serviceWorkers: "block" });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => d.dismiss());
  await page.goto(base + url);
  return { ctx, page, errors };
}
const txt = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim());
const attr = (page, sel, a) => page.$eval(sel, (e, a) => e.getAttribute(a), a);

async function editor(browser, base, lang) {
  const en = lang === "en";
  console.log(`\neditor · ${lang}`);
  const { ctx, page, errors } = await open(browser, base, "/" + (en ? "?lang=en" : ""), { width: 1440, height: 900 });
  await page.waitForFunction(() => typeof enterPresent === "function" && typeof scRun === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  check(await page.evaluate(() => document.documentElement.lang) === lang, `<html lang="${lang}">`);
  check(await txt(page, "#tabProperties .lbl") === (en ? "Edit" : "Editar"), "modo Editar");
  check(await txt(page, "#tabScenarios .lbl") === (en ? "Stories" : "Historias"), "modo Historias");
  check(await txt(page, "#btnCanvas .lbl") === (en ? "Canvas" : "Lienzo"), "Lienzo");
  check(await txt(page, "#btnExport .lbl") === (en ? "Export" : "Exportar"), "Exportar");
  check(await txt(page, "#btnShare .lbl") === (en ? "Share" : "Compartir"), "Compartir");
  check(await txt(page, "#btnPresent .lbl") === (en ? "Present" : "Presentar"), "Presentar");
  check(await attr(page, "#btnUndo", "data-tip") === (en ? "Undo · Ctrl+Z" : "Deshacer · Ctrl+Z"), "tooltip de Deshacer");
  check(await attr(page, "#btnMore", "aria-label") === (en ? "More options" : "Más opciones"), "aria-label de Más");
  check(await txt(page, "#scRun").then((t) => /Reproducir/.test(t)), "fuera de la slice sigue en español (Historias: «▶ Reproducir»)");
  const head = await page.$eval("header", (h) => ({ sw: h.scrollWidth, cw: h.clientWidth }));
  check(head.sw <= head.cw + 1, `la cabecera no desborda (${head.sw}/${head.cw})`);
  await page.screenshot({ path: path.join(shots, `editor-${lang}.png`) });

  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FIXTURE);
  await page.evaluate(() => enterPresent());
  await page.waitForTimeout(400);
  check(await txt(page, "#prExit .lbl") === (en ? "Exit" : "Salir"), "Present · Salir");
  check(await attr(page, "#prExit", "title") === (en ? "Exit presentation (Esc)" : "Salir de la presentación (Esc)"), "Present · título de Salir");
  check(await txt(page, "#prSkin") === (en ? "Flat" : "Plano"), "Present · aspecto");
  const hasStory = await page.evaluate(() => !$("psGroup").hidden);
  if (hasStory) {
    check(await txt(page, "#psPlay") === (en ? "▶ Play" : "▶ Reproducir"), "Present · Reproducir");
    await page.click("#psPlay"); await page.waitForTimeout(500);
    check(await txt(page, "#psStop") === (en ? "■ Stop" : "■ Detener"), "Present · Detener");
    check(await txt(page, "#psPause") === (en ? "Pause" : "Pausar"), "Present · Pausar");
    await page.click("#psPause"); await page.waitForTimeout(200);
    check(await txt(page, "#psPause") === (en ? "Resume" : "Reanudar"), "Present · Reanudar");
    check((await txt(page, "#psCaption")).startsWith(en ? "Paused" : "En pausa"), "Present · «En pausa»");
  } else check(false, "el fixture tiene Historia en la primera página");
  await page.screenshot({ path: path.join(shots, `present-${lang}.png`) });
  check((await page.evaluate(() => FluyoI18n.missing())).length === 0, "ninguna clave sin traducir (missing)");
  check(errors.length === 0, "sin errores de consola " + (errors.length ? errors.join(" | ") : ""));
  await ctx.close();
}

async function viewer(browser, base, lang, vp) {
  const en = lang === "en";
  console.log(`\nViewer · ${lang} · ${vp.width}×${vp.height}`);
  const { ctx, page, errors } = await open(browser, base, "/s/?s=demo" + (en ? "&lang=en" : ""), vp);
  await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  check(await page.evaluate(() => document.documentElement.lang) === lang, `<html lang="${lang}">`);
  check(await page.title() === (en ? "Shared diagram · Fluyo" : "Diagrama compartido · Fluyo"), "título de la pestaña");
  check(await txt(page, "#brand a") === (en ? "Made with Fluyo" : "Hecho con Fluyo"), "pie");
  check(await attr(page, "#btnFit", "title") === (en ? "Fit the diagram to the view" : "Encajar el diagrama en la vista"), "Encajar");
  const open_ = await page.$eval("#btnOpen", (b) => b.innerText.replace(/\s+/g, " ").trim());
  const wantOpen = vp.mobile ? (en ? "Open" : "Abrir") : (en ? "Open in Fluyo" : "Abrir en Fluyo");
  check(open_ === wantOpen, `«${wantOpen}» (visible: «${open_}»)`);
  const head = await page.$eval("#chrome", (h) => ({ sw: h.scrollWidth, cw: h.clientWidth }));
  check(head.sw <= head.cw + 1, `la cabecera no desborda (${head.sw}/${head.cw})`);
  if (await page.evaluate(() => !document.getElementById("story").hidden)) {
    check(await txt(page, "#stPlay") === (en ? "▶ Play story" : "▶ Reproducir historia"), "banda · Reproducir historia");
    check(await txt(page, "#stKicker") === (en ? "Story" : "Historia"), "rótulo · Historia");
  }
  await page.click("#btnPresent"); await page.waitForTimeout(300);
  check(await page.$eval("#prExit", (b) => b.innerText.trim()) === (en ? "Exit" : "Salir"), "Present del Viewer · Salir");
  await page.screenshot({ path: path.join(shots, `viewer-${lang}-${vp.width}.png`) });
  check((await page.evaluate(() => FluyoI18n.missing())).length === 0, "ninguna clave sin traducir (missing)");
  check(errors.length === 0, "sin errores de consola " + (errors.length ? errors.join(" | ") : ""));
  await ctx.close();
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const lang of ["en", "es"]) await editor(browser, base, lang);
    for (const lang of ["en", "es"]) for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844, mobile: true }]) await viewer(browser, base, lang, vp);
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
