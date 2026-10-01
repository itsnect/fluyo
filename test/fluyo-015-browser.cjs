"use strict";
/* FLUYO-015: lenguaje visual de eventos en movimiento, en Chrome real.
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-015-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-015-"));
fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json" };

const RESET = `P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = [];`;
const BASE = `${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 640, 240); a.label = "Cliente"; b.label = "Comercio";
  const e = newEdge(a.id, b.id); const sc = createScenario(P(), "Historia de prueba");`;
const fixture = (events, steps) => `(() => { ${BASE}
  const T = {}; ${events}
  ${steps}
})()`;
const PAGO_RASTRO = fixture(
  `T.pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, presentation: { connectionEffects: { size: "large", style: "impulse", trail: "marked" } } });`,
  `createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: T.pago.id });`);
const PEDIDO_LLEGADA = fixture(
  `T.ped = createEventType({ name: "Pedido", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { value: "📦" }, motion: "fast", presentation: { connectionEffects: { arrival: "bounce" } } });`,
  `createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: T.ped.id });`);
const AVION = fixture(
  `T.av = createEventType({ name: "Vuelo", primitive: "FLOW", sentenceTemplate: "{source} vuela a {target}", visual: { value: "✈️" }, presentation: { connectionEffects: { trail: "subtle", style: "smooth" } } });`,
  `createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: T.av.id });`);
const SIN_EFECTOS = fixture(
  `T.pl = createEventType({ name: "Aviso", primitive: "FLOW", sentenceTemplate: "{source} avisa a {target}", visual: { value: "📨" }, motion: "fast" });`,
  `createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: T.pl.id });`);
const SIMULTANEOS = `(() => { ${RESET}
  const a = newNode("rect", 160, 120), b = newNode("rect", 640, 120), c = newNode("rect", 160, 360), d = newNode("rect", 640, 360);
  const e1 = newEdge(a.id, b.id), e2 = newEdge(c.id, d.id); const sc = createScenario(P(), "Dos a la vez");
  const x = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, presentation: { connectionEffects: { trail: "marked", arrival: "pulse" } } });
  const y = createEventType({ name: "Vuelo", primitive: "FLOW", sentenceTemplate: "{source} vuela a {target}", visual: { value: "✈️" }, presentation: { connectionEffects: { size: "large", during: "halo", arrival: "glow" } } });
  createStep(sc, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: x.id });
  createStep(sc, { at: 0, action: "SEND", edgeId: e2.id, eventTypeId: y.id });
})()`;
const FALLIDO = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 640, 240); a.label = "Cliente"; b.label = "Comercio"; const e = newEdge(a.id, b.id);
  const sc = createScenario(P(), "Pago fallido");
  const cae = createEventType({ name: "Comercio cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { value: "⚠" } });
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, motion: "fast", presentation: { connectionEffects: { trail: "marked", arrival: "pulse" } } });
  createStep(sc, { at: 0, action: "SET_STATE", nodeId: b.id, state: "DOWN", eventTypeId: cae.id });
  createStep(sc, { at: 500, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
})()`;
const MENSAJE = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 640, 240); a.label = "Cliente"; b.label = "Comercio"; const e = newEdge(a.id, b.id);
  const sc = createScenario(P(), "Pago con mensaje");
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, motion: "slow", presentation: { connectionEffects: { trail: "marked", size: "large" } } });
  const rec = createEventType({ name: "Recibido", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe", visual: { value: "✓" },
    presentation: { nodeEffects: { showSymbol: true, symbolSize: "large", message: "Pago recibido", messageColor: "#2e7d32", highlight: true, visualDuration: "long" } } });
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
  createStep(sc, { at: 1500, action: "OCCURRENCE", nodeId: b.id, eventTypeId: rec.id });
})()`;
const LEGACY = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 640, 240); const e = newEdge(a.id, b.id); const sc = createScenario(P(), "Legacy");
  doc.eventTypes.push({ id: 1, name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { kind: "token", value: "💵" }, motion: "normal" });
  doc.nextEventTypeId = 2;
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: 1 });
})()`;

/* Espía de dibujo (se instala en la página; no altera el resultado). */
const SPY = `(() => { if (window.__spy) return; const s = window.__spy = { text: [], round: 0, grad: 0, accent: 0, red: 0, preview: { text: 0, round: 0 } };
  const p = CanvasRenderingContext2D.prototype, ft = p.fillText, st = p.stroke, cg = p.createRadialGradient;
  const isPrev = (c) => c.canvas && /scPreviewCanvas/.test(c.canvas.className || "");
  p.fillText = function (t, x, y, ...r) { if (isPrev(this)) s.preview.text++; else if (/^[^\\w\\s]/u.test(t) && t.length < 6) s.text.push({ t, x, y, px: parseFloat(/(\\d+(?:\\.\\d+)?)px/.exec(this.font)?.[1] || 0), a: this.globalAlpha }); return ft.call(this, t, x, y, ...r); };
  p.stroke = function (...r) { if (this.lineCap === "round") { if (isPrev(this)) s.preview.round++; else s.round++; } if (!isPrev(this)) { if (this.strokeStyle === "#3aa7e8") s.accent++; if (this.strokeStyle === "#d0576a") s.red++; } return st.apply(this, r); };
  p.createRadialGradient = function (...r) { if (!isPrev(this)) s.grad++; return cg.apply(this, r); };
})()`;
const spyReset = (p) => p.evaluate(() => { __spy.text = []; __spy.round = 0; __spy.grad = 0; __spy.accent = 0; __spy.red = 0; __spy.preview = { text: 0, round: 0 }; });
const spyGet = (p) => p.evaluate(() => JSON.parse(JSON.stringify(__spy)));

(async () => {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL("http://x" + req.url); let rel = url.pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(root, "." + rel); assert.ok(file.startsWith(root + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const errors = [];
  const results = [];
  const ok = (name) => { results.push(name); console.log("  ✔", name); };
  const watch = (p) => { p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); }); return p; };
  const newCtx = (vp = { width: 1366, height: 768 }) => browser.newContext({ viewport: vp, serviceWorkers: "block" });
  const shot = (p, n) => p.screenshot({ path: path.join(shots, n + ".png") });
  const until = async (p, fn, arg, timeout = 20000) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn, arg)) return; if (Date.now() - t0 > timeout) throw new Error("timeout: " + fn); await p.waitForTimeout(80); } };

  try {
    const ctx = await newCtx();
    const ed = watch(await ctx.newPage());
    await ed.goto(base + "/");
    await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
    await ed.evaluate(SPY);
    await ed.evaluate(() => ensureScenariosUI());
    const load = async (fx) => { await ed.evaluate(() => { if (typeof scReset === "function") scReset(); }); await ed.evaluate(fx); await ed.evaluate(() => { (typeof scRenderPanel==="function"&&scRenderPanel()); fitView(); }); await spyReset(ed); };
    const runAll = async (timeout = 25000) => {
      await ed.evaluate(() => scRun());
      await until(ed, () => scStatus === "completed", null, timeout);
      return spyGet(ed);
    };
    const traceOf = () => ed.evaluate(() => JSON.stringify(FluyoScenarios.runScenario({ nodes: P().nodes, edges: P().edges }, P().behaviors || [], scActiveScenario()).trace));

    /* 1 — 💵 Pago con rastro marcado, grande, impulso */
    await load(PAGO_RASTRO);
    await ed.evaluate(() => scRun());
    await until(ed, () => scPlayback && scPlayback.activeSends && __spy.round > 20, null, 5000);
    await ed.waitForTimeout(150); await shot(ed, "01-playback-pago-rastro");
    await until(ed, () => scStatus === "completed");
    let s = await spyGet(ed);
    assert.ok(s.round > 20, "rastro dibujado: " + s.round);
    const big = s.text.filter((t) => t.t === "💵");
    assert.ok(big.length > 5 && big.every((t) => t.px <= 28.01) && big.some((t) => t.px === 28), "símbolo grande (28 px)");
    assert.ok(big.length > 12, "ecos del símbolo en el rastro marcado: " + big.length);
    ok("1 💵 Pago con rastro marcado, grande e impulso");

    /* 2 — 📦 Pedido con efecto al llegar (rebote) */
    await load(PEDIDO_LLEGADA);
    s = await runAll();
    const ys = new Set(s.text.filter((t) => t.t === "📦").map((t) => Math.round(t.y)));
    assert.ok(ys.size > 2, "rebote: el símbolo se desplaza verticalmente al llegar (" + ys.size + " alturas)");
    assert.equal(s.round, 0, "sin rastro");
    ok("2 📦 Pedido con rebote al llegar");

    /* 3 — símbolo personalizado ✈️ con rastro creado desde el modal real */
    await load(SIN_EFECTOS);
    await ed.evaluate(() => scOpenEventDialog(null));
    const dlg = ed.locator("#scEventDialog");
    await dlg.locator("#scEventName").fill("Vuelo");
    await dlg.locator("#scVisualPicker button", { hasText: "+" }).click();
    await dlg.locator("#scEventVisual").fill("✈️");
    await dlg.locator("label:has(input[name=scFlowTrail][value=subtle]) span").click();
    await dlg.locator("label:has(input[name=scFlowStyle][value=smooth]) span").click();
    await dlg.locator("label:has(input[name=scFlowSize][value=large]) span").click();
    await ed.waitForTimeout(400);
    const prev = await spyGet(ed);
    assert.ok(prev.preview.round > 0 && prev.preview.text > 0, "el preview dibuja rastro con el pintor compartido");
    await shot(ed, "02-modal-nuevo-avion");
    await dlg.locator("#scEventSave").click();
    const av = await ed.evaluate(() => doc.eventTypes.find((e) => e.name === "Vuelo"));
    assert.equal(av.visual.value, "✈️");
    assert.deepEqual(av.presentation.connectionEffects, { size: "large", style: "smooth", trail: "subtle", arrival: "none", during: "none" });
    await ed.evaluate((id) => { P().scenarios[0].steps.length = 0; createStep(P().scenarios[0], { at: 0, action: "SEND", edgeId: P().edges[0].id, eventTypeId: id }); (typeof scRenderPanel==="function"&&scRenderPanel()); }, av.id);
    await spyReset(ed); s = await runAll();
    assert.ok(s.round > 0 && s.text.some((t) => t.t === "✈️"), "símbolo inventado con rastro");
    ok("3 ✈️ símbolo personalizado con rastro, desde el modal");

    /* 4 — evento sin efectos: igual que antes */
    await load(SIN_EFECTOS); s = await runAll();
    assert.equal(s.round, 0); assert.equal(s.grad, 0);
    assert.ok(s.text.filter((t) => t.t === "📨").every((t) => t.px === 20), "20 px, como antes");
    ok("4 evento sin efectos: sin rastro ni extras, 20 px");

    /* 4b — EventType legacy (sin los campos nuevos) sigue reproduciéndose */
    await load(LEGACY);
    assert.equal(await ed.evaluate(() => doc.eventTypes[0].presentation === undefined), true);
    s = await runAll();
    assert.ok(s.text.some((t) => t.t === "💵" && t.px === 20)); assert.equal(s.round, 0);
    ok("4b EventType antiguo sin campos nuevos: reproduce como antes");

    /* 5 — varios simultáneos con efectos distintos */
    await load(SIMULTANEOS);
    await ed.evaluate(() => scRun());
    await until(ed, () => scPlayback && scPlayback.activeSends && scPlayback.activeSends.length === 2, null, 5000).catch(() => {});
    await ed.waitForTimeout(450); await shot(ed, "03-playback-simultaneos");
    await until(ed, () => scStatus === "completed");
    s = await spyGet(ed);
    assert.ok(s.text.some((t) => t.t === "💵" && t.px === 20) && s.text.some((t) => t.t === "✈️" && t.px === 28), "cada símbolo con su tamaño");
    assert.ok(s.round > 0 && s.grad > 0, "rastro de uno y halo/brillo del otro");
    assert.ok(s.accent > 0, "el Pulso de llegada del éxito se pinta");
    ok("5 varios eventos simultáneos con efectos distintos");

    /* 6 — evento fallido: sin celebración de llegada */
    await load(FALLIDO); s = await runAll();
    assert.equal(s.accent, 0, "un fallo no dispara el Pulso de llegada");
    assert.ok(s.red > 0, "el fallo conserva su anillo rojo de siempre");
    assert.ok(s.round > 0, "pero sí viaja con su rastro");
    ok("6 evento fallido: no se celebra la llegada");

    /* 7 — mensaje + símbolo + rastro */
    await load(MENSAJE);
    await ed.evaluate(() => scRun());
    await until(ed, () => scPlayback && scPlayback.activeNodeEffects.some((f) => f.effects.message === "Pago recibido"), null, 8000);
    await ed.waitForTimeout(400); await shot(ed, "04-playback-mensaje-simbolo-rastro");
    s = await spyGet(ed);
    assert.ok(s.round > 20 && s.text.some((t) => t.t === "✓" && t.px === 32), "símbolo de nodo grande (32 px) y rastro previo");
    await until(ed, () => scStatus === "completed", null, 20000);
    ok("7 mensaje + símbolo + rastro");

    /* 8 — Present */
    await load(PAGO_RASTRO);
    await ed.locator("#btnPresent").click();
    await ed.waitForFunction(() => presenting);
    await spyReset(ed);
    await ed.locator("#psPlay").click();
    await until(ed, () => __spy.round > 20, null, 8000);
    await ed.waitForTimeout(200); await shot(ed, "05-present");
    await until(ed, () => presentPhase() === "finished", null, 25000);
    s = await spyGet(ed);
    assert.ok(s.text.some((t) => t.t === "💵" && t.px === 28) && s.round > 20, "Present usa el mismo pintor");
    await ed.evaluate(() => exitPresent());
    assert.equal(await ed.evaluate(() => scPlayback === null && scStatus === "idle"), true, "sin Playback tras salir de Present");
    ok("8 Present con rastro, grande e impulso");

    /* 9 — Viewer/Share */
    await load(PAGO_RASTRO);
    const url = await ed.evaluate(async () => { scReset(); const sc = scActiveScenario(); return createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: sc.id }); });
    const vw = watch(await ctx.newPage());
    await vw.goto(url);
    await vw.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
    await vw.evaluate(SPY);
    await vw.locator("#stPlay").click();
    await until(vw, () => __spy.round > 20, null, 8000);
    await vw.waitForTimeout(150); await shot(vw, "06-viewer-share");
    await until(vw, () => window.__viewer.story === "completed", null, 25000);
    s = await spyGet(vw);
    assert.ok(s.text.some((t) => t.t === "💵" && t.px === 28) && s.round > 20, "Viewer: mismo pintor y mismos datos");
    assert.equal(await vw.evaluate(() => typeof drawEventToken + typeof scRun), "functionundefined");
    ok("9 Viewer/Share con rastro, grande e impulso");

    /* 10 — Reset durante la animación: nada queda activo */
    await load(PAGO_RASTRO);
    await ed.evaluate(() => scRun());
    await until(ed, () => scPlayback && scPlayback.activeSends.length > 0 && __spy.round > 5, null, 5000);
    await ed.evaluate(() => scReset());
    await spyReset(ed); await ed.waitForTimeout(1200);
    s = await spyGet(ed);
    assert.equal(s.round, 0); assert.equal(s.text.filter((t) => t.t === "💵").length, 0);
    assert.equal(await ed.evaluate(() => scPlayback === null && scStatus === "idle"), true);
    // Detener en Viewer a mitad
    await vw.locator("#stPlay").click(); await until(vw, () => window.__viewer.story === "running"); await vw.waitForTimeout(300);
    await vw.locator("#stStop").click(); await spyReset(vw); await vw.waitForTimeout(1000);
    s = await spyGet(vw); assert.equal(s.round, 0); assert.equal(await vw.evaluate(() => story), null);
    ok("10 Reset/Detener durante la animación: sin restos");

    /* Trace antes = Trace después, con el modal real sobre un EventType USADO */
    await load(PAGO_RASTRO);
    const traceBefore = await traceOf(), stepsBefore = await ed.evaluate(() => JSON.stringify(P().scenarios));
    const id = await ed.evaluate(() => doc.eventTypes[0].id);
    await ed.evaluate((i) => scOpenEventDialog(i), id);
    await ed.waitForTimeout(300);
    assert.equal(await dlg.locator("input[name=scFlowSize][value=large]").isChecked(), true, "edición de un EventType existente: carga lo guardado");
    assert.equal(await dlg.locator("input[name=scFlowTrail][value=marked]").isChecked(), true);
    const hashA = await ed.locator(".scPreviewCanvas").evaluate((c) => c.toDataURL().length);
    await dlg.locator("label:has(input[name=scFlowSize][value=small]) span").click();
    await dlg.locator("label:has(input[name=scFlowTrail][value=none]) span").click();
    await dlg.locator("label:has(input[name=scFlowArrival][value=glow]) span").click();
    await dlg.locator("summary", { hasText: "Más detalles" }).click();
    await dlg.locator("label:has(input[name=scFlowDuring][value=breathe]) span").click();
    await ed.waitForTimeout(500);
    await dlg.locator("#scEventSave").click();
    assert.deepEqual(await ed.evaluate(() => doc.eventTypes[0].presentation.connectionEffects), { size: "small", style: "impulse", trail: "none", arrival: "glow", during: "breathe" });
    assert.equal(await traceOf(), traceBefore, "Trace antes = Trace después (tras editar el visual de un EventType usado)");
    assert.equal(await ed.evaluate(() => JSON.stringify(P().scenarios)), stepsBefore, "la Historia no cambia");
    // Reset del modal: un evento nuevo vuelve a los valores por defecto
    await ed.evaluate(() => scOpenEventDialog(null)); await ed.waitForTimeout(200);
    for (const [n, v] of [["scFlowSize", "medium"], ["scFlowStyle", "direct"], ["scFlowTrail", "none"], ["scFlowArrival", "none"], ["scFlowDuring", "none"]])
      assert.equal(await dlg.locator(`input[name=${n}][value=${v}]`).isChecked(), true, n + " por defecto");
    await dlg.locator("#scEventCancel").click();
    assert.equal(await ed.evaluate(() => document.getElementById("scEventDialog").open), false);
    // Cerrar el modal detiene el preview: ningún cuadro más
    await spyReset(ed); await ed.waitForTimeout(500);
    assert.equal((await spyGet(ed)).preview.text, 0, "preview detenido al cerrar");
    ok("Trace antes = Trace después; editar EventType usado; reset del modal; preview se detiene");

    /* Responsive: header, body con scroll, footer fijo, sin scroll horizontal */
    for (const vp of [{ width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      const c2 = await newCtx(vp); const p = watch(await c2.newPage());
      await p.goto(base + "/"); await p.waitForFunction(() => typeof newNode === "function");
      await p.evaluate(PAGO_RASTRO); await p.evaluate(() => { ensureScenariosUI(); (typeof scRenderPanel==="function"&&scRenderPanel()); scOpenEventDialog(doc.eventTypes[0].id); });
      await p.waitForTimeout(500);
      const m = await p.evaluate(() => {
        const d = document.getElementById("scEventDialog"), h = d.querySelector("header").getBoundingClientRect(), f = d.querySelector("footer").getBoundingClientRect(), b = d.querySelector(".scDialogBody");
        const cv = document.querySelector(".scPreviewCanvas").getBoundingClientRect(), r = d.getBoundingClientRect();
        return { hTop: h.top, hBottom: h.bottom, fBottom: f.bottom, fVisible: f.bottom <= innerHeight + 0.5 && f.top >= 0, bodyScrolls: b.scrollHeight > b.clientHeight, bodyH: b.scrollWidth > b.clientWidth + 1, docH: document.documentElement.scrollWidth > innerWidth, dlgH: d.scrollWidth > d.clientWidth + 1, cvW: cv.width, cvH: cv.height, inside: cv.left >= r.left - 1 && cv.right <= r.right + 1, vw: innerWidth };
      });
      assert.ok(m.hTop >= 0 && m.fVisible, `${vp.width}: header y footer visibles ` + JSON.stringify(m));
      assert.ok(!m.bodyH && !m.docH && !m.dlgH, `${vp.width}: sin scroll horizontal ` + JSON.stringify(m));
      assert.ok(m.cvW > 120 && m.cvH > 60 && m.inside, `${vp.width}: preview visible y dentro del modal`);
      assert.ok(m.bodyScrolls, `${vp.width}: el cuerpo hace scroll`);
      await shot(p, `07-modal-${vp.width}x${vp.height}`);
      // la última opción (Al llegar) es alcanzable con scroll del cuerpo y clicable
      await p.locator("#scEventDialog label:has(input[name=scFlowArrival][value=bounce])").scrollIntoViewIfNeeded();
      await p.locator("#scEventDialog label:has(input[name=scFlowArrival][value=bounce]) span").click();
      assert.equal(await p.locator("input[name=scFlowArrival][value=bounce]").isChecked(), true);
      await c2.close();
    }
    ok("Responsive 1366×768 · 768×1024 · 390×844: header, cuerpo con scroll, footer fijo, sin scroll horizontal");

    /* Modal para eventos de elemento: tamaño del símbolo */
    await ed.evaluate(MENSAJE); await ed.evaluate(() => { (typeof scRenderPanel==="function"&&scRenderPanel()); });
    const recId = await ed.evaluate(() => doc.eventTypes.find((e) => e.name === "Recibido").id);
    await ed.evaluate((i) => scOpenEventDialog(i), recId); await ed.waitForTimeout(300);
    assert.equal(await dlg.locator("input[name=scSymbolSize][value=large]").isChecked(), true);
    assert.equal(await dlg.locator("#scFlowLook").isVisible(), false, "eventos de elemento: sin rastro ni llegada");
    await shot(ed, "08-modal-elemento");
    await dlg.locator("#scEventCancel").click();
    ok("Evento de elemento: sólo tamaño del símbolo");

    /* Reduced motion: el preview no anima en bucle */
    const c3 = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", reducedMotion: "reduce" });
    const rp = watch(await c3.newPage()); await rp.goto(base + "/"); await rp.waitForFunction(() => typeof newNode === "function");
    await rp.evaluate(SPY); await rp.evaluate(PAGO_RASTRO); await rp.evaluate(() => { ensureScenariosUI(); (typeof scRenderPanel==="function"&&scRenderPanel()); scOpenEventDialog(doc.eventTypes[0].id); });
    await rp.waitForTimeout(300); await spyReset(rp); await rp.waitForTimeout(600);
    assert.equal((await spyGet(rp)).preview.text, 0, "con reducir movimiento no hay bucle");
    await rp.locator("#scPreviewPlay").click(); await rp.waitForTimeout(400);
    assert.ok((await spyGet(rp)).preview.text > 0, "«Ver ejemplo» lo anima una vez");
    await c3.close();
    ok("Reducir movimiento respetado en el preview");

    assert.deepEqual(errors, [], "sin errores de consola/página: " + errors.join(" | "));
    console.log(`\nFLUYO-015 browser OK (${results.length} bloques). Capturas: ${shots}`);
  } finally {
    await browser.close(); server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
