"use strict";
/* FLUYO-018.14a — Chrome REAL: nodos `code` y BD, tipografía y Viewer, en lienzo → SVG → Viewer → exportación.
   1440 y 1280 con ratón; 768, 390 y 375 táctiles; tema oscuro y crema del documento. Se leen los píxeles de los propios
   lienzos (editor, Viewer y SVG rasterizado en un <canvas>), no capturas:
     · BD: un corte vertical por el centro de la tapa cruza el borde DOS veces (arco trasero + labio; antes eran tres);
     · sin cian estructural (#3aa7e8) en lienzo, SVG ni Viewer, con y sin selección; la selección es oliva;
     · `code`: sin cajas verdes por defecto; con `kwBg` explícito, su caja sí; IBM Plex Mono cargada y en uso;
     · fuentes: documentos con fuentes históricas intactos; la global nueva se guarda y se reabre; el selector agrupa;
       el Viewer arranca con las fuentes del documento cargadas; exportar a PNG espera a las fuentes antes de pintar;
     · Viewer: tokens del sistema, cabecera de una fila, sin peticiones a terceros, 0 errores.
   Uso: node test/fluyo-018-14a-browser.cjs   (Playwright vía NODE_PATH; FLUYO_SHOTS=<dir>; ONLY=d1440|d1280|t768|m390|m375) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-14a-"));
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
const PLAYFAIR = "'Playfair Display', Georgia, serif";

const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      const body = fs.readFileSync(file);   // primero leer: un 404 no puede escribir cabeceras dos veces
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const VIEWPORTS = [
  { key: "d1440", width: 1440, height: 900 }, { key: "d1280", width: 1280, height: 800 },
  { key: "t768", width: 768, height: 1024, touch: true }, { key: "m390", width: 390, height: 844, touch: true, mobile: true },
  { key: "m375", width: 375, height: 667, touch: true, mobile: true },
];

/* Utilidades de píxel, inyectadas en cada página: trabajan sobre ImageData de un <canvas>. */
const PIX = `
window.__px = {
  near: (d, i, ref, tol) => Math.abs(d[i]-ref[0]) + Math.abs(d[i+1]-ref[1]) + Math.abs(d[i+2]-ref[2]) <= tol,
  /* cuántas veces una columna de 3 px cruza un color (tramos separados) */
  crossings(cv, x, y0, y1, ref, tol=70){
    const c = cv.getContext("2d"), W = cv.width, H = cv.height, xs = [x-1, x, x+1].map(Math.round).filter(v => v >= 0 && v < W);
    const ya = Math.max(0, Math.round(y0)), yb = Math.min(H, Math.round(y1)); if (yb <= ya || !xs.length) return -1;
    const d = c.getImageData(xs[0], ya, xs.length, yb - ya).data; let n = 0, inside = false;
    for (let y = 0; y < yb - ya; y++) { let hit = false; for (let k = 0; k < xs.length; k++) if (this.near(d, (y*xs.length+k)*4, ref, tol)) hit = true; if (hit && !inside) n++; inside = hit; }
    return n;
  },
  /* y (en px del respaldo) donde empieza cada tramo del color en la columna */
  runs(cv, x, y0, y1, ref, tol=70){
    const c = cv.getContext("2d"), W = cv.width, H = cv.height, xs = [x-1, x, x+1].map(Math.round).filter(v => v >= 0 && v < W);
    const ya = Math.max(0, Math.round(y0)), yb = Math.min(H, Math.round(y1)); if (yb <= ya || !xs.length) return [];
    const d = c.getImageData(xs[0], ya, xs.length, yb - ya).data, out = []; let inside = false, start = 0;
    for (let y = 0; y < yb - ya; y++) { let hit = false; for (let k = 0; k < xs.length; k++) if (this.near(d, (y*xs.length+k)*4, ref, tol)) hit = true;
      if (hit && !inside) start = y; if (!hit && inside) out.push((start + y - 1) / 2 + ya); inside = hit; }
    if (inside) out.push((start + yb - ya - 1) / 2 + ya);
    return out;
  },
  /* píxeles de una familia de color en un rectángulo (en px del respaldo) */
  count(cv, rect, test){
    const c = cv.getContext("2d"); const [x, y, w, h] = rect.map(Math.round); const X = Math.max(0, x), Y = Math.max(0, y), W = Math.min(cv.width - X, w), H = Math.min(cv.height - Y, h);
    if (W <= 0 || H <= 0) return 0; const d = c.getImageData(X, Y, W, H).data; let n = 0;
    for (let i = 0; i < d.length; i += 8) if (test(d[i], d[i+1], d[i+2])) n++;
    return n;
  },
  cyan(r, g, b){ const mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mx < 150 || (mx - mn) / mx < .55) return false; let h; if (mx === b) h = 240 + 60*(r-g)/(mx-mn); else if (mx === g) h = 120 + 60*(b-r)/(mx-mn); else return false; return h >= 180 && h <= 225; },
  green(r, g, b){ return Math.abs(r-0xa8) + Math.abs(g-0xb3) + Math.abs(b-0x4a) <= 45; },
};`;

const SETUP = (theme) => {
  doc.pages = [blankPage("QA nodos")]; doc.cur = 0; setThemeIn(doc, { theme });
  const c1 = newNode("code", 220, 140); c1.label = "SELECT id, total\nFROM pagos\nWHERE estado = 'ok'";
  const c2 = newNode("code", 640, 150); c2.label = "SELECT cliente.nombre, SUM(pedido.total) AS gasto\nFROM cliente JOIN pedido ON pedido.cliente_id = cliente.id\nWHERE pedido.fecha > NOW() - INTERVAL '30 days'\nGROUP BY cliente.nombre ORDER BY gasto DESC LIMIT 20"; c2.w = 430; c2.h = 160;
  const a = newNode("rect", 150, 420); a.label = "API";
  /* FLUYO-018.15: las BD llevan un color EXPLÍCITO y saturado; el detector de la tapa no puede depender del color con el
     que nace un nodo (hoy un neutro, que se confunde con el antialiasing del texto) */
  const b = newNode("cylinder", 420, 420, { color: "#6a9fb5" }); b.label = "Pagos";
  const d = newNode("rect", 690, 420); d.label = "Worker";
  const b2 = newNode("cylinder", 420, 610, { color: "#6a9fb5" }); b2.label = "Réplica";
  const c4 = newNode("code", 760, 610); c4.label = "SELECT *\nFROM pagos"; c4.kwBg = "#a8b34a";   // dato explícito: su caja se respeta
  newEdge(a.id, b.id); newEdge(b.id, d.id);
  selN.clear(); selE.clear(); renderTabs(); fitView();
  return { c1: c1.id, c2: c2.id, b: b.id, b2: b2.id, c4: c4.id, a: a.id, d: d.id };
};
/* Encuadra un nodo a un zoom fijo (la tapa tiene que medir lo bastante para contar trazos). */
const FOCUS = ([id, z]) => { const n = P().nodes.find((x) => x.id === id), r = cv.getBoundingClientRect(); viewZoom = z; viewX = r.width / 2 - n.x * z; viewY = r.height / 2 - n.y * z; return true; };
const nodeRectPx = (page, id, pad = 0) => page.evaluate(([id, pad]) => { const n = P().nodes.find((x) => x.id === id), d = cv.fluyoDpr || 1;
  return [(viewX + (n.x - n.w / 2 - pad) * viewZoom) * d, (viewY + (n.y - n.h / 2 - pad) * viewZoom) * d, (n.w + 2 * pad) * viewZoom * d, (n.h + 2 * pad) * viewZoom * d]; }, [id, pad]);
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function open(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", acceptDownloads: true });
  const external = [];
  await ctx.route((u) => !u.href.startsWith(base), (r) => { external.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/javascript", body: "" }); });
  await ctx.addInitScript(PIX);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof newNode === "function" && typeof renderTabs === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  return { ctx, page, errors, external };
}

async function journey(browser, base, vp, theme) {
  console.log(`\n${vp.key} · tema ${theme}`);
  const t = await open(browser, base, vp); const { page } = t;
  const ids = await page.evaluate(SETUP, theme); await page.waitForTimeout(300);
  const stroke = [0x6a, 0x9f, 0xb5], ink = theme === "dark" ? [0xc3, 0xcd, 0xa4] : [0x4e, 0x5a, 0x3f];
  const zoom = vp.mobile ? 1.1 : 1.4;

  /* ── BD: una tapa ── */
  await page.evaluate(FOCUS, [ids.b2, zoom]); await frame(page);
  const capC = await page.evaluate((stroke) => { const n = P().nodes.find((x) => x.shape === "cylinder" && x.label === "Réplica"), d = cv.fluyoDpr || 1;
    const x = (viewX + n.x * viewZoom) * d, top = (viewY + (n.y - n.h / 2) * viewZoom) * d;
    return __px.crossings(cv, x, top - 12 * d, top + (Math.min(16, n.h * .18) * 2 + 10) * viewZoom * d, stroke); }, stroke);
  check(capC === 2, `lienzo: la tapa de la BD se cruza ${capC} veces (arco trasero + labio, sin segunda línea)`);
  /* perfil vertical completo: tapa (arriba), labio, base (abajo), en su sitio */
  const prof = await page.evaluate((stroke) => { const n = P().nodes.find((x) => x.shape === "cylinder" && x.label === "Réplica"), d = cv.fluyoDpr || 1, z = viewZoom * d;
    const top = (viewY + (n.y - n.h / 2) * viewZoom) * d, bot = (viewY + (n.y + n.h / 2) * viewZoom) * d, ry = Math.min(16, n.h * .18) * z;
    const r = __px.runs(cv, (viewX + n.x * viewZoom) * d, top - 8 * d, bot + 8 * d, stroke).filter((y) => y < (viewY + (n.y - 8) * viewZoom) * d || y > (viewY + (n.y + 8) * viewZoom) * d);
    return { r, top, bot, ry, tol: 3 * z + 2 }; }, stroke);
  const profOk = (p) => p.r.length === 3 && Math.abs(p.r[0] - p.top) <= p.tol && Math.abs(p.r[1] - (p.top + 2 * p.ry)) <= p.tol && Math.abs(p.r[2] - p.bot) <= p.tol;
  check(profOk(prof), `lienzo: perfil de la BD = tapa, labio y base en su sitio ${JSON.stringify(prof.r.map(Math.round))} (tapa ${Math.round(prof.top)}, base ${Math.round(prof.bot)})`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-${theme}-bd.png`) });

  /* ── code: sin cajas verdes por defecto; con kwBg explícito, sí; Plex Mono ── */
  await page.evaluate(FOCUS, [ids.c1, zoom * .8]); await frame(page);
  const r1 = await nodeRectPx(page, ids.c1);
  const code = await page.evaluate(([r, ink]) => ({ green: __px.count(cv, r, __px.green), kw: __px.count(cv, r, (R, G, B) => Math.abs(R - ink[0]) + Math.abs(G - ink[1]) + Math.abs(B - ink[2]) <= 60),
    font: codeFont(P().nodes.find((n) => n.shape === "code")), plex: document.fonts.check("500 16px 'IBM Plex Mono'") && document.fonts.check("400 16px 'IBM Plex Mono'") }), [r1, ink]);
  check(code.green === 0, `code por defecto: ninguna caja verde de palabra clave (${code.green} px)`);
  check(code.kw > 20, `code por defecto: la palabra clave se pinta en oliva (${code.kw} px)`);
  check(/^'IBM Plex Mono'/.test(code.font) && code.plex, "code por defecto: IBM Plex Mono, cargada en 400 y 500");
  await page.screenshot({ path: path.join(shots, `${vp.key}-${theme}-code.png`) });
  await page.evaluate(FOCUS, [ids.c4, zoom * .8]); await frame(page);
  const g4 = await page.evaluate((r) => __px.count(cv, r, __px.green), await nodeRectPx(page, ids.c4));
  check(g4 > 50, `code con kwBg explícito: su caja se respeta (${g4} px)`);
  await page.evaluate(FOCUS, [ids.c2, vp.mobile ? .7 : 1]); await frame(page);
  const r2 = await nodeRectPx(page, ids.c2);
  const g2 = await page.evaluate((r) => __px.count(cv, r, __px.green), r2);
  check(g2 === 0, "code con texto largo: sin cajas verdes");
  await page.screenshot({ path: path.join(shots, `${vp.key}-${theme}-code-largo.png`) });

  /* ── cian estructural: ni sin selección ni con selección; la selección es oliva ── */
  await page.evaluate(() => fitView()); await frame(page);
  const whole = await page.evaluate(() => [0, 0, cv.width, cv.height]);
  const cyan0 = await page.evaluate((r) => __px.count(cv, r, __px.cyan), whole);
  await page.evaluate((ids) => { selN.add(ids.c1); selN.add(ids.b); refreshPanel(); }, ids);
  await page.evaluate(FOCUS, [ids.b, zoom]); await frame(page);   // la selección se mide con la BD a un zoom legible
  const sel = await page.evaluate(([r, ink]) => ({ cyan: __px.count(cv, r, __px.cyan), ink: __px.count(cv, r, (R, G, B) => Math.abs(R - ink[0]) + Math.abs(G - ink[1]) + Math.abs(B - ink[2]) <= 40) }), [whole, ink]);
  check(cyan0 === 0 && sel.cyan === 0, `sin cian estructural en el lienzo (sin selección ${cyan0}, con selección ${sel.cyan})`);
  check(sel.ink > 50, `la selección de code y BD es oliva (${sel.ink} px)`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-${theme}-seleccion.png`) });
  await page.evaluate(() => { selN.clear(); refreshPanel(); });

  /* ── SVG: misma geometría y colores; rasterizado en un <canvas> ── */
  const svg = await page.evaluate(() => buildSVGDocument(1));
  const grp = (id) => { const i = svg.indexOf(`<g id="node-${id}"`); const j = svg.indexOf(`<g id="node-`, i + 1); return i < 0 ? "" : svg.slice(i, j < 0 ? undefined : j); };
  const svgOk = [ids.b, ids.b2].every((id) => { const g = grp(id); return g && !/<ellipse/.test(g) && !/ C /.test(g) && (g.match(/<path /g) || []).length === 2; });
  check(svgOk, "SVG: cada BD es contorno + labio de arcos, sin <ellipse> ni Bézier");
  check(!/#a8b34a/i.test(grp(ids.c1)) && !/#a8b34a/i.test(grp(ids.c2)) && /#a8b34a/i.test(grp(ids.c4)), "SVG: sin cajas verdes salvo el kwBg explícito");
  check(/font-family="&apos;IBM Plex Mono&apos;/.test(grp(ids.c1)) && /font-weight="500"/.test(grp(ids.c1)), "SVG: el bloque usa IBM Plex Mono y la palabra clave peso 500");
  check(!/3aa7e8|58,167,232/i.test(svg), "SVG: sin cian");
  const svgPx = await page.evaluate(async ([svg, stroke]) => {
    const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); await img.decode();
    /* el SVG exportado no lleva fondo: se compone sobre el del tema, como lo vería quien lo abra en la app */
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x2 = c.getContext("2d"); x2.fillStyle = THEMES[doc.theme].bg; x2.fillRect(0, 0, c.width, c.height); x2.drawImage(img, 0, 0);
    const n = P().nodes.find((x) => x.shape === "cylinder" && x.label === "Réplica"), top = n.y - n.h / 2;
    const bot = n.y + n.h / 2, ry = Math.min(16, n.h * .18);
    const r = __px.runs(c, n.x, top - 8, bot + 8, stroke).filter((y) => y < n.y - 8 || y > n.y + 8);
    return { cap: __px.crossings(c, n.x, top - 10, top + 50, stroke), cyan: __px.count(c, [0, 0, c.width, c.height], __px.cyan), prof: { r, top, bot, ry, tol: 4 } };
  }, [svg, stroke]);
  check(svgPx.cap === 2 && svgPx.cyan === 0, `SVG rasterizado: la tapa se cruza ${svgPx.cap} veces y hay ${svgPx.cyan} px de cian`);
  check(profOk(svgPx.prof), `SVG rasterizado: mismo perfil que el lienzo (tapa, labio, base) ${JSON.stringify(svgPx.prof.r.map(Math.round))}`);

  /* ── Fuentes: el documento con la global nueva se guarda y se reabre igual ── */
  if (theme === "crema") {
    const sel2 = await page.evaluate((pf) => { const s = document.getElementById("fontGlobalSel"); s.value = pf; s.dispatchEvent(new Event("change")); return { v: settings.font, groups: [...s.querySelectorAll("optgroup")].map((g) => g.label + ":" + g.children.length) }; }, PLAYFAIR);
    check(sel2.v === PLAYFAIR && sel2.groups.join() === "Fluyo:2,Clásicas:12", `selector: «Fluyo» (2) y «Clásicas» (12); elegir Playfair guarda su pila (${sel2.groups})`);
    const rt = await page.evaluate(() => { const before = JSON.stringify(serializeProject()); applyProjectData(JSON.parse(before)); return { same: JSON.stringify(serializeProject()) === before, font: settings.font }; });
    check(rt.same && rt.font === PLAYFAIR, "guardar y reabrir conserva la global nueva sin tocar nada más");
  }

  /* ── Viewer: misma geometría, fuentes cargadas antes de pintar, sistema visual ── */
  await page.evaluate((ids) => { const keep = new Set([ids.c1, ids.b2, ids.c4]); P().nodes = P().nodes.filter((n) => keep.has(n.id)); P().edges = []; }, ids);
  const url = await page.evaluate(async (b) => createShareUrl(serializeProject(), b + "/s/"), base);
  const v = await t.ctx.newPage(); const vext = [];
  v.on("pageerror", (e) => t.errors.push(vp.key + " viewer: " + e.message)); v.on("console", (m) => { if (m.type() === "error") t.errors.push(vp.key + " viewer: " + m.text()); });
  await v.goto(url.replace(/^https?:\/\/[^/]+/, base));
  await v.waitForFunction(() => typeof viewerPhase !== "undefined" && viewerPhase === "ready");
  const vr = await v.evaluate(([stroke, theme]) => {
    const fonts = (f) => document.fonts.check(f);
    const n = doc.pages[doc.cur].nodes.find((x) => x.shape === "cylinder"), c4 = doc.pages[doc.cur].nodes.find((x) => x.shape === "code" && x.kwBg);
    const c1 = doc.pages[doc.cur].nodes.find((x) => x.shape === "code" && !x.kwBg), V = window.__viewer.view, d = sv.width / sv.getBoundingClientRect().width;
    const rect = (m) => [(V.x + (m.x - m.w / 2) * V.zoom) * d, (V.y + (m.y - m.h / 2) * V.zoom) * d, m.w * V.zoom * d, m.h * V.zoom * d];
    const top = (V.y + (n.y - n.h / 2) * V.zoom) * d;
    const probe = document.createElement("i"); probe.style.background = "var(--surface)"; document.body.appendChild(probe);
    const surface = getComputedStyle(probe).backgroundColor; probe.remove();
    const h = document.getElementById("chrome").getBoundingClientRect().height;
    return {
      plex: fonts("400 16px 'IBM Plex Mono'") && fonts("500 16px 'IBM Plex Mono'"), playfair: fonts("16px 'Playfair Display'"), zoom: V.zoom,
      cap: __px.crossings(sv, (V.x + n.x * V.zoom) * d, top - 12 * d, top + (Math.min(16, n.h * .18) * 2 + 10) * V.zoom * d, stroke),
      cyan: __px.count(sv, [0, 0, sv.width, sv.height], __px.cyan), green1: __px.count(sv, rect(c1), __px.green), green4: __px.count(sv, rect(c4), __px.green),
      header: getComputedStyle(document.getElementById("chrome")).backgroundColor === surface, headerH: h,
      logo: getComputedStyle(document.querySelector("#chrome .logo")).fontFamily, ui: getComputedStyle(document.getElementById("btnOpen")).fontFamily,
      theme: doc.theme, font: settings.font,
    };
  }, [stroke, theme]);
  check(vr.plex && (theme !== "crema" || vr.playfair), "Viewer: al estar listo ya están cargadas las fuentes del documento (Plex 400/500 del bloque code" + (theme === "crema" ? " y Playfair, la global" : "") + ")");
  if (theme === "crema") check(vr.font === PLAYFAIR, "Viewer: el documento llega con la global nueva");
  check(vr.zoom < .5 || vr.cap === 2, `Viewer: la tapa se cruza ${vr.cap} veces (zoom ${vr.zoom.toFixed(2)})`);
  check(vr.cyan === 0 && vr.green1 === 0 && vr.green4 > 20, `Viewer: sin cian (${vr.cyan}), sin caja verde por defecto (${vr.green1}) y con la explícita (${vr.green4})`);
  check(vr.header && vr.headerH <= 56 && /Playfair Display/.test(vr.logo) && /IBM Plex Mono/.test(vr.ui), `Viewer: sistema visual (papel, Playfair, Plex) y cabecera de una fila (${Math.round(vr.headerH)} px)`);
  await v.screenshot({ path: path.join(shots, `${vp.key}-${theme}-viewer.png`) });
  await v.close();
  check(t.external.every((u) => /gif\.js/.test(u)), "sin peticiones a terceros salvo gif.js " + JSON.stringify([...new Set(t.external)]));
  check(t.errors.length === 0, "0 errores de consola/página " + JSON.stringify(t.errors));
  await t.ctx.close();
}

/* Documentos con fuentes históricas: se abren y se guardan exactamente igual. Exportar a PNG espera a las fuentes. */
async function compatibility(browser, base) {
  console.log("\nCompatibilidad de fuentes y exportación");
  const t = await open(browser, base, VIEWPORTS[0]); const { page } = t;
  const old = await page.evaluate(() => {
    doc.pages = [blankPage("Histórico")]; doc.cur = 0;
    const a = newNode("rect", 200, 200); a.label = "Courier"; a.font = "'Courier New', Courier, monospace";
    const b = newNode("code", 500, 200); b.label = "SELECT 1"; b.font = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
    settings.font = "'Trebuchet MS', Tahoma, sans-serif"; renderTabs();
    const before = serializeProject(); applyProjectData(JSON.parse(JSON.stringify(before))); const after = serializeProject();
    return { same: JSON.stringify(before) === JSON.stringify(after), global: after.settings.font, fonts: after.doc.pages[0].nodes.map((n) => n.font), code: codeFont(P().nodes[1]) };
  });
  check(old.same && old.global === "'Trebuchet MS', Tahoma, sans-serif", "documento con fuentes históricas: se reabre idéntico (global Trebuchet)");
  check(old.code === 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace', "un code con «Mono» explícita la conserva (no se cambia a Plex)");
  const unknown = await page.evaluate(() => { applyProjectData({ ...serializeProject(), settings: { ...serializeProject().settings, font: "'Inventada', serif" } }); return settings.font; });
  check(unknown === "Georgia, serif", "una global desconocida cae a Georgia, como siempre");
  /* exportar a PNG: primero se esperan las fuentes, luego se rasteriza */
  await page.evaluate(() => {
    window.__order = [];
    const w = window.waitForRenderFonts, s = window.exportStatic;
    window.waitForRenderFonts = (...a) => { window.__order.push("fuentes"); return w(...a).then((r) => { window.__order.push("cargadas"); return r; }); };
    window.exportStatic = (...a) => { window.__order.push("rasterizar"); return s(...a); };
  });
  await page.locator("#btnExport").click(); await page.locator("#exFmt").selectOption("png");
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }).catch(() => null), page.locator("#exGo").click()]);
  const order = await page.evaluate(() => window.__order);
  check(JSON.stringify(order) === '["fuentes","cargadas","rasterizar"]' && !!dl, "exportar a PNG espera a las fuentes del documento antes de rasterizar " + JSON.stringify(order));
  check(t.errors.length === 0, "0 errores " + JSON.stringify(t.errors));
  await t.ctx.close();
}

(async () => {
  const wt = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS) if (!process.env.ONLY || process.env.ONLY === vp.key) for (const theme of ["dark", "crema"]) await journey(browser, wt.base, vp, theme);
    if (!process.env.ONLY || process.env.ONLY === "compat") await compatibility(browser, wt.base);
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  finally { await browser.close(); wt.server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})();
