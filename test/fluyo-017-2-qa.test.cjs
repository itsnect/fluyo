"use strict";
/* FLUYO-017.2 — QA adversarial de la autoría de Historias.
   Paridad PROPIEDAD a PROPIEDAD con el editor real (secuencias aleatorias deterministas de operaciones),
   campos que nadie puede escribir (action/state/at), alcance, ids irreutilizables, referencias del lote,
   y fuzz de lotes con invariantes (todo lo aceptado es válido, ejecutable, determinista y no muta la entrada). */
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

function kernel() {
  const ctx = vm.createContext({});
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.call = (expr, arg) => { ctx.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, ctx)); };
  return ctx;
}
const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const S = (op, extra) => ({ op, scope: "story", pageIndex: 0, ...extra });
const P = (op, extra) => ({ op, scope: "page", pageIndex: 0, ...extra });
const pg = (d, i = 0) => d.doc.pages[i];
const story = (d, id, pi = 0) => pg(d, pi).scenarios.find((s) => s.id === id);

/* ═══════════════ 1. Paridad con el editor, operación a operación, sobre secuencias aleatorias ═══════════════ */

function editorHarness(fixture) {
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

test("PARIDAD aleatoria: 40 secuencias de 14 operaciones — el editor real y author_document dejan los MISMOS Steps tras cada una", () => {
  let seed = 4242;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let compared = 0;
  for (let seq = 0; seq < 40; seq++) {
    const base = complex();
    const ed = editorHarness(base);
    ed.run("scNewScenario()");
    const storyId = ed.run("scActiveScenario().id");
    const ops = [S("create_story")];
    const steps = () => J(ed.run("scActiveScenario().steps"));
    const ordered = () => J(ed.run("storyboardOrderedSteps(scActiveScenario().steps)"));
    const edges = [5, 6, 7, 8], nodes = [1, 2, 3, 4];
    for (let i = 0; i < 14; i++) {
      const cur = steps();
      let kind = pick(["add", "add", "add", "same", "wait", "wait", "dup", "move", "remove", "retarget"]);
      if (!cur.length && kind !== "add") kind = "add";
      const any = () => pick(cur).id;
      if (kind === "add" || kind === "same") {
        const et = pick([1, 2, 3, 4, 5, 6]); const flow = et === 1 || et === 3 || et === 6;
        const target = flow ? pick(edges) : pick(nodes);
        if (kind === "same" && cur.length) {
          const anchor = any();
          ed.run(`scContext = {kind:"same", stepId:${anchor}, scenarioId:scActiveScenario().id, page:P()}; scApplyTargets(${et}, [${target}])`);
          ops.push(S("add_step", { storyId, eventTypeId: et, target: flow ? { edgeId: target } : { nodeId: target }, placement: { sameMomentAs: anchor } }));
        } else {
          ed.run(`scApplyTargets(${et}, [${target}])`);
          ops.push(S("add_step", { storyId, eventTypeId: et, target: flow ? { edgeId: target } : { nodeId: target } }));
        }
      } else if (kind === "wait") {
        const id = any(), ms = pick([0, 250, 1000, 3000, 5000]);
        ed.run(`scSetStepDelay(${id}, ${ms})`);
        ops.push(S("set_wait", { storyId, stepId: id, waitMs: ms }));
      } else if (kind === "dup") {
        const id = any();
        ed.run(`scDuplicateStep(${id})`);
        ops.push(S("duplicate_step", { storyId, stepId: id }));
      } else if (kind === "move") {
        const o = ordered(), idx = Math.floor(rnd() * o.length), dir = rnd() < 0.5 ? -1 : 1, j = idx + dir;
        if (j < 0 || j >= o.length) continue;                       // el editor no lo ofrece en los extremos
        ed.run(`scMoveStep(${o[idx].id}, ${dir})`);
        ops.push(S("move_step", { storyId, stepId: o[idx].id, direction: dir < 0 ? "earlier" : "later" }));
      } else if (kind === "remove") {
        const id = any();
        ed.run(`scDeleteStep(${id})`);
        ops.push(S("remove_step", { storyId, stepId: id }));
      } else {
        const s = pick(cur), flow = s.action === "SEND", target = flow ? pick(edges) : pick(nodes);
        ed.run(`scChangeTarget(scActiveScenario().steps.find(s => s.id === ${s.id})); scUseTarget(${target}, false)`);
        ops.push(S("retarget_step", { storyId, stepId: s.id, target: flow ? { edgeId: target } : { nodeId: target } }));
      }
      const au = apply(base, ops);
      assert.equal(au.ok, true, `secuencia ${seq}, op ${ops.length}: ${JSON.stringify(au.errors)} · ${JSON.stringify(ops[ops.length - 1])}`);
      assert.deepStrictEqual(story(au.project, storyId).steps, steps(), `secuencia ${seq}, tras ${JSON.stringify(ops[ops.length - 1])}`);
      assert.equal(story(au.project, storyId).nextStepId, ed.run("scActiveScenario().nextStepId"));
      compared++;
    }
  }
  assert.ok(compared > 400, `se compararon ${compared} estados`);
});

/* ═══════════════ 2. Lo que nadie puede escribir ═══════════════ */

test("el EventType es la autoridad: no se acepta `action`, `state` ni `at` en un paso (ni dentro de target/placement)", () => {
  const ok = S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4 } });
  assert.equal(apply(simple(), [ok]).ok, true);
  for (const extra of [{ action: "OCCURRENCE" }, { action: "SEND" }, { state: "DOWN" }, { at: 5000 }, { edgeId: 4 }, { nodeId: 2 }, { id: 99 }, { eventType: 1 }]) {
    const r = apply(simple(), [{ ...ok, ...extra }]);
    assert.deepEqual([r.ok, r.errors[0].code], [false, "INVALID_OPERATION"], JSON.stringify(extra));
  }
  assert.equal(apply(simple(), [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4, at: 5 } })]).errors[0].code, "INVALID_OPERATION");
  assert.equal(apply(simple(), [S("add_step", { storyId: 1, eventTypeId: 1, target: { edgeId: 4 }, placement: { sameMomentAs: 1, at: 5 } })]).errors[0].code, "INVALID_OPERATION");
  assert.equal(apply(simple(), [S("move_step", { storyId: 1, stepId: 2, to: { gapIndex: 1, at: 3 } })]).errors[0].code, "INVALID_OPERATION");
});

test("un EventType de otra acción nunca produce el paso «incorrecto»: la acción sale siempre del EventType", () => {
  const spec = { 1: ["SEND", { edgeId: 4 }], 2: ["OCCURRENCE", { nodeId: 2 }], 3: ["SEND", { edgeId: 5 }], 4: ["SET_STATE", { nodeId: 2 }] };
  for (const [et, [action, target]] of Object.entries(spec)) {
    const r = apply(simple(), [S("add_step", { storyId: 1, eventTypeId: Number(et), target })]);
    assert.equal(story(r.project, 1).steps.at(-1).action, action, `EventType ${et}`);
  }
  // SET_STATE hereda el estado del EventType (Caída = DOWN), nunca de la petición.
  assert.equal(story(apply(simple(), [S("add_step", { storyId: 1, eventTypeId: 4, target: { nodeId: 3 } })]).project, 1).steps.at(-1).state, "DOWN");
  assert.equal(story(apply(complex(), [S("add_step", { storyId: 1, eventTypeId: 5, target: { nodeId: 3 } })]).project, 1).steps.at(-1).state, "UP");
});

test("retarget de un SET_STATE conserva su estado; retarget de un SEND conserva EventType y tiempo", () => {
  const r = apply(simple(), [S("retarget_step", { storyId: 2, stepId: 1, target: { nodeId: 3 } })]);
  assert.deepEqual(story(r.project, 2).steps[0], { id: 1, at: 0, action: "SET_STATE", nodeId: 3, state: "DOWN", eventTypeId: 4 });
  const s = apply(simple(), [S("retarget_step", { storyId: 1, stepId: 3, target: { from: 1, to: 2 } })]);
  assert.deepEqual(story(s.project, 1).steps[2], { id: 3, at: 2000, action: "SEND", edgeId: 4, eventTypeId: 3 });
});

test("alcance: toda operación con el alcance contrario se rechaza (matriz completa)", () => {
  const scopeOf = K.call("FluyoAuthoring.OPERATION_SCOPE");
  assert.equal(Object.keys(scopeOf).length, 20);          // 10 de Historia + 7 de página (set_initial_availability · create/update/delete de nodo y conexión, 018.2/018.3) + 3 de EventType (017.3)
  for (const [op, scope] of Object.entries(scopeOf)) {
    const wrong = scope === "story" ? "page" : "story";
    const r = apply(simple(), [{ op, scope: wrong, pageIndex: 0 }]);
    assert.deepEqual([r.ok, r.errors[0].code], [false, "SCOPE_MISMATCH"], op);
    const none = apply(simple(), [{ op, pageIndex: 0 }]);
    assert.equal(none.errors[0].code, "SCOPE_MISMATCH", `${op} sin scope`);
  }
  assert.deepEqual([...new Set(Object.values(scopeOf))].sort(), ["eventType", "page", "story"]);
});

test("no existe ninguna operación de edición libre del diagrama (la estructura solo por create/update/delete de nodo y conexión)", () => {
  const ops = Object.keys(K.call("FluyoAuthoring.OPERATION_SCOPE"));
  for (const forbidden of ["add_edge", "add_node", "update_edge", "remove_node", "move_node", "resize_node", "relayout", "edit_diagram"]) {
    assert.ok(!ops.includes(forbidden), forbidden);
    assert.equal(apply(simple(), [{ op: forbidden, scope: "page", pageIndex: 0 }]).errors[0].code, "UNKNOWN_OPERATION");
  }
});

/* ═══════════════ 3. ids, referencias del lote y límites ═══════════════ */

test("ids irreutilizables: borrar y volver a crear nunca reasigna un id de Historia ni de Step", () => {
  const r = apply(simple(), [S("delete_story", { storyId: 3 }), S("create_story", { ref: "n" }), S("add_step", { storyId: { ref: "n" }, eventTypeId: 1, target: { edgeId: 4 } }), S("remove_step", { storyId: { ref: "n" }, stepId: 1 }), S("add_step", { storyId: { ref: "n" }, eventTypeId: 1, target: { edgeId: 4 } })]);
  assert.equal(r.ok, true);
  assert.deepEqual(pg(r.project).scenarios.map((s) => s.id), [1, 2, 4]);
  assert.deepEqual(story(r.project, 4).steps.map((s) => s.id), [2]);
  assert.equal(story(r.project, 4).nextStepId, 3);
  assert.equal(pg(r.project).nextScenarioId, 5);
  // Encadenado en otro lote: el contador sigue creciendo.
  const again = apply(r.project, [S("create_story")]);
  assert.equal(again.changes[0].entityId, 5);
});

test("referencias del lote: ref de otra página, ref a un paso ya eliminado, ref no declarada y ref sobrescrita", () => {
  const d = complex();
  assert.equal(apply(d, [S("create_story", { ref: "x" }), { ...S("rename_story", { storyId: { ref: "x" }, name: "otra página" }), pageIndex: 1 }]).errors[0].code, "INVALID_OPERATION");
  const gone = apply(d, [S("create_story", { ref: "s" }), S("add_step", { storyId: { ref: "s" }, eventTypeId: 1, target: { edgeId: 5 }, ref: "a" }), S("remove_step", { storyId: { ref: "s" }, stepId: { ref: "a" } }), S("set_wait", { storyId: { ref: "s" }, stepId: { ref: "a" }, waitMs: 1 })]);
  assert.equal(gone.errors[0].code, "STEP_NOT_FOUND");
  assert.equal(apply(d, [S("remove_step", { storyId: 1, stepId: { ref: "nunca" } })]).errors[0].code, "UNKNOWN_REF");
  const over = apply(d, [S("create_story", { ref: "x", name: "uno" }), S("create_story", { ref: "x", name: "dos" }), S("rename_story", { storyId: { ref: "x" }, name: "la segunda" })]);
  assert.deepEqual(pg(over.project).scenarios.slice(-2).map((s) => s.name), ["uno", "la segunda"]);
});

test("límites: 200 operaciones como máximo; 0 es inválido", () => {
  const one = S("create_story");
  assert.equal(apply(simple(), Array.from({ length: 200 }, () => one)).ok, true);
  assert.equal(apply(simple(), Array.from({ length: 201 }, () => one)).errors[0].code, "INVALID_OPERATION");
});

test("la misma Historia editada en páginas distintas con ids repetidos no se confunde", () => {
  const d = complex();                                             // página 0 y página 1 tienen una Historia con id 1
  const r = apply(d, [{ ...S("rename_story", { storyId: 1, name: "Sólo la de la página 2" }), pageIndex: 1 }]);
  assert.equal(story(r.project, 1, 1).name, "Sólo la de la página 2");
  assert.equal(story(r.project, 1, 0).name, "Banco caído desde el inicio");
});

/* ═══════════════ 4. Fuzz de lotes con invariantes ═══════════════ */

test("fuzz (1.200 lotes deterministas): lo aceptado es válido, ejecutable y determinista; lo rechazado no devuelve documento; la entrada no muta", () => {
  let seed = 20261002;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], ri = (n) => Math.floor(rnd() * n);
  const bad = [0, -1, 99, 1.5, "x", null, {}, []];
  const maybe = (good, wrong) => (rnd() < 0.88 ? good : pick(wrong));
  const docs = [simple(), complex()];
  const key = (e) => [e.code, e.pageIndex, e.storyId, e.stepId, e.entityKind, e.entityId].join("|");
  let accepted = 0, rejected = 0;
  for (let i = 0; i < 1200; i++) {
    const doc = J(pick(docs)), before = JSON.stringify(doc);
    const ops = Array.from({ length: 1 + ri(5) }, () => {
      const pi = maybe(ri(doc.doc.pages.length), [9, -1]), page = doc.doc.pages[Math.min(Math.max(pi, 0), doc.doc.pages.length - 1)];
      const sc = pick(page.scenarios);
      const sid = maybe(sc.id, bad), stid = maybe(pick(sc.steps.map((s) => s.id)), bad);
      const et = maybe(pick(doc.doc.eventTypes.map((e) => e.id)), bad), edge = maybe(pick(page.edges.map((e) => e.id)), bad), node = maybe(pick(page.nodes.map((n) => n.id)), bad);
      const target = pick([{ edgeId: edge }, { nodeId: node }, { from: pick(page.nodes).id, to: pick(page.nodes).id }]);
      const kind = pick(["create_story", "rename_story", "duplicate_story", "delete_story", "add_step", "add_step", "add_step", "remove_step", "move_step", "duplicate_step", "retarget_step", "set_wait", "set_wait", "set_initial_availability"]);
      const scope = kind === "set_initial_availability" ? "page" : "story";
      const o = { op: kind, scope, pageIndex: pi };
      if (!["create_story", "set_initial_availability"].includes(kind)) o.storyId = sid;
      if (["remove_step", "move_step", "duplicate_step", "retarget_step", "set_wait"].includes(kind)) o.stepId = stid;
      if (["create_story", "rename_story", "duplicate_story"].includes(kind)) o.name = "N" + ri(50);
      if (kind === "add_step") { o.eventTypeId = et; o.target = target; if (rnd() < 0.3) o.waitMs = pick([0, 500, 1000, 7000]); else if (rnd() < 0.3) o.placement = { sameMomentAs: stid, ...(rnd() < 0.5 ? { position: pick(["before", "after"]) } : {}) }; }
      if (kind === "retarget_step") o.target = target;
      if (kind === "set_wait") o.waitMs = maybe(pick([0, 500, 1000, 2500]), [-5, 1.2, 86400000]);
      if (kind === "move_step") { if (rnd() < 0.5) o.direction = pick(["earlier", "later"]); else o.to = rnd() < 0.5 ? { gapIndex: ri(4) } : { sameMomentAs: stid, after: rnd() < 0.5 }; }
      if (kind === "set_initial_availability") { o.nodeId = node; o.state = pick(["UP", "DOWN"]); }
      return o;
    });
    const r = apply(doc, ops), r2 = apply(doc, ops);
    assert.equal(JSON.stringify(doc), before, `entrada mutada (#${i})`);
    assert.deepStrictEqual(r, r2, `no determinista (#${i})`);
    if (r.ok) {
      accepted++;
      const after = K.call("FluyoIntegrity.validateProject(__a)", r.project), baseV = K.call("FluyoIntegrity.validateProject(__a)", doc);
      const known = new Set(baseV.errors.map(key));
      assert.ok(after.errors.every((e) => known.has(key(e))), `error nuevo tras un lote aceptado (#${i}): ${JSON.stringify(ops)}`);
      for (const t of r.touched) assert.ok(after.stories.find((s) => s.pageIndex === t.pageIndex && s.storyId === t.storyId)?.executable, `Historia tocada no ejecutable (#${i})`);
      assert.equal(r.changes.length, ops.length);
      assert.deepStrictEqual(K.call("FluyoAuthoring.normalizedProject(__a)", r.project).project, r.project, "idempotente");
    } else {
      rejected++;
      assert.equal(r.project, undefined);
      assert.ok(r.errors.length && r.errors.every((e) => e.code && e.message), `rechazo sin código/mensaje (#${i})`);
    }
  }
  assert.ok(accepted > 100 && rejected > 300, `el fuzz debe ejercitar ambos lados (${accepted} aceptados / ${rejected} rechazados)`);
});
