"use strict";
/* FLUYO-STORIES-2.0 S2b · Variantes en el editor — tests de unidad (vm, sobre el editor de Historias real).
   «Otra forma desde aquí» (D3): una Historia nueva, detrás de la original, con los momentos 1..k (el del paso incluido); lo
   posterior se quita y las esperas de llegada a lo quitado se podan; la original no cambia; una sola entrada de Undo. Reproduciendo,
   «Otra forma desde el paso N» en el ⋯ de la Historia (D1). El nombre se edita en línea (D2) con scRenameScenario. El selector
   enseña el desenlace de cada Historia con FluyoStoryClock.outcomeOf (la misma regla que el storyboard, Present y el Viewer). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { makeScenarioUIContext, setupPanel, ensureUI, read } = require("./fluyo-016-harness.cjs");
const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "699bd7a";

/* Cliente → Tienda → Pagos → Banco, a zoom 1, con tres envíos contados tocando (S1a): un momento por envío */
function boot(lang) {
  const { ctx, register } = makeScenarioUIContext();
  setupPanel(ctx, register);
  if (lang) { vm.runInContext(read("js/i18n-en.js"), ctx); vm.runInContext(read("js/i18n-en-editor.js"), ctx); ctx.run(`FluyoI18n.setLocale(${JSON.stringify(lang)})`); }
  ctx.run(`
    var uiMode = "story", presenting = false, viewZoom = 1, viewX = 0, viewY = 0, __now = 1000;
    performance = { now: () => __now };
    var cv = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 600 }) };
    doc = { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0,
      pages: [{ name: "P", nextId: 8, behaviors: [], scenarios: [], nextScenarioId: 1,
        nodes: [{ id: 1, shape: "rect", x: 100, y: 100, w: 100, h: 40, label: "Cliente" }, { id: 2, shape: "rect", x: 400, y: 100, w: 100, h: 40, label: "Tienda" },
                { id: 3, shape: "rect", x: 700, y: 100, w: 100, h: 40, label: "Pagos" }, { id: 4, shape: "rect", x: 1000, y: 100, w: 100, h: 40, label: "Banco" }],
        edges: [{ id: 5, from: 1, to: 2 }, { id: 6, from: 2, to: 3 }, { id: 7, from: 3, to: 4 }] }] };
    undoStack = []; redoStack = [];
    var __in = (n, x, y) => Math.abs(x - n.x) <= n.w / 2 && Math.abs(y - n.y) <= n.h / 2;
    hitLeafNode = (x, y) => P().nodes.find((n) => n.shape !== "container" && __in(n, x, y)) || null;
    hitNode = (x, y) => P().nodes.find((n) => __in(n, x, y)) || null;
    edgePoints = (e) => { const a = nodeById(e.from), b = nodeById(e.to); return [{ x: a.x + a.w / 2, y: a.y }, { x: b.x - b.w / 2, y: b.y }]; };
    clearSel = () => { selN.clear(); selE.clear(); };
    scScrollIntoView = () => {};
  `);
  ensureUI(ctx);
  const pop = ctx.document.createElement("div");
  pop.id = "scPopover"; pop.hidden = true; ctx.document.body.appendChild(pop);
  ctx.document._registry.set("scPopover", pop);
  /* la cabecera: el título vive en su fila (el campo del nombre se pone delante) */
  ctx.run(`(() => { const row = document.createElement("div"), t = $("scScenarioTitle"); row.appendChild(t); t.parentNode = row; __row = row; })()`);
  ctx.innerWidth = 1200; ctx.innerHeight = 800;
  return ctx;
}
const J = (ctx, js) => JSON.parse(ctx.run(`JSON.stringify(${js})`));
const tap = (ctx, x, y) => ctx.run(`__now += 1000; scTapPointerDown({ pointerId: 1, clientX: ${x}, clientY: ${y}, button: 0 }); scTapPointerUp({ pointerId: 1, clientX: ${x}, clientY: ${y}, button: 0 }); scInlineStep = null;`);
/* tres envíos: Cliente → Tienda (paso 1), Tienda → Pagos (2), Pagos → Banco (3), cada uno con su frase */
function story(lang) {
  const ctx = boot(lang);
  tap(ctx, 300, 100); tap(ctx, 600, 100); tap(ctx, 900, 100);
  ctx.run(`scActiveScenario().steps.forEach((s, i) => setStepMessage(scActiveScenario(), s.id, "frase " + (i + 1))); scActiveScenario().name = "Compra";`);
  ctx.run("undoStack.length = 0; redoStack.length = 0;");
  return ctx;
}
const shape = (s) => s.map((x) => [x.id, x.at, x.action, x.edgeId || x.nodeId, x.state || "", x.message || ""]);
const names = (ctx) => J(ctx, "P().scenarios.map((s) => s.name)");
const noCounters = (o) => JSON.stringify(o).replace(/"next(Step|Scenario)Id":\d+/g, "");
function menu(ctx, js) {
  ctx.run(js);
  const p = ctx.run(`$("scPopover")`);
  return p.children.filter((c) => c.tagName === "BUTTON").map((b) => ({ label: b._text, hint: (b.children.find((c) => c.className === "scMenuHint") || {})._text || "", disabled: !!b.disabled, click: () => b.onclick() }));
}
const field = (ctx) => ctx.run("scInlineNameEl");
const key = (ctx, code, extra = "") => ctx.run(`scInlineNameEl.onkeydown({ keyCode: ${code}, ${extra} preventDefault() {}, stopPropagation() {} })`);

test("V1 · «Otra forma desde aquí» en el paso 2: copia detrás de la original con los momentos 1..2, frases incluidas; la original no cambia; una entrada de Undo", () => {
  const ctx = story();
  const original = J(ctx, "P().scenarios[0]");
  assert.equal(ctx.run("scBranchFrom(scActiveScenario().steps[1].id)"), true);
  assert.deepEqual(names(ctx), ["Compra", "Compra — otra forma"], "detrás de la original, con su nombre");
  const copy = J(ctx, "scActiveScenario()");
  assert.equal(copy.name, "Compra — otra forma", "queda activa");
  assert.deepEqual(shape(copy.steps), shape(original.steps.slice(0, 2)), "exactamente los pasos 1..2, con sus frases");
  assert.notEqual(copy.id, original.id);
  assert.equal(JSON.stringify(J(ctx, "P().scenarios[0]")), JSON.stringify(original), "la original, byte a byte");
  assert.equal(ctx.run("undoStack.length"), 1, "una sola entrada de Undo");
  assert.equal(ctx.run("scInlineName && scInlineName.id"), copy.id, "el nombre queda listo para escribirse");
  ctx.run("normalizeScenarios({ scenarios: [JSON.parse(JSON.stringify(scActiveScenario()))] })");   /* la copia es una Historia válida */
});

test("V2 · conserva caídas y sentidos hasta el momento; con momentos simultáneos, el momento entero", () => {
  const ctx = story();
  ctx.run("scFailHere(scActiveScenario().steps[2].id)");                      /* Banco cae justo antes del paso 3: momento propio */
  ctx.run("setStepReverse(scActiveScenario(), scActiveScenario().steps[1].id, true)");
  const steps = J(ctx, "storyboardOrderedSteps(scActiveScenario().steps)");
  /* 4 momentos: envío 1 · envío 2 (invertido) · Pagos… no: la caída va antes del envío 3 */
  const down = steps.find((s) => s.action === "SET_STATE");
  ctx.run(`scBranchFrom(${down.id})`);
  const copy = J(ctx, "storyboardOrderedSteps(scActiveScenario().steps)");
  assert.deepEqual(shape(copy), shape(steps.filter((s) => s.at <= down.at)), "hasta la caída, incluida");
  assert.equal(copy.find((s) => s.action === "SET_STATE").message, down.message, "la caída lleva su frase");
  assert.equal(copy.find((s) => s.reverse === true) !== undefined, true, "el sentido invertido se conserva");
  /* simultáneos: dos pasos en el mismo momento viajan juntos */
  const ctx2 = story();
  ctx2.run(`const sc = scActiveScenario(), a = sc.steps[1]; createStep(sc, { at: a.at, action: "SEND", edgeId: 7 });`);
  ctx2.run("scBranchFrom(scActiveScenario().steps[1].id)");
  assert.equal(J(ctx2, "scActiveScenario().steps").length, 3, "el momento 2 tiene dos pasos y van los dos");
});

test("V3 · las esperas de llegada a pasos quitados se podan; las que siguen valiendo se conservan", () => {
  const ctx = story();
  ctx.run(`const sc = scActiveScenario(), [a, b, c] = sc.steps;
    sc.arrivalDependencies = [{ stepId: b.id, waitsForArrivalOf: [a.id] }, { stepId: c.id, waitsForArrivalOf: [b.id] }];`);
  ctx.run("scBranchFrom(scActiveScenario().steps[1].id)");
  const [a, b] = J(ctx, "scActiveScenario().steps");
  assert.deepEqual(J(ctx, "scActiveScenario().arrivalDependencies"), [{ stepId: b.id, waitsForArrivalOf: [a.id] }], "la del paso 3 (quitado) se va; la del 2 queda");
  assert.equal(J(ctx, "P().scenarios[0].arrivalDependencies").length, 2, "la original conserva las dos");
});

test("V4 · en el último momento no se ofrece (sería «Duplicar historia»): desactivada con su razón, sin Undo ni copia", () => {
  const ctx = story();
  const items = menu(ctx, "scStoryMenu(scActiveScenario().steps[2], document.createElement('button'))");
  const it = items.find((i) => i.label === "Otra forma desde aquí");
  assert.equal(it.disabled, true);
  assert.equal(it.hint, "Es el último paso: usa «Duplicar historia»");
  assert.equal(ctx.run("scBranchFrom(scActiveScenario().steps[2].id)"), false);
  assert.equal(ctx.run("undoStack.length"), 0);
  assert.deepEqual(names(ctx), ["Compra"]);
  const first = menu(ctx, "scStoryMenu(scActiveScenario().steps[0], document.createElement('button'))");
  assert.deepEqual(first.slice(0, 2).map((i) => i.label), ["Falla aquí", "Otra forma desde aquí"], "junto a «Falla aquí», en la primera sección");
  assert.equal(first[1].hint, "Copia la historia hasta este paso y sigue por otro camino");
});

test("V5 · Undo quita la variante entera y la página vuelve exacta; Redo la rehace igual", () => {
  const ctx = story();
  const before = J(ctx, "P()");
  ctx.run("scBranchFrom(scActiveScenario().steps[0].id)");
  const after = J(ctx, "P()");
  ctx.run("undo()");
  assert.equal(noCounters(J(ctx, "P()")), noCounters(before), "un Undo: la página tal cual (los contadores nunca bajan)");
  ctx.run("redo()");
  assert.equal(JSON.stringify(J(ctx, "P()")), JSON.stringify(after), "un Redo: la variante igual");
});

test("V6 · reproduciendo, el ⋯ de la Historia ofrece «Otra forma desde el paso N» (el momento en curso): detiene y crea 1..N", () => {
  const ctx = story();
  assert.equal(menu(ctx, "scScenarioMenu(document.createElement('button'))").some((i) => /Otra forma desde el paso/.test(i.label)), false, "sin reproducir, no");
  ctx.run("scRun(); scSeekMoment(1);");
  assert.equal(ctx.run("isScenarioPlaybackActive()"), true);
  const items = menu(ctx, "scScenarioMenu(document.createElement('button'))");
  const it = items.find((i) => /Otra forma desde el paso/.test(i.label));
  assert.equal(it.label, "Otra forma desde el paso 2");
  assert.equal(it.disabled, false);
  it.click();
  assert.equal(ctx.run("isScenarioPlaybackActive()"), false, "la reproducción se detiene");
  assert.equal(J(ctx, "scActiveScenario().steps").length, 2);
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run("scSwitchScenario(P().scenarios[0].id); scRun(); scSeekMoment(2);");
  const last = menu(ctx, "scScenarioMenu(document.createElement('button'))").find((i) => /Otra forma desde el paso/.test(i.label));
  assert.deepEqual([last.label, last.disabled], ["Otra forma desde el paso 3", true], "en el último momento, desactivada");
});

test("N1 · el nombre en línea: Enter guarda con UNA entrada de Undo; Escape, vacío, el mismo nombre o el Enter de un IME no cambian nada", () => {
  const ctx = story();
  assert.equal(ctx.run("scBeginInlineName(true)"), true);
  assert.equal(ctx.run("$('scScenarioTitle').hidden"), true, "el campo ocupa el sitio del título");
  assert.equal(field(ctx).value, "Compra");
  assert.equal(field(ctx).maxLength, 120, "el tope de siempre (120)");
  ctx.run("scInlineNameEl.value = 'Compra online'"); key(ctx, 229, "isComposing: true,");
  assert.equal(ctx.run("scActiveScenario().name"), "Compra", "el Enter de un IME no confirma");
  key(ctx, 13);
  assert.equal(ctx.run("scActiveScenario().name"), "Compra online");
  assert.equal(ctx.run("undoStack.length"), 1);
  assert.equal(ctx.run("scInlineNameEl"), null, "el campo se va");
  assert.equal(ctx.run("$('scScenarioTitle').hidden"), false);
  assert.equal(ctx.run("$('scScenarioTitle').textContent"), "Compra online ▾", "el botón «nombre ▾» de siempre");
  for (const [v, k] of [["Otro", 27], ["   ", 13], ["Compra online", 13]]) {
    ctx.run("scBeginInlineName(true)"); ctx.run(`scInlineNameEl.value = ${JSON.stringify(v)}`); key(ctx, k);
    assert.equal(ctx.run("scActiveScenario().name"), "Compra online", JSON.stringify(v) + " no cambia el nombre");
  }
  assert.equal(ctx.run("undoStack.length"), 1, "ninguna entrada más");
  ctx.run("scBeginInlineName(true)"); ctx.run("scInlineNameEl.value = 'Por blur'"); ctx.run("scInlineNameEl.onblur()");
  assert.equal(ctx.run("scActiveScenario().name"), "Por blur", "salir del campo guarda");
  ctx.run("scRun()");
  assert.equal(ctx.run("scBeginInlineName(true)"), true);
  assert.equal(ctx.run("isScenarioPlaybackActive()"), false, "reproduciendo, abrirlo detiene la reproducción (como el popover de antes)");
});

test("N2 · «Renombrar» y el doble clic abren el nombre en línea; «Nueva historia» y la variante lo dejan listo; cambiar de Historia lo cierra", () => {
  const ctx = story();
  menu(ctx, "scScenarioMenu(document.createElement('button'))").find((i) => i.label === "Renombrar").click();
  assert.notEqual(field(ctx), null, "«Renombrar» → en línea");
  assert.equal(ctx.run(`$("scPopover").children.some((c) => c.tagName === "LABEL")`), false, "sin el popover de antes");
  key(ctx, 27);
  assert.equal(typeof ctx.run("$('scScenarioTitle').ondblclick"), "function");
  ctx.run("$('scScenarioTitle').ondblclick()");
  assert.notEqual(field(ctx), null, "doble clic → en línea");
  key(ctx, 27);
  ctx.run("scNewScenario()");
  assert.equal(ctx.run("scInlineName && scInlineName.id"), ctx.run("scActiveScenario().id"), "«Nueva historia» deja el nombre listo");
  assert.equal(field(ctx).value, "Historia 2");
  ctx.run("scSwitchScenario(P().scenarios[0].id); scRenderHeader();");
  assert.equal(ctx.run("scInlineNameEl"), null, "al cambiar de Historia el campo se cierra");
  ctx.run("scSwitchScenario(P().scenarios[1].id); scRenderHeader();");
  assert.equal(ctx.run("scInlineNameEl"), null, "y no vuelve al volver a esa Historia");
  assert.equal(typeof ctx.run("typeof scRenameUI"), "string");
  assert.equal(ctx.run("typeof scRenameUI"), "undefined", "el popover de renombrar ya no existe");
});

test("B1 · el selector: cada Historia con su desenlace, el mismo que su línea del storyboard; sin pasos, nada", () => {
  const ctx = story();
  ctx.run("scBranchFrom(scActiveScenario().steps[0].id)");
  ctx.run("scSwitchScenario(P().scenarios[0].id); scFailHere(scActiveScenario().steps[1].id)");
  ctx.run("scNewScenario()");
  const items = menu(ctx, "scChooseScenario(document.createElement('button'))");
  assert.deepEqual(items.map((i) => [i.label, i.hint]), [
    ["○ Compra", "Falla en el paso 3"], ["○ Compra — otra forma", "Termina bien"], ["● Historia 3", ""], ["+ Nueva historia", ""]]);
  for (const id of J(ctx, "P().scenarios.filter((s) => s.steps.length).map((s) => s.id)")) {
    ctx.run(`scSwitchScenario(${id}); scStorySignature = ""; scRenderStoryboard();`);
    const line = ctx.run(`(($("scStoryboard").children.find((c) => /scOutcome/.test(c.className))) || {}).textContent || ""`);
    const hint = menu(ctx, "scChooseScenario(document.createElement('button'))").find((i) => i.label.startsWith("● ")).hint;
    assert.equal(hint, line, "selector = storyboard");
  }
});

test("B2 · los ejemplos: el selector dice lo mismo que FluyoStoryClock.outcomeOf y el documento no cambia", () => {
  const ctx = boot();
  const expect = {
    "compra-online": ["Termina bien", "Falla en el paso 4"],
    "inicio-de-sesion-oauth2": ["Termina bien", "Termina bien"],
    "pedido-asincrono-cola": ["Termina bien", "Falla en el paso 4"],
  };
  for (const [slug, out] of Object.entries(expect)) {
    ctx.raw = read(`ejemplos/data/${slug}.fluyo.json`);
    ctx.run("doc = projectFromProjectData(JSON.parse(raw)).doc; scSelectStory(P().scenarios[0].id);");
    const before = ctx.run("JSON.stringify(doc)");
    assert.deepEqual(menu(ctx, "scChooseScenario(document.createElement('button'))").slice(0, 2).map((i) => i.hint), out, slug);
    assert.equal(ctx.run("JSON.stringify(doc)"), before, slug + ": el documento no cambia");
  }
  assert.doesNotMatch(read("js/editor-scenarios.js").split("function scChooseScenario")[1].split("\nfunction ")[0], /FluyoStory\.run|outcome\(/, "el selector no calcula su propio desenlace");
});

test("S1 · guardar, cargar y compartir conservan la variante y su nombre (una Historia normal: sin campos nuevos)", () => {
  const ctx = story();
  ctx.run("scBranchFrom(scActiveScenario().steps[1].id)"); ctx.run("scInlineNameEl.value = 'El usuario cancela'"); key(ctx, 13);
  const saved = J(ctx, "serializeProject()");
  const back = J(ctx, `projectFromProjectData(${JSON.stringify(JSON.stringify(saved))} && JSON.parse(${JSON.stringify(JSON.stringify(saved))}))`);
  assert.deepEqual(back.doc.pages[0].scenarios.map((s) => s.name), ["Compra", "El usuario cancela"]);
  const keys = new Set(back.doc.pages[0].scenarios.flatMap((s) => Object.keys(s)));
  for (const k of keys) assert.ok(["id", "engineVersion", "name", "nextStepId", "steps", "arrivalDependencies", "observedFlow"].includes(k), "clave conocida: " + k);
});

test("E1 · en inglés: «Another way from here», «— another way», «Another way from step N», «Ends well» en el selector", () => {
  const ctx = story("en");
  const items = menu(ctx, "scStoryMenu(scActiveScenario().steps[0], document.createElement('button'))");
  assert.deepEqual([items[1].label, items[1].hint], ["Another way from here", "Copies the story up to this step and continues another way"]);
  const last = menu(ctx, "scStoryMenu(scActiveScenario().steps[2], document.createElement('button'))").find((i) => i.label === "Another way from here");
  assert.equal(last.hint, "This is the last step: use “Duplicate story”");
  items[1].click();
  assert.equal(ctx.run("scActiveScenario().name"), "Compra — another way");
  key(ctx, 27);
  assert.deepEqual(menu(ctx, "scChooseScenario(document.createElement('button'))").slice(0, 2).map((i) => i.hint), ["Ends well", "Ends well"]);
  ctx.run("scSwitchScenario(P().scenarios[0].id); scRun(); scSeekMoment(0);");
  assert.ok(menu(ctx, "scScenarioMenu(document.createElement('button'))").some((i) => i.label === "Another way from step 1"));
  /* el nombre es contenido: volver a español no lo retraduce */
  ctx.run(`FluyoI18n.setLocale("es")`);
  assert.equal(ctx.run("P().scenarios[1].name"), "Compra — another way");
});

test("C1 · kernel, formato, codec, Share, Present, Viewer, render, ejemplos y fluyo-mcp intactos", () => {
  const KEEP = ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js",
    "js/story-authoring.js", "js/story-clock.js", "js/render.js", "js/link-codec.js", "js/deeplink.js", "js/share-url.js", "js/editor-share.js", "js/present-story.js",
    "js/viewer.js", "js/examples.js", "index.html", "s", "ejemplos"];
  assert.equal(execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...KEEP], { encoding: "utf8" }).trim(), "");
  const mcp = path.join(root, "..", "fluyo-mcp");
  if (fs.existsSync(path.join(mcp, ".git"))) {
    assert.equal(execFileSync("git", ["-C", mcp, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(), "464f4e0", "fluyo-mcp sigue en 464f4e0");
    assert.equal(execFileSync("git", ["-C", mcp, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim(), "", "sin cambios en fluyo-mcp");
  }
});

test("C2 · alcance frente a 699bd7a: solo estos archivos servidos; undoS2b (para los alcances antiguos) los devuelve EXACTOS", () => {
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const { undoS2b, PIECES, NEW_FILES } = require("./fluyo-stories-2-0-s2b-undo.cjs");
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), ["css/styles.css", "js/editor-scenarios.js", "js/i18n-en-editor.js", "sw.js"]);
  assert.deepEqual(NEW_FILES, []);
  const noCache = (t) => t.replace(/\r\n/g, "\n").replace(/const CACHE = "fluyo-static-v\d+";/, "");
  for (const f of Object.keys(PIECES).concat("sw.js"))
    assert.equal(noCache(undoS2b(f, read(f))), noCache(execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" })), f + ": undoS2b exacto");
});

test("C3 · claves nuevas en inglés y usadas; «Guardar nombre» retirada; sin analíticas ni campos nuevos; CACHE v120", () => {
  const ed = read("js/editor-scenarios.js"), en = read("js/i18n-en-editor.js");
  for (const k of ["seed.storyBranch", "seed.storyBranchN", "step.branchHere", "step.branchHereHint", "step.branchLast", "stories.branchAt"]) {
    assert.ok(ed.includes(`"${k}"`), k + " se usa");
    assert.ok(en.includes(`"${k}":`), k + " en inglés");
  }
  assert.ok(!ed.includes('"stories.saveName"') && !en.includes('"stories.saveName"'), "la clave del popover se retira con él");
  const diff = execFileSync("git", ["-C", gitRoot, "diff", "-U0", BASE, "--", "js/editor-scenarios.js"], { encoding: "utf8" }).split("\n").filter((l) => /^\+[^+]/.test(l)).join("\n");
  assert.doesNotMatch(diff, /trackEvent|\.(purpose|variantOf|family)\b/);
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v120";/);
});
