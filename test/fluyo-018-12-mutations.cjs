"use strict";
/* FLUYO-018.12 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto plausible debe hacer fallar su suite:
   · U*: test/fluyo-018-12.test.cjs (estático + vm, rápido).
   · B*: test/fluyo-018-12-browser.cjs en Chrome real, recorrido táctil de 375×667 (ONLY=m375; ~1 min cada una).
   Uso: node test/fluyo-018-12-mutations.cjs   (Playwright vía NODE_PATH, como los browser tests; SKIP_BROWSER=1 solo las U) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-12.test.cjs"];
const BROWSER = ["test/fluyo-018-12-browser.cjs"];
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v72)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v75";', 'const CACHE = "fluyo-static-v74";'],
  ["U2 Ejemplo vuelve a vaciar la página activa", UNIT, "js/export.js", "const r=createPageIn(doc, examplePageName()); doc.cur=r.pageIndex; clearSel();", "pushUndo(); const pg=P(); pg.nodes=[]; pg.edges=[]; clearSel();"],
  ["U3 con el dedo, el dblclick sintético abre el prompt", UNIT, "js/ui.js", 'if(t.lastPointer==="touch") return;', ""],
  ["U4 la pestaña activa sin ▾", UNIT, "js/ui.js", "    if(i===doc.cur){\n      /* span con rol de botón", "    if(false){\n      /* span con rol de botón"],
  ["U5 densidad sin tope", UNIT, "js/render.js", "return Math.min(2, d);", "return d;"],
  ["U6 render no escala por la densidad", UNIT, "js/render.js", "if(dpr!==1) c.scale(dpr, dpr);", ""],
  ["U7 el editor pasa el ancho del respaldo como px CSS", UNIT, "js/editor-runtime.js", "width:cv.width/(cv.fluyoDpr||1)", "width:cv.width"],
  ["U8 Pausa vuelve a la cabecera", UNIT, "index.html", '  <span class="spacer hdrSpacer"></span>', '  <span class="spacer hdrSpacer"></span><button id="btnPlayHdr">⏸ Pausa</button>'],
  ["B1 la hoja vuelve a cubrir la cabecera (tapa ⚙)", BROWSER, "css/styles.css", "display:flex; position:fixed; left:0; right:0; top:auto; bottom:var(--bb-h);", "display:flex; position:fixed; left:0; right:0; top:0; bottom:var(--bb-h);"],
  /* 018.14b: el cierre vive en la cabecera de la hoja (.sheetHead) y la hoja reproduciendo mide clamp(156px, 26dvh, 220px) */
  ["B2 la hoja sin botón de cerrar", BROWSER, "css/styles.css", ".sheetHead .sheetClose{display:inline-flex;", ".sheetHead .sheetClose{display:none;"],
  ["B3 un toque sobre un nodo vuelve a apilar Undo", BROWSER, "js/interaction.js", "drag={offs:{}, wps:[], realin:[], snap:snapPage(), toggleOff};", "pushUndo(); drag={offs:{}, wps:[], realin:[], snap:null, toggleOff};"],
  ["B4 «Conectar» invierte la dirección", BROWSER, "js/interaction.js", "const e=newEdge(touchLink,n.id);", "const e=newEdge(n.id,touchLink);"],
  ["B5 en «Seleccionar varios» tocar el vacío vacía la selección", BROWSER, "js/interaction.js", "  if(touchMulti) return;\n  if(isDoubleTap(ev))", "  if(isDoubleTap(ev))"],
  ["B6 Deshacer/Rehacer no se sincronizan", BROWSER, "js/editor-runtime.js", 'if(typeof syncHistoryButtons==="function") syncHistoryButtons();', ""],
  ["B7 la hoja no se compacta al reproducir", BROWSER, "css/styles.css", "body.panelOpen.scPlaybackOn aside, body.panelOpen.scPlaybackOn aside.scenariosOpen{height:clamp(156px, 26dvh, 220px);}", ""],
  ["B8 la hoja no se aparta al colocar un evento", BROWSER, "css/styles.css", "body.panelOpen.scPlacing aside{transform:translateY(calc(100% + var(--bb-h) + 12px)); visibility:hidden;}", ""],
  ["B9 abrir la hoja no revela lo tapado", BROWSER, "js/ui.js", '  revealAboveSheet(name==="stories" ? "page" : "selection");\n', ""],
  ["B10 el menú de la página no renombra", BROWSER, "js/ui.js", "    try{ renamePage(i, input.value); }", "    try{ if(0) renamePage(i, input.value); }"],
];

function copyTree(dest) {
  for (const entry of ["js", "css", "s", "assets", "ejemplos/data", "index.html", "sw.js", "manifest.webmanifest", "test"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.mkdirSync(path.dirname(path.join(dest, entry)), { recursive: true }), fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 300000 : 120000, env: { ...process.env, ONLY: browser ? "m375" : "" } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-12-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER));
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  for (const args of [...new Set(list.map((m) => m[1]))]) {
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
console.log(failed ? "\nFLUYO-018.12 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.12 mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
