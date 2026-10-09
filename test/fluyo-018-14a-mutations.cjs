"use strict";
/* FLUYO-018.14a — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto plausible debe hacer fallar su suite:
   · U*: test/fluyo-018-14a.test.cjs (estático + vm, rápido).
   · B*: test/fluyo-018-14a-browser.cjs en Chrome real, solo el viewport indicado (ONLY=…; ~40 s cada una).
   Uso: node test/fluyo-018-14a-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-14a.test.cjs"];
const BROWSER = ["test/fluyo-018-14a-browser.cjs"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v72)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v75";', 'const CACHE = "fluyo-static-v74";'],
  ["U2 el lienzo vuelve a la Bézier de 0,8 (doble geometría antigua)", UNIT, "js/render.js",
    "    c.beginPath(); traceSegments(c, seg.outline);\n",
    "    const {x,y,w,h}=n, ry=Math.min(16,h*.18), top=y-h/2, bot=y+h/2;\n    c.beginPath(); c.moveTo(x-w/2,top+ry); c.lineTo(x-w/2,bot-ry); c.bezierCurveTo(x-w/2,bot+ry*.8, x+w/2,bot+ry*.8, x+w/2,bot-ry); c.lineTo(x+w/2,top+ry); c.bezierCurveTo(x+w/2,top-ry*.8, x-w/2,top-ry*.8, x-w/2,top+ry);\n"],
  ["U3 el SVG dibuja su propia tapa (segunda elipse)", UNIT, "js/export.js",
    'parts.push(`<path d="${segmentsToSVGPath(seg.lip)}" fill="none" stroke="${stroke}" stroke-width="2.5"${dash}/>`);',
    'parts.push(`<ellipse cx="${n.x}" cy="${(n.y-n.h/2+Math.min(16,n.h*.18)).toFixed(2)}" rx="${(n.w/2).toFixed(2)}" ry="${Math.min(16,n.h*.18).toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="2.5"/>`);'],
  ["U4 codeColors ignora el kwBg explícito del nodo", UNIT, "js/geometry.js", "    kwBg:  n.kwBg || T.codeKwBg || \"\",", "    kwBg:  T.codeKwBg || \"\","],
  ["U5 el bloque code ignora la fuente nueva (vuelve a «Mono»)", UNIT, "js/geometry.js", 'const CODE_DEFAULT_FONT=(FONTS.find(f=>f.n==="IBM Plex Mono") || FONTS[FONTS.length-1]).f;', "const CODE_DEFAULT_FONT=FONTS[FONTS.length-1].f;"],
  ["U6 FONTS pierde Playfair Display", UNIT, "js/config.js", "  {n:\"Playfair Display\", f:\"'Playfair Display', Georgia, serif\"},\n", ""],
  ["U7 la exportación rasteriza sin esperar a las fuentes", UNIT, "js/export.js",
    "  waitForRenderFonts(doc).then(()=>{ if(fmt===\"gif\") exportGIF(scale, tr); else exportStatic(fmt, scale, tr); });",
    "  if(fmt===\"gif\") exportGIF(scale, tr); else exportStatic(fmt, scale, tr);"],
  ["U8 el Viewer pinta sin esperar a las fuentes", UNIT, "js/viewer.js", "    await waitForRenderFonts(loaded.project.doc, 2000, loaded.project.settings);\n", ""],
  ["U9 vuelven las cajas verdes de palabra clave por defecto", UNIT, "js/config.js", 'codeBg:"rgba(0,0,0,.32)", codeText:"#e8e1d3", codeKwBg:""', 'codeBg:"rgba(0,0,0,.32)", codeText:"#e8e1d3", codeKwBg:"#a8b34a"'],
  ["U10 se toca model.js", UNIT, "js/model.js", '"use strict";', '"use strict"; /* 018.14a */'],
  ["B1 la tapa de la BD se dibuja dos veces", BROWSER, "js/render.js",
    "    c.beginPath(); traceSegments(c, seg.lip); c.stroke();\n",
    "    c.beginPath(); traceSegments(c, seg.lip); c.stroke();\n    { const g=cylinderGeom(n); c.beginPath(); c.ellipse(g.cx,g.top+g.ry-5,g.rx,g.ry,0,Math.PI,0,true); c.stroke(); }\n", "d1440"],
  ["B2 reaparecen las cajas de palabra clave en el lienzo", BROWSER, "js/config.js", 'codeBg:"rgba(0,0,0,.32)", codeText:"#e8e1d3", codeKwBg:""', 'codeBg:"rgba(0,0,0,.32)", codeText:"#e8e1d3", codeKwBg:"#a8b34a"', "d1440"],
  ["B3 el SVG diverge del lienzo (arcos invertidos)", BROWSER, "js/geometry.js", "0 0 ${s.ccw?0:1}", "0 0 ${s.ccw?1:0}", "d1280"],
  ["B4 la mono 500 no llega (la fuente nueva se ignora)", BROWSER, "css/system.css", "assets/fonts/ibm-plex-mono-latin-500.woff2", "assets/fonts/no-existe-500.woff2", "m390"],
  ["B5 el lienzo ignora un kwBg explícito", BROWSER, "js/geometry.js", "    kwBg:  n.kwBg || T.codeKwBg || \"\",", "    kwBg:  T.codeKwBg || \"\",", "d1280"],
  ["B6 la selección vuelve a cian", BROWSER, "js/render.js", 'dark :{ink:"#C3CDA4"', 'dark :{ink:"#3aa7e8"', "d1440"],
  ["B7 el Viewer pierde el sistema visual", BROWSER, "s/index.html", '<link rel="stylesheet" href="../css/system.css">\n', "", "m375"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "assets", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "docs", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 400000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-14a-mut-"));
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
console.log(failed ? "\nFLUYO-018.14a mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.14a mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
