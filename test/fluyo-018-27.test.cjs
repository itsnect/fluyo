"use strict";
/* FLUYO-018.27 — Tamaño configurable de las puntas (`arrowSize`). Contratos en vm (sin navegador): el geometry.js del árbol
   frente al de HEAD (git show), el modelo (model.js) y estáticos. Lo que necesita lienzo, panel y Chrome lo mide
   test/fluyo-018-27-browser.cjs; la paridad con svg.ts, visual-regression.test.ts del MCP.
   · T1/T13: una conexión SIN `arrowSize` (todo el corpus publicado y los documentos antiguos) se dibuja byte a byte como en HEAD.
   · T2: `arrowSize:1` = ausente. T3/T4: 1,5× y 2× son la MISMA aguja escalada desde la punta (largo, ancho y muesca a la vez);
     la punta sigue a EDGE_GAP del ancla y la línea muere en la muesca. T5/T6/T7: inicio, fin y ambas.
   · T9: una conexión corta no desplaza la punta ni produce NaN. La ruta (edgePoints), las etiquetas y los puntos de flujo no cambian.
   · Modelo: `arrowSize` opcional, numérico, acotado en [1, 2]; null lo quita; un parche no numérico se rechaza; la carga no migra.
   · T14: clonar/duplicar conserva `arrowSize`; eliminar no toca a las demás. Deep link (link-codec) y JSON lo conservan.
   · Alcance: rutas, render, interacción y Historias intactos; solo geometry.js (sección del trazo), model.js, ui.js, index.html, sw.js. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const head = (f) => execFileSync("git", ["-C", gitRoot, "show", "HEAD:" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const J = (v) => JSON.parse(JSON.stringify(v));
const slice = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = b ? s.indexOf(b, i + a.length) : -1; return s.slice(i, j < 0 ? s.length : j); };

function geometry(src, files) {
  const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, CompressionStream, DecompressionStream, crypto, console });
  for (const f of files) vm.runInContext(src(f), ctx, { filename: f });
  return ctx;
}
const NOW = geometry((f) => read("js/" + f), ["config.js", "safe-svg.js", "model.js", "geometry.js", "link-codec.js"]);
const OLD = geometry((f) => head("js/" + f), ["config.js", "safe-svg.js", "model.js", "geometry.js"]);
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const stroke = (G, e, pts) => run(G, "edgeStroke(__a.e, __a.pts)", { e, pts });
const H = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const rect = (id, x, y, w = 180, h = 70) => ({ id, shape: "rect", x, y, w, h, label: "" });
const edge = (id, from, to, o = {}) => ({ id, from, to, route: "ortho", fromSide: null, toSide: null, waypoints: [], ...o });
const pg = (nodes, edges) => ({ name: "P", nodes, edges, nextId: 99, behaviors: [], scenarios: [], nextScenarioId: 1 });
const CORPUS = fs.readdirSync(path.join(root, "ejemplos", "data")).filter((f) => f.endsWith(".json")).map((f) => ({ name: f, doc: JSON.parse(read("ejemplos/data/" + f)) }));
/* trazos de todas las aristas de una página, con un `arrowSize` opcional superpuesto */
const strokes = (G, page, size) => run(G, "doc.pages=[__a.page]; doc.cur=0; P().edges.map(e=>{ const ee=Object.assign({}, e); if(__a.size!==undefined) ee.arrowSize=__a.size; return {id:e.id, pts:edgePoints(e), st:edgeStroke(ee, edgePoints(e))}; })", { page, size });

/* ── T1 / T13 / T2: ausente = HEAD; 1 = ausente ── */
test("T1/T13 · corpus publicado (ejemplos/data): sin `arrowSize`, trazo y puntas idénticos a HEAD en todas las aristas", () => {
  let n = 0;
  for (const c of CORPUS) for (const page of c.doc.doc.pages) {
    const a = strokes(NOW, page), b = strokes(OLD, page);
    assert.deepEqual(a, b, c.name);
    n += a.length;
  }
  assert.equal(n, 61, "61 aristas en el corpus");
});
test("T2 · `arrowSize:1` dibuja exactamente lo mismo que ausente (corpus entero, y los casos límite)", () => {
  for (const c of CORPUS) for (const page of c.doc.doc.pages) assert.deepEqual(strokes(NOW, page, 1), strokes(NOW, page), c.name);
  for (const pts of [[{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 6, y: 40 }], [{ x: 10, y: 10 }, { x: 10.5, y: 10.2 }]])
    for (const flags of [{}, { startArrow: true }, { endArrow: false, startArrow: true }])
      assert.deepEqual(stroke(NOW, { ...flags, arrowSize: 1 }, pts), stroke(NOW, flags, pts), JSON.stringify(pts) + JSON.stringify(flags));
});

/* ── T3 / T4: escala proporcional desde la punta ── */
test("T3/T4 · recta horizontal: 1,5× y 2× escalan largo, ancho y muesca a la vez; la punta sigue a EDGE_GAP y la línea muere en la muesca", () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const [GAP, LEN, HALF, NOTCH] = run(NOW, "[EDGE_GAP, EDGE_HEAD_LEN, EDGE_HEAD_HALF, EDGE_HEAD_NOTCH]");
  assert.deepEqual([GAP, LEN, HALF, NOTCH], [3, 11, 4, 2.8], "las constantes de 018.16 no cambian");
  const table = [];
  for (const k of [1, 1.5, 2]) {
    const s = stroke(NOW, { endArrow: true, startArrow: true, arrowSize: k }, pts);
    assert.equal(s.heads.length, 2);
    const [fin, ini] = s.heads;
    const len = fin[0].x - fin[1].x, ancho = fin[1].y - fin[3].y, muesca = fin[0].x - fin[2].x;
    assert.ok(near(fin[0].x, 100 - GAP) && near(fin[0].y, 0), k + "×: la punta del final sigue a 3 px del ancla");
    assert.ok(near(ini[0].x, GAP) && near(ini[0].y, 0), k + "×: la punta del inicio sigue a 3 px del ancla");
    assert.ok(near(len, LEN * k) && near(ancho, 2 * HALF * k) && near(muesca, (LEN - NOTCH) * k), k + "×: aguja " + len + "×" + ancho + ", muesca " + muesca);
    assert.ok(near(fin[1].y, HALF * k) && near(fin[3].y, -HALF * k), k + "×: simétrica respecto al eje");
    const end = s.line[s.line.length - 1], start = s.line[0];
    assert.ok(near(end.x, fin[2].x) && near(end.y, 0), k + "×: la línea muere en la muesca del final (" + end.x + " ≠ " + fin[2].x + ")");
    assert.ok(near(start.x, ini[2].x) && near(start.y, 0), k + "×: la línea nace en la muesca del inicio");
    table.push({ k, len, ancho, muesca, lineaHasta: end.x });
  }
  assert.deepEqual(table.map((r) => [r.k, r.len, r.ancho]), [[1, 11, 8], [1.5, 16.5, 12], [2, 22, 16]], "11×8 · 16,5×12 · 22×16");
});
test("T3/T4 · en todo el corpus (rectas, ortogonales y U): cada vértice de la punta a k× es tip + k·(v₁ − tip); orientación y posición intactas", () => {
  let n = 0;
  for (const c of CORPUS) for (const page of c.doc.doc.pages) {
    const base = strokes(NOW, page, 1);
    for (const k of [1.5, 2]) {
      const big = strokes(NOW, page, k);
      big.forEach((b, i) => {
        const a = base[i];
        assert.equal(b.st.heads.length, a.st.heads.length, c.name + " e" + b.id);
        b.st.heads.forEach((hk, hi) => {
          const h1 = a.st.heads[hi], tip = h1[0];
          assert.deepEqual([hk[0].x, hk[0].y], [tip.x, tip.y], c.name + " e" + b.id + ": la punta no se mueve");
          for (let v = 1; v < 4; v++) {
            assert.ok(near(hk[v].x, tip.x + k * (h1[v].x - tip.x), 1e-6) && near(hk[v].y, tip.y + k * (h1[v].y - tip.y), 1e-6),
              c.name + " e" + b.id + " v" + v + " a " + k + "×: " + JSON.stringify(hk[v]) + " ≠ escala de " + JSON.stringify(h1[v]));
          }
          n++;
        });
        /* el trazo: mismos vértices salvo el recorte hasta la muesca (y, si el tramo es corto, la esquina que se acorta con él) */
        assert.deepEqual(b.pts, a.pts, c.name + " e" + b.id + ": la ruta no cambia");
        assert.equal(b.st.line[0].op, "M");
      });
    }
  }
  assert.ok(n >= 61 * 2, "puntas comparadas: " + n);
});

/* ── T5 / T6 / T7 ── */
test("T5/T6/T7 · inicio, fin y ambas, a 2×: cada punta a EDGE_GAP de SU ancla, orientada hacia ella, 22×16", () => {
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 200 }];
  const fin = stroke(NOW, { endArrow: true, startArrow: false, arrowSize: 2 }, pts), ini = stroke(NOW, { endArrow: false, startArrow: true, arrowSize: 2 }, pts), ambas = stroke(NOW, { endArrow: true, startArrow: true, arrowSize: 2 }, pts);
  assert.equal(fin.heads.length, 1); assert.equal(ini.heads.length, 1); assert.equal(ambas.heads.length, 2);
  assert.deepEqual([fin.heads[0][0].x, fin.heads[0][0].y], [0, 197]); assert.ok(near(fin.heads[0][1].y, 175) && near(Math.abs(fin.heads[0][1].x - fin.heads[0][3].x), 16));
  assert.deepEqual([ini.heads[0][0].x, ini.heads[0][0].y], [0, 3]); assert.ok(near(ini.heads[0][1].y, 25));
  assert.deepEqual(ambas.heads[0], fin.heads[0]); assert.deepEqual(ambas.heads[1], ini.heads[0]);
  assert.ok(near(ambas.line[0].y, 3 + 16.4) && near(ambas.line[ambas.line.length - 1].y, 197 - 16.4), "la línea va de muesca a muesca");
  assert.equal(stroke(NOW, { endArrow: false, startArrow: false, arrowSize: 2 }, pts).heads.length, 0, "sin puntas, arrowSize no dibuja nada");
});

/* ── T9: conexión corta ── */
test("T9 · conexiones cortas (tramo menor que la punta): la punta sigue a EDGE_GAP del ancla, sin NaN, y la ruta no cambia", () => {
  for (const k of [1, 1.5, 2]) for (const pts of [[{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 4 }], [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 6, y: 40 }], [{ x: 10, y: 10 }, { x: 10.5, y: 10.2 }]]) {
    const s = stroke(NOW, { endArrow: true, startArrow: true, arrowSize: k }, pts), z = pts[pts.length - 1];
    for (const h of s.heads) for (const v of h) if (v.op !== "Z") assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y), JSON.stringify(pts));
    for (const v of s.line) assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y));
    assert.ok(near(H(s.heads[0][0], z), 3, 1e-9), k + "× " + JSON.stringify(pts) + ": punta del final a " + H(s.heads[0][0], z));
    assert.ok(near(H(s.heads[1][0], pts[0]), 3, 1e-9), k + "× " + JSON.stringify(pts) + ": punta del inicio");
  }
  /* caras muy cercanas (P2 de 018.25): las puntas grandes no mueven la ruta ni el ancla */
  const nodes = [rect(1, 400, 500), rect(2, 400 + 180 + 30, 500)];
  const p1 = strokes(NOW, pg(nodes, [edge(3, 1, 2, { startArrow: true })]), 1)[0], p2 = strokes(NOW, pg(nodes, [edge(3, 1, 2, { startArrow: true })]), 2)[0];
  assert.deepEqual(p2.pts, p1.pts, "ruta P2 intacta");
  assert.deepEqual(p2.st.heads.map((h) => h[0]), p1.st.heads.map((h) => h[0]), "las puntas no se mueven");
});

/* ── Barrido: ortogonales y U a 1×/1,5×/2× ── */
test("barrido 10 posiciones × 25 lados × {1, 1,5, 2}: punta perpendicular al borde, a EDGE_GAP, sin NaN; la ruta y el ancla no dependen de `arrowSize`; tramo recto delante medido", () => {
  const S5 = [null, "n", "e", "s", "w"];
  const POS = [[800, 500], [800, 300], [400, 200], [0, 300], [0, 500], [0, 700], [400, 800], [800, 700], [800, 507], [807, 300]];
  const code = "doc.pages=[__a.page]; doc.cur=0; P().edges.map(e=>{ const p=edgePoints(e), ee=Object.assign({arrowSize:__a.k}, e), st=edgeStroke(ee,p), n=p.length, z=p[n-1], h=st.heads[0]; " +
    "const side=e.toSide||inferSide(nodeById(e.to),z), u=strokeDir(p,false), L=st.line, end=L[L.length-1], prev=L[L.length-2]; " +
    "return { pts:p, tipGap:Math.hypot(h[0].x-z.x,h[0].y-z.y), perp:Math.abs(u.x+DIR[side].x)<1e-9 && Math.abs(u.y+DIR[side].y)<1e-9, recto:Math.hypot(end.x-prev.x,end.y-prev.y), ok:h.every(v=>v.op==='Z'||(Number.isFinite(v.x)&&Number.isFinite(v.y))) }; })";
  const minRecto = { 1: Infinity, 1.5: Infinity, 2: Infinity };
  let n = 0;
  for (const [bx, by] of POS) for (const fs of S5) for (const ts of S5) {
    const page = pg([rect(1, 400, 500), rect(2, bx, by)], [edge(3, 1, 2, { fromSide: fs, toSide: ts })]);
    const r1 = run(NOW, code, { page, k: 1 });
    for (const k of [1.5, 2]) {
      const rk = run(NOW, code, { page, k });
      const key = `(${bx},${by}) ${fs}/${ts} ${k}×`;
      assert.deepEqual(rk[0].pts, r1[0].pts, key + ": edgePoints no depende de arrowSize");
      assert.ok(rk[0].ok && rk[0].perp && near(rk[0].tipGap, 3, 1e-6), key + ": " + JSON.stringify(rk[0]));
      minRecto[k] = Math.min(minRecto[k], rk[0].recto);
      n++;
    }
    minRecto[1] = Math.min(minRecto[1], r1[0].recto);
  }
  assert.equal(n, 500);
  /* lo que queda recto delante de la punta en el pasillo de 28 px: 8,8 / 6,35 / 4,3 (la esquina se acorta con el tramo recortado) */
  assert.ok(minRecto[1] >= 8.8 - 0.01 && minRecto[1.5] >= 6.35 - 0.01 && minRecto[2] >= 4.3 - 0.01, "mínimos: " + JSON.stringify(minRecto));
  console.log("    tramo recto mínimo delante de la punta (px): " + JSON.stringify(minRecto));
});

/* ── Modelo ── */
test("modelo · createConnectionIn/updateConnectionIn: opcional, numérico, acotado en [1, 2]; null lo quita; un parche no numérico se rechaza", () => {
  const code = `(()=>{
    const pg={name:"P",nodes:[{id:1,shape:"rect",x:0,y:0,w:100,h:50,label:""},{id:2,shape:"rect",x:300,y:0,w:100,h:50,label:""}],edges:[],nextId:3,behaviors:[],scenarios:[],nextScenarioId:1};
    const err=f=>{ try{ f(); return null; }catch(e){ return e.code+":"+e.field; } };
    const a=createConnectionIn(pg,{source:1,target:2}), b=createConnectionIn(pg,{source:1,target:2,arrowSize:1.5}), c=createConnectionIn(pg,{source:1,target:2,arrowSize:7}), d=createConnectionIn(pg,{source:1,target:2,arrowSize:0.25});
    const out={ sinClave:!("arrowSize" in a), b:b.arrowSize, c:c.arrowSize, d:d.arrowSize, keys:Object.keys(b) };
    out.u2=updateConnectionIn(pg,a.id,{arrowSize:2}).arrowSize;
    out.uStr=err(()=>updateConnectionIn(pg,a.id,{arrowSize:"2"}));
    out.uNaN=err(()=>updateConnectionIn(pg,a.id,{arrowSize:NaN}));
    out.uBool=err(()=>updateConnectionIn(pg,a.id,{arrowSize:true}));
    out.uDesconocida=err(()=>updateConnectionIn(pg,a.id,{arrowSizes:2}));
    out.intacto=a.arrowSize;
    out.uClamp=updateConnectionIn(pg,a.id,{arrowSize:3.5}).arrowSize;
    updateConnectionIn(pg,a.id,{arrowSize:null}); out.nullQuita=!("arrowSize" in a);
    out.undefNoToca=updateConnectionIn(pg,b.id,{arrowSize:undefined, label:"x"}).arrowSize;
    out.dotsNull=err(()=>updateConnectionIn(pg,b.id,{dots:null}));
    out.speedNull=err(()=>updateConnectionIn(pg,b.id,{speedFac:null}));
    return out; })()`;
  const r = run(NOW, code);
  assert.equal(r.sinClave, true, "crear sin arrowSize no lo escribe (ausente = 1, sin migrar)");
  assert.equal(r.b, 1.5); assert.equal(r.c, 2, "7 → 2"); assert.equal(r.d, 1, "0,25 → 1");
  assert.ok(r.keys.includes("arrowSize"));
  assert.equal(r.u2, 2);
  assert.equal(r.uStr, "invalid_document:arrowSize"); assert.equal(r.uNaN, "invalid_document:arrowSize"); assert.equal(r.uBool, "invalid_document:arrowSize");
  assert.equal(r.uDesconocida, "invalid_document:arrowSizes");
  assert.equal(r.intacto, 2, "un parche rechazado deja el registro intacto");
  assert.equal(r.uClamp, 2);
  assert.equal(r.nullQuita, true, "null quita la clave (no queda `undefined`)");
  assert.equal(r.undefNoToca, 1.5);
  assert.equal(r.dotsNull, null, "dots:null sigue admitido"); assert.equal(r.speedNull, "invalid_document:speedFac", "speedFac:null sigue rechazado");
});
test("modelo · la carga (projectFromProjectData) no migra: sin clave sigue sin clave; un número se acota; un valor raro vale 1; en HEAD la clave se conservaba tal cual (passthrough)", () => {
  const data = { version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [pg([rect(1, 0, 0), rect(2, 400, 0)], [edge(3, 1, 2), edge(4, 1, 2, { arrowSize: 1.5 }), edge(5, 1, 2, { arrowSize: 9 }), edge(6, 1, 2, { arrowSize: "3" }), edge(7, 1, 2, { arrowSize: null })])] }, settings: {} };
  const r = run(NOW, "projectFromProjectData(__a).doc.pages[0].edges.map(e=>('arrowSize' in e)? e.arrowSize : 'ausente')", data);
  assert.deepEqual(r, ["ausente", 1.5, 2, 1, "ausente"]);
  const viejo = run(OLD, "projectFromProjectData(__a).doc.pages[0].edges.map(e=>('arrowSize' in e)? e.arrowSize : 'ausente')", data);
  assert.deepEqual(viejo, ["ausente", 1.5, 9, "3", null], "HEAD no validaba la clave: un documento 018.27 abre en un editor anterior sin romperse");
  for (const c of CORPUS) {
    const edges = run(NOW, "projectFromProjectData(__a).doc.pages.flatMap(p=>p.edges)", c.doc);
    assert.ok(edges.every((e) => !("arrowSize" in e)), c.name + ": el corpus sigue sin la clave");
  }
});

/* ── T14 y serialización ── */
test("T14 · clonar (pegar) y duplicar conservan `arrowSize`; eliminar una conexión no toca el de las demás", () => {
  const code = `(()=>{
    const pg=__a; const snap=JSON.parse(JSON.stringify({nodes:pg.nodes, edges:pg.edges}));
    const c=cloneStructureIn(pg, snap, {dx:10,dy:10}).connections.map(x=>pg.edges.find(e=>e.id===x.id)).map(e=>('arrowSize' in e)? e.arrowSize : 'ausente');
    const d=duplicateNodesIn(pg, [1,2], {dx:10,dy:10}).connections.map(x=>pg.edges.find(e=>e.id===x.id)).map(e=>('arrowSize' in e)? e.arrowSize : 'ausente');
    deleteConnectionIn(pg, 4);
    return { c, d, rest: pg.edges.filter(e=>e.from===1&&e.to===2).map(e=>[e.id, ('arrowSize' in e)? e.arrowSize : 'ausente']) }; })()`;
  const r = run(NOW, code, pg([rect(1, 0, 0), rect(2, 400, 0)], [edge(3, 1, 2), edge(4, 1, 2, { arrowSize: 1.5 }), edge(5, 1, 2, { arrowSize: 2 })]));
  assert.deepEqual(r.c, ["ausente", 1.5, 2]); assert.deepEqual(r.d, ["ausente", 1.5, 2]);
  assert.deepEqual(r.rest, [[3, "ausente"], [5, 2]]);
});
test("serialización · JSON y deep link (link-codec) conservan `arrowSize` y no inventan la clave donde no estaba", async () => {
  const data = { version: 5, app: "fluyo", doc: { theme: "dark", customBg: "", eventTypes: [], nextEventTypeId: 1, cur: 0, pages: [pg([rect(1, 0, 0), rect(2, 400, 0)], [edge(3, 1, 2), edge(4, 1, 2, { arrowSize: 2 })])] }, settings: {} };
  const json = run(NOW, "JSON.parse(JSON.stringify(projectFromProjectData(__a))).doc.pages[0].edges.map(e=>('arrowSize' in e)? e.arrowSize : 'ausente')", data);
  assert.deepEqual(json, ["ausente", 2]);
  NOW.__a = J(data);
  const back = J(await vm.runInContext("encodeDeepLink(__a).then(p=>decodeDeepLink(p))", NOW));   // J: arrays del realm de vm
  const edges = (back.projectData || back).doc.pages[0].edges;
  assert.deepEqual(edges.map((e) => ("arrowSize" in e ? e.arrowSize : "ausente")), ["ausente", 2], JSON.stringify(Object.keys(back)));
});

/* ── Estáticos: UI, render, exportación, SW, MCP ── */
test("ui.js / index.html · «Tamaño de flecha»: segmentado 1× · 1,5× · 2× sobre #arrowSizeSel (decisión 182); un cambio = pushUndo + editEdge({arrowSize}); elegir lo que ya está no escribe; sin puntas se oculta", () => {
  const html = read("index.html"), ui = read("js/ui.js");
  const seg = slice(html, '<div class="row inlineSeg" id="rowArrowSize">', "</select>");
  assert.match(seg, /id="arrowSizeSeg" role="radiogroup" aria-labelledby="arrowSizeLbl"/);
  assert.deepEqual([...seg.matchAll(/class="segBtn" role="radio" data-v="([^"]+)">([^<]+)</g)].map((m) => [m[1], m[2]]), [["1", "1×"], ["1.5", "1,5×"], ["2", "2×"]]);
  assert.match(seg, /<select id="arrowSizeSel" class="srOnly" tabindex="-1" aria-hidden="true"><option value="1">/);
  assert.match(seg, /<span class="lblText" id="arrowSizeLbl">Tamaño de flecha<\/span>/);
  assert.ok(html.indexOf('id="rowArrowSize"') > html.indexOf('id="arrowSeg"') && html.indexOf('id="rowArrowSize"') < html.indexOf('id="rowAnim"'), "vive junto a Puntas, en Dirección");
  assert.match(ui, /segOnSelect\("arrowSizeSeg","arrowSizeSel"\);/);
  const h = slice(ui, '$("arrowSizeSel").onchange=()=>{', "};");
  assert.match(h, /if\(edgeArrowSize\(e\)===v\) return;/);
  assert.equal((h.match(/pushUndo\(\)/g) || []).length, 1); assert.match(h, /editEdge\(e,\{arrowSize:v\}\)/);
  assert.match(ui, /function syncArrowSeg\(e\)\{[^\n]*syncArrowSizeSeg\(e\); \}/, "refreshPanel → syncArrowSeg → syncArrowSizeSeg");
  assert.match(slice(ui, "function syncArrowSizeSeg(e){", "\n}"), /\$\("rowArrowSize"\)\.style\.display=arrowsOf\(e\)==="none" \? "none" : "flex";/);
  /* es una fila de CONEXIÓN: con un nodo seleccionado se oculta como las demás (si no, Dirección aparecería en los nodos) */
  assert.match(ui, /const edgeRows=\[[^\]]*"rowArrows","rowArrowSize","rowArrS"/);
});
test("render.js / export.js / editor-scenarios.js · idénticos a HEAD: el lienzo (editor, Present, Viewer) y el SVG pasan la conexión entera a edgeStroke, sin factor de zoom en las puntas", () => {
  for (const f of ["js/render.js", "js/export.js", "js/editor-scenarios.js"]) assert.equal(read(f), head(f), f + " no cambia");
  const render = read("js/render.js");
  assert.match(render, /const stroke=edgeStroke\(e,pts\)/);
  assert.match(render, /for\(const h of stroke\.heads\)\{ c\.beginPath\(\); traceSegments\(c,h\); c\.fill\(\); \}/, "la punta se rellena en unidades de mundo: escala con el diagrama, como la línea (T8)");
  assert.match(read("js/export.js"), /const stroke=edgeStroke\(e,pts\);\n.*\n  for\(const h of stroke\.heads\) parts\.push\(`<path d="\$\{segmentsToSVGPath\(h\)\}" fill="\$\{lineCol\}"\/>`\);/);
  assert.match(read("s/index.html"), /js\/geometry\.js"><\/script>\n<script src="\.\.\/js\/render\.js"/, "el Viewer carga la misma geometría");
});
test("alcance · rutas (edgePoints, orthoRoute, parallelLane, laneLayout, handleRoute) y lo demás de geometry.js idénticos a HEAD; solo cambia la sección del trazo; interaction/selection/state/Historias/Present/Viewer intactos", () => {
  const now = read("js/geometry.js"), old = head("js/geometry.js");
  const A = "/* ===================== Trazo de una conexión (FLUYO-018.16)", B = "/* ===================== Puerto de conectar (FLUYO-018.16)";
  assert.equal(now.slice(0, now.indexOf(A)), old.slice(0, old.indexOf(A)), "antes del trazo (anclas, rutas, carriles, barras): byte a byte");
  assert.equal(now.slice(now.indexOf(B)), old.slice(old.indexOf(B)), "después del trazo (puerto, código, cilindro, SVG): byte a byte");
  const sec = slice(now, A, B);
  assert.match(sec, /const ARROW_SIZE_MIN=1, ARROW_SIZE_MAX=2;/);
  assert.match(sec, /function edgeArrowSize\(e\)\{ const k=e\? \+e\.arrowSize : NaN; return Number\.isFinite\(k\) \? Math\.min\(ARROW_SIZE_MAX, Math\.max\(ARROW_SIZE_MIN, k\)\) : 1; \}/);
  assert.match(sec, /const s=size\|\|1, len=EDGE_HEAD_LEN\*s, half=EDGE_HEAD_HALF\*s, k=\(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH\)\*s;/, "largo, ancho y muesca con el mismo factor");
  assert.match(sec, /cut=EDGE_GAP\+\(EDGE_HEAD_LEN-EDGE_HEAD_NOTCH\)\*size;/, "el recorte sigue a la muesca; EDGE_GAP no se escala");
  assert.doesNotMatch(sec, /EDGE_GAP\*s|EDGE_GAP\*size|EDGE_W\*/);
  for (const f of ["js/interaction.js", "js/selection.js", "js/state.js", "js/config.js", "js/story-clock.js", "js/story-playback.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/present-story.js", "js/viewer.js", "js/share-url.js", "js/link-codec.js", "js/deeplink.js", "js/document-integrity.js", "js/story-authoring.js", "css/styles.css", "css/system.css", "s/index.html"])
    assert.equal(read(f), head(f), f + " no cambia");
  /* model.js: solo la clave nueva y su normalización; el resto del kernel, igual */
  const m = read("js/model.js"), mo = head("js/model.js");
  assert.ok(m.includes('"dotsGlobal","arrowSize"]);'), "CONNECTION_SPEC_KEYS y CONNECTION_UPDATE_KEYS");
  assert.equal((m.match(/"dotsGlobal","arrowSize"\]\);/g) || []).length, 2);
  assert.match(m, /const UPDATE_NUMBERS=new Set\(\["speedFac","dots","arrowSize"\]\);/);
  assert.match(m, /if\(e\.arrowSize===null\) delete e\.arrowSize;\n  else if\(e\.arrowSize!==undefined\) e\.arrowSize=clamp\(projectNumber\(e\.arrowSize,1\),1,2\);/);
  /* quitando las seis ediciones de 018.27 vuelve a salir HEAD byte a byte: nada más cambió en el kernel */
  const sin = m
    .replace('"fs","speedFac","dots","dotsGlobal","arrowSize"]);', '"fs","speedFac","dots","dotsGlobal"]);')
    .replace('"dotColor","speedFac","dots","dotsGlobal","arrowSize"]);', '"dotColor","speedFac","dots","dotsGlobal"]);')
    .replace('const UPDATE_NUMBERS=new Set(["speedFac","dots","arrowSize"]);   // la normalización de la carga sustituye en silencio un valor no numérico: aquí se rechaza\nconst UPDATE_NULLABLE_NUMBERS=new Set(["dots","arrowSize"]);         // null = volver al valor por defecto (quita la clave)',
      'const UPDATE_NUMBERS=new Set(["speedFac","dots"]);               // la normalización de la carga sustituye en silencio un valor no numérico: aquí se rechaza')
    .replace('!(v===null && UPDATE_NULLABLE_NUMBERS.has(k))', '!(v===null && k==="dots")')
    .replace('  // una clave que la normalización quita (arrowSize:null) desaparece del registro: no queda como `undefined`\n  for(const k of fields){ const kk=connectionKey(k); if(cand[kk]===undefined) delete e[kk]; else e[kk]=cand[kk]; }',
      '  for(const k of fields) e[connectionKey(k)]=cand[connectionKey(k)];')
    .replace(/  \/\* FLUYO-018\.27: tamaño de las puntas, opcional\.[\s\S]*?\n  if\(e\.arrowSize===null\) delete e\.arrowSize;\n  else if\(e\.arrowSize!==undefined\) e\.arrowSize=clamp\(projectNumber\(e\.arrowSize,1\),1,2\);\n/, "");
  assert.equal(sin, mo, "model.js = HEAD + las seis ediciones de 018.27 (kernel, Historias, clonado, integridad: intactos)");
});
test("release · CACHE v84; fluyo-mcp (si está al lado) lleva el kernel resincronizado y el port de svg.ts con el mismo factor", () => {
  assert.match(read("sw.js"), /const CACHE = "fluyo-static-v98";/);
  const mcp = path.resolve(root, "..", "fluyo-mcp");
  if (!fs.existsSync(path.join(mcp, "src", "svg.ts"))) return;
  const kernel = fs.readFileSync(path.join(mcp, "src", "generated", "kernel-sources.ts"), "utf8");
  assert.ok(kernel.includes('\\"dotsGlobal\\",\\"arrowSize\\"]);'), "kernel-sources.ts: model.js con arrowSize (npm run sync:kernel)");
  const svg = fs.readFileSync(path.join(mcp, "src", "svg.ts"), "utf8").replace(/\r\n/g, "\n");
  assert.match(svg, /export const ARROW_SIZE_MIN = 1, ARROW_SIZE_MAX = 2;/);
  assert.match(svg, /const s = size \|\| 1, len = EDGE_HEAD_LEN \* s, half = EDGE_HEAD_HALF \* s, k = \(EDGE_HEAD_LEN - EDGE_HEAD_NOTCH\) \* s;/);
  assert.match(svg, /cut = EDGE_GAP \+ \(EDGE_HEAD_LEN - EDGE_HEAD_NOTCH\) \* size;/);
  for (const f of ["src/model.ts", "src/authoring.ts"]) assert.ok(fs.readFileSync(path.join(mcp, f), "utf8").includes("arrowSize"), f);
});
