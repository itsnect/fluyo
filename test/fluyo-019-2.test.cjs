"use strict";
/* FLUYO-019.2 — La piel «construido» como ajuste del documento (settings.skin): Share y Viewer. Contratos en vm (sin navegador).
   · Lista cerrada: solo "built" se conserva; ausente, "flat", otro string, otro tipo → sin clave (= plano). Idempotente.
     DEFAULT_SETTINGS no conoce la piel; projectSkin() es la lectura canónica.
   · Documentos antiguos sin la clave: la normalización (y por tanto el archivo, el autoguardado y el share) es IDÉNTICA a la de
     HEAD para los 8 ejemplos y los fixtures del repo; con la clave, solo cambia esa clave.
   · Share: el enlace lleva settings.skin sin schema nuevo (mismas claves del payload); el Viewer lo lee y lo pasa al viewport.
   · Viewer: carga skin.js (geometry → skin → render) y pinta lo que diga el documento; un Viewer SIN skin.js (SW anterior)
     abre el mismo enlace plano y sin errores.
   · Editor: el lienzo sigue plano (viewport.skin solo en Present y lo decide el documento); setDocumentSkin escribe "built" o
     quita la clave, autoguarda y no toca Undo; el diálogo de exportar arranca con el aspecto del documento.
   · Historias e integridad: mismo Trace y validateProject con y sin la clave.
   · Alcance: skin.js, render.js, geometry.js, interaction.js, Share, deep link y el resto del kernel idénticos a HEAD;
     model.js = HEAD + los dos bloques de 019.2; s/index.html = HEAD + la carga de skin.js (CSP intacta); sw.js v86.
   · Golden compartido con el MCP (019.3): fixture test/fixtures/fluyo-019-2-skin.fluyo.json y golden
     fluyo-019-2-skin-svg.json (los genera test/fluyo-019-2-browser.cjs con FLUYO_UPDATE_GOLDEN=1 desde el editor real).
   Lo que necesita lienzo y Chrome lo mide test/fluyo-019-2-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { makeViewer, VIEWER_SCRIPTS } = require("./viewer-harness.cjs");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const head = (f) => execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

/* config + model (el de HEAD o el del árbol) en un contexto limpio */
function modelCtx(modelSource = read("js/model.js")) {
  const ctx = vm.createContext({ console });
  vm.runInContext(read("js/config.js"), ctx);
  vm.runInContext(modelSource, ctx);
  ctx.call = (expr, arg) => { ctx.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, ctx)); };
  return ctx;
}
const M = modelCtx(), M0 = modelCtx(head("js/model.js"));
const norm = (ctx, project) => ctx.call("projectToSerializable(projectFromProjectData(__a).doc, projectFromProjectData(__a).settings)", project);
const CORPUS = [
  ...fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => f.endsWith(".fluyo.json")).map((f) => "ejemplos/data/" + f),
  ...fs.readdirSync(path.join(root, "test", "fixtures")).filter((f) => /\.(fluyo\.)?json$/.test(f) && !/golden|skin|colores|svg|pasteclip/.test(f)).map((f) => "test/fixtures/" + f),
].filter((f) => { try { const p = JSON.parse(read(f)); return p && p.doc && Array.isArray(p.doc.pages); } catch { return false; } });

/* ── lista cerrada ── */
test("lista cerrada · solo \"built\" se conserva; ausente, \"flat\", otro string u otro tipo quedan sin clave (= plano); idempotente", () => {
  assert.deepEqual(M.call("SKIN_VALUES"), ["flat", "built"]);
  assert.ok(!("skin" in M.call("DEFAULT_SETTINGS")), "DEFAULT_SETTINGS sin skin");
  assert.equal(M.call('settingsFromProjectData({skin:"built"}).skin'), "built");
  for (const v of [undefined, "flat", "BUILT", "Built", " built", "", 1, 0, true, false, null, {}, [], ["built"]]) {
    const r = M.call("settingsFromProjectData(__a)", { skin: v, speed: 1 });
    assert.ok(!("skin" in r), "skin=" + JSON.stringify(v) + " → sin clave");
    assert.equal(r.speed, 1, "el resto de ajustes se normaliza como siempre");
  }
  assert.ok(!("skin" in M.call("settingsFromProjectData({})")));
  const twice = M.call('settingsFromProjectData(settingsFromProjectData({skin:"built", dots:9}))');
  assert.deepEqual(twice, M.call('settingsFromProjectData({skin:"built", dots:9})'), "idempotente");
  for (const bad of ["cadena", 7, []]) assert.throws(() => M.call("settingsFromProjectData(__a)", bad), (e) => e.code === "invalid_document", "settings no objeto sigue siendo invalid_document");
});
test("projectSkin · lectura canónica: \"built\" solo con la clave exacta; cualquier otra cosa (incluido null/undefined) es \"flat\"", () => {
  assert.equal(M.call('projectSkin({skin:"built"})'), "built");
  for (const st of [{}, { skin: "flat" }, { skin: "BUILT" }, { skin: 1 }, null, undefined]) assert.equal(M.call("projectSkin(__a)", st), "flat", JSON.stringify(st));
  assert.equal(M.call("projectSkin()"), "flat");
});

/* ── documentos antiguos ── */
test("corpus · los documentos sin settings.skin se normalizan IDÉNTICOS a HEAD (archivo, autoguardado y share no cambian ni un byte)", () => {
  assert.ok(CORPUS.length >= 10, "corpus: " + CORPUS.length);
  for (const f of CORPUS) {
    const p = JSON.parse(read(f));
    assert.ok(!(p.settings && "skin" in p.settings), f + ": el corpus publicado no lleva la clave");
    const a = JSON.stringify(norm(M, p)), b = JSON.stringify(norm(M0, p));
    assert.equal(a, b, f + ": normalización idéntica a HEAD");
    assert.ok(!a.includes('"skin"'), f + ": sin clave tras normalizar");
  }
});
test("corpus · con skin:\"built\" solo cambia esa clave: quitarla devuelve exactamente el documento de HEAD", () => {
  for (const f of CORPUS) {
    const p = JSON.parse(read(f)); p.settings = Object.assign({}, p.settings, { skin: "built" });
    const r = norm(M, p);
    assert.equal(r.settings.skin, "built", f);
    delete r.settings.skin;
    assert.equal(JSON.stringify(r), JSON.stringify(norm(M0, JSON.parse(read(f)))), f + ": lo demás, igual que en HEAD");
  }
});

/* ── Share y Viewer ── */
function creator() {
  const v = makeViewer();
  v.context.location.protocol = "https:"; v.context.location.href = "https://fluyo.space/";
  v.context.navigator = {};
  v.run(read("js/share-url.js"));
  v.run("function commitEditBox(){}");
  for (const id of ["btnShare", "shareDialog", "shareConfirm", "shareResult", "shareCopy", "shareCreate", "shareClose", "shareLink", "shareMessage"]) v.context.document.getElementById(id);
  const dialog = v.el("shareDialog"); dialog.showModal = function () { this.open = true; }; dialog.close = function () { this.open = false; };
  for (const id of ["shareCopy", "shareLink"]) { v.el(id).focus = () => {}; v.el(id).select = () => {}; }
  v.run(read("js/editor-share.js"));
  v.connect();
  return v;
}
async function shareOf(settingsPatch) {
  const c = creator();
  c.context.__patch = settingsPatch;
  c.run("doc=deep(SHARE_FIXTURES.demo.doc); settings=Object.assign(deep(SHARE_FIXTURES.demo.settings), __patch)");
  c.el("btnShare").onclick(); await c.el("shareCreate").onclick();
  const url = c.el("shareLink").value;
  assert.match(url, /^https:\/\/fluyo\.space\/s\/#d=[A-Za-z0-9_-]+$/);
  return { c, payload: new URL(url).hash.slice(3) };
}
async function viewerFor(payload) {
  const v = makeViewer({ search: "", hash: "#d=" + payload });
  await v.boot(); await v.waitForPhase((p) => p === "ready" || p === "error");
  assert.equal(v.viewer().phase, "ready");
  return v;
}
test("Share · el enlace lleva settings.skin sin schema nuevo: el Viewer lo recibe y lo pasa al viewport (skinOn en render)", async () => {
  const { payload } = await shareOf({ skin: "built" });
  const v = await viewerFor(payload);
  const decoded = await v.run('decodeDeepLink("' + payload + '")');
  assert.deepEqual(Object.keys(decoded), ["version", "app", "doc", "settings"], "mismas claves de siempre");
  assert.equal(decoded.version, 5); assert.equal(decoded.settings.skin, "built");
  assert.equal(v.run("settings.skin"), "built");
  assert.equal(v.run("viewerRenderState().viewport.skin"), "built");
  assert.equal(v.run("typeof skinNode"), "function", "el Viewer carga skin.js");
  assert.equal(v.run("(function(){ const rs=viewerRenderState(); render(sctx, 0, {renderState:rs}); return rs.skinOn; })()"), true, "render pinta la piel");
});
test("Share · un documento plano (sin clave, o con \"flat\") viaja y llega sin la clave: payload y Viewer como en HEAD", async () => {
  const a = await shareOf({}), b = await shareOf({ skin: "flat" });
  assert.equal(a.payload, b.payload, "\"flat\" no deja rastro: el mismo enlace que sin la clave");
  const v = await viewerFor(a.payload);
  const decoded = await v.run('decodeDeepLink("' + a.payload + '")');
  assert.ok(!("skin" in decoded.settings));
  assert.equal(JSON.stringify(J(decoded)), JSON.stringify(norm(M0, decoded)), "lo que viaja es la normalización de HEAD");
  assert.equal(v.run("viewerRenderState().viewport.skin"), "flat");
  assert.equal(v.run("(function(){ const rs=viewerRenderState(); render(sctx, 0, {renderState:rs}); return rs.skinOn; })()"), false);
});
test("Viewer antiguo (sin skin.js, service worker anterior) · un enlace con \"built\" abre plano y sin errores", async () => {
  const { payload } = await shareOf({ skin: "built" });
  const v = makeViewer({ search: "", hash: "#d=" + payload });
  /* simula el Viewer de v85: los globales de la piel no existen (render.js los consulta con typeof) */
  v.run("skinActive=undefined; skinNode=undefined; skinEdgeLanding=undefined; skinEdgePort=undefined; skinExtent=undefined; skinPaintOrder=undefined; skinLabelFont=undefined;");
  await v.boot(); await v.waitForPhase((p) => p === "ready" || p === "error");
  assert.equal(v.viewer().phase, "ready");
  assert.equal(v.run("settings.skin"), "built", "el documento sí trae la clave");
  assert.equal(v.run("(function(){ const rs=viewerRenderState(); render(sctx, 0, {renderState:rs}); return rs.skinOn; })()"), false, "sin skin.js: plano, sin romper");
});
test("Viewer · «Abrir en Fluyo» conserva el payload (y con él settings.skin); clearViewerDocument vuelve a ajustes sin clave", async () => {
  const { payload } = await shareOf({ skin: "built" });
  const v = await viewerFor(payload);
  await v.el("btnOpen").onclick();
  assert.equal(v.context.location.href, "https://fluyo.space/#d=" + payload);
  v.run("clearViewerDocument()");
  assert.ok(!("skin" in v.run("settings")), "el Viewer vacío no arrastra la piel del documento anterior");
});

/* ── editor ── */
/* FLUYO-019.4b (decisión 226, revisa la 202): el editor sigue a settings.skin, igual que Present */
test("editor-runtime · viewport.skin: lo que diga el documento, en el editor y en Present (019.4b)", () => {
  const states = [[false, { skin: "built" }, "built"], [false, {}, "flat"], [false, { skin: "flat" }, "flat"], [true, { skin: "built" }, "built"], [true, {}, "flat"], [true, { skin: "flat" }, "flat"]];
  for (const [presenting, settings, want] of states) {
    const renders = [];
    const ctx = vm.createContext({ performance: { now: () => 1 }, requestAnimationFrame: () => 1, resizeCanvas() {}, render: (...a) => renders.push(a), syncEditBoxIfMoved() {},
      singleSel: () => null, arrowHostNode: () => null, cv: { width: 10, height: 10 }, ctx: {}, $: () => ({}), viewX: 0, viewY: 0, viewZoom: 1, presenting, settings,
      projectSkin: (st) => (st && st.skin === "built") ? "built" : "flat", selN: new Set(), selE: new Set(), mode: "select", pendingShape: null, pendingIcon: null, pendingAnim: null,
      connecting: null, drag: null, resizing: null, wpDrag: null, connectDrag: null, endDrag: null, marquee: null, hoverNode: null, editing: null, mouse: { x: 0, y: 0 } });
    vm.runInContext(read("js/editor-runtime.js"), ctx);
    assert.equal(renders[0][2].renderState.viewport.skin, want, `presenting=${presenting} settings=${JSON.stringify(settings)}`);
  }
});
test("ui.js · setDocumentSkin: escribe \"built\" o QUITA la clave, autoguarda solo si cambia, sincroniza los mandos y no toca Undo", () => {
  const ui = read("js/ui.js");
  const slice = ui.slice(ui.indexOf("function setDocumentSkin"), ui.indexOf("function updatePresentBar"));
  assert.ok(slice.includes("function togglePresentSkin") && slice.includes("function syncSkinControls") && slice.includes("function syncPresentSkinButton"), "las cuatro funciones juntas");
  assert.ok(!/pushUndo|undoStack|localStorage/.test(slice), "sin Undo ni almacenamiento propio");
  const els = { skinSel: { value: "" }, prSkin: { textContent: "", title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } } };
  const ctx = vm.createContext({ settings: {}, saves: 0, scheduleAutosave() { ctx.saves++; }, $: (id) => els[id], projectSkin: (st) => (st && st.skin === "built") ? "built" : "flat" });
  vm.runInContext(slice, ctx);
  vm.runInContext('setDocumentSkin("built")', ctx);
  assert.deepEqual(ctx.settings, { skin: "built" }); assert.equal(ctx.saves, 1);
  assert.equal(els.skinSel.value, "built"); assert.equal(els.prSkin.textContent, "Construido"); assert.equal(els.prSkin.attrs["aria-pressed"], "true");
  vm.runInContext('setDocumentSkin("built")', ctx);
  assert.equal(ctx.saves, 1, "elegir el valor actual no escribe");
  vm.runInContext("togglePresentSkin()", ctx);
  assert.deepEqual(ctx.settings, {}, "plano = sin clave"); assert.equal(ctx.saves, 2);
  assert.equal(els.skinSel.value, "flat"); assert.equal(els.prSkin.textContent, "Plano"); assert.equal(els.prSkin.attrs["aria-pressed"], "false");
  vm.runInContext('setDocumentSkin("lo que sea")', ctx);
  assert.deepEqual(ctx.settings, {}); assert.equal(ctx.saves, 2, "un valor desconocido es plano y no escribe si ya lo era");
  /* el control de «Lienzo» y el botón de Present llaman a lo mismo; la tecla B sigue llamando a togglePresentSkin */
  assert.match(ui, /\$\("skinSel"\)\.onchange=\(\)=>setDocumentSkin\(\$\("skinSel"\)\.value\);/);
  assert.match(ui, /\$\("prSkin"\)\.onclick=togglePresentSkin;/);
  assert.match(read("js/interaction.js"), /if\(k==="b" && !ctl && !ev\.altKey\)\{ ev\.preventDefault\(\); togglePresentSkin\(\); return; \}/);
  assert.match(read("js/state.js"), /if\(\$\("skinSel"\)\) \$\("skinSel"\)\.value=projectSkin\(settings\);/, "syncProjectControls sincroniza el control al cargar");
});
test("export.js · la fila «Aspecto» arranca con el aspecto del documento y exGo no escribe el documento", () => {
  const e = read("js/export.js");
  assert.match(e, /\$\("exSkin"\)\.value = projectSkin\(settings\);/);
  const exGo = e.slice(e.indexOf('$("exGo").onclick'), e.indexOf("function exportStatic"));
  assert.ok(!/settings\.skin|setDocumentSkin|scheduleAutosave|pushUndo/.test(exGo), "exGo solo lee la fila");
  assert.match(exGo, /skin=\$\("exSkin"\)\.value==="built"\? "built" : "flat";/);
});

/* ── Historias e integridad ── */
test("kernel · mismo Trace y validateProject con y sin settings.skin", () => {
  const KERNEL = ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "document-integrity.js"];
  const K = vm.createContext({});
  for (const f of KERNEL) vm.runInContext(read("js/" + f), K, { filename: f });
  K.call = (expr, arg) => { K.__a = arg === undefined ? undefined : J(arg); return J(vm.runInContext(expr, K)); };
  const base = JSON.parse(read("test/fixtures/fluyo-017-1-cliente-kafka-comercio.fluyo.json"));
  const built = J(base); built.settings.skin = "built";
  const run = (p) => K.call("(function(){ const n=projectFromProjectData(__a); doc=n.doc; settings=n.settings; const pg=doc.pages[0]; return pg.scenarios.map(s=>FluyoStory.run(pg, s).trace); })()", p);
  assert.deepEqual(run(built), run(base), "Trace idéntico");
  const va = K.call("FluyoIntegrity.validateProject(__a)", base), vb = K.call("FluyoIntegrity.validateProject(__a)", built);
  assert.equal(va.valid, true); assert.equal(vb.valid, true); assert.deepEqual(vb.errors, []); assert.deepEqual(vb.stories, va.stories);
});

/* ── alcance ── */
const SAME_AS_HEAD = ["js/skin.js", "js/render.js", "js/geometry.js", "js/interaction.js", "js/selection.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js",
  "js/scenario-playback.js", "js/story-playback.js", "js/story-clock.js", "js/document-integrity.js", "js/story-authoring.js", "js/share-url.js", "js/editor-share.js",
  "js/deeplink.js", "js/link-codec.js", "js/share-loader.js", "js/viewer-viewport.js", "js/editor-scenarios.js", "js/present-story.js", "js/analytics.js",
  "css/share.css", "css/identity.css", "css/system.css", "css/styles.css"];
test("alcance · la piel (skin.js), los pintores, la geometría, Share, deep link, el resto del kernel y el CSS son idénticos a HEAD", () => {
  for (const f of SAME_AS_HEAD) assert.equal(read(f), head(f), f + " idéntico a HEAD");
});
test("alcance · model.js = HEAD + los dos bloques de 019.2 (SKIN_VALUES/projectSkin y la normalización); nada más del kernel cambia", () => {
  const now = read("js/model.js"), old = head("js/model.js");
  const blockA = now.slice(now.indexOf("/* FLUYO-019.2: aspecto del documento"), now.indexOf("const projectSkin=") );
  const lineA = now.slice(now.indexOf("const projectSkin="), now.indexOf("\n", now.indexOf("const projectSkin=")) + 1);
  const blockB = '  /* FLUYO-019.2: solo "built" se conserva; todo lo demás es plano y no deja clave */\n  if(source.skin===SKIN_VALUES[1]) normalized.skin=SKIN_VALUES[1];\n  else delete normalized.skin;\n';
  assert.ok(blockA.includes("const SKIN_VALUES=[\"flat\",\"built\"];"), "lista cerrada declarada junto a DEFAULT_SETTINGS");
  assert.ok(now.includes(blockB), "normalización presente en settingsFromProjectData");
  assert.equal(now.replace(blockA, "").replace(lineA, "").replace(blockB, ""), old, "model.js sin los bloques = HEAD");
  assert.ok(!/skin/.test(old), "HEAD no conocía la piel");
  /* en HEAD la clave desconocida pasaba tal cual ({...source,...DEFAULT_SETTINGS}); ahora está acotada */
  assert.equal(M0.call('settingsFromProjectData({skin:"flat"}).skin'), "flat", "HEAD: passthrough");
  assert.ok(!("skin" in M.call('settingsFromProjectData({skin:"flat"})')), "ahora: lista cerrada");
});
test("alcance · Viewer: s/index.html = HEAD + la carga de skin.js entre geometry y render; CSP intacta; viewer.js solo añade viewport.skin", () => {
  const now = read("s/index.html"), old = head("s/index.html");
  const block = now.slice(now.indexOf("<!-- FLUYO-019.2:"), now.indexOf('<script src="../js/skin.js"></script>\n') + '<script src="../js/skin.js"></script>\n'.length);
  assert.equal(now.replace(block, ""), old, "s/index.html sin el bloque = HEAD");
  assert.ok(now.indexOf('<script src="../js/geometry.js">') < now.indexOf('<script src="../js/skin.js">') && now.indexOf('<script src="../js/skin.js">') < now.indexOf('<script src="../js/render.js">'), "geometry → skin → render");
  assert.equal(/<meta http-equiv="Content-Security-Policy"[^>]*>/.exec(now)[0], /<meta http-equiv="Content-Security-Policy"[^>]*>/.exec(old)[0], "CSP idéntica");
  const v = read("js/viewer.js"), v0 = head("js/viewer.js");
  assert.match(v, /skin: projectSkin\(settings\)\n  \}\);/);
  assert.equal(v.replace(/,\n    \/\* FLUYO-019\.2:[\s\S]*?skin: projectSkin\(settings\)\n/, "\n"), v0, "viewer.js sin el bloque = HEAD");
  assert.ok(!/prSkin|skinSel|togglePresentSkin/.test(v), "sin conmutador en el Viewer");
  const i = VIEWER_SCRIPTS.indexOf("js/skin.js");
  assert.ok(i > 0 && VIEWER_SCRIPTS[i - 1] === "js/geometry.js" && VIEWER_SCRIPTS[i + 1] === "js/render.js", "harness del Viewer con skin.js en su sitio");
});
test("alcance · editor: presentSkin ya no existe; #skinSel vive en «Lienzo» (#canvasTools); sw.js v86 con skin.js precacheado", () => {
  for (const f of fs.readdirSync(path.join(root, "js")).map((f) => "js/" + f).concat(["index.html", "s/index.html"])) assert.ok(!/presentSkin/.test(read(f)), f + ": sin presentSkin");
  const html = read("index.html");
  const tools = html.slice(html.indexOf('<div id="canvasTools"'), html.indexOf('<span id="grpAnimHome"'));
  assert.match(tools, /<select id="skinSel"[^>]*>\s*<option value="flat">Plano<\/option>\s*<option value="built">Construido \(2\.5D\)<\/option>\s*<\/select>/, "control «Aspecto» con la lista cerrada, dentro de «Lienzo»");
  assert.ok(html.indexOf('id="fontGlobalSel"') < html.indexOf('id="skinSel"'), "junto a «Tipografía»");
  assert.match(html, /<button id="prSkin" type="button" aria-pressed="false"[^>]*>Plano<\/button>/, "la barra de Present arranca en plano (ausente = plano)");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v103";/);
  assert.ok(read("sw.js").includes('"./js/skin.js",'), "skin.js precacheado (también lo usa el Viewer)");
  for (const f of ["js/editor-runtime.js", "js/ui.js", "js/export.js", "js/viewer.js", "js/state.js"]) assert.ok(read(f).includes("projectSkin(settings)"), f + " lee el aspecto por projectSkin");
  assert.ok(!/skin/.test(read("js/analytics.js")), "sin telemetría de la piel");
});

/* ── golden compartido con el MCP (019.3) ── */
const FIXTURE = "test/fixtures/fluyo-019-2-skin.fluyo.json", GOLDEN = "test/fixtures/fluyo-019-2-skin-svg.json";
/* Las líneas del SVG que dependen de la piel: capas de los nodos (clipPath incluido), trazos y puntas de las conexiones
   (aterrizaje) y el anillo de salida. No dependen de la medición de texto, así que el MCP puede reproducirlas. */
function skinSvgLines(svg) {
  return svg.split("\n").map((l) => l.trim()).filter((l) =>
    /^<clipPath id="skin-clip-/.test(l) ||
    /^<path d="[^"]*" fill="[^"]*"( stroke="[^"]*" stroke-width="[^"]*")?( stroke-dasharray="[^"]*")? stroke-linejoin="round"( clip-path="url\(#skin-clip-[^)]*\)")?\/>$/.test(l) ||
    /^<path d="[^"]*" fill="[^"]*"\/>$/.test(l) ||
    /^<path d="[^"]*" fill="[^"]*" stroke="[^"]*" stroke-width="1\.5"\/>$/.test(l));
}
test("golden · fixture con skin:\"built\" y golden SVG de la piel (generados por el browser test desde el editor real) existen y son coherentes", () => {
  assert.ok(fs.existsSync(path.join(root, FIXTURE)) && fs.existsSync(path.join(root, GOLDEN)), "FLUYO_UPDATE_GOLDEN=1 node test/fluyo-019-2-browser.cjs los genera");
  const p = JSON.parse(read(FIXTURE)), g = JSON.parse(read(GOLDEN));
  assert.equal(p.version, 5); assert.equal(p.settings.skin, "built");
  assert.deepEqual(new Set(p.doc.pages[0].nodes.map((n) => n.shape)), new Set(["rect", "cylinder", "icon", "hex", "text"]), "piezas con y sin piel");
  assert.equal(norm(M, p).settings.skin, "built", "el fixture carga con la piel");
  assert.equal(g.skin, "built"); assert.equal(g.theme, p.doc.theme);
  assert.ok(Array.isArray(g.lines) && g.lines.length >= 40, "líneas de piel: " + g.lines.length);
  assert.ok(g.lines.some((l) => l.startsWith('<clipPath id="skin-clip-')), "clip del cilindro");
  assert.deepEqual(skinSvgLines(g.lines.join("\n")), g.lines, "el golden es exactamente lo que extrae skinSvgLines");
});
/* FLUYO-019.4a (decisión 213) cambió la sección `landing` de fluyo-019-1-skin.json y las conexiones que aterrizan en
   fluyo-019-2-skin-svg.json; FLUYO-019-MCP-PARITY portó el aterrizaje al MCP y cerró la brecha: las copias vuelven a ser
   iguales, sin excepciones. */
test("golden · fixtures compartidos con fluyo-mcp (si está al lado): la piel y su golden son byte a byte los mismos", () => {
  const mcp = path.resolve(root, "..", "fluyo-mcp", "test", "fixtures");
  if (!fs.existsSync(mcp)) return;
  for (const f of ["fluyo-019-1-skin.json", "fluyo-019-2-skin.fluyo.json", "fluyo-019-2-skin-svg.json"]) {
    const other = path.join(mcp, f);
    assert.ok(fs.existsSync(other), "falta en fluyo-mcp: " + f);
    assert.equal(fs.readFileSync(other, "utf8").replace(/\r\n/g, "\n"), read("test/fixtures/" + f), f + " igual en los dos repos");
  }
});
module.exports = { skinSvgLines };
