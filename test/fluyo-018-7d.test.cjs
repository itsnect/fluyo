"use strict";
/* FLUYO-018.7d — la biblioteca de EventTypes (doc.eventTypes) entra en el estado restaurable por Undo/Redo (deja sin efecto la exclusión de la
   decisión 82). Editor real (model.js, state.js sin DOM, selection.js y la ✕ de ui.js) con el arnés de 018.7c.
   Las operaciones de biblioteca se ejercitan con la MISMA secuencia que el editor (editor-scenarios.js): `pushUndo()` y luego
   createEventType / updateEventType / deleteEventType (scSaveEventType, scDeleteEventUI). Antes de 018.7d este archivo FALLA. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { kernel, editor, read, J, page, project } = require("./fluyo-018-7c-harness.cjs");

const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };
const valid = (E) => K.call("FluyoIntegrity.validateProject(__a)", { version: 5, app: "fluyo", doc: J(E.run("doc")), settings: {} });

/* A usa «Pago» (solo ella) y «Aviso»; B usa «Aviso»; C vacía. «Libre» sin uso. Activa: A. */
function base() {
  const N = (pi, ref, x) => ({ op: "create_node", scope: "page", pageIndex: pi, spec: { shape: "rect", x, y: 0 }, ref });
  const p = ok(apply(project([page("A")]), [
    { op: "create_page", scope: "document", name: "B" }, { op: "create_page", scope: "document", name: "C" },
    N(0, "a1", 0), N(0, "a2", 300), { op: "create_connection", scope: "page", pageIndex: 0, source: { ref: "a1" }, target: { ref: "a2" }, ref: "ea" },
    N(1, "b1", 0),
    { op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", ref: "pago" },
    { op: "create_event_type", scope: "eventType", name: "Aviso", primitive: "OCCURRENCE", sentence: "{target} avisa", ref: "aviso" },
    { op: "create_event_type", scope: "eventType", name: "Libre", primitive: "OCCURRENCE", sentence: "{target} libre" },
    { op: "create_story", scope: "story", pageIndex: 0, name: "Compra", ref: "sa" },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: { ref: "sa" }, eventTypeId: { ref: "pago" }, target: { edgeId: { ref: "ea" } } },
    { op: "add_step", scope: "story", pageIndex: 0, storyId: { ref: "sa" }, eventTypeId: { ref: "aviso" }, target: { nodeId: { ref: "a2" } } },
    { op: "create_story", scope: "story", pageIndex: 1, name: "Entrega", ref: "sb" },
    { op: "add_step", scope: "story", pageIndex: 1, storyId: { ref: "sb" }, eventTypeId: { ref: "aviso" }, target: { nodeId: { ref: "b1" } } },
  ])).project;
  return J(p);
}
const B = base();
const PAGO = 1, AVISO = 2, LIBRE = 3;
/* Lo que hace el editor (editor-scenarios.js): un EventType usado no se elimina (popover «Quítalo o reemplázalo»); si no, pushUndo + deleteEventType. */
const deleteET = (E, id) => E.run(`(function(){ if(eventTypeIsUsed(${id})) return "bloqueado"; pushUndo(); deleteEventType(${id}); return "eliminado"; })()`);
const createET = (E, name) => E.run(`(function(){ pushUndo(); return createEventType({name:${JSON.stringify(name)}, primitive:"OCCURRENCE", sentenceTemplate:"{target} x", visual:{value:"★"}}).id; })()`);
const renameET = (E, id, name) => E.run(`(function(){ pushUndo(); updateEventType(${id}, {name:${JSON.stringify(name)}}); })()`);
const docOf = (E) => J(E.run("doc"));
const names = (E) => J(E.run("doc.pages.map(p=>p.name)"));
const lib = (E) => J(E.run("doc.eventTypes.map(e=>e.id+':'+e.name)"));

test("editor-scenarios.js: crear, editar y eliminar EventTypes registran Undo ANTES de mutar (la secuencia que reproduce este archivo)", () => {
  const sc = read("js/editor-scenarios.js");
  assert.match(sc, /pushUndo\(\);\n\s*deleteEventType\(id\);/);
  assert.match(sc, /pushUndo\(\);\n\s*const editing = !!scEditingEventTypeId;\n\s*const et = editing \? updateEventType\(scEditingEventTypeId, def\) : createEventType\(def\);/);
  assert.match(sc, /if \(eventTypeIsUsed\(id\)\) \{/, "un EventType usado no se elimina desde la biblioteca");
});

test("1. página → EventType: borrar A, eliminar «Pago» (ya sin uso), Undo ×2 → «Pago» existe y los Steps de A apuntan a un EventType válido", () => {
  const E = editor(); E.load(B);
  const s0 = docOf(E);
  E.close(0);                                                               // A fuera: «Pago» queda sin uso
  const s1 = docOf(E);
  assert.equal(deleteET(E, PAGO), "eliminado");
  const s2 = docOf(E);
  assert.deepEqual(lib(E), ["2:Aviso", "3:Libre"]);
  E.run("undo()");                                                          // deshace la eliminación de «Pago»
  assert.deepEqual(docOf(E), s1, "Undo 1: el estado exacto tras borrar A (con «Pago» en la biblioteca)");
  E.run("undo()");                                                          // deshace el borrado de A
  assert.deepEqual(docOf(E), s0, "Undo 2: documento inicial exacto");
  assert.equal(valid(E).valid, true, "todas las Historias son válidas: los Steps de A apuntan a «Pago», que existe");
  assert.ok(E.run(`doc.pages[0].scenarios[0].steps.every(st=>doc.eventTypes.some(et=>et.id===st.eventTypeId))`));
  // 2. Redo: vuelve exactamente al estado posterior al borrado y a la eliminación
  E.run("redo()"); assert.deepEqual(docOf(E), s1, "Redo 1");
  E.run("redo()"); assert.deepEqual(docOf(E), s2, "Redo 2");
  assert.equal(valid(E).valid, true);
});

test("3. EventType usado por otra página: borrar A no permite eliminar «Aviso» (B lo usa); Undo/Redo no tocan la biblioteca indebidamente", () => {
  const E = editor(); E.load(B);
  const s0 = docOf(E), libObjs = () => E.run("doc.eventTypes.slice()");
  E.close(0);
  const s1 = docOf(E);
  assert.equal(deleteET(E, AVISO), "bloqueado", "política existente: un EventType usado no se elimina");
  assert.equal(E.run("(function(){ try{ deleteEventType(2); return 'no'; }catch(e){ return e.code; } })()"), "event_type_in_use", "y el dominio lo rechaza");
  assert.deepEqual(docOf(E), s1, "el rechazo no cambia nada ni deja entrada de Undo");
  E.run("__objs=doc.eventTypes.slice()");
  for (let k = 0; k < 3; k++) {
    E.run("undo()"); assert.deepEqual(docOf(E), s0, `ciclo ${k}: Undo`);
    E.run("redo()"); assert.deepEqual(docOf(E), s1, `ciclo ${k}: Redo`);
  }
  assert.equal(E.run("doc.eventTypes.length===__objs.length && doc.eventTypes.every((e,i)=>e===__objs[i])"), true, "la biblioteca conserva sus objetos");
});

test("4. EventType creado y eliminado: Undo/Redo de crear, Undo/Redo de eliminar — mismo id, mismo contenido y MISMO objeto; el contador no baja", () => {
  const E = editor(); E.load(B);
  const s0 = docOf(E), next0 = E.run("doc.nextEventTypeId");
  const id = createET(E, "Reintento");
  assert.equal(id, next0);
  E.run(`__et=eventTypeById(${id})`);
  const s1 = docOf(E), content = J(E.run("__et"));
  E.run("undo()");
  assert.equal(E.run(`eventTypeById(${id})`), null, "Undo de crear: ya no está");
  assert.deepEqual({ ...docOf(E), nextEventTypeId: next0 }, s0, "el resto del documento, exacto");
  assert.equal(E.run("doc.nextEventTypeId"), next0 + 1, "el contador de identidad no baja (un id eliminado no se reasigna)");
  E.run("redo()");
  assert.deepEqual(docOf(E), s1, "Redo de crear: documento exacto");
  assert.equal(E.run(`eventTypeById(${id})===__et`), true, "es el MISMO objeto");
  assert.deepEqual(J(E.run(`eventTypeById(${id})`)), content);
  assert.equal(deleteET(E, id), "eliminado");
  const s2 = docOf(E);
  E.run("undo()");
  assert.deepEqual(docOf(E), s1, "Undo de eliminar: vuelve exacto");
  assert.equal(E.run(`eventTypeById(${id})===__et`), true, "y es el mismo objeto");
  E.run("redo()"); assert.deepEqual(docOf(E), s2, "Redo de eliminar");
  // editar (renombrar) también se deshace, conservando la identidad del objeto
  E.run("undo()"); renameET(E, id, "Reintento 2");
  assert.equal(E.run(`__et.name`), "Reintento 2");
  E.run("undo()"); assert.equal(E.run(`eventTypeById(${id})===__et && __et.name`), "Reintento");
  E.run("redo()"); assert.equal(E.run(`__et.name`), "Reintento 2");
  // un id nuevo nunca reutiliza uno deshecho
  E.run("undo(); undo(); undo();");
  assert.equal(createET(E, "Otro"), next0 + 1);
});

test("5. operaciones consecutivas: borrar A, renombrar «Aviso», eliminar «Pago», borrar B — cada Undo restaura exactamente su estado", () => {
  const E = editor(); E.load(B);
  const states = [docOf(E)];
  E.close(0); states.push(docOf(E));
  renameET(E, AVISO, "Alerta"); states.push(docOf(E));
  assert.equal(deleteET(E, PAGO), "eliminado"); states.push(docOf(E));
  E.close(0); states.push(docOf(E));                                        // B (ahora índice 0): «Alerta» queda sin uso
  assert.deepEqual([names(E), lib(E)], [["C"], ["2:Alerta", "3:Libre"]]);
  for (let k = states.length - 2; k >= 0; k--) { E.run("undo()"); assert.deepEqual(docOf(E), states[k], `Undo hasta el estado ${k}`); }
  assert.equal(valid(E).valid, true);
  for (let k = 1; k < states.length; k++) { E.run("redo()"); assert.deepEqual(docOf(E), states[k], `Redo hasta el estado ${k}`); }
});

test("6. ciclos repetidos Undo → Redo → Undo → Redo: comparación exacta tras cada paso", () => {
  const E = editor(); E.load(B);
  const s0 = docOf(E);
  E.close(0); const s1 = docOf(E);
  deleteET(E, PAGO); const s2 = docOf(E);
  for (let k = 0; k < 6; k++) {
    E.run("undo()"); assert.deepEqual(docOf(E), s1, `k${k} u1`);
    E.run("undo()"); assert.deepEqual(docOf(E), s0, `k${k} u2`);
    E.run("redo()"); assert.deepEqual(docOf(E), s1, `k${k} r1`);
    E.run("redo()"); assert.deepEqual(docOf(E), s2, `k${k} r2`);
  }
});

test("cambiar la primitiva de un EventType sin uso (aparece la clave availability) se deshace y rehace EXACTO, con el mismo objeto", () => {
  const E = editor(); E.load(B);
  E.run(`__et=eventTypeById(${LIBRE})`);
  const s0 = docOf(E), before = J(E.run("__et"));
  E.run(`pushUndo(); updateEventType(${LIBRE}, eventTypeDefinition({name:"Libre", primitive:"SET_AVAILABILITY", sentenceTemplate:"{target} cae", symbol:"⛔", availability:"DOWN"}));`);
  const s1 = docOf(E), after = J(E.run("__et"));
  assert.equal(after.primitive, "SET_AVAILABILITY"); assert.ok("availability" in after && !("availability" in before), "precondición: cambian las claves del objeto");
  E.run("undo()"); assert.deepEqual(docOf(E), s0); assert.deepEqual(J(E.run("__et")), before, "sin claves sobrantes"); assert.equal(E.run(`eventTypeById(${LIBRE})===__et`), true);
  E.run("redo()"); assert.deepEqual(docOf(E), s1); assert.equal(E.run(`eventTypeById(${LIBRE})===__et`), true);
});

test("invariante: TODA entrada de Undo y de Redo lleva la biblioteca (lib) — de página, de borrado de página y sus inversas", () => {
  const E = editor(); E.load(B);
  E.close(2); deleteET(E, LIBRE); createET(E, "X"); E.run("pushUndo(); P().nodes.push({id:77,shape:'rect',x:0,y:0,w:10,h:10});");
  const kinds = () => J(E.run("undoStack.concat(redoStack).map(s=>[s.kind, !!(s.lib && Array.isArray(s.lib.objs) && Array.isArray(s.lib.data))])"));
  assert.deepEqual(kinds(), [["insertPage", true], ["page", true], ["page", true], ["page", true]]);
  E.run("undo(); undo(); undo(); undo();");
  assert.deepEqual(kinds(), [["page", true], ["page", true], ["page", true], ["removePage", true]]);
});

test("una entrada que ya no aplica (su página no está) se descarta SIN tocar la biblioteca", () => {
  const E = editor(); E.load(B);
  E.run("__old=libSnap(); pushUndo(); createEventType({name:'Nuevo', primitive:'OCCURRENCE', sentenceTemplate:'{target} n', visual:{value:'★'}}); undoStack.length=0;");
  E.run("undoStack.push({kind:'page', page:blankPage('fantasma'), data:blankPage('x'), lib:__old});");
  const before = docOf(E);
  E.run("undo()");
  assert.deepEqual(docOf(E), before, "ni páginas ni biblioteca cambian");
  assert.deepEqual(lib(E).at(-1), "4:Nuevo");
  assert.deepEqual([E.run("undoStack.length"), E.run("redoStack.length")], [0, 0]);
});

test("7. sin regresión: el tema, crear/renombrar páginas y la navegación siguen fuera de Undo; las entradas de página no cambian la biblioteca si no cambió", () => {
  const E = editor(); E.load(B);
  E.run(`setThemeIn(doc,{theme:"crema"}); renamePage(2,"Z"); doc.cur=1;`);
  E.run(`pushUndo(); P().nodes.push({id:99,shape:"rect",x:0,y:0,w:10,h:10});`);
  const before = J(E.run("doc.eventTypes")); E.run("__objs=doc.eventTypes.slice()");
  E.run("undo()");
  assert.deepEqual([E.run("doc.theme"), E.run("doc.pages[2].name"), E.run("P().nodes.length")], ["crema", "Z", 1], "el tema y el nombre no se deshacen; el nodo sí");
  assert.deepEqual(J(E.run("doc.eventTypes")), before);
  assert.equal(E.run("doc.eventTypes.every((e,i)=>e===__objs[i])"), true, "identidad de la biblioteca intacta");
});

test("aleatorio: páginas, nodos y EventTypes (crear/renombrar/eliminar) con Undo/Redo contra un modelo de documentos completos; integridad siempre válida", () => {
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const content = (E) => JSON.stringify(J(E.run("({pages:doc.pages.map(p=>({name:p.name,nodes:p.nodes,edges:p.edges,behaviors:p.behaviors,scenarios:p.scenarios.map(s=>({id:s.id,name:s.name,steps:s.steps}))})), eventTypes:doc.eventTypes})")));
  for (let t = 0; t < 50; t++) {
    const E = editor(); E.load(B);
    const past = [], future = []; let n = 0;
    for (let k = 0; k < 40; k++) {
      const r = rnd(), len = E.run("doc.pages.length"), ids = J(E.run("doc.eventTypes.map(e=>e.id)"));
      const act = (fn) => { const now = content(E); if (fn() !== false) { past.push(now); future.length = 0; } };
      if (r < 0.15 && len > 1) act(() => E.close(Math.floor(rnd() * len)));
      else if (r < 0.3) act(() => { createET(E, "N" + n++); });
      else if (r < 0.42 && ids.length) act(() => { renameET(E, ids[Math.floor(rnd() * ids.length)], "R" + n++); });
      else if (r < 0.55 && ids.length) act(() => deleteET(E, ids[Math.floor(rnd() * ids.length)]) === "eliminado");
      else if (r < 0.65) act(() => { E.run(`doc.cur=${Math.floor(rnd() * len)}; pushUndo(); P().nodes.push({id:${900 + n},shape:"rect",x:0,y:0,w:10,h:10});`); n++; });
      else if (r < 0.85) { const now = content(E); E.run("undo()"); if (past.length) { assert.equal(content(E), past.pop(), `t${t} k${k} undo`); future.push(now); } }
      else { const now = content(E); E.run("redo()"); if (future.length) { assert.equal(content(E), future.pop(), `t${t} k${k} redo`); past.push(now); } }
      assert.equal(valid(E).valid, true, `t${t} k${k}: documento válido`);
    }
  }
});
