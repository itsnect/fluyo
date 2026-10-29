"use strict";
const { undoS1b } = require("./fluyo-stories-2-0-s1b-undo.cjs");   /* FLUYO-STORIES-2.0 S1b: «Falla aquí» va encima del menú de esta tarea */
/* FLUYO-I18N-002 S2a — Historias en el idioma de la interfaz, sin tocar el kernel (decisiones D-S2-1…7 aprobadas por el PO; la
   reproducción que compone story-playback.js es S2b).
   · O  Oráculo: el texto que componen las funciones de Historias (fila del paso, motivo de un envío fallido, menú del paso, mensaje
        del paso, esperas y llegadas, tiempos, barra de colocación, confirmaciones de borrar selección/página/Historia, ruta observada)
        es en español IDÉNTICO al de a0919e6, ejecutando el código de la base y el de ahora sobre el mismo corpus de casos.
   · E  Inglés: las mismas funciones dicen inglés, sin restos en español; el contenido del autor llega tal cual.
   · P  Gramática: con un idioma de prueba de escritura CJK (sin espacios, marcadores de clave y de parámetro), toda salida se compone
        SOLO de plantillas enteras y parámetros: nada pegado por el código, ningún parámetro perdido ni repetido; listas con
        Intl.ListFormat del idioma de la frase («、»).
   · S  Estático: en los archivos de S2a, ningún resultado de FluyoI18n.t pegado a texto, ni «y» de lista, ni campos del documento
        como clave o texto base.
   · H  HTML de Historias: 0 textos sin marca; lo que pinta JS lleva data-i18n-js con el texto base de su clave.
   · D  Diccionarios: lo que lee el Viewer en el común; «Explain the system» (decisión 279); fr/ja/zh sin claves de S2a (caen al inglés).
   · V  Vivo: cambiar de idioma repinta la hoja sin tocar documento ni Deshacer.
   · A  Alcance frente a a0919e6: solo estos archivos; undoS2a da la base EXACTA y va debajo de undoS1; kernel intacto; CACHE v111.
   Chrome real: test/fluyo-i18n-002-s2a-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const scan = require("./i18n-scan.cjs");

const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const read = scan.read;
const BASE = "a0919e6";
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
const hasGit = (() => { try { atBase("sw.js"); return true; } catch { return false; } })();
const J = (v) => JSON.parse(JSON.stringify(v));
const DICT_FILES = fs.readdirSync(path.join(root, "js")).map((f) => "js/" + f).filter((f) => scan.DICT.test(f)).sort();
const S2A_JS = ["js/editor-scenarios.js", "js/selection.js", "js/flow-semantics.js", "js/present-story.js", "js/viewer.js", "js/ui.js"];

/* ───────── arnés: kernel + i18n (en un idioma) + estado + selección + funciones de Historias extraídas ───────── */
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js", "document-integrity.js"];
function extract(src, name) {
  const at = src.indexOf("\nfunction " + name + "(");
  if (at < 0) return null;
  let i = src.indexOf("{", src.indexOf(")", at)), depth = 0, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") q = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return src.slice(at + 1, i + 1);
  }
  throw new Error("sin cierre: " + name);
}
const ED_FNS = ["scNum", "scFormatTime", "formatRelativeDelay", "scNodeLabel", "scNodeFallback", "scSourceFallback", "scEdgeLabel", "scEdgeSecondary", "scTargetLabel", "scIsTargetMissing",
  "describeScenarioStep", "scSendFailText", "scWhereLabel", "scStepTitle", "scStepMessage", "scOrderedSteps", "scStoryMenu", "scReverseMenuItem", "scMessageMenuItem",
  "scArrivalNames", "scArrivalMenuItem", "scTemporalHint", "scUpdatePlacementBar", "scPlacementType", "scDeleteScenario"];
const PROBE_KEYS = (() => { const m = new Map(); for (const u of scan.catalog().uses) m.set(u.key, u.es); return m; })();
/* Idioma de prueba «CJK»: cada plantilla es 〔clave〕 seguida de sus parámetros 《{p}》, sin un solo espacio. Un plural da la misma forma. */
function probeDict() {
  const d = {};
  for (const [k, es] of PROBE_KEYS) {
    const ps = [...new Set(scan.placeholders(es))];
    const v = "〔" + k + "〕" + ps.map((p) => "《{" + p + "}》").join("");
    d[k] = typeof es === "object" ? { other: v } : v;
  }
  return d;
}
function harness({ lang = "es", src = read, edSrc } = {}) {
  const fakeNode = (tag) => ({ tag, children: [], textContent: "", hidden: false, className: "", dataset: {}, attrs: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); return c; } });
  const els = {}, $ = (id) => (els[id] = els[id] || fakeNode(id));
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams, Intl, console, $, GRID: 20, innerWidth: 1280, innerHeight: 800,
    location: { search: lang === "es" ? "" : "?lang=" + lang }, navigator: { languages: [] },
    document: { createElement: fakeNode, createTextNode: (t) => ({ textContent: t, children: [] }), body: fakeNode("body") } });
  const R = (code) => vm.runInContext(code, ctx);
  for (const f of KERNEL) vm.runInContext(src("js/" + f), ctx, { filename: f });
  for (const f of DICT_FILES) vm.runInContext(src(f), ctx, { filename: f });
  if (lang === "ja") { ctx.__probe = probeDict(); R("FLUYO_LOCALES.ja = __probe;"); }
  vm.runInContext(src("js/i18n.js"), ctx, { filename: "i18n.js" });
  R(`var selN=new Set(), selE=new Set(), clip=null, scPlayback=null, scStatus="idle", scActive=1, scPlacement=null, scContext=null, scSelectedStep=null, __commits=0, __menu=null, __notices=[], __confirms=[], __coarse=false;
     function confirm(m){ __confirms.push(m); return false; } function alert(){} function refreshPanel(){} function renderTabs(){} function scheduleAutosave(){}
     function isScenarioPlaybackActive(){ return scStatus==="running"; } function scActiveScenario(){ return P().scenarios.find(s=>s.id===scActive) || null; }
     function scCancelPlacement(){ scPlacement=null; } function scCommit(){ __commits++; } function scNotice(t){ __notices.push(t); } function scBodyFlag(){}
     function scCoarsePointer(){ return __coarse; } function scReset(){} function scMenuSections(anchor, menu){ __menu = menu; } function scEdgeCandidates(){ return []; }`);
  R(src("js/state.js").split("/* ===================== Viewport")[0]);
  vm.runInContext(src("js/selection.js"), ctx, { filename: "js/selection.js" });
  /* el editor de esta tarea: S1b («Falla aquí», con funciones que no se extraen aquí) deshecha; en la base no hace nada */
  const ed = edSrc || undoS1b("js/editor-scenarios.js", src("js/editor-scenarios.js"));
  vm.runInContext(ED_FNS.map((n) => extract(ed, n)).filter(Boolean).join("\n"), ctx, { filename: "js/editor-scenarios.js#extract" });
  const flow = ed.match(/\nconst SC_FLOW_WORDS = \{[\s\S]*?\n\};/);
  R(flow[0].replace("const SC_FLOW_WORDS", "var SC_FLOW_WORDS"));
  R(ed.match(/\nconst SC_DEFAULT_PHRASES = \{[\s\S]*?\};/)[0].replace("const SC_DEFAULT_PHRASES", "var SC_DEFAULT_PHRASES"));
  return { R, ctx, els, load: (p) => R("doc=projectFromProjectData(" + JSON.stringify(p) + ").doc; undoStack.length=0; redoStack.length=0; __commits=0; scSelectedStep=null;") };
}
const baseSrc = (f) => atBase(f);

/* ───────── corpus ───────── */
const N = (id, label) => ({ id, shape: "rect", x: id * 220, y: 200, w: 150, h: 60, label, color: "#5b8db5", fill: null, border: "solid", lblPos: "center", textBg: null, font: null, bold: false, pulse: false, order: id });
const E = (id, from, to) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], label: "", font: null, bold: false, endArrow: true, startArrow: false, flowDir: "normal" });
const AUTHOR = { client: "Cliente {n} «web»", api: "API · pagos", db: "Inventario & stock", et: "Petición {x}", msg: "El cliente pulsa «Pagar» (49 €)", story: "Compra con éxito {name}" };
function project() {
  const steps = [
    { id: 1, at: 0, action: "SEND", edgeId: 5, eventTypeId: 1, message: AUTHOR.msg },
    { id: 2, at: 1500, action: "SEND", edgeId: 6, eventTypeId: 1, reverse: true },
    { id: 3, at: 1500, action: "OCCURRENCE", nodeId: 2, eventTypeId: 3 },
    { id: 4, at: 2600, action: "SET_STATE", nodeId: 3, state: "DOWN", eventTypeId: 2 },
    { id: 5, at: 3600, action: "SEND", edgeId: 7 },
    { id: 6, at: 4100, action: "OCCURRENCE", nodeId: 4 },
    { id: 7, at: 5100, action: "SET_STATE", nodeId: 3, state: "UP" },
    { id: 8, at: 6100, action: "SET_STATE", nodeId: 2, state: "DOWN" },
  ];
  return { version: 5, app: "fluyo", settings: { speed: 0.5, dots: 3, build: false, stagger: 0.45, grid: false, snap: false, font: "Georgia, serif", single: false },
    doc: { theme: "dark", customBg: "", cur: 0, nextEventTypeId: 4,
      eventTypes: [{ id: 1, name: AUTHOR.et, primitive: "FLOW", sentenceTemplate: "{source} pide a {target}", visual: { kind: "token", value: "●" }, motion: "normal" },
        { id: 2, name: "Caída", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} se cae", visual: { kind: "token", value: "✕" } },
        { id: 3, name: "Comprobación", primitive: "OCCURRENCE", sentenceTemplate: "{target} comprueba", visual: { kind: "token", value: "✓" }, presentation: { nodeEffects: { message: "Revisando", highlight: true } } }],
      pages: [{ name: "Checkout", nextId: 100, behaviors: [{ nodeId: 3, initialState: "UP" }], nextScenarioId: 2,
        nodes: [N(1, AUTHOR.client), N(2, AUTHOR.api), N(3, AUTHOR.db), N(4, "")], edges: [E(5, 1, 2), E(6, 2, 3), E(7, 2, 4)],
        scenarios: [{ id: 1, engineVersion: 2, name: AUTHOR.story, nextStepId: 9, steps, arrivalDependencies: [{ stepId: 4, waitsForArrivalOf: [1, 2] }] }] }] } };
}
/* Lo que dicen las funciones de texto, en un contexto ya cargado con el corpus */
function sample(h) {
  const R = h.R, out = {};
  out.delays = J(R("[0,1,250,999,1000,1500,1600,2000,2250,9999,60000].map(formatRelativeDelay)"));
  out.times = J(R("[0,1,1234,1600,60000].map(scFormatTime)"));
  out.rows = J(R("P().scenarios[0].steps.map(s => { const d = describeScenarioStep(s); return [d.primary, scTargetLabel(s), scStepTitle(s), scWhereLabel(s)]; })"));
  out.fail = J(R("[[1,'source_down'],[1,'target_down'],[5,'target_down'],[5,'source_down']].map(([id,r]) => scSendFailText(P().scenarios[0].steps.find(s=>s.id===id), r))"));
  out.menus = [];
  for (const id of [1, 2, 3, 4, 5, 6]) { R(`__menu=null; scStoryMenu(scActiveScenario().steps.find(s=>s.id===${id}), null)`);
    out.menus.push(J(R("[__menu.title, __menu.subtitle, __menu.sections.map(sec => sec.map(it => [it.label, it.hint || '', it.sub ? [it.sub.title, it.sub.items.map(x => [x.label, x.hint || ''])] : null]))]"))); }
  out.arrivals = J(R("[scArrivalNames([1]), scArrivalNames([1,2]), scArrivalNames([1,2,3])]"));
  out.placement = [];
  for (const setup of ["scPlacement={kind:'place', eventTypeId:1}", "scPlacement={kind:'place', eventTypeId:3}", "scPlacement={kind:'retarget', eventTypeId:1, stepId:1}", "scPlacement={kind:'retarget', eventTypeId:2, stepId:4}",
    "scPlacement={kind:'place', origin:'created', eventTypeId:1}", "__coarse=true; scPlacement={kind:'place', origin:'created', eventTypeId:3}", "__coarse=false; scPlacement={kind:'multi', eventTypeId:1, existing:new Set([5]), targets:new Set([6,7])}",
    "scPlacement=null; scContext={kind:'same', stepId:2}", "scPlacement={kind:'place', eventTypeId:1}; scContext={kind:'same', stepId:3}", "scContext=null; scPlacement={kind:'place', eventTypeId:99}"]) {
    R(setup + "; scUpdatePlacementBar();"); out.placement.push(R("$('scPlacementText').textContent") + " | " + R("scTemporalHint()"));
  }
  R("scPlacement=null; scContext=null;");
  out.placement.push(R("(() => { const s = scActiveScenario().steps; scActiveScenario().steps = []; const h = scTemporalHint(); scActiveScenario().steps = s; return h; })()"));
  out.flow = J(R(`[SC_FLOW_WORDS.AVAILABLE, SC_FLOW_WORDS.UNAVAILABLE, SC_FLOW_WORDS.NO_PATH, SC_FLOW_WORDS.byDefault, SC_FLOW_WORDS.auto, SC_FLOW_WORDS.noPair, SC_FLOW_WORDS.missing,
    SC_FLOW_WORDS.short.AVAILABLE, SC_FLOW_WORDS.short.UNAVAILABLE, SC_FLOW_WORDS.none, SC_FLOW_WORDS.tooMany]`));
  R(`__confirms.length=0; scDeleteScenario(); P().scenarios[0].steps=[]; scDeleteScenario();`);
  out.deleteStory = J(R("__confirms"));
  out.seeds = J(R("[SC_DEFAULT_PHRASES.connection, SC_DEFAULT_PHRASES.element]"));
  return out;
}
/* Confirmaciones de selection.js: un corpus que recorre todas las ramas */
function confirms(h) {
  const R = h.R, out = [];
  const st = (name, moments, targets) => ({ storyId: 1, name, moments, targets });
  const impacts = [
    [{ stories: [st(AUTHOR.story, 1, ["Cliente → API"])], behaviors: [] }, 1, 0],
    [{ stories: [st(AUTHOR.story, 2, ["A → B", "C"])], behaviors: [3] }, 0, 1],
    [{ stories: [st("Pago", 1, []), st("Alta {x}", 3, ["A", "B", "C", "D"])], behaviors: [3, 4] }, 2, 1],
    [{ stories: [st("Uno", 1, ["Inventario"]), st("Dos", 1, ["Hielo"]), st("Tres", 4, ["X"])], behaviors: [] }, 1, 1],
  ];
  for (const [imp, n, e] of impacts) out.push(R(`deleteConfirmMessage(${JSON.stringify(imp)}, ${n}, ${e})`));
  const pages = [
    { name: "Vacía", nodes: 0, connections: 0, behaviors: 0, stories: [] },
    { name: "Solo nodos {n}", nodes: 1, connections: 0, behaviors: 0, stories: [] },
    { name: "Mixta", nodes: 3, connections: 1, behaviors: 2, stories: [] },
    { name: "Inventario", nodes: 0, connections: 2, behaviors: 1, stories: [{ name: "Hielo", moments: 0 }] },
    { name: "Grande «x»", nodes: 12, connections: 9, behaviors: 0, stories: Array.from({ length: 11 }, (_, i) => ({ name: "Historia " + (i + 1), moments: i % 3 })) },
    { name: "Una", nodes: 1, connections: 1, behaviors: 1, stories: [{ name: "Sola", moments: 1 }] },
  ];
  for (const p of pages) out.push(R(`pageDeleteConfirmMessage(${JSON.stringify(p)})`));
  return out;
}
function loaded(opts) { const h = harness(opts); h.load(project()); return h; }

/* ───────── O · oráculo ───────── */
test("O · español IDÉNTICO a a0919e6: fila, motivo, menú del paso, mensaje, esperas y llegadas, tiempos, barra de colocación, ruta y borrar Historia", { skip: !hasGit }, () => {
  const now = sample(loaded()), base = sample(loaded({ src: baseSrc }));
  for (const k of Object.keys(base)) assert.deepEqual(now[k], base[k], k);
  assert.match(now.rows[0][0], /Cliente \{n\} «web» pide a API · pagos/, "el contenido del autor, tal cual");
});
test("O · confirmaciones de borrar selección y página (decisión 280): español IDÉNTICO a a0919e6 en todas las ramas", { skip: !hasGit }, () => {
  assert.deepEqual(confirms(loaded()), confirms(loaded({ src: baseSrc })));
});
test("O · el trazado del registro de Detalles ya no escapa HTML dentro de textContent (defecto previo, corregido al migrar)", () => {
  const src = read("js/editor-scenarios.js");
  assert.doesNotMatch(src, /textContent\s*=\s*[^;\n]*escapeHtml\(/);
  assert.doesNotMatch(src, /createTextNode\([^)]*escapeHtml\(/);
  assert.match(atBase("js/editor-scenarios.js"), /escapeHtml\(lbl\)/, "en la base estaba");
});

/* ───────── E · inglés ───────── */
const SPANISH = /[ñáéíóú¿¡«»]|\b(el|la|los|las|de|del|que|una?|para|con|por|se|sin|y)\b/;
test("E · inglés: las mismas funciones hablan inglés, sin restos en español; el contenido del autor llega intacto", () => {
  const s = sample(loaded({ lang: "en" })), c = confirms(loaded({ lang: "en" }));
  const strip = (x) => String(x).split(AUTHOR.client).join("").split(AUTHOR.api).join("").split(AUTHOR.db).join("").split(AUTHOR.et).join("").split(AUTHOR.msg).join("").split(AUTHOR.story).join("")
    .replace(/Caída|Comprobación|Revisando|Inventario|Hielo|Historia \d+|Alta \{x\}|Pago|Uno|Dos|Tres|Sola|Vacía|Solo nodos \{n\}|Mixta|Grande «x»|Una\b|Cliente → API|pide a|se cae|comprueba/g, "");
  const flat = JSON.stringify([s, c]);
  for (const piece of JSON.parse(flat, (k, v) => v).toString().split(",")) assert.doesNotMatch(strip(piece), SPANISH, "«" + piece + "»");
  assert.deepEqual(s.delays, ["at the same time", "1 ms later", "250 ms later", "999 ms later", "1 s later", "1.5 s later", "1.6 s later", "2 s later", "2.3 s later", "10 s later", "60 s later"]);
  assert.equal(s.rows[4][0], "API · pagos → ? sends", "frase de un envío sin evento (un extremo sin nombre se lee «?», como siempre)");
  assert.equal(s.rows[6][0], "Inventario & stock recovers");
  assert.deepEqual(s.arrivals, ["“● Petición {x}” (Cliente {n} «web» → API · pagos)", "“● Petición {x}” (Cliente {n} «web» → API · pagos) and “● Petición {x}” (Inventario & stock → API · pagos)",
    "“● Petición {x}” (Cliente {n} «web» → API · pagos), “● Petición {x}” (Inventario & stock → API · pagos), and “✓ Comprobación” (API · pagos)"]);
  assert.equal(c[1].split("\n")[0], "This connection is used in 1 story:");
  assert.equal(c[2].split("\n").at(-1), "Do you want to delete them anyway?");
  assert.match(c[6].split("\n")[0], /^The page “Mixta” has 3 elements, 1 connection, and 2 initial availability conditions\.$/);
  assert.equal(c[8].split("\n").at(-4), "• …and 3 more stories");
  assert.deepEqual(s.seeds, ["{source} sends to {target}", "{target} changes"], "la frase de un evento nuevo nace en el idioma de la interfaz (D-S2-3)");
  assert.deepEqual(s.deleteStory, [`Delete the story “${AUTHOR.story}”? It has 7 moments. Events in the library are kept.`, `Delete the story “${AUTHOR.story}”? Events in the library are kept.`]);
});

/* ───────── P · gramática para cualquier idioma ───────── */
const GLUE = /[\s⚠•+‹…·、▾●✓✕◆|]/gu;   // «|» separa, en sample(), la barra de colocación de su pista temporal
function onlyTemplates(text, author) {
  /* fuera: los parámetros (《…》, que pueden contener otras plantillas), los marcos de clave y el contenido del autor; lo que quede es lo
     que el CÓDIGO pegó. */
  let s = String(text), prev;
  do { prev = s; s = s.replace(/《[^《》]*》/g, ""); } while (s !== prev);
  s = s.replace(/〔[a-zA-Z.]+〕/g, "");
  for (const a of author) s = s.split(a).join("");
  return s.replace(GLUE, "");
}
test("P · idioma de prueba CJK: toda salida es plantilla entera + parámetros; nada pegado por el código; listas con «、»", () => {
  const s = sample(loaded({ lang: "ja" })), c = confirms(loaded({ lang: "ja" }));
  /* contenido del autor del corpus (nombres de la página, de Historias, de eventos, etiquetas y destinos de las confirmaciones) */
  const author = [AUTHOR.client, AUTHOR.api, AUTHOR.db, AUTHOR.et, AUTHOR.msg, AUTHOR.story, "Caída", "Comprobación", "Revisando", "Cliente → API", "A → B", "Alta {x}", "Solo nodos {n}",
    "Grande «x»", "Inventario", "Hielo", "Mixta", "Vacía", "Pago", "Sola", "Una", "Uno", "Dos", "Tres", /Historia \d+/, "→", "?", "#"];
  const all = [];
  JSON.stringify([s, c], (k, v) => { if (typeof v === "string") all.push(v); return v; });
  for (const t of all) {
    /* {source}/{target} de la frase sembrada de un evento nuevo son contrato (marcadores), no parámetros sin rellenar */
    assert.doesNotMatch(author.reduce((x, a) => x.split(a).join(""), t).replace(/\{(source|target)\}/g, ""), /\{[a-z]+\}/i, "un parámetro sin rellenar: «" + t + "»");
    if (!/[〔《]/.test(t)) continue;   // contenido del autor solo (título del menú, nombres) o vacío
    assert.equal(onlyTemplates(t, author), "", "texto pegado por el código: «" + t + "»");
  }
  assert.match(s.arrivals[1], /》、〔/, "la lista de llegadas, con Intl.ListFormat(ja)");
  assert.ok(c[6].includes("、"), "el recuento de la página, con Intl.ListFormat(ja)");
  assert.doesNotMatch(all.join("\n"), / y | and /, "ninguna conjunción pegada por el código");
  for (const t of all) assert.doesNotMatch(t, /[〕》][ \t]+〔/, "dos textos de la interfaz pegados con un espacio por el código: «" + t + "»");
});
test("P · cada parámetro entra una sola vez y en la plantilla que lo nombra (idioma de prueba que invierte el orden)", () => {
  const h = loaded({ lang: "ja" });
  for (const [k, es] of PROBE_KEYS) {
    const ps = [...new Set(scan.placeholders(es))];
    if (ps.length < 2) continue;
    const params = Object.fromEntries(ps.map((p, i) => [p, p === "count" ? 2 : "V" + i]));
    h.ctx.__p = params;
    const out = h.R(`FluyoI18n.t(${JSON.stringify(k)}, ${JSON.stringify(es)}, __p)`);
    for (const [p, v] of Object.entries(params)) assert.equal(out.split("《" + v + "》").length, 2, `${k}: {${p}} una vez`);
  }
});

/* ───────── S · estático ───────── */
test("S · en los archivos de S2a: ningún resultado de FluyoI18n.t pegado a texto con letras, ni « y » de lista, ni campos del documento como clave o texto base", () => {
  for (const f of S2A_JS) {
    const src = read(f);
    for (const c of scan.calls(src)) {
      assert.ok(typeof c.key === "string" && c.es !== null, `${f}:${c.line} clave y texto base literales: ${c.raw}`);
      assert.doesNotMatch(c.raw, /\.(name|label|message|sentenceTemplate)\s*[,)]/, `${f}:${c.line}: un campo del documento no es clave ni texto base`);
      const after = src.slice(c.end).match(/^[^)]*\)\s*\+\s*"([^"]*)"/), before = src.slice(Math.max(0, c.start - 60), c.start - "FluyoI18n.t(".length).match(/"([^"]*)"\s*\+\s*$/);
      if (after) assert.doesNotMatch(after[1], /\p{L}/u, `${f}:${c.line}: texto pegado detrás de t(): «${after[1]}»`);
      if (before) assert.doesNotMatch(before[1], /\p{L}/u, `${f}:${c.line}: texto pegado delante de t(): «${before[1]}»`);
    }
  }
  for (const f of ["js/editor-scenarios.js", "js/selection.js"]) assert.doesNotMatch(read(f), /join\(" y "\)|\+" y "\+|" y "\s*\+/, f + ": la «y» de una lista la pone FluyoI18n.list");
  assert.match(read("js/present-story.js"), /probe\("psCaption", end \? end\.caption : FluyoI18n\.t\("story\.paused","En pausa"\)\)/, "Present reserva el alto con el texto del idioma activo");
  assert.match(read("js/viewer.js"), /\|\| FluyoI18n\.t\("story\.unnamed","Elemento sin nombre"\);/, "Viewer: el nombre de reserva, en el idioma activo");
});
test("S · trinquete: editor-scenarios, selection y flow-semantics sin texto de interfaz suelto (solo nombres de tecla y una clave de datos)", () => {
  const left = (f) => [...new Set(scan.jsHardcoded(read(f)).map((x) => x.s))].sort();
  assert.deepEqual(left("js/editor-scenarios.js"), ["Enter", "Escape", "Options"]);
  assert.deepEqual(left("js/selection.js"), []);
  assert.deepEqual(left("js/flow-semantics.js"), []);
  const base = JSON.parse(read(scan.BASELINE));
  assert.equal(base.js["js/editor-scenarios.js"], scan.jsHardcoded(read("js/editor-scenarios.js")).length); assert.equal(base.js["js/selection.js"] || 0, 0); assert.equal(base.js["js/flow-semantics.js"] || 0, 0);
});

/* ───────── H · HTML ───────── */
const HTML = read("index.html");
const REGIONS = [['<div id="scNow"', '<span id="scNowProgress"'], ['<header class="scHeader">', '<div id="scPlacementBar"'], ['<div id="scPlacementBar"', '<dialog id="scEventDialog"'],
  ['<dialog id="scEventDialog"', '<dialog id="scDetailsDialog"'], ['<dialog id="scDetailsDialog"', "</footer></dialog>"]];
test("H · región de Historias de index.html: ni un texto ni atributo visible sin marca", () => {
  for (const [a, b] of REGIONS) assert.deepEqual(scan.unmarked("index.html", a, b), [], a);
});
test("H · lo que pinta JS (transporte, título, rótulo de reproducción, diálogo de evento) lleva data-i18n-js con el texto base de su clave", () => {
  const js = scan.scanHtml(HTML).marks.filter((m) => m.where === "js");
  const S2A = ["event.create", "event.projectWide", "event.symbolEdge", "stories.none", "stories.playing", "story.pause", "story.play", "story.stop"];
  for (const k of S2A) assert.ok(js.some((m) => m.key === k), k);
  const base = new Map(scan.catalog().uses.filter((u) => u.raw !== "js").map((u) => [u.key, u.es]));
  for (const m of js.filter((x) => S2A.includes(x.key))) assert.equal(m.es, base.get(m.key), m.key);
  assert.match(HTML, /<button id="scPaletteToggle" type="button" aria-expanded="false" data-i18n-js="event\.toggle"><\/button>/, "el recuento de eventos lo pinta JS al abrir la hoja (el «Eventos · 0» del HTML no se veía nunca)");
});

/* ───────── D · diccionarios ───────── */
test("D · común/editor, «Explain the system» y fr/ja/zh sin claves de S2a (caen al inglés, nunca al español)", () => {
  const d = scan.dictionaries();
  for (const k of ["story.unnamed", "route.available", "route.unavailable", "route.noPath", "route.byDefault", "route.withDefault"]) assert.ok(k in d.en.common, "común: " + k);
  assert.equal(d.en.editor["editor.tell"], "Explain the system");
  /* una clave, un texto: el mismo español en todos sus usos (si cambia en un sitio y no en otro, una de las dos superficies cambia de texto) */
  const by = new Map();
  for (const u of scan.catalog().uses) (by.get(u.key) || by.set(u.key, new Set()).get(u.key)).add(JSON.stringify(u.es));
  assert.deepEqual([...by].filter(([, v]) => v.size > 1).map(([k]) => k), [], "claves con más de un texto base");
  const s2a = [...PROBE_KEYS.keys()].filter((k) => !(k in (atBaseDict())));
  assert.ok(s2a.length > 300, "≈ 345 claves nuevas: " + s2a.length);
  for (const code of ["fr", "ja", "zh"]) { const all = { ...d[code].common, ...d[code].editor }; assert.deepEqual(s2a.filter((k) => k in all), [], code); }
  const h = harness({ lang: "fr" });
  assert.equal(h.R('FluyoI18n.t("stories.new","Nueva historia")'), "New story");
  assert.ok(h.R("FluyoI18n.missing()").includes("fr:stories.new"));
});
function atBaseDict() {
  if (!hasGit) return {};
  const ctx = vm.createContext({});
  vm.runInContext(atBase("js/i18n-en.js"), ctx); vm.runInContext(atBase("js/i18n-en-editor.js"), ctx);
  return ctx.FLUYO_LOCALES.en;
}

/* ───────── V · en vivo ───────── */
test("V · cambio de idioma en vivo: la hoja se repinta (y la barra de colocación y el diálogo abierto) sin tocar documento ni Deshacer", () => {
  const src = read("js/editor-scenarios.js");
  const hook = src.slice(src.lastIndexOf("FluyoI18n.onChange("));
  for (const fn of ["scClosePopover(false)", "scRenderPanel()", "scUpdatePlacementBar()", "scRenderPhrase()", "scEditorLayout()", "scUpdateAccordionSummaries()"]) assert.ok(hook.includes(fn), fn);
  assert.doesNotMatch(hook, /pushUndo|scheduleAutosave|scCommit|setStep|createScenario/);
  assert.match(read("js/ui.js"), /syncTouchBar\(\);\n  syncStoryExpandLabel\(\);\n\}\);/);
});

/* ───────── A · alcance ───────── */
test("A · alcance frente a " + BASE + ": solo estos archivos; undoS2a da la base EXACTA y va debajo de undoS1; kernel intacto; sw.js solo CACHE v111", { skip: !hasGit }, () => {
  const { undoS2a, PIECES, NEW_FILES, BASE_S2A } = require("./fluyo-i18n-002-s2a-undo.cjs");
  assert.equal(BASE_S2A, BASE);
  assert.deepEqual(NEW_FILES, []);
  const FILES = ["index.html", "js/editor-scenarios.js", "js/flow-semantics.js", "js/i18n-en-editor.js", "js/i18n-en.js", "js/i18n.js", "js/present-story.js", "js/selection.js", "js/ui.js", "js/viewer.js"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean);
  /* FLUYO-I18N-002 S4 va encima: lo que solo cambia S4 (sin S4 es igual que la base) no cuenta para el alcance de S2a */
  const { undoS4, PIECES: PIECES_S4 } = require("./fluyo-i18n-002-s4-undo.cjs");
  const { PIECES: PIECES_S2B } = require("./fluyo-i18n-002-s2b-undo.cjs");   /* S2b va encima de S4 (undoS4 la deshace antes) */
  const { PIECES: PIECES_S3A } = require("./fluyo-i18n-002-s3a-undo.cjs");   /* y S3a encima de S2b (undoS2b la deshace antes) */
  const { undoEx, PIECES: PIECES_EX, NEW_FILES: NEW_EX } = require("./fluyo-examples-001-undo.cjs");   /* FLUYO-EXAMPLES-001 va encima de S3b (undoS3b la deshace antes) */
  const { PIECES: PIECES_S1A } = require("./fluyo-stories-2-0-s1a-undo.cjs");   /* FLUYO-STORIES-2.0 S1a va encima de EXAMPLES (undoEx la deshace antes) */
  const { PIECES: PIECES_S1B } = require("./fluyo-stories-2-0-s1b-undo.cjs");   /* FLUYO-STORIES-2.0 S1b va encima de S1a (undoS1a la deshace antes) */
  const { PIECES: PIECES_ST2A } = require("./fluyo-stories-2-0-s2a-undo.cjs");   /* FLUYO-STORIES-2.0 S2a va encima de S1b (undoS1b la deshace antes) */
  const { PIECES: PIECES_ST2B } = require("./fluyo-stories-2-0-s2b-undo.cjs");   /* FLUYO-STORIES-2.0 S2b va encima de S2a (undoS2a la deshace antes) */
  const { PIECES: PIECES_OUT } = require("./fluyo-stories-2-0-outcome-undo.cjs");   /* FLUYO-STORIES-2.0 · etiqueta del desenlace, encima de S2b (undoS2b la deshace antes) */
  const s4Only = (f) => NEW_EX.includes(f) || ((!!PIECES_S4[f] || !!PIECES_S2B[f] || !!PIECES_S3A[f] || !!PIECES_EX[f] || !!PIECES_S1A[f] || !!PIECES_S1B[f] || !!PIECES_ST2A[f] || !!PIECES_ST2B[f] || !!PIECES_OUT[f]) && undoS4(f, read(f)) === atBase(f));
  assert.deepEqual([...new Set([...changed, ...untracked])].filter((f) => !s4Only(f) || FILES.includes(f)).sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoS2a(f, read(f)), atBase(f), f + ": undoS2a exacto");
  assert.equal(undoEx("sw.js", read("sw.js")).replace('"fluyo-static-v121"', '"fluyo-static-v' + (111 - 1) + '"'), atBase("sw.js"), "sw.js: solo CACHE (sin archivos nuevos)");
  assert.ok(read("test/fluyo-i18n-002-s1-undo.cjs").includes("src = undoS2a(file, src);"), "undoS1 deshace antes esta tarea");
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/story-clock.js", "js/render.js", "s/index.html", "404.html", "css/system.css", "css/styles.css", "css/share.css", "js/i18n-fr.js", "js/i18n-ja.js", "js/i18n-zh.js",
    "js/i18n-fr-editor.js", "js/i18n-ja-editor.js", "js/i18n-zh-editor.js"]) assert.equal(undoS4(f, read(f)), atBase(f), f + " sin cambios (S2b: story-playback.js; S4, encima, se deshace antes)");
});
