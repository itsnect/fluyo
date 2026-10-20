"use strict";
/* FLUYO-019-FLOW-FADE — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del fade de «Una pelota por
   ruta» (o un cambio colado en el modo OFF) debe hacer fallar su suite:
   · U*: test/fluyo-019-flow-fade.test.cjs (vm, ~15 s).
   · B*: test/fluyo-019-flow-fade-browser.cjs en Chrome real, con FLUYO_QUICK=1 (V0/V1a/V4/V5, ~2,5 min).
   Uso: node test/fluyo-019-flow-fade-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-flow-fade.test.cjs"];
const BROWSER = ["test/fluyo-019-flow-fade-browser.cjs"];
const REN = "js/render.js";
const FADE = "      const fade=flowBallFade(s, seg.L);";
const PATH_FADE = [FADE, "      const fade=clamp(Math.min(d, g.total-d)/(D*.125), 0, 1);"];            // vuelve el fade sobre el camino (el bug)
const PATH_PX = [FADE, "      const fade=flowBallFade(d, g.total);"];                                 // ventana en px, pero sobre el camino
const GROUP_WIN = [FADE, "      const fade=clamp(Math.min(s, seg.L-s)/(D*.125), 0, 1);"];              // por conexión, ventana relativa al grupo
const W = "  const W=Math.min(FLOW_FADE_PX, L/2);";
const NO_CAP = [W, "  const W=FLOW_FADE_PX;"];                                                         // sin la cota L/2
const RET = "  return clamp(Math.min(s, L-s)/W, 0, 1);";
const NO_ENTRY = [RET, "  return clamp((L-s)/W, 0, 1);"];                                              // sin fade de salida
const NO_ARRIVAL = [RET, "  return clamp(s/W, 0, 1);"];                                                // sin fade de llegada
const PX70 = ["const FLOW_FADE_PX=35;", "const FLOW_FADE_PX=70;"];
const DOTS_PX = ["      const fade=Math.min(1,Math.min(f,1-f)*8);", "      const fade=flowBallFade(f*polyLen(pts), polyLen(pts));"];   // D3 colado en OFF
const CLOCK = ["  let f=(t*settings.speed)%1; if(f<0) f+=1;\n  const cache=new Map();", "  let f=(t*settings.speed*2)%1; if(f<0) f+=1;\n  const cache=new Map();"];
const POS = ["      const p=pointAt(painted(seg), s/seg.L);", "      const p=pointAt(painted(seg), clamp(s/seg.L+.01,0,1));"];
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v88)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v98";', 'const CACHE = "fluyo-static-v88";'],   /* la de 266ac09: antes escribía v90, que el alcance (≥ v89) acepta */
  ["U1 vuelve el fade sobre el camino (g.total, D·0,125)", UNIT, REN, ...PATH_FADE],
  ["U2 ventana en px pero sobre el camino", UNIT, REN, ...PATH_PX],
  ["U3 por conexión pero ventana relativa al grupo (D·0,125)", UNIT, REN, ...GROUP_WIN],
  ["U4 sin la cota L/2", UNIT, REN, ...NO_CAP],
  ["U5 sin fade de salida", UNIT, REN, ...NO_ENTRY],
  ["U6 sin fade de llegada", UNIT, REN, ...NO_ARRIVAL],
  ["U7 FLOW_FADE_PX = 70", UNIT, REN, ...PX70],
  ["U8 los puntos (OFF) pasan a ventana en px (D3 colado)", UNIT, REN, ...DOTS_PX],
  ["U9 el reloj del grupo cambia (rompe el bucle del GIF)", UNIT, REN, ...CLOCK],
  ["U10 la posición de la pelota se desplaza", UNIT, REN, ...POS],
  ["B1 vuelve el fade sobre el camino", BROWSER, REN, ...PATH_FADE],
  ["B2 sin fade de llegada", BROWSER, REN, ...NO_ARRIVAL],
  ["B3 sin fade de salida", BROWSER, REN, ...NO_ENTRY],
  ["B4 FLOW_FADE_PX = 70", BROWSER, REN, ...PX70],
  ["B5 los puntos (OFF) pasan a ventana en px (D3 colado)", BROWSER, REN, ...DOTS_PX],
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
    env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir, ...(browser ? { FLUYO_QUICK: "1" } : {}) } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-flow-fade-mut-"));
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
console.log((failed ? "\nFLUYO-019-FLOW-FADE mutaciones: " + failed + " sin detectar" : "\nFLUYO-019-FLOW-FADE mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
