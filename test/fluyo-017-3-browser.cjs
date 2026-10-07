"use strict";
/* FLUYO-017.3 — QA en Chrome REAL (clics, arrastres y teclado reales de Playwright sobre el editor, Present, Share y Viewer).
   017.3 extrajo a model.js la lógica del modal de EventTypes (forma por primitiva, create/update/delete sobre un documento
   explícito): aquí se comprueba que el editor sigue comportándose igual.
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-017-3-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-017-3-"));
fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json" };

const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + rel); assert.ok(file.startsWith(dir + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};

/* Un documento ANTERIOR a 017.x: se genera con el código de HEAD (git archive → carpeta temporal), no con el árbol actual. */
async function oldDocument(browser) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-"));
  // Sólo lo que sirve el editor (index.html, js/, css/, s/) tal como está en HEAD; no se toca el árbol ni el índice de git.
  const files = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8" }).split("\n").filter((f) => /^(index\.html|js\/|css\/|s\/|manifest\.webmanifest)/.test(f));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), execFileSync("git", ["-C", root, "show", "HEAD:" + f], { maxBuffer: 64 * 1024 * 1024 }));
  }
  const { server, base } = await serve(dir);
  const ctx = await browser.newContext({ serviceWorkers: "block" }), page = await ctx.newPage();
  await page.goto(base + "/");
  await page.waitForFunction(() => typeof newNode === "function" && typeof createScenario === "function");
  const json = await page.evaluate(() => {
    P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = [];
    const a = newNode("rect", 160, 240), b = newNode("rect", 520, 240), w = newNode("rect", 880, 240);
    a.label = "Cliente"; b.label = "Comercio"; w.label = "Almacén";
    const e1 = newEdge(a.id, b.id), e2 = newEdge(b.id, w.id);
    const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
    const cae = createEventType({ name: "Cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { value: "⚠" } });
    const sc = createScenario(P(), "Historia heredada");
    createStep(sc, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: pago.id });
    createStep(sc, { at: 1500, action: "SET_STATE", nodeId: w.id, state: "DOWN", eventTypeId: cae.id });
    createStep(sc, { at: 3000, action: "SEND", edgeId: e2.id, eventTypeId: pago.id });
    return JSON.stringify(serializeProject());
  });
  const head = execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  await ctx.close(); server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return { json, head };
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  const errors = [], results = [];
  const ok = (name) => { results.push(name); console.log("  ✔", name); };
  const watch = (p) => { p.on("pageerror", (e) => errors.push(e.message)); return p; };
  const shot = (p, name) => p.screenshot({ path: path.join(shots, name + ".png") });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
    await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
    const ed = watch(await ctx.newPage());
    ed.on("dialog", (d) => d.accept());
    await ed.goto(base + "/");
    await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");

    /* ───────── ayudantes de interacción real ───────── */
    const J = (v) => JSON.stringify(v);
    const place = (name) => ed.getByRole("button", { name: new RegExp("^" + name + ": colocar en") });
    const point = (kind, index) => ed.evaluate(({ kind, index }) => {
      const r = cv.getBoundingClientRect();
      let p;
      if (kind === "node") p = P().nodes[index];
      else {
        const pts = edgePoints(P().edges[index]);
        for (let i = 1; i < pts.length && !p; i++) for (const u of [0.5, 0.25, 0.75]) {
          const q = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u };
          if (!hitNode(q.x, q.y) && scEdgeCandidates(q.x, q.y).length === 1) { p = q; break; }
        }
      }
      if (!p) throw Error("sin punto inequívoco");
      return { x: r.left + p.x * viewZoom + viewX, y: r.top + p.y * viewZoom + viewY };
    }, { kind, index });
    const placeOn = async (name, kind, index) => { await place(name).click(); const p = await point(kind, index); await ed.mouse.click(p.x, p.y); };
    const createEvent = async ({ name, kind, phrase, consequence, symbolIndex, message }) => {
      await ed.locator("#scEventNew").click();
      await ed.locator("#scEventName").fill(name);
      if (kind === "element") await ed.locator('.scSegmented label:has(input[name=scWhere][value=element]) span').click();
      if (consequence) {
        await ed.locator("#scBehavior").evaluate((el) => { el.hidden = false; el.open = true; });
        await ed.locator(`.scChoiceStack label:has(input[name=scConsequence][value=${consequence}])`).first().click();
      }
      if (message) {
        await ed.locator("#scAppearance").evaluate((el) => { el.hidden = false; el.open = true; });
        await ed.locator("label.scEffectChip:has(#scUseMessage)").click();
        await ed.locator("#scMessage").fill(message);
      }
      await ed.locator(".scPhraseText").nth(1).fill(phrase);
      await ed.locator("#scVisualPicker button").nth(symbolIndex).click();
      await ed.locator("#scEventSave").click();
      await ed.waitForFunction(() => !document.getElementById("scEventDialog").open);
    };
    const editEvent = async (name, fn) => {
      await ed.locator("#scEventLibrary").getByRole("button", { name: "Opciones de " + name, exact: true }).click();
      await ed.locator("#scPopover button", { hasText: "Editar evento" }).click();
      await ed.waitForFunction(() => document.getElementById("scEventDialog").open);
      await fn();
      await ed.locator("#scEventSave").click();
      await ed.waitForFunction(() => !document.getElementById("scEventDialog").open);
    };
    const traceOf = () => ed.evaluate(() => JSON.stringify(FluyoScenarios.runScenario({ nodes: P().nodes, edges: P().edges }, P().behaviors || [], scActiveScenario()).trace));
    const docNow = () => ed.evaluate(() => JSON.stringify(serializeProject()));
    const stepsNow = () => ed.evaluate(() => JSON.stringify(P().scenarios));
    const typesNow = () => ed.evaluate(() => JSON.stringify(doc.eventTypes));
    const noRemnants = () => ed.evaluate(() => scStatus === "idle" && scPlayback === null && buildScenarioRenderState() === null && scRafId === null);
    const blur = () => ed.evaluate(() => document.activeElement && document.activeElement.blur());
    const sampleMessages = () => ed.evaluate(() => { window.__msgs = new Set(); window.__sampler = setInterval(() => { const s = buildScenarioRenderState(); if (s) for (const m of JSON.stringify(s).matchAll(/"message":"([^"]*)"/g)) window.__msgs.add(m[1]); }, 40); });
    const takeMessages = () => ed.evaluate(() => { clearInterval(window.__sampler); return [...window.__msgs].sort(); });
    const storyboard = () => ed.locator("#scStoryboard").innerText();

    /* ───────── fixture: Cliente → Comercio ───────── */
    await ed.evaluate(() => {
      P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = []; doc.pages.length = 1; doc.cur = 0;
      undoStack.length = 0; redoStack.length = 0; scReset();
      const a = newNode("rect", 200, 260), b = newNode("rect", 620, 260); a.label = "Cliente"; b.label = "Comercio"; newEdge(a.id, b.id);
      viewX = 0; viewY = 0; viewZoom = 1;
    });
    await ed.locator("#tabScenarios").click();
    await createEvent({ name: "Pago", kind: "connection", phrase: " paga a ", symbolIndex: 0 });
    await createEvent({ name: "Procesa", kind: "element", phrase: " procesa el pedido", symbolIndex: 1, message: "Procesando" });
    await createEvent({ name: "Cae", kind: "element", phrase: " deja de responder", consequence: "down", symbolIndex: 2 });
    assert.deepEqual(await ed.evaluate(() => doc.eventTypes.map((e) => [e.name, e.primitive, e.availability ?? null])), [["Pago", "FLOW", null], ["Procesa", "OCCURRENCE", null], ["Cae", "SET_AVAILABILITY", "DOWN"]]);
    await ed.locator("#scEmptyState").getByRole("button", { name: "+ Nueva historia" }).click().catch(async () => { await ed.locator("#scStoryAdd").click(); });
    assert.equal(await ed.evaluate(() => P().scenarios.length), 1);
    await placeOn("Pago", "edge", 0); await placeOn("Pago", "edge", 0); await placeOn("Pago", "edge", 0);
    await placeOn("Procesa", "node", 1); await placeOn("Cae", "node", 1);
    assert.equal(await ed.evaluate(() => scActiveScenario().steps.map((s) => s.action).join(",")), "SEND,SEND,SEND,OCCURRENCE,SET_STATE");
    await shot(ed, "01-fixture");
    ok("fixture real: 3 EventTypes por el modal (conexión, elemento, disponibilidad), Historia y 5 Steps colocados con el ratón");

    /* ───────── A. EventType usado: editar nombre/frase ───────── */
    {
      const stepsBefore = await stepsNow(), traceBefore = await traceOf();
      assert.equal((await storyboard()).match(/Cliente paga a Comercio/g).length, 3);
      await editEvent("Pago", async () => {
        assert.equal(await ed.locator("#scEventLocked").isVisible(), true, "avisa de que está en uso");
        await ed.locator("#scEventName").fill("Cobro");
        await ed.locator(".scPhraseText").nth(1).fill(" cobra a ");
      });
      assert.equal((await storyboard()).match(/Cliente cobra a Comercio/g).length, 3, "los 3 usos cambian");
      assert.doesNotMatch(await storyboard(), /Cliente paga a/);
      assert.equal(await stepsNow(), stepsBefore, "los Steps no cambian");
      assert.equal(await traceOf(), traceBefore, "el Trace no cambia");
      assert.equal(await ed.evaluate(() => doc.eventTypes[0].id), 1, "conserva su id");
      await ed.locator("#scRun").click();
      await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 });
      await ed.locator("#scReset").click();
      assert.equal(await noRemnants(), true);
      assert.equal(await stepsNow(), stepsBefore);
      await shot(ed, "02-editado");
      ok("A. editar nombre/frase de un EventType usado: sus 3 usos cambian; Steps y Trace idénticos; Playback completa sin residuos");
    }

    /* ───────── B. Disponibilidad ───────── */
    {
      const before = await ed.evaluate(() => doc.eventTypes.find((e) => e.name === "Cae").availability);
      await ed.locator("#scEventLibrary").getByRole("button", { name: "Opciones de Cae", exact: true }).click();
      await ed.locator("#scPopover button", { hasText: "Editar evento" }).click();
      assert.equal(await ed.locator("#scEventLocked").isVisible(), true);
      assert.deepEqual(await ed.locator('input[name=scConsequence]').evaluateAll((els) => els.map((e) => e.disabled)), [true, true, true], "la consecuencia está bloqueada en un evento usado");
      assert.deepEqual(await ed.locator('input[name=scWhere]').evaluateAll((els) => els.map((e) => e.disabled)), [true, true], "dónde ocurre también");
      const pageErrors = errors.length;
      await ed.locator("#scEventName").fill("Cae el servicio");
      await ed.locator("#scEventSave").click();            // el modal reenvía la MISMA disponibilidad: no debe lanzar
      await ed.waitForFunction(() => !document.getElementById("scEventDialog").open);
      assert.equal(await ed.locator("#scEventError").isVisible(), false);
      assert.equal(errors.length, pageErrors, "sin errores de página");
      assert.equal(await ed.evaluate(() => { const e = doc.eventTypes.find((x) => x.id === 3); return [e.name, e.availability, e.primitive].join("|"); }), "Cae el servicio|DOWN|SET_AVAILABILITY");
      assert.equal(await ed.evaluate(() => { try { updateEventType(3, { availability: "UP" }); return "sin error"; } catch (e) { return e.code; } }), "event_type_availability_immutable_when_used");
      assert.equal(await ed.evaluate(() => { try { updateEventType(1, { primitive: "OCCURRENCE" }); return "sin error"; } catch (e) { return e.code; } }), "event_type_primitive_immutable_when_used");
      assert.equal(await ed.evaluate(() => { try { updateEventType(3, { availability: "DOWN", name: "Cae el servicio" }); return "ok"; } catch (e) { return e.code; } }), "ok", "reenviar la misma disponibilidad no lanza");
      assert.equal(await ed.evaluate(() => { try { deleteEventType(1); return "sin error"; } catch (e) { return e.code; } }), "event_type_in_use");
      assert.equal(before, "DOWN");
      ok("B. disponibilidad de un evento usado: UI bloqueada; reenviar la misma no lanza; cambiarla, cambiar la primitiva o borrar sí se rechazan (política actual)");
    }

    /* ───────── C. Undo / Redo ─────────
       Cada entrada restaura la PÁGINA (nodos, conexiones, comportamientos, Historias) y, desde FLUYO-018.7d, también la biblioteca de
       EventTypes tal como estaba antes de esa acción (decisión 82 ya no la excluye). Los contadores de identidad nunca bajan. */
    {
      await blur();
      /* sin contadores de identidad: applySnap los conserva a propósito (un id eliminado no se reasigna) */
      const page = () => ed.evaluate(() => { const c = JSON.parse(JSON.stringify(P())); delete c.nextId; delete c.nextScenarioId; for (const sc of c.scenarios) delete sc.nextStepId; return JSON.stringify(c); });
      const lib = () => ed.evaluate(() => JSON.stringify([doc.eventTypes, doc.nextEventTypeId]));
      const pg = [await page()], libs = [await lib()];
      await createEvent({ name: "Nuevo", kind: "connection", phrase: " reintenta con ", symbolIndex: 3 }); pg.push(await page()); libs.push(await lib());
      await editEvent("Nuevo", async () => { await ed.locator("#scEventName").fill("Nuevo 2"); }); pg.push(await page()); libs.push(await lib());
      await ed.locator("#scStoryAdd").click(); pg.push(await page()); libs.push(await lib());
      await placeOn("Nuevo 2", "edge", 0); pg.push(await page()); libs.push(await lib());
      assert.equal(await ed.evaluate(() => P().scenarios.length), 2);
      const libFinal = await lib();
      assert.match(libFinal, /"name":"Nuevo 2"/);
      const undone = [];
      for (let i = 0; i < 4; i++) { await blur(); await ed.keyboard.press("Control+z"); undone.push([(await page()) === pg[3 - i], (await lib()).replace(/,\d+\]$/, "]") === libs[3 - i].replace(/,\d+\]$/, "]")]); }
      console.log("     Undo ×4 [página == estado previo, biblioteca == estado previo]:", J(undone));
      assert.deepEqual(undone, [[true, true], [true, true], [true, true], [true, true]], "Ctrl+Z restaura la página y la biblioteca de EventTypes de cada paso (018.7d)");
      assert.doesNotMatch(await lib(), /"name":"Nuevo/, "deshacer la creación quita «Nuevo» de la biblioteca");
      assert.equal(await ed.evaluate(() => P().scenarios.length), 1, "la Historia nueva desapareció con su Undo");
      const redone = [];
      for (let i = 0; i < 4; i++) { await blur(); await ed.keyboard.press("Control+y"); redone.push([(await page()) === pg[i + 1], (await lib()) === libs[i + 1]]); }
      assert.deepEqual(redone, [[true, true], [true, true], [true, true], [true, true]], "Ctrl+Y rehace página y biblioteca en el mismo orden");
      assert.equal(await lib(), libFinal);
      assert.equal(await ed.evaluate(() => P().scenarios.length), 2);
      assert.equal(await ed.evaluate(() => doc.nextEventTypeId), 5, "el contador de EventTypes no baja");
      assert.equal(await noRemnants(), true);
      ok("C. Undo/Redo reales (Ctrl+Z ×4, Ctrl+Y ×4) tras crear/modificar EventType, crear Historia y añadir Step: página y biblioteca exactas en cada paso (018.7d); el contador no baja");
    }

    /* ───────── D. Present ───────── */
    {
      await ed.evaluate(() => scSwitchScenario(P().scenarios[0].id));
      const docBefore = await docNow(), trace = await traceOf();
      await sampleMessages();
      await ed.locator("#scRun").click();
      await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 });
      const playbackMsgs = await takeMessages();
      await ed.locator("#scReset").click();
      assert.ok(playbackMsgs.includes("Procesando"), "Playback muestra el mensaje del EventType: " + J(playbackMsgs));
      await ed.locator("#btnPresent").click();
      await ed.waitForFunction(() => presenting === true);
      await sampleMessages();
      await ed.locator("#psPlay").click();
      await ed.waitForFunction(() => scStatus === "running");
      assert.equal(await traceOf(), trace, "mismo Trace en Present");
      await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 });
      const presentMsgs = await takeMessages();
      await shot(ed, "03-present");
      await ed.keyboard.press("Escape");
      await ed.waitForFunction(() => presenting === false);
      assert.deepEqual(presentMsgs, playbackMsgs, "mismos mensajes que Playback");
      assert.equal(await docNow(), docBefore, "Present no cambia el documento");
      assert.equal(await noRemnants(), true, "sin residuos al salir");
      ok("D. Present: mismo Trace, mismos mensajes que Playback (" + J(presentMsgs) + "), documento intacto, sin residuos");
    }

    /* ───────── E. Share / Viewer ───────── */
    const decodeLink = (url) => ed.evaluate((u) => decodeDeepLink(new URL(u).hash.slice(3)), url);
    const shareVia = async (kind) => {
      await ed.locator("#btnShare").click();
      if (kind === "diagram") await ed.locator("#shareKindDiagram").check();
      await ed.locator("#shareCreate").click();
      await ed.waitForFunction(() => document.getElementById("shareLink").value.startsWith("http"));
      const url = await ed.locator("#shareLink").inputValue();
      await ed.locator("#shareClose").click();
      return url;
    };
    const openViewer = async (url) => {
      const p = watch(await ctx.newPage()); await p.goto(url);
      await p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
      return p;
    };
    {
      const docBefore = await docNow(), trace = await traceOf();
      const sid = await ed.evaluate(() => scActiveScenario().id);
      const url = await shareVia("story");
      const payload = await decodeLink(url);
      assert.equal(payload.doc.pages[0].scenarios.length, 1);
      assert.deepEqual(payload.doc.eventTypes.map((e) => [e.name, e.sentenceTemplate]), await ed.evaluate(() => doc.eventTypes.map((e) => [e.name, e.sentenceTemplate])));
      assert.equal(await docNow(), docBefore, "compartir no cambia el documento");
      const v = await openViewer(url);
      assert.equal(await v.locator("#stKicker").innerText(), "Historia");
      assert.equal(await v.evaluate(() => doc.pages[0].scenarios.length), 1);
      assert.deepEqual(await v.evaluate(() => doc.eventTypes.map((e) => e.name)), ["Cobro", "Procesa", "Cae el servicio", "Nuevo 2"]);
      assert.equal(await v.evaluate(() => JSON.stringify(FluyoScenarios.runScenario({ nodes: doc.pages[0].nodes, edges: doc.pages[0].edges }, doc.pages[0].behaviors || [], doc.pages[0].scenarios[0]).trace)), trace, "el Trace del Viewer coincide con el del editor");
      await v.locator("#stPlay").click();
      await v.waitForFunction(() => window.__viewer.story === "running");
      await v.waitForFunction(() => window.__viewer.story === "completed", null, { timeout: 30000 });
      await shot(v, "04-viewer");
      const urlDia = await shareVia("diagram");
      assert.deepEqual((await decodeLink(urlDia)).doc.pages.map((p) => p.scenarios.length), [0]);
      const vd = await openViewer(urlDia);
      assert.equal(await vd.evaluate(() => doc.pages[0].scenarios.length), 0);
      assert.ok(sid > 0);
      await v.close(); await vd.close();
      ok("E. Share/Viewer: payload con los EventTypes editados, Viewer abre y reproduce con el mismo Trace; «sólo diagrama» sin Historias");
    }

    /* ───────── F. Documentos anteriores ───────── */
    {
      const old = await oldDocument(browser);
      const files = [
        ["v3 real (ejemplo publicado)", path.join(root, "ejemplos", "data", "kafka-event-pipeline.fluyo.json"), null],
        ["generado con el código de HEAD " + old.head, path.join(shots, "old-head.fluyo.json"), old.json],
      ];
      for (const [label, file, content] of files) {
        if (content) fs.writeFileSync(file, content);
        const errs = errors.length;
        await ed.locator("#fileIn").setInputFiles(file);
        await ed.waitForFunction(() => !document.getElementById("scEventDialog").open);
        await ed.waitForTimeout(400);
        await ed.locator("#tabScenarios").click();
        const names = await ed.evaluate(() => doc.eventTypes.map((e) => e.name));
        console.log("     «" + label + "» → EventTypes:", J(names), "· Historias:", await ed.evaluate(() => P().scenarios.length));
        if (content) assert.deepEqual(names, ["Pago", "Cae"], "muestra sus EventTypes");
        assert.match(await ed.locator("#scEventLibrary").innerText(), names[0] ? new RegExp(names[0]) : /Qué puede ocurrir/);
        // crear/editar Historias con el editor real
        const nBefore = await ed.evaluate(() => P().scenarios.length);
        await ed.locator("#scStoryAdd").click();
        assert.equal(await ed.evaluate(() => P().scenarios.length), nBefore + 1);
        if (content) {
          await editEvent("Pago", async () => { await ed.locator("#scEventName").fill("Pago heredado"); });
          assert.equal(await ed.evaluate(() => doc.eventTypes[0].name), "Pago heredado");
          await ed.evaluate(() => scSwitchScenario(P().scenarios[0].id));
          assert.match(await storyboard(), /Cliente paga a Comercio/);
        } else {
          await createEvent({ name: "Llega", kind: "element", phrase: " recibe", symbolIndex: 0 });
          await placeOn("Llega", "node", 0);
        }
        await ed.locator("#scRun").click();
        await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 });
        await ed.locator("#scReset").click();
        const trace = await traceOf();
        const url = await shareVia("story");
        const v = await openViewer(url);
        assert.equal(await v.evaluate(() => doc.pages[0].scenarios.length), 1);
        assert.equal(await v.evaluate(() => JSON.stringify(FluyoScenarios.runScenario({ nodes: doc.pages[0].nodes, edges: doc.pages[0].edges }, doc.pages[0].behaviors || [], doc.pages[0].scenarios[0]).trace)), trace);
        await v.locator("#stPlay").click();
        await v.waitForFunction(() => window.__viewer.story === "completed", null, { timeout: 30000 });
        await v.close();
        assert.equal(errors.length, errs, label + ": sin errores de página");
        assert.equal(await noRemnants(), true);
      }
      ok("F. documento v3 real y documento generado con el código de HEAD: abren, muestran EventTypes, crean/editan Historias, reproducen, comparten y abren en Viewer");
    }

    assert.deepEqual(errors, [], "errores de página: " + errors.join(" | "));
    ok("sin errores de página en toda la sesión");
    console.log(`\nFLUYO-017.3 browser: OK (${results.length} bloques). Capturas: ${shots}`);
  } finally {
    await browser.close(); server.close();
  }
})().catch((e) => { console.error("\nFLUYO-017.3 browser: FALLO\n", e); process.exit(1); });
