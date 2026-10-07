"use strict";
/* FLUYO-018.2 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de create_node / create_connection
   en FluyoAuthoring (js/story-authoring.js) o en la autoridad de dominio (js/model.js) debe hacer fallar
   test/fluyo-018-2.test.cjs (o las suites previas que fijan el contrato). Uso: node test/fluyo-018-2-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const AUTH = "js/story-authoring.js", MODEL = "js/model.js";

const MUTATIONS = [
  ["A1 la ref se ignora (no se registra para el lote)", AUTH, "    if(op.ref===undefined) return Object.assign({}, spec);\n", "    if(true) return Object.assign({}, spec);\n"],
  ["A2 la ref no se devuelve en refs", AUTH, "if(op.ref!==undefined) ctx.created.push(", "if(false) ctx.created.push("],
  ["A3 las refs no se acotan por página (se leen de la página 0)", AUTH, "ctx.diagramRefs[kind].get(pageIndex);", "ctx.diagramRefs[kind].get(0);"],
  ["A3b ... y se registran en la página 0", AUTH, "ctx.diagramRefs[kind].set(pageIndex, byPage);", "ctx.diagramRefs[kind].set(0, byPage);"],
  ["A4 una ref creada antes en el lote no se resuelve", AUTH, "const id = pageRefs(ctx, kind, op.pageIndex).get(v.ref);", "const id = undefined;"],
  ["A5 la ref se resuelve en el mapa de conexiones", AUTH, "const id = pageRefs(ctx, kind, op.pageIndex).get(v.ref);", "const id = pageRefs(ctx, \"edges\", op.pageIndex).get(v.ref);"],
  ["A6 create_connection no usa createConnectionIn (la crea a mano)", AUTH,
    "try{ e = createConnectionIn(pg, spec, {refs:pageRefs(ctx, \"edges\", op.pageIndex)}); }",
    "try{ e = {id:reserveStructureIds(pg), from:spec.source, to:spec.target, fromSide:null, toSide:null, route:\"straight\", waypoints:[], label:\"\", font:null, bold:false, animated:true, dashed:false, startArrow:false, endArrow:true, flowDir:\"normal\"}; pg.edges.push(e); }"],
  ["A7 create_node no usa createNodeIn (lo crea a mano)", AUTH,
    "try{ n = createNodeIn(pg, spec, {refs:pageRefs(ctx, \"nodes\", op.pageIndex)}); }",
    "try{ n = {id:reserveStructureIds(pg), shape:spec.shape, x:spec.x, y:spec.y, w:160, h:70, label:spec.label||\"\"}; pg.nodes.push(n); }"],
  ["A8 un error a mitad del lote devuelve el documento a medias (sin rollback)", AUTH,
    "if(e && e.authoring) return failure([Object.assign({code:e.code, message:e.message, operationIndex:i, operation:isRecord(op)?op.op:undefined}, e.extra)]);",
    "if(e && e.authoring) return {ok:true, project:projectToSerializable(d, norm.settings), changes, refs:ctx.created, touched:[...ctx.touched.values()], validation:{valid:true, preexistingErrors:0}};"],
  ["A9 el error del dominio pierde su código (se devuelve tal cual)", AUTH, "if(!(e && typeof e.code===\"string\" && !e.authoring && DIAGRAM_ERRORS[e.code])) return e;", "return e;"],
  ["A10 el auto-lazo se traduce a otro código", AUTH, "self_loop:\"SELF_LOOP\"", "self_loop:\"INVALID_FIELD\""],
  ["A11 SOURCE_NOT_FOUND se traduce a TARGET_NOT_FOUND", AUTH, "source_not_found:\"SOURCE_NOT_FOUND\"", "source_not_found:\"TARGET_NOT_FOUND\""],
  ["A12 spec admite ref/source/target (se mezclarían con los de la operación)", AUTH,
    "for(const k of op.op===\"create_node\" ? [\"ref\"] : [\"ref\",\"source\",\"target\"])", "for(const k of [])"],
  ["A13 un campo desconocido de la operación se acepta", AUTH, "create_node:[\"spec\",\"ref\"],", "create_node:[\"spec\",\"ref\",\"extra\"],"],
  ["A14 el alcance de create_node se declara «story»", AUTH, "create_node:\"page\", create_connection:\"page\",", "create_node:\"story\", create_connection:\"page\","],
  ["A15 un extremo puede traer {ref} e {id} a la vez", AUTH, "if((v.ref!==undefined) === (v.id!==undefined)) throw", "if(false) throw"],
  ["A16 el extremo {id} no se valida como entero", AUTH, "if(!isId(v.id)) throw reject(\"INVALID_OPERATION\", `${field}.id debe ser un entero ≥ 1.`", "if(false) throw reject(\"INVALID_OPERATION\", `${field}.id debe ser un entero ≥ 1.`"],
  ["A17 los refs devueltos omiten la página", AUTH, "ctx.created.push({ref:op.ref, type, pageIndex:op.pageIndex, id:rec.id})", "ctx.created.push({ref:op.ref, type, id:rec.id})"],
  ["A18 el cambio de un nodo no dice qué ref creó", AUTH, "Object.assign({entityKind:\"node\", entityId:n.id, created:true}, op.ref!==undefined ? {ref:op.ref} : {},", "Object.assign({entityKind:\"node\", entityId:n.id, created:true}, {},"],
  ["A19 la geometría de la conexión se decide aquí (lados fijos)", AUTH, "const spec = Object.assign(withRef(op, op.spec===undefined ? {} : diagramSpec(op)), {source, target});", "const spec = Object.assign({fromSide:\"e\", toSide:\"w\"}, withRef(op, op.spec===undefined ? {} : diagramSpec(op)), {source, target});"],
  // ── dominio
  ["D1 se permite el auto-lazo", MODEL, "  if(source===target && source!==undefined) throw projectDataError(\"self_loop\",\"target\");", ""],
  ["D2 se permiten ids duplicados", MODEL, "  if(structureIdInUse(pg,spec.id)) throw projectDataError(\"duplicate_structure_id\",\"id\");", ""],
  ["D3 la ref repetida se sobrescribe en silencio", MODEL, "context.refs.has(spec.ref)) throw", "false) throw"],
  ["D4 el origen inexistente se acepta", MODEL, "  if(!pg.nodes.some(n=>n.id===source)) throw projectDataError(\"source_not_found\",\"source\");\n", ""],
  ["D5 el destino inexistente se acepta", MODEL, "  if(!pg.nodes.some(n=>n.id===target)) throw projectDataError(\"target_not_found\",\"target\");\n", ""],
  ["D6 la ref se persiste en el nodo", MODEL, ": {}), spec, [\"ref\",\"id\"]);", ": {}), spec, [\"id\"]);"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-2.test.cjs", "test/fluyo-018-1.test.cjs", "test/fluyo-017-2.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 180000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-2-mut-"));
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
console.log(failed ? "\nFLUYO-018.2 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.2 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
