"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 3 — La ruta observada en Chrome real, a 1440 y a 390 px. Se sirven el árbol de trabajo y la base
   16ee642 (producción v95, sin FASE 3), con el service worker bloqueado salvo en el smoke de actualización.
   · V1  ACEPTACIÓN: con la bandera labs y el fixture de dos workers, la herramienta está bajo el transporte y dice «Al inicio · Ruta
         disponible · incluye estados por defecto»; al reproducir: disponible → cae A, sigue disponible → cae B, «Ruta no disponible»
         en el instante del cambio; la pausa congela el texto; ⏮ / ⏭ lo recalculan; «Sin ruta de flujo» sin estructura.
   · V2  Selectores con el ratón (1440) o el dedo (390): escriben los dos extremos con UNA entrada de Undo; Ctrl+Z la deshace.
   · V3  Borrar un extremo quita la ruta en la misma entrada de Undo.
   · V4  390 px: la herramienta se ve entera en la hoja (también reproduciendo) y nada desborda.
   · V5  labs apagado: la herramienta no existe y la cabecera de Historias mide y se pinta igual que en 16ee642.
   · SW  De 16ee642 (v95) al árbol (v96): instalada y activada, la anterior borrada; flow-semantics.js sale de la caché.
   Sin errores de consola en ningún paso.
   Uso: node test/fluyo-scenarios-semantics-3-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=dir capturas) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "16ee642";
const shots = process.env.FLUYO_SHOTS || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const serve = async (dir) => {
  const state = { dir };
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(state.dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(state.dir) + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, state, base: "http://127.0.0.1:" + server.address().port };
};
function treeAt(rev) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss3-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* ───────── fixture de producto: dos workers ───────── */
const CLI = 1, API = 2, COLA = 3, WA = 4, WB = 5, BD = 6, AUTH = 7, MET = 8;
const N = (id, x, y, label) => ({ id, shape: "rect", x, y, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
const E = (id, from, to, kind) => Object.assign({ id, from, to, route: "ortho", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" }, kind ? { kind } : {});
function DOC(scExtra = {}, cut = false) {
  const edges = [E(11, CLI, API, "FLOWS_TO"), E(12, API, COLA, "FLOWS_TO"), E(13, COLA, WA, "FLOWS_TO"), E(14, COLA, WB, "FLOWS_TO"), E(15, WA, BD, "FLOWS_TO"),
    E(16, WB, BD, "FLOWS_TO"), E(17, API, AUTH, "REQUIRES"), E(18, API, MET)].filter((e) => !(cut && e.id === 12));
  return { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
    doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 3,
      eventTypes: [
        { id: 1, name: "Pedido", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
        { id: 2, name: "Cae", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN" }],
      pages: [{ name: "Workers", nextId: 100, behaviors: [], nextScenarioId: 2,
        nodes: [N(CLI, 120, 300, "Cliente"), N(API, 340, 300, "API"), N(COLA, 560, 300, "Cola"), N(WA, 800, 200, "Worker A"), N(WB, 800, 400, "Worker B"), N(BD, 1040, 300, "BD"),
          N(AUTH, 340, 470, "Auth"), N(MET, 340, 130, "Métricas")],
        edges,
        scenarios: [Object.assign({ id: 1, engineVersion: 2, name: "Pedido y caídas", nextStepId: 4, steps: [
          { id: 1, at: 0, action: "SEND", edgeId: 11, eventTypeId: 1 }, { id: 2, at: 1500, action: "SET_STATE", nodeId: WA, state: "DOWN", eventTypeId: 2 },
          { id: 3, at: 3000, action: "SET_STATE", nodeId: WB, state: "DOWN", eventTypeId: 2 }] }, scExtra)] }] } };
}

async function open(browser, base, vp, query, touch) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); }); page.on("dialog", (d) => d.accept());
  await page.goto(base + "/" + (query || "")); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  await page.evaluate(() => document.fonts.ready);
  const load = async (d) => { await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, d); };
  const story = async () => { await page.click(touch ? "#btnStories" : "#tabScenarios"); await page.waitForFunction(() => document.body.classList.contains("storyMode")); await page.waitForTimeout(450); /* la hoja entra con una transición de 0,2 s */ };
  const flow = () => page.evaluate(() => { const b = document.getElementById("scFlow"); if (!b) return null; const r = b.getBoundingClientRect();
    return { hidden: b.hidden || getComputedStyle(b).display === "none", text: document.getElementById("scFlowWord").textContent + document.getElementById("scFlowWhy").textContent, word: document.getElementById("scFlowWord").textContent,
      state: b.dataset.state, from: document.getElementById("scFlowFrom").value, to: document.getElementById("scFlowTo").value, disabled: document.getElementById("scFlowFrom").disabled,
      rect: { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }; });
  return { ctx, page, errors, load, story, flow };
}
const shot = async (T, name) => { if (shots) await T.page.screenshot({ path: path.join(shots, name + ".png") }); };

async function acceptance(browser, base, vp, label, touch) {
  console.log(`\n── V1–V4 · ${label} (${vp.width}×${vp.height}${touch ? ", dedo" : ""}) con ?labs=escenarios`);
  const T = await open(browser, base, vp, "?labs=escenarios", touch);
  try {
    await T.load(DOC()); await T.story();
    let f = await T.flow();
    check(!f.hidden && f.text === "Al inicio · Ruta disponible · incluye estados por defecto" && f.state === "AVAILABLE", `al inicio: «${f.text}»`);
    const inView = await T.page.evaluate(() => { const b = document.getElementById("scFlow").getBoundingClientRect(), a = document.querySelector("aside").getBoundingClientRect();
      const c = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height - 2, 12));
      return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth && b.top >= a.top - 0.5 && b.bottom <= a.bottom + 0.5 && !!c && document.getElementById("scFlow").contains(c)
        && document.documentElement.scrollWidth <= innerWidth; });
    check(inView, "la herramienta se ve entera dentro del panel/hoja y la página no desborda");
    const order = await T.page.evaluate(() => { const ids = [...document.querySelectorAll(".scHeader [id]")].map((e) => e.id); return ids.indexOf("scRun") < ids.indexOf("scFlow"); });
    check(order, "bajo el transporte");
    await shot(T, `ss3-${vp.width}-inicio`);
    /* reproducir: se muestrea el texto con el cursor de la reproducción */
    await T.page.click("#scRun");
    const samples = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const s = await T.page.evaluate(() => ({ t: scPlayback ? scPlayback.cursorVirtual : null, text: document.getElementById("scFlowWord").textContent, st: scStatus }));
      samples.push(s); if (s.st === "completed") break; await T.page.waitForTimeout(60);
    }
    const before = samples.filter((s) => s.t !== null && s.t < 2990), after = samples.filter((s) => s.t !== null && s.t >= 3080);
    check(before.length > 5 && before.every((s) => s.text === "Ruta disponible"), `antes de caer B (también tras caer A a 1,5 s): «Ruta disponible» en ${before.length} muestras`);
    check(after.length > 0 && after.every((s) => s.text === "Ruta no disponible"), `desde que cae B (3 s): «Ruta no disponible» en ${after.length} muestras`);
    const first = samples.find((s) => s.text === "Ruta no disponible");
    check(!!first && first.t >= 3000, `el cambio llega en el instante visible del estado (primer «no disponible» a ${first && Math.round(first.t)} ms)`);
    f = await T.flow();
    check(f.disabled, "reproduciendo, los selectores están deshabilitados");
    await shot(T, `ss3-${vp.width}-terminada`);
    if (touch) {
      const vis = await T.page.evaluate(() => { const b = document.getElementById("scFlow").getBoundingClientRect(); return document.body.dataset.story + "|" + (b.top >= 0 && b.bottom <= innerHeight && b.height > 20); });
      check(/\|true$/.test(vis), `hoja «${vis.split("|")[0]}»: la herramienta sigue entera a la vista al reproducir`);
    }
    /* ⏮: terminada → el último momento (cae B), otra vez → cae A */
    await T.page.click("#scPrev"); await T.page.waitForTimeout(120);
    const p1 = (await T.flow()).word;
    await T.page.click("#scPrev"); await T.page.waitForTimeout(120);
    const p2 = (await T.flow()).word;
    check(p1 === "Ruta no disponible" && p2 === "Ruta disponible", `⏮ recalcula: «${p1}» → «${p2}»`);
    /* en pausa (saltar desde terminada deja la pausa): el texto no cambia aunque pase el tiempo */
    await T.page.waitForTimeout(1800);
    const paused = await T.page.evaluate(() => scIsPaused());
    const pf = await T.flow();
    check(paused && pf.word === "Ruta disponible" && pf.text === "Ruta disponible · incluye estados por defecto", `en pausa el estado queda quieto (1,8 s después: «${pf.text}»; la ruta que queda, por Worker B, no está afirmada)`);
    await T.page.click("#scNext"); await T.page.waitForTimeout(120);
    check((await T.flow()).word === "Ruta no disponible", "⏭ al momento de «cae B» → «Ruta no disponible»");
    await T.page.click("#scPause"); /* reanudar */ await T.page.waitForTimeout(200);
    await T.page.click("#scReset"); await T.page.waitForTimeout(100);
    check((await T.flow()).text === "Al inicio · Ruta disponible · incluye estados por defecto", "Detener vuelve a «Al inicio»");
    /* V2: selectores (escriben los dos extremos, UNA entrada de Undo) */
    const u0 = await T.page.evaluate(() => undoStack.length);
    await T.page.selectOption("#scFlowFrom", String(API));
    const w = await T.page.evaluate(() => ({ of: P().scenarios[0].observedFlow, u: undoStack.length }));
    check(JSON.stringify(w.of) === JSON.stringify({ from: API, to: BD }) && w.u === u0 + 1, `origen API → observedFlow ${JSON.stringify(w.of)} con una entrada de Undo`);
    if (!touch) {
      await T.page.locator("#cv").click({ position: { x: 5, y: 5 } });   // foco en el lienzo: Ctrl+Z es del editor
      await T.page.keyboard.press("Control+z"); await T.page.waitForTimeout(80);
      check(await T.page.evaluate(() => !("observedFlow" in P().scenarios[0])), "Ctrl+Z la deshace");
    } else {
      await T.page.selectOption("#scFlowFrom", "auto");
      check(await T.page.evaluate(() => !("observedFlow" in P().scenarios[0])), "«Automática» la quita");
    }
    /* V3: borrar un extremo, misma entrada de Undo */
    await T.page.selectOption("#scFlowTo", String(WB));
    const u1 = await T.page.evaluate(() => undoStack.length);
    await T.page.evaluate((id) => { selN = new Set([id]); selE = new Set(); deleteSel(); }, WB);
    const d = await T.page.evaluate(() => ({ of: "observedFlow" in P().scenarios[0], u: undoStack.length }));
    await T.page.evaluate(() => undo());
    const r = await T.page.evaluate(() => P().scenarios[0].observedFlow);
    check(!d.of && d.u === u1 + 1 && r && r.to === WB, "borrar Worker B quita la ruta en la MISMA entrada de Undo; deshacer devuelve nodo y ruta");
    /* sin estructura */
    await T.load(DOC({ observedFlow: { from: CLI, to: BD } }, true)); await T.page.evaluate(() => scRefreshIfVisible());
    f = await T.flow();
    check(f.text === "Al inicio · Sin ruta de flujo" && f.state === "NO_PATH", `sin API → Cola: «${f.text}» (neutro: ${f.state})`);
    await T.page.click("#scRun"); await T.page.waitForTimeout(300);
    check((await T.flow()).word === "Sin ruta de flujo", "reproduciendo: «Sin ruta de flujo»");
    await T.page.click("#scReset");
    /* extremo perdido (documento externo) */
    await T.load(DOC({ observedFlow: { from: 77, to: BD } })); await T.page.evaluate(() => scRefreshIfVisible());
    f = await T.flow();
    check(f.text === "Un extremo de la ruta ya no existe" && f.from === "" && f.to === String(BD), `ENDPOINT_MISSING: «${f.text}», el origen perdido marcado`);
    await shot(T, `ss3-${vp.width}-extremo`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function labsOff(browser, now, old, vp, label, touch) {
  console.log(`\n── V5 · labs apagado frente a ${BASE} · ${label}`);
  const meas = async (base) => {
    const T = await open(browser, base, vp, "?labs=off", touch);
    try {
      await T.load(DOC()); await T.story();
      const m = await T.page.evaluate(() => { const h = document.querySelector("#panelScenarios .scHeader").getBoundingClientRect(), f = document.getElementById("scFlow");
        return { h: Math.round(h.height * 10) / 10, w: Math.round(h.width * 10) / 10, flow: f ? (f.hidden && getComputedStyle(f).display === "none") : "sin markup" }; });
      const png = await T.page.locator("#panelScenarios .scHeader").screenshot();
      return { m, png, errors: T.errors };
    } finally { await T.ctx.close(); }
  };
  const a = await meas(old.base), b = await meas(now.base);
  check(b.m.flow === true, "la herramienta no existe (oculta)");
  check(a.m.h === b.m.h && a.m.w === b.m.w, `cabecera de Historias: ${a.m.w}×${a.m.h} (${BASE}) = ${b.m.w}×${b.m.h} (árbol)`);
  check(Buffer.compare(a.png, b.png) === 0, "cabecera de Historias idéntica píxel a píxel");
  check(b.errors.length === 0, "sin errores de consola");
}

(async () => {
  const t0 = Date.now();
  const oldDir = treeAt(BASE);
  const now = await serve(root), old = await serve(oldDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    await acceptance(browser, now.base, { width: 1440, height: 900 }, "escritorio");
    await acceptance(browser, now.base, { width: 390, height: 844 }, "teléfono", true);
    await labsOff(browser, now, old, { width: 1440, height: 900 }, "1440");
    await labsOff(browser, now, old, { width: 390, height: 844 }, "390", true);
    if (!process.env.SKIP_SW) {
      const cacheOf = (dir) => /const CACHE = "([^"]+)";/.exec(fs.readFileSync(path.join(dir, "sw.js"), "utf8"))[1];
      const PREV = cacheOf(oldDir), CUR = cacheOf(root);
      console.log("\n── SW · de " + BASE + " (" + PREV + ") al árbol (" + CUR + ")");
      const sw = await serve(oldDir);
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      await ctx.route((u) => !u.href.startsWith(sw.base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
      try {
        const pg = await ctx.newPage();
        await pg.goto(sw.base + "/"); await pg.waitForFunction(() => typeof renderTabs === "function");
        const until = async (fn, arg, label) => { const t = Date.now(); while (Date.now() - t < 60000) { if (await pg.evaluate(fn, arg)) return; await pg.waitForTimeout(250); } throw new Error("tiempo agotado: " + label); };
        const installed = (name) => until(async (name) => { if (!(await caches.keys()).includes(name)) return false; const c = await caches.open(name); return !!(await c.match(location.origin + "/js/editor-scenarios.js")); }, name, name);
        const activated = () => until(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !r.installing && !r.waiting && !!r.active && r.active.state === "activated"; }, null, "activado");
        await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
        await installed(PREV); await activated();
        check(true, BASE + ": " + PREV + " instalada y activa");
        sw.state.dir = root;
        await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
        await installed(CUR); await activated();
        await until(async (p) => !(await caches.keys()).includes(p), PREV, "la anterior borrada");
        const keys = await pg.evaluate(async () => caches.keys());
        await pg.reload(); await pg.waitForFunction(() => typeof renderTabs === "function");
        const live = await pg.evaluate(async (cur) => ({ fn: typeof FluyoFlow, obs: typeof setObservedFlowIn, ctrl: !!navigator.serviceWorker.controller,
          cached: !!(await (await caches.open(cur)).match(location.origin + "/js/flow-semantics.js")) }), CUR);
        check(CUR !== PREV && keys.join() === CUR && live.fn === "object" && live.obs === "function" && live.ctrl && live.cached,
          `${CUR} instalada y activada, ${PREV} borrada (${keys.join()}); tras recargar, flow-semantics.js sale de la caché y el kernel nuevo está activo`);
      } finally { await ctx.close(); sw.server.close(); }
    }
  } finally {
    await browser.close(); now.server.close(); old.server.close();
    fs.rmSync(oldDir, { recursive: true, force: true });
  }
  console.log(`\n${passed} ✔ · ${failed} ✘ (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
