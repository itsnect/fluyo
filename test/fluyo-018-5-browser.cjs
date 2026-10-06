"use strict";
/* FLUYO-018.5 — QA en Chrome REAL: ratón, teclado y diálogos reales de Playwright sobre el editor.
   018.5 hace que crear («＋») y renombrar (doble clic) páginas pasen por model.js (createPageIn, renamePageIn) vía state.js (addPage, renamePage).
   Se ejecuta EL MISMO guion contra el árbol de trabajo y contra HEAD (git archive → carpeta temporal) y se comparan los documentos paso a paso:
   crear página, renombrar, cambiar entre páginas, crear nodos/conexiones en cada una, Historias (página existente y nueva), Playback, Undo/Redo,
   guardar/reabrir, Share y Viewer. Solo difiere, por diseño, un nombre de página de más de 80 caracteres (HEAD lo aceptaba; ahora se rechaza con aviso).
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-018-5-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-5-"));
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
function headTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-"));
  const files = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8" }).split("\n").filter((f) => /^(index\.html|js\/|css\/|s\/|assets\/|manifest\.webmanifest)/.test(f));
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), execFileSync("git", ["-C", root, "show", "HEAD:" + f], { maxBuffer: 64 * 1024 * 1024 }));
  }
  return dir;
}

async function script(browser, base, label, opts = {}) {
  const errors = [], dialogs = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const ed = await ctx.newPage();
  let promptAnswer = "";
  ed.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message));
  ed.on("console", (m) => { if (m.type() === "error") errors.push(label + " console: " + m.text()); });
  ed.on("dialog", (d) => { dialogs.push({ type: d.type(), message: d.message() }); if (d.type() === "prompt") d.accept(promptAnswer); else d.accept(); });
  await ed.goto(base + "/");
  await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
  await ed.evaluate(() => {
    P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; doc.eventTypes = []; doc.pages.length = 1; doc.cur = 0;
    undoStack.length = 0; redoStack.length = 0; scReset(); clearSel();
    viewX = 0; viewY = 0; viewZoom = 1; P().nextId = 1; renderTabs();
  });
  const docs = [];
  const snap = async (name) => docs.push({ name, json: await ed.evaluate(() => JSON.stringify(serializeProject())) });
  const client = (x, y) => ed.evaluate(({ x, y }) => { const r = cv.getBoundingClientRect(); return { x: r.left + x * viewZoom + viewX, y: r.top + y * viewZoom + viewY }; }, { x, y });
  const nodePt = (i, dx = 0, dy = 0) => ed.evaluate(({ i, dx, dy }) => { const n = P().nodes[i], r = cv.getBoundingClientRect(); return { x: r.left + (n.x + dx) * viewZoom + viewX, y: r.top + (n.y + dy) * viewZoom + viewY }; }, { i, dx, dy });
  const place = async (shape, x, y) => { await ed.locator(`button[data-shape="${shape}"]`).click(); const p = await client(x, y); await ed.mouse.click(p.x, p.y); };
  const nodeLabel = async (i, text) => { const p = await nodePt(i); await ed.mouse.dblclick(p.x, p.y); await ed.keyboard.type(text); await ed.keyboard.press("Enter"); };
  const connect = async (i, j) => {
    await ed.locator('button[data-mode="connect"]').click();
    const a = await nodePt(i), b = await nodePt(j); await ed.mouse.click(a.x, a.y); await ed.mouse.click(b.x, b.y);
    await ed.keyboard.press("Escape"); await ed.locator('button[data-mode="select"]').click();
  };
  const tabs = () => ed.evaluate(() => [...document.querySelectorAll("#pagesBar .tab")].map((t) => ({ text: t.querySelector("span").textContent, active: t.classList.contains("active") })));
  const addBtn = () => ed.locator('#pagesBar button[title="Nueva página"]');

  /* 1. página 1: nodos y conexión con clics reales */
  await place("rect", 250, 250); await place("rect", 650, 250);
  await nodeLabel(0, "Cliente"); await nodeLabel(1, "Comercio"); await connect(0, 1);
  await snap("página 1 con diagrama");
  const tabs1 = await tabs();
  /* 2. «＋»: página nueva (nombre por defecto, activa, vacía) */
  await addBtn().click();
  await snap("crear página (＋)");
  const afterAdd = await ed.evaluate(() => ({ cur: doc.cur, n: doc.pages.length, name: doc.pages[doc.cur].name, empty: P().nodes.length === 0 && P().edges.length === 0 }));
  const tabs2 = await tabs();
  /* 3. nodos y conexión en la página nueva */
  await place("cylinder", 250, 300); await place("hex", 650, 300);
  await nodeLabel(0, "Base"); await nodeLabel(1, "Cola"); await connect(0, 1);
  await snap("página 2 con diagrama");
  /* 4. renombrar por doble clic (prompt real) */
  promptAnswer = "Pagos";
  await ed.locator("#pagesBar .tab").nth(1).dblclick();
  await snap("renombrar página");
  const renamed = (await tabs())[1].text;
  /* 5. cambiar entre páginas (clic en pestañas) */
  await ed.locator("#pagesBar .tab").nth(0).click();
  const onFirst = await ed.evaluate(() => ({ cur: doc.cur, nodes: P().nodes.length }));
  await snap("volver a la página 1");
  await ed.locator("#pagesBar .tab").nth(1).click();
  const onSecond = await ed.evaluate(() => ({ cur: doc.cur, nodes: P().nodes.length }));
  await snap("ir a la página 2");
  /* 6. tercera página; Historia en página existente (1) y nueva (3) */
  await addBtn().click();
  await place("rect", 300, 300); await place("rect", 700, 300); await connect(0, 1);
  await ed.evaluate(() => {
    const et = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
    const mk = (pi) => { doc.cur = pi; const sc = createScenario(P(), "Historia " + (pi + 1)); createStep(sc, { at: 0, action: "SEND", edgeId: P().edges[0].id, eventTypeId: et.id }); return sc; };
    mk(0); const s3 = mk(2); renderTabs(); scSelectStory(s3.id);
  });
  await ed.locator("#tabScenarios").click();
  await snap("Historias en página existente y nueva");
  const traces = await ed.evaluate(() => [0, 2].map((pi) => JSON.stringify(FluyoStory.run(doc.pages[pi], doc.pages[pi].scenarios[0]).trace)));
  await ed.locator("#scRun").click();
  await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 15000 });
  await ed.locator("#scReset").click();
  await ed.waitForFunction(() => scStatus === "idle");
  await snap("playback");
  /* 7. Undo / Redo sobre la página nueva */
  const now = () => ed.evaluate(() => JSON.stringify(serializeProject()));
  await place("circle", 500, 500);
  const withCircle = await now();
  await ed.keyboard.press("Control+z"); await ed.waitForTimeout(80);
  const undone = await now();
  await ed.keyboard.press("Control+y"); await ed.waitForTimeout(80);
  const redone = await now();
  const undoOk = undone !== withCircle && redone === withCircle;
  await snap("undo/redo");
  /* 8. guardar y reabrir */
  const saved = await ed.evaluate(() => JSON.stringify(serializeProject(), null, 2));
  await ed.locator("#fileIn").setInputFiles({ name: "d.fluyo.json", mimeType: "application/json", buffer: Buffer.from(saved) });
  await ed.waitForFunction((s) => JSON.stringify(serializeProject(), null, 2) === s, saved, { timeout: 5000 }).catch(() => {});
  const reopened = await ed.evaluate(() => JSON.stringify(serializeProject(), null, 2));
  const reopenedTabs = await tabs();
  /* 9. nombre de página de 81 caracteres: HEAD lo acepta; 018.5 lo rechaza con un aviso y deja la página intacta */
  promptAnswer = "x".repeat(81);
  const dialogsBefore = dialogs.length;
  await ed.locator("#pagesBar .tab").nth(1).dblclick();
  const longName = { name: await ed.evaluate(() => doc.pages[1].name), dialogs: dialogs.slice(dialogsBefore).map((d) => d.type) };
  promptAnswer = "";
  await ed.locator("#pagesBar .tab").nth(1).dblclick();   // cancelar con vacío: no cambia nada
  const emptyName = await ed.evaluate(() => doc.pages[1].name);
  /* 10. Share + Viewer: nombres de página y reproducción */
  await ed.evaluate(() => { doc.cur = 0; renderTabs(); });
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
  const viewerPages = await viewer.evaluate(() => [...document.querySelectorAll("#pageNav button, #pagesBar button, .page-tabs button")].map((b) => b.textContent.trim()).filter(Boolean));
  const viewerDoc = await viewer.evaluate(() => (typeof doc !== "undefined" ? doc.pages.map((p) => p.name) : []));
  await viewer.screenshot({ path: path.join(shots, label + "-viewer.png") });
  await ed.screenshot({ path: path.join(shots, label + "-editor.png") });
  await ctx.close();
  return { docs, errors, extra: { tabs1, afterAdd, tabs2, renamed, onFirst, onSecond, traces, undoOk, reopenedSame: reopened === saved, reopenedTabs, longName, emptyName, link: link.length, viewerPlayed, viewerPages, viewerDoc, dialogs } };
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
    console.log("Pasos del guion:", a.docs.map((d) => d.name + " [" + JSON.parse(d.json).doc.pages.length + "p]").join(" · "));
    ok(a.errors.length === 0 && b.errors.length === 0, "0 errores de consola/página (árbol de trabajo y HEAD)" + (a.errors.concat(b.errors).length ? ": " + a.errors.concat(b.errors).join(" | ") : ""));
    ok(a.docs.length === b.docs.length, "mismo número de pasos");
    for (let i = 0; i < a.docs.length; i++) ok(a.docs[i].json === b.docs[i].json, `«${a.docs[i].name}»: documento idéntico a HEAD (texto, mismo orden de claves)`);
    const x = a.extra, y = b.extra;
    ok(JSON.stringify(x.afterAdd) === JSON.stringify({ cur: 1, n: 2, name: "Página 2", empty: true }) && JSON.stringify(x.afterAdd) === JSON.stringify(y.afterAdd), "«＋» crea «Página 2», vacía y activa (igual que HEAD) " + JSON.stringify(x.afterAdd));
    ok(x.renamed === "Pagos" && y.renamed === "Pagos", "doble clic + prompt renombra la pestaña a «Pagos»");
    ok(JSON.stringify(x.tabs2) === JSON.stringify(y.tabs2) && x.tabs2[1].active, "pestañas tras «＋» idénticas a HEAD " + JSON.stringify(x.tabs2));
    ok(JSON.stringify(x.onFirst) === JSON.stringify({ cur: 0, nodes: 2 }) && JSON.stringify(x.onSecond) === JSON.stringify({ cur: 1, nodes: 2 }), "cambiar entre páginas: cada una conserva su diagrama");
    ok(JSON.stringify(x.traces) === JSON.stringify(y.traces) && x.traces.every((t) => JSON.parse(t).events.length >= 2), "Trace de la Historia (página existente y página nueva) idéntico a HEAD");
    ok(x.undoOk && y.undoOk, "Undo/Redo restauran la página nueva (WT y HEAD)");
    ok(x.reopenedSame && y.reopenedSame && JSON.stringify(x.reopenedTabs) === JSON.stringify(y.reopenedTabs), "guardar → reabrir: documento y pestañas idénticos");
    ok(x.viewerPlayed && y.viewerPlayed && x.viewerDoc.join("|") === "Página 1|Pagos|Página 3" && y.viewerDoc.length === 3 && y.viewerDoc[0] === "Página 1" && y.viewerDoc[2] === "Página 3", "Share → Viewer: reproduce y conserva los nombres de página " + JSON.stringify(x.viewerDoc) + " (HEAD: la 2.ª es el nombre de 81 caracteres que aceptaba)");
    ok(x.longName.name === "Pagos" && x.longName.dialogs.join() === "prompt,alert", "81 caracteres: se rechaza con aviso (alert) y la página queda como estaba " + JSON.stringify(x.longName));
    ok(y.longName.name.length === 81, "(HEAD aceptaba 81 caracteres: diferencia por diseño)");
    ok(x.emptyName === "Pagos" && y.emptyName === y.longName.name, "nombre vacío en el prompt = cancelar: no cambia nada (WT y HEAD)");
    console.log("Capturas en", shots);
  } finally {
    await browser.close(); wt.server.close(); hd.server.close();
    fs.rmSync(headDir, { recursive: true, force: true });
  }
  console.log(failed ? `\nFLUYO-018.5 Chrome real: ${failed} fallo(s)` : "\nFLUYO-018.5 Chrome real: OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
