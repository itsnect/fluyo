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
  $("fontSel").value=obj.font||"";
  $("boldChk").checked=!!obj.bold;
  const nodeRows=["rowColor","rowFill","rowBorder","rowLblPos","rowTextBg","rowZ","rowShape","rowPulse","rowOrder"];
  const edgeRows=["rowRoute","rowFrom","rowTo","rowAnim","rowDash","rowArrS","rowArrE","rowFlow","rowLineC","rowDotC"];
  nodeRows.forEach(r=>$(r).style.display=isNode?"flex":"none");
  edgeRows.forEach(r=>$(r).style.display=isNode?"none":"flex");
  $("btnWps").style.display=(!isNode&&(obj.waypoints||[]).length)?"block":"none";
  if(isNode){
    const hasBox=["rect","cylinder","diamond","circle","hex"].includes(obj.shape);
    if(obj.shape==="image"||obj.shape==="icon"||obj.shape==="anim") $("rowShape").style.display="none";
    if(obj.shape==="image") $("rowColor").style.display="none";
    $("rowFill").style.display=hasBox?"flex":"none";
    $("rowBorder").style.display=hasBox?"flex":"none";
    $("rowLblPos").style.display=(hasBox||obj.shape==="text")?"flex":"none";
    $("rowTextBg").style.display=(obj.shape==="text")?"flex":"none";
    $("shapeSel").value=["image","icon","anim"].includes(obj.shape)?"rect":obj.shape;
    $("pulseChk").checked=!!obj.pulse;
    $("orderIn").value=obj.order;
    $("borderSel").value=obj.border||"solid";
    $("lblPosSel").value=obj.lblPos||"center";
    const hx=v=>(typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v))?v:null;
    if(hx(obj.color)) $("strokeCustom").value=hx(obj.color);
    if(hx(obj.fill)) $("fillCustom").value=hx(obj.fill);
    if(hx(obj.textBg)) $("textBgCustom").value=hx(obj.textBg);
    markSw("swatches",obj.color);
    markSw("fillSw",obj.fill===undefined?null:obj.fill);
    markSw("textBgSw",obj.textBg??null);
  } else {
    const hx=v=>(typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v))?v:null;
    if(hx(obj.lineColor)) $("lineCustom").value=hx(obj.lineColor);
    if(hx(obj.dotColor)) $("dotCustom").value=hx(obj.dotColor);
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
const DASH_PAT="repeating-linear-gradient(45deg,#5a5a5a 0 4px,#2e3134 4px 8px)";
const CHECKER_PAT="repeating-conic-gradient(#3a3d40 0% 25%, #26292c 0% 50%) 0 0/10px 10px";
/* Rejilla de swatches para propiedades de nodo (paleta amplia + opciones especiales) */
function buildNodeSwatches(containerId, field, extras){
  const cont=$(containerId); cont.innerHTML="";
  const mk=(bg,title,value,special)=>{
    const d=document.createElement("div");
    d.className="swatch"+(special?" special":"");
    d.style.background=bg;
    d.title=title; d.dataset.v=(value===null||value===undefined)?"__null__":value;
    d.onclick=()=>{
      if(!selN.size) return;
      pushUndo();
      selN.forEach(id=>{ const n=nodeById(id); if(n) n[field]=value; });
      refreshPanel(); scheduleAutosave();
    };
    cont.appendChild(d);
  };
  (extras||[]).forEach(e=>mk(e.pattern, e.label, e.value, true));
  const seen=new Set();
  PALETTE.forEach(p=>{ if(!seen.has(p.c)){ seen.add(p.c); mk(p.c,p.n,p.c); } });
  SWATCH_COLORS.forEach(c=>{ if(!seen.has(c)){ seen.add(c); mk(c,c,c); } });
}
function markSw(id,val){
  const key=(val===null||val===undefined)?"__null__":String(val);
  [...$(id).children].forEach(sw=>sw.classList.toggle("sel", sw.dataset.v===key));
}
buildNodeSwatches("swatches","color");
buildNodeSwatches("fillSw","fill",[
  {label:"Automático (semitransparente)", value:null, pattern:DASH_PAT},
  {label:"Sin relleno", value:"none", pattern:CHECKER_PAT},
]);
buildNodeSwatches("textBgSw","textBg",[
  {label:"Sin fondo", value:null, pattern:CHECKER_PAT},
]);
function applyNodeVal(field,val){
  if(!selN.size) return;
  pushUndo();
  selN.forEach(id=>{ const n=nodeById(id); if(n) n[field]=val; });
  refreshPanel(); scheduleAutosave();
}
$("strokeCustom").onchange=()=>applyNodeVal("color",$("strokeCustom").value);
$("fillCustom").onchange=()=>applyNodeVal("fill",$("fillCustom").value);
$("textBgCustom").onchange=()=>applyNodeVal("textBg",$("textBgCustom").value);
$("borderSel").onchange=()=>applyNodeVal("border",$("borderSel").value);
$("lblPosSel").onchange=()=>applyNodeVal("lblPos",$("lblPosSel").value);
$("btnFront").onclick=bringToFront;
$("btnBack").onclick=sendToBack;
$("btnForward").onclick=bringForward;
$("btnBackward").onclick=sendBackward;
$("btnEyedrop").onclick=async()=>{
  if(!window.EyeDropper){ alert("Tu navegador no soporta el cuentagotas (usa Chrome o Edge)."); return; }
  try{
    const res=await new EyeDropper().open();
    applyNodeVal("color", res.sRGBHex);
  }catch(e){/* cancelado */}
};
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
$("lineCustom").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.lineColor=$("lineCustom").value; refreshPanel(); scheduleAutosave(); } };
$("dotCustom").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); e.dotColor=$("dotCustom").value; refreshPanel(); scheduleAutosave(); } };

/* ===================== Tipografía (por texto + global) ===================== */
(function buildFontSelects(){
  const per=$("fontSel"), glob=$("fontGlobalSel");
  const og=document.createElement("option"); og.value=""; og.textContent="(Global)"; per.appendChild(og);
  FONTS.forEach(ft=>{
    const a=document.createElement("option"); a.value=ft.f; a.textContent=ft.n; a.style.fontFamily=ft.f; per.appendChild(a);
    const b=document.createElement("option"); b.value=ft.f; b.textContent=ft.n; b.style.fontFamily=ft.f; glob.appendChild(b);
  });
  glob.value=settings.font||DEFAULT_FONT;
})();
$("fontSel").onchange=()=>{ const s=singleSel(); if(s&&s.obj){ pushUndo(); s.obj.font=$("fontSel").value||null; scheduleAutosave(); } };
$("boldChk").onchange=()=>{ const s=singleSel(); if(s&&s.obj){ pushUndo(); s.obj.bold=$("boldChk").checked; scheduleAutosave(); } };
$("fontGlobalSel").onchange=()=>{ settings.font=$("fontGlobalSel").value||DEFAULT_FONT; scheduleAutosave(); };
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
function setMode(m){ mode=m; pendingShape=null; pendingIcon=null; pendingAnim=null; connecting=null; syncRail(); }
function syncRail(){
  document.querySelectorAll(".rail button").forEach(b=>{
    b.classList.toggle("toggled",
      (b.dataset.mode && b.dataset.mode===mode && !pendingShape && !pendingIcon && !pendingAnim) ||
      (b.dataset.shape && b.dataset.shape===pendingShape));
  });
  $("btnIcons").classList.toggle("toggled", $("iconDrawer").style.display==="block");
  $("btnAnims").classList.toggle("toggled", $("animDrawer").style.display==="block" || !!pendingAnim);
}
document.querySelectorAll(".rail button[data-mode],.rail button[data-shape]").forEach(b=>{
  b.onclick=()=>{
    if(b.dataset.mode) setMode(b.dataset.mode);
    else { pendingShape=b.dataset.shape; pendingIcon=null; pendingAnim=null; mode="select"; connecting=null; syncRail(); }
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
$("chkGrid").onchange=()=>{ settings.grid=$("chkGrid").checked; scheduleAutosave(); };
$("chkSnap").onchange=()=>{ settings.snap=$("chkSnap").checked; scheduleAutosave(); };
$("bgCustom").oninput=()=>{ doc.customBg=$("bgCustom").value; scheduleAutosave(); };
$("btnBgClear").onclick=()=>{ doc.customBg=""; scheduleAutosave(); };
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
  for(const g of ["Estados","General","Varios","GCP","AWS","Azure"]){
    if(!groups[g]) continue;
    const h=document.createElement("h4"); h.textContent=g; dr.appendChild(h);
    const grid=document.createElement("div"); grid.className="iconGrid";
    for(const k of groups[g]){
      const b=document.createElement("button");
      b.innerHTML=`<img src="${iconURL[k]}" alt=""><span>${ICONS[k].n}</span>`;
      b.title=ICONS[k].n;
      b.onclick=()=>{ pendingIcon=k; pendingShape=null; pendingAnim=null; mode="select"; dr.style.display="none"; syncRail(); };
      grid.appendChild(b);
    }
    dr.appendChild(grid);
  }
})();
$("btnIcons").onclick=()=>{
  const dr=$("iconDrawer");
  const show=dr.style.display!=="block";
  $("animDrawer").style.display="none";
  dr.style.display=show?"block":"none";
  syncRail();
};

/* ===================== Cajón de GIFs animados ===================== */
(function buildAnimDrawer(){
  const dr=$("animDrawer");
  const h=document.createElement("h4"); h.textContent="GIFs animados"; dr.appendChild(h);
  const grid=document.createElement("div"); grid.className="iconGrid";
  for(const k in ANIMS){
    const b=document.createElement("button");
    b.innerHTML=`<img src="${animURL[k]}" alt=""><span>${ANIMS[k].n}</span>`;
    b.title=ANIMS[k].n;
    b.onclick=()=>{ pendingAnim=k; pendingShape=null; pendingIcon=null; mode="select"; dr.style.display="none"; syncRail(); };
    grid.appendChild(b);
  }
  dr.appendChild(grid);
  const tip=document.createElement("p"); tip.className="hint"; tip.style.marginTop="8px";
  tip.textContent="Se animan en el lienzo y en el GIF exportado. Cambia su color desde el panel.";
  dr.appendChild(tip);
})();
$("btnAnims").onclick=()=>{
  const dr=$("animDrawer");
  const show=dr.style.display!=="block";
  $("iconDrawer").style.display="none";
  dr.style.display=show?"block":"none";
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
