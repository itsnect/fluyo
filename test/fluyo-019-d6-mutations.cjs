"use strict";
/* FLUYO-019-HIT-TEST-D6 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de las capas de pintado
   con la piel (o un cambio colado en el plano) debe hacer fallar su suite:
   · U*: test/fluyo-019-d6.test.cjs (vm, ~2 s).
   · B*: test/fluyo-019-d6-browser.cjs en Chrome real, con la base (~15 s).
   Uso: node test/fluyo-019-d6-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-d6.test.cjs"];
const BROWSER = ["test/fluyo-019-d6-browser.cjs"];
const REN = "js/render.js", GEO = "js/geometry.js", EXP = "js/export.js";
/* FLUYO-019.4b: la regla vive en nodePaintLayers (render.js), que comparten render() y el acierto */
const LAYERS = "  return skinOn ? containmentPaintOrder(nodes, skinPaintOrder) : {containers:[], leaves:nodes};";
const NO_LAYERS = [LAYERS, "  return skinOn ? {containers:[], leaves:skinPaintOrder(nodes)} : {containers:[], leaves:nodes};"];     // vuelve «conexiones bajo todos los nodos» (el bug)
const FLAT_TOO = [LAYERS, "  return containmentPaintOrder(nodes, skinOn ? skinPaintOrder : (ns=>ns.slice()));"];                       // capas también en plano
const BY_Y = ["  const walk=c=>{ containers.push(c); for(const k of order(conts.filter(k=>parent.get(k)===c))) walk(k); };\n  for(const r of order(conts.filter(c=>parent.get(c)===null))) walk(r);", "  containers.push(...order(conts));"];   // contenedores solo por y, sin árbol
const BIGGEST = ["if(!best || o.w*o.h<best.w*best.h ||", "if(!best || o.w*o.h>best.w*best.h ||"];                                  // padre = el mayor, no el más interior
const DOC_LEAVES = ["  return {containers, leaves:order(nodes.filter(n=>!isCont.has(n)))};", "  return {containers, leaves:nodes.filter(n=>!isCont.has(n))};"];   // hojas sin el pintor de la piel
const NO_CONT = ["  const conts=nodes.filter(n=>isContainerNode(n,nodes)),", "  const conts=nodes.filter(n=>false),"];                         // nadie es contenedor
const SVG_FLAT = ["  const lay=skinOn? containmentPaintOrder(page.nodes||[], skinPaintOrder) : {containers:[], leaves:page.nodes||[]};", "  const lay=skinOn? {containers:[], leaves:skinPaintOrder(page.nodes||[])} : {containers:[], leaves:page.nodes||[]};"];   // SVG sin capas
const BALLS_LAST = ["  if(!rs.scenarioRuntime) drawFlowBalls(c,t,rs);\n  for(const n of lay.leaves) drawNode(c,n,t,theme,isExport,rs);", "  for(const n of lay.leaves) drawNode(c,n,t,theme,isExport,rs);\n  if(!rs.scenarioRuntime) drawFlowBalls(c,t,rs);"];   // flujo encima de las hojas
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v90)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v96";', 'const CACHE = "fluyo-static-v90";'],
  ["U1 vuelve «conexiones bajo todos los nodos» con la piel", UNIT, REN, ...NO_LAYERS],
  ["U2 capas también en plano", UNIT, REN, ...FLAT_TOO],
  ["U3 contenedores solo por y (sin árbol)", UNIT, GEO, ...BY_Y],
  ["U4 padre = el contenedor mayor", UNIT, GEO, ...BIGGEST],
  ["U5 hojas en orden de documento", UNIT, GEO, ...DOC_LEAVES],
  ["U6 nadie es contenedor", UNIT, GEO, ...NO_CONT],
  ["U7 SVG sin capas", UNIT, EXP, ...SVG_FLAT],
  ["U8 el flujo se pinta encima de las hojas", UNIT, REN, ...BALLS_LAST],
  ["B1 vuelve «conexiones bajo todos los nodos» con la piel", BROWSER, REN, ...NO_LAYERS],
  ["B2 capas también en plano", BROWSER, REN, ...FLAT_TOO],
  ["B3 contenedores solo por y (sin árbol)", BROWSER, GEO, ...BY_Y],
  ["B4 hojas en orden de documento", BROWSER, GEO, ...DOC_LEAVES],
  ["B5 nadie es contenedor", BROWSER, GEO, ...NO_CONT],
  ["B6 SVG sin capas", BROWSER, EXP, ...SVG_FLAT],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 600000 : 180000,
    env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-d6-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER)).filter((m) => { const o = process.env.ONLY_MUT; if (!o) return true; const id = m[0].split(" ")[0]; return id === o || (/^[UB]$/.test(o) && id[0] === o); });
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const suites = [UNIT, ...(list.some((m) => m[1] === BROWSER) ? [BROWSER] : [])];
  for (const args of suites) {
    const sane = runSuite(base, args);
    if (sane.code !== 0) { console.error("La copia sin mutar NO pasa " + args.join(" ") + ":\n" + sane.out.slice(-2000)); process.exit(2); }
  }
  console.log("copia sin mutar: suites OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, args, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir, args);
    if (r.code !== 0) console.log("  ✔ " + name + " — la suite falla, como debe");
    else { console.log("  ✘ " + name + " — la suite SIGUE PASANDO"); failed++; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`\n${list.length - failed}/${list.length} mutaciones detectadas (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failed ? 1 : 0);
