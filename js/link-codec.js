"use strict";
/* Códec existente de deep links, compartido sin DOM, red ni persistencia.
   [versión 1 + deflate-raw] o [versión 0 + UTF-8], ambos base64url. */
const DEEP_LINK_MAX_BYTES=2*1024*1024;

/* RFC 1951: verificar el final exacto sin recomprimir ni depender de que el
   navegador rechace trailing data. Sólo recorre estructura y cuenta salida;
   DecompressionStream sigue siendo el único descompresor. Acepta bloques
   stored/fixed/dynamic y el padding del último byte de streams históricos. */
function validateDeflateRaw(bytes,max){
  let bit=0,output=0;
  const invalid=()=>{throw new Error("deflate");};
  const read=n=>{
    if(bit+n>bytes.length*8) invalid();
    let value=0;
    for(let i=0;i<n;i++,bit++) value|=((bytes[bit>>>3]>>>(bit&7))&1)<<i;
    return value;
  };
  const add=n=>{
    output+=n;
    if(output>max){const e=new Error("too_large");e.motivo="too_large";throw e;}
  };
  const tree=lengths=>{
    const counts=new Uint16Array(16),next=new Uint16Array(16);
    let maxLength=0;
    for(const length of lengths){if(length>15) invalid();if(length){counts[length]++;maxLength=Math.max(maxLength,length);}}
    let code=0;
    for(let length=1;length<=15;length++){
      code=(code+counts[length-1])*2;next[length]=code;
      if(code+counts[length]>2**length) invalid();
    }
    const symbols=new Int16Array(2**(maxLength+1));symbols.fill(-1);
    lengths.forEach((length,symbol)=>{if(length) symbols[2**length+next[length]++]=symbol;});
    return {symbols,maxLength};
  };
  const symbol=table=>{
    let code=0;
    for(let length=1;length<=table.maxLength;length++){
      code=code*2+read(1);
      const value=table.symbols[2**length+code];
      if(value>=0) return value;
    }
    return invalid();
  };
  const lengthBase=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const lengthExtra=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const distanceBase=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const order=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  let final;
  do{
    final=read(1);const type=read(2);
    if(type===0){
      bit=Math.ceil(bit/8)*8;
      const length=read(16),inverse=read(16);
      if((length^inverse)!==65535 || bit+length*8>bytes.length*8) invalid();
      bit+=length*8;add(length);continue;
    }
    if(type===3) invalid();
    let literals,distances;
    if(type===1){
      literals=tree(Array.from({length:288},(_,i)=>i<144?8:i<256?9:i<280?7:8));
      distances=tree(Array(32).fill(5));
    }else{
      const literalCount=257+read(5),distanceCount=1+read(5),codeCount=4+read(4);
      if(literalCount>286) invalid();
      const codeLengths=Array(19).fill(0);
      for(let i=0;i<codeCount;i++) codeLengths[order[i]]=read(3);
      const codes=tree(codeLengths),lengths=[];
      while(lengths.length<literalCount+distanceCount){
        const value=symbol(codes);
        if(value<16){lengths.push(value);continue;}
        if(value===16 && !lengths.length) invalid();
        const repeat=value===16?3+read(2):value===17?3+read(3):11+read(7);
        if(lengths.length+repeat>literalCount+distanceCount) invalid();
        const length=value===16?lengths.at(-1):0;
        for(let i=0;i<repeat;i++) lengths.push(length);
      }
      if(!lengths[256]) invalid();
      literals=tree(lengths.slice(0,literalCount));distances=tree(lengths.slice(literalCount));
    }
    for(;;){
      const value=symbol(literals);
      if(value===256) break;
      if(value<256){add(1);continue;}
      if(value>285) invalid();
      const index=value-257,length=lengthBase[index]+read(lengthExtra[index]);
      const dist=symbol(distances);
      if(dist>29) invalid();
      const extra=dist<4?0:(dist>>>1)-1,distance=distanceBase[dist]+read(extra);
      if(distance>output) invalid();
      add(length);
    }
  }while(!final);
  if(Math.ceil(bit/8)!==bytes.length) invalid();
  return output;
}

function base64urlToBytes(s){
  const b64=s.replace(/-/g,"+").replace(/_/g,"/");
  /* atob rechaza una longitud que no sea múltiplo de 4, y base64url viaja sin
     relleno para no gastar caracteres en la URL. */
  const bin=atob(b64 + "=".repeat((4 - b64.length % 4) % 4));
  const u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return u;
}

/* Descomprime contando lo que sale y abortando en cuanto se pasa del tope, sin
   esperar a tener el resultado entero en memoria. */
async function inflateRaw(bytes, max){
  validateDeflateRaw(bytes,max);
  const ds=new DecompressionStream("deflate-raw");
  const w=ds.writable.getWriter();
  /* Si los bytes no son deflate válido, el error sale por el lado de lectura.
     Estos dos catch evitan además la promesa rechazada sin dueño del escritor. */
  w.write(bytes).catch(()=>{});
  w.close().catch(()=>{});
  const r=ds.readable.getReader();
  const trozos=[]; let total=0;
  for(;;){
    const {value,done}=await r.read();
    if(done) break;
    total+=value.length;
    if(total>max){ r.cancel().catch(()=>{}); const e=new Error("too_large"); e.motivo="too_large"; throw e; }
    trozos.push(value);
  }
  const todo=new Uint8Array(total); let off=0;
  for(const t of trozos){ todo.set(t,off); off+=t.length; }
  return new TextDecoder().decode(todo);
}

/* Devuelve el diagrama del enlace, ya validado, o lanza. El error lleva
   `motivo`, que es lo único que acaba en la telemetría: vocabulario cerrado de
   cuatro valores, ningún dato del contenido.

       decode       la carga no se puede leer — base64 roto, no es deflate,
                    versión desconocida, o el resultado no es JSON.
                    El caso probable: un cliente de correo partió la URL.
       schema       se leyó bien, pero lo que traía no es un diagrama Fluyo.
                    Reenviar el enlace no lo arregla; es otro problema.
       too_large    se pasó del tope de descompresión.
       unsupported  este navegador no sabe inflar deflate-raw.

   La validación va aquí dentro y no en quien llama, para que la función tenga
   un contrato entero: o devuelve un diagrama utilizable, o dice por qué no. */
async function decodeDeepLink(payload){
  let bytes;
  try{
    if(typeof payload!=="string" || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length%4===1) throw new Error("base64");
    bytes=base64urlToBytes(payload);
    if(bytesToBase64url(bytes)!==payload) throw new Error("base64");
  }
  catch(e){ const err=new Error("base64"); err.motivo="decode"; throw err; }
  if(!bytes.length){ const err=new Error("vacío"); err.motivo="decode"; throw err; }

  const version=bytes[0], carga=bytes.subarray(1);
  let texto;
  if(version===1){
    if(typeof DecompressionStream==="undefined"){
      const err=new Error("sin DecompressionStream"); err.motivo="unsupported"; throw err;
    }
    try{ texto=await inflateRaw(carga, DEEP_LINK_MAX_BYTES); }
    catch(e){ if(e.motivo) throw e; const err=new Error("inflate"); err.motivo="decode"; throw err; }
  }else if(version===0){
    if(carga.length>DEEP_LINK_MAX_BYTES){ const err=new Error("grande"); err.motivo="too_large"; throw err; }
    texto=new TextDecoder().decode(carga);
  }else{
    const err=new Error("versión "+version); err.motivo="decode"; throw err;
  }

  let d;
  try{ d=JSON.parse(texto); }
  catch(e){ const err=new Error("json"); err.motivo="decode"; throw err; }

  /* Que el JSON esté bien formado no lo convierte en un diagrama. */
  try{ documentFromProjectData(d); }
  catch(e){ const err=new Error("no es un diagrama Fluyo"); err.motivo="schema"; err.code=e.code; throw err; }
  return d;
}

function bytesToBase64url(bytes){
  let bin="";
  for(let i=0;i<bytes.length;i+=8192)
    bin+=String.fromCharCode.apply(null, bytes.subarray(i,i+8192));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function encodeDeepLink(projectData){
  const json=JSON.stringify(projectData);
  if(new TextEncoder().encode(json).length>DEEP_LINK_MAX_BYTES){
    const err=new Error("too_large"); err.motivo="too_large"; throw err;
  }
  let payload;
  if(typeof CompressionStream==="function"){
    const bytes=new TextEncoder().encode(json);
    const cs=new CompressionStream("deflate-raw");
    const w=cs.writable.getWriter();
    w.write(bytes).catch(()=>{});
    w.close().catch(()=>{});
    const chunks=[]; let total=0;
    const r=cs.readable.getReader();
    for(;;){
      const {value,done}=await r.read();
      if(done) break;
      chunks.push(value); total+=value.length;
    }
    payload=new Uint8Array(total+1);
    payload[0]=1;
    let off=1;
    for(const c of chunks){ payload.set(c,off); off+=c.length; }
  }else{
    const bytes=new TextEncoder().encode(json);
    payload=new Uint8Array(bytes.length+1);
    payload[0]=0;
    payload.set(bytes,1);
  }
  return bytesToBase64url(payload);
}
