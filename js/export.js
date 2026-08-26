"use strict";
/* Guardar/abrir, restauración de sesión, ejemplo y exportación (PNG/JPG/GIF/SVG) */

/* ===================== Guardar / abrir ===================== */
function saveJSON(){
  const blob=new Blob([JSON.stringify(serializeProject(),null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="diagrama.fluyo.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}
$("btnJsonOut").onclick=saveJSON;
$("btnJsonIn").onclick=()=>$("fileIn").click();
/* Abrir un archivo NO pasa por el prompt de conflicto: quien pulsa «Abrir» y
   elige un archivo en su disco ya ha dicho, con dos gestos deliberados, qué
   quiere ver. El prompt es para lo que llega solo por una URL. */
$("fileIn").onchange=ev=>{
  const f=ev.target.files[0]; if(!f) return;
  f.text().then(txt=>{
    try{
      applyProjectData(JSON.parse(txt));
      centerView();
      saveAutosave(true);
      trackEvent("file_imported");   // dentro del try: un archivo inválido no cuenta
    }catch(e){ alert("El archivo no es un diagrama Fluyo válido."); }
  });
  ev.target.value="";
};
$("autosaveRestore").onclick=()=>{
  try{
    if(restoreAutosaveSession()) closeRestorePrompt();
    else{ clearAutosave(); closeRestorePrompt(); }
  }catch(e){
    clearAutosave();
    closeRestorePrompt();
    alert("No se pudo restaurar la sesión guardada.");
  }
};
$("autosaveDiscard").onclick=()=>{
  clearAutosave();
  closeRestorePrompt();
};

/* Las tres salidas del conflicto «la URL trae un diagrama y aquí ya había una
   sesión». La lógica está en state.js, junto al autoguardado que manipula. */
$("incomingPage").onclick=incomingAsNewPage;
$("incomingOpen").onclick=incomingOpen;
$("incomingKeep").onclick=incomingKeepMine;

/* ===================== Ejemplo ===================== */
/* ===================== El botón «Ejemplo» =====================
   Es la única muestra que ve quien aterriza en la portada, y el 94 % del tráfico
   aterriza ahí: la galería de /ejemplos vive detrás de un enlace en el pie.

   Por eso carga un FUNNEL DE VENTAS y no una arquitectura. Antes cargaba un
   pipeline de pagos con Kafka —el artefacto más técnico de todo el producto—
   detrás del único botón que alguien con curiosidad pulsa en los primeros diez
   segundos. Alguien que quiere diagramar un proceso de negocio veía eso y
   concluía, con razón, que la herramienta no era para él.

   No le quita nada a los técnicos: este diagrama estaba cableado aquí, no es
   ninguno de los ocho de la galería y no se puede enlazar. Sustituirlo no retira
   nada del catálogo.

   Se mantiene cableado en vez de hacer fetch del JSON a propósito: así el botón
   funciona en la primera carga sin red, sin depender de que el service worker ya
   haya precacheado el archivo.

   Y se mantiene el slug "demo" en el evento para no partir la serie histórica.

   Enciende `build`: la aparición escalonada es lo que hace que un funnel se lea
   como un proceso y no como un dibujo, y es el diferenciador del producto. Es lo
   mismo que traen los tres ejemplos de negocio en sus `settings`. */
$("btnDemo").onclick=()=>{
  pushUndo();
  const pg=P(); pg.nodes=[]; pg.edges=[]; pg.nextId=1; clearSel();
  const T=newNode("text",1180,300,{label:"Funnel de ventas"}); T.color="#d08b5b"; T.w=620; T.order=0;
  const A=newNode("icon",460,580,{icon:"users",label:"Visitantes"}); A.color="#6a9fb5"; A.order=1;
  const B=newNode("rect",790,580);  B.label="Lead\nregistrado";  B.color="#6a9fb5"; B.order=2;
  const C=newNode("diamond",1120,580); C.label="¿Califica?";     C.color="#c9b458"; C.order=3;
  const D=newNode("rect",1480,580); D.label="Oportunidad";       D.color="#9b7fb5"; D.order=4;
  const E2=newNode("rect",1810,580);E2.label="Propuesta\nenviada";E2.color="#9b7fb5";E2.order=5;
  const F=newNode("circle",2130,580); F.label="Cliente";         F.color="#7bb85b"; F.pulse=true; F.order=6;
  const G=newNode("rect",1120,900); G.label="Descartado";        G.color="#8f8f8f"; G.order=7;
  let e;
  e=newEdge(A.id,B.id);  e.label="visita";     e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(B.id,C.id);  e.label="formulario"; e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(C.id,D.id);  e.label="sí";         e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(D.id,E2.id); e.label="demo";       e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(E2.id,F.id); e.label="firma";      e.fromSide="e"; e.toSide="w"; e.route="ortho";
  e=newEdge(C.id,G.id);  e.label="no";         e.fromSide="s"; e.toSide="n"; e.route="ortho"; e.dashed=true;
  settings.build=true; t0=performance.now(); pausedAt=0; syncProjectControls();
  centerView();
  trackEvent("example_loaded",{example:"demo"});
};

/* ===================== Exportación SVG ===================== */
function escapeXML(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}
function escapeAttribute(value){ return escapeXML(value); }
function svgFillColor(hex, theme){
  const v=parseInt(hex.slice(1),16);
  const a=theme==="crema"?.16:.18;
  return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`;
}
function getExportDimensions(scale=1){
  return { width:Math.round(W*scale), height:Math.round(H*scale) };
}
function getCurrentPageForExport(){ return P(); }
function downloadTextFile(filename, content, mimeType){
  const blob=new Blob([content],{type:mimeType});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url; link.download=filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function buildSVGDefs(){
  return `<defs>
  <marker id="fluyo-arrow-end" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
    <path d="M 0 0 L 10 4 L 0 8 z" fill="context-stroke"/>
  </marker>
  <marker id="fluyo-arrow-start" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth">
    <path d="M 0 0 L 10 4 L 0 8 z" fill="context-stroke"/>
  </marker>
</defs>`;
}
/* ===================== Símbolos reutilizables =====================
   Un icono se incrustaba como data URI COMPLETO dentro de cada nodo que lo usaba.
   En una arquitectura real eso es lo normal —varios Cloud Run, varias Cloud SQL,
   tres colas—, así que el mismo bloque de bytes viajaba repetido tantas veces
   como nodos.

   Con los 72 iconos dibujados a mano de Fluyo (430 B de media) apenas se notaba.
   Con los sets oficiales de proveedor, que son trazados reales de 1,5–4 KB, deja
   de ser una optimización: medido sobre un diagrama de 30 nodos con 10 iconos
   distintos a 4 KB, el SVG sale de 223 KB y REVIENTA el tope de 200 KB del
   transporte del MCP. Con <defs>/<use> el mismo diagrama son 79,5 KB — un 64 %
   menos. Ver INFORME-ICONOS-MARCA.md §6.2.

   Se agrupan iconos y GIFs, que son catálogo y siempre miden 64×64. Las imágenes
   que pega el usuario no: no se conoce su tamaño intrínseco —haría falta un
   viewBox que no tenemos— y además rara vez se repiten.

   Por qué <symbol> y no un <image> con id: un <use> que apunta a un <image> NO le
   propaga width/height, y aquí cada nodo dibuja el mismo icono a un tamaño
   distinto. Apuntando a un <symbol> con viewBox, el <use> sí manda.

   Los ids se asignan por orden de primera aparición recorriendo la página, que es
   el mismo orden en la app y en el MCP: los dos SVG salen idénticos. */
function svgSymbols(){
  const ids=new Map(), defs=[];
  return {
    use(src, x, y, s){
      if(!src) return "";
      let id=ids.get(src);
      if(id===undefined){
        id="fluyo-sym-"+ids.size;
        ids.set(src, id);
        defs.push(`<symbol id="${id}" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet"><image width="64" height="64" href="${escapeAttribute(src)}"/></symbol>`);
      }
      return `<use href="#${id}" xlink:href="#${id}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}"/>`;
    },
    defs(){ return defs.length? `<defs>\n${defs.join("\n")}\n</defs>` : ""; },
  };
}
const SVG_NS="http://www.w3.org/2000/svg";
let _svgMeasure=null;
function svgTextWidth(text, fs, family, bold){
  if(!_svgMeasure){
    _svgMeasure=document.createElementNS(SVG_NS,"svg");
    _svgMeasure.setAttribute("aria-hidden","true");
    Object.assign(_svgMeasure.style,{position:"absolute",width:"0",height:"0",overflow:"hidden",visibility:"hidden",pointerEvents:"none"});
    document.body.appendChild(_svgMeasure);
  }
  _svgMeasure.replaceChildren();
  const el=document.createElementNS(SVG_NS,"text");
  el.setAttribute("font-family",family||DEFAULT_FONT);
  el.setAttribute("font-size",String(fs));
  if(bold) el.setAttribute("font-weight","bold");
  el.textContent=text;
  _svgMeasure.appendChild(el);
  return el.getBBox().width;
}
/* Medidor para el exportador: getBBox() en un <svg> oculto, que es medición real
   del mismo motor de fuentes que usa el lienzo. */
function measureSvgLabel(n){
  const lines=String(n.label==null?"":n.label).split("\n");
  const family=n.font||settings.font||DEFAULT_FONT, bold=!!n.bold;
  return fs=>Math.max(...lines.map(l=>svgTextWidth(l,fs,family,bold)),1);
}
function svgNodeFill(n, theme){
  if(n.fill==="none") return "none";
  if(n.fill) return escapeAttribute(n.fill);
  return svgFillColor(n.color, theme);
}
function svgDash(n){
  if(n.border==="dashed") return ' stroke-dasharray="9 7"';
  if(n.border==="dotted") return ' stroke-dasharray="2 5"';
  return "";
}
const SVG_ANCHOR={left:"start", right:"end", center:"middle"};
function svgLabelLines(n, theme){
  if(!n.label) return "";
  const T=THEMES[theme];
  const family=n.font||settings.font||DEFAULT_FONT, bold=!!n.bold;
  const {lines, fs, lh, tx, align, baseY}=labelLayout(n, measureSvgLabel(n));
  const anchor=SVG_ANCHOR[align];
  const fill=n.textColor || ((n.shape==="text"||n.shape==="anim")? n.color : T.text);
  const parts=[];
  if(n.textBg){
    let maxW=Math.max(...lines.map(l=>svgTextWidth(l,fs,family,bold)),1);
    const padX=10, padY=6, bw=maxW+padX*2, bh=lines.length*lh+padY*2;
    let bx; if(anchor==="start") bx=tx-padX; else if(anchor==="end") bx=tx-bw+padX; else bx=tx-bw/2;
    const by=baseY-fs*.7-padY;
    parts.push(`<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="8" ry="8" fill="${escapeAttribute(n.textBg)}"/>`);
  }
  lines.forEach((l,i)=>{
    parts.push(`<text x="${tx.toFixed(2)}" y="${(baseY+i*lh).toFixed(2)}" font-family="${escapeAttribute(family)}" font-size="${fs.toFixed(1)}"${bold?' font-weight="bold"':''} fill="${escapeAttribute(fill)}" text-anchor="${anchor}" dominant-baseline="middle">${escapeXML(l)}</text>`);
  });
  return parts.join("\n");
}
function hexPointsSVG(n){
  const {x,y,w,h}=n, i=Math.min(24,w*.18);
  return [
    [x-w/2+i,y-h/2],[x+w/2-i,y-h/2],[x+w/2,y],
    [x+w/2-i,y+h/2],[x-w/2+i,y+h/2],[x-w/2,y]
  ].map(p=>p.map(v=>v.toFixed(2)).join(",")).join(" ");
}
function renderImageToSVG(n){
  if(!n.img) return "";
  return `<image x="${(n.x-n.w/2).toFixed(2)}" y="${(n.y-n.h/2).toFixed(2)}" width="${n.w}" height="${n.h}" href="${escapeAttribute(n.img)}" preserveAspectRatio="xMidYMid meet"/>`;
}
function renderNodeToSVG(n, theme, syms){
  const fill=svgNodeFill(n, theme), stroke=escapeAttribute(n.color), dash=svgDash(n);
  const parts=[`<g id="node-${n.id}">`];
  switch(n.shape){
    case "circle":
      parts.push(`<ellipse cx="${n.x}" cy="${n.y}" rx="${(n.w/2).toFixed(2)}" ry="${(n.h/2).toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"${dash}/>`);
      parts.push(svgLabelLines(n,theme));
      break;
    case "diamond":
      parts.push(`<polygon points="${n.x},${(n.y-n.h/2).toFixed(2)} ${(n.x+n.w/2).toFixed(2)},${n.y} ${n.x},${(n.y+n.h/2).toFixed(2)} ${(n.x-n.w/2).toFixed(2)},${n.y}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"${dash}/>`);
      parts.push(svgLabelLines(n,theme));
      break;
    case "hex":
      parts.push(`<polygon points="${hexPointsSVG(n)}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"${dash}/>`);
      parts.push(svgLabelLines(n,theme));
      break;
    case "cylinder":{
      const {x,y,w,h}=n, ry=Math.min(16,h*.18), top=y-h/2, bot=y+h/2;
      const d=`M ${(x-w/2).toFixed(2)} ${(top+ry).toFixed(2)} L ${(x-w/2).toFixed(2)} ${(bot-ry).toFixed(2)} C ${(x-w/2).toFixed(2)} ${(bot+ry*.8).toFixed(2)} ${(x+w/2).toFixed(2)} ${(bot+ry*.8).toFixed(2)} ${(x+w/2).toFixed(2)} ${(bot-ry).toFixed(2)} L ${(x+w/2).toFixed(2)} ${(top+ry).toFixed(2)} C ${(x+w/2).toFixed(2)} ${(top-ry*.8).toFixed(2)} ${(x-w/2).toFixed(2)} ${(top-ry*.8).toFixed(2)} ${(x-w/2).toFixed(2)} ${(top+ry).toFixed(2)} Z`;
      parts.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"${dash}/>`);
      parts.push(`<ellipse cx="${x}" cy="${(top+ry).toFixed(2)}" rx="${(w/2).toFixed(2)}" ry="${ry.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="2.5"/>`);
      parts.push(svgLabelLines(n,theme));
      break;
    }
    case "text":
      parts.push(svgLabelLines(n,theme));
      break;
    case "code":{
      /* `textLength` + `lengthAdjust="spacing"` es la pieza que hace que esto
         funcione: el SVG lo pinta después otro motor con otra fuente, así que sin
         forzar el ancho el resaltado se corre respecto a la palabra. Verificado
         en Chrome/Windows, donde `monospace` es Consolas: un token de 4
         caracteres a 16px mide 35.19px natural y 38.40 exactos con textLength. */
      const L=codeBlockLayout(n), col=codeColors(n,theme);
      const x=n.x-n.w/2, y=n.y-n.h/2;
      const fam=escapeAttribute(codeFont(n)), peso=n.bold===false?"":' font-weight="700"';
      const clip=`code-clip-${n.id}`;
      parts.push(`<clipPath id="${clip}"><rect x="${(x+2).toFixed(2)}" y="${(y+2).toFixed(2)}" width="${(n.w-4).toFixed(2)}" height="${(n.h-4).toFixed(2)}" rx="9" ry="9"/></clipPath>`);
      parts.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${n.w}" height="${n.h}" rx="10" ry="10" fill="${escapeAttribute(col.panel)}" stroke="${stroke}" stroke-width="2.5"${dash}/>`);
      parts.push(`<g clip-path="url(#${clip})">`);
      parts.push(`<rect x="${L.bx.toFixed(2)}" y="${L.by.toFixed(2)}" width="${L.bw.toFixed(2)}" height="${L.blockH.toFixed(2)}" rx="6" ry="6" fill="${escapeAttribute(col.paper)}"/>`);
      for(const row of L.rows){
        for(const tk of row.tokens){
          if(tk.kw) parts.push(`<rect x="${(tk.x-2).toFixed(2)}" y="${(row.ly-L.fs/2-2).toFixed(2)}" width="${(tk.w+4).toFixed(2)}" height="${(L.fs+6).toFixed(2)}" fill="${escapeAttribute(col.kwBg)}"/>`);
          parts.push(`<text x="${tk.x.toFixed(2)}" y="${row.ly.toFixed(2)}" font-family="${fam}" font-size="${L.fs.toFixed(2)}"${peso} fill="${escapeAttribute(tk.kw?col.kwText:col.text)}" dominant-baseline="middle" textLength="${tk.w.toFixed(3)}" lengthAdjust="spacing">${escapeXML(tk.t)}</text>`);
        }
      }
      parts.push("</g>");
      break;
    }
    case "anim":{
      const src=animURL[n.anim]||"";
      const s=Math.max(10, Math.min(n.w,n.h-(n.label?26:8)));
      parts.push(syms.use(src, n.x-s/2, n.y-(n.label?8:0)-s/2, s));
      parts.push(svgLabelLines(n,theme));
      break;
    }
    case "icon":{
      const src=iconURLFor(n.icon, nodeIconTint(n));
      const s=Math.min(n.w,n.h-26)*.78;
      parts.push(syms.use(src, n.x-s/2, n.y-n.h/2+4, s));
      parts.push(svgLabelLines(n,theme));
      break;
    }
    case "image":
      parts.push(renderImageToSVG(n));
      parts.push(svgLabelLines(n,theme));
      break;
    default:
      parts.push(`<rect x="${(n.x-n.w/2).toFixed(2)}" y="${(n.y-n.h/2).toFixed(2)}" width="${n.w}" height="${n.h}" rx="10" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="2.5"${dash}/>`);
      parts.push(svgLabelLines(n,theme));
  }
  parts.push("</g>");
  return parts.filter(Boolean).join("\n");
}
function renderConnectorToSVG(e, theme){
  const A=nodeById(e.from), B=nodeById(e.to);
  if(!A||!B) return "";
  const pts=edgePoints(e);
  if(pts.length<2) return "";
  const T=THEMES[theme];
  const lineCol=escapeAttribute(e.lineColor||T.edge);
  const dash=e.dashed? ' stroke-dasharray="8 7"':"";
  let markers="";
  if(e.endArrow!==false) markers+=' marker-end="url(#fluyo-arrow-end)"';
  if(e.startArrow) markers+=' marker-start="url(#fluyo-arrow-start)"';
  const ptsStr=pts.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const parts=[`<polyline points="${ptsStr}" fill="none" stroke="${lineCol}" stroke-width="2" stroke-linejoin="round"${dash}${markers}/>`];
  if(e.label){
    const m=labelPointFor(e,pts), efs=edgeLabelFs(e);
    const family=e.font||settings.font||DEFAULT_FONT, bold=!!e.bold;
    const tw=svgTextWidth(e.label, efs, family, bold);
    const rx=(m.x-tw/2-6).toFixed(2), ry=(m.y-efs*.85).toFixed(2);
    parts.push(`<rect x="${rx}" y="${ry}" width="${(tw+12).toFixed(2)}" height="${(efs*1.7).toFixed(2)}" fill="${escapeAttribute(T.lblBg)}"/>`);
    parts.push(`<text x="${m.x.toFixed(2)}" y="${m.y.toFixed(2)}" font-family="${escapeAttribute(family)}" font-size="${efs}"${bold?' font-weight="bold"':''} fill="${escapeAttribute(T.edgeLbl)}" text-anchor="middle" dominant-baseline="middle">${escapeXML(e.label)}</text>`);
  }
  return parts.join("\n");
}
function buildSVGDocument(scale=1){
  const {width,height}=getExportDimensions(scale);
  const page=getCurrentPageForExport();
  const theme=doc.theme;
  const parts=[
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}">`,
    buildSVGDefs()
  ];
  /* La misma colocación que en el lienzo, pero midiendo con getBBox en vez de
     con measureText: el SVG exportado tiene que enseñar las etiquetas donde el
     usuario las vio. */
  edgeLabelPos=placeEdgeLabels(e=>{
    const efs=edgeLabelFs(e);
    return {w:svgTextWidth(e.label, efs, e.font||settings.font||DEFAULT_FONT, !!e.bold), h:efs*1.7};
  });
  for(const e of page.edges||[]) parts.push(renderConnectorToSVG(e,theme));
  /* Los símbolos se recogen dibujando, así que el <defs> con los iconos solo se
     conoce al final. Se inserta después de las marcas de flecha en vez de al
     final del documento: un id se resuelve igual esté donde esté, pero un SVG que
     declara antes de usar es el que abren sin quejarse los editores externos. */
  const syms=svgSymbols();
  const nodos=(page.nodes||[]).map(n=>renderNodeToSVG(n,theme,syms));
  const defs=syms.defs();
  if(defs) parts.push(defs);
  parts.push(...nodos, "</svg>");
  return parts.join("\n");
}
function exportSVG(scale=1){
  downloadTextFile(slug()+".svg", buildSVGDocument(scale), "image/svg+xml;charset=utf-8");
}

/* ===================== Exportación ===================== */
const exModal=$("exModal");
function syncExportRows(){
  const f=$("exFmt").value;
  $("exRowTr").style.display = (f==="png"||f==="gif") ? "flex":"none";
  $("exRowFps").style.display = f==="gif" ? "flex":"none";
  $("exRowDur").style.display = f==="gif" ? "flex":"none";
  $("exHint").style.display = f==="gif" ? "block":"none";
}
$("exFmt").onchange=syncExportRows;
$("btnExport").onclick=()=>{ exModal.style.display="flex"; syncExportRows(); };
$("exCancel").onclick=()=>exModal.style.display="none";
function slug(){ return (P().name||"diagrama").toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi,"-"); }

/* gif.js se carga desde un CDN, así que puede faltar por un bloqueador de
   anuncios, una extensión de privacidad o una primera visita sin conexión.
   Antes esto llegaba al usuario como «GIF is not defined», un mensaje que no le
   dice ni qué pasó ni qué hacer. Se comprueba antes de abrir el progreso. */
function gifEncoderReady(){ return typeof GIF==="function"; }

$("exGo").onclick=()=>{
  const fmt=$("exFmt").value, scale=+$("exRes").value;
  exModal.style.display="none";
  if(P().nodes.length===0){ alert("La página está vacía."); return; }
  if(fmt==="gif" && !gifEncoderReady()){
    alert("No se puede generar el GIF: la librería que lo codifica (gif.js) no se cargó.\n\n"+
          "Lo más habitual es un bloqueador de anuncios o una primera visita sin conexión. "+
          "Prueba a recargar la página con el bloqueador desactivado.\n\n"+
          "PNG, JPG y SVG no dependen de esa librería y funcionan igual.");
    return;
  }
  /* después del guard, para no contar exports abortados. Mide la intención:
     un GIF puede fallar más tarde en el encoder y eso no se refleja aquí */
  trackEvent("diagram_exported",{format:fmt});
  if(fmt==="gif") exportGIF(scale, $("exTr").checked);
  else if(fmt==="svg") exportSVG(scale);
  else exportStatic(fmt, scale, $("exTr").checked);
};
function exportStatic(fmt,scale,transparent){
  const b = getBounds();
  const w=Math.round(b.w*scale), h=Math.round(b.h*scale);
  const off=document.createElement("canvas"); off.width=w; off.height=h;
  const oc=off.getContext("2d");
  oc.save(); oc.scale(scale,scale); oc.translate(-b.x, -b.y);
  render(oc, now(), {export:true, transparent: fmt==="png"&&transparent, bounds:b});
  oc.restore();
  const mime=fmt==="png"?"image/png":"image/jpeg";
  off.toBlob(blob=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=slug()+"."+(fmt==="png"?"png":"jpg");
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  }, mime, .92);
}
/* ===================== Salida del progreso del GIF =====================
   gif.js codifica en web workers y no emite ningún evento si uno muere: el
   overlay «Generando GIF…» se quedaba visible indefinidamente, sin botón de
   cancelar ni forma de cerrarlo, así que la única salida era recargar y perder
   la sesión. Estas tres piezas garantizan que siempre se pueda salir:
   el botón Cancelar, un vigilante por inactividad, y el flag que corta el bucle
   de fotogramas (que es un `await` y no se puede abortar desde fuera). */
const GIF_STALL_MS=25000;
let activeGif=null, gifWatchdog=null, gifCancelled=false;

function stopGifWatchdog(){ clearTimeout(gifWatchdog); gifWatchdog=null; }
/* Se rearma en cada señal de vida (cada fotograma y cada tick del encoder),
   así que solo salta si de verdad no avanza nada. */
function armGifWatchdog(){
  stopGifWatchdog();
  gifWatchdog=setTimeout(()=>abortGIF(
    "La generación del GIF se detuvo: no respondió en "+(GIF_STALL_MS/1000)+" segundos.\n\n"+
    "Prueba con una duración más corta, menos FPS o una escala menor. "+
    "PNG y SVG no usan el codificador y siempre funcionan."), GIF_STALL_MS);
}
function closeProgress(){
  stopGifWatchdog();
  $("progOv").style.display="none";
  activeGif=null;
}
function abortGIF(msg){
  gifCancelled=true;
  try{ if(activeGif && typeof activeGif.abort==="function") activeGif.abort(); }
  catch(e){ /* si abort() no existe o falla, igual hay que cerrar el overlay */ }
  closeProgress();
  if(msg) alert(msg);
}
$("progCancel").onclick=()=>abortGIF(null);

let workerUrl=null;
async function getWorker(){
  if(workerUrl) return workerUrl;
  const src=await fetch("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js").then(r=>r.text());
  workerUrl=URL.createObjectURL(new Blob([src],{type:"application/javascript"}));
  return workerUrl;
}
async function exportGIF(scale, transparent){
  const fps=+$("exFps").value;
  let dur=clamp(+$("exDur").value||3,1,15);
  const bDur=buildDuration();
  const flowDur=Math.max(0.5,dur-bDur);
  const cycles=Math.max(1,Math.round(settings.speed*flowDur));
  const exSpeed=cycles/flowDur, realSpeed=settings.speed;

  const ov=$("progOv"), fill=$("barFill"), msg=$("ovMsg");
  ov.style.display="flex"; fill.style.width="0%"; msg.textContent="Renderizando fotogramas…";
  gifCancelled=false;
  armGifWatchdog();
  try{
    const wurl=await getWorker();
    const b = getBounds();
    const w=Math.round(b.w*scale), h=Math.round(b.h*scale);
    const off=document.createElement("canvas"); off.width=w; off.height=h;
    const oc=off.getContext("2d");
    const keyNum = doc.theme==="crema"? 0xfefdfc : 0x010101;
    const keyCss = doc.theme==="crema"? "#fefdfc" : "#010101";
    const gifOpts={workers:2, quality:8, width:w, height:h, workerScript:wurl};
    if(transparent) gifOpts.transparent=keyNum;
    const gif=new GIF(gifOpts);
    activeGif=gif;
    const frames=Math.round(dur*fps);
    settings.speed=exSpeed;
    for(let f=0;f<frames;f++){
      const t=f/fps;
      oc.save(); oc.scale(scale,scale); oc.translate(-b.x, -b.y);
      render(oc,t, transparent? {export:true, bg:keyCss, bounds:b} : {export:true, bounds:b});
      oc.restore();
      gif.addFrame(off,{copy:true, delay:Math.round(1000/fps)});
      if(f%5===0){
        fill.style.width=(f/frames*40)+"%";
        armGifWatchdog();
        await new Promise(r=>setTimeout(r));
        /* el bucle es un await y no se puede abortar desde fuera: se comprueba
           el flag tras cada cesión para que Cancelar surta efecto de verdad */
        if(gifCancelled){ settings.speed=realSpeed; return; }
      }
    }
    settings.speed=realSpeed;
    msg.textContent="Codificando GIF…";
    gif.on("progress",p=>{ fill.style.width=(40+p*60)+"%"; armGifWatchdog(); });
    gif.on("finished",blob=>{
      if(gifCancelled) return;
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download=slug()+".gif"; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),5000);
      closeProgress();
    });
    gif.render();
    armGifWatchdog();
  }catch(err){
    settings.speed=realSpeed;
    closeProgress();
    alert("No se pudo generar el GIF: "+err.message);
  }
}

function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return;
  const register=()=> navigator.serviceWorker.register("./sw.js").catch(console.error);
  if(document.readyState==="complete") register();
  else window.addEventListener("load", register, {once:true});
}
registerServiceWorker();
