"use strict";
/* FLUYO-018.1 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de la creación de nodos y conexiones
   debe hacer fallar test/fluyo-018-1.test.cjs. Uso: node test/fluyo-018-1-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const MUTATIONS = [
  // ── dominio (model.js)
  ["M1 se permite el auto-lazo", "js/model.js",
    "  if(source===target && source!==undefined) throw projectDataError(\"self_loop\",\"target\");", ""],
  ["M2 se ignora source (from = target)", "js/model.js", "from:source, to:target,", "from:target, to:target,"],
  ["M3 se ignora target (to = source)", "js/model.js", "from:source, to:target,", "from:source, to:source,"],
  ["M4 se permiten ids duplicados", "js/model.js",
    "  if(structureIdInUse(pg,spec.id)) throw projectDataError(\"duplicate_structure_id\",\"id\");", ""],
  ["M5 crear un nodo crea un Behavior que nadie pidió", "js/model.js",
    "  pg.nodes.push(node);", "  pg.nodes.push(node); (pg.behaviors=pg.behaviors||[]).push({nodeId:id,initialState:\"DOWN\"});"],
  ["M6 la conexión nace con otra ruta por defecto", "js/model.js", "route:\"straight\", waypoints:[], label:\"\"", "route:\"ortho\", waypoints:[], label:\"\""],
  ["M7 la conexión nace con lados fijos (geometría mal calculada)", "js/model.js", "from:source, to:target, fromSide:null, toSide:null,", "from:source, to:target, fromSide:\"e\", toSide:\"w\","],
  ["M8 se omiten defaults de estilo del nodo", "js/model.js", "font:null, bold:false, pulse:false, order:pg.nodes.length },", "order:pg.nodes.length },"],
  ["M9 el dominio redondea coordenadas", "js/model.js", "  const node=authoringClone(n);", "  n.x=Math.round(n.x); const node=authoringClone(n);"],
  ["M10 el dominio aplica snap a rejilla", "js/model.js", "  const node=authoringClone(n);", "  n.x=Math.round(n.x/20)*20; const node=authoringClone(n);"],
  ["M11 el nodo se inserta en el documento equivocado", "js/model.js", "  pg.nodes.push(node);", "  doc.pages[doc.cur].nodes.push(node);"],
  ["M12 un id explícito no adelanta el contador", "js/model.js", "  else pg.nextId=Math.max(structuralNextId(pg),id+1);", "  else {}"],
  ["M13 la ref se persiste en el nodo", "js/model.js", ": {}), spec, [\"ref\",\"id\"]);", ": {}), spec, [\"id\"]);"],
  ["M14 la ref repetida se sobrescribe en silencio", "js/model.js", "context.refs.has(spec.ref)) throw", "false) throw"],
  ["M15 el nodo no se valida", "js/model.js", "  normalizeProjectItem(node); normalizeProjectNode(node,pg.nodes.length);", ""],
  ["M16 la conexión no se valida", "js/model.js", "  normalizeProjectItem(edge); normalizeProjectEdge(edge,DEFAULT_SETTINGS.dots);", ""],
  ["M17 el origen inexistente se acepta", "js/model.js", "  if(!pg.nodes.some(n=>n.id===source)) throw projectDataError(\"source_not_found\",\"source\");\n", ""],
  ["M18 el destino inexistente se acepta", "js/model.js", "  if(!pg.nodes.some(n=>n.id===target)) throw projectDataError(\"target_not_found\",\"target\");\n", ""],
  ["M19 el contador avanza aunque la conexión sea inválida", "js/model.js", "  normalizeProjectItem(edge);", "  pg.nextId++; normalizeProjectItem(edge);"],
  ["M20 BigInt/ciclos escapan como TypeError", "js/model.js", "catch(e){ throw projectDataError(); }   // BigInt", "catch(e){ throw e; }   // BigInt"],
  ["M21 se aceptan campos desconocidos", "js/model.js", "for(const key of Object.keys(spec)) if(!allowed.has(key)) throw projectDataError(\"invalid_document\",key);", ""],
  ["M22 un id referenciado por Behavior/Step se reutiliza", "js/model.js", "(pg.behaviors||[]).some(b=>b.nodeId===id) ||", "false ||"],
  ["M23 el nodo de código pierde sus campos propios", "js/model.js", "shape===\"code\"? {lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null} : {}", "{}"],
  ["M24 el icono nace con tint indefinido", "js/model.js", "if(shape===\"icon\" && !(\"tint\" in n)) n.tint=false;", ""],
  ["M25 el order del nodo no sigue la posición", "js/model.js", "order:pg.nodes.length },", "order:0 },"],
  ["M26 el dominio asocia un EventType a la conexión", "js/model.js", "endArrow:true, flowDir:\"normal\" },", "endArrow:true, flowDir:\"normal\", eventTypeId:1 },"],
  // ── el editor consume el dominio
  ["E1 newEdge ya no traduce el auto-lazo a null", "js/state.js", "if(err && err.code===\"self_loop\") return null; throw err;", "throw err;"],
  ["E2 newNode ya no aplica el snap del editor", "js/state.js", "x:snapV(x), y:snapV(y)", "x, y"],
  ["E3 newNode inserta fuera de la página activa", "js/state.js", "createNodeIn(P(),", "createNodeIn(doc.pages[0].nodes.length>999?P():{nodes:[],edges:[],nextId:1},"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-1.test.cjs", "test/scenario-post-qa.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 120000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-1-mut-"));
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
console.log(failed ? "\nFLUYO-018.1 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.1 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
