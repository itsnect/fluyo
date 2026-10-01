"use strict";
/* FLUYO-013 — QA adversarial en Chrome real (carreras, Stop/Exit, paridad con el
   editor, Present histórico, responsive, diagramas extremos, teclado, fullscreen, SW).
   Playwright por NODE_PATH (acepta playwright-core). Uso: node test/fluyo-013-qa-browser.cjs
   FLUYO_ONLY=<prefijo> filtra bloques; FLUYO_SHOTS=<dir> guarda capturas. */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-013-qa-"));
fs.mkdirSync(shots, { recursive: true });
const ONLY = process.env.FLUYO_ONLY || "";

/* ───────── fixtures (se evalúan en la página) ───────── */
const FX = {
  base() { P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = []; scActiveId = null; viewX = 0; viewY = 0; viewZoom = 1; },
  pago() {
    FX.base();
    const a = newNode("rect", 200, 240), b = newNode("rect", 600, 240); a.label = "Cliente"; b.label = "Comercio";
    const e = newEdge(a.id, b.id), sc = createScenario(P(), "Compra");
    const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
    createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
  },
  simultaneo() {
    FX.base();
    const a = newNode("rect", 150, 240), b = newNode("rect", 450, 240), c = newNode("rect", 750, 240);
    a.label = "A"; b.label = "B"; c.label = "C";
    const e1 = newEdge(a.id, b.id), e2 = newEdge(b.id, c.id), sc = createScenario(P(), "Dos a la vez");
    const t = createEventType({ name: "Envío", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { value: "📦" } });
    createStep(sc, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: t.id });
    createStep(sc, { at: 0, action: "SEND", edgeId: e2.id, eventTypeId: t.id });
  },
  espera() {
    FX.base();
    const a = newNode("rect", 150, 240), b = newNode("rect", 450, 240), c = newNode("rect", 750, 240);
    a.label = "Cliente"; b.label = "Comercio"; c.label = "Almacén";
    const e1 = newEdge(a.id, b.id), e2 = newEdge(b.id, c.id), sc = createScenario(P(), "Compra y despacho");
    const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
    const desp = createEventType({ name: "Despacho", primitive: "FLOW", sentenceTemplate: "{source} despacha a {target}", visual: { value: "🚚" }, motion: "slow" });
    createStep(sc, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
    createStep(sc, { at: 2000, action: "SEND", edgeId: e2.id, eventTypeId: desp.id });
  },
  fallo() {
    FX.base();
    const p = newNode("rect", 120, 240), k = newNode("rect", 420, 240), c = newNode("rect", 720, 240);
    p.label = "Producer"; k.label = "Kafka"; c.label = "Consumer";
    const e1 = newEdge(p.id, k.id), e2 = newEdge(k.id, c.id), sc = createScenario(P(), "Mensaje perdido");
    const caida = createEventType({ name: "Kafka cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { value: "⚠" } });
    const pub = createEventType({ name: "Publicación", primitive: "FLOW", sentenceTemplate: "{source} publica en {target}", visual: { value: "📨" } });
    createStep(sc, { at: 0, action: "SET_STATE", nodeId: k.id, state: "DOWN", eventTypeId: caida.id });
    createStep(sc, { at: 1000, action: "SEND", edgeId: e1.id, eventTypeId: pub.id });
    createStep(sc, { at: 3500, action: "SEND", edgeId: e2.id, eventTypeId: pub.id });
  },
  efectos() {
    FX.base();
    const a = newNode("rect", 200, 240), b = newNode("rect", 600, 240); a.label = "Cliente"; b.label = "Comercio";
    const e = newEdge(a.id, b.id), sc = createScenario(P(), "Con efectos");
    const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, motion: "fast" });
    const ok = createEventType({
      name: "Recibido", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe", visual: { value: "✓" },
      presentation: { nodeEffects: { showSymbol: true, message: "Pago recibido", messageColor: "#2e9d57", fillColor: "#3aa7e8", highlight: true, blink: true, visualDuration: "long" } },
    });
    const dim = createEventType({
      name: "Pausa", primitive: "OCCURRENCE", sentenceTemplate: "{target} espera", visual: { value: "⏳" },
      presentation: { nodeEffects: { showSymbol: true, message: "Esperando", dim: true, visualDuration: "custom", visualDurationMs: 2500 } },
    });
    createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
    createStep(sc, { at: 1500, action: "OCCURRENCE", nodeId: b.id, eventTypeId: ok.id });
    createStep(sc, { at: 1500, action: "OCCURRENCE", nodeId: a.id, eventTypeId: dim.id });
  },
  /* n nodos en rejilla/linea; cada arista con un SEND; overlays si msg */
  grid(cols, rows, gapX, gapY, withMsgs) {
    FX.base();
    const ids = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const n = newNode("rect", 100 + c * gapX, 100 + r * gapY); n.label = "N" + (r * cols + c + 1); ids.push(n); }
    const sc = createScenario(P(), "Grande");
    const t = createEventType({ name: "Paso", primitive: "FLOW", sentenceTemplate: "{source} → {target}", visual: { value: "🔹" } });
    const m = createEventType({
      name: "Aviso", primitive: "OCCURRENCE", sentenceTemplate: "{target} avisa", visual: { value: "!" },
      presentation: { nodeEffects: { showSymbol: true, message: "Mensaje largo de ejemplo", highlight: true, visualDuration: "long" } },
    });
    let at = 0;
    for (let i = 0; i + 1 < ids.length; i++) {
      if (cols > 1 && i % cols === cols - 1) continue;
      const e = newEdge(ids[i].id, ids[i + 1].id);
      createStep(sc, { at: (at += 400), action: "SEND", edgeId: e.id, eventTypeId: t.id });
    }
    if (withMsgs) for (const n of ids.slice(0, 8)) createStep(sc, { at: 1000, action: "OCCURRENCE", nodeId: n.id, eventTypeId: m.id });
  },
};
const FXSRC = Object.entries(FX).map(([k, f]) => `${k}:${f.toString().replace(/^\w+\s*\(/, "function(")}`).join(",\n");
const SNAP = () => JSON.stringify({ d: serializeProject(), undo: undoStack.length, redo: redoStack.length, cur: doc.cur });
const COUNT = `window.__q={tick:0,refresh:0};
 (function(){const t=scTick; scTick=function(n){window.__q.tick++; return t.apply(this,arguments);};
  const r=presentStoryRefresh; presentStoryRefresh=function(){window.__q.refresh++; return r.apply(this,arguments);};})();`;

const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
function serve() {
  const server = http.createServer((req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, "http://x").pathname).slice(1); if (!rel || rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(root, rel); assert.ok(file.startsWith(root + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const server = await serve(), base = "http://127.0.0.1:" + server.address().port;
  const errors = [], results = [];
  const mk = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", ...opts });
    await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
    const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/index.html"); await page.waitForFunction(() => typeof newNode === "function");
    await page.evaluate(`window.FX={${FXSRC}}; window.SNAP=${SNAP.toString()};`);
    return { ctx, page };
  };
  const block = async (name, fn) => {
    if (ONLY && !name.startsWith(ONLY)) return;
    try { await fn(); results.push(["PASS", name]); console.log("PASS", name); }
    catch (e) { results.push(["FAIL", name, e.message.split("\n").slice(0, 6).join(" | ")]); console.log("FAIL", name, "\n  ", e.message.split("\n").slice(0, 8).join("\n   ")); }
  };
  const phase = (p) => p.evaluate(() => presentPhase());
  const waitPhase = (p, ph, timeout = 40000) => p.waitForFunction((x) => presentPhase() === x, ph, { timeout });
  const residue = (p) => p.evaluate(() => ({ status: scStatus, raf: scRafId, pb: scPlayback === null, rs: buildEditorRenderState().scenarioRuntime === undefined, tab: document.getElementById("tabProperties").disabled, present: presenting, body: document.body.classList.contains("presenting") }));
  const assertClean = async (p, why, inPresent = false) => {
    const r = await residue(p);
    assert.deepEqual(r, { status: "idle", raf: null, pb: true, rs: true, tab: false, present: inPresent, body: inPresent }, why + " " + JSON.stringify(r));
  };
  const quiet = async (p, ms = 1500) => { const t0 = await p.evaluate(() => window.__q.tick); await p.waitForTimeout(ms); assert.equal(await p.evaluate(() => window.__q.tick), t0, "scTick no debe seguir ejecutándose"); };
  const enter = async (p) => { await p.locator("#btnPresent").click(); await p.waitForFunction(() => presenting); await p.waitForTimeout(120); };
  const run = async (p, fx, ...a) => p.evaluate(({ fx, a }) => window.FX[fx](...a), { fx, a });

  /* ═════ 3. Integridad + 6. paridad Editor vs Present (misma historia) ═════ */
  await block("03/06 paridad editor vs Present + integridad", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT);
    for (const fx of ["pago", "simultaneo", "espera", "fallo", "efectos"]) {
      await run(p, fx);
      const before = await p.evaluate(() => SNAP());
      /* editor */
      await p.evaluate(() => scRun());
      await p.waitForFunction(() => scStatus === "completed", null, { timeout: 40000 });
      const ed = await p.evaluate(() => ({ trace: JSON.stringify(scPlayback.trace), log: JSON.stringify(scPlayback.logEvents), meta: JSON.stringify(scPlayback.stepMeta), vt: scPlayback.cursorVirtual, st: JSON.stringify(scPlayback.nodeStates) }));
      await p.evaluate(() => scReset());
      assert.equal(await p.evaluate(() => SNAP()), before, fx + ": el editor no muta");
      /* Present */
      await enter(p);
      const t0 = Date.now(); await p.locator("#psPlay").click(); await waitPhase(p, "finished");
      const pr = await p.evaluate(() => ({ trace: JSON.stringify(scPlayback.trace), log: JSON.stringify(scPlayback.logEvents), meta: JSON.stringify(scPlayback.stepMeta), vt: scPlayback.cursorVirtual, st: JSON.stringify(scPlayback.nodeStates) }));
      assert.equal(pr.trace, ed.trace, fx + ": Trace idéntico"); assert.equal(pr.log, ed.log, fx + ": log idéntico");
      assert.equal(pr.meta, ed.meta, fx + ": stepMeta idéntico"); assert.equal(pr.st, ed.st, fx + ": estados finales idénticos");
      assert.ok(Date.now() - t0 < 20000);
      /* Play / Stop / Repeat / Play / Exit */
      await p.locator("#psPlay").click(); await waitPhase(p, "playing"); await p.waitForTimeout(350);
      await p.locator("#psStop").click(); await assertClean(p, fx + " tras Stop", true);
      await p.locator("#psPlay").click(); await waitPhase(p, "playing");
      await p.waitForTimeout(300); await p.locator("#prExit").click();
      await assertClean(p, fx + " tras Exit");
      assert.equal(await p.evaluate(() => SNAP()), before, fx + ": documento/undo/contadores idénticos");
      const steps = await p.evaluate(() => JSON.stringify(P().scenarios));
      assert.equal(steps, JSON.parse(before).d && JSON.stringify(JSON.parse(before).d.doc.pages[0].scenarios));
    }
    await quiet(p, 1200); await ctx.close();
  });

  /* ═════ 4. Entrada ═════ */
  await block("04 entrada: sin Scenario / vacío / varios / engineVersion", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT);
    await run(p, "base"); await p.evaluate(() => { newNode("rect", 300, 200).label = "Solo"; });
    let b = await p.evaluate(() => SNAP()); await enter(p);
    assert.equal(await phase(p), "none"); assert.equal(await p.locator("#presentStory").isVisible(), false); assert.equal(await p.locator("#psPlay").isVisible(), false);
    assert.equal(await p.evaluate(() => P().scenarios.length), 0); await p.keyboard.press("Escape"); assert.equal(await p.evaluate(() => SNAP()), b);
    /* Scenario vacío (0 pasos) = sin Historia, y no se toca */
    await p.evaluate(() => { createScenario(P(), "Vacío"); }); b = await p.evaluate(() => SNAP()); await enter(p);
    assert.equal(await phase(p), "none"); assert.equal(await p.locator("#psPlay").isVisible(), false); await p.keyboard.press("Escape");
    assert.equal(await p.evaluate(() => SNAP()), b); assert.equal(await p.evaluate(() => P().scenarios.length), 1);
    /* varios Scenarios: usa el activo de la UX */
    await run(p, "pago");
    await p.evaluate(() => {
      const s2 = createScenario(P(), "Segundo"); const t = doc.eventTypes[0];
      createStep(s2, { at: 0, action: "SEND", edgeId: P().edges[0].id, eventTypeId: t.id });
      createStep(s2, { at: 800, action: "SEND", edgeId: P().edges[0].id, eventTypeId: t.id });
      scActiveId = s2.id;
    });
    b = await p.evaluate(() => SNAP()); await enter(p);
    assert.match(await p.locator("#psTitle").innerText(), /Segundo/); assert.equal(await p.locator("#psDots .psDot").count(), 2);
    await p.locator("#psPlay").click(); await waitPhase(p, "finished");
    assert.equal(await p.evaluate(() => scPlayback.trace.events.filter((e) => e.type === "send_started").length), 2);
    await p.locator("#prExit").click(); assert.equal(await p.evaluate(() => SNAP()), b); await assertClean(p, "varios");
    /* engineVersion incompatible: no se ejecuta ni deja estado parcial */
    await run(p, "pago"); await p.evaluate(() => { P().scenarios[0].engineVersion = 99; });
    b = await p.evaluate(() => SNAP()); await enter(p);
    const visible = await p.locator("#psPlay").isVisible();
    if (visible) { await p.locator("#psPlay").click(); await p.waitForTimeout(300); }
    await assertClean(p, "engine 99", true);
    const cap = await p.locator("#psCaption").innerText(); console.log("   engine 99 → Reproducir visible:", visible, "| mensaje:", JSON.stringify(cap));
    assert.doesNotMatch(cap, /unsupported|engine_version|undefined/);
    await p.locator("#prExit").click(); assert.equal(await p.evaluate(() => SNAP()), b);
    await ctx.close();
  });

  /* ═════ 5. Present histórico ═════ */
  await block("05 Present histórico (diapositivas) + Scenario Present", async () => {
    const { ctx, page: p } = await mk({ hasTouch: true }); await p.evaluate(COUNT);
    await run(p, "base");
    await p.evaluate(() => { newNode("rect", 200, 200).label = "P1"; doc.pages.push(blankPage("Dos")); doc.pages.push(blankPage("Tres")); doc.cur = 1; newNode("rect", 300, 300).label = "P2"; doc.cur = 0; });
    const vb = await p.evaluate(() => ({ x: viewX, y: viewY, z: viewZoom }));
    const b = await p.evaluate(() => SNAP());
    await p.keyboard.press("p"); await p.waitForFunction(() => presenting);
    assert.equal(await p.locator("#prPos").innerText(), "1 / 3");
    await p.keyboard.press("ArrowRight"); assert.equal(await p.evaluate(() => doc.cur), 1); assert.equal(await p.locator("#prPos").innerText(), "2 / 3");
    await p.keyboard.press("ArrowLeft"); assert.equal(await p.evaluate(() => doc.cur), 0);
    await p.keyboard.press("End"); assert.equal(await p.evaluate(() => doc.cur), 2); await p.keyboard.press("Home"); assert.equal(await p.evaluate(() => doc.cur), 0);
    await p.locator("#prNext").click(); assert.equal(await p.evaluate(() => doc.cur), 1);
    await p.locator("#prPrev").click(); assert.equal(await p.evaluate(() => doc.cur), 0);
    /* toque en el lienzo avanza de diapositiva (táctil) */
    await p.touchscreen.tap(683, 384); await p.waitForTimeout(150); assert.equal(await p.evaluate(() => doc.cur), 1, "tap avanza");
    await p.keyboard.press("Space"); assert.equal(await p.evaluate(() => doc.cur), 2, "Space avanza (sin Historia)");
    await p.keyboard.press("Escape"); await p.waitForFunction(() => !presenting);
    await assertClean(p, "hist");
    assert.deepEqual(await p.evaluate(() => ({ x: viewX, y: viewY, z: viewZoom })), vb, "vista restaurada");
    await p.evaluate(() => { doc.cur = 0; }); assert.equal(await p.evaluate(() => SNAP()), b.replace(/"cur":\d/, '"cur":0'));
    /* Historia en página 1, sin Historia en la 2: cambiar de página detiene */
    await run(p, "pago"); await p.evaluate(() => { doc.pages.push(blankPage("Otra")); doc.cur = 0; });
    await enter(p); await p.locator("#psPlay").click(); await waitPhase(p, "playing"); await p.waitForTimeout(300);
    await p.keyboard.press("ArrowRight"); assert.equal(await p.evaluate(() => doc.cur), 1);
    await assertClean(p, "cambio de página", true); assert.equal(await phase(p), "none");
    assert.equal(await p.locator("#presentStory").isVisible(), false);
    await p.keyboard.press("ArrowLeft"); assert.equal(await phase(p), "ready"); await p.keyboard.press("Space"); await waitPhase(p, "playing");
    await p.keyboard.press("p"); assert.equal(await phase(p), "playing", "P no reinicia");
    await p.keyboard.press("Escape"); assert.equal(await phase(p), "ready"); await p.keyboard.press("Escape"); await p.waitForFunction(() => !presenting);
    await assertClean(p, "fin");
    await quiet(p); await ctx.close();
  });

  /* ═════ 7/8/9/10/19 Stop, Repeat, Exit, carreras ═════ */
  await block("07 Stop a mitad: limpieza y arranque desde cero", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT); await run(p, "efectos"); await enter(p);
    await p.locator("#psPlay").click(); await p.waitForFunction(() => scPlayback.activeSends.length > 0); await p.waitForTimeout(250);
    assert.ok(await p.evaluate(() => scPlayback.activeSends.length) > 0);
    await p.locator("#psStop").click(); await assertClean(p, "Stop", true); await quiet(p, 1200);
    assert.equal(await p.locator("#psStop").isVisible(), false); assert.equal(await p.locator("#psPlay").innerText(), "▶ Reproducir");
    assert.equal(await p.locator("#psCaption").innerText(), ""); assert.equal(await p.locator("#psDots .psDot.done").count(), 0);
    assert.equal(await p.evaluate(() => document.getElementById("panelScenarios").classList.contains("scPlaying")), false, "Historia no marcada como activa");
    await p.locator("#psPlay").click(); await p.waitForTimeout(150);
    assert.ok(await p.evaluate(() => scPlayback.cursorVirtual) < 600, "empieza desde cero");
    await waitPhase(p, "finished"); await ctx.close();
  });
  await block("08 Repeat (fin / Stop / Exit→Present) sin acumulación ni aceleración", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT); await run(p, "efectos"); await enter(p);
    const durations = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now(); await p.locator("#psPlay").click(); await waitPhase(p, "playing");
      const maxes = await p.evaluate(() => new Promise((res) => { let ms = 0, mf = 0, me = 0; const id = setInterval(() => { if (!scPlayback) return; ms = Math.max(ms, scPlayback.activeSends.length); mf = Math.max(mf, scPlayback.activeNodeEffects.length); me = Math.max(me, scPlayback.logEvents.length); if (scStatus === "completed") { clearInterval(id); res({ ms, mf, me, steps: P().scenarios[0].steps.length }); } }, 16); }));
      durations.push(Date.now() - t0);
      assert.ok(maxes.ms <= 1 && maxes.mf <= maxes.steps && maxes.me <= maxes.steps * 3, "sin duplicados " + JSON.stringify(maxes));
      assert.equal(await p.locator("#psDots .psDot").count(), 2);
    }
    assert.ok(Math.max(...durations) - Math.min(...durations) < 700, "tiempos estables " + durations);
    /* Play → Stop → Repeat(Play) */
    await p.locator("#psPlay").click(); await p.waitForTimeout(400); await p.locator("#psStop").click(); await p.locator("#psPlay").click(); await waitPhase(p, "finished");
    /* Play → Stop → Exit → Present → Play */
    await p.locator("#psPlay").click(); await p.waitForTimeout(300); await p.locator("#psStop").click(); await p.locator("#prExit").click(); await assertClean(p, "exit");
    await enter(p); const t1 = Date.now(); await p.locator("#psPlay").click(); await waitPhase(p, "finished"); const d = Date.now() - t1;
    assert.ok(Math.abs(d - durations[0]) < 800, "misma duración tras reentrar " + d + " vs " + durations[0]);
    await p.locator("#prExit").click(); await quiet(p); await ctx.close();
  });
  await block("09 Salir durante la reproducción: inicio / mitad / final", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT);
    for (const fx of ["espera", "efectos", "fallo"]) {
      await run(p, fx); const b = await p.evaluate(() => SNAP());
      for (const when of ["start", "mid", "end"]) {
        await enter(p); await p.locator("#psPlay").click();
        if (when === "start") await p.waitForFunction(() => scPlayback && scPlayback.nextEventIndex >= 1);
        if (when === "mid") await p.waitForFunction(() => scPlayback && scPlayback.activeSends.length + scPlayback.activeNodeEffects.length > 0, null, { timeout: 15000 }), await p.waitForTimeout(200);
        if (when === "end") await p.waitForFunction(() => scPlayback && scPlayback.nextEventIndex >= scPlayback.trace.events.length, null, { timeout: 30000 });
        await p.keyboard.press("Escape"); await p.keyboard.press("Escape").catch(() => {});
        await p.waitForFunction(() => !presenting); await assertClean(p, `${fx}/${when}`);
        await quiet(p, 1300); assert.equal(await p.evaluate(() => SNAP()), b, `${fx}/${when}: intacto`);
        assert.equal(await p.evaluate(() => document.getElementById("presentStory").hidden), true);
      }
    }
    await ctx.close();
  });
  await block("10/19 carreras: Stop→Play, Exit→Play, Repeat×2, resize, página, P, reentrada", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT); await run(p, "espera");
    await p.evaluate(() => { doc.pages.push(blankPage("Otra")); }); await enter(p);
    /* Play→Stop→Play síncronos: una sola ejecución */
    await p.evaluate(() => { presentPlay(); presentStop(); presentPlay(); });
    await p.waitForTimeout(200);
    const one = await p.evaluate(() => { const q = window.__q.tick; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r({ ticks: window.__q.tick - q, pb: scPlayback.logEvents.length })))); });
    assert.ok(one.ticks <= 2, "un solo bucle scTick por fotograma " + JSON.stringify(one));
    await waitPhase(p, "finished"); const ev = await p.evaluate(() => scPlayback.logEvents.filter((e) => e.type === "send_started").length); assert.equal(ev, 2);
    /* Repeat×2 inmediato: un solo bucle scTick (≤ 1 por fotograma) */
    await p.evaluate(() => { presentPlay(); presentPlay(); });
    const loops = await p.evaluate(() => new Promise((r) => { const q0 = window.__q.tick; let f = 0; const step = () => { if (++f >= 12) return r({ ticks: window.__q.tick - q0, frames: f }); requestAnimationFrame(step); }; requestAnimationFrame(step); }));
    assert.ok(loops.ticks <= loops.frames + 1, "bucle scTick duplicado " + JSON.stringify(loops));
    await waitPhase(p, "finished");
    assert.equal(await p.evaluate(() => scPlayback.logEvents.filter((e) => e.type === "send_started").length), 2);
    /* Play→Exit→Play (Play fuera de Present es no-op) */
    await p.evaluate(() => { presentPlay(); }); await p.waitForTimeout(200);
    await p.evaluate(() => { exitPresent(); presentPlay(); presentStop(); }); await assertClean(p, "exit→play"); await quiet(p, 800);
    /* Play→resize */
    await enter(p); await p.locator("#psPlay").click(); await p.waitForTimeout(250);
    await p.setViewportSize({ width: 900, height: 600 }); await p.waitForTimeout(250); await p.setViewportSize({ width: 1366, height: 768 }); await p.waitForTimeout(250);
    assert.equal(await phase(p), "playing"); await waitPhase(p, "finished");
    assert.equal(await p.evaluate(() => scPlayback.logEvents.filter((e) => e.type === "send_started").length), 2, "resize no duplica");
    /* Play→cambio de página→volver→Play */
    await p.locator("#psPlay").click(); await p.waitForTimeout(300); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowLeft"); await assertClean(p, "página", true);
    await p.keyboard.press("Space"); await waitPhase(p, "finished");
    /* cerrar/abrir Present N veces con carreras */
    for (let i = 0; i < 6; i++) {
      await p.evaluate(() => { presentPlay(); }); await p.waitForTimeout(80 + i * 90);
      await p.evaluate(() => { exitPresent(); });
      await p.locator("#btnPresent").click(); await p.waitForFunction(() => presenting);
      if (i % 2) await p.evaluate(() => { presentStop(); presentPlay(); });
    }
    await p.locator("#psPlay").isVisible() && await p.evaluate(() => presentStop()); await p.locator("#prExit").click(); await assertClean(p, "ciclos"); await quiet(p, 1500);
    /* enter→exit en el mismo fotograma: el encaje diferido no debe tocar la vista del editor */
    const v0 = await p.evaluate(() => { viewX = 33; viewY = 44; viewZoom = 1.3; return [viewX, viewY, viewZoom]; });
    await p.evaluate(() => { enterPresent(); exitPresent(); }); await p.waitForTimeout(300);
    assert.deepEqual(await p.evaluate(() => [viewX, viewY, viewZoom]), v0, "enter→exit inmediato conserva la vista del editor");
    await p.evaluate(() => { enterPresent(); window.dispatchEvent(new Event("resize")); exitPresent(); }); await p.waitForTimeout(300);
    assert.deepEqual(await p.evaluate(() => [viewX, viewY, viewZoom]), v0, "resize+exit conserva la vista");
    await ctx.close();
  });

  /* ═════ 11/12 mensajes humanos + progreso ═════ */
  await block("11/12 lenguaje humano y progreso", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT);
    await run(p, "fallo"); await enter(p);
    const texts = []; const seen = new Set();
    await p.locator("#psPlay").click();
    const prog = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 25000 && (await phase(p)) === "playing") {
      const s = await p.evaluate(() => ({ t: document.getElementById("presentStory").innerText, now: document.querySelectorAll("#psDots .psDot.now").length, done: document.querySelectorAll("#psDots .psDot.done").length, vt: scPlayback ? scPlayback.cursorVirtual : 0 }));
      texts.push(s.t); prog.push(s); await p.waitForTimeout(100);
    }
    const all = texts.join("\n") + "\n" + (await p.locator("#presentStory").innerText()) + "\n" + (await p.locator("#presentBar").innerText());
    assert.doesNotMatch(all, /SEND|SET_STATE|SEND_FAILED|source_down|target_down|\bUP\b|\bDOWN\b|send_|state_changed|Trace|undefined|NaN|error|Error|falló|fallo/i, "sin lenguaje técnico:\n" + all);
    assert.match(all, /Kafka no está disponible/); assert.match(all, /No se completó/);
    assert.equal(await p.locator("#psSummary").innerText(), "2 eventos no pudieron realizarse");
    /* progreso monótono, now ≤ 1, done ≤ momentos */
    let last = -1; for (const s of prog) { assert.ok(s.done >= last, "progreso monótono"); last = s.done; assert.ok(s.now <= 1); }
    assert.equal(await p.locator("#psDots .psDot").count(), 3); assert.equal(await p.locator("#psDots .psDot.done").count(), 3);
    /* simultaneidad: 2 pasos en el mismo `at` = 1 momento */
    await p.locator("#prExit").click(); await run(p, "simultaneo"); await enter(p);
    assert.equal(await p.locator("#psDots").isVisible(), false, "un único momento: sin puntos"); await p.locator("#psPlay").click(); await waitPhase(p, "finished");
    await p.locator("#prExit").click();
    await run(p, "efectos"); await enter(p); assert.equal(await p.locator("#psDots .psDot").count(), 2, "efectos: 2 momentos (3 pasos)");
    await p.locator("#psPlay").click(); await p.waitForTimeout(400); await p.locator("#psStop").click();
    assert.equal(await p.locator("#psDots .psDot.done").count(), 0, "Stop limpia progreso");
    await p.locator("#psPlay").click(); await p.waitForTimeout(200); assert.ok((await p.locator("#psDots .psDot.done").count()) <= 1, "Repeat reinicia");
    await p.locator("#psStop").click(); await ctx.close();
  });

  /* ═════ 13/14/15 viewports × diagramas ═════ */
  await block("13/14/15 viewports × diagramas extremos", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT);
    const cases = [["pequeño", "base1"], ["mediano", "grid", 4, 2, 260, 180, false], ["grande", "grid", 6, 4, 220, 160, false], ["ancho", "grid", 12, 1, 420, 100, false], ["alto", "grid", 1, 12, 100, 260, false], ["overlays", "grid", 4, 2, 260, 180, true], ["pago", "pago"]];
    const bad = [];
    for (const [name, fx, ...a] of cases) {
      if (fx === "base1") { await run(p, "base"); await p.evaluate(() => { const n = newNode("rect", 300, 200); n.label = "Único"; const s = createScenario(P(), "Solo uno"); const t = createEventType({ name: "Late", primitive: "OCCURRENCE", sentenceTemplate: "{target} late", visual: { value: "💓" }, presentation: { nodeEffects: { showSymbol: true, message: "Hola", highlight: true } } }); createStep(s, { at: 0, action: "OCCURRENCE", nodeId: n.id, eventTypeId: t.id }); }); }
      else await run(p, fx, ...a);
      for (const [w, h] of [[1366, 768], [1920, 1080], [768, 1024], [390, 844]]) {
        await p.setViewportSize({ width: w, height: h }); await enter(p); await p.waitForTimeout(150);
        const m = await p.evaluate(() => {
          const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
          const b = getBounds(), wr = document.getElementById("wrap").getBoundingClientRect();
          return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight, bar: r("presentBar"), st: r("presentStory"), z: viewZoom,
            d: [b.x * viewZoom + viewX, b.y * viewZoom + viewY, (b.x + b.w) * viewZoom + viewX, (b.y + b.h) * viewZoom + viewY], ww: wr.width, wh: wr.height, bw: b.w, bh: b.h };
        });
        const tag = `${name}@${w}x${h}`;
        const probs = [];
        if (m.sw > m.cw) probs.push("scroll-x"); if (m.sh > m.ch) probs.push("scroll-y");
        if (m.bar[0] < 0 || m.bar[2] > w || m.bar[3] > h) probs.push("barra fuera");
        if (m.st[0] < 0 || m.st[2] > w || m.st[1] < 0) probs.push("encabezado fuera");
        if (m.d[0] < -1 || m.d[2] > m.ww + 1) probs.push("diagrama cortado en X"); if (m.d[1] < m.st[3] - 2 || m.d[3] > m.bar[1] + 2) probs.push("diagrama bajo barra/encabezado");
        const fill = Math.max((m.d[2] - m.d[0]) / m.ww, (m.d[3] - m.d[1]) / m.wh);
        if (fill < 0.35 && m.z < 2.49) probs.push("diagrama pequeño " + fill.toFixed(2));
        if (probs.length) bad.push(tag + ": " + probs.join(", ") + " " + JSON.stringify({ z: +m.z.toFixed(2), d: m.d.map(Math.round), bar: m.bar.map(Math.round), st: m.st.map(Math.round) }));
        await p.locator("#psPlay").click(); await p.waitForTimeout(900);
        if (["overlays", "grande", "pequeño"].includes(name) || (w === 390 && name === "pago")) await p.screenshot({ path: path.join(shots, `x-${name}-${w}x${h}.png`) });
        /* controles accesibles durante playing y finished */
        for (const id of ["psStop", "prExit"]) { const bx = await p.locator("#" + id).boundingBox(); if (!bx || bx.x < 0 || bx.x + bx.width > w || bx.y + bx.height > h) bad.push(tag + " " + id + " fuera"); }
        await p.locator("#psStop").click(); await p.locator("#prExit").click();
      }
    }
    await p.setViewportSize({ width: 1366, height: 768 });
    console.log("   hallazgos de layout:\n    " + (bad.join("\n    ") || "ninguno"));
    fs.writeFileSync(path.join(shots, "layout-findings.txt"), bad.join("\n"));
    assert.deepEqual(bad.filter((x) => /scroll|fuera|cortado en X|bajo barra/.test(x)), []);
    await ctx.close();
  });
  await block("15 móvil: barra en estado terminado con caption largo", async () => {
    const { ctx, page: p } = await mk({ viewport: { width: 390, height: 844 } }); await run(p, "fallo"); await enter(p);
    await p.locator("#psPlay").click(); await waitPhase(p, "finished");
    const m = await p.evaluate(() => { const b = document.getElementById("presentBar").getBoundingClientRect(), s = document.getElementById("presentStory").getBoundingClientRect(); return { bar: [b.left, b.top, b.right, b.bottom], st: [s.left, s.top, s.right, s.bottom], sw: document.documentElement.scrollWidth }; });
    await p.screenshot({ path: path.join(shots, "m-finished-390.png") });
    assert.ok(m.bar[0] >= 0 && m.bar[2] <= 390 && m.bar[3] <= 844 && m.st[0] >= 0 && m.st[2] <= 390 && m.sw <= 390, JSON.stringify(m));
    for (const id of ["psPlay", "psEdit", "prExit"]) { const bx = await p.locator("#" + id).boundingBox(); assert.ok(bx.height >= 32 && bx.x >= 0 && bx.x + bx.width <= 390, id + JSON.stringify(bx)); }
    await ctx.close();
  });

  /* ═════ 16/17 teclado y fullscreen ═════ */
  await block("16 teclado: Space/Enter/Esc/P en idle, playing, finished, stopped", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT); await run(p, "espera");
    await p.keyboard.press("p"); await p.waitForFunction(() => presenting); assert.equal(await phase(p), "ready");
    await p.keyboard.press("Space"); assert.equal(await phase(p), "playing");
    const id1 = await p.evaluate(() => { window.__pb = scPlayback; return scPlayback.startedAtReal; });
    await p.keyboard.press("Space"); await p.keyboard.press("Enter"); await p.keyboard.press("Space");
    assert.equal(await p.evaluate(() => scPlayback === window.__pb && scPlayback.startedAtReal), id1, "Space/Enter durante playing no reinician");
    await p.keyboard.press("p"); assert.equal(await p.evaluate(() => scPlayback === window.__pb), true);
    await waitPhase(p, "finished"); await p.keyboard.press("Enter"); assert.equal(await phase(p), "playing", "Enter repite");
    await p.keyboard.press("Escape"); assert.equal(await phase(p), "ready", "Esc detiene"); assert.equal(await p.evaluate(() => presenting), true);
    await p.keyboard.press("Enter"); assert.equal(await phase(p), "playing"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
    assert.equal(await p.evaluate(() => presenting), false); await assertClean(p, "teclado");
    /* tecla P fuera de Present entra; repetida dentro no hace nada */
    await p.keyboard.press("p"); await p.keyboard.press("p"); assert.equal(await p.evaluate(() => presenting), true); await p.keyboard.press("Escape");
    /* foco en botón Salir + Enter: sale (no reproduce) */
    await p.keyboard.press("p"); await p.focus("#prExit"); await p.keyboard.press("Enter"); assert.equal(await p.evaluate(() => presenting), false);
    /* foco en Reproducir + Space: reproduce una sola vez */
    await p.keyboard.press("p"); await p.focus("#psPlay"); await p.keyboard.press("Space"); await p.waitForTimeout(150); assert.equal(await phase(p), "playing");
    assert.equal(await p.evaluate(() => scPlayback.logEvents.length < 3), true); await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
    await quiet(p); await ctx.close();
  });
  await block("17 fullscreen", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT); await run(p, "pago");
    await p.keyboard.press("p"); await p.waitForFunction(() => presenting);
    await p.waitForTimeout(400); const fs1 = await p.evaluate(() => !!document.fullscreenElement); console.log("   fullscreen entra (headless):", fs1);
    await p.keyboard.press("Space"); await waitPhase(p, "playing"); await p.keyboard.press("Escape"); assert.equal(await phase(p), "ready", "Esc de la página detiene aunque haya fullscreen simulado");
    await p.keyboard.press("Space"); await waitPhase(p, "playing"); await p.waitForTimeout(250);
    if (fs1) { await p.evaluate(() => document.exitFullscreen()); await p.waitForFunction(() => !presenting, null, { timeout: 4000 }); await assertClean(p, "salida por fullscreen"); }
    else console.log("   (fullscreen no disponible en este Chrome headless; ruta fullscreenchange cubierta por test estático)");
    await quiet(p); await ctx.close();
  });

  /* ═════ 18 compatibilidad histórica ═════ */
  await block("18 documento histórico: Present no migra ni modifica", async () => {
    const { ctx, page: p } = await mk(); await p.evaluate(COUNT); await run(p, "efectos");
    await p.evaluate(() => { for (const et of doc.eventTypes) { delete et.motion; if (et.presentation) { delete et.presentation.nodeEffects.visualDuration; et.presentation.nodeEffects.showIcon = true; delete et.presentation.nodeEffects.showSymbol; } } });
    const b = await p.evaluate(() => JSON.stringify([serializeProject(), undoStack.length]));
    await enter(p); await p.locator("#psPlay").click(); await waitPhase(p, "finished"); await p.locator("#psPlay").click(); await p.waitForTimeout(300); await p.locator("#psStop").click(); await p.locator("#prExit").click();
    assert.equal(await p.evaluate(() => JSON.stringify([serializeProject(), undoStack.length])), b, "documento histórico intacto (sin migración silenciosa)");
    await ctx.close();
  });

  /* ═════ 20 Service Worker ═════ */
  await block("20 Service Worker: caché v-actual, assets, offline, upgrade", async () => {
    const cur = /const CACHE = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8"))[1];
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "allow" }); const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(e.message));
    await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
    await p.goto(base + "/index.html"); await p.evaluate(() => caches.open("fluyo-static-v55").then((c) => c.put("/old", new Response("x"))));
    await p.evaluate(() => navigator.serviceWorker.register("sw.js")); await p.evaluate(() => navigator.serviceWorker.ready);
    await p.waitForFunction(async () => (await caches.keys()).length > 0 && !(await caches.keys()).includes("fluyo-static-v55"), null, { timeout: 15000 }).catch(() => { });
    const keys = await p.evaluate(() => caches.keys()); console.log("   cachés:", keys);
    assert.ok(keys.includes(cur), "caché actual"); assert.ok(!keys.includes("fluyo-static-v55"), "v55 eliminada");
    const cached = await p.evaluate(async (c) => (await (await caches.open(c)).keys()).map((r) => new URL(r.url).pathname), cur);
    assert.ok(cached.includes("/js/present-story.js") && cached.includes("/js/viewer.js"), "assets en caché");
    await p.reload(); await p.waitForFunction(() => typeof newNode === "function" && navigator.serviceWorker.controller);
    await ctx.setOffline(true); await p.reload(); await p.waitForFunction(() => typeof presentStoryRefresh === "function");
    await p.evaluate(`window.FX={${FXSRC}}`); await p.evaluate(() => FX.fallo()); await p.locator("#btnPresent").click(); await p.locator("#psPlay").click();
    await p.waitForFunction(() => presentPhase() === "finished", null, { timeout: 30000 }); await p.locator("#prExit").click();
    const v = await ctx.newPage(); await v.goto(base + "/s/"); await v.waitForTimeout(500); assert.ok((await v.content()).length > 500, "viewer carga offline");
    await ctx.setOffline(false); await ctx.close();
  });

  console.log("\n══ RESUMEN ══"); for (const r of results) console.log(r[0], r[1], r[2] || "");
  const pe = errors.filter((e) => !/Failed to fetch|net::/.test(e)); if (pe.length) console.log("pageerrors:", pe);
  await browser.close(); server.close();
  process.exit(results.some((r) => r[0] === "FAIL") || pe.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
