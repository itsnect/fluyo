"use strict";
/* FLUYO-018.18. Reloj de una Historia: pausar, reanudar y saltar entre momentos.

   NO es kernel (fluyo-mcp no lo copia) y no añade semántica: la reproducción sigue siendo
   FluyoStory.start + FluyoScenarioPlayback.tick, que son funciones puras del reloj que reciben
   (todos los tiempos de partículas y cues salen de `startedAtReal + ev.at`). Este archivo solo
   decide QUÉ reloj se les pasa:

     · reproduciendo → tiempo real menos lo que duraron las pausas;
     · en pausa      → el instante en que se pausó (la proyección queda quieta);
     · saltar a un momento → la misma receta con el origen desplazado hacia atrás y un tick:
       el estado es exactamente el de una reproducción continua en ese instante (determinista).

   La unidad de navegación es el MOMENTO de la Historia (grupo de Steps con el mismo `at`,
   storyboardGroups), la misma que el progreso «2 / 4» y los puntos de Present; nunca el Step.
   Lo usan el editor (y por él Present) y el Viewer. Puro: sin DOM, timers ni estado global.
   Cargar tras model.js, scenario-playback.js y story-playback.js.

   FLUYO-018.21. Dependencias de llegada: «este momento no empieza hasta que llegue este envío».
   Dato de la HISTORIA (no del Step: el esquema del Step y el motor rechazan campos extra), opcional y aditivo (regla y forma en
   model.js desde 018.22, compartidas con fluyo-mcp):

     scenario.arrivalDependencies = [ { stepId: 4, waitsForArrivalOf: [3] }, … ]

   Una dependencia es VÁLIDA si su Step existe y cada id de `waitsForArrivalOf` es un Step SEND de la misma Historia en un
   momento ANTERIOR (`at` estrictamente menor). Lo inválido (Step o envío inexistente, no SEND, mismo momento o posterior,
   forma rota) se IGNORA: nunca bloquea la reproducción ni invalida el documento. Como solo cuentan envíos de momentos
   anteriores, no puede haber ciclos y el cálculo es una sola pasada.

   Instante VISIBLE de cada momento (E2, decisión 18.20 D3): el momento es atómico (espera la unión de las dependencias de
   sus Steps) y, si espera, la Historia se pausa ahí: lo anterior no se toca y lo posterior conserva su ritmo.

     visible(k) = max( at(k) + pausa(k−1), llegada(e) para cada envío e del que dependa k )   pausa(k) = visible(k) − at(k)
     llegada(e) = visible(momento de e) + duración del viaje de e (la MISMA del Playback: MOTION_MS[motion])

   Sin dependencias, visible = `at` y la reproducción es idéntica a la anterior (el Trace no se toca ni se copia). Con
   dependencias, el motor y su Trace siguen intactos: el Playback reproduce una COPIA del Trace con los instantes visibles. */

var FluyoStoryClock = (function(){
  /* base: cuánto tiempo real hay que restar; pausedAt: el tiempo de Historia congelado (o null). */
  function create(){ return {base:0, pausedAt:null}; }
  function now(c, real){ return c.pausedAt!==null ? c.pausedAt : real - c.base; }
  function isPaused(c){ return !!c && c.pausedAt!==null; }
  function pause(c, real){ if(c.pausedAt===null) c.pausedAt = real - c.base; }
  function resume(c, real){ if(c.pausedAt!==null){ c.base = real - c.pausedAt; c.pausedAt = null; } }

  /* ─────────── Dependencias de llegada (dato de la Historia) ───────────
     FLUYO-018.22: la regla de validez y la forma canónica viven en model.js (kernel), las mismas que usa fluyo-mcp para
     crearlas y modificarlas. Aquí solo se reexportan con los nombres de siempre; este archivo sigue fuera del kernel. */
  const stepWaits = arrivalStepWaits, momentWaits = arrivalMomentWaits;

  /* ─────────── Instante visible de cada momento ─────────── */
  /* Duración del viaje de un SEND: exactamente la de FluyoScenarioPlayback.sendDuration (presentación). */
  function travelMs(stepMeta, stepId){
    const meta = stepMeta && stepMeta[stepId], ms = FluyoScenarioPlayback.MOTION_MS;
    return (meta && meta.motion && ms[meta.motion]) ? ms[meta.motion] : FluyoScenarioPlayback.SEND_PARTICLE_MS;
  }
  function schedule(scenario, stepMeta){
    const groups = storyboardGroups((scenario && scenario.steps) || []), deps = arrivalDependencies(scenario);
    const times = [], narrative = [], waitsFor = [], byStep = {}, arrivals = {};
    let pause = 0;
    for(const g of groups){
      const waits = [];
      for(const s of g.steps) for(const id of deps.waits.get(s.id) || []) if(!waits.includes(id)) waits.push(id);
      let t = g.at + pause;
      for(const id of waits) if(arrivals[id]>t) t = arrivals[id];
      pause = t - g.at;
      times.push(t); narrative.push(g.at); waitsFor.push(waits);
      for(const s of g.steps){ byStep[s.id] = t; if(s.action==="SEND") arrivals[s.id] = t + travelMs(stepMeta, s.id); }
    }
    return {times, narrative, waitsFor, byStep, arrivals, ignored:deps.ignored, shifted:times.some((t,i)=>t!==narrative[i])};
  }
  /* Copia del Trace con el instante visible de cada evento (orden estable). `narrativeAt` conserva el del motor. */
  function visibleTrace(trace, byStep){
    const events = trace.events.map((e,i)=>({e:Object.assign({}, e, {at: byStep[e.stepId]!==undefined ? byStep[e.stepId] : e.at, narrativeAt:e.at}), i}));
    events.sort((a,b)=>a.e.at-b.e.at || a.i-b.i);
    return Object.assign({}, trace, {events:events.map(x=>x.e)});
  }
  /* Empezar una reproducción: la receta única (FluyoStory.start) + el horario visible. */
  function start(page, scenario, nowReal){
    const started = FluyoStory.start(page, scenario, nowReal);
    if(!started.ok) return started;
    const sch = schedule(scenario, started.playback.stepMeta);
    started.playback.schedule = sch;
    if(sch.shifted) started.playback.trace = visibleTrace(started.playback.trace, sch.byStep);
    return started;
  }
  /* Instante visible de un Step en una reproducción (sin horario, el narrativo). */
  function visibleAt(playback, step){
    const v = playback && playback.schedule && playback.schedule.byStep[step.id];
    return v!==undefined && v!==null ? v : step.at;
  }

  /* Instantes de los momentos, en orden (los mismos grupos que pinta la línea de tiempo). Con una reproducción, los
     VISIBLES; sin ella, los narrativos (`at`), que sirven para identificar el momento de un Step. */
  function momentTimes(scenario, playback){
    if(playback && playback.schedule) return playback.schedule.times.slice();
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

  /* Salta al momento i: vuelve a ejecutar la MISMA receta con el origen desplazado y proyecta hasta el instante VISIBLE del
     momento. No toca el documento ni el reloj (se conserva la pausa o la marcha). */
  function seek(c, real, page, scenario, i){
    const times = schedule(scenario, FluyoStory.stepMeta((scenario && scenario.steps) || [])).times;
    if(!times.length) return {ok:false, errors:[]};
    const k = Math.max(0, Math.min(times.length-1, i|0));
    const t = now(c, real);
    const started = start(page, scenario, t - times[k]);
    if(!started.ok) return started;
    FluyoScenarioPlayback.tick(started.playback, t);
    /* FLUYO-018.29 (G1): saltar EN PAUSA es para mirar ese momento, que se ve entero ya (ver reveal). Reproduciendo, nada cambia. */
    if(isPaused(c)) started.playback.revealAt = times[k];
    return {ok:true, playback:started.playback, index:k, at:times[k]};
  }

  /* FLUYO-018.29 (G1). Presentación, no transporte: el reloj sigue exactamente en `at`, y el Trace, el horario, la duración y
     la salida de cada cue no cambian. Solo los cues del momento al que se saltó en pausa (`revealAt`) se saltan su entrada
     (CUE_FADE_IN_MS): globo, `message`, símbolo y resaltado salen completos. Al reanudar siguen completos (no reaparecen
     desde 0) y, pasada esa entrada, la envolvente normal ya daría lo mismo. Mientras dura la entrada la salida no ha empezado
     (cada fade se acota a un tercio de la duración, cueEnvelope), así que completo = alpha 1. Recibe la proyección de
     FluyoStory.renderState y devuelve la misma, con esos cues copiados (los del Playback no se tocan). */
  function reveal(rs, playback){
    const at = playback && playback.revealAt;
    if(typeof at!=="number" || !rs || !rs.activeNodeEffects) return rs;
    const ids = new Set();
    for(const fx of playback.activeNodeEffects) if(fx.virtualAt===at) ids.add(fx.stepId);
    if(ids.size) rs.activeNodeEffects = rs.activeNodeEffects.map(fx => ids.has(fx.stepId) && fx.enter<1 ? Object.assign({}, fx, {alpha:1, enter:1}) : fx);
    return rs;
  }

  /* El texto de Present, el Viewer y el editor (FluyoStory.describe) con el momento en curso según el instante VISIBLE. */
  function describe(phase, scenario, playback, nodeName, edgeEnds){
    const d = FluyoStory.describe(phase, scenario, playback, nodeName, edgeEnds);
    if(phase!=="playing" || !playback || !playback.schedule || !playback.schedule.shifted) return d;
    const idx = momentIndex(playback.schedule.times, playback.cursorVirtual || 0);
    return Object.assign({}, d, {idx, title: idx>=0 && d.moments[idx] && d.moments[idx].label ? d.moments[idx].label : scenario.name});
  }

  return {create, now, isPaused, pause, resume, momentTimes, momentIndex, prevTarget, nextTarget, seek, reveal,
          arrivalDependencies, arrivalCandidates, stepWaits, momentWaits, pruneArrivalDependencies, withArrivalWait,
          withoutArrivalWaits, copyArrivalWaits, travelMs, schedule, visibleTrace, start, visibleAt, describe};
})();
