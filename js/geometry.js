"use strict";
/* Anclas, rutas y geometría de flechas */

/* ---- anclas y rutas ---- */
/* ===================== Caja de anclaje =====================
   La caja a la que se enganchan las flechas no siempre es w×h.

   En shape:"icon" el glifo se dibuja con s = min(w, h-26)*0.78 —51px sobre una
   caja de 120— y el resto del ancho es aire: 34px vacíos a cada lado. Anclando
   en el borde lógico, la punta de flecha quedaba flotando a 34px del icono, sin
   nada debajo. Es el defecto que se ve como «la flecha no llega al nodo», y no
   tiene que ver con flowDir: flowDir solo invierte el sentido de los puntos
   animados y no toca la geometría.

   La ALTURA sí se conserva. Un icono es un dibujo con un pie: arriba el glifo,
   abajo la etiqueta. La caja alta describe bien lo que ocupa; la ancha no.

   Se usa el ancho del glifo y no el del texto del pie a propósito: medir texto
   se hace distinto en el lienzo, en el exportador SVG y en el MCP, y meter esa
   medida en la geometría haría que los tres calculasen rutas distintas. La
   geometría tiene que salir del documento y de nada más. */
function anchorBox(n){
  if(n.shape!=="icon") return n;
  const s=Math.min(n.w, n.h-26)*.78;
  return {x:n.x, y:n.y, w:Math.min(n.w, Math.max(1,s)), h:n.h, shape:n.shape};
}
function sidePoint(n0,s){
  const n=anchorBox(n0);
  switch(s){ case "n": return {x:n.x, y:n.y-n.h/2};
    case "s": return {x:n.x, y:n.y+n.h/2};
    case "e": return {x:n.x+n.w/2, y:n.y};
    case "w": return {x:n.x-n.w/2, y:n.y}; }
}
function autoAnchor(n0,tx,ty){
  const n=anchorBox(n0);
  const dx=tx-n.x, dy=ty-n.y;
  if(dx===0&&dy===0) return {x:n.x,y:n.y};
  if(n.shape==="circle"){ const r=n.w/2, L=Math.hypot(dx,dy);
    return {x:n.x+dx/L*r, y:n.y+dy/L*r}; }
  if(n.shape==="diamond"){ const k=1/((Math.abs(dx)/(n.w/2))+(Math.abs(dy)/(n.h/2)));
    return {x:n.x+dx*k, y:n.y+dy*k}; }
  const sx=(n.w/2)/Math.abs(dx||1e-9), sy=(n.h/2)/Math.abs(dy||1e-9), s=Math.min(sx,sy);
  return {x:n.x+dx*s, y:n.y+dy*s};
}
function anchorPt(n,side,tx,ty){ return side? sidePoint(n,side) : autoAnchor(n,tx,ty); }
function inferSide(n0,p){
  const n=anchorBox(n0);
  const dx=(p.x-n.x)/(n.w/2||1), dy=(p.y-n.y)/(n.h/2||1);
  return Math.abs(dx)>Math.abs(dy)? (dx>0?"e":"w") : (dy>0?"s":"n");
}
function nearestAnchorSide(n,p,maxDist){
  let best=null, bd=maxDist;
  for(const s of SIDES){
    const q=sidePoint(n,s), d=Math.hypot(p.x-q.x,p.y-q.y);
    if(d<bd){ bd=d; best=s; }
  }
  return best;
}
function sideOfPoint(n,p){
  const t=3;
  if(Math.abs(p.y-(n.y-n.h/2))<t) return "n";
  if(Math.abs(p.y-(n.y+n.h/2))<t) return "s";
  if(Math.abs(p.x-(n.x-n.w/2))<t) return "w";
  if(Math.abs(p.x-(n.x+n.w/2))<t) return "e";
  return inferSide(n,p);
}
/* ===================== Aristas paralelas =====================
   Dos aristas entre el mismo par de nodos daban EXACTAMENTE la misma ruta:
   autoAnchor y orthoRoute son simétricos, así que un par bidireccional se
   dibujaba una flecha encima de la otra y las dos etiquetas caían en el mismo
   punto. El resultado era ilegible — de «check cache» + «hit» superpuestas solo
   se leía «che hit che».

   Cada arista del grupo recibe ahora un carril propio: se desplaza cada tramo
   perpendicularmente a sí mismo, siempre la misma cantidad. El desplazamiento se
   reparte centrado, así que con una sola arista (el caso normal) vale 0 y la
   geometría no cambia ni un píxel.

   El signo se decide en un marco canónico —el par ordenado por id, no el sentido
   de la flecha—. Si dependiera del sentido, las dos mitades de un par
   bidireccional recibirían desplazamientos opuestos que se anulan al invertir el
   recorrido, y volverían a solaparse.

   Una arista con waypoints queda fuera del reparto: ahí la ruta la puso alguien
   a mano y mandan sus puntos. */
const PARALLEL_SEP=28;
function parallelKey(e){ return e.from<e.to? e.from+"-"+e.to : e.to+"-"+e.from; }
/* Devuelve el carril de esta arista: `off` es su desplazamiento y `half` el
   semiancho del abanico completo del grupo, que hace falta para reservarle sitio
   en el lado del nodo antes de mover nada. */
function parallelLane(e){
  const none={off:0, half:0};
  if((e.waypoints||[]).length) return none;
  const key=parallelKey(e);
  const sib=P().edges.filter(o=>!(o.waypoints||[]).length && parallelKey(o)===key);
  if(sib.length<2) return none;
  const i=sib.findIndex(o=>o.id===e.id);
  if(i<0) return none;
  return {off:(i-(sib.length-1)/2)*PARALLEL_SEP, half:(sib.length-1)/2*PARALLEL_SEP};
}
/* Corre el ancla a lo largo del lado por el que sale, sin salirse de él: el
   extremo tiene que seguir tocando el borde del nodo pase lo que pase.

   El ancla base se mete primero hacia dentro lo justo para que quepa el abanico
   entero. Sin ese paso, un ancla que autoAnchor dejó pegada a una esquina no
   tiene hueco para apartarse, el clamp se come el desplazamiento y las dos
   aristas vuelven a juntarse — que es exactamente lo que pasaba con Pinecone,
   cuya ancla caía a 1px del borde inferior de su lado oeste. */
function slideAnchor(n0,side,p,off,half){
  if(!off) return p;
  const n=anchorBox(n0);
  const inset=10;
  const horiz=(side==="n"||side==="s");
  const c=horiz? n.x : n.y;
  const lim=Math.max(0,(horiz? n.w/2 : n.h/2)-inset);
  const room=Math.max(0,lim-half);
  const base=clamp(horiz? p.x : p.y, c-room, c+room);
  const v=clamp(base+off, c-lim, c+lim);
  return horiz? {x:v, y:p.y} : {x:p.x, y:v};
}
function orthoRoute(p1,d1,p2,d2,off){
  const pad=28;
  const s={x:p1.x+d1.x*pad, y:p1.y+d1.y*pad};
  const t={x:p2.x+d2.x*pad, y:p2.y+d2.y*pad};
  let mids;
  /* el tramo central también se aparta: separar solo las anclas dejaría las dos
     rutas compartiendo el canal largo del medio, que es donde va la etiqueta */
  if(d1.x!==0 && d2.x!==0){ const mx=(s.x+t.x)/2+(off||0); mids=[{x:mx,y:s.y},{x:mx,y:t.y}]; }
  else if(d1.y!==0 && d2.y!==0){ const my=(s.y+t.y)/2+(off||0); mids=[{x:s.x,y:my},{x:t.x,y:my}]; }
  else if(d1.x!==0){ mids=[{x:t.x,y:s.y}]; }
  else { mids=[{x:s.x,y:t.y}]; }
  const raw=[p1,s,...mids,t,p2], out=[raw[0]];
  for(let i=1;i<raw.length;i++){
    const a=out[out.length-1], b=raw[i];
    if(Math.hypot(a.x-b.x,a.y-b.y)>1) out.push(b);
  }
  return out;
}
function edgePoints(e){
  const A=nodeById(e.from), B=nodeById(e.to); if(!A||!B) return [];
  const wps=e.waypoints||[];
  const tA=wps[0]||{x:B.x,y:B.y}, tB=wps[wps.length-1]||{x:A.x,y:A.y};
  let p1=anchorPt(A,e.fromSide,tA.x,tA.y);
  let p2=anchorPt(B,e.toSide,tB.x,tB.y);
  /* los lados se deciden con las anclas SIN correr: apartarse para no solaparse
     no debe cambiar por qué cara sale la flecha */
  const s1=e.fromSide||inferSide(A,p1), s2=e.toSide||inferSide(B,p2);
  const {off,half}=parallelLane(e);
  if(off){ p1=slideAnchor(A,s1,p1,off,half); p2=slideAnchor(B,s2,p2,off,half); }
  if(e.route==="ortho" && wps.length===0){
    return orthoRoute(p1,DIR[s1],p2,DIR[s2],off);
  }
  return [p1,...wps,p2];
}
/* ===================== Colocación de etiquetas =====================
   La etiqueta iba siempre al punto medio exacto de la ruta, sin mirar qué había
   debajo. En cuanto el diagrama se aprieta un poco, ese punto cae encima de un
   nodo («chunks relevantes» sobre «Usuario») o encima de otra etiqueta.

   Ahora se prueban posiciones a lo largo de la propia arista —empezando por el
   medio y abriéndose por igual hacia los dos extremos— y se coge la primera que
   no choque con ningún nodo ni con ninguna etiqueta ya colocada. Si ninguna está
   libre se coge la que menos área solape, que sigue siendo mejor que el medio a
   ciegas.

   No se desplaza perpendicularmente a la arista a propósito: la etiqueta tiene
   que seguir leyéndose como perteneciente a SU flecha, y separarla de la línea
   la vuelve ambigua en cuanto hay dos flechas cerca.

   El orden de colocación es el de la página, y cada etiqueta solo esquiva a las
   que ya se colocaron, no a las que vendrán. Eso es lo que hace el resultado
   estable y reproducible: si todas se esquivaran entre sí no habría una solución
   única, y la elección podría oscilar entre fotogramas.

   El rango llega hasta 0.14/0.86 y no hasta los extremos: pegada al final, la
   etiqueta se confunde con la punta de flecha y con el nodo de destino. */
const LBL_FRACS=(()=>{ const out=[.5]; for(let d=.04; d<=.36; d+=.04) out.push(.5-d, .5+d); return out; })();
function rectOverlapArea(a,b){
  const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
  const oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
  return (ox>0&&oy>0)? ox*oy : 0;
}
function labelRectAt(pts,f,w,h){
  const p=pointAt(pts,f);
  return {x:p.x-w/2-6, y:p.y-h/2, w:w+12, h:h, cx:p.x, cy:p.y};
}
/* Mapa id-de-arista -> {x,y} donde va su etiqueta. `measure` devuelve {w,h} en
   píxeles de lienzo; lo inyecta quien llama porque medir texto se hace distinto
   en el lienzo (measureText), en el SVG de la app (getBBox) y en el MCP. */
let edgeLabelPos=new Map();
function placeEdgeLabels(measure){
  const pg=P(), out=new Map(), placed=[];
  const nodeBoxes=pg.nodes.map(n=>({x:n.x-n.w/2, y:n.y-n.h/2, w:n.w, h:n.h}));
  for(const e of pg.edges){
    if(!e.label) continue;
    const pts=edgePoints(e); if(pts.length<2) continue;
    const m=measure(e); if(!m || !(m.w>0)) continue;
    let best=null, bestCost=Infinity;
    for(const f of LBL_FRACS){
      const r=labelRectAt(pts,f,m.w,m.h);
      let cost=0;
      for(const b of nodeBoxes) cost+=rectOverlapArea(r,b);
      for(const b of placed) cost+=rectOverlapArea(r,b);
      if(cost===0){ best=r; bestCost=0; break; }
      if(cost<bestCost){ best=r; bestCost=cost; }
    }
    if(best){ out.set(e.id,{x:best.cx, y:best.cy}); placed.push(best); }
  }
  return out;
}
/* Punto donde se dibuja la etiqueta de una arista. Cae al medio geométrico si
   todavía no se ha calculado la colocación de la página. */
function labelPointFor(e,pts){ return edgeLabelPos.get(e.id) || pointAt(pts,.5); }

function polyLen(pts){ let L=0; for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); return L; }
function pointAt(pts,f){
  const L=polyLen(pts); if(L===0) return {x:pts[0].x,y:pts[0].y,ang:0};
  let target=clamp(f,0,1)*L;
  for(let i=1;i<pts.length;i++){
    const seg=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
    if(target<=seg || i===pts.length-1){
      const u=seg? target/seg:0;
      return { x:lerp(pts[i-1].x,pts[i].x,u), y:lerp(pts[i-1].y,pts[i].y,u),
               ang:Math.atan2(pts[i].y-pts[i-1].y,pts[i].x-pts[i-1].x) };
    }
    target-=seg;
  }
  return {x:pts[pts.length-1].x,y:pts[pts.length-1].y,ang:0};
}
