"use strict";
/* Motor puro y determinista de Scenarios v1.
   Sin DOM, Canvas, timers, relojes reales, aleatoriedad ni estado mutable externo.
   Se ejecuta en Node cargándolo como script clásico en un contexto limpio. */

var FluyoScenarios = (function(){
  /* ===================== Constantes ===================== */
  const ENGINE_VERSION = 1;
  const MAX_SCENARIO_STEPS = 1000;
  const MAX_RUNTIME_JOBS = 2000;
  const MAX_TRACE_EVENTS = 2000;
  const MAX_VIRTUAL_TIME_MS = 86400000;
  const MAX_STRUCTURE_ENTITIES = 10000;
  const VALID_STATES = new Set(["UP", "DOWN"]);
  const VALID_ACTIONS = new Set(["SET_STATE", "SEND"]);

  /* ===================== Utilidades ===================== */
  const isPosInt = v => Number.isSafeInteger(v) && v >= 1;
  const isRecord=v=>v!==null && typeof v==="object" && !Array.isArray(v);
  function err(code, extra={}){ return {ok:false, errors:[{code, ...extra}]}; }

  /* ===================== Validación ===================== */
  function validateExecution(structure, behaviors, scenario){
    // Fases locales: shape/tipos/duplicados → referencias → guards. Nunca
    // consultar un target cuyo registro/tipo es inválido ni emitir durante QA.
    const shape=[], references=[], guards=[], pending=[];
    const add=(list,code,path,extra={})=>list.push({code,path,...extra});
    const nodeIds=new Set(), edgeIds=new Set(), entityIds=new Set();
    const graphValid=isRecord(structure) && Array.isArray(structure.nodes) && Array.isArray(structure.edges);
    if(!graphValid) add(shape,"invalid_structure","structure");
    else{
      for(let i=0;i<structure.nodes.length;i++){
        const n=structure.nodes[i],path=`structure.nodes[${i}]`;
        if(!isRecord(n) || !isPosInt(n.id)){ add(shape,"invalid_structure",path); continue; }
        if(entityIds.has(n.id)) add(shape,"duplicate_node_id",path,{nodeId:n.id});
        entityIds.add(n.id); nodeIds.add(n.id);
      }
      for(let i=0;i<structure.edges.length;i++){
        const e=structure.edges[i],path=`structure.edges[${i}]`;
        if(!isRecord(e) || !isPosInt(e.id)){ add(shape,"invalid_structure",path); continue; }
        const before=shape.length;
        if(entityIds.has(e.id)) add(shape,nodeIds.has(e.id)?"duplicate_structure_id":"duplicate_edge_id",path,{edgeId:e.id});
        entityIds.add(e.id); edgeIds.add(e.id);
        for(const endpoint of ["from","to"]){
          if(!isPosInt(e[endpoint])) add(shape,"edge_missing_endpoints",`${path}.${endpoint}`,{edgeId:e.id});
        }
        if(before===shape.length) for(const endpoint of ["from","to"])
          pending.push({kind:"node",id:e[endpoint],code:"missing_edge_endpoint",path:`${path}.${endpoint}`,extra:{edgeId:e.id,endpoint}});
      }
      for(const key of ["nodes","edges"]) if(structure[key].length>MAX_STRUCTURE_ENTITIES)
        add(guards,"guard_exceeded",`structure.${key}`,{limit:MAX_STRUCTURE_ENTITIES});
    }

    if(!Array.isArray(behaviors)) add(shape,"invalid_behavior","behaviors");
    else{
      const seen=new Set();
      for(let i=0;i<behaviors.length;i++){
        const b=behaviors[i],path=`behaviors[${i}]`;
        if(!isRecord(b) || !isPosInt(b.nodeId) || !VALID_STATES.has(b.initialState)){
          add(shape,"invalid_behavior",path); continue;
        }
        if(seen.has(b.nodeId)) add(shape,"duplicate_behavior_node",path,{nodeId:b.nodeId});
        else pending.push({kind:"node",id:b.nodeId,code:"missing_behavior_node",path,extra:{nodeId:b.nodeId}});
        seen.add(b.nodeId);
      }
    }

    if(!isRecord(scenario)) add(shape,"invalid_scenario","scenario");
    else{
      if(!isPosInt(scenario.id)) add(shape,"invalid_scenario","scenario.id");
      // El bloque de versión se mantiene explícito: nunca reinterpretar v2.
      if(!Number.isSafeInteger(scenario.engineVersion))
        add(shape,"invalid_scenario","scenario.engineVersion");
      else if(scenario.engineVersion<1)
        add(shape,"invalid_scenario","scenario.engineVersion");
      else if(scenario.engineVersion !== ENGINE_VERSION)
        add(shape,"unsupported_engine_version","scenario.engineVersion",{engineVersion:scenario.engineVersion,supported:ENGINE_VERSION});
      if(typeof scenario.name !== "string" || scenario.name.trim().length===0 || scenario.name.length>120)
        add(shape,"invalid_scenario","scenario.name");
      if(!isPosInt(scenario.nextStepId)) add(shape,"invalid_scenario","scenario.nextStepId");
      if(!Array.isArray(scenario.steps)) add(shape,"invalid_scenario","scenario.steps");
      else if(scenario.engineVersion===ENGINE_VERSION){
        const stepIds=new Set();let maxStepId=0;
        for(let i=0;i<scenario.steps.length;i++){
          const step=scenario.steps[i],path=`scenario.steps[${i}]`,before=shape.length;
          if(!isRecord(step) || !isPosInt(step.id)){ add(shape,"invalid_scenario",path,{field:"id"}); continue; }
          const extra={stepId:step.id};
          if(stepIds.has(step.id)) add(shape,"duplicate_step_id",path,extra);
          stepIds.add(step.id); maxStepId=Math.max(maxStepId,step.id);
          if(!Number.isSafeInteger(step.at) || step.at<0) add(shape,"invalid_timestamp",path,extra);
          else if(step.at>MAX_VIRTUAL_TIME_MS) add(guards,"invalid_timestamp",path,{...extra,limit:MAX_VIRTUAL_TIME_MS});
          if(!VALID_ACTIONS.has(step.action)){ add(shape,"unknown_action",path,extra); continue; }
          const allowed=step.action==="SET_STATE"?["id","at","action","nodeId","state"]:["id","at","action","edgeId"];
          if(Object.keys(step).length!==allowed.length || !allowed.every(k=>Object.prototype.hasOwnProperty.call(step,k)))
            add(shape,"invalid_scenario",path,{...extra,reason:"extra_fields"});
          if(step.action==="SET_STATE"){
            if(!isPosInt(step.nodeId) || !VALID_STATES.has(step.state)) add(shape,"invalid_state",path,extra);
            if(before===shape.length) pending.push({kind:"node",id:step.nodeId,code:"missing_node",path,extra:{...extra,nodeId:step.nodeId}});
          }else{
            if(!isPosInt(step.edgeId)) add(shape,"invalid_scenario",path,extra);
            if(before===shape.length) pending.push({kind:"edge",id:step.edgeId,code:"missing_edge",path,extra:{...extra,edgeId:step.edgeId}});
          }
        }
        if(isPosInt(scenario.nextStepId) && scenario.nextStepId<=maxStepId) add(shape,"invalid_scenario","scenario.nextStepId");
        if(scenario.steps.length>MAX_SCENARIO_STEPS) add(guards,"guard_exceeded","scenario.steps",{limit:MAX_SCENARIO_STEPS});
      }
    }
    if(graphValid) for(const ref of pending){
      if(!(ref.kind==="node"?nodeIds:edgeIds).has(ref.id)) add(references,ref.code,ref.path,ref.extra);
    }
    return [...shape,...references,...guards];
  }

  /* ===================== Ejecución ===================== */
  function buildInitialStates(structure, behaviors){
    const states = new Map();
    for(const n of structure.nodes) states.set(n.id, "UP");
    for(const b of behaviors) states.set(b.nodeId, b.initialState);
    return states;
  }

  function enqueueSteps(scenario){
    const queue = [];
    for(let i=0;i<scenario.steps.length;i++){
      const step=scenario.steps[i];
      queue.push({at:step.at, sequence:i, step});
    }
    queue.sort((a,b)=>{
      if(a.at !== b.at) return a.at - b.at;
      return a.sequence - b.sequence;
    });
    return queue;
  }

  function runScenario(structure, behaviors, scenario){
    /* Validación completa antes de cualquier emisión. */
    const errors=validateExecution(structure, behaviors, scenario);
    if(errors.length) return {ok:false,errors};

    const states = buildInitialStates(structure, behaviors);
    const queue = enqueueSteps(scenario);
    const events = [];
    let virtualTime = 0;
    let nextSequence = scenario.steps.length;
    let jobsProcessed = 0;

    const edgeMap = new Map();
    for(const e of structure.edges) edgeMap.set(e.id, e);

    let cursor=0;
    while(cursor < queue.length){
      if(jobsProcessed >= MAX_RUNTIME_JOBS)
        return err("guard_exceeded", {path:"runtime.jobs", limit:MAX_RUNTIME_JOBS});
      const job = queue[cursor++];
      jobsProcessed++;
      virtualTime = job.at;
      const step = job.step;

      if(step.action === "SET_STATE"){
        const current = states.get(step.nodeId);
        if(current !== step.state){
          if(events.length >= MAX_TRACE_EVENTS)
            return err("guard_exceeded", {path:"trace.events", limit:MAX_TRACE_EVENTS});
          events.push({at:virtualTime, type:"state_changed", stepId:step.id, nodeId:step.nodeId, from:current, to:step.state});
          states.set(step.nodeId, step.state);
        }
      } else { // SEND
        if(events.length >= MAX_TRACE_EVENTS)
          return err("guard_exceeded", {path:"trace.events", limit:MAX_TRACE_EVENTS});
        events.push({at:virtualTime, type:"send_started", stepId:step.id, edgeId:step.edgeId});

        const edge = edgeMap.get(step.edgeId);
        const sourceState = states.get(edge.from);
        const targetState = states.get(edge.to);
        let result;
        if(sourceState === "DOWN") result = {type:"send_failed", reason:"source_down"};
        else if(targetState === "DOWN") result = {type:"send_failed", reason:"target_down"};
        else result = {type:"send_succeeded"};

        if(events.length >= MAX_TRACE_EVENTS)
          return err("guard_exceeded", {path:"trace.events", limit:MAX_TRACE_EVENTS});
        const terminal = {at:virtualTime, type:result.type, stepId:step.id, edgeId:step.edgeId};
        if(result.reason) terminal.reason = result.reason;
        events.push(terminal);
      }
    }

    return {
      ok:true,
      trace:{
        engineVersion: ENGINE_VERSION,
        scenarioId: scenario.id,
        events
      }
    };
  }

  return {
    ENGINE_VERSION,
    MAX_SCENARIO_STEPS,
    MAX_RUNTIME_JOBS,
    MAX_TRACE_EVENTS,
    MAX_VIRTUAL_TIME_MS,
    MAX_STRUCTURE_ENTITIES,
    runScenario
  };
})();
