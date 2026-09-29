"use strict";
/* Comparación con los mismos defaults visuales: sólo difieren v4 y sus tres
   campos de página. Transportes reales v1/v0, sin tocar documento ni schema. */
const assert=require('node:assert/strict');
const {makeViewer,read}=require('./viewer-harness.cjs');
(async()=>{
  const v=makeViewer();
  const fixtures=[
    ['vacío',{version:3,doc:{pages:[{name:'P',nodes:[],edges:[]}]},settings:{}}],
    ['pequeño',{version:3,doc:{pages:[{name:'P',nodes:[{id:1,label:'A'},{id:2,label:'B'}],edges:[{id:3,from:1,to:2}]}]},settings:{}}],
    ['kafka-publicado',JSON.parse(read('ejemplos/data/kafka-event-pipeline.fluyo.json'))]
  ];
  for(const [name,input] of fixtures){
    const normalized=v.context.projectFromProjectData(input);
    const v4={version:4,app:'fluyo',...normalized},v3=JSON.parse(JSON.stringify(v4));v3.version=3;
    for(const p of v3.doc.pages){delete p.behaviors;delete p.scenarios;delete p.nextScenarioId;}
    v.context.qaV3=v3;v.context.qaV4=v4;
    const p3=await v.run('encodeDeepLink(qaV3)'),p4=await v.run('encodeDeepLink(qaV4)');
    const size={case:name,pages:v4.doc.pages.length,jsonUTF8V3:Buffer.byteLength(JSON.stringify(v3)),jsonUTF8V4:Buffer.byteLength(JSON.stringify(v4)),payloadV3:p3.length,payloadV4:p4.length,extraCharacters:p4.length-p3.length,transport:v.run(`base64urlToBytes(${JSON.stringify(p4)})[0]`)};
    console.log(JSON.stringify(size));assert.ok(size.extraCharacters<200*v4.doc.pages.length);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
