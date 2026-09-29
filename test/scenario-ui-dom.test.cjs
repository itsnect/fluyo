"use strict";
/* FLUYO-009 — Tests DOM de la UI de Scenarios: storyboard, lenguaje humano,
   tiempo relativo, canvas-first authoring y playback visual. */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makeFakeElement(tag){
  const el={
    tagName:String(tag).toUpperCase(),
    children:[],
    attrs:{},
    style:{},
    classList:{
      _set:new Set(),
      add(c){ this._set.add(c); },
      contains(c){ return this._set.has(c); },
      remove(c){ this._set.delete(c); }
    },
    setAttribute(k,v){ this.attrs[k]=String(v); },
    getAttribute(k){ return Object.prototype.hasOwnProperty.call(this.attrs,k)?this.attrs[k]:null; },
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ const i=this.children.indexOf(c); if(i>=0)this.children.splice(i,1); return c; },
    insertBefore(c,ref){ const i=this.children.indexOf(ref); if(i>=0)this.children.splice(i,0,c); else this.children.push(c); return c; },
    addEventListener(){},
    removeEventListener(){},
    focus(){},
    blur(){},
    getBoundingClientRect(){ return {x:0,y:0,width:0,height:0,top:0,left:0,bottom:0,right:0}; },
    _text:'',
    get textContent(){ return this._text || this.children.map(c=>c.textContent).join(''); },
    set textContent(v){ this._text=String(v); this.children=[]; },
    querySelector(sel){ return queryElement(this,sel); },
    querySelectorAll(sel){ return queryAll(this,sel); },
    get className(){ return [...this.classList._set].join(' '); },
    set className(v){ this.classList._set.clear(); for(const c of String(v).trim().split(/\s+/)) if(c) this.classList._set.add(c); },
    get id(){ return this.attrs.id; },
    set id(v){ this.attrs.id=String(v); },
    get innerHTML(){ return this.children.map(c=>c.outerHTML||c.textContent).join(''); },
    set innerHTML(v){ this._text=''; this.children=[]; if(v && typeof v==='string'){ /* no parse needed para tests */ } }
  };
  return el;
}

function matches(el,sel){
  if(!el || !el.attrs) return false;
  if(sel.startsWith('#')) return el.attrs.id===sel.slice(1);
  if(sel.startsWith('.')) return el.classList._set.has(sel.slice(1));
  return el.tagName===sel.toUpperCase();
}
function queryElement(root,sel){
  if(matches(root,sel)) return root;
  for(const c of root.children){ const r=queryElement(c,sel); if(r) return r; }
  return null;
}
function queryAll(root,sel){
  const out=[];
  if(matches(root,sel)) out.push(root);
  for(const c of root.children) out.push(...queryAll(c,sel));
  return out;
}

function makeDOM(){
  const registry=new Map();
  const doc={
    getElementById(id){ return registry.get(String(id))||null; },
    createElement(tag){ return makeFakeElement(tag); },
    createTextNode(t){ const el=makeFakeElement('#text'); el.textContent=String(t); return el; },
    body:makeFakeElement('body'),
    querySelector(sel){ const r=queryElement(this.body,sel); return r; },
    querySelectorAll(sel){ return queryAll(this.body,sel); },
    addEventListener(){},
    removeEventListener(){},
    _registry:registry
  };
  function $(id){ return doc.getElementById(id); }
  function register(id,el){ el.attrs.id=String(id); registry.set(String(id),el); doc.body.appendChild(el); }
  return {doc,$,register};
}

function makeScenarioUIContext(){
  const {doc,$,register}=makeDOM();
  const ctx=vm.createContext({
    run:function(code){ return vm.runInContext(code, this); },
    console,
    Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError,
    RegExp, Date, String, Boolean, parseInt, isNaN, isFinite, Infinity, NaN,
    Uint8Array, TextEncoder, TextDecoder, atob, btoa, URL, URLSearchParams,
    performance:{now:()=>0},
    requestAnimationFrame:()=>0,
    cancelAnimationFrame:()=>{},
    window:{}, document:doc, navigator:{}, location:{},
    $,
    pushUndo:()=>{},
    scheduleAutosave:()=>{},
    switchPanelTab:()=>{},
    clearSel:()=>{}, renderTabs:()=>{}, refreshPanel:()=>{},
    selectOnly:(type,id)=>{ ctx.selN.clear(); ctx.selE.clear(); (type==="node"?ctx.selN:ctx.selE).add(id); },
    singleSel:()=>{
      if(ctx.selN.size===1 && ctx.selE.size===0){ const id=[...ctx.selN][0]; const n=ctx.run(`nodeById(${id})`); return n?{type:"node",obj:n}:null; }
      if(ctx.selE.size===1 && ctx.selN.size===0){ const id=[...ctx.selE][0]; const e=ctx.run(`edgeById(${id})`); return e?{type:"edge",obj:e}:null; }
      return null;
    },
    selN:new Set(), selE:new Set(),
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
  });
  vm.runInContext(read('js/config.js'), ctx);
  vm.runInContext(read('js/safe-svg.js'), ctx);
  vm.runInContext(read('js/model.js'), ctx);
  vm.runInContext(read('js/scenario-engine.js'), ctx);
  vm.runInContext(read('js/scenario-playback.js'), ctx);
  vm.runInContext(read('js/editor-scenarios.js'), ctx);
  return {ctx,doc,register};
}

function freshPage(ctx){
  ctx.run(`
    doc={theme:"dark", customBg:"", eventTypes:[], nextEventTypeId:1, pages:[{name:"P", nodes:[], edges:[], nextId:1, behaviors:[], scenarios:[], nextScenarioId:1}], cur:0};
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

function setupPanel(ctx, register){
  const ids=['panelScenarios','scSel','scName','scUnsupported','scErrors','scBehaviors','scStoryboard','scEmptyState','scAddBehavior','scAddMoment','scRun','scReset','scTraceLog','scStatus','tabProperties','scToggleConfig','scConfig','scToggleTrace','scTraceWrap','scMomentDialog','scMomentState','scMomentSend','scMomentCancel','scEventLibrary','scEventDialog','scEventDialogTitle','scEventName','scEventPrimitive','scEventTemplate','scEventVisual','scEventAvailabilityRow','scEventAvailability','scEventPreview','scEventSave','scEventCancel','scEventDelete','scEventNew'];
  for(const id of ids){
    const el=ctx.document.createElement('div');
    if(id==='scSel'){
      Object.defineProperty(el,'value',{get(){return String(el._value||'');},set(v){el._value=String(v);},configurable:true});
      el.onchange=null;
    }
    register(id,el);
  }
}

function ensureUI(ctx){
  ctx.run('ensureScenariosUI();');
}

function selectOption(sel,val){
  sel.value=String(val);
  if(sel.onchange) sel.onchange();
}

function findField(card,labelText){
  const form=card.querySelector('.scStepForm');
  if(!form) return null;
  for(const f of form.querySelectorAll('.scStepField')){
    const lbl=f.children.find? f.children.find(c=>c.tagName==='LABEL') : f.children[0];
    if(lbl && lbl.textContent===labelText) return f;
  }
  return null;
}

function fieldControl(field){
  for(const c of field.children){ if(c.tagName==='INPUT' || c.tagName==='SELECT') return c; }
  return null;
}

function textNodesFlat(el){
  const out=[];
  function walk(n){
    if(n.tagName==='#TEXT'){ out.push(n.textContent); return; }
    if(n._text && n.children.length===0){ out.push(n._text); return; }
    for(const c of n.children) walk(c);
  }
  walk(el);
  return out;
}

function expandCard(ctx, stepId){
  ctx.run(`scExpandedStepId=${stepId}; scRenderStoryboard();`);
}

/* ===================== Tests de lenguaje humano ===================== */
test('describeScenarioStep: SET_STATE DOWN -> Kafka se cae',()=>{
  const {ctx}=makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`result=describeScenarioStep({action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  assert.equal(ctx.result.primary,'Kafka se cae');
  assert.equal(ctx.result.targetType,'node');
  assert.equal(ctx.result.targetId,ctx.nodeId);
  assert.equal(ctx.result.missing,false);
});

test('describeScenarioStep: SET_STATE UP -> Kafka se recupera',()=>{
  const {ctx}=makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`result=describeScenarioStep({action:"SET_STATE", nodeId:nodeId, state:"UP"});`);
  assert.equal(ctx.result.primary,'Kafka se recupera');
});

test('describeScenarioStep: SEND -> Producer envía a Kafka',()=>{
  const {ctx}=makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`result=describeScenarioStep({action:"SEND", edgeId:edgeId});`);
  assert.equal(ctx.result.primary,'Producer → Kafka envía');
  assert.equal(ctx.result.targetType,'edge');
  assert.equal(ctx.result.targetId,ctx.edgeId);
});

test('describeScenarioStep: missing node -> warning',()=>{
  const {ctx}=makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`result=describeScenarioStep({action:"SET_STATE", nodeId:999, state:"DOWN"});`);
  assert.equal(ctx.result.primary,'⚠ Elemento eliminado');
  assert.equal(ctx.result.missing,true);
});

test('describeScenarioStep: missing edge -> warning',()=>{
  const {ctx}=makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`result=describeScenarioStep({action:"SEND", edgeId:999});`);
  assert.equal(ctx.result.primary,'⚠ Conexión eliminada');
  assert.equal(ctx.result.missing,true);
});

test('describeScenarioStep se actualiza al renombrar nodo',()=>{
  const {ctx}=makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`const n=nodeById(nodeId); n.label="Broker"; result=describeScenarioStep({action:"SET_STATE", nodeId:nodeId, state:"DOWN"}).primary;`);
  assert.equal(ctx.result,'Broker se cae');
});

test('Nodo sin nombre usa fallback estable',()=>{
  const {ctx}=makeScenarioUIContext();
  buildExample(ctx);
  ctx.run(`const n=nodeById(nodeId); n.label=""; result=describeScenarioStep({action:"SET_STATE", nodeId:nodeId, state:"DOWN"}).primary;`);
  assert.ok(ctx.result.startsWith('Nodo #'));
  assert.ok(ctx.result.includes('se cae'));
});

/* ===================== Tests de tiempo relativo ===================== */
test('formatRelativeDelay: casos humanos',()=>{
  const {ctx}=makeScenarioUIContext();
  const cases=[[0,'al mismo tiempo'],[250,'250 ms después'],[1000,'1 s después'],[1500,'1.5 s después'],[5000,'5 s después']];
  for(const [ms,expected] of cases){
    ctx.run(`result=formatRelativeDelay(${ms});`);
    assert.equal(ctx.result,expected,`formatRelativeDelay(${ms})`);
  }
});

test('Storyboard muestra delays relativos por defecto',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`createStep(P().scenarios[0], {at:1000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`createStep(P().scenarios[0], {at:5000, action:"SET_STATE", nodeId:nodeId, state:"UP"});`);
  ctx.run(`createStep(P().scenarios[0], {at:6000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`scRenderStoryboard();`);
  const delays=ctx.document.querySelectorAll('.scMomentHeader');
  const texts=[...delays].map(d=>d.textContent).filter(Boolean);
  assert.deepEqual(texts,['1 s después','4 s después','1 s después']);
});

test('Mismo timestamp muestra al mismo tiempo y preserva orden',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`createStep(P().scenarios[0], {at:1000, action:"SET_STATE", nodeId:nodeId, state:"UP"});`);
  ctx.run(`createStep(P().scenarios[0], {at:1000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`scRenderStoryboard();`);
  const cards=ctx.document.querySelectorAll('.scStepCard');
  assert.equal(cards.length,3);
  const primaries=[...cards].map(c=>c.querySelector('.scStepPrimary').textContent);
  assert.equal(primaries[0],'Kafka se cae');
  assert.equal(primaries[1],'Kafka se recupera');
  assert.equal(primaries[2],'Producer → Kafka envía');
  const headers=[...ctx.document.querySelectorAll('.scMomentHeader')].map(h=>h.textContent).filter(Boolean);
  assert.deepEqual(headers,['1 s después']);
});

/* ===================== Tests de cards colapsadas/expandibles ===================== */
test('Cards están colapsadas por defecto',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`scRenderStoryboard();`);
  const cards=ctx.document.querySelectorAll('.scStepCard');
  assert.equal(cards.length,1);
  assert.equal(cards[0].querySelector('.scStepForm'),null,'No debe haber formulario colapsado');
  assert.equal(cards[0].querySelector('.scStepPrimary').textContent,'Kafka se cae');
});

test('Expandir card muestra controles de edición',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`scRenderStoryboard(); stepId=P().scenarios[0].steps[0].id;`);
  let cards=ctx.document.querySelectorAll('.scStepCard');
  expandCard(ctx, ctx.stepId);
  cards=ctx.document.querySelectorAll('.scStepCard');
  assert.ok(findField(cards[0],'Elemento'),'Debe existir campo Elemento');
  assert.ok(findField(cards[0],'Estado'),'Debe existir campo Estado');
  assert.ok(findField(cards[0],'Tiempo'),'Debe existir campo Tiempo');
});

/* ===================== Tests de edición de delay ===================== */
test('Editar delay desplaza step y posteriores manteniendo distancias relativas',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`createStep(P().scenarios[0], {at:1000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`createStep(P().scenarios[0], {at:5000, action:"SET_STATE", nodeId:nodeId, state:"UP"});`);
  ctx.run(`createStep(P().scenarios[0], {at:6000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`scSetStepDelay(P().scenarios[0].steps[1].id, 2000);`);
  ctx.run(`result=P().scenarios[0].steps.map(s=>s.at);`);
  assert.equal(JSON.stringify(ctx.result),JSON.stringify([0,2000,6000,7000]));
});

/* ===================== Tests de mapping y formulario ===================== */
test('Mapping SET_STATE: seleccionar Kafka persiste nodeId de Kafka',()=>{
  const {ctx,register}=makeScenarioUIContext();
  const ids=buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:producerId, state:"DOWN"});`);
  ctx.run(`scRenderStoryboard(); stepId=P().scenarios[0].steps[0].id;`);
  expandCard(ctx, ctx.stepId);
  const cards=ctx.document.querySelectorAll('.scStepCard');
  const nodeField=findField(cards[0],'Elemento');
  assert.ok(nodeField,'Debe existir el campo Elemento');
  const nodeSel=fieldControl(nodeField);
  assert.ok(nodeSel,'Debe existir el select de Elemento');
  assert.ok(nodeSel.children.some(o=>String(o.value)===String(ids.nodeId) && o.textContent==='Kafka'),'Selector debe contener Kafka');
  selectOption(nodeSel,ids.nodeId);
  ctx.run(`result=P().scenarios[0].steps[0];`);
  const updated=ctx.result;
  assert.equal(updated.nodeId,ids.nodeId);
  ctx.run(`result=FluyoScenarios.runScenario({nodes:P().nodes, edges:P().edges}, P().behaviors, P().scenarios[0]);`);
  const res=ctx.result;
  assert.equal(res.ok,true);
  const first=res.trace.events[0];
  assert.equal(first.type,'state_changed');
  assert.equal(first.nodeId,ids.nodeId);
  assert.equal(first.from,'UP');
  assert.equal(first.to,'DOWN');
});

test('Mapping SEND: seleccionar Producer → Kafka persiste edge correcto',()=>{
  const {ctx,register}=makeScenarioUIContext();
  const ids=buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SEND", edgeId:edgeId});`);
  ctx.run(`scRenderStoryboard(); stepId=P().scenarios[0].steps[0].id;`);
  expandCard(ctx, ctx.stepId);
  let cards=ctx.document.querySelectorAll('.scStepCard');
  const edgeField=findField(cards[0],'Conexión');
  assert.ok(edgeField,'Debe existir el campo Conexión');
  const edgeSel=fieldControl(edgeField);
  assert.ok(edgeSel,'Debe existir el select de Conexión');
  const opt=edgeSel.children.find(o=>String(o.value)===String(ids.edgeId));
  assert.ok(opt,'Selector debe contener la conexión');
  assert.ok(opt.textContent.includes('Producer'),'Label debe incluir Producer');
  assert.ok(opt.textContent.includes('Kafka'),'Label debe incluir Kafka');
  selectOption(edgeSel,ids.edgeId);
  ctx.run(`result=P().scenarios[0].steps[0];`);
  const updated=ctx.result;
  assert.equal(updated.action,'SEND');
  assert.equal(updated.edgeId,ids.edgeId);
  assert.equal(updated.nodeId,undefined);
  assert.equal(updated.state,undefined);
});

/* ===================== Tests de playback storyboard ===================== */
test('Playback storyboard: Caída de Kafka muestra estados correctos',()=>{
  const {ctx,register}=makeScenarioUIContext();
  const ids=buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`createStep(P().scenarios[0], {at:1000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`createStep(P().scenarios[0], {at:5000, action:"SET_STATE", nodeId:nodeId, state:"UP"});`);
  ctx.run(`createStep(P().scenarios[0], {at:6000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`scRun();`);
  ctx.run(`FluyoScenarioPlayback.tick(scPlayback, 7000); scRenderStoryboard();`);
  const cards=ctx.document.querySelectorAll('.scStepCard');
  assert.ok(cards[0].classList.contains('scStatus_completed'),'Kafka DOWN completado');
  assert.ok(cards[1].classList.contains('scStatus_failed'),'SEND fallido');
  assert.ok(cards[2].classList.contains('scStatus_completed'),'Kafka UP completado');
  assert.ok(cards[3].classList.contains('scStatus_success'),'SEND exitoso');
  const detail=cards[1].querySelector('.scStepDetail');
  assert.ok(detail && detail.textContent==='Destino no disponible','Detalle de fallo humano');
});

test('Reset vuelve storyboard a editable/pending',()=>{
  const {ctx,register}=makeScenarioUIContext();
  const ids=buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`createStep(P().scenarios[0], {at:1000, action:"SEND", edgeId:edgeId});`);
  ctx.run(`scRun();`);
  ctx.run(`FluyoScenarioPlayback.tick(scPlayback, 7000);`);
  ctx.run(`scReset(); scRenderStoryboard();`);
  const cards=ctx.document.querySelectorAll('.scStepCard');
  assert.ok(cards.every(c=>c.classList.contains('scStatus_pending')),'Todos pending tras reset');
});

/* ===================== Tests de Trace secundario ===================== */
test('Trace técnico sigue disponible colapsado por defecto',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`scRun();`);
  ctx.run(`FluyoScenarioPlayback.tick(scPlayback, 7000); scRenderTraceLog();`);
  const log=ctx.document.getElementById('scTraceLog');
  const lines=log.querySelectorAll('.scLogLine');
  assert.ok(lines.length>=1);
  const txt=textNodesFlat(lines[0]).join(' ');
  assert.ok(txt.includes('Kafka'),'Trace debe mostrar Kafka');
  assert.ok(txt.includes('UP'),'Trace debe mostrar UP');
  assert.ok(txt.includes('DOWN'),'Trace debe mostrar DOWN');
});

/* ===================== Tests de canvas-first authoring ===================== */
test('Canvas authoring nodo: Se cae crea SET_STATE DOWN',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario(); selN.add(nodeId); scCanvasAddNodeStep("DOWN");`);
  ctx.run(`result=P().scenarios[0].steps[0];`);
  assert.equal(ctx.result.action,'SET_STATE');
  assert.equal(ctx.result.nodeId,ctx.nodeId);
  assert.equal(ctx.result.state,'DOWN');
  assert.equal(ctx.result.at,0);
});

test('Canvas authoring edge: Enviar crea SEND',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario(); selE.add(edgeId); scCanvasAddEdgeSend();`);
  ctx.run(`result=P().scenarios[0].steps[0];`);
  assert.equal(ctx.result.action,'SEND');
  assert.equal(ctx.result.edgeId,ctx.edgeId);
  assert.equal(ctx.result.at,0);
});

test('Canvas authoring timing: segundo momento usa DEFAULT_STEP_DELAY',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`selE.add(edgeId); scCanvasAddEdgeSend();`);
  ctx.run(`result=P().scenarios[0].steps.map(s=>s.at);`);
  assert.equal(JSON.stringify(ctx.result),JSON.stringify([0,1000]));
});

/* ===================== Tests de mapping visual→modelo ===================== */
test('Formulario SEND muestra Conexión y no Elemento/Estado',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SEND", edgeId:edgeId});`);
  ctx.run(`scRenderStoryboard(); stepId=P().scenarios[0].steps[0].id;`);
  let cards=ctx.document.querySelectorAll('.scStepCard');
  expandCard(ctx, ctx.stepId);
  cards=ctx.document.querySelectorAll('.scStepCard');
  assert.ok(findField(cards[0],'Conexión'));
  assert.equal(findField(cards[0],'Elemento'),null,'No debe quedar campo Elemento');
  assert.equal(findField(cards[0],'Estado'),null,'No debe quedar campo Estado');
});

test('Readability: cada Step contiene número, frase y acciones',()=>{
  const {ctx,register}=makeScenarioUIContext();
  buildExample(ctx);
  setupPanel(ctx,register);
  ensureUI(ctx);
  ctx.run(`scNewScenario();`);
  ctx.run(`createStep(P().scenarios[0], {at:0, action:"SET_STATE", nodeId:nodeId, state:"DOWN"});`);
  ctx.run(`scRenderStoryboard();`);
  const cards=ctx.document.querySelectorAll('.scStepCard');
  assert.equal(cards.length,1);
  const card=cards[0];
  assert.ok(card.querySelector('.scStepMain'),'Debe tener main');
  assert.ok(card.querySelector('.scStepNumber'),'Debe mostrar número');
  assert.ok(textNodesFlat(card).some(t=>t.includes('Kafka se cae')),'Debe mostrar frase humana');
  const actions=card.querySelector('.scStepActions');
  assert.ok(actions,'Debe tener acciones');
});
