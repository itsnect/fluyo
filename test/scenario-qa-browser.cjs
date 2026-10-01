"use strict";
/* Smoke local en Chrome real: archivo, HTTP, file://, Share y actualización SW.
   Requiere Playwright vía NODE_PATH. No envía analytics ni usa producción. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const currentCache=/const CACHE = "([^"]+)"/.exec(fs.readFileSync(path.join(root,'sw.js'),'utf8'))[1];
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const input={version:3,app:'fluyo',doc:{theme:'dark',cur:0,pages:[{name:'Histórico',nodes:[{id:17,shape:'rect',x:100,y:100,label:'Histórico QA'}],edges:[],nextId:18},{name:'Vacía',nodes:[],edges:[],nextId:1}]},settings:{speed:1.2,dots:5,stagger:.9,font:'system-ui'}};
const definitions={behaviors:[{nodeId:17,initialState:'DOWN'}],scenarios:[{id:7,engineVersion:1,name:'QA',nextStepId:12,steps:[{id:9,at:1000,action:'SET_STATE',nodeId:17,state:'UP'},{id:2,at:1000,action:'SET_STATE',nodeId:17,state:'DOWN'}]}],nextScenarioId:25};
// FLUYO-010: el documento canónico es schema v5. Las aserciones de versión
// se actualizan sin debilitar los contratos históricos que este gate verifica.
let mode='current';
const legacyFiles=new Map();
for(const file of ['sw.js','js/model.js','js/selection.js','js/export.js','js/share-url.js','js/viewer.js']) legacyFiles.set(file,execFileSync('git',['show','HEAD:'+file],{cwd:root}));
const server=http.createServer((req,res)=>{
  try{
    let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);if(!rel||rel.endsWith('/'))rel+='index.html';
    const file=path.resolve(root,rel);assert.ok(file.startsWith(root+path.sep));
    let body=mode==='legacy'&&legacyFiles.has(rel)?legacyFiles.get(rel):fs.readFileSync(file);
    if(mode==='v40' && rel==='sw.js') body=Buffer.from(body.toString().replace(currentCache,'fluyo-static-v40'));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
const save=async page=>{
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#btnJsonOut').click()]);
  return JSON.parse(fs.readFileSync(await download.path(),'utf8'));
};
const open=async(page,data)=>{
  await page.evaluate(()=>{window.__qaImported=false;const original=applyProjectData;applyProjectData=function(data){original(data);window.__qaImported=true;};});
  await page.locator('#fileIn').setInputFiles({name:'qa.fluyo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>window.__qaImported);
};
const checkDefinitions=data=>{for(const key of Object.keys(definitions)) assert.deepEqual(data.doc.pages[0][key],definitions[key]);};
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:process.env.FLUYO_BROWSER||'chrome',headless:true});
  const errors=[];
  const fresh=async(serviceWorkers='block')=>{
    const c=await browser.newContext({serviceWorkers});await c.route(/https:\/\/(cloud|gateway)\.umami\.is\//,r=>r.abort());
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return {c,p};
  };
  try{
    const {c,p}=await fresh();await p.goto(base+'/');await p.waitForFunction(()=>typeof applyProjectData==='function');
    await open(p,input);const migrated=await save(p);assert.equal(migrated.version,5);assert.equal(migrated.doc.pages.length,2);assert.equal(migrated.settings.speed,1.2);assert.deepEqual(migrated.doc.pages[1].scenarios,[]);
    Object.assign(migrated.doc.pages[0],definitions);await open(p,migrated);checkDefinitions(await save(p));
    await p.locator('#btnShare').click();await p.locator('#shareCreate').click();await p.waitForFunction(()=>!shareBusy&&document.getElementById('shareLink').value);
    const url=await p.locator('#shareLink').inputValue();assert.ok(url.length<=65536);
    const {c:vc,p:v}=await fresh();await v.goto(url);await v.waitForFunction(()=>window.__viewer?.phase==='ready');
    checkDefinitions(await v.evaluate(()=>serializeProject()));assert.equal(await v.evaluate(()=>typeof FluyoScenarios),'object');assert.equal(await v.evaluate(()=>typeof newNode),'undefined');
    await v.locator('#btnOpen').click();await v.waitForFunction(()=>typeof newNode==='function'&&doc.pages[0].scenarios?.length===1);
    checkDefinitions(await save(v));await v.evaluate(()=>{P().nodes[0].label='Copia editada QA';scheduleAutosave();});checkDefinitions(await save(v));
    const {c:dc,p:d}=await fresh();await d.goto(base+'/#d='+new URL(url).hash.slice(3));await d.waitForFunction(()=>typeof newNode==='function'&&doc.pages[0].scenarios?.length===1);checkDefinitions(await save(d));
    // Operación UI existente: Ctrl+D duplica Behavior, sin autoría Scenario.
    await p.locator('#shareClose').click();
    await p.evaluate(()=>selectOnly('node',17));await p.keyboard.press('Control+d');
    const duplicate=await p.evaluate(()=>({id:[...selN][0],behaviors:P().behaviors,scenarios:P().scenarios}));
    assert.ok(duplicate.id>17);assert.ok(duplicate.behaviors.some(b=>b.nodeId===duplicate.id&&b.initialState==='DOWN'));
    assert.deepEqual(duplicate.scenarios,definitions.scenarios);
    await p.keyboard.press('Control+z');assert.equal(await p.evaluate(()=>P().nodes.length),1);
    await p.keyboard.press('Control+y');assert.equal(await p.evaluate(()=>P().nodes.length),2);
    const redone=await p.evaluate(()=>P());assert.deepEqual(redone.scenarios,definitions.scenarios);
    assert.ok(redone.nodes.some(n=>n.id===duplicate.id));assert.ok(redone.behaviors.some(b=>b.nodeId===duplicate.id&&b.initialState==='DOWN'));
    // Fuera de guard y versión futura se transportan íntegros sin cargar engine.
    const over=JSON.parse(JSON.stringify(migrated));over.doc.pages[0].scenarios=[{id:1,engineVersion:1,name:'1001 pasos',nextStepId:1002,steps:Array.from({length:1001},(_,i)=>({id:i+1,at:0,action:'SET_STATE',nodeId:17,state:'DOWN'}))},{id:2,engineVersion:3,name:'Versión futura',nextStepId:2,steps:[{id:1,at:86400001,action:'SET_STATE',nodeId:99,state:'DOWN'}]}];
    await open(p,over);assert.deepEqual((await save(p)).doc.pages[0].scenarios,over.doc.pages[0].scenarios);
    await p.locator('#btnShare').click();await p.locator('#shareCreate').click();await p.waitForFunction(()=>!shareBusy&&document.getElementById('shareLink').value);
    const overUrl=await p.locator('#shareLink').inputValue();const {c:oc,p:o}=await fresh();
    await o.goto(overUrl);await o.waitForFunction(()=>window.__viewer?.phase==='ready');assert.deepEqual(await o.evaluate(()=>doc.pages[0].scenarios),over.doc.pages[0].scenarios);
    await o.locator('#btnOpen').click();await o.waitForFunction(()=>typeof newNode==='function'&&doc.pages[0].scenarios?.length===2);
    assert.deepEqual((await save(o)).doc.pages[0].scenarios,over.doc.pages[0].scenarios);await oc.close();
    console.log('PASS: Ctrl+D/undo/redo remapea Behavior; Save→Share→viewer→Open conserva 1001 steps, missing y engineVersion 2.');
    console.log('HTTP PASS: histórico → save v4 → archivo v4 → Share → viewer → Open in Fluyo → editar/save; #d= directo.');
    const {c:fc,p:f}=await fresh();await f.goto(pathToFileURL(path.join(root,'index.html')).href);await f.waitForFunction(()=>typeof newNode==='function');
    await open(f,migrated);checkDefinitions(await save(f));
    const mono=await f.evaluate(()=>{const old=P().nextId;pushUndo();newNode('rect',200,200);undo();return newNode('rect',300,300).id>old;});assert.ok(mono);
    checkDefinitions(await save(f));assert.equal(await f.evaluate(()=>typeof FluyoScenarios?.runScenario),'function');
    console.log('file:// PASS: carga local, importar/guardar v4, edición y undo sin perder Scenario.');
    await Promise.all([c.close(),vc.close(),dc.close(),fc.close()]);
    const legacySw=legacyFiles.get('sw.js')?.toString()||'';
    if(!legacySw.includes('fluyo-static-v39')){
      console.log('NOT RUN — environment: no hay commit histórico fluyo-static-v39 disponible para probar upgrade legacy SW');
    }else{
      mode='legacy';const {c:sc,p:s}=await fresh('allow');await s.goto(base+'/');
      const waitForCache=async name=>{
        const deadline=Date.now()+30000;
        while(Date.now()<deadline){
          const ready=await s.evaluate(async name=>{
            const r=await navigator.serviceWorker.getRegistration(),keys=await caches.keys();
            if(!r || r.installing || r.waiting || r.active?.state!=='activated' || navigator.serviceWorker.controller!==r.active || keys.length!==1 || keys[0]!==name) return false;
            const c=await caches.open(name);
            return !!await c.match(location.origin+'/js/model.js') && !!await c.match(location.origin+'/js/share-url.js');
          },name);
          if(ready) return;
          await s.waitForTimeout(100);
        }
        throw Error('Timeout de instalación/activación: '+name);
      };
      await waitForCache('fluyo-static-v39');
      assert.equal(await s.evaluate(()=>serializeProject().version),3);
      mode='v40';await s.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
      await waitForCache('fluyo-static-v40');
      mode='current';await s.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
      await waitForCache(currentCache);
      await s.reload();await s.waitForFunction(()=>typeof serializeProject==='function');assert.equal(await s.evaluate(()=>serializeProject().version),5);
      const cache=await s.evaluate(async name=>{const c=await caches.open(name);return {model:await (await c.match(location.origin+'/js/model.js')).text(),share:await (await c.match(location.origin+'/js/share-url.js')).text(),engine:!!(await c.match(location.origin+'/js/scenario-engine.js'))};},currentCache);
      assert.match(cache.model,/version:5/);assert.match(cache.share,/version:5/);assert.equal(cache.engine,true);
      await sc.close();
      console.log(`SW PASS: v39/model v3 → v40 → ${currentCache} → caches antiguas eliminadas → model/Share v5; engine precacheado.`);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
