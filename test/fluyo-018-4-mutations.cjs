"use strict";
/* FLUYO-018.4 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de la política de borrado del editor
   (confirmación, Undo, Behavior, impacto, mensaje) debe hacer fallar test/fluyo-018-4.test.cjs. Uso: node test/fluyo-018-4-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const AUTH = "js/story-authoring.js", MODEL = "js/model.js", STATE = "js/state.js", SEL = "js/selection.js";

const MUTATIONS = [
  ["M1 se confirma siempre, aunque no haya impacto", SEL, "if(impact.stories.length && !confirm(", "if(!confirm("],
  ["M2 nunca se confirma", SEL, "if(impact.stories.length && !confirm(", "if(false && !confirm("],
  ["M3 cancelar borra igualmente", SEL, "if(impact.stories.length && !confirm(deleteConfirmMessage(impact, nodeIds.length, edgeIds.length))) return;", "if(impact.stories.length) confirm(deleteConfirmMessage(impact, nodeIds.length, edgeIds.length));"],
  ["M4 pushUndo antes del diálogo (cancelar deja entrada de Undo)", SEL, "  const impact=deleteImpact(nodeIds, edgeIds);", "  pushUndo(); const impact=deleteImpact(nodeIds, edgeIds);"],
  ["M5 un diálogo por elemento seleccionado", SEL, "  removeNodes(nodeIds);", "  removeNodes(nodeIds); if(impact.stories.length) confirm('otra');"],
  ["M6 el impacto ignora las conexiones elegidas", SEL, "FluyoIntegrity.removalImpact(slim, {pageIndex:0, nodeIds, edgeIds})", "FluyoIntegrity.removalImpact(slim, {pageIndex:0, nodeIds, edgeIds:[]})"],
  ["M7 el impacto ignora los nodos elegidos", SEL, "FluyoIntegrity.removalImpact(slim, {pageIndex:0, nodeIds, edgeIds})", "FluyoIntegrity.removalImpact(slim, {pageIndex:0, nodeIds:[], edgeIds})"],
  ["M8 el editor deja el Behavior huérfano (keepBehaviors)", STATE, "deleteNodeIn(P(), id)", "deleteNodeIn(P(), id, {keepBehaviors:true})"],
  ["M9 el mensaje omite la condición de disponibilidad", SEL, "if(impact.behaviors.length) lines.push(", "if(false) lines.push("],
  ["M10 el mensaje no nombra los momentos", SEL, "lines.push(\"• \"+s.name+\" — \"+s.moments+(s.moments===1?\" momento\":\" momentos\")+(shown?\" (\"+shown+\")\":\"\"));", "lines.push(\"• \"+s.name);"],
  ["M11 el mensaje nombra todas las Historias de la página", SEL, "const stories=r.affectedStories.map(", "const stories=pg.scenarios.map(sc=>({storyId:sc.id,storyName:sc.name,stepIds:sc.steps.map(x=>x.id)})).map("],
  ["M12 limpieza silenciosa: se borran los Steps afectados", SEL, "  removeNodes(nodeIds);", "  removeNodes(nodeIds); for(const sc of P().scenarios) sc.steps=sc.steps.filter(st=>st.edgeId ? edgeById(st.edgeId) : nodeById(st.nodeId));"],
  ["M13 el snapshot de Undo no guarda los Behaviors", SEL, "function snapPage(){ return {pi:doc.cur, data:deep(P())}; }", "function snapPage(){ const d=deep(P()); d.behaviors=[]; return {pi:doc.cur, data:d}; }"],
  ["M14 el editor no carga FluyoIntegrity", "index.html", "<script src=\"js/document-integrity.js\"></script>", "<!-- sin integridad -->"],
  ["M16 deleteSel no respeta el Playback", SEL, "if(editorFrozen() || (!selN.size && !selE.size)) return;", "if(!selN.size && !selE.size) return;"],
  ["M17 cutSel copia y corta durante el Playback", SEL, "function cutSel(){ if(editorFrozen()) return; copySel(); deleteSel(); }", "function cutSel(){ copySel(); deleteSel(); }"],
  ["M18 la guarda de Playback solo cubre «en marcha» (no «completed»)", SEL, "function editorFrozen(){ return typeof isScenarioPlaybackActive===\"function\" && isScenarioPlaybackActive(); }", "function editorFrozen(){ return typeof scStatus!==\"undefined\" && scStatus===\"running\"; }"],
  ["M15 el service worker no precachea document-integrity.js", "sw.js", "\"./js/document-integrity.js\",", "\"./js/ui.js\","],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-4.test.cjs", "test/fluyo-018-3.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 180000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-4-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + MUTATIONS.length + " mutaciones aplicadas)");
  MUTATIONS.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, (text.replace(from, () => to)).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " tests fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? "\nFLUYO-018.4 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.4 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
