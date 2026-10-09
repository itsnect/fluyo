"use strict";
/* FLUYO-018.15 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto plausible debe hacer fallar su suite:
   · U*: test/fluyo-018-15.test.cjs (estático + vm, rápido).
   · B*: test/fluyo-018-15-browser.cjs en Chrome real, solo el viewport indicado (ONLY=…).
   Las de divergencia del MCP viven en fluyo-mcp/scripts/mutate-018-15.ts.
   Uso: node test/fluyo-018-15-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-15.test.cjs"];
const BROWSER = ["test/fluyo-018-15-browser.cjs"];
const DEF = 'const DEFAULT_NODE_COLOR="#857F6C";', NORM = "  if(n.color==null) n.color=PALETTE[0].c;";
const HL = "      c.shadowColor = M.ink; c.shadowBlur = 14;\n      c.strokeStyle = M.arrow; c.lineWidth = 2.5;";
const HL_CYAN = '      c.shadowColor = "#3aa7e8"; c.shadowBlur = 14;\n      c.strokeStyle = "rgba(58,167,232,.9)"; c.lineWidth = 2.5;';
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v73)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v75";', 'const CACHE = "fluyo-static-v74";'],
  ["U2 vuelve #6a9fb5 como color con el que nace un nodo", UNIT, "js/config.js", DEF, 'const DEFAULT_NODE_COLOR="#6a9fb5";'],
  ["U3 createNodeIn vuelve a PALETTE[0]", UNIT, "js/model.js", "color:DEFAULT_NODE_COLOR, fill:null", "color:PALETTE[0].c, fill:null"],
  ["U4 migración accidental: un nodo sin color se lee con el default nuevo", UNIT, "js/model.js", NORM, "  if(n.color==null) n.color=DEFAULT_NODE_COLOR;"],
  ["U5 migración accidental: #6a9fb5 explícito se repinta", UNIT, "js/model.js", NORM, '  if(n.color==null || n.color==="#6a9fb5") n.color=DEFAULT_NODE_COLOR;'],
  ["U6 «Servicio» cambia de valor en la paleta", UNIT, "js/config.js", '  {c:"#6a9fb5", n:"Servicio"},', '  {c:"#857F6C", n:"Servicio"},'],
  ["U7 el acento del evento en tránsito vuelve a cian", UNIT, "js/render.js", 'const FLOW_ACCENT = "#d08b5b";', 'const FLOW_ACCENT = "#3aa7e8";'],
  ["U8 «Resaltar» vuelve a cian", UNIT, "js/render.js", HL, HL_CYAN],
  ["U9 la herramienta de animaciones vuelve a PALETTE[0]", UNIT, "js/interaction.js", "color:DEFAULT_NODE_COLOR});", "color:PALETTE[0].c});"],
  ["U10 el panel pierde la muestra del color por defecto", UNIT, "js/ui.js", '  if(field==="color"){ seen.add(DEFAULT_NODE_COLOR); mk(DEFAULT_NODE_COLOR,"Piedra (por defecto)",DEFAULT_NODE_COLOR); }\n', ""],
  ["U11 el pulso de una imagen vuelve a brillar en cian", UNIT, "js/render.js", 'if(glow>0){c.shadowColor=n.color; c.shadowBlur=20*glow;}', 'if(glow>0){c.shadowColor="#3aa7e8"; c.shadowBlur=20*glow;}'],
  ["U12 la vista previa de «Resaltar» del diálogo vuelve a cian", UNIT, "css/styles.css", "box-shadow:0 0 0 3px var(--active);", "box-shadow:0 0 0 3px rgba(58,167,232,.5);"],
  ["B1 vuelve #6a9fb5 como color con el que nace un nodo", BROWSER, "js/config.js", DEF, 'const DEFAULT_NODE_COLOR="#6a9fb5";', "d1440"],
  ["B2 el SVG diverge del lienzo (el default nuevo sale como «Servicio»)", BROWSER, "js/export.js", "stroke=escapeAttribute(n.color), dash", "stroke=escapeAttribute(n.color===DEFAULT_NODE_COLOR?PALETTE[0].c:n.color), dash", "d1280"],
  ["B3 el Viewer diverge del editor (repinta el default nuevo)", BROWSER, "js/viewer.js", "    doc=loaded.project.doc;\n", "    doc=loaded.project.doc;\n    doc.pages.forEach(p=>p.nodes.forEach(n=>{ if(n.color===DEFAULT_NODE_COLOR) n.color=PALETTE[0].c; }));\n", "t768"],
  ["B4 «Resaltar» vuelve a cian (Historia real en editor y Viewer)", BROWSER, "js/render.js", HL, HL_CYAN, "m390"],
  ["B5 el halo del evento vuelve a cian", BROWSER, "js/render.js", 'const FLOW_ACCENT = "#d08b5b";', 'const FLOW_ACCENT = "#3aa7e8";', "m375"],
  ["B6 migración accidental de documentos antiguos al abrir", BROWSER, "js/model.js", NORM, "  if(n.color==null) n.color=DEFAULT_NODE_COLOR;", "d1101"],
  ["B7 se pierde un #6a9fb5 explícito al abrir", BROWSER, "js/model.js", NORM, '  if(n.color==null || n.color==="#6a9fb5") n.color=DEFAULT_NODE_COLOR;', "d1440"],
  ["B8 el panel pierde la muestra del color por defecto", BROWSER, "js/ui.js", '  if(field==="color"){ seen.add(DEFAULT_NODE_COLOR); mk(DEFAULT_NODE_COLOR,"Piedra (por defecto)",DEFAULT_NODE_COLOR); }\n', "", "m390"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "assets", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "docs", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 900000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-15-mut-"));
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
console.log(failed ? `\nFLUYO-018.15 mutaciones: ${failed} sin detectar u obsoletas` : `\nFLUYO-018.15 mutaciones: ${list.length}/${list.length} detectadas`);
process.exit(failed ? 1 : 0);
