"use strict";
/* SCENARIOS-SEMANTICS-001 · FASE 1 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del modelo de
   conexión semántica, del selector o de las marcas debe hacer fallar test/fluyo-scenarios-semantics-1.test.cjs (vm, ~1 s).
   Uso: node test/fluyo-scenarios-semantics-1-mutations.cjs   (ONLY_MUT=U3 una sola) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-scenarios-semantics-1.test.cjs"];
const MOD = "js/model.js", GEO = "js/geometry.js", REN = "js/render.js", UI = "js/ui.js", HTML = "index.html";
/* [nombre, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v93)", "sw.js", 'const CACHE = "fluyo-static-v119";', 'const CACHE = "fluyo-static-v93";'],
  ["U1 la carga rellena kind ausente con GENERIC (migra documentos)", MOD,
    '  if(e.kind===null || (e.kind!==undefined && typeof e.kind!=="string")) delete e.kind;',
    '  if(e.kind===undefined) e.kind="GENERIC";\n  if(e.kind===null || (e.kind!==undefined && typeof e.kind!=="string")) delete e.kind;'],
  ["U2 la carga borra un kind desconocido (pierde valores futuros)", MOD,
    '  if(e.kind===null || (e.kind!==undefined && typeof e.kind!=="string")) delete e.kind;',
    '  if(e.kind!==undefined && e.kind!=="FLOWS_TO" && e.kind!=="REQUIRES") delete e.kind;'],
  ["U3 la carga conserva kind no-texto", MOD,
    '  if(e.kind===null || (e.kind!==undefined && typeof e.kind!=="string")) delete e.kind;', '  if(e.kind===null) delete e.kind;'],
  ["U4 edgeKind lee cualquier texto como semántica", MOD,
    '  return k==="FLOWS_TO" || k==="REQUIRES" ? k : EDGE_KIND_GENERIC;', '  return typeof k==="string" ? k : EDGE_KIND_GENERIC;'],
  ["U5 la autoría acepta \"GENERIC\"", MOD,
    '  if(v!==null && !EDGE_KINDS.includes(v)) throw projectDataError("invalid_document","kind");',
    '  if(v!==null && v!=="GENERIC" && !EDGE_KINDS.includes(v)) throw projectDataError("invalid_document","kind");'],
  ["U6 create_connection no valida kind", MOD, "  if(spec.kind!==undefined) authoringKind(spec.kind);\n", ""],
  ["U7 kind fuera de las claves de parche", MOD, '"dotColor","speedFac","dots","dotsGlobal","arrowSize","kind"]);', '"dotColor","speedFac","dots","dotsGlobal","arrowSize"]);'],
  ["U8 el selector guarda GENERIC en vez de quitar la clave", UI, "editEdge(e,{kind: v===EDGE_KIND_GENERIC ? null : v})", "editEdge(e,{kind: v})"],
  ["U9 el selector no apila Undo", UI, "  pushUndo(); editEdge(e,{kind: v===EDGE_KIND_GENERIC ? null : v});", "  editEdge(e,{kind: v===EDGE_KIND_GENERIC ? null : v});"],
  ["U10 el selector reescribe el valor actual", UI, "  if(edgeKind(e)===v) return;\n  pushUndo(); editEdge(e,{kind:", "  pushUndo(); editEdge(e,{kind:"],
  /* FASE 6 (decisión 253): la bandera se retiró; U11 y U19 vuelven a ponerla (la regresión ahora es esa) y U12 (?labs=off) ya no tiene objeto */
  ["U11 el selector vuelve a depender de la bandera", UI, '$("rowKind").style.display=isNode ? "none" : "flex";', '$("rowKind").style.display=!isNode && typeof LABS_SEMANTICS!=="undefined" && LABS_SEMANTICS ? "flex" : "none";'],
  ["U13 la fila «Semántica» se ve sin conexión (oculta por defecto)", HTML, '          <div class="row" id="rowKind" data-stack style="display:none">', '          <div class="row" id="rowKind" data-stack>'],
  ["U14 las cuñas siguen las puntas visibles", GEO, "  const kind=edgeKind(e);\n  if(kind===EDGE_KIND_GENERIC || !pts || pts.length<2) return null;",
    "  const kind=edgeKind(e);\n  if(kind===EDGE_KIND_GENERIC || !pts || pts.length<2) return null;\n  if(e.startArrow && e.endArrow===false) pts=pts.slice().reverse();"],
  ["U14b las cuñas eligen un trozo de pasillo (no se unen tramos colineales)", GEO,
    "        if(Math.abs(dx*ey-dy*ex)>1e-6 || dx*ex+dy*ey<0) break;", "        break;"],
  ["U15 el anillo ignora la punta de inicio", GEO, "  const behindHead=e.startArrow ? EDGE_GAP + EDGE_HEAD_LEN*edgeArrowSize(e) : 0;", "  const behindHead=0;"],
  ["U16 la conexión desconocida pinta marcas", GEO, "  if(kind===EDGE_KIND_GENERIC || !pts || pts.length<2) return null;", "  if(!e.kind || !pts || pts.length<2) return null;"],
  /* SCENARIOS-SEMANTICS-001 FASE 5 (decisión 247): las marcas salen al exportar; U17 es ahora la vuelta a «sin marcas al exportar» */
  ["U17 al exportar vuelven a faltar las marcas", REN, "  const sem=typeof edgeSemanticMarks===", "  const sem=!isExport && typeof edgeSemanticMarks==="],
  ["U18 el Requisito se pinta discontinuo", REN, '  c.strokeStyle=lineCol; c.lineWidth=1.6; c.lineCap="round"; c.lineJoin="round"; c.setLineDash([]);',
    '  c.strokeStyle=lineCol; c.lineWidth=1.6; c.lineCap="round"; c.lineJoin="round"; c.setLineDash(sem.ring?[4,4]:[]);'],
  /* W5 (C3 de la revisión del PO) */
  ["U19 el aviso W5 vuelve a depender de la bandera", UI, '$("kindNote").hidden=!flowArrowReversed(e);', '$("kindNote").hidden=!(LABS_SEMANTICS && flowArrowReversed(e));'],
  ["U20 el aviso W5 también en Requisito", UI, 'edgeKind(e)==="FLOWS_TO" && arrowsOf(e)==="start"', 'edgeKind(e)!==EDGE_KIND_GENERIC && arrowsOf(e)==="start"'],
  ["U21 el aviso W5 con dos puntas", UI, 'edgeKind(e)==="FLOWS_TO" && arrowsOf(e)==="start"', 'edgeKind(e)==="FLOWS_TO" && !!e.startArrow'],
  ["U22 el aviso W5 no se resincroniza al cambiar las puntas", UI, "syncKindNote(e); syncArrowSizeSeg(e); }", "syncArrowSizeSeg(e); }"],
  ["U23 el aviso W5 invierte origen y destino", UI, 'function syncKindNote(e){ $("kindNote")',
    'function syncKindNote(e){ if(flowArrowReversed(e)){ const t=e.from; e.from=e.to; e.to=t; } $("kindNote")'],
  ["U24 el aviso W5 se ve sin motivo (oculto por defecto)", HTML, '          <p class="hint rowNote" id="kindNote" role="status" hidden data-i18n="prop.kindNote">', '          <p class="hint rowNote" id="kindNote" role="status" data-i18n="prop.kindNote">'],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, UNIT, { cwd: dir, encoding: "utf8", timeout: 120000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-ss1-mut-"));
const list = MUTATIONS.filter((m) => !process.env.ONLY_MUT || m[0].split(" ")[0] === process.env.ONLY_MUT);
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa:\n" + sane.out.slice(-2000)); process.exit(2); }
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
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " comprobaciones fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log((failed ? "\nSCENARIOS-SEMANTICS-001 FASE 1 mutaciones: " + failed + " sin detectar" : "\nSCENARIOS-SEMANTICS-001 FASE 1 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
