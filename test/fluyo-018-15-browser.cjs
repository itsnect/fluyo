"use strict";
/* FLUYO-018.15 — Chrome REAL: el color del documento en editor, Historias, SVG y Viewer.
   6 viewports (1440, 1280, 1101 con ratón; 768 táctil; 390 y 375 móviles) × interfaz clara/oscura × lienzo claro, crema
   y oscuro. Se leen píxeles de los propios lienzos (editor, Viewer y SVG rasterizado en un <canvas>), no capturas:
     · un nodo nuevo nace #857F6C (por la fábrica y por el rail del editor); el panel marca su muestra;
     · sin cian estructural (#3aa7e8) en el lienzo, con selección y con Historia; sin azul acero si nadie lo pidió;
     · la selección es oliva; «Resaltar» de una Historia, también (reproducción real en editor y Viewer);
     · el evento en tránsito: su halo es terracota, no azul;
     · compatibilidad: un documento con #6a9fb5 explícito y con un nodo SIN color se ve y se guarda igual;
     · paridad: el color del trazo de cada nodo es el mismo en editor, Viewer y SVG; la firma de color del SVG es la
       que fija fluyo-mcp/test/fluyo-018-15.test.ts para export_diagram (MCP = editor);
     · la interfaz (clara/oscura) no cambia el lienzo; 0 errores.
   Uso: node test/fluyo-018-15-browser.cjs   (Playwright vía NODE_PATH; FLUYO_SHOTS=<dir>; ONLY=d1440|…; FAST=1 menos celdas) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-15-"));
fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
const NEW_DEFAULT = "#857F6C", SERVICIO = "#6a9fb5";
const FX15 = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/fluyo-018-15-colores.json"), "utf8"));
const FX17 = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"), "utf8"));
/* Firma de export_diagram para el fixture (tema crema), la misma que fija fluyo-mcp/test/fluyo-018-15.test.ts */
const MCP_SIGNATURE = [
  "#857F6C|rgba(133,127,108,0.16)", "#6a9fb5|rgba(106,159,181,0.16)", "#857F6C|rgba(133,127,108,0.16)", "#857F6C|none",
  "#857F6C|rgba(133,127,108,0.16)", "#7fa66b|rgba(127,166,107,0.16)", "#6a9fb5|rgba(106,159,181,0.16)", "text:#857F6C",
];
function colorSignature(svg) {
  const out = [], body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, "");
  for (const m of body.matchAll(/<(rect|path|polygon|circle|ellipse)\b([^>]*)>/g)) {
    const stroke = /\bstroke="([^"]+)"/.exec(m[2])?.[1], fill = /\bfill="([^"]+)"/.exec(m[2])?.[1];
    if (!stroke || stroke === "none") continue;
    if (m[2].includes('stroke-width="1.5"')) continue;   // conexión (FLUYO-018.16: <path> de 1,5, ya no <polyline>)
    out.push(stroke + "|" + fill);
  }
  for (const m of body.matchAll(/<text\b[^>]*\bfill="([^"]+)"[^>]*>Título</g)) out.push("text:" + m[1]);
  return out;
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

/* Utilidades de píxel, inyectadas en cada página. */
const PIX = `
window.__px = {
  /* punto del borde de un nodo lejos de los anclajes (donde llegan las flechas) y si el trazo ahí es horizontal */
  edgePt(n){
    if (n.shape === "cylinder") return { x: n.x - n.w / 2, y: n.y + 18, v: false };
    if (n.shape === "diamond") return { x: n.x - n.w / 4, y: n.y - n.h / 4, v: true };
    return { x: n.x - n.w / 4, y: n.y - n.h / 2, v: true };
  },
  rgb: (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
  dist: (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]),
  count(cv, rect, test){
    const c = cv.getContext("2d"); const [x, y, w, h] = rect.map(Math.round); const X = Math.max(0, x), Y = Math.max(0, y), W = Math.min(cv.width - X, w), H = Math.min(cv.height - Y, h);
    if (W <= 0 || H <= 0) return 0; const d = c.getImageData(X, Y, W, H).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i+1], d[i+2])) n++;
    return n;
  },
  /* el cian del editor antiguo (#3aa7e8): azul claro muy saturado */
  cyan(r, g, b){ const mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mx < 150 || (mx - mn) / mx < .55) return false; let h; if (mx === b) h = 240 + 60*(r-g)/(mx-mn); else if (mx === g) h = 120 + 60*(b-r)/(mx-mn); else return false; return h >= 180 && h <= 225; },
  /* azul acero de «Servicio» (#6a9fb5) */
  steel(r, g, b){ return Math.abs(r-0x6a) + Math.abs(g-0x9f) + Math.abs(b-0xb5) <= 36; },
  near(ref, tol){ return (r, g, b) => Math.abs(r-ref[0]) + Math.abs(g-ref[1]) + Math.abs(b-ref[2]) <= tol; },
  hue(r, g, b){ const mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mx === mn) return -1; let h; if (mx === r) h = 60*((g-b)/(mx-mn)); else if (mx === g) h = 120 + 60*(b-r)/(mx-mn); else h = 240 + 60*(r-g)/(mx-mn); return (h + 360) % 360; },
  /* color del trazo en (x,y): en una ventana que lo cruza (vertical u horizontal), el píxel más lejos del fondo */
  core(cv, x, y, bg, vertical){
    const c = cv.getContext("2d"), X = Math.max(0, Math.round(x) - (vertical ? 1 : 7)), Y = Math.max(0, Math.round(y) - (vertical ? 7 : 1)), W = vertical ? 3 : 15, H = vertical ? 15 : 3;
    const d = c.getImageData(X, Y, W, H).data; let best = null, bd = -1;
    for (let i = 0; i < d.length; i += 4) { const p = [d[i], d[i+1], d[i+2]], k = this.dist(p, bg); if (k > bd) { bd = k; best = p; } }
    return best;
  },
};`;

/* Composición de un flujo de pedido: los nodos se crean como en el editor (sin color), salvo los semánticos. */
const BUILD = (theme) => {
  doc.pages = [blankPage("Pedidos")]; doc.cur = 0; setThemeIn(doc, { theme }); doc.customBg = "";
  settings.grid = false; settings.single = false; settings.build = false;
  const mk = (shape, x, y, label, extra) => { const n = newNode(shape, x, y, extra || {}); n.label = label; return n; };
  const title = mk("text", 760, 70, "Pedido de compra"); title.w = 460;
  const gw = mk("rect", 420, 290, "API Gateway"), auth = mk("hex", 420, 500, "Auth"), ped = mk("rect", 720, 290, "Servicio\nPedidos");
  const stock = mk("diamond", 1010, 290, "¿Stock?"), bd = mk("cylinder", 720, 520, "Pedidos BD", { color: "#7fa66b" });
  const ev = mk("rect", 1300, 290, "pedido.creado", { color: "#d08b5b" }), err = mk("circle", 1010, 520, "Rechazo", { color: "#d0576a" });
  const code = mk("code", 1320, 540, "SELECT id, total\nFROM pedidos"), spin = mk("anim", 140, 500, "Procesando", { anim: "spinner", color: DEFAULT_NODE_COLOR });
  const E = (a, b, o) => newEdge(a.id, b.id, o || {});
  const e1 = E(gw, ped, { label: "POST /pedidos" }); E(gw, auth, { dashed: true }); E(ped, stock); E(stock, ev, { label: "sí" }); E(stock, err, { label: "no" }); E(ped, bd, { route: "ortho" }); E(ev, code); E(spin, auth);
  const defaults = [title, gw, auth, ped, stock, code];
  playing = false; pausedAt = 0.37;
  return { gw: gw.id, ped: ped.id, stock: stock.id, e1: e1.id, colors: defaults.map((n) => n.color), explicit: [bd.color, ev.color, err.color] };
};
/* Encuadre fijo: zoom 1,4 sobre un punto del mundo (las comprobaciones de trazo necesitan trazos de varios px). */
const FOCUS = ([wx, wy, z]) => { const r = cv.getBoundingClientRect(); viewZoom = z; viewX = r.width / 2 - wx * z; viewY = r.height / 2 - wy * z; };
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const box = (page, id, pad) => page.evaluate(([id, pad]) => { const n = P().nodes.find((x) => x.id === id), d = cv.fluyoDpr || 1;
  return [(viewX + (n.x - n.w / 2 - pad) * viewZoom) * d, (viewY + (n.y - n.h / 2 - pad) * viewZoom) * d, (n.w + 2 * pad) * viewZoom * d, (n.h + 2 * pad) * viewZoom * d]; }, [id, pad]);
const activeInk = (theme) => theme === "dark" ? [0xc3, 0xcd, 0xa4] : [0x4e, 0x5a, 0x3f];

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
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
  return { ctx, page, errors };
}

async function cell(browser, base, vp, ui, theme, deep) {
  const tag = `${vp.key} · interfaz ${ui === "dark" ? "oscura" : "clara"} · lienzo ${theme}`;
  console.log("\n" + tag);
  const t = await open(browser, base, vp, ui), { page } = t;
  check(await page.evaluate((ui) => (document.documentElement.getAttribute("data-ui-theme") || "light") === ui, ui), `${tag}: interfaz ${ui}`);

  /* ── 1. Nodos nuevos: #857F6C; explícitos tal cual ── */
  const ids = await page.evaluate(BUILD, theme);
  check(ids.colors.every((c) => c === NEW_DEFAULT) && ids.explicit.join() === "#7fa66b,#d08b5b,#d0576a", `nuevos sin color → ${NEW_DEFAULT}; explícitos intactos (${ids.colors.join(",")})`);
  check(await page.evaluate((t) => doc.theme === t, theme), "la interfaz no toca el tema del documento");

  /* ── 2. Panel: la muestra por defecto encabeza la rejilla y aparece marcada ── */
  await page.evaluate((id) => selectOnly("node", id), ids.ped);
  const sw = await page.evaluate(() => { const f = document.getElementById("swatches").children[0]; return { v: f.dataset.v, sel: f.classList.contains("sel"), any: [...document.getElementById("swatches").children].filter((x) => x.classList.contains("sel")).map((x) => x.dataset.v) }; });
  check(sw.v === NEW_DEFAULT && sw.sel && sw.any.length === 1, `panel: primera muestra ${sw.v} marcada (${sw.any})`);

  /* ── 3. Lienzo con selección: sin cian, sin acero, trazo piedra, selección oliva ── */
  await page.evaluate(FOCUS, [720, 360, vp.mobile ? 1.1 : 1.4]); await frame(page);
  const bg = theme === "dark" ? [0x16, 0x16, 0x16] : theme === "crema" ? [0xf4, 0xee, 0xe1] : [255, 255, 255];
  /* el trazo se mide en un nodo por defecto SIN seleccionar (el marco de la selección está a 6 px del borde) */
  const px = await page.evaluate(([gw, bg]) => { const n = P().nodes.find((x) => x.id === gw), d = cv.fluyoDpr || 1, q = __px.edgePt(n);
    const r = cv.getBoundingClientRect(), ox = viewX, oy = viewY;
    const cyan = __px.count(cv, [0, 0, cv.width, cv.height], __px.cyan), steel = __px.count(cv, [0, 0, cv.width, cv.height], __px.steel);
    return { cyan, steel, q: [q.x, q.y, q.v] }; }, [ids.gw, bg]);
  await page.evaluate(([wx, wy, z]) => { const r = cv.getBoundingClientRect(); viewZoom = z; viewX = r.width / 2 - wx * z; viewY = r.height / 2 - wy * z; }, [px.q[0], px.q[1], 1.6]); await frame(page);
  px.core = await page.evaluate(([q, bg]) => { const d = cv.fluyoDpr || 1; return __px.core(cv, (viewX + q[0] * viewZoom) * d, (viewY + q[1] * viewZoom) * d, bg, q[2]); }, [px.q, bg]);
  await page.evaluate(FOCUS, [720, 360, vp.mobile ? 1.1 : 1.4]); await frame(page);
  check(px.cyan === 0, `lienzo con selección: ${px.cyan} px de cian`);
  check(px.steel < 40, `lienzo: sin azul acero que nadie pidió (${px.steel} px)`);
  check(px.core && Math.abs(px.core[0] - 0x85) + Math.abs(px.core[1] - 0x7f) + Math.abs(px.core[2] - 0x6c) <= 45, `trazo del nodo por defecto = piedra media (${px.core})`);
  const selBox = await box(page, ids.ped, 10);
  const olive = await page.evaluate(([b, ink]) => __px.count(cv, b, __px.near(ink, 40)), [selBox, activeInk(theme)]);
  check(olive > 20, `selección oliva (${olive} px)`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-${ui}-${theme}-editar.png`) });

  /* ── 4. Fotograma de Historia (runtime inyectado, render real): «Resaltar» oliva y halo terracota ── */
  await page.evaluate((I) => {
    selN.clear(); selE.clear(); refreshPanel();
    window.__origSRS = window.buildScenarioRenderState;
    window.buildScenarioRenderState = () => ({
      activeNodeEffects: [{ nodeId: I.stock, effects: { highlight: true }, alpha: 1, enter: 1 }], nodeStates: {},
      activeSends: [{ edgeId: I.e1, progress: 0.5, token: "", connection: { during: "halo", trail: "none" }, duration: 1100 }],
      completedSends: [], scenario: null });
  }, ids);
  /* cada medida con su elemento en el centro del encuadre (en 768 y en móvil no cabe todo a este zoom) */
  const at = (wx, wy) => page.evaluate(([wx, wy, z]) => { const r = cv.getBoundingClientRect(); viewZoom = z; viewX = r.width / 2 - wx * z; viewY = r.height / 2 - wy * z; }, [wx, wy, vp.mobile ? 1.1 : 1.4]).then(() => frame(page));
  const hl = await page.evaluate((id) => { const n = P().nodes.find((x) => x.id === id); return [n.x, n.y]; }, ids.stock);
  await at(...hl);
  const hlPx = await page.evaluate(([ids, ink]) => { const d = cv.fluyoDpr || 1, n = P().nodes.find((x) => x.id === ids.stock);
    const b = [(viewX + (n.x - n.w / 2 - 14) * viewZoom) * d, (viewY + (n.y - n.h / 2 - 14) * viewZoom) * d, (n.w + 28) * viewZoom * d, (n.h + 28) * viewZoom * d];
    return { olive: __px.count(cv, b, __px.near(ink, 70)), cyan: __px.count(cv, [0, 0, cv.width, cv.height], __px.cyan) }; }, [ids, activeInk(theme)]);
  const mid = await page.evaluate((id) => { const p = pointAt(edgePoints(P().edges.find((x) => x.id === id)), 0.5); return [p.x, p.y]; }, ids.e1);
  await at(...mid);
  const st = await page.evaluate(([ids, ink]) => {
    const d = cv.fluyoDpr || 1, e = P().edges.find((x) => x.id === ids.e1);
    const p = pointAt(edgePoints(e), 0.5), sx = (viewX + p.x * viewZoom) * d, sy = (viewY + p.y * viewZoom) * d, R = 14 * viewZoom * d;
    /* halo: anillo alrededor del punto, por encima de la línea (y − R·0,7) */
    const hb = [sx - 3, sy - R * 0.85, 6, R * 0.4], c = cv.getContext("2d"), dd = c.getImageData(...hb.map(Math.round)).data; const hues = [];
    for (let i = 0; i < dd.length; i += 4) { const h = __px.hue(dd[i], dd[i+1], dd[i+2]), mx = Math.max(dd[i], dd[i+1], dd[i+2]), mn = Math.min(dd[i], dd[i+1], dd[i+2]); if (h >= 0 && mx - mn > 12) hues.push(Math.round(h)); }
    return { cyan: __px.count(cv, [0, 0, cv.width, cv.height], __px.cyan), hues };
  }, [ids, activeInk(theme)]);
  st.olive = hlPx.olive; st.cyan = Math.max(st.cyan, hlPx.cyan);
  const warm = st.hues.filter((h) => h >= 10 && h <= 45).length, blue = st.hues.filter((h) => h >= 180 && h <= 250).length;
  check(st.olive > 30 && st.cyan === 0, `Historia: «Resaltar» oliva (${st.olive} px) y ${st.cyan} px de cian`);
  check(warm > 0 && blue === 0, `Historia: halo del evento terracota (${warm} px cálidos, ${blue} azules)`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-${ui}-${theme}-historia.png`) });
  await page.evaluate(() => { window.buildScenarioRenderState = window.__origSRS; });

  /* ── 5. Rail real: el nodo creado con el gesto del editor nace piedra ── */
  await page.evaluate(() => { P().nodes = []; P().edges = []; selN.clear(); selE.clear(); refreshPanel(); });
  await frame(page);
  const tool = page.locator('.rail [data-shape="rect"]');
  if (await tool.isVisible().catch(() => false)) {
    if (vp.touch) await tool.tap(); else await tool.click();
    const r = await page.locator("#cv").boundingBox();
    const at = { x: r.x + r.width * 0.5, y: r.y + Math.min(r.height * 0.35, 260) };
    if (vp.touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
    await frame(page);
    const made = await page.evaluate(() => P().nodes.map((n) => n.shape + ":" + n.color));
    check(made.length === 1 && made[0] === "rect:" + NEW_DEFAULT, `rail: la caja creada con el gesto nace ${made}`);
  } else check(false, "rail visible para crear una caja");

  if (deep) await deepChecks(t, base, vp, theme, tag);
  check(t.errors.length === 0, `0 errores (${t.errors.join(" | ")})`);
  await t.ctx.close();
}

/* Documento antiguo, SVG, Viewer y reproducción real. Una vez por viewport y tema del lienzo. */
async function deepChecks(t, base, vp, theme, tag) {
  const { page } = t;
  const bg = theme === "dark" ? [0x16, 0x16, 0x16] : theme === "crema" ? [0xf4, 0xee, 0xe1] : [255, 255, 255];
  const fx = JSON.parse(JSON.stringify(FX15)); fx.doc.theme = theme;
  const EXPECT = { "Por defecto": NEW_DEFAULT, "Servicio explícito": SERVICIO, "BD": NEW_DEFAULT, "SELECT 1": NEW_DEFAULT, "Datos": "#7fa66b", "Histórico": SERVICIO };

  /* ── documento con #6a9fb5 explícito y un nodo sin color: se abre y se guarda igual ── */
  const saved = await page.evaluate((fx) => { applyProjectData(fx); selN.clear(); refreshPanel(); return serializeProject().doc.pages[0].nodes.map((n) => [n.label, n.color]); }, fx);
  check(JSON.stringify(saved) === JSON.stringify([["Por defecto", NEW_DEFAULT], ["Servicio explícito", SERVICIO], ["BD", NEW_DEFAULT], ["Título", NEW_DEFAULT], ["SELECT 1", NEW_DEFAULT], ["Datos", "#7fa66b"], ["Histórico", SERVICIO]]),
    "documento antiguo: explícitos intactos y el nodo sin color se lee #6a9fb5 (sin migración)");
  await page.evaluate(() => { playing = false; pausedAt = 0.37; });
  /* cada nodo encuadrado a zoom 1,6: trazo de 4 px, sin mezcla de antialiasing */
  const ed = await page.evaluate(async ([bg]) => { const d = cv.fluyoDpr || 1, out = {}, r = cv.getBoundingClientRect();
    for (const n of P().nodes) { if (n.shape === "text") continue;
      viewZoom = 1.6; viewX = r.width / 2 - n.x * 1.6; viewY = r.height / 2 - n.y * 1.6;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const p = __px.edgePt(n); out[n.label] = __px.core(cv, (viewX + p.x * viewZoom) * d, (viewY + p.y * viewZoom) * d, bg, p.v); }
    return out; }, [bg]);
  const okColor = (got, hex) => got && Math.abs(got[0] - parseInt(hex.slice(1, 3), 16)) + Math.abs(got[1] - parseInt(hex.slice(3, 5), 16)) + Math.abs(got[2] - parseInt(hex.slice(5, 7), 16)) <= 45;
  check(Object.entries(EXPECT).every(([k, h]) => okColor(ed[k], h)), "editor: trazo de cada nodo = su color (" + Object.entries(ed).map(([k, v]) => k + ":" + v).join(" · ") + ")");

  /* ── SVG: firma de color (= export_diagram del MCP) y trazos rasterizados = editor ── */
  const svg = await page.evaluate(() => buildSVGDocument(2));
  const sig = colorSignature(svg);
  if (theme === "crema") check(JSON.stringify(sig) === JSON.stringify(MCP_SIGNATURE), "SVG: firma de color idéntica a la de export_diagram (MCP = editor)");
  else check(JSON.stringify(sig.map((s) => s.split("|")[0])) === JSON.stringify(MCP_SIGNATURE.map((s) => s.split("|")[0])), "SVG: trazos idénticos a los de export_diagram (MCP = editor) " + sig.map((s) => s.split("|")[0]).join(","));
  check(!/3aa7e8|58,\s*167,\s*232/i.test(svg), "SVG: sin cian");
  const sv = await page.evaluate(async ([svg, bg]) => {
    const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x2 = c.getContext("2d"); x2.fillStyle = "rgb(" + bg + ")"; x2.fillRect(0, 0, c.width, c.height); x2.drawImage(img, 0, 0);
    /* buildSVGDocument recorta al contenido: el desplazamiento sale del viewBox */
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg).slice(1).map(Number), k = c.width / vb[2], out = {};
    for (const n of P().nodes) if (n.shape !== "text") { const p = __px.edgePt(n); out[n.label] = __px.core(c, (p.x - vb[0]) * k, (p.y - vb[1]) * k, bg, p.v); }
    return { out, cyan: __px.count(c, [0, 0, c.width, c.height], __px.cyan) };
  }, [svg, bg]);
  check(sv.cyan === 0 && Object.entries(EXPECT).every(([k, h]) => okColor(sv.out[k], h)), "SVG rasterizado: trazos = editor, sin cian (" + Object.entries(sv.out).map(([k, v]) => k + ":" + v).join(" · ") + ")");

  /* ── Viewer: mismo documento, mismos colores ── */
  const url = await page.evaluate(async (b) => createShareUrl(serializeProject(), b + "/s/"), base);
  const v = await t.ctx.newPage();
  v.on("pageerror", (e) => t.errors.push(vp.key + " viewer: " + e.message)); v.on("console", (m) => { if (m.type() === "error") t.errors.push(vp.key + " viewer: " + m.text()); });
  await v.goto(url.replace(/^https?:\/\/[^/]+/, base));
  await v.waitForFunction(() => typeof viewerPhase !== "undefined" && viewerPhase === "ready");
  const vw = await v.evaluate(async ([bg]) => { const r = sv.getBoundingClientRect(), d = sv.width / r.width, out = {}; let cyan = 0;
    playing = false; pausedAt = 0.37;
    for (const n of doc.pages[doc.cur].nodes) { if (n.shape === "text") continue;
      view.zoom = 1.6; view.x = r.width / 2 - n.x * 1.6; view.y = r.height / 2 - n.y * 1.6;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const p = __px.edgePt(n); out[n.label] = __px.core(sv, (view.x + p.x * view.zoom) * d, (view.y + p.y * view.zoom) * d, bg, p.v);
      cyan += __px.count(sv, [0, 0, sv.width, sv.height], __px.cyan); }
    return { out, cyan }; }, [bg]);
  check(vw.cyan === 0 && Object.entries(EXPECT).every(([k, h]) => okColor(vw.out[k], h)), "Viewer: trazos = editor, sin cian (" + Object.entries(vw.out).map(([k, v]) => k + ":" + v).join(" · ") + ")");
  await v.screenshot({ path: path.join(shots, `${vp.key}-${theme}-viewer.png`) });
  await v.close();

  /* ── Historia REAL (fixture 017-1: «Procesamiento» resalta, con halo y brillo de llegada), en editor y Viewer ── */
  const fx17 = JSON.parse(JSON.stringify(FX17)); fx17.doc.theme = theme;
  await page.evaluate((fx) => { applyProjectData(fx); selN.clear(); selE.clear(); refreshPanel(); playing = true; fitView(1.2); }, fx17);
  await frame(page);
  const sampleRun = async (pg, canvasExpr, kafkaRectExpr, ink) => {
    let cyan = 0, olive = 0;
    for (let i = 0; i < 70; i++) {
      const r = await pg.evaluate(([ce, ke, ink]) => { const C = eval(ce), b = eval(ke); return { c: __px.count(C, [0, 0, C.width, C.height], __px.cyan), o: __px.count(C, b, __px.near(ink, 60)) }; }, [canvasExpr, kafkaRectExpr, ink]);
      cyan = Math.max(cyan, r.c); olive = Math.max(olive, r.o);
      await pg.waitForTimeout(110);
    }
    return { cyan, olive };
  };
  await page.evaluate(() => scRun()); await page.waitForFunction(() => scStatus === "running");
  const runEd = await sampleRun(page, "cv", "(()=>{const n=P().nodes.find(x=>x.label==='Kafka'),d=cv.fluyoDpr||1;return [(viewX+(n.x-n.w/2-16)*viewZoom)*d,(viewY+(n.y-n.h/2-16)*viewZoom)*d,(n.w+32)*viewZoom*d,(n.h+32)*viewZoom*d];})()", activeInk(theme));
  check(runEd.cyan === 0 && runEd.olive > 20, `editor, Historia real: máx. ${runEd.cyan} px de cian; «Resaltar» oliva ${runEd.olive} px`);
  await page.screenshot({ path: path.join(shots, `${vp.key}-${theme}-historia-real.png`) });
  const url17 = await page.evaluate(async (b) => { scReset(); return createShareUrl(serializeProject(), b + "/s/"); }, base);
  const v2 = await t.ctx.newPage();
  v2.on("pageerror", (e) => t.errors.push(vp.key + " viewer: " + e.message)); v2.on("console", (m) => { if (m.type() === "error") t.errors.push(vp.key + " viewer: " + m.text()); });
  await v2.goto(url17.replace(/^https?:\/\/[^/]+/, base));
  await v2.waitForFunction(() => typeof viewerPhase !== "undefined" && viewerPhase === "ready");
  await v2.evaluate(() => storyPlay());
  const runV = await sampleRun(v2, "sv", "(()=>{const n=doc.pages[doc.cur].nodes.find(x=>x.label==='Kafka'),d=sv.width/sv.getBoundingClientRect().width;return [(view.x+(n.x-n.w/2-16)*view.zoom)*d,(view.y+(n.y-n.h/2-16)*view.zoom)*d,(n.w+32)*view.zoom*d,(n.h+32)*view.zoom*d];})()", activeInk(theme));
  check(runV.cyan === 0 && runV.olive > 20, `Viewer, Historia real: máx. ${runV.cyan} px de cian; «Resaltar» oliva ${runV.olive} px`);
  await v2.screenshot({ path: path.join(shots, `${vp.key}-${theme}-viewer-historia.png`) });
  await v2.close();
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
  console.log(`\nFLUYO-018.15 browser: ${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
