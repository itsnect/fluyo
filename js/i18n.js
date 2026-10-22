"use strict";
/* FLUYO-I18N-001 — Idioma de la INTERFAZ (no del documento).

   Qué traduce: solo el texto que pone Fluyo (botones, rótulos, avisos, ayudas). Nunca el contenido del documento —nombres
   de elementos, páginas, Historias, eventos, frases ni mensajes—, que se muestra tal y como lo escribió su autor.

   Cómo:
   · El español es el idioma BASE y vive donde siempre: en el código, como texto por defecto de cada llamada,
       FluyoI18n.t("present.exit", "Salir")
     y en el HTML, como texto del elemento marcado con data-i18n="clave" (o data-i18n-title, -aria-label, -tip,
     -placeholder para atributos). En español t() devuelve ese texto sin mirar ningún diccionario: la interfaz es la de
     siempre, byte a byte.
   · Los demás idiomas son un diccionario plano clave → texto en js/i18n-<idioma>.js (FLUYO_LOCALES.<idioma>).
     Añadir un idioma = un archivo más y su <script>; nada de esta parte cambia.
   · Una clave, un texto: test/fluyo-i18n-001.test.cjs exige que cada clave tenga UN solo texto en español en todo el
     código y el HTML, que cada idioma tenga todas las claves (ni una más) con los mismos marcadores {param}, y que la
     cantidad de texto sin migrar de cada archivo no crezca (trinquete).
   · Plurales: el texto por defecto puede ser {one, other} y se elige con Intl.PluralRules por params.count.

   Qué idioma: ?lang=xx en la URL (solo esta carga) › preferencia guardada en este navegador (fluyo.ui.lang, como el tema
   de la interfaz) › español. La detección por navigator.language queda APAGADA (AUTO_DETECT) mientras la traducción no
   esté completa: hoy nadie ve una interfaz a medias sin pedirla. El idioma de un documento compartido es otra decisión
   (FLUYO-I18N-001, D-LANG): este módulo no lee ni escribe nada del documento.

   Sin DOM es puro (lo carga el editor y el Viewer; el kernel del MCP no). */

/* Los diccionarios se cargan ANTES que este archivo (js/i18n-<idioma>.js). */
var FLUYO_LOCALES=(typeof FLUYO_LOCALES==="object" && FLUYO_LOCALES) || {};

const FluyoI18n=(()=>{
  const BASE="es";
  const STORAGE_KEY="fluyo.ui.lang";
  const AUTO_DETECT=false;
  const ATTRS=[["data-i18n-title","title"],["data-i18n-aria-label","aria-label"],["data-i18n-tip","data-tip"],["data-i18n-placeholder","placeholder"]];
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const missing=new Set();
  let current=BASE;

  function supported(){ return [BASE, ...Object.keys(FLUYO_LOCALES).filter(l=>l!==BASE).sort()]; }
  function normalize(tag){
    const l=String(tag||"").trim().toLowerCase().split(/[-_]/)[0];
    return supported().includes(l) ? l : null;
  }
  /* El idioma de esta carga. env = {search, stored, languages}: sin tocar location ni localStorage, testeable. */
  function resolve(env={}){
    let fromUrl=null;
    try{ fromUrl=new URLSearchParams(env.search||"").get("lang"); }catch(e){}
    const auto=AUTO_DETECT ? (env.languages||[]).map(normalize).find(Boolean) : null;
    return normalize(fromUrl) || normalize(env.stored) || auto || BASE;
  }

  function pluralForm(text, params){
    if(!text || typeof text!=="object") return text;
    const n=params && typeof params.count==="number" ? params.count : NaN;
    let cat="other";
    try{ cat=new Intl.PluralRules(current).select(n); }catch(e){ cat=n===1 ? "one" : "other"; }
    return has(text,cat) ? text[cat] : text.other;
  }
  function format(text, params){
    if(!params) return text;
    return text.replace(/\{(\w+)\}/g, (m,k)=>has(params,k) ? String(params[k]) : m);
  }
  /* El texto de una clave en el idioma actual; `es` es el texto base (o {one, other}). Una clave sin traducción se
     anota (missing()) y cae al español: nunca se pinta una clave. */
  function t(key, es, params){
    let text=es;
    if(current!==BASE){
      const dict=FLUYO_LOCALES[current];
      if(dict && has(dict,key)) text=dict[key];
      else missing.add(current+":"+key);
    }
    return format(String(pluralForm(text, params)), params);
  }

  /* El texto PROPIO del elemento: su primer nodo de texto con letras, conservando el glifo y los espacios de alrededor
     («▶ Reproducir historia»); sus hijos (iconos, <span class="lblRest">) no se tocan. */
  const OWN=/^([^\p{L}\p{N}]*)([\s\S]*?)(\s*)$/u;
  function setOwnText(el, text){
    for(const n of el.childNodes||[]){
      if(n.nodeType===3 && /[\p{L}\p{N}]/u.test(n.data)){ n.data=n.data.replace(OWN, (m,pre,body,post)=>pre+text+post); return; }
    }
    if(!el.children || !el.children.length) el.textContent=text;
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
    if(d.documentElement) d.documentElement.lang=current;
    for(const el of d.querySelectorAll("[data-i18n]")) setOwnText(el, t(el.getAttribute("data-i18n"), base(el, "", ()=>textOf(el))));
    for(const [data,attr] of ATTRS){
      for(const el of d.querySelectorAll("["+data+"]")) el.setAttribute(attr, t(el.getAttribute(data), base(el, attr, ()=>el.getAttribute(attr)||"")));
    }
  }
  function textOf(el){
    for(const n of el.childNodes||[]) if(n.nodeType===3 && /[\p{L}\p{N}]/u.test(n.data)) return n.data.replace(OWN, "$2");
    return el.textContent||"";
  }

  function readStored(){ try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; } }
  /* Cambia el idioma de la interfaz. persist:true lo recuerda en este navegador (nunca en el documento). Lo que pinta
     JS se pone al día en su siguiente refresco; lo marcado en el HTML, ahora. */
  function setLocale(lang, {persist=false}={}){
    const l=normalize(lang) || BASE;
    if(persist){ try{ localStorage.setItem(STORAGE_KEY, l); }catch(e){} }
    if(l===current) return current;
    current=l;
    applyDom();
    return current;
  }

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
    BASE, STORAGE_KEY, t, resolve, normalize, supported, applyDom, setLocale,
    locale:()=>current,
    missing:()=>[...missing].sort()
  };
})();
