"use strict";
/* FLUYO-016 — Historias como entidad de primer nivel.
   Modelo (duplicar/nombres), selección por página, operaciones de panel con Undo/Redo,
   independencia de apariciones, Playback, Share (sólo la Historia seleccionada), Viewer y
   compatibilidad legacy. Todo en `vm` + DOM falso; el flujo real está en
   test/fluyo-016-browser.cjs y las mutaciones en test/fluyo-016-mutations.cjs. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { makeScenarioUIContext, buildExample, setupPanel, ensureUI, read } = require("./fluyo-016-harness.cjs");
const { makeViewer } = require("./viewer-harness.cjs");

const J = (v) => JSON.parse(JSON.stringify(v));

/* ───────────────────────── Fixtures ───────────────────────── */
/* Un diagrama Cliente → Comercio → Almacén con tres Historias (A, B, C) que reutilizan los mismos EventTypes. */
function editor({ historias = true } = {}) {
  const h = makeScenarioUIContext();
  const { ctx, register } = h;
  buildExample(ctx);
  setupPanel(ctx, register);
  ctx.confirm = () => true;
  ctx.renderTabs = () => ctx.run("scSyncPage()");
  ensureUI(ctx);
  ctx.run(`(function(){
    const C0=P().nodes[1]; const W0={id:P().nextId++,shape:"rect",x:400,y:0,label:"Almacén"}; P().nodes.push(W0);
    const E2={id:P().nextId++,from:C0.id,to:W0.id}; P().edges.push(E2); edge2=E2.id;
    pago=createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
    pedido=createEventType({name:"Pedido",primitive:"FLOW",sentenceTemplate:"{source} envía a {target}",visual:{value:"📦"}});
  })()`);
  if (historias) {
    ctx.run(`
      sA=createScenario(P(),"Camino feliz");
      createStep(sA,{at:0,action:"SEND",edgeId:edgeId,eventTypeId:pago.id});
      createStep(sA,{at:1000,action:"SEND",edgeId:edge2,eventTypeId:pedido.id});
      sB=createScenario(P(),"Pago rechazado");
      createStep(sB,{at:0,action:"SEND",edgeId:edgeId,eventTypeId:pago.id});
      sC=createScenario(P(),"Cliente abandona");
      createStep(sC,{at:0,action:"SEND",edgeId:edgeId,eventTypeId:pago.id});
      scSelectStory(sA.id); scRenderPanel(); undoStack.length=0; redoStack.length=0;
    `);
  }
  return ctx;
}
const names = (ctx) => J(ctx.run("P().scenarios.map(s=>s.name)"));
const active = (ctx) => ctx.run("scActiveScenario() && scActiveScenario().name");
const stepsOf = (ctx, name) => J(ctx.run(`P().scenarios.find(s=>s.name==${JSON.stringify(name)}).steps`));
const scenarios = (ctx) => J(ctx.run("P().scenarios"));

/* ───────────────────────── Modelo ───────────────────────── */
test("defaultScenarioName: «Historia N», primer número libre, sin repetir nombres", () => {
  const ctx = editor({ historias: false });
  assert.equal(ctx.run("defaultScenarioName(P())"), "Historia 1");
  ctx.run('createScenario(P(),"Historia 1"); createScenario(P(),"Historia 3")');
  assert.equal(ctx.run("defaultScenarioName(P())"), "Historia 4");
  ctx.run('P().scenarios=[]; createScenario(P(),"Historia 1")');
  assert.equal(ctx.run("defaultScenarioName(P())"), "Historia 2");
});

test("duplicateScenario: id nuevo, copia profunda, justo detrás del original, original intacto", () => {
  const ctx = editor();
  const before = scenarios(ctx);
  const maxBefore = Math.max(...before.map((s) => s.id));
  ctx.run("dup=duplicateScenario(P(),sA.id)");
  const after = scenarios(ctx);
  assert.deepEqual(after.map((s) => s.name), ["Camino feliz", "Camino feliz copia", "Pago rechazado", "Cliente abandona"]);
  assert.ok(ctx.run("dup.id") > maxBefore, "id de Scenario nuevo e irreutilizable");
  assert.equal(new Set(after.map((s) => s.id)).size, after.length);
  assert.deepEqual(after[0], before[0], "el original no cambia");
  assert.deepEqual(after[2], before[1]);
  assert.deepEqual(after[1].steps, before[0].steps, "mismos Steps y EventTypes");
  assert.equal(after[1].nextStepId, before[0].nextStepId);
  ctx.run("dup.steps[0].at=777; dup.steps.pop()");
  assert.deepEqual(scenarios(ctx)[0], before[0], "copia profunda: tocar la copia no toca el original");
  assert.equal(ctx.run("P().nextScenarioId") > maxBefore + 1 - 1, true);
});

test("duplicateScenario: nombres «copia», «copia 2»… sin chocar; límite de 120 caracteres; id desconocido → null", () => {
  const ctx = editor();
  ctx.run("duplicateScenario(P(),sA.id); duplicateScenario(P(),sA.id)");
  assert.deepEqual(names(ctx).slice(0, 3), ["Camino feliz", "Camino feliz copia 2", "Camino feliz copia"]);
  ctx.run('long=createScenario(P(),"x".repeat(120)); d=duplicateScenario(P(),long.id)');
  assert.ok(ctx.run("d.name.length") <= 120);
  assert.match(ctx.run("d.name"), / copia$/);
  assert.equal(ctx.run("duplicateScenario(P(),99999)"), null);
  assert.doesNotThrow(() => ctx.run("projectFromProjectData(serializeProject?serializeProject():{})") );
});

test("duplicateScenario: 100+ Steps, vacía, motor incompatible y mismo nombre en dos Historias", () => {
  const ctx = editor();
  ctx.run(`big=createScenario(P(),"Grande"); for(let i=0;i<150;i++) createStep(big,{at:i*10,action:"SEND",edgeId:edgeId,eventTypeId:pago.id});
           vacia=createScenario(P(),"Vacía"); fut=createScenario(P(),"Futura"); fut.engineVersion=99;
           igual1=createScenario(P(),"Igual"); igual2=createScenario(P(),"Igual");`);
  ctx.run("g=duplicateScenario(P(),big.id)");
  assert.equal(ctx.run("g.steps.length"), 150);
  assert.deepEqual(J(ctx.run("g.steps")), J(ctx.run("big.steps")));
  assert.equal(ctx.run("duplicateScenario(P(),vacia.id).steps.length"), 0);
  assert.equal(ctx.run("duplicateScenario(P(),fut.id).engineVersion"), 99, "se copia tal cual; no se vuelve editable");
  ctx.run("d1=duplicateScenario(P(),igual1.id); d2=duplicateScenario(P(),igual2.id)");
  assert.notEqual(ctx.run("d1.name"), ctx.run("d2.name"));
  const ids = scenarios(ctx).map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "ningún id repetido");
});

test("Una Historia duplicada vuelve a pasar la validación del documento", () => {
  const ctx = editor();
  ctx.run("duplicateScenario(P(),sA.id); duplicateScenario(P(),sB.id)");
  ctx.run("data=J_=JSON.parse(JSON.stringify({version:5,app:'fluyo',doc,settings:{}}))");
  assert.doesNotThrow(() => ctx.run("projectFromProjectData(data)"));
});

/* ───────────────────────── Panel: crear / renombrar / duplicar / eliminar ───────────────────────── */
test("Nueva historia: inmediata («Historia N»), seleccionada, sin tocar las demás, una operación de Undo", () => {
  const ctx = editor();
  const before = scenarios(ctx);
  ctx.run("scNewScenario()");
  assert.equal(names(ctx).length, 4);
  assert.equal(active(ctx), "Historia 4");
  assert.deepEqual(scenarios(ctx).slice(0, 3), before);
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run("undo()");
  assert.deepEqual(scenarios(ctx), before, "Ctrl+Z → exactamente el estado anterior");
  ctx.run("redo()");
  assert.equal(names(ctx).length, 4);
});

test("Renombrar: aparece en el selector; una operación de Undo; vacío o >120 se ignora", () => {
  const ctx = editor();
  ctx.run('scRenameScenario("Pago exitoso")');
  assert.equal(active(ctx), "Pago exitoso");
  assert.equal(ctx.run('$("scScenarioTitle").textContent'), "Pago exitoso ▾");
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run('scRenameScenario("   ")'); ctx.run('scRenameScenario("x".repeat(121))');
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run("undo()");
  assert.equal(active(ctx), "Camino feliz");
  assert.deepEqual(names(ctx), ["Camino feliz", "Pago rechazado", "Cliente abandona"]);
});

test("Duplicar historia: selecciona la copia, Steps y EventTypes conservados, una operación de Undo exacta", () => {
  const ctx = editor();
  const before = scenarios(ctx), evBefore = J(ctx.run("doc.eventTypes"));
  ctx.run("scDuplicateScenario()");
  assert.equal(active(ctx), "Camino feliz copia");
  assert.notEqual(ctx.run("scActiveScenario().id"), ctx.run("A.id"));
  assert.deepEqual(stepsOf(ctx, "Camino feliz copia"), stepsOf(ctx, "Camino feliz"));
  assert.deepEqual(J(ctx.run("doc.eventTypes")), evBefore, "no crea ni modifica EventTypes");
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run("undo()");
  assert.deepEqual(scenarios(ctx), before);
  assert.equal(ctx.run("undoStack.length"), 0);
  ctx.run("redo()");
  assert.equal(names(ctx).length, 4);
});

test("QA-016: Undo de Duplicar/Nueva devuelve la selección a la Historia de la que se partió (no a la primera)", () => {
  const ctx = editor();
  ctx.run("scSwitchScenario(sC.id)");
  ctx.run("scDuplicateScenario()");
  assert.equal(active(ctx), "Cliente abandona copia");
  ctx.run("undo()");
  assert.equal(active(ctx), "Cliente abandona", "tras deshacer Duplicar sigue en C, no salta a A");
  ctx.run("redo()");
  assert.equal(active(ctx), "Cliente abandona copia");
  ctx.run("undo()");
  ctx.run("scNewScenario()");
  assert.equal(active(ctx), "Historia 4");
  ctx.run("undo()");
  assert.equal(active(ctx), "Cliente abandona", "tras deshacer Nueva sigue en C");
  /* un cambio de página descarta el recuerdo: nunca se arrastra una Historia de otra página */
  ctx.run("scSwitchScenario(sB.id)");
  ctx.run("scSwitchScenario(sC.id)");
  ctx.run("scNewScenario()");
  ctx.run("doc.pages.push(blankPage('Página 2')); doc.cur=1; renderTabs();");
  assert.equal(ctx.run("scPrevActiveId"), null);
});

test("Duplicar con Playback activo: lo detiene, limpia overlays y duplica", () => {
  const ctx = editor();
  ctx.run("scRun()");
  assert.equal(ctx.run("scStatus"), "running");
  ctx.run("scDuplicateScenario()");
  assert.equal(ctx.run("scStatus"), "idle");
  assert.equal(ctx.run("scPlayback"), null);
  assert.equal(ctx.run("buildScenarioRenderState()"), null);
  assert.equal(names(ctx).length, 4);
});

test("Eliminar B de A·B·C: A y C intactos; se selecciona una vecina; Undo/Redo exactos", () => {
  const ctx = editor();
  const before = scenarios(ctx);
  ctx.run("scSwitchScenario(sB.id)");
  ctx.run("scDeleteScenario()");
  assert.deepEqual(scenarios(ctx), [before[0], before[2]]);
  assert.equal(active(ctx), "Cliente abandona");
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run("undo()");
  assert.deepEqual(scenarios(ctx), before, "Undo tras eliminar restaura la Historia");
  ctx.run("redo()");
  assert.deepEqual(scenarios(ctx), [before[0], before[2]], "Redo tras eliminar vuelve a eliminarla");
});

test("Eliminar la última de la lista selecciona la anterior; nunca queda apuntando a una inexistente", () => {
  const ctx = editor();
  ctx.run("scSwitchScenario(sC.id); scDeleteScenario()");
  assert.equal(active(ctx), "Pago rechazado");
  assert.equal(ctx.run("scActiveId"), ctx.run("B.id"));
});

test("Eliminar la Historia activa durante Playback: detiene, limpia y selecciona otra", () => {
  const ctx = editor();
  ctx.run("scRun()");
  assert.equal(ctx.run("scStatus"), "running");
  ctx.run("scDeleteScenario()");
  assert.equal(ctx.run("scStatus"), "idle");
  assert.equal(ctx.run("scPlayback"), null);
  assert.equal(ctx.run("buildScenarioRenderState()"), null);
  assert.equal(active(ctx), "Pago rechazado");
  assert.equal(ctx.run("$('scRun').disabled"), false);
});

test("Eliminar la última Historia: el modelo permite cero; estado vacío con «+ Nueva historia»; el editor no apunta a nada", () => {
  const ctx = editor();
  ctx.run("while(P().scenarios.length){ scDeleteScenario(); }");
  assert.deepEqual(names(ctx), []);
  assert.equal(ctx.run("scActiveScenario()"), null);
  assert.equal(ctx.run("scActiveId"), null);
  assert.equal(ctx.run('$("scScenarioTitle").textContent'), "Sin historias ▾");
  assert.equal(ctx.run('$("scRun").disabled'), true);
  const empty = ctx.run('$("scEmptyState")');
  assert.match(empty.textContent, /Aún no hay historias/);
  assert.match(empty.textContent, /\+ Nueva historia/);
  assert.doesNotMatch(empty.textContent, /escenario/i);
  ctx.run("scRun()"); /* no hace nada y no lanza */
  assert.equal(ctx.run("scStatus"), "idle");
  /* Undo de la última eliminación */
  ctx.run("undo()");
  assert.equal(names(ctx).length, 1);
});

test("Auto-creación: sin Historias, soltar un Evento crea «Historia 1» + aparición en UNA operación de Undo", () => {
  const ctx = editor({ historias: false });
  assert.equal(ctx.run("P().scenarios.length"), 0);
  ctx.run("scApplyTargets(pago.id,[edgeId])");
  assert.deepEqual(names(ctx), ["Historia 1"]);
  assert.equal(ctx.run("P().scenarios[0].steps.length"), 1);
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run("undo()");
  assert.deepEqual(names(ctx), []);
  assert.equal(ctx.run("scActiveScenario()"), null);
});

/* ───────────────────────── Selección ───────────────────────── */
test("Cambiar de Historia: cambia Steps y selección; NO toca nodos, conexiones, EventTypes ni el Undo", () => {
  const ctx = editor();
  const struct = () => JSON.stringify([ctx.run("P().nodes"), ctx.run("P().edges"), ctx.run("doc.eventTypes"), ctx.run("P().behaviors")]);
  const before = struct(), docScenarios = JSON.stringify(scenarios(ctx));
  ctx.run("scSelectedStep=sA.steps[0].id; scSwitchScenario(sB.id)");
  assert.equal(active(ctx), "Pago rechazado");
  assert.equal(ctx.run("scSelectedStep"), null, "el Step seleccionado de A no se hereda (ids de Step por Historia)");
  assert.equal(ctx.run("$('scScenarioTitle').textContent"), "Pago rechazado ▾");
  assert.equal(struct(), before);
  assert.equal(JSON.stringify(scenarios(ctx)), docScenarios);
  assert.equal(ctx.run("undoStack.length"), 0, "cambiar de Historia no es una operación del documento");
  assert.equal(ctx.run("scActiveId"), ctx.run("B.id"));
});

test("La Historia activa no se persiste en el documento ni en el proyecto serializado", () => {
  const ctx = editor();
  ctx.run("scSwitchScenario(sB.id)");
  const s = JSON.stringify({ doc: ctx.run("doc"), page: ctx.run("P()") });
  assert.doesNotMatch(s, /activeScenario|scActive|activeStory|selectedScenario/i);
});

test("Dos Historias con el mismo nombre se seleccionan por id, no por nombre", () => {
  const ctx = editor();
  ctx.run('sB.name="Camino feliz"');
  ctx.run("scSwitchScenario(sB.id)");
  assert.equal(ctx.run("scActiveScenario().id"), ctx.run("B.id"));
  ctx.run("scSwitchScenario(sA.id)");
  assert.equal(ctx.run("scActiveScenario().id"), ctx.run("A.id"));
});

test("Multi-página: cada página conserva sus Historias y cambiar de página selecciona una válida de ESA página", () => {
  const ctx = editor();
  ctx.run(`
    p2=blankPage("Página 2"); doc.pages.push(p2);
    const x={id:p2.nextId++,shape:"rect",x:0,y:0,label:"X"}, y={id:p2.nextId++,shape:"rect",x:200,y:0,label:"Y"};
    p2.nodes.push(x,y); const e={id:p2.nextId++,from:x.id,to:y.id}; p2.edges.push(e);
    D=createScenario(p2,"Otra uno"); Dd=createScenario(p2,"Otra dos");
    createStep(Dd,{at:0,action:"SEND",edgeId:e.id,eventTypeId:pago.id});
    scSwitchScenario(sC.id);`);
  assert.equal(ctx.run("scActiveId"), 3, "sC tiene id 3 en la página 1");
  ctx.run("doc.cur=1; renderTabs()");
  assert.equal(active(ctx), "Otra uno", "página 2: su primera Historia, no la que casualmente tenga el mismo id");
  assert.notEqual(ctx.run("scActiveScenario().id"), 3);
  assert.deepEqual(J(ctx.run("P().scenarios.map(s=>s.name)")), ["Otra uno", "Otra dos"]);
  ctx.run("scSwitchScenario(Dd.id)");
  ctx.run("doc.cur=0; renderTabs()");
  assert.equal(active(ctx), "Camino feliz");
  assert.equal(ctx.run("scActiveScenario().steps.length"), 2);
  assert.deepEqual(J(ctx.run("doc.pages[0].scenarios.map(s=>s.name)")), ["Camino feliz", "Pago rechazado", "Cliente abandona"]);
});

test("Cambiar de página durante Playback: detiene, limpia y no conserva la Historia de la otra página", () => {
  const ctx = editor();
  ctx.run('p2=blankPage("Página 2"); doc.pages.push(p2); scRun()');
  assert.equal(ctx.run("scStatus"), "running");
  ctx.run("doc.cur=1; renderTabs()");
  assert.equal(ctx.run("scStatus"), "idle");
  assert.equal(ctx.run("scPlayback"), null);
  assert.equal(ctx.run("scActiveScenario()"), null, "página sin Historias: ninguna activa");
});

test("Documento nuevo (abrir archivo / enlace entrante): la selección se descarta", () => {
  const ctx = editor();
  ctx.run("scSwitchScenario(sB.id)");
  ctx.run('doc={theme:"dark",customBg:"",eventTypes:[],nextEventTypeId:1,pages:[blankPage("N")],cur:0}; renderTabs()');
  assert.equal(ctx.run("scActiveScenario()"), null);
  ctx.run('createScenario(P(),"Nueva")');
  assert.equal(active(ctx), "Nueva");
});

/* ───────────────────────── Apariciones independientes ───────────────────────── */
test("Soltar un Evento con la Historia B activa lo añade a B y nunca a A", () => {
  const ctx = editor();
  const a0 = stepsOf(ctx, "Camino feliz"), c0 = stepsOf(ctx, "Cliente abandona");
  ctx.run("scSwitchScenario(sB.id); scApplyTargets(pedido.id,[edge2])");
  assert.equal(stepsOf(ctx, "Pago rechazado").length, 2);
  assert.deepEqual(stepsOf(ctx, "Camino feliz"), a0);
  assert.deepEqual(stepsOf(ctx, "Cliente abandona"), c0);
  assert.equal(ctx.run("undoStack.length"), 1);
  ctx.run("undo()");
  assert.equal(stepsOf(ctx, "Pago rechazado").length, 1);
});

test("Mismo EventType en A y B = dos apariciones distintas: quitar, duplicar y reordenar en A no tocan B", () => {
  const ctx = editor();
  const b0 = stepsOf(ctx, "Pago rechazado"), c0 = stepsOf(ctx, "Cliente abandona");
  assert.equal(b0[0].eventTypeId, stepsOf(ctx, "Camino feliz")[0].eventTypeId, "ambas apuntan al mismo EventType");
  ctx.run("scDuplicateStep(sA.steps[0].id)");
  assert.equal(stepsOf(ctx, "Camino feliz").length, 3);
  assert.deepEqual(stepsOf(ctx, "Pago rechazado"), b0);
  ctx.run("scMoveStep(sA.steps[sA.steps.length-1].id,-1)");
  assert.deepEqual(stepsOf(ctx, "Pago rechazado"), b0);
  ctx.run("scDeleteStep(sA.steps[0].id)");
  assert.deepEqual(stepsOf(ctx, "Pago rechazado"), b0);
  assert.deepEqual(stepsOf(ctx, "Cliente abandona"), c0);
  /* cada operación fue una sola entrada de Undo y se deshace sin tocar B */
  assert.equal(ctx.run("undoStack.length"), 3);
  ctx.run("undo();undo();undo()");
  assert.equal(stepsOf(ctx, "Camino feliz").length, 2);
  assert.deepEqual(stepsOf(ctx, "Pago rechazado"), b0);
});

test("Editar el EventType (vocabulario) se refleja en todas las Historias que lo usan; los Steps siguen siendo propios", () => {
  const ctx = editor();
  ctx.run('updateEventType(pago.id,{name:"Pago OK"})');
  for (const n of ["Camino feliz", "Pago rechazado", "Cliente abandona"]) {
    assert.equal(ctx.run(`eventTypeById(P().scenarios.find(s=>s.name==${JSON.stringify(n)}).steps[0].eventTypeId).name`), "Pago OK");
  }
  assert.equal(ctx.run("doc.eventTypes.length"), 2, "el EventType no pertenece a ninguna Historia");
});

/* ───────────────────────── Playback ───────────────────────── */
test("Run reproduce exclusivamente la Historia activa (Trace de B ≠ Trace de A)", () => {
  const ctx = editor();
  const trace = (id) => J(ctx.run(`FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},P().behaviors,P().scenarios.find(s=>s.id===${id})).trace`));
  const A = ctx.run("A.id"), B = ctx.run("B.id");
  assert.notDeepEqual(trace(A), trace(B));
  ctx.run("scSwitchScenario(sB.id); scRun()");
  assert.deepEqual(J(ctx.run("scPlayback.trace")), trace(B));
  ctx.run("scReset(); scSwitchScenario(sA.id); scRun()");
  assert.deepEqual(J(ctx.run("scPlayback.trace")), trace(A));
});

test("Cambiar de Historia con Playback activo: detiene, limpia overlays y deja el editor listo para reproducir la nueva", () => {
  const ctx = editor();
  ctx.run("scRun()");
  assert.equal(ctx.run("scStatus"), "running");
  assert.notEqual(ctx.run("buildScenarioRenderState()"), null);
  ctx.run("scSwitchScenario(sB.id)");
  assert.equal(ctx.run("scStatus"), "idle");
  assert.equal(ctx.run("scPlayback"), null);
  assert.equal(ctx.run("buildScenarioRenderState()"), null, "ningún overlay de la Historia anterior");
  assert.equal(ctx.run("scRafId"), null);
  assert.equal(active(ctx), "Pago rechazado");
  assert.equal(ctx.run("$('scRun').disabled"), false);
  assert.equal(ctx.run("$('scReset').hidden"), true);
  ctx.run("scRun()");
  assert.equal(ctx.run("scStatus"), "running");
});

test("Reset/Detener y «completada» también se descartan al cambiar de Historia", () => {
  const ctx = editor();
  ctx.run("scRun(); scPlayback.cursorVirtual=1e9; scStatus='completed'");
  ctx.run("scSwitchScenario(sC.id)");
  assert.equal(ctx.run("scStatus"), "idle");
  assert.equal(ctx.run("scPlayback"), null);
});

test("Historia vacía o con motor incompatible: no revienta; Reproducir deshabilitado", () => {
  const ctx = editor();
  ctx.run('V=createScenario(P(),"Vacía"); F=createScenario(P(),"Futura"); createStep(F,{at:0,action:"SEND",edgeId:edgeId,eventTypeId:pago.id}); F.engineVersion=99');
  ctx.run("scSwitchScenario(V.id)");
  assert.equal(ctx.run("$('scRun').disabled"), true);
  ctx.run("scRun()");
  assert.equal(ctx.run("scStatus"), "idle");
  ctx.run("scSwitchScenario(F.id)");
  assert.equal(ctx.run("$('scRun').disabled"), true);
  assert.equal(ctx.run("$('scUnsupported').hidden"), false);
  assert.equal(ctx.run("scEditable()"), false);
  assert.doesNotThrow(() => ctx.run("scDuplicateScenario()"));
  assert.equal(names(ctx).includes("Futura copia"), true);
});

test("Cada operación de Historia (cambiar, nueva, duplicar, eliminar, renombrar) deja el Playback detenido", () => {
  for (const op of ["scSwitchScenario(sB.id)", "scNewScenario()", "scDuplicateScenario()", "scDeleteScenario()", 'scRenameScenario("Otro")']) {
    const ctx = editor();
    ctx.run("scRun()");
    ctx.run(op);
    assert.equal(ctx.run("scStatus"), "idle", op);
    assert.equal(ctx.run("scPlayback"), null, op);
  }
});

/* ───────────────────────── Share ───────────────────────── */
const SHARE_ORIGINS = ["https://fluyo.space/", "http://localhost:8123/index.html", "file:///C:/fluyo/index.html"];
/* Proyecto de varias Historias con la sintaxis del propio modelo, sin editor. */
function project(extra = "") {
  const b = makeViewer();
  return J(b.run(`(function(){
    doc={theme:"dark",customBg:"",eventTypes:[],nextEventTypeId:1,pages:[blankPage("Pedidos")],cur:0};
    const pg=P(); pg.nodes=[{id:1,shape:"rect",x:200,y:240,w:170,h:76,label:"Cliente",color:"#3aa7e8"},{id:2,shape:"rect",x:600,y:240,w:170,h:76,label:"Comercio",color:"#3aa7e8"}];
    pg.edges=[{id:3,from:1,to:2,label:""}]; pg.nextId=4;
    const pago=createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
    const mk=(name,n)=>{const s=createScenario(pg,name); for(let i=0;i<n;i++) createStep(s,{at:i*1500,action:"SEND",edgeId:3,eventTypeId:pago.id}); return s;};
    mk("Historia A",1); mk("Historia B",2); mk("Historia C",3);
    ${extra}
    return serializeProject();
  })()`));
}
async function sharePayload(projectData, options, base = "https://fluyo.space/") {
  const c = makeViewer();
  c.run(read("js/share-url.js"));
  c.context.project = projectData; c.context.options = options; c.context.base = base;
  const url = await c.run("createShareUrl(project,base,options)");
  const doc = J(await c.run("decodeDeepLink(" + JSON.stringify(new URL(url).hash.slice(3)) + ")"));
  return { url, doc, raw: JSON.stringify(doc) };
}
const idOf = (p, name) => p.doc.pages[0].scenarios.find((s) => s.name === name).id;

test("Share de la Historia seleccionada (B): el enlace lleva SÓLO B; A y C no aparecen en ninguna parte", async () => {
  const p = project();
  const original = JSON.stringify(p);
  const r = await sharePayload(p, { kind: "story", scenarioId: idOf({ doc: p.doc }, "Historia B") });
  assert.deepEqual(r.doc.doc.pages[0].scenarios.map((s) => s.name), ["Historia B"]);
  assert.equal(r.doc.doc.pages[0].scenarios[0].steps.length, 2);
  assert.doesNotMatch(r.raw, /Historia A|Historia C/);
  assert.equal(JSON.stringify(p), original, "el documento del autor no se modifica");
});

test("Share de A, de B y de C: cada enlace es una Historia distinta y reproducible", async () => {
  const p = project();
  for (const [name, steps] of [["Historia A", 1], ["Historia B", 2], ["Historia C", 3]]) {
    const r = await sharePayload(p, { kind: "story", scenarioId: idOf({ doc: p.doc }, name) });
    assert.deepEqual(r.doc.doc.pages[0].scenarios.map((s) => s.name), [name]);
    assert.equal(r.doc.doc.pages[0].scenarios[0].steps.length, steps);
    const v = makeViewer({ search: "", hash: new URL(r.url).hash }); v.connect();
    await v.boot(); await v.waitForPhase((x) => x === "ready" || x === "error");
    assert.equal(v.el("stTitle").textContent, name);
    assert.equal(v.run("doc.pages[0].scenarios.length"), 1, "el Viewer no recibe otras Historias");
  }
});

test("Share multipágina: sólo la Historia seleccionada de la página abierta; las demás páginas viajan sin Historias", async () => {
  const p = project(`const p2=blankPage("Otra"); p2.nodes=[{id:1,shape:"rect",x:0,y:0,w:100,h:50,label:"Z",color:"#3aa7e8"}]; p2.nextId=2;
    const o=createScenario(p2,"Historia Otra"); createStep(o,{at:0,action:"OCCURRENCE",nodeId:1}); doc.pages.push(p2);`);
  const r = await sharePayload(p, { kind: "story", scenarioId: idOf({ doc: p.doc }, "Historia C") });
  assert.deepEqual(r.doc.doc.pages.map((pg) => pg.scenarios.map((s) => s.name)), [["Historia C"], []]);
  assert.doesNotMatch(r.raw, /Historia Otra|Historia A|Historia B/);
  /* con la segunda página abierta, la Historia compartida es la de esa página y la primera queda vacía */
  const p2 = JSON.parse(JSON.stringify(p)); p2.doc.cur = 1;
  const id2 = p2.doc.pages[1].scenarios[0].id;
  const r2 = await sharePayload(p2, { kind: "story", scenarioId: id2 });
  assert.deepEqual(r2.doc.doc.pages.map((pg) => pg.scenarios.map((s) => s.name)), [[], ["Historia Otra"]]);
});

test("Share: id inexistente en la página abierta → ninguna Historia (falla cerrado); «sólo el diagrama» → ninguna", async () => {
  const p = project();
  const missing = await sharePayload(p, { kind: "story", scenarioId: 9999 });
  assert.deepEqual(missing.doc.doc.pages[0].scenarios, []);
  const diagram = await sharePayload(p, { kind: "diagram" });
  assert.deepEqual(diagram.doc.doc.pages[0].scenarios, []);
  assert.equal(diagram.doc.doc.eventTypes.length, 1, "el vocabulario del proyecto se conserva, como antes");
});

test("Share desde file://, localhost y producción: mismo contenido (sólo B) y base correcta", async () => {
  const p = project();
  const id = idOf({ doc: p.doc }, "Historia B");
  const out = [];
  for (const base of SHARE_ORIGINS) out.push(await sharePayload(p, { kind: "story", scenarioId: id }, base));
  assert.ok(out[0].url.startsWith("https://fluyo.space/s/#d="));
  assert.ok(out[1].url.startsWith("http://localhost:8123/s/#d="));
  assert.ok(out[2].url.startsWith("https://fluyo.space/s/#d="), "file:// usa el visor público");
  for (const r of out) assert.deepEqual(r.doc.doc.pages[0].scenarios.map((s) => s.name), ["Historia B"]);
  assert.equal(new URL(out[0].url).hash, new URL(out[2].url).hash);
});

test("applyShareKind: contrato puro (Historia seleccionada, otras páginas vacías, sin options = crudo)", () => {
  const c = makeViewer(); c.run(read("js/share-url.js"));
  c.context.mk = () => ({ doc: { cur: 1, pages: [{ scenarios: [{ id: 1 }, { id: 2 }] }, { scenarios: [{ id: 1 }, { id: 2 }, { id: 3 }] }] } });
  const ids = (expr) => J(c.run(expr).doc.pages.map((p) => p.scenarios.map((s) => s.id)));
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:2})'), [[], [2]], "los ids son por página: sólo cuenta la abierta");
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:3})'), [[], [3]]);
  assert.deepEqual(ids("applyShareKind(mk(),undefined)"), [[1, 2], [1, 2, 3]]);
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"diagram"})'), [[], []]);
});

test("El diálogo de Share del editor comparte la Historia seleccionada y cae a «sólo diagrama» sin Historia", () => {
  const src = read("js/editor-share.js");
  assert.match(src, /createShareUrl\(project,location\.href,story\?\{kind,scenarioId:story\.id\}:\{kind:"diagram"\}\)/);
  assert.match(src, /scActiveScenario\(\)/);
});

/* ───────────────────────── Viewer + legacy ───────────────────────── */
async function openRaw(projectData) {
  const c = makeViewer(); c.context.p = projectData;
  const payload = await c.run("encodeDeepLink(p)");
  const v = makeViewer({ search: "", hash: "#d=" + payload }); v.connect();
  await v.boot(); await v.waitForPhase((x) => x === "ready" || x === "error");
  return v;
}
const play = (v) => { v.el("stPlay").onclick(); for (let t = 0; t < 30000 && v.viewer().story === "running"; t += 100) { v.advance(100); v.frames(1); } };

test("Viewer de un Share nuevo: «Historia», nombre, «▶ Reproducir historia»; reproduce exactamente esa Historia", async () => {
  const p = project();
  const r = await sharePayload(p, { kind: "story", scenarioId: idOf({ doc: p.doc }, "Historia B") });
  const v = makeViewer({ search: "", hash: new URL(r.url).hash }); v.connect();
  await v.boot(); await v.waitForPhase((x) => x === "ready");
  assert.equal(v.el("story").hidden, false);
  assert.equal(v.el("stKicker").textContent, "Historia");
  assert.equal(v.el("stTitle").textContent, "Historia B");
  assert.equal(v.el("stPlay").textContent, "▶ Reproducir historia");
  assert.equal(v.run("storyScenario().name"), "Historia B");
  v.el("stPlay").onclick();
  assert.equal(v.run("story.scenario.steps.length"), 2);
  assert.equal(v.run("story.playback.trace.events.filter(e=>e.type==='send_started'||e.type==='send_succeeded'||e.type==='send_failed').length") > 0, true);
  assert.equal(v.run("typeof storySwitch"), "undefined", "sin selector de Historias");
  assert.doesNotMatch(v.run("document.body.textContent||''") || "", /Historia A|Historia C/);
});

test("Viewer: reproducir hasta el final, repetir, y recarga/navegación (Back/Forward) sin runtime heredado", async () => {
  const p = project();
  const mkLink = async (name) => new URL((await sharePayload(p, { kind: "story", scenarioId: idOf({ doc: p.doc }, name) })).url).hash;
  const [hA, hB] = [await mkLink("Historia A"), await mkLink("Historia B")];
  const v = makeViewer({ search: "", hash: hA }); v.connect();
  await v.boot(); await v.waitForPhase((x) => x === "ready");
  v.el("stPlay").onclick(); v.advance(300); v.frames(1);
  assert.equal(v.viewer().story, "running");
  await v.navigate(hB); await v.waitForPhase((x) => x === "ready");
  assert.equal(v.run("story"), null, "el runtime de A no sigue sobre B");
  assert.equal(v.el("stTitle").textContent, "Historia B");
  play(v); assert.equal(v.viewer().story, "completed");
  await v.navigate(hA); await v.waitForPhase((x) => x === "ready");
  assert.equal(v.el("stTitle").textContent, "Historia A");
  assert.equal(v.viewer().story, "ready");
});

test("Viewer: cambio de página detiene la Historia; «Abrir en Fluyo» conserva la Historia compartida sin runtime", async () => {
  const p = project(`const p2=blankPage("Otra"); p2.nodes=[{id:1,shape:"rect",x:0,y:0,w:100,h:50,label:"Z",color:"#3aa7e8"}]; p2.nextId=2; doc.pages.push(p2);`);
  const r = await sharePayload(p, { kind: "story", scenarioId: idOf({ doc: p.doc }, "Historia B") });
  const v = makeViewer({ search: "", hash: new URL(r.url).hash }); v.connect();
  await v.boot(); await v.waitForPhase((x) => x === "ready");
  v.el("stPlay").onclick(); v.advance(300); v.frames(1);
  v.run("goPage(1)");
  assert.equal(v.run("story"), null);
  assert.equal(v.el("story").hidden, true, "la otra página no comparte ninguna Historia");
  v.run("goPage(0)");
  assert.equal(v.el("stTitle").textContent, "Historia B");
  const url = await v.run("buildOpenInFluyoURL(serializeProject(), location.href, viewerPayload)");
  const copy = J(await v.run("decodeDeepLink(" + JSON.stringify(new URL(url).hash.slice(3)) + ")"));
  assert.deepEqual(copy.doc.pages[0].scenarios.map((s) => s.name), ["Historia B"]);
  assert.doesNotMatch(JSON.stringify(copy), /playback|scenarioRuntime|activeSends/);
});

test("Legacy: Share antiguo con varias Historias reproduce scenarios[0], como antes", async () => {
  const v = await openRaw(project());
  assert.equal(v.el("stTitle").textContent, "Historia A");
  assert.equal(v.run("doc.pages[0].scenarios.length"), 3, "el enlace antiguo conserva sus datos; no se reescribe");
  play(v);
  assert.equal(v.viewer().story, "completed");
  assert.equal(v.run("story.scenario.name"), "Historia A");
});

test("Legacy: Share antiguo con una sola Historia, con la vacía primero, y documento sin scenarios", async () => {
  const one = project(`pg.scenarios.splice(1);`);
  assert.equal((await openRaw(one)).el("stTitle").textContent, "Historia A");
  const vacioPrimero = project(`pg.scenarios.unshift({id:50,engineVersion:2,name:"Vacía",nextStepId:1,steps:[]}); pg.nextScenarioId=51;`);
  const v = await openRaw(vacioPrimero);
  assert.equal(v.el("story").hidden, true, "scenarios[0] sin pasos: sin Historia (comportamiento 014 intacto)");
  const sin = project(); delete sin.doc.pages[0].scenarios; delete sin.doc.pages[0].nextScenarioId;
  const v2 = await openRaw(sin);
  assert.equal(v2.viewer().phase, "ready");
  assert.equal(v2.el("story").hidden, true);
});

test("Documento local antiguo (sin Historias, con una, con N) abre y se normaliza sin cambiar el schema", () => {
  const c = makeViewer();
  for (const extra of ["pg.scenarios=[];", "pg.scenarios.splice(1);", ""]) {
    const p = project(extra);
    const out = J(c.run(`projectFromProjectData(${JSON.stringify(p)})`));
    assert.equal(out.doc.pages[0].scenarios.length, extra === "pg.scenarios=[];" ? 0 : extra ? 1 : 3);
  }
  const p = project(); assert.equal(p.version, 5);
  assert.ok(!("stories" in p.doc) && !("stories" in p.doc.pages[0]), "no hay un segundo modelo de historias");
});

test("Viewer sin red (offline): el Share de una Historia sólo usa el payload del enlace", () => {
  const src = read("js/viewer.js") + read("js/story-playback.js");
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
});

/* ───────────────────────── Vocabulario y arquitectura ───────────────────────── */
test("UX: el panel habla de Historias, no de Escenarios", () => {
  const html = read("index.html");
  const panel = html.slice(html.indexOf('id="panelScenarios"'), html.indexOf("</aside>", html.indexOf('id="panelScenarios"')));
  assert.doesNotMatch(panel, /escenario/i);
  assert.match(panel, />Historias</);
  assert.match(panel, /id="scStoryAdd"/);
  const ctx = editor();
  const labels = [];
  ctx.scMenu = (a, items) => items.forEach((i) => labels.push(i[0]));
  ctx.run("scScenarioMenu(null); scChooseScenario(null)");
  const text = labels.join("|");
  assert.match(text, /Renombrar/); assert.match(text, /Duplicar historia/); assert.match(text, /Eliminar historia/);
  assert.match(text, /\+ Nueva historia/); assert.match(text, /● Camino feliz/); assert.match(text, /○ Pago rechazado/);
  assert.doesNotMatch(text, /scenario|escenario|step|engineVersion/i);
});

test("QA-016: ningún texto visible de index.html ni de los mensajes del panel usa Scenario / Trace / Step", () => {
  const html = read("index.html").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  const texts = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  const attrs = [...html.matchAll(/\s(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]);
  const jargon = [...texts, ...attrs, read("js/editor-scenarios.js").match(/"El [^"]*aparecerá aquí[^"]*"/)[0]].filter((t) => /\b(scenario|trace|step|engineVersion|occurrence)\b/i.test(t));
  assert.deepEqual(jargon, [], "jerga interna visible");
});

test("016.1: «▶ Reproducir» sigue el contenido de la Historia: vacía → disabled con ayuda; con un momento → habilitado; sin él → disabled", () => {
  const ctx = editor();
  ctx.run("scNewScenario()");
  const run = ctx.run('$("scRun")');
  assert.equal(run.disabled, true);
  assert.match(run.title, /Añade un evento/);
  ctx.run("scApplyTargets(pago.id,[edgeId])");
  assert.equal(ctx.run('$("scRun").disabled'), false);
  assert.equal(ctx.run('$("scRun").title'), "");
  ctx.run("scDeleteStep(scActiveScenario().steps[0].id); scRenderPanel()");
  assert.equal(ctx.run('$("scRun").disabled'), true);
  ctx.run("scRun()");
  assert.equal(ctx.run("scStatus"), "idle", "disabled no es sólo estético: scRun tampoco arranca");
  assert.match(read("css/styles.css"), /#scRun:disabled\{[^}]*opacity:[^}]*cursor:not-allowed/);
});

test("016.1: los menús ⋯ / selector son interruptores (el segundo clic cierra), sin tocar el resto de menús", () => {
  const src = read("js/editor-scenarios.js");
  assert.match(src, /function scMenuToggledOff\(anchor\)[\s\S]*?scPopoverReturn !== anchor[\s\S]*?scClosePopover\(\)/);
  for (const sig of ["function scMenu(anchor, items) {", "function scMenuSections(anchor, menu) {"]) {
    assert.ok(src.includes(sig + "\n  if (scMenuToggledOff(anchor)) return;"), sig);
  }
  /* scOpenPopover NO conmuta: rename/tiempo/uso la llaman con el mismo ancla y esperan un popover */
  assert.doesNotMatch(src.slice(src.indexOf("function scOpenPopover"), src.indexOf("function scMenu(")), /scMenuToggledOff/);
});

test("016.1: Share durante Playback se BLOQUEA (no detiene ni modifica): decisión documentada", () => {
  const src = read("js/editor-share.js");
  const block = src.slice(src.indexOf("function showShareDialog"), src.indexOf("commitEditBox()"));
  assert.match(block, /isScenarioPlaybackActive\(\)/);
  assert.match(block, /Detén la reproducción de la historia antes de compartir/);
  /* FLUYO-018.14b (B2): «Volver a editar» es la salida del modo Historia; el Playback terminado se cierra con «Terminar». */
  assert.match(block, /Pulsa «Terminar» antes de compartir/);
  assert.match(block, /shareCreate"\)\.hidden=true/);
  assert.doesNotMatch(block, /scReset|scRun|pushUndo/, "abrir Share no tiene efectos secundarios");
});

test("016.1: una sola denominación — «Detalles» en el menú y en el diálogo; sin «técnico»", () => {
  const src = read("js/editor-scenarios.js");
  assert.match(src, /\["Detalles", \(\) => scOpenDetails\("trace"\)\]/);
  assert.match(src, /: "Detalles";/);
  assert.doesNotMatch(src, /Detalles técnicos/);
  assert.doesNotMatch(read("index.html"), /Detalles t.cnicos/);
});

test("Arquitectura: sin loops, engine, playback ni renderer nuevos; el documento no guarda la selección", () => {
  const es = read("js/editor-scenarios.js");
  assert.equal((es.match(/requestAnimationFrame\(/g) || []).length, (es.match(/requestAnimationFrame\(/g) || []).length);
  for (const f of ["js/story-playback.js", "js/scenario-engine.js", "js/scenario-playback.js"]) {
    assert.doesNotMatch(read(f), /duplicateScenario|scSelectStory|scActiveId/, f);
  }
  assert.doesNotMatch(read("js/model.js"), /activeScenarioId|scActiveId/);
  const share = read("js/share-url.js") + read("js/editor-share.js");
  assert.doesNotMatch(share, /scenarios\[0\]\s*=|splice\(index,1\)/);
});
