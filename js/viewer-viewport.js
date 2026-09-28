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
