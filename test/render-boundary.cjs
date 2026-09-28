"use strict";
/* FLUYO-004 — Verificación de sintaxis del boundary del renderer.
   Concatena los scripts del editor en el orden real de carga y los compila con
   vm.Script sin ejecutarlos. Luego repite la secuencia mínima que usaría un
   viewer read-only real (sin state.js/editor-runtime.js, selection.js,
   interaction.js, ui.js ni export.js). */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function read(p){ return fs.readFileSync(path.join(__dirname, "..", p), "utf8"); }

const editorScripts = [
  "js/config.js",
  "js/model.js",
  "js/examples.js",
  "js/deeplink.js",
  "js/state.js",
  "js/selection.js",
  "js/geometry.js",
  "js/render.js",
  "js/interaction.js",
  "js/editor-runtime.js",
  "js/ui.js",
  "js/export.js",
  "js/analytics.js",
];

const viewerScripts = [
  "js/config.js",
  "js/model.js",
  "js/geometry.js",
  "js/render.js",
];

function check(name, files){
  const src = files.map(read).join("\n;\n");
  const script = new vm.Script(src, {filename: name + ".bundle.js"});
  console.log("OK sintaxis:", name);
  return script;
}

check("editor-full", editorScripts);
check("viewer-core", viewerScripts);

const modelSource=read("js/model.js");
const renderSource=read("js/render.js");
for(const [name,source,forbidden] of [
  ["model",modelSource,/\blocalStorage\s*\.|\bdocument\s*\.|\brequestAnimationFrame\s*\(|\b(?:selN|selE|singleSel|arrowHostNode|hoverNode)\b/],
  ["renderer",renderSource,/\bbuildEditorRenderState\b|\bsyncEditBoxIfMoved\b|\brequestAnimationFrame\b|\bplaying\b|\bpausedAt\b/]
]){
  if(forbidden.test(source)) throw new Error(name+" conserva una dependencia del editor");
}
const exportRenderCalls=read("js/export.js").split(/\r?\n/).filter(line=>/^\s*render\(oc,/.test(line));
if(exportRenderCalls.length!==2 || exportRenderCalls.some(line=>!line.includes("makeReadOnlyRenderState")))
  throw new Error("PNG/JPG/GIF no pasan renderState read-only explícito");
const indexSource=read("index.html");
const exportSource=read("js/export.js");
if(/<link\s+rel=["']manifest["']/i.test(indexSource))
  throw new Error("index.html carga el manifest estáticamente bajo file://");
if(!/location\.protocol===["']http:["']\s*\|\|\s*location\.protocol===["']https:["']/.test(indexSource))
  throw new Error("el manifest no tiene allowlist explícita de protocolo");
if(!/location\.protocol!==["']http:["']\s*&&\s*location\.protocol!==["']https:["']/.test(exportSource))
  throw new Error("el Service Worker no tiene guarda explícita de protocolo");

const manifestCode=indexSource.match(/<script>\s*(if\(location\.protocol==="http:"[\s\S]*?document\.head\.appendChild\(manifest\);\s*\})\s*<\/script>/)?.[1];
if(!manifestCode) throw new Error("no se pudo aislar el bootstrap condicional del manifest");
function manifestLoads(protocol){
  const appended=[];
  vm.runInNewContext(manifestCode,{
    location:{protocol},
    document:{createElement:()=>({}),head:{appendChild:el=>appended.push(el)}}
  });
  return appended;
}
if(manifestLoads("file:").length!==0) throw new Error("file:// intenta cargar el manifest");
const httpManifest=manifestLoads("http:");
if(httpManifest.length!==1 || httpManifest[0].rel!=="manifest" || httpManifest[0].href!=="./manifest.webmanifest")
  throw new Error("HTTP no instala el manifest esperado");

const swCode=exportSource.match(/function registerServiceWorker\(\)\{[\s\S]*?\r?\n\}\r?\nregisterServiceWorker\(\);/)?.[0];
if(!swCode) throw new Error("no se pudo aislar el bootstrap del Service Worker");
function serviceWorkerRegistrations(protocol){
  let calls=0;
  vm.runInNewContext(swCode,{
    location:{protocol},
    navigator:{serviceWorker:{register:()=>{ calls++; return Promise.resolve(); }}},
    document:{readyState:"complete"},
    window:{addEventListener:()=>{ throw new Error("registro inesperadamente diferido"); }},
    console
  });
  return calls;
}
if(serviceWorkerRegistrations("file:")!==0) throw new Error("file:// intenta registrar Service Worker");
if(serviceWorkerRegistrations("http:")!==1 || serviceWorkerRegistrations("https:")!==1)
  throw new Error("HTTP/HTTPS no registran Service Worker exactamente una vez");
console.log("Todas las secuencias compilan sin errores de sintaxis.");
