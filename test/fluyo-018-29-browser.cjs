"use strict";
/* FLUYO-018.29 — Chrome REAL: R1 (alto real del encabezado de Present) y G1 (saltar en pausa enseña el momento entero).
   Números, no «se ve bien».
   · R1 (Present del editor), con Historia con ruta de Flujo (B9), la misma sin `kind` y el complejo de 017.1: en lista, reproduciendo,
     en pausa en CADA momento y terminada, el borde inferior del encabezado nunca pasa de la caja del diagrama (que lleva su aire),
     ningún elemento queda debajo del encabezado y el encuadre NO cambia al reproducir (sin salto).
   · G1 (Editor, Present y Viewer): ⏭ / ⏮ en pausa → en el PRIMER fotograma el lienzo pinta el cue del momento con alpha 1 y el
     `message` del paso con alpha 1; el cursor queda exactamente en `at`. Reanudar sigue desde `at` sin parpadeo. Reproduciendo,
     saltar conserva la entrada del cue (alpha < 1 al principio). Trace, horario, dependencias y documento intactos.
   Viewports: 1440×900 y 1280×720 (ratón), 768×1024 (dedo), 390×844 y 375×812 (móvil), 844×390 y 812×375 (apaisado).
   Uso: node test/fluyo-018-29-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>; ONLY=<vp>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-29-"));
fs.mkdirSync(shots, { recursive: true });
const fixture = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8"));
const MSG = "Worker A deja de aceptar pedidos";
const B9 = fixture("fluyo-scenarios-semantics-6-b9.json");
B9.doc.pages[0].scenarios[0].steps.find((s) => s.id === 2).message = MSG;
const NOFLOW = JSON.parse(JSON.stringify(B9)); for (const e of NOFLOW.doc.pages[0].edges) delete e.kind;
const CX = fixture("fluyo-017-1-qa-complejo.fluyo.json");
CX.doc.pages[0].scenarios[0].steps.find((s) => s.id === 2).message = "El banco rechaza la operación";
const DOCS = [["con ruta (B9)", B9, 1, MSG], ["sin ruta (B9 sin kind)", NOFLOW, 1, MSG], ["complejo 017.1", CX, null, "El banco rechaza la operación"]];
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
  { key: "d1440", width: 1440, height: 900 },
  { key: "d1280", width: 1280, height: 720 },
  { key: "t768", width: 768, height: 1024, touch: true },
  { key: "m390", width: 390, height: 844, touch: true, mobile: true },
  { key: "m375", width: 375, height: 812, touch: true, mobile: true },
  { key: "l844", width: 844, height: 390, touch: true, mobile: true },
  { key: "l812", width: 812, height: 375, touch: true, mobile: true },
];
const G1_VPS = ["d1440", "m390", "l844", "l812"];
const ONLY = process.env.ONLY || "";
const frames = (p, n = 3) => p.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function context(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  return ctx;
}
async function open(browser, base, vp, url = "/") {
  const ctx = await context(browser, base, vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  await page.goto(base + url);
  return { ctx, page, errors };
}
async function openEditor(browser, base, vp, fx, sid) {
  const t = await open(browser, base, vp);
  await t.page.waitForFunction(() => typeof scRun === "function" && typeof FluyoStoryClock === "object" && typeof cv !== "undefined");
  if (await t.page.locator("#autosaveModal").isVisible().catch(() => false)) await t.page.locator("#autosaveDiscard").click();
  await t.page.evaluate(() => document.fonts.ready);
  await t.page.evaluate(([d, sid]) => { applyProjectData(d); fitView(); clearSel(); renderTabs(); switchPanelTab("scenarios"); if (sid) scSelectStory(sid); scRenderPanel(); }, [fx, sid]);
  await frames(t.page);
  return t;
}
/* espía del lienzo: qué cues recibe render.js (nodeRuntimeCues) y con qué alpha se pinta cada texto (fillText) */
const SPY = () => {
  if (window.__spy) { window.__spy.cues = []; window.__spy.texts = []; return; }
  window.__spy = { cues: [], texts: [] };
  const orig = window.nodeRuntimeCues;
  window.nodeRuntimeCues = function (n, sr) { const out = orig(n, sr); for (const q of out) window.__spy.cues.push({ node: n.id, alpha: q.alpha, enter: q.enter, msg: q.fx.message || "" }); return out; };
  const ft = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) { window.__spy.texts.push({ text: String(text), alpha: this.globalAlpha }); return ft.call(this, text, ...rest); };
};
const press = async (t, vp, sel) => {
  const l = t.page.locator(sel).first();
  if (await l.isVisible().catch(() => false)) { if (vp.touch) await l.tap(); else await l.click(); }
  else await t.page.evaluate((s) => document.querySelector(s).click(), sel);
};
const invariants = (page, sid) => page.evaluate(() => {
  const sc = scActiveScenario(), meta = FluyoStory.stepMeta(sc.steps);
  return JSON.stringify({ steps: sc.steps, deps: sc.arrivalDependencies || null, trace: FluyoStory.run(P(), sc), schedule: FluyoStoryClock.schedule(sc, meta), doc: serializeProject(), undo: undoStack.length });
});

/* ───────── R1: Present del editor ───────── */
async function r1(browser, base, vp) {
  console.log(`\n[R1 ${vp.key} ${vp.width}×${vp.height}] Present: encabezado reservado por su alto real`);
  for (const [name, fx, sid] of DOCS) {
    const t = await openEditor(browser, base, vp, fx, sid);
    const { page } = t;
    await page.evaluate(() => enterPresent()); await frames(page, 4);
    const measure = () => page.evaluate(() => {
      const h = document.querySelector("#presentStory"), hr = h.getBoundingClientRect(), shown = !h.hidden && hr.height > 0, cr = cv.getBoundingClientRect(), b = getBounds();
      const scr = (n) => ({ top: (n.y - n.h / 2) * viewZoom + viewY + cr.top, left: (n.x - n.w / 2) * viewZoom + viewX + cr.left, right: (n.x + n.w / 2) * viewZoom + viewX + cr.left });
      const covered = shown ? P().nodes.filter((n) => { const s = scr(n); return s.top < hr.bottom && s.right > hr.left && s.left < hr.right; }).map((n) => (n.label || "#" + n.id).split("\n")[0]) : [];
      const bar = document.querySelector("#presentBar").getBoundingClientRect();
      return { hb: Math.round(hr.bottom * 10) / 10, hh: Math.round(hr.height), shown, flow: !document.querySelector("#psFlow").hidden, boxTop: Math.round((b.y * viewZoom + viewY + cr.top) * 10) / 10,
        boxBottom: Math.round(((b.y + b.h) * viewZoom + viewY + cr.top) * 10) / 10, barTop: Math.round(bar.top), covered, view: [viewX, viewY, viewZoom].map((v) => +v.toFixed(4)).join(","), probes: document.querySelectorAll("#presentStory [aria-hidden=true]:not(.glyph)").length };
    });
    const rows = [];
    rows.push(["lista", await measure()]);
    await press(t, vp, "#psPlay"); await frames(page, 3); await page.waitForTimeout(250);
    rows.push(["reproduciendo", await measure()]);
    const nM = await page.evaluate(() => FluyoStoryClock.momentTimes(scActiveScenario()).length);
    await press(t, vp, "#psPause"); await frames(page);
    for (let i = 0; i < nM; i++) { await page.evaluate((i) => { scSeekMoment(i); presentStoryRefresh(); }, i); await frames(page); rows.push(["pausa m" + (i + 1), await measure()]); }
    await page.screenshot({ path: path.join(shots, `r1-${vp.key}-${name.split(" ")[0]}${name.includes("sin") ? "-sin" : ""}-pausa.png`) });
    await press(t, vp, "#psPause"); await page.evaluate(() => { scClock.base -= 60000; }); await page.waitForFunction(() => scStatus === "completed", null, { timeout: 5000 }).catch(() => {}); await frames(page);
    rows.push(["terminada", await measure()]);
    const v0 = rows[0][1].view, ready = rows[0][1];
    const maxHb = Math.max(...rows.map(([, m]) => (m.shown ? m.hb : 0)));
    console.log(`  · ${name}: ` + rows.map(([k, m]) => `${k} ${m.hh}px→${m.hb}${m.flow ? "+ruta" : ""}`).join(" · ") + ` | caja desde ${ready.boxTop}`);
    check(rows.every(([, m]) => m.view === v0), `${vp.key} ${name}: el encuadre no cambia al reproducir, pausar, saltar ni terminar (sin salto)`);
    check(rows.every(([, m]) => !m.shown || m.hb <= m.boxTop + 0.5), `${vp.key} ${name}: el encabezado (máx. ${maxHb}) nunca pasa de la caja del diagrama (${ready.boxTop})`);
    check(rows.every(([, m]) => m.covered.length === 0), `${vp.key} ${name}: ningún elemento debajo del encabezado` + (rows.find(([, m]) => m.covered.length) ? " — TAPA " + rows.find(([, m]) => m.covered.length)[1].covered.join(",") : ""));
    check(rows.every(([, m]) => m.boxBottom <= m.barTop + 0.5), `${vp.key} ${name}: ni debajo del mando (caja hasta ${ready.boxBottom}, mando desde ${ready.barTop})`);
    check(rows.every(([, m]) => m.probes === 0), `${vp.key} ${name}: ninguna fila sonda queda en el DOM`);
    if (fx === B9) check(rows.some(([, m]) => m.flow), `${vp.key} ${name}: la línea de la ruta se ve reproduciendo`);
    if (fx === NOFLOW) check(rows.every(([, m]) => !m.flow), `${vp.key} ${name}: sin ruta no hay línea`);
    check(t.errors.length === 0, `${vp.key} ${name}: sin errores de consola` + (t.errors.length ? " — " + t.errors[0] : ""));
    await t.ctx.close();
  }
}

/* ───────── G1: Editor, Present y Viewer ───────── */
async function g1Surface(t, vp, surface, btn, msg) {
  const { page } = t;
  await page.evaluate(SPY);
  const cur = surface === "viewer" ? "story.playback" : "scPlayback";
  const seekPaused = async (label, sel, expectAt) => {
    await page.evaluate(() => { window.__spy.cues = []; window.__spy.texts = []; });
    await press(t, vp, sel);
    await page.evaluate(() => { window.__spy.cues = []; window.__spy.texts = []; });
    await frames(page, 2);
    const r = await page.evaluate(([cur, msg]) => {
      const pb = eval(cur), first = window.__spy.cues.filter((c) => c.msg === msg);
      /* solo palabras del mensaje que no están en ninguna etiqueta del diagrama (la del nodo, «Worker A», se pinta siempre) */
      const labels = P().nodes.map((n) => String(n.label || "")).join(" "), words = msg.split(" ").filter((w) => w.length > 3 && !labels.includes(w));
      return { cursor: pb.cursorVirtual, revealAt: pb.revealAt, cue: first.length ? first[0].alpha : null, enter: first.length ? first[0].enter : null,
        text: window.__spy.texts.filter((x) => words.some((w) => x.text.includes(w))).map((x) => x.alpha), words };
    }, [cur, msg]);
    check(r.cursor === expectAt, `${vp.key} ${surface}: ${label} en pausa aterriza exactamente en at=${expectAt} (cursor ${r.cursor})`);
    check(r.cue === 1 && r.enter === 1, `${vp.key} ${surface}: ${label} → primer fotograma, cue del momento con alpha 1 (antes 0) [${r.cue}]`);
    check(r.text.length > 0 && r.text.every((a) => a === 1), `${vp.key} ${surface}: ${label} → el \`message\` «${msg}» se pinta con alpha 1 [${r.text.slice(0, 3).join(",")}]`);
    return r;
  };
  const times = await page.evaluate((s) => FluyoStoryClock.momentTimes(s === "viewer" ? story.scenario : scActiveScenario(), s === "viewer" ? story.playback : scPlayback), surface);
  /* en pausa: ⏭ hasta el momento del mensaje (el 2.º) y ⏮ de vuelta a él desde el 3.º */
  await press(t, vp, btn.pause); await frames(page);
  await seekPaused("⏭", btn.next, times[1]);
  await page.screenshot({ path: path.join(shots, `g1-${vp.key}-${surface}-seek.png`) });
  await press(t, vp, btn.next); await frames(page);
  await seekPaused("⏮", btn.prev, times[1]);
  /* Reanudar: sigue desde at, sin parpadeo */
  await page.evaluate(() => { window.__spy.cues = []; });
  await press(t, vp, btn.pause);
  const t0 = Date.now(); await frames(page, 3);
  const after = await page.evaluate(([cur, msg]) => ({ cursor: eval(cur).cursorVirtual, min: Math.min(...window.__spy.cues.filter((c) => c.msg === msg).map((c) => c.alpha)), n: window.__spy.cues.filter((c) => c.msg === msg).length }), [cur, msg]);
  const dt = Date.now() - t0;
  check(after.cursor >= times[1] && after.cursor <= times[1] + dt + 60, `${vp.key} ${surface}: Reanudar sigue desde at (cursor ${Math.round(after.cursor)} = ${times[1]} + ${Math.round(after.cursor - times[1])} ms, ${dt} ms reales)`);
  check(after.n > 0 && after.min === 1, `${vp.key} ${surface}: al reanudar el cue sigue completo (mín. alpha ${after.min} en ${after.n} fotogramas): no reaparece desde 0`);
  /* reproduciendo: saltar conserva la entrada */
  await press(t, vp, btn.next); await frames(page, 1);
  /* el cue del 2.º momento sigue vivo en el 3.º (dura 1,5 s): se escucha solo DESPUÉS del salto */
  await press(t, vp, btn.prev);
  await page.evaluate(() => { window.__spy.cues = []; });
  await frames(page, 2);
  const play = await page.evaluate(([cur, msg]) => ({ revealAt: eval(cur).revealAt, first: (window.__spy.cues.find((c) => c.msg === msg) || { alpha: null }).alpha }), [cur, msg]);
  check(play.revealAt === undefined && play.first !== null && play.first < 1, `${vp.key} ${surface}: reproduciendo, ⏮ conserva la entrada del cue (primer alpha ${play.first && play.first.toFixed(2)} < 1)`);
}
async function g1(browser, base, vp) {
  console.log(`\n[G1 ${vp.key} ${vp.width}×${vp.height}] saltar en pausa enseña el momento entero`);
  for (const [name, fx, sid, msg] of [DOCS[0], DOCS[1]]) {
    /* Editor */
    let t = await openEditor(browser, base, vp, fx, sid);
    const inv0 = await invariants(t.page);
    await press(t, vp, "#scRun"); await frames(t.page, 2);
    await g1Surface(t, vp, "editor", { pause: "#scPause", next: "#scNext", prev: "#scPrev" }, msg);
    await t.page.evaluate(() => scReset());
    check((await invariants(t.page)) === inv0, `${vp.key} editor ${name}: Steps, at, dependencias, Trace, horario, documento y Undo intactos`);
    /* Present */
    await t.page.evaluate(() => enterPresent()); await frames(t.page, 4);
    await press(t, vp, "#psPlay"); await frames(t.page, 2);
    await g1Surface(t, vp, "present", { pause: "#psPause", next: "#psNext", prev: "#psPrev" }, msg);
    await t.page.evaluate(() => exitPresent());
    check((await invariants(t.page)) === inv0, `${vp.key} present ${name}: Steps, at, dependencias, Trace, horario, documento y Undo intactos`);
    check(t.errors.length === 0, `${vp.key} ${name}: editor/Present sin errores de consola` + (t.errors.length ? " — " + t.errors[0] : ""));
    const payload = await t.page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "story", scenarioId: scActiveScenario().id })).hash.slice(3));
    await t.ctx.close();
    /* Viewer */
    t = await open(browser, base, vp, "/s/#d=" + payload);
    await t.page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
    await t.page.evaluate(() => document.fonts.ready);
    const vinv0 = await t.page.evaluate(() => JSON.stringify({ trace: FluyoStory.run(P(), storyScenario()), steps: storyScenario().steps }));
    await press(t, vp, "#stPlay"); await frames(t.page, 2);
    await g1Surface(t, vp, "viewer", { pause: "#stPause", next: "#stNext", prev: "#stPrev" }, msg);
    check((await t.page.evaluate(() => JSON.stringify({ trace: FluyoStory.run(P(), storyScenario()), steps: storyScenario().steps }))) === vinv0, `${vp.key} viewer ${name}: Steps y Trace intactos`);
    check(t.errors.length === 0, `${vp.key} viewer ${name}: sin errores de consola` + (t.errors.length ? " — " + t.errors[0] : ""));
    await t.ctx.close();
  }
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS) {
      if (ONLY && ONLY !== vp.key) continue;
      await r1(browser, base, vp);
      if (G1_VPS.includes(vp.key)) await g1(browser, base, vp);
    }
  } finally { await browser.close(); server.close(); }
  console.log(`\n${passed} ✔ / ${failed} ✘   (capturas: ${shots})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
