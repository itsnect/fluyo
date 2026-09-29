"use strict";
/* Documentos creados con las fábricas reales del editor, sin assets ni estado
   de prueba agregado al documento. También ejecutable por page.evaluate. */
function buildRealisticEditorDocument(kind){
  doc={theme:'dark',customBg:'',pages:[blankPage('Página 1')],cur:0};
  settings={...DEFAULT_SETTINGS};
  const labels=kind==='tiny'?['Nodo']:kind==='small'?['Cliente','API']:['Producer','Kafka','Consumer','Database'];
  const nodes=labels.map((label,i)=>newNode('rect',160+i*220,200,{label}));
  for(let i=1;i<nodes.length;i++)newEdge(nodes[i-1].id,nodes[i].id,{label:'datos'});
  if(kind==='moderate')newEdge(nodes[2].id,nodes[1].id,{label:'ack',route:'ortho'});
}
module.exports={buildRealisticEditorDocument};
