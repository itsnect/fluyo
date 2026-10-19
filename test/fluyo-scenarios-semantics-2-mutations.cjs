"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 2 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del núcleo de
   derivación debe hacer fallar test/fluyo-scenarios-semantics-2.test.cjs (vm). Una mutación que cuelga la suite (p. ej. sin control
   de ciclos) muere por tiempo. Uso: node test/fluyo-scenarios-semantics-2-mutations.cjs   (ONLY_MUT=U3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";
const UNIT = ["--test", "test/fluyo-scenarios-semantics-2.test.cjs"];
const F = "js/flow-semantics.js";
const CAPPED = "const capped=(adj,s,t,pass)=>{ let n=0, ok=false; const seen=new Set([s]); (function w(a,good){ if(ok||n>=64) return; if(a===t){ n++; if(good) ok=true; return; }" +
  " for(const x of adj.get(a)||[]){ if(seen.has(x)) continue; seen.add(x); w(x, good&&pass(x)); seen.delete(x); } })(s, pass(s)); return ok; };\n    ";
/* [nombre, desde, hasta] — todas en js/flow-semantics.js */
const MUTATIONS = [
  ["U1 la Conexión genérica entra en la derivación", "      if(edgeKind(e) !== FLOWS_TO) continue;", '      if(edgeKind(e) === "REQUIRES") continue;'],
  ["U2 el Requisito entra en la derivación", "      if(edgeKind(e) !== FLOWS_TO) continue;", "      if(edgeKind(e) === EDGE_KIND_GENERIC) continue;"],
  ["U3 se ignora el estado del origen", "    if(!pass(source)) return false;\n", ""],
  ["U4 se ignora el estado del destino", "        if(!pass(n)) continue;", "        if(!pass(n) && n !== target) continue;"],
  ["U5 solo el primer camino (la primera salida de cada nodo)", "      for(const n of adj.get(at) || []){", "      for(const n of (adj.get(at) || []).slice(0, 1)){"],
  ["U6 tope de 64 caminos (enumeración del prototipo)", "    if(reaches(adj, source, target, id => states[id] === UP)) return {status: AVAILABLE, adj};",
    "    " + CAPPED + "if(capped(adj, source, target, id => states[id] === UP)) return {status: AVAILABLE, adj};"],
  ["U7 sin control de ciclos (se revisitan nodos)", "        if(seen.has(n)) continue;\n", ""],
  ["U8 el defecto se trata como no disponible", "    for(const n of page.nodes) s[n.id] = UP;", "    for(const n of page.nodes) s[n.id] = DOWN;"],
  ["U9 una afirmación del mismo valor no cuenta como EXPLICIT", "      if(when(st) <= t) p[st.nodeId] = EXPLICIT;",
    "      if(when(st) <= t){ const c = availabilityProvenance.__c = availabilityProvenance.__c || {}; if(st.state !== (c[st.nodeId] || UP)) p[st.nodeId] = EXPLICIT; c[st.nodeId] = st.state; }"],
  ["U10 UNKNOWN (y lo mal formado) se coacciona", '    if(v !== UP && v !== DOWN) throw flowError("invalid_availability", String(nodeId));\n    return v;', "    return v === DOWN ? DOWN : UP;"],
  ["U11 NO_PATH se confunde con UNAVAILABLE", "    if(!reaches(adj, source, target, () => true)) return {status: NO_PATH, adj};", "    if(!reaches(adj, source, target, () => true)) return {status: UNAVAILABLE, adj};"],
  ["U12 source == target da NO_PATH", "    const adj = flowGraph(page, ids);\n    if(!reaches(", "    const adj = flowGraph(page, ids);\n    if(source === target) return {status: NO_PATH, adj};\n    if(!reaches("],
  ["U13 la dirección no cuenta (from ↔ to)", "      adj.get(e.from).push(e.to);", "      adj.get(e.from).push(e.to); if(!adj.has(e.to)) adj.set(e.to, []); adj.get(e.to).push(e.from);"],
  ["U14 explicitPath ignora la procedencia", "id => states[id] === UP && provenance[id] === EXPLICIT)", "id => states[id] === UP)"],
  ["U15 un Behavior no cuenta como EXPLICIT", "      availabilityValue(b.initialState, b.nodeId);\n      p[b.nodeId] = EXPLICIT;", "      availabilityValue(b.initialState, b.nodeId);"],
  ["U16 availabilityAt excluye el instante t", "      if(!(ev.at <= t)) continue;", "      if(!(ev.at < t)) continue;"],
  ["U17 un estado ausente se adivina", "    for(const n of page.nodes) availabilityValue(own(states, n.id) ? states[n.id] : undefined, n.id);", "    for(const n of page.nodes) if(own(states, n.id)) availabilityValue(states[n.id], n.id);"],
  ["U18 una conexión FLOWS_TO colgante se ignora", '      if(!ids.has(e.from) || !ids.has(e.to)) throw flowError("missing_edge_endpoint", "edges");', "      if(!ids.has(e.from) || !ids.has(e.to)) continue;"],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 60000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM", out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss2-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-2000)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, F);
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
console.log((failed ? "\nSCENARIOS-SEMANTICS-001 FASE 2 mutaciones: " + failed + " sin detectar" : "\nSCENARIOS-SEMANTICS-001 FASE 2 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
