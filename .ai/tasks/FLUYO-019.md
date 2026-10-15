# FLUYO-019 — Exploración visual 2.5D / technical illustration

Estado: **DONE (discovery) · GO CONDICIONAL aceptado por el owner el 14-10-2026** → continúa en `FLUYO-019.1.md` (implementada el 15-10-2026, READY FOR COMMIT: piel efímera en Present y exportación; `settings.skin`, Share, Viewer y MCP pasan a 019.2). Sin código de producto, sin commit, sin `CACHE`, sin MCP.
Fecha: 14 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: solo contenido técnico del proyecto open source.
> **Este documento es el único archivo escrito en el repo.** El prototipo y las capturas viven FUERA del árbol del producto (§5). No se ha tocado `js/`, `css/`, `sw.js`, tests, `ARCHITECTURE.md`, `DECISIONS.md` ni `fluyo-mcp`.
>
> Fuentes leídas: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/PRODUCT.md`, decisiones 190–200, 018.25. Código: `js/render.js` (entero), `js/geometry.js` (anclas, `edgeStroke`, `cylinderSegments`, `labelLayout`), `js/export.js` (§ SVG), `js/config.js` (temas, paleta, `ICONS`), `js/interaction.js` (`hitNode`, `hitEdge`), `js/present-story.js` (`fitViewPresent`), `js/ui.js` (`enterPresent`), `js/viewer.js`, `css/system.css`, `css/share.css`, y dos ejemplos (`kafka-event-pipeline`, `microservicios-api-gateway`).

---

## 0. Resumen para el owner

- **Sí, el 2.5D tiene potencial real**, pero no como «efecto» sino como **una piel de representación** que se añade detrás del modelo: `documento → geometría 2D → piel → pintor`. El prototipo demuestra que la piel sale **solo de `x, y, w, h, shape, color, label`**: ninguna clave nueva en el documento, mismas anclas, mismas rutas, mismo acierto.
- **Hallazgo clave de la auditoría**: el editor y el Viewer pintan en **Canvas 2D**, no en SVG; el SVG solo existe en la exportación (`export.js`) y en el MCP (`svg.ts`). Por eso el prototipo emite **listas de segmentos** (`M/L/Q/A/Z`, las mismas de `cylinderSegments`) y las pinta dos veces: en SVG (la página) y en canvas (el banco de rendimiento). Es el mismo patrón que ya se usa en 018.14a/018.16 para que lienzo, SVG y MCP no deriven.
- **Dirección recomendada: B (Minimal Product) como base, con la disciplina de línea e índices de A; C (isométrica editorial) queda como «vista» de Present/exportación, no como piel del editor.** Comparativa en §3.
- **Segundo hallazgo que condiciona el valor**: los diagramas reales de Fluyo son **mayoritariamente nodos `icon`** (8 de 11 en el ejemplo de microservicios; 7 de 9 en el de Kafka). Un bloque extruido no les aplica; por eso el prototipo incluye una **peana** para `icon` (§4.6). Sin esa pieza, la piel cambiaría poco los documentos que ya existen.
- **Rendimiento**: medido en Chrome 155 headless (render por software, 2560×1440, 300 nodos + 299 conexiones), B y C cuestan lo mismo que el plano actual (≈7–9 ms/fotograma); A cuesta ~1,7× por el tramado. Todo sin canvas/WebGL nuevo.
- **Recomendación final: GO CONDICIONAL** (§8), con un primer slice acotado a Present + exportación, editor plano.

---

## 1. Auditoría: cómo representa Fluyo hoy (lo que una piel puede y no puede tocar)

| Elemento | Dónde | Qué sale del documento | Qué es solo pintura | Candidato 2.5D |
|---|---|---|---|---|
| Nodo `rect` (y `default`) | `drawNode` → `shapePath` (`roundRect` r=10, borde 2,5, relleno color·0,16/0,18) | `x,y,w,h,color,fill,border,label,font` | radio, grosor, alpha del relleno | **Sí** (bloque) |
| `cylinder` | `cylinderSegments` (geometry.js, 018.14a): tapa única, laterales tangentes | igual | contorno + labio | **Sí** (ya es «semi-3D»; solo cambia el material) |
| `hex`, `diamond`, `circle` | `shapePath` | igual | — | No en v1 (poco uso; el hex podría ser la pieza «bus» más adelante) |
| `icon` | glifo `s=min(w,h-26)·0,78` + pie de 26 px; `anchorBox` reduce el ancho de anclaje al glifo | `icon, tint` | — | **Peana** (el glifo no se extruye) |
| `image`, `anim`, `code`, `text` | pintores propios | — | — | **Planos** (texto y código no son objetos; la imagen es contenido ajeno) |
| Conexión | `edgePoints` (ruta) → `edgeStroke` (línea con esquinas Q de 8 y punta 11×8 con muesca; `arrowSize` 1/1,5/2) → puntos de flujo | `from,to,fromSide,toSide,waypoints,route,arrowSize,dashed,label` | color de línea del tema, puntos | **Sí**, en el aterrizaje y el pie (§4.5); la ruta no cambia |
| Grupos / contenedores | **No existen como entidad.** Un «grupo» hoy es un `rect` grande detrás (orden Z) | — | — | Pieza «container» solo derivable (rect con `fill:"none"` o borde discontinuo que contiene otros) o entidad futura |
| Texto de nodo | `labelLayout` (geometry.js): tamaño por caja, `lblPos`, `textBg`, `textColor` | igual | — | La piel decide tipografía de presentación; el documento manda si trae `font`/`fs` |
| Selección y tiradores | `EDITOR_MARK` oliva: marco a +6, 4 esquinas `HANDLE=7`, funda de conexión, puerto de conectar | — | todo | Deben abrazar **la caja semántica + las caras** (§7) |
| Acierto | `hitNode`: caja `w/2+4, h/2+4`; `hitEdge`: distancia a tramos con tolerancia de pantalla | — | — | Las caras quedan FUERA de la caja: hay que decidir si cuentan (§7) |
| Zoom | mundo × `viewZoom` (0,1–5); los instrumentos del editor miden en pantalla (`/zoom`), el diagrama en mundo | — | — | La profundidad es de mundo: a zoom 0,25 un canto de 8 son 2 px (§7) |
| Present | `enterPresent` oculta el chrome; `fitViewPresent` encaja con márgenes; Historias con overlays (`drawScenarioNodeOverlay` recorta con `shapePath`) | — | — | **El sitio natural de la piel** |
| Viewer | `viewer.js` + `makeReadOnlyRenderState`: mismo `render.js` | — | — | Hereda lo que diga el documento compartido |
| Export | PNG/JPG/GIF = `render(..., {export:true})` (canvas); SVG = `renderNodeToSVG`/`renderConnectorToSVG` (geometría compartida) | — | — | Paridad con `svg.ts` del MCP obligatoria (decisión 170) |

**Dónde entraría la piel sin tocar el modelo**: entre la geometría y el pintor. Hoy `drawNode`/`drawEdge` (canvas) y `renderNodeToSVG`/`renderConnectorToSVG` (SVG) **dibujan directamente**. Una piel devuelve **datos** (segmentos + textos), como ya hacen `cylinderSegments`, `edgeStroke` y `codeBlockLayout`; los tres pintores los recorren (`traceSegments` / `segmentsToSVGPath`). Nada en `model.js`, `scenario-*`, `story-*`, `document-integrity`, `share-url` ni el MCP cambia.

---

## 2. Objetivo del experimento

> ¿Puede Fluyo tener un lenguaje 2.5D propio que haga sus diagramas reconocibles y más atractivos para explicar arquitectura, sin convertirse en un editor 3D?

Respuesta: **sí, con una condición de diseño**: la profundidad es **un vector constante por documento** (oblicua, 45°, 6–10 unidades de mundo), nunca una cámara. El usuario sigue viendo un diagrama; los objetos ganan canto, no perspectiva.

---

## 3. Tres direcciones y comparación

Las tres comparten: cara frontal = rectángulo semántico exacto; caras planas sin gradientes; una sola fuente de luz implícita (tapa clara, lateral oscuro); conexiones de tinta; tipografías del sistema (`IBM Plex Mono`, `Playfair Display`) sobre los tres temas del lienzo.

| | **A · Technical / Industrial** | **B · Minimal Product** | **C · Editorial / Isometric** |
|---|---|---|---|
| Proyección | Oblicua 45°, profundidad ×1,25 (10) | Oblicua 45°, profundidad ×0,9 (7) | Afín isométrica del PLANO entero (`X'=(x−y)·0,866`, `Y'=(x+y)·0,5`), losas que se levantan `≈1,6×depth` |
| Caras | Papel (sin color); lateral **tramada** a 45° (3,2 px); línea de tinta 1 px | Tres tonos planos del color del nodo mezclado con el fondo (tapa 10 %, frente 22 %, lateral 40 %); línea tinta·0,45 | Tres tonos (12 / 26 / 38 %), sombra de suelo dura (pie desplazado 3 px, tinta·0,10) |
| Color de categoría | Un **filete** de 2 px en la base | El relleno de las caras + **LED** de 2,4 px en la esquina | El relleno de las caras |
| Tipografía | Mono 10,5 px versalitas, tracking 1,4; **índice `01…`** sobre cada pieza | Mono 500 12 px | **Playfair 15** para el nombre + mono 8,5 px para la ficha (`service`, `topic`, `store`) |
| Conexión | 0,9 px tinta, punta 0,9×, **tick** perpendicular en el origen; etiqueta en versalitas | 1,5 px tinta·0,55, punta 1×, **puerto** (anillo relleno de fondo) en el origen; etiqueta en píldora | 1,1 px, punto en el origen; vive en el suelo |
| Base de datos | Cilindro de 018.14a con banda lateral tramada | Cilindro de 018.14a con banda lateral de tono (sin gradiente) | Cilindro isométrico: tapa única elíptica, laterales tangentes |
| Bus / cola | Bloque bajo y largo, **particiones** sobre la tapa, doble ranura frontal | Mismo bloque, particiones + **carril** (ranura larga) con LED | Losa larga con particiones en la tapa |
| Contenedor | Bandeja de línea discontinua con **escuadras** en las esquinas, rótulo debajo | Bandeja de tinta·0,03 con tapa y lateral, rótulo dentro | **Plinto** de 4 px bajo las piezas |
| Lo mejor | Es inequívocamente «ilustración técnica»; nadie lo confunde con un diagramador | Mantiene la semántica de color de la paleta; lee igual en crema y oscuro; el más barato; el más «Fluyo» | El más llamativo; el exploded funciona de forma natural; tipografía editorial |
| Lo peor | Texto pequeño en versalitas (legibilidad a zoom < 0,6); pierde los colores de categoría; el tramado cuesta ~1,7× | Riesgo de parecer «hardware genérico» si se abusa del LED | **Cambia la lectura del layout**: un flujo vertical pasa a diagonal; las etiquetas de `placeEdgeLabels` dejan de valer; el acierto exige la afín inversa; conexiones ocultas bajo las losas |
| Coste medido (300 nodos) | 12,1–15,1 ms | 6,5–9,2 ms | 6,7–6,9 ms |
| ¿Sigue siendo Fluyo? | Sí (papel, tinta, mono) | **Sí, el que más** | Sí en Present; no como editor |

**Recomendación: B como sistema base, tomando de A** la línea de tinta fina, el índice opcional `01…` y las particiones/ranura del bus; **C como vista de Present y exportación** («vista isométrica» / «exploded») en un slice posterior, si el primero confirma el valor.

---

## 4. Sistema visual propuesto («Fluyo 2.5D», base B + A)

### 4.1 Profundidad y ángulo
- **Vector de profundidad** `d = (+k, −k)` en unidades de mundo (oblicua 45°, hacia arriba y a la derecha). `k` por documento: **8 por defecto**, rango 4–12. Un único valor para todas las piezas: es lo que hace que convivan.
- Hacia arriba-derecha a propósito: la tapa queda libre para que una conexión que entra por el norte «aterrice» sobre ella, y el lateral derecho no pisa la etiqueta ni el puerto de conectar del lado oeste.
- **Escala**: la profundidad es de mundo, escala con el zoom. Por debajo de **3 px de pantalla** (zoom < 0,375 con k=8) la piel cae a plano: a ese tamaño el canto solo ensucia.

### 4.2 Caras
- **Frente** = rectángulo semántico `(x−w/2, y−h/2, w, h)`, radio **2** (no 10: un objeto construido tiene cantos). Tapa y lateral son paralelogramos derivados (`obliqueFaces`).
- **Material**: tres tonos del color del nodo mezclados con el fondo del tema: tapa 10 %, frente 22 %, lateral 40 % (oscuro: 14 / 26 / 46 %). **Sin gradientes, sin blur.**
- **Línea**: tinta del tema a 0,45 (oscuro 0,55), 1 px. La categoría no va en el borde (hoy el borde es el color a 2,5 px): va en el relleno y en el LED.
- **Sombra**: solo una **línea de contacto** de 2 px bajo la base (tinta·0,22). Nada flota.

### 4.3 Piezas
1. **Block / Service**: frente + tapa + lateral + LED (2,4 px, color del nodo, esquina inferior izquierda). El LED es el candidato natural a reflejar `UP/DOWN` de una Historia más adelante (hoy el estado se pinta con `drawScenarioNodeOverlay`, que seguiría recortando al frente).
2. **Database**: la geometría de 018.14a **no cambia** (tapa única, laterales tangentes). La piel añade: tapa en el tono claro, cuerpo en el tono frente, **una banda vertical** de tono lateral (del 50 % del radio al borde) recortada al contorno. Ni gradiente ni «cilindro de librería».
3. **Queue / Event bus**: bloque bajo (h ≈ 44) y largo; **particiones** cada 20 px sobre la tapa (líneas paralelas a `d`); un **carril** (ranura de 5 px) en el frente con el LED en el origen. Sugiere flujo sin icono. En el producto sería una forma nueva (`shape:"bus"`, aditiva y retrocompatible: una versión antigua la pintaría como `rect`) o una lectura derivada; **fuera del primer slice**.
4. **Container / System**: bandeja de tinta·0,03 con tapa y lateral, rótulo mono dentro, sin radio. Hoy no hay entidad de grupo: en el primer slice se **deriva** (rect con `fill:"none"` o `border:"dashed"` que contiene geométricamente otros nodos) y se pinta antes que las conexiones; si gusta, se discute una entidad en otra tarea.
5. **Connection**: la ruta es la de `edgePoints` sin cambios. Dos añadidos: (a) **aterrizaje en la cara visible**: si el destino se entra por `n` o `e`, la punta se desplaza `d/2` para posarse en la tapa o el lateral (es un desplazamiento del último vértice; el penúltimo lo acompaña para que el tramo siga ortogonal); por `s` y `w` no hay cara, se posa en el borde 2D; (b) **puerto de origen**: anillo de 3 px relleno del fondo. Las conexiones se pintan entre el contenedor y los nodos, como hoy.
6. **Icon** (la pieza que más importa en los documentos reales): el glifo **no se extruye**; se apoya en una **peana** de `s+16 × 7` con el mismo vector `d`; el pie de 26 px sigue siendo el rótulo. `anchorBox` no cambia.
7. **Texto, código, imagen, GIF**: planos.

### 4.4 Tipografía y jerarquía
- Nombre: `IBM Plex Mono 500` 12 px (10 px si `w < 80`). Opción «técnica»: versalitas con índice `01…` (A), derivado del orden de nodos, nunca persistido.
- Etiqueta de conexión: mono 9,5 px en píldora del color del fondo (borde tinta·0,25).
- Contenedor: mono 9,5 px tinta·0,7 dentro de la bandeja.
- Si el documento trae `font`/`fs`/`bold`/`textColor`, mandan (el documento es la fuente de verdad; la piel solo aporta defectos).

### 4.5 Orden de pintor
Derivado, no almacenado: contenedores → conexiones → nodos ordenados por `y` ascendente y `x` descendente (con `d` hacia arriba-derecha, el de abajo y el de la izquierda se pintan después). En el editor el orden Z del documento sigue mandando para el acierto.

### 4.6 Exploded view
Transformación **solo de presentación**: los nodos se agrupan por nivel (`y` redondeada a 10, tolerancia 20) y cada nivel se separa 44 unidades; un eje discontinuo recorre la columna principal y el margen izquierdo lleva índices `01…` con una línea de referencia al nivel. El documento no cambia: es una «vista» de Present (como lo sería «encajar»). En la variante isométrica (C) los niveles se elevan en Z (30 px por nivel, **más el fondo que el frente**, para que ninguna pieza suba sobre la que tiene delante) y cada pieza deja su huella discontinua en el suelo.

---

## 5. Prototipo: dónde está y cómo abrirlo

Carpeta (fuera del producto, scratchpad de la sesión):

```
C:\Users\nectd\AppData\Local\Temp\claude\C--Proyectos-fluyo-new\803f4b5d-6cd9-418e-94ca-8ea1dc545880\scratchpad\fluyo-25d\
  index.html      prototipo completo (HTML + SVG + JS vanilla, sin dependencias)
  fonts\          copias de assets/fonts (Plex Mono 400/500, Playfair 400)
  shots\          capturas (Chrome 155 headless)
  README.md
```

Abrir `index.html` en Chrome (doble clic). Cabecera: **tema** (crema / oscuro / claro), **profundidad** (3–16), **aterrizaje** (cara visible / borde 2D), **rejilla**, **exploded** (A/B/C) y **vista** (todas, actual, A, B, C, exploded, piezas). También por URL: `?view=B&theme=dark&depth=10`. El botón «Medir coste» ejecuta el banco de canvas (§7).

Arquitectura del prototipo (es la propuesta para el producto): `demoDoc()` en formato Fluyo → `edgePoints`/`autoAnchor`/`strokeSegs`/`cylinderSegments` (réplica reducida de `geometry.js`) → `SKINS[k].node(n, ctx)` y `.edge(e, ruta, ctx)` devuelven primitivas `{t:"path", segs:[M/L/Q/A/Z], fill, stroke, sw, dash, clip}` y `{t:"text", …}` → `sceneSVG()` (SVG) o `paintCanvas()` (canvas 2D). Las pieles no leen nada que no esté en el nodo.

> El prototipo **no** es código de producto: simplifica el router (sin carriles, sin `placeEdgeLabels`), no carga iconos reales (la peana lleva un marcador) y no tiene interacción.

---

## 6. Capturas (en `shots\`, 1 px CSS = 1 px)

| Archivo | Qué es |
|---|---|
| `flat-crema.png` | Diagrama de referencia con la pintura actual (bordes 2,5, radio 10, puntos de flujo) |
| `A-crema.png`, `A-dark.png` | Dirección A |
| `B-crema.png`, `B-dark.png` | Dirección B |
| `C-crema.png`, `C-dark.png` | Dirección C |
| `exploded-A-crema.png`, `exploded-B-crema.png` | Exploded oblicuo (niveles separados, eje e índices) |
| `exploded-C-crema.png` | Exploded isométrico (niveles elevados, huellas) |
| `catalog-crema.png` | Las piezas (block, database, bus, container, connection, icon) en A, B y C |
| `B-movil.png`, `flat-movil.png` | B y actual a 360 px de ancho |
| `overview-crema.png` | La página entera |

Todas salen del mismo documento: Client → API → Kafka → (Worker, Worker en un contenedor) → Database, con etiquetas `HTTP`, `produce`, `topic: pagos`, `topic: envíos`.

---

## 7. Riesgos y análisis de interacción (nada implementado; solo diagnóstico)

| Tema | Riesgo | Propuesta |
|---|---|---|
| **Legibilidad** | A con versalitas de 10 px baja de lo legible por debajo de zoom 0,6. En B el canto de 7–8 unidades desaparece a zoom < 0,4. | B por defecto; la piel cae a plano por debajo de 3 px de canto en pantalla. En móvil (360 px, `B-movil.png`) B sigue legible. |
| **Selección** | El marco actual (`caja + 6`) cortaría la tapa y el lateral. | El marco de selección y las 4 esquinas se calculan sobre la **envolvente de las caras** (`caja ∪ caja + d`): derivable de `x,y,w,h,k`, sin estado nuevo. La selección sigue siendo del objeto entero, nunca de una cara. |
| **Acierto** | `hitNode` usa la caja `+4`; la tapa (8 px) queda fuera: pulsar en ella no selecciona. | Dos opciones, ambas baratas: (1) las caras no cuentan (son decoración), o (2) `hitNode` prueba también la caja desplazada `+d` cuando la piel está activa. Recomiendo (2) y que la tolerancia siga en pantalla. `hitEdge` no cambia: la ruta es la misma; el desplazamiento del aterrizaje (`d/2`) es menor que la tolerancia (8 u). |
| **Mover un nodo** | Nada cambia: las caras se derivan de `x,y`. El orden de pintor derivado puede hacer que dos nodos a menos de `k` unidades se tapen el canto. | Aceptable: a esa distancia ya se tocan. |
| **Conexiones** | Con aterrizaje en cara visible la punta se desplaza `d/2`: en pares paralelos (018.25) las puntas siguen separadas por el carril (28 ≫ 4). `arrowSize` 2× (22 px) sigue cabiendo en la tapa. | El desplazamiento se aplica al **último vértice** después de `edgePoints` y antes de `edgeStroke`: `laneLayout`, `orthoRoute` y `placeEdgeLabels` no se tocan. Riesgo real: `placeEdgeLabels` mide la ruta sin el desplazamiento (4 px): irrelevante. |
| **Zoom** | Instrumentos del editor en px de pantalla vs canto en mundo. | Mantener canto en mundo (es parte del dibujo, como `EDGE_W`), con el corte a plano bajo 3 px. |
| **Historias / Playback** | `drawScenarioNodeOverlay` recorta con `shapePath`: el `DOWN` oscurece solo el frente; el LED podría contradecir el estado. | En v1 los overlays recortan **frente + caras** (la envolvente). Vincular el LED al estado es una decisión posterior. Los tokens (`drawEventToken`) viajan por la misma ruta: sin cambios. |
| **Performance** | Primitivas por objeto: actual 2–3 (sin puntos) → B/C 5–6, A 7–8 (el tramado es 1 path con muchos M/L). Banco en canvas (Chrome 155 headless, software, 2560×1440, 300 nodos + 299 conexiones, 60 fotogramas, dos corridas): actual 8,3 / 7,0 ms; A 12,1 / 15,1; **B 6,5 / 9,2**; **C 6,7 / 6,9**. | Dentro del presupuesto de 16,7 ms incluso por software. B/C no cuestan más que lo actual (los puntos de flujo, 6 primitivas por conexión, pesan más que las caras). Evitar `clip` por nodo en canvas (cuesta `save/clip/restore`): la banda del cilindro puede ser un polígono precalculado. |
| **Responsive / móvil** | El Viewer encaja a zoom 0,25–0,4 en móvil: el canto se pierde o ensucia. | Corte a plano bajo 3 px de canto; en Present móvil (`fitViewPresent`) suele quedar por encima de 0,5. |
| **Export SVG y MCP** | `export.js` y `svg.ts` deben pintar lo mismo (decisión 170). Una piel solo en el lienzo rompería la paridad del PNG con el SVG. | La piel emite **segmentos** (`segmentsToSVGPath` ya existe). Si vive en un archivo puro del kernel (sin DOM), `sync:kernel` la copia al MCP y el `vm` puede ejecutarla; si `svg.ts` prefiere portarla, el test de paridad vértice a vértice (como en 018.16/018.27) la vigila. **Condición del GO**: decidirlo antes de exportar. |
| **Present / Viewer** | Dónde aparece. | **Editor: plano** (precisión, tiradores, puertos; opcionalmente un conmutador «vista previa»). **Present: piel activa.** **Viewer: lee el documento compartido**: la piel es un ajuste del documento (`settings.skin`, ausente = plano, retrocompatible: `settings` ya es un objeto abierto con `speed, dots, build…`). **Export: con la piel del documento.** Exploded: solo Present, no persistido en v1. |
| **Iconos** | La mayoría de nodos reales. | Peana (§4.3.6). Sin ella el valor en documentos existentes es bajo. |
| **Documentos antiguos** | Un `.fluyo.json` sin `settings.skin` se pinta plano: byte a byte igual que hoy. | Nada que migrar. |

---

## 8. Recomendación final

**GO CONDICIONAL.**

Condiciones:
1. **Editor plano, piel en Present + exportación** (la piel es un ajuste del documento, ausente = plano). El editor no cambia de aspecto en el primer slice.
2. **Alcance de piezas del primer slice**: `rect`, `cylinder`, `icon` (peana) y conexiones (aterrizaje + puerto). Bus y contenedor quedan para después (no son entidades hoy).
3. **Paridad decidida antes de exportar**: la piel se escribe como funciones puras que devuelven segmentos y se acuerda con fluyo-mcp si `svg.ts` las ejecuta desde el kernel o las porta con test de paridad.
4. **Corte a plano** bajo 3 px de canto en pantalla y selección/acierto sobre la envolvente de las caras.

### Siguiente slice propuesto (FLUYO-019.1 — «Piel 2.5D en Present y exportación»)
- `js/skin.js` (clásico, puro, sin DOM): `skinNodeSegments(n, k, theme)` y `skinEdgeLanding(e, pts, k)` con las piezas de la condición 2; `k` fijo en 8.
- `render.js`: `drawNode`/`drawEdge` consultan `settings.skin` y recorren los segmentos con `traceSegments` (ya existe). Overlays de Historia recortan la envolvente.
- `export.js`: `renderNodeToSVG` usa los mismos segmentos vía `segmentsToSVGPath`.
- `ui.js`: un conmutador en «Más» o en el panel de documento: «Aspecto: plano / construido» → `settings.skin`; Present lo respeta; el Viewer lo lee del share.
- `sw.js`: `CACHE` +1. Tests: golden de segmentos por pieza (`test/fluyo-019-1.test.cjs`), paridad canvas/SVG, y browser smoke en Present a tres zooms.
- Fuera: exploded, vista isométrica (C), bus, contenedor, LED ligado al estado, MCP (solo la decisión de paridad).

---

## Handoff

- **Qué se hizo**: auditoría del renderer (canvas, SVG, geometría, acierto, Present, Viewer); definición del sistema visual; prototipo aislado con cuatro pieles (actual, A, B, C), catálogo de piezas, exploded (oblicuo e isométrico) y banco de rendimiento; capturas comparables en Chrome real.
- **Archivos del repo modificados**: solo este documento.
- **Decisiones**: ninguna duradera (pendiente del owner). Si el GO se confirma, registrar en `DECISIONS.md`: «la piel 2.5D es presentación: vector de profundidad por documento, caras derivadas de `x,y,w,h`, sin claves nuevas en nodos ni conexiones».
- **Pruebas**: prototipo renderizado en Chrome 155 (headless, perfil temporal) en los tres temas; banco de canvas ejecutado dos veces (§7). No hay tests de producto porque no hay código de producto.
- **Pendiente / riesgos**: la decisión de paridad con `svg.ts` (condición 3); comprobar la piel con iconos reales (el prototipo usa un marcador); validar B en oscuro con documentos de usuario reales.
- **Próximo paso concreto**: el owner revisa las capturas y decide GO/NO-GO sobre las cuatro condiciones de §8; si GO, crear `FLUYO-019.1.md` con el alcance del slice propuesto.
