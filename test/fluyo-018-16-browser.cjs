"use strict";
/* FLUYO-018.16 — Chrome REAL: la gramática de las conexiones en editor, SVG, Viewer e Historia.
   6 viewports (1440, 1280, 1101 con ratón; 768 táctil; 390 y 375 móviles) × interfaz clara/oscura × lienzo claro,
   crema y oscuro (36 celdas). Se leen píxeles de los propios lienzos, no capturas:
     · normal: la línea es estructura (color del tema; lineColor explícito intacto), sin oliva ni cian;
     · seleccionada: la línea conserva su color; funda oliva debajo; codos visibles SOLO con la conexión seleccionada,
       del mismo tamaño en pantalla a zoom 0,6 y 1,6;
     · conectar: con ratón, puerto único en el lado que mira al cursor y arrastre real → conexión con lado fijado; con
       el dedo, ningún puerto y «Conectar» → tocar destino;
     · acertar una conexión a zoom bajo: a 4 px de la línea con ratón y con el dedo (antes 8 u de mundo = 2,8 px);
     · SVG del editor: las conexiones son, byte a byte, las del golden compartido con export_diagram (MCP = editor);
     · Viewer: mismas conexiones, sin funda ni instrumentos; Historia real sin cian;
     · sin desbordamiento horizontal; objetivos táctiles de la barra ≥ 40 px; 0 errores.
   Uso: node test/fluyo-018-16-browser.cjs   (Playwright vía NODE_PATH; FLUYO_SHOTS=<dir>; ONLY=d1440|…; FAST=1) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-16-"));
fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
const FX = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/fluyo-018-16-conexiones.json"), "utf8"));
const GOLDEN = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/fluyo-018-16-conexiones-svg.json"), "utf8"));
const FX17 = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"), "utf8"));
const EDGE = { dark: "#777777", crema: "#8a8275", claro: "#888888" };
/* las líneas de un SVG que dibujan conexiones: la misma función que fluyo-mcp/test/fluyo-018-16.test.ts */
function connectorLines(svg) {
  return svg.split("\n").map((l) => l.trim()).filter((l) =>
    /^<path d="[^"]*" fill="none" stroke="[^"]*" stroke-width="1\.5"[^>]*\/>$/.test(l) || /^<path d="[^"]*" fill="[^"]*"\/>$/.test(l));
}

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
  { key: "d1440", width: 1440, height: 900 }, { key: "d1280", width: 1280, height: 800 }, { key: "d1101", width: 1101, height: 800 },
  { key: "t768", width: 768, height: 1024, touch: true }, { key: "m390", width: 390, height: 844, touch: true, mobile: true },
  { key: "m375", width: 375, height: 667, touch: true, mobile: true },
];
const PIX = `
window.__px = {
  rgb: (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
  count(cv, rect, test){
    const c = cv.getContext("2d"); const [x, y, w, h] = rect.map(Math.round); const X = Math.max(0, x), Y = Math.max(0, y), W = Math.min(cv.width - X, w), H = Math.min(cv.height - Y, h);
    if (W <= 0 || H <= 0) return 0; const d = c.getImageData(X, Y, W, H).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i+1], d[i+2])) n++;
    return n;
  },
  /* caja (en px del lienzo) de los píxeles que pasan el test */
  bbox(cv, rect, test){
    const c = cv.getContext("2d"); const [x, y, w, h] = rect.map(Math.round); const X = Math.max(0, x), Y = Math.max(0, y), W = Math.min(cv.width - X, w), H = Math.min(cv.height - Y, h);
    const d = c.getImageData(X, Y, W, H).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; if (test(d[k], d[k+1], d[k+2])) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); } }
    return x1 < 0 ? null : [x1 - x0 + 1, y1 - y0 + 1];
  },
  cyan(r, g, b){ const mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mx < 150 || (mx - mn) / mx < .55) return false; let h; if (mx === b) h = 240 + 60*(r-g)/(mx-mn); else if (mx === g) h = 120 + 60*(b-r)/(mx-mn); else return false; return h >= 180 && h <= 225; },
  near(ref, tol){ return (r, g, b) => Math.abs(r-ref[0]) + Math.abs(g-ref[1]) + Math.abs(b-ref[2]) <= tol; },
  hue(r, g, b){ const mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mx === mn) return -1; let h; if (mx === r) h = 60*((g-b)/(mx-mn)); else if (mx === g) h = 120 + 60*(b-r)/(mx-mn); else h = 240 + 60*(r-g)/(mx-mn); return (h + 360) % 360; },
  /* marcas del editor (oliva de activo): su tinta o la funda —la tinta al 26 % (oscuro) / 20 % sobre el fondo— */
  mark(theme){ const ink = theme === "dark" ? [0xc3, 0xcd, 0xa4] : [0x4e, 0x5a, 0x3f], bg = theme === "dark" ? [0x16, 0x16, 0x16] : theme === "crema" ? [0xf4, 0xee, 0xe1] : [255, 255, 255], a = theme === "dark" ? .26 : .20;
    const sl = bg.map((v, i) => Math.round(ink[i] * a + v * (1 - a))); const ni = __px.near(ink, 40), ns = __px.near(sl, 12); return (r, g, b) => ni(r, g, b) || ns(r, g, b); },
  /* solo la tinta oliva (para comprobar AUSENCIAS: la funda sobre fondo claro se parece a un gris de antialiasing) */
  ink(theme){ const n = __px.near(theme === "dark" ? [0xc3, 0xcd, 0xa4] : [0x4e, 0x5a, 0x3f], 30); return (r, g, b) => n(r, g, b) && g - b >= 14 && g >= r; },   /* con croma oliva: un gris de texto no cuenta */
  /* el píxel más alejado del fondo en una ventana que cruza la línea */
  core(cv, x, y, bg, vertical){
    const c = cv.getContext("2d"), X = Math.max(0, Math.round(x) - (vertical ? 7 : 1)), Y = Math.max(0, Math.round(y) - (vertical ? 1 : 7)), W = vertical ? 15 : 3, H = vertical ? 3 : 15;
    const d = c.getImageData(X, Y, W, H).data; let best = null, bd = -1;
    for (let i = 0; i < d.length; i += 4) { const p = [d[i], d[i+1], d[i+2]], k = Math.abs(p[0]-bg[0]) + Math.abs(p[1]-bg[1]) + Math.abs(p[2]-bg[2]); if (k > bd) { bd = k; best = p; } }
    return best;
  },
};`;
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const activeInk = (theme) => theme === "dark" ? [0xc3, 0xcd, 0xa4] : [0x4e, 0x5a, 0x3f];
const BG = { dark: [0x16, 0x16, 0x16], crema: [0xf4, 0xee, 0xe1], claro: [255, 255, 255] };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const close = (got, hex, tol = 50) => got && Math.abs(got[0] - rgb(hex)[0]) + Math.abs(got[1] - rgb(hex)[1]) + Math.abs(got[2] - rgb(hex)[2]) <= tol;

async function open(browser, base, vp, ui) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block" });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await ctx.addInitScript(PIX);
  await ctx.addInitScript((ui) => { try { if (ui === "dark") localStorage.setItem("fluyo.ui.theme", "dark"); } catch {} }, ui);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof newNode === "function" && typeof renderTabs === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  return { ctx, page, errors };
}
/* Encuadra el punto del mundo (wx, wy) en el centro del lienzo a zoom z. */
const focus = (page, wx, wy, z) => page.evaluate(([wx, wy, z]) => { const r = cv.getBoundingClientRect(); viewZoom = z; viewX = r.width / 2 - wx * z; viewY = r.height / 2 - wy * z; }, [wx, wy, z]).then(() => frame(page));
/* Punto del mundo → coordenadas de pantalla (px CSS de la página) y px del respaldo del lienzo. */
const toScreen = (page, wx, wy) => page.evaluate(([wx, wy]) => { const r = cv.getBoundingClientRect(), d = cv.fluyoDpr || 1; return { x: r.left + viewX + wx * viewZoom, y: r.top + viewY + wy * viewZoom, bx: (viewX + wx * viewZoom) * d, by: (viewY + wy * viewZoom) * d, d }; }, [wx, wy]);

async function load(page, theme) {
  const fx = JSON.parse(JSON.stringify(FX)); fx.doc.theme = theme;
  await page.evaluate((fx) => { applyProjectData(fx); selN.clear(); selE.clear(); hoverNode = null; refreshPanel(); playing = false; pausedAt = 0.37;
    for (const e of P().edges) e.animated = false;   /* los puntos de flujo no son objeto de este slice: fuera de las muestras */
  }, fx);
}

async function cell(browser, base, vp, ui, theme, deep) {
  const tag = `${vp.key} · interfaz ${ui === "dark" ? "oscura" : "clara"} · lienzo ${theme}`;
  console.log("\n" + tag);
  const t = await open(browser, base, vp, ui), { page } = t;
  const bg = BG[theme], ink = activeInk(theme), z1 = vp.mobile ? 1.1 : 1.4;
  await load(page, theme);

  /* ── 1. Normal: estructura, sin oliva ni cian ── */
  /* el color se mide a zoom 2: a densidad 1 (375 px) y zoom 1,1 la línea de 1,5 mide 1,65 px de dispositivo y el
     antialiasing aclara su núcleo; aquí se comprueba QUÉ color tiene, no su nitidez */
  await focus(page, 300, 200, 2);                               /* Cliente → API (HTTPS) */
  let s = await toScreen(page, 300, 200);
  const n1 = await page.evaluate(([s, bg, th]) => ({ core: __px.core(cv, s.bx, s.by, bg, false), olive: __px.count(cv, [0, 0, cv.width, cv.height], __px.ink(th)), cyan: __px.count(cv, [0, 0, cv.width, cv.height], __px.cyan) }), [s, bg, theme]);
  check(close(n1.core, EDGE[theme]), `normal: la línea es estructura ${EDGE[theme]} (${n1.core})`);
  check(n1.cyan === 0, `normal: ${n1.cyan} px de cian`);
  const oliveBase = n1.olive;
  await focus(page, 640, 200, 2);                               /* API → Eventos, lineColor terracota y discontinua */
  s = await toScreen(page, 600, 200);
  const lc = await page.evaluate(([s, bg]) => { const e = P().edges.find((x) => x.id === 9), pts = edgePoints(e), p = pointAt(pts, 0.35), r = cv.getBoundingClientRect(), d = cv.fluyoDpr || 1;
    /* la discontinua puede dejar un hueco justo en el punto: se busca el núcleo en ±10 px a lo largo */
    let best = null, bd = -1; for (let k = -10; k <= 10; k += 2) { const c = __px.core(cv, (viewX + (p.x + k) * viewZoom) * d, (viewY + p.y * viewZoom) * d, bg, false); const dd = Math.abs(c[0]-bg[0]) + Math.abs(c[1]-bg[1]) + Math.abs(c[2]-bg[2]); if (dd > bd) { bd = dd; best = c; } }
    return best; }, [s, bg]);
  check(close(lc, "#d08b5b", 60), `color explícito: lineColor terracota intacto (${lc})`);

  /* ── 2. Conexión seleccionada (14: ortogonal con codos): la línea conserva su color; funda oliva; codos visibles ── */
  const wp = [120, 290];                                         /* tramo vertical, lejos de su barra (punto medio, y = 380) */
  await focus(page, wp[0], wp[1], z1);
  s = await toScreen(page, wp[0], wp[1]);
  const before = await page.evaluate(([s, bg, th]) => ({ core: __px.core(cv, s.bx, s.by, bg, true), olive: __px.count(cv, [s.bx - 30, s.by - 30, 60, 60], __px.mark(th)) }), [s, bg, theme]);
  await page.evaluate(() => selectOnly("edge", 14)); await frame(page);
  const sel = await page.evaluate(([s, bg, th]) => ({ core: __px.core(cv, s.bx, s.by, bg, true), olive: __px.count(cv, [s.bx - 30, s.by - 30, 60, 60], __px.mark(th)) }), [s, bg, theme]);
  check(close(sel.core, EDGE[theme], 70), `seleccionada: la línea conserva su color (${before.core} → ${sel.core})`);
  check(sel.olive > before.olive + 20, `seleccionada: funda oliva bajo la línea (${before.olive} → ${sel.olive} px)`);
  const handle = async (z) => { await focus(page, 120, 560, z); const q = await toScreen(page, 120, 560);   /* codo lejos de extremos y barras */
    return page.evaluate(([q, ink]) => ({ n: __px.count(cv, [q.bx - 20 * q.d, q.by - 20 * q.d, 40 * q.d, 40 * q.d], __px.near(ink, 40)), bb: __px.bbox(cv, [q.bx - 14 * q.d, q.by - 14 * q.d, 28 * q.d, 28 * q.d], __px.near(ink, 40)), d: q.d }), [q, ink]); };
  const hA = await handle(0.6), hB = await handle(1.6);
  const wA = hA.bb ? hA.bb[0] / hA.d : 0, wB = hB.bb ? hB.bb[0] / hB.d : 0;
  check(hA.n > 10 && hB.n > 10, `codo visible con la conexión seleccionada (${hA.n} / ${hB.n} px)`);
  check(wA > 4 && wA < 16 && wB > 4 && wB < 16 && Math.abs(wA - wB) <= 3, `instrumentos de tamaño constante en pantalla: ${wA.toFixed(1)} px a zoom 0,6 · ${wB.toFixed(1)} px a zoom 1,6`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-${ui}-${theme}-seleccion.png`) });
  await page.evaluate(() => { selE.clear(); refreshPanel(); }); await frame(page);
  const hOff = await handle(1.6);
  check(hOff.n === 0, `sin selección, el codo no se ve (${hOff.n} px de oliva)`);

  /* ── 3. Acertar una conexión a zoom bajo, a 4 px de la línea ── */
  await focus(page, 360, 330, 0.35);
  const off = await toScreen(page, 120, 380);
  if (vp.touch) await page.touchscreen.tap(off.x + 4, off.y); else await page.mouse.click(off.x + 4, off.y);
  await frame(page);
  const hit = await page.evaluate(() => [...selE]);
  check(hit.length === 1 && hit[0] === 14, `a zoom 0,35, ${vp.touch ? "un toque" : "un clic"} a 4 px de la línea la selecciona (${JSON.stringify(hit)})`);
  if (vp.touch) {
    /* la barra táctil: «Conectar» no está (la selección es una conexión); objetivos ≥ 40 px */
    const bar = await page.evaluate(() => [...document.querySelectorAll("#touchBar button")].filter((b) => !b.hidden && b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().height)));
    check(bar.length > 0 && bar.every((h) => h >= 40), `barra táctil: objetivos ${bar.join(",")} px`);
  }
  await page.evaluate(() => { selN.clear(); selE.clear(); refreshPanel(); }); await frame(page);

  /* ── 4. Conectar ── */
  const nE = await page.evaluate(() => P().edges.length);
  if (!vp.touch) {
    await focus(page, 360, 330, 1);
    const A = await toScreen(page, 200, 460), port = await toScreen(page, 200 + 80 + 18, 460);   /* «¿OK?»: w 160 → lado e en x+80 */
    await page.mouse.move(A.x + 20, A.y); await page.mouse.move(port.x - 2, port.y, { steps: 4 }); await frame(page);
    const pp = await page.evaluate(([p, ink]) => ({ at: __px.count(cv, [p.bx - 8 * p.d, p.by - 8 * p.d, 16 * p.d, 16 * p.d], __px.near(ink, 40)), host: arrowHostNode() && arrowHostNode().id }), [port, ink]);
    const others = await page.evaluate(([ink]) => { const n = P().nodes.find((x) => x.id === 6), d = cv.fluyoDpr || 1, out = []; for (const s of ["n", "s", "w"]) { const q = connectPortPoint(n, s, viewZoom); out.push(__px.count(cv, [(viewX + q.x * viewZoom - 8) * d, (viewY + q.y * viewZoom - 8) * d, 16 * d, 16 * d], __px.near(ink, 40))); } return out; }, [ink]);
    check(pp.host === 6 && pp.at > 10, `ratón: puerto en el lado que mira al cursor (${pp.at} px oliva)`);
    check(others.every((n) => n === 0), `ratón: un solo puerto (otros lados: ${others.join(",")})`);
    const B = await toScreen(page, 520, 460);
    await page.mouse.down(); await page.mouse.move(B.x, B.y - 30, { steps: 10 }); await page.mouse.up(); await frame(page);
    const made = await page.evaluate((n) => { const e = P().edges[P().edges.length - 1]; return { n: P().edges.length, from: e.from, to: e.to, fromSide: e.fromSide }; }, nE);
    check(made.n === nE + 1 && made.from === 6 && made.to === 3 && made.fromSide === "e", `ratón: arrastrar el puerto conecta ¿OK? → BD por el lado e (${JSON.stringify(made)})`);
    await page.screenshot({ path: path.join(shots, `${vp.key}-${ui}-${theme}-conectar.png`) });
    /* selección sin ratón encima: sin puerto */
    await page.evaluate(() => { selectOnly("node", 2); hoverNode = null; }); await frame(page);
    check(await page.evaluate(() => arrowHostNode() === null), "ratón: seleccionar un nodo no saca el puerto si el ratón no está encima");
  } else {
    await focus(page, 360, 330, vp.mobile ? 0.6 : 0.9);
    const A = await toScreen(page, 200, 460);
    await page.touchscreen.tap(A.x, A.y); await frame(page);
    const noPort = await page.evaluate(([ink]) => { const n = P().nodes.find((x) => x.id === 6), d = cv.fluyoDpr || 1; let k = 0; for (const s of SIDES) { const q = connectPortPoint(n, s, viewZoom); k += __px.count(cv, [(viewX + q.x * viewZoom - 8) * d, (viewY + q.y * viewZoom - 8) * d, 16 * d, 16 * d], __px.near(ink, 40)); } return { k, host: arrowHostNode() }; }, [ink]);
    check(noPort.host === null && noPort.k === 0, `dedo: ningún puerto en el nodo seleccionado (${noPort.k} px)`);
    check(await page.locator("#tbConnect").isVisible(), "dedo: «Conectar» en la barra");
    await page.locator("#tbConnect").tap(); await frame(page);
    const linkFrame = await page.evaluate(([ink]) => { const n = P().nodes.find((x) => x.id === 6), d = cv.fluyoDpr || 1, p = 10 / viewZoom; return __px.count(cv, [(viewX + (n.x - n.w / 2 - p - 4) * viewZoom) * d, (viewY + (n.y - n.h / 2 - p - 4) * viewZoom) * d, (n.w + 2 * p + 8) * viewZoom * d, 8 * d], __px.near(ink, 40)); }, [ink]);
    check(linkFrame > 4, `dedo: el origen lleva el marco discontinuo de «Conectar» (${linkFrame} px)`);
    check((await page.locator("#tbMsg").textContent()).includes("destino"), "dedo: la barra pide el destino");
    const B = await toScreen(page, 520, 460);
    await page.touchscreen.tap(B.x, B.y); await frame(page);
    const made = await page.evaluate(() => { const e = P().edges[P().edges.length - 1]; return { n: P().edges.length, id: e.id, from: e.from, to: e.to, sel: [...selE], link: touchModes().link }; });
    check(made.n === nE + 1 && made.from === 6 && made.to === 3 && made.sel.length === 1 && made.sel[0] === made.id && made.link === null, `dedo: «Conectar» → tocar destino crea ¿OK? → BD, la selecciona y sale del modo (${JSON.stringify(made)})`);
    await page.screenshot({ path: path.join(shots, `${vp.key}-${ui}-${theme}-conectar.png`) });
  }

  /* ── 5. Interfaz: sin desbordamiento; el lienzo sigue a la vista ── */
  const lay = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, canvas: Math.round(r.width * r.height / (innerWidth * innerHeight) * 100) }; });
  check(lay.over <= 0 && lay.canvas >= 35, `sin desbordamiento horizontal (${lay.over}); lienzo ${lay.canvas} % de la ventana`);
  check(oliveBase < 40, `normal: sin marcas oliva en el lienzo (${oliveBase} px)`);

  if (deep) await deepChecks(t, base, vp, theme);
  check(t.errors.length === 0, `0 errores (${t.errors.join(" | ")})`);
  await t.ctx.close();
}

/* SVG, Viewer e Historia real. En las celdas de interfaz clara. */
async function deepChecks(t, base, vp, theme) {
  const { page } = t, bg = BG[theme];
  await load(page, theme);
  /* ── SVG del editor = golden compartido con export_diagram ── */
  const svg = await page.evaluate(() => buildSVGDocument(1));
  const themeEdge = await page.evaluate(() => THEMES[doc.theme].edge);
  const mine = connectorLines(svg), gold = GOLDEN.connectors.map((l) => l.split("#8a8275").join(themeEdge));
  check(JSON.stringify(mine) === JSON.stringify(gold), `SVG: conexiones idénticas byte a byte a las de export_diagram (${mine.length}/${gold.length} líneas)`);
  check(!/<marker|<polyline|context-stroke|3aa7e8/i.test(svg), "SVG: sin <marker>, <polyline>, context-stroke ni cian");
  /* rasterizado: la línea Cliente → API, del color del tema */
  const ras = await page.evaluate(async ([svg, bg]) => {
    const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth * 2; c.height = img.naturalHeight * 2;
    const x2 = c.getContext("2d"); x2.fillStyle = "rgb(" + bg + ")"; x2.fillRect(0, 0, c.width, c.height); x2.drawImage(img, 0, 0, c.width, c.height);
    return __px.core(c, 300 * 2, 200 * 2, bg, false);
  }, [svg, bg]);
  check(close(ras, EDGE[theme], 70), `SVG rasterizado: línea de estructura (${ras})`);

  /* ── Viewer: las mismas conexiones, sin funda ni instrumentos ── */
  await page.evaluate(() => selectOnly("edge", 14));
  const url = await page.evaluate(async (b) => createShareUrl(serializeProject(), b + "/s/"), base);
  const v = await t.ctx.newPage();
  v.on("pageerror", (e) => t.errors.push(vp.key + " viewer: " + e.message)); v.on("console", (m) => { if (m.type() === "error") t.errors.push(vp.key + " viewer: " + m.text()); });
  await v.goto(url.replace(/^https?:\/\/[^/]+/, base));
  await v.waitForFunction(() => typeof viewerPhase !== "undefined" && viewerPhase === "ready");
  const vw = await v.evaluate(async ([bg]) => { const r = sv.getBoundingClientRect(), d = sv.width / r.width;
    playing = false; pausedAt = 0.37; for (const e of doc.pages[doc.cur].edges) e.animated = false;
    view.zoom = 1.4; view.x = r.width / 2 - 300 * 1.4; view.y = r.height / 2 - 200 * 1.4;
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const core = __px.core(sv, (view.x + 300 * view.zoom) * d, (view.y + 200 * view.zoom) * d, bg, false);
    view.x = r.width / 2 - 120 * 1.4; view.y = r.height / 2 - 380 * 1.4;
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const olive = __px.count(sv, [(view.x + 90 * view.zoom) * d, (view.y + 180 * view.zoom) * d, 60 * view.zoom * d, 400 * view.zoom * d], __px.ink(doc.theme));
    return { core, olive, cyan: __px.count(sv, [0, 0, sv.width, sv.height], __px.cyan) }; }, [BG[theme]]);
  check(close(vw.core, EDGE[theme]) && vw.cyan === 0, `Viewer: línea de estructura (${vw.core}), sin cian`);
  check(vw.olive < 30, `Viewer: sin funda ni instrumentos aunque el documento se compartiera con una selección (${vw.olive} px)`);
  await v.screenshot({ path: path.join(shots, `${vp.key}-${theme}-viewer.png`) });
  await v.close();

  /* ── Historia real (fixture 017-1) en el editor: sin cian; la conexión sigue siendo estructura ── */
  const fx17 = JSON.parse(JSON.stringify(FX17)); fx17.doc.theme = theme;
  await page.evaluate((fx) => { applyProjectData(fx); selN.clear(); selE.clear(); refreshPanel(); playing = true; fitView(1.2); }, fx17);
  await frame(page);
  await page.evaluate(() => scRun()); await page.waitForFunction(() => scStatus === "running");
  let cyan = 0;
  for (let i = 0; i < 30; i++) { cyan = Math.max(cyan, await page.evaluate(() => __px.count(cv, [0, 0, cv.width, cv.height], __px.cyan))); await page.waitForTimeout(120); }
  check(cyan === 0, `Historia real: máx. ${cyan} px de cian`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-${theme}-historia.png`) });
  await page.evaluate(() => scReset());
}

(async () => {
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS.filter((v) => !process.env.ONLY || process.env.ONLY.split(",").includes(v.key))) {
      for (const theme of ["claro", "crema", "dark"]) for (const ui of ["light", "dark"]) {
        if (process.env.FAST && (theme === "claro" || ui === "dark") && vp.key !== "d1440") continue;
        await cell(browser, base, vp, ui, theme, ui === "light");
      }
    }
  } finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.16 browser: ${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
