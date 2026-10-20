"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 5 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de la paridad de
   superficies (la receta compartida, Present, el Viewer, la exportación, los avisos y set_observed_flow) debe hacer fallar
   test/fluyo-scenarios-semantics-5.test.cjs. Se corren los grupos A–E (comportamiento): el alcance (G) compara con la base y mataría
   cualquier mutación, así que no cuenta aquí (como en FASE 4).
   Uso: node test/fluyo-scenarios-semantics-5-mutations.cjs   (ONLY_MUT=V3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-name-pattern=^[ABCDE]\\d", "test/fluyo-scenarios-semantics-5.test.cjs"];
const FS = "js/flow-semantics.js", ED = "js/editor-scenarios.js", PS = "js/present-story.js", VW = "js/viewer.js", RD = "js/render.js", EX = "js/export.js",
  DI = "js/document-integrity.js", SA = "js/story-authoring.js";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* la receta compartida (flow-semantics.js) */
  ["V1 barrido también sin frontera", FS, "const sweep = now.frontier && t - now.at < ROUTE_SWEEP_MS", "const sweep = (now.frontier || now.onRoute) && t - now.at < ROUTE_SWEEP_MS"],
  ["V2 fundido de otra duración", FS, "ROUTE_FADE_MS = 450,", "ROUTE_FADE_MS = 600,"],
  ["V3 la línea también sin par (ENDPOINT_MISSING / sin par)", FS, "    if(r.pair.state !== PAIR) return null;\n", ""],
  ["V4 la línea olvida la procedencia («por defecto»)", FS, "const byDefault = r.status === AVAILABLE && r.explicitPath === false;", "const byDefault = false;"],
  /* Present (editor-scenarios.js, present-story.js) */
  ["V5 Present vuelve a no recibir la ruta", ED, "if (!scPlayback || !isScenarioPlaybackActive()) return null;", `if (!scPlayback || !isScenarioPlaybackActive() || (typeof presenting !== "undefined" && presenting)) return null;`],
  ["V6 la línea de Present también sin par («Elige origen y destino»)", ED, "  if (!m || !m.status) return null;\n  return { status: m.status, text:", "  if (!m) return null;\n  return { status: m.status, text:"],
  ["V7 la línea de Present también antes de reproducir («Al inicio»)", PS, `const route=dphase!=="ready" && typeof scFlowPresentLine==="function"`, `const route=typeof scFlowPresentLine==="function"`],
  ["V8 la línea de Present sin su estado (sin color)", PS, `psSet("psFlow","className","psFlow is"+route.status);`, `psSet("psFlow","className","psFlow");`],
  ["V9 sin Historia, la línea anterior se queda", PS, `    psSet("psFlow","hidden",true);\n    return;`, "    return;"],
  /* Viewer (viewer.js) */
  ["V10 el Viewer depende de la bandera labs", VW, "  if(!story || typeof FluyoFlow===\"undefined\") return null;", "  if(!story || typeof FluyoFlow===\"undefined\" || typeof LABS_SEMANTICS===\"undefined\" || !LABS_SEMANTICS) return null;"],
  ["V11 el Viewer sin la regla de existencia (sin Flujo también)", VW, `if(pg.edges.some(e=>edgeKind(e)==="FLOWS_TO")){`, "if(true){"],
  ["V12 el Viewer sin memoización (una ruta por fotograma)", VW, "  if(storyFlowMemo.playback===pb && storyFlowMemo.page===pg) return storyFlowMemo.value;\n", ""],
  ["V13 el Viewer con el horario narrativo (no el visible)", VW, "timeOf:st=>FluyoStoryClock.visibleAt(pb, st)", "timeOf:st=>st.at"],
  ["V14 renderViewerFrame no entrega la ruta al lienzo", VW, "    if(flow) rs.scenarioRuntime.flow=flow;\n", ""],
  ["V15 la línea del Viewer sin su estado (sin color)", VW, `storySet("stFlow","className","stFlow is"+route.status);`, `storySet("stFlow","className","stFlow");`],
  ["V16 el Viewer pinta la ruta en el instante 0 (no el cursor)", VW, "FluyoFlow.routeOverlay(P(), d.route, d.tl, story.playback.cursorVirtual||0)", "FluyoFlow.routeOverlay(P(), d.route, d.tl, 0)"],
  /* exportación: raster (render.js) y SVG (export.js) */
  ["V17 el raster exportado sin marcas", RD, `const sem=typeof edgeSemanticMarks==="function" ? edgeSemanticMarks(e,pts) : null;`, `const sem=!isExport && typeof edgeSemanticMarks==="function" ? edgeSemanticMarks(e,pts) : null;`],
  ["V18 el raster exportado sin N3", RD, "if(rs.skinOn && !e.startArrow && !(sem && sem.ring) && typeof skinEdgePort", "if(rs.skinOn && !e.startArrow && !(sem && sem.ring && !isExport) && typeof skinEdgePort"],
  ["V19 el SVG sin marcas", EX, "  if(sem) parts.push(...semanticMarksToSVG(sem, lineCol, escapeAttribute(doc.customBg||T.bg)));\n", ""],
  ["V20 el SVG sin N3", EX, "if(skinOn && !e.startArrow && !(sem && sem.ring) && typeof skinEdgePort", "if(skinOn && !e.startArrow && typeof skinEdgePort"],
  ["V21 el anillo del SVG ignora el fondo propio", EX, "escapeAttribute(doc.customBg||T.bg)", "escapeAttribute(T.bg)"],
  ["V22 las marcas del SVG con el discontinuo del usuario", EX, 'const st=`stroke="${lineCol}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;', 'const st=`stroke="${lineCol}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 7"`;'],
  /* kernel: avisos W2/W3 y set_observed_flow */
  ["V23 warnings siempre (también vacío): la salida de los documentos antiguos cambia", DI, "    if(warnings.length) out.warnings = warnings;", "    out.warnings = warnings;"],
  ["V24 W2/W3 invalidan el documento", DI, "    if(warnings.length) out.warnings = warnings;", "    if(warnings.length){ out.warnings = warnings; out.valid = false; }"],
  ["V25 GENERIC también avisa (W3)", DI, "&& e.kind!==EDGE_KIND_GENERIC)", ")"],
  ["V26 sin W2", DI, "        if(missing.length) out.push(", "        if(false) out.push("],
  ["V27 set_observed_flow guarda los extremos al revés", SA, "flow = {from:source, to:target};", "flow = {from:target, to:source};"],
  ["V28 set_observed_flow no marca la Historia como tocada", SA, "      const r = setObservedFlowIn(pg, sc.id, flow);\n      touch(ctx, op.pageIndex, sc);", "      const r = setObservedFlowIn(pg, sc.id, flow);"],
  ["V29 null + null no vuelve a la automática", SA, "      if(op.source!==null || op.target!==null){", "      if(true){"],
  ["V30 un extremo inexistente sin TARGET_NOT_FOUND", SA, "          if(!pg.nodes.some(n=>n.id===id)) throw reject(\"TARGET_NOT_FOUND\"", "          if(false) throw reject(\"TARGET_NOT_FOUND\""],
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss5-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  /* la copia no tiene .git: lo que se compara con 6701261 se lee del árbol real (FLUYO_GIT_ROOT) */
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
console.log((failed ? "\nSCENARIOS-SEMANTICS-001 FASE 5 mutaciones: " + failed + " sin detectar" : "\nSCENARIOS-SEMANTICS-001 FASE 5 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
