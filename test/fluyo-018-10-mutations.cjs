"use strict";
/* FLUYO-018.10 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): la documentación del editor (docs/index.html, README.md) debe
   seguir el contrato MCP tras retirar edit_diagram, y el cambio del asset servido debe subir CACHE y mantener ./docs/ precacheado.
   Cada mutación debe hacer fallar test/fluyo-018-10.test.cjs (+ 010-qa y 013, que fijan CACHE). Uso: node test/fluyo-018-10-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const ROW_EDIT = '  <tr><td><code>edit_diagram</code></td><td>Aplica operaciones sobre un documento existente.</td></tr>\n';
const MUTATIONS = [
  ["M1 vuelve la fila de edit_diagram a la tabla", "docs/index.html", '  <tr><td><code>export_diagram</code></td>', ROW_EDIT + '  <tr><td><code>export_diagram</code></td>'],
  ["M2 falta una tool en la tabla (propose_layout)", "docs/index.html", '  <tr><td><code>propose_layout</code></td>', '  <tr><td><code>propose_layout_off</code></td>'],
  ["M3 la meta description vuelve a «9 tools»", "docs/index.html", "el servidor MCP con sus 15 tools.", "el servidor MCP con sus 9 tools."],
  ["M4 edit_diagram citado como disponible", "docs/index.html", ", la tool de edición anterior, se retiró: la sustituye <code>author_document</code>.", " sigue disponible para editar documentos."],
  ["M5 vuelve relayout como consejo", "docs/index.html", "partir de lo que propone <code>propose_layout</code>", "usar <code>relayout</code>"],
  ["M6 el README vuelve a listar edit_diagram", "README.md", "exportar (`export_diagram`)", "exportar (`export_diagram`), editar (`edit_diagram`)"],
  ["M7 el README pierde author_document", "README.md", "modificar (`author_document` y sus atajos", "modificar (sus atajos"],
  ["M8 CACHE no sube (sigue v72)", "sw.js", 'const CACHE = "fluyo-static-v75";', 'const CACHE = "fluyo-static-v74";'],
  ["M9 ./docs/ sale del precache", "sw.js", '  "./docs/",\n', ""],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "docs", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "README.md", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-10.test.cjs", "test/fluyo-010-qa.test.cjs", "test/fluyo-013.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 120000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-10-mut-"));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const sane = runSuite(base);
  if (sane.code !== 0) { console.error("La copia sin mutar NO pasa la suite:\n" + sane.out.slice(-1500)); process.exit(2); }
  console.log("copia sin mutar: suite OK (0/" + MUTATIONS.length + " mutaciones aplicadas)");
  MUTATIONS.forEach(([name, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    const text = src.replaceAll(CRLF, NL);
    if (!text.includes(from)) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    fs.writeFileSync(p, (text.replace(from, () => to)).replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir);
    const killed = r.code !== 0;
    const n = (r.out.match(/^not ok /gm) || []).length;
    console.log((killed ? "  ✔ detectada  " : "  ✘ SOBREVIVE  ") + name + (killed ? "  (" + n + " tests fallan)" : ""));
    if (!killed) failed++;
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? "\nFLUYO-018.10 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.10 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
