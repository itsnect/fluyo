"use strict";
/* FLUYO-005 — Pruebas del viewer read-only de /s/.
   Sin dependencias ni red: node --test test/viewer.test.cjs

   Cubre los 15 criterios de la tarea: carga sin módulos del editor, render
   de fixture, estados de error, read-only state, pan, zoom, navegación,
   animación, presentación, ausencia de operaciones de edición, analytics
   (momentos semánticos y ausencia de datos sensibles) y metas de seguridad
   del shell. El viewer se ejecuta de verdad en un vm con DOM/canvas
   simulados; los frames se conducen a mano. */

const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {CompressionStream, DecompressionStream}=require('node:stream/web');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const VIEWER_SCRIPTS=[
  'js/config.js','js/model.js','js/geometry.js','js/render.js',
  'js/analytics.js','js/share-loader.js','js/viewer-viewport.js','js/viewer.js'
];
const FORBIDDEN_SCRIPTS=['state.js','editor-runtime.js','selection.js','interaction.js','ui.js','export.js','deeplink.js','examples.js','editor-analytics.js'];
const FORBIDDEN_GLOBALS=['newNode','newEdge','pushUndo','undo','redo','copySel','pasteClip','pasteSel','clearSel','setMode','scheduleAutosave','saveAutosave','clearAutosave','applyProjectData','presentIncomingDocument','exportStatic','exportSVG','exportGIF','buildSVGDocument','syncEditBoxIfMoved','buildEditorRenderState','renderEditorFrame','loadDeepLinkFromURL'];

/* ─────────────────────────── Harness ─────────────────────────── */

function makeViewer({hostname='fluyo.space', pathname='/s/demo', search='', hash=''}={}){
  const events=[], scripts=[], ops=[];
  let simTime=0;

  const ctxMock=new Proxy({},{
    get(_t, prop){
      if(prop==='measureText') return s=>({width:String(s??'').length*8});
      if(prop==='canvas') return {width:800, height:600};
      return (...args)=>{ ops.push([String(prop), ...args]); };
    },
    set(){ return true; }
  });

  const documentListeners={};
  const elements={};
  function makeElement(id){
    const listeners={};
    return {
      id, style:{}, dataset:{}, children:[],
      textContent:'', hidden:false, disabled:false,
      className:'', value:'', checked:false,
      classList:{ _s:new Set(),
        add(c){ this._s.add(c); },
        remove(c){ this._s.delete(c); },
        toggle(c,f){ f? this._s.add(c) : this._s.delete(c); },
        contains(c){ return this._s.has(c); } },
      setAttribute(){}, getAttribute(){ return null; },
      appendChild(c){ this.children.push(c); return c; },
      addEventListener(t,cb){ (listeners[t] ||= []).push(cb); },
      removeEventListener(){},
      dispatch(t,ev){ for(const cb of listeners[t]||[]) cb(ev); },
      hasListener:t=>!!listeners[t],
      getBoundingClientRect:()=>({width:800, height:600, left:0, top:0}),
      getContext:()=>ctxMock,
      setPointerCapture(){}, releasePointerCapture(){},
      width:800, height:600, onclick:null
    };
  }
  const document={
    readyState:'loading',
    getElementById:id=>elements[id] ||= makeElement(id),
    createElement:()=>makeElement(''),
    addEventListener(t,cb){ (documentListeners[t] ||= []).push(cb); },
    body:null,
    documentElement:{ requestFullscreen:()=>Promise.resolve() },
    head:{ appendChild:s=>scripts.push(s) },
    fullscreenElement:null
  };
  document.body=makeElement('body');
  elements.body=document.body;
  const location={hostname, pathname, search, hash, href:'https://fluyo.space'+pathname+search+hash};
  let rafCallbacks=[];
  const context=vm.createContext({
    console, location, document, window:{},
    performance:{ now:()=>simTime },
    requestAnimationFrame:cb=>{ rafCallbacks.push(cb); return rafCallbacks.length; },
    TextEncoder, TextDecoder, CompressionStream, DecompressionStream, atob, btoa, URL, URLSearchParams
  });
  const run=code=>vm.runInContext(code, context);
  for(const f of VIEWER_SCRIPTS) run(read(f));

  const flush=async(n=6)=>{ for(let i=0;i<n;i++) await new Promise(setImmediate); };
  const frames=n=>{ for(let i=0;i<n;i++){ const callbacks=rafCallbacks; rafCallbacks=[]; for(const cb of callbacks) cb(simTime); } };
  const advance=ms=>{ simTime+=ms; };
  const connect=()=>{ context.window.umami={track:(name,props)=>events.push({name,props})}; scripts[0]?.onload(); };
  const boot=async()=>{ for(const cb of documentListeners.DOMContentLoaded||[]) cb(); await flush(); };
  const el=id=>elements[id];
  const key=ev=>{ for(const cb of documentListeners.keydown||[]) cb(Object.assign({preventDefault(){}}, ev)); };
  const wheel=ev=>el('sv').dispatch('wheel', Object.assign({preventDefault(){}, deltaX:0, deltaY:0, ctrlKey:false, metaKey:false, clientX:400, clientY:300}, ev));

  return {context, run, events, scripts, ops, flush, frames, advance, connect, boot, el, key, wheel,
    viewer:()=>context.window.__viewer,
    names:()=>events.map(e=>e.name)};
}

/* ─────────────────────────── Tests ─────────────────────────── */

test('1. el shell del viewer sólo carga el core compartido y el viewer',()=>{
  const html=read('s/index.html');
  const srcs=[...html.matchAll(/<script src="\.\.\/(js\/[a-z-]+\.js)"/g)].map(m=>m[1]);
  assert.deepEqual(srcs, VIEWER_SCRIPTS);
  for(const f of FORBIDDEN_SCRIPTS)
    assert.ok(!html.includes('js/'+f), 'el shell referencia '+f);
});

test('10. ninguna operación de edición queda cargada en el viewer',async()=>{
  const v=makeViewer();
  for(const g of FORBIDDEN_GLOBALS)
    assert.equal(v.run(`typeof ${g}`), 'undefined', g+' no debería existir en el viewer');
  /* read-only state real: selección e interacción vacías por construcción */
  const rs=v.run('makeReadOnlyRenderState({width:800,height:600})');
  assert.equal(rs.selection.nodes.size, 0);
  assert.equal(rs.selection.edges.size, 0);
  assert.equal(rs.selection.single, null);
  assert.equal(rs.interaction.mode, 'select');
  assert.ok(v.run('typeof localStorage === "undefined"'), 'el viewer no toca persistencia');
  await v.boot();
});

test('2. fixture válido: carga, normaliza y renderiza',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  assert.equal(v.viewer().pages, 2);
  assert.ok(v.ops.length>0, 'el renderer no pintó nada');
  assert.equal(v.el('status').textContent, '');
});

test('3. documento inválido: muestra error y no renderiza',async()=>{
  const v=makeViewer();
  v.run('shareSource.fetch=async()=>({version:3,app:"fluyo"})');
  await v.boot();
  v.frames(2);
  assert.match(v.el('status').textContent, /no es un diagrama Fluyo válido/);
  assert.equal(v.ops.length, 0, 'no debería haberse renderizado nada');
  assert.equal(v.viewer().shareViewed, false);
  v.connect();
  assert.deepEqual(v.events, []);
});

test('3c. fuente no disponible: sin render ni analytics',async()=>{
  const v=makeViewer();
  v.run('shareSource.fetch=async()=>{throw new Error("fuente desconectada");}');
  await v.boot();
  v.frames(2);
  v.connect();
  assert.match(v.el('status').textContent, /No se pudo cargar el diagrama/);
  assert.equal(v.ops.length, 0);
  assert.deepEqual(v.events, []);
});

test('9b. settings.build reinicia la aparición al cambiar de diapositiva',async()=>{
  const v=makeViewer();
  v.run('shareSource.fetch=async()=>{const d=deep(SHARE_FIXTURES.demo);d.settings.build=true;d.doc.pages.forEach(p=>p.nodes.forEach((n,i)=>n.order=i));return d;}');
  await v.boot();
  v.frames(2);
  v.advance(1000);
  v.el('btnPresent').onclick();
  assert.equal(v.run('now()'), 0);
  v.advance(1000);
  v.key({key:'ArrowRight'});
  assert.equal(v.run('now()'), 0);
  assert.equal(v.viewer().cur, 1);
});

test('3b. not_found, invalid_id y unsupported_version tienen estado propio',async()=>{
  const missing=makeViewer({pathname:'/s/abcd1234abcd1234abcd22'});
  await missing.boot();
  missing.frames(2);
  assert.match(missing.el('status').textContent, /no está disponible/);
  assert.equal(missing.ops.length, 0);

  /* El loader valida IDs completos; versiones futuras llegan desde la fuente. */
  const v=makeViewer();
  await assert.rejects(v.run('loadSharedDocument("!!")'), e=>e.code==='invalid_id');
  await assert.rejects(v.run('loadSharedDocument("abcd1234abcd1234abcd12")'), e=>e.code==='not_found');
  v.run('shareSource.fetch=async()=>({version:4,app:"fluyo",doc:{pages:[{name:"x",nodes:[],edges:[]}]},settings:{}})');
  await assert.rejects(v.run('loadSharedDocument("abcd1234abcd1234abcd12")'), e=>e.code==='unsupported_version');
});

test('5. pan: rueda y arrastre de puntero desplazan la cámara',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  const before=v.viewer().view;
  v.wheel({deltaX:10, deltaY:20});
  assert.equal(v.viewer().view.x, before.x-10);
  assert.equal(v.viewer().view.y, before.y-20);
  const sv=v.el('sv');
  sv.dispatch('pointerdown', {pointerId:1, clientX:100, clientY:100});
  sv.dispatch('pointermove', {pointerId:1, clientX:150, clientY:140});
  sv.dispatch('pointerup', {pointerId:1});
  assert.equal(v.viewer().view.x, before.x+40);
  assert.equal(v.viewer().view.y, before.y+20);
});

test('6. zoom: Ctrl+rueda ancla al cursor; pinch con dos punteros',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  const z0=v.viewer().view.zoom;
  /* el punto del mundo bajo el cursor no se mueve al hacer zoom */
  const wBefore=v.run('(()=>{ const p=view; return [(400-p.x)/p.zoom,(300-p.y)/p.zoom]; })()');
  v.wheel({ctrlKey:true, deltaY:-100, clientX:400, clientY:300});
  const z1=v.viewer().view.zoom;
  assert.ok(Math.abs(z1-z0*1.1)<1e-9, 'zoom hacia el cursor');
  const wAfter=v.run('(()=>{ const p=view; return [(400-p.x)/p.zoom,(300-p.y)/p.zoom]; })()');
  assert.ok(Math.abs(wAfter[0]-wBefore[0])<1e-9 && Math.abs(wAfter[1]-wBefore[1])<1e-9,
    'el ancla del cursor se conserva');
  const sv=v.el('sv');
  const zb=v.viewer().view.zoom;
  sv.dispatch('pointerdown', {pointerId:1, clientX:100, clientY:100});
  sv.dispatch('pointerdown', {pointerId:2, clientX:200, clientY:100});
  sv.dispatch('pointermove', {pointerId:2, clientX:300, clientY:100});
  sv.dispatch('pointerup', {pointerId:2});
  sv.dispatch('pointerup', {pointerId:1});
  assert.ok(Math.abs(v.viewer().view.zoom-Math.min(5, zb*2))<1e-9, 'pinch duplica la distancia inicial');
});

test('7. navegación read-only entre páginas',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  assert.equal(v.el('pgTabs').children.length, 2);
  assert.equal(v.viewer().cur, 0);
  v.el('pgTabs').children[1].onclick();
  assert.equal(v.viewer().cur, 1);
  /* no existe añadir, cerrar ni renombrar: los tabs son botones de solo lectura */
  const html=read('js/viewer.js');
  for(const op of ['blankPage(','newNode(','newEdge(','splice(','rename'])
    assert.ok(!html.includes(op), 'el viewer no debería contener '+op);
});

test('8. animación: frames distintos producen dibujos distintos',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  const at=(t)=>{ v.ops.length=0; v.advance(t); v.frames(1); return JSON.stringify(v.ops); };
  const a=at(0);
  const b=at(400);
  assert.notEqual(a, b, 'la animación no avanza con el reloj');
  /* pausa: el reloj se congela y el dibujo se repite igual */
  v.key({key:' '});
  assert.equal(v.viewer().playing, false);
  const c=at(500);
  v.advance(300); v.ops.length=0; v.frames(1);
  const d=JSON.stringify(v.ops);
  assert.equal(c, d, 'con la animación en pausa el dibujo no cambia');
});

test('9. presentación: chrome oculto, diapositivas y restauración de vista',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  const before=v.viewer().view;
  v.el('btnPresent').onclick();
  v.frames(2);
  assert.equal(v.viewer().presenting, true);
  assert.ok(v.el('body').classList.contains('presenting'));
  assert.equal(v.el('prBar').hidden, false);
  assert.equal(v.el('prPos').textContent, '1 / 2');
  v.key({key:'ArrowRight'});
  assert.equal(v.viewer().cur, 1);
  assert.equal(v.el('prPos').textContent, '2 / 2');
  v.key({key:'Home'});
  assert.equal(v.viewer().cur, 0);
  v.el('prExit').onclick();
  v.frames(1);
  assert.equal(v.viewer().presenting, false);
  assert.deepEqual(v.viewer().view, before, 'la vista se restaura al salir');
});

test('11. share_viewed sólo tras cargar y renderizar con éxito',async()=>{
  const v=makeViewer();
  v.run('let firstRenderPhase; const originalRender=render; render=(...args)=>{firstRenderPhase??=viewerPhase;return originalRender(...args);}');
  v.run('let releaseShare; shareSource.fetch=()=>new Promise(resolve=>{releaseShare=resolve;})');
  await v.boot();
  v.connect();
  assert.deepEqual(v.names(), [], 'sin eventos antes del primer render');
  assert.equal(v.viewer().phase, 'loading');
  assert.equal(v.el('btnOpen').disabled, true);
  v.run('releaseShare(deep(SHARE_FIXTURES.demo))');
  await v.flush();
  assert.equal(v.viewer().phase, 'ready');
  assert.equal(v.run('firstRenderPhase'),'loading');
  assert.ok(v.ops.some(op=>op[0]==='fillText'), 'el primer render terminó');
  assert.deepEqual(v.names(), ['share_viewed']);
  v.frames(3);
  assert.deepEqual(v.names(), ['share_viewed'], 'una sola vez por carga');
});

test('12. share_opened_in_editor sólo por acción explícita',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  v.connect();
  assert.ok(!v.names().includes('share_opened_in_editor'));
  await v.el('btnOpen').onclick();
  await v.flush();
  assert.deepEqual(v.names().filter(n=>n==='share_opened_in_editor'), ['share_opened_in_editor']);
});

test('12b. Abrir en Fluyo produce una copia editable decodificable por el deep link',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  await v.el('btnOpen').onclick();
  await v.flush();
  const url=v.context.location.href;
  assert.match(url, /^https:\/\/fluyo\.space\/index\.html#d=[A-Za-z0-9\-_]+$/);
  /* decodificar con el mismo contrato que js/deeplink.js */
  const payload=url.split('#d=')[1];
  const bin=atob(payload.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-payload.length%4)%4));
  const bytes=Uint8Array.from(bin, c=>c.charCodeAt(0));
  assert.equal(bytes[0], 1, 'formato deflate-raw (versión 1)');
  const ds=new DecompressionStream('deflate-raw');
  const w=ds.writable.getWriter();
  w.write(bytes.subarray(1)).catch(()=>{}); w.close().catch(()=>{});
  let texto=''; const r=ds.readable.getReader();
  const dec=new TextDecoder();
  for(;;){ const {value,done}=await r.read(); if(done) break; texto+=dec.decode(value,{stream:true}); }
  const data=JSON.parse(texto);
  v.run(`documentFromProjectData(${JSON.stringify(data)})`);
  assert.equal(data.version, 3);
  assert.ok(data.doc.pages.length>=1);
});

test('13. analytics no envía IDs, URLs ni contenido del documento',async()=>{
  const v=makeViewer();
  await v.boot();
  v.frames(2);
  v.connect();
  const payload=v.run(`analyticsBeforeSend("event",{name:"share_viewed",data:{id:"secreto",url:"https://x/s/secreto"},url:"https://fluyo.space/s/secreto",referrer:"https://fluyo.space/s/secreto",title:"secreto"})`);
  assert.ok(payload, 'share_viewed debe pasar el filtro');
  assert.equal(payload.url, '/');
  assert.equal(payload.referrer, '');
  assert.equal(payload.title, 'Fluyo');
  assert.ok(!JSON.stringify(payload).includes('secreto'), 'ningún dato sensible en el payload');
  for(const e of v.events) assert.equal(JSON.stringify(e.props), '{}');
});

test('14. meta robots noindex, nofollow presente en el shell',()=>{
  const html=read('s/index.html');
  assert.ok(/<meta name="robots" content="noindex, nofollow">/.test(html));
});

test('15. Referrer-Policy explícita presente en el shell',()=>{
  const html=read('s/index.html');
  assert.ok(/<meta name="referrer" content="[^"]+">/.test(html));
});

/* Regresiones de los hallazgos independientes de QA. */
test('IDs completos y explícitos: la demo nunca es un fallback',async()=>{
  for(const [id,code] of [['demo',null],['!!','invalid_id'],['demo!','invalid_id'],['','invalid_id'],
    ['abcdefghijklmnopqrstuv','not_found'],['abc','invalid_id'],['constructor','invalid_id'],['__proto__','invalid_id']]){
    const v=makeViewer({pathname:'/s/index.html',search:'?s='+encodeURIComponent(id)});
    v.connect();
    await v.boot(); v.frames(2);
    assert.equal(v.viewer().phase,code?'error':'ready',id);
    assert.equal(v.viewer().shareViewed,!code,id);
    if(code) assert.equal(v.el('status').textContent,v.run(`SHARE_ERROR_MESSAGES[${JSON.stringify(code)}]`),id);
  }
  for(const location of [
    {pathname:'/s/index.html'}, {pathname:'/s/'},
    {pathname:'/s/index.html',hash:'#s=demo!'}, {pathname:'/s/demo!'},
    {pathname:'/s/demo%21'}, {pathname:'/s/%ZZ'}
  ]){
    const v=makeViewer(location); await v.boot();
    assert.equal(v.viewer().phase,'error',JSON.stringify(location));
    assert.equal(v.viewer().shareViewed,false);
  }
  const hash=makeViewer({pathname:'/s/',hash:'#s=demo'}); await hash.boot();
  assert.equal(hash.viewer().phase,'ready');
});

test('cur normalizado: fuera de rango, fracción y tipos no numéricos',async()=>{
  for(const [cur,expected] of [[99,1],[-1,0],[1.9,1],['1',0],[null,0],[NaN,0],[Infinity,0]]){
    const v=makeViewer();
    v.context.incomingCur=cur;
    v.run('shareSource.fetch=async()=>{const d=deep(SHARE_FIXTURES.demo);d.doc.cur=incomingCur;return d;}');
    await v.boot(); v.frames(2);
    assert.equal(v.viewer().phase,'ready');
    assert.equal(v.viewer().cur,expected);
  }
});

test('documentos históricos y actuales comparten migración con el importador',async()=>{
  const v=makeViewer();
  for(const version of [undefined,1,2,3]){
    v.context.incomingVersion=version;
    v.run('shareSource.fetch=async()=>({version:incomingVersion,app:"fluyo",state:{theme:"dark",nodes:[{id:1,label:"histórico"}],edges:[]}})');
    const loaded=await v.run('loadSharedDocument("demo")');
    const imported=v.run('projectFromProjectData({version:incomingVersion,app:"fluyo",state:{theme:"dark",nodes:[{id:1,label:"histórico"}],edges:[]}})');
    assert.equal(JSON.stringify(loaded),JSON.stringify(imported));
    assert.equal(loaded.doc.pages[0].nodes[0].shape,'rect');
    assert.equal(loaded.settings.font,v.run('DEFAULT_FONT'));
  }
  v.run('shareSource.fetch=async()=>({version:4,state:{nodes:[],edges:[]}})');
  await assert.rejects(v.run('loadSharedDocument("demo")'),e=>e.code==='unsupported_version');
  assert.throws(()=>v.run('documentFromProjectData({version:4,state:{nodes:[],edges:[]}})'),e=>e.code==='unsupported_version');
  assert.throws(()=>v.run('documentFromProjectData({version:1,state:{nodes:[],edges:{}}})'),e=>e.code==='invalid_document');
});

test('settings normalizados con defaults y límites de Fluyo, sin NaN',async()=>{
  const v=makeViewer();
  v.run('shareSource.fetch=async()=>{const d=deep(SHARE_FIXTURES.demo);d.settings={speed:100,dots:-9,stagger:Infinity,build:"sí",grid:null,snap:[],single:1,font:"desconocida"};return d;}');
  const data=await v.run('loadSharedDocument("demo")');
  assert.deepEqual(JSON.parse(JSON.stringify(data.settings)),JSON.parse(v.run('JSON.stringify({...DEFAULT_SETTINGS,speed:2,dots:1})')));
  await v.boot(); v.frames(2);
  assert.equal(v.viewer().phase,'ready');
  v.run('shareSource.fetch=async()=>{const d=deep(SHARE_FIXTURES.demo);d.settings={speed:NaN,dots:2.8,stagger:0};return d;}');
  const other=await v.run('loadSharedDocument("demo")');
  assert.equal(other.settings.speed,.5); assert.equal(other.settings.dots,3); assert.equal(other.settings.stagger,.2);
  for(const settings of ['cadena',[],7]){
    v.context.badSettings=settings;
    v.run('shareSource.fetch=async()=>{const d=deep(SHARE_FIXTURES.demo);d.settings=badSettings;return d;}');
    await assert.rejects(v.run('loadSharedDocument("demo")'),e=>e.code==='invalid_document');
  }
});

test('entradas imposibles se rechazan antes de dibujar todas las páginas',async()=>{
  for(const mutation of [
    'd.doc.theme="desconocido"', 'd.doc.pages[1].nodes[0].x=NaN',
    'd.doc.pages[1].nodes[0].w=-1', 'd.doc.pages[0].edges[0].waypoints={}',
    'd.doc.pages[1].nodes[0].label={}', 'd.doc.pages[0].edges[0].route="desconocida"',
    'd.doc.pages[1].nodes[0].id=d.doc.pages[1].nodes[1].id'
  ]){
    const v=makeViewer();
    v.run('shareSource.fetch=async()=>{const d=deep(SHARE_FIXTURES.demo);'+mutation+';return d;}');
    await v.boot(); v.frames(3); v.connect();
    assert.equal(v.viewer().phase,'error',mutation);
    assert.match(v.el('status').textContent,/no es un diagrama Fluyo válido/,mutation);
    assert.equal(v.ops.length,0,mutation);
    assert.deepEqual(v.events,[],mutation);
  }
});

test('normalización no cambia la fuente y corrige nextId compartido',async()=>{
  const v=makeViewer();
  const original=v.run('JSON.stringify(SHARE_FIXTURES.demo)');
  const loaded=await v.run('loadSharedDocument("demo")');
  assert.equal(v.run('JSON.stringify(SHARE_FIXTURES.demo)'),original);
  assert.equal(loaded.doc.pages[0].nodes[1].order,1);
  const corrected=v.run('(()=>{const d=deep(SHARE_FIXTURES.demo);d.doc.pages[0].nextId=1;return projectFromProjectData(d);})()');
  assert.equal(corrected.doc.pages[0].nextId,4);
});

test('pinch puro: separar, trasladar y combinar mantiene el ancla',()=>{
  const v=makeViewer();
  v.run('const vp={x:10,y:20,zoom:1}; const gesture=beginViewportPinch(vp,{x:100,y:100},{x:200,y:100});');
  v.run('updateViewportPinch(vp,gesture,{x:50,y:100},{x:250,y:100})');
  assert.equal(v.run('vp.zoom'),2);
  assert.equal(v.run('(150-vp.x)/vp.zoom'),140);
  assert.equal(v.run('(100-vp.y)/vp.zoom'),80);
  v.run('updateViewportPinch(vp,gesture,{x:150,y:125},{x:250,y:125})');
  assert.equal(v.run('vp.zoom'),1); assert.equal(v.run('vp.x'),60); assert.equal(v.run('vp.y'),45);
  v.run('updateViewportPinch(vp,gesture,{x:100,y:125},{x:300,y:125})');
  assert.equal(v.run('vp.zoom'),2);
  assert.equal(v.run('(200-vp.x)/vp.zoom'),140);
  assert.equal(v.run('(125-vp.y)/vp.zoom'),80);
});

test('pinch real: traslación conjunta, levantar un dedo y volver a pan',async()=>{
  const v=makeViewer(); await v.boot();
  const before=v.viewer().view, sv=v.el('sv');
  sv.dispatch('pointerdown',{pointerId:1,clientX:100,clientY:100});
  sv.dispatch('pointerdown',{pointerId:2,clientX:200,clientY:100});
  sv.dispatch('pointermove',{pointerId:1,clientX:150,clientY:120});
  sv.dispatch('pointermove',{pointerId:2,clientX:250,clientY:120});
  const after=v.viewer().view;
  assert.ok(Math.abs(after.zoom-before.zoom)<1e-9);
  assert.ok(Math.abs(after.x-before.x-50)<1e-9);
  assert.ok(Math.abs(after.y-before.y-20)<1e-9);
  sv.dispatch('pointerup',{pointerId:2});
  sv.dispatch('pointermove',{pointerId:1,clientX:160,clientY:130});
  assert.ok(Math.abs(v.viewer().view.x-after.x-10)<1e-9);
  assert.ok(Math.abs(v.viewer().view.y-after.y-10)<1e-9);
  assert.equal(v.viewer().view.zoom,after.zoom);
  sv.dispatch('pointercancel',{pointerId:1});
  const released=v.viewer().view;
  sv.dispatch('pointermove',{pointerId:1,clientX:500,clientY:500});
  assert.deepEqual(v.viewer().view,released);
});

test('fallo del primer render: error terminal, lienzo limpio y cero analytics',async()=>{
  const v=makeViewer();
  v.run('let renderAttempts=0; render=()=>{renderAttempts++;sctx.fillRect(1,2,3,4);throw new Error("fallo de render");}');
  v.connect(); await v.boot(); v.frames(5);
  assert.equal(v.viewer().phase,'error'); assert.equal(v.viewer().shareViewed,false);
  assert.equal(v.run('renderAttempts'),1);
  assert.deepEqual(v.events,[]);
  assert.equal(v.el('btnOpen').disabled,true);
  assert.equal(v.el('pgTabs').hidden,true);
  assert.equal(v.ops.at(-1)[0],'clearRect');
  assert.match(v.el('status').textContent,/no es un diagrama Fluyo válido/);
});

test('fallo preparando bounds y fallo posterior no dejan RAF en bucle',async()=>{
  const prep=makeViewer();
  prep.run('getBounds=()=>{throw new Error("bounds");}');
  await prep.boot(); prep.frames(5); prep.connect();
  assert.equal(prep.viewer().phase,'error'); assert.equal(prep.ops.length,0); assert.deepEqual(prep.events,[]);
  const v=makeViewer(); await v.boot(); v.connect();
  v.run('let laterAttempts=0; render=()=>{laterAttempts++;throw new Error("fallo posterior");}');
  v.frames(5);
  assert.equal(v.viewer().phase,'error'); assert.equal(v.run('laterAttempts'),1);
  assert.deepEqual(v.names(),['share_viewed']);
  assert.equal(v.el('btnPresent').disabled,true);
});
