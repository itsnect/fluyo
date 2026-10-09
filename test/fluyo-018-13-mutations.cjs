"use strict";
/* FLUYO-018.13 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto visual plausible debe hacer fallar su suite:
   · U*: test/fluyo-018-13.test.cjs (estático, rápido).
   · B*: test/fluyo-018-13-browser.cjs en Chrome real, solo el viewport que la delata (ONLY=…; ~20 s cada una).
   Uso: node test/fluyo-018-13-mutations.cjs   (Playwright vía NODE_PATH, como los browser tests; SKIP_BROWSER=1 solo las U) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-13.test.cjs"];
const BROWSER = ["test/fluyo-018-13-browser.cjs"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v72)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v75";', 'const CACHE = "fluyo-static-v74";'],
  ["U2 system.css fuera del precache", UNIT, "sw.js", '  "./css/system.css",\n', ""],
  ["U3 la UI pide una fuente a Google Fonts", UNIT, "index.html", '<link rel="stylesheet" href="css/system.css">', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono"><link rel="stylesheet" href="css/system.css">'],
  ["U4 vuelve el emoji de Guardar", UNIT, "index.html", '<span class="lbl">Guardar</span>', '<span class="lbl">💾 Guardar</span>'],
  ["U5 se toca model.js", UNIT, "js/model.js", '"use strict";', '"use strict"; /* 018.13 */'],
  ["U6 la selección vuelve a azul", UNIT, "js/render.js", 'dark :{ink:"#C3CDA4"', 'dark :{ink:"#3aa7e8"'],
  /* 018.14b: Archivo (con «Limpiar página») vive en «Más»; el defecto equivalente es que vuelva a la cabecera */
  ["B1 Archivo («Limpiar página»…) vuelve a la cabecera y la parte a 1280", BROWSER, "js/ui.js", "  closeMoreMenu(false); closeCanvasMenu(false);\n  if(!mobile) document.body", "  if(!mobile) header.insertBefore(tools, $(\"btnCanvas\"));\n  closeMoreMenu(false); closeCanvasMenu(false);\n  if(!mobile) document.body", "d1280"],
  ["B2 el tooltip del zoom desborda la página", BROWSER, "index.html", 'data-tip="Encajar la página" data-tip-pos="up end"', 'data-tip="Encajar la página" data-tip-pos="up"', "d1440"],
  ["B3 «Limpiar página» pierde el terracota en «Más»", BROWSER, "css/styles.css", ".moreTools #btnClear, .moreTools #btnClear .ic{color:var(--attention);}", "", "m375"],
  ["B4 sin objetivos táctiles de 40 px", BROWSER, "css/system.css", "@media (pointer:coarse){ :root{ --ctl-h:var(--ctl-h-touch); } }", "", "m375"],
  ["B5 el lienzo pierde el marco", BROWSER, "css/styles.css", "border-radius:var(--r-md); box-shadow:var(--shadow-frame);", "border-radius:0; box-shadow:none;", "d1440"],
  ["B6 los nombres de página pierden la serif", BROWSER, "css/styles.css", "font:400 14px/1 var(--font-serif); cursor:pointer; white-space:nowrap; counter-increment:pg;", "font:400 14px/1 var(--font-mono); cursor:pointer; white-space:nowrap; counter-increment:pg;", "m390"],
  ["B7 la lectura del zoom no se sincroniza", BROWSER, "js/editor-runtime.js", 'if(typeof syncZoomReadout==="function") syncZoomReadout();', "", "d1440"],
  ["B8 el mando de Present pierde el material inverso", BROWSER, "css/system.css", ".inverse, #presentBar, #presentStory{", ".inverse{", "d1440"],
  ["B9 las casillas del panel vuelven a ser casillas nativas", BROWSER, "css/system.css", "input[type=checkbox].switch, .row input[type=checkbox], .moreMenu input[type=checkbox]{\n  -webkit-appearance:none; appearance:none;", "input[type=checkbox].switch, .row input[type=checkbox], .moreMenu input[type=checkbox]{\n  -webkit-appearance:auto; appearance:auto;", "d1280"],
  ["B10 las fuentes se sirven desde un CDN", BROWSER, "css/system.css", 'src:url("../assets/fonts/ibm-plex-mono-latin-400.woff2")', 'src:url("https://fonts.gstatic.com/s/ibmplexmono/v19/plex-400.woff2")', "d1440"],
  ["B11 la barra táctil vuelve al color del chrome (sin pieza levantada)", BROWSER, "css/styles.css", "  background:var(--surface-raised); border:1px solid var(--rule-2); border-radius:var(--r-md); padding:4px;\n  box-shadow:var(--shadow-float);", "  background:var(--surface); border:1px solid var(--rule-2); border-radius:var(--r-md); padding:4px;\n  box-shadow:none;", "t768"],
  ["B12 el panel deja de nombrar la selección", BROWSER, "js/ui.js", "  syncSelMeta(total, s);\n", "", "d1440"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "assets", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 300000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-13-mut-"));
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
console.log(failed ? "\nFLUYO-018.13 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.13 mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
