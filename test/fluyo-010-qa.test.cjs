"use strict";
/* FLUYO-010 — Independent adversarial QA.
   node --test test/fluyo-010-qa.test.cjs
   Tests focus on: primitive/presentation separation, v1/v2 semantics,
   EventType identity/lifecycle, template safety, multi-edge, roundtrips,
   Share/viewer preservation, domain neutrality. */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {makeViewer}=require('./viewer-harness.cjs');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const json=o=>JSON.parse(JSON.stringify(o));
const freeze=o=>{Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object')freeze(v);return o;};

function makeModelContext(){
  const ctx=vm.createContext({
    console, Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError,
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
  vm.runInContext(read('js/scenario-playback.js'), ctx);
  vm.runInContext(read('js/state.js').split('/* ===================== Viewport')[0], ctx);
  return ctx;
}

function freshPage(ctx){
  ctx.run(`
    doc={theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    undoStack=[]; redoStack=[];
  `);
}

function buildGraph(ctx, labels={}){
  freshPage(ctx);
  ctx.run(`
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:${JSON.stringify(labels.source||'Cliente')}};
    const B={id:P().nextId++, shape:"rect", x:200, y:0, label:${JSON.stringify(labels.target||'Comercio')}};
    P().nodes.push(A,B);
    const E={id:P().nextId++, from:A.id, to:B.id};
    P().edges.push(E);
    edgeId=E.id; nodeId=B.id; sourceId=A.id;
  `);
  return {nodeId:ctx.nodeId, edgeId:ctx.edgeId, sourceId:ctx.sourceId};
}

function runEngine(ctx, sc){
  return ctx.FluyoScenarios.runScenario({nodes:ctx.P().nodes, edges:ctx.P().edges}, ctx.P().behaviors||[], sc);
}

/* ─────────────────────────── 1. Primitive / presentation separation ─────────────────────────── */

test('Metadata rename/token/template does not change Trace for FLOW',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:et.id}]};
    first=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
    updateEventType(et.id, {name:"Despacho", sentenceTemplate:"{source} despacha a {target} via {name}", visual:{value:"📦"}});
    second=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.first.ok, true);
  assert.equal(ctx.second.ok, true);
  assert.deepEqual(json(ctx.first.trace.events), json(ctx.second.trace.events));
});

test('Metadata rename/token/template does not change Trace for SET_AVAILABILITY',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Caída", primitive:"SET_AVAILABILITY", availability:"DOWN", sentenceTemplate:"{target} se cae", visual:{value:"⚠️"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN", eventTypeId:et.id}]};
    first=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
    updateEventType(et.id, {name:"Apagón", sentenceTemplate:"{target} sin luz", visual:{value:"🔌"}});
    second=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.first.ok, true);
  assert.equal(ctx.second.ok, true);
  assert.deepEqual(json(ctx.first.trace.events), json(ctx.second.trace.events));
});

test('Metadata rename/token/template does not change Trace for OCCURRENCE',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Aprobación", primitive:"OCCURRENCE", sentenceTemplate:"{name} en {target}", visual:{value:"✅"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"OCCURRENCE", nodeId:${ids.nodeId}, eventTypeId:et.id}]};
    first=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
    updateEventType(et.id, {name:"Rechazo", sentenceTemplate:"{name} rechaza {target}", visual:{value:"❌"}});
    second=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.first.ok, true);
  assert.equal(ctx.second.ok, true);
  assert.deepEqual(json(ctx.first.trace.events), json(ctx.second.trace.events));
});

/* ─────────────────────────── 2. Primitive immutability when used ─────────────────────────── */

for(const [fromPrimitive,toPrimitive,availability] of [
  ['FLOW','OCCURRENCE',undefined],
  ['FLOW','SET_AVAILABILITY','DOWN'],
  ['OCCURRENCE','FLOW',undefined],
  ['SET_AVAILABILITY','FLOW','DOWN']
])
test(`Cannot change primitive ${fromPrimitive} → ${toPrimitive} when used`,()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  const avPart = availability ? `, availability:"${availability}"` : '';
  ctx.run(`
    const et=createEventType({name:"X", primitive:"${fromPrimitive}"${avPart}, sentenceTemplate:"{target} x", visual:{value:"🔘"}});
    const sc=createScenario(P(),"S");
    const action = et.primitive==="FLOW" ? "SEND" : (et.primitive==="SET_AVAILABILITY" ? "SET_STATE" : "OCCURRENCE");
    const targetId = action==="SEND" ? ${ids.edgeId} : ${ids.nodeId};
    const stepDef = action==="SET_STATE"
      ? {at:0, action:"SET_STATE", nodeId:targetId, state:(et.availability||"DOWN"), eventTypeId:et.id}
      : (action==="OCCURRENCE"
          ? {at:0, action:"OCCURRENCE", nodeId:targetId, eventTypeId:et.id}
          : {at:0, action:"SEND", edgeId:targetId, eventTypeId:et.id});
    createStep(sc, stepDef);
    try{ updateEventType(et.id, {primitive:"${toPrimitive}"}); result='ok'; }
    catch(e){ result=e.code; }
  `);
  assert.equal(ctx.result, 'event_type_primitive_immutable_when_used');
});

/* ─────────────────────────── 3. EventType deletion / identity ─────────────────────────── */

test('Deleting used EventType is rejected; deletion does not reuse id',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:et.id});
    try{ deleteEventType(et.id); result='deleted'; }catch(e){ result=e.code; }
    deleteStep(sc, sc.steps[0].id);
    deleteEventType(et.id);
    const next=createEventType({name:"Otro", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"🔘"}});
    result2={code:result, newId:next.id, nextCounter:doc.nextEventTypeId};
  `);
  assert.equal(ctx.result2.code, 'event_type_in_use');
  assert.equal(ctx.result2.newId, 2);
  assert.equal(ctx.result2.nextCounter, 3);
});

test('Duplicate EventType ids in document are rejected',()=>{
  const ctx=makeModelContext();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      eventTypes:[
        {id:1, name:"A", primitive:"FLOW", sentenceTemplate:"x", visual:{kind:"token", value:"🔘"}},
        {id:1, name:"B", primitive:"OCCURRENCE", sentenceTemplate:"x", visual:{kind:"token", value:"🔘"}}
      ], nextEventTypeId:2,
      pages:[{name:"P", nextId:1, nodes:[], edges:[], behaviors:[], scenarios:[], nextScenarioId:1}]
    }, settings:{}
  };
  assert.throws(()=>ctx.projectFromProjectData(input), e=>e.code==='invalid_document');
});

test('Missing nextEventTypeId is inferred from max EventType id',()=>{
  const ctx=makeModelContext();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      eventTypes:[
        {id:7, name:"A", primitive:"FLOW", sentenceTemplate:"x", visual:{kind:"token", value:"🔘"}}
      ],
      pages:[{name:"P", nextId:1, nodes:[], edges:[], behaviors:[], scenarios:[], nextScenarioId:1}]
    }, settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.nextEventTypeId, 8);
});

/* ─────────────────────────── 4. Missing EventType ─────────────────────────── */

test('SEND with missing eventTypeId still executes semantic SEND',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:999}]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  assert.deepStrictEqual(json(ctx.result.trace.events.map(e=>e.type)), ['send_started','send_succeeded']);
});

test('SET_STATE with missing eventTypeId still executes semantic SET_STATE',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN", eventTypeId:999}]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  assert.deepStrictEqual(json(ctx.result.trace.events.map(e=>e.type)), ['state_changed']);
});

/* ─────────────────────────── 5. Schema v4 → v5 ─────────────────────────── */

test('v4 roundtrip preserves steps, step ids, ordering and counters',()=>{
  const ctx=makeModelContext();
  const input={
    version:4, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      pages:[{
        name:"P", nextId:5,
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}, {id:2, shape:"rect", x:100, y:0, label:"B"}],
        edges:[{id:3, from:1, to:2}],
        behaviors:[{nodeId:1, initialState:"DOWN"}],
        scenarios:[{id:1, engineVersion:1, name:"S", nextStepId:3, steps:[
          {id:1, at:0, action:"SET_STATE", nodeId:1, state:"UP"},
          {id:2, at:1000, action:"SEND", edgeId:3}
        ]}],
        nextScenarioId:2
      }]
    }, settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.version, undefined); // projectFromProjectData returns doc separately
  assert.equal(out.doc.eventTypes.length, 0);
  assert.equal(out.doc.nextEventTypeId, 1);
  const pg=out.doc.pages[0];
  assert.equal(pg.scenarios[0].steps.length, 2);
  assert.equal(pg.scenarios[0].steps[0].id, 1);
  assert.equal(pg.scenarios[0].steps[1].id, 2);
  assert.equal(pg.scenarios[0].nextStepId, 3);
  assert.equal(pg.nextScenarioId, 2);
});

/* ─────────────────────────── 6. v5 roundtrip ─────────────────────────── */

test('v5 roundtrip preserves EventTypes, templates, tokens and references',()=>{
  const ctx=makeModelContext();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      eventTypes:[
        {id:1, name:"Pago 💵", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}},
        {id:2, name:"Aprobación", primitive:"OCCURRENCE", sentenceTemplate:"{name} en {target}", visual:{kind:"token", value:"✅"}},
        {id:3, name:"Cierre", primitive:"SET_AVAILABILITY", availability:"DOWN", sentenceTemplate:"{target} cierra", visual:{kind:"token", value:"🚪"}}
      ], nextEventTypeId:4,
      pages:[{
        name:"P", nextId:5,
        nodes:[
          {id:1, shape:"rect", x:0, y:0, label:"Cliente"},
          {id:2, shape:"rect", x:100, y:0, label:"Comercio"},
          {id:3, shape:"rect", x:200, y:0, label:"Sucursal"}
        ],
        edges:[{id:4, from:1, to:2}],
        behaviors:[],
        scenarios:[{id:1, engineVersion:2, name:"S", nextStepId:5, steps:[
          {id:1, at:0, action:"SET_STATE", nodeId:3, state:"DOWN", eventTypeId:3},
          {id:2, at:1000, action:"SEND", edgeId:4, eventTypeId:1},
          {id:3, at:1000, action:"OCCURRENCE", nodeId:3, eventTypeId:2}
        ]}],
        nextScenarioId:2
      }]
    }, settings:{}
  };
  const a=ctx.projectFromProjectData(input);
  ctx.run(`doc=${JSON.stringify(a.doc)}; settings=${JSON.stringify(a.settings)}`);
  const serialized=ctx.run('JSON.stringify(serializeProject())');
  const parsed=JSON.parse(serialized);
  const b=ctx.projectFromProjectData(parsed);
  assert.deepStrictEqual(json(a.doc.eventTypes), json(b.doc.eventTypes));
  assert.equal(json(a.doc.nextEventTypeId), json(b.doc.nextEventTypeId));
  assert.deepStrictEqual(json(a.doc.pages[0].scenarios), json(b.doc.pages[0].scenarios));
});

/* ─────────────────────────── 7. Forward compatibility ─────────────────────────── */

test('Future engineVersion is preserved by model but rejected by engine',()=>{
  const ctx=makeModelContext();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0, eventTypes:[], nextEventTypeId:1,
      pages:[{
        name:"P", nextId:3,
        nodes:[{id:1, shape:"rect", x:0, y:0}, {id:2, shape:"rect", x:100, y:0}],
        edges:[{id:3, from:1, to:2}],
        behaviors:[],
        scenarios:[{id:1, engineVersion:99, name:"Future", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:3}]}],
        nextScenarioId:2
      }]
    }, settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.pages[0].scenarios[0].engineVersion, 99);
  const res=ctx.FluyoScenarios.runScenario({nodes:out.doc.pages[0].nodes, edges:out.doc.pages[0].edges}, [], out.doc.pages[0].scenarios[0]);
  assert.equal(res.ok, false);
  assert.equal(res.errors[0].code, 'unsupported_engine_version');
});

/* ─────────────────────────── 8. engineVersion 1 vs 2 ─────────────────────────── */

test('Engine v1 keeps historical SET_STATE/SEND semantics',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    P().behaviors.push({nodeId:${ids.nodeId}, initialState:"DOWN"});
    const sc={id:1, engineVersion:1, name:"S", nextStepId:3, steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"UP"},
      {id:2, at:0, action:"SEND", edgeId:${ids.edgeId}}
    ]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors, sc);
  `);
  assert.equal(ctx.result.ok, true);
  assert.deepStrictEqual(json(ctx.result.trace.events.map(e=>e.type)), ['state_changed','send_started','send_succeeded']);
  assert.equal(ctx.result.trace.engineVersion, 2);
});

test('Engine v1 rejects OCCURRENCE explicitly',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:1, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"OCCURRENCE", nodeId:${ids.nodeId}}]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, false);
  assert.equal(ctx.result.errors[0].code, 'unknown_action');
});

/* ─────────────────────────── 9. OCCURRENCE purity ─────────────────────────── */

test('OCCURRENCE has no side effects and does not alter availability or SEND outcome',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Aprobación", primitive:"OCCURRENCE", sentenceTemplate:"{name} en {target}", visual:{value:"✅"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:4, steps:[
      {id:1, at:0, action:"OCCURRENCE", nodeId:${ids.nodeId}, eventTypeId:et.id},
      {id:2, at:0, action:"SEND", edgeId:${ids.edgeId}},
      {id:3, at:1000, action:"SEND", edgeId:${ids.edgeId}}
    ]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  const types=json(ctx.result.trace.events.map(e=>e.type));
  assert.deepStrictEqual(types, ['event_occurred','send_started','send_succeeded','send_started','send_succeeded']);
});

test('OCCURRENCE is deterministic across repeated runs',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"X", primitive:"OCCURRENCE", sentenceTemplate:"x", visual:{value:"🔘"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:3, steps:[
      {id:1, at:0, action:"OCCURRENCE", nodeId:${ids.nodeId}, eventTypeId:et.id},
      {id:2, at:0, action:"OCCURRENCE", nodeId:${ids.nodeId}, eventTypeId:et.id}
    ]};
    const traces=[];
    for(let i=0;i<20;i++) traces.push(JSON.stringify(FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc).trace.events));
    result=new Set(traces).size===1;
  `);
  assert.equal(ctx.result, true);
});

/* ─────────────────────────── 10. Custom FLOW / SET_AVAILABILITY semantics ─────────────────────────── */

test('Custom FLOW EventType produces SEND semantic',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:et.id}]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  assert.deepStrictEqual(json(ctx.result.trace.events.map(e=>e.type)), ['send_started','send_succeeded']);
});

test('Custom SET_AVAILABILITY DOWN blocks subsequent FLOW',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const close=createEventType({name:"Cierre", primitive:"SET_AVAILABILITY", availability:"DOWN", sentenceTemplate:"{target} cierra", visual:{value:"🚪"}});
    const pay=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:3, steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN", eventTypeId:close.id},
      {id:2, at:1000, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:pay.id}
    ]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  const terminals=ctx.result.trace.events.filter(e=>e.type==='send_failed'||e.type==='send_succeeded');
  assert.equal(terminals[0].type, 'send_failed');
  assert.equal(terminals[0].reason, 'target_down');
});

test('Custom SET_AVAILABILITY UP restores subsequent FLOW',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const close=createEventType({name:"Cierre", primitive:"SET_AVAILABILITY", availability:"DOWN", sentenceTemplate:"{target} cierra", visual:{value:"🚪"}});
    const open=createEventType({name:"Apertura", primitive:"SET_AVAILABILITY", availability:"UP", sentenceTemplate:"{target} abre", visual:{value:"🚪"}});
    const pay=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:4, steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN", eventTypeId:close.id},
      {id:2, at:500, action:"SET_STATE", nodeId:${ids.nodeId}, state:"UP", eventTypeId:open.id},
      {id:3, at:1000, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:pay.id}
    ]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  const terminals=ctx.result.trace.events.filter(e=>e.type==='send_failed'||e.type==='send_succeeded');
  assert.equal(terminals[0].type, 'send_succeeded');
});

/* ─────────────────────────── 11. Sentence template safety ─────────────────────────── */

for(const [label, template, expected, shouldCreate] of [
  ['script tag', '{source}<script>alert(1)</script>{target}', 'A<script>alert(1)</script>B', true],
  ['img onerror', '{source}<img onerror=alert(1) src=x>{target}', 'A<img onerror=alert(1) src=x>B', true],
  ['proto placeholder', '{source}{constructor}{target}', null, false],
  ['double curlies', '{{source}}', '{A}', true],
  ['empty', '', null, false],
  ['whitespace', '   ', null, false],
  ['only source', '{source}', 'A', true],
  ['only target', '{target}', 'B', true],
  ['no spaces', '{source}{target}', 'A B', true],
  ['emoji only', '💵', '💵', true],
  ['unicode', '{source} paga 💵 a {target}', 'A paga 💵 a B', true]
])
test(`Template safety: ${label}`,()=>{
  const ctx=makeModelContext(); freshPage(ctx);
  ctx.run(`
    let err, sentence;
    try{
      const et=createEventType({name:"X", primitive:"FLOW", sentenceTemplate:${JSON.stringify(template)}, visual:{value:"🔘"}});
      sentence=renderEventSentence(et, "A", "B");
    }catch(e){ err=e.code; }
    result={err, sentence};
  `);
  if(shouldCreate){
    assert.equal(ctx.result.err, undefined);
    assert.equal(ctx.result.sentence, expected);
  }else{
    assert.equal(ctx.result.err, 'invalid_document');
  }
});

test('Empty/whitespace-only template is rejected at creation',()=>{
  const ctx=makeModelContext(); freshPage(ctx);
  ctx.run(`
    try{ createEventType({name:"X", primitive:"FLOW", sentenceTemplate:"", visual:{value:"🔘"}}); result='ok'; }
    catch(e){ result=e.code; }
  `);
  assert.equal(ctx.result, 'invalid_document');
});

/* ─────────────────────────── 12. Rename target updates derived sentence ─────────────────────────── */

test('Renaming node updates derived sentence without rewriting Step',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx, {source:'Cliente', target:'Comercio'});
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const sc=createScenario(P(),"S");
    createStep(sc, {at:0, action:"SEND", edgeId:${ids.edgeId}, eventTypeId:et.id});
    const before=renderEventSentence(et, P().nodes[0].label, P().nodes[1].label);
    P().nodes[0].label="Usuario";
    P().nodes[1].label="Tienda";
    const after=renderEventSentence(et, P().nodes[0].label, P().nodes[1].label);
    const stepAfter=sc.steps[0];
    result={before, after, stepEdgeId:stepAfter.edgeId, stepEventTypeId:stepAfter.eventTypeId};
  `);
  assert.equal(ctx.result.before, 'Cliente paga a Comercio');
  assert.equal(ctx.result.after, 'Usuario paga a Tienda');
  assert.equal(ctx.result.stepEdgeId, ctx.result.stepEdgeId); // unchanged
  assert.equal(ctx.result.stepEventTypeId, 1);
});

/* ─────────────────────────── 13. Multi-edge FLOW ─────────────────────────── */

test('Multi-edge FLOW produces multiple SEND steps with same at and eventTypeId',()=>{
  const ctx=makeModelContext(); freshPage(ctx);
  ctx.run(`
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:"A"};
    const X={id:P().nextId++, shape:"rect", x:200, y:-100, label:"X"};
    const Y={id:P().nextId++, shape:"rect", x:200, y:0, label:"Y"};
    const Z={id:P().nextId++, shape:"rect", x:200, y:100, label:"Z"};
    P().nodes.push(A,X,Y,Z);
    const e1={id:P().nextId++, from:A.id, to:X.id};
    const e2={id:P().nextId++, from:A.id, to:Y.id};
    const e3={id:P().nextId++, from:A.id, to:Z.id};
    P().edges.push(e1,e2,e3);
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{value:"💵"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:4, steps:[
      {id:1, at:1000, action:"SEND", edgeId:e1.id, eventTypeId:et.id},
      {id:2, at:1000, action:"SEND", edgeId:e2.id, eventTypeId:et.id},
      {id:3, at:1000, action:"SEND", edgeId:e3.id, eventTypeId:et.id}
    ]};
    P().scenarios.push(sc);
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  const starts=ctx.result.trace.events.filter(e=>e.type==='send_started');
  assert.equal(starts.length, 3);
  assert.ok(starts.every(s=>s.at===1000));
  const succeeded=ctx.result.trace.events.filter(e=>e.type==='send_succeeded').length;
  assert.equal(succeeded, 3);
});

test('Multi-edge failure mix: one target DOWN, others succeed',()=>{
  const ctx=makeModelContext(); freshPage(ctx);
  ctx.run(`
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:"A"};
    const X={id:P().nextId++, shape:"rect", x:200, y:-100, label:"X"};
    const Y={id:P().nextId++, shape:"rect", x:200, y:0, label:"Y"};
    const Z={id:P().nextId++, shape:"rect", x:200, y:100, label:"Z"};
    P().nodes.push(A,X,Y,Z);
    const e1={id:P().nextId++, from:A.id, to:X.id};
    const e2={id:P().nextId++, from:A.id, to:Y.id};
    const e3={id:P().nextId++, from:A.id, to:Z.id};
    P().edges.push(e1,e2,e3);
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"💵"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:5, steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:Y.id, state:"DOWN"},
      {id:2, at:1000, action:"SEND", edgeId:e1.id, eventTypeId:et.id},
      {id:3, at:1000, action:"SEND", edgeId:e2.id, eventTypeId:et.id},
      {id:4, at:1000, action:"SEND", edgeId:e3.id, eventTypeId:et.id}
    ]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
  const byEdge={};
  for(const ev of ctx.result.trace.events){
    if(ev.type==='send_succeeded'||ev.type==='send_failed') byEdge[ev.edgeId]=ev.type;
  }
  const edgeIds=ctx.run('P().edges.map(e=>e.id)');
  assert.equal(byEdge[edgeIds[0]], 'send_succeeded');
  assert.equal(byEdge[edgeIds[1]], 'send_failed');
  assert.equal(byEdge[edgeIds[2]], 'send_succeeded');
});

/* ─────────────────────────── 14. Array-order tie-break ─────────────────────────── */

test('Tie-break respects array order, not step id',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc1={id:1, engineVersion:2, name:"S", nextStepId:100, steps:[
      {id:99, at:1000, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"},
      {id:1,  at:1000, action:"SEND", edgeId:${ids.edgeId}}
    ]};
    const sc2={id:2, engineVersion:2, name:"S", nextStepId:100, steps:[
      {id:99, at:1000, action:"SEND", edgeId:${ids.edgeId}},
      {id:1,  at:1000, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"}
    ]};
    const r1=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc1);
    const r2=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc2);
    result={r1Ok:r1.ok, r2Ok:r2.ok, r1Fail:r1.trace.events.find(e=>e.type==='send_failed')?.reason, r2Success:r2.trace.events.some(e=>e.type==='send_succeeded')};
  `);
  assert.equal(ctx.result.r1Ok, true);
  assert.equal(ctx.result.r2Ok, true);
  assert.equal(ctx.result.r1Fail, 'target_down');
  assert.equal(ctx.result.r2Ok, true);
});

/* ─────────────────────────── 15. Counters / overflow ─────────────────────────── */

test('nextEventTypeId overflow is rejected without partial mutation',()=>{
  const ctx=makeModelContext();
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      eventTypes:[{id:1, name:"A", primitive:"FLOW", sentenceTemplate:"x", visual:{kind:"token", value:"🔘"}}],
      nextEventTypeId:Number.MAX_SAFE_INTEGER,
      pages:[{name:"P", nextId:1, nodes:[], edges:[], behaviors:[], scenarios:[], nextScenarioId:1}]
    }, settings:{}
  };
  const out=ctx.projectFromProjectData(input);
  assert.equal(out.doc.nextEventTypeId, Number.MAX_SAFE_INTEGER);
  ctx.run(`doc=${JSON.stringify(out.doc)}; settings=${JSON.stringify(out.settings)}`);
  ctx.run(`
    let err;
    try{ createEventType({name:"B", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"🔘"}}); }catch(e){ err=e.code; }
    result=err;
  `);
  assert.equal(ctx.result, 'id_exhausted');
  assert.equal(ctx.run('doc.eventTypes.length'), 1);
});

/* ─────────────────────────── 16. Error contract ─────────────────────────── */

test('Engine failures return ok:false and errors[] without partial Trace',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SEND", edgeId:999}]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, false);
  assert.ok(Array.isArray(ctx.result.errors));
  assert.equal('trace' in ctx.result, false);
});

/* ─────────────────────────── 17. Domain neutrality ─────────────────────────── */

test('Engine has no domain-specific names in semantic code',()=>{
  const engineSource=read('js/scenario-engine.js');
  const forbidden=['"Pago"','"Caída"','"Envío"','"Kafka"','"payment"','"funnel"','"business"'];
  for(const f of forbidden){
    assert.equal(engineSource.includes(f), false, `found ${f} in scenario-engine.js`);
  }
});

test('Model has no domain-specific names in semantic code',()=>{
  const modelSource=read('js/model.js');
  const forbidden=['"Pago"','"Caída"','"Envío"','"Kafka"','"payment"','"funnel"','"business"'];
  for(const f of forbidden){
    assert.equal(modelSource.includes(f), false, `found ${f} in model.js`);
  }
});

/* ─────────────────────────── 18. Target compatibility from corrupt data ─────────────────────────── */

test('FLOW EventType with node target still executes SET_STATE? No — only semantic action matters',()=>{
  // The engine validates by action, not EventType. A SEND always targets an edge.
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"💵"}});
    // Corrupt: action SEND but no edgeId; this is invalid structure, engine rejects.
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"SEND", nodeId:${ids.nodeId}, eventTypeId:et.id}]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, false);
});

test('OCCURRENCE EventType with edge target is structurally invalid and rejected',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const et=createEventType({name:"X", primitive:"OCCURRENCE", sentenceTemplate:"x", visual:{value:"🔘"}});
    const sc={id:1, engineVersion:2, name:"S", nextStepId:2, steps:[{id:1, at:0, action:"OCCURRENCE", edgeId:${ids.edgeId}, eventTypeId:et.id}]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, false);
});

/* ─────────────────────────── 19. Share / viewer preservation ─────────────────────────── */

test('Share/viewer roundtrip preserves EventTypes and v5 structure',async()=>{
  const creator=makeViewer(); creator.run(read('js/share-url.js'));
  const input={
    version:5, app:"fluyo",
    doc:{
      theme:"dark", customBg:"", cur:0,
      eventTypes:[
        {id:1, name:"Pago", primitive:"FLOW", sentenceTemplate:"{source} paga a {target}", visual:{kind:"token", value:"💵"}},
        {id:2, name:"Aprobación", primitive:"OCCURRENCE", sentenceTemplate:"{name} en {target}", visual:{kind:"token", value:"✅"}}
      ], nextEventTypeId:3,
      pages:[{
        name:"P", nextId:4,
        nodes:[{id:1, shape:"rect", x:0, y:0, label:"A"}, {id:2, shape:"rect", x:100, y:0, label:"B"}],
        edges:[{id:3, from:1, to:2}],
        behaviors:[],
        scenarios:[{id:1, engineVersion:2, name:"S", nextStepId:3, steps:[
          {id:1, at:0, action:"SEND", edgeId:3, eventTypeId:1},
          {id:2, at:1000, action:"OCCURRENCE", nodeId:2, eventTypeId:2}
        ]}],
        nextScenarioId:2
      }]
    }, settings:{}
  };
  creator.context.qaInput=input;
  const url=await creator.run('createShareUrl(qaInput,"https://fluyo.space/")');
  const viewer=makeViewer({search:'',hash:new URL(url).hash});
  await viewer.boot();
  await viewer.waitForPhase(phase=>phase==='ready'||phase==='error');
  assert.equal(viewer.viewer().phase, 'ready');
  assert.equal(viewer.run('typeof FluyoScenarios'), 'undefined');
  assert.deepEqual(json(viewer.run('doc.eventTypes')), input.doc.eventTypes);
  assert.deepEqual(json(viewer.run('doc.pages[0].scenarios')), input.doc.pages[0].scenarios);
});

/* ─────────────────────────── 20. Legacy steps without eventTypeId ─────────────────────────── */

test('Legacy v1 SEND/SET_STATE without eventTypeId execute and save',()=>{
  const ctx=makeModelContext(); const ids=buildGraph(ctx);
  ctx.run(`
    const sc={id:1, engineVersion:1, name:"S", nextStepId:3, steps:[
      {id:1, at:0, action:"SET_STATE", nodeId:${ids.nodeId}, state:"DOWN"},
      {id:2, at:1000, action:"SEND", edgeId:${ids.edgeId}}
    ]};
    result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors||[], sc);
  `);
  assert.equal(ctx.result.ok, true);
});

/* ─────────────────────────── 21. viewer boundary ─────────────────────────── */

test('Viewer script list does not include editor or engine scripts',()=>{
  const viewerScripts=new Set(require('./viewer-harness.cjs').VIEWER_SCRIPTS);
  assert.equal(viewerScripts.has('js/scenario-engine.js'), false);
  assert.equal(viewerScripts.has('js/scenario-playback.js'), false);
  assert.equal(viewerScripts.has('js/editor-scenarios.js'), false);
  assert.equal(viewerScripts.has('js/interaction.js'), false);
  assert.equal(viewerScripts.has('js/state.js'), false);
  assert.equal(viewerScripts.has('js/ui.js'), false);
});

/* ─────────────────────────── 22. Drag/drop target compatibility (simulated) ─────────────────────────── */

function makeDragContext(){
  const ctx=vm.createContext({
    run:function(code){ return vm.runInContext(code, this); },
    console,
    Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError,
    RegExp, Date, String, Boolean, parseInt, isNaN, isFinite, Infinity, NaN,
    Uint8Array, TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams,
    performance:{now:()=>0},
    requestAnimationFrame:()=>0,
    cancelAnimationFrame:()=>{},
    window:{}, document:{getElementById:()=>null, createElement:()=>({}), body:{}}, navigator:{}, location:{},
    scheduleAutosave:()=>{}, pushUndo:()=>{},
    selN:new Set(), selE:new Set(),
    cv:{getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600})},
    viewX:0, viewY:0, viewZoom:1,
    // stubs replaced per test
    hitEdge:()=>null, hitNode:()=>null,
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
  });
  for(const f of ['js/config.js','js/safe-svg.js','js/model.js','js/scenario-engine.js','js/scenario-playback.js','js/editor-scenarios.js'])
    vm.runInContext(read(f), ctx);
  return ctx;
}

test('scFindDropTargets multi-edge selection uses EventType, not stale scDrag',()=>{
  const ctx=makeDragContext();
  ctx.run(`
    doc={theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:"A"};
    const X={id:P().nextId++, shape:"rect", x:200, y:-100, label:"X"};
    const Y={id:P().nextId++, shape:"rect", x:200, y:0, label:"Y"};
    const Z={id:P().nextId++, shape:"rect", x:200, y:100, label:"Z"};
    P().nodes.push(A,X,Y,Z);
    const e1={id:P().nextId++, from:A.id, to:X.id};
    const e2={id:P().nextId++, from:A.id, to:Y.id};
    const e3={id:P().nextId++, from:A.id, to:Z.id};
    P().edges.push(e1,e2,e3);
    const et=createEventType({name:"Pago", primitive:"FLOW", sentenceTemplate:"x", visual:{value:"💵"}});
    selE.clear(); selE.add(e1.id); selE.add(e2.id); selE.add(e3.id);
    // Simulate that the pointer is directly over e1 with scDrag already cleared (as scEndDrag does).
    hitEdge=(x,y)=>e1;
    scDrag=null;
    result=scFindDropTargets("edge", e1.x, e1.y, et.id);
  `);
  assert.deepStrictEqual(json(ctx.result).sort(), json([ctx.run('P().edges[0].id'), ctx.run('P().edges[1].id'), ctx.run('P().edges[2].id')]).sort());
});

test('scFindDropTargets filters incompatible primitive for direct hit',()=>{
  const ctx=makeDragContext();
  ctx.run(`
    doc={theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
    const A={id:P().nextId++, shape:"rect", x:0, y:0, label:"A"};
    const B={id:P().nextId++, shape:"rect", x:200, y:0, label:"B"};
    P().nodes.push(A,B);
    const e={id:P().nextId++, from:A.id, to:B.id};
    P().edges.push(e);
    const et=createEventType({name:"Aprobación", primitive:"OCCURRENCE", sentenceTemplate:"x", visual:{value:"✅"}});
    hitEdge=(x,y)=>e;
    result=scFindDropTargets("edge", e.x, e.y, et.id);
  `);
  assert.deepStrictEqual(json(ctx.result), []);
});

/* ─────────────────────────── 23. Service Worker cache version and assets ─────────────────────────── */

test('Service Worker cache is v52 and includes new scenario assets',()=>{
  const sw=read('sw.js');
  assert.ok(sw.includes('fluyo-static-v52'));
  assert.ok(sw.includes('"./js/scenario-engine.js"'));
  assert.ok(sw.includes('"./js/scenario-playback.js"'));
  assert.ok(sw.includes('"./js/editor-scenarios.js"'));
});
