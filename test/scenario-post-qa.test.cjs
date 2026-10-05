"use strict";
/* Regresiones adicionales de corrección; conserva íntegra la suite independiente. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {makeViewer}=require('./viewer-harness.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const json=o=>JSON.parse(JSON.stringify(o));
const sc=(steps=[])=>({id:1,engineVersion:1,name:'S',nextStepId:steps.reduce((max,s)=>Math.max(max,s.id+1),1),steps});
const state=(id=1,nodeId=17,at=0)=>({id,at,action:'SET_STATE',nodeId,state:'DOWN'});
const project=pg=>({version:5,app:'fluyo',doc:{eventTypes:[],nextEventTypeId:1,pages:[{name:'P',nodes:[],edges:[],behaviors:[],scenarios:[],...pg}],cur:0},settings:{}});
function model(){
  const ctx=vm.createContext({scheduleAutosave(){},renderTabs(){},refreshPanel(){},selN:new Set(),selE:new Set(),clip:null});
  const run=code=>vm.runInContext(code,ctx);
  for(const f of ['js/config.js','js/safe-svg.js','js/model.js']) run(read(f));
  run(read('js/state.js').split('/* ===================== Viewport')[0]);run(read('js/selection.js'));
  return {ctx,run,load:input=>ctx.projectFromProjectData(input)};
}
function engine(source=read('js/scenario-engine.js')){const ctx=vm.createContext({});vm.runInContext(source,ctx);return ctx.FluyoScenarios;}
function failure(r){assert.equal(r.ok,false);assert.ok(Array.isArray(r.errors));assert.ok(r.errors.length);assert.equal('error' in r,false);assert.equal('trace' in r,false);return json(r.errors);}

test('Missing 17 reserva marca, creación no repara y undo histórico sí repara',()=>{
  const m=model(),e=engine();m.ctx.input=project({nodes:[{id:17}],nextId:4,scenarios:[sc([state()])]});
  m.run('doc=projectFromProjectData(input).doc;selN.add(17);deleteSel()');
  const afterDelete=json(m.run('serializeProject()'));
  assert.equal(afterDelete.doc.pages[0].scenarios[0].steps[0].nodeId,17);
  const reopened=m.load(afterDelete);assert.ok(reopened.doc.pages[0].nextId>=18);
  failure(e.runScenario(m.run('P()'),[],m.run('P().scenarios[0]')));
  const newId=m.run('pushUndo();newNode("rect",0,0).id');assert.ok(newId>17);
  failure(e.runScenario(m.run('P()'),[],m.run('P().scenarios[0]')));
  m.run('undo();undo()');assert.equal(m.run('P().nodes[0].id'),17);
  assert.equal(e.runScenario(m.run('P()'),[],m.run('P().scenarios[0]')).ok,true);
});
for(const [label,graph] of [
  ['node/node',{nodes:[{id:1},{id:1}],edges:[]}],
  ['edge/edge',{nodes:[{id:1}],edges:[{id:2,from:1,to:1},{id:2,from:1,to:1}]}],
  ['node/edge',{nodes:[{id:1}],edges:[{id:1,from:1,to:1}]}],
  ['dangling sin pasos',{nodes:[{id:1}],edges:[{id:2,from:77,to:1}]}]
]) test('Structure completa bloquea '+label,()=>{failure(engine().runScenario(graph,[],sc()));});

for(const [label,value,expected] of [['ausente',undefined,9],['bajo',3,9],['alto',100,100]])
  test('nextStepId '+label+' normaliza sin bajar marca',()=>{
    const input=project({scenarios:[{...sc([state(1),state(8)]),nextStepId:value}]});
    assert.equal(model().load(input).doc.pages[0].scenarios[0].nextStepId,expected);
  });
test('Counters presentes malformados no se corrigen silenciosamente',()=>{
  for(const value of [0,-1,1.5,'9',NaN,Infinity,null,Number.MAX_SAFE_INTEGER+1]) for(const key of ['nextId','nextScenarioId','nextStepId']){
    const input=project({scenarios:[sc()]});
    if(key==='nextStepId') input.doc.pages[0].scenarios[0][key]=value;else input.doc.pages[0][key]=value;
    assert.throws(()=>model().load(input),e=>e.code==='invalid_document',key+'='+value);
  }
});
test('Reserva missing máxima rechaza contador imposible, sin alterar input',()=>{
  for(const fields of [
    {behaviors:[{nodeId:Number.MAX_SAFE_INTEGER,initialState:'DOWN'}]},
    {scenarios:[sc([state(1,Number.MAX_SAFE_INTEGER)])]},
    {edges:[{id:1,from:Number.MAX_SAFE_INTEGER,to:17}]}
  ]){const input=project(fields),before=JSON.stringify(input);assert.throws(()=>model().load(input),e=>e.code==='invalid_document');assert.equal(JSON.stringify(input),before);}
});
test('Helpers Scenario/Step asignan IDs nuevos tras borrar y bloquean agotamiento',()=>{
  const m=model();const ids=m.run(`
    const a=createScenario(P());deleteScenario(P(),a.id);const b=createScenario(P());
    b.nextStepId=4;const x=createStep(b,{at:0,action:'SET_STATE',nodeId:17,state:'DOWN'});
    deleteStep(b,x.id);const y=createStep(b,{at:0,action:'SET_STATE',nodeId:17,state:'DOWN'});[a.id,b.id,x.id,y.id];
  `);assert.deepEqual(json(ids),[1,2,4,5]);
  m.run('P().nextScenarioId=Number.MAX_SAFE_INTEGER');let before=m.run('JSON.stringify(P())');
  assert.throws(()=>m.run('createScenario(P())'),e=>e.code==='id_exhausted');assert.equal(m.run('JSON.stringify(P())'),before);
  m.run('P().scenarios[0].nextStepId=Number.MAX_SAFE_INTEGER');before=m.run('JSON.stringify(P())');
  assert.throws(()=>m.run('createStep(P().scenarios[0],{at:0,action:"SEND",edgeId:99})'),e=>e.code==='id_exhausted');assert.equal(m.run('JSON.stringify(P())'),before);
});
test('Último ID asignable y paste agotado conservan marcas seguras sin cambios parciales',()=>{
  const m=model();m.run('newNode("rect",0,0);newNode("rect",100,0);P().nextId=Number.MAX_SAFE_INTEGER-1');   // 018.1: la conexión exige extremos existentes
  assert.equal(m.run('newNode("rect",0,0).id'),Number.MAX_SAFE_INTEGER-1);
  const before=m.run('JSON.stringify(P())');assert.throws(()=>m.run('newEdge(1,2)'),e=>e.code==='id_exhausted');assert.equal(m.run('JSON.stringify(P())'),before);
  m.run('P().nextId=Number.MAX_SAFE_INTEGER-1;clip={nodes:[{id:1},{id:2}],edges:[],behaviors:[]}');
  const beforePaste=m.run('JSON.stringify(P())');assert.throws(()=>m.run('pasteClip()'),e=>e.code==='id_exhausted');assert.equal(m.run('JSON.stringify(P())'),beforePaste);
});
test('Duplicación múltiple remapea overrides explícitos y deja default UP implícito',()=>{
  const m=model();m.ctx.input=project({nodes:[{id:1},{id:2},{id:3}],behaviors:[{nodeId:1,initialState:'DOWN'},{nodeId:2,initialState:'UP'}],scenarios:[sc([state(1,1)])]});
  m.run('doc=projectFromProjectData(input).doc;selN.add(1);selN.add(2);selN.add(3);dupSel()');
  assert.deepEqual(json(m.run('P().behaviors')),[{nodeId:1,initialState:'DOWN'},{nodeId:2,initialState:'UP'},{nodeId:4,initialState:'DOWN'},{nodeId:5,initialState:'UP'}]);
  assert.deepEqual(json(m.run('P().scenarios')),m.ctx.input.doc.pages[0].scenarios);
});
test('Errores acumulados ordenados e idénticos en 100 ejecuciones, sin cascada missing_edge',()=>{
  const e=engine(),graph={nodes:[{id:1}],edges:[{id:2,from:1,to:99}]},behaviors=[{nodeId:88,initialState:'DOWN'}];
  const scenario=sc([state(1,77),{id:2,at:-1,action:'WAIT'},{id:3,at:86400001,action:'SEND',edgeId:123}]);
  const first=failure(e.runScenario(graph,behaviors,scenario));
  assert.deepEqual(first.map(x=>x.code),['invalid_timestamp','unknown_action','missing_edge_endpoint','missing_behavior_node','missing_node','missing_edge','invalid_timestamp']);
  for(let i=0;i<100;i++) assert.deepEqual(failure(e.runScenario(graph,behaviors,scenario)),first);
});
test('Shapes inválidas siempre devuelven errors[] y nunca lanzan ni dejan Trace',()=>{
  const e=engine();
  for(const [graph,behaviors,scenario] of [[null,[],sc()],[{nodes:null,edges:[]},[],sc()],[{nodes:[null],edges:[null]},[null],{...sc(),steps:[null]}],[{nodes:[],edges:[]},null,null]]) failure(e.runScenario(graph,behaviors,scenario));
});
test('1001 steps y versión futura se guardan, comparten, abren y preservan íntegros',async()=>{
  const v=makeViewer();v.run(read('js/share-url.js'));
  const scenarios=[sc(Array.from({length:1001},(_,i)=>state(i+1))),{...sc([state(1,88,86400001)]),id:2,engineVersion:3}];
  const input=project({nodes:[{id:17}],scenarios});v.context.input=input;
  const normalized=v.run('projectFromProjectData(input)');v.context.normalized=normalized;
  v.run('doc=normalized.doc;settings=normalized.settings');const saved=json(v.run('serializeProject()'));
  assert.deepEqual(saved.doc.pages[0].scenarios,scenarios);
  const roundtrip=model().load(saved);assert.deepEqual(json(roundtrip.doc.pages[0].scenarios),scenarios);
  assert.equal(failure(engine().runScenario(roundtrip.doc.pages[0],[],scenarios[0]))[0].code,'guard_exceeded');
  assert.equal(failure(engine().runScenario(roundtrip.doc.pages[0],[],scenarios[1]))[0].code,'unsupported_engine_version');
  const url=await v.run('createShareUrl(serializeProject(),"https://fluyo.space/")');assert.ok(url.length<=65536);
  const viewer=makeViewer({search:'',hash:new URL(url).hash});await viewer.boot();
  await viewer.waitForPhase(p=>p==='ready'||p==='error');
  assert.equal(viewer.viewer().phase,'ready');
  assert.deepEqual(json(viewer.run('doc.pages[0].scenarios')),scenarios);assert.equal(viewer.run('typeof FluyoScenarios'),'object');
  await viewer.el('btnOpen').onclick();const decoded=await viewer.run('decodeDeepLink(location.hash.slice(3))');
  assert.deepEqual(json(model().load(decoded).doc.pages[0].scenarios),scenarios);
});
test('Helper de autoría no reinterpreta un Scenario futuro preservable',()=>{
  const m=model();m.ctx.input=project({scenarios:[{...sc(),engineVersion:3}]});m.run('doc=projectFromProjectData(input).doc');const before=m.run('JSON.stringify(P())');
  assert.throws(()=>m.run('createStep(P().scenarios[0],{at:0,action:"SEND",edgeId:2})'),e=>e.code==='unsupported_engine_version');
  assert.throws(()=>m.run('deleteStep(P().scenarios[0],1)'),e=>e.code==='unsupported_engine_version');assert.equal(m.run('JSON.stringify(P())'),before);
});
test('Guard interno de jobs: límite inclusivo y aborto sin Trace con cota aislada',()=>{
  const source=read('js/scenario-engine.js'),anchor='const MAX_RUNTIME_JOBS = 2000;';assert.ok(source.includes(anchor));
  const e=engine(source.replace(anchor,'const MAX_RUNTIME_JOBS = 1;')),graph={nodes:[{id:17}],edges:[]};
  assert.equal(e.runScenario(graph,[],sc([state()])).ok,true);
  const errors=failure(e.runScenario(graph,[],sc([state(),{...state(2),state:'UP'}])));
  assert.equal(errors[0].code,'guard_exceeded');assert.equal(errors[0].path,'runtime.jobs');
});
test('Guard interno de eventos: terminal que excede cota descarta eventos temporales',()=>{
  const source=read('js/scenario-engine.js'),anchor='const MAX_TRACE_EVENTS = 2000;';assert.ok(source.includes(anchor));
  const e=engine(source.replace(anchor,'const MAX_TRACE_EVENTS = 3;')),graph={nodes:[{id:1},{id:2}],edges:[{id:3,from:1,to:2}]};
  const send={id:1,at:0,action:'SEND',edgeId:3};assert.equal(e.runScenario(graph,[],sc([send])).trace.events.length,2);
  const errors=failure(e.runScenario(graph,[],sc([send,{...send,id:2}])));assert.equal(errors[0].path,'trace.events');
  const exact=engine(source.replace(anchor,'const MAX_TRACE_EVENTS = 4;'));assert.equal(exact.runScenario(graph,[],sc([send,{...send,id:2}])).trace.events.length,4);
});

for(const kind of ['nodes','edges']) test('Re-QA: guard de '+kind+' inclusivo, exceso persistible sin truncar',()=>{
  const e=engine(),limit=e.MAX_STRUCTURE_ENTITIES;
  const graph=kind==='nodes'
    ? {nodes:Array.from({length:limit},(_,i)=>({id:i+1})),edges:[]}
    : {nodes:[{id:1},{id:2}],edges:Array.from({length:limit},(_,i)=>({id:i+3,from:1,to:2}))};
  assert.equal(e.runScenario(graph,[],sc()).ok,true);
  graph[kind].push(kind==='nodes'?{id:limit+1}:{id:limit+3,from:1,to:2});
  const m=model();m.ctx.input=project({...graph,scenarios:[sc()]});
  const before=JSON.stringify(m.ctx.input);
  m.run('const loaded=projectFromProjectData(input);doc=loaded.doc;settings=loaded.settings');
  const saved=json(m.run('serializeProject()')),reopened=m.load(saved).doc.pages[0];
  assert.equal(reopened[kind].length,limit+1);
  assert.deepEqual(json(reopened.scenarios),[sc()]);
  assert.equal(JSON.stringify(m.ctx.input),before);
  assert.deepEqual(failure(e.runScenario(reopened,[],reopened.scenarios[0])),[
    {code:'guard_exceeded',path:'structure.'+kind,limit}
  ]);
});
