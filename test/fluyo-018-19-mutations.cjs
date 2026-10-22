"use strict";
/* FLUYO-018.19 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto que el slice evita debe hacer fallar su
   suite:
   · U*: test/fluyo-018-19.test.cjs (estático y vm, rápido).
   · B*: test/fluyo-018-19-browser.cjs en Chrome real, solo la parte que lo delata (ONLY=…).
   Uso: node test/fluyo-018-19-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-19.test.cjs"];
const BROWSER = ["test/fluyo-018-19-browser.cjs"];
const NO_PLACE = ["    scBeginPlacement(id);\n    if (scPlacement) {\n      scPlacement.origin = \"created\";", "    if (scPlacement) {\n      scPlacement.origin = \"created\";"];
const EMPTY_CANCELS = ["    if (touch && scPlacement) {\n", "    if (false) {\n"];
const CANCEL_DELETES = ["  scDrag = null;\n  scPointerStart = null;\n  scPlacement = null;\n  scContext = null;", "  scDrag = null;\n  scPointerStart = null;\n  if (scPlacement && scPlacement.origin === \"created\") { pushUndo(); deleteEventType(scPlacement.eventTypeId); scCommit(); }\n  scPlacement = null;\n  scContext = null;"];
const SMALL_DIALOG = ["  #scEventClose{min-width:var(--ctl-h-touch); min-height:var(--ctl-h-touch);}\n  .scDialog>footer button{min-height:var(--ctl-h-touch); padding:0 18px;}\n  .scSegmented span{min-height:var(--ctl-h-touch); display:flex; align-items:center;}\n", ""];
const NO_SIDE = ['matchMedia("(orientation: landscape) and (max-height: 500px) and (pointer: coarse)")', 'matchMedia("(max-width: 1px)")'];
const NO_STRIP = ["  body[data-story=\"playing\"]:not(.storyExpanded) aside.scenariosOpen{top:auto; left:0; right:0; width:auto; bottom:0;\n    border-left:0; border-top:1px solid var(--rule-2); padding:6px 16px calc(6px + env(safe-area-inset-bottom));}\n", ""];
const NO_REFIT = ["  if(diagramInsideBox(prev.w, prev.h)) fitView();", "  if(false) fitView();"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  /* release y alcance */
  ["U1 CACHE no sube (sigue v77)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v103";', 'const CACHE = "fluyo-static-v77";'],
  ["U2 model.js tocado", UNIT, "js/model.js", "function validateEventType(et){", "function validateEventType(et){ /* 018.19 */"],
  /* crear → colocar */
  ["U3 Crear no entra en colocación", UNIT, "js/editor-scenarios.js", ...NO_PLACE],
  ["B3 Crear no entra en colocación", BROWSER, "js/editor-scenarios.js", ...NO_PLACE, "m390"],
  ["U4 Cancelar la colocación elimina el evento", UNIT, "js/editor-scenarios.js", ...CANCEL_DELETES],
  ["B4 Cancelar la colocación elimina el evento", BROWSER, "js/editor-scenarios.js", ...CANCEL_DELETES, "l844"],
  ["U5 editar o duplicar también entra en colocación", UNIT, "js/editor-scenarios.js", '    created = !editing && scEventDialogMode === "create";', "    created = !editing;"],
  /* colocar con el dedo */
  ["U6 tocar el vacío con el dedo vuelve a cancelar", UNIT, "js/editor-scenarios.js", ...EMPTY_CANCELS],
  ["B6 tocar el vacío con el dedo vuelve a cancelar", BROWSER, "js/editor-scenarios.js", ...EMPTY_CANCELS, "l812"],
  ["B7 arrastrar con el dedo durante la colocación no desplaza", BROWSER, "js/interaction.js", "  if(panDrag){\n    const dx = ev.clientX - panDrag.x;", "  if(panDrag && panDrag.placing) return;\n  if(panDrag){\n    const dx = ev.clientX - panDrag.x;", "m375"],
  ["U8 colocar con el dedo se decide al apoyar (como el ratón)", UNIT, "js/editor-scenarios.js", '  if (ev.pointerType === "touch") return false;\n  if (ev.button !== 0) return true;', "  if (ev.button !== 0) return true;"],
  /* diálogo */
  ["U9 el diálogo vuelve a controles < 44 px con el dedo", UNIT, "css/styles.css", ...SMALL_DIALOG],
  ["B9 el diálogo vuelve a controles < 44 px con el dedo", BROWSER, "css/styles.css", ...SMALL_DIALOG, "m390"],
  ["U10 «Cómo se ve» abierto al crear (vuelve el formulario largo)", UNIT, "js/editor-scenarios.js", '  scSetAccordionOpen("scFlowLook", !!et && ', '  scSetAccordionOpen("scFlowLook", true || '],
  ["B10 «Cómo se ve» abierto al crear (vuelve el formulario largo)", BROWSER, "js/editor-scenarios.js", '  scSetAccordionOpen("scFlowLook", !!et && ', '  scSetAccordionOpen("scFlowLook", true || ', "m375"],
  /* apaisado */
  ["U11 el apaisado vuelve al layout de tableta", UNIT, "js/ui.js", ...NO_SIDE],
  ["B11 el apaisado vuelve al layout de tableta", BROWSER, "js/ui.js", ...NO_SIDE, "l844"],
  ["B12 vuelve la barra inferior en apaisado", BROWSER, "css/styles.css", "  #bottomBar{display:none;}\n  body > header{min-height:var(--hdr-h);", "  body > header{min-height:var(--hdr-h);", "l812"],
  ["B13 el rail vuelve a desbordar el documento", BROWSER, "css/styles.css", "flex-wrap:nowrap; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain;", "flex-wrap:nowrap; overflow:visible;", "l667"],
  ["U14 Propiedades tapa el lienzo (la zona libre no descuenta la hoja lateral)", UNIT, "js/ui.js", "    if(isSideSheet() && !sideStrip()) right=Math.min(right, innerWidth - aside.offsetWidth);\n    else bottom", "    if(isSideSheet() && !sideStrip()) {}\n    else bottom"],
  ["B14 Propiedades tapa el lienzo (hoja a todo el ancho)", BROWSER, "css/styles.css", "  body:not(.storyMode) aside{width:var(--props-w);}", "  body:not(.storyMode) aside{width:100vw;}", "l844"],
  ["U15 Historias ocupa la hoja lateral entera durante la reproducción", UNIT, "css/styles.css", ...NO_STRIP],
  ["B15 Historias ocupa la hoja lateral entera durante la reproducción", BROWSER, "css/styles.css", ...NO_STRIP, "l667"],
  ["B16 el rótulo del momento no prueba los lados (tapa el destino en apaisado)", BROWSER, "js/editor-scenarios.js", "  if (toRight - toLeft > 16) spots.push(", "  if (false) spots.push(", "l812"],
  ["B17 el menú de páginas se abre siempre hacia arriba (tapa el selector en la cabecera)", BROWSER, "js/ui.js", "  m.style.top=(above>=8 ? above : Math.max(8, Math.min((r.bottom||r.top)+6, innerHeight-m.offsetHeight-8)))+\"px\";", "  m.style.top=Math.max(8, above)+\"px\";", "l844"],
  ["B19 «Ampliar» en pausa no trae la fila del momento", BROWSER, "js/ui.js", '  if(on && typeof scFollowActive==="function" && typeof requestAnimationFrame==="function") requestAnimationFrame(()=>scFollowActive());\n', "", "l844"],
  /* giro */
  ["U18 no reencajar al girar", UNIT, "js/ui.js", ...NO_REFIT],
  ["B18 no reencajar al girar", BROWSER, "js/ui.js", ...NO_REFIT, "rot"],
];

/* el árbol entero (salvo .git): la mutación del Service Worker necesita todo lo que precachea */
function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args, only) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 900000 : 120000, env: { ...process.env, ONLY: browser ? only : "", FLUYO_GIT_ROOT: root } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-19-mut-"));
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
console.log(failed ? "\nFLUYO-018.19 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.19 mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
