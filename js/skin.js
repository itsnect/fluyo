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
/* FLUYO-019.3: lector ÚNICO de los colores que la piel interpreta (color y relleno del nodo). Admite exactamente
   los HEX del dominio (HEX_COLOR de story-authoring.js):
   · #rgb y #rrggbb → el MISMO string, sin tocar (los resultados de 019.1/019.2 no cambian);
   · #rrggbbaa → el color OPACO que se ve sobre el fondo de la piel `base` (ya resuelto: customBg #rgb/#rrggbb o el
     del tema): por canal round(fondo·(1−α) + color·α), α = aa/255, la misma mezcla que skinMix; "#rrggbb" en minúsculas;
   · cualquier otra cosa → null, y quien llama decide el respaldo (color: PALETTE[0]; relleno: el tono de cara).
   Total y determinista: no depende de render.js ni de colHex. `base` debe ser #rgb/#rrggbb. */
function skinColor(c, base){
  if(skinHexRGB(c)) return c;
  const m=typeof c==="string" && /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(c.trim());
  return m? skinMix(base, "#"+m[1], parseInt(m[2],16)/255) : null;
}
/* Tonos de un nodo sobre el fondo real del lienzo (tema o fondo personalizado). */
function skinTones(color, theme, bg){
  const T=THEMES[theme]||THEMES.dark, K=SKIN_TONES[theme==="dark"?"dark":"light"];
  const base=skinHexRGB(bg)? bg : T.bg;
  /* un color que la piel no sabe leer cae en el respaldo histórico del documento (normalizeProjectNode, colHex): PALETTE[0] */
  const col=skinColor(color, base) || PALETTE[0].c;
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
    const front=n.fill==="none"? T.bg : (skinColor(n.fill, T.bg) || T.front);
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
  const front=n.fill==="none"? T.bg : (skinColor(n.fill, T.bg) || T.front);
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
/* ---- Aterrizaje por silueta (FLUYO-019.4a, decisión 213) ----
   La silueta visible de un nodo con piel son las capas CERRADAS Y RELLENAS que pinta
   skinNode (una capa con `clip` solo se ve dentro de su recorte). No hay lista de
   formas: lo que cada forma pinta ya lo dice skinNode, y una forma sin piel no tiene
   silueta propia (su contorno visible es el lógico, donde ya está el ancla).
   Todas las capas de skinNode son convexas (caras, frente redondeado, cuerpo y tapa
   del cilindro, peana, LED), así que la recta corta cada una en UN intervalo: el que
   va del primer al último corte con su borde. Cortes exactos con L, Q y A. */
const SKIN_EPS=1e-9;
const SKIN_LANDING_MEMO=4096, SKIN_LANDING_T=new Map();   /* t* por destino y último tramo (ver skinEdgeLanding) */
function skinSilhouette(n){
  const sk=skinNode(n, "dark", THEMES.dark.bg);   /* solo la geometría: los tonos no importan */
  if(!sk) return [];
  return sk.layers.filter(L=>L.fill && L.segs.length && L.segs[L.segs.length-1].op==="Z").map(L=>({segs:L.segs, clip:L.clip||null}));
}
/* Parámetros t (en unidades de |u| = 1) donde la recta P + t·u corta el borde de `segs`. */
function skinLineCuts(P, u, segs){
  const ts=[], cross=(ax,ay,bx,by)=>ax*by-ay*bx;
  let cur=null, start=null;
  const seg=(a,b)=>{
    const dx=b.x-a.x, dy=b.y-a.y, den=cross(u.x,u.y,dx,dy), wx=a.x-P.x, wy=a.y-P.y;
    if(Math.abs(den)<SKIN_EPS){
      if(Math.abs(cross(wx,wy,u.x,u.y))<1e-7){ ts.push(wx*u.x+wy*u.y, (b.x-P.x)*u.x+(b.y-P.y)*u.y); }   /* colineal: sus extremos */
      return;
    }
    const s=cross(wx,wy,u.x,u.y)/den;
    if(s>=-1e-9 && s<=1+1e-9) ts.push(cross(wx,wy,dx,dy)/den);
  };
  const quad=(a,c,b)=>{
    /* n·(B(s) − P) = 0 con n ⊥ u y B(s) = a(1−s)² + 2c·s(1−s) + b·s² */
    const nx=-u.y, ny=u.x;
    const A=nx*(a.x-2*c.x+b.x)+ny*(a.y-2*c.y+b.y), B=nx*2*(c.x-a.x)+ny*2*(c.y-a.y), C=nx*(a.x-P.x)+ny*(a.y-P.y);
    const roots=[];
    if(Math.abs(A)<SKIN_EPS){ if(Math.abs(B)>SKIN_EPS) roots.push(-C/B); }
    else { const D=B*B-4*A*C; if(D>=0){ const q=Math.sqrt(D); roots.push((-B-q)/(2*A), (-B+q)/(2*A)); } }
    for(const s of roots) if(s>=-1e-9 && s<=1+1e-9){
      const x=a.x*(1-s)*(1-s)+2*c.x*s*(1-s)+b.x*s*s, y=a.y*(1-s)*(1-s)+2*c.y*s*(1-s)+b.y*s*s;
      ts.push((x-P.x)*u.x+(y-P.y)*u.y);
    }
  };
  const arc=(o)=>{
    /* ((P + t·u − c)/r)² = 1, y el ángulo del corte dentro del barrido (el de c.ellipse: ccw = ángulos decrecientes) */
    const px=(P.x-o.cx)/o.rx, py=(P.y-o.cy)/o.ry, ux=u.x/o.rx, uy=u.y/o.ry;
    const A=ux*ux+uy*uy, B=2*(px*ux+py*uy), C=px*px+py*py-1, D=B*B-4*A*C;
    if(A<SKIN_EPS || D<0) return;
    const q=Math.sqrt(D), TAU=2*Math.PI, mod=(v)=>((v%TAU)+TAU)%TAU;
    const sweep=mod(o.ccw? o.a0-o.a1 : o.a1-o.a0) || TAU;
    for(const t of [(-B-q)/(2*A), (-B+q)/(2*A)]){
      const th=Math.atan2(py+t*uy, px+t*ux), d=mod(o.ccw? o.a0-th : th-o.a0);
      if(d<=sweep+1e-9 || d>=TAU-1e-9) ts.push(t);
    }
  };
  for(const s of segs){
    if(s.op==="M"){ cur={x:s.x,y:s.y}; start=cur; }
    else if(s.op==="L"){ seg(cur,{x:s.x,y:s.y}); cur={x:s.x,y:s.y}; }
    else if(s.op==="Q"){ quad(cur,{x:s.cx,y:s.cy},{x:s.x,y:s.y}); cur={x:s.x,y:s.y}; }
    else if(s.op==="A"){ arc(s); cur={x:s.cx+s.rx*Math.cos(s.a1), y:s.cy+s.ry*Math.sin(s.a1)}; }
    else if(s.op==="Z" && cur && start){ seg(cur,start); cur=start; }
  }
  return ts;
}
/* Intervalo [t0, t1] de la recta dentro de una capa convexa (y de su recorte), o null. */
function skinLayerSpan(P, u, layer){
  const span=(segs)=>{ const ts=skinLineCuts(P,u,segs); return ts.length? [Math.min(...ts), Math.max(...ts)] : null; };
  const a=span(layer.segs); if(!a) return null;
  if(!layer.clip) return a;
  const b=span(layer.clip); if(!b) return null;
  const t0=Math.max(a[0],b[0]), t1=Math.min(a[1],b[1]);
  return t0<=t1? [t0,t1] : null;
}
/* Aterrizaje: la punta RETROCEDE por su propio último tramo hasta salir de la silueta
   visible del destino B, y el trazo deja después su EDGE_GAP de siempre: queda a la
   misma distancia del contorno que se ve que en plano del contorno lógico. Solo se
   mueve el último vértice, y sobre su recta: ningún tramo se inclina, el origen y el
   número de puntos no cambian. No se toca si B no tiene silueta, si el ancla no está
   dentro de ella (t* = 0), si el último tramo llega desde dentro de la caja de anclaje
   o si no hay tramo para retroceder (t* > L − 1). Se aplica DESPUÉS de edgePoints y
   ANTES de edgeStroke. Determinista y sin efectos sobre sus argumentos (la memo solo evita
   recalcular); devuelve una copia, y aplicada dos veces da lo mismo. */
function skinEdgeLanding(pts, B){
  const out=(pts||[]).map(p=>({x:p.x,y:p.y}));
  const n=out.length;
  if(n<2 || !B) return out;
  const z=out[n-1], p=out[n-2], L=Math.hypot(p.x-z.x, p.y-z.y);
  if(L<.01) return out;
  const a=anchorBox(B);
  if(Math.abs(p.x-a.x)<a.w/2-SKIN_EPS && Math.abs(p.y-a.y)<a.h/2-SKIN_EPS) return out;   /* llega desde dentro */
  const u={x:(p.x-z.x)/L, y:(p.y-z.y)/L};   /* hacia fuera, por el último tramo */
  /* t* solo depende de la geometría del destino (forma y caja: lo único que mira skinSilhouette) y de los dos últimos
     puntos: se memoiza por esa clave, porque el lienzo lo pide en cada fotograma para cada conexión (y la pelota otra vez) */
  const key=B.shape+"|"+B.x+"|"+B.y+"|"+B.w+"|"+B.h+"|"+z.x+"|"+z.y+"|"+p.x+"|"+p.y;
  let t=SKIN_LANDING_T.get(key);
  if(t===undefined){
    const spans=skinSilhouette(B).map(l=>skinLayerSpan(z,u,l)).filter(Boolean);
    let grew=true; t=0;
    while(grew){ grew=false; for(const [t0,t1] of spans) if(t0<=t+1e-6 && t1>t+1e-6){ t=t1; grew=true; } }
    if(SKIN_LANDING_T.size>=SKIN_LANDING_MEMO) SKIN_LANDING_T.clear();
    SKIN_LANDING_T.set(key, t);
  }
  if(t<=1e-6 || t>L-1) return out;
  z.x+=u.x*t; z.y+=u.y*t;
  return out;
}
/* Anillo de salida de una conexión: relleno del fondo, borde del color de la línea. No interpreta colores (019.3):
   el anillo lleva el color de la línea y el fondo tal como los pinta el lienzo, sin pasar por skinColor. */
function skinEdgePort(p, lineColor, bg){
  return {k:"port", segs:skinEllipse(p.x,p.y,SKIN_PORT_R,SKIN_PORT_R), fill:bg, stroke:lineColor, sw:1.5};
}
