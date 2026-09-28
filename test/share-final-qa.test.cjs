"use strict";
/* Re-QA independiente: carreras controladas, estructura corrupta y capacidad
   de los gates conservados para detectar los cuatro defectos originales. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deflateRawSync,inflateRawSync,constants}=require('node:zlib');
const {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {makeViewer}=require('./viewer-harness.cjs');
const project=label=>({version:3,doc:{pages:[{name:label,nodes:[{id:1,label}],edges:[]}]}});
const link=data=>Buffer.concat([Buffer.from([0]),Buffer.from(JSON.stringify(data))]).toString('base64url');

test('Re-QA: A lenta → inválido → C, éxito/fallo obsoleto nunca reinstala A',async()=>{
  for(const reject of [false,true]){
    const v=makeViewer({search:'',hash:'#d='+link(project('A'))});v.connect();
    v.run('const originalLoader=loadShareFromLocation;let finishA;let calls=0;loadShareFromLocation=async input=>{if(++calls===1) await new Promise((resolve,reject)=>{finishA={resolve,reject}});return originalLoader(input)}');
    await v.boot();assert.equal(v.viewer().phase,'loading');
    await v.navigate('#d=invalid');assert.equal(v.viewer().phase,'error');
    const c=link(project('C'));await v.navigate('#d='+c);
    assert.equal(v.run('doc.pages[0].nodes[0].label'),'C');
    v.run(reject?'finishA.reject(Error("resultado antiguo"))':'finishA.resolve()');
    await v.flush(12);v.frames(3);
    assert.equal(v.viewer().phase,'ready');assert.equal(v.run('viewerPayload'),c);
    assert.equal(v.run('doc.pages[0].nodes[0].label'),'C');
    assert.deepEqual(v.names(),['share_viewed']);assert.equal(v.pendingFrames(),1);
  }
});

test('Re-QA: A y B pendientes terminan después de C en orden inverso',async()=>{
  const v=makeViewer({search:'',hash:'#d='+link(project('A'))});v.connect();
  v.run('const originalLoader=loadShareFromLocation;const releases=[];let calls=0;loadShareFromLocation=async input=>{if(++calls<=2) await new Promise(resolve=>releases.push(resolve));return originalLoader(input)}');
  await v.boot();await v.navigate('#d='+link(project('B')));
  const c=link(project('C'));await v.navigate('#d='+c);
  v.run('releases[1]()');await v.flush();v.run('releases[0]()');await v.flush();v.frames(2);
  assert.equal(v.run('viewerPayload'),c);assert.equal(v.run('doc.pages[0].nodes[0].label'),'C');
  assert.deepEqual(v.names(),['share_viewed']);assert.equal(v.pendingFrames(),1);
});

test('Re-QA: CTA asíncrona de A cancelada al activar B no navega a A',async()=>{
  const v=makeViewer({search:'',hash:'#d='+link(project('A'))});v.connect();await v.boot();
  v.run('const originalURL=buildOpenInFluyoURL;let finishURL;buildOpenInFluyoURL=async(...args)=>{await new Promise(resolve=>finishURL=resolve);return originalURL(...args)};const pendingCTA=openInFluyo()');
  const b=link(project('B'));await v.navigate('#d='+b);
  v.run('finishURL()');await v.run('pendingCTA');
  assert.equal(v.context.location.href,'https://fluyo.space/s/#d='+b);
  assert.equal(v.run('viewerPayload'),b);
});

test('Re-QA: ERROR retira caches, viewport, página y controles del documento anterior',async()=>{
  const data=project('A');data.doc.cur=1;data.doc.pages.push({name:'A2',nodes:[{id:1,label:'A2'}],edges:[]});
  const v=makeViewer({search:'',hash:'#d='+link(data)});v.connect();await v.boot();
  v.run('imgCache.privateImage={};tintedURL.privateIcon="data:anterior";edgeLabelPos.set(42,{});view.x=987;view.y=654;view.zoom=3');
  await v.navigate('#d=invalid');
  assert.equal(v.run('Object.keys(imgCache).length+Object.keys(tintedURL).length+edgeLabelPos.size'),0);
  assert.equal(v.run('JSON.stringify(view)'),v.run('JSON.stringify(makeViewerViewport())'));
  assert.equal(v.run('doc.cur'),0);assert.equal(v.el('pgTabs').textContent,'');assert.equal(v.el('pgTabs').hidden,true);
  v.el('btnPresent').onclick();await v.el('btnOpen').onclick();
  assert.equal(v.viewer().presenting,false);assert.equal(v.pendingFrames(),0);
  assert.deepEqual(v.names(),['share_viewed']);
});

test('Re-QA: DEFLATE corrupto contrastado con zlib, sin aceptación silenciosa',async t=>{
  const v=makeViewer();let seed=24681357,checked=0,invalid=0;
  const samples=[Buffer.from([7]),Buffer.from([1,1,0,0,0,65]),Buffer.from([3])];
  const source=Buffer.from(JSON.stringify(project('Patrón '+Array.from({length:800},(_,i)=>i%47).join(','))));
  for(const options of [{level:0},{strategy:constants.Z_FIXED},{level:9},{strategy:constants.Z_HUFFMAN_ONLY}]){
    const stream=deflateRawSync(source,options);
    samples.push(stream,Buffer.concat([stream,Buffer.from([0])]),stream.subarray(0,-1));
    for(let i=0;i<100;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const altered=Buffer.from(stream);altered[seed%altered.length]^=1<<((seed>>>16)%8);samples.push(altered);
    }
  }
  for(const bytes of samples){
    let native=null;try{native=inflateRawSync(bytes,{info:true,maxOutputLength:2*1024*1024});}catch{}
    const exact=native && native.engine.bytesWritten===bytes.length;
    v.context.bytes=new Uint8Array(bytes);
    let count=null;try{count=v.run('validateDeflateRaw(bytes,DEEP_LINK_MAX_BYTES)');}catch{}
    if(exact){assert.equal(count,native.buffer.length,'No rechazar stream exacto admitido por zlib');}
    else{
      invalid++;
      // Una tabla incompleta puede superar el recorrido, pero el descompresor
      // nativo sigue siendo la segunda frontera obligatoria del códec.
      await assert.rejects(v.run('inflateRaw(bytes,DEEP_LINK_MAX_BYTES)'));
    }
    checked++;
  }
  assert.equal(checked,415);assert.ok(invalid>=11);
  t.diagnostic(`${checked} streams contrastados: ${invalid} inválidos/no exactos rechazados; ${checked-invalid} exactos aceptados`);
});

test('Re-QA: los gates preservados detectan mutaciones Q1/Q2/Q3/Q4 en copias aisladas',()=>{
  const root=path.resolve(__dirname,'..');
  const mutations=[
    {name:'Q1',file:'js/safe-svg.js',from:'function normalizeDocumentImage(uri,depth=0){',to:'function normalizeDocumentImage(uri,depth=0){if(/^data:image\\/svg/.test(uri)) throw imageDataError();',suite:'qa-share.test.cjs',pattern:'SVG simple'},
    {name:'Q2',file:'js/viewer.js',from:'window.addEventListener("hashchange",()=>{bootViewer();});',to:'/* Mutación QA: hashchange ausente. */',suite:'share-post-qa.test.cjs',pattern:'Hash A'},
    {name:'Q3',file:'js/link-codec.js',from:'  validateDeflateRaw(bytes,max);',to:'  /* Mutación QA: sólo descompresor nativo. */',suite:'qa-share.test.cjs',pattern:'bytes añadidos'},
    {name:'Q4',file:'js/viewer.js',from:'  viewerPayload=null;shareViewed=false;\n  doc={theme:"dark",customBg:"",pages:[{name:"",nodes:[],edges:[],nextId:1}],cur:0};',to:'  shareViewed=false; /* Mutación QA: modelo/payload retenidos. */',suite:'qa-share.test.cjs',pattern:'ERROR de primer render'}
  ];
  for(const mutation of mutations){
    const temp=mkdtempSync(path.join(tmpdir(),'fluyo-final-mutation-'));
    try{
      cpSync(path.join(root,'js'),path.join(temp,'js'),{recursive:true});mkdirSync(path.join(temp,'test'));
      for(const name of ['viewer-harness.cjs',mutation.suite]) cpSync(path.join(root,'test',name),path.join(temp,'test',name));
      const file=path.join(temp,mutation.file),source=readFileSync(file,'utf8').replace(/\r\n/g,'\n');
      assert.ok(source.includes(mutation.from),mutation.name+' punto de mutación existente');
      writeFileSync(file,source.replace(mutation.from,mutation.to));
      const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
      const result=spawnSync(process.execPath,['--test','--test-name-pattern='+mutation.pattern,'test/'+mutation.suite],{cwd:temp,env:childEnv,encoding:'utf8',timeout:15000});
      assert.equal(result.status,1,mutation.name+': el gate debe fallar\n'+result.stdout+result.stderr);
      assert.match(result.stdout,/# fail 1\b/,mutation.name);
    }finally{
      assert.equal(path.dirname(path.resolve(temp)),path.resolve(tmpdir()));
      assert.ok(path.basename(temp).startsWith('fluyo-final-mutation-'));
      rmSync(temp,{recursive:true,force:true});
    }
  }
});

test('Re-QA: tablas dynamic inválidas, repeticiones y EOB ausente fallan cerrado',async()=>{
  const dynamic=(lengths,body)=>{
    const bits=[],write=(value,count)=>{for(let i=0;i<count;i++)bits.push((value>>>i)&1);};
    write(1,1);write(2,2);write(0,5);write(0,5);write(0,4);
    for(const length of lengths)write(length,3);body(write);
    const bytes=Buffer.alloc(Math.ceil(bits.length/8));bits.forEach((bit,i)=>bytes[i>>>3]|=bit<<(i&7));return bytes;
  };
  const samples=[
    Buffer.from([7]), // BTYPE reservado.
    Buffer.from([1,1,0,0,0,65]), // LEN/NLEN incoherentes.
    dynamic([1,1,1,1],()=>{}), // Tabla de códigos sobresuscrita.
    dynamic([1,0,0,0],write=>write(0,1)), // Repetir 16 sin longitud previa.
    dynamic([0,0,1,0],write=>{write(0,1);write(127,7);write(0,1);write(127,7);}), // Exceso de longitudes.
    dynamic([0,0,1,0],write=>{write(0,1);write(127,7);write(0,1);write(109,7);}), // 258 ceros: EOB ausente.
  ];
  const v=makeViewer();
  for(const bytes of samples){
    v.context.bytes=new Uint8Array(bytes);
    assert.throws(()=>v.run('validateDeflateRaw(bytes,DEEP_LINK_MAX_BYTES)'));
    await assert.rejects(v.run('inflateRaw(bytes,DEEP_LINK_MAX_BYTES)'));
  }
});

test('Re-QA: límite exacto de 2 MiB aceptado y un byte adicional rechazado en v0/v1',async()=>{
  const max=2*1024*1024,data=project('');
  data.doc.pages[0].nodes[0].label='X'.repeat(max-Buffer.byteLength(JSON.stringify(data)));
  const json=Buffer.from(JSON.stringify(data));assert.equal(json.length,max);
  const v=makeViewer();
  for(const version of [0,1]){
    v.context.payload=Buffer.concat([Buffer.from([version]),version?deflateRawSync(json):json]).toString('base64url');
    assert.equal((await v.run('decodeDeepLink(payload)')).doc.pages[0].nodes[0].label.length,data.doc.pages[0].nodes[0].label.length);
    const over=Buffer.concat([json,Buffer.from(' ')]);
    v.context.payload=Buffer.concat([Buffer.from([version]),version?deflateRawSync(over):over]).toString('base64url');
    await assert.rejects(v.run('decodeDeepLink(payload)'),e=>e.motivo==='too_large');
  }
});

test('Re-QA: SVG de exportador, aliases y SVG anidado usan la misma frontera cerrada',()=>{
  const v=makeViewer();const uri=source=>'data:image/svg+xml;base64,'+Buffer.from(source).toString('base64');
  const valid='<svg><defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0 0L10 4L0 8z" fill="context-stroke"/></marker></defs><path d="M0 0L20 20" marker-end="url(#arrow)"/><text textLength="40" lengthAdjust="spacing">Código</text><use href="#arrow" xlink:href="#arrow"/></svg>';
  v.context.uri=uri(valid);assert.doesNotThrow(()=>v.run('normalizeDocumentImage(uri)'));
  for(const bad of [valid.replace('url(#arrow)','url(https://tracker.invalid/)'),valid.replace('xlink:href="#arrow"','xlink:href="#other"'),valid.replace('orient="auto-start-reverse"','orient="javascript:alert(1)"')]){
    v.context.uri=uri(bad);assert.throws(()=>v.run('normalizeDocumentImage(uri)'),e=>e.code==='invalid_document');
  }
  for(const source of ['<svg onload="alert(1)"/>','<svg><script/></svg>','<svg><image href="https://tracker.invalid/"/></svg>','<!DOCTYPE svg><svg/>']){
    v.context.uri=uri('<svg><image href="'+uri(source)+'"/></svg>');
    assert.throws(()=>v.run('normalizeDocumentImage(uri)'),e=>e.code==='invalid_document');
  }
  let nested=uri('<svg width="40" height="40"><rect width="40" height="40" fill="red"/></svg>');
  for(let depth=1;depth<=8;depth++){
    v.context.uri=nested;
    assert.doesNotThrow(()=>v.run('normalizeDocumentImage(uri)'));
    nested=uri('<svg><image href="'+nested+'"/></svg>');
  }
  v.context.uri=nested;assert.throws(()=>v.run('normalizeDocumentImage(uri)'),e=>e.code==='invalid_document');
});
