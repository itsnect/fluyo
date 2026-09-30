"use strict";
/* Playback puro de Scenarios: proyecta un Trace + tiempo virtual a datos de
   pintura. Sin DOM, RAF, Canvas ni estado del editor. Puede ejecutarse en Node. */

var FluyoScenarioPlayback = (function(){
  const DEFAULT_SEND_MS = 1100;   // duración visual por defecto de la partícula SEND (normal)
  const NODE_EFFECT_CUE_MS = 1100; // duración visual de los efectos sobre nodos
  const TERMINAL_MS = 700;        // tiempo visible del marcador de resultado
  const MOTION_MS = {fast:500, normal:1100, slow:1800};

  function sendDuration(stepMeta, stepId){
    const meta = stepMeta && stepMeta[stepId];
    if(meta && meta.motion && MOTION_MS[meta.motion]) return MOTION_MS[meta.motion];
    return DEFAULT_SEND_MS;
  }
  function sendToken(stepMeta, stepId){
    const meta = stepMeta && stepMeta[stepId];
    return (meta && meta.token) || "";
  }
  function nodeEffects(stepMeta, stepId){
    const meta = stepMeta && stepMeta[stepId];
    return (meta && meta.nodeEffects) || {showSymbol:false,message:"",messageColor:"",messageSize:"medium",messageWeight:"normal",messageFont:"default",messagePosition:"above",highlight:false,blink:false,dim:false,fillColor:""};
  }

  function makePlayback(trace, stepMeta){
    return {
      trace: trace,
      stepMeta: stepMeta || null,
      startedAtReal: 0,
      cursorVirtual: 0,
      nextEventIndex: 0,
      nodeStates: {},   // nodeId -> "UP"|"DOWN"
      activeSends: [],  // {stepId, edgeId, virtualAt, terminal:{type,reason}|null, startedReal, duration, token}
      completedSends: [], // {stepId, edgeId, virtualAt, terminalType, terminalReason, doneReal, token}
      activeOccurrences: [], // {stepId, nodeId, virtualAt, startedReal, token}
      completedOccurrences: [], // {stepId, nodeId, virtualAt, doneReal, token}
      activeNodeEffects: [], // {stepId, nodeId, virtualAt, startedReal, duration, effects, token}
      completedNodeEffects: [], // {stepId, nodeId, virtualAt, doneReal, effects, token}
      logEvents: []
    };
  }

  function processEvent(pb, ev, nowReal){
    switch(ev.type){
      case "state_changed":
        pb.nodeStates[ev.nodeId] = ev.to;
        pb.activeNodeEffects.push({stepId:ev.stepId, nodeId:ev.nodeId, virtualAt:ev.at, startedReal:pb.startedAtReal + ev.at, duration:NODE_EFFECT_CUE_MS, effects:nodeEffects(pb.stepMeta, ev.stepId), token:sendToken(pb.stepMeta, ev.stepId)});
        pb.logEvents.push({at:ev.at, type:"state_changed", nodeId:ev.nodeId, from:ev.from, to:ev.to, stepId:ev.stepId});
        break;
      case "event_occurred":
        pb.activeOccurrences.push({stepId:ev.stepId, nodeId:ev.nodeId, virtualAt:ev.at, startedReal:pb.startedAtReal + ev.at, token:sendToken(pb.stepMeta, ev.stepId)});
        pb.activeNodeEffects.push({stepId:ev.stepId, nodeId:ev.nodeId, virtualAt:ev.at, startedReal:pb.startedAtReal + ev.at, duration:NODE_EFFECT_CUE_MS, effects:nodeEffects(pb.stepMeta, ev.stepId), token:sendToken(pb.stepMeta, ev.stepId)});
        pb.logEvents.push({at:ev.at, type:"event_occurred", nodeId:ev.nodeId, stepId:ev.stepId});
        break;
      case "send_started":
        // El tiempo real de inicio de la partícula deriva del tiempo virtual,
        // para que saltos del cursor conserven la duración visual correcta.
        pb.activeSends.push({stepId:ev.stepId, edgeId:ev.edgeId, virtualAt:ev.at, terminal:null, startedReal:pb.startedAtReal + ev.at, duration:sendDuration(pb.stepMeta, ev.stepId), token:sendToken(pb.stepMeta, ev.stepId)});
        pb.logEvents.push({at:ev.at, type:"send_started", edgeId:ev.edgeId, stepId:ev.stepId});
        break;
      case "send_succeeded":
      case "send_failed":{
        const send = pb.activeSends.find(s => s.stepId===ev.stepId);
        if(send){
          send.terminal = {type:ev.type, reason:ev.reason};
        } else {
          // Terminal sin started previo (no debería ocurrir en v1): mostrar como completado inmediato
          pb.completedSends.push({stepId:ev.stepId, edgeId:ev.edgeId, virtualAt:ev.at, terminalType:ev.type, terminalReason:ev.reason, doneReal:nowReal, token:sendToken(pb.stepMeta, ev.stepId)});
        }
        pb.logEvents.push({at:ev.at, type:ev.type, edgeId:ev.edgeId, stepId:ev.stepId, reason:ev.reason});
        break;
      }
    }
  }

  function tick(pb, nowReal){
    pb.cursorVirtual = Math.max(0, nowReal - pb.startedAtReal);

    // Consumir eventos cuyo timestamp virtual ha sido alcanzado
    const events = pb.trace && pb.trace.events ? pb.trace.events : [];
    while(pb.nextEventIndex < events.length){
      const ev = events[pb.nextEventIndex];
      if(ev.at > pb.cursorVirtual) break;
      pb.nextEventIndex++;
      processEvent(pb, ev, nowReal);
    }

    // Promover partículas cuyo terminal ya ha pasado el tiempo visual
    pb.activeSends = pb.activeSends.filter(send => {
      const particleEnd = send.startedReal + send.duration;
      if(send.terminal && nowReal >= particleEnd){
        pb.completedSends.push({
          stepId: send.stepId,
          edgeId: send.edgeId,
          virtualAt: send.virtualAt,
          terminalType: send.terminal.type,
          terminalReason: send.terminal.reason,
          doneReal: particleEnd,
          token: send.token
        });
        return false;
      }
      return true;
    });

    // Promover occurrences cuyo cue ya ha terminado
    pb.activeOccurrences = pb.activeOccurrences.filter(occ => {
      const cueEnd = occ.startedReal + NODE_EFFECT_CUE_MS;
      if(nowReal >= cueEnd){
        pb.completedOccurrences.push({
          stepId: occ.stepId,
          nodeId: occ.nodeId,
          virtualAt: occ.virtualAt,
          doneReal: cueEnd
        });
        return false;
      }
      return true;
    });

    // Promover efectos de nodo cuyo cue ya ha terminado
    pb.activeNodeEffects = pb.activeNodeEffects.filter(fx => {
      const cueEnd = fx.startedReal + fx.duration;
      if(nowReal >= cueEnd){
        pb.completedNodeEffects.push({
          stepId: fx.stepId,
          nodeId: fx.nodeId,
          virtualAt: fx.virtualAt,
          doneReal: cueEnd,
          effects: fx.effects,
          token: fx.token
        });
        return false;
      }
      return true;
    });

    // Expirar terminales completados
    pb.completedSends = pb.completedSends.filter(send => (nowReal - send.doneReal) < TERMINAL_MS);
    pb.completedOccurrences = pb.completedOccurrences.filter(occ => (nowReal - occ.doneReal) < TERMINAL_MS);
    pb.completedNodeEffects = pb.completedNodeEffects.filter(fx => (nowReal - fx.doneReal) < TERMINAL_MS);

    const totalEvents = events.length;
    const finished = pb.nextEventIndex >= totalEvents && pb.activeSends.length===0 && pb.completedSends.length===0 && pb.activeOccurrences.length===0 && pb.completedOccurrences.length===0 && pb.activeNodeEffects.length===0 && pb.completedNodeEffects.length===0;

    return {
      nodeStates: {...pb.nodeStates},
      activeSends: pb.activeSends.map(send => ({
        stepId: send.stepId,
        edgeId: send.edgeId,
        progress: Math.min(1, (nowReal - send.startedReal) / send.duration),
        duration: send.duration,
        token: send.token
      })),
      completedSends: pb.completedSends.map(s => ({...s})),
      activeOccurrences: pb.activeOccurrences.map(occ => ({
        stepId: occ.stepId,
        nodeId: occ.nodeId,
        progress: Math.min(1, (nowReal - occ.startedReal) / NODE_EFFECT_CUE_MS),
        token: occ.token
      })),
      completedOccurrences: pb.completedOccurrences.map(o => ({...o})),
      activeNodeEffects: pb.activeNodeEffects.map(fx => ({
        stepId: fx.stepId,
        nodeId: fx.nodeId,
        progress: Math.min(1, (nowReal - fx.startedReal) / fx.duration),
        duration: fx.duration,
        effects: fx.effects,
        token: fx.token
      })),
      completedNodeEffects: pb.completedNodeEffects.map(f => ({...f})),
      virtualTime: pb.cursorVirtual,
      logEvents: pb.logEvents.slice(),
      finished
    };
  }

  return {makePlayback, tick, SEND_PARTICLE_MS: DEFAULT_SEND_MS, NODE_EFFECT_CUE_MS, TERMINAL_MS, MOTION_MS};
})();
