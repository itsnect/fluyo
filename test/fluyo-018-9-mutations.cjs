"use strict";
/* FLUYO-018.9 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol): cada defecto plausible de los campos de `code` al crear un nodo
   (createNodeIn) debe hacer fallar test/fluyo-018-9.test.cjs. Uso: node test/fluyo-018-9-mutations.cjs */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const FIX = '    shape==="code"? {lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null} : {}), spec, ["ref","id"]);';
const NO_DEFAULTS = '    {}), spec, ["ref","id"]);';
const MUTATIONS = [
  ["M1 vuelve el Object.assign tras el spec (HEAD)", "js/model.js", FIX, NO_DEFAULTS + '\n  if(shape==="code" && !("lang" in n)) Object.assign(n,{lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null});'],
  ["M2 sin defaults de code", "js/model.js", FIX, NO_DEFAULTS],
  ["M3 defaults de code tras el spec, por clave (orden distinto del editor)", "js/model.js", FIX, NO_DEFAULTS + '\n  if(shape==="code") for(const [k,v] of [["lang",DEFAULT_LANG],["keywords",null],["kwBg",null],["kwColor",null]]) if(!(k in n)) n[k]=v;'],
  ["M4 los defaults de code PISAN el spec", "js/model.js", FIX, NO_DEFAULTS + '\n  if(shape==="code") Object.assign(n,{lang:DEFAULT_LANG, keywords:null, kwBg:null, kwColor:null});'],
  ["M5 campos de code en todas las formas", "js/model.js", 'shape==="code"? {lang:DEFAULT_LANG', 'true? {lang:DEFAULT_LANG'],
  ["M6 kwColor no se completa", "js/model.js", "keywords:null, kwBg:null, kwColor:null} : {}), spec", "keywords:null, kwBg:null} : {}), spec"],
  ["M7 lang por defecto distinto del editor", "js/model.js", 'shape==="code"? {lang:DEFAULT_LANG,', 'shape==="code"? {lang:"none",'],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir) {
  const r = spawnSync(process.execPath, ["--test", "test/fluyo-018-9.test.cjs", "test/fluyo-018-1.test.cjs"], { cwd: dir, encoding: "utf8", timeout: 120000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-9-mut-"));
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
console.log(failed ? "\nFLUYO-018.9 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.9 mutaciones: " + MUTATIONS.length + "/" + MUTATIONS.length + " detectadas");
process.exit(failed ? 1 : 0);
