"use strict";
/* SCENARIOS-SEMANTICS-001 FASE 3 — Deshace en un texto los cambios de FASE 3 (ruta observada) en los archivos servidos:
   js/model.js, js/document-integrity.js, js/story-authoring.js, js/flow-semantics.js, js/editor-scenarios.js, index.html,
   css/styles.css y sw.js (la línea del precache; la constante CACHE la resuelve cada test).
   Lo usan los tests de alcance de slices anteriores para comparar el resto del archivo con su base, como hicieron 019.4b
   (fluyo-019-4b-undo.cjs), 019.4a y FASE 1 con los suyos (decisión 218). Cada región que toca FASE 3 se sustituye por la misma
   región de 16ee642 (la base de FASE 3, que ya trae 019.4b), así que se aplica ANTES que undo4b, undo4a y undoSemantics. Si
   FASE 3 cambia y esto no, los tests de alcance antiguos fallan: es lo que se quiere. El alcance de FASE 3 lo vigila
   test/fluyo-scenarios-semantics-3.test.cjs. */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE3 = "16ee642";
const cache = new Map();
const atBase3 = (f) => { if (!cache.has(f)) cache.set(f, execFileSync("git", ["-C", gitRoot, "show", BASE3 + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n")); return cache.get(f); };

/* [desde, hasta]: la región [desde, hasta) del texto se sustituye por la misma región de la base. Los dos marcadores existen en
   la base y en FASE 3. Si un marcador falta (otra versión del archivo), no se toca nada. */
const REGIONS = {
  "js/model.js": [
    ["    sc.nextStepId=projectCounter(sc.nextStepId,maxStepId);\n", "  }\n  pg.nextScenarioId=projectCounter(pg.nextScenarioId,maxScenarioId);"],
    ["/* Disponibilidad INICIAL de un elemento:", "/* ===================== Autoría del diagrama: crear nodos y conexiones (FLUYO-018.1)"],
    ["/* Quita el nodo, las conexiones que lo tocan", "function deleteConnectionIn("],
  ],
  "js/document-integrity.js": [
    ["    const eventTypesOnly = eventTypeIds.size>0", "  /* FLUYO-017.3. ¿Qué quedaría inválido si este EventType"],
  ],
  "js/story-authoring.js": [
    ["      ctx.deleted.push({kind:\"node\", pageIndex:op.pageIndex, id, label:r.node.label", "    delete_connection(ctx, op, pg){"],
  ],
  "js/flow-semantics.js": [
    ["   Puro: sin DOM, timers, azar ni estado;", "var FluyoFlow = (function(){"],
    ["    return p;\n  }\n", "})();"],
  ],
  "js/editor-scenarios.js": [
    ["function scSyncPage() {", "/* Selecciona una Historia: un solo punto"],
    ["function scSelectStory(id) {", "function scNewScenario() {"],
    ["function scBehaviorForNode(nodeId) {", "function escapeHtml(s) {"],
    ["function scRenderStatus() {", "  const el = $(\"scStatus\");"],
    ["function scPlaceNow() {", "function scScenarioMenu(anchor) {"],
    ["  bind(\"scNext\", scNextMoment);\n", "  bind(\"scEventNew\""],
  ],
  "index.html": [
    ["        <p id=\"scErrors\" role=\"alert\" hidden></p>\n", "        <button id=\"scPaletteToggle\""],
    ["<script src=\"js/story-clock.js\"></script>\n", "<script src=\"js/document-integrity.js\"></script>"],
  ],
  "css/styles.css": [
    ["#scErrors{color:var(--attention);font-size:13px;}\n", ".scSectionHeader h3,"],
    ["  #scErrors, #scUnsupported", "{grid-column:1 / -1; margin:0;}"],
  ],
  "sw.js": [
    ["  \"./js/story-clock.js\",\n", "  \"./js/document-integrity.js\","],
  ],
};
function region(src, base, a, b) {
  const i = src.indexOf(a), j = i >= 0 ? src.indexOf(b, i + a.length) : -1;
  const k = base.indexOf(a), l = k >= 0 ? base.indexOf(b, k + a.length) : -1;
  if (i < 0 || j < 0 || k < 0 || l < 0) return src;
  return src.slice(0, i) + base.slice(k, l) + src.slice(j);
}
function undo3(file, src) {
  const f = file.replace(/\\/g, "/"), regions = REGIONS[f];
  if (!regions) return src;
  const base = atBase3(f);
  let out = src.replace(/\r\n/g, "\n");
  for (const [a, b] of regions) out = region(out, base, a, b);
  return out;
}
module.exports = { undo3, BASE3, REGIONS };
