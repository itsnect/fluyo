"use strict";
/* FLUYO-013. Presentar una Historia. Capa de presentación sobre el Playback
   existente: NO ejecuta nada, sólo lee el Scenario activo y el estado de
   scPlayback (editor-scenarios.js) y lo traduce a lenguaje humano.

   Fase de Present (derivada, nunca persistida ni duplicada):
     sin historia · ready (scStatus idle) · playing (running) · finished (completed)

   Sólo la parte DOM (presentStoryRefresh): pinta #presentStory y #presentBar. */

/* La parte pura (momentos, mensajes, cierre) vive en story-playback.js y se
   comparte con el Viewer: FluyoPresentStory === FluyoStory. */

/* ───────────────────────── DOM ───────────────────────── */

function presentHasStory(){
  if(typeof scActiveScenario!=="function") return false;
  const s=scActiveScenario();
  return !!s && s.steps.length>0;
}
/* ready | playing | finished | none */
function presentPhase(){
  if(!presentHasStory()) return "none";
  if(typeof scStatus==="undefined") return "ready";
  return scStatus==="running" ? "playing" : scStatus==="completed" ? "finished" : "ready";
}

function presentPlay(){
  if(!presenting || !presentHasStory()) return;
  if(scStatus==="running") return;
  scRun({present:true});
  presentStoryRefresh();
}
function presentStop(){
  if(!presenting) return;
  if(typeof scReset==="function") scReset();
  presentStoryRefresh();
}

/* Sólo escribe en el DOM lo que cambió: se invoca en cada fotograma. */
let psLast={};
function psSet(id, prop, value){
  const key=id+"."+prop;
  if(psLast[key]===value) return;
  psLast[key]=value;
  const el=$(id); if(!el) return;
  if(prop==="text") el.textContent=value; else el[prop]=value;
}

function presentStoryRefresh(){
  if(!$("presentStory")) return;
  if(!presenting){
    psLast={};
    psSet("presentStory","hidden",true);
    return;
  }
  const phase=presentPhase(), has=phase!=="none";
  const sc=has?scActiveScenario():null;
  const pages=doc.pages.length;

  /* controles de la barra */
  psSet("prPrev","hidden",pages<2);
  psSet("prPos","hidden",pages<2);
  psSet("prNext","hidden",pages<2);
  psSet("psPlay","hidden",!has || phase==="playing");
  psSet("psPlay","text",phase==="finished"?"↻ Repetir":"▶ Reproducir");
  psSet("psStop","hidden",phase!=="playing");
  psSet("psEdit","hidden",phase!=="finished");
  psSet("presentBar","className", phase==="playing" ? "" : "psAttention");

  /* encabezado de la historia */
  psSet("presentStory","hidden",!has && !scErrors.length);
  if(!has){
    psSet("psTitle","text","");
    psSet("psDots","hidden",true);
    psSet("psCaption","text","");
    psSet("psSummary","text","");
    return;
  }
  const d=FluyoStory.describe(phase, sc, scPlayback, id=>scNodeFallback(id), id=>edgeById(id));
  const ms=d.moments, idx=d.idx;

  psSet("psTitle","text", d.title);
  psSet("psTitle","className", "psTitle "+(phase==="ready"?"psTitleReady":""));

  /* progreso: puntos si caben; si no, «n / total» */
  const dots=$("psDots");
  const useDots=ms.length>1 && ms.length<=FluyoPresentStory.MAX_DOTS;
  const sig=ms.length+"|"+idx+"|"+useDots+"|"+phase;
  if(psLast.dots!==sig){
    psLast.dots=sig;
    dots.textContent="";
    dots.hidden=ms.length<2;
    if(useDots){
      ms.forEach((m,i)=>{
        const d=document.createElement("span");
        d.className="psDot"+(i<=idx?" done":"")+(i===idx&&phase==="playing"?" now":"");
        d.title=m.label||"";
        dots.appendChild(d);
      });
    } else if(ms.length>1){
      dots.textContent=Math.max(0,idx+1)+" / "+ms.length;
    }
  }

  /* mensaje: consecuencia vigente o cierre */
  let cap=d.caption, sum=d.summary;
  if(phase!=="playing" && phase!=="finished" && scErrors.length) cap=scErrors[0];
  psSet("psCaption","text",cap);
  psSet("psSummary","text",sum);
}

/* Encaja el diagrama en el espacio libre de la escena: deja aire alrededor y
   reserva el hueco del encabezado y de la barra. No toca la geometría. */
function fitViewPresent(maxZoom=2.5){
  /* el encaje se difiere un fotograma: si Present ya se cerró, la vista es del editor */
  if(!presenting) return;
  const r=$("wrap").getBoundingClientRect();
  if(r.width===0 || r.height===0) return;
  const b=getBounds();
  if(b.w<=0 || b.h<=0) return;
  const small=r.width<520;
  const side=small?12:32, top=presentHasStory()?(small?84:84):24, bottom=small?76:88;
  const aw=Math.max(40,r.width-side*2), ah=Math.max(40,r.height-top-bottom);
  viewZoom=clamp(Math.min(aw/b.w, ah/b.h), 0.05, maxZoom);
  viewX=side+(aw-b.w*viewZoom)/2 - b.x*viewZoom;
  viewY=top+(ah-b.h*viewZoom)/2 - b.y*viewZoom;
}
