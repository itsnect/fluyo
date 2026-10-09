"use strict";
/* FLUYO-018.13 — Chrome REAL: base visual.
   Comprueba propiedades OBSERVABLES de la nueva UI, no píxeles exactos ni medidas al px:
     · tipografías: Playfair Display e IBM Plex Mono cargadas desde este origen (cero peticiones de fuentes a terceros) y con
       los glifos del español;
     · tokens: las superficies principales pintan los valores de los tokens (se leen de las propias variables CSS, así que
       cambiar un token no rompe el test);
     · cabecera: una fila, sin desbordar, agrupada con filetes (no vuelve a la toolbar de 018.12); voces serif y mono;
     · iconos: controles migrados sin emoji y con su símbolo del sprite;
     · objetivos táctiles ≥ 40 px con dedo (pestañas ≥ 38 px), ≥ 28 px con ratón;
     · menú «Más», panel, páginas, barra táctil, controles de vista y Present funcionan y tienen sus estados;
     · lienzo enmarcado en escritorio y a sangre en móvil; selección pintada con la marca del sistema;
     · Service Worker: system.css y las fuentes quedan en caché y la UI las usa sin red;
     · responsive en 1440, 1280, 768, 390 y 375 (más 1024): sin scroll horizontal y con captura.
   Uso: node test/fluyo-018-13-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>)
        ONLY=d1440|d1280|t1024|t768|m390|m375|sw recorre solo esa parte (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-13-"));
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-cliente-kafka-comercio.fluyo.json"), "utf8");
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
const VIEWPORTS = [
  { key: "d1440", width: 1440, height: 900, touch: false, mobile: false },
  { key: "d1280", width: 1280, height: 800, touch: false, mobile: false },
  { key: "t1024", width: 1024, height: 768, touch: true, mobile: false },
  { key: "t768", width: 768, height: 1024, touch: true, mobile: false },
  { key: "m390", width: 390, height: 844, touch: true, mobile: true },
  { key: "m375", width: 375, height: 667, touch: true, mobile: true },
];

/* Tráfico externo: se registra y se sirve vacío. Solo gif.js (CDN declarado en la política) puede aparecer. */
async function open(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block" });
  const external = [], fontReqs = [];
  ctx.on("request", (r) => { if (/\.woff2?(\?|$)|fonts\./.test(r.url())) fontReqs.push(r.url()); });
  await ctx.route((u) => !u.href.startsWith(base), (r) => { external.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/javascript", body: "" }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof newNode === "function" && typeof renderTabs === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); clearSel(); renderTabs(); }, FIXTURE); await page.waitForTimeout(250);
  return { ctx, page, errors, external, fontReqs };
}
const shot = (t, vp, name) => t.page.screenshot({ path: path.join(shots, `${vp.key}-${name}.png`) });
const press = (t, sel, vp) => (vp.touch ? t.page.locator(sel).tap() : t.page.locator(sel).click());
const box = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel); if (!el) return null;
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  if (cs.display === "none" || cs.visibility === "hidden" || r.width === 0 || r.height === 0 || el.closest("[hidden]")) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right };
}, sel);
/* Color resuelto de un token: un elemento sonda pinta var(--token) y se lee su color computado. */
const token = (page, name, scope) => page.evaluate(([name, scope]) => {
  const p = document.createElement("i"); p.style.cssText = "position:absolute;width:1px;height:1px;background:var(" + name + ")";
  (scope ? document.querySelector(scope) : document.body).appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c;
}, [name, scope || null]);
const bg = (page, sel) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).backgroundColor, sel);
const fg = (page, sel) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).color, sel);
const fam = (page, sel) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).fontFamily, sel);
/* Controles visibles de una zona (el propio menú «Más» se excluye de la cabecera: es otra superficie). */
const controls = (page, sel, exclude) => page.evaluate(([sel, exclude]) => [...document.querySelectorAll(sel)].filter((e) => {
  if (exclude && e.closest(exclude)) return false;
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[hidden]");
}).map((e) => ({ id: e.id || e.className || e.tagName, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })), [sel, exclude || null]);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}\u{23E9}-\u{23FA}\u{FF0B}\u{FF0D}]/u;

async function journey(browser, base, vp) {
  console.log(`\n${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", táctil" : ", ratón"})`);
  const t = await open(browser, base, vp); const { page } = t;
  const mobile = vp.width <= 700, compact = vp.width <= 1100;

  /* ── Tipografías ── */
  const fonts = await page.evaluate(() => ({
    mono: document.fonts.check('12px "IBM Plex Mono"') && [...document.fonts].some((f) => f.family.replace(/"/g, "") === "IBM Plex Mono" && f.status === "loaded"),
    serif: [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Playfair Display" && f.status === "loaded"),
  }));
  check(fonts.mono && fonts.serif, "IBM Plex Mono y Playfair Display cargadas " + JSON.stringify(fonts));
  check(t.fontReqs.length > 0 && t.fontReqs.every((u) => u.startsWith(base + "/assets/fonts/")), "las fuentes salen de este origen (" + t.fontReqs.length + " peticiones, 0 de terceros)");
  check(t.external.every((u) => /cdnjs\.cloudflare\.com\/ajax\/libs\/gif\.js/.test(u)), "ningún tercero salvo gif.js " + JSON.stringify([...new Set(t.external)]));
  if (vp.key === "d1440") {
    /* Si un glifo falta en Plex Mono, cada pila cae a su genérica y los anchos difieren. */
    const glyphs = await page.evaluate(() => {
      const c = document.createElement("canvas").getContext("2d"), out = [];
      for (const ch of "ñÑáéíóúüÁÉÍÓÚ¿¡«»—…·") { c.font = '20px "IBM Plex Mono", serif'; const a = c.measureText(ch).width; c.font = '20px "IBM Plex Mono", cursive'; const b = c.measureText(ch).width; if (Math.abs(a - b) > 0.01) out.push(ch); }
      for (const ch of "ñáéíóú¿¡«»—") { c.font = '20px "Playfair Display", monospace'; const a = c.measureText(ch).width; c.font = '20px "Playfair Display", cursive'; const b = c.measureText(ch).width; if (Math.abs(a - b) > 0.01) out.push("serif:" + ch); }
      return out;
    });
    check(glyphs.length === 0, "las dos fuentes tienen los glifos del español " + JSON.stringify(glyphs));
  }

  /* ── Tokens en las superficies ── */
  const surface = await token(page, "--surface"), raised = await token(page, "--surface-raised"), attention = await token(page, "--attention");
  check(await bg(page, "body > header") === surface && await bg(page, "#bottomBar") === surface && await bg(page, "aside") === surface && await bg(page, ".rail") === surface,
    "cabecera, rail, panel y barra de páginas pintan --surface (" + surface + ")");
  /* FLUYO-018.14b (B5): la acción importante de la cabecera es Presentar; Exportar pasa a secundaria */
  if (!mobile) check(await bg(page, "body > header > #btnPresent") === await token(page, "--attention-fill") && await bg(page, "body > header > #btnExport") !== attention, "Presentar (acción importante) pinta el terracota; Exportar no");
  check(surface !== "rgb(17, 18, 19)" && surface !== "rgb(27, 29, 31)", "el chrome ya no es el gris oscuro de 018.12");
  check(/Playfair Display/.test(await fam(page, "body > header .logo")) && /IBM Plex Mono/.test(await fam(page, "#btnShare")) && /IBM Plex Mono/.test(await fam(page, "body")),
    "voces: marca en serif, controles y cuerpo en mono");

  /* ── Cabecera ── */
  const hdr = await page.evaluate(() => {
    const h = document.querySelector("body > header"), r = h.getBoundingClientRect();
    const vis = [...h.querySelectorAll(":scope > *, :scope > .hdrTools > *")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden"; });
    const mids = vis.filter((e) => !e.classList.contains("hdrDiv")).map((e) => { const b = e.getBoundingClientRect(); return b.top + b.height / 2; });
    return { h: r.height, overflow: h.scrollWidth - h.clientWidth, spread: Math.max(...mids) - Math.min(...mids), dividers: vis.filter((e) => e.classList.contains("hdrDiv")).length,
      kickersHidden: [...h.querySelectorAll(":scope > .hdrTools > .hdrKicker")].every((k) => !k.getBoundingClientRect().width) };
  });
  check(hdr.h <= 56 && hdr.overflow <= 0 && hdr.spread <= 6, `cabecera en una sola fila sin desbordar (alto ${Math.round(hdr.h)} px, dispersión vertical ${Math.round(hdr.spread)} px)`);
  if (!compact) check(hdr.dividers >= 3 && hdr.kickersHidden, `escritorio: grupos separados por filetes (${hdr.dividers}), rótulos de sección solo en el menú`);
  else if (!mobile) check(hdr.dividers >= 1, `compacta: marca e historial separados por filete (${hdr.dividers})`);
  check(!(await box(page, "body > header #btnPlay")), "la cabecera sigue sin reproducción (018.12)");
  const hctl = await controls(page, "body > header button, body > header select, body > header .hdrOpt", "#moreMenu");
  const minH = vp.touch ? 40 : 28;
  check(hctl.length >= (mobile ? 5 : 6) && hctl.every((c) => c.h >= minH && c.w >= minH), `controles de cabecera ≥ ${minH} px ` + JSON.stringify(hctl.filter((c) => c.h < minH || c.w < minH)));

  /* ── Iconos ── */
  const icons = await page.evaluate((re) => {
    const EM = new RegExp(re, "u"), bad = [];
    for (const id of ["btnJsonOut", "btnJsonIn", "btnExport", "btnPresent", "btnShare", "btnEyedrop", "btnFront", "btnBack", "btnForward", "btnBackward", "btnPlay", "btnDel", "tbConnect", "tbMulti", "tbDone", "tbCancel", "btnUndo", "btnRedo", "btnMore", "btnPanel"]) {
      const b = document.getElementById(id), u = b && b.querySelector("svg use");
      if (!b || EM.test(b.textContent) || !u || !document.querySelector(u.getAttribute("href"))) bad.push(id);
    }
    const dangling = [...document.querySelectorAll("use")].filter((u) => !document.querySelector(u.getAttribute("href"))).length;
    return { bad, dangling };
  }, EMOJI.source);
  check(icons.bad.length === 0 && icons.dangling === 0, "controles migrados: sin emoji y con su símbolo del sprite " + JSON.stringify(icons));

  /* ── Lienzo: marco y fondo del documento ── */
  const frame = await page.evaluate(() => { const w = document.getElementById("wrap"), cs = getComputedStyle(w), c = cv.getBoundingClientRect(), s = document.querySelector(".stage").getBoundingClientRect();
    return { radius: parseFloat(cs.borderTopLeftRadius), shadow: cs.boxShadow, inset: c.top - s.top, theme: doc.theme }; });
  if (!mobile) check(frame.radius > 0 && frame.shadow !== "none" && frame.inset > 0, `escritorio/tableta: el lienzo es una superficie enmarcada (radio ${frame.radius}, aire ${Math.round(frame.inset)} px)`);
  else check(frame.radius === 0 && frame.inset === 0, "móvil: el lienzo va a sangre (cada píxel es lienzo)");
  check(frame.theme === "dark", "el tema del documento no cambia (sigue «dark»)");

  /* ── Panel ── */
  const sel = await page.evaluate(() => { const n = P().nodes.find((x) => x.shape === "rect"); clearSel(); selN.add(n.id); refreshPanel(); return n.id; });
  if (mobile) { await press(t, "#btnPanel", vp); await page.waitForTimeout(350); }
  const meta = await page.evaluate(() => { const m = document.getElementById("selMeta"); return m.hidden ? "" : m.textContent; });
  check(meta === "Caja · id " + sel, `el panel nombra la selección como metadato («${meta}»)`);
  check(/Playfair Display/.test(await fam(page, "#panelProperties h3")), "títulos de sección en serif");
  /* 018.14b: los grupos son <details class="pgroup"> con su rótulo en <summary> */
  const groups = await page.evaluate(() => [...document.querySelectorAll("#selBody > details.pgroup")].filter((d) => !d.hidden && d.offsetParent).map((d) => d.querySelector("summary").textContent.trim()));
  check(groups.includes("Forma y color") && groups.includes("Capas y aparición"), "los grupos del nodo tienen rótulo y filete " + JSON.stringify(groups));
  const sw = await page.evaluate(() => { const c = document.getElementById("boldChk"), cs = getComputedStyle(c), r = c.getBoundingClientRect(); return { app: cs.appearance, w: r.width, h: r.height }; });
  check(sw.app === "none" && sw.w > sw.h, "las casillas del panel son interruptores " + JSON.stringify(sw));
  /* 018.14b: en la hoja móvil los grupos empiezan plegados; se abre «Texto» con el dedo, como haría quien edita */
  if (mobile) { await page.locator("#grpText > summary").tap(); await page.waitForTimeout(150); }
  if (vp.touch) await page.locator("#boldChk").tap(); else await page.locator("#boldChk").click();
  check(await page.evaluate((id) => P().nodes.find((n) => n.id === id).bold === true, sel), "el interruptor «Negrita» cambia el documento");
  const tgt = await controls(page, "#panelProperties button, #panelProperties select, #panelProperties input[type=number], .panelTabs button");
  check(tgt.every((c) => c.h >= minH), `controles del panel ≥ ${minH} px ` + JSON.stringify(tgt.filter((c) => c.h < minH)));
  await shot(t, vp, "1-panel-nodo");
  const edge = await page.evaluate(() => { const e = P().edges[0]; clearSel(); selE.add(e.id); refreshPanel(); return [e.from, e.to]; });
  const meta2 = await page.evaluate(() => document.getElementById("selMeta").textContent);
  const egroups = await page.evaluate(() => [...document.querySelectorAll("#selBody > details.pgroup")].filter((d) => !d.hidden && d.offsetParent).map((d) => d.querySelector("summary").textContent.trim()));
  check(meta2 === `Conexión · ${edge[0]} → ${edge[1]}` && egroups.includes("Recorrido") && egroups.includes("Trazo"), `conexión: metadato y grupos propios («${meta2}», ${JSON.stringify(egroups)})`);
  if (mobile) {
    await press(t, "#btnPanelClose", vp); await page.waitForTimeout(350);
    check(!(await page.evaluate(() => document.body.classList.contains("panelOpen"))), "móvil: la hoja se cierra con su botón");
  }
  await page.evaluate(() => { clearSel(); });

  /* ── Selección en el lienzo: la marca del sistema, no el azul ── */
  if (vp.key === "d1440") {
    const px = await page.evaluate(async (id) => {
      const n = P().nodes.find((x) => x.id === id); selN.add(n.id); refreshPanel();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const c = cv.getContext("2d"), d = cv.fluyoDpr || 1, out = [];
      const y = viewY + (n.y - n.h / 2 - 6) * viewZoom;
      for (let k = -2; k <= 2; k++) for (const fx of [0.3, 0.5, 0.7]) { const x = viewX + (n.x - n.w / 2 + n.w * fx) * viewZoom; out.push([...c.getImageData(Math.round(x * d), Math.round((y + k * 0.5) * d), 1, 1).data].slice(0, 3)); }
      clearSel(); return out;
    }, sel);
    const near = (p, q, tol) => p.every((v, i) => Math.abs(v - q[i]) <= tol);
    check(px.some((p) => near(p, [195, 205, 164], 40)) && !px.some((p) => near(p, [58, 167, 232], 30)), "la selección se pinta en oliva pálido sobre el lienzo oscuro (sin azul)");
  }

  /* ── Menú «Más» ── */
  await press(t, "#btnMore", vp); await page.waitForTimeout(200);
  const menu = await page.evaluate(() => {
    const m = document.getElementById("moreMenu"), r = m.getBoundingClientRect();
    const kick = [...m.querySelectorAll(".menuKicker")].filter((k) => k.getBoundingClientRect().height > 0).map((k) => k.textContent);
    const doc = [...m.querySelectorAll("#btnDemo,#btnJsonIn,#btnJsonOut,#btnExport,#btnClear")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => [e.id, e.getBoundingClientRect().top]);
    return { visible: !m.hidden && r.width > 0, inView: r.right <= innerWidth + 0.5 && r.left >= -0.5, kick, order: doc.sort((a, b) => a[1] - b[1]).map((d) => d[0]) };
  });
  check(menu.visible && menu.inView, "«Más» se abre dentro de la pantalla");
  /* 018.14b: Archivo e Interfaz en todas las anchuras; en móvil también la sección Lienzo */
  check(menu.kick.includes("Fluyo") && menu.kick.includes("Archivo") && menu.kick.some((k) => /^Interfaz/.test(k)) && (!mobile || menu.kick.some((k) => /^Lienzo/.test(k))), "«Más» por secciones con rótulo " + JSON.stringify(menu.kick));
  check(menu.order[menu.order.length - 1] === "btnClear", "lo destructivo va último en Archivo " + JSON.stringify(menu.order));
  check(await fg(page, "#moreMenu #btnClear") === attention, "«Limpiar página» se distingue en terracota");
  if (mobile) check(menu.order.includes("btnExport"), "móvil: Exportar está en «Más»");
  check(await bg(page, "#moreMenu") === raised, "«Más» usa la superficie de menú (--surface-raised)");
  const mItems = await controls(page, "#moreMenu .menuItem, #moreMenu .moreTools button:not(#btnBgClear), #moreMenu .moreTools .hdrOpt");
  check(mItems.length >= 6 && mItems.every((c) => c.h >= (vp.touch ? 40 : 32)), `ítems del menú con objetivo cómodo (≥ ${vp.touch ? 40 : 32} px)`);
  await shot(t, vp, "2-menu-mas");
  /* 018.14b: la cuadrícula es del documento: en móvil está en «Más», más ancho en «Lienzo ▾» */
  if (!mobile) { await page.keyboard.press("Escape"); await page.waitForTimeout(120); check(!(await box(page, "#moreMenu")), "Escape cierra «Más»"); await press(t, "#btnCanvas", vp); await page.waitForTimeout(150); }
  const gridMenu = mobile ? "#moreMenu" : "#canvasMenu";
  const g0 = await page.evaluate(() => settings.grid);
  await press(t, gridMenu + " #lblGrid", vp); await page.waitForTimeout(120);
  check(await page.evaluate(([g0, m]) => settings.grid === !g0 && !document.querySelector(m).hidden, [g0, gridMenu]), "el interruptor «Cuadrícula» cambia el ajuste y no cierra el menú");
  await press(t, gridMenu + " #lblGrid", vp); await page.waitForTimeout(120);
  await page.keyboard.press("Escape"); await page.waitForTimeout(120);
  check(!(await box(page, gridMenu)), "Escape cierra el menú");

  /* ── Páginas ── */
  await press(t, "#pagesBar > .pgAdd", vp); await page.waitForTimeout(150);
  const tabs = await page.evaluate(() => [...document.querySelectorAll("#pagesBar .tab")].map((tb) => ({
    idx: getComputedStyle(tb, "::before").content, idxFont: getComputedStyle(tb, "::before").fontFamily, active: tb.classList.contains("active"), bg: getComputedStyle(tb).backgroundColor,
    name: getComputedStyle(tb.querySelector("span")).fontFamily, h: tb.getBoundingClientRect().height, x: !!tb.querySelector(".x") && getComputedStyle(tb.querySelector(".x"), "::before").content !== "none" })));
  check(tabs.length === 2 && tabs[1].active && tabs.every((x) => /counter\(pg, decimal-leading-zero\)/.test(x.idx) && /IBM Plex Mono/.test(x.idxFont)), "«＋» crea y activa la página; las pestañas llevan índice mono (01, 02…)");
  check(tabs[0].bg !== tabs[1].bg && tabs.every((x) => /Playfair Display/.test(x.name)), "la activa se distingue y los nombres van en serif");
  check(tabs.every((x) => x.x), "la ✕ se dibuja con el trazo del sistema (el glifo queda solo como texto)");
  check(tabs.every((x) => x.h >= (vp.touch ? 38 : 28)), `pestañas ≥ ${vp.touch ? 38 : 28} px`);
  if (vp.touch) {
    await page.locator("#pagesBar .tab.active .pgMore").tap(); await page.waitForTimeout(150);
    check(!!(await box(page, "#pageMenu")) && await bg(page, "#pageMenu") === raised, "el menú de la página se abre con la superficie de menú");
    await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  }
  await page.evaluate(() => { doc.cur = 0; clearSel(); renderTabs(); });

  /* ── Vista del lienzo ── */
  if (!mobile) {
    const before = await page.evaluate(() => ({ z: viewZoom, doc: JSON.stringify(P()), undo: undoStack.length }));
    await press(t, "#zoomIn", vp); await page.waitForTimeout(80);
    const a = await page.evaluate(() => ({ z: viewZoom, txt: document.getElementById("zoomPct").textContent }));
    check(Math.abs(a.z - Math.min(5, before.z * 1.1)) < 1e-9 && a.txt === Math.round(a.z * 100) + "%", `«＋» acerca un paso y la lectura lo dice (${a.txt})`);
    await press(t, "#zoomPct", vp); await page.waitForTimeout(80);
    check(await page.evaluate(() => viewZoom === 1), "«100%» vuelve a escala real");
    await press(t, "#zoomFit", vp); await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({ doc: JSON.stringify(P()), undo: undoStack.length }));
    check(after.doc === before.doc && after.undo === before.undo, "los controles de vista no tocan el documento ni Deshacer");
  } else check(!(await box(page, "#viewCtl")), "móvil: sin controles de zoom (pellizco)");

  /* ── Barra táctil ── */
  if (vp.touch) {
    /* toque real sobre el nodo: la barra depende del último puntero (isTouch) */
    const at = await page.evaluate(() => { const n = P().nodes[0], r = cv.getBoundingClientRect(); return { x: r.left + viewX + n.x * viewZoom, y: r.top + viewY + n.y * viewZoom }; });
    await page.touchscreen.tap(at.x, at.y); await page.waitForTimeout(400);
    const tb = await controls(page, "#touchBar button");
    check(tb.length >= 2 && tb.every((c) => c.h >= 40), "barra táctil visible con selección y botones ≥ 40 px " + JSON.stringify(tb));
    check(await bg(page, "#touchBar") === raised, "la barra táctil es una pieza levantada (--surface-raised)");
    await shot(t, vp, "3-barra-tactil");
    await page.evaluate(() => clearSel());
  }

  /* ── Responsive: sin scroll horizontal ── */
  const scroll = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth }));
  check(scroll.doc <= 0 && scroll.body <= 0, "sin scroll horizontal de página " + JSON.stringify(scroll));
  await shot(t, vp, "0-base");

  /* ── Historias: la superficie usa el sistema (sin rediseño) ── */
  if (mobile) await press(t, "#btnStories", vp); else await press(t, "#tabScenarios", vp);
  await page.waitForTimeout(350);
  check(/Playfair Display/.test(await fam(page, "#scScenarioTitle")) && await page.evaluate(() => getComputedStyle(document.getElementById("scScenarioTitle")).textAlign) === "left", "Historias: el nombre de la historia en serif y alineado a la izquierda");
  await shot(t, vp, "4-historias");
  if (mobile) await press(t, "#btnStories", vp); else await press(t, "#tabProperties", vp);

  /* ── Present: el mando usa el material inverso y se lee ── */
  if (vp.key === "d1440" || vp.key === "m390") {
    await page.evaluate(() => enterPresent()); await page.waitForTimeout(300);
    const ink = await token(page, "--ink", "#presentBar");
    const pr = await page.evaluate(() => ({ c: getComputedStyle(document.getElementById("prPos")).color, b: getComputedStyle(document.getElementById("prExit")).color, hdr: getComputedStyle(document.querySelector("body > header")).display }));
    pr.inv = ink === pr.b;
    const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
    check(pr.inv && lum(pr.c) > 0.55 && pr.hdr === "none", "Present: mando en material inverso con texto claro; sin chrome " + JSON.stringify(pr));
    await shot(t, vp, "5-present");
    await page.evaluate(() => exitPresent()); await page.waitForTimeout(200);
  }

  check(t.errors.length === 0, "0 errores de consola/página " + JSON.stringify(t.errors));
  await t.ctx.close();
}

/* El Service Worker instala system.css y las fuentes; sin red, la UI sigue con sus tipografías. */
async function serviceWorker(browser, base) {
  console.log("\nService Worker: precache del sistema visual");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  await page.goto(base + "/"); await page.waitForFunction(() => typeof renderTabs === "function");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cache = await page.evaluate(async () => {
    const keys = await caches.keys(), c = await caches.open(keys[0]);
    const want = ["css/system.css", "assets/fonts/ibm-plex-mono-latin-400.woff2", "assets/fonts/ibm-plex-mono-latin-500.woff2", "assets/fonts/playfair-display-latin-400.woff2"];
    const have = []; for (const w of want) if (await c.match(location.origin + "/" + w)) have.push(w);
    return { keys, have, want: want.length };
  });
  check(cache.keys.length === 1 && cache.keys[0] === "fluyo-static-v75", "caché instalada: fluyo-static-v75 " + JSON.stringify(cache.keys));
  check(cache.have.length === cache.want, "system.css y las tres fuentes están precacheadas " + JSON.stringify(cache.have));
  await ctx.setOffline(true);
  await page.reload(); await page.waitForFunction(() => typeof renderTabs === "function"); await page.evaluate(() => document.fonts.ready);
  const off = await page.evaluate(() => ({ mono: [...document.fonts].some((f) => f.family.replace(/"/g, "") === "IBM Plex Mono" && f.status === "loaded"), sys: getComputedStyle(document.querySelector("body > header")).backgroundColor }));
  check(off.mono && off.sys !== "rgba(0, 0, 0, 0)", "sin red: la UI carga el sistema y la mono desde la caché " + JSON.stringify(off));
  await ctx.close();
}

(async () => {
  const wt = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS) if (!process.env.ONLY || process.env.ONLY === vp.key) await journey(browser, wt.base, vp);
    if (!process.env.ONLY || process.env.ONLY === "sw") await serviceWorker(browser, wt.base);
  } catch (e) { failed++; console.log("  ✘ excepción: " + (e && e.stack || e)); }
  finally { await browser.close(); wt.server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})();
