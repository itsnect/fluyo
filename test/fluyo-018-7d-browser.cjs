"use strict";
/* FLUYO-018.7d — QA en Chrome REAL: la biblioteca de EventTypes entra en Undo/Redo. Ratón y teclado reales: ✕ de la pestaña (confirm real),
   «⋯ → Eliminar de la biblioteca» del panel de Escenarios, Ctrl+Z / Ctrl+Y, Playback de la Historia restaurada y recarga.
   Se ejecuta contra el árbol de trabajo y contra HEAD. Cuando se escribió, HEAD era 018.7a: el borrado de página no se podía deshacer y el
   escenario «borrar página → eliminar evento → deshacer» no era reproducible allí (se registraba como referencia). HEAD ya incluye
   018.7c/7d (2d960d9): desde entonces HEAD debe recorrer el guion con resultados IDÉNTICOS al árbol de trabajo (FLUYO-018.10, mismo
   criterio que 018.5).
   Uso: node test/fluyo-018-7d-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome por defecto) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-7d-"));
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
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), execFileSync("git", ["-C", root, "show", "HEAD:" + f], { maxBuffer: 64 * 1024 * 1024 })); }
  return dir;
}
/* A: dos nodos, conexión, Historia «Compra» con 2 pasos de «Pago» (solo A lo usa) y 1 de «Aviso». B: Historia con «Aviso». */
const SETUP = () => {
  doc.pages.length = 1; doc.cur = 0; const a = P(); a.name = "A"; a.nodes = []; a.edges = []; a.scenarios = []; a.behaviors = []; a.nextId = 1; a.nextScenarioId = 1;
  doc.eventTypes = []; doc.nextEventTypeId = 1; scReset(); clearSel();
  const x = newNode("rect", 200, 200, { label: "Cliente" }), y = newNode("rect", 520, 200, { label: "Banco" }), e = newEdge(x.id, y.id);
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
  const aviso = createEventType({ name: "Aviso", primitive: "OCCURRENCE", sentenceTemplate: "{target} avisa", visual: { value: "⚠" } });
  const sc = createScenario(P(), "Compra");
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id }); createStep(sc, { at: 1200, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
  createStep(sc, { at: 2400, action: "OCCURRENCE", nodeId: y.id, eventTypeId: aviso.id });
  addPage(); P().name = "B"; const z = newNode("rect", 300, 300, { label: "Almacén" });
  createStep(createScenario(P(), "Entrega"), { at: 0, action: "OCCURRENCE", nodeId: z.id, eventTypeId: aviso.id });
  doc.cur = 0; undoStack.length = 0; redoStack.length = 0; renderTabs(); scSelectStory(sc.id);
};

async function script(browser, base, label) {
  const errors = [], dialogs = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const ed = await ctx.newPage();
  ed.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message));
  ed.on("console", (m) => { if (m.type() === "error") errors.push(label + " console: " + m.text()); });
  ed.on("dialog", (d) => { dialogs.push(d.type()); d.accept(); });
  await ed.goto(base + "/"); await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
  if (await ed.locator("#autosaveModal").isVisible()) await ed.locator("#autosaveDiscard").click();
  await ed.evaluate(`(${SETUP.toString()})()`);
  const R = {};
  const docJson = () => ed.evaluate(() => JSON.stringify(doc));
  const lib = () => ed.evaluate(() => doc.eventTypes.map((e) => e.name));
  const valid = () => ed.evaluate(() => FluyoIntegrity.validateProject(serializeProject()).valid);
  const key = async (k) => { await ed.locator("#cv").click({ position: { x: 5, y: 5 } }); await ed.keyboard.press(k); await ed.waitForTimeout(120); };
  const deleteFromLibrary = async (name) => {
    await ed.locator("#tabScenarios").click();
    const id = await ed.evaluate((n) => doc.eventTypes.find((e) => e.name === n).id, name);
    await ed.locator(`#scEventLibrary [data-event-type-id="${id}"] .scMore`).click();
    await ed.locator("button", { hasText: "Eliminar de la biblioteca" }).last().click();
    await ed.waitForTimeout(100);
    const used = await ed.evaluate(() => [...document.querySelectorAll(".scPopover p")].map((p) => p.textContent).join(" "));
    await ed.keyboard.press("Escape");
    await ed.locator("#tabProperties").click();
    return used;
  };
  const s0 = await docJson();
  await ed.locator("#pagesBar .tab").nth(0).locator(".x").click(); await ed.waitForTimeout(80);   // borrar A: «Pago» queda sin uso
  const s1 = await docJson();
  R.afterDelete = { pages: await ed.evaluate(() => doc.pages.map((p) => p.name)), lib: await lib() };
  R.avisoBlocked = await deleteFromLibrary("Aviso");                                                // B lo usa: bloqueado
  R.libAfterBlocked = await lib();
  await deleteFromLibrary("Pago");
  const s2 = await docJson();
  R.libAfterPago = await lib();
  await key("Control+z"); R.undo1 = { same: (await docJson()) === s1, lib: await lib() };
  await key("Control+z"); R.undo2 = { same: (await docJson()) === s0, pages: await ed.evaluate(() => doc.pages.map((p) => p.name)), valid: await valid() };
  // la Historia restaurada se reproduce entera con «Pago»
  await ed.evaluate(() => { doc.cur = 0; renderTabs(); scSelectStory(P().scenarios[0].id); });
  await ed.locator("#tabScenarios").click(); await ed.locator("#scRun").click();
  R.played = await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 20000 }).then(() => true, () => false);
  await ed.locator("#scReset").click(); await ed.locator("#tabProperties").click();
  await key("Control+y"); R.redo1 = (await docJson()) === s1;
  await key("Control+y"); R.redo2 = (await docJson()) === s2;
  // ciclos
  R.cycles = [];
  for (let k = 0; k < 3; k++) { await key("Control+z"); await key("Control+z"); const a = (await docJson()) === s0; await key("Control+y"); await key("Control+y"); R.cycles.push(a && (await docJson()) === s2); }
  // recarga: el autoguardado conserva el estado final y empieza sin historial
  await ed.waitForTimeout(900); await ed.reload(); await ed.waitForFunction(() => typeof newNode === "function");
  await ed.locator("#autosaveRestore").click(); await ed.waitForFunction(() => doc.pages.length > 0);
  R.reload = { lib: await lib(), valid: await valid(), stacks: await ed.evaluate(() => undoStack.length + redoStack.length) };
  await ed.screenshot({ path: path.join(shots, label + ".png") });
  await ctx.close();
  return { R, errors, dialogs };
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const wt = await serve(root), headDir = headTree(), hd = await serve(headDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  let failed = 0;
  const check = (c, m) => { console.log((c ? "  ✔ " : "  ✘ ") + m); if (!c) failed++; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  try {
    const A = await script(browser, wt.base, "wt"), H = await script(browser, hd.base, "head");
    const a = A.R, h = H.R;
    check(same(a.afterDelete, { pages: ["B"], lib: ["Pago", "Aviso"] }), "✕ de A: la página se va y la biblioteca no cambia " + JSON.stringify(a.afterDelete));
    check(/se usa en/.test(a.avisoBlocked) && same(a.libAfterBlocked, ["Pago", "Aviso"]), "«Aviso» (lo usa B) no se elimina: el popover lo explica");
    check(same(a.libAfterPago, ["Aviso"]), "«Pago» (ya sin uso) se elimina desde la biblioteca");
    check(a.undo1.same && same(a.undo1.lib, ["Pago", "Aviso"]), "Ctrl+Z 1: «Pago» vuelve (documento exacto tras el borrado de A)");
    check(a.undo2.same && same(a.undo2.pages, ["A", "B"]) && a.undo2.valid, "Ctrl+Z 2: A vuelve y el documento es el inicial exacto y VÁLIDO (sus pasos apuntan a «Pago»)");
    check(a.played, "la Historia restaurada se reproduce entera");
    check(a.redo1 && a.redo2, "Ctrl+Y ×2: estados exactos tras el borrado y tras eliminar «Pago»");
    check(a.cycles.every(Boolean), "3 ciclos Undo×2/Redo×2 exactos");
    check(same(a.reload.lib, ["Aviso"]) && a.reload.valid && a.reload.stacks === 0, "recarga: estado final válido, sin historial");
    check(same(h.afterDelete, a.afterDelete) && same(h.libAfterPago, ["Aviso"]), "HEAD: el mismo borrado y la misma eliminación");
    check(same(h, a), "HEAD (que ya incluye 018.7c/7d): el mismo guion con resultados idénticos al árbol de trabajo (Undo ×2 al documento inicial exacto y válido, Historia reproducida, Redo, ciclos y recarga)");
    check(A.errors.length === 0, "sin errores de consola/página" + (A.errors.length ? ": " + A.errors.join(" | ") : ""));
  } finally { await browser.close(); wt.server.close(); hd.server.close(); fs.rmSync(headDir, { recursive: true, force: true }); }
  console.log("\ncapturas en " + shots);
  console.log(failed ? failed + " comprobación(es) fallida(s)" : "Chrome real OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
