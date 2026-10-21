"use strict";
/* FLUYO-MCP-STEP-MESSAGE-001 — «Mensaje del paso…» y el globo del paso en Chrome real (árbol de trabajo, service worker bloqueado).
   Historia: 1 «Pregunta» de Usuario con mensaje propio, 2 Usuario pide a API, 3 «Pregunta» de API sin mensaje (su evento no tiene)
   que espera la llegada del 2, 4 «Cae» DB (su evento dice «Caída»).
   · E  Editor a 1440 (ratón, Enter, Ctrl+Z / Ctrl+Y) y a 390 (dedo, botones Guardar/Deshacer/Rehacer): la fila enseña el mensaje; el
        menú tiene «Mensaje del paso…» justo después de «Cambiar dónde ocurre…» (no en un envío) con el texto que se ve ahora; escribir,
        guardar, cambiar y quitar son UNA entrada de Undo cada vez, Undo/Redo exactos, la selección no cambia; guardar vacío no hace
        nada y lo explica; 120 caracteres caben enteros; duplicar lo conserva; el autoguardado y abrir/guardar lo conservan EXACTO.
        Reproducir: el globo de cada paso dice SU texto, a la hora de su momento (la misma que sin mensajes).
   · P  Present: los globos dicen el texto de cada paso y el título del momento sigue siendo el nombre del evento.
   · V  Viewer /s/ a 1440 y 390 (enlace #d= creado con createShareUrl): llegan los Steps tal cual y los globos dicen su texto.
   · A  Cliente anterior (2da088e, servido aparte): el mismo enlace NO se abre a medias: el editor avisa y conserva la sesión, el Viewer
        dice «no es un diagrama Fluyo válido».
   Sin errores de consola. El globo se mide envolviendo drawNodeCueMessage DESDE LA PÁGINA (el código servido no cambia).
   Uso: node test/fluyo-step-message-001-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=dir capturas;
        FLUYO_OLD_ROOT=dir con el árbol de 2da088e para la parte A; sin él, A se salta y lo dice) */
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

/* ───────── fixture ───────── */
const U = 1, A = 2, D = 3;
const X = { [U]: 200, [A]: 560, [D]: 920 };
const N = (id, label) => ({ id, shape: "rect", x: X[id], y: 340, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" });
const ASK = "¿Cuál es mi saldo?", NEW = "Consulta saldo y límites";
const LONG = ("Necesito saber si puedo transferir dos millones hoy mismo antes del cierre del banco central, sin comisiones y con aviso " + "x".repeat(120)).slice(0, 120);
const DOC = () => ({ version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
  doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 4,
    eventTypes: [
      { id: 1, name: "Pide", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "slow" },
      { id: 2, name: "Pregunta", primitive: "OCCURRENCE", sentenceTemplate: "{target} pregunta", visual: { kind: "token", value: "?" }, motion: "normal",
        presentation: { nodeEffects: { message: "", highlight: true, visualDuration: "long" } } },
      { id: 3, name: "Cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" },
        presentation: { nodeEffects: { message: "Caída", visualDuration: "long" } } }],
    pages: [{ name: "Saldo", nextId: 100, behaviors: [], nextScenarioId: 2,
      nodes: [N(U, "Usuario"), N(A, "API"), N(D, "DB")],
      edges: [E(4, U, A), E(5, A, D)],
      scenarios: [{ id: 1, engineVersion: 2, name: "Saldo", nextStepId: 5, arrivalDependencies: [{ stepId: 3, waitsForArrivalOf: [2] }], steps: [
        { id: 1, at: 0, eventTypeId: 2, action: "OCCURRENCE", nodeId: U, message: ASK },
        { id: 2, at: 900, eventTypeId: 1, action: "SEND", edgeId: 4 },
        { id: 3, at: 1300, eventTypeId: 2, action: "OCCURRENCE", nodeId: A },
        { id: 4, at: 2600, eventTypeId: 3, action: "SET_STATE", nodeId: D, state: "DOWN" }] }] }] } });
/* Cada globo pintado: su texto (las líneas), en qué instante virtual de la reproducción y su ancho. */
const PROBE = () => {
  window.__msg = [];
  const dm = window.drawNodeCueMessage;
  window.drawNodeCueMessage = function (c, m, fx) {
    const pb = (typeof scPlayback !== "undefined" && scPlayback) || (window.__viewerPlayback && window.__viewerPlayback());
    window.__msg.push({ text: m.lines.join(" "), lines: m.lines.length, w: m.w, t: pb ? pb.cursorVirtual : null, fx: fx.message });
    return dm.apply(this, arguments);
  };
};
const firstSeen = (raw) => { const out = {}; for (const r of raw) if (!(r.text in out)) out[r.text] = r.t; return out; };
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

async function editor(browser, base, vp, label, touch) {
  console.log(`\n── E · editor ${label} (${vp.width}×${vp.height}${touch ? ", dedo" : ""})`);
  const T = await open(browser, base, vp, touch);
  const tap = (loc) => (touch ? loc.tap() : loc.click());
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, DOC());
    await page.evaluate(() => { viewZoom = 0.9; viewX = 20; viewY = 40; });
    await tap(page.locator(touch ? "#btnStories" : "#tabScenarios")); await page.waitForFunction(() => document.body.classList.contains("storyMode")); await page.waitForTimeout(450);
    if (touch) { await tap(page.locator("#btnStoryExpand")); await page.waitForFunction(() => document.body.classList.contains("storyExpanded")); await page.waitForTimeout(300); }
    const row = (id) => page.locator(`#scStoryboard [data-step-id="${id}"]`);
    const openMenu = async (id) => {
      const more = row(id).locator(".scMore");
      await more.scrollIntoViewIfNeeded();
      await tap(more);
      await page.waitForFunction(() => { const p = document.getElementById("scPopover"); return p && !p.hidden && p.querySelector("button"); });
      return page.evaluate(() => [...document.querySelectorAll("#scPopover > *")].map((el) => el.classList.contains("scMenuSep") ? "—" : el.textContent.trim()));
    };
    const item = (name) => page.locator("#scPopover button").filter({ hasText: name }).first();
    const rowMsg = (id) => page.evaluate((i) => { const el = document.querySelector(`#scStoryboard [data-step-id="${i}"] .scStepMessage`); return el ? el.textContent : null; }, id);
    const undoN = () => page.evaluate(() => undoStack.length);
    const undo = () => (touch ? tap(page.locator("#btnUndo")) : page.keyboard.press("Control+z"));
    const redo = () => (touch ? tap(page.locator("#btnRedo")) : page.keyboard.press("Control+y"));
    /* «Mensaje del paso…» → escribir → guardar (Enter con teclado; «Guardar mensaje» con el dedo) */
    const editMessage = async (id, text, how = touch ? "button" : "enter") => {
      await openMenu(id); await tap(item("Mensaje del paso…"));
      const input = page.locator("#scPopover input.scMessageInput");
      await input.waitFor();
      await input.fill(text);
      if (how === "enter") await input.press("Enter"); else await tap(item("Guardar mensaje"));
      await page.waitForTimeout(150);
    };

    /* la fila y el menú */
    check((await rowMsg(1)) === "«" + ASK + "»", "la fila del paso 1 enseña su mensaje: " + (await rowMsg(1)));
    check((await rowMsg(3)) === null && (await rowMsg(4)) === null, "sin mensaje propio, la fila no añade nada");
    let menu = await openMenu(1);
    const iC = menu.findIndex((t) => t.startsWith("Cambiar dónde ocurre…")), iM = menu.findIndex((t) => t.startsWith("Mensaje del paso…"));
    check(iC >= 0 && iM === iC + 1, "«Mensaje del paso…» justo después de «Cambiar dónde ocurre…»: " + menu.slice(Math.max(0, iC), iM + 1).join(" | "));
    check(menu[iM] === "Mensaje del paso…«" + ASK + "»", "hint con el mensaje propio: " + menu[iM]);
    const box = await item("Mensaje del paso…").boundingBox();
    check(box && box.height >= (touch ? 40 : 28) && box.x >= 0 && box.x + box.width <= vp.width, `la entrada cabe y se puede pulsar (${Math.round(box?.width)}×${Math.round(box?.height)} px)`);
    await shot(page, `msg-menu-${vp.width}`);
    menu = await openMenu(2);
    check(!menu.some((t) => t.startsWith("Mensaje del paso")), "un envío (Usuario pide a API) no la tiene");
    check((await openMenu(3)).includes("Mensaje del paso…Ahora sin mensaje"), "evento sin mensaje: «Ahora sin mensaje»");
    check((await openMenu(4)).includes("Mensaje del paso…Ahora el del evento: «Caída»"), "evento con mensaje: «Ahora el del evento: «Caída»»");
    await page.evaluate(() => scClosePopover());

    /* escribir uno nuevo (paso 3) */
    const before = await docJson(page), u0 = await undoN();
    await page.evaluate(() => { scSelectedStep = 3; });
    await editMessage(3, NEW);
    const s3 = JSON.parse(await stepsJson(page)).find((s) => s.id === 3);
    check(JSON.stringify(s3) === JSON.stringify({ id: 3, at: 1300, eventTypeId: 2, action: "OCCURRENCE", nodeId: A, message: NEW }), "paso 3: solo se añade message → " + JSON.stringify(s3));
    check((await undoN()) === u0 + 1, "una sola entrada de Undo");
    check(await page.evaluate(() => scSelectedStep === 3), "la selección del paso se conserva");
    check((await rowMsg(3)) === "«" + NEW + "»", "la fila lo enseña al momento");
    check(await page.evaluate(() => JSON.stringify(P().scenarios[0].arrivalDependencies)) === '[{"stepId":3,"waitsForArrivalOf":[2]}]', "las dependencias no cambian");
    await shot(page, `msg-fila-${vp.width}`);
    const afterNew = await docJson(page);
    await undo(); await page.waitForTimeout(150);
    check((await docJson(page)) === before, "Undo exacto (documento entero)");
    check((await rowMsg(3)) === null, "tras Undo la fila ya no lo enseña");
    await redo(); await page.waitForTimeout(150);
    check((await docJson(page)) === afterNew, "Redo exacto (documento entero)");

    /* guardar vacío: nada, y lo explica */
    await openMenu(3); await tap(item("Mensaje del paso…"));
    const input = page.locator("#scPopover input.scMessageInput");
    check((await input.inputValue()) === NEW && (await input.getAttribute("maxlength")) === "120", "el campo trae el texto actual y maxlength 120");
    await input.fill("   ");
    await tap(item("Guardar mensaje")); await page.waitForTimeout(100);
    check(/Quitar mensaje/.test(await input.evaluate((el) => el.validationMessage)), "vacío: no guarda y dice cómo quitarlo («" + (await input.evaluate((el) => el.validationMessage)) + "»)");
    check((await docJson(page)) === afterNew && (await undoN()) === u0 + 1, "ni documento ni Undo cambian");
    await page.evaluate(() => scClosePopover());

    /* 120 caracteres: entero, sin recortar */
    check(LONG.length === 120, "el texto largo mide 120");
    await editMessage(3, LONG + "ZZZ");
    check(JSON.parse(await stepsJson(page)).find((s) => s.id === 3).message === LONG, "el campo no deja pasar de 120: se guarda el texto de 120, entero");
    check((await rowMsg(3)) === "«" + LONG + "»", "la fila lo enseña entero");
    const rowBox = await row(3).boundingBox();
    check(rowBox && rowBox.x + rowBox.width <= vp.width + 1, "la fila no se sale del panel");
    await undo(); await page.waitForTimeout(150);
    check((await docJson(page)) === afterNew, "Undo vuelve al texto anterior");

    /* quitar (paso 1) */
    await openMenu(1); await tap(item("Mensaje del paso…"));
    await tap(item("Quitar mensaje")); await page.waitForTimeout(150);
    const s1 = JSON.parse(await stepsJson(page)).find((s) => s.id === 1);
    check(!("message" in s1) && (await rowMsg(1)) === null, "«Quitar mensaje» quita la clave: " + JSON.stringify(s1));
    check((await openMenu(1)).includes("Mensaje del paso…Ahora sin mensaje"), "el menú vuelve a «Ahora sin mensaje»");
    await page.evaluate(() => scClosePopover());
    await undo(); await page.waitForTimeout(150);
    check((await docJson(page)) === afterNew, "Undo devuelve el mensaje exacto");

    /* el texto es texto: nada se interpreta como HTML */
    await editMessage(3, "<b>negrita</b> <img src=x onerror=\"window.__xss=1\">");
    check(await page.evaluate(() => { const el = document.querySelector('#scStoryboard [data-step-id="3"] .scStepMessage'); return !!el && !el.querySelector("b,img") && el.textContent.includes("<b>negrita</b>") && !window.__xss; }), "un mensaje con marcas se enseña como texto (sin HTML)");
    await undo(); await page.waitForTimeout(150);
    check((await docJson(page)) === afterNew, "Undo lo deshace");

    /* duplicar */
    await openMenu(1); await tap(item("Duplicar")); await page.waitForTimeout(150);
    const copies = JSON.parse(await stepsJson(page)).filter((s) => s.message === ASK);
    check(copies.length === 2, "Duplicar: la copia lleva el mismo mensaje " + JSON.stringify(copies.map((s) => s.id)));
    await undo(); await page.waitForTimeout(150);
    /* los contadores de ids nunca bajan con Undo (FLUYO-012.1): se comparan los Steps */
    check((await stepsJson(page)) === JSON.stringify(JSON.parse(afterNew).pages[0].scenarios[0].steps), "Undo quita la copia");
    await page.evaluate((d) => { applyProjectData(JSON.parse(d)); }, JSON.stringify({ version: 5, app: "fluyo", doc: JSON.parse(afterNew), settings: {} }));

    /* guardar/abrir y autoguardado */
    const rt = await page.evaluate(() => { const s = JSON.stringify(serializeProject()); applyProjectData(JSON.parse(s)); return [s === JSON.stringify(serializeProject()), JSON.stringify(serializeProject().doc.pages[0].scenarios[0].steps)]; });
    check(rt[0], "guardar → abrir → guardar: idéntico");
    const auto = await page.evaluate(() => { saveAutosave(true); return JSON.stringify(loadAutosaveData().doc.pages[0].scenarios[0].steps); });
    check(auto === rt[1] && auto.includes(NEW) && auto.includes(ASK), "el autoguardado lleva los mensajes tal cual");

    /* reproducir: el globo de cada paso dice SU texto, a la hora de su momento */
    if (touch) { await tap(page.locator("#btnStoryExpand")).catch(() => {}); }
    await page.evaluate(PROBE);
    const sched = await page.evaluate(() => { const sc = P().scenarios[0]; const plain = JSON.parse(JSON.stringify(sc)); plain.steps.forEach((s) => delete s.message);
      return [FluyoStoryClock.schedule(sc, FluyoStory.stepMeta(sc.steps)).byStep, FluyoStoryClock.schedule(plain, FluyoStory.stepMeta(plain.steps)).byStep,
        JSON.stringify(FluyoStory.run(P(), sc).trace) === JSON.stringify(FluyoStory.run(P(), plain).trace)]; });
    check(JSON.stringify(sched[0]) === JSON.stringify(sched[1]) && sched[2], "horario visible y Trace idénticos con y sin mensajes " + JSON.stringify(sched[0]));
    await tap(page.locator("#scRun"));
    await page.waitForTimeout(700); await shot(page, `msg-globo-${vp.width}`);
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) { if (await page.evaluate(() => scStatus === "completed")) break; await page.waitForTimeout(120); }
    const seen = firstSeen(await page.evaluate(() => window.__msg));
    check(Object.keys(seen).sort().join(" | ") === [ASK, NEW, "Caída"].sort().join(" | "), "globos pintados: " + Object.keys(seen).join(" | "));
    check(Math.abs(seen[ASK] - sched[0][1]) < 400 && Math.abs(seen[NEW] - sched[0][3]) < 400 && Math.abs(seen["Caída"] - sched[0][4]) < 400,
      `cada globo sale a la hora de su momento (${Math.round(seen[ASK])}/${sched[0][1]}, ${Math.round(seen[NEW])}/${sched[0][3]}, ${Math.round(seen["Caída"])}/${sched[0][4]})`);
    await shot(page, `msg-reproduccion-${vp.width}`);
    await page.evaluate(() => { if (typeof scStopPlayback === "function") scStopPlayback(); else if (typeof scReset === "function") scReset(); });
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
    return JSON.parse(await page.evaluate(() => JSON.stringify(serializeProject())));
  } finally { await T.ctx.close(); }
}

async function present(browser, base, data) {
  console.log("\n── P · Present (1440×900) con el documento editado");
  const T = await open(browser, base, { width: 1440, height: 900 });
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, data);
    await page.click("#tabScenarios"); await page.waitForTimeout(300);
    await page.locator("#btnPresent").click(); await page.waitForFunction(() => presenting);
    await page.evaluate(PROBE);
    await page.locator("#psPlay").click();
    const titles = new Set(); const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const s = await page.evaluate(() => ({ ph: presentPhase(), t: document.getElementById("psTitle").textContent }));
      titles.add(s.t);
      if (s.ph === "finished") break;
      await page.waitForTimeout(80);
    }
    const seen = firstSeen(await page.evaluate(() => window.__msg));
    check(Object.keys(seen).sort().join(" | ") === [ASK, NEW, "Caída"].sort().join(" | "), "globos en Present: " + Object.keys(seen).join(" | "));
    check([...titles].includes("Pregunta") && ![...titles].some((t) => t.includes(ASK) || t.includes(NEW)), "el título del momento es el nombre del evento: " + [...titles].join(" | "));
    await shot(page, "msg-present");
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function viewer(browser, base, vp, data) {
  console.log(`\n── V · Viewer /s/ (${vp.width}×${vp.height}) con el documento editado`);
  const T = await open(browser, base, vp);
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof createShareUrl === "function");
    await page.evaluate((d) => { applyProjectData(d); }, data);
    const url = await page.evaluate(() => createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: 1 }));
    check(/\/s\/#d=[A-Za-z0-9_-]+$/.test(url), "enlace #d= creado");
    await page.goto(url); await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
    check(await page.evaluate(() => JSON.stringify(doc.pages[0].scenarios[0].steps)) === JSON.stringify(data.doc.pages[0].scenarios[0].steps), "el Viewer recibe los Steps tal cual (con sus message)");
    await page.evaluate(PROBE);
    await page.locator("#stPlay").click();
    await page.waitForTimeout(700); await shot(page, `msg-viewer-globo-${vp.width}`);
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) { if (await page.evaluate(() => window.__viewer.story === "completed")) break; await page.waitForTimeout(100); }
    const seen = Object.keys(firstSeen(await page.evaluate(() => window.__msg)));
    check(seen.sort().join(" | ") === [ASK, NEW, "Caída"].sort().join(" | "), "globos en el Viewer: " + seen.join(" | "));
    await shot(page, `msg-viewer-${vp.width}`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
    return url;
  } finally { await T.ctx.close(); }
}

/* El cliente anterior abre el MISMO enlace (#d=) en el editor y en el Viewer: lo rechaza entero, nunca a medias. */
async function oldClient(browser, oldBase, url) {
  console.log("\n── A · cliente anterior (2da088e) con un enlace que lleva message");
  const hash = new URL(url).hash;
  const T = await open(browser, oldBase, { width: 1440, height: 900 });
  const newPg = async () => { const p = await T.ctx.newPage(); p.on("dialog", (d) => { T.dialogs.push(d.message()); d.accept(); }); p.on("pageerror", (e) => T.errors.push(String(e))); return p; };
  try {
    /* A1 · sin sesión guardada: avisa y no carga nada */
    let page = await newPg();
    await page.goto(oldBase + "/" + hash); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.waitForTimeout(1200);
    check(T.dialogs.some((d) => /no contiene un diagrama Fluyo válido/.test(d)), "el editor antiguo avisa: " + T.dialogs.join(" | "));
    check(await page.evaluate(() => !JSON.stringify(serializeProject().doc).includes("Saldo")), "y no carga nada del documento (ni a medias)");
    await page.close();
    /* A2 · con una sesión guardada: avisa, no ofrece abrirlo (no hay «descartar» que pueda borrarla) y la sesión sigue intacta */
    page = await newPg();
    await page.goto(oldBase + "/"); await page.waitForFunction(() => typeof applyProjectData === "function");
    const saved = await page.evaluate(() => { applyProjectData({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0,
      pages: [{ name: "Mía", nextId: 2, behaviors: [], nextScenarioId: 1, scenarios: [], edges: [], nodes: [{ id: 1, shape: "rect", x: 100, y: 100, w: 120, h: 60, label: "Mi nodo" }] }] }, settings: {} });
      saveAutosave(true); return localStorage.getItem("fluyo.autosave.v1"); });
    await page.close();
    const n0 = T.dialogs.length;
    page = await newPg();
    await page.goto(oldBase + "/" + hash); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.waitForTimeout(1200);
    check(T.dialogs.slice(n0).some((d) => /no contiene un diagrama Fluyo válido/.test(d)), "con sesión guardada también avisa");
    check(await page.evaluate(() => getComputedStyle(document.getElementById("incomingModal")).display === "none"), "no aparece «Tienes trabajo sin guardar» (no se puede elegir descartar)");
    check(saved && (await page.evaluate(() => localStorage.getItem("fluyo.autosave.v1"))) === saved, "el autoguardado sigue intacto");
    await page.close();
    /* A3 · el Viewer antiguo */
    page = await newPg();
    await page.goto(oldBase + "/s/" + hash); await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "error", null, { timeout: 15000 }).catch(() => {});
    const st = await page.evaluate(() => [window.__viewer.phase, document.getElementById("status").textContent]);
    check(st[0] === "error" && /no es un diagrama Fluyo válido/.test(st[1]), "el Viewer antiguo: «" + st[1] + "»");
  } finally { await T.ctx.close(); }
}

(async () => {
  const t0 = Date.now();
  const now = await serve(root), old = oldRoot ? await serve(oldRoot) : null;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    const desk = await editor(browser, now.base, { width: 1440, height: 900 }, "escritorio", false);
    const mob = await editor(browser, now.base, { width: 390, height: 844 }, "móvil", true);
    check(JSON.stringify(desk.doc.pages[0].scenarios[0].steps) === JSON.stringify(mob.doc.pages[0].scenarios[0].steps), "escritorio y móvil acaban con los mismos Steps");
    await present(browser, now.base, desk);
    const url = await viewer(browser, now.base, { width: 1440, height: 900 }, desk);
    await viewer(browser, now.base, { width: 390, height: 844 }, mob);
    if (old) await oldClient(browser, old.base, url); else console.log("\n── A · cliente anterior: OMITIDO (sin FLUYO_OLD_ROOT)");
  } finally { await browser.close(); now.server.close(); if (old) old.server.close(); }
  console.log(`\nFLUYO-MCP-STEP-MESSAGE-001 navegador: ${passed}/${passed + failed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
