"use strict";
/* Matemática de viewport del viewer. Sin DOM ni estado global: opera sobre
   el objeto de viewport que recibe, así es directamente testeable en Node.
   El viewer (js/viewer.js) posee su propia instancia; no comparte viewport
   con el editor. */

function makeViewerViewport(){
  return {x:0, y:0, zoom:0.8};
}

function panViewportBy(vp, dx, dy){
  vp.x+=dx; vp.y+=dy;
  return vp;
}

/* Zoom con anclaje: el punto del mundo bajo (screenX, screenY) no se mueve. */
function zoomViewportTo(vp, screenX, screenY, newZoom){
  const z=clamp(newZoom, 0.1, 5);
  const wx=(screenX-vp.x)/vp.zoom, wy=(screenY-vp.y)/vp.zoom;
  vp.zoom=z;
  vp.x=screenX-wx*z;
  vp.y=screenY-wy*z;
  return vp;
}
function zoomViewportAt(vp, screenX, screenY, factor){
  return zoomViewportTo(vp, screenX, screenY, vp.zoom*factor);
}

/* Ancla de mundo inicial: la distancia cambia zoom y el centro actual hace pan. */
function beginViewportPinch(vp,a,b){
  const x=(a.x+b.x)/2, y=(a.y+b.y)/2;
  return {distance:Math.hypot(a.x-b.x,a.y-b.y), zoom:vp.zoom,
    worldX:(x-vp.x)/vp.zoom, worldY:(y-vp.y)/vp.zoom};
}
function updateViewportPinch(vp,pinch,a,b){
  const distance=Math.hypot(a.x-b.x,a.y-b.y);
  if(pinch.distance<=0 || distance<=0) return vp;
  vp.zoom=clamp(pinch.zoom*distance/pinch.distance,.1,5);
  vp.x=(a.x+b.x)/2-pinch.worldX*vp.zoom;
  vp.y=(a.y+b.y)/2-pinch.worldY*vp.zoom;
  return vp;
}

/* Encajar los bounds del documento en un tamaño de lienzo dado. */
function fitViewportToBounds(vp, bounds, width, height, maxZoom=2.5){
  if(width<=0 || height<=0 || !bounds || bounds.w<=0 || bounds.h<=0) return vp;
  const z=clamp(Math.min(width/bounds.w, height/bounds.h), 0.05, maxZoom);
  vp.zoom=z;
  vp.x=(width-bounds.w*z)/2 - bounds.x*z;
  vp.y=(height-bounds.h*z)/2 - bounds.y*z;
  return vp;
}

/* ─────────── FLUYO-018.30: la cámara que sigue el momento de la Historia ───────────
   Cuando el diagrama entero solo cabe por debajo de FOLLOW_MIN_ZOOM (un teléfono en vertical: 0,26–0,44, etiquetas de 3–7 px), el
   Viewer, reproduciendo, deja de enseñarlo entero y sigue el momento en curso a un zoom legible. Mismo suelo que el editor
   (REVEAL_MIN_ZOOM, decisión 148: no se encoge por debajo de 0,6) y nunca por encima del tamaño del autor (1). Un solo zoom para
   toda la Historia —el mayor al que cabe su momento más grande—, así entre momentos la cámara solo se desplaza. Cajas y
   rectángulos: mundo {x,y,w,h}; zona libre en px del lienzo {left,top,width,height}. */
const FOLLOW_MIN_ZOOM=0.6, FOLLOW_MAX_ZOOM=1;
/* El zoom de seguimiento, o null si no hace falta seguir (el diagrama entero ya se lee: escritorio, tableta, casi todo apaisado). */
function viewportFollowZoom(boxes, rect, fitZoom, margin=16){
  if(!(fitZoom<FOLLOW_MIN_ZOOM) || !rect || rect.width<=2*margin || rect.height<=2*margin) return null;
  let z=FOLLOW_MAX_ZOOM;
  for(const b of boxes||[]){
    if(!b) continue;
    z=Math.min(z, (rect.width-2*margin)/Math.max(b.w,1), (rect.height-2*margin)/Math.max(b.h,1));
  }
  return Math.max(FOLLOW_MIN_ZOOM, fitZoom, z);
}
/* El viewport que enseña `box` entero en la zona libre a `zoom`, o null si `vp` ya lo enseña así (no se mueve la cámara de más).
   Si el momento no cabe ni a ese zoom, se centra el momento lo más posible SIN dejar fuera `focus` {x,y,hw,hh} (su primer
   elemento, entero): se ve ese elemento, como scRevealMoment en el editor, y todo lo del momento que quepa a su alrededor. */
function viewportFrameBox(vp, box, rect, zoom, margin=16, focus=null){
  if(!box) return null;
  const x0=box.x*zoom+vp.x, y0=box.y*zoom+vp.y, x1=x0+box.w*zoom, y1=y0+box.h*zoom;
  if(Math.abs(vp.zoom-zoom)<1e-6 && x0>=rect.left+margin && y0>=rect.top+margin && x1<=rect.left+rect.width-margin && y1<=rect.top+rect.height-margin) return null;
  let cx=box.x+box.w/2, cy=box.y+box.h/2;
  if(focus){
    /* media zona libre en mundo; el centro se acerca al foco lo justo para que el foco quepa entero */
    const ax=(rect.width-2*margin)/zoom/2-(focus.hw||0), ay=(rect.height-2*margin)/zoom/2-(focus.hh||0);
    cx=ax>0 ? clamp(cx, focus.x-ax, focus.x+ax) : focus.x;
    cy=ay>0 ? clamp(cy, focus.y-ay, focus.y+ay) : focus.y;
  }
  return {zoom, x:rect.left+rect.width/2-cx*zoom, y:rect.top+rect.height/2-cy*zoom};
}
/* Paso k∈[0,1] de `a` a `b` mirando el punto de pantalla (cx,cy): el punto del mundo bajo él va en línea recta y el zoom crece
   geométricamente (acercarse ×2 dura lo mismo que alejarse ×2). k=0 → a; k=1 → b exacto. */
function lerpViewport(a, b, k, cx, cy){
  if(k<=0) return {x:a.x, y:a.y, zoom:a.zoom};
  if(k>=1) return {x:b.x, y:b.y, zoom:b.zoom};
  const ax=(cx-a.x)/a.zoom, ay=(cy-a.y)/a.zoom, bx=(cx-b.x)/b.zoom, by=(cy-b.y)/b.zoom;
  const z=a.zoom*Math.pow(b.zoom/a.zoom, k), wx=ax+(bx-ax)*k, wy=ay+(by-ay)*k;
  return {x:cx-wx*z, y:cy-wy*z, zoom:z};
}
