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
/* ===================== Puertos compartidos =====================
   Cuando dos aristas fijan el mismo lado de un nodo con fromSide/toSide,
   sidePoint les devuelve EL MISMO PUNTO. Si una entra y la otra sale, el flujo
   parece darse la vuelta sobre sí mismo: en oauth2, «4. code → token» sube por
   x=1560 hasta el hex y «5. Bearer» baja por esa misma x — 147px dibujados uno
   encima del otro, que se leen como una sola línea con dos puntas de flecha.

   Se reparten a lo largo del lado, con el mismo mecanismo que los carriles de un
   par paralelo. Tres condiciones, y las tres hacen falta:

   · Las anclas COINCIDEN. Si autoAnchor ya las separó no hay nada que arreglar,
     y moverlas solo empeoraría lo que ya estaba bien.

   · El lado lleva tráfico en los DOS sentidos. Un abanico de tres aristas que
     salen del mismo punto —kafka-event-pipeline— se lee como un bus que se
     bifurca, y separarlo solo añade ruido; medido, comparten 171px y están
     perfectas. Lo que confunde no es compartir tramo, es que el flujo vuelva
     sobre sus pasos: los tramos compartidos en sentido opuesto son 3 en todo el
     corpus, y los 11 en el mismo sentido están todos en diagramas que se ven
     bien.

   · Ninguna es de un par paralelo, que ya tiene su propio reparto y lo aplica a
     los dos extremos más el canal central. Aplicar los dos sería desplazar dos
     veces.

   Sobre los 7 documentos del corpus esto reparte exactamente un grupo: el de
   oauth2. Los tres diagramas que ya estaban bien no lo activan por construcción.

   Lo que NO arregla: los otros dos tramos compartidos en sentido opuesto
   (microservicios 154px, serverless 108px) no vienen de un ancla común sino de
   que los nodos están alineados en la misma columna, así que sus tramos largos
   coinciden sin compartir punto. Eso pide mover un tramo a otro canal, que es
   ruteo con evasión y no está aquí. */
function baseAnchors(e){
  const A=nodeById(e.from), B=nodeById(e.to);
  if(!A||!B) return null;
  const wps=e.waypoints||[];
  const tA=wps[0]||{x:B.x,y:B.y}, tB=wps[wps.length-1]||{x:A.x,y:A.y};
  const p1=anchorPt(A,e.fromSide,tA.x,tA.y);
  const p2=anchorPt(B,e.toSide,tB.x,tB.y);
  return {p1, p2, s1:e.fromSide||inferSide(A,p1), s2:e.toSide||inferSide(B,p2)};
}
function portKey(nodeId,side,p){ return nodeId+":"+side+":"+Math.round(p.x)+","+Math.round(p.y); }
/* Cuántas aristas unen el mismo par que `e`. Comparación de enteros y sin
   construir claves: esto corre dentro del bucle de render. */
function siblingCount(e){
  let n=0;
  for(const o of P().edges){
    if((o.waypoints||[]).length) continue;
    if((o.from===e.from&&o.to===e.to)||(o.from===e.to&&o.to===e.from)) n++;
  }
  return n;
}
/* `which` es "from" o "to": el reparto es por extremo, no por arista, porque una
   arista puede compartir puerto en un lado y no en el otro.

   El orden de los filtros importa para el coste. Esto se ejecuta por arista y
   por extremo dentro del bucle de render, así que primero se descarta con
   comparaciones de enteros —solo las aristas que TOCAN este nodo pueden
   compartir puerto con él— y la geometría, que es lo caro, se calcula únicamente
   para esas. Sin ese orden, una página de 90 aristas se comía el 75 % del
   presupuesto de fotograma. */
function portLane(e,which){
  const none={off:0, half:0};
  if((e.waypoints||[]).length) return none;
  const nodeId = which==="from"? e.from : e.to;
  const vecinas=[];
  for(const o of P().edges){
    if(o.from!==nodeId && o.to!==nodeId) continue;
    if((o.waypoints||[]).length) continue;
    vecinas.push(o);
  }
  if(vecinas.length<2) return none;
  if(siblingCount(e)>1) return none;
  const me=baseAnchors(e); if(!me) return none;
  const key = portKey(nodeId, which==="from"? me.s1 : me.s2, which==="from"? me.p1 : me.p2);
  const grupo=[];
  for(const o of vecinas){
    if(siblingCount(o)>1) continue;
    const b=baseAnchors(o); if(!b) continue;
    if(o.from===nodeId && portKey(nodeId,b.s1,b.p1)===key) grupo.push({id:o.id, sent:"sale"});
    if(o.to===nodeId   && portKey(nodeId,b.s2,b.p2)===key) grupo.push({id:o.id, sent:"entra"});
  }
  if(grupo.length<2) return none;
  if(!(grupo.some(x=>x.sent==="entra") && grupo.some(x=>x.sent==="sale"))) return none;
  const yo = which==="from"? "sale" : "entra";
  const i = grupo.findIndex(x=>x.id===e.id && x.sent===yo);
  if(i<0) return none;
  return {off:(i-(grupo.length-1)/2)*PARALLEL_SEP, half:(grupo.length-1)/2*PARALLEL_SEP};
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
/* ===================== Llegar por el lado contrario =====================
   El pasillo de aproximación de `pad` px delante de cada extremo es correcto y
   no se toca: es lo que hace que la flecha entre perpendicular al borde.

   Lo que estaba mal era el CONECTOR entre los dos puntos de pasillo. Se elegía
   con una tabla fija de cuatro casos que nunca miraba por dónde pasaba. Cuando
   el otro nodo queda del lado contrario al lado anclado, el codo caía dentro del
   nodo: la ruta lo atravesaba, se pasaba `pad` px de largo y volvía al borde.
   Como los nodos nacen con fill:null —semitransparente— se veía el trazo por
   dentro y un muñón de 28 px asomando por fuera. Medido antes de arreglarlo:

     · 16 de las 25 combinaciones de fromSide × toSide en un par de cajas
     · 3 aristas del corpus publicado (serverless e16, microservicios e20 y e21)
     · 10 aristas de ese mismo corpus recolocado con el auto-layout

   Y en la capa de manejadores se veía como otra cosa: el tramo que vuelve sobre
   sí mismo deja su manejador de codo a 17 px del manejador de extremo, con
   radios de acierto de 9 cada uno. Dos objetivos que se pisan sobre el borde.

   Entre dos puntos siempre hay DOS maneras de doblar en ortogonal, y casi
   siempre una de las dos está limpia: el arreglo no es rodear el nodo con
   vértices nuevos, es doblar antes en vez de después. Las tres aristas del
   corpus se arreglan sin ganar un solo vértice.

   La cláusula que protege lo demás es la salida temprana: si la ruta de hoy no
   entra en ninguna de las dos cajas de anclaje, se devuelve TAL CUAL y no se
   evalúa ningún candidato. Una arista sana no puede cambiar ni un píxel por
   esto. Medido: de las 54 aristas del corpus cambian 3, y son las 3 defectuosas.

   Se mide contra anchorBox() y no contra la caja del nodo. Con la caja completa
   el mismo medidor da 26 casos, de los que 24 son falsos positivos: en un nodo
   `icon` la caja de anclaje es más estrecha que el nodo y el extremo cae
   legítimamente dentro de la grande. */
const OBST_TOL=1.5;   // roce del borde que no cuenta como entrar
const OBST_MIN=4;     // px dentro de la caja para considerarlo un defecto
function obstBox(n){
  const a=anchorBox(n);
  return {x0:a.x-a.w/2, x1:a.x+a.w/2, y0:a.y-a.h/2, y1:a.y+a.h/2};
}
/* Longitud del tramo que cae dentro de la caja, por recorte exacto
   (Liang-Barsky) y no por muestreo.
   Tiene que valer para tramos NO ortogonales: el dedup de más abajo descarta
   puntos a ≤1px, así que cuando dos anclas de nodos distintos difieren en 1px
   queda un tramo con 1px de inclinación. Un test que solo mirase tramos
   exactamente ortogonales daría ese caso por bueno —pasó, con microservicios
   e20 recolocado— y el defecto se colaría. */
function segInBox(a,b,B){
  const x0=B.x0+OBST_TOL, x1=B.x1-OBST_TOL, y0=B.y0+OBST_TOL, y1=B.y1-OBST_TOL;
  if(x1<=x0 || y1<=y0) return 0;
  const dx=b.x-a.x, dy=b.y-a.y;
  let t0=0, t1=1;
  const lados=[[-dx, a.x-x0],[dx, x1-a.x],[-dy, a.y-y0],[dy, y1-a.y]];
  for(const [p,q] of lados){
    if(p===0){ if(q<0) return 0; continue; }   // paralelo al lado y fuera
    const r=q/p;
    if(p<0){ if(r>t1) return 0; if(r>t0) t0=r; }
    else   { if(r<t0) return 0; if(r<t1) t1=r; }
  }
  return Math.max(0,t1-t0)*Math.hypot(dx,dy);
}
function pathInBoxes(pts,cajas){
  let L=0;
  for(let i=1;i<pts.length;i++) for(const b of cajas) L+=segInBox(pts[i-1],pts[i],b);
  return L;
}
function pathLen(pts){
  let L=0;
  for(let i=1;i<pts.length;i++) L+=Math.abs(pts[i].x-pts[i-1].x)+Math.abs(pts[i].y-pts[i-1].y);
  return L;
}
function orthoRoute(p1,d1,p2,d2,off,A,B){
  const pad=28;
  const s={x:p1.x+d1.x*pad, y:p1.y+d1.y*pad};
  const t={x:p2.x+d2.x*pad, y:p2.y+d2.y*pad};
  const armar=(mids)=>{
    const raw=[p1,s,...mids,t,p2], out=[raw[0]];
    for(let i=1;i<raw.length;i++){
      const a=out[out.length-1], b=raw[i];
      if(Math.hypot(a.x-b.x,a.y-b.y)>1) out.push(b);
    }
    return out;
  };
  /* Un canal vertical en x=c, o uno horizontal en y=c. Los dos degeneran en el
     codo simple cuando c coincide con s o con t, así que esta pareja de
     funciones cubre las cuatro formas de la tabla de antes. */
  const zx=(c)=>[{x:c,y:s.y},{x:c,y:t.y}];
  const zy=(c)=>[{x:s.x,y:c},{x:t.x,y:c}];
  let mids;
  /* el tramo central también se aparta: separar solo las anclas dejaría las dos
     rutas compartiendo el canal largo del medio, que es donde va la etiqueta */
  if(d1.x!==0 && d2.x!==0){ mids=zx((s.x+t.x)/2+(off||0)); }
  else if(d1.y!==0 && d2.y!==0){ mids=zy((s.y+t.y)/2+(off||0)); }
  else if(d1.x!==0){ mids=[{x:t.x,y:s.y}]; }
  else { mids=[{x:s.x,y:t.y}]; }
  const actual=armar(mids);
  if(!A || !B) return actual;
  const cajas=[obstBox(A), obstBox(B)];
  let mejorPen=pathInBoxes(actual,cajas);
  if(mejorPen<OBST_MIN) return actual;          // la ruta de hoy está limpia: no se toca
  let mejor=actual, mejorCod=actual.length, mejorLar=pathLen(actual);
  const o=off||0;
  /* EL ORDEN DE ESTA LISTA ES NORMATIVO, no estético. Los canales pegados a una
     caja van ANTES que el canal del punto medio, y los empates los gana el
     primero. Con el orden inverso, `estáticos` de arquitectura-serverless-aws
     recolocado empata en penetración y en codos, se lleva el canal medio y
     comparte 74 px de trazo en sentido opuesto con `/api/*`: un hallazgo E
     nuevo, cambiar un defecto por otro. Con los canales pegados delante el
     corpus entero sale sin un solo hallazgo nuevo. Quien reordene esto tiene que
     volver a medir los chequeos A-F sobre los 8 documentos, guardados Y
     recolocados con layeredLayout. */
  const cx=[s.x, t.x], cy=[s.y, t.y];
  for(const b of cajas){
    cx.push(b.x0-pad+o, b.x1+pad+o);
    cy.push(b.y0-pad+o, b.y1+pad+o);
  }
  cx.push((s.x+t.x)/2+o); cy.push((s.y+t.y)/2+o);
  /* El `off` del carril paralelo viaja con el canal elegido, igual que viajaba
     con el canal medio: dos hermanas de un par paralelo tienen que seguir
     separadas aunque las dos acaben aquí. */
  const probar=(cand)=>{
    const pen=pathInBoxes(cand,cajas), cod=cand.length, lar=pathLen(cand);
    if(pen<mejorPen-0.01 || (pen<mejorPen+0.01 && (cod<mejorCod || (cod===mejorCod && lar<mejorLar-0.01)))){
      mejor=cand; mejorPen=pen; mejorCod=cod; mejorLar=lar;
    }
  };
  for(const c of cx) probar(armar(zx(c)));
  for(const c of cy) probar(armar(zy(c)));
  return mejor;
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
  else{
    /* el reparto por puerto es por extremo y no toca el canal central: en el
       caso ortogonal el canal ya sale de las anclas, así que se mueve solo */
    const o1=portLane(e,"from"), o2=portLane(e,"to");
    if(o1.off) p1=slideAnchor(A,s1,p1,o1.off,o1.half);
    if(o2.off) p2=slideAnchor(B,s2,p2,o2.off,o2.half);
  }
  if(e.route==="ortho" && wps.length===0){
    return orthoRoute(p1,DIR[s1],p2,DIR[s2],off,A,B);
  }
  return [p1,...wps,p2];
}
/* ===================== Tramos que admiten un codo =====================
   El manejador de «doblar aquí» va en el punto medio de un tramo, y hasta ahora
   se ponía en TODOS. En una ruta ortogonal los tramos primero y último no son
   tramos de verdad: son el pasillo de aproximación de `pad` px que añade
   orthoRoute() para que la flecha entre perpendicular al borde. Su punto medio
   cae a pad/2 = 14 px por fuera del nodo, sin tocar ningún borde.

   Eso producía tres efectos, todos malos:

   · un manejador flotando en el vacío junto a cada extremo, que no corresponde a
     nada que el usuario haya puesto ni pueda razonar;
   · agarrarlo materializaba la ruta entera en waypoints explícitos y le insertaba
     uno más, con lo que la arista perdía el auto-ruteo para siempre;
   · ocupaba la franja de 0-28 px por fuera del borde, que es donde tienen que
     vivir los manejadores de extremo y donde ya estaban las flechas de conexión.
     Medido: entre 6 y 22 px del borde ganaba el manejador de pasillo, porque
     hitMidpoint se prueba antes que hitSideArrow.

   Solo se excluyen cuando la ruta la calculó orthoRoute, que es el único caso en
   que existen pasillos. Una arista recta tiene un único tramo y su punto medio es
   el manejador útil; una con waypoints ya no pasa por orthoRoute y todos sus
   tramos los puso alguien a mano.

   Devuelve índices de TRAMO: el tramo i va de pts[i] a pts[i+1]. Es el mismo
   índice que espera waypoints.splice() al insertar un codo ahí. */
function bendableSegs(e,pts){
  const n=pts.length-1;                       // nº de tramos
  const todos=()=>Array.from({length:Math.max(0,n)},(_,i)=>i);
  if(n<=0) return [];
  const pasillos = e.route==="ortho" && !(e.waypoints||[]).length;
  /* Con dos tramos o menos, quitar los dos extremos no deja ninguno. Antes que
     dejar la arista sin forma de doblarse, se devuelven todos. */
  if(!pasillos || n<=2) return todos();
  const out=[]; for(let i=1;i<=n-2;i++) out.push(i);
  return out;
}
/* ===================== Bloques de código =====================
   Toda la maquetación de un nodo `code` sale de aquí, y sale como DATOS: nada de
   dibujar. Los tres renderers —lienzo, exportador SVG de la app y svg.ts del
   MCP— consumen la misma estructura, así que el test de paridad puede compararla
   entera en vez de comparar píxeles.

   No se mide texto en ningún punto. El carácter k de una línea está en
   x0 + k*adv, con adv = fs*CODE_ADV, así que la posición y el ancho de cada
   token son aritmética sobre índices de carácter. Ver la nota de CODE_ADV en
   config.js: la rejilla es normativa y el texto se obliga a ella. */
function codeKeywords(n){
  if(Array.isArray(n.keywords) && n.keywords.length) return n.keywords;
  return CODE_LANGS[n.lang||DEFAULT_LANG] || CODE_LANGS[DEFAULT_LANG];
}
/* Los espacios no se emiten: la rejilla ya los deja implícitos. Además un <text>
   con solo espacios se colapsa a ancho cero en SVG, así que emitirlos sería
   pedirle al renderer algo que no puede cumplir.

   La división es por espacios, como en el fork: `.map(parse)` es UN token, así
   que una palabra clave solo resalta cuando aparece suelta. Partir también por
   signos de puntuación resaltaría dentro de las llamadas, pero cambia el
   comportamiento del original y no se ha pedido.

   Nota sobre tokens de UN carácter en SVG: `lengthAdjust="spacing"` reparte la
   diferencia ENTRE caracteres, y con uno solo no hay hueco que repartir, así que
   el glifo conserva su avance natural (medido: 0.9px de menos con Consolas a
   18px). No se acumula —la x de cada token es absoluta— y el rectángulo sí va a
   la medida de la rejilla. Usar `spacingAndGlyphs` lo cuadraría deformando los
   glifos, que es peor. */
function codeTokens(line){
  const out=[]; let k=0;
  for(const t of line.split(/(\s+)/)){ if(t && t.trim()) out.push({t,k}); k+=t.length; }
  return out;
}
function codeBlockLayout(n){
  const lines=String(n.label==null?"":n.label).split("\n");
  const pad=12, inset=10;
  const bw=Math.max(1, n.w-pad*2);
  const maxChars=Math.max(1, ...lines.map(l=>l.length));
  /* El tamaño lo limitan las DOS dimensiones. El fork solo miraba el alto, así
     que una línea larga se salía de la caja; con la rejilla el ancho que hace
     falta se sabe sin medir: maxChars*adv. */
  const porAlto=(n.h-pad*2)/lines.length-4;
  const porAncho=(bw-inset*2)/(maxChars*CODE_ADV);
  const fs=n.fs || clamp(Math.min(porAlto,porAncho), 9, 18);
  const adv=fs*CODE_ADV, lh=fs+6;
  const blockH=lines.length*lh+8;
  const bx=n.x-n.w/2+pad, by=n.y-n.h/2+(n.h-blockH)/2, x0=bx+inset;
  const kws=new Set(codeKeywords(n).map(w=>String(w).toUpperCase()));
  const rows=lines.map((ln,i)=>({
    ly: by+8+i*lh+lh/2-3,
    tokens: codeTokens(ln).map(({t,k})=>({
      t, k, kw:kws.has(t.toUpperCase()), x:x0+k*adv, w:t.length*adv
    })),
  }));
  return {lines, fs, adv, lh, blockH, bx, by, bw, x0, rows};
}
/* Los cinco colores, con el tema como respaldo de cada uno. */
function codeColors(n,theme){
  const T=THEMES[theme];
  return {
    panel: n.fill && n.fill!=="none" ? n.fill : (T.lblBg||"#161616"),
    paper: n.textBg || T.codeBg,
    text:  n.textColor || T.codeText,
    kwBg:  n.kwBg || T.codeKwBg,
    kwText:n.kwColor || T.codeKwText,
  };
}
function codeFont(n){ return n.font || FONTS[FONTS.length-1].f; }

/* ===================== Escalado y maquetación de la etiqueta =====================
   UNA regla para todas las formas con texto, y es la MISMA que ya usaba `code`:
   el tamaño de fuente sale de las DOS dimensiones de la caja. Antes solo salía
   del ancho, y solo hacia abajo —encogía si no cabía, nunca crecía—, así que al
   agrandar un nodo el texto se quedaba perdido y al bajarlo se salía por arriba
   y por abajo sin que nada lo notara.

   Tres límites, y manda el menor:

     · ESCALA DE CAJA — cuánto se ha redimensionado el nodo respecto al tamaño
       con el que nace su forma: min(w/w0, h/h0). Es lo que hace que la fuente
       acompañe a la esquina que arrastras.
     · ANCHO — la línea más larga tiene que caber en n.w-18.
     · ALTO  — todas las líneas juntas tienen que caber en su franja.

   Que la escala sea RELATIVA al tamaño por defecto, y no un ajuste al ancho
   disponible, es la decisión que hace esto retrocompatible: un nodo que nadie ha
   tocado da factor 1 y sale idéntico. Medido sobre los 5 ejemplos oficiales: 37
   de 43 etiquetas no se mueven, y de las 6 que crecen ninguna pasa de x1.25.
   Ajustar al ancho a secas —la otra lectura de «la fuente crece con la caja»—
   cambiaba 34 de 48 con factores de hasta x3.85. Ver INFORME-TEXTO.md §5.

   `n.fs` sigue siendo la salida manual: si está puesto, aquí no se calcula nada.

   Por qué esto vive en geometry.js y no en cada renderer: lo consumen CUATRO
   sitios —el lienzo, el exportador SVG de la app, svg.ts del MCP y el editor
   in-situ—, y el editor tiene que colocar el textarea exactamente encima del
   texto. Con la maquetación duplicada, el textarea se descuadra en cuanto
   alguien toca una constante en uno solo de los sitios. Es el mismo motivo por
   el que codeBlockLayout() devuelve datos en vez de dibujar. */
const LABEL_LH=1.25;      // interlineado, en múltiplos del tamaño de fuente
const LABEL_PAD_X=18;     // aire horizontal total dentro de la caja
const LABEL_MIN_FS=10;

/* Tamaño base y línea central por forma. Estaban sueltos en cada llamada de
   drawNode()/renderNodeToSVG(); están aquí porque ahora los necesita también el
   editor, y dos copias es exactamente como se descuadra el textarea. */
function labelBaseFs(n){
  if(n.shape==="text") return 22;
  if(n.shape==="icon"||n.shape==="anim"||n.shape==="image") return 14;
  return 17;
}
function labelCenterY(n){
  switch(n.shape){
    case "image": return n.y+n.h/2+14;
    case "icon":  return n.y+n.h/2-10;
    case "anim":  return n.y+n.h/2-8;
    case "cylinder": return n.y+6;
    default: return n.y;
  }
}
function labelBoxScale(n){
  const d=DEFAULT_SIZES[n.shape];
  if(!d || !(d[0]>0) || !(d[1]>0)) return 1;
  return Math.min(n.w/d[0], n.h/d[1]);
}
/* Franja vertical de la que dispone el texto. En las formas con caja es la caja
   entera. En icon/anim/image la etiqueta vive FUERA del dibujo, en la banda de
   abajo —los mismos 26 px que drawNode() le resta al glifo—, así que dejarla
   crecer hasta el alto del nodo sería dejar que se comiera el icono. */
function labelBandH(n){
  if(n.shape==="icon"||n.shape==="anim") return 26;
  if(n.shape==="image") return 28;
  return n.h;
}
/* `measure(fs)` devuelve el ancho de la línea más larga a ese tamaño. Lo inyecta
   quien llama porque medir se hace distinto en el lienzo (measureText), en el SVG
   de la app (getBBox) y en el MCP (heurística por anchos de carácter). */
function labelFontSize(n, measure){
  if(n.fs) return n.fs;
  const nLines=String(n.label==null?"":n.label).split("\n").length;
  let fs=labelBaseFs(n)*labelBoxScale(n);
  const avail=n.w-LABEL_PAD_X;
  if(avail>0){
    const maxW=Math.max(measure(fs),1);
    if(maxW>avail) fs=fs*avail/maxW;
  }
  const porAlto=labelBandH(n)/(nLines*LABEL_LH);
  if(fs>porAlto) fs=porAlto;
  return Math.max(LABEL_MIN_FS, fs);
}
/* Las etiquetas de arista no tienen caja de la que derivar un tamaño, así que no
   escalan: flotan sobre la línea. La constante estaba escrita tres veces —lienzo,
   exportador y svg.ts— y ahora que el editor in-situ también la necesita, cuatro
   copias del mismo 13 era pedir que se descuadren. */
function edgeLabelFs(e){ return e.fs||13; }
/* Maquetación completa, como DATOS. Los tres renderers dibujan a partir de esto
   y el editor in-situ coloca el textarea a partir de esto mismo. */
function labelLayout(n, measure){
  const lines=String(n.label==null?"":n.label).split("\n");
  const fs=labelFontSize(n, measure), lh=fs*LABEL_LH;
  const pos=n.lblPos||"center";
  const inset=Math.min(14, n.w*.12, n.h*.18);
  let tx=n.x, align="center";
  if(pos==="left"){ tx=n.x-n.w/2+inset; align="left"; }
  else if(pos==="right"){ tx=n.x+n.w/2-inset; align="right"; }
  let baseY;
  if(pos==="top") baseY=n.y-n.h/2+inset+fs*.7;
  else if(pos==="bottom") baseY=n.y+n.h/2-inset-(lines.length-1)*lh-fs*.1;
  else baseY=labelCenterY(n)-(lines.length-1)*lh/2;
  /* Caja que ocupa el texto en coordenadas de mundo. Es lo que el editor usa para
     colocar el textarea: mismo ancho útil que el que limita la fuente, y el borde
     superior de la PRIMERA línea, no su centro —el lienzo escribe con
     textBaseline="middle" y un textarea alinea por arriba. */
  const boxW=Math.max(1, n.w-LABEL_PAD_X);
  let boxX;
  if(align==="left") boxX=tx;
  else if(align==="right") boxX=tx-boxW;
  else boxX=n.x-boxW/2;
  return {lines, fs, lh, tx, align, baseY, pos,
          boxX, boxY:baseY-lh/2, boxW, boxH:lines.length*lh};
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
/* ===================== Congelación de la colocación =====================
   placeEdgeLabels() es acumulativo: cada etiqueta esquiva a las YA colocadas,
   así que mover una arista puede reubicar la suya y la de todas las que vengan
   detrás. Recalculado a 60 fps mientras se arrastra un extremo, eso son
   etiquetas saltando por el lienzo en cada fotograma.

   Durante el arrastre se congela el mapa y se recalcula una sola vez al soltar.
   Es el mismo criterio que syncEditBoxIfMoved() en js/interaction.js, que no
   reescribe la geometría del textarea sesenta veces por segundo para nada.

   Solo afecta al lienzo interactivo: el exportador asigna edgeLabelPos por su
   cuenta y siempre recalcula, que es lo correcto — un export nunca ocurre a
   mitad de un gesto. */
let edgeLabelsFrozen=false;
function freezeEdgeLabels(){ edgeLabelsFrozen=true; }
function thawEdgeLabels(){ edgeLabelsFrozen=false; }
function refreshEdgeLabels(measure){
  if(!edgeLabelsFrozen) edgeLabelPos=placeEdgeLabels(measure);
  return edgeLabelPos;
}
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
