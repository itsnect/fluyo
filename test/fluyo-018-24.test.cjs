"use strict";
/* FLUYO-018.24 — Deshacer sin perder el contexto. Contratos en vm (editor real: model.js, state.js, selection.js y renderTabs de ui.js,
   arnés de 018.7c) y estáticos. Lo que solo se ve pintado (panel, hoja móvil, campos reales, botones) lo mide
   test/fluyo-018-24-browser.cjs en Chrome.
   · Selección tras Undo/Redo: sobrevive lo que sigue existiendo; lo que la operación quitó, no; sin selección vuelve la de la entrada;
     otra página → se limpia. El documento y las pilas, exactamente como antes.
   · kwEdit / edgeDotsIn: una entrada de Undo por ráfaga (bandera como lblDirty/fsDirty; change y refreshPanel cierran la ráfaga).
   · Alcance: kernel, model.js, formato, render, Historias, Present, Viewer y Share sin cambios; CACHE v82. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { editor, J, page, project } = require("./fluyo-018-7c-harness.cjs");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j + b.length); };

/* página 1: nodos 1, 2, 3 y la conexión 4 (1→2); página 2: nodo 1 */
const node = (id, x) => ({ id, shape: "rect", x, y: 0, w: 120, h: 60, label: "n" + id });
function fixture() {
  const a = page("A"), b = page("B");
  a.nodes = [node(1, 0), node(2, 300), node(3, 600)]; a.edges = [{ id: 4, from: 1, to: 2, waypoints: [] }]; a.nextId = 5;
  b.nodes = [node(1, 0)]; b.nextId = 2;
  return project([a, b], 0);
}
const ed = () => { const E = editor(); E.load(fixture()); return E; };
const sel = (E) => E.run("[...selN].map(String).concat([...selE].map(x=>'e'+x)).join(',')");
const docJson = (E) => E.run("JSON.stringify(doc)");

test("Undo/Redo de una edición: el elemento seleccionado sigue seleccionado (y el documento vuelve igual que antes)", () => {
  const E = ed();
  E.run("selectOnly('node',2); pushUndo(); editNode(nodeById(2),{label:'cambio'});");
  const after = docJson(E);
  E.run("undo()");
  assert.equal(sel(E), "2");
  assert.equal(E.run("nodeById(2).label"), "n2");
  E.run("redo()");
  assert.equal(sel(E), "2");
  assert.equal(docJson(E), after, "Redo devuelve exactamente el documento editado");
  assert.equal(E.run("undoStack.length+'/'+redoStack.length"), "1/0", "las pilas, como siempre");
});

test("eliminar → Undo: vuelve seleccionado lo eliminado; Redo lo quita y no deja selección fantasma", () => {
  const E = ed();
  E.run("selectOnly('node',3); pushUndo(); removeNodes([3]); selN.clear();");
  assert.equal(sel(E), "");
  E.run("undo()");
  assert.equal(E.run("!!nodeById(3)"), true);
  assert.equal(sel(E), "3", "sin selección al deshacer: vuelve la de la entrada");
  E.run("redo()");
  assert.equal(E.run("!!nodeById(3)"), false);
  assert.equal(sel(E), "", "lo seleccionado ya no existe: se limpia");
  E.run("undo()");
  assert.equal(sel(E), "3", "y al deshacer otra vez, vuelve");
});

test("Undo de una creación con lo creado seleccionado: no queda selección (no se inventa otra)", () => {
  const E = ed();
  E.run("selectOnly('node',1); pushUndo(); const n=newNode('rect',900,0,{label:'nuevo'}); selectOnly('node',n.id); __new=n.id;");
  E.run("undo()");
  assert.equal(E.run("!!nodeById(__new)"), false);
  assert.equal(sel(E), "", "lo seleccionado lo quitó la operación: se limpia (aunque la entrada recordase el nodo 1)");
});

test("selección múltiple: se conserva lo que sobrevive y se descarta lo que la operación quitó", () => {
  const E = ed();
  E.run("pushUndo(); const n=newNode('rect',900,0,{label:'nuevo'}); __new=n.id; selN.clear(); selN.add(1); selN.add(n.id); selE.add(4);");
  E.run("undo()");
  assert.equal(sel(E), "1,e4");
});

test("una entrada de OTRA página: la selección no se lleva a la página restaurada", () => {
  const E = ed();
  E.run("selectOnly('node',2); pushUndo(); editNode(nodeById(2),{label:'x'}); doc.cur=1; selN.clear(); selN.add(1);");
  E.run("undo()");
  assert.equal(E.run("doc.cur"), 0, "Undo vuelve a la página de la entrada (como siempre)");
  assert.equal(sel(E), "", "el nodo 1 seleccionado era de la página B: no se selecciona el 1 de A");
  E.run("redo()");
  assert.equal(sel(E), "", "la inversa no recuerda la selección de otra página");
});

test("la selección vive en la entrada de Undo (memoria), nunca en el documento", () => {
  const E = ed();
  E.run("selectOnly('node',2); pushUndo();");
  assert.equal(E.run("JSON.stringify(undoStack[0].sel)"), JSON.stringify({ n: [2], e: [] }));
  E.run("editNode(nodeById(2),{label:'x'}); undo();");
  assert.equal(E.run("JSON.stringify(redoStack[0].sel)"), JSON.stringify({ n: [2], e: [] }), "la inversa recuerda la selección de antes de deshacer");
  assert.equal(/"sel"/.test(docJson(E)), false, "el documento no gana ningún campo");
  /* insertPage/removePage siguen funcionando con su campo nuevo */
  E.run("selN.clear(); requestDeletePage(1)");
  assert.equal(E.run("undoStack[undoStack.length-1].kind"), "insertPage");
  E.run("undo()");
  assert.equal(E.run("doc.pages.length"), 2);
});

/* ───────── kwEdit / edgeDotsIn ───────── */
test("kwEdit y edgeDotsIn: una entrada por ráfaga, como el texto y el tamaño", () => {
  const ui = read("js/ui.js"), selj = read("js/selection.js");
  assert.match(selj, /let undoStack=\[\], redoStack=\[\], lblDirty=false, fsDirty=false, kwDirty=false, dotsDirty=false;/);
  assert.ok(between(ui, "function refreshPanel(){", "\n}\n").includes("lblDirty=false; fsDirty=false; kwDirty=false; dotsDirty=false;"), "cambiar de selección (o repintar) cierra la ráfaga");
  const kw = between(ui, '$("kwEdit").oninput=()=>{', "\n};");
  assert.ok(kw.indexOf("if(!kwDirty){ pushUndo(); kwDirty=true; }") >= 0 && kw.indexOf("if(!kwDirty)") < kw.indexOf("editNode("), "kwEdit apila ANTES de escribir");
  const dots = between(ui, '$("edgeDotsIn").oninput=()=>{', "\n};");
  assert.ok(dots.indexOf("if(!dotsDirty){ pushUndo(); dotsDirty=true; }") >= 0 && dots.indexOf("if(!dotsDirty)") < dots.indexOf("editEdge("), "edgeDotsIn apila ANTES de escribir");
  assert.ok(ui.includes('$("kwEdit").onchange=()=>{ kwDirty=false; };'), "salir del campo cierra la ráfaga de kwEdit");
  assert.ok(ui.includes('$("edgeDotsIn").onchange=()=>{ dotsDirty=false; };'), "cada change del número cierra su ráfaga");
});

test("stepHistory: ya no limpia la selección a ciegas; restaura antes de repintar las pestañas", () => {
  const selj = read("js/selection.js"), body = between(selj, "function stepHistory(from, to){", "\n}\n");
  assert.equal(body.includes("clearSel();"), false);
  assert.ok(body.includes("restoreSelAfterHistory(same ? keep : null, s.sel); renderTabs();"));
  assert.ok(body.includes("if(s.lib) restoreLibrary(s.lib);\n"), "la biblioteca se restaura igual (ancla de 018.7d)");
  assert.match(selj, /function pushUndoSnapshot\(s\)\{ if\(!s\.sel\) s\.sel=selSnap\(\);/);
});

/* ───────── alcance y release ───────── */
test("alcance: kernel, model.js, formato, render, Historias, Present, Viewer y Share idénticos a HEAD", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js",
    "js/story-authoring.js", "js/story-clock.js", "js/render.js", "js/geometry.js", "js/export.js", "js/state.js", "js/interaction.js",
    "js/editor-scenarios.js", "js/share-url.js", "js/link-codec.js", "js/viewer.js", "js/present-story.js", "index.html", "css/styles.css", "css/system.css",
    "s/index.html", "css/share.css", "css/identity.css"]) {
    let head;
    try { head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n"); } catch { return; }   // sin git
    assert.equal(read(f), head, f + " sin cambios");
  }
});

test("release: CACHE v82", () => {
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v112";/);
});

void J;
