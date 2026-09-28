"use strict";
/* Frontera pura de imágenes del documento. SVG estático reconstruido desde
   una lista cerrada, sin DOM, CSS arbitrario, DTD ni recursos externos.
   No se interpreta el XML original como HTML y no se confía sólo en su MIME. */
function imageDataError(){const e=new Error("invalid_document");e.code="invalid_document";return e;}
const SVG_STATIC_TAGS=new Set("svg g defs symbol use marker rect circle ellipse line polyline polygon path text tspan title desc linearGradient radialGradient stop clipPath mask pattern image".split(" "));
const SVG_NUMERIC_ATTRS=new Set("x y x1 y1 x2 y2 cx cy r rx ry width height dx dy viewBox points opacity fill-opacity stroke-opacity stop-opacity stroke-width stroke-miterlimit stroke-dasharray stroke-dashoffset font-size letter-spacing word-spacing offset fx fy fr startOffset refX refY markerWidth markerHeight textLength".split(" "));
const SVG_PAINT_ATTRS=new Set(["fill","stroke","color","stop-color"]);
const SVG_ENUM_ATTRS=new Set("fill-rule clip-rule stroke-linecap stroke-linejoin text-anchor dominant-baseline font-weight font-style preserveAspectRatio gradientUnits spreadMethod clipPathUnits maskUnits maskContentUnits patternUnits patternContentUnits vector-effect display visibility".split(" "));
function svgXMLText(value){
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function svgUnescape(value){
  // Sólo las entidades XML predefinidas/números; rechazar todo lo demás.
  if(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(value)) throw imageDataError();
  const decoded=value.replace(/&([^;]+);/g,(_,entity)=>{
    const named={amp:"&",lt:"<",gt:">",quot:'"',apos:"'"};
    if(Object.prototype.hasOwnProperty.call(named,entity)) return named[entity];
    const n=entity.startsWith("#x")?parseInt(entity.slice(2),16):Number(entity.slice(1));
    if(!Number.isInteger(n)||n<32&&![9,10,13].includes(n)||n>0x10ffff||n>=0xd800&&n<=0xdfff||n===0xfffe||n===0xffff) throw imageDataError();
    return String.fromCodePoint(n);
  });
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(decoded)) throw imageDataError();
  return decoded;
}
function safeSVGAttribute(tag,name,value,depth){
  if(name==="xmlns"){
    if(value!=="http://www.w3.org/2000/svg") throw imageDataError();
  }else if(name==="xmlns:xlink"){
    if(value!=="http://www.w3.org/1999/xlink") throw imageDataError();
  }else if(name==="id"){
    if(!/^[A-Za-z_][\w.-]*$/.test(value)) throw imageDataError();
  }else if(name==="href" || name==="xlink:href"){
    if(tag==="image") value=normalizeDocumentImage(value,depth+1);
    else if(tag!=="use" || !/^#[A-Za-z_][\w.-]*$/.test(value)) throw imageDataError();
    name="href";
  }else if(SVG_NUMERIC_ATTRS.has(name)){
    const numbers=value.trim().split(/[\s,]+/);
    if(!["none","normal","auto"].includes(value) && numbers.some(number=>!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?(?:%|px|em|ex|in|cm|mm|pt|pc)?$/.test(number))) throw imageDataError();
  }else if(SVG_PAINT_ATTRS.has(name)){
    if(!/^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+|context-stroke|context-fill|(?:rgb|rgba|hsl|hsla)\([-+0-9.% ,]+\)|url\(\s*#[A-Za-z_][\w.-]*\s*\))$/.test(value)) throw imageDataError();
  }else if(["clip-path","mask","marker-start","marker-mid","marker-end"].includes(name)){
    if(!/^(?:none|url\(\s*#[A-Za-z_][\w.-]*\s*\))$/.test(value)) throw imageDataError();
  }else if(name==="orient"){
    if(!/^(?:auto|auto-start-reverse|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:deg|rad|grad|turn)?)$/.test(value)) throw imageDataError();
  }else if(name==="markerUnits"){
    if(!["strokeWidth","userSpaceOnUse"].includes(value)) throw imageDataError();
  }else if(name==="lengthAdjust"){
    if(!["spacing","spacingAndGlyphs"].includes(value)) throw imageDataError();
  }else if(name==="transform" || name==="gradientTransform" || name==="patternTransform"){
    if(!/^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([-+0-9.eE,\s]+\)\s*)+$/.test(value)) throw imageDataError();
  }else if(name==="d"){
    if(!/^[-+0-9.eE,\sMmZzLlHhVvCcSsQqTtAa]*$/.test(value)) throw imageDataError();
  }else if(name==="font-family"){
    if(!/^[\w\s,'"-]+$/.test(value)) throw imageDataError();
  }else if(SVG_ENUM_ATTRS.has(name)){
    if(!/^[a-zA-Z0-9\s.,%+-]+$/.test(value)) throw imageDataError();
  }else throw imageDataError(); // Incluye on*, scripts, CSS y atributos desconocidos.
  return [name,value];
}
function sanitizeStaticSVG(source,depth=0){
  let at=0,root=false,closed=false;const stack=[],output=[];
  const text=value=>{
    if(value.trim() && !["text","tspan","title","desc"].includes(stack.at(-1))) throw imageDataError();
    output.push(svgXMLText(value));
  };
  while(at<source.length){
    if(source[at]!=="<"){
      const end=source.indexOf("<",at);const next=end<0?source.length:end;
      text(svgUnescape(source.slice(at,next)));at=next;continue;
    }
    if(source.startsWith("<!--",at)){
      const end=source.indexOf("-->",at+4);
      if(end<0 || source.slice(at+4,end).includes("--")) throw imageDataError();
      at=end+3;continue;
    }
    if(source.startsWith("<?xml ",at) && !root && !source.slice(0,at).trim()){
      const end=source.indexOf("?>",at);if(end<0) throw imageDataError();at=end+2;continue;
    }
    if(source.startsWith("<![CDATA[",at)){
      const end=source.indexOf("]]>",at+9);if(end<0) throw imageDataError();
      text(source.slice(at+9,end));at=end+3;continue;
    }
    const endTag=/^<\/([A-Za-z][A-Za-z0-9]*)\s*>/.exec(source.slice(at));
    if(endTag){
      if(stack.pop()!==endTag[1]) throw imageDataError();
      output.push("</"+endTag[1]+">");at+=endTag[0].length;if(!stack.length) closed=true;continue;
    }
    const start=/^<([A-Za-z][A-Za-z0-9]*)/.exec(source.slice(at));
    if(!start || closed || !SVG_STATIC_TAGS.has(start[1])) throw imageDataError();
    const tag=start[1];if(!root && tag!=="svg") throw imageDataError();
    const attributes=new Map(),styles=new Map(),seen=new Set();at+=start[0].length;
    for(;;){
      const rest=source.slice(at),ws=/^\s*/.exec(rest)[0];at+=ws.length;
      if(source.startsWith("/>",at)||source[at]===">") break;
      if(!ws.length) throw imageDataError();
      const attr=/^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"<]*"|'[^'<]*')/.exec(source.slice(at));
      if(!attr || seen.has(attr[1])) throw imageDataError();
      seen.add(attr[1]);
      const value=svgUnescape(attr[2].slice(1,-1));
      if(attr[1]==="style"){
        // Sólo declaraciones estáticas conocidas, convertidas a atributos.
        for(const declaration of value.split(";")){
          if(!declaration.trim()) continue;
          const pair=/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/.exec(declaration);
          if(!pair || !(SVG_PAINT_ATTRS.has(pair[1])||SVG_NUMERIC_ATTRS.has(pair[1])||SVG_ENUM_ATTRS.has(pair[1])||["font-family","clip-path","mask"].includes(pair[1]))) throw imageDataError();
          const [name,clean]=safeSVGAttribute(tag,pair[1],pair[2],depth);styles.set(name,clean);
        }
      }else{
        const [name,clean]=safeSVGAttribute(tag,attr[1],value,depth);
        // El exportador emite href y xlink:href idénticos por compatibilidad.
        // Conservar sólo href; aliases contradictorios siguen siendo inválidos.
        if(attributes.has(name) && (name!=="href" || attributes.get(name)!==clean)) throw imageDataError();attributes.set(name,clean);
      }
      at+=attr[0].length;
    }
    for(const [name,value] of styles) attributes.set(name,value);
    if(!root){attributes.set("xmlns","http://www.w3.org/2000/svg");root=true;}
    attributes.delete("xmlns:xlink"); // href normalizado: no namespaces ajenos.
    const selfClosing=source.startsWith("/>",at);at+=selfClosing?2:1;
    output.push("<"+tag+[...attributes].map(([name,value])=>' '+name+'="'+svgXMLText(value)+'"').join("")+(selfClosing?"/>":">"));
    if(!selfClosing) stack.push(tag);else if(!stack.length) closed=true;
  }
  if(!root||!closed||stack.length) throw imageDataError();
  return output.join("").trim();
}
function normalizeRasterImage(uri){
  const match=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
  if(!match) throw imageDataError();
  let bytes;try{bytes=atob(match[2]);}catch{throw imageDataError();}
  const valid=match[1]==="png"?bytes.startsWith("\x89PNG\r\n\x1a\n"):
    match[1]==="jpeg"?bytes.startsWith("\xff\xd8\xff"):
    match[1]==="gif"?/^GIF8[79]a/.test(bytes):bytes.startsWith("RIFF")&&bytes.slice(8,12)==="WEBP";
  if(!valid) throw imageDataError();
  return uri;
}
function normalizeDocumentImage(uri,depth=0){
  if(!/^data:image\/svg\+xml(?:;|,)/i.test(uri)) return normalizeRasterImage(uri);
  // Un SVG exportado puede contener iconos o imágenes SVG locales. Reconstruir
  // cada nivel con la misma frontera; acotar anidación antes de decodificar.
  if(depth>=8) throw imageDataError();
  const match=/^data:image\/svg\+xml(?:;charset=utf-8)?(?:(;base64)|;utf8)?,(.*)$/is.exec(uri);
  if(!match) throw imageDataError();
  let source;
  try{
    source=match[1]?new TextDecoder("utf-8",{fatal:true}).decode(Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))):decodeURIComponent(match[2]);
  }catch{throw imageDataError();}
  const safe=sanitizeStaticSVG(source,depth);
  const bytes=new TextEncoder().encode(safe);let binary="";
  for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
  return "data:image/svg+xml;base64,"+btoa(binary);
}
