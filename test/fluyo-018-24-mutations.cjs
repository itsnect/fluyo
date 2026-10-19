"use strict";
/* FLUYO-018.24 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «Deshacer sin perder el contexto»
   debe hacer fallar su suite:
   · U*: test/fluyo-018-24.test.cjs (estático y vm, ~1 s).
   · B*: test/fluyo-018-24-browser.cjs en Chrome real, solo el viewport que lo delata (ONLY=…).
   Uso: node test/fluyo-018-24-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-24.test.cjs"];
const BROWSER = ["test/fluyo-018-24-browser.cjs"];
const CLEAR = ["restoreSelAfterHistory(same ? keep : null, s.sel); renderTabs();", "clearSel(); renderTabs();"];
const GHOST = ["const live=(ids, has)=>(ids||[]).filter(id=>has(id));", "const live=(ids, has)=>(ids||[]).slice();"];
const OTHER_PAGE = ["const same=P()===was;", "const same=true;"];
const NO_RETURN = ["  else if(keep && recorded) next=pick(recorded);\n", ""];
const SHEET = ["restoreSelAfterHistory(same ? keep : null, s.sel); renderTabs();", "restoreSelAfterHistory(same ? keep : null, s.sel); renderTabs(); if(typeof isSheetLayout===\"function\"&&isSheetLayout()) document.body.classList.remove(\"panelOpen\");"];
const KW_NO_UNDO = ["  if(!kwDirty){ pushUndo(); kwDirty=true; }\n", ""];
const DOTS_NO_UNDO = ["  if(!dotsDirty){ pushUndo(); dotsDirty=true; }\n", ""];
const DOTS_ONE_BURST = ['$("edgeDotsIn").onchange=()=>{ dotsDirty=false; };', ""];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v81)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v90";', 'const CACHE = "fluyo-static-v81";'],
  ["U2 model.js tocado", UNIT, "js/model.js", "function updateNodeIn(pg, id, patch, context){", "function updateNodeIn(pg, id, patch, context){ void 0;"],
  ["U3 Undo vuelve a limpiar la selección", UNIT, "js/selection.js", ...CLEAR],
  ["B3 Undo vuelve a limpiar la selección", BROWSER, "js/selection.js", ...CLEAR, "d1440"],
  ["U4 se restauran ids que ya no existen", UNIT, "js/selection.js", ...GHOST],
  ["U5 la selección viaja a otra página", UNIT, "js/selection.js", ...OTHER_PAGE],
  ["U6 eliminar → Undo no vuelve seleccionado", UNIT, "js/selection.js", ...NO_RETURN],
  ["B6 eliminar → Undo no vuelve seleccionado", BROWSER, "js/selection.js", ...NO_RETURN, "m390"],
  ["B7 la hoja móvil se cierra tras Undo con selección", BROWSER, "js/selection.js", ...SHEET, "m390"],
  ["U8 kwEdit sin entrada de Undo", UNIT, "js/ui.js", ...KW_NO_UNDO],
  ["B8 kwEdit sin entrada de Undo", BROWSER, "js/ui.js", ...KW_NO_UNDO, "d1440"],
  ["U9 edgeDotsIn sin entrada de Undo", UNIT, "js/ui.js", ...DOTS_NO_UNDO],
  ["B9 edgeDotsIn sin entrada de Undo", BROWSER, "js/ui.js", ...DOTS_NO_UNDO, "d1440"],
  ["B10 edgeDotsIn: dos cambios separados en una sola entrada", BROWSER, "js/ui.js", ...DOTS_ONE_BURST, "d1440"],
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-24-mut-"));
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
console.log((failed ? "\nFLUYO-018.24 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.24 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
