"use strict";
/* FLUYO-013 — Present: helpers puros y contratos de arquitectura.
   El flujo real (estados, Stop/Repeat/Exit, viewports) vive en test/fluyo-013-browser.cjs. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

/* La parte pura vive en story-playback.js (FLUYO-014), compartida con el Viewer. */
const ctx={};vm.createContext(ctx);vm.runInContext(read('js/story-playback.js')+';this.F=FluyoPresentStory;',ctx);
const F=ctx.F;

const names={1:'Pago',2:'Despacho',3:'Pago recibido'};
const groups=[
  {at:0,steps:[{eventTypeId:1}]},
  {at:2000,steps:[{eventTypeId:2},{eventTypeId:3},{eventTypeId:2}]},
  {at:5000,steps:[{}]},
];

test('momentos: nombres humanos, sin repetir, en orden de resolución',()=>{
  const m=F.moments(groups,s=>names[s.eventTypeId]);
  assert.deepEqual(m.map(x=>x.label),['Pago','Despacho · Pago recibido','']);
  assert.deepEqual(m.map(x=>x.at),[0,2000,5000]);
});
test('progreso: índice del último momento alcanzado',()=>{
  const m=F.moments(groups,s=>names[s.eventTypeId]);
  assert.equal(F.currentIndex(m,-1),-1);
  assert.equal(F.currentIndex(m,0),0);
  assert.equal(F.currentIndex(m,1999),0);
  assert.equal(F.currentIndex(m,2000),1);
  assert.equal(F.currentIndex(m,99999),2);
  assert.equal(F.currentIndex([],10),-1);
});
const nodeName=id=>({1:'Producer',2:'Kafka',3:'Consumer'})[id];
const edgeEnds=id=>({10:{from:1,to:2},11:{from:2,to:3}})[id];
test('consecuencias en lenguaje humano, nunca razones internas',()=>{
  const log=[{at:1000,type:'send_failed',edgeId:10,stepId:5,reason:'target_down'}];
  assert.equal(F.caption(log,1500,nodeName,edgeEnds),'No se completó · Kafka no está disponible');
  const src2=[{at:1000,type:'send_failed',edgeId:11,stepId:6,reason:'source_down'}];
  assert.equal(F.caption(src2,1000,nodeName,edgeEnds),'No se completó · Kafka no está disponible');
  const st=[{at:0,type:'state_changed',nodeId:2,from:'UP',to:'DOWN',stepId:1}];
  assert.equal(F.caption(st,10,nodeName,edgeEnds),'Kafka no está disponible');
  const up=[{at:0,type:'state_changed',nodeId:2,from:'DOWN',to:'UP',stepId:1}];
  assert.equal(F.caption(up,10,nodeName,edgeEnds),'Kafka vuelve a estar disponible');
  for(const c of [F.caption(log,1500,nodeName,edgeEnds),F.caption(st,10,nodeName,edgeEnds)]) assert.doesNotMatch(c,/target_down|source_down|SEND|SET_STATE|DOWN|UP/);
});
test('el mensaje expira y no mira al futuro',()=>{
  const log=[{at:1000,type:'send_failed',edgeId:10,stepId:5,reason:'target_down'}];
  assert.equal(F.caption(log,999,nodeName,edgeEnds),null);
  assert.equal(F.caption(log,1000+F.CAPTION_MS,nodeName,edgeEnds),null);
  assert.equal(F.caption([{at:0,type:'send_started',edgeId:10,stepId:5}],10,nodeName,edgeEnds),null);
});
test('cierre: eventos que no se completaron (pasos distintos)',()=>{
  const log=[{type:'send_failed',stepId:1},{type:'send_failed',stepId:1},{type:'send_failed',stepId:2},{type:'send_succeeded',stepId:3}];
  assert.equal(F.failedCount(log),2);
  assert.equal(F.summary(0),'');
  assert.equal(F.summary(1),'1 evento no pudo realizarse');
  assert.equal(F.summary(2),'2 eventos no pudieron realizarse');
});

test('arquitectura: Present no toca motor ni playback ni schema',()=>{
  for(const f of ['js/scenario-engine.js','js/scenario-playback.js']) assert.doesNotMatch(read(f),/present(Story|Phase|Play)|FluyoPresentStory/i,f);
  const ps=read('js/present-story.js');
  assert.doesNotMatch(ps,/runScenario|makePlayback|requestAnimationFrame|setInterval/,'Present no ejecuta ni agenda nada');
  assert.match(ps,/scRun\(\{present:true\}\)/,'reproduce con el scRun existente');
  assert.match(read('js/model.js'),/version:5/);
});
test('assets: present-story.js se carga y se precachea (SW subido)',()=>{
  assert.match(read('index.html'),/<script src="js\/present-story\.js"><\/script>/);
  assert.ok(read('index.html').indexOf('editor-scenarios.js')<read('index.html').indexOf('present-story.js'));
  assert.match(read('sw.js'),/"\.\/js\/present-story\.js"/);
  assert.match(read('sw.js'),/fluyo-static-v61/);
});
test('Present sale limpiando: exitPresent y goSlide detienen el playback',()=>{
  const ui=read('js/ui.js');
  const exit=ui.slice(ui.indexOf('function exitPresent'),ui.indexOf('$("btnPresent")'));
  assert.match(exit,/scReset\(\)/);
  const go=ui.slice(ui.indexOf('function goSlide'),ui.indexOf('function nextSlide'));
  assert.match(go,/scReset\(\)/);
});
test('Present sin Historia no crea Scenario (no hay escritura en presentPlay/Refresh)',()=>{
  const ps=read('js/present-story.js');
  assert.doesNotMatch(ps,/createScenario|createStep|pushUndo|scheduleAutosave|\.steps\s*=|\.steps\.push/);
});

/* QA independiente de FLUYO-013 */
test('QA D1: el encaje diferido no toca la vista del editor tras salir',()=>{
  const ps=read('js/present-story.js');
  const fit=ps.slice(ps.indexOf('function fitViewPresent'));
  assert.match(fit,/function fitViewPresent\([^)]*\)\{[^}]*?if\(!presenting\) return;/s);
});
test('QA D2: la barra y el encabezado no dependen del shrink-to-fit de left:50% (móvil)',()=>{
  const css=read('css/styles.css');
  assert.match(css,/#presentBar\{width:max-content;/);
  assert.match(css,/#presentStory\{[^}]*width:max-content;/s);
});
