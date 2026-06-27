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
  clip={nodes:ns, edges:es};
  // marca el portapapeles del sistema para que Ctrl+V priorice las formas
  try{ navigator.clipboard.writeText("fluyo::"+JSON.stringify(clip)).catch(()=>{}); }catch(e){}
}
function cutSel(){ copySel(); deleteSel(); }
function pasteClip(){
  if(!clip || !clip.nodes.length) return;
  pushUndo();
  const map={};
  selN.clear(); selE.clear();
  clip.nodes.forEach(n=>{
    const c=deep(n); map[n.id]=c.id=P().nextId++;
    c.x+=GRID; c.y+=GRID; c.order=P().nodes.length;
    P().nodes.push(c); selN.add(c.id);
  });
  clip.edges.forEach(e=>{
    const c=deep(e); c.id=P().nextId++;
    c.from=map[e.from]; c.to=map[e.to];
    (c.waypoints||[]).forEach(w=>{w.x+=GRID; w.y+=GRID;});
    P().edges.push(c); selE.add(c.id);
  });
  // cascada en pegados sucesivos
  clip.nodes.forEach(n=>{n.x+=GRID; n.y+=GRID;});
  clip.edges.forEach(e=>(e.waypoints||[]).forEach(w=>{w.x+=GRID; w.y+=GRID;}));
  refreshPanel();
}
function dupSel(){ const keep=clip; copySel(); pasteClip(); clip=keep; }
function deleteSel(){
  if(!selN.size && !selE.size) return;
  pushUndo();
  P().edges=P().edges.filter(e=>!selE.has(e.id) && !selN.has(e.from) && !selN.has(e.to));
  P().nodes=P().nodes.filter(n=>!selN.has(n.id));
  clearSel();
}

/* ---- deshacer / rehacer ---- */
let undoStack=[], redoStack=[], lblDirty=false, fsDirty=false;
function snapPage(){ return {pi:doc.cur, data:deep({nodes:P().nodes, edges:P().edges, nextId:P().nextId})}; }
function pushUndo(){ undoStack.push(snapPage()); if(undoStack.length>60) undoStack.shift(); redoStack.length=0; }
function applySnap(s){
  doc.cur=clamp(s.pi,0,doc.pages.length-1);
  const pg=P(); pg.nodes=deep(s.data.nodes); pg.edges=deep(s.data.edges); pg.nextId=s.data.nextId;
  clearSel(); renderTabs();
}
function undo(){ if(!undoStack.length) return; redoStack.push(snapPage()); applySnap(undoStack.pop()); }
function redo(){ if(!redoStack.length) return; undoStack.push(snapPage()); applySnap(redoStack.pop()); }
