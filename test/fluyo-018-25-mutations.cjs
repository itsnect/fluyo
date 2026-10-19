"use strict";
/* FLUYO-018.25 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «la ruta que se dobla sola»
   debe hacer fallar su suite:
   · U*: test/fluyo-018-25.test.cjs (vm y estático, ~3 s).
   · B*: test/fluyo-018-25-browser.cjs en Chrome real, solo d1440 (~9 s).
   El port del MCP (src/svg.ts) lo vigila allí la paridad vértice a vértice (visual-regression.test.ts, «rutas en U»).
   Uso: node test/fluyo-018-25-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-25.test.cjs"];
const BROWSER = ["test/fluyo-018-25-browser.cjs"];
const U_MID = ["else if(d1.y!==0 && d2.y!==0){ mids=zy(d1.y===d2.y? enU(d1.y,s.y,t.y) : medio(s.y,t.y)); }", "else if(d1.y!==0 && d2.y!==0){ mids=zy(medio(s.y,t.y)); }"];
const U_INWARD = ["canal=(DIR[s1].x||DIR[s1].y)*m;", "canal=-(DIR[s1].x||DIR[s1].y)*m;"];
const U_OPPOSITE = ["mids=zy(d1.y===d2.y? enU(d1.y,s.y,t.y)", "mids=zy(true? enU(d1.y,s.y,t.y)"];
const H_IDENTITY = ["  return pts.filter((p,i)=> i<=1 || i>=n-2 || gira(pts[i-1],p,pts[i+1]));", "  return pts.slice();"];
const H_NO_PADS = ["i<=1 || i>=n-2 || gira(", "i===0 || i===n-1 || gira("];
const L_SYMMETRIC = ["offs:sib.map((e,k)=>k? sg*alt(k)*g : 0)})", "offs:sib.map((e,k)=>(k-(n-1)/2)*g)})"];
const L_BY_PAIR = ["return par.filter(o=>o===e || trackKey(o)===k).sort((a,b)=>a.id-b.id);", "return par.sort((a,b)=>a.id-b.id);"];
const L_NO_ID_ORDER = ["return par.filter(o=>o===e || trackKey(o)===k).sort((a,b)=>a.id-b.id);", "return par.filter(o=>o===e || trackKey(o)===k);"];
const L_NO_DEFECTS = ["cands.sort((a,b)=>a.def-b.def || a.fam-b.fam", "cands.sort((a,b)=>a.fam-b.fam"];
const L_NOT_MINIMAL = ["const g=n>1? Math.min(LANE_MIN,(hi-lo)/(n-1)) : 0;", "const g=n>1? Math.min(PARALLEL_SEP,(hi-lo)/(n-1)) : 0;"];
const P2_NO_SHORT_PADS = ["  if(deFrente && hueco>0 && hueco<2*pad) pad=hueco/2;\n", ""];
const P2_NO_CLAMP = ["return deFrente && hueco>0 ? clamp(c, Math.min(a,b), Math.max(a,b)) : c;", "return c;"];
const DOTS_NO_CAP = ["function flowDotCount(n,L){ return clamp(Math.floor(L/FLOW_DOT_SEP),1,n); }", "function flowDotCount(n,L){ return n; }"];
const DOTS_SEP12 = ["const FLOW_DOT_SEP=24;", "const FLOW_DOT_SEP=12;"];
const DOTS_UNUSED = ["const n=flowDotCount(edgeDots(e), polyLen(pts));", "const n=edgeDots(e);"];
const EAGER_UNDO = ["    if(mi>=0){\n      routePending=", "    if(mi>=0){ pushUndo();\n      routePending="];
const ESC_UNDO = ["if(segDrag){ segDrag=null; undo(); }", "segDrag=null; undo();"];
const NO_F4 = [" if(e.route===\"ortho\" && (e.waypoints||[]).length && routeIsStraight(edgePoints(e))) e.waypoints=[];", ""];
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v82)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v90";', 'const CACHE = "fluyo-static-v82";'],
  ["U1 la U vuelve al punto medio (n/s)", UNIT, "js/geometry.js", ...U_MID],
  ["U2 los carriles de una U van hacia dentro", UNIT, "js/geometry.js", ...U_INWARD],
  ["U3 la regla de la U también con lados que se miran", UNIT, "js/geometry.js", ...U_OPPOSITE],
  ["U4 handleRoute no quita los vértices sin giro", UNIT, "js/geometry.js", ...H_IDENTITY],
  ["U5 handleRoute no conserva los pasillos", UNIT, "js/geometry.js", ...H_NO_PADS],
  ["U6 carriles simétricos otra vez (la primera se mueve)", UNIT, "js/geometry.js", ...L_SYMMETRIC],
  ["U7 hermanas por par de nodos, no por canal", UNIT, "js/geometry.js", ...L_BY_PAIR],
  ["U8 el carril 0 lo decide el orden del documento, no el id", UNIT, "js/geometry.js", ...L_NO_ID_ORDER],
  ["U9 la elección ignora los defectos (nodo ajeno en el carril)", UNIT, "js/geometry.js", ...L_NO_DEFECTS],
  ["U10 la recolocación no es la mínima", UNIT, "js/geometry.js", ...L_NOT_MINIMAL],
  ["U11 los pasillos no se acortan entre caras cercanas", UNIT, "js/geometry.js", ...P2_NO_SHORT_PADS],
  ["U12 el canal de un carril no se acota entre los pasillos", UNIT, "js/geometry.js", ...P2_NO_CLAMP],
  ["U13 sin tope de puntos en conexiones cortas", UNIT, "js/render.js", ...DOTS_NO_CAP],
  ["U14 separación mínima de puntos 12 en vez de 24", UNIT, "js/render.js", ...DOTS_SEP12],
  ["U15 el lienzo no usa flowDotCount", UNIT, "js/render.js", ...DOTS_UNUSED],
  ["B1 hermanas por par: la captura mueve la directa", BROWSER, "js/geometry.js", ...L_BY_PAIR],
  ["B2 los pasillos no se acortan: el vídeo vuelve atrás", BROWSER, "js/geometry.js", ...P2_NO_SHORT_PADS],
  ["B4 dos barras en una recta", BROWSER, "js/geometry.js", ...H_IDENTITY],
  ["B6 agarrar una barra vuelve a apilar Undo", BROWSER, "js/interaction.js", ...EAGER_UNDO],
  ["B7 Escape deshace aunque no hubiera gesto", BROWSER, "js/interaction.js", ...ESC_UNDO],
  ["B8 volver a la recta deja waypoints", BROWSER, "js/interaction.js", ...NO_F4],
];

/* el árbol entero (salvo .git): el alcance y el Service Worker necesitan todo lo que se sirve */
function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 300000 : 120000, env: { ...process.env, ONLY: browser ? "d1440" : "", FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-25-mut-"));
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
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok |^\s+✘ /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " comprobaciones fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log((failed ? "\nFLUYO-018.25 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.25 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
