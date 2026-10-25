"use strict";
/* FLUYO-018.30 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de la cámara de la Historia del Viewer
   debe hacer fallar su suite:
   · U*: test/fluyo-018-30.test.cjs (puras y viewer.js real en vm, ~3 s).
   · B*: test/fluyo-018-30-browser.cjs en Chrome real, solo el viewport que lo delata (ONLY=…).
   Uso: node test/fluyo-018-30-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-30.test.cjs"];
const BROWSER = ["test/fluyo-018-30-browser.cjs"];
const VP = "js/viewer-viewport.js", V = "js/viewer.js";
const FLOOR = ["const FOLLOW_MIN_ZOOM=0.6, FOLLOW_MAX_ZOOM=1;", "const FOLLOW_MIN_ZOOM=0.2, FOLLOW_MAX_ZOOM=1;"];
const NO_FOLLOW = ["  storyFollow();\n", ""];
const EVERY_FRAME = ["  if(key===followKey) return;\n", ""];
const WHEEL_KEEPS = ["    takeCamera();\n    if(ev.ctrlKey", "    viewMoved=true;\n    if(ev.ctrlKey"];
const STOP_STAYS = ['$("stStop").onclick=storyStop;', '$("stStop").onclick=storyReset;'];
const SEEK_NO_FOLLOW = ["la cámara vuelve a seguir aunque se hubiera movido la vista */\n  followOn=true; followKey=null;\n", "la cámara vuelve a seguir aunque se hubiera movido la vista */\n"];
const NO_CARD = ["top=card && !card.hidden && card.offsetHeight ? card.offsetHeight+20 : 0;", "top=0;"];
const ALWAYS = ["!(fitZoom<FOLLOW_MIN_ZOOM) || ", ""];
const JUMP = ["if(instant || prefersReducedMotion())", "if(true)"];
const NO_REDUCED = ["if(instant || prefersReducedMotion())", "if(instant)"];
const NO_ROTATE = ["  if(followOn && followZoomNow()!==null){ camera=null; followFrame(true); return; }\n", ""];
const PRESENT_KEEPS = ["  if(followed) fitView();\n", ""];
const NO_FOCUS = ["  if(focus){", "  if(false){"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v103)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v107";', 'const CACHE = "fluyo-static-v103";'],
  ["U2 el suelo de zoom baja a 0,2", UNIT, VP, ...FLOOR],
  ["B2 el suelo de zoom baja a 0,2", BROWSER, VP, ...FLOOR, "l844"],
  ["U3 la cámara no sigue la Historia", UNIT, V, ...NO_FOLLOW],
  ["B3 la cámara no sigue la Historia", BROWSER, V, ...NO_FOLLOW, "m390"],
  ["B4 la cámara reencuadra a cada fotograma", BROWSER, V, ...EVERY_FRAME, "m390"],
  ["U5 la rueda no toma la cámara", UNIT, V, ...WHEEL_KEEPS],
  ["U6 Detener deja la vista acercada", UNIT, V, ...STOP_STAYS],
  ["B6 Detener deja la vista acercada", BROWSER, V, ...STOP_STAYS, "m375"],
  ["U7 ⏭/⏮ no devuelven la cámara", UNIT, V, ...SEEK_NO_FOLLOW],
  ["B8 la zona libre ignora el rótulo", BROWSER, V, ...NO_CARD, "l844"],
  ["U9 se sigue también en escritorio", UNIT, VP, ...ALWAYS],
  ["B9 se sigue también en escritorio", BROWSER, VP, ...ALWAYS, "d1440"],
  ["U10 la cámara salta sin transición", UNIT, V, ...JUMP],
  ["U11 prefers-reduced-motion ignorado", UNIT, V, ...NO_REDUCED],
  ["B11 prefers-reduced-motion ignorado", BROWSER, V, ...NO_REDUCED, "extra"],
  ["U12 girar no reencuadra el momento", UNIT, V, ...NO_ROTATE],
  ["B12 girar no reencuadra el momento", BROWSER, V, ...NO_ROTATE, "extra"],
  ["U13 Present hereda el acercamiento", UNIT, V, ...PRESENT_KEEPS],
  ["U14 un momento que no cabe pierde su primer elemento", UNIT, VP, ...NO_FOCUS],
];

/* el árbol entero (salvo .git): el Service Worker y el alcance necesitan todo lo que se sirve */
function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 900000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-30-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER)).filter((m) => { const o = process.env.ONLY_MUT; if (!o) return true; const id = m[0].split(" ")[0]; return id === o || (/^[UB]$/.test(o) && id[0] === o); });
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
console.log((failed ? "\nFLUYO-018.30 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.30 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
