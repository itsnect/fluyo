"use strict";
/* FLUYO-STEP-REVERSE-002 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del contrato `reverse`
   (motor, Trace, playback, texto, token, autoría, validación y editor) debe hacer fallar test/fluyo-step-reverse-002.test.cjs.
   Uso: node test/fluyo-step-reverse-002-mutations.cjs   (ONLY_MUT=R3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "test/fluyo-step-reverse-002.test.cjs"];
const EN = "js/scenario-engine.js", MD = "js/model.js", SP = "js/story-playback.js", PB = "js/scenario-playback.js", RD = "js/render.js",
  SA = "js/story-authoring.js", DI = "js/document-integrity.js", ED = "js/editor-scenarios.js", SE = "js/selection.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* las cinco que pide la tarea */
  ["R1 el motor ignora reverse", EN, "const reverse = step.reverse === true;", "const reverse = false;"],
  ["R2 el motor invierte source/target siempre (también sin reverse)", EN, "const sourceState = states.get(reverse ? edge.to : edge.from);\n        const targetState = states.get(reverse ? edge.from : edge.to);",
    "const sourceState = states.get(edge.to);\n        const targetState = states.get(edge.from);"],
  ["R3 traversalEnds invierte al revés (la regla del kernel)", MD, "return reverse===true ? {source:e.to, target:e.from} : {source:e.from, target:e.to};", "return reverse===true ? {source:e.from, target:e.to} : {source:e.to, target:e.from};"],
  ["R4 reasonNodeId con los extremos de la conexión (no del recorrido)", SP, "out.reasonNodeId = end.reason===\"source_down\" ? t.source : t.target;", "out.reasonNodeId = end.reason===\"source_down\" ? e.from : e.to;"],
  ["R5 el token recorre la conexión en el sentido de la conexión", RD, "drawFlowOverlay(c,pts.slice().reverse(),revActive,revCompleted,T);", "drawFlowOverlay(c,pts,revActive,revCompleted,T);"],
  ["R6 validatePersistedStep acepta cualquier valor de reverse", MD, "if(step.action!==\"SEND\" || step.reverse!==true) throw projectDataError();", "if(step.action!==\"SEND\") throw projectDataError();"],
  ["R7 validatePersistedStep acepta reverse en cualquier acción", MD, "if(step.action!==\"SEND\" || step.reverse!==true) throw projectDataError();", "if(step.reverse!==true) throw projectDataError();"],
  ["R8 el motor acepta cualquier valor de reverse", EN, "if(step.action===\"SEND\" && Object.prototype.hasOwnProperty.call(step,\"reverse\") && step.reverse!==true)", "if(false)"],
  ["R9 el motor acepta reverse en cualquier acción", EN, "!(k===\"reverse\" && step.action===\"SEND\")", "k!==\"reverse\""],
  /* Trace y lectura */
  ["R10 el Trace no lleva la clave reverse", EN, "const dir = reverse ? {reverse:true} : {};", "const dir = {};"],
  ["R11 el Trace escribe reverse:false en los envíos normales", EN, "const dir = reverse ? {reverse:true} : {};", "const dir = {reverse};"],
  ["R12 el playback no lleva el sentido", PB, "const dirOf = o => o && o.reverse===true ? {reverse:true} : {};", "const dirOf = o => ({});"],
  ["R13 el caption ignora ev.reverse", SP, "const t=traversalEnds(edgeEnds(ev.edgeId), ev.reverse);", "const t=traversalEnds(edgeEnds(ev.edgeId));"],
  ["R14 la frase ignora el sentido", SP, "t = traversalEnds(e, step.reverse);", "t = traversalEnds(e);"],
  ["R15 outcomes no dice reverse", SP, "        if(step.reverse===true) out.reverse = true;\n", ""],
  /* carga y validación */
  ["R16 la carga no quita reverse:false", MD, "step.reverse===false) delete step.reverse;", "step.reverse===false) {}"],
  ["R17 la integridad no canonicaliza reverse:false", DI, "validatePersistedStep(canonicalizePersistedStep(clone(step)), sc.engineVersion)", "validatePersistedStep(clone(step), sc.engineVersion)"],
  ["R18 stepDefinitionForEvent no escribe reverse", MD, "  if(reverse===true) def.reverse=true;\n", ""],
  ["R19 retargetStep conserva el sentido anterior (no fija el recorrido)", MD, "    if(reverse===true) step.reverse=true; else delete step.reverse;\n  }else{", "    if(reverse===true) step.reverse=true;\n  }else{"],
  /* autoría */
  ["R20 {from,to} sin la inversa", SA, "      if(back.length) return {id:back[0].id, reverse:true};\n", ""],
  ["R21 {from,to}: la inversa gana a la directa", SA, "      const hits = pg.edges.filter(e=>e.from===from && e.to===to);\n      if(hits.length>1)",
    "      const hits = pg.edges.filter(e=>e.from===to && e.to===from).length ? [] : pg.edges.filter(e=>e.from===from && e.to===to);\n      if(hits.length>1)"],
  ["R22 inversa ambigua: se toma la primera", SA, "      if(back.length>1) throw reject(\"AMBIGUOUS_TARGET\"", "      if(false) throw reject(\"AMBIGUOUS_TARGET\""],
  ["R23 {edgeId, reverse} ignora reverse", SA, "        return {id:edgeId, reverse:reverse===true};", "        return {id:edgeId, reverse:false};"],
  ["R24 {from,to,reverse} se acepta", SA, "      if(reverse!==undefined) throw reject(\"INVALID_OPERATION\", \"Con {from, to}", "      if(false) throw reject(\"INVALID_OPERATION\", \"Con {from, to}"],
  ["R25 reverse sobre un elemento se acepta", SA, "    if(reverse!==undefined) throw noSense();\n    const nodeId", "    const nodeId"],
  ["R26 retarget_step conserva el sentido (no lo fija)", SA, "retargetStep(pg, sc, st.id, tgt.id, st.action===\"SEND\" ? tgt.reverse : undefined);", "retargetStep(pg, sc, st.id, tgt.id, st.action===\"SEND\" ? (tgt.reverse || st.reverse===true) : undefined);"],
  /* editor */
  ["R27 «Cambiar dónde ocurre» pierde el sentido", ED, "retargetStep(P(), scActiveScenario(), s.id, id, s.action === \"SEND\" ? s.reverse === true : undefined);", "retargetStep(P(), scActiveScenario(), s.id, id);"],
  ["R28 la colocación múltiple no hereda reverse", ED, "s.reverse === true ? { reverse: true } : {}));", "{}));"],
  ["R29 la colocación múltiple compara solo por conexión", ED, " && (x.reverse === true) === (s.reverse === true))", ")"],
  ["R30 la etiqueta del panel ignora el sentido", ED, "return scEdgeLabel(step.edgeId, step.reverse) || \"Conexión sin nombre\";", "return scEdgeLabel(step.edgeId) || \"Conexión sin nombre\";"],
  ["R31 el motivo del panel con los extremos de la conexión", ED, "  const t = traversalEnds(edgeById(step.edgeId), step.reverse);\n  return reason", "  const t = traversalEnds(edgeById(step.edgeId));\n  return reason"],
  ["R32 el registro ignora ev.reverse", ED, "const lbl = scEdgeLabel(ev.edgeId, ev.reverse) || \"Conexión #\" + ev.edgeId;\n      mark.textContent = \"→\";", "const lbl = scEdgeLabel(ev.edgeId) || \"Conexión #\" + ev.edgeId;\n      mark.textContent = \"→\";"],
  ["R33 la confirmación de borrado ignora el sentido", SE, "t=traversalEnds(e, st.reverse);", "t=traversalEnds(e);"],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 300000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-rev2-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? (r.timedOut || r.code === null ? "  (cuelga: muere por tiempo)" : "  (" + n + " comprobaciones fallan)") : ""));
    if (!killed) failed++;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  });
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}
console.log((failed ? "\nFLUYO-STEP-REVERSE-002 mutaciones: " + failed + " sin detectar" : "\nFLUYO-STEP-REVERSE-002 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
