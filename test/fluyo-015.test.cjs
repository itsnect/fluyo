"use strict";
/* FLUYO-015 — Lenguaje visual de eventos en movimiento (presentación pura).
   Modelo, pintor compartido, Playback y, sobre todo, «Trace antes = Trace después».
   El flujo real (modal, preview, Present, Viewer, responsive) vive en test/fluyo-015-browser.cjs. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makeCtx({reduced=false}={}){
  const ctx={console,performance:{now:()=>0},Math,JSON};
  ctx.window=ctx;
  ctx.matchMedia=q=>({matches:reduced&&/reduce/.test(q)});
  vm.createContext(ctx);
  for(const f of ['config','model','geometry','scenario-engine','scenario-playback','story-playback','render'])
    vm.runInContext(read('js/'+f+'.js'),ctx,{filename:f});
  ctx.run=src=>vm.runInContext(src,ctx);
  return ctx;
}
const J=v=>JSON.parse(JSON.stringify(v));

/* Canvas simulado: registra llamadas relevantes sin pintar. */
function mockCanvas(){
  const log={fillText:[],strokes:0,arcs:0,gradients:0,alphas:[],lines:0};
  let alpha=1,font="";
  const stack=[];
  const c={
    save(){stack.push({alpha,font});},restore(){const s=stack.pop();if(s){alpha=s.alpha;font=s.font;}},
    beginPath(){},moveTo(){},lineTo(){log.lines++;},arc(){log.arcs++;},fill(){},
    stroke(){log.strokes++;log.alphas.push(alpha);},
    fillText(t,x,y){log.fillText.push({t,x,y,font,alpha});},
    createRadialGradient(){log.gradients++;return {addColorStop(){}};},
    set globalAlpha(v){alpha=v;},get globalAlpha(){return alpha;},
    set font(v){font=v;},get font(){return font;},
    fillStyle:"",strokeStyle:"",lineWidth:1,lineCap:"",textAlign:"",textBaseline:"",shadowColor:"",shadowBlur:0
  };
  return {c,log};
}
const PTS=[{x:0,y:0},{x:400,y:0}];
const T={text:"#fff",edge:"#777"};
function token(ctx,connection,progress,extra={}){
  const m=mockCanvas();
  ctx.m=m;ctx.pts=PTS;ctx.T=T;
  ctx.send=Object.assign({progress,duration:1100,token:"💵",connection,terminalType:null},extra);
  ctx.run('drawEventToken(m.c,pts,send,T)');
  return m.log;
}
function arrival(ctx,connection,age,extra={}){
  const m=mockCanvas();
  ctx.m=m;ctx.pts=PTS;ctx.T=T;
  ctx.done=Object.assign({ageMs:age,cueMs:700,token:"💵",connection,terminalType:"send_succeeded"},extra);
  ctx.run('drawEventArrival(m.c,pts,done,T)');
  return m.log;
}
const spec=(ctx,fx)=>ctx.run('('+JSON.stringify(fx)+')')&&J(ctx.run(`connectionVisualSpec({visual:{value:"💵"},presentation:{connectionEffects:${JSON.stringify(fx)}}})`));
const px=font=>Number(/(\d+(?:\.\d+)?)px/.exec(font)[1]);

/* ───────────────────────── Modelo ───────────────────────── */
test('defaults: sin presentación → mediano, directo, sin rastro, sin llegada, sin efecto',()=>{
  const ctx=makeCtx();
  assert.deepEqual(J(ctx.run('defaultConnectionEffects()')),{size:'medium',style:'direct',trail:'none',arrival:'none',during:'none'});
  const s=J(ctx.run('connectionVisualSpec({visual:{value:"💵"}})'));
  assert.equal(s.px,20,'mismo tamaño que antes de FLUYO-015');
  assert.equal(s.symbol,'💵');
  assert.equal(J(ctx.run('defaultNodeEffects()')).symbolSize,'medium');
});
test('normalización campo a campo: lo inválido vuelve al defecto, lo válido se conserva',()=>{
  const ctx=makeCtx();
  const n=fx=>J(ctx.run(`normalizeConnectionEffects(${JSON.stringify(fx)})`));
  assert.deepEqual(n({size:'large',style:'impulse',trail:'marked',arrival:'bounce',during:'breathe'}),{size:'large',style:'impulse',trail:'marked',arrival:'bounce',during:'breathe'});
  assert.deepEqual(n({size:'huge',style:'zigzag',trail:7,arrival:null,during:{}}),{size:'medium',style:'direct',trail:'none',arrival:'none',during:'none'});
  assert.deepEqual(n({size:'small',trail:'nope'}),{size:'small',style:'direct',trail:'none',arrival:'none',during:'none'});
  for(const bad of [null,undefined,42,'x',[],true]) assert.deepEqual(n(bad),{size:'medium',style:'direct',trail:'none',arrival:'none',during:'none'});
  assert.equal(J(ctx.run('normalizeNodeEffects({showSymbol:true,symbolSize:"large"})')).symbolSize,'large');
  assert.equal(J(ctx.run('normalizeNodeEffects({symbolSize:"x"})')).symbolSize,'medium');
});
test('persistencia: create/update/serialize/roundtrip conservan connectionEffects (y symbolSize)',()=>{
  const ctx=makeCtx();
  const et=J(ctx.run(`createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"},presentation:{connectionEffects:{size:"large",trail:"subtle",arrival:"pulse",style:"smooth"}}})`));
  assert.equal(et.presentation.connectionEffects.size,'large');
  assert.equal(et.presentation.connectionEffects.during,'none','faltantes se rellenan');
  ctx.run(`updateEventType(${et.id},{presentation:{connectionEffects:{style:"impulse",arrival:"glow"}}})`);
  assert.deepEqual(J(ctx.run(`eventTypeById(${et.id}).presentation.connectionEffects`)),{size:'medium',style:'impulse',trail:'none',arrival:'glow',during:'none'});
  const el=J(ctx.run(`createEventType({name:"Nota",primitive:"OCCURRENCE",sentenceTemplate:"{target} nota",visual:{value:"⭐"},presentation:{nodeEffects:{showSymbol:true,symbolSize:"large"}}})`));
  assert.equal(el.presentation.nodeEffects.symbolSize,'large');
  const proj=ctx.run('JSON.stringify(serializeProject())');
  assert.equal(JSON.parse(proj).version,5,'sin bump de schema');
  const ctx2=makeCtx();
  const d=JSON.parse(proj).doc; ctx2.d=d; ctx2.run('normalizeEventTypes(d)');
  assert.deepEqual(J(ctx2.d.eventTypes),J(ctx.run('doc.eventTypes')),'roundtrip estable');
});
test('un EventType antiguo sin los campos nuevos sigue siendo válido y se reproduce como antes',()=>{
  const ctx=makeCtx();
  const legacy={id:1,name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{kind:"token",value:"💵"},motion:"normal"};
  ctx.d={eventTypes:[legacy],nextEventTypeId:2};
  ctx.run('normalizeEventTypes(d); doc.eventTypes=d.eventTypes;');
  assert.equal(ctx.d.eventTypes[0].presentation,undefined,'no se inventa presentación al cargar');
  const meta=J(ctx.run('FluyoStory.stepMeta([{id:1,eventTypeId:1}])'));
  assert.equal(meta[1].connection.px,20);assert.equal(meta[1].connection.trail,'none');
  const log=token(ctx,meta[1].connection,0.5);
  assert.equal(log.strokes,0,'sin rastro');assert.equal(log.fillText.length,1);
  assert.equal(log.fillText[0].font,'bold 20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Georgia, serif','misma fuente que antes');
  // Legacy: también sin metadata de conexión en absoluto (documentos/tests antiguos)
  const log2=token(ctx,undefined,0.5);
  assert.equal(px(log2.fillText[0].font),20);
  assert.equal(arrival(ctx,undefined,100).fillText.length,0,'sin efecto de llegada propio');
});
test('un presentation sin connectionEffects no se rellena en documentos antiguos', ()=>{
  const ctx=makeCtx();
  ctx.d={eventTypes:[{id:1,name:"Aviso",primitive:"OCCURRENCE",sentenceTemplate:"{target} avisa",visual:{kind:"token",value:"⚠"},presentation:{nodeEffects:{showSymbol:true}}}],nextEventTypeId:2};
  ctx.run('normalizeEventTypes(d)');
  assert.equal(ctx.d.eventTypes[0].presentation.connectionEffects,undefined);
  assert.equal(ctx.d.eventTypes[0].presentation.nodeEffects.symbolSize,'medium');
});

/* ───────────────────────── Pintor / Playback ───────────────────────── */
test('tamaño: pequeño/mediano/grande → 15/20/28 px, con la misma función de pintura',()=>{
  const ctx=makeCtx();
  const sizes=['small','medium','large'].map(size=>px(token(ctx,spec(ctx,{size}),0.5).fillText[0].font));
  assert.deepEqual(sizes,[15,20,28]);
});
test('forma de moverse: mismos extremos, recorridos distintos y monótonos',()=>{
  const ctx=makeCtx();
  const e=(st,t)=>ctx.run(`flowEase(${JSON.stringify(st)},${t})`);
  for(const st of ['direct','smooth','impulse']){ assert.equal(e(st,0),0); assert.equal(e(st,1),1); let prev=-1; for(let t=0;t<=1.0001;t+=0.05){ const v=e(st,t); assert.ok(v>=prev-1e-9,st+' monótono'); prev=v; } }
  assert.equal(e('direct',0.25),0.25);
  assert.ok(Math.abs(e('smooth',0.25)-e('direct',0.25))>0.05,'Suave se nota');
  assert.ok(Math.abs(e('impulse',0.25)-e('smooth',0.25))>0.04,'Impulso se distingue de Suave');
  assert.ok(e('impulse',0.5)===0.5,'simétrico: acelera y frena');
  assert.equal(e('zigzag',0.3),0.3,'estilo desconocido = directo');
  assert.equal(e('smooth',-1),0);assert.equal(e('smooth',9),1);
  // la x del símbolo cambia según la forma, con el mismo progress
  const x=st=>token(ctx,spec(ctx,{style:st}),0.25).fillText[0].x;
  assert.equal(x('direct'),100);assert.ok(x('smooth')<100&&x('impulse')<x('smooth'));
});
test('rastro: sin rastro no dibuja trazos; sutil traza; marcado traza más y deja ecos del símbolo',()=>{
  const ctx=makeCtx();
  const none=token(ctx,spec(ctx,{trail:'none'}),0.6),sub=token(ctx,spec(ctx,{trail:'subtle'}),0.6),mar=token(ctx,spec(ctx,{trail:'marked'}),0.6);
  assert.equal(none.strokes,0);assert.ok(sub.strokes>0);assert.ok(mar.strokes>=sub.strokes);
  assert.equal(none.fillText.length,1);assert.equal(sub.fillText.length,1,'sutil: sólo línea');assert.ok(mar.fillText.length>1,'marcado: ecos');
  assert.ok(Math.max(...mar.alphas)>Math.max(...sub.alphas),'marcado más visible');
  // Al inicio no hay rastro (aún no ha recorrido nada)
  assert.equal(token(ctx,spec(ctx,{trail:'marked'}),0).strokes,0);
  // Funciona con cualquier símbolo (no sabe qué representa)
  for(const t of ['✈️','🚚','⚡','Ω','ABC']){ ctx.T=T;ctx.m=mockCanvas();ctx.pts=PTS; ctx.send={progress:.6,duration:1100,token:t,connection:spec(ctx,{trail:'marked'})}; ctx.run('drawEventToken(m.c,pts,send,T)'); assert.ok(ctx.m.log.strokes>0&&ctx.m.log.fillText.every(f=>f.t===t)); }
});
test('durante el movimiento: halo añade resplandor; respirar escala el símbolo en el tiempo',()=>{
  const ctx=makeCtx();
  assert.equal(token(ctx,spec(ctx,{during:'none'}),0.5).gradients,0);
  assert.equal(token(ctx,spec(ctx,{during:'halo'}),0.5).gradients,1);
  const sizes=[0.1,0.25,0.4,0.6].map(p=>px(token(ctx,spec(ctx,{during:'breathe'}),p).fillText[0].font));
  assert.ok(new Set(sizes).size>1,'el tamaño oscila');
  assert.ok(sizes.every(s=>s>=17&&s<=23),'sin exagerar (±10 %)');
});
test('al llegar: Nada no pinta; Pulso/Brillo/Rebote sí; fallido o sin símbolo nunca',()=>{
  const ctx=makeCtx();
  assert.equal(arrival(ctx,spec(ctx,{arrival:'none'}),100).fillText.length,0);
  const pulse=arrival(ctx,spec(ctx,{arrival:'pulse'}),100),glow=arrival(ctx,spec(ctx,{arrival:'glow'}),100);
  assert.ok(pulse.strokes>0&&pulse.fillText.length===1);assert.ok(glow.gradients===1&&glow.fillText.length===1);
  const y=age=>arrival(ctx,spec(ctx,{arrival:'bounce'}),age).fillText[0].y;
  assert.ok(new Set([100,250,400,550].map(y)).size>1,'rebota');assert.ok(Math.abs(y(100))<=20,'rebote contenido');
  assert.equal(arrival(ctx,spec(ctx,{arrival:'pulse'}),100,{terminalType:'send_failed'}).fillText.length,0,'un fallo no se celebra');
  assert.equal(arrival(ctx,spec(ctx,{arrival:'pulse'}),100,{token:''}).fillText.length,0);
  assert.equal(arrival(ctx,spec(ctx,{arrival:'pulse'}),700).fillText.length,0,'termina dentro de la ventana de 700 ms');
});
test('composición: tamaño + forma + rastro + durante + llegada a la vez, sin lanzar',()=>{
  const ctx=makeCtx();
  const fx={size:'large',style:'impulse',trail:'marked',arrival:'bounce',during:'breathe'};
  const sp=spec(ctx,fx);
  for(let p=0;p<=1.0001;p+=0.1) token(ctx,sp,Math.min(1,p));
  const l=token(ctx,sp,0.7);assert.ok(l.strokes>0&&l.fillText.length>1);
  for(let a=0;a<700;a+=50) arrival(ctx,sp,a);
});
test('reducir movimiento: sin rebote ni respiración; el resto sigue legible',()=>{
  const ctx=makeCtx({reduced:true});
  const y=age=>arrival(ctx,spec(ctx,{arrival:'bounce'}),age).fillText[0].y;
  assert.equal(new Set([100,250,400].map(y)).size,1,'sin desplazamiento vertical');
  const s=[0.1,0.3,0.6].map(p=>px(token(ctx,spec(ctx,{during:'breathe'}),p).fillText[0].font));
  assert.equal(new Set(s).size,1);
});
test('Playback: la metadata viaja por Step y llega a envíos activos y completados',()=>{
  const ctx=makeCtx();
  ctx.run(`createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"},presentation:{connectionEffects:{size:"large",trail:"marked",arrival:"pulse"}}});
    P().nodes=[{id:1,x:0,y:0,w:80,h:40,label:"A"},{id:2,x:400,y:0,w:80,h:40,label:"B"}];P().edges=[{id:3,from:1,to:2}];
    sc=createScenario(P(),"s"); createStep(sc,{at:0,action:"SEND",edgeId:3,eventTypeId:1});`);
  const r=ctx.run('FluyoStory.start(P(),sc,0)');assert.ok(r.ok);
  ctx.pb=r.playback;
  const mid=J(ctx.run('FluyoScenarioPlayback.tick(pb,500)'));
  assert.equal(mid.activeSends[0].connection.trail,'marked');assert.equal(mid.activeSends[0].connection.px,28);
  const done=J(ctx.run('FluyoScenarioPlayback.tick(pb,1300)'));
  assert.equal(done.completedSends[0].connection.arrival,'pulse');
  assert.equal(done.completedSends[0].terminalType,'send_succeeded');
});

/* ───────────────────────── Engine / Trace ───────────────────────── */
function runWith(visual){
  const ctx=makeCtx();
  ctx.v=visual;
  ctx.run(`createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:v.symbol},motion:v.motion,presentation:v.presentation});
    createEventType({name:"Aviso",primitive:"OCCURRENCE",sentenceTemplate:"{target} avisa",visual:{value:"✓"},presentation:{nodeEffects:{showSymbol:true,symbolSize:v.nodeSize}}});
    P().nodes=[{id:1,x:0,y:0,w:80,h:40,label:"A"},{id:2,x:400,y:0,w:80,h:40,label:"B"}];P().edges=[{id:3,from:1,to:2}];
    sc=createScenario(P(),"s");
    createStep(sc,{at:0,action:"SEND",edgeId:3,eventTypeId:1});
    createStep(sc,{at:1500,action:"SET_STATE",nodeId:2,state:"DOWN"});
    createStep(sc,{at:2000,action:"SEND",edgeId:3,eventTypeId:1});
    createStep(sc,{at:2500,action:"OCCURRENCE",nodeId:2,eventTypeId:2});`);
  const trace=ctx.run('JSON.stringify(FluyoScenarios.runScenario({nodes:P().nodes,edges:P().edges},P().behaviors||[],sc).trace)');
  const r=ctx.run('FluyoStory.start(P(),sc,0)');ctx.pb=r.playback;
  const frames=[];
  for(let t=0;t<=6000;t+=100){ctx.t=t;const f=J(ctx.run('FluyoScenarioPlayback.tick(pb,t)'));frames.push({t,virtual:f.virtualTime,log:f.logEvents.length,finished:f.finished,sends:f.activeSends.length+f.completedSends.length});}
  return {trace,playbackTrace:JSON.stringify(r.playback.trace),frames};
}
const A={symbol:'💵',motion:'normal',nodeSize:'medium',presentation:{}};
const B={symbol:'✈️',motion:'normal',nodeSize:'large',presentation:{connectionEffects:{size:'large',style:'impulse',trail:'marked',arrival:'bounce',during:'breathe'}}};
const C={symbol:'⚡',motion:'normal',nodeSize:'small',presentation:{connectionEffects:{size:'small',style:'smooth',trail:'subtle',arrival:'glow',during:'halo'}}};
test('Trace antes = Trace después: visual A, B y C producen exactamente el mismo Trace',()=>{
  const a=runWith(A),b=runWith(B),c=runWith(C);
  assert.ok(a.trace.length>50);
  assert.equal(b.trace,a.trace);assert.equal(c.trace,a.trace);
  assert.equal(b.playbackTrace,a.trace,'el Trace del Playback es el del motor');
});
test('presentación pura: la línea de tiempo del Playback (fin, eventos, envíos) no depende del visual',()=>{
  const a=runWith(A),b=runWith(B),c=runWith(C);
  assert.deepEqual(b.frames,a.frames);assert.deepEqual(c.frames,a.frames);
  assert.ok(a.frames.some(f=>f.finished),'termina');
});
test('el motor y el playback no conocen los parámetros visuales',()=>{
  const eng=read('js/scenario-engine.js');
  for(const w of ['trail','arrival','symbolSize','connectionEffects','during','impulse','style','size'])
    assert.ok(!new RegExp('\\b'+w+'\\b').test(eng.replace(/\/\*[\s\S]*?\*\//g,'')),'scenario-engine.js no menciona '+w);
  const pbSrc=read('js/scenario-playback.js');
  assert.ok(!/flowEase|FLOW_TRAIL|trail|arrival\b/.test(pbSrc),'playback sólo transporta el objeto, no lo interpreta');
});

/* ───────────────────────── Sin estado ni timers ───────────────────────── */
test('el pintor es puro: no muta sus entradas ni deja estado entre cuadros',()=>{
  const ctx=makeCtx();
  const sp=spec(ctx,{size:'large',trail:'marked',arrival:'pulse',during:'breathe',style:'impulse'});
  const frozen=J(sp);
  token(ctx,sp,0.5);arrival(ctx,sp,200);
  assert.deepEqual(sp,frozen);
  assert.equal(JSON.stringify(token(ctx,sp,0.5)),JSON.stringify(token(ctx,sp,0.5)),'mismo cuadro, mismo dibujo');
});
test('sin timers, intervalos, RAF ni listeners en el pintor compartido',()=>{
  const src=read('js/render.js');
  const a=src.indexOf('/* ===== FLUYO-015'),b=src.indexOf('function drawEdge(');
  const block=src.slice(a,b);
  assert.ok(block.length>2000);
  assert.doesNotMatch(block,/setTimeout|setInterval|requestAnimationFrame|addEventListener|Date\.now|performance\.now/);
  assert.doesNotMatch(read('js/scenario-playback.js'),/setTimeout|setInterval|requestAnimationFrame/);
});
test('un solo RAF de preview, cancelado al cerrar el modal',()=>{
  const src=read('js/editor-scenarios.js');
  assert.equal((src.match(/scPreviewRaf = requestAnimationFrame/g)||[]).length,2,'sólo scPreviewFrame/scPreviewKick programan');
  assert.match(src,/function scCloseEventDialog\(\) \{[^}]*scPreviewStop\(\);/s);
  assert.match(src,/function scPreviewStop\(\) \{[\s\S]*?cancelAnimationFrame\(scPreviewRaf\)/);
  assert.match(src,/drawFlowOverlay\(c, pts, \[\{ \.\.\.base, progress: t \/ dur \}\], \[\], T\)/,'el preview dibuja el viaje con el pintor de Playback');
  assert.match(src,/drawFlowOverlay\(c, pts, \[\], \[\{ \.\.\.base, ageMs/,'y la llegada también');
  assert.doesNotMatch(src,/scTravel|animation-duration/,'sin animación CSS paralela para conexiones');
});

/* ───────────────────────── UI estática ───────────────────────── */
test('UI: lenguaje humano, sin <select> y con los controles esperados',()=>{
  const html=read('index.html');
  const a=html.indexOf('id="scFlowLook"'),b=html.indexOf('id="scAppearance"');
  const block=html.slice(a,b);
  assert.ok(block.length>500);
  assert.doesNotMatch(block,/<select/i);
  assert.doesNotMatch(block,/easing|duration|velocity|trail length|opacity|interpolation|acceleration|renderer|primitive|\bpx\b/i);
  for(const t of ['Pequeño','Mediano','Grande','Directo','Suave','Impulso','Sin rastro','Rastro sutil','Rastro marcado','Pulso','Brillo','Rebote','Respirar','Halo','Rápido','Lento'])
    assert.ok(block.includes('>'+t+'<')||block.includes('</i>'+t+'<')||block.includes('</svg>'+t+'<'),'falta '+t);
  assert.match(block,/¿Qué tan rápido\?/);
  assert.match(html,/name="scSymbolSize"/);
  assert.equal((html.match(/id="scVisualPicker"/g)||[]).length,1,'un solo selector de símbolo');
});
test('Share/Viewer: sin archivos nuevos; el snapshot ya transporta presentation',()=>{
  const html=read('s/index.html');
  assert.doesNotMatch(html,/connection-effects|flow-style/);
  assert.match(read('sw.js'),/fluyo-static-v68/);
});

/* ───────────────────────── QA adversarial (FLUYO-015) ───────────────────────── */
test('el símbolo sale SIEMPRE de EventType.visual.value (ningún símbolo especial ni fijo)',()=>{
  const ctx=makeCtx();
  for(const sym of ['✈️','🚚','⚡','👤','Ω','●']){
    const sp=J(ctx.run(`connectionVisualSpec({visual:{value:${JSON.stringify(sym)}}})`));
    assert.equal(sp.symbol,sym);
  }
  ctx.run(`createEventType({name:"Vuelo",primitive:"FLOW",sentenceTemplate:"{source} vuela a {target}",visual:{value:"✈️"}})`);
  assert.equal(J(ctx.run('FluyoStory.stepMeta([{id:1,eventTypeId:1}])'))[1].connection.symbol,'✈️');
  // sin lógica por símbolo en el código de presentación
  const code=read('js/render.js')+read('js/model.js')+read('js/story-playback.js')+read('js/scenario-playback.js');
  assert.doesNotMatch(code,/(token|symbol|value)\s*(===|==|!==)\s*["'`](✈|🚚|💵|📦|⚡|👤)/u);
});
test('cambiar de documento detiene el Playback (applyProjectData)',()=>{
  const src=read('js/state.js');
  const f=/function applyProjectData\(d\)\{[\s\S]*?runWithoutAutosave/.exec(src)[0];
  assert.match(f,/isScenarioPlaybackActive\(\)[\s\S]*scReset\(\)/);
});
test('el Trace no depende del orden ni del número de efectos visuales (barrido de combinaciones)',()=>{
  const base=runWith(A).trace;
  for(const size of ['small','medium','large']) for(const style of ['direct','smooth','impulse']) for(const trail of ['none','subtle','marked']) for(const arrival of ['none','pulse','glow','bounce'])
    assert.equal(runWith({symbol:'💵',motion:'normal',nodeSize:size,presentation:{connectionEffects:{size,style,trail,arrival,during:'halo'}}}).trace,base,[size,style,trail,arrival].join('/'));
});
