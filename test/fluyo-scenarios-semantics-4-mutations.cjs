"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 4 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de la experiencia
   de la ruta (derivación de lo que se pinta y se cuenta, la herramienta, el pintor del lienzo, Requisito estable y N3) debe hacer
   fallar test/fluyo-scenarios-semantics-4.test.cjs. Se corren los grupos A–D (comportamiento): el alcance (E) compara con la base
   y mataría cualquier mutación, así que no cuenta aquí (como en STEP-REVERSE-003).
   Uso: node test/fluyo-scenarios-semantics-4-mutations.cjs   (ONLY_MUT=U3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "--test-name-pattern=^[ABCD]\\d", "test/fluyo-scenarios-semantics-4.test.cjs"];
const FS = "js/flow-semantics.js", ED = "js/editor-scenarios.js", RD = "js/render.js";
const LINE = `  c.strokeStyle=lineCol; c.lineWidth=EDGE_W;
  c.lineJoin="round";
  if(e.dashed) c.setLineDash([8,7]);
  c.beginPath(); traceSegments(c,stroke.line);
  c.stroke(); c.setLineDash([]);
`;
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  /* derivación (flow-semantics.js) */
  ["U1 la ruta incluye Requisito y Conexión", FS, `      if(edgeKind(e) !== FLOWS_TO) continue;\n      if(!ids.has(e.from) || !ids.has(e.to)) throw flowError("missing_edge_endpoint", "edges");\n      out.push(e);`,
    `      if(!ids.has(e.from) || !ids.has(e.to)) throw flowError("missing_edge_endpoint", "edges");\n      out.push(e);`],
  ["U2 la ruta no excluye lo que entra al origen o sale del destino", FS, "const g = all.filter(e => e.to !== source && e.from !== target);", "const g = all;"],
  ["U3 el estado de las conexiones ignora el de los nodos", FS, "const up = id => states[id] === UP;", "const up = id => true;"],
  ["U4 frontera = cualquier cambio de nodo (no de la ruta)", FS, "frontier: status !== prev,", "frontier: changes.length > 0,"],
  ["U5 marcas también por cambios fuera de la ruta", FS, "onRoute: changes.some(c => onRoute.has(c.nodeId))", "onRoute: changes.length > 0"],
  ["U6 el mismo instante no se aplica junto", FS, `ev.type === "state_changed" && ev.at > ats[ats.length - 1]) ats.push(ev.at);`, `ev.type === "state_changed" && ev.at >= ats[ats.length - 1]) ats.push(ev.at);`],
  ["U7 NO_PATH tiene línea de tiempo", FS, "    if(route.status !== ROUTE) return null;\n", ""],
  ["U8 recuento con el tope de 64 del prototipo", FS, "      total = count.get(s);", "      total = Math.min(64, count.get(s));"],
  ["U9 mustPass solo origen y destino (filas sin nodos distintivos)", FS, "const mustPass = route.nodes.filter(v => v === s || v === t || !spread(s, route.edges, true, n => n !== v).has(t));",
    "const mustPass = route.nodes.filter(v => v === s || v === t);"],
  ["U10 dos conexiones paralelas cuentan como dos filas", FS, "      if(!l.includes(e.to)) l.push(e.to);", "      l.push(e.to);"],
  /* editor (editor-scenarios.js) */
  ["U11 el lienzo recibe la ruta sin la bandera labs", ED, "  if (!scFlowShown(pg, sc)) return null;\n  let d = null;", "  let d = null;"],
  ["U12 el lienzo pinta la ruta en Present (FASE 5)", ED, `if (!scPlayback || !isScenarioPlaybackActive() || (typeof presenting !== "undefined" && presenting)) return null;`, "if (!scPlayback || !isScenarioPlaybackActive()) return null;"],
  ["U13 barrido también sin frontera", ED, "const sweep = now.frontier && t - now.at < SC_FLOW_SWEEP_MS", "const sweep = (now.frontier || now.onRoute) && t - now.at < SC_FLOW_SWEEP_MS"],
  ["U14 sin fundido (la clase anterior se pierde)", ED, "prev: i > 0 ? inst[i - 1].edges[id] : now.edges[id]", "prev: now.edges[id]"],
  ["U15 el fundido no avanza con el cursor", ED, "const k = i > 0 ? Math.min(1, Math.max(0, (t - now.at) / SC_FLOW_FADE_MS)) : 1;", "const k = 1;"],
  ["U16 pastilla en todos los nodos de la ruta (no solo los no disponibles)", ED, `pips: pg.nodes.filter((n) => now.states[n.id] === "DOWN").map((n) => n.id)`, "pips: d.route.nodes.slice()"],
  ["U17 el fin visible olvida la señal breve de llegada", ED, "FluyoStoryClock.travelMs(meta, ev.stepId) + PB.TERMINAL_MS", "FluyoStoryClock.travelMs(meta, ev.stepId)"],
  ["U18 filas con un solo camino", ED, "if (d.paths && d.paths.total >= 2)", "if (d.paths && d.paths.total >= 1)"],
  ["U19 «+N» mal contado", ED, "const more = d.paths.total - d.paths.paths.length;", "const more = d.paths.total - d.paths.paths.length + 1;"],
  ["U20 cursor también en edición", ED, "cursor: playing ? pct(t) : null,", "cursor: pct(t),"],
  ["U21 la pista se reescribe en cada fotograma", ED, "m.track && Object.assign({}, m.track, { cursor: null })", "m.track"],
  ["U22 la ruta se deriva en cada fotograma (sin memoización)", ED, "m.edges === pg.edges.length && m.nodes === pg.nodes.length) return m.value;", "m.edges === pg.edges.length && m.nodes === pg.nodes.length && false) return m.value;"],
  ["U34 el recuento no exacto vuelve a enseñar un número derivado del tope («+9997 rutas o más»)", ED, `if (!d.paths.exact) rows.push({ state: "", text: W.tooMany, title: "" });`,
    `if (!d.paths.exact) rows.push({ state: "", text: "+" + more + W.more + " o más", title: "" });`],
  ["U35 el recuento no exacto se trata como exacto («+N rutas»)", ED, `    if (!d.paths.exact) rows.push({ state: "", text: W.tooMany, title: "" });\n    else if (more > 0)`, "    if (more > 0)"],
  ["U23 las filas no siguen el instante (siempre el inicio)", ED, "now = tl.instants[FluyoFlow.routeInstantAt(tl, t)];", "now = tl.instants[0];"],
  /* pintor (render.js) */
  ["U24 la funda va ENCIMA de la línea", RD, "  if(flow) drawRouteSleeve(c,e,stroke.line,flow,theme,zoom);\n" + LINE, LINE + "  if(flow) drawRouteSleeve(c,e,stroke.line,flow,theme,zoom);\n"],
  ["U25 el barrido ignora «reducir movimiento»", RD, "if(!s || !(e.id in s.depth) || prefersReducedMotion()) return;", "if(!s || !(e.id in s.depth)) return;"],
  ["U26 sin N3 (dos anillos en el Requisito con la piel)", RD, "if(rs.skinOn && !e.startArrow && !(sem && sem.ring) && typeof skinEdgePort", "if(rs.skinOn && !e.startArrow && typeof skinEdgePort"],
  ["U27 N3 también al exportar (raster ≠ SVG/MCP)", RD, "!(sem && sem.ring) && typeof skinEdgePort", `!(edgeKind(e)==="REQUIRES") && typeof skinEdgePort`],
  ["U28 el halo «respira»", RD, `if(cls==="AVAILABLE"){ c.strokeStyle=K.halo; c.lineWidth=9/zoom+3; }`, `if(cls==="AVAILABLE"){ c.strokeStyle=K.halo; c.lineWidth=9/zoom+3; c.globalAlpha*=0.85+0.15*Math.sin(performance.now()/520); }`],
  ["U29 cualquier conexión recibe funda (Requisito y Conexión incluidas)", RD, "const r=flow.edges && flow.edges[e.id]; if(!r) return;", `const r=(flow.edges && flow.edges[e.id]) || {cls:"AVAILABLE", prev:"AVAILABLE", k:1};`],
  ["U30 la pastilla ignora la piel (caja lógica)", RD, "K=routeMark(theme), X=nodeSkinExtent(n, rs.skinOn);", "K=routeMark(theme), X=null;"],
  ["U31 la funda sale al exportar", RD, "const flow=!isExport && rs.scenarioRuntime && rs.scenarioRuntime.flow;", "const flow=rs.scenarioRuntime && rs.scenarioRuntime.flow;"],
  ["U32 el color de la transición local invertido", RD, `c.strokeStyle=p.to==="DOWN"? K.UNAVAILABLE : K.AVAILABLE;`, `c.strokeStyle=p.to==="DOWN"? K.AVAILABLE : K.UNAVAILABLE;`],
  ["U36 el halo de claro vuelve al oliva al 20 % (se leía gris)", RD, `halo:"rgba(195,205,164,.55)"`, `halo:"rgba(78,90,63,.20)"`],
  ["U33 el pintor de nodo sin `flow` deja de ser el de siempre (marcas sin dato)", RD, "  const f=rs.scenarioRuntime.flow; if(!f) return;", `  const f=rs.scenarioRuntime.flow || {pips:[n.id], pulses:{}};`],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 180000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss4-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  /* la copia no tiene .git: lo que se compara con ae0d619 se lee del árbol real (FLUYO_GIT_ROOT) */
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
console.log((failed ? "\nSCENARIOS-SEMANTICS-001 FASE 4 mutaciones: " + failed + " sin detectar" : "\nSCENARIOS-SEMANTICS-001 FASE 4 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
