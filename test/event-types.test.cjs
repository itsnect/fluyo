"use strict";
/* FLUYO-010 — Tests de EventTypes y engine v2.
   node --test test/event-types.test.cjs */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const json=o=>JSON.parse(JSON.stringify(o));

function makeContext(){
  const ctx=vm.createContext({
    console,
    Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError,
    RegExp, Date, String, Boolean, parseInt, isNaN, isFinite, Infinity, NaN,
    Uint8Array, TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams,
    scheduleAutosave:()=>{}, clearSel:()=>{}, renderTabs:()=>{},
    selN:new Set(), selE:new Set(), refreshPanel:()=>{},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    window:{}, document:{}, navigator:{}, location:{}
  });
  ctx.run=code=>vm.runInContext(code,ctx);
  for(const f of ['js/config.js','js/safe-svg.js','js/model.js','js/geometry.js'])
    vm.runInContext(read(f), ctx);
  vm.runInContext(read('js/scenario-engine.js'), ctx);
  vm.runInContext(read('js/state.js').split('/* ===================== Viewport')[0], ctx);
  return ctx;
}

function freshPage(ctx){
  ctx.run(`
    doc={theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    undoStack=[]; redoStack=[];
  `);
}

function buildGraph(ctx){
  freshPage(ctx);
  ctx.run(`
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:"Producer"};
    const B={id:P().nextId++, shape:"rect", x:200, y:0, label:"Consumer"};
    P().nodes.push(A,B);
    const E={id:P().nextId++, from:A.id, to:B.id};
    P().edges.push(E);
    edgeId=E.id; nodeId=B.id; producerId=A.id;
  `);
  return {nodeId:ctx.nodeId, edgeId:ctx.edgeId, producerId:ctx.producerId};
}

/* ─────────────────────────── Migración ─────────────────────────── */

test('v4 migra a v5 añadiendo eventTypes vacíos y nextEventTypeId',()=>{
  const ctx=makeContext();
  const input={
    version:4, app:"fluyo",
    doc:{theme:"dark", customBg:"", cur:0, pages:[{name:"P", nextId:1, nodes:[], edges:[], behaviors:[], scenarios:[], nextScenarioId:1}]},
    settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.eventTypes.length, 0);
  assert.equal(out.doc.nextEventTypeId, 1);
  assert.equal(ctx.serializeProject().version, 5);
});

/* ─────────────────────────── CRUD EventType ─────────────────────────── */

test('createEventType asigna id creciente y valores canónicos',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}});
    result={id:et.id, name:et.name, primitive:et.primitive, sentenceTemplate:et.sentenceTemplate, visual:et.visual, next:doc.nextEventTypeId};
  `);
  assert.equal(ctx.result.id, 1);
  assert.equal(ctx.result.name, "Pago");
  assert.equal(ctx.result.primitive, "FLOW");
  assert.equal(ctx.result.next, 2);
});

test('createEventType SET_AVAILABILITY requiere availability',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    try{ createEventType({name:"Apagar", primitive:"SET_AVAILABILITY", sentenceTemplate:"{name} apaga {target}", visual:{kind:"token", value:"🔴"}}); result='ok'; }
    catch(e){ result=e.code; }
  `);
  assert.equal(ctx.result, "invalid_document");
});

test('updateEventType cambia nombre, template y visual',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}});
    updateEventType(et.id, {name:"Pago OK", sentenceTemplate:"{source} paga a {target} via {name}", visual:{kind:"token", value:"✅"}});
    result={name:et.name, template:et.sentenceTemplate, value:et.visual.value};
  `);
  assert.equal(ctx.result.name, "Pago OK");
  assert.equal(ctx.result.template, "{source} paga a {target} via {name}");
  assert.equal(ctx.result.value, "✅");
});

test('updateEventType bloquea cambio de primitive cuando está en uso',()=>{
  const ctx=makeContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:et.id});
    try{ updateEventType(et.id, {primitive:"OCCURRENCE"}); result='ok'; }
    catch(e){ result=e.code; }
  `);
  assert.equal(ctx.result, "event_type_primitive_immutable_when_used");
});

test('deleteEventType libera id; delete rechaza si está en uso',()=>{
  const ctx=makeContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:et.id});
    try{ deleteEventType(et.id); result='deleted'; }
    catch(e){ result=e.code; }
    deleteStep(sc, sc.steps[0].id);
    deleteEventType(et.id);
    result={afterDelete:doc.eventTypes.length};
  `);
  assert.equal(ctx.result.afterDelete, 0);
});

/* ─────────────────────────── Renderizado de frases ─────────────────────────── */

test('renderEventSentence reemplaza source, target y name',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target} via {name}", visual:{kind:"token", value:"💵"}});
    result=renderEventSentence(et, "Cliente", "API");
  `);
  assert.equal(ctx.result, "Cliente paga a API via Pago");
});

test('sentenceTemplate rechaza placeholders fuera de allowlist',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    try{ createEventType({name:"X", primitive:"FLOW", sentenceTemplate:"{source} envía {amount}", visual:{kind:"token", value:"💵"}}); result='ok'; }
    catch(e){ result=e.code; }
  `);
  assert.equal(ctx.result, "invalid_document");
});

/* ─────────────────────────── Allowed targets ─────────────────────────── */

for(const [primitive, expected] of [['FLOW','edge'],['OCCURRENCE','node'],['SET_AVAILABILITY','node']])
  test(`eventTypeAllowedTargets para ${primitive}`,()=>{
    const ctx=makeContext(); freshPage(ctx);
    ctx.run(`
      const et=createEventType({name:"X", primitive:"${primitive}", sentenceTemplate:"{source} x {target}", visual:{kind:"token", value:"🔘"}${primitive==='SET_AVAILABILITY'?', availability:"DOWN"':''}});
      result=[...eventTypeAllowedTargets(et)];
  `);
  assert.equal(JSON.stringify(ctx.result), JSON.stringify([expected]));
});

/* ─────────────────────────── Integración con Steps ─────────────────────────── */

test('createStep conserva eventTypeId en pasos SEND y OCCURRENCE',()=>{
  const ctx=makeContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const etFlow=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}});
    const etOcc=createEventType({name:"Alerta", primitive:"OCCURRENCE", sentenceTemplate:"{name} en {target}", visual:{kind:"token", value:"⚠️"}});
    const sc=createScenario(P(),"S");
    const s1=createStep(sc, {at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:etFlow.id});
    const s2=createStep(sc, {at:1, action:"OCCURRENCE", nodeId:${ids.nodeId}, eventTypeId:etOcc.id});
    result={s1:s1.eventTypeId, s2:s2.eventTypeId};
  `);
  assert.equal(ctx.result.s1, 1);
  assert.equal(ctx.result.s2, 2);
});

test('serializeProject incluye eventTypes a nivel de documento',()=>{
  const ctx=makeContext(); freshPage(ctx);
  ctx.run(`
    createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}});
    const serialized=serializeProject();
    result={hasEventTypes:Array.isArray(serialized.doc.eventTypes), next:serialized.doc.nextEventTypeId, version:serialized.version};
  `);
  assert.equal(ctx.result.hasEventTypes, true);
  assert.equal(ctx.result.next, 2);
  assert.equal(ctx.result.version, 5);
});

/* ─────────────────────────── Engine v2 ─────────────────────────── */

test('Engine v2 ejecuta OCCURRENCE como event_occurred',()=>{
  const ctx=makeContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"OCCURRENCE", nodeId:${ids.nodeId}}]};
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
    result={ok:res.ok, types:res.trace.events.map(e=>e.type)};
  `);
  assert.equal(ctx.result.ok, true);
  assert.equal(JSON.stringify(ctx.result.types), JSON.stringify(["event_occurred"]));
});

test('Engine v2 ejecuta SEND con eventTypeId como metadata',()=>{
  const ctx=makeContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:7}]};
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
    result={ok:res.ok, types:res.trace.events.map(e=>e.type)};
  `);
  assert.equal(ctx.result.ok, true);
  assert.equal(JSON.stringify(ctx.result.types), JSON.stringify(["send_started","send_succeeded"]));
});

test('Engine v1 rechaza OCCURRENCE',()=>{
  const ctx=makeContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:1, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"OCCURRENCE", nodeId:${ids.nodeId}}]};
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, [], sc);
    result={ok:res.ok, code:res.errors[0].code};
  `);
  assert.equal(ctx.result.ok, false);
  assert.equal(ctx.result.code, "unknown_action");
});

test('Engine v2 mantiene semántica v1 para SET_STATE',()=>{
  const ctx=makeContext(); const ids=buildGraph(ctx);
  ctx.run(`
    P().behaviors.push({nodeId:${ids.nodeId}, initialState:"DOWN"});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:3, steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"UP"},
      {id:2, at:0, action:"SEND", edgeId:${ids.edgeId}}
    ]};
    const res=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors, sc);
    result={ok:res.ok, types:res.trace.events.map(e=>e.type)};
  `);
  assert.equal(ctx.result.ok, true);
  assert.equal(JSON.stringify(ctx.result.types), JSON.stringify(["state_changed","send_started","send_succeeded"]));
});

/* ─────────────────────────── Validación de EventType persistido ─────────────────────────── */

test('projectFromProjectData rechaza eventType con placeholder desconocido',()=>{
  const ctx=makeContext();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0, eventTypes:[
        {id:1, name:"X", primitive:"FLOW", sentenceTemplate:"{source} {foo}", visual:{kind:"token", value:"🔘"}}
      ], nextEventTypeId:2,
      pages:[{name:"P", nextId:1, nodes:[], edges:[], behaviors:[], scenarios:[], nextScenarioId:1}]
    },
    settings:{}
  };
  assert.throws(()=>ctx.projectFromProjectData(input), e=>e.code==='invalid_document');
});
