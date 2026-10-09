"use strict";
/* FLUYO-016: Historias como entidad de primer nivel, en Chrome real
   (panel → Playback → Present → Share → Viewer, Undo/Redo, páginas, legacy, adversarial, responsive).
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-016-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-016-"));
fs.mkdirSync(shots, { recursive: true });
const currentCache = /const CACHE = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8"))[1];
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json" };

/* ───────────── Fixtures (se ejecutan dentro del editor real) ───────────── */
const RESET = `P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = []; doc.pages.length = 1; doc.cur = 0; undoStack.length = 0; redoStack.length = 0; scReset();`;
/* Cliente → Comercio → Almacén; tres Historias que reutilizan los mismos EventTypes. */
const TRES = `(() => { ${RESET}
  const a = newNode("rect", 160, 240), b = newNode("rect", 520, 240), w = newNode("rect", 880, 240);
  a.label = "Cliente"; b.label = "Comercio"; w.label = "Almacén";
  const e1 = newEdge(a.id, b.id), e2 = newEdge(b.id, w.id);
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
  const ped = createEventType({ name: "Pedido", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { value: "📦" } });
  const A = createScenario(P(), "Camino feliz");
  createStep(A, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
  createStep(A, { at: 1500, action: "SEND", edgeId: e2.id, eventTypeId: ped.id });
  const B = createScenario(P(), "Pago rechazado");
  createStep(B, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
  const C = createScenario(P(), "Cliente abandona");
  createStep(C, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
  createStep(C, { at: 800, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
  createStep(C, { at: 1600, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
  scSelectStory(A.id); scRenderPanel(); renderTabs();
})()`;
const VACIO = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 600, 240); a.label = "Cliente"; b.label = "Comercio"; newEdge(a.id, b.id);
  createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
  scSelectStory(null); scRenderPanel();
})()`;

(async () => {
  let serveOld = false;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL("http://x" + req.url); let rel = url.pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(root, "." + rel); assert.ok(file.startsWith(root + path.sep));
      let body = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const errors = [], umami = [];
  const newCtx = async (opts = {}) => {
    const c = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", ...opts });
    await c.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => { umami.push(r.request().url()); return r.abort(); });
    return c;
  };
  const watch = (p) => { p.on("pageerror", (e) => errors.push(e.message)); return p; };
  const results = [];
  const ok = (name) => { results.push(name); console.log("  ✔", name); };
  const shot = (p, name) => p.screenshot({ path: path.join(shots, name + ".png") });

  try {
    const ctx = await newCtx();
    const ed = watch(await ctx.newPage());
    let confirms = [];
    ed.on("dialog", async (d) => { confirms.push(d.message()); await d.accept(); });
    await ed.goto(base + "/");
    await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
    await ed.locator("#tabScenarios").click();

    const title = () => ed.locator("#scScenarioTitle").innerText();
    const names = () => ed.evaluate(() => P().scenarios.map((s) => s.name));
    const activeName = () => ed.evaluate(() => scActiveScenario() && scActiveScenario().name);
    const stepsCount = () => ed.evaluate(() => scActiveScenario() ? scActiveScenario().steps.length : -1);
    const status = () => ed.evaluate(() => scStatus);
    const menuItem = async (anchor, text) => { await ed.locator(anchor).click(); await ed.locator("#scPopover button", { hasText: text }).first().click(); };
    const undoCount = () => ed.evaluate(() => undoStack.length);
    const ctrl = async (k) => { await ed.locator("#wrap").focus().catch(() => {}); await ed.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await ed.keyboard.press("Control+" + k); };
    const noRemnants = () => ed.evaluate(() => scStatus === "idle" && scPlayback === null && buildScenarioRenderState() === null && scRafId === null);

    /* ───────── 1. Panel: etiqueta, vacío, crear inmediato, renombrar, duplicar, eliminar ───────── */
    await ed.evaluate(VACIO);
    assert.equal((await ed.locator("#scStoriesLabel").innerText()).toLowerCase(), "historias");
    assert.equal(await title(), "Sin historias ▾");
    assert.match(await ed.locator("#scEmptyState").innerText(), /Aún no hay historias/);
    assert.equal(await ed.locator("#scRun").isDisabled(), true);
    await ed.locator("#scStoryAdd").click();
    assert.equal(await title(), "Historia 1 ▾", "crear es inmediato: «Historia 1»");
    assert.equal(await ed.locator("dialog[open]").count(), 0, "sin modal para nombrar");
    await ed.locator("#scStoryAdd").click();
    assert.deepEqual(await names(), ["Historia 1", "Historia 2"]);
    assert.equal(await undoCount(), 2);
    await shot(ed, "01-panel-historias");
    /* renombrar desde ⋯ */
    await menuItem("#scScenarioMenu", "Renombrar");
    const input = ed.locator("#scPopover input");
    await input.fill("Pago exitoso"); await input.press("Enter");
    assert.equal(await title(), "Pago exitoso ▾");
    assert.deepEqual(await names(), ["Historia 1", "Pago exitoso"]);
    /* el menú ⋯ y el selector usan lenguaje de producto */
    await ed.locator("#scScenarioMenu").click();
    const menuText = await ed.locator("#scPopover").innerText();
    assert.match(menuText, /Renombrar[\s\S]*Duplicar historia[\s\S]*Eliminar historia/);
    assert.doesNotMatch(menuText, /scenario|escenario|step|engineVersion|ID/i);
    await ed.keyboard.press("Escape");
    await ed.locator("#scScenarioTitle").click();
    const selText = await ed.locator("#scPopover").innerText();
    assert.match(selText, /○ Historia 1/); assert.match(selText, /● Pago exitoso/); assert.match(selText, /\+ Nueva historia/);
    assert.doesNotMatch(selText, /scenario|escenario/i);
    await ed.keyboard.press("Escape");
    ok("panel: HISTORIAS, vacío, crear inmediato, renombrar, menús sin jerga");

    /* ───────── 2. Duplicar / eliminar / Undo / Redo (Ctrl+Z real) ───────── */
    await ed.evaluate(TRES);
    const idsBefore = await ed.evaluate(() => JSON.stringify(P().scenarios));
    await menuItem("#scScenarioMenu", "Duplicar historia");
    assert.equal(await title(), "Camino feliz copia ▾");
    assert.deepEqual(await names(), ["Camino feliz", "Camino feliz copia", "Pago rechazado", "Cliente abandona"]);
    assert.equal(await stepsCount(), 2);
    assert.equal(await undoCount(), 1, "duplicar = una operación");
    await ctrl("z");
    assert.equal(await ed.evaluate(() => JSON.stringify(P().scenarios)), idsBefore, "Ctrl+Z → exactamente el estado anterior");
    await ctrl("y");
    assert.equal((await names()).length, 4, "Ctrl+Y rehace la copia");
    await ctrl("z");
    /* eliminar B (con confirmación humana) */
    await ed.locator("#scScenarioTitle").click(); await ed.locator("#scPopover button", { hasText: "Pago rechazado" }).click();
    assert.equal(await title(), "Pago rechazado ▾");
    confirms = [];
    await menuItem("#scScenarioMenu", "Eliminar historia");
    assert.match(confirms[0], /¿Eliminar la historia «Pago rechazado»\?/);
    assert.doesNotMatch(confirms[0], /escenario|scenario/i);
    assert.deepEqual(await names(), ["Camino feliz", "Cliente abandona"]);
    assert.equal(await title(), "Cliente abandona ▾");
    await ctrl("z");
    assert.deepEqual(await names(), ["Camino feliz", "Pago rechazado", "Cliente abandona"], "Undo restaura la eliminada");
    await ctrl("y");
    assert.deepEqual(await names(), ["Camino feliz", "Cliente abandona"], "Redo vuelve a eliminarla");
    await ctrl("z");
    ok("duplicar y eliminar: una operación, selección correcta, Ctrl+Z/Ctrl+Y reales");

    /* ───────── 3. Cambiar de Historia sin tocar el documento base; storyboard por Historia ───────── */
    await ed.evaluate(TRES);
    const base0 = await ed.evaluate(() => JSON.stringify([P().nodes, P().edges, doc.eventTypes]));
    const u0 = await undoCount();
    for (const [n, steps] of [["Cliente abandona", 3], ["Pago rechazado", 1], ["Camino feliz", 2]]) {
      await ed.locator("#scScenarioTitle").click(); await ed.locator("#scPopover button", { hasText: n }).click();
      assert.equal(await title(), n + " ▾");
      assert.equal(await ed.locator("#scStoryboard .scStoryRow").count(), steps, n + ": su propio storyboard");
    }
    assert.equal(await ed.evaluate(() => JSON.stringify([P().nodes, P().edges, doc.eventTypes])), base0, "nodos, conexiones y EventTypes intactos");
    assert.equal(await undoCount(), u0, "cambiar de Historia no apunta nada al Undo");
    ok("cambiar de Historia: storyboard propio; documento base intacto; sin Undo");

    /* ───────── 4. Soltar un Evento con B activa lo añade a B; independencia ───────── */
    await ed.locator("#scScenarioTitle").click(); await ed.locator("#scPopover button", { hasText: "Pago rechazado" }).click();
    const before = await ed.evaluate(() => JSON.stringify(P().scenarios.map((s) => s.steps)));
    await ed.evaluate(() => { scApplyTargets(doc.eventTypes[1].id, [P().edges[1].id]); });
    const after = await ed.evaluate(() => P().scenarios.map((s) => s.steps.length));
    assert.deepEqual(after, [2, 2, 3], "sólo B ganó una aparición");
    assert.equal(await ed.evaluate(() => JSON.stringify(P().scenarios.filter((s) => s.name !== "Pago rechazado").map((s) => s.steps))), JSON.stringify(JSON.parse(before).filter((_, i) => i !== 1)));
    /* quitar de A (mismo EventType) no toca B */
    await ed.evaluate(() => scSwitchScenario(P().scenarios[0].id));
    await ed.evaluate(() => scDeleteStep(P().scenarios[0].steps[0].id));
    assert.deepEqual(await ed.evaluate(() => P().scenarios.map((s) => s.steps.length)), [1, 2, 3]);
    await ctrl("z"); await ctrl("z");
    assert.deepEqual(await ed.evaluate(() => P().scenarios.map((s) => s.steps.length)), [2, 1, 3]);
    ok("aparición en B nunca en A; quitar en A no toca B; Undo por operación");

    /* ───────── 5. Playback: sólo la activa; cambiar durante Playback limpia ───────── */
    await ed.evaluate(TRES);
    await ed.locator("#scRun").click();
    await ed.waitForFunction(() => scStatus === "running");
    const traceA = await ed.evaluate(() => JSON.stringify(scPlayback.trace));
    await ed.locator("#scScenarioTitle").click(); await ed.locator("#scPopover button", { hasText: "Pago rechazado" }).click();
    assert.equal(await noRemnants(), true, "sin restos de A al cambiar a B");
    assert.equal(await ed.locator("#scRun").isDisabled(), false);
    await ed.locator("#scRun").click();
    await ed.waitForFunction(() => scStatus === "running");
    assert.notEqual(await ed.evaluate(() => JSON.stringify(scPlayback.trace)), traceA, "B reproduce su propio Trace");
    assert.equal(await ed.evaluate(() => scPlayback.trace.events.length), await ed.evaluate(() => FluyoScenarios.runScenario({ nodes: P().nodes, edges: P().edges }, P().behaviors, P().scenarios[1]).trace.events.length));
    await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 15000 });
    await ed.locator("#scReset").click();
    assert.equal(await noRemnants(), true, "«Terminar» limpia (FLUYO-018.14b, B2)");
    ok("Run reproduce sólo la activa; cambiar durante Playback detiene y limpia; Reset");

    /* ───────── 6. Adversarial de Playback: duplicar, eliminar, nueva, abrir Share, página ───────── */
    for (const [name, act] of [
      ["duplicar", async () => menuItem("#scScenarioMenu", "Duplicar historia")],
      ["eliminar la activa", async () => menuItem("#scScenarioMenu", "Eliminar historia")],
      ["nueva", async () => ed.locator("#scStoryAdd").click()],
      ["renombrar", async () => { await menuItem("#scScenarioMenu", "Renombrar"); await ed.locator("#scPopover input").fill("Otro nombre"); await ed.locator("#scPopover input").press("Enter"); }],
    ]) {
      await ed.evaluate(TRES);
      await ed.locator("#scRun").click(); await ed.waitForFunction(() => scStatus === "running");
      await act();
      assert.equal(await noRemnants(), true, "playback detenido tras " + name);
    }
    await ed.evaluate(TRES);
    await ed.locator("#scRun").click(); await ed.waitForFunction(() => scStatus === "running");
    await ed.locator("#btnShare").click();
    assert.match(await ed.locator("#shareMessage").innerText(), /Detén la reproducción/);
    assert.equal(await ed.locator("#shareCreate").isVisible(), false);
    await ed.locator("#shareClose").click();
    await ed.evaluate(() => scReset());
    ok("Playback activo + duplicar / eliminar / nueva / renombrar: detenido y limpio; abrir Share: bloqueado sin efectos");

    /* ───────── 6b. FLUYO-016.1: Reproducir deshabilitado, ⋯ interruptor, Share bloqueado, «Detalles» ───────── */
    await ed.evaluate(VACIO);
    await ed.locator("#scStoryAdd").click();
    const runState = () => ed.locator("#scRun").evaluate((b) => ({ d: b.disabled, op: getComputedStyle(b).opacity, cur: getComputedStyle(b).cursor, t: b.title }));
    let rs = await runState();
    assert.equal(rs.d, true); assert.ok(+rs.op < 1, "se ve deshabilitado"); assert.equal(rs.cur, "not-allowed"); assert.match(rs.t, /Añade un evento/);
    await shot(ed, "06b-reproducir-deshabilitado");
    await ed.evaluate(() => scApplyTargets(doc.eventTypes[0].id, [P().edges[0].id]));
    rs = await runState(); assert.equal(rs.d, false); assert.equal(rs.op, "1"); assert.equal(rs.t, "");
    await ed.evaluate(() => { scDeleteStep(scActiveScenario().steps[0].id); scRenderPanel(); });
    assert.equal((await runState()).d, true, "sin momentos vuelve a disabled");
    const popOpen = () => ed.locator("#scPopover").evaluate((p) => !p.hidden);
    for (const btn of ["#scScenarioMenu", "#scScenarioTitle"]) {
      await ed.locator(btn).click(); assert.equal(await popOpen(), true);
      await ed.locator(btn).click(); assert.equal(await popOpen(), false, btn + ": segundo clic cierra");
      await ed.locator(btn).click(); assert.equal(await popOpen(), true);
      await ed.keyboard.press("Escape"); assert.equal(await popOpen(), false, "Escape");
      await ed.locator(btn).click(); await ed.mouse.click(300, 600); assert.equal(await popOpen(), false, "clic fuera");
      await ed.locator(btn).focus(); await ed.keyboard.press("Enter"); assert.equal(await popOpen(), true, "Enter abre");
      await ed.keyboard.press("Enter").catch(() => {}); await ed.keyboard.press("Escape"); assert.equal(await popOpen(), false);
    }
    /* un menú de acción sigue funcionando tras conmutar: Renombrar con Enter no reabre el ⋯ */
    await ed.locator("#scScenarioMenu").click(); await ed.locator("#scScenarioMenu").click();
    await menuItem("#scScenarioMenu", "Renombrar");
    await ed.locator("#scPopover input").fill("Tras interruptor"); await ed.locator("#scPopover input").press("Enter");
    assert.equal(await popOpen(), false); assert.equal(await title(), "Tras interruptor ▾");
    /* Share: bloqueado (no detiene, no modifica) mientras hay Playback; vuelve a funcionar después */
    await ed.evaluate(TRES);
    const shareDoc = await ed.evaluate(() => JSON.stringify(serializeProject()));
    await ed.locator("#scRun").click(); await ed.waitForFunction(() => scStatus === "running");
    await ed.locator("#btnShare").click();
    assert.match(await ed.locator("#shareMessage").innerText(), /Detén la reproducción/);
    assert.equal(await ed.locator("#shareCreate").isVisible(), false);
    assert.equal(await status(), "running", "abrir Share NO detiene el Playback");
    await ed.locator("#shareClose").click();
    assert.equal(await status(), "running");
    await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 15000 });
    await ed.locator("#btnShare").click();
    /* FLUYO-018.14b (B2): el Playback terminado se cierra con «Terminar»; «Volver a editar» es la salida del modo Historia */
    assert.match(await ed.locator("#shareMessage").innerText(), /Pulsa «Terminar» antes de compartir/);
    await ed.locator("#shareClose").click();
    await ed.locator("#scReset").click();
    assert.equal(await ed.evaluate(() => JSON.stringify(serializeProject())), shareDoc, "ni Playback ni abrir Share escriben en el documento");
    await ed.locator("#btnShare").click(); await ed.locator("#shareCreate").click();
    await ed.waitForFunction(() => document.getElementById("shareLink").value.startsWith("http"));
    await ed.locator("#shareClose").click();
    await ed.locator("#scRun").click(); await ed.waitForFunction(() => scStatus === "running"); await ed.locator("#scReset").click();
    /* «Detalles»: una sola denominación */
    await ed.locator("#scScenarioMenu").click();
    assert.match(await ed.locator("#scPopover").innerText(), /Detalles(?! t)/);
    await ed.locator("#scPopover button", { hasText: "Detalles" }).click();
    assert.equal(await ed.locator("#scDetailsTitle").innerText(), "Detalles");
    assert.doesNotMatch(await ed.locator("#scDetailsDialog").innerText(), /Trace|Scenario|técnic/i);
    await ed.locator("#scDetailsDone").click();
    ok("016.1: Reproducir disabled con ayuda, ⋯ interruptor, Share bloqueado en Playback, «Detalles»");

    /* ───────── 7. Multipágina ───────── */
    await ed.evaluate(TRES);
    await ed.evaluate(() => scSwitchScenario(P().scenarios[2].id));
    assert.equal(await title(), "Cliente abandona ▾");
    await ed.locator("#pagesBar button[title='Nueva página']").click();
    assert.equal(await ed.evaluate(() => doc.cur), 1);
    assert.equal(await title(), "Sin historias ▾", "la página nueva no hereda la Historia de la anterior");
    await ed.evaluate(() => { const p = P(); const x = newNode("rect", 200, 200), y = newNode("rect", 500, 200); x.label = "X"; y.label = "Y"; newEdge(x.id, y.id); });
    await ed.locator("#scStoryAdd").click(); await ed.locator("#scStoryAdd").click();
    assert.deepEqual(await names(), ["Historia 1", "Historia 2"]);
    assert.equal(await title(), "Historia 2 ▾");
    await ed.locator("#pagesBar .tab").nth(0).click();
    assert.equal(await ed.evaluate(() => doc.cur), 0);
    assert.equal(await title(), "Camino feliz ▾", "página 1: una Historia válida de ESA página");
    assert.equal(await ed.locator("#scStoryboard .scStoryRow").count(), 2);
    assert.deepEqual(await names(), ["Camino feliz", "Pago rechazado", "Cliente abandona"]);
    /* A reproduciéndose → cambiar de página */
    await ed.locator("#scRun").click(); await ed.waitForFunction(() => scStatus === "running");
    await ed.locator("#pagesBar .tab").nth(1).click();
    assert.equal(await noRemnants(), true);
    assert.equal(await title(), "Historia 1 ▾");
    await shot(ed, "02-pagina-2");
    await ed.locator("#pagesBar .tab").nth(0).click();
    ok("multipágina: cada página conserva sus Historias; cambiar de página elige una válida y detiene el Playback");

    /* ───────── 8. Present ───────── */
    await ed.evaluate(TRES);
    await ed.evaluate(() => scSwitchScenario(P().scenarios[1].id));
    await ed.locator("#btnPresent").click();
    await ed.waitForFunction(() => presenting === true);
    assert.equal(await ed.locator("#psTitle").innerText(), "Pago rechazado", "Present muestra la Historia seleccionada");
    await ed.locator("#psPlay").click();
    await ed.waitForFunction(() => scStatus === "running");
    assert.equal(await ed.evaluate(() => scActiveScenario().name), "Pago rechazado");
    await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 15000 });
    await ed.keyboard.press("Escape");
    await ed.waitForFunction(() => presenting === false);
    assert.equal(await noRemnants(), true);
    /* Present con dos páginas: cambiar de diapositiva durante la Historia detiene y limpia */
    await ed.evaluate(() => { const p2 = blankPage("Dos"); doc.pages.push(p2); renderTabs(); });
    await ed.locator("#btnPresent").click(); await ed.waitForFunction(() => presenting === true);
    await ed.locator("#psPlay").click(); await ed.waitForFunction(() => scStatus === "running");
    await ed.locator("#prNext").click();
    await ed.waitForFunction(() => doc.cur === 1);
    assert.equal(await noRemnants(), true);
    await ed.keyboard.press("Escape"); await ed.waitForFunction(() => presenting === false);
    await ed.evaluate(() => { doc.pages.length = 1; doc.cur = 0; renderTabs(); });
    ok("Present reproduce la Historia seleccionada; cambiar de página la detiene");

    /* ───────── 9. Share: la Historia seleccionada es la compartida ───────── */
    const decodeLink = (url) => ed.evaluate((u) => decodeDeepLink(new URL(u).hash.slice(3)), url);
    const openViewer = async (url, c = ctx) => {
      const p = watch(await c.newPage()); await p.goto(url);
      await p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
      return p;
    };
    const waitStory = (p, s, timeout = 30000) => p.waitForFunction((s) => window.__viewer.story === s, s, { timeout });
    const shareVia = async (kind) => {
      await ed.locator("#btnShare").click();
      if (kind === "diagram") await ed.locator("#shareKindDiagram").check();
      await ed.locator("#shareCreate").click();
      await ed.waitForFunction(() => document.getElementById("shareLink").value.startsWith("http"));
      const url = await ed.locator("#shareLink").inputValue();
      await ed.locator("#shareClose").click();
      return url;
    };
    await ed.evaluate(TRES);
    const docBefore = await ed.evaluate(() => JSON.stringify(serializeProject()));
    const urls = {};
    for (const n of ["Camino feliz", "Pago rechazado", "Cliente abandona"]) {
      await ed.evaluate((n) => scSwitchScenario(P().scenarios.find((s) => s.name === n).id), n);
      await ed.locator("#btnShare").click();
      assert.match(await ed.locator("#shareKind").innerText(), new RegExp(n), "el diálogo nombra la Historia seleccionada");
      assert.match(await ed.locator("#shareKind").innerText(), /Compartir sólo el diagrama/);
      await ed.locator("#shareClose").click();
      urls[n] = await shareVia("story");
      const payload = await decodeLink(urls[n]);
      const sc = payload.doc.pages[0].scenarios;
      assert.deepEqual(sc.map((s) => s.name), [n], "el enlace lleva sólo " + n);
      assert.doesNotMatch(JSON.stringify(payload), new RegExp(["Camino feliz", "Pago rechazado", "Cliente abandona"].filter((x) => x !== n).join("|")));
    }
    assert.equal(await ed.evaluate(() => JSON.stringify(serializeProject())), docBefore, "el documento del autor no cambia");
    const urlDia = await shareVia("diagram");
    assert.deepEqual((await decodeLink(urlDia)).doc.pages.map((p) => p.scenarios.length), [0]);
    await shot(ed, "03-share-dialog");
    ok("Share: A, B y C → cada enlace sólo su Historia; «sólo el diagrama» sin Historias; documento intacto");

    /* ───────── 10. Viewer: Historia compartida, reproducción, reload, Back/Forward, página, Abrir en Fluyo ───────── */
    const v = await openViewer(urls["Pago rechazado"]);
    assert.equal(await v.locator("#stKicker").innerText(), "Historia");
    assert.equal(await v.locator("#stTitle").innerText(), "Pago rechazado");
    assert.equal(await v.locator("#stPlay").innerText(), "▶ Reproducir historia");
    assert.equal(await v.evaluate(() => doc.pages[0].scenarios.length), 1, "el Viewer no tiene acceso a otras Historias");
    assert.doesNotMatch(await v.locator("body").innerText(), /Camino feliz|Cliente abandona/);
    await v.locator("#stPlay").click(); await waitStory(v, "running");
    assert.equal(await v.evaluate(() => story.scenario.name), "Pago rechazado");
    await waitStory(v, "completed");
    await shot(v, "04-viewer");
    await v.reload();
    await v.waitForFunction(() => window.__viewer.phase === "ready");
    assert.equal(await v.evaluate(() => window.__viewer.story), "ready", "recargar vuelve a «listo»");
    assert.equal(await v.locator("#stTitle").innerText(), "Pago rechazado");
    /* Back/Forward entre dos enlaces */
    await v.goto(urls["Camino feliz"]); await v.reload();
    await v.waitForFunction(() => window.__viewer.phase === "ready");
    assert.equal(await v.locator("#stTitle").innerText(), "Camino feliz");
    await v.locator("#stPlay").click(); await waitStory(v, "running");
    await v.goBack();
    await v.waitForFunction(() => window.__viewer.phase === "ready" && document.getElementById("stTitle").textContent === "Pago rechazado");
    assert.equal(await v.evaluate(() => window.__viewer.story), "ready", "Back no hereda el runtime de A");
    await v.goForward();
    await v.waitForFunction(() => document.getElementById("stTitle").textContent === "Camino feliz");
    assert.equal(await v.evaluate(() => window.__viewer.story), "ready");
    /* Abrir en Fluyo conserva sólo la Historia compartida */
    await v.locator("#stPlay").click(); await waitStory(v, "completed");
    await v.locator("#btnOpen").click();
    await v.waitForURL((u) => !u.pathname.startsWith("/s/"), { timeout: 15000 });
    /* esta pestaña comparte localStorage con el editor del autor: el editor pregunta qué hacer con la sesión */
    await v.locator("#incomingOpen").click({ timeout: 15000 });
    await v.waitForFunction(() => typeof newNode === "function" && P().scenarios.length === 1, null, { timeout: 15000 });
    assert.deepEqual(await v.evaluate(() => P().scenarios.map((s) => s.name)), ["Camino feliz"], "Abrir en Fluyo: sólo la Historia compartida");
    assert.equal(await v.evaluate(() => scStatus), "idle");
    await v.close();
    ok("Viewer: Historia, nombre, reproducir; reload; Back/Forward; Abrir en Fluyo con la Historia compartida");

    /* ───────── 11. Viewer con dos páginas: cambio de página ───────── */
    await ed.evaluate(TRES);
    await ed.evaluate(() => { const p2 = blankPage("Otra"); const n = { id: 1, shape: "rect", x: 100, y: 100, w: 120, h: 60, label: "Z" }; p2.nodes = [n]; p2.nextId = 2; doc.pages.push(p2); renderTabs(); });
    const url2 = await ed.evaluate(async () => createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: P().scenarios[0].id }));
    const payload2 = await decodeLink(url2);
    assert.deepEqual(payload2.doc.pages.map((p) => p.scenarios.map((s) => s.name)), [["Camino feliz"], []]);
    const v2 = await openViewer(url2);
    await v2.locator("#stPlay").click(); await waitStory(v2, "running");
    await v2.evaluate(() => goPage(1));
    assert.equal(await v2.locator("#story").isHidden(), true);
    assert.equal(await v2.evaluate(() => story), null);
    await v2.evaluate(() => goPage(0));
    assert.equal(await v2.evaluate(() => window.__viewer.story), "ready");
    await v2.close();
    await ed.evaluate(() => { doc.pages.length = 1; doc.cur = 0; renderTabs(); });
    ok("Viewer multipágina: cambiar de página detiene; la otra página no tiene Historia");

    /* ───────── 12. Legacy ───────── */
    const legacy = async (fixtureExtra, expectTitle, expectHidden = false) => {
      await ed.evaluate(TRES);
      if (fixtureExtra) await ed.evaluate(fixtureExtra);
      const url = await ed.evaluate(async () => createShareUrl(serializeProject(), location.href));
      const p = await openViewer(url);
      if (expectHidden) assert.equal(await p.locator("#story").isHidden(), true);
      else {
        assert.equal(await p.locator("#stTitle").innerText(), expectTitle);
        assert.equal(await p.evaluate(() => doc.pages[0].scenarios.length) >= 1, true);
        await p.locator("#stPlay").click(); await waitStory(p, "running");
        assert.equal(await p.evaluate(() => story.scenario.name), expectTitle);
        await waitStory(p, "completed");
      }
      const n = await p.evaluate(() => doc.pages[0].scenarios.length);
      await p.close();
      return n;
    };
    assert.equal(await legacy("", "Camino feliz"), 3, "Share antiguo con 3 Historias: reproduce scenarios[0]; los datos viajaban y no se reescriben");
    assert.equal(await legacy("P().scenarios.splice(1)", "Camino feliz"), 1, "Share antiguo con una");
    assert.equal(await legacy("P().scenarios.length = 0", "", true), 0, "documento antiguo sin Historias");
    ok("legacy: N Historias → scenarios[0]; una; ninguna");

    /* ───────── 13. Adversarial de modelo y datos ───────── */
    await ed.evaluate(TRES);
    /* 100+ Steps: duplicar */
    await ed.evaluate(() => { const s = createScenario(P(), "Muchos"); for (let i = 0; i < 150; i++) createStep(s, { at: i * 20, action: "SEND", edgeId: P().edges[0].id, eventTypeId: doc.eventTypes[0].id }); scSwitchScenario(s.id); });
    const t0 = Date.now();
    await menuItem("#scScenarioMenu", "Duplicar historia");
    assert.equal(await stepsCount(), 150);
    assert.ok(Date.now() - t0 < 4000, "duplicar 150 Steps es instantáneo");
    await ctrl("z");
    assert.equal((await names()).includes("Muchos copia"), false);
    /* mismo nombre en dos Historias */
    await ed.evaluate(() => { P().scenarios[1].name = P().scenarios[0].name; scRenderPanel(); });
    await ed.locator("#scScenarioTitle").click();
    assert.equal(await ed.locator("#scPopover button", { hasText: "Camino feliz" }).count(), 2, "dos entradas con el mismo nombre");
    await ed.locator("#scPopover button", { hasText: "Camino feliz" }).nth(1).click();
    assert.equal(await ed.evaluate(() => scActiveScenario().id), await ed.evaluate(() => P().scenarios[1].id));
    /* Historia vacía + motor incompatible */
    await ed.evaluate(() => { const v = createScenario(P(), "Vacía"); const f = createScenario(P(), "Futura"); createStep(f, { at: 0, action: "SEND", edgeId: P().edges[0].id, eventTypeId: doc.eventTypes[0].id }); f.engineVersion = 99; scSwitchScenario(v.id); });
    assert.equal(await ed.locator("#scRun").isDisabled(), true);
    await ed.evaluate(() => scSwitchScenario(P().scenarios.find((s) => s.name === "Futura").id));
    assert.equal(await ed.locator("#scRun").isDisabled(), true);
    assert.equal(await ed.locator("#scUnsupported").isVisible(), true);
    assert.match(await ed.locator("#scUnsupported").innerText(), /historia/);
    assert.doesNotMatch(await ed.locator("#scUnsupported").innerText(), /escenario/i);
    /* eliminar todas hasta cero y volver a empezar con auto-creación */
    await ed.evaluate(TRES);
    for (let i = 0; i < 3; i++) await menuItem("#scScenarioMenu", "Eliminar historia");
    assert.deepEqual(await names(), []);
    assert.equal(await title(), "Sin historias ▾");
    assert.equal(await ed.locator("#scRun").isDisabled(), true);
    await ed.evaluate(() => scApplyTargets(doc.eventTypes[0].id, [P().edges[0].id]));
    assert.deepEqual(await names(), ["Historia 1"], "auto-creación intacta");
    assert.equal(await title(), "Historia 1 ▾");
    await ctrl("z");
    assert.equal(await ed.evaluate(() => P().scenarios.length), 0, "una sola operación de Undo para crear + añadir");
    ok("adversarial: 150 Steps, mismo nombre, vacía, motor incompatible, eliminar la última, auto-creación");

    /* ───────── 14. Share desde file:// / localhost / producción (desde el editor real) ───────── */
    await ed.evaluate(TRES);
    await ed.evaluate(() => scSwitchScenario(P().scenarios[1].id));
    const bases = await ed.evaluate(async () => {
      const out = {};
      for (const [k, b] of [["file", "file:///C:/fluyo/index.html"], ["local", location.href], ["prod", "https://fluyo.space/"]])
        out[k] = await createShareUrl(serializeProject(), b, { kind: "story", scenarioId: scActiveScenario().id });
      return out;
    });
    assert.ok(bases.file.startsWith("https://fluyo.space/s/#d=") && bases.prod.startsWith("https://fluyo.space/s/#d="));
    assert.ok(bases.local.startsWith(base + "/s/#d="));
    assert.equal(new URL(bases.file).hash, new URL(bases.local).hash);
    assert.deepEqual((await decodeLink(bases.file)).doc.pages[0].scenarios.map((s) => s.name), ["Pago rechazado"]);
    ok("Share desde file:// / localhost / producción: mismo payload, sólo la seleccionada");

    /* ───────── 15. Responsive ───────── */
    await ed.evaluate(TRES);
    for (const [w, h] of [[1366, 768], [768, 1024], [390, 844]]) {
      await ed.setViewportSize({ width: w, height: h });
      await ed.evaluate(() => { scReset(); renderTabs(); });
      /* FLUYO-018.14b: Historias es un modo; ≤700 px se entra por «Historias» de la barra inferior (hoja), más ancho por el conmutador de la cabecera */
      await ed.waitForTimeout(250); /* que el cambio de media query (placeChrome) se aplique antes de decidir */
      if (w <= 700) { if (!(await ed.evaluate(() => document.body.classList.contains("storyMode") && document.body.classList.contains("panelOpen")))) await ed.locator("#btnStories").click(); }
      else await ed.locator("#tabScenarios").click();
      await ed.waitForTimeout(350);
      const m = await ed.evaluate(() => {
        const box = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        return { sw: document.documentElement.scrollWidth, iw: innerWidth, title: box("scScenarioTitle"), add: box("scStoryAdd"), menu: box("scScenarioMenu"), label: box("scStoriesLabel"), run: box("scRun"),
          aside: box("propPanel") };
      });
      assert.ok(m.sw <= m.iw + 1, `${w}: sin scroll horizontal (${m.sw} > ${m.iw})`);
      for (const k of ["title", "add", "menu", "run"]) { assert.ok(m[k].w > 0 && m[k].h > 0, `${w}: ${k} visible`); assert.ok(m[k].l >= -1 && m[k].r <= m.iw + 1, `${w}: ${k} dentro de la pantalla`); }
      assert.ok(m.add.h >= 24, `${w}: «+» tocable`);
      await shot(ed, `05-panel-${w}x${h}`);
    }
    await ed.setViewportSize({ width: 1366, height: 768 });
    await ed.evaluate(() => document.body.classList.remove("panelOpen"));
    /* nombre muy largo: el selector no desborda */
    await ed.evaluate(() => { P().scenarios[0].name = "Una historia con un nombre larguísimo ".repeat(3).slice(0, 118); scSelectStory(P().scenarios[0].id); scRenderPanel(); });
    const longBox = await ed.evaluate(() => { const r = document.getElementById("scScenarioTitle").getBoundingClientRect(), m = document.getElementById("scScenarioMenu").getBoundingClientRect(); return { r: r.right, ml: m.left, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
    assert.ok(longBox.r <= longBox.ml + 1 && longBox.sw <= longBox.iw + 1, "nombre largo: el selector se recorta sin empujar los botones");
    ok("responsive 1366×768 · 768×1024 · 390×844: encabezado visible, sin scroll horizontal, nombre largo");

    assert.deepEqual(errors, [], "sin excepciones de página: " + errors.join(" | "));
    assert.equal(umami.length, 0, "telemetría interceptada");

    /* ───────── 16. Offline: Share de una Historia sin red ───────── */
    const off = await newCtx({ serviceWorkers: "allow" });
    const oe = watch(await off.newPage());
    await oe.goto(base + "/");
    await oe.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined, null, { timeout: 15000 });
    await oe.evaluate(async () => { await navigator.serviceWorker.ready; });
    const t = Date.now();
    for (;;) { if (await oe.evaluate(async () => { const k = await caches.keys(); return k.length === 1 && (await (await caches.open(k[0])).keys()).length > 30; })) break; if (Date.now() - t > 20000) throw new Error("timeout SW"); await oe.waitForTimeout(200); }
    assert.deepEqual(await oe.evaluate(() => caches.keys()), [currentCache]);
    await oe.evaluate(TRES);
    const offUrl = await oe.evaluate(async () => createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: P().scenarios[1].id }));
    await off.setOffline(true);
    const op = watch(await off.newPage());
    await op.goto(offUrl);
    await op.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
    assert.equal(await op.locator("#stKicker").innerText(), "Historia");
    assert.equal(await op.locator("#stTitle").innerText(), "Pago rechazado");
    await op.locator("#stPlay").click(); await waitStory(op, "completed", 30000);
    await off.setOffline(false); await off.close();
    ok("Viewer offline (SW " + currentCache + "): abre y reproduce la Historia compartida");

    assert.deepEqual(errors, [], "sin excepciones de página: " + errors.join(" | "));
    console.log(`\nFLUYO-016 browser: OK (${results.length} bloques). Capturas: ${shots}`);
  } finally {
    await browser.close(); server.close();
  }
})().catch((e) => { console.error("FALLO:", e && e.stack || e); process.exit(1); });
