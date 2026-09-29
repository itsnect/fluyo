"use strict";
/* FLUYO-008 — Tests del motor puro de Scenarios.
   Sin DOM, Canvas, timers ni red: node --test test/scenarios.test.cjs */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makeEngine(){
  const context=vm.createContext({
    console,
    Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError,
    // No DOM, Date, performance, timers, storage, fetch ni globals del editor.
  });
  vm.runInContext(read('js/scenario-engine.js'), context);
  return context.FluyoScenarios;
}

/* Estructura canónica de la tarea. */
function canonicalStructure(){
  return {
    nodes:[
      {id:1, label:"Producer"},
      {id:2, label:"Kafka"},
      {id:3, label:"Consumer"},
      {id:4, label:"PostgreSQL"}
    ],
    edges:[
      {id:5, from:1, to:2},
      {id:6, from:2, to:3},
      {id:7, from:3, to:4}
    ]
  };
}
function canonicalScenario(){
  return {
    id:1,
    engineVersion:1,
    name:"Caída de Kafka",
    nextStepId:5,
    steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:2, state:"DOWN"},
      {id:2, at:1000, action:"SEND", edgeId:5},
      {id:3, at:5000, action:"SET_STATE", nodeId:2, state:"UP"},
      {id:4, at:6000, action:"SEND", edgeId:5}
    ]
  };
}
const EXPECTED_CANONICAL_TRACE={
  engineVersion:2,
  scenarioId:1,
  events:[
    {at:0, type:"state_changed", stepId:1, nodeId:2, from:"UP", to:"DOWN"},
    {at:1000, type:"send_started", stepId:2, edgeId:5},
    {at:1000, type:"send_failed", stepId:2, edgeId:5, reason:"target_down"},
    {at:5000, type:"state_changed", stepId:3, nodeId:2, from:"DOWN", to:"UP"},
    {at:6000, type:"send_started", stepId:4, edgeId:5},
    {at:6000, type:"send_succeeded", stepId:4, edgeId:5}
  ]
};

/* ===================== Tests de contrato y determinismo ===================== */

test('Trace canónico exacto',()=>{
  const engine=makeEngine();
  const res=engine.runScenario(canonicalStructure(), [], canonicalScenario());
  assert.equal(res.ok, true);
  assert.equal(JSON.stringify(res.trace), JSON.stringify(EXPECTED_CANONICAL_TRACE));
});

test('Determinismo: 100 ejecuciones producen Trace idéntico',()=>{
  const engine=makeEngine();
  let first;
  for(let i=0;i<100;i++){
    const res=engine.runScenario(canonicalStructure(), [], canonicalScenario());
    assert.equal(res.ok, true);
    const serialized=JSON.stringify(res.trace);
    if(i===0) first=serialized;
    assert.equal(serialized, first);
  }
});

test('Inputs congelados no se mutan',()=>{
  const engine=makeEngine();
  const structure=canonicalStructure();
  const behaviors=[];
  const scenario=canonicalScenario();
  const before={structure:JSON.stringify(structure), behaviors:JSON.stringify(behaviors), scenario:JSON.stringify(scenario)};
  engine.runScenario(structure, behaviors, scenario);
  assert.equal(JSON.stringify(structure), before.structure);
  assert.equal(JSON.stringify(behaviors), before.behaviors);
  assert.equal(JSON.stringify(scenario), before.scenario);
});

/* ===================== Orden semántico ===================== */

test('tie-break: SET_STATE DOWN antes de SEND provoca fallo',()=>{
  const engine=makeEngine();
  const scenario={
    id:1, engineVersion:1, name:"orden-1", nextStepId:3,
    steps:[
      {id:1, at:1000, action:"SET_STATE", nodeId:2, state:"DOWN"},
      {id:2, at:1000, action:"SEND", edgeId:5}
    ]
  };
  const res=engine.runScenario(canonicalStructure(), [], scenario);
  assert.equal(res.ok, true);
  const failed=res.trace.events.find(e=>e.type==="send_failed");
  assert.ok(failed);
  assert.equal(failed.reason, "target_down");
});

test('tie-break: SEND antes de SET_STATE DOWN tiene éxito',()=>{
  const engine=makeEngine();
  const scenario={
    id:1, engineVersion:1, name:"orden-2", nextStepId:3,
    steps:[
      {id:1, at:1000, action:"SEND", edgeId:5},
      {id:2, at:1000, action:"SET_STATE", nodeId:2, state:"DOWN"}
    ]
  };
  const res=engine.runScenario(canonicalStructure(), [], scenario);
  assert.equal(res.ok, true);
  const succeeded=res.trace.events.find(e=>e.type==="send_succeeded");
  assert.ok(succeeded);
});

/* IDs invertidos respecto al orden del array: si el motor usara step.id como
   tie-break, estos casos fallarían porque el ID mayor aparece primero. */
test('tie-break: IDs invertidos, SET_STATE DOWN antes de SEND provoca fallo',()=>{
  const engine=makeEngine();
  const scenario={
    id:1, engineVersion:1, name:"orden-id-1", nextStepId:100,
    steps:[
      {id:99, at:1000, action:"SET_STATE", nodeId:2, state:"DOWN"},
      {id:1, at:1000, action:"SEND", edgeId:5}
    ]
  };
  const res=engine.runScenario(canonicalStructure(), [], scenario);
  assert.equal(res.ok, true);
  const failed=res.trace.events.find(e=>e.type==="send_failed");
  assert.ok(failed);
  assert.equal(failed.reason, "target_down");
});

test('tie-break: IDs invertidos, SEND antes de SET_STATE DOWN tiene éxito',()=>{
  const engine=makeEngine();
  const scenario={
    id:1, engineVersion:1, name:"orden-id-2", nextStepId:100,
    steps:[
      {id:99, at:1000, action:"SEND", edgeId:5},
      {id:1, at:1000, action:"SET_STATE", nodeId:2, state:"DOWN"}
    ]
  };
  const res=engine.runScenario(canonicalStructure(), [], scenario);
  assert.equal(res.ok, true);
  const succeeded=res.trace.events.find(e=>e.type==="send_succeeded");
  assert.ok(succeeded);
});

/* ===================== SET_STATE ===================== */

test('SET_STATE repetido al estado actual no emite evento',()=>{
  const engine=makeEngine();
  const scenario={
    id:1, engineVersion:1, name:"rep", nextStepId:2,
    steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:2, state:"UP"}
    ]
  };
  const res=engine.runScenario(canonicalStructure(), [], scenario);
  assert.equal(res.ok, true);
  assert.equal(JSON.stringify(res.trace.events), "[]");
});

test('Behavior inicial DOWN se refleja sin evento inicial',()=>{
  const engine=makeEngine();
  const scenario={
    id:1, engineVersion:1, name:"init", nextStepId:2,
    steps:[
      {id:1, at:1000, action:"SEND", edgeId:5}
    ]
  };
  const res=engine.runScenario(canonicalStructure(), [{nodeId:1, initialState:"DOWN"}], scenario);
  assert.equal(res.ok, true);
  assert.equal(res.trace.events[0].type, "send_started");
  assert.equal(res.trace.events[1].type, "send_failed");
  assert.equal(res.trace.events[1].reason, "source_down");
});

/* ===================== SEND matrix ===================== */

const SEND_CASES=[
  {source:"UP", target:"UP", result:"send_succeeded", reason:undefined},
  {source:"UP", target:"DOWN", result:"send_failed", reason:"target_down"},
  {source:"DOWN", target:"UP", result:"send_failed", reason:"source_down"},
  {source:"DOWN", target:"DOWN", result:"send_failed", reason:"source_down"}
];
for(const {source,target,result,reason} of SEND_CASES){
  test(`SEND matrix: ${source} → ${target} → ${result}${reason?': '+reason:''}`,()=>{
    const engine=makeEngine();
    const structure={nodes:[{id:1},{id:2}], edges:[{id:3, from:1, to:2}]};
    const behaviors=[];
    if(source==="DOWN") behaviors.push({nodeId:1, initialState:"DOWN"});
    if(target==="DOWN") behaviors.push({nodeId:2, initialState:"DOWN"});
    const scenario={id:1, engineVersion:1, name:"matrix", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:3}]};
    const res=engine.runScenario(structure, behaviors, scenario);
    assert.equal(res.ok, true);
    assert.equal(res.trace.events.length, 2);
    assert.equal(res.trace.events[0].type, "send_started");
    assert.equal(res.trace.events[1].type, result);
    if(reason) assert.equal(res.trace.events[1].reason, reason);
  });
}

test('SEND no se propaga a aristas adyacentes',()=>{
  const engine=makeEngine();
  const scenario={
    id:1, engineVersion:1, name:"no-prop", nextStepId:2,
    steps:[{id:1, at:0, action:"SEND", edgeId:5}]
  };
  const res=engine.runScenario(canonicalStructure(), [], scenario);
  assert.equal(res.ok, true);
  assert.equal(res.trace.events.filter(e=>e.type==="send_started").length, 1);
});

/* ===================== Validación ===================== */

function invalidTest(name, structure, behaviors, scenario, expectedCode){
  test(`Validación: ${name}`,()=>{
    const engine=makeEngine();
    const res=engine.runScenario(structure, behaviors, scenario);
    assert.equal(res.ok, false);
    assert.ok(Array.isArray(res.errors));
    assert.ok(res.errors.length>0);
    assert.equal(res.errors[0].code, expectedCode);
    assert.equal(res.trace, undefined);
  });
}

invalidTest('nodeId inexistente en SET_STATE',
  canonicalStructure(), [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:99, state:"DOWN"}]},
  "missing_node");

invalidTest('edgeId inexistente en SEND',
  canonicalStructure(), [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:99}]},
  "missing_edge");

invalidTest('endpoint ausente en edge',
  {nodes:[{id:1}], edges:[{id:2, from:1, to:99}]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:2}]},
  "missing_edge_endpoint");

invalidTest('timestamp negativo',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:-1, action:"SET_STATE", nodeId:1, state:"DOWN"}]},
  "invalid_timestamp");

invalidTest('timestamp flotante',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:1.5, action:"SET_STATE", nodeId:1, state:"DOWN"}]},
  "invalid_timestamp");

invalidTest('timestamp demasiado alto',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:86400001, action:"SET_STATE", nodeId:1, state:"DOWN"}]},
  "invalid_timestamp");

invalidTest('state desconocido',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:1, state:"DEGRADED"}]},
  "invalid_state");

invalidTest('action desconocida',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:2, steps:[{id:1, at:0, action:"WAIT"}]},
  "unknown_action");

invalidTest('step IDs duplicados',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:3, steps:[
    {id:1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"},
    {id:1, at:1, action:"SET_STATE", nodeId:1, state:"UP"}
  ]},
  "duplicate_step_id");

invalidTest('engineVersion no soportada',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:3, name:"x", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"}]},
  "unsupported_engine_version");

invalidTest('demasiados steps',
  {nodes:[{id:1}], edges:[]}, [],
  {id:1, engineVersion:1, name:"x", nextStepId:1002, steps:Array.from({length:1001},(_,i)=>({id:i+1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"}))},
  "guard_exceeded");

/* ===================== Guards ===================== */

test('Guard: MAX_TRACE_EVENTS inclusivo',()=>{
  const engine=makeEngine();
  const structure={nodes:[{id:1},{id:2}], edges:[{id:3, from:1, to:2}]};
  const steps=Array.from({length:1000},(_,i)=>({id:i+1, at:0, action:"SEND", edgeId:3}));
  const scenario={id:1, engineVersion:1, name:"trace-limit", nextStepId:1001, steps};
  const res=engine.runScenario(structure, [], scenario);
  assert.equal(res.ok, true);
  assert.equal(res.trace.events.length, 2000);
});

test('Guard: MAX_TRACE_EVENTS +1 falla sin Trace parcial',()=>{
  const engine=makeEngine();
  const structure={nodes:[{id:1},{id:2}], edges:[{id:3, from:1, to:2}]};
  const steps=Array.from({length:1001},(_,i)=>({id:i+1, at:0, action:"SEND", edgeId:3}));
  const scenario={id:1, engineVersion:1, name:"trace-limit", nextStepId:1002, steps};
  const res=engine.runScenario(structure, [], scenario);
  assert.equal(res.ok, false);
  assert.ok(Array.isArray(res.errors));
  assert.equal(res.errors[0].code, "guard_exceeded");
  assert.equal(res.trace, undefined);
});

/* ===================== Pureza / entorno ===================== */

test('No hay globals del editor ni del navegador en el motor',()=>{
  const context=vm.createContext({
    console, Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError
  });
  vm.runInContext(read('js/scenario-engine.js'), context);
  assert.equal(typeof context.FluyoScenarios, "object");
  assert.equal(typeof context.document, "undefined");
  assert.equal(typeof context.window, "undefined");
  assert.equal(typeof context.Date, "undefined");
  assert.equal(typeof context.performance, "undefined");
  assert.equal(typeof context.setTimeout, "undefined");
  assert.equal(typeof context.localStorage, "undefined");
});
