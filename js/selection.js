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
/* Pegar y duplicar (FLUYO-018.7a): las dos llaman a cloneStructureIn/duplicateNodesIn (model.js, única autoridad de clonado:
   ids reservados antes de mutar, solo conexiones internas, Behaviors copiados, waypoints desplazados). El editor aporta el
   desplazamiento GRID, el Undo (un snapshot previo, solo si el dominio no falla), la selección y la cascada de `clip`. */
function pasteClip(){
  if(!clip || !clip.nodes.length) return;
  const snap=snapPage();
  const r=cloneStructureIn(P(), clip, {dx:GRID, dy:GRID});      // un fallo (p. ej. id_exhausted) no deja copia parcial ni entrada de Undo
  pushUndoSnapshot(snap);
  selN=new Set(r.nodes.map(x=>x.id)); selE=new Set(r.connections.map(x=>x.id));
  // cascada en pegados sucesivos
  clip.nodes.forEach(n=>{n.x+=GRID; n.y+=GRID;});
  clip.edges.forEach(e=>(e.waypoints||[]).forEach(w=>{w.x+=GRID; w.y+=GRID;}));
  refreshPanel();
}
/* Ctrl+D / «Duplicar»: sin pasar por el portapapeles (ni el interno ni el del sistema). Una sola entrada de Undo. */
function dupSel(){
  if(!selN.size) return;
  const snap=snapPage();
  let r;
  try{ r=duplicateNodesIn(P(), [...selN], {dx:GRID, dy:GRID}); }
  catch(err){ if(err && typeof err.code==="string" && err.code!=="id_exhausted") return; throw err; }
  pushUndoSnapshot(snap);
  selN=new Set(r.nodes.map(x=>x.id)); selE=new Set(r.connections.map(x=>x.id));
  refreshPanel();
}
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

/* ---- orden Z (traer al frente / enviar al fondo) ----
   FLUYO-018.7a: la semántica es reorderNodesIn (model.js); aquí solo Undo y autoguardado. Sin cambio no hay entrada de Undo. */
function reorderSelection(placement){
  if(!selN.size) return;
  const ids=[...selN];
  let plan;
  try{ plan=reorderedNodeIds(P(), ids, placement); }
  catch(err){ if(err && typeof err.code==="string") return; throw err; }
  if(plan.every((id,i)=>id===P().nodes[i].id)) return;
  pushUndo();
  reorderNodesIn(P(), ids, placement);
  scheduleAutosave();
}
function bringToFront(){ reorderSelection("front"); }
function sendToBack(){ reorderSelection("back"); }
function bringForward(){ reorderSelection("forward"); }
function sendBackward(){ reorderSelection("backward"); }

/* ---- eliminar página (FLUYO-018.7c) ----
   Única puerta del editor: la ✕ de la pestaña (ui.js), que solo existe con 2 páginas o más. Política D de 018.7: se confirma SIEMPRE
   y, si la página no está vacía, el diálogo dice qué se pierde (pageRemovalImpactIn, la misma fuente que delete_page de MCP).
   Cancelar no cambia nada (documento, página activa, pilas ni Playback). Aceptar detiene el Playback (decisión 64), elimina con
   deletePageIn (regla de cur del dominio; los EventTypes no se tocan) y deja UNA entrada de Undo que reinserta la misma página. */
const PAGE_DELETE_LIST_MAX=8;
function pageDeleteConfirmMessage(impact){
  const plural=(n,one,many)=>n+" "+(n===1?one:many);
  const parts=[];
  if(impact.nodes) parts.push(plural(impact.nodes,"elemento","elementos"));
  if(impact.connections) parts.push(plural(impact.connections,"conexión","conexiones"));
  if(impact.behaviors) parts.push(plural(impact.behaviors,"condición de disponibilidad inicial","condiciones de disponibilidad inicial"));
  if(impact.stories.length) parts.push(plural(impact.stories.length,"Historia","Historias"));
  if(!parts.length) return `¿Eliminar «${impact.name}»?`;
  const list=parts.length>1 ? parts.slice(0,-1).join(", ")+" y "+parts[parts.length-1] : parts[0];
  const lines=[`La página «${impact.name}» tiene ${list}${impact.stories.length?":":"."}`];
  if(impact.stories.length){
    lines.push("");
    for(const s of impact.stories.slice(0,PAGE_DELETE_LIST_MAX)) lines.push("• "+s.name+" — "+(s.moments ? plural(s.moments,"momento","momentos") : "sin momentos"));
    if(impact.stories.length>PAGE_DELETE_LIST_MAX) lines.push("• …y "+plural(impact.stories.length-PAGE_DELETE_LIST_MAX,"Historia más","Historias más"));
  }
  lines.push("", "Si la eliminas se pierde todo su contenido (puedes deshacerlo con Ctrl+Z). Los eventos de la biblioteca se conservan.", "¿Eliminar la página?");
  return lines.join("\n");
}
function requestDeletePage(index){
  if(doc.pages.length<2 || !doc.pages[index]) return false;
  /* Antes de tocar nada: cancelar no deja entrada de Undo ni detiene el Playback. */
  if(!confirm(pageDeleteConfirmMessage(pageRemovalImpactIn(doc, index)))) return false;
  if(editorFrozen() && typeof scReset==="function") scReset();
  const page=doc.pages[index], curPage=P(), lib=libSnap();
  deletePageIn(doc, index);
  pushUndoSnapshot({kind:"insertPage", page, index, curPage, lib});
  clearSel(); renderTabs();
  return true;
}

/* ---- deshacer / rehacer ----
   FLUYO-018.7c: cada entrada identifica su página por REFERENCIA (el objeto de doc.pages), nunca por índice; borrar o reinsertar
   páginas no puede hacer que una entrada escriba en otra página (F1). Aplicar una entrada devuelve su inversa, que va a la otra pila:
     · {kind:"page", page, data}: contenido de UNA página (nodos, conexiones, Behaviors, Historias). Restaura `data` en esa página y la
       activa; su inversa es la foto actual de la MISMA página (no la de la página activa).
     · {kind:"insertPage", page, index, curPage}: deshace un borrado. Reinserta EL MISMO objeto en `index` (restorePageIn) y vuelve a
       activar la página que estaba activa al borrar. Su inversa es removePage.
     · {kind:"removePage", page}: rehace el borrado con deletePageIn (misma regla de cur). Su inversa es insertPage.
   Como la página restaurada es el mismo objeto, las entradas anteriores de esa página vuelven a ser válidas. Una entrada que ya no
   aplica se descarta sin tocar nada (con pilas LIFO no ocurre; applyProjectData las vacía al cambiar de documento).
   FLUYO-018.7d: TODA entrada lleva además `lib`, la biblioteca de EventTypes tal como estaba (libSnap). stepHistory la restaura en un
   solo sitio para cualquier tipo de entrada, así que crear/editar/eliminar un EventType (que ya hacían pushUndo) se deshace, y deshacer
   el borrado de una página nunca deja Steps apuntando a un EventType que se eliminó después. Fuera de Undo siguen el tema, crear/renombrar
   páginas y la navegación. */
let undoStack=[], redoStack=[], lblDirty=false, fsDirty=false;
/* Biblioteca restaurable: los MISMOS objetos EventType (identidad) y una copia de su contenido. El contador nunca baja. */
function libSnap(){ return Array.isArray(doc.eventTypes) ? {objs:doc.eventTypes.slice(), data:deep(doc.eventTypes), nextEventTypeId:doc.nextEventTypeId} : null; }
function restoreLibrary(lib){
  lib.objs.forEach((et,i)=>{ for(const k of Object.keys(et)) delete et[k]; Object.assign(et, deep(lib.data[i])); });
  doc.eventTypes=lib.objs.slice();
  if(Number.isSafeInteger(lib.nextEventTypeId)) doc.nextEventTypeId=Math.max(doc.nextEventTypeId||0, lib.nextEventTypeId);
}
function pageSnap(pg){ return {kind:"page", page:pg, data:deep(pg), lib:libSnap()}; }
function snapPage(){ return pageSnap(P()); }
function pushUndoSnapshot(s){ undoStack.push(s); if(undoStack.length>60) undoStack.shift(); redoStack.length=0; scheduleAutosave(); }
function pushUndo(){ pushUndoSnapshot(snapPage()); }
function restorePageContent(pg, data){
  const restored=deep(data);
  // Los contadores de identidad nunca bajan: un ID eliminado no se reasigna a una entidad distinta.
  const prevNextId=pg.nextId;
  const prevNextScenarioId=pg.nextScenarioId;
  const prevNextStepIds=new Map((pg.scenarios||[]).map(sc=>[sc.id,sc.nextStepId]));
  pg.nodes=restored.nodes; pg.edges=restored.edges; pg.behaviors=restored.behaviors; pg.scenarios=restored.scenarios;
  pg.nextId=Math.max(prevNextId, restored.nextId);
  pg.nextScenarioId=Math.max(prevNextScenarioId, restored.nextScenarioId);
  for(const sc of pg.scenarios) sc.nextStepId=Math.max(prevNextStepIds.get(sc.id)||1, sc.nextStepId);
}
function applyHistoryEntry(s){
  if(s.kind==="insertPage"){
    if(doc.pages.includes(s.page) || s.index>doc.pages.length) return null;
    restorePageIn(doc, s.index, s.page);
    const c=doc.pages.indexOf(s.curPage); if(c>=0) doc.cur=c;
    return {kind:"removePage", page:s.page};
  }
  const i=doc.pages.indexOf(s.page);
  if(i<0) return null;
  if(s.kind==="removePage"){
    if(doc.pages.length<2) return null;
    const curPage=P();
    deletePageIn(doc, i);
    return {kind:"insertPage", page:s.page, index:i, curPage};
  }
  const inverse=pageSnap(s.page);
  restorePageContent(s.page, s.data);
  doc.cur=i;
  return inverse;
}
function stepHistory(from, to){
  while(from.length){
    const s=from.pop(), lib=libSnap();                                   // la biblioteca ANTES de aplicar: va en la inversa
    const inverse=applyHistoryEntry(s);
    if(!inverse) continue;
    if(s.lib) restoreLibrary(s.lib);
    inverse.lib=lib;
    to.push(inverse);
    clearSel(); renderTabs();
    /* El panel de Escenarios lee el documento: sin esto queda mostrando Scenarios/Steps ya deshechos. */
    if(typeof scRefreshIfVisible==="function") scRefreshIfVisible();
    scheduleAutosave();
    return;
  }
}
function undo(){ stepHistory(undoStack, redoStack); }
function redo(){ stepHistory(redoStack, undoStack); }
