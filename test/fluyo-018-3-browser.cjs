"use strict";
/* FLUYO-018.3 — QA en Chrome REAL: ratón y teclado reales de Playwright sobre el editor.
   018.3 hace que mover, redimensionar, editar, retargetear y borrar pasen por model.js (updateNodeIn, updateConnectionIn,
   deleteNodeIn, deleteConnectionIn). Aquí se ejecuta EL MISMO guion contra el árbol de trabajo y contra HEAD (git archive → carpeta
   temporal) y se comparan los documentos paso a paso; además Historia + Playback, Undo/Redo, guardar/reabrir, Share y Viewer.
   Resultado esperado (actualizado tras commitear 018.4: HEAD ya incluye la política de borrado y el Behavior se va con el nodo en ambos árboles): ninguna diferencia con HEAD.
   (Antes de ese commit HEAD dejaba un Behavior HUÉRFANO al borrar un nodo con condición «No disponible».) Los documentos se comparan sin Behaviors huérfanos; el borrado de un
   nodo usado por una Historia pide confirmación (el guion la acepta: los Steps quedan igual que en HEAD).
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-018-3-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-3-"));
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
/* El árbol de HEAD tal como está commiteado (sólo lo que sirve el editor y el visor). */
/* FLUYO-018.15: en HEAD un nodo nuevo nacía #6a9fb5; ahora nace DEFAULT_NODE_COLOR (#857F6C). Las comparaciones con HEAD deshacen
   solo ese cambio deliberado (también dentro de JSON anidado); todo lo demás tiene que seguir siendo idéntico. */
const UNDO15 = (s) => typeof s === "string" ? s.replace(/(\\*"color\\*":\\*")#857F6C/g, "$1#6a9fb5") : s;
function headTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-"));
  const files = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8" }).split("\n").filter((f) => /^(index\.html|js\/|css\/|s\/|assets\/|manifest\.webmanifest)/.test(f));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), execFileSync("git", ["-C", root, "show", "HEAD:" + f], { maxBuffer: 64 * 1024 * 1024 }));
  }
  return dir;
}

/* El guion: devuelve {docs:[{name,json}], extra}. Idéntico para ambos árboles. */
async function script(browser, base, label) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const ed = await ctx.newPage();
  ed.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message));
  ed.on("console", (m) => { if (m.type() === "error") errors.push(label + " console: " + m.text()); });
  ed.on("dialog", (d) => d.accept());
  await ed.goto(base + "/");
  await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
  await ed.evaluate(() => {
    P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = []; doc.pages.length = 1; doc.cur = 0;
    undoStack.length = 0; redoStack.length = 0; scReset(); clearSel();
    viewX = 0; viewY = 0; viewZoom = 1; P().nextId = 1;
  });
  const docs = [];
  const snap = async (name) => docs.push({ name, json: UNDO15(await ed.evaluate(() => JSON.stringify(serializeProject()))) });
  const client = (x, y) => ed.evaluate(({ x, y }) => { const r = cv.getBoundingClientRect(); return { x: r.left + x * viewZoom + viewX, y: r.top + y * viewZoom + viewY }; }, { x, y });
  const nodePt = (i, dx = 0, dy = 0) => ed.evaluate(({ i, dx, dy }) => { const n = P().nodes[i], r = cv.getBoundingClientRect(); return { x: r.left + (n.x + dx) * viewZoom + viewX, y: r.top + (n.y + dy) * viewZoom + viewY }; }, { i, dx, dy });
  const cornerPt = (i, c) => ed.evaluate(({ i, c }) => { const n = P().nodes[i], r = cv.getBoundingClientRect(), p = nodeCorners(n)[c]; return { x: r.left + p[0] * viewZoom + viewX, y: r.top + p[1] * viewZoom + viewY }; }, { i, c });
  const edgePt = (i, u) => ed.evaluate(({ i, u }) => { const pts = edgePoints(P().edges[i]), m = pointAt(pts, u), r = cv.getBoundingClientRect(); return { x: r.left + m.x * viewZoom + viewX, y: r.top + m.y * viewZoom + viewY }; }, { i, u });
  const endPt = (i, which) => ed.evaluate(({ i, which }) => { const pts = edgePoints(P().edges[i]), m = which === "to" ? pts[pts.length - 1] : pts[0], r = cv.getBoundingClientRect(); return { x: r.left + m.x * viewZoom + viewX, y: r.top + m.y * viewZoom + viewY }; }, { i, which });
  const drag = async (a, b) => { await ed.mouse.move(a.x, a.y); await ed.mouse.down(); await ed.mouse.move(b.x, b.y, { steps: 12 }); await ed.mouse.up(); };
  const place = async (shape, x, y) => { await ed.locator(`button[data-shape="${shape}"]`).click(); const p = await client(x, y); await ed.mouse.click(p.x, p.y); };
  const nodeLabel = async (i, text) => { const p = await nodePt(i); await ed.mouse.dblclick(p.x, p.y); await ed.keyboard.type(text); await ed.keyboard.press("Enter"); };
  const selectNode = async (i) => { const p = await nodePt(i, 0, -10); await ed.mouse.click(p.x, p.y); };
  const selectEdge = async (i) => { const p = await edgePt(i, 0.5); await ed.mouse.click(p.x, p.y); };

  /* 1. crear nodos con clics reales */
  await place("rect", 250, 250); await place("rect", 650, 250); await place("cylinder", 650, 520);
  await snap("crear nodos");
  /* 2. etiquetas (doble clic + teclado) */
  await nodeLabel(0, "Cliente"); await nodeLabel(1, "Comercio"); await nodeLabel(2, "Banco");
  await snap("editar etiquetas");
  /* 3. crear conexiones con el modo conectar */
  await ed.locator('button[data-mode="connect"]').click();
  let a = await nodePt(0), b = await nodePt(1); await ed.mouse.click(a.x, a.y); await ed.mouse.click(b.x, b.y);
  a = await nodePt(1); b = await nodePt(2); await ed.mouse.click(a.x, a.y); await ed.mouse.click(b.x, b.y);
  await ed.keyboard.press("Escape"); await ed.locator('button[data-mode="select"]').click();
  await snap("crear conexiones");
  /* 4. mover Comercio */
  await drag(await nodePt(1, 0, -10), await nodePt(1, 70, -50));
  await snap("mover nodo");
  /* 5. redimensionar Cliente (esquina inferior derecha) */
  await selectNode(0);
  const c2 = await cornerPt(0, 2); await drag(c2, { x: c2.x + 50, y: c2.y + 30 });
  await snap("redimensionar");
  /* 6. editar con el panel: forma, color, negrita, pulso, etiqueta */
  await selectNode(0);
  /* FLUYO-018.14b: el panel va por grupos plegables; se despliegan como haría quien los usa (en HEAD no hay grupos: no hace nada) */ await ed.evaluate(() => document.querySelectorAll("#selBody details").forEach((d) => { d.open = true; }));
  await ed.locator("#shapeSel").selectOption("diamond");
  /* FLUYO-018.15: la rejilla empieza por la muestra del color por defecto; se elige «IA» por su valor, no por la posición */
  await ed.locator("#swatches .swatch[data-v=\"#9b7fb5\"]").click();
  await ed.locator("#boldChk").check(); await ed.locator("#pulseChk").check();
  await ed.locator("#lblEdit").fill("Cliente final");
  await snap("editar nodo (panel)");
  /* 7. editar la conexión: ruta, lados, discontinua, etiqueta */
  await selectEdge(0);
  await ed.locator("#routeSel").selectOption("ortho"); await ed.locator("#fromSel").selectOption("e"); await ed.locator("#toSel").selectOption("w");
  await ed.locator("#dashChk").check(); await ed.locator("#lblEdit").fill("Pago");
  await snap("editar conexión (panel)");
  /* 8. retarget: el extremo «to» de la conexión 0 pasa de Comercio a Banco arrastrando el manejador */
  await selectEdge(0);
  await drag(await endPt(0, "to"), await nodePt(2, 0, 10));
  const retargeted = await ed.evaluate(() => { const e = P().edges[0]; return [e.from, e.to]; });
  await snap("retarget por arrastre");
  /* 9. Historia con esas entidades (las mismas funciones de modelo del editor) y Playback con teclado/ratón reales */
  await ed.evaluate(() => {
    const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
    const sc = createScenario(P(), "Compra");
    createStep(sc, { at: 0, action: "SEND", edgeId: P().edges[0].id, eventTypeId: pago.id });
    createStep(sc, { at: 1000, action: "SEND", edgeId: P().edges[1].id, eventTypeId: pago.id });
    scSelectStory(sc.id);
  });
  await ed.locator("#tabScenarios").click();
  await snap("Historia");
  const traceBefore = await ed.evaluate(() => JSON.stringify(FluyoStory.run(P(), scActiveScenario()).trace));
  await ed.locator("#scRun").click();
  await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 15000 }).catch(async (e) => { console.log("DEBUG", label, await ed.evaluate(() => JSON.stringify({ st: scStatus, err: scErrors, valid: FluyoIntegrity.validateProject(serializeProject()).errors.slice(0, 3), edges: P().edges.map((x) => [x.id, x.from, x.to]), steps: P().scenarios[0].steps, dis: document.getElementById("scRun").disabled }))); throw e; });
  const played = await ed.evaluate(() => scStatus);
  await ed.locator("#scReset").click();
  await ed.waitForFunction(() => scStatus === "idle");
  await snap("playback");
  /* 10. borrar: una conexión y un nodo sin Historia; el nodo con Behavior (el editor lo deja, como en HEAD) */
  await ed.evaluate(() => { newNode("rect", 250, 520); newNode("hex", 880, 330); const [x, y] = [P().nodes[3], P().nodes[4]]; newEdge(x.id, y.id); newEdge(P().nodes[0].id, x.id); setInitialAvailability(P(), y.id, "DOWN"); });
  await snap("nodos extra");
  await selectEdge(3);                                  // conexión 0→extra
  await ed.keyboard.press("Delete");
  await snap("borrar conexión");
  await selectNode(4);                                  // el hexágono (con Behavior y la conexión x→y)
  await ed.keyboard.press("Delete");
  await snap("borrar nodo (con conexión y Behavior)");
  const orphanBehaviors = await ed.evaluate(() => P().behaviors.filter((b) => !P().nodes.some((n) => n.id === b.nodeId)).length);
  /* 11. Undo / Redo: los clics de selección también apilan undo (pushUndo en pointerdown): se deshace hasta recuperar el estado
     de «nodos extra» y se rehace hasta volver al final; el Behavior del nodo reaparece con su nodo. */
  const now = () => ed.evaluate(() => JSON.stringify(serializeProject())).then(UNDO15);
  const before = await now();
  const extra = docs.find((d) => d.name === "nodos extra").json;
  let undone = 0, behaviorBack = -1;
  for (let i = 0; i < 8 && (await now()) !== extra; i++) {
    await ed.keyboard.press("Control+z"); await ed.waitForTimeout(80); undone++;
    if (behaviorBack < 0 && (await ed.evaluate(() => P().nodes.length)) === 5) behaviorBack = await ed.evaluate(() => P().behaviors.length);
  }
  const undoToExtra = (await now()) === extra;
  for (let i = 0; i < 8 && (await now()) !== before; i++) { await ed.keyboard.press("Control+y"); await ed.waitForTimeout(80); }
  const undoWorked = undoToExtra && (await now()) === before;
  /* 12. guardar y reabrir */
  const saved = await ed.evaluate(() => JSON.stringify(serializeProject(), null, 2));
  await ed.locator("#fileIn").setInputFiles({ name: "d.fluyo.json", mimeType: "application/json", buffer: Buffer.from(saved) });
  await ed.waitForFunction((s) => JSON.stringify(serializeProject(), null, 2) === s, saved, { timeout: 5000 }).catch(() => {});
  const reopened = await ed.evaluate(() => JSON.stringify(serializeProject(), null, 2));
  /* 13. Share + 14. Viewer */
  await ed.locator("#btnShare").click();
  await ed.locator("#shareCreate").click();
  await ed.waitForFunction(() => document.getElementById("shareLink").value.includes("/s/#d="), null, { timeout: 8000 });
  const link = await ed.locator("#shareLink").inputValue();
  await ed.locator("#shareClose").click();
  const viewer = await ctx.newPage();
  viewer.on("pageerror", (e) => errors.push(label + " viewer pageerror: " + e.message));
  viewer.on("console", (m) => { if (m.type() === "error") errors.push(label + " viewer console: " + m.text()); });
  await viewer.goto(link);
  await viewer.waitForSelector("#stPlay", { state: "visible", timeout: 10000 });
  await viewer.locator("#stPlay").click();
  const viewerPlayed = await viewer.waitForFunction(() => /Repetir|↻/.test(document.getElementById("stPlay").textContent), null, { timeout: 8000 }).then(() => true, () => false);
  const viewerCaption = await viewer.evaluate(() => document.getElementById("stCaption").textContent);
  const viewerNodes = await viewer.evaluate(() => (typeof doc !== "undefined" ? P().nodes.length : -1));
  /* Present y borrado de un nodo USADO por una Historia (el editor no aplica B2: conserva el Step, igual que HEAD) */
  await ed.evaluate(() => { const n = newNode("rect", 450, 400), a = P().nodes[0]; const e = newEdge(a.id, n.id); const pago = doc.eventTypes[0]; const sc = createScenario(P(), "Usa el nodo"); createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id }); scSelectStory(sc.id); });
  await ed.locator("#btnPresent").click(); await ed.waitForTimeout(400); const presented = await ed.evaluate(() => presenting); await ed.keyboard.press("Escape"); await ed.waitForFunction(() => !presenting);
  await snap("Historia que usa un nodo");
  await selectNode(4); await ed.keyboard.press("Delete");
  await snap("borrar nodo usado por Historia");
  const usedAfter = await ed.evaluate(() => JSON.stringify({ nodes: P().nodes.length, steps: P().scenarios.map((x) => x.steps.length), orphan: P().scenarios[P().scenarios.length - 1].steps.filter((st) => !P().edges.some((e) => e.id === st.edgeId)).length }));
  await viewer.screenshot({ path: path.join(shots, label + "-viewer.png") });
  await ed.screenshot({ path: path.join(shots, label + "-editor.png") });
  await ctx.close();
  return { docs, errors, extra: { retargeted, played, traceBefore, orphanBehaviors, undoWorked, behaviorBack, reopenedSame: reopened === saved, link: link.length, viewerNodes, presented, usedAfter, viewerPlayed, viewerCaption } };
}

(async () => {
  const wt = await serve(root);
  const headDir = headTree();
  const hd = await serve(headDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  let failed = 0;
  const ok = (cond, msg) => { console.log((cond ? "  ✔ " : "  ✘ ") + msg); if (!cond) failed++; };
  try {
    const a = await script(browser, wt.base, "wt");
    const b = await script(browser, hd.base, "head");
    console.log("Pasos del guion:", a.docs.map((d) => d.name + " [" + JSON.parse(d.json).doc.pages[0].nodes.length + "n/" + JSON.parse(d.json).doc.pages[0].edges.length + "e]").join(" · "));
    ok(a.errors.length === 0 && b.errors.length === 0, "0 errores de consola/página (árbol de trabajo y HEAD)" + (a.errors.concat(b.errors).length ? ": " + a.errors.concat(b.errors).join(" | ") : ""));
    ok(a.docs.length === b.docs.length, "mismo número de pasos");
    const noOrphans = (j) => { const d = JSON.parse(j); for (const pg of d.doc.pages) pg.behaviors = pg.behaviors.filter((x) => pg.nodes.some((n) => n.id === x.nodeId)); return JSON.stringify(d); };
    for (let i = 0; i < a.docs.length; i++) {
      const same = noOrphans(a.docs[i].json) === noOrphans(b.docs[i].json);
      ok(same, `«${a.docs[i].name}»: documento idéntico a HEAD (sin contar Behaviors huérfanos)`);
    }
    ok(JSON.stringify(a.extra.retargeted) === JSON.stringify(b.extra.retargeted) && a.extra.retargeted[1] === 3, "retarget por arrastre: la conexión pasó a apuntar al Banco, igual que en HEAD " + JSON.stringify(a.extra.retargeted));
    ok(a.extra.played === "completed" && b.extra.played === "completed", "Playback de la Historia completado (WT y HEAD)");
    ok(a.extra.traceBefore === b.extra.traceBefore, "el Trace es idéntico a HEAD");
    ok(a.extra.orphanBehaviors === 0 && b.extra.orphanBehaviors === 0, "FLUYO-018.4: el Behavior se va con el nodo (WT 0 huérfanos; HEAD, que ya incluye 018.4, 0)");
    ok(a.extra.usedAfter === b.extra.usedAfter && JSON.parse(a.extra.usedAfter).orphan === 1, "borrar un nodo usado por una Historia (confirmado): mismos Steps que HEAD, el Step queda «huérfano» a la vista del usuario " + a.extra.usedAfter);
    ok(a.extra.presented === true && b.extra.presented === true, "Present abre y cierra (WT y HEAD)");
    ok(a.extra.undoWorked && b.extra.undoWorked, "Undo/Redo restauran el documento (WT y HEAD)");
    ok(a.extra.behaviorBack >= 1 && b.extra.behaviorBack >= 1, "Undo de «borrar nodo» devuelve el nodo con su Behavior (WT y HEAD)");
    ok(a.extra.reopenedSame && b.extra.reopenedSame, "guardar → reabrir: documento idéntico");
    ok(a.extra.viewerPlayed === true && b.extra.viewerPlayed === true, "Viewer: sin Behavior huérfano la Historia se reproduce (WT " + a.extra.viewerPlayed + "; HEAD, que ya incluye 018.4: " + b.extra.viewerPlayed + ")");
    console.log("Capturas en", shots);
  } finally {
    await browser.close(); wt.server.close(); hd.server.close();
    fs.rmSync(headDir, { recursive: true, force: true });
  }
  console.log(failed ? `\nFLUYO-018.3 Chrome real: ${failed} fallo(s)` : "\nFLUYO-018.3 Chrome real: OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
