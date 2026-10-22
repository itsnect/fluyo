"use strict";
/* FLUYO-019.4b — La piel «construido» en el editor (decisión 226). Contratos en vm, contra la base eff5129.
   · P1 / un solo predicado: editorSkinOn() = skinActive(projectSkin(settings), viewZoom), el mismo que render() resuelve con
     el viewport que le pasa buildEditorRenderState (viewport.skin = editorSkin()). Umbral 0,375: a 0,37 todo plano, a 0,38 todo
     con la piel (pintado, caras, puerto, voz).
   · Plano idéntico (Q1 en vm): con el documento plano, o «built» por debajo del umbral, el registro COMPLETO de operaciones del
     lienzo de render() (con nodo, conexión y multiselección, puerto en hover, «Conectar», marco rectangular) es el de eff5129
     operación a operación; y el acierto (hitTarget, hitNode, hitLeafNode, hitContainerNode, hitSideArrowHost, hitEdgeEnd,
     hitCorner, hitWaypoint, hitSegment) da lo mismo en una rejilla, con ratón y con dedo, y el textarea la misma geometría.
   · P3 / F8 (Q6): área de acierto = caja + 4 ∪ skinExtent; rejilla sobre la tapa y el lateral de una hoja dentro de un
     contenedor con una conexión que entra por el norte: la hoja gana donde la tapa la tapa, la conexión fuera, el contenedor
     en el resto. Formas sin piel: solo la caja + 4.
   · P2 / F5 (Q7): con la piel, hojas y contenedores se aciertan en el orden de pintado al revés (nodePaintLayers = la lista
     que pinta render()); «Traer al frente» no cambia el acierto entre hojas con piel (en plano sí).
   · N1/N2 (Q5): el tirador del destino se pinta en la punta aterrizada y se acierta en todo su círculo (centro y borde) a zoom
     0,375, 1 y 2,5, con ratón y con dedo; con un icono por el este el centro queda fuera del radio lógico (N1).
   · F7: el puerto se aparta lo que sobresale la silueta (connectPortLift): su área de acierto no pisa la tapa ni el lateral a
     ningún zoom (0,375–5); el puerto pintado es el acertado. La base lo pisa a zoom 2,5.
   · F9 (Q8 en vm): el textarea usa la voz del rótulo pintado: el `font` con el que drawLabelLines escribe la primera línea es
     exactamente el que compone la geometría del textarea, y su línea base es la del textarea (boxY + lh/2).
   · F6 / P4 (Q4 en vm): con la piel, el marco y los tiradores de nodos y conexión salen en una pasada final, después de todos
     los nodos y cues; los de la conexión sobre sus puntos pintados; el marco en la caja lógica ±6.
   · Alcance frente a eff5129 (archivos servidos): render.js, interaction.js, geometry.js (connectPortPoint), editor-runtime.js,
     state.js e index.html (comentarios y el texto de #skinSel), y sw.js (CACHE v95). skin.js, export.js, model.js, selection.js,
     editor-scenarios.js, flow-semantics.js y el Viewer, idénticos. Lo que necesita lienzo real (píxeles, Present, eventos,
     Historia, service worker) lo mide test/fluyo-019-4b-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { undo4b, BASE4B } = require("./fluyo-019-4b-undo.cjs");
const { undo3: undo3only } = require("./fluyo-scenarios-semantics-3-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 3 cambia a propósito model.js, document-integrity.js, story-authoring.js, flow-semantics.js, editor-scenarios.js, index.html, styles.css y sw.js (precache): se deshace aquí, antes que todo lo demás; su alcance lo vigila test/fluyo-scenarios-semantics-3.test.cjs */
const { undoReverse } = require("./fluyo-step-reverse-002-undo.cjs");   /* FLUYO-STEP-REVERSE-002 cambia a propósito model.js, scenario-engine.js, story-playback.js, scenario-playback.js, story-authoring.js, document-integrity.js, render.js, editor-scenarios.js y selection.js: se deshace aquí, antes que FASE 3; su alcance lo vigila test/fluyo-step-reverse-002.test.cjs */
const { undoReverseUi } = require("./fluyo-step-reverse-003-undo.cjs");   /* FLUYO-STEP-REVERSE-003 añade «Invertir sentido» a editor-scenarios.js: se deshace aquí, antes que 002; su alcance lo vigila test/fluyo-step-reverse-003.test.cjs */
const { undo4: undo4only } = require("./fluyo-scenarios-semantics-4-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 4 va encima de STEP-REVERSE-003: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-4.test.cjs */
const { undoMsg56: undo5 } = require("./fluyo-step-message-001-undo.cjs");   /* SCENARIOS-SEMANTICS-001 FASE 5 va encima de FASE 4: se deshace antes; su alcance lo vigila test/fluyo-scenarios-semantics-5.test.cjs */
const undo4 = (f, src) => undo4only(f, undo5(f, src));
const undo3 = (f, src) => undo3only(f, undoReverse(f, undoReverseUi(f, undo4(f, src))));
const root = path.resolve(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE4B + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };
const J = (v) => JSON.parse(JSON.stringify(v));

/* ───────── contexto: el producto real en vm (kernel, geometría, piel, pintor, bloques de acierto y textarea, predicado) ───────── */
function ctxFrom(get) {
  const G = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console,
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } } });
  for (const f of ["config.js", "safe-svg.js", "model.js", "geometry.js", "skin.js", "render.js"]) vm.runInContext(get("js/" + f), G, { filename: f });
  vm.runInContext("var viewZoom=1, viewX=0, viewY=0, __touch=false; function isTouch(){ return __touch; }", G);
  const I = get("js/interaction.js");
  vm.runInContext(between(I, "function normRect(", "/* ===================== Acierto"), G, { filename: "interaction.js#rect" });
  vm.runInContext(between(I, "function nodeBoxHit(", "/* Esquinas y codos"), G, { filename: "interaction.js#hit" });
  vm.runInContext(between(I, "function cornerHitRadius(", "/* Sobre qué eje se mueve un tramo"), G, { filename: "interaction.js#instr" });
  vm.runInContext(between(I, "function editBoxGeometry(", "/* Escribe la geometría"), G, { filename: "interaction.js#edit" });
  const R = get("js/editor-runtime.js");
  if (R.includes("function editorSkin(")) vm.runInContext(between(R, "function editorSkin(", "\nfunction buildEditorRenderState"), G, { filename: "editor-runtime.js#skin" });
  /* lienzo que mide (el textarea mide con ctx): Plex más ancha que Georgia, para que la voz cambie también la maquetación */
  vm.runInContext(`var ctx={ font:"", measureText(s){ const m=/([\\d.]+)px/.exec(this.font), fs=m? +m[1] : 13; return {width:String(s).length*fs*(/Plex/.test(this.font)? .6 : .5)}; } };`, G);
  /* registro de TODAS las operaciones de un contexto 2D (métodos con argumentos y escrituras de propiedades) */
  vm.runInContext(`function __rec(){ const log=[]; const t={ log, canvas:{width:1440,height:900}, font:"",
      measureText(s){ log.push(["measureText",String(s),this.font]); const m=/([\\d.]+)px/.exec(this.font), fs=m? +m[1] : 13; return {width:String(s).length*fs*(/Plex/.test(this.font)? .6 : .5)}; },
      createRadialGradient(){ log.push(["grad"].concat([].slice.call(arguments))); return {addColorStop(){ log.push(["stop"].concat([].slice.call(arguments))); }}; } };
    return new Proxy(t,{ get:(o,k)=> (k in o) ? o[k] : ((...a)=>{ log.push([k].concat(a.map(v=> v && typeof v==="object" ? JSON.stringify(v) : v))); }),
                         set:(o,k,v)=>{ log.push(["="+String(k), v && typeof v==="object" ? JSON.stringify(v) : v]); o[k]=v; return true; } }); }`, G);
  return G;
}
const NOW = ctxFrom(read), OLD = ctxFrom(atBase);
const run = (G, code, arg) => { G.__a = arg === undefined ? null : J(arg); return J(vm.runInContext(code, G)); };
const load = (G, page, set) => run(G, "doc.pages=[__a.page]; doc.cur=0; doc.theme=__a.theme||'crema'; doc.customBg=''; settings=Object.assign({},DEFAULT_SETTINGS,{build:false,single:false,grid:false},__a.set||{}); if(!__a.skin) delete settings.skin; else settings.skin=__a.skin; edgeLabelPos=new Map(); SKIN_LANDING_T.clear(); true", { page, set, skin: set && set.skin, theme: set && set.theme });
const view = (G, zoom, touch) => run(G, `viewZoom=${zoom}; __touch=${!!touch}; true`);

/* ───────── fixtures ───────── */
const N = (id, x, y, w, h, ex) => Object.assign({ id, shape: "rect", x, y, w, h, label: "N" + id, color: "#6a9fb5", fill: null, border: "solid", lblPos: "center", textBg: null, textColor: null, font: null, bold: false, pulse: false, tint: false, order: id }, ex || {});
const E = (id, from, to, ex) => Object.assign({ id, from, to, route: "ortho", waypoints: [], label: "", font: null, bold: false, animated: true, dashed: false, startArrow: false, endArrow: true, flowDir: "normal" }, ex || {});
const PAGE = (nodes, edges) => ({ name: "P", nodes, edges, nextId: 999, behaviors: [], scenarios: [], nextScenarioId: 1 });
/* hoja dentro de un contenedor, con una conexión que entra por el norte (Q6) y otra por el este */
const ZONE = () => PAGE([N(1, 500, 400, 600, 400, { label: "Zona", border: "dashed", fill: "none" }), N(2, 500, 420, 160, 80, { label: "Hoja" }),
  N(3, 500, 120, 120, 60, { label: "Arriba" }), N(4, 900, 420, 120, 60, { label: "Este" }), N(5, 330, 300, 100, 60, { label: "Vecina" })],
  [E(10, 3, 2, { fromSide: "s", toSide: "n" }), E(11, 4, 2, { fromSide: "w", toSide: "e" }), E(12, 5, 2, { route: "straight" })]);
/* catálogo: formas con y sin piel, conexiones ortogonales por n/e/s/w, recta, paralelas, etiqueta, codos */
const SHAPES = ["rect", "cylinder", "icon", "circle", "diamond", "hex", "text", "code", "image", "anim"];
function catalog() {
  const nodes = [], edges = [], cases = []; let id = 1;
  SHAPES.forEach((sh, i) => {
    const X = 260 + i * 460, Y = 460;
    const B = N(id++, X, Y, 140, 92, { shape: sh, label: sh, icon: sh === "icon" ? "kafka" : undefined, code: sh === "code" ? "x = 1" : undefined, anim: sh === "anim" ? "spinner" : undefined });
    nodes.push(B);
    const src = { n: N(id++, X - 120, Y - 260, 100, 60), e: N(id++, X + 250, Y - 160, 100, 60), s: N(id++, X + 120, Y + 260, 100, 60), w: N(id++, X - 250, Y + 160, 100, 60) };
    const from = { n: "s", e: "n", s: "n", w: "s" };
    for (const side of ["n", "e", "s", "w"]) {
      nodes.push(src[side]);
      const e = E(id++, src[side].id, B.id, { fromSide: from[side], toSide: side });
      edges.push(e); cases.push({ k: sh + "-" + side, shape: sh, side, id: e.id, B: B.id });
    }
  });
  const a = N(id++, 200, 900, 120, 60), b = N(id++, 600, 900, 120, 60), c = N(id++, 600, 1150, 120, 60);
  nodes.push(a, b, c);
  edges.push(E(id++, a.id, b.id, { route: "straight", label: "recta" }), E(id++, a.id, b.id, { fromSide: "e", toSide: "w" }), E(id++, b.id, a.id, { fromSide: "w", toSide: "e", dashed: true }),
    E(id++, a.id, c.id, { waypoints: [{ x: 260, y: 1150 }], label: "codo" }));
  return { page: PAGE(nodes, edges), cases };
}
/* solapes: hojas que se pisan (unas en orden y/x contrario al del documento), vecinas a 6 u y dos contenedores que se solapan sin
   anidar; Z2 es más pequeño pero se pinta ANTES (y menor), así que en el solape se ve Z1: el acierto por área elegiría Z2 */
const OVERLAP = () => PAGE([N(1, 400, 300, 140, 90, { label: "A" }), N(2, 460, 260, 140, 90, { label: "B" }), N(3, 520, 340, 140, 90, { label: "C" }),
  N(4, 690, 300, 120, 80, { label: "D" }), N(5, 816, 300, 120, 80, { label: "E" }), N(6, 410, 600, 300, 220, { label: "Z1", fill: "none" }),
  N(7, 600, 580, 260, 200, { label: "Z2", fill: "none" }), N(8, 380, 600, 80, 50, { label: "h1" }), N(9, 640, 660, 80, 50, { label: "h2" }), N(10, 520, 625, 80, 50, { label: "h3" })], []);

/* ───────── P1: un solo predicado ───────── */
test("P1 · editorSkinOn = skinActive(projectSkin(settings), viewZoom) y es el rs.skinOn de render() con el viewport del editor; umbral 0,375", () => {
  const seen = [];
  for (const skin of ["built", "flat", undefined, "BUILT", 1]) for (const z of [0.3, 0.37, 0.374, 0.375, 0.38, 1, 2.5, 5]) {
    load(NOW, ZONE(), { skin }); view(NOW, z);
    const on = run(NOW, "editorSkinOn()"), want = run(NOW, "skinActive(projectSkin(settings), viewZoom)");
    const rs = run(NOW, "(()=>{ const rs=makeReadOnlyRenderState({x:0,y:0,zoom:viewZoom,width:800,height:600,skin:editorSkin()}); render(__rec(),0,{renderState:rs}); return rs.skinOn; })()");
    assert.equal(on, want, `${skin} @${z}`); assert.equal(rs, on, `render() = editorSkinOn ${skin} @${z}`);
    seen.push(on);
    if (skin === "built") assert.equal(on, z >= 0.375, "umbral SKIN_MIN_PX/SKIN_DEPTH = 0,375 (" + z + ")");
    else assert.equal(on, false, "solo \"built\" (" + JSON.stringify(skin) + ")");
  }
  assert.ok(seen.includes(true) && seen.includes(false));
  const rt = read("js/editor-runtime.js");
  assert.match(rt, /function editorSkin\(\)\{ return projectSkin\(settings\); \}\nfunction editorSkinOn\(\)\{ return typeof skinActive==="function" && skinActive\(editorSkin\(\), viewZoom\); \}/);
  assert.match(rt, /      skin: editorSkin\(\)\},/, "buildEditorRenderState pasa editorSkin() al viewport, también fuera de Present");
  /* nadie más decide la piel por su cuenta: interaction.js solo pregunta a editorSkinOn (vía skinHitOn) y render.js no lee settings.skin */
  const I = read("js/interaction.js");
  assert.ok(!/settings\.skin|projectSkin|skinActive\(/.test(I), "interaction.js no decide la piel");
  const code = I.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.deepEqual(code.split("\n").filter((l) => l.includes("editorSkinOn")), ['function skinHitOn(){ return typeof editorSkinOn==="function" && editorSkinOn(); }'], "skinHitOn es el único lector");
  assert.ok(!/settings\.skin|projectSkin/.test(read("js/render.js")), "render.js recibe la piel como argumento");
});

/* ───────── plano idéntico a eff5129 ───────── */
function renderLog(G, page, set, rsx) {
  load(G, page, set); view(G, rsx.zoom);
  return run(G, `(()=>{ const a=__a, rs=makeReadOnlyRenderState({x:a.x,y:a.y,zoom:a.zoom,width:1440,height:900,dpr:1,presenting:false,skin:a.skin});
    rs.selection.nodes=new Set(a.selN); rs.selection.edges=new Set(a.selE);
    rs.selection.single=a.single? {type:a.single.type, obj:(a.single.type==="node"? nodeById : (id=>P().edges.find(e=>e.id===id)))(a.single.id)} : null;
    if(a.hover){ rs.interaction.hoverNode=nodeById(a.hover); rs.selection.arrowHost=nodeById(a.hover); }
    rs.interaction.mouse=a.mouse||{x:0,y:0}; rs.interaction.marquee=a.marquee||null; rs.interaction.linkFrom=a.linkFrom===undefined? null : a.linkFrom;
    const c=__rec(); render(c, 0.6, {renderState:rs}); return c.log; })()`, rsx);
}
const FLAT_STATES = (cat) => [
  { zoom: 1, x: 0, y: 0, skin: "flat", selN: [cat.cases[0].B], selE: [], single: { type: "node", id: cat.cases[0].B }, hover: cat.cases[0].B, mouse: { x: 260, y: 380 } },
  { zoom: 1, x: -40, y: 10, skin: "flat", selN: [], selE: [cat.cases[1].id], single: { type: "edge", id: cat.cases[1].id }, hover: cat.cases[4].B, mouse: { x: 900, y: 460 } },
  { zoom: 2.5, x: -300, y: -900, skin: "flat", selN: [1, 2, 3], selE: [cat.cases[2].id, cat.cases[3].id], single: null, marquee: { x0: 10, y0: 10, x1: 300, y1: 200 }, linkFrom: 2 },
  { zoom: 0.3, x: 0, y: 0, skin: "built", selN: [cat.cases[8].B], selE: [cat.cases[9].id], single: { type: "edge", id: cat.cases[9].id }, hover: cat.cases[8].B, mouse: { x: 1180, y: 380 } },
  { zoom: 0.37, x: 0, y: 0, skin: "built", selN: [cat.cases[0].B], selE: [], single: { type: "node", id: cat.cases[0].B }, hover: cat.cases[0].B, mouse: { x: 260, y: 380 } },
];
test("Q1 (vm) · plano y «built» bajo el umbral: el registro completo de operaciones del lienzo es el de eff5129 (selección, multiselección, puerto, «Conectar», marco)", () => {
  const cat = catalog(); let ops = 0;
  for (const st of FLAT_STATES(cat)) for (const page of [cat.page, ZONE(), OVERLAP()]) {
    const ids = new Set(page.nodes.map((n) => n.id)), es = new Set(page.edges.map((e) => e.id));
    const s = Object.assign({}, st, { selN: st.selN.filter((i) => ids.has(i)), selE: st.selE.filter((i) => es.has(i)) });
    if (s.single && !(s.single.type === "node" ? ids : es).has(s.single.id)) s.single = null;
    if (s.hover && !ids.has(s.hover)) delete s.hover;
    if (s.linkFrom !== undefined && !ids.has(s.linkFrom)) delete s.linkFrom;
    for (const theme of ["crema", "dark"]) {
      const a = renderLog(NOW, page, { skin: s.skin, theme }, s), b = renderLog(OLD, page, { skin: s.skin === "built" ? undefined : s.skin, theme }, Object.assign({}, s, { skin: "flat" }));
      assert.deepEqual(a, b, `zoom ${s.zoom} ${s.skin} ${theme} (${a.length} operaciones)`);
      ops += a.length;
    }
  }
  assert.ok(ops > 20000, "registro sustancial: " + ops + " operaciones");
});
test("Q1 (vm) · plano: el acierto y el textarea son los de eff5129 en una rejilla, con ratón y con dedo (y «built» a zoom 0,37)", () => {
  const cat = catalog();
  for (const [page, set, z] of [[cat.page, {}, 1], [ZONE(), {}, 2.5], [OVERLAP(), {}, 0.5], [ZONE(), { skin: "built" }, 0.37], [OVERLAP(), { skin: "built" }, 0.3]]) for (const touch of [false, true]) {
    load(NOW, page, set); load(OLD, page, {}); view(NOW, z, touch); view(OLD, z, touch);
    assert.equal(run(NOW, "editorSkinOn()"), false);
    const q = `(()=>{ const out=[], ns=P().nodes, es=P().edges, L=o=>o? (o.kind? o.kind+o.obj.id : o.id) : null, B=getBounds();
      for(let x=B.x-30; x<=B.x+B.w+30; x+=Math.max(7, B.w/36)) for(let y=B.y-30; y<=B.y+B.h+30; y+=Math.max(7, B.h/24)){
        const r=[L(hitTarget(x,y)), L(hitNode(x,y)), L(hitLeafNode(x,y)), L(hitContainerNode(x,y)), L(hitSideArrowHost(x,y))];
        for(const n of ns.filter((n,i)=>i%7===0)) r.push(hitSideArrow(n,x,y), hitCorner(n,x,y));
        for(const e of es.filter((e,i)=>i%5===0)) r.push(hitEdgeEnd(e,x,y), hitWaypoint(e,x,y), hitSegment(e,x,y));
        out.push(r.join(","));
      }
      for(const n of ns) out.push(JSON.stringify(editBoxGeometry(n)));
      return out; })()`;
    assert.deepEqual(run(NOW, q), run(OLD, q), `${JSON.stringify(set)} zoom ${z} dedo ${touch}`);
  }
});

/* ───────── P3 / F8: caras ───────── */
test("P3 · área de acierto = caja + 4 ∪ skinExtent en las formas con piel; las sin piel, solo la caja + 4; en plano, solo la caja", () => {
  const cat = catalog(); load(NOW, cat.page, { skin: "built" });
  /* oráculo dentro del vm (una sola llamada): la regla escrita con las primitivas de 019.1 (caja y skinExtent) */
  const r = run(NOW, `(()=>{ const bad=[]; let faces=0;
    for(const id of __a){ const n=nodeById(id), X=skinExtent(n);
      for(let x=n.x-n.w/2-14; x<=n.x+n.w/2+14; x+=1.5) for(let y=n.y-n.h/2-14; y<=n.y+n.h/2+14; y+=1.5){
        const box=Math.abs(x-n.x)<=n.w/2+4 && Math.abs(y-n.y)<=n.h/2+4, ext=!!X && x>=X.x0 && x<=X.x1 && y>=X.y0 && y<=X.y1;
        viewZoom=1; const on=nodeBoxHit(n,x,y); viewZoom=0.3; const off=nodeBoxHit(n,x,y);
        if(on!==(box||ext)) bad.push(n.shape+" on "+x+","+y); if(off!==box) bad.push(n.shape+" off "+x+","+y);
        if(on && !box) faces++;
      }
      if((X===null)!==!skinHasSkin(n)) bad.push(n.shape+": skinExtent");
    } return {bad:bad.slice(0,10), n:bad.length, faces}; })()`, cat.cases.filter((c) => c.side === "n").map((c) => c.B));
  assert.deepEqual(r.bad, [], r.n + " discrepancias");
  assert.ok(r.faces > 300, "puntos de cara que antes eran «muertos»: " + r.faces);
});
test("Q6 (vm) · rejilla sobre la tapa y el lateral de una hoja dentro de un contenedor con una conexión por el norte: hoja donde está la cara, conexión fuera, contenedor en el resto", () => {
  for (const z of [0.375, 1, 2.5]) for (const touch of [false, true]) {
    load(NOW, ZONE(), { skin: "built" }); view(NOW, z, touch);
    const r = run(NOW, `(()=>{ const leaf=nodeById(2), X=skinExtent(leaf), bad=[]; let leafFace=0, edgeOut=0;
      for(let x=X.x0-10; x<=X.x1+10; x+=1) for(let y=X.y0-14; y<=X.y1+6; y+=1){
        const box=Math.abs(x-leaf.x)<=leaf.w/2+4 && Math.abs(y-leaf.y)<=leaf.h/2+4, ext=x>=X.x0 && x<=X.x1 && y>=X.y0 && y<=X.y1;
        const t=hitTarget(x,y), got=t? t.kind+t.obj.id : null, e=hitEdge(x,y);
        const want= box||ext ? "node2" : e ? "edge"+e.id : "node1";
        if(got!==want) bad.push(x+","+y+" "+got+"≠"+want);
        if(want==="node2" && !box) leafFace++; if(want.startsWith("edge")) edgeOut++;
      }
      const top={x:leaf.x, y:leaf.y-leaf.h/2-6}, t=hitTarget(top.x,top.y);
      const z0=viewZoom; viewZoom=0.3; const t0=hitTarget(top.x,top.y); viewZoom=z0;
      return {bad:bad.slice(0,8), n:bad.length, leafFace, edgeOut, top:t.kind+t.obj.id, flat:t0.kind+t0.obj.id}; })()`);
    assert.deepEqual(r.bad, [], `@${z} dedo ${touch}: ${r.n} discrepancias`);
    assert.equal(r.top, "node2", "la conexión que entra por el norte cruza la tapa: ahí gana la cara");
    assert.equal(r.flat, "edge10", "bajo el umbral, la conexión (como en plano)");
    assert.ok(r.leafFace > 100 && r.edgeOut > 10, `cara ${r.leafFace} · conexión fuera ${r.edgeOut}`);
  }
});

/* ───────── P2 / F5: orden ───────── */
test("P2 · con la piel, hojas y contenedores se aciertan en el orden de pintado al revés; «Traer al frente» no cambia el acierto (en plano, sí)", () => {
  const page = OVERLAP();
  load(NOW, page, { skin: "built" }); view(NOW, 1);
  const lay = run(NOW, "(()=>{ const l=nodePaintLayers(P().nodes,true); return {c:l.containers.map(n=>n.id), l:l.leaves.map(n=>n.id)}; })()");
  const live = run(NOW, "(()=>{ const ids=[]; const dn=drawNode; drawNode=function(c,n){ ids.push(n.id); return dn.apply(this,arguments); }; try{ render(__rec(),0,{renderState:makeReadOnlyRenderState({zoom:1,width:900,height:900,skin:'built'})}); } finally{ drawNode=dn; } return ids; })()");
  assert.deepEqual(live, [...lay.c, ...lay.l], "nodePaintLayers es exactamente lo que pinta render()");
  const grid = []; for (let x = 250; x <= 900; x += 5) for (let y = 180; y <= 780; y += 5) grid.push([x, y]);
  const hits = () => run(NOW, `__a.map(([x,y])=>{ const a=hitLeafNode(x,y), b=hitContainerNode(x,y); return [a&&a.id, b&&b.id]; })`, grid);
  /* oráculo: el último de cada capa (en el orden de pintado) cuya caja + 4 ∪ skinExtent contiene el punto */
  const oracle = run(NOW, `(()=>{ const lay=nodePaintLayers(P().nodes,true), cov=(n,x,y)=>{ const X=skinExtent(n); return (Math.abs(x-n.x)<=n.w/2+4 && Math.abs(y-n.y)<=n.h/2+4) || (!!X && x>=X.x0 && x<=X.x1 && y>=X.y0 && y<=X.y1); };
    return __a.map(([x,y])=>{ const l=lay.leaves.filter(n=>cov(n,x,y)), c=lay.containers.filter(n=>cov(n,x,y)), docTop=P().nodes.filter(n=>l.includes(n)).pop();
      return {want:[l.length? l[l.length-1].id : null, c.length? c[c.length-1].id : null], multi:l.length>1, diverge:l.length>1 && docTop!==l[l.length-1], cdiv:c.length>1 && c.reduce((m,n)=>n.w*n.h<m.w*m.h? n : m)!==c[c.length-1]}; }); })()`, grid);
  const got = hits();
  assert.deepEqual(got, oracle.map((o) => o.want), "hoja y contenedor = los de encima en el orden de pintado");
  const multi = oracle.filter((o) => o.multi).length, diverge = oracle.filter((o) => o.diverge).length;
  assert.ok(multi > 100 && diverge > 20, `puntos con dos hojas: ${multi}; donde el orden del documento elegiría otra: ${diverge}`);
  const cdiv = oracle.filter((o) => o.cdiv).length;
  assert.ok(cdiv > 20, `puntos con dos contenedores donde el de menor área NO es el que se pinta encima: ${cdiv}`);
  const arrow = run(NOW, `(()=>{ const out=[]; for(const [x,y] of __a){ const h=hitSideArrowHost(x,y); if(!h) continue; const lay=nodePaintLayers(P().nodes,true), order=[...lay.leaves.slice().reverse(), ...lay.containers.slice().reverse()];
      const first=order.find(n=>hitSideArrow(n,x,y,arrowHitRadius())); out.push(h.id===first.id); } return out; })()`, grid);
  assert.ok(arrow.length > 20 && arrow.every(Boolean), "el puerto: el del nodo pintado encima (" + arrow.length + " puntos)");
  /* dos hojas cuyos puertos por el este se pisan, con el orden del documento al revés que el de pintado: el puerto que se
     acierta es el de la que se pinta encima (con la piel), y el de la última del documento en plano */
  const pair = PAGE([N(21, 300, 708, 100, 60, { label: "abajo" }), N(20, 300, 700, 100, 60, { label: "arriba" })], []);
  load(NOW, pair, { skin: "built" }); view(NOW, 1);
  const hostAt = () => run(NOW, `(()=>{ const q1=connectPortPoint(nodeById(20),"e",1,connectPortLift(nodeById(20),"e",editorSkinOn())), q2=connectPortPoint(nodeById(21),"e",1,connectPortLift(nodeById(21),"e",editorSkinOn()));
    const p={x:(q1.x+q2.x)/2, y:(q1.y+q2.y)/2}, h=hitSideArrowHost(p.x,p.y), top=nodePaintLayers(P().nodes,editorSkinOn()).leaves.slice(-1)[0]; return {h:h&&h.id, top:top.id}; })()`);
  const pb = hostAt();
  assert.deepEqual(pb, { h: 21, top: 21 }, "con la piel: el puerto de la hoja pintada encima (y mayor), no el de la última del documento");
  load(NOW, pair, {}); assert.equal(hostAt().h, 20, "en plano: el de la última del documento, como siempre");
  /* «Traer al frente» (mover al final del documento) de la hoja de abajo: con la piel el acierto no cambia; en plano, sí */
  const front = J(page); const k = front.nodes.findIndex((n) => n.id === 1); front.nodes.push(front.nodes.splice(k, 1)[0]);
  load(NOW, front, { skin: "built" }); view(NOW, 1);
  assert.deepEqual(hits(), got, "con la piel, «Traer al frente» no cambia lo que se acierta (P2: tampoco lo que se ve)");
  load(NOW, page, {}); const flatA = hits(); load(NOW, front, {}); const flatB = hits();
  assert.notDeepEqual(flatA, flatB, "en plano «Traer al frente» sigue cambiando el acierto");
});

/* ───────── N1 / N2: extremos ───────── */
test("N1/N2 (Q5) · el tirador del destino se pinta en la punta aterrizada y se acierta en todo su círculo, a zoom 0,375 / 1 / 2,5, con ratón y con dedo", () => {
  const cat = catalog(); load(NOW, cat.page, { skin: "built" });
  const r = run(NOW, `(()=>{ const bad=[], outside=[]; let partial=0, moved=0;
    for(const z of [0.375,1,2.5]) for(const touch of [false,true]){ viewZoom=z; __touch=touch; const r=endHitRadius(), knob=4.5/z;
      for(const c of __a){ const e=P().edges.find(e=>e.id===c.id), lp=edgePoints(e), vp=edgePaintedPoints(e,true), q=vp[vp.length-1], l=lp[lp.length-1], d=Math.hypot(q.x-l.x,q.y-l.y);
        if(z===1 && !touch){ if(d>0.01) moved++; if(d>=r) outside.push(c.k); }
        if(d+knob>=r) partial++;
        if(hitEdgeEnd(e,q.x,q.y)!=="to") bad.push(c.k+" centro @"+z+" "+touch);
        for(let a=0;a<16;a++){ const p={x:q.x+Math.cos(a/16*2*Math.PI)*knob*.95, y:q.y+Math.sin(a/16*2*Math.PI)*knob*.95}; if(hitEdgeEnd(e,p.x,p.y)!=="to") bad.push(c.k+" borde "+a+" @"+z+" "+touch); }
        if(hitEdgeEnd(e,l.x,l.y)!=="to") bad.push(c.k+" ancla lógica @"+z);
      } }
    return {bad:bad.slice(0,10), n:bad.length, outside, partial, moved}; })()`, cat.cases.map((c) => ({ id: c.id, k: c.k })));
  assert.deepEqual(r.bad, [], r.n + " tiradores sin acierto");
  assert.ok(r.moved >= 4, "conexiones que aterrizan: " + r.moved);
  assert.ok(r.outside.includes("icon-e"), "N1: con un icono por el este, el centro pintado queda fuera del radio lógico con ratón a zoom 1 (" + r.outside + ")");
  assert.ok(r.partial > r.outside.length, "N2: además, en otras el círculo pintado se sale del radio lógico (" + r.partial + ")");
});

/* ───────── F7: puerto ───────── */
function polygonize(segs) {
  const P = []; let cur = null;
  for (const s of segs) {
    if (s.op === "M" || s.op === "L") { cur = { x: s.x, y: s.y }; P.push(cur); }
    else if (s.op === "Q") { for (let i = 1; i <= 32; i++) { const u = i / 32, a = (1 - u) ** 2, b = 2 * u * (1 - u), c = u * u; P.push({ x: a * cur.x + b * s.cx + c * s.x, y: a * cur.y + b * s.cy + c * s.y }); } cur = { x: s.x, y: s.y }; }
    else if (s.op === "A") { let a0 = s.a0, a1 = s.a1; const TAU = 2 * Math.PI; if (s.ccw) { while (a1 > a0) a1 -= TAU; if (a1 === a0) a1 -= TAU; } else { while (a1 < a0) a1 += TAU; if (a1 === a0) a1 += TAU; }
      for (let i = 1; i <= 180; i++) { const a = a0 + (a1 - a0) * i / 180; P.push({ x: s.cx + s.rx * Math.cos(a), y: s.cy + s.ry * Math.sin(a) }); } cur = P[P.length - 1]; }
  }
  return P;
}
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
test("F7 · el puerto se aparta lo que sobresale la silueta: su área de acierto nunca pisa tapa ni lateral (0,375–5); el puerto pintado es el acertado; la base la pisa", () => {
  const cat = catalog(); load(NOW, cat.page, { skin: "built" }); load(OLD, cat.page, {});
  const lifts = {};
  let baseOverlap = 0;
  for (const c of cat.cases.filter((c) => c.side === "n")) {
    const sil = run(NOW, `skinSilhouette(nodeById(${c.B}))`).map((l) => ({ p: polygonize(l.segs), c: l.clip ? polygonize(l.clip) : null }));
    const inside = (q) => sil.some((l) => inPoly(q, l.p) && (!l.c || inPoly(q, l.c)));
    for (const side of ["n", "e", "s", "w"]) {
      lifts[c.shape + "-" + side] = +run(NOW, `connectPortLift(nodeById(${c.B}),"${side}",true)`).toFixed(3);
      assert.equal(run(NOW, `connectPortLift(nodeById(${c.B}),"${side}",false)`), 0, "sin piel, 0");
      for (const z of [0.375, 0.5, 1, 1.5, 2.25, 2.5, 3, 5]) {
        view(NOW, z); view(OLD, z);
        const q = run(NOW, `connectPortPoint(nodeById(${c.B}),"${side}",${z},connectPortLift(nodeById(${c.B}),"${side}",true))`), r = run(NOW, "arrowHitRadius()");
        const ring = [q, ...Array.from({ length: 48 }, (_, i) => ({ x: q.x + Math.cos(i / 48 * 2 * Math.PI) * r, y: q.y + Math.sin(i / 48 * 2 * Math.PI) * r }))];
        assert.ok(!ring.some(inside), `${c.shape}-${side} @${z}: el área del puerto no pisa la silueta`);
        assert.equal(run(NOW, `hitSideArrow(nodeById(${c.B}),${q.x},${q.y})`), side, `${c.shape}-${side} @${z}: el puerto pintado se acierta`);
        const q0 = run(OLD, `connectPortPoint(nodeById(${c.B}),"${side}",${z})`), r0 = run(OLD, "arrowHitRadius()");
        if ([q0, ...Array.from({ length: 48 }, (_, i) => ({ x: q0.x + Math.cos(i / 48 * 2 * Math.PI) * r0, y: q0.y + Math.sin(i / 48 * 2 * Math.PI) * r0 }))].some(inside)) baseOverlap++;
      }
    }
  }
  assert.equal(lifts["rect-n"], 8); assert.equal(lifts["rect-e"], 8); assert.equal(lifts["rect-s"], 0); assert.equal(lifts["rect-w"], 0);
  for (const s of ["n", "e", "s", "w"]) { assert.equal(lifts["cylinder-" + s], 0, "cilindro " + s); for (const f of ["circle", "diamond", "hex", "text", "code", "image", "anim"]) assert.equal(lifts[f + "-" + s], 0, f + " " + s); }
  assert.ok(lifts["icon-e"] > 8, "icono por el este: la peana (" + lifts["icon-e"] + ")");
  /* el filete y el punto que pinta drawConnectPort son el puerto acertado */
  view(NOW, 2.5);
  const drawn = run(NOW, `(()=>{ const n=P().nodes.find(n=>n.shape==="rect"&&n.label==="rect"), rs=makeReadOnlyRenderState({zoom:2.5,width:900,height:900,skin:"built"}); rs.skinOn=true;
    rs.interaction.mouse={x:n.x, y:n.y-n.h/2-30}; const c=__rec(); drawConnectPort(c,n,rs); const arc=c.log.find(o=>o[0]==="arc"); return {id:n.id, x:arc[1], y:arc[2]}; })()`);
  assert.equal(run(NOW, `hitSideArrow(nodeById(${drawn.id}),${drawn.x},${drawn.y})`), "n");
  assert.ok(baseOverlap > 10, "BASE (reproduce F7): el área del puerto pisa la silueta en " + baseOverlap + " casos");
});

/* ───────── F9: la voz del textarea ───────── */
test("F9 (Q8 en vm) · el textarea compone exactamente el `font` y la línea base con que drawLabelLines pinta el rótulo; sin piel o con fuente propia, el de siempre", () => {
  const nodes = [N(1, 200, 200, 160, 70, { label: "Servicio de pagos" }), N(2, 500, 200, 160, 70, { label: "Negrita", bold: true }), N(3, 800, 200, 160, 70, { label: "Propia", font: "Georgia, serif" }),
    N(4, 200, 450, 120, 120, { shape: "cylinder", label: "Base\nde datos" }), N(5, 500, 450, 120, 120, { shape: "circle", label: "Círculo" }), N(6, 800, 450, 160, 70, { label: "Arriba", lblPos: "top" }),
    N(7, 200, 700, 160, 70, { label: "Una línea larga que parte en varias", fs: 15 })];
  const painted = (G, id, zoom) => run(G, `(()=>{ const n=nodeById(${id}), rs=makeReadOnlyRenderState({zoom:${zoom},width:900,height:900,skin:projectSkin(settings)}); rs.skinOn=skinActive(projectSkin(settings), ${zoom});
    const c=__rec(); drawNode(c,n,0,doc.theme,false,rs); let f=null; for(const o of c.log){ if(o[0]==="=font") f=o[1]; if(o[0]==="fillText") return {font:f, y:o[3]}; } return null; })()`);
  const compose = (g, fs) => (g.peso === "normal" ? "" : g.peso + " ") + g.fs + "px " + g.fam;
  for (const [set, z, voiced] of [[{ skin: "built" }, 1, true], [{ skin: "built" }, 2.5, true], [{ skin: "built" }, 0.37, false], [{}, 1, false], [{ skin: "built", font: "Inter, sans-serif" }, 1, false]]) {
    load(NOW, PAGE(nodes, []), set); view(NOW, z);
    for (const n of nodes) {
      const g = run(NOW, `editBoxGeometry(nodeById(${n.id}))`), p = painted(NOW, n.id, z);
      assert.equal(compose(g), p.font, `${n.label} ${JSON.stringify(set)} @${z}: misma voz`);
      assert.ok(Math.abs(g.y + g.lh / 2 - p.y) < 1e-9, `${n.label} @${z}: misma línea base (${g.y + g.lh / 2} / ${p.y})`);
      const plex = /Plex/.test(g.fam);
      assert.equal(plex, voiced && !n.font && n.shape !== "circle", `${n.label} ${JSON.stringify(set)} @${z}: Plex solo con la piel, sin fuente propia y en formas con piel`);
      if (plex) assert.equal(g.peso, n.bold ? "bold" : "500");
    }
  }
  /* sin piel, el textarea es el de eff5129 (incluido el respaldo de familia y peso) */
  load(NOW, PAGE(nodes, []), {}); load(OLD, PAGE(nodes, []), {});
  for (const n of nodes) assert.deepEqual(run(NOW, `editBoxGeometry(nodeById(${n.id}))`), run(OLD, `editBoxGeometry(nodeById(${n.id}))`));
});

/* ───────── F6 / P4: pasada final ───────── */
test("F6/P4 (Q4 en vm) · con la piel, marco y tiradores salen después de todos los nodos y cues; los de la conexión sobre sus puntos pintados; en plano, donde siempre", () => {
  const cat = catalog();
  const order = (skin, sel) => {
    load(NOW, cat.page, { skin }); view(NOW, 1);
    return run(NOW, `(()=>{ const ev=[], a=__a, w=(name)=>{ const f=globalThis[name]; globalThis[name]=function(){ ev.push([name, arguments[1] && arguments[1].id!==undefined ? arguments[1].id : null, name==="drawEdgeHandles"? arguments[2] : null]); return f.apply(this,arguments); }; return ()=>{ globalThis[name]=f; }; };
      const un=["drawNode","drawEdge","drawNodeSelection","drawEdgeHandles","drawScenarioNodeCue"].map(w);
      try{ const rs=makeReadOnlyRenderState({zoom:1,width:1440,height:900,skin:projectSkin(settings)}); rs.selection.nodes=new Set(a.selN); rs.selection.edges=new Set([a.edge]);
        rs.selection.single={type:"edge", obj:P().edges.find(e=>e.id===a.edge)}; const c=__rec(); render(c,0.5,{renderState:rs});
        const arcs=c.log.filter(o=>o[0]==="arc").map(o=>({x:o[1],y:o[2]})); return {ev, arcs}; } finally{ un.forEach(u=>u()); } })()`, sel);
  };
  for (const c of cat.cases.filter((c) => ["rect-n", "rect-e", "icon-e", "cylinder-n"].includes(c.k))) {
    const sel = { selN: [c.B, c.B + 1], edge: c.id };
    const built = order("built", sel), flat = order(undefined, sel);
    const lastNode = Math.max(...built.ev.map((e, i) => e[0] === "drawNode" ? i : -1));
    const marks = built.ev.map((e, i) => [e, i]).filter(([e]) => e[0] === "drawNodeSelection" || e[0] === "drawEdgeHandles");
    assert.ok(marks.length === sel.selN.length + 1 && marks.every(([, i]) => i > lastNode), c.k + ": con la piel, las marcas después del último nodo");
    const hp = marks.find(([e]) => e[0] === "drawEdgeHandles")[0][2];
    const vp = run(NOW, `edgePaintedPoints(P().edges.find(e=>e.id===${c.id}),true)`);
    assert.deepEqual(hp, vp, c.k + ": los tiradores reciben los puntos pintados");
    assert.ok(built.arcs.some((a) => a.x === vp[vp.length - 1].x && a.y === vp[vp.length - 1].y), c.k + ": el círculo del extremo se pinta en la punta aterrizada");
    /* en plano: drawNodeSelection justo después de su drawNode y drawEdgeHandles dentro de drawEdge, sobre la ruta lógica */
    for (const id of sel.selN) { const i = flat.ev.findIndex((e) => e[0] === "drawNode" && e[1] === id); assert.deepEqual(flat.ev[i + 1].slice(0, 2), ["drawNodeSelection", id], c.k + ": en plano, el marco dentro de drawNode"); }
    const j = flat.ev.findIndex((e) => e[0] === "drawEdgeHandles");
    assert.equal(flat.ev[j - 1][0], "drawEdge", c.k + ": en plano, los tiradores dentro de drawEdge");
    assert.deepEqual(flat.ev[j][2], run(NOW, `edgePoints(P().edges.find(e=>e.id===${c.id}))`));
  }
  /* marco y tiradores del nodo en la caja lógica ±6 (P4), también con la piel */
  load(NOW, ZONE(), { skin: "built" });
  const rects = run(NOW, `(()=>{ const n=nodeById(2), rs=makeReadOnlyRenderState({zoom:1,width:900,height:900,skin:"built"}); rs.skinOn=true; rs.selection.nodes=new Set([2]); rs.selection.single={type:"node",obj:n};
    const c=__rec(); drawNodeSelection(c,n,"crema",rs); return {frame:c.log.find(o=>o[0]==="strokeRect").slice(1), corners:c.log.filter(o=>o[0]==="rect").map(o=>[o[1]+HANDLE/2,o[2]+HANDLE/2])}; })()`);
  assert.deepEqual(rects.frame, [500 - 80 - 6, 420 - 40 - 6, 172, 92]);
  assert.deepEqual(rects.corners, run(NOW, "nodeCorners(nodeById(2))"));
});

/* ───────── alcance ───────── */
test("alcance · frente a eff5129 solo cambian render.js, interaction.js, geometry.js (connectPortPoint), editor-runtime.js, state.js e index.html (comentario y #skinSel) y sw.js (CACHE v95)", () => {
  const served = ["js/render.js", "js/interaction.js", "js/geometry.js", "js/editor-runtime.js", "js/state.js", "index.html"];
  for (const f of served) assert.equal(undo4b(f, undo3(f, read(f))), atBase(f), f + ": fuera de lo de 019.4b, idéntico");
  for (const f of ["js/skin.js", "js/export.js", "js/model.js", "js/config.js", "js/selection.js", "js/ui.js", "js/editor-scenarios.js", "js/flow-semantics.js", "js/story-authoring.js",
    "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/viewer.js", "js/present-story.js", "js/share-url.js", "js/deeplink.js",
    "s/index.html", "css/styles.css", "css/system.css", "css/identity.css", "css/share.css", "manifest.webmanifest"])
    if (fs.existsSync(path.join(root, f))) assert.equal(undo3(f, read(f)), atBase(f), f + " idéntico");
  const sw = undo3("sw.js", read("sw.js"));
  assert.match(sw, /const CACHE = "fluyo-static-v103";/);
  assert.equal(sw.replace('"fluyo-static-v103"', '"fluyo-static-v' + (95 - 1) + '"'), atBase("sw.js"), "sw.js: solo sube CACHE (sin archivos nuevos)");
  /* geometry.js: solo el parámetro `lift` de connectPortPoint (por defecto 0: en plano el mismo punto) */
  const g = read("js/geometry.js");
  assert.match(g, /function connectPortPoint\(n, side, zoom, lift=0\)\{\n  const p=sidePoint\(n,side\), d=DIR\[side\], off=lift\+CONNECT_PORT_OFF\/\(zoom\|\|1\);/);
  /* index.html: solo el comentario y el title de #skinSel (ningún mando nuevo, P1) */
  const ih = undo3("index.html", read("index.html")), ib = atBase("index.html");
  assert.equal(ih.split("\n").length, ib.split("\n").length);
  assert.deepEqual(ih.split("\n").filter((l, i) => l !== ib.split("\n")[i]).map((l) => l.trim().slice(0, 30)), ["<!-- FLUYO-019.2/019.4b: aspec", '<select id="skinSel" title="As']);
  assert.ok(!/id="skin(Btn|Toggle|Edit)/.test(ih), "sin mando nuevo");
});
test("alcance · la piel del editor no amplía Semantic Scenarios ni toca el documento: kernel, flow-semantics, export, MCP fuera", () => {
  const r = read("js/render.js"), i = read("js/interaction.js");
  for (const s of ["FLOWS_TO", "REQUIRES", "AVAILABLE", "UNAVAILABLE", "NO_PATH", "observedFlow"]) assert.equal((undo4b("js/render.js", r).match(new RegExp(s, "g")) || []).length, (r.match(new RegExp(s, "g")) || []).length, "render.js: 019.4b no toca " + s);
  assert.ok(!/pushUndo|scheduleAutosave|settings\.skin\s*=/.test(between(i, "function nodeBoxHit(", "/* Esquinas y codos")), "el acierto no escribe");
  assert.ok(!/drawEditorMarks/.test(read("js/export.js")) && !/drawEditorMarks/.test(read("js/viewer.js")), "las marcas del editor no salen en la exportación ni en el Viewer");
});
