"use strict";
/* FLUYO-018.8 — QA en Chrome REAL del flujo completo, con ratón y teclado reales:
   autor: «Compartir» → «Crear enlace» · destinatario (con sesión guardada): abre el enlace en el Viewer → reproduce → «Abrir en Fluyo» →
   modal de documento entrante → «Añadir el diagrama como página nueva» → cambia de página por las pestañas → Historias → «▶ Reproducir».
   Comprueba que el EventType visualizado y ejecutado es el del documento de ORIGEN («Reembolso», ↩), no el del receptor con el mismo id
   y la misma primitiva («Pago», 💵); que el Playback del editor coincide con el del Viewer (Trace y metadata); Ctrl+Z/Ctrl+Y sin efecto;
   recarga. Se ejecuta contra el árbol de trabajo y contra HEAD. Cuando se escribió, HEAD era 018.7 (2d960d9) y servía de oráculo del bug
   de la auditoría (descartaba la biblioteca entrante y reproducía «Pago»); HEAD ya incluye 018.8 (a57ea1e): desde entonces HEAD debe
   producir exactamente lo mismo que el árbol de trabajo (FLUYO-018.10, mismo criterio que 018.5).
   Uso: node test/fluyo-018-8-browser.cjs   (Playwright vía NODE_PATH; FLUYO_BROWSER=chrome por defecto) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-8-"));
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
/* FLUYO-018.15: en HEAD un nodo nuevo nacía #6a9fb5; ahora nace DEFAULT_NODE_COLOR (#857F6C). Las comparaciones con HEAD deshacen
   solo ese cambio deliberado (también dentro de JSON anidado); todo lo demás tiene que seguir siendo idéntico. */
const UNDO15 = (s) => typeof s === "string" ? s.replace(/(\\*"color\\*":\\*")#857F6C/g, "$1#6a9fb5") : s;
function headTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-head-"));
  const files = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8" }).split("\n").filter((f) => /^(index\.html|js\/|css\/|s\/|assets\/|manifest\.webmanifest)/.test(f));
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), execFileSync("git", ["-C", root, "show", "HEAD:" + f], { maxBuffer: 64 * 1024 * 1024 })); }
  return dir;
}
const fresh = () => {
  doc.pages.length = 1; doc.cur = 0; const a = P(); a.nodes = []; a.edges = []; a.scenarios = []; a.behaviors = []; a.nextId = 1; a.nextScenarioId = 1;
  doc.eventTypes = []; doc.nextEventTypeId = 1; scReset(); clearSel();
};
/* Autor: «Devoluciones» — «Reembolso» (FLOW, id 1, ↩, lento) y «Confirmación» (OCCURRENCE, id 2); «Archivo» sin uso (id 3). */
const AUTHOR = `(${fresh.toString()})(); (() => {
  P().name = "Devoluciones";
  const t = newNode("rect", 200, 200, { label: "Tienda" }), c = newNode("rect", 560, 200, { label: "Cliente" }), e = newEdge(t.id, c.id);
  const re = createEventType({ name: "Reembolso", primitive: "FLOW", sentenceTemplate: "{source} devuelve el dinero a {target}", visual: { value: "↩" }, motion: "slow" });
  const co = createEventType({ name: "Confirmación", primitive: "OCCURRENCE", sentenceTemplate: "{target} confirma la devolución", visual: { value: "✅" } });
  createEventType({ name: "Archivo", primitive: "OCCURRENCE", sentenceTemplate: "{target} archiva", visual: { value: "🗄" } });
  const sc = createScenario(P(), "Devolución");
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: re.id });
  createStep(sc, { at: 2000, action: "OCCURRENCE", nodeId: c.id, eventTypeId: co.id });
  undoStack.length = 0; redoStack.length = 0; renderTabs(); scSelectStory(sc.id); saveAutosave(true);
})()`;
/* Destinatario: «Caja» — «Pago» (FLOW, id 1, 💵, rápido) y «Aviso» (OCCURRENCE, id 2): mismos ids y primitivas que el autor. */
const RECIPIENT = `(${fresh.toString()})(); (() => {
  P().name = "Caja";
  const a = newNode("rect", 200, 200, { label: "Cliente" }), b = newNode("rect", 560, 200, { label: "Banco" }), e = newEdge(a.id, b.id);
  const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" }, motion: "fast" });
  const aviso = createEventType({ name: "Aviso", primitive: "OCCURRENCE", sentenceTemplate: "{target} avisa", visual: { value: "⚠" } });
  const sc = createScenario(P(), "Cobro");
  createStep(sc, { at: 0, action: "SEND", edgeId: e.id, eventTypeId: pago.id });
  createStep(sc, { at: 1500, action: "OCCURRENCE", nodeId: b.id, eventTypeId: aviso.id });
  renderTabs(); scSelectStory(sc.id);
  pushUndo(); P().nodes[0].label = "Cliente final"; saveAutosave(true);   // hay historial y una sesión guardada
})()`;

async function script(browser, base, label) {
  const errors = [], R = {};
  const watch = (p) => { p.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message)); p.on("console", (m) => { if (m.type() === "error") errors.push(label + " console: " + m.text()); }); p.on("dialog", (d) => d.accept()); return p; };
  const newCtx = async () => { const c = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" }); await c.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort()); return c; };
  const openEditor = async (c) => {
    const p = watch(await c.newPage()); await p.goto(base + "/");
    await p.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
    if (await p.locator("#autosaveModal").isVisible()) await p.locator("#autosaveDiscard").click();
    return p;
  };
  /* ── Autor: comparte la Historia por la UI ── */
  const actx = await newCtx(), author = await openEditor(actx);
  await author.evaluate(AUTHOR);
  await author.locator("#btnShare").click();
  R.shareOffersStory = await author.locator("#shareKindStory").isChecked();
  await author.locator("#shareCreate").click();
  await author.waitForFunction(() => /\/s\/#d=/.test(document.querySelector("#shareLink").value), null, { timeout: 15000 });
  const url = await author.locator("#shareLink").inputValue();
  await author.locator("#shareClose").click();
  /* ── Destinatario con sesión guardada ── */
  const rctx = await newCtx(), mine = await openEditor(rctx);
  await mine.evaluate(RECIPIENT);
  R.mineBefore = await mine.evaluate(() => JSON.stringify(serializeProject()));
  await mine.close();
  /* Viewer: abre el enlace, reproduce y guarda lo que ejecuta */
  const viewer = watch(await rctx.newPage()); await viewer.goto(url);
  await viewer.waitForFunction(() => window.__viewer && window.__viewer.phase === "ready", null, { timeout: 15000 });
  await viewer.locator("#stPlay").click();
  await viewer.waitForFunction(() => window.__viewer.story === "completed", null, { timeout: 30000 });
  R.viewer = await viewer.evaluate(() => ({ trace: story.playback.trace, meta: story.playback.stepMeta, caption: document.querySelector("#stCaption").innerText }));
  await viewer.screenshot({ path: path.join(shots, label + "-1-viewer.png") });
  /* «Abrir en Fluyo» → el editor pregunta (hay sesión) → «Añadirlo como página nueva» */
  await viewer.locator("#btnOpen").click();
  await viewer.waitForURL((u) => !u.pathname.startsWith("/s/"), { timeout: 15000 });
  const ed = viewer;
  await ed.waitForFunction(() => typeof newNode === "function" && document.querySelector("#incomingModal").style.display === "flex", null, { timeout: 15000 });
  R.modal = await ed.locator("#incomingModal").innerText();
  await ed.locator("#incomingPage").click();
  await ed.waitForFunction(() => doc.pages.length === 2, null, { timeout: 15000 });
  const state = () => ed.evaluate(() => ({
    pages: doc.pages.map((p) => p.name), cur: doc.cur, lib: doc.eventTypes.map((e) => e.id + ":" + e.name + ":" + e.primitive + ":" + e.visual.value),
    imported: doc.pages[1].scenarios[0].steps.map((s) => { const et = eventTypeById(s.eventTypeId); return et && et.name; }),
    own: doc.pages[0].scenarios[0].steps.map((s) => { const et = eventTypeById(s.eventTypeId); return et && et.name; }),
    valid: FluyoIntegrity.validateProject(serializeProject()).valid, stacks: [undoStack.length, redoStack.length],
  }));
  R.afterAdd = await state();
  R.mineKept = await ed.evaluate((before) => { const b = JSON.parse(before).doc, d = serializeProject().doc; return JSON.stringify(b.pages[0]) === JSON.stringify(d.pages[0]) && JSON.stringify(b.eventTypes) === JSON.stringify(d.eventTypes.slice(0, b.eventTypes.length)) && b.theme === d.theme; }, R.mineBefore);
  /* Cambiar de página con las pestañas reales (a la propia y de vuelta a la importada) */
  await ed.locator("#pagesBar .tab").nth(0).click(); R.tab0 = await ed.evaluate(() => doc.cur);
  await ed.locator("#pagesBar .tab").nth(1).click(); R.tab1 = await ed.evaluate(() => doc.cur);
  /* Abrir Historias y reproducir la importada */
  await ed.locator("#tabScenarios").click();
  R.storyTitle = await ed.locator("#scScenarioTitle").innerText();
  R.storyboard = await ed.locator("#scStoryboard").innerText();
  await ed.locator("#scRun").click();
  await ed.waitForFunction(() => scPlayback && scPlayback.activeSends.length > 0, null, { timeout: 10000 });
  R.tokensDuring = await ed.evaluate(() => scPlayback.activeSends.map((s) => s.token));
  await ed.waitForTimeout(250); await ed.screenshot({ path: path.join(shots, label + "-2-editor-playing.png") });
  R.played = await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 30000 }).then(() => true, () => false);
  R.editor = await ed.evaluate(() => ({ trace: scPlayback.trace, meta: scPlayback.stepMeta }));
  await ed.screenshot({ path: path.join(shots, label + "-3-editor-done.png") });
  await ed.locator("#scReset").click(); await ed.locator("#tabProperties").click();
  /* Ctrl+Z / Ctrl+Y: la importación es una frontera de estado (pilas vacías) */
  const docJson = () => ed.evaluate(() => JSON.stringify(doc));
  const s0 = await docJson();
  const key = async (k) => { await ed.locator("#cv").click({ position: { x: 5, y: 5 } }); await ed.keyboard.press(k); await ed.waitForTimeout(120); };
  await key("Control+z"); R.undoSame = (await docJson()) === s0;
  await key("Control+y"); R.redoSame = (await docJson()) === s0;
  /* Recarga: el autoguardado conserva el documento combinado */
  await ed.waitForTimeout(900); await ed.goto(base + "/"); await ed.waitForFunction(() => typeof newNode === "function");
  if (await ed.locator("#autosaveModal").isVisible()) await ed.locator("#autosaveRestore").click();
  await ed.waitForFunction(() => doc.pages.length === 2, null, { timeout: 10000 });
  R.reload = await state();
  await actx.close(); await rctx.close();
  return { R, errors };
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const wt = await serve(root), headDir = headTree(), hd = await serve(headDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  let failed = 0;
  const check = (c, m) => { console.log((c ? "  ✔ " : "  ✘ ") + m); if (!c) failed++; };
  const same = (a, b) => UNDO15(JSON.stringify(a)) === UNDO15(JSON.stringify(b));
  try {
    const A = await script(browser, wt.base, "wt"), H = await script(browser, hd.base, "head");
    const a = A.R, h = H.R;
    check(a.shareOffersStory, "autor: «Compartir historia» es la opción por defecto");
    check(same(a.viewer.meta && Object.values(a.viewer.meta).map((m) => m.name), ["Reembolso", "Confirmación"]), "Viewer: reproduce «Reembolso» y «Confirmación»");
    check(/Añadir el diagrama como página nueva/.test(a.modal), "editor: el modal de documento entrante ofrece «Añadir el diagrama como página nueva» (sin aviso nuevo, D5)");
    check(same(a.afterAdd.pages, ["Caja", "Devoluciones"]) && a.afterAdd.cur === 1, "se añade «Devoluciones» y queda activa");
    check(same(a.afterAdd.lib, ["1:Pago:FLOW:💵", "2:Aviso:OCCURRENCE:⚠", "3:Reembolso:FLOW:↩", "4:Confirmación:OCCURRENCE:✅", "5:Archivo:OCCURRENCE:🗄"]), "biblioteca: la del receptor intacta + la del origen con ids nuevos " + JSON.stringify(a.afterAdd.lib));
    check(same(a.afterAdd.imported, ["Reembolso", "Confirmación"]) && same(a.afterAdd.own, ["Pago", "Aviso"]), "Steps: los importados → sus EventTypes de origen; los propios → «Pago»/«Aviso»");
    check(a.afterAdd.valid && same(a.afterAdd.stacks, [0, 0]), "documento válido; Undo/Redo vacíos");
    check(a.mineKept, "la página, la biblioteca y el tema del receptor no cambian");
    check(a.tab0 === 0 && a.tab1 === 1, "las pestañas cambian de página");
    check(/Devolución/.test(a.storyTitle) && /Reembolso/.test(a.storyboard) && !/Pago/.test(a.storyboard), "Historias: «Devolución» muestra «Reembolso», no «Pago»");
    check(a.tokensDuring.includes("↩") && !a.tokensDuring.includes("💵"), "Playback del editor: el símbolo que viaja es ↩ (no 💵) " + JSON.stringify(a.tokensDuring));
    check(a.played, "la Historia importada se reproduce entera");
    check(same(a.editor.trace, a.viewer.trace) && same(a.editor.meta, a.viewer.meta), "editor = Viewer: mismo Trace y misma metadata de Playback");
    check(a.undoSame && a.redoSame, "Ctrl+Z / Ctrl+Y tras añadir: sin efecto (frontera de estado)");
    check(same(a.reload.lib, a.afterAdd.lib) && a.reload.valid && same(a.reload.imported, ["Reembolso", "Confirmación"]), "recarga: documento combinado válido y con sus EventTypes");
    check(same(h.afterAdd, a.afterAdd), "HEAD (que ya incluye 018.8): la biblioteca entrante se importa con ids nuevos, igual que en el árbol de trabajo " + JSON.stringify(h.afterAdd.lib));
    check(same(h.afterAdd.imported, ["Reembolso", "Confirmación"]) && h.afterAdd.valid && same(h.reload, a.reload), "HEAD (que ya incluye 018.8): la Historia importada se resuelve con «Reembolso»/«Confirmación» (ya no el fallo silencioso) y sobrevive a la recarga");
    check(same(h.tokensDuring, a.tokensDuring) && !h.tokensDuring.includes("💵") && same(h.editor, a.editor) && same(h.editor.meta, h.viewer.meta), "HEAD (que ya incluye 018.8): el editor reproduce ↩ (no 💵) y su Trace y metadata coinciden con el Viewer y con el árbol de trabajo");
    check(same(h, a), "HEAD (que ya incluye 018.8): el guion entero da resultados idénticos al árbol de trabajo");
    check(A.errors.length === 0, "sin errores de consola/página" + (A.errors.length ? ": " + A.errors.join(" | ") : ""));
  } finally { await browser.close(); wt.server.close(); hd.server.close(); fs.rmSync(headDir, { recursive: true, force: true }); }
  console.log("\ncapturas en " + shots);
  console.log(failed ? failed + " comprobación(es) fallida(s)" : "Chrome real OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
