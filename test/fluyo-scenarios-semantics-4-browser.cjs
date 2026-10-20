"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 4 — Scenario Experience en Chrome real, a 1440 y a 390 px. Se sirven el árbol de trabajo y la base
   ae0d619 (producción v98, sin FASE 4), con el service worker bloqueado salvo en el smoke de actualización.
   · V1  ACEPTACIÓN (labs, fixture de dos workers): la línea de tiempo bajo el estado (edición: sin cursor), extremos y filas «vía …»;
         reproduciendo, el lienzo pinta la ruta: todo oliva → cae A, rama A terracota y B oliva (sin barrido) → cae B, todo terracota
         (con barrido); el cursor sigue al instante; las filas cambian; ⏮ / ⏭ mueven cursor y lienzo; la pausa deja el lienzo quieto.
   · V2  Requisito estable: la zona de la conexión Requisito es idéntica píxel a píxel en todos los instantes.
   · V3  Piel «construido»: las fundas siguen la línea pintada; N3: el Requisito no lleva anillo de salida (7 de 8 conexiones).
   · V4  labs apagado = producción: lienzo (editando y reproduciendo, en pausa en el mismo instante) y cabecera de Historias
         idénticos píxel a píxel a ae0d619.
   · V5  Present: nada de la ruta en el lienzo (FASE 5).
   · V6  «Reducir movimiento»: sin barrido.
   · V7  (QA del PO) Claro, crema y oscuro, con y sin piel, a 1440 y a 390: en claro el halo disponible se lee oliva (tono y saturación
         medidos). Recuento: «+1 ruta», «+2 rutas» y, por encima del tope, «Más de 10 000 rutas».
   · SW  De ae0d619 (v98) al árbol (v99): instalada y activada, la anterior borrada.
   Sin errores de consola en ningún paso.
   Uso: node test/fluyo-scenarios-semantics-4-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome o FLUYO_CHROME=ruta; FLUYO_SHOTS=dir) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "ae0d619";
const shots = process.env.FLUYO_SHOTS || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2", ".ico": "image/x-icon" };
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss4-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const hash = (buf) => crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);

/* ───────── fixture de producto: dos workers (el de FASE 3) ───────── */
const CLI = 1, API = 2, COLA = 3, WA = 4, WB = 5, BD = 6, AUTH = 7, MET = 8;
const N = (id, x, y, label) => ({ id, shape: "rect", x, y, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, order: id });
const E = (id, from, to, kind) => Object.assign({ id, from, to, route: "ortho", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" }, kind ? { kind } : {});
function DOC({ theme = "crema", skin = false } = {}) {
  return { version: 5, app: "fluyo", settings: Object.assign({ speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false }, skin ? { skin: "built" } : {}),
    doc: { theme, customBg: "", cur: 0, nextEventTypeId: 3,
      eventTypes: [
        { id: 1, name: "Pedido", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
        { id: 2, name: "Cae", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target} cae", visual: { kind: "token", value: "✕" }, availability: "DOWN" }],
      pages: [{ name: "Workers", nextId: 100, behaviors: [], nextScenarioId: 2,
        nodes: [N(CLI, 120, 300, "Cliente"), N(API, 340, 300, "API"), N(COLA, 560, 300, "Cola"), N(WA, 800, 200, "Worker A"), N(WB, 800, 400, "Worker B"), N(BD, 1040, 300, "BD"),
          N(AUTH, 340, 470, "Auth"), N(MET, 340, 130, "Métricas")],
        edges: [E(11, CLI, API, "FLOWS_TO"), E(12, API, COLA, "FLOWS_TO"), E(13, COLA, WA, "FLOWS_TO"), E(14, COLA, WB, "FLOWS_TO"), E(15, WA, BD, "FLOWS_TO"),
          E(16, WB, BD, "FLOWS_TO"), E(17, API, AUTH, "REQUIRES"), E(18, API, MET)],
        scenarios: [{ id: 1, engineVersion: 2, name: "Pedido y caídas", nextStepId: 4, steps: [
          { id: 1, at: 0, action: "SEND", edgeId: 11, eventTypeId: 1 }, { id: 2, at: 1500, action: "SET_STATE", nodeId: WA, state: "DOWN", eventTypeId: 2 },
          { id: 3, at: 3000, action: "SET_STATE", nodeId: WB, state: "DOWN", eventTypeId: 2 }] }] }] } };
}

async function open(browser, base, vp, query, { touch = false, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); }); page.on("dialog", (d) => d.accept());
  await page.goto(base + "/" + (query || "")); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  await page.evaluate(() => document.fonts.ready);
  const load = async (d) => { await page.evaluate((d) => { applyProjectData(d); if (typeof clearSel === "function") clearSel(); }, d); };
  const story = async () => { await page.click(touch ? "#btnStories" : "#tabScenarios"); await page.waitForFunction(() => document.body.classList.contains("storyMode")); await page.waitForTimeout(450); };
  const frames = (n = 2) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  /* reproducir y dejarlo en pausa en un instante EXACTO del reloj de la Historia (el mismo receta que la pausa y los saltos) */
  const playAt = async (t) => {
    await page.evaluate(() => { if (scStatus === "idle") scRun(); scPause(); });
    await page.evaluate((t) => { scSeekMoment(0); scClock.pausedAt = scClock.pausedAt - (scPlayback.cursorVirtual || 0) + t; FluyoScenarioPlayback.tick(scPlayback, scNow()); scRenderButtons(); scRenderStatus(); }, t);
    await frames(3);
  };
  const tool = () => page.evaluate(() => {
    const $ = (id) => document.getElementById(id), vis = (el) => !!el && !el.hidden && getComputedStyle(el).display !== "none";
    return { word: $("scFlowWord").textContent, track: vis($("scFlowTrack")), cursor: vis($("scFlowCursor")) ? parseFloat($("scFlowCursor").style.left).toFixed(3) + "%" : null,
      ends: [$("scFlowStart").textContent, $("scFlowCount").textContent, $("scFlowFinal").textContent],
      segs: [...$("scFlowSegs").children].map((s) => s.dataset.state + "@" + parseFloat(s.style.left).toFixed(3) + "+" + parseFloat(s.style.width).toFixed(3)),
      marks: [...$("scFlowMarks").children].map((m) => (m.classList.contains("scFlowFrontier") ? "|" : "·") + parseFloat(m.style.left).toFixed(3)),
      rows: vis($("scFlowRows")) ? [...$("scFlowRows").children].map((r) => r.textContent) : [] }; });
  /* Tinte medio (R − G) de la franja junto al tramo más largo de una conexión, en píxeles de pantalla: oliva < 0 < terracota */
  /* encuadre fijo (zoom 0,8, centrado en la bifurcación): el muestreo siempre cae dentro del lienzo, también a 390 */
  const focus = () => page.evaluate(() => { const r = cv.getBoundingClientRect(); viewZoom = 0.8; viewX = r.width / 2 - 540 * 0.8; viewY = r.height / 2 - 330 * 0.8; });
  const tint = (edgeId) => page.evaluate((id) => {
    const e = P().edges.find((x) => x.id === id), pts = edgePaintedPoints(e, editorSkinOn());
    let best = 0, a = null, b = null; for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); if (L > best) { best = L; a = pts[i]; b = pts[i + 1]; } }
    const dpr = cv.fluyoDpr || 1, g = cv.getContext("2d"), ux = (b.x - a.x) / best, uy = (b.y - a.y) / best;
    let sum = 0, n = 0; const off = 1.2 + 1.2 / viewZoom;   /* entre el borde de la línea y el de la funda, a cualquier zoom */
    for (let s = 0.3; s <= 0.7; s += 0.02) for (const o of [off, -off]) {
      const wx = a.x + (b.x - a.x) * s - uy * o, wy = a.y + (b.y - a.y) * s + ux * o;
      const px = g.getImageData(Math.round((wx * viewZoom + viewX) * dpr), Math.round((wy * viewZoom + viewY) * dpr), 1, 1).data;
      sum += px[0] - px[1]; n++;
    }
    return Math.round(sum / n * 10) / 10; }, edgeId);
  /* Color medio (RGB) de esa misma franja: para leer el TONO del halo (QA del PO: en claro debe leerse oliva, no gris) */
  const rgb = (edgeId) => page.evaluate((id) => {
    const e = P().edges.find((x) => x.id === id), pts = edgePaintedPoints(e, editorSkinOn());
    let best = 0, a = null, b = null; for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); if (L > best) { best = L; a = pts[i]; b = pts[i + 1]; } }
    const dpr = cv.fluyoDpr || 1, g = cv.getContext("2d"), ux = (b.x - a.x) / best, uy = (b.y - a.y) / best, acc = [0, 0, 0], off = 1.2 + 1.2 / viewZoom;
    let n = 0;
    for (let s = 0.3; s <= 0.7; s += 0.02) for (const o of [off, -off]) {
      const wx = a.x + (b.x - a.x) * s - uy * o, wy = a.y + (b.y - a.y) * s + ux * o;
      const px = g.getImageData(Math.round((wx * viewZoom + viewX) * dpr), Math.round((wy * viewZoom + viewY) * dpr), 1, 1).data;
      acc[0] += px[0]; acc[1] += px[1]; acc[2] += px[2]; n++;
    }
    return acc.map((v) => Math.round(v / n)); }, edgeId);
  /* Recorte del lienzo alrededor del punto medio del tramo más largo de una conexión (para comparar píxel a píxel) */
  const crop = async (edgeId, r = 14) => {
    /* píxeles del LIENZO (no de la pantalla: a 390 la hoja tapa parte del lienzo, que sigue pintándose debajo) */
    const data = await page.evaluate(({ id, r }) => { const e = P().edges.find((x) => x.id === id), pts = edgePaintedPoints(e, editorSkinOn());
      let best = 0, m = null; for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); if (L > best) { best = L; m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }; } }
      const dpr = cv.fluyoDpr || 1, x = Math.round((m.x * viewZoom + viewX - r) * dpr), y = Math.round((m.y * viewZoom + viewY - r) * dpr);
      if (x < 0 || y < 0 || x + 2 * r * dpr > cv.width || y + 2 * r * dpr > cv.height) return "fuera del lienzo";
      return Array.from(cv.getContext("2d").getImageData(x, y, Math.round(2 * r * dpr), Math.round(2 * r * dpr)).data).join(","); }, { id: edgeId, r });
    return data === "fuera del lienzo" ? data : hash(data);
  };
  const canvasHash = async () => hash(Buffer.from(await page.evaluate(() => cv.toDataURL("image/png")), "utf8"));
  return { ctx, page, errors, load, story, frames, playAt, tool, tint, rgb, crop, canvasHash, focus };
}
const shot = async (T, name) => { if (shots) await T.page.screenshot({ path: path.join(shots, name + ".png") }); };

async function acceptance(browser, base, vp, label, touch) {
  console.log(`\n── V1–V2 · ${label} (${vp.width}×${vp.height}${touch ? ", dedo" : ""}) con ?labs=escenarios`);
  const T = await open(browser, base, vp, "?labs=escenarios", { touch });
  try {
    await T.load(DOC()); await T.story();
    let v = await T.tool();
    check(v.word === "Al inicio · Ruta disponible" && v.track && v.cursor === null, `edición: «${v.word}», línea de tiempo completa y sin cursor`);
    check(JSON.stringify(v.segs) === JSON.stringify(["AVAILABLE@0.000+66.667", "UNAVAILABLE@66.667+33.333"]) && JSON.stringify(v.marks) === JSON.stringify(["·33.333", "|66.667"]),
      `tramos ${v.segs.join(" ")} · marcas ${v.marks.join(" ")} (punto = cae A, barra = cae B)`);
    check(v.ends.join(" / ") === "disponible / 1 / no disponible", `extremos: ${v.ends.join(" / ")}`);
    check(JSON.stringify(v.rows) === JSON.stringify(["vía Worker A · disponible", "vía Worker B · disponible"]), `filas: ${v.rows.join(" | ")}`);
    const layout = await T.page.evaluate(() => { const b = document.getElementById("scFlow").getBoundingClientRect(), a = document.querySelector("aside").getBoundingClientRect();
      const ends = [...document.querySelectorAll("#scFlowEnds dd")].every((d) => d.scrollWidth <= d.clientWidth + 1 && d.getClientRects().length === 1);
      return { inside: b.top >= 0 && b.bottom <= innerHeight && b.left >= a.left - 0.5 && b.right <= a.right + 0.5, noScroll: document.documentElement.scrollWidth <= innerWidth, ends, h: Math.round(b.height) }; });
    check(layout.inside && layout.noScroll && layout.ends, `${JSON.stringify(layout)} · la herramienta (${layout.h} px) entra entera en el ${touch ? "panel de la hoja" : "panel"}, sin desbordar; los valores de los extremos en una línea`);
    const sleeves = await T.page.evaluate(async () => { let n = 0; const o = window.drawRouteSleeve; window.drawRouteSleeve = function () { n++; return o.apply(this, arguments); };
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); window.drawRouteSleeve = o; return n; });
    check(sleeves === 0, "editando, el lienzo no pinta la ruta (como hoy)");
    await T.focus(); await T.frames(2);
    const neutral = await T.tint(13);
    await shot(T, `ss4-${vp.width}-edicion`);
    /* reproducción real: muestreo con el reloj de la Historia */
    await T.page.click("#scRun");
    const samples = []; const t0 = Date.now();
    while (Date.now() - t0 < 7000) {
      const s = await T.page.evaluate(() => { const o = scFlowOverlay(); return { t: scPlayback ? scPlayback.cursorVirtual : null, st: scStatus, e13: o && o.edges[13].cls, e14: o && o.edges[14].cls, sweep: !!(o && o.sweep), cursor: document.getElementById("scFlowCursor").style.left }; });
      samples.push(s); if (s.st === "completed") break; await T.page.waitForTimeout(50);
    }
    const ph = (a, b) => samples.filter((s) => s.t !== null && s.t >= a && s.t < b);
    check(ph(0, 1490).length > 3 && ph(0, 1490).every((s) => s.e13 === "AVAILABLE" && s.e14 === "AVAILABLE" && !s.sweep), "antes de caer A: toda la ruta oliva, sin barrido");
    check(ph(1520, 2990).length > 3 && ph(1520, 2990).every((s) => s.e13 === "UNAVAILABLE" && s.e14 === "AVAILABLE" && !s.sweep), "cae A: rama A no disponible, rama B disponible, SIN barrido (cambió un nodo, no la ruta)");
    check(ph(3000, 3880).some((s) => s.sweep) && ph(3020, 99999).every((s) => s.e14 === "UNAVAILABLE"), "cae B: toda la ruta no disponible y un barrido único");
    check(ph(3950, 99999).every((s) => !s.sweep), "el barrido acaba");
    const cur = samples.filter((s) => s.cursor).map((s) => parseFloat(s.cursor));   // el navegador normaliza «0.000%» a «0%»
    check(cur.length > 5 && cur.every((x, i) => i === 0 || x >= cur[i - 1]) && cur[cur.length - 1] === 100, `el cursor avanza con la reproducción hasta el final (${cur[0]} % → ${cur[cur.length - 1]} %)`);
    v = await T.tool();
    check(JSON.stringify(v.rows) === JSON.stringify(["vía Worker A · no disponible", "vía Worker B · no disponible"]), `terminada: ${v.rows.join(" | ")}`);
    /* píxeles: en pausa en instantes exactos */
    await T.playAt(800); await T.focus(); await T.frames(2); const ok13 = await T.tint(13), ok14 = await T.tint(14), req0 = await T.crop(17);
    await shot(T, `ss4-${vp.width}-t0800`);
    await T.playAt(2300); await T.focus(); await T.frames(2); const a13 = await T.tint(13), a14 = await T.tint(14), req1 = await T.crop(17);
    await shot(T, `ss4-${vp.width}-t2300-caeA`);
    await T.playAt(3300); await shot(T, `ss4-${vp.width}-t3300-barrido`);
    await T.playAt(4200); await T.focus(); await T.frames(2); const b13 = await T.tint(13), b14 = await T.tint(14), req2 = await T.crop(17);
    await shot(T, `ss4-${vp.width}-t4200-caeB`);
    check(ok13 < neutral - 2 && ok14 < neutral - 2, `0,8 s: las dos ramas con el halo oliva (R−G ${ok13}, ${ok14}; sin ruta ${neutral})`);
    check(a13 > neutral + 2 && a14 < neutral - 2, `2,3 s: rama A terracota (${a13}), rama B oliva (${a14})`);
    check(b13 > neutral + 2 && b14 > neutral + 2, `4,2 s: las dos terracota (${b13}, ${b14})`);
    check(req0 !== "fuera del lienzo" && req0 === req1 && req1 === req2, `V2 Requisito estable: la zona de API → Auth es idéntica en los tres instantes (${req0})`);
    /* pausa: el lienzo queda quieto */
    const h1 = await T.canvasHash(); await T.page.waitForTimeout(900); await T.frames(2); const h2 = await T.canvasHash();
    check(h1 === h2, "en pausa el lienzo no cambia (900 ms después, mismo fotograma)");
    /* ⏮ / ⏭ con los botones reales */
    await T.page.click("#scPrev"); await T.focus(); await T.frames(3);
    v = await T.tool(); const p1 = await T.tint(13);
    check(v.cursor === "33.333%" && p1 > neutral + 2, `⏮ → cae A: cursor ${v.cursor} y la rama A ya terracota en el instante del salto (${p1})`);
    await T.page.click("#scPrev"); await T.focus(); await T.frames(3);
    v = await T.tool(); check(v.cursor === "0.000%" && (await T.tint(13)) < neutral - 2, `⏮ → inicio: cursor ${v.cursor}, todo oliva`);
    await T.page.click("#scNext"); await T.page.click("#scNext"); await T.frames(3);
    v = await T.tool(); check(v.cursor === "66.667%" && v.word === "Ruta no disponible", `⏭ ⏭ → cae B: cursor ${v.cursor}, «${v.word}»`);
    if (touch) {
      const vis = await T.page.evaluate(() => { const b = document.getElementById("scFlow").getBoundingClientRect(), r = document.getElementById("scFlowRows").getBoundingClientRect(); return b.top >= 0 && r.bottom <= innerHeight && r.height > 10; });
      check(vis, "390: reproduciendo, la herramienta con su línea de tiempo y sus filas sigue entera a la vista en la hoja");
    }
    await T.page.click("#scReset"); await T.frames(2);
    v = await T.tool(); check(v.cursor === null && v.word === "Al inicio · Ruta disponible", "Detener: vuelve a edición, sin cursor");
    check(await T.page.evaluate(() => undoStack.length) === 0, "reproducir, pausar, saltar y pintar no apilan Undo");
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

const satHue = (c) => { const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return { sat: Math.round(d / mx * 100), hue: Math.round(h < 0 ? h + 360 : h) }; };
async function themes(browser, base, vp, touch) {
  console.log(`\n── Temas y piel «construido» (${vp.width})`);
  for (const [theme, skin] of [["claro", false], ["claro", true], ["crema", false], ["crema", true], ["dark", false], ["dark", true]]) {
    const T = await open(browser, base, vp, "?labs=escenarios", { touch });
    try {
      await T.load(DOC({ theme, skin })); await T.story(); await T.focus(); await T.frames(2);
      const neutral = await T.tint(13);
      await T.playAt(2300); await T.focus(); await T.frames(2);
      const a13 = await T.tint(13), a14 = await T.tint(14);
      await shot(T, `ss4-${vp.width}-${theme}${skin ? "-piel" : ""}-t2300`);
      /* oliva: R−G por debajo del fondo; terracota: claramente por encima */
      const ok = theme === "dark" ? a13 > neutral + 2 && a14 !== a13 : a13 > neutral + 2 && a14 < neutral - 2;
      check(ok, `${theme}${skin ? " + piel" : ""}: cae A se distingue (rama A R−G ${a13}, rama B ${a14}, sin ruta ${neutral})`);
      if (theme === "claro") {
        /* QA del PO: sobre blanco el halo disponible se lee OLIVA (tono 60–110°, saturación ≥ 7 %), no gris; y lejos de la terracota */
        const olive = await T.rgb(14), terra = await T.rgb(13), o = satHue(olive), d = Math.round(Math.hypot(olive[0] - terra[0], olive[1] - terra[1], olive[2] - terra[2]));
        check(o.hue >= 60 && o.hue <= 110 && o.sat >= 7 && d >= 20, `claro${skin ? " + piel" : ""}: halo ${JSON.stringify(olive)} (tono ${o.hue}°, saturación ${o.sat} %) · terracota ${JSON.stringify(terra)} · Δ ${d}`);
      }
      if (skin) {
        const ports = await T.page.evaluate(async () => { let n = 0; const o = window.skinEdgePort; window.skinEdgePort = function () { n++; return o.apply(this, arguments); };
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); window.skinEdgePort = o; return n; });
        check(ports > 0 && ports % 7 === 0, `N3: anillos de salida por fotograma = 7 de 8 conexiones (el Requisito, no) · ${ports} en ${ports / 7} fotogramas`);
        const landed = await T.page.evaluate(() => { const e = P().edges.find((x) => x.id === 17); return JSON.stringify(edgePaintedPoints(e, true)) !== JSON.stringify(edgePoints(e)); });
        check(landed, "con la piel, la línea pintada (la que siguen las fundas) aterriza sobre la silueta");
      }
      check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
    } finally { await T.ctx.close(); }
  }
}

async function counts(browser, base, vp, touch) {
  console.log(`\n── Recuento de rutas (${vp.width})`);
  const T = await open(browser, base, vp, "?labs=escenarios", { touch });
  try {
    const four = DOC(); const pg = four.doc.pages[0];
    pg.nodes.push(N(9, 800, 560, "Worker C"), N(10, 800, 40, "Worker D"));
    pg.edges.push(E(19, COLA, 9, "FLOWS_TO"), E(20, 9, BD, "FLOWS_TO"), E(21, COLA, 10, "FLOWS_TO"), E(22, 10, BD, "FLOWS_TO"));
    await T.load(four); await T.story();
    let v = await T.tool();
    check(v.rows.length === 4 && v.rows[3] === "+1 ruta", `4 caminos: ${v.rows.join(" | ")}`);
    const five = JSON.parse(JSON.stringify(four)); five.doc.pages[0].edges.push(E(23, API, BD, "FLOWS_TO"));
    await T.load(five); await T.page.evaluate(() => scRefreshIfVisible()); v = await T.tool();
    check(v.rows[3] === "+2 rutas", `5 caminos: ${v.rows.join(" | ")}`);
    /* malla con ciclos: 8 intermedios todos con todos (109 601 caminos simples): por encima del tope, el recuento no es exacto */
    const nodes = [N(1, 100, 300, "Origen"), N(2, 1300, 300, "Destino")], edges = []; let id = 100;
    for (let i = 0; i < 8; i++) nodes.push(N(10 + i, 300 + (i % 4) * 230, i < 4 ? 150 : 450, "M" + (i + 1)));
    for (let i = 0; i < 8; i++) { edges.push(E(id++, 1, 10 + i, "FLOWS_TO"), E(id++, 10 + i, 2, "FLOWS_TO")); for (let j = 0; j < 8; j++) if (i !== j) edges.push(E(id++, 10 + i, 10 + j, "FLOWS_TO")); }
    const mesh = { version: 5, app: "fluyo", settings: {}, doc: { theme: "crema", customBg: "", cur: 0, nextEventTypeId: 1, eventTypes: [], pages: [{ name: "Malla", nextId: 999, behaviors: [], nextScenarioId: 2, nodes, edges,
      scenarios: [{ id: 1, engineVersion: 2, name: "Malla", nextStepId: 2, steps: [{ id: 1, at: 500, action: "SET_STATE", nodeId: 10, state: "DOWN" }] }] }] } };
    await T.load(mesh); await T.page.evaluate(() => scRefreshIfVisible()); v = await T.tool();
    check(v.rows.length === 4 && v.rows[3] === "Más de 10 000 rutas" && v.rows.every((r) => !/\+\d|o más/.test(r)), `no exacto: ${v.rows.join(" | ")}`);
    const fits = await T.page.evaluate(() => { const r = document.getElementById("scFlowRows").getBoundingClientRect(); return r.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth; });
    check(fits, "las filas se ven enteras, sin desbordar");
    await shot(T, `ss4-${vp.width}-recuento-malla`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function labsOff(browser, now, old, vp, label, touch) {
  console.log(`\n── V4 · labs apagado frente a ${BASE} · ${label}`);
  const meas = async (base) => {
    const T = await open(browser, base, vp, "?labs=off", { touch });
    try {
      await T.load(DOC()); await T.story();
      const edit = await T.canvasHash();
      const header = await T.page.locator("#panelScenarios .scHeader").screenshot();
      const at = {};
      for (const t of [800, 2300, 3300]) { await T.playAt(t); at[t] = await T.canvasHash(); }
      const hidden = await T.page.evaluate(() => { const f = document.getElementById("scFlow"); return !f || (f.hidden && getComputedStyle(f).display === "none"); });
      return { edit, header: hash(header), at, hidden, errors: T.errors };
    } finally { await T.ctx.close(); }
  };
  const a = await meas(old.base), b = await meas(now.base);
  check(b.hidden, "la herramienta no existe");
  check(a.edit === b.edit, `lienzo editando idéntico (${a.edit} = ${b.edit})`);
  check([800, 2300, 3300].every((t) => a.at[t] === b.at[t]), "lienzo reproduciendo, en pausa a 0,8 · 2,3 · 3,3 s: idéntico píxel a píxel");
  check(a.header === b.header, "cabecera de Historias idéntica píxel a píxel");
  check(b.errors.length === 0, "sin errores de consola");
}

async function present(browser, base) {
  console.log("\n── V5 · Present con labs: nada de la ruta en el lienzo (FASE 5)");
  const T = await open(browser, base, { width: 1440, height: 900 }, "?labs=escenarios");
  try {
    await T.load(DOC());
    await T.page.click("#btnPresent"); await T.page.waitForTimeout(400);
    const r = await T.page.evaluate(async () => {
      let n = 0; const o = window.drawRouteSleeve; window.drawRouteSleeve = function () { n++; return o.apply(this, arguments); };
      presentPlay(); await new Promise((res) => setTimeout(res, 2300));
      const spec = scFlowOverlay(), rs = buildScenarioRenderState();
      window.drawRouteSleeve = o; return { n, spec, flow: !!(rs && rs.flow), presenting, playing: scStatus };
    });
    check(r.presenting && r.playing === "running" && r.n === 0 && r.spec === null && !r.flow, `Present reproduciendo: 0 fundas, sin \`flow\` en el renderState (${r.playing})`);
    check(T.errors.length === 0, "sin errores de consola" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
  } finally { await T.ctx.close(); }
}

async function reducedMotion(browser, base) {
  console.log("\n── V6 · «reducir movimiento»: sin barrido");
  const run = async (reduced) => {
    const T = await open(browser, base, { width: 1440, height: 900 }, "?labs=escenarios", { reduced });
    try {
      await T.load(DOC()); await T.story();
      await T.playAt(3000 + 470); const mid = await T.crop(12, 10);   // barrido a la mitad (fundido ya acabado)
      await T.playAt(3000 + 1200); const after = await T.crop(12, 10);
      return { same: mid === after, errors: T.errors };
    } finally { await T.ctx.close(); }
  };
  const normal = await run(false), red = await run(true);
  check(!normal.same, "sin preferencia: a mitad del barrido la conexión API → Cola se ve distinta que después");
  check(red.same, "con «reducir movimiento»: el mismo fotograma (no hay barrido)");
  check(!normal.errors.length && !red.errors.length, "sin errores de consola");
}

(async () => {
  const t0 = Date.now();
  const oldDir = treeAt(BASE);
  const now = await serve(root), old = await serve(oldDir);
  const launch = process.env.FLUYO_CHROME ? { executablePath: process.env.FLUYO_CHROME } : { channel: process.env.FLUYO_BROWSER || "chrome" };
  const browser = await chromium.launch(Object.assign({ headless: !process.env.HEADED }, launch));
  try {
    await acceptance(browser, now.base, { width: 1440, height: 900 }, "escritorio");
    await acceptance(browser, now.base, { width: 390, height: 844 }, "teléfono", true);
    await themes(browser, now.base, { width: 1440, height: 900 }, false);
    await themes(browser, now.base, { width: 390, height: 844 }, true);
    await counts(browser, now.base, { width: 1440, height: 900 }, false);
    await counts(browser, now.base, { width: 390, height: 844 }, true);
    await labsOff(browser, now, old, { width: 1440, height: 900 }, "1440");
    await labsOff(browser, now, old, { width: 390, height: 844 }, "390", true);
    await present(browser, now.base);
    await reducedMotion(browser, now.base);
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
        const installed = (name) => until(async (name) => { if (!(await caches.keys()).includes(name)) return false; const c = await caches.open(name); return !!(await c.match(location.origin + "/js/editor-scenarios.js")); }, name, name);
        const activated = () => until(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !r.installing && !r.waiting && !!r.active && r.active.state === "activated"; }, null, "activado");
        await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
        await installed(PREV); await activated();
        check(true, BASE + ": " + PREV + " instalada y activa");
        sw.state.dir = root;
        await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
        await installed(CUR); await activated();
        await until(async (p) => !(await caches.keys()).includes(p), PREV, "la anterior borrada");
        const keys = await pg.evaluate(async () => caches.keys());
        await pg.reload(); await pg.waitForFunction(() => typeof renderTabs === "function");
        const live = await pg.evaluate(async () => ({ route: typeof FluyoFlow.flowRoute, overlay: typeof scFlowOverlay, sleeve: typeof drawRouteSleeve, ctrl: !!navigator.serviceWorker.controller }));
        check(CUR !== PREV && keys.join() === CUR && live.route === "function" && live.overlay === "function" && live.sleeve === "function" && live.ctrl,
          `${CUR} instalada y activada, ${PREV} borrada (${keys.join()}); tras recargar, el código de FASE 4 está activo y sale de la caché`);
      } finally { await ctx.close(); sw.server.close(); }
    }
  } finally {
    await browser.close(); now.server.close(); old.server.close();
    fs.rmSync(oldDir, { recursive: true, force: true });
  }
  console.log(`\n${passed} ✔ · ${failed} ✘ (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
