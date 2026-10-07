"use strict";
/* FLUYO-018.7c — delete_page: dominio (pageRemovalImpactIn, pageCurAfterRemoval, deletePageIn, restorePageIn), autoría (FluyoAuthoring:
   expectedName, índices estables en el lote, pageMap, PAGE_DELETED, revisiones), integridad, documentos antiguos, paridad con el editor
   real y golden compartido con fluyo-mcp (FLUYO_UPDATE_GOLDEN=1 lo regenera). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { kernel, editor, J, revisionOf, page, project } = require("./fluyo-018-7c-harness.cjs");

const K = kernel();
const apply = (p, ops) => K.call("FluyoAuthoring.apply(__a.p, __a.o)", { p, o: ops });
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.errors)); return r; };
const err = (r, code) => { assert.equal(r.ok, false, "debía rechazarse"); assert.equal(r.project, undefined, "un rechazo no devuelve documento"); assert.equal(r.errors[0].code, code, JSON.stringify(r.errors)); return r.errors[0]; };
const normalize = (p) => K.call("projectFromProjectData(__a).doc", p);
const valid = (p) => K.call("FluyoIntegrity.validateProject(__a)", p);
const dom = (p, expr) => K.call(`(function(){ const d=projectFromProjectData(__a).doc; try{ const r=(${expr}); return {r, d}; }catch(e){ return {code:e.code, d}; } })()`, p);
const frozen = (o) => { const f = (x) => { if (x && typeof x === "object") { Object.freeze(x); Object.values(x).forEach(f); } return x; }; return f(o); };

const DP = (pageIndex, expectedName) => ({ op: "delete_page", scope: "document", pageIndex, expectedName });
const N = (pageIndex, spec = {}, extra = {}) => Object.assign({ op: "create_node", scope: "page", pageIndex, spec: Object.assign({ shape: "rect", x: 0, y: 0 }, spec) }, extra);
const C = (pageIndex, source, target, extra = {}) => Object.assign({ op: "create_connection", scope: "page", pageIndex, source, target }, extra);
const R = (ref) => ({ ref });
const names = (p) => p.doc.pages.map((pg) => pg.name);
const curName = (p) => p.doc.pages[p.doc.cur].name;

/* Documento de trabajo (4 páginas, activa «Pagos»):
   0 «Inicio»   — 1 nodo, sin Historias.
   1 «Pagos»    — 3 nodos, 2 conexiones (una con waypoints), Behavior DOWN, 2 Historias («Compra» 2 momentos/3 pasos, «Reembolso»).
   2 «Envíos»   — 2 nodos, 1 conexión, una Historia con el evento compartido.
   3 «Vacía»    — nada.
   EventTypes: «Pago» (solo en Pagos), «Aviso» (Pagos y Envíos), «Libre» (sin uso). */
function base() {
  const P1 = 1, P2 = 2;
  const ops = [
    { op: "create_page", scope: "document", name: "Pagos" }, { op: "create_page", scope: "document", name: "Envíos" }, { op: "create_page", scope: "document", name: "Vacía" },
    { op: "rename_page", scope: "document", pageIndex: 0, name: "Inicio" },
    N(0, { label: "Portada" }),
    N(P1, { x: 100, y: 100, label: "Cliente" }, { ref: "cli" }), N(P1, { x: 400, y: 100, label: "Banco" }, { ref: "ban" }), N(P1, { x: 700, y: 100, label: "Comercio" }, { ref: "com" }),
    C(P1, R("cli"), R("ban"), { ref: "pago", spec: { waypoints: [{ x: 250, y: 40 }, { x: 250, y: 160 }], label: "paga" } }), C(P1, R("ban"), R("com"), { ref: "abono" }),
    { op: "set_initial_availability", scope: "page", pageIndex: P1, nodeId: R("ban"), state: "DOWN" },
    { op: "create_event_type", scope: "eventType", name: "Pago", primitive: "FLOW", sentence: "{source} paga a {target}", ref: "etPago" },
    { op: "create_event_type", scope: "eventType", name: "Aviso", primitive: "OCCURRENCE", sentence: "{target} avisa", ref: "etAviso" },
    { op: "create_event_type", scope: "eventType", name: "Libre", primitive: "OCCURRENCE", sentence: "{target} libre" },
    { op: "create_story", scope: "story", pageIndex: P1, name: "Compra", ref: "compra" },
    { op: "add_step", scope: "story", pageIndex: P1, storyId: R("compra"), eventTypeId: R("etPago"), target: { edgeId: R("pago") } },
    { op: "add_step", scope: "story", pageIndex: P1, storyId: R("compra"), eventTypeId: R("etAviso"), target: { nodeId: R("ban") }, ref: "s2" },
    { op: "add_step", scope: "story", pageIndex: P1, storyId: R("compra"), eventTypeId: R("etPago"), target: { edgeId: R("abono") }, placement: { sameMomentAs: R("s2") } },
    { op: "create_story", scope: "story", pageIndex: P1, name: "Reembolso" },
    N(P2, { label: "Almacén" }, { ref: "alm" }), N(P2, { x: 300, label: "Reparto" }, { ref: "rep" }), C(P2, R("alm"), R("rep")),
    { op: "create_story", scope: "story", pageIndex: P2, name: "Entrega", ref: "ent" },
    { op: "add_step", scope: "story", pageIndex: P2, storyId: R("ent"), eventTypeId: R("etAviso"), target: { nodeId: R("rep") } },
  ];
  const p = J(ok(apply(project([page("Página 1")]), ops)).project);
  p.doc.cur = 1;
  return p;
}
const B = base();

/* ───────────── dominio ───────────── */
test("pageRemovalImpactIn: cuenta lo que se pierde (nodos, conexiones, Behaviors, Historias con pasos y momentos, EventTypes que quedan sin uso) y es pura", () => {
  const { r, d } = dom(B, "pageRemovalImpactIn(d,1)");
  assert.deepEqual(r, { pageIndex: 1, name: "Pagos", nodes: 3, connections: 2, behaviors: 1,
    stories: [{ storyId: 1, name: "Compra", steps: 3, moments: 2 }, { storyId: 2, name: "Reembolso", steps: 0, moments: 0 }],
    eventTypesFreed: [1], isCurrent: true, isLastPage: false });
  assert.deepEqual(d, normalize(B), "no muta el documento");
  assert.deepEqual(dom(B, "pageRemovalImpactIn(d,2)").r.eventTypesFreed, [], "«Aviso» sigue usado en Pagos");
  assert.deepEqual(dom(B, "pageRemovalImpactIn(d,3)").r, { pageIndex: 3, name: "Vacía", nodes: 0, connections: 0, behaviors: 0, stories: [], eventTypesFreed: [], isCurrent: false, isLastPage: false });
  for (const bad of ["4", "-1", "1.5", "'1'", "null", "undefined", "NaN"]) assert.equal(dom(B, `pageRemovalImpactIn(d,${bad})`).code, "page_not_found", bad);
  assert.equal(dom(project([page("Única")]), "pageRemovalImpactIn(d,0).isLastPage").r, true);
});

test("pageCurAfterRemoval: tabla completa (activa, anterior, posterior, primera, última) y nunca fuera de rango", () => {
  for (let len = 2; len <= 6; len++) for (let cur = 0; cur < len; cur++) for (let i = 0; i < len; i++) {
    const got = K.call("pageCurAfterRemoval(__a.c,__a.i,__a.l)", { c: cur, i, l: len });
    const want = i < cur ? cur - 1 : i > cur ? cur : Math.min(i, len - 2);
    assert.equal(got, want, `len ${len} cur ${cur} borra ${i}`);
    assert.ok(got >= 0 && got < len - 1, "dentro de rango");
    if (i !== cur) {
      const pages = [...Array(len).keys()], after = pages.filter((x) => x !== i);
      assert.equal(after[got], cur, "si la activa sobrevive, sigue siendo la misma página");
    }
  }
});

test("deletePageIn: primera, intermedia, última, activa, anterior y posterior a la activa — página fuera entera, cur por la regla, EventTypes intactos", () => {
  const cases = [
    { i: 0, cur: 1, names: ["Pagos", "Envíos", "Vacía"], curName: "Pagos" },     // anterior a la activa: cur-1, misma página
    { i: 1, cur: 1, names: ["Inicio", "Envíos", "Vacía"], curName: "Envíos" },    // la activa: pasa a la siguiente
    { i: 2, cur: 1, names: ["Inicio", "Pagos", "Vacía"], curName: "Pagos" },      // posterior: no cambia
    { i: 3, cur: 3, names: ["Inicio", "Pagos", "Envíos"], curName: "Envíos" },    // la última y activa: la anterior
    { i: 0, cur: 0, names: ["Pagos", "Envíos", "Vacía"], curName: "Pagos" },      // la primera y activa: la siguiente
  ];
  for (const c of cases) {
    const p = J(B); p.doc.cur = c.cur;
    const before = normalize(p);
    const { r, d } = K.call("(function(){ const d=projectFromProjectData(__a.p).doc; const page=d.pages[__a.i]; const r=deletePageIn(d,__a.i); return {r:{same:r.page===page, pageIndex:r.pageIndex, cur:r.cur, impact:r.impact}, d}; })()", { p, i: c.i });
    assert.deepEqual(d.pages.map((x) => x.name), c.names, JSON.stringify(c));
    assert.equal(d.pages[d.cur].name, c.curName, JSON.stringify(c));
    assert.deepEqual(r.cur, { from: c.cur, to: d.cur });
    assert.equal(r.same, true, "devuelve el MISMO objeto página");
    assert.deepEqual(d.eventTypes, before.eventTypes, "los EventTypes globales no se tocan");
    assert.equal(d.nextEventTypeId, before.nextEventTypeId);
    assert.deepEqual(d.pages, before.pages.filter((_, k) => k !== c.i), "las demás páginas, idénticas y en orden");
    assert.equal(valid(K.call("projectToSerializable(__a, {})", d)).valid, true, "sin referencias colgantes");
  }
});

test("deletePageIn: la única página (last_page), índices inválidos y documentos mal formados se rechazan sin mutar", () => {
  const one = project([page("Única")]);
  const r = dom(one, "deletePageIn(d,0)");
  assert.equal(r.code, "last_page"); assert.deepEqual(r.d, normalize(one));
  for (const bad of ["4", "-1", "0.5", "'0'", "null"]) { const x = dom(B, `deletePageIn(d,${bad})`); assert.equal(x.code, "page_not_found", bad); assert.deepEqual(x.d, normalize(B)); }
  assert.equal(K.call("(function(){ try{ deletePageIn({pages:'x'},0); }catch(e){ return e.code; } })()"), "invalid_document");
});

test("restorePageIn: reinserta el MISMO objeto en su índice, conserva la página activa y deshace exactamente deletePageIn", () => {
  for (let i = 0; i < 4; i++) for (let cur = 0; cur < 4; cur++) {
    const p = J(B); p.doc.cur = cur;
    const r = K.call(`(function(){ const d=projectFromProjectData(__a.p).doc; const before=JSON.stringify(d); const objs=d.pages.slice();
      const del=deletePageIn(d,__a.i); const res=restorePageIn(d,del.pageIndex,del.page); d.cur=objs.indexOf(objs[__a.cur]);
      return {same:d.pages.every((x,k)=>x===objs[k]), equal:JSON.stringify(d)===before, keepsActive:true, cur:res.cur}; })()`, { p, i, cur });
    assert.equal(r.same, true, `identidad ${i}/${cur}`);
    assert.equal(r.equal, true, `documento idéntico ${i}/${cur}`);
  }
  // sin fijar cur a mano: la página activa sigue siendo la misma (desplaza el índice si se inserta antes)
  const keep = K.call(`(function(){ const d=projectFromProjectData(__a).doc; d.cur=2; const active=d.pages[2]; const del=deletePageIn(d,0); restorePageIn(d,0,del.page); return d.pages[d.cur]===active && d.cur===2; })()`, B);
  assert.equal(keep, true);
  const bad = K.call(`(function(){ const d=projectFromProjectData(__a).doc; const out=[]; const pg=d.pages[0];
    for(const f of [()=>restorePageIn(d,0,pg), ()=>restorePageIn(d,9,{name:"x",nodes:[],edges:[]}), ()=>restorePageIn(d,-1,{name:"x",nodes:[],edges:[]}), ()=>restorePageIn(d,0,{name:"x"})]){
      try{ f(); out.push("no"); }catch(e){ out.push(e.code+":"+e.field); } }
    return {out, n:d.pages.length}; })()`, B);
  assert.deepEqual(bad, { out: ["invalid_document:page", "invalid_document:pageIndex", "invalid_document:pageIndex", "invalid_document:page"], n: 4 });
});

test("varios borrados: el resultado (páginas y cur) no depende del orden en que se eliminan", () => {
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let t = 0; t < 200; t++) {
    const len = 2 + Math.floor(rnd() * 5), cur = Math.floor(rnd() * len);
    const victims = [...Array(len).keys()].filter(() => rnd() < 0.5).slice(0, len - 1);
    if (!victims.length) continue;
    const orders = [victims, victims.slice().reverse(), victims.slice().sort(() => rnd() - 0.5)];
    const results = orders.map((o) => K.call(`(function(){ const d={pages:__a.names.map(n=>blankPage(n)), cur:__a.cur, eventTypes:[]};
      for(const name of __a.order) deletePageIn(d, d.pages.findIndex(p=>p.name===name)); return [d.pages.map(p=>p.name), d.pages[d.cur].name]; })()`,
      { names: [...Array(len).keys()].map(String), cur, order: o.map(String) }));
    assert.deepEqual(results[1], results[0], JSON.stringify({ len, cur, victims }));
    assert.deepEqual(results[2], results[0]);
  }
});

/* ───────────── autoría: delete_page ───────────── */
test("delete_page: borra la página entera, informa contenido, Historias, EventTypes liberados y cur; los EventTypes se conservan", () => {
  const r = ok(apply(B, [DP(1, "Pagos")]));
  assert.deepEqual(names(r.project), ["Inicio", "Envíos", "Vacía"]);
  assert.deepEqual(r.changes, [{ operation: "delete_page", scope: "document", operationIndex: 0, entityKind: "page", entityId: 1, pageIndex: 1, deleted: true, name: "Pagos",
    contents: { nodes: 3, connections: 2, behaviors: 1, stories: 2, steps: 3 },
    affects: { stories: [{ pageIndex: 1, storyId: 1, name: "Compra", moments: 2, steps: 3, deleted: true }, { pageIndex: 1, storyId: 2, name: "Reembolso", moments: 0, steps: 0, deleted: true }], eventTypesFreed: [1] },
    cur: { from: 1, to: 2 } }]);
  assert.equal(curName(r.project), "Envíos");
  assert.deepEqual(r.pageMap, [{ from: 0, to: 0 }, { from: 1, to: null }, { from: 2, to: 1 }, { from: 3, to: 2 }]);
  assert.deepEqual(r.project.doc.eventTypes, normalize(B).eventTypes, "«Pago» queda sin uso pero se conserva");
  assert.equal(valid(r.project).valid, true);
  assert.deepEqual(r.refs, []); assert.deepEqual(r.touched, []);
  // la Historia que queda sigue ejecutándose igual
  const trace = (p, pi) => K.call("(function(){ const d=projectFromProjectData(__a.p).doc; const pg=d.pages[__a.pi]; return FluyoStory.run(pg, pg.scenarios[0]); })()", { p, pi });
  assert.deepEqual(trace(r.project, 1), trace(B, 2));
});

test("delete_page: expectedName es obligatorio, debe ser texto y coincidir EXACTAMENTE (sin recortes ni mayúsculas); nada se muta", () => {
  const input = frozen(J(B));
  let e = err(apply(input, [{ op: "delete_page", scope: "document", pageIndex: 1 }]), "INVALID_FIELD"); assert.equal(e.field, "expectedName");
  for (const bad of [null, 1, true, {}, ["Pagos"]]) assert.equal(err(apply(input, [DP(1, bad)]), "INVALID_FIELD").field, "expectedName", JSON.stringify(bad));
  for (const near of ["pagos", "Pagos ", " Pagos", "PAGOS", "Pago", "Envíos", ""]) {
    e = err(apply(input, [DP(1, near)]), "PAGE_MISMATCH");
    assert.deepEqual([e.pageIndex, e.expectedName, e.actualName, e.operationIndex], [1, near, "Pagos", 0], near);
  }
  // un nombre antiguo vacío o largo (regla de entrada no retroactiva) se borra con su nombre exacto
  const legacy = J(B); legacy.doc.pages[3].name = ""; legacy.doc.pages[2].name = "x".repeat(150);
  assert.deepEqual(names(ok(apply(legacy, [DP(3, "")])).project), ["Inicio", "Pagos", "x".repeat(150)]);
  ok(apply(legacy, [DP(2, "x".repeat(150))]));
});

test("delete_page: pageIndex inexistente o mal formado, la única página, campos desconocidos y alcance equivocado se rechazan sin mutar", () => {
  const input = frozen(J(B));
  assert.equal(err(apply(input, [DP(4, "x")]), "PAGE_NOT_FOUND").pageIndex, 4);
  for (const bad of [-1, 1.5, "1", null]) err(apply(input, [DP(bad, "Pagos")]), "INVALID_OPERATION");
  err(apply(input, [{ op: "delete_page", scope: "document", expectedName: "Pagos" }]), "INVALID_OPERATION");
  const one = frozen(project([page("Única")]));
  const last = err(apply(one, [DP(0, "Única")]), "CANNOT_DELETE_LAST_PAGE"); assert.equal(last.pageIndex, 0);
  err(apply(input, [Object.assign(DP(1, "Pagos"), { force: true })]), "INVALID_OPERATION");
  err(apply(input, [Object.assign(DP(1, "Pagos"), { scope: "page" })]), "SCOPE_MISMATCH");
  err(apply(input, [DP(1, "Pagos"), N(0, { shape: "nope" })]), "INVALID_FIELD");                // todo o nada: una operación posterior inválida
});

test("lote: los índices NO se desplazan — delete_page seguido de operaciones sobre otras páginas usa los índices del inicio del lote", () => {
  const r = ok(apply(B, [DP(0, "Inicio"), N(2, { label: "Nuevo" }, { ref: "n" }), { op: "rename_page", scope: "document", pageIndex: 3, name: "Llena" }, N(3, {}, { ref: "m" }), { op: "create_story", scope: "story", pageIndex: 1, name: "Otra" }]));
  assert.deepEqual(names(r.project), ["Pagos", "Envíos", "Llena"]);
  assert.deepEqual(r.project.doc.pages[1].nodes.map((n) => n.label), ["Almacén", "Reparto", "Nuevo"], "pageIndex 2 = «Envíos» durante todo el lote");
  assert.equal(r.project.doc.pages[2].nodes.length, 1);
  assert.deepEqual(r.project.doc.pages[0].scenarios.map((s) => s.name), ["Compra", "Reembolso", "Otra"]);
  assert.deepEqual(r.changes.map((c) => c.pageIndex), [0, 2, 3, 3, 1], "changes[] en índices del lote");
  assert.deepEqual(r.refs, [{ ref: "n", type: "node", pageIndex: 1, id: 4 }, { ref: "m", type: "node", pageIndex: 2, id: 1 }], "refs en índices del documento resultante");
  assert.deepEqual(r.touched, [{ pageIndex: 0, storyId: 3 }]);
  assert.deepEqual(r.pageMap, [{ from: 0, to: null }, { from: 1, to: 0 }, { from: 2, to: 1 }, { from: 3, to: 2 }]);
  assert.equal(curName(r.project), "Pagos");
});

test("lote: varios delete_page — índices estables, cur por la regla y pageMap; borrar dos veces la misma es PAGE_DELETED", () => {
  const r = ok(apply(B, [DP(3, "Vacía"), DP(0, "Inicio"), DP(1, "Pagos")]));
  assert.deepEqual(names(r.project), ["Envíos"]);
  assert.deepEqual(r.pageMap, [{ from: 0, to: null }, { from: 1, to: null }, { from: 2, to: 0 }, { from: 3, to: null }]);
  assert.deepEqual(r.changes.map((c) => c.cur), [{ from: 1, to: 1 }, { from: 1, to: 1 }, { from: 1, to: 2 }], "cur en índices del lote");
  assert.equal(r.project.doc.cur, 0);
  const e = err(apply(B, [DP(2, "Envíos"), DP(2, "Envíos")]), "PAGE_DELETED");
  assert.deepEqual([e.pageIndex, e.deletedBy, e.operationIndex], [2, { operationIndex: 0, operation: "delete_page" }, 1]);
  err(apply(B, [DP(0, "Inicio"), DP(1, "Pagos"), DP(2, "Envíos"), DP(3, "Vacía")]), "CANNOT_DELETE_LAST_PAGE");
});

test("lote: toda operación sobre una página eliminada en el lote es PAGE_DELETED (nunca otra página por desplazamiento)", () => {
  const after = [N(1), C(1, { id: 1 }, { id: 2 }), { op: "update_node", scope: "page", pageIndex: 1, node: { id: 1 }, spec: { x: 5 } }, { op: "delete_node", scope: "page", pageIndex: 1, node: { id: 1 } },
    { op: "reorder_nodes", scope: "page", pageIndex: 1, nodes: [{ id: 1 }], to: "front" }, { op: "duplicate_node", scope: "page", pageIndex: 1, nodes: [{ source: { id: 1 } }] },
    { op: "set_initial_availability", scope: "page", pageIndex: 1, nodeId: 1, state: "UP" }, { op: "create_story", scope: "story", pageIndex: 1 },
    { op: "rename_story", scope: "story", pageIndex: 1, storyId: 1, name: "x" }, { op: "add_step", scope: "story", pageIndex: 1, storyId: 1, eventTypeId: 1, target: { edgeId: 4 } },
    { op: "rename_page", scope: "document", pageIndex: 1, name: "x" }, DP(1, "Pagos")];
  for (const op of after) {
    const e = err(apply(B, [DP(1, "Pagos"), op]), "PAGE_DELETED");
    assert.deepEqual([e.pageIndex, e.operationIndex, e.operation], [1, 1, op.op], op.op);
    assert.match(e.message, /operación 0/);
  }
});

test("lote: create_page + delete_page y rename_page + delete_page", () => {
  // crear y borrar la creada: el índice del lote de la nueva es 4 aunque luego se borre otra
  let r = ok(apply(B, [{ op: "create_page", scope: "document", name: "Tmp" }, DP(4, "Tmp")]));
  assert.deepEqual(names(r.project), names(B)); assert.equal(revisionOf(r.project), revisionOf(ok(apply(B, [{ op: "rename_page", scope: "document", pageIndex: 0, name: "Inicio" }])).project));
  assert.deepEqual(r.pageMap, [{ from: 0, to: 0 }, { from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }, { from: 4, to: null }]);
  // borrar y luego crear: la nueva va al FINAL del lote (índice 4), su nombre por defecto cuenta las páginas vivas (como el editor)
  r = ok(apply(B, [DP(0, "Inicio"), { op: "create_page", scope: "document" }, N(4, { label: "en la nueva" })]));
  assert.deepEqual(names(r.project), ["Pagos", "Envíos", "Vacía", "Página 4"]);
  assert.equal(r.changes[1].pageIndex, 4);
  assert.deepEqual(r.project.doc.pages[3].nodes.map((n) => n.label), ["en la nueva"]);
  assert.deepEqual(r.pageMap.at(-1), { from: 4, to: 3 });
  assert.equal(curName(r.project), "Pagos", "create_page no cambia la página activa");
  // con una sola página: crear antes de borrar es válido; borrar antes de crear no (nunca hay 0 páginas)
  const one = project([page("Única")]);
  r = ok(apply(one, [{ op: "create_page", scope: "document", name: "Otra" }, DP(0, "Única")]));
  assert.deepEqual([names(r.project), r.project.doc.cur], [["Otra"], 0]);
  err(apply(one, [DP(0, "Única"), { op: "create_page", scope: "document" }]), "CANNOT_DELETE_LAST_PAGE");
  // renombrar y borrar con el nombre NUEVO; con el viejo es PAGE_MISMATCH (expectedName mira el nombre actual en el lote)
  ok(apply(B, [{ op: "rename_page", scope: "document", pageIndex: 1, name: "Cobros" }, DP(1, "Cobros")]));
  assert.equal(err(apply(B, [{ op: "rename_page", scope: "document", pageIndex: 1, name: "Cobros" }, DP(1, "Pagos")]), "PAGE_MISMATCH").actualName, "Cobros");
});

test("lote: integridad — los errores preexistentes de una página que solo se desplaza no se atribuyen al lote; B2 y EventTypes usan índices del lote", () => {
  // documento con un error preexistente en «Envíos» (paso a un nodo inexistente): borrar «Inicio» la desplaza y NO debe rechazarse
  const broken = J(B); broken.doc.pages[2].scenarios[0].steps[0].nodeId = 99;
  assert.equal(valid(broken).valid, false);
  const r = ok(apply(broken, [DP(0, "Inicio")]));
  assert.equal(r.validation.preexistingErrors, valid(broken).errors.length);
  // B2 tras un delete_page: el error nombra la página por su índice del lote
  const e = err(apply(B, [DP(0, "Inicio"), { op: "delete_node", scope: "page", pageIndex: 2, node: { id: 2 } }]), "REFERENCED_ENTITY");
  assert.deepEqual([e.pageIndex, e.operationIndex, e.affectedStories[0].pageIndex, e.affectedStories[0].storyName], [2, 1, 2, "Entrega"]);
  // un EventType usado solo por la página eliminada se puede eliminar en el mismo lote; sin borrar la página, no
  err(apply(B, [{ op: "delete_event_type", scope: "eventType", eventTypeId: 1 }]), "REFERENCED_ENTITY");
  const freed = ok(apply(B, [DP(1, "Pagos"), { op: "delete_event_type", scope: "eventType", eventTypeId: 1 }]));
  assert.deepEqual(freed.project.doc.eventTypes.map((x) => x.name), ["Aviso", "Libre"]);
  // «Aviso» sigue en uso en Envíos (índice 2 del lote) aunque Pagos se haya eliminado
  const locked = err(apply(B, [DP(1, "Pagos"), { op: "delete_event_type", scope: "eventType", eventTypeId: 2 }]), "REFERENCED_ENTITY");
  assert.deepEqual(locked.affectedStories.map((s) => [s.pageIndex, s.storyName]), [[2, "Entrega"]]);
  const upd = ok(apply(B, [DP(0, "Inicio"), { op: "update_event_type", scope: "eventType", eventTypeId: 2, name: "Alerta" }]));
  assert.deepEqual(upd.changes[1].affects.stories.map((s) => [s.pageIndex, s.name]), [[1, "Compra"], [2, "Entrega"]]);
});

test("lote: límites de autoría en índices del lote tras un delete_page (la página eliminada no cuenta)", () => {
  const big = J(B); for (let i = 0; i < 250; i++) big.doc.pages[3].nodes.push({ id: 1 + i, shape: "rect", x: i, y: 0, w: 100, h: 60 });
  big.doc.pages[3].nextId = 251;
  const ops = [DP(0, "Inicio")]; for (let i = 0; i < 51; i++) ops.push(N(3, { x: i }));
  const e = err(apply(big, ops), "LIMIT_EXCEEDED");
  assert.deepEqual([e.limitName, e.pageIndex, e.actual], ["maxNodesPerPage", 3, 301]);
  const many = J(B); for (let i = 0; i < 320; i++) many.doc.pages[0].nodes.push({ id: 100 + i, shape: "rect", x: i, y: 0, w: 100, h: 60 });
  ok(apply(many, [DP(0, "Inicio")]));                        // eliminar una página que ya excedía el tope es válido
});

test("lote: create_node/refs/touched — lo de una página eliminada no aparece; refs y touched en índices finales", () => {
  const r = ok(apply(B, [N(3, {}, { ref: "a" }), { op: "create_story", scope: "story", pageIndex: 3, name: "S" }, DP(3, "Vacía"), N(2, {}, { ref: "b" }), DP(0, "Inicio")]));
  assert.deepEqual(r.refs, [{ ref: "b", type: "node", pageIndex: 1, id: 4 }]);
  assert.deepEqual(r.touched, []);
});

test("documentos antiguos (v1–v4, sin nombre, sin Historias) — delete_page y la regla de cur funcionan sobre la forma normalizada", () => {
  const v3 = { version: 3, app: "fluyo", doc: { theme: "crema", pages: [{ name: "a", nodes: [{ id: 1, x: 0, y: 0 }], edges: [], nextId: 2 }, { name: "b", nodes: [], edges: [], nextId: 1 }], cur: 1 }, settings: {} };
  const r = ok(apply(v3, [DP(1, "b")]));
  assert.deepEqual([names(r.project), r.project.doc.cur], [["a"], 0]);
  assert.equal(valid(r.project).valid, true);
  const v1 = { version: 1, app: "fluyo", doc: { pages: [{ name: "uno", nodes: [], edges: [] }, { name: "dos", nodes: [], edges: [] }], cur: 7 }, settings: {} };
  const r1 = ok(apply(v1, [DP(0, "uno")]));
  assert.deepEqual([names(r1.project), r1.project.doc.cur], [["dos"], 0]);
});

test("revisión: un delete_page cambia resultRevision de forma determinista; borrar y crear la misma página vacía no la deja igual (cambia el orden)", () => {
  const a = ok(apply(B, [DP(1, "Pagos")])), b = ok(apply(B, [DP(1, "Pagos")]));
  assert.equal(revisionOf(a.project), revisionOf(b.project));
  assert.notEqual(revisionOf(a.project), revisionOf(B));
  const r = ok(apply(B, [DP(3, "Vacía"), { op: "create_page", scope: "document", name: "Vacía" }]));
  assert.equal(revisionOf(r.project), revisionOf(B), "la última página vacía, borrada y recreada al final con su nombre: mismo documento");
  // encadenar: el resultado de un lote es la base del siguiente
  const step2 = ok(apply(a.project, [DP(0, "Inicio")]));
  assert.equal(revisionOf(step2.project), revisionOf(ok(apply(B, [DP(1, "Pagos"), DP(0, "Inicio")])).project));
});

test("ninguna clave nueva en el documento; el JSON no contiene refs ni huecos", () => {
  const r = ok(apply(B, [DP(1, "Pagos"), N(2, {}, { ref: "zz" })]));
  const keys = (o, acc = new Set()) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { acc.add(k); keys(v, acc); } return acc; };
  const known = keys(B);
  assert.deepEqual([...keys(r.project)].filter((k) => !known.has(k) && !/^\d+$/.test(k)), []);
  assert.equal(JSON.stringify(r.project).includes("zz"), false);
  assert.equal(r.project.doc.pages.includes(null), false);
});

/* ───────────── EventTypes: globales, nunca se eliminan al borrar una página ─────────────
   Política (018.7 §4.2/§4.4, decisión 103): los EventTypes son del DOCUMENTO; borrar una página no los toca. `eventTypesFreed` es solo
   INFORMATIVO: los que quedan sin ninguna referencia tras el borrado (usados en la página eliminada y en ninguna otra). Siguen en la biblioteca y,
   como cualquier EventType sin uso, pasan a poder cambiar de primitiva o eliminarse de forma EXPLÍCITA (decisión 79). Nunca hay cascada. */
const usage = (p, id) => K.call("eventTypeUseCountIn(projectFromProjectData(__a.p).doc, __a.id)", { p, id });
test("EventTypes: usado por la página eliminada Y por otra → sobrevive intacto, no aparece en eventTypesFreed y sigue en uso", () => {
  const before = normalize(B);
  assert.deepEqual([usage(B, 2), before.eventTypes.map((e) => e.name)], [2, ["Pago", "Aviso", "Libre"]], "precondición: «Aviso» se usa en Pagos y en Envíos");
  const r = ok(apply(B, [DP(1, "Pagos")]));
  assert.deepEqual(r.project.doc.eventTypes, before.eventTypes, "biblioteca idéntica (mismos EventTypes, mismos campos, mismo orden)");
  assert.equal(r.project.doc.nextEventTypeId, before.nextEventTypeId);
  assert.equal(r.changes[0].affects.eventTypesFreed.includes(2), false);
  assert.equal(usage(r.project, 2), 1, "sigue usado por «Entrega» (Envíos)");
  // y al revés: borrar Envíos deja «Aviso» en uso en Pagos
  const r2 = ok(apply(B, [DP(2, "Envíos")]));
  assert.deepEqual([r2.changes[0].affects.eventTypesFreed, r2.project.doc.eventTypes], [[], before.eventTypes]);
  assert.equal(valid(r2.project).valid, true, "las Historias que quedan siguen siendo válidas");
});

test("EventTypes: usado SOLO por la página eliminada → se CONSERVA (política decidida), se informa en eventTypesFreed y queda sin uso; borrarlo es una operación explícita aparte", () => {
  const r = ok(apply(B, [DP(1, "Pagos")]));
  assert.deepEqual(r.changes[0].affects.eventTypesFreed, [1], "«Pago» solo se usaba en Pagos");
  assert.deepEqual(r.project.doc.eventTypes.find((e) => e.id === 1), normalize(B).eventTypes.find((e) => e.id === 1), "«Pago» sigue en la biblioteca, intacto");
  assert.equal(usage(r.project, 1), 0);
  assert.equal(r.changes[0].affects.eventTypesFreed.includes(3), false, "«Libre» ya estaba sin uso: no lo libera este borrado");
  // Antes del borrado «Pago» está bloqueado; después, como todo EventType sin uso, se puede cambiar de primitiva o eliminar EXPLÍCITAMENTE.
  err(apply(B, [{ op: "delete_event_type", scope: "eventType", eventTypeId: 1 }]), "REFERENCED_ENTITY");
  err(apply(B, [{ op: "update_event_type", scope: "eventType", eventTypeId: 1, primitive: "OCCURRENCE" }]), "EVENT_TYPE_LOCKED");
  ok(apply(r.project, [{ op: "update_event_type", scope: "eventType", eventTypeId: 1, primitive: "OCCURRENCE" }]));
  const del = ok(apply(r.project, [{ op: "delete_event_type", scope: "eventType", eventTypeId: 1 }]));
  assert.deepEqual(del.project.doc.eventTypes.map((e) => e.id), [2, 3]);
  // el dominio tampoco toca la biblioteca: mismo array y mismos objetos
  const same = K.call("(function(){ const d=projectFromProjectData(__a).doc; const arr=d.eventTypes, objs=arr.slice(); deletePageIn(d,1); deletePageIn(d,1); return d.eventTypes===arr && arr.length===objs.length && arr.every((e,i)=>e===objs[i]); })()", B);
  assert.equal(same, true, "deletePageIn no reasigna ni filtra doc.eventTypes, ni borrando todas las páginas que los usan");
});

test("EventTypes + Undo/Redo del editor: deshacer el borrado restaura el documento EXACTO (página, Historias, usos de cada EventType) y rehacer vuelve al estado posterior", () => {
  const E = editor(); E.load(B);
  const initial = J(E.run("doc")), uses = () => J(E.run("[1,2,3].map(id=>eventTypeUseCount(id))"));
  assert.deepEqual(uses(), [2, 2, 0]);
  E.close(1);                                                          // Pagos: «Pago» queda sin uso, «Aviso» sigue en Envíos
  const afterOne = J(E.run("doc"));
  assert.deepEqual([afterOne.eventTypes, uses()], [initial.eventTypes, [0, 1, 0]]);
  E.close(1);                                                          // Envíos (ahora índice 1): «Aviso» también queda sin uso
  const afterTwo = J(E.run("doc"));
  assert.deepEqual([afterTwo.eventTypes, uses()], [initial.eventTypes, [0, 0, 0]], "la biblioteca no cambia aunque ningún paso use ya sus eventos");
  E.run("undo()"); assert.deepEqual(J(E.run("doc")), afterOne, "Undo 1: estado exacto tras el primer borrado"); assert.deepEqual(uses(), [0, 1, 0]);
  E.run("undo()"); assert.deepEqual(J(E.run("doc")), initial, "Undo 2: documento inicial exacto"); assert.deepEqual(uses(), [2, 2, 0]);
  E.run("redo()"); assert.deepEqual(J(E.run("doc")), afterOne);
  E.run("redo()"); assert.deepEqual(J(E.run("doc")), afterTwo);
  E.run("undo(); undo();"); assert.deepEqual(J(E.run("doc")), initial, "ciclos Undo/Redo estables");
  assert.equal(valid({ version: 5, app: "fluyo", doc: J(E.run("doc")), settings: {} }).valid, true);
});

/* ───────────── paridad editor ↔ MCP y golden compartido ───────────── */
/* Cada caso: las operaciones de autoría y el gesto equivalente del editor real (la ✕ de la pestaña, confirm aceptado). El documento
   del editor (incluido cur) debe ser idéntico al del kernel. FLUYO_UPDATE_GOLDEN=1 regenera el fixture que usa fluyo-mcp. */
const GOLDEN_CASES = [
  { name: "borrar la primera (anterior a la activa)", ops: [DP(0, "Inicio")], editor: [0] },
  { name: "borrar la activa con Historias y Behavior", ops: [DP(1, "Pagos")], editor: [1] },
  { name: "borrar una posterior a la activa", ops: [DP(2, "Envíos")], editor: [2] },
  { name: "borrar la última (vacía)", ops: [DP(3, "Vacía")], editor: [3] },
  { name: "dos borrados en un lote (índices del lote 3 y 1)", ops: [DP(3, "Vacía"), DP(1, "Pagos")], editor: [3, 1] },
  { name: "borrar y seguir editando otra página", ops: [DP(0, "Inicio"), { op: "rename_page", scope: "document", pageIndex: 2, name: "Logística" }], editor: [0], after: "renamePage(1,'Logística');" },
];
test("paridad: la ✕ del editor real y delete_page dan el MISMO documento (páginas, orden, cur, nodos, conexiones, Historias, Behaviors, EventTypes)", () => {
  const file = path.join(__dirname, "fixtures", "fluyo-018-7c-golden.json");
  const out = { baseRevision: revisionOf(K.call("FluyoAuthoring.normalizedProject(__a)", B).project), document: B, cases: [] };
  for (const c of GOLDEN_CASES) {
    const r = ok(apply(B, c.ops));
    const E = editor(); E.load(B);
    for (const i of c.editor) E.close(i);
    if (c.after) E.run(c.after);
    assert.deepEqual(J(E.run("doc")), normalize(r.project), `${c.name}: editor ≠ kernel`);
    assert.equal(revisionOf(K.call("projectToSerializable(__a.d, __a.s)", { d: J(E.run("doc")), s: r.project.settings })), revisionOf(r.project), c.name);
    // y el editor lo deshace todo: vuelve exactamente al documento de partida
    for (let k = 0; k < c.editor.length; k++) E.run("undo()");
    if (!c.after) assert.deepEqual(J(E.run("doc")), normalize(B), `${c.name}: Undo completo`);
    out.cases.push({ name: c.name, operations: c.ops, resultRevision: revisionOf(r.project), pageMap: r.pageMap, cur: r.project.doc.cur });
  }
  if (process.env.FLUYO_UPDATE_GOLDEN) fs.writeFileSync(file, JSON.stringify(out, null, 1));
  const golden = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(golden, J(out), "el golden cambió: revisa el comportamiento o regenera con FLUYO_UPDATE_GOLDEN=1");
});

test("paridad aleatoria: secuencias de borrados por el editor y por el kernel (un lote por gesto y un solo lote) coinciden", () => {
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let t = 0; t < 40; t++) {
    const p = J(B); p.doc.cur = Math.floor(rnd() * 4);
    const E = editor(); E.load(p);
    let doc = p; const batchOps = [], alive = [0, 1, 2, 3];
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const live = E.run("doc.pages.length"); const i = Math.floor(rnd() * live);
      const name = E.run(`doc.pages[${i}].name`);
      E.close(i);
      doc = ok(apply(doc, [DP(i, name)])).project;                     // un lote por gesto: índices del documento vivo
      batchOps.push(DP(alive[i], name)); alive.splice(i, 1);           // un solo lote: índices estables del inicio
      assert.deepEqual(J(E.run("doc")), normalize(doc), `t${t} k${k}`);
    }
    assert.equal(revisionOf(ok(apply(p, batchOps)).project), revisionOf(doc), `t${t}: un solo lote = gestos sucesivos`);
  }
});
