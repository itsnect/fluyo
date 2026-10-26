"use strict";
/* FLUYO-I18N-001 / I18N-002 (S0) — Idioma de la INTERFAZ (no del documento).

   Qué traduce: solo el texto que pone Fluyo (botones, rótulos, avisos, ayudas). Nunca el contenido del documento —nombres
   de elementos, páginas, Historias, eventos, frases ni mensajes—, que se muestra tal y como lo escribió su autor.

   Cómo:
   · El español es el idioma BASE y vive donde siempre: en el código, como texto por defecto de cada llamada,
       FluyoI18n.t("present.exit", "Salir")
     y en el HTML, como texto del elemento marcado con data-i18n="clave" (o data-i18n-title, -aria-label, -tip,
     -placeholder para atributos). En español t() devuelve ese texto sin mirar ningún diccionario: la interfaz es la de
     siempre, byte a byte.
   · Los demás idiomas son diccionarios planos clave → texto en js/i18n-<idioma>.js (lo común: Viewer, Present, páginas
     públicas) y js/i18n-<idioma>-editor.js (solo el editor), que se suman en FLUYO_LOCALES.<idioma>. Todos los idiomas usan
     la misma forma; añadir uno = sus dos archivos, sus <script>, el precache de sw.js y una fila en LANGS.
   · Reserva: idioma elegido › inglés › español. Una clave que falta en el idioma elegido se anota (missing()) y se busca en
     inglés; si tampoco está, el texto base. Nunca se pinta una clave.
   · Una clave, un texto: test/fluyo-i18n-001.test.cjs y test/fluyo-i18n-002-s0.test.cjs exigen UN solo texto en español por
     clave, que ningún diccionario traiga claves que nadie usa, los mismos marcadores {param}, plurales con las categorías de
     su idioma, y que el texto sin migrar de cada archivo no crezca (trinquete).
   · Plurales: el texto puede ser {one, other…}; la forma se elige con Intl.PluralRules DEL IDIOMA DEL TEXTO que se usa
     (si el japonés cae al inglés, reglas inglesas) por params.count.

   Qué idioma: ?lang=xx en la URL (solo esta carga; mecanismo técnico) › preferencia guardada en este navegador
   (fluyo.ui.lang, como el tema de la interfaz) › idioma del sistema (navigator.languages) › español.
   El idioma del sistema solo elige idiomas PUBLICADOS (LANGS[].released): un idioma a medias nunca llega a nadie por
   detección. Primer idioma del sistema que esté publicado; si ninguno lo está, inglés si está publicado; si no, español.
   El test de catálogo solo deja publicar un idioma con su diccionario completo y la interfaz sin texto por migrar.
   El idioma de un documento compartido es otra decisión (FLUYO-I18N-001, D-LANG A, decisión 260): este módulo no lee ni
   escribe nada del documento.

   Cambio en vivo: setLocale() traduce el HTML marcado y avisa a quien se haya suscrito con onChange(fn), que repinta lo
   suyo (Viewer, Present, Historias). Sin recargar: se conservan la sesión, Deshacer y la reproducción.

   Sin DOM es puro (lo carga el editor, el Viewer y el 404; el kernel del MCP no). */

/* Los diccionarios se cargan ANTES que este archivo (js/i18n-<idioma>.js y js/i18n-<idioma>-editor.js). */
var FLUYO_LOCALES=(typeof FLUYO_LOCALES==="object" && FLUYO_LOCALES) || {};

const FluyoI18n=(()=>{
  const BASE="es";
  const FALLBACK="en";
  const STORAGE_KEY="fluyo.ui.lang";
  /* Idiomas de Fluyo, en el orden del selector. code: el del diccionario y de ?lang; tag: BCP 47 para <html lang>, Intl y
     :lang() en CSS (zh-Hans: la escritura importa para elegir los glifos Han); name: su nombre en su propio idioma, que
     nunca se traduce; released: se ofrece en el selector y por detección. */
  const LANGS=[
    {code:"es", tag:"es", name:"Español", released:true},
    {code:"en", tag:"en", name:"English", released:false},
    {code:"fr", tag:"fr", name:"Français", released:false},
    {code:"ja", tag:"ja", name:"日本語", released:false},
    {code:"zh", tag:"zh-Hans", name:"简体中文", released:false}
  ];
  const ATTRS=[["data-i18n-title","title"],["data-i18n-aria-label","aria-label"],["data-i18n-tip","data-tip"],["data-i18n-placeholder","placeholder"]];
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const missing=new Set();
  const listeners=new Set();
  let current=BASE;

  const entry=(code)=>LANGS.find(l=>l.code===code) || null;
  const loaded=(code)=>code===BASE || (has(FLUYO_LOCALES,code) && !!FLUYO_LOCALES[code]);
  /* Idiomas con diccionario cargado: los de LANGS en su orden y, detrás, cualquier otro diccionario (p. ej. el
     pseudo-idioma de los tests). */
  function supported(){
    const known=LANGS.map(l=>l.code).filter(loaded);
    return [...known, ...Object.keys(FLUYO_LOCALES).filter(c=>!known.includes(c) && loaded(c)).sort()];
  }
  function released(){ return LANGS.filter(l=>l.released && loaded(l.code)).map(l=>l.code); }
  /* Subetiqueta principal en minúsculas («zh-TW» → «zh», «EN_us» → «en»). */
  const primary=(tag)=>String(tag||"").trim().toLowerCase().split(/[-_]/)[0];
  function normalize(tag){
    const l=primary(tag);
    return l && supported().includes(l) ? l : null;
  }
  function tagOf(code){ const e=entry(code); return e ? e.tag : code; }
  /* El idioma del sistema, entre los publicados: es*→es, en*→en, fr*→fr, ja*→ja, zh*→zh (simplificado); otro → inglés. */
  function detect(languages){
    const list=(languages||[]).map(primary).filter(Boolean);
    if(!list.length) return null;
    const pub=released();
    const hit=list.find(l=>pub.includes(l));
    if(hit) return hit;
    return pub.includes(FALLBACK) ? FALLBACK : null;
  }
  /* El idioma de esta carga. env = {search, stored, languages}: sin tocar location ni localStorage, testeable. */
  function resolve(env={}){
    let fromUrl=null;
    try{ fromUrl=new URLSearchParams(env.search||"").get("lang"); }catch(e){}
    return normalize(fromUrl) || normalize(env.stored) || detect(env.languages) || BASE;
  }

  function pluralForm(text, params, lang){
    if(!text || typeof text!=="object") return text;
    const n=params && typeof params.count==="number" ? params.count : NaN;
    let cat="other";
    try{ cat=new Intl.PluralRules(tagOf(lang)).select(n); }catch(e){ cat=n===1 ? "one" : "other"; }
    return has(text,cat) ? text[cat] : text.other;
  }
  function format(text, params){
    if(!params) return text;
    return text.replace(/\{(\w+)\}/g, (m,k)=>has(params,k) ? String(params[k]) : m);
  }
  /* El texto de una clave en el idioma actual; `es` es el texto base (o {one, other}). Reserva: idioma › inglés › español.
     Lo que falta en el idioma actual se anota (missing()). */
  function t(key, es, params){
    let text=es, lang=BASE;
    if(current!==BASE){
      for(const l of current===FALLBACK ? [current] : [current, FALLBACK]){
        const dict=FLUYO_LOCALES[l];
        if(dict && has(dict,key)){ text=dict[key]; lang=l; break; }
      }
      if(lang!==current) missing.add(current+":"+key);
    }
    return format(String(pluralForm(text, params, lang)), params);
  }

  /* Números con el formato del idioma de la interfaz (separadores y decimales). */
  const numCache=new Map();
  function num(n, opts){
    const k=current+"|"+JSON.stringify(opts||{});
    try{
      if(!numCache.has(k)) numCache.set(k, new Intl.NumberFormat(tagOf(current), opts));
      return numCache.get(k).format(n);
    }catch(e){ return String(n); }
  }

  /* El texto PROPIO del elemento: su primer nodo de texto con letras, partido en marco (glifo y espacios de alrededor) y
     cuerpo: «▶ Reproducir historia» → «▶ » + «Reproducir historia». Se lee UNA vez, del HTML base; al cambiar de idioma solo
     cambia el cuerpo y el marco se conserva tal cual, así una traducción que empieza por puntuación («（Fluyo）») no se toma
     por un glifo al volver. La puntuación de apertura («¿», «¡», «“», «(»…) es del texto, no del marco: «¿Qué quieres
     compartir?» → «What do you want to share?» (FLUYO-I18N-002 S1). Los hijos (iconos, <span class="lblRest">) no se tocan. */
  const OWN=/^([^\p{L}\p{N}¿¡«“"'(\[]*)([\s\S]*?)(\s*)$/u;
  const LETTER=/[\p{L}\p{N}]/u;
  function ownText(el){
    for(const n of el.childNodes||[]){
      if(n.nodeType===3 && LETTER.test(n.data)){ const m=n.data.match(OWN); return {node:n, pre:m[1], body:m[2], post:m[3]}; }
    }
    return {node:null, pre:"", body:el.textContent||"", post:""};
  }
  function setOwnText(el, own, text){
    const kids=el.childNodes||[];
    /* el nodo base puede haberlo sustituido quien pinta desde JS: entonces, el primer nodo de texto con letras de ahora */
    if(!own.node || Array.prototype.indexOf.call(kids, own.node)<0) own.node=Array.prototype.find.call(kids, n=>n.nodeType===3 && LETTER.test(n.data)) || null;
    if(own.node){ own.node.data=own.pre+text+own.post; return; }
    if(!el.children || !el.children.length) el.textContent=own.pre+text+own.post;
  }
  /* Traduce lo marcado en el HTML. El texto base de cada elemento se lee UNA vez (la primera), así volver al español
     no necesita recargar. */
  const baseOf=new WeakMap();
  function base(el, name, read){
    let m=baseOf.get(el);
    if(!m){ m={}; baseOf.set(el,m); }
    if(!has(m,name)) m[name]=read();
    return m[name];
  }
  function applyDom(root){
    const d=root || (typeof document!=="undefined" ? document : null);
    if(!d || typeof d.querySelectorAll!=="function") return;
    if(d.documentElement) d.documentElement.lang=tagOf(current);
    for(const el of d.querySelectorAll("[data-i18n]")){
      const own=base(el, "", ()=>ownText(el));
      setOwnText(el, own, t(el.getAttribute("data-i18n"), own.body));
    }
    for(const [data,attr] of ATTRS){
      for(const el of d.querySelectorAll("["+data+"]")) el.setAttribute(attr, t(el.getAttribute(data), base(el, attr, ()=>el.getAttribute(attr)||"")));
    }
  }

  function readStored(){ try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; } }
  /* Quien pinta texto desde JS se suscribe y repinta lo suyo al cambiar de idioma. Devuelve la baja. */
  function onChange(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }
  /* Cambia el idioma de la interfaz. persist:true lo recuerda en este navegador (nunca en el documento). Lo marcado en el
     HTML se traduce ahora; lo que pinta JS, en el aviso a los suscritos. */
  function setLocale(lang, {persist=false}={}){
    const l=normalize(lang) || BASE;
    if(persist){ try{ localStorage.setItem(STORAGE_KEY, l); }catch(e){} }
    if(l===current) return current;
    current=l;
    applyDom();
    for(const fn of [...listeners]){ try{ fn(current); }catch(e){ if(typeof console!=="undefined") console.error(e); } }
    return current;
  }
  /* Para el selector: los idiomas de Fluyo con su nombre propio, si están publicados y si su diccionario está cargado. */
  function languages(){ return LANGS.map(l=>({code:l.code, tag:l.tag, name:l.name, released:l.released, available:loaded(l.code)})); }

  /* Arranque: el idioma de esta carga y, si no es el base, el HTML ya parseado (los <script> van al final del <body>). */
  try{
    current=resolve({
      search:typeof location!=="undefined" ? location.search : "",
      stored:readStored(),
      languages:typeof navigator!=="undefined" ? (navigator.languages || [navigator.language]) : []
    });
  }catch(e){ current=BASE; }
  if(current!==BASE) applyDom();

  return {
    BASE, FALLBACK, STORAGE_KEY, LANGS, t, num, resolve, detect, normalize, supported, released, languages, tagOf,
    applyDom, setLocale, onChange,
    locale:()=>current,
    tag:()=>tagOf(current),
    missing:()=>[...missing].sort()
  };
})();
