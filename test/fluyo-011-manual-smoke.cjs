"use strict";
/* FLUYO-011 — Manual Playback Review (browser smoke).
   Requiere Playwright y Chrome. NODE_PATH debe incluir playwright.
   Capturas en %TEMP%/fluyo-011-manual-*. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-011-manual-"));
const screenshot = async (page, name) => page.screenshot({ path: path.join(artifacts, name + ".png") });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function cleanState(page) {
  await page.evaluate(() => {
    const d = document.getElementById("scEventDialog");
    if (d && d.open) d.close();
    if (typeof scReset === "function" && (scStatus === "running" || scStatus === "completed")) scReset();
    if (typeof scCancelPlacement === "function") scCancelPlacement();
    if (scActiveScenario()) { scActiveScenario().steps = []; }
    scCommit();
  });
}

async function pickSegmented(page, name, value) {
  /* FLUYO-015: la velocidad (scMotion) vive en «Más detalles», cerrado por defecto. */
  if (name === "scMotion") await page.evaluate(() => document.getElementById("scFlowMore")?.setAttribute("open", ""));
  await page.locator(`.scSegmented label:has(input[name=${name}][value=${value}]) span`).click();
}
async function pickChoice(page, name, value) {
  await page.locator(`.scChoiceStack label:has(input[name=${name}][value=${value}])`).first().click();
}
async function toggleEffect(page, id) {
  await page.locator(`label.scEffectChip:has(#${id})`).click();
}
async function setColor(page, containerId, color) {
  const sw = page.locator(`#${containerId} .scSwatch[title="${color}"]`);
  if (await sw.count()) await sw.click();
  else await page.locator(`#${containerId} + input[type=color]`).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, color);
}
async function createEvent(page, { name, kind = "connection", sentence, symbol, consequence, effects, motion }) {
  await page.evaluate(() => { const d = document.getElementById("scEventDialog"); if (d && d.open) d.close(); });
  await page.locator("#scEventNew").click();
  await page.locator("#scEventName").fill(name);
  if (kind === "element") await pickSegmented(page, "scWhere", "element");
  if (consequence) {
    await page.locator("#scBehavior").evaluate((el) => { el.hidden = false; el.open = true; });
    await pickChoice(page, "scConsequence", consequence);
  }
  if (effects) {
    await page.locator("#scAppearance").evaluate((el) => { el.hidden = false; el.open = true; });
    if (effects.showSymbol) await toggleEffect(page, "scShowSymbol");
    if (effects.message) {
      await toggleEffect(page, "scUseMessage");
      await page.locator("#scMessage").fill(effects.message);
    }
    if (effects.dim) await toggleEffect(page, "scDim");
    if (effects.highlight) await toggleEffect(page, "scHighlight");
    if (effects.fill) {
      await toggleEffect(page, "scUseFill");
      await setColor(page, "scFillSwatches", effects.fill);
    }
    if (effects.blink) await toggleEffect(page, "scBlink");
  }
  await page.locator(".scPhraseText").nth(1).fill(sentence);
  const preset = page.getByRole("button", { name: "Usar símbolo " + symbol, exact: true });
  if (await preset.count() > 0) await preset.click();
  else {
    await page.locator("#scCustomVisual").evaluate((el) => { el.hidden = false; });
    await page.locator("#scEventVisual").fill(symbol);
    await page.locator("#scEventVisual").dispatchEvent("input");
  }
  if (motion) await pickSegmented(page, "scMotion", motion);
  await page.locator("#scEventSave").click();
  await page.waitForFunction(() => !document.getElementById("scEventDialog").open);
}

async function newRect(page, x, y, label) {
  return page.evaluate(({ x, y, label }) => {
    const n = newNode("rect", x, y);
    n.label = label;
    return n.id;
  }, { x, y, label });
}

async function newEdge(page, a, b) {
  return page.evaluate(({ a, b }) => newEdge(a, b).id, { a, b });
}

async function pointOnNode(page, index) {
  return page.evaluate(({ index }) => {
    const r = cv.getBoundingClientRect();
    const n = P().nodes[index];
    return { x: r.left + n.x * viewZoom + viewX, y: r.top + n.y * viewZoom + viewY };
  }, { index });
}

async function pointOnEdge(page, index) {
  return page.evaluate(({ index }) => {
    const r = cv.getBoundingClientRect();
    const edge = P().edges[index],
      pts = edgePoints(edge);
    for (let i = 1; i < pts.length; i++) {
      for (const u of [0.5, 0.25, 0.75]) {
        const q = {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u,
        };
        if (!hitNode(q.x, q.y) && scEdgeCandidates(q.x, q.y).length === 1) {
          return { x: r.left + q.x * viewZoom + viewX, y: r.top + q.y * viewZoom + viewY };
        }
      }
    }
    throw Error("No hay punto inequívoco para el fixture");
  }, { index });
}

async function placeButton(page, name) {
  return page.getByRole("button", { name: new RegExp("^" + name + ": colocar en") });
}

test("Manual Playback Review — Pago / Despacho / concurrente / clear page", async (t) => {
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
  page.on("dialog", async (dialog) => {
    if (dialog.message().includes("Limpiar página")) await dialog.accept();
    else await dialog.dismiss();
  });

  try {
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.waitForFunction(() => typeof newNode === "function");

    await page.evaluate(() => {
      P().nodes = [];
      P().edges = [];
      P().scenarios = [];
      P().behaviors = [];
      doc.eventTypes = [];
      viewX = 0;
      viewY = 0;
      viewZoom = 1;
    });
    await page.locator("#tabScenarios").click();
    await page.locator("#scEmptyState").getByRole("button", { name: "Crear escenario" }).click();

    const cliente = await newRect(page, 190, 260, "Cliente");
    const comercio = await newRect(page, 570, 260, "Comercio");
    const bodega = await newRect(page, 190, 420, "Bodega");
    const ledger = await newRect(page, 570, 420, "Ledger");
    await newEdge(page, cliente, comercio);
    await newEdge(page, bodega, cliente);
    await newEdge(page, cliente, ledger);

    await t.test("H1+H2 — Pago 💵 sobre Cliente → Comercio", async () => {
      await createEvent(page, { name: "Pago", sentence: " paga a ", symbol: "💵", motion: "normal" });
      const p = await pointOnEdge(page, 0);
      const btn = await placeButton(page, "Pago");
      const box = await btn.boundingBox();
      await page.mouse.move(box.x + 30, box.y + 15);
      await page.mouse.down();
      await page.mouse.move(p.x, p.y, { steps: 12 });
      await page.mouse.up();

      const story = await page.locator("#scStoryboard").innerText();
      assert.match(story, /💵/);
      assert.match(story, /Pago/);
      assert.match(story, /Cliente paga a Comercio/);

      await page.locator("#scRun").click();
      await sleep(300);
      const token = await page.evaluate(() => scPlayback && scPlayback.activeSends[0] && scPlayback.activeSends[0].token);
      assert.equal(token, "💵", "El playback debe usar el token 💵, no un punto genérico");
      await screenshot(page, "h2-pago-playback");
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      const final = await page.locator("#scStoryboard").innerText();
      assert.match(final, /✓/);
      assert.match(final, /💵 Pago/);
      assert.match(final, /Cliente paga a Comercio/);
      await page.locator("#scReset").click();
    });

    await t.test("H3 — Velocidades Rápido / Normal / Lento", async () => {
      await cleanState(page);
      await createEvent(page, { name: "Rápido", sentence: " va a ", symbol: "📨", motion: "fast" });
      await createEvent(page, { name: "Lento", sentence: " llega a ", symbol: "👤", motion: "slow" });
      const ids = await page.evaluate(() => doc.eventTypes.map((e) => ({ id: e.id, name: e.name, motion: e.motion })));
      const rapido = ids.find((e) => e.name === "Rápido");
      const lento = ids.find((e) => e.name === "Lento");
      const p0 = await pointOnEdge(page, 0);
      const p2 = await pointOnEdge(page, 2);
      await (await placeButton(page, "Rápido")).click();
      await page.mouse.click(p0.x, p0.y);
      await (await placeButton(page, "Lento")).click();
      await page.mouse.click(p2.x, p2.y);
      await page.evaluate(({ rapido, lento }) => {
        scActiveScenario().steps.find((s) => s.eventTypeId === rapido).at = 0;
        scActiveScenario().steps.find((s) => s.eventTypeId === lento).at = 0;
      }, { rapido: rapido.id, lento: lento.id });
      await page.locator("#scRun").click();
      await sleep(100);
      const durations = await page.evaluate(() => scPlayback.activeSends.map((s) => s.duration));
      assert.ok(durations.includes(500), "Rápido debe durar ~500 ms");
      assert.ok(durations.includes(1800), "Lento debe durar ~1800 ms");
      await screenshot(page, "h3-velocidades");
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      await page.locator("#scReset").click();
    });

    await t.test("H4 — Despacho 📦", async () => {
      await cleanState(page);
      await createEvent(page, { name: "Despacho", sentence: " envía a ", symbol: "📦", motion: "normal" });
      const p = await pointOnEdge(page, 1);
      await (await placeButton(page, "Despacho")).click();
      await page.mouse.click(p.x, p.y);
      await page.locator("#scRun").click();
      await sleep(300);
      const token = await page.evaluate(() => scPlayback.activeSends[0].token);
      assert.equal(token, "📦");
      await screenshot(page, "h4-despacho");
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      await page.locator("#scReset").click();
    });

    await t.test("H5 — Concurrente 💵 y 📦", async () => {
      await cleanState(page);
      const pago = (await page.evaluate(() => doc.eventTypes.find((e) => e.name === "Pago").id));
      const despacho = (await page.evaluate(() => doc.eventTypes.find((e) => e.name === "Despacho").id));
      const p0 = await pointOnEdge(page, 0);
      const p1 = await pointOnEdge(page, 1);
      await (await placeButton(page, "Pago")).click();
      await page.mouse.click(p0.x, p0.y);
      await (await placeButton(page, "Despacho")).click();
      await page.mouse.click(p1.x, p1.y);
      await page.evaluate(({ pago, despacho }) => {
        scActiveScenario().steps.find((s) => s.eventTypeId === pago).at = 0;
        scActiveScenario().steps.find((s) => s.eventTypeId === despacho).at = 0;
      }, { pago, despacho });
      await page.locator("#scRun").click();
      await sleep(400);
      const tokens = (await page.evaluate(() => scPlayback.activeSends.map((s) => s.token).sort())).join(",");
      assert.equal(tokens, "💵,📦");
      await screenshot(page, "h5-concurrente");
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      await page.locator("#scReset").click();
    });

    await t.test("H6 — Fallo por destino no disponible", async () => {
      await cleanState(page);
      await page.evaluate(() => {
        P().behaviors.push({ nodeId: P().nodes.find((n) => n.label === "Comercio").id, initialState: "DOWN" });
        scCommit();
      });
      const p = await pointOnEdge(page, 0);
      await (await placeButton(page, "Pago")).click();
      await page.mouse.click(p.x, p.y);
      await page.locator("#scRun").click();
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      const story = await page.locator("#scStoryboard").innerText();
      assert.match(story, /✕/);
      assert.match(story, /💵 Pago/);
      assert.match(story, /Comercio no está disponible/);
      await screenshot(page, "h6-fallo");
      await page.locator("#scReset").click();
    });

    await t.test("H7 — Limpiar página conserva EventTypes y undo restaura", async () => {
      await cleanState(page);
      const before = await page.evaluate(() => ({
        nodes: P().nodes.length,
        edges: P().edges.length,
        scenarios: P().scenarios.length,
        eventTypes: doc.eventTypes.length,
      }));
      assert.ok(before.nodes > 0 && before.scenarios > 0 && before.eventTypes > 0);
      await page.locator("#btnClear").click();
      const after = await page.evaluate(() => ({
        nodes: P().nodes.length,
        edges: P().edges.length,
        scenarios: P().scenarios.length,
        eventTypes: doc.eventTypes.length,
      }));
      assert.equal(after.nodes, 0);
      assert.equal(after.edges, 0);
      assert.equal(after.scenarios, 0);
      assert.ok(after.eventTypes > 0, "Los EventTypes del proyecto se conservan");
      await page.keyboard.press("Control+z");
      const restored = await page.evaluate(() => ({
        nodes: P().nodes.length,
        edges: P().edges.length,
        scenarios: P().scenarios.length,
        eventTypes: doc.eventTypes.length,
      }));
      assert.equal(restored.nodes, before.nodes);
      assert.equal(restored.edges, before.edges);
      assert.equal(restored.scenarios, before.scenarios);
      assert.equal(restored.eventTypes, before.eventTypes);
      await screenshot(page, "h7-clear-undo");
    });

    await t.test("H8 — Auto-crear Scenario al aplicar evento", async () => {
      await page.evaluate(() => {
        P().scenarios = [];
        scActiveId = null;
        scCommit();
      });
      assert.equal(await page.evaluate(() => P().scenarios.length), 0);
      await createEvent(page, { name: "Auto", sentence: " viaja a ", symbol: "📨", motion: "normal" });
      const p = await pointOnEdge(page, 0);
      await (await placeButton(page, "Auto")).click();
      await page.mouse.click(p.x, p.y);
      const after = await page.evaluate(() => ({
        scenarios: P().scenarios.length,
        steps: scActiveScenario().steps.length,
        name: scActiveScenario().name,
      }));
      assert.equal(after.scenarios, 1);
      assert.equal(after.steps, 1);
      assert.match(after.name, /Escenario/);
      assert.match(await page.locator("#scStoryboard").innerText(), /Auto/);
      await page.keyboard.press("Control+z");
      assert.equal(await page.evaluate(() => P().scenarios.length), 0);
      await screenshot(page, "h8-auto-scenario");
    });

    await t.test("H9 — Editar Evento usado sin reconstruir Historia", async () => {
      await page.evaluate(() => {
        P().scenarios = [];
        scActiveId = null;
        scCommit();
      });
      await createEvent(page, { name: "Transferencia", sentence: " envía a ", symbol: "💵", motion: "normal" });
      const p0 = await pointOnEdge(page, 0);
      const p1 = await pointOnEdge(page, 1);
      await (await placeButton(page, "Transferencia")).click();
      await page.mouse.click(p0.x, p0.y);
      await (await placeButton(page, "Transferencia")).click();
      await page.mouse.click(p1.x, p1.y);
      const before = await page.evaluate(() => JSON.stringify(scActiveScenario().steps));
      await page.locator(".scEventRow").filter({ hasText: "Transferencia" }).locator(".scMore").click();
      await page.getByRole("button", { name: "Editar evento", exact: true }).click();
      await page.locator("#scEventName").fill("Pago internacional");
      await page.locator(".scPhraseText").nth(1).fill(" transfiere a ");
      await page.locator("#scCustomVisual").evaluate((el) => { el.hidden = false; });
      await page.locator("#scEventVisual").fill("💳");
      await page.locator("#scEventVisual").dispatchEvent("input");
      await page.locator("#scEventSave").click();
      await page.waitForFunction(() => !document.getElementById("scEventDialog").open);
      assert.equal(await page.evaluate(() => JSON.stringify(scActiveScenario().steps)), before);
      const story = await page.locator("#scStoryboard").innerText();
      assert.match(story, /Pago internacional/);
      assert.match(story, /transfiere a/);
      assert.match(story, /💳/);
      await screenshot(page, "h9-edit-used");
    });

    await t.test("H10 — Evento en elemento: Incidente visual", async () => {
      await cleanState(page);
      await createEvent(page, {
        name: "Incidente",
        kind: "element",
        sentence: " reporta un problema",
        symbol: "⚠",
        effects: { showSymbol: true, message: "Fuera de servicio", dim: true, highlight: true },
      });
      const n = await pointOnNode(page, 1);
      await (await placeButton(page, "Incidente")).click();
      await page.mouse.click(n.x, n.y);
      await page.locator("#scRun").click();
      await sleep(200);
      const fx = await page.evaluate(() => scPlayback.activeNodeEffects.length);
      assert.ok(fx > 0, "Debe haber efectos de nodo activos");
      await screenshot(page, "h10-incidente");
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      await page.locator("#scReset").click();
    });

    await t.test("H11 — Caída cambia consecuencia y bloquea FLOW", async () => {
      await cleanState(page);
      await createEvent(page, {
        name: "Caída",
        kind: "element",
        sentence: " se cae",
        symbol: "⚠",
        consequence: "down",
        effects: { showSymbol: true, message: "Fuera de servicio", dim: true },
      });
      const n = await pointOnNode(page, 1);
      await (await placeButton(page, "Caída")).click();
      await page.mouse.click(n.x, n.y);
      const p = await pointOnEdge(page, 0);
      await (await placeButton(page, "Pago")).click();
      await page.mouse.click(p.x, p.y);
      await page.locator("#scRun").click();
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      const story = await page.locator("#scStoryboard").innerText();
      assert.match(story, /✕/);
      assert.match(story, /Comercio no está disponible/);
      assert.doesNotMatch(story, /DOWN/);
      await screenshot(page, "h11-caida");
      await page.locator("#scReset").click();
    });

    await t.test("H12 — Success cue no deja badge permanente", async () => {
      await cleanState(page);
      const p = await pointOnEdge(page, 0);
      await (await placeButton(page, "Pago")).click();
      await page.mouse.click(p.x, p.y);
      await page.locator("#scRun").click();
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      const painted = await page.evaluate(() => {
        const texts = [];
        const orig = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { texts.push(String(text)); return orig.call(this, text, ...args); };
        requestAnimationFrame(() => {});
        CanvasRenderingContext2D.prototype.fillText = orig;
        return texts;
      });
      assert.doesNotMatch(painted.join(" "), /✓.*Comercio|No disponible/);
      await screenshot(page, "h12-success-clean");
      await page.locator("#scReset").click();
    });

    console.log("MANUAL SMOKE CAPTURAS:", artifacts);
  } finally {
    await browser.close();
  }
});
