"use strict";
/* FLUYO-018.27 — Chrome REAL, pasada dirigida (< 30 s): tamaño configurable de las puntas.
   d1440 (ratón):
   · Casos obligatorios (§7 de la tarea) sobre el lienzo real: A recta, B par bidireccional, C U, D muy corta, E Ninguna/Inicio/Fin/Ambas,
     F 1× · 1,5× · 2×. Se mide lo DIBUJADO (píxeles del lienzo con la conexión en rojo): el ancho de la punta es 8·k·zoom ± 1,5 px,
     la punta termina a EDGE_GAP del ancla (no flota ni entra en el nodo), la ruta (edgePoints) y los nodos no cambian.
   · T8: a zoom 2 la punta mide el doble de píxeles que a zoom 1 (escala con el diagrama, como la línea), sin factor propio.
   · Panel: «Tamaño de flecha» bajo Puntas; clic en 1,5× y 2× = una entrada de Undo cada uno; elegir el valor actual no escribe; teclado
     (flechas sobre el radiogroup) elige; Undo/Redo devuelven el JSON exacto y la selección; con Puntas = Ninguna la fila se oculta.
   · SVG del editor (buildSVGDocument): la punta a 2× mide 22×16, ningún <marker>.
   · Present: el mismo trazo (la punta grande sigue a 2×). Share → Viewer: el documento llega con `arrowSize` y el Viewer la dibuja grande.
   · Eliminar/duplicar: la copia conserva `arrowSize`; eliminar y deshacer la devuelve igual.
   m390 (dedo): un toque en 2× escribe una entrada de Undo; la fila existe en la hoja.
   Uso: node test/fluyo-018-27-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=d1440|m390 */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-27-"));
fs.mkdirSync(shots, { recursive: true });
const ONLY = process.env.ONLY || "";
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
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
const RED = "#ff0000";

/* Utilidades que viven en la página (editor y Viewer comparten las de píxeles). */
const PAGE_HELPERS = () => {
  window.__t = {
    reset(theme) {
      setUiMode("edit"); if (theme) setThemeIn(doc, { theme, customBg: "" });
      removeEdges(P().edges.map((e) => e.id)); removeNodes(P().nodes.map((n) => n.id));
      settings.snap = false; settings.single = false; viewZoom = 1; viewX = 60; viewY = 0; clearSel(); undoStack.length = 0; redoStack.length = 0; scheduleAutosave();
    },
    /* rojo de la conexión con antialias sobre crema (244,238,225) o sobre oscuro (22,22,22): media cobertura vale */
    isRed: (r, g, b) => r > 100 && g < 150 && b < 150 && r - g > 60,
    /* lienzo → píxeles del bitmap (dpr) */
    scr(p) { const r = cv.getBoundingClientRect(); return { x: r.left + viewX + p.x * viewZoom, y: r.top + viewY + p.y * viewZoom }; },
    bmp(p) { const r = cv.getBoundingClientRect(), d = cv.width / r.width; return { x: (viewX + p.x * viewZoom) * d, y: (viewY + p.y * viewZoom) * d, d }; },
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    /* caja de los píxeles rojos (la conexión) dentro de un rectángulo de MUNDO; devuelve ancho/alto en px de bitmap y en mundo */
    redBox(canvas, w0, w1) {
      const a = __t.bmp(w0), b = __t.bmp(w1), c = canvas.getContext("2d");
      const X = Math.max(0, Math.round(Math.min(a.x, b.x))), Y = Math.max(0, Math.round(Math.min(a.y, b.y))), W = Math.round(Math.abs(b.x - a.x)), H = Math.round(Math.abs(b.y - a.y));
      const d = c.getImageData(X, Y, W, H).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; if (__t.isRed(d[k], d[k + 1], d[k + 2])) { n++; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); } }
      if (!n) return { n: 0 };
      const wx = (v) => (v / a.d - viewX) / viewZoom, wy = (v) => (v / a.d - viewY) / viewZoom;   // bitmap → mundo
      return { n, w: x1 - x0 + 1, h: y1 - y0 + 1, x0: wx(X + x0), x1: wx(X + x1 + 1), y0: wy(Y + y0), y1: wy(Y + y1 + 1), dpr: a.d };
    },
    /* la punta del final de una conexión, en mundo: tip (a EDGE_GAP del ancla), base y dirección; y su caja medida en píxeles */
    head(e, which) {
      const p = edgePoints(e), st = edgeStroke(e, p), h = which === "start" ? st.heads[st.heads.length - 1] : st.heads[0];
      const tip = h[0], base = { x: (h[1].x + h[3].x) / 2, y: (h[1].y + h[3].y) / 2 }, u = { x: tip.x - base.x, y: tip.y - base.y }, L = Math.hypot(u.x, u.y);
      return { tip, base, u: { x: u.x / L, y: u.y / L }, len: L, half: Math.hypot(h[1].x - h[3].x, h[1].y - h[3].y) / 2, heads: st.heads.length };
    },
    json: (id) => JSON.stringify(edgeById(id)),
    state: (id) => ({ e: JSON.stringify(edgeById(id)), u: undoStack.length, r: redoStack.length, sel: [...selE] }),
    segVals: () => [...document.querySelectorAll("#arrowSizeSeg .segBtn")].map((b) => [b.dataset.v, b.getAttribute("aria-checked"), b.tabIndex]),
    rowVisible: () => getComputedStyle($("rowArrowSize")).display !== "none",
  };
};
/* la punta medida en el lienzo: la caja de los píxeles rojos entre la base y la punta (±half+3 a los lados). Su extensión perpendicular
   es el ancho de la base, 8·k (el resto de la aguja es un triángulo: más cerca de la punta es más estrecha). La línea pasa por el eje y no
   añade anchura. Además: el rojo más cercano al ancla, en el tramo [punta − 6, ancla + 2]: debe quedar a ~EDGE_GAP del ancla (ni flota
   ni entra en el nodo); con antialias, entre 1,5 y 4,5 px. */
const measureHead = (page, id, which, canvasExpr) => page.evaluate(([id, which, canvasExpr]) => {
  const e = edgeById(id), h = __t.head(e, which), c = canvasExpr === "sv" ? sv : cv;
  const n = { x: -h.u.y, y: h.u.x }, r = h.half + 3;
  const w0 = { x: h.base.x - h.u.x * 0.5 - n.x * r, y: h.base.y - h.u.y * 0.5 - n.y * r }, w1 = { x: h.tip.x + n.x * r, y: h.tip.y + n.y * r };
  const box = __t.redBox(c, w0, w1);
  const across = Math.abs(n.x) > 0.5 ? box.w : box.h;      // extensión perpendicular a la aguja
  const p = edgePoints(e), z = which === "start" ? p[0] : p[p.length - 1];
  const a0 = { x: h.tip.x - h.u.x * 6 - n.x * 3, y: h.tip.y - h.u.y * 6 - n.y * 3 }, a1 = { x: z.x + h.u.x * 2 + n.x * 3, y: z.y + h.u.y * 2 + n.y * 3 };
  const near = __t.redBox(c, a0, a1);
  const horiz = Math.abs(h.u.x) > 0.5;
  const along = horiz ? [near.x0, near.x1] : [near.y0, near.y1];
  const tipAlong = horiz ? h.tip.x : h.tip.y, anchorAlong = horiz ? z.x : z.y, sgn = horiz ? Math.sign(h.u.x) : Math.sign(h.u.y);
  const far = sgn > 0 ? along[1] : along[0];                 // el rojo más cercano al ancla, en mundo
  return { across: across / box.dpr / viewZoom, px: across, dpr: box.dpr, zoom: viewZoom, n: box.n, farDist: near.n ? sgn * (anchorAlong - far) : NaN, tipGap: Math.abs(anchorAlong - tipAlong), heads: h.heads };
}, [id, which, canvasExpr]);

async function open(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof refreshPanel === "function" && typeof edgeStroke === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(PAGE_HELPERS);
  return { ctx, page, errors, vp };
}
const W2S = (page, p) => page.evaluate((p) => __t.scr(p), p);
async function shot(page, name, a, b) { await page.mouse.move(2, 2); await page.evaluate(() => __t.frame()); const s0 = await W2S(page, a), s1 = await W2S(page, b); await page.screenshot({ path: path.join(shots, name + ".png"), clip: { x: s0.x, y: s0.y, width: s1.x - s0.x, height: s1.y - s0.y } }); }

/* Escena de los casos A–F: todas las conexiones en rojo y sin puntos (para medir solo la punta) */
const SCENE = () => {
  const mk = (shape, x, y, label, extra) => newNode(shape, x, y, { label, ...(extra || {}) });
  const A = mk("rect", 200, 120, "A"), B = mk("rect", 560, 120, "B");            // A: recta
  const C = mk("rect", 200, 300, "C"), D = mk("rect", 560, 300, "D");            // B: par bidireccional
  const E = mk("rect", 200, 520, "E"), F = mk("rect", 560, 520, "F");            // C: U (n/n)
  const G = mk("rect", 200, 700, "G"), H = mk("rect", 200 + 180 + 30, 700, "H");  // D: muy corta (hueco 30)
  const I = mk("rect", 900, 120, "I"), K = mk("rect", 900, 360, "K");            // E: vertical, ninguna/inicio/fin/ambas (4 aristas)
  const e = (a, b, o) => newEdge(a.id, b.id, { route: "ortho", animated: false, lineColor: "#ff0000", ...(o || {}) });
  const out = { recta: e(A, B), ida: e(C, D, { fromSide: "e", toSide: "w" }), vuelta: e(D, C, { fromSide: "w", toSide: "e" }), u: e(E, F, { fromSide: "n", toSide: "n" }), corta: e(G, H, { startArrow: true }),
    none: e(I, K, { startArrow: false, endArrow: false }), start: e(I, K, { startArrow: true, endArrow: false }), end: e(I, K, { startArrow: false, endArrow: true }), both: e(I, K, { startArrow: true, endArrow: true }) };
  for (const k in out) out[k] = out[k].id;
  undoStack.length = 0; redoStack.length = 0; clearSel();
  return out;
};

async function desktop(browser, base) {
  const vp = { key: "d1440", width: 1440, height: 900 };
  console.log(`\n── ${vp.key} (${vp.width}×${vp.height}, ratón)`);
  const t = await open(browser, base, vp), page = t.page;
  await page.evaluate(() => __t.reset("crema"));
  const ids = await page.evaluate(SCENE);
  const all = Object.values(ids);
  const setSize = (k) => page.evaluate(([ids, k]) => { for (const id of ids) { const e = edgeById(id); if (k === null) editEdge(e, { arrowSize: null }); else editEdge(e, { arrowSize: k }); } return __t.frame(); }, [all, k]);
  const routes = () => page.evaluate((ids) => JSON.stringify(ids.map((id) => edgePoints(edgeById(id)))), all);
  const nodesJson = () => page.evaluate(() => JSON.stringify(P().nodes));

  /* ── F: 1× / 1,5× / 2× sobre los casos A–E, medido en píxeles del lienzo ── */
  const r0 = await routes(), n0 = await nodesJson();
  const table = [];
  for (const k of [1, 1.5, 2]) {
    await setSize(k);
    const cases = [["A recta →", ids.recta, "end"], ["B ida →", ids.ida, "end"], ["B vuelta ←", ids.vuelta, "end"], ["C U ┌─→", ids.u, "end"], ["D corta fin", ids.corta, "end"], ["D corta inicio", ids.corta, "start"], ["E inicio", ids.start, "start"], ["E fin", ids.end, "end"], ["E ambas·fin", ids.both, "end"], ["E ambas·inicio", ids.both, "start"]];
    let okAll = true, detail = [];
    for (const [name, id, which] of cases) {
      const m = await measureHead(page, id, which, "cv");
      const expected = 8 * k;
      const ok = m.n > 0 && Math.abs(m.across - expected) <= 1.5 && m.farDist <= 4.5 && m.farDist >= 1.5 && Math.abs(m.tipGap - 3) < 1e-6;
      okAll = okAll && ok; detail.push(`${name} ${m.across.toFixed(1)}px (esp. ${expected}) ancla−rojo ${m.farDist.toFixed(1)}`);
      table.push({ k, name, across: +m.across.toFixed(2), farDist: +m.farDist.toFixed(2) });
    }
    check(okAll, `${k}×: la punta dibujada mide 8·k = ${8 * k} px de ancho y termina a 3 px del ancla en A, B, C, D y E (${detail.join(" · ")})`);
    const none = await page.evaluate((id) => ({ heads: edgeStroke(edgeById(id), edgePoints(edgeById(id))).heads.length }), ids.none);
    check(none.heads === 0, `${k}×: Ninguna sigue sin puntas`);
    await shot(page, `d1440-${String(k).replace(".", "_")}x`, { x: 80, y: 40 }, { x: 1020, y: 780 });
    await shot(page, `d1440-${String(k).replace(".", "_")}x-zoom`, { x: 440, y: 80 }, { x: 680, y: 360 });
  }
  check((await routes()) === r0 && (await nodesJson()) === n0, "ninguna ruta (edgePoints) ni ningún nodo cambia con 1,5× o 2×");
  console.log("    medidas: " + JSON.stringify(table.filter((r) => r.name.startsWith("A") || r.name.startsWith("C") || r.name.startsWith("D corta f"))));

  /* ── T8: zoom 2 → el doble de píxeles, misma escala lógica ── */
  await setSize(2);
  const z1 = await measureHead(page, ids.recta, "end", "cv");
  await page.evaluate(() => { viewZoom = 2; viewX = -200; viewY = -100; return __t.frame(); });
  const z2 = await measureHead(page, ids.recta, "end", "cv");
  check(z1.n > 0 && z2.n > 0 && Math.abs(z2.px / z1.px - 2) <= 0.12 && Math.abs(z2.across - 16) <= 1.5, `T8: a zoom 2 la punta mide el doble de píxeles (${z1.px} → ${z2.px}) y sigue siendo 16 px de mundo (${z2.across.toFixed(1)})`);
  await page.evaluate(() => { viewZoom = 1; viewX = 60; viewY = 0; return __t.frame(); });

  /* ── Panel: segmentado, Undo, teclado, visibilidad ── */
  await setSize(null);
  await page.evaluate((id) => { selectOnly("edge", id); undoStack.length = 0; redoStack.length = 0; }, ids.recta);
  const p0 = await page.evaluate((id) => ({ ...__t.state(id), seg: __t.segVals(), row: __t.rowVisible(), label: $("arrowSizeLbl").textContent, where: !!$("rowArrowSize").closest("#grpRoute"), after: $("rowArrowSize").previousElementSibling.id }), ids.recta);
  check(p0.row && p0.label === "Tamaño de flecha" && p0.where && p0.after === "rowArrows", `«Tamaño de flecha» visible en Dirección, justo bajo Puntas (${p0.after})`);
  check(JSON.stringify(p0.seg) === JSON.stringify([["1", "true", 0], ["1.5", "false", -1], ["2", "false", -1]]), `sin arrowSize el segmentado marca 1× (${JSON.stringify(p0.seg)})`);
  await page.locator('#arrowSizeSeg .segBtn[data-v="1"]').click(); await page.waitForTimeout(60);
  const p1 = await page.evaluate((id) => __t.state(id), ids.recta);
  check(p1.e === p0.e && p1.u === 0, "clic en el valor actual (1×): no escribe ni apila Undo");
  await page.locator('#arrowSizeSeg .segBtn[data-v="1.5"]').click(); await page.waitForTimeout(60);
  const p2 = await page.evaluate((id) => ({ ...__t.state(id), seg: __t.segVals(), k: edgeById(id).arrowSize }), ids.recta);
  check(p2.k === 1.5 && p2.u === 1 && p2.seg[1][1] === "true", `clic en 1,5× → arrowSize 1.5, UNA entrada de Undo (${p2.u}), segmentado sincronizado`);
  await page.locator('#arrowSizeSeg .segBtn[data-v="2"]').click(); await page.waitForTimeout(60);
  const p3 = await page.evaluate((id) => ({ ...__t.state(id), k: edgeById(id).arrowSize }), ids.recta);
  check(p3.k === 2 && p3.u === 2, `clic en 2× → arrowSize 2, otra entrada (${p3.u})`);
  const m2 = await measureHead(page, ids.recta, "end", "cv");
  check(Math.abs(m2.across - 16) <= 1.5, `el lienzo ya la dibuja a 2× (${m2.across.toFixed(1)} px)`);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(60);
  const u1 = await page.evaluate((id) => ({ ...__t.state(id), seg: __t.segVals() }), ids.recta);
  check(u1.e === p2.e && u1.u === 1 && u1.r === 1 && u1.sel.length === 1 && u1.sel[0] === ids.recta && u1.seg[1][1] === "true", `Undo → 1,5× exacto, selección conservada, panel al día (${JSON.stringify(u1.seg)})`);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(60);
  const u2 = await page.evaluate((id) => ({ ...__t.state(id), seg: __t.segVals() }), ids.recta);
  check(u2.e === p0.e && u2.u === 0 && u2.r === 2 && u2.seg[0][1] === "true", "Undo → sin arrowSize (JSON idéntico al original), 1× marcado");
  await page.keyboard.press("Control+y"); await page.waitForTimeout(60);
  const rd = await page.evaluate((id) => __t.state(id), ids.recta);
  check(rd.e === p2.e && rd.u === 1, "Redo → 1,5× exacto");
  /* teclado: foco en el marcado, flecha derecha elige el siguiente; Inicio vuelve al primero */
  await page.focus('#arrowSizeSeg .segBtn[aria-checked="true"]'); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(60);
  const kb = await page.evaluate((id) => ({ k: edgeById(id).arrowSize, u: undoStack.length, focus: document.activeElement && document.activeElement.dataset.v }), ids.recta);
  check(kb.k === 2 && kb.u === 2 && kb.focus === "2", `teclado: flecha derecha → 2× con foco y una entrada de Undo (${JSON.stringify(kb)})`);
  await page.keyboard.press("Home"); await page.waitForTimeout(60);
  const kb2 = await page.evaluate((id) => ({ k: edgeById(id).arrowSize, u: undoStack.length }), ids.recta);
  check(kb2.k === 1 && kb2.u === 3, `teclado: Inicio → 1× (${JSON.stringify(kb2)})`);
  /* sin puntas, la fila se oculta; con Inicio vuelve */
  await page.locator('#arrowSeg .segBtn[data-v="none"]').click(); await page.waitForTimeout(60);
  const hid = await page.evaluate(() => __t.rowVisible());
  await page.locator('#arrowSeg .segBtn[data-v="start"]').click(); await page.waitForTimeout(60);
  const vis = await page.evaluate(() => __t.rowVisible());
  check(!hid && vis, `Puntas = Ninguna oculta «Tamaño de flecha»; Inicio la devuelve (${hid} → ${vis})`);
  await page.locator('#arrowSeg .segBtn[data-v="end"]').click(); await page.waitForTimeout(60);

  /* ── SVG del editor ── */
  await setSize(2);
  const svg = await page.evaluate((id) => {
    const s = buildSVGDocument(1), lines = s.split("\n").map((l) => l.trim());
    const headsD = lines.filter((l) => /^<path d="[^"]*" fill="#ff0000"\/>$/.test(l)).map((l) => l.match(/d="([^"]*)"/)[1]);
    const verts = (d) => [...d.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
    const e = edgeById(id), p = edgePoints(e), z = p[p.length - 1];
    const h = verts(headsD[0]);
    return { marker: /<marker/.test(s), n: headsD.length, len: Math.hypot(h[0].x - h[1].x, h[0].y - h[1].y), ancho: Math.hypot(h[1].x - h[3].x, h[1].y - h[3].y), gap: Math.hypot(h[0].x - z.x, h[0].y - z.y) };
  }, ids.recta);
  check(!svg.marker && svg.n === 10 && Math.abs(svg.ancho - 16) < 0.02 && Math.abs(svg.gap - 3) < 0.02, `SVG del editor a 2×: ${svg.n} puntas explícitas, sin <marker>, la primera de 22×16 (${svg.ancho.toFixed(2)}) a 3 px del ancla (${svg.gap.toFixed(2)})`);

  /* ── Eliminar / duplicar ── */
  await page.evaluate((id) => { selectOnly("edge", id); }, ids.u);
  await page.keyboard.press("Delete"); await page.waitForTimeout(80);
  const del = await page.evaluate((ids) => ({ gone: !edgeById(ids.u), rest: [ids.recta, ids.ida].map((id) => edgeById(id).arrowSize) }), ids);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(80);
  const back = await page.evaluate((id) => edgeById(id) && edgeById(id).arrowSize, ids.u);
  check(del.gone && del.rest.every((v) => v === 2) && back === 2, `eliminar la U no toca las demás (${del.rest}); deshacer la devuelve con 2×`);
  const dup = await page.evaluate((ids) => { selN.clear(); selE.clear(); selN.add(nodeById(edgeById(ids.recta).from).id); selN.add(nodeById(edgeById(ids.recta).to).id); refreshPanel(); dupSel(); const ne = [...selE].map((id) => edgeById(id)); return { n: ne.length, k: ne.map((e) => e.arrowSize), start: ne.map((e) => !!e.startArrow) }; }, ids);
  check(dup.n === 1 && dup.k[0] === 2, `duplicar A→B conserva arrowSize (${JSON.stringify(dup.k)})`);
  await page.keyboard.press("Control+z"); await page.waitForTimeout(80);

  /* ── Present: el mismo trazo ── */
  const before = await page.evaluate((id) => JSON.stringify(edgeStroke(edgeById(id), edgePoints(edgeById(id)))), ids.recta);
  await page.locator("#btnPresent").click(); await page.waitForTimeout(300);
  const pres = await page.evaluate((id) => ({ presenting, s: JSON.stringify(edgeStroke(edgeById(id), edgePoints(edgeById(id)))), k: edgeById(id).arrowSize }), ids.recta);
  check(pres.presenting && pres.s === before && pres.k === 2, "Present: la misma punta a 2× (edgeStroke idéntico; el documento no cambia)");
  const presPx = await measureHead(page, ids.recta, "end", "cv");
  check(presPx.n > 0 && Math.abs(presPx.across - 16) <= 1.5, `Present dibuja la punta grande (${presPx.across.toFixed(1)} px de mundo a zoom ${presPx.zoom})`);
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  if (await page.evaluate(() => presenting)) await page.evaluate(() => { if (typeof exitPresent === "function") exitPresent(); });

  /* ── Share → Viewer ── */
  const url = await page.evaluate(async (b) => createShareUrl(serializeProject(), b + "/s/"), base);
  const v = await t.ctx.newPage(); v.on("pageerror", (e) => t.errors.push("viewer: " + e.message)); v.on("console", (m) => { if (m.type() === "error") t.errors.push("viewer: " + m.text()); });
  await v.goto(url.replace(/^https?:\/\/[^/]+/, base));
  await v.waitForFunction(() => typeof viewerPhase !== "undefined" && viewerPhase === "ready", null, { timeout: 15000 });
  const vw = await v.evaluate(async (id) => {
    const e = doc.pages[doc.cur].edges.find((x) => x.id === id);
    playing = false; for (const x of doc.pages[doc.cur].edges) x.animated = false;
    view.zoom = 1; view.x = 60; view.y = 0;
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const p = edgePoints(e), st = edgeStroke(e, p), h = st.heads[0], base = { x: (h[1].x + h[3].x) / 2, y: (h[1].y + h[3].y) / 2 };
    const half = Math.hypot(h[1].x - h[3].x, h[1].y - h[3].y) / 2, u = { x: h[0].x - base.x, y: h[0].y - base.y }, L = Math.hypot(u.x, u.y); u.x /= L; u.y /= L;
    const n = { x: -u.y, y: u.x }, r = half + 3;   // la punta entera, de la base a la punta: su extensión perpendicular es el ancho de la base
    const d = sv.width / sv.getBoundingClientRect().width, bmp = (q) => ({ x: (view.x + q.x * view.zoom) * d, y: (view.y + q.y * view.zoom) * d });
    const a = bmp({ x: base.x - u.x * 0.5 - n.x * r, y: base.y - u.y * 0.5 - n.y * r }), b = bmp({ x: h[0].x + n.x * r, y: h[0].y + n.y * r });
    const X = Math.round(Math.min(a.x, b.x)), Y = Math.round(Math.min(a.y, b.y)), W = Math.round(Math.abs(b.x - a.x)), H = Math.round(Math.abs(b.y - a.y));
    const px = sv.getContext("2d").getImageData(X, Y, W, H).data; let y0 = 1e9, y1 = -1, cnt = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; if (px[k] > 100 && px[k + 1] < 150 && px[k + 2] < 150 && px[k] - px[k + 1] > 60) { cnt++; y0 = Math.min(y0, j); y1 = Math.max(y1, j); } }
    return { k: e.arrowSize, cnt, across: cnt ? (y1 - y0 + 1) / d / view.zoom : 0, half };
  }, ids.recta);
  check(vw.k === 2 && vw.half === 8, `Viewer: el documento compartido llega con arrowSize 2 y edgeStroke la calcula a 22×16 (half ${vw.half})`);
  check(vw.cnt > 0 && Math.abs(vw.across - 16) <= 1.5, `Viewer: la dibuja grande en su lienzo (${vw.across.toFixed(1)} px de mundo)`);
  await v.screenshot({ path: path.join(shots, "d1440-viewer-2x.png") });
  await v.close();

  check(t.errors.length === 0, `0 errores (${t.errors.join(" | ")})`);
  await t.ctx.close();
}

async function mobile(browser, base) {
  const vp = { key: "m390", width: 390, height: 844, touch: true, mobile: true };
  console.log(`\n── ${vp.key} (${vp.width}×${vp.height}, dedo)`);
  const t = await open(browser, base, vp), page = t.page;
  await page.evaluate(() => __t.reset("dark"));
  const ids = await page.evaluate(SCENE);
  await page.evaluate((id) => { selectOnly("edge", id); openSurface("properties"); undoStack.length = 0; redoStack.length = 0; }, ids.recta);
  await page.waitForTimeout(250);
  /* en la hoja los grupos son un acordeón (decisión 136): Dirección empieza plegado */
  if (!(await page.evaluate(() => $("grpRoute").open))) { await page.locator("#grpRoute > summary").tap(); await page.waitForTimeout(200); }
  const btn = page.locator('#arrowSizeSeg .segBtn[data-v="2"]');
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  const vis = await page.evaluate(() => __t.rowVisible() && document.body.classList.contains("panelOpen") && $("grpRoute").open);
  check(vis, "la hoja de Propiedades enseña «Tamaño de flecha» (Dirección abierto en el acordeón)");
  const bb = await btn.boundingBox();
  check(bb && Math.min(bb.width, bb.height) >= 40, `botón táctil ≥ 40 px (${bb && Math.round(bb.width)}×${bb && Math.round(bb.height)})`);
  await btn.tap(); await page.waitForTimeout(80);
  const r = await page.evaluate((id) => ({ k: edgeById(id).arrowSize, u: undoStack.length, seg: __t.segVals() }), ids.recta);
  check(r.k === 2 && r.u === 1 && r.seg[2][1] === "true", `un toque en 2× → arrowSize 2, una entrada de Undo (${JSON.stringify(r)})`);
  await page.screenshot({ path: path.join(shots, "m390-panel.png") });
  check(t.errors.length === 0, `0 errores (${t.errors.join(" | ")})`);
  await t.ctx.close();
}

(async () => {
  const t0 = Date.now();
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  try {
    if (!ONLY || ONLY.split(",").includes("d1440")) await desktop(browser, base);
    if (!ONLY || ONLY.split(",").includes("m390")) await mobile(browser, base);
  } finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.27 browser: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
