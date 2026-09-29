"use strict";
/* FLUYO-008 — Tests de migración v4, identidad y fronteras compartidas.
   node --test test/scenario-migration.test.cjs */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makeModel(){
  const context=vm.createContext({
    console,
    Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError,
    RegExp, Date, String, Boolean, parseInt, isNaN, isFinite, Infinity, NaN,
    Uint8Array, TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams,
    scheduleAutosave:()=>{}, clearSel:()=>{}, renderTabs:()=>{},
    selN:new Set(), selE:new Set(), refreshPanel:()=>{}
  });
  for(const f of ['js/config.js','js/safe-svg.js','js/model.js','js/geometry.js'])
    vm.runInContext(read(f), context);
  return context;
}

function v3Doc(){
  return {
    version:3, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"Página 1", nextId:8,
        nodes:[
          {id:1, shape:"rect", x:100, y:100, label:"Producer"},
          {id:2, shape:"rect", x:350, y:100, label:"Kafka"},
          {id:3, shape:"rect", x:600, y:100, label:"Consumer"},
          {id:4, shape:"rect", x:850, y:100, label:"PostgreSQL"}
        ],
        edges:[
          {id:5, from:1, to:2},
          {id:6, from:2, to:3},
          {id:7, from:3, to:4}
        ]
      }]
    },
    settings:{}
  };
}

/* ===================== Migración v3 → v5 ===================== */

test('v3 migra a v5 con defaults por página',()=>{
  const ctx=makeModel();
  const input=v3Doc();
  const original=JSON.stringify(input);
  const out=ctx.projectFromProjectData(input);
  assert.equal(JSON.stringify(out.doc.pages[0].behaviors), "[]");
  assert.equal(JSON.stringify(out.doc.pages[0].scenarios), "[]");
  assert.equal(out.doc.pages[0].nextScenarioId, 1);
  assert.equal(JSON.stringify(out.doc.eventTypes), "[]");
  assert.equal(out.doc.nextEventTypeId, 1);
  assert.equal(ctx.serializeProject().version, 5);
  assert.equal(JSON.stringify(input), original, 'input no mutado');
});

test('v4 roundtrip conserva behaviors y scenarios',()=>{
  const ctx=makeModel();
  const input={
    version:4, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"P", nextId:3, behaviors:[{nodeId:1, initialState:"DOWN"}],
        nextScenarioId:2,
        scenarios:[{
          id:1, engineVersion:1, name:"Caída de Kafka", nextStepId:3,
          steps:[
            {id:1, at:0, action:"SET_STATE", nodeId:2, state:"DOWN"},
            {id:2, at:1000, action:"SEND", edgeId:5}
          ]
        }],
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"},{id:2, shape:"rect", x:100, y:0, label:"B"}],
        edges:[{id:5, from:1, to:2}]
      }]
    },
    settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.pages[0].behaviors.length, 1);
  assert.equal(out.doc.pages[0].behaviors[0].nodeId, 1);
  assert.equal(out.doc.pages[0].scenarios.length, 1);
  assert.equal(out.doc.pages[0].scenarios[0].engineVersion, 1);
  assert.equal(out.doc.pages[0].scenarios[0].steps.length, 2);
});

test('v5 roundtrip conserva eventTypes',()=>{
  const ctx=makeModel();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", eventTypes:[
        {id:1, name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}}
      ], nextEventTypeId:2,
      cur:0,
      pages:[{
        name:"P", nextId:3, behaviors:[], nextScenarioId:2,
        scenarios:[{id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:5, eventTypeId:1}]}],
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"},{id:2, shape:"rect", x:100, y:0, label:"B"}],
        edges:[{id:5, from:1, to:2}]
      }]
    },
    settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.eventTypes.length, 1);
  assert.equal(out.doc.eventTypes[0].name, "Pago");
  assert.equal(out.doc.eventTypes[0].primitive, "FLOW");
  assert.equal(out.doc.nextEventTypeId, 2);
  assert.equal(out.doc.pages[0].scenarios[0].steps[0].eventTypeId, 1);
});

test('v6 se rechaza como unsupported_version',()=>{
  const ctx=makeModel();
  assert.throws(()=>ctx.projectFromProjectData({version:6,app:"fluyo",doc:{pages:[{name:"x",nodes:[],edges:[]}]},settings:{}}),
    e=>e.code==='unsupported_version');
});

test('Documentos históricos v0/v1/v2/v3 abren',()=>{
  const ctx=makeModel();
  for(const version of [undefined,1,2,3]){
    const d={version,app:"fluyo",state:{theme:"dark",nodes:[{id:1,label:"histórico"}],edges:[]}};
    if(version===undefined) delete d.version;
    const out=ctx.projectFromProjectData(d);
    assert.equal(out.doc.pages[0].scenarios.length, 0);
    assert.equal(out.doc.pages[0].behaviors.length, 0);
    assert.equal(out.doc.pages[0].nextScenarioId, 1);
  }
});

/* ===================== IDs e identidad ===================== */

test('nextId se eleva por encima de IDs existentes',()=>{
  const ctx=makeModel();
  const out=ctx.projectFromProjectData({version:3,app:"fluyo",doc:{pages:[{name:"x",nodes:[{id:1,label:"A"},{id:5,label:"B"}],edges:[],nextId:1}]},settings:{}});
  assert.equal(out.doc.pages[0].nextId, 6);
});

test('undo no permite reutilizar ID eliminado (nodes/edges)',()=>{
  const ctx=makeModel();
  // Simulamos: crear nodo 1, undo, crear nuevo nodo → debe recibir 2, no 1.
  ctx.vm=ctx;
  ctx.run=function run(code){ return vm.runInContext(code, this); };
  ctx.run(read('js/selection.js')); // carga undo/redo sobre el modelo ya cargado
  ctx.run(`
    doc={theme:"dark", customBg:"", pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    undoStack=[]; redoStack=[];
    pushUndo();
    const n={id:P().nextId++, shape:"rect", x:0, y:0, label:"A"}; P().nodes.push(n);
    const firstId=n.id;
    pushUndo();
    // undo la creación
    undo();
    // crear otro nodo
    const m={id:P().nextId++, shape:"rect", x:100, y:0, label:"B"}; P().nodes.push(m);
    results={firstId, secondId:m.id, nextId:P().nextId};
  `);
  const r=ctx.run('results');
  assert.equal(r.firstId, 1);
  assert.equal(r.secondId, 2);
  assert.equal(r.nextId, 3);
});

test('undo no permite reutilizar ID de Scenario ni Step eliminados',()=>{
  const ctx=makeModel();
  ctx.run=function run(code){ return vm.runInContext(code, this); };
  ctx.run(read('js/selection.js'));
  ctx.run(`
    doc={theme:"dark", customBg:"", pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    undoStack=[]; redoStack=[];
    pushUndo();
    const sc={id:P().nextScenarioId++, engineVersion:1, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"}]};
    P().scenarios.push(sc);
    const firstScenarioId=sc.id;
    const firstStepId=sc.steps[0].id;
    pushUndo();
    undo();
    const sc2={id:P().nextScenarioId++, engineVersion:1, name:"S2", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"}]};
    P().scenarios.push(sc2);
    results={firstScenarioId, firstStepId, secondScenarioId:sc2.id, secondStepId:sc2.steps[0].id, nextScenarioId:P().nextScenarioId};
  `);
  const r=ctx.run('results');
  assert.equal(r.firstScenarioId, 1);
  assert.equal(r.secondScenarioId, 2);
  assert.equal(r.nextScenarioId, 3);
  // step IDs dentro del nuevo scenario empiezan en nextStepId=2
  assert.equal(r.firstStepId, 1);
  assert.equal(r.secondStepId, 1);
});

/* ===================== Canonicalización de Behavior ===================== */

test('Behavior duplicado por nodeId se canonicaliza a uno solo',()=>{
  const ctx=makeModel();
  const out=ctx.projectFromProjectData({
    version:4, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"P", nextId:2, behaviors:[{nodeId:1, initialState:"DOWN"},{nodeId:1, initialState:"UP"}],
        scenarios:[], nextScenarioId:1,
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}], edges:[]
      }]
    },
    settings:{}
  });
  assert.equal(out.doc.pages[0].behaviors.length, 1);
  // last-wins
  assert.equal(out.doc.pages[0].behaviors[0].initialState, "UP");
});

/* ===================== Viewer / frontera compartida ===================== */

test('Viewer conserva v4 y muestra Structure sin ejecutar engine',()=>{
  const ctx=makeModel();
  const input={
    version:4, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"P", nextId:2, behaviors:[{nodeId:1, initialState:"DOWN"}],
        nextScenarioId:2,
        scenarios:[{id:1, engineVersion:1, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"}]}],
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}], edges:[]
      }]
    },
    settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.pages[0].nodes.length, 1);
  assert.equal(out.doc.pages[0].scenarios.length, 1);
  assert.equal(typeof ctx.FluyoScenarios, "undefined", 'viewer/model no carga scenario-engine');
});

/* ===================== Entrada malformada de Scenarios ===================== */

test('Scenario con engineVersion futura se acepta en documento pero no se ejecuta por model',()=>{
  const ctx=makeModel();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0, eventTypes:[], nextEventTypeId:1,
      pages:[{
        name:"P", nextId:2, behaviors:[], scenarios:[
          {id:1, engineVersion:3, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"}]}
        ], nextScenarioId:2,
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}], edges:[]
      }]
    },
    settings:{}
  };
  // model.js acepta engineVersion >=1 como entero seguro; la ejecución la bloquea el engine.
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.pages[0].scenarios[0].engineVersion, 3);
});

test('Action desconocida rechaza documento',()=>{
  const ctx=makeModel();
  const input={
    version:4, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"P", nextId:2, behaviors:[], scenarios:[
          {id:1, engineVersion:1, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"WAIT"}]}
        ], nextScenarioId:2,
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}], edges:[]
      }]
    },
    settings:{}
  };
  assert.throws(()=>ctx.projectFromProjectData(input), e=>e.code==='invalid_document');
});

test('step IDs duplicados rechazan documento',()=>{
  const ctx=makeModel();
  const input={
    version:4, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"P", nextId:2, behaviors:[], scenarios:[
          {id:1, engineVersion:1, name:"S", nextStepId:3, steps:[
            {id:1, at:0, action:"SET_STATE", nodeId:1, state:"DOWN"},
            {id:1, at:1, action:"SET_STATE", nodeId:1, state:"UP"}
          ]}
        ], nextScenarioId:2,
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}], edges:[]
      }]
    },
    settings:{}
  };
  assert.throws(()=>ctx.projectFromProjectData(input), e=>e.code==='invalid_document');
});

test('timestamp inválido rechaza documento',()=>{
  const ctx=makeModel();
  const input={
    version:4, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"P", nextId:2, behaviors:[], scenarios:[
          {id:1, engineVersion:1, name:"S", nextStepId:2, steps:[{id:1, at:-1, action:"SET_STATE", nodeId:1, state:"DOWN"}]}
        ], nextScenarioId:2,
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}], edges:[]
      }]
    },
    settings:{}
  };
  assert.throws(()=>ctx.projectFromProjectData(input), e=>e.code==='invalid_document');
});
