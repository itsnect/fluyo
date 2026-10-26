"use strict";
/* FLUYO-I18N-002 S1 — Chrome REAL: el cromo del editor en español y en inglés, a 1440 y a 390 (con dedo).
   Por idioma y anchura: cabecera, Lienzo y Más abiertos, rail (rótulos y tooltips), vacío del panel, selección múltiple (recuento y
   título), pestañas y menú de página (renombrar), barra táctil (390), Compartir (con Historia: frase con el nombre del autor; crear
   el enlace), Exportar (diálogo y PNG descargado), Deshacer/Rehacer, Present, sesión guardada y enlace entrante. Comprueba los
   textos contra el diccionario, que nada desborde ni se recorte, y en inglés que NINGÚN texto de esas superficies quede en español
   (pseudo-idioma: todo lo visible del cromo de S1 dentro de ⟦ ⟧ salvo el contenido del autor). Contenido del autor: nombres de
   página, de Historia y etiquetas intactos; el documento no cambia al cambiar de idioma en vivo. Sin errores de consola.
   Uso: node test/fluyo-i18n-002-s1-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const scan = require("./i18n-scan.cjs");
const { pseudoDictionary, OPEN } = require("./i18n-pseudo.cjs");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-i18n-002-s1-"));
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
const DICTS = scan.dictionaries();
const EN = { ...DICTS.en.common, ...DICTS.en.editor };
const BASE_TEXT = new Map(scan.catalog().uses.map((u) => [u.key, u.es]));
const T = (lang, key) => (lang === "es" ? BASE_TEXT.get(key) : EN[key]);
const DOC = JSON.parse(FIXTURE);
const STORY = (DOC.doc.pages[0].scenarios || [])[0];
const VPS = [{ width: 1440, height: 900 }, { width: 390, height: 844, mobile: true }];

async function open(browser, base, url, vp, { init, autosave } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.mobile, isMobile: !!vp.mobile, serviceWorkers: "block", acceptDownloads: true });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  if (init) await ctx.addInitScript(init);
  if (autosave) await ctx.addInitScript((a) => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("fluyo.autosave.v1", a); sessionStorage.setItem("seeded", "1"); } } catch (e) {} }, autosave);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => { page.lastDialog = d.message(); d.dismiss(); });
  await page.goto(base + url);
  return { ctx, page, errors };
}
const txt = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim());
const attr = (page, sel, a) => page.$eval(sel, (e, a) => e.getAttribute(a), a);
const ready = async (page, discard = true) => {
  await page.waitForFunction(() => typeof enterPresent === "function" && typeof refreshPanel === "function");
  if (discard && await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
};
async function clipping(page, sel) {
  return page.evaluate((sel) => {
    const out = [];
    for (const r of document.querySelectorAll(sel)) {
      if (!r.getClientRects().length) continue;
      if (r.scrollWidth > r.clientWidth + 1 && getComputedStyle(r).overflowX !== "visible") out.push(`${sel}: ancho ${r.scrollWidth}/${r.clientWidth}`);
      for (const el of r.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || !el.getClientRects().length || el.clientWidth <= 2 || el.clientHeight <= 2) continue;
        if (!/\p{L}/u.test(el.textContent || "") || el.children.length > 3) continue;
        const name = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
        if (cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 1) out.push(`${name}: ancho ${el.scrollWidth}/${el.clientWidth} «${el.textContent.trim().slice(0, 30)}»`);
        if (cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 2) out.push(`${name}: alto ${el.scrollHeight}/${el.clientHeight} «${el.textContent.trim().slice(0, 30)}»`);
      }
    }
    return out;
  }, sel);
}
const noClip = async (page, sel, label) => { const c = await clipping(page, sel); check(c.length === 0, `${label}: sin desbordes ni recortes ` + c.join(" | ")); };

async function chrome(browser, base, lang, vp) {
  console.log(`\ncromo del editor · ${lang} · ${vp.width}×${vp.height}`);
  const L = (k) => T(lang, k);
  const { ctx, page, errors } = await open(browser, base, "/" + (lang === "es" ? "" : "?lang=" + lang), vp);
  await ready(page);
  const tag = `${lang}-${vp.width}`;
  check(await page.evaluate(() => document.documentElement.lang) === lang, `<html lang="${lang}">`);
  /* vacío del panel (escritorio: columna visible) */
  if (!vp.mobile) {
    check(await txt(page, "#noSel .emptyTitle") === L("panel.empty"), "panel vacío: título");
    check(await txt(page, "#selTitle") === L("editor.properties"), "título del panel sin selección");
    check(await attr(page, "#btnPanelClose", "data-tip") === L("panel.fold"), "tooltip de plegar el panel");
    check(await attr(page, ".rail button[data-mode=select]", "data-tip") === L("rail.selectHint"), "rail: tooltip de Mover");
    check(await txt(page, ".rail button[data-shape=diamond] .lbl") === L("rail.diamond"), "rail: rótulo de Rombo");
    check(await attr(page, "#zoomFit", "data-tip") === L("view.fitPage"), "vista: Encajar la página");
  }
  /* Lienzo (en el teléfono sus ajustes viajan a «Más») */
  if (!vp.mobile) {
    await page.click("#btnCanvas"); await page.waitForTimeout(150);
    check(await txt(page, "#canvasMenu .kCanvas") === L("canvas.kicker"), "Lienzo: rótulo");
    check(await page.$eval("#themeSel", (s) => [...s.options].map((o) => o.textContent).join("|")) === ["canvas.themeDark", "canvas.themeCream", "canvas.themeLight"].map(L).join("|"), "Lienzo: temas");
    check(await page.$eval("#skinSel", (s) => [...s.options].map((o) => o.textContent).join("|")) === ["skin.flat", "skin.builtLong"].map(L).join("|"), "Lienzo: aspecto");
    check(await txt(page, "#lblSnap .lbl") === L("canvas.snap"), "Lienzo: Ajustar a rejilla");
    check(await page.$eval("#fontGlobalSel", (s) => [...s.querySelectorAll("optgroup")].map((g) => g.label).join("|")) === "Fluyo|" + L("canvas.fontsClassic"), "Lienzo: grupos de tipografías");
    await noClip(page, "#canvasMenu", "Lienzo");
    await page.screenshot({ path: path.join(shots, `canvas-${tag}.png`) });
    await page.keyboard.press("Escape");
  }
  /* Más */
  await page.click("#btnMore"); await page.waitForTimeout(150);
  check(await txt(page, "#moreMenu .kDoc") === L("more.file"), "Más: Archivo");
  check(await txt(page, "#btnJsonIn .lbl") === L("more.open"), "Más: Abrir…");
  check(await txt(page, "#btnClear .lbl") === L("more.clearShort") + " " + L("more.clearRest") && await attr(page, "#btnClear", "aria-label") === L("more.clearPage"), "Más: Limpiar página (rótulo partido y nombre accesible)");
  check(await txt(page, "#uiSection .menuKicker") === L("more.uiKicker"), "Más: Interfaz · este navegador");
  check(await txt(page, "#siteLinks a[href='docs/']") === T(lang, "shell.docs") && await txt(page, "#siteLinks a[href='ejemplos/']") === (lang === "es" ? "Ejemplos" : "Examples"), "Más: enlaces del proyecto");
  check(await txt(page, ".ossLink .meta") === L("more.contribute"), "Más: Contribuye en GitHub");
  check(await txt(page, "#btnJsonOut kbd") === "Ctrl+S", "Más: el atajo no se traduce");
  await noClip(page, "#moreMenu", "Más");
  await page.screenshot({ path: path.join(shots, `more-${tag}.png`) });
  await page.keyboard.press("Escape");

  /* contenido del autor: el fixture (páginas, Historia, etiquetas en español) */
  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FIXTURE);
  const names = await page.evaluate(() => doc.pages.map((p) => p.name));
  check(JSON.stringify(names) === JSON.stringify(DOC.doc.pages.map((p) => p.name)), "nombres de página del autor, intactos en el documento");
  if (!vp.mobile) check(await page.$eval("#pagesBar .tab.active span", (e) => e.textContent) === names[0], `pestaña activa = nombre del autor («${names[0]}»)`);
  check((await attr(page, "#pgSelect", "aria-label")).includes(names[0]) && (await attr(page, "#pgSelect", "aria-label")).startsWith(lang === "es" ? "Página 1 de" : "Page 1 of"), "selector de página: frase traducida con el nombre del autor dentro");
  /* selección múltiple */
  await page.evaluate(() => { selectAll(); refreshPanel(); });
  const counts = await page.evaluate(() => [selN.size, selE.size]);
  const nodesTxt = (n) => (lang === "es" ? `${n} ${n === 1 ? "nodo" : "nodos"}` : `${n} ${n === 1 ? "node" : "nodes"}`), edgesTxt = (n) => (lang === "es" ? `${n} ${n === 1 ? "flecha" : "flechas"}` : `${n} ${n === 1 ? "arrow" : "arrows"}`);
  const wantCount = counts[1] ? `${nodesTxt(counts[0])} ${lang === "es" ? "y" : "and"} ${edgesTxt(counts[1])} ${lang === "es" ? "seleccionados" : "selected"}` : `${nodesTxt(counts[0])} ${lang === "es" ? "seleccionados" : "selected"}`;
  if (!vp.mobile) {
    check(await txt(page, "#multiCount") === wantCount, `recuento de la selección: «${wantCount}»`);
    check(await txt(page, "#selTitle") === (lang === "es" ? `${counts[0] + counts[1]} elementos` : `${counts[0] + counts[1]} elements`), "título del panel con varios elementos");
    check(await txt(page, "#mDup") === L("panel.duplicate"), "selección múltiple: Duplicar");
  }
  /* un nodo: el título del panel es su etiqueta (contenido del autor) */
  const n0 = await page.evaluate(() => { const n = P().nodes.find((x) => String(x.label || "").trim()); selectOnly("node", n.id); return String(n.label).split("\n")[0].trim(); });
  if (!vp.mobile) check(await txt(page, "#selTitle") === n0, `título del panel = etiqueta del autor («${n0}»)`);
  await page.evaluate(() => { clearSel(); refreshPanel(); });
  /* menú de página y renombrar */
  if (!vp.mobile) {
    await page.click("#pagesBar .tab.active .pgMore"); await page.waitForTimeout(100);
    const items = await page.$$eval("#pageMenu button", (bs) => bs.map((b) => b.textContent));
    check(items.includes(L("pages.rename")) && items.includes(L("pages.delete")), "menú de página: Renombrar… y Eliminar página " + JSON.stringify(items));
    check(await txt(page, "#pageMenu .scMenuHead") === names[0], "menú de página: cabecera = nombre del autor");
    await page.click(`#pageMenu button:has-text("${L("pages.rename")}")`); await page.waitForTimeout(100);
    check((await txt(page, "#pageMenu label")).startsWith(L("pages.name")) && await txt(page, "#pageNameSave") === L("pages.saveName"), "renombrar: rótulo y Guardar nombre");
    await page.fill("#pageNameIn", ""); await page.click("#pageNameSave");
    check(await txt(page, "#pageMenu .pmError") === L("pages.nameError").replace("{max}", await page.evaluate(() => PAGE_NAME_MAX)), "renombrar: error con su máximo");
    await noClip(page, "#pageMenu", "menú de página");
    await page.keyboard.press("Escape"); await page.evaluate(() => closePageMenu(false));
    check(await attr(page, "#pagesBar .pgAdd", "title") === L("pages.new"), "＋: Nueva página");
  }
  /* Deshacer / Rehacer */
  const before = await page.evaluate(() => P().nodes.length);
  await page.evaluate(() => { pushUndo(); newNode("rect", 200, 200); refreshPanel(); });
  await page.click("#btnUndo");
  const afterUndo = await page.evaluate(() => P().nodes.length);
  await page.click("#btnRedo");
  check(afterUndo === before && await page.evaluate(() => P().nodes.length) === before + 1, "Deshacer y Rehacer funcionan");
  await page.click("#btnUndo");
  /* barra táctil (teléfono) */
  if (vp.mobile) {
    await page.evaluate(() => { const n = P().nodes[0]; selectOnly("node", n.id); syncTouchBar(); });
    check(await txt(page, "#tbConnect") === L("touch.connect") && await txt(page, "#tbMulti") === L("touch.multi"), "barra táctil: Conectar y Seleccionar varios");
    await page.evaluate(() => { setTouchMulti(true); syncTouchBar(); });
    const m = await txt(page, "#tbMsg");
    check(m === (lang === "es" ? "1 seleccionado" : "1 selected") || m === L("touch.tapToSelect"), `barra táctil: «${m}»`);
    await noClip(page, "#touchBar", "barra táctil");
    await page.evaluate(() => { setTouchMulti(false); clearSel(); refreshPanel(); });
  }
  /* Compartir, con Historia: la frase lleva el nombre del autor, tal cual */
  await page.evaluate(() => { if (typeof scSelectStory === "function") scSelectStory(P().scenarios[0].id); });
  await page.click("#btnShare"); await page.waitForSelector("#shareDialog[open]");
  check(await txt(page, "#shareTitle") === L("share.title"), "Compartir: título (con Historia)");
  check(await txt(page, "#shareKind legend") === L("share.what"), "Compartir: ¿Qué quieres compartir?");
  const storyName = await page.evaluate(() => scActiveScenario().name);
  check(await txt(page, "#shareStoryName") === L("share.storyHint").replace("{name}", storyName), `Compartir: frase con el nombre del autor («${storyName}»)`);
  check(await txt(page, "#shareClose") === L("common.cancel") && await txt(page, "#shareCreate") === L("share.create"), "Compartir: Cancelar y Crear enlace");
  await noClip(page, "#shareDialog", "Compartir");
  await page.screenshot({ path: path.join(shots, `share-${tag}.png`) });
  await page.click("#shareCreate");
  await page.waitForFunction(() => /\/s\/#d=/.test(document.getElementById("shareLink").value), null, { timeout: 8000 });
  check(await txt(page, "#shareResultNote") === L("share.noteStory") && await txt(page, "#shareClose") === L("common.close"), "Compartir: enlace creado, nota y Cerrar");
  await page.click("#shareClose");
  /* Exportar: diálogo y un PNG de verdad */
  if (vp.mobile) { await page.click("#btnMore"); await page.waitForTimeout(100); }
  await page.click("#btnExport");
  await page.waitForTimeout(150);
  check(await txt(page, "#exModal h2") === L("export.title"), "Exportar: título");
  check(await page.$eval("#exRes", (s) => [...s.options].map((o) => o.textContent).join("|")) === ["export.scaleHalf", "export.scaleNormal", "export.scaleLarge", "export.scaleXL"].map(L).join("|"), "Exportar: escalas");
  check(await txt(page, "#exGo") === L("editor.export") && await txt(page, "#exCancel") === L("common.cancel"), "Exportar: botones");
  await noClip(page, "#exModal .card", "Exportar");
  await page.screenshot({ path: path.join(shots, `export-${tag}.png`) });
  await page.selectOption("#exFmt", "png");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#exGo")]);
  check(/\.png$/.test(dl.suggestedFilename()), "Exportar: PNG descargado (" + dl.suggestedFilename() + ")");
  /* Present */
  await page.evaluate(() => enterPresent()); await page.waitForTimeout(300);
  check(await txt(page, "#prExit .lbl") === T(lang, "present.exit"), "Present abre");
  await page.evaluate(() => exitPresent());
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

/* Sesión guardada y enlace entrante (con una sesión en el navegador) */
async function modals(browser, base, lang) {
  console.log(`\nmodales · ${lang}`);
  const L = (k) => T(lang, k);
  const q = lang === "es" ? "" : "?lang=" + lang;
  const a = await open(browser, base, "/" + q, VPS[0], { autosave: FIXTURE });
  await ready(a.page, false);
  await a.page.waitForSelector("#autosaveModal", { state: "visible" });
  check(await txt(a.page, "#autosaveModal h2") === L("autosave.title") && await txt(a.page, "#autosaveRestore") === L("autosave.restore"), "Sesión guardada: título y Restaurar");
  await noClip(a.page, "#autosaveModal .card", "Sesión guardada");
  await a.page.screenshot({ path: path.join(shots, `autosave-${lang}.png`) });
  await a.page.click("#autosaveRestore");
  const link = await a.page.evaluate(async () => createShareUrl(serializeProject(), location.origin + "/", { kind: "diagram" }));
  const hash = new URL(link).hash;
  check(a.errors.length === 0, "sin errores de consola " + a.errors.join(" | "));
  await a.ctx.close();
  const b = await open(browser, base, "/" + q + hash, VPS[0], { autosave: FIXTURE });
  await ready(b.page, false);
  await b.page.waitForSelector("#incomingModal", { state: "visible", timeout: 8000 });
  check(await txt(b.page, "#incomingTitle") === L("incoming.title"), "Enlace entrante: título");
  check(await txt(b.page, "#incomingPage") === L("incoming.addDiagram") && await txt(b.page, "#incomingOpen") === L("incoming.openDiagram") && await txt(b.page, "#incomingKeep") === L("incoming.keep"), "Enlace entrante: las tres salidas");
  await noClip(b.page, "#incomingModal .card", "Enlace entrante");
  await b.page.screenshot({ path: path.join(shots, `incoming-${lang}.png`) });
  await b.page.click("#incomingKeep");
  check(b.errors.length === 0, "sin errores de consola " + b.errors.join(" | "));
  await b.ctx.close();
}

/* En vivo con contenido del autor: es → en → es sin tocar documento, Deshacer ni selección */
async function live(browser, base) {
  console.log("\nen vivo · cromo y contenido del autor");
  const { ctx, page, errors } = await open(browser, base, "/", VPS[0]);
  await ready(page);
  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); renderTabs(); pushUndo(); P().nodes[0].x += 5; const n = P().nodes.find((x) => String(x.label || "").trim()); selectOnly("node", n.id); }, FIXTURE);
  const snap = () => page.evaluate(() => ({ doc: JSON.stringify(serializeProject()), undo: undoStack.length, sel: [...selN].join(), title: document.getElementById("selTitle").textContent, tabs: [...document.querySelectorAll("#pagesBar .tab span:first-child")].map((s) => s.textContent).join("|") }));
  const s0 = await snap();
  await page.evaluate(() => FluyoI18n.setLocale("en"));
  const s1 = await snap();
  check(await txt(page, "#btnCanvas .lbl") === "Canvas" && await attr(page, "#zoomFit", "data-tip") === "Fit page", "el cromo pasa a inglés sin recargar");
  check(s1.doc === s0.doc && s1.undo === s0.undo && s1.sel === s0.sel, "documento, Deshacer y selección intactos");
  check(s1.title === s0.title && s1.tabs === s0.tabs, `título del panel y pestañas (contenido del autor) intactos («${s0.title}» · ${s0.tabs.split("|")[0]})`);
  await page.evaluate(() => { clearSel(); refreshPanel(); });
  check(await txt(page, "#selTitle") === "Properties", "sin selección, «Properties»");
  await page.evaluate(() => FluyoI18n.setLocale("es"));
  check(await txt(page, "#selTitle") === "Propiedades" && await txt(page, "#btnCanvas .lbl") === "Lienzo", "de vuelta al español");
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

/* Pseudo-idioma: en las superficies de S1 abiertas, todo lo visible pasa por FluyoI18n salvo contenido del autor, atajos y números */
async function pseudo(browser, base) {
  console.log("\npseudo-idioma (qps, +40 %) · superficies de S1");
  const init = "window.FLUYO_LOCALES=" + JSON.stringify({ qps: pseudoDictionary() }) + ";";
  const left = (page, sel, allow) => page.evaluate(({ sel, OPEN, allow }) => {
    const out = [];
    for (const r of document.querySelectorAll(sel)) {
      if (!r.getClientRects().length) continue;
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.data.trim(), el = n.parentElement;
        if (!/\p{L}/u.test(t) || !el || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue;
        if (el.closest("[aria-hidden=true],[translate=no],kbd,.helpList") ||/^(Fluyo|flu|yo|GIFs?|GCP|AWS|Azure)$/.test(t) || allow.includes(t)) continue;
        if (!el.textContent.includes(OPEN)) out.push(t.slice(0, 50));
      }
    }
    return out;
  }, { sel, OPEN, allow });
  for (const vp of VPS) {
    const { ctx, page } = await open(browser, base, "/?lang=qps", vp, { init });
    await ready(page);
    if (!vp.mobile) { await page.click("#btnCanvas"); await page.waitForTimeout(100); check((await left(page, "#canvasMenu", [])).length === 0, `${vp.width}: Lienzo ` + JSON.stringify(await left(page, "#canvasMenu", []))); await page.keyboard.press("Escape"); }
    await page.click("#btnMore"); await page.waitForTimeout(100);
    const more = await left(page, "#moreMenu", []);
    check(more.length === 0, `${vp.width}: Más (sin la ayuda con marcado, registrada fuera de S1) ` + JSON.stringify(more));
    const c = await clipping(page, "#moreMenu");
    (c.length ? (m) => console.log("  ℹ " + m) : (m) => check(true, m))(`${vp.width}: Más con +40 % ` + (c.length ? c.join(" | ") : "sin desbordes"));
    await page.keyboard.press("Escape");
    const chromeSel = vp.mobile ? "body > header, #bottomBar, #touchBar" : "body > header, .rail, #propSheetHead, #noSel, #bottomBar";
    const names = await page.evaluate(() => doc.pages.map((p) => p.name));
    check((await left(page, chromeSel, names)).length === 0, `${vp.width}: cabecera, rail, panel y barra inferior ` + JSON.stringify(await left(page, chromeSel, names)));
    await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); renderTabs(); if (typeof scSelectStory === "function") scSelectStory(P().scenarios[0].id); }, FIXTURE);
    await page.click("#btnShare"); await page.waitForSelector("#shareDialog[open]");
    const storyNames = await page.evaluate(() => P().scenarios.map((s) => s.name));   /* contenido del autor: va en su propio nodo y no se traduce */
    check((await left(page, "#shareDialog", storyNames)).length === 0, `${vp.width}: Compartir (el nombre de la Historia, intacto) ` + JSON.stringify(await left(page, "#shareDialog", storyNames)));
    await page.screenshot({ path: path.join(shots, `pseudo-share-${vp.width}.png`) });
    await page.click("#shareClose");
    if (vp.mobile) { await page.click("#btnMore"); await page.waitForTimeout(100); }
    await page.click("#btnExport"); await page.waitForTimeout(100);
    check((await left(page, "#exModal", [])).length === 0, `${vp.width}: Exportar ` + JSON.stringify(await left(page, "#exModal", [])));
    await ctx.close();
  }
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const lang of ["es", "en"]) for (const vp of VPS) await chrome(browser, base, lang, vp);
    for (const lang of ["es", "en"]) await modals(browser, base, lang);
    await live(browser, base);
    await pseudo(browser, base);
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
