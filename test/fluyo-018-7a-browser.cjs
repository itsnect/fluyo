"use strict";
/* FLUYO-018.7a — QA en Chrome REAL: ratón, teclado, <select>, diálogos y portapapeles reales de Playwright sobre el editor.
   018.7a: F1 (borrar página vacía Undo/Redo), set_theme (themeSel/bgCustom → setThemeIn), orden Z (reorderNodesIn) y duplicate_node (Ctrl+D/menú → duplicateNodesIn).
   El mismo guion se ejecuta contra el árbol de trabajo y contra HEAD (git → carpeta temporal): los documentos de Z, duplicar y tema deben COINCIDIR (HEAD es el
   oráculo del comportamiento previo); solo difieren, por diseño: F1 (HEAD corrompe), «sin cambio ⇒ sin Undo» del orden Z y que Ctrl+D ya no pisa el portapapeles.
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-018-7a-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-7a-"));
fs.mkdirSync(shots, { recursive: true });
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

const serve = async (dir) => {
  const server = http.createServer((req, res) => {
    try {
      let rel = new URL("http://x" + req.url).pathname; if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(dir, "." + decodeURIComponent(rel)); assert.ok(file.startsWith(dir + path.sep));
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: "http://127.0.0.1:" + server.address().port };
};
/* Oráculo = el estado PREVIO a 018.7a. Mientras 018.7a no estaba commiteado era HEAD; desde 018.7c (con 018.7a ya en HEAD) es su
   commit base e86c7c4. FLUYO_HEAD_REF permite elegir otro. */
const ORACLE_REF = process.env.FLUYO_HEAD_REF || "e86c7c4";
function headTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-"));
  const files = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", ORACLE_REF], { encoding: "utf8" }).split("\n").filter((f) => /^(index\.html|js\/|css\/|s\/|assets\/|manifest\.webmanifest)/.test(f));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), execFileSync("git", ["-C", root, "show", ORACLE_REF + ":" + f], { maxBuffer: 64 * 1024 * 1024 }));
  }
  return dir;
}

/* Documento de trabajo: A,B,C,D (ids 1-4), conexiones 5 (A→B con waypoints), 6 (B→C), 7 (C→D), 8 (A→D); B y D «No disponible»; Historia sobre la conexión 6. */
const SETUP = () => {
  doc.pages.length = 1; doc.cur = 0; P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = []; P().name = "Página 1"; doc.theme = "dark"; doc.customBg = "";
  undoStack.length = 0; redoStack.length = 0; scReset(); clearSel(); P().nextId = 1; P().nextScenarioId = 1;   // 018.7c: la página que queda puede ser una reinsertada por Undo
  const a = newNode("rect", 200, 200, { label: "A" }), b = newNode("rect", 520, 200, { label: "B" }), c = newNode("rect", 840, 200, { label: "C" }), d = newNode("rect", 1160, 200, { label: "D" });
  const e5 = newEdge(a.id, b.id, { waypoints: [{ x: 360, y: 140 }, { x: 360, y: 260 }], label: "uno" }); newEdge(b.id, c.id); newEdge(c.id, d.id); newEdge(a.id, d.id);
  setInitialAvailability(P(), b.id, "DOWN"); setInitialAvailability(P(), d.id, "DOWN");
  const et = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
  const sc = createScenario(P(), "Compra"); createStep(sc, { at: 0, action: "SEND", edgeId: 6, eventTypeId: et.id });
  viewX = 0; viewY = 0; viewZoom = 0.8; renderTabs(); scSelectStory(sc.id);
};

async function script(browser, base, label) {
  const errors = [], dialogs = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const ed = await ctx.newPage();
  ed.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message));
  ed.on("console", (m) => { if (m.type() === "error") errors.push(label + " console: " + m.text()); });
  let confirmAnswer = true;
  ed.on("dialog", (d) => { dialogs.push({ type: d.type(), message: d.message() }); if (d.type() === "confirm" && !confirmAnswer) d.dismiss(); else d.accept(); });
  const open = async () => { await ed.goto(base + "/"); await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined"); if (await ed.locator("#autosaveModal").isVisible()) await ed.locator("#autosaveDiscard").click(); };
  await open();
  const reset = async () => { await ed.evaluate(`(${SETUP.toString()})()`); await ed.locator("#tabProperties").click(); };
  await reset();
  const R = {};
  const docs = {};
  const json = () => ed.evaluate(() => JSON.stringify(serializeProject()));
  const order = () => ed.evaluate(() => P().nodes.map((n) => n.id));
  const stacks = () => ed.evaluate(() => ({ u: undoStack.length, r: redoStack.length }));
  const sel = () => ed.evaluate(() => ({ n: [...selN].sort((a, b) => a - b), e: [...selE].sort((a, b) => a - b) }));
  const pt = (id) => ed.evaluate((id) => { const n = P().nodes.find((x) => x.id === id), r = cv.getBoundingClientRect(); return { x: r.left + n.x * viewZoom + viewX, y: r.top + n.y * viewZoom + viewY }; }, id);
  const clickNode = async (id, shift = false) => { const p = await pt(id); if (shift) await ed.keyboard.down("Shift"); await ed.mouse.click(p.x, p.y); if (shift) await ed.keyboard.up("Shift"); };
  const marquee = async (x0, y0, x1, y1) => {
    const r = await ed.evaluate(() => { const b = cv.getBoundingClientRect(); return { l: b.left, t: b.top, z: viewZoom, vx: viewX, vy: viewY }; });
    const c = (x, y) => ({ x: r.l + x * r.z + r.vx, y: r.t + y * r.z + r.vy });
    const a = c(x0, y0), b = c(x1, y1);
    await ed.mouse.move(a.x, a.y); await ed.mouse.down(); await ed.mouse.move(b.x, b.y, { steps: 6 }); await ed.mouse.up();
  };
  const bg = () => ed.evaluate(() => { const d = cv.getContext("2d").getImageData(4, 4, 1, 1).data; return [d[0], d[1], d[2]]; });
  const frame = () => ed.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  /* ═══ F1: A/B/C, borrar la primera página, Undo/Redo ═══ */
  const f1 = async () => {
    await ed.evaluate(() => {
      doc.pages.length = 1; doc.cur = 0; undoStack.length = 0; redoStack.length = 0;
      P().nodes = []; P().edges = []; P().behaviors = []; P().scenarios = []; P().nextId = 1; P().name = "A"; newNode("rect", 300, 300, { label: "a0" });
      for (const n of ["B", "C"]) { addPage(); P().name = n; newNode("rect", 300, 300, { label: n.toLowerCase() + "0" }); }
      doc.cur = 0; clearSel(); renderTabs(); undoStack.length = 0; redoStack.length = 0;
    });
    const labels = () => ed.evaluate(() => doc.pages.map((p) => p.name + ":" + p.nodes.map((n) => n.label).join("|")));
    await ed.locator("#pagesBar .tab").nth(1).click();                 // B
    await ed.locator('button[data-shape="circle"]').click();
    const p = await ed.evaluate(() => { const r = cv.getBoundingClientRect(); return { x: r.left + 600 * viewZoom + viewX, y: r.top + 500 * viewZoom + viewY }; });
    await ed.mouse.click(p.x, p.y);                                      // edición real en B: pushUndo con pi=1
    const afterEdit = await labels();
    await ed.locator("#pagesBar .tab").nth(0).locator(".x").click();    // borrar A (confirm real)
    const afterDelete = await labels();
    const stacksAfterDelete = await stacks();
    await ed.keyboard.press("Control+z"); await ed.waitForTimeout(80);
    const afterUndo = await labels();
    await ed.keyboard.press("Control+y"); await ed.waitForTimeout(80);
    const afterRedo = await labels();
    await ed.keyboard.press("Control+z"); await ed.waitForTimeout(80);
    // una edición posterior vuelve a ser deshacible
    await ed.locator("#pagesBar .tab").nth(1).click();
    await ed.locator('button[data-shape="rect"]').click();
    const q = await ed.evaluate(() => { const r = cv.getBoundingClientRect(); return { x: r.left + 900 * viewZoom + viewX, y: r.top + 300 * viewZoom + viewY }; });
    await ed.mouse.click(q.x, q.y);
    const nodesBefore = await ed.evaluate(() => P().nodes.length);
    await ed.keyboard.press("Control+z"); await ed.waitForTimeout(80);
    const nodesAfterUndo = await ed.evaluate(() => P().nodes.length);
    await ed.screenshot({ path: path.join(shots, label + "-f1.png") });
    return { afterEdit, afterDelete, stacksAfterDelete, afterUndo, afterRedo, later: { nodesBefore, nodesAfterUndo }, pageCount: await ed.evaluate(() => doc.pages.length) };
  };
  R.f1 = await f1();
  await reset();

  /* ═══ Orden Z ═══ */
  const z = {};
  const btn = (id) => ed.locator("#" + id);
  z.initial = await order();
  await clickNode(2); if (process.env.DBG) console.log("DBG", JSON.stringify(await sel()), await ed.evaluate(() => [getComputedStyle(document.getElementById("rowZ")).display, document.body.className, document.getElementById("tabProperties").className, doc.pages.length, doc.cur, JSON.stringify(P().nodes.map((n) => [n.id, n.label, n.x, n.y]))]), await pt(2));
  await btn("btnFront").click(); z.front2 = await order(); docs.zFront = await json();
  await btn("btnBack").click(); z.back2 = await order();
  await btn("btnForward").click(); z.fwd2 = await order();
  await btn("btnBackward").click(); z.bwd2 = await order();
  docs.zSingle = await json();
  // selección múltiple con Mayús+clic: 1 y 3 al frente; luego subir
  await clickNode(1); await clickNode(3, true); z.multiSel = (await sel()).n;
  z.multiHasButtons = await btn("btnFront").isVisible();                // el panel de selección múltiple NO ofrece botones de orden (ni en HEAD)
  await ed.evaluate(() => bringToFront()); z.multiFront = await order();
  await ed.evaluate(() => sendBackward()); z.multiBackward = await order();
  await ed.evaluate(() => bringForward()); z.multiForward = await order();
  docs.zMulti = await json();
  // selección por marco: B,C
  await ed.evaluate(() => { clearSel(); }); await marquee(420, 120, 940, 300); z.marquee = (await sel()).n;
  await ed.evaluate(() => sendToBack()); z.marqueeBack = await order();
  docs.zMarquee = await json();
  // no-op: lo que ya está al frente / al fondo
  await ed.evaluate(() => { undoStack.length = 0; redoStack.length = 0; });
  const clearStacks = () => ed.evaluate(() => { undoStack.length = 0; redoStack.length = 0; });
  const topId = (await order()).at(-1); await clickNode(topId); await clearStacks();    // el clic sobre un nodo ya registra Undo (inicio de arrastre)
  await btn("btnFront").click(); z.noopFront = { order: await order(), stacks: await stacks() };
  const backId = (await order())[0]; await clickNode(backId); await clearStacks();
  await btn("btnBack").click(); z.noopBack = { order: await order(), stacks: await stacks() };
  // Undo/Redo de una acción real
  await ed.evaluate(() => { undoStack.length = 0; redoStack.length = 0; });
  await clickNode(2); const beforeZ = await order(); await btn("btnFront").click(); const afterZ = await order();
  await ed.keyboard.press("Control+z"); await ed.waitForTimeout(60); z.undo = await order();
  await ed.keyboard.press("Control+y"); await ed.waitForTimeout(60); z.redo = await order();
  z.undoOk = JSON.stringify(z.undo) === JSON.stringify(beforeZ) && JSON.stringify(z.redo) === JSON.stringify(afterZ);
  // el campo order (animación build) no cambia
  z.orderField = await ed.evaluate(() => Object.fromEntries(P().nodes.map((n) => [n.id, n.order])));
  // las conexiones se dibujan SIEMPRE antes que los nodos, sea cual sea el orden Z; los nodos, en el orden del array
  z.draw = await ed.evaluate(async () => {
    const log = []; const oe = window.drawEdge, on = window.drawNode;
    window.drawEdge = function (c, e, ...r) { log.push("e" + e.id); return oe.call(this, c, e, ...r); };
    window.drawNode = function (c, n, ...r) { log.push("n" + n.id); return on.call(this, c, n, ...r); };
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.drawEdge = oe; window.drawNode = on;
    const last = log.slice(-(P().nodes.length + P().edges.length));
    return { log: last, nodeOrder: P().nodes.map((n) => "n" + n.id) };
  });
  z.edgesFirst = (() => { const l = z.draw.log; const lastEdge = Math.max(...l.map((x, i) => (x[0] === "e" ? i : -1))); const firstNode = l.findIndex((x) => x[0] === "n"); return lastEdge < firstNode && JSON.stringify(l.filter((x) => x[0] === "n")) === JSON.stringify(z.draw.nodeOrder); })();
  // el hit-test coincide con lo pintado: dos nodos solapados, gana el de encima
  await ed.evaluate(() => { const n = newNode("rect", 520, 200, { label: "S" }); n.w = 100; n.h = 60; });
  const topAt = async () => { const p = await pt(2); await ed.mouse.click(p.x, p.y); return (await sel()).n[0]; };
  z.hitBefore = await topAt();                                          // el nuevo (id 9) está encima de B
  await clickNode(9); await btn("btnBack").click();
  z.hitAfter = await topAt();
  z.hitOk = z.hitBefore === 9 && z.hitAfter !== 9;
  await ed.screenshot({ path: path.join(shots, label + "-z.png") });
  R.z = z;
  await reset();

  /* Playback activo / completado: no hay ruta de orden Z */
  const pb = {};
  await clickNode(2);
  await ed.locator("#tabScenarios").click();
  await ed.locator("#scRun").click();
  await ed.waitForFunction(() => scStatus === "running", null, { timeout: 5000 });
  pb.running = { visible: await Promise.all(["btnFront", "btnBack", "btnForward", "btnBackward"].map((id) => btn(id).isVisible())) };
  await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 });
  pb.completed = { visible: await Promise.all(["btnFront", "btnBack", "btnForward", "btnBackward"].map((id) => btn(id).isVisible())), order: await order() };
  await ed.locator("#scReset").click(); await ed.waitForFunction(() => scStatus === "idle");
  R.pb = pb;
  await reset();

  /* ═══ set_theme ═══ */
  const th = {};
  th.pixels = {};
  for (const t of ["crema", "claro", "dark"]) {
    await ed.locator("#themeSel").selectOption(t); await frame();
    th.pixels[t] = { theme: await ed.evaluate(() => doc.theme), bg: await bg() };
  }
  docs.themeDark = await json();
  await ed.locator("#themeSel").selectOption("crema"); await frame();
  // customBg válido (el selector de color no se puede abrir: se dispara el mismo evento input)
  await ed.evaluate(() => { const i = document.getElementById("bgCustom"); i.value = "#336699"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  await frame(); th.customBg = { value: await ed.evaluate(() => doc.customBg), bg: await bg() };
  docs.themeCustom = await json();
  // «valor inválido»: el control de color lo sanea; el documento nunca recibe basura
  await ed.evaluate(() => { const i = document.getElementById("bgCustom"); i.value = "not-a-color"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  th.sanitized = await ed.evaluate(() => doc.customBg);
  th.noUndo = await stacks();
  // persistencia: autoguardado + recarga + restaurar
  await ed.evaluate(() => { const i = document.getElementById("bgCustom"); i.value = "#336699"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  await ed.waitForTimeout(900);
  await ed.reload(); await ed.waitForFunction(() => typeof newNode === "function");
  await ed.locator("#autosaveRestore").click();
  await ed.waitForFunction(() => doc.theme === "crema");
  th.persisted = await ed.evaluate(() => ({ theme: doc.theme, customBg: doc.customBg, select: document.getElementById("themeSel").value }));
  // documento con customBg no válido abierto desde archivo: no revienta, se conserva y se puede limpiar
  const bad = await ed.evaluate(() => { const s = JSON.parse(JSON.stringify(serializeProject())); s.doc.customBg = "not-a-color"; s.doc.theme = "claro"; return JSON.stringify(s); });
  await ed.locator("#fileIn").setInputFiles({ name: "x.fluyo.json", mimeType: "application/json", buffer: Buffer.from(bad) });
  await ed.waitForFunction(() => doc.customBg === "not-a-color", null, { timeout: 5000 });
  await frame(); th.invalidOpened = { theme: await ed.evaluate(() => doc.theme), customBg: await ed.evaluate(() => doc.customBg) };
  await ed.locator("#btnBgClear").click(); th.cleared = await ed.evaluate(() => doc.customBg);
  // Share/Viewer con tema y fondo
  await ed.locator("#themeSel").selectOption("crema");
  await ed.evaluate(() => { const i = document.getElementById("bgCustom"); i.value = "#336699"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  await ed.evaluate(() => { scReset(); });
  await ed.locator("#btnShare").click(); await ed.locator("#shareCreate").click();
  await ed.waitForFunction(() => document.getElementById("shareLink").value.includes("/s/#d="), null, { timeout: 8000 });
  const link1 = await ed.locator("#shareLink").inputValue(); await ed.locator("#shareClose").click();
  const v1 = await ctx.newPage();
  v1.on("pageerror", (e) => errors.push(label + " viewer pageerror: " + e.message));
  await v1.goto(link1); await v1.waitForFunction(() => typeof doc !== "undefined" && doc.pages && doc.pages[0].nodes.length > 0, null, { timeout: 10000 });
  th.viewer = await v1.evaluate(() => ({ theme: doc.theme, customBg: doc.customBg }));
  await v1.screenshot({ path: path.join(shots, label + "-viewer-theme.png") }); await v1.close();
  R.th = th;
  await open(); await ed.evaluate(() => {}); await reset();

  /* ═══ duplicate_node (Ctrl+D y menú) ═══ */
  const du = {};
  await ed.evaluate(() => navigator.clipboard.writeText("antes"));
  await clickNode(2); await ed.evaluate(() => { undoStack.length = 0; redoStack.length = 0; }); await ed.keyboard.press("Control+d"); await ed.waitForTimeout(60);
  du.single = { order: await order(), sel: await sel(), stacks: await stacks(), node: await ed.evaluate(() => { const n = P().nodes.at(-1); return [n.id, n.x, n.y, n.order, n.label]; }), behaviors: await ed.evaluate(() => P().behaviors.map((b) => [b.nodeId, b.initialState])), edges: await ed.evaluate(() => P().edges.length) };
  du.clipboard = await ed.evaluate(() => navigator.clipboard.readText());
  docs.dupSingle = await json();
  await ed.keyboard.press("Control+z"); await ed.waitForTimeout(60);
  du.afterUndo = { order: await order(), edges: await ed.evaluate(() => P().edges.length), behaviors: await ed.evaluate(() => P().behaviors.length), nextId: await ed.evaluate(() => P().nextId), stacks: await stacks() };
  await ed.keyboard.press("Control+y"); await ed.waitForTimeout(60);
  du.afterRedo = await json(); du.redoOk = du.afterRedo === docs.dupSingle;
  await reset();
  // varios nodos por marco (A,B,C): conexiones internas sí (5, 6), externas no (7, 8); waypoints; Behavior de B
  await marquee(100, 100, 960, 300); du.marquee = await sel();
  await ed.keyboard.press("Control+d"); await ed.waitForTimeout(60);
  du.multi = await ed.evaluate(() => ({
    nodes: P().nodes.map((n) => [n.id, n.x, n.y, n.order]), edges: P().edges.map((e) => [e.id, e.from, e.to, e.waypoints.map((w) => [w.x, w.y])]),
    behaviors: P().behaviors.map((b) => [b.nodeId, b.initialState]), nextId: P().nextId, scenarios: JSON.stringify(P().scenarios),
  }));
  du.multiSel = await sel(); du.multiStacks = await stacks(); docs.dupMulti = await json();
  du.trace = await ed.evaluate(() => JSON.stringify(FluyoStory.run(P(), P().scenarios[0]).trace));
  // segundo duplicado seguido (sobre la selección nueva) y un único Undo por duplicado
  await ed.keyboard.press("Control+d"); await ed.waitForTimeout(60);
  du.twice = { nodes: await ed.evaluate(() => P().nodes.length), stacks: await stacks() }; docs.dupTwice = await json();
  await ed.keyboard.press("Control+z"); await ed.waitForTimeout(60); du.undo1 = await ed.evaluate(() => P().nodes.length);
  await ed.keyboard.press("Control+z"); await ed.waitForTimeout(60); du.undo2 = await ed.evaluate(() => P().nodes.length);
  await ed.keyboard.press("Control+y"); await ed.waitForTimeout(60); await ed.keyboard.press("Control+y"); await ed.waitForTimeout(60);
  du.redo2 = await ed.evaluate(() => P().nodes.length);
  // botón «Duplicar» del menú de selección múltiple
  await reset(); await marquee(100, 100, 960, 300);
  du.menuVisible = await ed.locator("#mDup").isVisible();
  if (du.menuVisible) { await ed.locator("#mDup").click(); await ed.waitForTimeout(60); }
  du.menuNodes = await ed.evaluate(() => P().nodes.length); docs.dupMenu = await json();
  // Ctrl+C / Ctrl+V sigue funcionando (mismo dominio) y Ctrl+D no toca el clip
  await reset(); await clickNode(1); await ed.keyboard.press("Control+c"); await clickNode(3); await ed.keyboard.press("Control+d"); await ed.waitForTimeout(60);
  await ed.keyboard.press("Control+v"); await ed.waitForTimeout(400);
  du.pasteAfterDup = await ed.evaluate(() => P().nodes.map((n) => n.label));
  docs.pasteAfterDup = await json();
  // Playback: Ctrl+D no hace nada
  await reset(); await clickNode(2); await ed.locator("#tabScenarios").click(); await ed.locator("#scRun").click();
  await ed.waitForFunction(() => scStatus === "running"); await ed.keyboard.press("Control+d"); du.duringPlayback = await ed.evaluate(() => P().nodes.length);
  await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 }); await ed.keyboard.press("Control+d"); du.afterPlayback = await ed.evaluate(() => P().nodes.length);
  await ed.locator("#scReset").click(); await ed.waitForFunction(() => scStatus === "idle");
  // Share/Viewer con nodos duplicados y orden Z cambiado
  await reset(); await marquee(100, 100, 960, 300); await ed.keyboard.press("Control+d"); await ed.waitForTimeout(60);
  await ed.evaluate(() => sendToBack());
  const expectedOrder = await order();
  await ed.locator("#btnShare").click(); await ed.locator("#shareCreate").click();
  await ed.waitForFunction(() => document.getElementById("shareLink").value.includes("/s/#d="), null, { timeout: 8000 });
  const link2 = await ed.locator("#shareLink").inputValue(); await ed.locator("#shareClose").click();
  const v2 = await ctx.newPage();
  v2.on("pageerror", (e) => errors.push(label + " viewer pageerror: " + e.message));
  await v2.goto(link2); await v2.waitForFunction(() => typeof doc !== "undefined" && doc.pages && doc.pages[0].nodes.length > 0, null, { timeout: 10000 });
  du.viewer = await v2.evaluate(() => ({ order: doc.pages[0].nodes.map((n) => n.id), edges: doc.pages[0].edges.length, behaviors: doc.pages[0].behaviors.length }));
  du.viewerExpected = { order: expectedOrder, edges: await ed.evaluate(() => P().edges.length), behaviors: await ed.evaluate(() => P().behaviors.length) };
  await v2.screenshot({ path: path.join(shots, label + "-viewer-dup.png") }); await v2.close();
  await ed.screenshot({ path: path.join(shots, label + "-dup.png") });
  R.du = du;

  /* ═══ documentos antiguos ═══ */
  const old = { version: 3, app: "fluyo", doc: { theme: "crema", pages: [{ name: "viejo", nodes: [{ id: 1, shape: "rect", x: 300, y: 300, label: "uno" }, { id: 2, shape: "rect", x: 600, y: 300, label: "dos" }], edges: [{ id: 3, from: 1, to: 2 }], nextId: 4 }] }, settings: {} };
  await ed.locator("#fileIn").setInputFiles({ name: "old.fluyo.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)) });
  await ed.waitForFunction(() => doc.pages[0].name === "viejo", null, { timeout: 5000 });
  const od = {};
  od.opened = await ed.evaluate(() => ({ theme: doc.theme, customBg: doc.customBg, order: P().nodes.map((n) => [n.id, n.order]) }));
  await ed.evaluate(() => { viewX = 0; viewY = 0; viewZoom = 0.8; });
  await clickNode(1); await btn("btnFront").click(); od.z = await order();
  await marquee(200, 200, 700, 400); await ed.keyboard.press("Control+d"); await ed.waitForTimeout(60);
  od.dup = await ed.evaluate(() => ({ nodes: P().nodes.map((n) => [n.id, n.order]), edges: P().edges.map((e) => [e.id, e.from, e.to]) }));
  await ed.locator("#themeSel").selectOption("claro"); od.theme = await ed.evaluate(() => doc.theme);
  await ed.keyboard.press("Control+z"); await ed.waitForTimeout(60); od.undo = await ed.evaluate(() => P().nodes.length);
  R.od = od;

  await ctx.close();
  return { R, docs, errors, dialogs };
}

(async () => {
  const wt = await serve(root);
  const headDir = headTree();
  const hd = await serve(headDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  let failed = 0;
  const check = (cond, msg) => { if (cond) console.log("  ✔ " + msg); else { failed++; console.log("  ✘ " + msg); } };
  try {
    const A = await script(browser, wt.base, "wt");
    const H = await script(browser, hd.base, "head");
    const a = A.R, h = H.R;
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    console.log("\nF1 — borrar la primera página (A/B/C), Undo y Redo");
    check(same(a.f1.afterDelete, ["B:b0|", "C:c0"]) || a.f1.afterDelete.length === 2, "tras borrar A quedan B y C (" + a.f1.afterDelete.join(", ") + ")");
    const bEdit = a.f1.afterEdit[1];
    /* 018.7c: el hotfix (vaciar Undo/Redo) se sustituye por Undo por referencia: borrar es una entrada más, Undo reinserta la MISMA
       página y Redo la vuelve a quitar. La intención de la regresión se conserva: ninguna página recibe el contenido de otra. */
    check(a.f1.stacksAfterDelete.u >= 1 && a.f1.stacksAfterDelete.r === 0, "el borrado es una entrada de Undo y conserva el historial (018.7c) " + JSON.stringify(a.f1.stacksAfterDelete));
    check(same(a.f1.afterUndo, a.f1.afterEdit) && same(a.f1.afterRedo, a.f1.afterDelete), "Undo reinserta A con B y C intactas; Redo la vuelve a borrar (018.7c)");
    check(a.f1.afterDelete[1] === "C:c0" && a.f1.afterUndo[2] === "C:c0", "C conserva su contenido");
    check(a.f1.later.nodesAfterUndo === a.f1.later.nodesBefore - 1, "una edición posterior al borrado vuelve a ser deshacible");
    check(h.f1.afterUndo[1] !== "C:c0", "el oráculo previo a 018.7a reproduce el defecto: Undo escribe el contenido de B en C (" + h.f1.afterUndo.join(", ") + ")");
    console.log("\nOrden Z");
    check(same(a.z.initial, [1, 2, 3, 4]), "orden inicial 1,2,3,4");
    check(same(a.z.front2, [1, 3, 4, 2]) && same(a.z.back2, [2, 1, 3, 4]) && same(a.z.fwd2, [1, 2, 3, 4]) && same(a.z.bwd2, [2, 1, 3, 4]), "al frente / al fondo / subir / bajar con un nodo: " + JSON.stringify([a.z.front2, a.z.back2, a.z.fwd2, a.z.bwd2]));
    check(same(a.z.multiSel, [1, 3]) && same(a.z.multiFront, [2, 4, 1, 3]), "selección múltiple (Mayús+clic) al frente conserva el orden relativo: " + JSON.stringify(a.z.multiFront));
    check(same(a.z.marquee, [2, 3]) || a.z.marquee.length >= 2, "selección por marco: " + JSON.stringify(a.z.marquee) + " → al fondo " + JSON.stringify(a.z.marqueeBack));
    for (const k of ["front2", "back2", "fwd2", "bwd2", "multiFront", "multiBackward", "multiForward", "marqueeBack"]) check(same(a.z[k], h.z[k]), "paridad con HEAD: " + k + " " + JSON.stringify(a.z[k]));
    for (const k of ["zFront", "zSingle", "zMulti", "zMarquee"]) check(A.docs[k] === H.docs[k], "documento idéntico a HEAD: " + k);
    check(a.z.noopFront.stacks.u === 0 && a.z.noopBack.stacks.u === 0, "no-op (ya al frente / ya al fondo) NO crea entrada de Undo");
    check(h.z.noopFront.stacks.u === 1, "HEAD sí creaba una entrada vacía (diferencia esperada, F7)");
    check(!a.z.multiHasButtons && !h.z.multiHasButtons, "hallazgo: el panel de selección múltiple no tiene botones de orden (igual que HEAD); las acciones se ejercitan con la selección múltiple real vía las funciones del editor");
    check(a.z.undoOk, "Undo y Redo de una acción de orden restauran/reaplican el orden");
    check(same(a.z.orderField, h.z.orderField), "el campo order (animación build) no cambia: " + JSON.stringify(a.z.orderField));
    check(a.z.edgesFirst, "las conexiones se dibujan antes que todos los nodos y los nodos en el orden del array");
    check(a.z.hitOk, "el hit-test coincide con el orden pintado (el de encima gana; tras enviarlo al fondo, gana el otro)");
    check(a.pb.running.visible.every((v) => !v) && a.pb.completed.visible.every((v) => !v) && same(a.pb.completed.order, [1, 2, 3, 4]), "Playback en marcha y completado: los botones de orden no son accesibles y el orden no cambia");
    console.log("\nset_theme");
    check(a.th.pixels.crema.theme === "crema" && same(a.th.pixels.crema.bg, [244, 238, 225]), "tema crema: select y fondo del lienzo " + JSON.stringify(a.th.pixels.crema.bg));
    check(a.th.pixels.claro.theme === "claro" && same(a.th.pixels.claro.bg, [255, 255, 255]), "tema claro " + JSON.stringify(a.th.pixels.claro.bg));
    check(a.th.pixels.dark.theme === "dark" && same(a.th.pixels.dark.bg, [22, 22, 22]), "tema dark " + JSON.stringify(a.th.pixels.dark.bg));
    check(a.th.customBg.value === "#336699" && same(a.th.customBg.bg, [51, 102, 153]), "customBg válido en documento y lienzo " + JSON.stringify(a.th.customBg.bg));
    check(/^#[0-9a-f]{6}$/.test(a.th.sanitized), "un valor inválido en el control de color se sanea a un HEX válido (" + a.th.sanitized + ")");
    check(a.th.noUndo.u === 0 && a.th.noUndo.r === 0, "el tema y el fondo no entran en Undo");
    check(a.th.persisted.theme === "crema" && a.th.persisted.customBg === "#336699" && a.th.persisted.select === "crema", "persistencia (autoguardado + recarga + restaurar): " + JSON.stringify(a.th.persisted));
    check(a.th.invalidOpened.customBg === "not-a-color" && a.th.invalidOpened.theme === "claro" && a.th.cleared === "", "documento con customBg inválido: se abre sin error, se conserva y «✕» lo limpia");
    check(a.th.viewer.theme === "crema" && a.th.viewer.customBg === "#336699", "Share/Viewer conserva tema y fondo " + JSON.stringify(a.th.viewer));
    for (const k of ["themeDark", "themeCustom"]) check(A.docs[k] === H.docs[k], "documento idéntico a HEAD: " + k);
    console.log("\nduplicate_node");
    const s = a.du.single;
    check(s.order.length === 5 && s.node[0] === 9 && s.node[1] === 540 && s.node[2] === 220 && s.node[3] === 4 && s.node[4] === "B", "un nodo: id nuevo, +20,+20, order y etiqueta " + JSON.stringify(s.node));
    check(same(s.sel, { n: [9], e: [] }) && s.stacks.u === 1 && s.edges === 4, "selección = lo nuevo, un Undo, sin conexiones externas copiadas");
    check(same(s.behaviors, [[2, "DOWN"], [4, "DOWN"], [9, "DOWN"]]), "el Behavior se copia: " + JSON.stringify(s.behaviors));
    check(A.docs.dupSingle === H.docs.dupSingle, "documento idéntico a HEAD tras duplicar un nodo");
    check(a.du.clipboard === "antes", "Ctrl+D ya no pisa el portapapeles del sistema (" + a.du.clipboard + ")");
    check(h.du.clipboard.startsWith("fluyo::"), "HEAD sí lo pisaba (diferencia esperada, F5)");
    check(a.du.afterUndo.order.length === 4 && a.du.afterUndo.edges === 4 && a.du.afterUndo.behaviors === 2 && a.du.afterUndo.nextId === 10 && a.du.redoOk, "Undo elimina nodo+Behavior, el contador no baja (10) y Redo lo reaplica idéntico");
    const m = a.du.multi;
    check(same(a.du.marquee.n, [1, 2, 3]), "marco selecciona A,B,C " + JSON.stringify(a.du.marquee));
    check(same(m.nodes.slice(4).map((n) => n[0]), [9, 10, 11]) && same(m.nodes.slice(4).map((n) => [n[1], n[2]]), [[220, 220], [540, 220], [860, 220]]), "ids nuevos en orden del documento y desplazamiento: " + JSON.stringify(m.nodes.slice(4)));
    check(same(m.edges.slice(4).map((e) => [e[0], e[1], e[2]]), [[12, 9, 10], [13, 10, 11]]), "solo las conexiones internas (A→B, B→C) se copian; C→D y A→D no: " + JSON.stringify(m.edges.slice(4)));
    check(same(m.edges.slice(4)[0][3], [[380, 160], [380, 280]]), "waypoints desplazados " + JSON.stringify(m.edges.slice(4)[0][3]));
    check(same(m.behaviors, [[2, "DOWN"], [4, "DOWN"], [10, "DOWN"]]) && m.nextId === 14, "Behavior de B copiado a su copia y contador 14");
    check(same(a.du.multiSel, { n: [9, 10, 11], e: [12, 13] }) && a.du.multiStacks.u === 1, "selección = lo nuevo y un solo Undo");
    check(a.du.trace === h.du.trace, "Historias/Steps intactos: el Trace no cambia");
    check(a.du.twice.nodes === 10 && a.du.twice.stacks.u === 2 && a.du.undo1 === 7 && a.du.undo2 === 4 && a.du.redo2 === 10, "dos duplicados = dos Undo; Undo/Redo restauran/reaplican la operación completa");
    for (const k of ["dupMulti", "dupTwice", "dupMenu"]) check(A.docs[k] === H.docs[k], "documento idéntico a HEAD: " + k);
    check(a.du.pasteAfterDup.at(-1) === "A" && h.du.pasteAfterDup.at(-1) === "C", "Ctrl+C (A) → Ctrl+D (otro nodo) → Ctrl+V pega lo copiado (" + a.du.pasteAfterDup.at(-1) + "); HEAD pegaba el duplicado (" + h.du.pasteAfterDup.at(-1) + "): consecuencia de F5, diferencia esperada");
    check(a.du.menuVisible ? a.du.menuNodes === 7 : true, "botón «Duplicar» del menú: " + (a.du.menuVisible ? "visible y duplica" : "no visible (se duplica por Ctrl+D)"));
    check(a.du.duringPlayback === 4 && a.du.afterPlayback === 4, "durante y después del Playback Ctrl+D no duplica");
    check(same(a.du.viewer, a.du.viewerExpected), "Share/Viewer: mismo orden Z, conexiones y Behaviors tras duplicar y reordenar " + JSON.stringify(a.du.viewer));
    console.log("\nDocumentos antiguos");
    check(a.od.opened.theme === "crema" && a.od.opened.customBg === "", "documento v3 sin customBg se abre (theme crema, customBg vacío)");
    check(same(a.od.z, [2, 1]), "orden Z sobre un documento antiguo " + JSON.stringify(a.od.z));
    check(a.od.dup.nodes.length === 4 && a.od.dup.edges.length === 2 && a.od.theme === "claro" && a.od.undo === 2, "duplicar y cambiar tema sobre un documento antiguo; Undo deshace el duplicado");
    console.log("\nErrores de consola/página");
    const errs = [...A.errors, ...H.errors.filter((e) => !/head/.test(e) === false)];
    check(A.errors.length === 0, "sin errores de consola ni de página en el árbol de trabajo" + (A.errors.length ? ": " + A.errors.slice(0, 3).join(" | ") : ""));
    fs.writeFileSync(path.join(shots, "report.json"), JSON.stringify({ wt: A.R, head: H.R, wtDialogs: A.dialogs.length, wtDocs: A.docs, headDocs: H.docs }, null, 2));
  } finally {
    await browser.close(); wt.server.close(); hd.server.close();
  }
  console.log("\ncapturas e informe en " + shots);
  console.log(failed ? failed + " comprobación(es) fallida(s)" : "Chrome real OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
