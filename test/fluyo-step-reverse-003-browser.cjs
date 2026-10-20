"use strict";
/* FLUYO-STEP-REVERSE-003 — «Invertir sentido» en Chrome real (árbol de trabajo, service worker bloqueado).
   Historia sobre UNA conexión Servicio → DB: 1 petición, 2 «respuesta» dibujada al revés por error (Servicio → DB), 3 cae DB y
   4 respuesta ya inversa (DB → Servicio, source_down).
   · E  Editor a 1440 (ratón, Ctrl+Z / Ctrl+Y) y a 390 (dedo, botones Deshacer/Rehacer): el menú del Step tiene «Invertir sentido»
        justo después de «Cambiar dónde ocurre…» con el hint «Pasa a: …»; un evento de disponibilidad no la tiene. El clic da la
        vuelta al Step 2 (misma conexión, una entrada de Undo, el panel cambia al momento), Undo/Redo son exactos, el Step 4 vuelve a
        normal (sin la clave) y otra vez a inverso. Después: el token del Step 2 baja de DB a Servicio, Duplicar hereda el sentido y
        «Cambiar dónde ocurre» lo conserva.
   · P  Present con el documento editado: el token del Step 2 baja y el mensaje dice «No se completó · DB no está disponible».
   · V  Viewer /s/ a 1440 y 390 (enlace #d= creado con createShareUrl desde el editor): llegan los Steps invertidos y el token baja.
   Sin errores de consola. El token se mide envolviendo drawEventToken/flowText DESDE LA PÁGINA (el código servido no cambia).
   Uso: node test/fluyo-step-reverse-003-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=dir capturas) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
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
const U = 1, A = 2, S = 3, D = 4;
const X = { [U]: 140, [A]: 400, [S]: 660, [D]: 920 };
const N = (id, label) => ({ id, shape: "rect", x: X[id], y: 300, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" });
const DOC = () => ({ version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
  doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 4,
    eventTypes: [
      { id: 1, name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "slow" },
      { id: 2, name: "Respuesta", primitive: "FLOW", sentenceTemplate: "{source} responde a {target}", visual: { kind: "token", value: "◆" }, motion: "slow" },
      { id: 3, name: "Cae", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN" }],
    pages: [{ name: "Petición", nextId: 100, behaviors: [], nextScenarioId: 2,
      nodes: [N(U, "Usuario"), N(A, "API"), N(S, "Servicio"), N(D, "DB")],
      edges: [E(5, U, A), E(6, A, S), E(7, S, D)],
      scenarios: [{ id: 1, engineVersion: 2, name: "Petición y respuesta", nextStepId: 5, steps: [
        { id: 1, at: 0, action: "SEND", edgeId: 7, eventTypeId: 1 },
        { id: 2, at: 2400, action: "SEND", edgeId: 7, eventTypeId: 2 },
        { id: 3, at: 4800, action: "SET_STATE", nodeId: D, state: "DOWN", eventTypeId: 3 },
        { id: 4, at: 5600, action: "SEND", edgeId: 7, eventTypeId: 2, reverse: true }] }] }] } });
const PROBE = () => {
  window.__tok = []; let cur = null;
  const dt = window.drawEventToken, ft = window.flowText;
  window.drawEventToken = function (c, pts, send, T) { cur = send; try { return dt.apply(this, arguments); } finally { cur = null; } };
  window.flowText = function (c, text, x, y, px, T, alpha) {
    if (cur && alpha === undefined) window.__tok.push({ stepId: cur.stepId, reverse: !!cur.reverse, x, y, a: c.globalAlpha, p: cur.progress });
    return ft.apply(this, arguments);
  };
};
/* El token del Step 2 (ya invertido) baja de DB a Servicio sobre la MISMA conexión; el 1 sube. */
function judge(raw, label) {
  const by = (id) => raw.filter((s) => s.stepId === id).sort((a, b) => a.p - b.p);
  const mono = (arr, dir) => arr.every((s, i) => i === 0 || dir * (s.x - arr[i - 1].x) >= -0.5);
  const s1 = by(1), s2 = by(2);
  check(s1.length > 8 && mono(s1, +1) && s1[0].x < X[S] + 110 && s1.at(-1).x > X[D] - 110 && !s1.some((s) => s.reverse), `${label} · petición Servicio → DB: ${s1.length} frames, x ${Math.round(s1[0]?.x)} → ${Math.round(s1.at(-1)?.x)} (sube)`);
  check(s2.length > 8 && mono(s2, -1) && s2[0].x > X[D] - 110 && s2.at(-1).x < X[S] + 110 && s2.every((s) => s.reverse), `${label} · Step 2 invertido: DB → Servicio, ${s2.length} frames, x ${Math.round(s2[0]?.x)} → ${Math.round(s2.at(-1)?.x)} (baja)`);
}
async function open(browser, base, vp, touch) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); }); page.on("dialog", (d) => d.accept());
  return { ctx, page, errors };
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
    /* En el móvil la hoja de Historias abre compacta: «Ampliar» (el control real) muestra los Steps. */
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
    const board = () => page.locator("#scStoryboard").innerText();
    const undoN = () => page.evaluate(() => undoStack.length);

    /* menú */
    let menu = await openMenu(2);
    const iC = menu.findIndex((t) => t.startsWith("Cambiar dónde ocurre…")), iR = menu.findIndex((t) => t.startsWith("Invertir sentido"));
    check(iC >= 0 && iR === iC + 1, "el menú tiene «Invertir sentido» justo después de «Cambiar dónde ocurre…»: " + menu.slice(Math.max(0, iC), iR + 1).join(" | "));
    check(menu[iC] === "Cambiar dónde ocurre…Ahora: Servicio → DB" && menu[iR] === "Invertir sentidoPasa a: DB → Servicio", `hints: «${menu[iC]}» / «${menu[iR]}»`);
    check(menu.filter((t) => t.startsWith("Invertir sentido")).length === 1, "una sola entrada");
    const box = await item("Invertir sentido").boundingBox();
    check(box && box.height >= (touch ? 40 : 28) && box.x >= 0 && box.x + box.width <= vp.width, `la entrada cabe en pantalla y se puede pulsar (${Math.round(box?.width)}×${Math.round(box?.height)} px)`);
    await shot(page, `rev3-menu-${vp.width}`);

    /* normal → reverse */
    const before = await docJson(page), u0 = await undoN();
    await page.evaluate(() => { scSelectedStep = 2; });
    await tap(item("Invertir sentido"));
    await page.waitForTimeout(150);
    const s2 = JSON.parse(await stepsJson(page)).find((s) => s.id === 2);
    check(JSON.stringify(s2) === JSON.stringify({ id: 2, at: 2400, action: "SEND", edgeId: 7, eventTypeId: 2, reverse: true }), "Step 2: misma conexión 7, reverse:true, nada más cambia → " + JSON.stringify(s2));
    check((await undoN()) === u0 + 1, "una sola entrada de Undo");
    check(await page.evaluate(() => scSelectedStep === 2), "la selección del Step se conserva");
    check(/DB responde a Servicio[\s\S]*Cae|DB responde a Servicio/.test(await board()) && !/Servicio responde a DB/.test(await board()), "el panel dice al momento «DB responde a Servicio»");
    await shot(page, `rev3-invertido-${vp.width}`);
    const after = await docJson(page);
    if (touch) await tap(page.locator("#btnUndo")); else await page.keyboard.press("Control+z");
    await page.waitForTimeout(150);
    check((await docJson(page)) === before, "Undo exacto (documento entero)");
    check(/Servicio responde a DB/.test(await board()), "tras Undo el panel vuelve a «Servicio responde a DB»");
    if (touch) await tap(page.locator("#btnRedo")); else await page.keyboard.press("Control+y");
    await page.waitForTimeout(150);
    check((await docJson(page)) === after, "Redo exacto (documento entero)");

    /* reverse → normal (Step 4) y otra vez */
    menu = await openMenu(4);
    check(menu.includes("Invertir sentidoPasa a: Servicio → DB"), "Step inverso: «Pasa a: Servicio → DB»");
    await tap(item("Invertir sentido")); await page.waitForTimeout(150);
    const s4 = JSON.parse(await stepsJson(page)).find((s) => s.id === 4);
    check(!("reverse" in s4) && s4.edgeId === 7, "reverse → normal quita la clave (sin `false`): " + JSON.stringify(s4));
    await openMenu(4); await tap(item("Invertir sentido")); await page.waitForTimeout(150);
    check((await docJson(page)) === after, "dos inversiones del Step 4 = el documento de antes");

    /* un evento de disponibilidad no tiene la acción */
    menu = await openMenu(3);
    check(!menu.some((t) => t.startsWith("Invertir sentido")), "«Cae DB» (disponibilidad) no tiene «Invertir sentido»");
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => scClosePopover && scClosePopover());

    /* playback después de invertir */
    await page.evaluate(PROBE);
    await tap(page.locator("#scRun"));
    let reason = null; const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const s = await page.evaluate(() => ({ st: scStatus, t: scPlayback ? scPlayback.cursorVirtual : 0 }));
      if (!reason && s.t > 5600 + 1900) reason = await page.evaluate(() => scRuntimeStateForStep(P().scenarios[0].steps.find((x) => x.id === 4)).detail);
      if (s.st === "completed") break;
      await page.waitForTimeout(120);
    }
    judge(await page.evaluate(() => window.__tok), "editor");
    check(reason === "DB no está disponible", `motivo del Step 4: «${reason}»`);
    await page.evaluate(() => { if (typeof scStopPlayback === "function") scStopPlayback(); else if (typeof scReset === "function") scReset(); });
    await page.waitForFunction(() => !isScenarioPlaybackActive(), null, { timeout: 5000 }).catch(() => {});
    if (touch && !(await page.evaluate(() => document.body.classList.contains("storyExpanded")))) { await tap(page.locator("#btnStoryExpand")); await page.waitForTimeout(300); }

    /* duplicar y «Cambiar dónde ocurre» después de invertir */
    const doc0 = await docJson(page);
    await openMenu(2); await tap(item("Duplicar")); await page.waitForTimeout(150);
    const dup = JSON.parse(await stepsJson(page)).filter((s) => s.at === 2400);
    check(dup.length === 2 && dup.every((s) => s.reverse === true && s.edgeId === 7), "Duplicar: la copia hereda reverse " + JSON.stringify(dup));
    if (touch) await tap(page.locator("#btnUndo")); else await page.keyboard.press("Control+z");
    await page.waitForTimeout(150);
    check(JSON.stringify(JSON.parse(await docJson(page)).pages[0].scenarios[0].steps) === JSON.stringify(JSON.parse(doc0).pages[0].scenarios[0].steps), "Undo quita la copia");
    menu = await openMenu(2);
    check(menu.includes("Cambiar dónde ocurre…Ahora: DB → Servicio"), "«Cambiar dónde ocurre…» dice «Ahora: DB → Servicio»");
    await tap(item("Cambiar dónde ocurre…")); await page.waitForTimeout(150);
    await page.evaluate(() => scUseTarget(6, false));   // el clic sobre la conexión API → Servicio (la selección del objetivo ya la cubre 002)
    await page.waitForTimeout(150);
    const moved = JSON.parse(await stepsJson(page)).find((s) => s.id === 2);
    check(moved.edgeId === 6 && moved.reverse === true, "«Cambiar dónde ocurre» conserva el sentido: " + JSON.stringify(moved));
    check(/Servicio responde a API/.test(await board()), "el panel dice «Servicio responde a API»");
    if (touch) await tap(page.locator("#btnUndo")); else await page.keyboard.press("Control+z");
    await page.waitForTimeout(150);
    check(JSON.stringify(JSON.parse(await stepsJson(page))) === JSON.stringify(JSON.parse(doc0).pages[0].scenarios[0].steps), "Undo devuelve el Step a la conexión 7, inverso");
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
    check(await page.evaluate(() => P().scenarios[0].steps.filter((s) => s.reverse === true).map((s) => s.id).join()) === "2,4", "Present abre el documento con los Steps 2 y 4 inversos");
    await page.click("#tabScenarios"); await page.waitForTimeout(300);
    await page.locator("#btnPresent").click(); await page.waitForFunction(() => presenting);
    await page.evaluate(PROBE);
    await page.locator("#psPlay").click();
    let cap = ""; const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const s = await page.evaluate(() => ({ ph: presentPhase(), c: document.getElementById("psCaption").textContent }));
      if (/No se completó/.test(s.c)) cap = s.c;
      if (s.ph === "finished") break;
      await page.waitForTimeout(100);
    }
    judge(await page.evaluate(() => window.__tok), "Present");
    check(cap === "No se completó · DB no está disponible", `mensaje: «${cap}»`);
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
    check(await page.evaluate(() => JSON.stringify(doc.pages[0].scenarios[0].steps)) === JSON.stringify(data.doc.pages[0].scenarios[0].steps), "el Viewer recibe los Steps tal cual (2 y 4 inversos)");
    await page.evaluate(PROBE);
    await page.locator("#stPlay").click();
    let cap = ""; const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const s = await page.evaluate(() => ({ st: window.__viewer.story, c: document.getElementById("stCaption").textContent }));
      if (/No se completó/.test(s.c)) cap = s.c;
      if (s.st === "completed") break;
      await page.waitForTimeout(100);
    }
    judge(await page.evaluate(() => window.__tok), "Viewer");
    check(cap === "No se completó · DB no está disponible", `mensaje: «${cap}»`);
    await shot(page, `rev3-viewer-${vp.width}-fin`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

(async () => {
  const t0 = Date.now();
  const now = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    const desk = await editor(browser, now.base, { width: 1440, height: 900 }, "escritorio", false);
    const mob = await editor(browser, now.base, { width: 390, height: 844 }, "móvil", true);
    check(JSON.stringify(desk.doc.pages[0].scenarios[0].steps) === JSON.stringify(mob.doc.pages[0].scenarios[0].steps), "escritorio y móvil acaban con los mismos Steps");
    await present(browser, now.base, desk);
    await viewer(browser, now.base, { width: 1440, height: 900 }, desk);
    await viewer(browser, now.base, { width: 390, height: 844 }, mob);
  } finally { await browser.close(); now.server.close(); }
  console.log(`\nFLUYO-STEP-REVERSE-003 navegador: ${passed}/${passed + failed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
