"use strict";
/* FLUYO-014 — Share Playback. Contrato y comportamiento del Viewer con Historia,
   sin navegador (vm + DOM falso del harness del viewer). El smoke en Chrome real
   es test/fluyo-014-browser.cjs. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeViewer,read}=require('./viewer-harness.cjs');

/* Construye un proyecto con el propio modelo compartido (model.js). */
function build(fn){
  const b=makeViewer();
  return JSON.parse(JSON.stringify(b.run(`(function(){
    doc={theme:"dark",customBg:"",eventTypes:[],nextEventTypeId:1,pages:[blankPage("Página 1")],cur:0};
    const N=(id,x,label)=>({id,shape:"rect",x,y:240,w:170,h:76,label,color:"#3aa7e8"});
    ${fn}
    return serializeProject();
  })()`)));
}
const PAGO=`
  const pg=P(); pg.nodes=[N(1,200,"Cliente"),N(2,600,"Comercio")]; pg.edges=[{id:3,from:1,to:2,label:""}]; pg.nextId=4;
  const sc=createScenario(pg,"Cliente paga a Comercio");
  const pago=createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
  const ok=createEventType({name:"Pago recibido",primitive:"OCCURRENCE",sentenceTemplate:"{target} recibe el pago",visual:{value:"✓"},
    presentation:{nodeEffects:{showSymbol:true,message:"Pago recibido",highlight:true,visualDuration:"brief"}}});
  createStep(sc,{at:0,action:"SEND",edgeId:3,eventTypeId:pago.id});
  createStep(sc,{at:2000,action:"OCCURRENCE",nodeId:2,eventTypeId:ok.id});
  createStep(sc,{at:2000,action:"OCCURRENCE",nodeId:1,eventTypeId:ok.id});`;
const KAFKA=`
  const pg=P(); pg.nodes=[N(1,100,"Producer"),N(2,400,"Kafka"),N(3,700,"Consumer")];
  pg.edges=[{id:4,from:1,to:2,label:""},{id:5,from:2,to:3,label:""}]; pg.nextId=6;
  const sc=createScenario(pg,"Mensaje perdido");
  const cae=createEventType({name:"Kafka cae",primitive:"SET_AVAILABILITY",availability:"DOWN",sentenceTemplate:"{target} cae",visual:{value:"⚠"}});
  const pub=createEventType({name:"Publicación",primitive:"FLOW",sentenceTemplate:"{source} publica en {target}",visual:{value:"📨"}});
  createStep(sc,{at:0,action:"SET_STATE",nodeId:2,state:"DOWN",eventTypeId:cae.id});
  createStep(sc,{at:1000,action:"SEND",edgeId:4,eventTypeId:pub.id});
  createStep(sc,{at:3500,action:"SEND",edgeId:5,eventTypeId:pub.id});`;
const SOLO=`const pg=P(); pg.nodes=[N(1,200,"Solo")]; pg.nextId=2;`;

async function link(project,options){
  const c=makeViewer();
  c.run(read('js/share-url.js'));
  c.context.project=project;c.context.options=options;
  c.context.location.href='https://fluyo.space/';
  return new URL(await c.run('createShareUrl(project,"https://fluyo.space/",options)')).hash;
}
async function open(project,options){
  const v=makeViewer({search:'',hash:await link(project,options)});
  v.connect();
  await v.boot();await v.waitForPhase(p=>p==='ready'||p==='error');
  return v;
}
const text=v=>['stTitle','stCaption','stSummary','stPlay','stStop','stOpen'].map(id=>v.el(id).textContent).join('\n');
const run=(v,ms=60000,step=100)=>{ for(let t=0;t<ms&&v.viewer().story==='running';t+=step){ v.advance(step); v.frames(1); } };
const JARGON=/SET_STATE|SEND|OCCURRENCE|\bUP\b|\bDOWN\b|send_failed|target_down|source_down|engineVersion|Trace|ERROR|Exception|Scenario|EventType|nodeId|edgeId/;

test('Share de historia: estado inicial humano, sin jerga técnica',async()=>{
  const v=await open(build(PAGO));
  assert.equal(v.viewer().phase,'ready');
  assert.equal(v.viewer().story,'ready');
  assert.equal(v.el('story').hidden,false);
  assert.equal(v.el('stTitle').textContent,'Cliente paga a Comercio');
  assert.equal(v.el('stPlay').textContent,'▶ Reproducir historia');
  assert.equal(v.el('stPlay').hidden,false);
  assert.equal(v.el('stPlay').disabled,false);
  assert.equal(v.el('stStop').hidden,true);
  assert.equal(v.el('stOpen').hidden,true);
  assert.doesNotMatch(text(v),JARGON);
});

test('Play → finish → Repetir → Detener; el documento nunca cambia',async()=>{
  const v=await open(build(PAGO));
  const before=JSON.stringify(v.run('serializeProject()'));
  v.el('stPlay').onclick();
  assert.equal(v.viewer().story,'running');
  v.frames(1);
  assert.equal(v.el('stStop').hidden,false);assert.equal(v.el('stPlay').hidden,true);
  assert.notEqual(v.el('stTitle').textContent,'','título del momento');
  run(v);
  assert.equal(v.viewer().story,'completed');
  assert.equal(v.el('stCaption').textContent,'Reproducción terminada');
  assert.equal(v.el('stPlay').textContent,'↻ Repetir');
  assert.equal(v.el('stOpen').hidden,false);
  assert.equal(v.el('stSummary').textContent,'');
  assert.equal(JSON.stringify(v.run('serializeProject()')),before,'Play no modifica el documento');
  v.el('stPlay').onclick();                       // Repetir
  assert.equal(v.viewer().story,'running');
  v.advance(300);v.frames(1);
  v.el('stStop').onclick();                       // Detener
  assert.equal(v.viewer().story,'ready');
  assert.equal(v.run('story'),null,'sin runtime tras detener');
  v.el('stPlay').onclick();
  const first=v.run('story.playback'); v.advance(500); v.frames(1);
  v.el('stPlay').onclick();                       // segundo Play mientras corre: no crea otro Playback
  assert.equal(v.run('story.playback'),first,'una sola reproducción');
  assert.equal(v.run('story.playback.startedAtReal'),first.startedAtReal,'no se reinicia');
  run(v);assert.equal(v.viewer().story,'completed');
  assert.equal(JSON.stringify(v.run('serializeProject()')),before);
  assert.equal(v.pendingFrames()>0,true,'sigue el único bucle del viewer');
  assert.doesNotMatch(text(v),JARGON);
});

test('Simultaneidad: dos apariciones en el mismo momento = un momento; Trace idéntico al motor',async()=>{
  const v=await open(build(PAGO));
  v.el('stPlay').onclick();
  const pb=v.run('story.playback');
  const direct=v.run('JSON.stringify(FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},P().behaviors||[],P().scenarios[0]).trace)');
  assert.equal(JSON.stringify(pb.trace),direct,'mismo Scenario → mismo Trace que el motor');
  assert.ok(pb.trace.events.filter(e=>e.at===2000).length>=2,'dos eventos en t=2000');
  const meta=Object.values(pb.stepMeta);
  assert.equal(meta.find(m=>m.name==='Pago').token,'💵');
  assert.equal(meta.find(m=>m.name==='Pago recibido').nodeEffects.visualDuration,'brief');
  v.advance(2100);v.frames(1);
  assert.ok(v.run('story.playback.activeNodeEffects.length')>=2,'efectos simultáneos activos');
  assert.equal(v.run('FluyoStory.describe("playing",story.scenario,story.playback,storyNodeName,id=>edgeById(id)).moments.length'),2);
});

test('Fallo dentro de la historia: lenguaje humano, no error',async()=>{
  const v=await open(build(KAFKA));
  v.el('stPlay').onclick();
  let seen='';
  for(let t=0;t<60000&&v.viewer().story==='running';t+=100){ v.advance(100);v.frames(1);seen+=v.el('stCaption').textContent+'|'; }
  assert.match(seen,/Kafka no está disponible/);
  assert.match(seen,/No se completó · Kafka no está disponible/);
  assert.equal(v.viewer().story,'completed');
  assert.equal(v.el('stCaption').textContent,'Reproducción terminada');
  assert.equal(v.el('stSummary').textContent,'2 eventos no pudieron realizarse');
  assert.doesNotMatch(seen+text(v),JARGON);
});

test('Sin Historia: el viewer funciona como siempre, sin crear Scenario ni error',async()=>{
  const v=await open(build(SOLO));
  assert.equal(v.viewer().phase,'ready');
  assert.equal(v.viewer().story,'none');
  assert.equal(v.el('story').hidden,true);
  v.run('storyPlay()');
  assert.equal(v.run('story'),null);
  assert.equal(v.run('doc.pages[0].scenarios.length'),0);
  v.frames(3);assert.equal(v.viewer().phase,'ready');
  const w=await open(build(SOLO+'createScenario(pg,"Vacía");')); // Scenario vacío = tampoco hay Historia
  assert.equal(w.el('story').hidden,true);assert.equal(w.viewer().story,'none');
});

test('Varios Scenarios: scenarios[0] es la Historia; el autor lo decide al compartir sin tocar su documento',async()=>{
  const multi=build(PAGO+`
    const sc2=createScenario(pg,"Segunda historia");
    createStep(sc2,{at:0,action:"SEND",edgeId:3,eventTypeId:1});`);
  const original=JSON.stringify(multi);
  assert.equal((await open(multi)).el('stTitle').textContent,'Cliente paga a Comercio');
  const second=multi.doc.pages[0].scenarios[1].id;
  const v=await open(multi,{kind:'story',scenarioId:second});
  assert.equal(v.el('stTitle').textContent,'Segunda historia');
  assert.equal(v.run('doc.pages[0].scenarios.length'),2,'la copia conserva todos los Scenarios');
  assert.equal(v.run('doc.pages[0].scenarios[0].name'),'Segunda historia');
  assert.equal(JSON.stringify(multi),original,'el documento original no se modifica');
  assert.equal(v.run('typeof storySwitch'),'undefined','el viewer no ofrece cambiar de Historia');
});

test('Compartir sólo el diagrama: sin Historias; la copia no incluye Scenarios',async()=>{
  const v=await open(build(PAGO),{kind:'diagram'});
  assert.equal(v.viewer().phase,'ready');
  assert.equal(v.el('story').hidden,true);
  assert.equal(v.run('doc.pages.every(p=>p.scenarios.length===0)'),true);
});

test('applyShareKind: puro y sin mutar la entrada',()=>{
  const c=makeViewer();c.run(read('js/share-url.js'));
  c.context.mk=()=>({doc:{cur:1,pages:[{scenarios:[{id:1},{id:2}]},{scenarios:[{id:7},{id:8},{id:9}]}]}});
  const ids=expr=>JSON.parse(JSON.stringify(c.run(expr).doc.pages.map(p=>p.scenarios.map(s=>s.id))));
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:9})'),[[1,2],[9,7,8]],'sólo la página abierta');
  assert.deepEqual(ids('applyShareKind(mk(),undefined)'),[[1,2],[7,8,9]],'sin opciones: igual');
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"story",scenarioId:99})'),[[1,2],[7,8,9]],'id desconocido: igual');
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"diagram"})'),[[],[]]);
  assert.deepEqual(ids('applyShareKind(mk(),{kind:"raro"})'),[[1,2],[7,8,9]],'kind desconocido = historia');
});

test('Navegación A → B → A: el runtime de A nunca sigue sobre B',async()=>{
  const A=await link(build(PAGO)), B=await link(build(KAFKA)), S=await link(build(SOLO));
  const v=makeViewer({search:'',hash:A});v.connect();
  await v.boot();await v.waitForPhase(p=>p==='ready');
  v.el('stPlay').onclick();v.advance(500);v.frames(2);
  assert.equal(v.viewer().story,'running');
  await v.navigate(B);await v.waitForPhase(p=>p==='ready');
  assert.equal(v.run('story'),null,'sin runtime heredado');
  assert.equal(v.viewer().story,'ready');
  assert.equal(v.el('stTitle').textContent,'Mensaje perdido');
  assert.equal(v.run('doc.pages[0].nodes.map(n=>n.label).join()'),'Producer,Kafka,Consumer');
  v.advance(5000);v.frames(3);
  assert.equal(v.viewer().story,'ready','B no avanza por el reloj de A');
  v.el('stPlay').onclick();v.advance(200);v.frames(1);
  await v.navigate(A);await v.waitForPhase(p=>p==='ready');
  assert.equal(v.run('story'),null);assert.equal(v.el('stTitle').textContent,'Cliente paga a Comercio');
  await v.navigate(S);await v.waitForPhase(p=>p==='ready');
  assert.equal(v.viewer().story,'none');assert.equal(v.el('story').hidden,true);
});

test('Play y navegación a un enlace inválido: el runtime se descarta',async()=>{
  const v=makeViewer({search:'',hash:await link(build(PAGO))});v.connect();
  await v.boot();await v.waitForPhase(p=>p==='ready');
  v.el('stPlay').onclick();v.frames(1);
  await v.navigate('#d=AAAA');await v.waitForPhase(p=>p==='error');
  assert.equal(v.run('story'),null);assert.equal(v.el('story').hidden,true);
  v.frames(5);assert.equal(v.run('story'),null);
});

test('Cambiar de página detiene la Historia (cada página tiene la suya)',async()=>{
  const two=build(PAGO+`
    const p2=blankPage("Segunda");p2.nodes=[N(1,200,"X")];p2.nextId=2;doc.pages.push(p2);`);
  const v=await open(two);
  v.el('stPlay').onclick();v.advance(300);v.frames(1);
  v.run('goPage(1)');
  assert.equal(v.run('story'),null);assert.equal(v.el('story').hidden,true);
  v.run('goPage(0)');assert.equal(v.viewer().story,'ready');
});

test('Abrir en Fluyo: copia editable completa, sin runtime, sin tocar el share',async()=>{
  const v=await open(build(PAGO));
  const before=JSON.stringify(v.run('serializeProject()'));
  v.el('stPlay').onclick();v.advance(400);v.frames(1);
  const url=await v.run('buildOpenInFluyoURL(serializeProject(), location.href, viewerPayload)');
  const copy=await v.run('decodeDeepLink('+JSON.stringify(new URL(url).hash.slice(3))+')');
  const c=JSON.parse(JSON.stringify(copy));
  assert.equal(c.doc.pages[0].scenarios[0].steps.length,3);
  assert.equal(c.doc.eventTypes.length,2);
  assert.equal(c.doc.pages[0].nodes.length,2);
  assert.ok(!/playback|trace|startedAtReal|scenarioRuntime|activeSends/.test(JSON.stringify(c)),'sin runtime');
  assert.equal(JSON.stringify(v.run('serializeProject()')),before);
});

test('Share antiguo con Scenarios (sin marcador) también se reproduce',async()=>{
  const c=makeViewer();c.context.p=build(PAGO);
  const payload=await c.run('encodeDeepLink(p)');
  const v=makeViewer({search:'',hash:'#d='+payload});v.connect();
  await v.boot();await v.waitForPhase(p=>p==='ready');
  assert.equal(v.viewer().story,'ready');
});

test('Límite de URL con Historia: demasiado grande → stage url; el diagrama sí cabe',async()=>{
  /* Contenido casi incompresible: etiquetas pseudoaleatorias deterministas. */
  const big=build(PAGO+`
    let seed=12345; const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)&0x7fffffff;return seed;};
    const bigsc=createScenario(pg,"Grande");
    for(let i=0;i<900;i++) createStep(bigsc,{at:i*10,action:"SEND",edgeId:3,eventTypeId:1});
    for(let i=0;i<100;i++) pg.nodes.push({id:100+i,shape:"rect",x:rnd()%5000,y:rnd()%5000,w:170,h:76,color:"#3aa7e8",
      label:Array.from({length:1000},()=>String.fromCharCode(33+(rnd()>>>8)%90)).join("")});
    pg.nextId=200;`);
  const c=makeViewer();c.run(read('js/share-url.js'));c.context.project=big;
  let failure=null;
  try{ await c.run('createShareUrl(project,"https://fluyo.space/",{kind:"story"})'); }catch(e){ failure=e; }
  assert.ok(failure,'la historia grande excede el límite');
  assert.equal(failure.code,'too_large');assert.equal(failure.stage,'url');
  assert.match(read('js/editor-share.js'),/demasiado grande para compartir mediante enlace\. Puedes exportarlo como archivo por ahora\./);
});

test('Privacidad: sólo share_viewed, sin propiedades, durante todo el playback',async()=>{
  const v=await open(build(PAGO));
  v.el('stPlay').onclick();run(v);v.el('stPlay').onclick();v.advance(300);v.frames(1);v.el('stStop').onclick();
  assert.deepEqual(v.names(),['share_viewed']);
  assert.ok(v.events.every(e=>e.props===undefined||Object.keys(e.props).length===0));
  const src=read('js/viewer.js')+read('js/story-playback.js');
  assert.doesNotMatch(src,/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon/);
});

test('Arquitectura: una sola receta de reproducción compartida; el viewer no carga el editor',()=>{
  const html=read('s/index.html');
  const order=['config','safe-svg','model','link-codec','geometry','render','scenario-engine','scenario-playback','story-playback','analytics','share-loader','viewer-viewport','viewer'].map(n=>html.indexOf('js/'+n+'.js'));
  assert.ok(order.every((i,k)=>i>0&&(k===0||i>order[k-1])),'orden de scripts');
  for(const f of ['editor-scenarios','present-story','state','editor-runtime','interaction','ui','export'])
    assert.ok(!html.includes('js/'+f+'.js'),f);
  const src=f=>read('js/'+f+'.js');
  assert.match(src('editor-scenarios'),/FluyoStory\.start/);
  assert.match(src('viewer'),/FluyoStory\.start/);
  assert.match(src('present-story'),/FluyoStory\.describe/);
  for(const f of ['editor-scenarios','present-story','viewer'])
    assert.doesNotMatch(src(f),/runScenario|makePlayback/,f+' no ejecuta ni construye playback por su cuenta');
  assert.doesNotMatch(src('viewer'),/setInterval|setTimeout/,'sin timers propios');
  assert.doesNotMatch(src('story-playback'),/document\.|window\.|requestAnimationFrame|setTimeout|setInterval|localStorage|Date\.now|Math\.random|performance/);
  assert.equal(src('viewer').match(/requestAnimationFrame\(/g).length,4,'bucles previos del viewer; la Historia no añade ninguno');
});

test('Service worker: assets nuevos precacheados y versión subida',()=>{
  const sw=read('sw.js');
  assert.match(sw,/fluyo-static-v59/);
  for(const f of ['story-playback','scenario-engine','scenario-playback','viewer'])
    assert.ok(sw.includes('"./js/'+f+'.js"'),f);
  const idx=read('index.html');
  assert.ok(idx.includes('js/story-playback.js'));
  assert.ok(idx.indexOf('story-playback.js')>idx.indexOf('scenario-playback.js'));
});

test('Present y Viewer comparten el texto humano (misma función)',()=>{
  const e=makeViewer();e.run(read('js/story-playback.js'));
  for(const fn of ['describe','caption','failedCount','summary','moments','currentIndex'])
    assert.equal(typeof e.run('FluyoStory.'+fn),'function',fn);
  assert.equal(e.run('FluyoPresentStory===FluyoStory'),true);
});
