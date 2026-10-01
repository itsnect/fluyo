"use strict";
/* FLUYO-013: Present sobre el Playback existente, en Chrome real.
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-013-browser.cjs */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-013-"));
fs.mkdirSync(shots, { recursive: true });

const FIXTURE_PAGO = () => {
  P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = [];
  const a = newNode("rect", 200, 240), b = newNode("rect", 600, 240);
  a.label = "Cliente"; b.label = "Comercio";
  const e = newEdge(a.id, b.id);
  const sc = createScenario(P(), "Compra");
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
  const recibido = createEventType({
    name: "Pago recibido", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe el pago", visual: { value: "✓" },
    presentation: { nodeEffects: { showSymbol: true, message: "Pago recibido", highlight: true, visualDuration: "brief" } },
  });
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: b.id, eventTypeId: recibido.id });
  /* simultáneo: segundo acontecimiento en el mismo momento */
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: a.id, eventTypeId: recibido.id });
  viewX = 0; viewY = 0; viewZoom = 1;
};
const FIXTURE_KAFKA = () => {
  P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = [];
  const p = newNode("rect", 120, 240), k = newNode("rect", 420, 240), c = newNode("rect", 720, 240);
  p.label = "Producer"; k.label = "Kafka"; c.label = "Consumer";
  const e1 = newEdge(p.id, k.id), e2 = newEdge(k.id, c.id);
  const sc = createScenario(P(), "Mensaje perdido");
  const caida = createEventType({ name: "Kafka cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { value: "⚠" } });
  const pub = createEventType({ name: "Publicación", primitive: "FLOW", sentenceTemplate: "{source} publica en {target}", visual: { value: "📨" } });
  createStep(sc, { at: 0, action: "SET_STATE", nodeId: k.id, state: "DOWN", eventTypeId: caida.id });
  createStep(sc, { at: 1000, action: "SEND", edgeId: e1.id, eventTypeId: pub.id });
  createStep(sc, { at: 3500, action: "SEND", edgeId: e2.id, eventTypeId: pub.id });
  viewX = 0; viewY = 0; viewZoom = 1;
};
const SNAP = () => JSON.stringify({ d: serializeProject(), undo: undoStack.length, redo: redoStack.length, steps: JSON.stringify(P().scenarios) });
const RESIDUE = () => ({
  status: scStatus, raf: scRafId, playback: scPlayback, presenting, body: document.body.classList.contains("presenting"),
  propTab: document.getElementById("tabProperties").disabled,
});

(async () => {
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(shots, n + ".png") });
  const phase = () => page.evaluate(() => presentPhase());
  const waitPhase = (p, timeout = 30000) => page.waitForFunction((p) => presentPhase() === p, p, { timeout });
  try {
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.waitForFunction(() => typeof newNode === "function");

    /* ───────── 1. Sin Historia: no se crea ninguna ───────── */
    await page.evaluate(() => { P().nodes = []; P().edges = []; P().scenarios = []; const n = newNode("rect", 300, 200); n.label = "Solo"; });
    const before0 = await page.evaluate(SNAP);
    await page.locator("#btnPresent").click();
    assert.equal(await page.evaluate(() => P().scenarios.length), 0, "Present no crea Scenario");
    assert.equal(await page.locator("#psPlay").isVisible(), false, "sin Historia no hay Reproducir");
    assert.equal(await page.locator("#presentStory").isVisible(), false);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => presenting), false);
    assert.equal(await page.evaluate(SNAP), before0);

    /* ───────── 2. Cliente → Comercio ───────── */
    await page.evaluate(FIXTURE_PAGO);
    const before = await page.evaluate(SNAP);
    await page.locator("#btnPresent").click();
    await page.waitForFunction(() => presenting);
    assert.equal(await phase(), "ready");
    await page.waitForTimeout(150);
    assert.equal(await page.locator("body > header").first().isVisible(), false, "editor oculto");
    assert.equal(await page.locator("aside").isVisible(), false);
    assert.equal(await page.locator("#psPlay").isVisible(), true);
    assert.equal(await page.locator("#psStop").isVisible(), false);
    assert.equal(await page.locator("#prExit").innerText(), "✕ Salir");
    assert.match(await page.locator("#psTitle").innerText(), /Compra/);
    /* sin scroll horizontal y el diagrama cabe en la escena */
    const fit = await page.evaluate(() => {
      const r = document.getElementById("wrap").getBoundingClientRect(), b = getBounds();
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        l: b.x * viewZoom + viewX, rt: (b.x + b.w) * viewZoom + viewX, t: b.y * viewZoom + viewY, bt: (b.y + b.h) * viewZoom + viewY, w: r.width, h: r.height };
    });
    assert.ok(fit.sw <= fit.cw, "sin scroll horizontal");
    assert.ok(fit.l >= 0 && fit.rt <= fit.w && fit.t >= 70 && fit.bt <= fit.h - 70, "diagrama centrado con margen: " + JSON.stringify(fit));
    await shot("01-ready-1366");

    await page.locator("#psPlay").click();
    await waitPhase("playing");
    assert.equal(await page.locator("#psStop").isVisible(), true);
    assert.equal(await page.locator("#psPlay").isVisible(), false);
    /* el panel del editor no cambió de pestaña */
    assert.equal(await page.evaluate(() => document.getElementById("tabScenarios").classList.contains("active")), false);
    await page.waitForFunction(() => scPlayback && scPlayback.activeSends.length > 0, null, { timeout: 5000 });
    await page.waitForTimeout(400);
    await shot("02-playing-token-1366");
    /* símbolo del Evento viaja por la conexión (render existente) */
    const tokenSeen = await page.evaluate(() => scPlayback.activeSends.some((s) => s.token === "💵"));
    assert.ok(tokenSeen, "token 💵 en la partícula");
    /* simultaneidad: los dos «Pago recibido» arrancan juntos, el progreso llega al final */
    await page.waitForFunction(() => scPlayback.activeNodeEffects.length >= 2, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => scPlayback.activeNodeEffects.map((f) => f.nodeId).sort().join()), await page.evaluate(() => P().nodes.map((n) => n.id).sort().join()));
    await shot("03-simultaneo-1366");
    assert.equal(await page.locator("#psDots .psDot").count(), 2);
    await waitPhase("finished");
    assert.equal(await page.locator("#psCaption").innerText(), "Reproducción terminada");
    assert.equal(await page.locator("#psSummary").innerText(), "");
    assert.equal(await page.locator("#psPlay").innerText(), "↻ Repetir");
    assert.equal(await page.locator("#psEdit").isVisible(), true);
    await shot("04-finished-1366");

    /* Repetir */
    await page.locator("#psPlay").click();
    await waitPhase("playing");
    await page.waitForTimeout(500);
    /* Stop → vuelve a Present, sin residuos */
    await page.locator("#psStop").click();
    assert.equal(await phase(), "ready");
    let r = await page.evaluate(RESIDUE);
    assert.equal(r.status, "idle"); assert.equal(r.raf, null); assert.equal(r.playback, null); assert.equal(r.presenting, true); assert.equal(r.propTab, false);
    /* salir durante la reproducción */
    await page.locator("#psPlay").click();
    await waitPhase("playing");
    await page.waitForTimeout(300);
    await page.locator("#prExit").click();
    r = await page.evaluate(RESIDUE);
    assert.equal(r.presenting, false); assert.equal(r.body, false); assert.equal(r.status, "idle"); assert.equal(r.raf, null); assert.equal(r.playback, null); assert.equal(r.propTab, false);
    assert.equal(await page.evaluate(SNAP), before, "documento, Steps y undo intactos");

    /* Volver a editar tras terminar */
    await page.locator("#btnPresent").click();
    await page.keyboard.press(" ");
    await waitPhase("playing");
    await waitPhase("finished");
    await page.locator("#psEdit").click();
    r = await page.evaluate(RESIDUE);
    assert.equal(r.presenting, false); assert.equal(r.status, "idle"); assert.equal(r.raf, null);
    assert.equal(await page.evaluate(SNAP), before);
    /* Esc durante la reproducción: detiene (no sale); un segundo Esc sale */
    await page.locator("#btnPresent").click();
    await page.keyboard.press("Enter");
    await waitPhase("playing");
    await page.keyboard.press("Escape");
    assert.equal(await phase(), "ready"); assert.equal(await page.evaluate(() => presenting), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => presenting), false);

    /* ───────── 3. Producer → Kafka → Consumer (consecuencia de indisponibilidad) ───────── */
    await page.evaluate(FIXTURE_KAFKA);
    const beforeK = await page.evaluate(SNAP);
    await page.locator("#btnPresent").click();
    await page.locator("#psPlay").click();
    await page.waitForFunction(() => /no está disponible/.test(document.getElementById("psCaption").textContent), null, { timeout: 15000 });
    const caption = await page.locator("#psCaption").innerText();
    assert.match(caption, /Kafka no está disponible/);
    assert.doesNotMatch(caption, /target_down|SEND|DOWN|UP|source_down/);
    await shot("05-kafka-down-1366");
    await waitPhase("finished");
    assert.equal(await page.locator("#psCaption").innerText(), "Reproducción terminada");
    assert.equal(await page.locator("#psSummary").innerText(), "2 eventos no pudieron realizarse");
    await shot("06-kafka-finished-1366");
    await page.locator("#psEdit").click();
    assert.equal(await page.evaluate(SNAP), beforeK);

    /* ───────── 4. Viewports ───────── */
    await page.evaluate(FIXTURE_PAGO);
    for (const [w, h] of [[1366, 768], [1920, 1080], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.locator("#btnPresent").click();
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const bar = document.getElementById("presentBar").getBoundingClientRect(), st = document.getElementById("presentStory").getBoundingClientRect();
        const b = getBounds(), r = document.getElementById("wrap").getBoundingClientRect();
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bar: [bar.left, bar.right, bar.top, bar.bottom], st: [st.left, st.right, st.top, st.bottom],
          vw: innerWidth, vh: innerHeight, dl: b.x * viewZoom + viewX, dr: (b.x + b.w) * viewZoom + viewX, dt: b.y * viewZoom + viewY, db: (b.y + b.h) * viewZoom + viewY, ww: r.width };
      });
      assert.ok(m.sw <= m.cw, `${w}x${h}: scroll horizontal`);
      assert.ok(m.bar[0] >= 0 && m.bar[1] <= m.vw && m.bar[3] <= m.vh, `${w}x${h}: barra dentro del viewport ${m.bar}`);
      assert.ok(m.st[0] >= 0 && m.st[1] <= m.vw && m.st[2] >= 0, `${w}x${h}: encabezado dentro`);
      assert.ok(m.dl >= 0 && m.dr <= m.ww, `${w}x${h}: diagrama visible horizontalmente ${m.dl},${m.dr}`);
      assert.ok(m.db <= m.bar[2] + 1 && m.dt >= m.st[3] - 1, `${w}x${h}: diagrama no tapado por barra/encabezado ${JSON.stringify(m)}`);
      assert.equal(await page.locator("#psPlay").isVisible(), true);
      assert.equal(await page.locator("#prExit").isVisible(), true);
      await shot(`07-ready-${w}x${h}`);
      await page.locator("#psPlay").click();
      await waitPhase("playing");
      await page.waitForTimeout(700);
      await shot(`08-playing-${w}x${h}`);
      await page.locator("#psStop").click();
      await page.locator("#prExit").click();
    }
    await page.setViewportSize({ width: 1366, height: 768 });

    /* ───────── 5. Documento antiguo sin motion/visualDuration ───────── */
    await page.evaluate(() => {
      for (const et of doc.eventTypes) { delete et.motion; if (et.presentation) delete et.presentation; }
    });
    await page.locator("#btnPresent").click();
    await page.locator("#psPlay").click();
    await waitPhase("finished");
    await page.locator("#prExit").click();

    assert.deepEqual(errors, [], "sin errores de página");
    console.log("FLUYO-013 browser smoke OK — capturas en " + shots);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
