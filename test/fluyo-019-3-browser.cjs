"use strict";
/* FLUYO-019.3 — La piel con colores #rrggbbaa (válidos en el dominio) en Chrome real.
   Antes de 019.3 (árbol de 1ee65ee) un nodo #rrggbbaa con settings.skin:"built" hacía lanzar a skinTones: la exportación SVG
   fallaba, Present lanzaba en cada fotograma y el Viewer abría el share en fase «error». Aquí se comprueba, en crema, oscuro y
   con fondo propio:
   · el árbol de 1ee65ee reproduce el fallo (referencia fija del bug corregido);
   · editor: cargar el documento, exportar SVG construido y raster construido sin errores; el SVG lleva los tonos compuestos;
   · Present (editor) y Viewer (vista normal y Present, desde el share): 0 errores y la tapa/el frente medidos en píxeles con el
     tono de skinTones (el color compuesto sobre el fondo de la piel);
   · paridad lienzo/SVG: el píxel del frente relleno con #rrggbbaa = el fill de la capa en el SVG;
   · colores ilegibles (#12345, «red») caen en PALETTE[0] sin errores;
   · en plano, el SVG y el raster de este documento son idénticos byte a byte a los de 1ee65ee (la piel no toca el plano), una
     vez aplicado a 1ee65ee el tinte de FLUYO-019.5 (#rgb/#rrggbbaa/ilegibles en el relleno automático).
   Uso: node test/fluyo-019-3-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BEFORE = "1ee65ee";
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-019-3-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* el documento: rect #rrggbbaa, rect con relleno #rrggbbaa, cilindro e icono #rrggbbaa, y dos colores ilegibles */
const docFor = (theme, customBg) => ({
  version: 5, app: "fluyo", settings: { skin: "built", grid: false },
  doc: { theme, customBg, eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [{ name: "Colores", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 10, nodes: [
    { id: 1, shape: "rect", x: 260, y: 200, w: 180, h: 80, label: "", color: "#6a9fb5cc" },
    { id: 2, shape: "rect", x: 620, y: 200, w: 180, h: 80, label: "", color: "#6a9fb5", fill: "#ffffff80" },
    { id: 3, shape: "cylinder", x: 260, y: 420, w: 150, h: 110, label: "DB", color: "#d08b5b80" },
    { id: 4, shape: "icon", icon: "kafka", x: 620, y: 420, w: 120, h: 120, label: "K", color: "#7fa66bcc" },
    { id: 5, shape: "rect", x: 960, y: 200, w: 160, h: 70, label: "", color: "#12345" },
    { id: 6, shape: "rect", x: 960, y: 420, w: 160, h: 70, label: "", color: "red" }],
    edges: [{ id: 7, from: 1, to: 2, route: "ortho", lineColor: "#6a9fb5cc" }, { id: 8, from: 1, to: 3, route: "ortho" }, { id: 9, from: 2, to: 4, route: "ortho" }] }] },
});
const SCENES = [["crema", ""], ["dark", ""], ["crema", "#123456"], ["claro", "#ffffff80"]];

const EDITOR_HELPERS = () => {
  window.__t = {
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    px(p) { const d = cv.width / cv.getBoundingClientRect().width, x = Math.round((viewX + p.x * viewZoom) * d), y = Math.round((viewY + p.y * viewZoom) * d); const k = ctx.getImageData(x, y, 1, 1).data; return [k[0], k[1], k[2]]; },
    raster() { const b = getBounds(), off = document.createElement("canvas"); off.width = Math.round(b.w); off.height = Math.round(b.h); const oc = off.getContext("2d");
      oc.translate(-b.x, -b.y); render(oc, 0, { export: true, skin: "built", bounds: b, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }); return off.toDataURL(); },
    rasterFlat() { const b = getBounds(), off = document.createElement("canvas"); off.width = Math.round(b.w); off.height = Math.round(b.h); const oc = off.getContext("2d");
      oc.translate(-b.x, -b.y); render(oc, 0, { export: true, bounds: b, renderState: makeReadOnlyRenderState({ width: off.width, height: off.height }) }); return off.toDataURL(); },
  };
};
const VIEWER_HELPERS = () => {
  window.__v = {
    frame() { return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); },
    px(p) { const v = __viewer.view, d = sv.width / sv.getBoundingClientRect().width, x = Math.round((v.x + p.x * v.zoom) * d), y = Math.round((v.y + p.y * v.zoom) * d); const k = sctx.getImageData(x, y, 1, 1).data; return [k[0], k[1], k[2]]; },
  };
};
/* puntos de medida (mundo); el tono esperado se calcula AQUÍ, en Node, con la regla escrita (no con skin.js de la página:
   una mutación de skinColor cambiaría a la vez lo pintado y lo esperado) */
const PROBES = () => {
  const n1 = nodeById(1), n2 = nodeById(2), n5 = nodeById(5);
  return [
    { what: "tapa del rect #6a9fb5cc", p: { x: n1.x, y: n1.y - n1.h / 2 - 4 }, color: n1.color, face: "top" },
    { what: "frente del rect con relleno #ffffff80", p: { x: n2.x + n2.w / 2 - 24, y: n2.y + n2.h / 2 - 12 }, fillOf: n2.fill },
    { what: "tapa del rect #12345 (PALETTE[0])", p: { x: n5.x, y: n5.y - n5.h / 2 - 4 }, color: n5.color, face: "top" },
  ];
};
const THEME_BG = { dark: "#161616", crema: "#f4eee1", claro: "#ffffff" }, K_TOP = { dark: 0.14, crema: 0.10, claro: 0.10 }, PALETTE0 = "#6a9fb5";
const rgbOf = (h) => { let s = h.slice(1); if (s.length === 3) s = s.split("").map((c) => c + c).join(""); const v = parseInt(s.slice(0, 6), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const mixRGB = (bg, col, t) => [0, 1, 2].map((i) => Math.round(bg[i] * (1 - t) + col[i] * t));
const readColor = (c, base) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? rgbOf(c) : /^#[0-9a-f]{8}$/i.test(c) ? mixRGB(base, rgbOf(c), parseInt(c.slice(7), 16) / 255) : null;
function expected(pr, theme, customBg) {
  const base = rgbOf(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(customBg) ? customBg : THEME_BG[theme]);
  if (pr.fillOf) return readColor(pr.fillOf, base);
  return mixRGB(base, readColor(pr.color, base) || rgbOf(PALETTE0), K_TOP[theme]);
}
const hex6 = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const near = (a, b, tol = 6) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;

/* FLUYO-019.5: la regla del tinte (relleno automático), escrita a mano para inyectarla en el árbol de 1ee65ee */
const TINT_019_5 = () => {
  const tint = (c, k) => {
    const m = typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c.trim()); if (!m) return null;
    const s = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1], v = parseInt(s.slice(0, 6), 16);
    return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${s.length === 8 ? Math.round(k * parseInt(s.slice(6), 16) / 255 * 1e4) / 1e4 : k})`;
  };
  const node = (c, k) => tint(c, k) || tint(PALETTE[0].c, k);
  window.fillFor = (n, theme) => n.fill === "none" ? null : (n.fill || node(n.color, theme === "crema" ? .16 : .18));
  window.svgFillColor = (hex, theme) => node(hex, theme === "crema" ? .16 : .18);
};

async function openEditor(browser, base, theme, customBg) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof buildSVGDocument === "function" && typeof applyProjectData === "function");
  for (const id of ["#autosaveDiscard", "#incomingOpen"]) if (await page.locator(id).isVisible().catch(() => false)) await page.locator(id).click();
  await page.evaluate(EDITOR_HELPERS);
  await page.evaluate((d) => { applyProjectData(d); viewZoom = 1; viewX = 40; viewY = 40; }, docFor(theme, customBg));
  await page.evaluate(() => waitForRenderFonts(doc));
  await page.evaluate(() => __t.frame());
  return { ctx, page, errors };
}

async function main() {
  const t0 = Date.now();
  const old = treeAt(BEFORE);
  const { server, base } = await serve(root), { server: serverOld, base: baseOld } = await serve(old);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    console.log(`\n── referencia: el árbol de ${BEFORE} (antes de 019.3) fallaba con #rrggbbaa`);
    {
      const o = await openEditor(browser, baseOld, "crema", "");
      const r = await o.page.evaluate(() => { try { buildSVGDocument(1, "built"); return "ok"; } catch (e) { return e.message; } });
      check(/null/.test(r), `${BEFORE}: buildSVGDocument(1,"built") lanzaba (${r})`);
      const payload = await o.page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "diagram" })).hash.slice(3));
      const v = await o.ctx.newPage(); await v.goto(baseOld + "/s/#d=" + payload);
      await v.waitForFunction(() => window.__viewer && window.__viewer.phase !== "loading" && window.__viewer.phase !== "idle", null, { timeout: 15000 }).catch(() => {});
      const phase = await v.evaluate(() => window.__viewer && window.__viewer.phase);
      check(phase === "error", `${BEFORE}: el Viewer abría el share en fase «${phase}»`);
      await o.ctx.close();
    }

    for (const [theme, customBg] of SCENES) {
      const tag = theme + (customBg ? " + fondo " + customBg : "");
      console.log(`\n── ${tag}`);
      const e = await openEditor(browser, base, theme, customBg), page = e.page;
      const loaded = await page.evaluate(() => ({ skin: settings.skin, c1: nodeById(1).color, f2: nodeById(2).fill }));
      check(loaded.skin === "built" && loaded.c1 === "#6a9fb5cc" && loaded.f2 === "#ffffff80", `${tag}: el documento carga tal cual (el color no se reescribe)`);

      /* exportación SVG y raster construidos */
      const ex = await page.evaluate(() => { try { return { svg: buildSVGDocument(1, "built"), png: __t.raster() }; } catch (err) { return { err: err.message }; } });
      check(!ex.err && ex.svg.includes("skin-clip-3-0") && ex.png.startsWith("data:image/png"), `${tag}: SVG y raster construidos sin errores${ex.err ? " — " + ex.err : ""}`);
      const probes = await page.evaluate(PROBES);
      if (!ex.err) {
        const layerFills = await page.evaluate(() => { const bg = doc.customBg || THEMES[doc.theme].bg; return P().nodes.flatMap((n) => (skinNode(n, doc.theme, bg) || { layers: [] }).layers.map((l) => l.fill).filter(Boolean)); });
        check(layerFills.every((f) => ex.svg.includes(`fill="${f}"`)) && !/(fill|stroke)="#[0-9a-f]{8}" stroke-linejoin/i.test(ex.svg), `${tag}: el SVG lleva los ${layerFills.length} rellenos de las capas (compuestos, sin alfa en la piel)`);
        const f2 = hex6(expected(probes[1], theme, customBg));
        check(ex.svg.includes(`fill="${f2}"`), `${tag}: paridad SVG: el frente relleno con #ffffff80 es ${f2} (regla escrita)`);
      }

      /* Present en el editor */
      await page.keyboard.press("p"); await page.waitForFunction(() => presenting === true);
      await page.evaluate(() => { viewZoom = 1; viewX = 40; viewY = 40; }); await page.waitForTimeout(700); await page.evaluate(() => __t.frame());
      for (const pr of probes) { const want = expected(pr, theme, customBg), got = await page.evaluate((p) => __t.px(p), pr.p); check(near(got, want, 3), `${tag}: Present, ${pr.what}: ${got} ≈ ${want}`); }
      await page.evaluate(() => exitPresent()); await page.waitForFunction(() => presenting === false);
      check(e.errors.length === 0, `${tag}: editor + Present, 0 errores (${e.errors.slice(0, 2).join(" | ")})`);

      /* Viewer desde el share: vista normal y Present */
      const payload = await page.evaluate(async () => new URL(await createShareUrl(serializeProject(), location.href, { kind: "diagram" })).hash.slice(3));
      const v = await e.ctx.newPage(), verr = [];
      v.on("pageerror", (x) => verr.push(x.message));
      await v.goto(base + "/s/#d=" + payload);
      await v.waitForFunction(() => window.__viewer && /ready|error/.test(window.__viewer.phase));
      const phase = await v.evaluate(() => window.__viewer.phase);
      check(phase === "ready", `${tag}: el Viewer abre el share (fase «${phase}»)`);
      if (phase === "ready") {
        await v.evaluate(VIEWER_HELPERS); await v.evaluate(() => __v.frame());
        const vprobes = await v.evaluate(PROBES);
        for (const pr of vprobes) { const want = expected(pr, theme, customBg), got = await v.evaluate((p) => __v.px(p), pr.p); check(near(got, want, 3), `${tag}: Viewer, ${pr.what}: ${got} ≈ ${want}`); }
        await v.evaluate(() => enterPresent()); await v.waitForFunction(() => window.__viewer.presenting === true); await v.waitForTimeout(500); await v.evaluate(() => __v.frame());
        const got = await v.evaluate((p) => __v.px(p), vprobes[0].p);
        const want0 = expected(vprobes[0], theme, customBg);
        check(near(got, want0, 3), `${tag}: Viewer en Present, ${vprobes[0].what}: ${got} ≈ ${want0}`);
        await v.evaluate(() => exitPresent());
      }
      check(verr.length === 0, `${tag}: Viewer, 0 errores (${verr.slice(0, 2).join(" | ")})`);

      /* en plano, idéntico a 1ee65ee salvo el tinte del relleno, que FLUYO-019.5 corrige para #rgb/#rrggbbaa/ilegibles: al árbol
         de 1ee65ee se le aplica la regla del tinte escrita aquí (no la de geometry.js) y el resultado debe ser idéntico byte a byte */
      const o = await openEditor(browser, baseOld, theme, customBg);
      await o.page.evaluate(TINT_019_5);
      const a = await page.evaluate(() => ({ svg: buildSVGDocument(1), png: __t.rasterFlat() })), b = await o.page.evaluate(() => ({ svg: buildSVGDocument(1), png: __t.rasterFlat() }));
      check(a.svg === b.svg && a.png === b.png, `${tag}: en plano, SVG y raster idénticos a ${BEFORE} + el tinte de 019.5 (${b.svg.length} bytes)`);
      await o.ctx.close(); await e.ctx.close();
    }
  } finally {
    await browser.close(); server.close(); serverOld.close();
    fs.rmSync(old, { recursive: true, force: true });
  }
  console.log(`\nFLUYO-019.3 browser: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
