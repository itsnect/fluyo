"use strict";
/* FLUYO-018.14b — Historias como modo, panel por grupos, cabecera de tres zonas, interfaz oscura y hojas táctiles.
   Comprobaciones estáticas y en vm (rápidas, sin navegador). Lo que solo se ve pintado (medidas, porcentajes de lienzo,
   objetivos táctiles, contraste) lo mide test/fluyo-018-14b-browser.cjs en Chrome real.
   · Alcance: el kernel (model.js y compañía) e identity.css idénticos a HEAD; el tema de la interfaz no toca el documento.
   · Interfaz oscura COMPLETA: cada token semántico del chrome se redefine; styles.css no reintroduce tintes sueltos.
   · Cabecera: modo (Editar · Historias) con los ids de las antiguas pestañas; Presentar primaria; «Lienzo» = documento;
     «Más» = archivo + interfaz + proyecto.
   · Panel: grupos <details> con los abiertos por defecto decididos (B6) y TODAS las filas de propiedades dentro.
   · Historia: salida «Volver a editar», «Terminar» en vez del doble sentido (B2), salida nunca bloqueada (B3),
     bloque «Reproduciendo» con la lectura de Present (B9). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const { makeScenarioUIContext, buildExample, setupPanel, ensureUI } = require("./fluyo-016-harness.cjs");

const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };
/* El bloque de un elemento por id (cuenta aperturas y cierres de su etiqueta). */
function element(html, id) {
  const i = html.indexOf('id="' + id + '"'); assert.ok(i >= 0, "no existe #" + id);
  const start = html.lastIndexOf("<", i), tag = /^<(\w+)/.exec(html.slice(start))[1];
  const re = new RegExp("<(/?)" + tag + "\\b[^>]*>", "g"); re.lastIndex = start; let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return html.slice(start, re.lastIndex); }
  throw new Error("sin cerrar #" + id);
}

/* FLUYO-018.15 cambió model.js en un solo punto (el color con el que nace un nodo y el comentario del respaldo
   histórico; su diff exacto lo fija fluyo-018-15.test.cjs). Se deshace aquí para seguir vigilando todo lo demás. */
const undo15 = (s) => s.replace("color:DEFAULT_NODE_COLOR, fill:null", "color:PALETTE[0].c, fill:null").replace(/  \/\* Respaldo HISTÓRICO[\s\S]*?MCP\. \*\/\n/, "");
test("alcance: kernel, identity.css y el formato intactos (git HEAD)", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js", "css/identity.css"]) {
    const head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
    assert.equal(undo15(read(f)), head, f + " sin cambios");
  }
});

test("sw.js: CACHE v73; los archivos que toca 018.14b ya estaban en el precache", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v75";/);
  for (const f of ["./index.html", "./css/system.css", "./css/styles.css", "./js/ui.js", "./js/editor-scenarios.js", "./js/editor-share.js", "./js/interaction.js"]) assert.ok(sw.includes('"' + f + '"'), f + " precacheado");
});

test("tema de la interfaz: preferencia del navegador, aplicada antes de pintar y separada del documento", () => {
  const html = read("index.html"), ui = read("js/ui.js");
  const head = html.slice(0, html.indexOf("</head>"));
  const boot = head.indexOf('localStorage.getItem("fluyo.ui.theme")'), css = head.indexOf('<link rel="stylesheet" href="css/identity.css">');
  assert.ok(boot > 0 && boot < css, "el <head> aplica data-ui-theme antes de cargar las hojas (sin destello)");
  assert.match(head, /setAttribute\("data-ui-theme","dark"\)/);
  const script = head.slice(head.lastIndexOf("<script>", boot), head.indexOf("</script>", boot));
  assert.doesNotMatch(script, /addEventListener|DOMContentLoaded|setTimeout|requestAnimationFrame|defer|async/, "se ejecuta en el acto, no después de cargar");
  const theme = between(ui, "const UI_THEME_KEY", "/* ===================== Cabecera adaptable");
  assert.match(theme, /const UI_THEME_KEY="fluyo\.ui\.theme";/);
  assert.match(theme, /try\{ return localStorage\.getItem\(UI_THEME_KEY\)/, "leer está protegido (localStorage inaccesible)");
  assert.match(theme, /try\{ if\(theme==="dark"\) localStorage\.setItem/, "guardar está protegido");
  assert.doesNotMatch(theme, /doc\.|settings\.|setThemeIn|scheduleAutosave|serializeProject|pushUndo/, "el tema de la interfaz no lee ni escribe el documento");
  for (const f of ["js/model.js", "js/state.js", "js/export.js", "js/share-url.js", "js/deeplink.js", "js/editor-share.js"]) assert.ok(!read(f).includes("fluyo.ui.theme") && !/data-ui-theme/.test(read(f)), f + " no conoce el tema de la interfaz");
  /* y al revés: el selector del tema del lienzo solo escribe el documento */
  assert.match(ui, /\$\("themeSel"\)\.onchange=\(\)=>\{ setThemeIn\(doc,\{theme:\$\("themeSel"\)\.value\}\); scheduleAutosave\(\); \};/);
  assert.ok(!/data-ui-theme/.test(between(ui, '$("themeSel").onchange', "\n")), "cambiar el lienzo no toca la interfaz");
});

test("interfaz oscura completa: cada token semántico del chrome se redefine en [data-ui-theme=dark]", () => {
  const sys = read("css/system.css");
  const rootBlock = between(sys, ":root{", "\n}\n");
  const dark = between(sys, ':root[data-ui-theme="dark"]{', "\n}\n");
  const semantic = ["--surface", "--surface-raised", "--surface-sunken", "--surface-inverse", "--ink", "--ink-2", "--ink-3", "--ink-off", "--ink-inverse",
    "--rule", "--rule-2", "--rule-ink", "--active", "--active-ink", "--active-veil", "--active-rule", "--attention", "--attention-hover", "--attention-veil",
    "--attention-rule", "--attention-fill", "--attention-fill-hover", "--hover-veil", "--press-veil", "--surface-hover", "--rule-hover", "--focus",
    "--sw-a", "--sw-b", "--swatch-edge", "--shadow-menu", "--shadow-float", "--shadow-frame", "--shadow-sheet", "--scrim", "--select-arrow"];
  for (const t of semantic) {
    assert.ok(new RegExp("(^|[\\s;{])" + t + ":").test(rootBlock), t + " existe en :root");
    assert.ok(new RegExp("(^|[\\s;{])" + t + ":").test(dark), t + " se redefine en la interfaz oscura");
  }
  assert.match(dark, /color-scheme:dark;/);
  /* los tintes que antes iban sueltos en las reglas ahora son tokens: si vuelven, el oscuro queda a medias */
  const styles = read("css/styles.css");
  const loose = styles.split("\n").filter((l) => /rgba\((22,21,15|78,90,63|163,58,34),/.test(l) && !/#presentBar|#presentStory|background:rgba\(22,21,15,\.(86|72)\)/.test(l));
  assert.deepEqual(loose, [], "styles.css sin tintes del chrome escritos a mano (solo el material de Present)");
  for (const rule of ["button.primary{ background:var(--attention-fill)", "button.toggled, button[aria-pressed=\"true\"]{ background:var(--active-veil); border-color:var(--active-rule)", "background-image:var(--select-arrow);"])
    assert.ok(sys.includes(rule), "componente con token: " + rule);
});

test("cabecera de tres zonas: modo, «Lienzo» (documento) y salida; Presentar es la primaria", () => {
  const html = read("index.html");
  const header = element(html, "btnUndo") && html.slice(html.indexOf("<header>"), html.indexOf("</header>"));
  const mode = element(html, "modeSwitch");
  assert.match(mode, /id="tabProperties" class="segBtn active"[^>]*aria-pressed="true"/);
  assert.match(mode, /id="tabScenarios" class="segBtn"[^>]*aria-pressed="false"/);
  assert.match(element(html, "btnPresent"), /class="primary"/);
  assert.doesNotMatch(element(html, "btnExport"), /class="primary"/);
  assert.doesNotMatch(element(html, "btnShare"), /class="(primary|btnGhost)/, "Compartir es secundaria (con borde)");
  const canvas = element(html, "canvasMenu"), more = element(html, "moreMenu");
  for (const id of ["themeSel", "bgCustom", "btnBgClear", "fontGlobalSel", "chkGrid", "chkSnap"]) {
    assert.ok(canvas.includes('id="' + id + '"'), id + " está en «Lienzo»");
    assert.ok(!more.includes('id="' + id + '"'), id + " no está en «Más» (en móvil llega moviendo el mismo nodo)");
  }
  for (const id of ["btnDemo", "btnJsonIn", "btnJsonOut", "btnClear", "chkUiDark"]) assert.ok(more.includes('id="' + id + '"'), id + " está en «Más»");
  assert.ok(!canvas.includes("chkUiDark"), "el tema de la interfaz no está entre los ajustes del documento");
  const outside = header.replace(canvas, "").replace(more, "");
  for (const id of ["btnDemo", "btnClear", "btnJsonIn", "btnJsonOut", "themeSel"]) assert.ok(!outside.includes('id="' + id + '"'), id + " ya no compite en la cabecera");
  assert.equal((header.match(/class="vdivider hdrDiv/g) || []).length, 3);
  assert.ok(!/NECT/.test(html.replace(/itsnect/g, "")), "sin branding NECT");
});

test("ids únicos y sprite coherente: cada <use> resuelve, ningún símbolo repetido", () => {
  const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual([...new Set(dup)], [], "ids repetidos");
  const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const uses = [...html.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(uses.filter((u) => !symbols.has(u)), [], "<use> sin símbolo");
  for (const id of ["i-pen", "i-canvas", "i-chev", "i-chev-up", "i-arrow-left", "i-moon", "i-swatch"]) assert.ok(symbols.has(id), id);
  /* el rail: solo icono, con nombre accesible y tooltip; sin etiquetas de texto visibles sueltas */
  const rail = html.slice(html.indexOf('<nav class="rail"'), html.indexOf("</nav>", html.indexOf('<nav class="rail"')));
  const buttons = rail.match(/<button[\s\S]*?<\/button>/g);
  assert.equal(buttons.length, 12);
  for (const b of buttons) { assert.match(b, /data-tip="[^"]+" data-tip-pos="right"/); assert.match(b, /<span class="lbl">[^<]+<\/span>/); assert.doesNotMatch(b, / title="/); }
});

test("panel: grupos plegables con los abiertos de B6 y todas las propiedades dentro (inventario)", () => {
  const html = read("index.html");
  const sel = element(html, "selBody");
  const groups = [...sel.matchAll(/<details class="pgroup" id="(\w+)" data-group="([^"]+)"( open)?>/g)].map((m) => ({ id: m[1], name: m[2], open: !!m[3] }));
  assert.deepEqual(groups.map((g) => g.name), ["Texto", "Forma y color", "Código", "Recorrido", "Trazo", "Flujo", "Capas y aparición"]);
  assert.deepEqual(groups.filter((g) => g.open).map((g) => g.id), ["grpText", "grpShape", "grpRoute", "grpStroke"], "abiertos: lo que se toca en cada elemento");
  const rows = ["rowFs", "rowFont", "rowBold", "rowTextColor", "rowLblPos", "rowTextBg", "rowShape", "rowColor", "rowTint", "rowFill", "rowBorder", "rowLang", "rowKeywords", "rowKwBg", "rowKwColor",
    "rowRoute", "rowFrom", "rowTo", "rowLineC", "rowDotC", "rowDash", "rowArrS", "rowArrE", "rowAnim", "rowSpeedF", "rowDotsGlobal", "rowDots", "rowFlow", "rowZ", "rowPulse", "rowOrder"];
  for (const r of rows) assert.ok(groups.some((g) => element(html, g.id).includes('id="' + r + '"')), r + " vive en un grupo");
  assert.ok(sel.indexOf('id="rowLabel"') < sel.indexOf("<details"), "el texto va fuera y antes de los grupos");
  assert.match(element(html, "grpAnim"), /id="btnPlay"/);
  assert.doesNotMatch(element(html, "grpAnim"), / open/, "Animación del lienzo plegada");
  assert.doesNotMatch(element(html, "grpHelp"), / open/, "la ayuda de atajos plegada (ya no es el estado vacío)");
  const styles = read("css/styles.css");
  assert.match(styles, /aside\{\n  width:288px; flex:none;/, "panel de 288 px en escritorio");
  assert.match(styles, /aside\.scenariosOpen\{box-sizing:border-box;width:320px;flex:0 0 320px;/);
  assert.match(styles, /\.swatches\{[^}]*max-height:46px; overflow:hidden;/, "muestras en dos filas");
  const ui = read("js/ui.js");
  assert.match(ui, /d\.open = !sheet && \["grpText","grpShape","grpRoute","grpStroke"\]\.includes\(d\.id\);/, "móvil: todo plegado; escritorio: B6");
  assert.match(ui, /if\(!s \|\| !s\.obj\)\{ syncPanelGroups\(\); return; \}/);
});

test("modo Historia: una sola fuente (uiMode), salida que nunca se bloquea, rail fuera", () => {
  const ui = read("js/ui.js"), es = read("js/editor-scenarios.js"), styles = read("css/styles.css"), html = read("index.html");
  assert.match(ui, /let uiMode="edit";/);
  assert.match(ui, /function activeSurface\(\)\{ return uiMode==="story" \? "stories" : "properties"; \}/);
  assert.match(ui, /function switchPanelTab\(tab\)\{ setUiMode\(tab==="scenarios" \? "story" : "edit"\); \}/);
  const setMode = between(ui, "function setUiMode(mode){", "\n}\n");
  assert.match(setMode, /if\(!story && playing && typeof scReset==="function"\) scReset\(\);/, "salir detiene la Historia (B3)");
  assert.match(setMode, /document\.body\.classList\.toggle\("storyMode", story\);/);
  assert.doesNotMatch(es.slice(es.indexOf("function scRun("), es.indexOf("function scReset(")), /tabProp(erties)?.*disabled = true/, "Editar ya no se deshabilita al reproducir");
  assert.match(element(html, "panelScenarios"), /id="btnStoryExit"[\s\S]*Volver a editar/);
  assert.match(html, /<button id="scReset" type="button" hidden>Terminar<\/button>/);
  assert.match(read("js/editor-share.js"), /Pulsa «Terminar» antes de compartir\./);
  assert.match(styles, /body\.storyMode \.rail\{display:none;\}/);
  assert.match(read("js/interaction.js"), /!document\.body\.classList\.contains\("storyMode"\)\) setMode\("connect"\)/, "C no arma una herramienta invisible");
});

test("hojas móviles: cierre propio, toque fuera y dos alturas de Historias (CSS + ui.js)", () => {
  const styles = read("css/styles.css"), ui = read("js/ui.js");
  const mobile = styles.slice(styles.indexOf("/* ---- Móvil (≤700 px) ---- */"));
  assert.match(mobile, /body:not\(\.storyMode\) \.sheetHead\{display:flex;/);
  assert.match(mobile, /\.sheetHead \.sheetClose\{display:inline-flex; min-width:40px;/);
  assert.match(mobile, /aside\.scenariosOpen\{height:clamp\(200px, 32dvh, 280px\);/);
  assert.match(mobile, /body\.storyExpanded aside\.scenariosOpen\{height:calc\(100dvh - var\(--bb-h\) - 52px - 20dvh\);\}/, "ampliada deja una franja de lienzo");
  assert.match(mobile, /#btnStoryExpand\{display:inline-flex;\}/);
  const tap = between(ui, "(function sheetTapOutside(){", "})();");
  assert.match(tap, /Math\.hypot\(ev\.clientX-d\.x, ev\.clientY-d\.y\)>8/, "un arrastre no es un toque");
  assert.match(tap, /if\(uiMode==="edit" && selN\.size\+selE\.size===0 && !tm\.multi && tm\.link===null\) closeSurface\(\);/);
  assert.match(tap, /else if\(uiMode==="story" && document\.body\.classList\.contains\("storyExpanded"\)\) setStoryExpanded\(false\);/);
});

/* ───────── vm: el transporte y el bloque «Reproduciendo» con el editor de Historias real (editor-scenarios.js) ───────── */
function editor() {
  const { ctx, register } = makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx, register);
  for (const id of ["scNow", "scNowLabel", "scNowCaption", "scNowProgress"]) register(id, ctx.document.createElement(id === "scNow" ? "div" : "span"));
  ctx.run('$("scNow").hidden = true;');
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

test("vm: glifos como trazo sin cambiar el texto; «Terminar»; «Reproduciendo» con momento y progreso; Editar habilitado", () => {
  const ctx = editor();
  assert.equal(ctx.run('$("scRun").textContent'), "▶ Reproducir", "el texto (contrato de los tests) no cambia");
  assert.equal(ctx.run('$("scScenarioTitle").textContent'), "Camino feliz ▾");
  assert.ok(ctx.run('$("scRun").children.some((c)=>/glyph g-play/.test(c.className))'), "el ▶ es un .glyph pintado con máscara");
  assert.equal(ctx.run('$("scNow").hidden'), true, "sin reproducir no hay bloque «Reproduciendo»");
  ctx.run("scRun()");
  assert.equal(ctx.run("scStatus"), "running");
  assert.equal(ctx.run('$("tabProperties").disabled'), undefined, "Editar no se deshabilita (B3)");
  assert.equal(ctx.run('$("scReset").textContent'), "■ Detener");
  assert.equal(ctx.run('$("scNow").hidden'), false);
  assert.equal(ctx.run('$("scNowLabel").textContent'), "Reproduciendo");
  assert.match(ctx.run('$("scNowCaption").textContent'), /Pago/, "el momento en curso (FluyoStory.describe)");
  assert.equal(ctx.run('$("scNowProgress").textContent'), "1 / 2");
  ctx.run('scStatus="completed"; scRenderButtons(); scRenderStatus();');
  assert.equal(ctx.run('$("scReset").textContent'), "Terminar", "B2: terminar ya no se llama «Volver a editar»");
  assert.equal(ctx.run('$("scRun").textContent'), "↻ Repetir");
  assert.equal(ctx.run('$("scNowLabel").textContent'), "Terminada");
  assert.match(ctx.run('$("scNowCaption").textContent'), /Reproducción terminada/);
  ctx.run("scReset()");
  assert.equal(ctx.run('$("scNow").hidden'), true);
});
