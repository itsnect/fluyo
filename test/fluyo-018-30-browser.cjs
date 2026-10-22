"use strict";
/* FLUYO-018.30 — Chrome REAL: el Viewer abierto desde un enlace compartido (#d=) sigue el momento de la Historia en un teléfono.
   Números, no «se ve bien»: el tamaño en pantalla de las etiquetas del destino activo (espía de fillText), el zoom, si el momento en
   curso está en la zona libre (bajo el rótulo, sobre el mando) y si el rótulo tapa el destino.
   · Documentos: cliente-kafka-comercio (simple, sin ruta), el complejo de 017.1 (sin ruta, momentos de 5 elementos), B9 (ruta de Flujo
     y dependencia de llegada) y RAG + MCP (10 elementos, dependencias de llegada, 11 momentos).
   · Teléfono en vertical (390×844, 375×812): reproducir acerca a 0,6–1 y las etiquetas del destino pasan de 3–7 px a ≥ 9 px; cada
     momento que cabe se ve entero; el rótulo no tapa el destino; reproducción completa, pausa (la cámara quieta), ⏭/⏮ en pausa (cursor
     en `at`, G1), Repetir, Detener (vuelve al diagrama entero), arrastrar (toma la cámara) y ⏭ (la devuelve), girar (reencuadra).
   · Apaisado (844×390, 812×375): igual, con suelo 0,6; Present del Viewer: el momento sobre el mando.
   · Escritorio y tableta (1440×900, 1280×720, 768×1024): la vista NO cambia en toda la Historia (comportamiento aprobado).
   · Editor en 390: tocar una fila de la Historia sigue funcionando (sin cambios en el editor).
   Uso: node test/fluyo-018-30-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>; ONLY=<vp,...>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-30-"));
fs.mkdirSync(shots, { recursive: true });
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8"));
const DOCS = [
  ["simple", fixture("fluyo-017-1-cliente-kafka-comercio.fluyo.json")],
  ["complejo", fixture("fluyo-017-1-qa-complejo.fluyo.json")],
  ["ruta B9", fixture("fluyo-scenarios-semantics-6-b9.json")],
  ["RAG", fixture("step-message/rag-mcp.fluyo.json")],
];
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      const body = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const VIEWPORTS = [
  { key: "m390", width: 390, height: 844, touch: true, mobile: true, kind: "portrait", full: true },
  { key: "m375", width: 375, height: 812, touch: true, mobile: true, kind: "portrait" },
  { key: "l844", width: 844, height: 390, touch: true, mobile: true, kind: "landscape", full: true },
  { key: "l812", width: 812, height: 375, touch: true, mobile: true, kind: "landscape" },
  { key: "t768", width: 768, height: 1024, touch: true, kind: "wide" },
  { key: "d1440", width: 1440, height: 900, kind: "wide", full: true },
  { key: "d1280", width: 1280, height: 720, kind: "wide" },
];
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const frames = (p, n = 3) => p.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const still = async (p) => { await frames(p, 2); await p.waitForFunction(() => !window.__viewer.follow.moving, null, { timeout: 4000 }); await frames(p, 2); };
/* espía del lienzo: cada texto pintado con su tamaño EN PANTALLA (px CSS) y su posición */
const SPY = () => {
  if (window.__spy) { window.__spy.t = []; return; }
  window.__spy = { t: [] };
  const P = CanvasRenderingContext2D.prototype, ft = P.fillText;
  P.fillText = function (s, x, y, ...r) {
    const m = this.getTransform(), px = parseFloat((this.font.match(/([\d.]+)px/) || [])[1] || 0), dpr = this.canvas.fluyoDpr || 1;
    window.__spy.t.push({ px: px * Math.hypot(m.a, m.b) / dpr, x: (m.a * x + m.c * y + m.e) / dpr, y: (m.b * x + m.d * y + m.f) / dpr });
    return ft.call(this, s, x, y, ...r);
  };
};
/* el momento en curso: sus elementos en pantalla, si caben y están en la zona libre, si el rótulo los tapa y el tamaño de sus etiquetas */
const MOMENT = () => {
  const n = storyNav(), i = Math.max(0, n.index), box = followBoxes()[i], r = viewerFreeRect(), z = view.zoom;
  const at = FluyoStoryClock.momentTimes(story.scenario)[i], W = document.getElementById("wrap").getBoundingClientRect();
  const rects = [];
  for (const st of story.scenario.steps) {
    if (st.at !== at) continue;
    const ids = st.edgeId ? (() => { const e = edgeById(st.edgeId); return e ? [e.from, e.to] : []; })() : [st.nodeId];
    for (const id of ids) { const nd = nodeById(id); if (nd) rects.push({ l: (nd.x - nd.w / 2) * z + view.x, t: (nd.y - nd.h / 2) * z + view.y, r: (nd.x + nd.w / 2) * z + view.x, b: (nd.y + nd.h / 2) * z + view.y }); }
  }
  const fits = !!box && box.w * z <= r.width - 32 && box.h * z <= r.height - 32;
  const x0 = box ? box.x * z + view.x : 0, y0 = box ? box.y * z + view.y : 0;
  const inBox = !!box && x0 >= r.left - 1 && y0 >= r.top - 1 && x0 + box.w * z <= r.left + r.width + 1 && y0 + box.h * z <= r.top + r.height + 1;
  const focus = box && box.focus, fx = focus ? focus.x * z + view.x : 0, fy = focus ? focus.y * z + view.y : 0;
  const focusIn = !focus || (fx - (focus.hw || 0) * z >= -1 && fx + (focus.hw || 0) * z <= W.width + 1 && fy - (focus.hh || 0) * z >= r.top - 1 && fy + (focus.hh || 0) * z <= r.top + r.height + 1);
  const card = document.getElementById("stNow").getBoundingClientRect(), cl = card.left - W.left, ct = card.top - W.top;
  const covered = rects.some((q) => q.r > cl && q.l < cl + card.width && q.b > ct && q.t < ct + card.height);
  const inR = (t, q) => t.x >= q.l - 2 && t.x <= q.r + 2 && t.y >= q.t - 2 && t.y <= q.b + 30;
  const px = (window.__spy ? window.__spy.t : []).filter((t) => t.px > 0 && rects.some((q) => inR(t, q))).map((t) => t.px);
  return { i, zoom: z, fits, inBox, focusIn, covered, labelMin: px.length ? Math.min(...px) : null, n: rects.length };
};
const VIEW = (p) => p.evaluate(() => JSON.stringify(window.__viewer.view));
const FIT = (p) => p.evaluate(() => JSON.stringify(fitTarget()));
const near = (a, b) => { a = JSON.parse(a); b = JSON.parse(b); return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.zoom - b.zoom) < 1e-3; };

async function context(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 3 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  return ctx;
}
async function openViewer(browser, base, vp, payload) {
  const ctx = await context(browser, base, vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  await page.addInitScript(SPY);
  await page.goto(base + "/s/#d=" + payload);
  await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  await page.evaluate(() => document.fonts.ready); await frames(page, 4);
  return { ctx, page, errors };
}
const press = (t, vp, sel) => (vp.touch ? t.page.locator(sel).tap() : t.page.locator(sel).click());
const measure = async (p) => { await p.evaluate(SPY); await frames(p, 3); return p.evaluate(MOMENT); };

async function viewerCase(browser, base, vp, name, payload) {
  const t = await openViewer(browser, base, vp, payload);
  const p = t.page, tag = `${vp.key} ${name}`;
  const fit0 = await VIEW(p);
  const fitZoom = JSON.parse(fit0).zoom;
  /* la regla es de legibilidad, no de tipo de pantalla: se sigue si el diagrama entero sale por debajo de 0,6 (RAG en una tableta
     en vertical, sí; el simple en un teléfono apaisado, no) */
  const follows = fitZoom < 0.6;
  const inv = () => p.evaluate(() => JSON.stringify({ steps: storyScenario().steps, deps: storyScenario().arrivalDependencies || null, trace: FluyoStory.run(P(), storyScenario()) }));
  const inv0 = await inv();
  await p.evaluate(SPY); await frames(p, 3);
  const before = await p.evaluate(() => { const px = window.__spy.t.map((t) => t.px).filter((x) => x > 0); return px.length ? Math.min(...px) : null; });
  await press(t, vp, "#stPlay"); await still(p);
  const follow = await p.evaluate(() => window.__viewer.follow);
  const m0 = await measure(p);
  /* auditoría: en un teléfono en vertical, los cuatro documentos salen enteros a 0,26–0,44 (etiquetas de 3–7 px) */
  if (vp.kind === "portrait") check(follows, `${tag}: en vertical el diagrama entero sale a ${fitZoom.toFixed(3)} (etiquetas de ${before && before.toFixed(1)} px): se sigue el momento`);
  if (!follows) {
    check(follow.zoom === null && (await VIEW(p)) === fit0, `${tag}: el diagrama entero se lee (zoom ${fitZoom.toFixed(2)}, etiquetas de ${before && before.toFixed(1)} px): la cámara no toca la vista`);
  } else {
    check(m0.zoom >= 0.6 && m0.zoom <= 1 && Math.abs(m0.zoom - follow.zoom) < 1e-9, `${tag}: reproducir acerca a ${m0.zoom.toFixed(3)} (0,6–1)`);
    const floor = vp.kind === "portrait" ? 9 : 6;
    check(m0.labelMin !== null && m0.labelMin >= floor, `${tag}: etiquetas del destino ${m0.labelMin && m0.labelMin.toFixed(1)} px (≥ ${floor}; antes ${before && before.toFixed(1)})`);
    check(m0.fits ? m0.inBox : m0.focusIn, `${tag}: el primer momento a la vista (${m0.fits ? "entero" : "su primer elemento"})`);
    check(!m0.covered, `${tag}: el rótulo no tapa el destino`);
  }
  /* reproducción completa: en cada cambio de momento, el momento a la vista y el rótulo sin taparlo; la cámara solo se mueve al cambiar */
  if (vp.full) {
    /* tras cada cambio de momento se espera a que la cámara termine su transición (empieza en el fotograma siguiente) */
    let bad = [], lastIdx = await p.evaluate(() => storyNav().index), lastView = await VIEW(p), drift = 0, seen = 1;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      if (await p.evaluate(() => window.__viewer.story) !== "running") break;
      const idx = await p.evaluate(() => storyNav().index);
      if (idx !== lastIdx) {
        await still(p); seen++;
        const m = await p.evaluate(MOMENT);
        if (follows && ((m.fits && !m.inBox) || (!m.fits && !m.focusIn) || m.covered)) bad.push(m.i);
        if (!follows && (await VIEW(p)) !== fit0) bad.push("vista " + m.i);
        lastIdx = m.i; lastView = await VIEW(p);
      } else if (!(await p.evaluate(() => window.__viewer.follow.moving)) && (await VIEW(p)) !== lastView && (await p.evaluate(() => storyNav().index)) === lastIdx) drift++;
      await p.waitForTimeout(60);
    }
    check(seen >= 2, `${tag}: la reproducción recorre ${seen} momentos`);
    check(await p.evaluate(() => window.__viewer.story) === "completed", `${tag}: reproducción completa hasta «terminada»`);
    check(bad.length === 0, `${tag}: en toda la reproducción cada momento a la vista y sin rótulo encima` + (bad.length ? " — fallan " + bad.join(",") : ""));
    check(drift === 0, `${tag}: la cámara no se mueve dentro de un momento (nunca a cada fotograma)`);
    const done = await VIEW(p); await p.waitForTimeout(600);
    check((await VIEW(p)) === done, `${tag}: terminada, la vista se queda quieta`);
    await press(t, vp, "#stPlay"); await still(p);
    check(await p.evaluate(() => window.__viewer.story) === "running" && (!follows ? (await VIEW(p)) === fit0 : (await p.evaluate(MOMENT)).i === 0), `${tag}: Repetir vuelve al primer momento`);
  }
  /* pausa: la cámara quieta */
  if (await p.evaluate(() => window.__viewer.story) !== "running") { await press(t, vp, "#stPlay"); await still(p); }
  await press(t, vp, "#stPause"); await still(p);
  const paused = await VIEW(p); await p.waitForTimeout(700);
  check((await VIEW(p)) === paused && await p.evaluate(() => storyPaused()), `${tag}: en pausa la cámara no se mueve`);
  /* ⏭ / ⏮ en pausa: cada momento a la vista; cursor en at; revealAt (G1) */
  const n = await p.evaluate(() => FluyoStoryClock.momentTimes(story.scenario).length);
  let seekBad = [], g1 = true;
  for (let k = 0; k < Math.min(n, 12); k++) {
    if (await p.locator("#stNext").isDisabled()) break;
    await press(t, vp, "#stNext"); await still(p);
    const m = await measure(p);
    const at = await p.evaluate(() => { const nv = storyNav(); return { ok: story.playback.cursorVirtual === nv.times[nv.index], reveal: typeof story.playback.revealAt === "number" }; });
    if (!at.ok || !at.reveal) g1 = false;
    if (follows && ((m.fits && !m.inBox) || (!m.fits && !m.focusIn) || m.covered)) seekBad.push(m.i);
    if (!follows && (await VIEW(p)) !== fit0) seekBad.push("vista " + m.i);
  }
  check(seekBad.length === 0, `${tag}: ⏭ en pausa — cada momento a la vista` + (seekBad.length ? " — fallan " + seekBad.join(",") : ""));
  check(g1, `${tag}: ⏭ deja el cursor exactamente en at y el momento revelado (G1)`);
  await press(t, vp, "#stPrev"); await still(p);
  const mp = await measure(p);
  check(!follows ? (await VIEW(p)) === fit0 : (mp.fits ? mp.inBox : mp.focusIn), `${tag}: ⏮ — el momento anterior a la vista`);
  await page_shot(p, `${vp.key}-${name}-pausa`);
  /* arrastrar toma la cámara; ⏭ la devuelve */
  if (follows) {
    const box = await p.locator("#sv").boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 4 }); await p.mouse.up();
    const mine = await VIEW(p);
    check(!(await p.evaluate(() => window.__viewer.follow.on)), `${tag}: arrastrar toma la cámara`);
    await press(t, vp, "#stPause"); await p.waitForTimeout(900); await still(p);
    check((await VIEW(p)) === mine, `${tag}: reanudar no le quita la vista a quien la movió`);
    await press(t, vp, "#stPause");
    if (!(await p.locator("#stNext").isDisabled())) {
      await press(t, vp, "#stNext"); await still(p);
      const mn = await measure(p);
      check(await p.evaluate(() => window.__viewer.follow.on) && (mn.fits ? mn.inBox : mn.focusIn), `${tag}: ⏭ devuelve la cámara a la Historia (el momento a la vista)`);
    }
  }
  /* Detener: el diagrama entero otra vez */
  await press(t, vp, "#stStop"); await still(p);
  const vStop = await VIEW(p), fStop = await FIT(p);
  check(near(vStop, fStop) && near(vStop, fit0) && await p.evaluate(() => window.__viewer.story) === "ready", `${tag}: Detener vuelve al diagrama entero (el encuadre de al abrir)` + (near(vStop, fStop) ? "" : ` — ${vStop} ≠ ${fStop}`));
  check((await inv()) === inv0, `${tag}: Steps, dependencias y Trace intactos`);
  check(t.errors.length === 0, `${tag}: sin errores de consola` + (t.errors.length ? " — " + t.errors[0] : ""));
  await t.ctx.close();
}
async function page_shot(p, name) { try { await p.screenshot({ path: path.join(shots, name.replace(/\s+/g, "_") + ".png") }); } catch {} }

/* girar el teléfono reproduciendo: 390×844 → 844×390 → 390×844 */
async function rotation(browser, base, payload, name) {
  const vp = VIEWPORTS[0], t = await openViewer(browser, base, vp, payload), p = t.page, tag = `giro ${name}`;
  await press(t, vp, "#stPlay"); await still(p);
  await press(t, vp, "#stPause"); await press(t, vp, "#stNext"); await still(p);
  for (const [w, h] of [[844, 390], [390, 844]]) {
    await p.setViewportSize({ width: w, height: h }); await frames(p, 6); await still(p);
    const m = await measure(p), f = await p.evaluate(() => window.__viewer.follow);
    check(f.on && m.zoom >= 0.6 && (m.fits ? m.inBox : m.focusIn) && !m.covered, `${tag} a ${w}×${h}: la cámara sigue y el momento ${m.i} está a la vista (zoom ${m.zoom.toFixed(3)})`);
    await page_shot(p, `giro-${name}-${w}x${h}`);
  }
  check(t.errors.length === 0, `${tag}: sin errores de consola` + (t.errors.length ? " — " + t.errors[0] : ""));
  await t.ctx.close();
}
/* Present del Viewer en apaisado: reproducir dentro del mando; el momento sobre el mando y bajo el rótulo */
async function presentCase(browser, base, payload, name) {
  const vp = VIEWPORTS[2], t = await openViewer(browser, base, vp, payload), p = t.page, tag = `Present l844 ${name}`;
  await press(t, vp, "#btnPresent"); await frames(p, 6);
  check(await p.evaluate(() => window.__viewer.presenting), `${tag}: presentando`);
  await press(t, vp, "#stPlay"); await still(p);
  const f = await p.evaluate(() => window.__viewer.follow);
  const m = await measure(p);
  const bar = await p.evaluate(() => { const b = document.getElementById("prBar").getBoundingClientRect(), W = document.getElementById("wrap").getBoundingClientRect(); return b.top - W.top; });
  const boxBottom = await p.evaluate(() => { const i = Math.max(0, storyNav().index), b = followBoxes()[i]; return (b.y + b.h) * view.zoom + view.y; });
  check(f.zoom === null || (m.zoom >= 0.6 && (m.fits ? m.inBox && boxBottom <= bar : m.focusIn)), `${tag}: ${f.zoom === null ? "sin seguir (se lee entero)" : "el momento sobre el mando (zoom " + m.zoom.toFixed(3) + ")"}`);
  await press(t, vp, "#stPause"); await press(t, vp, "#stNext"); await still(p);
  const m2 = await measure(p);
  check(f.zoom === null || (m2.fits ? m2.inBox : m2.focusIn), `${tag}: ⏭ presentando — el momento a la vista`);
  await page_shot(p, `present-${name}`);
  await p.evaluate(() => exitPresent()); await frames(p, 4);
  check(near(await VIEW(p), await FIT(p)) && !(await p.evaluate(() => window.__viewer.presenting)), `${tag}: al salir, el diagrama entero`);
  check(t.errors.length === 0, `${tag}: sin errores de consola` + (t.errors.length ? " — " + t.errors[0] : ""));
  await t.ctx.close();
}
/* prefers-reduced-motion: sin transición */
async function reducedCase(browser, base, payload) {
  const vp = VIEWPORTS[0], ctx = await context(browser, base, vp);
  const p = await ctx.newPage(); await p.emulateMedia({ reducedMotion: "reduce" });
  await p.goto(base + "/s/#d=" + payload); await p.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  await p.locator("#stPlay").tap(); await frames(p, 2);
  const f = await p.evaluate(() => window.__viewer.follow), z = JSON.parse(await VIEW(p)).zoom;
  check(!f.moving && z >= 0.6, `prefers-reduced-motion: la cámara salta sin transición (zoom ${z.toFixed(3)})`);
  await ctx.close();
}
/* el editor en 390: tocar una fila de la Historia sigue llevando a su momento (el editor no cambia en esta tarea) */
async function editorRow(browser, base, fx) {
  const vp = VIEWPORTS[0], ctx = await context(browser, base, vp), p = await ctx.newPage(), errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/");
  await p.waitForFunction(() => typeof scRun === "function" && typeof cv !== "undefined");
  if (await p.locator("#autosaveModal").isVisible().catch(() => false)) await p.locator("#autosaveDiscard").click();
  await p.evaluate((d) => { applyProjectData(d); fitView(); clearSel(); renderTabs(); }, fx);
  await p.locator("#btnStories").tap(); await p.waitForTimeout(250);
  await p.evaluate(() => { scSelectStory(P().scenarios[0].id); scRenderPanel(); }); await p.waitForTimeout(200);
  await p.locator("#btnStoryExpand").tap(); await p.waitForTimeout(250);
  const rows = p.locator(".scStoryRow .scStepPrimary"), count = await rows.count();
  let ok = count > 2;
  if (ok) {
    await rows.nth(2).tap(); await p.waitForTimeout(350);
    const r = await p.evaluate(() => ({ sel: scSelectedStep, id: document.querySelectorAll(".scStoryRow")[2].dataset.stepId, playing: typeof isScenarioPlaybackActive === "function" && isScenarioPlaybackActive() }));
    ok = String(r.sel) === String(r.id);
    await p.locator("#scRun").tap(); await p.waitForTimeout(500);
    ok = ok && await p.evaluate(() => scStatus === "running");
  }
  check(ok && errors.length === 0, `editor 390: tocar una fila de la Historia sigue funcionando (${count} filas)` + (errors.length ? " — " + errors[0] : ""));
  await ctx.close();
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    /* los enlaces compartidos, creados por el editor como los crea quien comparte (la Historia elegida va primero) */
    const ectx = await context(browser, base, { width: 1280, height: 800 }), ep = await ectx.newPage();
    await ep.goto(base + "/");
    await ep.waitForFunction(() => typeof createShareUrl === "function" && typeof applyProjectData === "function");
    if (await ep.locator("#autosaveModal").isVisible().catch(() => false)) await ep.locator("#autosaveDiscard").click();
    const payloads = {};
    for (const [name, d] of DOCS)
      payloads[name] = await ep.evaluate(async (d) => { applyProjectData(d); doc.cur = 0; const sc = P().scenarios.find((s) => s.steps.length); return new URL(await createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: sc.id })).hash.slice(3); }, d);
    await ectx.close();
    for (const vp of VIEWPORTS) {
      if (ONLY.length && !ONLY.includes(vp.key)) continue;
      console.log(`\n── ${vp.key} (${vp.width}×${vp.height})`);
      for (const [name] of DOCS) await viewerCase(browser, base, vp, name, payloads[name]);
    }
    if (!ONLY.length || ONLY.includes("extra")) {
      console.log("\n── giro, Present, movimiento reducido, editor");
      await rotation(browser, base, payloads["RAG"], "RAG");
      await rotation(browser, base, payloads["ruta B9"], "B9");
      await presentCase(browser, base, payloads["RAG"], "RAG");
      await presentCase(browser, base, payloads["ruta B9"], "B9");
      await reducedCase(browser, base, payloads["RAG"]);
      await editorRow(browser, base, DOCS[3][1]);
    }
  } finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.30 browser: ${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
