"use strict";
/* FLUYO-018.7c — QA en Chrome REAL: ratón, teclado, diálogos confirm/prompt reales y táctil de Playwright sobre el editor.
   Borrar páginas (primera, intermedia, última, activa, con Historias y Behaviors), Cancelar/Aceptar, Undo/Redo estructural, cambio de
   página, F1, crear tras borrar, Playback, autoguardado + recarga, Share/Viewer, Presentar y viewport táctil estrecho.
   El mismo guion se ejecuta contra el árbol de trabajo y contra HEAD: los documentos tras Cancelar y tras borrar sin deshacer deben
   COINCIDIR en páginas y contenido. Cuando se escribió, HEAD era 018.7a (hotfix que vaciaba Undo/Redo) y diferían por diseño la página
   activa al borrar una anterior (F2) y el Undo/Redo del borrado. HEAD ya incluye 018.7c (2d960d9): desde entonces esos resultados de
   HEAD deben ser IDÉNTICOS a los del árbol de trabajo (FLUYO-018.10, mismo criterio que 018.5 con el oráculo de 018.4).
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-018-7c-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-7c-"));
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

/* Contenido de las páginas (el resto del documento se crea con la UI real): A 1 nodo · B 3 nodos, 2 conexiones (una con waypoints),
   Behavior DOWN, Historia «Compra» (2 pasos) y «Vacía» · C 1 nodo · D nada. */
const FILL = () => {
  const at = (name) => doc.pages.find((p) => p.name === name);
  const put = (name, fn) => { const keep = doc.cur; doc.cur = doc.pages.indexOf(at(name)); fn(); doc.cur = keep; };
  put("A", () => newNode("rect", 300, 300, { label: "a0" }));
  put("B", () => {
    const x = newNode("rect", 200, 200, { label: "Cliente" }), y = newNode("rect", 520, 200, { label: "Banco" }), z = newNode("rect", 840, 200, { label: "Comercio" });
    const e1 = newEdge(x.id, y.id, { waypoints: [{ x: 360, y: 140 }, { x: 360, y: 260 }], label: "paga" }); newEdge(y.id, z.id);
    setInitialAvailability(P(), z.id, "DOWN");
    const et = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
    const sc = createScenario(P(), "Compra"); createStep(sc, { at: 0, action: "SEND", edgeId: e1.id, eventTypeId: et.id }); createStep(sc, { at: 1500, action: "SEND", edgeId: e1.id, eventTypeId: et.id });
    createScenario(P(), "Vacía");
  });
  put("C", () => newNode("rect", 300, 300, { label: "c0" }));
  undoStack.length = 0; redoStack.length = 0; clearSel(); renderTabs();
};

async function script(browser, base, label) {
  const errors = [], dialogs = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const ed = await ctx.newPage();
  ed.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message));
  ed.on("console", (m) => { if (m.type() === "error") errors.push(label + " console: " + m.text()); });
  let confirmAnswer = true, promptValue = null;
  ed.on("dialog", (d) => {
    dialogs.push({ type: d.type(), message: d.message() });
    if (d.type() === "prompt") d.accept(promptValue); else if (d.type() === "confirm" && !confirmAnswer) d.dismiss(); else d.accept();
  });
  const open = async () => { await ed.goto(base + "/"); await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined"); if (await ed.locator("#autosaveModal").isVisible()) await ed.locator("#autosaveDiscard").click(); };
  const R = {}, docs = {};
  const tab = (i) => ed.locator("#pagesBar .tab").nth(i);
  const close = async (i) => { await tab(i).locator(".x").click(); await ed.waitForTimeout(60); };
  const names = () => ed.evaluate(() => doc.pages.map((p) => p.name));
  const active = () => ed.evaluate(() => doc.pages[doc.cur].name);
  const stacks = () => ed.evaluate(() => ({ u: undoStack.length, r: redoStack.length }));
  const pagesJson = () => ed.evaluate(() => JSON.stringify(serializeProject().doc.pages)).then(UNDO15);
  /* contenido de una página sin contadores de identidad (nunca bajan con Undo: un id eliminado no se reutiliza) */
  const pageContent = (name) => ed.evaluate((n) => JSON.stringify(doc.pages.find((p) => p.name === n) || null, (k, v) => /^next(Id|ScenarioId|StepId)$/.test(k) ? undefined : v), name);
  const pageJson = (name) => ed.evaluate((n) => JSON.stringify(doc.pages.find((p) => p.name === n) || null), name);
  const key = async (k) => { await ed.keyboard.press(k); await ed.waitForTimeout(80); };
  const lastDialog = () => dialogs[dialogs.length - 1];

  /* ═══ Crear y renombrar páginas con la UI real (＋ y doble clic → prompt) ═══ */
  const build = async () => {
    await ed.evaluate(() => { doc.pages.length = 1; doc.cur = 0; P().nodes = []; P().edges = []; P().scenarios = []; P().behaviors = []; P().nextId = 1; doc.eventTypes = []; scReset(); undoStack.length = 0; redoStack.length = 0; renderTabs(); });
    for (let k = 0; k < 3; k++) await ed.locator("#pagesBar button").click();
    for (const [i, n] of [[0, "A"], [1, "B"], [2, "C"], [3, "D"]]) { promptValue = n; await tab(i).dblclick(); }
    promptValue = null;
    await ed.evaluate(`(${FILL.toString()})()`);
    await tab(1).click();                                                     // activa: B
  };
  await open(); await build();
  R.built = { names: await names(), active: await active(), tabs: await ed.locator("#pagesBar .tab").count(), x: await ed.locator("#pagesBar .tab .x").count() };
  const pageB = await pageJson("B"), pageBContent = await pageContent("B");
  docs.initial = await pagesJson();

  /* ═══ Cancelar (página con Historias): nada cambia ═══ */
  const s0 = await stacks();
  confirmAnswer = false; await close(1); confirmAnswer = true;
  R.cancel = { names: await names(), active: await active(), stacks: await stacks(), before: s0, message: lastDialog().message, same: (await pagesJson()) === docs.initial };
  docs.afterCancel = await pagesJson();
  // y cancelar en una página vacía muestra el aviso corto
  confirmAnswer = false; await close(3); confirmAnswer = true;
  R.cancelEmpty = lastDialog().message;

  /* ═══ Borrar la PRIMERA (anterior a la activa) → Undo → Redo → Undo ═══ */
  await close(0);
  R.delFirst = { names: await names(), active: await active(), stacks: await stacks() };
  docs.delFirst = await pagesJson();
  await key("Control+z"); R.delFirstUndo = { names: await names(), active: await active(), same: (await pagesJson()) === docs.initial };
  await key("Control+y"); R.delFirstRedo = { names: await names(), active: await active() };
  await key("Control+z"); R.delFirstUndo2 = { names: await names(), active: await active() };
  /* El guion de HEAD termina aquí. Cuando se escribió (HEAD = 018.7a) HEAD no deshacía borrados y lo que sigue solo tenía sentido en el
     árbol de trabajo; HEAD ya los deshace y lo recorrido hasta aquí se exige idéntico al árbol de trabajo. */
  if (label === "head") { await ctx.close(); return { R, docs, errors, dialogs }; }

  /* ═══ Borrar la INTERMEDIA posterior a la activa y la ÚLTIMA siendo la activa; Undo×2 ═══ */
  await tab(1).click();
  await close(2);                                                             // C
  R.delMiddle = { names: await names(), active: await active() };
  await tab(2).click();                                                       // D (última) activa
  await close(2);
  R.delLast = { names: await names(), active: await active() };
  await key("Control+z"); R.delLastUndo = { names: await names(), active: await active() };
  await key("Control+z"); R.delMiddleUndo = { names: await names(), active: await active(), same: (await pagesJson()) === docs.initial };

  /* ═══ Borrar la ACTIVA con Historias y Behavior; Undo la restaura entera ═══ */
  await tab(1).click();
  await close(1);
  R.delActive = { names: await names(), active: await active(), message: lastDialog().message, eventTypes: await ed.evaluate(() => doc.eventTypes.map((e) => e.name)) };
  await key("Control+z");
  R.delActiveUndo = { names: await names(), active: await active(), pageSame: (await pageJson("B")) === pageB, story: await ed.evaluate(() => P().scenarios.map((s) => s.name + ":" + s.steps.length)), behaviors: await ed.evaluate(() => P().behaviors.length) };

  /* ═══ F1: editar B con el ratón, borrar A, Ctrl+Z ×2 ═══ */
  await tab(1).click();
  await ed.locator('button[data-shape="circle"]').click();
  const pt = await ed.evaluate(() => { const r = cv.getBoundingClientRect(); return { x: r.left + 600 * viewZoom + viewX, y: r.top + 500 * viewZoom + viewY }; });
  await ed.mouse.click(pt.x, pt.y);
  const cBefore = await pageJson("C");
  R.f1Edit = await ed.evaluate(() => P().nodes.length);
  await close(0);
  await key("Control+z");
  R.f1 = { names: await names(), active: await active(), cIntact: (await pageJson("C")) === cBefore, bNodes: await ed.evaluate(() => doc.pages[1].nodes.length) };
  await key("Control+z");
  R.f1Undo2 = { bSame: (await pageContent("B")) === pageBContent, bCounters: await ed.evaluate(() => doc.pages[1].nextId), cIntact: (await pageJson("C")) === cBefore };

  /* ═══ Borrar y luego crear otra página; Undo ═══ */
  await close(2);                                                             // C
  await ed.locator("#pagesBar button").click();
  R.createAfter = { names: await names(), active: await active() };
  await key("Control+z");
  R.createAfterUndo = { names: await names(), active: await active() };

  /* ═══ Playback en marcha + ✕ de otra página ═══ */
  await tab(1).click();
  await ed.evaluate(() => { scSelectStory(P().scenarios[0].id); });
  await ed.locator("#tabScenarios").click(); await ed.locator("#scRun").click();
  await ed.waitForFunction(() => scStatus === "running", null, { timeout: 5000 });
  const nPages = (await names()).length;
  await close(nPages - 1);
  R.playback = { status: await ed.evaluate(() => scStatus), names: await names(), active: await active() };
  await key("Control+z");
  R.playbackUndo = await names();
  await ed.locator("#tabProperties").click();

  /* ═══ Guardar (autoguardado) y reabrir ═══ */
  await close(0);                                                             // A
  docs.saved = await pagesJson();
  R.saved = { names: await names(), active: await active() };
  await ed.waitForTimeout(900);
  await ed.reload(); await ed.waitForFunction(() => typeof newNode === "function");
  await ed.locator("#autosaveRestore").click();
  await ed.waitForFunction(() => doc.pages.length > 0);
  R.reopened = { names: await names(), active: await active(), same: (await pagesJson()) === docs.saved, stacks: await stacks() };

  /* ═══ Share/Viewer del documento resultante ═══ */
  await ed.evaluate(() => { scReset(); });
  await ed.locator("#btnShare").click(); await ed.locator("#shareCreate").click();
  await ed.waitForFunction(() => document.getElementById("shareLink").value.includes("/s/#d="), null, { timeout: 8000 });
  const link = await ed.locator("#shareLink").inputValue(); await ed.locator("#shareClose").click();
  const v = await ctx.newPage();
  v.on("pageerror", (e) => errors.push(label + " viewer pageerror: " + e.message));
  await v.goto(link); await v.waitForFunction(() => typeof doc !== "undefined" && doc.pages && doc.pages.length > 0, null, { timeout: 10000 });
  R.viewer = await v.evaluate(() => ({ names: doc.pages.map((p) => p.name), cur: doc.cur }));
  R.viewerExpected = { names: await names(), cur: await ed.evaluate(() => doc.cur) };
  await v.screenshot({ path: path.join(shots, label + "-viewer.png") }); await v.close();

  /* ═══ Presentar: las diapositivas son las páginas restantes ═══ */
  await ed.keyboard.press("p"); await ed.waitForTimeout(150);
  R.present = { pos: await ed.locator("#prPos").textContent() };
  await ed.keyboard.press("Escape"); await ed.waitForTimeout(150);

  /* ═══ Una sola página: sin ✕ ═══ */
  while ((await names()).length > 1) await close(0);
  R.single = { x: await ed.locator("#pagesBar .tab .x").count(), names: await names() };
  await ed.screenshot({ path: path.join(shots, label + "-desktop.png") });
  await ctx.close();

  /* ═══ Viewport estrecho y táctil: la ✕ existe y responde al toque ═══ */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await mctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push(label + " mobile pageerror: " + e.message));
  mp.on("dialog", (d) => { dialogs.push({ type: d.type(), message: d.message() }); d.accept(); });
  await mp.goto(base + "/"); await mp.waitForFunction(() => typeof newNode === "function");
  if (await mp.locator("#autosaveModal").isVisible()) await mp.locator("#autosaveDiscard").click();
  await mp.evaluate(() => { addPage(); P().name = "Móvil"; doc.cur = 0; renderTabs(); undoStack.length = 0; redoStack.length = 0; });
  const mx = mp.locator("#pagesBar .tab").nth(1).locator(".x");
  R.mobile = { visible: await mx.isVisible() };
  if (R.mobile.visible) { const b = await mx.boundingBox(); R.mobile.box = b && [Math.round(b.width), Math.round(b.height)]; await mx.tap(); await mp.waitForTimeout(100); }
  R.mobile.names = await mp.evaluate(() => doc.pages.map((p) => p.name));
  R.mobile.undo = await mp.evaluate(() => { undo(); return doc.pages.map((p) => p.name); });
  await mp.screenshot({ path: path.join(shots, label + "-mobile.png") });
  await mctx.close();
  return { R, docs, errors, dialogs };
}

(async () => {
  const wt = await serve(root);
  const headDir = headTree();
  const hd = await serve(headDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  let failed = 0;
  const check = (cond, msg) => { if (cond) console.log("  ✔ " + msg); else { failed++; console.log("  ✘ " + msg); } };
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  try {
    const A = await script(browser, wt.base, "wt");
    const H = await script(browser, hd.base, "head");
    const a = A.R, h = H.R;
    console.log("\nCrear y renombrar con la UI");
    check(same(a.built, { names: ["A", "B", "C", "D"], active: "B", tabs: 4, x: 4 }), "＋ ×3 y doble clic → A,B,C,D, activa B, 4 ✕ " + JSON.stringify(a.built));
    console.log("\nCancelar");
    check(a.cancel.same && same(a.cancel.stacks, a.cancel.before) && a.cancel.active === "B", "Cancelar no cambia documento, página activa ni pilas");
    check(/«B» tiene 3 elementos, 2 conexiones, 1 condición de disponibilidad inicial y 2 Historias/.test(a.cancel.message) && /• Compra — 2 momentos/.test(a.cancel.message) && /• Vacía — sin momentos/.test(a.cancel.message) && /Ctrl\+Z/.test(a.cancel.message), "el aviso nombra el contenido, las Historias y sus momentos");
    check(a.cancelEmpty === "¿Eliminar «D»?" && h.cancelEmpty === "¿Eliminar «D»?", "página vacía: el mismo aviso corto que HEAD");
    check(A.docs.afterCancel === H.docs.afterCancel && A.docs.initial === H.docs.initial, "documento idéntico a HEAD tras crear, renombrar y cancelar");
    console.log("\nBorrar la primera (anterior a la activa)");
    check(same(a.delFirst.names, ["B", "C", "D"]) && a.delFirst.active === "B", "quedan B,C,D y la activa sigue siendo B (F2 corregido) " + JSON.stringify(a.delFirst));
    check(same(h.delFirst, a.delFirst), "HEAD (que ya incluye 018.7c, F2): las mismas páginas, la activa sigue siendo B y la misma entrada de Undo que el árbol de trabajo " + JSON.stringify(h.delFirst));
    check(A.docs.delFirst === H.docs.delFirst, "mismas páginas y contenido que HEAD tras el borrado");
    check(a.delFirst.stacks.u === 1 && a.delFirst.stacks.r === 0, "una entrada de Undo (HEAD: " + JSON.stringify(h.delFirst.stacks) + ")");
    check(same(a.delFirstUndo, { names: ["A", "B", "C", "D"], active: "B", same: true }), "Ctrl+Z reinserta A en su sitio, idéntica; activa B");
    check(same(a.delFirstRedo, { names: ["B", "C", "D"], active: "B" }) && same(a.delFirstUndo2.names, ["A", "B", "C", "D"]), "Ctrl+Y la vuelve a borrar y Ctrl+Z la restaura");
    check(same(h.delFirstUndo, a.delFirstUndo) && same(h.delFirstRedo, a.delFirstRedo) && same(h.delFirstUndo2, a.delFirstUndo2),
      "HEAD (que ya incluye 018.7c): Ctrl+Z / Ctrl+Y / Ctrl+Z del borrado, idénticos al árbol de trabajo (A vuelve en su sitio, idéntica)");
    console.log("\nIntermedia y última");
    check(same(a.delMiddle, { names: ["A", "B", "D"], active: "B" }), "borrar C (posterior a la activa): la activa no cambia");
    check(same(a.delLast, { names: ["A", "B"], active: "B" }), "borrar D siendo la última y activa: pasa a la anterior");
    check(same(a.delLastUndo, { names: ["A", "B", "D"], active: "D" }) && same(a.delMiddleUndo, { names: ["A", "B", "C", "D"], active: "B", same: true }), "Undo ×2: D y luego C vuelven a su posición, con la activa de cada momento; documento idéntico al inicial");
    console.log("\nBorrar la activa con Historias y Behavior");
    check(same(a.delActive.names, ["A", "C", "D"]) && a.delActive.active === "C" && same(a.delActive.eventTypes, ["Pago"]), "pasa a la siguiente; el EventType global se conserva " + JSON.stringify(a.delActive));
    check(a.delActiveUndo.pageSame && a.delActiveUndo.active === "B" && same(a.delActiveUndo.story, ["Compra:2", "Vacía:0"]) && a.delActiveUndo.behaviors === 1, "Undo restaura B entera (nodos, conexiones, waypoints, Behavior, Historias y Steps) y la activa");
    console.log("\nF1");
    check(a.f1.cIntact && a.f1.f1Edit !== null && same(a.f1.names, ["A", "B", "C", "D"]) && a.f1.active === "B" && a.f1.bNodes === 4, "editar B, borrar A, Ctrl+Z: A vuelve, B conserva su edición y C está intacta " + JSON.stringify(a.f1));
    check(a.f1Undo2.bSame && a.f1Undo2.cIntact, "segundo Ctrl+Z: la edición de B se deshace EN B (contenido idéntico; el contador de ids no baja: " + a.f1Undo2.bCounters + "); C sigue intacta");
    console.log("\nCrear tras borrar");
    check(same(a.createAfter, { names: ["A", "B", "D", "Página 4"], active: "Página 4" }) && same(a.createAfterUndo, { names: ["A", "B", "C", "D", "Página 4"], active: "B" }), "la nueva va al final; Undo reinserta C en su sitio " + JSON.stringify([a.createAfter, a.createAfterUndo]));
    console.log("\nPlayback");
    check(a.playback.status === "idle" && a.playback.names.length === 4 && a.playback.active === "B", "✕ durante el Playback: lo detiene y borra " + JSON.stringify(a.playback));
    check(a.playbackUndo.length === 5, "Undo tras el Playback restaura la página");
    console.log("\nGuardar y reabrir");
    check(a.reopened.same && same(a.reopened.names, a.saved.names) && a.reopened.active === a.saved.active, "autoguardado + recarga + restaurar: mismas páginas y activa " + JSON.stringify(a.reopened));
    check(a.reopened.stacks.u === 0, "un documento recién abierto empieza sin historial");
    console.log("\nShare/Viewer y Presentar");
    check(same(a.viewer, a.viewerExpected), "el Viewer abre el documento resultante con la misma página activa " + JSON.stringify(a.viewer));
    check(a.present.pos === `${a.viewerExpected.cur + 1} / ${a.viewerExpected.names.length}`, "Presentar: diapositivas = páginas restantes (" + a.present.pos + ")");
    console.log("\nÚltima página y táctil");
    check(a.single.x === 0 && a.single.names.length === 1, "con una sola página no hay ✕");
    check(a.mobile.visible ? same(a.mobile.names, ["Página 1"]) && same(a.mobile.undo, ["Página 1", "Móvil"]) : true, "viewport 390×844 táctil: " + (a.mobile.visible ? "la ✕ (" + JSON.stringify(a.mobile.box) + ") responde al toque, confirma y se deshace" : "la ✕ no es visible"));
    console.log("\nErrores de consola/página");
    check(A.errors.length === 0, "sin errores en el árbol de trabajo" + (A.errors.length ? ": " + A.errors.slice(0, 3).join(" | ") : ""));
    fs.writeFileSync(path.join(shots, "report.json"), JSON.stringify({ wt: A.R, head: H.R, wtDialogs: A.dialogs, headErrors: H.errors }, null, 2));
  } finally {
    await browser.close(); wt.server.close(); hd.server.close();
  }
  console.log("\ncapturas e informe en " + shots);
  console.log(failed ? failed + " comprobación(es) fallida(s)" : "Chrome real OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
