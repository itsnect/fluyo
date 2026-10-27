"use strict";
/* FLUYO-018.23 — Panel de Propiedades: menos complejidad, misma capacidad. Contratos estáticos y en vm (rápidos, sin navegador).
   Lo que solo se ve pintado (pantallas de scroll, tamaños, superposición, teclado real, plegado, Historia/Present, Undo con el
   documento real) lo mide test/fluyo-018-23-browser.cjs en Chrome.
   · Alcance: kernel, model.js, formato, render, Viewer, Share y MCP sin cambios; CACHE v81.
   · Inventario: todos los ids de campo de antes siguen existiendo una sola vez; jerarquía por tipo (D1, D5, D7).
   · Separación (D3): animación del lienzo en «Lienzo» (escritorio) y «Más» (móvil); ayuda en «Más»; nada de eso en el panel.
   · Segmentados (D6, P1, P2): sobre su control nativo, con teclado, sin nowrap; las puntas escriben los MISMOS dos booleanos.
   · Color (D4, P3): una fila; el pozo «Personalizado» nunca rancio.  Activo = oliva (D8).  Plegado (D2).  Móvil (D9). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j + b.length); };
/* el elemento con ese id, hasta su etiqueta de cierre (anidamiento contado) */
function element(html, id) {
  const i = html.indexOf('id="' + id + '"'); assert.ok(i >= 0, "falta #" + id);
  const start = html.lastIndexOf("<", i), tag = html.slice(start + 1).match(/^\w+/)[0];
  const re = new RegExp("<" + tag + "\\b|</" + tag + ">", "g"); re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[0][1] === "/" ? -1 : 1; if (!depth) return html.slice(start, m.index + m[0].length); }
  throw new Error("sin cierre: #" + id);
}
const html = read("index.html"), ui = read("js/ui.js"), styles = read("css/styles.css"), system = read("css/system.css");

/* ───────── alcance y release ───────── */
test("alcance: kernel, model.js, formato, render, Viewer y Share idénticos a HEAD (sin dependencia nueva)", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js",
    "js/story-authoring.js", "js/story-clock.js", "js/render.js", "js/geometry.js", "js/export.js", "js/state.js", "js/selection.js", "js/interaction.js",
    "js/editor-scenarios.js", "js/share-url.js", "js/link-codec.js", "js/viewer.js", "js/present-story.js", "s/index.html", "css/share.css", "css/identity.css"]) {
    let head;
    try { head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n"); } catch { return; }   // sin git
    assert.equal(read(f), head, f + " sin cambios");
  }
});

test("release: CACHE v81 y ningún archivo servido nuevo", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v113";/);
  const local = [...html.matchAll(/(?:src|href)="((?!https?:|#|data:)[^"]+\.(?:js|css|woff2))"/g)].map((m) => m[1]);
  for (const u of local) assert.ok(sw.includes('"./' + u.replace(/^\.\//, "") + '"'), "en el precache: " + u);
});

/* ───────── inventario: ninguna capacidad se pierde ───────── */
const FIELD_IDS = ["lblEdit", "fsIn", "fontSel", "boldChk", "shapeSel", "borderSel", "lblPosSel", "tintChk", "langSel", "kwEdit", "routeSel", "fromSel", "toSel",
  "dashChk", "arrSChk", "arrEChk", "animChk", "flowSel", "flowSeg", "speedFacSel", "dotsGlobalChk", "edgeDotsIn", "pulseChk", "orderIn", "btnWps", "btnDel",
  "btnFront", "btnBack", "btnForward", "btnBackward", "btnEyedrop", "swatches", "fillSw", "textBgSw", "textColorSw", "kwBgSw", "kwColorSw", "lineSw", "dotSw",
  "strokeCustom", "fillCustom", "textBgCustom", "textColorCustom", "kwBgCustom", "kwColorCustom", "lineCustom", "dotCustom", "multiSel", "mCopy", "mCut", "mDup",
  "mDel", "multiCount", "grpAnim", "grpHelp", "noSel", "selMeta", "btnPlay", "speedIn", "dotsIn", "chkSingle", "buildChk", "staggerIn",
  "rowLabel", "rowFs", "rowFont", "rowBold", "rowTextColor", "rowLblPos", "rowTextBg", "rowShape", "rowColor", "rowTint", "rowFill", "rowBorder", "rowLang",
  "rowKeywords", "rowKwBg", "rowKwColor", "rowRoute", "rowFrom", "rowTo", "rowLineC", "rowDotC", "rowDash", "rowArrS", "rowArrE", "rowAnim", "rowSpeedF",
  "rowDotsGlobal", "rowDots", "rowFlow", "rowZ", "rowPulse", "rowOrder", "dirKicker", "grpText", "grpShape", "grpCode", "grpRoute", "grpStroke", "grpFlow",
  "grpLayers", "grpAnimHome", "grpHelpHome", "animSection", "helpSection", "propSheetHead", "btnPanel", "btnPanelClose", "panelProperties", "selBody"];
test("inventario: todos los ids de campo, fila y grupo de antes siguen existiendo, una sola vez", () => {
  for (const id of FIELD_IDS) assert.equal(html.split('id="' + id + '"').length - 1, 1, "#" + id + " una vez");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size, "ningún id duplicado (un solo panel para escritorio y móvil, D9)");
});

test("jerarquía (D1, D5, D7): nodo = Apariencia · Texto · Código · Movimiento; conexión = Trazo · Dirección · Puntos; abiertos los primarios", () => {
  const sel = element(html, "selBody");
  const groups = [...sel.matchAll(/<details class="pgroup" id="(\w+)" data-group="([^"]+)"( open)?>/g)].map((m) => ({ id: m[1], name: m[2], open: !!m[3] }));
  assert.deepEqual(groups.map((g) => g.id + ":" + g.name), ["grpShape:Apariencia", "grpText:Texto", "grpCode:Código", "grpLayers:Movimiento", "grpStroke:Trazo", "grpRoute:Dirección", "grpFlow:Puntos"]);
  assert.match(ui, /function primaryGroups\(kind\)\{ return kind==="edge" \? \["grpStroke","grpRoute"\] : \["grpShape","grpText"\]; \}/);
  assert.match(between(ui, "function applyGroupDefaults(kind){", "\n}\n"), /d\.open = !sheet && open\.includes\(d\.id\);/, "en la hoja, todo plegado (acordeón, D9)");
  const has = (g, ids) => { const e = element(html, g); for (const r of ids) assert.ok(e.includes('id="' + r + '"'), r + " en " + g); };
  has("grpShape", ["rowShape", "rowColor", "rowTint", "rowFill", "rowBorder", "btnEyedrop"]);
  has("grpText", ["rowFont", "rowFs", "rowBold", "rowTextColor", "rowTextBg", "rowLblPos"]);
  has("grpCode", ["rowLang", "rowKeywords", "codeTextHome", "rowKwColor", "rowKwBg"]);
  has("grpLayers", ["rowPulse", "rowOrder"]);
  has("grpStroke", ["rowLineC", "rowDash", "rowRoute", "btnWps", "rowEnds", "rowFrom", "rowTo"]);
  has("grpRoute", ["rowArrows", "arrowSeg", "rowArrS", "rowArrE", "rowAnim", "flowNote", "rowFlow", "flowSeg", "flowSel"]);
  has("grpFlow", ["rowDotC", "rowSpeedF", "rowDotsGlobal", "rowDots"]);
  has("propSheetHead", ["selTitle", "selMeta", "rowZ", "btnOrder", "orderMenu", "btnFront", "btnForward", "btnBackward", "btnBack", "btnDel", "btnPanelClose"]);
  /* D7: un code reúne en Código lo que es del BLOQUE: el color del código y el fondo del bloque van allí (mismos nodos) */
  const place = between(ui, "function placePanelRows(kind){", "\n}\n");
  assert.ok(place.includes('$("codeTextHome").after(tc, tb)') && place.includes('$("rowFont").after(tc, tb)'), "color y fondo del texto: Código en un code, Texto en lo demás");
  assert.ok(place.includes("body.appendChild(text)"), "el Texto de una conexión va al final");
  /* 018.14a: el bloque sigue sin caja de palabra clave por defecto */
  assert.match(read("js/config.js"), /codeKwBg:""/);
});

test("refreshPanel: las filas por tipo de siempre, todas en su lista; el panel lee la selección en un solo sitio", () => {
  const rp = between(ui, "function refreshPanel(){", "\n}\n");
  for (const r of ["rowColor", "rowTint", "rowFill", "rowBorder", "rowLblPos", "rowTextBg", "rowTextColor", "rowShape", "rowPulse", "rowOrder", "rowLang", "rowKeywords", "rowKwBg", "rowKwColor"])
    assert.ok(between(rp, "const nodeRows=[", "];").includes('"' + r + '"'), "nodo: " + r);
  for (const r of ["rowRoute", "rowEnds", "rowFrom", "rowTo", "rowAnim", "rowSpeedF", "rowDotsGlobal", "rowDots", "rowDash", "rowArrows", "rowArrS", "rowArrE", "rowFlow", "rowLineC", "rowDotC"])
    assert.ok(between(rp, "const edgeRows=[", "];").includes('"' + r + '"'), "conexión: " + r);
  assert.match(rp, /if\(kind!==panelKind\)\{ panelKind=kind; placePanelRows\(kind\); applyGroupDefaults\(kind\); \}/, "los primarios se aplican al cambiar de TIPO");
  assert.match(rp, /if\(!s \|\| !s\.obj\)\{ syncPanelGroups\(\); return; \}/);
  assert.match(element(html, "dirKicker"), /hidden/, "el rótulo «Dirección» ya es el del grupo (no cuenta como fila visible en un nodo)");
});

/* ───────── separación de responsabilidades (D3) ───────── */
test("separación (D3): Propiedades solo habla de la selección; animación en «Lienzo»/«Más», ayuda en «Más»", () => {
  const aside = element(html, "propPanel");
  for (const id of ["grpAnim", "grpHelp", "btnPlay", "speedIn", "buildChk", "chkSingle"]) assert.ok(!aside.includes('id="' + id + '"'), "#" + id + " fuera del panel");
  assert.ok(element(html, "canvasMenu").includes('id="grpAnimHome"') && element(html, "canvasMenu").includes('id="grpAnim"'), "la animación vive en «Lienzo»");
  assert.ok(element(html, "helpSection").includes('id="grpHelp"') && !/<section id="helpSection"[^>]* hidden/.test(html), "la ayuda en «Más», visible en todas las anchuras");
  const chrome = between(ui, "function placeChrome(){", "\n}\n");
  assert.ok(chrome.includes("animSec.appendChild(anim)") && chrome.includes('$("grpAnimHome").after(anim)'), "la animación viaja Lienzo ↔ Más (mismo nodo)");
  assert.ok(!chrome.includes("helpSec.appendChild(help)"), "la ayuda ya no viaja al panel");
});

/* ───────── segmentados (P1, P2, D6) ───────── */
test("segmentados: radiogroup sobre su control nativo; los valores son los del nativo; teclado completo; sin nowrap (P1, P2)", () => {
  const pairs = [["shapeSeg", "shapeSel"], ["borderSeg", "borderSel"], ["langSeg", "langSel"], ["routeSeg", "routeSel"], ["speedSeg", "speedFacSel"], ["flowSeg", "flowSel"]];
  for (const [seg, sel] of pairs) {
    const segVals = [...element(html, seg).matchAll(/data-v="([^"]+)"/g)].map((m) => m[1]);
    const selVals = [...element(html, sel).matchAll(/value="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(segVals, selVals, seg + " = valores de #" + sel);
    assert.match(element(html, seg), /role="radiogroup"/);
    assert.match(element(html, sel), /class="srOnly" tabindex="-1" aria-hidden="true"/, "#" + sel + " sigue siendo la fuente de verdad, fuera del tabulador");
    assert.ok(ui.includes('segOnSelect("' + seg + '","' + sel + '");'), seg + " escribe a través de #" + sel);
  }
  assert.deepEqual([...element(html, "flowSeg").matchAll(/data-flow="(\w+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]), [["normal", "Hacia el destino"], ["reverse", "Hacia el origen"], ["alternate", "Ida y vuelta"]], "flowDir: mismos valores y nombres (161)");
  const bind = between(ui, "function segBind(id, onPick){", "\n}\n");
  assert.ok(bind.includes('seg.addEventListener("keydown", ev=>{'), "el segmentado escucha el teclado (P2)");
  for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End", '" "', "Enter"]) assert.ok(bind.includes(k), "tecla " + k);
  assert.ok(bind.includes("ev.stopPropagation()") && bind.includes("list[j].focus(); list[j].click();"), "las flechas mueven y eligen, sin llegar a los atajos del lienzo");
  assert.match(styles, /#panelProperties \.seg > \.segBtn\{white-space:normal;/, "P1: el texto parte, no se superpone (gana a #panelProperties button)");
  assert.match(ui, /\$\("flowSel"\)\.onchange=\(\)=>\{ const e=singleEdge\(\); if\(e\)\{ pushUndo\(\); editEdge\(e,\{flowDir:\$\("flowSel"\)\.value\}\); scheduleAutosave\(\); syncFlowSeg\(e\); \} \};/, "flowDir con un Undo, como antes");
});

/* El segmentado de puntas en vm: las 16 transiciones escriben EXACTAMENTE lo que escribirían los dos interruptores. */
test("puntas (D6): Ninguna · Inicio · Fin · Ambas sobre startArrow/endArrow; solo el campo que cambia; un Undo", () => {
  assert.deepEqual([...element(html, "arrowSeg").matchAll(/data-v="(\w+)" aria-label="(\w+)"/g)].map((m) => m[1] + ":" + m[2]), ["none:Ninguna", "start:Inicio", "end:Fin", "both:Ambas"]);
  const src = between(ui, "const ARROW_NAMES=", "\n}\n") + "\n" + between(ui, 'segBind("arrowSeg", v=>{', "\n});");
  const ctx = { pushUndo() { ctx.undo++; }, editEdge(e, p) { ctx.patches.push(p); Object.assign(e, p); }, scheduleAutosave() {}, refreshPanel() {}, segSync() {}, $: () => ({ textContent: "" }), undo: 0, patches: [], picks: {} };
  ctx.segBind = (id, fn) => { ctx.picks[id] = fn; };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const states = { none: { endArrow: false }, start: { startArrow: true, endArrow: false }, end: {}, both: { startArrow: true } };
  const eff = (e) => [!!e.startArrow, e.endArrow !== false];
  for (const [from, init] of Object.entries(states)) for (const to of ["none", "start", "end", "both"]) {
    const e = { ...init }; ctx.singleEdge = () => e; ctx.undo = 0; ctx.patches = [];
    const before = eff(e);
    ctx.picks.arrowSeg(to);
    const want = [to === "start" || to === "both", to === "end" || to === "both"];
    assert.deepEqual(eff(e), want, from + " → " + to);
    assert.equal(vm.runInContext("arrowsOf", ctx)(e), to, "el segmentado lee lo que hay: " + to);
    const changed = (before[0] !== want[0]) + (before[1] !== want[1]);
    assert.equal(ctx.undo, changed ? 1 : 0, "un Undo por gesto (" + from + " → " + to + ")");
    if (changed) for (const k of Object.keys(ctx.patches[0])) assert.ok(["startArrow", "endArrow"].includes(k) && typeof ctx.patches[0][k] === "boolean", "solo los mismos dos booleanos");
    if (changed) assert.equal(Object.keys(ctx.patches[0]).length, changed, "solo el campo que cambia");
  }
  assert.ok(ui.includes('$("arrSChk").checked=!!obj.startArrow;') && ui.includes('$("arrEChk").checked=obj.endArrow!==false;'), "los nativos siguen reflejando el valor");
});

/* ───────── color (D4, P3) ───────── */
test("color (D4, P3): una fila + «⋯» en el sitio; el pozo «Personalizado» enseña el valor real o la marca de automático", () => {
  assert.match(system, /--sw-size:24px;/); assert.match(system, /@media \(pointer:coarse\)\{ :root\{ --sw-size:32px; \} \}/);
  assert.match(styles, /\.swatches\{[^}]*grid-auto-rows:var\(--sw-size\);[^}]*max-height:calc\(var\(--sw-size\) \+ 6px\);/, "una fila");
  assert.match(styles, /\.colorRow \.colorTools\{display:none;\}\n\.colorRow\.swOpen \.colorTools\{display:flex;\}/, "personalizado y cuentagotas detrás de «⋯»");
  for (const id of ["swatches", "fillSw", "textColorSw", "textBgSw", "kwColorSw", "kwBgSw", "lineSw", "dotSw"]) assert.ok(element(html, id.replace(/^/, "")) && html.includes('<div class="swRow"><div class="swatches" id="' + id + '">'), id + " en una fila de color");
  const rp = between(ui, "function refreshPanel(){", "\n}\n");
  for (const w of ["strokeCustom", "fillCustom", "textBgCustom", "textColorCustom", "kwBgCustom", "kwColorCustom", "lineCustom", "dotCustom"]) assert.ok(rp.includes('setWell("' + w + '"'), "pozo " + w);
  assert.ok(!/if\(hx\(obj\.\w+\)\) \$\("\w+Custom"\)\.value=/.test(ui), "ya no se escribe solo cuando hay hex (el origen del valor rancio)");
  const src = between(ui, "const HEX6=", ";\n") + "\n" + between(ui, "function setWell(id, val, fallback){", "\n}\n");
  const els = {}; const mk = () => { const a = {}; return { value: "#000000", setAttribute(k, v) { a[k] = v; }, removeAttribute(k) { delete a[k]; }, attr: a }; };
  const ctx = { $: (id) => (els[id] = els[id] || mk()), DEFAULT_NODE_COLOR: "#857F6C" }; vm.createContext(ctx); vm.runInContext(src, ctx);
  ctx.setWell("w", "#d0576a", "#857F6C"); assert.equal(els.w.value, "#d0576a"); assert.equal(els.w.attr["data-auto"], undefined);
  ctx.setWell("w", null, "#6a9fb5"); assert.equal(els.w.value, "#6a9fb5", "automático: ni el anterior ni negro"); assert.equal(els.w.attr["data-auto"], "auto");
  ctx.setWell("w", "none", null); assert.equal(els.w.value, "#857F6C"); assert.equal(els.w.attr["data-auto"], "none");
  assert.match(styles, /#panelProperties input\[type=color\]\[data-auto\]::-webkit-color-swatch\{background:repeating-linear-gradient/);
});

/* ───────── estado activo (D8) ───────── */
test("activo = oliva (D8): segmentados, muestra elegida, conmutadores, «⋯» abierto y pestañas; nunca un color del documento", () => {
  assert.match(system, /\.seg > \.segBtn\.active, \.seg > \.segBtn\[aria-pressed="true"\], \.seg > \.segBtn\[aria-checked="true"\]\{ background:var\(--active-veil\); border-color:var\(--active\);/);
  assert.match(styles, /\.swatch\.sel\{box-shadow:0 0 0 2px var\(--surface\), 0 0 0 3\.5px var\(--active\);\}/);
  assert.match(styles, /\.boldTog:has\(input:checked\)\{background:var\(--active-veil\); border-color:var\(--active\);/);
  assert.match(system, /\.tabs > button\.active, \.tabBtn\.active\{ color:var\(--ink\); border-bottom-color:var\(--active\);/);
  assert.ok(!/\.seg > \.segBtn\[aria-checked="true"\]\{background:var\(--surface-raised\)/.test(styles), "sin el «papel levantado» que no se veía en oscuro");
  assert.ok(!/editEdge\([^)]*--active|editNode\([^)]*--active/.test(ui), "el panel nunca escribe un color del sistema en el documento");
});

/* ───────── plegado (D2) ───────── */
test("plegado (D2): manual, preferencia del navegador, nunca en el documento; sin selección la columna se queda", () => {
  assert.match(html, /try\{ if\(localStorage\.getItem\("fluyo\.ui\.props"\)==="folded"\) document\.documentElement\.setAttribute\("data-props","folded"\); \}catch\(e\)\{\}/, "antes del primer pintado");
  const fold = between(ui, "function setPropsFolded(on){", "\n}\n");
  assert.ok(fold.includes('localStorage.setItem(PROPS_KEY,"folded")') && fold.includes("localStorage.removeItem(PROPS_KEY)"));
  assert.match(ui, /if\(name==="properties" && !isSheetLayout\(\)\)\{ if\(uiMode==="edit"\) setPropsFolded\(!propsFolded\(\)\); return; \}/, "⚙ pliega/despliega en columna");
  assert.match(styles, /:root\[data-props="folded"\] body:not\(\.storyMode\):not\(\.sideSheet\) > main > aside\{display:none;\}/, "solo en Editar y en columna");
  for (const f of ["js/state.js", "js/export.js", "js/link-codec.js", "js/model.js"]) assert.ok(!read(f).includes("fluyo.ui.props"), f + " no conoce la preferencia");
  const rp = between(ui, "function refreshPanel(){", "\n}\n");
  assert.ok(!/setPropsFolded|data-props/.test(rp), "seleccionar o deseleccionar no pliega nada (no es contextual)");
});

/* ───────── táctil y móvil (D9) ───────── */
test("táctil (D9): mismo DOM; 44 px para lo accionable, 32 para las muestras; la hoja sigue siendo acordeón de 40dvh", () => {
  const coarse = styles.slice(styles.indexOf("/* ---- Puntero grueso"));
  for (const r of [/#panelProperties \.row\{min-height:var\(--ctl-h-touch\);\}/, /#panelProperties button\.swMore\{width:var\(--ctl-h-touch\); height:var\(--ctl-h-touch\);/, /#panelProperties \.seg > \.segBtn\{min-height:var\(--ctl-h-touch\);\}/, /\.boldTog\{width:var\(--ctl-h-touch\); height:var\(--ctl-h-touch\);\}/])
    assert.match(coarse, r);
  assert.match(styles, /height:clamp\(220px, 40dvh, 360px\)/, "la hoja móvil no cambia (018.17)");
  assert.match(styles, /\.sheetHead \.sheetClose\{display:inline-flex; min-width:var\(--ctl-h-touch\);/);
  assert.equal(html.split('id="panelProperties"').length - 1, 1, "un solo panel");
});

test("documentación: docs/index.html describe el panel nuevo (y «Picker» ya no existe)", () => {
  const docs = read("docs/index.html");
  assert.ok(docs.includes("<strong>Apariencia</strong>") && docs.includes("<strong>Dirección</strong>") && docs.includes("cuentagotas"));
  assert.ok(!docs.includes("<strong>Picker</strong>"));
});
