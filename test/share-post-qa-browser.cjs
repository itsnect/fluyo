"use strict";
/* Chrome real: SVG, navegación/ERROR/copia, upgrade v37→v38→v39 y Umami actual.
   node test/share-post-qa-browser.cjs <script actual Umami>
   Toda telemetría se intercepta. NODE_PATH apunta al Playwright del entorno. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json'};
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ff0000"/></svg>';
const project=label=>({version:3,doc:{pages:[{name:label,nodes:[{id:1,label}],edges:[]}]}});
const payload=data=>Buffer.concat([Buffer.from([0]),Buffer.from(JSON.stringify(data))]).toString('base64url');
function asset(url){
  let rel=new URL(url).pathname;if(rel.endsWith('/'))rel+='index.html';
  const file=path.resolve(root,'.'+rel);assert.ok(file.startsWith(root+path.sep));
  return {body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'};
}
(async()=>{
  let previous=39;
  const server=http.createServer((req,res)=>{
    try{
      const url='http://localhost'+req.url,a=asset(url),pathname=new URL(url).pathname;
      // Fixture anterior: misma estrategia PWA, cache v37, helper nuevo ausente
      // del precache/shell. No cambia código de producto ni caches a mano.
      if(previous<39 && pathname==='/sw.js'){
        a.body=Buffer.from(a.body.toString().replace('fluyo-static-v39','fluyo-static-v'+previous));
        if(previous===37)a.body=Buffer.from(a.body.toString().replace('  "./js/safe-svg.js",\n','').replace('  "./js/safe-svg.js",\r\n',''));
      }
      if(previous===37 && ['/','/index.html','/s/'].includes(pathname)) a.body=Buffer.from(a.body.toString().replace(/<script src="(?:\.\.\/)?js\/safe-svg\.js"><\/script>\s*/g,''));
      res.writeHead(200,{'Content-Type':a.contentType,'Cache-Control':'no-store'});res.end(a.body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:process.env.FLUYO_BROWSER||'chrome',headless:true});
  const errors=[];const capture=p=>p.on('pageerror',e=>errors.push(e.message));
  try{
    const context=await browser.newContext({serviceWorkers:'block'});
    const editor=await context.newPage();capture(editor);await editor.goto(base+'/');
    const generatedByUI=await editor.evaluate(()=>{
      newNode('rect',100,100,{label:'SVG generado por Fluyo'});
      const generated=buildSVGDocument(),uri='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(generated)));
      const normalized=normalizeDocumentImage(uri);
      doc.pages[0].nodes=[];
      if(normalized!==normalizeDocumentImage(normalized))throw Error('SVG no idempotente');
      return generated;
    });
    await editor.locator('#imgIn').setInputFiles({name:'exportado-por-fluyo.svg',mimeType:'image/svg+xml',buffer:Buffer.from(generatedByUI)});
    await editor.waitForFunction(()=>P().nodes.length===1&&getImg(P().nodes[0].img).naturalWidth>0);
    await editor.evaluate(()=>{doc.pages[0].nodes=[];});
    await editor.locator('#imgIn').setInputFiles({name:'local.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
    await editor.waitForFunction(()=>P().nodes.length===1 && getImg(P().nodes[0].img).naturalWidth===40);
    const [download]=await Promise.all([editor.waitForEvent('download'),editor.locator('#btnJsonOut').click()]);
    const saved=fs.readFileSync(await download.path());
    await editor.evaluate(()=>{doc={theme:'dark',customBg:'',cur:0,pages:[blankPage('Nueva')]};});
    await editor.locator('#fileIn').setInputFiles({name:'saved.fluyo.json',mimeType:'application/json',buffer:saved});
    await editor.waitForFunction(()=>P().nodes.length===1 && getImg(P().nodes[0].img).naturalWidth===40);
    const pixel=await editor.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=40;const ctx=c.getContext('2d');ctx.drawImage(getImg(P().nodes[0].img),0,0);return [...ctx.getImageData(20,20,1,1).data];});
    assert.deepEqual(pixel,[255,0,0,255]);
    const [png]=await Promise.all([editor.waitForEvent('download'),editor.evaluate(()=>exportStatic('png',1,false))]);
    assert.ok(fs.readFileSync(await png.path()).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    const [exportedSVG]=await Promise.all([editor.waitForEvent('download'),editor.evaluate(()=>exportSVG(1))]);
    assert.ok(fs.readFileSync(await exportedSVG.path(),'utf8').includes('<image'));
    const mixedExport=await editor.evaluate(()=>{
      newNode('code',200,200,{label:'const x = 1;'});
      newNode('icon',300,300,{icon:Object.keys(ICONS)[0],label:'Icono local'});
      const uri='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(buildSVGDocument())));
      const normalized=normalizeDocumentImage(uri);
      doc.pages[0].nodes=doc.pages[0].nodes.filter(n=>n.shape==='image');
      if(normalized!==normalizeDocumentImage(normalized))throw Error('Export SVG no idempotente');
      return normalized;
    });
    assert.deepEqual(await editor.evaluate(uri=>new Promise((resolve,reject)=>{
      const image=new Image();image.onerror=()=>reject(Error('Export SVG no renderizable'));
      image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);resolve([...ctx.getImageData(canvas.width/2,canvas.height/2,1,1).data]);};image.src=uri;
    }),mixedExport),[255,0,0,255],'SVG local anidado exportado conserva píxel rojo real');
    await editor.locator('#btnShare').click();await editor.locator('#shareCreate').click();await editor.locator('#shareCopy').waitFor();
    const svgShare=await editor.locator('#shareLink').inputValue();
    const viewer=await context.newPage();capture(viewer);await viewer.goto(svgShare);
    await viewer.waitForFunction(()=>window.__viewer?.phase==='ready' && getImg(doc.pages[0].nodes[0].img).naturalWidth===40);
    let blocked=0;editor.on('dialog',async d=>{blocked++;await d.accept();});
    await editor.locator('#shareClose').click();
    for(const dangerous of ['<svg onload="alert(1)"/>','<svg><script>alert(1)</script></svg>','<svg><foreignObject/></svg>','<svg><image href="https://tracker.invalid/private"/></svg>'])
      await editor.locator('#imgIn').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from(dangerous)});
    await editor.locator('#imgIn').setInputFiles({name:'zero.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="40"/>')});
    await editor.waitForFunction(()=>P().nodes.length===1);await editor.waitForTimeout(100);assert.equal(blocked,5);
    console.log('SVG: UI → guardar → importar → imagen roja real → export PNG/SVG → Share; SVG activos y dimensiones nulas bloqueados PASS');

    const a=payload(project('A')),b=payload(project('B')),c=payload(project('C'));
    await viewer.goto(base+'/s/#d='+a);await viewer.waitForFunction(()=>window.__viewer?.phase==='ready' && doc.pages[0].nodes[0].label==='A');
    await viewer.goto(base+'/s/#d='+b);await viewer.waitForFunction(()=>window.__viewer?.phase==='ready' && doc.pages[0].nodes[0].label==='B');
    await viewer.goBack();await viewer.waitForFunction(()=>doc.pages[0].nodes[0].label==='A');
    await viewer.goForward();await viewer.waitForFunction(()=>doc.pages[0].nodes[0].label==='B');
    // Documento de varias páginas: el DOM real debe retirar las tabs de A
    // y encajar B igual que en una apertura limpia, tras alterar la vista de A.
    const pagedA=project('A1');pagedA.doc.pages.push({name:'A2',nodes:[{id:1,label:'A2'}],edges:[]},{name:'A3',nodes:[],edges:[]});
    const pagedB=project('B1');pagedB.doc.pages.push({name:'B2',nodes:[{id:1,label:'B2',x:1800,y:900}],edges:[]});pagedB.doc.cur=1;
    const tabs=await context.newPage(),fresh=await context.newPage();capture(tabs);capture(fresh);
    await fresh.goto(base+'/s/#d='+payload(pagedB));await fresh.waitForFunction(()=>window.__viewer?.phase==='ready');
    const freshView=await fresh.evaluate(()=>window.__viewer.view);
    await tabs.goto(base+'/s/#d='+payload(pagedA));await tabs.waitForFunction(()=>window.__viewer?.phase==='ready');
    await tabs.locator('#pgTabs button').nth(2).click();await tabs.locator('#btnZoomIn').click();
    await tabs.goto(base+'/s/#d='+payload(pagedB));await tabs.waitForFunction(()=>window.__viewer?.phase==='ready'&&doc.pages[1]?.name==='B2');
    assert.deepEqual(await tabs.locator('#pgTabs button').allTextContents(),['B1','B2']);
    assert.deepEqual(await tabs.evaluate(()=>window.__viewer.view),freshView);assert.equal(await tabs.evaluate(()=>doc.cur),1);
    assert.equal(await tabs.locator('#pgTabs button.active').textContent(),'B2');
    await tabs.goto(base+'/s/#d=invalid');await tabs.waitForFunction(()=>window.__viewer?.phase==='error');
    assert.equal(await tabs.locator('#pgTabs button').count(),0);
    assert.equal(await tabs.evaluate(()=>Object.keys(imgCache).length+Object.keys(tintedURL).length+edgeLabelPos.size),0);
    assert.equal(await tabs.evaluate(()=>JSON.stringify(view)===JSON.stringify(makeViewerViewport())),true);
    await tabs.close();await fresh.close();
    const copyContext=await browser.newContext({serviceWorkers:'block'});
    const bCopy=await copyContext.newPage();capture(bCopy);
    await bCopy.goto(base+'/s/#d='+a);await bCopy.waitForFunction(()=>window.__viewer?.phase==='ready');
    await bCopy.goto(base+'/s/#d='+b);await bCopy.waitForFunction(()=>window.__viewer?.phase==='ready' && doc.pages[0].nodes[0].label==='B');
    await bCopy.locator('#btnOpen').click();await bCopy.waitForURL(base+'/#d='+b);
    await bCopy.waitForFunction(()=>typeof newNode==='function' && doc.pages[0].nodes[0]?.label==='B');
    await copyContext.close();
    await viewer.locator('#btnPresent').click();
    await viewer.evaluate(()=>location.hash='d=invalid');await viewer.waitForFunction(()=>window.__viewer?.phase==='error');
    assert.deepEqual(await viewer.evaluate(()=>({nodes:doc.pages[0].nodes.length,payload:viewerPayload,presenting:window.__viewer.presenting,raf:viewerRaf,gestures:viewerPointers.size})),{nodes:0,payload:null,presenting:false,raf:null,gestures:0});
    assert.equal(await viewer.locator('#btnOpen').isDisabled(),true);assert.equal(await viewer.locator('#btnPresent').isDisabled(),true);
    const alpha=await viewer.evaluate(()=>{const cv=document.getElementById('sv');return cv.getContext('2d').getImageData(1,1,1,1).data[3];});assert.equal(alpha,0);
    await viewer.goto(base+'/s/#d='+c);await viewer.waitForFunction(()=>window.__viewer?.phase==='ready' && doc.pages[0].nodes[0].label==='C');
    await viewer.locator('#btnOpen').click();await viewer.waitForURL(base+'/#d='+c);
    await viewer.locator('#incomingOpen').click({timeout:1000}).catch(()=>{}); // Puede existir sesión local del SVG.
    await viewer.waitForFunction(()=>typeof newNode==='function' && doc.pages[0].nodes[0]?.label==='C');
    await viewer.evaluate(()=>{doc.pages[0].nodes[0].label='C editable';scheduleAutosave();});
    console.log('Hash: A→B, atrás/adelante, invalid limpio con canvas/Present/CTA bloqueados, ERROR→C y C editable PASS');
    await context.close();

    previous=37;const pwa=await browser.newContext();const offline=await pwa.newPage();capture(offline);
    await offline.goto(base+'/');await offline.waitForFunction(()=>!!navigator.serviceWorker.controller);
    assert.equal(await offline.evaluate(async()=>!!await (await caches.open('fluyo-static-v37')).match(location.origin+'/js/safe-svg.js')),false);
    // Esperar el booleano resuelto de cada inspección asíncrona. Un Promise
    // devuelto a waitForFunction no acredita por sí solo instalación/claim.
    const waitForCache=async version=>{
      const deadline=Date.now()+15000;
      while(Date.now()<deadline){
        if(await offline.evaluate(async version=>{
          const keys=await caches.keys(),r=await navigator.serviceWorker.getRegistration();
          return keys.length===1&&keys[0]==='fluyo-static-v'+version&&!r.installing&&!r.waiting&&r.active?.state==='activated'&&navigator.serviceWorker.controller===r.active;
        },version))return;
        await offline.waitForTimeout(100);
      }
      throw Error('Timeout esperando activación y claim de v'+version);
    };
    previous=38;
    await offline.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
    await waitForCache(38);
    assert.equal(await offline.evaluate(async()=>{const response=await(await caches.open('fluyo-static-v38')).match(location.origin+'/s/');return(await response.text()).includes('safe-svg.js');}),true);
    await offline.goto(svgShare);await offline.waitForFunction(()=>window.__viewer?.phase==='ready'&&getImg(doc.pages[0].nodes[0].img).naturalWidth===40);
    previous=39;
    await offline.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
    await waitForCache(39);
    // Esperar controllerchange real: la cache se crea antes de terminar install.
    await offline.waitForFunction(()=>navigator.serviceWorker.controller?.state==='activated');
    await offline.waitForTimeout(200);
    await pwa.setOffline(true);await offline.goto(svgShare);
    await offline.waitForFunction(()=>window.__viewer?.phase==='ready' && getImg(doc.pages[0].nodes[0].img).naturalWidth===40);
    assert.deepEqual(await offline.evaluate(async()=>caches.keys()),['fluyo-static-v39']);
    await pwa.close();console.log('PWA: fixtures v37 → v38 → v39 activada, helper precacheado y Share SVG previamente abierto offline PASS');

    assert.ok(process.argv[2],'Se requiere script actual Umami');
    const script=fs.readFileSync(process.argv[2],'utf8');
    const privacy=await browser.newContext({serviceWorkers:'block'});const net=[],events=[];
    privacy.on('request',r=>net.push({url:r.url(),headers:r.headers(),body:r.postData()}));
    await privacy.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith('https://fluyo.space/'))return route.fulfill({status:200,...asset(url)});
      if(url==='https://cloud.umami.is/script.js')return route.fulfill({status:200,contentType:'application/javascript',body:script});
      if(url==='https://gateway.umami.is/api/send'){events.push(JSON.parse(route.request().postData()));return route.fulfill({status:200,contentType:'application/json',body:'{}'});}
      return route.abort();
    });
    const marker='FLUYO_PRIVATE_MARKER_12345',pa=payload(project(marker+' A')),pb=payload(project(marker+' B'));
    const pv=await privacy.newPage();capture(pv);await pv.goto('https://fluyo.space/s/#d='+pa);
    await pv.waitForFunction(()=>window.__viewer?.phase==='ready');await pv.waitForFunction(()=>typeof window.umami?.track==='function');await pv.waitForTimeout(150);
    await pv.goto('https://fluyo.space/s/#d='+pb);await pv.waitForFunction(()=>window.__viewer?.phase==='ready' && doc.pages[0].nodes[0].label.endsWith('B'));await pv.waitForTimeout(150);
    await pv.evaluate(()=>window.dispatchEvent(new HashChangeEvent('hashchange')));await pv.waitForTimeout(100);
    assert.equal(events.filter(e=>e.payload.name==='share_viewed').length,2);
    await pv.goto('https://fluyo.space/s/#d=invalid');await pv.waitForFunction(()=>window.__viewer?.phase==='error');await pv.waitForTimeout(100);
    assert.equal(events.filter(e=>e.payload.name==='share_viewed').length,2);
    await pv.goto('https://fluyo.space/s/#d='+pa);await pv.waitForFunction(()=>window.__viewer?.phase==='ready');await pv.waitForTimeout(150);
    assert.equal(events.filter(e=>e.payload.name==='share_viewed').length,3);
    const slow=payload(project(marker+' SLOW')),pc=payload(project(marker+' C'));
    await pv.evaluate(slow=>{
      const original=loadShareFromLocation;
      loadShareFromLocation=async input=>{if(input.hash==='#d='+slow)await new Promise(resolve=>window.finishSlow=resolve);return original(input);};
      location.hash='d='+slow;
    },slow);
    await pv.waitForFunction(()=>window.__viewer.phase==='loading'&&typeof window.finishSlow==='function');
    await pv.evaluate(()=>location.hash='d=invalid');await pv.waitForFunction(()=>window.__viewer.phase==='error');
    await pv.evaluate(pc=>location.hash='d='+pc,pc);await pv.waitForFunction(()=>window.__viewer.phase==='ready'&&doc.pages[0].nodes[0].label.endsWith(' C'));
    await pv.evaluate(()=>window.finishSlow());await pv.waitForTimeout(150);
    assert.equal(await pv.evaluate(()=>doc.pages[0].nodes[0].label),marker+' C');
    assert.equal(events.filter(e=>e.payload.name==='share_viewed').length,4);
    assert.deepEqual([...new Set(events.map(e=>e.payload.name))],['share_viewed']); // Ningún pageview automático.
    for(const event of events){assert.equal(event.payload.url,'/');assert.equal(event.payload.title,'Fluyo');assert.equal(event.payload.referrer,'');assert.equal(event.payload.data,undefined);}
    const serialized=JSON.stringify(net);
    for(const secret of [marker,pa,pb,slow,pc,'#d=',Buffer.from(marker).toString('base64')])assert.ok(!serialized.includes(secret));
    await privacy.close();assert.deepEqual(errors,[]);
    console.log('Privacidad hash navigation: Umami actual, evento por activación, invalid/mismo estado sin evento, cero marcador/hash/payload/pageview ni pageerror PASS');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
