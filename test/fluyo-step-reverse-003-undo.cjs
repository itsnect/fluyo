"use strict";
/* FLUYO-STEP-REVERSE-003 — Deshace en un texto el cambio de 003 («Invertir sentido» en el menú del Step) en js/editor-scenarios.js
   (la constante CACHE de sw.js la resuelve cada test). Lo usan los tests de alcance de slices anteriores ANTES que undoReverse
   (002), como 002 hizo con undo3 (decisión 218). Cada pieza de 003 se sustituye por el texto exacto de 702f269. Si 003 cambia y
   esto no, los tests de alcance antiguos fallan: es lo que se quiere. El alcance de 003 lo vigila
   test/fluyo-step-reverse-003.test.cjs. */
const BASE_REVERSE_UI = "702f269";

/* [texto de 003, texto de la base]. Si el texto de 003 no está (otra versión del archivo), no se toca nada. */
const PIECES = {
  "js/editor-scenarios.js": [
    [
      `    [
      { label: "Cambiar dónde ocurre…", hint: where ? "Ahora: " + where : "", fn: () => scChangeTarget(step) },
      ...(step.action === "SEND" ? [scReverseMenuItem(step)] : []),
    ],
`,
      `    [{ label: "Cambiar dónde ocurre…", hint: where ? "Ahora: " + where : "", fn: () => scChangeTarget(step) }],
`,
    ],
    [
      `/* FLUYO-STEP-REVERSE-003: «Invertir sentido» da la vuelta al Step en su misma conexión (A → B ⇄ B → A). Reutiliza
   setStepReverse (decisión 237): sin operación nueva, una sola entrada de Undo y la selección no cambia (decisión 189).
   El hint dice cómo QUEDARÁ, porque «Cambiar dónde ocurre» ya dice cómo está. Sin conexión no hay sentido que invertir. */
function scReverseMenuItem(step) {
  const flipped = scWhereLabel({ edgeId: step.edgeId, reverse: step.reverse !== true });
  return { label: "Invertir sentido", hint: flipped ? "Pasa a: " + flipped : "", fn: () => scToggleStepReverse(step.id), disabled: scIsTargetMissing(step) };
}
function scToggleStepReverse(id) {
  if (!scEditable()) return false;
  const sc = scActiveScenario(),
    s = sc.steps.find((x) => x.id === id);
  if (!s || s.action !== "SEND" || scIsTargetMissing(s)) return false;
  pushUndo();
  setStepReverse(sc, id, s.reverse !== true);
  scCommit();
  return true;
}
`,
      ``,
    ],
  ],
};
function undoReverseUi(file, src) {
  const f = file.replace(/\\/g, "/"), pieces = PIECES[f];
  if (!pieces) return src;
  let out = src.replace(/\r\n/g, "\n");
  for (const [mine, base] of pieces) if (out.includes(mine)) out = out.replace(mine, base);
  return out;
}
module.exports = { undoReverseUi, BASE_REVERSE_UI, PIECES };
