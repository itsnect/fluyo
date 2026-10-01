"use strict";
/* FLUYO-014: Share Playback en Chrome real (editor → enlace → viewer → reproducir).
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-014-browser.cjs   (FLUYO_BROWSER=chrome por defecto) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-014-"));
fs.mkdirSync(shots, { recursive: true });
const currentCache = /const CACHE = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8"))[1];
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json" };

/* ───────────── Fixtures (se ejecutan dentro del editor real) ───────────── */
const RESET = `P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = [];`;
const NEGOCIO = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 600, 240); a.label = "Cliente"; b.label = "Comercio";
  const e = newEdge(a.id, b.id);
  const sc = createScenario(P(), "Cliente paga a Comercio");
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
  const rec = createEventType({ name: "Pago recibido", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe el pago", visual: { value: "✓" },
    presentation: { nodeEffects: { showSymbol: true, message: "Pago recibido", highlight: true, visualDuration: "brief" } } });
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: b.id, eventTypeId: rec.id });
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: a.id, eventTypeId: rec.id });
})()`;
const HUMANO = `(() => { ${RESET}
  const a = newNode("rect", 120, 240), j = newNode("rect", 420, 240), r = newNode("rect", 720, 240);
  a.label = "Empleado"; j.label = "Jefe"; r.label = "RRHH";
  const e1 = newEdge(a.id, j.id), e2 = newEdge(j.id, r.id);
  const sc = createScenario(P(), "Solicitud de vacaciones");
  const sol = createEventType({ name: "Solicitud", primitive: "FLOW", sentenceTemplate: "{source} envía la solicitud a {target}", visual: { value: "📝" } });
  const ap = createEventType({ name: "Aprobado", primitive: "OCCURRENCE", sentenceTemplate: "{target} aprueba", visual: { value: "👍" },
    presentation: { nodeEffects: { showSymbol: true, message: "Aprobado", messageColor: "#2e7d32", highlight: true } } });
  const not = createEventType({ name: "Aviso", primitive: "FLOW", sentenceTemplate: "{source} avisa a {target}", visual: { value: "📨" } });
  createStep(sc, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: sol.id });
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: j.id, eventTypeId: ap.id });
  createStep(sc, { at: 3500, action: "SEND", edgeId: e2.id, eventTypeId: not.id });
})()`;
const KAFKA = `(() => { ${RESET}
  const p = newNode("rect", 120, 240), k = newNode("rect", 420, 240), c = newNode("rect", 720, 240);
  p.label = "Producer"; k.label = "Kafka"; c.label = "Consumer";
  const e1 = newEdge(p.id, k.id), e2 = newEdge(k.id, c.id);
  const sc = createScenario(P(), "Mensaje perdido");
  const cae = createEventType({ name: "Kafka cae", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} cae", visual: { value: "⚠" } });
  const pub = createEventType({ name: "Publicación", primitive: "FLOW", sentenceTemplate: "{source} publica en {target}", visual: { value: "📨" } });
  createStep(sc, { at: 0, action: "SET_STATE", nodeId: k.id, state: "DOWN", eventTypeId: cae.id });
  createStep(sc, { at: 1000, action: "SEND", edgeId: e1.id, eventTypeId: pub.id });
  createStep(sc, { at: 3500, action: "SEND", edgeId: e2.id, eventTypeId: pub.id });
})()`;
const EFECTOS = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 600, 240); a.label = "Almacén"; b.label = "Tienda";
  const e = newEdge(a.id, b.id);
  const sc = createScenario(P(), "Entrega con todos los efectos");
  const env = createEventType({ name: "Envío", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { value: "📦" }, motion: "slow" });
  const ll = createEventType({ name: "Llegó", primitive: "OCCURRENCE", sentenceTemplate: "{target} recibe", visual: { value: "⭐" },
    presentation: { nodeEffects: { showSymbol: true, message: "¡Llegó!", messageColor: "#2e7d32", messageSize: "large", messageWeight: "bold",
      highlight: true, blink: true, fillColor: "#3aa7e8", visualDuration: "custom", visualDurationMs: 2500 } } });
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: env.id });
  createStep(sc, { at: 2500, action: "OCCURRENCE", nodeId: b.id, eventTypeId: ll.id });
})()`;
const SOLO = `(() => { ${RESET} const n = newNode("rect", 300, 200); n.label = "Solo"; })()`;
const LARGO = `(() => { ${RESET}
  const a = newNode("rect", 200, 240), b = newNode("rect", 600, 240); a.label = "Cliente con un nombre muy largo que debe poder partirse"; b.label = "Comercio";
  const e = newEdge(a.id, b.id);
  const sc = createScenario(P(), "Una historia con un nombre bastante largo para comprobar que en móvil se parte bien y no corta nada");
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
  const rec = createEventType({ name: "Aviso largo", primitive: "OCCURRENCE", sentenceTemplate: "{target}", visual: { value: "✓" },
    presentation: { nodeEffects: { showSymbol: true, message: "Mensaje largo de comprobación que ocupa varias líneas en una pantalla pequeña", highlight: true } } });
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
  createStep(sc, { at: 1500, action: "OCCURRENCE", nodeId: b.id, eventTypeId: rec.id });
})()`;

(async () => {
  /* servidor estático; la caché "anterior" simula el upgrade desde la versión previa */
  let serveOld = false;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL("http://x" + req.url); let rel = url.pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(root, "." + rel); assert.ok(file.startsWith(root + path.sep));
      let body = fs.readFileSync(file);
      if (serveOld && url.pathname === "/sw.js") {
        body = Buffer.from(body.toString().replace(currentCache, "fluyo-static-v56").replace(/\s*"\.\/js\/story-playback\.js",/, ""));
      }
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

  try {
    const ctx = await newCtx();
    const editor = watch(await ctx.newPage());
    await editor.goto(base + "/");
    await editor.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");

    /* kind: "story" (con el Scenario activo del autor) | "diagram" | "legacy" (sin opciones) */
    const shareOf = async (fixture, kind = "story") => {
      await editor.evaluate(fixture);
      return editor.evaluate(async (k) => {
        if (typeof scReset === "function") scReset();
        const sc = scActiveScenario();
        return createShareUrl(serializeProject(), location.href, k === "legacy" ? undefined : { kind: k, scenarioId: sc && sc.id });
      }, kind);
    };
    const openViewer = async (url, c = ctx) => {
      const p = watch(await c.newPage()); await p.goto(url);
      await p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
      return p;
    };
    const vstate = (p) => p.evaluate(() => window.__viewer.story);
    const waitStory = (p, s, timeout = 30000) => p.waitForFunction((s) => window.__viewer.story === s, s, { timeout });
    /* waitForFunction no espera promesas: sondeo explícito con evaluate */
    const until = async (p, fn, arg, timeout = 20000) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn, arg)) return; if (Date.now() - t0 > timeout) throw new Error("timeout: " + fn); await p.waitForTimeout(150); } };
    const shot = (p, n) => p.screenshot({ path: path.join(shots, n + ".png") });
    const JARGON = /SET_STATE|SEND|OCCURRENCE|\bUP\b|\bDOWN\b|send_failed|target_down|source_down|engineVersion|Trace|ERROR|Exception|Scenario|EventType|nodeId|edgeId/;
    const storyText = (p) => p.locator("#story").innerText();
    const SNAP = (p) => p.evaluate(() => JSON.stringify(serializeProject()));

    /* ───────── Caso 1 — Negocio, compartiendo desde el diálogo real ───────── */
    await editor.evaluate(NEGOCIO);
    await editor.locator("#btnShare").click();
    assert.equal(await editor.locator("#shareKind").isVisible(), true, "con Historia el diálogo ofrece elegir");
    assert.equal(await editor.locator("#shareKindStory").isChecked(), true, "Compartir historia es la opción por defecto");
    assert.match(await editor.locator("#shareKind").innerText(), /Compartir historia[\s\S]*Cliente paga a Comercio[\s\S]*Compartir sólo el diagrama/);
    assert.doesNotMatch(await editor.locator("#shareDialog").innerText(), /snapshot|payload|viewer|Scenario/i);
    const docBefore = await editor.evaluate(() => JSON.stringify(serializeProject()));
    await editor.locator("#shareCreate").click();
    await editor.waitForFunction(() => document.getElementById("shareLink").value.startsWith("http"));
    const urlNegocio = await editor.locator("#shareLink").inputValue();
    assert.match(urlNegocio, /\/s\/#d=[A-Za-z0-9_-]+$/);
    assert.match(await editor.locator("#shareResultNote").innerText(), /reproducir la historia/);
    assert.equal(await editor.evaluate(() => JSON.stringify(serializeProject())), docBefore, "compartir no modifica el documento");
    await editor.locator("#shareClose").click();
    ok("1a diálogo de compartir con Historia");

    const v1 = await openViewer(urlNegocio);
    assert.equal(await v1.evaluate(() => typeof newNode + typeof pushUndo + typeof scRun + typeof presentPlay + typeof scheduleAutosave), "undefinedundefinedundefinedundefinedundefined", "viewer sin editor");
    assert.equal(await v1.locator("#stPlay").innerText(), "▶ Reproducir historia");
    assert.equal(await v1.locator("#stTitle").innerText(), "Cliente paga a Comercio");
    assert.equal(await v1.locator("#stStop").isVisible(), false);
    assert.doesNotMatch(await storyText(v1), JARGON);
    const snap1 = await SNAP(v1);
    await shot(v1, "01-negocio-listo");
    await v1.locator("#stPlay").click();
    await waitStory(v1, "running");
    assert.equal(await v1.locator("#stStop").isVisible(), true);
    await v1.waitForFunction(() => story && story.playback.activeSends.some((s) => s.token === "💵"), null, { timeout: 5000 });
    await v1.waitForTimeout(300); await shot(v1, "02-negocio-token");
    await v1.waitForFunction(() => story.playback.activeNodeEffects.length >= 2, null, { timeout: 8000 });
    assert.equal(await v1.evaluate(() => story.playback.activeNodeEffects.map((f) => f.nodeId).sort().join()), await v1.evaluate(() => doc.pages[0].nodes.map((n) => n.id).sort().join()), "simultaneidad: los dos nodos a la vez");
    await shot(v1, "03-negocio-simultaneo");
    await waitStory(v1, "completed");
    assert.equal(await v1.locator("#stCaption").innerText(), "Reproducción terminada");
    assert.equal(await v1.locator("#stPlay").innerText(), "↻ Repetir");
    assert.equal(await v1.locator("#stOpen").isVisible(), true);
    assert.doesNotMatch(await storyText(v1), JARGON);
    assert.equal(await SNAP(v1), snap1, "reproducir no cambia el documento compartido");
    await shot(v1, "04-negocio-fin");
    await v1.locator("#stPlay").click(); await waitStory(v1, "running");
    await v1.locator("#stStop").click(); assert.equal(await vstate(v1), "ready");
    assert.equal(await v1.evaluate(() => story), null);
    await v1.locator("#stPlay").click(); await waitStory(v1, "completed");
    ok("1b Negocio: ver, Reproducir, token 💵, simultáneo, fin, Repetir, Detener");

    /* ───────── Paridad Present ↔ Viewer (misma Historia) ───────── */
    const trace = (code) => `(() => { const pb = ${code}; return JSON.stringify({ trace: pb.trace, meta: pb.stepMeta, log: pb.logEvents, sends: pb.completedSends.length }); })()`;
    const viaViewer = await v1.evaluate(trace("story.playback"));
    /* documento nuevo: mismos ids que el que se compartió (el motor los incluye en el Trace) */
    await editor.evaluate(() => { localStorage.clear(); });
    await editor.reload(); await editor.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
    await editor.evaluate(NEGOCIO);
    await editor.locator("#btnPresent").click();
    await editor.waitForFunction(() => presenting);
    const tPresent0 = Date.now();
    await editor.locator("#psPlay").click();
    await editor.waitForFunction(() => presentPhase() === "finished", null, { timeout: 30000 });
    const dPresent = Date.now() - tPresent0;
    const viaPresent = await editor.evaluate(trace("scPlayback"));
    assert.equal(viaViewer, viaPresent, "Trace, metadata y registro idénticos entre Viewer y Present");
    const textPresent = await editor.locator("#psCaption").innerText();
    await editor.keyboard.press("Escape"); await editor.keyboard.press("Escape");
    await editor.evaluate(() => { if (presenting) exitPresent(); });
    const tV0 = Date.now();
    await v1.locator("#stPlay").click(); await waitStory(v1, "completed");
    const dViewer = Date.now() - tV0;
    assert.ok(Math.abs(dViewer - dPresent) < 900, `misma duración (${dViewer} vs ${dPresent} ms)`);
    assert.equal(await v1.locator("#stCaption").innerText(), textPresent, "mismo cierre");
    ok("1c paridad Viewer/Present: Trace, orden, símbolos, mensajes, duración");

    /* ───────── Caso 2 — Humano ───────── */
    const v2 = await openViewer(await shareOf(HUMANO));
    assert.equal(await v2.locator("#stTitle").innerText(), "Solicitud de vacaciones");
    await v2.locator("#stPlay").click();
    await v2.waitForFunction(() => story.playback.activeNodeEffects.some((f) => f.token === "👍" && f.effects.message === "Aprobado"), null, { timeout: 8000 });
    await shot(v2, "05-humano-aprobado");
    const sawTitle = await v2.locator("#stTitle").innerText();
    assert.match(sawTitle, /Aprobado|Solicitud|Aviso/);
    await waitStory(v2, "completed");
    assert.equal(await v2.locator("#stSummary").innerText(), "");
    ok("2 Humano: Empleado → Jefe → RRHH con 👍 Aprobado");

    /* ───────── Caso 3 — Sistema con Kafka caído ───────── */
    const v3 = await openViewer(await shareOf(KAFKA));
    await v3.locator("#stPlay").click();
    await v3.waitForFunction(() => /Kafka no está disponible/.test(document.getElementById("stCaption").textContent), null, { timeout: 8000 });
    await shot(v3, "06-kafka-caido");
    const caps = new Set();
    for (let i = 0; i < 80 && (await vstate(v3)) === "running"; i++) { caps.add(await v3.locator("#stCaption").innerText()); await v3.waitForTimeout(100); }
    assert.ok([...caps].some((c) => /^No se completó · Kafka no está disponible/.test(c)), "fallo humano: " + [...caps].join(" | "));
    await waitStory(v3, "completed");
    assert.equal(await v3.locator("#stSummary").innerText(), "2 eventos no pudieron realizarse");
    assert.doesNotMatch(await storyText(v3) + [...caps].join(" "), JARGON);
    await shot(v3, "07-kafka-fin");
    ok("3 Sistema: Producer → Kafka → Consumer con Kafka indisponible");

    /* ───────── Caso 5 — Efectos completos ───────── */
    const v5 = await openViewer(await shareOf(EFECTOS));
    await v5.locator("#stPlay").click();
    const meta = await v5.evaluate(() => Object.values(story.playback.stepMeta));
    assert.equal(meta.find((m) => m.name === "Envío").motion, "slow");
    assert.equal(meta.find((m) => m.name === "Envío").token, "📦");
    const fx = meta.find((m) => m.name === "Llegó");
    assert.equal(fx.token, "⭐"); assert.equal(fx.nodeEffects.message, "¡Llegó!"); assert.equal(fx.nodeEffects.messageColor, "#2e7d32");
    assert.equal(fx.nodeEffects.visualDurationMs, 2500); assert.equal(fx.nodeEffects.fillColor, "#3aa7e8");
    await v5.waitForFunction(() => story.playback.activeNodeEffects.length > 0, null, { timeout: 10000 });
    const cue = await v5.evaluate(() => story.playback.activeNodeEffects[0]);
    assert.equal(cue.duration, 2500, "duración visual personalizada");
    await v5.waitForTimeout(500); await shot(v5, "08-efectos");
    /* el canvas pinta el mensaje: hay píxeles verdes (#2e7d32) en la burbuja */
    const green = await v5.evaluate(() => { const c = document.getElementById("sv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 0x2e) < 12 && Math.abs(d[i + 1] - 0x7d) < 12 && Math.abs(d[i + 2] - 0x32) < 12) n++; return n; });
    assert.ok(green > 100, "mensaje de color pintado en el canvas: " + green);
    await waitStory(v5, "completed");
    ok("5 Efectos: símbolo, mensaje, color, duración personalizada y movimiento lento");

    /* ───────── Sin Historia / Share antiguo / sólo diagrama ───────── */
    const vSolo = await openViewer(await shareOf(SOLO));
    assert.equal(await vstate(vSolo), "none"); assert.equal(await vSolo.locator("#story").isVisible(), false);
    assert.equal(await vSolo.evaluate(() => doc.pages[0].scenarios.length), 0);
    const vDia = await openViewer(await shareOf(NEGOCIO, "diagram"));
    assert.equal(await vstate(vDia), "none"); assert.equal(await vDia.evaluate(() => doc.pages[0].scenarios.length), 0, "sólo diagrama: sin Historias");
    const urlOld = await shareOf(NEGOCIO, "legacy");
    const vOld = await openViewer(urlOld);
    assert.equal(await vstate(vOld), "ready", "un Share antiguo con Scenarios se puede reproducir");
    /* el editor sin Historia no muestra la elección */
    await editor.evaluate(SOLO); await editor.locator("#btnShare").click();
    assert.equal(await editor.locator("#shareKind").isVisible(), false); assert.equal(await editor.locator("#shareTitle").innerText(), "Compartir diagrama");
    await editor.locator("#shareClose").click();
    for (const p of [vSolo, vDia, vOld]) await p.close();
    ok("sin Historia / sólo diagrama / Share antiguo");

    /* ───────── Varios Scenarios: manda el activo del autor ───────── */
    await editor.evaluate(NEGOCIO);
    const second = await editor.evaluate(() => { const sc = createScenario(P(), "Segunda historia"); createStep(sc, { at: 0, action: "SEND", edgeId: P().edges[0].id }); scActiveId = sc.id; return sc.id; });
    const docMulti = await editor.evaluate(() => JSON.stringify(serializeProject()));
    await editor.locator("#btnShare").click();
    assert.match(await editor.locator("#shareKind").innerText(), /Segunda historia/);
    await editor.locator("#shareCreate").click();
    await editor.waitForFunction(() => document.getElementById("shareLink").value.startsWith("http"));
    const urlMulti = await editor.locator("#shareLink").inputValue(); await editor.locator("#shareClose").click();
    assert.equal(await editor.evaluate(() => JSON.stringify(serializeProject())), docMulti, "documento original intacto");
    const vm = await openViewer(urlMulti);
    assert.equal(await vm.locator("#stTitle").innerText(), "Segunda historia");
    assert.equal(await vm.evaluate(() => doc.pages[0].scenarios.length), 2);
    await vm.close();
    ok("varios Scenarios: el activo del autor es scenarios[0]");

    /* ───────── Navegación y carreras ───────── */
    const urlA = await shareOf(NEGOCIO), urlB = await shareOf(KAFKA);
    const hashOf = (u) => new URL(u).hash;
    const nav = await openViewer(urlA);
    const titleOf = (p) => p.locator("#stTitle").innerText();
    const play = async (p) => { await p.locator("#stPlay").click(); await waitStory(p, "running"); await p.waitForTimeout(250); };
    const settled = async (p, expectTitle) => {
      await p.waitForFunction(() => window.__viewer.phase === "ready", null, { timeout: 15000 });
      await p.waitForFunction((t) => document.getElementById("stTitle").textContent === t, expectTitle, { timeout: 15000 });
      assert.equal(await p.evaluate(() => story), null, "sin runtime heredado");
      await p.waitForTimeout(1200);
      assert.equal(await vstate(p), "ready", "nada avanza solo tras navegar");
      assert.equal(await p.evaluate(() => story), null);
    };
    // A → B → A
    await nav.evaluate((h) => { location.hash = h; }, hashOf(urlB)); await settled(nav, "Mensaje perdido");
    assert.equal(await nav.evaluate(() => doc.pages[0].nodes.map((n) => n.label).join()), "Producer,Kafka,Consumer");
    await nav.evaluate((h) => { location.hash = h; }, hashOf(urlA)); await settled(nav, "Cliente paga a Comercio");
    // Play → hashchange a B
    await play(nav);
    await nav.evaluate((h) => { location.hash = h; }, hashOf(urlB)); await settled(nav, "Mensaje perdido");
    // Play → Back (vuelve a A)
    await play(nav); await nav.goBack(); await settled(nav, "Cliente paga a Comercio");
    // Play → Forward (B)
    await play(nav); await nav.goForward(); await settled(nav, "Mensaje perdido");
    // Play → Reload
    await play(nav); await nav.reload(); await nav.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready"); await settled(nav, "Mensaje perdido");
    // Play → Detener → Play → Repetir, Play → Repetir sin detener
    await nav.evaluate((h) => { location.hash = h; }, hashOf(urlA)); await settled(nav, "Cliente paga a Comercio");
    await play(nav); await nav.locator("#stStop").click(); await play(nav);
    await waitStory(nav, "completed"); await nav.locator("#stPlay").click(); await waitStory(nav, "running");
    await nav.locator("#stStop").click();
    assert.equal(await nav.evaluate(() => story), null);
    // cerrar / reabrir
    await play(nav); await nav.close();
    const again = await openViewer(urlA);
    assert.equal(await vstate(again), "ready"); assert.equal(await again.evaluate(() => story), null);
    // sin estado compartido entre pestañas ni almacenamiento
    assert.equal(await again.evaluate(() => localStorage.length + sessionStorage.length), 0);
    // Play → Abrir en Fluyo (copia editable, runtime fuera)
    await play(again);
    const before = await SNAP(again);
    await again.locator("#btnOpen").click();
    await again.waitForURL((u) => !u.pathname.startsWith("/s/"), { timeout: 15000 });
    await again.waitForFunction(() => typeof newNode === "function" && P().scenarios.length === 1, null, { timeout: 15000 });
    const copy = await again.evaluate(() => ({ steps: P().scenarios[0].steps.length, types: doc.eventTypes.length, nodes: P().nodes.length, json: JSON.stringify(serializeProject()), status: scStatus, pb: scPlayback }));
    assert.deepEqual([copy.steps, copy.types, copy.nodes], [3, 2, 2]); assert.equal(copy.status, "idle"); assert.equal(copy.pb, null);
    assert.ok(!/playback|trace|startedAtReal|scenarioRuntime/.test(copy.json), "copia sin runtime");
    assert.equal(JSON.stringify(JSON.parse(copy.json).doc.pages), JSON.stringify(JSON.parse(before).doc.pages), "la copia es la del share");
    // editar la copia no cambia el share original
    const vOrig = await openViewer(urlA);
    assert.equal(await SNAP(vOrig), before, "el share original sigue intacto");
    await again.close(); await vOrig.close();
    ok("navegación A→B→A, Back/Forward, Reload, Detener/Repetir, cerrar/reabrir, Abrir en Fluyo");

    /* ───────── Documento grande (muchos Steps) ───────── */
    const vBig = await openViewer(await shareOf(`(() => { ${NEGOCIO}; const sc = P().scenarios[0]; const e = P().edges[0]; const et = doc.eventTypes[0];
      for (let i = 0; i < 40; i++) createStep(sc, { at: 4000 + i * 150, action: "SEND", edgeId: e.id, eventTypeId: et.id }); })()`));
    await vBig.locator("#stPlay").click(); await waitStory(vBig, "completed", 40000);
    await vBig.close();
    ok("documento con muchos Steps");

    /* ───────── Responsive ───────── */
    const urlLargo = await shareOf(LARGO);
    for (const [w, h] of [[390, 844], [768, 1024], [1366, 768], [1920, 1080]]) {
      for (const [label, url] of [["pago", urlNegocio], ["largo", urlLargo]]) {
        const c = await newCtx({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
        const p = await openViewer(url, c);
        const inView = async (sel) => { const b = await p.locator(sel).boundingBox(); assert.ok(b, sel + " visible"); assert.ok(b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5, `${sel} dentro de ${w}×${h}: ${JSON.stringify(b)}`); return b; };
        const noHScroll = async (when) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= window.innerWidth), `sin scroll horizontal (${when}) ${w}×${h}`);
        await noHScroll("listo"); await inView("#stPlay"); await inView("#story");
        const cv = await p.locator("#sv").boundingBox();
        assert.ok(cv.height >= h * 0.4, `el canvas es protagonista: ${cv.height}/${h}`);
        await shot(p, `r-${label}-${w}-listo`);
        await p.locator("#stPlay").click(); await waitStory(p, "running");
        await inView("#stStop"); await noHScroll("reproduciendo");
        await p.waitForFunction(() => story.playback.activeSends.length > 0 || story.playback.activeNodeEffects.length > 0, null, { timeout: 8000 });
        await p.waitForTimeout(400); await shot(p, `r-${label}-${w}-play`);
        /* tokens dentro del canvas visible */
        const tok = await p.evaluate(() => { const r = document.getElementById("sv").getBoundingClientRect(), b = getBounds(), z = view.zoom;
          return { l: b.x * z + view.x, rt: (b.x + b.w) * z + view.x, t: b.y * z + view.y, bt: (b.y + b.h) * z + view.y, w: r.width, h: r.height }; });
        assert.ok(tok.l >= -1 && tok.rt <= tok.w + 1 && tok.t >= -1 && tok.bt <= tok.h + 1, "diagrama visible en el canvas: " + JSON.stringify(tok));
        await waitStory(p, "completed", 40000);
        await inView("#stPlay"); await inView("#stOpen"); await noHScroll("final");
        await shot(p, `r-${label}-${w}-fin`);
        await c.close();
      }
    }
    ok("responsive 390×844 · 768×1024 · 1366×768 · 1920×1080");

    /* ───────── Offline tras instalar el SW ───────── */
    const off = await newCtx({ serviceWorkers: "allow" });
    const oe = watch(await off.newPage());
    await oe.goto(base + "/");
    await oe.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined, null, { timeout: 15000 });
    await oe.evaluate(async () => { await navigator.serviceWorker.ready; });
    await until(oe, async () => { const k = await caches.keys(); return k.length === 1 && (await (await caches.open(k[0])).keys()).length > 30; });
    const cached = await oe.evaluate(async () => { const k = await caches.keys(); return { names: k, urls: (await (await caches.open(k[0])).keys()).map((r) => new URL(r.url).pathname) }; });
    assert.deepEqual(cached.names, [currentCache]);
    for (const f of ["/js/story-playback.js", "/js/scenario-engine.js", "/js/scenario-playback.js", "/js/viewer.js", "/s/"]) assert.ok(cached.urls.includes(f), f + " precacheado");
    await oe.evaluate(NEGOCIO);
    const offUrl = await oe.evaluate(() => createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id }));
    await off.setOffline(true);
    const op = watch(await off.newPage());
    await op.goto(offUrl);
    await op.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
    await op.locator("#stPlay").click(); await waitStory(op, "completed", 30000);
    assert.equal(await op.locator("#stCaption").innerText(), "Reproducción terminada");
    await off.setOffline(false);
    await off.close();
    ok("offline: instalar SW → abrir Share → reproducir sin red");

    /* ───────── Upgrade del SW desde la versión anterior ───────── */
    serveOld = true;
    const up = await newCtx({ serviceWorkers: "allow" });
    const upp = watch(await up.newPage());
    await upp.goto(base + "/");
    await until(upp, async () => (await caches.keys()).includes("fluyo-static-v56") && (await (await caches.open("fluyo-static-v56")).keys()).length > 30);
    const oldUrls = await upp.evaluate(async () => (await (await caches.open("fluyo-static-v56")).keys()).map((r) => new URL(r.url).pathname));
    assert.ok(!oldUrls.includes("/js/story-playback.js"), "la versión anterior no tenía el asset");
    serveOld = false;
    await upp.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await until(upp, async (c) => { const k = await caches.keys(); return k.length === 1 && k[0] === c && (await (await caches.open(c)).keys()).length > 30; }, currentCache);
    const newUrls = await upp.evaluate(async (c) => (await (await caches.open(c)).keys()).map((r) => new URL(r.url).pathname), currentCache);
    assert.ok(newUrls.includes("/js/story-playback.js"), "story-playback en la caché nueva: " + newUrls.length + " " + newUrls.filter((u) => u.includes("story")).join());
    await up.close();
    ok("upgrade del service worker v56 → " + currentCache.replace("fluyo-static-", ""));

    assert.deepEqual(errors, [], "sin excepciones de página: " + errors.join(" | "));
    assert.equal(umami.length, 0, "telemetría interceptada; en localhost no se envía nada");
    console.log(`\nFLUYO-014 browser: OK (${results.length} bloques). Capturas: ${shots}`);
  } finally {
    await browser.close(); server.close();
  }
})().catch((e) => { console.error("FALLO:", e && e.stack || e); process.exit(1); });
