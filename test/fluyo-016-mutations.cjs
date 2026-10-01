"use strict";
/* FLUYO-016 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible
   debe hacer fallar test/fluyo-016.test.cjs. Uso: node test/fluyo-016-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const MUTATIONS = [
  ["M1 compartir siempre scenarios[0]", "js/share-url.js",
    "(current.scenarios||[]).find(s=>s.id===id)", "(current.scenarios||[])[0]"],
  ["M2 mezclar Steps entre Historias (copia superficial)", "js/model.js",
    "const copy=JSON.parse(JSON.stringify(pg.scenarios[index]));", "const copy=Object.assign({},pg.scenarios[index]);"],
  ["M3 cambiar de Historia sin resetear Playback", "js/editor-scenarios.js",
    "function scSwitchScenario(id) {\n  if (isScenarioPlaybackActive()) scReset();\n", "function scSwitchScenario(id) {\n"],
  ["M4 duplicar compartiendo IDs", "js/model.js",
    'copy.id=reserveProjectIds(pg,"nextScenarioId",1,minimum);', "copy.id=pg.scenarios[index].id;"],
  ["M5 eliminar una Historia incorrecta", "js/editor-scenarios.js",
    "deleteScenario(pg, sc.id);", "deleteScenario(pg, pg.scenarios[pg.scenarios.length - 1].id);"],
  ["M6 Share incluyendo Historias no seleccionadas", "js/share-url.js",
    "  for(const page of normalized.doc.pages) page.scenarios=[];\n  if(selected) current.scenarios=[selected];",
    "  if(selected) current.scenarios=[selected, ...current.scenarios.filter(s=>s!==selected)];"],
  ["M7 Share sin vaciar las demás páginas", "js/share-url.js",
    "for(const page of normalized.doc.pages) page.scenarios=[];\n  if(selected)", "if(current) current.scenarios=[];\n  if(selected)"],
  ["M8 Viewer reproduce la última Historia en vez de scenarios[0]", "js/viewer.js",
    "sc=pg && pg.scenarios && pg.scenarios[0];", "sc=pg && pg.scenarios && pg.scenarios[pg.scenarios.length-1];"],
  ["M9 active Story persistida en el documento", "js/editor-scenarios.js",
    "  scActiveId = id;\n  scLastPage = P();", "  scActiveId = id; if (P()) P().activeScenarioId = id;\n  scLastPage = P();"],
  ["M10 cambio de página conserva la Historia de la otra página", "js/editor-scenarios.js",
    "  scLastPage = pg;\n  if (first) return;\n  scActiveId = null;", "  scLastPage = pg;\n  if (first) return;"],
  ["M11 duplicar no selecciona la copia", "js/editor-scenarios.js",
    "scSelectStory(copy.id);", "scSelectStory(src.id);"],
  ["M12 duplicar sin Undo", "js/editor-scenarios.js",
    "  const copy = duplicateScenario(pg, src.id);", "  undoStack.pop(); const copy = duplicateScenario(pg, src.id);"],
  ["M13 tras eliminar, la selección apunta a una Historia inexistente", "js/editor-scenarios.js",
    "scSelectStory(next ? next.id : null);", "scSelectStory(sc.id);"],
  ["M14 el editor comparte siempre el documento completo", "js/editor-share.js",
    'story?{kind,scenarioId:story.id}:{kind:"diagram"}', "undefined"],
  ["M15 cambiar de Historia hereda el Step seleccionado", "js/editor-scenarios.js",
    "  scSelectedStep = null;\n  scContext = null;\n  scStorySignature = \"\";\n  scErrors = [];\n}", "  scStorySignature = \"\";\n  scErrors = [];\n}"],
  ["M16 nueva Historia no se puede deshacer", "js/editor-scenarios.js",
    "  pushUndo();\n  const sc = createScenario(pg, defaultScenarioName(pg));", "  const sc = createScenario(pg, defaultScenarioName(pg));"],
  ["M17 Run ignora la Historia activa (siempre la primera)", "js/editor-scenarios.js",
    "const started = FluyoStory.start(P(), sc, performance.now());", "const started = FluyoStory.start(P(), P().scenarios[0], performance.now());"],
  ["M18 duplicar con Playback activo no lo detiene", "js/editor-scenarios.js",
    "  if (!src) return;\n  if (isScenarioPlaybackActive()) scReset();", "  if (!src) return;"],
  ["M19 Undo de Duplicar/Nueva salta a la primera Historia (sin recordar la anterior)", "js/editor-scenarios.js",
    "  return prev || pg.scenarios[0] || null;", "  return pg.scenarios[0] || null;"],
  ["M20 eliminar la última Historia falla", "js/editor-scenarios.js",
    "  const index = pg.scenarios.findIndex((s) => s.id === sc.id);\n  pushUndo();", "  if (pg.scenarios.length === 1) return;\n  const index = pg.scenarios.findIndex((s) => s.id === sc.id);\n  pushUndo();"],
  ["M21 una Historia vacía se puede reproducir", "js/editor-scenarios.js",
    "if (!sc || !sc.steps.length) return;", "if (!sc) return;"],
  ["M22 cambiar de página no detiene el Playback", "js/editor-scenarios.js",
    "  scStorySignature = \"\";\n  if (isScenarioPlaybackActive()) scReset();\n  if (scUiReady) {", "  scStorySignature = \"\";\n  if (scUiReady) {"],
  ["M23 Redo no rehace nada (Redo de eliminación roto)", "js/selection.js",
    "applySnap(redoStack.pop());", "redoStack.pop();"],
  ["M24 jerga «Scenario» visible en el diálogo de Evento", "index.html",
    "No afecta al tiempo de la historia.", "No afecta al tiempo del Scenario."],
  ["M25 el botón ⋯ ya no es interruptor", "js/editor-scenarios.js",
    "function scMenu(anchor, items) {\n  if (scMenuToggledOff(anchor)) return;\n", "function scMenu(anchor, items) {\n"],
  ["M26 «Reproducir» nunca queda disabled", "js/editor-scenarios.js",
    "run.disabled = !s || !s.steps.length || s.engineVersion !== FluyoScenarios.ENGINE_VERSION;", "run.disabled = false;"],
  ["M27 Share ya no se bloquea durante Playback", "js/editor-share.js",
    'if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){', "if(false){"],
  ["M28 vuelve «Detalles técnicos»", "js/editor-scenarios.js",
    ': "Detalles";', ': "Detalles técnicos";'],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-016.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 90000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-016-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK");
  MUTATIONS.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, (text.replace(from, to)).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " tests fallan)" : ""));
    if (!killed) failed++;
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? "\nFLUYO-016 mutaciones: " + failed + " sin detectar" : "\nFLUYO-016 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
