"use strict";
/* FLUYO-019.4b — La piel «construido» en el editor, en Chrome real. Se sirven el árbol de trabajo y la base eff5129 (antes del
   cambio). Repo en solo lectura; service worker bloqueado salvo en su propio smoke.
   · Q1  Plano: con nodo, conexión y multiselección, puerto en hover, marco rectangular y «Conectar», el lienzo del editor es el
         de eff5129 píxel a píxel; un documento «built» por debajo de 0,375 también; Present plano y el SVG, idénticos.
   · Q2  «built» sin selección: el lienzo del editor = el de Present con el mismo viewport (0 px), y no es el plano.
   · Q3  Zoom 0,37 frente a 0,38: el pintado, el acierto de las caras (clic real) y la fuente del textarea cambian juntos (y el
         textarea abierto se recoloca al cruzar el umbral).
   · Q4  Bloques n/e con contenedor: marco y esquinas del contenedor seleccionado, marcos de multiselección, extremos, codos y
         barras de la conexión seleccionada quedan VISIBLES (ninguna cara ni hoja los tapa): en el centro opaco de cada tirador el
         píxel es el del tirador repintado encima, y en las líneas del marco seleccionar cambia el píxel.
   · Q5  Cada marca pintada (esquinas, extremos, codos, barras, anillo, puerto) se acierta con un evento REAL en su centro
         pintado, a zoom 0,375, 1 y 2,5, con ratón y con dedo (el puerto, solo ratón); incluye el icono por el este (N1).
   · Q6  Clics reales sobre la tapa y el lateral de una hoja dentro de un contenedor, con una conexión que entra por el norte:
         selecciona la hoja; fuera de las caras, la conexión o el contenedor; y a zoom 2,5 arrastrar desde la tapa mueve la hoja
         (ni crea conexión ni mueve el contenedor).
   · Q7  Solapes: en cada punto donde se ve un nodo, el que se ve encima (píxeles: el único cuya omisión cambia el píxel) es el
         de hitTarget; «Traer al frente» no cambia lo que se ve ni lo que se acierta con la piel (P2) y sí en plano.
   · Q8  Editar un rótulo con la piel: familia y peso del textarea = skinLabelFont; 0 px de salto en la tinta del texto al
         confirmar; cambiar el aspecto con el textarea abierto lo recoloca.
   · Q9  Historia: colocar un evento de elemento sobre una cara lo pone en la hoja; uno de conexión sobre la conexión bajo la
         cara no se coloca, y sobre la parte visible de la conexión, sí (la prioridad de Q6).
   · Q11 Smoke: 390 y 1440, crema y oscuro, editor y Present con la piel; 0 errores de consola (capturas en FLUYO_SHOTS).
   · SW  De eff5129 (la CACHE anterior) al árbol (v95): instalada y activada, la anterior borrada, la página ejecuta los archivos nuevos.
   Uso: node test/fluyo-019-4b-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; SKIP_SW=1 sin el smoke del SW) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "eff5129";
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-4b-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* ───────── documentos ───────── */
const N = (id, x, y, w, h, ex) => Object.assign({ id, shape: "rect", x, y, w, h, label: "N" + id, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, pulse: false, tint: false, order: id }, ex || {});
const E = (id, from, to, ex) => Object.assign({ id, from, to, route: "ortho", waypoints: [], label: "", font: null, bold: false, animated: false, dashed: false, startArrow: false, endArrow: true, flowDir: "normal" }, ex || {});
const DOC = (nodes, edges, extra) => ({ version: 5, app: "fluyo", settings: Object.assign({ speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false }, extra && extra.settings || {}),
  doc: { theme: extra && extra.theme || "crema", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [{ name: "P", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 999, nodes, edges }] } });
const built = (d) => { const o = JSON.parse(JSON.stringify(d)); o.settings.skin = "built"; return o; };
/* catálogo plano con todo lo que pinta el editor */
const CATALOG = () => DOC([N(1, 200, 200, 140, 90, { label: "Servicio" }), N(2, 520, 200, 120, 120, { shape: "cylinder", label: "BD", color: "#7fa66b" }), N(3, 840, 200, 130, 110, { shape: "icon", icon: "kafka", label: "Kafka" }),
  N(4, 200, 480, 120, 80, { shape: "diamond", label: "¿?" }), N(5, 520, 480, 140, 80, { shape: "code", code: "x = 1", label: "" }), N(6, 840, 480, 100, 100, { shape: "circle", label: "C" }),
  N(7, 1150, 340, 160, 90, { label: "Destino", fill: "#f3e3c7" })],
  [E(10, 1, 2, { fromSide: "e", toSide: "w", label: "lee" }), E(11, 2, 7, { fromSide: "n", toSide: "n" }), E(12, 3, 7, { fromSide: "e", toSide: "e" }), E(13, 4, 5, { route: "straight" }),
   E(14, 5, 6, { waypoints: [{ x: 680, y: 600 }, { x: 760, y: 600 }] }), E(15, 6, 7, { fromSide: "e", toSide: "w", dashed: true, startArrow: true })]);
/* bloques n/e dentro de un contenedor: la hoja H toca la esquina NE del contenedor con su tapa y su lateral (Q4) */
const ZONE = (theme) => DOC([N(1, 500, 400, 600, 400, { label: "Zona", border: "dashed", fill: "none", color: "#8a8275" }), N(2, 500, 430, 160, 80, { label: "Hoja", fill: "#cfe0ee" }),
  N(3, 500, 130, 120, 60, { label: "Arriba", color: "#c0392b", fill: "#f2c9c3" }), N(4, 950, 430, 120, 60, { label: "Este", color: "#1e8449", fill: "#c9e8d2" }),
  N(5, 757, 228, 110, 60, { label: "Esquina", color: "#7d3c98", fill: "#e3cdee" }), N(6, 330, 300, 100, 60, { label: "Vecina", color: "#b9770e", fill: "#f3dfb8" }),
  N(8, 1250, 430, 140, 110, { shape: "icon", icon: "kafka", label: "Kafka" }), N(9, 1250, 120, 110, 60, { label: "Origen" })],
  [E(10, 3, 2, { fromSide: "s", toSide: "n", lineColor: "#c0392b" }), E(11, 4, 2, { fromSide: "w", toSide: "e", lineColor: "#1e8449" }), E(12, 6, 2, { fromSide: "n", toSide: "n", waypoints: [{ x: 330, y: 230 }, { x: 470, y: 230 }], lineColor: "#2471a3" }),
   E(13, 9, 8, { fromSide: "e", toSide: "e", lineColor: "#7d3c98" }), E(14, 5, 4, { route: "straight", lineColor: "#555555" })], { theme });
/* solapes con colores bien distintos */
const OVERLAP = () => DOC([N(1, 400, 300, 140, 90, { label: "A", color: "#c0392b", fill: "#e8a99f" }), N(2, 460, 262, 140, 90, { label: "B", color: "#2471a3", fill: "#9fc3e0" }),
  N(3, 520, 340, 140, 90, { label: "C", color: "#1e8449", fill: "#9fd6b1" }), N(4, 690, 300, 120, 80, { label: "D", color: "#7d3c98", fill: "#cfa8e0" }),
  N(5, 816, 300, 120, 80, { label: "E", color: "#b9770e", fill: "#f0cf95" }), N(6, 1000, 300, 100, 100, { shape: "circle", label: "F", color: "#117a65", fill: "#a3dccf" }),
  N(7, 1050, 330, 120, 80, { label: "G", color: "#922b21", fill: "#e6b0aa" })], []);

/* ───────── ayudantes de página ───────── */
const SETUP = () => {
  if (window.__b) return;
  const W = () => cv.width / (cv.fluyoDpr || 1), H = () => cv.height / (cv.fluyoDpr || 1);
  const B = window.__b = {};
  B.view = (z, cx, cy) => { viewZoom = z; viewX = Math.round(W() / 2 - cx * z); viewY = Math.round(H() / 2 - cy * z); };
  B.frame = () => { renderEditorFrame(); };
  B.img = () => { renderEditorFrame(); return ctx.getImageData(0, 0, cv.width, cv.height).data; };
  B.hash = async () => { const d = B.img(); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", d.buffer))].map((b) => b.toString(16).padStart(2, "0")).join(""); };
  B.scr = (p) => { const r = cv.getBoundingClientRect(); return { x: r.left + viewX + p.x * viewZoom, y: r.top + viewY + p.y * viewZoom }; };
  B.px = (d, p) => { const X = Math.round(viewX + p.x * viewZoom - 0.5), Y = Math.round(viewY + p.y * viewZoom - 0.5), i = (Y * cv.width + X) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  /* el lienzo del editor fuera de pantalla, con su renderState real (y un viewport a medida si se pide) */
  B.off = (over) => { const rs = buildEditorRenderState(); Object.assign(rs.viewport, { x: viewX, y: viewY, zoom: viewZoom, width: 1200, height: 800, dpr: 1 }, over || {});
    const c = document.createElement("canvas"); c.width = 1200; c.height = 800; const x = c.getContext("2d"); render(x, now(), { renderState: rs }); return x.getImageData(0, 0, 1200, 800).data; };
  B.diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
  /* marcas tal como se pintan: centros de círculos, cuadrados y barras dentro de drawNodeSelection/drawEdgeHandles/drawConnectPort */
  B.marks = () => {
    const out = [], P2 = CanvasRenderingContext2D.prototype, keep = { arc: P2.arc, rect: P2.rect, moveTo: P2.moveTo, lineTo: P2.lineTo };
    let who = null, last = null;
    P2.arc = function (x, y, r) { if (who) out.push({ who, k: "arc", x, y, r }); return keep.arc.apply(this, arguments); };
    P2.rect = function (x, y, w, h) { if (who) out.push({ who, k: "rect", x: x + w / 2, y: y + h / 2, r: w / 2 }); return keep.rect.apply(this, arguments); };
    P2.moveTo = function (x, y) { last = { x, y }; return keep.moveTo.apply(this, arguments); };
    P2.lineTo = function (x, y) { if (who === "edge" && last && this.lineCap === "round") out.push({ who, k: "bar", x: (last.x + x) / 2, y: (last.y + y) / 2, r: 0 }); return keep.lineTo.apply(this, arguments); };
    const wrap = (name, tag) => { const f = window[name]; window[name] = function () { who = tag; try { return f.apply(this, arguments); } finally { who = null; } }; return () => { window[name] = f; }; };
    const un = [wrap("drawNodeSelection", "node"), wrap("drawEdgeHandles", "edge"), wrap("drawConnectPort", "port")];
    try { renderEditorFrame(); } finally { un.forEach((u) => u()); Object.assign(P2, keep); }
    /* las barras se pintan dos veces (fondo y tinta): una sola */
    return out.filter((m, i) => m.k !== "bar" || !out.slice(0, i).some((o) => o.k === "bar" && Math.abs(o.x - m.x) < 1e-6 && Math.abs(o.y - m.y) < 1e-6));
  };
  B.state = () => ({ touches: activeTouches.size, pinch: !!pinch, endDrag: endDrag && endDrag.which, route: routePending && routePending.kind, resizing: !!resizing, port: !!connectPending, drag: !!drag, sel: (() => { const s = singleSel(); return s ? s.type + s.obj.id : (selN.size || selE.size ? "multi" : null); })() });
  B.reset = () => { if (editing) cancelEditBox(); endDrag = null; routePending = null; resizing = null; connectPending = null; connectDrag = null; drag = null; marquee = null; segDrag = null; wpDrag = null; };
};
async function editor(browser, base, vp, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: "block", deviceScaleFactor: 1 }, opts || {}));
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); }); page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined" && typeof renderEditorFrame === "function");
  await page.evaluate(SETUP); await page.evaluate(() => document.fonts.ready);
  const load = async (d) => {
    await page.evaluate((d) => { applyProjectData(d); clearSel(); playing = false; pausedAt = 0.5; hoverNode = null; mouse.x = -9999; mouse.y = -9999; __b.reset(); }, d);
    await page.evaluate(async () => { for (const n of P().nodes) if (n.shape === "icon") { const im = getImg(iconURLFor(n.icon, nodeIconTint(n))); if (!im.complete) await new Promise((r) => { im.onload = im.onerror = r; }); } await waitForRenderFonts(doc, 2500, settings); });
  };
  return { ctx, page, errors, load };
}
/* eventos reales: ratón o dedo (CDP), con lectura del estado entre la pulsación y la suelta */
async function press(T, p, touch) {
  const under = await T.page.evaluate((p) => { const el = document.elementFromPoint(p.x, p.y); return el ? (el.id || el.className || el.tagName) : null; }, p);
  if (touch) { await T.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, id: 1 }] }); }
  else { await T.page.mouse.move(p.x, p.y); await T.page.mouse.down(); }
  /* el estado se lee y el gesto se anula ANTES de soltar: la suelta no debe completar nada (ni reenganchar un extremo) */
  const st = await T.page.evaluate(() => { const s = __b.state(); __b.reset(); return s; });
  st.under = under;
  if (touch) await T.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); else await T.page.mouse.up();
  await T.page.evaluate(() => __b.reset());
  return st;
}

(async () => {
  const t0 = Date.now();
  const oldDir = treeAt(BASE);
  const now = await serve(root), old = await serve(oldDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const D1440 = { width: 1440, height: 900 };
  try {
    const T = await editor(browser, now.base, D1440), O = await editor(browser, old.base, D1440);

    console.log("── Q1 · plano: el lienzo del editor es el de " + BASE + " píxel a píxel");
    {
      const states = [
        ["nodo seleccionado + puerto en hover", "selectOnly('node', 1); hoverNode = nodeById(1); mouse.x = 200; mouse.y = 140; __b.view(1, 640, 380)"],
        ["conexión seleccionada (extremos, codos, barras)", "selectOnly('edge', 14); hoverNode = null; __b.view(1.5, 700, 520)"],
        ["multiselección + marco rectangular + «Conectar»", "selN = new Set([1, 2, 3]); selE = new Set([10, 11]); refreshPanel(); marquee = { x0: 100, y0: 100, x1: 600, y1: 400 }; touchLink = 6; __b.view(0.8, 640, 380)"],
        ["zoom 2,5 con la conexión del icono", "marquee = null; touchLink = null; selectOnly('edge', 12); __b.view(2.5, 1100, 250)"],
      ];
      for (const [skin, z] of [[null, null], ["built", 0.3], ["built", 0.37]]) {
        await T.load(skin ? built(CATALOG()) : CATALOG()); await O.load(CATALOG());
        for (const [k, code] of states) {
          const js = "(async()=>{ " + code + (z ? "; __b.view(" + z + ", 640, 380)" : "") + "; return __b.hash(); })()";
          const a = await T.page.evaluate(js), b = await O.page.evaluate(js);
          check(a === b, `${skin ? "built @" + z : "plano"} · ${k}: mismo lienzo que ${BASE}`);
        }
        await T.page.evaluate("marquee = null; touchLink = null; clearSel()"); await O.page.evaluate("marquee = null; touchLink = null; clearSel()");
      }
      await T.load(CATALOG()); await O.load(CATALOG());
      const svgA = await T.page.evaluate(() => buildSVGDocument(1)), svgB = await O.page.evaluate(() => buildSVGDocument(1));
      check(svgA === svgB, "plano: el SVG exportado es el de la base");
      const presentHash = (P) => P.evaluate(async () => { enterPresent(); await new Promise((r) => setTimeout(r, 250)); __b.view(1, 640, 380); const d = __b.off(); exitPresent();
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256", d.buffer))].map((b) => b.toString(16).padStart(2, "0")).join(""); });
      check(await presentHash(T.page) === await presentHash(O.page), "plano: Present pinta lo mismo que la base");
    }

    console.log("── Q2 · «built» sin selección: editor = Present con el mismo viewport (0 px)");
    {
      for (const d of [built(CATALOG()), built(ZONE("crema")), built(ZONE("dark"))]) {
        await T.load(d);
        const r = await T.page.evaluate(async () => {
          __b.view(1, 700, 380); const vx = viewX, vy = viewY, vz = viewZoom;
          const ed = __b.off(), fl = __b.off({ skin: "flat" });
          enterPresent(); await new Promise((r) => setTimeout(r, 250));
          viewX = vx; viewY = vy; viewZoom = vz;
          const pr = __b.off(), presentSkin = buildEditorRenderState().viewport.skin;
          exitPresent();
          return { same: __b.diff(ed, pr), vsFlat: __b.diff(ed, fl), presentSkin };
        });
        check(r.same === 0 && r.vsFlat > 1000 && r.presentSkin === "built", `${d.doc.theme}: editor = Present (${r.same} bytes distintos) y no es el plano (${r.vsFlat})`);
      }
    }

    console.log("── Q3 · 0,37 frente a 0,38: pintado, caras y textarea cambian juntos");
    {
      await T.load(built(ZONE("crema")));
      const res = {};
      for (const z of [0.37, 0.38]) {
        const g = await T.page.evaluate((z) => { __b.view(z, 500, 430); clearSel(); const n = nodeById(2), X = skinExtent(n);
          return { diffFlat: __b.diff(__b.off(), __b.off({ skin: "flat" })), face: __b.scr({ x: n.x + n.w / 2 + 5, y: n.y }), on: editorSkinOn() }; }, z);
        await T.page.mouse.click(g.face.x, g.face.y); await T.page.waitForTimeout(30);
        const sel = await T.page.evaluate(() => { const s = singleSel(); return s ? s.type + s.obj.id : null; });
        const font = await T.page.evaluate(() => { clearSel(); openEditorAt({ x: nodeById(2).x, y: nodeById(2).y }); renderEditorFrame(); const s = getComputedStyle(editBox); const r = { fam: s.fontFamily, w: s.fontWeight }; cancelEditBox(); return r; });
        res[z] = Object.assign(g, { sel, font });
      }
      check(res[0.37].diffFlat === 0 && !res[0.37].on && res[0.37].sel !== "node2" && /Georgia/.test(res[0.37].font.fam), `0,37: plano (0 bytes), el lateral no es de la hoja (${res[0.37].sel}), textarea ${res[0.37].font.fam} ${res[0.37].font.w}`);
      check(res[0.38].diffFlat > 100 && res[0.38].on && res[0.38].sel === "node2" && /Plex/.test(res[0.38].font.fam) && res[0.38].font.w === "500", `0,38: piel (${res[0.38].diffFlat} bytes), el lateral es de la hoja, textarea ${res[0.38].font.fam} ${res[0.38].font.w}`);
      const cross = await T.page.evaluate(async () => { __b.view(0.37, 500, 430); openEditorAt({ x: nodeById(2).x, y: nodeById(2).y }); renderEditorFrame(); const a = getComputedStyle(editBox).fontFamily;
        viewZoom = 0.38; renderEditorFrame(); const b = getComputedStyle(editBox).fontFamily; cancelEditBox(); return { a, b }; });
      check(/Georgia/.test(cross.a) && /Plex/.test(cross.b), "con el textarea abierto, cruzar el umbral le cambia la voz en el siguiente fotograma");
    }

    console.log("── Q4 · las marcas del editor quedan visibles sobre caras, hojas y conexiones");
    {
      for (const theme of ["crema", "dark"]) {
        await T.load(built(ZONE(theme)));
        const r = await T.page.evaluate(() => {
          const out = []; __b.view(1.4, 640, 330);
          const M = editorMark(doc.theme), zoom = viewZoom;
          const repaint = (fn) => { const d = __b.img(); ctx.save(); ctx.setTransform(zoom, 0, 0, zoom, viewX, viewY); fn(); ctx.restore(); const r = ctx.getImageData(0, 0, cv.width, cv.height).data; return [d, r]; };
          const rs = () => { const s = buildEditorRenderState(); s.skinOn = true; return s; };
          /* 1) contenedor seleccionado: sus cuatro esquinas (la NE bajo la tapa de «Esquina») y su marco cruzando la tapa y el lateral */
          selectOnly("node", 1);
          let [d, rr] = repaint(() => drawNodeSelection(ctx, nodeById(1), doc.theme, rs()));
          for (const [x, y] of nodeCorners(nodeById(1))) out.push({ k: "esquina contenedor " + x + "," + y, ok: __b.px(d, { x, y }).join() === __b.px(rr, { x, y }).join() });
          clearSel(); const d0 = __b.img(); selectOnly("node", 1); const d1 = __b.img();
          const Z = nodeById(1), y0 = Z.y - Z.h / 2 - 6, x1 = Z.x + Z.w / 2 + 6;
          for (const p of [{ x: 760, y: y0 }, { x: 790, y: y0 }, { x: x1, y: 205 }, { x: x1, y: 222 }]) out.push({ k: "marco del contenedor sobre la hoja " + p.x + "," + p.y, ok: __b.px(d1, p).join() !== __b.px(d0, p).join() });
          /* 2) multiselección: los marcos de dos hojas solapadas con caras ajenas */
          selN = new Set([2, 5, 4]); selE = new Set(); refreshPanel(); const m1 = __b.img(); clearSel(); const m0 = __b.img();
          for (const id of [2, 5, 4]) { const n = nodeById(id); for (const p of [{ x: n.x, y: n.y - n.h / 2 - 6 }, { x: n.x + n.w / 2 + 6, y: n.y }]) out.push({ k: "marco de " + n.label, ok: __b.px(m1, p).join() !== __b.px(m0, p).join() }); }
          /* 3) conexiones seleccionadas: extremos (el de salida bajo la tapa de su origen), codos y barras */
          for (const id of [12, 10, 11, 13]) {
            selectOnly("edge", id); const e = edgeById(id), pts = edgePaintedPoints(e, true);
            [d, rr] = repaint(() => drawEdgeHandles(ctx, e, pts, M, zoom));
            const hp = edgeHandlePts(e), pick = [pts[0], pts[pts.length - 1], ...(e.waypoints || []), ...bendableSegs(e, hp).map((i) => ({ x: (hp[i].x + hp[i + 1].x) / 2, y: (hp[i].y + hp[i + 1].y) / 2 }))];
            for (const p of pick) out.push({ k: "tirador de la conexión " + id + " en " + p.x.toFixed(1) + "," + p.y.toFixed(1), ok: __b.px(d, p).join() === __b.px(rr, p).join() });
          }
          clearSel();
          return out;
        });
        const bad = r.filter((x) => !x.ok);
        if (shots) for (const [k, code] of [["contenedor", "selectOnly('node', 1)"], ["conexion", "selectOnly('edge', 12)"], ["multi", "selN = new Set([2, 5, 4]); selE = new Set([10]); refreshPanel()"]]) {
          await T.page.evaluate("__b.view(1.4, 640, 330); " + code + "; renderEditorFrame()");
          await T.page.screenshot({ path: path.join(shots, `q4-${theme}-${k}.png`), clip: { x: 300, y: 120, width: 820, height: 560 } });
          await T.page.evaluate("clearSel()");
        }
        check(r.length >= 25 && bad.length === 0, `${theme}: ${r.length - bad.length}/${r.length} marcas visibles` + (bad.length ? " — tapadas: " + bad.slice(0, 6).map((b) => b.k).join(" · ") : ""));
      }
    }

    console.log("── Q5 · cada marca pintada se acierta con un evento real (0,375 · 1 · 2,5; ratón y dedo)");
    {
      for (const touch of [false, true]) {
        const Tt = touch ? await editor(browser, now.base, D1440, { hasTouch: true }) : T;
        if (touch) Tt.cdp = await Tt.ctx.newCDPSession(Tt.page); else T.cdp = null;
        await Tt.load(built(ZONE("crema")));
        const rows = [];
        for (const z of [0.375, 1, 2.5]) {
          for (const [kind, id, focus] of [["edge", 13, { x: 1250, y: 300 }], ["edge", 12, { x: 400, y: 300 }], ["edge", 10, { x: 500, y: 300 }], ["edge", 14, { x: 850, y: 330 }], ["node", 2, { x: 500, y: 430 }]]) {
            const marks = await Tt.page.evaluate(([kind, id, z, f]) => { __b.view(z, f.x, f.y); selectOnly(kind, id); hoverNode = null; mouse.x = -9999; return __b.marks().filter((m) => m.who === kind).map((m) => Object.assign(m, { s: __b.scr(m) })); }, [kind, id, z, focus]);
            if (!marks.length) { rows.push({ ok: false, k: `${kind}${id} @${z}: no se pinta ninguna marca` }); continue; }
            for (const [mi, m] of marks.entries()) {
              /* la vista se centra en la marca (la posición pintada en el mundo no depende de la vista) */
              /* cada toque en otro punto de la pantalla (escalonado 70 px): dos toques en el mismo sitio serían un doble toque del navegador */
              const g = await Tt.page.evaluate(([kind, id, z, m, touch, dx]) => { selectOnly(kind, id); __b.view(z, m.x - dx / z, m.y); renderEditorFrame();
                /* ¿lo captura antes un extremo? (orden de la decisión 144: extremo → codo → tramo, con el radio del dedo o del ratón) */
                const r = touch ? Math.max(16, 22 / z) : Math.max(9, 7 / z), e = kind === "edge" ? edgeById(id) : null;
                const lp = e && edgePoints(e), vp = e && edgePaintedPoints(e, true), d = (q) => Math.hypot(m.x - q.x, m.y - q.y);
                const logical = !!e && (d(lp[0]) < r || d(lp[lp.length - 1]) < r), painted = !!e && d(vp[vp.length - 1]) < r;
                const lpt = lastPointerType; lastPointerType = touch ? "touch" : "mouse";
                const diag = e ? [hitEdgeEnd(e, m.x, m.y), hitWaypoint(e, m.x, m.y), hitSegment(e, m.x, m.y), JSON.stringify(edgeHandlePts(e).map(q=>[Math.round(q.x),Math.round(q.y)])), JSON.stringify(bendableSegs(e, edgeHandlePts(e)))].join("/") : hitCorner(nodeById(id), m.x, m.y);
                lastPointerType = lpt;
                return { s: __b.scr(m), logical, skinOnly: painted && !logical, diag }; }, [kind, id, z, m, touch, ((mi % 5) - 2) * 70]);
              m.s = g.s; m.crowd = g.logical; m.skinCrowd = g.skinOnly; m.diag = g.diag;
              const st = await press(Tt, m.s, touch);
              if (touch) await Tt.page.waitForTimeout(420);   /* dos toques seguidos serían un doble toque (editar o quitar un codo) */
              const end = m.k === "arc" && m.r >= 4 / z;
              /* un codo o una barra a menos de un radio de dedo de un extremo LÓGICO lo captura el extremo, igual que en plano (solape
                 previo de 018.16, no de la piel); uno que solo capture la punta aterrizada sería un solape nuevo: falla */
              const want = kind === "node" ? st.resizing : end ? !!st.endDrag : m.skinCrowd ? false : m.crowd ? !!st.endDrag : m.k === "rect" ? st.route === "wp" : st.route === "seg";
              rows.push({ ok: want, crowd: !end && m.crowd, k: `${kind}${id} ${m.k} (${m.x.toFixed(1)},${m.y.toFixed(1)}) @${z}${m.crowd && !end ? " [solape previo]" : ""} → ${JSON.stringify(st)} acierto ${m.diag}` });
            }
          }
          if (!touch) {
            /* el puerto (solo ratón): se pinta al pasar por encima y se acierta donde se pinta */
            const port = await Tt.page.evaluate((z) => { __b.view(z, 500, 430); clearSel(); const n = nodeById(2); hoverNode = n; mouse.x = n.x; mouse.y = n.y - n.h / 2 - 10; const m = __b.marks().find((m) => m.who === "port"); return m ? Object.assign(m, { s: __b.scr(m) }) : null; }, z);
            if (port) { await Tt.page.mouse.move(port.s.x, port.s.y); const st = await press(Tt, port.s, false); rows.push({ ok: st.port, k: `puerto @${z} → ${JSON.stringify(st)}` }); }
            else rows.push({ ok: false, k: "puerto @" + z + " sin pintar" });
          }
        }
        const bad = rows.filter((r) => !r.ok);
        check(rows.length > 40 && bad.length === 0, `${touch ? "dedo" : "ratón"}: ${rows.length - bad.length}/${rows.length} marcas acertadas (${rows.filter((r) => r.crowd).length} codos/barras a menos de un radio de un extremo lógico: los captura el extremo, como en plano)` + (bad.length ? " — " + bad.slice(0, 5).map((b) => b.k).join(" · ") : ""));
        const n1 = rows.find((r) => r.k.startsWith("edge13 arc") && r.k.includes("@1 "));
        check(!!n1, "N1: el extremo del icono por el este está en la batería (" + (n1 && n1.k) + ")");
        if (touch) await Tt.ctx.close();
      }
    }

    console.log("── Q6 · tapa y lateral de una hoja dentro de un contenedor, con una conexión por el norte (clics reales)");
    {
      for (const touch of [false, true]) {
        const Tt = touch ? await editor(browser, now.base, D1440, { hasTouch: true }) : T;
        if (touch) Tt.cdp = await Tt.ctx.newCDPSession(Tt.page);
        await Tt.load(built(ZONE("crema")));
        for (const z of [1, 2.5]) {
          const pts = await Tt.page.evaluate((z) => { __b.view(z, 500, 400); const n = nodeById(2), X = skinExtent(n), out = [];
            const x0 = n.x - n.w / 2, x1 = n.x + n.w / 2, y0 = n.y - n.h / 2, y1 = n.y + n.h / 2;
            for (let i = 0; i < 8; i++) out.push({ k: "tapa", w: { x: x0 + 6 + i * (n.w - 4) / 8, y: y0 - 6.5 }, want: "node2" });
            for (let i = 0; i < 6; i++) out.push({ k: "lateral", w: { x: x1 + 6.5, y: y0 + 2 + i * (n.h - 14) / 6 }, want: "node2" });
            const vp = edgePaintedPoints(edgeById(10), true), za = vp[vp.length - 1], zb = vp[vp.length - 2], L = Math.hypot(zb.x - za.x, zb.y - za.y);
            const q = { x: za.x + (zb.x - za.x) / L * 12, y: za.y + (zb.y - za.y) / L * 12 }, e = hitEdge(q.x, q.y);
            out.push({ k: "conexión 10 por encima de la tapa (fuera de las caras)", w: q, want: e && q.y < X.y0 ? "edge" + e.id : "falta una conexión en " + q.x + "," + q.y });
            out.push({ k: "contenedor", w: { x: x1 + 40, y: y1 + 40 }, want: "node1" });
            return out.map((o) => Object.assign(o, { s: __b.scr(o.w) })); }, z);
          let ok = 0; const bad = [];
          for (const p of pts) {
            await Tt.page.evaluate(() => clearSel());
            if (touch) { await Tt.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.s.x, y: p.s.y, id: 1 }] }); await Tt.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
            else await Tt.page.mouse.click(p.s.x, p.s.y);
            await Tt.page.waitForTimeout(20);
            const sel = await Tt.page.evaluate(() => { const s = singleSel(); return s ? s.type + s.obj.id : null; });
            if (sel === p.want) ok++; else bad.push(p.k + "→" + sel);
            await Tt.page.waitForTimeout(340);   /* sin doble toque */
          }
          check(bad.length === 0, `${touch ? "dedo" : "ratón"} @${z}: ${ok}/${pts.length} clics donde corresponde` + (bad.length ? " — " + bad.join(" · ") : ""));
        }
        if (touch) await Tt.ctx.close();
      }
      /* arrastre desde la tapa a zoom 2,5 con el puntero encima (el puerto norte está pintado): mueve la hoja */
      await T.load(built(ZONE("crema")));
      const g = await T.page.evaluate(() => { __b.view(2.5, 500, 400); clearSel(); const n = nodeById(2); return { a: __b.scr({ x: n.x, y: n.y - n.h / 2 - 6 }), b: __b.scr({ x: n.x + 30, y: n.y - n.h / 2 - 6 + 16 }), x: n.x, y: n.y, edges: P().edges.length, zx: nodeById(1).x, undo: undoStack.length }; });
      await T.page.mouse.move(g.a.x, g.a.y - 3); await T.page.mouse.move(g.a.x, g.a.y); await T.page.waitForTimeout(30);
      const hovered = await T.page.evaluate(() => !!arrowHostNode() && arrowHostNode().id);
      await T.page.mouse.down(); await T.page.mouse.move(g.a.x + 20, g.a.y + 10, { steps: 4 }); await T.page.mouse.move(g.b.x, g.b.y, { steps: 4 }); await T.page.mouse.up();
      const after = await T.page.evaluate(() => ({ x: nodeById(2).x, y: nodeById(2).y, edges: P().edges.length, zx: nodeById(1).x, undo: undoStack.length, sel: singleSel() && singleSel().type + singleSel().obj.id }));
      check(hovered === 2 && after.x === g.x + 30 && after.y === g.y + 16 && after.edges === g.edges && after.zx === g.zx && after.undo === g.undo + 1 && after.sel === "node2",
        `zoom 2,5: arrastrar desde la tapa (con el puerto norte en pantalla) mueve la hoja ${JSON.stringify({ hovered, dx: after.x - g.x, dy: after.y - g.y, conexiones: after.edges - g.edges, contenedor: after.zx - g.zx, undo: after.undo - g.undo })}`);
    }

    console.log("── Q7 · solapes: lo que se ve encima es lo que se acierta; «Traer al frente» (P2)");
    {
      await T.load(built(OVERLAP()));
      const r = await T.page.evaluate(() => {
        __b.view(1.3, 700, 310); clearSel();
        const full = __b.img(), ids = P().nodes.map((n) => n.id), skip = {};
        const dn = window.drawNode;
        for (const id of ids) { window.drawNode = function (c, n) { if (n.id === id) return; return dn.apply(this, arguments); }; skip[id] = __b.img(); }
        const alone = {}; window.drawNode = function () {}; const empty = __b.img();
        for (const id of ids) { window.drawNode = function (c, n) { if (n.id !== id) return; return dn.apply(this, arguments); }; alone[id] = __b.img(); }
        window.drawNode = dn;
        let tol = 0;
        let agree = 0, seen = 0; const bad = [];
        for (let x = 300; x <= 1140; x += 4) for (let y = 190; y <= 400; y += 4) {
          const p = { x, y }, a = __b.px(full, p).join();
          const vis = ids.filter((id) => __b.px(skip[id], p).join() !== a);
          if (vis.length !== 1) continue;
          const t = hitTarget(x, y), hid = t && t.kind === "node" ? t.obj.id : null;
          /* el nodo acertado no pinta ese punto: es su franja de tolerancia (caja + 4, envolvente de skinExtent), la misma en plano */
          if (hid !== vis[0] && hid !== null && __b.px(alone[hid], p).join() === __b.px(empty, p).join()) { tol++; continue; }
          seen++;
          if (hid === vis[0]) agree++; else if (bad.length < 6) bad.push(x + "," + y + " se ve " + vis[0] + ", acierta " + hid);
        }
        const h0 = full.join(","), hit0 = []; for (let x = 300; x <= 1140; x += 6) for (let y = 190; y <= 400; y += 6) { const t = hitTarget(x, y); hit0.push(t && t.obj.id); }
        selectOnly("node", 1); bringToFront(); clearSel();
        const h1 = __b.img().join(","), hit1 = []; for (let x = 300; x <= 1140; x += 6) for (let y = 190; y <= 400; y += 6) { const t = hitTarget(x, y); hit1.push(t && t.obj.id); }
        return { agree, seen, bad, tol, sameImg: h0 === h1, sameHit: JSON.stringify(hit0) === JSON.stringify(hit1) };
      });
      check(r.seen > 400 && r.agree === r.seen, `con la piel: ${r.agree}/${r.seen} puntos, el nodo que se ve encima es el de hitTarget (${r.tol} en franjas de tolerancia)` + (r.bad.length ? " — " + r.bad.join(" · ") : ""));
      check(r.sameImg && r.sameHit, "«Traer al frente» entre hojas con piel no cambia lo que se ve ni lo que se acierta (P2, aceptado)");
      await T.load(OVERLAP());
      const f = await T.page.evaluate(() => { __b.view(1.3, 700, 310); clearSel(); const a = __b.img().join(","); selectOnly("node", 1); bringToFront(); clearSel(); return a !== __b.img().join(","); });
      check(f, "en plano, «Traer al frente» sigue cambiando lo que se ve");
    }

    console.log("── Q8 · editar un rótulo con la piel: voz de skinLabelFont y 0 px de salto al confirmar");
    {
      const ink = async (P, box) => P.evaluate((box) => { const d = ctx.getImageData(box.x, box.y, box.w, box.h).data, bg = d.slice(0, 3); let top = null, bot = null, left = null, right = null;
        for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) { const i = (y * box.w + x) * 4; if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 140) { if (top === null) top = y; bot = y; left = left === null ? x : Math.min(left, x); right = right === null ? x : Math.max(right, x); } }
        return { top, bot, left, right }; }, box);
      const out = {};
      for (const skin of ["built", "flat"]) {
        const d = DOC([N(1, 500, 400, 240, 90, { label: "SERVICIO DE ACCESO", fill: "#ffffff", color: "#333333" })], [], {});
        await T.load(skin === "built" ? built(d) : d);
        const g = await T.page.evaluate(() => { __b.view(2, 500, 400); clearSel(); renderEditorFrame(); const n = nodeById(1), a = __b.scr({ x: n.x - n.w / 2 + 8, y: n.y - n.h / 2 + 8 }), b = __b.scr({ x: n.x + n.w / 2 - 8, y: n.y + n.h / 2 - 8 }), r = cv.getBoundingClientRect();
          return { c: __b.scr(n), box: { x: Math.round(a.x - r.left), y: Math.round(a.y - r.top), w: Math.round(b.x - a.x), h: Math.round(b.y - a.y) } }; });
        const painted = await ink(T.page, g.box);
        await T.page.mouse.dblclick(g.c.x, g.c.y); await T.page.waitForTimeout(80);
        const st = await T.page.evaluate(() => { const s = getComputedStyle(editBox); return { open: editBox.style.display === "block", fam: s.fontFamily, w: s.fontWeight, want: (nodeLabelVoice(nodeById(1), editorSkinOn()) || {}) }; });
        await T.page.evaluate(() => { editBox.setSelectionRange(0, 0); });
        await T.page.waitForTimeout(60);
        const shot = await T.page.screenshot({ clip: { x: g.box.x + (await T.page.evaluate(() => cv.getBoundingClientRect().left)), y: g.box.y + (await T.page.evaluate(() => cv.getBoundingClientRect().top)), width: g.box.w, height: g.box.h } });
        const editing = await T.page.evaluate(async (b64) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height).data, bg = d.slice(0, 3); let top = null, bot = null, left = null, right = null;
          for (let y = 0; y < c.height; y++) for (let X = 0; X < c.width; X++) { const i = (y * c.width + X) * 4; if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 140) { if (top === null) top = y; bot = y; left = left === null ? X : Math.min(left, X); right = right === null ? X : Math.max(right, X); } }
          return { top, bot, left, right }; }, shot.toString("base64"));
        await T.page.keyboard.press("Enter").catch(() => {});
        await T.page.evaluate(() => commitEditBox()); await T.page.waitForTimeout(40);
        const after = await ink(T.page, (await T.page.evaluate(() => { renderEditorFrame(); return null; }), g.box));
        out[skin] = { st, painted, editing, after };
      }
      const b = out.built, f = out.flat;
      check(b.st.open && /Plex/.test(b.st.fam) && b.st.w === "500" && b.st.want.family && b.st.fam.includes("IBM Plex Mono"), `con la piel: textarea ${b.st.fam} ${b.st.w} (skinLabelFont: ${b.st.want.family} ${b.st.want.weight})`);
      check(/Georgia/.test(f.st.fam) && f.st.w === "400", `en plano: textarea ${f.st.fam} ${f.st.w}, como siempre`);
      /* línea base = borde inferior de la tinta (mayúsculas, sin descendentes); el ascendente lo pinta cada motor de texto a su manera (también en plano) */
      const jump = (o) => o.editing.bot === null ? 99 : Math.abs(o.editing.bot - o.painted.bot);
      check(b.painted.bot !== null && jump(b) === 0 && b.after.top === b.painted.top && b.after.bot === b.painted.bot && Math.abs(b.editing.left - b.painted.left) <= 1 && Math.abs(b.editing.right - b.painted.right) <= 1, `con la piel: 0 px de salto de la línea base y los mismos saltos de línea (pintado ${b.painted.top}–${b.painted.bot}, editando ${b.editing.top}–${b.editing.bot}, confirmado ${b.after.top}–${b.after.bot})`);
      console.log(`    control en plano (previo, sin cambios: el plano no se toca): ${jump(f)} px de línea base con Georgia (ascendente: pintado ${f.painted.top}, editando ${f.editing.top})`);
      check(jump(b) <= jump(f), `con la piel, el salto (${jump(b)} px) no es mayor que el del plano de siempre (${jump(f)} px)`);
      /* cambiar el aspecto con el textarea abierto (sin mover la vista): se recoloca con la voz nueva */
      await T.load(DOC([N(1, 500, 400, 240, 90, { label: "Servicio de pagos" })], []));
      const tog = await T.page.evaluate(() => { __b.view(1.5, 500, 400); openEditorAt({ x: 500, y: 400 }); renderEditorFrame(); const a = getComputedStyle(editBox).fontFamily; setDocumentSkin("built"); renderEditorFrame(); const b = getComputedStyle(editBox).fontFamily; cancelEditBox(); setDocumentSkin("flat"); return { a, b }; });
      check(/Georgia/.test(tog.a) && /Plex/.test(tog.b), "cambiar «Aspecto» con el textarea abierto le cambia la voz al instante");
    }

    console.log("── Q9 · Historia: un evento sobre una cara y uno sobre la conexión bajo la cara");
    {
      await T.load(built(ZONE("crema")));
      const ids = await T.page.evaluate(() => {
        const fl = createEventTypeIn(doc, { name: "Pedido", primitive: "FLOW", sentenceTemplate: "{source} envía a {target}", visual: { value: "📦" } });
        const oc = createEventTypeIn(doc, { name: "Cae", primitive: "OCCURRENCE", sentenceTemplate: "{target} cae", visual: { value: "⚡" } });
        if (typeof scRenderLibrary === "function") scRenderLibrary();
        __b.view(2, 500, 400); clearSel(); const n = nodeById(2);
        return { fl: fl.id, oc: oc.id, top: __b.scr({ x: n.x, y: n.y - n.h / 2 - 5 }), edge: __b.scr({ x: n.x, y: n.y - n.h / 2 - 30 }) };
      });
      const place = async (et, p) => { await T.page.evaluate((et) => scBeginPlacement(et), et); await T.page.mouse.click(p.x, p.y); await T.page.waitForTimeout(40);
        return T.page.evaluate(() => { const sc = scActiveScenario(); const s = sc && sc.steps[sc.steps.length - 1]; const r = { n: sc ? sc.steps.length : 0, last: s ? { nodeId: s.nodeId, edgeId: s.edgeId } : null }; if (typeof scCancelPlacement === "function") scCancelPlacement(); return r; }); };
      const a = await place(ids.oc, ids.top), b = await place(ids.fl, ids.top), c = await place(ids.fl, ids.edge);
      check(a.last && a.last.nodeId === 2, `evento de elemento sobre la tapa → la hoja (${JSON.stringify(a.last)})`);
      check(b.n === a.n, `evento de conexión sobre la conexión que pasa bajo la tapa → no se coloca (${b.n} momentos)`);
      check(c.n === a.n + 1 && c.last.edgeId === 10, `evento de conexión sobre la parte visible de la conexión → la conexión (${JSON.stringify(c.last)})`);
    }

    console.log("── Q11 · smoke: 390 y 1440, crema y oscuro, editor y Present con la piel");
    {
      for (const vp of [{ k: "390", width: 390, height: 844, opts: { hasTouch: true, isMobile: true } }, { k: "1440", width: 1440, height: 900 }]) for (const theme of ["crema", "dark"]) {
        const S = await editor(browser, now.base, vp, vp.opts);
        await S.page.goto(now.base + "/?ejemplo=kafka-event-pipeline"); await S.page.waitForFunction(() => typeof P === "function" && P().nodes.length > 0); await S.page.evaluate(SETUP);
        await S.page.evaluate((theme) => { setDocumentSkin("built"); if (typeof setTheme === "function") setTheme(theme); else doc.theme = theme; playing = false; }, theme);
        await S.page.waitForTimeout(300);
        const info = await S.page.evaluate(() => { viewZoom = 1; const n = P().nodes[1]; viewX = Math.round(cv.width / (cv.fluyoDpr || 1) / 2 - n.x); viewY = Math.round(cv.height / (cv.fluyoDpr || 1) / 2 - n.y); selectOnly("node", n.id); renderEditorFrame(); return { on: editorSkinOn(), theme: doc.theme }; });
        if (shots) await S.page.screenshot({ path: path.join(shots, `q11-${vp.k}-${theme}-editor.png`) });
        await S.page.evaluate(() => { clearSel(); enterPresent(); }); await S.page.waitForTimeout(400);
        if (shots) await S.page.screenshot({ path: path.join(shots, `q11-${vp.k}-${theme}-present.png`) });
        await S.page.evaluate(() => exitPresent()); await S.page.waitForTimeout(100);
        check(info.on && info.theme === theme && S.errors.length === 0, `${vp.k} ${theme}: editor con la piel, Present y vuelta, 0 errores de consola (${S.errors.join(" | ")})`);
        await S.ctx.close();
      }
      check(T.errors.length === 0 && O.errors.length === 0, `0 errores de página en toda la batería (${T.errors.concat(O.errors).join(" | ")})`);
    }

    if (!process.env.SKIP_SW) {
      /* las dos versiones se leen de los sw.js (base y árbol): ningún literal de la anterior (fluyo-019-1 lo vigila) */
      const cacheOf = (dir) => /const CACHE = "([^"]+)";/.exec(fs.readFileSync(path.join(dir, "sw.js"), "utf8"))[1];
      const PREV = cacheOf(oldDir), CUR = cacheOf(root);
      console.log("── SW · de " + BASE + " (" + PREV + ") al árbol (" + CUR + ")");
      const sw = await serve(oldDir);
      const ctx = await browser.newContext({ viewport: D1440, deviceScaleFactor: 1 });
      await ctx.route((u) => !u.href.startsWith(sw.base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
      try {
        const pg = await ctx.newPage();
        await pg.goto(sw.base + "/"); await pg.waitForFunction(() => typeof renderTabs === "function");
        const until = async (fn, arg, label) => { const t = Date.now(); while (Date.now() - t < 60000) { if (await pg.evaluate(fn, arg)) return; await pg.waitForTimeout(250); } throw new Error("tiempo agotado: " + label); };
        const installed = (name) => until(async (name) => { if (!(await caches.keys()).includes(name)) return false; const c = await caches.open(name); return !!(await c.match(location.origin + "/js/editor-runtime.js")) && !!(await c.match(location.origin + "/js/interaction.js")); }, name, name);
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
        const live = await pg.evaluate(async (cur) => ({ fn: typeof editorSkinOn, ctrl: !!navigator.serviceWorker.controller, cached: (await (await (await caches.open(cur)).match(location.origin + "/js/editor-runtime.js")).text()).includes("function editorSkinOn") }), CUR);
        check(CUR === "fluyo-static-v108" && keys.join() === CUR && live.fn === "function" && live.ctrl && live.cached, `${CUR} instalada y activada, ${PREV} borrada (${keys.join()}); tras recargar, la página ejecuta el editor nuevo desde la caché`);
      } finally { await ctx.close(); sw.server.close(); }
    }
  } finally {
    await browser.close(); now.server.close(); old.server.close();
    fs.rmSync(oldDir, { recursive: true, force: true });
  }
  console.log(`\n${passed} ✔ · ${failed} ✘ (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
