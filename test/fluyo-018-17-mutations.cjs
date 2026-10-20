"use strict";
/* FLUYO-018.17 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto plausible del slice debe hacer
   fallar su suite:
   · U*: test/fluyo-018-17.test.cjs (estático y vm, rápido).
   · B*: test/fluyo-018-17-browser.cjs en Chrome real, solo la parte que lo delata (ONLY=…).
   Uso: node test/fluyo-018-17-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-17.test.cjs"];
const BROWSER = ["test/fluyo-018-17-browser.cjs"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  ["U1 CACHE no sube (sigue v75)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v97";', 'const CACHE = "fluyo-static-v75";'],
  ["U2 los objetivos críticos vuelven a 40 px", UNIT, "css/system.css", "  --ctl-h-touch:44px;", "  --ctl-h-touch:40px;"],
  ["U3 los campos con dedo vuelven a 12 px (zoom de iOS)", UNIT, "css/system.css", "@media (pointer:coarse){ input[type=number], input[type=text], input[type=search], input:not([type]), textarea, select{ font-size:16px; } }\n", ""],
  ["U4 la hoja de Propiedades vuelve a 52dvh", UNIT, "css/styles.css", "height:clamp(220px, 40dvh, 360px); z-index:45;", "height:clamp(260px, 52dvh, 560px); z-index:45;"],
  ["U5 la hoja de Historias vuelve a una altura fija (deja de medir lo que mide)", UNIT, "css/styles.css", "aside.scenariosOpen{height:auto; max-height:calc(100dvh - 52px - var(--bb-h) - var(--canvas-useful)); padding-top:12px; overflow:hidden; gap:10px;}", "aside.scenariosOpen{height:calc(100dvh - 52px - var(--bb-h) - 20dvh); padding-top:12px; overflow:hidden; gap:10px;}"],
  ["U6 la hoja vuelve a desplazar entera (y se lleva «Volver a editar»)", UNIT, "css/styles.css", "padding-top:12px; overflow:hidden; gap:10px;}", "padding-top:12px; overflow:auto; gap:10px;}"],
  ["U7 el estado de la hoja se guarda en una variable espejo", UNIT, "js/ui.js", "function syncStoryState(){ const st=storyState(); if(document.body.dataset.story!==st) document.body.dataset.story=st; }", "let storyStateCache=\"closed\";\nfunction syncStoryState(){ const st=storyState(); storyStateCache=st; if(document.body.dataset.story!==st) document.body.dataset.story=st; }"],
  ["U8 la zona libre ignora la barra táctil", UNIT, "js/ui.js", '  const tb=$("touchBar"); if(vis(tb)){ const r=tb.getBoundingClientRect(); if(r.top<(top+bottom)/2) top=Math.max(top, r.bottom); }\n', ""],
  ["U9 vuelve a encajar la página a cualquier zoom (sin suelo)", UNIT, "js/ui.js", "  if(fit>=REVEAL_MIN_ZOOM){", "  if(fit>=0){"],
  ["U10 tocar un nodo en la ampliada vuelve a reducir la hoja", UNIT, "js/ui.js", "        if(hitNode(w.x,w.y) || hitEdge(w.x,w.y)) return;\n", ""],
  ["U11 sin reencaje en columna", UNIT, "js/ui.js", "  if(fitAfter) requestAnimationFrame(()=>{ if(uiMode===\"story\" && !isSheetLayout() && diagramCut()) fitView(); });\n", ""],
  ["U12 scrollIntoView vuelve a la fila (desplaza la hoja)", UNIT, "js/editor-scenarios.js", "  scScrollIntoView($(\"scStoryboard\")?.querySelector?.('[data-step-id=\"' + scSelectedStep + '\"]'));", "  $(\"scStoryboard\")?.querySelector('[data-step-id=\"' + scSelectedStep + '\"]')?.scrollIntoView({ block: \"nearest\" });"],
  ["U13 el paso activo no se sigue", UNIT, "js/editor-scenarios.js", "  scRenderStoryboard();\n  scFollowActive();", "  scRenderStoryboard();"],
  ["U14 la paleta inerte vuelve a pintarse reproduciendo", UNIT, "js/editor-scenarios.js", '  if ($("scPaletteToggle")) $("scPaletteToggle").hidden = isScenarioPlaybackActive();\n', ""],
  ["U15 «Conectar» vuelve a ofrecerse en modo Historia (M3)", UNIT, "js/ui.js", ' || document.body.classList.contains("storyMode");', ";"],
  ["U16 ⚙ deja de ser contextual (M2)", UNIT, "js/ui.js", '    if(total===0) scheduleSheetIdleCheck();\n', ""],
  ["U17 «Animación del lienzo» no viaja a «Más» (M1)", UNIT, "js/ui.js", "    if(anim && animSec && anim.parentNode!==animSec){ animSec.appendChild(anim); animSec.hidden=false; }\n", ""],
  ["U18 model.js tocado", UNIT, "js/model.js", "function validateEventType(et){", "function validateEventType(et){ /* 018.17 */"],
  ["U19 el rail vuelve a invertir la clase (toggle sin booleano)", UNIT, "js/ui.js", 'b.classList.toggle("toggled", !!(', 'b.classList.toggle("toggled", ('],
  ["U20 el tema deja de quitar el color propio", UNIT, "js/ui.js", 'setThemeIn(doc,{theme:$("themeSel").value, customBg:""}); syncProjectControls();', 'setThemeIn(doc,{theme:$("themeSel").value}); syncProjectControls();'],
  ["B1 la hoja compacta vuelve a enseñar la línea de tiempo (crece)", BROWSER, "css/styles.css", '  body[data-story="compact"] #scLibrarySection, body[data-story="compact"] .scStorySection,\n  body[data-story="playing"] #scLibrarySection, body[data-story="playing"]:not(.storyExpanded) .scStorySection{display:none;}', '  body[data-story="playing"] #scLibrarySection, body[data-story="playing"]:not(.storyExpanded) .scStorySection{display:none;}', "m390"],
  ["B2 la ampliada deja menos lienzo del que necesita (tope del 20 %)", BROWSER, "css/styles.css", "  :root{ --canvas-useful:max(300px, 40dvh); }", "  :root{ --canvas-useful:20dvh; }", "m390"],
  ["B3 el zoom baja de 0,6 para meterlo todo", BROWSER, "js/ui.js", "const REVEAL_MIN_ZOOM=0.6;", "const REVEAL_MIN_ZOOM=0.2;", "m390"],
  ["B4 tocar un nodo en la ampliada reduce la hoja", BROWSER, "js/ui.js", "        if(hitNode(w.x,w.y) || hitEdge(w.x,w.y)) return;\n", "", "m375"],
  ["B5 «Volver a editar» dentro del desplazable (la hoja vuelve a desplazar)", BROWSER, "css/styles.css", "padding-top:12px; overflow:hidden; gap:10px;}", "padding-top:12px; overflow:auto; gap:10px;}", "m390"],
  ["B6 el destino activo no se trae a la zona libre", BROWSER, "js/editor-scenarios.js", "  if (typeof cv !== \"undefined\" && scTargetOffscreen(step)) scRevealTarget(step, false);\n", "", "m375"],
  ["B7 sin autoscroll de la fila activa", BROWSER, "js/editor-scenarios.js", "  if (row && typeof performance !== \"undefined\" && performance.now() - scUserScrollAt > 2000) scScrollIntoView(row);\n", "", "m390"],
  ["B8 el aviso vuelve a tapar «Cancelar»", BROWSER, "js/editor-scenarios.js", "    if (pb && !pb.hidden) b = Math.max(b, innerHeight - pb.getBoundingClientRect().top + 12);\n", "", "m390"],
  ["B9 la barra táctil vuelve a caer sobre la selección", BROWSER, "js/ui.js", '  const tb=$("touchBar"); if(vis(tb)){ const r=tb.getBoundingClientRect(); if(r.top<(top+bottom)/2) top=Math.max(top, r.bottom); }\n', "", "m390"],
  ["B10 sin reencaje a 768 (el diagrama queda cortado)", BROWSER, "js/ui.js", "  if(fitAfter) requestAnimationFrame(()=>{ if(uiMode===\"story\" && !isSheetLayout() && diagramCut()) fitView(); });\n", "", "t768"],
  ["B11 «Cancelar» vuelve a 29 px", BROWSER, "css/styles.css", "#scPlacementBar button{flex:none; min-height:var(--ctl-h); padding:0 14px;}", "#scPlacementBar button{flex:none; min-height:0; height:29px; padding:0 10px;}", "m390"],
  /* 018.18 (D10): en el teléfono la tira de pestañas (y su «＋» fijo) ya no se pinta; lo que protege la barra móvil es el selector */
  ["B12 la tira de pestañas vuelve al teléfono (el selector deja de bastar)", BROWSER, "css/styles.css", "  #pagesBar > .tab, #pagesBar > .pgAdd{display:none;}\n", "", "m375"],
  ["B13 ⚙ siempre visible (M2)", BROWSER, "js/ui.js", '    if(total===0) scheduleSheetIdleCheck();\n', "", "m390"],
  /* 018.18 (D5): terminada, «Detener» SÍ está en la hoja; se vigila el defecto contrario (que se oculte) */
  ["B14 terminada, «Detener» desaparece de la hoja", BROWSER, "css/styles.css", '  body.scPlaybackOn #panelScenarios .scHeaderRow{display:none;}', '  body.scPlaybackOn #panelScenarios .scHeaderRow{display:none;}\n  #panelScenarios[data-sc-status="completed"] #scReset{display:none;}', "m390"],
  ["B15 reproducir ya no recoge la hoja ampliada", BROWSER, "js/editor-scenarios.js", '  if (!inPresent && typeof setStoryExpanded === "function" && typeof isSheetLayout === "function" && isSheetLayout()) setStoryExpanded(false);\n', "", "m390"],
  ["B16 los campos con dedo vuelven a 12 px", BROWSER, "css/styles.css", "@media (pointer:coarse){ textarea#lblEdit, #panelProperties .row select,", "@media (pointer:fine){ textarea#lblEdit, #panelProperties .row select,", "m390"],
  ["B17 el rail enciende varios botones (toggle sin booleano)", BROWSER, "js/ui.js", 'b.classList.toggle("toggled", !!(', 'b.classList.toggle("toggled", (', "d1280"],
  ["B18 los fondos predefinidos dejan de responder tras un color propio", BROWSER, "js/ui.js", 'setThemeIn(doc,{theme:$("themeSel").value, customBg:""}); syncProjectControls();', 'setThemeIn(doc,{theme:$("themeSel").value}); syncProjectControls();', "d1280"],
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-17-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER)).filter((m) => !process.env.ONLY_MUT || m[0].startsWith(process.env.ONLY_MUT));
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
console.log(failed ? "\nFLUYO-018.17 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.17 mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
