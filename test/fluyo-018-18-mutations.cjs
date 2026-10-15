"use strict";
/* FLUYO-018.18 — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada defecto plausible del slice debe hacer fallar su
   suite:
   · U*: test/fluyo-018-18.test.cjs (estático y vm, rápido).
   · B*: test/fluyo-018-18-browser.cjs en Chrome real, solo la parte que lo delata (ONLY=…).
   Uso: node test/fluyo-018-18-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-018-18.test.cjs"];
const BROWSER = ["test/fluyo-018-18-browser.cjs"];
/* [nombre, suite, archivo, desde, hasta, ONLY del browser test] */
const MUTATIONS = [
  /* release y alcance */
  ["U1 CACHE no sube (sigue v76)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v86";', 'const CACHE = "fluyo-static-v76";'],
  ["U2 story-clock.js fuera del precache", UNIT, "sw.js", '  "./js/story-clock.js",\n', ""],
  ["U3 model.js tocado", UNIT, "js/model.js", "function validateEventType(et){", "function validateEventType(et){ /* 018.18 */"],
  ["U4 el reloj entra en el kernel (story-playback.js tocado)", UNIT, "js/story-playback.js", "var FluyoStory = (function(){", "var FluyoStory = (function(){ /* reloj */"],
  /* D1–D3: el reloj */
  ["U5 la pausa no congela (el reloj sigue corriendo)", UNIT, "js/story-clock.js", "function now(c, real){ return c.pausedAt!==null ? c.pausedAt : real - c.base; }", "function now(c, real){ return real - c.base; }"],
  ["U6 reanudar no descuenta la pausa (salta hacia delante)", UNIT, "js/story-clock.js", "if(c.pausedAt!==null){ c.base = real - c.pausedAt; c.pausedAt = null; }", "if(c.pausedAt!==null){ c.pausedAt = null; }"],
  ["U7 saltar cae en el momento anterior (desfase de uno)", UNIT, "js/story-clock.js", "const started = FluyoStory.start(page, scenario, t - times[k]);", "const started = FluyoStory.start(page, scenario, t - times[Math.max(0, k - 1)]);"],
  ["U8 la unidad pasa a ser el Step (no el momento)", UNIT, "js/story-clock.js", "return storyboardGroups((scenario && scenario.steps) || []).map(g=>g.at);", "return ((scenario && scenario.steps) || []).map(s=>s.at);"],
  ["U9 «en pausa» como estado nuevo de scStatus", UNIT, "js/editor-scenarios.js", "  FluyoStoryClock.pause(scClock, performance.now());\n  if (scRafId !== null) { cancelAnimationFrame(scRafId); scRafId = null; }", "  FluyoStoryClock.pause(scClock, performance.now()); scStatus = \"paused\";\n  if (scRafId !== null) { cancelAnimationFrame(scRafId); scRafId = null; }"],
  /* D4–D6 */
  ["U10 tocar una fila reproduciendo deja de saltar", UNIT, "js/editor-scenarios.js", "      if (isScenarioPlaybackActive()) { scSeekStep(step); return; }\n", ""],
  ["U11 «Terminar» vuelve al acabar", UNIT, "js/editor-scenarios.js", '    scGlyphText(reset, "■", "g-stop", "Detener", true);', '    if (scStatus === "running") scGlyphText(reset, "■", "g-stop", "Detener", true);\n    else reset.textContent = "Terminar";'],
  ["U12 desde terminada, saltar no pausa (sigue sola)", UNIT, "js/editor-scenarios.js", '  if (scStatus === "completed") FluyoStoryClock.pause(scClock, performance.now());\n  const r = FluyoStoryClock.seek(', "  const r = FluyoStoryClock.seek("],
  ["U13 el rótulo vuelve a ser una caja de la hoja (no está sobre el lienzo)", UNIT, "css/styles.css", ".scNow{position:absolute; left:50%; top:10px;", ".scNow{position:static; left:50%; top:10px;"],
  /* D7–D8 */
  ["U14 un toque en Present vuelve a avanzar de página", UNIT, "js/interaction.js", "    if(presenting) return;\n    if(wasTap && ev.pointerType===\"touch\") handleTouchTap(ev);", "    if(presenting && wasTap && ev.pointerType===\"touch\") nextSlide();\n    if(presenting) return;\n    if(wasTap && ev.pointerType===\"touch\") handleTouchTap(ev);"],
  ["U15 vuelve la segunda salida de Present (psEdit)", UNIT, "index.html", '  <button id="prExit" type="button"', '  <button id="psEdit" type="button" hidden>← Volver a editar</button>\n  <button id="prExit" type="button"'],
  /* D9 */
  ["U16 el Viewer encaja antes de colocar la banda", UNIT, "js/viewer.js", "    resizeCanvas(sv, $(\"wrap\"));\n    fitView();\n    if(!wrapObserver", "    if(!wrapObserver"],
  ["U17 Presentar vuelve a impedir reproducir en el Viewer", UNIT, "js/viewer.js", "function storyPlay(){\n  if(viewerPhase!==\"ready\") return;", "function storyPlay(){\n  if(viewerPhase!==\"ready\" || presenting) return;"],
  ["U18 «Hecho con Fluyo» vuelve en apaisado", UNIT, "css/share.css", "@media (orientation:landscape) and (max-height:500px){ #brand{ display:none; } }", ""],
  /* D10–D11 */
  ["U19 la ✕ vuelve a las pestañas", UNIT, "js/ui.js", '    if(pg.name && t.setAttribute) t.setAttribute("title", pg.name);', '    if(doc.pages.length>1){ const x=document.createElement("span"); x.className="x"; x.textContent="✕"; x.title="Cerrar página"; x.onclick=ev=>{ ev.stopPropagation(); requestDeletePage(i); }; t.appendChild(x); }\n    if(pg.name && t.setAttribute) t.setAttribute("title", pg.name);'],
  ["U20 el selector pierde «＋ Nueva página»", UNIT, "js/ui.js", '    item("＋ Nueva página", ()=>{ closePageMenu(false); newPageFromUi(); }, "pgNew");\n', ""],
  ["U21 el doble clic vuelve a prompt()", UNIT, "js/ui.js", "      openPageMenu(i, more||t); showPageRename(i);", '      const nn=prompt("Nombre de la página:",pg.name); if(nn) renamePage(i,nn); renderTabs();'],
  /* D12 */
  ["U22 «Hacia el origen» escribe el valor equivocado", UNIT, "index.html", 'data-flow="reverse" aria-checked="false">Hacia el origen', 'data-flow="alternate" aria-checked="false">Hacia el origen'],
  ["U23 el bloque «Dirección» desaparece de Trazo", UNIT, "index.html", '          <p class="pgSub" id="dirKicker">Dirección</p>\n', ""],
  ["U24 el sentido deja de pasar por el control nativo (sin Undo)", UNIT, "js/ui.js", '$("flowSel").value=b.dataset.flow; $("flowSel").onchange(); };', '$("flowSel").value=b.dataset.flow; const e=singleEdge(); if(e) e.flowDir=b.dataset.flow; };'],

  /* Chrome real */
  ["B1 la pausa no congela", BROWSER, "js/story-clock.js", "function now(c, real){ return c.pausedAt!==null ? c.pausedAt : real - c.base; }", "function now(c, real){ return real - c.base; }", "m390"],
  ["B2 saltar con desfase de un momento", BROWSER, "js/story-clock.js", "const started = FluyoStory.start(page, scenario, t - times[k]);", "const started = FluyoStory.start(page, scenario, t - times[Math.max(0, k - 1)]);", "d1440"],
  ["B3 el rótulo no se recoloca (tapa el destino)", BROWSER, "js/editor-scenarios.js", "  const y = hit(top) && bottom > top && !hit(bottom) ? bottom : top;", "  const y = top;", "d1280"],
  ["B4 la hoja reproduciendo vuelve a crecer con el texto (bloque en la hoja)", BROWSER, "css/styles.css", ".scNowCaption{font:400 15px/1.2 var(--font-serif); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}", ".scNowCaption{font:400 15px/1.2 var(--font-serif); min-width:0; overflow:hidden; white-space:normal;}\n#panelScenarios .scHeader{min-height:0;}", "m375"],
  ["B5 saltar no enseña el momento entero", BROWSER, "js/editor-scenarios.js", "  scFollowActive();\n  scRevealMoment();", "  scFollowActive();", "m375"],
  ["B6 un toque en Present avanza y corta la Historia", BROWSER, "js/interaction.js", "    if(presenting) return;\n    if(wasTap && ev.pointerType===\"touch\") handleTouchTap(ev);", "    if(presenting && wasTap && ev.pointerType===\"touch\") nextSlide();\n    if(presenting) return;\n    if(wasTap && ev.pointerType===\"touch\") handleTouchTap(ev);", "m390"],
  ["B7 el mando de Present vuelve a 38 px con dedo", BROWSER, "css/styles.css", "@media (pointer:coarse){ #presentBar button{height:var(--ctl-h-touch); min-width:var(--ctl-h-touch);} }", "", "m375"],
  ["B8 el Viewer encaja antes de la banda (y sin reencaje)", BROWSER, "js/viewer.js", "    resizeCanvas(sv, $(\"wrap\"));\n    fitView();\n    if(!wrapObserver && typeof ResizeObserver===\"function\"){", "    if(false){", "l844"],
  ["B9 el Viewer no reencaja al girar", BROWSER, "js/viewer.js", "if(viewerPhase===\"ready\" && !viewMoved && !presentationRaf){", "if(false){", "m390"],
  ["B10 Presentar en el Viewer no reproduce la Historia", BROWSER, "js/viewer.js", "function storyPlay(){\n  if(viewerPhase!==\"ready\") return;", "function storyPlay(){\n  if(viewerPhase!==\"ready\" || presenting) return;", "m390"],
  ["B11 el selector de página no se pinta en el teléfono", BROWSER, "css/styles.css", "  #pagesBar > .pgSelect{display:inline-flex;", "  #pagesBar > .pgSelect{display:none;", "m390"],
  ["B12 la activa queda fuera de la vista en tableta (sin traerla)", BROWSER, "js/ui.js", '  if(typeof requestAnimationFrame==="function") requestAnimationFrame(revealActiveTab);\n', "", "t768"],
  ["B13 la ✕ vuelve a las pestañas", BROWSER, "js/ui.js", '    if(pg.name && t.setAttribute) t.setAttribute("title", pg.name);', '    if(doc.pages.length>1){ const x=document.createElement("span"); x.className="x"; x.textContent="✕"; x.title="Cerrar página"; x.onclick=ev=>{ ev.stopPropagation(); requestDeletePage(i); }; t.appendChild(x); }\n    if(pg.name && t.setAttribute) t.setAttribute("title", pg.name);', "d1440"],
  ["B14 el doble clic vuelve a prompt()", BROWSER, "js/ui.js", "      openPageMenu(i, more||t); showPageRename(i);", '      const nn=prompt("Nombre de la página:",pg.name); if(nn) renamePage(i,nn); renderTabs();', "d1280"],
  ["B15 «Hacia el origen» escribe «alternate»", BROWSER, "index.html", 'data-flow="reverse" aria-checked="false">Hacia el origen', 'data-flow="alternate" aria-checked="false">Hacia el origen', "d1440"],
  ["B16 «Sentido» no se enseña nunca", BROWSER, "js/ui.js", '  $("rowFlow").style.display=e && e.animated ? "flex" : "none";', '  $("rowFlow").style.display="none";', "m390"],
  ["B17 terminada, «Detener» se oculta en la hoja", BROWSER, "css/styles.css", '  body.scPlaybackOn #panelScenarios .scHeaderRow{display:none;}', '  body.scPlaybackOn #panelScenarios .scHeaderRow{display:none;}\n  #panelScenarios[data-sc-status="completed"] #scReset{display:none;}', "m390"],
  ["B18 story-clock.js fuera del precache (sin red no hay transporte)", BROWSER, "sw.js", '  "./js/story-clock.js",\n', "", "sw"],
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-018-18-mut-"));
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
console.log(failed ? "\nFLUYO-018.18 mutaciones: " + failed + " sin detectar" : "\nFLUYO-018.18 mutaciones: " + list.length + "/" + list.length + " detectadas");
process.exit(failed ? 1 : 0);
