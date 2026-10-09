"use strict";
/* FLUYO-018.14b — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto plausible del slice debe hacer
   fallar su suite:
   · U*: test/fluyo-018-14b.test.cjs (estático y vm, rápido).
   · B*: test/fluyo-018-14b-browser.cjs en Chrome real, solo la parte que lo delata (ONLY=…).
   Uso: node test/fluyo-018-14b-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-14b.test.cjs"];
const BROWSER = ["test/fluyo-018-14b-browser.cjs"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 modo oscuro parcial: el panel elevado no se redefine", UNIT, "css/system.css", "  --surface-raised:var(--c-noche-alta);\n", ""],
  ["U2 el tema de la interfaz se escribe en el documento", UNIT, "js/ui.js", "function setUiTheme(theme){\n  applyUiTheme(theme);", "function setUiTheme(theme){\n  applyUiTheme(theme); settings.uiTheme=theme; scheduleAutosave();"],
  ["U3 el panel vuelve a 256 px", UNIT, "css/styles.css", "aside{\n  width:288px; flex:none;", "aside{\n  width:256px; flex:none;"],
  ["U4 Historias vuelve a ser pestaña (sin modo)", UNIT, "js/ui.js", '  document.body.classList.toggle("storyMode", story);\n', ""],
  ["U5 «Editar» vuelve a bloquearse al reproducir", UNIT, "js/editor-scenarios.js", '  if (!inPresent && typeof switchPanelTab === "function") switchPanelTab("scenarios");\n  scRenderButtons();', '  if (!inPresent && typeof switchPanelTab === "function") switchPanelTab("scenarios");\n  const tabProp = $("tabProperties");\n  if (tabProp) tabProp.disabled = true;\n  scRenderButtons();'],
  ["U6 «Volver a editar» vuelve a significar dos cosas", UNIT, "js/editor-scenarios.js", '    else reset.textContent = "Terminar";', '    else reset.textContent = "Volver a editar";'],
  ["U7 un tinte del chrome vuelve escrito a mano", UNIT, "css/styles.css", "#btnStories[aria-expanded=\"true\"]{background:var(--active-veil); border-color:var(--active-rule); color:var(--active);}", "#btnStories[aria-expanded=\"true\"]{background:var(--active-veil); border-color:rgba(78,90,63,.35); color:var(--active);}"],
  ["U8 CACHE no sube (sigue v72)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v75";', 'const CACHE = "fluyo-static-v74";'],
  ["U9 el tema de la interfaz se aplica tarde (destello en claro)", UNIT, "index.html", 'try{\n  if(localStorage.getItem("fluyo.ui.theme")==="dark"){', 'window.addEventListener("load",()=>{ try{\n  if(localStorage.getItem("fluyo.ui.theme")==="dark"){'],
  ["U10 la ayuda vuelve a ser el estado vacío (abierta)", UNIT, "index.html", '<details class="pgroup pgHelp" id="grpHelp" data-group="Atajos y gestos">', '<details class="pgroup pgHelp" id="grpHelp" data-group="Atajos y gestos" open>'],
  ["B1 modo oscuro parcial: la cabecera queda clara", BROWSER, "css/styles.css", "  padding:0 10px 0 16px; background:var(--surface); border-bottom:1px solid var(--rule-2);", "  padding:0 10px 0 16px; background:#F2EDE3; border-bottom:1px solid var(--rule-2);", "d1280"],
  ["B2 la interfaz oscura cambia el lienzo", BROWSER, "js/ui.js", "  $(\"chkUiDark\").checked=dark;\n}", "  $(\"chkUiDark\").checked=dark;\n  if(typeof doc!==\"undefined\" && doc.pages){ setThemeIn(doc,{theme:dark?\"dark\":\"crema\"}); syncProjectControls(); }\n}", "d1440"],
  ["B3 Archivo vuelve a la cabecera y la parte a 1280", BROWSER, "js/ui.js", "  closeMoreMenu(false); closeCanvasMenu(false);\n  if(!mobile) document.body", "  if(!mobile) header.insertBefore(tools, $(\"btnCanvas\"));\n  closeMoreMenu(false); closeCanvasMenu(false);\n  if(!mobile) document.body", "d1280"],
  ["B4 la hoja móvil pierde su botón de cerrar", BROWSER, "css/styles.css", "  .sheetHead .sheetClose{display:inline-flex; min-width:40px; color:var(--ink);}", "  .sheetHead .sheetClose{display:none;}", "m390"],
  ["B5 tocar el vacío ya no cierra la hoja", BROWSER, "js/ui.js", 'if(uiMode==="edit" && selN.size+selE.size===0 && !tm.multi && tm.link===null) closeSurface();', 'if(false) closeSurface();', "m375"],
  ["B6 objetivos táctiles reducidos en Historias", BROWSER, "css/styles.css", "  .scMore{min-width:40px; min-height:40px;}\n  .scDelay{min-height:40px;}", "  .scMore{min-width:30px; min-height:30px;}\n  .scDelay{min-height:28px;}", "m390"],
  ["B7 «Volver a editar» oculto en móvil", BROWSER, "css/styles.css", "#btnStoryExit{display:inline-flex;", "#btnStoryExit{display:none;", "m375"],
  ["B8 el rail sigue en modo Historia", BROWSER, "css/styles.css", "body.storyMode .rail{display:none;}", "", "d1440"],
  ["B9 la hoja de Historias vuelve a tapar el lienzo", BROWSER, "css/styles.css", "  aside.scenariosOpen{height:clamp(200px, 32dvh, 280px); padding-top:12px;}", "  aside.scenariosOpen{height:clamp(260px, 52dvh, 560px); padding-top:12px;}", "m390"],
  ["B10 la preferencia de interfaz no se guarda", BROWSER, "js/ui.js", '  try{ if(theme==="dark") localStorage.setItem(UI_THEME_KEY,"dark"); else localStorage.removeItem(UI_THEME_KEY); }catch(e){}', "", "persist"],
  ["B11 sin «Reproduciendo» (no se ve qué pasa)", BROWSER, "js/editor-scenarios.js", "function scRenderStatus() {\n  scRenderNow();", "function scRenderStatus() {", "d1280"],
  ["B12 el panel vuelve a la anchura de Historias de antes (336 px)", BROWSER, "css/styles.css", "aside.scenariosOpen{box-sizing:border-box;width:320px;flex:0 0 320px;", "aside.scenariosOpen{box-sizing:border-box;width:336px;flex:0 0 336px;", "d1280"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "assets", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test", "docs"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 600000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-14b-mut-"));
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
console.log(failed ? "\nFLUYO-018.14b mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.14b mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
