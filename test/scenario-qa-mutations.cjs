"use strict";
/* Mutaciones sólo en directorios temporales. Nunca escribe fuentes productivas. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const {VIEWER_SCRIPTS}=require('./viewer-harness.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const engine=read('js/scenario-engine.js');
const versionBlock=engine.slice(engine.indexOf('    if(!Number.isSafeInteger(scenario.engineVersion))'),engine.indexOf('    if(typeof scenario.name'));
const model=read('js/model.js');
const reserveBlock=model.slice(model.indexOf('function structuralNextId(pg){'),model.indexOf('function reserveProjectIds('));
const mutations=[
  {name:'tie-break por step.id',file:'js/scenario-engine.js',from:'return a.sequence - b.sequence;',to:'return a.step.id - b.step.id;'},
  {name:'undo reutiliza nextId',file:'js/selection.js',from:'pg.nextId=Math.max(prevNextId, restored.nextId);',to:'pg.nextId=restored.nextId;'},
  {name:'engineVersion sin validación',file:'js/scenario-engine.js',from:versionBlock,to:''},
  {name:'acción desconocida admitida',file:'js/scenario-engine.js',from:'new Set(["SET_STATE", "SEND"])',to:'new Set(["SET_STATE", "SEND", "EXECUTE"])'},
  {name:'mutación de Behavior durante Run',file:'js/scenario-engine.js',from:'const states = buildInitialStates(structure, behaviors);',to:'behaviors.push({nodeId:1,initialState:"DOWN"}); const states = buildInitialStates(structure, behaviors);'},
  {name:'viewer pierde Scenario en normalización',file:'js/model.js',from:'normalizeBehaviors(pg); normalizeScenarios(pg);',to:'normalizeBehaviors(pg); normalizeScenarios(pg); pg.scenarios=[];'},
  {name:'viewer intenta ejecutar Scenario',file:'js/viewer.js',from:'async function bootViewer(){',to:'async function bootViewer(){ FluyoScenarios.runScenario({},[],{});'},
  // Re-QA: conservar los siete controles anteriores y refutar las correcciones.
  {name:'missing ID reutilizado',file:'js/model.js',from:reserveBlock,to:'function structuralNextId(pg){ let maxId=0; for(const item of [...pg.nodes,...pg.edges]) maxId=Math.max(maxId,item.id); return projectCounter(pg.nextId,maxId); }\n',pattern:'QA-03: reabrir',failed:'QA-03:'},
  {name:'duplicación pierde Behavior',file:'js/selection.js',from:'P().behaviors.push({...deep(b),nodeId:map[b.nodeId]});',to:'void b;',pattern:'QA-10:',failed:'QA-10:'},
  {name:'guard operativo en loader',file:'js/model.js',from:'if(!Array.isArray(sc.steps)) throw projectDataError();',to:'if(!Array.isArray(sc.steps) || sc.steps.length>1000) throw projectDataError();',pattern:'QA-07: importar',failed:'QA-07:'},
  {name:'dangling ajena aceptada',file:'js/scenario-engine.js',from:'pending.push({kind:"node",id:e[endpoint],code:"missing_edge_endpoint",path:`${path}.${endpoint}`,extra:{edgeId:e.id,endpoint}});',to:'void endpoint;',pattern:'QA-01:',failed:'QA-01:'},
  {name:'duplicate structure ID aceptado',file:'js/scenario-engine.js',from:'if(entityIds.has(e.id)) add(shape,nodeIds.has(e.id)?"duplicate_structure_id":"duplicate_edge_id",path,{edgeId:e.id});',to:'/* Unicidad cruzada omitida. */',pattern:'QA-02:',failed:'QA-02:'},
  {name:'nextStepId alto reducido',file:'js/model.js',from:'sc.nextStepId=projectCounter(sc.nextStepId,maxStepId);',to:'sc.nextStepId=maxStepId+1;',suite:'scenario-post-qa.test.cjs',pattern:'nextStepId alto',failed:'nextStepId alto'},
  {name:'resultado error singular',file:'js/scenario-engine.js',from:'if(errors.length) return {ok:false,errors};',to:'if(errors.length) return {ok:false,error:errors[0]};',pattern:'QA-06:',failed:'QA-06:'}
];
let killed=0;
for(const mutation of mutations){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fluyo-008-mutation-'));
  assert.ok(path.resolve(tmp).startsWith(path.resolve(os.tmpdir())+path.sep));
  try{
    const files=new Set([...VIEWER_SCRIPTS,'js/scenario-engine.js','js/state.js','js/selection.js','js/share-url.js','test/viewer-harness.cjs','test/scenario-independent-qa.test.cjs','test/scenario-post-qa.test.cjs']);
    for(const file of files){const target=path.join(tmp,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
    const source=read(mutation.file);assert.ok(source.includes(mutation.from),'Ancla ausente: '+mutation.name);
    fs.writeFileSync(path.join(tmp,mutation.file),source.replace(mutation.from,mutation.to));
    const result=spawnSync(process.execPath,['--test','--test-reporter=spec','--test-name-pattern='+(mutation.pattern||'CONTROL'),'test/'+(mutation.suite||'scenario-independent-qa.test.cjs')],{cwd:tmp,encoding:'utf8',timeout:30000});
    assert.ok(!result.error,result.error?.message);assert.notEqual(result.status,0,'Mutación sobrevivió: '+mutation.name);
    assert.ok(result.stdout.includes('✖ '+(mutation.failed||'CONTROL:')),'Debe fallar la prueba elegida, no sólo la carga del test');
    killed++;console.log('DETECTADA: '+mutation.name);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
console.log(`${killed}/${mutations.length} mutaciones detectadas; fuentes originales intactas.`);
