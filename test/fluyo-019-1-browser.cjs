"use strict";
/* FLUYO-019.1 — Chrome REAL: la piel «construido» (2.5D) en Present y en la exportación; el editor, plano.
   d1440 (ratón):
   · Plano = HEAD byte a byte: con el árbol de HEAD servido al lado, los 8 ejemplos y la escena de prueba dan el MISMO SVG
     (buildSVGDocument) y el MISMO raster de exportación (toDataURL de render export a t=0) que antes.
   · Editor: siempre plano (píxel de la tapa = fondo), aunque settings.skin sea "built" (FLUYO-019.2: la piel es del documento).
   · Present (tecla P): la piel pinta tapa, lateral y LED (píxeles medidos con los tonos de skinTones); B y el botón de la
     barra alternan; edgePoints y getBounds no cambian con la piel; a zoom 0,25 cae a plano; al salir el editor sigue plano.
   · Exportación: buildSVGDocument(1) === buildSVGDocument(1,"flat"); con "built" hay capas de piel (skin-clip- del cilindro);
     el diálogo arranca con el aspecto de Present y exGo entrega el SVG con o sin piel según la fila «Aspecto».
   · Historia en Present con la piel: reproducir no da errores y el Trace es el mismo que en plano.
   · Capturas: Present plano vs construido (escena, kafka, microservicios), Historia en marcha, SVG exportado renderizado y
     una comparación lado a lado. FLUYO_SHOTS=<dir>.
   Uso: node test/fluyo-019-1-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-019-1-"));
fs.mkdirSync(shots, { recursive: true });
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
/* el árbol de HEAD, extraído con git archive a un directorio temporal (nunca se toca el repo) */
function headTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-")), tar = path.join(dir, "head.tar");
  execFileSync("git", ["-C", root, "archive", "HEAD", "-o", tar]);
  /* ruta relativa y cwd: un tar de Git Bash toma «C:» por un host remoto */
  execFileSync("tar", ["-xf", "head.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const EXAMPLES = fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => f.endsWith(".fluyo.json")).map((f) => f.replace(".fluyo.json", ""));
const STORY = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-cliente-kafka-comercio.fluyo.json"), "utf8");

const PAGE_HELPERS = () => {
  window.__t = {
    reset(theme) {
      setUiMode("edit"); if (theme) setThemeIn(doc, { theme, customBg: "" });
      removeEdges(P().edges.map((e) => e.id)); removeNodes(P().nodes.map((n) => n.id));
      settings.snap = false; settings.single = false; settings.grid = false; viewZoom = 1; viewX = 60; viewY = 40; clearSel(); undoStack.length = 0; redoStack.length = 0; scheduleAutosave();
    },
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    scr(p) { const r = cv.getBoundingClientRect(); return { x: r.left + viewX + p.x * viewZoom, y: r.top + viewY + p.y * viewZoom }; },
    /* color del lienzo en un punto de MUNDO (px del bitmap, con dpr) */
    px(p) { const d = cv.width / cv.getBoundingClientRect().width, x = Math.round((viewX + p.x * viewZoom) * d), y = Math.round((viewY + p.y * viewZoom) * d); const k = ctx.getImageData(x, y, 1, 1).data; return [k[0], k[1], k[2]]; },
    hex(h) { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; },
    near(a, b, tol = 6) { return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol; },
    bg() { return doc.customBg || THEMES[doc.theme].bg; },
    geom() { return JSON.stringify({ e: P().edges.map((e) => [e.id, edgePoints(e)]), b: getBounds(), n: P().nodes.map((n) => [n.id, n.x, n.y, n.w, n.h]) }); },
    /* raster de exportación a t=0 (como exportStatic, sin descargar) */
    raster(skin) { const b = getBounds(), off = document.createElement("canvas"); off.width = Math.round(b.w); off.height = Math.round(b.h); const oc = off.getContext("2d");
      oc.translate(-b.x, -b.y); const o = { export: true, bounds: b, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }; if (skin !== undefined) o.skin = skin; render(oc, 0, o); return off.toDataURL(); },
    svg(skin) { return skin === undefined ? buildSVGDocument(1) : buildSVGDocument(1, skin); },
  };
};
/* La escena: rect, cylinder, icon, hex, text; conexiones simples, un par bidireccional y dos hermanas con etiqueta. */
const SCENE = () => {
  const mk = (shape, x, y, label, extra) => newNode(shape, x, y, { label, ...(extra || {}) });
  const client = mk("rect", 420, 80, "Client", { color: "#8f8f8f" });
  const api = mk("rect", 420, 230, "API", { color: "#6a9fb5" });
  const kafka = mk("icon", 420, 400, "Kafka", { icon: "kafka", color: "#d08b5b" });
  const w1 = mk("rect", 240, 580, "Worker A", { color: "#6a9fb5" }), w2 = mk("rect", 600, 580, "Worker B", { color: "#6a9fb5", border: "dashed" });
  const db = mk("cylinder", 420, 760, "PostgreSQL", { color: "#7fa66b" });
  const hex = mk("hex", 900, 230, "Decisión", { color: "#9b7fb5" });
  const txt = mk("text", 900, 80, "Texto suelto", { color: "#d08b5b" });
  const a = mk("rect", 820, 520, "A", { color: "#5bb0a0" }), b = mk("rect", 1120, 520, "B", { color: "#5bb0a0" });
  const e = (p, q, o) => newEdge(p.id, q.id, { route: "ortho", ...(o || {}) });
  e(client, api, { label: "HTTP" }); e(api, kafka, { label: "produce" });
  e(kafka, w1, { label: "topic: pagos" }); e(kafka, w2, { label: "topic: envíos" });
  e(w1, db); e(w2, db); e(api, hex, { dashed: true });
  e(a, b, { fromSide: "e", toSide: "w", label: "ida" }); e(b, a, { fromSide: "w", toSide: "e", label: "vuelta" });
  undoStack.length = 0; redoStack.length = 0; clearSel();
  return { api: api.id, db: db.id, kafka: kafka.id, hex: hex.id, w1: w1.id };
};

async function open(browser, base, vp, url = "/") {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: "block", deviceScaleFactor: 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + url); await page.waitForFunction(() => typeof refreshPanel === "function" && typeof buildSVGDocument === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(PAGE_HELPERS);
  await page.evaluate(() => waitForRenderFonts(doc));
  return { ctx, page, errors, vp };
}
const frame = (page) => page.evaluate(() => __t.frame());
async function shot(page, name) { await page.mouse.move(2, 2); await frame(page); await page.screenshot({ path: path.join(shots, name + ".png") }); }
const topFacePoint = (page, id) => page.evaluate((id) => { const n = nodeById(id); return { x: n.x, y: n.y - n.h / 2 - SKIN_DEPTH / 2 }; }, id);
const sidePoint = (page, id) => page.evaluate((id) => { const n = nodeById(id); return { x: n.x + n.w / 2 + SKIN_DEPTH / 2, y: n.y + 4 }; }, id);

async function main() {
  const t0 = Date.now();
  const head = headTree();
  const { server, base } = await serve(root), { server: serverOld, base: baseOld } = await serve(head);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const vp = { key: "d1440", width: 1440, height: 900 };
  try {
    console.log(`\n── ${vp.key}: plano = HEAD byte a byte (${EXAMPLES.length} ejemplos + escena)`);
    for (const slug of EXAMPLES) {
      const now = await open(browser, base, vp, "/?ejemplo=" + slug), old = await open(browser, baseOld, vp, "/?ejemplo=" + slug);
      for (const p of [now, old]) await p.page.waitForFunction(() => P().nodes.length > 0);
      const a = await now.page.evaluate(() => ({ svg: __t.svg(), svgFlat: __t.svg("flat"), png: __t.raster(), pngFlat: __t.raster("flat"), json: JSON.stringify(serializeProject()) }));
      const b = await old.page.evaluate(() => ({ svg: buildSVGDocument(1), png: __t.raster(), json: JSON.stringify(serializeProject()) }));
      check(a.svg === b.svg && a.svgFlat === b.svg, `${slug}: SVG sin bandera y con "flat" idénticos a HEAD (${b.svg.length} bytes)`);
      check(a.png === b.png && a.pngFlat === b.png, `${slug}: raster de exportación idéntico a HEAD`);
      check(a.json === b.json, `${slug}: el documento serializado es el mismo`);
      check(now.errors.length === 0 && old.errors.length === 0, `${slug}: 0 errores (${now.errors.concat(old.errors).join(" | ")})`);
      await now.ctx.close(); await old.ctx.close();
    }

    console.log(`\n── ${vp.key}: escena (rect, cylinder, icon, hex, text; conexiones simples, par y hermanas)`);
    const t = await open(browser, base, vp), page = t.page;
    const old = await open(browser, baseOld, vp);
    await page.evaluate(() => __t.reset("crema")); await old.page.evaluate(() => __t.reset("crema"));
    const ids = await page.evaluate(SCENE); await old.page.evaluate(SCENE);
    await frame(page);
    {
      const a = await page.evaluate(() => ({ svg: __t.svg(), png: __t.raster(), json: JSON.stringify(serializeProject()) }));
      const b = await old.page.evaluate(() => ({ svg: buildSVGDocument(1), png: __t.raster(), json: JSON.stringify(serializeProject()) }));
      check(a.svg === b.svg && a.png === b.png && a.json === b.json, "escena: SVG, raster y documento idénticos a HEAD en plano");
    }
    await old.ctx.close();
    const geom0 = await page.evaluate(() => __t.geom());
    /* se mide en Worker A: por su centro no entra ninguna conexión (en API entra «HTTP» por el norte y su punta ocuparía el punto) */
    const tp = await topFacePoint(page, ids.w1), sp = await sidePoint(page, ids.w1);
    const tones = await page.evaluate((id) => skinTones(nodeById(id).color, doc.theme, __t.bg()), ids.w1);
    const bgRGB = await page.evaluate(() => __t.hex(__t.bg()));
    /* editor: plano aunque settings.skin sea "built" (019.2: la piel es un ajuste del documento; aquí se fija para la validación) */
    {
      const r = await page.evaluate(([tp, sp]) => { settings.skin = "built"; return { skin: projectSkin(settings), top: __t.px(tp), side: __t.px(sp) }; }, [tp, sp]);
      await frame(page);
      check(r.skin === "built" && JSON.stringify(r.top) === JSON.stringify(bgRGB) && JSON.stringify(r.side) === JSON.stringify(bgRGB), `editor: plano (tapa y lateral = fondo) con settings.skin=${r.skin}`);
    }
    await shot(page, "01-editor-plano");
    /* Present: construido */
    await page.keyboard.press("p"); await page.waitForFunction(() => presenting === true); await frame(page); await frame(page);
    {
      const r = await page.evaluate(([tp, sp]) => ({ top: __t.px(tp), side: __t.px(sp), btn: $("prSkin").textContent, pressed: $("prSkin").getAttribute("aria-pressed") }), [tp, sp]);
      const topRGB = await page.evaluate((h) => __t.hex(h), tones.top), sideRGB = await page.evaluate((h) => __t.hex(h), tones.side);
      check(await page.evaluate(([a, b]) => __t.near(a, b), [r.top, topRGB]), `Present: la tapa tiene el tono claro (${r.top} ≈ ${topRGB})`);
      check(await page.evaluate(([a, b]) => __t.near(a, b), [r.side, sideRGB]), `Present: el lateral tiene el tono oscuro (${r.side} ≈ ${sideRGB})`);
      check(r.btn === "Construido" && r.pressed === "true", "barra: «Construido», aria-pressed=true");
    }
    check((await page.evaluate(() => __t.geom())) === geom0, "Present construido: edgePoints, getBounds y los nodos no cambian");
    await shot(page, "02-present-construido");
    /* B → plano; B → construido; botón */
    await page.keyboard.press("b"); await frame(page);
    {
      const r = await page.evaluate(([tp]) => ({ skin: projectSkin(settings), top: __t.px(tp), btn: $("prSkin").textContent }), [tp]);
      check(r.skin === "flat" && JSON.stringify(r.top) === JSON.stringify(bgRGB) && r.btn === "Plano", "tecla B: plano (tapa = fondo), botón «Plano»");
    }
    await shot(page, "03-present-plano");
    await page.locator("#prSkin").click(); await frame(page);
    check((await page.evaluate(() => projectSkin(settings))) === "built", "botón de la barra: vuelve a construido");
    check((await page.evaluate(() => __t.geom())) === geom0, "tras alternar: geometría intacta");
    /* zoom 0,25 → plano; vuelta */
    await page.evaluate(() => { viewZoom = 0.25; viewX = 200; viewY = 60; }); await frame(page);
    {
      /* a zoom 0,25 el canto mide 2 px: la piel se apaga sola. Prueba: el bloque de píxeles del nodo pinta IGUAL con «built» que con «flat» */
      const block = () => page.evaluate((id) => { const n = nodeById(id), d = cv.width / cv.getBoundingClientRect().width; const x = Math.round((viewX + (n.x - n.w / 2 - 12) * viewZoom) * d), y = Math.round((viewY + (n.y - n.h / 2 - 12) * viewZoom) * d);
        return Array.from(ctx.getImageData(x, y, Math.round((n.w + 24) * viewZoom * d), Math.round((n.h + 24) * viewZoom * d)).data).join(","); }, ids.api);
      /* reloj congelado: los puntos de flujo no deben moverse entre las dos muestras */
      await page.evaluate(() => { pausedAt = now(); playing = false; }); await frame(page);
      const builtPx = await block(); await page.keyboard.press("b"); await frame(page); const flatPx = await block(); await page.keyboard.press("b"); await frame(page);
      await page.evaluate(() => { t0 = performance.now() - pausedAt * 1000; playing = true; });
      check(builtPx === flatPx && (await page.evaluate(() => projectSkin(settings))) === "built", "zoom 0,25: canto de 2 px → se pinta exactamente como plano (skinActive=false)");
    }
    await page.evaluate(() => { fitViewPresent(); }); await frame(page);
    /* cilindro e icono con piel */
    {
      const r = await page.evaluate((ids) => {
        const db = nodeById(ids.db), g = cylinderGeom(db), capY = g.top + g.ry;
        const cap = __t.px({ x: db.x, y: capY - 2 }), band = __t.px({ x: db.x + g.rx * 0.8, y: db.y + 10 });
        const ic = nodeById(ids.kafka), s = Math.min(ic.w, ic.h - 26) * .78, py0 = ic.y - ic.h / 2 + 4 + s - 2;
        const plinth = __t.px({ x: ic.x - s / 2 - 4, y: py0 + 3 });
        const T = skinTones(db.color, doc.theme, __t.bg()), Ti = skinTones(ic.color, doc.theme, __t.bg());
        return { cap: __t.near(cap, __t.hex(T.top)), band: __t.near(band, __t.hex(T.side)), plinth: __t.near(plinth, __t.hex(Ti.front)), cap0: cap, t: T.top };
      }, ids);
      check(r.cap, `cilindro: tapa clara (${r.cap0} ≈ ${r.t})`); check(r.band, "cilindro: banda lateral"); check(r.plinth, "icono: peana bajo el glifo");
    }
    /* exportación */
    {
      const r = await page.evaluate(() => {
        const flat = buildSVGDocument(1), flat2 = buildSVGDocument(1, "flat"), built = buildSVGDocument(1, "built");
        const paths = (s) => (s.match(/<path /g) || []).length;
        return { same: flat === flat2, more: paths(built) > paths(flat), clip: built.includes('id="skin-clip-'), flatNoClip: !flat.includes("skin-clip-"), pngDiff: __t.raster("built") !== __t.raster("flat"), n: paths(flat), m: paths(built) };
      });
      check(r.same, "SVG: sin bandera === \"flat\"");
      check(r.more && r.clip && r.flatNoClip, `SVG: con "built" hay capas de piel (${r.n} → ${r.m} <path>, clip del cilindro)`);
      check(r.pngDiff, "raster: built ≠ flat");
      /* el SVG exportado, renderizado en una página con las fuentes del sitio */
      const built = await page.evaluate(() => buildSVGDocument(1, "built"));
      const sv = await t.ctx.newPage();
      await sv.setContent(`<!doctype html><html><head><style>@font-face{font-family:"IBM Plex Mono";font-weight:500;src:url("${base}/assets/fonts/ibm-plex-mono-latin-500.woff2") format("woff2")}@font-face{font-family:"IBM Plex Mono";font-weight:400;src:url("${base}/assets/fonts/ibm-plex-mono-latin-400.woff2") format("woff2")}body{margin:0;background:#f4eee1}svg{width:1440px;height:auto;display:block}</style></head><body>${built}</body></html>`);
      await sv.evaluate(() => document.fonts.ready); await sv.waitForTimeout(200);
      await sv.screenshot({ path: path.join(shots, "06-export-svg-construido.png"), clip: { x: 0, y: 0, width: 1440, height: 600 } });
      await sv.close();
    }
    /* diálogo de exportar: arranca con el aspecto de Present; exGo entrega el SVG según la fila */
    await page.keyboard.press("Escape"); await page.waitForFunction(() => presenting === false); await frame(page);
    {
      const r = await page.evaluate(async () => {
        const got = [];
        window.downloadTextFile = (name, content) => got.push({ name, content });
        $("btnExport").click(); const start = $("exSkin").value; $("exFmt").value = "svg"; $("exGo").click();
        $("btnExport").click(); $("exSkin").value = "flat"; $("exFmt").value = "svg"; $("exGo").click();
        return { start, built: got[0] && got[0].content.includes("skin-clip-"), flat: got[1] && !got[1].content.includes("skin-clip-"), n: got.length, skinAfter: projectSkin(settings) };
      });
      check(r.start === "built", `diálogo: «Aspecto» arranca con el del documento (${r.start})`);
      check(r.n === 2 && r.built && r.flat, "exGo: SVG con piel con «Construido» y sin ella con «Plano»");
      check(r.skinAfter === "built", "elegir «Plano» en el diálogo no cambia el aspecto del documento");
      const r2 = await page.evaluate(([tp]) => ({ top: __t.px(tp), json: JSON.stringify(serializeProject()).includes('"skin":"built"') }), [tp]);
      check(JSON.stringify(r2.top) === JSON.stringify(bgRGB) && r2.json, "tras salir de Present: editor plano; el documento lleva skin:\"built\" (019.2)");
    }
    check(t.errors.length === 0, `escena: 0 errores (${t.errors.join(" | ")})`);
    await t.ctx.close();

    console.log(`\n── ${vp.key}: ejemplos en Present, plano vs construido`);
    for (const slug of ["kafka-event-pipeline", "microservicios-api-gateway"]) {
      const p = await open(browser, base, vp, "/?ejemplo=" + slug); await p.page.waitForFunction(() => P().nodes.length > 0);
      await p.page.evaluate(() => { setUiMode("edit"); settings.skin = "built"; });
      const g0 = await p.page.evaluate(() => __t.geom());
      await p.page.keyboard.press("p"); await p.page.waitForFunction(() => presenting === true); await frame(p.page); await frame(p.page);
      await shot(p.page, `04-${slug}-construido`);
      await p.page.keyboard.press("b"); await frame(p.page); await shot(p.page, `04-${slug}-plano`);
      check((await p.page.evaluate(() => __t.geom())) === g0, `${slug}: geometría intacta en Present`);
      check(p.errors.length === 0, `${slug}: 0 errores (${p.errors.join(" | ")})`);
      await p.ctx.close();
    }

    console.log(`\n── ${vp.key}: Historia en Present con la piel`);
    {
      const p = await open(browser, base, vp);
      await p.page.evaluate((json) => { const d = JSON.parse(json); d.settings.skin = "built"; applyProjectData(d); setUiMode("story"); }, STORY);
      await frame(p.page);
      const traceFlat = await p.page.evaluate(() => { const sc = scActiveScenario(); return JSON.stringify(FluyoStory.run(P(), sc).trace); });
      await p.page.keyboard.press("p"); await p.page.waitForFunction(() => presenting === true); await frame(p.page);
      await p.page.evaluate(() => presentPlay()); await p.page.waitForTimeout(1400); await frame(p.page);
      await shot(p.page, "05-historia-present-construido");
      const traceBuilt = await p.page.evaluate(() => { const sc = scActiveScenario(); return JSON.stringify(FluyoStory.run(P(), sc).trace); });
      check(traceFlat === traceBuilt, "Historia: el Trace es el mismo con y sin piel");
      await p.page.waitForTimeout(2500);
      check(p.errors.length === 0, `Historia en Present: 0 errores (${p.errors.join(" | ")})`);
      await p.ctx.close();
    }

    /* comparación lado a lado */
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 520 } });
      const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(shots, f)).toString("base64");
      await p.setContent(`<body style="margin:0;background:#F2EDE3;font:12px 'Segoe UI',sans-serif;display:flex;gap:8px;padding:8px"><figure style="margin:0;flex:1"><figcaption>Plano (actual)</figcaption><img src="${img("03-present-plano.png")}" style="width:100%"></figure><figure style="margin:0;flex:1"><figcaption>Construido (2.5D, FLUYO-019.1)</figcaption><img src="${img("02-present-construido.png")}" style="width:100%"></figure></body>`);
      await p.screenshot({ path: path.join(shots, "07-comparacion-plano-vs-construido.png"), fullPage: true });
      await p.close();
    }
  } finally { await browser.close(); server.close(); serverOld.close(); fs.rmSync(head, { recursive: true, force: true }); }
  console.log(`\nFLUYO-019.1 browser: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
