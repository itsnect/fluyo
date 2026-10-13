"use strict";
/* FLUYO-018.23 — Chrome REAL: el panel de Propiedades reorganizado. Mide con números los criterios de .ai/tasks/FLUYO-018.23.md.
   Casos (por viewport): sin selección · nodo · code · BD · conexión (puntas, puntos, flowDir) · colores automáticos y propios ·
   teclado en los segmentados · cambio + Undo · tamaños (ratón ≥ 28 y muestras ≥ 24; dedo ≥ 44 y muestras ≥ 32) · textos de los
   segmentados sin desbordar ni superponerse · Historia/Present sin panel. Más: plegado (1440, 1024), oscuro (1280) y el mismo DOM
   en la hoja móvil (390, solo regresión).
   Viewports: 1440×900, 1280×720, 1024×768 (ratón), 768×1024 (tableta, dedo), 390×844 (móvil, dedo).
   Uso: node test/fluyo-018-23-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; FLUYO_SHOTS=<dir>)
        ONLY=d1440|d1280|d1024|t768|m390   recorre solo ese viewport (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-23-"));
fs.mkdirSync(shots, { recursive: true });
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".woff2": "font/woff2" };
const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(path.resolve(dir) + path.sep));
      const body = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

/* canvas: % de lienzo antes de 018.23 (columna fija) — no puede bajar. screensCode: pantallas de un code con «Código» plegado. */
const VIEWPORTS = [
  { key: "d1440", width: 1440, height: 900, canvas: 66, fold: true, story: true },
  { key: "d1280", width: 1280, height: 720, canvas: 60, dark: true },
  { key: "d1024", width: 1024, height: 768, canvas: 61, fold: true },
  { key: "t768", width: 768, height: 1024, touch: true, canvas: 56, story: true },
  { key: "m390", width: 390, height: 844, touch: true, mobile: true },
];
const ONLY = process.env.ONLY || "";

async function open(browser, base, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", deviceScaleFactor: vp.mobile ? 2 : 1 });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof refreshPanel === "function" && typeof segSync === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  await page.evaluate(() => document.fonts.ready);
  await load(page);
  return { ctx, page, errors };
}
/* el fixture + un code y una BD (solo en memoria), con las pilas vacías */
const load = (page) => page.evaluate((fx) => {
  if (typeof scReset === "function") scReset();
  setUiMode("edit"); applyProjectData(JSON.parse(fx));
  const c = newNode("code", 520, 380, { label: "SELECT id, total\nFROM pagos\nWHERE estado = 'ok'" });
  const b = newNode("cylinder", 760, 380, { label: "Pagos" });
  window.__code = c.id; window.__db = b.id;
  fitView(); clearSel(); renderTabs(); undoStack.length = 0; redoStack.length = 0;
}, FIXTURE);
const shot = (t, vp, name) => t.page.screenshot({ path: path.join(shots, `${vp.key}-${name}.png`) });
const tapOrClick = async (t, vp, loc) => { await loc.scrollIntoViewIfNeeded().catch(() => {}); if (vp.touch) await loc.tap(); else await loc.click(); await t.page.waitForTimeout(120); };
const select = (t, vp, type, id) => t.page.evaluate(([type, id, sheet]) => { setUiMode("edit"); selectOnly(type, id); if (sheet) openSurface("properties"); }, [type, id, !!vp.mobile]);
const DOC = () => JSON.stringify(serializeProject().doc, (k, v) => (/^next[A-Z]/.test(k) ? undefined : v));

/* Medidas del panel (en la página). */
const PANEL = (touch) => {
  const aside = document.querySelector("aside"), ar = aside.getBoundingClientRect();
  const vis = (e) => !!e && e.checkVisibility && e.checkVisibility() && !e.closest(".srOnly") && e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height > 1;
  const scope = [...document.querySelectorAll("#propSheetHead, #panelProperties")];
  const all = scope.flatMap((s) => [...s.querySelectorAll("button, select, input, textarea, summary, .swatch, .boldTog")]).filter(vis);
  const bad = [];
  for (const e of all) {
    const r = e.getBoundingClientRect(), id = e.id || e.className || e.tagName;
    if (e.classList.contains("swatch")) { const g = e.parentElement.getBoundingClientRect(); if (r.bottom > g.bottom + 1) continue; if (Math.min(r.width, r.height) < (touch ? 32 : 24) - 0.5) bad.push("muestra " + Math.round(r.width) + "×" + Math.round(r.height)); continue; }
    if (e.matches(".boldTog input")) continue;                                   // el objetivo es su .boldTog
    let h = r.height, w = r.width;
    if (e.type === "checkbox") { const row = e.closest(".row"); const lb = row && row.querySelector("label[for='" + e.id + "']"); h = Math.max(h, lb ? lb.getBoundingClientRect().height : 0); w = Math.max(w, 40); }
    const min = e.classList.contains("swMore") && !touch ? 24 : touch ? 44 : 28;
    if (e.tagName === "TEXTAREA") continue;
    if (Math.min(h, e.classList.contains("segBtn") || e.type === "checkbox" ? h : w) < min - 0.5) bad.push(id + " " + Math.round(w) + "×" + Math.round(h));
  }
  /* segmentados: texto sin desbordar y opciones sin superponerse (P1) */
  const overlap = [];
  for (const seg of document.querySelectorAll("#panelProperties .seg")) {
    if (!vis(seg)) continue;
    const bs = [...seg.querySelectorAll(".segBtn")].filter(vis);
    for (const b of bs) if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) overlap.push(seg.id + ":" + b.textContent.trim() + " desborda");
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i].getBoundingClientRect(), c = bs[j].getBoundingClientRect();
      if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 0.5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5) overlap.push(seg.id + " se superpone");
    }
    /* el texto pintado de cada opción cabe dentro de su botón */
    for (const b of bs) { const rg = document.createRange(); rg.selectNodeContents(b); const tr = rg.getBoundingClientRect(), br = b.getBoundingClientRect(); if (tr.width && (tr.left < br.left - 0.5 || tr.right > br.right + 0.5)) overlap.push(seg.id + ":" + b.textContent.trim() + " fuera de su opción"); }
  }
  const groups = [...document.querySelectorAll("#selBody > details.pgroup")].filter((d) => !d.hidden).map((d) => d.id + (d.open ? "▾" : "▸"));
  const inFirst = (el) => { if (!vis(el)) return false; const r = el.getBoundingClientRect(); return r.top >= ar.top - 1 && r.bottom <= ar.top + aside.clientHeight + 1; };
  const colorRows = [...document.querySelectorAll("#panelProperties .colorRow")].filter(vis).map((r) => Math.round(r.getBoundingClientRect().height));
  return { screens: +(aside.scrollHeight / Math.max(1, aside.clientHeight)).toFixed(2), bad, overlap, groups, colorRows, inFirst: Object.fromEntries(["rowFill", "rowColor", "rowShape", "rowArrows", "rowFlow", "rowAnim", "grpCode", "btnDel"].map((id) => [id, inFirst(document.getElementById(id))])), width: Math.round(ar.width) };
};
const CANVAS = () => { let hit = 0, n = 0; const el = document.getElementById("cv"); for (let y = 4; y < innerHeight; y += 8) for (let x = 4; x < innerWidth; x += 8) { n++; if (document.elementFromPoint(x, y) === el) hit++; } return Math.round(hit / n * 100); };
const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };

async function runViewport(browser, base, vp) {
  console.log(`\n── ${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", dedo" : ", ratón"})`);
  const t = await open(browser, base, vp), page = t.page;
  const P = () => page.evaluate(PANEL, !!vp.touch);

  /* A — sin selección: la columna se queda (D2), solo habla de la selección (D3) */
  if (!vp.mobile) {
    const a = await page.evaluate(() => ({ aside: getComputedStyle(document.querySelector("aside")).display, noSel: getComputedStyle($("noSel")).display, title: $("selTitle").textContent, del: $("btnDel").hidden, z: $("rowZ").hidden, anim: !!document.querySelector("aside #grpAnim"), help: !!document.querySelector("aside #grpHelp") }));
    check(a.aside !== "none" && a.noSel === "block" && a.title === "Propiedades" && a.del && a.z, "sin selección: columna fija con «Nada seleccionado», sin acciones");
    check(!a.anim && !a.help, "sin selección: ni animación del lienzo ni ayuda en el panel (D3)");
    const pct = await page.evaluate(CANVAS);
    check(pct >= vp.canvas, `lienzo con panel ${pct} % ≥ ${vp.canvas} %`);
    await shot(t, vp, "A-nosel");
  }

  /* B — nodo */
  await select(t, vp, "node", 1); await page.waitForTimeout(200);
  let m = await P();
  const nodeOrder = await page.evaluate(() => [...document.querySelectorAll("#selBody > details.pgroup")].map((d) => d.id).join(","));
  check(m.groups.join(" ") === (vp.mobile ? "grpShape▸ grpText▸ grpLayers▸" : "grpShape▾ grpText▾ grpLayers▸"), "nodo: Apariencia y Texto abiertos, Movimiento plegado (" + m.groups.join(" ") + ")");
  if (!vp.mobile) {
    check(m.screens <= 1.0, `nodo: ${m.screens} pantallas ≤ 1,0`);
    check(m.inFirst.rowFill && m.inFirst.rowColor && m.inFirst.rowShape && m.inFirst.btnDel, "nodo: forma, borde, relleno y Eliminar en la primera pantalla");
    check(m.colorRows.every((h) => h <= (vp.touch ? 76 : 56)), "nodo: cada color es una fila (" + m.colorRows.join("/") + " px)");
  }
  check(m.bad.length === 0, `nodo: objetivos ${vp.touch ? "≥ 44 y muestras ≥ 32" : "≥ 28 y muestras ≥ 24"}` + (m.bad.length ? " — " + m.bad.slice(0, 5).join(", ") : ""));
  check(m.overlap.length === 0, "nodo: segmentados sin desbordar ni superponerse" + (m.overlap.length ? " — " + m.overlap.join(", ") : ""));
  await shot(t, vp, "B-node");
  if (vp.mobile) {
    /* D9: el mismo DOM y el mismo orden que en escritorio; la hoja abre como acordeón */
    const mob = await page.evaluate(() => ({ panels: document.querySelectorAll("#panelProperties").length, fills: document.querySelectorAll('[id="fillSw"]').length, closeVis: getComputedStyle(document.querySelector("#btnPanelClose .icClose")).display !== "none", foldVis: getComputedStyle(document.querySelector("#btnPanelClose .icFold")).display !== "none", sheet: document.body.classList.contains("panelOpen") }));
    check(mob.panels === 1 && mob.fills === 1 && mob.sheet, "móvil: el MISMO panel (un #panelProperties, un #fillSw) en la hoja");
    check(nodeOrder === "grpShape,grpText,grpCode,grpLayers,grpStroke,grpRoute,grpFlow", "móvil: mismos grupos y mismo orden que en escritorio (" + nodeOrder + ")");
    check(mob.closeVis && !mob.foldVis, "móvil: la cabecera de la selección lleva cerrar (no plegar)");
    await tapOrClick(t, vp, page.locator("#grpShape > summary"));
    m = await P();
    check(m.bad.length === 0 && m.overlap.length === 0, "móvil: Apariencia abierta con objetivos ≥ 44, muestras ≥ 32 y sin superposición" + (m.bad.length ? " — " + m.bad.slice(0, 4).join(", ") : "") + (m.overlap.length ? " — " + m.overlap.join(", ") : ""));
  } else {
    check(nodeOrder === "grpShape,grpText,grpCode,grpLayers,grpStroke,grpRoute,grpFlow", "nodo: orden de los grupos");
  }

  /* cambio de propiedad con un clic/toque real + Undo devuelve el documento idéntico */
  if (vp.mobile && !(await page.evaluate(() => $("grpShape").open))) await tapOrClick(t, vp, page.locator("#grpShape > summary"));
  const before = await page.evaluate(DOC), u0 = await page.evaluate(() => undoStack.length);
  await tapOrClick(t, vp, page.locator('#fillSw .swatch[data-v="#7fa66b"]'));
  const after = await page.evaluate(() => ({ fill: P().nodes.find((n) => n.id === 1).fill, undo: undoStack.length, sel: selN.has(1) }));
  check(after.fill === "#7fa66b" && after.undo === u0 + 1 && after.sel, "relleno con un toque/clic: fill = #7fa66b, una entrada de Undo, la selección sigue");
  await page.evaluate(() => undo()); await page.waitForTimeout(100);
  check((await page.evaluate(DOC)) === before, "Undo devuelve el documento idéntico");
  await select(t, vp, "node", 1); await page.waitForTimeout(120);   // Deshacer vacía la selección (selection.js, como siempre)
  if (vp.mobile && !(await page.evaluate(() => $("grpShape").open))) await tapOrClick(t, vp, page.locator("#grpShape > summary"));

  /* forma con el segmentado + teclado */
  await tapOrClick(t, vp, page.locator('#shapeSeg [data-v="diamond"]'));
  check(await page.evaluate(() => P().nodes.find((n) => n.id === 1).shape === "diamond" && $("shapeSel").value === "diamond" && $("shapeSeg").querySelector('[aria-checked="true"]').dataset.v === "diamond"), "forma con el segmentado: shape = diamond (vía #shapeSel)");
  await page.evaluate(() => undo()); await page.waitForTimeout(80);
  await select(t, vp, "node", 1); await page.waitForTimeout(100);

  /* colores automáticos y propios (P3, D4) */
  const wells = await page.evaluate(() => {
    const a = P().nodes.find((n) => n.id === 1), b = P().nodes.find((n) => n.id === 2);
    a.fill = "#123456"; delete b.fill; selectOnly("node", 1);
    const r1 = { v: $("fillCustom").value, auto: $("fillCustom").getAttribute("data-auto"), first: $("fillSw").querySelector(".swatch.sel"), cur: !!$("fillSw").querySelector(".swCurrent.sel") };
    selectOnly("node", 2);
    const r2 = { v: $("fillCustom").value, auto: $("fillCustom").getAttribute("data-auto"), cur: !!$("fillSw").querySelector(".swCurrent") };
    return { r1: { ...r1, first: !!r1.first && r1.first.classList.contains("swCurrent") }, r2 };
  });
  check(wells.r1.v === "#123456" && !wells.r1.auto && wells.r1.cur, "color propio: el pozo enseña #123456 y su muestra encabeza la fila");
  check(wells.r2.v !== "#123456" && wells.r2.auto === "auto" && !wells.r2.cur, "relleno automático: el pozo NO enseña el color anterior y lleva la marca de automático (P3)");
  if (vp.mobile && !(await page.evaluate(() => $("grpShape").open))) await tapOrClick(t, vp, page.locator("#grpShape > summary"));
  await tapOrClick(t, vp, page.locator("#rowFill .swMore"));
  const more = await page.evaluate(() => ({ open: $("rowFill").classList.contains("swOpen"), tools: getComputedStyle($("rowFill").querySelector(".colorTools")).display, sel: selN.has(2) && selN.size === 1, exp: $("fillSw").classList.contains("expanded") }));
  check(more.open && more.exp && more.tools !== "none" && more.sel, "«⋯» despliega la rejilla y «Personalizado» sin perder la selección");
  await page.evaluate(() => { selectOnly("node", 1); });
  check(await page.evaluate(() => !$("fillSw").classList.contains("expanded")), "otra selección: la paleta vuelve a su fila");
  await load(page);

  /* C — code: Código agrupa todo lo del bloque (D7) */
  await select(t, vp, "node", await page.evaluate(() => window.__code)); await page.waitForTimeout(150);
  m = await P();
  if (!vp.mobile) check(m.screens <= (vp.key === "d1024" ? 1.05 : 1.0) && m.inFirst.grpCode, `code: ${m.screens} pantallas con «Código» plegado y su rótulo a la vista`);
  if (!(await page.evaluate(() => $("grpCode").open))) await tapOrClick(t, vp, page.locator("#grpCode > summary"));
  const code = await page.evaluate(() => {
    const g = $("grpCode"), inG = (id) => g.contains($(id)) && $(id).checkVisibility();
    return { rows: ["rowLang", "rowTextColor", "rowTextBg", "rowKwColor", "rowKwBg"].filter((id) => !inG(id)), labels: [$("textColorLbl").textContent, $("textBgLbl").textContent, $("fillLbl").textContent, $("lblEditLbl").textContent], kwBg: $("kwBgSw").querySelector(".swatch.sel") && $("kwBgSw").querySelector(".swatch.sel").dataset.v, rows5: $("lblEdit").rows };
  });
  check(code.rows.length === 0, "code: resaltado, color del código, fondo del bloque, palabra clave y su caja dentro de «Código»" + (code.rows.length ? " — faltan " + code.rows.join(",") : ""));
  check(code.labels.join("|") === "Texto del código|Fondo del bloque|Panel|Código" && code.rows5 === 5, "code: etiquetas del bloque y el código en 5 líneas");
  check(code.kwBg === "__null__", "code: sin caja de palabra clave por defecto (018.14a)");
  await tapOrClick(t, vp, page.locator('#langSeg [data-v="custom"]'));
  check(await page.evaluate(() => $("rowKeywords").checkVisibility() && $("langSel").value === "custom"), "code: «Lista propia» abre su caja aunque la lista esté vacía");
  m = await P();
  check(m.bad.length === 0 && m.overlap.length === 0, "code: objetivos y segmentados correctos con «Código» abierto" + (m.bad.length ? " — " + m.bad.slice(0, 4).join(", ") : "") + (m.overlap.length ? " — " + m.overlap.join(", ") : ""));
  await shot(t, vp, "C-code");

  /* D — BD */
  await select(t, vp, "node", await page.evaluate(() => window.__db)); await page.waitForTimeout(120);
  check(await page.evaluate(() => $("shapeSeg").querySelector('[aria-checked="true"]').dataset.v === "cylinder" && $("shapeValue").textContent === "BD"), "BD: el segmentado marca BD");

  /* E — conexión: Trazo y Dirección abiertos; puntas; puntos; flowDir */
  await page.evaluate(() => { const e = P().edges[0]; e.animated = false; delete e.startArrow; delete e.endArrow; e.flowDir = "normal"; });
  await select(t, vp, "edge", await page.evaluate(() => P().edges[0].id)); await page.waitForTimeout(150);
  m = await P();
  const edgeOrder = await page.evaluate(() => [...document.querySelectorAll("#selBody > details.pgroup")].filter((d) => !d.hidden).map((d) => d.id).join(","));
  check(edgeOrder === "grpStroke,grpRoute,grpFlow,grpText", "conexión: Trazo · Dirección · Puntos · Texto (" + edgeOrder + ")");
  if (!vp.mobile) check(m.groups.join(" ") === "grpStroke▾ grpRoute▾ grpFlow▸ grpText▸", "conexión: Trazo y Dirección abiertos; Puntos y Texto plegados");
  else await tapOrClick(t, vp, page.locator("#grpRoute > summary"));
  const quiet = await page.evaluate(() => ({ note: $("flowNote").checkVisibility(), flow: $("rowFlow").checkVisibility(), arrows: $("arrowSeg").querySelector('[aria-checked="true"]').dataset.v }));
  check(quiet.note && !quiet.flow && quiet.arrows === "end", "puntos quietos: la nota explica el sentido; Puntas = Fin (endArrow ausente = true)");
  /* puntas: los cuatro valores, con los mismos dos campos */
  for (const [v, s, e] of [["start", true, false], ["both", true, true], ["none", false, false], ["end", false, true]]) {
    const u = await page.evaluate(() => undoStack.length);
    await tapOrClick(t, vp, page.locator(`#arrowSeg [data-v="${v}"]`));
    const r = await page.evaluate(() => { const ed = P().edges[0]; return { s: !!ed.startArrow, e: ed.endArrow !== false, keys: Object.keys(ed).filter((k) => /Arrow$/.test(k)), u: undoStack.length, chk: [$("arrSChk").checked, $("arrEChk").checked], seg: $("arrowSeg").querySelector('[aria-checked="true"]').dataset.v }; });
    check(r.s === s && r.e === e && r.u === u + 1 && r.chk[0] === s && r.chk[1] === e && r.seg === v, `puntas «${v}»: startArrow=${s}, endArrow=${e}, un Undo, nativos y segmentado de acuerdo`);
  }
  /* puntos en movimiento → Sentido a la vista, sin superponerse, con teclado */
  await tapOrClick(t, vp, page.locator('label[for="animChk"]'));
  m = await P();
  check(await page.evaluate(() => P().edges[0].animated === true && $("rowFlow").checkVisibility() && !$("flowNote").checkVisibility()), "puntos en movimiento: aparece «Sentido de los puntos»");
  if (!vp.mobile) check(m.inFirst.rowArrows && m.inFirst.rowFlow, "flowDir y puntas en la primera pantalla");
  if (!vp.mobile) check(m.screens <= (vp.key === "d1024" ? 1.05 : 1.0), `conexión con puntos: ${m.screens} pantallas`);
  check(m.overlap.length === 0, "Sentido y Puntas sin desbordar ni superponerse (P1)" + (m.overlap.length ? " — " + m.overlap.join(", ") : ""));
  check(m.bad.length === 0, `conexión: objetivos ${vp.touch ? "≥ 44" : "≥ 28"}` + (m.bad.length ? " — " + m.bad.slice(0, 5).join(", ") : ""));
  await page.evaluate(() => document.querySelector('#flowSeg [aria-checked="true"]').focus());
  const k0 = await page.evaluate(() => undoStack.length);
  await page.keyboard.press("ArrowRight");
  const k1 = await page.evaluate(() => ({ d: P().edges[0].flowDir, u: undoStack.length, f: document.activeElement.dataset.v }));
  await page.keyboard.press("End");
  const k2 = await page.evaluate(() => P().edges[0].flowDir);
  await page.keyboard.press("Home");
  const k3 = await page.evaluate(() => ({ d: P().edges[0].flowDir, f: document.activeElement.dataset.v }));
  check(k1.d === "reverse" && k1.u === k0 + 1 && k1.f === "reverse" && k2 === "alternate" && k3.d === "normal" && k3.f === "normal", "teclado: → «Hacia el origen» (un Undo), Fin «Ida y vuelta», Inicio «Hacia el destino» (P2)");
  await page.evaluate(() => document.querySelector('#arrowSeg [aria-checked="true"]').focus());
  await page.keyboard.press("ArrowLeft");
  check(await page.evaluate(() => P().edges[0].startArrow === true && P().edges[0].endArrow === false && document.activeElement.dataset.v === "start"), "teclado: ← en Puntas pasa de «Fin» a «Inicio» (Ninguna · Inicio · Fin · Ambas)");
  await shot(t, vp, "E-edge");

  /* oscuro (1280): oliva en lo activo, contraste */
  if (vp.dark) {
    await page.evaluate(() => setUiTheme("dark")); await page.waitForTimeout(300);
    const d = await page.evaluate(() => {
      const on = document.querySelector('#flowSeg [aria-checked="true"]'), seg = $("flowSeg"), panel = document.querySelector("aside");
      const active = getComputedStyle(document.documentElement).getPropertyValue("--active").trim();
      const probe = document.createElement("i"); probe.style.color = active; document.body.appendChild(probe); const activeRgb = getComputedStyle(probe).color; probe.remove();
      return { border: getComputedStyle(on).borderTopColor, activeRgb, bed: getComputedStyle(seg).backgroundColor, panel: getComputedStyle(panel).backgroundColor, label: getComputedStyle(document.querySelector("#panelProperties .row label")).color, ring: getComputedStyle(document.querySelector("#lineSw .swatch.sel")).boxShadow };
    });
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    check(d.border === d.activeRgb, "oscuro: la opción activa lleva el borde oliva del sistema (" + d.border + ")");
    check(ratio(d.border, d.bed) >= 3, "oscuro: activo ≥ 3:1 frente al lecho (" + ratio(d.border, d.bed).toFixed(1) + ")");
    check(ratio(d.label, d.panel) >= 4.5, "oscuro: etiquetas ≥ 4,5:1 (" + ratio(d.label, d.panel).toFixed(1) + ")");
    check(d.ring.includes(d.activeRgb), "oscuro: la muestra elegida lleva el anillo oliva");
    await shot(t, vp, "G-dark-edge");
    await page.evaluate(() => setUiTheme("light")); await page.waitForTimeout(300);   // los controles tienen transición de color
    const l = await page.evaluate(() => { const on = document.querySelector('#flowSeg [aria-checked="true"]'); return { border: getComputedStyle(on).borderTopColor, bed: getComputedStyle($("flowSeg")).backgroundColor }; });
    const rl = (() => { const x = lum(l.border), y = lum(l.bed); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); })();
    check(rl >= 3, "claro: activo ≥ 3:1 frente al lecho (" + rl.toFixed(1) + ")");
  }

  /* plegado (D2) */
  if (vp.fold) {
    await select(t, vp, "node", 1);
    await page.locator("#btnPanelClose").click(); await page.waitForTimeout(200);
    const f1 = await page.evaluate(() => ({ aside: getComputedStyle(document.querySelector("aside")).display, key: localStorage.getItem("fluyo.ui.props"), exp: $("btnPanel").getAttribute("aria-expanded"), doc: JSON.stringify(serializeProject()).includes("fluyo.ui.props") }));
    const pct = await page.evaluate(CANVAS);
    check(f1.aside === "none" && f1.key === "folded" && f1.exp === "false" && !f1.doc, "plegar: la columna se va, la preferencia se guarda en el navegador y no en el documento");
    check(pct >= 79, `plegado: lienzo ${pct} % ≥ 79 %`);
    await page.evaluate(() => { clearSel(); selectOnly("node", 2); });
    check(await page.evaluate(() => getComputedStyle(document.querySelector("aside")).display === "none"), "plegado: seleccionar no lo despliega (no es contextual)");
    await page.evaluate(() => setUiMode("story")); await page.waitForTimeout(120);
    check(await page.evaluate(() => getComputedStyle(document.querySelector("aside")).display !== "none" && $("panelScenarios").checkVisibility()), "plegado: Historias sigue teniendo su columna");
    await page.evaluate(() => setUiMode("edit"));
    await page.reload(); await page.waitForFunction(() => typeof refreshPanel === "function");
    check(await page.evaluate(() => document.documentElement.getAttribute("data-props") === "folded" && getComputedStyle(document.querySelector("aside")).display === "none"), "plegado: sobrevive a recargar (antes del primer pintado)");
    if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
    await page.locator("#btnPanel").click(); await page.waitForTimeout(150);
    check(await page.evaluate(() => getComputedStyle(document.querySelector("aside")).display !== "none" && localStorage.getItem("fluyo.ui.props") === null && $("btnPanel").getAttribute("aria-expanded") === "true"), "⚙ lo despliega y borra la preferencia");
    await load(page);
  }

  /* Historia, reproducción y Present: sin panel de Propiedades (no compite) */
  if (vp.story) {
    await select(t, vp, "node", 1);
    await page.evaluate(() => setUiMode("story")); await page.waitForTimeout(150);
    const tabs = [];
    for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); tabs.push(await page.evaluate(() => !!(document.activeElement && document.activeElement.closest("#panelProperties, #propSheetHead")))); }
    const s1 = await page.evaluate(() => ({ props: $("panelProperties").checkVisibility(), head: $("propSheetHead").checkVisibility(), btn: $("btnPanel").checkVisibility() }));
    check(!s1.props && !s1.head && !s1.btn && !tabs.some(Boolean), "Historia: ni Propiedades ni su cabecera ni ⚙; el tabulador no entra en ellos");
    await page.evaluate(() => scRun()); await page.waitForTimeout(400);
    check(await page.evaluate(() => !$("panelProperties").checkVisibility() && !$("propSheetHead").checkVisibility()), "reproduciendo: sin Propiedades");
    await page.evaluate(() => { scReset(); setUiMode("edit"); selectOnly("node", 1); enterPresent(); }); await page.waitForTimeout(300);
    check(await page.evaluate(() => !document.querySelector("aside").checkVisibility() && !$("propSheetHead").checkVisibility()), "Present: sin panel");
    await page.evaluate(() => exitPresent()); await page.waitForTimeout(150);
    check(await page.evaluate(() => $("panelProperties").checkVisibility() && $("propSheetHead").checkVisibility() && $("selTitle").textContent === (selN.size ? $("selTitle").textContent : "Propiedades")), "salir de Present: vuelve el panel (Present vacía la selección, como siempre)");
  }

  check(t.errors.length === 0, "0 errores de consola" + (t.errors.length ? ": " + t.errors.slice(0, 3).join(" | ") : ""));
  await t.ctx.close();
}

(async () => {
  const t0 = Date.now();
  const { server, base } = await serve(root);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS) if (!ONLY || ONLY.split(",").includes(vp.key)) await runViewport(browser, base, vp);
  } finally { await browser.close(); server.close(); }
  console.log(`\nFLUYO-018.23 Chrome: ${passed} ✔ · ${failed} ✘ · ${((Date.now() - t0) / 1000).toFixed(1)} s · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
