"use strict";
/* Interacción: puntero, teclado, zoom/pan, pegar/soltar imágenes */

/* ===================== Interacción ===================== */
function toWorld(ev){
  const r=cv.getBoundingClientRect();
  const screenX = ev.clientX-r.left;
  const screenY = ev.clientY-r.top;
  return { x: (screenX - viewX)/viewZoom, y: (screenY - viewY)/viewZoom };
}
function normRect(m){
  return { x:Math.min(m.x0,m.x1), y:Math.min(m.y0,m.y1),
           w:Math.abs(m.x1-m.x0), h:Math.abs(m.y1-m.y0) };
}
function hitNode(x,y){
  const ns=P().nodes;
  for(let i=ns.length-1;i>=0;i--){
    const n=ns[i];
    if(Math.abs(x-n.x)<=n.w/2+4 && Math.abs(y-n.y)<=n.h/2+4) return n;
  }
  return null;
}
function hitEdge(x,y){
  const es=P().edges;
  for(let i=es.length-1;i>=0;i--){
    const pts=edgePoints(es[i]);
    for(let j=1;j<pts.length;j++){
      const p1=pts[j-1], p2=pts[j];
      const L2=(p2.x-p1.x)**2+(p2.y-p1.y)**2; if(L2===0) continue;
      let u=((x-p1.x)*(p2.x-p1.x)+(y-p1.y)*(p2.y-p1.y))/L2; u=clamp(u,0,1);
      const d=Math.hypot(x-(p1.x+u*(p2.x-p1.x)), y-(p1.y+u*(p2.y-p1.y)));
      if(d<8) return es[i];
    }
  }
  return null;
}
function hitSideArrow(n,x,y){
  if(!n) return null;
  for(const s of SIDES){
    const p=sidePoint(n,s), d=DIR[s];
    if(Math.hypot(x-(p.x+d.x*ARROW_OFF), y-(p.y+d.y*ARROW_OFF))<14) return s;
  }
  return null;
}
function hitCorner(n,x,y){
  if(!n) return -1;
  const cs=nodeCorners(n);
  for(let i=0;i<4;i++) if(Math.hypot(x-cs[i][0],y-cs[i][1])<10) return i;
  return -1;
}
function hitWaypoint(e,x,y){
  const wps=e.waypoints||[];
  for(let i=0;i<wps.length;i++) if(Math.hypot(x-wps[i].x,y-wps[i].y)<10) return i;
  return -1;
}
function hitMidpoint(e,x,y){
  const pts=edgePoints(e);
  for(let i=1;i<pts.length;i++){
    const mx=(pts[i-1].x+pts[i].x)/2, my=(pts[i-1].y+pts[i].y)/2;
    if(Math.hypot(x-mx,y-my)<9) return i-1;
  }
  return -1;
}

let wasRightDrag = false;
cv.addEventListener("contextmenu", ev => {
  if (wasRightDrag) ev.preventDefault();
});

cv.addEventListener("pointerdown", ev=>{
  if (ev.button === 1 || ev.button === 2 || (ev.button === 0 && ev.altKey)) {
    if (ev.button !== 2) ev.preventDefault();
    panDrag = { x: ev.clientX, y: ev.clientY, startX: viewX, startY: viewY, isRight: ev.button===2, moved: false };
    cv.setPointerCapture(ev.pointerId);
    return;
  }
  if (ev.button !== 0) return;

  ev.preventDefault();
  const p=toWorld(ev); mouse.x=p.x; mouse.y=p.y;
  commitEditBox();
  cv.setPointerCapture(ev.pointerId);

  if(pendingShape || pendingIcon){
    pushUndo();
    let n;
    if(pendingIcon) n=newNode("icon",p.x,p.y,{icon:pendingIcon, label:ICONS[pendingIcon].n});
    else n=newNode(pendingShape,p.x,p.y);
    selectOnly("node",n.id);
    pendingShape=null; pendingIcon=null; syncRail();
    return;
  }
  const n=hitNode(p.x,p.y);

  if(mode==="connect"){
    if(n){
      if(connecting===null) connecting=n.id;
      else { pushUndo(); const e=newEdge(connecting,n.id); connecting=null; if(e) selectOnly("edge",e.id); }
    } else connecting=null;
    return;
  }

  // 1) tirador de tamaño (solo con un nodo seleccionado)
  const single=singleSel();
  if(single && single.type==="node" && single.obj){
    const sn=single.obj;
    const ci=hitCorner(sn,p.x,p.y);
    if(ci>=0){
      pushUndo();
      resizing={id:sn.id,
        fx:sn.x+(ci===0||ci===3? sn.w/2 : -sn.w/2),
        fy:sn.y+(ci<=1? sn.h/2 : -sn.h/2),
        aspect:(sn.shape==="image"||sn.shape==="icon")? sn.w/sn.h : null};
      return;
    }
  }
  // 2) codos / puntos medios (solo con una flecha seleccionada)
  if(single && single.type==="edge" && single.obj){
    const se=single.obj;
    const wi=hitWaypoint(se,p.x,p.y);
    if(wi>=0){ pushUndo(); wpDrag={edgeId:se.id, idx:wi}; return; }
    const mi=hitMidpoint(se,p.x,p.y);
    if(mi>=0){
      pushUndo();
      if(se.route==="ortho" && (se.waypoints||[]).length===0){
        const pts=edgePoints(se);
        se.waypoints=pts.slice(1,-1).map(q=>({x:q.x,y:q.y}));
      }
      se.waypoints.splice(mi,0,{x:p.x,y:p.y});
      wpDrag={edgeId:se.id, idx:mi};
      return;
    }
  }
  // 3) flechas direccionales (conexión estilo draw.io)
  const arrowSide=hitSideArrow(hoverNode,p.x,p.y);
  if(arrowSide && hoverNode){
    connectDrag={fromId:hoverNode.id, fromSide:arrowSide};
    return;
  }
  // 4) nodo → seleccionar / arrastrar grupo
  if(n){
    if(ev.shiftKey){ toggleSel("node",n.id); return; }
    if(!selN.has(n.id)) selectOnly("node",n.id);
    pushUndo();
    drag={offs:{}, wps:[]};
    for(const id of selN){
      const nn=nodeById(id);
      if(nn) drag.offs[id]={dx:p.x-nn.x, dy:p.y-nn.y};
    }
    // los codos de flechas internas al grupo se mueven con él
    for(const e of P().edges){
      if(selN.has(e.from)&&selN.has(e.to))
        (e.waypoints||[]).forEach(w=>drag.wps.push({w, dx:p.x-w.x, dy:p.y-w.y}));
      // si solo un extremo se mueve: conservar la topología (lados) y re-rutear
      else if((selN.has(e.from)||selN.has(e.to)) && (e.waypoints||[]).length){
        const pts=edgePoints(e);
        if(pts.length>1){
          const A2=nodeById(e.from), B2=nodeById(e.to);
          if(A2 && !e.fromSide) e.fromSide=sideOfPoint(A2,pts[0]);
          if(B2 && !e.toSide)   e.toSide=sideOfPoint(B2,pts[pts.length-1]);
        }
        e.waypoints=[]; e.route="ortho";
      }
    }
    return;
  }
  // 5) flecha
  const e=hitEdge(p.x,p.y);
  if(e){
    if(ev.shiftKey) toggleSel("edge",e.id);
    else selectOnly("edge",e.id);
    return;
  }
  // 6) vacío → marco de selección
  marquee={x0:p.x, y0:p.y, x1:p.x, y1:p.y, add:ev.shiftKey};
});

cv.addEventListener("pointermove", ev=>{
  if(panDrag){
    const dx = ev.clientX - panDrag.x;
    const dy = ev.clientY - panDrag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panDrag.moved = true;
    viewX = panDrag.startX + dx;
    viewY = panDrag.startY + dy;
    return;
  }
  const p=toWorld(ev); mouse.x=p.x; mouse.y=p.y;
  if(marquee){ marquee.x1=p.x; marquee.y1=p.y; return; }
  if(drag){
    for(const id in drag.offs){
      const nn=nodeById(+id);
      if(nn){ nn.x=snap(p.x-drag.offs[id].dx); nn.y=snap(p.y-drag.offs[id].dy); }
    }
    drag.wps.forEach(o=>{ o.w.x=snap(p.x-o.dx); o.w.y=snap(p.y-o.dy); });
    return;
  }
  if(resizing){
    const n=nodeById(resizing.id);
    if(n){
      let w=Math.max(40,Math.abs(p.x-resizing.fx)-6);
      let h=Math.max(30,Math.abs(p.y-resizing.fy)-6);
      if(resizing.aspect){
        if(w/resizing.aspect>h) h=w/resizing.aspect; else w=h*resizing.aspect;
      }
      n.w=Math.round(w); n.h=Math.round(h);
      n.x=Math.round((p.x+resizing.fx)/2); n.y=Math.round((p.y+resizing.fy)/2);
    }
    return;
  }
  if(wpDrag){
    const e=edgeById(wpDrag.edgeId);
    if(e && e.waypoints[wpDrag.idx]){
      e.waypoints[wpDrag.idx].x=snap(p.x);
      e.waypoints[wpDrag.idx].y=snap(p.y);
    }
    return;
  }
  hoverNode=hitNode(p.x,p.y);
  if(!hoverNode){
    for(const nd of P().nodes){ if(hitSideArrow(nd,p.x,p.y)){ hoverNode=nd; break; } }
  }
  const single=singleSel();
  let cur="default";
  if(pendingShape||pendingIcon||mode==="connect"||connectDrag) cur="crosshair";
  else if(single&&single.type==="node"&&single.obj&&hitCorner(single.obj,p.x,p.y)>=0) cur="nwse-resize";
  else if(hoverNode&&hitSideArrow(hoverNode,p.x,p.y)) cur="crosshair";
  else if(hoverNode) cur="grab";
  cv.style.cursor=cur;
});

cv.addEventListener("pointerup", ev=>{
  if(panDrag){
    if (panDrag.isRight && panDrag.moved) {
      wasRightDrag = true;
      setTimeout(() => wasRightDrag = false, 50);
    }
    panDrag=null;
    return;
  }
  const p=toWorld(ev);
  const hadDrag=!!(drag||resizing||wpDrag);
  if(connectDrag){
    const tgt=hitNode(p.x,p.y);
    if(tgt && tgt.id!==connectDrag.fromId){
      pushUndo();
      const snapSide=nearestAnchorSide(tgt,p,22);
      const e=newEdge(connectDrag.fromId,tgt.id,{
        fromSide:connectDrag.fromSide,
        toSide:snapSide,
        route:"ortho"
      });
      if(e) selectOnly("edge",e.id);
    }
    connectDrag=null;
  }
  if(marquee){
    const r=normRect(marquee);
    if(r.w>6 || r.h>6){
      if(!marquee.add){ selN.clear(); selE.clear(); }
      for(const nd of P().nodes){
        if(nd.x+nd.w/2>=r.x && nd.x-nd.w/2<=r.x+r.w &&
           nd.y+nd.h/2>=r.y && nd.y-nd.h/2<=r.y+r.h) selN.add(nd.id);
      }
      for(const e of P().edges){
        const m=pointAt(edgePoints(e),.5);
        const inside=m.x>=r.x&&m.x<=r.x+r.w&&m.y>=r.y&&m.y<=r.y+r.h;
        if(inside || (selN.has(e.from)&&selN.has(e.to))) selE.add(e.id);
      }
      refreshPanel();
    } else if(!marquee.add){ clearSel(); }
    marquee=null;
  }
  drag=null; resizing=null; wpDrag=null;
  if(hadDrag) scheduleAutosave();
});

/* doble clic: editar texto / borrar codo */
const editBox=$("editBox");
let editing=null;
cv.addEventListener("dblclick", ev=>{
  const p=toWorld(ev);
  const single=singleSel();
  if(single && single.type==="edge" && single.obj){
    const wi=hitWaypoint(single.obj,p.x,p.y);
    if(wi>=0){ pushUndo(); single.obj.waypoints.splice(wi,1); return; }
  }
  const tgt=hitNode(p.x,p.y)||hitEdge(p.x,p.y);
  if(!tgt) return;
  editing=tgt;
  let cx,cyy,w;
  if(tgt.from!==undefined){ const m=pointAt(edgePoints(tgt),.5); cx=m.x; cyy=m.y; w=170; }
  else { cx=tgt.x; cyy=tgt.shape==="image"? tgt.y+tgt.h/2+14 : tgt.y; w=Math.max(120,tgt.w); }
  const screenCX = cx * viewZoom + viewX;
  const screenCY = cyy * viewZoom + viewY;
  editBox.style.display="block";
  editBox.style.left = (screenCX - (w/2)*viewZoom) + "px";
  editBox.style.top = (screenCY - 16*viewZoom) + "px";
  editBox.style.width = (w * viewZoom) + "px";
  editBox.style.fontSize = Math.max(12, 15 * viewZoom) + "px";
  editBox.value=tgt.label||"";
  editBox.rows=(editBox.value.split("\n").length)||1;
  editBox.focus(); editBox.select();
});
function commitEditBox(){
  if(!editing) return;
  if(editing.label!==editBox.value) pushUndo();
  editing.label=editBox.value;
  editing=null; editBox.style.display="none";
  refreshPanel();
}
editBox.addEventListener("keydown", ev=>{
  if(ev.key==="Enter"&&!ev.shiftKey){ ev.preventDefault(); commitEditBox(); }
  if(ev.key==="Escape"){ editing=null; editBox.style.display="none"; }
  ev.stopPropagation();
});
editBox.addEventListener("blur", commitEditBox);

document.addEventListener("keydown", ev=>{
  if(ev.target.tagName==="TEXTAREA"||ev.target.tagName==="INPUT") return;
  const k=ev.key.toLowerCase(), ctl=ev.ctrlKey||ev.metaKey;
  if(ctl && k==="z"){ ev.preventDefault(); ev.shiftKey? redo():undo(); return; }
  if(ctl && k==="y"){ ev.preventDefault(); redo(); return; }
  if(ctl && k==="s"){ ev.preventDefault(); saveJSON(); return; }
  if(ctl && k==="c"){ copySel(); return; }
  if(ctl && k==="x"){ cutSel(); return; }
  if(ctl && k==="a"){ ev.preventDefault(); selectAll(); return; }
  if(ctl && k==="d"){ ev.preventDefault(); dupSel(); return; }
  if(ctl && k==="v"){
    clearTimeout(pasteTimer);
    pasteTimer=setTimeout(()=>pasteClip(),140); // si el evento paste trae imagen, se cancela
    return;
  }
  if(ev.key==="Delete"||ev.key==="Backspace") deleteSel();
  if(ev.key==="Escape"){ pendingShape=null; pendingIcon=null; connecting=null; connectDrag=null; marquee=null; $("iconDrawer").style.display="none"; syncRail(); }
  if(k==="v") setMode("select");
  if(k==="c") setMode("connect");
  if(ev.key===" "){ ev.preventDefault(); togglePlay(); }
});

cv.addEventListener("wheel", ev => {
  ev.preventDefault();
  if (ev.ctrlKey || ev.metaKey) {
    const r = cv.getBoundingClientRect();
    const screenX = ev.clientX - r.left;
    const screenY = ev.clientY - r.top;
    const zoomDelta = ev.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = clamp(viewZoom * zoomDelta, 0.1, 5);
    const worldX = (screenX - viewX) / viewZoom;
    const worldY = (screenY - viewY) / viewZoom;
    viewZoom = newZoom;
    viewX = screenX - worldX * viewZoom;
    viewY = screenY - worldY * viewZoom;
    commitEditBox();
  } else {
    viewX -= ev.deltaX;
    viewY -= ev.deltaY;
    commitEditBox();
  }
}, {passive: false});

/* ===================== Pegar / soltar imágenes ===================== */
function addImageFromBlob(blob, x=W/2, y=H/2){
  const fr=new FileReader();
  fr.onload=()=>{
    const url=fr.result, im=new Image();
    im.onload=()=>{
      pushUndo();
      const maxD=320, sc=Math.min(1, maxD/Math.max(im.naturalWidth,im.naturalHeight));
      const n=newNode("image",x,y,{img:url, w:Math.round(im.naturalWidth*sc), h:Math.round(im.naturalHeight*sc)});
      selectOnly("node",n.id);
    };
    im.src=url;
  };
  fr.readAsDataURL(blob);
}
document.addEventListener("paste", ev=>{
  if(ev.target.tagName==="TEXTAREA"||ev.target.tagName==="INPUT") return;
  clearTimeout(pasteTimer);
  const txt=ev.clipboardData.getData("text/plain")||"";
  if(txt.startsWith("fluyo::")){
    try{ clip=JSON.parse(txt.slice(7)); }catch(e){}
    pasteClip(); ev.preventDefault(); return;
  }
  for(const it of ev.clipboardData.items){
    if(it.type.startsWith("image/")){
      addImageFromBlob(it.getAsFile());
      ev.preventDefault();
      return;
    }
  }
  // sin imagen ni datos fluyo: pegar el portapapeles interno si existe
  if(clip) pasteClip();
});
cv.addEventListener("dragover", ev=>ev.preventDefault());
cv.addEventListener("drop", ev=>{
  ev.preventDefault();
  const p=toWorld(ev);
  for(const f of ev.dataTransfer.files){
    if(f.type.startsWith("image/")){ addImageFromBlob(f,p.x,p.y); return; }
  }
});
$("btnImg").onclick=()=>$("imgIn").click();
$("imgIn").onchange=ev=>{
  const f=ev.target.files[0];
  if(f) addImageFromBlob(f);
  ev.target.value="";
};
