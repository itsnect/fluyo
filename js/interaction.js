"use strict";
/* Interacción: puntero, teclado, zoom/pan, pegar/soltar imágenes */

/* ===================== Interacción ===================== */
function toWorld(ev){
  const r=cv.getBoundingClientRect();
  const screenX = ev.clientX-r.left;
  const screenY = ev.clientY-r.top;
  return { x: (screenX - viewX)/viewZoom, y: (screenY - viewY)/viewZoom };
}
function normRect(m){
  return { x:Math.min(m.x0,m.x1), y:Math.min(m.y0,m.y1),
           w:Math.abs(m.x1-m.x0), h:Math.abs(m.y1-m.y0) };
}
function hitNode(x,y){
  const ns=P().nodes;
  for(let i=ns.length-1;i>=0;i--){
    const n=ns[i];
    if(Math.abs(x-n.x)<=n.w/2+4 && Math.abs(y-n.y)<=n.h/2+4) return n;
  }
  return null;
}
function hitEdge(x,y){
  const es=P().edges;
  for(let i=es.length-1;i>=0;i--){
    const pts=edgePoints(es[i]);
    for(let j=1;j<pts.length;j++){
      const p1=pts[j-1], p2=pts[j];
      const L2=(p2.x-p1.x)**2+(p2.y-p1.y)**2; if(L2===0) continue;
      let u=((x-p1.x)*(p2.x-p1.x)+(y-p1.y)*(p2.y-p1.y))/L2; u=clamp(u,0,1);
      const d=Math.hypot(x-(p1.x+u*(p2.x-p1.x)), y-(p1.y+u*(p2.y-p1.y)));
      if(d<8) return es[i];
    }
  }
  return null;
}
function hitSideArrow(n,x,y,r){
  if(!n) return null;
  const rad=r||14;
  for(const s of SIDES){
    const p=sidePoint(n,s), d=DIR[s];
    if(Math.hypot(x-(p.x+d.x*ARROW_OFF), y-(p.y+d.y*ARROW_OFF))<rad) return s;
  }
  return null;
}
/* arrowHostNode() vive en js/selection.js: render.js también la usa y se carga antes. */
/* El radio va en unidades de mundo, así que con zoom bajo un objetivo de 14
   queda por debajo del tamaño de un dedo. */
function arrowHitRadius(){ return isTouch()? Math.max(18, 24/viewZoom) : 14; }
/* Qué nodo tiene una flecha de conexión bajo el punto, en el MISMO orden Z que
   hitNode() —del que está encima hacia abajo—.

   El orden importa: antes esto era un bucle hacia adelante que se quedaba con el
   primer acierto, o sea con el nodo del FONDO. Con dos zonas de flecha que se
   rozan, ganaba el de abajo. */
function hitSideArrowHost(x,y){
  const ns=P().nodes, rad=arrowHitRadius();
  for(let i=ns.length-1;i>=0;i--) if(hitSideArrow(ns[i],x,y,rad)) return ns[i];
  return null;
}
function hitCorner(n,x,y){
  if(!n) return -1;
  const cs=nodeCorners(n);
  for(let i=0;i<4;i++) if(Math.hypot(x-cs[i][0],y-cs[i][1])<10) return i;
  return -1;
}
function hitWaypoint(e,x,y){
  const wps=e.waypoints||[];
  for(let i=0;i<wps.length;i++) if(Math.hypot(x-wps[i].x,y-wps[i].y)<10) return i;
  return -1;
}
function hitMidpoint(e,x,y){
  const pts=edgePoints(e);
  for(let i=1;i<pts.length;i++){
    const mx=(pts[i-1].x+pts[i].x)/2, my=(pts[i-1].y+pts[i].y)/2;
    if(Math.hypot(x-mx,y-my)<9) return i-1;
  }
  return -1;
}

let wasRightDrag = false;
cv.addEventListener("contextmenu", ev => {
  if (wasRightDrag) ev.preventDefault();
});

/* ===================== Gestos táctiles =====================
   Con ratón hay tres botones y una rueda; con un dedo no hay ninguno de los
   cuatro, así que el pan y el zoom necesitan su propia vía:

     · un dedo sobre el vacío  → desplaza el plano (con ratón eso es el marco de
       selección, que en táctil se pierde a cambio de poder moverse)
     · un dedo sobre un nodo   → lo arrastra, igual que con ratón
     · dos dedos               → pellizco para zoom + desplazamiento

   El pellizco cancela cualquier gesto de un dedo que estuviera en curso: si no,
   al apoyar el segundo dedo se arrastraría un nodo mientras se hace zoom. */
const activeTouches=new Map();
let pinch=null, lastPointerType="mouse", lastTap={t:0,x:0,y:0}, downPt=null;
const isTouch=()=>lastPointerType==="touch";
function cancelGestures(){
  drag=null; resizing=null; wpDrag=null; marquee=null; connectDrag=null; panDrag=null;
}
function startPinch(){
  cancelGestures();
  const [a,b]=[...activeTouches.values()];
  pinch={ d0:Math.hypot(a.x-b.x,a.y-b.y)||1, zoom0:viewZoom,
          cx:(a.x+b.x)/2, cy:(a.y+b.y)/2, viewX0:viewX, viewY0:viewY };
}

cv.addEventListener("pointerdown", ev=>{
  lastPointerType = ev.pointerType || "mouse";
  downPt={x:ev.clientX, y:ev.clientY};
  if(ev.pointerType==="touch"){
    activeTouches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    cv.setPointerCapture(ev.pointerId);
    if(activeTouches.size===2){ startPinch(); return; }
    if(activeTouches.size>2) return;
  }
  /* presentando no se edita nada: el lienzo solo se mueve y se amplía */
  if(presenting){
    ev.preventDefault();
    panDrag={ x:ev.clientX, y:ev.clientY, startX:viewX, startY:viewY, isRight:ev.button===2, moved:false, tap:true };
    if(ev.pointerType!=="touch") cv.setPointerCapture(ev.pointerId);
    return;
  }
  if (ev.pointerType!=="touch" && (ev.button === 1 || ev.button === 2 || (ev.button === 0 && ev.altKey))) {
    if (ev.button !== 2) ev.preventDefault();
    panDrag = { x: ev.clientX, y: ev.clientY, startX: viewX, startY: viewY, isRight: ev.button===2, moved: false };
    cv.setPointerCapture(ev.pointerId);
    return;
  }
  if (ev.button !== 0) return;

  ev.preventDefault();
  const p=toWorld(ev); mouse.x=p.x; mouse.y=p.y;
  commitEditBox();
  cv.setPointerCapture(ev.pointerId);

  if(pendingShape || pendingIcon || pendingAnim){
    pushUndo();
    let n;
    if(pendingIcon) n=newNode("icon",p.x,p.y,{icon:pendingIcon, label:ICONS[pendingIcon].n});
    else if(pendingAnim) n=newNode("anim",p.x,p.y,{anim:pendingAnim, label:ANIMS[pendingAnim].n, color:PALETTE[0].c});
    else n=newNode(pendingShape,p.x,p.y);
    /* se mide al colocar el nodo, no al elegirlo en el cajón: elegir solo arma
       la herramienta y el usuario puede no llegar a poner nada nunca */
    if(pendingAnim) trackEvent("gif_animation_added",{anim:pendingAnim});
    trackFirstNode();
    selectOnly("node",n.id);
    pendingShape=null; pendingIcon=null; pendingAnim=null; syncRail();
    return;
  }
  const n=hitNode(p.x,p.y);

  if(mode==="connect"){
    if(n){
      if(connecting===null) connecting=n.id;
      else { pushUndo(); const e=newEdge(connecting,n.id); connecting=null; if(e) selectOnly("edge",e.id); }
    } else connecting=null;
    return;
  }

  // 1) tirador de tamaño (solo con un nodo seleccionado)
  const single=singleSel();
  if(single && single.type==="node" && single.obj){
    const sn=single.obj;
    const ci=hitCorner(sn,p.x,p.y);
    if(ci>=0){
      pushUndo();
      resizing={id:sn.id,
        fx:sn.x+(ci===0||ci===3? sn.w/2 : -sn.w/2),
        fy:sn.y+(ci<=1? sn.h/2 : -sn.h/2),
        aspect:(sn.shape==="image"||sn.shape==="icon")? sn.w/sn.h : null};
      return;
    }
  }
  // 2) codos / puntos medios (solo con una flecha seleccionada)
  if(single && single.type==="edge" && single.obj){
    const se=single.obj;
    const wi=hitWaypoint(se,p.x,p.y);
    if(wi>=0){ pushUndo(); wpDrag={edgeId:se.id, idx:wi}; return; }
    const mi=hitMidpoint(se,p.x,p.y);
    if(mi>=0){
      pushUndo();
      if(se.route==="ortho" && (se.waypoints||[]).length===0){
        const pts=edgePoints(se);
        se.waypoints=pts.slice(1,-1).map(q=>({x:q.x,y:q.y}));
      }
      se.waypoints.splice(mi,0,{x:p.x,y:p.y});
      wpDrag={edgeId:se.id, idx:mi};
      return;
    }
  }
  // 3) flechas direccionales (conexión estilo draw.io)
  const host=arrowHostNode();
  const arrowSide=hitSideArrow(host,p.x,p.y,arrowHitRadius());
  if(arrowSide && host){
    connectDrag={fromId:host.id, fromSide:arrowSide};
    return;
  }
  // 4) nodo → seleccionar / arrastrar grupo
  if(n){
    if(ev.shiftKey){ toggleSel("node",n.id); return; }
    if(!selN.has(n.id)) selectOnly("node",n.id);
    pushUndo();
    drag={offs:{}, wps:[]};
    for(const id of selN){
      const nn=nodeById(id);
      if(nn) drag.offs[id]={dx:p.x-nn.x, dy:p.y-nn.y};
    }
    // los codos de flechas internas al grupo se mueven con él
    for(const e of P().edges){
      if(selN.has(e.from)&&selN.has(e.to))
        (e.waypoints||[]).forEach(w=>drag.wps.push({w, dx:p.x-w.x, dy:p.y-w.y}));
      // si solo un extremo se mueve: conservar la topología (lados) y re-rutear
      else if((selN.has(e.from)||selN.has(e.to)) && (e.waypoints||[]).length){
        const pts=edgePoints(e);
        if(pts.length>1){
          const A2=nodeById(e.from), B2=nodeById(e.to);
          if(A2 && !e.fromSide) e.fromSide=sideOfPoint(A2,pts[0]);
          if(B2 && !e.toSide)   e.toSide=sideOfPoint(B2,pts[pts.length-1]);
        }
        e.waypoints=[]; e.route="ortho";
      }
    }
    return;
  }
  // 5) flecha
  const e=hitEdge(p.x,p.y);
  if(e){
    if(ev.shiftKey) toggleSel("edge",e.id);
    else selectOnly("edge",e.id);
    return;
  }
  // 6) vacío → marco de selección (ratón) o desplazamiento del plano (dedo)
  if(ev.pointerType==="touch"){
    panDrag={ x:ev.clientX, y:ev.clientY, startX:viewX, startY:viewY, isRight:false, moved:false, tap:true };
    return;
  }
  marquee={x0:p.x, y0:p.y, x1:p.x, y1:p.y, add:ev.shiftKey};
});

cv.addEventListener("pointermove", ev=>{
  if(ev.pointerType==="touch" && activeTouches.has(ev.pointerId))
    activeTouches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(pinch){
    if(activeTouches.size<2) return;
    const [a,b]=[...activeTouches.values()];
    const r=cv.getBoundingClientRect();
    const d=Math.hypot(a.x-b.x,a.y-b.y)||1;
    const z=clamp(pinch.zoom0*(d/pinch.d0), 0.1, 5);
    /* el punto del mundo que había bajo el centro inicial de los dedos se queda
       bajo el centro actual: así el diagrama sigue a la mano en vez de escaparse */
    const wx=(pinch.cx-r.left-pinch.viewX0)/pinch.zoom0;
    const wy=(pinch.cy-r.top -pinch.viewY0)/pinch.zoom0;
    viewZoom=z;
    viewX=((a.x+b.x)/2-r.left)-wx*z;
    viewY=((a.y+b.y)/2-r.top )-wy*z;
    commitEditBox();
    return;
  }
  if(panDrag){
    const dx = ev.clientX - panDrag.x;
    const dy = ev.clientY - panDrag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panDrag.moved = true;
    viewX = panDrag.startX + dx;
    viewY = panDrag.startY + dy;
    return;
  }
  const p=toWorld(ev); mouse.x=p.x; mouse.y=p.y;
  if(marquee){ marquee.x1=p.x; marquee.y1=p.y; return; }
  if(drag){
    for(const id in drag.offs){
      const nn=nodeById(+id);
      if(nn){ nn.x=snapV(p.x-drag.offs[id].dx); nn.y=snapV(p.y-drag.offs[id].dy); }
    }
    drag.wps.forEach(o=>{ o.w.x=snapV(p.x-o.dx); o.w.y=snapV(p.y-o.dy); });
    return;
  }
  if(resizing){
    const n=nodeById(resizing.id);
    if(n){
      let w=Math.max(40,Math.abs(p.x-resizing.fx)-6);
      let h=Math.max(30,Math.abs(p.y-resizing.fy)-6);
      if(resizing.aspect){
        if(w/resizing.aspect>h) h=w/resizing.aspect; else w=h*resizing.aspect;
      }
      n.w=Math.round(w); n.h=Math.round(h);
      n.x=Math.round((p.x+resizing.fx)/2); n.y=Math.round((p.y+resizing.fy)/2);
    }
    return;
  }
  if(wpDrag){
    const e=edgeById(wpDrag.edgeId);
    if(e && e.waypoints[wpDrag.idx]){
      e.waypoints[wpDrag.idx].x=snapV(p.x);
      e.waypoints[wpDrag.idx].y=snapV(p.y);
    }
    return;
  }
  /* Una flecha de conexión GANA al nodo que tenga debajo.
     Antes esto era un respaldo condicionado a `!hoverNode`, así que solo corría
     sobre lienzo vacío. Las flechas se dibujan a ARROW_OFF=24 px POR FUERA del
     borde, así que las de un nodo metido dentro de otro caen dentro de la caja
     del de fuera: hitNode devolvía el de fuera, el respaldo no llegaba a
     ejecutarse y los puntos de conexión del de dentro eran inalcanzables.

     No aplica mientras se arrastra una conexión: ahí no hay flechas dibujadas y
     hoverNode es el nodo de destino que se va a resaltar. */
  hoverNode = (connectDrag? null : hitSideArrowHost(p.x,p.y)) || hitNode(p.x,p.y);
  const single=singleSel();
  let cur="default";
  if(pendingShape||pendingIcon||pendingAnim||mode==="connect"||connectDrag) cur="crosshair";
  else if(single&&single.type==="node"&&single.obj&&hitCorner(single.obj,p.x,p.y)>=0) cur="nwse-resize";
  else if(hitSideArrow(arrowHostNode(),p.x,p.y,arrowHitRadius())) cur="crosshair";
  else if(hoverNode) cur="grab";
  cv.style.cursor=cur;
});

function endTouchPointer(ev){
  if(ev.pointerType!=="touch") return false;
  activeTouches.delete(ev.pointerId);
  if(pinch && activeTouches.size<2){
    /* el dedo que queda no debe convertirse en un arrastre: el pellizco ya
       canceló todo, y aquí se corta también el resto del gesto */
    pinch=null; cancelGestures();
    return true;
  }
  return false;
}
cv.addEventListener("pointercancel", ev=>{
  if(ev.pointerType==="touch"){ activeTouches.delete(ev.pointerId); if(activeTouches.size<2) pinch=null; }
  cancelGestures();
});

cv.addEventListener("pointerup", ev=>{
  if(endTouchPointer(ev)) return;
  if(panDrag){
    if (panDrag.isRight && panDrag.moved) {
      wasRightDrag = true;
      setTimeout(() => wasRightDrag = false, 50);
    }
    const wasTap = panDrag.tap && !panDrag.moved;
    panDrag=null;
    /* presentando, un toque sin arrastre pasa a la diapositiva siguiente */
    if(presenting && wasTap && ev.pointerType==="touch") nextSlide();
    else if(wasTap && ev.pointerType==="touch") handleTouchTap(ev);
    return;
  }
  if(presenting) return;
  const p=toWorld(ev);
  const hadDrag=!!(drag||resizing||wpDrag);
  if(connectDrag){
    const tgt=hitNode(p.x,p.y);
    if(tgt && tgt.id!==connectDrag.fromId){
      pushUndo();
      const snapSide=nearestAnchorSide(tgt,p,22);
      const e=newEdge(connectDrag.fromId,tgt.id,{
        fromSide:connectDrag.fromSide,
        toSide:snapSide,
        route:"ortho"
      });
      if(e) selectOnly("edge",e.id);
    }
    connectDrag=null;
  }
  if(marquee){
    const r=normRect(marquee);
    if(r.w>6 || r.h>6){
      if(!marquee.add){ selN.clear(); selE.clear(); }
      for(const nd of P().nodes){
        if(nd.x+nd.w/2>=r.x && nd.x-nd.w/2<=r.x+r.w &&
           nd.y+nd.h/2>=r.y && nd.y-nd.h/2<=r.y+r.h) selN.add(nd.id);
      }
      for(const e of P().edges){
        const m=pointAt(edgePoints(e),.5);
        const inside=m.x>=r.x&&m.x<=r.x+r.w&&m.y>=r.y&&m.y<=r.y+r.h;
        if(inside || (selN.has(e.from)&&selN.has(e.to))) selE.add(e.id);
      }
      refreshPanel();
    } else if(!marquee.add){ clearSel(); }
    marquee=null;
  }
  drag=null; resizing=null; wpDrag=null;
  if(hadDrag) scheduleAutosave();
  if(ev.pointerType==="touch" && downPt && Math.hypot(ev.clientX-downPt.x, ev.clientY-downPt.y)<=6)
    handleTouchTap(ev);
  downPt=null;
});

/* El doble clic no llega con fiabilidad desde una pantalla táctil (el lienzo usa
   touch-action:none, así que el navegador no sintetiza los eventos de ratón),
   y sin él no habría forma de editar un texto con el dedo. */
function isDoubleTap(ev){
  const t=performance.now();
  const dbl=(t-lastTap.t)<320 && Math.hypot(ev.clientX-lastTap.x, ev.clientY-lastTap.y)<26;
  lastTap={t: dbl?0:t, x:ev.clientX, y:ev.clientY};
  return dbl;
}
function handleTouchTap(ev){
  const p=toWorld(ev);
  if(isDoubleTap(ev)){ openEditorAt(p); return; }
  if(!hitNode(p.x,p.y) && !hitEdge(p.x,p.y)) clearSel();
}

/* ===================== Edición in-situ =====================
   El textarea es TRANSPARENTE y se coloca exactamente encima del texto: misma
   familia, mismo tamaño, mismo peso, mismo interlineado, mismo ancho útil y misma
   alineación. Mientras está abierto, drawLabelLines() no pinta esa etiqueta, así
   que lo único que se ve es el textarea — y se ve idéntico al texto que sustituye.

   Por qué un textarea y no dibujar la edición sobre el lienzo: el cursor, la
   selección, la navegación con teclas, el portapapeles, el deshacer del campo, el
   teclado de un móvil, los lectores de pantalla y —sobre todo— el IME de los
   acentos y de los teclados CJK los da el navegador, correctos y gratis. Hacerlos
   a mano sobre canvas son cuatro cifras de líneas y una fuente permanente de
   fallos en composición. Ver INFORME-TEXTO.md §2.

   Y hay una propiedad que no es casualidad: el textarea reparte las líneas con el
   MISMO motor de fuentes que measureText(). Si la familia, el tamaño y el ancho
   coinciden, los saltos coinciden. Cuando llegue el reflow (A2) esto deja de ser
   un detalle y pasa a ser lo que hace que editar y ver sean lo mismo.

   El tamaño ya no es fijo: sale de labelLayout(), igual que el texto pintado. Con
   el autoescalado (A1) la fuente cambia al redimensionar el nodo Y al escribir
   —una línea más larga encoge la fuente—, así que hay que recolocar en cada
   pulsación, no solo al abrir. */
const editBox=$("editBox");
cv.addEventListener("dblclick", ev=>{ if(!presenting) openEditorAt(toWorld(ev)); });

/* Geometría del textarea en coordenadas de MUNDO, derivada de la misma
   maquetación que usa el renderer. Es la única función que sabe convertir un
   objeto editable en una caja de texto; nodos y aristas difieren solo aquí. */
function editBoxGeometry(o){
  const fam=o.font||settings.font||DEFAULT_FONT;
  const peso=o.bold?"bold":"normal";
  if(o.from!==undefined){
    /* Una arista no tiene caja de la que derivar nada: su etiqueta flota sobre la
       línea, centrada en el punto que eligió placeEdgeLabels. El ancho es holgura
       para poder escribir, no un límite del documento. */
    const fs=edgeLabelFs(o), lh=fs*LABEL_LH;
    const m=labelPointFor(o, edgePoints(o));
    const nLines=String(o.label||"").split("\n").length;
    ctx.font=objFont(o,fs);
    const w=Math.max(140, ctx.measureText(String(o.label||"")).width+60);
    return {fs, lh, fam, peso, align:"center",
            x:m.x-w/2, y:m.y-lh/2, w, h:nLines*lh,
            color:THEMES[doc.theme].edgeLbl};
  }
  const L=labelLayout(o, measureNodeLabel(ctx,o));
  const color=o.textColor || ((o.shape==="text"||o.shape==="anim")? o.color : THEMES[doc.theme].text);
  return {fs:L.fs, lh:L.lh, fam, peso, align:L.align,
          x:L.boxX, y:L.boxY, w:L.boxW, h:L.boxH, color};
}
/* Escribe la geometría en el elemento. Se llama al abrir, en cada `input` y
   cuando cambia la vista: si el usuario hace zoom con el editor abierto, el
   textarea tiene que seguir al texto. */
function syncEditBox(){
  if(!editing) return;
  const g=editBoxGeometry(editing);
  const s=editBox.style;
  s.left=(g.x*viewZoom+viewX)+"px";
  s.top=(g.y*viewZoom+viewY)+"px";
  s.width=(g.w*viewZoom)+"px";
  s.height=(g.h*viewZoom)+"px";
  s.fontSize=(g.fs*viewZoom)+"px";
  s.lineHeight=(g.lh*viewZoom)+"px";
  s.fontFamily=g.fam;
  s.fontWeight=g.peso;
  s.textAlign=g.align;
  s.color=g.color;
  s.caretColor=g.color;
}
/* Firma de lo que obliga a recolocar. Se comprueba una vez por fotograma, que es
   mucho más barato que escribir nueve propiedades de estilo 60 veces por segundo
   para nada. */
let editSig="";
function syncEditBoxIfMoved(){
  if(!editing) return;
  const sig=viewX+"|"+viewY+"|"+viewZoom+"|"+editing.x+"|"+editing.y+"|"+editing.w+"|"+editing.h;
  if(sig===editSig) return;
  editSig=sig; syncEditBox();
}
function openEditorAt(p){
  const single=singleSel();
  if(single && single.type==="edge" && single.obj){
    const wi=hitWaypoint(single.obj,p.x,p.y);
    if(wi>=0){ pushUndo(); single.obj.waypoints.splice(wi,1); return; }
  }
  const tgt=hitNode(p.x,p.y)||hitEdge(p.x,p.y);
  if(!tgt) return;
  editing=tgt;
  /* El texto se aplica en vivo, así que el valor de partida hay que guardarlo:
     es lo que decide si hay algo que deshacer, y lo que restaura Escape. */
  editOriginal=tgt.label||"";
  editBox.value=editOriginal;
  editBox.style.display="block";
  editSig="";
  syncEditBox();
  editBox.focus(); editBox.select();
}
let editOriginal="";
function closeEditBox(label){
  const o=editing;
  editing=null; editBox.style.display="none";
  if(!o) return;
  /* Volver SIEMPRE al punto de partida es lo que hace que Escape funcione: el
     texto se aplicó en vivo tecla a tecla, así que cancelar no es «no hacer
     nada», es deshacer lo ya escrito. */
  o.label=editOriginal;
  if(label!==editOriginal){
    /* pushUndo() apila el estado ACTUAL. Por eso se apila aquí, con el original
       ya restaurado, y solo después se pone el texto nuevo: así deshacer vuelve
       al texto de antes de abrir el editor y no al de la penúltima tecla. */
    pushUndo();
    o.label=label;
  }
  refreshPanel();
}
function commitEditBox(){ if(editing) closeEditBox(editBox.value); }
function cancelEditBox(){ if(editing) closeEditBox(editOriginal); }
/* `input` cubre el texto que llega por IME: en una composición de acento o de
   teclado CJK, `keydown` no trae el carácter compuesto pero `input` sí. Fijarse
   en keydown para recolocar dejaría el textarea con el tamaño anterior justo
   mientras se escribe un acento. */
editBox.addEventListener("input", ()=>{
  if(!editing) return;
  /* El texto se aplica en vivo para que el nodo se reajuste según se escribe: con
     el autoescalado, ver el resultado al confirmar y no antes sería adivinar. El
     undo se apila una sola vez, en commit. */
  editing.label=editBox.value;
  syncEditBox();
});
editBox.addEventListener("keydown", ev=>{
  /* Durante una composición IME, Enter y Escape son del compositor: confirman o
     descartan el candidato. Robárselos rompe los acentos y los teclados CJK. */
  if(ev.isComposing || ev.keyCode===229){ ev.stopPropagation(); return; }
  if(ev.key==="Enter"&&!ev.shiftKey){ ev.preventDefault(); commitEditBox(); }
  if(ev.key==="Escape"){ cancelEditBox(); }
  ev.stopPropagation();
});
editBox.addEventListener("blur", commitEditBox);

document.addEventListener("keydown", ev=>{
  if(ev.target.tagName==="TEXTAREA"||ev.target.tagName==="INPUT") return;
  const k=ev.key.toLowerCase(), ctl=ev.ctrlKey||ev.metaKey;
  /* presentando manda el mando de diapositivas y se cierran los atajos de
     edición: nadie quiere borrar un nodo delante de la sala por pulsar Supr */
  if(presenting){
    if(ev.key==="Escape"){ ev.preventDefault(); exitPresent(); return; }
    if(["ArrowRight","ArrowDown","PageDown"," ","Enter"].includes(ev.key)){ ev.preventDefault(); nextSlide(); return; }
    if(["ArrowLeft","ArrowUp","PageUp","Backspace"].includes(ev.key)){ ev.preventDefault(); prevSlide(); return; }
    if(ev.key==="Home"){ ev.preventDefault(); goSlide(0); return; }
    if(ev.key==="End"){ ev.preventDefault(); goSlide(doc.pages.length-1); return; }
    return;
  }
  if(k==="p" && !ctl && !ev.altKey){ ev.preventDefault(); enterPresent(); return; }
  if(ctl && k==="z"){ ev.preventDefault(); ev.shiftKey? redo():undo(); return; }
  if(ctl && k==="y"){ ev.preventDefault(); redo(); return; }
  if(ctl && k==="s"){ ev.preventDefault(); saveJSON(); return; }
  if(ctl && k==="c"){ copySel(); return; }
  if(ctl && k==="x"){ cutSel(); return; }
  if(ctl && k==="a"){ ev.preventDefault(); selectAll(); return; }
  if(ctl && k==="d"){ ev.preventDefault(); dupSel(); return; }
  if(ctl && k==="v"){
    clearTimeout(pasteTimer);
    pasteTimer=setTimeout(()=>pasteClip(),140); // si el evento paste trae imagen, se cancela
    return;
  }
  if(ev.key==="Delete"||ev.key==="Backspace") deleteSel();
  if(ev.key==="Escape"){ pendingShape=null; pendingIcon=null; pendingAnim=null; connecting=null; connectDrag=null; marquee=null; $("iconDrawer").style.display="none"; $("animDrawer").style.display="none"; syncRail(); }
  if(k==="v") setMode("select");
  if(k==="c") setMode("connect");
  if(ev.key===" "){ ev.preventDefault(); togglePlay(); }
});

cv.addEventListener("wheel", ev => {
  ev.preventDefault();
  if (ev.ctrlKey || ev.metaKey) {
    const r = cv.getBoundingClientRect();
    const screenX = ev.clientX - r.left;
    const screenY = ev.clientY - r.top;
    const zoomDelta = ev.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = clamp(viewZoom * zoomDelta, 0.1, 5);
    const worldX = (screenX - viewX) / viewZoom;
    const worldY = (screenY - viewY) / viewZoom;
    viewZoom = newZoom;
    viewX = screenX - worldX * viewZoom;
    viewY = screenY - worldY * viewZoom;
    commitEditBox();
  } else {
    viewX -= ev.deltaX;
    viewY -= ev.deltaY;
    commitEditBox();
  }
}, {passive: false});

/* ===================== Pegar / soltar imágenes ===================== */
function addImageFromBlob(blob, x=W/2, y=H/2){
  const fr=new FileReader();
  fr.onload=()=>{
    const url=fr.result, im=new Image();
    im.onload=()=>{
      pushUndo();
      const maxD=320, sc=Math.min(1, maxD/Math.max(im.naturalWidth,im.naturalHeight));
      const n=newNode("image",x,y,{img:url, w:Math.round(im.naturalWidth*sc), h:Math.round(im.naturalHeight*sc)});
      trackFirstNode();
      selectOnly("node",n.id);
    };
    im.src=url;
  };
  fr.readAsDataURL(blob);
}
document.addEventListener("paste", ev=>{
  if(ev.target.tagName==="TEXTAREA"||ev.target.tagName==="INPUT") return;
  clearTimeout(pasteTimer);
  const txt=ev.clipboardData.getData("text/plain")||"";
  if(txt.startsWith("fluyo::")){
    try{ clip=JSON.parse(txt.slice(7)); }catch(e){}
    pasteClip(); ev.preventDefault(); return;
  }
  for(const it of ev.clipboardData.items){
    if(it.type.startsWith("image/")){
      addImageFromBlob(it.getAsFile());
      ev.preventDefault();
      return;
    }
  }
  // sin imagen ni datos fluyo: pegar el portapapeles interno si existe
  if(clip) pasteClip();
});
cv.addEventListener("dragover", ev=>ev.preventDefault());
cv.addEventListener("drop", ev=>{
  ev.preventDefault();
  const p=toWorld(ev);
  for(const f of ev.dataTransfer.files){
    if(f.type.startsWith("image/")){ addImageFromBlob(f,p.x,p.y); return; }
  }
});
$("btnImg").onclick=()=>$("imgIn").click();
$("imgIn").onchange=ev=>{
  const f=ev.target.files[0];
  if(f) addImageFromBlob(f);
  ev.target.value="";
};
