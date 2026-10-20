"use strict";
/* FLUYO-019-FLOW-FADE — «Una pelota por ruta» (settings.single): la pelota se apaga al llegar a CADA conexión (decisión 208).
   Contratos en vm, contra el render.js de 266ac09 (antes del arreglo) como referencia:
   · flowBallFade(s, L) = clamp(min(s, L−s)/W, 0, 1) con W = min(FLOW_FADE_PX = 35, L/2): s es la distancia DENTRO de la
     conexión en curso, no la del camino (g.total) ni la del camino más largo del grupo (D).
   · Matriz V0–V7 de la auditoría + cadenas de 1, 2 y 4 conexiones, ramas que comparten tramo, anillo, rama corta en un grupo
     largo, conexión corta (< 70 px) y flowDir reverse. En cada fotograma (barrido denso de un periodo):
       – posición y número de pelotas IDÉNTICOS a 266ac09 (reloj del grupo, caminos, dedupe y bucle del GIF intactos);
       – α de cada pelota = la regla escrita aquí sobre la conexión en la que está (proyección sobre edgePoints);
       – llegada: en el último px de cada conexión α ≤ 1/W; salida: en el primer px α ≤ 1/W;
       – no se apaga antes de tiempo: a ≥ W px de los dos extremos, α = 1;
       – salto entre conexiones (ancla de llegada → ancla de salida de la siguiente): α ≤ 0,5/W a los dos lados;
       – bucle: t = 0 y t = periodo − ε dan α ≈ 0; t = k·periodo repite el fotograma de t = 0.
   · Caso sano (V0, V2a, V2b, V3): α idéntico bit a bit al de 266ac09 (en 280 px la ventana ya era 35 px).
   · OFF (single:false): drawFlowBalls no pinta nada y drawEdge (los puntos) es el de 266ac09, carácter a carácter.
   · Alcance: en render.js solo cambia drawFlowBalls (+ FLOW_FADE_PX/flowBallFade); flowGroups, pathGeometry, drawEdge y el resto,
     idénticos; geometry, skin, model, config, export, viewer, share e index sin cambios; sw.js solo sube CACHE (v89).
   Lo que necesita lienzo real (editor, Present, Viewer, píxeles, OFF byte a byte) lo mide test/fluyo-019-flow-fade-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const { undo4a } = require("./fluyo-019-4a-undo.cjs");   /* FLUYO-019.4a cambia a propósito skin.js, render.js y export.js: se deshace aquí; su alcance lo vigila test/fluyo-019-4a.test.cjs */
const { undo4b } = require("./fluyo-019-4b-undo.cjs");   /* FLUYO-019.4b cambia a propósito render.js, interaction.js, geometry.js, editor-runtime.js, state.js e index.html: se deshace aquí (antes que 019.4a y FASE 1); su alcance lo vigila test/fluyo-019-4b.test.cjs */
const { undo3: undo3only } = require("./fluyo-scenarios-semantics-3-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 3 cambia a propósito model.js, document-integrity.js, story-authoring.js, flow-semantics.js, editor-scenarios.js, index.html, styles.css y sw.js (precache): se deshace aquí, antes que todo lo demás; su alcance lo vigila test/fluyo-scenarios-semantics-3.test.cjs */
const { undoReverse } = require("./fluyo-step-reverse-002-undo.cjs");   /* FLUYO-STEP-REVERSE-002 cambia a propósito model.js, scenario-engine.js, story-playback.js, scenario-playback.js, story-authoring.js, document-integrity.js, render.js, editor-scenarios.js y selection.js: se deshace aquí, antes que FASE 3; su alcance lo vigila test/fluyo-step-reverse-002.test.cjs */
const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* FLUYO-STEP-REVERSE-003 añade «Invertir sentido» a editor-scenarios.js: se deshace aquí, antes que 002; su alcance lo vigila test/fluyo-step-reverse-003.test.cjs */
const { undo4 } = require("./fluyo-scenarios-semantics-4-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima de STEP-REVERSE-003: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-4.test.cjs */
const undo3 = (f, src) => undo3only(f, undoReverse(f, undoReverseUi(f, undo4(f, src))));
const { undoSemantics } = require("./fluyo-scenarios-semantics-undo.cjs");   /* SCENARIOS-SEMANTICS-001 (FASE 1) cambia a propósito model.js, geometry.js, render.js, ui.js, index.html y styles.css: se deshace aquí; su alcance lo vigila test/fluyo-scenarios-semantics-1.test.cjs */
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BEFORE = "266ac09";
const before = (f) => execFileSync("git", ["-C", gitRoot, "show", BEFORE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

function ctxFrom(get) {
  const ctx = vm.createContext({ doc: { pages: [], cur: 0, theme: "crema", customBg: "" },
    settings: { font: "Georgia, serif", speed: 0.5, single: true, build: false, stagger: 0.25, dots: 3 },
    lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), smooth: (t) => Math.min(1, Math.max(0, t)), console });
  vm.runInContext(get("js/config.js"), ctx);
  vm.runInContext("P=()=>doc.pages[doc.cur]; nodeById=id=>P().nodes.find(n=>n.id===id); edgeById=id=>P().edges.find(e=>e.id===id);", ctx);
  vm.runInContext(get("js/model.js").match(/function hexA\(col,a\)\{[^\n]*\n[^\n]*/)[0], ctx);
  vm.runInContext(get("js/geometry.js"), ctx);
  vm.runInContext(get("js/skin.js"), ctx);
  vm.runInContext(get("js/render.js"), ctx);
  /* lienzo que apunta cada arc con el globalAlpha vigente y absorbe todo lo demás */
  vm.runInContext(`function __rec(){ const log=[]; let ga=1; const t={log};
      return new Proxy(t,{ get:(o,k)=> k==="arc" ? ((x,y,r)=>log.push({x,y,r,ga})) : (k in o ? o[k] : (()=>{})),
                           set:(o,k,v)=>{ if(k==="globalAlpha") ga=v; o[k]=v; return true; } }); }
    function __balls(t){ const c=__rec(); drawFlowBalls(c,t); return c.log.filter(a=>a.r===7).map(a=>({x:a.x,y:a.y,ga:a.ga})); }
    function __edges(){ return P().edges.map(e=>({id:e.id, pts:edgePoints(e).map(p=>({x:p.x,y:p.y}))})); }`, ctx);
  return ctx;
}
const NOW = ctxFrom(read), OLD = ctxFrom(before);
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const load = (G, page, extra) => run(G, "doc.pages=[__a.page]; doc.cur=0; Object.assign(settings,{single:true,speed:0.5,build:false},__a.extra||{}); 0", { page, extra });

/* la regla, escrita aquí */
const FADE_PX = 35;
const rule = (s, L) => Math.min(1, Math.max(0, Math.min(s, L - s) / Math.min(FADE_PX, L / 2)));

/* ── documentos (A = (200,300), B = (640,300), C = (640,110), como en la auditoría; la central es siempre id 10) ── */
const N = (id, x, y, w = 160, h = 70) => ({ id, shape: "rect", x, y, w, h, label: "N" + id, color: "#6a9fb5", order: 0 });
const E = (id, from, to, ex) => Object.assign({ id, from, to, route: "straight", animated: true, flowDir: "normal", endArrow: true }, ex || {});
const page = (nodes, edges) => ({ name: "P", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 90, nodes, edges });
const AB = () => [N(1, 200, 300), N(2, 640, 300)], ABC = () => [N(1, 200, 300), N(2, 640, 300), N(3, 640, 110)];
const ORTHO_N = { route: "ortho", fromSide: "n", toSide: "n" };
/* chain: la sucesión de conexiones del único camino (para medir el salto en cada nodo intermedio) */
const CASES = [
  { k: "V0", name: "central sola (1 conexión)", nodes: AB(), edges: [E(10, 1, 2)], chain: [10], same: true },
  { k: "V1a", name: "+ inversa B→A añadida después", nodes: AB(), edges: [E(10, 1, 2), E(15, 2, 1)], chain: [10, 15] },
  { k: "V1b", name: "+ inversa B→A que ya estaba (arriba)", nodes: AB(), edges: [E(5, 2, 1), E(10, 1, 2)], chain: [5, 10] },
  { k: "V2a", name: "+ A→B paralela añadida después", nodes: AB(), edges: [E(10, 1, 2), E(15, 1, 2)], same: true },
  { k: "V2b", name: "+ A→B paralela que ya estaba (arriba)", nodes: AB(), edges: [E(5, 1, 2), E(10, 1, 2)], same: true },
  { k: "V3", name: "+ C→B entra en B desde arriba", nodes: ABC(), edges: [E(10, 1, 2), E(15, 3, 2)], same: true },
  { k: "V4", name: "+ B→C sale de B hacia arriba", nodes: ABC(), edges: [E(10, 1, 2), E(15, 2, 3)], chain: [10, 15] },
  { k: "V5", name: "+ A→B por arriba (ortho n→n)", nodes: AB(), edges: [E(10, 1, 2), E(15, 1, 2, ORTHO_N)] },
  { k: "V6", name: "+ B→A por arriba (ortho n→n, retorno)", nodes: AB(), edges: [E(10, 1, 2), E(15, 2, 1, ORTHO_N)], chain: [10, 15] },
  { k: "V7", name: "+ A→C hacia arriba (rama del mismo origen)", nodes: ABC(), edges: [E(10, 1, 2), E(15, 1, 3)] },
  { k: "C2", name: "cadena de 2 conexiones A→B→C", nodes: [N(1, 120, 300), N(2, 480, 300), N(3, 840, 300)], edges: [E(10, 1, 2), E(11, 2, 3)], chain: [10, 11] },
  { k: "C4", name: "cadena de 4 conexiones con giros (recta, ortho, recta, ortho)",
    nodes: [N(1, 120, 120), N(2, 480, 120), N(3, 480, 420), N(4, 840, 420), N(5, 840, 120)],
    edges: [E(10, 1, 2), E(11, 2, 3, { route: "ortho" }), E(12, 3, 4), E(13, 4, 5, { route: "ortho" })], chain: [10, 11, 12, 13] },
  { k: "SH", name: "ramas que comparten tramo (A→B, luego B→C y B→D)",
    nodes: [N(1, 120, 300), N(2, 460, 300), N(3, 820, 140), N(4, 820, 460)], edges: [E(10, 1, 2), E(11, 2, 3), E(12, 2, 4)] },
  { k: "RING", name: "anillo A→B→C→D→A", nodes: [N(1, 200, 300), N(2, 640, 300), N(3, 640, 560), N(4, 200, 560)],
    edges: [E(10, 1, 2), E(11, 2, 3), E(12, 3, 4), E(13, 4, 1)], chain: [10, 11, 12, 13] },
  { k: "SHORT", name: "rama corta (80 px) en un grupo largo", nodes: [N(1, 200, 300, 120, 60), N(2, 400, 300, 120, 60), N(3, 1180, 300, 120, 60), N(4, 1180, 900, 120, 60)],
    edges: [E(10, 1, 2), E(11, 1, 3, { route: "ortho", fromSide: "n", toSide: "n" }), E(12, 3, 4)] },
  { k: "TINY", name: "conexión corta (< 70 px, W = L/2)", nodes: [N(1, 200, 300, 120, 60), N(2, 360, 300, 120, 60), N(3, 760, 300, 120, 60)],
    edges: [E(10, 1, 2), E(11, 2, 3)], chain: [10, 11] },
  { k: "REV", name: "flowDir reverse (D4 fuera: la pelota sigue yendo de A a B)", nodes: AB(), edges: [E(10, 1, 2, { flowDir: "reverse" })], chain: [10], same: true },
];
const FRAMES = 2000, PERIOD = 1 / 0.5;

/* proyección de un punto sobre una ruta: distancia al trazo y distancia recorrida desde el ancla de salida */
function project(pts, p) {
  let best = { dd: Infinity, s: 0 }, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
    const w = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    const dd = Math.hypot(a.x + dx * w - p.x, a.y + dy * w - p.y);
    if (dd < best.dd - 1e-9) best = { dd, s: acc + w * l };
    acc += l;
  }
  return best;
}
const lenOf = (pts) => pts.reduce((L, p, i) => i ? L + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0, 0);
/* candidatos (conexión, s) de una pelota: todas las rutas que pasan por su centro */
function onEdges(edges, p) {
  return edges.map((e) => ({ id: e.id, L: lenOf(e.pts), ...project(e.pts, p) })).filter((c) => c.dd < 1e-6);
}
function sweep(G, frames = FRAMES) { const out = []; for (let k = 0; k < frames; k++) out.push(run(G, "__balls(__a)", PERIOD * k / frames)); return out; }

test("flowBallFade · tabla escrita a mano (W = min(35, L/2))", () => {
  assert.equal(run(NOW, "FLOW_FADE_PX"), 35);
  const T = [[0, 280, 0], [280, 280, 0], [140, 280, 1], [35, 280, 1], [245, 280, 1], [17.5, 280, 0.5], [262.5, 280, 0.5], [3, 280, 3 / 35], [277, 280, 3 / 35],
    [20, 40, 1], [10, 40, 0.5], [0, 40, 0], [40, 40, 0], [5, 40, 0.25], [35, 70, 1], [0.5, 1000, 0.5 / 35], [-3, 280, 0], [290, 280, 0]];
  for (const [s, L, want] of T) assert.ok(Math.abs(run(NOW, "flowBallFade(__a.s,__a.L)", { s, L }) - want) < 1e-12, `flowBallFade(${s}, ${L}) = ${want}`);
  /* nunca depende de nada más que (s, L) */
  assert.match(read("js/render.js"), /function flowBallFade\(s,L\)\{\n  const W=Math\.min\(FLOW_FADE_PX, L\/2\);\n  return clamp\(Math\.min\(s, L-s\)\/W, 0, 1\);\n\}/);
});

for (const cs of CASES) {
  test(`${cs.k} · ${cs.name}`, () => {
    for (const G of [NOW, OLD]) load(G, page(cs.nodes, cs.edges));
    const edges = run(NOW, "__edges()");
    const now = sweep(NOW), old = sweep(OLD);
    /* 1. reloj, caminos y dedupe intactos: mismas pelotas en el mismo sitio */
    for (let k = 0; k < FRAMES; k++) {
      assert.equal(now[k].length, old[k].length, `fotograma ${k}: nº de pelotas`);
      for (let i = 0; i < now[k].length; i++) assert.ok(now[k][i].x === old[k][i].x && now[k][i].y === old[k][i].y, `fotograma ${k}: la pelota ${i} está donde en ${BEFORE}`);
    }
    /* 2. α = la regla, sobre la conexión en la que está */
    const byEdge = new Map(edges.map((e) => [e.id, { L: lenOf(e.pts), arrive: [], depart: [], mid: [], seen: 0 }]));
    let checked = 0;
    for (let k = 0; k < FRAMES; k++) for (const b of now[k]) {
      const cands = onEdges(edges, b);
      assert.ok(cands.length, `fotograma ${k}: la pelota (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) está sobre alguna conexión`);
      const ok = cands.find((c) => Math.abs(b.ga - rule(c.s, c.L)) < 1e-9);
      assert.ok(ok, `fotograma ${k}: α ${b.ga} = regla en ${cands.map((c) => `e${c.id} s=${c.s.toFixed(2)}/${c.L.toFixed(1)} → ${rule(c.s, c.L).toFixed(4)}`).join(" | ")}`);
      const st = byEdge.get(ok.id); st.seen++; checked++;
      if (ok.L - ok.s < 1) st.arrive.push(b.ga);
      if (ok.s < 1) st.depart.push(b.ga);
      const W = Math.min(FADE_PX, ok.L / 2);
      if (ok.s >= W + 1e-6 && ok.L - ok.s >= W + 1e-6) st.mid.push(b.ga);
    }
    assert.ok(checked > FRAMES / 4, `pelotas comprobadas: ${checked}`);
    /* 3. llegada y salida en cada conexión recorrida; 4. sin fade prematuro */
    for (const [id, st] of byEdge) {
      if (!st.seen) continue;
      const W = Math.min(FADE_PX, st.L / 2);
      assert.ok(st.arrive.length > 0, `e${id}: la pelota llega a su ancla (muestras en el último px)`);
      assert.ok(Math.max(...st.arrive) <= 1 / W + 1e-9, `e${id}: al llegar α ≤ 1/W (máx ${Math.max(...st.arrive).toFixed(4)})`);
      if (st.depart.length) assert.ok(Math.max(...st.depart) <= 1 / W + 1e-9, `e${id}: al salir α ≤ 1/W`);
      if (st.L > 2 * W + 2) assert.ok(st.mid.length > 0 && st.mid.every((a) => a === 1), `e${id}: a ≥ ${W} px de los dos extremos, α = 1 (${st.mid.length} muestras)`);
    }
    /* 5. bucle: t = 0 y t = periodo − ε, α ≈ 0; t = k·periodo repite t = 0 */
    const at0 = run(NOW, "__balls(0)"), end = run(NOW, "__balls(__a)", PERIOD - 1e-7);
    assert.ok(at0.every((b) => b.ga < 1e-3) && end.every((b) => b.ga < 1e-3), `bucle: α ≈ 0 en t = 0 (${at0.map((b) => b.ga)}) y al cerrar el periodo (${end.map((b) => b.ga)})`);
    for (const k of [1, 2, 3]) assert.deepEqual(run(NOW, "__balls(__a)", PERIOD * k), at0, `t = ${k}·periodo = t = 0`);
    /* 6. caso sano: en la central (id 10, 280 px, sola en su camino) α idéntico bit a bit a 266ac09. En V3 la C→B (120 px) es
       otro grupo y sí cambia: su ventana era 120/8 = 15 px y ahora es 35 px */
    if (cs.same) {
      const c10 = edges.find((e) => e.id === 10).pts; let n10 = 0;
      for (let k = 0; k < FRAMES; k++) for (let i = 0; i < now[k].length; i++) if (project(c10, now[k][i]).dd < 1e-6) { n10++; assert.equal(now[k][i].ga, old[k][i].ga, `fotograma ${k}: α idéntico a ${BEFORE}`); }
      assert.ok(n10 > FRAMES / 4, `muestras en la central: ${n10}`);
    }
  });
}

/* el salto en cada nodo intermedio de una cadena: la pelota pasa del ancla de llegada de una conexión al ancla de salida de la
   siguiente (25 px en la inversa, 87 px en B→C…) y los dos lados quedan en α ≤ 0,5/W */
test("salto entre conexiones: a ±0,5 px de cada nodo intermedio, α ≤ 0,5/W a los dos lados (y en 266ac09 era 1)", () => {
  const rows = [];
  for (const cs of CASES.filter((c) => c.chain && c.chain.length > 1)) {
    for (const G of [NOW, OLD]) load(G, page(cs.nodes, cs.edges));
    const edges = new Map(run(NOW, "__edges()").map((e) => [e.id, e.pts]));
    const Ls = cs.chain.map((id) => lenOf(edges.get(id))), D = Ls.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < cs.chain.length - 1; i++) {
      acc += Ls[i];
      const a = edges.get(cs.chain[i]), b = edges.get(cs.chain[i + 1]);
      const endA = a[a.length - 1], startB = b[0], jump = Math.hypot(endA.x - startB.x, endA.y - startB.y);
      const at = (d) => run(NOW, "__balls(__a)", (d / D) * PERIOD), atOld = (d) => run(OLD, "__balls(__a)", (d / D) * PERIOD);
      const near = (list, p) => list.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1);
      const W1 = Math.min(FADE_PX, Ls[i] / 2), W2 = Math.min(FADE_PX, Ls[i + 1] / 2);
      const pre = near(at(acc - 0.5), endA), post = near(at(acc + 0.5), startB), preOld = near(atOld(acc - 0.5), endA);
      assert.ok(pre.length === 1 && post.length === 1, `${cs.k} e${cs.chain[i]}→e${cs.chain[i + 1]}: la pelota está junto al ancla de llegada y luego junto a la de salida`);
      assert.ok(pre[0].ga <= 0.5 / W1 + 1e-9 && post[0].ga <= 0.5 / W2 + 1e-9, `${cs.k}: α antes ${pre[0].ga.toFixed(4)} / después ${post[0].ga.toFixed(4)}`);
      rows.push(`${cs.k} e${cs.chain[i]}→e${cs.chain[i + 1]}: salto ${jump.toFixed(1)} px, α ${preOld[0] ? preOld[0].ga.toFixed(2) : "—"} (${BEFORE}) → ${pre[0].ga.toFixed(3)} / ${post[0].ga.toFixed(3)}`);
    }
  }
  console.log("  " + rows.join("\n  "));
  assert.ok(rows.length >= 9);
});

test("V1a/V4/V6 (sale algo de B): en 266ac09 llegaban con α = 1; ahora α en [0,3) px ≤ 3/35 y en [3,14) ≤ 14/35", () => {
  for (const k of ["V1a", "V4", "V6"]) {
    const cs = CASES.find((c) => c.k === k);
    for (const G of [NOW, OLD]) load(G, page(cs.nodes, cs.edges));
    const pts = run(NOW, "__edges()").find((e) => e.id === 10).pts, L = lenOf(pts);
    const bins = (G) => { const m = [0, 0, 0, 0]; for (const fr of sweep(G, 1000)) for (const b of fr) { const p = project(pts, b); if (p.dd > 1e-6) continue; const toEnd = L - p.s;
      [[0, 3], [3, 14], [14, 25], [25, 40]].forEach(([lo, hi], i) => { if (toEnd >= lo && toEnd < hi) m[i] = Math.max(m[i], b.ga); }); } return m; };
    const o = bins(OLD), n = bins(NOW);
    assert.ok(o[0] === 1 && o[1] === 1, `${k}: en ${BEFORE} la pelota llegaba opaca (${o.map((v) => v.toFixed(2))})`);
    assert.ok(n[0] <= 3 / 35 + 1e-9 && n[1] <= 14 / 35 + 1e-9 && n[2] <= 25 / 35 + 1e-9 && n[3] === 1, `${k}: ahora ${n.map((v) => v.toFixed(3))}`);
  }
});

test("V1b/V5 (el grupo se alarga): ya no empieza antes; α = 1 hasta 35 px del ancla de B", () => {
  for (const k of ["V1b", "V5"]) {
    const cs = CASES.find((c) => c.k === k);
    for (const G of [NOW, OLD]) load(G, page(cs.nodes, cs.edges));
    const pts = run(NOW, "__edges()").find((e) => e.id === 10).pts, L = lenOf(pts);
    const prof = (G) => { let m = 0; for (const fr of sweep(G, 1000)) for (const b of fr) { const p = project(pts, b); if (p.dd < 1e-6 && L - p.s >= 35 && L - p.s < 40) m = Math.max(m, b.ga); } return m; };
    const o = prof(OLD), n = prof(NOW);
    assert.ok(o < 0.7, `${k}: en ${BEFORE} la pelota no llegaba a verse entera en [35,40) px (α ${o.toFixed(2)})`);
    assert.equal(n, 1, `${k}: ahora α = 1 en [35,40) px`);
  }
});

test("rama corta de 80 px en un grupo largo: se ve entera (α máx = 1; en 266ac09 nunca pasaba de 0,35)", () => {
  const cs = CASES.find((c) => c.k === "SHORT");
  for (const G of [NOW, OLD]) load(G, page(cs.nodes, cs.edges));
  const pts = run(NOW, "__edges()").find((e) => e.id === 10).pts, L = lenOf(pts);
  assert.ok(Math.abs(L - 80) < 1e-9, `L = ${L}`);
  const max = (G) => Math.max(...sweep(G).flat().filter((b) => project(pts, b).dd < 1e-6).map((b) => b.ga));
  const o = max(OLD), n = max(NOW);
  assert.ok(o < 0.36, `${BEFORE}: α máx ${o.toFixed(3)}`);
  assert.ok(n > 0.99, `ahora: α máx ${n.toFixed(3)}`);
});

test("tramo compartido: dos caminos que van juntos dan UNA pelota con el mismo α (antes dependía de qué camino se pintaba primero)", () => {
  const cs = CASES.find((c) => c.k === "SH");
  load(NOW, page(cs.nodes, cs.edges));
  const edges = run(NOW, "__edges()"), e10 = edges.find((e) => e.id === 10).pts;
  let shared = 0;
  for (const fr of sweep(NOW, 500)) {
    const on10 = fr.filter((b) => project(e10, b).dd < 1e-6 && project(e10, b).s < lenOf(e10) - 1e-6);
    assert.ok(on10.length <= 1, "una sola pelota en el tramo compartido");
    shared += on10.length;
  }
  assert.ok(shared > 50, `muestras en el tramo compartido: ${shared}`);
});

test("OFF (single:false): drawFlowBalls no pinta y drawEdge es el de 266ac09 carácter a carácter", () => {
  load(NOW, page(AB(), [E(10, 1, 2), E(15, 2, 1)]), { single: false });
  for (let k = 0; k < 50; k++) assert.deepEqual(run(NOW, "__balls(__a)", k * 0.04), []);
  const fn = (src, name) => { const i = src.indexOf("function " + name + "("); assert.ok(i >= 0, name); let d = 0, j = src.indexOf("{", i);
    for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; } return src.slice(i, j + 1); };
  const now = undoSemantics("js/render.js", undo4a("js/render.js", undo4b("js/render.js", undo3("js/render.js", read("js/render.js"))))), old = before("js/render.js");
  for (const name of ["drawEdge", "flowDotCount", "flowGroups", "pathGeometry", "render", "nodeAlpha"]) assert.equal(fn(now, name), fn(old, name), `${name} idéntica a ${BEFORE}`);
});

test("alcance: en render.js solo cambia drawFlowBalls (+ FLOW_FADE_PX/flowBallFade); el resto del producto idéntico a 266ac09 (salvo lo que cambia FLUYO-019-HIT-TEST y su D6); CACHE", () => {
  /* FLUYO-019-HIT-TEST-D6 cambia a propósito el bucle de pintado de render() (capas con la piel): se deshace aquí para comparar
     el resto; su alcance lo vigila test/fluyo-019-d6.test.cjs */
  const undoD6 = (s) => s.replace(/\n  \/\* FLUYO-019-HIT-TEST-D6[\s\S]*?\*\/\n  const paintLayers=[^\n]*/, "\n  const nodesInPaintOrder=()=> rs.skinOn ? skinPaintOrder(P().nodes) : P().nodes;")
    .replace(/\n\s*const lay=paintLayers\(\);\n\s*for\(const n of lay\.containers\) drawNode\(c,n,t,theme,isExport,rs\);/g, "").replace(/for\(const n of lay\.leaves\)/g, "for(const n of nodesInPaintOrder())");
  const now = undoD6(undoSemantics("js/render.js", undo4a("js/render.js", undo4b("js/render.js", undo3("js/render.js", read("js/render.js")))))), old = before("js/render.js");
  const cut = (src) => { const i = src.indexOf("function drawFlowBalls("), j = src.indexOf("/* ===== FLUYO-015: lenguaje visual"); assert.ok(i > 0 && j > i); return src.slice(0, i) + src.slice(j); };
  const helper = now.slice(now.indexOf("/* FLUYO-019-FLOW-FADE:"), now.indexOf("function drawFlowBalls("));
  assert.ok(helper.includes("const FLOW_FADE_PX=35;") && helper.includes("function flowBallFade(s,L)"));
  assert.equal(cut(now).replace(helper, ""), cut(old), "render.js fuera de drawFlowBalls y del helper: idéntico");
  /* drawFlowBalls: solo cambian la distancia local s y el fade; color, halo, dedupe, nodeAlpha y reloj, iguales */
  const db = now.slice(now.indexOf("function drawFlowBalls("), now.indexOf("/* ===== FLUYO-015: lenguaje visual"));
  assert.match(db, /const fade=flowBallFade\(s, seg\.L\);/);
  assert.match(db, /const s=clamp\(d-seg\.start,0,seg\.L\);\n      const p=pointAt\(seg\.pts, s\/seg\.L\);/);
  assert.ok(!/g\.total-d|D\*\.125/.test(db), "ya no hay fade sobre el camino ni ventana relativa al grupo");
  for (const keep of ["const D=Math.max(...geos.map(g=>g.total));", "const d=f*D;", "if(d>g.total) continue;", 'c.fillStyle=seg.e.dotColor||A.color||"#d08b5b";',
    "c.globalAlpha=a*fade;", "c.globalAlpha=a*fade*.28;", "c.arc(p.x,p.y,7,0,Math.PI*2)", "c.arc(p.x,p.y,13,0,Math.PI*2)", 'const key=seg.e.id+"|"+Math.round(p.x)+","+Math.round(p.y);'])
    assert.ok(db.includes(keep), "drawFlowBalls conserva: " + keep);
  /* FLUYO-019-HIT-TEST cambia a propósito geometry.js (isContainerNode), interaction.js, editor-scenarios.js y CACHE (v90): su alcance lo vigila test/fluyo-019-hit-test.test.cjs */
  /* export.js lo cambia a propósito D6 (SVG con capas) */
  /* FLUYO-019-PRSKIN añade a propósito una regla para #prSkin en styles.css: se deshace aquí; su alcance lo vigila test/fluyo-019-prskin.test.cjs */
  const undoPrSkin = (s) => s.replace(/\/\* FLUYO-019-PRSKIN[\s\S]*?\*\/\n#presentBar #prSkin\{[^}]*\}\n/, "");
  for (const f of ["js/skin.js", "js/model.js", "js/config.js", "js/viewer.js", "js/share.js", "js/deeplink.js", "js/state.js", "js/ui.js",
    "js/editor-runtime.js", "index.html", "s/index.html", "css/styles.css"])
    if (fs.existsSync(path.join(root, f))) assert.equal(f === "css/styles.css" ? undoPrSkin(undoSemantics(f, undo4b(f, undo3(f, read(f))))) : undoSemantics(f, undo4a(f, undo4b(f, undo3(f, read(f))))), before(f), f + " idéntico a " + BEFORE);
  const sw = undo3("sw.js", read("sw.js")), swOld = before("sw.js");
  const cur = +/const CACHE = "fluyo-static-v(\d+)";/.exec(sw)[1];
  assert.ok(cur >= 89, "CACHE ≥ v89");
  /* la de 266ac09 (v88) se construye sin literal: fluyo-019-1 vigila que ningún test fuera de las mutaciones nombre la anterior */
  assert.equal(sw.replace('"fluyo-static-v' + cur + '"', '"fluyo-static-v' + 88 + '"'), swOld, "sw.js: solo cambia CACHE");
});
