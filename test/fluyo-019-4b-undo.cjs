"use strict";
/* FLUYO-019.4b — Deshace en un texto los cambios de 019.4b (piel «construido» en el editor) en los archivos servidos:
   js/render.js, js/interaction.js, js/geometry.js, js/editor-runtime.js, js/state.js e index.html.
   Lo usan los tests de alcance de slices anteriores (018-13, 018-16, 019-2, 019-4a, FLOW-FADE, HIT-TEST, D6, PRSKIN y
   SCENARIOS-SEMANTICS FASE 1) para comparar el resto del archivo con su base, como hicieron 019.4a (fluyo-019-4a-undo.cjs) y
   FASE 1 (fluyo-scenarios-semantics-undo.cjs) con los suyos (decisión 218). Cada región que toca 019.4b se sustituye por la
   misma región de eff5129 (la base de 019.4b, que ya trae 019.4a y FASE 1), así que se aplica ANTES que undo4a y
   undoSemantics. Si 019.4b cambia y esto no, los tests de alcance antiguos fallan: es lo que se quiere. El alcance de 019.4b
   lo vigila test/fluyo-019-4b.test.cjs. */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE4B = "eff5129";
const cache = new Map();
const atBase4b = (f) => { if (!cache.has(f)) cache.set(f, execFileSync("git", ["-C", gitRoot, "show", BASE4B + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n")); return cache.get(f); };

/* [desde, hasta]: la región [desde, hasta) del texto se sustituye por la misma región de la base. Los dos marcadores existen
   en la base y en 019.4b. Si un marcador falta (otra versión del archivo), no se toca nada. */
const REGIONS = {
  "js/render.js": [
    ["shapePath(c,n);c.stroke();c.restore();}\n  }\n", "    const M=editorMark(theme);\n    c.save();\n    /* marco fino"],
    ["    if(rs.interaction.editing!==e){ c.fillStyle=T.edgeLbl; c.fillText(e.label,m.x,m.y); }\n  }\n", "/* Vista previa de «suelta aquí»"],
    ["function drawConnectPort(c, n, rs){", "function drawLinkOrigin("],
    ["  rs.skinBg=doc.customBg||T.bg;\n", "\n  if(isExport){"],
    ["  if(rs.scenarioRuntime) for(const n of P().nodes) drawScenarioNodeCue(c,n,t,rs);\n", "\n  const I=rs.interaction, S=rs.selection;"],
    ["  if(sk){\n", "    drawSkinLayers(c,sk.layers,n,glow);"],
  ],
  "js/interaction.js": [
    ["function nodeBoxHit(", "/* El más interior (menor área)"],
    ["function hitContainerNode(x,y){\n", "  for(let i=ns.length-1;i>=0;i--){\n    const n=ns[i];\n    if(nodeBoxHit(n,x,y) && isContainerNode"],
    ["  for(const s of SIDES){\n    const q=connectPortPoint(", "    if(Math.hypot(x-q.x, y-q.y)<rad) return s;"],
    ["  const ns=P().nodes, rad=arrowHitRadius(), leaves=[], conts=[];\n", "  for(const n of leaves) if(hitSideArrow(n,x,y,rad)) return n;"],
    ["  if(Math.hypot(x-q.x, y-q.y)<r) return \"to\";\n", "/* Devuelve el índice del TRAMO"],
    ["function editBoxGeometry(o){", "/* Escribe la geometría en el elemento."],
    ["function syncEditBoxIfMoved(){", "function openEditorAt(p){"],
  ],
  "js/geometry.js": [
    ["   con «Conectar» (js/ui.js). Lo comparten el dibujo (render.js) y el acierto\n", "  return {x:p.x+d.x*off, y:p.y+d.y*off};"],
  ],
  "js/editor-runtime.js": [
    ["function now(){", "function resizeEditorCanvas(){"],
  ],
  "js/state.js": [
    ["   FLUYO-019.2: settings.skin (model.js, projectSkin).", "\nlet panDrag=null;"],
  ],
  "index.html": [
    ["      <!-- FLUYO-019.2", "          <option value=\"flat\">"],
  ],
};
function region(src, base, a, b) {
  const i = src.indexOf(a), j = i >= 0 ? src.indexOf(b, i + a.length) : -1;
  const k = base.indexOf(a), l = k >= 0 ? base.indexOf(b, k + a.length) : -1;
  if (i < 0 || j < 0 || k < 0 || l < 0) return src;
  return src.slice(0, i) + base.slice(k, l) + src.slice(j);
}
function undo4b(file, src) {
  const f = file.replace(/\\/g, "/"), regions = REGIONS[f];
  if (!regions) return src;
  const base = atBase4b(f);
  return regions.reduce((acc, [a, b]) => region(acc, base, a, b), src.replace(/\r\n/g, "\n"));
}
module.exports = { undo4b, BASE4B };
