"use strict";
/* FLUYO-019-PRSKIN — «Construido» legible en la barra de Present, en Chrome real. Se sirven dos árboles: el de trabajo y la base
   d4fb06d (antes del arreglo).
   · Matriz: interfaz clara/oscura × lienzo oscuro/crema/claro × Plano/Construido × reposo/hover/foco por teclado, a 1440×900, y la
     interfaz × aspecto en reposo a 390×844 táctil. Contraste en PÍXELES (texto frente al fondo del botón; anillo de foco frente a la
     barra): texto ≥ 4,5:1 y foco ≥ 3:1 en todos los casos. La base reproduce el fallo (interfaz clara + Construido < 3:1).
   · Plano y la interfaz oscura: el botón sale píxel a píxel igual que en la base (mismas capturas).
   · Nada más cambia: estilos calculados de TODOS los elementos (color, fondo, borde, contorno, sombra, opacidad), en el editor y en
     Present, iguales a la base salvo #prSkin con interfaz clara y Construido. El anillo de foco del resto de botones de la barra
     (páginas, salir) es el de la base.
   · 0 errores de página.
   Uso: node test/fluyo-019-prskin-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "d4fb06d";
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); if (!file.startsWith(path.resolve(dir) + path.sep)) throw 0;
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
function treeAt(rev) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-prskin-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function open(browser, base, vp, ui, canvas) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, serviceWorkers: "block", deviceScaleFactor: 2, hasTouch: !!vp.touch, isMobile: !!vp.touch });
  await ctx.addInitScript((u) => { try { if (u === "dark") localStorage.setItem("fluyo.ui.theme", "dark"); else localStorage.removeItem("fluyo.ui.theme"); } catch {} }, ui);
  const page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/"); await page.waitForFunction(() => typeof enterPresent === "function" && typeof setDocumentSkin === "function");
  await page.evaluate((t) => { setThemeIn(doc, { theme: t, customBg: "" }); syncProjectControls(); }, canvas);
  return { ctx, page, errors };
}
/* estado del botón y medida en píxeles: fondo = franja interior superior (sin texto); texto = el píxel más alejado del fondo;
   foco = el píxel del anillo (2 px por fuera del borde, a media altura) frente a la barra */
async function measure(page, state) {
  await page.mouse.move(2, 2); await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  if (state === "hover") await page.hover("#prSkin");
  if (state === "focus") { await page.focus("#prExit"); await page.keyboard.press("Shift+Tab"); }
  await page.waitForTimeout(260);
  const r = await page.evaluate(() => { const b = document.getElementById("prSkin").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, fv: document.getElementById("prSkin").matches(":focus-visible"), op: getComputedStyle(document.getElementById("presentBar")).opacity }; });
  const shot = await page.screenshot({ clip: { x: r.x - 6, y: r.y - 6, width: r.w + 12, height: r.h + 12 } });
  const px = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, at = (x, y) => { const i = (y * c.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const bg = at(Math.round(c.width / 2), 30), dist = (p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);
    let ink = bg; for (let y = Math.round(c.height * 0.35); y < c.height * 0.65; y++) for (let x = Math.round(c.width * 0.25); x < c.width * 0.75; x++) { const p = at(x, y); if (dist(p) > dist(ink)) ink = p; }
    return { bg, ink, ring: at(4 * 2 - 3, Math.round(c.height / 2)), bar: at(1, Math.round(c.height / 2)), data: c.toDataURL() };
  }, shot.toString("base64"));
  return { ...px, fv: r.fv, op: +r.op, text: ratio(px.ink, px.bg), focus: ratio(px.ring, px.bar) };
}
const STYLE = () => [...document.querySelectorAll("*")].map((e, i) => { const c = getComputedStyle(e); return (e.id || e.tagName + "#" + i) + "|" + [c.color, c.backgroundColor, c.borderTopColor, c.outlineStyle, c.outlineColor, c.boxShadow, c.opacity].join(";"); });

(async () => {
  const t0 = Date.now();
  const base = treeAt(BASE);
  const now = await serve(root), old = await serve(base);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const errors = [];
  const DESK = { w: 1440, h: 900, tag: "1440" }, MOB = { w: 390, h: 844, touch: true, tag: "390" };
  try {
    const cases = [];
    for (const ui of ["light", "dark"]) for (const canvas of ["dark", "crema", "claro"]) for (const skin of ["flat", "built"]) for (const st of ["rest", "hover", "focus"]) cases.push({ vp: DESK, ui, canvas, skin, st });
    for (const ui of ["light", "dark"]) for (const skin of ["flat", "built"]) cases.push({ vp: MOB, ui, canvas: "crema", skin, st: "rest" });

    console.log("\n── Contraste en píxeles (árbol) y comparación con la base " + BASE);
    const pages = {};
    const get = async (srv, key, vp, ui, canvas) => { const k = srv.base + key; if (!pages[k]) { pages[k] = await open(browser, srv.base, vp, ui, canvas); await pages[k].page.evaluate(() => enterPresent()); await pages[k].page.waitForTimeout(300); } return pages[k]; };
    let worstText = 99, worstFocus = 99, baseBad = 0;
    for (const c of cases) {
      const key = [c.vp.tag, c.ui, c.canvas].join("-"), tag = `${key} ${c.skin} ${c.st}`;
      const a = await get(now, key, c.vp, c.ui, c.canvas), b = await get(old, key, c.vp, c.ui, c.canvas);
      await a.page.evaluate((k) => setDocumentSkin(k), c.skin); await b.page.evaluate((k) => setDocumentSkin(k), c.skin);
      const m = await measure(a.page, c.st), mb = await measure(b.page, c.st);
      worstText = Math.min(worstText, m.text);
      check(m.op === 1 && m.text >= 4.5, `${tag}: texto ${m.text.toFixed(2)}:1 (base ${mb.text.toFixed(2)}:1)`);
      if (c.st === "focus") { worstFocus = Math.min(worstFocus, m.focus); check(m.fv && m.focus >= 3, `${tag}: anillo de foco ${m.focus.toFixed(2)}:1 (base ${mb.focus.toFixed(2)}:1)`); }
      const fixed = c.ui === "light" && c.skin === "built";
      if (fixed) { if (mb.text < 3) baseBad++; }
      else if (c.ui === "light" && c.st === "focus")   /* Plano con foco, interfaz clara: solo cambia el anillo de #prSkin */
        check(m.ink.join() === mb.ink.join() && m.bg.join() === mb.bg.join(), `${tag}: mismo texto y fondo que la base (solo cambia el anillo)`);
      else check(m.data === mb.data, `${tag}: el botón sale idéntico a la base`);
    }
    check(baseBad === cases.filter((c) => c.ui === "light" && c.skin === "built").length, `la base reproduce el fallo: interfaz clara + Construido < 3:1 en los ${baseBad} casos`);
    for (const k in pages) errors.push(...pages[k].errors);
    for (const k in pages) await pages[k].ctx.close();
    console.log(`  (peor texto ${worstText.toFixed(2)}:1, peor foco ${worstFocus.toFixed(2)}:1)`);

    console.log("\n── Nada más cambia: estilos calculados de todos los elementos (editor y Present)");
    for (const ui of ["light", "dark"]) for (const skin of ["flat", "built"]) for (const pres of [false, true]) {
      const snaps = [];
      for (const srv of [now, old]) {
        const o = await open(browser, srv.base, DESK, ui, "dark");
        await o.page.evaluate(([k, p]) => { setDocumentSkin(k); if (p) enterPresent(); }, [skin, pres]); await o.page.waitForTimeout(300);
        snaps.push(await o.page.evaluate(STYLE)); errors.push(...o.errors); await o.ctx.close();
      }
      const diff = snaps[0].length === snaps[1].length ? snaps[0].filter((l, i) => l !== snaps[1][i]).map((l) => l.split("|")[0]) : ["(distinto número de elementos)"];
      const expect = ui === "light" && skin === "built" ? ["prSkin"] : [];
      check(JSON.stringify(diff) === JSON.stringify(expect), `${ui} ${skin} ${pres ? "Present" : "editor"}: cambian [${diff.join(", ")}] (se espera [${expect.join(", ")}])`);
    }

    console.log("\n── El anillo de foco del resto de la barra es el de la base");
    for (const ui of ["light", "dark"]) {
      const rings = [];
      for (const srv of [now, old]) {
        const o = await open(browser, srv.base, DESK, ui, "dark");
        /* tres páginas y la del medio: «anterior» y «siguiente» habilitados, además de «Salir» */
        await o.page.evaluate(() => { addPage(); addPage(); doc.cur = 1; renderTabs(); setDocumentSkin("built"); enterPresent(); }); await o.page.waitForTimeout(300);
        const ids = await o.page.evaluate(() => [...document.querySelectorAll("#presentBar button")].filter((b) => b.offsetParent && !b.disabled && b.id !== "prSkin").map((b) => b.id));
        const out = {};
        for (const id of ids) { await o.page.keyboard.press("Shift"); await o.page.evaluate((i) => document.getElementById(i).focus(), id); out[id] = await o.page.evaluate((i) => { const e = document.getElementById(i), c = getComputedStyle(e); return e.matches(":focus-visible") + " " + c.outlineStyle + " " + c.outlineColor; }, id); }
        rings.push(out); errors.push(...o.errors); await o.ctx.close();
      }
      check(Object.keys(rings[0]).length >= 3 && JSON.stringify(rings[0]) === JSON.stringify(rings[1]), `${ui}: ${Object.entries(rings[0]).map(([k, v]) => k + " → " + v).join(" · ")}`);
    }
    check(errors.length === 0, `0 errores de página (${errors.join(" | ")})`);
  } finally {
    await browser.close(); now.server.close(); old.server.close();
    fs.rmSync(base, { recursive: true, force: true });
  }
  console.log(`\n${passed} OK, ${failed} fallos (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
