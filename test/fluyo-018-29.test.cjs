"use strict";
/* FLUYO-018.29 — R1 + G1 (auditoría post-slices de 018.18 sobre 441a75c / v102). Comprobaciones estáticas y en vm; lo que solo se
   ve pintado (alto real del encabezado de Present, filas tapadas, alpha que llega al lienzo, globo de `message`) lo mide
   test/fluyo-018-29-browser.cjs en Chrome real.
   · Alcance: kernel (model, config, motor, playback, story-playback, integridad, autoría), render, geometría, exportación, enlace y
     URL corta idénticos a HEAD; CACHE v103.
   · R1: fitViewPresent reserva el borde inferior REAL del encabezado en su forma más alta (mensaje, cierre de «terminada» si algún
     envío falla y línea de la ruta incluidos), medido con filas sonda que nunca se pintan; sin alto fijo (84).
   · G1: saltar EN PAUSA marca `revealAt`; FluyoStoryClock.reveal da alpha 1 a los cues de ESE momento (solo presentación): el reloj
     queda en `at`, el Trace, el horario, la duración y la salida de los cues no cambian; reproduciendo, saltar no cambia nada. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };
/* el complejo de 017.1 con un `message` propio en el OCCURRENCE del segundo momento (at 500) */
const FIX = JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));
FIX.doc.pages[0].scenarios[0].steps.find((s) => s.id === 2).message = "El banco rechaza la operación";
/* B9 de FASE 6: Historias con ruta de Flujo; la 3.ª tiene una dependencia de llegada (el momento espera a su envío) */
const B9 = JSON.parse(read("test/fixtures/fluyo-scenarios-semantics-6-b9.json"));
B9.doc.pages[0].scenarios[0].steps.find((s) => s.id === 2).message = "Worker A deja de aceptar pedidos";
/* «Kafka cae y vuelve» con la recuperación 80 ms después del OCCURRENCE de 3000: al aterrizar en ella, el cue del momento anterior
   está TODAVÍA en su entrada; no es del momento elegido y debe seguir igual */
const NEAR = JSON.parse(JSON.stringify(FIX));
for (const st of NEAR.doc.pages[0].scenarios[1].steps) if (st.at === 4500) st.at = 3080;

/* ───────── alcance y release ───────── */
test("alcance: kernel, render, geometría, exportación, enlace y URL corta idénticos a HEAD; CACHE v103", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js",
    "js/render.js", "js/geometry.js", "js/export.js", "js/share-url.js", "js/link-codec.js", "js/flow-semantics.js", "js/skin.js", "index.html", "s/index.html", "css/styles.css", "css/share.css"]) {
    let head;
    try { head = execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"); } catch { return; }   // sin git (copia de mutaciones)
    assert.equal(read(f), head, f + " sin cambios");
  }
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v108";/);
  assert.doesNotMatch(read("js/story-clock.js"), /document\.|window\.|requestAnimationFrame|setTimeout|setInterval|localStorage|Date\.now|Math\.random|performance\./, "story-clock.js sigue puro");
  const mcp = path.join(root, "..", "fluyo-mcp", "scripts", "sync-kernel.ts");
  if (fs.existsSync(mcp)) assert.ok(!fs.readFileSync(mcp, "utf8").includes("story-clock"), "story-clock.js sigue fuera del kernel del MCP");
});

/* ───────── R1 ───────── */
test("R1: fitViewPresent reserva el borde REAL del encabezado reproduciendo (sin alto fijo) y lo mide con la página actual", () => {
  const ps = read("js/present-story.js");
  const fit = between(ps, "function fitViewPresent(", "\n}\n");
  assert.doesNotMatch(fit, /\b84\b/, "sin el alto fijo de 84 px");
  assert.ok(fit.includes("top=Math.max(24, presentHeaderBottom()-r.top)"), "el hueco de arriba es el borde inferior medido del encabezado");
  assert.ok(fit.indexOf("presentStoryRefresh();") >= 0 && fit.indexOf("presentStoryRefresh();") < fit.indexOf("presentHeaderBottom()"), "se pinta el encabezado de ESTA página antes de medirlo");
  assert.ok(fit.includes("bar.offsetHeight+28"), "el mando sigue reservando su alto real (018.18)");
  const hb = between(ps, "function presentHeaderBottom(){", "\n}\n");
  assert.ok(hb.includes('FluyoStory.describe("finished", sc, {logEvents:run.trace.events, cursorVirtual:0}'), "las filas de «terminada» salen del mismo modelo, sobre el Trace de la Historia");
  assert.ok(hb.includes('probe("psCaption", end ? end.caption : "En pausa")'), "fila sonda del mensaje si ahora no hay mensaje");
  assert.ok(hb.includes('if(end && end.summary && !$("psSummary").textContent) probe("psSummary", end.summary);'), "y la del cierre, solo si algún envío falla");
  assert.ok(hb.includes("scFlowPresentLine()") && hb.includes('probe("psFlow is"+route.status, route.text)'), "la línea de la ruta, con su texto y su clase, desde el inicio (lista)");
  assert.ok(hb.includes('setAttribute("aria-hidden","true")'), "las sondas no se anuncian");
  assert.ok(hb.includes("for(const el of probes) el.remove();"), "y se quitan en la misma tarea");
  assert.ok(hb.indexOf("getBoundingClientRect().bottom") < hb.indexOf("el.remove()"), "se mide con ellas puestas");
  /* ni CSS ni HTML cambian: es el mismo encabezado, medido */
  assert.ok(!ps.includes("844") && !ps.includes("390"), "sin parche por viewport");
});

/* ───────── G1: el reloj, con el kernel real ───────── */
function kernel(fx) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console });
  for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js"]) vm.runInContext(read("js/" + f), ctx, { filename: f });
  ctx.run = (code) => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, ctx));
  vm.runInContext(`doc = projectFromProjectData(${JSON.stringify(fx)}).doc; var __pg = doc.pages[0];`, ctx);
  return ctx;
}
const fxv = (rs) => rs.activeNodeEffects.map((x) => [x.stepId, +x.alpha.toFixed(6), +x.enter.toFixed(6)]);

test("G1: saltar en pausa a cada momento: el reloj queda en `at`; los cues de ESE momento salen completos (alpha 1); el resto, igual", () => {
  let inEntry = 0;
  for (const [fx, si] of [[FIX, 0], [FIX, 1], [NEAR, 1], [B9, 0], [B9, 2], [B9, 3]]) {
    const k = kernel(fx);
    const r = k.run(`
      const sc = __pg.scenarios[${si}], c = FluyoStoryClock.create(), out = [];
      FluyoStoryClock.pause(c, 5000);
      const times = FluyoStoryClock.schedule(sc, FluyoStory.stepMeta(sc.steps)).times;
      for (let i = 0; i < times.length; i++) {
        const s = FluyoStoryClock.seek(c, 5000, __pg, sc, i);
        const raw = FluyoStory.renderState(s.playback, sc, FluyoStoryClock.now(c, 5000));
        const rawCopy = JSON.parse(JSON.stringify(raw));
        const shown = FluyoStoryClock.reveal(raw, s.playback);
        const landed = s.playback.activeNodeEffects.filter((x) => x.virtualAt === times[i]).map((x) => x.stepId);
        out.push({ i, at: s.at, t: times[i], revealAt: s.playback.revealAt, now: FluyoStoryClock.now(c, 5000), cursor: s.playback.cursorVirtual, landed,
          raw: rawCopy.activeNodeEffects.map((x) => [x.stepId, x.alpha, x.enter]), shown: shown.activeNodeEffects.map((x) => [x.stepId, x.alpha, x.enter, x.effects.message || ""]) });
      }
      return out;`);
    for (const m of r) {
      const tag = `doc ${fx === FIX ? "complejo" : fx === NEAR ? "complejo (80 ms)" : "B9"} · Historia ${si} · momento ${m.i}`;
      assert.equal(m.at, m.t, tag + ": aterriza exactamente en su instante visible");
      assert.equal(m.revealAt, m.t, tag + ": en pausa se marca el momento");
      assert.equal(m.now, 5000, tag + ": el reloj no se mueve");
      assert.equal(m.cursor, m.t, tag + ": cursor = at");
      for (const [id, a, e, msg] of m.shown) {
        const raw = m.raw.find((x) => x[0] === id);
        if (m.landed.includes(id)) {
          assert.equal(raw[1], 0, tag + ": el kernel sigue dando alpha 0 al entrar (CUE_FADE_IN_MS intacto)");
          assert.deepEqual([a, e], [1, 1], tag + ": paso " + id + " completo ya");
        } else { assert.deepEqual([a, e], [raw[1], raw[2]], tag + ": paso " + id + " (de otro momento) sin cambios"); if (raw[2] < 1) inEntry++; }
      }
      if (fx === FIX && si === 0 && m.i === 1) assert.ok(m.shown.some((x) => x[3] === "El banco rechaza la operación" && x[1] === 1), "el `message` del paso, completo");
      if (fx === B9 && si === 0 && m.i === 1) assert.ok(m.shown.some((x) => x[3] === "Worker A deja de aceptar pedidos" && x[1] === 1), "el `message` del paso con ruta, completo");
    }
    assert.ok(r.some((m) => m.landed.length), "hay momentos con cue");
  }
  assert.ok(inEntry > 0, "se ha probado un cue de OTRO momento todavía en su entrada (y no se revela)");
});

test("G1: reveal es solo presentación: no toca el Playback, el Trace, el horario, la Historia ni las dependencias de llegada", () => {
  for (const si of [0, 2]) {
    const k = kernel(B9);
    const r = k.run(`
      const sc = __pg.scenarios[${si}], sc0 = JSON.stringify(sc), meta = FluyoStory.stepMeta(sc.steps);
      const trace0 = JSON.stringify(FluyoStory.run(__pg, sc)), sch0 = JSON.stringify(FluyoStoryClock.schedule(sc, meta));
      const deps0 = JSON.stringify(FluyoStoryClock.arrivalDependencies(sc));
      const c = FluyoStoryClock.create(); FluyoStoryClock.pause(c, 9000);
      const out = [];
      for (let i = 0; i < 4; i++) {
        const s = FluyoStoryClock.seek(c, 9000, __pg, sc, i);
        const pb0 = JSON.stringify(s.playback), rs = FluyoStory.renderState(s.playback, sc, 9000), pbAfterTick = JSON.stringify(s.playback);
        const objs = rs.activeNodeEffects.slice(), objs0 = JSON.stringify(objs);
        FluyoStoryClock.reveal(rs, s.playback);
        out.push({ samePb: JSON.stringify(s.playback) === pbAfterTick, sameInput: JSON.stringify(objs) === objs0, pbTickIdempotent: pb0 === pbAfterTick,
          trace: JSON.stringify(s.playback.trace.events.map((e) => [e.type, e.at, e.stepId])), schedule: JSON.stringify(s.playback.schedule) });
      }
      return { out, sc: JSON.stringify(sc) === sc0, trace: JSON.stringify(FluyoStory.run(__pg, sc)) === trace0, sch: JSON.stringify(FluyoStoryClock.schedule(sc, meta)) === sch0,
        deps: JSON.stringify(FluyoStoryClock.arrivalDependencies(sc)) === deps0, sch0: JSON.parse(sch0), depsN: FluyoStoryClock.arrivalDependencies(sc).waits.size };`);
    for (const m of r.out) {
      assert.ok(m.samePb, "el Playback no cambia con reveal");
      assert.ok(m.sameInput, "los objetos de la proyección de entrada no se mutan (se copian)");
      assert.equal(m.schedule, JSON.stringify(r.sch0), "el horario visible del Playback = el de la Historia");
    }
    assert.ok(r.sc && r.trace && r.sch && r.deps, "Historia, Trace, horario y dependencias intactos");
    if (si === 2) { assert.ok(r.depsN > 0, "la Historia 3 de B9 espera una llegada"); assert.ok(r.sch0.shifted, "y su momento se desplaza"); }
  }
});

test("G1: saltar REPRODUCIENDO no cambia nada (sin revealAt, el cue entra con su fade); una reproducción continua tampoco", () => {
  const k = kernel(FIX);
  const r = k.run(`
    const sc = __pg.scenarios[0], c = FluyoStoryClock.create();
    const s = FluyoStoryClock.seek(c, 5000, __pg, sc, 1);
    const raw = FluyoStory.renderState(s.playback, sc, FluyoStoryClock.now(c, 5000)), a = JSON.stringify(raw);
    const same = JSON.stringify(FluyoStoryClock.reveal(raw, s.playback)) === a;
    const later = FluyoStory.renderState(s.playback, sc, FluyoStoryClock.now(c, 5070)), l = JSON.stringify(later);
    const st = FluyoStoryClock.start(__pg, sc, 0).playback;
    let cont = true; for (let t = 0; t <= 8000; t += 35) { const rs = FluyoStory.renderState(st, sc, t), j = JSON.stringify(rs); if (JSON.stringify(FluyoStoryClock.reveal(rs, st)) !== j) cont = false; }
    return { revealAt: s.playback.revealAt === undefined, same, a0: raw.activeNodeEffects.map((x) => x.alpha), mid: later.activeNodeEffects.map((x) => x.alpha),
      sameLater: JSON.stringify(FluyoStoryClock.reveal(later, s.playback)) === l, startRevealAt: st.revealAt === undefined, cont };`);
  assert.ok(r.revealAt, "reproduciendo, saltar no marca el momento");
  assert.ok(r.same && r.sameLater, "reveal no cambia nada");
  assert.ok(r.a0.includes(0) && r.mid.some((a) => a > 0 && a < 1), "el cue sigue entrando con CUE_FADE_IN_MS (0 → 0,5 a 70 ms)");
  assert.ok(r.startRevealAt && r.cont, "reproducción continua: reveal es la identidad en todos los fotogramas");
});

test("G1: saltar en pausa y reanudar: sigue exactamente desde `at`; el cue sigue completo (no reaparece desde 0) y sale cuando salía", () => {
  const k = kernel(FIX);
  const r = k.run(`
    const sc = __pg.scenarios[0], c = FluyoStoryClock.create();
    FluyoStoryClock.pause(c, 5000);
    const s = FluyoStoryClock.seek(c, 5000, __pg, sc, 1);           // momento at 500
    FluyoStoryClock.resume(c, 20000);                                  // 15 s mirando en pausa
    const rows = [];
    const dur0 = s.playback.activeNodeEffects.find((x) => x.stepId === 2).duration;
    const DS = [0, 16, 70, 139, 140, 400, 1000, dur0 - 200, dur0 - 100, dur0 - 1, dur0, dur0 + 200];
    for (const d of DS) {
      const now = FluyoStoryClock.now(c, 20000 + d), rs = FluyoStoryClock.reveal(FluyoStory.renderState(s.playback, sc, now), s.playback);
      rows.push({ d, now, v: s.playback.cursorVirtual, fx: rs.activeNodeEffects.map((x) => [x.stepId, +x.alpha.toFixed(4)]) });
    }
    /* la misma ventana en una reproducción continua desde 0 */
    const pb = FluyoStoryClock.start(__pg, sc, 0).playback, cont = [];
    for (let t = 0; t <= 500; t += 50) FluyoScenarioPlayback.tick(pb, t);
    for (const d of DS.filter((d) => d >= 140)) { const rs = FluyoStory.renderState(pb, sc, 500 + d); cont.push({ d, fx: rs.activeNodeEffects.map((x) => [x.stepId, +x.alpha.toFixed(4)]) }); }
    const dur = dur0;
    const end = FluyoStoryClock.reveal(FluyoStory.renderState(s.playback, sc, FluyoStoryClock.now(c, 20000 + dur)), s.playback);
    const endCont = FluyoStory.renderState(pb, sc, 500 + dur);
    return { rows, cont, dur, end: end.activeNodeEffects.some((x) => x.stepId === 2), endCont: endCont.activeNodeEffects.some((x) => x.stepId === 2) };`);
  for (const row of r.rows) assert.equal(row.v, 500 + row.d, `+${row.d} ms: el reloj sigue desde at (sin adelantar ni retrasar)`);
  const cue = (row) => (row.fx.find((x) => x[0] === 2) || [2, null])[1];
  for (const d of [0, 16, 70, 139]) assert.equal(cue(r.rows.find((x) => x.d === d)), 1, `+${d} ms: el cue del momento sigue completo (sin parpadeo al reanudar)`);
  assert.ok(r.cont.some((c) => c.fx.some((x) => x[0] === 2 && x[1] > 0 && x[1] < 1)), "se ha muestreado la salida del cue (alpha entre 0 y 1)");
  for (const c of r.cont) assert.deepEqual(r.rows.find((x) => x.d === c.d).fx, c.fx, `+${c.d} ms: idéntico a la reproducción continua (salida y fin intactos)`);
  assert.ok(r.dur > 140, "duración del cue " + r.dur + " ms");
  assert.equal(r.end, false, "a +duración el cue ya terminó…"); assert.equal(r.endCont, false, "…igual que en la continua");
});

/* ───────── G1: el editor real en vm (Editor y, por él, Present) ───────── */
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
const cue2 = (E) => JSON.parse(E.run('JSON.stringify((buildScenarioRenderState().activeNodeEffects.find((x)=>x.stepId===2)||{alpha:null}).alpha)'));

test("G1 editor: ⏭ / ⏮ / fila en pausa → el cue del momento completo ya; Reanudar sigue desde at; reproduciendo, saltar conserva el fade", () => {
  const E = editor();
  const before = E.run("JSON.stringify(doc)"), trace0 = E.run("JSON.stringify(FluyoStory.run(P(), scActiveScenario()))");
  E.run("scRun()"); E.__T = 100; E.run("scTick(); scPause()");
  E.__T = 3000;                                                       // el tiempo real pasa en pausa
  E.run('$("scNext").onclick()');                                     // ⏭ → momento at 500
  assert.equal(E.run("scPlayback.cursorVirtual"), 500, "aterriza exactamente en at");
  assert.equal(E.run("scNow()"), 100, "el reloj de la Historia no se mueve (sigue en el instante pausado)");
  assert.equal(cue2(E), 1, "⏭ en pausa: el globo del momento, completo en el primer fotograma");
  E.__T = 9000; assert.equal(cue2(E), 1, "y sigue así mientras dura la pausa");
  E.run('$("scNext").onclick()'); E.run('$("scPrev").onclick()');    // ⏭ ⏮: vuelve al momento por el otro lado
  assert.equal(E.run("scPlayback.cursorVirtual"), 500); assert.equal(cue2(E), 1, "⏮ en pausa también");
  const rows = E.run('[...$("scStoryboard").querySelectorAll(".scStoryRow")].map((r)=>r.dataset.stepId)');
  E.run('$("scNext").onclick()');
  E.run(`[...$("scStoryboard").querySelectorAll(".scStoryRow")].find((r)=>r.dataset.stepId===${JSON.stringify(rows[1])}).onclick({ target: { closest: () => null } })`);
  assert.equal(E.run("scPlayback.cursorVirtual"), 500); assert.equal(cue2(E), 1, "tocar la fila en pausa también");
  E.run('$("scPause").onclick()');                                    // Reanudar
  assert.equal(E.run("scIsPaused()"), false);
  assert.equal(E.run("scNow() - scPlayback.startedAtReal"), 500, "Reanudar sigue exactamente desde at");
  assert.equal(cue2(E), 1, "sin parpadeo al reanudar");
  E.__T = 9100; E.run("scTick()"); assert.equal(E.run("scPlayback.cursorVirtual"), 600);
  /* reproduciendo: saltar no cambia (el cue entra con su fade) */
  E.run('$("scPrev").onclick()'); E.run('$("scNext").onclick()');
  assert.equal(E.run("scIsPaused()"), false); assert.equal(E.run("scPlayback.cursorVirtual"), 500);
  assert.equal(E.run("scPlayback.revealAt === undefined"), true, "reproduciendo no se marca el momento");
  assert.equal(cue2(E), 0, "reproduciendo, el cue entra desde 0 como antes");
  E.__T += 70; assert.ok(cue2(E) > 0 && cue2(E) < 1, "y a 70 ms va por la mitad de su entrada");
  /* desde terminada, ⏮ vuelve al último momento EN PAUSA (decisión 157): también completo */
  E.__T = 99999; E.run("scTick()"); assert.equal(E.run("scStatus"), "completed");
  E.run('$("scPrev").onclick()'); assert.equal(E.run("scIsPaused()"), true);
  assert.equal(E.run("scPlayback.revealAt"), 7000);
  E.run("scReset()");
  assert.equal(E.run("JSON.stringify(doc)"), before, "el documento no cambia");
  assert.equal(E.run("JSON.stringify(FluyoStory.run(P(), scActiveScenario()))"), trace0, "el Trace no cambia");
  assert.equal(E.__undos, 0, "ninguna entrada de Undo");
});

test("G1: el editor (y Present, que pinta con él) y el Viewer pasan la proyección por FluyoStoryClock.reveal; nada más la pinta", () => {
  const es = read("js/editor-scenarios.js"), vw = read("js/viewer.js");
  const b = between(es, "function buildScenarioRenderState() {", "\n}\n");
  assert.ok(b.includes("FluyoStory.renderState(scPlayback, scActiveScenario(), scNow())") && b.includes("FluyoStoryClock.reveal(rs, scPlayback)"), "editor");
  const v = between(vw, "function renderViewerFrame(){", "\n}\n");
  assert.ok(v.includes("FluyoStoryClock.reveal(FluyoStory.renderState(story.playback, story.scenario, storyNow()), story.playback)"), "Viewer");
  const calls = [...fs.readdirSync(path.join(root, "js"))].flatMap((f) => [...read("js/" + f).matchAll(/FluyoStory\.renderState\(/g)].map(() => f));
  assert.deepEqual(calls.sort(), ["editor-scenarios.js", "viewer.js"], "no hay otra proyección pintada sin reveal");
  const clock = read("js/story-clock.js"), seek = between(clock, "function seek(", "\n  }\n");
  assert.ok(seek.includes("if(isPaused(c)) started.playback.revealAt = times[k];"), "solo en pausa");
});

test("R1: las filas de «terminada» que se reservan = las que pinta Present al terminar (mismo modelo, mismo Trace)", () => {
  for (const [fx, si, sum] of [[FIX, 0, "1 evento no pudo realizarse"], [B9, 0, ""], [B9, 1, ""]]) {
    const k = kernel(fx);
    const r = k.run(`
      const sc = __pg.scenarios[${si}], run = FluyoStory.run(__pg, sc);
      const reserved = FluyoStory.describe("finished", sc, { logEvents: run.trace.events, cursorVirtual: 0 }, () => "", () => null);
      const pb = FluyoStory.start(__pg, sc, 0).playback; for (let t = 0; t <= 60000; t += 100) FluyoScenarioPlayback.tick(pb, t);
      const real = FluyoStory.describe("finished", sc, pb, () => "", () => null);
      return { reserved: [reserved.caption, reserved.summary], real: [real.caption, real.summary] };`);
    assert.deepEqual(r.reserved, r.real, "Historia " + si);
    assert.equal(r.real[1], sum);
  }
});

test("undo029 (para los alcances de slices anteriores) devuelve EXACTOS a la base los archivos servidos que cambia esta tarea; undoMsg la lleva debajo", () => {
  const { undo029, PIECES, BASE_029 } = require("./fluyo-018-29-undo.cjs"), { undo030 } = require("./fluyo-018-30-undo.cjs");   /* FLUYO-018.30 va encima: se deshace antes */
  const { undoI18n } = require("./fluyo-i18n-001-undo.cjs");   /* y FLUYO-I18N-001 encima de 018.30 */
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  assert.deepEqual(Object.keys(PIECES).sort(), ["js/editor-scenarios.js", "js/present-story.js", "js/story-clock.js", "js/viewer.js"]);
  for (const f of Object.keys(PIECES)) {
    let base;
    try { base = execFileSync("git", ["-C", gitRoot, "show", BASE_029 + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n"); } catch { return; }   // sin git
    assert.equal(undo029(f, undo030(f, undoI18n(f, read(f)))), base, f);
  }
  assert.ok(read("test/fluyo-step-message-001-undo.cjs").includes("src = undo029(file, undo030(file, undoI18n(file, src)));"), "undoMsg deshace antes esta tarea");
});
