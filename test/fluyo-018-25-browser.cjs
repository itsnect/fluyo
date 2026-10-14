"use strict";
/* FLUYO-018.25 — Chrome REAL, pasada dirigida (< 30 s): la ruta que se dobla sola.
   d1440 (ratón):
   · La captura con el gesto real: A→B con el puerto derecho y B→A con el puerto de ARRIBA de B soltando en el borde de arriba de A →
     la vuelta es una U limpia (0 retrocesos), no entra en ningún nodo, no comparte trazo con su hermana; en el lienzo y en el SVG del
     editor (buildSVGDocument), con la punta perpendicular y pegada al borde. Cada conexión creada = una entrada de Undo.
   · Un clic SIN mover sobre una barra (recta y Z), un anillo (`straight`) o un codo es inerte: el JSON de la conexión, las dos pilas
     (Rehacer sigue disponible) y «Volver a la ruta automática» no cambian.
   · Un movimiento real = exactamente UNA entrada de Undo; Undo devuelve el JSON exacto; Redo, el del gesto.
   · Una recta lleva UNA barra (centrada) y deslizarla da un puente sin diagonales; volver a la línea al soltar deja waypoints:[].
   · Escape a mitad devuelve el estado previo; Escape sin gesto no toca las pilas.
   · Matrices (4 posiciones × 25 lados): 0 clics que mutan; 0 diagonales en los gestos ±40, salvo las 4 conocidas del extremo
     flotante (F6, fuera de alcance por D10: típico null/w y e/null).
   · F5 fuera: mover un nodo NO limpia los waypoints de una ruta hecha a mano.
   · Regresión: test/editor-inline.html (suite existente de los gestos de tramo) sin fallos.
   m390 (dedo): un toque sin mover sobre la barra es inerte; arrastrar con el dedo desliza (puente, una entrada de Undo).
   Uso: node test/fluyo-018-25-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=d1440|m390   recorre solo ese viewport (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-25-"));
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

/* Utilidades que viven en la página (se inyectan una vez). Medidas iguales a las del test unitario. */
const PAGE_HELPERS = () => {
  window.__t = {
    reset(theme) {
      setUiMode("edit"); if (theme) setThemeIn(doc, { theme, customBg: "" });
      removeEdges(P().edges.map((e) => e.id)); removeNodes(P().nodes.map((n) => n.id));
      settings.snap = false; viewZoom = 1; viewX = 100; viewY = 0; clearSel(); undoStack.length = 0; redoStack.length = 0; scheduleAutosave();
    },
    fmt: (p) => p.map((q) => Math.round(q.x) + "," + Math.round(q.y)).join(" "),
    rev(p) { let n = 0; for (let i = 2; i < p.length; i++) { const a = p[i - 2], m = p[i - 1], c = p[i]; if ((m.x - a.x) * (c.x - m.x) + (m.y - a.y) * (c.y - m.y) < -1 && Math.abs((m.x - a.x) * (c.y - m.y) - (m.y - a.y) * (c.x - m.x)) < 1) n++; } return n; },
    diag: (p) => p.slice(1).filter((q, i) => Math.abs(q.x - p[i].x) > 1.5 && Math.abs(q.y - p[i].y) > 1.5).length,
    handles: (e) => (typeof edgeHandlePts === "function" ? edgeHandlePts(e) : edgePoints(e)),
    /* centro de la barra k-ésima de la conexión (en mundo) */
    bar(id, k) { const e = edgeById(id), p = __t.handles(e), b = bendableSegs(e, p); if (k >= b.length) return null; const i = b[k]; return { x: (p[i].x + p[i + 1].x) / 2, y: (p[i].y + p[i + 1].y) / 2, n: b.length }; },
    scr(p) { const r = cv.getBoundingClientRect(); return { x: r.left + viewX + p.x * viewZoom, y: r.top + viewY + p.y * viewZoom }; },
    fire(type, p, kind) { const s = __t.scr(p); cv.dispatchEvent(new PointerEvent(type, { pointerType: kind || "mouse", button: 0, bubbles: true, cancelable: true, isPrimary: true, pointerId: kind === "touch" ? 7 : 1, clientX: s.x, clientY: s.y })); },
    state: (id) => ({ e: JSON.stringify(edgeById(id)), u: undoStack.length, r: redoStack.length, rTop: JSON.stringify(redoStack[redoStack.length - 1] || null), wpsBtn: $("btnWps").style.display }),
    /* deja una entrada en Rehacer: así se ve si un gesto apila Undo (pushUndo vacía Rehacer) */
    primeRedo() { const n = P().nodes[0]; pushUndo(); editNode(n, { label: n.label + "·" }); undo(); },
  };
};

async function open(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof refreshPanel === "function" && typeof edgePoints === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(PAGE_HELPERS);
  return { ctx, page, errors, vp };
}
const W2S = (page, p) => page.evaluate((p) => __t.scr(p), p);
async function mouseDrag(page, from, to, opts = {}) {
  const a = await W2S(page, from), b = await W2S(page, to);
  await page.mouse.move(a.x - 30, a.y - 30); await page.mouse.move(a.x, a.y, { steps: 4 }); await page.waitForTimeout(40);
  await page.mouse.down();
  if (opts.via) { const v = await W2S(page, opts.via); await page.mouse.move(v.x, v.y, { steps: 6 }); }
  await page.mouse.move(b.x, b.y, { steps: 6 });
  if (opts.escape) { await page.keyboard.press("Escape"); }
  await page.mouse.up(); await page.waitForTimeout(60);
}
async function mouseClick(page, p) { const s = await W2S(page, p); await page.mouse.move(s.x, s.y); await page.waitForTimeout(20); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(50); }

async function desktop(browser, base) {
  const vp = { key: "d1440", width: 1440, height: 900 };
  console.log(`\n── ${vp.key} (${vp.width}×${vp.height}, ratón)`);
  const t = await open(browser, base, vp), page = t.page;

  /* 1 · La captura con el gesto real (tema crema, como la captura) */
  await page.evaluate(() => { __t.reset("crema"); viewZoom = 1.18; const a = newNode("rect", 300, 300, { label: "Nodo" }), b = newNode("rect", 700, 300, { label: "Nodo" }); window.__A = a.id; window.__B = b.id; undoStack.length = 0; });
  await mouseDrag(page, { x: 390 + 18 / 1.18, y: 300 }, { x: 700, y: 300 }, { via: { x: 550, y: 290 } });
  const solo = await page.evaluate(() => { clearSel(); return JSON.stringify(edgePoints(P().edges[0])); });   // la directa, sola
  await page.mouse.move(2, 2); await page.waitForTimeout(100);
  { const a = await W2S(page, { x: 150, y: 190 }), b = await W2S(page, { x: 850, y: 360 }); await page.screenshot({ path: path.join(shots, "d1440-captura-0-sola.png"), clip: { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y } }); }
  await mouseDrag(page, { x: 700, y: 265 - 18 / 1.18 }, { x: 300, y: 269 }, { via: { x: 500, y: 230 } });
  const cap = await page.evaluate(() => {
    clearSel(); const [e1, e2] = P().edges, A = nodeById(__A), B = nodeById(__B), p1 = edgePoints(e1), p2 = edgePoints(e2);
    let shared = 0; for (let i = 1; i < p1.length; i++) for (let j = 1; j < p2.length; j++) { const a = p1[i - 1], b = p1[i], c = p2[j - 1], d = p2[j]; if (Math.abs(a.y - b.y) < .5 && Math.abs(c.y - d.y) < .5 && Math.abs(a.y - c.y) < .5) shared += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))); }
    return { n: P().edges.length, u: undoStack.length, e2: { from: e2.from, to: e2.to, fs: e2.fromSide, ts: e2.toSide }, p2: __t.fmt(p2), rev: __t.rev(p2), diag: __t.diag(p2), shared,
      pen: [p1, p2].map((p) => pathInBoxes(p, [obstBox(A), obstBox(B)])), straight: __t.fmt(p1) };
  });
  check(cap.n === 2 && cap.e2.from === 2 && cap.e2.to === 1 && cap.e2.fs === "n" && cap.e2.ts === "n", `gesto real: la vuelta es B→A de arriba a arriba (${JSON.stringify(cap.e2)})`);
  check(cap.u === 2, `cada conexión creada = una entrada de Undo (${cap.u})`);
  check(cap.rev === 0 && cap.diag === 0, `la vuelta es una U limpia, sin muñones (${cap.p2}; ${cap.rev} retrocesos)`);
  check(cap.p2 === "700,265 700,237 300,237 300,265", `por el pasillo exterior (${cap.p2})`);
  const conU = await page.evaluate(() => JSON.stringify(edgePoints(P().edges[0])));
  check(conU === solo && cap.straight === "390,300 418,300 500,300 582,300 610,300", `BUG 1: añadir la U no mueve la directa, que sigue centrada (${cap.straight})`);
  check(cap.pen.every((v) => v < 4), `ninguna ruta entra en sus nodos (${cap.pen.map((v) => v.toFixed(1))})`);
  check(cap.shared === 0, `las hermanas no comparten trazo (recta ${cap.straight})`);
  await page.mouse.move(2, 2); await page.waitForTimeout(100);
  { const a = await W2S(page, { x: 150, y: 190 }), b = await W2S(page, { x: 850, y: 360 }); await page.screenshot({ path: path.join(shots, "d1440-captura.png"), clip: { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y } }); }
  /* el SVG del editor: la misma U, sin retroceso, punta hacia abajo y pegada al borde de arriba de A */
  const svg = await page.evaluate(() => {
    const s = buildSVGDocument(1), lines = s.split("\n").map((l) => l.trim());
    const strokes = lines.filter((l) => /^<path d="[^"]*" fill="none" stroke="[^"]*" stroke-width="1\.5"/.test(l)).map((l) => l.match(/d="([^"]*)"/)[1]);
    const headsD = lines.filter((l) => /^<path d="[^"]*" fill="[^"]*"\/>$/.test(l)).map((l) => l.match(/d="([^"]*)"/)[1]);
    /* vértices de un path M/L/Q (los finales de cada orden) */
    const verts = (d) => { const out = []; const re = /([MLQ])([^MLQZ]*)/g; let m; while ((m = re.exec(d))) { const n = m[2].trim().split(/[\s,]+/).map(Number); out.push({ x: n[n.length - 2], y: n[n.length - 1] }); } return out; };
    const A = nodeById(__A), top = A.y - A.h / 2, offset = (() => { const m = s.match(/viewBox="([-\d.]+) ([-\d.]+)/); return m ? { x: 0, y: 0 } : { x: 0, y: 0 }; })();
    const v2 = verts(strokes[1]), h2 = verts(headsD[1]);
    return { marker: /<marker/.test(s), rev: __t.rev(v2), tip: h2[0], base: h2[2], top, offset, n: strokes.length };
  });
  check(!svg.marker && svg.n === 2, "SVG del editor: dos trazos explícitos y ningún <marker>");
  check(svg.rev === 0, `SVG del editor: la vuelta no retrocede (${svg.rev})`);
  check(svg.tip && svg.base && Math.abs(svg.tip.x - svg.base.x) < 0.01 && svg.base.y < svg.tip.y, `SVG del editor: la punta apunta hacia abajo, al nodo (${JSON.stringify(svg.tip)} ← ${JSON.stringify(svg.base)})`);
  check(/M 390\.00 300\.00 L /.test(await page.evaluate(() => buildSVGDocument(1))), "SVG del editor: la directa sale centrada (y = 300)");

  /* 1b · Present y Viewer: las mismas rutas */
  const rutas = () => JSON.stringify(P().edges.map((e) => edgePoints(e)));
  const editor = await page.evaluate(rutas);
  await page.locator("#btnPresent").click(); await page.waitForTimeout(250);
  const pres = await page.evaluate(() => ({ presenting, r: JSON.stringify(P().edges.map((e) => edgePoints(e))) }));
  check(pres.presenting && pres.r === editor, "Present: las mismas rutas (directa centrada, U limpia)");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  if (await page.evaluate(() => presenting)) await page.evaluate(() => { if (typeof exitPresent === "function") exitPresent(); });
  const url = await page.evaluate(async (b) => createShareUrl(serializeProject(), b + "/s/"), base);
  const v = await t.ctx.newPage(); v.on("pageerror", (e) => t.errors.push("viewer: " + e.message));
  await v.goto(url.replace(/^https?:\/\/[^/]+/, base));
  await v.waitForFunction(() => typeof viewerPhase !== "undefined" && viewerPhase === "ready", null, { timeout: 15000 });
  const vr = await v.evaluate(() => JSON.stringify(doc.pages[doc.cur].edges.map((e) => edgePoints(e))));
  check(vr === editor, "Viewer (enlace compartido): las mismas rutas que el editor");
  await v.close();

  /* 1c · borrar la U y deshacer: la directa no se mueve; mover un nodo y devolverlo: todo vuelve igual, sin defectos */
  await page.evaluate(() => { selectOnly("edge", P().edges[1].id); }); await page.keyboard.press("Delete"); await page.waitForTimeout(80);
  const sinU = await page.evaluate(() => ({ n: P().edges.length, r: JSON.stringify(edgePoints(P().edges[0])) }));
  check(sinU.n === 1 && sinU.r === solo, "borrar la U (Supr): la directa no se mueve");
  await page.keyboard.press("Control+z"); await page.waitForTimeout(80);
  const deshecho = await page.evaluate(rutas);
  check(deshecho === editor, "Deshacer el borrado: vuelven la U y la directa exactamente igual");
  await page.evaluate(() => clearSel());
  await mouseDrag(page, { x: 700, y: 300 }, { x: 700, y: 340 });
  const movido = await page.evaluate(() => P().edges.map((e) => { const p = edgePoints(e); return { rev: __t.rev(p), diag: __t.diag(p), p: __t.fmt(p) }; }));
  check(movido.every((m) => !m.rev && !m.diag), `mover B 40 px: rutas válidas (${movido.map((m) => m.p).join(" ‖ ")})`);
  await mouseDrag(page, { x: 700, y: 340 }, { x: 700, y: 300 });
  check(await page.evaluate(rutas) === editor, "devolver B a su sitio: las rutas vuelven exactamente igual");

  /* 1d · variantes en el editor real: por abajo y varias hermanas — la directa no se mueve */
  const varis = await page.evaluate(() => {
    const out = [];
    for (const [name, extra] of [["B→A por abajo (s/s)", [[2, 1, "s", "s"]]], ["dos hermanas más (e/·)", [[1, 2, "e", null], [1, 2, "e", null]]], ["U arriba + U abajo", [[2, 1, "n", "n"], [2, 1, "s", "s"]]]]) {
      __t.reset("crema"); const a = newNode("rect", 300, 300), b = newNode("rect", 700, 300); const N = { 1: a.id, 2: b.id };
      const d = newEdge(a.id, b.id, { route: "ortho", fromSide: "e" }); const sola = JSON.stringify(edgePoints(d));
      const es = extra.map(([f, t2, fs, ts]) => newEdge(N[f], N[t2], { route: "ortho", fromSide: fs, toSide: ts }));
      const all = [d, ...es].map(edgePoints);
      out.push({ name, quieta: JSON.stringify(edgePoints(d)) === sola, ok: all.every((p) => !__t.rev(p) && !__t.diag(p)), r: all.map(__t.fmt).join(" ‖ ") });
    }
    return out;
  });
  for (const x of varis) check(x.quieta && x.ok, `${x.name}: la directa no se mueve y no hay muñones (${x.r})`);

  /* 1e · el vídeo: hueco de 39 px a 219 %, conexión con el puerto → ruta recta y un solo punto de flujo */
  await page.evaluate(() => { __t.reset("dark"); viewZoom = 2.19; viewX = -400; viewY = -350; const a = newNode("rect", 300, 300, { label: "Nodo" }), b = newNode("rect", 519, 300, { label: "Nodo" }); window.__A = a.id; });
  await mouseDrag(page, { x: 390 + 18 / 2.19, y: 300 }, { x: 519, y: 300 }, { via: { x: 450, y: 296 } });
  const vid = await page.evaluate(() => { clearSel(); const e = P().edges[0], p = edgePoints(e); return { n: P().edges.length, p: __t.fmt(p), rev: __t.rev(p), dots: flowDotCount(edgeDots(e), polyLen(p)), L: polyLen(p) }; });
  check(vid.n === 1 && vid.rev === 0 && vid.p === "390,300 410,300 429,300", `BUG 2 (vídeo, 39 px): la ruta es recta, sin ida y vuelta (${vid.p})`);
  check(vid.dots === 1, `BUG 2: en ${vid.L.toFixed(0)} px cabe un solo punto de flujo (${vid.dots})`);
  for (const [i, ms] of [[0, 0], [1, 330], [2, 330]]) { await page.waitForTimeout(ms); const a = await W2S(page, { x: 370, y: 285 }), b = await W2S(page, { x: 450, y: 315 }); await page.screenshot({ path: path.join(shots, `d1440-video-${i}.png`), clip: { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y } }); }

  /* 2 · Clic SIN mover: inerte (recta, Z, anillo y codo) */
  const inert = [];
  for (const kind of ["recta", "z", "anillo", "codo"]) {
    const prep = await page.evaluate((kind) => {
      __t.reset("dark");
      const a = newNode("rect", 200, 200, { label: "A" }), b = newNode("rect", 600, kind === "z" ? 330 : 200, { label: "B" });
      const e = kind === "anillo" ? newEdge(a.id, b.id) : newEdge(a.id, b.id, { route: "ortho", fromSide: kind === "recta" ? "e" : null });
      if (kind === "codo") editEdge(e, { fromSide: "e", toSide: "w", waypoints: [{ x: 318, y: 200 }, { x: 318, y: 140 }, { x: 482, y: 140 }, { x: 482, y: 200 }] });
      selectOnly("edge", e.id); __t.primeRedo(); selectOnly("edge", e.id); refreshPanel();
      const target = kind === "codo" ? edgeById(e.id).waypoints[1] : __t.bar(e.id, 0);
      return { id: e.id, target, before: __t.state(e.id) };
    }, kind);
    await mouseClick(page, prep.target);
    const after = await page.evaluate((id) => __t.state(id), prep.id);
    const same = after.e === prep.before.e && after.u === prep.before.u && after.r === prep.before.r && after.rTop === prep.before.rTop && after.wpsBtn === prep.before.wpsBtn;
    inert.push(kind + (same ? "" : ` (JSON ${after.e === prep.before.e ? "=" : "≠"}, Undo ${prep.before.u}→${after.u}, Rehacer ${prep.before.r}→${after.r}, «ruta automática» ${prep.before.wpsBtn}→${after.wpsBtn})`));
    check(same, `clic sin mover sobre ${kind === "codo" ? "un codo" : kind === "anillo" ? "el anillo de una `straight`" : "la barra de una " + kind}: inerte`);
  }

  /* 3 · Recta: una barra centrada; un movimiento real = exactamente una entrada de Undo; Undo/Redo exactos */
  const r3 = await page.evaluate(() => {
    __t.reset("dark"); const a = newNode("rect", 200, 200, { label: "A" }), b = newNode("rect", 600, 200, { label: "B" });
    const e = newEdge(a.id, b.id, { route: "ortho", fromSide: "e" }); selectOnly("edge", e.id); __t.primeRedo(); selectOnly("edge", e.id);
    const full = edgePoints(e), c = pointAt(full, .5);
    return { id: e.id, n: bendableSegs(e, __t.handles(e)).length, c, hitCenter: hitSegment(e, c.x, c.y), hitOld: [hitSegment(e, 359, 200), hitSegment(e, 441, 200)], before: __t.state(e.id) };
  });
  check(r3.n === 1, `una recta ortogonal lleva UNA barra (${r3.n})`);
  check(r3.hitCenter >= 0 && r3.hitOld.every((h) => h < 0), `la barra está en el centro y no donde estaban las dos de antes (centro ${r3.hitCenter}, antiguas ${r3.hitOld})`);
  await mouseDrag(page, r3.c, { x: r3.c.x, y: r3.c.y - 60 });
  const g = await page.evaluate((id) => { const e = edgeById(id), p = edgePoints(e); return { s: __t.state(id), p: __t.fmt(p), rev: __t.rev(p), diag: __t.diag(p) }; }, r3.id);
  check(g.s.u === r3.before.u + 1 && g.s.r === 0, `un movimiento real = exactamente una entrada de Undo (${r3.before.u} → ${g.s.u}; Rehacer ${g.s.r})`);
  check(g.diag === 0 && g.rev === 0 && g.p.split(" ").length === 6, `deslizar la recta da un puente limpio (${g.p})`);
  const ur = await page.evaluate(([id]) => { undo(); const a = __t.state(id); redo(); const b = __t.state(id); return { a, b }; }, [r3.id]);
  check(ur.a.e === r3.before.e, "Undo devuelve el JSON exacto de antes del gesto");
  check(ur.b.e === g.s.e, "Redo devuelve el JSON del gesto");

  /* 4 · Deslizar y volver a la línea al soltar → waypoints:[] (vuelve a ser automática) */
  const r4 = await page.evaluate(() => { __t.reset("dark"); const a = newNode("rect", 200, 200), b = newNode("rect", 600, 200); const e = newEdge(a.id, b.id, { route: "ortho", fromSide: "e", toSide: "w" }); selectOnly("edge", e.id); return { id: e.id, c: __t.bar(e.id, 0) }; });
  await mouseDrag(page, r4.c, r4.c, { via: { x: r4.c.x, y: r4.c.y - 50 } });
  const w4 = await page.evaluate((id) => ({ wps: edgeById(id).waypoints.length, p: __t.fmt(edgePoints(edgeById(id))) }), r4.id);
  check(w4.wps === 0, `deslizar y volver a la línea deja waypoints:[] (${w4.wps}; ${w4.p})`);

  /* 5 · Escape a mitad → estado previo; Escape sin gesto → pilas intactas */
  const r5 = await page.evaluate(() => { __t.reset("dark"); const a = newNode("rect", 200, 200), b = newNode("rect", 600, 200); const e = newEdge(a.id, b.id, { route: "ortho", fromSide: "e" }); selectOnly("edge", e.id); __t.primeRedo(); selectOnly("edge", e.id); return { id: e.id, c: __t.bar(e.id, 0), before: __t.state(e.id) }; });
  await mouseDrag(page, r5.c, { x: r5.c.x, y: r5.c.y - 40 }, { escape: true });
  const e5 = await page.evaluate((id) => __t.state(id), r5.id);
  check(e5.e === r5.before.e && e5.u === r5.before.u, `Escape a mitad del gesto devuelve el estado previo (Undo ${r5.before.u}→${e5.u})`);
  /* con una edición previa en la pila: un undo() de más la desharía (sin ella, undo() sobre la pila vacía no se notaría) */
  const e5b = await page.evaluate(([id, c]) => { pushUndo(); editNode(P().nodes[1], { label: "previa" }); selectOnly("edge", id); __t.primeRedo(); selectOnly("edge", id); const b = { ...__t.state(id), doc: JSON.stringify(P().nodes) }; __t.fire("pointerdown", c); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); __t.fire("pointerup", c); return { b, a: { ...__t.state(id), doc: JSON.stringify(P().nodes) } }; }, [r5.id, r5.c]);
  check(JSON.stringify(e5b.a) === JSON.stringify(e5b.b), `Escape sin gesto no toca el documento ni las pilas (Undo ${e5b.b.u}→${e5b.a.u}, Rehacer ${e5b.b.r}→${e5b.a.r})`);

  /* 6 · Matrices: 4 posiciones × 25 lados — clics y gestos ±40 */
  const mx = await page.evaluate(() => {
    const S5 = [null, "n", "e", "s", "w"], POS = { alineadoH: [800, 400], alineadoV: [400, 750], desfase7: [800, 407], tipico: [800, 250] };
    const F6 = new Set(["tipico null/w", "tipico e/null"]);
    const out = { clicks: 0, muta: 0, gestos: 0, diag: 0, diagF6: 0, undoMal: 0, ejemplos: [] };
    for (const [pk, [bx, by]] of Object.entries(POS)) for (const fs of S5) for (const ts of S5) {
      __t.reset(); viewZoom = 0.8; viewX = 100; viewY = 50;
      const a = newNode("rect", 400, 400), b = newNode("rect", bx, by); const id = newEdge(a.id, b.id, { route: "ortho", fromSide: fs, toSide: ts }).id;
      selectOnly("edge", id);
      const n = bendableSegs(edgeById(id), __t.handles(edgeById(id))).length;
      for (let k = 0; k < n; k++) {
        const m = __t.bar(id, k), s0 = __t.state(id);
        __t.fire("pointerdown", m); __t.fire("pointerup", m); out.clicks++;
        const s1 = __t.state(id); if (s1.e !== s0.e || s1.u !== s0.u) { out.muta++; while (undoStack.length > s0.u) undo(); selectOnly("edge", id); }
      }
      for (let k = 0; k < n; k++) for (const dv of [40, -40]) {
        const m = __t.bar(id, k); if (!m) continue;
        const p = __t.handles(edgeById(id)), i = bendableSegs(edgeById(id), p)[k], horiz = Math.abs(p[i].x - p[i + 1].x) >= Math.abs(p[i].y - p[i + 1].y);
        const to = horiz ? { x: m.x, y: m.y + dv } : { x: m.x + dv, y: m.y }, u0 = undoStack.length;
        __t.fire("pointerdown", m); __t.fire("pointermove", to); __t.fire("pointerup", to); out.gestos++;
        if (undoStack.length !== u0 + 1) out.undoMal++;
        const after = edgePoints(edgeById(id));
        if (__t.diag(after)) { if (F6.has(pk + " " + fs + "/" + ts)) out.diagF6++; else { out.diag++; if (out.ejemplos.length < 4) out.ejemplos.push(`${pk} ${fs}/${ts} barra ${k} ${dv}: ${__t.fmt(after)}`); } }
        while (undoStack.length > u0) undo(); selectOnly("edge", id);
      }
    }
    return out;
  });
  check(mx.muta === 0, `matriz: ${mx.muta}/${mx.clicks} clics sin mover modifican el documento o apilan Undo`);
  check(mx.undoMal === 0, `matriz: cada gesto real apila exactamente una entrada de Undo (${mx.undoMal}/${mx.gestos} no)`);
  check(mx.diag === 0, `matriz: ${mx.diag} gestos dejan una diagonal por vértices sin giro ${mx.ejemplos.join(" | ")}`);
  console.log(`  · F6 (fuera de alcance, D10): ${mx.diagF6} diagonales conocidas del extremo flotante (típico null/w y e/null)`);

  /* 7 · F5 fuera: mover un nodo NO limpia los waypoints de una ruta hecha a mano (aunque sean colineales) */
  const r7 = await page.evaluate(() => { __t.reset("dark"); const a = newNode("rect", 200, 200), b = newNode("rect", 600, 200); const e = newEdge(a.id, b.id, { route: "ortho", fromSide: "e", toSide: "w" }); editEdge(e, { waypoints: [{ x: 318, y: 200 }, { x: 400, y: 200 }, { x: 482, y: 200 }] }); clearSel(); return { id: e.id, b: { x: b.x, y: b.y } }; });
  await mouseDrag(page, r7.b, { x: r7.b.x + 30, y: r7.b.y + 60 });
  const w7 = await page.evaluate((id) => edgeById(id).waypoints.length, r7.id);
  check(w7 >= 3, `mover un nodo no limpia los waypoints hechos a mano (F5 fuera de alcance): ${w7}`);

  /* 8 · Regresión: test/editor-inline.html */
  const inl = await t.ctx.newPage();
  await inl.goto(base + "/test/editor-inline.html");
  await inl.waitForFunction(() => document.querySelectorAll("#res tr").length > 40, null, { timeout: 30000 });
  await inl.waitForTimeout(2500);
  const ri = await inl.evaluate(() => ({ ok, ko, fails: [...document.querySelectorAll("#res td.ko")].map((td) => td.nextSibling.textContent.slice(0, 120)) }));
  check(ri.ko === 0 && ri.ok >= 51, `editor-inline.html: ${ri.ok} ✓ · ${ri.ko} ✗ ${ri.fails.join(" | ")}`);
  await inl.close();

  check(t.errors.length === 0, `0 errores (${t.errors.join(" | ")})`);
  await t.ctx.close();
}

async function mobile(browser, base) {
  const vp = { key: "m390", width: 390, height: 844, touch: true, mobile: true };
  console.log(`\n── ${vp.key} (${vp.width}×${vp.height}, dedo)`);
  const t = await open(browser, base, vp), page = t.page;
  const r = await page.evaluate(() => {
    __t.reset("dark"); viewZoom = 0.6; viewX = 20; viewY = 200;
    const a = newNode("rect", 120, 200), b = newNode("rect", 420, 200); const e = newEdge(a.id, b.id, { route: "ortho", fromSide: "e", toSide: "w" });
    selectOnly("edge", e.id); __t.primeRedo(); selectOnly("edge", e.id);
    return { id: e.id, c: __t.bar(e.id, 0), before: __t.state(e.id) };
  });
  const s = await W2S(page, r.c);
  await page.touchscreen.tap(s.x, s.y); await page.waitForTimeout(120);
  const a = await page.evaluate((id) => __t.state(id), r.id);
  check(a.e === r.before.e && a.u === r.before.u && a.r === r.before.r && a.rTop === r.before.rTop, `toque sin mover sobre la barra: inerte (Undo ${r.before.u}→${a.u}, Rehacer ${r.before.r}→${a.r})`);
  const u0 = await page.evaluate((id) => { selectOnly("edge", id); return undoStack.length; }, r.id);
  const cdp = await t.ctx.newCDPSession(page), pt = (y) => [{ x: s.x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(s.y) });
  for (const dy of [8, 20, 35, 50, 60]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(s.y - dy * 0.6 * 1) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(120);
  const d = await page.evaluate(([id, u0]) => { const p = edgePoints(edgeById(id)); return { du: undoStack.length - u0, p: __t.fmt(p), diag: __t.diag(p), rev: __t.rev(p) }; }, [r.id, u0]);
  check(d.du === 1 && d.diag === 0 && d.rev === 0, `arrastrar con el dedo desliza el tramo: puente limpio y una entrada de Undo (${d.du}; ${d.p})`);
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
  console.log(`\nFLUYO-018.25 browser: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
