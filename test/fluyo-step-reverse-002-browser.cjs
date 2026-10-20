"use strict";
/* FLUYO-STEP-REVERSE-002 — El sentido del Step en Chrome real (árbol de trabajo, service worker bloqueado).
   Historia «Petición y respuesta» sobre UNA conexión por tramo: Servicio → DB (petición), DB → Servicio y Servicio → API
   (respuestas con reverse), DB cae y la respuesta DB → Servicio no se completa (source_down en DB).
   · E  Editor a 1440 (plano y con la piel «construido») y a 390 (dedo): el token pintado (flowText) avanza en el sentido del
        Step en cada frame; el panel dice «DB responde a Servicio», «DB → Servicio» y el motivo «DB no está disponible».
        Con la piel el diagrama va en espejo (DB a la izquierda: la conexión entra en DB por el este, donde la silueta sobresale):
        el retorno sale del punto ATERRIZADO (edgePaintedPoints, decisión 213), no del ancla lógica.
   · P  Present: el mismo recorrido del token y el mensaje «No se completó · DB no está disponible».
   · V  Viewer /s/ (enlace #d= creado con createShareUrl): el documento llega con reverse; el mismo token y el mismo mensaje.
   Sin errores de consola. El token se mide envolviendo drawEventToken/flowText DESDE LA PÁGINA (el código servido no cambia).
   Uso: node test/fluyo-step-reverse-002-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=dir capturas) */
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
const MIRROR = 1060;   // con la piel: x → 1060 − x (DB a la izquierda)
let mirrored = false;
const N = (id, label) => ({ id, shape: "rect", x: mirrored ? MIRROR - X[id] : X[id], y: 300, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" });
function DOC(skin) {
  mirrored = !!skin;
  return { version: 5, app: "fluyo", settings: Object.assign({ speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false }, skin ? { skin } : {}),
    doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 4,
      eventTypes: [
        { id: 1, name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "slow" },
        { id: 2, name: "Respuesta", primitive: "FLOW", sentenceTemplate: "{source} responde a {target}", visual: { kind: "token", value: "◆" }, motion: "slow" },
        { id: 3, name: "Cae", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN" }],
      pages: [{ name: "Petición", nextId: 100, behaviors: [], nextScenarioId: 2,
        nodes: [N(U, "Usuario"), N(A, "API"), N(S, "Servicio"), N(D, "DB")],
        edges: [E(5, U, A), E(6, A, S), E(7, S, D)],
        scenarios: [{ id: 1, engineVersion: 2, name: "Petición y respuesta", nextStepId: 6, steps: [
          { id: 1, at: 0, action: "SEND", edgeId: 7, eventTypeId: 1 },
          { id: 2, at: 2400, action: "SEND", edgeId: 7, eventTypeId: 2, reverse: true },
          { id: 3, at: 4800, action: "SEND", edgeId: 6, eventTypeId: 2, reverse: true },
          { id: 4, at: 7200, action: "SET_STATE", nodeId: D, state: "DOWN", eventTypeId: 3 },
          { id: 5, at: 8000, action: "SEND", edgeId: 7, eventTypeId: 2, reverse: true }] }] }] } };
}
/* Envuelve los pintores globales (scripts clásicos): cada frame deja {stepId, x, y, a} del token PINTADO, en coordenadas de mundo. */
const PROBE = () => {
  window.__tok = []; let cur = null;
  const dt = window.drawEventToken, ft = window.flowText;
  window.drawEventToken = function (c, pts, send, T) { cur = send; try { return dt.apply(this, arguments); } finally { cur = null; } };
  window.flowText = function (c, text, x, y, px, T, alpha) {
    if (cur && alpha === undefined) window.__tok.push({ stepId: cur.stepId, reverse: !!cur.reverse, x, y, a: c.globalAlpha, p: cur.progress });
    return ft.apply(this, arguments);
  };
};
/* Por Step: los frames en orden; el token debe ir del origen al destino DEL RECORRIDO, sin retroceder. */
function judge(raw, label, landed) {
  const samples = landed ? raw.map((s) => Object.assign({}, s, { x: MIRROR - s.x })) : raw;   // en espejo se mide en el marco normal
  const by = (id) => samples.filter((s) => s.stepId === id).sort((a, b) => a.p - b.p);
  const mono = (arr, dir) => arr.every((s, i) => i === 0 || dir * (s.x - arr[i - 1].x) >= -0.5);
  const s1 = by(1), s2 = by(2), s3 = by(3), s5 = by(5);
  check(s1.length > 8 && mono(s1, +1) && s1[0].x < X[S] + 110 && s1.at(-1).x > X[D] - 110 && !s1.some((s) => s.reverse), `${label} · petición Servicio → DB: ${s1.length} frames, x ${Math.round(s1[0]?.x)} → ${Math.round(s1.at(-1)?.x)} (sube)`);
  check(s2.length > 8 && mono(s2, -1) && s2[0].x > X[D] - (landed ? 130 : 110) && s2.at(-1).x < X[S] + 110 && s2.every((s) => s.reverse), `${label} · respuesta DB → Servicio sobre la MISMA conexión: ${s2.length} frames, x ${Math.round(s2[0]?.x)} → ${Math.round(s2.at(-1)?.x)} (baja)`);
  check(s3.length > 8 && mono(s3, -1) && s3[0].x > X[S] - 110 && s3.at(-1).x < X[A] + 110 && s3.every((s) => s.x <= X[S] && s.x >= X[A]), `${label} · respuesta Servicio → API: x ${Math.round(s3[0]?.x)} → ${Math.round(s3.at(-1)?.x)}`);
  check(s5.length > 3 && mono(s5, -1) && s5[0].x > X[D] - (landed ? 130 : 110) && s5.every((s) => s.a <= 0.26), `${label} · respuesta con DB caída: sale de DB, apagada (alpha ≤ 0,25) en ${s5.length} frames`);
}
async function open(browser, base, vp, touch) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); }); page.on("dialog", (d) => d.accept());
  return { ctx, page, errors };
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name + ".png") }); };

async function editor(browser, base, vp, label, { touch, skin } = {}) {
  console.log(`\n── E · editor ${label} (${vp.width}×${vp.height}${touch ? ", dedo" : ""}${skin ? ", piel «construido»" : ""})`);
  const T = await open(browser, base, vp, touch);
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, DOC(skin));
    await page.evaluate(() => { viewZoom = 0.9; viewX = 20; viewY = 40; });
    await page.click(touch ? "#btnStories" : "#tabScenarios"); await page.waitForFunction(() => document.body.classList.contains("storyMode")); await page.waitForTimeout(450);
    const board = await page.locator("#scStoryboard").innerText();
    check(/Servicio pide a DB/.test(board) && /DB responde a Servicio/.test(board) && /Servicio responde a API/.test(board), "panel: «Servicio pide a DB», «DB responde a Servicio», «Servicio responde a API»");
    check(await page.evaluate(() => P().scenarios[0].steps.filter((s) => s.reverse === true).map((s) => s.id).join()) === "2,3,5", "el documento cargado conserva reverse en los Steps 2, 3 y 5");
    await page.evaluate(PROBE);
    await page.click("#scRun");
    let midShot = false, reason = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const s = await page.evaluate(() => ({ st: scStatus, t: scPlayback ? scPlayback.cursorVirtual : 0 }));
      if (!midShot && s.t > 2400 + 700) { await shot(page, `rev2-editor-${vp.width}${skin ? "-piel" : ""}-respuesta`); midShot = true; }
      if (!reason && s.t > 8000 + 1900) reason = await page.evaluate(() => { const st = P().scenarios[0].steps.find((x) => x.id === 5); return scRuntimeStateForStep(st).detail; });
      if (s.st === "completed") break;
      await page.waitForTimeout(120);
    }
    const tok = await page.evaluate(() => window.__tok);
    judge(tok, "editor", !!skin);
    if (skin) {
      const ends = await page.evaluate(() => { const e = edgeById(7), l = edgePoints(e), p = edgePaintedPoints(e, editorSkinOn()); return { on: editorSkinOn(), logical: l[l.length - 1], painted: p[p.length - 1] }; });
      const first = tok.filter((s) => s.stepId === 2).sort((a, b) => a.p - b.p)[0];
      const gap = Math.hypot(ends.painted.x - ends.logical.x, ends.painted.y - ends.logical.y), off = Math.hypot(first.x - ends.painted.x, first.y - ends.painted.y);
      check(ends.on && gap > 3 && off < 2, `piel: el retorno sale del punto aterrizado en DB (a ${off.toFixed(1)} u), no del ancla lógica (a ${gap.toFixed(1)} u de él)`);
    }
    check(reason === "DB no está disponible", `motivo del paso 5 en el panel: «${reason}»`);
    const log = await page.evaluate(() => { const c = document.getElementById("scTraceLog"); return c ? c.innerText : ""; });
    if (log) check(/DB → Servicio[\s\S]*Origen no disponible/.test(log), "registro: «DB → Servicio · Origen no disponible»");
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function present(browser, base) {
  console.log("\n── P · Present (1440×900)");
  const T = await open(browser, base, { width: 1440, height: 900 });
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
    await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, DOC());
    await page.click("#tabScenarios"); await page.waitForTimeout(300);
    await page.locator("#btnPresent").click(); await page.waitForFunction(() => presenting);
    await page.evaluate(PROBE);
    await page.locator("#psPlay").click();
    let cap = "", capAt = 0; const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      const s = await page.evaluate(() => ({ ph: presentPhase(), c: document.getElementById("psCaption").textContent, t: scPlayback ? scPlayback.cursorVirtual : 0 }));
      if (/No se completó/.test(s.c)) { cap = s.c; capAt = s.t; }
      if (s.ph === "finished") break;
      await page.waitForTimeout(100);
    }
    judge(await page.evaluate(() => window.__tok), "Present");
    check(cap === "No se completó · DB no está disponible", `mensaje: «${cap}» (a ${Math.round(capAt)} ms)`);
    await shot(page, "rev2-present-fin");
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function viewer(browser, base, vp) {
  console.log(`\n── V · Viewer /s/ (${vp.width}×${vp.height})`);
  const T = await open(browser, base, vp);
  try {
    const { page } = T;
    await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof createShareUrl === "function");
    await page.evaluate((d) => { applyProjectData(d); }, DOC());
    const url = await page.evaluate(() => createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: 1 }));
    check(/\/s\/#d=[A-Za-z0-9_-]+$/.test(url), "enlace #d= creado");
    await page.goto(url); await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
    check(await page.evaluate(() => doc.pages[0].scenarios[0].steps.filter((s) => s.reverse === true).length) === 3, "el Viewer recibe los tres Steps con reverse");
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
    await shot(page, `rev2-viewer-${vp.width}-fin`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

(async () => {
  const t0 = Date.now();
  const now = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    await editor(browser, now.base, { width: 1440, height: 900 }, "escritorio");
    await editor(browser, now.base, { width: 1440, height: 900 }, "escritorio", { skin: "built" });
    await editor(browser, now.base, { width: 390, height: 844 }, "móvil", { touch: true });
    await present(browser, now.base);
    await viewer(browser, now.base, { width: 1440, height: 900 });
    await viewer(browser, now.base, { width: 390, height: 844 });
  } finally { await browser.close(); now.server.close(); }
  console.log(`\nFLUYO-STEP-REVERSE-002 navegador: ${passed}/${passed + failed} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
