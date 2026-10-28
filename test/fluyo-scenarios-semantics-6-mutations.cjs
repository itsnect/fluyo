"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 6 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de lo que FASE 6 fija debe
   hacer fallar test/fluyo-scenarios-semantics-6.test.cjs: la regla de carga en el pegado (B1) y las entradas que ya la tenían, y la
   semántica temporal de § T con la que se mide B9. Se corren los grupos A y B (comportamiento): el alcance (C) compara con la base y
   mataría cualquier mutación, así que no cuenta aquí (como en FASE 4 y FASE 5).
   Uso: node test/fluyo-scenarios-semantics-6-mutations.cjs   (ONLY_MUT=M3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-name-pattern=^[ABD]\\d", "test/fluyo-scenarios-semantics-6.test.cjs"];
const UI = "js/ui.js", ED = "js/editor-scenarios.js", CSS = "css/styles.css";
const MO = "js/model.js", SE = "js/selection.js", ST = "js/state.js", SL = "js/share-loader.js", SA = "js/story-authoring.js", FS = "js/flow-semantics.js",
  SP = "js/scenario-playback.js", SC = "js/story-clock.js", EN = "js/scenario-engine.js";
const CHECK = `  for(const b of behaviors) if(!projectObject(b) || (inSet.has(b.nodeId) && !SCENARIO_STATES.has(b.initialState))) throw projectDataError("invalid_document","behaviors");\n`;
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* B1 en el pegado (model.js, selection.js) */
  ["M1 cloneStructureIn vuelve a copiar Behaviors sin la regla de carga", MO, CHECK, ""],
  ["M2 la regla se comprueba DESPUÉS de mutar (copia parcial)", MO, CHECK + "  // Reserva ANTES de mutar", "  // Reserva ANTES de mutar"],
  ["M3 la regla también bloquea lo que no se copia (Behaviors de otros nodos)", MO, "(inSet.has(b.nodeId) && !SCENARIO_STATES.has(b.initialState))", "!SCENARIO_STATES.has(b.initialState)"],
  ["M4 un portapapeles sin Behaviors (null) se rechaza", MO, "const behaviors=snapshot.behaviors==null ? [] : snapshot.behaviors;", "const behaviors=snapshot.behaviors===undefined ? [] : snapshot.behaviors;"],
  ["M5 la regla deja pasar UNKNOWN", MO, "const SCENARIO_STATES=new Set([\"UP\",\"DOWN\"]);", "const SCENARIO_STATES=new Set([\"UP\",\"DOWN\",\"UNKNOWN\"]);"],
  ["M6 pasteClip se traga también id_exhausted", SE, "  try{ r=cloneStructureIn(P(), clip, {dx:GRID, dy:GRID}); }\n  catch(err){ if(err && typeof err.code===\"string\" && err.code!==\"id_exhausted\") return; throw err; }",
    "  try{ r=cloneStructureIn(P(), clip, {dx:GRID, dy:GRID}); }\n  catch(err){ return; }"],
  ["M7 pasteClip apila Undo antes del dominio", SE, "  if(!clip || !clip.nodes.length) return;\n  const snap=snapPage();\n", "  if(!clip || !clip.nodes.length) return;\n  const snap=snapPage();\n  pushUndoSnapshot(snap);\n"],
  /* las demás entradas de B1 (ya tenían la regla: que no la pierdan) */
  ["M8 «Añadir como página» sin normalizar", ST, "  const nd=documentFromProjectData(d);", "  const nd=d.doc;"],
  ["M9 el Viewer abre #d= sin normalizar", SL, "      return {project:projectFromProjectData(data),payload};", "      return {project:data,payload};"],
  /* La autoría tiene dos barreras (story-authoring.js y setInitialAvailability de model.js): quitar una sola es una mutación
     equivalente para la op (se comprobó: sobrevive). M10 quita la de model.js, que es la que usa Condiciones en el editor. */
  ["M10 setInitialAvailability (model.js) admite cualquier estado", MO, "function setInitialAvailability(pg,nodeId,state){\n  if(state!==\"UP\" && state!==\"DOWN\") throw projectDataError();\n",
    "function setInitialAvailability(pg,nodeId,state){\n"],
  /* § T: la semántica con la que se mide B9 */
  ["M11 la ruta no marca la frontera (sin cambio de ruta)", FS, "frontier: status !== prev,", "frontier: false,"],
  ["M12 el viaje del Playback dura otra cosa (la llegada se mueve)", SP, "const MOTION_MS = {fast:500, normal:1100, slow:1800};", "const MOTION_MS = {fast:500, normal:900, slow:1800};"],
  ["M13 la espera de llegada no espera (sin horario visible)", SC, "      for(const id of waits) if(arrivals[id]>t) t = arrivals[id];\n", ""],
  ["M14 el motor deja de comprobar el destino al salir (la inversa se «completa»)", EN, `        else if(targetState === "DOWN") result = {type:"send_failed", reason:"target_down"};`, `        else if(false) result = {type:"send_failed", reason:"target_down"};`],
  ["M15 el motor decide el envío con los estados del FINAL de la Historia (no los de su at)", EN, "      virtualTime = job.at;\n      const step = job.step;\n",
    "      virtualTime = job.at;\n      const step = job.step;\n      if(step.action === \"SEND\") for(const j of queue.slice(cursor)) if(j.step.action === \"SET_STATE\") states.set(j.step.nodeId, j.step.state);\n"],
  /* cierre del PO: la bandera retirada (decisión 253) y «Automática · nombre» (decisión 252) */
  ["M16 la herramienta vuelve a depender de la bandera", ED, "  return typeof FluyoFlow !== \"undefined\" && !!pg", "  return typeof LABS_SEMANTICS !== \"undefined\" && !!LABS_SEMANTICS && typeof FluyoFlow !== \"undefined\" && !!pg"],
  ["M17 «Semántica» vuelve a esconderse sin la bandera", UI, "$(\"rowKind\").style.display=isNode ? \"none\" : \"flex\";", "$(\"rowKind\").style.display=!isNode && typeof LABS_SEMANTICS!==\"undefined\" ? \"flex\" : \"none\";"],
  ["M18 el aviso W5 vuelve a depender de la bandera", UI, "$(\"kindNote\").hidden=!flowArrowReversed(e);", "$(\"kindNote\").hidden=!(typeof LABS_SEMANTICS!==\"undefined\" && flowArrowReversed(e));"],
  ["M19 la herramienta deja de ser su propio contenedor (no se apila)", CSS, " container:scflow / inline-size;}", "}"],
  ["M20 la herramienta solo se apila en pantallas de teléfono (la ventana, no la herramienta)", CSS, "@container scflow (max-width: 539px){", "@media (max-width: 480px){"],
  /* decisión 254 (018.23): «Semántica» en «Puntos», plegado por defecto */
  ["M21 «Puntos» se abre por defecto con una conexión (la fila vuelve a sumar altura)", UI, 'return kind==="edge" ? ["grpStroke","grpRoute"]', 'return kind==="edge" ? ["grpStroke","grpRoute","grpFlow"]'],
  ["M22 «Semántica» vuelve a «Trazo»", "index.html", '      <details class="pgroup" id="grpStroke" data-group="Trazo" open>\n        <summary><span class="pgTitle" data-i18n="prop.group.stroke">Trazo</span></summary>\n        <div class="pgBody">\n',
    '      <details class="pgroup" id="grpStroke" data-group="Trazo" open>\n        <summary><span class="pgTitle" data-i18n="prop.group.stroke">Trazo</span></summary>\n        <div class="pgBody">\n          <div class="row" id="rowKind" data-stack style="display:none"></div>\n'],
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss6-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  /* la copia no tiene .git: lo que se compara con a4bbf2f se lee del árbol real (FLUYO_GIT_ROOT) */
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-3000)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (text.split(from).length !== 2) { console.log("  ✘ " + name + " — el patrón no existe o no es único (mutación obsoleta)"); failed++; return; }
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
console.log((failed ? "\nSCENARIOS-SEMANTICS-001 FASE 6 mutaciones: " + failed + " sin detectar" : "\nSCENARIOS-SEMANTICS-001 FASE 6 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
