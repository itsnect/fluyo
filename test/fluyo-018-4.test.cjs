"use strict";
/* FLUYO-018.4 — política de borrado del editor: confirmar solo si una Historia usa lo que se borra (mensaje informativo),
   un solo diálogo por borrado, cancelar = cero cambios y cero Undo, el Behavior se va con el nodo y Undo lo restaura;
   nunca se tocan Steps ni Historias; el impacto coincide con el B2 de author_document. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.parse(JSON.stringify(v));
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];

const K = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
for (const f of KERNEL) vm.runInContext(read("js/" + f), K, { filename: f });
const apply = (p, ops) => { K.__in = JSON.stringify({ p, o: ops }); return JSON.parse(vm.runInContext("JSON.stringify((function(){ const a=JSON.parse(__in); return FluyoAuthoring.apply(a.p,a.o); })())", K)); };
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };

/* El editor real, con el kernel que carga index.html (FluyoIntegrity incluido) y un confirm() simulado. */
function editor(answer = true) {
  const asked = [];
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, scheduleAutosave() {}, renderTabs() {}, refreshPanel() {}, selN: new Set(), selE: new Set(), clip: null, GRID: 20,
    confirm(msg) { asked.push(msg); return ctx.answer; } });
  ctx.asked = asked; ctx.answer = answer;
  ctx.run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js"]) ctx.run(read("js/" + f));
  ctx.run(read("js/state.js").split("/* ===================== Viewport")[0]);
  ctx.run(read("js/selection.js"));
  ctx.load = (project) => ctx.run("doc=projectFromProjectData(" + JSON.stringify(project) + ").doc");
  ctx.sel = (nodes, edges = []) => ctx.run(`selN=new Set(${JSON.stringify(nodes)}); selE=new Set(${JSON.stringify(edges)});`);
  ctx.state = () => ctx.run("JSON.stringify(serializeProject())");
  return ctx;
}

const page = () => ({ name: "Página 1", nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
const project = () => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: [page()], cur: 0 }, settings: {} });
const N = (ref, label, x, y) => ({ op: "create_node", scope: "page", pageIndex: 0, ref, spec: { shape: "rect", x, y, label } });
const C = (ref, source, target, label) => ({ op: "create_connection", scope: "page", pageIndex: 0, ref, source: { ref: source }, target: { ref: target }, spec: { label } });
const ET = (ref, primitive, sentence) => ({ op: "create_event_type", scope: "eventType", name: ref, primitive, sentence, ref });
const STORY = (name, ref) => ({ op: "create_story", scope: "story", pageIndex: 0, name, ref });
const STEP = (story, et, target, extra = {}) => Object.assign({ op: "add_step", scope: "story", pageIndex: 0, storyId: { ref: story }, eventTypeId: { ref: et }, target }, extra);
const DN = (id) => ({ op: "delete_node", scope: "page", pageIndex: 0, node: { id } });
const DC = (id) => ({ op: "delete_connection", scope: "page", pageIndex: 0, connection: { id } });

/* Cliente(1) Comercio(2) Banco(3) Aparte(4, sin uso); pago 5 (1→2), cobro 6 (2→3), reembolso 7 (3→1); Banco DOWN.
   «Compra»: pago, cobro (momentos distintos) y aviso sobre Banco. «Reembolsos»: reembolso. */
function fixture() {
  return ok(apply(project(), [
    N("c", "Cliente", 100, 100), N("m", "Comercio", 400, 100), N("b", "Banco", 700, 100), N("x", "Aparte", 100, 400),
    C("pago", "c", "m", "Pago"), C("cobro", "m", "b", "Cobro"), C("reem", "b", "c", "Reembolso"),
    ET("Pago", "FLOW", "{source} paga a {target}"), ET("Aviso", "OCCURRENCE", "{target} avisa"),
    STORY("Compra", "s1"), STORY("Reembolsos", "s2"), STORY("Sin uso", "s3"),
    STEP("s1", "Pago", { edgeId: 5 }), STEP("s1", "Pago", { edgeId: 6 }), STEP("s1", "Aviso", { nodeId: 3 }),
    STEP("s2", "Pago", { edgeId: 7 }),
    { op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: 3, state: "DOWN" },
  ])).project;
}
const base = fixture;   // «Sin uso» (vacía) es la Historia que ningún borrado de estos tests afecta

test("sin Historias afectadas: se borra al instante, sin diálogo (un nodo sin uso con Historias en la página)", () => {
  const E = editor(); E.load(base());
  E.sel([4]); E.run("deleteSel()");
  assert.equal(E.asked.length, 0);
  assert.equal(E.run("nodeById(4)"), undefined);
  assert.equal(E.run("undoStack.length"), 1);
});

test("página sin Historias: se borra sin diálogo (y sin simular nada)", () => {
  const p = ok(apply(project(), [N("a", "A", 0, 0), N("b", "B", 100, 0), C("k", "a", "b", "K")])).project;
  const E = editor(); E.load(p);
  E.sel([1]); E.run("deleteSel()");
  assert.equal(E.asked.length, 0);
  assert.equal(E.run("P().nodes.length"), 1);
  assert.equal(E.run("P().edges.length"), 0);
});

test("un nodo con Behavior pero sin Historia afectada: sin diálogo y el Behavior se va con el nodo", () => {
  const p = ok(apply(project(), [N("a", "A", 0, 0), N("b", "B", 100, 0), { op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: 2, state: "DOWN" }])).project;
  const E = editor(); E.load(p);
  E.sel([2]); E.run("deleteSel()");
  assert.equal(E.asked.length, 0);
  assert.equal(E.run("P().behaviors.length"), 0);
});

test("con impacto: un solo diálogo con Historias, momentos, destinos y la condición de disponibilidad (nodo con Behavior)", () => {
  const E = editor(); E.load(base());
  E.sel([3]); E.run("deleteSel()");
  assert.equal(E.asked.length, 1);
  const msg = E.asked[0];
  assert.match(msg, /^Este elemento se usa en 2 Historias:\n\n/);
  assert.match(msg, /• Compra — 2 momentos \(Comercio → Banco, Banco\)/);
  assert.match(msg, /• Reembolsos — 1 momento \(Banco → Cliente\)/);
  assert.match(msg, /Si lo eliminas, esos momentos dejarán de funcionar\./);
  assert.match(msg, /También se eliminará su condición de disponibilidad inicial\./);
  assert.match(msg, /¿Quieres eliminarlo de todas formas\?$/);
  assert.ok(!msg.includes("Sin uso"), "una Historia que no lo usa no se nombra");
});

test("cancelar: cero cambios, cero Undo, la selección se conserva", () => {
  const E = editor(false); E.load(base());
  const before = E.state();
  E.sel([3]); E.run("deleteSel()");
  assert.equal(E.asked.length, 1);
  assert.equal(E.state(), before);
  assert.equal(E.run("undoStack.length"), 0);
  assert.equal(E.run("redoStack.length"), 0);
  assert.equal(E.run("selN.has(3)"), true);
});

test("confirmar: un único Undo; Steps e Historias intactos; el Behavior se va con el nodo; Undo lo restaura todo y Redo no vuelve a preguntar", () => {
  const E = editor(true); E.load(base());
  const before = E.state();
  const scenariosBefore = E.run("JSON.stringify(P().scenarios)");
  E.sel([3]); E.run("deleteSel()");
  assert.equal(E.run("undoStack.length"), 1);
  assert.equal(E.run("nodeById(3)"), undefined);
  assert.equal(E.run("P().behaviors.length"), 0);
  assert.equal(E.run("JSON.stringify(P().scenarios)"), scenariosBefore, "nada de limpieza silenciosa de Historias");
  assert.equal(E.run("P().edges.length"), 1, "las conexiones incidentes se van con el nodo");
  E.run("undo()");
  assert.equal(E.state(), before);
  E.run("redo()");
  assert.equal(E.asked.length, 1, "Redo restaura un snapshot: no pregunta");
  assert.equal(E.run("P().behaviors.length"), 0);
  E.run("undo()");
  assert.equal(E.state(), before);
});

test("tras confirmar, solo falla la Historia afectada; las demás de la página siguen ejecutándose (el Behavior ya no las rompe)", () => {
  const E = editor(true); E.load(base());
  E.sel([3]); E.run("deleteSel()");
  const out = JSON.parse(E.run(`JSON.stringify(P().scenarios.map(sc=>({n:sc.name, ok:FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},P().behaviors,sc).ok})))`));
  assert.deepEqual(out, [{ n: "Compra", ok: false }, { n: "Reembolsos", ok: false }, { n: "Sin uso", ok: true }]);
});

test("una conexión usada: mensaje en femenino/singular y solo cuenta sus Historias", () => {
  const E = editor(true); E.load(base());
  E.sel([], [7]); E.run("deleteSel()");
  assert.match(E.asked[0], /^Esta conexión se usa en 1 Historia:\n\n• Reembolsos — 1 momento \(Banco → Cliente\)\n\nSi la eliminas, ese momento dejará de funcionar\.\n¿Quieres eliminarla de todas formas\?$/);
  assert.doesNotMatch(E.asked[0], /disponibilidad/);
});

test("selección múltiple: un solo diálogo para todo el borrado, con las conexiones en cascada", () => {
  const E = editor(true); E.load(base());
  E.sel([1, 2], [6]); E.run("deleteSel()");
  assert.equal(E.asked.length, 1);
  assert.match(E.asked[0], /^Esta selección se usa en 2 Historias:/);
  assert.match(E.asked[0], /Si los eliminas/);
  assert.match(E.asked[0], /¿Quieres eliminarlos de todas formas\?$/);
  assert.equal(E.run("undoStack.length"), 1);
});

test("Cortar pasa por la misma puerta: cancelar conserva los elementos", () => {
  const E = editor(false); E.load(base());
  E.sel([3]); E.run("cutSel()");
  assert.equal(E.asked.length, 1);
  assert.notEqual(E.run("nodeById(3)"), undefined);
  assert.equal(E.run("undoStack.length"), 0);
});

test("una Historia ya inválida antes del borrado no se atribuye al borrado", () => {
  const p = base();
  p.doc.pages[0].scenarios[2].steps = [{ id: 1, at: 0, action: "SEND", edgeId: 6, eventTypeId: 1 }];
  p.doc.pages[0].scenarios[2].nextStepId = 2;
  p.doc.pages[0].edges = p.doc.pages[0].edges.filter((e) => e.id !== 6);        // «Sin uso» apunta a una conexión inexistente
  const E = editor(true); E.load(p);
  E.sel([4]); E.run("deleteSel()");
  assert.equal(E.asked.length, 0);
});

test("PARIDAD con MCP: el editor nombra exactamente las Historias y los momentos que el B2 de author_document rechaza", () => {
  for (const [sel, op] of [[{ n: [3], e: [] }, DN(3)], [{ n: [2], e: [] }, DN(2)], [{ n: [], e: [5] }, DC(5)], [{ n: [1], e: [] }, DN(1)], [{ n: [4], e: [] }, DN(4)]]) {
    const start = base();
    const r = apply(start, [op]);
    const mcp = r.ok ? [] : r.errors.filter((e) => e.code === "REFERENCED_ENTITY").flatMap((e) => e.affectedStories.map((s) => s.storyName + ":" + [...s.stepIds].sort().join(",")));
    const E = editor(true); E.load(start);
    const imp = JSON.parse(E.run(`JSON.stringify(deleteImpact(${JSON.stringify(sel.n)}, ${JSON.stringify(sel.e)}))`));
    const ed = imp.stories.map((s) => s.name);
    const mcpNames = [...new Set(mcp.map((x) => x.split(":")[0]))];
    assert.deepEqual([...ed].sort(), mcpNames.sort(), JSON.stringify(op));
  }
});

test("el diálogo se pide antes de pushUndo; la tecla Supr conserva su guarda de Playback", () => {
  const src = read("js/interaction.js");
  assert.match(src, /isScenarioPlaybackActive\(\)\) deleteSel\(\)/);
  const sel = read("js/selection.js");
  const body = sel.slice(sel.indexOf("function deleteSel()"));
  assert.ok(body.indexOf("confirm(deleteConfirmMessage") < body.indexOf("pushUndo()"), "confirmar antes del pushUndo");
});

test("el editor carga FluyoIntegrity y el service worker lo precachea", () => {
  const html = read("index.html");
  assert.ok(html.indexOf("js/story-playback.js") < html.indexOf("js/document-integrity.js"));
  assert.ok(html.indexOf("js/document-integrity.js") < html.indexOf("js/editor-scenarios.js"));
  assert.match(read("sw.js"), /"\.\/js\/document-integrity\.js"/);
});

/* ─────────── Playback: el documento está congelado para borrar y cortar, sea cual sea la vía ─────────── */
function frozenEditor(status) {
  const E = editor(true); E.load(base());
  E.run(`var scStatus=${JSON.stringify(status)}; function isScenarioPlaybackActive(){ return scStatus==="running" || scStatus==="completed"; }`);
  return E;
}
for (const status of ["running", "completed"]) {
  test(`Playback «${status}»: deleteSel y cutSel no actúan (sin confirm, sin Undo, documento y selección intactos), con y sin impacto`, () => {
    const E = frozenEditor(status);
    const before = E.state();
    for (const [n, e] of [[[3], []], [[4], []], [[], [7]], [[1, 2], [6]]]) {
      E.sel(n, e); E.run("deleteSel()"); E.run("cutSel()");
      assert.equal(E.state(), before);
      assert.equal(E.asked.length, 0, "no se abre el confirm");
      assert.equal(E.run("undoStack.length"), 0, "no se registra Undo");
      assert.equal(E.run("selN.size+selE.size"), n.length + e.length, "la selección se conserva");
      assert.equal(E.run("clip"), null, "Cortar tampoco copia al portapapeles interno");
    }
  });
}
test("al terminar el Playback («Volver a editar» → idle) borrar y cortar vuelven a funcionar con la misma política", () => {
  const E = frozenEditor("completed");
  E.sel([4]); E.run("deleteSel()");
  assert.notEqual(E.run("nodeById(4)"), undefined);
  E.run("scStatus='idle'");
  E.run("deleteSel()");                                    // nodo sin uso: inmediato
  assert.equal(E.run("nodeById(4)"), undefined);
  E.sel([3]); E.run("cutSel()");                           // con impacto: confirma y corta
  assert.equal(E.asked.length, 1);
  assert.equal(E.run("nodeById(3)"), undefined);
  assert.equal(E.run("clip.nodes.length"), 1);
});
test("las cuatro vías de borrado (Supr, botón del panel, menú contextual, papelera táctil) y Ctrl+X llaman a la misma puerta", () => {
  const ui = read("js/ui.js"), inter = read("js/interaction.js");
  for (const id of ["btnDel", "mDel", "btnDelTouch"]) assert.match(ui, new RegExp("\\$\\(\"" + id + "\"\\)\\.onclick=deleteSel;"));
  assert.match(inter, /ev\.key==="Delete"\|\|ev\.key==="Backspace"/);
  assert.match(read("js/selection.js"), /function cutSel\(\)\{ if\(editorFrozen\(\)\) return; copySel\(\); deleteSel\(\); \}/);
  assert.match(read("js/selection.js"), /function deleteSel\(\)\{\n?\r?\n?\s*if\(editorFrozen\(\)/);
});
