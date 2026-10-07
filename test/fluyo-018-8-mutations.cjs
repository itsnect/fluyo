"use strict";
/* FLUYO-018.8 — Mutaciones sobre COPIAS aisladas: cada defecto plausible de «Añadir como página» (importPagesIn en model.js,
   appendPagesFrom en state.js) debe hacer fallar las suites. Uso: node test/fluyo-018-8-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const MODEL = "js/model.js", STATE = "js/state.js";

const MUTATIONS = [
  ["I1 appendPagesFrom vuelve a enganchar solo las páginas (el bug de producción)", STATE,
    "    const {pageIndex}=importPagesIn(doc, nd);\n", "    const pageIndex=doc.pages.length; doc.pages.push(...nd.pages);\n"],
  ["I2 no se vacía el historial tras importar", STATE, "    undoStack.length=0; redoStack.length=0;\n    clearSel();", "    clearSel();"],
  ["I3 solo se vacía Undo (Redo sobrevive)", STATE, "    undoStack.length=0; redoStack.length=0;\n    clearSel();", "    undoStack.length=0;\n    clearSel();"],
  ["I4 solo se vacía Redo (Undo sobrevive)", STATE, "    undoStack.length=0; redoStack.length=0;\n    clearSel();", "    redoStack.length=0;\n    clearSel();"],
  ["I5 no se activa la primera página añadida", STATE, "    doc.cur=pageIndex;\n", ""],
  ["I6 el editor importa el proyecto crudo (sin normalizar)", STATE, "importPagesIn(doc, nd)", "importPagesIn(doc, d)"],
  ["I7 el editor copia además el tema del entrante", STATE, "    doc.cur=pageIndex;\n", "    doc.cur=pageIndex; doc.theme=nd.theme; doc.customBg=nd.customBg;\n"],
  ["I8 se conservan los ids de origen (sin remapeo)", MODEL, "eventTypes.forEach((et,k)=>map.set(et.id, first+k));", "eventTypes.forEach((et,k)=>map.set(et.id, et.id));"],
  ["I9 solo se remapean los ids que colisionan", MODEL, "eventTypes.forEach((et,k)=>map.set(et.id, first+k));", "eventTypes.forEach((et,k)=>map.set(et.id, d.eventTypes.some(o=>o.id===et.id)? first+k : et.id));"],
  ["I10 los Steps importados no se reescriben", MODEL,
    "      if(st.eventTypeId!==undefined) st.eventTypeId=map.has(st.eventTypeId)? map.get(st.eventTypeId) : unresolved.get(st.eventTypeId);", "      ;"],
  ["I11 se reutiliza un EventType del receptor con el mismo nombre y primitiva", MODEL,
    "eventTypes.forEach((et,k)=>map.set(et.id, first+k));", "eventTypes.forEach((et,k)=>{ const o=d.eventTypes.find(x=>x.name===et.name && x.primitive===et.primitive); map.set(et.id, o? o.id : first+k); });"],
  ["I12 solo se importan los EventTypes usados", MODEL, "const pages=deep(incoming.pages), eventTypes=deep(incoming.eventTypes);",
    "const pages=deep(incoming.pages), eventTypes=deep(incoming.eventTypes).filter(et=>incoming.pages.some(pg=>(pg.scenarios||[]).some(sc=>sc.steps.some(st=>st.eventTypeId===et.id))));"],
  ["I13 el contador de EventTypes no avanza", MODEL, "    d.nextEventTypeId=first+count;\n", ""],
  ["I14 un Step colgante se resuelve contra el receptor (id original)", MODEL, "dangling.forEach((id,k)=>unresolved.set(id, first+eventTypes.length+k));", "dangling.forEach((id,k)=>unresolved.set(id, id));"],
  ["I15 los ids colgantes no se reservan en el contador", MODEL, "const count=eventTypes.length+dangling.length;", "const count=eventTypes.length;"],
  ["I16 un Step colgante se «repara» apuntando al primer importado", MODEL, ": unresolved.get(st.eventTypeId);", ": first;"],
  ["I17 se conservan referencias al documento entrante (sin copia)", MODEL, "const pages=deep(incoming.pages), eventTypes=deep(incoming.eventTypes);", "const pages=incoming.pages, eventTypes=incoming.eventTypes;"],
  ["I18 la biblioteca importada se antepone a la del receptor", MODEL, "  d.eventTypes.push(...eventTypes);\n", "  d.eventTypes.unshift(...eventTypes);\n"],
  ["I19 el dominio cambia la página activa", MODEL, "  d.pages.push(...pages);\n  return {pageIndex, pages,", "  d.pages.push(...pages); d.cur=pageIndex;\n  return {pageIndex, pages,"],
  ["I20 no es todo o nada: las páginas entran antes de reservar ids", MODEL,
    [["  const map=new Map(), unresolved=new Map();", "  d.pages.push(...pages); const map=new Map(), unresolved=new Map();"], ["  d.pages.push(...pages);\n  return {pageIndex", "  return {pageIndex"]]],
  ["I21 el mismo documento (o una página ya presente) se acepta como entrante", MODEL, "  if(incoming.pages.some(pg=>d.pages.includes(pg))) throw projectDataError(\"invalid_document\",\"page\");\n", ""],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
const SUITES = ["test/fluyo-018-8.test.cjs", "test/fluyo-018-7d.test.cjs", "test/fluyo-018-7c.test.cjs", "test/analytics.test.cjs"];
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-8-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + MUTATIONS.length + " mutaciones aplicadas)");
  MUTATIONS.forEach((m, i) => {
    const name = m[0], edits = Array.isArray(m[2]) ? m[2].map(([from, to]) => [m[1], from, to]) : [[m[1], m[2], m[3]]];
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
