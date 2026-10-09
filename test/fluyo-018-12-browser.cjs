"use strict";
/* FLUYO-018.12 — Chrome REAL: base táctil y móvil.
   Recorre en 390×844, 375×667 y 768×1024 (táctil emulado: hasTouch + eventos táctiles CDP) y en 1280×800 y 1440×900 (ratón):
     1 abrir/cerrar propiedades · 2 seleccionar · 3 mover · 4 zoom/pan · 5 selección múltiple · 6 conectar · 7 cancelar conexión ·
     8 cambiar página · 9 crear página · 10 renombrar página · 11 Undo · 12 Redo · 13 abrir Historias · 14 iniciar/detener Playback ·
     15 volver al canvas · 16 Ejemplo sin destruir el documento.
   Cada flujo comprueba el estado del documento y del DOM, guarda captura y exige 0 errores de consola/página.
   Escritorio: la misma secuencia de edición con ratón y teclado en HEAD y en el árbol de trabajo → documentos idénticos (la
   interacción de escritorio no cambia). Móvil: HEAD se recorre también para DOCUMENTAR las diferencias intencionales
   (cajón que tapa a ⚙, sin Deshacer, sin renombrar con el dedo, Ejemplo que vacía la página).
   DPR: a densidad 2 el respaldo del lienzo mide el doble, el dibujo cae donde dicen las coordenadas y tocar/arrastrar/editar
   apuntan al nodo correcto (editor y Viewer).
   Uso: node test/fluyo-018-12-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>)
        ONLY=m390|m375|t768|d1280|d1440 recorre solo ese viewport; ONLY=cmp solo las comparaciones con HEAD (lo usan las mutaciones). */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-12-"));
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-cliente-kafka-comercio.fluyo.json"), "utf8");
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif" };

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
/* HEAD servido aparte, como en 018.7c: los archivos de la app tal como están en el último commit. */
function headTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-"));
  const files = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8" }).split("\n").filter((f) => /^(index\.html|js\/|css\/|s\/|assets\/|manifest\.webmanifest)/.test(f));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), execFileSync("git", ["-C", root, "show", "HEAD:" + f], { maxBuffer: 64 * 1024 * 1024 }));
  }
  return dir;
}

let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const VIEWPORTS = [
  { key: "m390", width: 390, height: 844, touch: true, mobile: true },
  { key: "m375", width: 375, height: 667, touch: true, mobile: true },
  { key: "t768", width: 768, height: 1024, touch: true, mobile: false },
  { key: "d1280", width: 1280, height: 800, touch: false, mobile: false },
  { key: "d1440", width: 1440, height: 900, touch: false, mobile: false },
];

/* Contexto con tráfico externo servido vacío (gif.js de la CDN): sin red y sin errores de consola por recursos bloqueados. */
async function open(browser, base, vp, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.mobile, serviceWorkers: "block", ...extra });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  page.on("pageerror", (e) => errors.push(vp.key + " pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(vp.key + " console: " + m.text()); });
  page.on("dialog", async (d) => { dialogs.push({ type: d.type(), message: d.message() }); if (d.type() === "prompt") await d.accept("Arquitectura"); else await d.accept(); });
  await page.goto(base + "/"); await page.waitForFunction(() => typeof newNode === "function" && typeof renderTabs === "function");
  if (await page.locator("#autosaveModal").isVisible().catch(() => false)) await page.locator("#autosaveDiscard").click();
  /* state.js encaja la vista con un setTimeout(centerView,100) al cargar: hay que dejarlo pasar o pisaría la vista del SETUP. */
  await page.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors, dialogs };
}

/* Tres nodos y nada más; vista fija para que las coordenadas no dependan del encaje. Pilas vacías. */
const SETUP = ({ zoom }) => {
  const A = newNode("rect", 120, 100); A.label = "Origen";
  const B = newNode("rect", 420, 100); B.label = "Destino";
  const C = newNode("rect", 120, 300); C.label = "Base";
  viewZoom = zoom; viewX = 40; viewY = 40;
  clearSel(); renderTabs(); undoStack.length = 0; redoStack.length = 0;
  return { A: A.id, B: B.id, C: C.id };
};
const stateOf = (page) => page.evaluate(() => ({
  nodes: P().nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)]), edges: P().edges.map((e) => [e.id, e.from, e.to]),
  selN: [...selN].sort(), selE: [...selE].sort(), pages: doc.pages.map((p) => p.name), cur: doc.cur,
  undo: undoStack.length, redo: redoStack.length, view: [Math.round(viewX), Math.round(viewY), +viewZoom.toFixed(3)],
  modes: typeof touchModes === "function" ? touchModes() : null, panelOpen: document.body.classList.contains("panelOpen"),
}));
const nodeAt = (page, id) => page.evaluate((id) => {
  const n = P().nodes.find((x) => x.id === id), r = cv.getBoundingClientRect();
  return { x: r.left + viewX + n.x * viewZoom, y: r.top + viewY + n.y * viewZoom, w: n.w * viewZoom, h: n.h * viewZoom };
}, id);
const T = (cdp, type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
async function tap(t, x, y) { await T(t.cdp, "touchStart", [{ x, y }]); await T(t.cdp, "touchEnd", []); await t.page.waitForTimeout(380); }
async function touchDrag(t, x0, y0, x1, y1, steps = 10) {
  await T(t.cdp, "touchStart", [{ x: x0, y: y0 }]);
  for (let i = 1; i <= steps; i++) { await T(t.cdp, "touchMove", [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }]); await t.page.waitForTimeout(12); }
  await T(t.cdp, "touchEnd", []); await t.page.waitForTimeout(250);
}
async function pinch(t, cx, cy, d0, d1) {
  await T(t.cdp, "touchStart", [{ x: cx - d0 / 2, y: cy }, { x: cx + d0 / 2, y: cy }]);
  for (let i = 1; i <= 10; i++) { const d = d0 + (d1 - d0) * i / 10; await T(t.cdp, "touchMove", [{ x: cx - d / 2, y: cy }, { x: cx + d / 2, y: cy }]); await t.page.waitForTimeout(12); }
  await T(t.cdp, "touchEnd", []); await t.page.waitForTimeout(250);
}
/* Un control del DOM: con dedo, tap real; con ratón, clic. */
const press = (t, sel, vp) => (vp.touch ? t.page.locator(sel).tap() : t.page.locator(sel).click());
const shot = (t, vp, name) => t.page.screenshot({ path: path.join(shots, `${vp.key}-${name}.png`) });
const visibleBox = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel); if (!el) return null;
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  if (cs.display === "none" || cs.visibility === "hidden" || r.width === 0 || r.height === 0 || el.closest("[hidden]")) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right };
}, sel);
/* ¿Qué hay encima del centro de un control? Si es él (o un hijo), nada lo tapa. */
const onTop = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel), r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!top && (top === el || el.contains(top));
}, sel);

/* ¿Se ve, por encima de la hoja abierta, la selección («selection») o el diagrama entero («page»)? En px CSS de la pantalla. */
const aboveSheet = (page, what) => page.evaluate((what) => {
  const cr = cv.getBoundingClientRect(), sheetTop = document.querySelector("aside").getBoundingClientRect().top;
  const b = what === "page" ? getBounds() : (() => { const n = nodeById([...selN][0]); return { x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h }; })();
  const top = cr.top + viewY + b.y * viewZoom, bot = top + b.h * viewZoom;
  return { ok: top >= cr.top - 1 && bot <= sheetTop + 1, top: Math.round(top), bot: Math.round(bot), sheetTop: Math.round(sheetTop) };
}, what);

/* ═════════ Recorrido completo de un viewport (árbol de trabajo) ═════════ */
async function journey(browser, base, vp) {
  console.log(`\n${vp.key} (${vp.width}×${vp.height}${vp.touch ? ", táctil" : ", ratón"})`);
  const t = await open(browser, base, vp); const { page } = t;
  const ids = await page.evaluate(SETUP, { zoom: vp.mobile ? 0.55 : 0.8 });
  await page.waitForTimeout(200);

  /* Cabecera: una fila en 375/390/768 y 1440 (1280 sigue en dos, como en HEAD), sin scroll horizontal, controles táctiles ≥40 px. */
  const hdr = await page.evaluate(() => {
    const h = document.querySelector("header").getBoundingClientRect();
    const ctrls = [...document.querySelectorAll("header button, header select")].filter((e) => e.offsetParent && !e.closest("#moreMenu"));
    return { h: Math.round(h.height), sw: document.documentElement.scrollWidth, iw: innerWidth,
      cut: ctrls.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map((e) => e.id),
      small: ctrls.map((e) => [e.id, Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().width)]).filter(([, h, w]) => Math.min(h, w) < 40).map(([id]) => id),
      playInHeader: !!document.querySelector("header #btnPlay"), playback: [...document.querySelectorAll("header button")].filter((b) => b.offsetParent && /Reproducir|Pausa|Play/.test(b.textContent)).map((b) => b.id) };
  });
  check(hdr.sw <= hdr.iw && hdr.cut.length === 0, `cabecera sin scroll horizontal ni controles cortados ${JSON.stringify({ sw: hdr.sw, cut: hdr.cut })}`);
  if (vp.width !== 1280) check(hdr.h < 70, `cabecera en una sola fila (${hdr.h} px; dos filas pasan de 85)`);
  else check(hdr.h <= 91, `1280: dos filas como en HEAD (${hdr.h} px, HEAD 91)`);
  if (vp.touch) {
    check(hdr.small.length === 0, `táctil: ningún control de la cabecera mide menos de 40 px ${JSON.stringify(hdr.small)}`);
    const tabs = await page.evaluate(() => [...document.querySelectorAll("#pagesBar .tab, #pagesBar > button")].map((e) => Math.round(e.getBoundingClientRect().height)));
    check(tabs.every((h) => h >= 38), `táctil: pestañas y «＋» de al menos 38 px de alto ${JSON.stringify(tabs)}`);
  }
  check(!hdr.playInHeader && hdr.playback.length === 0, "la cabecera no tiene controles de reproducción (Pausa vive en Animación; Reproducir, en Historias)");
  check(!!(await visibleBox(page, "#btnUndo")) && !!(await visibleBox(page, "#btnRedo")), "Deshacer y Rehacer visibles");
  check(await page.evaluate(() => $("btnUndo").disabled && $("btnRedo").disabled), "Deshacer y Rehacer deshabilitados con las pilas vacías");
  await shot(t, vp, "00-inicio");

  /* 2 · seleccionar */
  const A0 = await nodeAt(page, ids.A);
  if (vp.touch) await tap(t, A0.x, A0.y); else { await page.mouse.click(A0.x, A0.y); await page.waitForTimeout(150); }
  let s = await stateOf(page);
  check(same(s.selN, [ids.A]) && s.undo === 0, `2 · seleccionar: tocar/clic sobre «Origen» lo selecciona y no apila Undo ${JSON.stringify({ sel: s.selN, undo: s.undo })}`);
  const bar = await visibleBox(page, "#touchBar");
  if (vp.touch) {
    check(!!bar && !!(await visibleBox(page, "#tbConnect")) && !!(await visibleBox(page, "#tbMulti")), "2 · táctil: la barra de la selección ofrece «Conectar» y «Seleccionar varios»");
    check(!!(await visibleBox(page, "#btnDelTouch")), "2 · táctil: la papelera sigue apareciendo con selección");
  } else check(!bar, "2 · ratón: la barra táctil no aparece");
  await shot(t, vp, "02-seleccion");

  /* 3 · mover (un dedo / ratón sobre el nodo) */
  if (vp.touch) await touchDrag(t, A0.x, A0.y, A0.x + 40, A0.y + 30);
  else { await page.mouse.move(A0.x, A0.y); await page.mouse.down(); await page.mouse.move(A0.x + 40, A0.y + 30, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(150); }
  const s3 = await stateOf(page), zoom = s3.view[2];
  const a3 = s3.nodes.find((n) => n[0] === ids.A);
  check(Math.abs(a3[1] - (120 + 40 / zoom)) <= 2 && Math.abs(a3[2] - (100 + 30 / zoom)) <= 2 && s3.undo === 1, `3 · mover: «Origen» se desplaza 40×30 px de pantalla y apila exactamente un Undo ${JSON.stringify({ a: a3, undo: s3.undo })}`);
  await shot(t, vp, "03-mover");

  /* 4 · zoom y pan */
  const v0 = (await stateOf(page)).view;
  const cvb = await page.locator("#cv").boundingBox();
  const empty = { x: cvb.x + cvb.width - 30, y: cvb.y + Math.min(cvb.height - 30, 260) };
  if (vp.touch) {
    await touchDrag(t, empty.x, empty.y, empty.x - 60, empty.y - 20);
    const v1 = (await stateOf(page)).view;
    check(v1[0] === v0[0] - 60 && v1[1] === v0[1] - 20 && v1[2] === v0[2], `4 · un dedo en el vacío desplaza el plano exactamente lo arrastrado ${JSON.stringify({ v0, v1 })}`);
    await pinch(t, cvb.x + cvb.width / 2, cvb.y + 140, 80, 160);
    const v2 = (await stateOf(page)).view;
    check(v2[2] > v1[2] * 1.6 && (await stateOf(page)).nodes.length === 3, `4 · pellizco: dos dedos hacen zoom (${v1[2]} → ${v2[2]}) sin mover ni crear nodos`);
    await page.evaluate((v) => { viewX = v[0]; viewY = v[1]; viewZoom = v[2]; }, v0);
  } else {
    await page.mouse.move(empty.x, empty.y); await page.mouse.wheel(0, 100); await page.waitForTimeout(100);
    const v1 = (await stateOf(page)).view;
    await page.keyboard.down("Control"); await page.mouse.wheel(0, -100); await page.keyboard.up("Control"); await page.waitForTimeout(100);
    const v2 = (await stateOf(page)).view;
    check(v1[1] === v0[1] - 100 && v2[2] > v1[2], `4 · rueda desplaza y Ctrl+rueda acerca ${JSON.stringify({ v0, v1, v2 })}`);
    await page.evaluate((v) => { viewX = v[0]; viewY = v[1]; viewZoom = v[2]; }, v0);
  }
  await page.waitForTimeout(100);

  /* 5 · selección múltiple */
  const B0 = await nodeAt(page, ids.B), C0 = await nodeAt(page, ids.C), A1 = await nodeAt(page, ids.A);
  if (vp.touch) {
    await tap(t, A1.x, A1.y);
    await t.page.locator("#tbMulti").tap(); await page.waitForTimeout(150);
    check((await stateOf(page)).modes.multi && /1 seleccionado/.test(await page.locator("#tbMsg").textContent()), "5 · «Seleccionar varios» abre el modo y lo dice («1 seleccionado»)");
    await tap(t, B0.x, B0.y); await tap(t, C0.x, C0.y);
    s = await stateOf(page);
    check(same(s.selN, [ids.A, ids.B, ids.C].sort()), `5 · cada toque suma: Origen, Destino y Base ${JSON.stringify(s.selN)}`);
    await tap(t, B0.x, B0.y);
    s = await stateOf(page);
    check(same(s.selN, [ids.A, ids.C].sort()) && s.undo === 1, `5 · tocar uno ya seleccionado lo quita y no apila Undo ${JSON.stringify({ sel: s.selN, undo: s.undo })}`);
    await tap(t, empty.x, empty.y);
    check(same((await stateOf(page)).selN, [ids.A, ids.C].sort()), "5 · tocar el vacío no vacía la selección construida");
    await shot(t, vp, "05-varios");
    const before = await stateOf(page);
    await touchDrag(t, C0.x, C0.y, C0.x + 20, C0.y + 20);
    s = await stateOf(page);
    const moved = (id) => { const a = before.nodes.find((n) => n[0] === id), b = s.nodes.find((n) => n[0] === id); return a[1] !== b[1] || a[2] !== b[2]; };
    check(moved(ids.A) && moved(ids.C) && !moved(ids.B) && s.undo === 2, "5 · arrastrar un seleccionado mueve el grupo (Origen y Base), no Destino; un Undo");
    await t.page.locator("#tbAll").tap(); await page.waitForTimeout(100);
    check((await stateOf(page)).selN.length === 3, "5 · «Todo» selecciona todos los elementos");
    await t.page.locator("#tbDone").tap(); await page.waitForTimeout(100);
    s = await stateOf(page);
    check(!s.modes.multi && s.selN.length === 3 && !!(await visibleBox(page, "#tbMulti")), "5 · «Listo» cierra el modo y conserva la selección");
    await page.evaluate(() => { undo(); clearSel(); });  // deshace el arrastre del grupo
  } else {
    await page.mouse.move(cvb.x + 8, cvb.y + 8); await page.mouse.down(); await page.mouse.move(A1.x + 60, C0.y + 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(100);
    s = await stateOf(page);
    check(same(s.selN, [ids.A, ids.C].sort()), `5 · marco con ratón: Origen y Base ${JSON.stringify(s.selN)}`);
    await page.keyboard.down("Shift"); await page.mouse.click(B0.x, B0.y); await page.keyboard.up("Shift"); await page.waitForTimeout(100);
    check((await stateOf(page)).selN.length === 3, "5 · Shift+clic suma Destino");
    await page.evaluate(() => clearSel());
  }

  /* 6 · conectar · 7 · cancelar conexión */
  const undoBefore = (await stateOf(page)).undo, edgesBefore = (await stateOf(page)).edges.length;
  const A2 = await nodeAt(page, ids.A), B2 = await nodeAt(page, ids.B);
  if (vp.touch) {
    await tap(t, A2.x, A2.y); await t.page.locator("#tbConnect").tap(); await page.waitForTimeout(120);
    s = await stateOf(page);
    check(s.modes.link === ids.A && /destino/i.test(await page.locator("#tbMsg").textContent()) && !!(await visibleBox(page, "#tbCancel")), "7 · «Conectar» deja el origen elegido y pide el destino, con «Cancelar»");
    await touchDrag(t, empty.x, empty.y, empty.x - 30, empty.y);
    s = await stateOf(page);
    check(s.modes.link === ids.A && s.edges.length === edgesBefore, "7 · mover el plano mientras se busca el destino no cancela ni conecta");
    await shot(t, vp, "06-conectar-destino");
    await t.page.locator("#tbCancel").tap(); await page.waitForTimeout(120);
    s = await stateOf(page);
    check(s.modes.link === null && s.edges.length === edgesBefore && s.undo === undoBefore, "7 · «Cancelar» cierra el modo sin crear nada ni apilar Undo");
    await page.evaluate((v) => { viewX = v[0]; viewY = v[1]; }, v0); await page.waitForTimeout(80);
    const A3 = await nodeAt(page, ids.A), B3 = await nodeAt(page, ids.B);
    await tap(t, A3.x, A3.y); await t.page.locator("#tbConnect").tap(); await page.waitForTimeout(120);
    await tap(t, B3.x, B3.y);
    s = await stateOf(page);
    const e = s.edges[s.edges.length - 1];
    check(s.edges.length === edgesBefore + 1 && e[1] === ids.A && e[2] === ids.B && s.modes.link === null && same(s.selE, [e[0]]) && s.undo === undoBefore + 1,
      `6 · tocar el destino crea Origen → Destino (dirección conservada), la selecciona, cierra el modo y apila un Undo ${JSON.stringify({ e, undo: s.undo })}`);
  } else {
    await page.mouse.click(A2.x, A2.y); await page.waitForTimeout(80);
    await page.keyboard.press("c"); await page.mouse.click(A2.x, A2.y); await page.keyboard.press("Escape"); await page.waitForTimeout(80);
    s = await stateOf(page);
    check(s.edges.length === edgesBefore && (await page.evaluate(() => connecting)) === null, "7 · modo Flecha: Escape cancela sin conectar");
    await page.mouse.click(A2.x, A2.y); await page.mouse.click(B2.x, B2.y); await page.keyboard.press("v"); await page.waitForTimeout(80);
    s = await stateOf(page);
    const e = s.edges[s.edges.length - 1];
    check(s.edges.length === edgesBefore + 1 && e[1] === ids.A && e[2] === ids.B, `6 · modo Flecha: clic origen, clic destino → Origen → Destino ${JSON.stringify(e)}`);
  }
  await shot(t, vp, "06-conectado");

  /* 11 · Undo · 12 · Redo (botones) */
  const eCount = (await stateOf(page)).edges.length;
  check(await page.evaluate(() => !$("btnUndo").disabled && $("btnRedo").disabled), "11 · con cambios, Deshacer se habilita y Rehacer no");
  await press(t, "#btnUndo", vp); await page.waitForTimeout(120);
  s = await stateOf(page);
  check(s.edges.length === eCount - 1 && !(await page.evaluate(() => $("btnRedo").disabled)), "11 · Deshacer quita la conexión y habilita Rehacer");
  await press(t, "#btnRedo", vp); await page.waitForTimeout(120);
  s = await stateOf(page);
  check(s.edges.length === eCount && same(s.edges[s.edges.length - 1].slice(1), [ids.A, ids.B]), "12 · Rehacer la devuelve con la misma dirección");

  /* 1 · abrir/cerrar propiedades · 15 · volver al canvas */
  const A4 = await nodeAt(page, ids.A);
  if (vp.touch) await tap(t, A4.x, A4.y); else await page.mouse.click(A4.x, A4.y);
  if (vp.mobile) {
    check(!(await visibleBox(page, "aside")), "1 · la hoja empieza cerrada: el lienzo ocupa el espacio");
    await t.page.locator("#btnPanel").tap(); await page.waitForTimeout(350);
    const aside = await visibleBox(page, "aside"), hb = await visibleBox(page, "header"), bb = await visibleBox(page, "#bottomBar");
    check(!!aside && aside.y >= hb.b + 40 && Math.abs(aside.b - bb.y) <= 1 && (await page.evaluate(() => !$("selBody").hidden && getComputedStyle($("selBody")).display !== "none")),
      `1 · ⚙ abre las propiedades de «Origen» en una hoja entre la cabecera y la barra de páginas ${JSON.stringify({ aside, hb: hb.b, bb: bb.y })}`);
    check(await onTop(page, "#btnPanel") && await onTop(page, "#btnPanelClose") && await onTop(page, "#btnStories"), "1 · con la hoja abierta, ⚙, «Cerrar» e Historias siguen accesibles (nada los tapa)");
    const selVis = await aboveSheet(page, "selection");
    check(selVis.ok, "1 · el elemento seleccionado se ve por encima de la hoja " + JSON.stringify(selVis));
    await shot(t, vp, "01-propiedades");
    await t.page.locator("#btnPanelClose").tap(); await page.waitForTimeout(350);
    check(!(await stateOf(page)).panelOpen && !(await visibleBox(page, "aside")) && await onTop(page, "#cv"), "15 · «Cerrar» vuelve al lienzo");
    await t.page.locator("#btnPanel").tap(); await page.waitForTimeout(300); await t.page.locator("#btnPanel").tap(); await page.waitForTimeout(350);
    check(!(await stateOf(page)).panelOpen, "1 · ⚙ también cierra la hoja (interruptor)");
    /* Con el elemento visible la vista no se toca; con el elemento escondido bajo donde se abrirá la hoja, se desplaza. */
    const vBefore = (await stateOf(page)).view;
    await t.page.locator("#btnPanel").tap(); await page.waitForTimeout(350);
    check(same((await stateOf(page)).view, vBefore), "1 · si la selección ya se ve, abrir la hoja no mueve la vista");
    await t.page.locator("#btnPanelClose").tap(); await page.waitForTimeout(350);
    await page.evaluate(() => { const cr = cv.getBoundingClientRect(), n = nodeById([...selN][0]); viewY = cr.height - 60 - n.y * viewZoom; });
    await t.page.locator("#btnPanel").tap(); await page.waitForTimeout(350);
    const hidden = await aboveSheet(page, "selection");
    check(hidden.ok && (await stateOf(page)).view[2] === vBefore[2], "1 · si quedaba debajo de la hoja, la vista se desplaza (sin cambiar el zoom) y se ve " + JSON.stringify(hidden));
    await t.page.locator("#btnPanelClose").tap(); await page.waitForTimeout(350);
    await page.evaluate((v) => { viewX = v[0]; viewY = v[1]; viewZoom = v[2]; }, vBefore);
  } else {
    check(!!(await visibleBox(page, "aside")) && !(await visibleBox(page, "#btnPanel")) && !(await visibleBox(page, "#btnPanelClose")), "1 · el panel es una columna fija: sin ⚙ ni botón de cerrar");
    check(await page.evaluate(() => getComputedStyle($("selBody")).display !== "none" && $("lblEdit").value === "Origen"), "1 · seleccionar muestra sus propiedades en la columna");
  }

  /* 9 · crear página · 8 · cambiar página · 10 · renombrar página */
  const p0 = await stateOf(page);
  await press(t, "#pagesBar > button", vp); await page.waitForTimeout(150);
  s = await stateOf(page);
  check(s.pages.length === p0.pages.length + 1 && s.cur === s.pages.length - 1, `9 · «＋» crea una página y la activa ${JSON.stringify(s.pages)}`);
  await press(t, "#pagesBar .tab >> nth=0", vp); await page.waitForTimeout(150);
  s = await stateOf(page);
  check(s.cur === 0 && s.nodes.length === 3, "8 · tocar la primera pestaña vuelve a la página 1 con su contenido");
  const dialogsBefore = t.dialogs.length;
  if (vp.touch) {
    check(!!(await visibleBox(page, "#pagesBar .tab.active .pgMore")), "10 · la pestaña activa muestra su ▾ con el dedo");
    await t.page.locator("#pagesBar .tab.active").tap(); await page.waitForTimeout(150);
    check(!!(await visibleBox(page, "#pageMenu")) && /Renombrar/.test(await page.locator("#pageMenu").textContent()), "10 · tocar la pestaña activa abre el menú de la página");
    await shot(t, vp, "10-menu-pagina");
    await t.page.locator("#pageMenu button", { hasText: "Renombrar" }).tap(); await page.waitForTimeout(120);
    await page.locator("#pageNameIn").fill("   ");
    await t.page.locator("#pageNameSave").tap(); await page.waitForTimeout(120);
    const pmErr = await page.evaluate(() => ({ err: document.querySelector("#pageMenu .pmError")?.textContent, hidden: $("pageMenu").hidden, html: $("pageMenu").innerHTML.slice(0, 160), pages: doc.pages.map((x) => x.name), cur: doc.cur }));
    check(/1 a 80/.test(pmErr.err || "") && pmErr.pages[0] === p0.pages[0], "10 · un nombre vacío se explica en el propio menú y no cambia nada " + JSON.stringify(pmErr));
    await page.locator("#pageNameIn").fill("Arquitectura");
    await t.page.locator("#pageNameSave").tap(); await page.waitForTimeout(150);
    s = await stateOf(page);
    check(s.pages[0] === "Arquitectura" && !(await visibleBox(page, "#pageMenu")) && t.dialogs.length === dialogsBefore, "10 · «Guardar nombre» renombra sin diálogos nativos y cierra el menú");
    await t.page.locator("#pagesBar .tab.active .pgMore").tap(); await page.waitForTimeout(120);
    check(!!(await visibleBox(page, "#pageMenu")), "10 · el ▾ abre el mismo menú");
    await tap(t, empty.x, empty.y);
    check(!(await visibleBox(page, "#pageMenu")), "10 · tocar fuera cierra el menú");
  } else {
    check(!(await visibleBox(page, "#pagesBar .tab.active .pgMore")), "10 · con ratón no aparece el ▾ (la pestaña es la de siempre)");
    await page.locator("#pagesBar .tab >> nth=0").dblclick(); await page.waitForTimeout(150);
    s = await stateOf(page);
    check(s.pages[0] === "Arquitectura" && t.dialogs.length === dialogsBefore + 1 && t.dialogs[dialogsBefore].type === "prompt", "10 · doble clic + nombre: renombra como siempre");
    await page.locator("#pagesBar .tab.active").click(); await page.waitForTimeout(100);
    check(!(await visibleBox(page, "#pageMenu")), "10 · un clic en la pestaña activa no abre ningún menú con ratón");
  }
  await shot(t, vp, "10-renombrada");

  /* 16 · Ejemplo sin destruir el documento */
  const docBefore = await page.evaluate(() => JSON.stringify(serializeProject().doc.pages));
  /* FLUYO-018.14b: Archivo (Ejemplo, Abrir, Guardar, Limpiar) vive en «Más» en todas las anchuras */
  await press(t, "#btnMore", vp); await page.waitForTimeout(150);
  await press(t, "#btnDemo", vp); await page.waitForTimeout(250);
  s = await stateOf(page);
  const after = await page.evaluate(() => serializeProject().doc.pages);
  const prev = JSON.parse(docBefore);
  check(s.pages.length === prev.length + 1 && s.cur === prev.length && s.pages[s.cur] === "Ejemplo" && same(after.slice(0, prev.length), prev) && s.nodes.length === 8,
    `16 · «Ejemplo» abre el funnel en una página nueva («Ejemplo», 8 elementos) y las páginas anteriores quedan idénticas ${JSON.stringify(s.pages)}`);
  check(!(await visibleBox(page, "#moreMenu")), "16 · el menú «Más» se cierra al usar una acción");
  await shot(t, vp, "16-ejemplo");

  /* Menú «Más»: enlaces del proyecto fuera del espacio de trabajo */
  check(!(await visibleBox(page, "#bottomBar a")) && !(await visibleBox(page, "aside #ossSection")), "D8 · ni la barra inferior ni el panel llevan enlaces del sitio");
  await press(t, "#btnMore", vp); await page.waitForTimeout(150);
  const links = await page.evaluate(() => [...document.querySelectorAll("#moreMenu a")].filter((a) => a.offsetParent).map((a) => a.getAttribute("href")));
  check(["docs/", "ejemplos/", "privacidad/", "soporte/", "https://github.com/itsnect/fluyo", "https://github.com/itsnect/fluyo-mcp"].every((h) => links.includes(h)), "D8 · «Más» lleva Docs, Ejemplos, Privacidad, Soporte, GitHub y MCP");
  check(!!(await visibleBox(page, "#moreMenu #btnJsonOut")), "«Más» recoge el archivo (018.14b: en todas las anchuras)");
  if (vp.mobile) check(!!(await visibleBox(page, "#moreMenu #themeSel")), "móvil: «Más» recoge también el tema del lienzo");
  else { await page.keyboard.press("Escape"); await press(t, "#btnCanvas", vp); check(!!(await visibleBox(page, "#canvasMenu #themeSel")), "el tema del lienzo vive en «Lienzo ▾» (018.14b)"); await page.keyboard.press("Escape"); await press(t, "#btnMore", vp); }
  await shot(t, vp, "20-mas");
  await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  check(!(await visibleBox(page, "#moreMenu")), "Escape cierra «Más»");

  /* 13 · abrir Historias · 14 · iniciar/detener Playback · 15 · volver al canvas */
  await page.evaluate((fx) => { applyProjectData(JSON.parse(fx)); fitView(); }, FIXTURE); await page.waitForTimeout(250);
  if (vp.mobile) {
    await t.page.locator("#btnStories").tap(); await page.waitForTimeout(350);
    check((await stateOf(page)).panelOpen && (await page.evaluate(() => $("panelScenarios").style.display !== "none" && $("btnStories").getAttribute("aria-expanded") === "true")), "13 · «Historias» abre su superficie en la hoja");
    /* 018.14b: en modo Historia la salida de la hoja es «Volver a editar» */
    check(await onTop(page, "#btnStories") && await onTop(page, "#btnStoryExit"), "13 · Historias y «Volver a editar» siguen accesibles con la hoja abierta");
    const pv = await aboveSheet(page, "page");
    check(pv.ok, "13 · el diagrama se ve entero por encima de la hoja (si quedaba debajo, la vista se desplaza) " + JSON.stringify(pv));
    /* Colocar un evento: el destino está en el lienzo, así que la hoja se aparta mientras dura; «Cancelar» queda a la vista. */
    const placing = () => page.evaluate(() => document.body.classList.contains("scPlacing"));
    /* 018.14b: en la hoja compacta la biblioteca es una paleta («Eventos · N») */
    if (await page.evaluate(() => $("panelScenarios").classList.contains("scCompact") && !$("scLibrarySection").classList.contains("scFloating"))) { await t.page.locator("#scPaletteToggle").tap(); await page.waitForTimeout(250); }
    await t.page.locator(".scEventPlace", { hasText: "Pago" }).tap(); await page.waitForTimeout(350);
    check(await placing() && !(await visibleBox(page, "aside")) && !!(await visibleBox(page, "#scPlacementCancel")), "13 · elegir un evento aparta la hoja; la barra de colocación (con «Cancelar») queda a la vista");
    await shot(t, vp, "13-colocando");
    await t.page.locator("#scPlacementCancel").tap(); await page.waitForTimeout(350);
    check(!(await placing()) && !!(await visibleBox(page, "aside")), "13 · «Cancelar» devuelve la hoja");
    const steps0 = await page.evaluate(() => scActiveScenario().steps.length);
    /* 018.14b: en la hoja compacta la biblioteca es una paleta («Eventos · N») */
    if (await page.evaluate(() => $("panelScenarios").classList.contains("scCompact") && !$("scLibrarySection").classList.contains("scFloating"))) { await t.page.locator("#scPaletteToggle").tap(); await page.waitForTimeout(250); }
    await t.page.locator(".scEventPlace", { hasText: "Pago" }).tap(); await page.waitForTimeout(350);
    const mid = await page.evaluate(() => { const m = pointAt(edgePoints(P().edges[0]), 0.5), r = cv.getBoundingClientRect(); return { x: r.left + viewX + m.x * viewZoom, y: r.top + viewY + m.y * viewZoom }; });
    await tap(t, mid.x, mid.y);
    check((await page.evaluate(() => scActiveScenario().steps.length)) === steps0 + 1 && !(await placing()) && !!(await visibleBox(page, "aside")),
      "13 · tocar la conexión en el lienzo añade el momento a la Historia y la hoja vuelve");
  } else {
    await press(t, "#tabScenarios", vp); await page.waitForTimeout(250);
    check(await page.evaluate(() => $("panelScenarios").style.display !== "none"), "13 · la pestaña Historias abre la superficie en la columna");
  }
  await shot(t, vp, "13-historias");
  const openH = vp.mobile ? (await visibleBox(page, "aside")).h : 0;
  await press(t, "#scRun", vp); await page.waitForTimeout(500);
  s = await stateOf(page);
  check(await page.evaluate(() => isScenarioPlaybackActive()), "14 · «Reproducir» inicia la Historia");
  check(await page.evaluate(() => $("btnUndo").disabled && $("btnRedo").disabled), "14 · Deshacer/Rehacer se apagan mientras el documento está congelado");
  check(!(await visibleBox(page, "#touchBar")), "14 · la barra táctil no aparece durante el Playback");
  if (vp.mobile) {
    const playH = (await visibleBox(page, "aside")).h;
    /* 018.14b: la hoja de Historias ya es compacta al abrirse; reproduciendo baja aún más (≤ 28 % del alto) */
    check(playH < openH && playH <= vp.height * 0.28 && !!(await visibleBox(page, "#scReset")), `14 · reproduciendo, la hoja se compacta para que se vea la Historia (${Math.round(openH)} → ${Math.round(playH)} px) y «Detener» sigue a mano`);
    const pp = await aboveSheet(page, "page");
    check(pp.ok, "14 · el diagrama que se reproduce queda a la vista " + JSON.stringify(pp));
  }
  await shot(t, vp, "14-reproduciendo");
  await press(t, "#scReset", vp); await page.waitForTimeout(200);
  check(!(await page.evaluate(() => isScenarioPlaybackActive())), "14 · «Detener» termina el Playback");
  if (vp.mobile) {
    await t.page.locator("#btnStories").tap(); await page.waitForTimeout(350);
    check(!(await stateOf(page)).panelOpen && await onTop(page, "#cv"), "15 · «Historias» de nuevo cierra la hoja y vuelve al lienzo");
  } else {
    await press(t, "#tabProperties", vp); await page.waitForTimeout(150);
    check(await page.evaluate(() => $("panelProperties").style.display !== "none") && await onTop(page, "#cv"), "15 · Propiedades de vuelta; el lienzo nunca se tapó");
  }

  check(t.errors.length === 0, `0 errores de consola/página ${JSON.stringify(t.errors)}`);
  await t.ctx.close();
}

/* ═════════ Escritorio: misma secuencia en HEAD y en el árbol de trabajo ═════════ */
async function desktopScript(browser, base, vp) {
  const t = await open(browser, base, vp); const { page } = t;
  const ids = await page.evaluate(SETUP, { zoom: 0.8 });
  const out = {};
  const A = await nodeAt(page, ids.A), B = await nodeAt(page, ids.B), C = await nodeAt(page, ids.C);
  await page.mouse.click(A.x, A.y); await page.waitForTimeout(80);
  out.clickUndo = await page.evaluate(() => undoStack.length);
  await page.mouse.move(A.x, A.y); await page.mouse.down(); await page.mouse.move(A.x + 40, A.y + 30, { steps: 8 }); await page.mouse.up();
  /* flecha de conexión de «Destino» (lado e), soltada sobre «Base» */
  await page.mouse.click(B.x, B.y); await page.waitForTimeout(80);
  const arrow = await page.evaluate((id) => { const n = P().nodes.find((x) => x.id === id), r = cv.getBoundingClientRect(); const p = sidePoint(n, "e"); return { x: r.left + viewX + (p.x + ARROW_OFF) * viewZoom, y: r.top + viewY + p.y * viewZoom }; }, ids.B);
  await page.mouse.move(arrow.x, arrow.y); await page.mouse.down(); await page.mouse.move(C.x, C.y, { steps: 10 }); await page.mouse.up();
  /* modo Flecha: Base → Origen */
  const A2 = await nodeAt(page, ids.A);
  await page.keyboard.press("c"); await page.mouse.click(C.x, C.y); await page.mouse.click(A2.x, A2.y); await page.keyboard.press("v");
  /* marco + Shift+clic */
  const cvb = await page.locator("#cv").boundingBox();
  await page.mouse.move(cvb.x + 8, cvb.y + 8); await page.mouse.down(); await page.mouse.move(A2.x + 70, C.y + 40, { steps: 8 }); await page.mouse.up();
  await page.keyboard.down("Shift"); await page.mouse.click(B.x, B.y); await page.keyboard.up("Shift");
  out.selection = await page.evaluate(() => [[...selN].sort(), [...selE].sort()]);
  /* rueda y Ctrl+rueda */
  /* mouse.wheel no espera a que el evento se procese: sin las pausas, Ctrl puede soltarse antes y la rueda desplazaría. */
  /* FLUYO-018.13: el punto se fija desde la esquina del lienzo y no desde su borde derecho. El marco del lienzo lo hace
     unos px más estrecho que en HEAD y Ctrl+rueda se ancla al punto del lienzo bajo el cursor: con «ancho − 40» los dos
     árboles hacían zoom alrededor de puntos distintos del lienzo y la vista difería sin que el gesto cambiara. */
  await page.mouse.move(cvb.x + 600, cvb.y + 300); await page.mouse.wheel(0, 80); await page.waitForTimeout(120);
  await page.keyboard.down("Control"); await page.mouse.wheel(0, -100); await page.waitForTimeout(120); await page.keyboard.up("Control");
  out.view = await page.evaluate(() => [viewX, viewY, viewZoom]);
  /* páginas: ＋, volver, doble clic para renombrar */
  await page.locator("#pagesBar > button").click(); await page.locator("#pagesBar .tab >> nth=0").click();
  await page.locator("#pagesBar .tab >> nth=0").dblclick();
  /* Ctrl+Z / Ctrl+Y */
  await page.mouse.click(cvb.x + cvb.width - 40, cvb.y + 40);
  await page.keyboard.press("Control+z"); out.afterUndo = await page.evaluate(() => JSON.stringify(serializeProject()));
  await page.keyboard.press("Control+y"); out.afterRedo = await page.evaluate(() => JSON.stringify(serializeProject()));
  out.doc = await page.evaluate(() => JSON.stringify(serializeProject()));
  /* Ejemplo: aquí se espera una diferencia (D9) */
  out.pagesBeforeDemo = await page.evaluate(() => doc.pages.length);
  /* 018.14b: «Ejemplo» vive en «Más» (en HEAD, en la cabecera: no hace nada) */
  if (await page.evaluate(() => !!document.getElementById("btnDemo").closest("#moreMenu") && document.getElementById("moreMenu").hidden)) await page.locator("#btnMore").click();
  await page.locator("#btnDemo").click(); await page.waitForTimeout(150);
  out.demo = await page.evaluate(() => ({ pages: doc.pages.map((p) => p.name), cur: doc.cur }));
  out.errors = t.errors; out.dialogs = t.dialogs.map((d) => d.type);
  await t.ctx.close();
  return out;
}

/* ═════════ Móvil en HEAD: documentar las diferencias intencionales ═════════ */
async function mobileHead(browser, base) {
  const vp = VIEWPORTS[0], t = await open(browser, base, vp), { page } = t, out = {};
  await page.evaluate(SETUP, { zoom: 0.55 });
  await page.locator("#btnPanel").tap(); await page.waitForTimeout(350);
  out.panelCoversToggle = !(await onTop(page, "#btnPanel"));
  await page.evaluate(() => document.body.classList.remove("panelOpen")); await page.waitForTimeout(300);
  out.undoButton = !!(await page.$("#btnUndo"));
  /* Renombrar: HEAD solo tenía doble clic + prompt(). Con dos toques rápidos Chrome puede sintetizar el dblclick (pasa en el
     recorrido táctil), así que no se afirma que fuera imposible: era una vía invisible. Ahora hay una explícita. */
  out.pageMenu = !!(await page.$("#pageMenu"));
  out.pagesBeforeDemo = await page.evaluate(() => doc.pages.length);
  await page.evaluate(() => $("btnDemo").click()); await page.waitForTimeout(150);
  out.demoPages = await page.evaluate(() => doc.pages.length);
  out.headerH = await page.evaluate(() => Math.round(document.querySelector("header").getBoundingClientRect().height));
  await t.ctx.close();
  return out;
}

/* ═════════ Densidad 2 ═════════ */
async function dpr(browser, base) {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[4]]) {
    console.log(`\nDPR 2 · ${vp.key}`);
    const t = await open(browser, base, vp, { deviceScaleFactor: 2 }); const { page } = t;
    const ids = await page.evaluate(SETUP, { zoom: 0.7 });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { cssW: r.width, cssH: r.height, w: cv.width, h: cv.height, dpr: devicePixelRatio, flag: cv.fluyoDpr }; });
    check(m.w === Math.round(m.cssW * 2) && m.h === Math.round(m.cssH * 2) && m.flag === 2, `respaldo del lienzo al doble de su caja (${m.cssW}×${m.cssH} CSS → ${m.w}×${m.h})`);
    /* El borde izquierdo de «Origen» se pinta donde dicen las coordenadas (en px de respaldo = CSS × 2). */
    const px = await page.evaluate((id) => {
      const n = P().nodes.find((x) => x.id === id), c = cv.getContext("2d");
      const sx = viewX + (n.x - n.w / 2) * viewZoom, sy = viewY + n.y * viewZoom;
      const at = (x, y) => [...c.getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data];
      return { border: at(sx, sy), outside: at(sx - 12, sy), inside: at(sx + 20, sy) };
    }, ids.A);
    const lum = (p) => p[0] + p[1] + p[2];
    check(lum(px.border) > lum(px.outside) + 60, `el borde del nodo cae en su coordenada ×2 (${px.border} vs fondo ${px.outside})`);
    const A = await nodeAt(page, ids.A);
    if (vp.touch) await tap(t, A.x, A.y); else { await page.mouse.click(A.x, A.y); await page.waitForTimeout(100); }
    check(same((await stateOf(page)).selN, [ids.A]), "tocar/clic en el centro visible selecciona el nodo correcto");
    if (vp.touch) await touchDrag(t, A.x, A.y, A.x + 50, A.y); else { await page.mouse.move(A.x, A.y); await page.mouse.down(); await page.mouse.move(A.x + 50, A.y, { steps: 6 }); await page.mouse.up(); }
    const a = (await stateOf(page)).nodes.find((n) => n[0] === ids.A);
    check(Math.abs(a[1] - (120 + 50 / 0.7)) <= 2, `arrastrar 50 px CSS mueve 50/zoom en el mundo (${a[1]})`);
    await page.evaluate((id) => { selectOnly("node", id); openEditorAt(P().nodes.find((x) => x.id === id)); }, ids.A); await page.waitForTimeout(100);
    const ed = await page.evaluate((id) => { const b = editBox.getBoundingClientRect(), n = P().nodes.find((x) => x.id === id), r = cv.getBoundingClientRect(); return { bx: b.left + b.width / 2, by: b.top + b.height / 2, nx: r.left + viewX + n.x * viewZoom, ny: r.top + viewY + n.y * viewZoom }; }, ids.A);
    check(Math.abs(ed.bx - ed.nx) < 3 && Math.abs(ed.by - ed.ny) < 3, "el cuadro de edición de texto queda sobre el nodo (px CSS)");
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(shots, `${vp.key}-dpr2.png`) });
    if (vp.key === "d1440") {
      const url = await page.evaluate(async (b) => createShareUrl(serializeProject(), b + "/s/"), base);
      const v = await t.ctx.newPage();
      v.on("pageerror", (e) => t.errors.push("viewer: " + e.message)); v.on("console", (mm) => { if (mm.type() === "error") t.errors.push("viewer: " + mm.text()); });
      await v.goto(url.replace(/^https?:\/\/[^/]+/, base)); await v.waitForFunction(() => typeof viewerPhase !== "undefined" && viewerPhase === "ready").catch(() => {});
      await v.waitForTimeout(300);
      const vm2 = await v.evaluate(() => { const r = sv.getBoundingClientRect(); return { cssW: r.width, w: sv.width, flag: sv.fluyoDpr }; });
      check(vm2.w === Math.round(vm2.cssW * 2) && vm2.flag === 2, `Viewer: respaldo al doble (${vm2.cssW} → ${vm2.w})`);
      await v.screenshot({ path: path.join(shots, `viewer-dpr2.png`) });
    }
    check(t.errors.length === 0, `0 errores ${JSON.stringify(t.errors)}`);
    await t.ctx.close();
  }
}

(async () => {
  const wt = await serve(root);
  /* HEAD solo hace falta para las comparaciones (ONLY vacío o "cmp"); las copias de mutaciones no tienen .git. */
  const hd = !process.env.ONLY || process.env.ONLY === "cmp" ? await serve(headTree()) : null;
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  try {
    for (const vp of VIEWPORTS) if (!process.env.ONLY || process.env.ONLY === vp.key) await journey(browser, wt.base, vp);

    if (!process.env.ONLY || process.env.ONLY === "cmp") for (const vp of [VIEWPORTS[3], VIEWPORTS[4]]) {
      console.log(`\nEscritorio ${vp.key}: la misma secuencia en HEAD y en el árbol de trabajo`);
      const W = await desktopScript(browser, wt.base, vp), H = await desktopScript(browser, hd.base, vp);
      /* FLUYO-018.15: en HEAD un nodo nuevo nacía #6a9fb5; ahora nace DEFAULT_NODE_COLOR. Se deshace solo ese cambio deliberado:
         todo lo demás del documento tiene que seguir siendo idéntico. */
      for (const k of ["doc", "afterUndo", "afterRedo"]) if (typeof W[k] === "string") W[k] = W[k].replaceAll('"color":"#857F6C"', '"color":"#6a9fb5"');
      check(W.doc === H.doc, "documento idéntico a HEAD tras mover, conectar (flecha y modo Flecha), páginas, renombrar, Ctrl+Z y Ctrl+Y");
      check(W.afterUndo === H.afterUndo && W.afterRedo === H.afterRedo, "Ctrl+Z y Ctrl+Y dejan el mismo documento que en HEAD");
      /* FLUYO-018.13: la vista se compara con tolerancia de medio píxel. En HEAD la cabecera de 1280 medía 89,x px (dos filas) y
         el lienzo empezaba en una coordenada fraccionaria; el navegador entrega la rueda en px enteros, así que el punto del
         lienzo bajo el cursor variaba unas décimas entre árboles. El zoom debe ser exactamente el mismo. */
      const sameView = W.view[2] === H.view[2] && Math.abs(W.view[0] - H.view[0]) < 0.5 && Math.abs(W.view[1] - H.view[1]) < 0.5;
      check(same(W.selection, H.selection) && sameView, "marco + Shift+clic y rueda/Ctrl+rueda: misma selección y misma vista que HEAD " + JSON.stringify({ W: [W.selection, W.view], H: [H.selection, H.view] }));
      check(same(W.dialogs, H.dialogs), `mismos diálogos que HEAD (${W.dialogs.join(",")})`);
      check(W.clickUndo === 0 && H.clickUndo === 1, `diferencia intencional: un clic sin mover ya no apila Undo (HEAD ${H.clickUndo}, ahora ${W.clickUndo})`);
      check(W.demo.pages.length === W.pagesBeforeDemo + 1 && H.demo.pages.length === H.pagesBeforeDemo, `diferencia intencional (D9): Ejemplo añade una página (${W.demo.pages.join(",")}); HEAD reemplazaba la activa (${H.demo.pages.join(",")})`);
      check(W.errors.length === 0 && H.errors.length === 0, "0 errores en HEAD y en el árbol de trabajo");
    }

    if (!process.env.ONLY) {
    console.log("\nMóvil 390: diferencias intencionales frente a HEAD");
    const MH = await mobileHead(browser, hd.base);
    check(MH.panelCoversToggle, "HEAD: el cajón abierto tapaba a ⚙ (sin salida) — ahora ⚙, «Cerrar» e Historias quedan a la vista (ver 1)");
    check(!MH.undoButton, "HEAD: no había Deshacer/Rehacer sin teclado — ahora están en la cabecera (ver 11/12)");
    check(!MH.pageMenu, "HEAD: renombrar solo con doble clic/doble toque + prompt(), sin vía visible — ahora el menú de la pestaña (ver 10)");
    check(MH.demoPages === MH.pagesBeforeDemo, "HEAD: Ejemplo vaciaba la página activa — ahora crea otra (ver 16)");
    check(MH.headerH > 120, `HEAD: cabecera de ${MH.headerH} px en 390 — ahora una fila (ver cabecera)`);

    await dpr(browser, wt.base);
    }
  } finally {
    await browser.close(); wt.server.close(); if (hd) hd.server.close();
  }
  console.log(`\n${passed} ✔ · ${failed} ✘ · capturas en ${shots}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
