"use strict";
/* Anclas, rutas y geometría de flechas */

/* ---- anclas y rutas ---- */
function sidePoint(n,s){
  switch(s){ case "n": return {x:n.x, y:n.y-n.h/2};
    case "s": return {x:n.x, y:n.y+n.h/2};
    case "e": return {x:n.x+n.w/2, y:n.y};
    case "w": return {x:n.x-n.w/2, y:n.y}; }
}
function autoAnchor(n,tx,ty){
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
function inferSide(n,p){
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
function slideAnchor(n,side,p,off,half){
  if(!off) return p;
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
