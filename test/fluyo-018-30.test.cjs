"use strict";
/* FLUYO-018.30 — El Viewer en un teléfono: la cámara sigue el momento de la Historia (auditoría y diseño en .ai/tasks/FLUYO-018.30.md).
   Comprobaciones en vm sobre el viewer.js REAL (test/viewer-harness.cjs) y las funciones puras de viewer-viewport.js; lo que solo se ve
   pintado (tamaño de etiqueta en pantalla, rótulo, giro, Present a pantalla completa) lo mide test/fluyo-018-30-browser.cjs en Chrome.
   · Puras: viewportFollowZoom (null si el diagrama entero se lee; suelo 0,6; techo 1; el mayor al que cabe el momento más grande),
     viewportFrameBox (no mueve si ya se ve; centra; si no cabe, el primer elemento queda entero), lerpViewport (extremos exactos).
   · Viewer en 390 × 685: Reproducir acerca a un zoom legible y enseña el momento entero en la zona libre; cambiar de momento solo
     desplaza; saltar en pausa encuadra el momento y no toca G1 (revealAt); arrastrar/rueda/Encajar toman la cámara; ⏭/⏮ la devuelven;
     Detener vuelve al diagrama entero; girar reencuadra; Present no hereda el acercamiento; prefers-reduced-motion = sin transición.
   · Escritorio (1440 × 749): la cámara no toca la vista en toda la Historia.
   · Alcance: solo viewer.js y viewer-viewport.js entre los archivos servidos de esta tarea; kernel, reloj, render, Present, editor
     intactos frente a la base; undo030 devuelve la base EXACTA; CACHE ≥ v104 (el número lo fija el orden de commit). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { makeViewer } = require("./viewer-harness.cjs");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const BASE = "87a9d76";
const RAG = JSON.parse(read("test/fixtures/step-message/rag-mcp.fluyo.json"));
const CX = JSON.parse(read("test/fixtures/fluyo-017-1-qa-complejo.fluyo.json"));
const B9 = JSON.parse(read("test/fixtures/fluyo-scenarios-semantics-6-b9.json"));

/* ───────── puras (viewer-viewport.js) ───────── */
function pure() {
  const ctx = vm.createContext({ Math });
  vm.runInContext("function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }\n" + read("js/viewer-viewport.js"), ctx);
  return (code) => vm.runInContext(code, ctx);
}
test("puras · viewportFollowZoom: null si el diagrama entero se lee; suelo 0,6, techo 1 y el mayor al que cabe el momento más grande", () => {
  const R = pure(), rect = { left: 0, top: 70, width: 390, height: 600 };
  R("var rect=" + JSON.stringify(rect));
  assert.equal(R("viewportFollowZoom([{x:0,y:0,w:100,h:100}], rect, 0.6)"), null, "a 0,6 el diagrama entero ya se lee: no se sigue");
  assert.equal(R("viewportFollowZoom([{x:0,y:0,w:100,h:100}], rect, 1.2)"), null, "escritorio");
  assert.equal(R("viewportFollowZoom([{x:0,y:0,w:100,h:100}], rect, 0.3)"), 1, "momentos pequeños: nunca por encima del tamaño del autor");
  assert.equal(R("viewportFollowZoom([{x:0,y:0,w:100,h:100},{x:0,y:0,w:448,h:100}], rect, 0.3)"), (390 - 32) / 448, "el mayor zoom al que cabe el momento más ancho");
  assert.equal(R("viewportFollowZoom([{x:0,y:0,w:2000,h:100}], rect, 0.3)"), 0.6, "suelo de 0,6 (decisión 148): no se encoge para meterlo todo");
  assert.equal(R("viewportFollowZoom([null,{x:0,y:0,w:100,h:900}], rect, 0.3)"), Math.max(0.6, (600 - 32) / 900), "también por alto; los momentos sin caja no cuentan");
  assert.equal(R("viewportFollowZoom([], {left:0,top:0,width:20,height:20}, 0.3)"), null, "sin zona libre no hay cámara");
  assert.equal(R("FOLLOW_MIN_ZOOM"), 0.6); assert.equal(R("FOLLOW_MAX_ZOOM"), 1);
});
test("puras · viewportFrameBox: no mueve si ya se ve; centra el momento; si no cabe, su primer elemento queda entero", () => {
  const R = pure();
  R("var rect={left:0,top:100,width:400,height:500}");
  const t = JSON.parse(R("JSON.stringify(viewportFrameBox({x:0,y:0,zoom:0.3}, {x:100,y:100,w:200,h:100}, rect, 1, 16))"));
  assert.deepEqual(t, { zoom: 1, x: 200 - 200, y: 100 + 250 - 150 }, "centrado en la zona libre (que empieza bajo el rótulo)");
  assert.equal(R("viewportFrameBox(" + JSON.stringify(t) + ", {x:100,y:100,w:200,h:100}, rect, 1, 16)"), null, "ya se ve entero a ese zoom: la cámara no se mueve");
  assert.notEqual(R("viewportFrameBox(" + JSON.stringify(t) + ", {x:100,y:100,w:200,h:100}, rect, 0.8, 16)"), null, "otro zoom: se mueve");
  /* momento de 1000 de ancho a zoom 1 en 400: no cabe; el foco (un nodo de 120 × 60 en x=900) queda entero */
  const f = JSON.parse(R("JSON.stringify(viewportFrameBox({x:0,y:0,zoom:1}, {x:0,y:0,w:1000,h:100}, rect, 1, 16, {x:900,y:50,hw:60,hh:30}))"));
  const left = 900 - 60 + f.x, right = 900 + 60 + f.x;
  assert.ok(left >= 16 && right <= 400 - 16, "el foco entero: " + left + "–" + right);
  assert.equal(right, 400 - 16, "y el centro, lo más cerca posible del centro del momento (el foco pegado al margen del lado del momento)");
  assert.equal(R("viewportFrameBox({x:0,y:0,zoom:1}, null, rect, 1)"), null);
});
test("puras · lerpViewport: extremos exactos; zoom geométrico; el punto bajo el centro va en línea recta", () => {
  const R = pure(), a = { x: 10, y: 20, zoom: 0.25 }, b = { x: -300, y: -100, zoom: 1 };
  R("var a=" + JSON.stringify(a) + ", b=" + JSON.stringify(b));
  assert.deepEqual(JSON.parse(R("JSON.stringify(lerpViewport(a,b,0,200,300))")), a);
  assert.deepEqual(JSON.parse(R("JSON.stringify(lerpViewport(a,b,1,200,300))")), b);
  const m = JSON.parse(R("JSON.stringify(lerpViewport(a,b,0.5,200,300))"));
  assert.ok(Math.abs(m.zoom - 0.5) < 1e-12, "a mitad de camino, la media geométrica: " + m.zoom);
  const wa = (200 - a.x) / a.zoom, wb = (200 - b.x) / b.zoom, wm = (200 - m.x) / m.zoom;
  assert.ok(Math.abs(wm - (wa + wb) / 2) < 1e-9, "punto del mundo bajo el centro a medio camino");
});

/* ───────── Viewer real ───────── */
async function phone(fixture, { width = 390, height = 685, reduced = false } = {}) {
  const v = makeViewer({ search: "?s=demo" });
  await v.boot(); await v.waitForPhase((p) => p === "ready" || p === "error");
  assert.equal(v.viewer().phase, "ready");
  v.context.Image = function () { this.complete = false; };   /* los iconos de RAG: el harness no trae Image */
  /* el contexto falso del harness no devuelve degradados (los usa el destello de llegada de un envío) */
  v.run("sctx=new Proxy(sctx,{get:(t,p)=>/^create(Radial|Linear)Gradient$/.test(p) ? ()=>({addColorStop(){}}) : t[p]})");
  v.context.__size = { width, height };
  v.el("wrap").getBoundingClientRect = () => ({ left: 0, top: 0, width: v.context.__size.width, height: v.context.__size.height });
  v.el("sv").getBoundingClientRect = v.el("wrap").getBoundingClientRect;
  if (reduced) v.context.window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
  v.context.__fix = fixture;
  v.run("storyReset(); doc=projectFromProjectData(__fix).doc; settings=projectFromProjectData(__fix).settings; doc.cur=0; fitView(); storyRefresh();");
  return v;
}
const VIEW = (v) => v.viewer().view;
const settle = (v) => { v.frames(1); v.advance(1000); v.frames(1); };
/* ¿se ve entero el momento i (su caja, con aire) en la zona libre? */
const inside = (v, i) => JSON.parse(v.run(`(()=>{ const b=followBoxes()[${i}], r=viewerFreeRect(), z=view.zoom;
  const x0=b.x*z+view.x, y0=b.y*z+view.y; return JSON.stringify(x0>=r.left-0.5 && y0>=r.top-0.5 && x0+b.w*z<=r.left+r.width+0.5 && y0+b.h*z<=r.top+r.height+0.5); })()`));
const momentCount = (v) => v.run("FluyoStoryClock.momentTimes(story.scenario).length");
const fitsAt = (v, i, z) => v.run(`(()=>{ const b=followBoxes()[${i}], r=viewerFreeRect(); return b.w*${z}<=r.width-32 && b.h*${z}<=r.height-32; })()`);

test("Viewer 390 × 685 · Reproducir acerca a un zoom legible (0,6–1) y enseña el momento entero; luego solo desplaza", async () => {
  for (const [name, fx] of [["RAG (dependencias de llegada)", RAG], ["B9 (ruta de Flujo)", B9], ["017.1 complejo", CX]]) {
    const v = await phone(fx);
    const fit = VIEW(v).zoom;
    assert.ok(fit < 0.6, name + ": el diagrama entero sale a " + fit.toFixed(3) + " (ilegible)");
    v.run("storyPlay()"); v.frames(1);
    assert.equal(v.viewer().follow.on, true, name + ": la cámara sigue");
    assert.equal(v.viewer().follow.moving, true, name + ": con transición (no salta)");
    settle(v);
    const z = VIEW(v).zoom, fz = v.viewer().follow.zoom;
    assert.ok(z >= 0.6 && z <= 1, name + ": zoom de seguimiento " + z);
    assert.equal(z, fz, name + ": el de viewportFollowZoom");
    assert.ok(inside(v, 0) || !fitsAt(v, 0, z), name + ": el primer momento entero en la zona libre");
    /* recorrer la Historia: el zoom no cambia, cada momento que cabe se ve entero */
    const n = momentCount(v);
    for (let i = 1; i < n; i++) {
      v.run("FluyoStoryClock.pause(story.clock, performance.now())");
      v.run(`storySeek(${i})`); settle(v);
      assert.equal(VIEW(v).zoom, z, name + ` momento ${i}: mismo zoom (la cámara solo se desplaza)`);
      assert.ok(inside(v, i) || !fitsAt(v, i, z), name + ` momento ${i} entero en la zona libre`);
    }
  }
});
test("Viewer 390 × 685 · saltar en pausa: encuadra el momento, el reloj queda en `at` y G1 (revealAt) intacto", async () => {
  const v = await phone(RAG);
  v.run("storyPlay()"); settle(v);
  v.run("storyTogglePause()");
  assert.equal(v.viewer().story, "running");
  const n = momentCount(v);
  v.run(`storySeek(${n - 2})`);
  const at = v.run(`FluyoStoryClock.momentTimes(story.scenario, story.playback)[${n - 2}]`);
  assert.equal(v.run("story.playback.cursorVirtual"), at, "el cursor exactamente en at");
  assert.equal(typeof v.run("story.playback.revealAt"), "number", "G1: revealAt marcado");
  settle(v);
  assert.ok(inside(v, n - 2), "el momento elegido entero en la zona libre");
  assert.equal(v.run("storyPaused()"), true, "sigue en pausa: la cámara no reanuda nada");
});
test("Viewer 390 × 685 · quien mira toma la cámara (arrastrar, rueda, −/+, Encajar); ⏭/⏮ y Reproducir la devuelven", async () => {
  const v = await phone(RAG);
  v.run("storyPlay()"); settle(v);
  v.wheel({ deltaY: 40 });
  assert.equal(v.viewer().follow.on, false, "rueda: la cámara deja de seguir");
  const before = VIEW(v);
  v.run("FluyoStoryClock.pause(story.clock, performance.now()); FluyoScenarioPlayback.tick(story.playback, 1e9)"); v.frames(1);
  assert.deepEqual(VIEW(v), before, "cambia el momento y la vista del usuario no se mueve");
  v.run("storyReset(); storyPlay()"); settle(v);
  v.run("storyPrev()"); settle(v);
  assert.equal(v.viewer().follow.on, true, "⏮ la devuelve");
  /* arrastrar con un dedo */
  v.el("sv").dispatch("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
  v.el("sv").dispatch("pointermove", { pointerId: 1, clientX: 100, clientY: 100 });
  assert.equal(v.viewer().follow.on, true, "tocar sin mover no toma la cámara");
  v.el("sv").dispatch("pointermove", { pointerId: 1, clientX: 140, clientY: 90 });
  v.el("sv").dispatch("pointerup", { pointerId: 1 });
  assert.equal(v.viewer().follow.on, false, "arrastrar sí");
  v.run("storyNext()"); settle(v);
  assert.equal(v.viewer().follow.on, true, "⏭ la devuelve");
  /* Encajar: el diagrama entero también reproduciendo */
  v.el("btnFit").onclick(); v.frames(1);
  const fit = v.run("JSON.stringify(fitTarget())");
  assert.equal(JSON.stringify(VIEW(v)), fit, "Encajar enseña el diagrama entero");
  assert.equal(v.viewer().follow.on, false);
  v.run("storyNext()"); settle(v);
  assert.ok(VIEW(v).zoom >= 0.6, "y ⏭ vuelve a acercar");
  v.el("btnZoomOut").onclick();
  assert.equal(v.viewer().follow.on, false, "−/+ también toman la cámara");
});
test("Viewer 390 × 685 · Detener vuelve al diagrama entero (con transición), también si quien mira movió la vista acercada", async () => {
  const v = await phone(CX);
  const fit0 = JSON.stringify(VIEW(v));
  v.run("storyPlay()"); settle(v);
  assert.ok(VIEW(v).zoom >= 0.6);
  v.el("stStop").onclick(); v.frames(1);
  assert.equal(v.viewer().story, "ready");
  assert.equal(v.viewer().follow.moving, true, "vuelve con transición");
  settle(v);
  assert.equal(JSON.stringify(VIEW(v)), fit0, "el mismo encuadre que al abrir");
  v.run("storyPlay()"); settle(v); v.wheel({ deltaY: 30 });
  assert.equal(v.viewer().follow.on, false);
  v.el("stStop").onclick(); settle(v);
  assert.equal(JSON.stringify(VIEW(v)), fit0, "la cámara de la Historia acercó: Detener devuelve el estado de antes de reproducir");
  /* Encajar ya dejó el diagrama entero: Detener no mueve nada */
  v.run("storyPlay()"); settle(v); v.el("btnFit").onclick(); v.wheel({ deltaY: 30 }); const mine = JSON.stringify(VIEW(v));
  v.el("stStop").onclick(); settle(v);
  assert.equal(JSON.stringify(VIEW(v)), mine, "tras Encajar, la vista es de quien mira");
});
test("Viewer · girar el teléfono reencuadra el momento (sin transición); en apaisado el seguimiento sigue si el diagrama entero no se lee", async () => {
  const v = await phone(B9);
  v.run("storyPlay()"); settle(v);
  v.context.__size = { width: 844, height: 276 };
  v.run("viewerReframe()");
  assert.equal(v.viewer().follow.moving, false, "reencuadre al instante");
  const z = VIEW(v).zoom;
  assert.ok(z >= 0.6 && z <= 1, "apaisado: " + z);
  const i = Math.max(0, v.run("storyNav().index"));
  assert.ok(inside(v, i) || !fitsAt(v, i, z), "el momento en curso a la vista tras girar");
  /* a una tableta (el diagrama entero se lee): el diagrama entero, sin seguir */
  v.context.__size = { width: 1024, height: 700 };
  v.run("viewerReframe()");
  assert.equal(JSON.stringify(VIEW(v)), v.run("JSON.stringify(fitTarget())"), "donde se lee entero, encaja entero");
  assert.equal(v.viewer().follow.zoom, null);
});
test("Viewer · Present no hereda el acercamiento: al salir, el diagrama entero", async () => {
  const v = await phone(RAG);
  const fit0 = JSON.stringify(VIEW(v));
  v.run("storyPlay()"); settle(v);
  v.run("enterPresent()"); v.frames(1);
  assert.equal(v.viewer().story, "ready", "presentar reinicia la Historia (como siempre)");
  v.run("exitPresent()"); v.frames(1);
  assert.equal(JSON.stringify(VIEW(v)), fit0, "al salir de Present, el encuadre del diagrama entero");
});
test("Viewer · prefers-reduced-motion: la cámara salta sin transición", async () => {
  const v = await phone(RAG, { reduced: true });
  v.run("storyPlay()"); v.frames(1);
  assert.equal(v.viewer().follow.moving, false);
  assert.ok(VIEW(v).zoom >= 0.6);
});
test("Viewer 1440 × 749 (escritorio) · la cámara no toca la vista en toda la Historia", async () => {
  for (const fx of [RAG, B9, CX]) {
    const v = await phone(fx, { width: 1440, height: 749 });
    const fit = JSON.stringify(VIEW(v));
    v.run("storyPlay()"); settle(v);
    assert.equal(v.viewer().follow.zoom, null, "el diagrama entero se lee: no se sigue");
    const n = momentCount(v);
    for (let i = 0; i < n; i++) { v.run(`FluyoStoryClock.pause(story.clock, performance.now()); storySeek(${i})`); settle(v); assert.equal(JSON.stringify(VIEW(v)), fit, "momento " + i); }
    v.el("stStop").onclick(); settle(v);
    assert.equal(JSON.stringify(VIEW(v)), fit, "Detener tampoco");
  }
});
test("Viewer · el documento compartido no cambia (Steps, dependencias y Trace)", async () => {
  const v = await phone(RAG);
  const inv = () => v.run("JSON.stringify({steps:P().scenarios[0].steps, deps:P().scenarios[0].arrivalDependencies||null, trace:FluyoStory.run(P(), storyScenario())})");
  const before = inv();
  v.run("storyPlay()"); settle(v); v.run("storyTogglePause(); storyNext(); storyPrev()"); settle(v); v.el("stStop").onclick(); settle(v);
  assert.equal(inv(), before);
});

/* ───────── alcance ───────── */
test("alcance · frente a la base solo cambian viewer.js y viewer-viewport.js de esta tarea; undo030 devuelve la base EXACTA; CACHE ≥ v104", () => {
  const gitRoot = process.env.FLUYO_GIT_ROOT || root;
  const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
  try { atBase("js/viewer.js"); } catch { return; }   // sin git (copia de mutaciones)
  /* lo que esta tarea NO toca: el reloj, el render, la geometría, la ruta, Present, el Viewer HTML/CSS, el enlace */
  for (const f of ["js/story-clock.js", "js/scenario-playback.js", "js/render.js", "js/geometry.js", "js/skin.js", "js/flow-semantics.js", "js/present-story.js",
    "js/link-codec.js", "js/share-url.js", "js/share-loader.js", "js/config.js", "s/index.html", "css/share.css", "css/styles.css", "index.html"])
    assert.equal(read(f), atBase(f), f + " sin cambios");
  const { undo030, PIECES, BASE_030 } = require("./fluyo-018-30-undo.cjs");
  assert.equal(BASE_030, BASE);
  assert.deepEqual(Object.keys(PIECES).sort(), ["js/viewer-viewport.js", "js/viewer.js"]);
  for (const f of Object.keys(PIECES)) assert.equal(undo030(f, read(f)), atBase(f), f + ": undo030 da la base");
  assert.ok(read("test/fluyo-step-message-001-undo.cjs").includes("src = undo029(file, undo030(file, src));"), "undoMsg deshace antes esta tarea");
  const cache = +(/const CACHE = "fluyo-static-v(\d+)";/.exec(read("sw.js")) || [])[1];
  assert.ok(cache >= 104, "CACHE sube (v" + cache + ")");
  assert.ok(!/^\s*import\s/m.test(read("js/viewer.js")) && !/^\s*import\s/m.test(read("js/viewer-viewport.js")), "scripts clásicos");
  assert.doesNotMatch(read("js/viewer-viewport.js"), /document\.|window\.|requestAnimationFrame|performance\./, "viewer-viewport.js sigue sin DOM");
});
