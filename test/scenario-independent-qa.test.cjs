"use strict";
/* QA independiente de FLUYO-008. Las aserciones expresan FLUYO-007 §§3–9/14.
   Los fallos quedan como regresiones reproducibles; no se modifica producción.
   node --test test/scenario-independent-qa.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {makeViewer}=require('./viewer-harness.cjs');
const read=p=>fs.readFileSync(path.join(process.env.FLUYO_QA_SOURCE_ROOT||path.join(__dirname,'..'),p),'utf8');
const json=o=>JSON.parse(JSON.stringify(o));
const scenario=(steps=[])=>({id:1,engineVersion:1,name:'QA',nextStepId:Math.max(0,...steps.map(s=>s.id))+1,steps});
const structure=()=>({nodes:[{id:1},{id:2}],edges:[{id:3,from:1,to:2}]});
const send=(id=1,at=0,edgeId=3)=>({id,at,action:'SEND',edgeId});
const set=(id=1,at=0,nodeId=1,state='DOWN')=>({id,at,action:'SET_STATE',nodeId,state});
function engine(){
  const ctx=vm.createContext({});
  vm.runInContext(`
    Date=undefined; performance=undefined;
    Math.random=()=>{throw Error('random prohibido');};
    for(const k of ['document','window','localStorage','sessionStorage','fetch','setTimeout','setInterval','requestAnimationFrame','trackEvent','doc','P','settings'])
      Object.defineProperty(globalThis,k,{get(){throw Error(k+' prohibido');}});
  `,ctx);
  vm.runInContext(read('js/scenario-engine.js'),ctx);
  return ctx.FluyoScenarios;
}
function model({editor=false}={}){
  const ctx=vm.createContext({scheduleAutosave(){},renderTabs(){},refreshPanel(){},selN:new Set(),selE:new Set(),clip:null});
  const run=code=>vm.runInContext(code,ctx);
  for(const f of ['js/config.js','js/safe-svg.js','js/model.js']) run(read(f));
  if(editor){
    // Fábricas reales, aisladas del bootstrap DOM que no pertenece al engine.
    run(read('js/state.js').split('/* ===================== Viewport')[0]);
    run(read('js/selection.js'));
  }
  return {ctx,run,normalize:input=>ctx.projectFromProjectData(input)};
}
function project(pg={}){
  return {version:5,app:'fluyo',doc:{pages:[{name:'QA',nodes:[],edges:[],nextId:1,behaviors:[],scenarios:[],nextScenarioId:1,eventTypes:[],nextEventTypeId:1,...pg}],cur:0},settings:{}};
}
function freeze(o){Object.freeze(o);for(const v of Object.values(o)) if(v && typeof v==='object') freeze(v);return o;}
function reject(result){assert.equal(result.ok,false,JSON.stringify(result));assert.equal('trace' in result,false);}

test('CONTROL: oracle independiente, inputs congelados, 200 casos y ejecuciones intercaladas',()=>{
  const e=engine();let seed=817;
  const pick=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let c=0;c<200;c++){
    const graph={nodes:[{id:1},{id:2},{id:3}],edges:[{id:4,from:1,to:2},{id:5,from:2,to:3},{id:6,from:1,to:1},{id:7,from:1,to:2}]};
    const behaviors=[{nodeId:2,initialState:c%2?'UP':'DOWN'}];
    const steps=Array.from({length:25},(_,i)=>pick(2)?send(100-i,pick(5),4+pick(4)):set(100-i,pick(5),1+pick(3),pick(2)?'UP':'DOWN'));
    const sc=scenario(steps);
    const states={1:'UP',2:behaviors[0].initialState,3:'UP'},expected=[];
    // Orden de referencia: recorrer cada timestamp y después la lista de autoría.
    for(let at=0;at<5;at++) for(const s of steps.filter(s=>s.at===at)){
      if(s.action==='SET_STATE'){
        if(states[s.nodeId]!==s.state){expected.push({at,type:'state_changed',stepId:s.id,nodeId:s.nodeId,from:states[s.nodeId],to:s.state});states[s.nodeId]=s.state;}
      }else{
        const edge=graph.edges.find(g=>g.id===s.edgeId);
        expected.push({at,type:'send_started',stepId:s.id,edgeId:s.edgeId});
        const reason=states[edge.from]==='DOWN'?'source_down':states[edge.to]==='DOWN'?'target_down':null;
        expected.push({at,type:reason?'send_failed':'send_succeeded',stepId:s.id,edgeId:s.edgeId,...(reason?{reason}:{})});
      }
    }
    freeze(graph);freeze(behaviors);freeze(sc);
    const first=e.runScenario(graph,behaviors,sc);
    assert.equal(first.ok,true);assert.deepEqual(json(first.trace.events),expected);
    e.runScenario(structure(),[],scenario([send()]));
    const reordered={nodes:[...graph.nodes].reverse(),edges:[...graph.edges].reverse()};
    assert.deepEqual(json(e.runScenario(reordered,[...behaviors].reverse(),sc)),json(first));
  }
});

test('CONTROL: todo paso se valida antes de emitir, aunque el primero sea válido',()=>{
  reject(engine().runScenario(structure(),[],scenario([send(),set(2,1,999)])));
});
test('CONTROL: límites inclusivos de graph, tiempo y emisiones',()=>{
  const e=engine();
  const graph={nodes:Array.from({length:10000},(_,i)=>({id:i+1})),edges:Array.from({length:10000},(_,i)=>({id:i+10001,from:1,to:2}))};
  const result=e.runScenario(graph,[],scenario(Array.from({length:1000},(_,i)=>send(i+1,86400000,10001))));
  assert.equal(result.ok,true);assert.equal(result.trace.events.length,2000);
  reject(e.runScenario({...graph,nodes:[...graph.nodes,{id:20001}]},[],scenario()));
});
test('CONTROL: migración idempotente sobre copia y namespaces por página',()=>{
  const m=model(),input=project({nodes:[{id:1}],scenarios:[scenario([set()])]});
  input.doc.pages.push(json(input.doc.pages[0]));freeze(input);
  const a=m.normalize(input),b=m.normalize({version:5,app:'fluyo',...a});
  assert.deepEqual(json(a),json(b));assert.equal(a.doc.pages[1].scenarios[0].id,1);
});
test('CONTROL: guardar/reabrir preserva exactamente definiciones y marcas altas',()=>{
  const m=model();const input=project({nodes:[{id:1}],behaviors:[{nodeId:1,initialState:'DOWN'}],nextScenarioId:99,scenarios:[{...scenario([set(7)]),nextStepId:55}]});
  m.ctx.qaInput=input;m.run('doc=projectFromProjectData(qaInput).doc;settings=projectFromProjectData(qaInput).settings');
  const saved=JSON.parse(m.run('JSON.stringify(serializeProject())')),out=m.normalize(saved);
  for(const key of ['behaviors','scenarios','nextScenarioId']) assert.deepEqual(json(out.doc.pages[0][key]),input.doc.pages[0][key]);
  assert.equal(saved.version,5);
});
test('CONTROL: versión futura y acción desconocida no tienen fallback',()=>{
  const e=engine();
  const future={...scenario([send()]),engineVersion:3};
  const r=e.runScenario(structure(),[],future);reject(r);assert.equal(r.error?.code||r.errors?.[0]?.code,'unsupported_engine_version');
  reject(e.runScenario(structure(),[],scenario([{id:1,at:0,action:'EXECUTE',edgeId:3}])));
});
test('CONTROL: crear → undo → crear y redo conservan identidad de node/edge',()=>{
  const m=model({editor:true});
  const ids=m.run(`
    pushUndo();const a=newNode('rect',0,0);undo();pushUndo();const b=newNode('rect',0,0);
    const c=newNode('rect',100,0);pushUndo();const x=newEdge(b.id,c.id);undo();redo();const restoredId=P().edges[0].id;
    undo();pushUndo();const y=newEdge(b.id,c.id);[a.id,b.id,x.id,restoredId,y.id];
  `);
  assert.ok(ids[1]>ids[0]);assert.equal(ids[2],ids[3]);assert.ok(ids[4]>ids[2]);
});
test('CONTROL: crear/borrar/recrear Scenario y Step mantiene contador local monotónico',()=>{
  const m=model({editor:true});
  const ids=m.run(`
    pushUndo();const s={id:P().nextScenarioId++,engineVersion:1,name:'S',nextStepId:4,steps:[]};P().scenarios.push(s);
    pushUndo();const oldStep=s.nextStepId++;s.steps.push({id:oldStep,at:0,action:'SEND',edgeId:99});
    pushUndo();s.steps=[];const newStep=s.nextStepId++;s.steps.push({id:newStep,at:0,action:'SEND',edgeId:99});
    pushUndo();P().scenarios=[];const newId=P().nextScenarioId++;[s.id,newId,oldStep,newStep];
  `);
  assert.equal(ids[1],ids[0]+1);assert.equal(ids[3],ids[2]+1);
});
test('CONTROL: borrar target mantiene definición missing y undo original repara Run',()=>{
  const m=model({editor:true});m.ctx.qaDoc=m.normalize(project({nodes:[{id:1}],scenarios:[scenario([set()])]})).doc;
  m.run('doc=qaDoc;selN.add(1);deleteSel()');
  assert.equal(m.run('P().scenarios[0].steps[0].nodeId'),1);reject(engine().runScenario(m.run('P()'),[],m.run('P().scenarios[0]')));
  m.run('undo()');assert.equal(engine().runScenario(m.run('P()'),[],m.run('P().scenarios[0]')).ok,true);
});
test('CONTROL: Share real → viewer READY → copia editable conserva v4, orden y missing',async()=>{
  const creator=makeViewer();creator.run(read('js/share-url.js'));
  const input=project({nodes:[{id:1}],behaviors:[{nodeId:88,initialState:'DOWN'}],scenarios:[scenario([set(9,0,88),set(1,0,1,'UP')])]});
  creator.context.qaInput=input;
  const url=await creator.run('createShareUrl(qaInput,"https://fluyo.space/")');
  const viewer=makeViewer({search:'',hash:new URL(url).hash});await viewer.boot();
  await viewer.waitForPhase(p=>p==='ready'||p==='error');
  assert.equal(viewer.viewer().phase,'ready');
  assert.equal(viewer.run('typeof FluyoScenarios'),'undefined');
  assert.deepEqual(json(viewer.run('doc.pages[0].scenarios')),input.doc.pages[0].scenarios);
  assert.deepEqual(json(viewer.run('doc.pages[0].behaviors')),input.doc.pages[0].behaviors);
  const data=await viewer.run('decodeDeepLink(location.hash.slice(3))');
  assert.equal(data.version,5);assert.equal('trace' in data.doc.pages[0],false);
  await viewer.el('btnOpen').onclick();assert.equal(new URL(viewer.context.location.href).hash,new URL(url).hash);
});

test('QA-01: una arista colgante no usada bloquea Run',()=>{
  reject(engine().runScenario({nodes:[{id:1}],edges:[{id:2,from:1,to:99}]},[],scenario([set()])));
});
test('QA-02: nodes y edges comparten namespace, IDs cruzados duplicados bloquean Run',()=>{
  reject(engine().runScenario({nodes:[{id:1},{id:2}],edges:[{id:1,from:1,to:2}]},[],scenario([send(1,0,1)])));
});
for(const [label,pg] of [
  ['Behavior',{behaviors:[{nodeId:1,initialState:'DOWN'}]}],
  ['SET_STATE',{scenarios:[scenario([set()])]}],
  ['SEND',{nodes:[{id:1},{id:2}],scenarios:[scenario([send()])]}],
  ['endpoint',{nodes:[{id:1}],edges:[{id:2,from:1,to:3}]}]
]) test(`QA-03: nextId reserva referencias missing de ${label}`,()=>{
  const m=model({editor:true}),out=m.normalize(project(pg));m.ctx.qaDoc=out.doc;m.run('doc=qaDoc');
  const referencedId=label==='SEND'||label==='endpoint'?3:1;
  assert.ok(out.doc.pages[0].nextId>referencedId,`nextId=${out.doc.pages[0].nextId}, missing=${referencedId}`);
});
test('QA-03: reabrir y crear no retargetea silenciosamente un SET_STATE missing',()=>{
  const m=model({editor:true});m.ctx.qaInput=project({scenarios:[scenario([set()])]});
  m.run('doc=projectFromProjectData(qaInput).doc');
  reject(engine().runScenario(m.run('P()'),[],m.run('P().scenarios[0]')));
  m.run('newNode("rect",0,0)');
  reject(engine().runScenario(m.run('P()'),[],m.run('P().scenarios[0]')));
});
test('QA-04: undo dos veces y redo conserva la marca de steps del Scenario restaurado',()=>{
  const m=model({editor:true});
  const restored=m.run(`
    pushUndo();P().scenarios.push({id:P().nextScenarioId++,engineVersion:1,name:'S',nextStepId:1,steps:[]});
    pushUndo();P().scenarios[0].steps.push({id:P().scenarios[0].nextStepId++,at:0,action:'SEND',edgeId:99});
    undo();undo();redo();P().scenarios[0].nextStepId;
  `);
  assert.equal(restored,2);
});
test('QA-05: nextStepId inválido se rechaza por engine',()=>{
  const e=engine();
  for(const value of [undefined,0,-1,1.5,'2',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const sc=scenario([send()]);sc.nextStepId=value;
    reject(e.runScenario(structure(),[],sc));
  }
});
test('QA-06: validación devuelve errors con todos los errores en orden de fases',()=>{
  const result=engine().runScenario({nodes:[{id:1}],edges:[{id:2,from:1,to:99}]},[{nodeId:88,initialState:'DOWN'}],scenario([set(1,0,77),{id:2,at:-1,action:'WAIT'}]));
  reject(result);
  assert.ok(Array.isArray(result.errors),JSON.stringify(result));
  assert.ok(result.errors.length>=4);
  assert.equal(result.errors[0].path,'scenario.steps[1]');
});
test('QA-07: importar más de 1000 pasos preserva definición y bloquea solo Run',()=>{
  const steps=Array.from({length:1001},(_,i)=>set(i+1));
  const pg=model().normalize(project({nodes:[{id:1}],scenarios:[scenario(steps)]})).doc.pages[0];
  assert.equal(pg.scenarios[0].steps.length,1001);reject(engine().runScenario(pg,[],pg.scenarios[0]));
});
test('QA-07: timestamp seguro sobre 24h preserva definición y bloquea solo Run',()=>{
  const pg=model().normalize(project({nodes:[{id:1}],scenarios:[scenario([set(1,86400001)])]})).doc.pages[0];
  assert.equal(pg.scenarios[0].steps[0].at,86400001);reject(engine().runScenario(pg,[],pg.scenarios[0]));
});
test('QA-07: Share y viewer conservan Scenario fuera del guard de ejecución',async()=>{
  const creator=makeViewer();creator.run(read('js/share-url.js'));
  creator.context.qaInput=project({nodes:[{id:1}],scenarios:[scenario([set(1,86400001)])]});
  const url=await creator.run('createShareUrl(qaInput,"https://fluyo.space/")');
  const viewer=makeViewer({search:'',hash:new URL(url).hash});await viewer.boot();
  await viewer.waitForPhase(p=>p==='ready'||p==='error');
  assert.equal(viewer.viewer().phase,'ready');
});
test('QA-08: contador nextStepId ausente se deriva de IDs existentes en migración',()=>{
  const sc=scenario([send(7)]);delete sc.nextStepId;
  const pg=model().normalize(project({scenarios:[sc]})).doc.pages[0];assert.equal(pg.scenarios[0].nextStepId,8);
});
for(const which of ['scenario','step']) test(`QA-09: contador imposible por ID máximo de ${which} se rechaza en entrada`,()=>{
  const sc=scenario();
  if(which==='scenario') sc.id=Number.MAX_SAFE_INTEGER;
  else {sc.steps=[set(Number.MAX_SAFE_INTEGER)];sc.nextStepId=1;}
  assert.throws(()=>model().normalize(project({scenarios:[sc]})),e=>e.code==='invalid_document');
});
test('QA-09: fábrica bloquea agotamiento antes de mutar la página',()=>{
  const m=model({editor:true});m.ctx.qaDoc=m.normalize(project({nextId:Number.MAX_SAFE_INTEGER})).doc;
  m.run('doc=qaDoc');const before=m.run('JSON.stringify(P())');
  // Puede permitir el último entero sólo si define una marca de agotamiento segura.
  for(let i=0;i<3;i++){try{m.run('newNode("rect",0,0)');}catch{break;}}
  const pg=m.run('P()');
  assert.ok(Number.isSafeInteger(pg.nextId));
  assert.equal(new Set(pg.nodes.map(n=>n.id)).size,pg.nodes.length);
  assert.ok(pg.nodes.every(n=>Number.isSafeInteger(n.id)));
  if(pg.nodes.length===0) assert.equal(m.run('JSON.stringify(P())'),before);
});
test('QA-10: duplicar selección remapea Behavior DOWN, conserva Scenario original',()=>{
  const m=model({editor:true});m.ctx.qaDoc=m.normalize(project({nodes:[{id:1},{id:2}],edges:[{id:3,from:1,to:2}],behaviors:[{nodeId:1,initialState:'DOWN'}],scenarios:[scenario([send()])]})).doc;
  m.run('doc=qaDoc;selN.add(1);selN.add(2);dupSel()');
  const pg=m.run('P()');assert.deepEqual(json(pg.behaviors),[{nodeId:1,initialState:'DOWN'},{nodeId:4,initialState:'DOWN'}]);
  assert.deepEqual(json(pg.edges[1]),{...json(pg.edges[0]),id:6,from:4,to:5});
  assert.equal(pg.scenarios.length,1);
});
