"use strict";
/* Gate real de navegación entre dos Shares en la misma pestaña.
   NODE_PATH apunta al Playwright del entorno; no añade dependencias del producto. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css'};
const payload=label=>Buffer.concat([Buffer.from([0]),Buffer.from(JSON.stringify({version:3,doc:{pages:[{nodes:[{id:1,label}],edges:[]}]}}))]).toString('base64url');
(async()=>{
  const server=http.createServer((req,res)=>{
    try{
      let rel=new URL(req.url,'http://localhost').pathname;if(rel.endsWith('/'))rel+='index.html';
      const file=path.resolve(root,'.'+rel);assert.ok(file.startsWith(root+path.sep));
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
      res.end(fs.readFileSync(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.FLUYO_BROWSER||'chrome',headless:true});
    const context=await browser.newContext({serviceWorkers:'block'});
    const page=await context.newPage();
    const base='http://127.0.0.1:'+server.address().port;
    const a=payload('Snapshot A'),b=payload('Snapshot B');
    await page.goto(base+'/s/#d='+a);
    await page.waitForFunction(()=>window.__viewer?.phase==='ready');
    await page.goto(base+'/s/#d='+b);
    // Esperar también permite una recarga o revalidación asíncrona del hash.
    await page.waitForTimeout(300);
    const actual=await page.evaluate(()=>doc.pages[0].nodes[0].label);
    const copy=await page.evaluate(()=>buildOpenInFluyoURL(serializeProject(),location.href,viewerPayload));
    console.log(JSON.stringify({expected:'Snapshot B',actual,copyMatchesB:copy===base+'/#d='+b}));
    assert.equal(actual,'Snapshot B','La URL B debe mostrar el snapshot B');
    assert.equal(copy,base+'/#d='+b,'El CTA debe copiar el snapshot de la URL actual');
  }finally{
    await browser?.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
