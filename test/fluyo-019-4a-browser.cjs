"use strict";
/* FLUYO-019.4a — Aterrizaje por silueta con la piel «construido», en Chrome real. Se sirven el árbol de trabajo y la base
   22f82eb (antes del cambio). Repo en solo lectura y service worker bloqueado.
   · Matriz (10 formas × entradas n/e/s/w, con codo; líneas de colores distintos y sin flujo): en el lienzo de exportación (el
     mismo render() de Present, Viewer y GIF/PNG/JPG), con la piel:
       – la geometría que llega a edgeStroke en el render real es la de skinEdgeLanding y no tiene tramos inclinados;
       – la punta se ve como en plano (píxeles de su caja que cambian al omitir la conexión ≥ 0,95 × plano);
       – la separación entre la punta y el primer píxel de nodo, en la dirección de la conexión, es la de plano (± 0,6 u):
         ni flota ni se mete.
     La base reproduce los defectos (tramos inclinados y separaciones distintas de plano).
   · SVG del editor: los trazos de las conexiones acaban donde el lienzo (la misma geometría pintada).
   · Plano: el árbol y la base dan el MISMO lienzo y el MISMO SVG (8 ejemplos, fixture de 019.2 y matriz). Con la piel y el
     aterrizaje neutralizado en las dos páginas, también: lo único que cambia es el aterrizaje. Con la piel, en el SVG solo
     cambian trazos y puntas de conexiones.
   · Present del editor (zoom 2,5) y Viewer (#d=): el render vivo usa la geometría aterrizada; la punta se ve como en plano.
   · F13: con «Una pelota por ruta» y la piel, la pelota está sobre la línea pintada (también en píxeles: su centro tiene su
     color); el lienzo en t y en t + 1/speed es el mismo (bucle del GIF); sin piel, el mismo lienzo que la base.
   · Rendimiento: un fotograma con la piel y 300 nodos cuesta ≤ 1 ms más que la base (mediana de 11 rondas intercaladas en
     páginas limpias, el criterio de D6).
   · 0 errores de página.
   Uso: node test/fluyo-019-4a-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; SKIP_BASE=1 sin la base) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "22f82eb";
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-4a-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* ───────── documentos ───────── */
const SHAPES = ["rect", "cylinder", "icon", "circle", "diamond", "hex", "text", "code", "image", "anim"];
const COLORS = { n: "#c0392b", e: "#2471a3", s: "#1e8449", w: "#7d3c98" };
function matrixDoc(extra) {
  const nodes = [], edges = [], cases = []; let id = 1;
  const node = (o) => Object.assign({ id: id++, w: 100, h: 60, shape: "rect", label: "", color: "#8a8275", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, pulse: false, tint: false, order: id }, o);
  SHAPES.forEach((sh, i) => {
    const X = 260 + i * 460, Y = 460;
    const B = node({ x: X, y: Y, w: 140, h: 92, shape: sh, label: sh, color: "#5b8db5", icon: sh === "icon" ? "kafka" : undefined, code: sh === "code" ? "x = 1" : undefined });
    nodes.push(B);
    const src = { n: node({ x: X - 120, y: Y - 260 }), e: node({ x: X + 250, y: Y - 160 }), s: node({ x: X + 120, y: Y + 260 }), w: node({ x: X - 250, y: Y + 160 }) };
    const from = { n: "s", e: "n", s: "n", w: "s" };
    for (const side of ["n", "e", "s", "w"]) {
      nodes.push(src[side]);
      const e = { id: id++, from: src[side].id, to: B.id, fromSide: from[side], toSide: side, route: "ortho", waypoints: [], label: "", font: null, bold: false, animated: false, dashed: false, startArrow: false, endArrow: true, flowDir: "normal", lineColor: COLORS[side] };
      edges.push(e); cases.push({ k: sh + "-" + side, shape: sh, side, id: e.id });
    }
  });
  return { cases, doc: { version: 5, app: "fluyo", settings: Object.assign({ speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false }, extra || {}),
    doc: { theme: "crema", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [{ name: "P", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: id + 10, nodes, edges }] } } };
}
const EXAMPLES = fs.readdirSync(path.join(root, "ejemplos", "data")).map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, "ejemplos", "data", f), "utf8"))]);
const FIX019_2 = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "fluyo-019-2-skin.fluyo.json"), "utf8"));

const SETUP = () => {
  if (window.__4a) return; window.__4a = true;
  window.__skipE = null; window.__noLanding = false; window.__cap = {};
  const de = window.drawEdge, es = window.edgeStroke, sl = window.skinEdgeLanding;
  window.drawEdge = function (c, e) { if (e.id === window.__skipE) return; return de.apply(this, arguments); };
  window.edgeStroke = function (e, pts) { window.__cap[e.id] = pts.map((p) => ({ x: p.x, y: p.y })); return es.apply(this, arguments); };
  if (sl) window.skinEdgeLanding = function (p) { return window.__noLanding ? (p || []).map((q) => ({ x: q.x, y: q.y })) : sl.apply(this, arguments); };
  /* la geometría pintada con la regla de ESTE árbol (019.4a: con el destino; antes: con el lado) */
  window.__painted = (e) => { const p = edgePoints(e), B = nodeById(e.to); return /\(pts, B\)/.test(sl.toString()) ? sl(p, B) : sl(p, inferSide(B, p[p.length - 1])); };
  const S = 6;
  window.__canvas = (skin, bx, t) => {
    const off = document.createElement("canvas"); off.width = Math.ceil(bx.w * S); off.height = Math.ceil(bx.h * S);
    const oc = off.getContext("2d"); oc.save(); oc.scale(S, S); oc.translate(-bx.x, -bx.y);
    render(oc, t === undefined ? 60 : t, { export: true, skin, bounds: bx, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }); oc.restore();
    return oc.getImageData(0, 0, off.width, off.height);
  };
  const bgRGB = (() => { const h = (doc.customBg || THEMES[doc.theme].bg).slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); });
  const px = (img, bx, x, y) => { const X = Math.round((x - bx.x) * S), Y = Math.round((y - bx.y) * S); if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) return null; const i = (Y * img.width + X) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  const far = (a, b, k) => !!a && !!b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > k;
  /* medidas de una conexión: geometría que llega a edgeStroke, punta visible, separación hasta el primer píxel de nodo */
  window.__probe = (id, skin) => {
    const e = edgeById(id), lp = edgePoints(e), z = lp[lp.length - 1];
    const bx = { x: z.x - 45, y: z.y - 45, w: 90, h: 90 };
    window.__cap = {};
    const full = __canvas(skin, bx), cap = window.__cap[id];
    window.__skipE = id; const without = __canvas(skin, bx); window.__skipE = null;
    const st = edgeStroke(e, cap), head = st.heads[0];
    const xs = head.filter((q) => q.x !== undefined).map((q) => q.x), ys = head.filter((q) => q.y !== undefined).map((q) => q.y);
    let headPx = 0;
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1 / S) for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1 / S) if (far(px(full, bx, x, y), px(without, bx, x, y), 30)) headPx++;
    const n = cap.length, a = cap[n - 2], b = cap[n - 1], L = Math.hypot(b.x - a.x, b.y - a.y), u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
    const tip = head[0], bg = bgRGB();
    let gap = null; for (let d = 0; d <= 30; d += 0.25) { if (far(px(without, bx, tip.x + u.x * d, tip.y + u.y * d), bg, 40)) { gap = d; break; } }
    let tilt = 0; for (let i = 1; i < n; i++) { const dx = Math.abs(cap[i].x - cap[i - 1].x), dy = Math.abs(cap[i].y - cap[i - 1].y); if (dx > 0.01 && dy > 0.01 && (Math.abs(lp[i].x - lp[i - 1].x) < 0.01 || Math.abs(lp[i].y - lp[i - 1].y) < 0.01)) tilt = Math.max(tilt, Math.atan2(Math.min(dx, dy), Math.max(dx, dy)) * 180 / Math.PI); }
    return { headPx, gap, tilt: +tilt.toFixed(2), moved: JSON.stringify(cap) !== JSON.stringify(lp), sameAsPainted: skin === "built" ? JSON.stringify(cap) === JSON.stringify(__painted(e)) : JSON.stringify(cap) === JSON.stringify(lp), start: JSON.stringify(cap[0]) === JSON.stringify(lp[0]), count: cap.length === lp.length };
  };
  window.__hashes = async (skin) => {
    const B0 = getBounds(), off = document.createElement("canvas"); off.width = Math.ceil(B0.w); off.height = Math.ceil(B0.h);
    const oc = off.getContext("2d"); oc.save(); oc.translate(-B0.x, -B0.y);
    render(oc, 0.37, { export: true, skin, bounds: B0, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }); oc.restore();
    const h = async (buf) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const svg = buildSVGDocument(1, skin);
    return { lienzo: await h(oc.getImageData(0, 0, off.width, off.height).data.buffer), svg: await h(new TextEncoder().encode(svg)), svgText: svg };
  };
};

async function editor(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  await page.evaluate(SETUP);
  /* los iconos llegan como imágenes: se espera a que estén cargados para que los píxeles sean estables */
  const load = async (d) => { await page.evaluate((d) => { applyProjectData(d); clearSel(); playing = false; }, d);
    await page.evaluate(async () => { for (const n of P().nodes) if (n.shape === "icon") { const im = getImg(iconURLFor(n.icon, nodeIconTint(n))); if (!im.complete) await new Promise((r) => { im.onload = im.onerror = r; }); } }); };
  return { page, errors, ctx, load };
}

(async () => {
  const t0 = Date.now();
  const oldDir = process.env.SKIP_BASE ? null : treeAt(BASE);
  const now = await serve(root), old = oldDir ? await serve(oldDir) : null;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    const T = await editor(browser, now.base), B = old ? await editor(browser, old.base) : null;
    const M = matrixDoc();

    console.log("── Matriz: 10 formas × n/e/s/w, lienzo de exportación con la piel frente a plano");
    await T.load(M.doc);
    const rows = [];
    for (const c of M.cases) {
      const f = await T.page.evaluate((id) => __probe(id, "flat"), c.id), b = await T.page.evaluate((id) => __probe(id, "built"), c.id);
      rows.push({ c, f, b });
    }
    const bad = (pred) => rows.filter(pred).map((r) => r.c.k);
    check(rows.every((r) => r.b.sameAsPainted && r.b.start && r.b.count), "el render real pinta la geometría de skinEdgeLanding (origen y número de puntos intactos) en los 40 casos" + (bad((r) => !r.b.sameAsPainted).length ? ": " + bad((r) => !r.b.sameAsPainted) : ""));
    check(rows.every((r) => r.b.tilt === 0), "0 tramos inclinados con la piel (40/40)" + (bad((r) => r.b.tilt).length ? ": " + bad((r) => r.b.tilt) : ""));
    check(rows.every((r) => r.b.headPx >= 0.95 * r.f.headPx), "la punta se ve como en plano en los 40 casos" + (bad((r) => r.b.headPx < 0.95 * r.f.headPx).length ? ": " + bad((r) => r.b.headPx < 0.95 * r.f.headPx).map((k) => k + " " + JSON.stringify(rows.find((r) => r.c.k === k).b.headPx)) : ""));
    /* separación = distancia de la punta al primer píxel de nodo (con la conexión omitida). Donde la punta retrocede, ese píxel es la
       tinta de la silueta (1 px) a EDGE_GAP = 3 u: [1,75 , 3,25]. Donde no retrocede, la punta es la lógica y la separación, la de la
       base (no cambia nada frente a producción: por el sur, por ejemplo, la línea de contacto, que no es silueta, queda a 0,75). */
    const EG = await T.page.evaluate(() => EDGE_GAP);
    const movedOk = (r) => r.b.gap !== null && r.b.gap >= EG - 1.25 && r.b.gap <= EG + 0.25;
    check(JSON.stringify(rows.filter((r) => r.b.moved).map((r) => r.c.k)) === JSON.stringify(["rect-n", "rect-e", "icon-e", "icon-w"]) && rows.filter((r) => r.b.moved).every(movedOk), "donde la punta retrocede, queda a EDGE_GAP de la tinta de la silueta: ni flota ni se mete (" + rows.filter((r) => r.b.moved).map((r) => r.c.k + " " + r.b.gap).join(" · ") + ")");
    for (const k of ["rect-n", "rect-e", "rect-s", "cylinder-n", "icon-n", "icon-e", "icon-w", "diamond-n", "circle-e"]) { const r = rows.find((x) => x.c.k === k); console.log(`    ${k.padEnd(12)} punta ${r.f.headPx}/${r.b.headPx} px · separación plano ${r.f.gap} · piel ${r.b.gap} · retrocede ${r.b.moved} · inclinación ${r.b.tilt}°`); }
    if (B) {
      await B.load(M.doc);
      const base = [];
      for (const c of M.cases) base.push({ c, f: await B.page.evaluate((id) => __probe(id, "flat"), c.id), b: await B.page.evaluate((id) => __probe(id, "built"), c.id) });
      const same = rows.filter((r) => !r.b.moved).filter((r) => { const o = base.find((x) => x.c.k === r.c.k); return o.b.moved || o.b.gap !== r.b.gap; });
      check(same.length === rows.filter((r) => !r.b.moved && base.find((x) => x.c.k === r.c.k).b.moved).length, "donde la punta no retrocede y la base tampoco aterrizaba, la separación es la de la base");
      const tilted = base.filter((r) => r.b.tilt > 0).length;
      const floating = base.filter((r) => r.b.moved && !rows.find((x) => x.c.k === r.c.k).b.moved);
      /* el rayo de medida puede cruzar otra conexión de la matriz (p. ej. circle-n): basta con que flote la gran mayoría */
      const flo = floating.filter((r) => r.b.gap === null || r.b.gap > r.f.gap + 2);
      check(tilted >= 10 && floating.length >= 10 && flo.length >= floating.length - 3, `BASE (reproduce el defecto): ${tilted} conexiones inclinadas; ${floating.length} aterrizan sobre una forma sin silueta, ${flo.length} flotan > 2 u más que en plano (${flo.slice(0, 4).map((r) => r.c.k + " " + r.b.gap + " u frente a " + r.f.gap).join(" · ")}…)`);
      const fixed = rows.filter((r) => !r.b.moved && base.find((x) => x.c.k === r.c.k).b.moved);
      check(fixed.every((r) => r.b.gap === r.f.gap || (r.f.gap !== null && Math.abs(r.b.gap - r.f.gap) <= 1)), "esas mismas, ahora: la punta en el ancla lógica, con la separación de plano (± la tinta) (" + fixed.map((r) => r.c.k + " " + r.f.gap + "/" + r.b.gap).join(" · ") + ")");
    }

    console.log("── SVG del editor: los trazos acaban donde el lienzo");
    {
      const r = await T.page.evaluate((ids) => { const svg = buildSVGDocument(1, "built"), out = [];
        for (const id of ids) { const e = edgeById(id), st = edgeStroke(e, __painted(e)), d = segmentsToSVGPath(st.line), h = segmentsToSVGPath(st.heads[0]); out.push(svg.includes(`<path d="${d}"`) && svg.includes(`<path d="${h}"`)); } return out; }, M.cases.map((c) => c.id));
      check(r.every(Boolean), `SVG con la piel: trazo y punta de las 40 conexiones = geometría pintada del lienzo (${r.filter(Boolean).length}/40)`);
    }

    if (B) {
      console.log("── Plano idéntico a la base; con la piel, solo cambia el aterrizaje");
      const docs = [...EXAMPLES, ["fluyo-019-2-skin", FIX019_2], ["matriz", M.doc]];
      let okF = 0, okN = 0, okLines = 0;
      for (const [f, d] of docs) {
        await T.load(d); await B.load(d);
        const a = await T.page.evaluate(() => __hashes("flat")), b = await B.page.evaluate(() => __hashes("flat"));
        if (a.lienzo === b.lienzo && a.svg === b.svg) okF++; else console.log("    distinto en plano: " + f);
        for (const P of [T.page, B.page]) await P.evaluate(() => { window.__noLanding = true; });
        const an = await T.page.evaluate(() => __hashes("built")), bn = await B.page.evaluate(() => __hashes("built"));
        for (const P of [T.page, B.page]) await P.evaluate(() => { window.__noLanding = false; });
        if (an.lienzo === bn.lienzo && an.svg === bn.svg) okN++; else console.log("    distinto con la piel sin aterrizaje: " + f);
        const al = (await T.page.evaluate(() => __hashes("built"))).svgText.split("\n"), bl = (await B.page.evaluate(() => __hashes("built"))).svgText.split("\n");
        const changed = al.filter((l, i) => l !== bl[i]);
        if (al.length === bl.length && changed.every((l) => /^<path d="M [^"]*" fill="(none|#[0-9a-f]+)"( stroke="[^"]*" stroke-width="1\.5" stroke-linejoin="round"( stroke-dasharray="8 7")?)?\/>$/i.test(l.trim()))) okLines++;
        else console.log("    en el SVG con la piel cambia algo más que trazos y puntas: " + f + " " + JSON.stringify(changed.slice(0, 2)));
      }
      check(okF === docs.length, `plano: mismo lienzo y mismo SVG que ${BASE} en ${okF}/${docs.length}`);
      check(okN === docs.length, `con la piel y el aterrizaje neutralizado en las dos: mismo lienzo y SVG en ${okN}/${docs.length}`);
      check(okLines === docs.length, `con la piel: en el SVG solo cambian trazos y puntas de conexiones (${okLines}/${docs.length})`);
    }

    console.log("── Present del editor y Viewer (#d=), con la piel en el documento");
    const MB = matrixDoc().doc; MB.settings.skin = "built";
    {
      await T.load(MB);
      await T.page.evaluate(() => { enterPresent(); playing = false; });
      await T.page.waitForTimeout(300);
      const res = [];
      for (const k of ["rect-n", "rect-e", "icon-e", "cylinder-n", "diamond-n"]) {
        const id = M.cases.find((c) => c.k === k).id;
        const r = await T.page.evaluate(async (id) => {
          const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const e = edgeById(id), z = edgePoints(e).slice(-1)[0];
          viewZoom = 2.5; viewX = 720 - z.x * viewZoom; viewY = 450 - z.y * viewZoom; if (typeof requestRender === "function") requestRender();
          window.__cap = {}; await frame(); await frame();
          const cap = window.__cap[id], painted = __painted(e);
          const st = edgeStroke(e, painted), head = st.heads[0], ctx = cv.getContext("2d"), dpr = cv.width / cv.getBoundingClientRect().width;
          const pts = []; const xs = head.filter((q) => q.x !== undefined).map((q) => q.x), ys = head.filter((q) => q.y !== undefined).map((q) => q.y);
          for (let y = Math.min(...ys); y <= Math.max(...ys); y += .4) for (let x = Math.min(...xs); x <= Math.max(...xs); x += .4) pts.push([Math.round((viewX + x * viewZoom) * dpr), Math.round((viewY + y * viewZoom) * dpr)]);
          const read = () => pts.map(([X, Y]) => [...ctx.getImageData(X, Y, 1, 1).data]);
          const a = read(); window.__skipE = id; await frame(); const b = read(); window.__skipE = null; await frame();
          let d = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i][0] - b[i][0]) + Math.abs(a[i][1] - b[i][1]) + Math.abs(a[i][2] - b[i][2]) > 30) d++;
          return { same: JSON.stringify(cap) === JSON.stringify(painted), vis: +(d / pts.length).toFixed(2) };
        }, id);
        res.push([k, r]);
      }
      await T.page.screenshot({ path: path.join(os.tmpdir(), "fluyo-4a-present-last.png") });
      await T.page.evaluate(() => exitPresent());
      check(res.every(([, r]) => r.same), "Present: el render vivo pinta la geometría aterrizada (" + res.map(([k, r]) => k + (r.same ? "" : "✗")).join(", ") + ")");
      check(res.every(([, r]) => r.vis >= 0.3), "Present a zoom 2,5: la punta se ve (" + res.map(([k, r]) => k + " " + r.vis).join(" · ") + ")");
    }
    {
      const payload = await T.page.evaluate(async (d) => encodeDeepLink(d), MB);
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1 });
      await ctx.route((u) => !u.href.startsWith(now.base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
      const vp = await ctx.newPage(); const errs = []; vp.on("pageerror", (e) => errs.push(String(e)));
      await vp.goto(now.base + "/s/#d=" + payload); await vp.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
      await vp.evaluate(SETUP);
      const r = await vp.evaluate(async (ids) => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        view.zoom = 1; window.__cap = {}; if (typeof requestRender === "function") requestRender(); await frame(); await frame();
        return ids.map((id) => JSON.stringify(window.__cap[id]) === JSON.stringify(__painted(edgeById(id))));
      }, M.cases.map((c) => c.id));
      check(r.every(Boolean) && errs.length === 0, `Viewer: el render vivo pinta la geometría aterrizada en ${r.filter(Boolean).length}/40 (errores ${errs.length})`);
      await ctx.close();
    }

    console.log("── F13: pelota única con la piel");
    {
      const S1 = matrixDoc({ single: true }); for (const e of S1.doc.doc.pages[0].edges) e.animated = true;
      await T.load(S1.doc);
      const r = await T.page.evaluate(() => {
        const rec = () => { const log = []; let ga = 1; return { log, c: new Proxy({}, { get: (o, k) => k === "arc" ? ((x, y, r) => log.push({ x, y, r, ga })) : (k === "measureText" ? (() => ({ width: 10 })) : (k in o ? o[k] : (() => {}))), set: (o, k, v) => { if (k === "globalAlpha") ga = v; o[k] = v; return true; } }) }; };
        const dist = (p, pts) => { let m = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; const u = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0; m = Math.min(m, Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy)); } return m; };
        const lines = P().edges.map((e) => __painted(e));
        let maxD = 0, n = 0, pix = 0, pixOk = 0;
        for (let i = 0; i < 120; i++) {
          const t = i / 60, R = rec(); drawFlowBalls(R.c, t, { skinOn: true });
          for (const b of R.log.filter((a) => a.r === 7 && a.ga > 0.02)) { n++; maxD = Math.max(maxD, Math.min(...lines.map((l) => dist(b, l)))); }
          /* en píxeles: el centro de una pelota opaca tiene su color en el lienzo real */
          if (i % 10 === 0) { const ok = R.log.filter((a) => a.r === 7 && a.ga > 0.9);
            for (const b of ok.slice(0, 3)) { const bx = { x: b.x - 10, y: b.y - 10, w: 20, h: 20 }, img = __canvas("built", bx, t), c = (Math.round(10 * 6) * img.width + Math.round(10 * 6)) * 4; pix++;
              const e = P().edges.find((e) => dist(b, __painted(e)) < 1e-6), col = (e.dotColor || nodeById(e.from).color || "#d08b5b").slice(1), rgb = [0, 2, 4].map((k) => parseInt(col.slice(k, k + 2), 16));
              if (Math.abs(img.data[c] - rgb[0]) + Math.abs(img.data[c + 1] - rgb[1]) + Math.abs(img.data[c + 2] - rgb[2]) < 40) pixOk++; } }
        }
        return { maxD, n, pix, pixOk };
      });
      check(r.n > 100 && r.maxD < 1e-9, `la pelota está sobre la línea pintada (${r.n} muestras, distancia máxima ${r.maxD})`);
      check(r.pix > 0 && r.pixOk === r.pix, `en el lienzo real, el centro de la pelota tiene su color (${r.pixOk}/${r.pix})`);
      const loop = await T.page.evaluate(async () => { const B0 = getBounds(); const h = async (t) => { const o = document.createElement("canvas"); o.width = Math.ceil(B0.w); o.height = Math.ceil(B0.h); const c = o.getContext("2d"); c.save(); c.translate(-B0.x, -B0.y); render(c, t, { export: true, skin: "built", bounds: B0, renderState: makeReadOnlyRenderState({ width: o.width, height: o.height }) }); c.restore();
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256", c.getImageData(0, 0, o.width, o.height).data.buffer))].join(","); };
        const per = 1 / settings.speed, out = []; for (const t of [0.13, 0.71, 1.37]) out.push((await h(t)) === (await h(t + per))); return out; });
      check(loop.every(Boolean), "bucle del GIF: el lienzo con la piel en t y en t + 1/speed es el mismo (3/3)");
      if (B) {
        await B.load(S1.doc);
        const same = [];
        for (const t of [0.13, 0.71, 1.37]) { const a = await T.page.evaluate((t) => __hashes("flat").then((h) => h.lienzo), t), b = await B.page.evaluate((t) => __hashes("flat").then((h) => h.lienzo), t); same.push(a === b); }
        check(same.every(Boolean), "sin piel, con la pelota única, el lienzo es el de la base");
      }
    }

    if (B) {
      console.log("── Rendimiento: un fotograma con la piel, 300 nodos (20×15, conexiones que aterrizan), páginas limpias y rondas intercaladas");
      const nodes = [], edges = []; let id = 1;
      for (let r = 0; r < 15; r++) for (let c = 0; c < 20; c++) nodes.push({ id: id++, shape: ["rect", "cylinder", "icon", "rect", "diamond"][(r + c) % 5], icon: "kafka", x: 200 + c * 260, y: 200 + r * 200, w: 140, h: 80, label: "n" + r + "-" + c, color: "#5b8db5" });
      for (let r = 0; r < 15; r++) for (let c = 0; c < 20; c++) { const a = r * 20 + c + 1; if (c < 19) edges.push({ id: 1000 + a, from: a, to: a + 1, route: "ortho", fromSide: "e", toSide: "w", endArrow: true }); if (r < 14) edges.push({ id: 5000 + a, from: a, to: a + 21 <= 300 && c < 19 ? a + 21 : a + 20, route: "ortho", fromSide: "s", toSide: "n", endArrow: true }); }
      const big = { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, grid: false, font: "Georgia, serif", single: false }, doc: { theme: "crema", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [{ name: "300", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 9000, nodes, edges }] } };
      const FRAME = () => { const B0 = getBounds(); const c = window.__perfCanvas || (window.__perfCanvas = Object.assign(document.createElement("canvas"), { width: Math.ceil(B0.w), height: Math.ceil(B0.h) }));
        const oc = c.getContext("2d"), rs = makeReadOnlyRenderState({ width: c.width, height: c.height }), t = performance.now();
        for (let i = 0; i < 10; i++) { oc.save(); oc.translate(-B0.x, -B0.y); render(oc, 0.37, { export: true, skin: "built", bounds: B0, renderState: rs }); oc.restore(); }
        oc.getImageData(0, 0, 1, 1); return (performance.now() - t) / 10; };
      const perfPage = async (srv) => { const ed = await editor(browser, srv.base); await ed.load(big); for (let i = 0; i < 3; i++) await ed.page.evaluate(FRAME); return ed; };
      const PT = await perfPage(now), PB = await perfPage(old);
      const med = (v) => v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)];
      /* El criterio aísla el coste de 019.4a: la MISMA página, 21 rondas intercaladas con el aterrizaje y sin él (__noLanding: una
         copia de los puntos, lo que costaba el de antes). Entre dos páginas, fotogramas de ~30 ms varían ±5 ms y no sirven de
         criterio: se informan. */
      const own = [];
      for (let r = 0; r < 21; r++) { const on = () => PT.page.evaluate(() => { window.__noLanding = false; }), off = () => PT.page.evaluate(() => { window.__noLanding = true; });
        let a, b; if (r % 2 === 0) { await on(); a = await PT.page.evaluate(FRAME); await off(); b = await PT.page.evaluate(FRAME); } else { await off(); b = await PT.page.evaluate(FRAME); await on(); a = await PT.page.evaluate(FRAME); } own.push(a - b); }
      await PT.page.evaluate(() => { window.__noLanding = false; });
      /* Criterio: el camino que añade 019.4a en cada fotograma es UNA llamada a skinEdgeLanding por conexión (drawEdge; la pelota,
         solo con «Una pelota por ruta»). Se mide aislado: mediana de 11 lotes de 20 fotogramas, con la memo caliente como en un
         lienzo vivo. La diferencia entre fotogramas completos (~30 ms) dio +0,04 / +0,81 / +1,32 / +2,57 ms en pasadas distintas,
         según la carga de la máquina: es ruido de medida y se informa, igual que el coste en frío (tras vaciar la memo). */
      const alone = await PT.page.evaluate(() => { const es = P().edges, pts = es.map((e) => edgePoints(e)), Bs = es.map((e) => nodeById(e.to));
        const pass = () => { for (let i = 0; i < es.length; i++) skinEdgeLanding(pts[i], Bs[i]); };
        SKIN_LANDING_T.clear(); let t = performance.now(); pass(); const cold = performance.now() - t;
        for (let k = 0; k < 5; k++) pass();
        const lots = []; for (let l = 0; l < 11; l++) { t = performance.now(); for (let k = 0; k < 20; k++) pass(); lots.push((performance.now() - t) / 20); }
        lots.sort((a, b) => a - b); return { ms: lots[5], cold, n: es.length }; });
      check(alone.ms <= 1, `fotograma con 300 nodos y ${alone.n} conexiones: el aterrizaje cuesta ${alone.ms.toFixed(2)} ms (mediana de 11 lotes, memo caliente)`);
      console.log(`    (informativo) en frío, tras vaciar la memo: ${alone.cold.toFixed(2)} ms una vez; fotograma completo con y sin aterrizaje en la misma página: mediana ${med(own) >= 0 ? "+" : ""}${med(own).toFixed(2)} ms`);
      const deltas = [], abs = [];
      for (let r = 0; r < 11; r++) { let a, b; if (r % 2 === 0) { a = await PT.page.evaluate(FRAME); b = await PB.page.evaluate(FRAME); } else { b = await PB.page.evaluate(FRAME); a = await PT.page.evaluate(FRAME); } deltas.push(a - b); abs.push(b); }
      console.log(`    (informativo) frente a la base, entre páginas: mediana ${med(deltas) >= 0 ? "+" : ""}${med(deltas).toFixed(2)} ms sobre ${med(abs).toFixed(1)} ms (${deltas.map((d) => d.toFixed(2)).join(" ")})`);
      check(PT.errors.length === 0 && PB.errors.length === 0, "0 errores de página en las páginas de rendimiento");
      await PT.ctx.close(); await PB.ctx.close();
    }

    check(T.errors.length === 0, "0 errores de página en el árbol" + (T.errors.length ? ": " + T.errors.join(" | ") : ""));
    await T.ctx.close(); if (B) await B.ctx.close();
  } finally { await browser.close(); now.server.close(); if (old) old.server.close(); if (oldDir) fs.rmSync(oldDir, { recursive: true, force: true }); }
  console.log(`\n${passed} OK, ${failed} fallos (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
