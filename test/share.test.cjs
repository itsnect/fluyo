"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomBytes}=require('node:crypto');
const {makeViewer}=require('./viewer-harness.cjs');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
function creator(protocol='https:'){
  const v=makeViewer();
  v.context.location.protocol=protocol;
  v.context.location.href=protocol==='file:'? 'file:///fluyo/index.html' : 'https://fluyo.space/';
  v.context.navigator={};
  v.run(read('js/share-url.js'));
  v.run('function commitEditBox(){}');
  for(const id of ['btnShare','shareDialog','shareConfirm','shareResult','shareCopy','shareCreate','shareClose','shareLink','shareMessage'])
    v.context.document.getElementById(id);
  const dialog=v.el('shareDialog');
  dialog.showModal=function(){this.open=true;};
  dialog.close=function(){this.open=false;};
  for(const id of ['shareCopy','shareLink']){
    v.el(id).focus=()=>{};
    v.el(id).select=()=>{v.el(id).selected=true;};
  }
  v.run(read('js/editor-share.js'));
  v.connect();
  return v;
}
test('Share: confirmación, roundtrip canónico, snapshot inmutable y origen local',async()=>{
  const c=creator();
  c.run('doc=deep(SHARE_FIXTURES.demo.doc);settings=deep(SHARE_FIXTURES.demo.settings)');
  const original=c.run('JSON.stringify(serializeProject())');
  c.el('btnShare').onclick();
  assert.equal(c.names().includes('share_created'),false);
  assert.equal(c.el('shareLink').value,'');
  await c.el('shareCreate').onclick();
  const url=c.el('shareLink').value;
  assert.match(url,/^https:\/\/fluyo\.space\/s\/#d=[A-Za-z0-9_-]+$/);
  assert.equal(c.run('JSON.stringify(serializeProject())'),original);
  assert.deepEqual(c.names().filter(n=>n==='share_created'),['share_created']);
  await c.el('shareCreate').onclick();
  assert.equal(c.names().filter(n=>n==='share_created').length,1);
  c.run('doc.pages[0].nodes[0].label="Documento B"');
  const payload=new URL(url).hash.slice(3);
  const viewer=makeViewer({search:'?s=demo',hash:'#d='+payload});
  await viewer.boot();
  await viewer.waitForPhase(p=>p==='ready'||p==='error');
  assert.equal(viewer.viewer().phase,'ready');
  assert.equal(viewer.run('doc.pages[0].nodes[0].label'),'Servicio');
  assert.equal(viewer.run('typeof localStorage'),'undefined');
  viewer.run('doc.cur=1');
  await viewer.el('btnOpen').onclick();
  assert.equal(viewer.context.location.href,'https://fluyo.space/#d='+payload);
  assert.equal(c.run('buildShareUrl("http://localhost:8080/index.html",'+JSON.stringify(payload)+')'),'http://localhost:8080/s/#d='+payload);
});
test('Share: límite inclusivo aplicado a la URL final y rechazo real por tamaño',async()=>{
  const c=creator();
  const prefix='https://fluyo.space/s/#d=';
  assert.equal(c.run(`buildShareUrl('https://fluyo.space/', 'A'.repeat(65536-${prefix.length}))`).length,65536);
  assert.throws(()=>c.run(`buildShareUrl('https://fluyo.space/', 'A'.repeat(65537-${prefix.length}))`),e=>e.code==='too_large');
  c.context.largeLabel=randomBytes(80000).toString('base64');
  c.run('doc=deep(SHARE_FIXTURES.demo.doc);doc.pages[0].nodes[0].label=largeLabel');
  c.el('btnShare').onclick();
  await c.el('shareCreate').onclick();
  assert.match(c.el('shareMessage').textContent,/demasiado grande.*exportarlo/);
  assert.equal(c.el('shareLink').value,'');
  assert.ok(!c.names().includes('share_created'));
});
test('Share: file:// sólo informa que se requiere la web',async()=>{
  const c=creator('file:');
  c.el('btnShare').onclick();
  assert.match(c.el('shareMessage').textContent,/versión web/);
  assert.equal(c.el('shareCreate').disabled,true);
  await c.el('shareCreate').onclick();
  assert.equal(c.el('shareLink').value,'');
  await assert.rejects(c.run('createShareUrl(serializeProject(),location.href)'),e=>e.code==='web_required');
  assert.ok(!c.names().includes('share_created'));
});
test('Share: clipboard sólo confirma éxito real y conserva copia manual',async()=>{
  const c=creator();c.el('btnShare').onclick();await c.el('shareCreate').onclick();
  const url=c.el('shareLink').value;
  await c.el('shareCopy').onclick();
  assert.equal(c.el('shareLink').selected,true);
  assert.match(c.el('shareMessage').textContent,/manualmente/);
  c.context.navigator.clipboard={writeText:async()=>{throw Error('denied');}};
  await c.el('shareCopy').onclick();
  assert.match(c.el('shareMessage').textContent,/manualmente/);
  c.context.navigator.clipboard={writeText:async text=>assert.equal(text,url)};
  await c.el('shareCopy').onclick();
  assert.equal(c.el('shareMessage').textContent,'Enlace copiado.');
  assert.equal(c.el('shareLink').value,url);
});
test('Viewer: fragmento inválido, truncado y duplicado nunca caen a demo',async()=>{
  const c=creator();
  c.run('doc=deep(SHARE_FIXTURES.demo.doc)');
  const payload=await c.run('encodeDeepLink(serializeProject())');
  for(const hash of ['#d=','#d=invalid','#d=AA!','#d='+payload.slice(0,-8),'#d='+payload+'&d='+payload]){
    const v=makeViewer({search:'?s=demo',hash});v.connect();await v.boot();
    await v.waitForPhase(p=>p==='ready'||p==='error');
    assert.equal(v.viewer().phase,'error',hash.slice(0,20));
    assert.equal(v.el('btnOpen').disabled,true);
    assert.equal(v.el('btnPresent').disabled,true);
    assert.deepEqual(v.names(),[]);
  }
});
test('Viewer: normaliza antes de render; primer render fallido no habilita nada',async()=>{
  const c=creator();
  const payload=await c.run('encodeDeepLink({doc:{pages:[{nodes:[{id:1,label:"A"}],edges:[]}]}})');
  const v=makeViewer({hash:'#d='+payload});
  v.run('const original=render;render=(...args)=>{if(!Number.isFinite(doc.pages[0].nodes[0].w)) throw Error("missing defaults");return original(...args)}');
  await v.boot();await v.waitForPhase(p=>p==='ready'||p==='error');assert.equal(v.viewer().phase,'ready');
  const bad=makeViewer({hash:'#d='+payload});bad.connect();bad.run('render=()=>{throw Error("first render")}');
  await bad.boot();await bad.waitForPhase(p=>p==='ready'||p==='error');
  assert.equal(bad.viewer().phase,'error');assert.deepEqual(bad.names(),[]);
  assert.equal(bad.el('btnOpen').disabled,true);
});
test('Share: errores de documento y serialización no generan eventos',async()=>{
  const c=creator();c.el('btnShare').onclick();c.run('doc.pages=[]');
  await c.el('shareCreate').onclick();
  assert.ok(!c.names().includes('share_created'));
  assert.equal(c.el('shareLink').value,'');
});
test('Assets externos y SVG malformado se rechazan en la frontera compartida',()=>{
  const v=creator();
  for(const img of ['https://tracker.invalid/secret','/track?secret','data:image/svg+xml;base64,PHN2Zz4=']){
    v.context.badImg=img;
    assert.throws(()=>v.run('projectFromProjectData({doc:{pages:[{nodes:[{id:1,img:badImg}],edges:[]}]}})'),e=>e.code==='invalid_document');
  }
});
test('Analytics: los tres eventos eliminan payload, hash, contenido y propiedades',()=>{
  const c=creator();
  for(const name of ['share_created','share_viewed','share_opened_in_editor']){
    const safe=c.run(`analyticsBeforeSend('event',{name:${JSON.stringify(name)},url:'https://fluyo.space/s/#d=PRIVATE_MARKER',title:'PRIVATE_MARKER',referrer:'PRIVATE_MARKER',data:{size:9,id:'PRIVATE_MARKER',hash:'#d=PRIVATE_MARKER'}})`);
    assert.ok(!JSON.stringify(safe).includes('PRIVATE_MARKER'));
    assert.equal(safe.url,'/');assert.equal(safe.title,'Fluyo');assert.equal(safe.referrer,'');
    assert.equal(safe.data,undefined);
  }
  assert.equal(c.scripts[0].dataset.autoTrack,'false');
});
