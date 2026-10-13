"use strict";
/* FLUYO-018.21 — Chrome REAL, pasada dirigida (≤ 3 min): dependencias de llegada.
   Historia: A→B (Request, 1100 ms) en 0 · «X cae» en 500 (independiente) · «B recibe» en 1000.
   Casos: crear la dependencia desde el menú de la aparición (ratón y dedo) + Undo/Redo · reproducir (fotograma a fotograma:
   «B recibe» nunca se ve con el token en vuelo; «X cae» SÍ se ve con el token en vuelo) · pausar/reanudar · saltar de
   momento (⏮/⏭ por instantes visibles) · Present · Viewer (/s/#d= con la dependencia).
   Uso: node test/fluyo-018-21-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=play|present|viewer|mobile   solo esa parte (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-21-"));
fs.mkdirSync(shots, { recursive: true });
const ONLY = process.env.ONLY || "";
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

const ET = [
  { id: 1, name: "Request", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { kind: "token", value: "📨" }, motion: "normal" },
  { id: 2, name: "Recibe", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe", visual: { kind: "token", value: "✅" }, motion: "normal", presentation: { nodeEffects: { showSymbol: true } } },
  { id: 3, name: "Cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "💥" }, motion: "normal" },
];
const FIX = (deps) => {
  const sc = { id: 1, engineVersion: 2, name: "Llegada", nextStepId: 4, steps: [
    { id: 1, at: 0, eventTypeId: 1, action: "SEND", edgeId: 10 }, { id: 2, at: 500, eventTypeId: 3, action: "SET_STATE", nodeId: 4, state: "DOWN" }, { id: 3, at: 1000, eventTypeId: 2, action: "OCCURRENCE", nodeId: 2 }] };
  if (deps) sc.arrivalDependencies = deps;
  return JSON.stringify({ version: 5, app: "fluyo", settings: {}, doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 4, eventTypes: ET,
    pages: [{ name: "Llegadas", nodes: [{ id: 1, shape: "rect", x: 300, y: 300, w: 160, h: 70, label: "A" }, { id: 2, shape: "rect", x: 900, y: 300, w: 160, h: 70, label: "B" }, { id: 4, shape: "rect", x: 600, y: 520, w: 160, h: 70, label: "X" }],
      edges: [{ id: 10, from: 1, to: 2, route: "straight", waypoints: [] }], nextId: 11, behaviors: [], nextScenarioId: 2, scenarios: [sc] }] } });
};
const DEP = [{ stepId: 3, waitsForArrivalOf: [1] }];

async function open(browser, base, vp, url = "/") {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.touch, serviceWorkers: "block" });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + url);
  return { ctx, page, errors };
}
async function editor(browser, base, vp, deps) {
  const t = await open(browser, base, vp);
  await t.page.waitForFunction(() => typeof scRun === "function" && typeof FluyoStoryClock === "object");
  if (await t.page.locator("#autosaveModal").isVisible().catch(() => false)) await t.page.locator("#autosaveDiscard").click();
  await t.page.evaluate((fx) => { scReset(); applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); undoStack.length = 0; redoStack.length = 0; setUiMode("story"); scSelectStory(P().scenarios[0].id); scRenderPanel(); }, FIX(deps));
  await t.page.waitForTimeout(300);
  return t;
}
const press = async (t, vp, loc, ms = 250) => { if (vp.touch) await loc.tap(); else await loc.click(); await t.page.waitForTimeout(ms); };
const DEPS = (t) => t.page.evaluate(() => JSON.stringify(scActiveScenario().arrivalDependencies || null));
/* registra el estado en CADA fotograma: instante, si «B recibe» ya se ve, si «X cae» ya se ve y el progreso del token A→B */
const RECORD = (src) => {
  window.__frames = [];
  const loop = () => {
    const pb = src === "viewer" ? (typeof story !== "undefined" && story && story.playback) : (typeof scPlayback !== "undefined" && scPlayback);
    if (pb) {
      const seen = (id) => pb.logEvents.some((e) => e.stepId === id), send = pb.activeSends.find((s) => s.stepId === 1);
      window.__frames.push({ vt: Math.round(pb.cursorVirtual), b: seen(3), x: seen(2), p: send ? Math.min(1, (pb.startedAtReal + pb.cursorVirtual - send.startedReal) / send.duration) : (seen(1) ? 1 : 0) });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};
function causal(frames, label) {
  const early = frames.filter((f) => f.b && f.p < 1);
  check(frames.length > 20 && !early.length, `${label}: en ${frames.length} fotogramas «B recibe» nunca se ve con el token en vuelo` + (early.length ? " (" + JSON.stringify(early.slice(0, 2)) + ")" : ""));
  const firstB = frames.find((f) => f.b);
  check(!!firstB && firstB.vt >= 1100 && firstB.vt < 1250, `${label}: «B recibe» aparece al llegar el token (${firstB && firstB.vt} ms; llegada 1100, at narrativo 1000)`);
  const xFlight = frames.find((f) => f.x && f.p < 1);
  check(!!xFlight && frames.find((f) => f.x).vt < 650, `${label}: «X cae» se ve a su hora (${frames.find((f) => f.x)?.vt} ms) con el token aún en vuelo (independiente: no hay barrera global)`);
}

async function play(browser, base) {
  const vp = { key: "d1440", width: 1440, height: 900 };
  console.log("\neditor 1440 (ratón): crear la dependencia · reproducir · pausar · saltar");
  const t = await editor(browser, base, vp);
  const page = t.page;
  /* crear: ⋯ de «B recibe» → «Esperar a que llegue…» → «📨 Request» */
  await press(t, vp, page.locator('[data-step-id="3"] .scMore'));
  await press(t, vp, page.locator(".scPopover button", { hasText: "Esperar a que llegue…" }));
  check(await page.locator(".scPopover .scMenuHead", { hasText: "Este momento no empieza hasta que llegue…" }).count() === 1, "el submenú dice «Este momento no empieza hasta que llegue…»");
  const opts = await page.locator(".scPopover button:not(.scMenuBack)").allInnerTexts();
  check(opts.length === 1 && /📨 Request/.test(opts[0]) && /A → B/.test(opts[0]), "solo ofrece el envío anterior válido (" + JSON.stringify(opts) + ")");
  await press(t, vp, page.locator(".scPopover button", { hasText: "📨 Request" }));
  check(await DEPS(t) === JSON.stringify(DEP), "la Historia guarda arrivalDependencies " + await DEPS(t));
  const note = await page.locator("#scStoryboard .scWaits").allInnerTexts();
  check(note.length === 1 && /No empieza hasta que llegue «📨 Request» \(A → B\)/.test(note[0]), "la línea de tiempo lo dice en el momento: " + JSON.stringify(note));
  await page.screenshot({ path: path.join(shots, "d1440-dependencia.png") });
  await page.keyboard.press("Control+z"); await page.waitForTimeout(200);
  check(await DEPS(t) === "null" && await page.locator("#scStoryboard .scWaits").count() === 0, "Ctrl+Z la deshace (y la nota desaparece)");
  await page.keyboard.press("Control+y"); await page.waitForTimeout(200);
  check(await DEPS(t) === JSON.stringify(DEP), "Ctrl+Y la rehace");
  /* reproducir, fotograma a fotograma */
  await page.evaluate(RECORD, "editor");
  await press(t, vp, page.locator("#scRun"), 50);
  await page.waitForFunction(() => scStatus === "completed", null, { timeout: 8000 });
  causal(await page.evaluate(() => window.__frames), "editor");
  /* pausar / reanudar / saltar */
  await press(t, vp, page.locator("#scRun"), 50);
  await page.waitForFunction(() => scPlayback && scPlayback.cursorVirtual > 650);
  await press(t, vp, page.locator("#scPause"), 50);
  const a = await page.evaluate(() => scPlayback.cursorVirtual); await page.waitForTimeout(700);
  const b = await page.evaluate(() => scPlayback.cursorVirtual);
  check(a === b && a < 1100, `en pausa no avanza (${Math.round(a)} = ${Math.round(b)} ms)`);
  const st = await page.evaluate(() => scActiveScenario().steps.map((s) => scRuntimeStateForStep(s).status));
  check(st[1] === "completed" && st[2] === "pending", "en pausa: «X cae» ya ocurrió, «B recibe» espera (" + st.join(",") + ")");
  await press(t, vp, page.locator("#scNext"), 50);
  check(await page.evaluate(() => scPlayback.cursorVirtual) === 1100, "⏭ lleva al momento que espera: su instante visible (1100), no 1000");
  check(/Recibe/.test(await page.locator("#scNowCaption").innerText()), "el rótulo cuenta «Recibe»");
  await press(t, vp, page.locator("#scPrev"), 50);
  check(await page.evaluate(() => scPlayback.cursorVirtual) === 500, "⏮ vuelve a «X cae» en su tiempo narrativo (500)");
  await press(t, vp, page.locator("#scPause"), 50);
  await page.waitForFunction(() => scPlayback && scPlayback.cursorVirtual > 650);
  check(await page.evaluate(() => scStatus === "running" && !scIsPaused()), "reanudar sigue");
  await page.evaluate(() => scReset());
  check(t.errors.length === 0, "sin errores de consola " + JSON.stringify(t.errors));
  await t.ctx.close();
}

async function present(browser, base) {
  const vp = { key: "d1280", width: 1280, height: 800 };
  console.log("\nPresent 1280");
  const t = await editor(browser, base, vp, DEP), page = t.page;
  await page.evaluate(() => enterPresent()); await page.waitForTimeout(500);
  await page.evaluate(RECORD, "editor");
  await press(t, vp, page.locator("#psPlay"), 50);
  await page.waitForFunction(() => presentPhase() === "finished", null, { timeout: 8000 });
  causal(await page.evaluate(() => window.__frames), "Present");
  await press(t, vp, page.locator("#psPlay"), 50);
  await page.waitForFunction(() => scPlayback && scPlayback.cursorVirtual > 650);
  await press(t, vp, page.locator("#psPause"), 50);
  await press(t, vp, page.locator("#psNext"), 100);
  check(await page.evaluate(() => scPlayback.cursorVirtual) === 1100, "Present ⏭: instante visible 1100");
  const title = await page.locator("#psTitle").innerText();
  check(/Recibe/.test(title), "Present: el título es el del momento visible («" + title + "»)");
  check(await page.locator("#psDots > *").count() === 3, "Present: tres puntos (tres momentos)");
  await page.evaluate(() => exitPresent());
  check(t.errors.length === 0, "sin errores de consola " + JSON.stringify(t.errors));
  await t.ctx.close();
}

async function viewer(browser, base) {
  const vp = { key: "v1280", width: 1280, height: 800 };
  console.log("\nViewer 1280 (/s/#d= con la dependencia)");
  const e = await editor(browser, base, vp, DEP);
  const url = await e.page.evaluate((b) => createShareUrl(serializeProject(), b + "/s/", { kind: "story", scenarioId: 1 }), base);
  await e.ctx.close();
  const t = await open(browser, base, vp, url.slice(base.length)), page = t.page;
  await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  check(await page.evaluate(() => JSON.stringify(P().scenarios[0].arrivalDependencies)) === JSON.stringify(DEP), "el enlace compartido lleva la dependencia");
  await page.evaluate(RECORD, "viewer");
  await press(t, vp, page.locator("#stPlay"), 50);
  await page.waitForFunction(() => story && story.status === "completed", null, { timeout: 8000 });
  causal(await page.evaluate(() => window.__frames), "Viewer");
  await press(t, vp, page.locator("#stPlay"), 50);
  await page.waitForFunction(() => story && story.playback.cursorVirtual > 650);
  await press(t, vp, page.locator("#stPause"), 50);
  const a = await page.evaluate(() => story.playback.cursorVirtual); await page.waitForTimeout(500);
  check(a === await page.evaluate(() => story.playback.cursorVirtual), "Viewer: en pausa no avanza");
  check(await page.locator("#stProgress").innerText() === "2 / 3", "Viewer: progreso 2 / 3 mientras el token viaja");
  await press(t, vp, page.locator("#stNext"), 100);
  check(await page.evaluate(() => story.playback.cursorVirtual) === 1100 && await page.locator("#stProgress").innerText() === "3 / 3", "Viewer ⏭: 1100 y 3 / 3");
  await page.screenshot({ path: path.join(shots, "viewer-llegada.png") });
  check(t.errors.length === 0, "sin errores de consola " + JSON.stringify(t.errors));
  await t.ctx.close();
}

async function mobile(browser, base) {
  const vp = { key: "m390", width: 390, height: 844, touch: true };
  console.log("\nmóvil 390 (dedo): crear la dependencia y reproducir");
  const t = await editor(browser, base, vp), page = t.page;
  /* la hoja de Historias, ampliada con su propio botón (el taller con la línea de tiempo) */
  if (await page.evaluate(() => document.body.dataset.story === "closed")) await press(t, vp, page.locator("#btnStories"), 500);
  if (!(await page.evaluate(() => document.body.classList.contains("storyExpanded")))) await press(t, vp, page.locator("#btnStoryExpand"), 400);
  const more = page.locator('[data-step-id="3"] .scMore');
  await more.scrollIntoViewIfNeeded();
  await press(t, vp, more);
  await press(t, vp, page.locator(".scPopover button", { hasText: "Esperar a que llegue…" }));
  await press(t, vp, page.locator(".scPopover button", { hasText: "📨 Request" }));
  check(await DEPS(t) === JSON.stringify(DEP), "con el dedo: dependencia creada");
  await page.screenshot({ path: path.join(shots, "m390-dependencia.png") });
  await page.evaluate(RECORD, "editor");
  await page.evaluate(() => scRun());
  await page.waitForFunction(() => scStatus === "completed", null, { timeout: 8000 });
  causal(await page.evaluate(() => window.__frames), "móvil");
  check(t.errors.length === 0, "sin errores de consola " + JSON.stringify(t.errors));
  await t.ctx.close();
}

(async () => {
  const started = Date.now();
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    if (!ONLY || ONLY === "play") await play(browser, base);
    if (!ONLY || ONLY === "present") await present(browser, base);
    if (!ONLY || ONLY === "viewer") await viewer(browser, base);
    if (!ONLY || ONLY === "mobile") await mobile(browser, base);
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.21 browser: ${passed} ✔ · ${failed} ✘ · ${Math.round((Date.now() - started) / 1000)} s · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})();
