"use strict";
/* FLUYO-018.3 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de update_node / update_connection /
   delete_node / delete_connection (FluyoAuthoring, model.js, envoltorios del editor) debe hacer fallar test/fluyo-018-3.test.cjs
   (o las suites previas que fijan el contrato). Uso: node test/fluyo-018-3-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const AUTH = "js/story-authoring.js", MODEL = "js/model.js", STATE = "js/state.js", SEL = "js/selection.js";

const MUTATIONS = [
  // ── B2 y validación final
  ["B1 B2 saltado: se devuelve el documento aunque deje una Historia inválida", AUTH, "if(regress.length) return failure(explainRemovals(ctx, regress, d));", "if(false) return failure(explainRemovals(ctx, regress, d));"],
  ["B2 se salta la validación del estado final (no hay errores nuevos)", AUTH, "const regress = after.errors.filter(e=>!known.has(FluyoIntegrity.errorKey(e)));", "const regress = [];"],
  ["B3 un nodo eliminado no se registra (el rechazo no lo atribuye)", AUTH, "ctx.deleted.push({kind:\"node\", pageIndex:op.pageIndex, id, label:r.node.label,", "ctx.deleted.concat({kind:\"node\", pageIndex:op.pageIndex, id, label:r.node.label,"],
  ["B4 las conexiones eliminadas en cascada no se registran", AUTH, "for(const cid of r.connections) ctx.deleted.push(", "for(const cid of []) ctx.deleted.push("],
  ["B5 una conexión eliminada no se registra", AUTH, "ctx.deleted.push({kind:\"connection\", pageIndex:op.pageIndex, id, operationIndex:ctx.opIndex, operation:op.op});", "ctx.deleted.concat({kind:\"connection\", pageIndex:op.pageIndex, id, operationIndex:ctx.opIndex, operation:op.op});"],
  ["B6 el rechazo pierde la cascada (cascadedFrom)", AUTH, "}, del.cascadedFrom ? {cascadedFrom:del.cascadedFrom} : {}, uses));", "}, {}, uses));"],
  ["B7 el rechazo no dice qué Historias ni Steps (sin uses)", AUTH, "}, del.cascadedFrom ? {cascadedFrom:del.cascadedFrom} : {}, uses));", "}, del.cascadedFrom ? {cascadedFrom:del.cascadedFrom} : {}));"],
  ["B9 las refs de lo eliminado en el lote se siguen devolviendo", AUTH, "const refs = ctx.created.filter(c=>!ctx.deleted.some(", "const refs = ctx.created.filter(c=>!([]).some("],
  // ── objeto equivocado, campos, geometría
  ["A1 update_node actualiza otro nodo", AUTH, "try{ n = updateNodeIn(pg, id, patch); }", "try{ n = updateNodeIn(pg, pg.nodes[0].id, patch); }"],
  ["A2 update_connection actualiza otra conexión", AUTH, "try{ e = updateConnectionIn(pg, id, patch); }", "try{ e = updateConnectionIn(pg, pg.edges[pg.edges.length-1].id, patch); }"],
  ["A3 update_connection ignora source", AUTH, "if(op.source!==undefined) extra.source = ", "if(false) extra.source = "],
  ["A4 update_connection ignora target", AUTH, "if(op.target!==undefined) extra.target = ", "if(false) extra.target = "],
  ["A5 delete_node elimina otro nodo", AUTH, "try{ r = deleteNodeIn(pg, id); }", "try{ r = deleteNodeIn(pg, pg.nodes[0].id); }"],
  ["A6 delete_connection elimina otra conexión", AUTH, "try{ e = deleteConnectionIn(pg, id); }", "try{ e = deleteConnectionIn(pg, pg.edges[0].id); }"],
  ["A7 la operación admite un campo desconocido", AUTH, "update_node:[\"node\",\"spec\"],", "update_node:[\"node\",\"spec\",\"nodeId\"],"],
  ["A8 update_connection admite un campo desconocido", AUTH, "update_connection:[\"connection\",\"source\",\"target\",\"spec\"],", "update_connection:[\"connection\",\"source\",\"target\",\"spec\",\"zzz\"],"],
  ["A9 el alcance de update_node se declara «story»", AUTH, "update_node:\"page\", update_connection:\"page\",", "update_node:\"story\", update_connection:\"page\","],
  ["A10 el alcance de delete_node se declara «eventType»", AUTH, "delete_node:\"page\", delete_connection:\"page\",", "delete_node:\"eventType\", delete_connection:\"page\","],
  ["A11 la ref de una conexión se busca entre los nodos (se pierden las refs de conexión)", AUTH, "const id = pageRefs(ctx, kind, op.pageIndex).get(v.ref);", "const id = pageRefs(ctx, \"nodes\", op.pageIndex).get(v.ref);"],
  ["A12 las refs no se acotan por página en update/delete", AUTH, "const id = pageRefs(ctx, kind, op.pageIndex).get(v.ref);", "const id = pageRefs(ctx, kind, 0).get(v.ref);"],
  ["A13 {edgeId:{ref}} del destino de un Step se ignora", AUTH, "const edgeId = stepEntityId(ctx, op, target.edgeId, \"target.edgeId\", \"edges\");", "const edgeId = target.edgeId;"],
  ["A14 {nodeId:{ref}} del destino de un Step se ignora", AUTH, "const nodeId = stepEntityId(ctx, op, target.nodeId, \"target.nodeId\", \"nodes\");", "const nodeId = target.nodeId;"],
  ["A15 {from:{ref},to:{ref}} se ignora", AUTH, "const from = stepEntityId(ctx, op, target.from, \"target.from\", \"nodes\"), to = stepEntityId(ctx, op, target.to, \"target.to\", \"nodes\");", "const from = target.from, to = target.to;"],
  ["A16 el destino {ref} no se admite", AUTH, "if(target.ref!==undefined){", "if(false){"],
  ["A17 set_initial_availability no resuelve {ref}", AUTH, "const nodeId = stepEntityId(ctx, op, op.nodeId, \"nodeId\", \"nodes\");", "const nodeId = op.nodeId;"],
  ["A18 el documento original se modifica (se trabaja sobre el recibido)", AUTH, "const d = norm.doc;", "const d = (project && project.doc && Array.isArray(project.doc.pages)) ? project.doc : norm.doc;"],
  ["A19 un error a mitad del lote devuelve el documento a medias (sin rollback)", AUTH,
    "if(e && e.authoring) return failure([Object.assign({code:e.code, message:e.message, operationIndex:i, operation:isRecord(op)?op.op:undefined}, e.extra)]);",
    "if(e && e.authoring) return {ok:true, project:projectToSerializable(d, norm.settings), changes, refs:ctx.created, touched:[...ctx.touched.values()], validation:{valid:true, preexistingErrors:0}};"],
  ["A20 los changes no informan de qué cambió", AUTH, "if(JSON.stringify(before[dk])===JSON.stringify(after[dk])) continue;", "continue;"],
  ["A21 no se informa de las conexiones con ruta manual", AUTH, "connectionsWithWaypoints:moved ?", "connectionsWithWaypoints:false ?"],
  ["A22 el error del dominio NODE_NOT_FOUND pierde su código", AUTH, "node_not_found:\"NODE_NOT_FOUND\"", "node_not_found:\"INVALID_FIELD\""],
  ["A23 el borrado no dice quién eliminó la entidad que se vuelve a usar", AUTH, "return d ? ` (la eliminó la operación", "return false ? ` (la eliminó la operación"],
  ["A24 las Historias afectadas por una etiqueta no se informan", AUTH, "stories:relabeled ? storiesUsing(", "stories:false ? storiesUsing("],
  // ── dominio
  ["D1 update permite el auto-lazo", MODEL, "    if(from===to) throw projectDataError(\"self_loop\",\"target\");", ""],
  ["D2 el origen inexistente se acepta en el retarget", MODEL, "    if(fields.includes(\"source\") && !pg.nodes.some(n=>n.id===from)) throw projectDataError(\"source_not_found\",\"source\");", ""],
  ["D3 el destino inexistente se acepta en el retarget", MODEL, "    if(fields.includes(\"target\") && !pg.nodes.some(n=>n.id===to)) throw projectDataError(\"target_not_found\",\"target\");", ""],
  ["D4 el source del parche no se vuelca", MODEL, "for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];", "for(const k of fields) if(k!==\"source\") e[connectionKey(k)]=cand[connectionKey(k)];"],
  ["D5 el target del parche no se vuelca", MODEL, "for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];", "for(const k of fields) if(k!==\"target\") e[connectionKey(k)]=cand[connectionKey(k)];"],
  ["D6 se pierden los waypoints al editar una conexión", MODEL, "for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];\n  return e;", "for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];\n  if(!fields.includes(\"waypoints\")) e.waypoints=[];\n  return e;"],
  ["D7 el retarget limpia los waypoints (geometría inventada)", MODEL, "for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];\n  return e;", "for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];\n  if(fields.includes(\"source\")||fields.includes(\"target\")) e.waypoints=[];\n  return e;"],
  ["D8 updateNodeIn modifica otro nodo", MODEL, "  const n=updateEntry(pg,\"nodes\",id,\"node_not_found\");\n  const fields=updatePatch(patch,NODE_UPDATE_KEYS);", "  updateEntry(pg,\"nodes\",id,\"node_not_found\");\n  const n=pg.nodes[pg.nodes.length-1];\n  const fields=updatePatch(patch,NODE_UPDATE_KEYS);"],
  ["D9 se aceptan campos desconocidos en el parche", MODEL, "  authoringSpec(patch,allowed);\n  const fields=Object.keys(patch)", "  const fields=Object.keys(patch)"],
  ["D10 se vuelca el valor sin normalizar", MODEL, "for(const k of fields) n[k]=cand[k];", "for(const k of fields) n[k]=patch[k];"],
  ["D11 undefined destruye los defaults", MODEL, "const fields=Object.keys(patch).filter(k=>patch[k]!==undefined);", "const fields=Object.keys(patch);"],
  ["D12 delete_node deja las conexiones del nodo", MODEL, "  pg.edges=pg.edges.filter(e=>e.from!==id && e.to!==id);\n", ""],
  ["D13 delete_node deja el Behavior huérfano", MODEL, "  if(!keep && pg.behaviors) pg.behaviors=pg.behaviors.filter(b=>b.nodeId!==id);\n", ""],
  ["D14 delete_connection elimina otra conexión", MODEL, "pg.edges=pg.edges.filter(x=>x!==e);", "pg.edges=pg.edges.slice(1);"],
  ["D15 se permite cambiar a una forma que el selector no ofrece / desde un icono", MODEL, "(!EDITABLE_SHAPES.has(patch.shape) || FROZEN_SHAPES.has(n.shape))", "false"],
  ["D16 no es atómico: se escribe antes de validar", MODEL, "  const index=pg.nodes.indexOf(n);", "  const index=pg.nodes.indexOf(n); for(const k of fields) n[k]=patch[k];"],
  ["D17 el id se puede modificar", MODEL, "const NODE_UPDATE_KEYS=new Set([\"x\",", "const NODE_UPDATE_KEYS=new Set([\"id\",\"x\","],
  ["D18 from/to del documento se aceptan en el parche de conexión", MODEL, "const CONNECTION_UPDATE_KEYS=new Set([\"source\",", "const CONNECTION_UPDATE_KEYS=new Set([\"from\",\"source\","],
  ["D19 tint/lang no respetan la forma", MODEL, "if(NODE_FIELDS_BY_SHAPE[k] && !NODE_FIELDS_BY_SHAPE[k].includes(shape))", "if(false)"],
  ["D20 un valor no booleano se acepta", MODEL, "if(UPDATE_BOOLEANS.has(k) && typeof v!==\"boolean\") throw", "if(false) throw"],
  ["D21 delete_node no valida que el nodo exista", MODEL, "  const n=updateEntry(pg,\"nodes\",id,\"node_not_found\");\n  const connections=", "  const n=pg.nodes.find(x=>x.id===id) || {};\n  const connections="],
  ["D22 un auto-lazo antiguo impide editar su etiqueta (se comprueba siempre)", MODEL, "  if(fields.includes(\"source\")||fields.includes(\"target\")){\n    if(from===to)", "  if(true){\n    if(from===to)"],
  // ── editor
  ["E1 editNode edita otro nodo", STATE, "updateNodeIn(P(), n.id, patch)", "updateNodeIn(P(), P().nodes[0].id, patch)"],
  ["E2 editEdge edita otra conexión", STATE, "updateConnectionIn(P(), e.id, patch)", "updateConnectionIn(P(), P().edges[0].id, patch)"],
  ["E3 el editor deja de borrar el Behavior del nodo (vuelve el Behavior huérfano; FLUYO-018.4)", STATE, "deleteNodeIn(P(), id)", "deleteNodeIn(P(), id, {keepBehaviors:true})"],
  ["E3b el dominio ignora keepBehaviors (borra el Behavior igualmente)", MODEL, "const keep=!!(context && context.keepBehaviors);", "const keep=false;"],
  ["E4 deleteSel no borra las conexiones elegidas", SEL, "  removeEdges(edgeIds);", "  removeEdges([]);"],
  ["E5 un rechazo del dominio se propaga como excepción", STATE, "if(err && typeof err.code===\"string\") return null; throw err;", "throw err;"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-3.test.cjs", "test/fluyo-018-2.test.cjs", "test/fluyo-018-1.test.cjs", "test/fluyo-017-2.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 180000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-3-mut-"));
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
console.log(failed ? "\nFLUYO-018.3 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.3 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
