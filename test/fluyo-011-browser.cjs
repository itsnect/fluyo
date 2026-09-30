"use strict";
/* FLUYO-011: contratos de interacción en Chrome real. Capturas fuera del repo.
   NODE_PATH debe incluir Playwright; FLUYO_BROWSER por defecto chrome. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-011-"));
test("FLUYO-011 — composición, accesibilidad y responsive en Chrome", async (t) => {
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const screenshot = async (name) => page.screenshot({ path: path.join(artifacts, name + ".png") });
  const evId = async (name) => page.evaluate((name) => doc.eventTypes.find((e) => e.name === name).id, name);
  const count = () => page.evaluate(() => scActiveScenario().steps.length);
  const placeButton = (name) => page.getByRole("button", { name: new RegExp("^" + name + ": colocar en") });
  const point = async (kind, index) =>
    page.evaluate(
      ({ kind, index }) => {
        const r = cv.getBoundingClientRect();
        let p;
        if (kind === "node") p = P().nodes[index];
        else {
          const edge = P().edges[index],
            pts = edgePoints(edge);
          for (let i = 1; i < pts.length && !p; i++) {
            for (const u of [0.5, 0.25, 0.75]) {
              const q = {
                x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u,
                y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u,
              };
              if (!hitNode(q.x, q.y) && scEdgeCandidates(q.x, q.y).length === 1) {
                p = q;
                break;
              }
            }
          }
        }
        if (!p) throw Error("No hay punto inequívoco para el fixture");
        return { x: r.left + p.x * viewZoom + viewX, y: r.top + p.y * viewZoom + viewY };
      },
      { kind, index },
    );
  const pickSegmented = (name, value) => page.locator(`.scSegmented label:has(input[name=${name}][value=${value}]) span`).click();
  const pickChoice = (name, value) => page.locator(`.scChoiceStack label:has(input[name=${name}][value=${value}])`).first().click();
  const toggleEffect = (id) => page.locator(`label.scEffectChip:has(#${id})`).click();
  const setColor = async (containerId, color) => {
    const sw = page.locator(`#${containerId} .scSwatch[title="${color}"]`);
    if (await sw.count()) await sw.click();
    else await page.locator(`#${containerId} + input[type=color]`).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, color);
  };
  const create = async (name, kind, phrase, symbol, consequence, effects) => {
    await page.locator("#scEventNew").click();
    await page.locator("#scEventName").fill(name);
    if (kind === "element") await pickSegmented("scWhere", "element");
    if (consequence) {
      await page.locator("#scBehavior").evaluate((el) => { el.hidden = false; el.open = true; });
      await pickChoice("scConsequence", consequence);
    }
    if (effects) {
      await page.locator("#scAppearance").evaluate((el) => { el.hidden = false; el.open = true; });
      if (effects.showSymbol) await toggleEffect("scShowSymbol");
      if (effects.message) {
        await toggleEffect("scUseMessage");
        await page.locator("#scMessage").fill(effects.message);
      }
      if (effects.dim) await toggleEffect("scDim");
      if (effects.highlight) await toggleEffect("scHighlight");
      if (effects.fill) {
        await toggleEffect("scUseFill");
        await setColor("scFillSwatches", effects.fill);
      }
      if (effects.blink) await toggleEffect("scBlink");
    }
    await page
      .locator(".scPhraseText")
      .nth(kind === "element" ? 1 : 1)
      .fill(phrase);
    await page.getByRole("button", { name: "Usar símbolo " + symbol, exact: true }).click();
    assert.equal(await page.locator("#scEventDialog").getAttribute("open"), "");
    await page.locator("#scEventSave").click();
    await page.waitForFunction(() => !document.getElementById("scEventDialog").open);
  };
  try {
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.waitForFunction(() => typeof newNode === "function");
    await page.evaluate(() => {
      P().nodes = [];
      P().edges = [];
      P().scenarios = [];
      P().behaviors = [];
      doc.eventTypes = [];
      const a = newNode("rect", 190, 260),
        b = newNode("rect", 570, 120),
        c = newNode("rect", 570, 260),
        d = newNode("rect", 570, 400);
      a.label = "Cliente";
      b.label = "Comercio";
      c.label = "Ledger";
      d.label = "Auditoría";
      newEdge(a.id, b.id);
      newEdge(a.id, c.id);
      newEdge(a.id, d.id);
      viewX = 0;
      viewY = 0;
      viewZoom = 1;
    });
    await page.locator("#tabScenarios").click();
    await page.locator("#scEmptyState").getByRole("button", { name: "Crear escenario" }).click();
    await t.test("Vacío y arquitectura: biblioteca e historia; modal fuera del panel", async () => {
      assert.match(await page.locator("#scEventLibrary").innerText(), /Qué puede ocurrir/);
      await screenshot("01-vacio-1366");
      assert.equal(await page.locator("#panelScenarios dialog").count(), 0);
      assert.equal(await page.locator("#panelScenarios #scTraceLog").count(), 0);
      await page.locator("#scEventNew").click();
      await page.locator("#scEventName").fill("Pago");
      await page.locator(".scPhraseText").nth(1).fill(" paga a ");
      await page.getByRole("button", { name: "Usar símbolo 💵", exact: true }).click();
      assert.equal(await page.locator("#scEventPreview").innerText(), "Cliente paga a Comercio");
      assert.equal(await page.locator(".scPhraseChip").count(), 2);
      assert.doesNotMatch(
        await page.locator("#scEventDialog").innerText(),
        /\b(FLOW|OCCURRENCE|UP|DOWN|override)\b|\{source\}|\{target\}/,
      );
      await screenshot("02-editor-evento");
      await page.locator("#scPreviewPlay").click();
      assert.equal(await count(), 0);
      await page.locator("#scEventSave").click();
      assert.equal(await count(), 0);
      assert.equal(await page.locator(".scEventRow").count(), 1);
      await screenshot("03-biblioteca");
    });
    await t.test("Drag real: preview, compatibilidad y creación sobre conexión", async () => {
      const b = await placeButton("Pago").boundingBox(),
        p = await point("edge", 0);
      await page.mouse.move(b.x + 30, b.y + 15);
      await page.mouse.down();
      await page.mouse.move(p.x, p.y, { steps: 15 });
      assert.match(await page.locator(".scDragGhost").innerText(), /Cliente paga a Comercio/);
      assert.deepEqual(
        await page.evaluate(() => [
          scHighlight("node", P().nodes[0].id),
          scHighlight("edge", P().edges[0].id),
        ]),
        [0, 2],
      );
      await screenshot("04-arrastrando");
      await page.mouse.up();
      assert.equal(await count(), 1);
      assert.equal(await page.locator(".scDragGhost").count(), 0);
      assert.match(await page.locator("#scStoryboard").innerText(), /Cliente paga a Comercio/);
      await screenshot("05-historia");
    });
    await t.test("Drop vacío y targets incompatibles con selección previa; pan/zoom", async () => {
      await page.evaluate(() => {
        selE.add(P().edges[0].id);
        viewZoom = 0.85;
        viewX = 35;
        viewY = 10;
      });
      const c = await page.locator("#cv").boundingBox();
      let before = await count();
      const b = await placeButton("Pago").boundingBox();
      await page.mouse.move(b.x + 25, b.y + 15);
      await page.mouse.down();
      await page.mouse.move(c.x + 60, c.y + 40, { steps: 10 });
      await page.mouse.up();
      assert.equal(await count(), before);
      await placeButton("Pago").click();
      const n = await point("node", 0);
      await page.mouse.click(n.x, n.y);
      assert.equal(await count(), before);
      await placeButton("Pago").click();
      const p = await point("edge", 1);
      await page.mouse.click(p.x, p.y);
      assert.equal(await count(), before + 1);
      await page.evaluate(() => {
        clearSel();
        viewZoom = 1;
        viewX = 0;
        viewY = 0;
      });
    });
    await t.test(
      "Multi-target por menú: cancelar no modifica, confirmar conserva original y orden",
      async () => {
        await page.evaluate(() => {
          scActiveScenario().steps.splice(1);
          P().nodes[0].label = "Checkout";
          P().nodes[1].label = "Banco";
          scActiveScenario().name = "Pago simultáneo";
          scCommit();
        });
        await page.locator(".scStoryRow .scMore").first().click();
        await page.getByRole("button", { name: "Aplicar también a…", exact: true }).click();
        const p = await point("edge", 1);
        await page.mouse.click(p.x, p.y);
        await page.locator("#scPlacementCancel").click();
        assert.equal(await count(), 1);
        await page.locator(".scStoryRow .scMore").first().click();
        await page.getByRole("button", { name: "Aplicar también a…", exact: true }).click();
        await page.mouse.click(p.x, p.y);
        const q = await point("edge", 2);
        await page.mouse.click(q.x, q.y);
        assert.match(await page.locator("#scPlacementText").innerText(), /3 conexiones/);
        await page.locator("#scPlacementConfirm").click();
        const steps = await page.evaluate(() => scActiveScenario().steps);
        assert.equal(steps.length, 3);
        assert.equal(new Set(steps.map((s) => s.at)).size, 1);
        assert.equal(new Set(steps.map((s) => s.eventTypeId)).size, 1);
        assert.deepEqual(
          steps.map((s) => s.edgeId),
          await page.evaluate(() => P().edges.map((e) => e.id)),
        );
        assert.equal(await page.locator(".scStoryGroup").count(), 1);
        assert.equal(await page.locator(".scTogether").innerText(), "Al mismo tiempo");
        assert.doesNotMatch(await page.locator("#scStoryboard").innerText(), /0 s después/);
        await screenshot("06-simultaneidad");
      },
    );
    await t.test("Aprobación y Caída: creación humana, click-to-place y cancelación", async () => {
      await create("Aprobación", "element", " se aprueba", "✓");
      await create("Caída", "element", " se cae", "⚠", "down", { showSymbol: true, message: "Fuera de servicio", dim: true, highlight: true });
      await create("Recuperación", "element", " se recupera", "✓", "up");
      await page.evaluate(() => {
        P().nodes[1].label = "Solicitud";
        scCommit();
      });
      await placeButton("Aprobación").click();
      const n = await point("node", 1);
      await page.mouse.click(n.x, n.y);
      assert.match(await page.locator("#scStoryboard").innerText(), /Solicitud se aprueba/);
      const before = await count();
      await placeButton("Aprobación").click();
      const e = await point("edge", 2);
      await page.mouse.click(e.x, e.y);
      assert.equal(await count(), before);
      await placeButton("Caída").click();
      assert.equal(await page.evaluate(() => scHighlight("node", P().nodes[0].id)), 1);
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => scPlacement), null);
      const b = await placeButton("Pago").boundingBox();
      await page.mouse.move(b.x + 20, b.y + 15);
      await page.mouse.down();
      await page.mouse.move(e.x, e.y, { steps: 8 });
      await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointercancel")));
      await page.mouse.up();
      assert.equal(await page.locator(".scDragGhost").count(), 0);
      assert.equal(await count(), before);
    });
    await t.test("Tiempo de grupo, orden, otro evento simultáneo y undo/redo", async () => {
      await page.locator(".scDelay").nth(1).click();
      await page.getByRole("button", { name: "2 s", exact: true }).click();
      assert.equal(await page.evaluate(() => scActiveScenario().steps.at(-1).at), 2000);
      await page.locator(".scStoryRow .scMore").first().click();
      await page.getByRole("button", { name: "Añadir otro evento al mismo tiempo…", exact: true }).click();
      await placeButton("Aprobación").click();
      const p = await point("node", 2);
      await page.mouse.click(p.x, p.y);
      assert.equal(await page.evaluate(() => scActiveScenario().steps.at(-1).at), 0);
      assert.equal(await page.evaluate(() => scContext), null);
      await page.evaluate(() => scMoveStep(scActiveScenario().steps[0].id, 1));
      assert.equal(
        await page.evaluate(() => scActiveScenario().steps[1].edgeId),
        await page.evaluate(() => P().edges[0].id),
      );
      const before = await count();
      await page.locator(".scStoryRow .scMore").first().click();
      await page.getByRole("button", { name: "Quitar de esta historia", exact: true }).click();
      assert.equal(await count(), before - 1);
      assert.equal(await page.locator(".scEventRow").count(), 4);
      await page.keyboard.press("Control+z");
      assert.equal(await count(), before);
      await page.keyboard.press("Control+y");
      assert.equal(await count(), before - 1);
    });
    await t.test("Edición global, frase preservada y consecuencia bloqueada", async () => {
      const old = await page.evaluate(() => JSON.stringify(scActiveScenario().steps));
      await page.locator(".scEventRow").filter({ hasText: "Pago" }).locator(".scMore").click();
      await page.getByRole("button", { name: "Editar evento", exact: true }).click();
      assert.equal(await page.locator("#scEventScope").isVisible(), true);
      assert.equal(await page.locator("input[name=scWhere]").first().evaluate((el) => el.disabled), true);
      assert.equal(await page.locator("input[name=scConsequence]").first().evaluate((el) => el.disabled), true);
      assert.equal(await page.locator("#scShowSymbol").evaluate((el) => el.disabled), false);
      await page.locator(".scPhraseText").nth(1).fill(" abona a ");
      await page.locator("#scEventSave").click();
      assert.equal(await page.evaluate(() => JSON.stringify(scActiveScenario().steps)), old);
      assert.match(await page.locator("#scStoryboard").innerText(), /abona a/);
      await page.evaluate(() => {
        createEventType({
          name: "Frase especial",
          primitive: "FLOW",
          sentenceTemplate: "Antes: {target} recibe de {source}; {name} <seguro>",
          visual: { value: "●" },
        });
        scRenderEventLibrary();
      });
      await page.locator(".scEventRow").filter({ hasText: "Frase especial" }).locator(".scMore").click();
      await page.getByRole("button", { name: "Editar evento", exact: true }).click();
      await page.locator("#scEventSave").click();
      assert.equal(
        await page.evaluate(() => doc.eventTypes.find((e) => e.name === "Frase especial").sentenceTemplate),
        "Antes: {target} recibe de {source}; {name} <seguro>",
      );
    });
    await t.test("Playback caída/fallo/recuperación/éxito mantiene resultados", async () => {
      await page.evaluate(() => {
        scActiveScenario().steps = [];
        P().nodes[0].label = "Producer";
        P().nodes[1].label = "Kafka";
        scActiveScenario().name = "Caída y recuperación";
        const down = doc.eventTypes.find((e) => e.name === "Caída"),
          up = doc.eventTypes.find((e) => e.name === "Recuperación"),
          pay = createEventType({
            name: "Publicación",
            primitive: "FLOW",
            sentenceTemplate: "{source} publica en {target}",
            visual: { value: "📨" },
          });
        const node = P().nodes[1].id,
          edge = P().edges[0].id;
        createStep(scActiveScenario(), {
          at: 0,
          action: "SET_STATE",
          nodeId: node,
          state: "DOWN",
          eventTypeId: down.id,
        });
        createStep(scActiveScenario(), { at: 1000, action: "SEND", edgeId: edge, eventTypeId: pay.id });
        createStep(scActiveScenario(), {
          at: 5000,
          action: "SET_STATE",
          nodeId: node,
          state: "UP",
          eventTypeId: up.id,
        });
        createStep(scActiveScenario(), { at: 6000, action: "SEND", edgeId: edge, eventTypeId: pay.id });
        scCommit();
      });
      await page.evaluate(() => {
        window.__scenarioPaint = new Set();
        window.__originalFillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          window.__scenarioPaint.add(String(text));
          return window.__originalFillText.call(this, text, ...args);
        };
      });
      await page.locator("#scRun").click();
      // La partícula SEND normal dura 1100 ms; el detalle de fallo aparece tras ese cue visual.
      await page.waitForTimeout(2500);
      assert.equal(await page.locator("#scLibrarySection").isVisible(), false);
      assert.match(await page.locator("#scStoryboard").innerText(), /Kafka no está disponible/);
      const painted = await page.evaluate(() => [...window.__scenarioPaint]);
      assert.ok(painted.includes("Fuera de servicio"), "El mensaje del evento de nodo debe pintarse");
      assert.doesNotMatch(painted.join(" "), /No disponible|\b(UP|DOWN)\b|source down|target down/);
      await screenshot("07-playback");
      await page.waitForFunction(() => scStatus === "completed", {}, { timeout: 12000 });
      assert.equal(await page.locator(".scStatus_failed").count(), 1);
      assert.equal(await page.locator(".scStatus_success").count(), 1);
      assert.equal(await page.locator(".scStatus_completed").count(), 2);
      await screenshot("08-resultado");
      await page.evaluate(() => {
        CanvasRenderingContext2D.prototype.fillText = window.__originalFillText;
      });
      await page.locator("#scReset").click();
    });
    await t.test("1366, 1920, ventana baja y palette compacta operables", async () => {
      await page.evaluate(() => { if (typeof scReset === "function" && (scStatus === "running" || scStatus === "completed")) scReset(); });
      const fit = async () =>
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await fit();
      await screenshot("09-1366");
      await page.setViewportSize({ width: 1920, height: 1080 });
      await fit();
      await screenshot("10-1920");
      await page.setViewportSize({ width: 1000, height: 480 });
      await page.locator("#scEventNew").click();
      await pickSegmented("scWhere", "element");
      const bounds = await page.locator("#scEventSave").boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 480);
      assert.equal(
        await page
          .locator(".scDialogBody")
          .first()
          .evaluate((el) => el.scrollHeight > el.clientHeight),
        true,
      );
      await page.locator("#scEventDialog .scDialogBody").evaluate((el) => (el.scrollTop = el.scrollHeight));
      await screenshot("11-modal-bajo");
      await page.locator("#scEventCancel").click();
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.evaluate(() => {
        const a = document.querySelector("aside");
        a.style.width = "270px";
        a.style.flexBasis = "270px";
      });
      await page.waitForFunction(() =>
        document.getElementById("panelScenarios").classList.contains("scCompact"),
      );
      await page.locator("#scPaletteToggle").click();
      assert.equal(await page.locator("#scLibrarySection").isVisible(), true);
      await screenshot("12-compacto");
      await placeButton("Pago").click();
      assert.equal(await page.locator("#scLibrarySection").isVisible(), false);
      const p = await point("edge", 0);
      await page.mouse.click(p.x, p.y);
      assert.equal(await page.locator("#scPlacementBar").isVisible(), false);
      await fit();
    });
    await t.test("Ambigüedad, teclado, biblioteca extensa y eliminación sin cascada", async () => {
      await page.evaluate(() => {
        const a = document.querySelector("aside");
        a.style.width = "";
        a.style.flexBasis = "";
      });
      await page.waitForFunction(
        () => !document.getElementById("panelScenarios").classList.contains("scCompact"),
      );
      await page.evaluate(() => {
        P().edges[0].waypoints = [{ x: 390, y: 140 }];
        P().edges.push({ ...P().edges[0], id: P().nextId++ });
        clearSel();
      });
      const p = await page.evaluate(() => {
        const pts = edgePoints(P().edges[0]);
        let best = null;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1],
            b = pts[i],
            len = Math.hypot(b.x - a.x, b.y - a.y);
          if (!best || len > best.len) best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, len };
        }
        const r = cv.getBoundingClientRect();
        return { x: r.left + best.x * viewZoom + viewX, y: r.top + best.y * viewZoom + viewY };
      });
      const before = await count();
      await placeButton("Pago").click();
      await page.mouse.click(p.x, p.y);
      assert.equal(await count(), before);
      assert.equal(await page.locator("#scPopover").isVisible(), true);
      assert.ok((await page.locator("#scPopover button").count()) >= 2);
      await page.locator("#scPopover button").first().click();
      assert.equal(await count(), before + 1);
      await placeButton("Aprobación").focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      assert.equal(await count(), before + 2);
      assert.equal(await page.locator("#scPlacementBar").isVisible(), false);
      await page.evaluate(() => {
        for (let i = 0; i < 8; i++)
          createEventType({
            name: "Prueba " + i,
            primitive: "FLOW",
            sentenceTemplate: "{source} conecta con {target}",
            visual: { value: "●" },
          });
        scRenderEventLibrary();
      });
      assert.equal(await page.locator("#scEventSearch").isVisible(), true);
      await page.locator("#scEventSearch").fill("Pago");
      assert.equal(await page.locator(".scEventRow").count(), 1);
      assert.equal(await page.locator("#scEventNew").isVisible(), true);
      await page.locator(".scEventRow .scMore").click();
      await page.getByRole("button", { name: "Eliminar de la biblioteca", exact: true }).click();
      assert.match(await page.locator("#scPopover").innerText(), /se usa en/);
      await page.getByRole("button", { name: "Ver dónde se usa", exact: true }).click();
      assert.ok((await page.locator(".scUse").count()) > 0);
      await page.locator("#scDetailsDone").click();
      assert.equal(await count(), before + 2);
      await page.locator("#scEventSearch").fill("");
      await page.locator("#scScenarioMenu").click();
      await page.getByRole("button", { name: "Condiciones iniciales de esta página", exact: true }).click();
      assert.doesNotMatch(await page.locator("#scDetailsDialog").innerText(), /\b(UP|DOWN|override)\b/);
      await page.locator("#scDetailsDone").click();
    });
    assert.deepEqual(errors, []);
    console.log("CAPTURAS FLUYO-011: " + artifacts);
  } finally {
    await browser.close();
  }
});

// Upgrade real desde la caché del checkout anterior, sin modificar archivos servidos.
test("FLUYO-011 — Service Worker v45 → v52 sin assets antiguos", async () => {
  const http = require("node:http"),
    { execFileSync } = require("node:child_process");
  const files = [
    "sw.js",
    "index.html",
    "css/styles.css",
    "js/editor-scenarios.js",
    "js/interaction.js",
    "js/render.js",
    "js/ui.js",
  ];
  const previous = new Map(files.map((f) => [f, execFileSync("git", ["show", "HEAD:" + f], { cwd: root })]));
  const oldCache = /const CACHE = "([^"]+)"/.exec(previous.get("sw.js").toString())[1];
  const nextCache = /const CACHE = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8"))[1];
  assert.notEqual(oldCache, nextCache, "La versión de caché debe cambiar junto a los assets");
  let upgraded = false;
  const server = http.createServer((req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(1);
      if (!rel || rel.endsWith("/")) rel += "index.html";
      const f = path.resolve(root, rel);
      if (!f.startsWith(root + path.sep)) throw Error("Ruta inválida");
      const body = !upgraded && previous.has(rel) ? previous.get(rel) : fs.readFileSync(f);
      const ext = path.extname(f),
        type =
          ext === ".js"
            ? "application/javascript"
            : ext === ".html"
              ? "text/html"
              : ext === ".css"
                ? "text/css"
                : "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:" + server.address().port + "/");
    await page.evaluate(() => navigator.serviceWorker.register("./sw.js"));
    const waitForActivation = async (cacheName) => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const ready = await page.evaluate(async (cacheName) => {
          const keys = await caches.keys(),
            r = await navigator.serviceWorker.getRegistration();
          return (
            keys.length === 1 &&
            keys[0] === cacheName &&
            !r.installing &&
            !r.waiting &&
            r.active?.state === "activated" &&
            navigator.serviceWorker.controller === r.active
          );
        }, cacheName);
        if (ready) return;
        await page.waitForTimeout(100);
      }
      throw Error("No se activó y tomó control " + cacheName);
    };
    await waitForActivation(oldCache);
    await page.reload();
      assert.equal(await page.locator("#scAppearance").count(), 0);
      upgraded = true;
      await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        await r.update();
      });
      await waitForActivation(nextCache);
      await page.reload();
      await page.waitForFunction(() => typeof scBeginPlacement === "function");
      await page.evaluate(() => { document.getElementById("tabScenarios")?.click(); scOpenEventDialog(null); });
      await page.locator(`.scSegmented label:has(input[name=scWhere][value=element]) span`).click();
      assert.equal(await page.locator("#scAppearance").count(), 1);
      assert.equal(await page.locator("#scAppearance").evaluate((el) => el.hidden), false);
      assert.equal(await page.locator("#scPhrase").count(), 1);
      await page.evaluate(() => document.getElementById("scEventDialog")?.close());
    console.log("SW UPGRADE PASS: " + oldCache + " → " + nextCache);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
