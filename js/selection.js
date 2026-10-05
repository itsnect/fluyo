"use strict";
/* Selección, portapapeles y deshacer/rehacer */

/* ---- selección ---- */
function clearSel(){ selN.clear(); selE.clear(); refreshPanel(); }
function selectOnly(type,id){ selN.clear(); selE.clear(); (type==="node"?selN:selE).add(id); refreshPanel(); }
function toggleSel(type,id){ const s=type==="node"?selN:selE; s.has(id)?s.delete(id):s.add(id); refreshPanel(); }
function singleSel(){
  if(selN.size===1 && selE.size===0) return {type:"node", obj:nodeById([...selN][0])};
  if(selE.size===1 && selN.size===0) return {type:"edge", obj:edgeById([...selE][0])};
  return null;
}
/* Con ratón las flechas de conexión salen al pasar por encima de un nodo. En
   táctil no existe el «pasar por encima»: sin esto no habría ninguna forma de
   conectar dos cajas con el dedo. Por eso el nodo seleccionado también las
   muestra — que además es lo que hacen draw.io o Figma.

   Vive aquí porque los gestos y el runtime del editor comparten esta única
   resolución; el modelo y el renderer read-only no conocen esta regla. */
function arrowHostNode(){
  const s=singleSel();
  const n=hoverNode || ((s && s.type==="node") ? s.obj : null);
  /* hoverNode sobrevive a un cambio de página o a cargar un ejemplo: sin esta
     comprobación se pintarían flechas de un nodo que ya no está en el lienzo. */
  return (n && P().nodes.includes(n)) ? n : null;
}
function selectAll(){
  selN=new Set(P().nodes.map(n=>n.id));
  selE=new Set(P().edges.map(e=>e.id));
  refreshPanel();
}

/* ---- portapapeles ---- */
function copySel(){
  if(!selN.size && !selE.size) return;
  const ns=P().nodes.filter(n=>selN.has(n.id)).map(deep);
  const ids=new Set(ns.map(n=>n.id));
  const es=P().edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(deep);
  const behaviors=(P().behaviors||[]).filter(b=>ids.has(b.nodeId)).map(deep);
  clip={nodes:ns, edges:es, behaviors};
  // marca el portapapeles del sistema para que Ctrl+V priorice las formas
  try{ navigator.clipboard.writeText("fluyo::"+JSON.stringify(clip)).catch(()=>{}); }catch(e){}
}
/* Durante el Playback (en marcha o terminado, hasta «Volver a editar») el documento está congelado: borrar y cortar no actúan, sea cual
   sea la vía (tecla, botón del panel, menú contextual, papelera táctil). La guarda vive aquí, en la única puerta de borrado. */
function editorFrozen(){ return typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive(); }
function cutSel(){ if(editorFrozen()) return; copySel(); deleteSel(); }
function pasteClip(){
  if(!clip || !clip.nodes.length) return;
  // Reservar el lote antes de cambiar selección/estructura: agotamiento no
  // puede dejar un pegado parcial ni IDs inseguros.
  let nextId=reserveStructureIds(P(),clip.nodes.length+clip.edges.length);
  pushUndo();
  const map={};
  selN.clear(); selE.clear();
  clip.nodes.forEach(n=>{
    const c=deep(n); map[n.id]=c.id=nextId++;
    c.x+=GRID; c.y+=GRID; c.order=P().nodes.length;
    P().nodes.push(c); selN.add(c.id);
  });
  clip.edges.forEach(e=>{
    const c=deep(e); c.id=nextId++;
    c.from=map[e.from]; c.to=map[e.to];
    (c.waypoints||[]).forEach(w=>{w.x+=GRID; w.y+=GRID;});
    P().edges.push(c); selE.add(c.id);
  });
  for(const b of clip.behaviors||[]){
    if(Object.prototype.hasOwnProperty.call(map,b.nodeId)) P().behaviors.push({...deep(b),nodeId:map[b.nodeId]});
  }
  // cascada en pegados sucesivos
  clip.nodes.forEach(n=>{n.x+=GRID; n.y+=GRID;});
  clip.edges.forEach(e=>(e.waypoints||[]).forEach(w=>{w.x+=GRID; w.y+=GRID;}));
  refreshPanel();
}
function dupSel(){ const keep=clip; copySel(); pasteClip(); clip=keep; }
/* Política de borrado (FLUYO-018.4): si lo que se borra lo usa una Historia, se pide confirmación nombrando Historias y momentos;
   sin impacto se borra al instante. Nunca se modifican Steps ni Historias. El impacto lo calcula FluyoIntegrity.removalImpact
   (la misma detección que el B2 de MCP) sobre una copia de la página activa; sin Historias no hay nada que simular. */
function deleteImpact(nodeIds, edgeIds){
  const pg=P();
  if(typeof FluyoIntegrity==="undefined" || !(pg.scenarios||[]).length) return {stories:[], behaviors:[]};
  const slim=projectToSerializable(Object.assign({}, doc, {pages:[pg], cur:0}), typeof settings!=="undefined" ? settings : {});
  const r=FluyoIntegrity.removalImpact(slim, {pageIndex:0, nodeIds, edgeIds});
  const label=id=>{ const n=nodeById(id); return (n && String(n.label||"").split("\n")[0].trim()) || "Elemento sin nombre"; };
  const targetOf=st=>{
    if(st.action==="SEND"){ const e=edgeById(st.edgeId); return e ? label(e.from)+" → "+label(e.to) : "Conexión"; }
    return label(st.nodeId);
  };
  const stories=r.affectedStories.map(a=>{
    const sc=pg.scenarios.find(x=>x.id===a.storyId);
    const steps=sc ? sc.steps.filter(st=>a.stepIds.includes(st.id)) : [];
    const targets=[]; for(const st of steps){ const t=targetOf(st); if(!targets.includes(t)) targets.push(t); }
    return {storyId:a.storyId, name:a.storyName||"Historia", moments:new Set(steps.map(st=>st.at)).size||a.stepIds.length, targets};
  });
  const gone=new Set(nodeIds);
  return {stories, behaviors:(pg.behaviors||[]).filter(b=>gone.has(b.nodeId)).map(b=>b.nodeId)};
}
function deleteConfirmMessage(impact, nodeCount, edgeCount){
  const many=nodeCount+edgeCount>1;
  const [subject, pron, verb]=many ? ["Esta selección","los","eliminarlos"] : nodeCount ? ["Este elemento","lo","eliminarlo"] : ["Esta conexión","la","eliminarla"];
  const n=impact.stories.length, moments=impact.stories.reduce((t,s)=>t+s.moments,0);
  const lines=[subject+" se usa en "+n+(n===1?" Historia:":" Historias:"), ""];
  for(const s of impact.stories){
    const shown=s.targets.slice(0,3).join(", ")+(s.targets.length>3?"…":"");
    lines.push("• "+s.name+" — "+s.moments+(s.moments===1?" momento":" momentos")+(shown?" ("+shown+")":""));
  }
  lines.push("", "Si "+pron+" eliminas, "+(moments===1?"ese momento dejará":"esos momentos dejarán")+" de funcionar.");
  if(impact.behaviors.length) lines.push(impact.behaviors.length===1 ? "También se eliminará su condición de disponibilidad inicial." : "También se eliminarán sus condiciones de disponibilidad inicial.");
  lines.push("¿Quieres "+verb+" de todas formas?");
  return lines.join("\n");
}
function deleteSel(){
  if(editorFrozen() || (!selN.size && !selE.size)) return;
  const nodeIds=[...selN], edgeIds=[...selE];
  const impact=deleteImpact(nodeIds, edgeIds);
  /* Antes de pushUndo: cancelar no cambia nada ni deja entrada de Undo. */
  if(impact.stories.length && !confirm(deleteConfirmMessage(impact, nodeIds.length, edgeIds.length))) return;
  pushUndo();
  // Autoridad de dominio (model.js): quita las conexiones elegidas y, con cada nodo, sus conexiones y su Behavior (el Undo los
  // restaura: el snapshot incluye behaviors y scenarios). El editor NO toca Steps ni Historias.
  removeEdges(edgeIds);
  removeNodes(nodeIds);
  clearSel();
}

/* ---- orden Z (traer al frente / enviar al fondo) ---- */
function bringToFront(){
  if(!selN.size) return;
  pushUndo();
  const sel=P().nodes.filter(n=>selN.has(n.id));
  P().nodes=P().nodes.filter(n=>!selN.has(n.id)).concat(sel);
  scheduleAutosave();
}
function sendToBack(){
  if(!selN.size) return;
  pushUndo();
  const sel=P().nodes.filter(n=>selN.has(n.id));
  P().nodes=sel.concat(P().nodes.filter(n=>!selN.has(n.id)));
  scheduleAutosave();
}
function bringForward(){
  if(!selN.size) return;
  pushUndo();
  const ns=P().nodes;
  for(let i=ns.length-2;i>=0;i--){
    if(selN.has(ns[i].id) && !selN.has(ns[i+1].id)){ [ns[i],ns[i+1]]=[ns[i+1],ns[i]]; }
  }
  scheduleAutosave();
}
function sendBackward(){
  if(!selN.size) return;
  pushUndo();
  const ns=P().nodes;
  for(let i=1;i<ns.length;i++){
    if(selN.has(ns[i].id) && !selN.has(ns[i-1].id)){ [ns[i],ns[i-1]]=[ns[i-1],ns[i]]; }
  }
  scheduleAutosave();
}

/* ---- deshacer / rehacer ---- */
let undoStack=[], redoStack=[], lblDirty=false, fsDirty=false;
function snapPage(){ return {pi:doc.cur, data:deep(P())}; }
function pushUndo(){ undoStack.push(snapPage()); if(undoStack.length>60) undoStack.shift(); redoStack.length=0; scheduleAutosave(); }
function applySnap(s){
  doc.cur=clamp(s.pi,0,doc.pages.length-1);
  const pg=P();
  const restored=deep(s.data);
  // Los contadores de identidad nunca bajan: un ID eliminado no se reasigna a una entidad distinta.
  const prevNextId=pg.nextId;
  const prevNextScenarioId=pg.nextScenarioId;
  const prevNextStepIds=new Map((pg.scenarios||[]).map(sc=>[sc.id,sc.nextStepId]));
  pg.nodes=restored.nodes; pg.edges=restored.edges; pg.behaviors=restored.behaviors; pg.scenarios=restored.scenarios;
  pg.nextId=Math.max(prevNextId, restored.nextId);
  pg.nextScenarioId=Math.max(prevNextScenarioId, restored.nextScenarioId);
  for(const sc of pg.scenarios) sc.nextStepId=Math.max(prevNextStepIds.get(sc.id)||1, sc.nextStepId);
  clearSel(); renderTabs();
  /* El panel de Escenarios lee el documento: sin esto queda mostrando Scenarios/Steps ya deshechos. */
  if(typeof scRefreshIfVisible==="function") scRefreshIfVisible();
}
function undo(){ if(!undoStack.length) return; redoStack.push(snapPage()); applySnap(undoStack.pop()); scheduleAutosave(); }
function redo(){ if(!redoStack.length) return; undoStack.push(snapPage()); applySnap(redoStack.pop()); scheduleAutosave(); }
