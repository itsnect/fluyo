"use strict";
/* Chrome real + contextos limpios + captura de red. Sólo servidor de tests.
   NODE_PATH debe apuntar a Playwright si no está instalado en el entorno.
   node test/share-browser.cjs [ruta al script actual de Umami]
   No envía telemetría real: captura y responde localmente a /api/send. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const currentCache=/const CACHE = "([^"]+)"/.exec(fs.readFileSync(path.join(root,'sw.js'),'utf8'))[1];
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json'};
function asset(url){
  let rel=decodeURIComponent(new URL(url).pathname);
  if(rel.endsWith('/')) rel+='index.html';
  const file=path.resolve(root,'.'+rel);
  assert.ok(file.startsWith(root+path.sep));
  return {body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'};
}
(async()=>{
  const initial=[];
  const server=http.createServer((req,res)=>{
    initial.push({url:req.url,headers:req.headers});
    try{const a=asset('http://localhost'+req.url);res.writeHead(200,{'Content-Type':a.contentType,'Cache-Control':'no-store'});res.end(a.body);}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:process.env.FLUYO_BROWSER||'chrome',headless:true});
  const errors=[];
  const capture=page=>page.on('pageerror',err=>errors.push(err.message));
  try{
    for(const harness of ['documento-entrante','editor-inline']){
      const context=await browser.newContext({serviceWorkers:'block'});
      const page=await context.newPage();capture(page);
      await page.goto(base+'/test/'+harness+'.html');
      await page.waitForFunction(()=>/^(OK|FALLA) /.test(document.title),null,{timeout:60000});
      const result=await page.title();assert.match(result,/^OK /);
      console.log(harness+': '+result);await context.close();
    }
    const editorContext=await browser.newContext({serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
    const editor=await editorContext.newPage();capture(editor);await editor.goto(base+'/');
    await editor.locator('[data-shape="rect"]').click();
    await editor.locator('#cv').click({position:{x:320,y:230}});
    await editor.evaluate(()=>{
      P().nodes[0].label='Snapshot A';
      const anim=newNode('anim',600,300);anim.anim='spinner';anim.label='Procesando';
      doc.pages.push(blankPage('Segunda página'));scheduleAutosave();
    });
    await editor.locator('#btnShare').click();
    assert.equal(await editor.locator('#shareLink').inputValue(),'');
    await editor.locator('#shareCreate').click();
    await editor.locator('#shareCopy').waitFor({state:'visible'});
    const url=await editor.locator('#shareLink').inputValue();
    assert.match(url,new RegExp('^'+base.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/s/#d='));
    await editor.locator('#shareCopy').click();
    await editor.waitForFunction(()=>document.getElementById('shareMessage').textContent==='Enlace copiado.');
    assert.equal(await editor.evaluate(()=>navigator.clipboard.readText()),url);
    await editor.screenshot({path:path.join(require('node:os').tmpdir(),'fluyo-share-dialog.png')});
    await editor.locator('#shareClose').click();
    await editor.evaluate(()=>{P().nodes[0].label='Snapshot B';scheduleAutosave();});
    const clean=await browser.newContext({serviceWorkers:'block'});
    const viewer=await clean.newPage();capture(viewer);await viewer.goto(url);
    await viewer.waitForFunction(()=>window.__viewer?.phase==='ready');
    assert.equal(await viewer.evaluate(()=>localStorage.length),0);
    assert.equal(await viewer.evaluate(()=>doc.pages[0].nodes[0].label),'Snapshot A');
    assert.equal(await viewer.evaluate(()=>typeof newNode),'undefined');
    const before=await viewer.evaluate(()=>window.__viewer.view);
    await viewer.locator('#sv').hover();await viewer.mouse.wheel(25,35);
    await viewer.waitForFunction(previous=>window.__viewer.view.x!==previous.x,before);
    await viewer.locator('#btnZoomIn').click();
    assert.notEqual((await viewer.evaluate(()=>window.__viewer.view)).zoom,before.zoom);
    const t=await viewer.evaluate(()=>now());await viewer.waitForTimeout(120);
    assert.ok(await viewer.evaluate(previous=>now()>previous,t));
    await viewer.locator('#btnPresent').click();
    await viewer.locator('#prNext').click();
    assert.equal(await viewer.locator('#prPos').textContent(),'2 / 2');
    await viewer.locator('#prExit').click();
    await viewer.locator('#pgTabs button').first().click();
    await viewer.waitForTimeout(120);
    await viewer.screenshot({path:path.join(require('node:os').tmpdir(),'fluyo-share-viewer.png')});
    const copy=await clean.newPage();capture(copy);
    await copy.goto(url);await copy.waitForFunction(()=>window.__viewer?.phase==='ready');
    await copy.locator('#btnOpen').click();await copy.waitForURL(base+'/#d=*');
    await copy.waitForFunction(()=>typeof newNode==='function' && doc.pages[0].nodes[0]?.label==='Snapshot A');
    await copy.evaluate(()=>{doc.pages[0].nodes[0].label='Copia modificada';scheduleAutosave();});
    assert.equal(await viewer.evaluate(()=>doc.pages[0].nodes[0].label),'Snapshot A');
    console.log('Smoke: crear, confirmar, clipboard, contexto limpio, snapshot, pan, zoom, animación, páginas, Present y copia editable PASS');
    for(const suffix of ['?s=demo','#d=invalid','?s=demo#d=invalid','#d='+new URL(url).hash.slice(3,-8)]){
      const page=await clean.newPage();capture(page);await page.goto(base+'/s/'+suffix);
      await page.waitForFunction(()=>['ready','error'].includes(window.__viewer?.phase));
      assert.equal(await page.evaluate(()=>window.__viewer.phase),suffix==='?s=demo'?'ready':'error');await page.close();
    }
    await editor.evaluate(label=>{doc.pages[0].nodes[0].label=label;},randomBytes(80000).toString('base64'));
    await editor.locator('#btnShare').click();await editor.locator('#shareCreate').click();
    await editor.waitForFunction(()=>document.getElementById('shareMessage').textContent.includes('demasiado grande'));
    assert.equal(await editor.locator('#shareLink').inputValue(),'');
    console.log('Inválido, truncado, sin fallback, demo explícita y tamaño real PASS');
    await editorContext.close();await clean.close();
    const pwa=await browser.newContext();const offlinePage=await pwa.newPage();capture(offlinePage);
    await offlinePage.goto(base+'/');
    await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
    assert.equal(await offlinePage.evaluate(async name=> (await caches.keys()).includes(name),currentCache),true);
    await pwa.setOffline(true);await offlinePage.goto(url);
    await offlinePage.waitForFunction(()=>window.__viewer?.phase==='ready');
    assert.equal(await offlinePage.evaluate(()=>doc.pages[0].nodes[0].label),'Snapshot A');
    assert.equal(await offlinePage.evaluate(async name=>{const cache=await caches.open(name);return (await cache.keys()).some(req=>req.url.includes('#d='));},currentCache),false);
    await pwa.close();console.log('PWA: '+currentCache+' instalada y viewer offline con fragmento autocontenido PASS');
    // Protocolo file real, scripts clásicos y editor funcional.
    const fileContext=await browser.newContext();const filePage=await fileContext.newPage();capture(filePage);
    await filePage.goto(require('node:url').pathToFileURL(path.join(root,'index.html')).href);
    await filePage.locator('#btnShare').click();
    assert.equal(await filePage.locator('#shareCreate').isDisabled(),true);
    assert.match(await filePage.locator('#shareMessage').textContent(),/versión web/);
    await filePage.locator('#shareClose').click();
    await filePage.evaluate(()=>newNode('rect',100,100));
    assert.equal(await filePage.evaluate(()=>P().nodes.length),1);
    await filePage.locator('#btnPresent').click();await filePage.keyboard.press('Escape');
    await fileContext.close();console.log('file://: editor y bloqueo de enlace público PASS');
    assert.ok(process.argv[2],'Se requiere script actual de Umami para la aceptación de privacidad');
    const providerScript=fs.readFileSync(process.argv[2],'utf8');
    const privateContext=await browser.newContext({serviceWorkers:'block'});
    const net=[],analytics=[];
    privateContext.on('request',req=>net.push({url:req.url(),headers:req.headers(),body:req.postData()}));
    await privateContext.route('https://fluyo.space/**',route=>route.fulfill({status:200,...asset(route.request().url())}));
    await privateContext.route('https://cloud.umami.is/script.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:providerScript}));
    await privateContext.route('https://gateway.umami.is/api/send',route=>{
      analytics.push(JSON.parse(route.request().postData()));
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });
    const marker='FLUYO_PRIVATE_MARKER_12345';
    const privateData={version:3,app:'fluyo',doc:{pages:[{name:marker,nodes:[{id:1,label:marker}],edges:[]}]}};
    const payload=Buffer.concat([Buffer.from([0]),Buffer.from(JSON.stringify(privateData))]).toString('base64url');
    const privacyPage=await privateContext.newPage();capture(privacyPage);
    await privacyPage.goto('https://fluyo.space/s/#d='+payload);
    await privacyPage.waitForFunction(()=>window.__viewer?.phase==='ready');
    await privacyPage.waitForFunction(()=>typeof window.umami?.track==='function');
    await privacyPage.waitForTimeout(250);
    assert.equal(analytics.filter(e=>e.payload.name==='share_viewed').length,1);
    await privacyPage.locator('#btnOpen').click();
    await privacyPage.waitForFunction(()=>typeof newNode==='function' && doc.pages[0].nodes[0]?.label==='FLUYO_PRIVATE_MARKER_12345');
    await privacyPage.locator('#btnShare').click();await privacyPage.locator('#shareCreate').click();
    await privacyPage.locator('#shareCopy').waitFor({state:'visible'});
    await privacyPage.waitForTimeout(250);
    for(const event of ['share_created','share_viewed','share_opened_in_editor'])
      assert.equal(analytics.filter(e=>e.payload.name===event).length,1,event);
    // Incluye request inicial real al servidor de localhost con snapshot URL.
    const captured=JSON.stringify({net,initial});
    for(const secret of [marker,payload,'#d=',Buffer.from(marker).toString('base64')]) assert.ok(!captured.includes(secret),'filtración de red');
    for(const event of analytics){
      assert.equal(event.payload.url,'/');assert.equal(event.payload.title,'Fluyo');assert.equal(event.payload.referrer,'');
      if(event.payload.name.startsWith("share_")) assert.equal(event.payload.data,undefined);
    }
    await privateContext.close();
    assert.deepEqual(errors,[]);
    console.log('Privacidad: proveedor Umami real, tres eventos sanitizados, requests/headers/referrer sin marcador, payload ni fragmento PASS');
    console.log('Consola: cero pageerror; sin telemetría enviada al proveedor');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
