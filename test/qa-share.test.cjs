"use strict";
/* QA independiente FLUYO-006. Los defectos abiertos deben mantener rojo este
   gate hasta que se corrijan; no sustituye las suites de implementación. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deflateRawSync}=require('node:zlib');
const {makeViewer,read}=require('./viewer-harness.cjs');

test('QA: URL final inclusiva, origen, puerto y protocolo',()=>{
  const v=makeViewer();v.run(read('js/share-url.js'));
  const base='http://localhost:9876/deep/path/?q=1#old';
  const prefix='http://localhost:9876/s/#d=';
  for(const length of [65535,65536]){
    v.context.qaPayload='A'.repeat(length-prefix.length);
    assert.equal(v.run(`buildShareUrl(${JSON.stringify(base)},qaPayload)`).length,length);
  }
  v.context.qaPayload='A'.repeat(65537-prefix.length);
  assert.throws(()=>v.run(`buildShareUrl(${JSON.stringify(base)},qaPayload)`),e=>e.code==='too_large');
  assert.throws(()=>v.run('buildShareUrl("file:///C:/fluyo/index.html","AA")'),e=>e.code==='web_required');
});

test('QA: transportes v0/v1 y documentos históricos siguen compatibles',async()=>{
  for(const compression of [true,false]){
    const v=makeViewer();if(!compression)v.run('CompressionStream=undefined');
    for(const version of [1,2,3]){
      v.context.qaVersion=version;
      const payload=await v.run('encodeDeepLink({version:qaVersion,state:{nodes:[{id:1,label:"Histórico ñ"}],edges:[]}})');
      v.context.qaPayload=payload;
      const decoded=await v.run('decodeDeepLink(qaPayload)');
      assert.equal(decoded.version,version);
      const viewer=makeViewer({search:'',hash:'#d='+payload});await viewer.boot();
      assert.equal(viewer.viewer().phase,'ready');
      assert.equal(viewer.run('doc.pages[0].nodes[0].label'),'Histórico ñ');
    }
  }
});

test('QA: defensa independiente de 2 MiB para v0 y bomba deflate v1',async()=>{
  const json=JSON.stringify({doc:{pages:[{nodes:[{id:1,label:'X'.repeat(2*1024*1024)}],edges:[]}]}});
  for(const version of [0,1]){
    const v=makeViewer();
    v.context.qaPayload=Buffer.concat([Buffer.from([version]),version?deflateRawSync(json):Buffer.from(json)]).toString('base64url');
    await assert.rejects(v.run('decodeDeepLink(qaPayload)'),e=>e.motivo==='too_large');
  }
});

test('QA: un SVG simple creado por la UI debe poder reabrirse como archivo histórico',()=>{
  const v=makeViewer();
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>';
  v.context.qaProject={version:3,app:'fluyo',doc:{pages:[{nodes:[{id:1,shape:'image',img:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')}],edges:[]}]}};
  assert.doesNotThrow(()=>v.run('projectFromProjectData(qaProject)'));
});

test('QA: bytes añadidos a un stream v1 deben producir error terminal',async()=>{
  const c=makeViewer();const payload=await c.run('encodeDeepLink(SHARE_FIXTURES.demo)');
  const tampered=Buffer.concat([Buffer.from(payload,'base64url'),Buffer.from([0,0,0])]).toString('base64url');
  const v=makeViewer({search:'?s=demo',hash:'#d='+tampered});v.connect();await v.boot();v.frames(3);
  assert.equal(v.viewer().phase,'error');
  assert.deepEqual(v.names(),[]);
});

test('QA: ERROR de primer render elimina documento y payload parcialmente instalados',async()=>{
  const c=makeViewer();const payload=await c.run('encodeDeepLink(SHARE_FIXTURES.demo)');
  const v=makeViewer({search:'',hash:'#d='+payload});
  v.run('render=()=>{throw Error("primer render")}');v.connect();await v.boot();v.frames(3);
  assert.equal(v.viewer().phase,'error');assert.deepEqual(v.names(),[]);
  assert.equal(v.el('btnOpen').disabled,true);assert.equal(v.el('btnPresent').disabled,true);
  assert.equal(v.run('doc.pages.reduce((total,page)=>total+page.nodes.length+page.edges.length,0)'),0);
  assert.equal(v.run('viewerPayload'),null);
});
