"use strict";
/* ===================== Piel «construido» (FLUYO-019.1) =====================
   Una capa PURAMENTE VISUAL: convierte un nodo o una conexión del documento en
   caras, líneas y rótulos (listas de segmentos M/L/Q/A/Z, las mismas que
   cylinderSegments y edgeStroke en js/geometry.js). No lee el documento global,
   no escribe en el nodo ni en la conexión y no conoce el lienzo: la recorren
   render.js (traceSegments) y export.js (segmentsToSVGPath). Nada de esto se
   persiste: la piel es un ARGUMENTO DE PINTADO (`render(c,t,{skin})`,
   `buildSVGDocument(scale,skin)`), no un dato del documento.

   Sistema (ver .ai/tasks/FLUYO-019.md §4):
   · profundidad = un vector constante d = (+SKIN_DEPTH, −SKIN_DEPTH): oblicua a 45°,
     hacia arriba y a la derecha; la cara FRONTAL es exactamente la caja semántica
     (x, y, w, h), así que anclas, rutas, acierto y selección no cambian;
   · tres tonos planos por cara (tapa, frente, lateral) mezclando el color del nodo
     con el fondo del lienzo; sin gradientes ni desenfoques;
   · una línea de tinta fina, una línea de contacto bajo la base y un LED del color
     del nodo; el cilindro conserva su geometría (018.14a) y gana tapa clara y banda;
   · un nodo `icon` no se extruye: su glifo se apoya en una peana;
   · por debajo de SKIN_MIN_PX de canto en pantalla la piel se apaga (skinActive). */

const SKIN_FLAT="flat", SKIN_BUILT="built";
const SKIN_DEPTH=8;          // unidades de mundo
const SKIN_MIN_PX=3;         // canto mínimo en pantalla para que compense dibujarlo
const SKIN_FRONT_R=2;        // radio del frente: un objeto construido tiene cantos
const SKIN_LED_R=2.4, SKIN_LED_IN=10;
const SKIN_PORT_R=3;         // anillo de salida de una conexión
const SKIN_PLINTH_H=7, SKIN_PLINTH_PAD=8;   // peana del icono
/* mezclas con el fondo (fracción del color del nodo) y alphas de la tinta del tema */
const SKIN_TONES={
  light:{top:.10, front:.22, side:.40, line:.45, contact:.22},
  dark :{top:.14, front:.26, side:.46, line:.55, contact:.50},
};
/* formas con pintor propio que la piel NO toca; lo demás (rect y formas desconocidas) es un bloque */
const SKIN_FLAT_SHAPES=new Set(["circle","diamond","hex","text","code","image","anim"]);

function skinActive(skin, zoom){
  const z=Number.isFinite(zoom)&&zoom>0? zoom : 1;
  return skin===SKIN_BUILT && SKIN_DEPTH*z>=SKIN_MIN_PX;
}
function skinHexRGB(h){
  if(typeof h!=="string") return null;
  const m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim()); if(!m) return null;
  let s=m[1]; if(s.length===3) s=s.split("").map(ch=>ch+ch).join("");
  const v=parseInt(s,16); return [v>>16&255, v>>8&255, v&255];
}
function skinMix(bg, col, t){
  const a=skinHexRGB(bg), b=skinHexRGB(col);
  const c=[0,1,2].map(i=>Math.round(a[i]*(1-t)+b[i]*t));
  return "#"+c.map(v=>v.toString(16).padStart(2,"0")).join("");
}
function skinRGBA(hex, alpha){ const c=skinHexRGB(hex); return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`; }
/* Tonos de un nodo sobre el fondo real del lienzo (tema o fondo personalizado). */
function skinTones(color, theme, bg){
  const T=THEMES[theme]||THEMES.dark, K=SKIN_TONES[theme==="dark"?"dark":"light"];
  const base=skinHexRGB(bg)? bg : T.bg;
  /* un color no hex (histórico) cae en el mismo respaldo que el lienzo (colHex, render.js) */
  const col=skinHexRGB(color)? color : (typeof colHex==="function"? colHex(color) : DEFAULT_NODE_COLOR);
  return { top:skinMix(base,col,K.top), front:skinMix(base,col,K.front), side:skinMix(base,col,K.side),
           line:skinRGBA(T.text,K.line), contact:skinRGBA(T.text,K.contact), bg:base, color:col };
}
/* ---- segmentos ---- */
function skinPoly(pts){ return pts.map((p,i)=>({op:i?"L":"M", x:p.x, y:p.y})).concat([{op:"Z"}]); }
function skinRect(x,y,w,h,r){
  if(!r) return skinPoly([{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]);
  return [{op:"M",x:x+r,y},{op:"L",x:x+w-r,y},{op:"Q",cx:x+w,cy:y,x:x+w,y:y+r},{op:"L",x:x+w,y:y+h-r},{op:"Q",cx:x+w,cy:y+h,x:x+w-r,y:y+h},
          {op:"L",x:x+r,y:y+h},{op:"Q",cx:x,cy:y+h,x,y:y+h-r},{op:"L",x,y:y+r},{op:"Q",cx:x,cy:y,x:x+r,y},{op:"Z"}];
}
function skinEllipse(cx,cy,rx,ry){
  return [{op:"M",x:cx-rx,y:cy},{op:"A",cx,cy,rx,ry,a0:Math.PI,a1:0,ccw:true},{op:"A",cx,cy,rx,ry,a0:0,a1:Math.PI,ccw:true},{op:"Z"}];
}
/* tapa y lateral de un bloque cuya cara frontal es (x0,y0,w,h) */
function skinFaces(x0,y0,w,h,d){
  return { top:[{x:x0,y:y0},{x:x0+w,y:y0},{x:x0+w+d,y:y0-d},{x:x0+d,y:y0-d}],
           side:[{x:x0+w,y:y0},{x:x0+w+d,y:y0-d},{x:x0+w+d,y:y0+h-d},{x:x0+w,y:y0+h}] };
}
function skinDash(n){ return n.border==="dashed"? [9,7] : n.border==="dotted"? [2,5] : null; }
function skinHasSkin(n){ return !!n && !SKIN_FLAT_SHAPES.has(n.shape); }
/* Tamaño del glifo de un `icon`: el de drawNode/renderNodeToSVG/anchorBox. */
function skinIconGlyph(n){ return Math.min(n.w, n.h-26)*.78; }

/* Capas de un nodo, de abajo arriba: {k, segs, fill?, stroke?, sw?, dash?, clip?}.
   null si la forma no tiene piel (el pintor hace lo de siempre). El rótulo lo sigue
   maquetando labelLayout: aquí solo se propone la voz (skinLabelFont). */
function skinNode(n, theme, bg){
  if(!skinHasSkin(n)) return null;
  const d=SKIN_DEPTH, T=skinTones(n.color, theme, bg), dash=skinDash(n);
  const x0=n.x-n.w/2, y0=n.y-n.h/2;
  const layers=[];
  if(n.shape==="cylinder"){
    const s=cylinderSegments(n), g=cylinderGeom(n), capY=g.top+g.ry, baseY=g.bot-g.ry;
    const front=n.fill==="none"? T.bg : (skinHexRGB(n.fill)? n.fill : T.front);
    layers.push({k:"body", segs:s.outline, fill:front, stroke:T.line, sw:1, dash});
    const bx=g.cx+g.rx*.5;
    layers.push({k:"band", segs:skinPoly([{x:bx,y:capY-g.ry-2},{x:g.cx+g.rx+2,y:capY-g.ry-2},{x:g.cx+g.rx+2,y:baseY+g.ry+2},{x:bx,y:baseY+g.ry+2}]), fill:T.side, clip:s.outline});
    layers.push({k:"cap", segs:skinEllipse(g.cx,capY,g.rx,g.ry), fill:T.top, stroke:T.line, sw:1, dash});
    layers.push({k:"led", segs:skinEllipse(x0+12, baseY-4, SKIN_LED_R, SKIN_LED_R), fill:T.color});
    return {layers};
  }
  if(n.shape==="icon"){
    const s=skinIconGlyph(n), pw=s+2*SKIN_PLINTH_PAD, ph=SKIN_PLINTH_H;
    const px0=n.x-pw/2, py0=y0+4+s-2, f=skinFaces(px0,py0,pw,ph,d);
    layers.push({k:"top",   segs:skinPoly(f.top),  fill:T.top,   stroke:T.line, sw:1});
    layers.push({k:"side",  segs:skinPoly(f.side), fill:T.side,  stroke:T.line, sw:1});
    layers.push({k:"front", segs:skinRect(px0,py0,pw,ph,0), fill:T.front, stroke:T.line, sw:1});
    return {layers};
  }
  const f=skinFaces(x0,y0,n.w,n.h,d);
  const front=n.fill==="none"? T.bg : (skinHexRGB(n.fill)? n.fill : T.front);
  layers.push({k:"contact", segs:[{op:"M",x:x0+2,y:y0+n.h+1.5},{op:"L",x:x0+n.w+1,y:y0+n.h+1.5}], stroke:T.contact, sw:2});
  layers.push({k:"top",   segs:skinPoly(f.top),  fill:T.top,  stroke:T.line, sw:1});
  layers.push({k:"side",  segs:skinPoly(f.side), fill:T.side, stroke:T.line, sw:1});
  layers.push({k:"front", segs:skinRect(x0,y0,n.w,n.h,SKIN_FRONT_R), fill:front, stroke:T.line, sw:1, dash});
  layers.push({k:"led",   segs:skinEllipse(x0+SKIN_LED_IN, y0+n.h-SKIN_LED_IN, SKIN_LED_R, SKIN_LED_R), fill:T.color});
  return {layers};
}
/* Voz del rótulo con la piel: IBM Plex Mono 500 cuando el nodo no trae fuente y la
   global es la de serie. Si quien diagrama eligió tipografía, se respeta. El tamaño
   lo sigue dando labelLayout (y `fs` manual manda). null = sin cambio. */
function skinLabelFont(n, globalFont){
  if(!n || n.font) return null;
  if(globalFont && globalFont!==DEFAULT_FONT) return null;
  const plex=(typeof FONTS!=="undefined" && FONTS.find(f=>f.n==="IBM Plex Mono"))||null;
  if(!plex) return null;
  return {family:plex.f, weight:n.bold? "bold" : "500"};
}
/* Envolvente de la caja semántica y sus caras (recortes de overlays, apilado de cues). */
function skinExtent(n){
  if(!skinHasSkin(n)) return null;
  const d=SKIN_DEPTH, x0=n.x-n.w/2, y0=n.y-n.h/2, x1=n.x+n.w/2, y1=n.y+n.h/2;
  if(n.shape==="cylinder") return {x0, y0, x1:x1+2, y1};
  if(n.shape==="icon"){ const s=skinIconGlyph(n), pw=s+2*SKIN_PLINTH_PAD; return {x0:Math.min(x0,n.x-pw/2), y0, x1:Math.max(x1,n.x+pw/2+d), y1}; }
  return {x0, y0:y0-d, x1:x1+d, y1:y1+2};
}
/* Orden de pintor con la piel: el de abajo y el de la izquierda se pintan después,
   para que una tapa o un lateral nunca quede sobre un vecino que está delante.
   Solo afecta al dibujo: el orden Z del documento (acierto, selección) no cambia. */
function skinPaintOrder(nodes){
  return nodes.slice().sort((a,b)=>(a.y-b.y)||(b.x-a.x));
}
/* Aterrizaje en la cara visible: si la conexión entra por el norte o el este, la
   punta se posa en la tapa o en el lateral (d/2). Se aplica DESPUÉS de edgePoints y
   ANTES de edgeStroke; el penúltimo vértice acompaña para que el tramo final siga
   ortogonal. Una recta de dos puntos no se toca (no hay vértice que acompañe), y
   un tramo final que no sea vertical/horizontal, tampoco. Devuelve una copia. */
function skinEdgeLanding(pts, toSide){
  const out=(pts||[]).map(p=>({x:p.x,y:p.y}));
  if(out.length<3 || (toSide!=="n" && toSide!=="e")) return out;
  const n=out.length, z=out[n-1], p=out[n-2];
  const vertical=Math.abs(z.x-p.x)<.01, horizontal=Math.abs(z.y-p.y)<.01;
  if(toSide==="n" && !vertical) return out;
  if(toSide==="e" && !horizontal) return out;
  const sx=SKIN_DEPTH/2, sy=-SKIN_DEPTH/2;
  z.x+=sx; z.y+=sy;
  if(toSide==="n") p.x+=sx; else p.y+=sy;
  return out;
}
/* Anillo de salida de una conexión: relleno del fondo, borde del color de la línea. */
function skinEdgePort(p, lineColor, bg){
  return {k:"port", segs:skinEllipse(p.x,p.y,SKIN_PORT_R,SKIN_PORT_R), fill:bg, stroke:lineColor, sw:1.5};
}
