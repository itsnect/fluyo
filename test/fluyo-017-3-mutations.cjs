"use strict";
/* FLUYO-017.3 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de la autoría de EventTypes
   debe hacer fallar test/fluyo-017-3.test.cjs o test/fluyo-017-3-qa.test.cjs. Uso: node test/fluyo-017-3-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const MUTATIONS = [
  // ── dominio (model.js): las reglas que comparten el editor y MCP
  ["D1 updateEventTypeIn no es todo o nada (muta el original)", "js/model.js",
    "const next=JSON.parse(JSON.stringify(et));", "const next=et;"],
  ["D2 updateEventTypeIn no valida el resultado", "js/model.js",
    "  validateEventType(next);\n  for(const k of Object.keys(et)) delete et[k];", "  for(const k of Object.keys(et)) delete et[k];"],
  ["D3 la primitiva de un evento usado SÍ cambia", "js/model.js",
    "changes.primitive!==et.primitive && used)", "changes.primitive!==et.primitive && false)"],
  ["D4 reenviar la MISMA disponibilidad de un evento usado lanza (bug original)", "js/model.js",
    "et.primitive===\"SET_AVAILABILITY\" && changes.availability!==et.availability && used)", "et.primitive===\"SET_AVAILABILITY\" && used)"],
  ["D5 un evento usado se puede eliminar en el dominio", "js/model.js",
    "  if(eventTypeUseCountIn(d,id)>0) throw projectDataError(\"event_type_in_use\");\n", ""],
  ["D6 los ids de EventType se reutilizan", "js/model.js",
    "const id=projectCounter(d.nextEventTypeId,maxId);          // el mismo", "const id=maxId+1;          // el mismo"],
  ["D7 el movimiento se conserva en eventos que no son de conexión", "js/model.js",
    "motion:flow? (input.motion||DEFAULT_EVENT_MOTION) : DEFAULT_EVENT_MOTION", "motion:input.motion||DEFAULT_EVENT_MOTION"],
  ["D8 la presentación lleva siempre las dos ramas", "js/model.js",
    "def.presentation=flow? {connectionEffects:input.connectionEffects} : {nodeEffects:input.nodeEffects};", "def.presentation={connectionEffects:input.connectionEffects,nodeEffects:input.nodeEffects};"],
  ["D9 todo evento lleva disponibilidad", "js/model.js",
    "if(primitive===\"SET_AVAILABILITY\") def.availability=input.availability;", "def.availability=input.availability;"],
  ["D10 «Recuperación/caída» no es SET_AVAILABILITY al caer", "js/model.js",
    "return consequence===\"up\" || consequence===\"down\" ? \"SET_AVAILABILITY\" : \"OCCURRENCE\";", "return consequence===\"up\" ? \"SET_AVAILABILITY\" : \"OCCURRENCE\";"],
  ["D11 el borrado ya no quita el EventType", "js/model.js",
    "d.eventTypes=d.eventTypes.filter(et=>et.id!==id);", "d.eventTypes=d.eventTypes.slice();"],
  ["D12 los errores de validación pierden el campo culpable", "js/model.js",
    "if(field!==undefined) err.field=field; return err;", "return err;"],
  ["D13 el contador avanza aunque el EventType sea inválido", "js/model.js",
    "  validateEventType(et);\n  reserveProjectIds(d,\"nextEventTypeId\",1,id);", "  reserveProjectIds(d,\"nextEventTypeId\",1,id);\n  validateEventType(et);"],
  // ── autoría (story-authoring.js)
  ["A1 ignorar el scope declarado", "js/story-authoring.js",
    "if(op.scope!==expected) throw", "if(false) throw"],
  ["A2 un EventType admite pageIndex", "js/story-authoring.js",
    "(expected===\"eventType\" ? [\"op\",\"scope\"] : [\"op\",\"scope\",\"pageIndex\"])", "[\"op\",\"scope\",\"pageIndex\"]"],
  ["A3 el rechazo de primitiva/disponibilidad en uso pierde su código", "js/story-authoring.js",
    "throw blockedByUse(ctx, et, candidate, \"EVENT_TYPE_LOCKED\", e.field);", "throw e;"],
  ["A4 presentación inválida «corregida» en silencio", "js/story-authoring.js",
    "      if(out[k]!==patch[k])\n        throw etError(", "      if(false)\n        throw etError("],
  ["A5 la presentación reemplaza en vez de parchear", "js/story-authoring.js",
    "const out = normalize(Object.assign({}, cur, patch));", "const out = normalize(Object.assign({}, patch));"],
  ["A6 llaves sueltas aceptadas en la frase", "js/story-authoring.js",
    "if(field===\"sentence\" && eventSentenceHasStrayBraces(v)) throw etError(field);", ""],
  ["A7 sin aviso de nombre duplicado", "js/story-authoring.js",
    "return same.length ? [{code:\"DUPLICATE_EVENT_TYPE_NAME\"", "return !same.length || true ? [] : [{code:\"DUPLICATE_EVENT_TYPE_NAME\""],
  ["A8 saltarse la validación final del lote", "js/story-authoring.js",
    "    if(regress.length) return failure(explainRemovals(ctx, regress, d));", ""],
  ["A9 las refs de EventType no se resuelven", "js/story-authoring.js",
    "const id = ctxRef(ctx, \"eventTypes\", v, \"eventTypeId\").id;", "const id = ctxRef(ctx, \"none\", v, \"eventTypeId\").id;"],
  ["A10 el rechazo de borrado no lista los pasos", "js/story-authoring.js",
    "if(e.stepId!==undefined && !s.stepIds.includes(e.stepId)){ s.stepIds.push(e.stepId); steps.push(", "if(e.stepId!==undefined && !s.stepIds.includes(e.stepId)){ s.stepIds.push(e.stepId); [].push("],
  ["A11 la acción del evento nueva la escribe el agente (se acepta `action`)", "js/story-authoring.js",
    "create_event_type:[\"name\",\"primitive\",\"sentence\",\"symbol\",\"motion\",\"availability\",\"presentation\",\"ref\"],", "create_event_type:[\"name\",\"primitive\",\"sentence\",\"symbol\",\"motion\",\"availability\",\"presentation\",\"ref\",\"action\"],"],
  ["A12 update sin ningún campo se acepta", "js/story-authoring.js",
    "if(!given.length) throw reject(", "if(false) throw reject("],
  ["A13 el cambio de primitiva no reconstruye la definición (conserva motion/presentación viejas)", "js/story-authoring.js",
    "      if(primitive!==et.primitive){\n        // Cambia dónde", "      if(false){\n        // Cambia dónde"],
  // ── integridad
  ["I1 el impacto de borrar un evento no simula nada", "js/document-integrity.js",
    "if(candidate===null) eventTypes.splice(i, 1);", "if(candidate===null) { }"],
  ["I2 un Step con otra acción que su EventType deja de detectarse", "js/document-integrity.js",
    "if(!spec || spec.action!==step.action)", "if(!spec)"],
  ["I3 un Step con un EventType inexistente deja de detectarse", "js/document-integrity.js",
    "if(!et){ errors.push(makeError(\"missing_event_type\"", "if(!et){ continue; errors.push(makeError(\"missing_event_type\""],
  ["I4 el EventType duplicado deja de detectarse", "js/document-integrity.js",
    "else if(seen.has(id))", "else if(false)"],
  // ── el editor consume la forma compartida
  ["E1 el modal vuelve a decidir la primitiva por su cuenta", "js/editor-scenarios.js",
    "primitive: eventTypePrimitiveFor(connection ? \"connection\" : \"element\", consequence),", "primitive: connection ? \"FLOW\" : \"OCCURRENCE\","],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-017-3.test.cjs", "test/fluyo-017-3-qa.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 120000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-017-3-mut-"));
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
console.log(failed ? "\nFLUYO-017.3 mutaciones: " + failed + " sin detectar" : "\nFLUYO-017.3 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
