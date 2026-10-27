"use strict";
/* FLUYO-019.2 — Chrome REAL: la piel «construido» como ajuste del documento (settings.skin), en Share y en el Viewer.
   · Documentos antiguos (8 ejemplos): con el árbol de HEAD servido al lado, el SVG, el raster de exportación, el documento
     serializado y el PAYLOAD del share son idénticos a HEAD; arrancan planos (#skinSel = flat).
   · Escena: editor plano = HEAD; Present arranca plano; B escribe settings.skin="built" (tonos medidos en píxeles), autoguarda y
     no crea Undo; al salir, «Lienzo» muestra «Construido» y el editor sigue plano; el diálogo de exportar arranca con el aspecto
     del documento y elegir otro NO lo escribe; #skinSel cambia Present; guardar/abrir y recargar con autoguardado conservan la
     piel; el documento con skin:"built" genera el fixture y el golden SVG compartidos con el MCP (FLUYO_UPDATE_GOLDEN=1).
   · Share → Viewer (crema y oscuro; escritorio y móvil): el Viewer carga skin.js, pinta la tapa con el tono claro en la vista
     normal y en Present; un share plano da en el Viewer el mismo lienzo que el Viewer de HEAD; el Viewer de HEAD (sin skin.js)
     abre un share construido plano y sin errores; «Abrir en Fluyo» entra con la piel.
   · Historia con la piel en Present y en el Viewer: mismo Trace, 0 errores.
   · Service worker: con la versión anterior instalada (0409f4d, v93), el árbol nuevo activa la actual (v95) (skipWaiting + claim) y el Viewer pasa a pintar construido.
   Capturas: FLUYO_SHOTS=<dir>. FLUYO_QUICK=1 (mutaciones): corpus corto, sin móvil, sin Historia, sin service worker.
   Uso: node test/fluyo-019-2-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const QUICK = !!process.env.FLUYO_QUICK, UPDATE = process.env.FLUYO_UPDATE_GOLDEN === "1";
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-019-2-"));
fs.mkdirSync(shots, { recursive: true });
const FIXTURE = path.join(root, "test", "fixtures", "fluyo-019-2-skin.fluyo.json"), GOLDEN = path.join(root, "test", "fixtures", "fluyo-019-2-skin-svg.json");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
/* servidor estático cuyo directorio se puede cambiar en caliente (smoke del service worker) */
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
  return { server, base: "http://127.0.0.1:" + server.address().port, state };
};
function headTree(rev = "HEAD") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-")), tar = path.join(dir, "head.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "head.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const ALL_EXAMPLES = fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => f.endsWith(".fluyo.json")).map((f) => f.replace(".fluyo.json", ""));
const EXAMPLES = QUICK ? ALL_EXAMPLES.slice(0, 2) : ALL_EXAMPLES;
const STORY = fs.readFileSync(path.join(root, "test", "fixtures", "fluyo-017-1-cliente-kafka-comercio.fluyo.json"), "utf8");
/* la misma extracción que test/fluyo-019-2.test.cjs (y la que portará el MCP en 019.3) */
function skinSvgLines(svg) {
  return svg.split("\n").map((l) => l.trim()).filter((l) =>
    /^<clipPath id="skin-clip-/.test(l) ||
    /^<path d="[^"]*" fill="[^"]*"( stroke="[^"]*" stroke-width="[^"]*")?( stroke-dasharray="[^"]*")? stroke-linejoin="round"( clip-path="url\(#skin-clip-[^)]*\)")?\/>$/.test(l) ||
    /^<path d="[^"]*" fill="[^"]*"\/>$/.test(l) ||
    /^<path d="[^"]*" fill="[^"]*" stroke="[^"]*" stroke-width="1\.5"\/>$/.test(l));
}

const EDITOR_HELPERS = () => {
  window.__t = {
    reset(theme) {
      setUiMode("edit"); if (theme) setThemeIn(doc, { theme, customBg: "" });
      removeEdges(P().edges.map((e) => e.id)); removeNodes(P().nodes.map((n) => n.id));
      settings.snap = false; settings.single = false; settings.grid = false; delete settings.skin; viewZoom = 1; viewX = 60; viewY = 40; clearSel(); undoStack.length = 0; redoStack.length = 0; scheduleAutosave();
    },
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    px(p) { const d = cv.width / cv.getBoundingClientRect().width, x = Math.round((viewX + p.x * viewZoom) * d), y = Math.round((viewY + p.y * viewZoom) * d); const k = ctx.getImageData(x, y, 1, 1).data; return [k[0], k[1], k[2]]; },
    hex(h) { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; },
    near(a, b, tol = 6) { return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol; },
    bg() { return doc.customBg || THEMES[doc.theme].bg; },
    raster(skin) { const b = getBounds(), off = document.createElement("canvas"); off.width = Math.round(b.w); off.height = Math.round(b.h); const oc = off.getContext("2d");
      oc.translate(-b.x, -b.y); const o = { export: true, bounds: b, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }; if (skin !== undefined) o.skin = skin; render(oc, 0, o); return off.toDataURL(); },
    async payload(kind) { const url = await createShareUrl(serializeProject(), location.href, kind || { kind: "diagram" }); return new URL(url).hash.slice(3); },
    top(id) { const n = nodeById(id); return { x: n.x, y: n.y - n.h / 2 - SKIN_DEPTH / 2 }; },
  };
};
const VIEWER_HELPERS = () => {
  window.__v = {
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    px(p) { const v = __viewer.view, d = sv.width / sv.getBoundingClientRect().width, x = Math.round((v.x + p.x * v.zoom) * d), y = Math.round((v.y + p.y * v.zoom) * d); const k = sctx.getImageData(x, y, 1, 1).data; return [k[0], k[1], k[2]]; },
    hex(h) { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; },
    near(a, b, tol = 6) { return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol; },
    bg() { return doc.customBg || THEMES[doc.theme].bg; },
    top(id) { const n = nodeById(id); return { x: n.x, y: n.y - n.h / 2 - 4 }; },
    /* lienzo congelado a t=0, para comparar con otro Viewer */
    frozen() { playing = false; pausedAt = 0; renderViewerFrame(); return sv.toDataURL(); },
  };
};
/* La escena de 019.1: rect, cylinder, icon, hex, text; conexiones simples, un par y dos hermanas con etiqueta. */
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

async function openEditor(browser, base, vp, url = "/", { keepAutosave = false, ctx: given } = {}) {
  const ctx = given || await browser.newContext({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: "block", deviceScaleFactor: 1 });
  if (!given) await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + url); await page.waitForFunction(() => typeof refreshPanel === "function" && typeof buildSVGDocument === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator(keepAutosave ? "#autosaveRestore" : "#autosaveDiscard").click();
  if (await page.locator("#incomingModal").isVisible().catch(() => false)) await page.locator("#incomingOpen").click();
  await page.evaluate(EDITOR_HELPERS);
  await page.evaluate(() => waitForRenderFonts(doc));
  return { ctx, page, errors, vp };
}
async function openViewer(browser, base, vp, payload, { ctx: given, mobile = false } = {}) {
  const ctx = given || await browser.newContext({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  if (!given) await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  await page.goto(base + "/s/#d=" + payload);
  await page.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
  await page.evaluate(VIEWER_HELPERS);
  await page.evaluate(() => __v.frame());
  return { ctx, page, errors, vp };
}
const frame = (page) => page.evaluate(() => (window.__t || window.__v).frame());
async function shot(page, name) { await page.mouse.move(2, 2); await frame(page); await page.screenshot({ path: path.join(shots, name + ".png") }); }

async function main() {
  const t0 = Date.now();
  const head = headTree();
  /* smoke del service worker: la versión anterior es una revisión FIJA (0409f4d, CACHE v93; antes 22f82eb, d4fb06d, ce8e699, d31703e, 266ac09 y b534a97) y no HEAD, para que siga valiendo
     después de commitear la v94 (SCENARIOS-SEMANTICS-001) */
  const swPrev = headTree("0409f4d");
  /* El «Viewer anterior» (sin skin.js) es una revisión FIJA, la última de 019.1 (v85): desde que 019.2 está commiteada, HEAD
     ya carga skin.js y no sirve para eso (FLUYO-019.3). */
  const pre = headTree("2000360");
  const { server, base } = await serve(root), { server: serverOld, base: baseOld } = await serve(head), { server: serverPre, base: basePre } = await serve(pre);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const vp = { key: "d1440", width: 1440, height: 900 }, mobile = { key: "m390", width: 390, height: 844 };
  try {
    console.log(`\n── ${vp.key}: documentos antiguos = HEAD byte a byte (${EXAMPLES.length} ejemplos) y arrancan planos`);
    for (const slug of EXAMPLES) {
      const now = await openEditor(browser, base, vp, "/?ejemplo=" + slug), old = await openEditor(browser, baseOld, vp, "/?ejemplo=" + slug);
      for (const p of [now, old]) await p.page.waitForFunction(() => P().nodes.length > 0);
      const a = await now.page.evaluate(async () => ({ svg: buildSVGDocument(1), png: __t.raster(), json: JSON.stringify(serializeProject()), share: await __t.payload(), skin: settings.skin, sel: $("skinSel").value, btn: $("prSkin").textContent }));
      const b = await old.page.evaluate(async () => ({ svg: buildSVGDocument(1), png: __t.raster(), json: JSON.stringify(serializeProject()), share: await __t.payload() }));
      check(a.svg === b.svg && a.png === b.png, `${slug}: SVG y raster idénticos a HEAD (${b.svg.length} bytes)`);
      check(a.json === b.json && !a.json.includes('"skin"'), `${slug}: documento serializado idéntico a HEAD, sin clave`);
      check(a.share === b.share, `${slug}: payload del share idéntico a HEAD (${b.share.length} caracteres)`);
      check(a.skin === undefined && a.sel === "flat" && a.btn === "Plano", `${slug}: arranca plano («Aspecto» = Plano)`);
      check(now.errors.length === 0 && old.errors.length === 0, `${slug}: 0 errores (${now.errors.concat(old.errors).join(" | ")})`);
      await now.ctx.close(); await old.ctx.close();
    }

    console.log(`\n── ${vp.key}: escena — Present escribe el documento; exportar no; guardar, recargar y compartir conservan la piel`);
    const t = await openEditor(browser, base, vp), page = t.page;
    const old = await openEditor(browser, baseOld, vp);
    await page.evaluate(() => __t.reset("crema")); await old.page.evaluate(() => __t.reset("crema"));
    const ids = await page.evaluate(SCENE); await old.page.evaluate(SCENE);
    await frame(page);
    {
      const a = await page.evaluate(() => ({ svg: buildSVGDocument(1), png: __t.raster(), json: JSON.stringify(serializeProject()) }));
      const b = await old.page.evaluate(() => ({ svg: buildSVGDocument(1), png: __t.raster(), json: JSON.stringify(serializeProject()) }));
      check(a.svg === b.svg && a.png === b.png && a.json === b.json, "escena: SVG, raster y documento idénticos a HEAD en plano");
    }
    await old.ctx.close();
    const tp = await page.evaluate((id) => __t.top(id), ids.w1);
    const tones = await page.evaluate((id) => skinTones(nodeById(id).color, doc.theme, __t.bg()), ids.w1);
    const bgRGB = await page.evaluate(() => __t.hex(__t.bg())), topRGB = await page.evaluate((h) => __t.hex(h), tones.top);
    const near = (a, b) => page.evaluate(([a, b]) => __t.near(a, b), [a, b]);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check(await page.evaluate(() => projectSkin(settings) === "flat" && settings.skin === undefined && $("skinSel").value === "flat"), "documento nuevo: plano, sin clave, «Aspecto» = Plano");
    await shot(page, "01-editor-plano");
    /* Present arranca plano; B escribe el documento */
    await page.keyboard.press("p"); await page.waitForFunction(() => presenting === true); await frame(page); await frame(page);
    check(same(await page.evaluate((tp) => __t.px(tp), tp), bgRGB) && (await page.evaluate(() => $("prSkin").textContent)) === "Plano", "Present: arranca plano (tapa = fondo), botón «Plano»");
    const undo0 = await page.evaluate(() => undoStack.length);
    await page.keyboard.press("b"); await frame(page); await frame(page);
    check(await near(await page.evaluate((tp) => __t.px(tp), tp), topRGB), `tecla B: la tapa toma el tono claro (${topRGB})`);
    check(await page.evaluate(() => settings.skin === "built" && $("prSkin").textContent === "Construido" && $("prSkin").getAttribute("aria-pressed") === "true"), "tecla B: settings.skin = \"built\", botón «Construido»");
    check((await page.evaluate(() => undoStack.length)) === undo0, "cambiar el aspecto no crea entrada de Undo");
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("fluyo.autosave.v1")).settings.skin === "built"; } catch { return false; } });
    check(true, "autoguardado: settings.skin = \"built\" en localStorage");
    await shot(page, "02-present-construido-crema");
    await page.locator("#prSkin").click(); await frame(page);
    check(await page.evaluate(() => settings.skin === undefined && $("prSkin").textContent === "Plano"), "botón de la barra: plano = sin clave");
    await page.keyboard.press("b"); await frame(page);
    /* salir: «Lienzo» refleja el documento; el editor sigue al documento (FLUYO-019.4b, decisión 226; antes: plano) */
    await page.keyboard.press("Escape"); await page.waitForFunction(() => presenting === false); await frame(page); await frame(page);
    check(await page.evaluate(() => $("skinSel").value === "built" && settings.skin === "built"), "al salir de Present, «Aspecto» muestra «Construido»");
    {
      const on = await page.evaluate(() => editorSkinOn()), px = await page.evaluate((tp) => __t.px(tp), tp);
      check(on ? await near(px, topRGB) : same(px, bgRGB), `el lienzo del editor sigue al documento con settings.skin = "built" (piel activa a este zoom: ${on}; tapa ${px})`);
    }
    {
      const a = await page.evaluate(() => ({ svg: buildSVGDocument(1, "flat"), png: __t.raster("flat") }));
      const o = await openEditor(browser, baseOld, vp); await o.page.evaluate(() => __t.reset("crema")); await o.page.evaluate(SCENE); await frame(o.page);
      const b = await o.page.evaluate(() => ({ svg: buildSVGDocument(1), png: __t.raster() }));
      check(a.svg === b.svg && a.png === b.png, "con la piel en el documento, la exportación en «Plano» sigue siendo byte a byte la de HEAD");
      await o.ctx.close();
    }
    /* diálogo de exportar: arranca con el del documento; elegir otro no escribe */
    {
      const r = await page.evaluate(() => {
        const got = [];
        window.downloadTextFile = (name, content) => got.push({ name, content });
        $("btnExport").click(); const start = $("exSkin").value; $("exSkin").value = "flat"; $("exFmt").value = "svg"; $("exGo").click();
        const after = settings.skin;
        $("btnExport").click(); const start2 = $("exSkin").value; $("exFmt").value = "svg"; $("exGo").click();
        return { start, start2, after, flat: got[0] && !got[0].content.includes("skin-clip-"), built: got[1] && got[1].content.includes("skin-clip-"), n: got.length, still: settings.skin, sel: $("skinSel").value };
      });
      check(r.start === "built" && r.start2 === "built", "diálogo: «Aspecto» arranca con el del documento, también tras una exportación en plano");
      check(r.n === 2 && r.flat && r.built, "exGo: SVG plano con «Plano», con piel con «Construido»");
      check(r.after === "built" && r.still === "built" && r.sel === "built", "exportar en «Plano» no escribe el documento");
    }
    /* #skinSel cambia Present */
    await page.evaluate(() => { $("skinSel").value = "flat"; $("skinSel").onchange(); }); await frame(page);
    check(await page.evaluate(() => settings.skin === undefined), "«Aspecto» → Plano: la clave desaparece");
    await page.keyboard.press("p"); await page.waitForFunction(() => presenting === true); await frame(page); await frame(page);
    check(same(await page.evaluate((tp) => __t.px(tp), tp), bgRGB), "Present respeta «Aspecto» = Plano");
    await page.keyboard.press("Escape"); await page.waitForFunction(() => presenting === false);
    await page.evaluate(() => { $("skinSel").value = "built"; $("skinSel").onchange(); }); await frame(page);
    check(await page.evaluate(() => settings.skin === "built" && $("prSkin").textContent === "Construido"), "«Aspecto» → Construido: settings.skin = \"built\" y la barra de Present sincronizada");
    /* guardar / abrir (en memoria) */
    {
      const r = await page.evaluate(() => { const json = JSON.stringify(serializeProject()); const p = JSON.parse(json); const out = { hasKey: p.settings.skin === "built", keys: Object.keys(p) }; applyProjectData(JSON.parse(json)); out.after = settings.skin; out.sel = $("skinSel").value; out.nodes = P().nodes.length; return out; });
      check(r.hasKey && r.keys.join() === "version,app,doc,settings" && r.after === "built" && r.sel === "built" && r.nodes === 10, "guardar y abrir el .fluyo.json conserva skin:\"built\" (version 5, mismas claves)");
    }
    /* fixture y golden compartidos con el MCP */
    {
      const r = await page.evaluate(() => ({ project: serializeProject(), svg: buildSVGDocument(1, "built"), theme: doc.theme }));
      const lines = skinSvgLines(r.svg);
      if (UPDATE) {
        fs.writeFileSync(FIXTURE, JSON.stringify(r.project, null, 1) + "\n");
        fs.writeFileSync(GOLDEN, JSON.stringify({ generatedBy: "test/fluyo-019-2-browser.cjs (FLUYO_UPDATE_GOLDEN=1): buildSVGDocument(1, \"built\") del editor real, líneas de la piel (skinSvgLines)", theme: r.theme, skin: "built", lines }, null, 1) + "\n");
        console.log("  · golden regenerado: " + lines.length + " líneas");
      }
      const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8")), golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
      const fresh = await openEditor(browser, base, vp);
      const got = await fresh.page.evaluate((f) => { applyProjectData(f); return { skin: settings.skin, svg: buildSVGDocument(1, "built"), flat: buildSVGDocument(1) }; }, fixture);
      check(got.skin === "built" && JSON.stringify(skinSvgLines(got.svg)) === JSON.stringify(golden.lines) && lines.length >= 40, `golden: el fixture compartido reproduce las ${golden.lines.length} líneas de la piel`);
      check(skinSvgLines(got.flat).every((l) => !l.includes("skin-clip-")) && !got.flat.includes("skin-clip-"), "golden: sin bandera el mismo documento exporta plano");
      await fresh.ctx.close();
    }
    /* recargar con autoguardado */
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("fluyo.autosave.v1")).settings.skin === "built"; } catch { return false; } });
    const reloaded = await openEditor(browser, base, vp, "/", { keepAutosave: true, ctx: t.ctx });
    check(await reloaded.page.evaluate(() => settings.skin === "built" && $("skinSel").value === "built" && P().nodes.length === 10), "recargar y restaurar la sesión conserva skin:\"built\"");
    await reloaded.page.close();
    check(t.errors.length === 0, `escena: 0 errores (${t.errors.join(" | ")})`);

    console.log(`\n── Share → Viewer: el Viewer pinta lo que diga el documento (crema y oscuro; escritorio${QUICK ? "" : " y móvil"})`);
    const themes = QUICK ? ["crema"] : ["crema", "dark"];
    const payloads = {};
    for (const theme of themes) {
      await page.evaluate((theme) => { setThemeIn(doc, { theme, customBg: "" }); settings.skin = "built"; }, theme);
      payloads[theme] = { built: await page.evaluate(() => __t.payload()), flat: await page.evaluate(async () => { delete settings.skin; const p = await __t.payload(); settings.skin = "built"; return p; }) };
    }
    for (const theme of themes) {
      const v = await openViewer(browser, base, vp, payloads[theme].built);
      const info = await v.page.evaluate((id) => ({ skinNode: typeof skinNode, skin: settings.skin, vp: viewerRenderState().viewport.skin, zoom: __viewer.view.zoom, active: skinActive("built", __viewer.view.zoom), theme: doc.theme }), ids.w1);
      const vtp = await v.page.evaluate((id) => __v.top(id), ids.w1);
      const vt = await v.page.evaluate((id) => skinTones(nodeById(id).color, doc.theme, __v.bg()), ids.w1);
      const topV = await v.page.evaluate((h) => __v.hex(h), vt.top), bgV = await v.page.evaluate(() => __v.hex(__v.bg()));
      check(info.skinNode === "function" && info.skin === "built" && info.vp === "built" && info.theme === theme, `${theme}: el Viewer carga skin.js y lee settings.skin = "built" del share`);
      check(info.active && await v.page.evaluate(([p, c]) => __v.near(__v.px(p), c), [vtp, topV]), `${theme}: Viewer, vista normal: la tapa tiene el tono claro (zoom ${info.zoom.toFixed(2)})`);
      await shot(v.page, `03-viewer-construido-${theme}`);
      await v.page.evaluate(() => enterPresent()); await v.page.waitForFunction(() => window.__viewer.presenting === true); await frame(v.page); await frame(v.page); await frame(v.page);
      const zp = await v.page.evaluate(() => __viewer.view.zoom);
      check(await v.page.evaluate(([p, c]) => __v.near(__v.px(p), c), [vtp, topV]), `${theme}: Viewer en Present: la tapa tiene el tono claro (zoom ${zp.toFixed(2)})`);
      await shot(v.page, `04-viewer-present-${theme}`);
      await v.page.evaluate(() => exitPresent()); await frame(v.page);
      check(v.errors.length === 0, `${theme}: Viewer 0 errores (${v.errors.join(" | ")})`);
      await v.ctx.close();
      /* share plano: mismo lienzo que el Viewer de HEAD */
      const nv = await openViewer(browser, base, vp, payloads[theme].flat), ov = await openViewer(browser, baseOld, vp, payloads[theme].flat);
      const a = await nv.page.evaluate(() => ({ skin: settings.skin, vp: viewerRenderState().viewport.skin, png: __v.frozen() })), b = await ov.page.evaluate(() => ({ png: __v.frozen() }));
      check(a.skin === undefined && a.vp === "flat" && a.png === b.png, `${theme}: share plano → lienzo del Viewer idéntico al de HEAD`);
      await nv.ctx.close(); await ov.ctx.close();
      /* Viewer de 019.1 (sin skin.js) con un share construido: plano y sin errores */
      const hv = await openViewer(browser, basePre, vp, payloads[theme].built);
      const h = await hv.page.evaluate(([p, bg]) => ({ skinNode: typeof skinNode, skin: settings.skin, flat: __v.near(__v.px(p), bg) }), [vtp, bgV]);
      check(h.skinNode === "undefined" && h.skin === "built" && h.flat && hv.errors.length === 0, `${theme}: el Viewer anterior (sin skin.js) abre el share construido plano y sin errores`);
      await hv.ctx.close();
    }
    if (!QUICK) {
      const mv = await openViewer(browser, base, mobile, payloads.crema.built, { mobile: true });
      const m = await mv.page.evaluate((id) => { const z = __viewer.view.zoom; return { z, active: skinActive("built", z), skin: viewerRenderState().viewport.skin }; }, ids.w1);
      const mtp = await mv.page.evaluate((id) => __v.top(id), ids.w1);
      const mtone = await mv.page.evaluate((id) => __v.hex(skinTones(nodeById(id).color, doc.theme, __v.bg()).top), ids.w1);
      const painted = await mv.page.evaluate(([p, c]) => __v.near(__v.px(p), c), [mtp, mtone]);
      check(m.skin === "built" && painted === m.active, `móvil ${mobile.width}×${mobile.height}: zoom ${m.z.toFixed(2)} → ${m.active ? "piel" : "plano (canto < 3 px)"}, como dice skinActive`);
      check(mv.errors.length === 0, `móvil: 0 errores (${mv.errors.join(" | ")})`);
      await shot(mv.page, "06-viewer-movil");
      await mv.ctx.close();
    }
    /* «Abrir en Fluyo»: el editor recibe la piel por el deep link */
    {
      const e = await openEditor(browser, base, vp, "/#d=" + payloads.crema.built);
      await e.page.waitForFunction(() => P().nodes.length > 0);
      check(await e.page.evaluate(() => settings.skin === "built" && $("skinSel").value === "built" && projectSkin(settings) === "built"), "«Abrir en Fluyo» (deep link): el editor entra con skin:\"built\" y «Aspecto» = Construido");
      const etp = await e.page.evaluate((id) => __t.top(id), ids.w1);
      await e.page.keyboard.press("p"); await e.page.waitForFunction(() => presenting === true); await frame(e.page); await frame(e.page);
      check(await e.page.evaluate(([p, c]) => __t.near(__t.px(p), c), [etp, topRGB]), "…y Present pinta construido sin tocar nada");
      await shot(e.page, "05-abrir-en-fluyo-present");
      check(e.errors.length === 0, `deep link: 0 errores (${e.errors.join(" | ")})`);
      await e.ctx.close();
    }
    await t.ctx.close();

    if (!QUICK) {
      console.log(`\n── Historia con la piel: Present y Viewer`);
      const p = await openEditor(browser, base, vp);
      await p.page.evaluate((json) => { const d = JSON.parse(json); d.settings.skin = "built"; applyProjectData(d); setUiMode("story"); }, STORY);
      await frame(p.page);
      const traceFlat = await p.page.evaluate(() => { const sc = scActiveScenario(); delete settings.skin; const t = JSON.stringify(FluyoStory.run(P(), sc).trace); settings.skin = "built"; return t; });
      const traceBuilt = await p.page.evaluate(() => { const sc = scActiveScenario(); return JSON.stringify(FluyoStory.run(P(), sc).trace); });
      check(traceFlat === traceBuilt, "Historia: el Trace es el mismo con y sin settings.skin");
      await p.page.keyboard.press("p"); await p.page.waitForFunction(() => presenting === true); await frame(p.page);
      await p.page.evaluate(() => presentPlay()); await p.page.waitForTimeout(1400); await frame(p.page);
      await shot(p.page, "07-historia-present-construido");
      await p.page.waitForTimeout(2000);
      check(p.errors.length === 0, `Historia en Present con la piel: 0 errores (${p.errors.join(" | ")})`);
      /* Esc en Present con una Historia en marcha la detiene; para salir se llama a exitPresent */
      await p.page.evaluate(() => exitPresent()); await p.page.waitForFunction(() => presenting === false);
      const storyPayload = await p.page.evaluate(async () => { const sc = scActiveScenario(); return __t.payload({ kind: "story", scenarioId: sc.id }); });
      await p.ctx.close();
      const sv = await openViewer(browser, base, vp, storyPayload);
      const st = await sv.page.evaluate(() => ({ story: !$("story").hidden, skin: settings.skin, vp: viewerRenderState().viewport.skin }));
      await sv.page.locator("#stPlay").click(); await sv.page.waitForTimeout(1600); await frame(sv.page);
      await shot(sv.page, "08-historia-viewer-construido");
      check(st.story && st.skin === "built" && st.vp === "built" && sv.errors.length === 0, `Historia en el Viewer con la piel: transporte visible, reproduce, 0 errores (${sv.errors.join(" | ")})`);
      await sv.ctx.close();

      console.log(`\n── Service worker: de v93 (0409f4d) a v95 — el Viewer pasa a pintar construido`);
      const sw = await serve(swPrev);
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
      await ctx.route((u) => !u.href.startsWith(sw.base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
      try {
        const pg = await ctx.newPage();
        await pg.goto(sw.base + "/"); await pg.waitForFunction(() => typeof renderTabs === "function");
        /* Sondeo con evaluate: page.waitForFunction NO espera promesas (un predicado async se resuelve al instante). */
        const until = async (fn, arg, label) => { const t = Date.now(); while (Date.now() - t < 60000) { if (await pg.evaluate(fn, arg)) return; await pg.waitForTimeout(250); } throw new Error("tiempo agotado: " + label); };
        /* «instalada» = la precarga ha terminado (el Viewer y su HTML están en la caché), no solo que la caché exista */
        const installed = (name) => until(async (name) => {
          if (!(await caches.keys()).includes(name)) return false;
          const c = await caches.open(name);
          return !!(await c.match(location.origin + "/js/viewer.js")) && !!(await c.match(location.origin + "/s/")) && !!(await c.match(location.origin + "/js/skin.js"));
        }, name, name + " instalada");
        /* «activado» = el activate (que borra las demás cachés) ha terminado: si se pidiera el update antes, el worker viejo
           borraría la caché nueva a medio llenar */
        const activated = () => until(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !r.installing && !r.waiting && !!r.active && r.active.state === "activated"; }, null, "worker activado");
        await pg.evaluate(async () => { await navigator.serviceWorker.ready; });
        await installed("fluyo-static-v93"); await activated();
        check(true, "0409f4d servido: caché fluyo-static-v93 instalada y worker activado");
        sw.state.dir = root;
        await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
        await installed("fluyo-static-v112"); await activated();
        await until(async () => !(await caches.keys()).includes("fluyo-static-v93"), null, "v93 borrada");
        const after = await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const c = await caches.open("fluyo-static-v112"); return { state: r.active.state, entries: (await c.keys()).length, keys: await caches.keys() }; });
        check(after.state === "activated" && after.entries >= 50 && after.keys.join() === "fluyo-static-v112", `árbol nuevo: v95 instalada (${after.entries} entradas) y activada (skipWaiting + claim), v93 borrada`);
        await pg.close();
        const vw = await ctx.newPage(), errs = [];
        vw.on("pageerror", (e) => errs.push(e.message));
        await vw.goto(sw.base + "/s/#d=" + payloads.crema.built); await vw.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready");
        await vw.evaluate(VIEWER_HELPERS); await vw.evaluate(() => __v.frame());
        const fromSW = await vw.evaluate(async () => { const c = await caches.open("fluyo-static-v112"); return !!(await c.match(location.origin + "/js/skin.js")); });
        const vtp = await vw.evaluate((id) => __v.top(id), ids.w1);
        const tone = await vw.evaluate((id) => __v.hex(skinTones(nodeById(id).color, doc.theme, __v.bg()).top), ids.w1);
        check(fromSW && (await vw.evaluate(() => typeof skinNode)) === "function" && await vw.evaluate(([p, c]) => __v.near(__v.px(p), c), [vtp, tone]) && errs.length === 0, "tras el upgrade, el Viewer sirve skin.js desde la caché v95 y pinta construido");
      } finally { await ctx.close(); sw.server.close(); }
    }

    /* comparación lado a lado */
    if (!QUICK) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 520 } });
      const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(shots, f)).toString("base64");
      await p.setContent(`<body style="margin:0;background:#F2EDE3;font:12px 'Segoe UI',sans-serif;display:flex;gap:8px;padding:8px"><figure style="margin:0;flex:1"><figcaption>Editor (plano, como siempre)</figcaption><img src="${img("01-editor-plano.png")}" style="width:100%"></figure><figure style="margin:0;flex:1"><figcaption>Viewer desde el share (settings.skin = "built")</figcaption><img src="${img("03-viewer-construido-crema.png")}" style="width:100%"></figure></body>`);
      await p.screenshot({ path: path.join(shots, "09-comparacion-editor-vs-viewer.png"), fullPage: true });
      await p.close();
    }
  } finally { await browser.close(); server.close(); serverOld.close(); serverPre.close(); fs.rmSync(head, { recursive: true, force: true }); fs.rmSync(swPrev, { recursive: true, force: true }); fs.rmSync(pre, { recursive: true, force: true }); }
  console.log(`\nFLUYO-019.2 browser: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
