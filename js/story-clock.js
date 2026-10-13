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
   Dato de la HISTORIA (no del Step: el esquema del Step y el motor rechazan campos extra), opcional y aditivo:

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

  /* ─────────── Dependencias de llegada (dato de la Historia) ─────────── */
  const isId = v => Number.isSafeInteger(v) && v>=1;
  /* Lectura tolerante: {waits: Map(stepId → [ids de SEND válidos]), ignored: [{stepId, sendId, reason}]}. */
  function arrivalDependencies(scenario){
    const steps = (scenario && Array.isArray(scenario.steps)) ? scenario.steps : [];
    const byId = new Map(steps.map(s=>[s.id, s])), waits = new Map(), ignored = [];
    const list = scenario && scenario.arrivalDependencies;
    if(list===undefined) return {waits, ignored};
    if(!Array.isArray(list)){ ignored.push({stepId:null, sendId:null, reason:"malformed"}); return {waits, ignored}; }
    for(const d of list){
      if(!d || typeof d!=="object" || !isId(d.stepId) || !Array.isArray(d.waitsForArrivalOf)){ ignored.push({stepId:d && d.stepId, sendId:null, reason:"malformed"}); continue; }
      const step = byId.get(d.stepId);
      for(const id of d.waitsForArrivalOf){
        const send = isId(id) ? byId.get(id) : null;
        const reason = !step ? "step_missing" : !isId(id) ? "malformed" : !send ? "send_missing" : send.action!=="SEND" ? "not_send" : !(send.at<step.at) ? "not_earlier" : null;
        if(reason){ ignored.push({stepId:d.stepId, sendId:id, reason}); continue; }
        if(!waits.has(step.id)) waits.set(step.id, []);
        if(!waits.get(step.id).includes(id)) waits.get(step.id).push(id);
      }
    }
    return {waits, ignored};
  }
  /* Envíos que `stepId` puede esperar: SEND de momentos anteriores, en el orden de la Historia. */
  function arrivalCandidates(scenario, stepId){
    const steps = (scenario && scenario.steps) || [], step = steps.find(s=>s.id===stepId);
    return step ? storyboardOrderedSteps(steps).filter(s=>s.action==="SEND" && s.at<step.at) : [];
  }
  /* Envíos (válidos) que espera un Step, y los que espera su momento entero (la unión: el momento es atómico). */
  function stepWaits(scenario, stepId){ return (arrivalDependencies(scenario).waits.get(stepId) || []).slice(); }
  function momentWaits(scenario, at){
    const waits = arrivalDependencies(scenario).waits, out = [];
    for(const s of (scenario && scenario.steps) || []) if(s.at===at) for(const id of waits.get(s.id) || []) if(!out.includes(id)) out.push(id);
    return out;
  }
  /* Forma canónica: entradas ordenadas por stepId, ids únicos y ordenados, sin listas vacías. null = sin dependencias. */
  function canonical(map){
    const out = [...map.entries()].filter(([,ids])=>ids.length).sort((a,b)=>a[0]-b[0])
      .map(([stepId, ids])=>({stepId, waitsForArrivalOf:[...new Set(ids)].sort((a,b)=>a-b)}));
    return out.length ? out : null;
  }
  function rawMap(scenario){
    const map = new Map(), list = scenario && scenario.arrivalDependencies;
    if(Array.isArray(list)) for(const d of list)
      if(d && typeof d==="object" && isId(d.stepId) && Array.isArray(d.waitsForArrivalOf))
        map.set(d.stepId, [...(map.get(d.stepId) || []), ...d.waitsForArrivalOf.filter(isId)]);
    return map;
  }
  /* Quita lo que apunta a Steps que ya no existen (los ids de Step no se reutilizan: nunca volverán a ser válidos).
     Conserva lo que hoy no aplica pero puede volver a aplicar (p. ej. tras reordenar). */
  function pruneArrivalDependencies(scenario){
    const ids = new Set(((scenario && scenario.steps) || []).map(s=>s.id)), map = new Map();
    for(const [stepId, sends] of rawMap(scenario)) if(ids.has(stepId)) map.set(stepId, sends.filter(id=>ids.has(id)));
    return canonical(map);
  }
  /* Activa o quita la espera de `stepId` por `sendId`. Solo acepta envíos válidos (arrivalCandidates). */
  function withArrivalWait(scenario, stepId, sendId, on){
    const map = rawMap(scenario), cur = map.get(stepId) || [];
    if(on){
      if(!arrivalCandidates(scenario, stepId).some(s=>s.id===sendId)) return pruneArrivalDependencies(scenario);
      map.set(stepId, [...cur, sendId]);
    } else map.set(stepId, cur.filter(id=>id!==sendId));
    return pruneArrivalDependencies(Object.assign({}, scenario, {arrivalDependencies: canonical(map) || []}));
  }
  function withoutArrivalWaits(scenario, stepId){
    const map = rawMap(scenario); map.delete(stepId);
    return pruneArrivalDependencies(Object.assign({}, scenario, {arrivalDependencies: canonical(map) || []}));
  }
  /* Duplicar un Step: la copia espera lo mismo que el original. */
  function copyArrivalWaits(scenario, fromId, toId){
    const map = rawMap(scenario);
    if(map.has(fromId)) map.set(toId, map.get(fromId).slice());
    return pruneArrivalDependencies(Object.assign({}, scenario, {arrivalDependencies: canonical(map) || []}));
  }

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
    return {ok:true, playback:started.playback, index:k, at:times[k]};
  }

  /* El texto de Present, el Viewer y el editor (FluyoStory.describe) con el momento en curso según el instante VISIBLE. */
  function describe(phase, scenario, playback, nodeName, edgeEnds){
    const d = FluyoStory.describe(phase, scenario, playback, nodeName, edgeEnds);
    if(phase!=="playing" || !playback || !playback.schedule || !playback.schedule.shifted) return d;
    const idx = momentIndex(playback.schedule.times, playback.cursorVirtual || 0);
    return Object.assign({}, d, {idx, title: idx>=0 && d.moments[idx] && d.moments[idx].label ? d.moments[idx].label : scenario.name});
  }

  return {create, now, isPaused, pause, resume, momentTimes, momentIndex, prevTarget, nextTarget, seek,
          arrivalDependencies, arrivalCandidates, stepWaits, momentWaits, pruneArrivalDependencies, withArrivalWait,
          withoutArrivalWaits, copyArrivalWaits, travelMs, schedule, visibleTrace, start, visibleAt, describe};
})();
