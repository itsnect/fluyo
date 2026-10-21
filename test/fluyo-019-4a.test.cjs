"use strict";
/* FLUYO-019.4a — Aterrizaje por silueta con la piel «construido» (decisión 213). Contratos en vm, contra la base 22f82eb.
   · Regla: la punta retrocede por su último tramo hasta salir de la silueta visible del destino (capas cerradas y rellenas
     de skinNode, cada una recortada a su `clip`). Se compara con un ORÁCULO independiente (muestreo fino con punto-en-
     polígono sobre las capas poligonizadas), no con valores copiados de la implementación.
   · Matriz: las 10 formas del dominio (DEFAULT_SIZES) en su tamaño de serie y en otros tamaños × n/e/s/w × ruta con codo,
     recta de dos puntos y diagonal × ancla centrada y desplazada (como las paralelas).
   · Invariantes en la matriz y en el corpus (8 ejemplos + fixtures): mismo número de puntos, origen y vértices intermedios
     intactos, el último solo avanza sobre su propio tramo (hacia atrás), ningún tramo nuevo inclinado, idempotente, pura.
   · Valores: bloque 8 u por n/e (C1), 0 por s/w; cilindro y formas planas 0 en todos los lados; icono por e: la peana (C2).
   · Guardas: llegar desde dentro de la caja de anclaje, t* > L − 1, sin destino.
   · Corpus: 0 inclinaciones; las conexiones que cambian y cuánto.
   · F13: la pelota única sobre la línea pintada; mismo reloj, D, α, número y bucle que 22f82eb; sin piel o sin aterrizaje,
     idéntica bit a bit. Modo puntos: el código de los puntos no cambia; donde no hay aterrizaje, mismos arcos bit a bit.
   · Convexidad de las capas de skinNode (la intersección por intervalo lo supone).
   · Memo (auditoría): equivalencia con y sin caché en matriz y corpus, orden, clave completa, sin contaminación, acotada, sin
     mutación, plano sin memo, F13/reloj/bucle iguales con la caché fría, caliente y desactivada.
   · Alcance frente a 22f82eb: solo skin.js (bloque del aterrizaje), render.js (llamada, pelota), export.js (llamada) y sw.js
     (CACHE v93). Lo que necesita lienzo (píxeles, Present, Viewer, SVG) lo mide test/fluyo-019-4a-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { undo4a, BASE4A } = require("./fluyo-019-4a-undo.cjs");
const { undo4b } = require("./fluyo-019-4b-undo.cjs");   /* FLUYO-019.4b cambia a propósito render.js, interaction.js, geometry.js, editor-runtime.js, state.js e index.html: se deshace aquí (antes que 019.4a y FASE 1); su alcance lo vigila test/fluyo-019-4b.test.cjs */
const { undo3: undo3only } = require("./fluyo-scenarios-semantics-3-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 3 cambia a propósito model.js, document-integrity.js, story-authoring.js, flow-semantics.js, editor-scenarios.js, index.html, styles.css y sw.js (precache): se deshace aquí, antes que todo lo demás; su alcance lo vigila test/fluyo-scenarios-semantics-3.test.cjs */
const { undoReverse } = require("./fluyo-step-reverse-002-undo.cjs");   /* FLUYO-STEP-REVERSE-002 cambia a propósito model.js, scenario-engine.js, story-playback.js, scenario-playback.js, story-authoring.js, document-integrity.js, render.js, editor-scenarios.js y selection.js: se deshace aquí, antes que FASE 3; su alcance lo vigila test/fluyo-step-reverse-002.test.cjs */
const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* FLUYO-STEP-REVERSE-003 añade «Invertir sentido» a editor-scenarios.js: se deshace aquí, antes que 002; su alcance lo vigila test/fluyo-step-reverse-003.test.cjs */
const { undo4: undo4only } = require("./fluyo-scenarios-semantics-4-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima de STEP-REVERSE-003: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-4.test.cjs */
const { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 5 va encima de FASE 4: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-5.test.cjs */
const undo4 = (f, src) => undo4only(f, undo5(f, src));
const undo3 = (f, src) => undo3only(f, undoReverse(f, undoReverseUi(f, undo4(f, src))));
const { undoSemantics } = require("./fluyo-scenarios-semantics-undo.cjs");   /* SCENARIOS-SEMANTICS-001 (FASE 1) cambia a propósito model.js, geometry.js, render.js, ui.js, index.html y styles.css: se deshace aquí; su alcance lo vigila test/fluyo-scenarios-semantics-1.test.cjs */
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE4A + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));

function ctxFrom(get) {
  const ctx = vm.createContext({ doc: { pages: [], cur: 0, theme: "crema", customBg: "" },
    settings: { font: "Georgia, serif", speed: 0.5, single: true, build: false, stagger: 0.25, dots: 3 },
    lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), smooth: (t) => Math.min(1, Math.max(0, t)), console });
  vm.runInContext(get("js/config.js"), ctx);
  vm.runInContext("P=()=>doc.pages[doc.cur]; nodeById=id=>P().nodes.find(n=>n.id===id); edgeById=id=>P().edges.find(e=>e.id===id);", ctx);
  vm.runInContext(get("js/model.js").match(/function hexA\(col,a\)\{[^\n]*\n[^\n]*/)[0], ctx);
  /* SCENARIOS-SEMANTICS-001 FASE 5: las marcas salen también al exportar y leen edgeKind (model.js); la base de 019.4a no lo tiene */
  const kinds = get("js/model.js").match(/const EDGE_KINDS=[\s\S]*?\nfunction edgeKind\(e\)\{[\s\S]*?\n\}/);
  if (kinds) vm.runInContext(kinds[0], ctx);
  vm.runInContext(get("js/geometry.js"), ctx);
  vm.runInContext(get("js/skin.js"), ctx);
  vm.runInContext(get("js/render.js"), ctx);
  vm.runInContext(`function __rec(){ const log=[]; let ga=1; const t={log, measureText:(s)=>({width:String(s).length*7})};
      return new Proxy(t,{ get:(o,k)=> k==="arc" ? ((x,y,r)=>log.push({x,y,r,ga})) : (k in o ? o[k] : (()=>{})),
                           set:(o,k,v)=>{ if(k==="globalAlpha") ga=v; o[k]=v; return true; } }); }`, ctx);
  return ctx;
}
const NOW = ctxFrom(read), OLD = ctxFrom(atBase);
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const L4 = (pts, B) => run(NOW, "skinEdgeLanding(__a.p, __a.B)", { p: pts, B });

/* ───────── oráculo independiente: muestreo de la silueta ───────── */
function polygonize(segs) {
  const P = []; let cur = null, start = null;
  for (const s of segs) {
    if (s.op === "M") { cur = { x: s.x, y: s.y }; start = cur; P.push(cur); }
    else if (s.op === "L") { cur = { x: s.x, y: s.y }; P.push(cur); }
    else if (s.op === "Q") { for (let i = 1; i <= 64; i++) { const u = i / 64, a = (1 - u) ** 2, b = 2 * u * (1 - u), c = u * u; P.push({ x: a * cur.x + b * s.cx + c * s.x, y: a * cur.y + b * s.cy + c * s.y }); } cur = { x: s.x, y: s.y }; }
    else if (s.op === "A") {
      let a0 = s.a0, a1 = s.a1; const TAU = 2 * Math.PI;
      if (s.ccw) { while (a1 > a0) a1 -= TAU; if (a1 === a0) a1 -= TAU; } else { while (a1 < a0) a1 += TAU; if (a1 === a0) a1 += TAU; }
      for (let i = 1; i <= 720; i++) { const a = a0 + (a1 - a0) * i / 720; P.push({ x: s.cx + s.rx * Math.cos(a), y: s.cy + s.ry * Math.sin(a) }); }
      cur = P[P.length - 1];
    }
  }
  return P;
}
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j];
  if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
function oracleT(z, u, B) {
  const sk = run(NOW, 'skinNode(__a, "dark", THEMES.dark.bg)', B);
  if (!sk) return 0;
  const layers = sk.layers.filter((l) => l.fill && l.segs[l.segs.length - 1].op === "Z").map((l) => ({ p: polygonize(l.segs), c: l.clip ? polygonize(l.clip) : null }));
  const inside = (q) => layers.some((l) => inPoly(q, l.p) && (!l.c || inPoly(q, l.c)));
  return exitAlong(inside, z, u);
}
/* salida de la región (unión de capas contiguas) a lo largo de z + t·u: paso de 0,1 y bisección hasta 1e-5 */
function exitAlong(inside, z, u) {
  const at = (t) => inside({ x: z.x + u.x * t, y: z.y + u.y * t });
  if (!at(0.002)) return 0;
  let t = 0.002; while (t < 300 && at(t + 0.1)) t += 0.1;
  let lo = t, hi = t + 0.1; while (hi - lo > 1e-5) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; }
  return lo;
}

/* ───────── matriz sintética ───────── */
const SIZES = run(NOW, "DEFAULT_SIZES");
const SHAPES = Object.keys(SIZES);
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function nodesFor(shape) {
  const [w, h] = SIZES[shape], base = { id: 1, shape, x: 400, y: 300, label: shape, color: "#5b8db5", icon: shape === "icon" ? "kafka" : undefined };
  return [{ ...base, w, h }, { ...base, w: w * 1.6, h: h * 1.3 }, { ...base, w: Math.max(60, w * 0.7), h: Math.max(40, h * 0.8) }];
}
function casesFor(B) {
  const out = [];
  for (const side of ["n", "e", "s", "w"]) {
    const a0 = run(NOW, "sidePoint(__a.B, __a.s)", { B, s: side }), [dx, dy] = DIRS[side];
    for (const off of [0, 12, -12]) {
      const a = { x: a0.x + (dy ? off : 0), y: a0.y + (dx ? off : 0) }, q = { x: a.x + dx * 80, y: a.y + dy * 80 };
      out.push({ k: `${side}-codo${off}`, side, pts: [{ x: q.x + dy * 60, y: q.y + dx * 60 }, q, a] });
      out.push({ k: `${side}-recta${off}`, side, pts: [{ x: a.x + dx * 120, y: a.y + dy * 120 }, a] });
    }
    out.push({ k: `${side}-diag`, side, pts: [{ x: a0.x + dx * 120 + dy * 70, y: a0.y + dy * 120 + dx * 70 }, a0] });
  }
  return out;
}
const MATRIX = [];
for (const shape of SHAPES) for (const B of nodesFor(shape)) for (const c of casesFor(B)) MATRIX.push({ shape, B, ...c, out: L4(c.pts, B) });

const axis = (a, b) => Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9;
function checkInvariants(pts, out, label) {
  assert.equal(out.length, pts.length, label + ": mismo número de puntos");
  for (let i = 0; i < pts.length - 1; i++) assert.deepEqual(out[i], pts[i], label + ": vértice " + i + " intacto (origen incluido)");
  const n = pts.length, z = pts[n - 1], p = pts[n - 2], o = out[n - 1];
  const L = Math.hypot(p.x - z.x, p.y - z.y), ux = (p.x - z.x) / L, uy = (p.y - z.y) / L;
  const t = (o.x - z.x) * ux + (o.y - z.y) * uy, side = Math.abs((o.x - z.x) * uy - (o.y - z.y) * ux);
  assert.ok(side < 1e-9, label + ": la punta solo se mueve sobre su propio tramo");
  assert.ok(t >= -1e-12 && t <= L - 1 + 1e-9, label + ": hacia atrás y sin pasar del tramo (t = " + t + ")");
  for (let i = 1; i < n; i++) if (axis(pts[i - 1], pts[i])) assert.ok(axis(out[i - 1], out[i]), label + ": tramo " + i + " sigue ortogonal");
  return t;
}

test("matriz · 10 formas × 3 tamaños × n/e/s/w × codo/recta/diagonal × ancla centrada y desplazada: invariantes", () => {
  assert.deepEqual(SHAPES.slice().sort(), ["anim", "circle", "code", "cylinder", "diamond", "hex", "icon", "image", "rect", "text"], "las 10 formas del núcleo");
  for (const m of MATRIX) checkInvariants(m.pts, m.out, `${m.shape} ${m.B.w}×${m.B.h} ${m.k}`);
  assert.ok(MATRIX.length >= 10 * 3 * 4 * 7, "casos: " + MATRIX.length);
});
test("matriz · la retirada coincide con el oráculo de muestreo (silueta de skinNode) en todos los casos", () => {
  let landed = 0;
  for (const m of MATRIX) {
    const n = m.pts.length, z = m.pts[n - 1], p = m.pts[n - 2], L = Math.hypot(p.x - z.x, p.y - z.y), u = { x: (p.x - z.x) / L, y: (p.y - z.y) / L };
    const t = Math.hypot(m.out[n - 1].x - z.x, m.out[n - 1].y - z.y), o = oracleT(z, u, m.B);
    const label = `${m.shape} ${m.B.w}×${m.B.h} ${m.k}: implementación ${t.toFixed(4)} · oráculo ${o.toFixed(4)}`;
    if (o > L - 1) assert.equal(t, 0, label + " (t* > L − 1: no se toca)");
    else assert.ok(Math.abs(t - o) <= 0.02, label);
    if (t > 0) landed++;
  }
  assert.ok(landed > 50, "casos que aterrizan: " + landed);
});
test("valores · bloque: 8 u por n y e (tapa y lateral, C1), 0 por s y w; cilindro y formas planas: 0 en todos los lados", () => {
  const t = (m) => Math.hypot(m.out[m.out.length - 1].x - m.pts[m.pts.length - 1].x, m.out[m.out.length - 1].y - m.pts[m.pts.length - 1].y);
  for (const m of MATRIX) {
    const label = `${m.shape} ${m.B.w}×${m.B.h} ${m.k}`;
    if (m.shape === "rect" && !m.k.includes("diag")) assert.ok(Math.abs(t(m) - (m.side === "n" || m.side === "e" ? 8 : 0)) < 1e-9, label + ": " + t(m));
    if (!["rect", "icon"].includes(m.shape)) assert.equal(t(m), 0, label + ": sin silueta extruida, la punta queda en el ancla lógica");
    if (m.shape === "icon" && m.side === "n") assert.equal(t(m), 0, label + ": por el norte el icono no tiene nada encima del glifo");
    if (m.shape === "icon" && m.side === "s") assert.equal(t(m), 0, label);
  }
  /* icono de serie por el este: la peana corta el último tramo (C2); retirada = hasta el borde exterior de la peana */
  const ic = MATRIX.find((m) => m.shape === "icon" && m.B.w === SIZES.icon[0] && m.k === "e-codo0");
  const s = run(NOW, "skinIconGlyph(__a)", ic.B), px1 = ic.B.x + s / 2 + run(NOW, "SKIN_PLINTH_PAD");
  const z = ic.pts[2], tip = ic.out[2];
  assert.ok(tip.x > px1 && tip.x <= px1 + run(NOW, "SKIN_DEPTH") + 1e-9 && tip.y === z.y, `icono e: la punta (${tip.x.toFixed(2)}) queda sobre la peana (${px1.toFixed(2)}…${(px1 + 8).toFixed(2)})`);
});
test("guardas · desde dentro de la caja de anclaje, t* > L − 1, sin destino o sin tramo: no se toca", () => {
  const B = { id: 1, shape: "rect", x: 400, y: 300, w: 180, h: 70, color: "#5b8db5" };
  const inside = [{ x: 400, y: 320 }, { x: 400, y: 265 }];   /* sube por dentro hasta el ancla norte */
  assert.deepEqual(L4(inside, B), inside, "último tramo desde dentro");
  const corto = [{ x: 300, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 258 }, { x: 400, y: 265 }];   /* último tramo de 7 u < 8 + 1 */
  assert.deepEqual(L4(corto, B), corto, "t* > L − 1");
  const ok = [{ x: 400, y: 100 }, { x: 400, y: 265 }];
  assert.deepEqual(run(NOW, "skinEdgeLanding(__a, null)", ok), ok, "sin destino");
  assert.deepEqual(run(NOW, "skinEdgeLanding(__a.p, __a.B)", { p: [{ x: 400, y: 265 }], B }), [{ x: 400, y: 265 }], "un solo punto");
  assert.deepEqual(run(NOW, "skinEdgeLanding(__a.p, __a.B)", { p: [{ x: 400, y: 265 }, { x: 400, y: 265 }], B }), [{ x: 400, y: 265 }, { x: 400, y: 265 }], "tramo nulo");
  assert.deepEqual(run(NOW, "skinEdgeLanding(null, __a)", B), [], "sin ruta");
  /* el caso en que la guarda de «desde dentro» decide: en un icono de serie, el ancla este queda a la altura de la tapa de la
     peana; un último tramo que baja por dentro de la columna del glifo hasta ella saldría de la peana HACIA DENTRO */
  const I = { id: 2, shape: "icon", icon: "kafka", x: 400, y: 300, w: 120, h: 92, color: "#5b8db5" }, ae = run(NOW, "sidePoint(__a, \"e\")", I);
  const dentro = [{ x: ae.x - 6, y: ae.y - 30 }, ae];
  assert.deepEqual(L4(dentro, I), dentro, "icono: llega desde dentro de la caja de anclaje: no se toca");
  const fuera = [{ x: ae.x + 40, y: ae.y }, ae];
  assert.ok(L4(fuera, I)[1].x > ae.x + 10, "y desde fuera, por el este, sí se para en la peana");
});
test("intersección · skinLayerSpan da el intervalo del oráculo desde puntos interiores en todas las capas (segmentos, esquinas Q y arcos, con recorte)", () => {
  let k = 0;
  for (const shape of ["rect", "cylinder", "icon"]) for (const B of nodesFor(shape)) {
    const layers = run(NOW, "skinSilhouette(__a)", B);
    for (const l of layers) {
      const P = polygonize(l.segs), C = l.clip ? polygonize(l.clip) : null;
      const cx = P.reduce((s, p) => s + p.x, 0) / P.length, cy = P.reduce((s, p) => s + p.y, 0) / P.length;
      if (!inPoly({ x: cx, y: cy }, P) || (C && !inPoly({ x: cx, y: cy }, C))) continue;
      for (let a = 0; a < 24; a++) {
        const u = { x: Math.cos(a * Math.PI / 12 + 0.1), y: Math.sin(a * Math.PI / 12 + 0.1) };
        const sp = run(NOW, "skinLayerSpan(__a.z, __a.u, __a.l)", { z: { x: cx, y: cy }, u, l });
        const ins = (q) => inPoly(q, P) && (!C || inPoly(q, C)), c0 = { x: cx, y: cy };
        const t = exitAlong(ins, c0, u), tb = exitAlong(ins, c0, { x: -u.x, y: -u.y });
        assert.ok(sp && Math.abs(sp[1] - t) <= 0.02 && Math.abs(sp[0] + tb) <= 0.02, `${shape} ${B.w}×${B.h}: [${sp && sp.map((v) => v.toFixed(3))}] frente a [${(-tb).toFixed(3)}, ${t.toFixed(3)}]`);
        k++;
      }
    }
  }
  assert.ok(k > 400, "rayos: " + k);
});
test("memo · misma punta y mismo tramo con otra caja: se recalcula (la clave lleva la geometría del destino)", () => {
  const A = { id: 1, shape: "rect", x: 400, y: 300, w: 240, h: 70, color: "#5b8db5" }, Bb = { id: 1, shape: "rect", x: 390, y: 300, w: 180, h: 70, color: "#5b8db5" };
  const pts = [{ x: 500, y: 100 }, { x: 500, y: 265 }];
  assert.equal(L4(pts, A)[1].y, 257, "la tapa de A está sobre la punta");
  assert.deepEqual(L4(pts, Bb), pts, "en B la punta no está sobre su tapa: nada (no reutiliza el resultado de A)");
});
test("pureza e idempotencia · no escribe en la ruta ni en el nodo; aplicada dos veces da lo mismo; determinista", () => {
  for (const m of MATRIX) {
    NOW.__p = J(m.pts); NOW.__B = J(m.B);
    const a = J(vm.runInContext("skinEdgeLanding(__p, __B)", NOW));
    assert.deepEqual(J(NOW.__p), m.pts, "la ruta no cambia"); assert.deepEqual(J(NOW.__B), J(m.B), "el nodo no cambia");
    assert.deepEqual(a, m.out, "determinista");
    assert.deepEqual(L4(a, m.B), a, `${m.shape} ${m.k}: idempotente`);
  }
});
test("convexidad · las capas cerradas y rellenas de skinNode son convexas en todas las formas y tamaños (la intersección lo supone)", () => {
  for (const shape of SHAPES) for (const B of nodesFor(shape)) {
    const sk = run(NOW, 'skinNode(__a, "dark", THEMES.dark.bg)', B); if (!sk) continue;
    for (const l of sk.layers.filter((l) => l.fill && l.segs[l.segs.length - 1].op === "Z")) for (const segs of [l.segs, l.clip].filter(Boolean)) {
      const P = polygonize(segs).filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 1e-6);
      let sgn = 0;
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length];
        const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); if (Math.abs(cr) < 1e-7) continue;
        if (!sgn) sgn = Math.sign(cr); else assert.equal(Math.sign(cr), sgn, `${shape} ${l.k}: convexa`); }
    }
  }
});

/* ───────── corpus ───────── */
const corpusPages = () => {
  const out = [];
  for (const f of fs.readdirSync(path.join(root, "ejemplos/data"))) { const j = JSON.parse(read("ejemplos/data/" + f)); j.doc.pages.forEach((p, i) => out.push({ f: f + "#" + i, p })); }
  for (const f of ["test/fixtures/fluyo-019-2-skin.fluyo.json"]) { const j = JSON.parse(read(f)); j.doc.pages.forEach((p, i) => out.push({ f: path.basename(f) + "#" + i, p })); }
  for (const c of JSON.parse(read("test/fixtures/fluyo-019-d6-capas.json")).cases) out.push({ f: "d6:" + c.name, p: { nodes: c.nodes, edges: c.edges } });
  return out;
};
test("corpus · 0 tramos inclinados, invariantes y retiradas = oráculo (ejemplos: 7 bloques a 8 u, el icono por el este a la peana, iconos por el oeste 0,52 u; D6: rectas diagonales)", () => {
  const moved = [];
  for (const { f, p } of corpusPages()) {
    run(NOW, "doc.pages=[__a]; doc.cur=0; 0", p);
    for (const e of p.edges) {
      const r = run(NOW, "(()=>{ const e=edgeById(__a), B=nodeById(e.to), pts=edgePoints(e); return {pts, out: skinEdgeLanding(pts,B), shape:B.shape, B}; })()", e.id);
      if (r.pts.length < 2) continue;
      const t = checkInvariants(r.pts, r.out, f + " e" + e.id);
      const n = r.pts.length, z = r.pts[n - 1], p = r.pts[n - 2], L = Math.hypot(p.x - z.x, p.y - z.y), o = oracleT(z, { x: (p.x - z.x) / L, y: (p.y - z.y) / L }, r.B);
      assert.ok(o > L - 1 ? t === 0 : Math.abs(t - o) <= 0.02, f + " e" + e.id + ": " + t + " frente al oráculo " + o);
      if (t > 0) moved.push({ k: f + " e" + e.id, shape: r.shape, t, d6: f.startsWith("d6:"), diag: !axis(p, z) });
    }
  }
  const d6 = moved.filter((m) => m.d6), ex = moved.filter((m) => !m.d6);
  assert.ok(d6.length === 5 && d6.every((m) => m.diag && m.shape === "rect"), "D6: solo sus rectas diagonales hacia una hoja aterrizan: " + JSON.stringify(d6));
  const blocks = ex.filter((m) => m.shape === "rect"), icons = ex.filter((m) => m.shape === "icon");
  assert.equal(ex.length, blocks.length + icons.length, "solo bloques e iconos tienen silueta extruida: " + JSON.stringify(ex.filter((m) => !["rect", "icon"].includes(m.shape))));
  assert.ok(blocks.length === 7 && blocks.every((m) => Math.abs(m.t - 8) < 1e-9), "bloques: " + JSON.stringify(blocks));
  assert.equal(icons.filter((m) => m.t > 1).length, 1, "un icono por el este (microservicios e20) se para en la peana");
  assert.ok(icons.filter((m) => m.t <= 1).every((m) => m.t > 0.5 && m.t < 0.53), "los iconos por el oeste rozan la peana: 0,52 u");
});

/* ───────── F13: pelota única ───────── */
const N = (id, shape, x, y, w, h) => ({ id, shape, x, y, w, h, label: "N" + id, color: "#6a9fb5", order: id, icon: shape === "icon" ? "kafka" : undefined });
const E = (id, from, to, fs_, ts) => ({ id, from, to, fromSide: fs_, toSide: ts, route: "ortho", waypoints: [], animated: true, flowDir: "normal", endArrow: true });
const F13_PAGE = { name: "P", behaviors: [], scenarios: [], nextScenarioId: 1, nextId: 90,
  nodes: [N(1, "rect", 200, 150, 160, 70), N(2, "rect", 420, 400, 160, 70), N(3, "cylinder", 760, 400, 150, 90), N(4, "icon", 1100, 400, 120, 92), N(5, "diamond", 420, 700, 160, 100), N(6, "rect", 1100, 150, 160, 70)],
  edges: [E(10, 1, 2, "s", "n"), E(11, 2, 3, "e", "w"), E(12, 6, 4, "s", "e"), E(13, 2, 5, "s", "n"), E(14, 3, 4, "e", "w"), E(15, 6, 2, "w", "e")] };
const balls = (G, t, rsCode) => run(G, `(()=>{ const c=__rec(); drawFlowBalls(c, __a, ${rsCode}); return c.log.filter(a=>a.r===7); })()`, t);
const distTo = (p, pts) => { let m = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const u = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0; m = Math.min(m, Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy)); } return m; };
test("F13 · la pelota única va sobre la línea pintada; reloj, D, α, número y bucle iguales a 22f82eb; sin piel o sin aterrizaje, bit a bit", () => {
  for (const G of [NOW, OLD]) run(G, "doc.pages=[__a]; doc.cur=0; Object.assign(settings,{single:true,speed:0.5,build:false}); 0", F13_PAGE);
  const lines = run(NOW, "P().edges.map(e=>({id:e.id, logical:edgePoints(e), painted:skinEdgeLanding(edgePoints(e), nodeById(e.to))}))");
  const landed = lines.filter((l) => JSON.stringify(l.logical) !== JSON.stringify(l.painted));
  assert.ok(landed.length >= 3, "conexiones con aterrizaje en el documento: " + landed.map((l) => l.id));
  const per = 1 / 0.5, N_ = 240;
  let maxNow = 0, maxOld = 0, onLanded = 0;
  for (let i = 0; i < N_; i++) {
    const t = i * per / N_;
    const now = balls(NOW, t, "{skinOn:true}"), old = balls(OLD, t, "undefined");
    assert.equal(now.length, old.length, "mismo número de pelotas en t=" + t);
    for (let j = 0; j < now.length; j++) {
      assert.equal(now[j].ga, old[j].ga, "misma α (s, L y D lógicas) en t=" + t);
      const same = now[j].x === old[j].x && now[j].y === old[j].y;
      const host = lines.find((l) => distTo(old[j], l.logical) < 1e-9 && (same || JSON.stringify(l.logical) !== JSON.stringify(l.painted)));
      assert.ok(host, "la pelota de 22f82eb está sobre la ruta lógica de una conexión");
      if (!same) { assert.ok(landed.some((l) => l.id === host.id), "solo cambia la pelota de una conexión con aterrizaje"); onLanded++; }
      if (now[j].ga > 0.02) { maxNow = Math.max(maxNow, Math.min(...lines.map((l) => distTo(now[j], l.painted)))); maxOld = Math.max(maxOld, Math.min(...lines.map((l) => distTo(old[j], l.painted)))); }
    }
    /* bucle: t y t + periodo */
    const again = balls(NOW, t + per, "{skinOn:true}");
    assert.equal(again.length, now.length);
    again.forEach((b, j) => assert.ok(Math.abs(b.x - now[j].x) < 1e-6 && Math.abs(b.y - now[j].y) < 1e-6 && Math.abs(b.ga - now[j].ga) < 1e-9, "bucle en t=" + t));
    /* sin piel: la de 22f82eb, bit a bit (sin rs, y con skinOn:false) */
    assert.deepEqual(balls(NOW, t, "undefined"), old, "sin rs: idéntica a 22f82eb");
    assert.deepEqual(balls(NOW, t, "{skinOn:false}"), old, "sin piel: idéntica a 22f82eb");
  }
  assert.ok(maxNow < 1e-9, "distancia de la pelota a la línea pintada: " + maxNow);
  assert.ok(maxOld > 3, "en 22f82eb la pelota se separaba de la línea pintada (ahora aterrizada): " + maxOld.toFixed(2));
  assert.ok(onLanded > 20, "pelotas sobre conexiones aterrizadas: " + onLanded);
});
test("F13 · sin aterrizaje en todo el documento, la pelota con la piel es la de 22f82eb bit a bit", () => {
  const page = { ...F13_PAGE, edges: [E(10, 1, 2, "s", "s"), E(11, 2, 3, "e", "w"), E(14, 3, 5, "s", "n")] };
  for (const G of [NOW, OLD]) run(G, "doc.pages=[__a]; doc.cur=0; Object.assign(settings,{single:true,speed:0.5,build:false}); 0", page);
  const lines = run(NOW, "P().edges.map(e=>JSON.stringify(edgePoints(e))===JSON.stringify(skinEdgeLanding(edgePoints(e), nodeById(e.to))))");
  assert.ok(lines.every(Boolean), "ninguna conexión aterriza");
  for (let i = 0; i < 120; i++) { const t = i / 60; assert.deepEqual(balls(NOW, t, "{skinOn:true}"), balls(OLD, t, "undefined"), "t=" + t); }
});
test("modo puntos · el código de los puntos no cambia; sin aterrizaje, mismos arcos que 22f82eb; con aterrizaje, sobre la línea pintada y los mismos que pinta", () => {
  const dots = (src) => { const i = src.indexOf("  if(e.animated && !settings.single && !rs.scenarioRuntime){"), j = src.indexOf("  if(e.label){", i); assert.ok(i > 0 && j > i); return src.slice(i, j); };
  assert.equal(dots(read("js/render.js")), dots(atBase("js/render.js")), "bloque de los puntos idéntico");
  for (const G of [NOW, OLD]) run(G, "doc.pages=[__a]; doc.cur=0; Object.assign(settings,{single:false,speed:0.5,build:false}); 0", F13_PAGE);
  const draw = (G, id, t, skinOn) => run(G, `(()=>{ const rs=makeReadOnlyRenderState({width:100,height:100}); rs.skinOn=${skinOn}; rs.skinBg=THEMES.crema.bg; const c=__rec(); drawEdge(c, edgeById(__a.id), __a.t, "crema", true, rs); return c.log.filter(a=>a.r===5); })()`, { id, t });
  for (const e of F13_PAGE.edges) {
    const painted = run(NOW, "skinEdgeLanding(edgePoints(edgeById(__a)), nodeById(edgeById(__a).to))", e.id), logical = run(NOW, "edgePoints(edgeById(__a))", e.id);
    const oldPainted = run(OLD, "(()=>{ const e=edgeById(__a), p=edgePoints(e); return skinEdgeLanding(p, inferSide(nodeById(e.to), p[p.length-1])); })()", e.id);
    for (let i = 0; i < 40; i++) {
      const t = i / 20, now = draw(NOW, e.id, t, true), old = draw(OLD, e.id, t, true);
      assert.deepEqual(draw(NOW, e.id, t, false), draw(OLD, e.id, t, false), `e${e.id}: sin piel, idénticos`);
      assert.equal(now.length, old.length, `e${e.id}: mismo número de puntos`);
      now.forEach((d) => assert.ok(distTo(d, painted) < 1e-9, `e${e.id}: el punto va sobre la línea pintada`));
      if (JSON.stringify(painted) === JSON.stringify(logical) && JSON.stringify(oldPainted) === JSON.stringify(logical)) assert.deepEqual(now, old, `e${e.id}: sin aterrizaje, idénticos bit a bit`);
    }
  }
});

/* ───────── memo (auditoría) ───────── */
/* la memo es SKIN_LANDING_T (Map, global del script clásico): aquí se vacía, se desactiva y se inspecciona en vm */
const MEMO_CASES = () => { const out = MATRIX.map((m) => ({ p: m.pts, B: m.B }));
  for (const { p } of corpusPages()) { run(NOW, "doc.pages=[__a]; doc.cur=0; 0", p); for (const e of p.edges) { const r = run(NOW, "(()=>{ const e=edgeById(__a); return {p:edgePoints(e), B:nodeById(e.to)}; })()", e.id); if (r.B) out.push(r); } }
  return out; };
const landAll = (cases) => run(NOW, "__a.map(c=>skinEdgeLanding(c.p, c.B))", cases);
const uncached = (cases) => run(NOW, "(()=>{ const g=SKIN_LANDING_T.get; SKIN_LANDING_T.get=()=>undefined; try { return __a.map(c=>skinEdgeLanding(c.p, c.B)); } finally { SKIN_LANDING_T.get=g; } })()", cases);
test("memo · equivalencia: con la caché caliente, fría y desactivada da exactamente lo mismo (matriz + corpus), en cualquier orden", () => {
  const cases = MEMO_CASES();
  run(NOW, "SKIN_LANDING_T.clear(); 0");
  const cold = landAll(cases), warm = landAll(cases), off = uncached(cases);
  assert.deepEqual(warm, cold, "caliente = fría"); assert.deepEqual(off, cold, "sin caché = con caché");
  run(NOW, "SKIN_LANDING_T.clear(); 0");
  const rev = landAll(cases.slice().reverse()).reverse();
  assert.deepEqual(rev, cold, "orden inverso = orden directo (no depende del orden de render)");
  assert.ok(cases.length > 900, "casos: " + cases.length);
});
test("memo · la clave cubre todo lo que cambia la silueta: cualquier otra propiedad del nodo deja la silueta idéntica", () => {
  const OTHER = { id: 77, color: "#d08b5b", fill: "#123456", border: "dashed", label: "otro", font: "IBM Plex Mono", bold: true, pulse: true, tint: true, textColor: "#ffffff", textBg: "#000000", lblPos: "top", fs: 30, anim: "pulse", icon: "server", code: "y=2", order: 9, img: null };
  for (const shape of SHAPES) for (const B of nodesFor(shape)) {
    const base = run(NOW, "skinSilhouette(__a)", B);
    for (const [k, v] of Object.entries(OTHER)) assert.deepEqual(run(NOW, "skinSilhouette(__a)", { ...B, [k]: v }), base, `${shape}: «${k}» no cambia la silueta`);
    if (shape === "rect") for (const k of ["x", "y", "w", "h"]) assert.notDeepEqual(run(NOW, "skinSilhouette(__a)", { ...B, [k]: B[k] + 7 }), base, `${shape}: «${k}» sí la cambia (está en la clave)`);
  }
  /* y la clave lleva forma, caja, punta y punto anterior */
  const src = read("js/skin.js");
  assert.match(src, /const key=B\.shape\+"\|"\+B\.x\+"\|"\+B\.y\+"\|"\+B\.w\+"\|"\+B\.h\+"\|"\+z\.x\+"\|"\+z\.y\+"\|"\+p\.x\+"\|"\+p\.y;/);
});
test("memo · sin contaminación entre nodos ni documentos: mismos ids y otra geometría dan el resultado de la caché fría", () => {
  const pts = [{ x: 500, y: 100 }, { x: 500, y: 265 }];
  const docA = { id: 1, shape: "rect", x: 400, y: 300, w: 240, h: 70, color: "#5b8db5" }, docB = { id: 1, shape: "icon", icon: "kafka", x: 400, y: 300, w: 240, h: 70, color: "#5b8db5" };
  run(NOW, "SKIN_LANDING_T.clear(); 0");
  const a = L4(pts, docA), b = L4(pts, docB);
  run(NOW, "SKIN_LANDING_T.clear(); 0");
  assert.deepEqual(L4(pts, docB), b, "B tras A = B en frío"); assert.notDeepEqual(a, b, "A y B difieren de verdad");
});
test("memo · acotada: nunca pasa de SKIN_LANDING_MEMO entradas (miles de conexiones distintas)", () => {
  run(NOW, "SKIN_LANDING_T.clear(); 0");
  const max = run(NOW, "SKIN_LANDING_MEMO"), B = { id: 1, shape: "rect", x: 400, y: 300, w: 180, h: 70, color: "#5b8db5" };
  const sizes = run(NOW, `(()=>{ const s=[]; for(let i=0;i<3*SKIN_LANDING_MEMO;i++){ const x=320+(i%160), y=100-(i/160|0); skinEdgeLanding([{x,y},{x,y:265}], __a); if(i%500===0) s.push(SKIN_LANDING_T.size); } s.push(SKIN_LANDING_T.size); return s; })()`, B);
  assert.ok(sizes.every((n) => n <= max) && Math.max(...sizes) > 0, "tamaños: " + sizes.join(","));
});
test("memo · una llamada servida desde la caché no muta sus argumentos y devuelve una copia nueva", () => {
  const B = { id: 1, shape: "rect", x: 400, y: 300, w: 180, h: 70, color: "#5b8db5" }, pts = [{ x: 400, y: 100 }, { x: 400, y: 265 }];
  NOW.__p = J(pts); NOW.__B = J(B);
  const r = vm.runInContext("[skinEdgeLanding(__p, __B), skinEdgeLanding(__p, __B)]", NOW);
  assert.deepEqual(J(NOW.__p), pts); assert.deepEqual(J(NOW.__B), B);
  assert.notEqual(r[0], r[1], "dos copias distintas"); assert.deepEqual(J(r[0]), J(r[1]));
  r[0][1].y = -1; assert.equal(vm.runInContext("skinEdgeLanding(__p, __B)[1].y", NOW), 257, "mutar una copia no envenena la caché");
});
test("memo · plano no la usa; la pelota (F13), su reloj y su bucle son los mismos con la caché fría, caliente y desactivada", () => {
  run(NOW, "doc.pages=[__a]; doc.cur=0; Object.assign(settings,{single:true,speed:0.5,build:false}); SKIN_LANDING_T.clear(); 0", F13_PAGE);
  for (let i = 0; i < 30; i++) balls(NOW, i / 15, "undefined");
  for (let i = 0; i < 30; i++) balls(NOW, i / 15, "{skinOn:false}");
  assert.equal(run(NOW, "SKIN_LANDING_T.size"), 0, "sin piel, la pelota no consulta la memo");
  const calls = undo4b("js/render.js", undo3("js/render.js", read("js/render.js"))).split("\n").filter((l) => l.includes("skinEdgeLanding") && !/^\s*(\/\*|\*)/.test(l));
  assert.deepEqual(calls.filter((l) => !/rs\.skinOn|landed\.set\(/.test(l)), [], "render.js solo la llama con la piel: " + calls.length + " usos");
  const ts = Array.from({ length: 40 }, (_, i) => i / 20);
  run(NOW, "SKIN_LANDING_T.clear(); 0");
  const cold = ts.map((t) => balls(NOW, t, "{skinOn:true}")), warm = ts.map((t) => balls(NOW, t, "{skinOn:true}"));
  const off = run(NOW, "(()=>{ const g=SKIN_LANDING_T.get; SKIN_LANDING_T.get=()=>undefined; try { return __a.map(t=>{ const c=__rec(); drawFlowBalls(c, t, {skinOn:true}); return c.log.filter(a=>a.r===7); }); } finally { SKIN_LANDING_T.get=g; } })()", ts);
  assert.deepEqual(warm, cold); assert.deepEqual(off, cold);
  const loop = ts.map((t) => balls(NOW, t + 2, "{skinOn:true}"));
  loop.forEach((l, i) => l.forEach((b, j) => assert.ok(Math.abs(b.x - cold[i][j].x) < 1e-6 && Math.abs(b.y - cold[i][j].y) < 1e-6 && Math.abs(b.ga - cold[i][j].ga) < 1e-9, "bucle con la caché caliente")));
});

/* ───────── alcance ───────── */
test("alcance · frente a 22f82eb solo cambian skin.js (aterrizaje), render.js (llamada y pelota), export.js (llamada) y sw.js (CACHE v93)", () => {
  for (const f of ["js/skin.js", "js/render.js", "js/export.js"]) assert.equal(undoSemantics(f, undo4a(f, undo4b(f, undo3(f, read(f))))), atBase(f), f + ": fuera de lo de 019.4a, idéntico");
  for (const f of ["js/geometry.js", "js/model.js", "js/config.js", "js/interaction.js", "js/selection.js", "js/state.js", "js/ui.js", "js/viewer.js", "js/editor-runtime.js",
    "js/editor-scenarios.js", "js/present-story.js", "js/share-url.js", "js/deeplink.js", "index.html", "s/index.html", "css/styles.css", "css/system.css"])
    if (fs.existsSync(path.join(root, f))) assert.equal(undoSemantics(f, undo4b(f, undo3(f, read(f)))), atBase(f), f + " idéntico");
  const sw = undo3("sw.js", read("sw.js"));
  assert.match(sw, /const CACHE = "fluyo-static-v102";/);
  assert.equal(sw.replace('"fluyo-static-v102"', '"fluyo-static-v' + (93 - 1) + '"'), atBase("sw.js"), "sw.js: solo cambia CACHE");
  /* la piel en sí no cambia: mismas capas, extensión, orden, voz y anillo */
  const fn = (src, name) => { const i = src.indexOf("function " + name + "("); assert.ok(i >= 0, name); const j = src.indexOf("\n}\n", i); return src.slice(i, j); };
  for (const name of ["skinNode", "skinExtent", "skinPaintOrder", "skinLabelFont", "skinEdgePort", "skinTones", "skinColor", "skinFaces", "skinHasSkin", "skinActive"])
    assert.equal(fn(read("js/skin.js"), name), fn(atBase("js/skin.js"), name), name + " idéntica");
  /* las dos superficies llaman igual: el lienzo y el SVG con el destino */
  assert.ok(undo4b("js/render.js", undo3("js/render.js", read("js/render.js"))).includes("pts=skinEdgeLanding(pts, B);") && read("js/export.js").includes("pts=skinEdgeLanding(pts, B);"), "render y export: misma llamada");
  assert.ok(!/inferSide\(B, pts\[pts\.length-1\]\)/.test(read("js/render.js") + read("js/export.js")), "el aterrizaje ya no depende del lado");
});
