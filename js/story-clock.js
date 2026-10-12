"use strict";
/* FLUYO-018.18. Reloj de una Historia: pausar, reanudar y saltar entre momentos.

   NO es kernel (fluyo-mcp no lo copia) y no añade semántica: la reproducción sigue siendo
   FluyoStory.start + FluyoScenarioPlayback.tick, que son funciones puras del reloj que reciben
   (todos los tiempos de partículas y cues salen de `startedAtReal + ev.at`). Este archivo solo
   decide QUÉ reloj se les pasa:

     · reproduciendo → tiempo real menos lo que duraron las pausas;
     · en pausa      → el instante en que se pausó (la proyección queda quieta);
     · saltar a un momento → FluyoStory.start con el origen desplazado `at` hacia atrás y un tick:
       el estado es exactamente el de una reproducción continua en ese instante (determinista).

   La unidad de navegación es el MOMENTO de la Historia (grupo de Steps con el mismo `at`,
   storyboardGroups), la misma que el progreso «2 / 4» y los puntos de Present; nunca el Step.
   Lo usan el editor (y por él Present) y el Viewer. Puro: sin DOM, timers ni estado global.
   Cargar tras model.js, scenario-playback.js y story-playback.js. */

var FluyoStoryClock = (function(){
  /* base: cuánto tiempo real hay que restar; pausedAt: el tiempo de Historia congelado (o null). */
  function create(){ return {base:0, pausedAt:null}; }
  function now(c, real){ return c.pausedAt!==null ? c.pausedAt : real - c.base; }
  function isPaused(c){ return !!c && c.pausedAt!==null; }
  function pause(c, real){ if(c.pausedAt===null) c.pausedAt = real - c.base; }
  function resume(c, real){ if(c.pausedAt!==null){ c.base = real - c.pausedAt; c.pausedAt = null; } }

  /* Instantes de los momentos, en orden (los mismos grupos que pinta la línea de tiempo). */
  function momentTimes(scenario){
    return storyboardGroups((scenario && scenario.steps) || []).map(g=>g.at);
  }
  /* Momento en curso: el último cuyo instante ya llegó (−1 antes del primero). */
  function momentIndex(times, virtualTime){
    let idx=-1;
    for(let i=0;i<times.length;i++){ if(times[i]<=virtualTime) idx=i; else break; }
    return idx;
  }
  /* Momento al que lleva cada botón. Sin destino: null (el botón se apaga). */
  function prevTarget(times, virtualTime){ const i=momentIndex(times, virtualTime); return i>0 ? i-1 : null; }
  function nextTarget(times, virtualTime){ const i=momentIndex(times, virtualTime); return i+1<times.length ? i+1 : null; }

  /* Salta al momento i: vuelve a ejecutar la MISMA receta (FluyoStory.start) con el origen desplazado y proyecta hasta
     el instante del momento. No toca el documento ni el reloj (se conserva la pausa o la marcha). */
  function seek(c, real, page, scenario, i){
    const times = momentTimes(scenario);
    if(!times.length) return {ok:false, errors:[]};
    const k = Math.max(0, Math.min(times.length-1, i|0));
    const t = now(c, real);
    const started = FluyoStory.start(page, scenario, t - times[k]);
    if(!started.ok) return started;
    FluyoScenarioPlayback.tick(started.playback, t);
    return {ok:true, playback:started.playback, index:k, at:times[k]};
  }

  return {create, now, isPaused, pause, resume, momentTimes, momentIndex, prevTarget, nextTarget, seek};
})();
