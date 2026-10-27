"use strict";
/* FLUYO-018.18 — Chrome REAL: contar una Historia en cualquier superficie. Mide los criterios de .ai/tasks/FLUYO-018.18.md (§ 8):
   números, no «se ve bien».
   · Editor (D1–D6): Reproducir → Pausar (la proyección queda quieta) → saltar entre momentos (botones y filas) → Reanudar →
     terminada (Repetir, Detener) → Detener → Volver a editar. El documento no cambia y no hay Undo. El momento se lee SOBRE el
     lienzo y nunca tapa su destino; la hoja móvil mide lo mismo en todos los momentos; el lienzo no baja del umbral.
   · Present (D7, D8): tocar el lienzo no cambia de página ni detiene; los controles sí; una salida; 44 px con dedo.
   · Viewer (D9): encaja después de la banda (dentro del lienzo al cargar, también 1280 × 720 y apaisado), reencaja al girar, la
     banda no cambia de alto, cabecera de una fila, sin «Hecho con Fluyo» en apaisado, Historia reproducible y pausable también
     presentando.
   · Páginas (D10, D11): con 6 páginas, la activa siempre identificable; selector en el teléfono con «＋ Nueva página»; sin ✕;
     renombrar sin diálogos nativos; «Eliminar página» con su confirmación y su Undo.
   · Dirección (D12): «Sentido de los puntos» en Trazo, tres opciones = normal/reverse/alternate, un Undo, persiste; formato igual.
   Viewports: 1440×900 y 1280×720 (ratón), 768×1024 (dedo), 390×844 y 375×812 (móvil), 844×390 y 812×375 (apaisado).
   Uso: node test/fluyo-018-18-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=d1440|d1280|t768|m390|m375|l844|l812|sw   recorre solo esa parte (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-18-"));
fs.mkdirSync(shots, { recursive: true });
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
/* 6 páginas con nombres reales y largos, la activa es la 3.ª (la que la auditoría encontró oculta) */
const MANY = (() => { const d = JSON.parse(FIXTURE); const names = ["Arquitectura general", "Pagos con tarjeta", "Conciliación nocturna", "Alta de cliente", "Incidente Kafka", "Notas"]; const b = d.doc.pages[0]; d.doc.pages = names.map((n, i) => ({ ...JSON.parse(JSON.stringify(i === 0 ? b : { ...b, scenarios: [], nextScenarioId: 1 })), name: n })); d.doc.cur = 2; return JSON.stringify(d); })();
/* las conexiones del fixture no tienen puntos en movimiento: para el sentido se encienden */
const DOTS = (() => { const d = JSON.parse(FIXTURE); for (const p of d.doc.pages) for (const e of p.edges) e.animated = true; return JSON.stringify(d); })();

const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      const body = fs.readFileSync(file);   /* leer ANTES de escribir cabeceras: un archivo que falta es un 404, no un doble writeHead */
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* Umbrales de lienzo (% de pantalla) reproduciendo, en TODOS los momentos (§ 8): móvil 70/68 (antes 64/60 en el 3.er momento). */
const VIEWPORTS = [
  { key: "d1440", width: 1440, height: 900, playing: 66, viewerLand: 0 },
  { key: "d1280", width: 1280, height: 720, playing: 60 },
  { key: "t768", width: 768, height: 1024, touch: true, playing: 50 },
  { key: "m390", width: 390, height: 844, touch: true, mobile: true, playing: 70 },
  { key: "m375", width: 375, height: 812, touch: true, mobile: true, playing: 68 },
  { key: "l844", width: 844, height: 390, touch: true, mobile: true, landscape: true, playing: 30 },
  { key: "l812", width: 812, height: 375, touch: true, mobile: true, landscape: true, playing: 30 },
];
const ONLY = process.env.ONLY || "";

async function context(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  return ctx;
}
async function open(browser, base, vp) {
  const ctx = await context(browser, base, vp);
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => { dialogs.push(d.type() + ":" + d.message().slice(0, 40)); d.accept(); });
  await page.goto(base + "/"); await page.waitForFunction(() => typeof scRun === "function" && typeof FluyoStoryClock === "object");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors, dialogs };
}
const load = async (page, fx) => { await page.evaluate((fx) => { if (typeof scReset === "function") scReset(); applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, fx); await page.waitForTimeout(250); };
const press = async (t, sel, vp, ms = 300) => { const l = t.page.locator(sel).first(); if (vp.touch) await l.tap(); else await l.click(); await t.page.waitForTimeout(ms); };
const tapAt = async (t, vp, x, y, ms = 300) => { if (vp.touch) await t.page.touchscreen.tap(x, y); else await t.page.mouse.click(x, y); await t.page.waitForTimeout(ms); };
const shot = (t, vp, name) => t.page.screenshot({ path: path.join(shots, `${vp.key}-${name}.png`) });

/* ───────── medidas ───────── */
const CANVAS = (id) => { let hit = 0, n = 0; const el = document.getElementById(id); for (let y = 4; y < innerHeight; y += 8) for (let x = 4; x < innerWidth; x += 8) { n++; const e = document.elementFromPoint(x, y); if (e === el || (e && e.closest && e.closest(".scNow, .stNow"))) hit++; } return Math.round(hit / n * 100); };
const SIZES = ([ids, touch]) => ids.map((id) => { const e = document.getElementById(id); if (!e || e.closest("[hidden]") || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return r.width ? [id, Math.round(r.width), Math.round(r.height)] : null; }).filter(Boolean).filter(([, w, h]) => Math.min(w, h) < (touch ? 44 : 28) - 0.5);
/* el rótulo del momento y los destinos de ese momento (cajas en pantalla) — no se solapan */
const MOMENT = () => {
  const card = document.getElementById("scNow"); if (!card || card.hidden) return { on: false };
  const c = card.getBoundingClientRect(), cv = document.getElementById("cv").getBoundingClientRect(), n = scMomentNav(), sc = scActiveScenario();
  const at = n.index >= 0 ? n.times[n.index] : null, boxes = [];
  for (const s of sc.steps) {
    if (s.at !== at) continue;
    if (s.edgeId) { const e = edgeById(s.edgeId), pts = edgePoints(e); boxes.push([Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))]); for (const nd of [nodeById(e.from), nodeById(e.to)]) boxes.push([nd.x - nd.w / 2, nd.y - nd.h / 2, nd.x + nd.w / 2, nd.y + nd.h / 2]); }
    else { const nd = nodeById(s.nodeId); boxes.push([nd.x - nd.w / 2, nd.y - nd.h / 2, nd.x + nd.w / 2, nd.y + nd.h / 2]); }
  }
  const scr = boxes.map(([a, b, x, y]) => [cv.left + a * viewZoom + viewX, cv.top + b * viewZoom + viewY, cv.left + x * viewZoom + viewX, cv.top + y * viewZoom + viewY]);
  const overlap = scr.some(([l, t, r, b]) => r > c.left && l < c.right && b > c.top && t < c.bottom);
  /* el momento ENTERO (elementos y los dos extremos de cada conexión) en la zona libre si cabe a este zoom; si no cabe, al menos un destino */
  const v = visibleCanvasRect(), ends = [];
  for (const s of sc.steps) { if (s.at !== at) continue; const ids = s.edgeId ? [edgeById(s.edgeId).from, edgeById(s.edgeId).to] : [s.nodeId]; for (const id of ids) { const nd = nodeById(id); ends.push([nd.x - nd.w / 2, nd.y - nd.h / 2, nd.x + nd.w / 2, nd.y + nd.h / 2]); } }
  const X0 = Math.min(...ends.map((e) => e[0])), Y0 = Math.min(...ends.map((e) => e[1])), X1 = Math.max(...ends.map((e) => e[2])), Y1 = Math.max(...ends.map((e) => e[3]));
  const fits = (X1 - X0) * viewZoom <= v.width && (Y1 - Y0) * viewZoom <= v.height;
  const inZone = ([a, b, x, y]) => a * viewZoom + viewX >= v.left - 1 && b * viewZoom + viewY >= v.top - 1 && x * viewZoom + viewX <= v.right + 1 && y * viewZoom + viewY <= v.bottom + 1;
  /* sin caber: un elemento entero o el punto medio de una conexión (la definición de «destino a la vista» de la decisión 148) */
  const mids = sc.steps.filter((s) => s.at === at && s.edgeId).map((s) => { const e = edgeById(s.edgeId), a = nodeById(e.from), b = nodeById(e.to); const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2; return [x, y, x, y]; });
  const nodesOnly = sc.steps.filter((s) => s.at === at && !s.edgeId).map((s) => { const nd = nodeById(s.nodeId); return [nd.x - nd.w / 2, nd.y - nd.h / 2, nd.x + nd.w / 2, nd.y + nd.h / 2]; });
  const anyIn = fits ? inZone([X0, Y0, X1, Y1]) : [...nodesOnly, ...mids].some(inZone);
  return { on: true, h: Math.round(c.height), lines: Math.round(c.height / 18), overlap, anyIn, label: document.getElementById("scNowLabel").textContent, progress: document.getElementById("scNowProgress").textContent, oneLine: getComputedStyle(document.getElementById("scNowCaption")).whiteSpace === "nowrap" };
};
const STATE = () => ({ status: scStatus, paused: scIsPaused(), t: scPlayback ? Math.round(scPlayback.cursorVirtual) : -1, story: document.body.dataset.story, undo: undoStack.length, doc: JSON.stringify(serializeProject().doc), sheetH: document.body.classList.contains("panelOpen") ? Math.round(document.querySelector("aside").getBoundingClientRect().height) : 0, asideTop: document.querySelector("aside").scrollTop, ox: document.documentElement.scrollWidth - innerWidth });

/* ═════════ editor: reproducir, pausar, saltar, reanudar, detener ═════════ */
async function editorStory(browser, base, vp) {
  const t = await open(browser, base, vp); const { page } = t;
  await load(page, FIXTURE);
  const sheet = await page.evaluate(() => isSheetLayout());
  const tag = `${vp.key} editor`;
  const before = await page.evaluate(STATE);
  await press(t, sheet ? "#btnStories" : "#tabScenarios", vp, 450);
  const compactH = sheet ? (await page.evaluate(STATE)).sheetH : 0;
  await press(t, "#scRun", vp, 350);
  let s = await page.evaluate(STATE), mo = await page.evaluate(MOMENT);
  check(s.status === "running" && !s.paused && mo.on && mo.label === "Reproduciendo" && mo.oneLine, `${tag}: Reproducir → «Reproduciendo» sobre el lienzo, en una línea`);
  const transport = ["scPrev", "scPause", "scNext", "scReset", "btnStoryExit", ...(sheet ? ["btnStoryExpand"] : [])];
  const small = await page.evaluate(SIZES, [transport, !!vp.touch]);
  const visibleTransport = await page.evaluate((ids) => ids.filter((id) => { const e = document.getElementById(id); return e && !e.hidden && e.getBoundingClientRect().height > 0; }), transport);
  check(visibleTransport.length === transport.length && small.length === 0, `${tag}: transporte a la vista y ≥ ${vp.touch ? 44 : 28} px ${JSON.stringify([visibleTransport, small])}`);
  await shot(t, vp, "editor-1-reproduciendo");
  /* Pausar: la proyección queda quieta */
  await press(t, "#scPause", vp, 150);
  const p1 = await page.evaluate(() => [scIsPaused(), Math.round(scPlayback.cursorVirtual), JSON.stringify(buildScenarioRenderState()), $("scPause").textContent.trim(), $("scNowLabel").textContent]);
  await page.waitForTimeout(700);
  const p2 = await page.evaluate(() => [Math.round(scPlayback.cursorVirtual), JSON.stringify(buildScenarioRenderState())]);
  check(p1[0] && p1[1] === p2[0] && p1[2] === p2[1] && p1[3] === "Reanudar" && p1[4] === "En pausa", `${tag}: Pausar congela cursor y proyección 700 ms («Reanudar», «En pausa»)`);
  /* saltar por todos los momentos: alto de la hoja constante, rótulo sin tapar el destino, lienzo ≥ umbral */
  await page.evaluate(() => scSeekMoment(0)); await page.waitForTimeout(200);
  const heights = [], canvas = [], overlaps = [], ins = [], ats = [];
  for (let i = 0; i < 4; i++) {
    if (i > 0) await press(t, "#scNext", vp, 250);
    s = await page.evaluate(STATE); mo = await page.evaluate(MOMENT);
    heights.push(s.sheetH); canvas.push(await page.evaluate(CANVAS, "cv")); overlaps.push(mo.overlap); ins.push(mo.anyIn); ats.push(s.t);
    if (i === 2) await shot(t, vp, "editor-2-momento3");
  }
  check(JSON.stringify(ats) === "[0,500,2500,7000]", `${tag}: «siguiente» recorre los momentos ${JSON.stringify(ats)}`);
  check(!sheet || heights.every((h) => h === heights[0]), `${tag}: la hoja mide lo mismo en los 4 momentos ${JSON.stringify(heights)}`);
  /* 018.19 (D6): en el teléfono apaisado, reproducir recoge la hoja lateral en una franja inferior de una fila */
  if (vp.landscape) check(heights[0] <= 72, `${tag}: reproduciendo, la hoja es una franja de una fila (${heights[0]} px)`);
  else check(!sheet || Math.abs(heights[0] - compactH) <= 8, `${tag}: reproduciendo mide lo que la compacta (${heights[0]} / ${compactH} px)`);
  check(canvas.every((c) => c >= vp.playing), `${tag}: lienzo ≥ ${vp.playing}% en todos los momentos ${JSON.stringify(canvas)}`);
  check(overlaps.every((o) => !o), `${tag}: el rótulo nunca tapa el destino del momento ${JSON.stringify(overlaps)}`);
  check(ins.every(Boolean), `${tag}: el destino del momento está en la zona libre ${JSON.stringify(ins)}`);
  /* forzar el caso: el destino del momento justo debajo del rótulo (arriba de la zona libre) ⇒ el rótulo baja al pie */
  await page.evaluate(() => { const sc = scActiveScenario(), n = scMomentNav(), at = n.times[n.index], v = visibleCanvasRect(); const st = sc.steps.find((x) => x.at === at), nd = nodeById(st.edgeId ? edgeById(st.edgeId).to : st.nodeId); viewY = v.top + 14 - (nd.y - nd.h / 2) * viewZoom; viewX = cv.getBoundingClientRect().width / 2 - nd.x * viewZoom; });
  await page.waitForTimeout(250);
  const under = await page.evaluate(MOMENT), atBottom = await page.evaluate(() => $("scNow").classList.contains("atBottom"));
  check(!under.overlap && atBottom, `${tag}: con el destino bajo el rótulo, el rótulo se recoloca al pie ${JSON.stringify({ overlap: under.overlap, atBottom })}`);
  const nextOff = await page.evaluate(() => $("scNext").disabled);
  check(nextOff, `${tag}: en el último momento no hay «siguiente»`);
  await press(t, "#scPrev", vp, 250);
  check((await page.evaluate(STATE)).t === 2500, `${tag}: «anterior» vuelve al momento 3`);
  /* tocar una fila de la línea de tiempo salta a su momento (en la hoja, desde la ampliada) */
  if (sheet) await press(t, "#btnStoryExpand", vp, 400);
  const row = await page.evaluate(() => { const r = [...document.querySelectorAll(".scStoryRow")].find((x) => { const s = scActiveScenario().steps.find((st) => String(st.id) === x.dataset.stepId); return s && s.at === 500 && x.getBoundingClientRect().height > 0; }); if (!r) return null; r.scrollIntoView({ block: "nearest" }); const b = r.getBoundingClientRect(); return [b.left + 24, b.top + b.height / 2]; });
  if (row) { await tapAt(t, vp, row[0], row[1], 300); }
  s = await page.evaluate(STATE);
  check(row && s.t === 500 && s.paused, `${tag}: tocar una fila salta a su momento (500 ms) y conserva la pausa`);
  const rowActive = await page.evaluate(() => { const a = document.querySelector(".scStoryRow.scStatus_active, .scStoryRow.scStatus_completed"); const b = document.querySelector(".scStoryboardSection"); if (!a || !b) return null; const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return r.height > 0 && r.top >= q.top - 1 && r.bottom <= q.bottom + 1; });
  check(rowActive !== false, `${tag}: la fila del momento está a la vista en la línea de tiempo`);
  if (sheet) await press(t, "#btnStoryExpand", vp, 300);
  /* reproduciendo, tocar el vacío del lienzo no detiene (los controles sí) */
  await press(t, "#scPause", vp, 200);
  const empty = await page.evaluate(() => { const v = visibleCanvasRect(), r = cv.getBoundingClientRect(); for (let y = v.top + 30; y < v.bottom - 30; y += 20) for (let x = 20; x < r.width - 20; x += 20) { const w = { x: (x - viewX) / viewZoom, y: (y - viewY) / viewZoom }; if (!hitNode(w.x, w.y) && !hitEdge(w.x, w.y)) { const e = document.elementFromPoint(r.left + x, r.top + y); if (e === cv) return [r.left + x, r.top + y]; } } return null; });
  if (empty) await tapAt(t, vp, empty[0], empty[1], 200);
  s = await page.evaluate(STATE);
  check(s.status === "running" && !s.paused && s.story === "playing", `${tag}: tocar el lienzo no detiene ni pausa la reproducción`);
  await page.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 }); await page.waitForTimeout(200);
  const fin = await page.evaluate(() => [$("scRun").textContent.trim(), !$("scRun").hidden, $("scReset").textContent.trim(), !$("scReset").hidden && $("scReset").getBoundingClientRect().height > 0, $("scNowLabel").textContent]);
  check(fin[0] === "↻ Repetir" && fin[1] && fin[2] === "■ Detener" && fin[3] && fin[4] === "Terminada", `${tag}: terminada → «Repetir» y «Detener» (una sola palabra) ${JSON.stringify(fin)}`);
  await shot(t, vp, "editor-3-terminada");
  await press(t, "#scPrev", vp, 250);
  s = await page.evaluate(STATE);
  check(s.status === "running" && s.paused && s.t === 7000, `${tag}: desde terminada, «anterior» vuelve al último momento en pausa`);
  await press(t, "#scReset", vp, 250);
  s = await page.evaluate(STATE);
  check(s.status === "idle" && !(await page.evaluate(MOMENT)).on, `${tag}: Detener vuelve a la Historia lista y retira el rótulo`);
  await press(t, "#scRun", vp, 200); await page.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 });
  await press(t, "#scRun", vp, 200);
  check((await page.evaluate(STATE)).status === "running", `${tag}: Repetir vuelve a reproducir`);
  await press(t, "#btnStoryExit", vp, 300);
  s = await page.evaluate(STATE);
  check(s.status === "idle" && s.story === "closed", `${tag}: «Volver a editar» detiene y sale del modo`);
  check(s.doc === before.doc && s.undo === before.undo, `${tag}: el documento no cambia y no hay Undo (${before.undo} → ${s.undo})`);
  check(s.asideTop === 0 && s.ox <= 0, `${tag}: sin scroll accidental (hoja ${s.asideTop}, página ${s.ox})`);
  check(t.errors.length === 0, `${tag}: 0 errores ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ Present ═════════ */
async function present(browser, base, vp) {
  const t = await open(browser, base, vp); const { page } = t;
  await load(page, FIXTURE);
  const tag = `${vp.key} present`;
  await page.evaluate(() => enterPresent()); await page.waitForTimeout(600);
  await press(t, "#psPlay", vp, 500);
  const c = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.45]; });
  const a = await page.evaluate(() => [doc.cur, presentPhase()]);
  await tapAt(t, vp, c[0], c[1], 300);
  await tapAt(t, vp, c[0] + 30, c[1] + 40, 300);
  const b = await page.evaluate(() => [doc.cur, presentPhase(), presenting]);
  check(a[1] === "playing" && b[0] === a[0] && b[1] === "playing" && b[2], `${tag}: tocar el lienzo no cambia de página ni detiene la Historia ${JSON.stringify([a, b])}`);
  await press(t, "#psPause", vp, 200);
  const p = await page.evaluate(() => [presentPhase(), $("psPause").textContent.trim(), Math.round(scPlayback.cursorVirtual)]);
  await page.waitForTimeout(500);
  check(p[0] === "paused" && p[1] === "Reanudar" && Math.round(await page.evaluate(() => scPlayback.cursorVirtual)) === p[2], `${tag}: Pausar en Present (mismo reloj que el editor)`);
  await press(t, "#psNext", vp, 200);
  const dots = await page.evaluate(() => [...document.querySelectorAll("#psDots .psDot.done")].length);
  check(dots >= 2, `${tag}: «momento siguiente» avanza los puntos (${dots})`);
  const bar = await page.evaluate(([touch]) => {
    const vis = (e) => e && e.getBoundingClientRect().height > 0 && !e.closest("[hidden]");
    const btns = [...document.querySelectorAll("#presentBar button")].filter(vis);
    const exits = btns.filter((e) => /Salir|Volver a editar/.test(e.textContent + " " + (e.getAttribute("aria-label") || ""))).length;
    const small = btns.filter((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) < (touch ? 44 : 28) - 0.5).map((e) => e.id);
    const rowOf = (g) => new Set([...g.querySelectorAll("button")].filter(vis).map((e) => Math.round(e.getBoundingClientRect().top))).size;
    return { exits, small, story: rowOf(document.getElementById("psGroup")), pages: rowOf(document.getElementById("prPages")), h: Math.round(document.getElementById("presentBar").getBoundingClientRect().height), opacity: getComputedStyle(document.getElementById("presentBar")).opacity };
  }, [!!vp.touch]);
  check(bar.exits === 1 && bar.small.length === 0 && bar.story === 1 && bar.pages === 1, `${tag}: una salida, objetivos ≥ ${vp.touch ? 44 : 28} y grupos sin partir ${JSON.stringify(bar)}`);
  if (vp.touch) check(+bar.opacity === 1, `${tag}: con el dedo el mando no se aparta (opacidad ${bar.opacity})`);
  await shot(t, vp, "present");
  await press(t, "#prNext", vp, 400);
  const pg = await page.evaluate(() => [doc.cur, presentPhase()]);
  check(pg[0] === 1, `${tag}: el control de página sí cambia de página ${JSON.stringify(pg)}`);
  await press(t, "#prExit", vp, 400);
  check(!(await page.evaluate(() => presenting)), `${tag}: «Salir» sale`);
  check(t.errors.length === 0, `${tag}: 0 errores ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ Viewer ═════════ */
async function viewer(browser, base, vp, url) {
  const ctx = await context(browser, base, vp); const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const t = { page, ctx };
  const tag = `${vp.key} viewer`;
  await page.goto(url); await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready"); await page.waitForTimeout(400);
  const M = () => page.evaluate(() => { const v = window.__viewer.view, b = getBounds(), w = document.getElementById("wrap").getBoundingClientRect(), n = document.getElementById("stNow").getBoundingClientRect(); const kids = [...document.querySelectorAll("#chrome .logo, #chrome .tools > *, #pgSelect, #pgTabs")].filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== "none"); const rows = new Set(kids.map((e) => Math.round((e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2) / 10))).size; const brand = document.getElementById("brand"); return { inside: v.x + b.x * v.zoom >= -1 && v.y + b.y * v.zoom >= -1 && v.x + (b.x + b.w) * v.zoom <= w.width + 1 && v.y + (b.y + b.h) * v.zoom <= w.height + 1, belowCard: v.y + b.y * v.zoom >= n.bottom - w.top - 1, band: Math.round(document.getElementById("story").getBoundingClientRect().height), wrapH: Math.round(w.height), rows, brand: getComputedStyle(brand).display !== "none", pct: Math.round(w.width * w.height / innerWidth / innerHeight * 100), zoom: +v.zoom.toFixed(3) }; });
  let m = await M();
  check(m.inside && m.belowCard, `${tag}: al cargar, el diagrama entero en el lienzo y bajo el rótulo de la Historia ${JSON.stringify(m)}`);
  check(m.rows === 1, `${tag}: cabecera de una fila (2 páginas) ${m.rows}`);
  if (vp.landscape) check(!m.brand && m.pct >= 65, `${tag}: apaisado sin «Hecho con Fluyo» y lienzo ${m.pct}% (≥ 65; antes 45)`);
  const small = await page.evaluate(SIZES, [["stPlay", "btnFit", "btnPresent", "btnOpen", "pgSelect"], !!vp.touch]);
  const brandA = await page.evaluate(() => { const a = document.querySelector("#brand a"), r = a.getBoundingClientRect(); return r.height ? Math.round(r.height) : null; });
  if (vp.touch && brandA !== null) small.push(...(brandA < 44 ? [["brand", brandA]] : []));
  check(small.length === 0, `${tag}: objetivos ≥ ${vp.touch ? 44 : 28} ${JSON.stringify(small)}`);
  const band0 = m.band, wrap0 = m.wrapH, seen = new Set();
  await press(t, "#stPlay", vp, 300);
  for (let i = 0; i < 18; i++) { const q = await M(); seen.add(q.band + "/" + q.wrapH); await page.waitForTimeout(150); }
  check(seen.size === 1 && [...seen][0] === band0 + "/" + wrap0, `${tag}: la banda y el lienzo no cambian de alto mientras se reproduce ${JSON.stringify([...seen])}`);
  await press(t, "#stPause", vp, 150);
  const a = await page.evaluate(() => [Math.round(story.playback.cursorVirtual), document.getElementById("stPause").textContent.trim()]);
  await page.waitForTimeout(600);
  const b = Math.round(await page.evaluate(() => story.playback.cursorVirtual));
  check(a[1] === "Reanudar" && a[0] === b, `${tag}: Pausar congela la Historia ${JSON.stringify([a, b])}`);
  await page.evaluate(() => storySeek(0)); await press(t, "#stNext", vp, 200); await press(t, "#stNext", vp, 200);
  const sk = await page.evaluate(() => [Math.round(story.playback.cursorVirtual), document.getElementById("stProgress").textContent]);
  check(sk[0] === 2500 && sk[1] === "3 / 4", `${tag}: saltar entre momentos ${JSON.stringify(sk)}`);
  const ov = await page.evaluate(() => { const c = document.getElementById("stNow").getBoundingClientRect(), w = document.getElementById("wrap").getBoundingClientRect(), v = window.__viewer.view, n = storyNav(), at = n.times[n.index]; return story.scenario.steps.filter((s) => s.at === at).some((s) => { let box; if (s.edgeId) { const p = edgePoints(edgeById(s.edgeId)); box = [Math.min(...p.map((q) => q.x)), Math.min(...p.map((q) => q.y)), Math.max(...p.map((q) => q.x)), Math.max(...p.map((q) => q.y))]; } else { const d = nodeById(s.nodeId); box = [d.x - d.w / 2, d.y - d.h / 2, d.x + d.w / 2, d.y + d.h / 2]; } const L = w.left + v.x + box[0] * v.zoom, T = w.top + v.y + box[1] * v.zoom, R = w.left + v.x + box[2] * v.zoom, B = w.top + v.y + box[3] * v.zoom; return R > c.left && L < c.right && B > c.top && T < c.bottom; }); });
  check(!ov, `${tag}: el rótulo no tapa el destino del momento`);
  await shot(t, vp, "viewer-pausa");
  await press(t, "#stPause", vp, 100); await press(t, "#stStop", vp, 200);
  check(await page.evaluate(() => window.__viewer.story) === "ready", `${tag}: Detener`);
  /* Presentar: la Historia también se reproduce y se pausa */
  await page.evaluate(() => document.getElementById("btnPresent").click()); await page.waitForTimeout(600);
  await press(t, "#stPlay", vp, 300);
  const pr = await page.evaluate(([touch]) => { const vis = (e) => e && e.getBoundingClientRect().height > 0 && !e.closest("[hidden]"); const btns = [...document.querySelectorAll("#prBar button")].filter(vis); return { story: window.__viewer.story, presenting: window.__viewer.presenting, small: btns.filter((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) < (touch ? 44 : 28) - 0.5).map((e) => e.id), exits: btns.filter((e) => /Salir/.test(e.textContent)).length }; }, [!!vp.touch]);
  check(pr.presenting && pr.story === "running" && pr.small.length === 0 && pr.exits === 1, `${tag}: Presentar reproduce la Historia; mando ≥ ${vp.touch ? 44 : 28}; una salida ${JSON.stringify(pr)}`);
  await shot(t, vp, "viewer-present");
  await press(t, "#prExit", vp, 500);
  if (vp.mobile) {
    await page.setViewportSize({ width: vp.height, height: vp.width }); await page.waitForTimeout(700);
    m = await M();
    check(m.inside, `${tag}: al girar, vuelve a encajar ${JSON.stringify(m)}`);
    await page.setViewportSize({ width: vp.width, height: vp.height }); await page.waitForTimeout(500);
  }
  check(errors.length === 0, `${tag}: 0 errores ${JSON.stringify(errors)}`);
  await ctx.close();
}

/* ═════════ páginas ═════════ */
async function pages(browser, base, vp) {
  const t = await open(browser, base, vp); const { page } = t;
  const tag = `${vp.key} páginas`;
  await load(page, MANY);
  const g = await page.evaluate(() => { const vis = (e) => e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== "none"; const bar = $("pagesBar"), br = bar.getBoundingClientRect(); const free = (e) => { const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2); return r.left >= br.left - 1 && r.right <= br.right + 1 && (e === top || e.contains(top)); }; const act = bar.querySelector(".tab.active"), sel = bar.querySelector(".pgSelect"), add = bar.querySelector(".pgAdd"); return { x: bar.querySelectorAll(".x").length, sel: vis(sel) ? [sel.textContent, Math.round(sel.getBoundingClientRect().height), free(sel)] : null, act: vis(act) ? free(act) : null, actName: vis(act) ? act.querySelector("span").textContent : null, add: vis(add) ? free(add) : null, more: vis(act && act.querySelector(".pgMore")), ox: document.documentElement.scrollWidth - innerWidth }; });
  check(g.x === 0, `${tag}: ninguna pestaña lleva ✕`);
  /* 018.19: el teléfono en apaisado usa la gramática del teléfono: también el selector de página (ahora en la cabecera) */
  const mobile = vp.mobile;
  if (mobile) check(g.sel && /^03Conciliación nocturna$/.test(g.sel[0]) && g.sel[1] >= 44 && g.sel[2], `${tag}: el selector dice qué página es («03 Conciliación nocturna») y es tocable ${JSON.stringify(g.sel)}`);
  else check(g.act === true && g.actName === "Conciliación nocturna" && g.add === true && g.more, `${tag}: la activa a la vista (no tapada), «＋» a la vista y ▾ ${JSON.stringify(g)}`);
  check(g.ox <= 0, `${tag}: sin desbordar la página`);
  await shot(t, vp, "paginas");
  /* cambiar, crear (dos toques), renombrar sin diálogo nativo y eliminar con su confirmación */
  if (mobile) {
    await press(t, "#pgSelect", vp, 300);
    const items = await page.evaluate(() => [...$("pageMenu").querySelectorAll(".pgItem")].map((b) => b.textContent));
    check(items.length === 6 && (await page.evaluate(() => $("pageMenu").querySelector(".pgItem.active").getAttribute("aria-current"))) === "page", `${tag}: la lista enseña las 6 páginas y marca la activa`);
    await press(t, "#pageMenu .pgItem >> nth=4", vp, 300);
    check((await page.evaluate(() => [doc.cur, $("pgSelect").textContent])).join() === "4,05Incidente Kafka", `${tag}: elegir en la lista cambia de página`);
    await press(t, "#pgSelect", vp, 300); await press(t, "#pageMenu .pgNew", vp, 300);
    check((await page.evaluate(() => [doc.pages.length, doc.cur])).join() === "7,6", `${tag}: «＋ Nueva página» crea y activa (dos toques)`);
    await press(t, "#pgSelect", vp, 300);
  } else {
    await press(t, "#pagesBar .tab >> nth=4", vp, 300);
    check((await page.evaluate(() => doc.cur)) === 4, `${tag}: tocar una pestaña cambia de página`);
    await press(t, "#pagesBar .pgAdd", vp, 300);
    check((await page.evaluate(() => [doc.pages.length, doc.cur])).join() === "7,6", `${tag}: «＋» crea y activa`);
    const vis = await page.evaluate(() => { const bar = $("pagesBar"), br = bar.getBoundingClientRect(), r = bar.querySelector(".tab.active").getBoundingClientRect(); return r.left >= br.left - 1 && r.right <= br.right - bar.querySelector(".pgAdd").offsetWidth + 2; });
    check(vis, `${tag}: la página nueva (activa) queda a la vista, no bajo el «＋»`);
    await press(t, "#pagesBar .tab.active .pgMore", vp, 300);
  }
  const dlg0 = t.dialogs.length;
  await press(t, "#pageMenu button:has-text('Renombrar…')", vp, 250);
  await page.locator("#pageNameIn").fill("Renombrada"); await press(t, "#pageNameSave", vp, 250);
  check((await page.evaluate(() => doc.pages[doc.cur].name)) === "Renombrada" && t.dialogs.length === dlg0, `${tag}: renombrar en línea, sin diálogos nativos`);
  if (!mobile) {
    const n0 = await page.evaluate(() => doc.pages.length);
    await page.locator("#pagesBar .tab.active").dblclick(); await page.waitForTimeout(250);
    check((await page.evaluate(() => !!document.getElementById("pageNameIn"))) && t.dialogs.length === dlg0, `${tag}: doble clic abre el renombrado en línea (sin prompt)`);
    await page.keyboard.press("Escape"); await page.evaluate(() => closePageMenu(false));
    check((await page.evaluate(() => doc.pages.length)) === n0, `${tag}: (sin cambios)`);
  }
  if (mobile) await press(t, "#pgSelect", vp, 300); else await press(t, "#pagesBar .tab.active .pgMore", vp, 300);
  const n1 = await page.evaluate(() => doc.pages.length);
  await press(t, "#pageMenu .scMenuDanger", vp, 400);
  const del = await page.evaluate(() => doc.pages.length);
  check(del === n1 - 1 && t.dialogs.length === dlg0 + 1 && /confirm/.test(t.dialogs[t.dialogs.length - 1]), `${tag}: «Eliminar página» pide confirmación y elimina ${JSON.stringify(t.dialogs.slice(-1))}`);
  await page.evaluate(() => undo()); await page.waitForTimeout(150);
  check((await page.evaluate(() => doc.pages.length)) === n1, `${tag}: Undo la recupera`);
  check(t.errors.length === 0, `${tag}: 0 errores ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ dirección (flowDir) ═════════ */
async function direction(browser, base, vp) {
  const t = await open(browser, base, vp); const { page } = t;
  const tag = `${vp.key} dirección`;
  await load(page, DOTS);
  const keys0 = await page.evaluate(() => JSON.stringify(Object.keys(serializeProject().doc.pages[0].edges[0]).sort()));
  await page.evaluate(() => { selE = new Set([P().edges[0].id]); refreshPanel(); if (isSheetLayout()) openSurface("properties"); }); await page.waitForTimeout(400);
  const sheet = await page.evaluate(() => isSheetLayout());
  if (sheet) await press(t, "#grpRoute > summary", vp, 300);   /* en la hoja todos los grupos empiezan plegados (decisión 136): un nivel; 018.23: el grupo Dirección */
  const r = await page.evaluate(() => { const seg = $("flowSeg"), panel = $("propPanel"), vis = (e) => e.checkVisibility({ contentVisibilityAuto: true }) && e.getBoundingClientRect().height > 0; const s = seg.getBoundingClientRect(), p = panel.getBoundingClientRect(); return { vis: vis(seg), group: seg.closest("details").dataset.group, firstScreen: s.bottom <= p.bottom, flowOpen: $("grpFlow").open, opts: [...seg.querySelectorAll("[data-flow]")].map((b) => b.textContent.trim() + "=" + b.dataset.flow), checked: seg.querySelector('[aria-checked="true"]').dataset.flow }; });
  check(r.vis && r.group === "Dirección" && !r.flowOpen, `${tag}: «Sentido de los puntos» en Dirección (018.23) sin abrir otros grupos ${JSON.stringify(r)}`);
  if (vp.key === "d1440") check(r.firstScreen, `${tag}: a 1440, en la primera pantalla del panel`);
  check(JSON.stringify(r.opts) === JSON.stringify(["Hacia el destino=normal", "Hacia el origen=reverse", "Ida y vuelta=alternate"]) && r.checked === "normal", `${tag}: tres opciones = los tres valores ${JSON.stringify(r.opts)}`);
  const u0 = await page.evaluate(() => undoStack.length);
  await press(t, '#flowSeg [data-flow="reverse"]', vp, 200);
  let st = await page.evaluate(() => [P().edges[0].flowDir, undoStack.length, $("flowSel").value, $("flowSeg").querySelector('[aria-checked="true"]').dataset.flow]);
  check(st[0] === "reverse" && st[1] === u0 + 1 && st[2] === "reverse" && st[3] === "reverse", `${tag}: «Hacia el origen» → flowDir «reverse», un Undo ${JSON.stringify(st)}`);
  await press(t, '#flowSeg [data-flow="alternate"]', vp, 200);
  check((await page.evaluate(() => P().edges[0].flowDir)) === "alternate", `${tag}: «Ida y vuelta» → «alternate»`);
  await page.evaluate(() => undo()); await page.waitForTimeout(150);
  check((await page.evaluate(() => P().edges[0].flowDir)) === "reverse", `${tag}: Undo devuelve «reverse»`);
  const saved = await page.evaluate(() => JSON.stringify(serializeProject()));
  const keys1 = await page.evaluate(() => JSON.stringify(Object.keys(serializeProject().doc.pages[0].edges[0]).sort()));
  await load(page, saved);
  check((await page.evaluate(() => P().edges[0].flowDir)) === "reverse" && keys0 === keys1, `${tag}: persiste al guardar y abrir; mismas claves en la conexión (formato igual)`);
  await page.evaluate(() => { selE = new Set([P().edges[0].id]); refreshPanel(); if (isSheetLayout()) openSurface("properties"); }); await page.waitForTimeout(300);
  if (sheet) { const open = await page.evaluate(() => $("grpRoute").open); if (!open) await press(t, "#grpRoute > summary", vp, 300); }
  await page.locator("#animChk").evaluate((e) => { e.checked = false; e.dispatchEvent(new Event("change")); }); await page.waitForTimeout(150);
  check(!(await page.evaluate(() => $("rowFlow").getBoundingClientRect().height > 0)) && (await page.evaluate(() => P().edges[0].flowDir)) === "reverse", `${tag}: sin puntos en movimiento «Sentido» no se ofrece (el dato se conserva)`);
  await shot(t, vp, "direccion");
  check(t.errors.length === 0, `${tag}: 0 errores ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ Service Worker v77 ═════════ */
async function serviceWorker(browser, base) {
  console.log("\nService Worker v77");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  await page.goto(base + "/"); await page.waitForFunction(() => typeof renderTabs === "function");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const keys = await page.evaluate(() => caches.keys());
  check(keys.length === 1 && keys[0] === "fluyo-static-v111", "caché instalada: fluyo-static-v111 " + JSON.stringify(keys));
  const clock = await page.evaluate(async (b) => !!(await (await caches.open("fluyo-static-v111")).match(b + "/js/story-clock.js")), base);
  check(clock, "story-clock.js en la caché");
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => typeof scTogglePause === "function" && typeof FluyoStoryClock === "object");
  check(await page.evaluate(() => !!document.getElementById("scPause") && !!document.getElementById("pgSelect")), "sin red: el transporte y el selector se sirven desde la caché");
  await ctx.close();
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    /* el enlace del Viewer se crea con el editor real (createShareUrl), como en 018.14/016 */
    let url = null;
    { const t = await open(browser, base, VIEWPORTS[0]); await load(t.page, FIXTURE); url = await t.page.evaluate((b) => createShareUrl(serializeProject(), b + "/s/", { kind: "story", scenarioId: scActiveScenario().id }), base); await t.ctx.close(); }
    for (const vp of VIEWPORTS) {
      if (ONLY && ONLY !== vp.key) continue;
      console.log(`\n${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", dedo" : ", ratón"})`);
      await editorStory(browser, base, vp);
      await present(browser, base, vp);
      await viewer(browser, base, vp, url);
      await pages(browser, base, vp);
      await direction(browser, base, vp);
    }
    if (!ONLY || ONLY === "sw") await serviceWorker(browser, base);
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.18 browser: ${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})();
