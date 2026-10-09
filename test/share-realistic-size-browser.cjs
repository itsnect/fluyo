"use strict";
/* Gate bloqueante de tamaños por el botón real; sólo registra tamaños/estado.
   node test/share-realistic-size-browser.cjs [--production]
   Umami bloqueado: no envía telemetría de los documentos de diagnóstico. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {buildRealisticEditorDocument}=require('./realistic-share-fixtures.cjs');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json'};
(async()=>{
  const production=process.argv.includes('--production');
  const server=http.createServer((req,res)=>{
    try{
      let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';
      const file=path.resolve(root,'.'+name);assert.ok(file.startsWith(root+path.sep));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
    }catch{res.writeHead(404);res.end();}
  });
  if(!production)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=production?'https://fluyo.space':'http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:process.env.FLUYO_BROWSER||'chrome',headless:true});
  try{
    const context=await browser.newContext({serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
    await context.route(/https:\/\/(?:cloud|gateway)\.umami\.is\//,route=>route.abort());
    const editor=await context.newPage();const errors=[];editor.on('pageerror',e=>errors.push(e.name));
    await editor.goto(base+'/');await editor.waitForFunction(()=>typeof confirmShare==='function');
    for(const kind of ['tiny','small','moderate']){
      await editor.evaluate(buildRealisticEditorDocument,kind);
      if (await editor.evaluate(() => { const m = document.getElementById("moreMenu"); return !!m && m.hidden && !!document.getElementById("btnJsonOut").closest("#moreMenu"); })) await editor.locator("#btnMore").click(); /* 018.14b: «Guardar» vive en «Más» */
      const [download]=await Promise.all([editor.waitForEvent('download'),editor.locator('#btnJsonOut').click()]);
      const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      await editor.evaluate(()=>{
        window.__shareDiagnostic={};
        window.__originalSizeEncoder=encodeDeepLink;
        encodeDeepLink=async project=>{
          window.__shareCanonical=JSON.parse(JSON.stringify(project));
          const json=JSON.stringify(project),bytes=new TextEncoder().encode(json);
          Object.assign(window.__shareDiagnostic,{jsonCharacters:json.length,jsonUTF8Bytes:bytes.length});
          const payload=await window.__originalSizeEncoder(project);
          const transport=base64urlToBytes(payload);
          Object.assign(window.__shareDiagnostic,{transportVersion:transport[0],compressedBytes:transport.length-1,payloadCharacters:payload.length});
          return payload;
        };
      });
      await editor.locator('#btnShare').click();await editor.locator('#shareCreate').click();
      await editor.waitForFunction(()=>!shareBusy);
      const result=await editor.evaluate(()=>({sizes:window.__shareDiagnostic,url:document.getElementById('shareLink').value,message:document.getElementById('shareMessage').textContent,canonical:window.__shareCanonical,limit:MAX_SHARE_URL_LENGTH}));
      console.log(JSON.stringify({environment:production?'production':'local',case:kind,...result.sizes,finalURLCharacters:result.url.length,success:!!result.url,fileEqualsShare:JSON.stringify(saved)===JSON.stringify(result.canonical)}));
      assert.ok(result.url,'Share real debe crear enlace: '+result.message);
      assert.ok(result.url.length<result.limit/8,'Margen holgado para documento real sin assets');
      assert.deepEqual(result.canonical,saved,'Guardar y snapshot Share deben ser equivalentes');
      await editor.locator('#shareCopy').click();assert.equal(await editor.evaluate(()=>navigator.clipboard.readText()),result.url);
      await editor.evaluate(()=>{encodeDeepLink=window.__originalSizeEncoder;delete window.__originalSizeEncoder;delete window.__shareCanonical;delete window.__shareDiagnostic;});
      await editor.locator('#shareClose').click();
      const clean=await browser.newContext({serviceWorkers:'block'});
      await clean.route(/https:\/\/(?:cloud|gateway)\.umami\.is\//,route=>route.abort());
      const viewer=await clean.newPage();await viewer.goto(result.url);await viewer.waitForFunction(()=>window.__viewer?.phase==='ready');
      assert.equal(await viewer.evaluate(()=>doc.pages[0].nodes.length),saved.doc.pages[0].nodes.length);
      await viewer.locator('#btnOpen').click();await viewer.waitForURL(base+'/#d='+new URL(result.url).hash.slice(3));
      await viewer.waitForFunction(()=>typeof newNode==='function');
      assert.deepEqual(await viewer.evaluate(()=>serializeProject()),saved);
      await clean.close();
    }
    assert.deepEqual(errors,[]);await context.close();
    console.log('Realistic share size: Tiny/Small/Moderate → clipboard → contexto limpio → viewer → copia editable PASS');
  }finally{await browser.close();if(!production)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
