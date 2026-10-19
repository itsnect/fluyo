"use strict";
/* FLUYO-019-HIT-TEST-D6 — Capas de pintado con la piel «construido», en Chrome real. Se sirven dos árboles: el de trabajo y la
   base ce8e699 (antes del arreglo). Visibilidad = fracción de la zona de un elemento (caja de una hoja; trazo de una conexión sin
   12 px por extremo) que cambia de píxel al omitir ese elemento (drawNode/drawEdge y sus pares SVG se envuelven para omitirlo).
   · Contrato (test/fixtures/fluyo-019-d6-capas.json, 13 casos) con la piel, en el lienzo de exportación (el mismo render() de
     Present y Viewer) y en el SVG del editor rasterizado: cada hoja y cada conexión ≥ 0,95. La base reproduce el bug (caso A: 0).
   · Plano: el árbol y la base dan el MISMO lienzo (hash de píxeles) y el MISMO SVG en los 13 casos y en los 8 ejemplos.
   · Con la piel y sin contenedores (8 ejemplos y caso Z): mismo lienzo y mismo SVG que la base.
   · Present del editor y Viewer (#d=) reales, caso D: A, B y A→B visibles (base: tapados).
   · Historia: el token de un SEND por la conexión interna A→B, en Present con la piel y en pausa, se ve (base: tapado).
   · «Una pelota por ruta»: la pelota sobre conexiones internas se ve (base: tapada).
   · Rendimiento: un fotograma con la piel y 100 nodos (10 contenedores × 9 hojas) cuesta ≤ 1 ms más que en la base (mediana de 11
     rondas intercaladas en páginas limpias; ver el comentario de la sección).
   · 0 errores de página.
   Uso: node test/fluyo-019-d6-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; SKIP_BASE=1 sin la base) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "ce8e699";
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
function treeAt(rev) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-d6-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

const FIX = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "fluyo-019-d6-capas.json"), "utf8"));
const HISTORIA = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "fluyo-019-d6-historia.json"), "utf8"));
const EXAMPLES = fs.readdirSync(path.join(root, "ejemplos", "data")).map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, "ejemplos", "data", f), "utf8"))]);
/* hojas de otro color que los contenedores: si no, omitir una hoja apenas cambia píxeles aunque se vea */
const docOf = (c, extra) => {
  const conts = new Set(c.containers);
  const nodes = c.nodes.map((n) => Object.assign({ color: conts.has(n.id) ? "#6a9fb5" : "#b5734a" }, n));
  const edges = c.edges.map((e) => Object.assign({ route: "straight", animated: true, endArrow: true }, e));
  return { version: 5, app: "fluyo", settings: Object.assign({ grid: false, speed: 0.5, dots: 3 }, extra || {}),
    doc: { theme: "crema", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [{ name: "P", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 200, nodes, edges }] } };
};

const SETUP = () => {
  if (window.__d6) return; window.__d6 = true;
  window.__skipN = null; window.__skipE = null; window.__noToken = false; window.__noBalls = false;
  const dn = window.drawNode, de = window.drawEdge, dt = window.drawEventToken, fb = window.drawFlowBalls;
  window.drawNode = function (c, n) { if (n.id === window.__skipN) return; return dn.apply(this, arguments); };
  window.drawEdge = function (c, e) { if (e.id === window.__skipE) return; return de.apply(this, arguments); };
  if (dt) window.drawEventToken = function () { if (window.__noToken) return; return dt.apply(this, arguments); };
  window.drawFlowBalls = function () { if (window.__noBalls) return; return fb.apply(this, arguments); };
  if (window.renderNodeToSVG) { const rn = window.renderNodeToSVG, rc = window.renderConnectorToSVG;
    window.renderNodeToSVG = function (n) { return n.id === window.__skipN ? "" : rn.apply(this, arguments); };
    window.renderConnectorToSVG = function (e) { return e.id === window.__skipE ? "" : rc.apply(this, arguments); }; }
  const hash = async (buf) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
  window.__canvas = (skin, B0) => {
    const off = document.createElement("canvas"); off.width = Math.ceil(B0.w); off.height = Math.ceil(B0.h);
    const oc = off.getContext("2d"); oc.save(); oc.translate(-B0.x, -B0.y);
    render(oc, 0.37, { export: true, skin, bounds: B0, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) });
    oc.restore(); return oc.getImageData(0, 0, off.width, off.height);
  };
  window.__svg = async (skin) => {
    const s = buildSVGDocument(1, skin);
    const img = new Image(), url = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
    const off = document.createElement("canvas"); off.width = img.width; off.height = img.height;
    const oc = off.getContext("2d"); oc.drawImage(img, 0, 0); URL.revokeObjectURL(url);
    return { data: oc.getImageData(0, 0, off.width, off.height), s: img.width / W, text: s };
  };
  window.__hashes = async (skin) => { const B0 = getBounds(); const c = __canvas(skin, B0); return { lienzo: await hash(c.data.buffer), svg: await hash(new TextEncoder().encode(buildSVGDocument(1, skin))) }; };
  const diff = (a, b, i) => Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24;
  const zoneN = (n) => { const pts = []; for (let y = n.y - n.h / 2 + 4; y < n.y + n.h / 2 - 4; y += 3) for (let x = n.x - n.w / 2 + 4; x < n.x + n.w / 2 - 4; x += 3) pts.push([x, y]); return pts; };
  const zoneE = (e) => { const p = edgePoints(e), pts = []; for (let i = 1; i < p.length; i++) { const L = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); for (let d = 0; d < L; d += 2) pts.push([p[i - 1].x + (p[i].x - p[i - 1].x) * d / L, p[i - 1].y + (p[i].y - p[i - 1].y) * d / L]); } return pts.slice(6, -6); };
  window.__zone = (kind, id) => kind === "n" ? zoneN(nodeById(id)) : zoneE(edgeById(id));
  /* visibilidad de cada hoja (no `text`) y cada conexión en el lienzo de exportación y en el SVG */
  window.__vis = async (skin) => {
    const B0 = getBounds(), res = {};
    const full = __canvas(skin, B0), sfull = await __svg(skin);
    const at = (img, X, Y) => { const xi = Math.round(X), yi = Math.round(Y); return (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) ? -1 : (yi * img.width + xi) * 4; };
    const measure = async (kind, el) => {
      if (kind === "n") window.__skipN = el.id; else window.__skipE = el.id;
      const c2 = __canvas(skin, B0), s2 = await __svg(skin);
      window.__skipN = null; window.__skipE = null;
      /* solo cuentan los puntos que caen dentro de cada imagen (el SVG empieza en 0,0: un nodo que asome a x<0 se recorta) */
      const z = __zone(kind, el.id); let dc = 0, ds = 0, nc = 0, nsv = 0;
      for (const [x, y] of z) { const ic = at(full, x - B0.x, y - B0.y); if (ic >= 0) { nc++; if (diff(full, c2, ic)) dc++; } const is = at(sfull.data, x * sfull.s, y * sfull.s); if (is >= 0) { nsv++; if (diff(sfull.data, s2.data, is)) ds++; } }
      return [+(dc / Math.max(1, nc)).toFixed(2), +(ds / Math.max(1, nsv)).toFixed(2)];
    };
    const ns = P().nodes;
    for (const n of ns) if (!isContainerNode(n, ns) && n.shape !== "text") res[n.label] = await measure("n", n);
    for (const e of P().edges) res[nodeById(e.from).label + "→" + nodeById(e.to).label] = await measure("e", e);
    return res;
  };
  /* visibilidad en un lienzo VIVO (Present, Viewer): Δ px en la zona al omitir el elemento, tras dos fotogramas */
  window.__liveVis = async (canvas, toScreen, kind, id) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const ctx = canvas.getContext("2d"), dpr = canvas.width / canvas.getBoundingClientRect().width;
    const z = __zone(kind, id).map(([x, y]) => toScreen(x, y)).map(([X, Y]) => [Math.round(X * dpr), Math.round(Y * dpr)]);
    const read = () => z.map(([X, Y]) => [...ctx.getImageData(X, Y, 1, 1).data]);
    await frame(); const a = read();
    if (kind === "n") window.__skipN = id; else window.__skipE = id;
    await frame(); const b = read(); window.__skipN = null; window.__skipE = null; await frame();
    let d = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i][0] - b[i][0]) + Math.abs(a[i][1] - b[i][1]) + Math.abs(a[i][2] - b[i][2]) > 24) d++;
    return +(d / z.length).toFixed(2);
  };
};

async function editor(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  await page.evaluate(SETUP);
  const load = (d) => page.evaluate((d) => { applyProjectData(d); clearSel(); playing = false; }, d);
  return { page, errors, ctx, load };
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const now = await serve(root);
  let old = null, oldDir = null;
  try {
    const T = await editor(browser, now.base);
    let B = null;
    if (!process.env.SKIP_BASE) { oldDir = treeAt(BASE); old = await serve(oldDir); B = await editor(browser, old.base); }

    console.log("── Contrato con la piel: cada hoja y cada conexión visibles (lienzo / SVG ≥ 0,95)");
    for (const c of FIX.cases) {
      await T.load(docOf(c)); const v = await T.page.evaluate(() => __vis("built"));
      const bad = Object.entries(v).filter(([, [a, s]]) => a < 0.95 || s < 0.95);
      check(bad.length === 0, `${c.name}: ${Object.entries(v).map(([k, [a, s]]) => k + " " + a + "/" + s).join(" · ")}`);
    }
    if (B) {
      const A = FIX.cases.find((c) => c.name.startsWith("A ")); await B.load(docOf(A)); const v = await B.page.evaluate(() => __vis("built"));
      check(v.A[0] <= 0.05 && v.B[0] <= 0.05 && v["A→B"][0] <= 0.05 && v["B→C"][0] <= 0.05 && v.C[0] >= 0.95, `BASE reproduce el bug (caso A): A ${v.A} · B ${v.B} · A→B ${v["A→B"]} · B→C ${v["B→C"]} · C ${v.C}`);
    }

    console.log("── Golden SVG «construido» del caso D (contrato byte a byte para el port del MCP, fase 2)");
    {
      const GOLD = path.join(root, "test", "fixtures", "fluyo-019-d6-capas-svg.json");
      const Dc = FIX.cases.find((c) => c.name.startsWith("D "));
      await T.load(docOf(Dc)); const svg = await T.page.evaluate(() => buildSVGDocument(1, "built"));
      if (process.env.FLUYO_UPDATE_GOLDEN) fs.writeFileSync(GOLD, JSON.stringify({ _: "FLUYO-019-HIT-TEST-D6: SVG del editor con la piel «construido» para el caso D de fluyo-019-d6-capas.json (hojas #b5734a, contenedores #6a9fb5, conexiones rectas animadas). FLUYO_UPDATE_GOLDEN=1 lo regenera.", case: Dc.name, svg }, null, 1) + "\n");
      const gold = fs.existsSync(GOLD) ? JSON.parse(fs.readFileSync(GOLD, "utf8")).svg : null;
      const order = (s) => [...s.matchAll(/<g id="node-(\d+)"/g)].map((m) => +m[1]);
      check(gold !== null && svg === gold, "el SVG del caso D es el del golden" + (gold === null ? " (falta el golden: FLUYO_UPDATE_GOLDEN=1)" : ""));
      /* las conexiones (trazo 1,5) van entre el último contenedor (GCP) y la primera hoja (B) */
      const firstEdge = svg.indexOf('stroke-width="1.5"'), lastEdge = svg.lastIndexOf('stroke-width="1.5"');
      check(JSON.stringify(order(svg)) === JSON.stringify([7, 1, 3, 2, 4]) && svg.indexOf('<g id="node-1"') < firstEdge && lastEdge < svg.indexOf('<g id="node-3"'),
        "orden en el SVG: Región, GCP, conexiones, B, A, C = " + JSON.stringify(order(svg)));
    }

    if (B) {
      console.log("── Plano: el árbol y la base dan el mismo lienzo y el mismo SVG (casos del contrato y 8 ejemplos)");
      const same = async (d, skin) => { await T.load(d); await B.load(d); const a = await T.page.evaluate((s) => __hashes(s), skin), b = await B.page.evaluate((s) => __hashes(s), skin); return a.lienzo === b.lienzo && a.svg === b.svg; };
      let okF = 0, nF = 0;
      for (const c of FIX.cases) { nF++; if (await same(docOf(c), "flat")) okF++; else console.log("    distinto en plano: " + c.name); }
      for (const [f, d] of EXAMPLES) { nF++; if (await same(d, "flat")) okF++; else console.log("    distinto en plano: " + f); }
      check(okF === nF, `plano idéntico en ${okF}/${nF}`);
      console.log("── Con la piel y SIN contenedores: el mismo lienzo y el mismo SVG que la base");
      let okB = 0, nB = 0;
      for (const [f, d] of EXAMPLES) { nB++; if (await same(d, "built")) okB++; else console.log("    distinto con la piel: " + f); }
      const Z = FIX.cases.find((c) => c.name.startsWith("Z ")); nB++; if (await same(docOf(Z), "built")) okB++;
      check(okB === nB, `con la piel y sin contenedores, idéntico en ${okB}/${nB}`);
    }

    console.log("── Present del editor y Viewer reales (caso D, la piel en el documento)");
    const D = FIX.cases.find((c) => c.name.startsWith("D "));
    const live = async (ed, label, expectVisible) => {
      await ed.load(docOf(D, { skin: "built" }));
      await ed.page.evaluate(() => { enterPresent(); playing = false; });
      await ed.page.waitForTimeout(300);
      const r = await ed.page.evaluate(async () => { const ts = (x, y) => [viewX + x * viewZoom, viewY + y * viewZoom];
        return { A: await __liveVis(cv, ts, "n", 2), B: await __liveVis(cv, ts, "n", 3), AB: await __liveVis(cv, ts, "e", 10) }; });
      await ed.page.evaluate(() => exitPresent());
      check(expectVisible ? (r.A >= 0.95 && r.B >= 0.95 && r.AB >= 0.95) : (r.A <= 0.05 && r.B <= 0.05 && r.AB <= 0.05), `${label} Present: A ${r.A} · B ${r.B} · A→B ${r.AB}`);
    };
    await live(T, "árbol", true); if (B) await live(B, "BASE (reproduce el bug)", false);
    const viewer = async (srv, label, expectVisible) => {
      const ed = srv === now ? T : B;
      const payload = await ed.page.evaluate(async (d) => encodeDeepLink(d), docOf(D, { skin: "built" }));
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1 });
      await ctx.route((u) => !u.href.startsWith(srv.base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
      const vp = await ctx.newPage(); const errs = []; vp.on("pageerror", (e) => errs.push(String(e)));
      await vp.goto(srv.base + "/s/#d=" + payload); await vp.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
      await vp.evaluate(SETUP); await vp.waitForTimeout(300);
      const r = await vp.evaluate(async () => { const c = document.getElementById("sv"); const ts = (x, y) => [view.x + x * view.zoom, view.y + y * view.zoom];
        return { A: await __liveVis(c, ts, "n", 2), B: await __liveVis(c, ts, "n", 3), AB: await __liveVis(c, ts, "e", 10) }; });
      check((expectVisible ? (r.A >= 0.95 && r.B >= 0.95 && r.AB >= 0.95) : (r.A <= 0.05 && r.B <= 0.05 && r.AB <= 0.05)) && errs.length === 0, `${label} Viewer: A ${r.A} · B ${r.B} · A→B ${r.AB} (errores ${errs.length})`);
      await ctx.close();
    };
    await viewer(now, "árbol", true); if (B) await viewer(old, "BASE (reproduce el bug)", false);

    console.log("── Historia: token de un SEND por la conexión interna A→B (Present con la piel, en pausa)");
    const token = async (ed, label, expectVisible) => {
      await ed.page.evaluate((d) => { applyProjectData(d); clearSel(); setDocumentSkin("built"); }, HISTORIA);   /* el corpus publicado no lleva settings.skin (019-2): la piel se activa aquí */
      await ed.page.evaluate(() => { enterPresent(); presentPlay(); });
      await ed.page.waitForTimeout(800);
      const r = await ed.page.evaluate(async () => {
        presentTogglePause();
        const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        await frame();
        const ctx = cv.getContext("2d"), z = __zone("e", 10).map(([x, y]) => [Math.round(viewX + x * viewZoom), Math.round(viewY + y * viewZoom)]);
        const read = () => z.map(([X, Y]) => [...ctx.getImageData(X, Y, 1, 1).data]);
        const a = read(); window.__noToken = true; await frame(); const b = read(); window.__noToken = false;
        let d = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i][0] - b[i][0]) + Math.abs(a[i][1] - b[i][1]) + Math.abs(a[i][2] - b[i][2]) > 24) d++;
        return { px: d, phase: presentPhase() };
      });
      await ed.page.evaluate(() => { if (typeof scReset === "function") scReset(); exitPresent(); });
      check(expectVisible ? r.px >= 4 : r.px === 0, `${label}: píxeles del token sobre A→B = ${r.px} (fase ${r.phase})`);
    };
    await token(T, "árbol", true); if (B) await token(B, "BASE (reproduce el bug)", false);

    console.log("── «Una pelota por ruta» sobre conexiones internas (caso A)");
    const balls = async (ed, label, expectVisible) => {
      await ed.load(docOf(FIX.cases.find((c) => c.name.startsWith("A ")), { single: true }));
      const px = await ed.page.evaluate(() => { const B0 = getBounds(); const a = __canvas("built", B0); window.__noBalls = true; const b = __canvas("built", B0); window.__noBalls = false;
        let d = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) d++; return d; });
      check(expectVisible ? px >= 20 : px === 0, `${label}: píxeles de la pelota = ${px}`);
    };
    await balls(T, "árbol", true); if (B) await balls(B, "BASE (reproduce el bug)", false);

    if (B) {
      /* Rendimiento. El criterio anterior medía UNA vez cada árbol, siempre primero el de trabajo, y en las mismas páginas que ya
         habían pasado por todas las comprobaciones anteriores (con más memoria y otro estado del JIT que la de la base). El orden
         fijo y la historia de cada página sesgaban la diferencia, que variaba entre −0,3 y +1,9 ms de una ejecución a otra.
         Ahora: dos páginas LIMPIAS (una por árbol) con el mismo documento, calentadas, y 11 rondas INTERCALADAS que alternan qué
         árbol va primero. En cada ronda se mide la media de 30 fotogramas de cada uno y se toma la diferencia. El criterio es la
         MEDIANA de esas diferencias ≤ 1 ms, el mismo umbral de la tarea. Se informa además del coste de containmentPaintOrder sola. */
      console.log("── Rendimiento: un fotograma con la piel, 100 nodos (10 contenedores × 9 hojas), páginas limpias y rondas intercaladas");
      const big = { name: "100", nodes: [], edges: [], containers: [] }; let id = 1;
      for (let k = 0; k < 10; k++) { const cx = 300 + (k % 5) * 700, cy = 300 + Math.floor(k / 5) * 600; big.nodes.push({ id: id++, shape: "rect", x: cx, y: cy, w: 600, h: 500, label: "C" + k }); big.containers.push(id - 1);
        const first = id; for (let j = 0; j < 9; j++) big.nodes.push({ id: id++, shape: "rect", x: cx - 180 + (j % 3) * 180, y: cy - 150 + Math.floor(j / 3) * 150, w: 120, h: 60, label: "n" + k + j });
        for (let j = 0; j < 8; j++) big.edges.push({ id: 1000 + k * 10 + j, from: first + j, to: first + j + 1 }); }
      /* un lienzo reutilizado por página y sin copiar sus píxeles en cada fotograma (getImageData de ~16 MB metía al recolector de
         basura en la medida): 30 render() por lote y una lectura de 1 px al final, que obliga a volcar lo pendiente */
      const FRAME = () => { const B0 = getBounds(); const c = window.__perfCanvas || (window.__perfCanvas = Object.assign(document.createElement("canvas"), { width: Math.ceil(B0.w), height: Math.ceil(B0.h) }));
        const oc = c.getContext("2d"), rs = makeReadOnlyRenderState({ width: c.width, height: c.height }), t = performance.now();
        for (let i = 0; i < 30; i++) { oc.save(); oc.translate(-B0.x, -B0.y); render(oc, 0.37, { export: true, skin: "built", bounds: B0, renderState: rs }); oc.restore(); }
        oc.getImageData(0, 0, 1, 1); return (performance.now() - t) / 30; };
      const perfPage = async (srv) => { const ed = await editor(browser, srv.base); await ed.load(docOf(big));
        for (let i = 0; i < 3; i++) await ed.page.evaluate(FRAME); return ed; };
      const PT = await perfPage(now), PB = await perfPage(old);
      const frame = (ed) => ed.page.evaluate(FRAME);
      const deltas = [];
      for (let r = 0; r < 11; r++) {
        let a, b;
        if (r % 2 === 0) { a = await frame(PT); b = await frame(PB); } else { b = await frame(PB); a = await frame(PT); }
        deltas.push(a - b);
      }
      const median = deltas.slice().sort((x, y) => x - y)[Math.floor(deltas.length / 2)];
      const alone = await PT.page.evaluate(() => { const ns = P().nodes; for (let i = 0; i < 50; i++) containmentPaintOrder(ns, skinPaintOrder); const t = performance.now(); for (let i = 0; i < 500; i++) containmentPaintOrder(ns, skinPaintOrder); return (performance.now() - t) / 500; });
      check(median <= 1, `fotograma: mediana +${median.toFixed(2)} ms en 11 rondas intercaladas (${deltas.map((d) => d.toFixed(2)).join(" ")}); containmentPaintOrder sola ${alone.toFixed(3)} ms`);
      check(PT.errors.length === 0 && PB.errors.length === 0, "0 errores de página en las páginas de rendimiento");
      await PT.ctx.close(); await PB.ctx.close();
    }

    check(T.errors.length === 0, "0 errores de página en el árbol" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
    await T.ctx.close(); if (B) await B.ctx.close();
  } finally { await browser.close(); now.server.close(); if (old) old.server.close(); if (oldDir) fs.rmSync(oldDir, { recursive: true, force: true }); }
  console.log(`\n${passed} OK, ${failed} fallos (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
