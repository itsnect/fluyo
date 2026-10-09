"use strict";
/* FLUYO-018.16 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto plausible debe hacer fallar su suite:
   · U*: test/fluyo-018-16.test.cjs (estático + vm, rápido).
   · B*: test/fluyo-018-16-browser.cjs en Chrome real, solo el viewport indicado (ONLY=…).
   Las de divergencia del lado del MCP viven en fluyo-mcp/scripts/mutate-018-16.ts.
   Uso: node test/fluyo-018-16-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-16.test.cjs"];
const BROWSER = ["test/fluyo-018-16-browser.cjs"];
const LINE = "  c.strokeStyle=lineCol; c.lineWidth=EDGE_W;";
const RECOLOR = "  c.strokeStyle=seld? M.ink:lineCol; c.lineWidth=seld?2.6:EDGE_W;";
const HOST_TOUCH = '  if(typeof isTouch==="function" && isTouch()) return null;\n  const n=hoverNode;';
const HOST_OLD = '  const s=singleSel(); const n=hoverNode || ((s && s.type==="node") ? s.obj : null);';
const MUTATIONS = [
  ["U1 CACHE no sube", UNIT, "sw.js", 'const CACHE = "fluyo-static-v75";', 'const CACHE = "fluyo-static-v74";'],
  ["U2 vuelve la punta antigua (12 × 12, pegada al borde)", UNIT, "js/geometry.js", "EDGE_GAP=3, EDGE_HEAD_LEN=11, EDGE_HEAD_HALF=4,", "EDGE_GAP=0, EDGE_HEAD_LEN=12, EDGE_HEAD_HALF=6,"],
  ["U3 vuelve el cian en la funda", UNIT, "js/render.js", 'sleeve:"rgba(195,205,164,.26)"', 'sleeve:"rgba(58,167,232,.26)"'],
  ["U4 la selección vuelve a recolorear la línea", UNIT, "js/render.js", LINE, RECOLOR],
  ["U5 el SVG vuelve a <marker>", UNIT, "js/export.js", "  for(const h of stroke.heads) parts.push(", "  parts[0]=parts[0].replace('/>',' marker-end=\"url(#fluyo-arrow-end)\"/>');\n  for(const h of stroke.heads) parts.push("],
  ["U6 el puerto vuelve en táctil", UNIT, "js/interaction.js", "  if(!n || isTouch()) return null;", "  if(!n) return null;"],
  ["U7 acierto de arista en unidades de mundo", UNIT, "js/interaction.js", "function edgeHitTol(){ return Math.max(8, (isTouch()? 16 : 6)/viewZoom); }", "function edgeHitTol(){ return 8; }"],
  ["U8 instrumentos en unidades de mundo", UNIT, "js/render.js", "    const px=v=>v/zoom;", "    const px=v=>v;"],
  ["U9 la selección vuelve a sacar el puerto", UNIT, "js/selection.js", "  const n=hoverNode;", HOST_OLD],
  ["B1 divergencia SVG/editor (el exportador dibuja otro grosor)", BROWSER, "js/export.js", 'stroke-width="${EDGE_W}"', 'stroke-width="2"', "d1440"],
  ["B2 divergencia MCP/editor (otra geometría en la app)", BROWSER, "js/geometry.js", "EDGE_CORNER=8,", "EDGE_CORNER=6,", "d1440"],
  ["B3 pérdida del color explícito", BROWSER, "js/render.js", "  const lineCol=e.lineColor||T.edge;\n  /* marcas del editor", "  const lineCol=T.edge;\n  /* marcas del editor", "d1440"],
  ["B4 vuelve el cian (funda en lienzo claro y crema)", BROWSER, "js/render.js", 'sleeve:"rgba(78,90,63,.20)"},\n  claro:', 'sleeve:"rgba(58,167,232,.30)"},\n  claro:', "d1440"],
  ["B5 codo invisible con la conexión seleccionada", BROWSER, "js/render.js", "    (e.waypoints||[]).forEach(wp=>{\n      const s=px(7);", "    ([]).forEach(wp=>{\n      const s=px(7);", "d1440"],
  ["B6 la conexión deja de ser seleccionable", BROWSER, "js/interaction.js", "      if(d<tol) return es[i];", "      if(d<0) return es[i];", "t768"],
  ["B7 conectar con ratón deja de funcionar", BROWSER, "js/interaction.js", "    connectDrag={fromId:host.id, fromSide:arrowSide};", "    connectDrag=null;", "d1440"],
  ["B8 «Conectar» táctil deja de funcionar", BROWSER, "js/interaction.js", "        const e=newEdge(touchLink,n.id);", "        const e=null;", "t768"],
  ["B9 instrumentos en unidades de mundo", BROWSER, "js/render.js", "    const px=v=>v/zoom;", "    const px=v=>v;", "d1440"],
  ["B10 la selección vuelve a recolorear la línea", BROWSER, "js/render.js", LINE, RECOLOR, "d1440"],
  ["B11 el puerto vuelve con el dedo (y con la selección)", BROWSER, "js/selection.js", HOST_TOUCH, HOST_OLD, "t768"],
  ["B12 el acierto de arista vuelve a 8 u de mundo (ratón a zoom bajo)", BROWSER, "js/interaction.js", "function edgeHitTol(){ return Math.max(8, (isTouch()? 16 : 6)/viewZoom); }", "function edgeHitTol(){ return 8; }", "d1440"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "assets", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "docs", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 900000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-16-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sanity = [[UNIT, ""], ...[...new Set(list.filter((m) => m[1] === BROWSER).map((m) => m[5]))].map((o) => [BROWSER, o])];
  for (const [args, only] of sanity) {
    const sane = runSuite(base, args, only);
    if (sane.code !== 0) { console.error("La copia sin mutar NO pasa " + args.join(" ") + " " + only + ":\n" + sane.out.slice(-2000)); process.exit(2); }
  }
  console.log("copia sin mutar: suites OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, args, file, from, to, only], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, text.replace(from, () => to).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir, args, only);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok |^\s+✘ /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " comprobaciones fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `\nFLUYO-018.16 mutaciones: ${failed} sin detectar u obsoletas` : `\nFLUYO-018.16 mutaciones: ${list.length}/${list.length} detectadas`);
process.exit(failed ? 1 : 0);
