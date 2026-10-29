"use strict";
/* FLUYO-STORIES-2.0 S1a · Contar con clics — tests de unidad (vm, sobre el editor de Historias real).
   En Historias tocar una conexión o un elemento crea el paso (D1) con un tipo implícito, sin diálogo de Evento; la frase se
   escribe en la fila; blanco de 12 px; una acción = una entrada de Undo; es/en; kernel, formato y MCP intactos. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { makeScenarioUIContext, setupPanel, ensureUI, read } = require("./fluyo-016-harness.cjs");
const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;

/* Tres elementos y dos conexiones en fila (A → B → C), a zoom 1 y sin desplazar: mundo = pantalla. */
function boot(lang) {
  const { ctx, register } = makeScenarioUIContext();
  setupPanel(ctx, register);
  if (lang) { vm.runInContext(read("js/i18n-en.js"), ctx); vm.runInContext(read("js/i18n-en-editor.js"), ctx); ctx.run(`FluyoI18n.setLocale(${JSON.stringify(lang)})`); }
  ctx.run(`
    var uiMode = "story", presenting = false, viewZoom = 1, viewX = 0, viewY = 0, __now = 1000;
    performance = { now: () => __now };
    var cv = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }) };
    doc = { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0,
      pages: [{ name: "P", nextId: 6, behaviors: [], scenarios: [], nextScenarioId: 1,
        nodes: [{ id: 1, shape: "rect", x: 100, y: 100, w: 100, h: 40, label: "Cliente" }, { id: 2, shape: "rect", x: 400, y: 100, w: 100, h: 40, label: "Tienda" },
                { id: 3, shape: "rect", x: 700, y: 100, w: 100, h: 40, label: "Pagos" }],
        edges: [{ id: 4, from: 1, to: 2 }, { id: 5, from: 2, to: 3 }] }] };
    undoStack = []; redoStack = [];
    var __in = (n, x, y) => Math.abs(x - n.x) <= n.w / 2 && Math.abs(y - n.y) <= n.h / 2;
    hitLeafNode = (x, y) => P().nodes.find((n) => n.shape !== "container" && __in(n, x, y)) || null;
    hitNode = (x, y) => P().nodes.find((n) => __in(n, x, y)) || null;
    edgePoints = (e) => { const a = nodeById(e.from), b = nodeById(e.to); return [{ x: a.x + a.w / 2, y: a.y }, { x: b.x - b.w / 2, y: b.y }]; };
    clearSel = () => { selN.clear(); selE.clear(); };
    scScrollIntoView = () => {};
  `);
  ensureUI(ctx);
  return ctx;
}
const steps = (ctx) => ctx.run("JSON.parse(JSON.stringify((scActiveScenario() || { steps: [] }).steps))");
const types = (ctx) => ctx.run("JSON.parse(JSON.stringify(doc.eventTypes))");
const tap = (ctx, x, y, extra = "") => {
  ctx.run(`__now += 1000; scTapPointerDown({ pointerId: 1, clientX: ${x}, clientY: ${y}, button: 0 ${extra} }); scTapPointerUp({ pointerId: 1, clientX: ${x}, clientY: ${y}, button: 0 ${extra} });`);
};
const EDGE_AB = [300, 100], EDGE_BC = [600, 100], NODE_C = [700, 100];

test("A1 · tocar una conexión crea la Historia y un envío con el tipo implícito «Paso», en una sola entrada de Undo", () => {
  const ctx = boot();
  tap(ctx, ...EDGE_AB);
  const s = steps(ctx), et = types(ctx);
  assert.equal(ctx.run("P().scenarios.length"), 1, "se crea la Historia");
  assert.equal(s.length, 1);
  assert.deepEqual({ action: s[0].action, edgeId: s[0].edgeId, at: s[0].at, eventTypeId: s[0].eventTypeId }, { action: "SEND", edgeId: 4, at: 0, eventTypeId: et[0].id });
  assert.equal(s[0].message, undefined, "sin frase hasta que se escribe");
  assert.equal(et.length, 1);
  assert.deepEqual({ name: et[0].name, primitive: et[0].primitive, sentence: et[0].sentenceTemplate, symbol: et[0].visual.value },
    { name: "Paso", primitive: "FLOW", sentence: "{source} → {target}", symbol: "●" });
  assert.equal(ctx.run("undoStack.length"), 1, "Historia + tipo + paso = UNA entrada");
  ctx.run("undo()");
  assert.equal(ctx.run("P().scenarios.length"), 0, "Undo quita la Historia");
  assert.equal(ctx.run("doc.eventTypes.length"), 0, "y el tipo implícito");
});

test("A2 · el siguiente toque reutiliza el tipo y entra en el momento siguiente; un elemento crea una «Nota» (OCCURRENCE)", () => {
  const ctx = boot();
  tap(ctx, ...EDGE_AB); tap(ctx, ...EDGE_BC); tap(ctx, ...NODE_C);
  const s = steps(ctx), et = types(ctx);
  assert.deepEqual(s.map((x) => [x.action, x.edgeId || x.nodeId, x.at]), [["SEND", 4, 0], ["SEND", 5, 1000], ["OCCURRENCE", 3, 2000]]);
  assert.deepEqual(et.map((e) => [e.name, e.primitive]), [["Paso", "FLOW"], ["Nota", "OCCURRENCE"]], "dos tipos implícitos, uno por clase");
  assert.equal(s[0].eventTypeId, s[1].eventTypeId);
  assert.equal(ctx.run("undoStack.length"), 3, "tres toques, tres entradas");
  for (const x of s) ctx.run(`validatePersistedStep(${JSON.stringify(x)}, 2)`);
  assert.equal(ctx.run("FluyoStory.run(P(), scActiveScenario()).ok"), true, "el motor la reproduce");
});

test("A3 · si la Historia ya usa un evento de esa clase, el toque lo reutiliza (no crea «Paso»)", () => {
  const ctx = boot();
  ctx.run(`const et = createEventType(eventTypeDefinition({ name: "Petición", primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", symbol: "📨", connectionEffects: defaultConnectionEffects() }));
    const sc = createScenario(P(), "Compra"); scSelectStory(sc.id); createStep(sc, stepDefinitionForEvent(et, 4, 0));`);
  tap(ctx, ...EDGE_BC);
  const s = steps(ctx);
  assert.equal(types(ctx).length, 1, "no se crea ningún tipo");
  assert.equal(s[1].eventTypeId, s[0].eventTypeId, "el envío nuevo es otra «Petición»");
  tap(ctx, ...NODE_C);
  assert.deepEqual(types(ctx).map((e) => e.name), ["Petición", "Nota"], "un elemento no reutiliza un tipo de conexión");
});

test("A4 · en inglés el tipo nace como «Step»/«Note» y después es contenido: no se retraduce", () => {
  const ctx = boot("en");
  tap(ctx, ...EDGE_AB); tap(ctx, ...NODE_C);
  assert.deepEqual(types(ctx).map((e) => [e.name, e.sentenceTemplate]), [["Step", "{source} → {target}"], ["Note", "Something happens at {target}"]]);
  ctx.run(`FluyoI18n.setLocale("es")`);
  tap(ctx, ...EDGE_BC);
  assert.deepEqual(types(ctx).map((e) => e.name), ["Step", "Note"], "en español reutiliza el «Step» de la Historia");
});

test("A5 · blanco de 12 px de pantalla: a zoom 0,5 una conexión se toca a 12 px y no a 14; el elemento hoja gana a la conexión", () => {
  const ctx = boot();
  ctx.run("viewZoom = 0.5");
  /* pantalla = mundo × 0,5: la conexión A→B (y = 100 en el mundo) está en y = 50 de pantalla */
  tap(ctx, 150, 50 + 12);
  assert.equal(steps(ctx).length, 1, "a 12 px cuenta");
  tap(ctx, 300, 50 + 14);
  assert.equal(steps(ctx).length, 1, "a 14 px no");
  ctx.run("viewZoom = 1");
  const t = ctx.run("JSON.parse(JSON.stringify([scTapTarget(140, 100), scTapTarget(300, 100), scTapTarget(300, 400)]))");
  assert.deepEqual(t, [{ kind: "node", ids: [1] }, { kind: "edge", ids: [4] }, null]);
});

test("A6 · un toque es ≤ 8 px: arrastrar, un segundo dedo, un modificador, otro modo, reproducir o colocar no crean nada", () => {
  const ctx = boot();
  ctx.run(`scTapPointerDown({ pointerId: 1, clientX: 300, clientY: 100, button: 0 }); scTapPointerUp({ pointerId: 1, clientX: 310, clientY: 100, button: 0 });`);
  ctx.run(`scTapPointerDown({ pointerId: 1, clientX: 300, clientY: 100, button: 0 }); scTapPointerDown({ pointerId: 2, clientX: 600, clientY: 100, button: 0 }); scTapPointerUp({ pointerId: 2, clientX: 600, clientY: 100, button: 0 }); scTapPointerUp({ pointerId: 1, clientX: 300, clientY: 100, button: 0 });`);
  for (const k of ["shiftKey", "ctrlKey", "metaKey", "altKey"]) tap(ctx, ...EDGE_AB, `, ${k}: true`);
  tap(ctx, ...EDGE_AB, ", button: 2");
  ctx.run(`uiMode = "edit"`); tap(ctx, ...EDGE_AB); ctx.run(`uiMode = "story"`);
  ctx.run(`presenting = true`); tap(ctx, ...EDGE_AB); ctx.run(`presenting = false`);
  ctx.run(`scPlacement = { kind: "place" }`); tap(ctx, ...EDGE_AB); ctx.run(`scPlacement = null`);
  ctx.run(`var __play = isScenarioPlaybackActive; isScenarioPlaybackActive = () => true`); tap(ctx, ...EDGE_AB); ctx.run(`isScenarioPlaybackActive = __play`);
  assert.equal(steps(ctx).length, 0);
  assert.equal(ctx.run("undoStack.length"), 0, "ni una entrada de Undo");
  tap(ctx, ...EDGE_AB);
  assert.equal(steps(ctx).length, 1, "y un toque limpio sí");
});

test("A7 · el segundo clic de un doble clic no repite el paso; pasado el intervalo, sí", () => {
  const ctx = boot();
  ctx.run(`scTapAddStep("edge", 4, "mouse"); __now += 200; scTapAddStep("edge", 4, "mouse")`);
  assert.equal(steps(ctx).length, 1);
  ctx.run(`__now += 500; scTapAddStep("edge", 4, "mouse")`);
  assert.equal(steps(ctx).length, 2);
});

test("A8 · conexiones casi a la misma distancia: se elige en un menú, y elegir crea el paso", () => {
  const ctx = boot();
  ctx.run(`P().edges.push({ id: 9, from: 1, to: 2 }); var __menu = null; scMenu = (a, items) => { __menu = items; };`);
  tap(ctx, ...EDGE_AB);
  assert.equal(steps(ctx).length, 0, "no adivina");
  assert.equal(ctx.run("__menu.length"), 2);
  ctx.run("__menu[1][1]()");
  assert.equal(steps(ctx)[0].edgeId, 9);
});

/* ── Frase en línea ── */
const field = (ctx) => ctx.run(`document.getElementById("scStoryboard").querySelector(".scStepMessageInput")`);
test("B1 · tras el toque, la fila del paso trae el campo de la frase; con ratón con foco, con el dedo sin abrir el teclado", () => {
  const ctx = boot();
  ctx.run(`var __focus = 0; const __mk = document.createElement; document.createElement = (t) => { const el = __mk(t); el.focus = () => { __focus++; }; return el; };`);
  tap(ctx, ...EDGE_AB);
  assert.ok(field(ctx), "campo en la fila");
  assert.equal(ctx.run("__focus"), 1, "con ratón, foco en la frase");
  assert.equal(field(ctx).placeholder, "Cliente → Tienda", "propone la frase de su tipo");
  assert.equal(field(ctx).getAttribute("aria-label"), "Frase de este paso");
  assert.equal(ctx.run("scInlineStep.focus"), false, "el foco se da una sola vez");
  ctx.run(`scTapAddStep("edge", 5, "touch")`);
  assert.equal(ctx.run("scInlineStep.focus"), false, "con el dedo, el campo espera a que lo toquen");
  assert.ok(field(ctx), "pero está en la fila");
  assert.equal(ctx.run("__focus"), 1, "sin foco (sin teclado)");
});

test("B2 · Enter guarda la frase (una entrada de Undo), vacía la quita, Escape deja la que había, el Enter de un IME no cuenta", () => {
  const ctx = boot();
  tap(ctx, ...EDGE_AB);
  const key = (k, extra = {}) => { const ev = { key: k, keyCode: { Enter: 13, Escape: 27 }[k], preventDefault() {}, stopPropagation() {}, ...extra }; field(ctx).onkeydown(ev); };
  field(ctx).value = "  El cliente pulsa «Pagar»  ";
  key("Enter", { isComposing: true });
  key("Enter", { keyCode: 229 });
  assert.equal(steps(ctx)[0].message, undefined, "IME: no confirma (isComposing ni 229)");
  key("Enter");
  assert.equal(steps(ctx)[0].message, "El cliente pulsa «Pagar»", "guardada, sin espacios de los bordes");
  assert.equal(ctx.run("undoStack.length"), 2, "toque + frase");
  assert.equal(field(ctx), null, "la fila vuelve a leer la frase");
  ctx.run(`scBeginInlineMessage(${steps(ctx)[0].id})`);
  assert.equal(field(ctx).value, "El cliente pulsa «Pagar»", "editar parte de la que hay");
  field(ctx).value = "otra"; key("Escape");
  assert.equal(steps(ctx)[0].message, "El cliente pulsa «Pagar»", "Escape no cambia nada");
  assert.equal(ctx.run("undoStack.length"), 2);
  ctx.run(`scBeginInlineMessage(${steps(ctx)[0].id})`);
  field(ctx).value = "   "; key("Enter");
  assert.equal(steps(ctx)[0].message, undefined, "vacía, se quita");
  assert.equal(ctx.run("undoStack.length"), 3);
  ctx.run("undo()");
  assert.equal(steps(ctx)[0].message, "El cliente pulsa «Pagar»", "y Undo la devuelve");
});

test("B3 · salir del campo guarda (lo que pasa al tocar el siguiente paso); sin cambios no deja Undo", () => {
  const ctx = boot();
  tap(ctx, ...EDGE_AB);
  field(ctx).value = "Primero"; field(ctx).onblur();
  assert.equal(steps(ctx)[0].message, "Primero");
  ctx.run(`scBeginInlineMessage(${steps(ctx)[0].id})`);
  field(ctx).onblur();
  assert.equal(ctx.run("undoStack.length"), 2, "igual que estaba: sin entrada");
});

test("B4 · tocar la frase de una fila la edita en línea; reproduciendo no hay campo", () => {
  const ctx = boot();
  tap(ctx, ...EDGE_AB);
  field(ctx).value = "Hola"; field(ctx).onblur();
  const said = ctx.run(`document.getElementById("scStoryboard").querySelector(".scStepMessage")`);
  assert.equal(said.textContent, "«Hola»");
  said.onclick({ stopPropagation() {} });
  assert.ok(field(ctx), "editando");
  ctx.run(`scInlineStep = { id: ${steps(ctx)[0].id}, focus: false }; isScenarioPlaybackActive = () => true; scStorySignature = ""; scRenderStoryboard();`);
  assert.equal(field(ctx), null);
});

test("B5 · el estado vacío explica el gesto (es/en) y la biblioteca ya no pide crear un evento para empezar", () => {
  for (const [lang, tapTxt, libTxt] of [[null, "Toca una conexión o un elemento del sistema para contar el primer paso.", "Para empezar no hace falta"],
    ["en", "Tap a connection or an element of the system to tell the first step.", "You don't need one to start"]]) {
    const ctx = boot(lang);
    ctx.run(`scStorySignature = ""; scRenderStoryboard(); scRenderEventLibrary();`);
    assert.match(ctx.run(`document.getElementById("scEmptyState").textContent`), new RegExp(tapTxt.replace(/[.]/g, "\\.")));
    assert.match(ctx.run(`document.getElementById("scEventLibrary").textContent`), new RegExp(libTxt));
    ctx.run(`const sc = createScenario(P(), "H"); scSelectStory(sc.id); scStorySignature = ""; scRenderStoryboard();`);
    assert.equal(ctx.run(`document.getElementById("scEmptyState").textContent`), tapTxt, "Historia vacía");
  }
});

test("C1 · el formato no cambia: el documento contado se guarda, se vuelve a cargar idéntico y valida", () => {
  const ctx = boot();
  tap(ctx, ...EDGE_AB); field(ctx).value = "Uno"; field(ctx).onblur(); tap(ctx, ...NODE_C);
  const data = ctx.run(`JSON.stringify({ version: 5, app: "fluyo", doc: { theme: doc.theme, customBg: doc.customBg, cur: 0, eventTypes: doc.eventTypes, nextEventTypeId: doc.nextEventTypeId, pages: doc.pages } })`);
  const again = ctx.run("JSON.stringify(projectFromProjectData(" + data + ").doc.pages)");
  assert.equal(JSON.parse(again)[0].scenarios[0].steps.length, 2);
  assert.deepEqual(JSON.parse(again)[0].scenarios, JSON.parse(data).doc.pages[0].scenarios, "lo guardado = lo cargado");
});

test("C2 · kernel, motor, formato y MCP: ningún archivo del kernel cambia respecto a la base", () => {
  const KERNEL = ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js", "js/render.js"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", "c2c63ec", "--", ...KERNEL], { encoding: "utf8" }).trim();
  assert.equal(changed, "", "kernel y render intactos");
});

test("C2b · alcance frente a c2c63ec: solo estos archivos servidos; undoS1a (para los alcances antiguos) los devuelve EXACTOS", () => {
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const { undoS1a, PIECES, NEW_FILES } = require("./fluyo-stories-2-0-s1a-undo.cjs");
  /* FLUYO-STORIES-2.0 S1b va encima: sus archivos también cambian frente a c2c63ec y undoS1a la deshace antes */
  const { PIECES: PIECES_S1B } = require("./fluyo-stories-2-0-s1b-undo.cjs");
  const { PIECES: PIECES_ST2A } = require("./fluyo-stories-2-0-s2a-undo.cjs");   /* FLUYO-STORIES-2.0 S2a va encima de S1b (undoS1b la deshace antes) */
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", "c2c63ec", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...new Set(["css/styles.css", "js/editor-scenarios.js", "js/i18n-en-editor.js", "js/interaction.js", "sw.js", ...Object.keys(PIECES_S1B), ...Object.keys(PIECES_ST2A)])].sort());
  assert.deepEqual(NEW_FILES, []);
  for (const f of [...new Set(Object.keys(PIECES).concat(Object.keys(PIECES_S1B), Object.keys(PIECES_ST2A), "sw.js"))]) {
    /* la constante CACHE no es una pieza (sube en cada tarea): se compara sin ella */
    const noCache = (t) => t.replace(/const CACHE = "fluyo-static-v\d+";/, "");
    const base = execFileSync("git", ["-C", gitRoot, "show", "c2c63ec:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    /* sin finales CRLF: un checkout con core.autocrlf trae sw.js (que no tiene piezas) en CRLF y la base va en LF */
    assert.equal(noCache(undoS1a(f, read(f)).replace(/\r\n/g, "\n")), noCache(base), f + ": undoS1a exacto");
  }
});

test("C3 · claves nuevas en inglés, ninguna clave muerta y CACHE actual (v118 desde S1b)", () => {
  const ed = read("js/editor-scenarios.js"), en = read("js/i18n-en-editor.js");
  for (const k of ["stories.emptyTap", "event.emptyHintTap", "step.implicit.edge", "step.implicit.node", "step.implicit.nodeSentence", "step.inline.placeholder", "step.inline.aria", "step.inline.edit"]) {
    assert.ok(ed.includes(`"${k}"`), k + " se usa");
    assert.ok(en.includes(`"${k}":`), k + " en inglés");
  }
  for (const k of ["stories.emptyDrag", "stories.emptyWillAppear", "event.emptyHint"]) {
    assert.ok(!ed.includes(`"${k}"`) && !en.includes(`"${k}":`), k + " retirada de los dos lados");
  }
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v119";/);
});

test("C4 · en Historias el doble clic y el doble toque no editan el texto del elemento", () => {
  const src = read("js/interaction.js");
  assert.match(src, /cv\.addEventListener\("dblclick", ev=>\{ if\(!presenting && uiMode!=="story"\) openEditorAt\(toWorld\(ev\)\); \}\);/);
  assert.match(src, /if\(isDoubleTap\(ev\)\)\{ if\(uiMode!=="story"\) openEditorAt\(p\); return; \}/);
  const ed = read("js/editor-scenarios.js");
  assert.match(ed, /cv\.addEventListener\("pointerdown", scTapPointerDown\);/);
  assert.match(ed, /cv\.addEventListener\("pointerup", scTapPointerUp\);/);
});
