"use strict";
/* FLUYO-019.2 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de «la piel como ajuste del
   documento» debe hacer fallar su suite:
   · U*: test/fluyo-019-2.test.cjs (vm, ~3 s).
   · B*: test/fluyo-019-2-browser.cjs en Chrome real (~40 s).
   Uso: node test/fluyo-019-2-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-2.test.cjs"];
const BROWSER = ["test/fluyo-019-2-browser.cjs"];
const MODEL = "js/model.js", UI = "js/ui.js", VIEWER = "js/viewer.js", RT = "js/editor-runtime.js", EXP = "js/export.js", SHELL = "s/index.html";
const PERSIST_FLAT = ["  else delete normalized.skin;\n", '  else normalized.skin="flat";\n'];
const ANY_STRING = ["  if(source.skin===SKIN_VALUES[1]) normalized.skin=SKIN_VALUES[1];", '  if(typeof source.skin==="string") normalized.skin=source.skin;'];
const CASE_INSENSITIVE = ["  if(source.skin===SKIN_VALUES[1]) normalized.skin=SKIN_VALUES[1];", '  if(String(source.skin).toLowerCase()==="built") normalized.skin=SKIN_VALUES[1];'];
const DEFAULT_GAINS = ["const DEFAULT_SETTINGS={speed:.5, dots:3, build:false, stagger:.45, grid:true, snap:false, font:DEFAULT_FONT, single:false};", 'const DEFAULT_SETTINGS={speed:.5, dots:3, build:false, stagger:.45, grid:true, snap:false, font:DEFAULT_FONT, single:false, skin:"flat"};'];
const READ_LOOSE = ['const projectSkin=st=>(st && st.skin==="built")? "built" : "flat";', 'const projectSkin=st=>(st && st.skin)? "built" : "flat";'];
const VIEWER_IGNORES = ["    skin: projectSkin(settings)\n", '    skin: "flat"\n'];
const VIEWER_ALWAYS = ["    skin: projectSkin(settings)\n", '    skin: "built"\n'];
const SHELL_DROPS = ['<script src="../js/skin.js"></script>\n', ""];
/* FLUYO-019.4b (decisión 226): el editor ya pinta la piel del documento; la mutación es ahora volver a dejarlo plano */
const EDITOR_PAINTS = ["      skin: editorSkin()},", '      skin: presenting ? editorSkin() : "flat"},'];
const UI_WRITES_FLAT = ['    if(next==="built") settings.skin="built"; else delete settings.skin;', '    settings.skin=next;'];
const UI_NO_SAVE = ['    if(next==="built") settings.skin="built"; else delete settings.skin;\n    scheduleAutosave();', '    if(next==="built") settings.skin="built"; else delete settings.skin;'];
const UI_UNDO = ['    if(next==="built") settings.skin="built"; else delete settings.skin;', '    pushUndo(); if(next==="built") settings.skin="built"; else delete settings.skin;'];
const UI_NO_SYNC = ["function togglePresentSkin(){ setDocumentSkin(projectSkin(settings)===\"built\" ? \"flat\" : \"built\"); }", 'function togglePresentSkin(){ const v=projectSkin(settings)==="built" ? "flat" : "built"; if(v==="built") settings.skin="built"; else delete settings.skin; scheduleAutosave(); }'];
const EXPORT_IGNORES_DOC = ['  $("exSkin").value = projectSkin(settings);', '  $("exSkin").value = "flat";'];
const EXPORT_WRITES_DOC = ['  const fmt=$("exFmt").value, scale=+$("exRes").value, skin=$("exSkin").value==="built"? "built" : "flat";', '  const fmt=$("exFmt").value, scale=+$("exRes").value, skin=$("exSkin").value==="built"? "built" : "flat"; if(skin==="built") settings.skin="built"; else delete settings.skin;'];
/* [nombre, suite, archivo, desde, hasta] */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v85)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v106";', 'const CACHE = "fluyo-static-v85";'],
  ["U1 la carga persiste \"flat\" (los documentos antiguos cambian al guardarse)", UNIT, MODEL, ...PERSIST_FLAT],
  ["U2 la carga acepta cualquier string (lista abierta)", UNIT, MODEL, ...ANY_STRING],
  ["U3 la carga acepta \"BUILT\" (lista no exacta)", UNIT, MODEL, ...CASE_INSENSITIVE],
  ["U4 DEFAULT_SETTINGS gana skin (todo documento se rellena)", UNIT, MODEL, ...DEFAULT_GAINS],
  ["U5 projectSkin lee cualquier valor verdadero como construido", UNIT, MODEL, ...READ_LOOSE],
  ["U6 el Viewer ignora el documento (siempre plano)", UNIT, VIEWER, ...VIEWER_IGNORES],
  ["U7 el Viewer pinta siempre construido", UNIT, VIEWER, ...VIEWER_ALWAYS],
  ["U8 el Viewer no carga skin.js", UNIT, SHELL, ...SHELL_DROPS],
  ["U9 el lienzo del editor vuelve a ser plano (revisa la 226)", UNIT, RT, ...EDITOR_PAINTS],
  ["U10 el editor escribe \"flat\" en el documento", UNIT, UI, ...UI_WRITES_FLAT],
  ["U11 cambiar el aspecto no autoguarda", UNIT, UI, ...UI_NO_SAVE],
  ["U12 cambiar el aspecto crea una entrada de Undo", UNIT, UI, ...UI_UNDO],
  ["U13 la tecla B/botón no sincronizan los mandos", UNIT, UI, ...UI_NO_SYNC],
  ["U14 el diálogo de exportar ignora el aspecto del documento", UNIT, EXP, ...EXPORT_IGNORES_DOC],
  ["U15 exportar escribe el documento", UNIT, EXP, ...EXPORT_WRITES_DOC],
  ["B1 el Viewer ignora el documento (siempre plano)", BROWSER, VIEWER, ...VIEWER_IGNORES],
  ["B2 el lienzo del editor vuelve a ser plano (revisa la 226)", BROWSER, RT, ...EDITOR_PAINTS],
  ["B3 exportar escribe el documento", BROWSER, EXP, ...EXPORT_WRITES_DOC],
  ["B4 la carga persiste \"flat\" (el corpus deja de ser byte a byte HEAD)", BROWSER, MODEL, ...PERSIST_FLAT],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 400000 : 120000, env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir, FLUYO_QUICK: browser ? "1" : "" } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-019-2-mut-"));
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
console.log((failed ? "\nFLUYO-019.2 mutaciones: " + failed + " sin detectar" : "\nFLUYO-019.2 mutaciones: " + list.length + "/" + list.length + " detectadas") + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
process.exit(failed ? 1 : 0);
