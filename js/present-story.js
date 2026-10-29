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
    psGlyph("psPlay", phase==="finished"?"↻":"▶", phase==="finished"?"g-replay":"g-play", phase==="finished"?FluyoI18n.t("story.replay","Repetir"):FluyoI18n.t("story.play","Reproducir"));
  }
  psSet("psPause","hidden",!moving);
  if(moving && typeof scSetPauseLabel==="function") scSetPauseLabel($("psPause"), phase==="paused");
  const nav=typeof scMomentNav==="function" ? scMomentNav() : {prev:null, next:null};
  psSet("psPrev","hidden",!has || phase==="ready");
  psSet("psNext","hidden",!has || phase==="ready");
  psSet("psPrev","disabled",nav.prev===null);
  psSet("psNext","disabled",nav.next===null);
  psSet("psStop","hidden",!has || phase==="ready");
  if(psLast["psStop.glyph"]!==1){ psLast["psStop.glyph"]=1; psGlyph("psStop","■","g-stop",FluyoI18n.t("story.stop","Detener")); }
  psSet("presentBar","className", phase==="playing" ? "" : "psAttention");

  /* encabezado de la historia */
  psSet("presentStory","hidden",!has && !scErrors.length);
  if(!has){
    psSet("psTitle","text","");
    psSet("psDots","hidden",true);
    psSet("psCaption","text","");
    psSet("psOutcome","text","");
    psSet("psSummary","text","");
    psSet("psFlow","hidden",true);
    return;
  }
  /* FLUYO-018.21: el momento en curso según su instante VISIBLE (dependencias de llegada, story-clock.js) */
  const d=(typeof FluyoStoryClock!=="undefined" ? FluyoStoryClock : FluyoStory).describe(dphase, sc, scPlayback, id=>scNodeFallback(id), id=>edgeById(id), FluyoI18n.t);
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
  if(phase==="paused") cap=cap ? FluyoI18n.t("story.pausedCaption","En pausa · {caption}",{caption:cap}) : FluyoI18n.t("story.paused","En pausa");
  psSet("psCaption","text",cap);
  /* FLUYO-STORIES-2.0 S1b: el desenlace, solo terminada (FluyoStoryClock.outcomeLine, el mismo del Viewer y el editor) */
  psSet("psOutcome","text",typeof FluyoStoryClock!=="undefined" ? FluyoStoryClock.outcomeLine(dphase, sc, scPlayback, FluyoI18n.t) : "");
  psSet("psSummary","text",sum);
  /* SCENARIOS-SEMANTICS-001 FASE 5 (D8, decisión 246): la línea de estado de la ruta observada, en el rótulo (la fila de controles no
     cambia). La MISMA línea que la herramienta del editor, solo reproduciendo (también en pausa y terminada) y con par. */
  const route=dphase!=="ready" && typeof scFlowPresentLine==="function" ? scFlowPresentLine() : null;
  psSet("psFlow","hidden",!route);
  if(route){ psSet("psFlow","text",route.text); psSet("psFlow","className","psFlow is"+route.status); }
}

/* FLUYO-018.29 (R1): borde inferior del encabezado en su forma MÁS ALTA, medido (0 si no hay encabezado). Lista, el encabezado
   no tiene aún mensaje, cierre ni línea de la ruta; reproduciendo y terminada, sí (la ruta, decisión 246). Para que Reproducir no
   tape la fila de arriba ni obligue a reencajar, se mide con esas filas desde el inicio: el mensaje y el cierre de «terminada»
   (los del mismo modelo, FluyoStory.describe, sobre el Trace de la Historia: el cierre solo existe si algún envío falla) y la
   línea de la ruta, si la Historia la tiene. Son filas sonda (mismas clases, aria-hidden), puestas y quitadas en la misma
   tarea: nunca se pintan. Un mensaje de consecuencia más largo que una línea no se reserva (no se conoce hasta reproducir).
   PRODUCT-NARRATION-001 (decisión 258): el título de un momento narrado puede ser la frase del autor (hasta 120 caracteres) y ocupar
   más de una línea; se mide también con el título narrado MÁS LARGO de la Historia puesto un instante en #psTitle (y se devuelve el
   suyo). Una Historia sin frases se mide como siempre. */
function presentHeaderBottom(){
  const ps=$("presentStory");
  if(!ps || ps.hidden || !ps.offsetHeight) return 0;
  const probes=[];
  const probe=(cls, text)=>{ const el=document.createElement("div"); el.className=cls; el.textContent=text; el.setAttribute("aria-hidden","true"); ps.appendChild(el); probes.push(el); };
  const sc=presentHasStory() ? scActiveScenario() : null, run=sc ? FluyoStory.run(P(), sc) : null;
  const end=run && run.ok ? FluyoStory.describe("finished", sc, {logEvents:run.trace.events, cursorVirtual:0}, ()=>"", ()=>null, FluyoI18n.t) : null;
  if(!$("psCaption").textContent) probe("psCaption", end ? end.caption : FluyoI18n.t("story.paused","En pausa"));
  /* S1b: la fila del desenlace también se reserva (siempre la hay al terminar una Historia con pasos) */
  const outcome=run && run.ok && typeof FluyoStoryClock!=="undefined" ? FluyoStoryClock.outcomeText(FluyoStoryClock.outcome(sc, run.trace), FluyoI18n.t) : "";
  if(outcome && !$("psOutcome").textContent) probe("psOutcome", outcome);
  if(end && end.summary && !$("psSummary").textContent) probe("psSummary", end.summary);
  const route=$("psFlow").hidden && sc && typeof scFlowPresentLine==="function" ? scFlowPresentLine() : null;
  if(route) probe("psFlow is"+route.status, route.text);
  const title=$("psTitle"), own=title.textContent;
  const longest=end ? end.moments.reduce((a, m)=>m.narrated && (m.label||"").length>a.length ? m.label : a, own) : own;
  if(longest!==own) title.textContent=longest;
  const bottom=ps.getBoundingClientRect().bottom;
  if(longest!==own) title.textContent=own;
  for(const el of probes) el.remove();
  return bottom;
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
  /* el encabezado y el mando se miden con lo que ya muestra ESTA página (al cambiar de diapositiva aún tenían la anterior) */
  presentStoryRefresh();
  /* el mando puede ocupar dos filas en vertical (Historia y páginas, FLUYO-018.18): se reserva su alto real */
  const bar=$("presentBar"), barH=bar && bar.offsetHeight ? bar.offsetHeight+28 : 0;
  /* FLUYO-018.29 (R1): el encabezado, por su alto real en su forma más alta (la caja del diagrama ya lleva su aire, getBounds) */
  const side=small?12:32, top=Math.max(24, presentHeaderBottom()-r.top), bottom=Math.max(small?76:88, barH);
  const aw=Math.max(40,r.width-side*2), ah=Math.max(40,r.height-top-bottom);
  viewZoom=clamp(Math.min(aw/b.w, ah/b.h), 0.05, maxZoom);
  viewX=side+(aw-b.w*viewZoom)/2 - b.x*viewZoom;
  viewY=top+(ah-b.h*viewZoom)/2 - b.y*viewZoom;
}

/* FLUYO-I18N-002 (S0): cambiar de idioma en vivo. Lo marcado en el HTML ya lo traduce FluyoI18n; aquí se repinta lo que pone JS
   en Present (mando, encabezado, botón de aspecto) y el transporte de Historias. Lo demás del editor se suscribe al migrarlo
   (S1–S3). La sesión, Deshacer y la reproducción siguen igual; el documento no cambia. */
if(typeof FluyoI18n==="object") FluyoI18n.onChange(()=>{
  psLast={};
  presentStoryRefresh();
  /* fuera de Present el mando está oculto y presentStoryRefresh no lo pinta: sus dos glifos, al día para la próxima vez */
  if(!presenting){ psGlyph("psPlay","▶","g-play",FluyoI18n.t("story.play","Reproducir")); psGlyph("psStop","■","g-stop",FluyoI18n.t("story.stop","Detener")); }
  if(typeof syncPresentSkinButton==="function") syncPresentSkinButton();
  if(typeof scRenderButtons==="function") scRenderButtons();
});
