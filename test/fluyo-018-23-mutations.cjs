"use strict";
/* FLUYO-018.23 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real del panel debe hacer fallar su
   suite:
   · U*: test/fluyo-018-23.test.cjs (estático y vm, rápido).
   · B*: test/fluyo-018-23-browser.cjs en Chrome real, solo el viewport que lo delata (ONLY=…).
   Uso: node test/fluyo-018-23-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-23.test.cjs"];
const BROWSER = ["test/fluyo-018-23-browser.cjs"];
const OVERLAP = ["#panelProperties .seg > .segBtn{white-space:normal; overflow-wrap:anywhere; ", "#panelProperties .seg > .segBtn{"];
const NO_KEYS = ['  seg.addEventListener("keydown", ev=>{', '  seg.addEventListener("keydown-off", ev=>{'];
const STALE = ['  w.value = hx || HEX6(fallback) || DEFAULT_NODE_COLOR;\n  if(hx) w.removeAttribute("data-auto"); else w.setAttribute("data-auto", val==="none" ? "none" : "auto");', "  if(hx) w.value = hx;"];
const ARROWS_SWAPPED = ["function arrowsOf(e){ const st=!!e.startArrow, en=e.endArrow!==false;", "function arrowsOf(e){ const en=!!e.startArrow, st=e.endArrow!==false;"];
const CODE_LOSES = ['  if(kind==="code"){ if($("codeTextHome").nextElementSibling!==tc) $("codeTextHome").after(tc, tb); }\n  else if', "  if"];
const MOBILE_DOM = ['  else if($("grpShape").nextElementSibling!==text) $("grpShape").after(text);', '  else if(isSheetLayout()) $("selBody").insertBefore(text, $("grpShape"));\n  else if($("grpShape").nextElementSibling!==text) $("grpShape").after(text);'];
const SMALL_TOUCH = ["  #panelProperties .seg > .segBtn{min-height:var(--ctl-h-touch);}", "  #panelProperties .seg > .segBtn{min-height:36px;}"];
const NO_OLIVE = ['.seg > .segBtn[aria-checked="true"]{ background:var(--active-veil); border-color:var(--active); color:var(--ink); box-shadow:none; }', '.seg > .segBtn[aria-checked="true"]{ background:var(--surface-raised); border-color:var(--rule-2); color:var(--ink); box-shadow:0 1px 2px rgba(0,0,0,.08); }'];
const HEAD_IN_STORY = ["body.storyMode .sheetHead.selHead{display:none;}\n", ""];
const CONTEXTUAL = ["  syncSelHead(total, s);\n  /* otra selección", "  syncSelHead(total, s);\n  if(!isSheetLayout()) setPropsFolded(total===0);\n  /* otra selección"];
const DOUBLE_UNDO = ["  pushUndo(); editEdge(e,patch); scheduleAutosave(); refreshPanel();", "  pushUndo(); pushUndo(); editEdge(e,patch); scheduleAutosave(); refreshPanel();"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v80)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v115";', 'const CACHE = "fluyo-static-v80";'],
  ["U2 model.js tocado", UNIT, "js/model.js", "function validateEventType(et){", "function validateEventType(et){ /* 018.23 */"],
  ["U3 flowDir superpuesto (nowrap vuelve a ganar)", UNIT, "css/styles.css", ...OVERLAP],
  ["B3 flowDir superpuesto (nowrap vuelve a ganar)", BROWSER, "css/styles.css", ...OVERLAP, "d1440"],
  ["U4 flowDir sin teclado", UNIT, "js/ui.js", ...NO_KEYS],
  ["B4 flowDir sin teclado", BROWSER, "js/ui.js", ...NO_KEYS, "d1280"],
  ["U5 «Personalizado» rancio", UNIT, "js/ui.js", ...STALE],
  ["B5 «Personalizado» rancio", BROWSER, "js/ui.js", ...STALE, "d1024"],
  ["U6 segmentado de puntas desconectado del valor real", UNIT, "js/ui.js", ...ARROWS_SWAPPED],
  ["B6 segmentado de puntas desconectado del valor real", BROWSER, "js/ui.js", ...ARROWS_SWAPPED, "t768"],
  ["U7 el grupo Código pierde el color y el fondo del bloque", UNIT, "js/ui.js", ...CODE_LOSES],
  ["B7 el grupo Código pierde el color y el fondo del bloque", BROWSER, "js/ui.js", ...CODE_LOSES, "d1440"],
  ["B8 el panel móvil usa una estructura distinta", BROWSER, "js/ui.js", ...MOBILE_DOM, "m390"],
  ["U9 control < 44 px con el dedo", UNIT, "css/styles.css", ...SMALL_TOUCH],
  ["B9 control < 44 px con el dedo", BROWSER, "css/styles.css", ...SMALL_TOUCH, "t768"],
  ["U10 estado activo sin oliva", UNIT, "css/system.css", ...NO_OLIVE],
  ["B10 estado activo sin oliva", BROWSER, "css/system.css", ...NO_OLIVE, "d1280"],
  ["B11 la cabecera de Propiedades compite con el modo Historia", BROWSER, "css/styles.css", ...HEAD_IN_STORY, "d1440"],
  ["U12 la columna se pliega sola sin selección (contextual)", UNIT, "js/ui.js", ...CONTEXTUAL],
  ["B12 la columna se pliega sola sin selección (contextual)", BROWSER, "js/ui.js", ...CONTEXTUAL, "d1024"],
  ["B13 las puntas apilan dos Undo", BROWSER, "js/ui.js", ...DOUBLE_UNDO, "d1440"],
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
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 300000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-23-mut-"));
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
console.log((failed ? "\nFLUYO-018.23 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.23 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
