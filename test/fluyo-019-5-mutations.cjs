"use strict";
/* FLUYO-019.5 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del tinte de un color de nodo
   debe hacer fallar su suite:
   · U*: test/fluyo-019-5.test.cjs (vm, ~1 s).
   · B*: test/fluyo-019-5-browser.cjs en Chrome real (~15 s).
   Uso: node test/fluyo-019-5-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-5.test.cjs"];
const BROWSER = ["test/fluyo-019-5-browser.cjs"];
const GEO = "js/geometry.js", REN = "js/render.js", EXP = "js/export.js";
const ALPHA = "  const a=s.length===8? Math.round(k*parseInt(s.slice(6),16)/255*1e4)/1e4 : k;";
const DROP_ALPHA = [ALPHA, "  const a=k;"];                                                                  // descarta el alfa (D1c)
const UNROUNDED = [ALPHA, "  const a=s.length===8? k*parseInt(s.slice(6),16)/255 : k;"];                     // sin los 4 decimales (D6)
const INVERTED = [ALPHA, "  const a=s.length===8? Math.round(k*(255-parseInt(s.slice(6),16))/255*1e4)/1e4 : k;"];
const HEX6_CHANGES = [ALPHA, "  const a=s.length===8? Math.round(k*parseInt(s.slice(6),16)/255*1e4)/1e4 : +k.toFixed(1);"];   // #rrggbb deja de ser idéntico
const NO_EXPAND = ['  let s=m[1]; if(s.length===3) s=s.split("").map(ch=>ch+ch).join("");', "  let s=m[1];"];  // #rgb sin expandir (D2)
const NO_TRIM = ["/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim())", "/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color)"];
const FALLBACK_DEFAULT = ["function nodeTint(c,k){ return colorTint(c,k) || colorTint(PALETTE[0].c,k); }", "function nodeTint(c,k){ return colorTint(c,k) || colorTint(DEFAULT_NODE_COLOR,k); }"];
const CODE_OLD = ['function codePanelTint(color,theme){ return colorTint(color, theme==="crema"?.16:.18); }',
  'function codePanelTint(color,theme){\n  if(typeof color!=="string" || !/^#[0-9a-f]{6}$/i.test(color)) return null;\n  const v=parseInt(color.slice(1),16);\n  return `rgba(${v>>16&255},${v>>8&255},${v&255},${theme==="crema"?.16:.18})`;\n}'];
const FILL_OLD = ['  return nodeTint(n.color, theme==="crema"?.16:.18);', '  return hexA(n.color, theme==="crema"?.16:.18);'];
const SVG_OLD = ['function svgFillColor(hex, theme){ return nodeTint(hex, theme==="crema"?.16:.18); }',
  'function svgFillColor(hex, theme){\n  const v=parseInt(hex.slice(1),16);\n  const a=theme==="crema"?.16:.18;\n  return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`;\n}'];
const ANIM_OLD = ["c.fillStyle=nodeTint(col,.2);", "c.fillStyle=hexA(col,.2);"];                         // la pista de progress vuelve a hexA
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v87)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v96";', 'const CACHE = "fluyo-static-v87";'],
  ["U1 #rrggbbaa descarta el alfa", UNIT, GEO, ...DROP_ALPHA],
  ["U2 alfa sin redondear a 4 decimales", UNIT, GEO, ...UNROUNDED],
  ["U3 alfa invertido (1−α)", UNIT, GEO, ...INVERTED],
  ["U4 #rrggbb cambia de string", UNIT, GEO, ...HEX6_CHANGES],
  ["U5 #rgb sin expandir", UNIT, GEO, ...NO_EXPAND],
  ["U6 los espacios de los extremos ya no se ignoran", UNIT, GEO, ...NO_TRIM],
  ["U7 respaldo DEFAULT_NODE_COLOR en vez de PALETTE[0]", UNIT, REN, ...FALLBACK_DEFAULT],
  ["U8 el panel de code vuelve a solo #rrggbb", UNIT, GEO, ...CODE_OLD],
  ["U9 fillFor vuelve a hexA", UNIT, REN, ...FILL_OLD],
  ["U10 svgFillColor vuelve al parseInt de 6 dígitos", UNIT, EXP, ...SVG_OLD],
  ["U11 la pista de progress vuelve a hexA", UNIT, REN, ...ANIM_OLD],
  ["B1 fillFor vuelve a hexA (píxeles y paridad lienzo/SVG)", BROWSER, REN, ...FILL_OLD],
  ["B2 #rrggbbaa descarta el alfa (píxeles)", BROWSER, GEO, ...DROP_ALPHA],
  ["B3 #rgb sin expandir", BROWSER, GEO, ...NO_EXPAND],
  ["B4 svgFillColor vuelve al parseInt (paridad lienzo/SVG)", BROWSER, EXP, ...SVG_OLD],
  ["B5 el panel de code vuelve a solo #rrggbb", BROWSER, GEO, ...CODE_OLD],
  ["B6 #rrggbb cambia de string (el corpus deja de ser idéntico)", BROWSER, GEO, ...HEX6_CHANGES],
  ["B7 la pista de progress vuelve a hexA", BROWSER, REN, ...ANIM_OLD],
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-019-5-mut-"));
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
console.log((failed ? "\nFLUYO-019.5 mutaciones: " + failed + " sin detectar" : "\nFLUYO-019.5 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
