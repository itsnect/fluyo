"use strict";
/* Panel lateral, rail de herramientas, cajón de iconos y pestañas de páginas */

/* ===================== Panel ===================== */
function refreshPanel(){
  lblDirty=false; fsDirty=false;
  // limpiar referencias muertas
  selN.forEach(id=>{ if(!nodeById(id)) selN.delete(id); });
  selE.forEach(id=>{ if(!edgeById(id)) selE.delete(id); });
  const total=selN.size+selE.size;
  const s=singleSel();
  $("noSel").style.display = total===0 ? "block":"none";
  $("multiSel").style.display = total>1 ? "block":"none";
  $("selBody").style.display = s ? "block":"none";
  if(total>1){
    const parts=[];
    if(selN.size) parts.push(selN.size+(selN.size===1?" nodo":" nodos"));
    if(selE.size) parts.push(selE.size+(selE.size===1?" flecha":" flechas"));
    $("multiCount").textContent=parts.join(" y ")+" seleccionados";
  }
  if(!s || !s.obj) return;
  const obj=s.obj, isNode=s.type==="node";
  $("lblEdit").value=obj.label||"";
  $("fsIn").value=obj.fs||"";
  ["rowColor","rowShape","rowPulse","rowOrder"].forEach(r=>$(r).style.display=isNode?"flex":"none");
  ["rowRoute","rowFrom","rowTo","rowAnim","rowDash","rowArrS","rowArrE","rowFlow","rowLineC","rowDotC"].forEach(r=>$(r).style.display=isNode?"none":"flex");
  $("rowColor").style.display=isNode?"flex":"none";
  $("btnWps").style.display=(!isNode&&(obj.waypoints||[]).length)?"block":"none";
  if(isNode){
    if(obj.shape==="image"||obj.shape==="icon") $("rowShape").style.display="none";
    $("shapeSel").value=["image","icon"].includes(obj.shape)?"rect":obj.shape;
    $("pulseChk").checked=!!obj.pulse;
    $("orderIn").value=obj.order;
    [...$("swatches").children].forEach(sw=>sw.classList.toggle("sel", sw.dataset.c===obj.color));
  } else {
    $("routeSel").value=obj.route||"straight";
    $("fromSel").value=obj.fromSide||"";
    $("toSel").value=obj.toSide||"";
    $("animChk").checked=!!obj.animated;
    $("dashChk").checked=!!obj.dashed;
    $("arrSChk").checked=!!obj.startArrow;
    $("arrEChk").checked=obj.endArrow!==false;
    $("flowSel").value=obj.flowDir||"normal";
    [...$("lineSw").children].forEach(sw=>sw.classList.toggle("sel", (obj.lineColor||"")===sw.dataset.c));
    [...$("dotSw").children].forEach(sw=>sw.classList.toggle("sel", (obj.dotColor||"")===sw.dataset.c));
  }
}
PALETTE.forEach(p=>{
  const d=document.createElement("div");
  d.className="swatch"; d.style.background=p.c; d.title=p.n; d.dataset.c=p.c;
  d.onclick=()=>{
    // aplica a todos los nodos seleccionados
    if(!selN.size) return;
    pushUndo();
    let any=false;
    selN.forEach(id=>{ const n=nodeById(id); if(n){ n.color=p.c; any=true; } });
    if(any) refreshPanel();
  };
  $("swatches").appendChild(d);
});
function singleNode(){ const s=singleSel(); return s&&s.type==="node"?s.obj:null; }
function singleEdge(){ const s=singleSel(); return s&&s.type==="edge"?s.obj:null; }
function buildEdgeSwatches(containerId, field){
  const cont=$(containerId);
  const mk=(color,title)=>{
    const d=document.createElement("div");
    d.className="swatch";
    d.style.background = color || "repeating-linear-gradient(45deg,#5a5a5a 0 4px,#2e3134 4px 8px)";
    d.title=title; d.dataset.c=color||"";
    d.onclick=()=>{ const e=singleEdge(); if(e){ pushUndo(); e[field]=color; refreshPanel(); } };
    cont.appendChild(d);
  };
  mk(null,"Auto");
  PALETTE.forEach(p=>mk(p.c,p.n));
}
buildEdgeSwatches("lineSw","lineColor");
buildEdgeSwatches("dotSw","dotColor");
$("lblEdit").addEventListener("input", ()=>{
  const s=singleSel();
  if(s&&s.obj){
    if(!lblDirty){ pushUndo(); lblDirty=true; }
    s.obj.label=$("lblEdit").value;
    scheduleAutosave();
  }
});
$("fsIn").addEventListener("input", ()=>{
  const s=singleSel();
  if(s&&s.obj){
    if(!fsDirty){ pushUndo(); fsDirty=true; }
    const v=+$("fsIn").value;
    s.obj.fs=(v>=8&&v<=200)? v : null;
    scheduleAutosave();
  }
});
$("shapeSel").onchange=()=>{ const n=singleNode(); if(n&&n.shape!=="image"&&n.shape!=="icon"){ pushUndo(); n.shape=$("shapeSel").value; scheduleAutosave(); } };
$("pulseChk").onchange=()=>{ const n=singleNode(); if(n){ pushUndo(); n.pulse=$("pulseChk").checked; scheduleAutosave(); } };
$("orderIn").onchange=()=>{ const n=singleNode(); if(n){ pushUndo(); n.order=+$("orderIn").value||0; scheduleAutosave(); } };
$("routeSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.route=$("routeSel").value; scheduleAutosave(); } };
$("fromSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.fromSide=$("fromSel").value||null; e.waypoints=[]; refreshPanel(); scheduleAutosave(); } };
$("toSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.toSide=$("toSel").value||null; e.waypoints=[]; refreshPanel(); scheduleAutosave(); } };
$("animChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.animated=$("animChk").checked; scheduleAutosave(); } };
$("dashChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.dashed=$("dashChk").checked; scheduleAutosave(); } };
$("arrSChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.startArrow=$("arrSChk").checked; scheduleAutosave(); } };
$("arrEChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.endArrow=$("arrEChk").checked; scheduleAutosave(); } };
$("flowSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.flowDir=$("flowSel").value; scheduleAutosave(); } };
$("btnWps").onclick=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.waypoints=[]; refreshPanel(); scheduleAutosave(); } };
$("btnDel").onclick=deleteSel;
$("mCopy").onclick=copySel;
$("mCut").onclick=cutSel;
$("mDup").onclick=dupSel;
$("mDel").onclick=deleteSel;

/* ===================== Rail / barra superior ===================== */
function setMode(m){ mode=m; pendingShape=null; pendingIcon=null; connecting=null; syncRail(); }
function syncRail(){
  document.querySelectorAll(".rail button").forEach(b=>{
    b.classList.toggle("toggled",
      (b.dataset.mode && b.dataset.mode===mode && !pendingShape && !pendingIcon) ||
      (b.dataset.shape && b.dataset.shape===pendingShape));
  });
  $("btnIcons").classList.toggle("toggled", $("iconDrawer").style.display==="block");
}
document.querySelectorAll(".rail button[data-mode],.rail button[data-shape]").forEach(b=>{
  b.onclick=()=>{
    if(b.dataset.mode) setMode(b.dataset.mode);
    else { pendingShape=b.dataset.shape; pendingIcon=null; mode="select"; connecting=null; syncRail(); }
  };
});
function togglePlay(){
  if(playing){ pausedAt=now(); playing=false; $("btnPlay").textContent="▶ Play"; $("btnPlay").classList.remove("toggled"); }
  else { t0=performance.now()-pausedAt*1000; playing=true; $("btnPlay").textContent="⏸ Pausa"; $("btnPlay").classList.add("toggled"); }
}
$("btnPlay").onclick=togglePlay;
$("themeSel").onchange=()=>{ doc.theme=$("themeSel").value; scheduleAutosave(); };
$("speedIn").oninput=()=>{ settings.speed=+$("speedIn").value; scheduleAutosave(); };
$("dotsIn").oninput=()=>{ settings.dots=+$("dotsIn").value; scheduleAutosave(); };
$("buildChk").onchange=()=>{ settings.build=$("buildChk").checked; t0=performance.now(); pausedAt=0; scheduleAutosave(); };
$("staggerIn").oninput=()=>{ settings.stagger=+$("staggerIn").value; scheduleAutosave(); };
$("themeSel").onchange=()=>{ doc.theme=$("themeSel").value; };
$("chkGrid").onchange=()=>{ settings.grid=$("chkGrid").checked; };
$("speedIn").oninput=()=>settings.speed=+$("speedIn").value;
$("dotsIn").oninput=()=>settings.dots=+$("dotsIn").value;
$("buildChk").onchange=()=>{ settings.build=$("buildChk").checked; t0=performance.now(); pausedAt=0; };
$("staggerIn").oninput=()=>settings.stagger=+$("staggerIn").value;
$("btnClear").onclick=()=>{ if(confirm("¿Borrar todo el contenido de esta página?")){ pushUndo(); P().nodes=[]; P().edges=[]; clearSel(); } };

/* ===================== Cajón de iconos ===================== */
(function buildDrawer(){
  const dr=$("iconDrawer");
  const groups={};
  for(const k in ICONS){ (groups[ICONS[k].g]=groups[ICONS[k].g]||[]).push(k); }
  for(const g of ["GCP","AWS","Azure","General"]){
    if(!groups[g]) continue;
    const h=document.createElement("h4"); h.textContent=g; dr.appendChild(h);
    const grid=document.createElement("div"); grid.className="iconGrid";
    for(const k of groups[g]){
      const b=document.createElement("button");
      b.innerHTML=`<img src="${iconURL[k]}" alt=""><span>${ICONS[k].n}</span>`;
      b.title=ICONS[k].n;
      b.onclick=()=>{ pendingIcon=k; pendingShape=null; mode="select"; dr.style.display="none"; syncRail(); };
      grid.appendChild(b);
    }
    dr.appendChild(grid);
  }
})();
$("btnIcons").onclick=()=>{
  const dr=$("iconDrawer");
  dr.style.display=dr.style.display==="block"?"none":"block";
  syncRail();
};

/* ===================== Páginas ===================== */
function renderTabs(){
  const bar=$("pagesBar"); bar.innerHTML="";
  doc.pages.forEach((pg,i)=>{
    const t=document.createElement("div");
    t.className="tab"+(i===doc.cur?" active":"");
    const name=document.createElement("span"); name.textContent=pg.name;
    t.appendChild(name);
    if(doc.pages.length>1){
      const x=document.createElement("span"); x.className="x"; x.textContent="✕";
      x.title="Cerrar página";
      x.onclick=ev=>{ ev.stopPropagation();
        if(confirm(`¿Eliminar «${pg.name}»?`)){
          doc.pages.splice(i,1);
          doc.cur=Math.min(doc.cur, doc.pages.length-1);
          clearSel(); renderTabs(); scheduleAutosave();
        }};
      t.appendChild(x);
    }
    t.onclick=()=>{ doc.cur=i; clearSel(); renderTabs(); scheduleAutosave(); };
    t.ondblclick=()=>{ const nn=prompt("Nombre de la página:",pg.name); if(nn){ pg.name=nn; renderTabs(); scheduleAutosave(); } };
    bar.appendChild(t);
  });
  const add=document.createElement("button");
  add.textContent="＋"; add.title="Nueva página"; add.style.padding="4px 10px";
  add.onclick=()=>{ doc.pages.push(blankPage("Página "+(doc.pages.length+1))); doc.cur=doc.pages.length-1; clearSel(); renderTabs(); scheduleAutosave(); };
  bar.appendChild(add);
}

renderTabs();
if(hasAutosave()) showAutosaveRestorePrompt();
