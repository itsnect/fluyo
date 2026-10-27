"use strict";
/* FLUYO-I18N-002 S0 — Chrome REAL: la infraestructura de idioma en los cinco idiomas (es · en · fr · ja · zh).
   Mide, por idioma: <html lang> con etiqueta completa, los textos ya migrados (cabecera del editor, Present, Viewer, 404) contra los
   diccionarios, ninguna clave sin traducir (missing), ningún desborde ni recorte (horizontal y vertical) en la cabecera, el mando de
   Present, la cabecera y la banda del Viewer, a 1440 y a 390; y las FUENTES QUE EL NAVEGADOR USA DE VERDAD para el texto japonés y
   chino (CSS.getPlatformFontsForNode por CDP): una sans CJK del sistema, nunca una mono o una mincho/song de reserva.
   Además: cambio de idioma en vivo (editor, Present y Viewer) sin tocar el documento ni Deshacer y vuelta al español byte a byte;
   pseudo-idioma (+40 %) para ver lo que queda sin migrar y los desbordes; Share de punta a punta (diálogo, enlace, Viewer en otro
   idioma, «Abrir en Fluyo»); offline con el service worker (editor y Viewer, instalación solo-Viewer); documentos existentes (los
   ocho ejemplos y el fixture complejo) serializados idénticos en los cinco idiomas.
   Uso: node test/fluyo-i18n-002-s0-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const scan = require("./i18n-scan.cjs");
const { pseudoDictionary, OPEN, CLOSE } = require("./i18n-pseudo.cjs");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-i18n-002-s0-"));
fs.mkdirSync(shots, { recursive: true });
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8");
const EXAMPLES = fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => f.endsWith(".fluyo.json")).sort();
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
let offline = false;
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    if (offline) { req.socket.destroy(); return; }
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
const info = (msg) => console.log("  ℹ " + msg);

/* El texto esperado de una clave en un idioma: su diccionario o el español base. */
const DICTS = scan.dictionaries();
const BASE_TEXT = new Map(scan.catalog().uses.map((u) => [u.key, u.es]));
/* (la misma reserva que js/i18n.js: idioma › inglés › español) */
const EN_ALL = { ...DICTS.en.common, ...DICTS.en.editor };
const T = (lang, key) => lang === "es" ? BASE_TEXT.get(key) : ({ ...DICTS[lang].common, ...DICTS[lang].editor })[key] ?? EN_ALL[key] ?? BASE_TEXT.get(key);
/* missing(): en español e inglés, vacío; en fr/ja/zh (sin publicar, sus claves de S1+ llegan en S5) lo que falta cae al INGLÉS,
   nunca al español (FLUYO-I18N-002 S1). */
async function checkMissing(page, lang, label = "") {
  const miss = await page.evaluate(() => FluyoI18n.missing());
  if (lang === "es" || lang === "en") check(miss.length === 0, label + "ninguna clave sin traducir (missing)");
  else check(miss.every((m) => m.split(":")[1] in EN_ALL), `${label}lo que falta en ${lang} cae al inglés, nunca al español (${miss.length} claves de S1+)`);
}
const TAG = { es: "es", en: "en", fr: "fr", ja: "ja", zh: "zh-Hans" };
const LANGS = ["es", "en", "fr", "ja", "zh"];
/* Familias tal como las nombra el sistema; Windows añade el peso («Yu Gothic UI Semibold»). */
const CJK = { ja: /^(Yu Gothic UI|Yu Gothic|Meiryo UI|Meiryo|Hiragino Sans|Hiragino Kaku Gothic ProN|Noto Sans CJK JP|Noto Sans JP|Source Han Sans JP)( |$)/,
  zh: /^(Microsoft YaHei UI|Microsoft YaHei|PingFang SC|Hiragino Sans GB|Noto Sans CJK SC|Noto Sans SC|Source Han Sans SC)( |$)/ };
const BAD_FALLBACK = /^(MS Gothic|MS Mincho|MS PGothic|MS PMincho|SimSun|NSimSun|SimHei|MingLiU|PMingLiU|Yu Mincho|Hiragino Mincho ProN)( |$)/;

async function open(browser, base, url, vp, { sw = false, init = null, ctx: given = null } = {}) {
  const ctx = given || await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.mobile, isMobile: !!vp.mobile, serviceWorkers: sw ? "allow" : "block" });
  if (!given) await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("dialog", (d) => d.dismiss());
  if (url) await page.goto(base + url);
  return { ctx, page, errors };
}
const txt = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim());
const attr = (page, sel, a) => page.$eval(sel, (e, a) => e.getAttribute(a), a);
const editorReady = async (page) => {
  await page.waitForFunction(() => typeof enterPresent === "function" && typeof scRun === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
};

/* Desbordes y recortes dentro de `sel`: la caja entera no desborda en horizontal, y ningún elemento visible con texto que recorte
   (overflow ≠ visible) pierde texto, salvo lo que corta a propósito con elipsis. Alto: scrollHeight frente a clientHeight. */
async function clipping(page, sel) {
  return page.evaluate((sel) => {
    const rootEl = document.querySelector(sel);
    if (!rootEl || rootEl.offsetParent === null && getComputedStyle(rootEl).position !== "fixed") return { missing: !rootEl, out: [] };
    const out = [];
    if (rootEl.scrollWidth > rootEl.clientWidth + 1) out.push(`${sel}: ancho ${rootEl.scrollWidth}/${rootEl.clientWidth}`);
    for (const el of rootEl.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || !el.getClientRects().length) continue;
      if (el.clientWidth <= 2 || el.clientHeight <= 2) continue;   /* oculto a la vista a propósito (rótulo de 1 px en el teléfono, .srOnly) */
      if (!/\p{L}/u.test(el.textContent || "") || el.children.length > 3) continue;
      const clipX = cs.overflowX !== "visible", clipY = cs.overflowY !== "visible";
      const name = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
      if (clipX && cs.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 1) out.push(`${name}: ancho ${el.scrollWidth}/${el.clientWidth} «${el.textContent.trim().slice(0, 30)}»`);
      if (clipY && el.scrollHeight > el.clientHeight + 2) out.push(`${name}: alto ${el.scrollHeight}/${el.clientHeight} «${el.textContent.trim().slice(0, 30)}»`);
    }
    return { missing: false, out };
  }, sel);
}
/* Las fuentes que Chrome usa de verdad para pintar el texto de un nodo (CDP). */
async function platformFonts(page, sel) {
  const client = await page.context().newCDPSession(page);
  await client.send("DOM.enable"); await client.send("CSS.enable");
  const { root: r } = await client.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await client.send("DOM.querySelector", { nodeId: r.nodeId, selector: sel });
  if (!nodeId) { await client.detach(); return []; }
  const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
  await client.detach();
  return fonts.map((f) => ({ family: f.familyName, glyphs: f.glyphCount }));
}
/* Para japonés y chino: los glifos CJK los pinta una sans de su escritura; ninguno cae a una reserva mono o mincho. */
async function cjkFonts(page, lang, sel, label) {
  if (!CJK[lang]) return;
  const f = await platformFonts(page, sel);
  const desc = f.map((x) => `${x.family}×${x.glyphs}`).join(", ");
  check(f.some((x) => CJK[lang].test(x.family)), `${label}: sans ${lang} del sistema (${desc})`);
  check(!f.some((x) => BAD_FALLBACK.test(x.family)), `${label}: ninguna reserva mono/mincho/song (${desc})`);
}

async function editor(browser, base, lang, vp) {
  console.log(`\neditor · ${lang} · ${vp.width}×${vp.height}`);
  const { ctx, page, errors } = await open(browser, base, "/" + (lang === "es" ? "" : "?lang=" + lang), vp);
  await editorReady(page);
  check(await page.evaluate(() => document.documentElement.lang) === TAG[lang], `<html lang="${TAG[lang]}">`);
  if (!vp.mobile) {
    for (const [sel, key] of [["#tabProperties .lbl", "editor.modeEdit"], ["#tabScenarios .lbl", "editor.modeStories"], ["#btnCanvas .lbl", "editor.canvas"],
      ["#btnExport .lbl", "editor.export"], ["#btnShare .lbl", "editor.share"], ["#btnPresent .lbl", "present.start"]]) check(await txt(page, sel) === T(lang, key), `${sel} = «${T(lang, key)}»`);
  }
  check(await attr(page, "#btnUndo", "data-tip") === T(lang, "editor.undoHint"), "tooltip de Deshacer");
  check(await attr(page, "#btnMore", "aria-label") === T(lang, "editor.more"), "aria-label de Más");
  const head = await clipping(page, "body > header");
  check(head.out.length === 0, "cabecera sin desbordes ni recortes " + head.out.join(" | "));
  if (!vp.mobile) await cjkFonts(page, lang, "#btnShare .lbl", "cabecera");   /* en el teléfono los rótulos de la cabecera son iconos */
  await page.screenshot({ path: path.join(shots, `editor-${lang}-${vp.width}.png`) });

  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FIXTURE);
  await page.evaluate(() => enterPresent());
  await page.waitForTimeout(400);
  check(await txt(page, "#prExit .lbl") === T(lang, "present.exit"), "Present · Salir");
  check(await attr(page, "#prExit", "title") === T(lang, "present.exitHint"), "Present · título de Salir");
  if (await page.evaluate(() => !$("psGroup").hidden)) {
    check(await txt(page, "#psPlay") === "▶ " + T(lang, "story.play"), "Present · Reproducir");
    await page.click("#psPlay"); await page.waitForTimeout(500);
    check(await txt(page, "#psStop") === "■ " + T(lang, "story.stop"), "Present · Detener");
    await page.click("#psPause"); await page.waitForTimeout(200);
    check(await txt(page, "#psPause") === T(lang, "story.resume"), "Present · Reanudar");
    check((await txt(page, "#psCaption")).startsWith(T(lang, "story.paused")), "Present · «En pausa»");
    for (const sel of ["#presentBar", "#presentStory"]) {
      const c = await clipping(page, sel);
      check(c.out.length === 0, `${sel} sin desbordes ni recortes ` + c.out.join(" | "));
    }
    await cjkFonts(page, lang, "#psCaption", "Present · rótulo");
  } else check(false, "el fixture tiene Historia en la primera página");
  await page.screenshot({ path: path.join(shots, `present-${lang}-${vp.width}.png`) });
  await checkMissing(page, lang);
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

async function viewer(browser, base, lang, vp) {
  console.log(`\nViewer · ${lang} · ${vp.width}×${vp.height}`);
  const { ctx, page, errors } = await open(browser, base, "/s/?s=demo" + (lang === "es" ? "" : "&lang=" + lang), vp);
  await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  check(await page.evaluate(() => document.documentElement.lang) === TAG[lang], `<html lang="${TAG[lang]}">`);
  check(await page.title() === T(lang, "viewer.docTitle"), "título de la pestaña");
  check(await txt(page, "#brand a") === T(lang, "viewer.madeWith"), "pie");
  check(await attr(page, "#btnFit", "title") === T(lang, "viewer.fit"), "Encajar");
  const open_ = await page.$eval("#btnOpen", (b) => b.innerText.replace(/\s+/g, " ").trim());
  const wantOpen = vp.mobile ? T(lang, "viewer.openShort") : (T(lang, "viewer.openShort") + " " + T(lang, "viewer.openRest")).replace(/\s+/g, " ");
  check(open_ === wantOpen, `«${wantOpen}» (visible: «${open_}»)`);
  for (const sel of ["#chrome", "#story", "#brand"]) {
    const c = await clipping(page, sel);
    check(c.out.length === 0, `${sel} sin desbordes ni recortes ` + c.out.join(" | "));
  }
  if (await page.evaluate(() => !document.getElementById("story").hidden)) {
    check(await txt(page, "#stPlay") === "▶ " + T(lang, "story.playStory"), "banda · Reproducir historia");
    check(await txt(page, "#stKicker") === T(lang, "story.group"), "rótulo · Historia");
    await cjkFonts(page, lang, "#stKicker", "Viewer · rótulo");
    await page.click("#stPlay"); await page.waitForTimeout(600);
    const c = await clipping(page, "#stNow");
    check(c.out.length === 0, "#stNow (reproduciendo) sin recortes " + c.out.join(" | "));
  }
  await cjkFonts(page, lang, "#brand a", "Viewer · pie");
  await page.screenshot({ path: path.join(shots, `viewer-${lang}-${vp.width}.png`) });
  await page.click("#btnPresent"); await page.waitForTimeout(300);
  check(await page.$eval("#prExit", (b) => b.innerText.trim()) === T(lang, "present.exit"), "Present del Viewer · Salir");
  const pb = await clipping(page, "#prBar");
  check(pb.out.length === 0, "#prBar sin desbordes ni recortes " + pb.out.join(" | "));
  await checkMissing(page, lang);
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

async function notFound(browser, base, lang) {
  console.log(`\n404 · ${lang}`);
  const { ctx, page, errors } = await open(browser, base, "/404.html" + (lang === "es" ? "" : "?lang=" + lang), { width: 390, height: 844, mobile: true });
  check(await page.evaluate(() => document.documentElement.lang) === TAG[lang], `<html lang="${TAG[lang]}">`);
  check(await txt(page, "h1") === T(lang, "notfound.title"), "título");
  check(await page.title() === T(lang, "notfound.docTitle"), "título de la pestaña");
  const c = await clipping(page, "body");
  check(c.out.length === 0, "sin desbordes ni recortes " + c.out.join(" | "));
  await cjkFonts(page, lang, "h1", "404 · título (Playfair → sans CJK)");
  await page.screenshot({ path: path.join(shots, `404-${lang}.png`) });
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

/* Todo lo que pinta el HTML marcado: texto propio y atributos (para comparar antes y después de ir y volver de idioma). */
const snapshot = (page) => page.evaluate(() => [...document.querySelectorAll("[data-i18n],[data-i18n-title],[data-i18n-aria-label],[data-i18n-tip],[data-i18n-placeholder]")]
  .map((e) => [e.id, e.textContent, e.getAttribute("title"), e.getAttribute("aria-label"), e.getAttribute("data-tip"), e.getAttribute("placeholder")].join("|")).join("\n") + "\n" + document.title + "|" + document.documentElement.lang);
const diffLines = (a, b) => { const x = a.split("\n"), y = b.split("\n"); return x.map((l, i) => (l === y[i] ? null : `«${l}» → «${y[i]}»`)).filter(Boolean).slice(0, 6).join(" | "); };

async function liveEditor(browser, base) {
  console.log("\nen vivo · editor y Present (sin recargar)");
  const { ctx, page, errors } = await open(browser, base, "/", { width: 1440, height: 900 });
  await editorReady(page);
  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FIXTURE);
  await page.evaluate(() => { const n = doc.pages[doc.cur].nodes[0]; pushUndo(); n.x += 10; });
  const before = { snap: await snapshot(page), doc: await page.evaluate(() => JSON.stringify(serializeProject())), undo: await page.evaluate(() => undoStack.length), pref: await page.evaluate(() => localStorage.getItem("fluyo.ui.lang")) };
  /* ida y vuelta pura (sin cambiar de estado): es → ja → zh → fr → en → es */
  await page.evaluate(() => FluyoI18n.setLocale("ja"));
  check(await page.evaluate(() => document.documentElement.lang) === "ja", "<html lang> pasa a ja");
  check(await txt(page, "#btnShare .lbl") === T("ja", "editor.share"), "cabecera en japonés sin recargar");
  for (const l of ["zh", "fr", "en", "es"]) await page.evaluate((l) => FluyoI18n.setLocale(l), l);
  const round = await snapshot(page);
  check(round === before.snap, "ida y vuelta por los cinco idiomas: todo el HTML marcado, byte a byte " + diffLines(before.snap, round));
  /* en Present, con la Historia reproduciéndose */
  await page.evaluate(() => FluyoI18n.setLocale("ja"));
  await page.evaluate(() => enterPresent()); await page.waitForTimeout(300);
  check(await txt(page, "#prExit .lbl") === T("ja", "present.exit"), "Present abre en japonés");
  await page.click("#psPlay"); await page.waitForTimeout(400);
  await page.evaluate(() => FluyoI18n.setLocale("en"));
  check(await txt(page, "#psStop") === "■ " + T("en", "story.stop"), "Present reproduciendo: el mando cambia a inglés al vuelo");
  check(await txt(page, "#prSkin") === T("en", "present.skinFlat") || await txt(page, "#prSkin") === T("en", "present.skinBuilt"), "botón de aspecto en inglés");
  check(await page.evaluate(() => !!scPlayback), "la reproducción sigue (no se reinicia)");
  await page.evaluate(() => presentStop()); await page.waitForTimeout(100);
  await page.evaluate(() => FluyoI18n.setLocale("es"));
  check(await txt(page, "#psPlay") === "▶ " + T("es", "story.play") && await txt(page, "#prExit .lbl") === T("es", "present.exit"), "Present detenida, de vuelta al español");
  await page.evaluate(() => exitPresent()); await page.waitForTimeout(100);
  await page.evaluate(() => FluyoI18n.setLocale("en"));
  check(await txt(page, "#psPlay") === "▶ Play", "fuera de Present, el mando oculto sigue al idioma (inglés)");
  await page.evaluate(() => FluyoI18n.setLocale("es"));
  check(await txt(page, "#psPlay") === "▶ Reproducir" && await txt(page, "#psStop") === "■ Detener", "… y de vuelta al español");
  check(await page.evaluate(() => JSON.stringify(serializeProject())) === before.doc, "el documento no cambia");
  check(await page.evaluate(() => undoStack.length) === before.undo, "Deshacer intacto (" + before.undo + ")");
  check(await page.evaluate(() => localStorage.getItem("fluyo.ui.lang")) === before.pref, "setLocale sin persist no guarda preferencia");
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

async function liveViewer(browser, base) {
  console.log("\nen vivo · Viewer (sin recargar)");
  const { ctx, page, errors } = await open(browser, base, "/s/?s=demo", { width: 390, height: 844, mobile: true });
  await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  const before = await snapshot(page);
  const band = () => page.evaluate(() => [document.getElementById("stKicker").textContent, document.getElementById("stPlay").textContent, document.getElementById("stTitle").textContent]);
  const b0 = await band();
  await page.evaluate(() => FluyoI18n.setLocale("zh"));
  const b1 = await band();
  check(b1[0] === T("zh", "story.group") && b1[1].includes(T("zh", "story.playStory")), `banda en chino: ${b1.slice(0, 2).join(" / ")}`);
  check(b1[2] === b0[2], `título del autor intacto («${b0[2]}»)`);
  check(await txt(page, "#brand a") === T("zh", "viewer.madeWith"), "pie en chino");
  const c = await clipping(page, "#chrome");
  check(c.out.length === 0, "cabecera sin desbordes tras el cambio " + c.out.join(" | "));
  await page.evaluate(() => FluyoI18n.setLocale("es"));
  const after = await snapshot(page);
  check(after === before, "de vuelta al español, byte a byte " + diffLines(before, after));
  check(JSON.stringify(await band()) === JSON.stringify(b0), "banda de vuelta al español");
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

/* Pseudo-idioma: lo que queda sin ⟦ ⟧ dentro de controles de la interfaz es texto sin migrar (o contenido del autor). */
async function pseudo(browser, base) {
  console.log("\npseudo-idioma (qps, +40 %)");
  const init = "window.FLUYO_LOCALES=" + JSON.stringify({ qps: pseudoDictionary() }) + ";";
  const unmarked = (page, sel) => page.evaluate(({ sel, OPEN, CLOSE }) => {
    const out = [];
    for (const r of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.data.trim(), el = n.parentElement;
        if (!/\p{L}/u.test(t) || !el || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue;
        if (el.closest("[aria-hidden=true]") || /^(Fluyo|flu|yo)$/.test(t)) continue;
        if (!(n.data.includes(OPEN) || el.textContent.includes(OPEN))) out.push(t.slice(0, 40));
      }
    }
    return out;
  }, { sel, OPEN, CLOSE });
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844, mobile: true }]) {
    const v = await open(browser, base, "/s/?s=demo&lang=qps", vp, { init });
    await v.page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
    /* sin #pgTabs/#pgSelect: sus rótulos son los nombres de página del documento (contenido del autor) */
    const left = await unmarked(v.page, "#chrome .tools button, #brand, #stActions button, #prBar button, #status");
    check(left.length === 0, `Viewer ${vp.width}: ningún control sin pasar por FluyoI18n ` + JSON.stringify(left));
    const c = await clipping(v.page, "#chrome");
    (c.out.length ? info : (m) => check(true, m))(`Viewer ${vp.width} con +40 %: cabecera ${c.out.length ? c.out.join(" | ") : "sin desbordes"}`);
    await v.page.screenshot({ path: path.join(shots, `pseudo-viewer-${vp.width}.png`) });
    await v.ctx.close();
  }
  const e = await open(browser, base, "/?lang=qps", { width: 1440, height: 900 }, { init });
  await editorReady(e.page);
  const header = await unmarked(e.page, "body > header");
  check(header.length === 0, "editor: la cabecera (migrada en I18N-001) entera por FluyoI18n " + JSON.stringify(header));
  const rest = await unmarked(e.page, "#rail, #panelProperties, #moreMenu, #canvasMenu");
  info(`editor fuera de la cabecera: ${rest.length} textos visibles sin migrar (S1–S3), p. ej. ${JSON.stringify(rest.slice(0, 6))}`);
  const c = await clipping(e.page, "body > header");
  (c.out.length ? info : (m) => check(true, m))(`editor 1440 con +40 %: cabecera ${c.out.length ? c.out.join(" | ") : "sin desbordes"}`);
  await e.page.screenshot({ path: path.join(shots, "pseudo-editor-1440.png") });
  await e.ctx.close();
}

/* Share de punta a punta: el diálogo crea el enlace en inglés; quien lo abre con su preferencia en japonés ve el Viewer en
   japonés con el contenido del autor intacto; «Abrir en Fluyo» lleva al editor en japonés con el mismo documento. */
async function share(browser, base) {
  console.log("\nShare · diálogo (en) → Viewer (ja, por preferencia) → «Abrir en Fluyo»");
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  await ctxA.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const a = await open(browser, base, "/?lang=en", null, { ctx: ctxA });
  await editorReady(a.page);
  await a.page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FIXTURE);
  const story = await a.page.evaluate(() => (scActiveScenario() || {}).name || null);
  await a.page.click("#btnShare");
  await a.page.waitForSelector("#shareDialog[open]");
  await a.page.click("#shareCreate");
  await a.page.waitForFunction(() => /\/s\/#d=/.test(document.getElementById("shareLink").value), null, { timeout: 8000 });
  const link = await a.page.$eval("#shareLink", (i) => i.value);
  check(link.startsWith(base + "/s/#d="), "enlace creado: " + link.slice(0, 48) + "…");
  const doc0 = await a.page.evaluate(() => JSON.stringify(serializeProject().doc.pages[0].nodes.map((n) => n.label)));
  check(a.errors.length === 0, "editor sin errores de consola " + a.errors.join(" | "));
  await ctxA.close();

  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctxB.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await ctxB.addInitScript(() => { try { localStorage.setItem("fluyo.ui.lang", "ja"); } catch (e) {} });
  const b = await open(browser, base, null, null, { ctx: ctxB });
  await b.page.goto(link);
  await b.page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  check(await b.page.evaluate(() => FluyoI18n.locale()) === "ja", "el Viewer abre en el idioma de quien mira (preferencia ja), no en el del autor");
  if (story) check(await txt(b.page, "#stKicker") === T("ja", "story.group") && await txt(b.page, "#stTitle") === story, `Historia del autor intacta: «${story}»`);
  await b.page.click("#btnOpen");
  await b.page.waitForFunction(() => typeof applyProjectData === "function" && typeof FluyoI18n === "object", null, { timeout: 8000 });
  await b.page.waitForTimeout(500);
  if (await b.page.locator("#incomingModal, #incomingDialog").first().isVisible().catch(() => false)) await b.page.locator("#incomingOpen").click().catch(() => {});
  check(await b.page.evaluate(() => FluyoI18n.locale()) === "ja", "«Abrir en Fluyo»: el editor sigue en japonés");
  check(await b.page.evaluate(() => JSON.stringify(serializeProject().doc.pages[0].nodes.map((n) => n.label))) === doc0, "el documento llega igual al editor");
  check(b.errors.length === 0, "sin errores de consola " + b.errors.join(" | "));
  await ctxB.close();
}

/* Offline con el service worker. Editor: instala v109 con los ocho diccionarios; sin red, abre en japonés. Viewer: con la
   preferencia en chino, el enlace sin red abre en chino. Instalación solo-Viewer: solo los diccionarios comunes; sin red, francés. */
async function offlineFlow(browser, base) {
  console.log("\noffline · service worker v109");
  const DICTS_ALL = fs.readdirSync(path.join(root, "js")).filter((f) => /^i18n-[a-z]+(-editor)?\.js$/.test(f)).map((f) => "/js/" + f);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "allow" });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const { page, errors } = await open(browser, base, "/", null, { ctx });
  await editorReady(page);
  /* page.waitForFunction NO espera a un predicado asíncrono (la promesa ya cuenta como verdadera): se evalúa en bucle, como el
     until de fluyo-014-browser y de fluyo-sw-viewer-001-browser. */
  const until = async (pg, fn, arg, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await pg.evaluate(fn, arg).catch(() => false)) return true; await pg.waitForTimeout(250); } return false; };
  const swReady = (pg, l) => until(pg, async (l) => { const r = await navigator.serviceWorker.getRegistration();
    if (!(r && r.active && r.active.state === "activated" && navigator.serviceWorker.controller)) return false;
    const k = await caches.keys(); if (k.length !== 1 || k[0] !== "fluyo-static-v112") return false;
    const c = await caches.open("fluyo-static-v112");
    return (await Promise.all(l.map((u) => c.match(location.origin + u)))).every(Boolean); }, l);
  const list = [...DICTS_ALL, "/js/i18n.js"];
  check(await swReady(page, list), `SW v109 activo y controlando el editor; los ${DICTS_ALL.length} diccionarios y el runtime, en caché`);
  const link = await page.evaluate(async (fx) => { applyProjectData(JSON.parse(fx)); return createShareUrl(serializeProject(), location.origin + "/", { kind: "diagram" }); }, FIXTURE);
  offline = true; await ctx.setOffline(true);
  /* sin red, en una pestaña nueva (como fluyo-014-browser) */
  const pj = await ctx.newPage();
  pj.on("dialog", (d) => d.dismiss());
  await pj.goto(base + "/?lang=ja");
  await editorReady(pj);
  check(await txt(pj, "#btnShare .lbl") === T("ja", "editor.share"), "sin red: el editor abre en japonés");
  await checkMissing(pj, "ja", "sin red: ");
  await pj.evaluate(() => localStorage.setItem("fluyo.ui.lang", "zh"));
  const v = await ctx.newPage();
  await v.goto(link);
  await v.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 10000 });
  check(await txt(v, "#brand a") === T("zh", "viewer.madeWith"), "sin red: el enlace compartido abre en chino (preferencia guardada)");
  offline = false; await ctx.setOffline(false);
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();

  const ctxV = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: "allow" });
  await ctxV.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const pv = await ctxV.newPage();
  await pv.goto(link);
  await pv.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  check(await swReady(pv, [...DICTS_ALL.filter((u) => !u.includes("-editor")), "/js/i18n.js"]), "solo-Viewer: SW v109 activo, controlando, con los diccionarios comunes");
  const vc = await pv.evaluate(async (list) => { const c = await caches.open("fluyo-static-v112"); return Promise.all(list.map(async (u) => !!(await c.match(location.origin + u)))); }, DICTS_ALL);
  const want = DICTS_ALL.map((u) => !u.includes("-editor"));
  check(JSON.stringify(vc) === JSON.stringify(want), "instalación solo-Viewer: los comunes sí, los del editor no");
  offline = true; await ctxV.setOffline(true);
  await pv.goto(link.replace("/s/#", "/s/?lang=fr#"));
  await pv.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 10000 });
  check(await txt(pv, "#brand a") === T("fr", "viewer.madeWith"), "solo-Viewer sin red, ?lang=fr: francés");
  offline = false; await ctxV.setOffline(false);
  await ctxV.close();
}

/* Documentos existentes: los ocho ejemplos y el fixture se serializan idénticos en los cinco idiomas. */
async function documents(browser, base) {
  console.log("\ndocumentos existentes · 8 ejemplos + fixture complejo, en los cinco idiomas");
  const files = { fixture: FIXTURE, ...Object.fromEntries(EXAMPLES.map((f) => [f, fs.readFileSync(path.join(root, "ejemplos", "data", f), "utf8")])) };
  const out = {};
  for (const lang of LANGS) {
    const { ctx, page } = await open(browser, base, "/" + (lang === "es" ? "" : "?lang=" + lang), { width: 1280, height: 800 });
    await editorReady(page);
    out[lang] = await page.evaluate((files) => Object.fromEntries(Object.entries(files).map(([k, s]) => { applyProjectData(JSON.parse(s)); return [k, JSON.stringify(serializeProject())]; })), files);
    await ctx.close();
  }
  for (const lang of LANGS.slice(1)) check(Object.keys(files).every((k) => out[lang][k] === out.es[k]), `${lang}: ${Object.keys(files).length} documentos idénticos al español`);
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    if (process.env.ONLY === "offline") { await offlineFlow(browser, base); return; }
    for (const lang of LANGS) for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844, mobile: true }]) await editor(browser, base, lang, vp);
    for (const lang of LANGS) for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844, mobile: true }]) await viewer(browser, base, lang, vp);
    for (const lang of LANGS) await notFound(browser, base, lang);
    await liveEditor(browser, base);
    await liveViewer(browser, base);
    await pseudo(browser, base);
    await share(browser, base);
    await offlineFlow(browser, base);
    await documents(browser, base);
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
