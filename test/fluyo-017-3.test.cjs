"use strict";
/* FLUYO-017.3 — Autoría de EventTypes por author_document: las MISMAS reglas que el editor.
   Dominio extraído a model.js (…In), operaciones del kernel (FluyoAuthoring), integridad (FluyoIntegrity),
   atomicidad, revisión determinista, compatibilidad con documentos antiguos y PARIDAD con el modal real del editor
   (deepStrictEqual sin normalizar). Las mismas operaciones se verifican en fluyo-mcp (test/fluyo-017-3.test.ts). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { makeScenarioUIContext, setupPanel, ensureUI, freshPage } = require("./fluyo-016-harness.cjs");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
const J = (v) => JSON.parse(JSON.stringify(v));
const simple = () => JSON.parse(read("test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json"));
const complex = () => JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));
const GOLDEN = "test/fixtures/fluyo-017-3-golden.json";

function kernel() {
  const ctx = vm.createContext({});
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, ctx)); };
  return ctx;
}
const K = kernel();
const apply = (project, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p: project, o: ops });
const validate = (project) => K.call("FluyoIntegrity.validateProject(__a)", project);
const E = (op, extra) => ({ op, scope: "eventType", ...extra });
const S = (op, extra) => ({ op, scope: "story", pageIndex: 0, ...extra });
const P = (op, extra) => ({ op, scope: "page", pageIndex: 0, ...extra });
const pg = (d, i = 0) => d.doc.pages[i];
const story = (d, id, pi = 0) => pg(d, pi).scenarios.find((s) => s.id === id);
const types = (d) => d.doc.eventTypes;
const etOf = (d, id) => types(d).find((e) => e.id === id);
const codes = (r) => r.errors.map((e) => e.code);
const first = (r) => r.errors[0];
const PAGO = E("create_event_type", { name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", symbol: "💵" });

/* ═══════════════ 1. Dominio extraído a model.js (la misma función que ejecuta el editor) ═══════════════ */

const def = (extra = {}) => ({ name: "X", primitive: "FLOW", sentenceTemplate: "{source} x {target}", visual: { value: "●" }, ...extra });
const blank = () => ({ eventTypes: [], nextEventTypeId: 1, pages: [{ name: "P", nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 }], cur: 0 });
const inDoc = (expr, d, extra) => K.call(`(function(){ const d = __a.d, x = __a.x; ${expr} })()`, { d, x: extra });

test("createEventTypeIn / updateEventTypeIn / deleteEventTypeIn operan sobre un documento explícito y NO tocan la global `doc`", () => {
  const out = K.call(`(function(){
    const mine = {eventTypes:[], nextEventTypeId:1, pages:[{scenarios:[]}], cur:0};
    const before = JSON.stringify(doc);
    const et = createEventTypeIn(mine, ${JSON.stringify(def({ name: "A" }))});
    updateEventTypeIn(mine, et.id, {name:"B"});
    const second = createEventTypeIn(mine, ${JSON.stringify(def({ name: "C" }))});
    deleteEventTypeIn(mine, second.id);
    return {names: mine.eventTypes.map(e=>e.name), next: mine.nextEventTypeId, globalUntouched: JSON.stringify(doc) === before, globalTypes: doc.eventTypes.length};
  })()`);
  assert.deepEqual(out, { names: ["B"], next: 3, globalUntouched: true, globalTypes: 0 });
});

test("las funciones globales del editor delegan en las mismas (misma salida que …In sobre `doc`)", () => {
  const out = K.call(`(function(){
    doc = {theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    const a = createEventType(${JSON.stringify(def({ name: "A" }))});
    const copy = JSON.parse(JSON.stringify(doc)); copy.eventTypes = []; copy.nextEventTypeId = 1;
    const b = createEventTypeIn(copy, ${JSON.stringify(def({ name: "A" }))});
    return {same: JSON.stringify(a) === JSON.stringify(b), byId: eventTypeById(a.id) === a, used: eventTypeUseCount(a.id)};
  })()`);
  assert.deepEqual(out, { same: true, byId: true, used: 0 });
});

test("el contador de ids sólo avanza si el EventType es válido; los ids nunca se reutilizan", () => {
  const r = inDoc(`
    try { createEventTypeIn(d, ${JSON.stringify(def({ name: "" }))}); } catch (e) { var err = e.code + ":" + e.field; }
    try { createEventTypeIn(d, ${JSON.stringify(def({ sentenceTemplate: "{x}" }))}); } catch (e) { var err2 = e.code + ":" + e.field; }
    const a = createEventTypeIn(d, ${JSON.stringify(def({ name: "A" }))});
    deleteEventTypeIn(d, a.id);
    const b = createEventTypeIn(d, ${JSON.stringify(def({ name: "B" }))});
    return {err, err2, a: a.id, b: b.id, next: d.nextEventTypeId};`, blank());
  assert.deepEqual(r, { err: "invalid_document:name", err2: "invalid_document:sentenceTemplate", a: 1, b: 2, next: 3 });
});

test("updateEventTypeIn es todo o nada: un campo inválido no deja el EventType a medias", () => {
  const r = inDoc(`
    const et = createEventTypeIn(d, ${JSON.stringify(def({ name: "Original" }))});
    const before = JSON.stringify(et);
    let code; try { updateEventTypeIn(d, et.id, {name:"Cambiado", sentenceTemplate:"{nada}"}); } catch (e) { code = e.code + ":" + e.field; }
    return {code, intact: JSON.stringify(d.eventTypes[0]) === before};`, blank());
  assert.deepEqual(r, { code: "invalid_document:sentenceTemplate", intact: true });
});

test("updateEventTypeIn conserva la identidad del objeto y el orden de las claves", () => {
  const r = inDoc(`
    const et = createEventTypeIn(d, ${JSON.stringify(def({ name: "A" }))});
    const keys = Object.keys(et).join(), ref = et;
    const out = updateEventTypeIn(d, et.id, {name:"B", visual:{value:"★"}});
    return {same: out === ref && d.eventTypes[0] === ref, keys, after: Object.keys(et).join(), name: et.name, v: et.visual.value};`, blank());
  assert.equal(r.same, true);
  assert.equal(r.keys, r.after);
  assert.deepEqual([r.name, r.v], ["B", "★"]);
});

test("usado: la primitiva y la disponibilidad no cambian (dec. 17); la misma disponibilidad NO cuenta como cambio", () => {
  const d = simple();
  const r = (id, changes) => K.call(`(function(){ doc = projectFromProjectData(__a.p).doc; try { updateEventType(__a.id, __a.c); return {ok:true, et: eventTypeById(__a.id)}; } catch (e) { return {code:e.code, field:e.field}; } })()`, { p: d, id, c: changes });
  assert.deepEqual(r(1, { primitive: "OCCURRENCE" }), { code: "event_type_primitive_immutable_when_used", field: "primitive" });
  assert.deepEqual(r(4, { availability: "UP" }), { code: "event_type_availability_immutable_when_used", field: "availability" });
  assert.equal(r(4, { availability: "DOWN", name: "Caída editada" }).ok, true, "reenviar la misma disponibilidad (como hace el modal) es válido");
  assert.equal(r(1, { primitive: "FLOW", name: "Pago editado" }).ok, true);
});

test("sin uso la primitiva sí cambia y la definición queda coherente (availability sólo en SET_AVAILABILITY)", () => {
  const r = inDoc(`
    const et = createEventTypeIn(d, ${JSON.stringify(def({ name: "A" }))});
    updateEventTypeIn(d, et.id, ${JSON.stringify({ primitive: "SET_AVAILABILITY", availability: "DOWN" })});
    const sa = JSON.parse(JSON.stringify(et));
    updateEventTypeIn(d, et.id, {primitive:"OCCURRENCE"});
    let missing; try { updateEventTypeIn(d, et.id, {primitive:"SET_AVAILABILITY"}); } catch (e) { missing = e.field; }
    return {sa: [sa.primitive, sa.availability], occ: [et.primitive, "availability" in et], missing};`, blank());
  assert.deepEqual(r, { sa: ["SET_AVAILABILITY", "DOWN"], occ: ["OCCURRENCE", false], missing: "availability" });
});

test("eventTypeDefinition: la forma por primitiva es del dominio (movimiento y efectos de conexión sólo en conexiones)", () => {
  const d = (input) => K.call("eventTypeDefinition(__a)", input);
  const base = { name: "N", sentenceTemplate: "{target}", symbol: "x" };
  const fx = { size: "large" }, nx = { showSymbol: true };
  assert.deepEqual(d({ ...base, primitive: "FLOW", motion: "slow", connectionEffects: fx, nodeEffects: nx, availability: "UP" }),
    { name: "N", primitive: "FLOW", sentenceTemplate: "{target}", visual: { value: "x" }, motion: "slow", presentation: { connectionEffects: fx } });
  assert.deepEqual(d({ ...base, primitive: "OCCURRENCE", motion: "slow", connectionEffects: fx, nodeEffects: nx, availability: "UP" }),
    { name: "N", primitive: "OCCURRENCE", sentenceTemplate: "{target}", visual: { value: "x" }, motion: "normal", presentation: { nodeEffects: nx } });
  assert.deepEqual(d({ ...base, primitive: "SET_AVAILABILITY", nodeEffects: nx, availability: "DOWN" }),
    { name: "N", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target}", visual: { value: "x" }, motion: "normal", presentation: { nodeEffects: nx }, availability: "DOWN" });
  assert.equal(K.call("eventTypePrimitiveFor('connection','up')"), "FLOW");
  assert.equal(K.call("eventTypePrimitiveFor('element','none')"), "OCCURRENCE");
  assert.equal(K.call("eventTypePrimitiveFor('element','down')"), "SET_AVAILABILITY");
});

test("eventTypeUsagesIn y eventTypePresentationDiff", () => {
  const d = simple();
  assert.deepEqual(K.call("eventTypeUsagesIn(__a, 1)", d.doc), [{ pageIndex: 0, storyId: 1, storyName: "Historia A", stepIds: [1] }, { pageIndex: 0, storyId: 2, storyName: "Historia B", stepIds: [2] }]);
  assert.deepEqual(K.call("eventTypeUsagesIn(__a, 99)", d.doc), []);
  assert.deepEqual(K.call("eventTypePresentationDiff({primitive:'FLOW'})"), {});
  assert.deepEqual(K.call("eventTypePresentationDiff({primitive:'FLOW', presentation:{connectionEffects:{style:'impulse', size:'medium'}}})"), { style: "impulse" });
  assert.deepEqual(K.call("eventTypePresentationDiff({primitive:'OCCURRENCE', presentation:{nodeEffects:{showSymbol:true, visualDuration:'long', message:'hola'}}})"), { showSymbol: true, message: "hola", visualDuration: "long" });
  assert.deepEqual(K.call("eventTypePresentationDiff({primitive:'OCCURRENCE', presentation:{nodeEffects:{visualDuration:'custom', visualDurationMs:2500}}})"), { visualDuration: "custom", visualDurationMs: 2500 });
});

/* ═══════════════ 2. create_event_type ═══════════════ */

test("crear un EventType de conexión: «Pago · Cliente paga a Comercio»; la acción NO se escribe, se deriva de la primitiva", () => {
  const r = apply(simple(), [PAGO]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const et = etOf(r.project, 5);
  assert.deepEqual([et.name, et.primitive, et.sentenceTemplate, et.visual, et.motion], ["Pago", "FLOW", "{source} paga a {target}", { kind: "token", value: "💵" }, "normal"]);
  assert.equal("action" in et, false);
  assert.equal(r.project.doc.nextEventTypeId, 6);
  assert.deepEqual(r.changes.map((c) => [c.operation, c.scope, c.entityKind, c.entityId, c.created]), [["create_event_type", "eventType", "eventType", 5, true]]);
  assert.equal("pageIndex" in r.changes[0], false, "un EventType no pertenece a una página");
  assert.deepEqual(r.changes[0].eventType, { id: 5, name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", symbol: "💵", motion: "normal" });
  assert.equal(validate(r.project).valid, true);
});

test("create: símbolo por defecto «●» (como el modal), presentación con los defectos de la rama que corresponde", () => {
  const et = etOf(apply(simple(), [E("create_event_type", { name: "Tick", primitive: "OCCURRENCE", sentence: "{target} late" })]).project, 5);
  assert.equal(et.visual.value, "●");
  assert.deepEqual(Object.keys(et.presentation), ["nodeEffects"]);
  assert.equal(et.motion, "normal");
});

test("create: tres primitivas — SET_AVAILABILITY exige availability y la deriva el EventType", () => {
  const r = apply(simple(), [
    E("create_event_type", { name: "Recuperación", primitive: "SET_AVAILABILITY", availability: "UP", sentence: "{target} se recupera", ref: "up" }),
    S("add_step", { storyId: 3, eventTypeId: { ref: "up" }, target: { nodeId: 2 } }),
  ]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(story(r.project, 3).steps.at(-1), { id: 3, at: 2000, action: "SET_STATE", nodeId: 2, state: "UP", eventTypeId: 5 });
  for (const bad of [{ primitive: "SET_AVAILABILITY" }, { primitive: "SET_AVAILABILITY", availability: "MAYBE" }, { primitive: "FLOW", availability: "UP" }, { primitive: "OCCURRENCE", availability: "DOWN" }]) {
    const x = apply(simple(), [E("create_event_type", { name: "X", sentence: "{target}", ...bad })]);
    assert.deepEqual([x.ok, first(x).code, first(x).field], [false, "INVALID_EVENT_TYPE", "availability"], JSON.stringify(bad));
  }
});

test("create: campos obligatorios y reglas del dominio con el campo culpable (name, sentence, symbol, primitive, motion)", () => {
  const ok = { name: "X", primitive: "FLOW", sentence: "{source} a {target}" };
  const cases = [
    [{ name: undefined }, "name"], [{ sentence: undefined }, "sentence"], [{ primitive: undefined }, "primitive"],
    [{ name: "" }, "name"], [{ name: "   " }, "name"], [{ name: "x".repeat(61) }, "name"], [{ name: 5 }, "name"],
    [{ sentence: "" }, "sentence"], [{ sentence: "x".repeat(201) }, "sentence"], [{ sentence: "{origen} envía" }, "sentence"], [{ sentence: "{source" }, "sentence"],
    [{ symbol: "123456789" }, "symbol"], [{ symbol: 7 }, "symbol"],
    [{ primitive: "SEND" }, "primitive"], [{ primitive: "flow" }, "primitive"],
    [{ motion: "turbo" }, "motion"], [{ primitive: "OCCURRENCE", motion: "slow" }, "motion"],
  ];
  for (const [patch, field] of cases) {
    const r = apply(simple(), [E("create_event_type", { ...ok, ...patch })]);
    assert.deepEqual([r.ok, first(r).code, first(r).field], [false, "INVALID_EVENT_TYPE", field], JSON.stringify(patch));
    assert.equal(r.project, undefined);
  }
  assert.equal(apply(simple(), [E("create_event_type", { ...ok, name: "x".repeat(60), sentence: "x".repeat(200), symbol: "12345678" })]).ok, true);
  assert.equal(apply(simple(), [E("create_event_type", { ...ok, motion: "fast" })]).ok, true);
});

test("create: la frase admite exactamente {source}, {target} y {name}", () => {
  const r = apply(simple(), [E("create_event_type", { name: "N", primitive: "FLOW", sentence: "{source}{name}{target}" })]);
  assert.equal(r.ok, true);
});

test("create: presentación como parche sobre los defectos de la rama; la otra rama no aplica", () => {
  const flow = apply(simple(), [E("create_event_type", { name: "F", primitive: "FLOW", sentence: "{source} a {target}", presentation: { connectionEffects: { style: "smooth", trail: "marked", size: "large" } } })]);
  assert.deepEqual(etOf(flow.project, 5).presentation.connectionEffects, { size: "large", style: "smooth", trail: "marked", arrival: "none", during: "none" });
  const node = apply(simple(), [E("create_event_type", { name: "O", primitive: "OCCURRENCE", sentence: "{target}", presentation: { nodeEffects: { showSymbol: true, message: "Hola", messageColor: "#d0576a", visualDuration: "custom", visualDurationMs: 2500, fillColor: "#3aa7e8" } } })]);
  const fx = etOf(node.project, 5).presentation.nodeEffects;
  assert.deepEqual([fx.showSymbol, fx.message, fx.messageColor, fx.visualDuration, fx.visualDurationMs, fx.fillColor, fx.blink], [true, "Hola", "#d0576a", "custom", 2500, "#3aa7e8", false]);
  const wrong = (primitive, presentation) => apply(simple(), [E("create_event_type", { name: "X", primitive, sentence: "{target}", presentation })]);
  assert.equal(first(wrong("FLOW", { nodeEffects: { dim: true } })).field, "presentation.nodeEffects");
  assert.equal(first(wrong("OCCURRENCE", { connectionEffects: { style: "smooth" } })).field, "presentation.connectionEffects");
});

test("create: la presentación inválida se rechaza (no se «corrige» en silencio): listas cerradas, colores, longitudes, milisegundos", () => {
  const bad = [
    ["connectionEffects", { style: "zigzag" }, "style"], ["connectionEffects", { size: "huge" }, "size"], ["connectionEffects", { trail: 1 }, "trail"],
    ["connectionEffects", { colour: "red" }, "colour"], ["connectionEffects", { during: "halo", arrival: "boom" }, "arrival"],
  ];
  for (const [branch, patch, key] of bad) {
    const r = apply(simple(), [E("create_event_type", { name: "X", primitive: "FLOW", sentence: "{source}", presentation: { [branch]: patch } })]);
    assert.deepEqual([r.ok, first(r).code, first(r).field], [false, "INVALID_EVENT_TYPE", `presentation.${branch}.${key}`], JSON.stringify(patch));
  }
  const nodeBad = [
    [{ messageColor: "red" }, "messageColor"], [{ fillColor: "#12" }, "fillColor"], [{ message: "x".repeat(121) }, "message"], [{ showSymbol: "yes" }, "showSymbol"],
    [{ symbolSize: "xl" }, "symbolSize"], [{ messageWeight: "heavy" }, "messageWeight"], [{ messagePosition: "left" }, "messagePosition"], [{ messageFont: "comic" }, "messageFont"],
    [{ visualDuration: "forever" }, "visualDuration"], [{ visualDuration: "custom", visualDurationMs: 100 }, "visualDurationMs"], [{ visualDuration: "custom", visualDurationMs: 99999 }, "visualDurationMs"],
    [{ visualDuration: "custom" }, "visualDurationMs"], [{ visualDurationMs: 2000 }, "visualDurationMs"], [{ visualDuration: "brief", visualDurationMs: 2000 }, "visualDurationMs"],
    [{ showIcon: true }, "showIcon"], [{ icon: "x" }, "icon"],
  ];
  for (const [patch, key] of nodeBad) {
    const r = apply(simple(), [E("create_event_type", { name: "X", primitive: "OCCURRENCE", sentence: "{target}", presentation: { nodeEffects: patch } })]);
    assert.deepEqual([r.ok, first(r).code, first(r).field], [false, "INVALID_EVENT_TYPE", `presentation.nodeEffects.${key}`], JSON.stringify(patch));
  }
  for (const presentation of ["x", 5, [], { other: {} }, { connectionEffects: "x" }]) {
    const r = apply(simple(), [E("create_event_type", { name: "X", primitive: "FLOW", sentence: "{source}", presentation })]);
    assert.equal(first(r).code, "INVALID_EVENT_TYPE", JSON.stringify(presentation));
  }
});

test("create: nombre duplicado NO es un error (como en el editor), pero se avisa; ids distintos, no se mezclan", () => {
  const r = apply(simple(), [E("create_event_type", { name: "pago", primitive: "FLOW", sentence: "{source} paga" }), E("create_event_type", { name: "Pago rechazado", primitive: "FLOW", sentence: "{source} falla" })]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.changes[0].warnings.map((w) => [w.code, w.eventTypeIds]), [["DUPLICATE_EVENT_TYPE_NAME", [1]]]);
  assert.deepEqual(r.changes[1].warnings, []);
  assert.deepEqual(types(r.project).slice(4).map((e) => [e.id, e.name]), [[5, "pago"], [6, "Pago rechazado"]]);
  assert.equal(validate(r.project).valid, true);
});

test("create: ids deterministas e irreutilizables (borrar y volver a crear no reasigna)", () => {
  const r = apply(simple(), [
    E("create_event_type", { name: "A", primitive: "FLOW", sentence: "{source}", ref: "a" }), E("delete_event_type", { eventTypeId: { ref: "a" } }),
    E("create_event_type", { name: "B", primitive: "FLOW", sentence: "{source}" }),
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(types(r.project).slice(4).map((e) => e.id), [6]);
  assert.equal(r.project.doc.nextEventTypeId, 7);
});

/* ═══════════════ 3. update_event_type ═══════════════ */

test("update de nombre, frase, símbolo y presentación de un evento USADO: conserva Historias, Steps, orden, tiempos, targets y Trace", () => {
  const base = simple();
  const run = (project, id) => K.call(`(function(){ const d = projectFromProjectData(__a.p).doc; doc = d; const page = d.pages[0], sc = page.scenarios.find(s => s.id === __a.id); const r = FluyoStory.run(page, sc); return {trace: r.trace, outcomes: FluyoStory.outcomes(r.trace, sc, page), fa: FluyoStory.finalAvailability(r.trace, page)}; })()`, { p: project, id });
  const r = apply(base, [E("update_event_type", { eventTypeId: 1, name: "Pago aprobado", sentence: "{source} abona a {target}", symbol: "✔", motion: "slow", presentation: { connectionEffects: { style: "impulse", arrival: "glow" } } })]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.changes[0].fields, ["name", "sentence", "symbol", "motion", "presentation"]);
  assert.deepEqual(pg(r.project).scenarios, pg(base).scenarios, "Historias y Steps idénticos (ids, tiempos, orden, targets, eventTypeId)");
  for (const id of [1, 2, 3]) {
    const a = run(base, id), b = run(r.project, id);
    assert.deepStrictEqual(b.trace, a.trace, `Trace de la Historia ${id}`);
    assert.deepStrictEqual(b.outcomes, a.outcomes);
    assert.deepStrictEqual(b.fa, a.fa);
  }
  const et = etOf(r.project, 1);
  assert.deepEqual([et.name, et.sentenceTemplate, et.visual.value, et.motion, et.presentation.connectionEffects.style, et.presentation.connectionEffects.arrival], ["Pago aprobado", "{source} abona a {target}", "✔", "slow", "impulse", "glow"]);
  assert.deepEqual(types(r.project).filter((e) => e.id !== 1), types(base).filter((e) => e.id !== 1), "los demás EventTypes no cambian");
});

test("update de un evento usado en varias Historias: el cambio es único, global y coherente; `affects` enumera todos sus usos", () => {
  const r = apply(simple(), [E("update_event_type", { eventTypeId: 1, name: "Pago nuevo", sentence: "{source} liquida a {target}" })]);
  assert.deepEqual(r.changes[0].affects.stories.map((s) => [s.storyId, s.stepIds]), [[1, [1]], [2, [2]]]);
  assert.equal(r.changes[0].affects.eventTypeUsedBy, 2);
  assert.deepEqual(r.changes[0].from.name, "Pago");
  const sentences = (project) => K.call("(function(){ doc = projectFromProjectData(__a).doc; return doc.pages[0].scenarios.flatMap(sc => sc.steps.filter(s => s.eventTypeId === 1).map(s => FluyoStory.sentence(doc.pages[0], s, eventTypeById(s.eventTypeId)))); })()", project);
  const was = sentences(simple()), now = sentences(r.project);
  assert.equal(now.length, 2);
  assert.ok(was.every((x) => !/liquida/.test(x)) && now.every((x) => /liquida/.test(x)), "los dos usos cambian de frase a la vez");
  assert.equal(new Set(now).size, 1, "y coherentemente (misma frase)");
});

test("update: la presentación es un PARCHE sobre la actual (no reinicia el resto)", () => {
  const a = apply(simple(), [E("update_event_type", { eventTypeId: 1, presentation: { connectionEffects: { style: "smooth", trail: "marked" } } })]);
  const b = apply(a.project, [E("update_event_type", { eventTypeId: 1, presentation: { connectionEffects: { style: "impulse" } } })]);
  assert.deepEqual(etOf(b.project, 1).presentation.connectionEffects, { size: "medium", style: "impulse", trail: "marked", arrival: "none", during: "none" });
  const c = apply(b.project, [E("update_event_type", { eventTypeId: 1, presentation: { connectionEffects: { style: "impulse" } } })]);
  assert.deepEqual(c.changes[0].fields, [], "el mismo valor no es un cambio");
  assert.deepEqual(c.project, b.project);
});

test("update de un evento de elemento: parche de nodeEffects, cambio de duración visual y de preset a custom", () => {
  const r = apply(simple(), [E("update_event_type", { eventTypeId: 2, presentation: { nodeEffects: { showSymbol: true, highlight: true, visualDuration: "long" } } }),
    E("update_event_type", { eventTypeId: 2, presentation: { nodeEffects: { visualDuration: "custom", visualDurationMs: 4200 } } })]);
  const fx = etOf(r.project, 2).presentation.nodeEffects;
  assert.deepEqual([fx.showSymbol, fx.highlight, fx.visualDuration, fx.visualDurationMs], [true, true, "custom", 4200]);
  const back = apply(r.project, [E("update_event_type", { eventTypeId: 2, presentation: { nodeEffects: { visualDuration: "brief" } } })]);
  assert.equal(etOf(back.project, 2).presentation.nodeEffects.visualDurationMs, 700);
});

test("update de un evento usado: primitiva y disponibilidad quedan BLOQUEADAS; el rechazo identifica entidad, Historias y Steps (vía FluyoIntegrity)", () => {
  const prim = apply(simple(), [E("update_event_type", { eventTypeId: 1, primitive: "OCCURRENCE" })]);
  assert.equal(prim.ok, false);
  assert.equal(prim.project, undefined);
  const e = first(prim);
  assert.deepEqual([e.code, e.field, e.entity, e.integrityCodes, e.operationIndex], ["EVENT_TYPE_LOCKED", "primitive", { kind: "eventType", id: 1, name: "Pago" }, ["event_type_action_mismatch"], 0]);
  assert.deepEqual(e.affectedStories.map((s) => [s.storyId, s.storyName, s.stepIds]), [[1, "Historia A", [1]], [2, "Historia B", [2]]]);
  assert.deepEqual(e.affectedSteps, [{ pageIndex: 0, storyId: 1, stepId: 1 }, { pageIndex: 0, storyId: 2, stepId: 2 }]);
  const av = apply(simple(), [E("update_event_type", { eventTypeId: 4, availability: "UP" })]);
  assert.deepEqual([first(av).code, first(av).field, first(av).integrityCodes], ["EVENT_TYPE_LOCKED", "availability", ["event_type_action_mismatch"]]);
  assert.deepEqual(first(av).affectedStories.map((s) => s.storyId), [2, 3]);
  // Reenviar la misma disponibilidad o primitiva no es un cambio.
  assert.equal(apply(simple(), [E("update_event_type", { eventTypeId: 4, availability: "DOWN", name: "Caída" })]).ok, true);
  assert.equal(apply(simple(), [E("update_event_type", { eventTypeId: 1, primitive: "FLOW", name: "Pago" })]).ok, true);
});

test("update de un evento SIN uso: primitiva y disponibilidad cambian (se reconstruye la definición como el modal)", () => {
  const r = apply(simple(), [
    E("create_event_type", { name: "Nuevo", primitive: "FLOW", sentence: "{source} a {target}", motion: "slow", presentation: { connectionEffects: { style: "smooth" } }, ref: "n" }),
    E("update_event_type", { eventTypeId: { ref: "n" }, primitive: "SET_AVAILABILITY", availability: "DOWN", sentence: "{target} cae" }),
  ]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const et = etOf(r.project, 5);
  assert.deepEqual([et.primitive, et.availability, et.motion, et.sentenceTemplate, Object.keys(et.presentation)], ["SET_AVAILABILITY", "DOWN", "normal", "{target} cae", ["nodeEffects"]]);
  assert.deepEqual(r.changes[1].fields, ["primitive", "sentence", "motion", "availability", "presentation"]);
  const toFlow = apply(r.project, [E("update_event_type", { eventTypeId: 5, primitive: "FLOW" })]);
  assert.equal("availability" in etOf(toFlow.project, 5), false);
  const noAv = apply(simple(), [E("create_event_type", { name: "N", primitive: "FLOW", sentence: "{source}", ref: "n" }), E("update_event_type", { eventTypeId: { ref: "n" }, primitive: "SET_AVAILABILITY" })]);
  assert.deepEqual([first(noAv).code, first(noAv).field], ["INVALID_EVENT_TYPE", "availability"]);
});

test("update: errores estructurados (inexistente, sin campos, campo inválido, id no entero, ref desconocida, campos no permitidos)", () => {
  const bad = (op) => apply(simple(), [op]);
  assert.equal(first(bad(E("update_event_type", { eventTypeId: 99, name: "x" }))).code, "EVENT_TYPE_NOT_FOUND");
  assert.equal(first(bad(E("update_event_type", { eventTypeId: 1 }))).code, "INVALID_OPERATION");
  assert.equal(first(bad(E("update_event_type", { eventTypeId: "1", name: "x" }))).code, "INVALID_OPERATION");
  assert.equal(first(bad(E("update_event_type", { eventTypeId: { ref: "nunca" }, name: "x" }))).code, "UNKNOWN_REF");
  assert.equal(first(bad(E("update_event_type", { eventTypeId: 1, name: "" }))).field, "name");
  assert.equal(first(bad(E("update_event_type", { eventTypeId: 1, sentence: "{x}" }))).field, "sentence");
  assert.equal(first(bad(E("update_event_type", { eventTypeId: 2, motion: "slow" }))).field, "motion", "un evento de elemento no tiene movimiento");
  assert.equal(first(bad(E("update_event_type", { eventTypeId: 1, availability: "UP" }))).field, "availability", "un evento FLOW no tiene disponibilidad");
  for (const extra of [{ id: 9 }, { action: "SEND" }, { state: "UP" }, { visual: { value: "x" } }, { sentenceTemplate: "x" }, { pageIndex: 0 }, { usedBy: 3 }, { target: { edgeId: 4 } }]) {
    const r = bad(E("update_event_type", { eventTypeId: 1, name: "x", ...extra }));
    assert.deepEqual([r.ok, first(r).code], [false, "INVALID_OPERATION"], JSON.stringify(extra));
  }
});

/* ═══════════════ 4. delete_event_type ═══════════════ */

test("delete de un evento SIN uso: se elimina, el contador no retrocede y los demás no cambian", () => {
  const base = simple();
  const r = apply(base, [E("create_event_type", { name: "Sobra", primitive: "OCCURRENCE", sentence: "{target}", ref: "s" }), E("delete_event_type", { eventTypeId: { ref: "s" } })]);
  assert.equal(r.ok, true);
  assert.deepEqual(types(r.project), types(base));
  assert.equal(r.project.doc.nextEventTypeId, 6);
  assert.deepEqual(r.changes[1].eventType.name, "Sobra");
  assert.equal(r.changes[1].deleted, true);
});

test("delete de un evento USADO: REFERENCED_ENTITY con entity, affectedStories y affectedSteps; ningún documento parcial", () => {
  const r = apply(simple(), [E("delete_event_type", { eventTypeId: 1 })]);
  assert.equal(r.ok, false);
  assert.equal(r.project, undefined);
  assert.equal(r.errors.length, 1);
  const e = first(r);
  assert.deepEqual([e.code, e.entity, e.operationIndex, e.integrityCodes], ["REFERENCED_ENTITY", { kind: "eventType", id: 1, name: "Pago" }, 0, ["missing_event_type"]]);
  assert.deepEqual(e.affectedStories.map((s) => [s.pageIndex, s.storyId, s.storyName, s.stepIds]), [[0, 1, "Historia A", [1]], [0, 2, "Historia B", [2]]]);
  assert.deepEqual(e.affectedSteps, [{ pageIndex: 0, storyId: 1, stepId: 1 }, { pageIndex: 0, storyId: 2, stepId: 2 }]);
  assert.match(e.message, /Historia A.*Historia B/);
});

test("delete usado en varias páginas: se identifican las Historias de cada una", () => {
  const d = complex();
  const used = d.doc.pages.flatMap((p, pi) => p.scenarios.flatMap((s) => s.steps.filter((t) => t.eventTypeId === 1).map(() => [pi, s.id]))).map(String);
  const r = apply(d, [E("delete_event_type", { eventTypeId: 1 })]);
  assert.equal(r.ok, false);
  assert.deepEqual([...new Set(first(r).affectedStories.map((s) => [s.pageIndex, s.storyId].join(",")))].sort(), [...new Set(used)].sort());
});

test("delete: tras quitar sus usos, el borrado en el mismo lote es válido; borrarlo ANTES de quitar sus usos se rechaza", () => {
  const d = simple();
  const uses = [[1, 1], [2, 2]];
  const afterRemoval = apply(d, [...uses.map(([storyId, stepId]) => S("remove_step", { storyId, stepId })), E("delete_event_type", { eventTypeId: 1 })]);
  assert.equal(afterRemoval.ok, true, JSON.stringify(afterRemoval.errors));
  assert.equal(etOf(afterRemoval.project, 1), undefined);
  assert.equal(validate(afterRemoval.project).valid, true);
  const before = apply(d, [E("delete_event_type", { eventTypeId: 1 }), ...uses.map(([storyId, stepId]) => S("remove_step", { storyId, stepId }))]);
  assert.deepEqual([before.ok, first(before).code, first(before).operationIndex], [false, "REFERENCED_ENTITY", 0]);
});

test("delete: inexistente, sin id válido y campos no permitidos", () => {
  assert.equal(first(apply(simple(), [E("delete_event_type", { eventTypeId: 99 })])).code, "EVENT_TYPE_NOT_FOUND");
  assert.equal(first(apply(simple(), [E("delete_event_type", { eventTypeId: 0 })])).code, "INVALID_OPERATION");
  assert.equal(first(apply(simple(), [E("delete_event_type", { eventTypeId: 1, force: true })])).code, "INVALID_OPERATION");
  assert.equal(first(apply(simple(), [E("delete_event_type", {})])).code, "INVALID_OPERATION");
});

/* ═══════════════ 5. Alcance ═══════════════ */

test("alcance: los EventTypes son globales: scope eventType, nunca story/page, y sin pageIndex", () => {
  for (const op of ["create_event_type", "update_event_type", "delete_event_type"]) {
    for (const wrong of ["story", "page", undefined, "document"]) {
      const r = apply(simple(), [{ op, scope: wrong, eventTypeId: 1, name: "x", primitive: "FLOW", sentence: "{source}" }]);
      assert.deepEqual([r.ok, first(r).code], [false, "SCOPE_MISMATCH"], `${op} ${wrong}`);
    }
    const withPage = apply(simple(), [{ op, scope: "eventType", pageIndex: 0, eventTypeId: 1, name: "x", primitive: "FLOW", sentence: "{source}" }]);
    assert.deepEqual([withPage.ok, first(withPage).code, first(withPage).field], [false, "INVALID_OPERATION", "pageIndex"], op);
  }
  // Y al revés: las operaciones de Historia no valen con scope eventType.
  assert.equal(first(apply(simple(), [{ op: "create_story", scope: "eventType", pageIndex: 0 }])).code, "SCOPE_MISMATCH");
});

test("un evento de la biblioteca no pertenece a una Historia: una operación de Historia no puede cambiarlo y viceversa", () => {
  const r = apply(simple(), [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4 }, name: "x" })]);
  assert.equal(first(r).code, "INVALID_OPERATION");
  const added = apply(simple(), [S("add_step", { storyId: 3, eventTypeId: 1, target: { edgeId: 4 } })]);
  assert.deepEqual(types(added.project), types(simple()), "añadir un paso no toca la biblioteca");
});

/* ═══════════════ 6. create → add_step → run_story ═══════════════ */

test("create_event_type → add_step (por ref y por id) → ejecuta: el Step referencia el EventType por id, sin copiarlo", () => {
  const r = apply(simple(), [
    E("create_event_type", { name: "Pago rechazado", primitive: "FLOW", sentence: "{source} no logra pagar a {target}", symbol: "✗", motion: "fast", presentation: { connectionEffects: { style: "impulse" } }, ref: "rech" }),
    S("create_story", { name: "Pago rechazado", ref: "h" }),
    S("add_step", { storyId: { ref: "h" }, eventTypeId: { ref: "rech" }, target: { from: 1, to: 2 } }),
    S("add_step", { storyId: { ref: "h" }, eventTypeId: 5, target: { edgeId: 5 }, waitMs: 500 }),
  ]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const sc = story(r.project, 4);
  assert.deepEqual(sc.steps, [{ id: 1, at: 0, action: "SEND", edgeId: 4, eventTypeId: 5 }, { id: 2, at: 500, action: "SEND", edgeId: 5, eventTypeId: 5 }]);
  assert.deepEqual(Object.keys(sc.steps[0]).sort(), ["action", "at", "edgeId", "eventTypeId", "id"], "el Step no copia el EventType");
  const out = K.call(`(function(){ doc = projectFromProjectData(__a).doc; const page = doc.pages[0], sc = page.scenarios.find(s => s.id === 4); const run = FluyoStory.run(page, sc);
    return {ok: run.ok, sentences: sc.steps.map(s => FluyoStory.sentence(page, s, eventTypeById(s.eventTypeId))), outcomes: FluyoStory.outcomes(run.trace, sc, page).map(o => o.status)}; })()`, r.project);
  assert.equal(out.ok, true);
  assert.deepEqual(out.outcomes, ["completed", "completed"]);
  assert.match(out.sentences[0], /no logra pagar/);
  assert.deepEqual(validate(r.project).stories.find((s) => s.storyId === 4), { pageIndex: 0, storyId: 4, executable: true });
});

test("add_step con un evento creado en el mismo lote pero con una acción incompatible con el destino se rechaza (TARGET_INCOMPATIBLE)", () => {
  const r = apply(simple(), [E("create_event_type", { name: "Late", primitive: "OCCURRENCE", sentence: "{target} late", ref: "l" }), S("add_step", { storyId: 1, eventTypeId: { ref: "l" }, target: { edgeId: 4 } })]);
  assert.equal(first(r).code, "TARGET_INCOMPATIBLE");
  assert.equal(first(r).operationIndex, 1);
});

/* ═══════════════ 7. Atomicidad, revisión y determinismo ═══════════════ */

test("atomicidad: crear · actualizar · operación inválida ⇒ sin documento y el original queda byte a byte igual (entrada congelada)", () => {
  const out = K.call(`(function(){
    const fr = o => { if(o && typeof o==="object"){ Object.freeze(o); for(const k of Object.keys(o)) fr(o[k]); } return o; };
    const p = fr(__a.p), before = JSON.stringify(p);
    const r = FluyoAuthoring.apply(p, __a.o);
    return {ok: r.ok, project: r.project === undefined, code: r.errors[0].code, index: r.errors[0].operationIndex, unchanged: JSON.stringify(p) === before};
  })()`, { p: simple(), o: [E("create_event_type", { name: "A", primitive: "FLOW", sentence: "{source}", ref: "a" }), E("update_event_type", { eventTypeId: { ref: "a" }, name: "B" }), E("update_event_type", { eventTypeId: 1, primitive: "OCCURRENCE" })] });
  assert.deepEqual(out, { ok: false, project: true, code: "EVENT_TYPE_LOCKED", index: 2, unchanged: true });
});

test("atomicidad mezclando Historias y EventTypes: la operación inválida final descarta todo", () => {
  const base = simple(), before = JSON.stringify(base);
  const r = apply(base, [E("create_event_type", { name: "A", primitive: "FLOW", sentence: "{source}", ref: "a" }), S("create_story", { name: "S", ref: "s" }), S("add_step", { storyId: { ref: "s" }, eventTypeId: { ref: "a" }, target: { edgeId: 4 } }), E("delete_event_type", { eventTypeId: { ref: "a" } })]);
  assert.deepEqual([r.ok, first(r).code, first(r).operationIndex], [false, "REFERENCED_ENTITY", 3]);
  assert.equal(JSON.stringify(base), before);
});

test("determinismo: la misma entrada + las mismas operaciones dan el mismo resultado (sin reloj, azar ni estado global)", () => {
  const ops = [PAGO, E("update_event_type", { eventTypeId: 2, name: "Procesado" }), E("create_event_type", { name: "Q", primitive: "SET_AVAILABILITY", availability: "DOWN", sentence: "{target} cae" })];
  const a = apply(simple(), ops), b = apply(simple(), ops);
  assert.deepStrictEqual(a, b);
  const c = K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p: a.project, o: [E("update_event_type", { eventTypeId: 5, name: "Pago" })] });
  assert.equal(c.ok, true);
  assert.deepStrictEqual(c.project, a.project, "reaplicar el mismo valor es idempotente");
  assert.deepStrictEqual(K.call("FluyoAuthoring.normalizedProject(__a)", a.project).project, a.project);
});

test("el resultado de un lote de EventTypes es un documento normalizado de Fluyo (idempotente) y válido", () => {
  const r = apply(simple(), [PAGO, E("update_event_type", { eventTypeId: 3, presentation: { connectionEffects: { during: "halo" } } })]);
  assert.deepStrictEqual(K.call("FluyoAuthoring.normalizedProject(__a)", r.project).project, r.project);
  assert.equal(validate(r.project).valid, true);
});

/* ═══════════════ 8. Integridad (FluyoIntegrity) ═══════════════ */

test("integridad: EventType inexistente, duplicado y mal formado, Step con referencia inválida, acción y destino incompatibles", () => {
  const withMut = (fn) => { const d = simple(); fn(d); return validate(d); };
  const missing = withMut((d) => { story(d, 1).steps[0].eventTypeId = 99; });
  assert.deepEqual(missing.errors.map((e) => [e.code, e.entityKind, e.entityId, e.storyId, e.stepId]), [["missing_event_type", "eventType", 99, 1, 1]]);
  const dup = withMut((d) => { types(d).push(J(types(d)[0])); });
  assert.deepEqual(dup.errors.map((e) => [e.code, e.entityKind, e.entityId]), [["duplicate_event_type_id", "eventType", 1]]);
  for (const bad of [{ name: "" }, { primitive: "SEND" }, { sentenceTemplate: "{x}" }, { visual: { kind: "token", value: "123456789" } }, { motion: "turbo" }, { id: 0 }, { id: "1" }]) {
    const v = withMut((d) => { Object.assign(types(d)[1], bad); });
    assert.ok(v.errors.some((e) => e.code === "invalid_event_type" && e.entityKind === "eventType"), JSON.stringify(bad));
  }
  const badAv = withMut((d) => { delete types(d)[3].availability; });
  assert.equal(badAv.errors[0].code, "invalid_event_type");
  for (const ref of [0, -1, 1.5, "1", null, {}]) {
    const v = withMut((d) => { story(d, 1).steps[0].eventTypeId = ref; });
    assert.ok(v.errors.some((e) => e.code === "invalid_step" && e.stepId === 1), `eventTypeId ${JSON.stringify(ref)}`);
  }
  const action = withMut((d) => { types(d)[0].primitive = "OCCURRENCE"; });
  assert.deepEqual([...new Set(action.errors.map((e) => [e.code, e.reason].join(":")))], ["event_type_action_mismatch:action"]);
  assert.deepEqual(action.errors.map((e) => [e.storyId, e.stepId]), [[1, 1], [2, 2]]);
  const state = withMut((d) => { types(d)[3].availability = "UP"; });
  assert.deepEqual([...new Set(state.errors.map((e) => [e.code, e.reason].join(":")))], ["event_type_action_mismatch:availability"]);
  const target = withMut((d) => { story(d, 1).steps[0] = { id: 1, at: 0, action: "SEND", nodeId: 2, eventTypeId: 1 }; });
  assert.ok(target.errors.some((e) => e.code === "invalid_step" && e.stepId === 1), "un SEND con elemento como destino");
  const wrongTarget = withMut((d) => { story(d, 1).steps[0].edgeId = 2; });                // 2 es un elemento, no una conexión
  assert.ok(wrongTarget.errors.some((e) => e.code === "missing_edge" && e.entityId === 2), "destino de otro tipo");
  const occurrenceOnEdge = withMut((d) => { story(d, 1).steps[1].nodeId = 4; });           // 4 es una conexión
  assert.ok(occurrenceOnEdge.errors.some((e) => e.code === "missing_node" && e.entityId === 4));
});

test("integridad: un lote nunca deja un EventType mal formado o duplicado, ni Steps incompatibles con su evento", () => {
  const r = apply(simple(), [
    PAGO, E("update_event_type", { eventTypeId: 5, primitive: "SET_AVAILABILITY", availability: "UP", sentence: "{target} vuelve", ref: undefined }),
    E("update_event_type", { eventTypeId: 5, primitive: "OCCURRENCE" }),
    E("create_event_type", { name: "Z", primitive: "FLOW", sentence: "{source} z", symbol: "12345678" }),
  ]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const v = validate(r.project);
  assert.equal(v.valid, true);
  assert.equal(new Set(types(r.project).map((e) => e.id)).size, types(r.project).length);
});

test("la validación final es la red de seguridad: un error NUEVO del estado final rechaza el lote", () => {
  const out = K.call(`(function(){
    const real = FluyoIntegrity.validateProject; let calls = 0;
    FluyoIntegrity.validateProject = function(p){ const r = real(p); calls++; if(calls === 2) r.errors.push({code:"missing_event_type", message:"inyectado", scope:"step", pageIndex:0, storyId:1, stepId:1, entityKind:"eventType", entityId:77}); return r; };
    try { return FluyoAuthoring.apply(__a.p, __a.o); } finally { FluyoIntegrity.validateProject = real; }
  })()`, { p: simple(), o: [PAGO] });
  assert.deepEqual([out.ok, out.errors[0].code, out.errors[0].integrityError.entityId], [false, "INTEGRITY_VIOLATION", 77]);
});

test("eventTypeImpact: qué rompería quitar o cambiar un evento (FluyoIntegrity) y removalImpact con eventTypeIds", () => {
  const impact = (id, cand) => K.call("FluyoIntegrity.eventTypeImpact(__a.p, __a.id, __a.c)", { p: simple(), id, c: cand });
  const gone = impact(1, null);
  assert.equal(gone.wouldInvalidate, true);
  assert.deepEqual(gone.affectedStories.map((s) => [s.storyId, s.stepIds, s.codes]), [[1, [1], ["missing_event_type"]], [2, [2], ["missing_event_type"]]]);
  assert.equal(impact(1, { ...etOf(simple(), 1), name: "Otro nombre" }).wouldInvalidate, false);
  assert.equal(impact(1, { ...etOf(simple(), 1), primitive: "OCCURRENCE" }).wouldInvalidate, true);
  assert.equal(impact(99, null).error, "event_type_not_found");
  const viaRemoval = K.call("FluyoIntegrity.removalImpact(__a.p, __a.r)", { p: simple(), r: { eventTypeIds: [1] } });
  assert.deepEqual(viaRemoval.affectedStories, gone.affectedStories);
  const mixed = K.call("FluyoIntegrity.removalImpact(__a.p, __a.r)", { p: simple(), r: { pageIndex: 0, edgeIds: [5], eventTypeIds: [4] } });
  assert.deepEqual(mixed.affectedStories.map((s) => s.storyId), [1, 2, 3]);
});

/* ═══════════════ 9. Compatibilidad con documentos antiguos ═══════════════ */

test("compatibilidad: documento sin EventTypes, sin Historias, EventType sin presentación/motion, Step sin eventTypeId", () => {
  const empty = { version: 5, app: "fluyo", doc: { theme: "dark", pages: [{ name: "P", nodes: [], edges: [], nextId: 1 }] }, settings: {} };
  const a = apply(empty, [PAGO, E("create_event_type", { name: "Q", primitive: "OCCURRENCE", sentence: "{target}" })]);
  assert.equal(a.ok, true, JSON.stringify(a.errors));
  assert.deepEqual(types(a.project).map((e) => e.id), [1, 2]);
  assert.equal(a.project.doc.nextEventTypeId, 3);
  assert.deepEqual(pg(a.project).scenarios, []);
  const old = simple();
  delete types(old)[0].presentation; delete types(old)[0].motion; delete types(old)[1].presentation;
  const u = apply(old, [E("update_event_type", { eventTypeId: 1, name: "Pago antiguo" })]);
  assert.equal(u.ok, true, JSON.stringify(u.errors));
  assert.equal("presentation" in etOf(u.project, 1), false, "renombrar no inventa presentación");
  const p = apply(old, [E("update_event_type", { eventTypeId: 1, presentation: { connectionEffects: { style: "smooth" } } })]);
  assert.equal(etOf(p.project, 1).presentation.connectionEffects.style, "smooth");
  const legacySteps = simple();
  for (const sc of pg(legacySteps).scenarios) for (const s of sc.steps) delete s.eventTypeId;
  const l = apply(legacySteps, [E("delete_event_type", { eventTypeId: 1 })]);
  assert.equal(l.ok, true, "sin Steps que lo referencien se puede borrar");
});

test("compatibilidad: documentos reales de la app (ejemplos y regresión visual, v2–v5) se amplían con eventos, se normalizan a v5 y siguen siendo ejecutables", () => {
  const files = [];
  for (const dir of ["ejemplos/data", "test/fixtures/regresion-visual"]) for (const f of fs.readdirSync(path.join(__dirname, "..", dir))) if (/.fluyo.json$/.test(f)) files.push(path.join(dir, f));
  assert.ok(files.length >= 8, "hay documentos reales que probar");
  const versions = new Set();
  for (const f of files) {
    const d = JSON.parse(read(f));
    versions.add(d.version);
    const before = validate(d);
    const r = apply(d, [PAGO, E("update_event_type", { eventTypeId: { ref: "nunca" }, name: "x" })].slice(0, 1));
    assert.equal(r.ok, true, `${f}: ${JSON.stringify(r.errors)}`);
    assert.equal(r.project.version, 5);
    assert.equal(r.project.doc.eventTypes.at(-1).name, "Pago");
    assert.equal(validate(r.project).valid, before.valid, `${f}: crear un evento no cambia la validez del documento`);
    assert.deepStrictEqual(pg(r.project).nodes.length, pg(d).nodes.length);
  }
  assert.ok(versions.size >= 1);
});

test("compatibilidad: la salida de MCP se abre en el editor (normalizador real) y un Share/Viewer de la Historia resultante es válido", () => {
  const r = apply(simple(), [PAGO, S("create_story", { name: "Con evento nuevo", ref: "s" }), S("add_step", { storyId: { ref: "s" }, eventTypeId: 5, target: { edgeId: 4 } })]);
  const { ctx } = makeScenarioUIContext();
  ctx.__p = r.project;
  const out = ctx.run(`(function(){ doc = projectFromProjectData(__p).doc; return {types: doc.eventTypes.length, steps: doc.pages[0].scenarios.find(s=>s.id===4).steps.length}; })()`);
  assert.deepEqual(J(out), { types: 5, steps: 1 });
});

/* ═══════════════ 10. PARIDAD con el modal REAL del editor ═══════════════ */

function editor(fixture) {
  const { ctx, register } = makeScenarioUIContext();
  freshPage(ctx); setupPanel(ctx, register);
  for (const id of ["scPlacementText", "scPlacementConfirm"]) register(id, ctx.document.createElement("div"));
  ctx.renderTabs = () => ctx.run("scSyncPage()");
  ensureUI(ctx);
  ctx.confirm = () => true;
  ctx.__fixture = fixture;
  ctx.run("doc = projectFromProjectData(__fixture).doc; undoStack = []; redoStack = []; scSyncPage();");
  return ctx;
}
function radio(ed, name, value) {
  ed.__r = [name, value];
  ed.run(`(function(){ const [n, v] = __r; let el = [...document.querySelectorAll('input[name="' + n + '"]')].find(e => e.value === v);
    if (!el) { el = document.createElement("input"); el.setAttribute("name", n); el.setAttribute("value", v); el.setAttribute("type", "radio"); document.body.appendChild(el); }
    document.querySelectorAll('input[name="' + n + '"]').forEach(e => { e.checked = e.value === v; }); })()`);
}
const check = (ed, id, on) => { ed.__c = [id, on]; ed.run("$(__c[0]).checked = __c[1]"); };
/* Rellena el modal del editor como lo haría una persona y pulsa «Crear/Guardar». `o.id` abre un evento existente. */
function modal(ed, o) {
  ed.run(`scOpenEventDialog(${o.id === undefined ? "null" : o.id})`);
  ed.__o = o;
  if (o.name !== undefined) ed.run('$("scEventName").value = __o.name');
  if (o.phrase !== undefined) ed.run("scPhraseParts = scParsePhrase(__o.phrase)");
  if (o.symbol !== undefined) ed.run("scVisual = __o.symbol");
  if (o.where) radio(ed, "scWhere", o.where);
  if (o.consequence) radio(ed, "scConsequence", o.consequence);
  if (o.motion) radio(ed, "scMotion", o.motion);
  for (const [k, v] of Object.entries(o.flow || {})) radio(ed, "scFlow" + k[0].toUpperCase() + k.slice(1), v);
  const n = o.node || {};
  for (const [k, id] of [["showSymbol", "scShowSymbol"], ["highlight", "scHighlight"], ["blink", "scBlink"], ["dim", "scDim"]]) if (n[k] !== undefined) check(ed, id, n[k]);
  if (n.symbolSize) radio(ed, "scSymbolSize", n.symbolSize);
  for (const [k, name] of [["messageSize", "scMsgSize"], ["messageWeight", "scMsgWeight"], ["messageFont", "scMsgFont"], ["messagePosition", "scMsgPos"]]) if (n[k]) radio(ed, name, n[k]);
  if (n.message !== undefined) { check(ed, "scUseMessage", true); ed.__m = n.message; ed.run('$("scMessage").value = __m'); }
  if (n.messageColor) { ed.__m = n.messageColor; ed.run('$("scMessageColorCustom").value = __m'); }
  if (n.fillColor) { check(ed, "scUseFill", true); ed.__m = n.fillColor; ed.run('$("scFillColorCustom").value = __m'); }
  if (n.visualDuration) { radio(ed, "scVisDur", n.visualDuration); if (n.visualDurationMs) { ed.__m = n.visualDurationMs / 1000; ed.run('$("scDurationSeconds").value = __m'); } }
  ed.run("scSaveEventType()");
  assert.equal(ed.run('$("scEventError").hidden'), true, "el modal no debe mostrar error: " + ed.run('$("scEventError").textContent'));
}
const edTypes = (ed) => J(ed.run("doc.eventTypes"));
const edNext = (ed) => ed.run("doc.nextEventTypeId");

const PARITY = [
  { label: "conexión con los valores por defecto",
    modal: { name: "Pago", phrase: "{source} paga a {target}", symbol: "💵", where: "connection" },
    op: { name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", symbol: "💵" } },
  { label: "conexión con movimiento y efectos",
    modal: { name: "Pago rápido", phrase: "{source} abona a {target}", symbol: "✔", where: "connection", motion: "slow", flow: { size: "large", style: "smooth", trail: "subtle", arrival: "pulse", during: "halo" } },
    op: { name: "Pago rápido", primitive: "FLOW", sentence: "{source} abona a {target}", symbol: "✔", motion: "slow", presentation: { connectionEffects: { size: "large", style: "smooth", trail: "subtle", arrival: "pulse", during: "halo" } } } },
  { label: "elemento (OCCURRENCE) con mensaje, énfasis, color y duración personalizada",
    modal: { name: "Recibir pago", phrase: "{target} recibe un pago", symbol: "📦", where: "element", node: { showSymbol: true, symbolSize: "large", message: "Pago recibido", messageColor: "#d0576a", messageSize: "large", messageWeight: "bold", messageFont: "mono", messagePosition: "below", highlight: true, blink: true, fillColor: "#3aa7e8", visualDuration: "custom", visualDurationMs: 2500 } },
    op: { name: "Recibir pago", primitive: "OCCURRENCE", sentence: "{target} recibe un pago", symbol: "📦", presentation: { nodeEffects: { showSymbol: true, symbolSize: "large", message: "Pago recibido", messageColor: "#d0576a", messageSize: "large", messageWeight: "bold", messageFont: "mono", messagePosition: "below", highlight: true, blink: true, fillColor: "#3aa7e8", visualDuration: "custom", visualDurationMs: 2500 } } } },
  { label: "elemento que cae (SET_AVAILABILITY DOWN)",
    modal: { name: "Servicio caído", phrase: "{target} cae", symbol: "⚠", where: "element", consequence: "down", node: { dim: true } },
    op: { name: "Servicio caído", primitive: "SET_AVAILABILITY", availability: "DOWN", sentence: "{target} cae", symbol: "⚠", presentation: { nodeEffects: { dim: true } } } },
  { label: "elemento que se recupera (SET_AVAILABILITY UP) con preset de duración",
    modal: { name: "Servicio recuperado", phrase: "{name} en {target}", symbol: "↑", where: "element", consequence: "up", node: { visualDuration: "long" } },
    op: { name: "Servicio recuperado", primitive: "SET_AVAILABILITY", availability: "UP", sentence: "{name} en {target}", symbol: "↑", presentation: { nodeEffects: { visualDuration: "long" } } } },
];

for (const c of PARITY) {
  test(`PARIDAD EventType · ${c.label}: el modal del editor y author_document dejan el MISMO objeto (deepStrictEqual, sin normalizar)`, () => {
    const ed = editor(simple());
    modal(ed, c.modal);
    const au = apply(simple(), [E("create_event_type", c.op)]);
    assert.equal(au.ok, true, JSON.stringify(au.errors));
    assert.deepStrictEqual(types(au.project), edTypes(ed));
    assert.equal(au.project.doc.nextEventTypeId, edNext(ed));
    assert.equal(validate(au.project).valid, true);
  });
}

test("PARIDAD EventType · una biblioteca entera creada en orden: mismos objetos y mismos ids", () => {
  const ed = editor(simple()), ops = [];
  for (const c of PARITY) { modal(ed, c.modal); ops.push(E("create_event_type", c.op)); }
  const au = apply(simple(), ops);
  assert.deepStrictEqual(types(au.project), edTypes(ed));
  assert.deepStrictEqual(au.project.doc.nextEventTypeId, edNext(ed));
});

test("PARIDAD EventType · editar un evento USADO desde el modal y con update_event_type deja el mismo objeto; Historias y Steps intactos", () => {
  const ed = editor(simple());
  modal(ed, { id: 1, name: "Pago aprobado", phrase: "{source} abona a {target}", symbol: "✔", where: "connection", motion: "fast", flow: { style: "impulse", arrival: "glow" } });
  const au = apply(simple(), [E("update_event_type", { eventTypeId: 1, name: "Pago aprobado", sentence: "{source} abona a {target}", symbol: "✔", motion: "fast", presentation: { connectionEffects: { style: "impulse", arrival: "glow" } } })]);
  assert.equal(au.ok, true, JSON.stringify(au.errors));
  assert.deepStrictEqual(types(au.project), edTypes(ed));
  assert.deepStrictEqual(pg(au.project).scenarios, J(ed.run("doc.pages[0].scenarios")));
});

test("PARIDAD EventType · editar un evento de DISPONIBILIDAD usado desde el modal (reenvía la misma disponibilidad) no lanza y coincide con update_event_type", () => {
  const ed = editor(simple());
  modal(ed, { id: 4, name: "Caída editada", phrase: "{target} cae", symbol: "⚠", where: "element", consequence: "down" });
  const au = apply(simple(), [E("update_event_type", { eventTypeId: 4, name: "Caída editada", sentence: "{target} cae", symbol: "⚠", presentation: { nodeEffects: {} } })]);
  assert.equal(au.ok, true, JSON.stringify(au.errors));
  assert.equal(edTypes(ed).find((e) => e.id === 4).name, "Caída editada");
  assert.deepStrictEqual(types(au.project), edTypes(ed));
});

test("PARIDAD EventType · eliminar: el editor rechaza un evento usado y borra uno libre; update/delete de MCP igual", () => {
  const ed = editor(simple());
  assert.throws(() => ed.run("deleteEventType(1)"), (e) => e.code === "event_type_in_use");
  modal(ed, PARITY[0].modal);
  const freeId = ed.run("doc.eventTypes.at(-1).id");
  ed.run(`deleteEventType(${freeId})`);
  const au = apply(simple(), [E("create_event_type", PARITY[0].op), E("delete_event_type", { eventTypeId: freeId })]);
  assert.deepStrictEqual(types(au.project), edTypes(ed));
  assert.equal(first(apply(simple(), [E("delete_event_type", { eventTypeId: 1 })])).code, "REFERENCED_ENTITY");
});

/* La misma Historia, con el mismo EventType, construida por el editor y por author_document: Trace, outcomes, disponibilidad final y metadata. */
function editorStory(ed) {
  const run = (c) => ed.run(c);
  modal(ed, PARITY[1].modal);
  const flowId = run("doc.eventTypes.at(-1).id");
  modal(ed, PARITY[3].modal);
  const downId = run("doc.eventTypes.at(-1).id");
  modal(ed, PARITY[2].modal);
  const occId = run("doc.eventTypes.at(-1).id");
  run("scNewScenario()");
  const sid = run("scActiveScenario().id");
  run(`scApplyTargets(${flowId}, [4])`);
  run(`scApplyTargets(${downId}, [2])`);
  const last = run("scActiveScenario().steps.at(-1).id");
  run(`scSetStepDelay(${last}, 2000)`);
  run(`scApplyTargets(${flowId}, [5])`);
  run(`scApplyTargets(${occId}, [3])`);
  return { sid, flowId, downId, occId };
}
const AUTHOR_STORY = (ids) => [
  E("create_event_type", PARITY[1].op), E("create_event_type", PARITY[3].op), E("create_event_type", PARITY[2].op),
  S("create_story", { ref: "s" }),
  S("add_step", { storyId: { ref: "s" }, eventTypeId: ids.flowId, target: { edgeId: 4 } }),
  S("add_step", { storyId: { ref: "s" }, eventTypeId: ids.downId, target: { nodeId: 2 }, ref: "down" }),
  S("set_wait", { storyId: { ref: "s" }, stepId: { ref: "down" }, waitMs: 2000 }),
  S("add_step", { storyId: { ref: "s" }, eventTypeId: ids.flowId, target: { edgeId: 5 } }),
  S("add_step", { storyId: { ref: "s" }, eventTypeId: ids.occId, target: { nodeId: 3 } }),
];
/* Misma definición que fluyo-mcp/src/revision.ts: JSON canónico (claves ordenadas) → sha256. */
const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]" : v !== null && typeof v === "object" ? "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
const canonicalSha = (v) => "sha256:" + require("node:crypto").createHash("sha256").update(canon(v), "utf8").digest("hex");
const runIn = (project, id) => K.call(`(function(){ const d = projectFromProjectData(__a.p).doc; doc = d; const page = d.pages[0], sc = page.scenarios.find(s => s.id === __a.id);
  const r = FluyoStory.run(page, sc); return {trace: r.trace, outcomes: FluyoStory.outcomes(r.trace, sc, page), finalAvailability: FluyoStory.finalAvailability(r.trace, page), stepMeta: FluyoStory.stepMeta(sc.steps), playback: sc.steps.map(s => FluyoStory.playbackEffects ? FluyoStory.playbackEffects(eventTypeById(s.eventTypeId)) : null)}; })()`, { p: project, id });

test("PARIDAD · create_event_type → add_step → ejecutar: Trace, outcomes, disponibilidad final y metadata idénticos a los del editor", () => {
  const ed = editor(simple());
  const ids = editorStory(ed);
  const au = apply(simple(), AUTHOR_STORY(ids));
  assert.equal(au.ok, true, JSON.stringify(au.errors));
  assert.deepStrictEqual(types(au.project), edTypes(ed), "biblioteca");
  assert.deepStrictEqual(story(au.project, ids.sid).steps, J(ed.run("scActiveScenario().steps")), "Steps");
  const edProject = simple(); edProject.doc = J(ed.run("doc"));
  // El DOCUMENTO completo (EventTypes, Steps, `at`, contadores, páginas, ajustes) y su revisión, sin normalizar.
  const norm = (pr) => K.call("FluyoAuthoring.normalizedProject(__a).project", pr);
  assert.deepStrictEqual(norm(au.project), norm(edProject), "documento completo: editor ≡ author_document");
  assert.equal(canonicalSha(norm(au.project)), canonicalSha(norm(edProject)), "revisión idéntica");
  const a = runIn(edProject, ids.sid), b = runIn(au.project, ids.sid);
  assert.deepStrictEqual(b.trace, a.trace);
  assert.deepStrictEqual(b.outcomes, a.outcomes);
  assert.deepStrictEqual(b.finalAvailability, a.finalAvailability);
  assert.deepStrictEqual(b.stepMeta, a.stepMeta);
  assert.deepStrictEqual(b.playback, a.playback, "lo que Playback/Present/Viewer/Share leen del EventType (presentación) es idéntico");
  assert.ok(a.trace.events.length >= 4);
  const golden = { revision: canonicalSha(norm(edProject)), operations: AUTHOR_STORY(ids), ids, types: edTypes(ed), steps: J(ed.run("scActiveScenario().steps")), trace: a.trace, outcomes: a.outcomes, finalAvailability: a.finalAvailability, stepMeta: a.stepMeta, playback: a.playback };
  const file = path.join(__dirname, "..", GOLDEN);
  if (process.env.UPDATE_GOLDEN === "1") fs.writeFileSync(file, JSON.stringify(golden, null, 2) + "\n");
  assert.deepStrictEqual(golden, JSON.parse(fs.readFileSync(file, "utf8")));
});

test("PARIDAD · el documento completo del editor y el de author_document coinciden (deepStrictEqual del `doc`)", () => {
  const ed = editor(simple());
  const ids = editorStory(ed);
  const au = apply(simple(), AUTHOR_STORY(ids));
  const edDoc = J(ed.run("projectToSerializable(doc, settings)"));
  assert.deepStrictEqual(au.project.doc, edDoc.doc);
});

test("PARIDAD · lo que pinta el Playback REAL del editor con la Historia creada por MCP es el mismo Trace", () => {
  const ed = editor(simple());
  const ids = editorStory(ed);
  const au = apply(simple(), AUTHOR_STORY(ids));
  const play = editor(au.project);
  play.run(`scSelectStory(${ids.sid}); scRun();`);
  assert.deepStrictEqual(J(play.run("scPlayback.trace")), runIn(au.project, ids.sid).trace, "Fluyo ejecuta la Historia sin saber que la creó MCP");
});

test("PARIDAD · Present/Viewer/Share: el EventType creado por MCP se comparte y se vuelve a abrir idéntico", () => {
  const ed = editor(simple());
  const ids = editorStory(ed);
  const au = apply(simple(), AUTHOR_STORY(ids));
  const share = (project, sid) => K.call("(function(){ const p = projectFromProjectData(__a.p); return JSON.stringify(projectToSerializable(p.doc, p.settings).doc.eventTypes) + '|' + JSON.stringify(p.doc.pages[0].scenarios.find(s => s.id === __a.id).steps); })()", { p: project, id: sid });
  const edProject = simple(); edProject.doc = J(ed.run("doc"));
  assert.equal(share(au.project, ids.sid), share(edProject, ids.sid));
});

/* ═══════════════ 11. Frontera con el editor ═══════════════ */

test("el editor consume las funciones compartidas de EventType (no las reimplementa) y el kernel no contiene lógica del motor", () => {
  const ed = read("js/editor-scenarios.js");
  for (const fn of ["eventTypeDefinition(", "eventTypePrimitiveFor(", "updateEventType(", "createEventType(", "deleteEventType(", "DEFAULT_EVENT_SYMBOL"]) assert.ok(ed.includes(fn), `editor-scenarios.js no llama a ${fn}`);
  for (const bad of ['primitive: connection ? "FLOW"', "def.presentation = { connectionEffects", "def.availability = consequence"]) assert.ok(!ed.includes(bad), `editor-scenarios.js conserva la forma por primitiva: ${bad}`);
  const authoring = read("js/story-authoring.js");
  for (const bad of ["send_failed", "runScenario", "validateExecution", "EVENT_TYPE_PRIMITIVES.has(changes", "EVENT_ACTION_BY_PRIMITIVE"]) assert.ok(!authoring.includes(bad), `story-authoring.js contiene lógica ajena: ${bad}`);
  assert.ok(!/\.name\.length\s*>\s*60|length\s*>\s*200/.test(authoring), "los largos de nombre/frase son de model.js");
});
