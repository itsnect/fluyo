"use strict";
/* FLUYO-018.19 — Chrome REAL: teléfono en apaisado, diálogo de evento táctil, crear → colocar, colocar con el dedo y reencaje al
   girar. Mide los criterios de .ai/tasks/FLUYO-018.19.md con números, no con «se ve bien».
   Casos (en cada viewport): 1 diálogo de evento · 2 controles táctiles · 3 crear → colocar · 4 cancelar (diálogo y colocación) ·
   5 Undo/Redo · 6 mover el lienzo durante la colocación (destino fuera de la vista) · 7 Historias en apaisado · 8 Propiedades en
   apaisado · 9 reproducción (franja en apaisado) · 10 Present · 11 páginas · 12 giro/reencaje. Más: layout (sin barra inferior,
   sin desbordamiento del documento, rail alcanzable) y 1440 con ratón como regresión (escritorio sin cambios).
   Viewports: 390×844, 375×812, 844×390, 812×375, 667×375 (dedo), 768×1024 (tableta, dedo) y 1440×900 (ratón).
   Uso: node test/fluyo-018-19-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=m390|m375|l844|l812|l667|t768|d1440|rot|sw   recorre solo esa parte (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-19-"));
fs.mkdirSync(shots, { recursive: true });
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8");
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

/* edit: % de lienzo sin selección (hoy en vertical 82/81, tableta 57; en apaisado 48/46 → ≥ 78) */
const VIEWPORTS = [
  { key: "m390", width: 390, height: 844, touch: true, mobile: true, edit: 80 },
  { key: "m375", width: 375, height: 812, touch: true, mobile: true, edit: 79 },
  { key: "l844", width: 844, height: 390, touch: true, mobile: true, land: true, edit: 78 },
  { key: "l812", width: 812, height: 375, touch: true, mobile: true, land: true, edit: 78 },
  { key: "l667", width: 667, height: 375, touch: true, mobile: true, land: true, edit: 76 },
  { key: "t768", width: 768, height: 1024, touch: true, edit: 55 },
  { key: "d1440", width: 1440, height: 900, edit: 60 },
];
const ONLY = process.env.ONLY || "";

async function open(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof scRun === "function" && typeof isSideSheet === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((fx) => { if (typeof scReset === "function") scReset(); applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); undoStack.length = 0; redoStack.length = 0; }, FIXTURE);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
const press = async (t, sel, vp, ms = 300) => { const l = t.page.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (vp.touch) await l.tap(); else await l.click(); await t.page.waitForTimeout(ms); };
const tapAt = async (t, vp, x, y, ms = 300) => { if (vp.touch) await t.page.touchscreen.tap(x, y); else await t.page.mouse.click(x, y); await t.page.waitForTimeout(ms); };
/* arrastre real con un dedo (Input.dispatchTouchEvent): pointerdown → pointermove × n → pointerup */
const drag = async (t, x, y, dx, dy) => {
  const cdp = await t.ctx.newCDPSession(t.page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * i / 10, y: y + dy * i / 10 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await t.page.waitForTimeout(250);
};
const shot = (t, vp, name) => t.page.screenshot({ path: path.join(shots, `${vp.key}-${name}.png`) });
const CANVAS = () => { let hit = 0, n = 0; const el = document.getElementById("cv"); for (let y = 4; y < innerHeight; y += 8) for (let x = 4; x < innerWidth; x += 8) { n++; const e = document.elementFromPoint(x, y); if (e === el || (e && e.closest && e.closest(".scNow"))) hit++; } return Math.round(hit / n * 100); };
const BOX = (sel) => { const e = document.querySelector(sel); if (!e || e.closest("[hidden]") || getComputedStyle(e).display === "none" || getComputedStyle(e).visibility === "hidden") return null; const r = e.getBoundingClientRect(); return r.width ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null; };
/* doc: el documento sin los contadores de ids (nextId, nextStepId, nextEventTypeId…), que por diseño nunca bajan con Undo
   (decisiones 104 y 107): Deshacer devuelve el CONTENIDO exacto, no el contador */
const SNAP = () => ({ ets: doc.eventTypes.length, steps: (scActiveScenario() || { steps: [] }).steps.length, undo: undoStack.length, redo: redoStack.length, placing: scPlacement ? (scPlacement.origin || scPlacement.kind) : null, cur: doc.cur, doc: JSON.stringify(serializeProject().doc, (k, v) => (/^next[A-Z]/.test(k) ? undefined : v)) });
/* un punto del lienzo, en la zona libre, sin elemento ni conexión debajo (coordenadas de la ventana) */
const EMPTY = () => { const r = visibleCanvasRect(), c = cv.getBoundingClientRect(); for (let y = r.top + 30; y < r.bottom - 30; y += 9) for (let x = r.left + 30; x < r.right - 30; x += 9) { const wx = (x - viewX) / viewZoom, wy = (y - viewY) / viewZoom; if (!hitNode(wx, wy) && !scEdgeCandidates(wx, wy).length) return [x + c.left, y + c.top]; } return null; };
/* punto medio en pantalla de una conexión y si está en la zona libre */
const EDGE_AT = (id) => { const e = edgeById(id), pts = edgePoints(e), c = cv.getBoundingClientRect(), r = visibleCanvasRect(); let best = null, L = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (d > L) { L = d; best = [(pts[i].x + pts[i - 1].x) / 2, (pts[i].y + pts[i - 1].y) / 2]; } } const x = best[0] * viewZoom + viewX, y = best[1] * viewZoom + viewY; return { x: x + c.left, y: y + c.top, inside: x > r.left + 10 && x < r.right - 10 && y > r.top + 10 && y < r.bottom - 10 }; };

/* ═════════ layout, Propiedades, Historias, reproducción, Present y páginas ═════════ */
async function layout(browser, base, vp) {
  const t = await open(browser, base, vp), { page } = t, tag = vp.key;
  const L = await page.evaluate(() => ({ side: isSideSheet(), sheet: isSheetLayout(), hdr: (() => { const h = document.querySelector("body > header"), kids = [...h.children].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== "none"); return { h: Math.round(h.getBoundingClientRect().height), right: Math.round(Math.max(...kids.map((e) => e.getBoundingClientRect().right))), rows: new Set(kids.filter((e) => e.getBoundingClientRect().height >= 20).map((e) => Math.round((e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2) / 12))).size }; })(), bottomBar: getComputedStyle(document.getElementById("bottomBar")).display !== "none", pagesInHeader: document.getElementById("pagesBar").parentElement.tagName === "HEADER", aside: (() => { const a = document.querySelector("aside"), r = a.getBoundingClientRect(); return r.width > 0 && r.left < innerWidth && getComputedStyle(a).visibility !== "hidden"; })(), ov: document.scrollingElement.scrollHeight - innerHeight, ox: document.scrollingElement.scrollWidth - innerWidth }));
  const pct = await page.evaluate(CANVAS);
  await shot(t, vp, "1-editar");
  if (vp.land) {
    check(L.side && L.sheet, `${tag}: apaisado táctil → gramática del teléfono con hojas laterales (no la de tableta)`);
    check(!L.bottomBar && L.pagesInHeader, `${tag}: sin barra inferior; el selector de página está en la cabecera`);
    check(L.hdr.h <= 52 && L.hdr.rows === 1 && L.hdr.right <= vp.width, `${tag}: cabecera de una fila ≤ 52 px que cabe (${JSON.stringify(L.hdr)})`);
    check(!L.aside, `${tag}: sin selección no hay panel a la vista (antes, columna de 216 px)`);
    /* el rail: desplazable, la última herramienta alcanzable, y el foco no mueve la app (antes subía 197 px) */
    await page.evaluate(() => { document.getElementById("btnAnims").focus(); });
    const R = await page.evaluate(() => { const r = document.querySelector(".rail"), b = document.getElementById("btnAnims").getBoundingClientRect(); return { scrollY: document.scrollingElement.scrollTop, headerTop: Math.round(document.querySelector("body > header").getBoundingClientRect().top), scrolls: r.scrollHeight > r.clientHeight, lastIn: b.top >= r.getBoundingClientRect().top - 1 && b.bottom <= Math.min(innerHeight, r.getBoundingClientRect().bottom) + 1, ov: document.scrollingElement.scrollHeight - innerHeight }; });
    check(R.scrollY === 0 && R.headerTop === 0 && R.ov === 0, `${tag}: el documento no desborda ni se desplaza al enfocar el rail ${JSON.stringify(R)}`);
    check(R.lastIn, `${tag}: la última herramienta del rail se alcanza (el rail se desplaza)`);
    const railTap = await page.evaluate(() => { const b = document.getElementById("btnAnims").getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await tapAt(t, vp, railTap[0], railTap[1], 300);
    check(await page.evaluate(() => getComputedStyle(document.getElementById("animDrawer")).display !== "none"), `${tag}: GIFs (la última del rail) se abre con el dedo`);
    await page.evaluate(() => { document.getElementById("animDrawer").style.display = "none"; syncRail(); document.querySelector(".rail").scrollTop = 0; });
  } else {
    check(!L.side, `${tag}: no es apaisado de teléfono (layout de siempre)`);
    check(L.bottomBar || vp.key === "d1440", `${tag}: barra inferior como siempre`);
    check(L.ov === 0 && L.ox === 0, `${tag}: sin desbordamiento del documento`);
  }
  check(pct >= vp.edit, `${tag}: lienzo editando sin selección ${pct} % ≥ ${vp.edit} %`);
  if (vp.key === "d1440") check(L.aside, "d1440: escritorio: la columna de Propiedades sigue visible sin selección (sin cambios)");

  /* 8 · Propiedades (en apaisado: hoja lateral derecha solo cuando se pide) */
  if (vp.touch) {
    const n = await page.evaluate(() => { const c = cv.getBoundingClientRect(), nd = P().nodes[0]; return [c.left + viewX + nd.x * viewZoom, c.top + viewY + nd.y * viewZoom]; });
    await tapAt(t, vp, n[0], n[1], 400);
    if (L.sheet) await press(t, "#btnPanel", vp, 500);
    const P8 = await page.evaluate(() => { const a = document.querySelector("aside").getBoundingClientRect(), v = visibleCanvasRect(), c = cv.getBoundingClientRect(), nd = P().nodes.find((x) => selN.has(x.id)), tb = document.getElementById("touchBar").getBoundingClientRect(); const l = nd.x - nd.w / 2, tp = nd.y - nd.h / 2; const sel = [c.left + viewX + l * viewZoom, c.top + viewY + tp * viewZoom, nd.w * viewZoom, nd.h * viewZoom]; const inZone = l * viewZoom + viewX >= v.left - 1 && tp * viewZoom + viewY >= v.top - 1 && (l + nd.w) * viewZoom + viewX <= v.right + 1 && (tp + nd.h) * viewZoom + viewY <= v.bottom + 1; return { aside: [Math.round(a.left), Math.round(a.top), Math.round(a.width), Math.round(a.height)], open: document.body.classList.contains("panelOpen"), inZone, selCovered: sel[0] + sel[2] > a.left && sel[0] < a.right && sel[1] + sel[3] > a.top && sel[1] < a.bottom, tbOverAside: tb.width > 0 && tb.right > a.left + 1 && tb.left < a.right, hdrBottom: Math.round(document.querySelector("body > header").getBoundingClientRect().bottom) }; });
    await shot(t, vp, "2-propiedades");
    if (vp.land) {
      check(P8.open && P8.aside[0] >= vp.width - 330 && P8.aside[2] <= 330 && Math.abs(P8.aside[1] - P8.hdrBottom) <= 2 && P8.aside[1] + P8.aside[3] >= vp.height - 1, `${tag}: Propiedades = hoja lateral derecha bajo la cabecera ${JSON.stringify(P8.aside)}`);
      check(!P8.selCovered && P8.inZone, `${tag}: la hoja no tapa la selección (entera en la zona libre)`);
      check(!P8.tbOverAside, `${tag}: la barra táctil no se monta sobre la hoja`);
      const pp = await page.evaluate(CANVAS);
      check(pp >= 30, `${tag}: lienzo con Propiedades abiertas ${pp} % ≥ 30 % (antes 43/40 % con 4,5 pantallas de scroll en 216 px)`);
      const scr = await page.evaluate(() => { const a = document.querySelector("aside"); for (const d of a.querySelectorAll("details.pgroup")) d.open = false; const s = [a, ...a.querySelectorAll("*")].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1) || a; return +(s.scrollHeight / s.clientHeight).toFixed(2); });
      check(scr <= 1.4, `${tag}: Propiedades plegadas en ${scr} pantallas (≤ 1,4; antes 4,5)`);
    }
    if (L.sheet) { await press(t, "#btnPanelClose", vp, 400); check(!(await page.evaluate(() => document.body.classList.contains("panelOpen"))), `${tag}: ✕ cierra Propiedades`); }
    await page.evaluate(() => { clearSel(); refreshPanel(); });
  }

  /* 7 · Historias */
  await press(t, L.sheet ? "#btnStories" : "#tabScenarios", vp, 500);
  const H = await page.evaluate(() => { const a = document.querySelector("aside").getBoundingClientRect(), sb = document.querySelector(".scStoryboardSection").getBoundingClientRect(), ex = document.getElementById("btnStoryExit").getBoundingClientRect(); const rows = [...document.querySelectorAll(".scStoryRow")].filter((x) => { const q = x.getBoundingClientRect(); return q.height > 0 && q.top >= sb.top - 1 && q.bottom <= sb.bottom + 1; }).length; return { aside: [Math.round(a.left), Math.round(a.top), Math.round(a.width), Math.round(a.height)], board: Math.round(sb.height), rows, exit: ex.width > 0 && ex.top >= 0 && ex.bottom <= innerHeight, asideScroll: document.querySelector("aside").scrollTop, state: storyState(), cut: (() => { const v = visibleCanvasRect(), b = getBounds(); return viewZoom >= 0.599 && (viewX + b.x * viewZoom < v.left - 1 || viewX + (b.x + b.w) * viewZoom > v.right + 1) ? "suelo" : (viewX + b.x * viewZoom >= v.left - 1 && viewX + (b.x + b.w) * viewZoom <= v.right + 1 ? "dentro" : "cortado"); })() }; });
  await shot(t, vp, "3-historias");
  if (vp.land) {
    const hp = await page.evaluate(CANVAS);
    check(H.aside[0] >= vp.width - 330 && H.aside[2] <= 330, `${tag}: Historias = hoja lateral derecha ${JSON.stringify(H.aside)}`);
    check(H.board >= 130 && H.rows >= 1, `${tag}: línea de tiempo ${H.board} px con ${H.rows} paso(s) enteros (antes 79 px, 0 pasos)`);
    check(H.exit && H.asideScroll === 0, `${tag}: «Volver a editar» a la vista; la hoja no se desplaza (un solo desplazable)`);
    check(hp >= 42, `${tag}: lienzo en Historias ${hp} % ≥ 42 % (antes 45/43 % sin línea de tiempo útil)`);
    check(H.cut !== "cortado", `${tag}: el diagrama se ve en la zona libre (o el suelo de zoom 0,6 decide) [${H.cut}]`);
  } else check(H.exit, `${tag}: «Volver a editar» a la vista en Historias`);

  /* 9 · reproducción */
  await press(t, "#scRun", vp, 700);
  const S9 = await page.evaluate(() => ({ status: scStatus, story: storyState(), aside: (() => { const r = document.querySelector("aside").getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })(), now: !document.getElementById("scNow").hidden }));
  const p9 = await page.evaluate(CANVAS);
  await shot(t, vp, "4-reproduciendo");
  check(S9.status === "running" && S9.now, `${tag}: Reproducir → reproduciendo, con el momento sobre el lienzo`);
  if (vp.land) {
    check(S9.aside[0] === 0 && S9.aside[2] >= vp.width - 1 && S9.aside[3] <= 72 && S9.aside[1] + S9.aside[3] >= vp.height - 1, `${tag}: reproduciendo, la hoja es una franja inferior de una fila ${JSON.stringify(S9.aside)}`);
    check(p9 >= 66, `${tag}: lienzo reproduciendo ${p9} % ≥ 66 % (antes 45/43 %)`);
    const small = await page.evaluate(() => ["scPrev", "scPause", "scNext", "scReset", "btnStoryExpand", "btnStoryExit"].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w > 0 && Math.min(w, h) < 44));
    check(small.length === 0, `${tag}: transporte de la franja a 44 px ${JSON.stringify(small)}`);
    await press(t, "#scPause", vp, 300);
    check(await page.evaluate(() => scIsPaused()), `${tag}: Pausar en la franja (mismo mando de 018.18)`);
    /* el rótulo del momento no tapa nunca el destino del momento (el lienzo es bajo: se pone a un lado) */
    const over = [];
    for (let i = 0; i < 4; i++) {
      await page.evaluate((i) => scSeekMoment(i), i); await page.waitForTimeout(150);
      over.push(await page.evaluate(() => { const c = document.getElementById("scNow").getBoundingClientRect(), cr = cv.getBoundingClientRect(); return scMomentRects().some((r) => r.right > c.left - cr.left && r.left < c.right - cr.left && r.bottom > c.top - cr.top && r.top < c.bottom - cr.top); }));
    }
    check(over.every((o) => !o), `${tag}: el rótulo del momento no tapa el destino en ningún momento ${JSON.stringify(over)}`);
    await press(t, "#btnStoryExpand", vp, 500);
    const X = await page.evaluate(() => { const a = document.querySelector("aside").getBoundingClientRect(), sb = document.querySelector(".scStoryboardSection").getBoundingClientRect(), act = document.querySelector(".scStoryRow.scStatus_active") || document.querySelector(".scStoryRow"); const q = act.getBoundingClientRect(); return { side: a.left >= innerWidth - 330 && a.width <= 330, rowIn: q.top >= sb.top - 1 && q.bottom <= sb.bottom + 1 }; });
    check(X.side && X.rowIn, `${tag}: «Ampliar» abre la línea de tiempo en la hoja lateral con la fila del momento a la vista`);
    await shot(t, vp, "5-reproduciendo-linea");
    await press(t, "#btnStoryExpand", vp, 400);
  }
  await press(t, "#scReset", vp, 400);
  check(await page.evaluate(() => scStatus === "idle"), `${tag}: Detener vuelve a lista`);
  await press(t, "#btnStoryExit", vp, 400);

  /* 10 · Present */
  await press(t, "#btnPresent", vp, 800);
  const P10 = await page.evaluate(() => ({ presenting, rows: new Set([...document.querySelectorAll("#presentBar button")].filter((b) => b.getBoundingClientRect().width > 0 && getComputedStyle(b).display !== "none").map((b) => Math.round(b.getBoundingClientRect().top / 10))).size }));
  const p10 = await page.evaluate(CANVAS);
  await shot(t, vp, "6-present");
  check(P10.presenting && p10 >= (vp.land ? 88 : 85), `${tag}: Present accesible desde ${vp.land ? "la cabecera" : "su sitio"}; lienzo ${p10} %`);
  if (vp.land) check(P10.rows === 1, `${tag}: mando de Present en una fila`);
  if (await page.locator("#psPlay").isVisible()) {
    await press(t, "#psPlay", vp, 600);
    const before = await page.evaluate(() => [doc.cur, presentPhase()]);
    if (vp.touch) { const c = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await tapAt(t, vp, c[0], c[1], 300); }
    const after = await page.evaluate(() => [doc.cur, presentPhase()]);
    check(before[1] === "playing" && JSON.stringify(before) === JSON.stringify(after), `${tag}: Present reproduce y un toque no navega (contrato de 018.18) ${JSON.stringify([before, after])}`);
  }
  await press(t, "#prExit", vp, 500);
  const back = await page.evaluate(() => ({ presenting, hdr: Math.round(document.querySelector("body > header").getBoundingClientRect().height), bb: getComputedStyle(document.getElementById("bottomBar")).display }));
  check(!back.presenting && back.hdr > 0 && (vp.land ? back.bb === "none" : back.bb !== "none"), `${tag}: salir de Present devuelve la composición ${JSON.stringify(back)}`);

  /* 11 · páginas */
  if (L.sheet) {
    await press(t, "#pgSelect", vp, 400);
    const M = await page.evaluate(() => { const m = document.getElementById("pageMenu"), r = m.getBoundingClientRect(), s = document.getElementById("pgSelect").getBoundingClientRect(); return { open: !m.hidden, inView: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, coversSelector: r.top < s.bottom - 1 && r.bottom > s.top + 1 && r.left < s.right && r.right > s.left }; });
    check(M.open && M.inView && !M.coversSelector, `${tag}: la lista de páginas se abre entera y sin tapar el selector ${JSON.stringify(M)}`);
    await press(t, "#pageMenu .pgItem >> nth=1", vp, 400);
    check(await page.evaluate(() => doc.cur) === 1, `${tag}: elegir la página 2 cambia de página`);
    await press(t, "#pgSelect", vp, 400); await press(t, "#pageMenu .pgItem >> nth=0", vp, 400);
    check(await page.evaluate(() => doc.cur) === 0, `${tag}: y vuelve a la 1`);
  } else {
    await press(t, "#pagesBar .tab >> nth=1", vp, 400);
    check(await page.evaluate(() => doc.cur) === 1, `${tag}: pestaña 2 cambia de página`);
    await press(t, "#pagesBar .tab >> nth=0", vp, 400);
  }
  check(t.errors.length === 0, `${tag}: 0 errores de consola ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ 1–6 · diálogo de evento, crear → colocar, cancelar, mover el lienzo, Undo ═════════ */
async function events(browser, base, vp) {
  const t = await open(browser, base, vp), { page } = t, tag = vp.key;
  const sheet = await page.evaluate(() => isSheetLayout()), side = await page.evaluate(() => isSideSheet());
  await press(t, sheet ? "#btnStories" : "#tabScenarios", vp, 500);
  if (sheet && !side) await press(t, "#btnStoryExpand", vp, 400);
  const s0 = await page.evaluate(SNAP);
  /* «+ Crear evento» vive en el taller: en la hoja vertical, ampliada */
  const newEvent = async () => { if (sheet && !side && !(await page.evaluate(() => document.body.classList.contains("storyExpanded")))) await press(t, "#btnStoryExpand", vp, 300); await press(t, "#scEventNew", vp, 450); };
  await press(t, "#scEventNew", vp, 500);
  /* 1 · diálogo */
  const D = await page.evaluate((touch) => {
    const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[hidden]") && !e.closest("details:not([open]) > :not(summary)"); };
    const dlg = document.getElementById("scEventDialog"), body = dlg.querySelector(".scDialogBody"), r = dlg.getBoundingClientRect();
    const hit = (e) => { const q = e.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; };
    const ctl = [...dlg.querySelectorAll("button, input:not([type=radio]):not([type=checkbox]):not([type=color]), .scSegmented label, .scEffectChip, summary, .scChoice")].filter(vis);
    const min = touch ? 40 : 28;
    const small = ctl.filter((e) => Math.min(...hit(e)) < min - 0.5).map((e) => (e.id || e.className.toString().split(" ")[0] || e.tagName) + "«" + e.textContent.trim().slice(0, 12) + "»:" + hit(e).join("x"));
    const crit = ["scEventClose", "scEventCancel", "scEventSave"].map((id) => [id, ...hit(document.getElementById(id))]).filter(([, w, h]) => Math.min(w, h) < (touch ? 44 : 28) - 0.5);
    const segs = [...dlg.querySelectorAll(".scSegmented label")].filter(vis).filter((e) => e.getBoundingClientRect().height < (touch ? 44 : 28) - 0.5).length;
    const name = document.getElementById("scEventName").getBoundingClientRect();
    return { open: dlg.open, full: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, w: Math.round(r.width), screens: +(body.scrollHeight / body.clientHeight).toFixed(2), nameTop: Math.round(name.top), nameBottom: Math.round(name.bottom), nameFs: parseFloat(getComputedStyle(document.getElementById("scEventName")).fontSize), small, crit, segs, flowLookOpen: document.getElementById("scFlowLook").open, order: ["scEventName", "scWhere", "scPhrase", "scVisualPicker", "scFlowLook"].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top)), subtitle: !document.getElementById("scEventDialogSubtitle").hidden };
  }, !!vp.touch);
  await shot(t, vp, "7-dialogo");
  check(D.open, `${tag}: «+ Crear evento» abre el diálogo`);
  /* en apaisado Nombre y «¿Dónde ocurre?» comparten la primera fila (misma franja); el resto va después, en orden */
  const order = vp.land ? [Math.min(D.order[0], D.order[1]), ...D.order.slice(2)] : D.order;
  check(order.every((y, i, a) => i === 0 || y > a[i - 1]) && (!vp.land || Math.abs(D.order[0] - D.order[1]) <= 40), `${tag}: primero Nombre · Dónde · Frase · Símbolo, después «Cómo se ve» ${JSON.stringify(D.order)}`);
  check(!D.flowLookOpen && !D.subtitle, `${tag}: «Cómo se ve» plegado al crear; sin subtítulo en la cabecera`);
  check(D.crit.length === 0, `${tag}: ✕ · Cancelar · Crear evento ≥ ${vp.touch ? 44 : 28} px ${JSON.stringify(D.crit)}`);
  check(D.small.length === 0, `${tag}: ningún control del diálogo < ${vp.touch ? 40 : 28} px ${JSON.stringify(D.small)}`);
  if (vp.touch) check(D.segs === 0 && D.nameFs >= 16, `${tag}: opciones de los segmentados a 44 px y el nombre a ${D.nameFs} px`);
  if (vp.mobile && !vp.land) check(D.full && D.nameTop < vp.height / 3 && D.screens <= 1.0, `${tag}: pantalla completa, Nombre en el primer tercio (y=${D.nameTop}) y sin scroll (${D.screens} pantallas; antes 1,31/1,43)`);
  if (vp.land) check(D.nameBottom <= vp.height && D.screens <= 1.8, `${tag}: apaisado: Nombre a la vista sin desplazar y ${D.screens} pantallas (antes 3,1/3,3)`);
  if (!vp.mobile) check(!D.full && D.w <= 600, `${tag}: modal (no pantalla completa) de ${D.w} px`);
  /* «Cómo se ve» abre la apariencia con su vista previa */
  await press(t, "#scFlowLook > summary", vp, 300);
  const pv = await page.evaluate(() => { const c = document.querySelector("#scFlowLook .scPreviewCanvas"); return !!c && c.getBoundingClientRect().height > 0; });
  check(pv, `${tag}: «Cómo se ve» contiene la vista previa animada`);
  await press(t, "#scFlowLook > summary", vp, 200);

  /* 4 · cancelar el diálogo: Cancelar, ✕ y Escape no dejan rastro */
  await press(t, "#scEventName", vp, 150); await page.keyboard.type("Temporal");
  await press(t, "#scEventCancel", vp, 300);
  await newEvent(); await press(t, "#scEventClose", vp, 300);
  await newEvent(); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const s1 = await page.evaluate(SNAP);
  check(s1.ets === s0.ets && s1.steps === s0.steps && s1.undo === s0.undo && s1.doc === s0.doc && !(await page.evaluate(() => document.getElementById("scEventDialog").open)), `${tag}: Cancelar, ✕ y Escape no crean nada (eventos, Steps, Undo, documento)`);

  /* 3 · crear → colocar */
  await newEvent();
  await press(t, "#scEventName", vp, 150); await page.keyboard.type("Aviso");
  await press(t, "#scEventSave", vp, 500);
  const s2 = await page.evaluate(SNAP);
  const C = await page.evaluate(() => { const b = document.getElementById("scPlacementBar"), n = document.getElementById("scNotice"), br = b.getBoundingClientRect(), nr = n.getBoundingClientRect(); const a = document.querySelector("aside"); return { id: scPlacement && scPlacement.eventTypeId, newId: doc.eventTypes[doc.eventTypes.length - 1].id, text: document.getElementById("scPlacementText").textContent, notice: !n.hidden && nr.height > 0 ? n.textContent : null, overlap: !n.hidden && nr.height > 0 && nr.bottom > br.top && nr.top < br.bottom && nr.right > br.left && nr.left < br.right, sheetAway: !isSheetLayout() || getComputedStyle(a).visibility === "hidden", cancel: (() => { const c = document.getElementById("scPlacementCancel").getBoundingClientRect(); return [Math.round(c.width), Math.round(c.height)]; })() }; });
  await shot(t, vp, "8-colocando");
  check(s2.ets === s0.ets + 1 && s2.steps === s0.steps && s2.undo === s0.undo + 1, `${tag}: Crear añade UN evento (un Undo) y ningún Step todavía`);
  check(s2.placing === "created" && C.id === C.newId, `${tag}: tras Crear se está colocando ESE evento, sin tocar su ficha`);
  check(/Aviso creado\./.test(C.text) && !/Arrástralo/.test(C.text + (C.notice || "")), `${tag}: la barra dice qué falta («${C.text.replace(/\n/g, " / ")}»)`);
  check(!C.overlap && C.sheetAway, `${tag}: el aviso no tapa la barra de colocación y la hoja se aparta`);
  if (vp.touch) check(Math.min(...C.cancel) >= 44, `${tag}: Cancelar de la colocación ${C.cancel.join("×")} ≥ 44`);
  const evId = C.newId;

  if (vp.touch) {
    /* 6 · tocar el vacío no cancela; arrastrar desplaza y no coloca */
    const e0 = await page.evaluate(EMPTY);
    await tapAt(t, vp, e0[0], e0[1], 300);
    let s = await page.evaluate(SNAP);
    check(s.placing === "created" && s.steps === s0.steps, `${tag}: tocar el vacío NO cancela la colocación (D13)`);
    /* el destino: una conexión que se lleva FUERA de la zona libre; hay que desplazar para alcanzarla */
    const target = await page.evaluate(() => P().edges[0].id);
    /* se lleva su punto medio 150 px a la DERECHA de la zona libre: fuera de la vista */
    await page.evaluate((id) => { const e = edgeById(id), pts = edgePoints(e), v = visibleCanvasRect(); let best = null, L = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (d > L) { L = d; best = (pts[i].x + pts[i - 1].x) / 2; } } viewX = v.right + 150 - best * viewZoom; }, target);
    await page.waitForTimeout(150);
    const off = await page.evaluate(`(${EDGE_AT.toString()})(${target})`);
    check(!off.inside, `${tag}: el destino empieza fuera de la vista`);
    const v0 = await page.evaluate(() => viewX);
    const e1 = await page.evaluate(EMPTY) || [vp.width * 0.8, vp.height / 2];
    const free = await page.evaluate(() => { const v = visibleCanvasRect(), c = cv.getBoundingClientRect(); return c.left + v.left + v.width / 2; });
    const dx = -Math.round(off.x - free);                                  // hacia la izquierda: trae el destino al centro
    const sx = Math.round(Math.min(vp.width - 20, Math.max(e1[0], 40 - dx)));
    await drag(t, sx, Math.round(e1[1]), dx, 0);
    s = await page.evaluate(SNAP);
    const v1 = await page.evaluate(() => viewX);
    check(Math.abs(v1 - v0 - dx) <= 12 && s.placing === "created" && s.steps === s0.steps, `${tag}: arrastrar con el dedo desplaza el lienzo (${Math.round(v1 - v0)} px de ${dx}) sin cancelar ni colocar`);
    let on = await page.evaluate(`(${EDGE_AT.toString()})(${target})`);
    check(on.inside, `${tag}: desplazando, el destino entra en la zona libre`);
    await tapAt(t, vp, on.x, on.y, 500);
    const s3 = await page.evaluate(SNAP);
    const st = await page.evaluate(() => { const sc = scActiveScenario(), last = sc.steps.reduce((m, s) => (s.at >= m.at ? s : m), sc.steps[0]); return { last: [last.eventTypeId, last.edgeId], row: (() => { const r = document.querySelector('.scStoryRow[data-step-id="' + scSelectedStep + '"]'); if (!r) return false; const q = r.getBoundingClientRect(), box = r.closest(".scStoryboardSection").getBoundingClientRect(); return q.height > 0 && q.top >= box.top - 1 && q.bottom <= box.bottom + 1 && q.bottom <= innerHeight; })() }; });
    check(s3.steps === s0.steps + 1 && s3.placing === null && s3.undo === s0.undo + 2, `${tag}: tocar la conexión coloca el evento (un Step, su propio Undo)`);
    check(st.last[0] === evId && st.last[1] === target, `${tag}: Historia: el Step nuevo es el último, de ese evento y en esa conexión`);
    check(st.row, `${tag}: Historia: su fila se ve en la línea de tiempo`);
    await shot(t, vp, "9-colocado");
  } else {
    /* ratón: sin cambios (clic en el destino coloca; clic en el vacío cancela) */
    const on = await page.evaluate(`(${EDGE_AT.toString()})(${await page.evaluate(() => P().edges[0].id)})`);
    await tapAt(t, vp, on.x, on.y, 400);
    const s3 = await page.evaluate(SNAP);
    check(s3.steps === s0.steps + 1 && s3.placing === null, `${tag}: con ratón, un clic en la conexión coloca el evento creado`);
  }
  const placed = await page.evaluate(SNAP);
  /* el Step nuevo se reproduce: último momento con el nombre del evento */
  const cap = await page.evaluate(() => { scRun(); const n = FluyoStoryClock.momentTimes(scActiveScenario()); scSeekMoment(n.length - 1); const c = document.getElementById("scNowCaption").textContent; scReset(); return c; });
  check(/Aviso/.test(cap), `${tag}: Historia: reproducir llega al evento nuevo («${cap}»)`);

  /* 5 · Undo / Redo con los botones */
  await press(t, "#btnUndo", vp, 300);
  const u1 = await page.evaluate(SNAP);
  await press(t, "#btnUndo", vp, 300);
  const u2 = await page.evaluate(SNAP);
  check(u1.steps === s0.steps && u1.ets === s0.ets + 1, `${tag}: Deshacer quita el Step (el evento sigue en la biblioteca)`);
  check(u2.ets === s0.ets && u2.doc === s0.doc, `${tag}: Deshacer otra vez quita el evento: documento como al principio`);
  await press(t, "#btnRedo", vp, 300); await press(t, "#btnRedo", vp, 300);
  const r2 = await page.evaluate(SNAP);
  check(r2.doc === placed.doc, `${tag}: Rehacer ×2 devuelve el evento y su Step tal cual`);

  /* 4 · cancelar la colocación: el evento se queda y se puede volver a colocar (D10) */
  await newEvent();
  await press(t, "#scEventName", vp, 150); await page.keyboard.type("Sin colocar");
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);      // Intro en el nombre = Crear
  const k = await page.evaluate(SNAP);
  check(k.placing === "created" && k.ets === r2.ets + 1, `${tag}: Intro en el Nombre crea y entra en colocación`);
  await press(t, "#scPlacementCancel", vp, 400);
  const c1 = await page.evaluate(SNAP);
  check(c1.placing === null && c1.ets === r2.ets + 1 && c1.steps === r2.steps, `${tag}: Cancelar la colocación: el evento queda en la biblioteca y la Historia no cambia`);
  if (sheet && !side && !(await page.evaluate(() => document.body.classList.contains("storyExpanded")))) await press(t, "#btnStoryExpand", vp, 300);
  await press(t, '#scEventLibrary .scEventRow:has-text("Sin colocar") .scEventPlace', vp, 400);
  const again = await page.evaluate(() => scPlacement && eventTypeById(scPlacement.eventTypeId).name);
  check(again === "Sin colocar", `${tag}: y se puede volver a colocar desde su ficha`);
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  check(await page.evaluate(() => scPlacement === null), `${tag}: Escape cancela la colocación`);
  /* editar un evento no entra en colocación */
  await page.evaluate(() => scOpenEventDialog(doc.eventTypes[0].id)); await page.waitForTimeout(300);
  await press(t, "#scEventSave", vp, 400);
  check(await page.evaluate(() => scPlacement === null), `${tag}: «Guardar cambios» de un evento existente no coloca`);
  /* páginas: cambiar de página durante la colocación la cancela */
  if (side) {
    await press(t, '#scEventLibrary .scEventRow:has-text("Sin colocar") .scEventPlace', vp, 400);
    await press(t, "#pgSelect", vp, 300); await press(t, "#pageMenu .pgItem >> nth=1", vp, 400);
    check(await page.evaluate(() => scPlacement === null && doc.cur === 1), `${tag}: cambiar de página (desde la cabecera) cancela la colocación`);
  }
  check(t.errors.length === 0, `${tag}: 0 errores de consola ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ 12 · giro: 390×844 ↔ 844×390 ═════════ */
async function rotation(browser, base) {
  const vp = VIEWPORTS[0], t = await open(browser, base, vp), { page } = t, tag = "giro";
  const st = () => page.evaluate(() => { const b = getBounds(), r = cv.getBoundingClientRect(), v = visibleCanvasRect(); return { side: isSideSheet(), zoom: +viewZoom.toFixed(3), inside: viewX + b.x * viewZoom >= -1 && viewY + b.y * viewZoom >= -1 && viewX + (b.x + b.w) * viewZoom <= r.width + 1 && viewY + (b.y + b.h) * viewZoom <= r.height + 1, insideFree: viewX + b.x * viewZoom >= v.left - 1 && viewY + b.y * viewZoom >= v.top - 1 && viewX + (b.x + b.w) * viewZoom <= v.right + 1 && viewY + (b.y + b.h) * viewZoom <= v.bottom + 1, sel: [...selN], doc: JSON.stringify(serializeProject().doc), undo: undoStack.length }; });
  const rot = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(700); };
  const a = await st();
  check(a.inside, `${tag}: en vertical el diagrama se ve entero`);
  await rot(844, 390); const b = await st();
  await shot(t, { key: "giro" }, "1-apaisado");
  check(b.side && b.inside && b.zoom !== a.zoom, `${tag}: vertical → apaisado: reencaja (zoom ${a.zoom} → ${b.zoom}) y se ve entero`);
  await rot(390, 844); const c = await st();
  check(!c.side && c.inside, `${tag}: apaisado → vertical: reencaja otra vez (zoom ${c.zoom})`);
  /* acercado por el usuario: se conserva el zoom y el punto que miraba sigue en el centro; la selección se queda */
  await page.evaluate(() => { const n = P().nodes[1]; selectOnly("node", n.id); viewZoom = 1.6; const r = cv.getBoundingClientRect(); viewX = r.width / 2 - n.x * viewZoom; viewY = r.height / 2 - n.y * viewZoom; });
  await page.waitForTimeout(200);
  await rot(844, 390);
  const d = await page.evaluate(() => { const n = P().nodes[1], r = cv.getBoundingClientRect(); return { zoom: +viewZoom.toFixed(3), dx: Math.round(n.x * viewZoom + viewX - r.width / 2), dy: Math.round(n.y * viewZoom + viewY - r.height / 2), sel: [...selN] }; });
  check(d.zoom === 1.6 && Math.abs(d.dx) <= 2 && Math.abs(d.dy) <= 2 && d.sel.length === 1, `${tag}: acercado: zoom intacto (${d.zoom}), el punto mirado sigue en el centro (${d.dx}, ${d.dy}) y la selección se conserva`);
  await rot(390, 844);
  await page.evaluate(() => { clearSel(); refreshPanel(); fitView(); });
  /* en Historias: girar con la hoja abierta enseña la página en la zona libre */
  await press(t, "#btnStories", vp, 500);
  await rot(844, 390); const e = await st();
  await shot(t, { key: "giro" }, "2-apaisado-historias");
  check(e.side && (e.insideFree || e.zoom >= 0.6), `${tag}: en Historias, al girar la página queda en la zona libre (zoom ${e.zoom})`);
  check(e.doc === a.doc && e.undo === a.undo, `${tag}: girar no toca el documento ni Undo`);
  check(t.errors.length === 0, `${tag}: 0 errores de consola ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ Service Worker v78 ═════════ */
async function serviceWorker(browser, base) {
  console.log("\nService Worker v78");
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  await page.goto(base + "/"); await page.waitForFunction(() => typeof renderTabs === "function");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const keys = await page.evaluate(() => caches.keys());
  check(keys.length === 1 && keys[0] === "fluyo-static-v106", "caché instalada: fluyo-static-v106 " + JSON.stringify(keys));
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => typeof isSideSheet === "function");
  check(await page.evaluate(() => isSideSheet() && document.getElementById("pagesBar").parentElement.tagName === "HEADER"), "sin red: el apaisado nuevo se sirve desde la caché");
  await ctx.close();
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const t0 = Date.now();
  try {
    for (const vp of VIEWPORTS) {
      if (ONLY && ONLY !== vp.key) continue;
      console.log(`\n${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", dedo" : ", ratón"})`);
      await layout(browser, base, vp);
      await events(browser, base, vp);
    }
    if (!ONLY || ONLY === "rot") { console.log("\ngiro"); await rotation(browser, base); }
    if (!ONLY || ONLY === "sw") await serviceWorker(browser, base);
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.19 browser: ${passed} ✔ · ${failed} ✘ · ${Math.round((Date.now() - t0) / 1000)} s · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})();
