"use strict";
/* FLUYO-019.3 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «una sola semántica de color
   en la piel» debe hacer fallar su suite:
   · U*: test/fluyo-019-3.test.cjs (vm, ~1 s).
   · B*: test/fluyo-019-3-browser.cjs en Chrome real (~12 s).
   Uso: node test/fluyo-019-3-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-3.test.cjs"];
const BROWSER = ["test/fluyo-019-3-browser.cjs"];
const SKIN = "js/skin.js";
const ALPHA_LINE = '  return m? skinMix(base, "#"+m[1], parseInt(m[2],16)/255) : null;';
const NO_ALPHA = [ALPHA_LINE, "  return null;"];                                                   // #rrggbbaa = ilegible → PALETTE[0]
const DROP_ALPHA = [ALPHA_LINE, '  return m? "#"+m[1].toLowerCase() : null;'];                       // descarta el alfa
const ALPHA_INVERTED = [ALPHA_LINE, '  return m? skinMix(base, "#"+m[1], 1-parseInt(m[2],16)/255) : null;'];
const ALPHA_UNROUNDED = [ALPHA_LINE, '  return m? skinMix(base, "#"+m[1], Math.round(parseInt(m[2],16)/255*10)/10) : null;'];
const FALLBACK_DEFAULT = ["  const col=skinColor(color, base) || PALETTE[0].c;", "  const col=skinColor(color, base) || DEFAULT_NODE_COLOR;"];
const FALLBACK_COLHEX = ["  const col=skinColor(color, base) || PALETTE[0].c;", '  const col=skinHexRGB(color)? color : (typeof colHex==="function"? colHex(color) : DEFAULT_NODE_COLOR);'];
const FILL_APART = ['  const front=n.fill==="none"? T.bg : (skinColor(n.fill, T.bg) || T.front);\n  layers.push({k:"contact"', '  const front=n.fill==="none"? T.bg : (skinHexRGB(n.fill)? n.fill : T.front);\n  layers.push({k:"contact"'];
const NORMALIZES_HEX = ["  if(skinHexRGB(c)) return c;", '  if(skinHexRGB(c)) return skinMix(c, c, 1);'];      // #rgb/#rrggbb dejan de ser «el mismo string»
const BASE_THEME = ["  const col=skinColor(color, base) || PALETTE[0].c;", "  const col=skinColor(color, T.bg) || PALETTE[0].c;"];   // ignora customBg
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v86)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v111";', 'const CACHE = "fluyo-static-v86";'],
  ["U1 #rrggbbaa se trata como ilegible", UNIT, SKIN, ...NO_ALPHA],
  ["U2 #rrggbbaa descarta el alfa", UNIT, SKIN, ...DROP_ALPHA],
  ["U3 composición invertida (α ↔ 1−α)", UNIT, SKIN, ...ALPHA_INVERTED],
  ["U4 composición con α redondeado", UNIT, SKIN, ...ALPHA_UNROUNDED],
  ["U5 respaldo DEFAULT_NODE_COLOR en vez de PALETTE[0]", UNIT, SKIN, ...FALLBACK_DEFAULT],
  ["U6 vuelve la rama colHex de 019.2 (lanza con #rrggbbaa)", UNIT, SKIN, ...FALLBACK_COLHEX],
  ["U7 el relleno del bloque se lee aparte (ignora #rrggbbaa)", UNIT, SKIN, ...FILL_APART],
  ["U8 #rgb/#rrggbb se normalizan (cambian los resultados de 019.1/019.2)", UNIT, SKIN, ...NORMALIZES_HEX],
  ["U9 la composición ignora el fondo propio", UNIT, SKIN, ...BASE_THEME],
  ["B1 vuelve la rama colHex de 019.2 (Present, Viewer y exportación fallan)", BROWSER, SKIN, ...FALLBACK_COLHEX],
  ["B2 #rrggbbaa descarta el alfa (los píxeles no son los del tono compuesto)", BROWSER, SKIN, ...DROP_ALPHA],
  ["B3 la composición ignora el fondo propio", BROWSER, SKIN, ...BASE_THEME],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 400000 : 120000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-019-3-mut-"));
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
console.log((failed ? "\nFLUYO-019.3 mutaciones: " + failed + " sin detectar" : "\nFLUYO-019.3 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
