"use strict";
/* FLUYO-018.1 — Autoridad de dominio para CREAR nodos y conexiones (model.js: createNodeIn / createConnectionIn).
   Sin DOM, sin snap, sin geometría, sin revisiones. Paridad con el editor real (newNode/newEdge de state.js)
   y con la implementación ORIGINAL de esas fábricas (oráculo LEGACY, copiada tal cual antes del refactor). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const J = (v) => JSON.parse(JSON.stringify(v));
const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js", "story-authoring.js"];

function kernel() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of KERNEL) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.run = (code) => vm.runInContext(code, ctx);
  return ctx;
}
/* Editor real: model.js + la parte de state.js que define newNode/newEdge (sin DOM). */
function editor() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, scheduleAutosave() {}, renderTabs() {}, refreshPanel() {}, selN: new Set(), selE: new Set(), clip: null });
  ctx.run = (code) => vm.runInContext(code, ctx);
  for (const f of ["config.js", "safe-svg.js", "model.js"]) ctx.run(read("js/" + f));
  ctx.run(read("js/state.js").split("/* ===================== Viewport")[0]);
  return ctx;
}
const page = () => ({ name: "P", nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
const project = (pg) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: [pg], cur: 0 }, settings: {} });

/* La implementación original de state.js (antes de 018.1), para comparar byte a byte. */
const LEGACY = `
function legacyNode(pg,shape,x,y,extra={}){
  const [w,h]=DEFAULT_SIZES[shape]||[160,70];
  const id=reserveStructureIds(pg);
  const n=Object.assign({ id, shape, x:snapV(x), y:snapV(y), w, h,
    label: shape==="text"?"Texto":shape==="code"?CODE_DEFAULT_LABEL:(shape==="icon"||shape==="image"||shape==="anim")?"":"Nodo",
    color:PALETTE[0].c, fill:null, border:"solid", lblPos:"center", textBg:null, textColor:null,
    font:null, bold:false, pulse:false, order:pg.nodes.length }, extra, {id});
  if(shape==="code" && !("lang" in n)) Object.assign(n,{lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null});
  if(shape==="icon" && !("tint" in n)) n.tint=false;
  pg.nodes.push(n); return n;
}
function legacyEdge(pg,a,b,opts={}){
  if(a===b) return null;
  const id=reserveStructureIds(pg);
  const e=Object.assign({ id, from:a, to:b, fromSide:null, toSide:null,
    route:"straight", waypoints:[], label:"", font:null, bold:false, animated:true, dashed:false, startArrow:false, endArrow:true, flowDir:"normal" }, opts, {id});
  pg.edges.push(e); return e;
}`;
const SHAPES = ["rect", "cylinder", "diamond", "circle", "hex", "text", "icon", "image", "anim", "code"];
const EXTRA = { icon: { icon: "kafka", label: "Kafka" }, anim: { anim: "pulse", label: "Pulso" }, image: { img: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiLz4=", w: 40, h: 30 } };
const code = (fn) => { try { fn(); } catch (e) { return { code: e.code, field: e.field, type: e.constructor.name }; } return null; };

/* ═══════════════ 1. Nodos ═══════════════ */

test("createNodeIn: nodo mínimo = el registro completo que producía el editor", () => {
  const K = kernel(); K.run("var pg=" + JSON.stringify(page()));
  const n = J(K.run('createNodeIn(pg,{shape:"rect",x:200,y:300})'));
  assert.deepEqual(n, { id: 1, shape: "rect", x: 200, y: 300, w: 180, h: 70, label: "Nodo", color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, pulse: false, order: 0 });
  assert.equal(K.run("pg.nextId"), 2);
  assert.deepEqual(J(K.run("pg.behaviors")), [], "un nodo no crea Behavior");
});

for (const shape of SHAPES) {
  test(`createNodeIn(${shape}): idéntico a la fábrica original y a newNode del editor`, () => {
    const extra = EXTRA[shape] || {};
    const K = kernel(); K.run("var pg=" + JSON.stringify(page()));
    K.run(LEGACY);
    const legacy = J(K.run(`legacyNode(pg,${JSON.stringify(shape)},200,300,${JSON.stringify(extra)})`));
    K.run("var pg2=" + JSON.stringify(page()));
    const dom = J(K.run(`createNodeIn(pg2,Object.assign({shape:${JSON.stringify(shape)},x:200,y:300},${JSON.stringify(extra)}))`));
    assert.deepEqual(dom, legacy);
    assert.equal(JSON.stringify(dom), JSON.stringify(legacy), "mismo orden de claves");
    const E = editor(); E.run("doc=" + JSON.stringify({ theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: [page()], cur: 0 }));
    assert.deepEqual(J(E.run(`newNode(${JSON.stringify(shape)},200,300,${JSON.stringify(extra)})`)), legacy);
    if (shape === "code") assert.deepEqual([dom.lang, dom.keywords, dom.kwBg, dom.kwColor], ["sql", null, null, null]);
    if (shape === "icon") assert.equal(dom.tint, false);
  });
}

test("createNodeIn conserva decimales en posición y tamaño: sin redondeo ni snap", () => {
  const K = kernel(); K.run("var pg=" + JSON.stringify(page()));
  const n = J(K.run('createNodeIn(pg,{shape:"rect",x:200.5,y:300.25,w:181.75,h:70.125})'));
  assert.deepEqual([n.x, n.y, n.w, n.h], [200.5, 300.25, 181.75, 70.125]);
  const E = editor(); E.run("doc=" + JSON.stringify({ theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: [page()], cur: 0 }));
  assert.equal(E.run('newNode("rect",200.5,300.25).x'), 201, "el snap/redondeo sigue siendo del EDITOR (snapV), antes de llamar al dominio");
});

test("IDs: explícito, generado, colisión, contador y atomicidad", () => {
  const K = kernel(); K.run("var pg=" + JSON.stringify(page()));
  assert.equal(K.run('createNodeIn(pg,{shape:"rect",x:0,y:0}).id'), 1);
  assert.equal(K.run('createNodeIn(pg,{shape:"rect",x:0,y:0,id:10}).id'), 10);
  assert.equal(K.run("pg.nextId"), 11, "el contador nunca queda por detrás de un id explícito");
  assert.equal(K.run('createNodeIn(pg,{shape:"rect",x:0,y:0}).id'), 11, "el generado sigue tras el explícito");
  assert.equal(K.run('createNodeIn(pg,{shape:"rect",x:0,y:0,id:5}).id'), 5, "un hueco libre es válido");
  assert.equal(K.run("pg.nextId"), 12, "un id explícito menor no retrocede el contador");
  const before = K.run("JSON.stringify(pg)");
  for (const id of [1, 10, 11, 5]) assert.deepEqual(code(() => K.run(`createNodeIn(pg,{shape:"rect",x:0,y:0,id:${id}})`)), { code: "duplicate_structure_id", field: "id", type: "Error" });
  for (const id of [0, -1, 1.5, '"7"', "null", "NaN", "Number.MAX_SAFE_INTEGER"]) assert.equal(K.run(`(function(){try{createNodeIn(pg,{shape:"rect",x:0,y:0,id:${id}})}catch(e){return e.code+":"+e.field}})()`), "invalid_document:id", String(id));
  assert.equal(K.run("JSON.stringify(pg)"), before, "los rechazos no dejan cambios parciales (ni nodo ni contador)");
});

test("un id de arista, de Behavior o de Step ya referenciado cuenta como ocupado", () => {
  const K = kernel();
  K.run("var pg=" + JSON.stringify({ ...page(), nodes: [{ id: 1 }, { id: 2 }], edges: [{ id: 3, from: 1, to: 2 }], behaviors: [{ nodeId: 8, initialState: "DOWN" }], nextId: 9, scenarios: [{ id: 1, steps: [{ id: 1, at: 0, action: "SEND", edgeId: 20 }] }] }));
  for (const id of [1, 3, 8, 20]) assert.equal(code(() => K.run(`createNodeIn(pg,{shape:"rect",x:0,y:0,id:${id}})`)).code, "duplicate_structure_id", String(id));
  assert.equal(K.run('createNodeIn(pg,{shape:"rect",x:0,y:0}).id'), 21, "el generado respeta lo que ya reserva structuralNextId");
});

test("ref: no se persiste; el lote la recibe como Map; repetida → duplicate_ref", () => {
  const K = kernel(); K.run("var pg=" + JSON.stringify(page()) + ",refs=new Map()");
  const n = J(K.run('createNodeIn(pg,{ref:"cliente",shape:"rect",x:0,y:0,label:"Cliente"},{refs})'));
  assert.equal("ref" in n, false);
  assert.equal(K.run('refs.get("cliente")'), 1);
  assert.equal(JSON.stringify(J(K.run("pg.nodes[0]"))).includes('"ref"'), false);
  const before = K.run("JSON.stringify(pg)");
  assert.deepEqual(code(() => K.run('createNodeIn(pg,{ref:"cliente",shape:"rect",x:5,y:5},{refs})')), { code: "duplicate_ref", field: "ref", type: "Error" });
  assert.equal(K.run("JSON.stringify(pg)"), before);
  assert.equal(code(() => K.run('createNodeIn(pg,{ref:"",shape:"rect",x:0,y:0})')).field, "ref");
  assert.equal(K.run('createNodeIn(pg,{ref:"otro",shape:"rect",x:0,y:0})').id, 2, "sin context la ref se valida y se ignora");
});

test("createNodeIn rechaza entradas inválidas con error estructurado (nunca TypeError)", () => {
  const K = kernel(); K.run("var pg=" + JSON.stringify(page()));
  const bad = [
    ['createNodeIn(pg,{shape:"nope",x:0,y:0})', "shape"], ['createNodeIn(pg,{x:0,y:0})', "shape"], ['createNodeIn(pg,{shape:"rect",y:0})', "x"],
    ['createNodeIn(pg,{shape:"rect",x:"1",y:0})', "x"], ['createNodeIn(pg,{shape:"rect",x:0,y:NaN})', "y"], ['createNodeIn(pg,{shape:"rect",x:Infinity,y:0})', "x"],
    ['createNodeIn(pg,{shape:"rect",x:0,y:0,w:0})', null], ['createNodeIn(pg,{shape:"rect",x:0,y:0,h:-5})', null], ['createNodeIn(pg,{shape:"rect",x:0,y:0,border:"wavy"})', null],
    ['createNodeIn(pg,{shape:"rect",x:0,y:0,label:5})', null], ['createNodeIn(pg,{shape:"rect",x:0,y:0,inventado:1})', "inventado"],
    ['createNodeIn(pg,{shape:"rect",x:0,y:0,w:1n})', null], ['createNodeIn(pg,null)', "spec"], ['createNodeIn(pg,[])', "spec"], ['createNodeIn(undefined,{shape:"rect",x:0,y:0})', "page"],
    ['createNodeIn({nodes:1,edges:[]},{shape:"rect",x:0,y:0})', "page"], ['createNodeIn(pg,{shape:"code",x:0,y:0,lang:"klingon"})', null],
  ];
  const before = K.run("JSON.stringify(pg)");
  for (const [expr, field] of bad) {
    const r = code(() => K.run(expr));
    assert.ok(r, expr); assert.notEqual(r.type, "TypeError", expr); assert.equal(r.code, "invalid_document", expr);
    if (field) assert.equal(r.field, field, expr);
  }
  assert.equal(K.run("JSON.stringify(pg)"), before);
});

test("createNodeIn no muta la spec de entrada", () => {
  const K = kernel(); K.run("var pg=" + JSON.stringify(page()) + ',spec={shape:"code",x:1,y:2,lang:"sql",keywords:["a"]},snapshot=JSON.stringify(spec)');
  K.run("createNodeIn(pg,spec)"); assert.equal(K.run("JSON.stringify(spec)===snapshot"), true);
  K.run("pg.nodes[0].keywords.push('x')"); assert.equal(K.run("spec.keywords.length"), 1, "el nodo no comparte referencias con la spec");
});

/* ═══════════════ 2. Conexiones ═══════════════ */

const twoNodes = () => { const K = kernel(); K.run("var pg=" + JSON.stringify(page())); K.run('createNodeIn(pg,{shape:"rect",x:200,y:300,label:"Cliente"});createNodeIn(pg,{shape:"rect",x:600,y:300,label:"Comercio"})'); return K; };

test("createConnectionIn: defaults del editor, endpoints, id y geometría PERSISTIDA (lados/ruta/waypoints), sin EventType ni Behavior", () => {
  const K = twoNodes();
  const e = J(K.run('createConnectionIn(pg,{source:1,target:2,label:"Pago"})'));
  assert.deepEqual(e, { id: 3, from: 1, to: 2, fromSide: null, toSide: null, route: "straight", waypoints: [], label: "Pago", font: null, bold: false, animated: true, dashed: false, startArrow: false, endArrow: true, flowDir: "normal" });
  assert.equal("eventTypeId" in e, false); assert.deepEqual(J(K.run("pg.behaviors")), []);
  assert.equal(K.run("pg.nextId"), 4);
  const e2 = J(K.run('createConnectionIn(pg,{source:1,target:2,fromSide:"e",toSide:"w",route:"ortho",waypoints:[{x:1.5,y:2.25}],dashed:true,flowDir:"reverse",lineColor:"#fff",dots:9,speedFac:0.2})'));
  assert.deepEqual([e2.fromSide, e2.toSide, e2.route, e2.waypoints, e2.dashed, e2.flowDir], ["e", "w", "ortho", [{ x: 1.5, y: 2.25 }], true, "reverse"]);
  assert.deepEqual([e2.dots, e2.speedFac], [6, 1], "se normaliza igual que al cargar un documento (dots/speedFac acotados)");
  assert.equal(K.run("pg.edges.length"), 2, "dos conexiones entre el mismo par están permitidas (carriles paralelos)");
});

test("la geometría es la derivada: edgePoints del editor produce la ruta sin que la autoridad la calcule", () => {
  const K = twoNodes(); K.run("var geo=1");
  vm.runInContext(read("js/geometry.js"), K);
  K.run('createConnectionIn(pg,{source:1,target:2,route:"ortho"});doc={theme:"dark",eventTypes:[],pages:[pg],cur:0}');
  const pts = J(K.run("edgePoints(pg.edges[0])")).map((p) => [p.x, p.y]);
  assert.deepEqual([pts[0], pts[pts.length - 1]], [[290, 300], [510, 300]]);
});

test("createConnectionIn: source/target inexistentes y auto-lazo (regla del dominio compartido)", () => {
  const K = twoNodes(); const before = K.run("JSON.stringify(pg)");
  assert.deepEqual(code(() => K.run("createConnectionIn(pg,{source:99,target:2})")), { code: "source_not_found", field: "source", type: "Error" });
  assert.deepEqual(code(() => K.run("createConnectionIn(pg,{source:1,target:99})")), { code: "target_not_found", field: "target", type: "Error" });
  assert.deepEqual(code(() => K.run("createConnectionIn(pg,{source:1,target:1})")), { code: "self_loop", field: "target", type: "Error" });
  assert.equal(code(() => K.run("createConnectionIn(pg,{target:2})")).code, "source_not_found");
  assert.equal(code(() => K.run("createConnectionIn(pg,{source:1})")).code, "target_not_found");
  assert.equal(code(() => K.run("createConnectionIn(pg,{})")).code, "source_not_found");
  assert.equal(code(() => K.run('createConnectionIn(pg,{source:"1",target:2})')).code, "source_not_found", "los ids son enteros, no cadenas");
  assert.equal(code(() => K.run("createConnectionIn(pg,{source:3,target:2})")).code, "source_not_found", "un id de conexión no es un nodo");
  assert.equal(K.run("JSON.stringify(pg)"), before, "nada cambia");
});

test("createConnectionIn: ids, refs y atomicidad", () => {
  const K = twoNodes(); K.run("var refs=new Map()");
  assert.equal(K.run('createConnectionIn(pg,{ref:"pago",source:1,target:2,id:40},{refs}).id'), 40);
  assert.equal(K.run("pg.nextId"), 41); assert.equal(K.run('refs.get("pago")'), 40);
  assert.equal(K.run('"ref" in pg.edges[0]'), false);
  const before = K.run("JSON.stringify(pg)");
  for (const id of [1, 2, 40]) assert.equal(code(() => K.run(`createConnectionIn(pg,{source:1,target:2,id:${id}})`)).code, "duplicate_structure_id", String(id));
  assert.equal(code(() => K.run('createConnectionIn(pg,{ref:"pago",source:1,target:2},{refs})')).code, "duplicate_ref");
  for (const bad of ['fromSide:"x"', 'route:"curva"', 'flowDir:"zigzag"', "waypoints:[{x:1}]", "waypoints:5", "label:7", "from:1", "to:2", "eventTypeId:1", "behavior:1", "inventado:1"])
    { const r = code(() => K.run(`createConnectionIn(pg,{source:1,target:2,${bad}})`)); assert.ok(r, bad); assert.equal(r.type, "Error", bad); assert.equal(r.code, "invalid_document", bad); }
  assert.equal(K.run("JSON.stringify(pg)"), before);
});

test("el dominio no depende de la página activa ni de settings del editor: opera sobre la página que recibe", () => {
  const K = kernel(); K.run("var other=" + JSON.stringify(page()) + ";var pg=" + JSON.stringify(page()));
  const docBefore = K.run("JSON.stringify(doc)");
  K.run('createNodeIn(pg,{shape:"rect",x:1,y:1});createNodeIn(pg,{shape:"rect",x:2,y:2});createConnectionIn(pg,{source:1,target:2})');
  assert.equal(K.run("JSON.stringify(doc)"), docBefore, "la global `doc` no se toca");
  assert.equal(K.run("JSON.stringify(other)"), JSON.stringify(page()), "ninguna otra página cambia");
  assert.equal(K.run("pg.nodes.length+pg.edges.length"), 3);
});

/* ═══════════════ 3. Paridad Cliente → Comercio → Pago con el editor real ═══════════════ */

test("PARIDAD: Cliente, Comercio, Pago — editor (newNode/newEdge) vs dominio vs oráculo original: documento completo idéntico", () => {
  const E = editor();
  E.run("doc=" + JSON.stringify({ theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: [page()], cur: 0 }));
  E.run('newNode("rect",200,300,{label:"Cliente"});newNode("rect",600,300,{label:"Comercio"});newEdge(1,2,{label:"Pago",route:"ortho",fromSide:"e",toSide:"w"})');
  const A = J(E.run("serializeProject()"));

  const K = kernel();
  K.run('var pg=' + JSON.stringify(page()) + ';createNodeIn(pg,{shape:"rect",x:200,y:300,label:"Cliente"});createNodeIn(pg,{shape:"rect",x:600,y:300,label:"Comercio"});createConnectionIn(pg,{source:1,target:2,label:"Pago",route:"ortho",fromSide:"e",toSide:"w"})');
  const B = project(J(K.run("pg")));
  assert.deepEqual(B.doc.pages, A.doc.pages);

  K.run(LEGACY);
  K.run('var lg=' + JSON.stringify(page()) + ';legacyNode(lg,"rect",200,300,{label:"Cliente"});legacyNode(lg,"rect",600,300,{label:"Comercio"});legacyEdge(lg,1,2,{label:"Pago",route:"ortho",fromSide:"e",toSide:"w"})');
  assert.equal(JSON.stringify(J(K.run("lg"))), JSON.stringify(A.doc.pages[0]), "idéntico incluso en orden de claves y contadores");
  assert.equal(JSON.stringify(B.doc.pages[0]), JSON.stringify(A.doc.pages[0]));
  assert.equal(A.doc.pages[0].nextId, 4);
  assert.deepEqual(A.doc.pages[0].behaviors, []);
  assert.equal(JSON.stringify(A.settings), JSON.stringify(J(E.run("settings"))));
});

test("el editor: auto-lazo = null y sin cambios; nodo inexistente = error del dominio; snap sigue siendo del editor", () => {
  const E = editor();
  E.run("doc=" + JSON.stringify({ theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: [page()], cur: 0 }));
  E.run('newNode("rect",0,0);newNode("rect",100,0)');
  const before = E.run("JSON.stringify(doc)");
  assert.equal(E.run("newEdge(1,1)"), null);
  assert.equal(E.run("JSON.stringify(doc)"), before);
  assert.equal(code(() => E.run("newEdge(1,9)")).code, "target_not_found");
  E.run("settings.snap=true"); assert.equal(E.run('newNode("rect",113,47).x'), 120);
  assert.equal(E.run('newNode("rect",113,47).y'), 40);
});

test("el código del editor no crea registros por su cuenta: interaction.js solo llama a newNode/newEdge", () => {
  const state = read("js/state.js").split("/* ===================== Viewport")[0];
  assert.match(state, /createNodeIn\(/); assert.match(state, /createConnectionIn\(/);
  assert.doesNotMatch(state, /\.nodes\.push|\.edges\.push|reserveStructureIds/, "state.js ya no construye ni inserta registros");
  assert.doesNotMatch(read("js/model.js").split("function createNodeIn")[1].split("function clearPageContents")[0], /\bdocument\b|\bwindow\b|localStorage|\bsettings\b|snapV|edgePoints|P\(\)/, "el dominio no conoce DOM, snap, geometría ni la página activa");
});

/* ═══════════════ 4. Persistencia, integridad, Story ═══════════════ */

test("crear → serializar → deserializar → integridad → Trace/Story", () => {
  const K = kernel();
  K.run("var pg=" + JSON.stringify(page()) + ';createNodeIn(pg,{shape:"rect",x:200.5,y:300.25,label:"Cliente"});createNodeIn(pg,{shape:"rect",x:600,y:300,label:"Comercio"});createConnectionIn(pg,{source:1,target:2,label:"Pago"})');
  const d = project(J(K.run("pg")));
  d.doc.eventTypes = [{ id: 1, name: "Pago", primitive: "FLOW", sentenceTemplate: "{source} paga a {target}", visual: { kind: "token", value: "💵" }, motion: "normal" }]; d.doc.nextEventTypeId = 2;
  d.doc.pages[0].scenarios = [{ id: 1, engineVersion: 2, name: "H", nextStepId: 2, steps: [{ id: 1, at: 0, action: "SEND", edgeId: 3, eventTypeId: 1 }] }]; d.doc.pages[0].nextScenarioId = 2;
  const round = JSON.parse(JSON.stringify(d));
  K.ctx = null;
  const v = J(vm.runInContext(`FluyoIntegrity.validateProject(${JSON.stringify(round)})`, K));
  assert.equal(v.valid, true, JSON.stringify(v.errors));
  assert.deepEqual(J(K.run(`projectFromProjectData(${JSON.stringify(round)}).doc.pages[0].nodes[0]`)).x, 200.5, "el decimal sobrevive a la carga");
  assert.equal(v.stories.length, 1);
  const tr = J(K.run(`FluyoScenarios.runScenario({nodes:${JSON.stringify(d.doc.pages[0].nodes)},edges:${JSON.stringify(d.doc.pages[0].edges)}},[],${JSON.stringify(d.doc.pages[0].scenarios[0])})`));
  assert.equal(tr.ok, true, JSON.stringify(tr.errors));
});

test("integridad: documentos con ids duplicados o conexiones rotas fallan con errores estructurados", () => {
  const K = kernel();
  const bad = (pg) => J(vm.runInContext(`FluyoIntegrity.validateProject(${JSON.stringify(project({ ...page(), ...pg }))})`, K));
  for (const [pg, c] of [
    [{ nodes: [{ id: 1 }, { id: 1 }] }, "duplicate_node_id"],
    [{ nodes: [{ id: 1 }], edges: [{ id: 2, from: 1, to: 9 }] }, "missing_edge_endpoint"],
    [{ nodes: [{ id: 1 }], edges: [{ id: 1, from: 1, to: 1 }] }, "duplicate_structure_id"],
  ]) { const r = bad(pg); assert.equal(r.valid, false); assert.ok(r.errors.every((e) => typeof e.code === "string" && typeof e.message === "string"), JSON.stringify(r.errors)); assert.ok(r.errors.some((e) => e.code === c) || r.errors.length, c); }
  const r = J(vm.runInContext('FluyoIntegrity.validateProject({version:5,app:"fluyo",doc:{pages:[{nodes:[{id:1,shape:"nope"}],edges:[]}]}})', K));
  assert.equal(r.valid, false); assert.equal(r.errors[0].code, "invalid_document");
});

test("compatibilidad: documentos antiguos cargan igual y la extracción de normalización no cambió su comportamiento", () => {
  const K = kernel();
  for (const f of ["fluyo-017-1-cliente-kafka-comercio.fluyo.json", "fluyo-017-1-qa-complejo.fluyo.json"]) {
    const d = JSON.parse(read("test/fixtures/" + f));
    const v = J(vm.runInContext(`FluyoIntegrity.validateProject(${JSON.stringify(d)})`, K));
    assert.equal(v.valid, true, f);
    const once = J(K.run(`projectFromProjectData(${JSON.stringify(d)})`));
    assert.deepEqual(J(K.run(`projectFromProjectData(${JSON.stringify(once)})`)), once, "la normalización es idempotente: " + f);
  }
});

/* ═══════════════ 5. Spike descartable: FluyoAuthoring puede consumir el dominio sin DOM ═══════════════ */

test("spike: una capa de autoría con refs de lote usa createNodeIn/createConnectionIn en un contexto sin DOM", () => {
  const K = kernel();
  /* Capa de autoría mínima (descartable, vive solo en este test): resuelve refs → ids y delega. */
  K.run(`
    function authoringBatch(pg, ops){
      const nodeRefs=new Map(), edgeRefs=new Map(), out=[];
      for(const op of ops){
        if(op.op==="create_node") out.push(createNodeIn(pg, op.spec, {refs:nodeRefs}).id);
        else out.push(createConnectionIn(pg, Object.assign({}, op.spec, {source:nodeRefs.get(op.spec.source), target:nodeRefs.get(op.spec.target)}), {refs:edgeRefs}).id);
      }
      return {ids:out, nodeRefs:[...nodeRefs]};
    }
    var pg=${JSON.stringify(page())};`);
  const r = J(K.run(`authoringBatch(pg,[
    {op:"create_node",spec:{ref:"cliente",shape:"rect",x:200,y:300,label:"Cliente"}},
    {op:"create_node",spec:{ref:"comercio",shape:"rect",x:600,y:300,label:"Comercio"}},
    {op:"create_node",spec:{ref:"pago",shape:"circle",x:400,y:100}},
    {op:"create_connection",spec:{ref:"c1",source:"cliente",target:"comercio",label:"Pago"}}])`));
  assert.deepEqual(r.ids, [1, 2, 3, 4]); assert.deepEqual(r.nodeRefs, [["cliente", 1], ["comercio", 2], ["pago", 3]]);
  assert.equal(JSON.stringify(J(K.run("pg"))).includes('"ref"'), false);
  assert.equal(K.run("typeof document"), "undefined");
});
