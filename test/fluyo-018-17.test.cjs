"use strict";
/* FLUYO-018.17 — Historias como superficie temporal (cuatro estados), panel como hoja, cabecera móvil, touch.
   Comprobaciones estáticas y en vm (rápidas, sin navegador). Lo que solo se ve pintado (lienzo útil, alturas, objetivos,
   seguimiento del paso activo) lo mide test/fluyo-018-17-browser.cjs en Chrome real.
   · Alcance: model.js, config.js y el resto del kernel, render.js, geometry.js, export.js, interaction.js, viewer.js, s/ y
     share.css idénticos a HEAD; CACHE v76.
   · Ids conservados; #scStoryAdd y #scReset siguen en el DOM; #scRunHint, #animSection, #helpSection nuevos.
   · CSS: --ctl-h-touch 44 y --row-h-touch 40; campos a 16 px con dedo; hoja de Propiedades ≤ 40dvh; hoja de Historias por
     contenido con tope --canvas-useful; estados body[data-story]; fichas de eventos; «＋» fijo; «Terminar» fuera de la hoja.
   · ui.js: storyState()/syncStoryState(), visibleCanvasRect(), revealAboveSheet con suelo de zoom y objetivo «paso»,
     sheetTapOutside solo en el vacío, reencaje en columna, placeChrome mueve #grpAnim y #grpHelp (M1, M2), ⚙ contextual (M2),
     «Conectar» fuera en modo Historia (M3).
   · editor-scenarios.js: scFollowActive, scScrollIntoView (solo el contenedor), scTargetOffscreen con la zona libre,
     scRenderButtons oculta la paleta reproduciendo y enseña la pista sin pasos. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const { makeScenarioUIContext, buildExample, setupPanel, ensureUI } = require("./fluyo-016-harness.cjs");

const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };
function element(html, id) {
  const i = html.indexOf('id="' + id + '"'); assert.ok(i >= 0, "no existe #" + id);
  const start = html.lastIndexOf("<", i), tag = /^<(\w+)/.exec(html.slice(start))[1];
  const re = new RegExp("<(/?)" + tag + "\\b[^>]*>", "g"); re.lastIndex = start; let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return html.slice(start, re.lastIndex); }
  throw new Error("sin cerrar #" + id);
}

test("alcance: kernel, render, geometría, exportación y Share idénticos a HEAD", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  /* FLUYO-018.18 cambia a propósito interaction.js (toque en Present, Espacio), viewer.js, present-story.js, editor-share.js
     («Detener»), s/index.html y css/share.css; su propio test de alcance (fluyo-018-18.test.cjs) los cubre. Aquí sigue lo que
     ninguno de los dos slices toca. */
  for (const f of ["js/model.js", "js/config.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/render.js", "js/geometry.js", "js/export.js", "js/share-url.js", "css/identity.css"]) {
    const head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    assert.equal(read(f), head, f + " sin cambios");
  }
});

test("sw.js: CACHE subido (v77 desde 018.18); lo que toca 018.17 sigue en el precache y nada de index.html queda fuera", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v91";/);
  for (const f of ["./index.html", "./css/system.css", "./css/styles.css", "./js/ui.js", "./js/editor-scenarios.js", "./docs/"]) assert.ok(sw.includes('"' + f + '"'), f + " precacheado");
  const html = read("index.html");
  const local = [...html.matchAll(/(?:src|href)="((?!https?:|#|data:)[^"]+\.(?:js|css|woff2|webmanifest|svg|png))"/g)].map((m) => m[1]).filter((u) => !u.startsWith("//"));
  for (const u of local) assert.ok(sw.includes('"./' + u.replace(/^\.\//, "") + '"') || sw.includes('"' + u + '"'), "en el precache: " + u);
});

test("index.html: ids conservados, nodos nuevos (pista, hogares, secciones de «Más») y comentario de los cuatro estados", () => {
  const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
  for (const id of ["btnStoryExit", "btnStoryExpand", "scRun", "scReset", "scScenarioTitle", "scStoryAdd", "scScenarioMenu", "scPaletteToggle", "scLibrarySection", "scEventNew", "scEventLibrary",
    "scNow", "scNowLabel", "scNowCaption", "scNowProgress", "btnPanel", "btnPanelClose", "btnStories", "scStoryboard", "scPlacementCancel", "scNotice", "grpAnim", "grpHelp", "noSel", "pagesBar", "tbConnect", "tbMulti"])
    assert.ok(html.includes('id="' + id + '"'), "existe #" + id);
  for (const id of ["scRunHint", "grpAnimHome", "grpHelpHome", "animSection", "helpSection"]) assert.ok(html.includes('id="' + id + '"'), "nuevo #" + id);
  assert.match(element(html, "scRunHint"), /class="scRunHint" hidden>Añade eventos desde Ampliar</);
  assert.ok(html.indexOf('id="grpAnimHome"') < html.indexOf('id="grpAnim"') && html.indexOf('id="grpHelpHome"') < html.indexOf('id="grpHelp"'), "los hogares preceden a su grupo");
  const more = element(html, "moreMenu");
  assert.ok(more.includes('id="animSection"') && more.includes('id="helpSection"'), "las secciones viven en «Más»");
  assert.match(element(html, "helpSection"), /Ayuda y gestos/);
  /* FLUYO-018.18 (D5): «Detener» en cualquier estado; «Terminar» ya no existe (ni en escritorio). */
  assert.match(html, /<button id="scReset" type="button" hidden>■ Detener<\/button>/, "«Detener» es la única palabra para parar");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [], "ids repetidos");
  assert.ok(!/NECT/.test(html.replace(/itsnect/g, "")), "sin branding");
});

test("system.css: 44 px para lo que cambia de estado, 40 para filas; campos a 16 px con dedo (al final, gana a los componentes)", () => {
  const sys = read("css/system.css");
  assert.match(sys, /--ctl-h-touch:44px;/);
  assert.match(sys, /--row-h-touch:40px;/);
  assert.match(sys, /@media \(pointer:coarse\)\{ :root\{ --ctl-h:var\(--ctl-h-touch\); \} \}/);
  assert.match(sys, /@media \(pointer:coarse\)\{ \.menuItem, \.scPopover > button\{ min-height:var\(--row-h-touch\); \} \}/, "los ítems de menú son filas");
  const last = sys.trimEnd().split("\n").slice(-1)[0];
  assert.match(last, /@media \(pointer:coarse\)\{ input\[type=number\], input\[type=text\], input\[type=search\], input:not\(\[type\]\), textarea, select\{ font-size:16px; \} \}/);
  assert.ok(!/--ctl-h-touch:40px/.test(sys));
});

test("styles.css: hoja de Historias por contenido con tope --canvas-useful, cuatro estados, fichas, un solo desplazable; Propiedades 40dvh; «＋» fijo", () => {
  const css = read("css/styles.css");
  const mobile = css.slice(css.indexOf("/* ---- Móvil (≤700 px) ---- */"));
  assert.match(mobile, /height:clamp\(220px, 40dvh, 360px\); z-index:45;/, "hoja de Propiedades a 40dvh");
  assert.match(mobile, /:root\{ --canvas-useful:max\(300px, 40dvh\); \}/, "el tope lo pone lo que el lienzo necesita");
  assert.match(mobile, /aside\.scenariosOpen\{height:auto; max-height:calc\(100dvh - 52px - var\(--bb-h\) - var\(--canvas-useful\)\); padding-top:12px; overflow:hidden;/, "altura por contenido; la hoja no desplaza");
  assert.match(mobile, /body\.storyMode \.scHeader\{display:grid; grid-template-columns:minmax\(0,1fr\) auto auto; grid-template-areas:"title menu expand" "run exit exit";/, "cabecera de dos filas");
  /* FLUYO-018.18: la envoltura del transporte (.scTransport) es la que se disuelve; los controles van en una fila propia */
  assert.match(mobile, /body\.storyMode \.storyBar, body\.storyMode \.scHeaderRow, body\.storyMode \.scTransport\{display:contents;\}/, "mismos nodos, mismos ids");
  assert.match(mobile, /body\.storyMode \.storyKicker, body\.storyMode #panelScenarios #scStoryAdd, body\.storyMode #scStoriesLabel, body\.storyMode #scStatus, body\.storyMode #scPaletteToggle\{display:none;\}/, "sin rótulo, «+» ni paleta en la hoja");
  assert.match(mobile, /#btnStoryExit\{grid-area:exit; justify-self:end;\}/, "«Volver a editar» en la fila B, fuera de cualquier scroll");
  /* FLUYO-018.18 (D4, D5): reproduciendo, la fila A es el transporte (el momento se lee SOBRE el lienzo, #scNow en #wrap) y
     terminada también hay «Detener» en la hoja. */
  assert.match(mobile, /body\[data-story="playing"\] \.scHeader\{grid-template-areas:"ctl ctl expand" "stop exit exit";\}/, "reproduciendo, la fila A es el transporte");
  assert.ok(!/#scNow\{grid-area:title;/.test(mobile), "el momento ya no ocupa la hoja");
  assert.ok(!/#panelScenarios\[data-sc-status="completed"\] #scReset\{display:none;\}/.test(mobile), "terminada: «Detener» a la vista");
  assert.match(mobile, /body\[data-story="compact"\] #scLibrarySection, body\[data-story="compact"\] \.scStorySection,\n\s*body\[data-story="playing"\] #scLibrarySection, body\[data-story="playing"\]:not\(\.storyExpanded\) \.scStorySection\{display:none;\}/, "qué se ve en cada estado");
  assert.match(mobile, /#scLibrarySection\{flex:none; display:flex; flex-direction:row; align-items:center;[^}]*overflow-x:auto;/, "fichas en un carril horizontal");
  assert.match(mobile, /\.scEventRow\{flex:none; min-height:var\(--ctl-h\); border:1px solid var\(--rule-2\); border-radius:var\(--r-pill\);/, "cada evento es una ficha de 44 px");
  assert.match(mobile, /\.scEventRow \.scMore\{min-width:var\(--ctl-h\); min-height:var\(--ctl-h\);/, "el ⋯ de la ficha, a tamaño de control");
  assert.match(mobile, /\.scStoryboardSection\{min-height:0; flex:1; overflow:auto;\}/, "la línea de tiempo es el único desplazable");
  /* FLUYO-018.23 (D4, D9): una fila de muestras en todos los layouts; con el dedo, de 32 px (--sw-size) */
  assert.match(read("css/styles.css"), /\.swatches\{[^}]*max-height:calc\(var\(--sw-size\) \+ 6px\);/, "una fila de muestras con el dedo");
  assert.match(read("css/system.css"), /@media \(pointer:coarse\)\{ :root\{ --sw-size:32px; \} \}/);
  assert.match(mobile, /#pagesBar > \.pgAdd\{position:sticky; right:0; width:var\(--ctl-h\); min-width:var\(--ctl-h\);/, "«＋» fijo a la derecha");
  assert.match(mobile, /footer \.tab:not\(\.active\)\{min-width:40px;/, "las demás pestañas, índice con objetivo de 40 px");
  assert.match(mobile, /\.modeBar button\{min-height:var\(--ctl-h\);/, "Historias y Presentar a tamaño de control (44 con dedo)");
  assert.ok(!/body\.scPlaybackOn #btnStoryExpand\{display:none;\}/.test(css), "Ampliar sigue disponible reproduciendo");
  assert.ok(!/32dvh|52dvh|20dvh/.test(mobile), "no quedan las alturas fijas de 018.14b");
  assert.match(css, /#scPlacementBar button\{flex:none; min-height:var\(--ctl-h\);/, "«Cancelar»/«Aplicar» a tamaño de control");
  assert.match(css, /@media \(pointer:coarse\)\{ textarea#lblEdit, #panelProperties \.row select,/, "16 px también donde una regla con id fija el tamaño");
});

test("ui.js: estado derivado, zona libre, suelo de zoom, toque en el vacío, reencaje en columna, M1–M3", () => {
  const ui = read("js/ui.js");
  assert.ok(ui.indexOf("const mqSheet=") < ui.indexOf("function refreshPanel(){"), "el layout se conoce antes de refreshPanel");
  assert.match(ui, /function storyState\(\)\{\n  if\(uiMode!=="story" \|\| \(isSheetLayout\(\) && !document\.body\.classList\.contains\("panelOpen"\)\)\) return "closed";\n  if\(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive\(\)\) return "playing";\n  return document\.body\.classList\.contains\("storyExpanded"\) \? "expanded" : "compact";\n\}/);
  assert.match(ui, /function syncStoryState\(\)\{ const st=storyState\(\); if\(document\.body\.dataset\.story!==st\) document\.body\.dataset\.story=st; \}/);
  for (const fn of ["function setUiMode(mode){", "function setStoryExpanded(on){", "function openSurface(name){", "function closeSurface(){", "function placeChrome(){"]) assert.ok(between(ui, fn, "\n}\n").includes("syncStoryState();"), fn + " sincroniza el estado");
  assert.ok(!/let storyState|var storyState|storyState=/.test(ui), "sin variable espejo: el estado se deriva");
  const vcr = between(ui, "function visibleCanvasRect(){", "\n}\n");
  /* 018.19: la misma resta por la altura de la hoja (sobre la barra inferior, o el borde si en apaisado no la hay) y, en apaisado,
     por la DERECHA con su anchura; colocando, la hoja apartada no cuenta. Lo detalla test/fluyo-018-19.test.cjs. */
  assert.ok(vcr.includes('floor=bb.height>0 ? bb.top : innerHeight') && vcr.includes("bottom=Math.min(bottom, floor - aside.offsetHeight)") && vcr.includes('$("touchBar")') && vcr.includes('$("scPlacementBar")'), "resta hoja (por su altura, no por su caja en transición), barra táctil y barra de colocación");
  assert.match(ui, /const REVEAL_MIN_ZOOM=0\.6;/);
  const reveal = between(ui, "function revealAboveSheet(what){", "\n}\n");
  assert.ok(reveal.includes("const v=visibleCanvasRect();") && reveal.includes("if(fit>=REVEAL_MIN_ZOOM){") && reveal.includes("if(viewZoom<REVEAL_MIN_ZOOM) viewZoom=REVEAL_MIN_ZOOM;") && reveal.includes("scStoryFocusPoint"), "encaja si cabe legible; si no, centra el paso sin bajar de 0,6");
  assert.ok(!/availH\/box\.h/.test(reveal), "ya no encaja la página a cualquier zoom");
  const tap = between(ui, "(function sheetTapOutside(){", "})();");
  assert.ok(tap.includes("if(hitNode(w.x,w.y) || hitEdge(w.x,w.y)) return;") && tap.includes("if(typeof scPlacement!==\"undefined\" && (scPlacement || scContext)) return;"), "en la ampliada solo el vacío reduce; colocando, nada");
  const setMode = between(ui, "function setUiMode(mode){", "\n}\n");
  assert.ok(setMode.includes("const fitAfter = story && uiMode!==\"story\" && !isSheetLayout() && !diagramCut();") && setMode.includes("if(fitAfter) requestAnimationFrame(()=>{ if(uiMode===\"story\" && !isSheetLayout() && diagramCut()) fitView(); });"), "reencaje solo si un diagrama que cabía queda cortado");
  const chrome = between(ui, "function placeChrome(){", "\n}\n");
  /* FLUYO-018.23 (D3): la ayuda vive siempre en «Más» (index.html); la animación sigue viajando (Lienzo ↔ Más) */
  assert.ok(chrome.includes("animSec.appendChild(anim)") && chrome.includes('$("grpAnimHome").after(anim)'), "M1: mismos nodos, ida y vuelta");
  const html17 = read("index.html");
  assert.ok(html17.slice(html17.indexOf('id="helpSection"')).indexOf('id="grpHelp"') > 0 && !html17.slice(html17.indexOf('<aside'), html17.indexOf('</aside>')).includes('id="grpHelp"'), "M2: la ayuda en «Más», fuera del panel");
  assert.ok(chrome.includes('$("btnPanel").hidden = mobile && selN.size+selE.size===0;'), "M2: ⚙ contextual al cambiar de layout");
  const rp = between(ui, "function refreshPanel(){", "\n}\n");
  assert.ok(rp.includes('if(total===0) scheduleSheetIdleCheck();'), "M2: sin selección se programa la comprobación al reposo");
  const idle = between(ui, "function scheduleSheetIdleCheck(){", "\n}");
  assert.ok(idle.includes("if(pointerBusy){ scheduleSheetIdleCheck(); return; }") && idle.includes('$("btnPanel").hidden=true;') && idle.includes('if(uiMode==="edit" && document.body.classList.contains("panelOpen")) closeSurface();'), "M2: al reposo (sin puntero apoyado), sin ⚙ y la hoja se cierra");
  assert.match(ui, /\$\("tbConnect"\)\.hidden = linking \|\| tm\.multi \|\| !\(s && s\.type==="node" && s\.obj\) \|\| document\.body\.classList\.contains\("storyMode"\);/, "M3");
  const expand = between(ui, '$("btnStoryExpand").onclick=()=>{', "\n};");
  /* FLUYO-018.18 (D5, D6): Ampliar solo amplía; «Detener» está en la hoja y la línea de tiempo ampliada sirve para saltar. */
  assert.ok(!expand.includes("scReset()"), "Ampliar ya no detiene la Historia terminada");
});

test("revisión manual: el rail enciende exactamente lo elegido; un fondo predefinido sustituye al color propio", () => {
  const ui = read("js/ui.js"), st = read("js/state.js");
  /* classList.toggle sin booleano INVIERTE la clase: la expresión daba undefined en Flecha e Imagen y los encendía a ratos */
  assert.ok(between(ui, "function syncRail(){", "\n}\n").includes('b.classList.toggle("toggled", !!('), "el estado de un botón del rail es siempre un booleano");
  assert.ok(ui.includes('$("themeSel").onchange=()=>{ setThemeIn(doc,{theme:$("themeSel").value, customBg:""}); syncProjectControls(); scheduleAutosave(); };'), "elegir un tema quita el color propio (si no, los predefinidos dejan de responder)");
  assert.ok(st.includes('if($("bgCustom")) $("bgCustom").value=doc.customBg || (THEMES[doc.theme]||THEMES.dark).bg;'), "sin color propio, el selector enseña el fondo del tema");
  assert.ok(!/data-ui-theme/.test(between(ui, '$("themeSel").onchange', "\n")), "cambiar el lienzo sigue sin tocar la interfaz");
});

test("editor-scenarios.js: seguimiento del paso activo, scroll solo del contenedor, zona libre, pista y paleta", () => {
  const es = read("js/editor-scenarios.js");
  assert.ok(!/scrollIntoView\(\{ block: "nearest" \}\)/.test(es.replace(/scVisualPicker[^\n]*/g, "")), "ningún scrollIntoView sobre filas (desplazaba la hoja)");
  assert.match(es, /function scScrollIntoView\(el\) \{/);
  assert.ok(between(es, "function scScrollIntoView(el) {", "\n}\n").includes("while (c && c !== document.body) {"), "busca el contenedor desplazable más cercano");
  const tick = between(es, "function scTick() {", "\n}\n");   /* 018.18: el reloj es el de la Historia (scNow), no el del fotograma */
  assert.ok(tick.includes("scRenderStoryboard();\n  scFollowActive();"), "scTick sigue el paso activo tras pintar la línea de tiempo");
  const follow = between(es, "function scFollowActive() {", "\n}\n");
  assert.ok(follow.includes('String(step.id) === String(scFollowedStep)) return;') && follow.includes("performance.now() - scUserScrollAt > 2000) scScrollIntoView(row);") && follow.includes("scTargetOffscreen(step)) scRevealTarget(step, false);") && follow.includes("const past = sc.steps.filter((s) => s.at <= cur);"), "solo al cambiar de paso; respeta el scroll manual; también los momentos instantáneos; trae el destino si sale");
  assert.ok(es.includes('for (const ev of ["wheel", "touchmove"]) board.addEventListener(ev'), "el scroll manual se detecta por rueda o dedo, no por el evento scroll (que también dispara el scroll programado)");
  assert.match(es, /function scVisibleRect\(\) \{\n  if \(typeof visibleCanvasRect === "function"\) return visibleCanvasRect\(\);/);
  assert.ok(between(es, "function scTargetOffscreen(step) {", "\n}\n").includes("const v = scVisibleRect(), n = step.nodeId ? nodeById(step.nodeId) : null;"), "un nodo cuenta entero");
  assert.match(es, /function scRevealTarget\(step, rerender = true\) \{/);
  assert.match(es, /function scStoryFocusPoint\(\) \{/);
  const buttons = between(es, "function scRenderButtons() {", "\n}\n");
  assert.ok(buttons.includes('$("scPaletteToggle").hidden = isScenarioPlaybackActive();') && buttons.includes('panel.setAttribute("data-sc-status", scStatus)') && buttons.includes('const show = sheet && scStatus === "idle" && !!s && !s.steps.length') && buttons.includes("syncStoryState()"), "paleta oculta reproduciendo; estado al CSS; pista sin pasos");
  assert.ok(between(es, "function scRun(opts) {", "\n}\n").includes("isSheetLayout()) setStoryExpanded(false);"), "reproducir recupera el lienzo (la ampliada vuelve al transporte)");
  assert.ok(between(es, "function scSyncCompact() {", "\n}\n").includes("!(typeof isSheetLayout === \"function\" && isSheetLayout())"), "la paleta flotante no es cosa de la hoja");
  assert.ok(!/storyCompactSheet/.test(es), "editor-scenarios ya no decide la compacta por la hoja");
  const notice = between(es, "function scNotice(message) {", "\n}\n");
  assert.ok(notice.includes("innerHeight - pb.getBoundingClientRect().top + 12") && notice.includes("b += aside.offsetHeight"), "el aviso se pone encima de la hoja o de la barra de colocación");
});

test("docs/index.html: los cuatro estados y el mando de la reproducción están explicados", () => {
  const d = read("docs/index.html");
  /* FLUYO-018.18: «Terminar» ya no existe; el mando es Pausar/Reanudar, anterior/siguiente y Detener */
  for (const t of ["<strong>compacta</strong>", "<strong>ampliada</strong>", "<strong>reproduciendo</strong>", "<strong>Pausar</strong>", "<strong>Detener</strong>"]) assert.ok(d.includes(t), t);
  assert.ok(!d.includes("«Terminar»"), "sin «Terminar»");
});

/* ───────── vm: scRenderButtons con el editor de Historias real (editor-scenarios.js) ───────── */
function editor(sheet) {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  for (const id of ["scNow", "scNowLabel", "scNowCaption", "scNowProgress", "scRunHint"]) register(id, ctx.document.createElement(id === "scNow" ? "div" : "span"));
  ctx.run('$("scNow").hidden = true; $("scRunHint").hidden = true;');
  ctx.isSheetLayout = () => sheet;
  ctx.states = [];
  ctx.syncStoryState = () => ctx.states.push("sync");
  ctx.confirm = () => true;
  ctx.renderTabs = () => ctx.run("scSyncPage()");
  ensureUI(ctx);
  ctx.run(`(function(){
    const pago=createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
    const s=createScenario(P(),"Camino feliz");
    createStep(s,{at:0,action:"SEND",edgeId:edgeId,eventTypeId:pago.id});
    createStep(s,{at:1000,action:"SEND",edgeId:edgeId,eventTypeId:pago.id});
    scSelectStory(s.id); scRenderPanel();
  })()`);
  return ctx;
}

test("vm: reproduciendo no hay paleta; el estado va al panel; terminada dice «Detener» (018.18, D5)", () => {
  const ctx = editor(false);
  assert.equal(ctx.run('$("scPaletteToggle").hidden'), false);
  assert.equal(ctx.run('$("panelScenarios").getAttribute("data-sc-status")'), "idle");
  ctx.run("scRun()");
  assert.equal(ctx.run('$("scPaletteToggle").hidden'), true, "nada inerte mientras se reproduce");
  assert.equal(ctx.run('$("panelScenarios").getAttribute("data-sc-status")'), "running");
  ctx.run('scStatus="completed"; scRenderButtons();');
  assert.equal(ctx.run('$("panelScenarios").getAttribute("data-sc-status")'), "completed");
  assert.equal(ctx.run('$("scReset").textContent'), "■ Detener");
  ctx.run("scReset()");
  assert.equal(ctx.run('$("scPaletteToggle").hidden'), false);
  assert.ok(ctx.states.length >= 3, "cada cambio de botones sincroniza el estado de la hoja");
});

test("vm: en la hoja, una Historia sin pasos enseña «Añade eventos desde Ampliar» en vez del botón apagado; en columna, no", () => {
  for (const sheet of [true, false]) {
    const ctx = editor(sheet);
    assert.equal(ctx.run('$("scRunHint").hidden'), true, "con pasos no hay pista");
    ctx.run('const s2=createScenario(P(),"Vacía"); scSelectStory(s2.id); scRenderPanel();');
    assert.equal(ctx.run('$("scRun").disabled'), true);
    assert.equal(ctx.run('$("scRunHint").hidden'), !sheet, sheet ? "hoja: pista visible" : "columna: sin pista (el título del botón lo explica)");
    assert.equal(ctx.run('$("scRun").hidden'), sheet);
  }
});
