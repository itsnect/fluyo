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
/* Nodo que enseña el puerto de conectar (FLUYO-018.16): el que está bajo el ratón,
   y nada más. Antes también el seleccionado —era la única vía táctil y la que usan
   draw.io o Figma—, pero junto al marco de selección las cuatro flechas se leían
   como tiradores de redimensionar. Desde 018.12 el dedo conecta con «Conectar» de
   la barra táctil, así que en táctil no hay puerto (isTouch, js/interaction.js, se
   carga después: de ahí el typeof).

   Vive aquí porque los gestos y el runtime del editor comparten esta única
   resolución; el modelo y el renderer read-only no conocen esta regla. */
function arrowHostNode(){
  if(typeof isTouch==="function" && isTouch()) return null;
  const n=hoverNode;
  /* hoverNode sobrevive a un cambio de página o a cargar un ejemplo: sin esta
     comprobación se pintaría el puerto de un nodo que ya no está en el lienzo. */
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
  let r;
  /* Un fallo no deja copia parcial ni entrada de Undo. Un portapapeles que el documento no podría volver a leer (un `fluyo::` de otra
     versión con un estado desconocido; SCENARIOS-SEMANTICS-001 FASE 6, B1) no pega nada, como dupSel; id_exhausted se propaga. */
  try{ r=cloneStructureIn(P(), clip, {dx:GRID, dy:GRID}); }
  catch(err){ if(err && typeof err.code==="string" && err.code!=="id_exhausted") return; throw err; }
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
  const label=id=>{ const n=nodeById(id); return (n && String(n.label||"").split("\n")[0].trim()) || FluyoI18n.t("story.unnamed","Elemento sin nombre"); };
  const targetOf=st=>{
    if(st.action==="SEND"){ const e=edgeById(st.edgeId), t=traversalEnds(e, st.reverse); return e ? label(t.source)+" → "+label(t.target) : FluyoI18n.t("confirm.delete.edgeFallback","Conexión"); }
    return label(st.nodeId);
  };
  const stories=r.affectedStories.map(a=>{
    const sc=pg.scenarios.find(x=>x.id===a.storyId);
    const steps=sc ? sc.steps.filter(st=>a.stepIds.includes(st.id)) : [];
    const targets=[]; for(const st of steps){ const t=targetOf(st); if(!targets.includes(t)) targets.push(t); }
    return {storyId:a.storyId, name:a.storyName||FluyoI18n.t("story.group","Historia"), moments:new Set(steps.map(st=>st.at)).size||a.stepIds.length, targets};
  });
  const gone=new Set(nodeIds);
  return {stories, behaviors:(pg.behaviors||[]).filter(b=>gone.has(b.nodeId)).map(b=>b.nodeId)};
}
/* FLUYO-I18N-002 S2a (decisión 280): cada línea es UNA frase completa por sujeto (selección, elemento o conexión: en español
   concuerdan pronombre y verbo), con su plural; la lista de destinos se une con el separador del idioma. Nada se pega a mano. */
function deleteConfirmMessage(impact, nodeCount, edgeCount){
  const who=nodeCount+edgeCount>1 ? "selection" : nodeCount ? "element" : "connection";
  const n=impact.stories.length, moments=impact.stories.reduce((t,s)=>t+s.moments,0);
  const usedBy={
    selection:()=>FluyoI18n.t("confirm.delete.usedBySelection",{one:"Esta selección se usa en {count} Historia:", other:"Esta selección se usa en {count} Historias:"},{count:n}),
    element:()=>FluyoI18n.t("confirm.delete.usedByElement",{one:"Este elemento se usa en {count} Historia:", other:"Este elemento se usa en {count} Historias:"},{count:n}),
    connection:()=>FluyoI18n.t("confirm.delete.usedByConnection",{one:"Esta conexión se usa en {count} Historia:", other:"Esta conexión se usa en {count} Historias:"},{count:n})
  }[who];
  const lines=[usedBy(), ""];
  for(const s of impact.stories){
    const shown=s.targets.length ? s.targets.slice(0,3).join(FluyoI18n.t("list.sep",", "))+(s.targets.length>3?"…":"") : "";
    const count=FluyoI18n.t("confirm.delete.moments",{one:"{count} momento", other:"{count} momentos"},{count:s.moments});
    lines.push(shown ? FluyoI18n.t("confirm.delete.storyLineTargets","• {name} — {moments} ({targets})",{name:s.name, moments:count, targets:shown})
                     : FluyoI18n.t("confirm.delete.storyLine","• {name} — {moments}",{name:s.name, moments:count}));
  }
  const stop={
    selection:()=>FluyoI18n.t("confirm.delete.stopSelection",{one:"Si los eliminas, ese momento dejará de funcionar.", other:"Si los eliminas, esos momentos dejarán de funcionar."},{count:moments}),
    element:()=>FluyoI18n.t("confirm.delete.stopElement",{one:"Si lo eliminas, ese momento dejará de funcionar.", other:"Si lo eliminas, esos momentos dejarán de funcionar."},{count:moments}),
    connection:()=>FluyoI18n.t("confirm.delete.stopConnection",{one:"Si la eliminas, ese momento dejará de funcionar.", other:"Si la eliminas, esos momentos dejarán de funcionar."},{count:moments})
  }[who];
  lines.push("", stop());
  if(impact.behaviors.length) lines.push(FluyoI18n.t("confirm.delete.behaviors",{one:"También se eliminará su condición de disponibilidad inicial.", other:"También se eliminarán sus condiciones de disponibilidad inicial."},{count:impact.behaviors.length}));
  lines.push({
    selection:()=>FluyoI18n.t("confirm.delete.askSelection","¿Quieres eliminarlos de todas formas?"),
    element:()=>FluyoI18n.t("confirm.delete.askElement","¿Quieres eliminarlo de todas formas?"),
    connection:()=>FluyoI18n.t("confirm.delete.askConnection","¿Quieres eliminarla de todas formas?")
  }[who]());
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
/* FLUYO-I18N-002 S2a (decisión 280): el recuento es una lista de piezas nominales completas («3 elementos», «1 Historia»), unida con
   Intl.ListFormat en el idioma de la frase que la contiene; ninguna pieza se pega a mano. */
function pageDeleteConfirmMessage(impact){
  const parts=[];
  if(impact.nodes) parts.push(FluyoI18n.t("count.elements",{one:"{count} elemento", other:"{count} elementos"},{count:impact.nodes}));
  if(impact.connections) parts.push(FluyoI18n.t("count.connections",{one:"{count} conexión", other:"{count} conexiones"},{count:impact.connections}));
  if(impact.behaviors) parts.push(FluyoI18n.t("count.behaviors",{one:"{count} condición de disponibilidad inicial", other:"{count} condiciones de disponibilidad inicial"},{count:impact.behaviors}));
  if(impact.stories.length) parts.push(FluyoI18n.t("count.stories",{one:"{count} Historia", other:"{count} Historias"},{count:impact.stories.length}));
  if(!parts.length) return FluyoI18n.t("confirm.page.ask","¿Eliminar «{name}»?",{name:impact.name});
  const withStories=!!impact.stories.length;
  const list=FluyoI18n.list(parts, withStories ? "confirm.page.hasStories" : "confirm.page.has");
  const lines=[withStories ? FluyoI18n.t("confirm.page.hasStories","La página «{name}» tiene {list}:",{name:impact.name, list}) : FluyoI18n.t("confirm.page.has","La página «{name}» tiene {list}.",{name:impact.name, list})];
  if(withStories){
    lines.push("");
    for(const s of impact.stories.slice(0,PAGE_DELETE_LIST_MAX)) lines.push(FluyoI18n.t("confirm.delete.storyLine","• {name} — {moments}",{name:s.name, moments:s.moments ? FluyoI18n.t("confirm.delete.moments",{one:"{count} momento", other:"{count} momentos"},{count:s.moments}) : FluyoI18n.t("confirm.page.noMoments","sin momentos")}));
    if(impact.stories.length>PAGE_DELETE_LIST_MAX) lines.push(FluyoI18n.t("confirm.page.more",{one:"• …y {count} Historia más", other:"• …y {count} Historias más"},{count:impact.stories.length-PAGE_DELETE_LIST_MAX}));
  }
  lines.push("", FluyoI18n.t("confirm.page.loss","Si la eliminas se pierde todo su contenido (puedes deshacerlo con Ctrl+Z). Los eventos de la biblioteca se conservan."), FluyoI18n.t("confirm.page.askPage","¿Eliminar la página?"));
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
let undoStack=[], redoStack=[], lblDirty=false, fsDirty=false, kwDirty=false, dotsDirty=false;
/* Biblioteca restaurable: los MISMOS objetos EventType (identidad) y una copia de su contenido. El contador nunca baja. */
function libSnap(){ return Array.isArray(doc.eventTypes) ? {objs:doc.eventTypes.slice(), data:deep(doc.eventTypes), nextEventTypeId:doc.nextEventTypeId} : null; }
function restoreLibrary(lib){
  lib.objs.forEach((et,i)=>{ for(const k of Object.keys(et)) delete et[k]; Object.assign(et, deep(lib.data[i])); });
  doc.eventTypes=lib.objs.slice();
  if(Number.isSafeInteger(lib.nextEventTypeId)) doc.nextEventTypeId=Math.max(doc.nextEventTypeId||0, lib.nextEventTypeId);
}
function pageSnap(pg){ return {kind:"page", page:pg, data:deep(pg), lib:libSnap()}; }
function snapPage(){ return pageSnap(P()); }
/* FLUYO-018.24: cada entrada recuerda qué estaba seleccionado cuando se creó (`sel`, ids de la página activa). Es estado de la UI en
   memoria —las pilas no se guardan—, no del documento. */
function selSnap(){ return {n:[...selN], e:[...selE]}; }
function pushUndoSnapshot(s){ if(!s.sel) s.sel=selSnap(); undoStack.push(s); if(undoStack.length>60) undoStack.shift(); redoStack.length=0; scheduleAutosave(); }
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
/* FLUYO-018.24 — Deshacer sin perder el contexto. Tras aplicar una entrada en la MISMA página:
   · con selección: se conservan los ids que siguen existiendo; si la operación quitó todos, no queda nada seleccionado;
   · sin selección (p. ej. justo después de eliminar): vuelve la que había cuando se creó la entrada (`sel`), filtrada igual.
   Si la entrada cambia de página, la selección no es de esta página: se limpia como antes. Solo cambia la selección (y, por
   refreshPanel, la hoja móvil, que sigue abierta mientras quede algo seleccionado): el documento y las pilas, igual que antes. */
function restoreSelAfterHistory(keep, recorded){
  const live=(ids, has)=>(ids||[]).filter(id=>has(id));
  const pick=(q)=>({n:live(q&&q.n, nodeById), e:live(q&&q.e, edgeById)});
  let next={n:[], e:[]};
  if(keep && (keep.n.length || keep.e.length)) next=pick(keep);
  else if(keep && recorded) next=pick(recorded);
  selN.clear(); selE.clear();
  next.n.forEach(id=>selN.add(id)); next.e.forEach(id=>selE.add(id));
  refreshPanel();
}
function stepHistory(from, to){
  while(from.length){
    const s=from.pop(), lib=libSnap();                                   // la biblioteca ANTES de aplicar: va en la inversa
    const was=P(), keep=selSnap();                                       // la página y la selección ANTES de aplicar
    const inverse=applyHistoryEntry(s);
    if(!inverse) continue;
    if(s.lib) restoreLibrary(s.lib);
    inverse.lib=lib;
    const same=P()===was;
    inverse.sel=same ? keep : {n:[], e:[]};                             // la inversa recuerda la selección de su página
    to.push(inverse);
    restoreSelAfterHistory(same ? keep : null, s.sel); renderTabs();
    /* El panel de Escenarios lee el documento: sin esto queda mostrando Scenarios/Steps ya deshechos. */
    if(typeof scRefreshIfVisible==="function") scRefreshIfVisible();
    scheduleAutosave();
    return;
  }
}
function undo(){ stepHistory(undoStack, redoStack); }
function redo(){ stepHistory(redoStack, undoStack); }
