"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 3 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de la derivación
   de la ruta observada, de su cascada y de la herramienta del editor debe hacer fallar test/fluyo-scenarios-semantics-3.test.cjs.
   Uso: node test/fluyo-scenarios-semantics-3-mutations.cjs   (ONLY_MUT=U3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "test/fluyo-scenarios-semantics-3.test.cjs"];
const FS = "js/flow-semantics.js", MD = "js/model.js", DI = "js/document-integrity.js", ED = "js/editor-scenarios.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* derivación */
  ["U1 ENDPOINT_MISSING cae al par estructural", FS, "    if(f !== undefined){", "    if(f !== undefined && ids.has(f.from) && ids.has(f.to)){"],
  ["U2 ENDPOINT_MISSING se trata como par", FS, "state: missing.length ? ENDPOINT_MISSING : PAIR", "state: PAIR"],
  ["U3 el par estructural acepta varios orígenes o destinos", FS, "if(sources.length === 1 && sinks.length === 1)", "if(sources.length >= 1 && sinks.length >= 1)"],
  ["U4 el par estructural mira todas las conexiones (no solo Flujo)", FS, "    const adj = flowGraph(page, ids), on = new Set(), hasIn = new Set();",
    "    const adj = new Map(); for(const e of page.edges){ if(!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); } const on = new Set(), hasIn = new Set();"],
  ["U5 la procedencia ignora el instante visible (timeOf)", FS, "availabilityProvenance(page, steps, t, timeOf);", "availabilityProvenance(page, steps, t);"],
  ["U6 sin par se observa el primer Flujo", FS, "    return {state: NO_PAIR, origin: null, source: null, target: null, missing: []};",
    "    if(sources.length && sinks.length) return {state: PAIR, origin: \"structural\", source: sources[0], target: sinks[0], missing: []};\n    return {state: NO_PAIR, origin: null, source: null, target: null, missing: []};"],
  /* kernel */
  ["U7 deleteNodeIn no quita la ruta (cascada ausente)", MD, "if(f && (f.from===id || f.to===id)){ delete sc.observedFlow; observedFlows.push(sc.id); }", "if(f && (f.from===id || f.to===id)){ observedFlows.push(sc.id); }"],
  ["U8 la cascada quita la ruta de todas las Historias", MD, "if(f && (f.from===id || f.to===id)){", "if(f){"],
  ["U9 la cascada solo mira el origen", MD, "if(f && (f.from===id || f.to===id)){", "if(f && f.from===id){"],
  ["U10 removalImpact no informa la ruta", DI, "        if(ends.length){", "        if(false){"],
  ["U11 la normalización reescribe un par válido (pierde claves futuras)", MD, "  if(sc.observedFlow!==undefined && !observedFlowValid(sc.observedFlow)) delete sc.observedFlow;",
    "  if(sc.observedFlow!==undefined && !observedFlowValid(sc.observedFlow)) delete sc.observedFlow;\n  else if(sc.observedFlow!==undefined) sc.observedFlow={from:sc.observedFlow.from, to:sc.observedFlow.to};"],
  ["U12 la normalización rechaza el documento con una forma rota", MD, "!observedFlowValid(sc.observedFlow)) delete sc.observedFlow;", "!observedFlowValid(sc.observedFlow)) throw projectDataError();"],
  ["U13 setObservedFlowIn no comprueba que el nodo exista", MD, '    if(!pg.nodes.some(n=>n.id===flow[k])) throw projectDataError("node_not_found",k);\n', ""],
  ["U14 Condiciones → Disponible no se guarda (regla anterior)", MD, "  pg.behaviors.push({nodeId, initialState:state});", '  if(state==="DOWN") pg.behaviors.push({nodeId, initialState:"DOWN"});'],
  /* editor */
  ["U15 la herramienta sale sin la bandera labs", ED, "return typeof LABS_SEMANTICS !== \"undefined\" && !!LABS_SEMANTICS && typeof FluyoFlow !== \"undefined\";", "return typeof FluyoFlow !== \"undefined\";"],
  ["U16 la herramienta sale con una Historia sin eventos", ED, "!!sc && sc.steps.length > 0 && pg.edges", "!!sc && pg.edges"],
  ["U17 sin reproducir se mira el final de la Historia (no el inicio)", ED, "playing ? scPlayback.cursorVirtual || 0 : 0,", "playing ? scPlayback.cursorVirtual || 0 : 1e12,"],
  ["U18 «Al inicio» también reproduciendo", ED, "(playing ? \"\" : SC_FLOW_WORDS.atStart)", "SC_FLOW_WORDS.atStart"],
  ["U19 «incluye estados por defecto» invertido", ED, "m.explicitPath === false ? SC_FLOW_WORDS.byDefault", "m.explicitPath === true ? SC_FLOW_WORDS.byDefault"],
  ["U20 elegir lo actual también apila Undo", ED, "  if (r.changed) {\n    pushUndo();", "  if (true) {\n    pushUndo();"],
  ["U21 elegir un extremo no completa el otro con el automático", ED, "  if (other === null && p.origin === \"structural\") other = otherEnd === \"from\" ? p.source : p.target;\n", ""],
  ["U22 reproduciendo se recalcula la receta (sin el Trace de la reproducción)", ED, "  if (scPlayback && isScenarioPlaybackActive()) {", "  if (false) {"],
  ["U23 sin memoización por firma", ED, "  if (scFlowBase.key !== key) {", "  if (true) {"],
  ["U24 el DOM se reescribe aunque no cambie nada", ED, "  if (sig === scFlowLast) return;\n", ""],
  ["U25 los selectores no se excluyen entre sí", ED, "    for (const id of ids) if (id !== other) list.push", "    for (const id of ids) list.push"],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 120000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss3-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  /* la copia no tiene .git: el alcance (D3) se mide en el árbol real (FLUYO_GIT_ROOT), que es el mismo texto salvo la mutación */
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
console.log((failed ? "\nSCENARIOS-SEMANTICS-001 FASE 3 mutaciones: " + failed + " sin detectar" : "\nSCENARIOS-SEMANTICS-001 FASE 3 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
