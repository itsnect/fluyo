"use strict";
/* FLUYO-018.4 — QA en Chrome REAL (Playwright, ratón/teclado/táctil reales) de la política de borrado del editor:
   confirmar sólo si una Historia usa lo que se borra, un diálogo por borrado, Cancelar = cero cambios y cero Undo,
   el Behavior se va con su nodo y Undo lo restaura, Steps/Historias intactos, Playback congelado (Supr, botón, menú de selección
   múltiple, papelera táctil y Ctrl+X), cambio de página, Share/Viewer, documento antiguo con Behavior huérfano y responsive.
   Parte de los casos se ejecuta también contra HEAD (git archive → carpeta temporal) para fijar lo que NO debe cambiar.
   Playwright se proporciona externamente (NODE_PATH); capturas fuera del repo.
   Uso: node test/fluyo-018-4-browser.cjs   (FLUYO_BROWSER=chrome por defecto; FLUYO_SHOTS=<dir>) */
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("playwright-core")); }
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const shots = process.env.FLUYO_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-4-"));
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

/* Sesión de editor con helpers. `dialogs` registra los confirm() NATIVOS; el stub de página (__confirms) registra el estado en el
   instante de la llamada (el documento no puede haber cambiado todavía). */
async function session(browser, base, label, opts = {}) {
  const errors = [], dialogs = [];
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", acceptDownloads: true }, opts.context || {}));
  await ctx.route(/https:\/\/(cloud|gateway)\.umami\.is\//, (r) => r.abort());
  const ed = await ctx.newPage();
  const policy = { accept: true };
  ed.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message));
  ed.on("console", (m) => { if (m.type() === "error") errors.push(label + " console: " + m.text()); });
  ed.on("dialog", (d) => { dialogs.push(d.message()); policy.accept ? d.accept() : d.dismiss(); });
  await ed.goto(base + "/");
  await ed.waitForFunction(() => typeof newNode === "function" && typeof FluyoStory !== "undefined");
  const S = { ed, ctx, errors, dialogs, policy, label };
  S.state = () => ed.evaluate(() => JSON.stringify({ doc: serializeProject(), sel: [[...selN].sort(), [...selE].sort()], undo: undoStack.length, redo: redoStack.length }));
  S.docJson = () => ed.evaluate(() => JSON.stringify(serializeProject()));
  S.pt = (kind, i, u = 0.5) => ed.evaluate(({ kind, i, u }) => {
    const r = cv.getBoundingClientRect();
    if (kind === "node") { const n = P().nodes[i]; return { x: r.left + n.x * viewZoom + viewX, y: r.top + (n.y - 12) * viewZoom + viewY }; }
    const pts = edgePoints(P().edges[i]), m = pointAt(pts, u); return { x: r.left + m.x * viewZoom + viewX, y: r.top + m.y * viewZoom + viewY };
  }, { kind, i, u });
  S.click = async (kind, i, mods = []) => { const p = await S.pt(kind, i); for (const m of mods) await ed.keyboard.down(m); await ed.mouse.click(p.x, p.y); for (const m of mods) await ed.keyboard.up(m); };
  S.stub = (answer) => ed.evaluate((a) => { window.__native = window.__native || window.confirm; window.__answer = a; window.__confirms = []; window.confirm = (m) => { window.__confirms.push({ msg: m, doc: JSON.stringify(serializeProject()), undo: undoStack.length }); return window.__answer; }; }, answer);
  S.unstub = () => ed.evaluate(() => { if (window.__native) window.confirm = window.__native; });
  S.confirms = () => ed.evaluate(() => window.__confirms || []);
  S.setAnswer = (a) => ed.evaluate((v) => { window.__answer = v; }, a);
  /* Diagrama de partida: Cliente(0) Comercio(1) Banco(2, DOWN) Aparte(3) Libre(4); pago(0) Cliente→Comercio, cobro(1) Comercio→Banco,
     libre(2) Aparte→Libre, extra(3) Cliente→Aparte. «Compra» usa pago y cobro; «Reembolsos» usa cobro; «Solo pago» usa pago; «Vacía» sin momentos. */
  S.build = () => ed.evaluate(() => {
    doc.eventTypes = []; doc.pages.length = 1; doc.cur = 0; doc.nextEventTypeId = 1;
    const pg = P(); pg.nodes = []; pg.edges = []; pg.scenarios = []; pg.behaviors = []; pg.nextId = 1; pg.nextScenarioId = 1;
    undoStack.length = 0; redoStack.length = 0; clip = null; scReset(); clearSel(); viewX = 0; viewY = 0; viewZoom = 1;
    const mk = (l, x, y) => { const n = newNode("rect", x, y); n.label = l; return n; };
    const c = mk("Cliente", 200, 200), m = mk("Comercio", 560, 200), b = mk("Banco", 560, 420), a = mk("Aparte", 200, 420), l = mk("Libre", 900, 200);
    const e1 = newEdge(c.id, m.id), e2 = newEdge(m.id, b.id), e3 = newEdge(a.id, l.id), e4 = newEdge(c.id, a.id);
    const pago = createEventType({ name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { value: "💵" } });
    const mkStory = (name, edges) => { const sc = createScenario(P(), name); edges.forEach((e, i) => createStep(sc, { at: i * 1000, action: "SEND", edgeId: e.id, eventTypeId: pago.id })); return sc; };
    mkStory("Compra", [e1, e2]); mkStory("Reembolsos", [e2]); mkStory("Solo pago", [e1]); mkStory("Vacía", []);
    setInitialAvailability(P(), b.id, "DOWN");
    scSelectStory(P().scenarios[0].id); scRefreshIfVisible(); refreshPanel();
    undoStack.length = 0;
  });
  S.valid = () => ed.evaluate(() => FluyoIntegrity.validateProject(serializeProject()).valid);
  S.storyOk = (name) => ed.evaluate((name) => { const sc = P().scenarios.find((s) => s.name === name); return FluyoScenarios.runScenario({ nodes: P().nodes, edges: P().edges }, P().behaviors, sc).ok; }, name);
  return S;
}

const results = [];
const ok = (cond, msg) => { results.push([!!cond, msg]); console.log((cond ? "  ✔ " : "  ✘ ") + msg); };

/* ───────────── A. Ejecutable contra el árbol de trabajo y HEAD: lo que NO debe cambiar ───────────── */
async function noImpactScript(browser, base, label) {
  const S = await session(browser, base, label); const { ed } = S;
  const docs = [];
  await S.build();
  await S.stub(true);
  const initial = await S.docJson();
  /* nodo sin Historias afectadas (Libre está solo en una conexión que ninguna Historia usa) y conexión sin Historias */
  await S.click("edge", 2); await ed.keyboard.press("Delete");               // conexión libre
  docs.push(["borrar conexión sin Historia", await S.docJson()]);
  await S.click("node", 3); await ed.keyboard.press("Delete");               // Aparte (con la conexión extra)
  docs.push(["borrar nodo sin Historia", await S.docJson()]);
  const confirms = (await S.confirms()).length;
  await ed.keyboard.press("Control+z"); await ed.keyboard.press("Control+z");
  docs.push(["undo ×2", await S.docJson()]);
  await ed.keyboard.press("Control+y"); await ed.keyboard.press("Control+y");
  docs.push(["redo ×2", await S.docJson()]);
  /* crear / mover / redimensionar */
  await ed.evaluate(() => { newNode("rect", 900, 200); });
  await ed.evaluate(() => { const n = P().nodes[P().nodes.length - 1]; Object.assign(n, { x: 920, y: 240, w: 200 }); });
  docs.push(["crear/mover/redimensionar", await S.docJson()]);
  const reopened = await ed.evaluate(async () => { const t = JSON.stringify(serializeProject(), null, 2); return t.length; });
  await S.ctx.close();
  return { docs, confirms, errors: S.errors, reopened, initial };
}

(async () => {
  const wt = await serve(root);
  const headDir = headTree();
  const hd = await serve(headDir);
  const browser = await chromium.launch({ channel: process.env.FLUYO_BROWSER || "chrome", headless: true });
  try {
    /* ============ A. Regresión contra HEAD (sin impacto) ============ */
    console.log("\nA. Sin impacto: idéntico a HEAD");
    const a = await noImpactScript(browser, wt.base, "wt"), b = await noImpactScript(browser, hd.base, "head");
    ok(a.errors.length + b.errors.length === 0, "0 errores de consola/página" + (a.errors.concat(b.errors).length ? ": " + a.errors.concat(b.errors).join(" | ") : ""));
    ok(a.confirms === 0, "borrar nodo/conexión sin Historias afectadas NO abre ningún diálogo (aunque la página tenga Historias)");
    const norm = (j) => { const d = JSON.parse(j); return UNDO15(JSON.stringify(d)); };
    ok(norm(a.initial) === norm(b.initial), "documento de partida idéntico a HEAD");
    a.docs.forEach(([name, json], i) => {
      /* FLUYO-018.12 (decisión 119): un clic sin mover ya no apila Undo. En HEAD el clic que selecciona «Aparte» apilaba una
         entrada vacía, así que dos Ctrl+Z deshacían solo el borrado del nodo; ahora deshacen los dos borrados, que es lo que se
         pidió. Se afirma el resultado correcto y se deja constancia de la diferencia, en vez de exigir la entrada vacía de HEAD. */
      if (name === "undo ×2") {
        ok(norm(json) === norm(a.initial), "«undo ×2»: dos Ctrl+Z deshacen los dos borrados (vuelve el documento de partida)");
        ok(norm(b.docs[i][1]) === norm(b.docs[0][1]), "HEAD: «undo ×2» solo deshacía uno (el clic de selección apilaba una entrada vacía) — diferencia intencional de 018.12");
        return;
      }
      ok(norm(json) === norm(b.docs[i][1]), `«${name}»: documento idéntico a HEAD`);
    });

    /* ============ B. QA completa en el árbol de trabajo ============ */
    console.log("\nB. Política con impacto");
    const S = await session(browser, wt.base, "wt"); const { ed } = S;
    await S.build(); await S.stub(false);
    const idle = await S.state();
    ok(await S.valid(), "documento de partida válido (Banco con Behavior DOWN, 4 Historias)");

    /* B1. nodo con Behavior usado por Historias: Cancelar */
    await S.click("node", 2);
    ok((await S.state()).includes('"sel":[["3"') || JSON.parse(await S.state()).sel[0].length === 1, "el clic real selecciona Banco");
    const before = await S.state();
    await ed.keyboard.press("Delete");
    let cf = await S.confirms();
    ok(cf.length === 1, "Supr con Banco seleccionado abre UN diálogo");
    ok(cf[0] && JSON.stringify(JSON.parse(cf[0].doc)) === JSON.stringify(JSON.parse(before).doc) && cf[0].undo === JSON.parse(before).undo, "el diálogo aparece ANTES de modificar el documento y de registrar Undo");
    const msg = cf[0].msg;
    ok(/^Este elemento se usa en 2 Historias:/.test(msg) && /• Compra — 1 momento \(Comercio → Banco\)/.test(msg) && /• Reembolsos — 1 momento \(Comercio → Banco\)/.test(msg), "el mensaje nombra Historias, momentos y destinos");
    ok(/Si lo eliminas, esos momentos dejarán de funcionar\./.test(msg) && /También se eliminará su condición de disponibilidad inicial\./.test(msg) && /¿Quieres eliminarlo de todas formas\?$/.test(msg), "el mensaje avisa del Behavior y pregunta «de todas formas»");
    ok(!/Solo pago|Vacía/.test(msg), "las Historias que no lo usan no aparecen");
    ok((await S.state()) === before, "CANCELAR: documento, selección, Undo/Redo y Behavior exactamente iguales");
    ok(JSON.parse(before).doc.doc.pages[0].behaviors.length === 1 && JSON.parse(await S.state()).doc.doc.pages[0].behaviors.length === 1, "el Behavior sigue ahí tras cancelar");

    /* B2. Aceptar */
    await S.setAnswer(true);
    const stories0 = await ed.evaluate(() => JSON.stringify(P().scenarios));
    await ed.keyboard.press("Delete");
    const after = JSON.parse(await S.state());
    ok(after.undo === JSON.parse(before).undo + 1, "ACEPTAR genera UNA sola entrada de Undo");
    ok(after.doc.doc.pages[0].nodes.length === 4 && after.doc.doc.pages[0].edges.length === 3, "se borra el nodo y su conexión incidente");
    ok(after.doc.doc.pages[0].behaviors.length === 0, "el Behavior se elimina junto al nodo");
    ok(await ed.evaluate(() => JSON.stringify(P().scenarios)) === stories0, "Steps e Historias NO se modifican");
    ok((await S.confirms()).length === 2, "un diálogo por borrado (no uno por elemento)");
    ok((await S.storyOk("Solo pago")) && (await S.storyOk("Vacía")) && !(await S.storyOk("Compra")) && !(await S.storyOk("Reembolsos")), "sólo fallan las Historias afectadas; las demás de la página siguen siendo ejecutables (sin Behavior huérfano)");
    /* mensaje legible en la fila rota */
    await ed.locator("#tabScenarios").click();
    const rowText = await ed.evaluate(() => document.getElementById("scStoryboard").innerText);
    ok(/ya no existe/.test(rowText), "el storyboard de la Historia rota muestra «ya no existe»");
    await ed.screenshot({ path: path.join(shots, "B2-rota.png") });
    /* B3. Undo / Redo */
    await ed.locator("canvas#cv").click({ position: { x: 5, y: 5 } }); await ed.keyboard.press("Escape");
    const afterClick = JSON.parse(await S.state()).undo;
    await ed.keyboard.press("Control+z");
    for (let i = 0; i < 4 && JSON.parse(await S.docJson()).doc.pages[0].nodes.length !== 5; i++) await ed.keyboard.press("Control+z");
    const undone = JSON.parse(await S.docJson()).doc.pages[0];
    ok(undone.nodes.length === 5 && undone.behaviors.length === 1 && JSON.stringify(await ed.evaluate(() => P().scenarios)) === stories0, "Undo restaura nodo, conexión, Behavior e Historias");
    ok((await S.confirms()).length === 2, "Undo no abre diálogos");
    await ed.keyboard.press("Control+y");
    for (let i = 0; i < 4 && JSON.parse(await S.docJson()).doc.pages[0].nodes.length !== 4; i++) await ed.keyboard.press("Control+y");
    ok(JSON.parse(await S.docJson()).doc.pages[0].behaviors.length === 0 && (await S.confirms()).length === 2, "Redo repite el borrado (Behavior incluido) SIN volver a preguntar");

    /* B4. conexión usada por una Historia + Cancelar/Aceptar (botón del panel) */
    await S.build(); await S.stub(false);
    await S.click("edge", 0);                                               // pago: usado por Compra y Solo pago
    const b4 = await S.state();
    await ed.evaluate(() => document.getElementById("btnDel").click());
    cf = await S.confirms();
    ok(cf.length === 1 && /^Esta conexión se usa en 2 Historias:/.test(cf[0].msg) && /Si la eliminas/.test(cf[0].msg) && /eliminarla de todas formas/.test(cf[0].msg) && !/disponibilidad/.test(cf[0].msg), "conexión usada: diálogo en femenino, sin mención de Behavior (botón del panel)");
    ok((await S.state()) === b4, "cancelar con el botón del panel: cero cambios");
    await S.setAnswer(true); await ed.evaluate(() => document.getElementById("btnDel").click());
    ok(JSON.parse(await S.state()).doc.doc.pages[0].edges.length === 3 && JSON.parse(await S.state()).undo === JSON.parse(b4).undo + 1, "aceptar: se borra la conexión y queda una entrada de Undo");

    /* B5. selección múltiple mixta (shift+clic real): afectado + no afectado; un diálogo; menú de selección múltiple (#mDel) */
    await S.build(); await S.stub(false);
    await S.click("node", 1); await S.click("node", 4, ["Shift"]); await S.click("node", 3, ["Shift"]);   // Comercio (usado), Libre y Aparte (no usados)
    const sel5 = JSON.parse(await S.state()).sel;
    ok(sel5[0].length === 3, "shift+clic real: 3 nodos seleccionados");
    const b5 = await S.state();
    await ed.evaluate(() => document.getElementById("mDel").click());
    cf = await S.confirms();
    ok(cf.length === 1 && /^Esta selección se usa en 3 Historias:/.test(cf[0].msg) && /Compra/.test(cf[0].msg) && /Reembolsos/.test(cf[0].msg) && /Solo pago/.test(cf[0].msg) && !/Vacía/.test(cf[0].msg) && /eliminarlos de todas formas/.test(cf[0].msg), "mezcla afectado/no afectado: UN diálogo; sólo nombra las Historias afectadas");
    ok((await S.state()) === b5, "menú de selección múltiple + Cancelar: sin cambios y la selección se conserva");
    await S.setAnswer(true); await ed.evaluate(() => document.getElementById("mDel").click());
    const s5 = JSON.parse(await S.state());
    ok(s5.doc.doc.pages[0].nodes.length === 2 && s5.undo === JSON.parse(b5).undo + 1 && (await S.confirms()).length === 2, "aceptar: los 3 nodos se borran con UN diálogo y UNA entrada de Undo");
    await ed.keyboard.press("Control+z");
    ok(JSON.parse(await S.docJson()).doc.pages[0].nodes.length === 5, "un solo Undo recupera los 3 nodos");

    /* B6. selección sólo de elementos no afectados en una selección múltiple: sin diálogo */
    await S.build(); await S.stub(false);
    await S.click("node", 4); await S.click("node", 3, ["Shift"]);
    await ed.evaluate(() => document.getElementById("mDel").click());
    ok((await S.confirms()).length === 0 && JSON.parse(await S.state()).doc.doc.pages[0].nodes.length === 3, "selección múltiple sin ninguna entidad afectada: se borra al instante");

    /* B7. nodo con Behavior SIN Historia afectada: sin diálogo, el Behavior se va con el nodo, Undo lo restaura */
    await S.build(); await S.stub(false);
    await ed.evaluate(() => { P().scenarios.forEach((sc) => { sc.steps = []; }); });  // ninguna Historia usa nada
    await S.click("node", 2); await ed.keyboard.press("Delete");
    ok((await S.confirms()).length === 0 && JSON.parse(await S.docJson()).doc.pages[0].behaviors.length === 0, "nodo con Behavior sin Historias afectadas: sin diálogo y sin Behavior huérfano");
    await ed.keyboard.press("Control+z");
    ok(JSON.parse(await S.docJson()).doc.pages[0].behaviors.length === 1 && JSON.parse(await S.docJson()).doc.pages[0].nodes.length === 5, "Undo restaura nodo y Behavior");

    /* B8. Cut (Ctrl+X) con impacto: cancelar / aceptar */
    await S.build(); await S.stub(false);
    await S.click("node", 2); const b8 = await S.state();
    await ed.keyboard.press("Control+x");
    ok((await S.confirms()).length === 1 && (await S.state()) === b8, "Ctrl+X con impacto: mismo diálogo; cancelar no cambia nada");
    await S.setAnswer(true); await ed.keyboard.press("Control+x");
    ok(JSON.parse(await S.docJson()).doc.pages[0].nodes.length === 4 && await ed.evaluate(() => clip && clip.nodes.length) === 1, "Ctrl+X aceptado: corta y deja el nodo en el portapapeles");
    await ed.evaluate(() => { pasteClip(); });
    ok(JSON.parse(await S.docJson()).doc.pages[0].nodes.length === 5, "y se puede pegar");

    /* B9. diálogo NATIVO real (sin stub): el texto llega íntegro y cancelar/aceptar funcionan */
    await S.build(); await S.stub(false); await S.unstub(); S.dialogs.length = 0; S.policy.accept = false;
    await S.click("node", 1); const b9 = await S.state();
    await ed.keyboard.press("Delete");
    ok(S.dialogs.length === 1 && /^Este elemento se usa en 3 Historias:/.test(S.dialogs[0]), "diálogo nativo real de Chrome con el mensaje");
    ok((await S.state()) === b9, "cancelar el diálogo nativo: cero cambios");
    S.policy.accept = true; await ed.keyboard.press("Delete");
    ok(S.dialogs.length === 2 && JSON.parse(await S.docJson()).doc.pages[0].nodes.length === 4, "aceptar el diálogo nativo: se borra");

    /* ============ C. Playback ============ */
    console.log("\nC. Playback");
    await S.build(); await S.stub(true);
    const frozen = async (tag) => {
      const st0 = await S.state();
      await ed.evaluate(() => { selN = new Set([P().nodes[2].id]); selE = new Set(); refreshPanel(); });
      const withSel = await S.state();
      await ed.keyboard.press("Delete");
      await ed.evaluate(() => document.getElementById("btnDel").click());
      await ed.evaluate(() => document.getElementById("mDel").click());
      await ed.evaluate(() => document.getElementById("mCut").click());
      await ed.evaluate(() => document.getElementById("btnDelTouch").click());
      await ed.keyboard.press("Control+x");
      ok((await S.state()) === withSel && (await S.confirms()).length === 0, `${tag}: Supr, botón del panel, menú de selección múltiple, Cortar (botón y Ctrl+X) y papelera táctil NO actúan (sin diálogo, sin Undo)`);
      return st0;
    };
    await ed.locator("#tabScenarios").click();
    await ed.evaluate(() => scSelectStory(P().scenarios[0].id));
    await ed.locator("#scRun").click();
    ok(await ed.evaluate(() => scStatus) === "running", "Playback en marcha");
    await frozen("Playback en marcha");
    await ed.waitForFunction(() => scStatus === "completed", null, { timeout: 15000 });
    await frozen("Playback completado («Volver a editar»)");
    ok((await ed.evaluate(() => clip)) === null, "ni Cortar durante el Playback copió nada");
    await ed.locator("#scReset").click();
    await ed.waitForFunction(() => scStatus === "idle");
    await S.stub(false);
    await ed.evaluate(() => { selN = new Set([P().nodes[2].id]); selE = new Set(); refreshPanel(); });
    await ed.keyboard.press("Delete");
    ok((await S.confirms()).length === 1 && JSON.parse(await S.docJson()).doc.pages[0].nodes.length === 5, "tras «Volver a editar» el borrado vuelve a funcionar: pide confirmación (cancelado: sin cambios)");
    await S.setAnswer(true); await ed.keyboard.press("Delete");
    ok(JSON.parse(await S.docJson()).doc.pages[0].nodes.length === 4, "…y al aceptar borra");
    /* Present */
    await ed.locator("#btnPresent").click(); await ed.waitForTimeout(300);
    const inPresent = await ed.evaluate(() => presenting);
    await ed.keyboard.press("Escape"); await ed.waitForFunction(() => !presenting);
    ok(inPresent, "Present abre y cierra sin tocar el documento");

    /* ============ D. Cambio de página ============ */
    console.log("\nD. Páginas");
    await S.build(); await S.stub(true);
    await ed.evaluate(() => { doc.pages.push(blankPage("Página 2")); doc.cur = 1; clearSel(); renderTabs(); const a = newNode("rect", 300, 300), c = newNode("rect", 600, 300); a.label = "P2-A"; c.label = "P2-B"; newEdge(a.id, c.id); undoStack.length = 0; });
    await S.click("node", 0);                                               // P2-A tiene id 1: el mismo id que Cliente en la página 1
    await ed.keyboard.press("Delete");
    ok((await S.confirms()).length === 0 && await ed.evaluate(() => P().nodes.length) === 1, "en la página 2 el id 1 NO se confunde con el elemento 1 de la página 1 (sin diálogo)");
    await ed.evaluate(() => { doc.cur = 0; clearSel(); renderTabs(); });
    await S.click("node", 1); await ed.keyboard.press("Delete");
    ok((await S.confirms()).length === 1, "al volver a la página 1 el impacto vuelve a calcularse sobre sus Historias");

    /* ============ E. Share / Viewer ============ */
    console.log("\nE. Share / Viewer");
    const sv = async (base, label, accept) => {
      const T = await session(browser, base, label); await T.build(); await T.stub(accept);
      await T.click("node", 2); await T.ed.keyboard.press("Delete");            // Banco
      await T.ed.evaluate(() => scSelectStory(P().scenarios.find((s) => s.name === "Solo pago").id));
      await T.ed.locator("#btnShare").click(); await T.ed.locator("#shareCreate").click();
      await T.ed.waitForFunction(() => document.getElementById("shareLink").value.includes("/s/#d="), null, { timeout: 8000 });
      const link = await T.ed.locator("#shareLink").inputValue(); await T.ed.locator("#shareClose").click();
      const v = await T.ctx.newPage(); v.on("pageerror", (e) => T.errors.push(label + " viewer pageerror: " + e.message)); v.on("console", (m) => { if (m.type() === "error") T.errors.push(label + " viewer console: " + m.text()); });
      await v.goto(link); await v.waitForSelector("#stPlay", { state: "visible", timeout: 10000 });
      await v.locator("#stPlay").click();
      const played = await v.waitForFunction(() => /Repetir|↻/.test(document.getElementById("stPlay").textContent), null, { timeout: 8000 }).then(() => true, () => false);
      const err = await v.evaluate(() => (document.getElementById("stCaption") || {}).textContent || "");
      const nodes = await v.evaluate(() => P().nodes.length);
      if (label === "wt") await v.screenshot({ path: path.join(shots, "E-viewer.png") });
      const errs = T.errors.slice(); await T.ctx.close();
      return { played, err, nodes, errs };
    };
    const vw = await sv(wt.base, "wt", true), vh = await sv(hd.base, "head", true);
    ok(vw.errs.length === 0 && vh.errs.length === 0, "Share/Viewer: 0 errores de consola");
    ok(vw.nodes === 4 && vh.nodes === 4, "Viewer: el diagrama compartido ya no tiene el nodo borrado (WT y HEAD)");
    ok(vw.played === true, "WT: la Historia «Solo pago» (que no usa el nodo) se reproduce en el Viewer tras borrar un nodo con Behavior");
    ok(vh.played === true, "HEAD (que ya incluye 018.4): sin Behavior huérfano esa Historia también se reproduce en el Viewer");
    const cancelShare = await sv(wt.base, "wt-cancel", false);
    ok(cancelShare.nodes === 5 && cancelShare.played === true, "Cancelar el borrado: lo compartido conserva los 5 nodos y la Historia reproduce");

    /* ============ F. Documento antiguo con Behavior huérfano ============ */
    console.log("\nF. Documento antiguo con Behavior huérfano");
    const legacyDoc = async () => { const T = await session(browser, wt.base, "mk"); await T.build(); const j = await T.ed.evaluate(() => { const p = serializeProject(); p.doc.pages[0].behaviors.push({ nodeId: 99, initialState: "DOWN" }); p.doc.pages[0].name = "Antigua"; return JSON.stringify(p); }); await T.ctx.close(); return j; };
    const legacyJson = await legacyDoc();
    const old = async (base, label) => {
      const T = await session(browser, base, label);
      await T.ed.locator("#fileIn").setInputFiles({ name: "antiguo.fluyo.json", mimeType: "application/json", buffer: Buffer.from(legacyJson) });
      await T.ed.waitForFunction(() => P().nodes.length === 5 && P().name === "Antigua", null, { timeout: 5000 });
      const beh = await T.ed.evaluate(() => P().behaviors.length);
      await T.stub(true);
      await T.click("node", 4); await T.ed.keyboard.press("Delete");                  // Libre: sin uso
      const cf = (await T.confirms()).length;
      const behAfter = await T.ed.evaluate(() => P().behaviors.length);
      await T.ed.evaluate(() => { clearSel(); undoStack.length = 0; selN = new Set([P().nodes[1].id]); refreshPanel(); });
      await T.ed.keyboard.press("Delete");
      const cf2 = (await T.confirms()).length;
      const errs = T.errors.slice(); await T.ctx.close();
      return { beh, behAfter, cf, cf2, errs };
    };
    const ow = await old(wt.base, "wt"), oh = await old(hd.base, "head");
    ok(ow.errs.length === 0 && oh.errs.length === 0, "documento antiguo: se abre sin errores de consola");
    ok(ow.beh === oh.beh, "el Behavior huérfano preexistente se conserva igual que en HEAD (no hay reparación automática de documentos antiguos) · WT " + ow.beh + " / HEAD " + oh.beh);
    ok(ow.cf === 0 && ow.behAfter === ow.beh, "borrar un nodo sin uso del documento antiguo: sin diálogo y sin tocar el Behavior huérfano ajeno");
    ok(ow.cf2 === 1, "borrar el nodo usado por la Historia del documento antiguo: pide confirmación");

    /* ============ G. Responsive básico (táctil real) ============ */
    console.log("\nG. Responsive");
    for (const [w, h, mobile] of [[390, 844, true], [768, 1024, true], [1024, 700, false]]) {
      const T = await session(browser, wt.base, "wt" + w, { context: { viewport: { width: w, height: h }, hasTouch: true, isMobile: mobile } });
      await T.build(); await T.stub(false);
      const tap = await T.ed.evaluate(() => { const n = P().nodes[2], r = cv.getBoundingClientRect(); return { x: r.left + n.x * viewZoom + viewX, y: r.top + (n.y - 12) * viewZoom + viewY, w: r.width, h: r.height }; });
      await T.ed.evaluate(() => { viewZoom = 0.35; viewX = 10; viewY = 20; });
      const p = await T.ed.evaluate(() => { const n = P().nodes[2], r = cv.getBoundingClientRect(); return { x: r.left + n.x * viewZoom + viewX, y: r.top + (n.y - 6) * viewZoom + viewY }; });
      await T.ed.touchscreen.tap(p.x, p.y);
      const sel = await T.ed.evaluate(() => selN.size);
      const btn = T.ed.locator("#btnDelTouch");
      const visible = await btn.isVisible().catch(() => false);
      const before = await T.state();
      if (visible) await btn.tap(); else await T.ed.evaluate(() => document.getElementById("btnDelTouch").click());
      const cf = await T.confirms();
      ok(sel === 1 && cf.length === 1, `${w}×${h}: toque en el nodo y papelera táctil${visible ? " visible" : " (oculta: viewport con puntero fino)"} → un diálogo`);
      ok((await T.state()) === before, `${w}×${h}: cancelar deja todo igual`);
      const overflow = await T.ed.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      ok(overflow, `${w}×${h}: sin desbordamiento horizontal`);
      await T.ed.screenshot({ path: path.join(shots, `G-${w}.png`) });
      ok(T.errors.length === 0, `${w}×${h}: 0 errores de consola`);
      await T.ctx.close();
    }

    ok(S.errors.length === 0, "sesión principal: 0 errores de consola/página" + (S.errors.length ? ": " + S.errors.join(" | ") : ""));
    await S.ctx.close();
    console.log("\nCapturas en", shots);
  } finally {
    await browser.close(); wt.server.close(); hd.server.close();
    fs.rmSync(headDir, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r[0]).length;
  console.log(failed ? `\nFLUYO-018.4 Chrome real: ${failed} fallo(s) de ${results.length}` : `\nFLUYO-018.4 Chrome real: OK (${results.length} comprobaciones)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
