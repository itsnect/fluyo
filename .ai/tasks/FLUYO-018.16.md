# FLUYO-018.16 — Gramática de las conexiones

Estado: **READY FOR COMMIT**. Sin commit, push ni deploy. (`share-browser`: intermitente, no atribuible a 018.16; § 20.)
Fecha: 8 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: el árbol de trabajo con 018.11–018.15 (sin commit sobre `604b344`). 018.14a, 018.14b y 018.15 no se rehacen.
> Regla visual heredada de 018.15: estructura → piedra/tinta · actividad → oliva · evento en tránsito → terracota · éxito → verde · fallo → rojo. El color no decora.
> Fluyo sigue siendo Fluyo: ni NECT, ni logos, ni marcas de agua, ni referencias de marca.
> Fuentes leídas: `AGENTS.md`, `FLUYO-018.11` (D1, D5, P1-8, roadmap), `018.12`–`018.15`; en código `geometry.js`, `render.js`, `interaction.js`, `selection.js`, `model.js` (aristas), `export.js`, `ui.js` (barra táctil, ruta automática), `editor-runtime.js`, `editor-scenarios.js` (`scHighlight`, candidatos de arista), `viewer.js`; en fluyo-mcp `src/svg.ts`, `src/propose-layout.ts`, `scripts/sync-kernel.ts`, `test/visual-regression.test.ts`, `test/render.test.ts`; los tests que tocan flechas, tiradores y conectar (`fluyo-018-12-browser`, `018-13`, `018-15`, `render-boundary`, `editor-runtime`).

## 0. La pregunta

«¿Cómo debería verse y sentirse una conexión en Fluyo en 2026?» — no «¿cómo cambiamos las flechas actuales?».

Respuesta corta, demostrada en § 3–5: **una línea fina de estructura que no toca el destino y lo señala con una punta de aguja; sin marcas en el origen; la selección es una funda oliva bajo la línea con instrumentos pequeños de tamaño constante; para conectar con ratón, un único puerto aparece en el lado que mira al cursor; con el dedo, la acción «Conectar»**.

## 1. Fase 1 — Auditoría

### 1.1 Cómo funciona hoy

| # | Pregunta | Hoy |
|---|---|---|
| 1 | Dibujo | `render.js drawEdge`: polilínea de `edgePoints(e)`, 2 px, `e.lineColor‖THEMES.edge`, `lineJoin round`, discontinua `[8,7]`; puntos de flujo (r 5 + halo r 9) con `dotColor‖color del origen`; etiqueta sobre `lblBg` |
| 2 | Trayectoria | `geometry.js edgePoints`: anclas (`sidePoint`/`autoAnchor`, `anchorBox` para iconos), carriles paralelos (`parallelLane`), puertos compartidos (`portLane`), `orthoRoute` (pasillo de 28 px, guardián anti-muñón) o `[p1,…waypoints,p2]`. Esquinas vivas |
| 3 | Flecha | `arrowHead`: triángulo relleno 12 × 12 con la punta 1 px **más allá** del ancla (pisa el trazo del nodo). En SVG (editor y MCP) es otro: `<marker>` 10 × 8 en `strokeWidth` → **20 × 16**, `fill="context-stroke"` (SVG 2) |
| 4 | Extremos | Sin marca en el origen. `startArrow` (bidireccional) dibuja la misma punta al revés |
| 5 | Selección | `hitEdge`: distancia < **8 unidades de mundo**, igual con ratón y con dedo. Seleccionada: línea y puntas en oliva a 2,6 px |
| 6 | Mover | Extremo (`endDrag`, re-ancla `from/to` + lado), tramo ortogonal (`segDrag`, materializa la ruta en waypoints), codo (`wpDrag`) |
| 7 | Crear | Ratón: 4 flechas de bloque oliva a `ARROW_OFF` = 24 u de mundo fuera de cada lado, en el nodo bajo el cursor **o el seleccionado** (`arrowHostNode`), arrastrar → ortogonal con lados fijados. Rail «Flecha» (C): clic origen, clic destino. Táctil: las mismas flechas + «Conectar» de la barra táctil (018.12) |
| 8 | Editar | Panel (color, discontinua, puntas, sentido del flujo, puntos, etiqueta, fuente); «Volver a la ruta automática» (botón y R) |
| 9 | Waypoints | Solo con **una** conexión seleccionada: puntos r 6 oliva; manejadores de tramo (barra 7/3,5 px en ortogonal, punto r 5 en recta); extremos r 6 (relleno = lado fijado). Todo en unidades de **mundo**: a zoom 0,25 un manejador r 6 mide 1,5 px |
| 10 | Exportar | `export.js renderConnectorToSVG`: `<polyline>` + `marker-end/start`. PNG/GIF: el mismo `drawEdge` con `isExport` |
| 11 | Viewer / Present | El mismo `render()` en solo lectura: sin selección, sin tiradores |
| 12 | Historias | El flujo decorativo se apaga; el evento (terracota, 018.15) recorre `pts` con rastro tinta; llegada en `pts[último]`; al colocar un evento, `scHighlight` dibuja oliva encima de la línea |
| 13 | MCP | `svg.ts`: port independiente de `edgePoints` y de `renderConnectorToSVG` (mismos `<marker>`), con test de paridad de geometría (`visual-regression.test.ts`) |

### 1.2 Tabla

| Elemento | Estado actual | Origen | Superficies | Función | Problema visual | Propuesta |
|---|---|---|---|---|---|---|
| Línea | 2 px, gris del tema | `drawEdge`, `THEMES.edge` | Todas | Estructura | Pesa casi lo mismo que el contorno del nodo (2,5): no hay jerarquía nodo > relación | 1,5 px; mismo color |
| Esquinas | Vivas | `edgePoints` | Todas | Ruta | Codo de editor clásico | Redondeo r 8 (Bézier cuadrática en el vértice), solo en el dibujo |
| Punta | Triángulo 12 × 12 (lienzo) / 20 × 16 (SVG) | `arrowHead`, `<marker>` | Todas | Dirección | Masiva; pisa el borde del nodo; **diverge entre lienzo y SVG**; `context-stroke` no lo entiende cualquier visor | Aguja con muesca 11 × 8, a 3 px del borde, idéntica en lienzo, SVG y MCP (trazado explícito, sin `<marker>`) |
| Origen | Sin marca | — | — | — | Correcto | Sin marca (§ 2) |
| Seleccionada | Línea y puntas oliva 2,6 px | `drawEdge` | Editor | Estado | «Otra línea encima»: el objeto cambia de color en vez de recibir un estado | Funda oliva translúcida bajo la línea; la línea conserva su color |
| Extremos (editar) | Círculo r 6 mundo | `drawEdge` | Editor | Re-anclar | Tamaño de mundo: diminuto a zoom bajo, enorme a zoom alto | Círculo r 4,5 px de pantalla; relleno = lado fijado (semántica intacta) |
| Codos | Círculo r 6 mundo | `drawEdge` | Editor | Mover vértice | Igual que los extremos: misma forma para dos operaciones distintas | Cuadrado 7 px de pantalla |
| Tramos | Barra 7/3,5 mundo o punto r 5 | `drawEdge` | Editor | Deslizar / insertar codo | Tamaño de mundo | Barra 16 × 3 px; anillo r 3,5 px en recta |
| Conectar (ratón) | 4 flechas de bloque a 24 u de mundo, en el nodo bajo el cursor y en el seleccionado | `drawSideArrows`, `arrowHostNode` | Editor | Crear | Estética draw.io (el código lo dice); 4 marcas por nodo; tapan la punta de la conexión entrante | Un puerto: el lado que mira al cursor, solo al pasar por encima |
| Conectar (táctil) | Las mismas flechas en el seleccionado + «Conectar» | `selection.js`, `ui.js` | Editor | Crear | Objetivos de 22 px junto a tiradores y nodo | Solo «Conectar» (D5 de 018.11) |
| Acierto de arista | < 8 u de mundo | `hitEdge` | Editor | Seleccionar | A zoom 0,25 son **2 px**: con el dedo no se puede tocar una conexión | Constante en pantalla: ratón ≥ 6 px, dedo ≥ 16 px (nunca menor que hoy) |
| Acierto de manejadores | Mundo con ratón; mundo/zoom con dedo | `interaction.js` | Editor | Editar | Se dibujarían en px y se acertarían en mundo | `max(hoy, px/zoom)` |
| Vista previa al soltar | Puertos r 6/zoom | `drawDropPreview` | Editor | Destino | — | r 4,5 px, coherente con el puerto |
| Resaltado al colocar evento | Polilínea oliva 6/3 px | `drawEdge` (`scHighlight`) | Editor | Activo | Esquinas vivas sobre línea redondeada | Mismo trazado redondeado; resto igual |
| Evento en Historia | Terracota sobre `pts` | `drawFlowOverlay` | Editor, Present, Viewer | Evento | Correcto (018.15) | Sin cambios |
| SVG / MCP | `<polyline>` + `<marker>` | `export.js`, `svg.ts` | Exportación, `export_diagram` | Paridad | Punta distinta del lienzo | `<path>` de línea + `<path>` de punta desde la misma geometría (`edgeStroke`) |

## 2. Fase 2 — Gramática: qué información necesita Fluyo

| Información | ¿La necesita? | Quién la da hoy | Conclusión |
|---|---|---|---|
| Origen / destino | Sí | La línea toca los dos nodos | Basta la geometría |
| Dirección | **Sí** | La punta, y los puntos animados | Fluyo es flujo: peticiones, eventos, datos. Los puntos animados la dan solo si hay animación: un PNG, un SVG, una diapositiva quieta o «reducir movimiento» la pierden. Además `endArrow`/`startArrow` son **datos** del documento: quitar la punta borraría una elección del usuario. Se conserva, más silenciosa |
| Origen marcado (`A •──▸ B`) | No | — | Duplica marcas por conexión (50 aristas → 50 puntos más) y **los puntos ya significan flujo** en Fluyo: un punto fijo en el extremo se confunde con un punto animado parado (prototipo B, § 3) |
| Línea sin dirección (`A ─── B`) | Solo si el usuario quita la punta | `endArrow:false` | Ya existe como dato |
| Selección | Sí, como **estado** | Recolorear la línea | Funda + instrumentos (§ 5) |
| Conexión activa (Historia) | Sí | El evento terracota que la recorre | La línea sigue siendo estructura (§ 8) |
| Con waypoints | Solo al editar | Manejadores con la selección | Invisibles fuera de la edición (ya hoy) |
| Entre elementos de distinto significado | No en la línea | El color es del nodo | La línea no se tiñe por su origen/destino; `lineColor` sigue siendo del usuario |

**Gramática elegida: `A ──➤ B`** con la punta como aguja separada del borde. Ni `A •──• B` ni `A ─── B`.

## 3. Fase 10 — Prototipos (fuera del repo)

Arnés en el scratchpad de la sesión (`p16/variants.js` + `p16/proto.cjs`): carga el editor real y sustituye **solo** `drawEdge` y `drawSideArrows`. Mismos nodos, mismas rutas, mismos datos.

- **A** — actual.
- **B** — línea 1,5 + punto en origen y destino, sin flecha.
- **C** — línea 1,5 + chevron abierto mínimo.
- **D** — propuesta: línea 1,5, esquinas r 8, aguja con muesca a 3 px del borde, funda de selección, instrumentos en px, puerto único.

Composiciones: 3 nodos / 2 conexiones (zoom 1,35), 10 / 15 (encaje, con discontinua, bidireccional, `lineColor` explícito, waypoints a mano y sin punta) y 30 / 50 (encaje). Temas oscuro, crema y claro; estados normal, nodo seleccionado, puntero encima, conexión seleccionada. Hojas: `p16/sheet-s3-*.png`, `sheet-s3-detalle.png`, `sheet-s3-D2..D4.png`, `sheet-s10*.png`, `sheet-s30.png`.

Lectura:

- **A**: la punta pesa más que la etiqueta y su punta pisa el trazo del nodo; con un nodo seleccionado, las 4 flechas de bloque tapan la punta de la conexión que entra por ese lado (`sheet-s3-D3`).
- **B**: a zoom de encaje **no se sabe hacia dónde va nada**, y el punto fijo de un extremo se lee como un punto de flujo detenido. Descartada.
- **C**: limpia a zoom 1,35; a zoom de encaje el chevron de 1,5 px casi desaparece en el tema oscuro y se lee como un «^» suelto. Descartada como única señal.
- **D**: la dirección se lee a cualquier zoom probado; la aguja no toca el borde; la jerarquía nodo (2,5) > relación (1,5) aparece sola.
- **4 puertos por lado** (primera versión de D, la propuesta literal de 018.11): junto al marco de selección forman un **marco de 8 tiradores** —la estética de redimensionar de los editores clásicos— y el puerto del lado de una conexión entrante cae sobre su punta. Por eso D usa **un solo puerto**, el del lado que mira al cursor.

Densidad medida (píxeles de «tinta» de las conexiones fuera de los nodos, sin puntos animados, a zoom de encaje; suma ponderada por diferencia con el fondo):

| Escena | A | B | C | D | D vs A |
|---|---|---|---|---|---|
| 3 / 2 (oscuro · crema · claro) | 1708 · 1743 · 1772 | 1238 · 1208 · 1218 | 1296 · 1284 · 1296 | 1292 · 1282 · 1293 | −25 % |
| 10 / 15 | 4611 · 4620 · 4677 | 3570 · 3656 · 3767 | 3791 · 3883 · 3998 | 3726 · 3813 · 3924 | −19 % |
| 30 / 50 | 9204 · 9294 · 9351 | 7711 · 7936 · 8032 | 8180 · 8417 · 8524 | 8043 · 8280 · 8384 | −12 % |

(La etiqueta y su fondo cuentan igual en las cuatro; por eso la diferencia relativa baja al crecer el diagrama.) La masa de la punta baja de 72 a ~34 u² por conexión.

**Densidad y puertos.** Con puertos visibles solo bajo el puntero, el número de marcas de conectar en pantalla es **≤ 1 sea cual sea el tamaño del diagrama** (3, 10 o 50 nodos). Lo que escala con el diagrama son las marcas permanentes por conexión: la punta (que D reduce) y los puntos animados (que son la firma del producto y no se tocan; § 12).

## 4. Fase 4 — Extremos de conectar

| Opción | 3 nodos | 50 nodos | Conflictos | Veredicto |
|---|---|---|---|---|
| Siempre visibles | 12 marcas | 200 marcas | Red de puntos | No |
| Al seleccionar | 4 | 4 | Con el marco de selección forman 8 tiradores (lectura «redimensionar»); tapan puntas entrantes | No |
| Al pasar por encima (4) | 4 | 4 | Igual que arriba, sin marco | Aceptable, ruidoso |
| **Al pasar por encima, solo el lado que mira al cursor** | **1** | **1** | Ninguno medido | **Sí** |
| Durante conectar (destino) | 4 en el destino | 4 | Necesarios: dicen a qué lado se fijará | Sí (ya existe, se redimensiona) |

Táctil: no hay «pasar por encima»; los puertos en el seleccionado competirían con 4 tiradores de esquina y con el propio nodo en objetivos de 44 px. → **solo «Conectar»**, que ya existe y está probado (018.12). La decisión D5 de 018.11 se confirma, pero no literalmente: con ratón **un** puerto, no cuatro.

## 5. Fase 5–6 — Conexión seleccionada y waypoints

- **Normal**: color del tema (o `lineColor`), 1,5 px.
- **Seleccionada**: misma línea, mismo color y grosor; debajo, una funda oliva de 10 px de pantalla (`rgba` de `activeMark`: .26 oscuro, .20 claro/crema). Es el análogo del marco del nodo: marca el estado sin alterar el objeto, y enseña de paso la zona que se puede tocar. Con multiselección, solo la funda.
- **Instrumentos** (solo con una conexión seleccionada, tamaño constante en pantalla, oliva sobre el fondo del lienzo):
  - extremo → círculo r 4,5; relleno = lado fijado, hueco = flotante (semántica de hoy);
  - codo (waypoint) → cuadrado 7 px;
  - tramo ortogonal → barra 16 × 3 con funda del fondo;
  - tramo recto → anillo r 3,5 («inserta un codo aquí»).
  Cada forma dice qué operación hace. Ninguno existe fuera de la edición: Viewer, Present, Historias en reproducción y exportación no los ven (ya hoy).
- **Aciertos**: `max(radio de hoy, px/zoom)`; nunca menores que hoy.
- **Semántica de waypoints**: intacta (creación, deslizar, mover, podar, `R`/«Volver a la ruta automática», `clearWaypoints` del MCP, auto-layout).

## 6. Fase 7 — Táctil

| Tarea | Gesto | Objetivo | Feedback |
|---|---|---|---|
| Seleccionar nodo | Toque | Caja + 4 u | Marco oliva |
| Seleccionar conexión | Toque sobre la línea | **≥ 16 px de pantalla** (hoy 8 u de mundo = 2 px a zoom 0,25) | Funda + instrumentos |
| Conectar | Seleccionar origen → «Conectar» → tocar destino → sale solo | El nodo destino entero | Mensaje «Toca el elemento de destino», marco discontinuo en el origen; al crear, la conexión queda seleccionada |
| Mover | Arrastrar | Nodo | — |
| Añadir/mover codo | Con la conexión seleccionada, arrastrar su barra/anillo/cuadrado | ≥ 18–22 px (018.12) | Cursor/forma del instrumento |
| Editar | Panel / doble toque en la etiqueta | — | — |

Sin puertos ni flechas en táctil: la pantalla no se llena de tiradores.

## 7. Fase 8 — Historias (análisis, sin rediseño)

| Momento | Conexión | Evento |
|---|---|---|
| Evento llegando / recorriendo | Estructura: su color, 1,5 px, su punta | Terracota + rastro tinta (018.15) |
| Llega al destino | Igual | Pulso/brillo terracota o anillo verde/rojo en el ancla |
| Resaltado al colocar | Oliva (activo) sobre el mismo trazado redondeado | — |
| Reproducción / pausa | Igual; el flujo decorativo sigue apagado | Congelado en pausa |

La línea no se vuelve «activa» al recorrerla: el protagonista es el evento y una segunda señal simultánea competiría con «Resaltar» (oliva, efecto elegido por el autor). Sin cian en ningún punto.

## 8. Fase 9 — Paridad

Una función de geometría nueva en `geometry.js`, `edgeStroke(e, pts)`, devuelve la línea (segmentos `M/L/Q`) y las puntas (segmentos `M/L/Z`). La consumen el lienzo (`traceSegments`, ampliado con `Q`), el SVG del editor (`segmentsToSVGPath`, ampliado con `Q`) y, portada, `svg.ts` del MCP. El test de paridad existente carga el `geometry.js` real y compara.

## 9. Fase 11 — Decisión

| | Decisión |
|---|---|
| **Conexión normal** | Color `lineColor‖THEMES.edge` (sin cambio); 1,5 px; esquinas r 8 (`min(8, medio tramo)`); sin marca en el origen; punta aguja con muesca (largo 11, semiancho 4, muesca 2,8) con la punta a 3 px del ancla; la línea termina en la muesca; discontinua `[8,7]` |
| **Seleccionada** | Mismo color y grosor; funda oliva 10 px de pantalla; instrumentos de § 5 |
| **Waypoint** | Cuadrado 7 px de pantalla; solo con la conexión seleccionada |
| **Modo conectar** | Ratón: puerto único (r 4,5 px, a 18 px del lado que mira al cursor, con un filete hacia el borde), arrastrar → vista previa de siempre → soltar. Rail «Flecha» (C) sin cambios. Táctil: «Conectar» de la barra; entra con un nodo seleccionado, conecta al tocar el destino, sale solo (o «Cancelar»/Escape) |
| **Táctil** | Sin puertos; aciertos de arista ≥ 16 px; manejadores ≥ los de 018.12 |
| **Historia** | Sin cambios de color ni animación: estructura piedra/tinta, evento terracota, activo oliva |

Sin dudas fundamentales abiertas: se implementa.

## 10. Fase 12 — Implementación (mínima)

| Archivo | Cambio |
|---|---|
| `js/geometry.js` | `edgeStroke(e, pts)` + `strokeDir`/`edgeHeadSegs`; constantes `EDGE_*`; `connectPortPoint` + `CONNECT_PORT_*`; `segmentsToSVGPath` entiende `Q`. `edgePoints`, anclas y carriles **sin cambios** |
| `js/render.js` | `traceSegments` entiende `Q`; `drawEdge` traza con `edgeStroke` (línea `EDGE_W`, puntas rellenas con el color de la línea), funda `EDITOR_MARK.sleeve` al seleccionar sin recolorear, instrumentos en px de pantalla con una forma por operación, resaltado de colocación sobre el mismo trazado; `arrowHead` y `drawSideArrows` eliminados → `drawConnectPort` (puerto único) y `drawLinkOrigin` (marco del origen en «Conectar»); `drawDropPreview` con puertos de `CONNECT_PORT_R` |
| `js/interaction.js` | `edgeHitTol()` (6 px ratón / 16 px dedo, ≥ 8 u); `hitSideArrow` con `connectPortPoint` y `null` en táctil; `arrowHitRadius` = 11 px; extremos, codos y tramos `max(antes, px/zoom)`; comentarios |
| `js/selection.js` | `arrowHostNode()` = nodo bajo el ratón; `null` con el dedo |
| `js/editor-runtime.js` | `interaction.linkFrom` (origen de «Conectar») en el estado de render |
| `js/export.js` | Conexión = `<path>` de trazo + `<path>` por punta desde `edgeStroke`; `buildSVGDefs` (marcadores) eliminado |
| `js/editor-scenarios.js` | Vista previa del diálogo de evento: la misma línea y punta (`edgeStroke`), sin más cambios en Historias |
| `index.html`, `docs/index.html` | Textos de ayuda: «arrastra el punto que aparece en el lado más cercano»; con el dedo, «Conectar» |
| `sw.js` | `CACHE` v74 → **v75** |

No se tocan: `model.js`, `config.js` (kernel), formato, Share, Present (solo hereda el render), Historias como modelo, panel, cabecera, color por defecto de los nodos, herramientas MCP. **`model.js` no se toca**: todo es dibujo e interacción.

fluyo-mcp: `src/svg.ts` porta `edgeStroke` (exportado con `EDGE_W`), `segmentsToSVGPath` con `Q`, `renderConnectorToSVG` con `<path>`, sin `buildDefs`. Kernel y config sin cambios (`check:kernel`, `check:config` verdes).

## 11. Compatibilidad

- **Sin migración ni datos nuevos.** `endArrow`, `startArrow` (y el `bidir` histórico, que la normalización ya traduce), `lineColor`, `dashed`, `route`, `waypoints`, `fromSide/toSide` se leen igual; solo cambia cómo se pintan.
- **Documentos antiguos**: se ven con la gramática nueva (más fina, aguja, esquinas suaves); su geometría es la misma (`edgePoints` intacto: las conexiones pasan por los mismos puntos, las etiquetas caen en el mismo sitio).
- **Colores explícitos**: `lineColor` colorea línea y punta (lienzo, SVG, MCP; probado con mutación).
- **Viewer / Present / Share**: mismo render; sin funda ni instrumentos. Un enlace ya compartido se ve con la gramática nueva.
- **SVG**: deja de usar `<marker>`/`context-stroke` (ganan los visores que no los entendían). Un consumidor que contara `<polyline>` verá `<path>`.
- **MCP**: `export_diagram` = editor byte a byte en las conexiones (golden compartido). Desplegar editor y MCP a la vez; con versiones distintas, solo difiere el dibujo de las conexiones del SVG del MCP.
- **Ejemplos publicados** (`ejemplos/previews/*.svg`): son exportaciones antiguas (ya llevaban un `viewBox` que el exportador actual no produce); siguen con la flecha antigua hasta que se regeneren (pendiente, § 17).

## 12. Fase 13 — Tests

### fluyo

- **Unitarios**: `node --test test/*.test.cjs` → **1078/1078** (1058 + 20 de `test/fluyo-018-16.test.cjs`):
  - `edgeStroke` en vm sobre el `geometry.js` real: constantes; la punta a 3 px del ancla y la línea muere en la muesca; `endArrow`/`startArrow` (y ausente = true); esquinas cuadráticas ≤ 8 y ≤ medio tramo; colineales sin curva; casos límite sin NaN; `segmentsToSVGPath`/`traceSegments` con `Q`; `connectPortPoint` a 18 px de pantalla a zoom 0,5/1/2;
  - render: trazo de `edgeStroke`, la selección no recolorea (funda `sleeve` de 10 px), sin `arrowHead` ni `drawSideArrows` ni `ARROW_OFF`, sin cian, instrumentos en px con una forma por operación, puerto único, marco del origen de «Conectar», `EDITOR_MARK` sin tocar los valores previos;
  - interacción: tolerancias en px y nunca menores; puerto `null` con el dedo; `arrowHostNode` sin selección ni dedo;
  - export: sin `<marker>`, `context-stroke`, `<polyline>` ni `buildSVGDefs`;
  - Viewer y editor cargan `geometry.js` antes que `render.js`; `model.js`/`config.js` sin nada de 018.16; textos de ayuda; vista previa del diálogo de evento; fixtures idénticos a los del MCP; `CACHE` v75.
- **Adaptados, con la misma intención**:
  - pines de `CACHE` v74 → v75 (`010-qa`, `013`, `014`, `015`, `018-10` test/browser/M8, `018-12` test/U1, `018-13` test/browser/U1, `018-14a` test/U1, `018-14b` test/browser/U8, `018-15` test/U1);
  - `fluyo-018-15-browser.cjs`: la firma de color de **nodos** ignora las conexiones, que ahora son `<path>` de `stroke-width="1.5"` (antes `<polyline>`, que la firma no miraba).
- **`test/fluyo-018-16-browser.cjs`** (Chrome 155 real) → **720 ✔ · 0 ✘**, 0 errores de consola. 6 viewports × interfaz clara/oscura × lienzo claro/crema/oscuro (36 celdas); en cada una:
  - normal: línea = color de estructura del tema; `lineColor` terracota intacto; 0 px de cian; 0 px de tinta oliva;
  - seleccionada: la línea conserva su color, funda presente, codo visible solo con la selección, instrumentos de **7–8 px** de pantalla a zoom 0,6 y a 1,6 (antes 3,6 → 9,6 px);
  - acertar a zoom 0,35 a 4 px de la línea (clic o toque);
  - ratón: puerto único en el lado que mira al cursor (32–38 px oliva; los otros tres lados, 0); arrastre real → `¿OK? → BD` con `fromSide:"e"`; seleccionar no saca el puerto;
  - dedo: ningún puerto en el seleccionado; «Conectar» visible, marco discontinuo en el origen, mensaje de destino; tocar el destino crea, selecciona y sale del modo; botones de la barra de 40 px;
  - sin desbordamiento horizontal; lienzo 57–82 % de la ventana.

  En las 18 celdas de interfaz clara, además: SVG del editor = golden compartido con `export_diagram` **byte a byte** (16/16 líneas de conexión, con el gris de cada tema), sin `<marker>`/`<polyline>`/cian; SVG rasterizado con línea de estructura; Viewer con la línea de estructura y sin funda ni instrumentos aunque el documento se compartiera con una conexión seleccionada; Historia real (fixture 017-1) sin cian en 30 fotogramas.

### fluyo-mcp

- `npm test` → **656/656** (650 + 5 de `test/fluyo-018-16.test.ts` + 1 de paridad en `visual-regression.test.ts`):
  - `export_diagram` = golden compartido (`test/fixtures/fluyo-018-16-conexiones-svg.json`); gramática (sin mecanismo antiguo, un trazo por conexión, una punta por extremo con flecha, `Q` en las esquinas); `lineColor` en trazo y punta; documento antiguo (`bidir`, sin `endArrow`) con sus dos puntas; fixtures idénticos a los de fluyo;
  - paridad: `edgeStroke` de la app (vm sobre `fluyo/js/geometry.js`) = port de `svg.ts` en **todas las conexiones del corpus × 4 combinaciones de puntas** y en 5 casos límite; el `d` de la línea, idéntico.
- Adaptados: `render.test.ts` cuenta «conexiones dibujadas» (`<polyline>` de los previews antiguos o `<path>` de 1,5 nuevos: mide lo que se pinta, como ya hacía con los iconos); `fluyo-018-15.test.ts`, la misma exclusión de conexiones en la firma de color de nodos.
- `check:kernel` y `check:config` verdes (kernel y config sin cambios); `tsc --noEmit` limpio.

## 13. Mutaciones

- `test/fluyo-018-16-mutations.cjs`: **21/21 detectadas** (9 estáticas + 12 en Chrome):
  - U1–U9: `CACHE`; **vuelve la punta antigua** (12 × 12 pegada); **cian** en la funda; **la selección recolorea**; el SVG vuelve a `<marker>`; puerto en táctil; acierto en u de mundo; instrumentos en u de mundo; la selección saca el puerto;
  - B1–B12: **divergencia SVG/editor**; **divergencia MCP/editor** (otra geometría en la app); **pérdida de color explícito**; **regreso del cian**; **codo invisible con la conexión seleccionada**; **la conexión deja de ser seleccionable** (dedo); **conectar con ratón deja de funcionar**; **«Conectar» táctil deja de funcionar**; instrumentos en u de mundo; la selección recolorea; el puerto vuelve con el dedo; acierto de 8 u con ratón a zoom bajo.
- `fluyo-mcp/scripts/mutate-018-16.ts`: **9/9** — la app redondea con otro radio / pega la punta (divergencia vista por la paridad); en `export_diagram`: punta pegada, punta antigua, vuelve el `<marker>`, la punta pierde el color explícito, ignora `startArrow`, esquinas vivas, otro grosor.
- Regresión de mutaciones estáticas anteriores: 018.10 **9/9**, 018.12 **8/8**, 018.13 **6/6**, 018.14a **10/10**, 018.14b **10/10**, 018.15 **12/12**.

## 14. Fase 14 — QA en Chrome real

Chrome 155 (`channel: "chrome"`), 1440, 1280, 1101 (ratón), 768 (táctil), 390 y 375 (móvil, táctil), cada uno con interfaz clara y oscura y lienzo claro, crema y oscuro, con el gesto real (ratón o `touchscreen`).

| Medida | Resultado |
|---|---|
| Objetivos | Acierto de línea ≥ 6 px (ratón) / ≥ 16 px (dedo) a cualquier zoom (antes 2 px a zoom 0,25); extremos ≥ 7 / ≥ 22 px; codos ≥ 7 / ≥ 18 px; puerto 11 px; barra táctil 40 px |
| Desbordamiento | 0 px en las 36 celdas |
| Lienzo visible | 82 % (1440) · 77 % (1280) · 66 % (1101) · 63 % (768) · 59 % (390) · 57 % (375); sin chrome nuevo |
| Densidad | Tinta de conexiones −25 % (3 nodos), −19 % (10), −12 % (30) frente a la actual (§ 3); marcas de conectar en pantalla ≤ 1 (antes 4 en el nodo bajo el cursor **y** 4 en el seleccionado) |
| Legibilidad | Colores del tema sin cambios (contraste 4,0 oscuro · 3,3 crema · 3,5 claro); la línea pasa de 2 a 1,5; aguja de 11 × 8 px a zoom 1 y ≈ 4 × 3 px a zoom 0,35 (antes 4 × 4) |
| Precisión | Instrumentos de 7–8 px medidos a zoom 0,6 y 1,6; punta a 3 px del ancla |
| Errores | 0 de consola o de página en las 36 celdas, en el Viewer y en la Historia |

**Batería de Chrome existente** (27 suites además de la de 018.16), sobre el árbol final:

- verdes: 013, 013-qa, 014, 015, 015-qa, 016, 017-3, 018-3, 018-4, 018-5, 018-7a, 018-7c, 018-7d, 018-8, 018-9, 018-10, **018-12** (conectar con ratón y con «Conectar», comparado con HEAD), 018-13, 018-14a, 018-14b, 018-15, qa-share-hash, scenario-qa, share-post-qa, share-realistic-size;
- `fluyo-011-browser`: los mismos 3 fallos previos (subtests 4, 6 y SW v45 → v61), pendientes desde 018.12;
- `share-browser`: se agota esperando el clic en `#pgTabs button` del **Viewer** tras salir de Presentar, porque `header#chrome` intercepta el puntero. 018.15 lo registró como «NOT RUN — environment». Este slice no toca cabecera, pestañas ni `s/index.html`, pero **no lo he reproducido sobre el árbol previo**: queda pendiente (§ 17).

## 15. Capturas

En el scratchpad de la sesión (fuera del repo):

- `p16/sheet-s3-normal|nodo|conexion.png`, `sheet-s3-detalle.png`: A/B/C/D, 3 nodos, tres lienzos;
- `p16/sheet-s3-D2.png`, `sheet-s3-D3.png`, `sheet-s3-D4.png`: puerto único frente a las flechas de bloque; choque de las flechas con la punta entrante;
- `p16/sheet-s10.png`, `sheet-s10-crop.png`, `sheet-s30.png`: densidad;
- `p16/antes-despues-s3|s10|s30.png`: antes | después con el render de producción;
- `t16/` (108): por celda, selección y conectar; por viewport y lienzo, Viewer e Historia.

## 16. Desviaciones

- **Puertos.** 018.11 proponía «un punto por lado». El prototipo mostró que cuatro puntos junto al marco de selección forman un marco de 8 tiradores y tapan puntas entrantes: se implementa **uno**, en el lado que mira al cursor, y solo al pasar por encima (no con la selección).
- **Vista previa del diálogo de evento** (`editor-scenarios.js`): se alinea con el lienzo (misma línea y aguja), como 018.15 alineó la de «Resaltar». Nada más de Historias cambia.
- **`ARROW_OFF`** queda en `config.js` sin uso: quitarlo cambiaría el kernel del MCP sin necesidad.
- **Previews de `ejemplos/`**: no se regeneran (son exportaciones antiguas y ya divergían del exportador).
- El rail «Flecha» (C) no cambia: su goma elástica sigue saliendo del centro del origen.

## 17. Riesgos y pendientes

- **Todo diagrama existente se ve distinto** (más fino, aguja, esquinas suaves), también los enlaces ya compartidos y las exportaciones nuevas. La ruta no cambia. Es el objetivo del slice; reversible en `EDGE_*` (`geometry.js` + `svg.ts`, con la paridad vigilando que vayan juntos).
- **Línea de 1,5 en pantallas de densidad 1 y zoom bajo**: más tenue que la de 2 (medido: a 375 px y densidad 1 el núcleo se aclara). Palanca: `EDGE_W` 1,75.
- **Descubribilidad del puerto**: aparece al pasar por encima, en el lado más cercano; quien buscaba las flechas en el nodo seleccionado tiene que acercar el ratón. La ayuda y `docs/` lo explican.
- **Puntos de flujo**: siguen siendo la marca dominante en diagramas grandes (r 5 + halo r 9 por punto); no eran objeto de este slice.
- **Despliegue**: editor y MCP a la vez (`CACHE` v75). Con versiones cruzadas solo difiere el dibujo de las conexiones en el SVG de `export_diagram`.
- Pendientes: `share-browser` (clic en las pestañas del Viewer tras Presentar); `fluyo-011-browser` (3 previos); regenerar `ejemplos/previews/*.svg`; los de 018.15 (chips cian del diálogo de evento, relleno por defecto `#3aa7e8`, `export_diagram` con nodos sin color).

## 18. CACHE

`fluyo-static-v74` → **`fluyo-static-v75`**. Cambian servidos ya precacheados: `js/geometry.js`, `render.js`, `interaction.js`, `selection.js`, `export.js`, `editor-runtime.js`, `editor-scenarios.js`, `index.html`, `docs/index.html`. Sin archivos servidos nuevos.

## 19. git status (al cerrar)

Sin commit. **fluyo** — de 018.16 (sobre 018.11–018.15, que ya estaban):

- servidos: `js/geometry.js`, `js/render.js`, `js/interaction.js`, `js/selection.js`, `js/export.js`, `js/editor-runtime.js`, `js/editor-scenarios.js`, `index.html`, `docs/index.html`, `sw.js`;
- documentación: `.ai/DECISIONS.md` (143–145), `.ai/ARCHITECTURE.md` (§ Conexiones), `CONTRIBUTING.md` (una línea del mapa), esta tarea;
- nuevos: `test/fluyo-018-16.test.cjs`, `test/fluyo-018-16-browser.cjs`, `test/fluyo-018-16-mutations.cjs`, `test/fixtures/fluyo-018-16-conexiones.json`, `test/fixtures/fluyo-018-16-conexiones-svg.json`;
- adaptados: `test/fluyo-018-15-browser.cjs` y los pines de `CACHE` v75.

**fluyo-mcp** — `src/svg.ts`, `test/render.test.ts`, `test/visual-regression.test.ts`, `test/fluyo-018-15.test.ts`; nuevos `test/fluyo-018-16.test.ts`, `scripts/mutate-018-16.ts` y los dos fixtures de 018.16. Kernel y config sin cambios.

## Handoff

### Estado actual

018.16 implementado y verificado. Sin commit, push ni deploy.

### Próximo paso concreto

1. Revisión del responsable: `p16/antes-despues-s3.png`, `t16/d1440-dark-dark-conectar.png` y las decisiones 143–145.
2. Con OK, commit de fluyo (018.11–018.16) y de fluyo-mcp (018.14a + 018.15 + 018.16); `npm run sync:kernel` en fluyo-mcp tras el commit de fluyo (el contenido no cambiará).
3. Desplegar editor y MCP a la vez (`CACHE` v75).
4. Aparte: investigar `share-browser` (cabecera del Viewer sobre `#pgTabs` tras Presentar) y regenerar `ejemplos/previews/*.svg`.

## 20. `share-browser`: ¿lo introdujo 018.16? — **C. Intermitente, no atribuible a 018.16**

Sin cambios de código en esta investigación (el árbol de trabajo es byte a byte la copia B de abajo). Sin commit, push ni deploy.

### Baseline

- **No existía un snapshot exacto del estado pre-018.16.** Buscados: scratchpads de las sesiones, copias temporales de los arneses (`fluyo-*-mut-*`, `fluyo-head-*`: v61, de octubre 1–2) y las copias de la sesión de 018.15 (`p15/before|after`: v73, de su fase de prototipo, no de su estado final v74). `HEAD 604b344` **no** se usa: es anterior a 018.11–018.15.
- **Reconstrucción**: copia del árbol actual fuera del repo (A) sobre la que se deshacen, como sustituciones exactas nuevo → original, los 35 cambios de 018.16 en los 10 archivos servidos (`geometry.js`, `render.js`, `interaction.js`, `selection.js`, `export.js`, `editor-runtime.js`, `editor-scenarios.js`, `index.html`, `docs/index.html`, `sw.js`). Cada patrón apareció **exactamente una vez**: en esas regiones no había cambios ajenos a 018.16. Script: `sb/revert16.py` (scratchpad).
- **Validación independiente de la reconstrucción**:
  1. `geometry.js`, `export.js`, `selection.js`, `editor-runtime.js` y `editor-scenarios.js` reconstruidos son **idénticos** (salvo fin de línea) a las copias que hizo la sesión de 018.15 (`p15/before` y `p15/after`), que no los tocó;
  2. la batería unitaria tal como estaba antes de 018.16 (pines de `CACHE` v74, sin los tests de 018.16) pasa en A: **1057 ✔ · 0 ✘ · 1 omitido** (el omitido exige `fluyo-mcp` al lado de la copia). Incluye los tests de 018.13–018.15 que fijan código exacto de `render.js` e `interaction.js`.
- **B**: copia del árbol actual (018.16). `diff` A↔B = exactamente los 10 archivos servidos de 018.16. El Viewer y su cabecera (`viewer.js`, `s/index.html`, `share.css`, `system.css`, `present-story.js`) son **iguales** en A, en B y en las copias de 018.15.
- Mismo `test/share-browser.cjs` en el repo, A y B (sha1 `9fa75ecb9844…`), **sin modificar**. Instrumentación externa por precarga (`node -r sb/probe-preload.cjs`): envuelve `Locator.click` solo para `#pgTabs button` y registra, antes del clic y si falla, `elementFromPoint`/`elementsFromPoint` en el punto del clic, cajas del botón, de `#pgTabs` (y su desplazamiento) y de `header#chrome`, `z-index`, `pointer-events`, `display` y si el Viewer está en Presentar.

### Ejecuciones

Chrome 155, viewport 1280 × 720 (el del test), densidad 1. Paso del fallo: Viewer en contexto limpio → zoom → Presentar → siguiente → salir → clic en la primera pestaña de página.

| Serie | A (pre-018.16) | B (018.16) |
|---|---|---|
| Sin carga, intercaladas A/B | **6/6 pasan** (7,2–7,6 s) | **6/6 pasan** (7,2–7,5 s) |
| CPU saturada (24 procesos, 1 por núcleo), intercaladas | **4/4 pasan** (50–59 s) | **4/4 pasan** (60–94 s) |
| Árbol 018.16 aislado (sesión anterior) | — | 3/3 pasan |
| Batería de regresión de 018.16 (27 suites en serie) | — | **1 fallo** |

En las 20 ejecuciones instrumentadas, el estado antes del clic es **idéntico en A y en B**:
- punto del clic (142,2; 24,5), botón en (106; 9,5) de 72,4 × 30;
- `elementFromPoint` = el propio botón;
- `header#chrome` estático, `z-index:auto`, `pointer-events:auto`, 1280 × 50;
- fuera de Presentar (`body` sin `presenting`);
- `#pgTabs` **no desplazable** (scrollLeft 0, scrollWidth = clientWidth = 785).

Todas las llegadas al final terminan en el «NOT RUN — environment» habitual (gate de privacidad sin script de Umami).

Bajo carga, B tardó más en media (73 s frente a 55 s, n = 4, con mucha dispersión: 60–94). Sin carga no hay diferencia (7,2–7,6 s en ambos). No se atribuye: la muestra es pequeña y el paso que falla no depende del tiempo de render del editor.

### El fallo observado

Una sola vez, en la batería de regresión de 018.16 (18:54, sin otras ejecuciones mías en paralelo: las mutaciones y la batería de 018.16 habían terminado a las 18:35). Durante 30 s de reintentos, Playwright vio «interceptar» el clic a cuatro elementos en **ciclo de 4**: svg de `.tools`, svg de `.tools`, `.logo` (puntos o `span`) y `header#chrome`.

`playwright-core` 1.63 rota en cada reintento cuatro alineaciones de `scrollIntoView`: ninguna, `end`, `center` y `start` (`coreBundle.js`, `scrollOptions[retry % 4]`). Que el interceptor siga ese mismo ciclo, y que caiga tanto a la derecha (herramientas) como a la izquierda (logo) de la cabecera, indica que en esa ejecución el botón estaba dentro de un `#pgTabs` **desplazable y recortado**, mucho más estrecho que sus pestañas. Cada alineación lo dejaba bajo una zona distinta de la cabecera. No había una capa fija encima.

En todas las ejecuciones sanas, `#pgTabs` mide 785 px y no es desplazable.

### Causa

- **Probable**: un estado de maquetación transitorio de la cabecera del Viewer (`header#chrome`: logo, `#pgTabs` con `flex:1 1 auto; min-width:0; overflow-x:auto`, y `.tools`) en el que `#pgTabs` quedó comprimido al salir de Presentar.
- **No demostrada**: no se ha reproducido en 23 ejecuciones (20 instrumentadas y 3 sin instrumentar).
- **Por qué no puede atribuirse a 018.16**:
  - 018.16 no toca ningún archivo de esa cabecera ni del Viewer: `s/index.html`, `share.css`, `system.css`, `viewer.js` y `present-story.js` son iguales en A y en B;
  - lo único de 018.16 que carga el Viewer es `geometry.js` y `render.js`, que solo dibujan en el lienzo `#sv` y no intervienen en la maquetación del DOM;
  - el baseline y 018.16 se comportan igual en todas las ejecuciones;
  - el único fallo observado no se repite en ninguno de los dos.
- **Qué evidencia falta para atribuirlo a un slice**: reproducirlo, con la instrumentación de arriba, y capturar `#pgTabs` (`clientWidth`/`scrollWidth`) y el ancho de `.logo` y `.tools` en el fallo, en A y en B. Tarea futura propuesta: **«Viewer: `share-browser` intermitente al volver de Presentar (`#pgTabs` comprimido)»**. Ámbito: cabecera del Viewer y el test, fuera de 018.16. Si se confirma, el arreglo pertenece al slice dueño de esa cabecera (018.14a), no a las conexiones.

### Cierre

- **Clasificación**: **C. Intermitente / no determinable.** Ni regresión demostrada ni preexistente demostrado; sin diferencia atribuible a 018.16.
- **Archivos afectados**: ninguno de 018.16 está en la ruta del fallo. Ruta del fallo: `s/index.html`, `css/share.css`, `css/system.css`, `js/viewer.js` y `js/present-story.js`, ninguno modificado por 018.16.
- **Cambios de código en esta investigación**: **no**. Solo esta sección y la línea de estado.
- **Suites**:
  - `share-browser` A 10/10, B 13/13 (más 1 fallo aislado previo);
  - `fluyo-018-16-browser` 1440 + 768 sobre el árbol real: **240 ✔ · 0 ✘**;
  - `fluyo-018-16.test.cjs` 20/20;
  - la batería completa de § 12–14 sigue vigente (unitarios 1078/1078, MCP 656/656, Chrome 720/720, regresión 25/27 con `fluyo-011` y este caso explicados).
- **Mutaciones**: sin cambios desde § 13 (fluyo 21/21, MCP 9/9).
- **git status**: idéntico al de § 19. fluyo tiene 48 archivos modificados y 29 sin seguimiento, los mismos que al terminar 018.16; los servidos son byte a byte la copia B. fluyo-mcp, sin cambios desde § 19.
- **Artefactos** (scratchpad de la sesión, fuera del repo): `sb/A`, `sb/B`, `sb/revert16.py`, `sb/probe-preload.cjs`, `sb/diag.cjs`, `sb/runs/` (12 ejecuciones con sondas), `sb/load/` (8 con carga), `reg/share-browser.log` (el fallo original).

**018.16 queda READY FOR COMMIT.**
