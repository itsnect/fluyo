"use strict";
/* FLUYO-019.5 — El tinte de un color de nodo (relleno automático, panel de `code`, pista de `anim`) en Chrome real.
   · Píxeles: en el raster exportado (t=0, determinista), en el lienzo del editor, en Present y en el Viewer (share), el relleno de
     cada nodo es fondo·(1−k·α) + color·k·α, calculado AQUÍ en Node con la regla escrita (no con geometry.js): #rrggbb tal cual,
     #rgb expandido, #rrggbbaa con su alfa, ilegible → PALETTE[0] (panel de `code`: el fondo del tema). Crema, oscuro, claro y
     fondo propio; también en el raster «construido» para las formas sin piel (círculo, rombo, hexágono, `code`, `anim`).
   · Paridad lienzo/SVG: el fill del SVG de cada nodo = fillFor del lienzo; y la secuencia de fills del SVG = la del fixture
     compartido con fluyo-mcp (test/fixtures/fluyo-019-5-tinte.json; FLUYO_UPDATE_GOLDEN=1 lo regenera).
   · Identidad: todo el corpus (ejemplos + fixtures .fluyo.json) da SVG y raster, plano y «construido», idénticos byte a byte a
     los de b534a97 (antes de 019.5): ninguno usa #rgb/#rrggbbaa/ilegibles en un color de nodo.
   · 0 errores de consola.
   Uso: node test/fluyo-019-5-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BEFORE = "b534a97";
const GOLDEN = path.join(root, "test/fixtures/fluyo-019-5-tinte.json");
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-019-5-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* ── el documento: los formatos que corrige 019.5, con controles #rrggbb y un relleno explícito ── */
const R = (id, shape, x, y, color, extra = {}) => ({ id, shape, x, y, label: "", color, ...extra });
const NODES = [
  R(1, "rect", 140, 120, "#7fa66b", { w: 160, h: 80 }), R(2, "rect", 340, 120, "#7fa66b80", { w: 160, h: 80 }), R(3, "rect", 540, 120, "#7FA66BCC", { w: 160, h: 80 }),
  R(4, "rect", 740, 120, "#7fa66bff", { w: 160, h: 80 }), R(5, "rect", 940, 120, "#7fa66b00", { w: 160, h: 80 }),
  R(6, "circle", 140, 300, "#d08b5b", { w: 120, h: 120 }), R(7, "circle", 340, 300, "#d08b5bcc", { w: 120, h: 120 }), R(8, "diamond", 540, 300, "#abc", { w: 140, h: 110 }),
  R(9, "diamond", 740, 300, "#ABC", { w: 140, h: 110 }), R(10, "hex", 940, 300, "#aabbcc80", { w: 150, h: 100 }),
  R(11, "rect", 140, 480, "red", { w: 160, h: 80 }), R(12, "rect", 340, 480, "#12345", { w: 160, h: 80 }), R(13, "rect", 540, 480, " #d08b5b80 ", { w: 160, h: 80 }),
  R(14, "rect", 740, 480, "#7fa66b80", { w: 160, h: 80, fill: "#ffffff80" }), R(15, "cylinder", 940, 480, "#d08b5bcc", { w: 150, h: 110 }),
  { id: 16, shape: "code", x: 200, y: 680, w: 300, h: 150, label: "SELECT 1", color: "#6a9fb5cc", lang: "sql" },
  { id: 17, shape: "code", x: 540, y: 680, w: 300, h: 150, label: "SELECT 2", color: "#abc", lang: "sql" },
  { id: 18, shape: "code", x: 880, y: 680, w: 300, h: 150, label: "SELECT 3", color: "red", lang: "sql" },
  R(19, "anim", 1140, 300, "#7fa66b80", { anim: "progress", w: 120, h: 100 }), R(20, "anim", 1140, 480, "#abc", { anim: "progress", w: 120, h: 100 }),
];
const docFor = (theme, customBg, skin) => ({ version: 5, app: "fluyo", settings: Object.assign({ grid: false }, skin ? { skin } : {}),
  doc: { theme, customBg, eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [{ name: "Tinte", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 30, nodes: NODES, edges: [] }] } });
const SCENES = [["crema", ""], ["dark", ""], ["claro", ""], ["crema", "#123456"]];
const TINT_COLORS = ["#7fa66b", "#7FA66B", "#7fa66b80", "#7FA66BCC", "#7fa66bff", "#7fa66b00", "#00000001", "#abc", "#ABC", "#aabbcc80", " #d08b5b80 ",
  "red", "#12345", "", "#abcd", "#7fa66b8", "#gggggg", "rgb(1,2,3)", "#d08b5bcc #"];
const TINT_K = [0.16, 0.18, 0.2, 0.15];

/* ── la regla, escrita aquí (independiente de geometry.js) ── */
const THEME_BG = { dark: "#161616", crema: "#f4eee1", claro: "#ffffff" }, LBL_BG = THEME_BG, PALETTE0 = "#6a9fb5";
const rgbOf = (h) => { let s = h.trim().slice(1); if (s.length === 3) s = s.split("").map((c) => c + c).join(""); const v = parseInt(s.slice(0, 6), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const readHex = (c) => { const m = typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c.trim()); return m ? { rgb: rgbOf(c), a: m[1].length === 8 ? parseInt(m[1].slice(6), 16) / 255 : 1 } : null; };
const mix = (bg, c, t) => [0, 1, 2].map((i) => Math.round(bg[i] * (1 - t) + c[i] * t));
/* píxel esperado del relleno de un nodo sobre el fondo */
function expectedPx(n, theme, customBg) {
  const bg = rgbOf(customBg || THEME_BG[theme]), k = n.shape === "anim" ? 0.2 : (theme === "crema" ? 0.16 : 0.18);
  if (n.fill && n.fill !== "none") { const f = readHex(n.fill); return mix(bg, f.rgb, f.a); }
  const r = readHex(n.color);
  if (!r) return n.shape === "code" ? rgbOf(LBL_BG[theme]) : mix(bg, rgbOf(PALETTE0), k);
  return mix(bg, r.rgb, k * r.a);
}
/* punto de medida de cada nodo (mundo): dentro de la forma, lejos del trazo y del texto */
const probeOf = (n) => n.shape === "code" ? { x: n.x + n.w / 2 - 14, y: n.y + n.h / 2 - 12 }
  : n.shape === "anim" ? { x: n.x + 44, y: n.y } : n.shape === "cylinder" ? { x: n.x, y: n.y + n.h / 4 } : { x: n.x, y: n.y + n.h / 5 };
const near = (a, b, tol = 2) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
const SKINNED = new Set(["rect", "cylinder", "icon"]);   // piezas con piel (019.1): en «construido» su frente lo pinta skin.js

const EDITOR_HELPERS = () => {
  window.__t = {
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    px(p) { const d = cv.width / cv.getBoundingClientRect().width, x = Math.round((viewX + p.x * viewZoom) * d), y = Math.round((viewY + p.y * viewZoom) * d); const k = ctx.getImageData(x, y, 1, 1).data; return [k[0], k[1], k[2]]; },
    /* raster de exportación a t=0 (la pista de progress, sin avance), plano o construido; devuelve el dataURL y los píxeles pedidos */
    raster(skin, probes) { const b = getBounds(), off = document.createElement("canvas"); off.width = Math.round(b.w); off.height = Math.round(b.h); const oc = off.getContext("2d");
      oc.translate(-b.x, -b.y); render(oc, 0, Object.assign({ export: true, bounds: b, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }, skin ? { skin } : {}));
      const px = (probes || []).map((p) => { const k = oc.getImageData(Math.round(p.x - b.x), Math.round(p.y - b.y), 1, 1).data; return [k[0], k[1], k[2]]; });
      return { png: off.toDataURL(), px }; },
  };
};
const VIEWER_HELPERS = () => {
  window.__v = {
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    px(p) { const v = __viewer.view, d = sv.width / sv.getBoundingClientRect().width, x = Math.round((v.x + p.x * v.zoom) * d), y = Math.round((v.y + p.y * v.zoom) * d); const k = sctx.getImageData(x, y, 1, 1).data; return [k[0], k[1], k[2]]; },
  };
};

async function openEditor(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof buildSVGDocument === "function" && typeof applyProjectData === "function");
  for (const id of ["#autosaveDiscard", "#incomingOpen"]) if (await page.locator(id).isVisible().catch(() => false)) await page.locator(id).click();
  await page.evaluate(EDITOR_HELPERS);
  return { ctx, page, errors };
}
async function load(page, data) {
  await page.evaluate((d) => { applyProjectData(d); viewZoom = 0.6; viewX = 30; viewY = 30; }, data);
  await page.evaluate(() => waitForRenderFonts(doc));
  await page.evaluate(() => __t.frame()); await page.waitForTimeout(150); await page.evaluate(() => __t.frame());
}
const svgFills = (svg) => (svg.match(/ fill="rgba\([^"]*\)"/g) || []).map((s) => s.slice(7, -1));

async function main() {
  const t0 = Date.now();
  const old = treeAt(BEFORE);
  const { server, base } = await serve(root), { server: serverOld, base: baseOld } = await serve(old);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const golden = { generatedBy: "test/fluyo-019-5-browser.cjs (FLUYO_UPDATE_GOLDEN=1): colorTint y buildSVGDocument(1) del editor real", doc: docFor("crema", "", null), tints: [], svg: {} };
  try {
    const e = await openEditor(browser, base), page = e.page;
    golden.tints = await page.evaluate(([cs, ks]) => cs.flatMap((c) => ks.map((k) => ({ color: c, k, tint: colorTint(c, k) }))), [TINT_COLORS, TINT_K]);

    for (const [theme, customBg] of SCENES) {
      const tag = theme + (customBg ? " + fondo " + customBg : "");
      console.log(`\n── ${tag}`);
      await load(page, docFor(theme, customBg, null));
      const nodes = await page.evaluate(() => P().nodes.map((n) => ({ id: n.id, shape: n.shape, color: n.color, fill: n.fill, x: n.x, y: n.y, w: n.w, h: n.h })));
      check(nodes.find((n) => n.id === 13).color === " #d08b5b80 " && nodes.find((n) => n.id === 3).color === "#7FA66BCC", `${tag}: el documento carga tal cual (los colores no se reescriben)`);

      /* raster exportado, plano: todos los nodos */
      const flat = await page.evaluate((ps) => __t.raster(null, ps), nodes.map(probeOf));
      const bad = nodes.filter((n, i) => !near(flat.px[i], expectedPx(n, theme, customBg))).map((n, i) => `#${n.id} ${n.shape} ${JSON.stringify(n.color)}: ${flat.px[nodes.indexOf(n)]} ≠ ${expectedPx(n, theme, customBg)}`);
      check(bad.length === 0, `${tag}: raster plano, los ${nodes.length} rellenos = fondo·(1−kα)+color·kα (regla escrita)${bad.length ? " — " + bad.slice(0, 4).join(" · ") : ""}`);

      /* raster «construido»: las formas sin piel, igual */
      const unskinned = nodes.filter((n) => !SKINNED.has(n.shape));
      const built = await page.evaluate((ps) => __t.raster("built", ps), unskinned.map(probeOf));
      const badB = unskinned.filter((n, i) => !near(built.px[i], expectedPx(n, theme, customBg))).map((n) => `#${n.id} ${n.shape}`);
      check(badB.length === 0, `${tag}: raster «construido», las ${unskinned.length} formas sin piel con el mismo tinte${badB.length ? " — " + badB.join(", ") : ""}`);

      /* lienzo del editor */
      const shown = nodes.filter((n) => [1, 2, 7, 8, 11, 13, 16].includes(n.id));
      const onCanvas = [];
      for (const n of shown) onCanvas.push(await page.evaluate((p) => __t.px(p), probeOf(n)));
      const badC = shown.filter((n, i) => !near(onCanvas[i], expectedPx(n, theme, customBg))).map((n, i) => `#${n.id}`);
      check(badC.length === 0, `${tag}: lienzo del editor (${shown.length} nodos)${badC.length ? " — " + badC.join(", ") : ""}`);

      /* SVG: paridad con el lienzo y con el fixture */
      const sv = await page.evaluate(() => ({ svg: buildSVGDocument(1), fills: P().nodes.filter((n) => n.shape !== "code" && n.shape !== "anim").map((n) => svgNodeFill(n, doc.theme)),
        canvas: P().nodes.filter((n) => n.shape !== "code" && n.shape !== "anim").map((n) => fillFor(n, doc.theme)), panels: P().nodes.filter((n) => n.shape === "code").map((n) => codeColors(n, doc.theme).panel) }));
      check(JSON.stringify(sv.fills) === JSON.stringify(sv.canvas.map((f) => f || "none")), `${tag}: paridad lienzo/SVG: fill del SVG = fillFor en los ${sv.fills.length} nodos con forma`);
      const seq = svgFills(sv.svg);
      check([...sv.fills.filter((f) => f.startsWith("rgba(")), ...sv.panels.filter((f) => f.startsWith("rgba("))].every((f) => seq.includes(f)), `${tag}: el SVG lleva esos rellenos y los paneles de code (${seq.length} rgba)`);
      check(!/fill="rgba\((166,107,|139,91,204|0,10,188|0,0,237|1,35,69)/.test(sv.svg), `${tag}: ningún tinte con los canales desplazados (166,107,… / 139,91,204 / 0,10,188 / 0,0,237 / 1,35,69)`);
      if (!customBg) golden.svg[theme] = seq;

      /* Present en el editor */
      await page.keyboard.press("p"); await page.waitForFunction(() => presenting === true);
      await page.evaluate(() => { viewZoom = 0.6; viewX = 30; viewY = 30; }); await page.waitForTimeout(700); await page.evaluate(() => __t.frame());
      const pres = [];
      for (const n of shown) pres.push(await page.evaluate((p) => __t.px(p), probeOf(n)));
      const badP = shown.filter((n, i) => !near(pres[i], expectedPx(n, theme, customBg))).map((n) => `#${n.id}`);
      check(badP.length === 0, `${tag}: Present (${shown.length} nodos)${badP.length ? " — " + badP.join(", ") : ""}`);
      await page.evaluate(() => exitPresent()); await page.waitForFunction(() => presenting === false);

      /* Viewer desde el share */
      const payload = await page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "diagram" })).hash.slice(3));
      const v = await e.ctx.newPage(), verr = [];
      v.on("pageerror", (x) => verr.push(x.message)); v.on("console", (m) => { if (m.type() === "error") verr.push(m.text()); });
      await v.goto(base + "/s/#d=" + payload);
      await v.waitForFunction(() => window.__viewer && /ready|error/.test(window.__viewer.phase));
      const phase = await v.evaluate(() => window.__viewer.phase);
      if (phase === "ready") {
        await v.evaluate(VIEWER_HELPERS); await v.evaluate(() => __v.frame()); await v.waitForTimeout(150); await v.evaluate(() => __v.frame());
        const vw = [];
        for (const n of shown) vw.push(await v.evaluate((p) => __v.px(p), probeOf(n)));
        const badV = shown.filter((n, i) => !near(vw[i], expectedPx(n, theme, customBg))).map((n, i) => `#${n.id} ${vw[shown.indexOf(n)]}`);
        check(badV.length === 0, `${tag}: Viewer (share), ${shown.length} nodos${badV.length ? " — " + badV.join(", ") : ""}`);
      } else check(false, `${tag}: el Viewer abre el share (fase «${phase}»)`);
      check(verr.length === 0, `${tag}: Viewer, 0 errores (${verr.slice(0, 2).join(" | ")})`);
      await v.close();
    }
    check(e.errors.length === 0, `editor + Present: 0 errores (${e.errors.slice(0, 2).join(" | ")})`);

    /* fixture compartido con fluyo-mcp */
    if (process.env.FLUYO_UPDATE_GOLDEN) { fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + "\n"); console.log("\n  fixture regenerado: " + path.relative(root, GOLDEN)); }
    const g = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
    check(JSON.stringify(g.tints) === JSON.stringify(golden.tints), `fixture: colorTint de la página = el del fixture (${g.tints.length} casos)`);
    check(["dark", "crema", "claro"].every((t) => JSON.stringify(g.svg[t]) === JSON.stringify(golden.svg[t])), "fixture: la secuencia de fills del SVG del editor = la del fixture en los tres temas");
    check(JSON.stringify(g.doc) === JSON.stringify(golden.doc), "fixture: el documento es el de este test");
    await e.ctx.close();

    /* ── identidad del corpus con b534a97 ── */
    console.log(`\n── corpus: idéntico a ${BEFORE} (plano y «construido», SVG y raster)`);
    const corpus = [];
    for (const dir of ["ejemplos/data", "test/fixtures"]) for (const f of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".fluyo.json")))
      corpus.push([f, JSON.parse(fs.readFileSync(path.join(root, dir, f), "utf8"))]);
    const now = await openEditor(browser, base), was = await openEditor(browser, baseOld);
    await was.page.evaluate(EDITOR_HELPERS);
    let compared = 0;
    for (const [name, data] of corpus) {
      const colors = data.doc.pages.flatMap((pg) => pg.nodes.map((n) => n.color)).filter((c) => c != null);
      check(colors.every((c) => /^#[0-9a-f]{6}$/i.test(c)), `${name}: el corpus solo usa #rrggbb en el color de nodo`);
      const pages = data.doc.pages.length, diffs = [];
      for (let i = 0; i < pages; i++) {
        const shot = async (pg) => {
          await pg.evaluate(([d, i]) => { applyProjectData(d); doc.cur = i; }, [data, i]);
          await pg.evaluate(() => waitForRenderFonts(doc)); await pg.waitForTimeout(120);
          await pg.evaluate(() => __t.raster(null)); await pg.waitForTimeout(120);   // las imágenes de iconos ya cargadas
          return pg.evaluate(() => ({ svg: buildSVGDocument(1), svgB: buildSVGDocument(1, "built"), png: __t.raster(null).png, pngB: __t.raster("built").png }));
        };
        const a = await shot(now.page), b = await shot(was.page);
        for (const k of ["svg", "svgB", "png", "pngB"]) { compared++; if (a[k] !== b[k]) diffs.push(`p${i}.${k}`); }
      }
      check(diffs.length === 0, `${name}: ${pages} página(s) × SVG/raster × plano/construido idénticos a ${BEFORE}${diffs.length ? " — difieren " + diffs.join(", ") : ""}`);
    }
    check(compared >= 40, `corpus: ${compared} comparaciones byte a byte`);
    check(now.errors.length === 0 && was.errors.length === 0, `corpus: 0 errores (${[...now.errors, ...was.errors].slice(0, 2).join(" | ")})`);
    await now.ctx.close(); await was.ctx.close();
  } finally {
    await browser.close(); server.close(); serverOld.close();
    fs.rmSync(old, { recursive: true, force: true });
  }
  console.log(`\nFLUYO-019.5 browser: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
