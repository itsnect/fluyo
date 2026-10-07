"use strict";
/* FLUYO-018.7d — Mutaciones sobre COPIAS aisladas: cada defecto plausible de la biblioteca de EventTypes dentro de Undo/Redo (libSnap,
   restoreLibrary, stepHistory) debe hacer fallar las suites de 018.7d/018.7c. Uso: node test/fluyo-018-7d-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const SEL = "js/selection.js";

const MUTATIONS = [
  ["L1 stepHistory no restaura la biblioteca", SEL, "    if(s.lib) restoreLibrary(s.lib);\n", ""],
  ["L2 la inversa no lleva la biblioteca (Redo no la rehace)", SEL, "    inverse.lib=lib;\n", ""],
  ["L3 las fotos de página no capturan la biblioteca", SEL, "data:deep(pg), lib:libSnap()}", "data:deep(pg)}"],
  ["L4 la entrada de borrado de página no lleva biblioteca", SEL, "pushUndoSnapshot({kind:\"insertPage\", page, index, curPage, lib});", "pushUndoSnapshot({kind:\"insertPage\", page, index, curPage});"],
  ["L5 se restauran copias nuevas (se pierde la identidad de los EventTypes)", SEL, "  lib.objs.forEach((et,i)=>{ for(const k of Object.keys(et)) delete et[k]; Object.assign(et, deep(lib.data[i])); });\n  doc.eventTypes=lib.objs.slice();", "  doc.eventTypes=deep(lib.data);"],
  ["L6 el contador de EventTypes baja al deshacer", SEL, "doc.nextEventTypeId=Math.max(doc.nextEventTypeId||0, lib.nextEventTypeId);", "doc.nextEventTypeId=lib.nextEventTypeId;"],
  ["L7 la inversa captura la biblioteca DESPUÉS de restaurar", SEL, "    inverse.lib=lib;", "    inverse.lib=libSnap();"],
  ["L8 restaurar no quita las claves que sobran", SEL, "for(const k of Object.keys(et)) delete et[k]; ", ""],
  ["L9 la foto de la biblioteca no es profunda", SEL, "data:deep(doc.eventTypes)", "data:doc.eventTypes"],
  ["L10 restaurar no repone EventTypes eliminados (solo el contenido de los presentes)", SEL, "  doc.eventTypes=lib.objs.slice();\n", ""],
  ["L11 la biblioteca se restaura aunque la entrada ya no aplique", SEL, "    if(!inverse) continue;\n    if(s.lib) restoreLibrary(s.lib);", "    if(s.lib) restoreLibrary(s.lib);\n    if(!inverse) continue;"],
  ["L12 la foto de la biblioteca reutiliza el array del documento", SEL, "{objs:doc.eventTypes.slice(),", "{objs:doc.eventTypes,"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
const SUITES = ["test/fluyo-018-7d.test.cjs", "test/fluyo-018-7c.test.cjs", "test/fluyo-018-7c-domain.test.cjs", "test/fluyo-018-7a-f1.test.cjs", "test/fluyo-018-7a.test.cjs"];
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", ...SUITES], { cwd: dir, encoding: "utf8", timeout: 300000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
function applyEdits(dir, edits) {
  for (const [file, from, to] of edits) {
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) return false;
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
  }
  return true;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-7d-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + MUTATIONS.length + " mutaciones aplicadas)");
  MUTATIONS.forEach((m, i) => {
    const name = m[0], edits = Array.isArray(m[1]) ? m[1] : [[m[1], m[2], m[3]]];
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    if (!applyEdits(dir, edits)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; fs.rmSync(dir, { recursive: true, force: true }); return; }
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
console.log(failed ? "\n" + failed + " mutación(es) sin detectar" : "\nTodas las mutaciones (" + MUTATIONS.length + ") detectadas.");
process.exit(failed ? 1 : 0);
