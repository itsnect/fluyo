"use strict";
/* FLUYO-018.18 — Contar una Historia en cualquier superficie. Comprobaciones estáticas y en vm (rápidas, sin navegador); lo que solo
   se ve pintado (lienzo útil, alturas, objetivos, toques reales, encaje del Viewer, giro) lo mide test/fluyo-018-18-browser.cjs en
   Chrome real.
   · Alcance: model.js, config.js y el resto del kernel, render.js, geometry.js y export.js idénticos a HEAD; story-clock.js NO es
     kernel (fluyo-mcp no lo copia); CACHE v77 y story-clock.js precacheado y cargado por el editor y el Viewer.
   · D1–D3: FluyoStoryClock (pausa congela la proyección, reanudar sigue desde el mismo instante, saltar a un momento da el mismo
     estado que una reproducción continua en ese instante, el Trace no cambia); la unidad es el momento.
   · D4–D6: el editor real (editor-scenarios.js en vm): Reproducir · Pausar · Reanudar · saltar (botones y fila) · Detener · Repetir,
     sin tocar el documento ni crear Undo; «Detener» en cualquier estado; #scNow sobre el lienzo.
   · D7–D8: Present: un toque no navega; dos grupos y una salida.  D9: el Viewer (vm) reproduce, pausa y salta; también presentando.
   · D10–D11: páginas sin ✕; selector en el teléfono con «＋ Nueva página»; renombrar sin prompt().  D12: Trazo › Dirección. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const FIX = JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };
function element(html, id) {
  const i = html.indexOf('id="' + id + '"'); assert.ok(i >= 0, "no existe #" + id);
  const start = html.lastIndexOf("<", i), tag = /^<(\w+)/.exec(html.slice(start))[1];
  const re = new RegExp("<(/?)" + tag + "\\b[^>]*>", "g"); re.lastIndex = start; let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return html.slice(start, re.lastIndex); }
  throw new Error("sin cerrar #" + id);
}

/* ───────── alcance y release ───────── */
test("alcance: kernel (model, config, motor, playback, story-playback, integridad, autoría), render, geometría y exportación idénticos a HEAD", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/render.js", "js/geometry.js", "js/export.js", "js/share-url.js", "js/link-codec.js", "css/identity.css"]) {
    let head;
    try { head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"); } catch { return; }   // sin git (copia de mutaciones)
    assert.equal(read(f), head, f + " sin cambios");
  }
});

test("story-clock.js: fuera del kernel, cargado por el editor y el Viewer tras story-playback.js, precacheado; CACHE v77", () => {
  const sw = read("sw.js"), html = read("index.html"), viewer = read("s/index.html");
  assert.match(sw, /const CACHE = "fluyo-static-v113";/);
  assert.ok(sw.includes('"./js/story-clock.js"'), "precacheado");
  assert.ok(html.indexOf('src="js/story-playback.js"') < html.indexOf('src="js/story-clock.js"') && html.indexOf('src="js/story-clock.js"') < html.indexOf('src="js/editor-scenarios.js"'), "editor: tras story-playback y antes de editor-scenarios");
  assert.ok(viewer.indexOf('src="../js/story-playback.js"') < viewer.indexOf('src="../js/story-clock.js"') && viewer.indexOf('src="../js/story-clock.js"') < viewer.indexOf('src="../js/viewer.js"'), "Viewer: tras story-playback y antes de viewer.js");
  /* nada de lo que carga index.html o s/index.html queda fuera del precache */
  for (const [page, prefix] of [[html, ""], [viewer, "../"]]) {
    const local = [...page.matchAll(/(?:src|href)="((?!https?:|#|data:)[^"]+\.(?:js|css|woff2))"/g)].map((m) => m[1].replace(prefix, ""));
    for (const u of local) assert.ok(sw.includes('"./' + u.replace(/^\.\//, "") + '"'), "en el precache: " + u);
  }
  const mcp = path.join(root, "..", "fluyo-mcp", "scripts", "sync-kernel.ts");
  if (fs.existsSync(mcp)) assert.ok(!fs.readFileSync(mcp, "utf8").includes("story-clock"), "fluyo-mcp no copia story-clock.js: no es kernel");
  const clock = read("js/story-clock.js");
  assert.doesNotMatch(clock, /document\.|window\.|requestAnimationFrame|setTimeout|setInterval|localStorage|Date\.now|Math\.random|performance\./, "puro: el tiempo real lo pasa quien llama");
});

/* ───────── D1–D3: el reloj, con el kernel real ───────── */
function kernel() {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console });
  for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js"]) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.run = (code) => vm.runInContext(code, ctx);
  ctx.run(`doc = projectFromProjectData(${JSON.stringify(FIX)}).doc; var __pg = doc.pages[0], __sc = __pg.scenarios[0];`);
  return ctx;
}
const view = (rs) => JSON.stringify({ n: rs.nodeStates, s: rs.activeSends.map((x) => [x.stepId, +x.progress.toFixed(6)]), c: rs.completedSends.map((x) => [x.stepId, x.terminalType, Math.round(x.ageMs)]), o: rs.activeOccurrences.map((x) => [x.stepId, +x.progress.toFixed(6)]), fx: rs.activeNodeEffects.map((x) => [x.stepId, +x.alpha.toFixed(6)]), l: rs.logEvents.map((e) => [e.type, e.at, e.stepId]) });

test("reloj: pausar congela la proyección; reanudar sigue desde el mismo instante (FluyoStoryClock)", () => {
  const k = kernel();
  const out = k.run(`(function(){
    const c = FluyoStoryClock.create(), R = (real) => FluyoStoryClock.now(c, real);
    const pb = FluyoStory.start(__pg, __sc, R(1000)).playback;
    FluyoStory.renderState(pb, __sc, R(1600));
    FluyoStoryClock.pause(c, 1600);
    const a = JSON.stringify(FluyoStory.renderState(pb, __sc, R(1600)));
    const b = JSON.stringify(FluyoStory.renderState(pb, __sc, R(9000)));
    const frozen = R(9000);
    FluyoStoryClock.resume(c, 9000);
    return { a, b, frozen, resumed: R(9100), paused: FluyoStoryClock.isPaused(c), cursor: pb.cursorVirtual };
  })()`);
  assert.equal(out.a, out.b, "en pausa, 7,4 s después la proyección es idéntica");
  assert.equal(out.frozen, 1600);
  assert.equal(out.resumed, 1700, "reanudar continúa desde el instante pausado (+100 ms)");
  assert.equal(out.paused, false);
  assert.equal(out.cursor, 600);
});

test("reloj: saltar a cada momento da exactamente el estado de una reproducción continua en ese instante; el Trace no cambia", () => {
  const k = kernel();
  const times = JSON.parse(k.run("JSON.stringify(FluyoStoryClock.momentTimes(__sc))"));
  assert.deepEqual(times, [0, 500, 2500, 7000], "momentos = grupos por `at` de la línea de tiempo (no Steps: hay 7)");
  assert.equal(k.run("__sc.steps.length"), 7);
  const trace0 = k.run("JSON.stringify(FluyoStory.run(__pg, __sc))"), sc0 = k.run("JSON.stringify(__sc)");
  for (let i = 0; i < times.length; i++) for (const extra of [0, 120, 400]) {
    const [seek, cont] = k.run(`(function(){
      const c = FluyoStoryClock.create();
      FluyoStoryClock.pause(c, 5000);                                   // saltar en pausa: el reloj queda en 5000
      const r = FluyoStoryClock.seek(c, 5000, __pg, __sc, ${i});
      FluyoStoryClock.resume(c, 5000);
      const vs = FluyoStory.renderState(r.playback, __sc, FluyoStoryClock.now(c, 5000 + ${extra}));
      const pb = FluyoStory.start(__pg, __sc, 0).playback;              // continua desde 0
      for (let t = 0; t <= ${times[i]} + ${extra}; t += 50) FluyoScenarioPlayback.tick(pb, t);
      const vc = FluyoStory.renderState(pb, __sc, ${times[i]} + ${extra});
      return [JSON.stringify({ index: r.index, rs: vs, log: r.playback.logEvents }), JSON.stringify({ index: ${i}, rs: vc, log: pb.logEvents })];
    })()`);
    const S = JSON.parse(seek), C = JSON.parse(cont);
    assert.equal(S.index, i);
    assert.equal(view({ ...S.rs, logEvents: S.log }), view({ ...C.rs, logEvents: C.log }), `momento ${i} + ${extra} ms: mismo estado`);
  }
  assert.equal(k.run("JSON.stringify(FluyoStory.run(__pg, __sc))"), trace0, "Trace intacto");
  assert.equal(k.run("JSON.stringify(__sc)"), sc0, "la Historia no se toca");
});

test("reloj: momento en curso y destinos de anterior/siguiente (la unidad es el momento)", () => {
  const k = kernel();
  const r = k.run(`(function(){ const t=[0,500,2500,7000], f=FluyoStoryClock; return [f.momentIndex(t,-1), f.momentIndex(t,0), f.momentIndex(t,499), f.momentIndex(t,500), f.momentIndex(t,9000),
    f.prevTarget(t,0), f.prevTarget(t,600), f.nextTarget(t,600), f.nextTarget(t,7000), f.nextTarget(t,-1)]; })()`);
  const rr = JSON.parse(JSON.stringify(r));
  assert.deepEqual(rr, [-1, 0, 0, 1, 3, null, 0, 2, null, 0]);
});

/* ───────── D4–D6: el editor real en vm ───────── */
const { makeScenarioUIContext, setupPanel, ensureUI } = require("./fluyo-016-harness.cjs");
function editor() {
  const { ctx, register } = makeScenarioUIContext();
  vm.runInContext(read("js/story-clock.js"), ctx);
  ctx.__T = 0; ctx.performance = { now: () => ctx.__T };
  vm.runInContext("performance = { now: () => __T };", ctx);
  ctx.run(`doc = projectFromProjectData(${JSON.stringify(FIX)}).doc; undoStack=[]; redoStack=[]; var __undos = 0;`);
  ctx.pushUndo = () => { ctx.__undos++; };
  setupPanel(ctx, register);
  for (const id of ["scNow", "scNowLabel", "scNowCaption", "scNowProgress", "scRunHint", "scPause", "scPrev", "scNext"]) register(id, ctx.document.createElement(id.startsWith("scNow") && id !== "scNow" ? "span" : id === "scNow" ? "div" : "button"));
  ctx.run('$("scNow").hidden = true; $("scRunHint").hidden = true; $("scPause").hidden = true; $("scPrev").hidden = true; $("scNext").hidden = true;');
  ctx.isSheetLayout = () => false;
  ctx.syncStoryState = () => {};
  ensureUI(ctx);
  ctx.run("scSelectStory(P().scenarios[0].id); scRenderPanel();");
  return ctx;
}
const at = (ctx) => ctx.run("scPlayback ? scPlayback.cursorVirtual : -1");

test("editor: Reproducir → Pausar → (el tiempo pasa) → Reanudar → saltar (botones) → Detener → Repetir; nada toca el documento ni crea Undo", () => {
  const E = editor();
  const before = E.run("JSON.stringify(doc)");
  E.run("scRun()");
  assert.equal(E.run("scStatus"), "running");
  assert.equal(E.run('$("scPause").hidden'), false, "Pausar a la vista mientras se reproduce");
  assert.equal(E.run('$("scPause").textContent'), "Pausar");
  E.__T = 300; E.run("scTick()"); assert.equal(at(E), 300);
  E.run('$("scPause").onclick()');                                       // Pausar
  assert.equal(E.run("scIsPaused()"), true);
  assert.equal(E.run('$("scPause").textContent'), "Reanudar");
  assert.equal(E.run('$("scNowLabel").textContent'), "En pausa");
  const frozen = E.run("JSON.stringify(buildScenarioRenderState())");
  E.__T = 4000; E.run("scTick()");
  assert.equal(at(E), 300, "en pausa el cursor no avanza");
  assert.equal(E.run("JSON.stringify(buildScenarioRenderState())"), frozen, "ni lo que se pinta");
  E.run('$("scPause").onclick()');                                       // Reanudar
  assert.equal(E.run("scIsPaused()"), false);
  E.__T = 4100; E.run("scTick()"); assert.equal(at(E), 400, "sigue desde el mismo instante");
  assert.equal(E.run('$("scNowProgress").textContent'), "1 / 4");
  E.run('$("scNext").onclick()'); assert.equal(at(E), 500, "siguiente momento");
  E.run('$("scNext").onclick()'); assert.equal(at(E), 2500);
  assert.equal(E.run('$("scNowProgress").textContent'), "3 / 4");
  E.run('$("scPrev").onclick()'); assert.equal(at(E), 500, "anterior momento");
  E.run('$("scPause").onclick()'); E.run('$("scNext").onclick()');
  assert.equal(E.run("scIsPaused()"), true, "saltar conserva la pausa"); assert.equal(at(E), 2500);
  E.run('$("scNext").onclick()'); assert.equal(at(E), 7000);
  assert.equal(E.run('$("scNext").disabled'), true, "en el último momento no hay siguiente");
  E.run('$("scPause").onclick()'); E.__T = 30000; E.run("scTick()");
  assert.equal(E.run("scStatus"), "completed");
  assert.equal(E.run('$("scRun").textContent'), "↻ Repetir");
  assert.equal(E.run('$("scReset").textContent'), "■ Detener", "D5: Detener también terminada");
  assert.equal(E.run('$("scPause").hidden'), true);
  E.run('$("scPrev").onclick()');
  assert.equal(E.run("scStatus"), "running"); assert.equal(E.run("scIsPaused()"), true, "desde terminada, anterior vuelve al último momento en pausa"); assert.equal(at(E), 7000);
  E.run('$("scReset").onclick()');
  assert.equal(E.run("scStatus"), "idle"); assert.equal(E.run("scClock"), null); assert.equal(E.run('$("scNow").hidden'), true);
  E.run("scRun()"); E.__T = 99999; E.run("scTick()"); E.run("scRun()");                     // Repetir desde terminada
  assert.equal(E.run("scStatus"), "running"); assert.equal(at(E), 0, "Repetir vuelve a empezar");
  E.run("scReset()");
  assert.equal(E.run("JSON.stringify(doc)"), before, "el documento no cambia");
  assert.equal(E.__undos, 0, "ninguna entrada de Undo");
});

test("editor: tocar una fila de la línea de tiempo durante la reproducción salta a su momento (todos los Steps del momento intactos)", () => {
  const E = editor();
  const before = E.run("JSON.stringify(doc)");
  E.run("scRun()"); E.__T = 100; E.run("scTick(); scPause()");
  const rows = E.run('[...$("scStoryboard").querySelectorAll(".scStoryRow")].map((r)=>r.dataset.stepId)');
  assert.equal(rows.length, 7);
  for (const [id, expect] of [[rows[4], 2500], [rows[0], 0], [rows[6], 7000], [rows[2], 2500]]) {
    E.run(`[...$("scStoryboard").querySelectorAll(".scStoryRow")].find((r)=>r.dataset.stepId===${JSON.stringify(id)}).onclick({ target: { closest: () => null } })`);
    assert.equal(at(E), expect, "fila del paso " + id + " → momento " + expect);
    assert.equal(E.run("scIsPaused()"), true);
  }
  /* también tocando el NOMBRE del evento (el botón de la fila), no solo la fila: el botón no debe abrir su menú ni seleccionar */
  E.run(`[...$("scStoryboard").querySelectorAll(".scStoryRow")].find((r)=>r.dataset.stepId===${JSON.stringify(rows[4])}).querySelector(".scStepPrimary").onclick()`);
  assert.equal(at(E), 2500, "tocar el nombre del evento salta a su momento");
  assert.equal(E.run("scSelectedStep"), null, "reproduciendo, tocar no selecciona (no se edita)");
  const main = E.run('[...$("scStoryboard").querySelectorAll(".scStoryRow")].find((r)=>r.classList.contains("scSeekable")) ? 1 : 0');
  assert.equal(main, 1, "reproduciendo, las filas son saltos (clase scSeekable)");
  E.run("scReset()");
  assert.equal(E.run("JSON.stringify(doc)"), before);
  assert.equal(E.__undos, 0);
});

test("editor-scenarios.js / interaction.js: el reloj solo decide el tiempo; Espacio pausa la Historia; un toque en Present no navega", () => {
  const es = read("js/editor-scenarios.js"), it = read("js/interaction.js"), rt = read("js/editor-runtime.js");
  assert.ok(between(es, "function scRun(opts) {", "\n}\n").includes("FluyoStoryClock.start(P(), sc, scNow(), FluyoI18n.t)"), "misma receta (FluyoStory.start dentro de FluyoStoryClock.start, 018.21), reloj de la Historia");
  assert.ok(between(es, "function scTick() {", "\n}\n").includes("if (scIsPaused()) return;"), "en pausa no hay fotogramas propios");
  /* SCENARIOS-SEMANTICS-001 FASE 4 añade la ruta observada al mismo renderState (const rs = …; rs.flow): la proyección sigue siendo esta */
  assert.ok(between(es, "function buildScenarioRenderState() {", "\n}\n").includes("FluyoStory.renderState(scPlayback, scActiveScenario(), scNow());"));
  assert.ok(between(es, "function scSeekMoment(i) {", "\n}\n").includes("FluyoStoryClock.seek(scClock, performance.now(), P(), sc, i)"), "saltar = la misma receta con el origen desplazado");
  assert.ok(!/scStatus = "paused"/.test(es), "«en pausa» no es un estado nuevo de scStatus");
  assert.match(rt, /if\(typeof scPlaceNow==="function"\) scPlaceNow\(\);/, "el rótulo se coloca en cada fotograma");
  const up = between(it, 'cv.addEventListener("pointerup", ev=>{', "const p=toWorld(ev);");
  assert.ok(!up.includes("nextSlide()"), "D7: un toque en Present no pasa de diapositiva");
  assert.ok(up.includes("if(presenting) return;"));
  assert.ok(it.includes("scStatus===\"running\" && typeof scTogglePause===\"function\""), "Espacio pausa/reanuda la Historia");
  assert.ok(it.includes('if(phase==="playing" || phase==="paused") presentTogglePause(); else presentPlay();'), "Present: Espacio pausa/reanuda");
});

/* ───────── D4: el momento sobre el lienzo; D5: una palabra ───────── */
test("index.html: #scNow dentro de #wrap; el transporte en la superficie; «Detener»; Present con dos grupos y una salida", () => {
  const html = require("./fluyo-i18n-002-s2a-undo.cjs").undoS2a("index.html", read("index.html"));   /* FLUYO-I18N-002 S2a: sin sus marcas */
  assert.ok(element(html, "wrap").includes('id="scNow"'), "D4: el momento activo vive sobre el lienzo");
  assert.ok(!element(html, "panelScenarios").includes('id="scNow"'), "y no en la hoja ni en la columna");
  const tr = element(html, "panelScenarios");
  for (const id of ["scPrev", "scRun", "scPause", "scNext", "scReset"]) assert.ok(tr.includes('id="' + id + '"'), "transporte #" + id);
  assert.match(html, /<button id="scReset" type="button" hidden>■ Detener<\/button>/);
  assert.ok(!/>Terminar</.test(html), "sin «Terminar»");
  const bar = element(html, "presentBar");
  assert.ok(element(bar, "psGroup").includes('id="psPlay"') && element(bar, "psGroup").includes('id="psPause"'), "grupo de la Historia");
  assert.ok(element(bar, "prPages").includes('id="prPrev"') && element(bar, "prPages").includes('id="prNext"'), "grupo de páginas");
  assert.ok(!/id="psEdit"/.test(html), "D8: una sola salida (sin «← Volver a editar» duplicado)");
  assert.equal((bar.match(/aria-label="Salir de la presentación"/g) || []).length, 1);
  assert.ok(!/>◀<|>▶<\/button>/.test(bar), "páginas con chevrons; ▶ es solo Reproducir");
  const css = read("css/styles.css");
  assert.match(css, /\.scNow\{position:absolute; left:50%; top:10px;/, "rótulo sobre el lienzo");
  assert.match(css, /\.scNowCaption\{[^}]*white-space:nowrap;/, "una línea: no crece con el texto");
  assert.match(css, /body\[data-story="playing"\] \.scHeader\{grid-template-areas:"ctl ctl expand" "stop exit exit";\}/, "hoja reproduciendo: transporte · Detener · Volver a editar");
  assert.match(css, /@media \(pointer:coarse\)\{ #presentBar button\{height:var\(--ctl-h-touch\); min-width:var\(--ctl-h-touch\);\} \}/, "mando de Present a 44 con dedo");
  assert.match(read("js/editor-share.js"), /Pulsa «Detener» antes de compartir\./);
});

/* ───────── D9: el Viewer en vm (harness compartido) ───────── */
const { makeViewer } = require("./viewer-harness.cjs");
/* Igual que fluyo-014.test.cjs: el enlace se construye con createShareUrl y el Viewer arranca desde el fragmento. */
async function openViewer(project) {
  const c = makeViewer();
  c.run(read("js/share-url.js"));
  c.context.project = project; c.context.location.href = "https://fluyo.space/";
  const hash = new URL(await c.run('createShareUrl(project,"https://fluyo.space/")')).hash;
  const v = makeViewer({ search: "", hash });
  v.connect(); await v.boot(); await v.waitForPhase((p) => p === "ready" || p === "error");
  return v;
}
test("Viewer: reproducir, pausar, saltar y detener con el mismo reloj; también presentando; el documento no cambia", async () => {
  const v = await openViewer(FIX);
  assert.equal(v.viewer().phase, "ready");
  const before = v.run("JSON.stringify(serializeProject())");
  assert.equal(v.el("stPlay").textContent, "▶ Reproducir historia");
  v.el("stPlay").onclick();
  assert.equal(v.viewer().story, "running");
  v.advance(300); v.frames(1);
  v.el("stPause").onclick();
  assert.equal(v.el("stPause").textContent, "Reanudar");
  const t = v.run("story.playback.cursorVirtual");
  v.advance(5000); v.frames(1);
  assert.equal(v.run("story.playback.cursorVirtual"), t, "en pausa no avanza");
  assert.match(v.el("stCaption").textContent, /^En pausa/);
  v.el("stNext").onclick(); v.frames(1);
  assert.equal(v.run("story.playback.cursorVirtual"), 500);
  v.el("stNext").onclick(); v.frames(1);
  assert.equal(v.run("story.playback.cursorVirtual"), 2500);
  assert.equal(v.el("stProgress").textContent, "3 / 4");
  v.el("stPrev").onclick(); v.frames(1);
  assert.equal(v.run("story.playback.cursorVirtual"), 500);
  v.el("stPause").onclick(); v.advance(100); v.frames(1);
  assert.equal(v.run("story.playback.cursorVirtual"), 600, "reanudar sigue desde el mismo instante");
  v.el("stStop").onclick();
  assert.equal(v.viewer().story, "ready");
  assert.equal(v.el("stOpen").hidden, true, "«Abrir en Fluyo» está en la cabecera");
  /* presentando también se reproduce (antes no) */
  v.run("enterPresent()");
  assert.equal(v.viewer().presenting, true);
  v.el("stPlay").onclick();
  assert.equal(v.viewer().story, "running", "la Historia se reproduce en Presentar");
  v.run("exitPresent()");
  assert.equal(v.viewer().story, "ready", "salir de Presentar descarta el runtime, como en el editor");
  assert.equal(v.run("JSON.stringify(serializeProject())"), before, "el documento instalado no cambia");
});

test("viewer.js / s/index.html / share.css: encaje tras la banda y al cambiar de tamaño; banda de alto fijo; apaisado sin «Hecho con Fluyo»", () => {
  const vj = read("js/viewer.js"), html = read("s/index.html"), css = read("css/share.css");
  const boot = between(vj, "async function bootViewer(){", "\nfunction centerClient(){");
  /* D9: se encaja DESPUÉS de colocar la banda, de forma síncrona (no solo cuando llegue la primera observación del ResizeObserver) */
  assert.ok(/storyRefresh\(\);\n(?:\s*\/\*[\s\S]*?\*\/\n)?\s*resizeCanvas\(sv, \$\("wrap"\)\);\n\s*fitView\(\);\n\s*if\(!wrapObserver/.test(boot), "D9: se encaja DESPUÉS de colocar la banda");
  assert.ok(boot.includes("new ResizeObserver(") && boot.includes("!viewMoved"), "y otra vez si el lienzo cambia de tamaño y nadie movió la vista");
  /* FLUYO-018.30: el encuadre lo calcula fitTarget (la misma zona libre que usa la cámara de la Historia) y fitView lo aplica */
  assert.ok(between(vj, "function fitTarget(){", "\n}\n").includes("vp.y+=f.top;") && between(vj, "function viewerFreeRect(){", "\n}\n").includes("card.offsetHeight+20"), "reserva arriba el rótulo de la Historia");
  assert.ok(element(html, "wrap").includes('id="stNow"'), "el momento sobre el lienzo");
  assert.ok(element(html, "story").includes('id="stActions"') && !element(html, "story").includes('id="stTitle"'), "la banda es solo el transporte");
  assert.match(css, /#story\{\n  display:flex; flex-direction:row; align-items:center; justify-content:center; flex:none;\n  height:calc\(var\(--ctl-h-touch\) \+ 20px\);/, "alto fijo");
  assert.match(css, /@media \(orientation:landscape\) and \(max-height:500px\)\{ #brand\{ display:none; \} \}/, "D9: sin «Hecho con Fluyo» en apaisado");
  assert.match(css, /@media \(max-width:700px\)\{\n  #chrome\{ flex-wrap:nowrap;/, "cabecera en una fila; las páginas, selector");
  assert.ok(!/storyPlay\(\)\{\n  if\(viewerPhase!=="ready" \|\| presenting\) return;/.test(vj), "presentar ya no impide reproducir");
});

/* ───────── D10–D11: páginas ───────── */
const { editor: pagesEditor } = require("./fluyo-018-7c-harness.cjs");
test("páginas: sin ✕; selector con la activa («03 Nombre»); la lista cambia de página y crea una («＋ Nueva página»); renombrar sin prompt()", () => {
  const E = pagesEditor();
  const page = (name) => ({ name, nodes: [], edges: [], nextId: 1, behaviors: [], scenarios: [], nextScenarioId: 1 });
  E.load({ version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, pages: ["Uno", "Dos", "Conciliación nocturna", "Cuatro"].map(page), cur: 2 }, settings: {} });
  E.run("renderTabs()");
  const bar = E.ctx.__bar.children;
  assert.equal(bar.filter((t) => (t.className || "").startsWith("tab")).length, 4);
  assert.ok(bar.every((t) => !(t.children || []).some((c) => c.className === "x")), "D11: ninguna pestaña lleva ✕");
  const sel = bar.find((c) => (c.className || "").includes("pgSelect"));
  assert.ok(sel, "D10: el selector de página existe (el CSS lo enseña en el teléfono)");
  assert.deepEqual(sel.children.map((c) => c.textContent), ["03", "Conciliación nocturna"], "la activa, por índice y nombre");
  sel.onclick();
  const menu = E.ctx.__menu.children;
  const items = menu.filter((c) => (c.className || "").startsWith("pgItem"));
  assert.equal(items.length, 4, "todas las páginas en la lista");
  assert.ok(items[2].className.includes("active"), "la activa marcada");
  assert.ok(menu.some((c) => c.textContent === "＋ Nueva página"), "crear dentro del selector");
  assert.ok(menu.some((c) => c.textContent === "Renombrar…") && menu.some((c) => c.textContent === "Eliminar página"), "y las acciones de la activa, con su nombre correcto");
  items[0].onclick();
  assert.equal(E.run("doc.cur"), 0, "elegir una página la activa");
  E.run("renderTabs()");
  E.ctx.__bar.children.find((c) => (c.className || "").includes("pgSelect")).onclick();
  E.ctx.__menu.children.find((c) => c.textContent === "＋ Nueva página").onclick();
  assert.equal(E.run("doc.pages.length"), 5, "«＋ Nueva página» crea (dos toques)");
  assert.equal(E.run("doc.cur"), 4, "y la activa");
  const ui = read("js/ui.js");
  assert.ok(!/\bprompt\("/.test(ui) && !/alert\(`El nombre de la página/.test(ui), "renombrar sin prompt()/alert()");
  assert.ok(!/x\.title="Cerrar página"/.test(ui), "ya no hay «Cerrar página»");
  const css = read("css/styles.css");
  assert.match(css, /#pagesBar > \.tab, #pagesBar > \.pgAdd\{display:none;\}/, "en el teléfono, la tira no se pinta");
  assert.match(css, /footer \.tab\.active \.pgMore\{display:inline-flex;\}/, "el ▾ también con ratón");
  assert.match(css, /#pagesBar > \.pgAdd\{--m:var\(--mask-plus\);[^}]*position:sticky; right:0;/, "«＋» fijo también en tableta y escritorio");
});

/* ───────── D12: Trazo › Dirección ───────── */
test("dirección: «Sentido de los puntos» en Trazo junto a las puntas; tres opciones = los tres valores de flowDir; grupo plegado «Puntos»", () => {
  const html = read("index.html"), ui = read("js/ui.js");
  /* FLUYO-018.23 (D5): la Dirección pasa de bloque de Trazo a grupo propio y abierto (#grpRoute, data-group="Dirección") */
  const stroke = element(html, "grpRoute");
  assert.ok(stroke.includes('id="dirKicker"') && /data-group="Dirección"/.test(stroke), "bloque «Dirección»");
  assert.ok(stroke.indexOf('id="rowArrows"') < stroke.indexOf('id="rowAnim"') && stroke.indexOf('id="rowArrE"') < stroke.indexOf('id="rowAnim"') && stroke.indexOf('id="rowAnim"') < stroke.indexOf('id="rowFlow"'), "puntas · puntos en movimiento · sentido");
  const seg = element(stroke, "flowSeg");
  assert.deepEqual([...seg.matchAll(/data-flow="(\w+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]), [["normal", "Hacia el destino"], ["reverse", "Hacia el origen"], ["alternate", "Ida y vuelta"]]);
  assert.deepEqual([...element(stroke, "flowSel").matchAll(/value="(\w+)"/g)].map((m) => m[1]), ["normal", "reverse", "alternate"], "los valores de siempre");
  const flow = element(html, "grpFlow");
  assert.match(flow, /data-group="Puntos"/); assert.doesNotMatch(flow.slice(0, flow.indexOf(">")), / open/, "plegado");
  assert.ok(flow.includes('id="rowDotC"') && flow.includes('id="rowSpeedF"') && !flow.includes('id="flowSel"'));
  assert.match(ui, /\$\("flowSel"\)\.onchange=\(\)=>\{ const e=singleEdge\(\); if\(e\)\{ pushUndo\(\); editEdge\(e,\{flowDir:\$\("flowSel"\)\.value\}\); scheduleAutosave\(\); syncFlowSeg\(e\); \} \};/, "escribe flowDir con un Undo, como antes");
  assert.ok(between(ui, "function syncFlowSeg(e){", "\n}\n").includes('$("rowFlow").style.display=moving ? "flex" : "none";'), "sin puntos en movimiento no se ofrece");
  assert.ok(ui.includes('segOnSelect("flowSeg","flowSel");') && ui.includes("sel.value=v; if(typeof sel.onchange===\"function\") sel.onchange();"), "el segmentado manda a través del control nativo (018.23: componente común)");
});
