// Pruebas sin dependencias ni red: node --test test/analytics.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const fuente=name=>fs.readFileSync(path.join(__dirname,'..','js',name),'utf8');

function editor(host='fluyo.space'){
  const events=[],scripts=[],listeners={},timers=new Map(),elements={};
  let seq=0;
  const element=id=>elements[id] ||= {style:{},value:'',checked:false,
    getContext:()=>({save(){},scale(){},translate(){},restore(){}}),
    getBoundingClientRect:()=>({width:800,height:600}),click(){},remove(){}};
  const context=vm.createContext({console,Blob,performance:{now:()=>0},
    location:{hostname:host},window:{},
    document:{getElementById:element,
      addEventListener:(name,cb)=>{listeners[name]=cb;},
      head:{appendChild:s=>scripts.push(s)},body:{appendChild(){}},
      createElement:tag=>tag==='script'?{dataset:{}}:tag==='canvas'?
        {...element('canvas'),toBlob:cb=>{context.blobCallback=cb;}}:element('anchor')},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setTimeout:(fn,delay=0)=>{timers.set(++seq,{fn,delay});return seq;},
    clearTimeout:id=>timers.delete(id),URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){}},
    alert(){},DEFAULT_FONT:'sans-serif',DEFAULT_SIZES:{},PALETTE:[{c:'#000'}],GRID:20,
    CODE_DEFAULT_LABEL:'',DEFAULT_LANG:'',navigator:{clipboard:{writeText:()=>Promise.resolve()}},
    refreshPanel(){},renderTabs(){},edgePoints:()=>[],render(){},now:()=>0,
    makeReadOnlyRenderState:()=>({}),t0:0,pausedAt:0});
  const run=code=>vm.runInContext(code,context);
  run(fuente('config.js'));run(fuente('safe-svg.js'));run(fuente('analytics.js'));run(fuente('editor-analytics.js'));run(fuente('model.js'));run(fuente('state.js'));run(fuente('selection.js'));
  run('resetAnalyticsBaseline()');
  const flush=()=>{
    for(const [id,t] of [...timers]) if(t.delay===0){timers.delete(id);t.fn();}
  };
  const connect=()=>{context.window.umami={track:(name,props)=>events.push({name,props})};scripts[0]?.onload();};
  return {run,flush,connect,events,scripts,listeners,context,elements,element,
    names:()=>events.map(e=>e.name)};
}

test('cola inicial conserva apertura y primera edición, una vez por carga',()=>{
  const e=editor();e.listeners.DOMContentLoaded();
  e.run('pushUndo(); newNode("rect",0,0)');e.flush();
  assert.equal(e.events.length,0);e.connect();
  assert.deepEqual(e.names(),['editor_opened','first_edit_completed','diagram_created']);
  e.run('pushUndo(); newNode("rect",20,20); undo(); redo()');e.flush();
  assert.equal(e.events.length,3);
});
test('local, file, preview y self-host no cargan ni envían telemetría',()=>{
  for(const host of ['localhost','','preview.vercel.app','mi-editor.example']){
    const e=editor(host);e.connect();e.listeners.DOMContentLoaded();
    e.run('pushUndo(); newNode("rect",0,0)');e.flush();
    assert.equal(e.scripts.length,0);assert.equal(e.events.length,0);
  }
});
test('selección, navegación, pan, zoom y no-op no son edición',()=>{
  const e=editor();e.connect();
  e.run('doc.pages.push(blankPage("Otra")); resetAnalyticsBaseline(); pushUndo(); selectAll(); viewX=100; viewZoom=2; doc.cur=1; settings.grid=false; settings.snap=true; scheduleAutosave()');
  e.flush();assert.equal(e.events.length,0);
});
test('importar/restaurar/añadir páginas no cuenta como editar; editar lo importado sí',()=>{
  const e=editor();e.connect();
  e.run('applyProjectData({doc:{pages:[{name:"privado",nodes:[{id:1,label:"secreto"}],edges:[]}]}}); appendPagesFrom({doc:{pages:[blankPage("Otra")]}}); scheduleAutosave()');
  e.flush();assert.equal(e.events.length,0);
  e.run('doc.pages[0].nodes[0].label="nuevo secreto"; scheduleAutosave()');e.flush();
  assert.deepEqual(e.names(),['first_edit_completed']);
  assert.ok(!JSON.stringify(e.events).includes('secreto'));
});
test('gestos provisionales y texto cancelado no cuentan; mover confirmado sí',()=>{
  const e=editor();e.connect();
  e.run('newNode("rect",0,0); resetAnalyticsBaseline(); drag={}; P().nodes[0].x=30; scheduleAutosave()');e.flush();
  assert.equal(e.events.length,0);
  e.run('P().nodes[0].x=0; drag=null; editing=P().nodes[0]; editing.label="provisional"; scheduleAutosave()');e.flush();
  assert.equal(e.events.length,0);
  e.run('editing.label="Nodo"; editing=null; scheduleAutosave()');e.flush();
  assert.equal(e.events.length,0);
  e.run('drag={}; P().nodes[0].x=40; scheduleAutosave()');e.flush();
  e.run('drag=null; scheduleAutosave()');e.flush();
  assert.deepEqual(e.names(),['first_edit_completed']);
});
test('estilos, páginas, conexiones, borrado y pegado son modificaciones reales',()=>{
  for(const mutation of ['doc.theme="crema"','doc.pages.push(blankPage("Nueva"))',
    'newEdge(1,2)','P().nodes[0].label="Cambio"','P().nodes=[]',
    'selectOnly("node",1); copySel(); pasteClip()']){
    const e=editor();e.connect();
    e.run('newNode("rect",0,0); newNode("rect",100,0); resetAnalyticsBaseline()');
    e.run(mutation+'; scheduleAutosave()');e.flush();
    assert.deepEqual(e.names(),['first_edit_completed'],mutation);
  }
  const e=editor();e.connect();
  e.run('clip={nodes:[{id:1,x:0,y:0}],edges:[]}; pasteClip()');e.flush();
  assert.deepEqual(e.names(),['first_edit_completed','diagram_created']);
});
test('listas cerradas y payload sin URLs, títulos, IDs ni datos libres',()=>{
  const e=editor();e.connect();
  e.run('trackEvent("desconocido",{label:"secreto"}); trackEvent("diagram_exported",{format:"privado"}); trackEvent("diagram_exported",{format:"png",filename:"secreto"})');
  assert.equal(e.events.length,1);
  assert.deepEqual(Object.keys(e.events[0].props),['format']);
  const payload=e.run('analyticsBeforeSend("event",{name:"diagram_exported",data:{format:"png",text:"secreto"},url:"https://privado/?prompt=secreto#d=secreto",referrer:"https://privado/",title:"secreto",id:"secreto"})');
  assert.ok(!JSON.stringify(payload).includes('secreto'));
  assert.equal(payload.url,'/');assert.equal(payload.referrer,'');
  assert.equal(e.run('analyticsBeforeSend("identify",{})'),false);
  assert.equal(e.run('analyticsBeforeSend("event",{name:"share_created"})').name,"share_created");
  assert.equal(e.scripts[0].dataset.autoTrack,"false");
  assert.equal(e.scripts[0].dataset.excludeSearch,'true');
  assert.equal(e.scripts[0].dataset.excludeHash,'true');
});
test('proveedor fallido no rompe editor y la cola está acotada',async()=>{
  const e=editor();e.run('for(let i=0;i<150;i++) trackEvent("present_started")');
  assert.equal(e.run('analyticsQueue.length'),100);
  e.scripts[0].onerror();assert.equal(e.run('analyticsQueue.length'),0);
  e.context.window.umami={track:()=>{throw Error('fallo');}};
  assert.doesNotThrow(()=>e.run('trackEvent("present_started")'));
  e.context.window.umami={track:()=>Promise.reject(Error('fallo asíncrono'))};
  e.run('trackEvent("present_started")');await Promise.resolve();
});
test('save y export estático cuentan al generar descarga, no al abrir modal',()=>{
  const e=editor();e.connect();e.run(fuente('export.js'));
  e.element('btnExport').onclick();assert.equal(e.events.length,0);
  e.run('saveJSON()');assert.deepEqual(e.names(),['diagram_saved']);
  e.run('exportStatic("png",1,false)');assert.equal(e.events.length,1);
  e.context.blobCallback(null);assert.equal(e.events.length,1);
  e.run('exportStatic("jpg",1,false)');e.context.blobCallback(new Blob(['imagen']));
  assert.deepEqual(e.names(),['diagram_saved','diagram_exported']);
  assert.equal(e.events[1].props.format,'jpg');
  e.run('buildSVGDocument=()=>"<svg/>"; exportSVG()');
  assert.equal(e.events[2].props.format,'svg');
  e.run('buildSVGDocument=()=>{throw Error("fallo")}');
  assert.throws(()=>e.run('exportSVG()'));assert.equal(e.events.length,3);
});
test('importación válida lleva formato/origen; inválida y demo no son edición',async()=>{
  const e=editor();e.connect();e.run(fuente('export.js'));
  const input=text=>e.element('fileIn').onchange({target:{files:[{text:()=>Promise.resolve(text)}],value:'archivo'}});
  input('{}');await Promise.resolve();assert.equal(e.events.length,0);
  input('{"doc":{"pages":[{"name":"Privado","nodes":[],"edges":[]}]}}');await Promise.resolve();e.flush();
  assert.deepEqual(e.names(),['file_imported']);assert.equal(e.events[0].props.source,'file');
  assert.equal(e.events[0].props.format,'fluyo_json');
  e.element('btnDemo').onclick();e.flush();
  assert.deepEqual(e.names(),['file_imported','example_loaded']);
});
test('GIF sólo cuenta al terminar; cancelación y error no cuentan',async()=>{
  for(const result of ['terminado','cancelado','fallo']){
    const e=editor();e.connect();e.run(fuente('export.js'));
    const handlers={};
    e.context.buildDuration=()=>0;
    e.context.GIF=class {
      addFrame(){} on(name,callback){handlers[name]=callback;}
      render(){if(result==='fallo') throw Error('codificador');} abort(){}
    };
    e.element('exFps').value=1;e.element('exDur').value=1;
    e.run('getWorker=async()=>"blob:worker"');
    const done=e.run('exportGIF(1,false)');
    await Promise.resolve();e.flush();await done;
    assert.equal(e.events.length,0);
    if(result==='cancelado') e.run('abortGIF(null)');
    if(result!=='fallo') handlers.finished(new Blob(['gif']));
    assert.deepEqual(e.names(),result==='terminado'?['diagram_exported']:[]);
    if(result==='terminado') assert.equal(e.events[0].props.format,'gif');
  }
});
test('ajustes temporales del exportador GIF no son edición',()=>{
  const e=editor();e.connect();e.run(fuente('export.js'));
  e.run('activeGif={}; settings.speed=8; scheduleAutosave()');e.flush();
  assert.equal(e.events.length,0);
  e.run('settings.speed=.5; activeGif=null; scheduleAutosave()');e.flush();
  assert.equal(e.events.length,0);
});
test('pointerup real no cuenta limpieza de rutas al seleccionar sin mover',()=>{
  const e=editor();e.connect();
  let pointerup;
  e.element('cv').addEventListener=(name,cb)=>{pointerup=cb;};
  Object.assign(e.context,{endTouchPointer:()=>false,toWorld:()=>({x:0,y:0}),
    downPt:null,podarWaypoints:edge=>{edge.waypoints=[];}});
  // Ejecutar el handler del editor con DOM simulado, no una copia de su lógica.
  const source=fuente('interaction.js');
  const start=source.indexOf('cv.addEventListener("pointerup",');
  e.run(source.slice(start,source.indexOf('\n/* El doble clic',start)));
  e.run('newNode("rect",0,0); newNode("rect",100,0); newEdge(1,2,{waypoints:[{x:0,y:0}]}); resetAnalyticsBaseline(); drag={offs:{1:{x:0,y:0}},realin:[{id:3}]};');
  pointerup({pointerType:'mouse'});e.flush();
  assert.equal(e.events.length,0);
  e.run('drag={offs:{1:{x:0,y:0}},realin:[]}; P().nodes[0].x=30;');
  pointerup({pointerType:'mouse'});e.flush();
  assert.deepEqual(e.names(),['first_edit_completed']);
});
