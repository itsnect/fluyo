"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 5 — Paridad de superficies en Chrome real, a 1440 y a 390 px. Se sirven el árbol de trabajo y la base
   6701261 (producción v99, sin FASE 5), con el service worker bloqueado salvo en el smoke de actualización.
   · V1  Viewer (sin bandera), Share «Compartir historia» del fixture de dos workers: lista para reproducir, sin línea; reproduciendo (en
         pausa en 0,8 · 2,3 · 4,2 s) la línea en el rótulo (#stFlow) y la ruta en el lienzo (cae A: rama A terracota y B oliva); la ruta y
         la línea son las del editor con labs en el mismo instante; la banda (#story) mide lo mismo que en 6701261; a 390 la línea cabe
         entera en el rótulo; en el Present del Viewer, igual, y su mando mide lo mismo.
   · V2  Present del editor (labs): sin reproducir, sin línea; reproduciendo, la línea en #presentStory y la ruta en el lienzo; el mando
         (#presentBar) mide lo mismo que en 6701261; labs apagado: nada.
   · V3  Share: «Compartir historia» lleva kind y observedFlow; «Sólo el diagrama» lleva kind y ninguna Historia. El Viewer de 6701261
         (SW anterior) abre el mismo enlace como siempre, sin errores.
   · V4  Exportación: SVG y PNG con las marcas (y sin ellas, el mismo PNG que 6701261); golden compartido con el MCP; los 8 ejemplos (sin
         kind) dan el mismo SVG (plano y construido) y el mismo PNG que 6701261; un Viewer con un ejemplo, el mismo lienzo.
   · SW  De 6701261 (v99) al árbol (v100): instalada y activada, la anterior borrada; el Viewer nuevo sale de la caché.
   Sin errores de consola en ningún paso.
   Uso: node test/fluyo-scenarios-semantics-5-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome o FLUYO_CHROME=ruta;
        FLUYO_UPDATE_GOLDEN=1 reescribe test/fixtures/fluyo-scenarios-semantics-5-marcas-svg.json) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "6701261";
const GOLD = path.join(root, "test", "fixtures", "fluyo-scenarios-semantics-5-marcas-svg.json");
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss5-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* ───────── fixture de producto: dos workers (el de FASE 3 y FASE 4), con la ruta automática Cliente → BD ───────── */
const CLI = 1, API = 2, COLA = 3, WA = 4, WB = 5, BD = 6, AUTH = 7, MET = 8;
const N = (id, x, y, label) => ({ id, shape: "rect", x, y, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
const E = (id, from, to, kind, extra) => Object.assign({ id, from, to, route: "ortho", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" }, kind ? { kind } : {}, extra || {});
function DOC({ theme = "crema", observedFlow = null } = {}) {
  return { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
    doc: { theme, customBg: "", cur: 0, nextEventTypeId: 3,
      eventTypes: [
        { id: 1, name: "Pedido", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
        { id: 2, name: "Cae", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN" }],
      pages: [{ name: "Workers", nextId: 100, behaviors: [], nextScenarioId: 2,
        nodes: [N(CLI, 120, 300, "Cliente"), N(API, 340, 300, "API"), N(COLA, 560, 300, "Cola"), N(WA, 800, 200, "Worker A"), N(WB, 800, 400, "Worker B"), N(BD, 1040, 300, "BD"),
          N(AUTH, 340, 470, "Auth"), N(MET, 340, 130, "Métricas")],
        edges: [E(11, CLI, API, "FLOWS_TO"), E(12, API, COLA, "FLOWS_TO"), E(13, COLA, WA, "FLOWS_TO"), E(14, COLA, WB, "FLOWS_TO"), E(15, WA, BD, "FLOWS_TO"),
          E(16, WB, BD, "FLOWS_TO"), E(17, API, AUTH, "REQUIRES"), E(18, API, MET)],
        scenarios: [Object.assign({ id: 1, engineVersion: 2, name: "Pedido y caídas", nextStepId: 4, steps: [
          { id: 1, at: 0, action: "SEND", edgeId: 11, eventTypeId: 1 }, { id: 2, at: 1500, action: "SET_STATE", nodeId: WA, state: "DOWN", eventTypeId: 2 },
          { id: 3, at: 3000, action: "SET_STATE", nodeId: WB, state: "DOWN", eventTypeId: 2 }] }, observedFlow ? { observedFlow } : {})] }] } };
}
/* ───────── golden de las marcas (compartido con fluyo-mcp): Flujo recto y ortogonal, Flujo corto (sin cuñas), Flujo con punta de inicio
   y discontinuo, Requisito con y sin punta de inicio (tamaño 2) y color propio, kind desconocido y conexión genérica ───────── */
function GOLDEN_DOC() {
  const G = (id, x, y, label) => Object.assign(N(id, x, y, label), { color: "#6a9fb5" });
  return { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
    doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 1, eventTypes: [],
      pages: [{ name: "Marcas", nextId: 40, behaviors: [], nextScenarioId: 1, scenarios: [],
        nodes: [G(1, 200, 200, "A"), G(2, 640, 200, "B"), G(3, 640, 480, "C"), G(4, 200, 480, "D"), G(5, 380, 720, "E"), G(6, 540, 720, "F")],
        edges: [E(11, 1, 2, "FLOWS_TO", { route: "straight" }), E(12, 2, 3, "FLOWS_TO"), E(13, 3, 4, "REQUIRES", { route: "straight" }),
          E(14, 4, 1, "REQUIRES", { route: "straight", startArrow: true, arrowSize: 2, lineColor: "#d08b5b" }), E(15, 1, 3, "FLOWS_TO", { startArrow: true, dashed: true }),
          E(16, 5, 6, "FLOWS_TO", { route: "straight", fromSide: "e", toSide: "w" }), E(17, 4, 5, "FUTURO"), E(18, 2, 5), E(19, 3, 5, "REQUIRES", { lineColor: "#b5734a" })] }] } };
}
const VARIANTS = [{ name: "crema-plano", theme: "crema", customBg: "", skin: "flat" }, { name: "oscuro-construido", theme: "dark", customBg: "#20262b", skin: "built" }];
const geometryLines = (svg) => svg.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("<svg ") && !l.startsWith("<text"));

async function open(browser, base, vp, url, { touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); }); page.on("dialog", (d) => d.accept());
  await page.goto(base + url);
  return { ctx, page, errors };
}
async function openEditor(browser, base, vp, query = "", opts) {
  const T = await open(browser, base, vp, "/" + query, opts);
  await T.page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  await T.page.evaluate(() => document.fonts.ready);
  T.load = async (d) => { await T.page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, d); };
  /* reproducir y dejarlo en pausa en un instante EXACTO del reloj de la Historia (la receta de FASE 4) */
  T.playAt = async (t, present = false) => {
    await T.page.evaluate((present) => { if (scStatus === "idle") scRun(present ? { present: true } : undefined); scPause(); }, present);
    await T.page.evaluate((t) => { scSeekMoment(0); scClock.pausedAt = scClock.pausedAt - (scPlayback.cursorVirtual || 0) + t; FluyoScenarioPlayback.tick(scPlayback, scNow()); scRenderButtons(); scRenderStatus(); if (typeof presentStoryRefresh === "function") presentStoryRefresh(); }, t);
    await frames(T.page, 3);
  };
  return T;
}
async function openViewer(browser, base, vp, payload, opts) {
  const T = await open(browser, base, vp, "/s/#d=" + payload, opts);
  await T.page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  await T.page.evaluate(() => document.fonts.ready);
  /* en pausa en el instante t de la Historia (el mismo reloj que Pausar): la proyección y la línea quedan quietas */
  T.at = async (t) => {
    await T.page.evaluate((t) => { if (!story || story.status !== "running") storyPlay(); FluyoStoryClock.pause(story.clock, performance.now());
      story.clock.pausedAt = story.playback.startedAtReal + t; renderViewerFrame(); }, t);
    await frames(T.page, 3);
  };
  return T;
}
const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const box = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), visible: !el.hidden && getComputedStyle(el).display !== "none",
    fits: el.scrollWidth <= el.clientWidth + 1, text: el.textContent, cls: el.className }; }, sel);
/* Tinte medio (R − G) junto al tramo más largo de una conexión en el lienzo del VIEWER: oliva < 0 < terracota */
const viewerTint = (page, id) => page.evaluate((id) => {
  const e = P().edges.find((x) => x.id === id), pts = edgePoints(e), v = __viewer.view, dpr = sv.fluyoDpr || 1, g = sctx;
  let best = 0, a = null, b = null; for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); if (L > best) { best = L; a = pts[i]; b = pts[i + 1]; } }
  const ux = (b.x - a.x) / best, uy = (b.y - a.y) / best, off = 1.2 + 1.2 / v.zoom; let sum = 0, n = 0;
  for (let s = 0.3; s <= 0.7; s += 0.02) for (const o of [off, -off]) {
    const wx = a.x + (b.x - a.x) * s - uy * o, wy = a.y + (b.y - a.y) * s + ux * o;
    const px = g.getImageData(Math.round((wx * v.zoom + v.x) * dpr), Math.round((wy * v.zoom + v.y) * dpr), 1, 1).data; sum += px[0] - px[1]; n++;
  }
  return Math.round(sum / n * 10) / 10; }, id);

/* ═══════════════ V3 + golden + V4 (exportación) ═══════════════ */
async function exportAndShare(browser, now, old) {
  console.log("\n── V4 · exportación (SVG/PNG con marcas; golden del MCP; ejemplos sin kind = " + BASE + ") y V3 · Share");
  const vp = { width: 1440, height: 900 };
  const T = await openEditor(browser, now.base, vp), O = await openEditor(browser, old.base, vp);
  const raster = (P2, skin) => P2.page.evaluate((skin) => { const b = getBounds(), off = document.createElement("canvas"); off.width = Math.round(b.w); off.height = Math.round(b.h);
    const oc = off.getContext("2d"); oc.translate(-b.x, -b.y);
    render(oc, 1.3, { export: true, skin, transparent: false, bounds: b, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }); return off.toDataURL("image/png"); }, skin);
  try {
    /* golden: el SVG de «Exportar → SVG» del editor para cada variante */
    const svgs = {};
    for (const v of VARIANTS) {
      const d = GOLDEN_DOC(); d.doc.theme = v.theme; d.doc.customBg = v.customBg; await T.load(d);
      svgs[v.name] = await T.page.evaluate((skin) => buildSVGDocument(1, skin), v.skin);
      const marks = svgs[v.name].split("\n").filter((l) => /stroke-width="1\.6"/.test(l));
      check(marks.filter((l) => l.startsWith("<circle")).length === 3 && marks.filter((l) => l.startsWith("<path")).length === 6,
        `${v.name}: 3 anillos de Requisito y 6 cuñas (3 Flujos largos; el corto sin cuñas; kind desconocido y genérica sin marcas)`);
      if (v.skin === "built") {
        const ports = svgs[v.name].split("\n").filter((l) => /^<path d="[^"]*" fill="#20262b" stroke=/.test(l)).length;
        check(ports === 9 - 1 - 3, `${v.name}: N3 en el SVG: anillos de salida = 9 conexiones − 1 con punta de inicio sin Requisito − 3 Requisitos (${ports})`);
      }
    }
    if (process.env.FLUYO_UPDATE_GOLDEN) fs.writeFileSync(GOLD, JSON.stringify({ _: "SCENARIOS-SEMANTICS-001 FASE 5: SVG de «Exportar → SVG» del editor (Chrome) con las marcas de Flujo y Requisito, por variante. Lo comparte fluyo-mcp (export_diagram). FLUYO_UPDATE_GOLDEN=1 node test/fluyo-scenarios-semantics-5-browser.cjs lo regenera.", doc: GOLDEN_DOC(), variants: VARIANTS, svgs }, null, 1) + "\n");
    const G = JSON.parse(fs.readFileSync(GOLD, "utf8"));
    for (const v of VARIANTS) check(JSON.stringify(geometryLines(svgs[v.name])) === JSON.stringify(geometryLines(G.svgs[v.name])), `${v.name}: el SVG del editor = el golden (sin los <text>)`);
    /* con kind: el PNG cambia SOLO por las marcas: sin ellas (kind quitado) es el de 6701261 */
    for (const skin of ["flat", "built"]) {
      await T.load(DOC()); await O.load(DOC());
      const withKind = await raster(T, skin), oldPng = await raster(O, skin);
      const plain = DOC(); plain.doc.pages[0].edges.forEach((e) => delete e.kind); await T.load(plain);
      const without = await raster(T, skin);
      check(withKind !== oldPng && without === oldPng, `PNG (${skin}): con kind lleva las marcas (≠ ${BASE}); sin kind, el de ${BASE} píxel a píxel`);
    }
    await T.load(DOC());
    const svg = await T.page.evaluate(() => buildSVGDocument(1));
    check(svg.split("\n").filter((l) => /stroke-width="1\.6"/.test(l)).length === 2 * 6 + 1, "SVG del fixture: 6 Flujos × 2 cuñas + 1 Requisito");
    await T.page.evaluate(async () => { scRun(); await new Promise((r) => setTimeout(r, 1700)); });
    const during = await T.page.evaluate(() => buildSVGDocument(1));
    await T.page.evaluate(() => scReset());
    check(during === svg, "exportar en plena reproducción (labs apagado): el mismo SVG, sin overlays");
    /* los 8 ejemplos (sin kind): SVG plano y construido y PNG idénticos a 6701261 */
    const examples = fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => /\.fluyo\.json$/.test(f));
    let same = 0;
    for (const f of examples) {
      const d = JSON.parse(fs.readFileSync(path.join(root, "ejemplos", "data", f), "utf8"));
      await T.load(d); await O.load(d);
      const a = await T.page.evaluate(() => [buildSVGDocument(1), buildSVGDocument(1, "built")]), b = await O.page.evaluate(() => [buildSVGDocument(1), buildSVGDocument(1, "built")]);
      if (a[0] === b[0] && a[1] === b[1] && await raster(T, "flat") === await raster(O, "flat") && await raster(T, "built") === await raster(O, "built")) same++;
      else console.log("    diferencia en " + f);
    }
    check(same === examples.length && same >= 8, `los ${examples.length} ejemplos: SVG (plano y construido) y PNG (plano y construido) idénticos a ${BASE}`);
    /* V3 · Share */
    await T.load(DOC({ observedFlow: { from: API, to: BD } }));
    const story = await T.page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "story", storyId: 1 })).hash.slice(3));
    const diagram = await T.page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "diagram" })).hash.slice(3));
    const V = await openViewer(browser, now.base, vp, story), D = await openViewer(browser, now.base, vp, diagram), OV = await openViewer(browser, old.base, vp, story);
    try {
      const sv = await V.page.evaluate(() => ({ kinds: P().edges.map((e) => e.kind || null), of: P().scenarios[0].observedFlow, story: __viewer.story }));
      check(JSON.stringify(sv.kinds) === JSON.stringify(["FLOWS_TO", "FLOWS_TO", "FLOWS_TO", "FLOWS_TO", "FLOWS_TO", "FLOWS_TO", "REQUIRES", null]) && sv.of && sv.of.from === API && sv.of.to === BD && sv.story === "ready",
        "«Compartir historia»: el Viewer recibe kind y observedFlow");
      const sd = await D.page.evaluate(() => ({ kinds: P().edges.filter((e) => e.kind).length, stories: P().scenarios.length, band: document.getElementById("story").hidden }));
      check(sd.kinds === 7 && sd.stories === 0 && sd.band, "«Sólo el diagrama»: kind viaja (las marcas se pintan), ninguna Historia");
      await OV.at(2300);
      const ov = await OV.page.evaluate(() => ({ stFlow: !!document.getElementById("stFlow"), mod: typeof FluyoFlow, phase: __viewer.phase }));
      check(!ov.stFlow && ov.mod === "undefined" && ov.phase === "ready" && OV.errors.length === 0, "Viewer de " + BASE + " (SW anterior): abre y reproduce el mismo enlace como siempre, sin errores");
      check(V.errors.length + D.errors.length === 0, "Share: 0 errores");
    } finally { await V.ctx.close(); await D.ctx.close(); await OV.ctx.close(); }
    check(T.errors.length + O.errors.length === 0, "exportación: 0 errores (" + T.errors.concat(O.errors).join(" | ") + ")");
  } finally { await T.ctx.close(); await O.ctx.close(); }
}

/* ═══════════════ V1 · Viewer ═══════════════ */
async function viewer(browser, now, old, vp, label, touch) {
  console.log(`\n── V1 · Viewer (sin bandera), ${label} (${vp.width}×${vp.height}${touch ? ", dedo" : ""})`);
  const Ed = await openEditor(browser, now.base, vp, "?labs=escenarios");
  await Ed.load(DOC());
  const payload = await Ed.page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "story", storyId: 1 })).hash.slice(3));
  const V = await openViewer(browser, now.base, vp, payload, { touch }), OV = await openViewer(browser, old.base, vp, payload, { touch });
  try {
    const labs = await V.page.evaluate(() => { try { return localStorage.getItem("fluyo.labs.escenarios"); } catch { return null; } });
    let f = await box(V.page, "#stFlow");
    check(!labs && f && !f.visible, "lista para reproducir: sin línea, y sin bandera labs en el Viewer");
    const bandOld = { story: await box(OV.page, "#story"), actions: await box(OV.page, "#stActions") };
    const expect = { 800: ["Ruta disponible · incluye estados por defecto", "stFlow isAVAILABLE"], 2300: ["Ruta disponible · incluye estados por defecto", "stFlow isAVAILABLE"], 4200: ["Ruta no disponible", "stFlow isUNAVAILABLE"] };
    for (const t of [800, 2300, 4200]) {
      await V.at(t); await OV.at(t); await Ed.playAt(t);
      f = await box(V.page, "#stFlow");
      check(f.visible && f.text === expect[t][0] && f.cls === expect[t][1], `t = ${t}: «${f.text}» en el rótulo`);
      const pv = await V.page.evaluate(() => ({ o: storyFlowOverlay(), l: storyFlowLine() })), pe = await Ed.page.evaluate(() => ({ o: scFlowOverlay(), l: scFlowPresentLine() }));
      check(pv.o && JSON.stringify(pv) === JSON.stringify(pe), `t = ${t}: la ruta y la línea del Viewer son las del editor en el mismo instante`);
      const card = await box(V.page, "#stNow"), wrap = await box(V.page, "#wrap");
      check(f.fits && card.x >= wrap.x && card.right <= wrap.right, `t = ${t}: la línea cabe entera en el rótulo (${f.w} px; rótulo ${card.w} px dentro del lienzo ${wrap.w})`);
      const now2 = { story: await box(V.page, "#story"), actions: await box(V.page, "#stActions") };
      check(now2.story.h === bandOld.story.h && now2.actions.w === (await box(OV.page, "#stActions")).w && now2.story.h > 0,
        `t = ${t}: la banda sigue siendo la de ${BASE} (alto ${now2.story.h}, transporte ${now2.actions.w} px)`);
    }
    await V.at(2300); await OV.at(2300);
    const tA = await viewerTint(V.page, 13), tB = await viewerTint(V.page, 14), oA = await viewerTint(OV.page, 13), oB = await viewerTint(OV.page, 14);
    check(tA > oA + 3 && tB < oB - 3, `lienzo a 2,3 s: rama A terracota (R−G ${oA} → ${tA}) y rama B oliva (${oB} → ${tB}) frente a ${BASE}`);
    const rs = await V.page.evaluate(() => { const s = storyFlowOverlay(); return s && [s.edges[13].cls, s.edges[14].cls, s.edges[17] === undefined, s.edges[18] === undefined, s.pips]; });
    check(JSON.stringify(rs) === JSON.stringify(["UNAVAILABLE", "AVAILABLE", true, true, [WA]]), "Requisito y Conexión sin funda; pastilla en Worker A");
    /* el Present del Viewer: la línea en el mismo rótulo; el mando mide lo mismo que en 6701261 */
    await V.page.evaluate(() => enterPresent()); await OV.page.evaluate(() => enterPresent()); await V.at(4200); await OV.at(4200);
    f = await box(V.page, "#stFlow");
    const bar = await box(V.page, "#prBar"), barOld = await box(OV.page, "#prBar");
    check(f.visible && f.text === "Ruta no disponible" && f.fits && bar.w === barOld.w && bar.h === barOld.h, `Present del Viewer: la línea en el rótulo; el mando igual (${bar.w}×${bar.h})`);
    await V.page.evaluate(() => exitPresent()); await V.page.evaluate(() => storyReset()); await frames(V.page);
    check(!(await box(V.page, "#stFlow")).visible, "Detener: sin línea");
    check(V.errors.length + OV.errors.length + Ed.errors.length === 0, "0 errores (" + V.errors.concat(OV.errors, Ed.errors).join(" | ") + ")");
  } finally { await V.ctx.close(); await OV.ctx.close(); await Ed.ctx.close(); }
}

/* ═══════════════ V2 · Present del editor (labs) ═══════════════ */
async function present(browser, now, old, vp, label, touch) {
  console.log(`\n── V2 · Present del editor con labs, ${label} (${vp.width}×${vp.height}${touch ? ", dedo" : ""})`);
  const T = await openEditor(browser, now.base, vp, "?labs=escenarios", { touch }), O = await openEditor(browser, old.base, vp, "?labs=escenarios", { touch });
  try {
    for (const P2 of [T, O]) { await P2.load(DOC()); await P2.page.evaluate(() => enterPresent()); await frames(P2.page, 3); }
    let f = await box(T.page, "#psFlow");
    const ready = await box(T.page, "#presentBar"), readyOld = await box(O.page, "#presentBar");
    check(!f.visible && ready.w === readyOld.w && ready.h === readyOld.h, `sin reproducir: sin línea (decisión del PO) y el mando igual a ${BASE} (${ready.w}×${ready.h})`);
    for (const [t, text] of [[800, "Ruta disponible · incluye estados por defecto"], [2300, "Ruta disponible · incluye estados por defecto"], [4200, "Ruta no disponible"]]) {
      await T.playAt(t, true); await O.playAt(t, true);
      f = await box(T.page, "#psFlow");
      const ps = await box(T.page, "#presentStory"), bar = await box(T.page, "#presentBar"), barOld = await box(O.page, "#presentBar");
      const flow = await T.page.evaluate(() => { const r = buildScenarioRenderState(); return r && r.flow ? [r.flow.edges[13].cls, r.flow.edges[14].cls] : null; });
      check(f.visible && f.text === text && f.fits && ps.x >= 0 && ps.right <= vp.width, `t = ${t}: «${f.text}» en el rótulo, entera y dentro de la pantalla (${ps.w} px)`);
      check(bar.w === barOld.w && bar.h === barOld.h, `t = ${t}: el mando es el de ${BASE} (${bar.w}×${bar.h})`);
      check(flow && flow[0] === (t >= 1500 ? "UNAVAILABLE" : "AVAILABLE") && flow[1] === (t >= 3000 ? "UNAVAILABLE" : "AVAILABLE"), `t = ${t}: el lienzo de Present pinta la ruta (${flow})`);
    }
    await T.page.evaluate(() => { scReset(); presentStoryRefresh(); }); await frames(T.page);
    check(!(await box(T.page, "#psFlow")).visible, "Detener: sin línea");
    /* FASE 6 (decisión 253): sin bandera, Present es el de ?labs=escenarios (la bandera se retiró) */
    const L = await openEditor(browser, now.base, vp, "", { touch });
    try {
      await L.load(DOC()); await L.page.evaluate(() => enterPresent()); await L.playAt(2300, true);
      const off = await L.page.evaluate(() => ({ line: !document.getElementById("psFlow").hidden, text: document.getElementById("psFlow").textContent, flow: !!(buildScenarioRenderState() || {}).flow }));
      check(off.line && off.flow && off.text === "Ruta disponible · incluye estados por defecto", "sin bandera: la línea y la ruta en Present («" + off.text + "»)");
      check(L.errors.length === 0, "sin bandera: 0 errores");
    } finally { await L.ctx.close(); }
    check(T.errors.length + O.errors.length === 0, "0 errores (" + T.errors.concat(O.errors).join(" | ") + ")");
  } finally { await T.ctx.close(); await O.ctx.close(); }
}

/* ═══════════════ Documentos antiguos en el Viewer ═══════════════ */
async function oldDocsViewer(browser, now, old) {
  console.log("\n── Documentos sin kind ni observedFlow en el Viewer: el lienzo de " + BASE);
  const vp = { width: 1440, height: 900 };
  const Ed = await openEditor(browser, now.base, vp);
  try {
    let same = 0, total = 0;
    for (const f of ["kafka-event-pipeline.fluyo.json", "microservicios-api-gateway.fluyo.json", "oauth2-flujo-autenticacion.fluyo.json"]) {
      const d = JSON.parse(fs.readFileSync(path.join(root, "ejemplos", "data", f), "utf8"));
      await Ed.load(d);
      const payload = await Ed.page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "diagram" })).hash.slice(3));
      const V = await openViewer(browser, now.base, vp, payload), OV = await openViewer(browser, old.base, vp, payload);
      const frozen = (P2) => P2.page.evaluate(() => { playing = false; pausedAt = 0; renderViewerFrame(); return sv.toDataURL(); });
      if (hash(await frozen(V)) === hash(await frozen(OV))) same++;
      total++;
      check(V.errors.length + OV.errors.length === 0, f + ": 0 errores");
      await V.ctx.close(); await OV.ctx.close();
    }
    check(same === total, `${same}/${total} ejemplos: el lienzo del Viewer es el de ${BASE} píxel a píxel`);
  } finally { await Ed.ctx.close(); }
}

(async () => {
  const t0 = Date.now();
  const oldDir = treeAt(BASE);
  const now = await serve(root), old = await serve(oldDir);
  const launch = process.env.FLUYO_CHROME ? { executablePath: process.env.FLUYO_CHROME } : { channel: process.env.FLUYO_BROWSER || "chrome" };
  const browser = await chromium.launch(Object.assign({ headless: !process.env.HEADED }, launch));
  try {
    await exportAndShare(browser, now, old);
    await viewer(browser, now, old, { width: 1440, height: 900 }, "escritorio");
    await viewer(browser, now, old, { width: 390, height: 844 }, "teléfono", true);
    await present(browser, now, old, { width: 1440, height: 900 }, "escritorio");
    await present(browser, now, old, { width: 390, height: 844 }, "teléfono", true);
    await oldDocsViewer(browser, now, old);
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
        const installed = (name) => until(async (name) => { if (!(await caches.keys()).includes(name)) return false; const c = await caches.open(name); return !!(await c.match(location.origin + "/js/viewer.js")); }, name, name);
        const activated = () => until(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !r.installing && !r.waiting && !!r.active && r.active.state === "activated"; }, null, "activado");
        await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
        await installed(PREV); await activated();
        check(true, BASE + ": " + PREV + " instalada y activa");
        sw.state.dir = root;
        await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
        await installed(CUR); await activated();
        await until(async (p) => !(await caches.keys()).includes(p), PREV, "la anterior borrada");
        const cached = await pg.evaluate(async (cur) => { const c = await caches.open(cur);
          const s = await (await c.match(location.origin + "/s/")).text(), v = await (await c.match(location.origin + "/js/viewer.js")).text();
          return { keys: await caches.keys(), stFlow: s.includes('id="stFlow"') && s.includes("../js/flow-semantics.js"), viewer: v.includes("function storyFlowOverlay("), flow: !!(await c.match(location.origin + "/js/flow-semantics.js")) }; }, CUR);
        check(CUR !== PREV && cached.keys.join() === CUR && cached.stFlow && cached.viewer && cached.flow, `${CUR} instalada y activada, ${PREV} borrada; la caché sirve el Viewer de FASE 5 (s/index.html, viewer.js, flow-semantics.js)`);
      } finally { await ctx.close(); sw.server.close(); }
    }
  } finally {
    await browser.close(); now.server.close(); old.server.close();
    fs.rmSync(oldDir, { recursive: true, force: true });
  }
  console.log(`\n${passed} ✔ · ${failed} ✘ (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
