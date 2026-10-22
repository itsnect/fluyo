"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 6 — QA y regresión: cierre de los bloqueantes de release (D12) sobre a4bbf2f (producción v100).
   · A (B1, «UNKNOWN nunca como disponible»: se cumple por rechazo en TODAS las entradas). Archivo, autoguardado, `?ejemplo=`, `#d=` y
     el Viewer pasan por projectFromProjectData; «Añadir como página», por documentFromProjectData; la autoría, por FluyoAuthoring.
     El pegado `fluyo::` (cloneStructureIn) era la única entrada sin la regla de carga: copiaba un Behavior UNKNOWN y el documento dejaba
     de poder leerse (autoguardado incluido). FASE 6: cloneStructureIn rechaza entero, antes de mutar, y pasteClip no pega (decisión 250).
   · B (B9, contradicción temporal SEND + SET_STATE, § T). El oráculo es la definición EXACTA de § T: un send_succeeded cuya ventana
     visible (at, at + viaje] contiene un state_changed que pasa la ruta a UNAVAILABLE, sobre una conexión de esa ruta. El fixture
     test/fixtures/fluyo-scenarios-semantics-6-b9.json lo tiene tres veces: dos en vuelo y una en el borde (la mitigación
     `waitsForArrivalOf`); la inversa NO es B9 y se cuenta aparte. PO: B9 ACEPTADO (HIGH, no BLOCKER); la semántica actual (T1, T2, C1)
     queda fijada tal cual (decisión 251).
   · C (estático): B7 en TODOS los archivos servidos, alcance frente a a4bbf2f, undo6, CACHE v101 y el kernel del MCP.
   · D (cierre del PO): la bandera labs retirada (decisión 253), «Automática · nombre» apilado (decisión 252) y «Semántica» en «Puntos»
     (decisión 254, 018.23); el resto, en Chrome. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "a4bbf2f";   // main al empezar FASE 6 (producción v100)
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js", "document-integrity.js", "story-authoring.js"];
function context(src, files) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console });
  for (const f of files) vm.runInContext(src("js/" + f), ctx, { filename: f });
  return ctx;
}
const NOW = context(read, KERNEL), OLD = context(atBase, ["config.js", "safe-svg.js", "model.js"]);
const run = (ctx, code, arg) => { ctx.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, ctx)); };
/* ¿lanza? → su código y campo (o null si no lanza) */
const fails = (ctx, code, arg) => run(ctx, `(()=>{ try{ ${code}; return null; }catch(e){ return {code:e.code||String(e), field:e.field===undefined?null:e.field}; } })()`, arg);

const rect = (id, label) => ({ id, shape: "rect", x: id * 200, y: 0, w: 140, h: 60, label: label || "N" + id });
const doc1 = (pg) => ({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [pg] }, settings: {} });
const plainPage = () => ({ name: "P", nextId: 10, behaviors: [{ nodeId: 2, initialState: "DOWN" }], nextScenarioId: 1, scenarios: [],
  nodes: [rect(1, "A"), rect(2, "B"), rect(3, "C")], edges: [{ id: 4, from: 1, to: 2, route: "straight", fromSide: null, toSide: null, waypoints: [] }] });
const corpus = () => [...fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => f.endsWith(".json")).map((f) => "ejemplos/data/" + f),
  ...fs.readdirSync(path.join(root, "test", "fixtures")).filter((f) => f.endsWith(".fluyo.json")).map((f) => "test/fixtures/" + f), "test/fixtures/fluyo-scenarios-semantics-6-b9.json"];

/* ══════════════ A · B1: UNKNOWN se rechaza en todas las entradas ══════════════ */

test("A1 · la regla de carga rechaza UNKNOWN en un Behavior, en un Step SET_STATE y en un EventType (archivo, autoguardado, #d=, Viewer, «Añadir como página»)", () => {
  const behavior = doc1(Object.assign(plainPage(), { behaviors: [{ nodeId: 2, initialState: "UNKNOWN" }] }));
  const step = doc1(Object.assign(plainPage(), { nextScenarioId: 2, scenarios: [{ id: 1, engineVersion: 2, name: "H", nextStepId: 2, steps: [{ id: 1, at: 0, action: "SET_STATE", nodeId: 2, state: "UNKNOWN" }] }] }));
  const eventType = doc1(plainPage()); eventType.doc.eventTypes = [{ id: 1, name: "X", primitive: "SET_AVAILABILITY", sentenceTemplate: "{target}", visual: { kind: "token", value: "?" }, availability: "UNKNOWN" }]; eventType.doc.nextEventTypeId = 2;
  for (const [name, d] of [["Behavior", behavior], ["Step", step], ["EventType", eventType]]) {
    assert.equal(fails(NOW, "projectFromProjectData(__a)", d).code, "invalid_document", name + ": projectFromProjectData");
    assert.equal(fails(NOW, "documentFromProjectData(__a)", d).code, "invalid_document", name + ": documentFromProjectData («Añadir como página»)");
  }
  assert.equal(fails(NOW, "projectFromProjectData(__a)", doc1(plainPage())), null, "el mismo documento con UP/DOWN se lee");
  /* las entradas del editor y del Viewer pasan por esas dos funciones (y por ninguna otra vía) */
  assert.match(read("js/state.js"), /function applyProjectData\(d\)\{\n  const normalized=projectFromProjectData\(d\);/);
  assert.match(read("js/state.js"), /function appendPagesFrom\(d\)\{\n  const nd=documentFromProjectData\(d\);/);
  assert.match(read("js/state.js"), /function restoreAutosaveSession\(\)\{\n  const d=loadAutosaveData\(\);\n  if\(!d\) return false;\n  applyProjectData\(d\);/);
  assert.match(read("js/export.js"), /applyProjectData\(JSON\.parse\(txt\)\);/, "abrir archivo");
  assert.match(read("js/share-loader.js"), /const data=await decodeDeepLink\(payload\);\n      return \{project:projectFromProjectData\(data\),payload\};/, "#d= en el Viewer");
  /* la autoría (editor y MCP) tampoco lo admite */
  const apply = (ops) => run(NOW, "FluyoAuthoring.apply(__a.p, __a.o)", { p: doc1(plainPage()), o: ops });
  assert.equal(apply([{ op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: 1, state: "UNKNOWN" }]).ok, false, "set_initial_availability UNKNOWN");
  assert.equal(apply([{ op: "set_initial_availability", scope: "page", pageIndex: 0, nodeId: 1, state: "DOWN" }]).ok, true, "y DOWN sí");
  /* Condiciones del editor escribe por setInitialAvailability (model.js): la misma barrera */
  assert.notEqual(fails(NOW, "setInitialAvailability(projectFromProjectData(__a).doc.pages[0], 1, 'UNKNOWN')", doc1(plainPage())), null, "Condiciones: UNKNOWN");
  assert.equal(fails(NOW, "setInitialAvailability(projectFromProjectData(__a).doc.pages[0], 1, 'UP')", doc1(plainPage())), null, "Condiciones: UP");
});

test("A2 · cloneStructureIn (pegar `fluyo::`): un Behavior UNKNOWN rechaza TODO el pegado antes de mutar; la base lo copiaba y el documento ya no se leía", () => {
  const clip = { nodes: [rect(1, "A"), rect(2, "B")], edges: [{ id: 4, from: 1, to: 2, route: "straight", fromSide: null, toSide: null, waypoints: [] }], behaviors: [{ nodeId: 2, initialState: "UNKNOWN" }] };
  const paste = (ctx, c) => run(ctx, `(()=>{ const d = projectFromProjectData(__a.d), pg = d.doc.pages[0], before = JSON.stringify(d);
    let err = null; try{ cloneStructureIn(pg, __a.c, {dx:20, dy:20}); }catch(e){ err = {code:e.code, field:e.field}; }
    let reload = "ok"; try{ projectFromProjectData(JSON.parse(JSON.stringify(d))); }catch(e){ reload = e.code; }
    return {err, same: JSON.stringify(d) === before, reload, nodes: pg.nodes.length, nextId: pg.nextId}; })()`, { d: doc1(plainPage()), c });
  const now = paste(NOW, clip), old = paste(OLD, clip);
  assert.deepEqual(now, { err: { code: "invalid_document", field: "behaviors" }, same: true, reload: "ok", nodes: 3, nextId: 10 }, "FASE 6: nada cambia, ni el contador");
  assert.deepEqual([old.err, old.same, old.reload, old.nodes], [null, false, "invalid_document", 5], "a4bbf2f: pegaba y el documento quedaba ilegible (el bug)");
  /* forma del portapapeles */
  for (const [name, behaviors] of [["no es lista", { nodeId: 2, initialState: "DOWN" }], ["entrada que no es objeto", [null]], ["texto", ["DOWN"]], ["estado inventado", [{ nodeId: 1, initialState: "MAYBE" }]], ["sin estado", [{ nodeId: 1 }]]])
    assert.deepEqual(paste(NOW, Object.assign({}, clip, { behaviors })).err, { code: "invalid_document", field: "behaviors" }, name);
  /* lo que no es de los nodos copiados se ignora, como antes (no entra y no bloquea) */
  for (const behaviors of [undefined, null, [], [{ nodeId: 99, initialState: "UNKNOWN" }]]) {
    const r = paste(NOW, Object.assign({}, clip, { behaviors }));
    assert.deepEqual([r.err, r.nodes, r.reload], [null, 5, "ok"], JSON.stringify(behaviors));
  }
  const ok = run(NOW, `(()=>{ const pg = projectFromProjectData(__a.d).doc.pages[0]; cloneStructureIn(pg, __a.c, {dx:20, dy:20}); return pg.behaviors; })()`,
    { d: doc1(plainPage()), c: Object.assign({}, clip, { behaviors: [{ nodeId: 1, initialState: "UP" }, { nodeId: 2, initialState: "DOWN" }] }) });
  assert.deepEqual(ok, [{ nodeId: 2, initialState: "DOWN" }, { nodeId: 10, initialState: "UP" }, { nodeId: 11, initialState: "DOWN" }], "UP y DOWN se copian como siempre");
});

test("A3 · regresión: pegar y duplicar TODO el corpus da exactamente lo de a4bbf2f (documentos, resultados y errores)", () => {
  let pages = 0, withBehaviors = 0;
  for (const f of corpus()) {
    const d = JSON.parse(read(f));
    const cases = (ctx) => run(ctx, `(()=>{ const out = []; const p = projectFromProjectData(__a);
      p.doc.pages.forEach((pg, i) => {
        const snap = {nodes: pg.nodes.map(n=>JSON.parse(JSON.stringify(n))), edges: pg.edges.map(e=>JSON.parse(JSON.stringify(e))), behaviors: (pg.behaviors||[]).map(b=>JSON.parse(JSON.stringify(b)))};
        let a, b; try{ a = cloneStructureIn(pg, snap, {dx:20, dy:20}); }catch(e){ a = e.code; }
        try{ b = pg.nodes.length ? duplicateNodesIn(pg, pg.nodes.slice(0, 3).map(n=>n.id), {dx:20, dy:20}) : null; }catch(e){ b = e.code; }
        out.push({a, b, page: pg});
      });
      return out; })()`, d);
    const now = cases(NOW), old = cases(OLD);
    assert.deepEqual(now, old, f);
    pages += now.length; withBehaviors += now.filter((c) => c.page.behaviors.length).length;
  }
  assert.ok(pages >= 10 && withBehaviors >= 1, `páginas ${pages}, con Behaviors ${withBehaviors}`);
});

test("A4 · pasteClip: un portapapeles que no se puede leer no pega nada ni apila Undo (como dupSel); id_exhausted sigue propagándose", () => {
  const sel = read("js/selection.js");
  const body = sel.slice(sel.indexOf("function pasteClip(){"), sel.indexOf("function dupSel(){"));
  assert.match(body, /  const snap=snapPage\(\);\n  let r;\n[\s\S]*  try\{ r=cloneStructureIn\(P\(\), clip, \{dx:GRID, dy:GRID\}\); \}\n  catch\(err\)\{ if\(err && typeof err\.code==="string" && err\.code!=="id_exhausted"\) return; throw err; \}\n  pushUndoSnapshot\(snap\);/);
  assert.ok(body.indexOf("pushUndoSnapshot(snap)") > body.indexOf("catch(err)"), "el Undo se apila después del dominio");
  assert.match(read("js/interaction.js"), /if\(txt\.startsWith\("fluyo::"\)\)\{\n    try\{ clip=JSON\.parse\(txt\.slice\(7\)\); \}catch\(e\)\{\}\n    pasteClip\(\); ev\.preventDefault\(\); return;/, "el pegado del sistema llega por pasteClip");
});

/* ══════════════ B · B9: SEND en vuelo + SET_STATE que deja la ruta UNAVAILABLE ══════════════ */

const FIX = JSON.parse(read("test/fixtures/fluyo-scenarios-semantics-6-b9.json"));
/* Escaneo de B9 con la receta de la reproducción (FluyoStoryClock.start: Trace visible y viaje = MOTION_MS del Playback) y la ruta de
   FASE 4 (routeTimeline). Definición exacta de § T: ventana (at, at + viaje], CERRADA por arriba. El borde (el cambio cae justo en la
   llegada, lo que produce la mitigación «Esperar a que llegue…» de la decisión 200) ES B9 (PO, cierre de FASE 6): va en b9 con
   boundary: true. inverse = un send_failed cuyo vuelo contiene la vuelta de la ruta a AVAILABLE: NO es B9 (PO), se cuenta aparte. */
function scan(docData, storyId) {
  return run(NOW, `(()=>{ const p = projectFromProjectData(__a.d).doc.pages[0], sc = p.scenarios.find(s => s.id === __a.id);
    const pair = FluyoFlow.resolveObservedFlow(p, sc); if(pair.state !== FluyoFlow.PAIR) return null;
    const st = FluyoStoryClock.start(p, sc, 0), pb = st.playback, events = pb.trace.events;
    const route = FluyoFlow.flowRoute(p, pair.source, pair.target), tl = FluyoFlow.routeTimeline(p, route, events, 1e9);
    const onRoute = new Set(route.edges.map(e => e.id)), b9 = [], inverse = [];
    for(const ev of events){
      if(ev.type !== "send_succeeded" && ev.type !== "send_failed") continue;
      const arrival = ev.at + FluyoStoryClock.travelMs(pb.stepMeta, ev.stepId);
      for(const i of tl.instants){
        if(!i.frontier || !(i.at > ev.at && i.at <= arrival) || !onRoute.has(ev.edgeId)) continue;
        const o = {stepId: ev.stepId, edgeId: ev.edgeId, sendAt: ev.at, arrival, changeAt: i.at, to: i.status, boundary: i.at === arrival};
        if(ev.type === "send_succeeded" && i.status === FluyoFlow.UNAVAILABLE) b9.push(o);
        if(ev.type === "send_failed" && i.status === FluyoFlow.AVAILABLE) inverse.push(o);
      }
    }
    return {b9, inverse}; })()`, { d: docData, id: storyId });
}
/* Lo que ve el usuario en el instante t: la línea de estado (routeLine, Viewer y Present), la funda de la conexión (routeOverlay, editor,
   Present y Viewer), el token (Playback), el estado del nodo y el mensaje (FluyoStory.caption). */
function frame(docData, storyId, t, edgeId) {
  return run(NOW, `(()=>{ const p = projectFromProjectData(__a.d).doc.pages[0], sc = p.scenarios.find(s => s.id === __a.id);
    const pb = FluyoStoryClock.start(p, sc, 0).playback, r = FluyoScenarioPlayback.tick(pb, __a.t), events = pb.trace.events;
    const pair = FluyoFlow.resolveObservedFlow(p, sc), route = FluyoFlow.flowRoute(p, pair.source, pair.target);
    const ov = FluyoFlow.routeOverlay(p, route, FluyoFlow.routeTimeline(p, route, events, 1e9), __a.t);
    const line = FluyoFlow.routeLine(p, sc, events, __a.t, s => FluyoStoryClock.visibleAt(pb, s));
    const e = p.edges.find(x => x.id === __a.e), a = r.activeSends.find(s => s.edgeId === __a.e), c = r.completedSends.find(s => s.edgeId === __a.e);
    const name = id => (p.nodes.find(n => n.id === id) || {}).label;
    return {line: line && line.status, shell: ov && ov.edges[__a.e] ? ov.edges[__a.e].cls : null, sweep: !!(ov && ov.sweep),
      token: a ? {progress: Math.round(a.progress * 100), outcome: a.terminalType} : null, arrived: c ? c.terminalType : null,
      target: r.nodeStates[e.to] || "UP", caption: FluyoStory.caption(r.logEvents, __a.t, name, id => p.edges.find(x => x.id === id)) || ""}; })()`,
    { d: docData, id: storyId, t, e: edgeId });
}
const COLA_WB = 14;

test("B1 · el fixture de la QA del PO: B9 en las Historias 1 y 2 (dentro del vuelo) y 3 (en el borde: la definición es cerrada por arriba); la 4 (inversa) NO es B9", () => {
  assert.deepEqual(FIX.doc.pages[0].scenarios.map((s) => s.name), ["Cae el destino con el pedido en camino", "Cae la BD con el pedido en camino",
    "La caída espera a que llegue el pedido", "Vuelve el destino con el pedido en camino"]);
  const at = (stepId, sendAt, changeAt, to) => ({ stepId, edgeId: COLA_WB, sendAt, arrival: sendAt + 1100, changeAt, to, boundary: changeAt === sendAt + 1100 });
  assert.deepEqual(scan(FIX, 1), { b9: [at(3, 2500, 3000, "UNAVAILABLE")], inverse: [] });
  assert.deepEqual(scan(FIX, 2), { b9: [at(2, 2500, 3000, "UNAVAILABLE")], inverse: [] });
  assert.deepEqual(scan(FIX, 3), { b9: [at(3, 2500, 3600, "UNAVAILABLE")], inverse: [] }, "Historia 3: B9 en el borde (cambio == llegada); nunca con el pedido en camino");
  assert.equal(scan(FIX, 3).b9[0].boundary, true, "el borde se marca");
  assert.equal(scan(FIX, 1).b9[0].boundary, false);
  assert.deepEqual(scan(FIX, 4), { b9: [], inverse: [at(4, 2500, 3000, "AVAILABLE")] }, "Historia 4: la inversa NO es B9 (PO); queda como caso futuro");
  /* el documento es válido, sin avisos, y su ruta es automática (Cliente → BD) */
  assert.deepEqual(run(NOW, "(()=>{ const v = FluyoIntegrity.validateProject(__a); return [v.valid, v.errors.length, (v.warnings||[]).length]; })()", FIX), [true, 0, 0]);
  assert.equal(FIX.doc.pages[0].scenarios.some((s) => "observedFlow" in s), false);
});

test("B2 · la Historia de aceptación de FASE 3–5 (dos workers: pedido a 0, cae A a 1,5 s, cae B a 3 s) no contiene B9", () => {
  const d = J(FIX); d.doc.pages[0].scenarios = [{ id: 1, engineVersion: 2, name: "Pedido y caídas", nextStepId: 4, steps: [
    { id: 1, at: 0, action: "SEND", edgeId: 11, eventTypeId: 1 }, { id: 2, at: 1500, action: "SET_STATE", nodeId: 4, state: "DOWN", eventTypeId: 2 },
    { id: 3, at: 3000, action: "SET_STATE", nodeId: 5, state: "DOWN", eventTypeId: 2 }] }];
  assert.deepEqual(scan(d, 1), { b9: [], inverse: [] });
});

test("B3 · semántica actual fijada (§ T, sin cambios en FASE 6): la ruta cambia en el instante del SET_STATE (T1); el envío ya se decidió al salir (C1) y llega «completado» sobre un destino no disponible", () => {
  const f = (t) => frame(FIX, 1, t, COLA_WB);
  assert.deepEqual(f(2999), { line: "AVAILABLE", shell: "AVAILABLE", sweep: false, token: { progress: 45, outcome: "send_succeeded" }, arrived: null, target: "UP", caption: "Worker A no está disponible" });
  assert.deepEqual(f(3000), { line: "UNAVAILABLE", shell: "UNAVAILABLE", sweep: true, token: { progress: 45, outcome: "send_succeeded" }, arrived: null, target: "DOWN", caption: "Worker B no está disponible" });
  assert.deepEqual(f(3300), { line: "UNAVAILABLE", shell: "UNAVAILABLE", sweep: true, token: { progress: 73, outcome: "send_succeeded" }, arrived: null, target: "DOWN", caption: "Worker B no está disponible" });
  assert.deepEqual(f(3650), { line: "UNAVAILABLE", shell: "UNAVAILABLE", sweep: true, token: null, arrived: "send_succeeded", target: "DOWN", caption: "Worker B no está disponible" });
  /* el resultado del Step es «completado» (story-playback outcomes, el mismo que lee el MCP en run_story) */
  const out = run(NOW, `(()=>{ const p = projectFromProjectData(__a).doc.pages[0], sc = p.scenarios[0]; const r = FluyoStory.run(p, sc);
    return FluyoStory.outcomes(r.trace, sc, p).find(o => o.stepId === 3).status; })()`, FIX);
  assert.equal(out, "completed");
});

test("B4 · T2: los envíos nunca alimentan la ruta (quitar el SEND en vuelo deja la línea de tiempo de la ruta idéntica)", () => {
  const without = J(FIX); without.doc.pages[0].scenarios[0].steps = without.doc.pages[0].scenarios[0].steps.filter((s) => s.action !== "SEND");
  const tl = (d) => run(NOW, `(()=>{ const p = projectFromProjectData(__a).doc.pages[0], sc = p.scenarios[0];
    const pb = FluyoStoryClock.start(p, sc, 0).playback, route = FluyoFlow.flowRoute(p, 1, 6);
    return FluyoFlow.routeTimeline(p, route, pb.trace.events, 4000).instants.map(i => ({at: i.at, status: i.status, frontier: i.frontier})); })()`, d);
  assert.deepEqual(tl(without), tl(FIX));
  assert.deepEqual(tl(FIX), [{ at: 0, status: "AVAILABLE", frontier: false }, { at: 1500, status: "AVAILABLE", frontier: false }, { at: 3000, status: "UNAVAILABLE", frontier: true }]);
});

test("B5 · mitigación de autoría (decisión 200): con «Esperar a que llegue…», la ruta cambia EN la llegada y nunca con el pedido en camino", () => {
  const f = (t) => frame(FIX, 3, t, COLA_WB);
  for (const t of [2600, 3000, 3300, 3599]) {
    const x = f(t);
    assert.deepEqual([x.line, x.shell, x.target, !!x.token], ["AVAILABLE", "AVAILABLE", "UP", true], "en vuelo a " + t);
  }
  assert.deepEqual([f(3600).line, f(3600).shell, f(3600).arrived, f(3600).target], ["UNAVAILABLE", "UNAVAILABLE", "send_succeeded", "DOWN"], "en la llegada");
  assert.equal(run(NOW, `FluyoStoryClock.schedule(projectFromProjectData(__a).doc.pages[0].scenarios[2], FluyoStory.stepMeta(projectFromProjectData(__a).doc.pages[0].scenarios[2].steps)).times[3]`, FIX), 3600);
});

test("B6 · ruta ≠ salto: si cae la BD con el pedido en camino, el salto Cola → Worker B llega a un nodo DISPONIBLE y la ruta es «no disponible» (las dos cosas son ciertas)", () => {
  const x = frame(FIX, 2, 3650, COLA_WB);
  assert.deepEqual([x.line, x.shell, x.arrived, x.target, x.caption], ["UNAVAILABLE", "UNAVAILABLE", "send_succeeded", "UP", "BD no está disponible"]);
});

test("B7 · la inversa (fuera de la definición de B9): el envío ya falló al salir y el destino vuelve en vuelo; el token se apaga sobre una ruta disponible", () => {
  const f = (t) => frame(FIX, 4, t, COLA_WB);
  assert.deepEqual([f(2999).line, f(2999).token, f(2999).caption], ["UNAVAILABLE", { progress: 45, outcome: "send_failed" }, "No se completó · Worker B no está disponible"]);
  assert.deepEqual([f(3300).line, f(3300).shell, f(3300).token, f(3300).target, f(3300).caption], ["AVAILABLE", "AVAILABLE", { progress: 73, outcome: "send_failed" }, "UP", "Worker B vuelve a estar disponible"]);
  assert.deepEqual([f(3650).arrived, f(3650).line], ["send_failed", "AVAILABLE"]);
});

/* ══════════════ C · estático ══════════════ */

const SERVED = ["js", "s", "css", "index.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
test("C1 · B7: ningún archivo servido (todo lo de js/, css/, las páginas y sw.js) contiene código de bandera del prototipo", () => {
  const files = execFileSync("git", ["-C", gitRoot, "ls-files", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter((f) => /\.(js|css|html|webmanifest)$/.test(f));
  assert.ok(files.length >= 45, "archivos " + files.length);
  for (const f of files) assert.doesNotMatch(read(f), /PROTO_|prototipo=|protoSemantic|proto-semantic|semantic-flow\.js/, f);
  /* todos los scripts que cargan el editor y el Viewer están en esa lista */
  for (const page of ["index.html", "s/index.html"]) for (const m of read(page).matchAll(/<script src="(?!https?:)([^"]+)"/g)) {
    const f = path.posix.normalize(path.posix.join(path.posix.dirname(page), m[1]));
    assert.ok(files.includes(f), page + " → " + f);
  }
});

const FILES6 = ["css/styles.css", "docs/index.html", "index.html", "js/editor-scenarios.js", "js/model.js", "js/present-story.js", "js/render.js", "js/selection.js", "js/ui.js"];
const lines = (s) => s.split("\n").filter(Boolean);
test("C2 · alcance frente a " + BASE + ": B1 (model.js, selection.js), «Automática · nombre» (styles.css), la bandera retirada (ui.js, editor-scenarios.js y comentarios), docs y sw.js (CACHE v101); undo6 los devuelve EXACTOS", () => {
  const changed = lines(execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }));
  const untracked = lines(execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }));
  const { PIECES } = require("./fluyo-scenarios-semantics-6-undo.cjs"), { undoMsg6: undo6, undoMsg, PIECES: PIECESM } = require("./fluyo-step-message-001-undo.cjs"), readM = (f) => undoMsg(f, read(f));   /* FLUYO-MCP-STEP-MESSAGE-001 va encima: se deshace antes */
  assert.deepEqual([...new Set([...changed, ...untracked])].filter((f) => !(f in PIECESM) || FILES6.includes(f) || undo6(f, read(f)) !== atBase(f)).sort(), FILES6.concat("sw.js").sort());
  assert.deepEqual(Object.keys(PIECES).sort(), FILES6);
  for (const f of FILES6) assert.equal(undo6(f, read(f)), atBase(f), f + ": undo6 exacto");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v103";/);
  assert.equal(read("sw.js").replace('"fluyo-static-v103"', '"fluyo-static-v' + (101 - 1) + '"'), atBase("sw.js"), "sw.js: solo la constante (el precache no cambia)");
  /* en model.js solo cambia cloneStructureIn (y su nota en la cabecera de autoría) */
  const fn = (s) => s.slice(s.indexOf("function cloneStructureIn("), s.indexOf("const DUPLICATE_CONNECTIONS"));
  assert.equal(readM("js/model.js").replace(fn(readM("js/model.js")), "").replace(/ Los Behaviors que se copian pasan la regla de carga\n[\s\S]*?\(SCENARIOS-SEMANTICS-001 FASE 6, B1\)\.\n/, "\n"),
    atBase("js/model.js").replace(fn(atBase("js/model.js")), ""));
  /* el resto del kernel, la derivación, el Viewer, Share y la exportación no cambian (la semántica de FASE 4/5, PO) */
  for (const f of ["js/flow-semantics.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/story-clock.js", "js/viewer.js", "js/share-url.js", "js/export.js", "js/document-integrity.js", "js/story-authoring.js", "s/index.html", "css/share.css"])
    assert.equal(readM(f), atBase(f), f + " intacto");
});

test("D1 · la bandera labs se retiró: ninguna superficie la lee ni depende de ella; la herramienta, el selector y W5 existen sin ella", () => {
  const files = lines(execFileSync("git", ["-C", gitRoot, "ls-files", "--", ...SERVED], { encoding: "utf8" })).filter((f) => /\.(js|css|html)$/.test(f));
  for (const f of files) assert.doesNotMatch(read(f), /LABS_SEMANTICS|scFlowLabs|fluyo\.labs\.|[?&]labs=|get\("labs"\)/, f);
  const ui = read("js/ui.js"), ed = read("js/editor-scenarios.js");
  assert.ok(ui.includes('$("rowKind").style.display=isNode ? "none" : "flex";'), "Semántica en toda conexión");
  assert.ok(ui.includes('function syncKindNote(e){ $("kindNote").hidden=!flowArrowReversed(e); }'), "W5 sin bandera");
  assert.ok(ed.includes('function scFlowShown(pg, sc) {\n  return typeof FluyoFlow !== "undefined" && !!pg && !!sc && sc.steps.length > 0 && pg.edges.some((e) => edgeKind(e) === "FLOWS_TO");'), "la herramienta: solo Flujo y eventos");
  /* el editor carga flow-semantics.js (antes de editor-scenarios.js) y lo precachea */
  const html = read("index.html");
  assert.ok(html.indexOf("js/flow-semantics.js") > 0 && html.indexOf("js/flow-semantics.js") < html.indexOf("js/editor-scenarios.js"));
  assert.ok(read("sw.js").includes('"./js/flow-semantics.js"'));
});

test("D2 · «Automática · nombre»: la herramienta es su propio contenedor y apila origen y destino por debajo de 540 px (con espacio, la fila de siempre)", () => {
  const css = read("css/styles.css");
  assert.match(css, /\.scFlow\{[^}]*container:scflow \/ inline-size;\}/);
  const at = css.indexOf("@container scflow (max-width: 539px){");
  assert.ok(at > 0);
  const body = css.slice(at, css.indexOf("\n}\n", at));
  assert.ok(body.includes(".scFlowPick{flex:1 1 100%;}"));
  assert.ok(body.includes('.scFlowArrow::before{content:"↓"; font-size:12px;}'));
  /* el marcado y el orden no cambian: origen, flecha, destino (la interacción es la misma) */
  assert.ok(read("index.html").includes('<select id="scFlowFrom"></select></label><span class="scFlowArrow" aria-hidden="true">→</span><label class="scFlowPick"><span class="srOnly">Destino</span><select id="scFlowTo">'));
});

test("D3 · «Semántica» es la primera fila de «Puntos», un grupo plegado por defecto para las conexiones (decisión 254, 018.23): Trazo y Dirección no la llevan; el aviso W5 va justo detrás", () => {
  const html = read("index.html");
  const group = (id) => html.slice(html.indexOf('<details class="pgroup" id="' + id + '"'), html.indexOf("</details>", html.indexOf('<details class="pgroup" id="' + id + '"')));
  const flow = group("grpFlow");
  const body = flow.slice(flow.indexOf('<div class="pgBody">') + '<div class="pgBody">'.length);
  const first = body.match(/<(div|p) class="[^"]*" id="(\w+)"/);
  assert.equal(first && first[2], "rowKind", "primera fila de «Puntos»");
  assert.ok(body.indexOf('id="kindNote"') > body.indexOf('id="rowKind"') && body.indexOf('id="kindNote"') < body.indexOf('id="rowDotC"'), "W5 justo detrás del selector");
  for (const id of ["grpStroke", "grpRoute"]) assert.ok(!group(id).includes('id="rowKind"') && !group(id).includes('id="kindNote"'), id + " sin «Semántica»");
  assert.match(flow, /^<details class="pgroup" id="grpFlow" data-group="Puntos">/, "«Puntos» empieza plegado en el marcado");
  /* los grupos abiertos de una conexión siguen siendo Trazo y Dirección (018.23): «Puntos» empieza plegado */
  assert.ok(read("js/ui.js").includes('function primaryGroups(kind){ return kind==="edge" ? ["grpStroke","grpRoute"] : ["grpShape","grpText"]; }'));
});

test("C3 · el kernel del MCP (repo hermano) lleva el model.js de este árbol (decisión 70: mismo cambio)", (t) => {
  const gen = path.join(root, "..", "fluyo-mcp", "src", "generated", "kernel-sources.ts");
  if (!fs.existsSync(gen)) return t.skip("sin fluyo-mcp hermano");
  const src = fs.readFileSync(gen, "utf8");
  const m = src.match(/name: "model\.js",\n\s+sha256: "([0-9a-f]{64})"/);
  assert.ok(m, "model.js en KERNEL_FILES");
  const sha = require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(root, "js", "model.js"), "utf8").replace(/\r\n/g, "\n")).digest("hex");
  assert.equal(m[1], sha);
});
