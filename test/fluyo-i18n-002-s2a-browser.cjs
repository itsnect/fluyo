"use strict";
/* FLUYO-I18N-002 S2a — Chrome REAL: la superficie de Historias en español (IDÉNTICA a a0919e6) y en inglés, a 1440 y a 390 (con dedo).
   · ES  Con el árbol de a0919e6 servido aparte (FLUYO_BASE_ROOT): hoja de Historias, menú de la Historia, menú del paso y sus submenús,
         mensaje del paso, espera, diálogo de evento (conexión y elemento, plegables abiertos), barra de colocación, Detalles (registro
         y condiciones), reproducción en pausa (#scNow, transporte, estado), ruta observada y las tres confirmaciones nativas (borrar
         Historia, selección usada en Historias, página): texto y atributos visibles IGUALES, y la hoja píxel a píxel.
   · EN  Las mismas superficies en inglés, contra el diccionario; el contenido del autor (nombres de Historia, de evento y de nodo,
         frases, mensajes) tal cual; nada desborda ni se recorta.
   · QPS Pseudo-idioma (+40 %): ningún texto de Historias fuera de FluyoI18n salvo contenido del autor.
   · VIVO es → en → es con la hoja abierta: documento, Deshacer y Historia activa intactos.
   · PRESENT y VIEWER en inglés (transporte, encabezado; el texto de la reproducción que compone el kernel es S2b y se registra).
   · SHARE «Compartir historia» desde el editor en inglés → Viewer: la Historia del autor intacta.
   · OFFLINE SW v111: sin red, el editor abre en inglés con la hoja de Historias en inglés.
   Uso: node test/fluyo-i18n-002-s2a-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_BASE_ROOT=<árbol de a0919e6>;
        FLUYO_SHOTS=<dir>). Sin FLUYO_BASE_ROOT, la parte ES se salta y lo dice. */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const scan = require("./i18n-scan.cjs");
const { pseudoDictionary, OPEN } = require("./i18n-pseudo.cjs");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const baseRoot = process.env.FLUYO_BASE_ROOT ? path.resolve(process.env.FLUYO_BASE_ROOT) : null;
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-i18n-002-s2a-"));
fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".gif": "image/gif" };
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
const info = (msg) => console.log("  ℹ " + msg);
const DICTS = scan.dictionaries();
const EN = { ...DICTS.en.common, ...DICTS.en.editor };
const VPS = [{ width: 1440, height: 900 }, { width: 390, height: 844, mobile: true }];

/* El documento: «Compra online» con dos Historias, frases del autor, una espera de llegada, un paso simultáneo y conexiones Flujo (ruta). */
const AUTHOR = { story: "Compra con éxito", story2: "El banco no responde", msg: "El cliente pulsa «Pagar» (49 €)", et: "Petición" };
const N = (id, label, x, y) => ({ id, shape: "rect", x, y, w: 170, h: 64, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, font: null, bold: false, pulse: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal", kind: "FLOWS_TO" });
const S = (id, at, action, target, eventTypeId, extra = {}) => Object.assign({ id, at, action }, action === "SEND" ? { edgeId: target } : { nodeId: target }, eventTypeId ? { eventTypeId } : {}, extra);
const DOC = { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
  doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 5,
    eventTypes: [{ id: 1, name: AUTHOR.et, primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
      { id: 2, name: "Respuesta", primitive: "FLOW", sentenceTemplate: "{source} responde a {target}", visual: { kind: "token", value: "◆" }, motion: "normal" },
      { id: 3, name: "Caída", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} se cae", visual: { kind: "token", value: "✕" } },
      { id: 4, name: "Preparación", primitive: "OCCURRENCE", sentenceTemplate: "{target} prepara", visual: { kind: "token", value: "📦" }, presentation: { nodeEffects: { message: "Preparando", highlight: true } } }],
    pages: [{ name: "Compra online", nextId: 100, behaviors: [], nextScenarioId: 3,
      nodes: [N(1, "Cliente", 200, 300), N(2, "Tienda online", 500, 300), N(3, "Pagos", 800, 300), N(4, "Banco", 800, 520), N(5, "Almacén", 500, 520)],
      edges: [E(6, 1, 2), E(7, 2, 3), E(8, 3, 4), E(9, 2, 5)],
      scenarios: [
        { id: 1, engineVersion: 2, name: AUTHOR.story, nextStepId: 9, arrivalDependencies: [{ stepId: 6, waitsForArrivalOf: [4] }], steps: [
          S(1, 0, "SEND", 6, 1, { message: AUTHOR.msg }), S(2, 1600, "SEND", 7, 1, { message: "La tienda pide a Pagos que cobre" }), S(3, 3200, "SEND", 8, 1),
          S(4, 4800, "SEND", 8, 2, { reverse: true, message: "El banco autoriza el cobro" }), S(5, 6400, "SEND", 7, 2, { reverse: true }),
          S(6, 8000, "SEND", 9, 1, { message: "Solo ahora la tienda avisa al almacén" }), S(7, 9600, "SEND", 6, 2, { reverse: true }), S(8, 9600, "OCCURRENCE", 5, 4)] },
        { id: 2, engineVersion: 2, name: AUTHOR.story2, nextStepId: 4, steps: [S(1, 0, "SEND", 6, 1), S(2, 1600, "SET_STATE", 4, 3, { state: "DOWN" }), S(3, 3200, "SEND", 8, 1)] }] }] } };
const AUTHOR_TEXT = new Set([AUTHOR.story, AUTHOR.story2, AUTHOR.msg, AUTHOR.et, "Respuesta", "Caída", "Preparación", "Preparando", "Compra online", "Cliente", "Tienda online", "Pagos", "Banco", "Almacén",
  "La tienda pide a Pagos que cobre", "El banco autoriza el cobro", "Solo ahora la tienda avisa al almacén",
  /* las frases de los eventos son plantillas del AUTOR («{source} pide a {target}»): su texto fijo también es contenido */
  "pide a", "responde a", "prepara", "se cae"].sort((a, b) => b.length - a.length));   // los largos primero

async function open(browser, base, url, vp, { init, sw = false, ctx: shared } = {}) {
  const ctx = shared || await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.mobile, isMobile: !!vp.mobile, serviceWorkers: sw ? "allow" : "block", deviceScaleFactor: 1 });
  if (!shared) await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.goto(base + url);
  await page.waitForFunction(() => typeof enterPresent === "function" && typeof refreshPanel === "function" && typeof FluyoI18n === "object");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  return { ctx, page, errors, dialogs };
}
const load = (page) => page.evaluate((d) => { applyProjectData(d); fitView(); clearSel(); renderTabs(); }, DOC);
const stories = async (page, vp) => {
  if (vp.mobile && await page.locator("#btnStories").isVisible()) await page.click("#btnStories"); else await page.evaluate(() => setUiMode("story"));
  await page.waitForTimeout(200);
  if (vp.mobile && await page.locator("#btnStoryExpand").isVisible()) { await page.click("#btnStoryExpand"); await page.waitForTimeout(150); }
};
/* Texto y atributos visibles de una región, en orden (lo que se compara byte a byte con la base) */
const dump = (page, sel) => page.evaluate((sel) => {
  const out = [];
  for (const r of document.querySelectorAll(sel)) {
    if (!r.getClientRects().length) continue;
    for (const el of [r, ...r.querySelectorAll("*")]) {
      if (!el.getClientRects().length && el.tagName !== "OPTION") continue;
      for (const a of ["title", "aria-label", "placeholder", "data-tip"]) if (el.getAttribute(a)) out.push(`@${a}=${el.getAttribute(a)}`);
      for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) out.push(n.data.replace(/\s+/g, " ").trim());
    }
  }
  return out;
}, sel);
async function clipping(page, sel) {
  return page.evaluate((sel) => {
    const out = [];
    for (const r of document.querySelectorAll(sel)) {
      if (!r.getClientRects().length) continue;
      for (const el of r.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || !el.getClientRects().length || el.clientWidth <= 2 || el.clientHeight <= 2) continue;
        if (!/\p{L}/u.test(el.textContent || "") || el.children.length > 3) continue;
        const name = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
        if (!/auto|scroll/.test(cs.overflowX) && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 1) out.push(`${name}: ancho ${el.scrollWidth}/${el.clientWidth} «${el.textContent.trim().slice(0, 30)}»`);
        if (!/auto|scroll/.test(cs.overflowY) && cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 2) out.push(`${name}: alto ${el.scrollHeight}/${el.clientHeight} «${el.textContent.trim().slice(0, 30)}»`);
      }
    }
    return out;
  }, sel);
}

/* Recorre la superficie de Historias y devuelve, por paso, el volcado de lo visible (y deja capturas). */
async function tour(browser, base, lang, vp, { init, shotsTag } = {}) {
  const q = lang === "es" ? "" : "?lang=" + lang;
  const { ctx, page, errors, dialogs } = await open(browser, base, "/" + q, vp, { init });
  await load(page);
  await stories(page, vp);
  const out = {}, clips = {};
  const grab = async (name, sel, shot) => {
    out[name] = await dump(page, sel);
    clips[name] = await clipping(page, sel);
    if (shot) out[name + ":png"] = await page.locator(shot).isVisible() ? await page.locator(shot).screenshot() : await page.screenshot();
    if (shotsTag) await page.screenshot({ path: path.join(shots, `${shotsTag}-${name}.png`) });
  };
  await grab("hoja", "#panelScenarios", "#panelScenarios");
  await page.click("#scScenarioMenu"); await page.waitForTimeout(80); await grab("menuHistoria", "#scPopover"); await page.keyboard.press("Escape");
  await page.click("#scScenarioTitle"); await page.waitForTimeout(80); await grab("elegirHistoria", "#scPopover"); await page.keyboard.press("Escape");
  /* menú del paso 6 (envío con espera de llegada) y sus submenús */
  await page.locator('[data-step-id="6"] .scMore').click(); await page.waitForTimeout(80); await grab("menuPaso", "#scPopover");
  for (const sub of [1, 2]) {
    const items = page.locator("#scPopover button:has(.scMenuChevron)");
    if (await items.count() > sub - 1) { await items.nth(sub - 1).click(); await page.waitForTimeout(80); await grab("submenu" + sub, "#scPopover"); }
    await page.keyboard.press("Escape"); await page.locator('[data-step-id="6"] .scMore').click(); await page.waitForTimeout(80);
  }
  await page.keyboard.press("Escape");
  await page.evaluate(() => scEditStepMessage(1, document.querySelector('[data-step-id="1"] .scMore'))); await page.waitForTimeout(80); await grab("mensajePaso", "#scPopover"); await page.keyboard.press("Escape");
  await page.locator(".scDelay").nth(1).click(); await page.waitForTimeout(80); await grab("espera", "#scPopover"); await page.keyboard.press("Escape");
  /* diálogo de evento: crear (conexión) con los plegables abiertos; editar uno de elemento */
  await page.evaluate(() => scOpenEventDialog()); await page.waitForTimeout(100);
  await page.evaluate(() => { for (const d of document.querySelectorAll("#scEventDialog details")) d.open = true; scUpdateAccordionSummaries(); });
  await grab("eventoCrear", "#scEventDialog");
  await page.evaluate(() => { document.querySelector('input[name="scWhere"][value="element"]').click(); });
  await page.waitForTimeout(80); await page.evaluate(() => { for (const d of document.querySelectorAll("#scEventDialog details")) d.open = true; scUpdateAccordionSummaries(); });
  await grab("eventoElemento", "#scEventDialog");
  await page.evaluate(() => scCloseEventDialog());
  await page.evaluate(() => scOpenEventDialog(4)); await page.waitForTimeout(80); await grab("eventoEditar", "#scEventDialog .scDialogBody header, #scEventDialog header, #scEventDialog footer"); await page.evaluate(() => scCloseEventDialog());
  /* barra de colocación */
  await page.evaluate(() => scBeginPlacement(1)); await page.waitForTimeout(80); await grab("colocar", "#scPlacementBar"); await page.evaluate(() => scCancelPlacement());
  await page.evaluate(() => { scContext = { kind: "same", stepId: 2, scenarioId: scActiveScenario().id, page: P() }; scUpdatePlacementBar(); }); await page.waitForTimeout(50);
  await grab("colocarJunto", "#scPlacementBar"); await page.evaluate(() => { scContext = null; scCancelPlacement(); scUpdatePlacementBar(); });
  /* Detalles: condiciones y registro (tras reproducir) */
  await page.evaluate(() => scOpenDetails("conditions")); await page.waitForTimeout(80); await grab("condiciones", "#scDetailsDialog"); await page.evaluate(() => $("scDetailsDialog").close());
  await page.evaluate(() => scOpenDetails("trace")); await page.waitForTimeout(80); await grab("registroVacio", "#scDetailsDialog"); await page.evaluate(() => $("scDetailsDialog").close());
  /* reproducir y pausar en un momento fijo (reloj de la Historia: seek) */
  await page.click("#scRun"); await page.waitForTimeout(150);
  await page.evaluate(() => scTogglePause());
  await page.waitForTimeout(100);
  await grab("enPausa", "#scNow, .scTransport, #scStatus");
  await page.evaluate(() => scOpenDetails("trace")); await page.waitForTimeout(80);
  out.registro = (await dump(page, "#scTraceLog")).map((s) => s.replace(/^\d+[.,]\d s/, "T"));
  await page.evaluate(() => $("scDetailsDialog").close());
  await page.click("#scReset"); await page.waitForTimeout(100);
  await grab("ruta", "#scFlow");
  /* confirmaciones nativas */
  dialogs.length = 0;
  await page.evaluate(() => scDeleteScenario());
  await page.evaluate(() => { setUiMode("edit"); selectOnly("node", 3); deleteSel(); selN = new Set([2, 3]); selE = new Set([7]); deleteSel(); });
  await page.evaluate(() => { createPageIn(doc, "Segunda"); renderTabs(); requestDeletePage(0); });
  out.confirm = dialogs.slice();
  out.errors = errors.slice();
  out.clips = clips;
  await ctx.close();
  return out;
}

async function spanishIdentical(browser, base, baseUrl) {
  for (const vp of VPS) {
    console.log(`\nespañol idéntico a a0919e6 · ${vp.width}×${vp.height}`);
    const now = await tour(browser, base, "es", vp, { shotsTag: "es-" + vp.width }), was = await tour(browser, baseUrl, "es", vp);
    for (const k of Object.keys(was)) {
      if (k === "errors" || k === "clips") continue;
      if (k.endsWith(":png")) { check(Buffer.compare(now[k], was[k]) === 0, `${k.replace(":png", "")}: píxel a píxel`); continue; }
      check(JSON.stringify(now[k]) === JSON.stringify(was[k]), `${k}: ${now[k].length} textos iguales` + (JSON.stringify(now[k]) === JSON.stringify(was[k]) ? "" : "\n      ahora: " + JSON.stringify(now[k]).slice(0, 400) + "\n      base:  " + JSON.stringify(was[k]).slice(0, 400)));
    }
    check(now.confirm.length >= 3, "las confirmaciones nativas se abrieron (" + now.confirm.length + ")");
    check(now.errors.length === 0, "sin errores de consola " + now.errors.join(" | "));
  }
}

async function english(browser, base) {
  for (const vp of VPS) {
    console.log(`\ninglés · ${vp.width}×${vp.height}`);
    const r = await tour(browser, base, "en", vp, { shotsTag: "en-" + vp.width });
    const VALUES = new Set(Object.values(EN).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v))));
    const SPANISH = /[ñáéíóú¿¡]|\b(el|la|los|las|de|del|que|una?|para|con|por|se|sin|y|evento|historia|momento)\b/i;
    for (const [k, list] of Object.entries(r)) {
      if (["errors", "clips", "confirm"].includes(k) || k.endsWith(":png")) continue;
      const bad = list.map((t) => t.replace(/^@[a-z-]+=/, "")).filter((t) => {
        let s = t; for (const a of AUTHOR_TEXT) s = s.split(a).join("");
        return SPANISH.test(s);
      });
      check(bad.length === 0, `${k}: sin texto de interfaz en español ` + JSON.stringify(bad).slice(0, 300));
    }
    check(r.hoja.includes(AUTHOR.story + " ▾") || r.hoja.some((t) => t.startsWith(AUTHOR.story)), "el nombre de la Historia del autor, intacto");
    check(r.hoja.includes("“" + AUTHOR.msg + "”"), "la frase del paso, intacta (entre comillas inglesas)");
    check(r.hoja.includes(EN["moment.atStart"]) && r.hoja.some((t) => /^1\.6 s later$/.test(t)), "línea de tiempo: «At the start», «1.6 s later»");
    check(r.hoja.some((t) => t.startsWith("Waits for the arrival of “")), "espera de llegada: «Waits for the arrival of “…”»");
    check(r.menuPaso.includes(EN["step.reverse"]) && r.menuPaso.includes(EN["moment.waitMenu"]), "menú del paso en inglés");
    check(r.eventoCrear.includes(EN["event.look.size"]) && r.eventoCrear.includes(EN["event.where"]), "diálogo de evento en inglés");
    check(r.colocar.some((t) => t.startsWith("Petición: choose a connection in the system.")), "barra de colocación: «Petición: choose a connection…» " + JSON.stringify(r.colocar));
    check(r.ruta.includes(EN["route.title"]) && r.ruta.includes(EN["route.noPair"]) && r.ruta.includes("@title=" + EN["route.auto"]), "ruta observada en inglés (sin par elegido: «Choose a source and a target»)");
    check(r.confirm.some((m) => m.startsWith("Delete the story “" + AUTHOR.story + "”? It has 7 moments.")), "confirmación: borrar Historia");
    check(r.confirm.some((m) => /^This (element|selection) is used in \d stor(y|ies):/.test(m)), "confirmación: borrar algo usado en Historias " + JSON.stringify(r.confirm.map((m) => m.split("\n")[0])));
    for (const [k, c] of Object.entries(r.clips)) check(c.length === 0, `${k}: sin desbordes ni recortes ` + c.join(" | "));
    check(r.errors.length === 0, "sin errores de consola " + r.errors.join(" | "));
  }
}

async function pseudo(browser, base) {
  console.log("\npseudo-idioma (qps, +40 %) · Historias");
  const init = "window.FLUYO_LOCALES=" + JSON.stringify({ qps: pseudoDictionary() }) + ";";
  for (const vp of VPS) {
    const r = await tour(browser, base, "qps", vp, { init, shotsTag: "qps-" + vp.width });
    for (const [k, list] of Object.entries(r)) {
      if (["errors", "clips", "confirm", "registro"].includes(k) || k.endsWith(":png")) continue;
      const left = list.map((t) => t.replace(/^@[a-z-]+=/, "")).filter((t) => {
        if (t.includes(OPEN)) return false;
        let s = t; for (const a of AUTHOR_TEXT) s = s.split(a).join("");
        s = s.replace(/[●◆✕📦▾⋯+×‹›→↻▶■├└◦✓·#\d\s.,:()/%-]/gu, "").replace(/\b(Enter|Esc|Alt)\b/g, "");
        return /\p{L}/u.test(s);
      });
      check(left.length === 0, `${vp.width}: ${k} sin texto fuera de FluyoI18n ` + JSON.stringify(left).slice(0, 300));
    }
    for (const [k, c] of Object.entries(r.clips)) (c.length ? info : (m) => check(true, m))(`${vp.width}: ${k} con +40 % ` + (c.length ? c.join(" | ") : "sin desbordes"));
  }
}

async function live(browser, base) {
  console.log("\nen vivo · es → en → es con la hoja de Historias abierta");
  const { ctx, page, errors } = await open(browser, base, "/", VPS[0]);
  await load(page); await stories(page, VPS[0]);
  await page.evaluate(() => { scSelectStory(2); scRenderPanel(); });
  const snap = () => page.evaluate(() => ({ doc: JSON.stringify(serializeProject()), undo: undoStack.length, active: scActiveScenario().id }));
  const s0 = await snap();
  await page.evaluate(() => FluyoI18n.setLocale("en")); await page.waitForTimeout(80);
  check((await page.textContent("#scScenarioTitle")).startsWith(AUTHOR.story2) && (await page.textContent("#scRun")).includes("Play") && (await page.textContent("#scStoryboard")).includes("At the start"), "la hoja pasa a inglés sin recargar (Historia del autor intacta)");
  check((await page.getAttribute("#btnStoryExpand", "aria-label")) === EN["stories.sheetExpand"] && (await page.getAttribute("#modeBar", "aria-label")) === "Explain the system", "«Expand the stories sheet» y «Explain the system»");
  const s1 = await snap();
  check(s1.doc === s0.doc && s1.undo === s0.undo && s1.active === s0.active, "documento, Deshacer e Historia activa intactos");
  await page.evaluate(() => FluyoI18n.setLocale("es")); await page.waitForTimeout(80);
  check((await page.textContent("#scStoryboard")).includes("Al comenzar") && (await page.textContent("#scRun")).includes("Reproducir"), "de vuelta al español");
  check(errors.length === 0, "sin errores de consola " + errors.join(" | "));
  await ctx.close();
}

async function presentViewerShare(browser, base) {
  for (const vp of VPS) {
    console.log(`\nPresent, Share y Viewer en inglés · ${vp.width}×${vp.height}`);
    const { ctx, page, errors } = await open(browser, base, "/?lang=en", vp);
    await load(page); await stories(page, vp);
    await page.evaluate(() => { scSelectStory(1); scRenderPanel(); enterPresent(); }); await page.waitForTimeout(250);
    check((await page.textContent("#psPlay")).includes("Play") && (await page.textContent("#prExit")).includes("Exit"), "Present: transporte en inglés");
    await page.evaluate(() => presentPlay && presentPlay()); await page.waitForTimeout(400);
    const title = (await page.textContent("#psTitle")).trim();
    check(title === AUTHOR.msg, "Present: el título del momento es la frase del autor («" + title + "»)");
    await page.evaluate(() => exitPresent()); await page.waitForTimeout(150);
    await page.evaluate(() => { if (isScenarioPlaybackActive()) scReset(); });
    await page.click("#btnShare"); await page.waitForSelector("#shareDialog[open]");
    check((await page.textContent("#shareStoryName")).includes(AUTHOR.story), "Compartir: el nombre de la Historia, intacto");
    await page.click("#shareCreate"); await page.waitForFunction(() => /#d=/.test(document.getElementById("shareLink").value || ""), null, { timeout: 8000 });
    const link = await page.inputValue("#shareLink");
    await ctx.close();
    const v = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.mobile, isMobile: !!vp.mobile, serviceWorkers: "block" });
    await v.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
    const vp2 = await v.newPage(); const verr = []; vp2.on("pageerror", (e) => verr.push(e.message));
    await vp2.goto(link.replace(/^https?:\/\/[^/]+/, base).replace("/s/#", "/s/?lang=en#"));
    await vp2.waitForSelector("#stPlay", { state: "visible", timeout: 8000 });
    check((await vp2.textContent("#stTitle")).trim() === AUTHOR.story && (await vp2.textContent("#stPlay")).includes("Play story"), "Viewer: «Play story» y la Historia del autor intacta");
    await vp2.click("#stPlay"); await vp2.waitForTimeout(300);
    check((await vp2.textContent("#stTitle")).trim() === AUTHOR.msg, "Viewer: el momento dice la frase del autor");
    check((await vp2.textContent("#stKicker")).trim() === "Story · " + AUTHOR.story, "Viewer: «Story · nombre del autor»");
    check(errors.length === 0 && verr.length === 0, "sin errores de consola " + [...errors, ...verr].join(" | "));
    await v.close();
  }
  info("el texto de la reproducción que compone el kernel («X no está disponible», «Reproducción terminada», «N eventos no pudieron realizarse») sigue en español: es S2b (story-playback.js)");
}

async function offline(browser, base) {
  console.log("\noffline · service worker v111");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "allow" });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  await page.goto(base + "/?lang=en");
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); }, null, { timeout: 15000 });
  for (let i = 0; i < 60; i++) { if (await page.evaluate(async () => { const k = await caches.keys(); const c = k.includes("fluyo-static-v121") ? await caches.open("fluyo-static-v121") : null; return !!c && (await c.keys()).length >= 60; })) break; await page.waitForTimeout(250); }
  check(await page.evaluate(async () => (await caches.keys()).includes("fluyo-static-v121")), "caché fluyo-static-v121 instalada");
  await ctx.setOffline(true);
  await page.goto(base + "/?lang=en");
  await page.waitForFunction(() => typeof enterPresent === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await load(page); await stories(page, VPS[0]);
  check((await page.textContent("#scRun")).includes("Play") && (await page.textContent("#scStoryboard")).includes("At the start") && (await page.getAttribute("#scStoryAdd", "aria-label")) === "New story", "sin red: la hoja de Historias en inglés");
  await ctx.close();
}

(async () => {
  const { server, base } = await serve(root);
  const baseSrv = baseRoot ? await serve(baseRoot) : null;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    if (baseSrv) await spanishIdentical(browser, base, baseSrv.base); else info("sin FLUYO_BASE_ROOT: la comparación con a0919e6 se salta");
    await english(browser, base);
    await pseudo(browser, base);
    await live(browser, base);
    await presentViewerShare(browser, base);
    await offline(browser, base);
  } finally { await browser.close(); server.close(); if (baseSrv) baseSrv.server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
