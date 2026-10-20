"use strict";
/* FLUYO-018.19 — Teléfono en apaisado, diálogo de evento táctil, crear → colocar, colocar con el dedo y reencaje al girar.
   Comprobaciones estáticas y en vm (rápidas, sin navegador). Lo que solo se ve pintado (lienzo útil, hojas, objetivos, toques y
   arrastres reales, giro) lo mide test/fluyo-018-19-browser.cjs en Chrome real.
   · Alcance: model.js, config.js y el resto del kernel, story-clock.js, render.js, geometry.js, export.js, Viewer y Share
     idénticos a HEAD; CACHE v78 sin archivos servidos nuevos.
   · Crear → colocar (D10, D12): el editor real (editor-scenarios.js en vm): crear entra en colocación con ESE evento; editar y
     duplicar no; un Undo al crear y otro al colocar; cancelar deja el evento en la biblioteca.
   · Colocar con el dedo (D11, D13): el vacío no cancela con el dedo y sí con ratón; interaction.js arma un desplazamiento y
     solo un toque resuelve.
   · Apaisado (D2–D6): predicado táctil, gramática del teléfono, páginas y modos a la cabecera, zona libre con hoja lateral o
     franja, rail desplazable.  Reencaje al girar (D14).  Diálogo: lo esencial primero, «Cómo se ve» plegado. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const FIX = JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j + b.length); };

/* ───────── alcance y release ───────── */
test("alcance: kernel, story-clock, render, geometría, exportación, Viewer y Share idénticos a HEAD", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/story-clock.js", "js/render.js", "js/geometry.js", "js/export.js", "js/state.js", "js/selection.js", "js/share-url.js", "js/link-codec.js", "js/viewer.js", "js/present-story.js",
    "s/index.html", "css/share.css", "css/identity.css", "css/system.css"]) {
    let head;
    try { head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"); } catch { return; }   // sin git (copia de mutaciones)
    assert.equal(read(f), head, f + " sin cambios");
  }
});

test("release: CACHE v78; nada de lo que carga index.html queda fuera del precache", () => {
  const sw = read("sw.js"), html = read("index.html");
  assert.match(sw, /const CACHE = "fluyo-static-v99";/);
  const local = [...html.matchAll(/(?:src|href)="((?!https?:|#|data:)[^"]+\.(?:js|css|woff2))"/g)].map((m) => m[1]);
  for (const u of local) assert.ok(sw.includes('"./' + u.replace(/^\.\//, "") + '"'), "en el precache: " + u);
});

/* ───────── crear → colocar, con el editor real en vm ───────── */
const { makeScenarioUIContext, setupPanel, ensureUI } = require("./fluyo-016-harness.cjs");
function editor() {
  const { ctx, register } = makeScenarioUIContext();
  vm.runInContext(read("js/story-clock.js"), ctx);
  ctx.run(`doc = projectFromProjectData(${JSON.stringify(FIX)}).doc; undoStack=[]; redoStack=[]; var __undos = 0;`);
  ctx.pushUndo = () => { ctx.__undos++; };
  setupPanel(ctx, register);
  for (const id of ["scNow", "scNowLabel", "scNowCaption", "scNowProgress", "scRunHint", "scPause", "scPrev", "scNext", "scPlacementText", "scPlacementConfirm", "scPlacementCancel", "scNotice", "scFlowLook", "scFlowLookSummary", "scFlowMore"]) register(id, ctx.document.createElement("div"));
  ctx.isSheetLayout = () => false;
  ctx.syncStoryState = () => {};
  ctx.hitNode = () => null;
  ctx.hitLeafNode = () => null;   // FLUYO-019-HIT-TEST: Historias pregunta por la hoja
  ctx.hitEdge = () => null;
  ensureUI(ctx);
  ctx.run("scSelectStory(P().scenarios[0].id); scRenderPanel();");
  return ctx;
}
const create = (E, name) => { E.run(`scOpenEventDialog(null); $("scEventName").value = ${JSON.stringify(name)}; scSaveEventType();`); };

test("crear un evento entra directamente en colocación con ESE evento (un Undo); el Step solo nace al elegir destino", () => {
  const E = editor();
  const ets = E.run("doc.eventTypes.length"), steps = E.run("scActiveScenario().steps.length");
  create(E, "Aviso");
  assert.equal(E.run("doc.eventTypes.length"), ets + 1, "un evento nuevo, completo, en la biblioteca");
  assert.equal(E.__undos, 1, "crear = una entrada de Undo");
  assert.equal(E.run("scActiveScenario().steps.length"), steps, "ningún Step todavía: nada parcial en la Historia");
  assert.equal(E.run("scPlacement && scPlacement.kind"), "place");
  assert.equal(E.run("scPlacement.origin"), "created");
  assert.equal(E.run("scPlacement.eventTypeId"), E.run("doc.eventTypes[doc.eventTypes.length - 1].id"), "se coloca el evento recién creado");
  const bar = E.run('$("scPlacementText").textContent');
  assert.match(bar, /^Aviso creado\. Elige la conexión donde ocurre\.\nSe añadirá al final · 1 s después$/);
  assert.doesNotMatch(bar + E.run('$("scNotice").textContent'), /Arrástralo/, "ya no se pide arrastrar la ficha");
  /* colocar: el destino crea el Step con su propio Undo */
  const edge = E.run("P().edges[0].id");
  E.run(`scUseTarget(${edge}, false)`);
  assert.equal(E.run("scActiveScenario().steps.length"), steps + 1);
  assert.equal(E.__undos, 2, "colocar = su propia entrada de Undo");
  assert.equal(E.run("scPlacement"), null);
  const last = E.run("JSON.stringify((() => { const s = scActiveScenario().steps; const l = s.reduce((m, x) => (x.at >= m.at ? x : m), s[0]); return [l.eventTypeId, l.edgeId]; })())");
  assert.equal(last, JSON.stringify([E.run("doc.eventTypes[doc.eventTypes.length - 1].id"), edge]), "el Step nuevo es el último de la Historia");
});

test("cancelar la colocación deja el evento en la biblioteca (D10) y la Historia igual; se puede volver a colocar", () => {
  const E = editor();
  const steps = E.run("scActiveScenario().steps.length");
  create(E, "Sin colocar");
  const id = E.run("scPlacement.eventTypeId");
  E.run("scCancelPlacement()");
  assert.equal(E.run("scPlacement"), null);
  assert.ok(E.run(`!!eventTypeById(${id})`), "el evento sigue en la biblioteca");
  assert.equal(E.run("scActiveScenario().steps.length"), steps);
  assert.equal(E.__undos, 1, "cancelar no añade ni quita Undo");
  E.run(`scBeginPlacement(${id})`);
  assert.equal(E.run("scPlacement && scPlacement.eventTypeId"), id, "su ficha vuelve a colocarlo");
});

test("editar o duplicar un evento NO entra en colocación; el aviso habla según el puntero (sin «Arrástralo» con el dedo)", () => {
  const E = editor();
  const id = E.run("doc.eventTypes[0].id");
  E.run(`scOpenEventDialog(${id}); scSaveEventType();`);
  assert.equal(E.run("scPlacement"), null, "Guardar cambios no coloca");
  E.run(`scOpenEventDialog(${id}, true); $("scEventName").value = "Copia"; scSaveEventType();`);
  assert.equal(E.run("scPlacement"), null, "Duplicar no coloca");
  assert.match(E.run('$("scNotice").textContent'), /Copia ya está en Eventos\. Arrástralo a /, "con ratón, como siempre");
  E.matchMedia = () => ({ matches: true });
  E.run(`scOpenEventDialog(${id}, true); $("scEventName").value = "Copia 2"; scSaveEventType();`);
  assert.match(E.run('$("scNotice").textContent'), /Tócalo y luego toca /, "con el dedo, tocar");
});

test("colocando con el dedo, tocar donde no hay destino NO cancela; con ratón cancela como siempre", () => {
  const E = editor();
  create(E, "Aviso");
  const id = E.run("scPlacement.eventTypeId");
  E.run(`scResolveDrop(${id}, 9999, 9999, 10, 10, true)`);
  assert.equal(E.run("scPlacement && scPlacement.origin"), "created", "dedo: sigue colocando");
  assert.match(E.run('$("scNotice").textContent'), /compatible para colocarlo, o «Cancelar»/);
  E.run(`scResolveDrop(${id}, 9999, 9999, 10, 10)`);
  assert.equal(E.run("scPlacement"), null, "ratón: cancela");
  /* el dedo no se decide al apoyar: scCanvasPlacementPointer deja pasar el toque (lo arma interaction.js como desplazamiento) */
  create(E, "Otro");
  assert.equal(E.run('scCanvasPlacementPointer({ pointerType: "touch", button: 0, preventDefault(){} })'), false);
  assert.equal(E.run('scPlacementTouchPan({ pointerType: "touch" })'), true);
  assert.equal(E.run('scPlacementTouchPan({ pointerType: "mouse" })'), false);
  assert.equal(E.run('scCanvasPlacementPointer({ pointerType: "mouse", button: 2, preventDefault(){} })'), true, "con ratón sigue resolviéndose al apoyar");
});

test("interaction.js: colocando con el dedo, apoyar desplaza y solo un toque (≤ 8 px) resuelve al soltar", () => {
  const src = read("js/interaction.js");
  const down = between(src, 'cv.addEventListener("pointerdown", ev=>{', "\n});");
  const iPinch = down.indexOf("if(activeTouches.size===2){ startPinch(); return; }"), iPlace = down.indexOf("scPlacementTouchPan(ev)"), iPresent = down.indexOf("if(presenting){");
  assert.ok(iPinch > 0 && iPlace > iPinch && iPresent > iPlace, "tras el pellizco y antes de cualquier edición");
  assert.match(down, /panDrag=\{ x:ev\.clientX, y:ev\.clientY, startX:viewX, startY:viewY, isRight:false, moved:false, tap:true, placing:true \};\n    return;/);
  const up = between(src, 'cv.addEventListener("pointerup", ev=>{', "\n});");
  assert.match(up, /const placingTap = panDrag\.placing && Math\.hypot\(ev\.clientX-panDrag\.x, ev\.clientY-panDrag\.y\)<=8;/);
  assert.match(up, /if\(placing\)\{ if\(placingTap && typeof scCanvasPlacementTap==="function"\) scCanvasPlacementTap\(ev\); return; \}/);
  assert.ok(up.indexOf("if(endTouchPointer(ev)) return;") < up.indexOf("placingTap"), "un pellizco anula el toque");
});

/* ───────── diálogo ───────── */
test("diálogo: lo esencial primero; «Cómo se ve» plegado con la vista previa dentro; Intro crea; sin glifos ni subtítulo", () => {
  const html = read("index.html"), es = read("js/editor-scenarios.js"), css = read("css/styles.css");
  const dlg = between(html, '<dialog id="scEventDialog"', "</dialog>");
  const pos = ["scEventName", "scWhere", "scPhrase", "scVisualPicker", "scFlowLook", "scAppearance", "scBehavior"].map((id) => dlg.indexOf('id="' + id + '"'));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), "orden: Nombre · Dónde · Frase · Símbolo · Cómo se ve");
  assert.match(dlg, /<details id="scFlowLook" class="scAccordion scFlowLook" hidden>\n\s*<summary><span class="scAccordionTitle">Cómo se ve<\/span>/);
  assert.ok(between(dlg, 'id="scFlowLook"', "</details>\n        </div>\n      </details>").includes('class="scEventPreview"'), "la vista previa vive dentro de «Cómo se ve»");
  assert.match(dlg, /<summary><span class="scAccordionTitle">Cómo se ve<\/span><span class="scAccordionSummary" id="scAppearanceSummary">/);
  assert.match(dlg, /<p id="scEventDialogSubtitle" hidden>/);
  assert.match(dlg, /<button id="scEventClose" class="iconBtn btnGhost" type="button" aria-label="Cerrar editor de evento"><svg class="ic" aria-hidden="true"><use href="#i-x"\/><\/svg><\/button>/);
  assert.doesNotMatch(dlg, /scEffectIcon/, "los efectos sin glifos decorativos");
  assert.match(dlg, /<input id="scEventName"[^>]*enterkeyhint="done"/);
  assert.match(es, /scSetAccordionOpen\("scFlowLook", !!et && /, "al crear, plegado");
  assert.match(es, /if \(slot && preview && preview\.parentElement !== slot\) slot\.appendChild\(preview\);/);
  assert.match(es, /\$\("scEventName"\)\.onkeydown = \(ev\) => \{\n\s*if \(ev\.key === "Enter" && !ev\.isComposing\) \{/);
  const block = between(css, "/* ===================== FLUYO-018.19 — Diálogo de evento", "/* ===================== FLUYO-018.19 — Teléfono en apaisado");
  assert.match(block, /@media \(pointer:coarse\)\{\n  #scEventClose\{min-width:var\(--ctl-h-touch\); min-height:var\(--ctl-h-touch\);\}\n  \.scDialog>footer button\{min-height:var\(--ctl-h-touch\);/);
  assert.match(block, /\.scSegmented span\{min-height:var\(--ctl-h-touch\);/);
  assert.match(block, /\.scPhraseChip, \.scPhraseInsert button, #scChangeSymbol, \.scDialog \.scPhrase input\.scPhraseText\{min-height:var\(--row-h-touch\);\}/);
  assert.doesNotMatch(block, /58,167,232/, "lo seleccionado en oliva del sistema, no el cian antiguo");
});

test("diálogo en vm: «Cómo se ve» resume cómo viaja y empieza plegado al crear", () => {
  const E = editor();
  E.run("scOpenEventDialog(null)");
  assert.equal(E.run('$("scFlowLook").open'), false);
  assert.equal(E.run('$("scFlowLookSummary").textContent'), "Mediano · Directo · Sin rastro");
});

/* ───────── apaisado ───────── */
test("apaisado: solo con puntero táctil; gramática del teléfono; páginas y modos a la cabecera; mismo transporte", () => {
  const ui = read("js/ui.js"), css = read("css/styles.css");
  assert.match(ui, /const mqSide=window\.matchMedia \? matchMedia\("\(orientation: landscape\) and \(max-height: 500px\) and \(pointer: coarse\)"\) : null;/);
  assert.match(ui, /function isSideSheet\(\)\{ return !!\(mqSide && mqSide\.matches\); \}\nfunction isSheetLayout\(\)\{ return !!\(\(mqSheet && mqSheet\.matches\) \|\| isSideSheet\(\)\); \}/);
  assert.match(ui, /for\(const mq of \[mqCompact, mqSheet, mqSide\]\) if\(mq && mq\.addEventListener\) mq\.addEventListener\("change", placeChrome\);/);
  const chrome = between(ui, "function placeChrome(){", "\n}\n");
  assert.ok(chrome.includes('header.insertBefore(pages, $("hdrHistory").nextSibling)') && chrome.includes('header.insertBefore(modes, $("btnShare"))') && chrome.includes("bb.insertBefore(pages, bb.firstChild)") && chrome.includes("bb.appendChild(modes)"), "mismos nodos, ida y vuelta");
  assert.match(css, /\/\* ---- Móvil \(≤700 px\) ----[\s\S]*?@media \(max-width:700px\), \(orientation:landscape\) and \(max-height:500px\) and \(pointer:coarse\)\{/);
  const side = between(css, "/* ===================== FLUYO-018.19 — Teléfono en apaisado", "\n}\n");
  assert.match(side, /@media \(orientation:landscape\) and \(max-height:500px\) and \(pointer:coarse\)\{/);
  assert.match(side, /#bottomBar\{display:none;\}/);
  assert.match(side, /\.rail\{width:52px;[^}]*overflow-x:hidden; overflow-y:auto;/);
  assert.match(side, /aside, aside\.scenariosOpen\{top:var\(--hdr-h\); bottom:0; left:auto; right:0; width:var\(--side-w\);/);
  assert.match(side, /body\[data-story="playing"\]:not\(\.storyExpanded\) aside\.scenariosOpen\{top:auto; left:0; right:0; width:auto; bottom:0;/);
  assert.match(side, /grid-template-areas:"ctl \. stop expand exit"/);
  assert.match(side, /body\.panelOpen\.scPlacing aside\{transform:translateX\(calc\(100% \+ 12px\)\); visibility:hidden;\}/);
  /* «Ampliar» en pausa (desde la franja): la fila del momento se trae aunque no haya fotogramas */
  assert.ok(between(ui, "function setStoryExpanded(on){", "\n}\n").includes('if(on && typeof scFollowActive==="function" && typeof requestAnimationFrame==="function") requestAnimationFrame(()=>scFollowActive());'));
});

/* visibleCanvasRect y el reencaje, extraídos de ui.js y ejecutados con un DOM mínimo */
function uiCtx(o) {
  const ui = read("js/ui.js");
  const el = (r) => ({ hidden: false, offsetWidth: r ? r.width : 0, offsetHeight: r ? r.height : 0, getBoundingClientRect: () => r || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } });
  const R = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h });
  const body = { classList: { _s: new Set(o.body || []), contains(c) { return this._s.has(c); } }, dataset: { story: o.story || "closed" } };
  const els = { bottomBar: el(o.bottomBar), touchBar: el(null), scPlacementBar: el(null), wrap: el(o.cv) };
  const ctx = vm.createContext({ Math, innerWidth: o.W, innerHeight: o.H, cv: el(o.cv), document: { body, querySelector: () => el(o.aside) }, $: (id) => els[id], getComputedStyle: () => ({ visibility: "visible" }),
    isSheetLayout: () => o.sheet, isSideSheet: () => o.side, R });
  vm.runInContext(between(ui, "function sideStrip(){", "\n") + between(ui, "function visibleCanvasRect(){", "\n}\n"), ctx);
  return ctx;
}
test("zona libre: la hoja lateral resta por la DERECHA; la franja de reproducción, por abajo; colocando, la hoja no cuenta", () => {
  const R = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h });
  const base = { W: 844, H: 390, cv: R(52, 48, 792, 342), bottomBar: R(0, 0, 0, 0), sheet: true, side: true };
  let v = vm.runInContext("visibleCanvasRect()", uiCtx({ ...base, body: ["panelOpen"], story: "compact", aside: R(524, 48, 320, 342) }));
  assert.deepEqual([v.left, v.top, v.right, v.bottom], [0, 0, 472, 342], "Propiedades/Historias a la derecha");
  v = vm.runInContext("visibleCanvasRect()", uiCtx({ ...base, cv: R(0, 48, 844, 342), body: ["panelOpen"], story: "playing", aside: R(0, 333, 844, 57) }));
  assert.deepEqual([v.left, v.right, v.bottom], [0, 844, 342 - 57], "reproduciendo: franja inferior");
  v = vm.runInContext("visibleCanvasRect()", uiCtx({ ...base, cv: R(0, 48, 844, 342), body: ["panelOpen", "storyExpanded"], story: "playing", aside: R(524, 48, 320, 342) }));
  assert.equal(v.right, 524, "reproduciendo con la línea de tiempo: hoja lateral");
  v = vm.runInContext("visibleCanvasRect()", uiCtx({ ...base, body: ["panelOpen", "scPlacing"], story: "compact", aside: R(524, 48, 320, 342) }));
  assert.equal(v.right, 792, "colocando, la hoja está apartada");
  v = vm.runInContext("visibleCanvasRect()", uiCtx({ W: 390, H: 844, cv: R(0, 101, 390, 691), bottomBar: R(0, 792, 390, 52), sheet: true, side: false, body: ["panelOpen"], story: "compact", aside: R(0, 667, 390, 125) }));
  assert.deepEqual([v.right, v.bottom], [390, 792 - 125 - 101], "vertical: como siempre, la hoja por abajo");
});

test("reencaje al girar: si se veía entero, se reencaja; si estaba acercado, se conserva el zoom y el centro; solo con el dedo", () => {
  const ui = read("js/ui.js");
  const fn = between(ui, "let lastWrapBox=null;", "window.addEventListener(\"resize\", ()=>requestAnimationFrame(refitOnRotate));");
  const run = (o) => {
    const ctx = vm.createContext({ Math, innerWidth: o.W, innerHeight: o.H, viewX: o.view[0], viewY: o.view[1], viewZoom: o.view[2], presenting: false, uiMode: o.mode || "edit", window: { matchMedia: () => ({ matches: o.coarse !== false }), addEventListener() {} }, matchMedia: () => ({ matches: o.coarse !== false }),
      document: { body: { classList: { contains: (c) => (o.body || []).includes(c) } } }, $: () => ({ getBoundingClientRect: () => ({ width: o.wrap[0], height: o.wrap[1] }) }), P: () => ({ nodes: [1] }), getBounds: () => ({ x: 0, y: 0, w: 400, h: 200 }),
      fitView() { ctx.__fit = true; }, isSheetLayout: () => !!o.sheet, revealAboveSheet(w) { ctx.__reveal = w; } });
    vm.runInContext(fn.replace('window.addEventListener("resize", ()=>requestAnimationFrame(refitOnRotate));', ""), ctx);
    vm.runInContext(`lastWrapBox = { w: ${o.prev[0]}, h: ${o.prev[1]}, landscape: ${o.prev[2]} }; refitOnRotate();`, ctx);
    return ctx;
  };
  let c = run({ W: 844, H: 390, wrap: [792, 342], prev: [390, 691, false], view: [15, 300, 0.9] });
  assert.equal(c.__fit, true, "entero antes de girar → se reencaja");
  c = run({ W: 844, H: 390, wrap: [792, 342], prev: [390, 691, false], view: [-200, 100, 1.6] });
  assert.equal(c.__fit, undefined, "acercado → no se reencaja");
  assert.equal(c.viewZoom, 1.6);
  assert.equal(Math.round((792 / 2 - c.viewX) / 1.6), Math.round((390 / 2 + 200) / 1.6), "el punto que estaba en el centro sigue en el centro");
  c = run({ W: 844, H: 390, wrap: [792, 342], prev: [800, 300, true], view: [15, 30, 0.6] });
  assert.equal(c.__fit, undefined, "sin girar (misma orientación) no se toca la vista");
  c = run({ W: 844, H: 390, wrap: [792, 342], prev: [390, 691, false], view: [15, 300, 0.9], coarse: false });
  assert.equal(c.__fit, undefined, "con ratón (ventana de escritorio) no se aplica");
  c = run({ W: 844, H: 390, wrap: [792, 342], prev: [390, 691, false], view: [15, 300, 0.9], sheet: true, body: ["panelOpen"], mode: "story" });
  assert.equal(c.__reveal, "page", "con la hoja de Historias abierta, después se revela la página en la zona libre");
});

test("menú de páginas: encima del ancla si cabe; si no (selector en la cabecera, apaisado), debajo", () => {
  const ui = read("js/ui.js");
  const src = between(ui, "function placePageMenu(anchor){", "\n}\n");
  const run = (top, bottom) => { const m = { offsetWidth: 260, offsetHeight: 257, style: {} }; const ctx = vm.createContext({ Math, innerWidth: 844, innerHeight: 390, $: () => m }); vm.runInContext(src, ctx); ctx.placePageMenu({ isConnected: true, getBoundingClientRect: () => ({ left: 120, top, bottom }) }); return parseFloat(m.style.top); };
  assert.equal(run(346, 390), 346 - 257 - 6, "barra inferior: encima");
  assert.equal(run(2, 46), 52, "cabecera: debajo");
});
