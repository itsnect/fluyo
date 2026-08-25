"use strict";
/* Render del lienzo y bucle de animación */

/* ===================== Render ===================== */
function nodeAlpha(n,t){
  if(!settings.build) return 1;
  return smooth((t - n.order*settings.stagger)/0.5);
}
function buildDuration(){
  if(!settings.build || !P().nodes.length) return 0;
  const maxO=P().nodes.reduce((m,n)=>Math.max(m,n.order),0);
  return maxO*settings.stagger + 0.8;
}
function roundRect(c,x,y,w,h,r){
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}
function shapePath(c,n){
  const {x,y,w,h}=n;
  c.beginPath();
  switch(n.shape){
    case "circle": c.arc(x,y,w/2,0,Math.PI*2); break;
    case "diamond": c.moveTo(x,y-h/2); c.lineTo(x+w/2,y); c.lineTo(x,y+h/2); c.lineTo(x-w/2,y); c.closePath(); break;
    case "hex":{ const i=Math.min(24,w*.18);
      c.moveTo(x-w/2+i,y-h/2); c.lineTo(x+w/2-i,y-h/2); c.lineTo(x+w/2,y);
      c.lineTo(x+w/2-i,y+h/2); c.lineTo(x-w/2+i,y+h/2); c.lineTo(x-w/2,y); c.closePath(); break;}
    default: roundRect(c,x-w/2,y-h/2,w,h,10);
  }
}
function objFont(o,fs){
  const fam=(o&&o.font)||settings.font||"Georgia, serif";
  return `${o&&o.bold?"bold ":""}${fs}px ${fam}`;
}
/* Medidor para el lienzo. Toca c.font, que quien dibuja vuelve a fijar antes de
   escribir nada, así que el efecto secundario no se ve. */
function measureNodeLabel(c,n){
  const lines=String(n.label==null?"":n.label).split("\n");
  return fs=>{ c.font=objFont(n,fs); return Math.max(...lines.map(l=>c.measureText(l).width),1); };
}
function drawLabelLines(c,n,theme){
  const T=THEMES[theme];
  /* Mientras se edita, el texto lo pinta el textarea transparente que hay encima.
     Dibujarlo también aquí deja dos copias desplazadas medio píxel, que se ve
     peor que el recuadro opaco que esto viene a quitar. */
  if(editing===n) return;
  const L=labelLayout(n, measureNodeLabel(c,n));
  const {lines, fs, lh, tx, align, baseY}=L;
  c.font=objFont(n,fs);
  // fondo del texto (rectángulo tipo caja)
  if(n.textBg){
    const maxW=Math.max(...lines.map(l=>c.measureText(l).width),1);
    const padX=10, padY=6;
    const bw=maxW+padX*2, bh=lines.length*lh+padY*2;
    let bx;
    if(align==="left") bx=tx-padX; else if(align==="right") bx=tx-bw+padX; else bx=tx-bw/2;
    const by=baseY-fs*.7-padY;
    c.save(); c.fillStyle=n.textBg;
    c.beginPath(); roundRect(c,bx,by,bw,bh,8); c.fill(); c.restore();
  }
  /* textColor manda cuando está puesto. Sin él se conserva el comportamiento
     anterior: el texto suelto y las etiquetas de GIF heredan el color del nodo,
     y el texto dentro de una forma usa el color del tema. */
  c.fillStyle = n.textColor || ((n.shape==="text"||n.shape==="anim")? n.color : T.text);
  c.textAlign=align; c.textBaseline="middle";
  lines.forEach((l,i)=>c.fillText(l,tx,baseY+i*lh));
}
function fillFor(n,theme){
  if(n.fill==="none") return null;
  if(n.fill) return n.fill;
  return hexA(n.color, theme==="crema"?.16:.18);
}
function borderDash(n,c){
  if(n.border==="dashed") c.setLineDash([9,7]);
  else if(n.border==="dotted") c.setLineDash([2,5]);
  else c.setLineDash([]);
}
function nodeCorners(n){
  return [[n.x-n.w/2-6,n.y-n.h/2-6],[n.x+n.w/2+6,n.y-n.h/2-6],
          [n.x+n.w/2+6,n.y+n.h/2+6],[n.x-n.w/2-6,n.y+n.h/2+6]];
}
function drawAnim(c,n,t,theme,glow){
  const col=n.color||"#3aa7e8";
  const cx=n.x, cy=n.y - (n.label? 8:0);
  const r=Math.max(10, Math.min(n.w, n.h - (n.label?26:8))*.34);
  const rate=Math.max(.4, settings.speed*2);
  const T=THEMES[theme];
  c.save();
  c.lineCap="round"; c.lineJoin="round";
  if(glow>0){ c.shadowColor=col; c.shadowBlur=16*glow; }
  switch(n.anim){
    case "spinner":{
      const a0=(t*rate*Math.PI*2)%(Math.PI*2);
      c.strokeStyle=hexA(colHex(col),.2); c.lineWidth=r*.28;
      c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.stroke();
      c.strokeStyle=col; c.beginPath(); c.arc(cx,cy,r,a0,a0+Math.PI*1.4); c.stroke();
      break;
    }
    case "progress":{
      const w=r*3, h=r*.5, x=cx-w/2, y=cy-h/2;
      const p=(t*rate*.5)%1;
      c.fillStyle=hexA(colHex(col),.2);
      c.beginPath(); roundRect(c,x,y,w,h,h/2); c.fill();
      c.save(); c.beginPath(); roundRect(c,x,y,w,h,h/2); c.clip();
      c.fillStyle=col; c.fillRect(x, y, w*p, h); c.restore();
      break;
    }
    case "ticket":{
      const w=r*3, span=r*3;
      const p=((t*rate*.4)%1);
      const tw=r*1.1, th=r*1.3;
      const x=cx-span/2 + p*(span) - tw/2;
      c.globalAlpha=Math.min(1, Math.min(p,1-p)*6);
      c.strokeStyle=col; c.fillStyle=hexA(colHex(col),.15); c.lineWidth=2.4;
      c.beginPath(); roundRect(c,x,cy-th/2,tw,th,4); c.fill(); c.stroke();
      c.strokeStyle=col; c.lineWidth=1.8;
      c.beginPath();
      c.moveTo(x+5,cy-th/4); c.lineTo(x+tw-5,cy-th/4);
      c.moveTo(x+5,cy); c.lineTo(x+tw-8,cy);
      c.moveTo(x+5,cy+th/4); c.lineTo(x+tw-10,cy+th/4);
      c.stroke();
      break;
    }
    case "errmove":{
      const sh=Math.sin(t*rate*Math.PI*4)*r*.16;
      c.translate(cx+sh,cy);
      c.strokeStyle="#d0576a"; c.lineWidth=r*.24;
      c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.stroke();
      c.beginPath(); c.moveTo(-r*.45,-r*.45); c.lineTo(r*.45,r*.45);
      c.moveTo(r*.45,-r*.45); c.lineTo(-r*.45,r*.45); c.stroke();
      break;
    }
    case "check":{
      const loop=(t*rate*.5)%1;
      const draw=smooth(clamp(loop*2.2,0,1));
      c.strokeStyle="#7bb85b"; c.lineWidth=r*.2;
      c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2*Math.min(1,loop*3)); c.stroke();
      const p0=[cx-r*.4,cy+r*.02], p1=[cx-r*.08,cy+r*.36], p2=[cx+r*.5,cy-r*.4];
      c.beginPath(); c.moveTo(p0[0],p0[1]);
      if(draw<.5){ const u=draw/.5; c.lineTo(lerp(p0[0],p1[0],u),lerp(p0[1],p1[1],u)); }
      else{ c.lineTo(p1[0],p1[1]); const u=(draw-.5)/.5; c.lineTo(lerp(p1[0],p2[0],u),lerp(p1[1],p2[1],u)); }
      c.stroke();
      break;
    }
    case "typing":{
      c.fillStyle=col;
      for(let i=0;i<3;i++){
        const ph=t*rate*Math.PI*2 - i*.6;
        const dy=Math.max(0,Math.sin(ph))*r*.5;
        c.globalAlpha=.4+Math.max(0,Math.sin(ph))*.6;
        c.beginPath(); c.arc(cx+(i-1)*r*.8, cy-dy, r*.26, 0, Math.PI*2); c.fill();
      }
      break;
    }
    case "upload":{
      c.strokeStyle=col; c.lineWidth=r*.18;
      c.beginPath(); c.moveTo(cx-r*.7,cy+r*.9); c.lineTo(cx+r*.7,cy+r*.9); c.stroke();
      for(let i=0;i<2;i++){
        const p=((t*rate*.6 + i*.5)%1);
        c.globalAlpha=Math.min(1,Math.min(p,1-p)*5);
        const y=cy+r*.5 - p*r*1.3;
        c.beginPath(); c.moveTo(cx,y+r*.5); c.lineTo(cx,y-r*.5);
        c.moveTo(cx-r*.4,y-r*.1); c.lineTo(cx,y-r*.5); c.lineTo(cx+r*.4,y-r*.1);
        c.stroke();
      }
      break;
    }
    case "pulse":{
      for(let i=0;i<3;i++){
        const p=((t*rate*.7 + i/3)%1);
        c.globalAlpha=(1-p)*.6;
        c.strokeStyle=col; c.lineWidth=2;
        c.beginPath(); c.arc(cx,cy,r*.4+p*r*.9,0,Math.PI*2); c.stroke();
      }
      c.globalAlpha=1; c.fillStyle=col;
      c.beginPath(); c.arc(cx,cy,r*.4,0,Math.PI*2); c.fill();
      break;
    }
    default:
      c.strokeStyle=col; c.lineWidth=3;
      c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.stroke();
  }
  c.restore();
}
/* ===================== Nodo de código =====================
   Se dibuja CARÁCTER A CARÁCTER sobre la rejilla de codeBlockLayout. No es
   derroche: es lo que garantiza que el resaltado caiga exactamente detrás de su
   palabra aunque la fuente que resuelva tenga otro avance (en Chrome/Windows
   `monospace` es Consolas, avance 0.55 frente a la rejilla de 0.6). Dibujar la
   línea entera de una vez deja el texto corrido respecto a los rectángulos, que
   es el defecto que traía el fork.

   En monoespaciada no se pierde nada por hacerlo así: sin kerning ni ligaduras,
   el resultado es idéntico a dibujar la cadena de golpe.

   Coste medido en Chrome con 4 nodos y 544 fillText por fotograma: 0.63 ms, el
   3.8 % del presupuesto a 60fps. */
function drawCodeNode(c,n,theme,glow){
  const L=codeBlockLayout(n), col=codeColors(n,theme);
  const x=n.x-n.w/2, y=n.y-n.h/2;
  c.save();
  c.fillStyle=col.panel;
  c.strokeStyle=n.color; c.lineWidth=2.5+glow*1.5;
  if(glow>0){ c.shadowColor=n.color; c.shadowBlur=18*glow; }
  c.beginPath(); roundRect(c,x,y,n.w,n.h,10); c.fill();
  borderDash(n,c); c.stroke(); c.setLineDash([]);
  c.shadowBlur=0;
  /* el bloque no puede desbordar el panel aunque el texto sea más ancho */
  c.beginPath(); roundRect(c,x+2,y+2,n.w-4,n.h-4,9); c.clip();
  c.fillStyle=col.paper;
  c.beginPath(); roundRect(c,L.bx,L.by,L.bw,L.blockH,6); c.fill();
  c.font=`${n.bold===false?"":"700 "}${L.fs}px ${codeFont(n)}`;
  c.textBaseline="middle"; c.textAlign="left";
  for(const row of L.rows){
    for(const tk of row.tokens){
      if(tk.kw){
        c.fillStyle=col.kwBg;
        c.fillRect(tk.x-2, row.ly-L.fs/2-2, tk.w+4, L.fs+6);
      }
      c.fillStyle = tk.kw ? col.kwText : col.text;
      for(let j=0;j<tk.t.length;j++) c.fillText(tk.t[j], tk.x+j*L.adv, row.ly);
    }
  }
  c.restore();
}
function colHex(c){ return (typeof c==="string" && c[0]==="#")? c : "#3aa7e8"; }
function drawNode(c,n,t,theme,isExport){
  const a=nodeAlpha(n,t); if(a<=0) return;
  c.save(); c.globalAlpha=a;
  const grow=settings.build? lerp(.85,1,a):1;
  c.translate(n.x,n.y); c.scale(grow,grow); c.translate(-n.x,-n.y);
  let glow=0;
  if(n.pulse) glow=(Math.sin(t*2*Math.PI*Math.max(.3,settings.speed)*2)+1)/2;
  const T=THEMES[theme];

  if(n.shape==="image" && n.img){
    const im=getImg(n.img);
    if(im.complete && im.naturalWidth){
      if(glow>0){c.shadowColor="#3aa7e8"; c.shadowBlur=20*glow;}
      c.drawImage(im, n.x-n.w/2, n.y-n.h/2, n.w, n.h);
      c.shadowBlur=0;
    }
    if(n.label) drawLabelLines(c,n,theme);
  }
  else if(n.shape==="icon"){
    const im=getImg(iconURLFor(n.icon, nodeIconTint(n)));
    const s=Math.min(n.w,n.h-26)*.78;
    if(glow>0){c.shadowColor=n.color; c.shadowBlur=18*glow;}
    if(im.complete && im.naturalWidth) c.drawImage(im, n.x-s/2, n.y-n.h/2+4, s, s);
    c.shadowBlur=0;
    if(n.label) drawLabelLines(c,n,theme);
  }
  else if(n.shape==="cylinder"){
    const {x,y,w,h}=n, ry=Math.min(16,h*.18), top=y-h/2, bot=y+h/2;
    const fc=fillFor(n,theme);
    c.strokeStyle=n.color; c.lineWidth=2.5+glow*1.5;
    if(glow>0){c.shadowColor=n.color; c.shadowBlur=18*glow;}
    c.beginPath();
    c.moveTo(x-w/2,top+ry); c.lineTo(x-w/2,bot-ry);
    c.bezierCurveTo(x-w/2,bot+ry*.8, x+w/2,bot+ry*.8, x+w/2,bot-ry);
    c.lineTo(x+w/2,top+ry);
    c.bezierCurveTo(x+w/2,top-ry*.8, x-w/2,top-ry*.8, x-w/2,top+ry);
    if(fc){ c.fillStyle=fc; c.fill(); }
    borderDash(n,c); c.stroke();
    c.beginPath(); c.ellipse(x,top+ry,w/2,ry,0,0,Math.PI*2); c.stroke();
    c.setLineDash([]);
    c.shadowBlur=0;
    drawLabelLines(c,n,theme);
  }
  else if(n.shape==="text"){
    drawLabelLines(c,n,theme);
  }
  else if(n.shape==="anim"){
    drawAnim(c,n,t,theme,glow);
    if(n.label) drawLabelLines(c,n,theme);
  }
  else if(n.shape==="code"){
    drawCodeNode(c,n,theme,glow);
  }
  else{
    const fc=fillFor(n,theme);
    c.strokeStyle=n.color; c.lineWidth=2.5+glow*1.5;
    if(glow>0){c.shadowColor=n.color; c.shadowBlur=18*glow;}
    shapePath(c,n);
    if(fc){ c.fillStyle=fc; c.fill(); }
    borderDash(n,c); c.stroke(); c.setLineDash([]);
    c.shadowBlur=0;
    drawLabelLines(c,n,theme);
  }
  c.restore();

  if(!isExport && selN.has(n.id)){
    c.save();
    c.setLineDash([6,5]); c.strokeStyle="#3aa7e8"; c.lineWidth=1.5;
    c.strokeRect(n.x-n.w/2-6,n.y-n.h/2-6,n.w+12,n.h+12); c.setLineDash([]);
    const s=singleSel();
    if(s && s.type==="node" && s.obj && s.obj.id===n.id){
      c.fillStyle="#fff"; c.strokeStyle="#3aa7e8"; c.lineWidth=1.5;
      for(const [cx,cy] of nodeCorners(n)){
        c.beginPath(); c.rect(cx-HANDLE/2,cy-HANDLE/2,HANDLE,HANDLE); c.fill(); c.stroke();
      }
    }
    c.restore();
  }
}
/* Medidor de etiquetas para el lienzo. Toca c.font, que drawEdge vuelve a fijar
   antes de escribir nada, así que el efecto secundario no se ve. */
function measureCanvasLabel(c){
  return e=>{
    const efs=edgeLabelFs(e);
    c.font=objFont(e,efs);
    return {w:c.measureText(e.label).width, h:efs*1.7};
  };
}
function arrowHead(c,x,y,ang,col){
  c.save(); c.translate(x,y); c.rotate(ang);
  c.fillStyle=col; c.beginPath();
  c.moveTo(1,0); c.lineTo(-11,-6); c.lineTo(-11,6); c.closePath(); c.fill();
  c.restore();
}
/* ===================== Puntos por flecha =====================
   Por defecto una flecha usa el número de puntos y la velocidad globales. Solo
   si se desmarca «Puntos globales» pasa a mandar su propio valor. */
function edgeDots(e){
  if(e.dotsGlobal===false && e.dots) return clamp(Math.round(e.dots),1,6);
  return settings.dots;
}
function edgeSpeedFac(e){ return clamp(+e.speedFac||1,1,4); }

/* ===================== Pelota única por ruta =====================
   Este modo no anima cada flecha por separado: manda UNA pelota desde cada nodo
   de origen, que avanza por el diagrama en un solo ciclo de flujo y SE PARTE en
   cada bifurcación — al llegar a un nodo con dos salidas, salen dos pelotas.

   Que sea un ciclo para todo el recorrido, y no uno por flecha, es deliberado:
   la exportación a GIF ajusta settings.speed para que el periodo (1/speed) quepa
   un número entero de veces en la duración elegida. Si la pelota tardase un
   ciclo por flecha, un recorrido de tres flechas rompería ese cuadre y el GIF no
   cerraría el bucle.

   Cómo se consigue el reparto: se enumeran todos los caminos completos de un
   origen a un final, y todos los del mismo origen avanzan a la MISMA distancia
   recorrida (no a la misma fracción de su camino). Así, mientras comparten
   tramo, las pelotas caen en el mismo punto exacto —se ven como una sola— y se
   separan justo en la bifurcación. Normalizar por fracción de cada camino, que
   es lo natural, las desincronizaría en el tramo compartido.

   Una cadena lineal —el caso normal— tiene un solo camino y sale idéntica a
   antes: una pelota, un ciclo. */
const FLOW_MAX_PATHS=200;   // topes para no colgarse en grafos muy ramificados
const FLOW_MAX_DEPTH=60;
/* Devuelve grupos de caminos: un grupo por nodo de origen, y dentro de él todos
   los caminos completos que nacen ahí. El grupo es la unidad que comparte reloj. */
function flowGroups(){
  const edges=P().edges.filter(e=>e.animated!==false && nodeById(e.from) && nodeById(e.to));
  if(!edges.length) return [];
  const out=new Map(), hasIn=new Set();
  for(const e of edges){
    if(!out.has(e.from)) out.set(e.from,[]);
    out.get(e.from).push(e);
    hasIn.add(e.to);
  }
  const covered=new Set(), groups=[];
  const expand=startId=>{
    const paths=[], path=[], onPath=new Set();
    /* onPath impide repetir una flecha dentro del mismo camino, que es lo que
       evita colgarse en un ciclo (A→B→A) sin prohibir que dos caminos distintos
       pasen los dos por la misma flecha */
    const walk=nodeId=>{
      if(paths.length>=FLOW_MAX_PATHS) return;
      const next=(out.get(nodeId)||[]).filter(e=>!onPath.has(e.id));
      if(!next.length || path.length>=FLOW_MAX_DEPTH){
        if(path.length) paths.push(path.slice());
        return;
      }
      for(const e of next){
        onPath.add(e.id); path.push(e); covered.add(e.id);
        walk(e.to);
        path.pop(); onPath.delete(e.id);
      }
    };
    walk(startId);
    if(paths.length) groups.push(paths);
  };
  // orígenes reales: nodos de los que sale algo y a los que no entra nada
  for(const n of P().nodes) if(out.has(n.id) && !hasIn.has(n.id)) expand(n.id);
  // lo que quede sin cubrir son ciclos cerrados: se arranca donde se pueda
  for(const e of edges) if(!covered.has(e.id)) expand(e.from);
  return groups;
}
/* cache: los caminos de un mismo grupo comparten el tramo inicial, así que sin
   esto la geometría de las primeras flechas se recalcula una vez por rama */
function pathGeometry(path, cache){
  const segs=[]; let total=0;
  for(const e of path){
    let pts=cache.get(e.id);
    if(!pts){ pts=edgePoints(e); cache.set(e.id, pts); }
    if(pts.length<2) continue;
    const L=polyLen(pts);
    if(L<=0) continue;
    segs.push({e, pts, L, start:total});
    total+=L;
  }
  return {segs, total};
}
function drawFlowBalls(c,t){
  if(!settings.single) return;
  let f=(t*settings.speed)%1; if(f<0) f+=1;
  const cache=new Map();
  for(const paths of flowGroups()){
    const geos=paths.map(pt=>pathGeometry(pt,cache)).filter(g=>g.total>0);
    if(!geos.length) continue;
    /* el ciclo lo marca el camino más largo del grupo: las ramas cortas llegan
       antes a su destino y se apagan ahí, en vez de frenar para cuadrar */
    const D=Math.max(...geos.map(g=>g.total));
    const d=f*D;
    const seen=new Set();
    for(const g of geos){
      if(d>g.total) continue;                    // esta rama ya llegó al final
      let seg=g.segs[g.segs.length-1];
      for(const s of g.segs){ if(d<=s.start+s.L){ seg=s; break; } }
      const p=pointAt(seg.pts, clamp((d-seg.start)/seg.L,0,1));
      /* dos caminos que aún comparten tramo dan el mismo punto: se dibuja una
         vez, si no el halo se sumaría consigo mismo y esa parte del recorrido
         se vería más brillante que el resto */
      const key=seg.e.id+"|"+Math.round(p.x)+","+Math.round(p.y);
      if(seen.has(key)) continue;
      seen.add(key);
      const A=nodeById(seg.e.from), B=nodeById(seg.e.to);
      /* la aparición gradual manda también aquí: una pelota sobre una flecha que
         todavía no se ve quedaría flotando en el vacío */
      const a=Math.min(nodeAlpha(A,t), nodeAlpha(B,t));
      if(a<=0) continue;
      // nace en el nodo de origen y se apaga al llegar al final de SU camino
      const fade=clamp(Math.min(d, g.total-d)/(D*.125), 0, 1);
      c.save();
      c.fillStyle=seg.e.dotColor||A.color||"#d08b5b";
      c.globalAlpha=a*fade;
      c.beginPath(); c.arc(p.x,p.y,7,0,Math.PI*2); c.fill();
      c.globalAlpha=a*fade*.28;
      c.beginPath(); c.arc(p.x,p.y,13,0,Math.PI*2); c.fill();
      c.restore();
    }
  }
}
function drawEdge(c,e,t,theme,isExport){
  const A=nodeById(e.from), B=nodeById(e.to); if(!A||!B) return;
  const a=Math.min(nodeAlpha(A,t),nodeAlpha(B,t)); if(a<=0) return;
  const pts=edgePoints(e); if(pts.length<2) return;
  const T=THEMES[theme];
  const seld=!isExport && selE.has(e.id);
  const single=!isExport && (()=>{ const s=singleSel(); return s && s.type==="edge" && s.obj && s.obj.id===e.id; })();
  c.save(); c.globalAlpha=a;
  const lineCol=e.lineColor||T.edge;
  c.strokeStyle=seld? "#3aa7e8":lineCol; c.lineWidth=seld?2.6:2;
  c.lineJoin="round";
  if(e.dashed) c.setLineDash([8,7]);
  c.beginPath(); c.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) c.lineTo(pts[i].x,pts[i].y);
  c.stroke(); c.setLineDash([]);
  const last=pts[pts.length-1], prev=pts[pts.length-2];
  if(e.endArrow!==false)
    arrowHead(c,last.x,last.y,Math.atan2(last.y-prev.y,last.x-prev.x), seld?"#3aa7e8":lineCol);
  if(e.startArrow){
    const f0=pts[0], f1=pts[1];
    arrowHead(c,f0.x,f0.y,Math.atan2(f0.y-f1.y,f0.x-f1.x), seld?"#3aa7e8":lineCol);
  }
  /* con la pelota única los puntos por flecha se apagan: si no, se verían las
     dos animaciones a la vez sobre la misma línea */
  if(e.animated && !settings.single){
    c.fillStyle=e.dotColor||A.color;
    const n=edgeDots(e);
    const sp=settings.speed*edgeSpeedFac(e);
    for(let i=0;i<n;i++){
      let base=(t*sp + i/n)%1; if(base<0)base+=1;
      let f=base;
      if(e.flowDir==="reverse") f=1-base;
      else if(e.flowDir==="alternate") f=1-Math.abs(1-2*base);
      const p=pointAt(pts,f);
      const fade=Math.min(1,Math.min(f,1-f)*8);
      c.globalAlpha=a*fade;
      c.beginPath(); c.arc(p.x,p.y,5,0,Math.PI*2); c.fill();
      c.globalAlpha=a*fade*.3;
      c.beginPath(); c.arc(p.x,p.y,9,0,Math.PI*2); c.fill();
      c.globalAlpha=a;
    }
  }
  if(e.label){
    const m=labelPointFor(e,pts);
    const efs=edgeLabelFs(e);
    c.font=objFont(e,efs); c.textAlign="center"; c.textBaseline="middle";
    const w=c.measureText(e.label).width;
    /* El fondo se dibuja también mientras se edita: es el respaldo que hace
       legible la etiqueta sobre la línea, y el textarea transparente lo necesita
       igual que el texto pintado. Lo que no se dibuja es el texto. */
    c.fillStyle=T.lblBg; c.fillRect(m.x-w/2-6,m.y-efs*.85,w+12,efs*1.7);
    if(editing!==e){ c.fillStyle=T.edgeLbl; c.fillText(e.label,m.x,m.y); }
  }
  if(single){
    c.lineWidth=1.6;
    (e.waypoints||[]).forEach(wp=>{
      c.fillStyle="#3aa7e8"; c.beginPath(); c.arc(wp.x,wp.y,6,0,Math.PI*2); c.fill();
      c.strokeStyle="#fff"; c.stroke();
    });
    /* Manejadores de EXTREMO, sobre el borde del nodo. Relleno = el extremo está
       fijado a un lado (fromSide/toSide con valor); hueco = conexión flotante,
       el motor elige el punto. La distinción es la que el usuario necesita para
       saber por qué una flecha se mueve sola al desplazar un nodo y otra no. */
    for(const [q,fijo] of [[pts[0], !!e.fromSide], [pts[pts.length-1], !!e.toSide]]){
      c.beginPath(); c.arc(q.x,q.y,6,0,Math.PI*2);
      c.fillStyle = fijo ? "#5ac47d" : (theme==="crema"?"#f4eee1":"#161616");
      c.fill();
      c.strokeStyle="#5ac47d"; c.lineWidth=2; c.stroke();
    }
    c.lineWidth=1.6;
    /* Un manejador por tramo que admita un codo. Los pasillos de aproximación
       de la ruta ortogonal no llevan: su punto medio flota a 14 px del borde,
       sin tocar nada. Ver bendableSegs() en js/geometry.js. */
    for(const i of bendableSegs(e,pts)){
      const mx=(pts[i].x+pts[i+1].x)/2, my=(pts[i].y+pts[i+1].y)/2;
      c.fillStyle=theme==="crema"?"#f4eee1":"#161616";
      c.strokeStyle="#3aa7e8";
      c.beginPath(); c.arc(mx,my,5,0,Math.PI*2); c.fill(); c.stroke();
    }
  }
  c.restore();
}
/* Vista previa de «suelta aquí», compartida por el arrastre que CREA una arista
   (connectDrag) y por el que mueve un extremo de una existente (endDrag): línea
   de puntos desde el ancla que no se mueve hasta el cursor, y el nodo bajo el
   cursor resaltado con sus cuatro puertos, relleno el que se va a usar.

   `excluirId` es el nodo que no puede ser destino: el origen al crear, y el otro
   extremo al mover — soltar ahí dejaría la arista saliendo y entrando en el
   mismo nodo. No resaltarlo es la mitad visual de esa guarda; la otra está en
   el pointerup de js/interaction.js. */
function drawDropPreview(c, theme, desde, excluirId){
  c.save();
  c.strokeStyle="#3aa7e8"; c.setLineDash([6,5]); c.lineWidth=2/viewZoom;
  c.beginPath(); c.moveTo(desde.x,desde.y); c.lineTo(mouse.x,mouse.y); c.stroke();
  c.setLineDash([]);
  if(hoverNode && hoverNode.id!==excluirId){
    c.strokeStyle="#3aa7e8"; c.lineWidth=2.5/viewZoom;
    c.strokeRect(hoverNode.x-hoverNode.w/2-4,hoverNode.y-hoverNode.h/2-4,hoverNode.w+8,hoverNode.h+8);
    const near=nearestAnchorSide(hoverNode,mouse,ANCHOR_SNAP);
    for(const s of SIDES){
      const q=sidePoint(hoverNode,s);
      c.beginPath(); c.arc(q.x,q.y,6/viewZoom,0,Math.PI*2);
      if(s===near){
        c.fillStyle="#3aa7e8"; c.fill();
        c.strokeStyle="#fff"; c.lineWidth=1.6/viewZoom; c.stroke();
      } else {
        c.fillStyle=theme==="crema"?"#f4eee1":"#161616"; c.fill();
        c.strokeStyle="#3aa7e8"; c.lineWidth=1.6/viewZoom; c.stroke();
      }
    }
  }
  c.restore();
}
function drawSideArrows(c,n){
  c.save();
  for(const s of SIDES){
    const p=sidePoint(n,s), d=DIR[s];
    const bx=p.x+d.x*ARROW_OFF, by=p.y+d.y*ARROW_OFF;
    const ang=Math.atan2(d.y,d.x);
    c.translate(bx,by); c.rotate(ang);
    c.fillStyle="rgba(58,167,232,.9)";
    c.beginPath();
    c.moveTo(10,0); c.lineTo(-4,-9); c.lineTo(-4,-3.5); c.lineTo(-12,-3.5);
    c.lineTo(-12,3.5); c.lineTo(-4,3.5); c.lineTo(-4,9); c.closePath(); c.fill();
    c.rotate(-ang); c.translate(-bx,-by);
  }
  c.restore();
}
function resizeCanvas(){
  const r=$("wrap").getBoundingClientRect();
  if(cv.width!==Math.round(r.width) || cv.height!==Math.round(r.height)){
    cv.width=Math.round(r.width); cv.height=Math.round(r.height);
  }
}

function render(c,t,opts={}){
  const theme=doc.theme, T=THEMES[theme];
  const isExport=!!opts.export;

  if(isExport){
    const b = opts.bounds || getBounds();
    c.clearRect(b.x, b.y, b.w, b.h);
    if(opts.bg){ c.fillStyle=opts.bg; c.fillRect(b.x, b.y, b.w, b.h); }
    else if(!opts.transparent){ c.fillStyle=doc.customBg||T.bg; c.fillRect(b.x, b.y, b.w, b.h); }
    if(settings.grid){
      c.strokeStyle=T.grid; c.lineWidth=1; c.beginPath();
      const startX = Math.floor(b.x/GRID)*GRID;
      const startY = Math.floor(b.y/GRID)*GRID;
      for(let x=startX; x<b.x+b.w; x+=GRID){c.moveTo(x,b.y);c.lineTo(x,b.y+b.h);}
      for(let y=startY; y<b.y+b.h; y+=GRID){c.moveTo(b.x,y);c.lineTo(b.x+b.w,y);}
      c.stroke();
    }
    edgeLabelPos=placeEdgeLabels(measureCanvasLabel(c));
    for(const e of P().edges) drawEdge(c,e,t,theme,isExport);
    drawFlowBalls(c,t);
    for(const n of P().nodes) drawNode(c,n,t,theme,isExport);
    return;
  }

  resizeCanvas();
  c.clearRect(0,0,cv.width,cv.height);

  c.save();
  c.translate(viewX, viewY);
  c.scale(viewZoom, viewZoom);

  const wx = -viewX / viewZoom;
  const wy = -viewY / viewZoom;
  const ww = cv.width / viewZoom;
  const wh = cv.height / viewZoom;

  c.fillStyle = doc.customBg||T.bg; c.fillRect(wx, wy, ww, wh);

  if(settings.grid){
    c.strokeStyle=T.grid; c.lineWidth=1/viewZoom; c.beginPath();
    const sx = Math.floor(wx/GRID)*GRID;
    const sy = Math.floor(wy/GRID)*GRID;
    for(let x=sx; x<wx+ww+GRID; x+=GRID){c.moveTo(x,wy); c.lineTo(x,wy+wh);}
    for(let y=sy; y<wy+wh+GRID; y+=GRID){c.moveTo(wx,y); c.lineTo(wx+ww,y);}
    c.stroke();
  }

  /* refreshEdgeLabels y no una asignación directa: mientras se arrastra un
     extremo el mapa está congelado. Ver js/geometry.js. */
  refreshEdgeLabels(measureCanvasLabel(c));
  for(const e of P().edges) drawEdge(c,e,t,theme,isExport);
  drawFlowBalls(c,t);
  for(const n of P().nodes) drawNode(c,n,t,theme,isExport);

  if(!presenting && mode==="select" && !drag && !resizing && !wpDrag && !connectDrag && !endDrag && !marquee && !pendingShape && !pendingIcon && !pendingAnim){
    const host=arrowHostNode();
    if(host) drawSideArrows(c,host);
  }
  if(connectDrag){
    const A=nodeById(connectDrag.fromId);
    if(A) drawDropPreview(c, theme, sidePoint(A,connectDrag.fromSide), A.id);
  }
  /* Arrastrando un extremo: la línea de puntos sale del extremo que NO se mueve,
     y el nodo excluido es el del otro extremo — soltar ahí sería un auto-lazo. */
  if(endDrag){
    const e=edgeById(endDrag.edgeId);
    if(e){
      const pts=edgePoints(e);
      if(pts.length>=2){
        const quieto = endDrag.which==="from" ? pts[pts.length-1] : pts[0];
        drawDropPreview(c, theme, quieto, endDrag.which==="from" ? e.to : e.from);
      }
    }
  }
  if(connecting!==null){
    const A=nodeById(connecting);
    if(A){ c.save(); c.strokeStyle="#3aa7e8"; c.setLineDash([5,5]); c.lineWidth=2/viewZoom;
      c.beginPath(); c.moveTo(A.x,A.y); c.lineTo(mouse.x,mouse.y); c.stroke(); c.restore(); }
  }
  if(marquee){
    const r=normRect(marquee);
    c.save();
    c.fillStyle="rgba(58,167,232,.12)";
    c.strokeStyle="#3aa7e8"; c.lineWidth=1/viewZoom;
    c.fillRect(r.x,r.y,r.w,r.h); c.strokeRect(r.x,r.y,r.w,r.h);
    c.restore();
  }
  if(P().nodes.length===0 && !presenting){
    c.fillStyle=theme==="crema"?"#00000055":"#ffffff44";
    c.font=(20/viewZoom)+"px Georgia, serif"; c.textAlign="center";
    c.fillText("Elige una forma o icono a la izquierda y haz clic aquí — o pulsa «Ejemplo»", (cv.width/2 - viewX) / viewZoom, (cv.height/2 - viewY) / viewZoom);
  }

  c.restore();
}
function now(){ return playing? (performance.now()-t0)/1000 : pausedAt; }
/* pedir el siguiente fotograma ANTES de dibujar: si un fotograma falla, el error
   sale por consola pero el bucle sigue vivo, en vez de dejar el lienzo en negro
   para siempre por un único fallo. */
(function loop(){
  requestAnimationFrame(loop);
  render(ctx,now());
  /* El textarea de edición in-situ vive en el DOM, fuera del lienzo, así que no
     lo mueve el zoom ni el paneo. Se recoloca aquí, después de dibujar, y solo
     cuando algo de lo que depende ha cambiado. */
  if(typeof syncEditBoxIfMoved==="function") syncEditBoxIfMoved();
})();
