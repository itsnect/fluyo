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
/* ready | playing | paused | finished | none. «paused» es la Historia reproduciéndose con el reloj congelado
   (FLUYO-018.18, story-clock.js): mismo Playback, mismo scStatus. */
function presentPhase(){
  if(!presentHasStory()) return "none";
  if(typeof scStatus==="undefined") return "ready";
  if(scStatus==="running") return (typeof scIsPaused==="function" && scIsPaused()) ? "paused" : "playing";
  return scStatus==="completed" ? "finished" : "ready";
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
/* Pausar/Reanudar y los momentos anterior/siguiente: los MISMOS que el editor (editor-scenarios.js), sin segunda receta. */
function presentTogglePause(){ if(presenting && typeof scTogglePause==="function") scTogglePause(); presentStoryRefresh(); }
function presentPrevMoment(){ if(presenting && typeof scPrevMoment==="function") scPrevMoment(); presentStoryRefresh(); }
function presentNextMoment(){ if(presenting && typeof scNextMoment==="function") scNextMoment(); presentStoryRefresh(); }

/* Glifo (▶ ■ ↻) como texto accesible pintado con el trazo del sistema, y el rótulo, en UN elemento en línea: el texto del
   botón (y su innerText) sigue siendo «▶ Reproducir» aunque el botón sea flex (FLUYO-018.18). */
function psGlyph(id, glyph, cls, label){
  const el=$(id); if(!el) return;
  if(typeof el.replaceChildren!=="function" || typeof document.createTextNode!=="function"){ el.textContent=glyph+" "+label; return; }
  const w=document.createElement("span"), g=document.createElement("span");
  w.className="glyphText"; g.className="glyph "+cls; g.textContent=glyph; g.setAttribute("aria-hidden","true");
  w.append(g, document.createTextNode(" "+label)); el.replaceChildren(w);
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
  const dphase=phase==="paused" ? "playing" : phase;
  const sc=has?scActiveScenario():null;
  const pages=doc.pages.length;

  /* controles de la barra: páginas y Historia son dos grupos separados; la salida es una sola (✕ Salir) */
  psSet("prPages","hidden",pages<2);
  psSet("psGroup","hidden",!has);
  const moving=phase==="playing" || phase==="paused";
  psSet("psPlay","hidden",!has || moving);
  if(psLast["psPlay.glyph"]!==phase){
    psLast["psPlay.glyph"]=phase;
    psGlyph("psPlay", phase==="finished"?"↻":"▶", phase==="finished"?"g-replay":"g-play", phase==="finished"?"Repetir":"Reproducir");
  }
  psSet("psPause","hidden",!moving);
  if(moving && typeof scSetPauseLabel==="function") scSetPauseLabel($("psPause"), phase==="paused");
  const nav=typeof scMomentNav==="function" ? scMomentNav() : {prev:null, next:null};
  psSet("psPrev","hidden",!has || phase==="ready");
  psSet("psNext","hidden",!has || phase==="ready");
  psSet("psPrev","disabled",nav.prev===null);
  psSet("psNext","disabled",nav.next===null);
  psSet("psStop","hidden",!has || phase==="ready");
  if(psLast["psStop.glyph"]!==1){ psLast["psStop.glyph"]=1; psGlyph("psStop","■","g-stop","Detener"); }
  psSet("presentBar","className", phase==="playing" ? "" : "psAttention");

  /* encabezado de la historia */
  psSet("presentStory","hidden",!has && !scErrors.length);
  if(!has){
    psSet("psTitle","text","");
    psSet("psDots","hidden",true);
    psSet("psCaption","text","");
    psSet("psSummary","text","");
    psSet("psFlow","hidden",true);
    return;
  }
  /* FLUYO-018.21: el momento en curso según su instante VISIBLE (dependencias de llegada, story-clock.js) */
  const d=(typeof FluyoStoryClock!=="undefined" ? FluyoStoryClock : FluyoStory).describe(dphase, sc, scPlayback, id=>scNodeFallback(id), id=>edgeById(id));
  const ms=d.moments, idx=d.idx;

  psSet("psTitle","text", d.title);
  psSet("psTitle","className", "psTitle "+(phase==="ready"?"psTitleReady":""));

  /* progreso: puntos si caben; si no, «n / total» */
  const dots=$("psDots");
  const useDots=ms.length>1 && ms.length<=FluyoPresentStory.MAX_DOTS;
  const sig=ms.length+"|"+idx+"|"+useDots+"|"+dphase;
  if(psLast.dots!==sig){
    psLast.dots=sig;
    dots.textContent="";
    dots.hidden=ms.length<2;
    if(useDots){
      ms.forEach((m,i)=>{
        const d=document.createElement("span");
        d.className="psDot"+(i<=idx?" done":"")+(i===idx&&dphase==="playing"?" now":"");
        d.title=m.label||"";
        dots.appendChild(d);
      });
    } else if(ms.length>1){
      dots.textContent=Math.max(0,idx+1)+" / "+ms.length;
    }
  }

  /* mensaje: consecuencia vigente o cierre */
  let cap=d.caption, sum=d.summary;
  if(dphase!=="playing" && dphase!=="finished" && scErrors.length) cap=scErrors[0];
  if(phase==="paused") cap=cap ? "En pausa · "+cap : "En pausa";
  psSet("psCaption","text",cap);
  psSet("psSummary","text",sum);
  /* SCENARIOS-SEMANTICS-001 FASE 5 (D8, decisión 246): la línea de estado de la ruta observada, en el rótulo (la fila de controles no
     cambia). La MISMA línea que la herramienta del editor, solo reproduciendo (también en pausa y terminada) y con par. */
  const route=dphase!=="ready" && typeof scFlowPresentLine==="function" ? scFlowPresentLine() : null;
  psSet("psFlow","hidden",!route);
  if(route){ psSet("psFlow","text",route.text); psSet("psFlow","className","psFlow is"+route.status); }
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
  /* el mando puede ocupar dos filas en vertical (Historia y páginas, FLUYO-018.18): se reserva su alto real */
  const bar=$("presentBar"), barH=bar && bar.offsetHeight ? bar.offsetHeight+28 : 0;
  const side=small?12:32, top=presentHasStory()?(small?84:84):24, bottom=Math.max(small?76:88, barH);
  const aw=Math.max(40,r.width-side*2), ah=Math.max(40,r.height-top-bottom);
  viewZoom=clamp(Math.min(aw/b.w, ah/b.h), 0.05, maxZoom);
  viewX=side+(aw-b.w*viewZoom)/2 - b.x*viewZoom;
  viewY=top+(ah-b.h*viewZoom)/2 - b.y*viewZoom;
}
