"use strict";
/* FLUYO-019-HIT-TEST — Acierto, puerto y foco en Chrome real, con gestos reales (page.mouse / page.keyboard / page.touchscreen).
   Se sirven dos árboles: el de trabajo y el de la base d31703e (antes del arreglo). En la base, los casos clave deben REPRODUCIR
   el bug (así el test demuestra que lo detecta); en el árbol, deben estar arreglados.
   · D1: la tabla de la tarea (§4.2) con clics reales: conexión dentro de un contenedor, Z invertido, anidado, vacío/borde (D3),
     conexión interna↔externa, caja sin hijos (F′). Doble clic sobre una conexión interna edita la conexión. Historias: un
     evento de conexión soltado sobre una conexión interna la toma como destino.
   · D2: un clic (sin moverse) en la zona de un puerto NUNCA crea una conexión, ni dentro de un contenedor ni sobre un vecino;
     selecciona lo que hay debajo (Mayús suma/quita). Arrastrar desde el puerto sigue conectando: una conexión, una entrada de Undo.
   · D4: con una conexión seleccionada, pulsar junto a su ancla (dentro del nodo) agarra el extremo; tras seleccionar otra pieza,
     el mismo punto arrastra el nodo.
   · D7: con el foco en cada campo de texto/número/casilla visible del panel (nodo y conexión), un clic o un toque en otro nodo
     deja el foco en body: Supr borra y Retroceso no edita nada. Un change pendiente (Orden de aparición) se aplica al objeto
     ANTERIOR con una sola entrada de Undo. Cerrar la edición en el lienzo suelta el foco en el mismo fotograma.
   · 0 errores de página.
   Uso: node test/fluyo-019-hit-test-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome; SKIP_BASE=1 sin la base) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const BASE = "d31703e";
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-hit-test-")), tar = path.join(dir, "t.tar");
  execFileSync("git", ["-C", process.env.FLUYO_GIT_ROOT || root, "archive", rev, "-o", tar]);
  execFileSync("tar", ["-xf", "t.tar"], { cwd: dir });
  fs.unlinkSync(tar);
  return dir;
}
let failed = 0, passed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };

const N = (id, x, y, w, h, label, ex) => Object.assign({ id, shape: "rect", x, y, w, h, label, color: "#6a9fb5" }, ex || {});
const E = (id, from, to, ex) => Object.assign({ id, from, to, route: "straight", animated: true, endArrow: true }, ex || {});
const GCP = (ex) => N(1, 500, 350, 640, 420, "GCP", Object.assign({ border: "dashed" }, ex || {}));
const A = N(2, 330, 300, 120, 60, "A"), B = N(3, 670, 300, 120, 60, "B"), C = N(4, 500, 470, 120, 60, "C"), X = N(5, 40, 300, 100, 60, "X"), Y = N(6, 960, 300, 100, 60, "Y");
const REGION = N(7, 500, 350, 820, 560, "Región");
const docOf = (nodes, edges) => ({ version: 5, app: "fluyo", settings: { grid: false, speed: 0.5, dots: 3 },
  doc: { theme: "crema", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0,
    pages: [{ name: "P", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 200, nodes, edges }, { name: "P2", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 1, nodes: [], edges: [] }] } });

async function editor(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", deviceScaleFactor: 1, hasTouch: !!opts.touch });
  await ctx.route((u) => !u.href.startsWith(base), (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e))); page.on("dialog", (d) => d.accept());
  await page.goto(base + "/"); await page.waitForFunction(() => typeof applyProjectData === "function" && typeof cv !== "undefined");
  const ed = {
    page, errors, ctx,
    load: async (nodes, edges) => { await page.evaluate((d) => { applyProjectData(d); viewZoom = 1; viewX = 40; viewY = 40; clearSel(); undoStack.length = 0; redoStack.length = 0; }, docOf(nodes, edges)); await page.waitForTimeout(40); },
    xy: (x, y) => page.evaluate(([x, y]) => { const r = cv.getBoundingClientRect(); return { cx: r.left + viewX + x * viewZoom, cy: r.top + viewY + y * viewZoom }; }, [x, y]),
    st: () => page.evaluate(() => { const L = (id) => { const n = nodeById(id); if (n) return n.label; const e = edgeById(id); return e ? "conexión " + L(e.from) + "→" + L(e.to) : "#" + id; };
      const a = document.activeElement; return { sel: [...selN].map(L).concat([...selE].map(L)).join(","), edges: P().edges.length, undo: undoStack.length, focus: a && a !== document.body ? a.id || a.tagName : "body" }; }),
    async click(x, y, o = {}) { const { cx, cy } = await ed.xy(x, y); await page.mouse.move(cx - 25, cy - 25); await page.mouse.move(cx, cy, { steps: 4 }); if (o.shift) await page.keyboard.down("Shift"); await page.mouse.down(); await page.mouse.up(); if (o.shift) await page.keyboard.up("Shift"); await page.waitForTimeout(20); return ed.st(); },
    async drag(x, y, dx, dy) { const { cx, cy } = await ed.xy(x, y); await page.mouse.move(cx - 20, cy - 20); await page.mouse.move(cx, cy, { steps: 3 }); await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(20); },
    async tap(x, y) { const { cx, cy } = await ed.xy(x, y); await page.touchscreen.tap(cx, cy); await page.waitForTimeout(40); return ed.st(); },
    node: (id) => page.evaluate((id) => { const n = nodeById(id); return n ? JSON.parse(JSON.stringify(n)) : null; }, id),
  };
  return ed;
}

/* ── §4.2 con clics reales ── */
const CASES = [
  ["A conexión dentro de GCP (mitad)", [GCP(), A, B], [E(10, 2, 3)], [500, 300], "conexión A→B", true],
  ["A′ conexión dentro de GCP, a 20 px de A (puerto)", [GCP(), A, B], [E(10, 2, 3)], [410, 300], "conexión A→B", true],
  ["B nodo dentro de GCP", [GCP(), A, B], [E(10, 2, 3)], [330, 300], "A", false],
  ["B′ nodo con GCP encima en Z", [A, B, GCP()], [E(10, 2, 3)], [330, 300], "A", true],
  ["C vacío dentro de GCP (D3)", [GCP(), A, B], [E(10, 2, 3)], [500, 200], "GCP", false],
  ["D borde de GCP (D3)", [GCP(), A, B], [E(10, 2, 3)], [500, 141], "GCP", false],
  ["F conexión X→Y que cruza GCP", [GCP(), N(2, 330, 420, 120, 60, "A"), X, Y], [E(10, 5, 6)], [500, 300], "conexión X→Y", true],
  ["F′ conexión que cruza una caja sin hijos", [N(1, 500, 300, 200, 160, "Caja"), X, Y], [E(10, 5, 6)], [500, 300], "Caja", false],
  ["G conexión entre hijos (B→C)", [GCP(), A, B, C], [E(11, 3, 4)], [585, 385], "conexión B→C", true],
  ["H X→A, tramo dentro de GCP", [GCP(), A, B, X], [E(13, 5, 2)], [220, 300], "conexión X→A", true],
  ["H′ X→A, tramo fuera de GCP", [GCP(), A, B, X], [E(13, 5, 2)], [140, 300], "conexión X→A", false],
  ["N vacío de GCP dentro de Región", [REGION, GCP(), A, B], [E(10, 2, 3)], [500, 200], "GCP", false],
  ["N‴ el mismo con Región ENCIMA en Z", [GCP(), A, B, REGION], [E(10, 2, 3)], [500, 200], "GCP", true],
  ["N″ conexión dentro del anidado", [REGION, GCP(), A, B], [E(10, 2, 3)], [500, 300], "conexión A→B", true],
];

async function suite(browser, base, label, fixed) {
  console.log(`\n══ ${label} ══`);
  const ed = await editor(browser, base), pg = ed.page;
  const expect = (bugInBase, cond, msg) => { if (fixed) check(cond, msg); else if (bugInBase) check(!cond, "BASE reproduce el bug: " + msg); };

  console.log("── D1 · tabla de la tarea (clic real; sin conexiones nuevas)");
  for (const [name, nodes, edges, [x, y], want, bugInBase] of CASES) {
    await ed.load(nodes, edges); const s0 = await ed.st();
    const s = await ed.click(x, y);
    expect(bugInBase, s.sel === want && s.edges === s0.edges && s.undo === 0, `${name} → ${want} (sel=${s.sel || "∅"}, conexiones ${s0.edges}→${s.edges})`);
  }
  if (fixed) {
    await ed.load([GCP(), A, B], [E(10, 2, 3)]);
    const s = await ed.click(500, 60); check(s.sel === "" && s.edges === 1, "fuera de todo: nada seleccionado");
  }

  console.log("── D1 · Z invertido: arrastrar un hijo lo mueve a él (no a la caja)");
  await ed.load([A, B, C, GCP()], [E(10, 2, 3)]);
  await ed.drag(330, 300, 40, 30);
  { const a = await ed.node(2), g = await ed.node(1); expect(true, a.x === 370 && a.y === 330 && g.x === 500 && g.y === 350, `A movido (${a.x},${a.y}); GCP quieto (${g.x},${g.y})`); }

  console.log("── D1 · doble clic sobre una conexión interna edita la conexión");
  await ed.load([GCP(), A, B], [E(10, 2, 3)]);
  { const { cx, cy } = await ed.xy(500, 300); await pg.mouse.dblclick(cx, cy); await pg.waitForTimeout(40);
    const ed1 = await pg.evaluate(() => editing ? (P().edges.includes(editing) ? "conexión " + editing.id : "nodo " + editing.label) : null);
    expect(true, ed1 === "conexión 10", "doble clic → " + ed1); await pg.keyboard.press("Escape"); }

  console.log("── D1 · Historias: un evento de conexión sobre una conexión interna la toma como destino");
  await ed.load([GCP(), A, B], [E(10, 2, 3)]);
  { /* se sustituye solo la búsqueda del tipo de evento (no hay biblioteca en el fixture); la decisión de acierto es la del producto */
    const r = await pg.evaluate(() => { const real = window.eventTypeById; window.eventTypeById = () => ({ primitive: "FLOW" });
      try { return { edge: scFindDropTargets("edge", 500, 300, 999), leaf: scFindDropTargets("edge", 330, 300, 999) }; } finally { window.eventTypeById = real; } });
    expect(true, JSON.stringify(r.edge) === "[10]" && JSON.stringify(r.leaf) === "[]", `destinos: sobre A→B ${JSON.stringify(r.edge)}; sobre la hoja A ${JSON.stringify(r.leaf)}`); }

  console.log("── D2 · un clic en la zona de un puerto nunca crea una conexión");
  await ed.load([GCP(), A, B], []);
  { const s = await ed.click(410, 300); expect(true, s.edges === 0 && s.undo === 0 && s.sel === "GCP", `dentro de GCP, junto a A, sin conexiones: selecciona GCP (sel=${s.sel}, conexiones=${s.edges})`); }
  await ed.load([GCP(), N(2, 400, 300, 120, 60, "A"), N(3, 540, 300, 120, 60, "B")], []);
  { const s = await ed.click(488, 300); expect(true, s.edges === 0 && s.sel === "B", `puerto de A sobre el borde de B: selecciona B, sin conexión (sel=${s.sel}, conexiones=${s.edges})`); }
  if (fixed) {
    await ed.load([GCP(), A, B, X], [E(10, 2, 3), E(13, 5, 2)]);
    await ed.click(140, 300);
    const s = await ed.click(410, 300, { shift: true });
    check(s.sel === "conexión X→A,conexión A→B" && s.edges === 2, "Mayús+clic en la zona del puerto suma la conexión de debajo (" + s.sel + ")");
    await ed.load([A, B], [E(10, 2, 3)]);
    await ed.click(670, 300);
    const s2 = await ed.click(410, 300);
    check(s2.sel === "conexión A→B" && s2.edges === 1, "sin contenedor, clic en el puerto de A sobre A→B: selecciona la conexión (" + s2.sel + ")");
    await ed.load([A, B], []);
    await ed.click(500, 200);
    const s3 = await ed.click(410, 300);
    check(s3.sel === "" && s3.edges === 0, "clic en el puerto sobre el vacío: vacía la selección, no conecta");
    console.log("── D2 · arrastrar desde el puerto sigue conectando (una conexión, una entrada de Undo)");
    for (const [name, nodes] of [["sin contenedor", [A, B]], ["dentro de GCP", [GCP(), A, B]], ["GCP encima en Z", [A, B, GCP()]]]) {
      await ed.load(nodes, []);
      const port = await pg.evaluate(() => connectPortPoint(nodeById(2), "e", viewZoom));
      const a = await ed.xy(330, 300), p = await ed.xy(port.x, port.y), b = await ed.xy(650, 300);
      await pg.mouse.move(a.cx, a.cy); await pg.mouse.move(p.cx, p.cy, { steps: 4 }); await pg.mouse.down(); await pg.mouse.move(b.cx, b.cy, { steps: 10 }); await pg.mouse.up(); await pg.waitForTimeout(20);
      const s = await ed.st(); const es = await pg.evaluate(() => P().edges.map((e) => e.from + "→" + e.to).join(","));
      check(es === "2→3" && s.undo === 1 && s.sel === "conexión A→B", `${name}: arrastre A→B crea ${es} (Undo ${s.undo}, sel ${s.sel})`);
    }
    await ed.load([A, B], []);
    { const port = await pg.evaluate(() => connectPortPoint(nodeById(2), "e", viewZoom)); const p = await ed.xy(port.x, port.y), a = await ed.xy(330, 300);
      await pg.mouse.move(a.cx, a.cy); await pg.mouse.move(p.cx, p.cy, { steps: 3 }); await pg.mouse.down(); await pg.mouse.move(p.cx + 2, p.cy + 1); await pg.mouse.up();
      const s = await ed.st(); check(s.edges === 0, "un temblor de 2 px no arranca la conexión"); }
    await ed.load([A, B], []);
    { const port = await pg.evaluate(() => connectPortPoint(nodeById(2), "e", viewZoom)); const p = await ed.xy(port.x, port.y), a = await ed.xy(330, 300), b = await ed.xy(650, 300);
      await pg.mouse.move(a.cx, a.cy); await pg.mouse.move(p.cx, p.cy, { steps: 3 }); await pg.mouse.down(); await pg.keyboard.press("Escape"); await pg.mouse.move(b.cx, b.cy, { steps: 6 }); await pg.mouse.up();
      const s = await ed.st(); check(s.edges === 0, "Escape antes de moverse anula el puerto"); }
  }

  if (fixed) {
    console.log("── D3 · el vacío de un contenedor lo arrastra (los hijos se quedan)");
    await ed.load([GCP(), A, B], [E(10, 2, 3)]);
    await ed.drag(500, 200, 30, 20);
    { const g = await ed.node(1), a = await ed.node(2); check(g.x === 530 && g.y === 370 && a.x === 330 && a.y === 300, `GCP (${g.x},${g.y}); A quieto (${a.x},${a.y})`); }

    console.log("── D4 · con una conexión seleccionada, su extremo gana junto al ancla (dentro del nodo)");
    await ed.load([GCP(), A, B, X], [E(13, 5, 2)]);
    await ed.click(140, 300);                                         // X→A
    await ed.drag(273, 300, 30, 20);                                  // A, a 3 u de su borde oeste (ancla de X→A)
    { const a = await ed.node(2), s = await ed.st(); check(a.x === 330 && a.y === 300 && s.sel === "conexión X→A", "A no se mueve: es el extremo de X→A (D4 = como hoy)"); }
    await ed.drag(670, 300, 10, 0);                                   // seleccionar/mover otra pieza
    await ed.drag(273, 300, 30, 20);
    { const a = await ed.node(2); check(a.x === 360 && a.y === 320, `tras cambiar la selección, el mismo punto arrastra A (${a.x},${a.y})`); }

    console.log("── D7 · foco del panel: un clic en el lienzo lo suelta antes de cambiar la selección");
    const FX = () => [[N(2, 330, 300, 120, 60, "A", { fs: 18 }), N(3, 670, 300, 120, 60, "B", { fs: 18 }), N(8, 330, 520, 120, 60, "Z", { fs: 18 }), X], [E(13, 5, 2)]];
    for (const [kind, sel] of [["nodo", [330, 300]], ["conexión", [140, 300]]]) {
      await ed.load(...FX()); await ed.click(...sel);
      await pg.evaluate(() => document.querySelectorAll("aside details.pgroup").forEach((d) => { d.open = true; }));
      const fields = await pg.evaluate(() => [...document.querySelectorAll("aside input, aside textarea")].filter((el) => el.offsetParent !== null && el.id && !el.id.startsWith("sc") && el.type !== "color").map((el) => el.id));
      check(fields.length >= 3, `${kind}: ${fields.length} campos visibles (${fields.join(" ")})`);
      for (const id of fields) {
        for (const key of ["Delete", "Backspace"]) {
          await ed.load(...FX()); await ed.click(...sel);
          await pg.evaluate(() => document.querySelectorAll("aside details.pgroup").forEach((d) => { d.open = true; }));
          await pg.focus("#" + id);
          const before = await ed.node(3);
          const s = await ed.click(670, 300);
          await pg.keyboard.press(key); await pg.waitForTimeout(20);
          const after = await ed.node(3);
          check(s.focus === "body" && after === null, `${kind} · #${id} → clic en B → foco ${s.focus}; ${key} borra B${after && JSON.stringify(after) !== JSON.stringify(before) ? " (¡y lo modificó!)" : ""}`);
        }
      }
    }
    console.log("── D7 · un change pendiente se aplica al objeto ANTERIOR, con una entrada de Undo");
    await ed.load(...FX()); await ed.click(330, 300);
    await pg.evaluate(() => { document.getElementById("grpLayers").open = true; });
    await pg.click("#orderIn"); await pg.keyboard.press("Control+a"); await pg.keyboard.type("7");
    { const s = await ed.click(670, 300); const a = await ed.node(2), b = await ed.node(3);
      check(a.order === 7 && b.order !== 7 && s.undo === 1 && s.sel === "B" && s.focus === "body", `Orden 7 → A (A.order=${a.order}, B.order=${b.order}, Undo ${s.undo}, sel ${s.sel})`); }
    console.log("── D7 · cerrar la edición en el lienzo suelta el foco en el mismo fotograma");
    await ed.load(...FX());
    { const { cx, cy } = await ed.xy(330, 300); await pg.mouse.dblclick(cx, cy); await pg.keyboard.type("x");
      const b = await ed.xy(670, 300); await pg.mouse.move(b.cx, b.cy, { steps: 2 }); await pg.mouse.down(); await pg.mouse.up(); await pg.keyboard.press("Delete");
      const gone = (await ed.node(3)) === null, a = await ed.node(2); check(gone && a.label === "x", `etiqueta de A = «${a.label}»; Supr inmediato borra B`); }
  }
  if (!fixed) {
    console.log("── D7 en la base");
    await ed.load([A, B], []); await ed.click(330, 300); await pg.focus("#lblEdit");
    const s = await ed.click(670, 300); await pg.keyboard.press("Backspace"); const b = await ed.node(3);
    check(s.focus === "lblEdit" && b && b.label === "", "BASE reproduce el bug: foco en #lblEdit tras el clic y Retroceso vacía la etiqueta de B");
  }
  check(ed.errors.length === 0, "0 errores de página" + (ed.errors.length ? ": " + ed.errors.join(" | ") : ""));
  await ed.ctx.close();
}

async function touchSuite(browser, base) {
  console.log("\n══ D7 con el dedo (árbol) ══");
  const ed = await editor(browser, base, { touch: true }), pg = ed.page;
  const FX = () => [[N(2, 330, 300, 120, 60, "A", { fs: 18 }), N(3, 670, 300, 120, 60, "B", { fs: 18 })], []];
  for (const id of ["lblEdit", "fsIn", "boldChk"]) {
    for (const key of ["Delete", "Backspace"]) {
      await ed.load(...FX()); await ed.tap(330, 300); await pg.focus("#" + id);
      const s = await ed.tap(670, 300); await pg.keyboard.press(key); await pg.waitForTimeout(20);
      check(s.focus === "body" && (await ed.node(3)) === null, `dedo · #${id} → toque en B → foco ${s.focus}; ${key} borra B`);
    }
  }
  check(ed.errors.length === 0, "0 errores de página");
  await ed.ctx.close();
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: !process.env.HEADED });
  const now = await serve(root);
  let old = null, oldDir = null;
  try {
    await suite(browser, now.base, "árbol de trabajo", true);
    await touchSuite(browser, now.base);
    if (!process.env.SKIP_BASE) { oldDir = treeAt(BASE); old = await serve(oldDir); await suite(browser, old.base, "base " + BASE + " (debe reproducir el bug)", false); }
  } finally { await browser.close(); now.server.close(); if (old) old.server.close(); if (oldDir) fs.rmSync(oldDir, { recursive: true, force: true }); }
  console.log(`\n${passed} OK, ${failed} fallos (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
