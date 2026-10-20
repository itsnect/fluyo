"use strict";
/* FLUYO-STEP-REVERSE-002 — Deshace en un texto los cambios de 002 (Step SEND con `reverse`) en los archivos servidos:
   js/model.js, js/scenario-engine.js, js/story-playback.js, js/scenario-playback.js, js/story-authoring.js,
   js/document-integrity.js, js/render.js, js/editor-scenarios.js y js/selection.js (la constante CACHE de sw.js la resuelve cada test).
   Lo usan los tests de alcance de slices anteriores para comparar el resto del archivo con su base, como FASE 3
   (fluyo-scenarios-semantics-3-undo.cjs), 019.4b, 019.4a y FASE 1 con los suyos (decisión 218). Cada región que toca 002 se
   sustituye por la misma región de 544fd4b (la base de 002, que ya trae FASE 3), así que se aplica ANTES que undo3. Si 002 cambia
   y esto no, los tests de alcance antiguos fallan: es lo que se quiere. El alcance de 002 lo vigila test/fluyo-step-reverse-002.test.cjs. */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE_REVERSE = "544fd4b";
const cache = new Map();
const atBaseR = (f) => { if (!cache.has(f)) cache.set(f, execFileSync("git", ["-C", gitRoot, "show", BASE_REVERSE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n")); return cache.get(f); };

/* [desde, hasta]: la región [desde, hasta) del texto se sustituye por la misma región de la base. Los dos marcadores existen en
   la base y en 002. Si un marcador falta (otra versión del archivo), no se toca nada. */
const REGIONS = {
  "js/model.js": [
    ["function eventTypeAllowedTargets(et){", "function normalizeBehaviors(pg){"],
    ["    for(const step of sc.steps){\n      validatePersistedStep(", "      if(sc.engineVersion<2 && step.action===\"OCCURRENCE\")"],
    ["/* Definición de Step para colocar `et` sobre `target`", "/* Tiempo al que entra un Step añadido al final"],
    ["/* Cambiar SÓLO el objetivo de un Step:", "/* Disponibilidad INICIAL de un elemento:"],
  ],
  "js/scenario-engine.js": [
    ["          // eventTypeId es metadata de presentación", "          if(step.action===\"SET_STATE\"){\n            if(!isPosInt(step.nodeId)"],
    ["      } else { // SEND", "    return {\n      ok:true,"],
  ],
  "js/scenario-playback.js": [
    ["var FluyoScenarioPlayback = (function(){", "  return {makePlayback, tick"],
  ],
  "js/story-playback.js": [
    ["  function outcomes(trace, scenario, page){", "  /* ¿Ya no queda nada por emitir ni por verse? */"],
    ["  /* Mensaje de consecuencia vigente", "  /* Eventos que no se completaron"],
  ],
  "js/story-authoring.js": [
    ["  function eventTypeOf(ctx, v){", "  /* ───────── diferencias de una Historia"],
    ["    add_step(ctx, op, pg){", "    remove_step(ctx, op, pg){"],
    ["    duplicate_step(ctx, op, pg){", "    set_wait(ctx, op, pg){"],
  ],
  "js/document-integrity.js": [
    ["            sc.steps.forEach((step, i)=>{", "              else if(stepIds.has(step.id))"],
  ],
  "js/render.js": [
    ["function drawFlowOverlay(c,pts,active,completed,T){", "/* Pinta las marcas de semántica"],
  ],
  "js/editor-scenarios.js": [
    ["function scNodeFallback(id) {", "function scEdgeSecondary(id) {"],
    ["function scTargetLabel(step) {", "function scIsTargetMissing(step) {"],
    ["function describeScenarioStep(step) {", "function scBehaviorForNode(nodeId) {"],
    ["function escapeHtml(s) {", "function scStatusMark(status) {"],
    ["function scRenderTraceLog() {", "      const reasonText =\n        ev.reason === \"source_down\""],
    ["function scWhereLabel(step) {", "function scStoryMenu(step, anchor) {"],
    ["function scArrivalMenuItem(step) {", "  const items = ordered.map("],
    ["function scBeginMulti(id) {", "function scValidatePlacement() {"],
    ["  if (p.kind === \"retarget\") {", "    scCancelPlacement();\n    scCommit();\n    return;\n  }"],
    ["function scConfirmMulti() {", "function scHighlight(kind, id) {"],
  ],
  "js/selection.js": [
    ["  const targetOf=st=>{", "  const stories=r.affectedStories"],
  ],
};
function region(src, base, a, b) {
  const i = src.indexOf(a), j = i >= 0 ? src.indexOf(b, i + a.length) : -1;
  const k = base.indexOf(a), l = k >= 0 ? base.indexOf(b, k + a.length) : -1;
  if (i < 0 || j < 0 || k < 0 || l < 0) return src;
  return src.slice(0, i) + base.slice(k, l) + src.slice(j);
}
function undoReverse(file, src) {
  const f = file.replace(/\\/g, "/"), regions = REGIONS[f];
  if (!regions) return src;
  const base = atBaseR(f);
  let out = src.replace(/\r\n/g, "\n");
  for (const [a, b] of regions) out = region(out, base, a, b);
  return out;
}
module.exports = { undoReverse, BASE_REVERSE, REGIONS };
