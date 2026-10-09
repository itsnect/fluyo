"use strict";
/* Panel lateral, rail de herramientas, cajón de iconos y pestañas de páginas */

/* ===================== Panel ===================== */
function refreshPanel(){
  lblDirty=false; fsDirty=false;
  // limpiar referencias muertas
  selN.forEach(id=>{ if(!nodeById(id)) selN.delete(id); });
  selE.forEach(id=>{ if(!edgeById(id)) selE.delete(id); });
  const total=selN.size+selE.size;
  syncTouchDelete();
  const s=singleSel();
  $("noSel").style.display = total===0 ? "block":"none";
  $("multiSel").style.display = total>1 ? "block":"none";
  $("selBody").style.display = s ? "block":"none";
  syncSelMeta(total, s);
  if(total>1){
    const parts=[];
    if(selN.size) parts.push(selN.size+(selN.size===1?" nodo":" nodos"));
    if(selE.size) parts.push(selE.size+(selE.size===1?" flecha":" flechas"));
    $("multiCount").textContent=parts.join(" y ")+" seleccionados";
  }
  if(!s || !s.obj){ syncPanelGroups(); return; }
  const obj=s.obj, isNode=s.type==="node";
  $("lblEdit").value=obj.label||"";
  $("fsIn").value=obj.fs||"";
  $("fontSel").value=obj.font||"";
  $("boldChk").checked=!!obj.bold;
  const nodeRows=["rowColor","rowTint","rowFill","rowBorder","rowLblPos","rowTextBg","rowTextColor","rowZ","rowShape","rowPulse","rowOrder","rowLang","rowKeywords","rowKwBg","rowKwColor"];
  const edgeRows=["rowRoute","rowFrom","rowTo","rowAnim","rowSpeedF","rowDotsGlobal","rowDots","rowDash","rowArrS","rowArrE","rowFlow","rowLineC","rowDotC"];
  nodeRows.forEach(r=>$(r).style.display=isNode?"flex":"none");
  edgeRows.forEach(r=>$(r).style.display=isNode?"none":"flex");
  $("btnWps").style.display=(!isNode&&(obj.waypoints||[]).length)?"block":"none";
  if(isNode){
    const hasBox=["rect","cylinder","diamond","circle","hex"].includes(obj.shape);
    if(obj.shape==="image"||obj.shape==="icon"||obj.shape==="anim") $("rowShape").style.display="none";
    if(obj.shape==="image") $("rowColor").style.display="none";
    const esCode=obj.shape==="code";
    /* En `code` los campos genéricos cambian de significado, así que la etiqueta
       del control lo dice: `fill` pinta el panel y `textBg` el papel del bloque. */
    $("rowTint").style.display=obj.shape==="icon"?"flex":"none";
    $("tintChk").checked=!!obj.tint;
    $("rowFill").style.display=(hasBox||esCode)?"flex":"none";
    $("rowBorder").style.display=(hasBox||esCode)?"flex":"none";
    $("rowLblPos").style.display=(hasBox||obj.shape==="text")?"flex":"none";
    $("rowTextBg").style.display=(obj.shape==="text"||esCode)?"flex":"none";
    $("rowFill").querySelector("label").textContent=esCode?"Fondo del panel":"Relleno de la forma";
    $("rowTextBg").querySelector("label").textContent=esCode?"Fondo del bloque de código":"Fondo del texto";
    ["rowLang","rowKwBg","rowKwColor"].forEach(r=>$(r).style.display=esCode?"flex":"none");
    if(esCode){
      const propia=Array.isArray(obj.keywords)&&obj.keywords.length;
      $("langSel").value=propia?"custom":(obj.lang||DEFAULT_LANG);
      $("rowKeywords").style.display=propia?"flex":"none";
      $("kwEdit").value=propia?obj.keywords.join(" "):"";
    } else $("rowKeywords").style.display="none";
    $("shapeSel").value=["image","icon","anim"].includes(obj.shape)?"rect":obj.shape;
    $("pulseChk").checked=!!obj.pulse;
    $("orderIn").value=obj.order;
    $("borderSel").value=obj.border||"solid";
    $("lblPosSel").value=obj.lblPos||"center";
    const hx=v=>(typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v))?v:null;
    if(hx(obj.color)) $("strokeCustom").value=hx(obj.color);
    if(hx(obj.fill)) $("fillCustom").value=hx(obj.fill);
    if(hx(obj.textBg)) $("textBgCustom").value=hx(obj.textBg);
    if(hx(obj.textColor)) $("textColorCustom").value=hx(obj.textColor);
    if(hx(obj.kwBg)) $("kwBgCustom").value=hx(obj.kwBg);
    if(hx(obj.kwColor)) $("kwColorCustom").value=hx(obj.kwColor);
    markSw("swatches",obj.color);
    markSw("fillSw",obj.fill===undefined?null:obj.fill);
    markSw("textBgSw",obj.textBg??null);
    markSw("textColorSw",obj.textColor??null);
    markSw("kwBgSw",obj.kwBg??null);
    markSw("kwColorSw",obj.kwColor??null);
  } else {
    const hx=v=>(typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v))?v:null;
    if(hx(obj.lineColor)) $("lineCustom").value=hx(obj.lineColor);
    if(hx(obj.dotColor)) $("dotCustom").value=hx(obj.dotColor);
    $("routeSel").value=obj.route||"straight";
    $("fromSel").value=obj.fromSide||"";
    $("toSel").value=obj.toSide||"";
    $("animChk").checked=!!obj.animated;
    $("speedFacSel").value=String(edgeSpeedFac(obj));
    $("dotsGlobalChk").checked=obj.dotsGlobal!==false;
    $("edgeDotsIn").value=obj.dots||"";
    /* el número propio de puntos solo tiene sentido si esta flecha no sigue al
       global: enseñar los dos a la vez invita a cambiar el que no manda */
    $("rowDots").style.display=obj.dotsGlobal===false?"flex":"none";
    $("dashChk").checked=!!obj.dashed;
    $("arrSChk").checked=!!obj.startArrow;
    $("arrEChk").checked=obj.endArrow!==false;
    $("flowSel").value=obj.flowDir||"normal";
    [...$("lineSw").children].forEach(sw=>sw.classList.toggle("sel", (obj.lineColor||"")===sw.dataset.c));
    [...$("dotSw").children].forEach(sw=>sw.classList.toggle("sel", (obj.dotColor||"")===sw.dataset.c));
  }
  syncPanelGroups();
  if(typeof scRenderCanvasActions === "function") scRenderCanvasActions();
}
/* Metadatos de la selección (FLUYO-018.13): qué es y cómo se llama para el
   documento y para el MCP (el id). Es solo lectura y vive junto al título del
   panel; typeof/null-check porque los arneses de vm montan un DOM mínimo. */
const SHAPE_NAMES={rect:"Caja", cylinder:"BD", diamond:"Rombo", circle:"Círculo", hex:"Hexágono", text:"Texto", code:"Código", icon:"Icono", image:"Imagen", anim:"GIF"};
function syncSelMeta(total, s){
  const m=$("selMeta"); if(!m) return;
  let txt="";
  if(total>1) txt=total+" elementos";
  else if(s && s.obj) txt = s.type==="node" ? (SHAPE_NAMES[s.obj.shape]||s.obj.shape)+" · id "+s.obj.id : "Conexión · "+s.obj.from+" → "+s.obj.to;
  m.textContent=txt; m.hidden=!txt;
}
/* ===================== Teclado en las rejillas de swatches =====================
   Los swatches son <div> a propósito (son muestras de color, no texto), pero eso
   los dejaba fuera del alcance del teclado por completo: con más de 200 en el
   panel, quien navega con tabulador no podía cambiar ningún color.

   Se usa el patrón de «tabindex móvil» en lugar de hacer focusable cada uno: el
   grupo entero es UNA parada de tabulador y dentro se navega con las flechas.
   Doscientas paradas seguidas serían tan inutilizables como ninguna. */
function enableSwatchKeyboard(containerId, label){
  const cont=$(containerId);
  cont.setAttribute("role","group");
  cont.setAttribute("aria-label",label);
  const items=()=>[...cont.children];
  items().forEach((el,i)=>{ el.tabIndex = i===0 ? 0 : -1; });
  cont.addEventListener("keydown", ev=>{
    const list=items(), i=list.indexOf(document.activeElement);
    if(i<0) return;
    let j=null;
    if(ev.key==="ArrowRight"||ev.key==="ArrowDown") j=(i+1)%list.length;
    else if(ev.key==="ArrowLeft"||ev.key==="ArrowUp") j=(i-1+list.length)%list.length;
    else if(ev.key==="Home") j=0;
    else if(ev.key==="End") j=list.length-1;
    else if(ev.key==="Enter"||ev.key===" "){
      /* stopPropagation es imprescindible: el handler global de teclado usa la
         barra espaciadora para pausar la animación */
      ev.preventDefault(); ev.stopPropagation();
      document.activeElement.click();
      return;
    }
    else return;
    ev.preventDefault(); ev.stopPropagation();
    list[i].tabIndex=-1; list[j].tabIndex=0; list[j].focus();
  });
}

/* Muestras especiales («automático», «sin relleno»): sus dos tonos son tokens del sistema (--sw-a/--sw-b, css/system.css). */
const DASH_PAT="repeating-linear-gradient(45deg,var(--sw-a) 0 4px,var(--sw-b) 4px 8px)";
const CHECKER_PAT="repeating-conic-gradient(var(--sw-a) 0% 25%, var(--sw-b) 0% 50%) 0 0/10px 10px";
/* Rejilla de swatches para propiedades de nodo (paleta amplia + opciones especiales) */
function buildNodeSwatches(containerId, field, extras){
  const cont=$(containerId); cont.innerHTML="";
  const mk=(bg,title,value,special)=>{
    const d=document.createElement("div");
    d.className="swatch"+(special?" special":"");
    d.style.background=bg;
    d.title=title; d.dataset.v=(value===null||value===undefined)?"__null__":value;
    d.setAttribute("role","button");
    d.setAttribute("aria-label",title);
    d.onclick=()=>{
      if(!selN.size) return;
      pushUndo();
      selN.forEach(id=>{ const n=nodeById(id); if(n) editNode(n,{[field]:value}); });
      refreshPanel(); scheduleAutosave();
    };
    cont.appendChild(d);
  };
  (extras||[]).forEach(e=>mk(e.pattern, e.label, e.value, true));
  const seen=new Set();
  /* FLUYO-018.15: el color con el que nace un nodo encabeza su rejilla, para poder volver a él */
  if(field==="color"){ seen.add(DEFAULT_NODE_COLOR); mk(DEFAULT_NODE_COLOR,"Piedra (por defecto)",DEFAULT_NODE_COLOR); }
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
/* «Automático» no es lo mismo en todas las formas: en un texto suelto o en un
   GIF el color del nodo manda; dentro de una caja manda el color del tema. */
buildNodeSwatches("textColorSw","textColor",[
  {label:"Automático (según la forma y el tema)", value:null, pattern:DASH_PAT},
]);
enableSwatchKeyboard("swatches","Color de línea o borde");
enableSwatchKeyboard("fillSw","Relleno de la forma");
enableSwatchKeyboard("textBgSw","Fondo del texto");
enableSwatchKeyboard("textColorSw","Color del texto");
buildNodeSwatches("kwBgSw","kwBg",[{label:"Del tema", value:null, pattern:DASH_PAT}]);
buildNodeSwatches("kwColorSw","kwColor",[{label:"Del tema", value:null, pattern:DASH_PAT}]);
enableSwatchKeyboard("kwBgSw","Fondo del resaltado");
enableSwatchKeyboard("kwColorSw","Texto del resaltado");
function parseKeywords(txt){
  return String(txt||"").split(/[\s,]+/).map(w=>w.trim()).filter(Boolean);
}
/* `custom` no es un lenguaje: es la señal de que manda la lista escrita a mano.
   Mientras `keywords` tenga contenido, `lang` deja de consultarse. */
$("langSel").onchange=()=>{
  const v=$("langSel").value, sel=singleSel();
  if(!sel||!sel.obj) return;
  pushUndo();
  if(v==="custom"){
    if(!Array.isArray(sel.obj.keywords)||!sel.obj.keywords.length) editNode(sel.obj,{keywords:parseKeywords($("kwEdit").value)});
  } else { editNode(sel.obj,{lang:v, keywords:null}); }
  refreshPanel(); scheduleAutosave();
};
$("kwEdit").oninput=()=>{
  const sel=singleSel(); if(!sel||!sel.obj) return;
  editNode(sel.obj,{keywords:parseKeywords($("kwEdit").value)});
  scheduleAutosave();
};
function applyNodeVal(field,val){
  if(!selN.size) return;
  pushUndo();
  selN.forEach(id=>{ const n=nodeById(id); if(n) editNode(n,{[field]:val}); });
  refreshPanel(); scheduleAutosave();
}
$("strokeCustom").onchange=()=>applyNodeVal("color",$("strokeCustom").value);
$("fillCustom").onchange=()=>applyNodeVal("fill",$("fillCustom").value);
$("textBgCustom").onchange=()=>applyNodeVal("textBg",$("textBgCustom").value);
$("textColorCustom").onchange=()=>applyNodeVal("textColor",$("textColorCustom").value);
$("kwBgCustom").onchange=()=>applyNodeVal("kwBg",$("kwBgCustom").value);
$("kwColorCustom").onchange=()=>applyNodeVal("kwColor",$("kwColorCustom").value);
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
    d.style.background = color || DASH_PAT;
    d.title=title; d.dataset.c=color||"";
    d.setAttribute("role","button");
    d.setAttribute("aria-label",title);
    d.onclick=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{[field]:color}); refreshPanel(); } };
    cont.appendChild(d);
  };
  mk(null,"Auto");
  PALETTE.forEach(p=>mk(p.c,p.n));
}
buildEdgeSwatches("lineSw","lineColor");
buildEdgeSwatches("dotSw","dotColor");
enableSwatchKeyboard("lineSw","Color de línea de la flecha");
enableSwatchKeyboard("dotSw","Color de los puntos animados");
/* ===================== Grupos del panel y muestras compactas (FLUYO-018.14b, B6) =====================
   El panel deja de ser un formulario de 30 filas: las filas viven en grupos <details> (index.html). El estado
   abierto/plegado ES el <details> —no hay variable espejo—. Por defecto, en escritorio, abiertos los grupos que se tocan
   en cada elemento (Texto, Forma y color, Recorrido, Trazo) y plegados los raros (Código, Flujo, Capas y aparición) y lo
   del documento (Animación del lienzo, Atajos). En la hoja móvil todos empiezan plegados y son un acordeón (uno
   abierto a la vez): el texto, siempre a la vista arriba, y un toque lleva a cualquier grupo; la hoja cabe en pantalla.

   refreshPanel decide qué FILAS se ven (como siempre); aquí solo se oculta el grupo que se queda sin filas y el botón
   «Más colores» de la rejilla que ya cabe entera. */
function applyGroupDefaults(){
  const sheet=isSheetLayout();
  document.querySelectorAll("#selBody > details.pgroup").forEach(d=>{
    d.open = !sheet && ["grpText","grpShape","grpRoute","grpStroke"].includes(d.id);
  });
}
function syncPanelGroups(){
  document.querySelectorAll("#selBody > details.pgroup").forEach(d=>{
    const rows=[...d.querySelectorAll(":scope > .pgBody > *")];
    d.hidden=!rows.some(r=>r.style.display!=="none" && !r.hidden);
  });
  syncSwatchMore();
}
/* En la hoja móvil, abrir un grupo pliega los demás: lo que se edita queda arriba y a la vista. */
document.querySelectorAll("#selBody > details.pgroup").forEach(d=>{
  d.addEventListener("toggle", ()=>{
    if(!d.open || !isSheetLayout()) return;
    document.querySelectorAll("#selBody > details.pgroup").forEach(o=>{ if(o!==d) o.open=false; });
    if(d.scrollIntoView) d.scrollIntoView({block:"nearest"});
  });
});
/* «Más colores»: cada rejilla enseña dos filas; el botón la despliega entera. Si la muestra elegida queda escondida, la
   rejilla se abre sola (el color actual nunca se pierde de vista). */
function addSwatchMore(gridId){
  const grid=$(gridId), tools=grid.parentNode.querySelector(".colorTools");
  const b=document.createElement("button");
  b.type="button"; b.className="swMore btnGhost"; b.textContent="Más colores";
  b.setAttribute("aria-expanded","false"); b.setAttribute("aria-controls", gridId);
  b.onclick=()=>{ const on=!grid.classList.contains("expanded"); grid.classList.toggle("expanded", on); b.setAttribute("aria-expanded", String(on)); b.textContent=on ? "Menos colores" : "Más colores"; };
  if(tools) tools.appendChild(b); else grid.after(b);
  grid._more=b;
}
/* función y no constante: refreshPanel puede llegar antes de que se evalúe esta parte del archivo */
function swatchGrids(){ return ["textColorSw","swatches","fillSw","textBgSw","kwBgSw","kwColorSw","lineSw","dotSw"]; }
swatchGrids().forEach(addSwatchMore);
function syncSwatchMore(){
  for(const id of swatchGrids()){
    const grid=$(id), b=grid._more;
    if(!b || !grid.offsetParent) continue;
    const sel=grid.querySelector(".swatch.sel");
    if(sel && !grid.classList.contains("expanded") && sel.getBoundingClientRect().bottom > grid.getBoundingClientRect().bottom+1){
      grid.classList.add("expanded"); b.setAttribute("aria-expanded","true"); b.textContent="Menos colores";
    }
    b.hidden = !grid.classList.contains("expanded") && grid.scrollHeight<=grid.clientHeight+2;
  }
}

$("lineCustom").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{lineColor:$("lineCustom").value}); refreshPanel(); scheduleAutosave(); } };
$("dotCustom").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{dotColor:$("dotCustom").value}); refreshPanel(); scheduleAutosave(); } };

/* ===================== Tipografía (por texto + global) ===================== */
(function buildFontSelects(){
  const per=$("fontSel"), glob=$("fontGlobalSel");
  const og=document.createElement("option"); og.value=""; og.textContent="(Global)"; per.appendChild(og);
  /* FLUYO-018.14a: las voces del sistema arriba, las históricas debajo. Solo cambia
     dónde se ven: los valores (la pila CSS que guarda el documento) son los de FONTS. */
  const SYSTEM_FONTS=["Playfair Display","IBM Plex Mono"];
  const groups=[["Fluyo", FONTS.filter(ft=>SYSTEM_FONTS.includes(ft.n))], ["Clásicas", FONTS.filter(ft=>!SYSTEM_FONTS.includes(ft.n))]];
  for(const sel of [per, glob]){
    for(const [label, list] of groups){
      if(!list.length) continue;
      const g=document.createElement("optgroup"); g.label=label;
      list.forEach(ft=>{ const o=document.createElement("option"); o.value=ft.f; o.textContent=ft.n; o.style.fontFamily=ft.f; g.appendChild(o); });
      sel.appendChild(g);
    }
  }
  glob.value=settings.font||DEFAULT_FONT;
})();
$("fontSel").onchange=()=>{ const s=singleSel(); if(s&&s.obj){ pushUndo(); editObj(s.obj,{font:$("fontSel").value||null}); scheduleAutosave(); } };
$("boldChk").onchange=()=>{ const s=singleSel(); if(s&&s.obj){ pushUndo(); editObj(s.obj,{bold:$("boldChk").checked}); scheduleAutosave(); } };
$("fontGlobalSel").onchange=()=>{ settings.font=$("fontGlobalSel").value||DEFAULT_FONT; scheduleAutosave(); };
$("lblEdit").addEventListener("input", ()=>{
  const s=singleSel();
  if(s&&s.obj){
    if(!lblDirty){ pushUndo(); lblDirty=true; }
    editObj(s.obj,{label:$("lblEdit").value});
    scheduleAutosave();
  }
});
$("fsIn").addEventListener("input", ()=>{
  const s=singleSel();
  if(s&&s.obj){
    if(!fsDirty){ pushUndo(); fsDirty=true; }
    const v=+$("fsIn").value;
    editObj(s.obj,{fs:(v>=8&&v<=200)? v : null});
    scheduleAutosave();
  }
});
$("shapeSel").onchange=()=>{ const n=singleNode(); if(n&&n.shape!=="image"&&n.shape!=="icon"){ pushUndo(); editNode(n,{shape:$("shapeSel").value}); scheduleAutosave(); } };
$("pulseChk").onchange=()=>{ const n=singleNode(); if(n){ pushUndo(); editNode(n,{pulse:$("pulseChk").checked}); scheduleAutosave(); } };
$("tintChk").onchange=()=>{ const n=singleNode(); if(n){ pushUndo(); editNode(n,{tint:$("tintChk").checked}); scheduleAutosave(); } };
$("orderIn").onchange=()=>{ const n=singleNode(); if(n){ pushUndo(); editNode(n,{order:+$("orderIn").value||0}); scheduleAutosave(); } };
$("routeSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{route:$("routeSel").value}); scheduleAutosave(); } };
$("fromSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{fromSide:$("fromSel").value||null, waypoints:[]}); refreshPanel(); scheduleAutosave(); } };
$("toSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{toSide:$("toSel").value||null, waypoints:[]}); refreshPanel(); scheduleAutosave(); } };
$("animChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{animated:$("animChk").checked}); scheduleAutosave(); } };
/* Estos tres controles llevaban en el HTML desde el merge de la rama de estilos,
   pero sin handler: se veían en el panel y no hacían nada. */
$("speedFacSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{speedFac:+$("speedFacSel").value||1}); scheduleAutosave(); } };
$("dotsGlobalChk").onchange=()=>{
  const e=singleEdge(); if(!e) return;
  pushUndo();
  const global=$("dotsGlobalChk").checked;
  editEdge(e,{dotsGlobal:global, dots:(global===false && !e.dots)? settings.dots : undefined});   // arranca donde estaba, no en vacío
  refreshPanel(); scheduleAutosave();
};
$("edgeDotsIn").oninput=()=>{
  const e=singleEdge(); if(!e) return;
  const v=+$("edgeDotsIn").value;
  editEdge(e,{dots:(v>=1&&v<=6)? Math.round(v) : null});
  scheduleAutosave();
};
$("dashChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{dashed:$("dashChk").checked}); scheduleAutosave(); } };
$("arrSChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{startArrow:$("arrSChk").checked}); scheduleAutosave(); } };
$("arrEChk").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{endArrow:$("arrEChk").checked}); scheduleAutosave(); } };
$("flowSel").onchange=()=>{ const e=singleEdge(); if(e){ pushUndo(); editEdge(e,{flowDir:$("flowSel").value}); scheduleAutosave(); } };
/* Devuelve la flecha seleccionada a su ruta automática. Es la salida cuando una
   ruta hecha a mano deja de servir, y desde que esas rutas se CONSERVAN al mover
   los nodos es un gesto habitual, no un rincón: por eso tiene botón arriba del
   panel y atajo de teclado (R, en interaction.js). Devuelve si hizo algo, para
   que el atajo no consuma la tecla cuando no había nada que deshacer. */
function rutaAuto(){
  const e=singleEdge();
  if(!e || !(e.waypoints||[]).length) return false;
  pushUndo();
  editEdge(e,{waypoints:[]});
  refreshPanel();
  scheduleAutosave();
  return true;
}
$("btnWps").onclick=rutaAuto;
$("btnDel").onclick=deleteSel;
$("mCopy").onclick=copySel;
$("mCut").onclick=cutSel;
$("mDup").onclick=dupSel;
$("mDel").onclick=deleteSel;

/* ===================== Papelera flotante (táctil) =====================
   Borrar tenía tres vías —la tecla Supr, el botón «Eliminar» del panel y
   «Eliminar» de la selección múltiple— y las dos últimas viven al fondo de un
   cajón que hay que abrir a propósito. Con el dedo, y sin tecla Supr, borrar
   una caja eran cuatro acciones.

   La condición es el TIPO DE PUNTERO, no el ancho de la ventana: un portátil
   con pantalla estrecha tiene teclado y no necesita esto, y una tableta ancha
   sí. isTouch() vive en js/interaction.js, que se carga antes que este archivo.

   Se comprueba con typeof porque refreshPanel() puede llegar a llamarse desde
   selection.js —que se carga ANTES que interaction.js— y una ReferenceError
   aquí se llevaría por delante el panel entero. */
function syncTouchDelete(){
  const hay = selN.size>0 || selE.size>0;
  const tactil = typeof isTouch==="function" && isTouch();
  document.body.classList.toggle("touchSel", hay && tactil);
  syncTouchBar();
}
/* deleteSel() termina en clearSel() -> refreshPanel() -> syncTouchDelete(), así
   que el botón se apaga solo al vaciarse la selección. */
$("btnDelTouch").onclick=deleteSel;

/* ===================== Barra táctil de la selección (FLUYO-018.12) =====================
   La papelera resolvía borrar; esta barra resuelve las otras dos cosas que el
   dedo no podía hacer: conectar sin acertar una flecha diminuta y seleccionar
   varios sin Shift ni marco. Los modos viven en js/interaction.js (touchModes);
   aquí solo se decide qué se enseña.

   Se ve con puntero táctil y selección, o mientras un modo esté abierto (con el
   puntero que sea: un modo abierto nunca puede quedar invisible). Nunca durante
   el Playback ni en Present, donde no se edita. typeof porque refreshPanel()
   puede llegar antes de que interaction.js haya definido touchModes(). */
function syncTouchBar(){
  const bar=$("touchBar"); if(!bar) return;
  const tm=typeof touchModes==="function" ? touchModes() : {multi:false, link:null};
  const frozen=(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()) || presenting;
  const total=selN.size+selE.size;
  const touch=typeof isTouch==="function" && isTouch();
  const linking=tm.link!==null;
  const show=!frozen && (tm.multi || linking || (touch && total>0));
  bar.hidden=!show;
  if(!show) return;
  const s=singleSel();
  $("tbMsg").textContent = linking ? "Toca el elemento de destino"
    : tm.multi ? (total ? total+(total===1?" seleccionado":" seleccionados") : "Toca elementos para seleccionarlos")
    : "";
  $("tbConnect").hidden = linking || tm.multi || !(s && s.type==="node" && s.obj);
  $("tbMulti").hidden = linking || tm.multi;
  $("tbAll").hidden = !tm.multi;
  $("tbDone").hidden = !tm.multi;
  $("tbCancel").hidden = !linking;
}
$("tbConnect").onclick=()=>startTouchLink();
$("tbCancel").onclick=()=>cancelTouchLink();
$("tbMulti").onclick=()=>setTouchMulti(true);
$("tbDone").onclick=()=>setTouchMulti(false);
$("tbAll").onclick=()=>selectAll();

/* Con el dedo la UI necesita alguna pista más que con ratón (p. ej. el menú de
   la pestaña activa). Se decide por el ÚLTIMO puntero usado, igual que la
   papelera: un equipo híbrido cambia de una a otra según cómo se use. */
document.addEventListener("pointerdown", ev=>{
  document.body.classList.toggle("touchUI", ev.pointerType==="touch");
}, true);

/* ===================== Rail / barra superior ===================== */
function setMode(m){ mode=m; pendingShape=null; pendingIcon=null; pendingAnim=null; connecting=null; syncRail(); }
function syncRail(){
  document.querySelectorAll(".rail button").forEach(b=>{
    b.classList.toggle("toggled",
      (b.dataset.mode && b.dataset.mode===mode && !pendingShape && !pendingIcon && !pendingAnim) ||
      (b.dataset.shape && b.dataset.shape===pendingShape));
  });
  const iconsOpen=$("iconDrawer").style.display==="block";
  const animsOpen=$("animDrawer").style.display==="block";
  $("btnIcons").classList.toggle("toggled", iconsOpen);
  $("btnAnims").classList.toggle("toggled", animsOpen || !!pendingAnim);
  /* los cajones ya son role="dialog" y Esc los cierra, pero sin aria-expanded
     un lector de pantalla no anuncia si están abiertos o cerrados */
  $("btnIcons").setAttribute("aria-expanded", String(iconsOpen));
  $("btnAnims").setAttribute("aria-expanded", String(animsOpen));
}
document.querySelectorAll(".rail button[data-mode],.rail button[data-shape]").forEach(b=>{
  b.onclick=()=>{
    if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()) return;
    if(b.dataset.mode) setMode(b.dataset.mode);
    else { pendingShape=b.dataset.shape; pendingIcon=null; pendingAnim=null; mode="select"; connecting=null; syncRail(); }
  };
});
/* El icono lo decide la clase `toggled` (CSS); aquí solo cambia la palabra. */
function setPlayLabel(txt){ const b=$("btnPlay"), l=b.querySelector && b.querySelector(".lbl"); if(l) l.textContent=txt; else b.textContent=txt; }
function togglePlay(){
  if(playing){ pausedAt=now(); playing=false; setPlayLabel("Play"); $("btnPlay").classList.remove("toggled"); }
  else { t0=performance.now()-pausedAt*1000; playing=true; setPlayLabel("Pausa"); $("btnPlay").classList.add("toggled"); }
}
$("btnPlay").onclick=togglePlay;
/* Estos cinco iban asignados dos veces por un merge: la segunda asignación,
   sin scheduleAutosave(), ganaba y dejaba tema, velocidad, puntos y aparición
   fuera del autoguardado. Queda solo la versión que sí guarda. */
/* FLUYO-018.7a: tema y fondo pasan por setThemeIn (model.js, la misma que set_theme de MCP). Sin Undo: son del documento, no de la página. */
$("themeSel").onchange=()=>{ setThemeIn(doc,{theme:$("themeSel").value}); scheduleAutosave(); };
$("speedIn").oninput=()=>{ settings.speed=+$("speedIn").value; scheduleAutosave(); };
$("dotsIn").oninput=()=>{ settings.dots=+$("dotsIn").value; scheduleAutosave(); };
$("buildChk").onchange=()=>{ settings.build=$("buildChk").checked; t0=performance.now(); pausedAt=0; scheduleAutosave(); };
$("staggerIn").oninput=()=>{ settings.stagger=+$("staggerIn").value; scheduleAutosave(); };
$("chkSingle").onchange=()=>{ settings.single=$("chkSingle").checked; scheduleAutosave(); };
$("chkGrid").onchange=()=>{ settings.grid=$("chkGrid").checked; scheduleAutosave(); };
$("chkSnap").onchange=()=>{ settings.snap=$("chkSnap").checked; scheduleAutosave(); };
$("bgCustom").oninput=()=>{ setThemeIn(doc,{customBg:$("bgCustom").value}); scheduleAutosave(); };
$("btnBgClear").onclick=()=>{ setThemeIn(doc,{customBg:""}); scheduleAutosave(); };
$("btnClear").onclick=()=>{
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){ if(typeof scReset==="function") scReset(); return; }
  if(confirm("Limpiar página\n\nSe eliminarán los elementos y las historias de esta página.\n\nLos Eventos del proyecto se conservarán.\n\n¿Limpiar página?")){
    if(typeof scReset==="function") scReset();
    pushUndo();
    clearPageContents(P());
    clearSel();
    if(typeof scSelectStory==="function") scSelectStory(null); else if(typeof scActiveId!=="undefined") scActiveId=null;
    if(typeof scRenderPanel==="function") scRenderPanel();
  }
};

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
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()) return;
  const dr=$("iconDrawer");
  const show=dr.style.display!=="block";
  $("animDrawer").style.display="none";
  dr.style.display=show?"block":"none";
  /* en móvil el cajón y la hoja del panel se tapan entre sí: abrir uno cierra la otra */
  if(show && isSheetLayout()) closeSurface();
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
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()) return;
  const dr=$("animDrawer");
  const show=dr.style.display!=="block";
  $("iconDrawer").style.display="none";
  dr.style.display=show?"block":"none";
  if(show && isSheetLayout()) closeSurface();
  syncRail();
};

/* ===================== Páginas ===================== */
function renderTabs(){
  /* FLUYO-016: la Historia seleccionada es de la página; un cambio de página la descarta. */
  if(typeof scSyncPage==="function") scSyncPage();
  const bar=$("pagesBar"); bar.innerHTML="";
  doc.pages.forEach((pg,i)=>{
    const t=document.createElement("div");
    t.className="tab"+(i===doc.cur?" active":"");
    const name=document.createElement("span"); name.textContent=pg.name;
    t.appendChild(name);
    /* FLUYO-018.12: renombrar era solo doble clic + prompt(), y con el dedo el doble
       toque no llega a la pestaña. La activa lleva un ▾ (visible con puntero táctil,
       CSS) que abre el menú de la página; tocar la pestaña activa también lo abre. */
    if(i===doc.cur){
      /* span con rol de botón, como la ✕ de al lado: dentro de la pestaña, y sin convertirse en un segundo
         `#pagesBar button` (ese es «＋» para quien lo busca). Teclado: Enter y Espacio. */
      const more=document.createElement("span");
      more.className="pgMore"; more.textContent="▾"; more.title="Opciones de la página"; more.tabIndex=0;
      if(more.setAttribute){ more.setAttribute("role","button"); more.setAttribute("aria-haspopup","true"); more.setAttribute("aria-label","Opciones de la página "+pg.name); }
      more.onclick=ev=>{ ev.stopPropagation(); openPageMenu(i, more); };
      more.onkeydown=ev=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); ev.stopPropagation(); openPageMenu(i, more); } };
      t.appendChild(more);
    }
    if(doc.pages.length>1){
      const x=document.createElement("span"); x.className="x"; x.textContent="✕";
      x.title="Cerrar página";
      /* FLUYO-018.7c: confirmación con impacto, deletePageIn (regla de cur del dominio) y un Undo que reinserta la misma página
         (selection.js). Sustituye al hotfix de 018.7a, que vaciaba Undo/Redo porque las entradas identificaban la página por índice. */
      x.onclick=ev=>{ ev.stopPropagation(); requestDeletePage(i); };
      t.appendChild(x);
    }
    t.onpointerdown=ev=>{ t.lastPointer=ev.pointerType; };
    t.onclick=()=>{
      if(i===doc.cur && t.lastPointer==="touch"){ openPageMenu(i, t); return; }
      if(i!==doc.cur && typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){
        if(typeof scReset==="function") scReset();
      }
      doc.cur=i; clearSel(); renderTabs(); scheduleAutosave();
    };
    t.ondblclick=()=>{
      /* Con el dedo manda el menú: dos toques seguidos (cambiar de pestaña y tocar la activa) llegan como dblclick sintético y
         abrirían a la vez el menú y el prompt. El doble clic queda para el ratón, como siempre. */
      if(t.lastPointer==="touch") return;
      if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()) return;
      const nn=prompt("Nombre de la página:",pg.name); if(!nn) return;
      try{ renamePage(i,nn); }
      catch(err){
        if(err && err.code==="invalid_page_name"){ alert(`El nombre de la página debe tener entre 1 y ${PAGE_NAME_MAX} caracteres.`); return; }
        throw err;
      }
      renderTabs(); scheduleAutosave();
    };
    bar.appendChild(t);
  });
  const add=document.createElement("button");
  /* FLUYO-018.13: el «＋» sigue en el texto (accesible, y es como lo buscan los tests); el trazo lo pinta .pgAdd (styles.css). */
  add.textContent="＋"; add.title="Nueva página"; add.className="pgAdd btnGhost";
  add.onclick=()=>{
    if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){ if(typeof scReset==="function") scReset(); }
    addPage(); clearSel(); renderTabs(); scheduleAutosave();
  };
  bar.appendChild(add);
}
/* ===================== Menú de la página (FLUYO-018.12) =====================
   Renombrar y eliminar sin doble clic. Reutiliza el aspecto de los menús de
   Historias (.scPopover) y su comportamiento: interruptor sobre su botón, se
   cierra al tocar fuera o con Escape. Renombrar es un campo en el propio menú, no
   un prompt(): el nombre inválido se explica ahí mismo y no se pierde lo escrito.
   Eliminar delega en requestDeletePage (la misma confirmación y el mismo Undo que
   la ✕). Este tramo (de renderTabs al marcador de Modo presentación) lo copian
   los arneses de vm con un DOM mínimo: aquí solo se DECLARA; nada se ejecuta al
   cargar y nada de esto se llama desde renderTabs salvo al pulsar. */
let pageMenuAnchor=null;
function closePageMenu(restore){
  const m=$("pageMenu");
  if(m.hidden) return;
  m.hidden=true; m.replaceChildren();
  if(restore && pageMenuAnchor && pageMenuAnchor.isConnected) pageMenuAnchor.focus();
  pageMenuAnchor=null;
}
function placePageMenu(anchor){
  const m=$("pageMenu");
  const r=anchor && anchor.isConnected ? anchor.getBoundingClientRect() : {left:12, top:innerHeight-60};
  m.style.left=Math.max(8, Math.min(r.left, innerWidth-m.offsetWidth-8))+"px";
  m.style.top=Math.max(8, r.top-m.offsetHeight-6)+"px";
}
function openPageMenu(i, anchor){
  const m=$("pageMenu"), pg=doc.pages[i];
  if(!pg) return;
  if(!m.hidden && pageMenuAnchor===anchor){ closePageMenu(true); return; }
  m.replaceChildren(); m.hidden=false; pageMenuAnchor=anchor;
  const head=document.createElement("div"); head.className="scMenuHead"; head.textContent=pg.name; m.appendChild(head);
  const playing=typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive();
  const item=(label, fn, cls)=>{ const b=document.createElement("button"); b.type="button"; b.textContent=label; if(cls) b.className=cls; b.onclick=fn; m.appendChild(b); return b; };
  const ren=item("Renombrar…", ()=>showPageRename(i));
  /* como el doble clic: con una Historia reproduciéndose no se toca la página */
  ren.disabled=playing;
  if(doc.pages.length>1) item("Eliminar página", ()=>{ closePageMenu(false); requestDeletePage(i); }, "scMenuDanger");
  placePageMenu(anchor);
  const first=m.querySelector("button:not(:disabled)"); if(first) first.focus();
}
function showPageRename(i){
  const m=$("pageMenu"), pg=doc.pages[i];
  if(!pg) return;
  m.replaceChildren();
  const label=document.createElement("label"); label.textContent="Nombre de la página";
  const input=document.createElement("input");
  input.id="pageNameIn"; input.value=pg.name; input.maxLength=PAGE_NAME_MAX; input.autocomplete="off";
  label.appendChild(input); m.appendChild(label);
  const err=document.createElement("p"); err.className="pmError"; err.setAttribute("role","alert"); err.hidden=true; m.appendChild(err);
  const save=document.createElement("button"); save.type="button"; save.id="pageNameSave"; save.textContent="Guardar nombre"; m.appendChild(save);
  const commit=()=>{
    try{ renamePage(i, input.value); }
    catch(e){
      if(e && e.code==="invalid_page_name"){ err.textContent=`Escribe un nombre de 1 a ${PAGE_NAME_MAX} caracteres.`; err.hidden=false; input.focus(); return; }
      throw e;
    }
    closePageMenu(false); renderTabs(); scheduleAutosave();
  };
  save.onclick=commit;
  input.onkeydown=ev=>{ if(ev.key==="Enter"){ ev.preventDefault(); commit(); } };
  placePageMenu(pageMenuAnchor);
  input.focus(); input.select();
}

/* ===================== Modo presentación =====================
   Cada página pasa a ser una diapositiva: pantalla completa, interfaz fuera y el
   diagrama encajado en la pantalla; ← y → cambian de página.

   La vista previa (posición y zoom) se guarda y se restaura al salir, para que
   quien estaba trabajando en una esquina del lienzo vuelva exactamente ahí. */
let preView=null;
function updatePresentBar(){
  $("prPos").textContent=(doc.cur+1)+" / "+doc.pages.length;
  $("prPrev").disabled=doc.cur===0;
  $("prNext").disabled=doc.cur===doc.pages.length-1;
  if(typeof presentStoryRefresh==="function") presentStoryRefresh();
}
function goSlide(i){
  const j=clamp(i,0,doc.pages.length-1);
  if(j===doc.cur) return;
  /* la Historia pertenece a la página: al cambiar de diapositiva se detiene */
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){ if(typeof scReset==="function") scReset(); }
  doc.cur=j; clearSel(); renderTabs();
  /* la aparición se reinicia en cada diapositiva: si no, a partir de la segunda
     ya habría terminado y el diagrama saldría montado de golpe */
  if(settings.build){ t0=performance.now(); pausedAt=0; }
  fitViewPresent();
  updatePresentBar();
}
function nextSlide(){ goSlide(doc.cur+1); }
function prevSlide(){ goSlide(doc.cur-1); }
function enterPresent(){
  if(presenting) return;
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){ if(typeof scReset==="function") scReset(); }
  commitEditBox();
  checkAnalyticsEdit();
  /* el foco no debe quedarse en «Presentar» (oculto): Espacio/Enter son de Present */
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
  preView={x:viewX, y:viewY, z:viewZoom};
  presenting=true;
  cancelTouchModes();
  clearSel();
  setMode("select");
  $("iconDrawer").style.display="none";
  $("animDrawer").style.display="none";
  closeMoreMenu(false); closeCanvasMenu(false); closePageMenu(false);
  closeSurface();
  document.body.classList.add("presenting");
  /* la pantalla completa puede denegarse (permiso, iframe sin allow). No es
     motivo para no presentar: el modo funciona igual dentro de la ventana. */
  if(document.documentElement.requestFullscreen)
    document.documentElement.requestFullscreen().catch(()=>{});
  if(settings.build){ t0=performance.now(); pausedAt=0; }
  /* el layout aún no se ha rehecho tras esconder la interfaz: sin esperar un
     fotograma, fitView mediría el lienzo con el tamaño viejo */
  scheduleEditorResize(fitViewPresent);
  updatePresentBar();
  /* Sin propiedades a propósito. Llevaba `pages`, el número de páginas del
     documento: el único dato de toda la telemetría derivado del contenido del
     usuario, y no se usaba para nada. Quitarlo deja la promesa de la política
     más apretada —ningún evento lleva ya nada que salga de lo que dibujaste— y
     el evento sigue respondiendo lo que se le pedía: si alguien presenta. */
  trackEvent("present_started");
}
function exitPresent(){
  if(!presenting) return;
  /* salir limpia el runtime de la Historia: sin tokens, cues ni RAF residuales */
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){ if(typeof scReset==="function") scReset(); }
  presenting=false;
  document.body.classList.remove("presenting");
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  if(preView){ viewX=preView.x; viewY=preView.y; viewZoom=preView.z; preView=null; }
  scheduleEditorResize();
  if(typeof presentStoryRefresh==="function") presentStoryRefresh();
}
$("btnPresent").onclick=enterPresent;
$("prNext").onclick=nextSlide;
$("prPrev").onclick=prevSlide;
$("prExit").onclick=exitPresent;
$("psPlay").onclick=presentPlay;
$("psStop").onclick=presentStop;
$("psEdit").onclick=exitPresent;
/* el diagrama se vuelve a encajar si cambia el viewport mientras se presenta */
window.addEventListener("resize", ()=>{ if(presenting) scheduleEditorResize(fitViewPresent); });
/* salir de la pantalla completa por la vía del navegador (Esc, F11) también
   tiene que deshacer el modo; si no, la interfaz se quedaría escondida */
document.addEventListener("fullscreenchange", ()=>{
  if(!document.fullscreenElement && presenting) exitPresent();
});

/* ===================== Modo de trabajo y superficies (FLUYO-018.12 → 018.14b) =====================
   Dos modos de toda la interfaz (B1): EDITAR construye el diagrama; HISTORIA lo cuenta. El modo es estado de UI y vive
   en UN sitio, `uiMode`; `body.storyMode` lo refleja para el CSS (rail fuera, superficie de Historia, conmutador de la
   cabecera) y activeSurface() se deriva de él. No se guarda en el documento.

   El panel derecho muestra la superficie del modo: Propiedades (Editar) o Historias (Historia). En escritorio es una
   columna fija; a ≤700 px es una hoja inferior que se abre y se cierra (`body.panelOpen`), con su propio cierre, y la
   de Historias tiene dos alturas (compacta / ampliada, `body.storyExpanded`) sin gestos nuevos.

   openSurface/closeSurface/toggleSurface siguen siendo la única puerta (decisión 117): quien quiere Historias llama a
   openSurface("stories") y no sabe si eso es una columna, una hoja o un modo. */
const mqCompact=window.matchMedia ? matchMedia("(max-width: 1100px)") : null;
const mqSheet=window.matchMedia ? matchMedia("(max-width: 700px)") : null;
let uiMode="edit";
function isSheetLayout(){ return !!(mqSheet && mqSheet.matches); }
function activeSurface(){ return uiMode==="story" ? "stories" : "properties"; }
/* La hoja de Historias en su altura compacta: ahí la biblioteca de eventos va como paleta flotante (editor-scenarios.js). */
function storyCompactSheet(){ return uiMode==="story" && isSheetLayout() && !document.body.classList.contains("storyExpanded"); }
function syncSurfaceButtons(){
  const open=document.body.classList.contains("panelOpen"), s=activeSurface();
  $("btnPanel").setAttribute("aria-expanded", String(open && s==="properties"));
  $("btnStories").setAttribute("aria-expanded", String(uiMode==="story" && (open || !isSheetLayout())));
  for(const [id, on] of [["tabProperties", uiMode==="edit"], ["tabScenarios", uiMode==="story"]]){
    const b=$(id); b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on));
  }
}
function setUiMode(mode){
  const story=mode==="story";
  const playing=typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive();
  /* B3: salir del modo nunca se bloquea; si se estaba reproduciendo, se detiene antes (sin restos, decisión 64). */
  if(!story && playing && typeof scReset==="function") scReset();
  if(story && uiMode!=="story"){
    /* se narra, no se construye: fuera herramientas armadas, cajones y modos táctiles */
    if(typeof cancelTouchModes==="function") cancelTouchModes();
    setMode("select");
    $("iconDrawer").style.display="none"; $("animDrawer").style.display="none"; syncRail();
  }
  uiMode=story ? "story" : "edit";
  document.body.classList.toggle("storyMode", story);
  if(!story) setStoryExpanded(false);
  $("panelProperties").style.display = story ? "none" : "block";
  $("panelScenarios").style.display = story ? "flex" : "none";
  $("panelScenarios").closest("aside").classList.toggle("scenariosOpen", story);
  if(!story && typeof scCancelPlacement === "function"){ scCancelPlacement(); scHidePalette(); }
  if(story){
    if(typeof ensureScenariosUI === "function") ensureScenariosUI();
    if(typeof scRefreshIfVisible === "function") scRefreshIfVisible();
    if(typeof scSyncCompact === "function") scSyncCompact();
  } else {
    refreshPanel();
  }
  if(typeof scRenderCanvasActions === "function") scRenderCanvasActions();
  syncSurfaceButtons();
}
/* Compatibilidad: scRun y quien pulsaba las antiguas pestañas siguen llamando a switchPanelTab. */
function switchPanelTab(tab){ setUiMode(tab==="scenarios" ? "story" : "edit"); }
function setStoryExpanded(on){
  const was=document.body.classList.contains("storyExpanded");
  document.body.classList.toggle("storyExpanded", !!on);
  $("btnStoryExpand").setAttribute("aria-expanded", String(!!on));
  $("btnStoryExpand").setAttribute("aria-label", on ? "Reducir la hoja de Historias" : "Ampliar la hoja de Historias");
  if(was!==!!on && typeof scSyncCompact==="function") scSyncCompact();
}
function openSurface(name){
  const playing=typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive();
  if(name==="properties" && playing) name="stories";
  const mode=name==="stories" ? "story" : "edit";
  if(uiMode!==mode) setUiMode(mode);
  document.body.classList.add("panelOpen");
  syncSurfaceButtons();
  revealAboveSheet(name==="stories" ? "page" : "selection");
}
/* La hoja tapa la mitad inferior del lienzo. Si lo que importa queda debajo —la
   selección al abrir Propiedades, el diagrama al abrir Historias o al reproducir—
   la vista se desplaza para que se vea en la zona libre de encima. Solo si hace
   falta: si ya se ve, no se toca la vista del usuario. Con la selección solo se
   desplaza; con la página entera también reduce el zoom si no cabe. La altura de
   la hoja se lee de su caja (offsetHeight no depende de la transición). */
function revealAboveSheet(what){
  if(!isSheetLayout() || !document.body.classList.contains("panelOpen")) return;
  const cr=cv.getBoundingClientRect();
  const visTop=cr.top, visBot=Math.min(cr.bottom, $("bottomBar").getBoundingClientRect().top - document.querySelector("aside").offsetHeight);
  const availH=visBot-visTop;
  if(availH<80) return;
  let box=null;
  if(what==="selection"){
    const ns=[...selN].map(nodeById).filter(Boolean);
    if(!ns.length) return;
    const x0=Math.min(...ns.map(n=>n.x-n.w/2)), y0=Math.min(...ns.map(n=>n.y-n.h/2));
    box={x:x0, y:y0, w:Math.max(...ns.map(n=>n.x+n.w/2))-x0, h:Math.max(...ns.map(n=>n.y+n.h/2))-y0};
  } else if(P().nodes.length) box=getBounds();
  if(!box) return;
  const top=visTop+viewY+box.y*viewZoom, bot=top+box.h*viewZoom;
  if(top>=visTop && bot<=visBot) return;
  if(what==="page"){
    const z=Math.min(viewZoom, cr.width/box.w, availH/box.h);
    viewZoom=Math.max(0.05, z);
    viewX=(cr.width-box.w*viewZoom)/2 - box.x*viewZoom;
  }
  viewY=(availH-box.h*viewZoom)/2 - box.y*viewZoom;
}
function closeSurface(){
  document.body.classList.remove("panelOpen");
  syncSurfaceButtons();
}
/* Salir del modo Historia: la salida inequívoca (B1/B2). En la hoja móvil, además, vuelve al lienzo. */
function exitStoryMode(){
  setUiMode("edit");
  if(isSheetLayout()) closeSurface();
}
function toggleSurface(name){
  const playing=typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive();
  const open=document.body.classList.contains("panelOpen");
  const mine=activeSurface()===name || (name==="properties" && playing);
  if(isSheetLayout() && open && mine){ if(name==="stories") exitStoryMode(); else closeSurface(); }
  else openSurface(name);
}
$("btnPanel").onclick=()=>toggleSurface("properties");
$("btnStories").onclick=()=>toggleSurface("stories");
$("btnPanelClose").onclick=()=>closeSurface();
$("btnStoryExit").onclick=()=>exitStoryMode();
$("btnStoryExpand").onclick=()=>{ setStoryExpanded(!document.body.classList.contains("storyExpanded")); revealAboveSheet("page"); };
$("tabProperties").onclick=()=>setUiMode("edit");
$("tabScenarios").onclick=()=>setUiMode("story");

/* Tocar fuera (B8). Con la hoja de Propiedades abierta, un toque sin arrastre en el VACÍO del lienzo (el mismo que
   deselecciona) cierra la hoja: no hace falta buscar la ✕. Tocar otro elemento cambia la selección y la hoja se queda.
   En Historias el lienzo sirve para colocar eventos, así que tocarlo no sale del modo: solo devuelve la hoja ampliada a
   su altura compacta. Sin velo: el lienzo sigue manejable con la hoja abierta. */
(function sheetTapOutside(){
  let down=null;
  cv.addEventListener("pointerdown", ev=>{ down={x:ev.clientX, y:ev.clientY, id:ev.pointerId}; }, true);
  cv.addEventListener("pointerup", ev=>{
    const d=down; down=null;
    if(!d || d.id!==ev.pointerId || Math.hypot(ev.clientX-d.x, ev.clientY-d.y)>8) return;
    if(!isSheetLayout() || !document.body.classList.contains("panelOpen")) return;
    setTimeout(()=>{
      const tm=typeof touchModes==="function" ? touchModes() : {multi:false, link:null};
      if(uiMode==="edit" && selN.size+selE.size===0 && !tm.multi && tm.link===null) closeSurface();
      else if(uiMode==="story" && document.body.classList.contains("storyExpanded")) setStoryExpanded(false);
    }, 0);
  }, true);
})();

/* ===================== Menús de la cabecera: «Lienzo» y «Más» (FLUYO-018.12 D8, 018.14b) =====================
   «Lienzo» = ajustes del DOCUMENTO (tema, fondo, tipografía global, cuadrícula, ajustar). «Más» = Archivo, la
   INTERFAZ (preferencia del navegador) y los enlaces del proyecto. Se cierran al tocar fuera, con Escape, con su botón o
   al usar una acción; los selectores y casillas no los cierran, que se suelen tocar varios seguidos. */
function placeMenu(menu, btn){
  const hb=document.querySelector("header").getBoundingClientRect(), br=btn.getBoundingClientRect();
  menu.style.top=(hb.bottom+6)+"px";
  if(btn.id==="btnCanvas"){
    const w=menu.offsetWidth || 296;
    menu.style.left=Math.max(8, Math.min(br.right-w, innerWidth-w-8))+"px"; menu.style.right="auto";
  }
}
function openMoreMenu(){
  closeCanvasMenu(false);
  const m=$("moreMenu");
  m.hidden=false;
  placeMenu(m, $("btnMore"));
  $("btnMore").setAttribute("aria-expanded","true");
  const first=m.querySelector("button,select,input,a"); if(first) first.focus();
}
function closeMoreMenu(restore){
  const m=$("moreMenu");
  if(m.hidden) return;
  m.hidden=true;
  $("btnMore").setAttribute("aria-expanded","false");
  if(restore) $("btnMore").focus();
}
function openCanvasMenu(){
  closeMoreMenu(false);
  const m=$("canvasMenu");
  m.hidden=false;
  placeMenu(m, $("btnCanvas"));
  $("btnCanvas").setAttribute("aria-expanded","true");
  const first=m.querySelector("select,input,button"); if(first) first.focus();
}
function closeCanvasMenu(restore){
  const m=$("canvasMenu");
  if(m.hidden) return;
  m.hidden=true;
  $("btnCanvas").setAttribute("aria-expanded","false");
  if(restore) $("btnCanvas").focus();
}
$("btnMore").onclick=()=>{ if($("moreMenu").hidden) openMoreMenu(); else closeMoreMenu(true); };
$("btnCanvas").onclick=()=>{ if($("canvasMenu").hidden) openCanvasMenu(); else closeCanvasMenu(true); };
$("moreMenu").addEventListener("click", ev=>{
  const b=ev.target.closest("button,a");
  if(b && b.id!=="btnBgClear") closeMoreMenu(false);
});
document.addEventListener("pointerdown", ev=>{
  const m=$("moreMenu");
  if(!m.hidden && !m.contains(ev.target) && !$("btnMore").contains(ev.target)) closeMoreMenu(false);
  const cm=$("canvasMenu");
  if(!cm.hidden && !cm.contains(ev.target) && !$("btnCanvas").contains(ev.target)) closeCanvasMenu(false);
  const pm=$("pageMenu");
  if(!pm.hidden && !pm.contains(ev.target) && !(pageMenuAnchor && pageMenuAnchor.contains(ev.target))) closePageMenu(false);
}, true);
document.addEventListener("keydown", ev=>{
  if(ev.key!=="Escape") return;
  if(!$("pageMenu").hidden){ ev.stopPropagation(); closePageMenu(true); return; }
  if(!$("canvasMenu").hidden){ ev.stopPropagation(); closeCanvasMenu(true); return; }
  if(!$("moreMenu").hidden){ ev.stopPropagation(); closeMoreMenu(true); }
}, true);

/* ===================== Tema de la INTERFAZ (FLUYO-018.14b, B4) =====================
   Preferencia de este navegador, no del documento: se guarda en localStorage["fluyo.ui.theme"] y NUNCA entra en
   serializeProject, el autoguardado ni los enlaces. No lee ni escribe doc.theme (el tema del lienzo, en «Lienzo»), ni al
   revés. El <head> ya la aplicó antes del primer pintado; aquí se sincroniza el interruptor y se guarda el cambio. Un
   localStorage inaccesible (modo privado estricto) deja la interfaz clara y el editor funcionando. */
const UI_THEME_KEY="fluyo.ui.theme";
function readUiTheme(){ try{ return localStorage.getItem(UI_THEME_KEY)==="dark" ? "dark" : "light"; }catch(e){ return "light"; } }
function applyUiTheme(theme){
  const dark=theme==="dark";
  if(dark) document.documentElement.setAttribute("data-ui-theme","dark"); else document.documentElement.removeAttribute("data-ui-theme");
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.setAttribute("content", dark ? "#1A1913" : "#F2EDE3");
  $("chkUiDark").checked=dark;
}
function setUiTheme(theme){
  applyUiTheme(theme);
  try{ if(theme==="dark") localStorage.setItem(UI_THEME_KEY,"dark"); else localStorage.removeItem(UI_THEME_KEY); }catch(e){}
}
applyUiTheme(readUiTheme());
$("chkUiDark").onchange=()=>setUiTheme($("chkUiDark").checked ? "dark" : "light");

/* ===================== Cabecera adaptable (FLUYO-018.12 → 018.14b) =====================
   Reubicar, no rediseñar. Los mismos elementos (mismos ids, mismos handlers) cambian de sitio según la anchura:
     · >700 px: cabecera de tres zonas; «Lienzo» es un popover y Archivo vive en «Más».
     · ≤700 px: Exportar va a «Más» (dentro de Archivo, antes de Limpiar), la sección Lienzo también, y Presentar baja a
       la barra inferior junto a Historias. Cabecera: Deshacer/Rehacer · Compartir · ⚙ · Más.
   Mover un nodo del DOM conserva sus handlers, así que nadie más se entera. */
function placeChrome(){
  const mobile=isSheetLayout();
  const header=document.querySelector("header"), more=$("moreTools"), tools=$("hdrTools");
  const exp=$("btnExport"), pres=$("btnPresent"), canvasTools=$("canvasTools");
  if(mobile){
    if(exp.parentNode!==tools) tools.insertBefore(exp, $("btnClear"));
    if(canvasTools.parentNode!==more) more.appendChild(canvasTools);
    if(pres.parentNode!==$("modeBar")) $("modeBar").appendChild(pres);
  } else {
    if(exp.parentNode!==header) header.insertBefore(exp, $("btnShare"));
    if(canvasTools.parentNode!==$("canvasMenu")) $("canvasMenu").appendChild(canvasTools);
    if(pres.parentNode!==header) header.insertBefore(pres, $("btnPanel"));
  }
  closeMoreMenu(false); closeCanvasMenu(false);
  if(!mobile) document.body.classList.remove("panelOpen");
  else if(uiMode==="story") document.body.classList.add("panelOpen");
  applyGroupDefaults();
  if(typeof scSyncCompact==="function") scSyncCompact();
  syncSurfaceButtons();
}
for(const mq of [mqCompact, mqSheet]) if(mq && mq.addEventListener) mq.addEventListener("change", placeChrome);

/* ===================== Deshacer / Rehacer visibles (FLUYO-018.12) =====================
   Hasta ahora solo existían como atajo: con el dedo, cualquier error era
   definitivo. Los botones llaman a lo mismo que Ctrl+Z / Ctrl+Y. Se apagan con la
   pila vacía y mientras el documento está congelado (Playback, Present). El
   estado se sincroniza desde el bucle del editor (editor-runtime.js), que es el
   único sitio por el que pasan TODAS las formas de llenar o vaciar las pilas
   (gestos, panel, Historias, abrir un documento…); solo escribe si cambia. */
function syncHistoryButtons(){
  const frozen=presenting || (typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive());
  const u=!frozen && undoStack.length>0, r=!frozen && redoStack.length>0;
  const bu=$("btnUndo"), br=$("btnRedo");
  if(bu.disabled===u) bu.disabled=!u;
  if(br.disabled===r) br.disabled=!r;
}
$("btnUndo").onclick=()=>{ commitEditBox(); undo(); syncHistoryButtons(); };
$("btnRedo").onclick=()=>{ commitEditBox(); redo(); syncHistoryButtons(); };

/* ===================== Vista del lienzo (FLUYO-018.13) =====================
   Zoom con botones, alrededor del centro del lienzo y con los mismos pasos y
   topes que Ctrl+rueda (interaction.js). «100%» vuelve a escala real y el
   botón de encajar usa fitView, como al abrir un documento. Solo la vista: ni
   Undo ni autoguardado. La lectura del zoom se sincroniza desde el bucle del
   editor, igual que Deshacer/Rehacer, y solo escribe si cambia. */
function zoomTo(z){
  const r=cv.getBoundingClientRect(), sx=r.width/2, sy=r.height/2;
  const nz=clamp(z, 0.1, 5), wx=(sx-viewX)/viewZoom, wy=(sy-viewY)/viewZoom;
  viewZoom=nz; viewX=sx-wx*nz; viewY=sy-wy*nz;
  commitEditBox();
}
function zoomBy(f){ zoomTo(viewZoom*f); }
function syncZoomReadout(){
  const el=$("zoomPct"); if(!el) return;
  const t=Math.round(viewZoom*100)+"%";
  if(el.textContent!==t) el.textContent=t;
}
$("zoomOut").onclick=()=>zoomBy(0.9);
$("zoomIn").onclick=()=>zoomBy(1.1);
$("zoomPct").onclick=()=>zoomTo(1);
$("zoomFit").onclick=()=>{ commitEditBox(); fitView(); };

renderTabs();
placeChrome();

/* Ofrece restaurar la sesión guardada, si la hay. Se llama desde el arranque y
   también más tarde, desde quien traía un documento por la URL y no consiguió
   traerlo: en ese caso el prompt se calló esperándole, y hay que ofrecerlo
   igualmente. Es idempotente en la práctica porque solo un camino acaba aquí. */
function offerRestoreIfIdle(){
  if(hasAutosave()) showAutosaveRestorePrompt();
}

/* Si la URL trae un documento, la sesión guardada NO se resuelve aquí: la
   resuelve quien lo traiga, que es el único que sabe si llegó, si era válido y
   qué hay que preguntar. Puede acabar en el modal de conflicto de tres salidas,
   en carga directa si no había nada que perder, o en este mismo prompt si el
   documento no llegó a materializarse. */
if(!urlBringsDocument()) offerRestoreIfIdle();
