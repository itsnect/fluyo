"use strict";
/* FLUYO-018.29 — Deshace en un texto los cambios de esta tarea en los archivos servidos (R1: presentHeaderBottom y la reserva medida de
   fitViewPresent en present-story.js; G1: revealAt/reveal en story-clock.js y su llamada en editor-scenarios.js y viewer.js); la
   constante CACHE de sw.js la resuelve cada test. Va DEBAJO de undoMsg (fluyo-step-message-001-undo.cjs), como STEP-MESSAGE-001 fue
   debajo de undo6: los alcances de slices anteriores la reciben sin cambiar. Cada pieza se sustituye por el texto exacto de 441a75c (la
   base de esta tarea). Si esta tarea cambia y esto no, los tests de alcance antiguos fallan: es lo que se quiere. El alcance de esta
   tarea lo vigila test/fluyo-018-29.test.cjs. Las piezas son los fragmentos del diff con dos líneas de contexto. */
const BASE_029 = "441a75c";

/* [texto de esta tarea, texto de la base]. Si el texto de esta tarea no está (otra versión del archivo), no se toca nada. */
const PIECES = {
  "js/editor-scenarios.js": [
    [
      "function buildScenarioRenderState() {\n  if (!scPlayback) return null;\n  let rs = FluyoStory.renderState(scPlayback, scActiveScenario(), scNow());\n  /* FLUYO-018.29 (G1): el momento al que se saltó en pausa se ve entero ya (story-clock.js) */\n  if (typeof FluyoStoryClock !== \"undefined\") rs = FluyoStoryClock.reveal(rs, scPlayback);\n  /* SCENARIOS-SEMANTICS-001 FASE 4: lo que el lienzo pinta de la ruta observada (null sin ruta; FASE 5: también en Present) */\n  const flow = scFlowOverlay();\n",
      "function buildScenarioRenderState() {\n  if (!scPlayback) return null;\n  const rs = FluyoStory.renderState(scPlayback, scActiveScenario(), scNow());\n  /* SCENARIOS-SEMANTICS-001 FASE 4: lo que el lienzo pinta de la ruta observada (null sin ruta; FASE 5: también en Present) */\n  const flow = scFlowOverlay();\n",
    ],
  ],
  "js/present-story.js": [
    [
      "}\n\n/* FLUYO-018.29 (R1): borde inferior del encabezado en su forma MÁS ALTA, medido (0 si no hay encabezado). Lista, el encabezado\n   no tiene aún mensaje, cierre ni línea de la ruta; reproduciendo y terminada, sí (la ruta, decisión 246). Para que Reproducir no\n   tape la fila de arriba ni obligue a reencajar, se mide con esas filas desde el inicio: el mensaje y el cierre de «terminada»\n   (los del mismo modelo, FluyoStory.describe, sobre el Trace de la Historia: el cierre solo existe si algún envío falla) y la\n   línea de la ruta, si la Historia la tiene. Son filas sonda (mismas clases, aria-hidden), puestas y quitadas en la misma\n   tarea: nunca se pintan. Un mensaje de consecuencia más largo que una línea no se reserva (no se conoce hasta reproducir). */\nfunction presentHeaderBottom(){\n  const ps=$(\"presentStory\");\n  if(!ps || ps.hidden || !ps.offsetHeight) return 0;\n  const probes=[];\n  const probe=(cls, text)=>{ const el=document.createElement(\"div\"); el.className=cls; el.textContent=text; el.setAttribute(\"aria-hidden\",\"true\"); ps.appendChild(el); probes.push(el); };\n  const sc=presentHasStory() ? scActiveScenario() : null, run=sc ? FluyoStory.run(P(), sc) : null;\n  const end=run && run.ok ? FluyoStory.describe(\"finished\", sc, {logEvents:run.trace.events, cursorVirtual:0}, ()=>\"\", ()=>null) : null;\n  if(!$(\"psCaption\").textContent) probe(\"psCaption\", end ? end.caption : \"En pausa\");\n  if(end && end.summary && !$(\"psSummary\").textContent) probe(\"psSummary\", end.summary);\n  const route=$(\"psFlow\").hidden && sc && typeof scFlowPresentLine===\"function\" ? scFlowPresentLine() : null;\n  if(route) probe(\"psFlow is\"+route.status, route.text);\n  const bottom=ps.getBoundingClientRect().bottom;\n  for(const el of probes) el.remove();\n  return bottom;\n}\n\n/* Encaja el diagrama en el espacio libre de la escena: deja aire alrededor y\n   reserva el hueco del encabezado y de la barra. No toca la geometría. */\n",
      "}\n\n/* Encaja el diagrama en el espacio libre de la escena: deja aire alrededor y\n   reserva el hueco del encabezado y de la barra. No toca la geometría. */\n",
    ],
    [
      "  if(b.w<=0 || b.h<=0) return;\n  const small=r.width<520;\n  /* el encabezado y el mando se miden con lo que ya muestra ESTA página (al cambiar de diapositiva aún tenían la anterior) */\n  presentStoryRefresh();\n  /* el mando puede ocupar dos filas en vertical (Historia y páginas, FLUYO-018.18): se reserva su alto real */\n  const bar=$(\"presentBar\"), barH=bar && bar.offsetHeight ? bar.offsetHeight+28 : 0;\n  /* FLUYO-018.29 (R1): el encabezado, por su alto real en su forma más alta (la caja del diagrama ya lleva su aire, getBounds) */\n  const side=small?12:32, top=Math.max(24, presentHeaderBottom()-r.top), bottom=Math.max(small?76:88, barH);\n  const aw=Math.max(40,r.width-side*2), ah=Math.max(40,r.height-top-bottom);\n  viewZoom=clamp(Math.min(aw/b.w, ah/b.h), 0.05, maxZoom);\n",
      "  if(b.w<=0 || b.h<=0) return;\n  const small=r.width<520;\n  /* el mando puede ocupar dos filas en vertical (Historia y páginas, FLUYO-018.18): se reserva su alto real */\n  const bar=$(\"presentBar\"), barH=bar && bar.offsetHeight ? bar.offsetHeight+28 : 0;\n  const side=small?12:32, top=presentHasStory()?(small?84:84):24, bottom=Math.max(small?76:88, barH);\n  const aw=Math.max(40,r.width-side*2), ah=Math.max(40,r.height-top-bottom);\n  viewZoom=clamp(Math.min(aw/b.w, ah/b.h), 0.05, maxZoom);\n",
    ],
  ],
  "js/story-clock.js": [
    [
      "    if(!started.ok) return started;\n    FluyoScenarioPlayback.tick(started.playback, t);\n    /* FLUYO-018.29 (G1): saltar EN PAUSA es para mirar ese momento, que se ve entero ya (ver reveal). Reproduciendo, nada cambia. */\n    if(isPaused(c)) started.playback.revealAt = times[k];\n    return {ok:true, playback:started.playback, index:k, at:times[k]};\n  }\n\n  /* FLUYO-018.29 (G1). Presentación, no transporte: el reloj sigue exactamente en `at`, y el Trace, el horario, la duración y\n     la salida de cada cue no cambian. Solo los cues del momento al que se saltó en pausa (`revealAt`) se saltan su entrada\n     (CUE_FADE_IN_MS): globo, `message`, símbolo y resaltado salen completos. Al reanudar siguen completos (no reaparecen\n     desde 0) y, pasada esa entrada, la envolvente normal ya daría lo mismo. Mientras dura la entrada la salida no ha empezado\n     (cada fade se acota a un tercio de la duración, cueEnvelope), así que completo = alpha 1. Recibe la proyección de\n     FluyoStory.renderState y devuelve la misma, con esos cues copiados (los del Playback no se tocan). */\n  function reveal(rs, playback){\n    const at = playback && playback.revealAt;\n    if(typeof at!==\"number\" || !rs || !rs.activeNodeEffects) return rs;\n    const ids = new Set();\n    for(const fx of playback.activeNodeEffects) if(fx.virtualAt===at) ids.add(fx.stepId);\n    if(ids.size) rs.activeNodeEffects = rs.activeNodeEffects.map(fx => ids.has(fx.stepId) && fx.enter<1 ? Object.assign({}, fx, {alpha:1, enter:1}) : fx);\n    return rs;\n  }\n\n  /* El texto de Present, el Viewer y el editor (FluyoStory.describe) con el momento en curso según el instante VISIBLE. */\n  function describe(phase, scenario, playback, nodeName, edgeEnds){\n",
      "    if(!started.ok) return started;\n    FluyoScenarioPlayback.tick(started.playback, t);\n    return {ok:true, playback:started.playback, index:k, at:times[k]};\n  }\n\n  /* El texto de Present, el Viewer y el editor (FluyoStory.describe) con el momento en curso según el instante VISIBLE. */\n  function describe(phase, scenario, playback, nodeName, edgeEnds){\n",
    ],
    [
      "  }\n\n  return {create, now, isPaused, pause, resume, momentTimes, momentIndex, prevTarget, nextTarget, seek, reveal,\n          arrivalDependencies, arrivalCandidates, stepWaits, momentWaits, pruneArrivalDependencies, withArrivalWait,\n          withoutArrivalWaits, copyArrivalWaits, travelMs, schedule, visibleTrace, start, visibleAt, describe};\n",
      "  }\n\n  return {create, now, isPaused, pause, resume, momentTimes, momentIndex, prevTarget, nextTarget, seek,\n          arrivalDependencies, arrivalCandidates, stepWaits, momentWaits, pruneArrivalDependencies, withArrivalWait,\n          withoutArrivalWaits, copyArrivalWaits, travelMs, schedule, visibleTrace, start, visibleAt, describe};\n",
    ],
  ],
  "js/viewer.js": [
    [
      "     la proyección se queda quieta. */\n  if(story){\n    /* FLUYO-018.29 (G1): el momento al que se saltó en pausa se ve entero ya (story-clock.js) */\n    rs.scenarioRuntime=FluyoStoryClock.reveal(FluyoStory.renderState(story.playback, story.scenario, storyNow()), story.playback);\n    /* SCENARIOS-SEMANTICS-001 FASE 5 (D7): lo que el lienzo pinta de la ruta observada, la misma receta que el editor y Present */\n    const flow=storyFlowOverlay();\n",
      "     la proyección se queda quieta. */\n  if(story){\n    rs.scenarioRuntime=FluyoStory.renderState(story.playback, story.scenario, storyNow());\n    /* SCENARIOS-SEMANTICS-001 FASE 5 (D7): lo que el lienzo pinta de la ruta observada, la misma receta que el editor y Present */\n    const flow=storyFlowOverlay();\n",
    ],
  ],
};
/* FLUYO-I18N-002 S2b (el proveedor de texto de story-clock.js) va encima de esta tarea: se deshace primero. */
const { undoS2b } = require("./fluyo-i18n-002-s2b-undo.cjs");
function undo029(file, src) {
  src = undoS2b(file, src);
  const f = file.replace(/\\/g, "/"), pieces = PIECES[f];
  if (!pieces) return src;
  let out = src.replace(/\r\n/g, "\n");
  for (const [mine, base] of pieces) if (out.includes(mine)) out = out.replace(mine, () => base);
  return out;
}
module.exports = { undo029, BASE_029, PIECES };
