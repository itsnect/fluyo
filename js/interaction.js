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
/* ===================== Extremos de arista =====================
   Los extremos SÍ tienen manejador propio, y va sobre el borde del nodo (0 px),
   no en la franja de fuera. Se prueba antes que los codos y que los puntos
   medios, porque es el objetivo más específico de los tres.

   El radio es menor que el de las flechas de conexión (14) para que en un nodo
   con una arista enganchada las dos cosas sigan siendo alcanzables: el extremo
   pegado al borde, la flecha a 24 px por fuera. */
function endHitRadius(){ return isTouch()? Math.max(16, 22/viewZoom) : 9; }
function hitEdgeEnd(e,x,y){
  const pts=edgePoints(e); if(pts.length<2) return null;
  const r=endHitRadius();
  if(Math.hypot(x-pts[0].x, y-pts[0].y)<r) return "from";
  const q=pts[pts.length-1];
  if(Math.hypot(x-q.x, y-q.y)<r) return "to";
  return null;
}
/* Devuelve el índice del TRAMO bajo el cursor, o -1. Qué tramos ofrecen
   manejador y qué hace ese manejador lo decide bendableSegs() en js/geometry.js.

   El objetivo es el tramo, no su punto medio: el manejador se dibuja como una
   barra sobre el tramo (render.js) y hay que poder agarrarlo en cualquier punto
   de ella, no solo en el centro. Se recorta a SEG_GRIP px del centro (config.js)
   para no invadir los vértices vecinos, que tienen manejador propio. */
function hitSegment(e,x,y){
  const pts=edgePoints(e);
  const r = isTouch()? Math.max(14, 18/viewZoom) : 9;
  for(const i of bendableSegs(e,pts)){
    const a=pts[i], b=pts[i+1];
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const L=Math.hypot(b.x-a.x,b.y-a.y);
    if(L<1){ if(Math.hypot(x-mx,y-my)<r) return i; continue; }
    const ux=(b.x-a.x)/L, uy=(b.y-a.y)/L;
    const t=(x-mx)*ux+(y-my)*uy;                 // distancia al centro, sobre el tramo
    const media=Math.min(SEG_GRIP, L/2);
    if(Math.abs(t)>media) continue;
    if(Math.abs((x-mx)*-uy+(y-my)*ux)<r) return i;
  }
  return -1;
}
/* Sobre qué eje se mueve un tramo: el perpendicular al suyo. Se decide por la
   extensión dominante y no por igualdad exacta, porque el dedup de orthoRoute
   descarta puntos a ≤1px y puede dejar un tramo con 1px de inclinación. */
function segEje(a,b){ return Math.abs(a.x-b.x)>=Math.abs(a.y-b.y)? "y" : "x"; }
/* Cursor de «esto se desliza», o null si el puntero no está sobre un tramo. */
function segHoverCur(e,p){
  const i=hitSegment(e,p.x,p.y);
  if(i<0) return null;
  const pts=edgePoints(e);
  return segEje(pts[i],pts[i+1])==="x"? "ew-resize" : "ns-resize";
}
/* ===================== Deslizar un tramo =====================
   Empezar el gesto hace tres cosas, y las tres hacen falta:

   1. MATERIALIZA la ruta en waypoints. Es inevitable: el documento no tiene
      dónde guardar «este canal va 40px más arriba» si no es como puntos.
   2. CONGELA el lado de un extremo flotante. Con fromSide/toSide en null,
      autoAnchor recalcula el ancla apuntando al primer waypoint, así que el
      extremo se mueve mientras arrastras y ninguna alineación aguanta. Medido:
      de 57 arrastres, los 21 que seguían saliendo en diagonal tenían los 21 un
      extremo flotante; congelando el lado, cero.
   3. GUARDA una copia de los waypoints. Cada fotograma reconstruye desde esa
      copia en vez de mutar lo ya movido: así el quiebro de más abajo se calcula
      una vez por posición y no se acumula.

   No se apila undo aquí sino en quien llama, junto al resto de gestos. */
function iniciarTramo(e,mi){
  const A=nodeById(e.from), B=nodeById(e.to);
  if(!A||!B) return null;
  let pts=edgePoints(e);
  if(!e.fromSide) e.fromSide=sideOfPoint(A,pts[0]);
  if(!e.toSide)   e.toSide  =sideOfPoint(B,pts[pts.length-1]);
  if(!(e.waypoints||[]).length){
    pts=edgePoints(e);                       // el lado congelado puede cambiar la ruta
    e.waypoints=pts.slice(1,-1).map(q=>({x:q.x,y:q.y}));
  }
  pts=edgePoints(e);
  const i0=mi-1, i1=mi, base=e.waypoints;
  if(i0<0 || i1>=base.length) return null;   // un tramo con un ancla por extremo no desliza
  const eje=segEje(pts[mi],pts[mi+1]);
  const v0=base[i0][eje];
  /* EL TOPE. Una arista con waypoints ya no pasa por orthoRoute, así que el
     guardián anti-muñón de orthoRoute() deja de protegerla: sin tope, el propio
     gesto reintroduce el defecto que ese guardián arregló. Medido: 4 de 57
     arrastres cruzaban el pasillo del destino y dejaban la ruta bajando 28px
     para volver a subir.

     La regla es geométrica y no hay que ajustar ninguna constante: el tramo no
     puede cruzar a ninguno de sus dos vértices vecinos sobre el eje por el que
     se mueve. Cruzar a un vecino es exactamente invertir el sentido del tramo
     que los une. */
  const vecinos=[ i0>0? base[i0-1] : pts[0], i1<base.length-1? base[i1+1] : pts[pts.length-1] ];
  let min=-Infinity, max=Infinity;
  for(const q of vecinos){
    if(v0>q[eje]+.5)      min=Math.max(min,q[eje]);
    else if(v0<q[eje]-.5) max=Math.min(max,q[eje]);
  }
  return {edgeId:e.id, i0, i1, eje,
          base:base.map(q=>({x:q.x,y:q.y})),
          p1:{x:pts[0].x,y:pts[0].y}, p2:{x:pts[pts.length-1].x,y:pts[pts.length-1].y},
          lim:{min,max}};
}
/* Reconstruye los waypoints con el tramo en `v`. El quiebro es lo que salva la
   ortogonalidad en los extremos: el pasillo de aproximación es COLINEAL con el
   tramo cuando éste toca un extremo, así que deslizarlo deja el ancla
   descolgada y el tramo ancla→waypoint se vuelve diagonal. Se inserta entonces
   un vértice que respeta el eje normal del lado anclado, que es por donde la
   flecha tiene que salir del nodo. Con los dos lados fijados esto no falla
   nunca; por eso iniciarTramo() congela los flotantes antes. */
function moverTramo(sd,p){
  const e=edgeById(sd.edgeId); if(!e) return;
  const v=clamp(snapV(p[sd.eje]), sd.lim.min, sd.lim.max);
  const wps=sd.base.map(q=>({x:q.x,y:q.y}));
  wps[sd.i0][sd.eje]=v; wps[sd.i1][sd.eje]=v;
  const diagonal=(a,b)=>Math.abs(a.x-b.x)>1.5 && Math.abs(a.y-b.y)>1.5;
  const quiebro=(anc,w,side)=> DIR[side].x!==0? {x:w.x, y:anc.y} : {x:anc.x, y:w.y};
  if(diagonal(sd.p1,wps[0]))                     wps.unshift(quiebro(sd.p1,wps[0],e.fromSide));
  const u=wps[wps.length-1];
  if(diagonal(sd.p2,u))                          wps.push(quiebro(sd.p2,u,e.toSide));
  e.waypoints=wps;
}
/* Al llevar un tramo hasta su tope queda pegado a un vecino, y ahí el tramo que
   los unía mide cero: dos vértices en el mismo sitio, con sus dos manejadores
   dibujados uno encima de otro. Se podan al soltar, no durante el arrastre, para
   que el gesto no cambie de forma bajo el dedo y para poder volver atrás sin
   haber perdido un vértice. El umbral es el mismo que usa el dedup de
   orthoRoute(): por debajo de 1px no hay tramo que dibujar. */
/* ===================== Mover un nodo con la ruta hecha a mano =====================
   Al mover UN solo extremo de una arista con waypoints, la ruta se conserva: los
   waypoints se quedan donde están y solo se realinea el que toca cada ancla,
   sobre el eje normal de su lado. Es la misma regla del quiebro que usa
   moverTramo(), aplicada aquí porque el ancla se mueve y el waypoint no.

   ANTES SE BORRABAN. Esta rama hacía `e.waypoints=[]; e.route="ortho"` desde
   b1d7d27, y estaba justificado entonces: los waypoints solo podían venir del
   gesto viejo de insertar un codo, que en una ruta ortogonal producía un pico de
   dos diagonales —39 de 57 arrastres medidos— o un muñón. Borrar una forma que
   ya estaba rota y volver a rutear era mejor que conservarla.

   Desde que el manejador DESLIZA el tramo, la forma es deliberada y borrarla
   destruye trabajo del usuario sin avisar. Medido sobre el gesto exacto —crear
   arista ortogonal, deslizar el tramo central 60px, mover el nodo destino 200px—
   la arista pasaba de 3 waypoints a 0 y la ruta volvía a ser exactamente la
   automática.

   No se repone. Si alguien vuelve a necesitar la ruta automática, la salida es
   «Volver a la ruta automática», que es explícita y reversible; borrar en silencio no lo es.

   Medido sobre 162 desplazamientos de un nodo en una rejilla de ±600px:

     waypoints en absolutas, sin realinear   144 diagonales · 72 inversiones
     realineando los extremos                 0 diagonales ·  0 inversiones

   Lo que NO cubre, y se acepta a propósito: la ruta conservada no vuelve a pasar
   por orthoRoute, así que el guardián anti-muñón no la protege y arrastrar un
   nodo contra el canal que fijaste puede meterle la ruta por dentro (21% de los
   movimientos de ≤100px, ~52% de los grandes). Se prefirió un resultado
   predecible que a veces queda feo —y se corrige deslizando otra vez— a uno que
   decide solo y hace desaparecer el trabajo. El arreglo de fondo está anotado en
   ideas.md: waypoints como pistas del router.

   Solo aplica a rutas ORTOGONALES. En una recta los waypoints son vértices
   literales y las diagonales son el resultado que se busca, así que ahí no se
   toca nada. */
function realinearExtremos(e,base){
  const A=nodeById(e.from), B=nodeById(e.to);
  const wps=base.map(q=>({x:q.x,y:q.y}));
  if(!A||!B||!wps.length) return wps;
  const p1=anchorPt(A,e.fromSide,wps[0].x,wps[0].y);
  const p2=anchorPt(B,e.toSide,wps[wps.length-1].x,wps[wps.length-1].y);
  const ejeN=s=>s? (DIR[s].x!==0?"x":"y") : null;
  const e1=ejeN(e.fromSide), e2=ejeN(e.toSide);
  if(e1==="x") wps[0].y=p1.y; else if(e1==="y") wps[0].x=p1.x;
  const u=wps[wps.length-1];
  if(e2==="x") u.y=p2.y; else if(e2==="y") u.x=p2.x;
  /* Con un solo waypoint las dos realineaciones caen sobre el mismo punto y la
     segunda pisa a la primera. Ahí hace falta el quiebro, igual que al deslizar. */
  const diagonal=(a,b)=>Math.abs(a.x-b.x)>1.5 && Math.abs(a.y-b.y)>1.5;
  const quiebro=(anc,w,s)=> DIR[s].x!==0? {x:w.x, y:anc.y} : {x:anc.x, y:w.y};
  if(e.fromSide && diagonal(p1,wps[0])) wps.unshift(quiebro(p1,wps[0],e.fromSide));
  const v=wps[wps.length-1];
  if(e.toSide && diagonal(p2,v)) wps.push(quiebro(p2,v,e.toSide));
  return wps;
}
function podarWaypoints(e){
  const pts=edgePoints(e); if(pts.length<2) return;
  const wps=e.waypoints||[], out=[];
  let prev=pts[0];
  for(const w of wps){
    if(Math.hypot(w.x-prev.x, w.y-prev.y)>1){ out.push(w); prev=w; }
  }
  const fin=pts[pts.length-1];
  while(out.length && Math.hypot(out[out.length-1].x-fin.x, out[out.length-1].y-fin.y)<=1) out.pop();
  e.waypoints=out;
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
  /* thaw incondicional: si el gesto se cancela a mitad, dejar el mapa congelado
     dejaría las etiquetas clavadas para siempre. */
  endDrag=null; segDrag=null; thawEdgeLabels();
}
function startPinch(){
  cancelGestures();
  const [a,b]=[...activeTouches.values()];
  pinch={ d0:Math.hypot(a.x-b.x,a.y-b.y)||1, zoom0:viewZoom,
          cx:(a.x+b.x)/2, cy:(a.y+b.y)/2, viewX0:viewX, viewY0:viewY };
}

cv.addEventListener("pointerdown", ev=>{
  lastPointerType = ev.pointerType || "mouse";
  /* En un equipo híbrido se alterna dedo y ratón con la misma selección puesta:
     sin esto la papelera flotante se quedaría encendida al pasar al ratón hasta
     el siguiente refreshPanel(). */
  syncTouchDelete();
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
  // 2) extremos / codos / puntos medios (solo con una flecha seleccionada)
  if(single && single.type==="edge" && single.obj){
    const se=single.obj;
    /* El extremo va primero: es el objetivo más específico y está sobre el
       borde, donde no hay ningún otro manejador.

       No se apila undo aquí ni se toca el documento: el gesto se resuelve
       entero en pointerup. Mutar en vivo es lo que hacía el camino de los codos
       —materializaba la ruta en waypoints y le insertaba uno más—, y con
       waypoints la arista se sale del reparto de carriles y arrastra a su
       hermana del par paralelo, que salta 14 px sin que nadie la toque. */
    const end=hitEdgeEnd(se,p.x,p.y);
    if(end){ endDrag={edgeId:se.id, which:end}; freezeEdgeLabels(); return; }
    const wi=hitWaypoint(se,p.x,p.y);
    if(wi>=0){ pushUndo(); wpDrag={edgeId:se.id, idx:wi}; return; }
    const mi=hitSegment(se,p.x,p.y);
    if(mi>=0){
      pushUndo();
      /* Ortogonal: el tramo se desliza entero. Recta: se inserta un codo donde
         agarras, que ahí sí tiene sentido. Ver bendableSegs() en geometry.js. */
      if(se.route==="ortho"){
        const sd=iniciarTramo(se,mi);
        if(sd){ segDrag=sd; freezeEdgeLabels(); return; }
      }
      se.waypoints=se.waypoints||[];
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
    drag={offs:{}, wps:[], realin:[]};
    for(const id of selN){
      const nn=nodeById(id);
      if(nn) drag.offs[id]={dx:p.x-nn.x, dy:p.y-nn.y};
    }
    for(const e of P().edges){
      // los codos de flechas internas al grupo se mueven con él: los dos
      // extremos se desplazan lo mismo, así que la forma se conserva sola
      if(selN.has(e.from)&&selN.has(e.to))
        (e.waypoints||[]).forEach(w=>drag.wps.push({w, dx:p.x-w.x, dy:p.y-w.y}));
      /* Si solo se mueve UN extremo, la ruta hecha a mano se conserva y se
         realinea contra el ancla en cada fotograma. Ver realinearExtremos().
         El lado flotante se congela antes, porque sin lado no hay eje normal
         contra el que realinear y el ancla se iría persiguiendo al waypoint. */
      else if((selN.has(e.from)||selN.has(e.to)) && (e.waypoints||[]).length && e.route==="ortho"){
        const pts=edgePoints(e);
        if(pts.length>1){
          const A2=nodeById(e.from), B2=nodeById(e.to);
          if(A2 && !e.fromSide) e.fromSide=sideOfPoint(A2,pts[0]);
          if(B2 && !e.toSide)   e.toSide=sideOfPoint(B2,pts[pts.length-1]);
        }
        drag.realin.push({id:e.id, base:e.waypoints.map(q=>({x:q.x,y:q.y}))});
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
    /* Se reconstruye desde la copia de pointerdown en vez de acumular sobre lo
       ya realineado: si no, el quiebro se insertaría una vez por fotograma. */
    for(const r of drag.realin){
      const e=edgeById(r.id);
      if(e) e.waypoints=realinearExtremos(e,r.base);
    }
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
  if(segDrag){ moverTramo(segDrag,p); return; }
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

     No aplica mientras se arrastra una conexión ni un extremo: ahí no hay
     flechas dibujadas y hoverNode es el nodo de destino que se va a resaltar. */
  hoverNode = ((connectDrag||endDrag)? null : hitSideArrowHost(p.x,p.y)) || hitNode(p.x,p.y);
  const single=singleSel();
  let cur="default";
  if(pendingShape||pendingIcon||pendingAnim||mode==="connect"||connectDrag||endDrag) cur="crosshair";
  /* El cursor dice por dónde se mueve el tramo antes de agarrarlo: un tramo
     vertical se desliza en horizontal y al revés. */
  else if(segDrag) cur = segDrag.eje==="x"? "ew-resize" : "ns-resize";
  else if(single&&single.type==="edge"&&single.obj&&hitEdgeEnd(single.obj,p.x,p.y)) cur="grab";
  else if(single&&single.type==="edge"&&single.obj&&single.obj.route==="ortho"&&segHoverCur(single.obj,p)) cur=segHoverCur(single.obj,p);
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
  const hadDrag=!!(drag||resizing||wpDrag||segDrag);
  if(connectDrag){
    const tgt=hitNode(p.x,p.y);
    if(tgt && tgt.id!==connectDrag.fromId){
      pushUndo();
      const snapSide=nearestAnchorSide(tgt,p,ANCHOR_SNAP);
      const e=newEdge(connectDrag.fromId,tgt.id,{
        fromSide:connectDrag.fromSide,
        toSide:snapSide,
        route:"ortho"
      });
      if(e) selectOnly("edge",e.id);
    }
    connectDrag=null;
  }
  /* ===================== Soltar un extremo de arista =====================
     Todo el gesto se resuelve aquí, y lo único que se escribe son cuatro
     campos que ya existen en el documento y en el schema del MCP: `from`/`to`
     y `fromSide`/`toSide`. Ni un waypoint.

     · Se suelta sobre un nodo, cerca de un lado  -> se fija a ese lado.
     · Se suelta sobre un nodo, lejos de un lado  -> `null`, conexión flotante:
       el motor elige el punto según hacia dónde vaya la flecha.
     · Se suelta en el vacío                      -> no se cambia nada. Soltar
       fuera es abandonar el gesto, no desconectar la arista.

     El undo se apila AQUÍ y solo si de verdad va a cambiar algo: como durante
     el arrastre no se mutó nada, el estado en este punto sigue siendo el de
     antes de empezar, que es exactamente lo que hay que guardar. */
  if(endDrag){
    const e=edgeById(endDrag.edgeId);
    if(e){
      const tgt=hitNode(p.x,p.y);
      /* Una arista no puede salir y entrar en el mismo nodo. newEdge() rechaza
         el auto-lazo al CREAR (state.js), pero aquí se muta una existente y ese
         guard no interviene. */
      const otro = endDrag.which==="from" ? e.to : e.from;
      if(tgt && tgt.id!==otro){
        const lado=nearestAnchorSide(tgt,p,ANCHOR_SNAP);
        const nuevoId=tgt.id, nuevoLado=lado||null;
        const actualId = endDrag.which==="from" ? e.from : e.to;
        const actualLado = endDrag.which==="from" ? (e.fromSide||null) : (e.toSide||null);
        if(nuevoId!==actualId || nuevoLado!==actualLado){
          pushUndo();
          if(endDrag.which==="from"){ e.from=nuevoId; e.fromSide=nuevoLado; }
          else                      { e.to=nuevoId;   e.toSide=nuevoLado;   }
          refreshPanel();
        }
      }
    }
    endDrag=null;
    thawEdgeLabels();
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
  /* Realinear puede dejar un waypoint encima de su vecino, igual que topar al
     deslizar: se poda al soltar y no durante el arrastre. */
  if(drag) for(const r of drag.realin){ const e=edgeById(r.id); if(e) podarWaypoints(e); }
  drag=null; resizing=null; wpDrag=null;
  /* El tramo deslizado se descongela aquí, igual que endDrag: las etiquetas se
     recolocan una vez al soltar y no sesenta veces por segundo. */
  if(segDrag){
    const e=edgeById(segDrag.edgeId);
    if(e) podarWaypoints(e);
    segDrag=null; thawEdgeLabels();
  }
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
  /* endDrag y thawEdgeLabels() van juntos y sin condición: abandonar con Escape
     a mitad de un arrastre de extremo no debe dejar el mapa de etiquetas
     congelado, porque entonces no se recolocarían nunca más en esta sesión.

     El tramo deslizado necesita además un undo(): a diferencia de endDrag, ese
     gesto SÍ muta el documento mientras dura —materializa la ruta y congela los
     lados flotantes—, así que soltar la variable no lo deshace. El pushUndo() de
     pointerdown se apiló antes de tocar nada, o sea que esto devuelve la arista
     a su ruta automática. */
  if(ev.key==="Escape"){ if(segDrag){ segDrag=null; undo(); } pendingShape=null; pendingIcon=null; pendingAnim=null; connecting=null; connectDrag=null; endDrag=null; thawEdgeLabels(); marquee=null; $("iconDrawer").style.display="none"; $("animDrawer").style.display="none"; syncRail(); }
  if(k==="v") setMode("select");
  if(k==="c") setMode("connect");
  /* R: devuelve la flecha seleccionada a su ruta automática. Solo hace algo si
     hay una única flecha seleccionada y tiene tramos movidos a mano, así que no
     pisa nada cuando la selección es otra cosa. Ver rutaAuto() en js/ui.js. */
  if(k==="r" && !ctl && !ev.altKey && rutaAuto()) ev.preventDefault();
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
