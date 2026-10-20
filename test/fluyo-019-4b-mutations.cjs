"use strict";
/* FLUYO-019.4b — Mutaciones sobre COPIAS aisladas (nunca sobre el árbol). Cada regresión real de la piel en el editor (caras,
   pasada final, predicado único, extremos, puerto, voz del textarea, orden de acierto) o un cambio colado en el plano debe
   hacer fallar su suite:
   · U*: test/fluyo-019-4b.test.cjs (vm, ~40 s).
   · B*: test/fluyo-019-4b-browser.cjs en Chrome real, con la base eff5129.
   Uso: node test/fluyo-019-4b-mutations.cjs   (Playwright vía NODE_PATH; SKIP_BROWSER=1 solo las U; ONLY_MUT=U3 una, ONLY_MUT=B todas las de Chrome) */
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const NL = "\n", CRLF = "\r\n";

const UNIT = ["--test", "test/fluyo-019-4b.test.cjs"];
const BROWSER = ["test/fluyo-019-4b-browser.cjs"];
const REN = "js/render.js", INT = "js/interaction.js", RT = "js/editor-runtime.js";
const FACES = "  const X=skinHitOn() && nodeSkinExtent(n,true);";
const PASS = "  if(rs.skinOn) drawEditorMarks(c,t,theme,rs);";
const PRED = 'function editorSkinOn(){ return typeof skinActive==="function" && skinActive(editorSkin(), viewZoom); }';
const END = "  const v=skinHitOn() ? edgePaintedPoints(e,true) : null;";
const LEAF = "  if(skinHitOn()){ const L=nodePaintLayers(ns,true).leaves; for(let i=L.length-1;i>=0;i--) if(nodeBoxHit(L[i],x,y)) return L[i]; return null; }\n";
const CONT = "  if(skinHitOn()){ const C=nodePaintLayers(ns,true).containers; for(let i=C.length-1;i>=0;i--) if(nodeBoxHit(C[i],x,y)) return C[i]; return null; }\n";
const HOST = "  if(skinHitOn()){ const L=nodePaintLayers(ns,true); leaves.push(...L.leaves.slice().reverse()); conts.push(...L.containers.slice().reverse()); }\n  else {";
const PORT_HIT = "connectPortPoint(n,s,viewZoom, skinHitOn()? connectPortLift(n,s,true) : 0)";
const LIFT = '  if(!skinOn || typeof skinEdgeLanding!=="function" || !skinHasSkin(n)) return 0;';
const VOICE = "  const fo=skinHitOn() ? nodeLabelVoice(o,true) : null;";
const MEASURE = "  const L=labelLayout(o, measureNodeLabel(ctx,o,fo));";
const INLINE_N = "  if(!isExport && !rs.skinOn) drawNodeSelection(c,n,theme,rs);";
const INLINE_E = "  if(single && !rs.skinOn) drawEdgeHandles(c,e,pts,M,zoom);";
const MARK_PTS = "  const pts=edgePaintedPoints(e, rs.skinOn); if(pts.length<2) return;";
const VIEWPORT = "      skin: editorSkin()},";
const VOICE_SHAPES = '  return skinOn && typeof skinHasSkin==="function" && skinHasSkin(n) ? skinLabelFont(n, settings.font) : null;';
const SIG = '+"|"+skinHitOn();   /* la piel cambia la voz (F9) */';
/* [nombre, suite, archivo, desde, hasta] — o [nombre, suite, archivo, [[desde, hasta], …]] para una mutación de varios puntos */
const MUTATIONS = [
  ["U0 CACHE no sube (sigue v94)", UNIT, "sw.js", 'const CACHE = "fluyo-static-v99";', 'const CACHE = "fluyo-static-v94";'],
  ["U1 sin área de caras (vuelve F8)", UNIT, INT, FACES, "  const X=null;"],
  ["U2 sin pasada final (las marcas no salen con la piel)", UNIT, REN, PASS, ""],
  ["U3 predicado desacoplado (el acierto ignora el umbral de zoom)", UNIT, RT, PRED, 'function editorSkinOn(){ return editorSkin()==="built"; }'],
  ["U4 el extremo solo se acierta en la geometría lógica (vuelve N1)", UNIT, INT, END, "  const v=null;"],
  ["U5 las hojas se aciertan en el orden del documento (vuelve F5)", UNIT, INT, LEAF, ""],
  ["U6 los contenedores se aciertan por área, no por pintado", UNIT, INT, CONT, ""],
  ["U7 el puerto se acierta sin apartarse (dibujo y acierto divergen)", UNIT, INT, PORT_HIT, "connectPortPoint(n,s,viewZoom, 0)"],
  ["U8 el puerto no se aparta de la silueta (vuelve F7)", UNIT, REN, LIFT, "  return 0;"],
  ["U9 el textarea sin la voz de la piel (vuelve F9)", UNIT, INT, VOICE, "  const fo=null;"],
  ["U10 el textarea mide con la voz de siempre", UNIT, INT, MEASURE, "  const L=labelLayout(o, measureNodeLabel(ctx,o));"],
  ["U11 el marco de nodo también dentro de drawNode con la piel", UNIT, REN, INLINE_N, "  if(!isExport) drawNodeSelection(c,n,theme,rs);"],
  ["U12 los tiradores de la pasada final sobre la ruta lógica", UNIT, REN, MARK_PTS, "  const pts=edgePoints(e); if(pts.length<2) return;"],
  ["U13 la pasada final también en plano (cambia el plano)", UNIT, REN, PASS, "  drawEditorMarks(c,t,theme,rs);"],
  ["U14 el editor sigue plano (P1)", UNIT, RT, VIEWPORT, '      skin: presenting ? editorSkin() : "flat"},'],
  ["U15 la voz también en formas sin piel", UNIT, REN, VOICE_SHAPES, "  return skinOn ? skinLabelFont(n, settings.font) : null;"],
  ["U16 las caras también en plano", UNIT, INT, FACES, "  const X=nodeSkinExtent(n,true);"],
  ["U17 el puerto: el anfitrión ignora el orden de pintado", UNIT, INT, HOST, "  if(false){}\n  else {"],
  ["U18 los tiradores de la conexión dentro de drawEdge con la piel", UNIT, REN, INLINE_E, "  if(single) drawEdgeHandles(c,e,pts,M,zoom);"],
  ["B1 sin pasada final (las marcas no salen con la piel)", BROWSER, REN, PASS, ""],
  ["B2 sin área de caras (vuelve F8)", BROWSER, INT, FACES, "  const X=null;"],
  ["B3 predicado desacoplado (el acierto ignora el umbral de zoom)", BROWSER, RT, PRED, 'function editorSkinOn(){ return editorSkin()==="built"; }'],
  ["B4 el extremo solo se acierta en la geometría lógica (vuelve N1)", BROWSER, INT, END, "  const v=null;"],
  ["B5 el editor sigue plano (P1)", BROWSER, RT, VIEWPORT, '      skin: presenting ? editorSkin() : "flat"},'],
  ["B6 el puerto no se aparta de la silueta (vuelve F7)", BROWSER, REN, LIFT, "  return 0;"],
  ["B7 el textarea no se recoloca al cambiar la piel", BROWSER, INT, SIG, ";"],
  /* F6 tal cual (la de antes de 019.4b): marcas dentro de drawNode/drawEdge también con la piel y sin pasada final. La de un solo punto
     (solo el marco también dentro de drawNode) es equivalente a la vista: la pasada final lo vuelve a pintar encima (la caza U11) */
  ["B8 las marcas dentro de drawNode/drawEdge con la piel, sin pasada final (vuelve F6)", BROWSER, REN, [[INLINE_N, "  if(!isExport) drawNodeSelection(c,n,theme,rs);"], [INLINE_E, "  if(single) drawEdgeHandles(c,e,pts,M,zoom);"], [PASS, ""]]],
  ["U19 las marcas dentro de drawNode/drawEdge con la piel, sin pasada final (vuelve F6)", UNIT, REN, [[INLINE_N, "  if(!isExport) drawNodeSelection(c,n,theme,rs);"], [INLINE_E, "  if(single) drawEdgeHandles(c,e,pts,M,zoom);"], [PASS, ""]]],
  ["B9 el textarea sin la voz de la piel (vuelve F9)", BROWSER, INT, VOICE, "  const fo=null;"],
];

function copyTree(dest) {
  for (const entry of fs.readdirSync(root).filter((e) => e !== ".git")) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dest, entry), { recursive: true });
  }
}
function runSuite(dir, args) {
  const browser = args === BROWSER;
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", timeout: browser ? 900000 : 300000,
    env: { ...process.env, FLUYO_GIT_ROOT: root, FLUYO_ROOT: dir } });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluyo-4b-mut-"));
const list = MUTATIONS.filter((m) => !(process.env.SKIP_BROWSER && m[1] === BROWSER)).filter((m) => { const o = process.env.ONLY_MUT; if (!o) return true; const id = m[0].split(" ")[0]; return id === o || (/^[UB]$/.test(o) && id[0] === o); });
let failed = 0;
try {
  const base = path.join(tmp, "base"); fs.mkdirSync(base); copyTree(base);
  const suites = [...(list.some((m) => m[1] === UNIT) ? [UNIT] : []), ...(list.some((m) => m[1] === BROWSER) ? [BROWSER] : [])];
  for (const args of suites) {
    const sane = runSuite(base, args);
    if (sane.code !== 0) { console.error("La copia sin mutar NO pasa " + args.join(" ") + ":\n" + sane.out.slice(-3000)); process.exit(2); }
  }
  console.log("copia sin mutar: suites OK (0/" + list.length + " mutaciones aplicadas)");
  list.forEach(([name, args, file, from, to], i) => {
    const dir = path.join(tmp, "m" + i); fs.mkdirSync(dir); copyTree(dir);
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, "utf8"), crlf = src.includes(CRLF);
    let text = src.replaceAll(CRLF, NL);
    const pairs = Array.isArray(from) ? from : [[from, to]];
    if (pairs.some(([a]) => !text.includes(a))) { console.log("  ✘ " + name + " — el patrón no existe (mutación obsoleta)"); failed++; return; }
    for (const [a, b] of pairs) text = text.replace(a, () => b);
    fs.writeFileSync(p, text.replaceAll(NL, crlf ? CRLF : NL));
    const r = runSuite(dir, args);
    if (r.code !== 0) {
      const why = (r.out.match(/^(?:not ok \d+ - |\s+✘ |✖ )(.*)$/m) || [])[1] || "";
      console.log("  ✔ " + name + " — la suite falla, como debe" + (why ? " (" + why.slice(0, 110) + ")" : ""));
    }
    else { console.log("  ✘ " + name + " — la suite SIGUE PASANDO"); failed++; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`\n${list.length - failed}/${list.length} mutaciones detectadas (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failed ? 1 : 0);
