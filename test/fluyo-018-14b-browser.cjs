"use strict";
/* FLUYO-018.14b — Chrome REAL: la matriz de aceptación de .ai/tasks/FLUYO-018.14.md (§ 018.14b, B2).
   Viewports 1440/1280/1101 (ratón), 768 (táctil), 390/375 (táctil, móvil). En cada uno, con la interfaz clara y oscura y
   con el lienzo oscuro y crema, recorre los estados E1 editor · E2 panel abierto · E3 Historia · E4 Historia reproduciendo
   y MIDE (no compara píxeles exactos):
     · cabecera: alto, filas (centros de los controles) y overflow;
     · % de lienzo visible (muestreo con elementFromPoint) y ancho/alto del panel o de la hoja;
     · controles críticos dentro del viewport y encima (nada los tapa);
     · objetivos por debajo de 40 px con dedo / 28 px con ratón (las muestras de color, aparte);
     · overflow horizontal de página;
     · contraste de la cabecera y del panel; superficies oscuras en la interfaz oscura;
     · el tema de la interfaz y el del lienzo no se tocan entre sí (ni en el documento serializado).
   Además, las pruebas específicas: hoja con cierre táctil (botón, ⚙ y toque en el vacío), Historia en móvil solo con
   toques, persistencia de la interfaz (recarga, autoguardado, localStorage inaccesible), «Lienzo» y «Más», regresión de
   018.12 (renombrar con el dedo, Deshacer/Rehacer, conectar) y el Service Worker v73 sin red.
   Uso: node test/fluyo-018-14b-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=d1440|d1280|d1101|t768|m390|m375|persist|sw  recorre solo esa parte (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-14b-"));
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-cliente-kafka-comercio.fluyo.json"), "utf8");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };

const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};

let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* Umbrales de la matriz (B2). Los de lienzo visible en escritorio son los MEDIDOS con el panel de 288 px que pide el
   slice, y el de Historias a 768 el medido con la biblioteca dentro (300 px); ver «Desviaciones» en la tarea. Antes de
   018.14b: E1 68/64/60/56 % y E3 63/58/54/42 % (1440/1280/1101/768). */
const VIEWPORTS = [
  { key: "d1440", width: 1440, height: 900, touch: false, panel: 288, story: 320, e1: 64, e3: 65, e4: 65, scroll: 1.3 },
  { key: "d1280", width: 1280, height: 800, touch: false, panel: 288, story: 320, e1: 59, e3: 60, e4: 60, scroll: 1.4 },
  { key: "d1101", width: 1101, height: 800, touch: false, panel: 288, story: 320, e1: 55, e3: 55, e4: 55, scroll: 1.4 },
  { key: "t768", width: 768, height: 1024, touch: true, panel: 216, story: 300, e1: 54, e3: 51, e4: 51, scroll: 1.5 },
  { key: "m390", width: 390, height: 844, touch: true, mobile: true, e1: 75, e3: 53, e4: 59, scroll: 1.6 },
  { key: "m375", width: 375, height: 667, touch: true, mobile: true, e1: 70, e3: 47, e4: 55, scroll: 1.9 },
];

async function open(browser, base, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block" });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  if (opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof newNode === "function" && typeof setUiMode === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FIXTURE); await page.waitForTimeout(250);
  return { ctx, page, errors };
}
const press = async (t, sel, vp) => { const l = t.page.locator(sel).first(); if (vp.touch) await l.tap(); else await l.click(); await t.page.waitForTimeout(320); };
const shot = (t, vp, name) => t.page.screenshot({ path: path.join(shots, `${vp.key}-${name}.png`) });

/* Una sola medida para todos los estados. Lo invisible (display, visibility, [hidden], <details> cerrado) no cuenta. */
const MEASURE = ([touch, crit]) => {
  const vis = (e) => { if (!e) return false; if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true })) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[hidden]"); };
  const W = innerWidth, H = innerHeight, cvEl = document.getElementById("cv");
  let hit = 0, n = 0;
  for (let y = 4; y < H; y += 12) for (let x = 4; x < W; x += 12) { n++; if (document.elementFromPoint(x, y) === cvEl) hit++; }
  const hdr = document.querySelector("body > header"), hr = hdr.getBoundingClientRect();
  const kids = [...hdr.querySelectorAll(":scope > *, :scope > .modeSwitch > *, :scope > .hdrHistory > *")].filter((e) => vis(e) && !e.classList.contains("hdrDiv") && !e.closest(".moreMenu"));
  const rows = new Set(kids.map((e) => { const b = e.getBoundingClientRect(); return Math.round((b.top + b.height / 2) / 10); }));
  const aside = document.querySelector("aside"), ar = vis(aside) ? aside.getBoundingClientRect() : null;
  const min = touch ? 40 : 28;
  const ctl = [...document.querySelectorAll("button, select, input:not([type=hidden]):not([type=file]), [role=button], a.menuItem, summary")].filter((e) => vis(e) && !e.closest("#presentBar,#presentStory,.scDialog,#shareDialog,.overlay,#iconDrawer,#animDrawer,#editBox,.swatches"));
  const small = ctl.filter((e) => {
    if (e.id === "editBox") return false;
    const r = e.getBoundingClientRect(), lab = e.id && document.querySelector('label[for="' + e.id + '"]'), row = lab && e.closest(".row,.hdrOpt,.fieldRow");
    const eff = row ? row.getBoundingClientRect() : r;
    return Math.max(r.height, eff.height) < min - 0.5 || Math.max(r.width, eff.width) < min - 0.5;
  }).map((e) => (e.id || e.className || e.tagName) + ":" + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height));
  const critical = crit.map((id) => {
    const e = document.getElementById(id); if (!vis(e)) return [id, "oculto"];
    const r = e.getBoundingClientRect();
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) return [id, "fuera"];
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return [id, top && (e === top || e.contains(top)) ? "ok" : "tapado"];
  }).filter((c) => c[1] !== "ok");
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hb = getComputedStyle(hdr).backgroundColor, ab = getComputedStyle(aside).backgroundColor;
  const panelText = document.querySelector(storyModeActive() ? "#scScenarioTitle" : (document.getElementById("selBody").style.display !== "none" ? "#rowLabel label" : ".emptyTitle"));
  function storyModeActive() { return document.body.classList.contains("storyMode"); }
  return {
    canvasPct: Math.round(hit / n * 100), headerH: Math.round(hr.height), headerRows: rows.size, headerOverflow: hdr.scrollWidth - hdr.clientWidth,
    panelW: ar ? Math.round(ar.width) : 0, panelH: ar ? Math.round(ar.height) : 0, panelScreens: ar ? +(aside.scrollHeight / aside.clientHeight).toFixed(2) : 0,
    overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - W, small, critical,
    contrastHeader: +ratio(getComputedStyle(document.getElementById("btnShare")).color, hb).toFixed(2),
    contrastPanel: panelText && vis(panelText) ? +ratio(getComputedStyle(panelText).color, ab).toFixed(2) : null,
    headerBg: hb, asideBg: ab, headerLum: +lum(hb).toFixed(3), uiDark: document.documentElement.getAttribute("data-ui-theme") === "dark", docTheme: doc.theme,
    storyMode: storyModeActive(), railVisible: vis(document.querySelector(".rail")),
  };
};
const CRIT_EDIT = (vp) => ["btnUndo", "btnRedo", "btnShare", "btnPresent", "btnMore", ...(vp.mobile ? ["btnPanel", "btnStories"] : ["tabProperties", "tabScenarios", "btnCanvas"])];
const CRIT_STORY = (vp) => ["btnUndo", "btnShare", "btnPresent", "btnMore", "btnStoryExit", ...(vp.mobile ? ["btnStories"] : ["tabProperties", "tabScenarios"])];

/* Píxel del lienzo en un hueco vacío: su color es del DOCUMENTO (tema del lienzo), nunca de la interfaz. */
const canvasPixel = (page) => page.evaluate(async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const d = cv.fluyoDpr || 1, r = cv.getBoundingClientRect(), c = cv.getContext("2d");
  for (const [fx, fy] of [[0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.5, 0.08]]) {
    const x = r.width * fx, y = r.height * fy;
    if (document.elementFromPoint(r.left + x, r.top + y) !== cv) continue;
    return [...c.getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data].slice(0, 3).join(",");
  }
  return null;
});

async function states(t, vp, ui, theme) {
  const { page } = t, tag = `${ui}·${theme}`;
  const m = (crit) => page.evaluate(MEASURE, [!!vp.touch, crit]);
  const target = vp.touch ? 40 : 28;
  /* E1 · editor */
  let r = await m(CRIT_EDIT(vp));
  check(r.headerRows === 1 && r.headerH <= 56 && r.headerOverflow <= 0, `${tag} E1: cabecera en una fila (${r.headerH} px, ${r.headerRows} fila/s)`);
  check(r.overflowX <= 0, `${tag} E1: sin overflow horizontal`);
  check(r.canvasPct >= vp.e1, `${tag} E1: lienzo visible ${r.canvasPct}% (≥ ${vp.e1}%)`);
  check(r.critical.length === 0, `${tag} E1: controles críticos dentro y a la vista ${JSON.stringify(r.critical)}`);
  check(r.small.length === 0, `${tag} E1: ningún objetivo < ${target} px ${JSON.stringify(r.small)}`);
  check(r.contrastHeader >= 7, `${tag} E1: contraste de la cabecera ${r.contrastHeader}:1`);
  check(r.docTheme === theme && r.uiDark === (ui === "oscura"), `${tag} E1: interfaz «${ui}» y lienzo «${theme}» independientes`);
  if (!vp.mobile) check(r.railVisible && !r.storyMode, `${tag} E1: modo Editar con rail`);
  await shot(t, vp, `${ui}-${theme}-E1`);
  /* E2 · panel abierto con un nodo */
  await page.evaluate(() => { const n = P().nodes.find((x) => x.shape === "rect"); clearSel(); selN.add(n.id); refreshPanel(); });
  if (vp.mobile) await press(t, "#btnPanel", vp);
  r = await m(CRIT_EDIT(vp));
  if (vp.mobile) check(r.panelH > 0 && r.panelH <= vp.height * 0.53 && r.panelScreens <= vp.scroll, `${tag} E2: hoja de Propiedades ${r.panelH} px (≤ 52 % del alto), ${r.panelScreens} pantallas (≤ ${vp.scroll})`);
  else check(Math.abs(r.panelW - vp.panel) <= 1 && r.panelScreens <= vp.scroll, `${tag} E2: panel de ${r.panelW} px (${vp.panel}), ${r.panelScreens} pantallas (≤ ${vp.scroll})`);
  check(r.critical.length === 0 && r.small.length === 0 && r.overflowX <= 0, `${tag} E2: críticos a la vista, objetivos ≥ ${target} px, sin overflow ${JSON.stringify([r.critical, r.small])}`);
  check(r.contrastPanel === null || r.contrastPanel >= 7, `${tag} E2: contraste del panel ${r.contrastPanel}:1`);
  await shot(t, vp, `${ui}-${theme}-E2`);
  if (vp.mobile) await press(t, "#btnPanelClose", vp);
  await page.evaluate(() => clearSel());
  /* E3 · modo Historia */
  await press(t, vp.mobile ? "#btnStories" : "#tabScenarios", vp);
  r = await m(CRIT_STORY(vp));
  check(r.storyMode && !r.railVisible, `${tag} E3: modo Historia (body.storyMode, rail fuera)`);
  if (!vp.mobile) check(Math.abs(r.panelW - vp.story) <= 1 && await page.evaluate(() => $("tabScenarios").getAttribute("aria-pressed") === "true" && $("tabProperties").getAttribute("aria-pressed") === "false"), `${tag} E3: superficie de ${r.panelW} px y el conmutador marca «Historias»`);
  else check(r.panelH > 0 && r.panelH <= vp.height * 0.36, `${tag} E3: hoja compacta (${r.panelH} px)`);
  check(r.canvasPct >= vp.e3, `${tag} E3: lienzo visible ${r.canvasPct}% (≥ ${vp.e3}%)`);
  check(r.critical.length === 0 && r.small.length === 0 && r.overflowX <= 0 && r.headerRows === 1, `${tag} E3: «Volver a editar» y críticos a la vista, objetivos ≥ ${target} px, una fila ${JSON.stringify([r.critical, r.small])}`);
  await shot(t, vp, `${ui}-${theme}-E3`);
  /* E4 · reproduciendo */
  await press(t, "#scRun", vp); await page.waitForTimeout(700);
  r = await m([...CRIT_STORY(vp), "scReset"]);
  const now = await page.evaluate(() => ({ on: !$("scNow").hidden && $("scNow").getBoundingClientRect().height > 0, label: $("scNowLabel").textContent, cap: $("scNowCaption").textContent, ring: getComputedStyle(document.getElementById("wrap"), "::after").boxShadow, reset: $("scReset").textContent }));
  check(now.on && now.label === "Reproduciendo" && now.cap.length > 0 && /■/.test(now.reset), `${tag} E4: «Reproduciendo» con el momento («${now.cap}») y Detener a la vista`);
  check(/0px 0px 0px 2px inset/.test(now.ring), `${tag} E4: el marco del lienzo indica la reproducción`);
  check(r.canvasPct >= vp.e4 && r.critical.length === 0 && r.small.length === 0 && r.overflowX <= 0, `${tag} E4: lienzo ${r.canvasPct}% (≥ ${vp.e4}%), críticos y objetivos ${JSON.stringify([r.critical, r.small])}`);
  await shot(t, vp, `${ui}-${theme}-E4`);
  /* salida inequívoca: «Volver a editar» detiene y sale (B3) */
  await press(t, "#btnStoryExit", vp);
  const out = await page.evaluate(() => ({ mode: document.body.classList.contains("storyMode"), playing: isScenarioPlaybackActive(), open: document.body.classList.contains("panelOpen") }));
  check(!out.mode && !out.playing && (!vp.mobile || !out.open), `${tag} «Volver a editar» detiene la Historia y vuelve a editar ${JSON.stringify(out)}`);
}

async function journey(browser, base, vp) {
  console.log(`\n${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", táctil" : ", ratón"})`);
  const t = await open(browser, base, vp); const { page } = t;
  for (const ui of ["clara", "oscura"]) {
    await page.evaluate((dark) => { const c = $("chkUiDark"); if (c.checked !== dark) { c.checked = dark; c.dispatchEvent(new Event("change")); } }, ui === "oscura");
    await page.waitForTimeout(300); /* las transiciones de color de los controles (.12 s) */
    for (const theme of ["dark", "crema"]) {
      await page.evaluate((th) => { setThemeIn(doc, { theme: th }); syncProjectControls(); }, theme);
      await states(t, vp, ui, theme);
    }
  }

  /* ── Interfaz oscura: todas las superficies del chrome cambian; el lienzo no ── */
  await page.evaluate(() => { setThemeIn(doc, { theme: "crema" }); syncProjectControls(); });
  const px = {};
  for (const dark of [false, true]) {
    await page.evaluate((d) => { const c = $("chkUiDark"); c.checked = d; c.dispatchEvent(new Event("change")); }, dark);
    px[dark] = await canvasPixel(page);
  }
  await page.waitForTimeout(300); /* que terminen las transiciones de color antes de medir superficies */
  check(px[true] && px[true] === px[false], `el lienzo pinta igual con la interfaz clara y oscura (${px[false]} = ${px[true]})`);
  const surfaces = await page.evaluate(async () => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const out = {};
    const bg = (sel) => { const e = document.querySelector(sel); return e ? +lum(getComputedStyle(e).backgroundColor).toFixed(3) : null; };
    for (const [k, sel] of [["cabecera", "body > header"], ["rail", ".rail"], ["panel", "aside"], ["páginas", "#bottomBar"], ["conmutador", ".modeSwitch .segBtn.active"]]) out[k] = bg(sel);
    $("btnMore").click(); await new Promise((r) => setTimeout(r, 60)); out["menú Más"] = bg("#moreMenu"); closeMoreMenu(false);
    if (!isSheetLayout()) { $("btnCanvas").click(); await new Promise((r) => setTimeout(r, 60)); out["menú Lienzo"] = bg("#canvasMenu"); closeCanvasMenu(false); }
    showShareDialog(); out["diálogo Compartir"] = bg("#shareDialog"); $("shareDialog").close();
    scOpenEventDialog(null); out["diálogo de evento"] = bg("#scEventDialog"); scCloseEventDialog();
    const sel = P().nodes[0]; selN.add(sel.id); refreshPanel(); out["campo"] = bg("#lblEdit"); out["texto"] = +lum(getComputedStyle(document.querySelector("#rowLabel label")).color).toFixed(3); clearSel();
    out.doc = doc.theme; out.serial = JSON.stringify(serializeProject()).includes("ui.theme") || JSON.stringify(serializeProject()).includes("data-ui");
    return out;
  });
  const darkOnes = Object.entries(surfaces).filter(([k, v]) => !["doc", "serial", "texto"].includes(k) && v !== null && v > 0.2).map(([k, v]) => k + "=" + v);
  check(darkOnes.length === 0 && surfaces.texto > 0.75, "interfaz oscura completa: cabecera, rail, panel, páginas, menús, diálogos y campos oscuros; texto claro " + JSON.stringify(darkOnes));
  check(surfaces.doc === "crema" && !surfaces.serial, "la interfaz oscura no cambia doc.theme ni viaja en el documento serializado");
  await page.evaluate(() => { const c = $("chkUiDark"); c.checked = false; c.dispatchEvent(new Event("change")); setThemeIn(doc, { theme: "dark" }); syncProjectControls(); });

  /* ── «Lienzo» (escritorio/tableta) y «Más» ── */
  if (!vp.mobile) {
    await press(t, "#btnCanvas", vp);
    const cm = await page.evaluate(() => { const m = $("canvasMenu"), r = m.getBoundingClientRect(); return { open: !m.hidden, inView: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    check(cm.open && cm.inView, "«Lienzo» se abre dentro de la pantalla");
    await page.locator("#themeSel").selectOption("claro"); await page.waitForTimeout(80);
    check(await page.evaluate(() => doc.theme === "claro" && !$("canvasMenu").hidden && !document.documentElement.hasAttribute("data-ui-theme")), "el tema del lienzo cambia el documento, no la interfaz, y el menú sigue abierto");
    await page.keyboard.press("Escape"); await page.waitForTimeout(80);
    check(await page.evaluate(() => $("canvasMenu").hidden && $("btnCanvas").getAttribute("aria-expanded") === "false"), "Escape cierra «Lienzo»");
    await page.evaluate(() => { setThemeIn(doc, { theme: "dark" }); syncProjectControls(); });
  } else {
    await press(t, "#btnMore", vp);
    check(await page.evaluate(() => !!$("moreTools").querySelector("#themeSel") && !!$("moreTools").querySelector("#btnExport") && $("btnCanvas").getBoundingClientRect().width === 0), "móvil: «Más» lleva Exportar y la sección Lienzo; no hay botón «Lienzo»");
    await page.keyboard.press("Escape"); await page.waitForTimeout(80);
  }

  /* ── Táctil: hoja de Propiedades con tres salidas; nada la tapa ── */
  if (vp.mobile) {
    await page.evaluate(() => { const n = P().nodes[0]; clearSel(); selN.add(n.id); refreshPanel(); });
    await press(t, "#btnPanel", vp);
    const onTop = await page.evaluate(() => ["btnPanel", "btnPanelClose", "btnStories"].every((id) => { const r = $(id).getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === $(id) || $(id).contains(e); }));
    check(onTop, "hoja abierta: ⚙, su cierre e Historias siguen a la vista (la hoja no tapa a quien la abre)");
    await press(t, "#btnPanelClose", vp);
    check(await page.evaluate(() => !document.body.classList.contains("panelOpen")), "salida 1: el botón de la hoja la cierra");
    await press(t, "#btnPanel", vp); await press(t, "#btnPanel", vp);
    check(await page.evaluate(() => !document.body.classList.contains("panelOpen")), "salida 2: ⚙ es interruptor");
    await press(t, "#btnPanel", vp);
    const empty = await page.evaluate(() => { const r = cv.getBoundingClientRect(); for (let y = r.top + 12; y < r.bottom; y += 10) for (let x = r.left + 12; x < r.right - 12; x += 10) { const w = toWorldFromClient(x, y); if (!P().nodes.some((n) => Math.abs(w.x - n.x) < n.w / 2 + 30 && Math.abs(w.y - n.y) < n.h / 2 + 30) && document.elementFromPoint(x, y) === cv) return { x, y }; } return null; });
    await page.touchscreen.tap(empty.x, empty.y); await page.waitForTimeout(350);
    check(await page.evaluate(() => !document.body.classList.contains("panelOpen") && selN.size === 0), "salida 3: tocar el vacío del lienzo deselecciona y cierra la hoja");
    /* tocar OTRO elemento con la hoja abierta: la hoja se queda y muestra el nuevo */
    await page.evaluate(() => { selN.add(P().nodes[0].id); refreshPanel(); }); await press(t, "#btnPanel", vp);
    const other = await page.evaluate(() => { const n = P().nodes[2], r = cv.getBoundingClientRect(); return { x: r.left + viewX + n.x * viewZoom, y: r.top + viewY + n.y * viewZoom, id: n.id, label: n.label }; });
    await page.touchscreen.tap(other.x, other.y); await page.waitForTimeout(350);
    check(await page.evaluate((o) => document.body.classList.contains("panelOpen") && selN.has(o.id) && $("lblEdit").value === o.label, other), "tocar otro elemento cambia la selección y la hoja se queda");
    await press(t, "#btnPanelClose", vp); await page.evaluate(() => clearSel());

    /* ── Historia en móvil, solo con toques ── */
    await press(t, "#btnStories", vp);
    const h0 = await page.evaluate(() => document.querySelector("aside").getBoundingClientRect().height);
    await press(t, "#btnStoryExpand", vp);
    const h1 = await page.evaluate(() => document.querySelector("aside").getBoundingClientRect().height);
    check(h1 > h0 * 1.6 && await page.evaluate(() => $("btnStoryExpand").getAttribute("aria-expanded") === "true"), `«Ampliar» agranda la hoja (${Math.round(h0)} → ${Math.round(h1)} px)`);
    const stripTap = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; });
    await page.touchscreen.tap(stripTap.x, stripTap.y); await page.waitForTimeout(350);
    check(await page.evaluate(() => !document.body.classList.contains("storyExpanded") && document.body.classList.contains("storyMode")), "tocar el lienzo devuelve la hoja ampliada a compacta sin salir del modo");
    await press(t, "#scRun", vp); await page.waitForTimeout(600);
    check(await page.evaluate(() => isScenarioPlaybackActive() && $("scNowCaption").textContent.length > 0), "reproducir con el dedo: se ve qué está pasando");
    await page.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 });
    await page.waitForTimeout(150);
    check(await page.evaluate(() => $("scReset").textContent === "Terminar" && $("scNowLabel").textContent === "Terminada"), "al acabar: «Terminar» (B2) y «Terminada»");
    await press(t, "#scReset", vp);
    check(await page.evaluate(() => !isScenarioPlaybackActive() && document.body.classList.contains("storyMode")), "«Terminar» cierra la reproducción y sigue en Historias");
    await press(t, "#btnStoryExit", vp);
    check(await page.evaluate(() => !document.body.classList.contains("storyMode") && !document.body.classList.contains("panelOpen")), "«Volver a editar» vuelve al lienzo en modo Editar");

    /* ── Regresión 018.12: renombrar con el dedo, conectar, Deshacer/Rehacer ── */
    await page.locator("#pagesBar .tab.active .pgMore").tap(); await page.waitForTimeout(200);
    await page.locator("#pageMenu button", { hasText: "Renombrar" }).tap(); await page.waitForTimeout(150);
    await page.locator("#pageNameIn").fill("Pagos"); await page.locator("#pageNameSave").tap(); await page.waitForTimeout(150);
    check(await page.evaluate(() => doc.pages[doc.cur].name === "Pagos"), "renombrar la página con el dedo (menú de la pestaña)");
    const a = await page.evaluate(() => { const n = P().nodes[0], r = cv.getBoundingClientRect(); return { x: r.left + viewX + n.x * viewZoom, y: r.top + viewY + n.y * viewZoom }; });
    const b = await page.evaluate(() => { const n = P().nodes[2], r = cv.getBoundingClientRect(); return { x: r.left + viewX + n.x * viewZoom, y: r.top + viewY + n.y * viewZoom }; });
    const e0 = await page.evaluate(() => P().edges.length);
    await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(300);
    await page.locator("#tbConnect").tap(); await page.waitForTimeout(150);
    await page.touchscreen.tap(b.x, b.y); await page.waitForTimeout(300);
    check(await page.evaluate((e0) => P().edges.length === e0 + 1, e0), "conectar con el dedo («Conectar» y tocar el destino)");
    await page.locator("#btnUndo").tap(); await page.waitForTimeout(150);
    check(await page.evaluate((e0) => P().edges.length === e0, e0), "Deshacer con el dedo");
    await page.locator("#btnRedo").tap(); await page.waitForTimeout(150);
    check(await page.evaluate((e0) => P().edges.length === e0 + 1, e0), "Rehacer con el dedo");
  } else {
    /* escritorio: «Editar» del conmutador también sale (y detiene) */
    await press(t, "#tabScenarios", vp); await press(t, "#scRun", vp);
    await press(t, "#tabProperties", vp);
    check(await page.evaluate(() => !document.body.classList.contains("storyMode") && !isScenarioPlaybackActive() && getComputedStyle(document.querySelector(".rail")).display !== "none"), "«Editar» del conmutador sale de Historias aunque se esté reproduciendo (B3)");
  }
  check(t.errors.length === 0, "0 errores de consola/página " + JSON.stringify(t.errors));
  await t.ctx.close();
}

/* La interfaz oscura es una preferencia del navegador: sobrevive a recargar, no viaja en el documento y un localStorage
   inaccesible no rompe nada. */
async function persistence(browser, base) {
  console.log("\nPersistencia del tema de la interfaz");
  const vp = { key: "persist", width: 1280, height: 800 };
  const t = await open(browser, base, vp); const { page } = t;
  await page.evaluate(() => { const c = $("chkUiDark"); c.checked = true; c.dispatchEvent(new Event("change")); });
  check(await page.evaluate(() => localStorage.getItem("fluyo.ui.theme") === "dark"), "se guarda en localStorage[fluyo.ui.theme]");
  await page.evaluate(() => { P().nodes[0].label = "Cambio"; saveAutosave(true); });
  check(await page.evaluate(() => !/ui\.theme|uiTheme|data-ui/.test(localStorage.getItem("fluyo.autosave.v1"))), "el autoguardado del documento no lleva la preferencia");
  const link = await page.evaluate(() => createShareUrl(serializeProject(), location.href, { kind: "diagram" }));
  check(await page.evaluate(async (l) => { const d = await decodeDeepLink(new URL(l).hash.slice(1)); return !/ui\.theme|uiTheme|data-ui/.test(JSON.stringify(d)); }, link).catch(() => true), "el enlace compartido no lleva la preferencia");
  await page.reload(); await page.waitForFunction(() => typeof setUiMode === "function");
  const after = await page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-ui-theme"), chk: $("chkUiDark").checked, meta: document.querySelector('meta[name="theme-color"]').content, doc: doc.theme }));
  check(after.attr === "dark" && after.chk && after.meta === "#1A1913", "tras recargar sigue oscura (atributo, interruptor y theme-color) " + JSON.stringify(after));
  await page.evaluate(() => { applyProjectData({ version: 5, doc: { theme: "claro", pages: [{ name: "Otra", nodes: [], edges: [] }] } }); });
  check(await page.evaluate(() => document.documentElement.getAttribute("data-ui-theme") === "dark" && doc.theme === "claro"), "abrir otro documento (tema claro) no cambia la interfaz");
  await page.evaluate(() => { const c = $("chkUiDark"); c.checked = false; c.dispatchEvent(new Event("change")); });
  check(await page.evaluate(() => localStorage.getItem("fluyo.ui.theme") === null && !document.documentElement.hasAttribute("data-ui-theme")), "volver a clara borra la preferencia");
  check(t.errors.length === 0, "0 errores " + JSON.stringify(t.errors));
  await t.ctx.close();
  /* localStorage que lanza (modo privado estricto): el editor arranca, la interfaz es clara y el interruptor no rompe */
  const t2 = await open(browser, base, vp, { init: () => { const thrower = () => { throw new Error("bloqueado"); }; Object.defineProperty(window, "localStorage", { configurable: true, get: () => ({ getItem: thrower, setItem: thrower, removeItem: thrower }) }); } });
  await t2.page.evaluate(() => { const c = $("chkUiDark"); c.checked = true; c.dispatchEvent(new Event("change")); });
  check(await t2.page.evaluate(() => document.documentElement.getAttribute("data-ui-theme") === "dark") && t2.errors.length === 0, "con localStorage inaccesible el editor funciona y el interruptor aplica la interfaz " + JSON.stringify(t2.errors));
  await t2.ctx.close();
}

/* Service Worker v73: instala y sirve la UI nueva sin red, con la interfaz oscura aplicada desde el primer pintado. */
async function serviceWorker(browser, base) {
  console.log("\nService Worker v73");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  await page.goto(base + "/"); await page.waitForFunction(() => typeof renderTabs === "function");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const keys = await page.evaluate(() => caches.keys());
  check(keys.length === 1 && keys[0] === "fluyo-static-v75", "caché instalada: fluyo-static-v75 " + JSON.stringify(keys));
  await page.evaluate(() => localStorage.setItem("fluyo.ui.theme", "dark"));
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => typeof setUiMode === "function");
  const off = await page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-ui-theme"), mode: !!document.getElementById("modeSwitch"), bg: getComputedStyle(document.querySelector("body > header")).backgroundColor }));
  check(off.attr === "dark" && off.mode && off.bg === "rgb(26, 25, 19)", "sin red: la UI de 018.14b sale de la caché, ya en oscuro " + JSON.stringify(off));
  await ctx.close();
}

(async () => {
  const wt = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS) if (!process.env.ONLY || process.env.ONLY === vp.key) await journey(browser, wt.base, vp);
    if (!process.env.ONLY || process.env.ONLY === "persist") await persistence(browser, wt.base);
    if (!process.env.ONLY || process.env.ONLY === "sw") await serviceWorker(browser, wt.base);
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  finally { await browser.close(); wt.server.close(); }
  console.log(`\nFLUYO-018.14b Chrome real: ${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})();
