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
function orthoRoute(p1,d1,p2,d2){
  const pad=28;
  const s={x:p1.x+d1.x*pad, y:p1.y+d1.y*pad};
  const t={x:p2.x+d2.x*pad, y:p2.y+d2.y*pad};
  let mids;
  if(d1.x!==0 && d2.x!==0){ const mx=(s.x+t.x)/2; mids=[{x:mx,y:s.y},{x:mx,y:t.y}]; }
  else if(d1.y!==0 && d2.y!==0){ const my=(s.y+t.y)/2; mids=[{x:s.x,y:my},{x:t.x,y:my}]; }
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
  const p1=anchorPt(A,e.fromSide,tA.x,tA.y);
  const p2=anchorPt(B,e.toSide,tB.x,tB.y);
  if(e.route==="ortho" && wps.length===0){
    const d1=DIR[e.fromSide||inferSide(A,p1)];
    const d2=DIR[e.toSide||inferSide(B,p2)];
    return orthoRoute(p1,d1,p2,d2);
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
