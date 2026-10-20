"use strict";
/* FLUYO-019-HIT-TEST — Acierto hoja → conexión → contenedor (D1), puerto diferido (D2), D3–D5 fijadas y foco del panel (D7).
   Contratos en vm (sin navegador) y estáticos. Lo que solo existe con puntero real (clics, foco, dedo) lo mide
   test/fluyo-019-hit-test-browser.cjs.
   · isContainerNode (geometry.js): contenedor = contiene el CENTRO de otro nodo de menor área. Sin caché.
   · hitTarget / hitNode / hitSideArrowHost (interaction.js), cargados del árbol y evaluados sobre la tabla de la tarea (§4.2):
     una conexión dentro de un contenedor gana al contenedor; una hoja gana aunque el contenedor esté encima en Z; el vacío y
     el borde del contenedor siguen siendo el contenedor (D3); el más interior gana en el anidado; una caja SIN hijos es hoja (F′).
   · No regresión: en los 8 ejemplos públicos (sin contenedores) hitTarget da EXACTAMENTE lo que daba el acierto de la base
     (nodo y luego conexión) en una rejilla de puntos.
   · D4: los instrumentos de la conexión seleccionada siguen antes que el puerto y que los nodos; radios sin cambios.
   · D5: el acierto no depende del relleno (fill:"none", forma text).
   · D2: el puerto anota connectPending; connectDrag solo nace al moverse > CONNECT_MOVE_PX; soltar sin moverse = clic (portClick).
   · D7: releasePanelFocus es lo primero del pointerdown y closeEditBox quita el foco.
   · Alcance: frente a la base d31703e solo cambian interaction.js, geometry.js (isContainerNode), editor-scenarios.js
     (hitLeafNode en Historias) y sw.js (CACHE v90). render.js, export.js, skin.js, model.js, ui.js, config.js: idénticos. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "d31703e";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const { undo4a } = require("./fluyo-019-4a-undo.cjs");   /* FLUYO-019.4a cambia a propósito skin.js, render.js y export.js: se deshace aquí; su alcance lo vigila test/fluyo-019-4a.test.cjs */
const { undo4b } = require("./fluyo-019-4b-undo.cjs");   /* FLUYO-019.4b cambia a propósito render.js, interaction.js, geometry.js, editor-runtime.js, state.js e index.html: se deshace aquí (antes que 019.4a y FASE 1); su alcance lo vigila test/fluyo-019-4b.test.cjs */
const { undoSemantics } = require("./fluyo-scenarios-semantics-undo.cjs");   /* SCENARIOS-SEMANTICS-001 (FASE 1) cambia a propósito model.js, geometry.js, render.js, ui.js, index.html y styles.css: se deshace aquí; su alcance lo vigila test/fluyo-scenarios-semantics-1.test.cjs */
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };
const J = (v) => JSON.parse(JSON.stringify(v));

/* Contexto: kernel + geometry + el bloque de acierto de interaction.js (desde hitLeafNode hasta las esquinas) y el de los
   extremos. isTouch y viewZoom son los únicos stubs: el resto es código del producto. */
function ctxFrom(src, hitBlock, endBlock) {
  const G = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of ["config.js", "safe-svg.js", "model.js", "geometry.js"]) vm.runInContext(src("js/" + f), G, { filename: f });
  vm.runInContext("var viewZoom=1; var __touch=false; function isTouch(){ return __touch; }", G);
  vm.runInContext(hitBlock, G, { filename: "interaction.js#hit" });
  if (endBlock) vm.runInContext(endBlock, G, { filename: "interaction.js#end" });
  return G;
}
const I = read("js/interaction.js");
const NOW = ctxFrom(read, between(I, "function nodeBoxHit(", "/* Esquinas y codos"), between(I, "function endHitRadius(", "/* Devuelve el índice del TRAMO"));
const IB = atBase("js/interaction.js");
const OLD = ctxFrom(atBase, between(IB, "function hitNode(", "/* Esquinas y codos"));
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const load = (G, nodes, edges) => run(G, "doc.pages=[__a]; doc.cur=0; true", { name: "P", nodes, edges, nextId: 999, behaviors: [], scenarios: [], nextScenarioId: 1 });
/* qué recibe un clic en (x,y): "nodo L", "conexión F→T" o "vacío" */
const NAME = "const L=id=>{const n=nodeById(id); return n? n.label : '#'+id;};";
const target = (x, y) => run(NOW, "(()=>{" + NAME + "const t=hitTarget(" + x + "," + y + "); return !t? 'vacío' : t.kind==='node'? 'nodo '+t.obj.label : 'conexión '+L(t.obj.from)+'→'+L(t.obj.to);})()");
const nodeAt = (x, y) => run(NOW, "(()=>{const n=hitNode(" + x + "," + y + "); return n? n.label : null;})()");

const N = (id, x, y, w, h, label, ex) => Object.assign({ id, shape: "rect", x, y, w, h, label, color: "#6a9fb5" }, ex || {});
const E = (id, from, to, ex) => Object.assign({ id, from, to, route: "straight", animated: true, endArrow: true, waypoints: [] }, ex || {});
const GCP = (ex) => N(1, 500, 350, 640, 420, "GCP", Object.assign({ border: "dashed" }, ex || {}));
const A = N(2, 330, 300, 120, 60, "A"), B = N(3, 670, 300, 120, 60, "B"), C = N(4, 500, 470, 120, 60, "C"), X = N(5, 40, 300, 100, 60, "X"), Y = N(6, 960, 300, 100, 60, "Y");
const REGION = N(7, 500, 350, 820, 560, "Región");

/* ───────── isContainerNode ───────── */
test("isContainerNode: contiene el CENTRO de otro nodo más pequeño; sin caché", () => {
  const is = (nodes, id) => run(NOW, "isContainerNode(__a.find(n=>n.id===" + id + "), __a)", nodes);
  assert.equal(is([GCP(), A], 1), true, "GCP con A dentro");
  assert.equal(is([GCP(), A], 2), false, "A es hoja");
  assert.equal(is([GCP()], 1), false, "caja sin hijos = hoja");
  assert.equal(is([GCP(), N(2, 180 - 50, 300, 120, 60, "fuera")], 1), false, "un nodo que solo toca el borde (centro fuera) no hace contenedor");
  assert.equal(is([N(1, 0, 0, 200, 100, "P"), N(2, 50, 0, 200, 100, "Q")], 1), false, "dos cajas iguales solapadas: ninguna es contenedor");
  assert.equal(is([N(1, 0, 0, 200, 100, "Caja"), N(2, 0, -30, 80, 20, "Título", { shape: "text" })], 1), true, "un texto sobre una caja la hace contenedor");
  assert.equal(is([N(1, 0, 0, 200, 100, "P"), N(2, 90, 0, 60, 60, "medio dentro")], 1), true, "caso límite: un nodo medio fuera cuyo centro cae dentro");
  const g = read("js/geometry.js");
  assert.match(between(g, "function isContainerNode(", "\n}"), /m\.w\*m\.h<a && Math\.abs\(m\.x-n\.x\)<n\.w\/2 && Math\.abs\(m\.y-n\.y\)<n\.h\/2/);
  assert.ok(!/containerCache|_container/.test(g + I), "sin caché de contenedores");
});

/* ───────── tabla de la tarea (§4.2): D1 + D3 ───────── */
const CASES = [
  ["A conexión dentro de GCP (mitad de A→B)", [GCP(), A, B], [E(10, 2, 3)], [500, 300], "conexión A→B"],
  ["A′ la misma, a 20 px de A", [GCP(), A, B], [E(10, 2, 3)], [410, 300], "conexión A→B"],
  ["B nodo dentro de GCP", [GCP(), A, B], [E(10, 2, 3)], [330, 300], "nodo A"],
  ["B′ nodo dentro de GCP con GCP encima en Z", [A, B, GCP()], [E(10, 2, 3)], [330, 300], "nodo A"],
  ["C vacío dentro de GCP (D3)", [GCP(), A, B], [E(10, 2, 3)], [500, 200], "nodo GCP"],
  ["D borde de GCP (D3)", [GCP(), A, B], [E(10, 2, 3)], [500, 141], "nodo GCP"],
  ["E caja vacía", [GCP()], [], [500, 350], "nodo GCP"],
  ["F conexión X→Y que cruza GCP con hijos", [GCP(), N(2, 330, 420, 120, 60, "A"), X, Y], [E(10, 5, 6)], [500, 300], "conexión X→Y"],
  ["F′ conexión que cruza una caja SIN hijos (hoja)", [N(1, 500, 300, 200, 160, "Caja"), X, Y], [E(10, 5, 6)], [500, 300], "nodo Caja"],
  ["G conexión entre hijos (B→C)", [GCP(), A, B, C], [E(11, 3, 4)], [585, 385], "conexión B→C"],
  ["H interna↔externa, tramo dentro", [GCP(), A, B, X], [E(13, 5, 2)], [220, 300], "conexión X→A"],
  ["H′ interna↔externa, tramo fuera", [GCP(), A, B, X], [E(13, 5, 2)], [140, 300], "conexión X→A"],
  ["N vacío de GCP dentro de Región (el más interior)", [REGION, GCP(), A, B], [E(10, 2, 3)], [500, 200], "nodo GCP"],
  ["N′ vacío de Región fuera de GCP", [REGION, GCP(), A, B], [E(10, 2, 3)], [140, 600], "nodo Región"],
  ["N″ conexión dentro del anidado", [REGION, GCP(), A, B], [E(10, 2, 3)], [500, 300], "conexión A→B"],
  ["N‴ anidado con Región ENCIMA en Z: gana el más interior", [GCP(), A, B, REGION], [E(10, 2, 3)], [500, 200], "nodo GCP"],
  ["fuera de todo", [GCP(), A, B], [E(10, 2, 3)], [500, 60], "vacío"],
];
for (const [name, nodes, edges, [x, y], want] of CASES) {
  test("hitTarget · " + name + " → " + want, () => { load(NOW, nodes, edges); assert.equal(target(x, y), want); });
}

test("hitNode (destinos de conectar, extremos, «Conectar» táctil, Historias de nodo): hoja antes que contenedor", () => {
  load(NOW, [A, B, GCP()], [E(10, 2, 3)]);
  assert.equal(nodeAt(330, 300), "A", "con GCP encima en Z, soltar sobre A conecta con A");
  assert.equal(nodeAt(500, 300), "GCP", "sobre la conexión no hay hoja: el contenedor (una conexión no es destino de conexión)");
  assert.equal(nodeAt(500, 60), null);
  load(NOW, [REGION, GCP(), A], []);
  assert.equal(nodeAt(500, 200), "GCP", "el contenedor más interior");
});

test("Z invertido: los 9 puntos de muestra de cada hijo son del hijo (antes, 9/9 del contenedor)", () => {
  load(NOW, [A, B, C, GCP()], [E(10, 2, 3), E(11, 3, 4)]);
  for (const n of [A, B, C]) {
    const hw = n.w / 2, hh = n.h / 2;
    for (const [dx, dy] of [[0, 0], [hw - 5, 0], [-hw + 5, 0], [0, -hh + 5], [0, hh - 5], [-hw + 6, -hh + 6], [hw - 6, -hh + 6], [-hw + 6, hh - 6], [hw - 6, hh - 6]])
      assert.equal(target(n.x + dx, n.y + dy), "nodo " + n.label, n.label + " (" + dx + "," + dy + ")");
  }
});

test("hitSideArrowHost: el puerto de una hoja antes que el de un contenedor", () => {
  /* hoja pegada al borde N de GCP: su puerto N (18 px fuera de la hoja) cae a la vez cerca del puerto N de GCP */
  const leaf = N(2, 500, 140 + 30 + 2, 120, 60, "Hoja");
  load(NOW, [GCP(), leaf], []);
  const port = run(NOW, "connectPortPoint(nodeById(2),'n',1)");
  assert.equal(run(NOW, "hitSideArrowHost(" + port.x + "," + port.y + ").label"), "Hoja");
  load(NOW, [leaf, GCP()], []);
  assert.equal(run(NOW, "hitSideArrowHost(" + port.x + "," + port.y + ").label"), "Hoja", "también con el contenedor encima en Z");
});

/* ───────── no regresión sin contenedores ───────── */
test("sin contenedores (8 ejemplos públicos): hitTarget = acierto de la base (nodo y luego conexión) en una rejilla", () => {
  const dir = path.join(root, "ejemplos", "data");
  let pts = 0;
  for (const f of fs.readdirSync(dir)) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const pg of data.doc.pages) {
      load(NOW, pg.nodes, pg.edges); load(OLD, pg.nodes, pg.edges);
      assert.equal(run(NOW, "P().nodes.filter(n=>isContainerNode(n,P().nodes)).length"), 0, f + ": sin contenedores");
      const xs = pg.nodes.flatMap((n) => [n.x - n.w / 2, n.x + n.w / 2]), ys = pg.nodes.flatMap((n) => [n.y - n.h / 2, n.y + n.h / 2]);
      const b = { x0: Math.min(...xs) - 30, x1: Math.max(...xs) + 30, y0: Math.min(...ys) - 30, y1: Math.max(...ys) + 30 };
      const now = run(NOW, "(()=>{const o=[]; for(let y=" + b.y0 + ";y<=" + b.y1 + ";y+=9) for(let x=" + b.x0 + ";x<=" + b.x1 + ";x+=9){ const t=hitTarget(x,y); o.push(t? t.kind[0]+t.obj.id : '-'); } return o.join(','); })()");
      const old = run(OLD, "(()=>{const o=[]; for(let y=" + b.y0 + ";y<=" + b.y1 + ";y+=9) for(let x=" + b.x0 + ";x<=" + b.x1 + ";x+=9){ const n=hitNode(x,y); const e=n? null : hitEdge(x,y); o.push(n? 'n'+n.id : e? 'e'+e.id : '-'); } return o.join(','); })()");
      assert.equal(now, old, f);
      pts += now.split(",").length;
    }
  }
  assert.ok(pts > 30000, "puntos comparados: " + pts);
});

/* ───────── D4 · D5 ───────── */
test("D4: los instrumentos de la conexión seleccionada siguen ANTES que el puerto y que los nodos; radios sin cambios", () => {
  const down = between(I, 'cv.addEventListener("pointerdown", ev=>{', "\n});");
  const i2 = down.indexOf("// 2) extremos / codos / puntos medios"), i3 = down.indexOf("// 3) puerto de conectar"), i4 = down.indexOf("// 4) nodo");
  assert.ok(i2 > 0 && i3 > i2 && i4 > i3, "orden instrumentos → puerto → nodo");
  assert.match(down, /const end=hitEdgeEnd\(se,p\.x,p\.y\);\n\s*if\(end\)\{ endDrag=\{edgeId:se\.id, which:end\}; freezeEdgeLabels\(\); return; \}/);
  assert.equal(between(I, "function endHitRadius(", "\n"), between(IB, "function endHitRadius(", "\n"), "radio del extremo idéntico a la base");
  load(NOW, [A, B], [E(10, 2, 3)]);
  assert.equal(run(NOW, "hitEdgeEnd(edgeById(10), 393, 300)"), "from", "a 3 u del ancla, DENTRO de A: el extremo (sigue ganando)");
});
test("D5: el acierto no depende del relleno ni de la forma", () => {
  load(NOW, [N(1, 0, 0, 200, 100, "Hueca", { fill: "none" })], []);
  assert.equal(target(0, 0), "nodo Hueca", "fill:none se acierta en su centro");
  load(NOW, [N(1, 0, 0, 200, 60, "Título", { shape: "text" })], []);
  assert.equal(target(95, 25), "nodo Título", "un texto en toda su caja");
  assert.ok(!/\.fill|fill===/.test(between(I, "function nodeBoxHit(", "function hitEdge(")), "el acierto de nodos no mira el relleno");
});

/* ───────── D2 · D7 (contratos estáticos; el comportamiento real lo mide el test de navegador) ───────── */
test("D2: el puerto anota connectPending; connectDrag nace con movimiento real; soltar sin moverse = clic, sin conexión", () => {
  const down = between(I, 'cv.addEventListener("pointerdown", ev=>{', "\n});");
  const port = between(down, "// 3) puerto de conectar", "// 4) nodo");
  assert.match(port, /connectPending=\{fromId:host\.id, fromSide:arrowSide, p0:\{x:p\.x,y:p\.y\}, cx:ev\.clientX, cy:ev\.clientY, add:ev\.shiftKey\};/);
  assert.ok(!/connectDrag=/.test(port), "el pointerdown ya no arranca connectDrag");
  const move = between(I, 'cv.addEventListener("pointermove", ev=>{', "\n});");
  assert.match(move, /if\(connectPending\)\{\n\s*if\(Math\.hypot\(ev\.clientX-connectPending\.cx, ev\.clientY-connectPending\.cy\)<=CONNECT_MOVE_PX\) return;\n\s*connectDrag=\{fromId:connectPending\.fromId, fromSide:connectPending\.fromSide\};/);
  assert.match(I, /const CONNECT_MOVE_PX=3;/);
  const up = between(I, 'cv.addEventListener("pointerup", ev=>{', "\n});");
  assert.ok(up.indexOf("if(connectPending){") >= 0 && up.indexOf("if(connectPending){") < up.indexOf("if(connectDrag){"), "se resuelve antes que connectDrag");
  assert.match(up, /if\(connectPending\)\{ const cp=connectPending; connectPending=null; portClick\(cp\.p0, cp\.add\); \}/);
  const pc = between(I, "function portClick(", "\n}");
  assert.match(pc, /const t=hitTarget\(p\.x,p\.y\);/);
  assert.ok(!/newEdge/.test(pc), "un clic nunca crea una conexión");
  assert.match(between(I, "function cancelGestures(){", "\n}"), /connectPending=null;/);
  assert.match(between(I, 'if(ev.key==="Escape"){ routePending=null;', "\n"), /connectPending=null;/);
});
test("D1: pasos 4–5 del pointerdown, hover y doble clic usan hitTarget", () => {
  const down = between(I, 'cv.addEventListener("pointerdown", ev=>{', "\n});");
  assert.match(between(down, "// 4) nodo", "// 6) vacío"), /const tgt=hitTarget\(p\.x,p\.y\);\n\s*if\(tgt && tgt\.kind==="node"\)\{\n\s*const n=tgt\.obj;/);
  assert.match(between(down, "// 5) flecha", "// 6) vacío"), /const e=tgt && tgt\.kind==="edge"\? tgt\.obj : null;/);
  const move = between(I, 'cv.addEventListener("pointermove", ev=>{', "\n});");
  assert.match(move, /if\(connectDrag\|\|endDrag\) hoverNode=hitNode\(p\.x,p\.y\);\n\s*else \{ const t=hitTarget\(p\.x,p\.y\); hoverNode=hitSideArrowHost\(p\.x,p\.y\) \|\| \(t && t\.kind==="node"\? t\.obj : null\); \}/);
  assert.match(between(I, "function openEditorAt(p){", "\n}"), /const t=hitTarget\(p\.x,p\.y\), tgt=t && t\.obj;/);
});
test("Historias: un evento de conexión solo lo bloquea una HOJA (hitLeafNode), no un contenedor", () => {
  const es = read("js/editor-scenarios.js"), esB = atBase("js/editor-scenarios.js");
  assert.match(between(es, "function scFindDropTargets(", "\n}"), /if \(kind === "edge"\) \{\n\s*if \(hitLeafNode\(x, y\)\) return \[\];/);
  assert.match(between(es, "function scResolveDrop(", "\n}"), /if \(kind === "edge" && !hitLeafNode\(x, y\)\) \{/);
  assert.match(es, /if \(!hitLeafNode\(w\.x, w\.y\)\) ids = scEdgeCandidates\(w\.x, w\.y\)\.map\(\(e\) => e\.id\);/);
  assert.equal((es.match(/hitLeafNode\(/g) || []).length, 3);
  assert.equal(es.replace(/hitLeafNode\(/g, "hitNode("), esB, "editor-scenarios.js: solo esas tres llamadas cambian");
});
test("D7: releasePanelFocus es lo PRIMERO del pointerdown y closeEditBox quita el foco", () => {
  const down = between(I, 'cv.addEventListener("pointerdown", ev=>{', "\n});");
  assert.ok(/^cv\.addEventListener\("pointerdown", ev=>\{\n\s*releasePanelFocus\(\);\n/.test(down), "primera línea del manejador (ratón, dedo, cualquier modo)");
  const rf = between(I, "function releasePanelFocus(){", "\n}");
  assert.match(rf, /if\(!a \|\| a===editBox\) return;/);
  assert.match(rf, /if\(a\.tagName==="INPUT" \|\| a\.tagName==="TEXTAREA" \|\| a\.tagName==="SELECT"\) a\.blur\(\);/);
  assert.match(between(I, "function closeEditBox(label){", "\n}"), /editing=null; editBox\.style\.display="none"; editBox\.blur\(\);/);
  assert.match(I, /if\(ev\.target\.tagName==="TEXTAREA"\|\|ev\.target\.tagName==="INPUT"\) return;/, "la regla de los atajos no cambia");
});

/* ───────── alcance ───────── */
test("alcance: frente a d31703e solo cambian interaction.js, geometry.js (isContainerNode), editor-scenarios.js y sw.js (CACHE)", () => {
  /* FLUYO-019-HIT-TEST-D6 cambia a propósito render.js, export.js, geometry.js (containmentPaintOrder) y CACHE (v91):
     su alcance lo vigila test/fluyo-019-d6.test.cjs */
  for (const f of ["js/skin.js", "js/model.js", "js/ui.js", "js/config.js", "js/selection.js", "js/state.js", "js/viewer.js", "js/editor-runtime.js", "index.html", "s/index.html"])
    assert.equal(undoSemantics(f, undo4a(f, undo4b(f, read(f)))), atBase(f), f + " idéntico");
  const g = undoSemantics("js/geometry.js", undo4b("js/geometry.js", read("js/geometry.js"))), gB = atBase("js/geometry.js");
  const added = between(g, "/* FLUYO-019-HIT-TEST (D1)", "function isContainerNode(") + between(g, "function isContainerNode(", "\n}\n") + "\n}\n";
  const addedD6 = g.includes("function containmentPaintOrder(") ? between(g, "/* FLUYO-019-HIT-TEST-D6", "function containmentPaintOrder(") + between(g, "function containmentPaintOrder(", "\n}\n") + "\n}\n" : "";
  assert.equal(g.replace(added, "").replace(addedD6, ""), gB, "geometry.js: solo se añaden isContainerNode (y containmentPaintOrder, D6)");
  const sw = read("sw.js"), cur = +/const CACHE = "fluyo-static-v(\d+)";/.exec(sw)[1];
  assert.ok(cur >= 90, "CACHE ≥ v90");
  /* la de d31703e (v89) se construye sin literal: fluyo-019-1 vigila que ningún test fuera de las mutaciones nombre la anterior */
  assert.equal(sw.replace('"fluyo-static-v' + cur + '"', '"fluyo-static-v' + 89 + '"'), atBase("sw.js"), "sw.js: solo cambia CACHE");
  for (const f of ["js/interaction.js", "js/geometry.js", "js/editor-scenarios.js"]) assert.ok(sw.includes("./" + f), "servido: " + f);
});
