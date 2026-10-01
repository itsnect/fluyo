"use strict";
/* FLUYO-014. Núcleo COMPARTIDO de reproducción de una Historia. Lo usan el
   editor (Scenarios), Present y el Viewer de /s/; ninguno tiene su propia receta:

     Scenario ──→ FluyoStory ──→ scenario-engine ──→ Trace ──→ scenario-playback ──→ render.js

   Puro: sin DOM, RAF, timers, almacenamiento ni estado del editor. Sólo lee las
   globales de model.js (eventTypeById, eventSymbol, nodeEffectsVisualSpec,
   connectionVisualSpec, defaultNodeEffects, DEFAULT_EVENT_MOTION). Cargar tras model.js,
   scenario-engine.js y scenario-playback.js. Ejecutable en Node (vm). */

var FluyoStory = (function(){
  /* Metadata visual por Step que consume el Playback (símbolo, movimiento,
     efectos de elemento, nombre). La presentación nunca altera el Trace. */
  function playbackEffects(et){
    const {symbol, ...fx} = nodeEffectsVisualSpec(et);
    return fx;
  }
  function stepMeta(steps){
    const meta = {};
    for(const step of steps){
      const et = step.eventTypeId ? eventTypeById(step.eventTypeId) : null;
      meta[step.id] = {
        token: et ? eventSymbol(et) : "",
        motion: et && et.motion ? et.motion : DEFAULT_EVENT_MOTION,
        nodeEffects: et ? playbackEffects(et) : defaultNodeEffects(),
        connection: et ? connectionVisualSpec(et) : null,
        name: et ? et.name : ""
      };
    }
    return meta;
  }

  /* Código del motor → mensaje humano (sin jerga). */
  const ERROR_MESSAGES = {
    missing_node: "Un evento apunta a un elemento que ya no existe.",
    missing_edge: "Un evento apunta a una conexión que ya no existe.",
    missing_edge_endpoint: "Una conexión del diagrama tiene un extremo perdido.",
    duplicate_structure_id: "Hay elementos o conexiones duplicados.",
    duplicate_node_id: "Hay elementos duplicados.",
    duplicate_edge_id: "Hay conexiones duplicadas.",
    unsupported_engine_version: "Esta historia usa una versión de ejecución no soportada.",
    guard_exceeded: "La historia excede un límite operativo de ejecución.",
    invalid_timestamp: "Un evento tiene un tiempo fuera de rango.",
    invalid_structure: "La estructura de la página no es válida.",
    invalid_behavior: "El estado inicial de un nodo no es válido.",
    invalid_scenario: "La historia tiene datos inválidos.",
    invalid_state: "Un evento tiene una disponibilidad no válida.",
    unknown_action: "Un evento tiene una acción desconocida.",
    duplicate_step_id: "Hay eventos duplicados en la historia."
  };
  const ERROR_FALLBACK = "No se pudo reproducir. Revisa la historia y consulta los detalles técnicos.";
  function errorMessages(errors){
    const seen = new Set(), out = [];
    for(const err of errors || []){
      const msg = ERROR_MESSAGES[err.code] || ERROR_FALLBACK;
      if(!seen.has(msg)){ seen.add(msg); out.push(msg); }
    }
    return out;
  }

  /* Única ejecución: página + Scenario → Playback listo (o mensajes humanos).
     `nowReal` es el origen del reloj de la reproducción. */
  function start(page, scenario, nowReal){
    const structure = {nodes: page.nodes, edges: page.edges};
    const result = FluyoScenarios.runScenario(structure, page.behaviors || [], scenario);
    if(!result.ok) return {ok:false, errors:errorMessages(result.errors)};
    const playback = FluyoScenarioPlayback.makePlayback(result.trace, stepMeta(scenario.steps));
    playback.startedAtReal = nowReal;
    return {ok:true, playback};
  }

  /* ¿Ya no queda nada por emitir ni por verse? */
  function isFinished(pb){
    return pb.nextEventIndex >= (pb.trace.events || []).length &&
      pb.activeSends.length === 0 &&
      pb.completedSends.length === 0 &&
      pb.activeOccurrences.length === 0 &&
      pb.activeNodeEffects.length === 0;
  }

  /* Proyección de pintura que recibe render.js como `scenarioRuntime`. */
  function renderState(pb, scenario, nowReal){
    const rs = FluyoScenarioPlayback.tick(pb, nowReal);
    return {
      nodeStates: rs.nodeStates,
      activeSends: rs.activeSends,
      completedSends: rs.completedSends,
      activeOccurrences: rs.activeOccurrences,
      completedOccurrences: rs.completedOccurrences,
      activeNodeEffects: rs.activeNodeEffects,
      completedNodeEffects: rs.completedNodeEffects,
      scenario,
      suppressFlow: true
    };
  }

  /* ─────────── Texto humano (Present y Viewer): sólo traduce, no ejecuta ─────────── */
  const CAPTION_MS = 2600;   // cuánto se mantiene un mensaje de consecuencia
  const MAX_DOTS = 12;       // por encima, el progreso se resume en «n / total»

  /* Momentos de la Historia (grupos por `at`) con un nombre humano:
     los nombres de sus Eventos, sin repetir, en el orden de resolución. */
  function moments(groups, nameOfStep){
    return (groups||[]).map(g=>{
      const names=[];
      for(const s of g.steps){
        const n=(nameOfStep(s)||"").trim();
        if(n && !names.includes(n)) names.push(n);
      }
      return {at:g.at, label:names.join(" · ")};
    });
  }
  /* Índice del último momento alcanzado (−1 si aún no empezó). */
  function currentIndex(ms, virtualTime){
    let idx=-1;
    for(let i=0;i<ms.length;i++){ if(ms[i].at<=virtualTime) idx=i; else break; }
    return idx;
  }
  /* Mensaje de consecuencia vigente, en lenguaje humano. Nunca expone razones
     internas: «target_down» → «Kafka no está disponible». */
  function caption(logEvents, virtualTime, nodeName, edgeEnds){
    let found=null;
    for(const ev of (logEvents||[])){
      if(ev.at>virtualTime || virtualTime-ev.at>=CAPTION_MS) continue;
      if(ev.type==="send_failed"){
        const e=edgeEnds(ev.edgeId)||{};
        const who=nodeName(ev.reason==="source_down"?e.from:e.to);
        found="No se completó · "+who+" no está disponible";
      } else if(ev.type==="state_changed"){
        const who=nodeName(ev.nodeId);
        found= ev.to==="DOWN" ? who+" no está disponible" : who+" vuelve a estar disponible";
      }
    }
    return found;
  }
  /* Eventos que no se completaron (pasos distintos), para el cierre. */
  function failedCount(logEvents){
    const ids=new Set();
    for(const ev of (logEvents||[])) if(ev.type==="send_failed") ids.add(ev.stepId);
    return ids.size;
  }
  function summary(failed){
    if(!failed) return "";
    return failed===1 ? "1 evento no pudo realizarse" : failed+" eventos no pudieron realizarse";
  }

  /* Modelo de presentación de una Historia en una fase (ready | playing | finished):
     título, momento en curso, mensaje y cierre. Lo pintan Present y el Viewer. */
  function describe(phase, scenario, playback, nodeName, edgeEnds){
    const ms = moments(storyboardGroups(scenario.steps), s=>{
      const et = s.eventTypeId ? eventTypeById(s.eventTypeId) : null;
      return et ? et.name : "";
    });
    const vt = playback ? playback.cursorVirtual : 0;
    const idx = phase==="finished" ? ms.length-1 : phase==="playing" ? currentIndex(ms, vt) : -1;
    const title = phase==="ready" ? scenario.name : (idx>=0 && ms[idx].label ? ms[idx].label : scenario.name);
    let cap = "", sum = "";
    if(phase==="playing"){
      cap = caption(playback && playback.logEvents, vt, nodeName, edgeEnds) || "";
    } else if(phase==="finished"){
      cap = "Reproducción terminada";
      sum = summary(failedCount(playback && playback.logEvents));
    }
    return {moments:ms, idx, title, caption:cap, summary:sum};
  }

  return {describe, playbackEffects, stepMeta, errorMessages, start, isFinished, renderState,
          moments, currentIndex, caption, failedCount, summary, CAPTION_MS, MAX_DOTS};
})();

/* API histórica de Present (FLUYO-013): mismas funciones, ahora compartidas. */
var FluyoPresentStory = FluyoStory;
