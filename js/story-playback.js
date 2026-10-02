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

  /* Única ejecución del motor: página + Scenario → Trace (o errores con el código del motor).
     No construye Playback ni toca presentación. Lo usan `start` (editor, Present, Viewer)
     y los consumidores sin DOM (p. ej. fluyo-mcp, FLUYO-017.1). */
  function run(page, scenario){
    const structure = {nodes: page.nodes, edges: page.edges};
    const result = FluyoScenarios.runScenario(structure, page.behaviors || [], scenario);
    return result.ok ? {ok:true, trace:result.trace} : {ok:false, errors:result.errors};
  }

  /* Única ejecución con Playback: página + Scenario → Playback listo (o mensajes humanos).
     `nowReal` es el origen del reloj de la reproducción. */
  function start(page, scenario, nowReal){
    const result = run(page, scenario);
    if(!result.ok) return {ok:false, errors:errorMessages(result.errors)};
    const playback = FluyoScenarioPlayback.makePlayback(result.trace, stepMeta(scenario.steps));
    playback.startedAtReal = nowReal;
    return {ok:true, playback};
  }

  /* Resultado por Step, derivado SÓLO del Trace (FLUYO-017.1). No ejecuta ni decide nada:
     lee los eventos que emitió el motor. Un OCCURRENCE es siempre «narrated»: el motor lo
     registra aunque el elemento esté DOWN; no comprueba disponibilidad ni efecto.
     `nodeAvailability` (sólo en OCCURRENCE) se lee de los `state_changed` del propio Trace
     sobre los Behaviors iniciales de la página. Orden = orden efectivo de la Historia. */
  /* Disponibilidad de cada elemento según el Trace: Behaviors iniciales de la página + los
     `state_changed` que emitió el motor. Sólo LEE el Trace (no recalcula resultados).
     perEvent[i] = disponibilidad del elemento del evento i tras ese evento; final = {nodeId: "UP"|"DOWN"}. */
  function availabilityTimeline(events, page){
    const avail = new Map();
    for(const n of page.nodes) avail.set(n.id, "UP");
    for(const b of page.behaviors || []) avail.set(b.nodeId, b.initialState);
    const perEvent = events.map(ev=>{
      if(ev.type==="state_changed") avail.set(ev.nodeId, ev.to);
      return avail.get(ev.nodeId);
    });
    return {perEvent, final:Object.fromEntries(avail)};
  }
  function finalAvailability(trace, page){
    return availabilityTimeline((trace && trace.events) || [], page).final;
  }

  const NARRATED_NOTE = "El motor registra la ocurrencia; no comprueba disponibilidad ni efecto.";
  function outcomes(trace, scenario, page){
    const events = (trace && trace.events) || [];
    const byStep = new Map();
    events.forEach((ev, i)=>{
      if(!byStep.has(ev.stepId)) byStep.set(ev.stepId, []);
      byStep.get(ev.stepId).push(i);
    });
    const edgeOf = id => page.edges.find(e=>e.id===id) || null;
    const availAt = availabilityTimeline(events, page).perEvent;
    return storyboardOrderedSteps(scenario.steps).map(step=>{
      const idx = byStep.get(step.id) || [];
      const evs = idx.map(i=>events[i]);
      const out = {stepId:step.id, at:step.at, action:step.action, eventIndexes:idx};
      if(step.eventTypeId!==undefined) out.eventTypeId = step.eventTypeId;
      if(step.action==="SEND"){
        out.edgeId = step.edgeId;
        const end = evs.find(e=>e.type==="send_succeeded" || e.type==="send_failed");
        if(!end) out.status = "not_executed";
        else if(end.type==="send_succeeded") out.status = "completed";
        else{
          const e = edgeOf(step.edgeId);
          out.status = "not_completed";
          out.reason = end.reason;
          if(e) out.reasonNodeId = end.reason==="source_down" ? e.from : e.to;
        }
      }else if(step.action==="SET_STATE"){
        out.nodeId = step.nodeId; out.state = step.state;
        const ch = evs.find(e=>e.type==="state_changed");
        if(ch){ out.status = "state_changed"; out.from = ch.from; out.to = ch.to; }
        else out.status = "no_change";
      }else{
        out.nodeId = step.nodeId;
        const ocIdx = idx.find(i=>events[i].type==="event_occurred");
        if(ocIdx===undefined) out.status = "not_executed";
        else{
          out.status = "narrated";
          out.nodeAvailability = availAt[ocIdx];
          out.note = NARRATED_NOTE;
        }
      }
      return out;
    });
  }

  /* Frase humana de un Step (misma regla que el panel de Historia): FLOW usa origen y destino
     de la conexión; los eventos de elemento sólo el elemento. `et` puede ser null. */
  function nodeText(page, id){
    const n = page.nodes.find(x=>x.id===id);
    return n ? ((n.label || "").split("\n")[0].trim() || "Elemento sin nombre") : "Elemento sin nombre";
  }
  function sentence(page, step, et){
    if(!et) return "";
    if(step.action==="SEND"){
      const e = page.edges.find(x=>x.id===step.edgeId);
      return renderEventSentence(et, e ? nodeText(page,e.from) : "?", e ? nodeText(page,e.to) : "?");
    }
    return renderEventSentence(et, null, nodeText(page, step.nodeId));
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
          moments, currentIndex, caption, failedCount, summary, CAPTION_MS, MAX_DOTS,
          run, outcomes, finalAvailability, sentence, NARRATED_NOTE};
})();

/* API histórica de Present (FLUYO-013): mismas funciones, ahora compartidas. */
var FluyoPresentStory = FluyoStory;
