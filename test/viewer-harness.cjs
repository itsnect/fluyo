"use strict";
/* Harness compartido de tests viewer/Share; no registra tests. */
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const {CompressionStream,DecompressionStream}=require("node:stream/web");
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const VIEWER_SCRIPTS=[
  'js/config.js','js/safe-svg.js','js/model.js','js/link-codec.js','js/geometry.js','js/render.js',
  'js/analytics.js','js/share-loader.js','js/viewer-viewport.js','js/viewer.js'
];
const FORBIDDEN_SCRIPTS=['state.js','editor-runtime.js','selection.js','interaction.js','ui.js','export.js','deeplink.js','examples.js','editor-analytics.js'];
const FORBIDDEN_GLOBALS=['newNode','newEdge','pushUndo','undo','redo','copySel','pasteClip','pasteSel','clearSel','setMode','scheduleAutosave','saveAutosave','clearAutosave','applyProjectData','presentIncomingDocument','exportStatic','exportSVG','exportGIF','buildSVGDocument','syncEditBoxIfMoved','buildEditorRenderState','renderEditorFrame','loadDeepLinkFromURL'];

/* ─────────────────────────── Harness ─────────────────────────── */

function makeViewer({hostname='fluyo.space', pathname='/s/', search='?s=demo', hash=''}={}){
  const events=[], scripts=[], ops=[];
  let simTime=0;

  const ctxMock=new Proxy({},{
    get(_t, prop){
      if(prop==='measureText') return s=>({width:String(s??'').length*8});
      if(prop==='canvas') return {width:800, height:600};
      return (...args)=>{ ops.push([String(prop), ...args]); };
    },
    set(){ return true; }
  });

  const documentListeners={};
  const elements={};
  function makeElement(id){
    const listeners={};
    return {
      id, style:{}, dataset:{}, children:[],
      textContent:'', hidden:false, disabled:false,
      className:'', value:'', checked:false,
      classList:{ _s:new Set(),
        add(c){ this._s.add(c); },
        remove(c){ this._s.delete(c); },
        toggle(c,f){ f? this._s.add(c) : this._s.delete(c); },
        contains(c){ return this._s.has(c); } },
      setAttribute(){}, getAttribute(){ return null; },
      appendChild(c){ this.children.push(c); return c; },
      addEventListener(t,cb){ (listeners[t] ||= []).push(cb); },
      removeEventListener(){},
      dispatch(t,ev){ for(const cb of listeners[t]||[]) cb(ev); },
      hasListener:t=>!!listeners[t],
      getBoundingClientRect:()=>({width:800, height:600, left:0, top:0}),
      getContext:()=>ctxMock,
      setPointerCapture(){}, releasePointerCapture(){},
      width:800, height:600, onclick:null
    };
  }
  const document={
    readyState:'loading',
    getElementById:id=>elements[id] ||= makeElement(id),
    createElement:()=>makeElement(''),
    addEventListener(t,cb){ (documentListeners[t] ||= []).push(cb); },
    body:null,
    documentElement:{ requestFullscreen:()=>Promise.resolve() },
    head:{ appendChild:s=>scripts.push(s) },
    fullscreenElement:null
  };
  document.body=makeElement('body');
  elements.body=document.body;
  const location={hostname, pathname, search, hash, href:'https://fluyo.space'+pathname+search+hash};
  const rafCallbacks=new Map();let rafSequence=0;
  const windowListeners={};
  const context=vm.createContext({
    console, location, document, window:{addEventListener:(type,cb)=>{(windowListeners[type] ||= []).push(cb);}},
    performance:{ now:()=>simTime },
    requestAnimationFrame:cb=>{rafCallbacks.set(++rafSequence,cb);return rafSequence;},
    cancelAnimationFrame:id=>rafCallbacks.delete(id),
    TextEncoder, TextDecoder, CompressionStream, DecompressionStream, atob, btoa, URL, URLSearchParams
  });
  const run=code=>vm.runInContext(code, context);
  for(const f of VIEWER_SCRIPTS) run(read(f));

  const flush=async(n=6)=>{ for(let i=0;i<n;i++) await new Promise(setImmediate); };
  const frames=n=>{ for(let i=0;i<n;i++){ const callbacks=[...rafCallbacks.values()];rafCallbacks.clear();for(const cb of callbacks) cb(simTime); } };
  const navigate=async hash=>{
    const before=location.hash;location.hash=hash;location.href='https://'+hostname+pathname+search+hash;
    if(before!==hash) for(const cb of windowListeners.hashchange||[]) cb();
    await flush();
  };
  const advance=ms=>{ simTime+=ms; };
  const connect=()=>{ context.window.umami={track:(name,props)=>events.push({name,props})}; scripts[0]?.onload(); };
  const boot=async()=>{ for(const cb of documentListeners.DOMContentLoaded||[]) cb(); await flush(); };
  const el=id=>elements[id];
  const key=ev=>{ for(const cb of documentListeners.keydown||[]) cb(Object.assign({preventDefault(){}}, ev)); };
  const wheel=ev=>el('sv').dispatch('wheel', Object.assign({preventDefault(){}, deltaX:0, deltaY:0, ctrlKey:false, metaKey:false, clientX:400, clientY:300}, ev));

  const waitForPhase=async(predicate, timeoutMs=2000)=>{
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      const phase=context.window.__viewer?.phase;
      if(predicate(phase)) return phase;
      await new Promise(setImmediate);
    }
    throw new Error('timeout waiting for viewer phase; last='+context.window.__viewer?.phase);
  };
  return {context, run, events, scripts, ops, flush, frames, advance, connect, boot, el, key, wheel,navigate,waitForPhase,
    pendingFrames:()=>rafCallbacks.size,
    viewer:()=>context.window.__viewer,
    names:()=>events.map(e=>e.name)};
}


module.exports={makeViewer,read,VIEWER_SCRIPTS,FORBIDDEN_SCRIPTS,FORBIDDEN_GLOBALS};
