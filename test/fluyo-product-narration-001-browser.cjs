"use strict";
/* FLUYO-PRODUCT-NARRATION-001 — La frase del autor en cualquier paso, en Chrome real (árbol de trabajo, service worker bloqueado).
   Caso real: Cliente (web) → API Checkout → Servicio Pagos → PSP (Stripe), y Pagos → Base de datos. Historia «Pago con tarjeta»: 5 envíos
   (uno al revés: el PSP confirma) y una comprobación en la API, con DOS eventos («Petición», «Comprobación») y la frase en cada paso.
   · E  Editor a 1440 (ratón, Enter, Ctrl+Z / Ctrl+Y) y a 390 (dedo, botones): en un ENVÍO, «Mensaje del paso…» tras «Invertir sentido»
        con el hint «Ahora se lee «Petición»»; escribir, cambiar y quitar son UNA entrada de Undo cada vez, Undo/Redo exactos, la
        selección no cambia; la fila enseña la frase. Reproducir: el rótulo del lienzo (#scNow) dice la frase de cada momento, entera.
   · P  Present a 1440, 390 y 844×390: el encabezado dice la frase de cada momento, entera, y no tapa el diagrama (también con 120
        caracteres).
   · V  Viewer /s/ (enlace #d= de la Historia) a 1440, 390 y 844×390: el rótulo dice la frase de cada momento, entera (sin «…»), dentro
        de la pantalla; con 120 caracteres pasa a varias líneas. Sin mensajes, el rótulo es el de la base (mismo texto y mismo alto).
   · R  El horario visible es el mismo con y sin mensajes (FluyoStoryClock.schedule en la página).
   · S  Sin frases y con títulos largos de varios eventos (complejo de 017.1): Viewer, rótulo del editor y Present IDÉNTICOS a la base.
   · A  Cliente anterior (87a9d76, servido aparte): el mismo enlace NO se abre a medias (Viewer: «no es un diagrama Fluyo válido»).
   Sin errores de consola.
   Uso: node test/fluyo-product-narration-001-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=dir capturas;
        FLUYO_OLD_ROOT=dir con el árbol de 87a9d76 para la parte A; sin él, A se salta y lo dice) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const oldRoot = process.env.FLUYO_OLD_ROOT ? path.resolve(process.env.FLUYO_OLD_ROOT) : null;
const shots = process.env.FLUYO_SHOTS || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2", ".ico": "image/x-icon" };
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

/* ───────── caso real ───────── */
const CASE = [["SEND", 6, "Cliente solicita el checkout del carrito"], ["OCCURRENCE", 2, "Checkout valida la sesión del cliente"], ["SEND", 7, "Checkout pide a Pagos cobrar $49"],
  ["SEND", 8, "Pagos cobra la tarjeta en el PSP"], ["SEND", 8, "El PSP confirma el pago", true], ["SEND", 9, "El pedido queda confirmado y pagado"]];
const LONG = ("Pagos cobra 49 dólares en la tarjeta guardada del cliente a través del PSP, con 3-D Secure y una clave de idempotencia " + "x".repeat(40)).slice(0, 120);
const N = (id, label, x, y, shape = "rect") => ({ id, shape, x, y, w: 170, h: 64, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" });
/* variant: "narrated" (frase en cada paso), "before" (sin frases), "long" (narrada, el paso 4 con 120 caracteres) */
const DOC = (variant) => {
  const steps = CASE.map(([a, t, s, r], i) => Object.assign({ id: i + 1, at: i * 1600, eventTypeId: a === "SEND" ? 1 : 2, action: a }, a === "SEND" ? { edgeId: t } : { nodeId: t }, r ? { reverse: true } : {},
    variant === "before" ? {} : { message: variant === "long" && i === 3 ? LONG : s }));
  return { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
    doc: { theme: "dark", customBg: "", cur: 0, nextEventTypeId: 3,
      eventTypes: [{ id: 1, name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
        { id: 2, name: "Comprobación", primitive: "OCCURRENCE", sentenceTemplate: "{target} comprueba", visual: { kind: "token", value: "✓" }, motion: "normal", presentation: { nodeEffects: { message: "", highlight: true, visualDuration: "long" } } }],
      pages: [{ name: "Checkout", nextId: 100, behaviors: [], nextScenarioId: 2,
        nodes: [N(1, "Cliente (web)", 120, 300), N(2, "API Checkout", 400, 300), N(3, "Servicio Pagos", 680, 300), N(4, "PSP (Stripe)", 960, 300), N(5, "Base de datos", 680, 500, "cylinder")],
        edges: [E(6, 1, 2), E(7, 2, 3), E(8, 3, 4), E(9, 3, 5)],
        scenarios: [{ id: 1, engineVersion: 2, name: "Pago con tarjeta", nextStepId: 7, steps }] }] } };
};
const TITLES = (variant) => CASE.map((c, i) => (variant === "before" ? (c[0] === "SEND" ? "Petición" : "Comprobación") : variant === "long" && i === 3 ? LONG : c[2]));

async function open(browser, base, vp, touch) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [], dialogs = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => { dialogs.push(d.message()); d.accept(); });
  return { ctx, page, errors, dialogs };
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name + ".png") }); };
const stepsJson = (page) => page.evaluate(() => JSON.stringify(P().scenarios[0].steps));
const docJson = (page) => page.evaluate(() => JSON.stringify(serializeProject().doc));
/* un texto se lee entero si no se desborda (scrollWidth) y su caja está dentro de la pantalla */
const whole = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); const r = el.getBoundingClientRect();
  return { text: el.textContent, cut: el.scrollWidth > el.clientWidth + 1, inside: r.left >= -1 && r.right <= innerWidth + 1, h: r.height, bottom: r.bottom }; }, sel);
/* la caja en pantalla del diagrama entero (los nodos), con la vista que tenga ahora la página */
const diagramTop = (page) => page.evaluate(() => { const v = typeof view !== "undefined" ? view : { x: viewX, y: viewY, zoom: viewZoom };
  const cvs = document.querySelector("#sv, #cv").getBoundingClientRect();
  return cvs.top + Math.min(...P().nodes.map((n) => (n.y - n.h / 2) * v.zoom + v.y)); });

async function editor(browser, base, vp, label, touch) {
  console.log(`\n── E · editor ${label} (${vp.width}×${vp.height}${touch ? ", dedo" : ""})`);
  const T = await open(browser, base, vp, touch);
  const tap = (loc) => (touch ? loc.tap() : loc.click());
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, DOC("before"));
    await tap(page.locator(touch ? "#btnStories" : "#tabScenarios")); await page.waitForFunction(() => document.body.classList.contains("storyMode")); await page.waitForTimeout(450);
    if (touch) { await tap(page.locator("#btnStoryExpand")); await page.waitForFunction(() => document.body.classList.contains("storyExpanded")); await page.waitForTimeout(300); }
    const row = (id) => page.locator(`#scStoryboard [data-step-id="${id}"]`);
    const openMenu = async (id) => {
      const more = row(id).locator(".scMore");
      await more.scrollIntoViewIfNeeded(); await tap(more);
      await page.waitForFunction(() => { const p = document.getElementById("scPopover"); return p && !p.hidden && p.querySelector("button"); });
      return page.evaluate(() => [...document.querySelectorAll("#scPopover > *")].map((el) => el.classList.contains("scMenuSep") ? "—" : el.textContent.trim()));
    };
    const item = (name) => page.locator("#scPopover button").filter({ hasText: name }).first();
    const rowMsg = (id) => page.evaluate((i) => { const el = document.querySelector(`#scStoryboard [data-step-id="${i}"] .scStepMessage`); return el ? el.textContent : null; }, id);
    const undoN = () => page.evaluate(() => undoStack.length);
    const undo = () => (touch ? tap(page.locator("#btnUndo")) : page.keyboard.press("Control+z"));
    const redo = () => (touch ? tap(page.locator("#btnRedo")) : page.keyboard.press("Control+y"));
    const editMessage = async (id, text, how = touch ? "button" : "enter") => {
      await openMenu(id); await tap(item("Mensaje del paso…"));
      const input = page.locator("#scPopover input.scMessageInput"); await input.waitFor();
      await input.fill(text);
      if (how === "enter") await input.press("Enter"); else await tap(item("Guardar mensaje"));
      await page.waitForTimeout(150);
    };

    /* el menú de un envío */
    const menu = await openMenu(3);
    const iI = menu.findIndex((t) => t.startsWith("Invertir sentido")), iM = menu.findIndex((t) => t.startsWith("Mensaje del paso…"));
    check(iI >= 0 && iM === iI + 1, "envío: «Mensaje del paso…» justo después de «Invertir sentido»: " + menu.slice(Math.max(0, iI - 1), iM + 1).join(" | "));
    check(menu[iM] === "Mensaje del paso…Ahora se lee «Petición»", "hint: " + menu[iM]);
    await tap(item("Mensaje del paso…"));
    const input = page.locator("#scPopover input.scMessageInput"); await input.waitFor();
    const ph = await input.getAttribute("placeholder"), help = await page.locator("#scPopover p").first().textContent();
    check(ph === "API Checkout envía a Servicio Pagos", "el campo propone la frase del evento: «" + ph + "»");
    check(/en lugar del nombre del evento/.test(help), "y explica dónde se lee: «" + help + "»");
    await page.evaluate(() => scClosePopover());

    /* escribir la Historia: una frase por paso (envíos y el elemento) */
    const before = await docJson(page), u0 = await undoN();
    await page.evaluate(() => { scSelectedStep = 3; });
    await editMessage(3, CASE[2][2]);
    const s3 = JSON.parse(await stepsJson(page)).find((s) => s.id === 3);
    check(JSON.stringify(s3) === JSON.stringify({ id: 3, at: 3200, eventTypeId: 1, action: "SEND", edgeId: 7, message: CASE[2][2] }), "paso 3 (envío): solo se añade message → " + JSON.stringify(s3));
    check((await undoN()) === u0 + 1, "una sola entrada de Undo");
    check(await page.evaluate(() => scSelectedStep === 3), "la selección del paso se conserva");
    check((await rowMsg(3)) === "«" + CASE[2][2] + "»", "la fila lo enseña: " + (await rowMsg(3)));
    const after3 = await docJson(page);
    await undo(); await page.waitForTimeout(150);
    check((await docJson(page)) === before, "Undo exacto (documento entero)");
    await redo(); await page.waitForTimeout(150);
    check((await docJson(page)) === after3, "Redo exacto (documento entero)");
    await editMessage(3, "Checkout pide a Pagos el cobro");
    check(JSON.parse(await stepsJson(page)).find((s) => s.id === 3).message === "Checkout pide a Pagos el cobro" && (await undoN()) === u0 + 2, "cambiar: otra entrada de Undo");
    await openMenu(3); await tap(item("Mensaje del paso…")); await tap(item("Quitar mensaje")); await page.waitForTimeout(150);
    check(!("message" in JSON.parse(await stepsJson(page)).find((s) => s.id === 3)) && (await rowMsg(3)) === null, "«Quitar mensaje» quita la clave en un envío");
    await undo(); await undo(); await page.waitForTimeout(150);
    check((await docJson(page)) === after3, "Undo ×2 vuelve a la primera frase");
    for (const [i, [, , s]] of CASE.entries()) if (i !== 2) await editMessage(i + 1, s);
    check((await stepsJson(page)) === JSON.stringify(DOC("narrated").doc.pages[0].scenarios[0].steps), "la Historia narrada desde el editor es EXACTAMENTE la del caso (6 frases, 2 eventos)");
    check(await page.evaluate(() => doc.eventTypes.length === 2), "sin eventos nuevos en la biblioteca");
    await shot(page, `narr-editor-filas-${vp.width}`);

    /* reproducir: el rótulo del lienzo dice cada frase, entera */
    if (touch) { await tap(page.locator("#btnStoryExpand")).catch(() => {}); await page.waitForTimeout(250); }
    await tap(page.locator("#scRun")); await page.waitForTimeout(80); await tap(page.locator("#scPause"));
    const seen = [];
    for (let i = 0; i < CASE.length; i++) {
      if (i > 0) await tap(page.locator("#scNext"));
      await page.waitForTimeout(350);
      const w = await whole(page, "#scNowCaption"); seen.push(w);
      if (i === 2) await shot(page, `narr-editor-momento-${vp.width}`);
    }
    check(seen.map((w) => w.text).join(" | ") === TITLES("narrated").join(" | "), "#scNow dice la frase de cada momento: " + seen.map((w) => w.text).join(" | "));
    check(seen.every((w) => !w.cut && w.inside), "entera y dentro de la pantalla en todos los momentos");
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function present(browser, base, vp, variant, label, touch) {
  console.log(`\n── P · Present ${label} (${vp.width}×${vp.height}), ${variant}`);
  const T = await open(browser, base, vp, touch);
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, DOC(variant));
    await page.evaluate(() => enterPresent()); await page.waitForTimeout(700);
    const top = await diagramTop(page);
    await page.locator("#psPlay").click(); await page.waitForTimeout(80); await page.locator("#psPause").click();
    const seen = [];
    for (let i = 0; i < CASE.length; i++) {
      if (i > 0) await page.locator("#psNext").click();
      await page.waitForTimeout(350);
      seen.push(await whole(page, "#psTitle"));
      if (i === 3) await shot(page, `narr-present-${variant}-${vp.width}x${vp.height}`);
    }
    const header = await page.evaluate(() => document.getElementById("presentStory").getBoundingClientRect().bottom);
    check(seen.map((w) => w.text).join(" | ") === TITLES(variant).join(" | "), "el encabezado dice: " + seen.map((w) => w.text.slice(0, 40)).join(" | "));
    check(seen.every((w) => !w.cut && w.inside), "cada título entero y dentro de la pantalla");
    const maxBottom = Math.max(...(await Promise.all([header])), ...seen.map((w) => w.bottom));
    check(Math.round(top) >= Math.round(maxBottom), `el encabezado (hasta ${Math.round(maxBottom)} px) no tapa el diagrama (empieza en ${Math.round(top)} px)`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function shareUrl(browser, base, variant) {
  const T = await open(browser, base, { width: 1200, height: 800 });
  try {
    await T.page.goto(base + "/"); await T.page.waitForFunction(() => typeof applyProjectData === "function" && typeof createShareUrl === "function");
    await T.page.evaluate((d) => applyProjectData(d), DOC(variant));
    return await T.page.evaluate(() => createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: 1 }));
  } finally { await T.ctx.close(); }
}
async function viewer(browser, base, url, vp, variant, label, touch) {
  console.log(`\n── V · Viewer /s/ ${label} (${vp.width}×${vp.height}), ${variant}`);
  const T = await open(browser, base, vp, touch);
  try {
    const { page } = T;
    await page.goto(url); await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    check(await page.evaluate((s) => JSON.stringify(doc.pages[0].scenarios[0].steps) === s, JSON.stringify(DOC(variant).doc.pages[0].scenarios[0].steps)), "el Viewer recibe los Steps tal cual");
    await page.locator("#stPlay").click(); await page.waitForTimeout(80); await page.locator("#stPause").click();
    const seen = [];
    for (let i = 0; i < CASE.length; i++) {
      if (i > 0) await page.locator("#stNext").click();
      await page.waitForTimeout(350);
      seen.push(Object.assign(await whole(page, "#stTitle"), { card: await whole(page, "#stNow") }));
      if (i === 3) await shot(page, `narr-viewer-${variant}-${vp.width}x${vp.height}`);
    }
    check(seen.map((w) => w.text).join(" | ") === TITLES(variant).join(" | "), "el rótulo dice: " + seen.map((w) => w.text.slice(0, 40)).join(" | "));
    check(seen.every((w) => !w.cut && w.inside && w.card.inside), "cada título entero (sin «…») y el rótulo dentro de la pantalla");
    const lineH = 20, h4 = seen[3].h;
    if (variant === "long") check(h4 > lineH * 1.5, `120 caracteres: el título pasa a varias líneas (${Math.round(h4)} px)`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
    return seen;
  } finally { await T.ctx.close(); }
}

async function schedules(browser, base) {
  console.log("\n── R · horario visible con y sin frases");
  const T = await open(browser, base, { width: 1200, height: 800 });
  try {
    await T.page.goto(base + "/"); await T.page.waitForFunction(() => typeof applyProjectData === "function" && typeof FluyoStoryClock !== "undefined");
    const s = await T.page.evaluate((ds) => ds.map((d) => { applyProjectData(d); const sc = P().scenarios[0]; return JSON.stringify(FluyoStoryClock.schedule(sc, FluyoStory.stepMeta(sc.steps))); }),
      [DOC("before"), DOC("narrated"), DOC("long")]);
    check(s[0] === s[1] && s[1] === s[2], "FluyoStoryClock.schedule idéntico (sin frases, con frases y con 120 caracteres)");
  } finally { await T.ctx.close(); }
}

/* Sin frases, con títulos LARGOS de varios eventos («Notificación · Confirmación · Procesamiento», el documento complejo de 017.1): el
   rótulo del Viewer, el del editor y el encaje de Present son los de la base (D-PO-2 solo vale para los momentos narrados). */
async function noMessageIdentical(browser, nowBase, oldBase, vp, label, touch) {
  console.log(`\n── S · sin frases, títulos largos: idéntico a la base (${label}, ${vp.width}×${vp.height})`);
  const doc = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"), "utf8"));
  const measure = async (base) => {
    const T = await open(browser, base, vp, touch);
    try {
      const { page } = T;
      await page.goto(base + "/"); await page.waitForFunction(() => typeof createShareUrl === "function" && typeof applyProjectData === "function" && typeof cv !== "undefined");
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, doc);
      /* Present: el borde del encabezado y dónde empieza el diagrama */
      await page.evaluate(() => enterPresent()); await page.waitForTimeout(700);
      const present = { top: Math.round(await diagramTop(page)), header: await page.evaluate(() => Math.round(document.getElementById("presentStory").getBoundingClientRect().bottom)) };
      await page.evaluate(() => exitPresent()); await page.waitForTimeout(300);
      /* el rótulo del editor, momento a momento */
      if (!touch) {
        await page.locator("#tabScenarios").click(); await page.waitForTimeout(300);
        await page.locator("#scRun").click(); await page.waitForTimeout(60); await page.locator("#scPause").click();
      }
      const editor = [];
      if (!touch) for (let i = 0; i < 4; i++) {
        if (i) await page.locator("#scNext").click();
        await page.waitForTimeout(350);
        editor.push(await page.evaluate(() => { const c = document.getElementById("scNow").getBoundingClientRect(), t = document.getElementById("scNowCaption");
          return [t.textContent, Math.round(c.width), Math.round(c.height), t.scrollWidth > t.clientWidth + 1, t.classList.contains("narrated")]; }));
      }
      /* el Viewer */
      const url = await page.evaluate(() => createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: P().scenarios[0].id }));
      await page.goto(url); await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 }); await page.waitForTimeout(300);
      await page.locator("#stPlay").click(); await page.waitForTimeout(60); await page.locator("#stPause").click();
      const viewer = [];
      for (let i = 0; i < 4; i++) {
        if (i) await page.locator("#stNext").click();
        await page.waitForTimeout(400);
        viewer.push(await page.evaluate(() => { const c = document.getElementById("stNow").getBoundingClientRect(), t = document.getElementById("stTitle");
          return [t.textContent, Math.round(c.width), Math.round(c.height), t.scrollWidth > t.clientWidth + 1, t.classList.contains("narrated")]; }));
      }
      return { present, editor, viewer, errors: T.errors };
    } finally { await T.ctx.close(); }
  };
  const now = await measure(nowBase), was = await measure(oldBase);
  check(now.viewer.some((r) => r[0].includes(" · ")), "hay un título de varios eventos: «" + now.viewer.map((r) => r[0]).join(" | ") + "»");
  check(JSON.stringify(now.viewer) === JSON.stringify(was.viewer.map((r) => [...r.slice(0, 4), false])), "Viewer: mismo texto, ancho, alto y corte que la base " + JSON.stringify(now.viewer.map((r) => r.slice(1, 4))));
  if (!touch) check(JSON.stringify(now.editor) === JSON.stringify(was.editor.map((r) => [...r.slice(0, 4), false])), "editor: el rótulo, igual que la base " + JSON.stringify(now.editor.map((r) => r.slice(1, 4))));
  check(JSON.stringify(now.present) === JSON.stringify(was.present), "Present: mismo encaje que la base " + JSON.stringify(now.present));
  check(now.errors.length === 0, "sin errores de consola" + (now.errors.length ? ": " + now.errors.join(" | ") : ""));
}

async function oldClient(browser, oldBase, url) {
  console.log("\n── A · cliente anterior (87a9d76) con un enlace cuyos envíos llevan frase");
  const T = await open(browser, oldBase, { width: 1440, height: 900 });
  try {
    const { page } = T;
    await page.goto(oldBase + "/s/" + new URL(url).hash); await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "error", null, { timeout: 15000 }).catch(() => {});
    const st = await page.evaluate(() => [window.__viewer.phase, document.getElementById("status").textContent]);
    check(st[0] === "error" && /no es un diagrama Fluyo válido/.test(st[1]), "el Viewer antiguo no lo abre a medias: «" + st[1] + "»");
    const p2 = await T.ctx.newPage(); p2.on("dialog", (d) => { T.dialogs.push(d.message()); d.accept(); });
    await p2.goto(oldBase + "/" + new URL(url).hash); await p2.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined"); await p2.waitForTimeout(1200);
    check(T.dialogs.some((d) => /no contiene un diagrama Fluyo válido/.test(d)), "el editor antiguo avisa: " + T.dialogs.join(" | "));
    check(await p2.evaluate(() => !JSON.stringify(serializeProject().doc).includes("Pago con tarjeta")), "y no carga nada del documento");
  } finally { await T.ctx.close(); }
}

(async () => {
  const t0 = Date.now();
  const now = await serve(root), old = oldRoot ? await serve(oldRoot) : null;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const DESK = { width: 1440, height: 900 }, PHONE = { width: 390, height: 844 }, LAND = { width: 844, height: 390 };
  try {
    await editor(browser, now.base, DESK, "escritorio", false);
    await editor(browser, now.base, PHONE, "móvil", true);
    for (const v of ["narrated", "long"]) {
      await present(browser, now.base, DESK, v, "escritorio", false);
      await present(browser, now.base, PHONE, v, "móvil", true);
      await present(browser, now.base, LAND, v, "móvil apaisado", true);
    }
    const urls = { before: await shareUrl(browser, now.base, "before"), narrated: await shareUrl(browser, now.base, "narrated"), long: await shareUrl(browser, now.base, "long") };
    for (const [vp, label, touch] of [[DESK, "escritorio", false], [PHONE, "móvil", true], [LAND, "móvil apaisado", true]]) {
      const b = await viewer(browser, now.base, urls.before, vp, "before", label, touch);
      if (old) {   // sin frases, el rótulo es el de la base: mismo texto y mismo alto
        const o = await viewer(browser, old.base, urls.before.replace(now.base, old.base), vp, "before", label + " · base 87a9d76", touch);
        check(JSON.stringify(b.map((w) => [w.text, Math.round(w.card.h)])) === JSON.stringify(o.map((w) => [w.text, Math.round(w.card.h)])), "sin frases: mismo texto y mismo alto de rótulo que la base");
      }
      await viewer(browser, now.base, urls.narrated, vp, "narrated", label, touch);
      await viewer(browser, now.base, urls.long, vp, "long", label, touch);
    }
    await schedules(browser, now.base);
    if (old) for (const [vp, label, touch] of [[DESK, "escritorio", false], [PHONE, "móvil", true], [LAND, "móvil apaisado", true]]) await noMessageIdentical(browser, now.base, old.base, vp, label, touch);
    else console.log("\n── S · sin frases idéntico a la base: OMITIDO (sin FLUYO_OLD_ROOT)");
    if (old) await oldClient(browser, old.base, urls.narrated); else console.log("\n── A · cliente anterior: OMITIDO (sin FLUYO_OLD_ROOT)");
  } finally { await browser.close(); now.server.close(); if (old) old.server.close(); }
  console.log(`\nFLUYO-PRODUCT-NARRATION-001 navegador: ${passed}/${passed + failed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
