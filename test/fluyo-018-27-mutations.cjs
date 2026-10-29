"use strict";
/* FLUYO-018.27 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del tamaño de las puntas debe hacer
   fallar su suite:
   · U*: test/fluyo-018-27.test.cjs (vm y estático, ~1 s).
   · B*: test/fluyo-018-27-browser.cjs en Chrome real, solo d1440 (~4 s).
   El port del MCP (src/svg.ts) lo vigilan allí fluyo-018-27.test.ts y la paridad (visual-regression.test.ts); sus mutaciones,
   fluyo-mcp/scripts/mutate-018-27.ts.
   Uso: node test/fluyo-018-27-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-27.test.cjs"];
const BROWSER = ["test/fluyo-018-27-browser.cjs"];   // B1–B4
const GEO = "js/geometry.js", MODEL = "js/model.js", UI = "js/ui.js";
const IGNORE = ["const n=line.length, size=edgeArrowSize(e), cut=", "const n=line.length, size=1, cut="];
const INVERT = ["return Number.isFinite(k) ? Math.min(ARROW_SIZE_MAX, Math.max(ARROW_SIZE_MIN, k)) : 1; }", "return Number.isFinite(k) ? 1/Math.min(ARROW_SIZE_MAX, Math.max(ARROW_SIZE_MIN, k)) : 1; }"];
const ONLY_LEN = ["const s=size||1, len=EDGE_HEAD_LEN*s, half=EDGE_HEAD_HALF*s, k=(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH)*s;", "const s=size||1, len=EDGE_HEAD_LEN*s, half=EDGE_HEAD_HALF, k=(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH)*s;"];
const ONLY_WIDTH = ["const s=size||1, len=EDGE_HEAD_LEN*s, half=EDGE_HEAD_HALF*s, k=(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH)*s;", "const s=size||1, len=EDGE_HEAD_LEN, half=EDGE_HEAD_HALF*s, k=(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH);"];
const NOTCH_FIXED = ["const s=size||1, len=EDGE_HEAD_LEN*s, half=EDGE_HEAD_HALF*s, k=(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH)*s;", "const s=size||1, len=EDGE_HEAD_LEN*s, half=EDGE_HEAD_HALF*s, k=len-EDGE_HEAD_NOTCH;"];
const TIP_MOVES = ["      const z=pts[n-1], tip={x:z.x-u.x*EDGE_GAP, y:z.y-u.y*EDGE_GAP};\n      out.heads.push(edgeHeadSegs(tip,u,size));\n      trim(n-1, n-2, cut);", "      const z=pts[n-1], tip={x:z.x-u.x*EDGE_GAP*size, y:z.y-u.y*EDGE_GAP*size};\n      out.heads.push(edgeHeadSegs(tip,u,size));\n      trim(n-1, n-2, cut);"];
const TRIM_FIXED = ["cut=EDGE_GAP+(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH)*size;", "cut=EDGE_GAP+(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH);"];
const START_IGNORES = ["      out.heads.push(edgeHeadSegs(tip,u,size));\n      trim(0, 1, cut);", "      out.heads.push(edgeHeadSegs(tip,u,1));\n      trim(0, 1, cut);"];
const ROUTE_DEPENDS = ["function edgePoints(e){", "function edgePoints(e){ if(e && e.arrowSize>1) e=Object.assign({}, e, {waypoints:[]});"];
const SPEC_DROPS = ['"fs","speedFac","dots","dotsGlobal","arrowSize"]);', '"fs","speedFac","dots","dotsGlobal"]);'];
const UPDATE_DROPS = ['"dotColor","speedFac","dots","dotsGlobal","arrowSize"]);', '"dotColor","speedFac","dots","dotsGlobal"]);'];
const LOAD_DROPS = ["  else if(e.arrowSize!==undefined) e.arrowSize=clamp(projectNumber(e.arrowSize,1),1,2);", "  else if(e.arrowSize!==undefined) delete e.arrowSize;"];
const LOAD_MIGRATES = ["  if(e.arrowSize===null) delete e.arrowSize;\n  else if(e.arrowSize!==undefined)", "  if(e.arrowSize===null) delete e.arrowSize;\n  else if(e.arrowSize===undefined) e.arrowSize=1;\n  else"];
const NO_CLAMP = ["e.arrowSize=clamp(projectNumber(e.arrowSize,1),1,2);", "e.arrowSize=projectNumber(e.arrowSize,1);"];
const STRING_OK = ['const UPDATE_NUMBERS=new Set(["speedFac","dots","arrowSize"]);', 'const UPDATE_NUMBERS=new Set(["speedFac","dots"]);'];
const CLONE_DROPS = ["    const c=deep(e); c.id=nextId++;\n    c.from=map[e.from]; c.to=map[e.to];", "    const c=deep(e); c.id=nextId++; delete c.arrowSize;\n    c.from=map[e.from]; c.to=map[e.to];"];
const UI_NO_UNDO = ["  pushUndo(); editEdge(e,{arrowSize:v}); scheduleAutosave(); syncArrowSizeSeg(e);", "  editEdge(e,{arrowSize:v}); scheduleAutosave(); syncArrowSizeSeg(e);"];
const UI_ALWAYS_WRITES = ["  if(edgeArrowSize(e)===v) return;\n  pushUndo();", "  pushUndo();"];
const UI_NO_SYNC = ['function syncArrowSeg(e){ const v=arrowsOf(e); segSync("arrowSeg", v); $("arrowsValue").textContent=ARROW_NAMES[v]; syncArrowSizeSeg(e); }', 'function syncArrowSeg(e){ const v=arrowsOf(e); segSync("arrowSeg", v); $("arrowsValue").textContent=ARROW_NAMES[v]; }'];
const RENDER_ZOOM = ["  for(const h of stroke.heads){ c.beginPath(); traceSegments(c,h); c.fill(); }", "  for(const h of stroke.heads){ c.save(); c.translate(h[0].x,h[0].y); c.scale(1/zoom,1/zoom); c.translate(-h[0].x,-h[0].y); c.beginPath(); traceSegments(c,h); c.fill(); c.restore(); }"];
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v85)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v118";', 'const CACHE = "fluyo-static-v85";'],
  ["U1 edgeStroke ignora arrowSize", UNIT, GEO, ...IGNORE],
  ["U2 la escala se invierte (2× = la mitad)", UNIT, GEO, ...INVERT],
  ["U3 solo escala el largo", UNIT, GEO, ...ONLY_LEN],
  ["U4 solo escala el ancho", UNIT, GEO, ...ONLY_WIDTH],
  ["U5 la muesca no escala (proporción rota)", UNIT, GEO, ...NOTCH_FIXED],
  ["U6 la punta se aleja del ancla con el tamaño", UNIT, GEO, ...TIP_MOVES],
  ["U7 la línea no se recorta hasta la muesca (asoma bajo la punta)", UNIT, GEO, ...TRIM_FIXED],
  ["U8 la punta del inicio ignora el tamaño", UNIT, GEO, ...START_IGNORES],
  ["U9 el tamaño cambia la ruta", UNIT, GEO, ...ROUTE_DEPENDS],
  ["U10 crear rechaza arrowSize (fuera de CONNECTION_SPEC_KEYS)", UNIT, MODEL, ...SPEC_DROPS],
  ["U11 editar rechaza arrowSize (fuera de CONNECTION_UPDATE_KEYS)", UNIT, MODEL, ...UPDATE_DROPS],
  ["U12 la carga pierde arrowSize", UNIT, MODEL, ...LOAD_DROPS],
  ["U13 la carga migra (rellena arrowSize:1)", UNIT, MODEL, ...LOAD_MIGRATES],
  ["U14 sin acotar en [1, 2]", UNIT, MODEL, ...NO_CLAMP],
  ["U15 un parche con string se acepta", UNIT, MODEL, ...STRING_OK],
  ["U16 pegar/duplicar pierden arrowSize", UNIT, MODEL, ...CLONE_DROPS],
  ["U17 el panel escribe sin Undo", UNIT, UI, ...UI_NO_UNDO],
  /* por la UI es inobservable: segBind ya ignora el clic en la opción marcada (018.23); la guarda protege el onchange programático */
  ["U18 el manejador escribe aunque el valor no cambie", UNIT, UI, ...UI_ALWAYS_WRITES],
  ["B1 el panel escribe sin Undo", BROWSER, UI, ...UI_NO_UNDO],
  ["B3 refreshPanel no sincroniza el segmentado", BROWSER, UI, ...UI_NO_SYNC],
  ["B4 el lienzo compensa el zoom en la punta (tamaño de pantalla fijo)", BROWSER, "js/render.js", ...RENDER_ZOOM],
  ["B5 edgeStroke ignora arrowSize (lienzo, SVG, Present, Viewer)", BROWSER, GEO, ...IGNORE],
];

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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-27-mut-"));
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
console.log((failed ? "\nFLUYO-018.27 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.27 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
