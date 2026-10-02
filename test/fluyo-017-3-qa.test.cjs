"use strict";
/* FLUYO-017.3 — QA adversarial de la autoría de EventTypes.
   Entradas hostiles (prototipos, tipos, límites, ids agotados), referencias del lote, lo que nadie puede escribir,
   y un fuzz determinista de lotes mezclando EventTypes e Historias con invariantes:
   todo lo aceptado es válido, ejecutable, determinista y no muta la entrada; todo lo rechazado no devuelve documento. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];
const J = (v) => JSON.parse(JSON.stringify(v));
const simple = () => JSON.parse(read("test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json"));
const complex = () => JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));

function kernel() {
  const ctx = vm.createContext({});
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, ctx)); };
  return ctx;
}
const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const validate = (p) => K.call("FluyoIntegrity.validateProject(__a)", p);
const E = (op, extra) => ({ op, scope: "eventType", ...extra });
const S = (op, extra) => ({ op, scope: "story", pageIndex: 0, ...extra });
const first = (r) => r.errors[0];
const types = (d) => d.doc.eventTypes;
const make = (extra = {}) => E("create_event_type", { name: "X", primitive: "FLOW", sentence: "{source} a {target}", ...extra });

/* ═══════════════ 1. Entradas hostiles ═══════════════ */

test("prototipos: __proto__, constructor y prototype en la operación o en presentation se rechazan y no contaminan nada", () => {
  const hostile = [
    JSON.parse('{"op":"create_event_type","scope":"eventType","name":"X","primitive":"FLOW","sentence":"{source}","__proto__":{"polluted":true}}'),
    JSON.parse('{"op":"create_event_type","scope":"eventType","name":"X","primitive":"FLOW","sentence":"{source}","presentation":{"__proto__":{"polluted":true}}}'),
    JSON.parse('{"op":"create_event_type","scope":"eventType","name":"X","primitive":"FLOW","sentence":"{source}","presentation":{"connectionEffects":{"__proto__":{"polluted":true}}}}'),
    JSON.parse('{"op":"create_event_type","scope":"eventType","name":"X","primitive":"FLOW","sentence":"{source}","presentation":{"connectionEffects":{"constructor":{"prototype":{"polluted":true}}}}}'),
    JSON.parse('{"op":"update_event_type","scope":"eventType","eventTypeId":1,"name":"x","constructor":1}'),
  ];
  for (const op of hostile) {
    const r = apply(simple(), [op]);
    assert.equal(r.ok, false, JSON.stringify(op));
    assert.match(first(r).code, /^INVALID_/);
  }
  assert.equal(K.call("({}).polluted === undefined && Object.prototype.polluted === undefined"), true);
  assert.equal(({}).polluted, undefined);
});

test("tipos hostiles en cada campo: nunca lanza, siempre un error estructurado", () => {
  const values = [null, undefined, true, 0, -1, 1.5, NaN, Infinity, "", " ", "x".repeat(10000), [], [1], {}, { a: 1 }, () => 1, Symbol.iterator.toString()];
  const fields = ["name", "primitive", "sentence", "symbol", "motion", "availability", "presentation", "ref", "eventTypeId"];
  let n = 0;
  for (const f of fields) for (const v of values) {
    for (const op of [make({ [f]: v }), E("update_event_type", { eventTypeId: 1, name: "ok", [f]: v }), E("delete_event_type", { [f]: v, eventTypeId: f === "eventTypeId" ? v : 99 })]) {
      const r = (() => { try { return apply(simple(), [op]); } catch (e) { return { threw: e.message }; } })();
      assert.equal(r.threw, undefined, `lanzó: ${r.threw} · ${f}=${String(v).slice(0, 20)}`);
      if (!r.ok) assert.ok(first(r).code && first(r).message, "error sin código/mensaje");
      n++;
    }
  }
  assert.ok(n > 300);
});

test("operaciones mal formadas: no objeto, sin op, op desconocida, scope ausente, campos extra, lote vacío o enorme", () => {
  for (const op of [null, 5, "x", [], {}, { op: 5 }, { op: "create_events" }, E("create_event_type"), (({ scope, ...rest }) => rest)(make())]) {
    const r = apply(simple(), [op]);
    assert.equal(r.ok, false);
    assert.ok(["INVALID_OPERATION", "UNKNOWN_OPERATION", "SCOPE_MISMATCH", "INVALID_EVENT_TYPE"].includes(first(r).code), JSON.stringify(op));
  }
  assert.equal(first(apply(simple(), [])).code, "INVALID_OPERATION");
  assert.equal(apply(simple(), Array.from({ length: 200 }, (_, i) => make({ name: "E" + i }))).ok, true);
  assert.equal(first(apply(simple(), Array.from({ length: 201 }, () => make()))).code, "INVALID_OPERATION");
});

test("límites: nombre 60, frase 200, símbolo 8 caracteres (emoji cuentan 1), mensaje de nodo 120, ms 300–10000", () => {
  const ok = (extra) => apply(simple(), [make(extra)]).ok;
  assert.equal(ok({ name: "ñ".repeat(60), sentence: "á".repeat(200) }), true);
  assert.equal(ok({ name: "ñ".repeat(61) }), false);
  assert.equal(ok({ symbol: "😀".repeat(8) }), true);
  assert.equal(ok({ symbol: "😀".repeat(9) }), false);
  assert.equal(ok({ name: "  espacios  " }), true);
  assert.equal(etName(apply(simple(), [make({ name: "  espacios  " })])), "espacios", "el nombre se guarda recortado, como en el editor");
  const node = (nodeEffects) => apply(simple(), [E("create_event_type", { name: "N", primitive: "OCCURRENCE", sentence: "{target}", presentation: { nodeEffects } })]).ok;
  assert.equal(node({ message: "m".repeat(120) }), true);
  assert.equal(node({ message: "m".repeat(121) }), false);
  assert.equal(node({ visualDuration: "custom", visualDurationMs: 300 }), true);
  assert.equal(node({ visualDuration: "custom", visualDurationMs: 10000 }), true);
  assert.equal(node({ visualDuration: "custom", visualDurationMs: 299 }), false);
  assert.equal(node({ visualDuration: "custom", visualDurationMs: 10001 }), false);
  assert.equal(node({ visualDuration: "custom", visualDurationMs: 1500.5 }), false);
});
const etName = (r) => r.project.doc.eventTypes.at(-1).name;

test("frase: llaves sueltas y marcadores desconocidos se rechazan (misma regla que el modal); «{{source}}» ya guardado sigue abriéndose", () => {
  for (const sentence of ["{source", "target}", "{{source}}", "{source}}", "{ source }", "{}", "{Source}", "{nombre}", "{source} {x}", "}{"]) {
    const r = apply(simple(), [make({ sentence })]);
    assert.deepEqual([r.ok, first(r).field], [false, "sentence"], sentence);
  }
  const stored = simple(); stored.doc.eventTypes[0].sentenceTemplate = "{{source}}";           // dominio histórico: se acepta al abrir
  assert.equal(validate(stored).valid, true);
  assert.equal(apply(stored, [E("update_event_type", { eventTypeId: 1, name: "Renombrado" })]).ok, true, "renombrar no revalida la frase vieja");
});

test("contador agotado: el último entero seguro no se asigna (id_exhausted → error estructurado, nada parcial)", () => {
  const d = simple(); d.doc.nextEventTypeId = Number.MAX_SAFE_INTEGER;
  const r = apply(d, [make()]);
  assert.equal(r.ok, false);
  assert.equal(r.project, undefined);
  assert.ok(first(r).code && first(r).message);
  const near = simple(); near.doc.nextEventTypeId = Number.MAX_SAFE_INTEGER - 2;
  const ok = apply(near, [make({ name: "A" }), make({ name: "B" })]);
  assert.ok(typeof ok.ok === "boolean");
});

/* ═══════════════ 2. Referencias del lote y reglas de composición ═══════════════ */

test("refs de EventType: no se confunden con las de Historias/Steps, se sobrescriben y no sobreviven al lote", () => {
  const r = apply(simple(), [S("create_story", { ref: "x" }), make({ ref: "x" }), S("add_step", { storyId: { ref: "x" }, eventTypeId: { ref: "x" }, target: { edgeId: 4 } })]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.project.doc.pages[0].scenarios.at(-1).steps[0].eventTypeId, 5, "la ref «x» de evento apunta al evento, no a la Historia");
  const crossed = apply(simple(), [S("create_story", { ref: "s" }), E("update_event_type", { eventTypeId: { ref: "s" }, name: "x" })]);
  assert.equal(first(crossed).code, "UNKNOWN_REF");
  const over = apply(simple(), [make({ name: "uno", ref: "p" }), make({ name: "dos", ref: "p" }), E("update_event_type", { eventTypeId: { ref: "p" }, name: "la segunda" })]);
  assert.deepEqual(types(over.project).slice(4).map((e) => e.name), ["uno", "la segunda"]);
  const again = apply(r.project, [E("update_event_type", { eventTypeId: { ref: "x" }, name: "otra vez" })]);
  assert.equal(first(again).code, "UNKNOWN_REF", "las refs no pasan de un lote a otro");
});

test("un evento creado y borrado en el mismo lote no deja rastro salvo el contador; el paso que lo usaba lo impide", () => {
  const base = simple();
  const r = apply(base, [make({ ref: "t" }), E("delete_event_type", { eventTypeId: { ref: "t" } })]);
  assert.deepEqual(types(r.project), types(base));
  assert.equal(r.project.doc.nextEventTypeId, base.doc.nextEventTypeId + 1);
  const used = apply(base, [make({ ref: "t" }), S("add_step", { storyId: 3, eventTypeId: { ref: "t" }, target: { edgeId: 4 }, ref: "st" }), E("delete_event_type", { eventTypeId: { ref: "t" } })]);
  assert.deepEqual([used.ok, first(used).code, first(used).operationIndex], [false, "REFERENCED_ENTITY", 2]);
  const freed = apply(base, [make({ ref: "t" }), S("add_step", { storyId: 3, eventTypeId: { ref: "t" }, target: { edgeId: 4 }, ref: "st" }), S("remove_step", { storyId: 3, stepId: { ref: "st" } }), E("delete_event_type", { eventTypeId: { ref: "t" } })]);
  assert.equal(freed.ok, true);
});

test("dos eventos distintos («Pago» y «Pago rechazado») no se mezclan: actualizar uno no toca al otro ni a sus pasos", () => {
  const r = apply(simple(), [make({ name: "Pago rechazado", ref: "rech" }), S("create_story", { ref: "h" }), S("add_step", { storyId: { ref: "h" }, eventTypeId: 1, target: { edgeId: 4 } }), S("add_step", { storyId: { ref: "h" }, eventTypeId: { ref: "rech" }, target: { edgeId: 4 } }), S("add_step", { storyId: { ref: "h" }, eventTypeId: 1, target: { edgeId: 5 } })]);
  assert.equal(r.ok, true);
  const up = apply(r.project, [E("update_event_type", { eventTypeId: 1, symbol: "★", presentation: { connectionEffects: { style: "impulse" } } })]);
  assert.deepEqual(types(up.project).find((e) => e.id === 5), types(r.project).find((e) => e.id === 5), "el otro evento no cambia");
  const sc = (p) => p.doc.pages[0].scenarios.find((s) => s.id === 4).steps;
  assert.deepEqual(sc(up.project), sc(r.project), "los pasos de ambos eventos no cambian");
  assert.deepEqual(up.changes[0].affects.stories.map((s) => [s.storyId, s.stepIds]), [[1, [1]], [2, [2]], [4, [1, 3]]], "los tres usos de «Pago» (incluidos dos en la misma Historia)");
});

test("el mismo evento usado varias veces en una Historia y en varias Historias: update global; delete lista TODOS sus pasos", () => {
  const r = apply(simple(), [S("create_story", { ref: "h" }), ...[4, 5, 4].map((edgeId) => S("add_step", { storyId: { ref: "h" }, eventTypeId: 1, target: { edgeId } }))]);
  const del = apply(r.project, [E("delete_event_type", { eventTypeId: 1 })]);
  assert.deepEqual(first(del).affectedStories.map((s) => [s.storyId, s.stepIds]), [[1, [1]], [2, [2]], [4, [1, 2, 3]]]);
  assert.equal(first(del).affectedSteps.length, 5);
});

test("ids irreutilizables entre lotes: crear, borrar y volver a crear en lotes distintos sigue creciendo", () => {
  const a = apply(simple(), [make({ name: "A" })]);
  const b = apply(a.project, [E("delete_event_type", { eventTypeId: 5 })]);
  const c = apply(b.project, [make({ name: "C" })]);
  assert.deepEqual(types(c.project).slice(4).map((e) => e.id), [6]);
  assert.equal(c.project.doc.nextEventTypeId, 7);
});

/* ═══════════════ 3. Lo que nadie puede escribir ═══════════════ */

test("no se puede escribir la acción, el estado, el tiempo, el objetivo, el id ni `visual.kind` de un EventType", () => {
  for (const extra of [{ action: "SEND" }, { state: "DOWN" }, { at: 5 }, { target: { edgeId: 4 } }, { id: 99 }, { visual: { kind: "image", value: "x" } }, { sentenceTemplate: "{source}" }, { usedBy: 1 }, { nextEventTypeId: 1 }, { presentation: { visual: {} } }]) {
    for (const op of [make(extra), E("update_event_type", { eventTypeId: 1, name: "x", ...extra })]) {
      const r = apply(simple(), [op]);
      assert.equal(r.ok, false, JSON.stringify(extra));
      assert.match(first(r).code, /^INVALID_/);
    }
  }
});

test("el EventType decide la acción de los pasos: crear un evento nunca produce un paso con otra acción", () => {
  const spec = { FLOW: ["SEND", { edgeId: 4 }], OCCURRENCE: ["OCCURRENCE", { nodeId: 2 }] };
  for (const [primitive, [action, target]] of Object.entries(spec)) {
    const r = apply(simple(), [make({ primitive, sentence: "{target}", ref: "e" }), S("add_step", { storyId: 3, eventTypeId: { ref: "e" }, target })]);
    assert.equal(r.project.doc.pages[0].scenarios[2].steps.at(-1).action, action);
  }
  for (const [availability, state] of [["UP", "UP"], ["DOWN", "DOWN"]]) {
    const r = apply(simple(), [make({ primitive: "SET_AVAILABILITY", availability, sentence: "{target}", ref: "e" }), S("add_step", { storyId: 3, eventTypeId: { ref: "e" }, target: { nodeId: 3 } })]);
    assert.equal(r.project.doc.pages[0].scenarios[2].steps.at(-1).state, state);
  }
  const wrong = apply(simple(), [make({ primitive: "SET_AVAILABILITY", availability: "UP", sentence: "{target}", ref: "e" }), S("add_step", { storyId: 3, eventTypeId: { ref: "e" }, target: { edgeId: 4 } })]);
  assert.equal(first(wrong).code, "TARGET_INCOMPATIBLE");
});

/* ═══════════════ 4. Fuzz ═══════════════ */

test("fuzz (1.500 lotes deterministas con EventTypes e Historias): lo aceptado es válido y determinista; lo rechazado no devuelve documento; la entrada no muta", () => {
  let seed = 20261003;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], ri = (n) => Math.floor(rnd() * n);
  const bad = [0, -1, 99, 1.5, "x", null, {}, []];
  const maybe = (good, wrong) => (rnd() < 0.94 ? good : pick(wrong));
  const docs = [simple(), complex()];
  const key = (e) => [e.code, e.pageIndex, e.storyId, e.stepId, e.entityKind, e.entityId].join("|");
  const NAMES = ["Pago", "Pago rechazado", "Aviso", "Caída", "Recuperación", "Entrega", "Cobro"];
  const PRIMS = ["FLOW", "OCCURRENCE", "SET_AVAILABILITY"];
  const FX = [{ connectionEffects: { style: pick(["direct", "smooth", "impulse"]) } }, { nodeEffects: { showSymbol: true } }, { connectionEffects: { during: "halo" } }, { nodeEffects: { dim: true, message: "hola" } }, { nodeEffects: { visualDuration: "custom", visualDurationMs: 2000 } }, {}, { bogus: 1 }, { connectionEffects: { style: "zigzag" } }];
  let accepted = 0, rejected = 0, eventOps = 0;
  for (let i = 0; i < 1500; i++) {
    const doc = J(pick(docs)), before = JSON.stringify(doc);
    const refs = [];
    const ops = Array.from({ length: 1 + ri(6) }, () => {
      const page = doc.doc.pages[0], sc = pick(page.scenarios);
      const eid = maybe(pick(doc.doc.eventTypes.map((e) => e.id)), bad);
      const etRef = refs.length && rnd() < 0.5 ? { ref: pick(refs) } : eid;
      const kind = pick(["create_event_type", "create_event_type", "update_event_type", "update_event_type", "update_event_type", "delete_event_type", "add_step", "add_step", "remove_step", "create_story"]);
      if (kind === "create_event_type") {
        eventOps++;
        const primitive = maybe(pick(PRIMS), ["x", null, 3]);
        const o = E(kind, { name: maybe(pick(NAMES), ["", null, "x".repeat(61)]), primitive, sentence: maybe(pick(["{source} a {target}", "{target} cae", "{name}"]), ["", "{x}", "{source"]) });
        if (primitive === "SET_AVAILABILITY") o.availability = maybe(pick(["UP", "DOWN"]), ["MAYBE", null]);
        if (rnd() < 0.4) o.symbol = pick(["★", "💵", "x", "123456789"]);
        if (rnd() < 0.3) o.motion = pick(["fast", "slow", "turbo"]);
        if (rnd() < 0.5) o.presentation = pick(FX);
        if (rnd() < 0.5) { o.ref = "r" + refs.length; refs.push(o.ref); }
        return o;
      }
      if (kind === "update_event_type") {
        eventOps++;
        const o = E(kind, { eventTypeId: etRef });
        if (rnd() < 0.5) o.name = maybe(pick(NAMES), ["", 5]);
        if (rnd() < 0.3) o.sentence = pick(["{source} cambia {target}", "{x}", "{target}"]);
        if (rnd() < 0.3) o.primitive = pick(PRIMS);
        if (rnd() < 0.2) o.availability = pick(["UP", "DOWN"]);
        if (rnd() < 0.2) o.symbol = pick(["★", "x"]);
        if (rnd() < 0.2) o.motion = pick(["fast", "slow"]);
        if (rnd() < 0.4) o.presentation = pick(FX);
        return o;
      }
      if (kind === "delete_event_type") { eventOps++; return E(kind, { eventTypeId: etRef }); }
      const sid = maybe(sc.id, bad);
      if (kind === "create_story") return S(kind, rnd() < 0.5 ? { name: "N" + ri(9) } : {});
      if (kind === "remove_step") return S(kind, { storyId: sid, stepId: maybe(pick(sc.steps.map((s) => s.id)), bad) });
      return S("add_step", { storyId: sid, eventTypeId: etRef, target: pick([{ edgeId: maybe(pick(page.edges.map((e) => e.id)), bad) }, { nodeId: maybe(pick(page.nodes.map((n) => n.id)), bad) }]) });
    });
    const r = apply(doc, ops), r2 = apply(doc, ops);
    assert.equal(JSON.stringify(doc), before, `entrada mutada (#${i})`);
    assert.deepStrictEqual(r, r2, `no determinista (#${i})`);
    if (r.ok) {
      accepted++;
      const after = validate(r.project), baseV = validate(doc);
      const known = new Set(baseV.errors.map(key));
      assert.ok(after.errors.every((e) => known.has(key(e))), `error nuevo tras un lote aceptado (#${i}): ${JSON.stringify(ops)}`);
      const ids = types(r.project).map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length, `ids de EventType duplicados (#${i})`);
      assert.ok(r.project.doc.nextEventTypeId > Math.max(0, ...ids), `contador por detrás de un id (#${i})`);
      for (const t of r.touched) assert.ok(after.stories.find((s) => s.pageIndex === t.pageIndex && s.storyId === t.storyId)?.executable, `Historia tocada no ejecutable (#${i})`);
      assert.equal(r.changes.length, ops.length);
      assert.deepStrictEqual(K.call("FluyoAuthoring.normalizedProject(__a)", r.project).project, r.project, "idempotente");
      // Un EventType usado conserva su primitiva y disponibilidad (dec. 17) y ningún paso cambió por editar la biblioteca.
      for (const et of types(doc)) {
        const now = types(r.project).find((e) => e.id === et.id);
        const used = doc.doc.pages.some((p) => p.scenarios.some((s) => s.steps.some((t) => t.eventTypeId === et.id)));
        const stillUsed = r.project.doc.pages.some((p) => p.scenarios.some((s) => s.steps.some((t) => t.eventTypeId === et.id)));
        if (now && used && stillUsed) assert.deepEqual([now.primitive, now.availability], [et.primitive, et.availability], `primitiva/disponibilidad de un evento usado cambió (#${i})`);
      }
    } else {
      rejected++;
      assert.equal(r.project, undefined);
      assert.ok(r.errors.length && r.errors.every((e) => e.code && e.message), `rechazo sin código/mensaje (#${i})`);
    }
  }
  assert.ok(accepted > 150 && rejected > 300 && eventOps > 2500, `el fuzz debe ejercitar ambos lados (${accepted} aceptados / ${rejected} rechazados / ${eventOps} ops de evento)`);
});
