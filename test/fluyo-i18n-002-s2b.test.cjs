"use strict";
/* FLUYO-I18N-002 S2b — El texto de la reproducción y los nombres sembrados de Historia, en el idioma de la interfaz, con el kernel
   intacto para el MCP (decisiones 281, 283, 289 y 295; D-S2-1 = A, K1).
   · O  Oráculo: SIN proveedor, el kernel dice EXACTAMENTE lo que decía en 86d910a (errores, consecuencias, cierre, frase del paso,
        arranque con errores, nombres de Historia nueva y copia, recorte a 120), ejecutando el código de la base y el de ahora sobre el
        mismo corpus. CON FluyoI18n.t en español también.
   · E  Inglés (vocabulario aprobado): «step», «Playback finished», «Not completed · …», 15 errores y su reserva, «Story 2»,
        «Story 1 copy», «Story 1 copy 2»; sin restos en español; el contenido del autor llega tal cual; fr/ja/zh caen al inglés,
        nunca al español.
   · P  Gramática: con un idioma de prueba de escritura CJK, toda salida del kernel es UNA plantilla entera más parámetros (nada
        pegado por el código, cada parámetro una sola vez).
   · K  Kernel: ningún idioma ni global de la interfaz en story-playback.js y model.js; el recorte de la copia se mide con el sufijo
        formateado; las reglas de unicidad son las del kernel; N3: los errores se forman al arrancar.
   · S  Estático: quien consume pasa el proveedor y los nombres sembrados; sin concatenar; las claves están en el diccionario común.
   · M  MCP: lo que el MCP llama no cambia (sentence, outcomes, finalAvailability, run) y su kernel-sources.ts, si está al lado, es
        este kernel.
   · A  Alcance frente a 86d910a: solo estos archivos; undoS2b da la base EXACTA y va encima de undoS4; CACHE v113.
   Chrome real: test/fluyo-i18n-002-s2b-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const scan = require("./i18n-scan.cjs");

const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const read = scan.read;
const BASE = "86d910a";
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
const hasGit = (() => { try { atBase("sw.js"); return true; } catch { return false; } })();
const DICT_FILES = fs.readdirSync(path.join(root, "js")).map((f) => "js/" + f).filter((f) => scan.DICT.test(f)).sort();
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js"];
const SPANISH = /[áéíóúñ¿¡«»]|\b(no está|vuelve a estar|se completó|reproducción|evento|eventos|conexión|elemento|historia|copia|nombre|apunta|duplicad)/i;

/* ───────── arnés: kernel (de HOY o de la base) + FluyoI18n en un idioma ───────── */
function probeDict() {
  const d = {};
  for (const u of scan.catalog().uses) {
    if (u.key in d) continue;
    const ps = [...new Set(scan.placeholders(u.es))];
    const v = "〔" + u.key + "〕" + ps.map((p) => "《{" + p + "}》").join("");
    d[u.key] = typeof u.es === "object" ? { other: v } : v;
  }
  return d;
}
function load({ lang = "es", src = read, i18n = true } = {}) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, Intl, console, GRID: 20, innerWidth: 1280, innerHeight: 800,
    location: { search: lang === "es" ? "" : "?lang=" + lang }, navigator: { languages: [] },
    document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), documentElement: { lang: "" } } });
  for (const f of KERNEL) vm.runInContext(src("js/" + f), ctx, { filename: f });
  if (i18n) {
    for (const f of DICT_FILES) vm.runInContext(read(f), ctx, { filename: f });
    if (lang === "ja") { ctx.__probe = probeDict(); vm.runInContext("FLUYO_LOCALES.ja = __probe;", ctx); }
    vm.runInContext(read("js/i18n.js"), ctx, { filename: "i18n.js" });
  }
  return { ctx, R: (code) => vm.runInContext(code, ctx) };
}

/* Corpus: una página con envíos que fallan por origen y por destino, uno al revés, un elemento sin nombre, momentos simultáneos y
   un escenario inválido. Las plantillas de frase son de quien escribe (aquí, en inglés para poder buscar restos de español). */
const PROBE = `(function (text, fmt) {
  doc = { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: [blankPage("Page 1")], cur: 0 };
  const N = (id, x, label) => ({ id, shape: "rect", x, y: 240, w: 170, h: 76, label, color: "#3aa7e8" });
  const pg = P(); pg.nodes = [N(1, 100, "Client"), N(2, 400, "Kafka {count}"), N(3, 700, ""), N(4, 900, "Shop\\nsecond line")];
  pg.edges = [{ id: 5, from: 1, to: 2, label: "" }, { id: 6, from: 2, to: 3, label: "" }]; pg.nextId = 7;
  const sc = createScenario(pg, "Lost message");
  const down = createEventType({ name: "Goes down", primitive: "SET_AVAILABILITY", availability: "DOWN", sentenceTemplate: "{target} goes down", visual: { value: "⚠" } });
  const up = createEventType({ name: "Back", primitive: "SET_AVAILABILITY", availability: "UP", sentenceTemplate: "{target} is back", visual: { value: "✓" } });
  const pub = createEventType({ name: "Publish", primitive: "FLOW", sentenceTemplate: "{source} sends to {target}", visual: { value: "📨" } });
  const occ = createEventType({ name: "Happens", primitive: "OCCURRENCE", sentenceTemplate: "{target} happens", visual: { value: "✓" } });
  createStep(sc, { at: 0, action: "SET_STATE", nodeId: 2, state: "DOWN", eventTypeId: down.id });
  createStep(sc, { at: 1000, action: "SEND", edgeId: 5, eventTypeId: pub.id });
  createStep(sc, { at: 2000, action: "SET_STATE", nodeId: 2, state: "UP", eventTypeId: up.id });
  createStep(sc, { at: 3000, action: "SEND", edgeId: 6, eventTypeId: pub.id });
  createStep(sc, { at: 3500, action: "SEND", edgeId: 6, reverse: true, eventTypeId: pub.id });
  createStep(sc, { at: 4000, action: "OCCURRENCE", nodeId: 3, eventTypeId: occ.id });
  createStep(sc, { at: 4000, action: "OCCURRENCE", nodeId: 4, eventTypeId: occ.id });
  createStep(sc, { at: 4500, action: "SET_STATE", nodeId: 1, state: "DOWN", eventTypeId: down.id });
  createStep(sc, { at: 5000, action: "SEND", edgeId: 5, eventTypeId: pub.id });
  const out = { };
  const run = FluyoStory.run(pg, sc);
  out.runOk = run.ok;
  const nodeName = (id) => { const n = pg.nodes.find((x) => x.id === id); return n ? (String(n.label).split("\\n")[0] || "?") : "?"; };
  const edgeEnds = (id) => pg.edges.find((e) => e.id === id) || null;
  out.captions = []; for (let vt = 0; vt <= 6500; vt += 250) out.captions.push(FluyoStory.caption(run.trace.events, vt, nodeName, edgeEnds, text));
  out.failed = FluyoStory.failedCount(run.trace.events);
  out.summaries = [0, 1, 2, 7].map((n) => FluyoStory.summary(n, text));
  const pb = { logEvents: run.trace.events, cursorVirtual: 0 };
  out.describe = ["ready", "finished"].map((ph) => FluyoStory.describe(ph, sc, pb, nodeName, edgeEnds, text));
  out.playing = [0, 1500, 3200, 5200].map((vt) => FluyoStory.describe("playing", sc, { logEvents: run.trace.events, cursorVirtual: vt }, nodeName, edgeEnds, text));
  out.clock = FluyoStoryClock.describe("finished", sc, pb, nodeName, edgeEnds, text);
  out.sentences = sc.steps.map((s) => FluyoStory.sentence(pg, s, doc.eventTypes.find((e) => e.id === s.eventTypeId), text));
  const gone = JSON.parse(JSON.stringify(sc.steps[1])); gone.edgeId = 99;
  out.sentenceGone = FluyoStory.sentence(pg, gone, pub, text);
  const codes = ["missing_node", "missing_edge", "missing_edge_endpoint", "duplicate_structure_id", "duplicate_node_id", "duplicate_edge_id", "unsupported_engine_version",
    "guard_exceeded", "invalid_timestamp", "invalid_structure", "invalid_behavior", "invalid_scenario", "invalid_state", "unknown_action", "duplicate_step_id"];
  out.errors = codes.map((c) => FluyoStory.errorMessages([{ code: c }], text));
  out.errorsMixed = FluyoStory.errorMessages([{ code: "nope" }, { code: "missing_node" }, { code: "missing_node" }, {}, { code: "other" }], text);
  out.errorsEmpty = [FluyoStory.errorMessages([], text), FluyoStory.errorMessages(undefined, text)];
  const bad = JSON.parse(JSON.stringify(sc)); bad.engineVersion = 99;
  out.startBad = FluyoStory.start(pg, bad, 0, text);
  const noNode = JSON.parse(JSON.stringify(sc)); noNode.steps[0].nodeId = 999;
  out.startNoNode = FluyoStory.start(pg, noNode, 0, text);
  out.startClock = FluyoStoryClock.start(pg, bad, 0, text);
  out.startOk = FluyoStoryClock.start(pg, sc, 0, text).ok;
  /* nombres de Historia: nueva, copias encadenadas, recorte a 120, ocupados */
  const q = blankPage("q"); out.names = [];
  const make = () => createScenario(q, defaultScenarioName(q, fmt)).name;
  out.names.push(make(), make(), make());
  const copy = () => duplicateScenario(q, q.scenarios[0].id, fmt).name;
  out.names.push(copy(), copy(), copy());
  const r = blankPage("r"); const long = "x".repeat(120); createScenario(r, long);
  out.long = [duplicateScenario(r, r.scenarios[0].id, fmt).name, duplicateScenario(r, r.scenarios[0].id, fmt).name, duplicateScenario(r, r.scenarios[0].id, fmt).name].map((s) => [s.length, s.slice(-12)]);
  const o = blankPage("o"); createScenario(o, "Historia 2"); createScenario(o, "Story 4"); createScenario(o, "Story 1");
  out.occupied = [defaultScenarioName(o, fmt), copyScenarioName(o, "Story 1", fmt), copyScenarioName(o, "Hola {n} {name}", fmt)];
  out.serial = JSON.stringify(q);
  return out;
})`;
const J = (v) => JSON.parse(JSON.stringify(v));
const run = (h, withText, withFmt) => J(h.R(PROBE)(withText ? h.R("FluyoI18n.t") : undefined, withFmt ? h.R(FMT) : undefined));
const FMT = `({ story: (n) => FluyoI18n.t("seed.story", "Historia {n}", { n }),
  copy: (name) => FluyoI18n.t("seed.storyCopy", "{name} copia", { name }),
  copyN: (name, n) => FluyoI18n.t("seed.storyCopyN", "{name} copia {n}", { name, n }) })`;

/* ───────── O · oráculo del español ───────── */
test("O · sin proveedor, el kernel dice exactamente lo de 86d910a (kernel del MCP); con FluyoI18n.t en español, también", { skip: !hasGit && "sin git" }, () => {
  const base = load({ src: (f) => atBase(f), i18n: false }), now = load({ i18n: false });
  const was = run(base, false, false), is = run(now, false, false);
  assert.equal(was.runOk, true);
  assert.deepEqual(is, was, "sin proveedor ni formateador: la misma salida, campo por campo");
  assert.equal(JSON.stringify(is), JSON.stringify(was));
  const es = load({ lang: "es" });
  assert.deepEqual(run(es, true, true), was, "con FluyoI18n.t y el formateador del editor, en español: idéntico a la base");
  /* la corpus ejercita las ramas: fallos por origen y destino, al revés, «Elemento sin nombre», plurales, todas las ramas de nombres */
  assert.ok(was.captions.some((c) => /^No se completó · Kafka \{count\} no está disponible$/.test(c || "")), "destino caído (el nombre del autor con {count} intacto)");
  assert.ok(was.captions.some((c) => /^No se completó · Client no está disponible$/.test(c || "")), "origen caído");
  assert.ok(was.captions.some((c) => c === "Kafka {count} vuelve a estar disponible"));
  assert.deepEqual(was.summaries, ["", "1 evento no pudo realizarse", "2 eventos no pudieron realizarse", "7 eventos no pudieron realizarse"]);
  assert.equal(was.describe[1].caption, "Reproducción terminada");
  assert.ok(was.sentences.some((s) => s.includes("Elemento sin nombre")), "elemento sin nombre");
  assert.equal(was.errors.length, 15);
  assert.equal(was.errors[0][0], "Un evento apunta a un elemento que ya no existe.");
  assert.equal(was.errorsMixed.length, 2, "se deduplica por texto, la reserva entra una vez");
  assert.equal(was.errorsMixed[0], "No se pudo reproducir. Revisa la historia y consulta los detalles técnicos.");
  assert.deepEqual(was.names, ["Historia 1", "Historia 2", "Historia 3", "Historia 1 copia", "Historia 1 copia 2", "Historia 1 copia 3"]);
  assert.deepEqual(was.long.map((x) => x[0]), [116, 118, 118], "el recorte a 120 con el sufijo español: 110 + « copia», « copia 2», « copia 3»");
});

test("O · el recorte, la unicidad y las copias de la base se conservan en cada rama del kernel (corpus aleatorio)", { skip: !hasGit && "sin git" }, () => {
  const base = load({ src: (f) => atBase(f), i18n: false }), now = load({ i18n: false });
  const CODE = `(function (seed) {
    let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const out = [];
    for (let k = 0; k < 60; k++) {
      const pg = blankPage("p"); const n = Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) { const len = [3, 10, 118, 119, 120][Math.floor(rnd() * 5)]; const nm = rnd() < .4 ? "Historia " + (1 + Math.floor(rnd() * 5)) : "ab".repeat(60).slice(0, len); if (!pg.scenarios.some((x) => x.name === nm)) createScenario(pg, nm); }
      const d = defaultScenarioName(pg); const sc = createScenario(pg, d);
      const names = [d]; for (let j = 0; j < 4; j++) { const c = duplicateScenario(pg, pg.scenarios[Math.floor(rnd() * pg.scenarios.length)].id); names.push(c.name); }
      out.push([names, pg.scenarios.map((x) => x.id), pg.nextScenarioId]);
    }
    return out;
  })`;
  for (const seed of [1, 7, 42]) assert.deepEqual(J(now.R(CODE)(seed)), J(base.R(CODE)(seed)), "semilla " + seed);
});

/* ───────── E · inglés ───────── */
test("E · inglés: el vocabulario aprobado, sin restos en español, y el contenido del autor intacto", () => {
  const en = load({ lang: "en" }), out = run(en, true, true);
  assert.deepEqual(out.errors.map((e) => e[0]), [
    "A step points to an element that no longer exists.", "A step points to a connection that no longer exists.", "A connection in the diagram has a lost endpoint.",
    "There are duplicate elements or connections.", "There are duplicate elements.", "There are duplicate connections.", "This story uses an unsupported playback version.",
    "The story exceeds an operational playback limit.", "A step has a time out of range.", "The page structure is not valid.", "An element's initial state is not valid.",
    "The story has invalid data.", "A step has an invalid availability.", "A step has an unknown action.", "There are duplicate steps in the story."]);
  assert.equal(out.errorsMixed[0], "Couldn't play. Review the story and check the technical details.");
  assert.deepEqual(out.summaries, ["", "1 step couldn't run", "2 steps couldn't run", "7 steps couldn't run"]);
  assert.equal(out.describe[1].caption, "Playback finished");
  assert.equal(out.describe[1].summary, "2 steps couldn't run");
  const caps = new Set(out.captions.filter(Boolean));
  assert.ok(caps.has("Not completed · Kafka {count} is unavailable"), "destino caído (el nombre del autor con {count} intacto)");
  assert.ok(caps.has("Not completed · Client is unavailable"), "origen caído");
  assert.ok(caps.has("Kafka {count} is available again") && caps.has("Kafka {count} is unavailable"));
  assert.ok(out.sentences.some((s) => s.includes("Unnamed element")), "elemento sin nombre");
  assert.equal(out.sentenceGone.includes("?"), true);
  assert.deepEqual(out.startBad.errors, ["This story uses an unsupported playback version."]);
  assert.deepEqual(out.startNoNode.errors, ["A step points to an element that no longer exists."]);
  assert.deepEqual(out.names, ["Story 1", "Story 2", "Story 3", "Story 1 copy", "Story 1 copy 2", "Story 1 copy 3"]);
  assert.deepEqual(out.long.map((x) => x[0]), [116, 118, 118], "el recorte mide el sufijo en inglés: 111 + « copy», « copy 2», « copy 3»");
  /* «Historia 2» no ocupa nada en inglés; «Story 4» (el siguiente candidato) sí */
  assert.equal(out.occupied[0], "Story 5");
  assert.equal(out.occupied[1], "Story 1 copy");
  assert.equal(out.occupied[2], "Hola {n} {name} copy", "el contenido del autor con marcadores no se interpreta");
  /* sin restos en español: el texto de Fluyo (el del autor está en inglés) */
  const all = JSON.stringify([out.captions, out.summaries, out.describe, out.playing, out.clock, out.sentences, out.errors, out.errorsMixed, out.startBad, out.names]);
  assert.doesNotMatch(all.replace(/Playback finished/g, ""), SPANISH);
  assert.deepEqual(J(en.R("FluyoI18n.missing()")).filter((k) => /^en:/.test(k)), [], "el inglés no pierde ninguna clave");
});

test("E · fr, ja y zh no tienen claves de S2b: la reproducción cae al inglés, nunca al español, y queda en missing()", () => {
  const d = scan.dictionaries();
  const KEYS = ["story.finished", "story.failedCount", "story.cap.down", "story.cap.up", "story.cap.failed", "story.err.missingNode", "story.err.fallback", "seed.story", "seed.storyCopy", "seed.storyCopyN"];
  for (const lang of ["fr", "ja", "zh"]) {
    const all = { ...d[lang].common, ...d[lang].editor };
    assert.deepEqual(KEYS.filter((k) => k in all), [], lang);
    if (lang === "ja") continue;   /* en el arnés, «ja» es el idioma de prueba */
    const h = load({ lang }), out = run(h, true, true);
    assert.equal(out.describe[1].caption, "Playback finished", lang);
    assert.deepEqual(out.names.slice(0, 2), ["Story 1", "Story 2"], lang);
    assert.ok(h.R("FluyoI18n.missing()").some((k) => k.startsWith(lang + ":story.")), lang + ": anotado en missing()");
  }
});

/* ───────── P · gramática con un idioma de prueba de escritura CJK ───────── */
test("P · con un idioma de prueba CJK, cada salida del kernel es UNA plantilla entera más parámetros", () => {
  const h = load({ lang: "ja" }), out = run(h, true, true);
  const T = (k, ...ps) => "〔" + k + "〕" + ps.map((p) => "《" + p + "》").join("");
  assert.deepEqual(out.errors.map((e) => e[0]).slice(0, 3), [T("story.err.missingNode"), T("story.err.missingEdge"), T("story.err.missingEdgeEndpoint")]);
  assert.equal(out.errorsMixed[0], T("story.err.fallback"));
  assert.deepEqual(out.summaries, ["", T("story.failedCount", 1), T("story.failedCount", 2), T("story.failedCount", 7)]);
  assert.equal(out.describe[1].caption, T("story.finished"));
  const caps = new Set(out.captions.filter(Boolean));
  assert.ok(caps.has(T("story.cap.failed", "Kafka {count}")), "el nombre del autor, una sola vez, como parámetro");
  assert.ok(caps.has(T("story.cap.down", "Kafka {count}")) && caps.has(T("story.cap.up", "Kafka {count}")));
  assert.ok(caps.has(T("story.cap.failed", "Client")));
  assert.deepEqual(out.names.slice(0, 2), [T("seed.story", 1), T("seed.story", 2)]);
  assert.equal(out.names[3], T("seed.storyCopy", T("seed.story", 1)), "la copia: plantilla entera con el nombre como parámetro");
  assert.equal(out.names[4], T("seed.storyCopyN", 2, T("seed.story", 1)), "n y name, en el orden alfabético del arnés");
  assert.ok(out.sentences.some((s) => s.includes(T("story.unnamed"))), "«Elemento sin nombre» entra en la frase como plantilla entera");
  /* ningún texto base en español ni pegado a otro: cada salida del kernel que dice texto de Fluyo no contiene español */
  assert.doesNotMatch(JSON.stringify([out.errors, out.errorsMixed, out.summaries, out.describe[1].caption]), SPANISH);
  /* el recorte mide el sufijo ya formateado del idioma (aquí, 〔seed.storyCopyN〕《》《999》, más largo que el español) */
  assert.ok(out.long.every((x) => x[0] <= 120), "el nombre de una copia nunca pasa de 120");
});

/* ───────── K · el kernel ───────── */
test("K · el kernel no conoce ningún idioma ni global de la interfaz; el proveedor es un argumento", () => {
  for (const f of ["js/story-playback.js", "js/model.js", "js/story-clock.js"]) {
    const src = read(f);
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /FluyoI18n|FLUYO_LOCALES|navigator|document\.|localStorage/, f + " no usa nada de la interfaz");
  }
  const sp = read("js/story-playback.js");
  assert.match(sp, /function errorMessages\(errors, text\)/);
  assert.match(sp, /function start\(page, scenario, nowReal, text\)/);
  assert.match(sp, /function describe\(phase, scenario, playback, nodeName, edgeEnds, text\)/);
  assert.match(sp, /function sentence\(page, step, et, text\)/);
  assert.match(sp, /function caption\(logEvents, virtualTime, nodeName, edgeEnds, text\)/);
  assert.match(sp, /function summary\(failed, text\)/);
  assert.match(read("js/model.js"), /function defaultScenarioName\(pg,fmt\)/);
  assert.match(read("js/model.js"), /function copyScenarioName\(pg,name,fmt\)/);
  assert.match(read("js/model.js"), /function duplicateScenario\(pg,id,fmt\)/);
  /* el texto que no depende del idioma (una sola regla) sigue en el kernel: el recorte y la unicidad */
  assert.match(read("js/model.js"), /Math\.max\(copy\(""\)\.length,copyN\(""\,999\)\.length\)/);
});

test("K · N3: el error de arranque se forma al arrancar, en el idioma activo; cambiar de idioma no lo retraduce", () => {
  const h = load({ lang: "en" });
  const r = h.R(`(function(){ ${PROBE.slice(PROBE.indexOf("doc = "), PROBE.indexOf("const out"))}
    const bad = JSON.parse(JSON.stringify(sc)); bad.engineVersion = 99;
    const a = FluyoStory.start(pg, bad, 0, FluyoI18n.t).errors[0];
    FluyoI18n.setLocale("es", {persist:false});
    const b = FluyoStory.start(pg, bad, 0, FluyoI18n.t).errors[0];
    return [a, b]; })()`);
  assert.deepEqual(J(r), ["This story uses an unsupported playback version.", "Esta historia usa una versión de ejecución no soportada."]);
  /* start() sigue devolviendo {ok, errors: [texto]}: el contrato no cambia */
  const errs = h.R(`(function(){ ${PROBE.slice(PROBE.indexOf("doc = "), PROBE.indexOf("const out"))}
    const bad = JSON.parse(JSON.stringify(sc)); bad.engineVersion = 99; return FluyoStory.start(pg, bad, 0, FluyoI18n.t); })()`);
  assert.deepEqual(Object.keys(J(errs)).sort(), ["errors", "ok"]);
});

test("K · el cambio de idioma en vivo se refleja en la siguiente lectura del kernel (Present y Viewer repintan por onChange)", () => {
  const h = load({ lang: "en" });
  const r = h.R(`(function(){ ${PROBE.slice(PROBE.indexOf("doc = "), PROBE.indexOf("const out"))}
    const run = FluyoStory.run(pg, sc), pb = { logEvents: run.trace.events, cursorVirtual: 0 };
    const d = () => FluyoStory.describe("finished", sc, pb, () => "x", () => null, FluyoI18n.t).caption;
    const a = d(); FluyoI18n.setLocale("es", {persist:false}); const b = d(); FluyoI18n.setLocale("en", {persist:false}); return [a, b, d()]; })()`);
  assert.deepEqual(J(r), ["Playback finished", "Reproducción terminada", "Playback finished"]);
});

/* ───────── S · estático ───────── */
test("S · quien consume pasa el proveedor y los nombres sembrados; el kernel no pega texto", () => {
  const ed = read("js/editor-scenarios.js"), ps = read("js/present-story.js"), vw = read("js/viewer.js"), sp = read("js/story-playback.js"), model = read("js/model.js");
  assert.match(ed, /FluyoStoryClock\.start\(P\(\), sc, scNow\(\), FluyoI18n\.t\) : FluyoStory\.start\(P\(\), sc, scNow\(\), FluyoI18n\.t\)/, "el editor arranca con el proveedor");
  assert.match(ed, /\.describe\(scStatus === "running" \? "playing" : "finished", sc, scPlayback, \(id\) => scNodeFallback\(id\), \(id\) => edgeById\(id\), FluyoI18n\.t\)/);
  assert.match(ed, /FluyoStory\.sentence\(P\(\), step, et, FluyoI18n\.t\)/);
  assert.equal((ed.match(/defaultScenarioName\(pg, scSeedNames\(\)\)/g) || []).length, 2, "Historia nueva (+ y colocar sin Historia)");
  assert.match(ed, /duplicateScenario\(pg, src\.id, scSeedNames\(\)\)/);
  assert.doesNotMatch(ed, /defaultScenarioName\(pg\)|duplicateScenario\(pg, src\.id\)/, "ninguna llamada al kernel sin el formateador");
  assert.match(ed, /FluyoI18n\.t\("seed\.story", "Historia \{n\}", \{ n \}\)/);
  assert.match(ed, /FluyoI18n\.t\("seed\.storyCopy", "\{name\} copia", \{ name \}\)/);
  assert.match(ed, /FluyoI18n\.t\("seed\.storyCopyN", "\{name\} copia \{n\}", \{ name, n \}\)/);
  assert.equal((ps.match(/FluyoI18n\.t\);/g) || []).length >= 1, true);
  assert.match(ps, /\.describe\(dphase, sc, scPlayback, id=>scNodeFallback\(id\), id=>edgeById\(id\), FluyoI18n\.t\)/);
  assert.match(ps, /FluyoStory\.describe\("finished", sc, \{logEvents:run\.trace\.events, cursorVirtual:0\}, \(\)=>"", \(\)=>null, FluyoI18n\.t\)/, "la sonda mide el cierre en el idioma activo");
  assert.match(vw, /FluyoStoryClock\.start\(P\(\), sc, FluyoStoryClock\.now\(clock, performance\.now\(\)\), FluyoI18n\.t\)/);
  assert.match(vw, /FluyoStoryClock\.describe\(phase, sc, story && story\.playback, storyNodeName, id=>edgeById\(id\), FluyoI18n\.t\)/);
  assert.match(read("js/story-clock.js"), /FluyoStory\.start\(page, scenario, nowReal, text\)/);
  assert.match(read("js/story-clock.js"), /FluyoStory\.describe\(phase, scenario, playback, nodeName, edgeEnds, text\)/);
  /* el kernel no pega texto humano a otro texto */
  for (const bad of [/who\s*\+\s*" /, /"\s*no está disponible"\s*\)?\s*;/, /failed\s*\+\s*" eventos/, /"Historia "\s*\+\s*n\b.*FluyoI18n/, /\+\s*" copia/]) {
    const body = (sp + "\n" + model).replace(/\/\*[\s\S]*?\*\//g, "");
    if (bad.source.includes("copia") || bad.source.includes("Historia")) continue;   /* el español del kernel de model.js SÍ concatena (reserva byte a byte) */
    assert.doesNotMatch(body, bad, String(bad));
  }
  assert.doesNotMatch(sp.replace(/\/\*[\s\S]*?\*\//g, ""), /\+\s*"[^"]*(disponible|terminada|pudo|pudieron)/, "story-playback.js: texto humano solo por el proveedor");
  /* los nombres del autor nunca son clave ni texto base de una llamada del kernel: clave y texto base, siempre literales */
  for (const u of scan.catalog().uses.filter((u) => u.file === "js/story-playback.js")) {
    assert.ok(typeof u.key === "string" && u.es !== null, "clave y texto base literales: " + u.raw);
    assert.doesNotMatch(u.key, /\.(name|label|message)$/, u.raw);
  }
});

test("S · las claves del kernel están en el diccionario común y el inglés de las del editor, en el del editor", () => {
  const d = scan.dictionaries().en;
  const used = scan.catalog().uses.filter((u) => u.file === "js/story-playback.js");
  assert.ok(used.length >= 22, "las 22 claves del kernel (15 errores + reserva + 3 consecuencias + cierre + plural + sin nombre)");
  for (const u of used) assert.ok(u.key in d.common, "común: " + u.key);
  assert.ok(!("story.finished" in d.editor), "story.finished se movió al común (lo lee el Viewer)");
  for (const k of ["seed.story", "seed.storyCopy", "seed.storyCopyN"]) assert.ok(k in d.editor, "editor: " + k);
  assert.deepEqual(Object.keys(d.common).filter((k) => /^seed\./.test(k)), []);
  /* un solo texto base por clave entre el kernel y quien más lo usa */
  assert.equal(scan.catalog().uses.filter((u) => u.key === "story.finished").map((u) => u.es).filter((v, i, a) => a.indexOf(v) === i).length, 1);
  assert.equal(scan.catalog().uses.filter((u) => u.key === "story.unnamed").map((u) => JSON.stringify(u.es)).filter((v, i, a) => a.indexOf(v) === i).length, 1);
});

test("S · trinquete: story-playback.js queda con un solo texto sin migrar (NARRATED_NOTE, salida del MCP); model.js no sube", () => {
  const b = JSON.parse(read(scan.BASELINE)).js;
  assert.equal(b["js/story-playback.js"], 1);
  assert.ok(scan.hardcoded().js["js/story-playback.js"] === 1);
  assert.match(read("js/story-playback.js"), /const NARRATED_NOTE = "El motor registra la ocurrencia; no comprueba disponibilidad ni efecto\.";/);
  assert.ok((scan.hardcoded().js["js/model.js"] || 0) <= b["js/model.js"]);
});

/* ───────── M · el MCP ───────── */
test("M · lo que llama el MCP no cambia: sentence, outcomes, finalAvailability y run dicen lo de 86d910a; NARRATED_NOTE intacta", { skip: !hasGit && "sin git" }, () => {
  const base = load({ src: (f) => atBase(f), i18n: false }), now = load({ i18n: false });
  const CODE = `(function(){ ${PROBE.slice(PROBE.indexOf("doc = "), PROBE.indexOf("const out"))}
    const run = FluyoStory.run(pg, sc);
    return { outcomes: FluyoStory.outcomes(run.trace, sc, pg), fin: FluyoStory.finalAvailability(run.trace, pg), note: FluyoStory.NARRATED_NOTE,
      sentences: sc.steps.map((s) => FluyoStory.sentence(pg, s, doc.eventTypes.find((e) => e.id === s.eventTypeId))), trace: run.trace, ser: serializeProject() }; })()`;
  assert.equal(JSON.stringify(now.R(CODE)), JSON.stringify(base.R(CODE)));
});

test("M · el kernel del MCP (si está al lado) es este kernel: sha256 de cada archivo y KERNEL_ID", (t) => {
  const gen = path.join(root, "..", "fluyo-mcp", "src", "generated", "kernel-sources.ts");
  if (!fs.existsSync(gen)) return t.skip("sin fluyo-mcp hermano");
  const ts = fs.readFileSync(gen, "utf8");
  const files = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
  const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
  const own = files.map((f) => [f, sha(read("js/" + f))]);
  for (const [f, h] of own) assert.ok(ts.includes(`name: "${f}",\n    sha256: "${h}"`), f + ": el MCP lleva este archivo");
  const id = sha(own.map(([f, h]) => `${f}:${h}`).join("\n"));
  assert.ok(ts.includes(`export const KERNEL_ID = "${id}";`), "KERNEL_ID del MCP = el de este kernel");
});

/* ───────── A · alcance ───────── */
test("A · alcance frente a 86d910a: solo estos archivos; undoS2b da la base EXACTA y va encima de undoS4; kernel intacto salvo model.js y story-playback.js; CACHE v113", { skip: !hasGit && "sin git" }, () => {
  const { undoS2b, PIECES, NEW_FILES } = require("./fluyo-i18n-002-s2b-undo.cjs");
  const { undoS3a, PIECES: PIECES_S3A } = require("./fluyo-i18n-002-s3a-undo.cjs");   /* FLUYO-I18N-002 S3a va encima (undoS2b la deshace antes) */
  const { PIECES: PIECES_S3B } = require("./fluyo-i18n-002-s3b-undo.cjs");   /* y S3b encima de S3a (undoS3a la deshace antes) */
  const { undoEx, PIECES: PIECES_EX, NEW_FILES: NEW_EX } = require("./fluyo-examples-001-undo.cjs");   /* FLUYO-EXAMPLES-001 va encima de S3b (undoS3b la deshace antes) */
  const { PIECES: PIECES_S1A } = require("./fluyo-stories-2-0-s1a-undo.cjs");   /* FLUYO-STORIES-2.0 S1a va encima de EXAMPLES (undoEx la deshace antes) */
  const { PIECES: PIECES_S1B } = require("./fluyo-stories-2-0-s1b-undo.cjs");   /* FLUYO-STORIES-2.0 S1b va encima de S1a (undoS1a la deshace antes) */
  const { PIECES: PIECES_ST2A } = require("./fluyo-stories-2-0-s2a-undo.cjs");   /* FLUYO-STORIES-2.0 S2a va encima de S1b (undoS1b la deshace antes) */
  const { PIECES: PIECES_ST2B } = require("./fluyo-stories-2-0-s2b-undo.cjs");   /* FLUYO-STORIES-2.0 S2b va encima de S2a (undoS2a la deshace antes) */
  assert.deepEqual(NEW_FILES, []);
  const FILES = ["js/editor-scenarios.js", "js/i18n-en-editor.js", "js/i18n-en.js", "js/model.js", "js/present-story.js", "js/story-clock.js", "js/story-playback.js", "js/viewer.js"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  /* lo que solo cambia S3a o S3b (sin ellas, igual que la base) no cuenta para el alcance de S2b */
  const s3aOnly = (f) => NEW_EX.includes(f) || ((!!PIECES_S3A[f] || !!PIECES_S3B[f] || !!PIECES_EX[f] || !!PIECES_S1A[f] || !!PIECES_S1B[f] || !!PIECES_ST2A[f] || !!PIECES_ST2B[f]) && !FILES.includes(f) && undoS3a(f, read(f)) === atBase(f));
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !s3aOnly(f));
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !s3aOnly(f));
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, "sw.js"].sort());
  for (const f of FILES) assert.equal(undoS2b(f, read(f)), atBase(f), f + ": undoS2b exacto");
  assert.equal(undoEx("sw.js", read("sw.js")).replace('"fluyo-static-v120"', '"fluyo-static-v' + (113 - 1) + '"'), atBase("sw.js"), "sw.js: solo CACHE (sin archivos nuevos)");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v120";/);
  assert.ok(read("test/fluyo-i18n-002-s4-undo.cjs").includes("src = undoS2b(file, src);"), "undoS4 deshace antes esta tarea");
  /* el resto del kernel, sin tocar (safe-svg, config, motor, integridad y autoría: no cambia su sha) */
  for (const f of ["js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/document-integrity.js", "js/story-authoring.js", "js/geometry.js", "js/render.js", "js/export.js",
    "js/state.js", "js/ui.js", "js/selection.js", "js/flow-semantics.js", "js/i18n.js", "js/skin.js", "index.html", "s/index.html", "404.html", "css/system.css", "css/styles.css", "css/share.css"])
    assert.equal(undoS3a(f, read(f)), atBase(f), f + " sin cambios (S3a, encima, se deshace antes)");
  /* el documento no cambia: sin claves nuevas en el formato */
  assert.doesNotMatch(read("js/model.js").replace(/\/\*[\s\S]*?\*\//g, ""), /version:\s*[6-9]/);
});
