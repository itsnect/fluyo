"use strict";
/* FLUYO-018.25 — La ruta que se dobla sola. Contratos en vm (sin navegador), comparando el geometry.js del árbol con el de HEAD
   (git show), y estáticos. Lo que solo existe con puntero (barras, clic inerte, Undo) lo mide test/fluyo-018-25-browser.cjs.
   · Carriles por CANAL (P1): comparten carril solo las aristas del mismo par por los mismos lados; dentro del canal la primera
     (id menor) se queda en el carril 0 y las demás se apartan hacia fuera. La directa entre caras que se miran sigue centrada y
     añadir/quitar una hermana NO mueve las que ya estaban. En una U, el carril k va k·SEP más afuera con las anclas apartándose
     del otro extremo (U anidadas, sin cruces).
   · La U (R1): el canal de una ruta en U (n/n, s/s, e/e, w/w) va por el pasillo más exterior, nunca por dentro: sin el muñón
     exterior de la captura.
   · Caras muy cercanas (P2): si los pasillos de 28 px no caben (hueco < 56) miden la mitad del hueco y el canal de un carril se
     queda entre los dos pasillos: la ruta es monótona en su eje, sin ida y vuelta (los puntos de flujo ya no retroceden).
   · Puntos de flujo (opción A, render.js): n efectivo = clamp(floor(L/24), 1, n); con sitio, el de siempre.
   · Puntas: perpendiculares, a EDGE_GAP, sobre tramo recto, sin retroceso pegado.
   · D9: una recta ortogonal ofrece UNA barra (handleRoute); en una Z, las de siempre. routeIsStraight.
   · Alcance: kernel/model.js/config.js/formato sin cambios, edgeStroke idéntico, solo los archivos del contrato; CACHE v83. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const head = (f) => execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));
const slice = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); return s.slice(i, j < 0 ? s.length : j); };

/* Dos geometrías: la del árbol y la de HEAD, cada una en su contexto con su config/model. El árbol carga también render.js
   (flowDotCount); no inicia nada al cargar. */
function geometry(src, files) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL });
  for (const f of files) vm.runInContext(src(f), ctx, { filename: f });
  return ctx;
}
const NOW = geometry((f) => read("js/" + f), ["config.js", "safe-svg.js", "model.js", "geometry.js", "render.js"]);
const OLD = geometry((f) => head("js/" + f), ["config.js", "safe-svg.js", "model.js", "geometry.js"]);
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const routes = (G, page) => run(G, "doc.pages=[__a]; doc.cur=0; P().edges.map(e=>edgePoints(e))", page);

const rect = (id, x, y, w = 180, h = 70) => ({ id, shape: "rect", x, y, w, h, label: "" });
const edge = (id, from, to, o = {}) => ({ id, from, to, route: "ortho", fromSide: null, toSide: null, waypoints: [], ...o });
const pg = (nodes, edges) => ({ name: "P", nodes, edges, nextId: 99, behaviors: [], scenarios: [], nextScenarioId: 1 });
const fmt = (p) => p.map((q) => Math.round(q.x) + "," + Math.round(q.y)).join(" ");

function reversals(p) {
  let n = 0, px = 0;
  for (let i = 2; i < p.length; i++) {
    const a = p[i - 2], m = p[i - 1], c = p[i];
    const d1 = { x: m.x - a.x, y: m.y - a.y }, d2 = { x: c.x - m.x, y: c.y - m.y };
    if (d1.x * d2.x + d1.y * d2.y < -1 && Math.abs(d1.x * d2.y - d1.y * d2.x) < 1) { n++; px += Math.min(Math.hypot(d1.x, d1.y), Math.hypot(d2.x, d2.y)); }
  }
  return { n, px };
}
const diagonals = (p) => p.slice(1).filter((q, i) => Math.abs(q.x - p[i].x) > 1.5 && Math.abs(q.y - p[i].y) > 1.5).length;
function sharedTrace(p, q) {
  let L = 0;
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) {
    const a = p[i - 1], b = p[i], c = q[j - 1], d = q[j];
    const hp = Math.abs(a.y - b.y) < 0.5, hq = Math.abs(c.y - d.y) < 0.5, vp = Math.abs(a.x - b.x) < 0.5, vq = Math.abs(c.x - d.x) < 0.5;
    if (hp && hq && Math.abs(a.y - c.y) < 0.5) L += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)));
    else if (vp && vq && Math.abs(a.x - c.x) < 0.5) L += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)));
  }
  return L;
}
function crossings(p, q) {
  const o = (P, Q, R) => Math.sign((Q.x - P.x) * (R.y - P.y) - (Q.y - P.y) * (R.x - P.x));
  let n = 0;
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) {
    const a = p[i - 1], b = p[i], c = q[j - 1], d = q[j];
    if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) n++;
  }
  return n;
}
const penetration = (G, p, A, B) => run(G, "pathInBoxes(__a.p,[obstBox(__a.A),obstBox(__a.B)])", { p, A, B });

/* ── El barrido: A fijo, B en 10 posiciones, 25 combinaciones de lado, tres modos ── */
const S5 = [null, "n", "e", "s", "w"];
const POS = [[800, 500], [800, 300], [400, 200], [0, 300], [0, 500], [0, 700], [400, 800], [800, 700], [800, 507], [807, 300]];
const MODES = ["sola", "parMismoSentido", "parOpuesto"];
const CASES = [];
for (const mode of MODES) for (const [bx, by] of POS) for (const fs of S5) for (const ts of S5) {
  const A = rect(1, 400, 500), B = rect(2, bx, by);
  const es = [edge(3, 1, 2, { fromSide: fs, toSide: ts })];
  if (mode === "parMismoSentido") es.push(edge(4, 1, 2, { fromSide: fs, toSide: ts }));
  if (mode === "parOpuesto") es.push(edge(4, 2, 1, { fromSide: ts, toSide: fs }));
  CASES.push({ key: `${mode} B(${bx},${by}) ${fs}/${ts}`, mode, A, B, page: pg([A, B], es), solo: pg([A, B], [es[0]]) });
}
const SWEEP = CASES.map((c) => ({ ...c, now: routes(NOW, c.page), old: routes(OLD, c.page), nowSolo: routes(NOW, c.solo)[0] }));

/* La captura del owner: Nodo(300,300) → Nodo(700,300) recta (puerto derecho, destino flotante) y la vuelta de arriba a arriba. */
const N2 = () => [rect(1, 300, 300), rect(2, 700, 300)];
const CAPTURE = pg(N2(), [edge(3, 1, 2, { fromSide: "e" }), edge(4, 2, 1, { fromSide: "n", toSide: "n" })]);
const DIRECTA = "390,300 418,300 500,300 582,300 610,300";

test("P1 · la captura: la directa sigue centrada (como sola) y la vuelta es una U limpia por el pasillo exterior", () => {
  const sola = routes(NOW, pg(N2(), [edge(3, 1, 2, { fromSide: "e" })]))[0];
  const now = routes(NOW, CAPTURE), old = routes(OLD, CAPTURE);
  assert.equal(fmt(old[0]), "390,286 418,286 486,286 582,286 610,286", "referencia: en HEAD la directa se apartaba 14 px");
  assert.equal(reversals(old[1]).n, 2, "referencia: en HEAD la vuelta tenía los 2 muñones");
  assert.equal(fmt(sola), DIRECTA, "sola, centrada");
  assert.deepEqual(now[0], sola, "con la U al lado, la directa no se mueve ni una centésima");
  assert.equal(fmt(now[1]), "700,265 700,237 300,237 300,265", "la vuelta: U limpia por el pasillo exterior");
  assert.equal(reversals(now[1]).n + diagonals(now[1]) + sharedTrace(now[0], now[1]) + crossings(now[0], now[1]), 0);
  const [A, B] = CAPTURE.nodes;
  for (const p of now) assert.ok(penetration(NOW, p, A, B) < 4, "ninguna ruta entra en sus nodos");
});

/* [nombre, aristas [id, desde, hasta, fromSide, toSide], orden del documento (ids)] */
const VARIANTS = [
  ["U primero (id menor), directa después", [[3, 2, 1, "n", "n"], [4, 1, 2, "e", null]]],
  ["por abajo (B→A s/s)", [[3, 1, 2, "e", null], [4, 2, 1, "s", "s"]]],
  ["dos directas en el mismo sentido", [[3, 1, 2, "e", null], [4, 1, 2, "e", null]]],
  ["dos directas opuestas (auto)", [[3, 1, 2, null, null], [4, 2, 1, null, null]]],
  ["tres directas", [[3, 1, 2, "e", null], [4, 1, 2, "e", null], [5, 1, 2, "e", null]]],
  ["recta `straight` + U n/n", [[3, 1, 2, null, null, "straight"], [4, 2, 1, "n", "n"]]],
  ["dos U n/n", [[3, 1, 2, "n", "n"], [4, 1, 2, "n", "n"]]],
  ["orden del documento distinto del id", [[9, 1, 2, "e", null], [4, 1, 2, "e", null]]],
];
test("P1 · variantes: la primera de cada canal (id menor) no se mueve al añadir hermanas; las demás van fuera, sin cruces ni trazo compartido", () => {
  const SEP = run(NOW, "PARALLEL_SEP");
  for (const [name, list] of VARIANTS) {
    const es = list.map(([id, f, t, fs, ts, route]) => edge(id, f, t, { fromSide: fs, toSide: ts, route: route || "ortho" }));
    const all = routes(NOW, pg(N2(), es));
    const minId = Math.min(...es.map((e) => e.id));
    es.forEach((e, i) => {
      const alone = routes(NOW, pg(N2(), [e]))[0];
      /* la primera de su canal (o la única de su canal) va igual que sola */
      const canal = es.filter((o) => run(NOW, "doc.pages=[__a.p]; doc.cur=0; trackKey(edgeById(__a.a))===trackKey(edgeById(__a.b))", { p: pg(N2(), es), a: o.id, b: e.id }));
      if (Math.min(...canal.map((o) => o.id)) === e.id) assert.deepEqual(all[i], alone, `${name}: e${e.id} (primera de su canal) se movió al añadir hermanas`);
      assert.equal(reversals(all[i]).n + diagonals(all[i]), 0, `${name} e${e.id}: ${fmt(all[i])}`);
      for (const p of [all[i]]) assert.ok(penetration(NOW, p, N2()[0], N2()[1]) < 4, name);
    });
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      assert.equal(sharedTrace(all[i], all[j]), 0, `${name}: e${es[i].id} y e${es[j].id} comparten trazo`);
      assert.equal(crossings(all[i], all[j]), 0, `${name}: e${es[i].id} y e${es[j].id} se cruzan`);
    }
    void minId; void SEP;
  }
  /* un nodo ajeno justo en el carril preferido (+): la hermana va al otro lado (sin atravesarlo) y la directa no se mueve */
  {
    const C = { id: 5, shape: "rect", x: 500, y: 328, w: 60, h: 20, label: "" };
    const page = pg([...N2(), C], [edge(3, 1, 2, { fromSide: "e" }), edge(4, 1, 2, { fromSide: "e" })]);
    const [d, h] = routes(NOW, page), sola = routes(NOW, pg([...N2(), C], [edge(3, 1, 2, { fromSide: "e" })]))[0];
    assert.deepEqual(d, sola, "nodo ajeno: la directa no se mueve");
    const pen = run(NOW, "pathInBoxes(__a.p,[obstBox(__a.C)])", { p: h, C });
    assert.ok(pen < 4, "nodo ajeno: la hermana no lo atraviesa (" + fmt(h) + ")");
    assert.ok(h[0].y < 300, "nodo ajeno: la hermana se abre al otro lado (" + fmt(h) + ")");
  }
  /* las tres directas: centro, +SEP, −SEP (la tercera al otro lado) */
  const three = routes(NOW, pg(N2(), [3, 4, 5].map((id) => edge(id, 1, 2, { fromSide: "e" }))));
  assert.deepEqual(three.map((p) => p[0].y), [300, 325, 275].map((y) => y), "300 / +25 (clamp al lado) / −25");
});

/* Estabilidad cuando cabe, recolocación mínima cuando no (regla del owner, 14-10-2026). Medido: 490 de 500 pares estables;
   los 10 recolocados son pares con los dos extremos flotantes y el otro nodo en diagonal, donde el hueco común de los dos
   lados mide 18–20 px: la hermana no cabe a LANE_MIN de la primera sin moverla. Ahí la primera se mueve lo justo para
   dejarla a LANE_MIN (4–5 px), ni más ni menos. */
test("P1 · barrido: 490/500 pares estables (HEAD: 0); en los 10 restantes la existente se mueve lo MÍNIMO para dejar la hermana a LANE_MIN", () => {
  const MIN = run(NOW, "LANE_MIN");
  let movidasHead = 0, estables = 0, recolocadas = 0, maxMov = 0;
  for (const c of SWEEP) {
    c.now.forEach((p, i) => {
      const k = c.key + " e" + (3 + i);
      assert.equal(reversals(p).n, 0, k + " muñón: " + fmt(p));
      assert.equal(diagonals(p), 0, k + " diagonal: " + fmt(p));
      assert.ok(penetration(NOW, p, c.A, c.B) < 4, k + " entra en su nodo: " + fmt(p));
    });
    if (c.mode === "sola") continue;
    if (JSON.stringify(routes(OLD, c.solo)[0]) !== JSON.stringify(c.old[0])) movidasHead++;
    assert.notEqual(fmt(c.now[0].slice(1, -1)), fmt(c.now[1].slice(1, -1)), c.key + ": hermanas encimadas");
    if (JSON.stringify(c.now[0]) === JSON.stringify(c.nowSolo)) { estables++; continue; }
    /* recolocada: (1) ninguna variante estable cabía; (2) la primera se mueve exactamente lo que faltaba */
    recolocadas++;
    const [lo, hi] = run(NOW, "doc.pages=[__a]; doc.cur=0; (()=>{ const e=P().edges[0], b=baseAnchors(e), r1=laneRange(nodeById(e.from),b.s1,b.p1), r2=laneRange(nodeById(e.to),b.s2,b.p2); return [Math.max(r1[0],r2[0]), Math.min(r1[1],r2[1])]; })()", c.page);
    assert.ok(hi < MIN && -lo < MIN, `${c.key}: había sitio estable (${lo}..${hi})`);
    const mov = Math.max(Math.abs(c.now[0][0].x - c.nowSolo[0].x) + Math.abs(c.now[0][0].y - c.nowSolo[0].y), Math.abs(c.now[0].at(-1).x - c.nowSolo.at(-1).x) + Math.abs(c.now[0].at(-1).y - c.nowSolo.at(-1).y));
    const necesario = MIN - Math.max(hi, -lo);
    assert.ok(Math.abs(mov - necesario) < 1e-6, `${c.key}: la existente se mueve ${mov} px y bastaban ${necesario}`);
    maxMov = Math.max(maxMov, mov);
  }
  assert.equal(movidasHead, 500, "referencia: en HEAD la hermana movía la primera en los 500 pares");
  assert.deepEqual([estables, recolocadas], [490, 10]);
  assert.ok(maxMov <= MIN, "desplazamiento máximo " + maxMov);
});

/* Medido al implementar: los cruces no empeoran en ningún caso; el trazo compartido baja en total (126 732 → 107 583 px) y en
   163 pares, y en 118 crece entre 3 y 28 px. Esos 118 son TODOS pares que el guardián ya juntaba en un canal en HEAD (70–760 px
   compartidos: la familia «dos flechas que van juntas» de visual-regression.test.ts): con carriles 0/+SEP en vez de ±SEP/2 el
   solape se corre hasta un carril. Ningún par que iba separado pasa a compartir. */
test("P1 · hermanas en el barrido: ningún par separado pasa a compartir; donde ya compartía, ≤ +SEP; total menor; cruces nunca peor", () => {
  const SEP = run(NOW, "PARALLEL_SEP");
  let cr = 0, crOld = 0, sh = 0, shOld = 0;
  for (const c of SWEEP.filter((c) => c.mode !== "sola")) {
    const a = sharedTrace(c.now[0], c.now[1]), b = sharedTrace(c.old[0], c.old[1]);
    if (b < 0.5) assert.ok(a < 0.5, `${c.key}: iba separado y ahora comparte ${Math.round(a)} px`);
    else assert.ok(a <= b + SEP + 0.5, `${c.key}: ${Math.round(a)} px compartidos (HEAD ${Math.round(b)})`);
    const x = crossings(c.now[0], c.now[1]), xOld = crossings(c.old[0], c.old[1]);
    assert.ok(x <= xOld, `${c.key}: ${x} cruces (HEAD ${xOld})`);
    cr += x; crOld += xOld; sh += a; shOld += b;
  }
  assert.ok(cr < crOld, `cruces ${cr} (HEAD ${crOld})`);
  assert.ok(sh < shOld, `trazo compartido ${Math.round(sh)} px (HEAD ${Math.round(shOld)})`);
});

test("R1 · una arista sola solo cambia si tenía muñón (las 2 U de pasillos desiguales); el resto, idéntica a HEAD", () => {
  let changed = 0, old = 0;
  for (const c of SWEEP.filter((c) => c.mode === "sola")) {
    if (reversals(c.old[0]).n) old++;
    if (JSON.stringify(c.now[0]) === JSON.stringify(c.old[0])) continue;
    changed++;
    assert.ok(reversals(c.old[0]).n > 0, c.key + " cambia sin muñón:\n  HEAD " + fmt(c.old[0]) + "\n  hoy  " + fmt(c.now[0]));
  }
  assert.equal(old, 2); assert.equal(changed, 2);
  let stubs = 0; for (const c of SWEEP) c.old.forEach((p) => { if (reversals(p).n) stubs++; });
  assert.equal(stubs, 22, "referencia: 22 aristas con muñón en HEAD (0 hoy, test anterior)");
});

/* ── P2: caras muy cercanas ── */
const GAPS = [120, 72, 60, 56, 39, 20, 5];
function shortCases() {
  const out = [];
  for (const orient of ["horizontal", "vertical"]) for (const gap of GAPS) for (const mode of ["sola", "par", "parOpuesto", "z"]) {
    const B = orient === "horizontal" ? rect(2, 300 + 180 + gap, mode === "z" ? 340 : 300) : rect(2, mode === "z" ? 340 : 300, 300 + 70 + gap);
    const fs = orient === "horizontal" ? "e" : "s", ts = orient === "horizontal" ? "w" : "n";
    const es = [edge(3, 1, 2, { fromSide: fs, toSide: mode === "z" ? ts : null })];
    if (mode === "par") es.push(edge(4, 1, 2, { fromSide: fs }));
    if (mode === "parOpuesto") es.push(edge(4, 2, 1, { toSide: fs }));
    out.push({ key: `${orient} hueco ${gap} ${mode}`, gap, mode, A: rect(1, 300, 300), B, page: pg([rect(1, 300, 300), B], es) });
  }
  return out;
}
const SHORT = shortCases().map((c) => ({ ...c, now: routes(NOW, c.page), old: routes(OLD, c.page) }));
test("P2 · caras muy cercanas (5–120 px, horizontal y vertical, sola, par, opuesto y Z): 0 retrocesos, 0 diagonales; con hueco ≥ 56, idéntica a HEAD", () => {
  let oldRev = 0;
  for (const c of SHORT) c.now.forEach((p, i) => {
    const k = c.key + " e" + (3 + i);
    assert.equal(reversals(p).n, 0, k + " retrocede: " + fmt(p));
    assert.equal(diagonals(p), 0, k + ": " + fmt(p));
    if (reversals(c.old[i]).n) oldRev++;
    if (c.mode === "sola" && c.gap >= 56) assert.deepEqual(p, c.old[i], k + ": con sitio, la de siempre");
  });
  assert.ok(oldRev >= 20, "referencia: en HEAD retrocedían " + oldRev);
  /* el caso del vídeo: 39 px de hueco → recta de verdad */
  const v = SHORT.find((c) => c.key === "horizontal hueco 39 sola");
  assert.equal(fmt(v.old[0]), "390,300 418,300 410,300 401,300 429,300", "referencia: la ida y vuelta del vídeo");
  assert.equal(fmt(v.now[0]), "390,300 410,300 429,300");
});

/* ── Puntos de flujo (opción A) ── */
const FLOW = read("js/render.js");
test("puntos · el lienzo usa flowDotCount(edgeDots(e), polyLen(pts)) con la fórmula de siempre; tabla de n efectivo", () => {
  assert.match(FLOW, /const n=flowDotCount\(edgeDots\(e\), polyLen\(pts\)\);/);
  assert.match(FLOW, /let base=\(t\*sp \+ i\/n\)%1;/, "la fórmula de posición no cambia (flowDir y velocidad igual)");
  const cnt = (n, L) => run(NOW, "flowDotCount(__a[0],__a[1])", [n, L]);
  assert.equal(run(NOW, "FLOW_DOT_SEP"), 24);
  const table = [[3, 300, 3], [3, 120, 3], [3, 72, 3], [3, 60, 2], [3, 39, 1], [3, 20, 1], [3, 5, 1], [3, 0, 1], [6, 144, 6], [6, 100, 4], [1, 500, 1]];
  for (const [n, L, want] of table) assert.equal(cnt(n, L), want, `n=${n}, L=${L}`);
});

/* La misma cuenta que el bucle de render.js, en 4 s a 60 fps: ningún punto visible se mueve hacia atrás, y entre dos
   puntos visibles hay siempre ≥ FLOW_DOT_SEP de ruta. */
function simulate(pts, n, flowDir) {
  const cnt = run(NOW, "flowDotCount(__a[0],__a[1])", [n, run(NOW, "polyLen(__a)", pts)]);
  const L = run(NOW, "polyLen(__a)", pts), a0 = pts[0], a1 = pts[pts.length - 1];
  const len = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1, ax = { x: (a1.x - a0.x) / len, y: (a1.y - a0.y) / len };
  let back = 0, minSep = Infinity; const prev = [];
  for (let k = 0; k < 240; k++) {
    const t = k / 60, sp = 0.5, vis = [];
    for (let i = 0; i < cnt; i++) {
      const base = ((t * sp + i / cnt) % 1 + 1) % 1, f = flowDir === "reverse" ? 1 - base : base;
      const alpha = Math.min(1, Math.min(f, 1 - f) * 8), s = f * L;
      /* posición sobre la ruta (proyectada en la dirección origen→destino) */
      let acc = 0, p = pts[0];
      for (let j = 1; j < pts.length; j++) { const l = Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y); if (acc + l >= s) { const u = l ? (s - acc) / l : 0; p = { x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * u, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * u }; break; } acc += l; p = pts[j]; }
      const x = (p.x - a0.x) * ax.x + (p.y - a0.y) * ax.y;
      if (alpha > 0.25) vis.push(s);
      if (prev[i] && alpha > 0.25 && prev[i].alpha > 0.25 && Math.abs(f - prev[i].f) < 0.5 && (x - prev[i].x) * (flowDir === "reverse" ? -1 : 1) < -0.05) back++;
      prev[i] = { x, f, alpha };
    }
    vis.sort((a, b) => a - b); for (let j = 1; j < vis.length; j++) minSep = Math.min(minSep, vis[j] - vis[j - 1]);
  }
  return { cnt, back, minSep };
}
test("puntos · conexiones cortas y normales, normal e inverso: 0 retrocesos visibles; ≥ 24 px entre puntos; con sitio, los mismos puntos", () => {
  let checked = 0;
  for (const c of SHORT.filter((c) => c.mode === "sola" || c.mode === "z")) for (const flowDir of ["normal", "reverse"]) for (const n of [3, 6]) {
    const r = simulate(c.now[0], n, flowDir), L = run(NOW, "polyLen(__a)", c.now[0]);
    assert.equal(r.back, 0, `${c.key} ${flowDir} n=${n}: ${r.back} retrocesos`);
    if (r.cnt > 1) assert.ok(r.minSep >= 24 - 1e-6, `${c.key} n=${n}: puntos a ${r.minSep.toFixed(1)} px`);
    if (L >= 24 * n) assert.equal(r.cnt, n, `${c.key}: con sitio (${L.toFixed(0)} px) no cambia el número`);
    checked++;
  }
  /* referencia: con la ruta de HEAD (ida y vuelta) y 3 puntos, el caso del vídeo retrocedía */
  const v = SHORT.find((c) => c.key === "horizontal hueco 39 sola");
  let back = 0; { const s = simulate(v.old[0], 3, "normal"); back = s.back; }
  assert.ok(back > 0, "referencia: en HEAD los puntos del vídeo retrocedían");
  assert.equal(checked, 112);
});

/* ── Corpus y fixtures ── */
const edgesOf = (G, data) => run(G, "(()=>{ const r=projectFromProjectData(__a); doc=r.doc; const out=[]; for(let i=0;i<doc.pages.length;i++){ doc.cur=i; for(const e of P().edges) out.push([i,e.id,edgePoints(e)]); } return out; })()", data);
test("corpus publicado (ejemplos/data): 0 de 61 aristas cambian, byte a byte", () => {
  const dir = path.join(root, "ejemplos", "data");
  let total = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const now = edgesOf(NOW, data), old = edgesOf(OLD, data);
    now.forEach((r, k) => assert.deepEqual(r, old[k], `${f} página ${r[0]} e${r[1]} cambia`));
    total += now.length;
  }
  assert.equal(total, 61);
});

test("fixture compartido de 018.16: solo cambia la arista 10, que en HEAD retrocedía 17,5 px y ya no", () => {
  const data = JSON.parse(read("test/fixtures/fluyo-018-16-conexiones.json"));
  const now = edgesOf(NOW, data), old = edgesOf(OLD, data);
  assert.deepEqual(now.filter((r, k) => JSON.stringify(r) !== JSON.stringify(old[k])).map((r) => r[1]), [10]);
  assert.deepEqual(reversals(old.find((r) => r[1] === 10)[2]), { n: 1, px: 17.5 });
  assert.equal(reversals(now.find((r) => r[1] === 10)[2]).n, 0);
});

/* ingesta-v2 y rag-chatbot (fixtures de regresión visual del MCP, si está al lado): cambian SOLO sus pares bidireccionales; la
   primera de cada par vuelve al carril 0 (centro) y la segunda se aparta hacia fuera. */
const RV = path.join(root, "..", "fluyo-mcp", "test", "fixtures", "regresion-visual");
test("fixtures del MCP ingesta-v2 y rag-chatbot: solo cambian sus pares (e11/e12, e6/e7), sin muñones ni diagonales", { skip: fs.existsSync(RV) ? false : "sin fluyo-mcp al lado" }, () => {
  const want = { "ingesta-v2.fluyo.json": [11, 12], "rag-chatbot.fluyo.json": [6, 7], "bloque-codigo.fluyo.json": [] };
  for (const [f, ids] of Object.entries(want)) {
    const data = JSON.parse(fs.readFileSync(path.join(RV, f), "utf8"));
    const now = edgesOf(NOW, data), old = edgesOf(OLD, data);
    assert.deepEqual(now.filter((r, k) => JSON.stringify(r) !== JSON.stringify(old[k])).map((r) => r[1]), ids, f);
    for (const r of now) assert.equal(reversals(r[2]).n + diagonals(r[2]), 0, `${f} e${r[1]}`);
    /* ninguna de las que cambian atraviesa NINGÚN nodo de la página (en rag-chatbot, abrir la hermana hacia el lado libre
       la metía por «Usuario»: la evaluación de defectos de laneLayout lo descarta) */
    const pen = run(NOW, "(()=>{ const r=projectFromProjectData(__a.d); doc=r.doc; doc.cur=0; const cajas=P().nodes.map(obstBox); return __a.ids.map(id=>pathInBoxes(edgePoints(edgeById(id)),cajas)); })()", { d: data, ids });
    pen.forEach((v, i) => assert.ok(v < 4, `${f} e${ids[i]} atraviesa un nodo (${v.toFixed(1)} px)`));
    if (ids.length) {
      const [a, b] = ids.map((id) => now.find((r) => r[1] === id)[2]);
      assert.equal(sharedTrace(a, b), 0, f + ": el par no comparte trazo");
    }
  }
});

/* ── Puntas ── */
const heads = (G, page) => run(G, "doc.pages=[__a]; doc.cur=0; P().edges.map(e=>{ const p=edgePoints(e), st=edgeStroke(e,p), n=p.length, z=p[n-1], h=st.heads[0]; " +
  "const side=e.toSide||inferSide(nodeById(e.to),z), u=strokeDir(p,false), L=st.line, end=L[L.length-1], prev=L[L.length-2]; " +
  "return { tipGap:Math.hypot(h[0].x-z.x,h[0].y-z.y), u:{x:u.x,y:u.y}, inward:{x:-DIR[side].x,y:-DIR[side].y}, recto:Math.hypot(end.x-prev.x,end.y-prev.y), cola:p.slice(-3), heads:st.heads.length }; })", page);
test("puntas · en todo el barrido y en la captura: perpendicular al borde, a EDGE_GAP del ancla, sobre tramo recto y sin retroceso pegado", () => {
  const GAP = run(NOW, "EDGE_GAP");
  let n = 0;
  for (const c of [...CASES, { key: "captura", page: CAPTURE }]) heads(NOW, c.page).forEach((h, i) => {
    const k = c.key + " e" + (3 + i);
    assert.equal(h.heads, 1, k);
    assert.ok(Math.abs(h.u.x - h.inward.x) < 1e-9 && Math.abs(h.u.y - h.inward.y) < 1e-9, k + ": no entra perpendicular " + JSON.stringify(h));
    assert.ok(Math.abs(h.tipGap - GAP) < 1e-6, k + ": la punta está a " + h.tipGap + " del ancla");
    assert.ok(h.recto >= 8.8 - 0.01, k + ": solo " + h.recto.toFixed(1) + " px rectos antes de la punta");
    assert.equal(reversals(h.cola).n, 0, k + ": el trazo vuelve sobre sí mismo junto a la punta " + fmt(h.cola));
    n++;
  });
  /* conexiones cortas: la punta sigue perpendicular y pegada al borde aunque no quepa tramo recto */
  for (const c of SHORT) heads(NOW, c.page).forEach((h, i) => {
    assert.ok(Math.abs(h.u.x - h.inward.x) < 1e-9 && Math.abs(h.u.y - h.inward.y) < 1e-9 && Math.abs(h.tipGap - GAP) < 1e-6, c.key + " e" + (3 + i));
    n++;
  });
  assert.equal(n, 1252 + 84);
});

/* ── D9: barras de tramo ── */
const handlePts = (G, page, id) => run(G, "doc.pages=[__a.page]; doc.cur=0; (()=>{ const e=edgeById(__a.id); return typeof edgeHandlePts==='function'? edgeHandlePts(e) : edgePoints(e); })()", { page, id });
const bars = (G, page, id) => run(G, "doc.pages=[__a.page]; doc.cur=0; (()=>{ const e=edgeById(__a.id); const p=typeof edgeHandlePts==='function'? edgeHandlePts(e) : edgePoints(e); return bendableSegs(e,p); })()", { page, id });

test("D9 · una conexión ortogonal recta ofrece UNA barra, centrada (HEAD: 2, sobre vértices sin giro)", () => {
  const cases = [
    ["horizontal, lados fijos", pg([rect(1, 200, 200), rect(2, 600, 200)], [edge(3, 1, 2, { fromSide: "e", toSide: "w" })])],
    ["horizontal, flotante", pg([rect(1, 200, 200), rect(2, 600, 200)], [edge(3, 1, 2)])],
    ["horizontal, desde el puerto (e / auto)", pg([rect(1, 200, 200), rect(2, 600, 200)], [edge(3, 1, 2, { fromSide: "e" })])],
    ["vertical, lados fijos", pg([rect(1, 200, 200), rect(2, 200, 600)], [edge(3, 1, 2, { fromSide: "s", toSide: "n" })])],
  ];
  for (const [name, page] of cases) {
    assert.equal(bars(OLD, page, 3).length, 2, "referencia (" + name + "): HEAD ofrece 2 barras");
    const b = bars(NOW, page, 3), p = handlePts(NOW, page, 3), full = routes(NOW, page)[0];
    assert.equal(b.length, 1, name + ": " + b.length + " barras");
    assert.equal(p.length, 4, name + ": anclas + pasillos, sin el vértice sin giro: " + fmt(p));
    const m = { x: (p[b[0]].x + p[b[0] + 1].x) / 2, y: (p[b[0]].y + p[b[0] + 1].y) / 2 }, c = run(NOW, "pointAt(__a,.5)", full);
    assert.ok(Math.hypot(m.x - c.x, m.y - c.y) < 0.5, name + ": la barra está en el centro de la recta");
  }
});

test("D9 · en una ruta que gira, las barras son las de siempre (handleRoute solo quita vértices sin giro, nunca los pasillos)", () => {
  let checked = 0;
  for (const c of SWEEP.filter((c) => c.mode === "sola")) {
    const o = c.old[0];
    const interiorFlat = o.slice(2, -2).some((q, k) => { const a = o[k + 1], b = o[k + 3]; return Math.abs((q.x - a.x) * (b.y - q.y) - (q.y - a.y) * (b.x - q.x)) < 1e-6; });
    if (interiorFlat || reversals(o).n) continue;
    assert.deepEqual(bars(NOW, c.page, 3), bars(OLD, c.page, 3), c.key);
    assert.deepEqual(handlePts(NOW, c.page, 3), c.now[0], c.key + ": handleRoute no toca una ruta sin vértices sin giro");
    checked++;
  }
  assert.ok(checked > 150, "casos comprobados: " + checked);
});

test("D9 · handleRoute es pura y conservadora: recta `straight` intacta, sin NaN en tramos nulos; routeIsStraight", () => {
  assert.equal(typeof NOW.handleRoute, "function");
  const straight = pg([rect(1, 200, 200), rect(2, 600, 260)], [edge(3, 1, 2, { route: "straight", waypoints: [{ x: 400, y: 200 }, { x: 420, y: 200 }] })]);
  assert.deepEqual(handlePts(NOW, straight, 3), routes(NOW, straight)[0]);
  const pts = [{ x: 0, y: 0 }, { x: 28, y: 0 }, { x: 28, y: 0 }, { x: 50, y: 0 }, { x: 80, y: 0 }, { x: 108, y: 0 }];
  const h = run(NOW, "handleRoute(__a)", pts);
  assert.ok(h.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)));
  assert.deepEqual(h, [pts[0], pts[1], pts[4], pts[5]]);
  assert.deepEqual(run(NOW, "handleRoute(__a)", pts.slice(0, 2)), pts.slice(0, 2));
  assert.equal(run(NOW, "routeIsStraight(__a)", pts), true);
  assert.equal(run(NOW, "routeIsStraight(__a)", [{ x: 0, y: 0 }, { x: 28, y: 0 }, { x: 28, y: -40 }, { x: 80, y: -40 }, { x: 80, y: 0 }, { x: 108, y: 0 }]), false);
  assert.equal(run(NOW, "routeIsStraight(__a)", [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 30, y: 0 }]), false, "una ida y vuelta no es una recta");
});

/* ── Alcance ── */
test("alcance: solo los archivos del contrato; kernel, model.js, config.js y edgeStroke intactos; CACHE v83", () => {
  const changed = execFileSync("git", ["-C", gitRoot, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" })
    .split("\n").filter(Boolean).map((l) => l.slice(3).replace(/\\/g, "/"));
  const allowed = [/^js\/(geometry|interaction|render)\.js$/, /^sw\.js$/, /^\.ai\//, /^test\/fluyo-018-25(\.test|-browser|-mutations)\.cjs$/,
    /^test\/fixtures\/fluyo-018-16-conexiones-svg\.json$/, /^test\/[\w.-]+\.(cjs|html)$/];
  for (const f of changed) assert.ok(allowed.some((r) => r.test(f)), "fuera del contrato: " + f);
  for (const f of changed.filter((f) => /^test\/[\w.-]+\.(cjs|html)$/.test(f) && !/fluyo-018-25/.test(f))) {
    const diff = execFileSync("git", ["-C", gitRoot, "diff", "-U0", "--", f], { encoding: "utf8" }).split("\n").filter((l) => /^[+-](?![+-])/.test(l));
    for (const l of diff) assert.match(l, /fluyo-static-v8[23]/, f + ": " + l);
  }
  for (const f of ["js/model.js", "js/config.js", "js/safe-svg.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js", "js/export.js", "js/viewer.js", "js/ui.js", "js/state.js", "js/selection.js", "index.html"])
    assert.equal(read(f), head(f), f + " no se toca");
  const es = (s) => slice(s, "function edgeStroke(", "\n}\n");
  assert.equal(es(read("js/geometry.js")), es(head("js/geometry.js")), "edgeStroke idéntico");
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v88";/);
});
