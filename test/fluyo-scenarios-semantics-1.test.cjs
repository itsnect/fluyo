"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 1 — modelo de conexión semántica (`edge.kind`) + autoría en el editor.
   Contratos en vm (sin navegador). Decisiones: .ai/architecture/SCENARIO-SEMANTICS-001.md (D1, D2, D10, § Autoría, § Requisito).
   · Modelo: ausente = Conexión y no se rellena; FLOWS_TO / REQUIRES round-trip; null y no-texto quitan la clave; un texto
     desconocido se conserva y se lee como Conexión; "GENERIC" nunca se escribe.
   · Corpus (ejemplos + fixtures): la carga da exactamente lo mismo que el model.js de HEAD (ningún documento cambia).
   · Autoría (editor y MCP comparten createConnectionIn/updateConnectionIn): solo la lista cerrada o null; rechazo atribuido a `kind`;
     todo o nada. Clonar/duplicar y el enlace #d= conservan `kind`.
   · Editor: bandera labs (`?labs=escenarios` / `?labs=off`, localStorage); el selector escribe por editEdge con UNA entrada de
     Undo, elegir lo actual no escribe, Conexión quita la clave; Undo/Redo exactos (selection.js real, arnés de 018.7c).
   · Lienzo: edgeSemanticMarks (geometry.js) es null sin semántica; Flujo = cuñas en el sentido from → to (las puntas y flowDir no
     cuentan); Requisito = anillo cerca del origen, detrás de la punta de inicio; drawEdge no las pinta al exportar.
   · Alcance: solo model.js, geometry.js, render.js, ui.js, index.html, css/styles.css y sw.js (CACHE v94) entre los archivos servidos. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { editor, project, page } = require("./fluyo-018-7c-harness.cjs");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "0409f4d";   // main al reintegrar (la línea congelada medía contra ce8e699)
const before = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const { undo4b } = require("./fluyo-019-4b-undo.cjs");   /* FLUYO-019.4b cambia a propósito render.js, interaction.js, geometry.js, editor-runtime.js, state.js e index.html: se deshace aquí (antes que 019.4a y FASE 1); su alcance lo vigila test/fluyo-019-4b.test.cjs */
const { undo3: undo3only } = require("./fluyo-scenarios-semantics-3-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 3 cambia a propósito model.js, document-integrity.js, story-authoring.js, flow-semantics.js, editor-scenarios.js, index.html, styles.css y sw.js (precache): se deshace aquí, antes que todo lo demás; su alcance lo vigila test/fluyo-scenarios-semantics-3.test.cjs */
const { undoReverse } = require("./fluyo-step-reverse-002-undo.cjs");   /* FLUYO-STEP-REVERSE-002 cambia a propósito model.js, scenario-engine.js, story-playback.js, scenario-playback.js, story-authoring.js, document-integrity.js, render.js, editor-scenarios.js y selection.js: se deshace aquí, antes que FASE 3; su alcance lo vigila test/fluyo-step-reverse-002.test.cjs */
const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* FLUYO-STEP-REVERSE-003 añade «Invertir sentido» a editor-scenarios.js: se deshace aquí, antes que 002; su alcance lo vigila test/fluyo-step-reverse-003.test.cjs */
const { undo4: undo4only } = require("./fluyo-scenarios-semantics-4-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima de STEP-REVERSE-003: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-4.test.cjs */
const { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 5 va encima de FASE 4: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-5.test.cjs */
const { shellOnly } = require("./fluyo-shell-001-undo.cjs");   /* FLUYO-SHELL-001 (páginas públicas, favicon, manifest): lo suyo se descuenta */
const undo4 = (f, src) => undo4only(f, undo5(f, src));
const undo3 = (f, src) => undo3only(f, undoReverse(f, undoReverseUi(f, undo4(f, src))));
const J = (v) => JSON.parse(JSON.stringify(v));

function context(src, files) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, CompressionStream, DecompressionStream, crypto, console });
  for (const f of files) vm.runInContext(src("js/" + f), ctx, { filename: f });
  return ctx;
}
const NOW = context(read, ["config.js", "safe-svg.js", "model.js", "geometry.js", "link-codec.js"]);
const OLD = context(before, ["config.js", "safe-svg.js", "model.js"]);
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const err = (G, code, arg) => { G.__a = J(arg); return J(vm.runInContext(`(()=>{ try{ ${code}; return null; }catch(e){ return {code:e.code, field:e.field}; } })()`, G)); };

const rect = (id, x, y) => ({ id, shape: "rect", x, y, w: 160, h: 60, label: "N" + id });
const edge = (id, from, to, o = {}) => ({ id, from, to, route: "straight", fromSide: null, toSide: null, waypoints: [], ...o });
const doc1 = (edges) => project([Object.assign(page("P"), { nodes: [rect(1, 0, 0), rect(2, 400, 0), rect(3, 400, 300)], edges, nextId: 20 })]);
const loadEdges = (G, d) => run(G, "projectFromProjectData(__a).doc.pages[0].edges", d);

/* ── Modelo ── */
test("D2 · ausente = Conexión: la carga no añade `kind` y edgeKind lee GENERIC", () => {
  const [e] = loadEdges(NOW, doc1([edge(10, 1, 2)]));
  assert.ok(!("kind" in e), "sin clave tras normalizar");
  assert.equal(run(NOW, "edgeKind(__a)", e), "GENERIC");
  assert.equal(run(NOW, "edgeKind(null)"), "GENERIC");
  assert.deepEqual(run(NOW, "EDGE_KINDS"), ["FLOWS_TO", "REQUIRES"]);
});
test("D1 · FLOWS_TO y REQUIRES hacen round-trip por la carga (dos veces = idempotente)", () => {
  const d = doc1([edge(10, 1, 2, { kind: "FLOWS_TO" }), edge(11, 1, 3, { kind: "REQUIRES" })]);
  const once = run(NOW, "projectFromProjectData(__a)", d);
  const twice = run(NOW, "projectFromProjectData(__a)", once);
  assert.deepEqual(once.doc.pages[0].edges.map((e) => e.kind), ["FLOWS_TO", "REQUIRES"]);
  assert.deepEqual(twice, once);
  assert.deepEqual(once.doc.pages[0].edges.map((e) => run(NOW, "edgeKind(__a)", e)), ["FLOWS_TO", "REQUIRES"]);
});
test("D1 · null y valores que no son texto quitan la clave; un texto desconocido se CONSERVA y se lee como Conexión", () => {
  const es = loadEdges(NOW, doc1([edge(10, 1, 2, { kind: null }), edge(11, 1, 3, { kind: 7 }), edge(12, 2, 3, { kind: { a: 1 } }),
    edge(13, 3, 1, { kind: "TRIGGERS" }), edge(14, 2, 1, { kind: "GENERIC" }), edge(15, 3, 2, { kind: "flows_to" })]));
  assert.deepEqual(es.map((e) => ("kind" in e ? e.kind : "∅")), ["∅", "∅", "∅", "TRIGGERS", "GENERIC", "flows_to"]);
  assert.deepEqual(es.map((e) => run(NOW, "edgeKind(__a)", e)), ["GENERIC", "GENERIC", "GENERIC", "GENERIC", "GENERIC", "GENERIC"]);
});
test("B4 · corpus (ejemplos + fixtures .fluyo.json): la carga es idéntica a la del model.js de " + BASE, () => {
  const files = [...fs.readdirSync(path.join(root, "ejemplos", "data")).map((f) => "ejemplos/data/" + f),
    ...fs.readdirSync(path.join(root, "test", "fixtures")).filter((f) => f.endsWith(".fluyo.json")).map((f) => "test/fixtures/" + f)].filter((f) => f.endsWith(".json"));
  let n = 0, edges = 0;
  for (const f of files) {
    const d = JSON.parse(read(f));
    let a, b;
    try { a = run(NOW, "projectFromProjectData(__a)", d); } catch (e) { a = "error"; }
    try { b = run(OLD, "projectFromProjectData(__a)", d); } catch (e) { b = "error"; }
    assert.deepEqual(a, b, f);
    if (a !== "error") { n++; for (const p of a.doc.pages) { edges += p.edges.length; for (const e of p.edges) assert.ok(!("kind" in e), f + ": ninguna conexión gana `kind`"); } }
  }
  assert.ok(n >= 8 && edges >= 61, `documentos ${n}, conexiones ${edges}`);
});

/* ── Autoría compartida (editor + MCP) ── */
test("autoría · createConnectionIn acepta FLOWS_TO / REQUIRES / null y rechaza lo demás atribuyéndolo a `kind`", () => {
  const mk = (kind) => `(()=>{ const pg=projectFromProjectData(__a.d).doc.pages[0]; return createConnectionIn(pg,{source:1,target:2${kind}}); })()`;
  const d = doc1([]);
  assert.equal(run(NOW, mk(',kind:"FLOWS_TO"'), { d }).kind, "FLOWS_TO");
  assert.equal(run(NOW, mk(',kind:"REQUIRES"'), { d }).kind, "REQUIRES");
  assert.ok(!("kind" in run(NOW, mk(",kind:null"), { d })), "null = Conexión, sin clave");
  assert.ok(!("kind" in run(NOW, mk(""), { d })), "sin kind = Conexión, sin clave");
  for (const bad of ['"GENERIC"', '"TRIGGERS"', '"flows_to"', "1", "true", "{}"])
    assert.deepEqual(err(NOW, `const pg=projectFromProjectData(__a.d).doc.pages[0]; createConnectionIn(pg,{source:1,target:2,kind:${bad}})`, { d }),
      { code: "invalid_document", field: "kind" }, bad);
});
test("autoría · updateConnectionIn: Conexión → Flujo → Requisito → Conexión; un rechazo deja la conexión intacta", () => {
  const out = run(NOW, `(()=>{ const pg=projectFromProjectData(__a).doc.pages[0]; const e=pg.edges[0], s=[];
    s.push(JSON.stringify(updateConnectionIn(pg,10,{kind:"FLOWS_TO"}).kind));
    s.push(JSON.stringify(updateConnectionIn(pg,10,{kind:"REQUIRES"}).kind));
    const snap=JSON.stringify(e);
    try{ updateConnectionIn(pg,10,{kind:"GENERIC", label:"x"}); s.push("NO"); }catch(x){ s.push(x.code+":"+x.field); }
    s.push(JSON.stringify(e)===snap ? "intacta" : "MUTADA");
    updateConnectionIn(pg,10,{kind:null}); s.push("kind" in e ? "con clave" : "sin clave");
    return s; })()`, doc1([edge(10, 1, 2)]));
  assert.deepEqual(out, ['"FLOWS_TO"', '"REQUIRES"', "invalid_document:kind", "intacta", "sin clave"]);
});
test("autoría · `kind` está en las claves de creación y de parche (las mismas que usa FluyoAuthoring)", () => {
  assert.ok(run(NOW, "CONNECTION_SPEC_KEYS.has('kind') && CONNECTION_UPDATE_KEYS.has('kind')"));
});
test("D1 · copiar/pegar y duplicar (cloneStructureIn, única autoridad) conservan `kind`", () => {
  const out = run(NOW, `(()=>{ const pg=projectFromProjectData(__a).doc.pages[0];
    const r=cloneStructureIn(pg,{nodes:pg.nodes.slice(0,2), edges:pg.edges, behaviors:[]},{dx:20,dy:20});
    return r.connections.map(c=>pg.edges.find(e=>e.id===c.id).kind); })()`, doc1([edge(10, 1, 2, { kind: "REQUIRES" })]));
  assert.deepEqual(out, ["REQUIRES"]);
});
test("Share/#d= · el enlace (link-codec) transporta `kind` intacto", async () => {
  const d = run(NOW, "projectFromProjectData(__a)", doc1([edge(10, 1, 2, { kind: "FLOWS_TO" }), edge(11, 2, 3, { kind: "TRIGGERS" }), edge(12, 1, 3)]));
  NOW.__a = d;
  const back = await vm.runInContext("encodeDeepLink(__a).then(p=>decodeDeepLink(p)).then(x=>JSON.stringify(projectFromProjectData(x)))", NOW);
  assert.deepEqual(JSON.parse(back).doc.pages[0].edges.map((e) => e.kind), ["FLOWS_TO", "TRIGGERS", undefined]);
});

/* ── Bandera labs (D10): existió de FASE 1 a FASE 5 y se retiró en FASE 6 (decisión 253, PO) ── */
test("D10 · la bandera labs se retiró (FASE 6, decisión 253): ui.js ya no lee la URL ni el almacenamiento; las herramientas son el comportamiento normal", () => {
  const ui = read("js/ui.js");
  assert.ok(!/LABS_SEMANTICS|fluyo\.labs\.escenarios|get\("labs"\)/.test(ui), "ni la constante, ni la clave, ni el parámetro");
  assert.ok(ui.includes('$("rowKind").style.display=isNode ? "none" : "flex";'), "Semántica en toda conexión");
  assert.ok(!/prototipo=escenario-semantico|PROTO_SEMANTIC|protoSemantic/.test(read("js/ui.js") + read("index.html") + read("js/render.js")), "B7: nada del prototipo");
});

/* ── Selector + Undo (editor real: state.js, selection.js; arnés de 018.7c) ── */
function selectorEditor(edges) {
  const E = editor();
  E.load(doc1(edges));
  const ui = read("js/ui.js");
  const a = ui.indexOf('segBind("kindSeg"'), b = ui.indexOf("segOnSelect(\"arrowSizeSeg\"", a);
  assert.ok(a > 0 && b > a, "manejador del selector en ui.js");
  const single = ui.slice(ui.indexOf("function singleEdge(){"), ui.indexOf("\n", ui.indexOf("function singleEdge(){")));
  E.run(`var __pick=null; function segBind(id, fn){ if(id==="kindSeg") __pick=fn; }\n${single}\n${ui.slice(a, b)}`);
  E.pick = (v) => E.run(`__pick(${JSON.stringify(v)})`);
  E.kinds = () => E.run("JSON.stringify(P().edges.map(e=>'kind' in e ? e.kind : null))");
  return E;
}
test("§ Autoría · el selector escribe por el dominio con UNA entrada de Undo; elegir lo actual no apila; Undo/Redo exactos", () => {
  const E = selectorEditor([edge(10, 1, 2), edge(11, 2, 3)]);
  E.run("selN.clear(); selE.clear(); selE.add(10);");
  const steps = () => E.run("undoStack.length");
  E.pick("GENERIC"); assert.equal(steps(), 0, "Conexión sobre Conexión: nada");
  E.pick("FLOWS_TO"); assert.equal(E.kinds(), '["FLOWS_TO",null]'); assert.equal(steps(), 1);
  E.pick("FLOWS_TO"); assert.equal(steps(), 1, "el valor actual no escribe");
  E.pick("REQUIRES"); assert.equal(E.kinds(), '["REQUIRES",null]'); assert.equal(steps(), 2);
  E.pick("GENERIC"); assert.equal(E.kinds(), "[null,null]", "Conexión quita la clave: nunca se guarda GENERIC"); assert.equal(steps(), 3);
  assert.ok(!E.run("JSON.stringify(serializeProject())").includes("GENERIC"));
  E.run("undo()"); assert.equal(E.kinds(), '["REQUIRES",null]');
  E.run("undo()"); assert.equal(E.kinds(), '["FLOWS_TO",null]');
  E.run("undo()"); assert.equal(E.kinds(), "[null,null]");
  E.run("redo()"); E.run("redo()"); assert.equal(E.kinds(), '["REQUIRES",null]');
  E.run("redo()"); assert.equal(E.kinds(), "[null,null]");
  assert.ok(E.run("__autosaves") >= 3, "cada cambio autoguarda");
});
test("§ Autoría · sin una conexión sola seleccionada el selector no hace nada; un `kind` desconocido sobrevive a elegir Conexión", () => {
  const E = selectorEditor([edge(10, 1, 2, { kind: "TRIGGERS" }), edge(11, 2, 3)]);
  E.run("selN.clear(); selE.clear();"); E.pick("FLOWS_TO");
  E.run("selE.add(10); selE.add(11);"); E.pick("FLOWS_TO");
  E.run("selE.clear(); selN.add(1);"); E.pick("FLOWS_TO");
  assert.equal(E.kinds(), '["TRIGGERS",null]'); assert.equal(E.run("undoStack.length"), 0);
  E.run("selN.clear(); selE.add(10);"); E.pick("GENERIC");
  assert.equal(E.kinds(), '["TRIGGERS",null]', "se lee como Conexión: elegir Conexión no reescribe");
  E.pick("REQUIRES"); assert.equal(E.kinds(), '["REQUIRES",null]');
});
test("§ Autoría · markup estático: «Semántica» con Conexión · Flujo · Requisito, primera fila de «Puntos» (FASE 6, decisión 254; antes de «Trazo»), oculta por defecto; en toda conexión (la bandera se retiró en FASE 6)", () => {
  const html = read("index.html");
  const stroke = html.slice(html.indexOf('id="grpFlow"'), html.indexOf("</details>", html.indexOf('id="grpFlow"')));
  const row = stroke.indexOf('id="rowKind"');
  assert.ok(row > 0 && row < stroke.indexOf('id="rowDotC"'), "primera fila del grupo");
  assert.ok(!html.slice(html.indexOf('id="grpStroke"'), html.indexOf('id="grpFlow"')).includes('id="rowKind"'), "ya no está en «Trazo» ni en «Dirección»");
  assert.match(stroke, /<div class="row" id="rowKind" data-stack style="display:none">/);
  assert.match(stroke, /id="kindSeg" role="radiogroup" aria-labelledby="kindLbl"/);
  assert.deepEqual([...stroke.matchAll(/data-v="(\w+)">([^<]+)</g)].slice(0, 3).map((m) => [m[1], m[2]]), [["GENERIC", "Conexión"], ["FLOWS_TO", "Flujo"], ["REQUIRES", "Requisito"]]);
  const ui = read("js/ui.js");
  assert.ok(ui.includes('$("rowKind").style.display=isNode ? "none" : "flex";'));
  assert.match(ui, /segSync\("kindSeg", edgeKind\(obj\)\);/);
});

/* ── W5: la punta visible contradice el Flujo (aviso no bloqueante; nunca invierte origen y destino) ── */
function w5(labsOn) {
  const ui = read("js/ui.js"), m = read("js/model.js");
  const cut = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = src.indexOf(b, i); assert.ok(j > i, "falta " + b); return src.slice(i, j); };
  const note = { hidden: true };
  const ctx = vm.createContext({ LABS_SEMANTICS: labsOn, $: (id) => { assert.equal(id, "kindNote"); return note; } });
  vm.runInContext(cut(m, "const EDGE_KINDS=", "function normalizeProjectNode(") + cut(ui, "function arrowsOf(e){", "\n") + "\n" +
    cut(ui, "function flowArrowReversed(e){", "\n") + "\n" + cut(ui, "function syncKindNote(e){", "\n"), ctx);
  return (e) => { const before = JSON.stringify(e); ctx.__e = e; vm.runInContext("syncKindNote(__e)", ctx); assert.equal(JSON.stringify(e), before, "el aviso no toca la conexión"); return !note.hidden; };
}
test("W5 · el aviso sale solo en un Flujo con punta de inicio y sin punta final; nunca toca origen ni destino", () => {
  const shows = w5(true);
  assert.equal(shows(edge(10, 1, 2, { kind: "FLOWS_TO", startArrow: true, endArrow: false })), true, "punta al revés");
  assert.equal(shows(edge(10, 1, 2, { kind: "FLOWS_TO" })), false, "punta por defecto (final)");
  assert.equal(shows(edge(10, 1, 2, { kind: "FLOWS_TO", startArrow: true })), false, "dos puntas: no contradice");
  assert.equal(shows(edge(10, 1, 2, { kind: "FLOWS_TO", endArrow: false })), false, "sin puntas: no contradice");
  assert.equal(shows(edge(10, 1, 2, { kind: "FLOWS_TO", startArrow: true, endArrow: false, flowDir: -1 })), true, "flowDir no cambia nada");
  for (const kind of [undefined, "REQUIRES", "TRIGGERS"])
    assert.equal(shows(edge(10, 1, 2, { kind, startArrow: true, endArrow: false })), false, "solo el Flujo tiene sentido: " + kind);
  assert.equal(shows(null), false, "un nodo seleccionado: sin aviso");
  assert.equal(w5(false)(edge(10, 1, 2, { kind: "FLOWS_TO", startArrow: true, endArrow: false })), true, "sin la bandera (retirada en FASE 6), el aviso sale igual");
});
test("W5 · markup estático tras el selector, con los textos aprobados; se sincroniza al refrescar el panel y al cambiar las puntas", () => {
  const html = read("index.html");
  const stroke = html.slice(html.indexOf('id="grpFlow"'), html.indexOf("</details>", html.indexOf('id="grpFlow"')));
  const note = stroke.indexOf('id="kindNote"');
  assert.ok(note > stroke.indexOf('id="rowKind"') && note < stroke.indexOf('id="rowDotC"'), "justo después del selector (los dos en «Puntos», decisión 254)");
  assert.match(stroke, /<p class="hint rowNote" id="kindNote" role="status" hidden data-i18n="prop\.kindNote">La punta visible apunta en sentido contrario al flujo\. El flujo se calcula de origen a destino; la punta solo cambia la apariencia\.<\/p>/);
  const ui = read("js/ui.js");
  assert.ok(ui.includes('$("rowKind").style.display=isNode ? "none" : "flex";\n  syncKindNote(isNode ? null : obj);'));
  assert.match(ui, /function syncArrowSeg\(e\)\{[^\n]*syncKindNote\(e\); syncArrowSizeSeg\(e\); \}/, "el contrato de 018.27 (termina en syncArrowSizeSeg) se conserva");
});

/* ── Lienzo: marcas estáticas ── */
const marks = (e, pts) => run(NOW, "edgeSemanticMarks(__a.e, __a.pts)", { e, pts });
test("§ Requisito / Flujo · sin semántica (ausente o desconocida) no hay marcas: el lienzo de siempre", () => {
  const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }];
  assert.equal(marks({}, pts), null);
  assert.equal(marks({ kind: "TRIGGERS" }, pts), null);
  assert.equal(marks({ kind: "FLOWS_TO" }, [{ x: 0, y: 0 }]), null);
});
test("Flujo · dos cuñas en el centro del tramo más largo, apuntando de from a to; las puntas y flowDir no cambian nada", () => {
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 300, y: 40 }, { x: 300, y: 60 }];
  const m = marks({ kind: "FLOWS_TO" }, pts);
  assert.equal(m.kind, "FLOWS_TO"); assert.equal(m.chevrons.length, 2);
  for (const ch of m.chevrons) {
    assert.deepEqual(ch.map((s) => s.op), ["M", "L", "L"]);
    assert.ok(ch[1].x > ch[0].x && ch[1].x > ch[2].x, "el vértice va por delante: sentido +x (from → to)");
    assert.ok(Math.abs(ch[1].y - 40) < 1e-9 && ch[1].x > 140 && ch[1].x < 160, "sobre el centro del tramo largo");
  }
  for (const extra of [{ startArrow: true, endArrow: false }, { flowDir: "reverse" }, { flowDir: "alternate", startArrow: true }])
    assert.deepEqual(marks({ kind: "FLOWS_TO", ...extra }, pts), m, JSON.stringify(extra));
  const back = marks({ kind: "FLOWS_TO" }, pts.slice().reverse());
  assert.ok(back.chevrons.every((ch) => ch[1].x < ch[0].x), "invertir la ruta invierte las cuñas");
  assert.deepEqual(marks({ kind: "FLOWS_TO" }, [{ x: 0, y: 0 }, { x: 20, y: 0 }]).chevrons, [], "tramo corto: sin cuñas");
});
test("Flujo · una ruta ortogonal con vértices sin giro (pasillos) pone las cuñas en el centro del tramo VISIBLE, no de un trozo", () => {
  /* vertical de 0 a 160 partida en 0–20 · 20–150 · 150–160 (anclas y pasillos), y un punto repetido */
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 20 }, { x: 0, y: 150 }, { x: 0, y: 160 }];
  const m = marks({ kind: "FLOWS_TO" }, pts);
  const ys = m.chevrons.map((ch) => ch[1].y);
  assert.ok(ys.every((y) => Math.abs(y - 80) <= 4), "centro del tramo entero (80), no del trozo 20–150 (85): " + ys);
  assert.ok(m.chevrons.every((ch) => ch[1].y > ch[0].y), "sentido +y");
  /* un giro de verdad sí separa tramos */
  const L = marks({ kind: "FLOWS_TO" }, [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 40, y: 100 }]);
  assert.ok(L.chevrons.every((ch) => Math.abs(ch[1].x) < 1e-9), "el tramo largo es el vertical");
});
test("Requisito · un anillo cerca del origen (el que requiere), detrás de la punta de inicio; nunca discontinuo", () => {
  const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }];
  const m = marks({ kind: "REQUIRES" }, pts);
  assert.deepEqual(m, { kind: "REQUIRES", ring: { x: 10, y: 0, r: 4.2 } });
  assert.deepEqual(marks({ kind: "REQUIRES", startArrow: true }, pts).ring, { x: 24, y: 0, r: 4.2 }, "3 + 11 + 10");
  assert.deepEqual(marks({ kind: "REQUIRES", startArrow: true, arrowSize: 2 }, pts).ring, { x: 35, y: 0, r: 4.2 }, "3 + 22 + 10");
  assert.ok(marks({ kind: "REQUIRES" }, [{ x: 0, y: 0 }, { x: 15, y: 0 }]).ring.x <= 5, "conexión corta: dentro del primer tercio");
  const r = read("js/render.js"), painter = r.slice(r.indexOf("function drawEdgeSemanticMarks("), r.indexOf("function drawEdge("));
  assert.deepEqual(painter.match(/setLineDash\([^)]*\)/g), ["setLineDash([])"], "las marcas se pintan siempre continuas");
});
test("render · drawEdge pinta las marcas sin bandera y fuera de la exportación; el resto de drawEdge es el de " + BASE, () => {
  const fn = (src, name) => { const i = src.indexOf("function " + name + "("); let d = 0, j = src.indexOf("{", i); for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; } return src.slice(i, j + 1); };
  const now = fn(undo4b("js/render.js", undo3("js/render.js", read("js/render.js"))), "drawEdge"), old = fn(before("js/render.js"), "drawEdge");
  const block = now.slice(now.indexOf("  /* SCENARIOS-SEMANTICS-001"), now.indexOf("  /* FLUYO-019.1: anillo de salida"));
  assert.match(block, /const sem=!isExport && typeof edgeSemanticMarks==="function" \? edgeSemanticMarks\(e,pts\) : null;/);
  assert.ok(!/LABS_SEMANTICS|scenarioRuntime/.test(block), "no depende de la bandera ni de la Historia (estable)");
  assert.equal(now.replace(block, ""), old, "drawEdge fuera del bloque: idéntico");
});

/* ── Alcance y release ── */
test("alcance · entre los archivos servidos solo cambian model.js, geometry.js, render.js, ui.js, index.html, styles.css y sw.js (CACHE v94); el resto del kernel intacto", () => {
  /* FASE 1 y FASE 2 se reintegran juntas sobre BASE: js/flow-semantics.js es de FASE 2 (no servido; su alcance lo vigila
     test/fluyo-scenarios-semantics-2.test.cjs) y aquí se descuenta */
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", "js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos"], { encoding: "utf8" })
    .split("\n").filter((f) => f && f !== "js/flow-semantics.js").filter((f) => !shellOnly(f, read, before)).sort();
  /* FLUYO-019.4b añade interaction.js, editor-runtime.js y state.js: deshechos, son los de BASE */
  const ONLY4B = ["js/editor-runtime.js", "js/interaction.js", "js/state.js"];
  for (const f of ONLY4B) assert.equal(undo4b(f, undo3(f, read(f))), before(f), f + " = " + BASE + " fuera de 019.4b");
  /* SCENARIOS-SEMANTICS-001 FASE 3 añade document-integrity.js, story-authoring.js y editor-scenarios.js: deshechos, son los de BASE */
  const ONLY3 = ["js/document-integrity.js", "js/editor-scenarios.js", "js/story-authoring.js"];
  for (const f of ONLY3) assert.equal(undo3(f, read(f)), before(f), f + " = " + BASE + " fuera de FASE 3");
  /* FLUYO-STEP-REVERSE-002 añade scenario-engine.js, scenario-playback.js, story-playback.js y selection.js: deshechos (undoReverse, dentro de undo3), son los de BASE */
  const ONLY_REV = ["js/scenario-engine.js", "js/scenario-playback.js", "js/selection.js", "js/story-playback.js"];
  for (const f of ONLY_REV) assert.equal(undo3(f, read(f)), before(f), f + " = " + BASE + " fuera de STEP-REVERSE-002");
  /* SCENARIOS-SEMANTICS-001 FASE 5 añade el Viewer, Present, la exportación SVG, share.css y docs: su alcance lo vigila test/fluyo-scenarios-semantics-5.test.cjs (undo5, dentro de undo3) */
  const ONLY5 = ["css/share.css", "docs/index.html", "js/export.js", "js/present-story.js", "js/viewer.js", "s/index.html"];
  const { undo029 } = require("./fluyo-018-29-undo.cjs"), ONLY029 = ["js/story-clock.js"].filter((f) => undo029(f, read(f)) === before(f));   /* FLUYO-018.29 (G1) solo añade reveal al reloj: deshecho (undo029) es el de la base */
  const { undo030 } = require("./fluyo-018-30-undo.cjs"), ONLY030 = ["js/viewer-viewport.js"].filter((f) => undo030(f, read(f)) === before(f));   /* FLUYO-018.30 solo añade la cámara de la Historia al Viewer: deshecho (undo030) es el de la base */
  const { NEW_FILES: NEW_I18N, undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* FLUYO-I18N-001 añade js/i18n.js y js/i18n-en.js (no existen en la base) */
  changed.splice(0, changed.length, ...changed.filter((f) => !ONLY4B.includes(f) && !ONLY3.includes(f) && !ONLY_REV.includes(f) && !ONLY5.includes(f) && !ONLY029.includes(f) && !ONLY030.includes(f) && !NEW_I18N.includes(f)));
  assert.deepEqual(changed, ["css/styles.css", "index.html", "js/geometry.js", "js/model.js", "js/render.js", "js/ui.js", "sw.js"]);
  for (const f of ["js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/story-clock.js", "js/skin.js", "js/viewer.js", "js/export.js", "js/state.js", "js/selection.js", "js/editor-scenarios.js", "s/index.html"]) assert.equal(undo4b(f, undo3(f, read(f))), before(f), f);
  const sw = undo3("sw.js", read("sw.js"));
  assert.match(sw, /const CACHE = "fluyo-static-v115";/);
  assert.equal(sw.replace('"fluyo-static-v115"', '"fluyo-static-v' + (94 - 1) + '"'), before("sw.js"), "sw.js: solo sube CACHE (sin archivos nuevos)");
  /* UNKNOWN sigue fuera (D3): el kernel solo admite UP/DOWN */
  assert.match(read("js/model.js"), /const SCENARIO_STATES=new Set\(\["UP","DOWN"\]\);/);
  assert.match(read("js/scenario-engine.js"), /const VALID_STATES = new Set\(\["UP", "DOWN"\]\);/);
});
