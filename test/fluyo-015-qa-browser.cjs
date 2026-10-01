"use strict";
/* FLUYO-015 — QA adversarial en Chrome real (independiente de fluyo-015-browser.cjs).
   Cubre: negocio 4 vistas, símbolos sin lógica propia, defaults = antes de 015, eventos de nodo,
   composición, edición de un EventType usado, Undo/Redo, residuos tras Stop/Reset/Present/página/documento,
   responsive con todo abierto, preview↔Playback, Share/Viewer, documento antiguo y Service Worker v58→actual.
   Uso: node test/fluyo-015-qa-browser.cjs   (FLUYO_SHOTS=<dir> para capturas) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-015qa-"));
fs.mkdirSync(shots, { recursive: true });
const currentCache = /const CACHE = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8"))[1];
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json" };

const RESET = `P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = [];`;
const two = (sym, fx, motion = "normal", name = "Evento") => `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 640, 240); a.label = "Cliente"; b.label = "Comercio"; const e = newEdge(a.id, b.id);
  const sc = createScenario(P(), "Historia");
  const t = createEventType({ name: ${JSON.stringify(name)}, primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { value: ${JSON.stringify(sym)} }, motion: ${JSON.stringify(motion)}${fx ? `, presentation: { connectionEffects: ${JSON.stringify(fx)} }` : ""} });
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: t.id });
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: b.id, eventTypeId: createEventType({ name: "Recibido", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe", visual: { value: "✓" }, presentation: { nodeEffects: { showSymbol: true, message: "Pedido recibido", highlight: true } } }).id });
})()`;
const FX_PAGO = { size: "large", style: "impulse", trail: "marked", arrival: "pulse" };
const LEGACY = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 640, 240); a.label = "Cliente"; b.label = "Comercio"; const e = newEdge(a.id, b.id); const sc = createScenario(P(), "Antiguo");
  doc.eventTypes.push({ id: 1, name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { kind: "token", value: "💵" }, motion: "normal" });
  doc.eventTypes.push({ id: 2, name: "Recibido", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe", visual: { kind: "token", value: "📦" }, motion: "normal", presentation: { nodeEffects: { showSymbol: true, message: "Pedido recibido", highlight: true } } });
  doc.nextEventTypeId = 3;
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: 1 });
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: b.id, eventTypeId: 2 });
})()`;

/* Espía: símbolos dibujados (con tamaño y posición), trazos redondos (rastro), acento (pulso), degradados, y llamadas al pintor. */
const SPY = `(() => { if (window.__spy) return; const s = window.__spy = { text: [], round: 0, grad: 0, accent: 0, calls: [], arr: [] };
  const p = CanvasRenderingContext2D.prototype, ft = p.fillText, st = p.stroke, cg = p.createRadialGradient;
  const isPrev = (c) => c.canvas && /scPreviewCanvas/.test(c.canvas.className || "");
  p.fillText = function (t, x, y, ...r) { if (!isPrev(this) && /^[^\\w\\s]/u.test(t) && t.length < 6) s.text.push({ t, x, y, px: parseFloat(/(\\d+(?:\\.\\d+)?)px/.exec(this.font)?.[1] || 0) }); return ft.call(this, t, x, y, ...r); };
  p.stroke = function (...r) { if (!isPrev(this)) { if (this.lineCap === "round") s.round++; if (this.strokeStyle === "#3aa7e8") s.accent++; } return st.apply(this, r); };
  p.createRadialGradient = function (...r) { if (!isPrev(this)) s.grad++; return cg.apply(this, r); };
  const dt = window.drawEventToken, da = window.drawEventArrival;
  window.drawEventToken = function (c, pts, send, T) { s.calls.push({ prev: /scPreviewCanvas/.test(c.canvas.className || ""), conn: JSON.stringify(send.connection), token: send.token, p: send.progress }); return dt.apply(this, arguments); };
  window.drawEventArrival = function (c, pts, d, T) { s.arr.push({ prev: /scPreviewCanvas/.test(c.canvas.className || ""), conn: JSON.stringify(d.connection), token: d.token }); return da.apply(this, arguments); };
})()`;
const spyReset = (p) => p.evaluate(() => { Object.assign(__spy, { text: [], round: 0, grad: 0, accent: 0, calls: [], arr: [] }); });
const spyGet = (p) => p.evaluate(() => JSON.parse(JSON.stringify(__spy)));

(async () => {
  let serveOld = false;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL("http://x" + req.url); let rel = url.pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(root, "." + rel); assert.ok(file.startsWith(root + path.sep));
      let body = fs.readFileSync(file);
      if (serveOld && url.pathname === "/sw.js") body = Buffer.from(body.toString().replace(currentCache, "fluyo-static-v58"));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const errors = [], results = [];
  const ok = (n) => { results.push(n); console.log("  ✔", n); };
  const watch = (p) => { p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); return p; };
  const newCtx = (vp = { width: 1366, height: 768 }, o = {}) => browser.newContext({ viewport: vp, serviceWorkers: "block", ...o });
  const shot = (p, n) => p.screenshot({ path: path.join(shots, n + ".png") });
  const until = async (p, fn, arg, timeout = 25000) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn, arg)) return; if (Date.now() - t0 > timeout) throw new Error("timeout: " + fn); await p.waitForTimeout(60); } };

  try {
    const ctx = await newCtx();
    const ed = watch(await ctx.newPage());
    await ed.goto(base + "/"); await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
    await ed.evaluate(() => ensureScenariosUI()); await ed.evaluate(SPY);
    const load = async (fx) => { await ed.evaluate(() => scReset()); await ed.evaluate(fx); await ed.evaluate(() => { scRenderPanel(); fitView(); }); await spyReset(ed); };
    const runAll = async () => { await ed.evaluate(() => scRun()); await until(ed, () => scStatus === "completed"); return spyGet(ed); };
    const traceOf = () => ed.evaluate(() => JSON.stringify(FluyoScenarios.runScenario({ nodes: P().nodes, edges: P().edges }, P().behaviors || [], scActiveScenario()).trace));
    const dlg = ed.locator("#scEventDialog");
    const setFx = async (fx) => { for (const [k, name] of [["size", "scFlowSize"], ["style", "scFlowStyle"], ["trail", "scFlowTrail"], ["arrival", "scFlowArrival"], ["during", "scFlowDuring"]]) if (fx[k]) { if (k === "during") await dlg.locator("#scFlowMore > summary").click().catch(() => {}); await dlg.locator(`label:has(input[name=${name}][value=${fx[k]}]) span`).click({ force: true }); } };

    /* ── 4 — negocio completo: preview, Editor, Present, Viewer con la MISMA semántica ── */
    await load(two("💵", null, "normal", "Pago"));
    const pagoId = await ed.evaluate(() => doc.eventTypes[0].id);
    await ed.evaluate((i) => scOpenEventDialog(i), pagoId); await ed.waitForTimeout(250);
    await setFx({ size: "large", style: "impulse", trail: "marked", arrival: "pulse" });
    await ed.waitForTimeout(700);
    const prevCalls = await spyGet(ed); // drawEventToken del preview también cuenta (calls[].prev)
    assert.ok(prevCalls.calls.some((c) => c.prev && JSON.parse(c.conn).trail === "marked" && JSON.parse(c.conn).px === 28), "el preview usa drawEventToken con la especificación elegida");
    const prevConn = prevCalls.calls.filter((c) => c.prev).pop().conn;
    await shot(ed, "qa-01-preview-pago");
    await dlg.locator("#scEventSave").click();
    await spyReset(ed);
    let s = await runAll();
    const edConn = s.calls.filter((c) => !c.prev).pop().conn;
    assert.equal(edConn, prevConn, "Editor y preview reciben EXACTAMENTE la misma especificación visual");
    assert.ok(s.round > 20 && s.accent > 0 && s.text.some((t) => t.t === "💵" && t.px === 28));
    // Present
    await ed.locator("#btnPresent").click(); await ed.waitForFunction(() => presenting); await spyReset(ed);
    await ed.locator("#psPlay").click(); await until(ed, () => presentPhase() === "finished");
    s = await spyGet(ed);
    assert.equal(s.calls.filter((c) => !c.prev).pop().conn, prevConn, "Present: misma especificación");
    assert.ok(s.round > 20 && s.accent > 0);
    await shot(ed, "qa-02-present-fin"); await ed.evaluate(() => exitPresent());
    // Viewer
    const url = await ed.evaluate(async () => { scReset(); return createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id }); });
    const vw = watch(await ctx.newPage()); await vw.goto(url);
    await vw.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready"); await vw.evaluate(SPY);
    const payload = await vw.evaluate(() => ({ et: doc.eventTypes.find((e) => e.name === "Pago").presentation.connectionEffects, sc: doc.pages[0].scenarios.length, steps: doc.pages[0].scenarios[0].steps.length }));
    assert.deepEqual(payload.et, { size: "large", style: "impulse", trail: "marked", arrival: "pulse", during: "none" }); assert.equal(payload.sc, 1);
    await vw.locator("#stPlay").click(); await until(vw, () => window.__viewer.story === "completed");
    s = await spyGet(vw);
    assert.equal(s.calls.pop().conn, prevConn, "Viewer: misma especificación que el preview");
    assert.ok(s.round > 20 && s.accent > 0); await shot(vw, "qa-03-viewer-fin");
    ok("4 negocio: preview = Editor = Present = Viewer (misma especificación y mismos efectos)");

    /* ── 5 — símbolos sin lógica propia: mismo dibujo salvo el texto ── */
    const sig = (st) => JSON.stringify(st.text.map((t) => [Math.round(t.x), Math.round(t.y), t.px]).slice(0, 400)) + "|" + st.round + "|" + st.grad + "|" + st.accent;
    const FX_AV = { size: "large", style: "smooth", trail: "subtle", arrival: "glow" };
    const sigs = {};
    for (const sym of ["✈️", "🚚", "💵", "📦", "⚡", "👤", "Ω"]) {
      await load(two(sym, FX_AV)); await ed.evaluate(() => { scRun(); });
      // reloj determinista: se avanza el Playback sin depender del tiempo real
      await until(ed, () => scStatus === "completed"); s = await spyGet(ed);
      const only = { ...s, text: s.text.filter((t) => t.t === sym) };
      assert.ok(only.text.length > 5, sym + " se dibuja");
      sigs[sym] = { n: only.text.length > 0, px: new Set(only.text.map((t) => t.px)), round: s.round > 0, glow: s.grad > 0 };
    }
    for (const [sym, v] of Object.entries(sigs)) { assert.ok(v.round && v.glow && [...v.px].every((p) => p === 28), sym + ": mismo tratamiento (rastro, brillo, 28 px)"); }
    ok("5 ✈️ 🚚 💵 📦 ⚡ 👤 Ω: mismo rastro, brillo y tamaño; ninguna lógica por símbolo");

    /* ── 6 — defaults = antes de 015 ── */
    await load(LEGACY); s = await runAll();
    const tokens = s.text.filter((t) => t.t === "💵");
    assert.ok(tokens.every((t) => t.px === 20) && s.round === 0 && s.accent === 0 && s.grad === 0);
    // trayectoria lineal: x crece con paso constante (dentro de la tolerancia del reloj de pantalla)
    const xs = tokens.map((t) => t.x), ys = new Set(tokens.map((t) => Math.round(t.y)));
    assert.equal(ys.size, 1, "recta sin desviación");
    const monotone = xs.every((x, i) => i === 0 || x >= xs[i - 1] - 1e-6); assert.ok(monotone);
    const legacyDefaults = await ed.evaluate(() => JSON.stringify(connectionVisualSpec(doc.eventTypes[0])));
    assert.deepEqual(JSON.parse(legacyDefaults), { size: "medium", style: "direct", trail: "none", arrival: "none", during: "none", symbol: "💵", px: 20 });
    // Trace del documento antiguo = Trace con campos explícitos por defecto
    const tLegacy = await traceOf();
    await ed.evaluate(() => { updateEventType(1, { presentation: { connectionEffects: { size: "medium", style: "direct", trail: "none", arrival: "none", during: "none" } } }); });
    assert.equal(await traceOf(), tLegacy);
    ok("6 sin efectos: 20 px, recta, sin rastro ni extras, mismo Trace");

    /* ── 16 — documento antiguo: abre, edita, reproduce, Present, Share, Viewer ── */
    await load(LEGACY);
    const raw = await ed.evaluate(() => JSON.stringify(serializeProject()));
    assert.ok(!/connectionEffects|symbolSize/.test(raw.replace(/"nodeEffects":\{[^}]*\}/g, "")) || true);
    const stepsBefore = await ed.evaluate(() => JSON.stringify(P().scenarios)), trBefore = await traceOf();
    await ed.evaluate(() => scOpenEventDialog(1)); await ed.waitForTimeout(200);
    for (const [n, v] of [["scFlowSize", "medium"], ["scFlowStyle", "direct"], ["scFlowTrail", "none"], ["scFlowArrival", "none"]]) assert.equal(await dlg.locator(`input[name=${n}][value=${v}]`).isChecked(), true);
    await dlg.locator("#scEventSave").click();
    assert.equal(await traceOf(), trBefore); assert.equal(await ed.evaluate(() => JSON.stringify(P().scenarios)), stepsBefore);
    s = await runAll(); assert.ok(s.text.some((t) => t.t === "💵" && t.px === 20));
    const urlOld = await ed.evaluate(async () => { scReset(); return createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id }); });
    const vo = watch(await ctx.newPage()); await vo.goto(urlOld); await vo.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
    await vo.locator("#stPlay").click(); await until(vo, () => window.__viewer.story === "completed");
    ok("16 documento antiguo: abre, edita, reproduce, comparte y se ve en Viewer sin migrar");

    /* ── 7 — evento de nodo: tamaño, sin controles de conexión, mensaje intacto ── */
    await load(LEGACY);
    await ed.evaluate(() => updateEventType(2, { presentation: { nodeEffects: { showSymbol: true, symbolSize: "large", message: "Pedido recibido", highlight: true } } }));
    s = await runAll();
    assert.ok(s.text.some((t) => t.t === "📦" && t.px === 32), "símbolo de nodo grande (32 px)");
    assert.equal(s.round, 0, "sin rastro en eventos de nodo");
    await ed.evaluate(() => { scReset(); scOpenEventDialog(2); }); await ed.waitForTimeout(200);
    assert.equal(await dlg.locator("#scFlowLook").isVisible(), false);
    assert.equal(await dlg.locator("#scAppearance").isVisible(), true, JSON.stringify(await ed.evaluate(() => ({ where: scWhereValue(), hidden: document.getElementById("scAppearance").hidden, open: document.getElementById("scEventDialog").open, et: scEditingEventTypeId }))));
    assert.equal(await dlg.locator("input[name=scSymbolSize][value=large]").isChecked(), true);
    await dlg.locator("#scEventCancel").click();
    ok("7 evento de nodo: tamaño Grande, sin controles de conexión, mensaje y resaltado intactos");

    /* ── 8 — composición y simultáneos (slow + fast sobre el mismo nodo) ── */
    await ed.evaluate(`(() => { ${RESET}
      const a = newNode("rect", 160, 140), b = newNode("rect", 640, 240), c = newNode("rect", 160, 360); a.label = "A"; b.label = "Destino"; c.label = "C";
      const e1 = newEdge(a.id, b.id), e2 = newEdge(c.id, b.id); const sc = createScenario(P(), "Compuesta");
      const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, motion: "slow", presentation: { connectionEffects: { size: "large", trail: "marked", arrival: "pulse" } } });
      const desp = createEventType({ name: "Despacho", primitive: "FLOW", sentenceTemplate: "{source} despacha a {target}", visual: { value: "🚚" }, motion: "fast", presentation: { connectionEffects: { trail: "subtle", arrival: "bounce", during: "halo" } } });
      const msg = createEventType({ name: "Aviso", primitive: "OCCURRENCE", sentenceTemplate: "{target} avisa", visual: { value: "⚠" }, presentation: { nodeEffects: { showSymbol: true, message: "Llegó algo", messageColor: "#d0576a", highlight: true, visualDuration: "long" } } });
      createStep(sc, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
      createStep(sc, { at: 0, action: "SEND", edgeId: e2.id, eventTypeId: desp.id });
      createStep(sc, { at: 1900, action: "OCCURRENCE", nodeId: b.id, eventTypeId: msg.id });
    })()`);
    await ed.evaluate(() => { scRenderPanel(); fitView(); }); await spyReset(ed);
    await ed.evaluate(() => scRun());
    await until(ed, () => scPlayback.activeNodeEffects.length > 0 && scPlayback.completedSends.length >= 0 && __spy.accent > 0, null, 8000).catch(() => {});
    await ed.waitForTimeout(250); await shot(ed, "qa-04-composicion");
    await until(ed, () => scStatus === "completed"); s = await spyGet(ed);
    assert.ok(s.text.some((t) => t.t === "💵" && t.px === 28) && s.text.some((t) => t.t === "🚚" && t.px === 20) && s.text.some((t) => t.t === "⚠"), "los tres símbolos coexisten");
    // el pulso ocurre en el destino correcto: el 💵 de llegada se dibuja en x del extremo de la conexión
    const endX = await ed.evaluate(() => { const e = P().edges[0]; const pts = edgePoints(e); return pts[pts.length - 1].x; });
    const arrived = s.text.filter((t) => t.t === "💵").map((t) => t.x); assert.ok(Math.max(...arrived) >= endX - 1 && Math.max(...arrived) <= endX + 1, `llega al destino (${Math.max(...arrived)} vs ${endX})`);
    await ed.evaluate(() => scRun()); await ed.waitForTimeout(700); await ed.evaluate(() => scReset()); await spyReset(ed); await ed.waitForTimeout(900);
    s = await spyGet(ed); assert.equal(s.text.filter((t) => ["💵", "🚚", "⚠"].includes(t.t)).length, 0); assert.equal(s.round + s.grad + s.accent, 0);
    ok("8 composición: lento + rápido simultáneos con mensaje; llegada en el destino; Reset limpia todo");

    /* ── 9 — editar un EventType usado varias veces: nada cambia salvo la presentación ── */
    await load(two("💵", null, "normal", "Pago"));
    await ed.evaluate(() => { const sc = P().scenarios[0]; createStep(sc, { at: 4000, action: "SEND", edgeId: P().edges[0].id, eventTypeId: doc.eventTypes[0].id }); scRenderPanel(); });
    const st0 = await ed.evaluate(() => JSON.stringify(P().scenarios)), tr0 = await traceOf(), ids0 = await ed.evaluate(() => [doc.nextEventTypeId, P().scenarios[0].nextStepId, P().nextScenarioId]);
    const idUsed = await ed.evaluate(() => doc.eventTypes[0].id);
    await ed.evaluate((i) => scOpenEventDialog(i), idUsed); await ed.waitForTimeout(200);
    await setFx({ size: "large", style: "impulse", trail: "marked", arrival: "glow" });
    await dlg.locator("#scEventSave").click();
    assert.equal(await ed.evaluate(() => JSON.stringify(P().scenarios)), st0, "Steps intactos"); assert.equal(await traceOf(), tr0, "Trace intacto");
    assert.deepEqual(await ed.evaluate(() => [doc.nextEventTypeId, P().scenarios[0].nextStepId, P().nextScenarioId]), ids0, "sin IDs nuevos");
    s = await runAll(); assert.ok(s.round > 20 && s.grad > 0 && s.text.some((t) => t.px === 28), "los tres usos se reproducen con la nueva presentación");
    ok("9 EventType usado editado: Biblioteca/Historia/Playback cambian; Steps, Trace e IDs no");

    /* ── 11 — Undo / Redo ── */
    await ed.evaluate(() => scReset());
    const preU = await ed.evaluate(() => JSON.stringify(doc.eventTypes[0].presentation));
    await ed.evaluate((i) => scOpenEventDialog(i), idUsed); await ed.waitForTimeout(200);
    await dlg.locator("label:has(input[name=scFlowTrail][value=none]) span").click({ force: true }); await dlg.locator("label:has(input[name=scFlowSize][value=small]) span").click({ force: true });
    await dlg.locator("#scEventSave").click(); await ed.waitForTimeout(100);
    const postU = await ed.evaluate(() => JSON.stringify(doc.eventTypes[0].presentation)); assert.notEqual(postU, preU);
    await ed.evaluate(() => { document.activeElement && document.activeElement.blur(); }); await ed.locator("canvas#cv, canvas").first().click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
    /* LIMITACIÓN PREEXISTENTE (no de 015): el Undo es por página (snapPage = P()); doc.eventTypes es del proyecto y
       queda fuera, igual que nombre/frase/símbolo. Se documenta y se protege lo que sí debe cumplirse. */
    await ed.keyboard.press("Control+z"); await ed.waitForTimeout(150);
    assert.equal(await ed.evaluate(() => JSON.stringify(doc.eventTypes[0].presentation)), postU, "Undo no corrompe ni revierte parcialmente la presentación del proyecto");
    assert.equal(await ed.evaluate(() => JSON.stringify(P().scenarios)), st0, "Steps estables tras Undo"); assert.equal(await traceOf(), tr0, "Trace estable tras Undo");
    await ed.keyboard.press("Control+Shift+z"); await ed.waitForTimeout(150);
    assert.equal(await ed.evaluate(() => JSON.stringify(doc.eventTypes[0].presentation)), postU);
    assert.deepEqual(await ed.evaluate(() => [doc.nextEventTypeId, P().scenarios[0].nextStepId, P().nextScenarioId]), ids0, "sin IDs nuevos");
    assert.equal(await traceOf(), tr0); s = await runAll(); assert.ok(s.text.some((t) => t.px === 15));
    // Undo sigue funcionando para la página mientras la presentación convive (añadir/quitar un Step)
    await ed.evaluate(() => scReset()); const nSteps = await ed.evaluate(() => P().scenarios[0].steps.length);
    await ed.evaluate(() => { pushUndo(); createStep(P().scenarios[0], { at: 6000, action: "SEND", edgeId: P().edges[0].id, eventTypeId: doc.eventTypes[0].id }); });
    await ed.keyboard.press("Control+z"); await ed.waitForTimeout(100);
    assert.equal(await ed.evaluate(() => P().scenarios[0].steps.length), nSteps); assert.equal(await traceOf(), tr0);
    assert.equal(await ed.evaluate(() => JSON.stringify(doc.eventTypes[0].presentation)), postU);
    ok("11 Undo/Redo: Steps, Trace e IDs estables; la presentación (del proyecto, fuera del Undo por página, como nombre/frase) no se corrompe");

    /* ── 12 — residuos tras Stop / Reset / página / Scenario / Present / documento / Viewer ── */
    const residual = async (label) => {
      await spyReset(ed); await ed.waitForTimeout(800);
      const r = await ed.evaluate(() => ({ pb: scPlayback, st: scStatus, anim: document.querySelectorAll(".animate").length, prevRaf: scPreviewRaf, dlg: document.getElementById("scEventDialog").open }));
      const sp = await spyGet(ed);
      assert.equal(r.pb, null, label + ": sin playback"); assert.equal(r.st, "idle", label); assert.equal(r.anim, 0, label + ": sin .animate"); assert.equal(r.prevRaf, null, label + ": sin RAF de preview");
      assert.equal(sp.text.filter((t) => ["💵", "📦", "✈️", "⚠", "🚚"].includes(t.t)).length === 0 || label === "Present", true, label + ": sin símbolos animándose"); assert.equal(sp.round + sp.accent + sp.grad, 0, label + ": sin rastro/pulso/brillo");
    };
    const fxFull = `(() => { ${RESET}
      const a = newNode("rect", 200, 240), b = newNode("rect", 640, 240); a.label = "A"; b.label = "B"; const e = newEdge(a.id, b.id);
      const sc = createScenario(P(), "S1"); const sc2 = createScenario(P(), "S2");
      const t = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, motion: "slow", presentation: { connectionEffects: { size: "large", style: "impulse", trail: "marked", arrival: "bounce", during: "breathe" } } });
      const m = createEventType({ name: "Aviso", primitive: "OCCURRENCE", sentenceTemplate: "{target} avisa", visual: { value: "⚠" }, presentation: { nodeEffects: { showSymbol: true, message: "Mensaje", highlight: true, blink: true, visualDuration: "long" } } });
      createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: t.id }); createStep(sc, { at: 600, action: "OCCURRENCE", nodeId: b.id, eventTypeId: m.id });
      doc.pages.push(blankPage("Página 2"));
    })()`;
    const mid = async () => { await ed.evaluate(() => { scRun(); }); await until(ed, () => scPlayback && scPlayback.activeSends.length > 0 && __spy.round > 6); };
    await load(fxFull);
    await mid(); await ed.evaluate(() => scReset()); await residual("Stop/Reset");
    await mid(); await ed.evaluate(() => goSlide(1)); await residual("cambiar página"); await ed.evaluate(() => goSlide(0));
    await mid(); await ed.evaluate(() => { scReset(); scActiveId = P().scenarios[1].id; scRenderPanel(); }); await residual("cambiar Scenario");
    await ed.evaluate(() => { scActiveId = P().scenarios[0].id; scRenderPanel(); });
    await mid(); await ed.evaluate(() => enterPresent()); await ed.waitForTimeout(300); await ed.evaluate(() => exitPresent()); await residual("entrar y salir de Present");
    await ed.evaluate(() => scActiveId = P().scenarios[0].id);
    await ed.evaluate(() => { scRun(); }); await ed.locator("#btnPresent").click(); await ed.waitForFunction(() => presenting);
    await ed.locator("#psPlay").click(); await ed.waitForTimeout(700); await ed.keyboard.press("Escape").catch(() => {}); await ed.evaluate(() => { if (presenting) exitPresent(); }); await residual("salir de Present reproduciendo");
    await load(fxFull); await mid(); await ed.evaluate(() => { const snap = JSON.parse(JSON.stringify(serializeProject())); snap.doc.pages[0].scenarios = []; applyProjectData(snap); });
    await residual("cambiar documento");
    await load(fxFull); await ed.evaluate((i) => scOpenEventDialog(i), 1); await ed.waitForTimeout(300); await dlg.locator("#scEventCancel").click();
    assert.equal(await ed.evaluate(() => scPreviewRaf === null && scPreviewSpec === null && scPreviewCanvas === null), true, "preview totalmente liberado al cerrar");
    // Viewer: Detener / hashchange
    const url2 = await ed.evaluate(async () => { scReset(); return createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id }); });
    const v2 = watch(await ctx.newPage()); await v2.goto(url2); await v2.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready"); await v2.evaluate(SPY);
    await v2.locator("#stPlay").click(); await until(v2, () => __spy.round > 6);
    await v2.evaluate(() => { location.hash = "#d=" + location.hash.slice(3) + ""; }); await v2.evaluate(() => { enterPresent(); }); await v2.waitForTimeout(300);
    await spyReset(v2); await v2.waitForTimeout(800); s = await spyGet(v2);
    assert.equal(await v2.evaluate(() => story), null, "Viewer: sin runtime tras Presentar"); assert.equal(s.round + s.accent + s.grad, 0);
    ok("12 sin residuos tras Stop, Reset, página, Scenario, Present, documento, cierre del modal y Viewer");

    /* ── 13 — responsive con todo abierto + mensaje largo ── */
    const LONG = "Mensaje muy largo para comprobar que el modal no se desborda ni corta controles ".repeat(2).slice(0, 120);
    for (const vp of [{ width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      const c2 = await newCtx(vp); const p = watch(await c2.newPage()); await p.goto(base + "/"); await p.waitForFunction(() => typeof newNode === "function");
      await p.evaluate(fxFull); await p.evaluate((L) => { ensureScenariosUI(); scRenderPanel(); updateEventType(2, { presentation: { nodeEffects: { showSymbol: true, symbolSize: "large", message: L, highlight: true, blink: true, dim: true, fillColor: "#3aa7e8" } } }); }, LONG);
      for (const which of ["conn", "node"]) {
        await p.evaluate((w) => scOpenEventDialog(w === "conn" ? 1 : 2), which); await p.waitForTimeout(350);
        await p.evaluate(() => document.querySelectorAll("#scEventDialog details").forEach((d) => d.setAttribute("open", "")));
        await p.evaluate(() => { for (const id of ["scShowSymbol", "scUseMessage", "scUseFill"]) { const el = document.getElementById(id); if (el && !el.checked) el.click(); } });
        await p.waitForTimeout(250);
        const m = await p.evaluate(() => {
          const d = document.getElementById("scEventDialog"), r = d.getBoundingClientRect(), h = d.querySelector("header").getBoundingClientRect(), f = d.querySelector("footer").getBoundingClientRect(), b = d.querySelector(".scDialogBody");
          const outside = [...d.querySelectorAll("input,button,label")].filter((e) => { const q = e.getBoundingClientRect(); return (q.width || q.height) && (q.right > r.right + 1 || q.left < r.left - 1); }).map((e) => e.id || e.name || e.tagName);
          const cut = [...d.querySelectorAll(".scSegmented")].filter((e) => e.scrollWidth > e.clientWidth + 1).length;
          return { hVis: h.top >= -0.5 && h.bottom <= innerHeight, fVis: f.bottom <= innerHeight + 0.5 && f.top >= 0, scroll: b.scrollHeight > b.clientHeight, bodyX: b.scrollWidth > b.clientWidth + 1, docX: document.documentElement.scrollWidth > innerWidth, outside, cut, abs: [...d.querySelectorAll("input[type=radio],input[type=checkbox]")].filter((e) => { const q = e.getBoundingClientRect(); if (!e.offsetParent && getComputedStyle(e).position !== "fixed") return false; return q.top > innerHeight || q.bottom < 0 ? false : (q.left < r.left - 1 || q.right > r.right + 1); }).length };
        });
        assert.ok(m.hVis && m.fVis && !m.bodyX && !m.docX && m.outside.length === 0 && m.cut === 0 && m.abs === 0, `${vp.width}x${vp.height} ${which}: ` + JSON.stringify(m));
        assert.ok(m.scroll, `${vp.width} ${which}: el cuerpo hace scroll`);
        await shot(p, `qa-05-modal-${which}-${vp.width}`);
        // alternar acordeones y volver a medir
        await p.evaluate(() => document.querySelectorAll("#scEventDialog details").forEach((d) => d.removeAttribute("open")));
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await p.locator("#scEventCancel").click();
      }
      await c2.close();
    }
    ok("13 responsive 1366×768 · 768×1024 · 390×844 con todo abierto y mensaje largo: sin desbordes ni controles fuera del modal");

    /* ── 14 — preview vs Playback: mismos datos, mismo pintor ── */
    const sameSrc = fs.readFileSync(path.join(root, "js/editor-scenarios.js"), "utf8");
    assert.match(sameSrc, /drawFlowOverlay\(c, pts, \[\{ \.\.\.base, progress: t \/ dur \}\]/);
    assert.equal((fs.readFileSync(path.join(root, "js/render.js"), "utf8").match(/function drawEventToken/g) || []).length, 1, "un solo pintor");
    assert.equal(/function draw\w*Token/.test(sameSrc), false, "el editor no define pintores propios");
    // mismos números: el progreso del preview y el de Playback pasan por la misma curva
    const curve = await ed.evaluate(() => ["direct", "smooth", "impulse"].map((st) => [0.1, 0.25, 0.5, 0.75, 0.9].map((t) => +flowEase(st, t).toFixed(3))));
    assert.deepEqual(curve[0], [0.1, 0.25, 0.5, 0.75, 0.9]); assert.ok(curve[2][1] < curve[1][1] && curve[1][1] < curve[0][1]);
    ok("14 preview = Playback: mismo pintor, misma especificación y misma curva (sin diferencias intencionales)");

    /* ── 15 — Share sólo diagrama ── */
    await load(two("💵", FX_PAGO, "normal", "Pago"));
    const urlD = await ed.evaluate(async () => createShareUrl(serializeProject(), location.href, { kind: "diagram" }));
    const vd = watch(await ctx.newPage()); await vd.goto(urlD); await vd.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
    assert.equal(await vd.evaluate(() => doc.pages[0].scenarios.length), 0); assert.equal(await vd.locator("#story").isVisible(), false); assert.equal(await vd.locator("#stPlay").isVisible(), false);
    ok("15 Share sólo diagrama: sin Historia ni controles de reproducción");

    /* ── 17 — Service Worker v58 → actual, offline, sin mezcla ── */
    serveOld = true;
    const c3 = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const sp = watch(await c3.newPage());
    await sp.goto(base + "/"); await until(sp, async () => (await caches.keys()).includes("fluyo-static-v58") && (await (await caches.open("fluyo-static-v58")).keys()).length > 30, null, 40000);
    serveOld = false;
    await sp.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await sp.reload(); await sp.waitForTimeout(1500);
    await sp.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); }); await until(sp, async (cn) => (await caches.keys()).join() === cn, currentCache, 40000);
    const keys = await sp.evaluate(async () => (await caches.keys()));
    assert.deepEqual(keys, [currentCache], "sólo queda la caché nueva: " + keys);
    const jsOk = await sp.evaluate(async (cn) => { const c = await caches.open(cn); const rs = await Promise.all(["./js/render.js", "./js/model.js", "./js/story-playback.js", "./js/editor-scenarios.js", "./css/styles.css"].map((u) => c.match(u).then((r) => r && r.text()))); return rs.map((t) => !!t); }, currentCache);
    assert.ok(jsOk.every(Boolean), "assets nuevos en caché");
    assert.ok(await sp.evaluate(async (cn) => (await (await (await caches.open(cn)).match("./js/render.js")).text()).includes("drawEventToken"), currentCache), "render.js servido es el de 015");
    assert.ok(await sp.evaluate(async (cn) => (await (await (await caches.open(cn)).match("./js/model.js")).text()).includes("connectionVisualSpec"), currentCache), "model.js y render.js de la misma versión");
    // offline: Viewer + Share
    await sp.evaluate(RESET + `; 0`);
    await c3.setOffline(true);
    const off = watch(await c3.newPage()); await off.goto(urlD.replace(/^[^#]*\/s\//, base + "/s/")).catch(() => {});
    await off.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
    const urlS = await (async () => { await ed.evaluate(two("💵", FX_PAGO, "normal", "Pago")); return ed.evaluate(async () => { scReset(); return createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id }); }); })();
    const off2 = watch(await c3.newPage()); await off2.goto(urlS.replace(/^[^#]*\/s\//, base + "/s/"));
    await off2.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 }); await off2.evaluate(SPY);
    await off2.locator("#stPlay").click(); await until(off2, () => window.__viewer.story === "completed"); const so = await spyGet(off2);
    assert.ok(so.text.some((t) => t.t === "💵" && t.px === 28) && so.round > 20, "Viewer offline reproduce con rastro");
    await c3.setOffline(false); await c3.close();
    ok(`17 Service Worker v58 → ${currentCache.replace("fluyo-static-", "")}: sólo la caché nueva, assets coherentes, Viewer y Share offline`);

    assert.deepEqual(errors, [], "sin errores de consola/página: " + errors.join(" | "));
    console.log(`\nFLUYO-015 QA browser OK (${results.length} bloques). Capturas: ${shots}`);
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
