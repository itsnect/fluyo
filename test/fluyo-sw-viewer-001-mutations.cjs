"use strict";
/* FLUYO-SW-VIEWER-001 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del service worker del Viewer
   debe hacer fallar su suite:
   · U*: test/fluyo-sw-viewer-001.test.cjs (sw.js real en vm, ~1 s).
   · B*: test/fluyo-sw-viewer-001-browser.cjs en Chrome real (SW permitido, sin red).
   Uso: node test/fluyo-sw-viewer-001-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-sw-viewer-001.test.cjs"];
const BROWSER = ["test/fluyo-sw-viewer-001-browser.cjs"];
const SW = "sw.js", V = "js/viewer.js";
const ALWAYS_EDITOR = [".then(([cache, editor]) => editor", ".then(([cache, editor]) => true"];
const VIEWER_GIF = [": cache.addAll(VIEWER_ASSETS))", ": cache.addAll(VIEWER_ASSETS.concat(CDN_ASSETS)))"];
const NO_D4A = ['if (ev.request.mode === "navigate" && viewerPath(url.pathname)) {', "if (false) {"];
const EDITOR_FALLBACK = ["cacheFirst(new Request(VIEWER_PAGE), VIEWER_PAGE)", 'cacheFirst(ev.request, "./index.html")'];
const FORGETS_EDITOR = [".then((had) => had.some(Boolean)));", ".then(() => false));"];
const NO_EDITOR_CLIENT = ["list.some((c) => !viewerPath(new URL(c.url).pathname))", "false"];
const NO_I18N_EN = ['"./assets/fonts/playfair-display-latin-400.woff2",\n  "./js/i18n-en.js",', '"./assets/fonts/playfair-display-latin-400.woff2",'];
const NO_REGISTER = ["\nregisterViewerServiceWorker();", "\n"];
const ON_FILE = ['  if(location.protocol!=="http:" && location.protocol!=="https:") return;\n  if(typeof navigator==="undefined"', '  if(typeof navigator==="undefined"'];
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v106)", UNIT, SW, 'const CACHE = "fluyo-static-v114";', 'const CACHE = "fluyo-static-v106";'],
  ["U2 el Viewer instala la caché del editor", UNIT, SW, ...ALWAYS_EDITOR],
  ["B2 el Viewer instala la caché del editor", BROWSER, SW, ...ALWAYS_EDITOR],
  ["U3 la instalación del Viewer pide gif.js (cdnjs)", UNIT, SW, ...VIEWER_GIF],
  ["B3 la instalación del Viewer pide gif.js (cdnjs)", BROWSER, SW, ...VIEWER_GIF],
  ["U4 sin D4-A: /s/?lang=en se busca con su query", UNIT, SW, ...NO_D4A],
  ["B4 sin D4-A: /s/?lang=en se busca con su query", BROWSER, SW, ...NO_D4A],
  ["U5 el respaldo de /s/ vuelve a ser el editor", UNIT, SW, ...EDITOR_FALLBACK],
  ["U6 la actualización de quien usó el editor pierde su caché", UNIT, SW, ...FORGETS_EDITOR],
  ["U7 el editor abierto no cuenta al instalar", UNIT, SW, ...NO_EDITOR_CLIENT],
  ["U8 al Viewer le falta el inglés (i18n-en.js)", UNIT, SW, ...NO_I18N_EN],
  ["B8 al Viewer le falta el inglés (i18n-en.js)", BROWSER, SW, ...NO_I18N_EN],
  ["U9 el Viewer no registra el SW", UNIT, V, ...NO_REGISTER],
  ["B9 el Viewer no registra el SW", BROWSER, V, ...NO_REGISTER],
  ["U10 el Viewer registra también en file://", UNIT, V, ...ON_FILE],
];

/* el árbol entero (salvo .git): el Service Worker y el alcance necesitan todo lo que se sirve */
function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 900000 : 120000, env: { ...process.env, FLUYO_GIT_ROOT: root, SKIP_GIF: "1" } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-sw-viewer-001-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER)).filter((m) => { const o = process.env.ONLY_MUT; if (!o) return true; const id = m[0].split(" ")[0]; return id === o || (/^[UB]$/.test(o) && id[0] === o); });
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  for (const args of [UNIT, ...(list.some((m) => m[1] === BROWSER) ? [BROWSER] : [])]) {
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
console.log((failed ? "\nFLUYO-SW-VIEWER-001 mutaciones: " + failed + " sin detectar" : "\nFLUYO-SW-VIEWER-001 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
