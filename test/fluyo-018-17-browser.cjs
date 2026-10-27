"use strict";
/* FLUYO-018.17 — Chrome REAL: la hoja de Historias con cuatro estados, el lienzo ÚTIL en cada uno, el panel como hoja, la
   cabecera móvil, los objetivos táctiles, M1–M3 y el reencaje en columna. Mide los criterios de .ai/tasks/FLUYO-018.17.md
   (§ 16 y § 20): no «se ve bien», sino números.
   Viewports: 1440/1280/1101 (ratón), 768 (tableta, dedo), 430/390/375 (móvil, dedo), 844×390 (apaisado). Interfaz clara con
   el lienzo oscuro e interfaz oscura con el lienzo crema. Dos fixtures: el de 4 nodos (cabe en la zona libre a zoom ≥ 0,6) y
   uno de 12 nodos (no cabe: se centra el destino del paso sin bajar de 0,6).
   Uso: node test/fluyo-018-17-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=d1440|d1280|d1101|t768|m430|m390|m375|sw  recorre solo esa parte (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-17-"));
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };

/* 12 nodos en rejilla de 4 × 3 (160 u entre centros), una Historia de 3 pasos sobre nodos lejanos: no cabe en la zona libre de un
   móvil a zoom 0,6 (ancho 3·160+120 = 600 u → 360 px) de alto 2·160+70 = 390 u. */
const BIG = (() => {
  const nodes = [], edges = []; let id = 1;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) nodes.push({ id: id++, shape: "rect", x: 100 + c * 160, y: 80 + r * 160, w: 120, h: 70, label: "N" + (nodes.length + 1), color: "#857F6C" });
  for (let i = 0; i < 11; i++) edges.push({ id: id++, from: i + 1, to: i + 2 });
  const et = { id: 1, name: "Pulso", primitive: "OCCURRENCE", sentenceTemplate: "{target} late", visual: { kind: "token", value: "✦" }, motion: "normal", presentation: { nodeEffects: { highlight: true } } };
  const sc = { id: 1, engineVersion: 2, name: "Recorrido", nextStepId: 4, steps: [{ id: 1, at: 0, action: "OCCURRENCE", nodeId: 1, eventTypeId: 1 }, { id: 2, at: 800, action: "OCCURRENCE", nodeId: 8, eventTypeId: 1 }, { id: 3, at: 1600, action: "OCCURRENCE", nodeId: 12, eventTypeId: 1 }] };
  return JSON.stringify({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", cur: 0, eventTypes: [et], nextEventTypeId: 2, pages: [{ name: "Grande", nodes, edges, nextId: id, behaviors: [], scenarios: [sc], nextScenarioId: 2 }] }, settings: {} });
})();

const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* Umbrales (§ 20): lienzo visible en % de la pantalla, medido con elementFromPoint cada 8 px. Los móviles llevan el rail de
   49 px y la barra táctil cuando hay selección; por eso Propiedades queda por debajo del 45 % que estimaba el plan (§ 20). */
const VIEWPORTS = [
  { key: "d1440", width: 1440, height: 900, closed: 66, compact: 66, playing: 66, props: 66, panel: 288, story: 320 },
  { key: "d1280", width: 1280, height: 720, closed: 60, compact: 60, playing: 60, props: 60, panel: 288, story: 320 },
  { key: "d1101", width: 1101, height: 800, closed: 55, compact: 55, playing: 55, props: 55, panel: 288, story: 320 },
  { key: "t768", width: 768, height: 1024, touch: true, closed: 56, compact: 51, playing: 50, props: 53, panel: 216, story: 300 },
  { key: "m430", width: 430, height: 932, touch: true, mobile: true, closed: 82, compact: 72, playing: 72, props: 39 },
  { key: "m390", width: 390, height: 844, touch: true, mobile: true, closed: 80, compact: 70, playing: 70, props: 36 },
  { key: "m375", width: 375, height: 812, touch: true, mobile: true, closed: 80, compact: 68, playing: 68, props: 34 },
  /* 018.19: el teléfono en apaisado ya no es una columna de tableta (hojas laterales, franja de reproducción, sin barra inferior);
     su recorrido —reencaje al entrar en Historias, fila activa a la vista, objetivos— lo mide test/fluyo-018-19-browser.cjs. */
];
const ONLY = process.env.ONLY || "";

async function open(browser, base, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  if (opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof newNode === "function" && typeof setUiMode === "function" && typeof storyState === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready);
  await load(page, FIXTURE);
  return { ctx, page, errors };
}
const load = async (page, fx) => { await page.evaluate((fx) => { if (typeof scReset === "function") scReset(); applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, fx); await page.waitForTimeout(250); };
const press = async (t, sel, vp, ms = 350) => { const l = t.page.locator(sel).first(); if (vp.touch) await l.tap(); else await l.click(); await t.page.waitForTimeout(ms); };
const tapAt = async (t, vp, x, y, ms = 350) => { if (vp.touch) await t.page.touchscreen.tap(x, y); else await t.page.mouse.click(x, y); await t.page.waitForTimeout(ms); };
const shot = (t, vp, name) => t.page.screenshot({ path: path.join(shots, `${vp.key}-${name}.png`) });
const quiet = (page) => page.evaluate(() => { const n = document.getElementById("scNotice"); if (n) n.hidden = true; });

/* ───────── la medida ───────── */
const MEASURE = ([touch, crit]) => {
  const vis = (e) => { if (!e) return false; if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true })) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[hidden]"); };
  const W = innerWidth, H = innerHeight, cvEl = document.getElementById("cv");
  let hit = 0, n = 0;
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) { n++; if (document.elementFromPoint(x, y) === cvEl) hit++; }
  const hdr = document.querySelector("body > header"), hr = hdr.getBoundingClientRect();
  const kids = [...hdr.querySelectorAll(":scope > *, :scope > .modeSwitch > *, :scope > .hdrHistory > *")].filter((e) => vis(e) && !e.classList.contains("hdrDiv") && !e.closest(".moreMenu"));
  const rows = new Set(kids.map((e) => { const b = e.getBoundingClientRect(); return Math.round((b.top + b.height / 2) / 10); }));
  const aside = document.querySelector("aside"), ar = vis(aside) ? aside.getBoundingClientRect() : null;
  const v = visibleCanvasRect(), cr = cvEl.getBoundingClientRect();
  /* objetivos: críticos (lo que cambia de estado o lo cierra) ≥ 44 con dedo; el resto ≥ 40 con dedo / ≥ 28 con ratón */
  const CRIT = new Set(["btnStoryExit", "btnPanelClose", "scRun", "scReset", "btnStoryExpand", "scPlacementCancel", "scPlacementConfirm", "btnStories", "btnPresent", "btnMore", "btnUndo", "btnRedo", "btnPanel", "btnShare"]);
  const exclude = "#presentBar,#presentStory,#shareDialog,.overlay,#iconDrawer,#animDrawer,#editBox,.swatches,.swRow,.scDialog";   /* 018.23: «⋯» de color, con sus muestras */
  const ctl = [...document.querySelectorAll("button, select, input:not([type=hidden]):not([type=file]), [role=button], a.menuItem, summary, .scStorySentence, .scDelay, .scHandle")].filter((e) => vis(e) && !e.closest(exclude));
  const dims = (e) => { const r = e.getBoundingClientRect(), lab = e.id && document.querySelector('label[for="' + e.id + '"]'), row = lab && e.closest(".row,.hdrOpt,.fieldRow"); const tab = e.classList.contains("pgMore") && e.closest(".tab"); const eff = row ? row.getBoundingClientRect() : tab ? tab.getBoundingClientRect() : r; return [Math.max(r.width, eff.width), Math.max(r.height, eff.height)]; };
  const tag = (e) => (e.id || e.className.toString().split(" ")[0] || e.tagName) + ":" + dims(e).map(Math.round).join("x");
  const small = ctl.filter((e) => { const [w, h] = dims(e); const min = touch ? (CRIT.has(e.id) || e.classList.contains("scEventRow") ? 44 : 40) : 28; return Math.min(w, h) < min - 0.5; }).map(tag);
  const chips = [...document.querySelectorAll(".scEventRow")].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map(tag);
  const critical = crit.map((id) => {
    const e = document.getElementById(id); if (!vis(e)) return [id, "oculto"];
    const r = e.getBoundingClientRect();
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) return [id, "fuera"];
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return [id, top && (e === top || e.contains(top)) ? "ok" : "tapado:" + (top ? (top.id || top.className) : "?")];
  }).filter((c) => c[1] !== "ok");
  const scrollers = [...document.querySelectorAll("aside, aside *")].filter(vis).filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1; }).map((e) => e.id || e.className.toString().split(" ")[0]);
  const active = document.querySelector(".scStoryRow.scStatus_active"), board = document.querySelector(".scStoryboardSection");
  const inBoard = (e) => { if (!e || !board) return null; const r = e.getBoundingClientRect(), b = board.getBoundingClientRect(); return r.height > 0 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1; };
  const rowsFull = board ? [...board.querySelectorAll(".scStoryRow")].filter((e) => inBoard(e)).length : 0;
  const now = document.getElementById("scNow");
  return {
    canvasPct: Math.round(hit / n * 100), free: Math.round(v.height), freePct: Math.round(v.height / H * 100), zoom: +viewZoom.toFixed(3), cvH: Math.round(cr.height),
    headerH: Math.round(hr.height), headerRows: rows.size, headerOverflow: hdr.scrollWidth - hdr.clientWidth,
    sheet: ar ? { h: Math.round(ar.height), w: Math.round(ar.width), fixed: getComputedStyle(aside).position === "fixed", scrollTop: aside.scrollTop, overflowHidden: getComputedStyle(aside).overflowY === "hidden" } : null,
    overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - W,
    small, chips, critical, scrollers, state: document.body.dataset.story, expanded: document.body.classList.contains("storyExpanded"),
    now: { on: vis(now), caption: now ? document.getElementById("scNowCaption").textContent : "", progress: now ? document.getElementById("scNowProgress").textContent : "" },
    activeRowInBoard: inBoard(active), rowsFull, boardH: board && vis(board) ? Math.round(board.getBoundingClientRect().height) : 0,
    libraryRail: (() => { const l = document.getElementById("scLibrarySection"); if (!vis(l)) return null; const cs = getComputedStyle(l); return { row: cs.flexDirection === "row", scrollsX: l.scrollWidth > l.clientWidth, h: Math.round(l.getBoundingClientRect().height) }; })(),
    paletteVisible: vis(document.getElementById("scPaletteToggle")), addVisible: vis(document.getElementById("scStoryAdd")), resetVisible: vis(document.getElementById("scReset")), hintVisible: vis(document.getElementById("scRunHint")),
    btnPanelVisible: vis(document.getElementById("btnPanel")), tbConnect: vis(document.getElementById("tbConnect")), tbMulti: vis(document.getElementById("tbMulti")),
  };
};
/* el destino de un paso dentro de la zona libre, entero y legible */
const TARGET = (stepIndex) => {
  const sc = scActiveScenario();
  /* «activo»: la fila en curso o, si el momento es instantáneo (una ocurrencia), el último paso cuyo instante ya pasó */
  const cur = (typeof scPlayback !== "undefined" && scPlayback) ? scPlayback.cursorVirtual : -1;
  const step = stepIndex === "active" ? (sc.steps.find((s) => scRuntimeStateForStep(s).status === "active") || [...sc.steps].filter((s) => s.at <= cur).pop()) : sc.steps[stepIndex];
  if (!step) return null;
  const v = visibleCanvasRect(), p = scTargetPosition(step), n = step.nodeId ? nodeById(step.nodeId) : null;
  const hw = n ? n.w / 2 * viewZoom : 2, hh = n ? n.h / 2 * viewZoom : 2;
  const x = viewX + p.x * viewZoom, y = viewY + p.y * viewZoom;
  const inside = x - hw >= v.left - 1 && y - hh >= v.top - 1 && x + hw <= v.right + 1 && y + hh <= v.bottom + 1;
  const fs = n ? (n.fs || 14) * viewZoom : 99;
  return { inside, nodeH: Math.round(hh * 2), label: +fs.toFixed(1), zoom: +viewZoom.toFixed(2), id: step.id };
};
const PAGE_IN = () => { const v = visibleCanvasRect(), b = getBounds(); return viewX + b.x * viewZoom >= v.left - 1 && viewY + b.y * viewZoom >= v.top - 1 && viewX + (b.x + b.w) * viewZoom <= v.right + 1 && viewY + (b.y + b.h) * viewZoom <= v.bottom + 1; };
const CRIT_EDIT = (vp) => ["btnUndo", "btnRedo", "btnShare", "btnPresent", "btnMore", ...(vp.mobile && !vp.landscape ? ["btnStories"] : ["tabProperties", "tabScenarios"])];
const CRIT_STORY = (vp) => ["btnUndo", "btnShare", "btnPresent", "btnMore", "btnStoryExit", "scRun", ...(vp.mobile && !vp.landscape ? ["btnStories", "btnStoryExpand"] : ["tabProperties", "tabScenarios"])];
/* FLUYO-018.18 (D4): el momento en curso (#scNow) vive SOBRE el lienzo y no recibe el puntero (no es un control): su
   visibilidad la mide r.now.on, y fluyo-018-18-browser que no tapa el destino. Los críticos son los controles. */
const CRIT_PLAY = (vp) => ["btnStoryExit", "scReset", ...(vp.mobile && !vp.landscape ? ["btnStories", "btnStoryExpand"] : ["tabProperties"])];
const nodeAt = (page, idx) => page.evaluate((i) => { const n = P().nodes[i], r = cv.getBoundingClientRect(); return { x: r.left + viewX + n.x * viewZoom, y: r.top + viewY + n.y * viewZoom, id: n.id }; }, idx);

/* ═════════ un viewport, interfaz clara/oscura ═════════ */
async function journey(browser, base, vp) {
  console.log(`\n${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", táctil" : ", ratón"}${vp.landscape ? ", apaisado" : ""})`);
  const t = await open(browser, base, vp); const { page } = t;
  const sheet = await page.evaluate(() => isSheetLayout());
  check(sheet === !!(vp.mobile && !vp.landscape), `layout: ${sheet ? "hoja" : "columna"}`);
  const m = (crit) => page.evaluate(MEASURE, [!!vp.touch, crit]);
  const target = vp.touch ? "40/44" : "28";
  for (const [ui, theme] of [["clara", "dark"], ["oscura", "crema"]]) {
    const tag = `${ui}·${theme}`;
    await page.evaluate((dark) => { const c = $("chkUiDark"); if (c.checked !== dark) { c.checked = dark; c.dispatchEvent(new Event("change")); } }, ui === "oscura");
    await page.evaluate((th) => { setThemeIn(doc, { theme: th }); syncProjectControls(); }, theme); await page.waitForTimeout(250);
    await load(page, FIXTURE);
    /* ── cerrada ── */
    let r = await m(CRIT_EDIT(vp));
    check(r.headerRows === 1 && r.headerH <= 56 && r.headerOverflow <= 0 && r.overflowX <= 0, `${tag} cerrada: cabecera en una fila (${r.headerH} px), sin overflow`);
    check(r.canvasPct >= vp.closed, `${tag} cerrada: lienzo ${r.canvasPct}% (≥ ${vp.closed}%)`);
    check(r.critical.length === 0 && r.small.length === 0, `${tag} cerrada: críticos a la vista y objetivos ≥ ${target} px ${JSON.stringify([r.critical, r.small])}`);
    if (sheet) check(!r.btnPanelVisible, `${tag} cerrada: sin selección no hay ⚙ (M2)`);
    const placed = await page.evaluate(() => ({ anim: $("grpAnim").parentNode.id, help: $("grpHelp").parentNode.id }));
    if (sheet) check(placed.anim === "animSection" && placed.help === "helpSection", `${tag} M1/M2: Animación del lienzo y Ayuda viven en «Más» ${JSON.stringify(placed)}`);
    /* FLUYO-018.23 (D3): en columna, la animación vive en «Lienzo» y la ayuda en «Más»: nada de eso en Propiedades */
    else check(placed.anim === "canvasMenu" && placed.help === "helpSection", `${tag} M1/M2: en columna, Animación en «Lienzo» y Ayuda en «Más» ${JSON.stringify(placed)}`);
    await shot(t, vp, `${ui}-closed`);
    /* ── compacta ── */
    const cutBefore = await page.evaluate(() => diagramCut());
    await press(t, sheet ? "#btnStories" : "#tabScenarios", vp);
    await page.evaluate(() => { const s = P().scenarios.find((x) => x.steps.length >= 3); scSelectStory(s.id); scRenderPanel(); }); await page.waitForTimeout(200);
    await quiet(page);
    r = await m(CRIT_STORY(vp));
    if (sheet) {
      check(r.state === "compact" && r.sheet && r.sheet.h <= 136 && !r.expanded, `${tag} compacta: body[data-story=compact], hoja de ${r.sheet && r.sheet.h} px (≤ 136)`);
      check(r.canvasPct >= vp.compact, `${tag} compacta: lienzo ${r.canvasPct}% (≥ ${vp.compact}%)`);
      check(!r.addVisible && !r.paletteVisible && !r.libraryRail && r.boardH === 0, `${tag} compacta: solo el mando (sin «+», paleta, fichas ni línea de tiempo)`);
      check(r.scrollers.length === 0 && r.sheet.scrollTop === 0, `${tag} compacta: nada desplaza`);
      const pg = await page.evaluate(PAGE_IN), tg0 = await page.evaluate(TARGET, 0);
      check((pg || (tg0 && tg0.inside)) && r.zoom >= 0.6 - 1e-6, `${tag} compacta: zoom legible (${r.zoom}); la página cabe en la zona libre (${pg}) o el destino del primer paso está en ella (${tg0 && tg0.inside})`);
    } else {
      check(r.sheet && Math.abs(r.sheet.w - vp.story) <= 1 && !r.sheet.fixed, `${tag} columna de Historias de ${r.sheet && r.sheet.w} px (${vp.story})`);
      check(r.addVisible && r.resetVisible === false && r.libraryRail && !r.libraryRail.row, `${tag} columna: «+» y biblioteca vertical como siempre`);
      check(r.canvasPct >= vp.compact, `${tag} Historias: lienzo ${r.canvasPct}% (≥ ${vp.compact}%)`);
      const cutAfter = await page.evaluate(() => diagramCut());
      check(!cutBefore ? !cutAfter : true, `${tag} reencaje: un diagrama que cabía no queda cortado al entrar (antes ${cutBefore}, después ${cutAfter})`);
    }
    check(r.critical.length === 0 && r.small.length === 0 && r.overflowX <= 0, `${tag} Historias: «Volver a editar», Reproducir y críticos a la vista; objetivos ≥ ${target} ${JSON.stringify([r.critical, r.small])}`);
    await shot(t, vp, `${ui}-compact`);
    if (sheet) {
      /* ── ampliada: el lienzo sigue siendo útil ── */
      await press(t, "#btnStoryExpand", vp);
      await page.evaluate(() => { const b = document.querySelector(".scStoryboardSection"); if (b) b.scrollTop = 0; });
      r = await m(CRIT_STORY(vp));
      const minFree = Math.max(300, vp.height * 0.4);
      check(r.state === "expanded" && r.expanded, `${tag} ampliada: body[data-story=expanded]`);
      check(r.free >= minFree - 1, `${tag} ampliada: zona libre de ${r.free} px (≥ max(300, 40dvh) = ${Math.round(minFree)})`);
      check(r.libraryRail && r.libraryRail.row && r.libraryRail.h <= 64, `${tag} ampliada: los eventos son fichas en un carril horizontal (${r.libraryRail && r.libraryRail.h} px)`);
      check(r.chips.length === 0, `${tag} ampliada: fichas de 44 px ${JSON.stringify(r.chips)}`);
      check(r.scrollers.length === 1 && r.scrollers[0] === "scStoryboardSection" && r.sheet.scrollTop === 0 && r.sheet.overflowHidden, `${tag} ampliada: la línea de tiempo es el ÚNICO desplazable (la hoja no desplaza) ${JSON.stringify(r.scrollers)}`);
      check(r.boardH >= 180 && r.rowsFull >= 1, `${tag} ampliada: línea de tiempo de ${r.boardH} px con ${r.rowsFull} paso(s) entero(s) a la vista (antes 142 px; las filas llevan dos líneas)`);
      check(r.critical.length === 0 && r.small.length === 0, `${tag} ampliada: críticos y objetivos ${JSON.stringify([r.critical, r.small])}`);
      /* tocar un paso trae su destino a la zona libre, entero y legible */
      await page.evaluate(() => { const v = visibleCanvasRect(); viewY -= v.height; });   /* lo saco de la zona libre a propósito */
      await page.locator(".scStoryRow .scStepPrimary").nth(1).tap(); await page.waitForTimeout(300);
      await page.keyboard.press("Escape"); await page.waitForTimeout(150);
      let tg = await page.evaluate(TARGET, 1);
      check(tg && tg.inside && tg.nodeH >= 36 && tg.label >= 8 && tg.zoom >= 0.6 - 1e-6, `${tag} ampliada: tocar un paso trae su destino entero y legible ${JSON.stringify(tg)}`);
      /* tocar un nodo en la zona libre lo selecciona y la hoja se queda; tocar el vacío reduce */
      const nd = await nodeAt(page, 0);
      await tapAt(t, vp, nd.x, nd.y);
      let st = await page.evaluate(() => ({ state: document.body.dataset.story, sel: [...selN] }));
      check(st.state === "expanded" && st.sel.length === 1 && st.sel[0] === nd.id, `${tag} ampliada: tocar un nodo lo selecciona y la hoja sigue ampliada ${JSON.stringify(st)}`);
      r = await m([]);
      check(!r.tbConnect && r.tbMulti, `${tag} M3: con un nodo seleccionado en modo Historia no se ofrece «Conectar»; «Seleccionar varios» sí`);
      /* desplazar en la zona libre mueve la vista */
      const v0 = await page.evaluate(() => ({ x: viewX, y: viewY, r: cv.getBoundingClientRect(), v: visibleCanvasRect() }));
      const sx = v0.r.left + 20, sy = v0.r.top + v0.v.top + 40;
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy }] });
      for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sx + i * 12, y: sy + i * 8 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(250);
      const v1 = await page.evaluate(() => ({ x: viewX, y: viewY, state: document.body.dataset.story }));
      check((Math.abs(v1.x - v0.x) > 20 || Math.abs(v1.y - v0.y) > 10) && v1.state === "expanded", `${tag} ampliada: la zona libre se desplaza con un dedo y la hoja se queda (Δ ${Math.round(v1.x - v0.x)}, ${Math.round(v1.y - v0.y)})`);
      await page.evaluate(() => { clearSel(); revealAboveSheet("page"); });
      const empty = await page.evaluate(() => { const r = cv.getBoundingClientRect(), v = visibleCanvasRect(); for (let y = v.top + 16; y < v.bottom - 16; y += 10) for (let x = 16; x < r.width - 16; x += 10) { const w = toWorldFromClient(r.left + x, r.top + y); if (!hitNode(w.x, w.y) && !hitEdge(w.x, w.y)) return { x: r.left + x, y: r.top + y }; } return null; });
      await tapAt(t, vp, empty.x, empty.y);
      check(await page.evaluate(() => document.body.dataset.story === "compact" && document.body.classList.contains("storyMode")), `${tag} ampliada: tocar el vacío reduce sin salir del modo`);
      await shot(t, vp, `${ui}-expanded`);
      /* ── colocar un evento desde una ficha: la hoja se aparta, Cancelar ≥ 44 y ningún aviso lo tapa ── */
      await press(t, "#btnStoryExpand", vp);
      await page.locator(".scEventPlace").first().tap(); await page.waitForTimeout(350);
      await page.evaluate(() => scNotice("No se puede colocar eventos en esta historia."));   /* un aviso durante la colocación: antes tapaba «Cancelar» */
      await page.waitForTimeout(100);
      r = await m(["scPlacementCancel"]);
      const placing = await page.evaluate(() => document.body.classList.contains("scPlacing") && getComputedStyle(document.querySelector("aside")).visibility === "hidden");
      check(placing && r.critical.length === 0 && r.small.length === 0, `${tag} colocando: la hoja se aparta, «Cancelar» (≥ 44) a la vista y sin aviso encima ${JSON.stringify([r.critical, r.small])}`);
      const n0 = await nodeAt(page, 0);
      await tapAt(t, vp, n0.x, n0.y, 500);
      r = await m(CRIT_STORY(vp));
      const added = await page.evaluate(() => { const sc = scActiveScenario(); const row = document.querySelector('[data-step-id="' + scSelectedStep + '"]'); const b = document.querySelector(".scStoryboardSection").getBoundingClientRect(); const rr = row && row.getBoundingClientRect(); return { steps: sc.steps.length, rowIn: !!rr && rr.top >= b.top - 1 && rr.bottom <= b.bottom + 1, scrollTop: document.querySelector("aside").scrollTop }; });
      check(r.state === "expanded" && added.rowIn && added.scrollTop === 0 && r.critical.length === 0, `${tag} tras colocar: la hoja vuelve ampliada con la fila nueva a la vista y «Volver a editar» en su sitio ${JSON.stringify(added)}`);
      await page.evaluate(() => scDeleteStep(scActiveScenario().steps[scActiveScenario().steps.length - 1].id));
      /* ── reproduciendo: el lienzo manda y el evento activo se ve dos veces ── */
      await press(t, "#scRun", vp, 500); await quiet(page);
      r = await m(CRIT_PLAY(vp));
      check(r.state === "playing" && !r.expanded && r.sheet.h <= 140, `${tag} reproduciendo: el transporte (hoja de ${r.sheet.h} px ≤ 140), la ampliada se recogió`);
      check(r.canvasPct >= vp.playing, `${tag} reproduciendo: lienzo ${r.canvasPct}% (≥ ${vp.playing}%)`);
      check(r.now.on && r.now.caption.length > 0 && /\d+ \/ \d+/.test(r.now.progress) && !r.paletteVisible, `${tag} reproduciendo: «Reproduciendo» con momento («${r.now.caption}») y progreso (${r.now.progress}); sin paleta inerte`);
      check(r.critical.length === 0 && r.small.length === 0, `${tag} reproduciendo: Detener, Volver a editar, Ampliar e Historias a la vista ${JSON.stringify([r.critical, r.small])}`);
      /* ampliar mientras se reproduce: la línea de tiempo con la fila activa a la vista */
      await press(t, "#btnStoryExpand", vp, 300);
      r = await m(CRIT_PLAY(vp));
      check(r.state === "playing" && r.expanded && r.boardH > 0 && r.activeRowInBoard === true, `${tag} reproduciendo + ampliada: la fila activa está a la vista en la línea de tiempo`);
      await press(t, "#btnStoryExpand", vp, 200);
      await shot(t, vp, `${ui}-playing`);
      const seen = new Set(), targets = [];
      for (let i = 0; i < 24 && seen.size < 3; i++) { const tg = await page.evaluate(TARGET, "active"); if (tg && !seen.has(tg.id)) { seen.add(tg.id); targets.push(tg); } await page.waitForTimeout(150); }
      check(targets.length >= 2 && targets.every((x) => x.inside && x.zoom >= 0.6 - 1e-6), `${tag} reproduciendo: el destino del paso activo está en la zona libre en ${targets.length} pasos distintos ${JSON.stringify(targets.map((x) => [x.id, x.inside]))}`);
      await page.waitForFunction(() => scStatus === "completed", null, { timeout: 30000 }); await page.waitForTimeout(150);
      r = await m(["btnStoryExit", "scRun", "btnStoryExpand"]);
      /* FLUYO-018.18 (D5, D6): terminada hay «Detener» en la hoja (una sola palabra) y Ampliar solo amplía: la línea de tiempo
         ampliada sirve para volver a un momento. */
      check(r.state === "playing" && r.resetVisible && r.now.on && /Terminada/.test(await page.evaluate(() => $("scNowLabel").textContent)) && (await page.evaluate(() => $("scReset").textContent)) === "■ Detener" && r.critical.length === 0, `${tag} terminada: Repetir, «Detener» y Volver a editar a la vista`);
      await press(t, "#btnStoryExpand", vp);
      check(await page.evaluate(() => scStatus === "completed" && document.body.dataset.story === "playing" && document.body.classList.contains("storyExpanded")), `${tag} terminada: Ampliar amplía sin detener (la línea de tiempo sirve para saltar)`);
      await press(t, "#btnStoryExpand", vp);
      await press(t, "#scReset", vp);
    } else {
      /* columna: reproducir ⇒ fila activa a la vista, paleta oculta; terminada ⇒ «Detener» (018.18, D5) */
      await press(t, "#scRun", vp, 500); await quiet(page);
      r = await m(CRIT_PLAY(vp));
      /* en apaisado (844×390, fuera de alcance: D8) la línea de tiempo mide ~80 px y una fila de dos líneas no cabe entera */
      check(r.now.on && !r.paletteVisible && (r.activeRowInBoard === true || r.boardH < 120) && r.canvasPct >= vp.playing, `${tag} reproduciendo en columna: «Reproduciendo», sin paleta inerte, fila activa a la vista (línea de tiempo de ${r.boardH} px), lienzo ${r.canvasPct}%`);
      const tg = await page.evaluate(TARGET, "active");
      check(tg && tg.inside, `${tag} reproduciendo en columna: el destino activo está en el lienzo`);
      await page.waitForFunction(() => scStatus === "completed", null, { timeout: 30000 }); await page.waitForTimeout(150);
      r = await m(["scReset", "btnStoryExit"]);
      check(r.resetVisible && r.critical.length === 0 && (await page.evaluate(() => $("scReset").textContent)) === "■ Detener", `${tag} terminada en columna: «Detener» (ya no «Terminar»)`);
      await press(t, "#scReset", vp);
    }
    /* ── volver a editar ── */
    await press(t, "#btnStoryExit", vp);
    r = await m(CRIT_EDIT(vp));
    check(r.state === "closed" && !(await page.evaluate(() => document.body.classList.contains("storyMode"))) && r.canvasPct >= vp.closed, `${tag} «Volver a editar»: cerrada, lienzo ${r.canvasPct}%`);
    /* ── revisión manual: el rail enciende exactamente el botón elegido; un tema predefinido sustituye al color propio ── */
    const railOn = () => page.evaluate(() => [...document.querySelectorAll(".rail button.toggled")].map((b) => b.dataset.mode || b.dataset.shape || b.id));
    await press(t, '.rail button[data-shape="rect"]', vp); let on = await railOn();
    check(on.length === 1 && on[0] === "rect", `${tag} rail: elegir Caja enciende solo Caja ${JSON.stringify(on)}`);
    await press(t, '.rail button[data-shape="cylinder"]', vp); on = await railOn();
    check(on.length === 1 && on[0] === "cylinder", `${tag} rail: elegir BD enciende solo BD ${JSON.stringify(on)}`);
    await press(t, '.rail button[data-mode="select"]', vp); on = await railOn();
    check(on.length === 1 && on[0] === "select", `${tag} rail: Mover enciende solo Mover ${JSON.stringify(on)}`);
    const bg = await page.evaluate(async () => {
      const i = $("bgCustom"); i.value = "#ff0000"; i.dispatchEvent(new Event("input", { bubbles: true }));
      const s = $("themeSel"); s.value = "crema"; s.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const d = cv.fluyoDpr || 1, c = cv.getContext("2d"), px = [...c.getImageData(Math.round(6 * d), Math.round(6 * d), 1, 1).data].slice(0, 3).join(",");
      const out = { custom: doc.customBg, theme: doc.theme, px, input: $("bgCustom").value };
      setThemeIn(doc, { theme: "dark", customBg: "" }); syncProjectControls(); return out;
    });
    check(bg.custom === "" && bg.theme === "crema" && bg.px === "244,238,225" && bg.input === "#f4eee1", `${tag} fondo: tras un color propio, elegir «crema» pinta crema y quita el color propio ${JSON.stringify(bg)}`);
    await page.evaluate((th) => { setThemeIn(doc, { theme: th }); syncProjectControls(); }, theme);
    /* ── Propiedades: hoja de 40dvh, selección a la vista, campos de 16 px ── */
    const n0 = await nodeAt(page, 0);
    await tapAt(t, vp, n0.x, n0.y);
    if (sheet) await press(t, "#btnPanel", vp);
    r = await m([...CRIT_EDIT(vp), ...(sheet ? ["btnPanelClose", "btnPanel"] : [])]);
    const selIn = await page.evaluate(() => {
      const n = nodeById([...selN][0]), cr = cv.getBoundingClientRect(), v = visibleCanvasRect();
      const l = viewX + (n.x - n.w / 2) * viewZoom, tp = viewY + (n.y - n.h / 2) * viewZoom, rr = l + n.w * viewZoom, bb = tp + n.h * viewZoom;
      const inZone = l >= v.left && tp >= v.top && rr <= v.right && bb <= v.bottom;
      /* con las cajas reales, por si la zona libre de la app olvidara la barra táctil o la hoja */
      const tb = document.getElementById("touchBar"), aside = document.querySelector("aside");
      const hit = (e) => { if (!e || e.hidden || getComputedStyle(e).visibility === "hidden") return false; const b = e.getBoundingClientRect(); if (!b.height) return false; const x0 = b.left - cr.left, y0 = b.top - cr.top, x1 = b.right - cr.left, y1 = b.bottom - cr.top; return !(rr < x0 || l > x1 || bb < y0 || tp > y1); };
      /* y el contrato de la zona libre: con la barra táctil a la vista, la zona empieza por debajo de ella */
      const zoneOk = !tb || tb.hidden || getComputedStyle(tb).visibility === "hidden" || v.top >= tb.getBoundingClientRect().bottom - cr.top - 1;
      return inZone && zoneOk && !hit(tb) && !(isSheetLayout() && hit(aside));
    });
    if (sheet) {
      check(r.sheet && r.sheet.fixed && r.sheet.h <= Math.min(360, Math.max(220, vp.height * 0.4)) + 1, `${tag} Propiedades: hoja de ${r.sheet && r.sheet.h} px (≤ 40dvh)`);
      check(r.btnPanelVisible, `${tag} Propiedades: con selección, ⚙ está (M2)`);
    } else check(r.sheet && Math.abs(r.sheet.w - vp.panel) <= 1, `${tag} Propiedades: columna de ${r.sheet && r.sheet.w} px`);
    check(r.canvasPct >= vp.props && selIn, `${tag} Propiedades: lienzo ${r.canvasPct}% (≥ ${vp.props}%) y la selección entera en la zona libre (sin barra táctil encima)`);
    check(r.critical.length === 0 && r.small.length === 0, `${tag} Propiedades: críticos y objetivos ${JSON.stringify([r.critical, r.small])}`);
    const fonts = await page.evaluate(() => ["lblEdit", "fsIn", "fontSel", "shapeSel"].map((id) => parseFloat(getComputedStyle($(id)).fontSize)));
    if (vp.touch) check(fonts.every((f) => f >= 16), `${tag} campos a 16 px con dedo ${JSON.stringify(fonts)}`); else check(fonts.every((f) => f < 16), `${tag} campos de escritorio sin cambio ${JSON.stringify(fonts)}`);
    await shot(t, vp, `${ui}-props`);
    if (sheet) {
      await press(t, "#btnPanelClose", vp);
      r = await m(CRIT_EDIT(vp));
      check(r.state === "closed" && r.canvasPct >= vp.closed - 6 && !r.sheet, `${tag} cerrar Propiedades devuelve el lienzo (${r.canvasPct}%)`);
      await page.evaluate(() => { selN.add(P().nodes[0].id); refreshPanel(); openSurface("properties"); }); await page.waitForTimeout(200);
      await page.evaluate(() => { clearSel(); }); await page.waitForTimeout(500);
      r = await m([]);
      check(!r.btnPanelVisible && !r.sheet && r.state === "closed", `${tag} sin selección la hoja se cierra sola y ⚙ desaparece (M2) ${JSON.stringify([r.btnPanelVisible, r.sheet])}`);
    }
    await page.evaluate(() => clearSel());
  }
  /* ── fixture grande: no cabe a zoom legible ⇒ no se encoge; se centra el destino del primer paso ── */
  await page.evaluate(() => { const c = $("chkUiDark"); if (c.checked) { c.checked = false; c.dispatchEvent(new Event("change")); } });
  await load(page, BIG);
  await press(t, sheet ? "#btnStories" : "#tabScenarios", vp);
  if (sheet) {
    const z0 = await page.evaluate(() => viewZoom);
    const tg = await page.evaluate(TARGET, 0);
    check(tg && tg.inside && tg.zoom >= 0.6 - 1e-6 && tg.nodeH >= 36, `grande: compacta no baja de 0,6 (${tg && tg.zoom}) y enseña el destino del primer paso ${JSON.stringify(tg)}`);
    await press(t, "#btnStoryExpand", vp);
    const tg2 = await page.evaluate(TARGET, 0), pg = await page.evaluate(PAGE_IN);
    check(tg2 && tg2.inside && tg2.zoom >= 0.6 - 1e-6 && !pg, `grande: ampliada sigue a zoom ≥ 0,6 con el destino a la vista (la página no cabe: ${!pg}) ${JSON.stringify(tg2)}`);
    await page.locator(".scStoryRow .scStepPrimary").nth(2).tap(); await page.waitForTimeout(300); await page.keyboard.press("Escape");
    const tg3 = await page.evaluate(TARGET, 2);
    check(tg3 && tg3.inside && tg3.zoom >= 0.6 - 1e-6, `grande: tocar el tercer paso trae su destino (nodo lejano) sin cambiar el zoom ${JSON.stringify(tg3)}`);
    await press(t, "#btnStoryExpand", vp);
    await press(t, "#scRun", vp, 400); await quiet(page);
    const seen = new Set(), targets = [];
    for (let i = 0; i < 30 && seen.size < 3; i++) { const tgA = await page.evaluate(TARGET, "active"); if (tgA && !seen.has(tgA.id)) { seen.add(tgA.id); targets.push(tgA); } await page.waitForTimeout(100); }
    check(targets.length >= 2 && targets.every((x) => x.inside && x.zoom >= 0.6 - 1e-6), `grande: reproduciendo, cada paso activo (nodos lejanos) se trae a la zona libre ${JSON.stringify(targets.map((x) => [x.id, x.inside]))}`);
    await page.waitForFunction(() => scStatus === "completed", null, { timeout: 30000 });
    void z0;
  } else {
    /* columna: una vista que el usuario había acercado (cortada) no se toca al entrar en Historias */
    await press(t, "#tabProperties", vp);
    await page.evaluate(() => { viewZoom = 1.6; viewX = -200; viewY = -100; });
    const cutBefore = await page.evaluate(() => diagramCut());
    const before = await page.evaluate(() => [viewZoom, viewX, viewY]);
    await press(t, "#tabScenarios", vp, 400);
    const after = await page.evaluate(() => [viewZoom, viewX, viewY]);
    check(cutBefore && before.join() === after.join(), `columna: una vista ya cortada (acercada por el usuario) no se reencaja al entrar en Historias`);
  }
  await press(t, "#btnStoryExit", vp);
  /* ── páginas: «＋» a la vista y la segunda página alcanzable ──
     FLUYO-018.18 (D10): en el teléfono la tira es UN selector (la activa por su nombre) que abre la lista con «＋ Nueva página»;
     por encima de 700 px, las pestañas y «＋» como antes. */
  await load(page, FIXTURE);
  const pages = await page.evaluate(() => { const f = $("pagesBar"), fr = f.getBoundingClientRect(); const box = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= fr.left - 1 && r.right <= fr.right + 1; }; const tabs = [...f.querySelectorAll(".tab")]; const sel = f.querySelector(".pgSelect"); return { add: box(f.querySelector(".pgAdd")), tabs: tabs.map(box), addW: Math.round(f.querySelector(".pgAdd").getBoundingClientRect().width), overflow: f.scrollWidth - f.clientWidth, select: box(sel), selectH: Math.round(sel.getBoundingClientRect().height) }; });
  if (vp.mobile && !vp.landscape) check(pages.select && pages.selectH >= 44 && !pages.add && pages.tabs.every((x) => !x), `páginas: selector de página a la vista (${pages.selectH} px) ${JSON.stringify(pages)}`);
  else check(pages.add && pages.tabs.every(Boolean) && pages.addW >= (vp.touch ? 44 : 28), `páginas: «＋» (${pages.addW} px) y las dos pestañas a la vista ${JSON.stringify(pages)}`);
  check(t.errors.length === 0, "0 errores de consola/página " + JSON.stringify(t.errors));
  await t.ctx.close();
}

/* Service Worker v76: instala y sirve sin red. */
async function serviceWorker(browser, base) {
  console.log("\nService Worker v76");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  await page.goto(base + "/"); await page.waitForFunction(() => typeof renderTabs === "function");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const keys = await page.evaluate(() => caches.keys());
  check(keys.length === 1 && keys[0] === "fluyo-static-v113", "caché instalada: fluyo-static-v113 " + JSON.stringify(keys));
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => typeof storyState === "function");
  const off = await page.evaluate(() => ({ css: getComputedStyle(document.documentElement).getPropertyValue("--ctl-h-touch").trim(), hint: !!document.getElementById("scRunHint") }));
  check(off.css === "44px" && off.hint, "sin red: la UI nueva se sirve desde la caché " + JSON.stringify(off));
  await ctx.close();
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS) if (!ONLY || ONLY === vp.key) await journey(browser, base, vp);
    if (!ONLY || ONLY === "sw") await serviceWorker(browser, base);
  } finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.17 browser: ${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
