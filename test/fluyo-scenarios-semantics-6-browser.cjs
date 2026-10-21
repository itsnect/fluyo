"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 6 — QA en Chrome real, a 1440 (ratón) y a 390 px (dedo). Se sirven el árbol y la base a4bbf2f (producción
   v100), con el service worker bloqueado salvo en el smoke de actualización.
   · B9  El fixture de la QA del PO (test/fixtures/fluyo-scenarios-semantics-6-b9.json, cuatro Historias) en el editor (sin bandera), en su
         Present y en el Viewer, en pausa en 2,9 · 3,3 · 3,65 s: la línea de estado, la funda de Cola → Worker B, el pedido en camino, su
         llegada y el estado de Worker B son los de § T (la semántica que el PO juzga), y el Viewer pinta exactamente lo del editor en el
         mismo instante. La Historia 3 se mide también en 3,6 s (el BORDE: B9 según el PO) y la 4 queda fuera de B9 (el envío ya falló).
         FLUYO_SHOTS=dir guarda las capturas (fuera del repo: es público).
   · AUTO «Automática · nombre» entero con el selector cerrado a 390, 768 y 1440 (apilado); con espacio, la fila de siempre.
   · FLAG La bandera labs se retiró: sin parámetro, con ?labs=escenarios, con ?labs=off y con la clave antigua guardada, lo mismo
         (Semántica y W5 en Propiedades, la herramienta, la ruta en el editor y en Present).
   · B1  Pegar `fluyo::` con un Behavior UNKNOWN (evento de pegado real): en a4bbf2f pega y el documento ya no se puede leer; en el árbol
         no pega nada, no apila Undo y no hay errores. Un pegado válido sigue igual (dos nodos, una entrada de Undo).
   · SW  De a4bbf2f (v100) al árbol (v101): instalada y activada, la anterior borrada; la caché sirve el pegado nuevo.
   Sin errores de consola en ningún paso.
   Uso: node test/fluyo-scenarios-semantics-6-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome o FLUYO_CHROME=ruta) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "a4bbf2f";
const SHOTS = process.env.FLUYO_SHOTS || null;
const FIX = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "fluyo-scenarios-semantics-6-b9.json"), "utf8"));
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss6-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(browser, base, vp, url, { touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); }); page.on("dialog", (d) => d.accept());
  await page.goto(base + url);
  return { ctx, page, errors };
}
async function openEditor(browser, base, vp, query, opts) {
  const T = await open(browser, base, vp, "/" + query, opts);
  await T.page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  await T.page.evaluate(() => document.fonts.ready);
  return T;
}
/* lo que el editor (o su Present) enseña en el instante t, en pausa (la receta de FASE 4/5) */
async function editorAt(T, t, present) {
  await T.page.evaluate((present) => { if (scStatus === "idle") scRun(present ? { present: true } : undefined); scPause(); }, present);
  await T.page.evaluate((t) => { scSeekMoment(0); scClock.pausedAt = scClock.pausedAt - (scPlayback.cursorVirtual || 0) + t; FluyoScenarioPlayback.tick(scPlayback, scNow()); scRenderButtons(); scRenderStatus(); if (typeof presentStoryRefresh === "function") presentStoryRefresh(); }, t);
  await frames(T.page, 3);
  return T.page.evaluate(() => {
    const f = scFlowOverlay(), r = FluyoScenarioPlayback.tick(scPlayback, scNow());
    const vis = (s) => { const el = document.querySelector(s); return !!el && !el.hidden && getComputedStyle(el).display !== "none"; };
    const a = r.activeSends.find((s) => s.edgeId === 14), c = r.completedSends.find((s) => s.edgeId === 14);
    return { overlay: f ? { edges: f.edges, sweep: !!f.sweep, pips: f.pips } : null, shell: f && f.edges[14] ? f.edges[14].cls : null,
      token: a ? a.terminalType : null, arrived: c ? c.terminalType : null, wb: r.nodeStates[5] || "UP",
      tool: vis("#scFlowState") ? document.querySelector("#scFlowWord").textContent : null, ps: vis("#psFlow") ? document.querySelector("#psFlow").textContent : null };
  });
}
async function viewerAt(V, t) {
  await V.page.evaluate((t) => { if (!story || story.status !== "running") storyPlay(); FluyoStoryClock.pause(story.clock, performance.now()); story.clock.pausedAt = story.playback.startedAtReal + t; renderViewerFrame(); }, t);
  await frames(V.page, 3);
  return V.page.evaluate(() => { const f = storyFlowOverlay(), el = document.querySelector("#stFlow");
    return { overlay: f ? { edges: f.edges, sweep: !!f.sweep, pips: f.pips } : null, line: el && !el.hidden ? el.textContent : null }; });
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); };

/* Lo esperado en cada Historia (§ T, la semántica actual que el PO juzga): [t, línea, funda de Cola → Worker B, envío en camino, llegada, Worker B] */
const EXPECT = {
  1: [[2900, "AVAILABLE", "AVAILABLE", "send_succeeded", null, "UP"], [3300, "UNAVAILABLE", "UNAVAILABLE", "send_succeeded", null, "DOWN"], [3600, "UNAVAILABLE", "UNAVAILABLE", null, "send_succeeded", "DOWN"], [3650, "UNAVAILABLE", "UNAVAILABLE", null, "send_succeeded", "DOWN"]],
  2: [[2900, "AVAILABLE", "AVAILABLE", "send_succeeded", null, "UP"], [3300, "UNAVAILABLE", "UNAVAILABLE", "send_succeeded", null, "UP"], [3650, "UNAVAILABLE", "UNAVAILABLE", null, "send_succeeded", "UP"]],
  3: [[2900, "AVAILABLE", "AVAILABLE", "send_succeeded", null, "UP"], [3300, "AVAILABLE", "AVAILABLE", "send_succeeded", null, "UP"], [3650, "UNAVAILABLE", "UNAVAILABLE", null, "send_succeeded", "DOWN"]],
  4: [[2900, "UNAVAILABLE", "UNAVAILABLE", "send_failed", null, "DOWN"], [3300, "AVAILABLE", "AVAILABLE", "send_failed", null, "UP"], [3650, "AVAILABLE", "AVAILABLE", null, "send_failed", "UP"]],
};
const NOTE = { 1: "B9 en vuelo", 2: "B9 en vuelo (ruta ≠ salto)", 3: "B9 en el BORDE: a 3,6 s llega «completado» y Worker B cae en el mismo instante", 4: "NO es B9: el envío ya había fallado al salir" };
const WORD = { AVAILABLE: "Ruta disponible", UNAVAILABLE: "Ruta no disponible" };

async function b9(browser, now, vp, label, touch) {
  console.log("\n── B9 · " + label + " (" + vp.width + " px)");
  const payloads = {};
  for (const present of [false, true]) for (const sid of [1, 2, 3, 4]) {
    const T = await openEditor(browser, now.base, vp, "", { touch });
    await T.page.evaluate((d) => { applyProjectData(d); clearSel(); }, FIX);
    if (!payloads[sid]) payloads[sid] = await T.page.evaluate(async (sid) => new URL(await createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: sid })).hash.slice(3), sid);
    await T.page.evaluate((sid) => { switchPanelTab("scenarios"); scSelectStory(sid); scRenderPanel(); }, sid);
    if (present) await T.page.evaluate(() => enterPresent());
    const rows = [];
    for (const [t, line, shell, token, arrived, wb] of EXPECT[sid]) {
      const x = await editorAt(T, t, present);
      await shot(T.page, `b9-${vp.width}-h${sid}-${present ? "present" : "editor"}-${t}`);
      const text = present ? x.ps : x.tool;
      rows.push(x.shell === shell && x.token === token && x.arrived === arrived && x.wb === wb && typeof text === "string" && text.startsWith(WORD[line]));
      if (!rows[rows.length - 1]) console.log("    " + JSON.stringify({ t, shell: x.shell, token: x.token, arrived: x.arrived, wb: x.wb, text }));
    }
    check(rows.every(Boolean) && T.errors.length === 0, `${present ? "Present" : "editor"} (sin bandera) · «${FIX.doc.pages[0].scenarios[sid - 1].name}» (${NOTE[sid]}): línea, funda, pedido y llegada de § T a ${EXPECT[sid].map((r) => r[0] / 1000).join(" · ")} s`);
    await T.ctx.close();
  }
  for (const sid of [1, 2, 3, 4]) {
    const T = await openEditor(browser, now.base, vp, "", { touch });
    await T.page.evaluate((d) => { applyProjectData(d); clearSel(); }, FIX);
    await T.page.evaluate((sid) => { switchPanelTab("scenarios"); scSelectStory(sid); scRenderPanel(); }, sid);
    const V = await open(browser, now.base, vp, "/s/#d=" + payloads[sid], { touch });
    await V.page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready"); await V.page.evaluate(() => document.fonts.ready);
    const same = [];
    for (const [t, line] of EXPECT[sid]) {
      const e = await editorAt(T, t, false), v = await viewerAt(V, t);
      await shot(V.page, `b9-${vp.width}-h${sid}-viewer-${t}`);
      same.push(JSON.stringify(v.overlay) === JSON.stringify(e.overlay) && typeof v.line === "string" && v.line.startsWith(WORD[line]));
    }
    check(same.every(Boolean) && V.errors.length === 0 && T.errors.length === 0, `Viewer (sin bandera) · Historia ${sid}: la misma ruta que el editor en el mismo instante y la misma línea`);
    await V.ctx.close(); await T.ctx.close();
  }
}

/* «Automática · nombre» (decisión 252): con el selector cerrado, el texto elegido cabe entero; en la herramienta estrecha, origen y destino
   apilados (destino debajo); con espacio (la herramienta forzada a 600 px), la fila de siempre. */
async function autoName(browser, now) {
  console.log("\n── «Automática · nombre» a 390, 768 y 1440");
  for (const [vp, touch] of [[{ width: 390, height: 844 }, true], [{ width: 768, height: 1024 }, true], [{ width: 1440, height: 900 }, false]]) {
    const T = await openEditor(browser, now.base, vp, "", { touch });
    await T.page.evaluate((d) => { applyProjectData(d); clearSel(); }, FIX);
    /* Historias con el gesto real: el botón de la hoja (teléfono) o la pestaña (tableta y escritorio) */
    const btn = await T.page.evaluate(() => { const b = document.getElementById("btnStories"); return !!b && !!b.offsetParent ? "#btnStories" : "#tabScenarios"; });
    await T.page.click(btn); await T.page.waitForFunction(() => document.body.classList.contains("storyMode")); await T.page.waitForTimeout(450);
    await T.page.evaluate(() => { scSelectStory(1); scRenderPanel(); scRenderFlow(); });
    await frames(T.page, 3);
    const vis = await T.page.evaluate(() => { const r = document.getElementById("scFlow").getBoundingClientRect(); return r.width > 0 && r.bottom <= innerHeight && r.top >= 0; });
    check(vis, `${vp.width}: la herramienta se ve en pantalla al abrir Historias (${btn})`);
    const m = await T.page.evaluate(() => {
      const c = document.createElement("canvas").getContext("2d");
      const fit = (id) => { const el = document.getElementById(id), cs = getComputedStyle(el); c.font = cs.font;
        const text = el.selectedOptions[0].text, need = Math.ceil(c.measureText(text).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 22);
        const r = el.getBoundingClientRect(); return { text, need, w: Math.round(r.width), top: Math.round(r.top), left: Math.round(r.left) }; };
      const flow = document.getElementById("scFlow"), out = { from: fit("scFlowFrom"), to: fit("scFlowTo"), tool: Math.round(flow.getBoundingClientRect().width), h: Math.round(flow.getBoundingClientRect().height) };
      flow.style.width = "600px"; out.wide = { from: fit("scFlowFrom"), to: fit("scFlowTo") }; flow.style.width = "";
      return out;
    });
    const whole = m.from.need <= m.from.w && m.to.need <= m.to.w;
    check(m.from.text === "Automática · Cliente" && m.to.text === "Automática · BD" && whole,
      `${vp.width}: «${m.from.text}» (${m.from.need} de ${m.from.w} px) y «${m.to.text}» (${m.to.need} de ${m.to.w} px) enteros, con el selector cerrado`);
    check(m.to.top > m.from.top && m.to.left === m.from.left, `${vp.width}: herramienta de ${m.tool} px → origen y destino apilados (alto ${m.h} px)`);
    check(m.wide.to.top === m.wide.from.top && m.wide.to.left > m.wide.from.left, `${vp.width}: con espacio (600 px), la fila de siempre`);
    await T.page.locator("#scFlow").screenshot({ path: SHOTS ? path.join(SHOTS, `auto-${vp.width}.png`) : undefined });
    check(T.errors.length === 0, `${vp.width}: 0 errores`);
    await T.ctx.close();
  }
}

/* La bandera labs se retiró (decisión 253): sin parámetro, con ?labs=escenarios y con ?labs=off, lo mismo. Semántica y W5 en Propiedades,
   la herramienta, la ruta en el lienzo y en Present; y el almacenamiento antiguo («fluyo.labs.escenarios» = "1" o ausente) no cuenta. */
async function noFlag(browser, now) {
  console.log("\n── sin la bandera labs (retirada)");
  const probe = async (query, stored, touch) => {
    const vp = touch ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const T = await openEditor(browser, now.base, vp, query, { touch });
    if (stored) { await T.page.evaluate(() => { try { localStorage.setItem("fluyo.labs.escenarios", "1"); } catch (e) {} }); await T.page.reload(); await T.page.waitForFunction(() => typeof applyProjectData === "function"); }
    const d = JSON.parse(JSON.stringify(FIX)); d.doc.pages[0].edges.find((e) => e.id === 14).startArrow = true; d.doc.pages[0].edges.find((e) => e.id === 14).endArrow = false;
    await T.page.evaluate((d) => { applyProjectData(d); clearSel(); selectOnly("edge", 14); refreshPanel(); }, d);
    const props = await T.page.evaluate(() => ({ kind: getComputedStyle(document.getElementById("rowKind")).display !== "none", seg: document.querySelector("#kindSeg [aria-checked=\"true\"]")?.dataset.v || null, w5: !document.getElementById("kindNote").hidden }));
    await T.page.evaluate(() => { clearSel(); switchPanelTab("scenarios"); scSelectStory(1); scRenderPanel(); scRenderFlow(); });
    const tool = await T.page.evaluate(() => { const f = document.getElementById("scFlow"); return !f.hidden && getComputedStyle(f).display !== "none"; });
    const ed = await editorAt(T, 3300, false);
    await T.page.evaluate(() => { scReset(); enterPresent(); scSelectStory(1); });
    const pr = await editorAt(T, 3300, true);
    const out = { props, tool, edShell: ed.shell, prShell: pr.shell, ps: pr.ps, overlay: JSON.stringify(ed.overlay), errors: T.errors.length };
    await T.ctx.close();
    return out;
  };
  for (const touch of [false, true]) {
    const a = await probe("", false, touch), b = await probe("?labs=escenarios", false, touch), c = await probe("?labs=off", false, touch), s = await probe("", true, touch);
    const w = touch ? "390" : "1440";
    check(a.props.kind && a.props.seg === "FLOWS_TO" && a.props.w5, `${w} sin parámetro: «Semántica» (Flujo) y el aviso W5 en Propiedades`);
    check(a.tool && a.edShell === "UNAVAILABLE" && a.prShell === "UNAVAILABLE" && typeof a.ps === "string" && a.ps.startsWith("Ruta no disponible"), `${w} sin parámetro: la herramienta, la ruta en el lienzo del editor y en Present («${a.ps}»)`);
    const same = [b, c, s].every((x) => JSON.stringify([x.props, x.tool, x.edShell, x.prShell, x.ps, x.overlay]) === JSON.stringify([a.props, a.tool, a.edShell, a.prShell, a.ps, a.overlay]));
    check(same, `${w}: ?labs=escenarios, ?labs=off y la clave antigua en el almacenamiento dan exactamente lo mismo`);
    check(a.errors + b.errors + c.errors + s.errors === 0, `${w}: 0 errores`);
  }
}

/* B1: un pegado real («paste» con text/plain `fluyo::…»), como lo recibe interaction.js */
const BAD = "fluyo::" + JSON.stringify({ nodes: [{ id: 1, shape: "rect", x: 100, y: 100, w: 140, h: 60, label: "A" }, { id: 2, shape: "rect", x: 300, y: 100, w: 140, h: 60, label: "B" }],
  edges: [{ id: 3, from: 1, to: 2, route: "straight", fromSide: null, toSide: null, waypoints: [] }], behaviors: [{ nodeId: 2, initialState: "UNKNOWN" }] });
const GOOD = BAD.replace('"UNKNOWN"', '"DOWN"');
async function pasteCase(browser, srv, text) {
  const T = await openEditor(browser, srv.base, { width: 1440, height: 900 }, "");
  await T.page.evaluate(() => { applyProjectData({ version: 5, app: "fluyo", doc: { theme: "crema", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0,
    pages: [{ name: "P", nextId: 5, behaviors: [], nextScenarioId: 1, scenarios: [], nodes: [{ id: 1, shape: "rect", x: 200, y: 300, w: 140, h: 60, label: "X" }], edges: [] }] }, settings: {} }); clearSel(); });
  const r = await T.page.evaluate((text) => {
    const before = { nodes: P().nodes.length, undo: undoStack.length };
    const dt = new DataTransfer(); dt.setData("text/plain", text);
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    let readable = true; try { projectFromProjectData(JSON.parse(JSON.stringify(serializeProject()))); } catch (e) { readable = false; }
    return { before, after: { nodes: P().nodes.length, undo: undoStack.length }, readable };
  }, text);
  await T.ctx.close();
  return Object.assign(r, { errors: T.errors });
}
async function paste(browser, now, old) {
  console.log("\n── B1 · pegar `fluyo::` con un Behavior UNKNOWN");
  const o = await pasteCase(browser, old, BAD), n = await pasteCase(browser, now, BAD), g = await pasteCase(browser, now, GOOD);
  check(o.after.nodes === o.before.nodes + 2 && !o.readable, BASE + ": pega los dos nodos y el documento ya no se puede leer (el bug)");
  check(n.after.nodes === n.before.nodes && n.after.undo === n.before.undo && n.readable && n.errors.length === 0, "árbol: no pega nada, no apila Undo, el documento se sigue leyendo y no hay errores");
  check(g.after.nodes === g.before.nodes + 2 && g.after.undo === g.before.undo + 1 && g.readable && g.errors.length === 0, "árbol: el mismo pegado con DOWN pega dos nodos con una entrada de Undo");
}

(async () => {
  const t0 = Date.now();
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const oldDir = treeAt(BASE);
  const now = await serve(root), old = await serve(oldDir);
  const launch = process.env.FLUYO_CHROME ? { executablePath: process.env.FLUYO_CHROME } : { channel: process.env.FLUYO_BROWSER || "chrome" };
  const browser = await chromium.launch(Object.assign({ headless: !process.env.HEADED }, launch));
  try {
    await b9(browser, now, { width: 1440, height: 900 }, "escritorio", false);
    await b9(browser, now, { width: 390, height: 844 }, "teléfono", true);
    await autoName(browser, now);
    await noFlag(browser, now);
    await paste(browser, now, old);
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
        const installed = (name) => until(async (name) => { if (!(await caches.keys()).includes(name)) return false; const c = await caches.open(name); return !!(await c.match(location.origin + "/js/selection.js")); }, name, name);
        const activated = () => until(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !r.installing && !r.waiting && !!r.active && r.active.state === "activated"; }, null, "activado");
        await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
        await installed(PREV); await activated();
        check(true, BASE + ": " + PREV + " instalada y activa");
        sw.state.dir = root;
        await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
        await installed(CUR); await activated();
        await until(async (p) => !(await caches.keys()).includes(p), PREV, "la anterior borrada");
        const cached = await pg.evaluate(async (cur) => { const c = await caches.open(cur);
          const s = await (await c.match(location.origin + "/js/selection.js")).text(), m = await (await c.match(location.origin + "/js/model.js")).text();
          return { keys: await caches.keys(), paste: s.includes("try{ r=cloneStructureIn(P(), clip, {dx:GRID, dy:GRID}); }"), model: m.includes('throw projectDataError("invalid_document","behaviors")') }; }, CUR);
        check(CUR !== PREV && cached.keys.join() === CUR && cached.paste && cached.model, `${CUR} instalada y activada, ${PREV} borrada; la caché sirve el pegado de FASE 6 (selection.js, model.js)`);
      } finally { await ctx.close(); sw.server.close(); }
    }
  } finally {
    await browser.close(); now.server.close(); old.server.close();
    fs.rmSync(oldDir, { recursive: true, force: true });
  }
  console.log(`\n${passed} ✔ · ${failed} ✘ (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
