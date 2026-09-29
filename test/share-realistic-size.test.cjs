"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeViewer,read}=require('./viewer-harness.cjs');
const {buildRealisticEditorDocument}=require('./realistic-share-fixtures.cjs');
function creator(kind='tiny'){
  const v=makeViewer();v.context.location.protocol='https:';v.context.location.href='https://fluyo.space/';
  v.run(read('js/state.js').split('/* ===================== Viewport')[0]);
  v.run('('+buildRealisticEditorDocument.toString()+')('+JSON.stringify(kind)+')');
  v.run('const __n=projectFromProjectData({version:5,app:"fluyo",doc,settings});doc=__n.doc;settings=__n.settings;');
  v.run(read('js/share-url.js'));v.run('function commitEditBox(){}');v.context.navigator={};
  for(const id of ['btnShare','shareDialog','shareConfirm','shareResult','shareCopy','shareCreate','shareClose','shareLink','shareMessage']){
    const element=v.context.document.getElementById(id);element.focus=()=>{};element.select=()=>{};
  }
  v.el('shareDialog').showModal=function(){this.open=true;};v.el('shareDialog').close=function(){this.open=false;};
  v.run(read('js/editor-share.js'));v.connect();return v;
}
for(const kind of ['tiny','small','moderate'])test('Realistic Share: '+kind+' por confirmShare, compresión y snapshot igual a Guardar',async t=>{
  const v=creator(kind);const saved=JSON.parse(v.run('JSON.stringify(serializeProject())'));
  v.run('const originalEncoder=encodeDeepLink;let encodedSnapshot;encodeDeepLink=async data=>{encodedSnapshot=deep(data);return originalEncoder(data)}');
  v.el('btnShare').onclick();await v.el('shareCreate').onclick();
  const url=v.el('shareLink').value;assert.ok(url.length>0&&url.length<8192);
  assert.equal(v.run('MAX_SHARE_URL_LENGTH'),65536);assert.equal(v.el('shareMessage').textContent,'');
  assert.deepEqual(JSON.parse(v.run('JSON.stringify(encodedSnapshot)')),saved);
  const transport=Buffer.from(new URL(url).hash.slice(3),'base64url');assert.equal(transport[0],1);
  const decoded=await v.run('decodeDeepLink('+JSON.stringify(new URL(url).hash.slice(3))+')');
  assert.deepEqual(JSON.parse(JSON.stringify(decoded)),saved);
  t.diagnostic(JSON.stringify({case:kind,jsonCharacters:JSON.stringify(saved).length,jsonUTF8Bytes:Buffer.byteLength(JSON.stringify(saved)),compressedBytes:transport.length-1,payloadCharacters:new URL(url).hash.length-3,finalURLCharacters:url.length}));
});
test('Realistic Share: runtime/caches/undo/selección no entran en snapshot sin assets',async()=>{
  const v=creator();v.run('imgCache.globalEditorAsset="X".repeat(100000);selN=new Set([1]);window.runtimeBuffer="Y".repeat(100000);viewX=1000;viewY=1000;viewZoom=5');
  const snapshot=JSON.parse(v.run('JSON.stringify(serializeProject())'));
  assert.deepEqual(Object.keys(snapshot),['version','app','doc','settings']);
  assert.equal(snapshot.doc.pages.length,1);assert.equal(snapshot.doc.pages[0].nodes[0].img,undefined);
  assert.ok(JSON.stringify(snapshot).length<1024);
  assert.ok((await v.run('createShareUrl(serializeProject(),location.href)')).length<8192);
});
test('Realistic Share: origen conserva protocolo/puerto y descarta query/hash previo enorme',async()=>{
  const v=creator('small');
  for(const base of ['https://fluyo.space/','https://fluyo.space/deep/?q=1#d='+'O'.repeat(90000),'http://localhost:8080/?foo=bar#d=OLD']){
    v.context.base=base;const url=new URL(await v.run('createShareUrl(serializeProject(),base)'));
    assert.equal(url.origin,new URL(base).origin);assert.equal(url.pathname,'/s/');assert.equal(url.search,'');
    assert.ok(url.href.length<8192);assert.ok(!url.hash.includes('OLD'));
  }
});
test('Realistic Share: API CompressionStream ausente conserva transporte v0 utilizable',async()=>{
  const v=creator();v.run('CompressionStream=undefined');
  const url=await v.run('createShareUrl(serializeProject(),location.href)'),payload=new URL(url).hash.slice(3);
  assert.equal(Buffer.from(payload,'base64url')[0],0);assert.ok(url.length<8192);
  assert.equal((await v.run('decodeDeepLink('+JSON.stringify(payload)+')')).doc.pages[0].nodes.length,1);
});
test('Share: límite descomprimido no se disfraza de exceso de URL',async()=>{
  const v=creator();v.run('doc.pages[0].nodes[0].label="X".repeat(DEEP_LINK_MAX_BYTES)');
  await assert.rejects(v.run('createShareUrl(serializeProject(),location.href)'),e=>e.code==='encoding_failed');
  v.el('btnShare').onclick();await v.el('shareCreate').onclick();
  assert.ok(!v.el('shareMessage').textContent.includes('demasiado grande'));assert.equal(v.el('shareLink').value,'');
  assert.ok(!v.names().includes('share_created'));
});
test('Share: excepción del encoder, incluso code too_large, es encoding_failed y UI genérica',async()=>{
  const v=creator();v.run('encodeDeepLink=async()=>{const e=Error("fallo de codec");e.code="too_large";throw e}');
  await assert.rejects(v.run('createShareUrl(serializeProject(),location.href)'),e=>e.code==='encoding_failed');
  v.el('btnShare').onclick();await v.el('shareCreate').onclick();assert.ok(!v.el('shareMessage').textContent.includes('demasiado grande'));
  assert.equal(v.el('shareCreate').disabled,false);assert.ok(!v.names().includes('share_created'));
});
test('Share: ciclo y BigInt se clasifican serialization_failed, sin eventos ni URL',async()=>{
  for(const poison of ['doc.cycle=doc','doc.extra=1n']){
    const v=creator();v.run(poison);
    await assert.rejects(v.run('createShareUrl(serializeProject(),location.href)'),e=>e.code==='serialization_failed');
    v.el('btnShare').onclick();await v.el('shareCreate').onclick();
    assert.equal(v.el('shareLink').value,'');assert.ok(!v.names().includes('share_created'));
  }
});
test('Realistic Share: SVG pertenece sólo al nodo imagen y sigue compartiendo',async()=>{
  const v=creator();v.context.svg='<svg width="40" height="40"><rect width="40" height="40" fill="red"/></svg>';
  v.run('doc.pages[0].nodes[0].shape="image";doc.pages[0].nodes[0].img="data:image/svg+xml;base64,"+btoa(svg)');
  const url=await v.run('createShareUrl(serializeProject(),location.href)');assert.ok(url.length<8192);
  const data=await v.run('decodeDeepLink('+JSON.stringify(new URL(url).hash.slice(3))+')');
  assert.deepEqual(Object.keys(data),['version','app','doc','settings']);assert.match(data.doc.pages[0].nodes[0].img,/^data:image\/svg\+xml;base64,/);
});
