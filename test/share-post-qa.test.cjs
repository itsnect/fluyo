"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deflateRawSync,constants}=require('node:zlib');
const {makeViewer}=require('./viewer-harness.cjs');
const project=label=>({version:3,app:'fluyo',doc:{pages:[{name:label,nodes:[{id:1,label}],edges:[]}]}});
const link=data=>Buffer.concat([Buffer.from([0]),Buffer.from(JSON.stringify(data))]).toString('base64url');
const svgURI=svg=>'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
const svgProject=svg=>({version:3,doc:{pages:[{nodes:[{id:1,shape:'image',img:svgURI(svg)}],edges:[]}]}});

test('SVG estático: normalización idempotente, archivo histórico y deep link v0/v1',async()=>{
  const v=makeViewer();
  const svg='<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="40" viewBox="0 0 40 40"><defs><linearGradient id="paint"><stop offset="0%" stop-color="red" stop-opacity="0.5"/></linearGradient><path id="p" d="M0 0 L40 40"/></defs><g transform="translate(1,2)"><rect width="40" height="40" style="fill:url(#paint);stroke:blue;stroke-width:1"/><use xlink:href="#p"/><text x="4" y="20" font-family="Georgia, serif">&lt;img&gt; &amp; ñ</text></g></svg>';
  v.context.input=svgProject(svg);
  const before=JSON.stringify(v.context.input);
  const normalized=v.run('projectFromProjectData(input)');
  assert.equal(JSON.stringify(v.context.input),before,'No mutar archivo histórico');
  v.context.normalized={version:3,...normalized};
  assert.equal(v.run('JSON.stringify(projectFromProjectData(normalized))'),JSON.stringify(normalized));
  for(const compression of [true,false]){
    const c=makeViewer();c.context.input=v.context.normalized;if(!compression)c.run('CompressionStream=undefined');
    const payload=await c.run('encodeDeepLink(input)');
    const viewer=makeViewer({search:'',hash:'#d='+payload});
    viewer.context.Image=class{set src(value){this.url=value;}get complete(){return true;}get naturalWidth(){return 40;}};
    await viewer.boot();assert.equal(viewer.viewer().phase,'ready');
    assert.match(viewer.run('doc.pages[0].nodes[0].img'),/^data:image\/svg\+xml;base64,/);
    assert.ok(viewer.ops.some(op=>op[0]==='drawImage'));
  }
});

test('SVG activo, namespaces/entidades/CSS externos y MIME falso fallan cerrado',()=>{
  const v=makeViewer();
  for(const svg of [
    '<svg onload="alert(1)"/>','<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div>HTML</div></foreignObject></svg>',
    '<svg><use href="javascript:alert(1)"/></svg>',
    '<svg><use href="https://tracker.invalid/secret"/></svg>',
    '<svg><image href="https://tracker.invalid/secret"/></svg>',
    '<svg><rect fill="url(https://tracker.invalid/secret)"/></svg>',
    '<svg><rect style="fill:blue;background-image:url(https://tracker.invalid/)"/></svg>',
    '<svg><rect style="fill:u\\72l(https://tracker.invalid/)"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "https://tracker.invalid/">]><svg><text>&x;</text></svg>',
    '<svg xmlns="http://www.w3.org/1999/xhtml"/>',
    '<svg><animate attributeName="href" to="https://tracker.invalid/"/></svg>',
    '<svg><image href="data:image/png;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+"/></svg>',
    '<svg><rect onclick="alert(1)"/></svg>',
    '<svg><rect fill="red" fill="blue"/></svg>',
    '<svg><g></svg></g>',
  ]){
    v.context.input=svgProject(svg);
    assert.throws(()=>v.run('projectFromProjectData(input)'),e=>e.code==='invalid_document',svg);
  }
  for(const uri of ['https://tracker.invalid/secret','data:image/png;base64,PHN2Zy8+','data:text/html;base64,PHN2Zy8+']){
    v.context.input=svgProject('<svg/>');v.context.input.doc.pages[0].nodes[0].img=uri;
    assert.throws(()=>v.run('projectFromProjectData(input)'),e=>e.code==='invalid_document');
  }
  v.context.input=svgProject('<svg width="'+'1'.repeat(70000)+'x"/>');
  assert.throws(()=>v.run('projectFromProjectData(input)'),e=>e.code==='invalid_document');
});

test('SVG encodings históricos, CDATA/texto y raster embebido seguro',()=>{
  const v=makeViewer();
  const svg='<svg width="10" height="10"><text><![CDATA[<script> literal]]></text></svg>';
  for(const uri of [svgURI(svg),svgURI(svg).replace(';base64',';charset=utf-8;base64'),'data:image/svg+xml;utf8,'+encodeURIComponent(svg),'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)]){
    v.context.uri=uri;assert.ok(v.run('atob(normalizeDocumentImage(uri).split(",")[1])').includes('&lt;script&gt;'));
  }
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAvsAAAAASUVORK5CYII=';
  v.context.uri=png;assert.equal(v.run('normalizeDocumentImage(uri)'),png);
  v.context.input=svgProject('<svg width="10" height="10"><image width="10" height="10" href="'+png+'"/></svg>');
  assert.doesNotThrow(()=>v.run('projectFromProjectData(input)'));
  v.context.input=svgProject('<svg width="40px" height="40px"><path d="M0 0L40 40" stroke-dasharray="none"/></svg>');
  assert.doesNotThrow(()=>v.run('projectFromProjectData(input)'));
  for(const attributes of ['fill="red" style="fill:blue"','style="fill:blue" fill="red"']){
    v.context.uri=svgURI('<svg><rect '+attributes+'/></svg>');
    assert.ok(v.run('atob(normalizeDocumentImage(uri).split(",")[1])').includes('fill="blue"'));
  }
});

test('DEFLATE: corpus determinista binario, bloques múltiples y padding final',()=>{
  const v=makeViewer();let seed=12345;
  for(const size of [0,1,2,3,256,4096,70000,180000]){
    const data=Buffer.alloc(size);
    for(let i=0;i<size;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed>>>24;}
    for(const options of [{level:0},{level:6},{strategy:constants.Z_FIXED},{strategy:constants.Z_RLE}]){
      v.context.bytes=new Uint8Array(deflateRawSync(data,options));
      assert.equal(v.run('validateDeflateRaw(bytes,DEEP_LINK_MAX_BYTES)'),size);
    }
  }
  // EOB fijo de un stream vacío: seis bits finales de padding son indiferentes.
  v.context.bytes=new Uint8Array([3,252]);
  assert.equal(v.run('validateDeflateRaw(bytes,DEEP_LINK_MAX_BYTES)'),0);
});

test('DEFLATE exacto: stored/fixed/dynamic de otros encoders, sin recomprimir',async()=>{
  const v=makeViewer();
  const json=JSON.stringify(project('histórico '+Array.from({length:1200},(_,i)=>String(i%97)).join(',')));
  for(const options of [{level:0},{level:1},{level:6},{level:9},{strategy:constants.Z_FIXED},{strategy:constants.Z_HUFFMAN_ONLY},{strategy:constants.Z_RLE}]){
    const compressed=deflateRawSync(json,options);
    v.context.bytes=new Uint8Array(compressed);
    assert.equal(v.run('validateDeflateRaw(bytes,DEEP_LINK_MAX_BYTES)'),Buffer.byteLength(json));
    v.context.payload=Buffer.concat([Buffer.from([1]),compressed]).toString('base64url');
    assert.equal((await v.run('decodeDeepLink(payload)')).doc.pages[0].nodes[0].label,JSON.parse(json).doc.pages[0].nodes[0].label);
    for(const extra of [Buffer.from([0]),Buffer.from([0,0,0]),deflateRawSync(json)]){
      v.context.payload=Buffer.concat([Buffer.from([1]),compressed,extra]).toString('base64url');
      await assert.rejects(v.run('decodeDeepLink(payload)'),e=>e.motivo==='decode');
    }
    v.context.payload=Buffer.concat([Buffer.from([1]),compressed.subarray(0,-1)]).toString('base64url');
    await assert.rejects(v.run('decodeDeepLink(payload)'),e=>e.motivo==='decode');
  }
});

test('Hash A → B → A: documento/CTA, evento por activación y un solo RAF/viewport handler',async()=>{
  const a=link(project('A')),b=link(project('B'));
  const v=makeViewer({search:'',hash:'#d='+a});v.connect();await v.boot();
  await v.navigate('#d='+b);assert.equal(v.run('doc.pages[0].nodes[0].label'),'B');
  assert.equal(await v.run('buildOpenInFluyoURL(serializeProject(),location.href,viewerPayload)'),'https://fluyo.space/#d='+b);
  await v.navigate('#d='+a);assert.equal(v.run('doc.pages[0].nodes[0].label'),'A');
  assert.equal(v.names().filter(n=>n==='share_viewed').length,3);
  v.run('bootViewer()');await v.flush();
  await v.navigate('#d='+a+'&unused=1');v.frames(4);
  assert.equal(v.names().filter(n=>n==='share_viewed').length,3);
  assert.equal(v.pendingFrames(),1);
  const before=v.viewer().view;v.wheel({deltaX:25});
  assert.equal(v.viewer().view.x,before.x-25);
});

test('A → invalid: limpia modelo/settings/payload/canvas/gestos/presentación/RAF; ERROR → C recupera',async()=>{
  const v=makeViewer({search:'',hash:'#d='+link(project('A'))});v.connect();await v.boot();
  v.el('sv').dispatch('pointerdown',{pointerId:1,clientX:10,clientY:10});
  v.el('btnPresent').onclick();
  await v.navigate('#d=invalid');v.frames(5);
  assert.equal(v.viewer().phase,'error');assert.equal(v.viewer().presenting,false);
  assert.equal(v.pendingFrames(),0);assert.equal(v.run('viewerPointers.size'),0);
  assert.equal(v.run('viewerPinch'),null);assert.equal(v.run('viewerPayload'),null);
  assert.equal(v.run('doc.pages[0].nodes.length'),0);
  assert.equal(v.run('JSON.stringify(settings)'),v.run('JSON.stringify(DEFAULT_SETTINGS)'));
  assert.equal(v.ops.at(-1)[0],'clearRect');
  assert.equal(v.el('btnOpen').disabled,true);assert.equal(v.el('btnPresent').disabled,true);
  await v.el('btnOpen').onclick();assert.equal(v.names().filter(n=>n==='share_opened_in_editor').length,0);
  assert.equal(v.names().filter(n=>n==='share_viewed').length,1);
  await v.navigate('#d='+link(project('C')));assert.equal(v.viewer().phase,'ready');
  assert.equal(v.run('doc.pages[0].nodes[0].label'),'C');
  assert.equal(v.el('btnOpen').disabled,false);assert.equal(v.pendingFrames(),1);
  assert.equal(v.names().filter(n=>n==='share_viewed').length,2);
});

test('Carga lenta A no puede reemplazar B ni sacar de ERROR una navegación inválida',async()=>{
  for(const destination of ['#d='+link(project('B')),'#d=invalid']){
    const v=makeViewer({search:'',hash:'#d='+link(project('A'))});v.connect();
    v.run('const realLoader=loadShareFromLocation;let releaseA;let loads=0;loadShareFromLocation=async loc=>{if(++loads===1) await new Promise(resolve=>{releaseA=resolve});return realLoader(loc)}');
    await v.boot();assert.equal(v.viewer().phase,'loading');
    await v.navigate(destination);v.run('releaseA()');await v.flush(12);v.frames(4);
    if(destination==='#d=invalid'){
      assert.equal(v.viewer().phase,'error');assert.equal(v.run('doc.pages[0].nodes.length'),0);assert.equal(v.pendingFrames(),0);
      assert.deepEqual(v.names(),[]);
    }else{
      assert.equal(v.viewer().phase,'ready');assert.equal(v.run('doc.pages[0].nodes[0].label'),'B');
      assert.deepEqual(v.names(),['share_viewed']);assert.equal(v.pendingFrames(),1);
    }
  }
});

test('Fallo natural de primer render termina limpio y no cuenta vista',async()=>{
  const data=project('fallo');data.doc.pages[0].nodes[0]={id:1,shape:'icon',icon:'constructor',tint:true};
  const v=makeViewer({search:'',hash:'#d='+link(data)});v.connect();await v.boot();v.frames(3);
  assert.equal(v.viewer().phase,'error');assert.equal(v.run('viewerPayload'),null);
  assert.equal(v.run('doc.pages[0].nodes.length'),0);assert.deepEqual(v.names(),[]);
});
