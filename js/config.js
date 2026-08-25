"use strict";
/* Configuración: constantes, paleta, temas e iconos cloud */

/* ===================== Constantes ===================== */
const W=2560, H=1440, GRID=20, ARROW_OFF=24, HANDLE=7;
/* A qué distancia de un punto de anclaje hay que soltar para que el extremo se
   fije a ESE lado. Más lejos —el centro de la forma— significa «flotante»: que
   el motor elija el lado según hacia dónde vaya la flecha. Es la frontera entre
   las dos clases de conexión, así que vive aquí y no repetida en cada archivo. */
const ANCHOR_SNAP=22;
const PALETTE=[
  {c:"#6a9fb5", n:"Servicio"},
  {c:"#d08b5b", n:"Eventos / Kafka"},
  {c:"#7fa66b", n:"Datos"},
  {c:"#9b7fb5", n:"IA"},
  {c:"#c16a6a", n:"Alerta"},
  {c:"#8f8f8f", n:"Externo"},
  {c:"#c9b458", n:"Config"},
  {c:"#5bb0a0", n:"Cache"},
  {c:"#b5739b", n:"Cola"},
  {c:"#6b78c9", n:"Red"},
  {c:"#c98f5b", n:"Almacén"},
  {c:"#7bb85b", n:"Éxito"},
  {c:"#d0576a", n:"Error"},
  {c:"#5b9bd0", n:"Info"},
];
/* Paleta amplia para el selector de color (rejilla de swatches) */
const SWATCH_COLORS=[
  "#ffffff","#e8e6e1","#b8b5ad","#8f8f8f","#5a5a5a","#2b2b2b","#000000",
  "#f4a3a3","#e06666","#c1272d","#8b1a1a","#5c0f0f",
  "#f6c28b","#e8964f","#d0791f","#a85a10","#6e3a08",
  "#f2e08a","#e0c94f","#c9b458","#a68f1f","#6e5f10",
  "#b7e08a","#8fca5f","#6aa63e","#4a7d28","#2e5216",
  "#8fe0c9","#5bb0a0","#2e9b86","#1f6e5f","#124239",
  "#8fc4f2","#5b9bd0","#3a7bc8","#1f5aa0","#123a6e",
  "#b3a3f2","#9b7fb5","#7a5fb0","#5a3f8f","#3a2860",
  "#e8a3d8","#c96fb5","#a83f96","#7d2870","#521a4a",
];
/* Los cuatro tokens `code*` los usa la forma `code`. Están en el tema y no como
   constantes del renderer porque los consumen TRES renderers —lienzo, exportador
   SVG de la app y svg.ts del MCP—: un ternario sobre el nombre del tema
   triplicado es la forma exacta en que se abrió el drift anterior. */
const THEMES={
  dark : {bg:"#161616", grid:"rgba(255,255,255,.045)", text:"#ededed", edge:"#777", edgeLbl:"#bdbdbd", lblBg:"#161616",
          codeBg:"#101010", codeText:"#e8e8e8", codeKwBg:"#a8b34a", codeKwText:"#0c0a09"},
  crema: {bg:"#f4eee1", grid:"rgba(0,0,0,.06)",        text:"#2b2620", edge:"#8a8275", edgeLbl:"#6b6457", lblBg:"#f4eee1",
          codeBg:"#e7ddc9", codeText:"#1a1a1a", codeKwBg:"#a8b34a", codeKwText:"#0c0a09"},
  claro: {bg:"#ffffff", grid:"rgba(0,0,0,.05)",        text:"#111111", edge:"#888888", edgeLbl:"#444444", lblBg:"#ffffff",
          codeBg:"#101010", codeText:"#e8e8e8", codeKwBg:"#a8b34a", codeKwText:"#0c0a09"},
};

/* ===================== Bloques de código =====================
   La forma `code` no mide texto: coloca cada carácter en una rejilla de ancho
   fijo. En una monoespaciada el carácter k está en x0 + k*avance, así que la
   geometría de un token sale de ÍNDICES DE CARÁCTER y es aritmética pura,
   idéntica en los tres renderers sin que ninguno tenga que medir nada.

   CODE_ADV no es una estimación del avance real de la fuente: es NORMATIVO. El
   texto se obliga a la rejilla —`textLength` en SVG, carácter a carácter en el
   lienzo—, así que si la fuente que resuelve tiene otro avance el renderer ajusta
   el espaciado en vez de descuadrarse. Medido en Chrome/Windows, donde
   `monospace` resuelve a Consolas (avance real 0.55): sin forzar, un token de 4
   caracteres a 16px mide 35.19px en vez de 38.40 y el resaltado se corre; con
   `textLength` mide 38.40 exactos.

   Ese descuadre es el defecto que traía el fork original, donde el lienzo medía
   con measureText y el exportador SVG con `longitud*fs*0.6`. */
const CODE_ADV=0.6;
/* Presets de palabras clave. Deliberadamente dos: cada preset hay que mantenerlo
   sincronizado por codegen entre dos repos, y el campo `keywords` del nodo cubre
   cualquier otro lenguaje sin coste. `sql` son las 29 palabras exactas del fork
   —un híbrido SQL/ksqlDB— para que un diagrama portado salga igual. */
const CODE_LANGS={
  sql:["CREATE","STREAM","TABLE","SELECT","FROM","WHERE","EMIT","CHANGES","AS","INSERT",
       "INTO","JOIN","LEFT","RIGHT","GROUP","BY","ORDER","HAVING","WITH","WINDOW",
       "PARTITION","KEY","VALUES","UPDATE","SET","DELETE","AND","OR","ON"],
  none:[],
};
const DEFAULT_LANG="sql";
/* El bloque con el que nace un nodo `code`, el mismo del fork original. */
const CODE_DEFAULT_LABEL="CREATE STREAM x AS\nSELECT *\nFROM stream";
const DIR={n:{x:0,y:-1}, s:{x:0,y:1}, e:{x:1,y:0}, w:{x:-1,y:0}};
const SIDES=["n","e","s","w"];
/* ===================== Tamaño con el que nace cada forma =====================
   Vivía dentro de newNode(), en js/state.js. Está aquí por dos razones:

   · lo necesita el escalado de la etiqueta, que deriva la fuente de la caja
     RELATIVA a este tamaño (ver labelBoxScale en js/geometry.js);
   · el codegen del MCP lo sacaba de js/state.js con una expresión regular,
     porque ese archivo toca el DOM y no se puede evaluar fuera del navegador.
     Era la única extracción frágil de todo el codegen; desde aquí se lee
     evaluando el archivo, como el resto. */
const DEFAULT_SIZES={
  rect:[180,70], cylinder:[150,90], diamond:[160,100], circle:[110,110], hex:[170,80],
  text:[200,40], icon:[120,92], image:[220,160], anim:[120,100], code:[300,150],
};
/* Tipografías disponibles (el primer valor es la fuente global por defecto) */
const FONTS=[
  {n:"Georgia",     f:"Georgia, serif"},
  {n:"Times",       f:"'Times New Roman', Times, serif"},
  {n:"Palatino",    f:"'Palatino Linotype', 'Book Antiqua', Palatino, serif"},
  {n:"Segoe UI",    f:"'Segoe UI', system-ui, sans-serif"},
  {n:"Arial",       f:"Arial, Helvetica, sans-serif"},
  {n:"Verdana",     f:"Verdana, Geneva, sans-serif"},
  {n:"Trebuchet",   f:"'Trebuchet MS', Tahoma, sans-serif"},
  {n:"Tahoma",      f:"Tahoma, Geneva, sans-serif"},
  {n:"Courier",     f:"'Courier New', Courier, monospace"},
  {n:"Impact",      f:"Impact, Haettenschweiler, sans-serif"},
  {n:"Comic Sans",  f:"'Comic Sans MS', 'Comic Sans', cursive"},
  /* Pila de sistema, sin webfont ni CDN: no introduce ningún tercero y por tanto
     no toca la política de privacidad publicada. Es la fuente por defecto de la
     forma `code`. */
  {n:"Mono",        f:'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'},
];
const DEFAULT_FONT=FONTS[0].f;

/* ===================== Iconos cloud (SVG simplificados) =====================
   Cada icono se declara en DOS PIEZAS —`bg` (la pastilla) e `inner` (el glifo)—
   y el SVG se compone con badge(). No es ceremonia: es lo que permite TEÑIRLO.

   Un icono es una cadena SVG opaca; para recolorearlo hay tres caminos y dos son
   malos. `currentColor` no sirve —el lienzo los dibuja con drawImage() desde un
   data URI, donde no hay cascada CSS que herede nada—, y buscar el color con una
   expresión regular sobre el SVG ya montado es adivinar. Guardar las piezas por
   separado convierte el teñido en volver a componer, que es exacto y da el mismo
   resultado en los tres renderers.

   `%bg%` dentro de `inner` es «el color de la pastilla»: los huecos que dejan ver
   el fondo (los círculos de `gcs`, los puntos de `azbus`) tienen que seguir al
   color de la pastilla cuando esta cambia, no quedarse en el original.

   El glifo NO se tiñe. Es blanco —o del color de marca, en AWS y Azure— y se lee
   sobre cualquier pastilla; teñir las dos piezas dejaría el icono en un solo
   color plano e ilegible. */
const badge=(bg,inner)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="14" fill="${bg}"/>${inner.replaceAll("%bg%",bg)}</svg>`;
const wheel=col=>{let s="";for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2,x=32+Math.cos(a)*15,y=32+Math.sin(a)*15;s+=`<line x1="32" y1="32" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="3.4"/>`;}return s+`<circle cx="32" cy="32" r="16" fill="none" stroke="${col}" stroke-width="3.6"/><circle cx="32" cy="32" r="5" fill="${col}"/>`;};
const cylin=col=>`<path d="M18 22 v20 c0 4 6 7 14 7 s14 -3 14 -7 V22" fill="none" stroke="${col}" stroke-width="3.6"/><ellipse cx="32" cy="22" rx="14" ry="6.5" fill="none" stroke="${col}" stroke-width="3.6"/>`;
const txtG=(t,col,fs=30)=>`<text x="32" y="33" font-size="${fs}" font-family="Georgia,serif" fill="${col}" text-anchor="middle" dominant-baseline="central">${t}</text>`;
const GCP_BLUE="#4285f4", AWS_BG="#232f3e", AWS_OR="#ff9900", AZ_BLUE="#0078d4";
const ICONS={
  /* --- General --- */
  kafka:{g:"General",n:"Kafka",bg:"#1b1b1b",inner:
    `<circle cx="32" cy="14" r="6" fill="#fff"/><circle cx="32" cy="50" r="6" fill="#fff"/><circle cx="46" cy="23" r="6" fill="#fff"/><circle cx="46" cy="41" r="6" fill="#fff"/><circle cx="28" cy="32" r="7" fill="#fff"/><line x1="32" y1="18" x2="42" y2="24" stroke="#fff" stroke-width="3"/><line x1="42" y1="40" x2="32" y2="46" stroke="#fff" stroke-width="3"/><line x1="30" y1="20" x2="29" y2="26" stroke="#fff" stroke-width="3"/><line x1="29" y1="38" x2="30" y2="44" stroke="#fff" stroke-width="3"/>`},
  k8s:{g:"General",n:"K8s",bg:"#326ce5",inner:wheel("#fff")},
  db:{g:"General",n:"BD",bg:"#3b4252",inner:cylin("#fff")},
  queue:{g:"General",n:"Cola",bg:"#5b4a72",inner:`<rect x="14" y="18" width="24" height="8" rx="3" fill="#fff"/><rect x="14" y="29" width="24" height="8" rx="3" fill="#fff"/><rect x="14" y="40" width="24" height="8" rx="3" fill="#fff"/><path d="M42 28 l10 5 -10 5z" fill="#fff"/>`},
  user:{g:"General",n:"Usuario",bg:"#6b7b8c",inner:`<circle cx="32" cy="24" r="9" fill="#fff"/><path d="M15 50 c2-11 8-15 17-15 s15 4 17 15z" fill="#fff"/>`},
  users:{g:"General",n:"Usuarios",bg:"#5f6f80",inner:`<circle cx="23" cy="26" r="7" fill="#fff"/><path d="M10 47 c1.6-8.8 5.2-11.8 13-11.8 s11.4 3 13 11.8z" fill="#fff"/><circle cx="43" cy="26" r="7" fill="#fff"/><path d="M30 47 c1.6-8.8 5.2-11.8 13-11.8 s11.4 3 13 11.8z" fill="#fff"/>`},
  movil:{g:"General",n:"Móvil",bg:"#4a5560",inner:`<rect x="22" y="12" width="20" height="40" rx="4" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="32" cy="45" r="2.4" fill="#fff"/>`},
  web:{g:"General",n:"Web",bg:"#3c6e71",inner:`<circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-width="3.2"/><ellipse cx="32" cy="32" rx="8" ry="17" fill="none" stroke="#fff" stroke-width="3"/><line x1="15" y1="32" x2="49" y2="32" stroke="#fff" stroke-width="3"/>`},
  api:{g:"General",n:"API",bg:"#2f4858",inner:txtG("&lt;/&gt;","#fff",22)},
  terminal:{g:"General",n:"Terminal",bg:"#22282e",inner:`<rect x="12" y="16" width="40" height="32" rx="4" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M20 27 l7 6 -7 6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 40 h11" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`},
  cloud:{g:"General",n:"Nube",bg:"#4a6b8a",inner:`<circle cx="25" cy="35" r="9" fill="#fff"/><circle cx="35" cy="28" r="12" fill="#fff"/><circle cx="45" cy="36" r="8" fill="#fff"/><rect x="25" y="36" width="20" height="9" rx="4.5" fill="#fff"/>`},
  search:{g:"General",n:"Búsqueda",bg:"#4a5560",inner:`<circle cx="29" cy="28" r="12" fill="none" stroke="#fff" stroke-width="3.6"/><line x1="38" y1="37" x2="49" y2="48" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>`},
  lock:{g:"General",n:"Seguridad",bg:"#7a3b3b",inner:`<rect x="19" y="29" width="26" height="21" rx="4" fill="#fff"/><path d="M24 29 v-5 a8 8 0 0 1 16 0 v5" fill="none" stroke="#fff" stroke-width="3.6"/>`},
  ai:{g:"General",n:"IA",bg:"#6d5a96",inner:`<path d="M32 12 l4.5 13 13 4.5 -13 4.5 -4.5 13 -4.5 -13 -13 -4.5 13 -4.5z" fill="#fff"/><circle cx="48" cy="16" r="3.4" fill="#fff"/>`},
  /* --- GCP --- */
  gke:{g:"GCP",n:"GKE",bg:GCP_BLUE,inner:wheel("#fff")},
  cloudsql:{g:"GCP",n:"Cloud SQL",bg:GCP_BLUE,inner:cylin("#fff")},
  pubsub:{g:"GCP",n:"Pub/Sub",bg:GCP_BLUE,inner:`<circle cx="32" cy="16" r="6" fill="#fff"/><circle cx="18" cy="44" r="6" fill="#fff"/><circle cx="46" cy="44" r="6" fill="#fff"/><circle cx="32" cy="33" r="4.4" fill="#fff"/><line x1="32" y1="21" x2="32" y2="29" stroke="#fff" stroke-width="3"/><line x1="28" y1="36" x2="22" y2="40" stroke="#fff" stroke-width="3"/><line x1="36" y1="36" x2="42" y2="40" stroke="#fff" stroke-width="3"/>`},
  bigquery:{g:"GCP",n:"BigQuery",bg:GCP_BLUE,inner:`<circle cx="29" cy="29" r="13" fill="none" stroke="#fff" stroke-width="3.6"/><line x1="38" y1="38" x2="49" y2="49" stroke="#fff" stroke-width="5" stroke-linecap="round"/><line x1="24" y1="31" x2="24" y2="34" stroke="#fff" stroke-width="3"/><line x1="29" y1="26" x2="29" y2="34" stroke="#fff" stroke-width="3"/><line x1="34" y1="29" x2="34" y2="34" stroke="#fff" stroke-width="3"/>`},
  run:{g:"GCP",n:"Cloud Run",bg:GCP_BLUE,inner:`<circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M27 24 l13 8 -13 8z" fill="#fff"/>`},
  gcs:{g:"GCP",n:"Storage",bg:GCP_BLUE,inner:`<rect x="16" y="20" width="32" height="10" rx="3" fill="#fff"/><rect x="16" y="34" width="32" height="10" rx="3" fill="#fff"/><circle cx="42" cy="25" r="2.2" fill="%bg%"/><circle cx="42" cy="39" r="2.2" fill="%bg%"/>`},
  vertex:{g:"GCP",n:"Vertex AI",bg:GCP_BLUE,inner:`<circle cx="20" cy="20" r="4" fill="#fff"/><circle cx="44" cy="20" r="4" fill="#fff"/><circle cx="32" cy="30" r="4" fill="#fff"/><circle cx="32" cy="46" r="5" fill="#fff"/><line x1="22" y1="23" x2="30" y2="28" stroke="#fff" stroke-width="2.6"/><line x1="42" y1="23" x2="34" y2="28" stroke="#fff" stroke-width="2.6"/><line x1="32" y1="34" x2="32" y2="41" stroke="#fff" stroke-width="2.6"/>`},
  gcf:{g:"GCP",n:"Functions",bg:GCP_BLUE,inner:txtG("ƒ","#fff",34)},
  /* --- AWS --- */
  lambda:{g:"AWS",n:"Lambda",bg:AWS_BG,inner:txtG("λ",AWS_OR,34)},
  s3:{g:"AWS",n:"S3",bg:AWS_BG,inner:`<path d="M18 18 h28 l-4 30 q-10 5 -20 0z" fill="none" stroke="${AWS_OR}" stroke-width="3.4"/><ellipse cx="32" cy="18" rx="14" ry="5.4" fill="none" stroke="${AWS_OR}" stroke-width="3.4"/>`},
  ec2:{g:"AWS",n:"EC2",bg:AWS_BG,inner:`<rect x="20" y="20" width="24" height="24" rx="3" fill="none" stroke="${AWS_OR}" stroke-width="3.4"/>`+["26","32","38"].map(p=>`<line x1="${p}" y1="13" x2="${p}" y2="20" stroke="${AWS_OR}" stroke-width="3"/><line x1="${p}" y1="44" x2="${p}" y2="51" stroke="${AWS_OR}" stroke-width="3"/><line x1="13" y1="${p}" x2="20" y2="${p}" stroke="${AWS_OR}" stroke-width="3"/><line x1="44" y1="${p}" x2="51" y2="${p}" stroke="${AWS_OR}" stroke-width="3"/>`).join("")},
  dynamo:{g:"AWS",n:"DynamoDB",bg:AWS_BG,inner:cylin(AWS_OR)},
  sqs:{g:"AWS",n:"SQS",bg:AWS_BG,inner:`<path d="M14 24 h26 m0 0 l-7 -6 m7 6 l-7 6" fill="none" stroke="${AWS_OR}" stroke-width="3.4"/><path d="M50 42 h-26 m0 0 l7 -6 m-7 6 l7 6" fill="none" stroke="${AWS_OR}" stroke-width="3.4"/>`},
  apigw:{g:"AWS",n:"API GW",bg:AWS_BG,inner:txtG("&lt;/&gt;",AWS_OR,21)},
  /* --- Azure --- */
  azvm:{g:"Azure",n:"VM",bg:AZ_BLUE,inner:`<rect x="16" y="17" width="32" height="22" rx="3" fill="none" stroke="#fff" stroke-width="3.4"/><line x1="24" y1="48" x2="40" y2="48" stroke="#fff" stroke-width="3.4"/><line x1="32" y1="39" x2="32" y2="48" stroke="#fff" stroke-width="3.4"/>`},
  azfun:{g:"Azure",n:"Functions",bg:AZ_BLUE,inner:`<path d="M36 12 L22 35 h9 l-4 17 16 -25 h-9z" fill="#ffd400"/>`},
  cosmos:{g:"Azure",n:"Cosmos DB",bg:AZ_BLUE,inner:`<circle cx="32" cy="32" r="12" fill="none" stroke="#fff" stroke-width="3.4"/><ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="#fff" stroke-width="2.6" transform="rotate(-20 32 32)"/>`},
  azbus:{g:"Azure",n:"Service Bus",bg:AZ_BLUE,inner:`<rect x="14" y="26" width="36" height="12" rx="4" fill="#fff"/><circle cx="22" cy="32" r="2.6" fill="%bg%"/><circle cx="32" cy="32" r="2.6" fill="%bg%"/><circle cx="42" cy="32" r="2.6" fill="%bg%"/>`},
  aks:{g:"Azure",n:"AKS",bg:AZ_BLUE,inner:`<path d="M32 12 l17 10 v20 l-17 10 -17 -10 V22z" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="32" cy="32" r="6" fill="#fff"/>`},
  /* --- Estados --- */
  ok:{g:"Estados",n:"Éxito",bg:"#2e7d46",inner:`<path d="M20 33 l8 9 16 -18" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`},
  err:{g:"Estados",n:"Error",bg:"#c1272d",inner:`<path d="M22 22 l20 20 M42 22 l-20 20" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>`},
  warn:{g:"Estados",n:"Aviso",bg:"#d99a1f",inner:`<path d="M32 14 l20 34 h-40z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><line x1="32" y1="28" x2="32" y2="38" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="44" r="2.6" fill="#fff"/>`},
  info:{g:"Estados",n:"Info",bg:"#2f6fb5",inner:`<circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="4"/><circle cx="32" cy="22" r="2.8" fill="#fff"/><path d="M32 30 v14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`},
  question:{g:"Estados",n:"Duda",bg:"#5b6f8f",inner:`<circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="4"/><path d="M25 26 a7.4 7.4 0 0 1 14.4 2.4 c0 5.2 -7.2 5.8 -7.2 10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="44" r="2.8" fill="#fff"/>`},
  blocked:{g:"Estados",n:"Bloqueado",bg:"#8a3b3b",inner:`<circle cx="32" cy="32" r="18" fill="none" stroke="#fff" stroke-width="4.4"/><line x1="19" y1="19" x2="45" y2="45" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>`},
  retry:{g:"Estados",n:"Reintento",bg:"#2e6b5b",inner:`<path d="M46 32 a14 14 0 1 1 -4.1 -9.9" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round"/><path d="M42 13 v10 h-10" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>`},
  bug:{g:"Estados",n:"Bug",bg:"#7a3b3b",inner:`<ellipse cx="32" cy="34" rx="11" ry="13" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="32" cy="18" r="6" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M18 28 h8 M38 28 h8 M17 40 h8 M39 40 h8 M32 21 v26" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`},
  bell:{g:"Estados",n:"Alerta",bg:"#b5732e",inner:`<path d="M20 42 c0 -3 3 -4 3 -12 a9 9 0 0 1 18 0 c0 8 3 9 3 12z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M28 46 a4 4 0 0 0 8 0" fill="none" stroke="#fff" stroke-width="3.4"/>`},
  /* --- Seguridad --- */
  shield:{g:"Seguridad",n:"Escudo",bg:"#3b5068",inner:`<path d="M32 12 l16 6 v14 c0 10 -7 16.4 -16 20 c-9 -3.6 -16 -10 -16 -20 V18z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>`},
  key:{g:"Seguridad",n:"Clave",bg:"#8a6a2e",inner:`<circle cx="24" cy="26" r="9" fill="none" stroke="#fff" stroke-width="3.6"/><path d="M30 32 L48 50 M42 44 l5 -5 M37 39 l5 -5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>`},
  firewall:{g:"Seguridad",n:"Cortafuegos",bg:"#7a3b3b",inner:`<rect x="13" y="19" width="38" height="26" rx="3" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M13 28 h38 M13 36 h38 M27 19 v9 M40 28 v8 M22 36 v9 M43 36 v9" stroke="#fff" stroke-width="2.8"/>`},
  cert:{g:"Seguridad",n:"Certificado",bg:"#2e6b5b",inner:`<rect x="13" y="13" width="38" height="27" rx="3" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M20 22 h24 M20 30 h15" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><circle cx="32" cy="43" r="7" fill="%bg%" stroke="#fff" stroke-width="3"/><path d="M27 48 l-2 9 7 -4 7 4 -2 -9" fill="none" stroke="#fff" stroke-width="2.8" stroke-linejoin="round"/>`},
  vault:{g:"Seguridad",n:"Secretos",bg:"#4a5560",inner:`<rect x="13" y="15" width="38" height="34" rx="4" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="29" cy="32" r="9" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M29 23 v-4 M29 41 v4 M20 32 h-4 M38 32 h4" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M44 24 v16" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`},
  /* --- DevOps --- */
  cron:{g:"DevOps",n:"Cron",bg:"#5b4a72",inner:`<rect x="11" y="18" width="31" height="30" rx="4" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M11 27 h31 M20 14 v7 M33 14 v7" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="45" cy="42" r="11" fill="%bg%" stroke="#fff" stroke-width="3.2"/><path d="M45 36 v6.5 l4.5 3" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`},
  webhook:{g:"DevOps",n:"Webhook",bg:"#6d5a96",inner:`<circle cx="26" cy="20" r="7" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M23 26.5 l-6 12" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="17" cy="45" r="7" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M24 45 h15" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="46" cy="45" r="7" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M43 38.8 l-8 -13" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`},
  pipeline:{g:"DevOps",n:"CI / CD",bg:"#2f4858",inner:`<path d="M14 19 l12 13 -12 13 M30 19 l12 13 -12 13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 18 v28" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`},
  log:{g:"DevOps",n:"Registros",bg:"#455060",inner:`<rect x="12" y="14" width="40" height="36" rx="4" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="21" cy="24" r="2.2" fill="#fff"/><circle cx="21" cy="32" r="2.2" fill="#fff"/><circle cx="21" cy="40" r="2.2" fill="#fff"/><path d="M28 24 h16 M28 32 h16 M28 40 h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`},
  test:{g:"DevOps",n:"Pruebas",bg:"#3c5a3c",inner:`<path d="M26 13 v15 L15 45 a4.5 4.5 0 0 0 4 7 h26 a4.5 4.5 0 0 0 4 -7 L38 28 V13" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M22 13 h20" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M21 38 h22" stroke="#fff" stroke-width="3"/>`},
  scale:{g:"DevOps",n:"Autoescalado",bg:"#2e6b5b",inner:`<path d="M32 14 v36 M14 32 h36" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M26 20 l6 -6 6 6 M26 44 l6 6 6 -6 M20 26 l-6 6 6 6 M44 26 l6 6 -6 6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`},
  /* --- Archivos & varios --- */
  file:{g:"Varios",n:"Archivo",bg:"#455060",inner:`<path d="M22 14 h14 l8 8 v28 h-22z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M36 14 v8 h8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>`},
  folder:{g:"Varios",n:"Carpeta",bg:"#c9992e",inner:`<path d="M14 22 h12 l4 5 h20 v20 h-36z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>`},
  mail:{g:"Varios",n:"Correo",bg:"#3c6e71",inner:`<rect x="14" y="20" width="36" height="24" rx="3" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M14 22 l18 14 18 -14" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>`},
  chat:{g:"Varios",n:"Mensajería",bg:"#5b6f8f",inner:`<path d="M13 17 h38 v25 h-23 l-11 8 v-8 h-4z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M22 26 h20 M22 34 h13" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`},
  clock:{g:"Varios",n:"Reloj",bg:"#4a5560",inner:`<circle cx="32" cy="32" r="18" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M32 22 v11 l8 5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`},
  gear:{g:"Varios",n:"Config",bg:"#3b4252",inner:wheel("#fff")},
  server:{g:"Varios",n:"Servidor",bg:"#3b4252",inner:`<rect x="16" y="16" width="32" height="14" rx="3" fill="none" stroke="#fff" stroke-width="3.2"/><rect x="16" y="34" width="32" height="14" rx="3" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="23" cy="23" r="2.4" fill="#fff"/><circle cx="23" cy="41" r="2.4" fill="#fff"/>`},
  cache:{g:"Varios",n:"Cache",bg:"#7a2e2e",inner:`<path d="M20 26 l12 -8 12 8 v12 l-12 8 -12 -8z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M20 26 l12 8 12 -8 M32 34 v12" fill="none" stroke="#fff" stroke-width="3"/>`},
  cdn:{g:"Varios",n:"CDN",bg:"#2f4858",inner:`<circle cx="32" cy="32" r="16" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="32" cy="32" rx="7" ry="16" fill="none" stroke="#fff" stroke-width="2.6"/><line x1="16" y1="32" x2="48" y2="32" stroke="#fff" stroke-width="2.6"/><circle cx="46" cy="20" r="4" fill="#fff"/>`},
  dns:{g:"Varios",n:"DNS",bg:"#2f4858",inner:`<path d="M32 13 v38" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M32 18 h15 l5 5.5 -5 5.5 h-15z" fill="#fff"/><path d="M32 34 h-15 l-5 5.5 5 5.5 h15z" fill="#fff"/>`},
  balancer:{g:"Varios",n:"Balanceador",bg:"#2e6b5b",inner:`<circle cx="32" cy="16" r="5" fill="#fff"/><circle cx="16" cy="46" r="5" fill="#fff"/><circle cx="32" cy="46" r="5" fill="#fff"/><circle cx="48" cy="46" r="5" fill="#fff"/><path d="M32 21 v8 M32 29 h-16 v10 M32 29 v10 M32 29 h16 v10" fill="none" stroke="#fff" stroke-width="3"/>`},
  filter:{g:"Varios",n:"Filtro",bg:"#5b4a72",inner:`<path d="M13 16 h38 l-15 18 v17 l-8 -4 V34z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>`},
  stream:{g:"Varios",n:"Flujo",bg:"#2e6b5b",inner:`<path d="M12 21 h26 a7.5 7.5 0 0 1 0 15 h-12 a7.5 7.5 0 0 0 0 15 h26" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`},
  table:{g:"Varios",n:"Tabla",bg:"#3b4252",inner:`<rect x="12" y="16" width="40" height="32" rx="3" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M12 26 h40 M12 37 h40 M26 26 v22 M39 26 v22" stroke="#fff" stroke-width="2.8"/>`},
  link:{g:"Varios",n:"Integración",bg:"#3c6e71",inner:`<path d="M27 37 l10 -10" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M25 31 l-5 5 a8.5 8.5 0 0 0 12 12 l5 -5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M39 33 l5 -5 a8.5 8.5 0 0 0 -12 -12 l-5 5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`},
  trash:{g:"Varios",n:"Purga",bg:"#7a3b3b",inner:`<path d="M18 23 h28 l-3 27 h-22z" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/><path d="M13 23 h38 M26 18 h12 M28 30 v13 M36 30 v13" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`},
  git:{g:"Varios",n:"Git",bg:"#5b3a2e",inner:`<circle cx="22" cy="20" r="5" fill="#fff"/><circle cx="22" cy="44" r="5" fill="#fff"/><circle cx="42" cy="30" r="5" fill="#fff"/><path d="M22 25 v14 M22 32 c0 -8 8 -2 16 -4" fill="none" stroke="#fff" stroke-width="3.2"/>`},
  docker:{g:"Varios",n:"Docker",bg:"#1d63a8",inner:`<rect x="18" y="30" width="7" height="7" fill="#fff"/><rect x="27" y="30" width="7" height="7" fill="#fff"/><rect x="36" y="30" width="7" height="7" fill="#fff"/><rect x="27" y="22" width="7" height="7" fill="#fff"/><path d="M14 38 h34 c0 6 -5 9 -12 9 h-10 c-8 0 -12 -4 -12 -9z" fill="#fff"/>`},
  graph:{g:"Varios",n:"Métricas",bg:"#3c5a3c",inner:`<path d="M16 46 v-28 M16 46 h32" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M20 40 l8 -10 6 6 12 -16" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`},
};
/* El SVG montado se guarda en la propia entrada: `svg` es lo que consumen el
   cajón de iconos, el exportador y el codegen del MCP, y ninguno de los tres
   tiene por qué saber que ahora se compone en dos piezas. */
for(const k in ICONS) ICONS[k].svg=badge(ICONS[k].bg, ICONS[k].inner);

/* ===================== GIFs animados (dibujados por frame) ===================== */
/* Cada uno se dibuja proceduralmente en render.js según n.anim y el tiempo t.
   El thumbnail del cajón usa un SVG estático de vista previa. */
const anStroke="#e8e6e1";
const ANIMS={
  spinner:{n:"Cargando",  svg:badge("#20242a",`<circle cx="32" cy="32" r="15" fill="none" stroke="#3aa7e8" stroke-width="5" stroke-linecap="round" stroke-dasharray="60 40"/>`)},
  progress:{n:"Progreso", svg:badge("#20242a",`<rect x="14" y="28" width="36" height="8" rx="4" fill="none" stroke="${anStroke}" stroke-width="2.6"/><rect x="14" y="28" width="22" height="8" rx="4" fill="#3aa7e8"/>`)},
  ticket:{n:"Ticket",     svg:badge("#20242a",`<rect x="16" y="22" width="32" height="20" rx="3" fill="none" stroke="#7bb85b" stroke-width="3"/><path d="M22 30 h20 M22 36 h12" stroke="#7bb85b" stroke-width="2.6" stroke-linecap="round"/>`)},
  errmove:{n:"Error",     svg:badge("#20242a",`<circle cx="32" cy="32" r="15" fill="none" stroke="#d0576a" stroke-width="3.4"/><path d="M25 25 l14 14 M39 25 l-14 14" stroke="#d0576a" stroke-width="4" stroke-linecap="round"/>`)},
  check:{n:"Éxito anim",  svg:badge("#20242a",`<circle cx="32" cy="32" r="15" fill="none" stroke="#7bb85b" stroke-width="3.4"/><path d="M24 33 l6 6 11 -13" fill="none" stroke="#7bb85b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`)},
  typing:{n:"Escribiendo",svg:badge("#20242a",`<circle cx="22" cy="32" r="4" fill="${anStroke}"/><circle cx="32" cy="32" r="4" fill="${anStroke}"/><circle cx="42" cy="32" r="4" fill="${anStroke}"/>`)},
  upload:{n:"Subiendo",   svg:badge("#20242a",`<path d="M32 44 v-22 M24 30 l8 -8 8 8" fill="none" stroke="#5b9bd0" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 46 h28" stroke="#5b9bd0" stroke-width="3.4" stroke-linecap="round"/>`)},
  pulse:{n:"Latido",      svg:badge("#20242a",`<circle cx="32" cy="32" r="8" fill="#c16a6a"/><circle cx="32" cy="32" r="15" fill="none" stroke="#c16a6a" stroke-width="2.4" opacity=".5"/>`)},
};
const animURL={};
for(const k in ANIMS) animURL[k]="data:image/svg+xml;utf8,"+encodeURIComponent(ANIMS[k].svg);
const iconURL={}, imgCache={};
for(const k in ICONS) iconURL[k]="data:image/svg+xml;utf8,"+encodeURIComponent(ICONS[k].svg);
/* ===================== Teñido de iconos =====================
   `n.tint` decide, no `n.color`. El color siempre está puesto —todo nodo nace con
   PALETTE[0]— así que hacer que teñir dependa de que haya color repintaría de
   golpe cualquier diagrama ya guardado: los 34 iconos de los 5 ejemplos oficiales
   llevan color y ninguno lo puso para teñir nada. El interruptor separa «tengo un
   color» de «quiero que ese color se vea en el icono».

   El data URI teñido se cachea por clave+color: sin esto se recodifica el SVG
   entero en cada fotograma, para cada icono, dentro del bucle de render. */
const tintedURL={};
function iconSVGFor(key, tint){
  const d=ICONS[key]; if(!d) return "";
  return tint? badge(tint, d.inner) : d.svg;
}
function iconURLFor(key, tint){
  if(!tint) return iconURL[key]||"";
  const ck=key+"|"+tint;
  if(!tintedURL[ck]) tintedURL[ck]="data:image/svg+xml;utf8,"+encodeURIComponent(iconSVGFor(key,tint));
  return tintedURL[ck];
}
/* Color con el que hay que dibujar un nodo `icon`, o null si va con su pastilla
   original. Lo comparten los tres renderers para no decidirlo por triplicado. */
function nodeIconTint(n){ return (n && n.tint && n.color)? n.color : null; }
function getImg(src){
  if(!imgCache[src]){ const im=new Image(); im.src=src; imgCache[src]=im; }
  return imgCache[src];
}
