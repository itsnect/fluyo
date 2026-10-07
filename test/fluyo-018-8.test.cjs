"use strict";
/* FLUYO-018.8 — «Añadir como página» importa los EventTypes de las páginas entrantes.

   Antes de 018.8, appendPagesFrom (state.js) enganchaba `nd.pages` SIN su biblioteca (`nd.eventTypes` se descartaba): los Steps
   conservaban sus `eventTypeId` y se resolvían contra la biblioteca del RECEPTOR → Historia inválida (id inexistente / otra
   primitiva) o, peor, válida y reproducida con el EventType equivocado (misma primitiva). Este archivo FALLA sobre ese código.

   Dominio: importPagesIn(d, incoming) (model.js), única autoridad. Editor: appendPagesFrom la llama, activa la primera página
   añadida y vacía Undo/Redo (D3). Kernel real (FluyoAuthoring) para construir los documentos; editor real completo (state.js entero)
   para el flujo de documento entrante. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { kernel, read, J, page, project } = require("./fluyo-018-7c-harness.cjs");
const { fullEditor, FINGERPRINT } = require("./fluyo-018-8-harness.cjs");

const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return J(r.project); };
const N = (pi, ref, x, label) => ({ op: "create_node", scope: "page", pageIndex: pi, spec: { shape: "rect", x, y: 0, label }, ref });
const C = (pi, s, t, ref) => ({ op: "create_connection", scope: "page", pageIndex: pi, source: { ref: s }, target: { ref: t }, ref });
const ET = (ref, name, primitive, sentence, symbol, extra = {}) => ({ op: "create_event_type", scope: "eventType", name, primitive, sentence, symbol, ref, ...extra });
const STORY = (pi, name, ref) => ({ op: "create_story", scope: "story", pageIndex: pi, name, ref });
const SEND = (pi, s, et, edge) => ({ op: "add_step", scope: "story", pageIndex: pi, storyId: { ref: s }, eventTypeId: { ref: et }, target: { edgeId: { ref: edge } } });
const ON = (pi, s, et, node) => ({ op: "add_step", scope: "story", pageIndex: pi, storyId: { ref: s }, eventTypeId: { ref: et }, target: { nodeId: { ref: node } } });
const withNext = (p, n) => { p.doc.nextEventTypeId = n; return p; };

/* Receptor: «Caja» con «Pago» (FLOW, id 1) y «Aviso» (OCCURRENCE, id 2); Historia «Cobro». Tema y ajustes propios. */
function receptor(nextEt = 1) {
  const p = withNext(project([page("Caja")]), nextEt);
  p.doc.theme = "crema"; p.doc.customBg = "#123456"; p.settings = { speed: 1.5, dots: 4, build: true, stagger: 0.8, grid: false, snap: true, single: true };
  return ok(apply(p, [
    N(0, "cl", 0, "Cliente"), N(0, "bc", 300, "Banco"), C(0, "cl", "bc", "e"),
    ET("pago", "Pago", "FLOW", "{source} paga a {target}", "💵", { motion: "fast" }),
    ET("aviso", "Aviso", "OCCURRENCE", "{target} avisa", "⚠"),
    STORY(0, "Cobro", "s"), SEND(0, "s", "pago", "e"), ON(0, "s", "aviso", "bc"),
  ]));
}
/* Entrante con «Reembolso»: MISMA primitiva (FLOW) e id que «Pago» del receptor. Es el fallo silencioso. */
function reembolso(nextEt = 1) {
  return ok(apply(withNext(project([page("Devoluciones")]), nextEt), [
    N(0, "ti", 0, "Tienda"), N(0, "cl", 300, "Cliente"), C(0, "ti", "cl", "e"),
    ET("re", "Reembolso", "FLOW", "{source} devuelve el dinero a {target}", "↩", { motion: "slow" }),
    STORY(0, "Devolución", "s"), SEND(0, "s", "re", "e"),
  ]));
}
/* Entrante con «Alerta» (OCCURRENCE). Con nextEt=5 su id (5) no existe en el receptor; con 1, colisiona con «Pago» (FLOW). */
function alerta(nextEt) {
  return ok(apply(withNext(project([page("Monitor")]), nextEt), [
    N(0, "sv", 0, "Servidor"), ET("al", "Alerta", "OCCURRENCE", "{target} lanza una alerta", "🚨"),
    STORY(0, "Incidencia", "s"), ON(0, "s", "al", "sv"),
  ]));
}
/* Entrante de dos páginas: «Reembolso» lo usan varias Historias de ambas páginas; «Libre» no lo usa nadie. */
function multi() {
  return ok(apply(project([page("Almacén")]), [
    { op: "create_page", scope: "document", name: "Envío" },
    N(0, "a", 0, "Almacén"), N(0, "b", 300, "Cliente"), C(0, "a", "b", "e0"),
    N(1, "c", 0, "Courier"), N(1, "d", 300, "Casa"), C(1, "c", "d", "e1"),
    ET("re", "Reembolso", "FLOW", "{source} devuelve a {target}", "↩", { motion: "slow" }),
    ET("al", "Alerta", "OCCURRENCE", "{target} alerta", "🚨"),
    ET("li", "Libre", "OCCURRENCE", "{target} libre", "·"),
    ET("ca", "Caída", "SET_AVAILABILITY", "{target} cae", "⛔", { availability: "DOWN" }),
    STORY(0, "S1", "s1"), SEND(0, "s1", "re", "e0"), SEND(0, "s1", "re", "e0"), ON(0, "s1", "al", "b"),
    STORY(0, "S2", "s2"), SEND(0, "s2", "re", "e0"), ON(0, "s2", "ca", "a"),
    STORY(1, "S3", "s3"), SEND(1, "s3", "re", "e1"), ON(1, "s3", "al", "d"),
  ]));
}

const R = receptor();
const valid = (p) => K.call("FluyoIntegrity.validateProject(__a)", p);
const asProject = (d, settings = {}) => ({ version: 5, app: "fluyo", doc: d, settings });
const fingerprint = (d, pi) => K.call(`${FINGERPRINT}(__a.d, __a.pi)`, { d, pi });
const libNames = (d) => d.eventTypes.map((e) => e.id + ":" + e.name + ":" + e.primitive);
const withoutId = (et) => { const c = J(et); delete c.id; return c; };
const normalizedDoc = (p) => K.call("projectFromProjectData(__a).doc", p);

/* Dominio sobre una copia normalizada del receptor (sin editor). */
const importDomain = (r, inc) => K.call("(function(){ const d=projectFromProjectData(__a.r).doc, inc=documentFromProjectData(__a.i); const res=importPagesIn(d, inc); return {d, res}; })()", { r, i: inc });

/* Editor real: el receptor está abierto; se añade el entrante como lo hace «Añadir el diagrama como página nueva». */
function editorAppend(r, inc) {
  const E = fullEditor(); E.load(r);
  E.run("appendPagesFrom(" + JSON.stringify(inc) + ")");
  return E;
}
/* Comprobaciones de «la Historia importada mantiene exactamente su semántica» para TODAS las páginas importadas. */
function assertImportedSemantics(d, inc, firstIndex, label = "") {
  const src = normalizedDoc(inc);
  src.pages.forEach((_, k) => assert.deepEqual(fingerprint(d, firstIndex + k), fingerprint(src, k), `${label} página importada ${k}: misma semántica (EventType, frase, metadata de Playback y Trace)`));
}

/* ───────────────────────────── Regresión de la auditoría (bug reproducido) ───────────────────────────── */

test("BUG (auditoría): «Reembolso» (FLOW, id 1) añadido junto a «Pago» (FLOW, id 1) se reproducía como «Pago» — ahora se reproduce «Reembolso»", () => {
  const E = editorAppend(R, reembolso());
  const d = E.docOf();
  assert.equal(valid(asProject(d)).valid, true);
  const step = d.pages[1].scenarios[0].steps[0];
  const et = d.eventTypes.find((e) => e.id === step.eventTypeId);
  assert.equal(et.name, "Reembolso", "el paso importado apunta a «Reembolso»");
  const meta = E.run(`JSON.stringify(FluyoStory.stepMeta(doc.pages[1].scenarios[0].steps))`);
  assert.deepEqual(Object.values(JSON.parse(meta)).map((m) => [m.name, m.token, m.motion]), [["Reembolso", "↩", "slow"]], "Playback (stepMeta) ejecuta «Reembolso», no «Pago»");
  assert.equal(E.run(`FluyoStory.sentence(doc.pages[1], doc.pages[1].scenarios[0].steps[0], eventTypeById(doc.pages[1].scenarios[0].steps[0].eventTypeId))`), "Tienda devuelve el dinero a Cliente");
  assertImportedSemantics(d, reembolso(), 1);
});

test("BUG (auditoría): «Alerta» (OCCURRENCE, id 1) añadido junto a «Pago» (FLOW, id 1) dejaba la Historia inválida — ahora es válida y conserva «Alerta»", () => {
  const d = editorAppend(R, alerta(1)).docOf();
  const v = valid(asProject(d));
  assert.equal(v.valid, true, JSON.stringify(v.errors));
  assert.deepEqual(libNames(d), ["1:Pago:FLOW", "2:Aviso:OCCURRENCE", "3:Alerta:OCCURRENCE"]);
  assertImportedSemantics(d, alerta(1), 1);
});

/* ───────────────────────────── Casos obligatorios ───────────────────────────── */

test("Caso 1 — sin colisión: B entra como EventType NUEVO (id nuevo), el Step apunta a él, A intacto y la Historia conserva su semántica", () => {
  const inc = alerta(5);
  assert.equal(inc.doc.eventTypes[0].id, 5, "precondición: el id de B no existe en el receptor");
  const { d, res } = importDomain(R, inc);
  assert.deepEqual(libNames(d), ["1:Pago:FLOW", "2:Aviso:OCCURRENCE", "3:Alerta:OCCURRENCE"], "B recibe un id nuevo del receptor (D2: siempre nuevos)");
  assert.deepEqual(res.eventTypes, [{ from: 5, to: 3 }]);
  assert.deepEqual(withoutId(d.eventTypes[2]), withoutId(inc.doc.eventTypes[0]), "contenido de B idéntico salvo el id");
  assert.deepEqual(d.pages[1].scenarios[0].steps.map((s) => s.eventTypeId), [3]);
  assert.deepEqual(d.eventTypes.slice(0, 2), normalizedDoc(R).eventTypes, "A (y el resto de la biblioteca del receptor) intactos");
  assert.equal(d.nextEventTypeId, 4);
  assertImportedSemantics(d, inc, 1);
  assert.equal(valid(asProject(d)).valid, true);
});

test("Caso 2 — colisión de ids: el EventType del receptor NO se sobrescribe; el importado recibe otro id y sus Steps lo siguen", () => {
  const inc = alerta(1);
  assert.equal(inc.doc.eventTypes[0].id, R.doc.eventTypes[0].id, "precondición: mismo eventTypeId");
  const { d, res } = importDomain(R, inc);
  assert.deepEqual(d.eventTypes[0], normalizedDoc(R).eventTypes[0], "«Pago» (id 1) intacto");
  assert.deepEqual(res.eventTypes, [{ from: 1, to: 3 }]);
  assert.equal(d.eventTypes.filter((e) => e.id === 1).length, 1, "ids únicos");
  assert.deepEqual(d.pages[1].scenarios[0].steps.map((s) => s.eventTypeId), [3]);
  assert.deepEqual(d.pages[0].scenarios[0].steps.map((s) => s.eventTypeId), [1, 2], "los Steps del receptor no cambian");
  assertImportedSemantics(d, inc, 1);
  assert.equal(valid(asProject(d)).valid, true);
});

test("Caso 3 — misma primitiva, ids distintos tras importar: Playback ejecuta «Reembolso» y la página del receptor sigue ejecutando «Pago»", () => {
  const { d } = importDomain(R, reembolso());
  const imported = fingerprint(d, 1)[0].steps[0], own = fingerprint(d, 0)[0].steps[0];
  assert.deepEqual([imported.meta.name, imported.meta.token, imported.meta.motion, imported.sentence], ["Reembolso", "↩", "slow", "Tienda devuelve el dinero a Cliente"]);
  assert.deepEqual([own.meta.name, own.meta.token, own.meta.motion, own.sentence], ["Pago", "💵", "fast", "Cliente paga a Banco"]);
  assert.deepEqual(fingerprint(d, 0), fingerprint(normalizedDoc(R), 0), "la Historia del receptor no cambia");
  assertImportedSemantics(d, reembolso(), 1);
  // también con ids de origen distintos de los del receptor y con la misma primitiva
  const { d: d2 } = importDomain(R, reembolso(7));
  assertImportedSemantics(d2, reembolso(7), 1);
});

test("Caso 4 — un EventType usado por varias Historias: todas apuntan al MISMO EventType importado (una sola copia)", () => {
  const inc = multi(), { d, res } = importDomain(R, inc);
  const reId = res.eventTypes.find((m) => m.from === 1).to;
  const uses = d.pages.slice(1).flatMap((pg) => pg.scenarios.flatMap((sc) => sc.steps.filter((s) => s.action === "SEND").map((s) => s.eventTypeId)));
  assert.deepEqual(uses, [reId, reId, reId, reId], "S1 (×2), S2 y S3 → el mismo id");
  assert.equal(d.eventTypes.filter((e) => e.name === "Reembolso").length, 1, "no se duplica por Historia");
  assertImportedSemantics(d, inc, 1);
});

test("Caso 5 — EventTypes sin uso del entrante: se importan (vocabulario del documento, decisión 67/103), con id nuevo y en su orden", () => {
  const inc = multi(), { d, res } = importDomain(R, inc);
  assert.deepEqual(libNames(d), ["1:Pago:FLOW", "2:Aviso:OCCURRENCE", "3:Reembolso:FLOW", "4:Alerta:OCCURRENCE", "5:Libre:OCCURRENCE", "6:Caída:SET_AVAILABILITY"]);
  assert.deepEqual(res.eventTypes, [{ from: 1, to: 3 }, { from: 2, to: 4 }, { from: 3, to: 5 }, { from: 4, to: 6 }]);
  assert.deepEqual(d.eventTypes.slice(2).map(withoutId), normalizedDoc(inc).eventTypes.map(withoutId), "la biblioteca entrante entra completa y sin cambios salvo los ids");
  assert.equal(K.call("eventTypeUseCountIn(__a, 5)", d), 0, "«Libre» sigue sin uso");
  assert.equal(d.nextEventTypeId, 7);
});

test("Caso 6 — varias páginas que comparten EventTypes: un EventType por EventType de origen (no por página) y referencias compartidas", () => {
  const inc = multi(), { d, res } = importDomain(R, inc);
  assert.equal(res.pageIndex, 1);
  assert.deepEqual(d.pages.map((p) => p.name), ["Caja", "Almacén", "Envío"]);
  const ids = (pi) => d.pages[pi].scenarios.flatMap((sc) => sc.steps.map((s) => s.eventTypeId));
  assert.deepEqual(ids(1), [3, 3, 4, 3, 6]);
  assert.deepEqual(ids(2), [3, 4], "la página 2 comparte «Reembolso» (3) y «Alerta» (4) con la 1");
  assert.equal(d.eventTypes.length, 6);
  assertImportedSemantics(d, inc, 1);
  assert.equal(valid(asProject(d)).valid, true);
  assert.equal(d.cur, normalizedDoc(R).cur, "el dominio no navega (como createPageIn)");
});

test("Caso 7 — Undo/Redo: tras añadir páginas ambas pilas quedan vacías; Undo y Redo no restauran ningún estado anterior (interacción con la decisión 107)", () => {
  const E = fullEditor(); E.load(R);
  E.run(`pushUndo(); P().nodes[0].label="editado 1"; pushUndo(); P().nodes[0].label="editado 2"; undo();`);   // undo y redo con entradas
  assert.deepEqual([E.run("undoStack.length"), E.run("redoStack.length")], [1, 1], "precondición: hay historial en ambas pilas");
  E.run("appendPagesFrom(" + JSON.stringify(multi()) + ")");
  assert.deepEqual([E.run("undoStack.length"), E.run("redoStack.length")], [0, 0], "D3: ambas pilas vacías");
  const after = E.docOf();
  E.run("undo()"); assert.deepEqual(E.docOf(), after, "Undo no restaura nada (ni la página ni la biblioteca sin los importados)");
  E.run("redo()"); assert.deepEqual(E.docOf(), after, "Redo no restaura nada");
  assert.equal(valid(asProject(after)).valid, true);
  // Las acciones POSTERIORES sí se deshacen, y su entrada (decisión 107) ya lleva la biblioteca con los importados
  E.run(`doc.cur=1; pushUndo(); P().nodes[0].label="tras importar";`);
  E.run("undo()");
  assert.deepEqual(E.docOf(), after, "Undo de una edición posterior vuelve exactamente al estado tras importar");
  assert.equal(valid(asProject(E.docOf())).valid, true, "y la biblioteca conserva los EventTypes importados");
  E.run("redo()"); assert.equal(E.run("doc.pages[1].nodes[0].label"), "tras importar");
});

test("Caso 7b — sin vaciar las pilas, un Undo anterior restauraría la biblioteca SIN los importados (lo que D3 evita)", () => {
  /* Reproduce lo que haría la entrada previa si sobreviviera: su `lib` es la biblioteca de antes de importar. */
  const E = fullEditor(); E.load(R);
  E.run(`pushUndo(); P().nodes[0].label="antes"; __old=undoStack.slice();`);
  E.run("appendPagesFrom(" + JSON.stringify(reembolso()) + ")");
  E.run("undoStack.push(...__old); undo();");
  const v = valid(asProject(E.docOf()));
  assert.equal(v.valid, false, "precondición del riesgo: la entrada antigua deja Steps colgando");
  assert.ok(v.errors.some((e) => e.code === "missing_event_type" && e.pageIndex === 1));
});

test("Caso 8 — documento entrante SIN EventTypes: resultado idéntico al de antes de 018.8 (páginas, biblioteca y contador sin tocar)", () => {
  const legacy = project([{ name: "Legado", nodes: [{ id: 1, shape: "rect", x: 0, y: 0, w: 120, h: 60, label: "A" }, { id: 2, shape: "rect", x: 300, y: 0, w: 120, h: 60, label: "B" }],
    edges: [{ id: 3, from: 1, to: 2 }], nextId: 4, behaviors: [{ nodeId: 2, initialState: "UP" }],
    scenarios: [{ id: 1, engineVersion: 1, name: "Antigua", nextStepId: 3, steps: [{ id: 1, at: 0, action: "SEND", edgeId: 3 }, { id: 2, at: 900, action: "SET_STATE", nodeId: 2, state: "DOWN" }] }], nextScenarioId: 2 }]);
  const E = editorAppend(R, legacy), d = E.docOf();
  const before = K.call("(function(){ const d=projectFromProjectData(__a.r).doc, nd=documentFromProjectData(__a.i); const first=d.pages.length; d.pages.push(...nd.pages); d.cur=first; return d; })()", { r: R, i: legacy });
  assert.deepEqual(d, before, "mismo documento que el appendPagesFrom anterior");
  assert.equal(valid(asProject(d)).valid, true);
  assert.deepEqual(J(d.pages[1].scenarios[0].steps), normalizedDoc(legacy).pages[0].scenarios[0].steps, "Steps sin eventTypeId intactos");
  // y la entrada mínima que usa la batería de telemetría
  const E2 = fullEditor(); E2.load(R);
  E2.run(`appendPagesFrom({doc:{pages:[blankPage("Otra")]}})`);
  assert.deepEqual([E2.run("doc.pages.length"), E2.run("doc.cur"), E2.run("doc.eventTypes.length"), E2.run("doc.nextEventTypeId")], [2, 1, 2, 3]);
});

test("Caso 9 — receptor SIN EventTypes: se crea la biblioteca necesaria y las Historias se reproducen", () => {
  const empty = ok(apply(project([page("Vacía")]), [N(0, "x", 0, "X")]));
  assert.deepEqual(empty.doc.eventTypes, []);
  const E = editorAppend(empty, multi()), d = E.docOf();
  assert.deepEqual(libNames(d), ["1:Reembolso:FLOW", "2:Alerta:OCCURRENCE", "3:Libre:OCCURRENCE", "4:Caída:SET_AVAILABILITY"]);
  assert.equal(d.nextEventTypeId, 5);
  assertImportedSemantics(d, multi(), 1);
  assert.equal(valid(asProject(d)).valid, true);
  for (const [pi, si] of [[1, 0], [1, 1], [2, 0]]) {
    const r = E.run(`(function(){ const pg=doc.pages[${pi}], sc=pg.scenarios[${si}], st=FluyoStory.start(pg, sc, 0); return st.ok && st.playback.trace.events.length>0; })()`);
    assert.equal(r, true, `Historia ${pi}/${si} se reproduce`);
  }
});

test("Caso 10 (integración en vm) — Share → Viewer → «Abrir en Fluyo» → «Añadir como página»: la Historia compartida se reproduce con su EventType de origen", async () => {
  /* Autor: comparte la Historia «Devolución» (enlace /s/#d= con el mismo payload que el Viewer reenvía a «Abrir en Fluyo»). */
  const author = fullEditor(); author.load(reembolso());
  const url = await author.callAsync(`createShareUrl(serializeProject(), "https://fluyo.space/", {kind:"story", scenarioId: doc.pages[0].scenarios[0].id})`);
  const payload = /#d=([A-Za-z0-9_-]+)$/.exec(url)[1];
  /* Destinatario: tiene una sesión guardada (receptor) → el modal pregunta → «Añadir el diagrama como página nueva». */
  const E = fullEditor({ stored: R });
  const incoming = await E.callAsync(`decodeDeepLink(__a)`, payload);
  E.run(`presentIncomingDocument(${JSON.stringify(incoming)}, {titulo:"t", abrirLabel:"a", paginaLabel:"p", onResuelto:e=>{ __eleccion=e; }})`);
  assert.equal(E.elements.incomingModal.style.display, "flex", "hay sesión: se pregunta");
  E.run("incomingAsNewPage()");
  assert.equal(E.run("__eleccion"), "page");
  const d = E.docOf();
  assert.deepEqual(d.pages.map((p) => p.name), ["Caja", "Devoluciones"]);
  assert.equal(d.cur, 1, "se activa la página añadida");
  assert.equal(valid(asProject(d)).valid, true);
  const meta = JSON.parse(E.run(`JSON.stringify(Object.values(FluyoStory.stepMeta(P().scenarios[0].steps)))`));
  assert.deepEqual(meta.map((m) => [m.name, m.token]), [["Reembolso", "↩"]]);
  assert.equal(E.run(`FluyoStory.start(P(), P().scenarios[0], 0).ok`), true);
  assertImportedSemantics(d, incoming, 1);
  assert.deepEqual([E.run("undoStack.length"), E.run("redoStack.length")], [0, 0]);
  /* El autoguardado escribe el documento combinado: recargar lo conserva, válido. */
  const saved = E.stored();
  assert.deepEqual(saved.doc, d);
  assert.equal(valid(saved).valid, true);
  /* «Abrir el diagrama y descartar la sesión» no cambia: el documento compartido tal cual. */
  const O = fullEditor({ stored: R });
  O.run(`presentIncomingDocument(${JSON.stringify(incoming)}, {titulo:"t", abrirLabel:"a", paginaLabel:"p"}); incomingOpen();`);
  assert.deepEqual(O.docOf(), normalizedDoc(incoming));
});

/* ───────────────────────────── Contrato del dominio ───────────────────────────── */

test("D4 — documento entrante ya inválido: un Step hacia un EventType que su documento no define NO se repara ni se resuelve contra el receptor", () => {
  /* Receptor con «Pago» en id 9; el entrante tiene un Step SEND con eventTypeId 9 que su propia biblioteca no define. */
  const r9 = receptor(9);
  assert.equal(r9.doc.eventTypes[0].id, 9);
  const inc = reembolso();
  inc.doc.pages[0].scenarios[0].steps.push({ id: 2, at: 1000, action: "SEND", edgeId: inc.doc.pages[0].scenarios[0].steps[0].edgeId, eventTypeId: 9 });
  inc.doc.pages[0].scenarios[0].nextStepId = 3;
  const srcErrors = valid(inc).errors.map((e) => [e.code, e.storyId, e.stepId]);
  assert.deepEqual(srcErrors, [["missing_event_type", 1, 2]], "precondición: el entrante ya es inválido");
  // antes de 018.8 el Step colgante se resolvía EN SILENCIO contra «Pago» del receptor
  const { d, res } = importDomain(r9, inc);
  const step = d.pages[1].scenarios[0].steps[1];
  assert.deepEqual(res.unresolved, [{ from: 9, to: step.eventTypeId }]);
  assert.ok(!d.eventTypes.some((e) => e.id === step.eventTypeId), "apunta a un id que no existe en el receptor");
  assert.ok(step.eventTypeId < d.nextEventTypeId, "id RESERVADO: el contador ya lo ha pasado y nunca se asignará");
  const dstErrors = valid(asProject(d)).errors.map((e) => [e.code, e.pageIndex, e.storyId, e.stepId]);
  assert.deepEqual(dstErrors, [["missing_event_type", 1, 1, 2]], "el mismo error, en la misma Historia y el mismo Step (nada se limpia)");
  assert.equal(d.pages[1].scenarios[0].steps.length, 2, "el Step no se elimina");
  const next = K.call("(function(){ const d=__a; return createEventTypeIn(d, {name:'N', primitive:'OCCURRENCE', sentenceTemplate:'{target} n'}).id; })()", d);
  assert.notEqual(next, step.eventTypeId, "un EventType creado después nunca ocupa ese id");
  // un mismo id colgante en varios Steps se conserva como UN mismo id
  inc.doc.pages[0].scenarios[0].steps.push({ id: 3, at: 2000, action: "SEND", edgeId: step.edgeId, eventTypeId: 9 });
  inc.doc.pages[0].scenarios[0].nextStepId = 4;
  const { d: d2, res: res2 } = importDomain(r9, inc);
  assert.equal(res2.unresolved.length, 1);
  assert.equal(d2.pages[1].scenarios[0].steps[1].eventTypeId, d2.pages[1].scenarios[0].steps[2].eventTypeId);
});

test("D4 — un Step con primitiva incompatible en su propio documento sigue incompatible (se preserva, no se repara)", () => {
  const inc = alerta(1);
  inc.doc.pages[0].nodes.push({ id: 50, shape: "rect", x: 300, y: 0, w: 120, h: 60, label: "Otro" });
  inc.doc.pages[0].edges.push({ id: 51, from: inc.doc.pages[0].nodes[0].id, to: 50 });
  inc.doc.pages[0].nextId = 52;
  inc.doc.pages[0].scenarios[0].steps.push({ id: 2, at: 1000, action: "SEND", edgeId: 51, eventTypeId: inc.doc.eventTypes[0].id });   // OCCURRENCE usado como SEND
  inc.doc.pages[0].scenarios[0].nextStepId = 3;
  assert.deepEqual(valid(inc).errors.map((e) => e.code), ["event_type_action_mismatch"]);
  const { d, res } = importDomain(R, inc);
  assert.deepEqual(res.unresolved, []);
  assert.deepEqual(valid(asProject(d)).errors.map((e) => [e.code, e.pageIndex, e.stepId]), [["event_type_action_mismatch", 1, 2]]);
});

test("contrato: devuelve {pageIndex, pages, eventTypes, unresolved}; añade al final los MISMOS objetos página que devuelve; no toca tema, fondo, cur ni la identidad de lo que ya había", () => {
  const r = K.call(`(function(){
    const d=projectFromProjectData(__a.r).doc, inc=documentFromProjectData(__a.i);
    const before={theme:d.theme, customBg:d.customBg, cur:d.cur, pages:d.pages.slice(), ets:d.eventTypes.slice(), etsArr:d.eventTypes, pagesArr:d.pages};
    const incJson=JSON.stringify(inc);
    const res=importPagesIn(d, inc);
    return {keys:Object.keys(res).sort(), pageIndex:res.pageIndex,
      samePages: res.pages.length===2 && res.pages.every((p,k)=>d.pages[res.pageIndex+k]===p),
      notIncoming: res.pages.every((p,k)=>p!==inc.pages[k]) && d.eventTypes.every(e=>!inc.eventTypes.includes(e)),
      incomingUntouched: JSON.stringify(inc)===incJson,
      oldKept: before.pages.every((p,k)=>d.pages[k]===p) && before.ets.every((e,k)=>d.eventTypes[k]===e),
      sameArrays: d.pages===before.pagesArr && d.eventTypes===before.etsArr,
      theme:[d.theme, d.customBg, d.cur], themeBefore:[before.theme, before.customBg, before.cur]};
  })()`, { r: R, i: multi() });
  assert.deepEqual(r.keys, ["eventTypes", "pageIndex", "pages", "unresolved"]);
  assert.equal(r.pageIndex, 1);
  assert.ok(r.samePages, "las páginas devueltas son las insertadas");
  assert.ok(r.notIncoming, "no conserva referencias al documento entrante");
  assert.ok(r.incomingUntouched, "el documento entrante no se modifica");
  assert.ok(r.oldKept, "las páginas y EventTypes del receptor conservan su identidad");
  assert.ok(r.sameArrays, "muta el documento en su sitio (los arrays del documento son los mismos)");
  assert.deepEqual(r.theme, r.themeBefore);
});

test("contrato: solo cambia eventTypeId en los Steps importados; Steps sin EventType y todo lo demás de la página, idéntico", () => {
  const inc = multi();
  inc.doc.pages[0].scenarios.push({ id: 9, engineVersion: 2, name: "Sin eventos", nextStepId: 2, steps: [{ id: 1, at: 0, action: "SEND", edgeId: inc.doc.pages[0].edges[0].id }] });
  inc.doc.pages[0].nextScenarioId = 10;
  const { d, res } = importDomain(R, inc), src = normalizedDoc(inc);
  const map = new Map(res.eventTypes.map((m) => [m.from, m.to]));
  src.pages.forEach((pg, k) => {
    const expected = J(pg);
    for (const sc of expected.scenarios) for (const st of sc.steps) if (st.eventTypeId !== undefined) st.eventTypeId = map.get(st.eventTypeId);
    assert.deepEqual(d.pages[1 + k], expected, `página ${k}: idéntica salvo los eventTypeId remapeados`);
  });
});

test("contrato: todo o nada — id_exhausted e invalid_document no modifican el receptor", () => {
  const exhausted = K.call(`(function(){
    const d=projectFromProjectData(__a.r).doc; d.nextEventTypeId=Number.MAX_SAFE_INTEGER-1;
    const before=JSON.stringify(d);
    try{ importPagesIn(d, documentFromProjectData(__a.i)); return "no"; }catch(e){ return [e.code, JSON.stringify(d)===before]; }
  })()`, { r: R, i: multi() });
  assert.deepEqual(exhausted, ["id_exhausted", true]);
  for (const [label, expr] of [
    ["sin páginas", "({pages:[], eventTypes:[]})"], ["pages no array", "({pages:{}, eventTypes:[]})"], ["eventTypes no array", "({pages:[blankPage('x')], eventTypes:{}})"],
    ["el mismo documento", "d"], ["una página ya presente", "({pages:[d.pages[0]], eventTypes:[]})"], ["entrante no objeto", "null"],
  ]) {
    const r = K.call(`(function(){ const d=projectFromProjectData(__a).doc, before=JSON.stringify(d);
      try{ importPagesIn(d, ${expr}); return "no"; }catch(e){ return [e.code, JSON.stringify(d)===before]; } })()`, R);
    assert.deepEqual(r, ["invalid_document", true], label);
  }
  const badReceptor = K.call(`(function(){ try{ importPagesIn({pages:[blankPage("a")]}, documentFromProjectData(__a)); return "no"; }catch(e){ return e.code; } })()`, multi());
  assert.equal(badReceptor, "invalid_document", "receptor sin biblioteca");
});

test("contrato: el contador del receptor avanza tras los importados (y por encima de su máximo) y los ids no se reutilizan", () => {
  const r = receptor(); r.doc.nextEventTypeId = 40;
  const { d, res } = importDomain(r, multi());
  assert.deepEqual(res.eventTypes.map((m) => m.to), [40, 41, 42, 43]);
  assert.equal(d.nextEventTypeId, 44);
  const next = K.call("createEventTypeIn(__a, {name:'N', primitive:'OCCURRENCE', sentenceTemplate:'{target} n'}).id", d);
  assert.equal(next, 44);
});

test("añadir el MISMO documento dos veces: dos copias independientes; las páginas de la primera siguen apuntando a la primera", () => {
  const E = fullEditor(); E.load(R);
  E.run("appendPagesFrom(" + JSON.stringify(reembolso()) + ")");
  E.run("appendPagesFrom(" + JSON.stringify(reembolso()) + ")");
  const d = E.docOf();
  assert.deepEqual(libNames(d), ["1:Pago:FLOW", "2:Aviso:OCCURRENCE", "3:Reembolso:FLOW", "4:Reembolso:FLOW"]);
  assert.deepEqual([d.pages[1].scenarios[0].steps[0].eventTypeId, d.pages[2].scenarios[0].steps[0].eventTypeId], [3, 4]);
  assert.equal(d.cur, 2);
  assertImportedSemantics(d, reembolso(), 1); assertImportedSemantics(d, reembolso(), 2);
  assert.equal(valid(asProject(d)).valid, true);
});

/* ───────────────────────────── Paridad editor ↔ dominio ───────────────────────────── */

test("paridad: el editor (appendPagesFrom) produce EXACTAMENTE el documento de importPagesIn (+ la página activa); ida y vuelta por el formato estable", () => {
  for (const [rr, inc] of [[R, reembolso()], [R, alerta(1)], [R, alerta(5)], [R, multi()], [receptor(9), multi()], [ok(apply(project([page("V")]), [N(0, "v", 0, "V")])), multi()]]) {
    const E = editorAppend(rr, inc), ed = E.docOf();
    const { d, res } = importDomain(rr, inc);
    d.cur = res.pageIndex;
    assert.deepEqual(ed, d);
    assert.deepEqual(normalizedDoc(asProject(ed)), ed, "normalizar de nuevo (guardar → abrir) no cambia nada");
    assert.deepEqual(J(E.run("settings")), K.call("projectFromProjectData(__a).settings", rr), "los ajustes del receptor no cambian");
  }
});

test("estático: appendPagesFrom delega en importPagesIn, vacía las pilas y no toca la biblioteca por su cuenta", () => {
  const st = read("js/state.js");
  const a = st.indexOf("function appendPagesFrom(d){"), b = st.indexOf("function restoreAutosaveSession(){");
  const body = st.slice(a, b);
  assert.ok(a >= 0 && b > a);
  assert.match(body, /importPagesIn\(doc, *nd\)/);
  assert.match(body, /undoStack\.length=0; *redoStack\.length=0;/);
  assert.doesNotMatch(body, /eventTypes|nextEventTypeId|doc\.pages\.push/, "la transformación vive en el dominio");
  assert.match(read("js/model.js"), /function importPagesIn\(d, incoming\)\{/);
});

/* ───────────────────────────── Regresiones 018.7c / 018.7d sobre páginas importadas ───────────────────────────── */

test("018.7c: ✕ de la página importada → confirmación con su impacto → Undo la reinserta (mismo objeto) con sus Steps resolviendo a sus EventTypes; Redo", () => {
  const E = editorAppend(R, multi());
  const s0 = E.docOf();
  E.run("__p=doc.pages[1]");
  E.close(1);
  assert.deepEqual(E.docOf().pages.map((p) => p.name), ["Caja", "Envío"]);
  assert.equal(valid(asProject(E.docOf())).valid, true);
  E.run("undo()");
  assert.deepEqual(E.docOf(), s0, "Undo exacto");
  assert.equal(E.run("doc.pages[1]===__p"), true, "la misma página");
  assertImportedSemantics(E.docOf(), multi(), 1);
  E.run("redo()"); assert.deepEqual(E.docOf().pages.map((p) => p.name), ["Caja", "Envío"]);
});

test("018.7d: borrar las páginas importadas, eliminar un EventType importado ya sin uso, Undo ×3 → todo vuelve válido y con la semántica de origen", () => {
  const E = editorAppend(R, multi());
  const s0 = E.docOf();
  E.close(2); E.close(1);                                                   // «Reembolso» (3) queda sin uso
  assert.equal(E.run("eventTypeIsUsed(3)"), false);
  E.run("pushUndo(); deleteEventType(3);");
  assert.equal(E.run("eventTypeById(3)"), null);
  E.run("undo(); undo(); undo();");
  assert.deepEqual(E.docOf(), s0, "documento tras importar, exacto");
  assert.equal(valid(asProject(E.docOf())).valid, true);
  assertImportedSemantics(E.docOf(), multi(), 1);
  E.run("redo(); redo(); redo();");
  assert.equal(E.run("eventTypeById(3)"), null);
  assert.equal(valid(asProject(E.docOf())).valid, true);
});

/* ───────────────────────────── Aleatorio ───────────────────────────── */

test("aleatorio: receptores y entrantes con ids que colisionan y primitivas mezcladas — válido, semántica de origen intacta y receptor intacto", () => {
  let seed = 18; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const PRIMS = [["FLOW", "{source} → {target}"], ["OCCURRENCE", "{target} ocurre"], ["SET_AVAILABILITY", "{target} cambia"]];
  function randomDoc(tag) {
    const pages = 1 + Math.floor(rnd() * 3), ets = Math.floor(rnd() * 5);
    const ops = [];
    for (let p = 1; p < pages; p++) ops.push({ op: "create_page", scope: "document", name: tag + p });
    for (let p = 0; p < pages; p++) { ops.push(N(p, `n${p}a`, 0, "A" + p), N(p, `n${p}b`, 300, "B" + p), C(p, `n${p}a`, `n${p}b`, `e${p}`)); }
    const kinds = [];
    for (let k = 0; k < ets; k++) {
      const [prim, sentence] = pick(PRIMS); kinds.push(prim);
      ops.push(ET("et" + k, tag + "-" + k, prim, sentence, String(k), prim === "SET_AVAILABILITY" ? { availability: pick(["UP", "DOWN"]) } : prim === "FLOW" ? { motion: pick(["fast", "normal", "slow"]) } : {}));
    }
    for (let p = 0; p < pages; p++) {
      const stories = ets ? Math.floor(rnd() * 3) : 0;
      for (let s = 0; s < stories; s++) {
        ops.push(STORY(p, `${tag}${p}-${s}`, `s${p}${s}`));
        const steps = 1 + Math.floor(rnd() * 4);
        for (let k = 0; k < steps; k++) { const i = Math.floor(rnd() * ets); ops.push(kinds[i] === "FLOW" ? SEND(p, `s${p}${s}`, "et" + i, `e${p}`) : ON(p, `s${p}${s}`, "et" + i, pick([`n${p}a`, `n${p}b`]))); }
      }
    }
    return ok(apply(withNext(project([page(tag + 0)]), 1 + Math.floor(rnd() * 4)), ops));
  }
  for (let t = 0; t < 60; t++) {
    const rr = randomDoc("R"), inc = randomDoc("I");
    const E = editorAppend(rr, inc), d = E.docOf(), first = rr.doc.pages.length;
    assert.equal(valid(asProject(d)).valid, true, `t${t}`);
    assertImportedSemantics(d, inc, first, `t${t}`);
    const src = normalizedDoc(rr);
    src.pages.forEach((_, k) => assert.deepEqual(fingerprint(d, k), fingerprint(src, k), `t${t} receptor ${k}`));
    assert.deepEqual(d.eventTypes.slice(0, src.eventTypes.length), src.eventTypes, `t${t} biblioteca del receptor intacta`);
    assert.deepEqual(d.eventTypes.slice(src.eventTypes.length).map(withoutId), normalizedDoc(inc).eventTypes.map(withoutId), `t${t} biblioteca entrante completa`);
    assert.equal(new Set(d.eventTypes.map((e) => e.id)).size, d.eventTypes.length, `t${t} ids únicos`);
    assert.ok(d.eventTypes.every((e) => e.id < d.nextEventTypeId), `t${t} contador`);
    assert.deepEqual([E.run("undoStack.length"), E.run("redoStack.length"), d.cur], [0, 0, first]);
  }
});
