"use strict";
/* FLUYO-STORIES-2.0 · etiqueta del desenlace («Termina bien» → «Sin fallos», «Ends well» → «No failures») — Deshace en un texto los
   cambios de esta tarea en los archivos servidos (js/story-clock.js, js/i18n-en.js). La constante CACHE de sw.js la resuelve cada
   test. Es la última de la cadena: undoS2b (fluyo-stories-2-0-s2b-undo.cjs) la llama la primera, así los alcances de slices
   anteriores la reciben sin cambiar.
   Cada pieza se sustituye por el texto exacto de la base de esta tarea (S2b cerrada, 9d3096d). Generado del diff con dos líneas
   de contexto. */
const BASE_OUTCOME = "9d3096d";
/* Esta tarea no añade archivos servidos. */
const NEW_FILES = [];

/* [texto de esta tarea, texto de la base]. Si el texto de esta tarea no está (otra versión del archivo), no se toca nada. */
const PIECES = {
  "js/i18n-en.js": [
    [
      "  \"story.failedCount\":{one:\"{count} step couldn't run\", other:\"{count} steps couldn't run\"},\n  /* FLUYO-STORIES-2.0 S1b · el desenlace (FluyoStoryClock.outcomeText): editor, Present y Viewer */\n  \"story.outcome.ok\":\"No failures\",\n  \"story.outcome.failed\":\"Fails at step {n}\",\n  /* FLUYO-STORIES-2.0 S2a · «Otras formas»: las demás historias de la página, al terminar (Present y Viewer) */\n",
      "  \"story.failedCount\":{one:\"{count} step couldn't run\", other:\"{count} steps couldn't run\"},\n  /* FLUYO-STORIES-2.0 S1b · el desenlace (FluyoStoryClock.outcomeText): editor, Present y Viewer */\n  \"story.outcome.ok\":\"Ends well\",\n  \"story.outcome.failed\":\"Fails at step {n}\",\n  /* FLUYO-STORIES-2.0 S2a · «Otras formas»: las demás historias de la página, al terminar (Present y Viewer) */\n"
    ]
  ],
  "js/story-clock.js": [
    [
      "  /* FLUYO-STORIES-2.0 S1b. Desenlace de una Historia, el MISMO en el editor, Present y el Viewer: sale del Trace del motor,\n     no de una etiqueta. «Falla en el paso N»: N es el momento (la unidad del progreso «n / total») del primer envío que no\n     se completó (`send_failed`, lo mismo que cuenta FluyoStory.failedCount). «Sin fallos»: hay pasos y ningún envío falla,\n     también en una ruta alternativa (D2; la marca de variante es de S2). Sin pasos o sin Trace: null (no se dice nada).\n     Las esperas de llegada solo desplazan instantes sin cambiar el orden de los momentos, así que el horario visible da el\n",
      "  /* FLUYO-STORIES-2.0 S1b. Desenlace de una Historia, el MISMO en el editor, Present y el Viewer: sale del Trace del motor,\n     no de una etiqueta. «Falla en el paso N»: N es el momento (la unidad del progreso «n / total») del primer envío que no\n     se completó (`send_failed`, lo mismo que cuenta FluyoStory.failedCount). «Termina bien»: hay pasos y ningún envío falla,\n     también en una ruta alternativa (D2; la marca de variante es de S2). Sin pasos o sin Trace: null (no se dice nada).\n     Las esperas de llegada solo desplazan instantes sin cambiar el orden de los momentos, así que el horario visible da el\n"
    ],
    [
      "    if(!o) return \"\";\n    const tx = typeof text===\"function\" ? text : (k, fb, p)=>fb.replace(/\\{(\\w+)\\}/g, (m, name)=>p && p[name]!==undefined ? String(p[name]) : m);\n    /* «Sin fallos» dice solo lo que el motor comprueba (ningún envío falló), no que el resultado sea bueno: una ruta alternativa\n       («El banco rechaza la tarjeta») también es «Sin fallos» (FLUYO-STORIES-2.0, etiqueta del desenlace, decisión 319). */\n    return o.ok ? tx(\"story.outcome.ok\", \"Sin fallos\") : tx(\"story.outcome.failed\", \"Falla en el paso {n}\", {n:o.moment});\n  }\n  /* La línea de Present y el Viewer: solo terminada, del Trace de esa reproducción (\"\" en las demás fases). */\n",
      "    if(!o) return \"\";\n    const tx = typeof text===\"function\" ? text : (k, fb, p)=>fb.replace(/\\{(\\w+)\\}/g, (m, name)=>p && p[name]!==undefined ? String(p[name]) : m);\n    return o.ok ? tx(\"story.outcome.ok\", \"Termina bien\") : tx(\"story.outcome.failed\", \"Falla en el paso {n}\", {n:o.moment});\n  }\n  /* La línea de Present y el Viewer: solo terminada, del Trace de esa reproducción (\"\" en las demás fases). */\n"
    ]
  ]
};
function undoOutcome(file, src) {
  const f = file.replace(/\\/g, "/"), pieces = PIECES[f];
  if (!pieces) return src;
  let out = src.replace(/\r\n/g, "\n");
  for (const [mine, base] of pieces) if (out.includes(mine)) out = out.replace(mine, () => base);
  return out;
}
module.exports = { undoOutcome, PIECES, NEW_FILES, BASE_OUTCOME };
