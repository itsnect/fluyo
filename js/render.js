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
function drawLabelLines(c,n,theme,baseFs,cy){
  const T=THEMES[theme];
  c.fillStyle = n.shape==="text"? n.color : T.text;
  c.textAlign="center"; c.textBaseline="middle";
  const lines=String(n.label).split("\n");
  let fs=n.fs||baseFs;
  c.font=`${fs}px Georgia, serif`;
  if(!n.fs){
    const maxW=Math.max(...lines.map(l=>c.measureText(l).width),1);
    const avail=n.w-18;
    if(maxW>avail){ fs=Math.max(10, fs*avail/maxW); c.font=`${fs}px Georgia, serif`; }
  }
  const lh=fs*1.25, oy=cy-(lines.length-1)*lh/2;
  lines.forEach((l,i)=>c.fillText(l,n.x,oy+i*lh));
}
function nodeCorners(n){
  return [[n.x-n.w/2-6,n.y-n.h/2-6],[n.x+n.w/2+6,n.y-n.h/2-6],
          [n.x+n.w/2+6,n.y+n.h/2+6],[n.x-n.w/2-6,n.y+n.h/2+6]];
}
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
    if(n.label) drawLabelLines(c,n,theme,14,n.y+n.h/2+14);
  }
  else if(n.shape==="icon"){
    const im=getImg(iconURL[n.icon]||"");
    const s=Math.min(n.w,n.h-26)*.78;
    if(glow>0){c.shadowColor=n.color; c.shadowBlur=18*glow;}
    if(im.complete && im.naturalWidth) c.drawImage(im, n.x-s/2, n.y-n.h/2+4, s, s);
    c.shadowBlur=0;
    if(n.label) drawLabelLines(c,n,theme,14,n.y+n.h/2-10);
  }
  else if(n.shape==="cylinder"){
    const {x,y,w,h}=n, ry=Math.min(16,h*.18), top=y-h/2, bot=y+h/2;
    c.fillStyle=hexA(n.color, theme==="crema"?.16:.18);
    c.strokeStyle=n.color; c.lineWidth=2.5+glow*1.5;
    if(glow>0){c.shadowColor=n.color; c.shadowBlur=18*glow;}
    c.beginPath();
    c.moveTo(x-w/2,top+ry); c.lineTo(x-w/2,bot-ry);
    c.bezierCurveTo(x-w/2,bot+ry*.8, x+w/2,bot+ry*.8, x+w/2,bot-ry);
    c.lineTo(x+w/2,top+ry);
    c.bezierCurveTo(x+w/2,top-ry*.8, x-w/2,top-ry*.8, x-w/2,top+ry);
    c.fill(); c.stroke();
    c.beginPath(); c.ellipse(x,top+ry,w/2,ry,0,0,Math.PI*2); c.stroke();
    c.shadowBlur=0;
    drawLabelLines(c,n,theme,17,n.y+6);
  }
  else if(n.shape==="text"){
    drawLabelLines(c,n,theme,22,n.y);
  }
  else{
    c.fillStyle=hexA(n.color, theme==="crema"?.16:.18);
    c.strokeStyle=n.color; c.lineWidth=2.5+glow*1.5;
    if(glow>0){c.shadowColor=n.color; c.shadowBlur=18*glow;}
    shapePath(c,n); c.fill(); c.stroke();
    c.shadowBlur=0;
    drawLabelLines(c,n,theme,17,n.y);
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
function arrowHead(c,x,y,ang,col){
  c.save(); c.translate(x,y); c.rotate(ang);
  c.fillStyle=col; c.beginPath();
  c.moveTo(1,0); c.lineTo(-11,-6); c.lineTo(-11,6); c.closePath(); c.fill();
  c.restore();
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
  if(e.animated){
    c.fillStyle=e.dotColor||A.color;
    const n=settings.dots;
    for(let i=0;i<n;i++){
      let base=(t*settings.speed + i/n)%1; if(base<0)base+=1;
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
    const m=pointAt(pts,.5);
    const efs=e.fs||13;
    c.font=efs+"px Georgia, serif"; c.textAlign="center"; c.textBaseline="middle";
    const w=c.measureText(e.label).width;
    c.fillStyle=T.lblBg; c.fillRect(m.x-w/2-6,m.y-efs*.85,w+12,efs*1.7);
    c.fillStyle=T.edgeLbl; c.fillText(e.label,m.x,m.y);
  }
  if(single){
    c.lineWidth=1.6;
    (e.waypoints||[]).forEach(wp=>{
      c.fillStyle="#3aa7e8"; c.beginPath(); c.arc(wp.x,wp.y,6,0,Math.PI*2); c.fill();
      c.strokeStyle="#fff"; c.stroke();
    });
    for(let i=1;i<pts.length;i++){
      const mx=(pts[i-1].x+pts[i].x)/2, my=(pts[i-1].y+pts[i].y)/2;
      c.fillStyle=theme==="crema"?"#f4eee1":"#161616";
      c.strokeStyle="#3aa7e8";
      c.beginPath(); c.arc(mx,my,5,0,Math.PI*2); c.fill(); c.stroke();
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
function render(c,t,opts={}){
  const theme=doc.theme, T=THEMES[theme];
  const isExport=!!opts.export;
  c.clearRect(0,0,W,H);
  if(opts.bg){ c.fillStyle=opts.bg; c.fillRect(0,0,W,H); }
  else if(!opts.transparent){ c.fillStyle=T.bg; c.fillRect(0,0,W,H); }
  if(!isExport){
    c.strokeStyle=T.grid; c.lineWidth=1; c.beginPath();
    for(let x=GRID;x<W;x+=GRID){c.moveTo(x,0);c.lineTo(x,H);}
    for(let y=GRID;y<H;y+=GRID){c.moveTo(0,y);c.lineTo(W,y);}
    c.stroke();
  }
  for(const e of P().edges) drawEdge(c,e,t,theme,isExport);
  for(const n of P().nodes) drawNode(c,n,t,theme,isExport);

  if(!isExport){
    if(mode==="select" && !drag && !resizing && !wpDrag && !connectDrag && !marquee && !pendingShape && !pendingIcon){
      if(hoverNode) drawSideArrows(c,hoverNode);
    }
    if(connectDrag){
      const A=nodeById(connectDrag.fromId);
      if(A){
        const p=sidePoint(A,connectDrag.fromSide);
        c.save(); c.strokeStyle="#3aa7e8"; c.setLineDash([6,5]); c.lineWidth=2;
        c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(mouse.x,mouse.y); c.stroke(); c.setLineDash([]);
        if(hoverNode && hoverNode.id!==A.id){
          c.strokeStyle="#3aa7e8"; c.lineWidth=2.5;
          c.strokeRect(hoverNode.x-hoverNode.w/2-4,hoverNode.y-hoverNode.h/2-4,hoverNode.w+8,hoverNode.h+8);
          // 4 puntos de anclaje del destino
          const near=nearestAnchorSide(hoverNode,mouse,22);
          for(const s of SIDES){
            const q=sidePoint(hoverNode,s);
            c.beginPath(); c.arc(q.x,q.y,6,0,Math.PI*2);
            if(s===near){
              c.fillStyle="#3aa7e8"; c.fill();
              c.strokeStyle="#fff"; c.lineWidth=1.6; c.stroke();
            } else {
              c.fillStyle=theme==="crema"?"#f4eee1":"#161616"; c.fill();
              c.strokeStyle="#3aa7e8"; c.lineWidth=1.6; c.stroke();
            }
          }
        }
        c.restore();
      }
    }
    if(connecting!==null){
      const A=nodeById(connecting);
      if(A){ c.save(); c.strokeStyle="#3aa7e8"; c.setLineDash([5,5]); c.lineWidth=2;
        c.beginPath(); c.moveTo(A.x,A.y); c.lineTo(mouse.x,mouse.y); c.stroke(); c.restore(); }
    }
    if(marquee){
      const r=normRect(marquee);
      c.save();
      c.fillStyle="rgba(58,167,232,.12)";
      c.strokeStyle="#3aa7e8"; c.lineWidth=1;
      c.fillRect(r.x,r.y,r.w,r.h); c.strokeRect(r.x,r.y,r.w,r.h);
      c.restore();
    }
    if(P().nodes.length===0){
      c.fillStyle=theme==="crema"?"#00000055":"#ffffff44";
      c.font="20px Georgia, serif"; c.textAlign="center";
      c.fillText("Elige una forma o icono a la izquierda y haz clic aquí — o pulsa «Ejemplo»", W/2, H/2);
    }
  }
}
function now(){ return playing? (performance.now()-t0)/1000 : pausedAt; }
(function loop(){ render(ctx,now()); requestAnimationFrame(loop); })();
