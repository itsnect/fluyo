"use strict";
/* FLUYO-009 — Tests de autoría de Scenarios (modelo + helpers).
   node --test test/scenario-ui.test.cjs */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makeContext(){
  const ctx=vm.createContext({
    run:function(code){ return vm.runInContext(code, this); },
    console,
    Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError,
    RegExp, Date, String, Boolean, parseInt, isNaN, isFinite, Infinity, NaN,
    Uint8Array, TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams,
    scheduleAutosave:()=>{}, clearSel:()=>{}, renderTabs:()=>{},
    selN:new Set(), selE:new Set(), refreshPanel:()=>{},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    window:{}, document:{}, navigator:{}, location:{}
  });
  for(const f of ['js/config.js','js/safe-svg.js','js/model.js','js/geometry.js'])
    vm.runInContext(read(f), ctx);
  // Motor y playback
  vm.runInContext(read('js/scenario-engine.js'), ctx);
  vm.runInContext(read('js/scenario-playback.js'), ctx);
  return ctx;
}

function freshPage(ctx){
  ctx.run(`
    doc={theme:"dark", customBg:"", pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    undoStack=[]; redoStack=[];
  `);
}

function buildExample(ctx){
  freshPage(ctx);
  ctx.run(`
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:"Producer"};
    const B={id:P().nextId++, shape:"rect", x:200, y:0, label:"Kafka"};
    P().nodes.push(A,B);
    const E={id:P().nextId++, from:A.id, to:B.id};
    P().edges.push(E);
    edgeId=E.id; nodeId=B.id; producerId=A.id;
  `);
  return {nodeId:ctx.nodeId, edgeId:ctx.edgeId, producerId:ctx.producerId};
}

test('Crear Scenario asigna id y nombre por defecto',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`const sc=createScenario(P(),"Caída de Kafka"); result={id:sc.id,name:sc.name,next:P().nextScenarioId};`);
  assert.equal(ctx.result.id, 1);
  assert.equal(ctx.result.name, "Caída de Kafka");
});

test('Eliminar Scenario conserva nextScenarioId',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    const sc=createScenario(P(),"S1");
    deleteScenario(P(), sc.id);
    const sc2=createScenario(P(),"S2");
    result={nextId:P().nextScenarioId, id2:sc2.id};
  `);
  assert.equal(ctx.result.id2, 2);
});

test('Crear SET_STATE y SEND',()=>{
  const ctx=makeContext();
  const ids=buildExample(ctx);
  ctx.run(`
    const sc=createScenario(P(),"Test");
    createStep(sc, {at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"});
    createStep(sc, {at:1000, action:"SEND", edgeId:${ids.edgeId}});
    result={steps:sc.steps.length, first:sc.steps[0].action, second:sc.steps[1].action};
  `);
  assert.equal(ctx.result.steps, 2);
  assert.equal(ctx.result.first, "SET_STATE");
  assert.equal(ctx.result.second, "SEND");
});

test('Cambiar acción deja step canónico',()=>{
  const ctx=makeContext();
  const ids=buildExample(ctx);
  ctx.run(`
    const sc=createScenario(P(),"Test");
    createStep(sc, {at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"});
    const step=sc.steps[0];
    step.action="SEND"; step.edgeId=${ids.edgeId};
    delete step.nodeId; delete step.state;
    validatePersistedStep(step);
    result={keys:Object.keys(step).sort().join(",")};
  `);
  assert.equal(ctx.result.keys, "action,at,edgeId,id");
});

test('Reordenar steps cambia orden semántico',()=>{
  const ctx=makeContext();
  const ids=buildExample(ctx);
  ctx.run(`
    const sc=createScenario(P(),"Test");
    createStep(sc, {at:1000, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"});
    createStep(sc, {at:1000, action:"SEND", edgeId:${ids.edgeId}});
    // Reordenar: SEND primero
    const tmp=sc.steps[0]; sc.steps[0]=sc.steps[1]; sc.steps[1]=tmp;
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
    result={ok:res.ok, hasSuccess:res.trace.events.some(e=>e.type==="send_succeeded")};
  `);
  assert.equal(ctx.result.ok, true);
  assert.equal(ctx.result.hasSuccess, true);
});

test('Behavior UP/DOWN: DOWN persiste, UP es ausencia',()=>{
  const ctx=makeContext();
  const ids=buildExample(ctx);
  ctx.run(`
    P().behaviors.push({nodeId:${ids.nodeId}, initialState:"DOWN"});
    const down=P().behaviors.find(b=>b.nodeId===${ids.nodeId}).initialState;
    P().behaviors=P().behaviors.filter(b=>b.nodeId!==${ids.nodeId});
    const upAbsent=!P().behaviors.some(b=>b.nodeId===${ids.nodeId});
    result={down, upAbsent};
  `);
  assert.equal(ctx.result.down, "DOWN");
  assert.equal(ctx.result.upAbsent, true);
});

test('Serialize v4 conserva Scenario y Behavior',()=>{
  const ctx=makeContext();
  const ids=buildExample(ctx);
  ctx.run(`
    P().behaviors.push({nodeId:${ids.nodeId}, initialState:"DOWN"});
    const sc=createScenario(P(),"Caída de Kafka");
    createStep(sc, {at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"});
    createStep(sc, {at:1000, action:"SEND", edgeId:${ids.edgeId}});
    createStep(sc, {at:5000, action:"SET_STATE", nodeId:${ids.nodeId}, state:"UP"});
    createStep(sc, {at:6000, action:"SEND", edgeId:${ids.edgeId}});
    const serialized=serializeProject();
    result={version:serialized.version, scenarios:serialized.doc.pages[0].scenarios.length, behaviors:serialized.doc.pages[0].behaviors.length};
  `);
  assert.equal(ctx.result.version, 5);
  assert.equal(ctx.result.scenarios, 1);
  assert.equal(ctx.result.behaviors, 1);
});

test('Run del caso Caída de Kafka produce Trace esperado',()=>{
  const ctx=makeContext();
  const ids=buildExample(ctx);
  ctx.run(`
    const sc=createScenario(P(),"Caída de Kafka");
    createStep(sc, {at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"});
    createStep(sc, {at:1000, action:"SEND", edgeId:${ids.edgeId}});
    createStep(sc, {at:5000, action:"SET_STATE", nodeId:${ids.nodeId}, state:"UP"});
    createStep(sc, {at:6000, action:"SEND", edgeId:${ids.edgeId}});
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors, sc);
    result={ok:res.ok, events:res.trace.events.map(e=>e.type)};
  `);
  assert.equal(ctx.result.ok, true);
  assert.equal(JSON.stringify(ctx.result.events), JSON.stringify(["state_changed","send_started","send_failed","state_changed","send_started","send_succeeded"]));
});

test('Scenario inválido con target missing no ejecuta',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    const sc=createScenario(P(),"Bad");
    createStep(sc, {at:0, action:"SET_STATE", nodeId:99, state:"DOWN"});
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
    result={ok:res.ok, code:res.errors[0].code};
  `);
  assert.equal(ctx.result.ok, false);
  assert.equal(ctx.result.code, "missing_node");
});

  test('engineVersion futura se preserva pero no ejecuta',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    const sc=createScenario(P(),"Future");
    sc.engineVersion=3;
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
    result={ok:res.ok, code:res.errors[0].code, version:sc.engineVersion};
  `);
  assert.equal(ctx.result.ok, false);
  assert.equal(ctx.result.code, "unsupported_engine_version");
  assert.equal(ctx.result.version, 3);
});

test('Eliminar Step preserva nextStepId',()=>{
  const ctx=makeContext();
  const ids=buildExample(ctx);
  ctx.run(`
    const sc=createScenario(P(),"Test");
    const s1=createStep(sc, {at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"});
    deleteStep(sc, s1.id);
    const s2=createStep(sc, {at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"UP"});
    result={nextStepId:sc.nextStepId, id2:s2.id};
  `);
  assert.equal(ctx.result.id2, 2);
});

test('Undo restaura Scenario y Steps',()=>{
  const ctx=makeContext();
  buildExample(ctx);
  ctx.run(read('js/selection.js'));
  ctx.run(`
    doc={theme:"dark", customBg:"", pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    undoStack=[]; redoStack=[];
    const sc=createScenario(P(),"S");
    pushUndo();
    createStep(sc, {at:0, action:"SET_STATE", nodeId:1, state:"DOWN"});
    const before=sc.steps.length;
    pushUndo();
    deleteStep(sc, sc.steps[0].id);
    const afterDelete=sc.steps.length;
    undo();
    const restored=P().scenarios.find(s=>s.id===sc.id);
    const afterUndo=restored.steps.length;
    result={before, afterDelete, afterUndo};
  `);
  assert.equal(ctx.result.before, 1);
  assert.equal(ctx.result.afterDelete, 0);
  assert.equal(ctx.result.afterUndo, 1);
});
